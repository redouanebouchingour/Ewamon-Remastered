/**
 * WorldSession (SPEC §20.3.4): the one Colyseus connection.
 *
 * - enter(zoneId): `POST /zone/enter { zoneId }` → SeatReservation (the server picks the shard; the client
 *   never calls joinOrCreate) → `sdk.auth.token = access` → `client.consumeSeatReservation(seat, ZoneState)`.
 *   403 `gated` → toast and stay; 409 `wrongZone` → retried once with the zone the server names.
 * - Every ServerMessage type is registered once with `room.onMessage(type, cb)` (no '*' handler); the
 *   disposers are collected and called on leave/handover. Payloads are validated with protocol's
 *   SERVER_MESSAGES schemas (the handover seat goes straight into consumeSeatReservation).
 * - Reconnect: on an unconsented drop the SDK's built-in reconnection runs with the spec's schedule
 *   (1, 2, 4, 8, 8, 8 s — 6 attempts); `ui.connection` goes 'reconnecting' → 'connected' | 'offline'.
 *   On reconnect `/me` is re-read through hydrateFromMe. Deviation D5: the SDK's reconnection is
 *   configured rather than a hand-rolled `client.reconnect(token)` loop (0.18 retries internally and a
 *   second loop would race it).
 * - Handover (spine §4.6): consume the destination seat, wait for its first state, send `handoverAck`
 *   there, swap; the source is closed by the server with 4002 (we leave it ourselves after 6 s otherwise).
 *
 * Part 2 (World3D / SceneDirector / BattleController) plugs in through `onRoom`, `onMessage` and
 * `onReconnected` — nothing here touches the scene.
 */
import { Client } from '@colyseus/sdk';
import type { Room } from '@colyseus/sdk';
import { CLIENT_MESSAGES, CLOSE_CODES, SERVER_MESSAGES, SERVER_MESSAGE_TYPES, ZoneState } from '@ewa/protocol';
import type { ClientMessageType, ClientPayload, SeatReservation, ServerMessage, ServerMessageOf, ZoneId } from '@ewa/protocol';
import { toast } from '../state/notifications';
import { useSessionStore } from '../state/session';
import { useUiStore } from '../state/ui';
import { ApiFailure, apiFetch } from './api';

export type ZoneRoom = Room<unknown, ZoneState>;

export interface WorldSession {
  readonly room: ZoneRoom | null;
  /** player uuid (room.state.players key), not sessionId */
  readonly selfId: string;
  readonly zoneId: ZoneId | null;
  enter(zoneId: ZoneId): Promise<void>;
  /** Validates with CLIENT_MESSAGES[type] (throws in dev, drops + console.error in prod), then room.send. */
  send<K extends ClientMessageType>(type: K, payload: ClientPayload<K>): void;
  /** one dispatcher; fan-out inside the client */
  onMessage(cb: (m: ServerMessage) => void): () => void;
  handover(m: ServerMessageOf<'handover'>): Promise<void>;
  leave(): Promise<void>;
  /** part 2 seam: fires with the new room (or null) on join, handover and leave */
  onRoom(cb: (room: ZoneRoom | null, zoneId: ZoneId | null) => void): () => void;
  /** part 2 seam: prediction + remote buffers are cleared here after a reconnect */
  onReconnected(cb: () => void): () => void;
  /** useRoomState: fires on every applied patch of the current room and on every room change */
  subscribeState(cb: () => void): () => void;
}

export interface WorldSessionDeps {
  readonly wsUrl: string;
  readonly createClient: (url: string) => Client;
  readonly fetchSeat: (zoneId: ZoneId) => Promise<SeatReservation>;
  readonly refetchMe: () => Promise<void>;
  readonly accessToken: () => string | null;
  readonly selfId: () => string;
  readonly dev: boolean;
}

/** SPEC §20.3.4 reconnect schedule: 1, 2, 4, 8, 8, 8 s. */
export const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 8000, 8000] as const;
const HANDOVER_STATE_TIMEOUT_MS = 5000;
/** Colyseus `CloseCode.SERVER_SHUTDOWN` (@colyseus/shared-types 0.18.2): a server restart, not a takeover. */
export const SERVER_SHUTDOWN_CODE = 4001;
const SOURCE_LEAVE_GRACE_MS = 6000;

export function defaultWsUrl(): string {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  return env?.['VITE_WS_URL'] ?? 'ws://localhost:2567';
}

export function createWorldSession(deps: WorldSessionDeps): WorldSession {
  let client: Client | null = null;
  let room: ZoneRoom | null = null;
  let zoneId: ZoneId | null = null;
  let entering: { zoneId: ZoneId; promise: Promise<void> } | null = null;
  let handingOver = false;
  let disposers: (() => void)[] = [];
  let reconnectPoll: ReturnType<typeof setInterval> | null = null;
  const messageListeners = new Set<(m: ServerMessage) => void>();
  const roomListeners = new Set<(room: ZoneRoom | null, zoneId: ZoneId | null) => void>();
  const reconnectListeners = new Set<() => void>();
  const stateListeners = new Set<() => void>();
  /** rooms we are leaving on purpose (consented leave, handover source): their onLeave is expected */
  const retiring = new WeakSet<object>();

  const emitState = (): void => {
    for (const l of stateListeners) l();
  };
  const emitRoom = (): void => {
    for (const l of roomListeners) l(room, zoneId);
    emitState();
  };

  const dispatch = (m: ServerMessage): void => {
    for (const l of messageListeners) {
      try {
        l(m);
      } catch (e) {
        console.error('server message handler failed', m.type, e);
      }
    }
  };

  const ui = (): ReturnType<typeof useUiStore.getState> => useUiStore.getState();

  function stopReconnectPoll(): void {
    if (reconnectPoll !== null) clearInterval(reconnectPoll);
    reconnectPoll = null;
  }

  function configureReconnection(r: ZoneRoom): void {
    const rc = r.reconnection;
    rc.enabled = true;
    rc.maxRetries = RECONNECT_DELAYS_MS.length;
    rc.minDelay = RECONNECT_DELAYS_MS[0];
    rc.maxDelay = 8000;
    rc.minUptime = 1000;
    rc.backoff = (attempt: number): number => RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length) - 1] ?? 8000;
  }

  /** Registers every ServerMessage type once on `r`; returns the disposers. */
  function wire(r: ZoneRoom): (() => void)[] {
    const out: (() => void)[] = [];
    for (const type of SERVER_MESSAGE_TYPES) {
      const schema = SERVER_MESSAGES[type];
      out.push(
        r.onMessage(type, (payload: unknown) => {
          if (r !== room) return; // a handover source still delivering after the swap
          const parsed = schema.safeParse(payload);
          if (!parsed.success) {
            console.error('invalid server message', type, parsed.error.issues.slice(0, 3));
            return;
          }
          dispatch(parsed.data as unknown as ServerMessage);
        }),
      );
    }
    const onState = (): void => {
      if (r === room) emitState();
    };
    r.onStateChange(onState);
    out.push(() => r.onStateChange.remove(onState));

    r.onDrop(() => {
      if (r !== room) return;
      ui().setConnection('reconnecting', 1);
      stopReconnectPoll();
      reconnectPoll = setInterval(() => {
        if (r !== room) return stopReconnectPoll();
        const attempt = Math.max(1, r.reconnection.retryCount);
        if (ui().connection === 'reconnecting') ui().setConnection('reconnecting', attempt);
      }, 500);
    });
    r.onReconnect(() => {
      if (r !== room) return;
      stopReconnectPoll();
      ui().setConnection('connected');
      for (const l of reconnectListeners) l();
      void deps.refetchMe().catch((e: unknown) => console.warn('re-reading /me after reconnect failed', e));
    });
    r.onLeave((code: number) => {
      stopReconnectPoll();
      if (retiring.has(r) || r !== room) return;
      const wasReconnecting = ui().connection === 'reconnecting';
      disposeWiring();
      room = null;
      if (code === CLOSE_CODES.replaced) ui().setConnection('offline', 0, 'replaced');
      else if (code === SERVER_SHUTDOWN_CODE) ui().setConnection('offline', 0, 'restarted');
      else if (code === CLOSE_CODES.kicked && !wasReconnecting) ui().setConnection('offline', 0, 'kicked');
      else ui().setConnection('offline', 0, 'failed');
      emitRoom();
    });
    return out;
  }

  function disposeWiring(): void {
    for (const d of disposers) d();
    disposers = [];
  }

  function adopt(r: ZoneRoom, z: ZoneId): void {
    disposeWiring();
    room = r;
    zoneId = z;
    configureReconnection(r);
    disposers = wire(r);
    useSessionStore.getState().setZone(z);
    ui().setConnection('connected');
    emitRoom();
  }

  function sdk(): Client {
    if (client === null) client = deps.createClient(deps.wsUrl);
    client.auth.token = deps.accessToken() ?? '';
    return client;
  }

  async function doEnter(target: ZoneId, retried: boolean): Promise<void> {
    let seat: SeatReservation;
    try {
      seat = await deps.fetchSeat(target);
    } catch (e) {
      if (e instanceof ApiFailure) {
        const zoneFromServer = e.error.extra?.['zoneId'];
        if (e.error.code === 'wrongZone' && !retried && typeof zoneFromServer === 'string') {
          return doEnter(zoneFromServer as ZoneId, true);
        }
        if (e.error.code === 'gated') toast('warn', 'That zone is sealed until you earn its badge.');
        else if (e.error.code === 'inBattle') toast('warn', 'Finish your battle first.');
        else toast('danger', e.error.status === 0 ? 'Cannot reach the world server.' : `Could not enter the world (${e.error.code}).`);
        ui().setConnection('offline', 0, 'failed');
      }
      throw e;
    }
    let r: ZoneRoom;
    try {
      r = (await sdk().consumeSeatReservation(seat, ZoneState)) as ZoneRoom;
    } catch (e) {
      toast('danger', 'Cannot reach the world server.');
      ui().setConnection('offline', 0, 'failed');
      throw e;
    }
    adopt(r, target);
  }

  const session: WorldSession = {
    get room() {
      return room;
    },
    get selfId() {
      return deps.selfId();
    },
    get zoneId() {
      return zoneId;
    },

    enter(target) {
      if (room !== null && zoneId === target) return Promise.resolve();
      if (entering !== null && entering.zoneId === target) return entering.promise;
      const promise = (async () => {
        if (room !== null) await session.leave();
        await doEnter(target, false);
      })().finally(() => {
        entering = null;
      });
      entering = { zoneId: target, promise };
      return promise;
    },

    send(type, payload) {
      const parsed = CLIENT_MESSAGES[type].safeParse(payload);
      if (!parsed.success) {
        const msg = `invalid client message '${type}': ${parsed.error.issues.map((i) => i.message).join('; ')}`;
        if (deps.dev) throw new RangeError(msg);
        console.error(msg);
        return;
      }
      room?.send(type, parsed.data);
    },

    onMessage(cb) {
      messageListeners.add(cb);
      return () => messageListeners.delete(cb);
    },

    async handover(m) {
      if (handingOver || room === null) return;
      handingOver = true;
      const source = room;
      try {
        const dest = (await sdk().consumeSeatReservation(m.seat, ZoneState)) as ZoneRoom;
        await new Promise<void>((resolve) => {
          const t = setTimeout(resolve, HANDOVER_STATE_TIMEOUT_MS);
          dest.onStateChange.once(() => {
            clearTimeout(t);
            resolve();
          });
        });
        dest.send('handoverAck', { roomId: m.roomId, seat: m.seat.sessionId });
        retiring.add(source);
        adopt(dest, m.zoneId);
        setTimeout(() => {
          // the server closes the source with 4002 once the destination confirms; this is the fallback
          if (source.connection?.isOpen) void source.leave(true);
        }, SOURCE_LEAVE_GRACE_MS);
      } catch (e) {
        console.error('handover failed', e);
        toast('warn', 'Crossing failed — staying here.');
      } finally {
        handingOver = false;
      }
    },

    async leave() {
      stopReconnectPoll();
      const r = room;
      disposeWiring();
      room = null;
      zoneId = null;
      if (r !== null) {
        retiring.add(r);
        try {
          await r.leave(true);
        } catch (_e) {
          // already closed
        }
      }
      emitRoom();
    },

    onRoom(cb) {
      roomListeners.add(cb);
      return () => roomListeners.delete(cb);
    },

    onReconnected(cb) {
      reconnectListeners.add(cb);
      return () => reconnectListeners.delete(cb);
    },

    subscribeState(cb) {
      stateListeners.add(cb);
      return () => stateListeners.delete(cb);
    },
  };
  return session;
}

// ---- the app singleton ------------------------------------------------------------------------------------

let singleton: WorldSession | null = null;

export function getWorldSession(): WorldSession {
  if (singleton === null) {
    singleton = createWorldSession({
      wsUrl: defaultWsUrl(),
      createClient: (url) => new Client(url),
      fetchSeat: async (zoneId) => (await apiFetch('zoneEnter', { body: { zoneId } })).seat,
      refetchMe: async () => useSessionStore.getState().hydrateFromMe(await apiFetch('me')),
      accessToken: () => useSessionStore.getState().accessToken,
      selfId: () => useSessionStore.getState().profile?.id ?? '',
      dev: Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV),
    });
  }
  return singleton;
}

/** Test seam. */
export function __setWorldSessionForTests(s: WorldSession | null): void {
  singleton = s;
}
