/**
 * Arena PvP — the `arena` room: one battle outside the world (protocol arena.ts).
 *
 * Created per match by the lobby (rooms/arenaLobby.ts, `matchMaker.createRoom('arena', { ticket, match })`) with one
 * reserved seat per human player. Lifecycle:
 *
 *   waiting   — seats are being taken; every join gets `arenaState`. All humans present → the battle starts
 *               (`BattleCoordinator.startArena`: healed synthetic copies, the match's level, noExp, no items).
 *               A seat not taken within ARENA_ARRIVAL_MS → `cancelled / noShow`; a player leaving → `cancelled / left`;
 *               a start refused → `cancelled / party | cup`.
 *   fighting  — battleAction / battleResync as in the zone room (same validation and rate limits). A drop keeps the
 *               seat 20 s (allowReconnection); a real leave forfeits (pvp) or abandons (training). A reload rejoins
 *               through POST /arena/rejoin (a fresh seat here; the join gets `arenaState` + `battleResync`).
 *   ended     — after `battleEnd`; the client leaves and re-enters the world (POST /zone/enter).
 *
 * Presence: each seated player's entry points at this room with `arena: true` (zoneId = where they stood in the
 * world); the room never publishes `ewa:kick` (the client leaves its zone room itself). The per-player arena topic is
 * forwarded here too, so "queue again" from the result screen reaches the player.
 *
 * Spectator mode (game/liveBoard.ts): a queued match between two players (standard, Level 50, ranked, cup) is published
 * on the live board when its battle starts, again after every turn (a turn behind), and in full when it ends. A ranked
 * match in League Finals week between two of the season's top eight is marked `finals`.
 */
import { Room, ServerError } from '@colyseus/core';
import type { AuthContext, Client } from '@colyseus/core';
import { SEASON_FINALISTS, finalsWeek, seasonAt, weeklyCup } from '@ewa/content';
import type { ActiveCup, ZoneId } from '@ewa/content';
import { createRng, replayBattle } from '@ewa/core';
import type { BattleOutcome, SideChoice } from '@ewa/core';
import { ARENA_ARRIVAL_MS, ARENA_MODES, ArenaState, CLIENT_MESSAGES, CLOSE_CODES, REPLAY_BATTLE_ID } from '@ewa/protocol';
import type { ArenaPhase, ClientPayload, ServerMessage } from '@ewa/protocol';
import type { RoomDeps } from '../deps';
import { createRoomMetrics } from '../metrics';
import type { RoomMetrics } from '../metrics';
import { allow, createLimiterState, shouldNotify } from '../rest/rateLimit';
import type { RateLimiterState } from '../rest/rateLimit';
import { ArenaLobby, cupView, idleStatus, statusMsg } from './arenaLobby';
import type { ArenaMeta } from './arenaLobby';
import { arenaTopic } from './arenaQueue';
import { BattleCoordinator } from './battleSession';
import type { BattleHost, BattleSession } from './battleSession';
import type { ArenaMatch } from './matchmaking';
import { LIVE_DELAY_TURNS } from '../game/liveBoard';
import type { LiveFeed } from '../game/liveBoard';
import { anonymiseStart, replayOpts } from '../game/replay';

export interface ArenaJoinOptions {
  /** server-only join ticket (R2) */
  readonly ticket?: string;
  /** onCreate only */
  readonly match?: ArenaMatch;
}

export interface ArenaAuth {
  readonly playerId: string;
  readonly username: string;
  readonly ip: string | null;
}

export interface ArenaUserData {
  readonly playerId: string;
  readonly limiter: RateLimiterState;
  /** a newer socket of the same player took the seat: this one's leave changes nothing */
  replaced: boolean;
}

export type ArenaClient = Client<{ userData: ArenaUserData; auth: ArenaAuth }>;

/** Spectator mode: the queued kinds whose matches anyone may watch. */
const LIVE_KINDS: ReadonlySet<string> = new Set(ARENA_MODES);

/** The arena's battles form here: no zone, terrain none (`capital`). */
export const ARENA_ZONE = { id: 'arena', biome: 'capital' } as const;
export const ARENA_TICK_INTERVAL_MS = 250;
export const ARENA_RECONNECT_S = 20;

export class ArenaRoom extends Room<{ state: ArenaState; metadata: ArenaMeta; client: ArenaClient }> {
  /** Bound by `bindArenaRoom(deps)`. */
  static roomDeps: RoomDeps | null = null;

  match!: ArenaMatch;
  battles!: BattleCoordinator;
  metrics!: RoomMetrics;
  private phase: ArenaPhase = 'waiting';
  private reason: string | null = null;
  private cup: ActiveCup | null = null;
  private battleId: string | null = null;
  private starting = false;
  /** player uuid → the sessionId that holds the seat */
  private readonly owner = new Map<string, string>();
  /** player uuid → its arena-topic callback */
  private readonly subs = new Map<string, (m: ServerMessage) => void>();
  /** spectator mode: the battle on the live board (null: not a watchable match, or not started) */
  private live: { readonly session: BattleSession; readonly startedAt: number; finals: boolean; ready: boolean; shared: number } | null = null;

  protected get deps(): RoomDeps {
    const d = (this.constructor as typeof ArenaRoom).roomDeps;
    if (d === null) throw new Error('ArenaRoom used without bindArenaRoom(deps)');
    return d;
  }

  override async onCreate(options: ArenaJoinOptions): Promise<void> {
    const deps = this.deps;
    if (options?.ticket !== deps.ticket || options.match === undefined) throw new ServerError(403, 'noTicket');
    const match = options.match;
    this.match = match;
    this.cup = match.kind === 'cup' ? weeklyCup(match.createdAt) : null;
    // each human may hold a second (rejoin) reservation while the first socket waits out its reconnection
    this.maxClients = match.players.length * 2;
    this.autoDispose = true;
    // the reserved seats outlive the arrival window (the room cancels a no-show itself)
    this.seatReservationTimeout = Math.ceil(ARENA_ARRIVAL_MS / 1000) + 5;
    const state = new ArenaState();
    state.matchId = match.matchId;
    state.phase = 'waiting';
    this.state = state;
    await this.setMetadata({ matchId: match.matchId, kind: match.kind, phase: 'waiting' });
    // not registered with the process metrics (the zone rooms' table); the coordinator counts its faults here
    this.metrics = createRoomMetrics(this.roomId, ARENA_ZONE.id as ZoneId, 0);
    this.battles = new BattleCoordinator(createRng(`arena:${match.matchId}`), {
      repos: deps.repos,
      content: deps.content,
      clock: deps.clock,
      log: deps.log.child({ roomId: this.roomId, arena: match.kind, matchId: match.matchId }),
      zone: ARENA_ZONE,
      host: this.battleHost(),
      metrics: this.metrics,
    });
    this.onMessage('battleAction', (client: ArenaClient, payload: unknown) => this.dispatch(client, 'battleAction', payload));
    this.onMessage('battleResync', (client: ArenaClient, payload: unknown) => this.dispatch(client, 'battleResync', payload));
    // every other world message means nothing here (no kick: a client may still flush a world message on arrival)
    this.onMessage('*', () => undefined);
    this.clock.setInterval(() => this.tick(), ARENA_TICK_INTERVAL_MS);
  }

  override async onAuth(_client: Client, options: ArenaJoinOptions, context: AuthContext): Promise<ArenaAuth> {
    const deps = this.deps;
    const token = context.token;
    if (token === undefined || token === null || token === '') throw new ServerError(401, 'noToken');
    let claims;
    try {
      claims = deps.verifyAccess(token);
    } catch (_e) {
      throw new ServerError(401, 'badToken');
    }
    if (options?.ticket !== deps.ticket) throw new ServerError(403, 'noTicket');
    if (!this.match.players.some((p) => p.playerId === claims.sub)) throw new ServerError(403, 'notInMatch');
    const row = await deps.repos.db.transaction((tx) => deps.repos.players.byId(tx, claims.sub));
    if (row === null || row.bannedAt !== null || deps.bans.isBanned(claims.sub)) throw new ServerError(401, 'banned');
    return { playerId: claims.sub, username: row.username, ip: context.ip ?? null };
  }

  override async onJoin(client: ArenaClient, _options: ArenaJoinOptions, auth: ArenaAuth): Promise<void> {
    const deps = this.deps;
    const { playerId } = auth;
    // a second socket of the same player (a reload's rejoin) takes the seat over
    for (const other of this.clients) {
      if (other === client || other.userData?.playerId !== playerId) continue;
      other.userData.replaced = true;
      try {
        other.leave(CLOSE_CODES.replaced);
      } catch (_e) {
        // a socket waiting out its reconnection has nothing to close
      }
    }
    this.owner.set(playerId, client.sessionId);
    client.userData = { playerId, limiter: createLimiterState(), replaced: false };
    // presence: this room, `arena`, and the world zone the player stood in (where they return afterwards)
    const prev = await deps.presenceMirror.lookup(playerId);
    let zoneId: ZoneId | null = prev?.zoneId ?? null;
    if (zoneId === null) {
      const row = await deps.repos.db.transaction((tx) => deps.repos.players.byId(tx, playerId));
      zoneId = (row?.zoneId ?? 'mirevale') as ZoneId;
    }
    const live = this.battleId !== null && this.battles.ofPlayer(playerId)?.id === this.battleId ? this.battleId : null;
    deps.presenceMirror.enter(playerId, { roomId: this.roomId, zoneId, shard: 0, battleId: live, tradeId: null, since: deps.clock(), arena: true });
    if (auth.ip !== null) deps.presenceStore.ipEnter(auth.ip);
    this.subscribePlayer(playerId);
    this.sendMsg(client, this.arenaState());
    if (live !== null) {
      const resync = this.battles.resync(playerId, live);
      if (resync !== null) this.sendMsg(client, resync);
    }
    // verified speedruns: time in an arena is time played
    await deps.repos.db.transaction((tx) => deps.repos.runs.start(tx, playerId, new Date(deps.clock()))).catch((e: unknown) => deps.log.error({ err: e, playerId }, 'play clock start failed'));
    this.maybeStart();
  }

  override onDrop(client: ArenaClient, code?: number): void {
    const ud = client.userData;
    if (ud === undefined || ud.replaced || code === CLOSE_CODES.replaced || code === CLOSE_CODES.consented) return;
    if (this.phase !== 'waiting' && this.phase !== 'fighting') return;
    this.allowReconnection(client, ARENA_RECONNECT_S).catch(() => undefined);
  }

  override async onLeave(client: ArenaClient, _code?: number): Promise<void> {
    const ud = client.userData;
    if (ud === undefined) return;
    const deps = this.deps;
    if (client.auth?.ip != null) deps.presenceStore.ipLeave(client.auth.ip);
    if (ud.replaced || this.owner.get(ud.playerId) !== client.sessionId) return;
    const playerId = ud.playerId;
    this.owner.delete(playerId);
    if (this.phase === 'waiting' && !this.starting) this.cancel('left', playerId);
    else await this.battles.forfeitIfActive(playerId, 'disconnect').catch((e: unknown) => deps.log.error({ err: e }, 'arena forfeit failed'));
    deps.presenceMirror.leave(playerId, this.roomId);
    this.unsubscribePlayer(playerId);
    await deps.repos.db.transaction((tx) => deps.repos.runs.stop(tx, playerId, new Date(deps.clock()))).catch((e: unknown) => deps.log.error({ err: e, playerId }, 'play clock stop failed'));
  }

  override onDispose(): void {
    this.battles?.dispose();
    for (const id of [...this.subs.keys()]) this.unsubscribePlayer(id);
  }

  // ─── messaging ──────────────────────────────────────────────────────────────

  private sendMsg(client: ArenaClient, msg: ServerMessage): void {
    this.metrics.msgsOut += 1;
    client.send(msg.type as never, msg as never);
  }

  private clientOf(playerId: string): ArenaClient | undefined {
    const sid = this.owner.get(playerId);
    if (sid === undefined) return undefined;
    const c = this.clients.getById(sid);
    return c !== undefined && c.userData !== undefined && !c.userData.replaced ? c : undefined;
  }

  private sendTo(playerId: string, msg: ServerMessage): void {
    const c = this.clientOf(playerId);
    if (c !== undefined) this.sendMsg(c, msg);
  }

  private broadcastState(): void {
    const msg = this.arenaState();
    for (const p of this.match.players) this.sendTo(p.playerId, msg);
  }

  private arenaState(): ServerMessage {
    const m = this.match;
    return {
      type: 'arenaState',
      matchId: m.matchId,
      kind: m.kind,
      level: m.level,
      phase: this.phase,
      players: m.players,
      foeName: ArenaLobby.foeName(m),
      cup: this.cup === null ? null : cupView(this.cup),
      reason: this.reason,
    };
  }

  private subscribePlayer(playerId: string): void {
    if (this.subs.has(playerId)) return;
    const cb = (m: ServerMessage): void => this.sendTo(playerId, m);
    this.subs.set(playerId, cb);
    void this.presence.subscribe(arenaTopic(playerId), cb);
  }

  private unsubscribePlayer(playerId: string): void {
    const cb = this.subs.get(playerId);
    if (cb === undefined) return;
    this.subs.delete(playerId);
    this.presence.unsubscribe(arenaTopic(playerId), cb);
  }

  /** battleAction / battleResync: the zone room's rate limits and payload validation. */
  private dispatch(client: ArenaClient, type: 'battleAction' | 'battleResync', payload: unknown): void {
    const ud = client.userData;
    if (ud === undefined || ud.replaced) return;
    this.metrics.msgsIn += 1;
    const now = this.deps.clock();
    if (!allow(ud.limiter, type, now)) {
      if (shouldNotify(ud.limiter, type, now)) this.sendMsg(client, { type: 'error', code: 'rateLimited', detail: type });
      return;
    }
    const parsed = CLIENT_MESSAGES[type].safeParse(payload);
    if (!parsed.success) return this.sendMsg(client, { type: 'error', code: 'invalidPayload', detail: type });
    if (type === 'battleAction') {
      const m = parsed.data as ClientPayload<'battleAction'>;
      const err = this.battles.action(ud.playerId, m.battleId, m.turn, m.action, m.pos);
      if (err !== null) this.sendMsg(client, { type: 'error', code: err.code, detail: err.detail });
      return;
    }
    const m = parsed.data as ClientPayload<'battleResync'>;
    const msg = this.battles.resync(ud.playerId, m.battleId);
    this.sendMsg(client, msg ?? { type: 'error', code: 'notFound', detail: null });
  }

  // ─── phases ─────────────────────────────────────────────────────────────────

  private setPhase(phase: ArenaPhase, reason: string | null = null): void {
    this.phase = phase;
    this.reason = reason;
    this.state.phase = phase;
    void this.setMetadata({ matchId: this.match.matchId, kind: this.match.kind, phase });
  }

  /** Every human seat taken → the battle (once). */
  private maybeStart(): void {
    if (this.phase !== 'waiting' || this.starting) return;
    if (!this.match.players.every((p) => this.clientOf(p.playerId) !== undefined)) return;
    this.starting = true;
    void this.start().catch((e: unknown) => {
      this.deps.log.error({ err: e, matchId: this.match.matchId }, 'arena start failed');
      this.starting = false;
      this.cancel('error', null);
    });
  }

  private async start(): Promise<void> {
    const m = this.match;
    const players = m.players.map((p) => ({ playerId: p.playerId, sessionId: this.owner.get(p.playerId) ?? '' }));
    const res = m.daily !== undefined ? await this.battles.startDaily(players[0]!, m.daily.dayKey) : await this.battles.startArena({
      kind: m.kind,
      level: m.level,
      players,
      ...(this.cup !== null ? { cup: this.cup } : {}),
      ...(m.training !== undefined ? { training: { difficulty: m.training.difficulty, seed: `${m.matchId}:foe` } } : {}),
    });
    this.starting = false;
    if (!res.ok) {
      this.cancel(res.detail === 'party' || res.detail === 'cup' ? res.detail : 'cancelled', null);
      return;
    }
    // a seat left while the start transaction ran: the battle is already open, so that player forfeits
    for (const p of m.players) if (this.clientOf(p.playerId) === undefined) void this.battles.forfeitIfActive(p.playerId, 'disconnect');
  }

  /** The match is off: `arenaState cancelled` here, `arenaStatus idle / cancelled` to a player who never arrived. */
  private cancel(reason: string, byPlayerId: string | null): void {
    if (this.phase !== 'waiting') return;
    this.setPhase('cancelled', reason);
    this.broadcastState();
    for (const p of this.match.players) {
      if (p.playerId === byPlayerId || this.clientOf(p.playerId) !== undefined) continue;
      this.deps.arena.notify(p.playerId, statusMsg(idleStatus('cancelled')));
    }
    this.lock().catch(() => undefined);
  }

  private tick(): void {
    const now = this.deps.clock();
    this.battles.tick(now).catch((e: unknown) => this.deps.log.error({ err: e }, 'arena battles.tick failed'));
    if (this.phase === 'waiting' && !this.starting && now >= this.match.createdAt + ARENA_ARRIVAL_MS) this.cancel('noShow', null);
  }

  // ─── spectator mode ─────────────────────────────────────────────────────────

  /** A queued two-player match goes on the live board (Finals looked up once; nothing is published before that). */
  private startLive(session: BattleSession): void {
    const m = this.match;
    if (!LIVE_KINDS.has(m.kind) || m.players.length !== 2 || session.format !== 'pvp') return;
    const deps = this.deps;
    const now = deps.clock();
    const live = { session, startedAt: now, finals: false, ready: false, shared: -1 };
    this.live = live;
    void (async () => {
      if (m.kind === 'ranked' && finalsWeek(now)) {
        const season = seasonAt(now);
        const top = await deps.repos.db.transaction((tx) => deps.repos.seasons.current(tx, season.startsAt, now, SEASON_FINALISTS)).catch(() => []);
        const names = new Set(top.map((r) => r.player.username));
        live.finals = m.players.every((p) => names.has(p.name));
      }
      live.ready = true;
      if (this.live === live) this.publishLive(false);
    })();
  }

  /** The feed now: every turn when `final`, else all but the last LIVE_DELAY_TURNS; null when there is nothing new. */
  private liveFeed(final: boolean, outcome: BattleOutcome | null): LiveFeed | null {
    const live = this.live;
    if (live === null || (!final && !live.ready)) return null;
    const s = live.session;
    const all = s.actionsLog as unknown as readonly (readonly [SideChoice, SideChoice])[];
    const count = final ? all.length : Math.max(0, all.length - LIVE_DELAY_TURNS);
    if (!final && count === live.shared) return null;
    live.shared = count;
    const actions = all.slice(0, count);
    const start = anonymiseStart(s.start);
    const run = replayBattle(replayOpts(REPLAY_BATTLE_ID, 'pvp', s.seed, start), actions, this.deps.content);
    const m = this.match;
    const p0 = m.players[0]!;
    const p1 = m.players[1]!;
    return {
      matchId: m.matchId,
      kind: m.kind as LiveFeed['kind'],
      finals: live.finals,
      players: [
        { name: p0.name, rating: p0.rating },
        { name: p1.name, rating: p1.rating },
      ],
      turn: count,
      startedAt: live.startedAt,
      updatedAt: this.deps.clock(),
      replay: { format: 'pvp', seat: 0, labels: [p0.name, p1.name], seed: s.seed, start, actions, digest: run.finalDigest },
      outcome,
    };
  }

  private publishLive(final: boolean, outcome: BattleOutcome | null = null): void {
    let feed: LiveFeed | null = null;
    try {
      feed = this.liveFeed(final, outcome);
    } catch (e) {
      this.deps.log.warn({ err: e, matchId: this.match.matchId }, 'live feed failed');
    }
    if (feed === null) return;
    const board = this.deps.live;
    void (final ? board.finish(feed) : board.publish(feed)).catch((e: unknown) => this.deps.log.warn({ err: e }, 'live board write failed'));
  }

  /** The battle is over: the whole fight with its outcome; a voided battle just leaves the board. */
  private endLive(outcome: BattleOutcome | 'void' | 'playerLeft'): void {
    if (this.live === null) return;
    if (outcome === 'void' || outcome === 'playerLeft') void this.deps.live.drop(this.match.matchId).catch(() => undefined);
    else this.publishLive(true, outcome);
    this.live = null;
  }

  // ─── battle host ────────────────────────────────────────────────────────────

  private battleHost(): BattleHost {
    return {
      send: (playerId, msg) => {
        this.sendTo(playerId, msg);
        if (msg.type === 'battleEvents') this.publishLive(false);
      },
      onStart: (session) => this.onBattleStart(session),
      onEnd: (session, outcome) => this.onBattleEnd(session, outcome),
      // arena battles write no flags, badges or items: nothing to refresh
      onProgress: () => undefined,
    };
  }

  private onBattleStart(session: BattleSession): void {
    const deps = this.deps;
    this.battleId = session.id;
    this.setPhase('fighting');
    for (const seat of session.seats) {
      if (seat.playerId === null) continue;
      deps.presenceMirror.setBattle(seat.playerId, session.id);
      // the arena battle takes the player out of any arena queue and the in-world ranked queue (and resets the PvP
      // screen's queue state)
      void deps.arena.queue.leave(seat.playerId).catch(() => undefined);
      void deps.matchQueue.leave(seat.playerId).catch(() => undefined);
      deps.arena.notify(seat.playerId, statusMsg(idleStatus('started')));
    }
    this.broadcastState();
    this.startLive(session);
  }

  private onBattleEnd(session: BattleSession, outcome: BattleOutcome | 'void' | 'playerLeft'): void {
    const deps = this.deps;
    this.endLive(outcome);
    for (const seat of session.seats) if (seat.playerId !== null && deps.presenceStore.battleOf(seat.playerId) === session.id) deps.presenceMirror.setBattle(seat.playerId, null);
    this.battleId = null;
    this.setPhase('ended');
    this.broadcastState();
    this.lock().catch(() => undefined);
  }
}

/** An ArenaRoom class bound to one process's dependencies. */
export function bindArenaRoom(deps: RoomDeps): typeof ArenaRoom {
  class BoundArenaRoom extends ArenaRoom {}
  BoundArenaRoom.roomDeps = deps;
  return BoundArenaRoom;
}

/** R2 for the arena: Colyseus' own `/matchmake/*` routes are refused without the server's join ticket (see ZoneRoom). */
export function refuseDirectArenaMatchmaking(klass: typeof ArenaRoom, ticket: string): void {
  klass.onAuth = async (_token: string, options: ArenaJoinOptions | undefined): Promise<true> => {
    if (options?.ticket !== ticket) throw new ServerError(403, 'noTicket');
    return true;
  };
}
