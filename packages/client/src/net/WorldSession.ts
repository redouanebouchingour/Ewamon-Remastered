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
 *
 * Arena PvP (protocol arena.ts): the session holds either the zone room or ONE `arena` room (`kind`). `enterArena(seat)`
 * retires the zone room (a consented leave: the server writes the position; no offline / kicked UI), consumes the arena
 * seat and adopts it with the same message wiring (`onRoom` fires null, `onArena` fires the arena room); a second
 * `enterArena` from inside an arena (Queue again) hops rooms. `returnToWorld()` leaves the arena and enters the zone
 * the player left. `POST /zone/enter` answering 409 `inArena` (a reload mid arena battle) rejoins the arena
 * (`POST /arena/rejoin`). While in the arena only the battle messages are sent (`ARENA_SENDABLE`); `enter()` keeps the
 * player in the arena (a remount of the shell must not forfeit a battle).
 */
import { Client } from '@colyseus/sdk';
import type { Room } from '@colyseus/sdk';
import { ArenaState, CLIENT_MESSAGES, CLOSE_CODES, SERVER_MESSAGES, SERVER_MESSAGE_TYPES, ZoneState } from '@ewa/protocol';
import type { ClientMessageType, ClientPayload, SeatReservation, ServerMessage, ServerMessageOf, ZoneId } from '@ewa/protocol';
import { toast } from '../state/notifications';
import { useSessionStore } from '../state/session';
import { useUiStore } from '../state/ui';
import { ApiFailure, apiFetch } from './api';
import { isReplayBattle } from '../battle/replayId';

export type ZoneRoom = Room<unknown, ZoneState>;
export type ArenaRoom = Room<unknown, ArenaState>;
/** Which room the session is about: the world's zone room, or an arena (the arena's socket may already be closed). */
export type SessionKind = 'zone' | 'arena';
/** The client messages an arena room takes (everything else is dropped silently while in the arena). */
export const ARENA_SENDABLE: ReadonlySet<ClientMessageType> = new Set<ClientMessageType>(['battleAction', 'battleResync']);

export interface WorldSession {
  /** the ZONE room (null while in an arena) */
  readonly room: ZoneRoom | null;
  /** the arena room while in an arena and its socket is open */
  readonly arenaRoom: ArenaRoom | null;
  /** 'arena' from `enterArena` until `returnToWorld` (or a real leave) */
  readonly kind: SessionKind;
  /** the zone the player returns to from the arena (null outside one) */
  readonly homeZone: ZoneId | null;
  /** player uuid (room.state.players key), not sessionId */
  readonly selfId: string;
  readonly zoneId: ZoneId | null;
  enter(zoneId: ZoneId): Promise<void>;
  /** Validates with CLIENT_MESSAGES[type] (throws in dev, drops + console.error in prod), then room.send. */
  send<K extends ClientMessageType>(type: K, payload: ClientPayload<K>): void;
  /** one dispatcher; fan-out inside the client */
  onMessage(cb: (m: ServerMessage) => void): () => void;
  /**
   * Battle replays: hands a client-made message to every `onMessage` listener as if the server had sent it (the replay
   * driver plays a shared battle through the scene's normal battle path). Optional so test fakes need not carry it.
   */
  inject?(m: ServerMessage): void;
  handover(m: ServerMessageOf<'handover'>): Promise<void>;
  /** Moves the player into the arena room of `seat` (from the zone, or from another arena). */
  enterArena(seat: SeatReservation): Promise<void>;
  /** Leaves the arena (a consented leave; mid-battle it forfeits) and enters the zone the player left. */
  returnToWorld(): Promise<void>;
  /**
   * Fires on arena entry (the room), when the arena room is retired for a hop (null, true), when it closed under the
   * player (null, true, closed = true: disposed after the battle, or a dead socket) and on the return (null, false).
   */
  onArena(cb: (room: ArenaRoom | null, inArena: boolean, closed: boolean) => void): () => void;
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
  /** `POST /arena/rejoin`: the seat of the arena the server still has the player in (a reload mid arena battle) */
  readonly rejoinArena: () => Promise<SeatReservation>;
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
  /** the open socket of either kind (`kind` says which) */
  let active: Room | null = null;
  let kind: SessionKind = 'zone';
  let zoneId: ZoneId | null = null;
  /** arena: the zone to return to */
  let home: ZoneId | null = null;
  let entering: { zoneId: ZoneId; promise: Promise<void> } | null = null;
  /** an arena hop / return / rejoin in flight (the switches run one at a time) */
  let switching: Promise<void> | null = null;
  let handingOver = false;
  let disposers: (() => void)[] = [];
  let reconnectPoll: ReturnType<typeof setInterval> | null = null;
  const messageListeners = new Set<(m: ServerMessage) => void>();
  const roomListeners = new Set<(room: ZoneRoom | null, zoneId: ZoneId | null) => void>();
  const arenaListeners = new Set<(room: ArenaRoom | null, inArena: boolean, closed: boolean) => void>();
  const reconnectListeners = new Set<() => void>();
  const stateListeners = new Set<() => void>();
  /** rooms we are leaving on purpose (consented leave, handover source, arena switch): their onLeave is expected */
  const retiring = new WeakSet<object>();

  const zoneRoom = (): ZoneRoom | null => (kind === 'zone' ? (active as ZoneRoom | null) : null);
  const arenaRoom = (): ArenaRoom | null => (kind === 'arena' ? (active as ArenaRoom | null) : null);

  const emitState = (): void => {
    for (const l of stateListeners) l();
  };
  const emitRoom = (): void => {
    const r = zoneRoom();
    for (const l of roomListeners) l(r, r === null ? null : zoneId);
    emitState();
  };
  const emitArena = (closed = false): void => {
    const r = arenaRoom();
    for (const l of arenaListeners) l(r, kind === 'arena', closed);
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

  function configureReconnection(r: Room): void {
    const rc = r.reconnection;
    rc.enabled = true;
    rc.maxRetries = RECONNECT_DELAYS_MS.length;
    rc.minDelay = RECONNECT_DELAYS_MS[0];
    rc.maxDelay = 8000;
    rc.minUptime = 1000;
    rc.backoff = (attempt: number): number => RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length) - 1] ?? 8000;
  }

  /** Registers every ServerMessage type once on `r` (a zone or an arena room); returns the disposers. */
  function wire(r: Room, which: SessionKind): (() => void)[] {
    const out: (() => void)[] = [];
    for (const type of SERVER_MESSAGE_TYPES) {
      const schema = SERVER_MESSAGES[type];
      out.push(
        r.onMessage(type, (payload: unknown) => {
          if (r !== active) return; // a handover source / a left room still delivering after the swap
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
      if (r === active) emitState();
    };
    r.onStateChange(onState);
    out.push(() => r.onStateChange.remove(onState));

    r.onDrop(() => {
      if (r !== active) return;
      ui().setConnection('reconnecting', 1);
      stopReconnectPoll();
      reconnectPoll = setInterval(() => {
        if (r !== active) return stopReconnectPoll();
        const attempt = Math.max(1, r.reconnection.retryCount);
        if (ui().connection === 'reconnecting') ui().setConnection('reconnecting', attempt);
      }, 500);
    });
    r.onReconnect(() => {
      if (r !== active) return;
      stopReconnectPoll();
      ui().setConnection('connected');
      for (const l of reconnectListeners) l();
      void deps.refetchMe().catch((e: unknown) => console.warn('re-reading /me after reconnect failed', e));
    });
    r.onLeave((code: number) => {
      stopReconnectPoll();
      if (retiring.has(r) || r !== active) return;
      const wasReconnecting = ui().connection === 'reconnecting';
      disposeWiring();
      active = null;
      if (which === 'arena') {
        // the arena closed under the player (disposed after the battle, or the socket died): the scene stays until the
        // arena flow sends them back (`onArena(null, true)`); only a takeover is an offline state
        if (code === CLOSE_CODES.replaced) ui().setConnection('offline', 0, 'replaced');
        else ui().setConnection('connected');
        emitArena(true);
        return;
      }
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
    kind = 'zone';
    home = null;
    active = r;
    zoneId = z;
    configureReconnection(r);
    disposers = wire(r, 'zone');
    useSessionStore.getState().setZone(z);
    ui().setConnection('connected');
    emitRoom();
  }

  function adoptArena(r: ArenaRoom): void {
    disposeWiring();
    kind = 'arena';
    active = r;
    zoneId = null;
    configureReconnection(r);
    disposers = wire(r, 'arena');
    ui().setConnection('connected');
    emitArena();
  }

  function sdk(): Client {
    if (client === null) client = deps.createClient(deps.wsUrl);
    client.auth.token = deps.accessToken() ?? '';
    return client;
  }

  /** Retires the open socket (a consented leave: its onLeave is expected) and tells the listeners it is gone. */
  async function retire(): Promise<void> {
    stopReconnectPoll();
    const r = active;
    const was = kind;
    disposeWiring();
    active = null;
    if (was === 'zone') zoneId = null;
    if (r === null) return;
    retiring.add(r);
    if (was === 'zone') emitRoom();
    else emitArena();
    try {
      await r.leave(true);
    } catch (_e) {
      // already closed
    }
  }

  /** Into the arena of `seat`; `from` is the zone to return to. A failed join goes back to that zone. */
  async function joinArena(seat: SeatReservation, from: ZoneId | null): Promise<void> {
    home = from ?? home ?? useSessionStore.getState().zoneId;
    await retire();
    kind = 'arena';
    let r: ArenaRoom;
    try {
      r = (await sdk().consumeSeatReservation(seat, ArenaState)) as ArenaRoom;
    } catch (e) {
      console.error('arena join failed', e);
      toast('danger', 'Could not reach the arena.');
      await backToZone();
      return;
    }
    adoptArena(r);
  }

  /** Out of the arena (its room already left) into the zone the player came from. */
  async function backToZone(): Promise<void> {
    const target = home ?? useSessionStore.getState().zoneId;
    kind = 'zone';
    home = null;
    emitArena();
    if (target === null) {
      ui().setConnection('offline', 0, 'failed');
      return;
    }
    await doEnter(target, false).catch(() => undefined); // doEnter toasts + flips ui.connection itself
  }

  /** One switch at a time (an arena hop, a return, a rejoin). */
  function serial(run: () => Promise<void>): Promise<void> {
    const prev = switching;
    const p: Promise<void> = (async () => {
      if (prev !== null) await prev.catch(() => undefined);
      await run();
    })().finally(() => {
      if (switching === p) switching = null;
    });
    switching = p;
    return p;
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
        // arena PvP: a reload mid arena battle — the server still seats the player in the arena
        if (e.error.code === 'inArena' && !retried) {
          let arenaSeat: SeatReservation | null = null;
          try {
            arenaSeat = await deps.rejoinArena();
          } catch (_e) {
            arenaSeat = null; // the arena ended in between: the zone takes the player again
          }
          if (arenaSeat === null) return doEnter(target, true);
          return joinArena(arenaSeat, target);
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
      return zoneRoom();
    },
    get arenaRoom() {
      return arenaRoom();
    },
    get kind() {
      return kind;
    },
    get homeZone() {
      return kind === 'arena' ? home : null;
    },
    get selfId() {
      return deps.selfId();
    },
    get zoneId() {
      return kind === 'zone' ? zoneId : null;
    },

    enter(target) {
      if (kind === 'arena') {
        // the arena keeps the player (a shell remount must not forfeit a battle); with its socket gone (an offline
        // retry) the server is asked whether the arena still seats them, else the zone takes them back
        if (active !== null) return Promise.resolve();
        return serial(async () => {
          if (kind !== 'arena' || active !== null) return;
          let seat: SeatReservation | null = null;
          try {
            seat = await deps.rejoinArena();
          } catch (_e) {
            seat = null;
          }
          if (seat !== null) await joinArena(seat, home ?? target);
          else {
            home = home ?? target;
            await backToZone();
          }
        });
      }
      if (active !== null && zoneId === target) return Promise.resolve();
      if (entering !== null && entering.zoneId === target) return entering.promise;
      const promise = (async () => {
        if (active !== null) await session.leave();
        await doEnter(target, false);
      })().finally(() => {
        entering = null;
      });
      entering = { zoneId: target, promise };
      return promise;
    },

    send(type, payload) {
      // battle replays: a replay's battle exists only in this client; nothing about it goes to the server
      const battleId: unknown = typeof payload === 'object' && payload !== null ? (payload as { readonly battleId?: unknown }).battleId : undefined;
      if (typeof battleId === 'string' && isReplayBattle(battleId)) return;
      const parsed = CLIENT_MESSAGES[type].safeParse(payload);
      if (!parsed.success) {
        const msg = `invalid client message '${type}': ${parsed.error.issues.map((i) => i.message).join('; ')}`;
        if (deps.dev) throw new RangeError(msg);
        console.error(msg);
        return;
      }
      // an arena room takes only the battle messages (prediction input, chat, interacts … wait for the world)
      if (kind === 'arena' && !ARENA_SENDABLE.has(type)) return;
      active?.send(type, parsed.data);
    },

    onMessage(cb) {
      messageListeners.add(cb);
      return () => messageListeners.delete(cb);
    },

    inject(m) {
      dispatch(m);
    },

    async handover(m) {
      const source = zoneRoom();
      if (handingOver || source === null) return;
      handingOver = true;
      try {
        const dest = (await sdk().consumeSeatReservation(m.seat, ZoneState)) as ZoneRoom;
        await new Promise<void>((resolve) => {
          const t = setTimeout(resolve, HANDOVER_STATE_TIMEOUT_MS);
          dest.onStateChange.once(() => {
            clearTimeout(t);
            resolve();
          });
        });
        if (active !== source) {
          // an arena match took the player while the crossing was in flight: the destination is not wanted
          retiring.add(dest);
          void dest.leave(true);
          return;
        }
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

    enterArena(seat) {
      return serial(async () => {
        // a pending zone entry (the shell's first enter) would adopt its room after this: let it land first
        if (entering !== null) await entering.promise.catch(() => undefined);
        const from = kind === 'zone' ? (zoneId ?? useSessionStore.getState().zoneId) : home;
        await joinArena(seat, from);
      });
    },

    returnToWorld() {
      return serial(async () => {
        if (kind !== 'arena') return;
        await retire();
        await backToZone();
      });
    },

    onArena(cb) {
      arenaListeners.add(cb);
      return () => arenaListeners.delete(cb);
    },

    async leave() {
      const was = kind;
      await retire();
      if (was === 'arena') {
        kind = 'zone';
        home = null;
        emitArena();
      }
      zoneId = null;
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
      rejoinArena: async () => (await apiFetch('arenaRejoin', { body: {} })).seat,
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
