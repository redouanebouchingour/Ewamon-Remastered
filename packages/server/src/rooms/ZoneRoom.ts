/**
 * §30.2 ZoneRoom — one room type; battles, raids and trades are sub-states. Tick, movement, AOI, handover,
 * sharding. Lifecycle and tick follow the spec's verbatim order; every deviation forced by the installed
 * Colyseus 0.18.14 is marked `R<n>` and listed in IMPLEMENTATION-NOTES.md.
 */
import { Room, ServerError } from '@colyseus/core';
import type { AuthContext, Client } from '@colyseus/core';
import { StateView } from '@colyseus/schema';
import { badgeFlag, encounterTableFor, getHeightfield, isWalkable, isWater, league as leagueById, nearestWalkable, playableBounds, zone as zoneById } from '@ewa/content';
import type { BadgeId, Heightfield, LinkDir, RaidHotspot, ZoneDef, ZoneId } from '@ewa/content';
import { createRng } from '@ewa/core';
import type { Rng } from '@ewa/core';
import { BattleSummary, CLIENT_MESSAGES, CLOSE_CODES, PlayerState, RaidState, SpawnState, ZoneState } from '@ewa/protocol';
import type { ClientMessageType, ClientPayload, ServerMessage } from '@ewa/protocol';
import type { RoomDeps } from '../deps';
import { censor, sanitizeChat } from '../chat/filter';
import { LOG_EVERY_MS, createRoomMetrics, recordTick, roomLogLine, rollRoomMetrics } from '../metrics';
import type { RoomMetrics } from '../metrics';
import { LIMITS, allow, createLimiterState, shouldNotify } from '../rest/rateLimit';
import type { LimitKey, RateLimiterState } from '../rest/rateLimit';
import { AoiGrid, cellOf } from './aoi';
import type { Cell } from './aoi';
import { BattleCoordinator, TERRAIN_BY_BIOME, progressionOnly } from './battleSession';
import type { BattleHost, BattleSession } from './battleSession';
import { ChallengeStore } from './challengeStore';
import { findTarget, itemFlag, rangeFor, trainerBeatenFlag } from './interactables';
import { pickZoneRoom, reserveZoneSeat } from './matchmaking';
import { SURF_ITEM, refillBudget, validateInput } from './movement';
import type { RejectReason } from './movement';
import { SpawnDirector, tuningFor } from './spawnDirector';
import type { SpawnRecord } from './spawnDirector';
import { beatFor, completeBeatInTx, flagSet, isStoryTrainer, storyTrainerBeat } from './storyBeats';
import { RAID_JOIN_RANGE_M, RaidRunner, RaidSession } from './raidSession';
import { TradeCoordinator } from './tradeSession';
import { advanceQuests } from '../game/quests';
import { STREAK_LAST_PREFIX, dailyLogin } from '../liveops/login';
import { dayKey, hotspotDayKey, hotspotOpen, hotspotsFor, liveOpsModsFor } from '../liveops/schedule';

export interface ZoneMeta {
  readonly zoneId: ZoneId;
  /** shard 0.. */
  readonly shard: number;
}

export interface ZoneJoinOptions {
  readonly zoneId: ZoneId;
  readonly shard?: number;
  /** server-only join ticket (R2) */
  readonly ticket?: string;
  readonly handover?: { readonly fromRoomId: string; readonly x: number; readonly z: number };
}

export interface ZoneAuth {
  readonly playerId: string;
  readonly username: string;
  readonly isAdmin: boolean;
  /** socket IP, for the per-IP socket count (§30.1.1 beforeUpgrade) */
  readonly ip: string | null;
}

export interface HandoverPending {
  readonly toRoomId: string;
  readonly sentAt: number;
}

export interface ZoneUserData {
  readonly playerId: string;
  /** last AOI cell; null before first tick */
  cell: Cell | null;
  /** last accepted input seq */
  lastSeq: number;
  /** §30.2.4 dt budget */
  budgetMs: number;
  /** clock ms */
  lastInputAt: number;
  battleId: string | null;
  tradeId: string | null;
  /** per-message sliding windows (§30.6.4) */
  limiter: RateLimiterState;
  // ---- additions (IMPLEMENTATION-NOTES R4) ----
  /** story_flags ∪ badge:<id>, cached at join, refreshed by every progressionDelta this room sends */
  flags: Set<string>;
  badges: BadgeId[];
  /** absolute item counts (HM Surf walkability) */
  inventory: Record<string, number>;
  /** source side of a crossing in progress (§30.2.7 step 5) */
  handover: HandoverPending | 'reserving' | null;
  /** destination side: validated reservation awaiting `handoverAck` */
  arrival: { readonly fromRoomId: string; readonly x: number; readonly z: number } | null;
  /** no handover triggers before this time (fresh arrivals stand 6.5 m inside the edge) */
  handoverCooldownUntil: number;
  /** a newer socket took over this player (4001): leave must not remove the avatar */
  replaced: boolean;
  /** the avatar left through a completed handover: no position write */
  handoverDone: boolean;
  /** an accepted move since the last AOI pass */
  moved: boolean;
  /** movement rejection timestamps (30 in 10 s → 4003) */
  rejects: number[];
  /** unknown message type timestamps (5 in 10 s → 4003) */
  unknown: number[];
  /** §30.6.3 repel / lure: metres left (decremented by accepted movement); repel refuses weaker wild spawns */
  repel: { readonly kind: 'repel' | 'lure'; steps: number } | null;
}

export type ZoneClient = Client<{ userData: ZoneUserData; auth: ZoneAuth }>;

/** `ewa:dm:<toId>` payload published by `POST /messages/:username` (§30.7.2). */
export interface DmPush {
  readonly id: number;
  readonly fromId: string;
  readonly fromName: string;
  readonly text: string;
  readonly sentAt: number;
}

/** @colyseus/shared-types Protocol.ROOM_STATE_PATCH — the first byte of a schema patch frame */
export const ROOM_STATE_PATCH = 15;
export const MOVE_KICK = { max: 30, windowMs: 10_000 } as const;
export const UNKNOWN_KICK = { max: 5, windowMs: 10_000 } as const;
export const HANDOVER_TRIGGER_M = 6;
export const HANDOVER_ENTRY_M = 6.5;
export const HANDOVER_TIMEOUT_MS = 5_000;
export const HANDOVER_COOLDOWN_MS = 3_000;
export const PUSHBACK_M = 1.0;
export const EMOTE_MS = 2_000;
/** S8: `PlayerState.moving` is cleared this long after the last accepted input. */
export const IDLE_MS = 250;
export const RECONNECT_S = 20;
export const CHALLENGE_RANGE_M = 12;

/** Link direction → unit vector (R6: n = −z, s = +z, e = +x, w = −x). */
export const LINK_VECTORS: Readonly<Record<LinkDir, readonly [number, number]>> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const OPPOSITE: Readonly<Record<LinkDir, LinkDir>> = { n: 's', s: 'n', e: 'w', w: 'e' };

/** Trigger check for a position against the playable bounds (R7: the trigger line is 6 m inside the PLAYABLE edge). */
export function crossedLink(zone: ZoneDef, h: Heightfield, x: number, z: number): LinkDir | null {
  const b = playableBounds(h);
  for (const d of ['n', 'e', 's', 'w'] as const) {
    if (zone.links[d] === undefined) continue;
    if (d === 'e' && x >= b.maxX - HANDOVER_TRIGGER_M) return d;
    if (d === 'w' && x <= b.minX + HANDOVER_TRIGGER_M) return d;
    if (d === 's' && z >= b.maxZ - HANDOVER_TRIGGER_M) return d;
    if (d === 'n' && z <= b.minZ + HANDOVER_TRIGGER_M) return d;
  }
  return null;
}

/** Entry point on the destination's opposite edge: same lateral coordinate, 6.5 m inside, snapped. */
export function entryPoint(dest: ZoneDef, dir: LinkDir, x: number, z: number): { x: number; z: number } {
  const h = getHeightfield(dest.id);
  const b = playableBounds(h);
  const entry = OPPOSITE[dir];
  let ex = Math.min(b.maxX - HANDOVER_ENTRY_M - 1, Math.max(b.minX + HANDOVER_ENTRY_M + 1, x));
  let ez = Math.min(b.maxZ - HANDOVER_ENTRY_M - 1, Math.max(b.minZ + HANDOVER_ENTRY_M + 1, z));
  if (entry === 'w') ex = b.minX + HANDOVER_ENTRY_M;
  if (entry === 'e') ex = b.maxX - HANDOVER_ENTRY_M;
  if (entry === 'n') ez = b.minZ + HANDOVER_ENTRY_M;
  if (entry === 's') ez = b.maxZ - HANDOVER_ENTRY_M;
  if (isWalkable(h, ex, ez)) return { x: ex, z: ez };
  const snapped = nearestWalkable(h, ex, ez, 8) ?? nearestWalkable(h, dest.spawn.x, dest.spawn.z, 8);
  return snapped === null ? { x: dest.spawn.x, z: dest.spawn.z } : { x: snapped[0], z: snapped[1] };
}

function roomLimitKey(type: ClientMessageType): LimitKey {
  if (type in LIMITS) return type as LimitKey;
  if (type.startsWith('raid')) return 'raid';
  return 'roomOther';
}

export class ZoneRoom extends Room<{ state: ZoneState; metadata: ZoneMeta; client: ZoneClient }> {
  static readonly TICK_MS = 50; // 20 Hz
  static readonly PATCH_MS = 50; // one schema patch per tick
  static readonly DAY_LENGTH_MS = 48 * 60_000;

  /** Bound by `bindZoneRoom(deps)` (Colyseus constructs rooms with no arguments). */
  static roomDeps: RoomDeps | null = null;

  zone!: ZoneDef;
  heightfield!: Heightfield;
  aoi!: AoiGrid<PlayerState | SpawnState>;
  spawns: SpawnDirector | null = null;
  battles!: BattleCoordinator;
  trades!: TradeCoordinator;
  /** §30.4.7: one raid per zone room at a time, opened by the hotspot scheduler */
  raid: RaidRunner | null = null;
  challenges!: ChallengeStore;
  worldRng!: Rng;
  metrics!: RoomMetrics;

  private readonly spawnStates = new Map<string, SpawnState>();
  private readonly emoteSetAt = new Map<string, number>();
  /** player uuid → the sessionId that owns the PlayerState (multi-tab / reconnection guard) */
  private readonly owner = new Map<string, string>();
  private overruns = 0;
  private nextLogAt = 0;
  /** per-client traffic (sessionId → schema patch frames / bytes, message frames) — the harness reads it (§30.10.3) */
  readonly traffic = new Map<string, { patchFrames: number; patchBytes: number; msgFrames: number }>();
  /** presence subscriptions held by this room, released in onDispose */
  private readonly subs: [string, (m: never) => void][] = [];
  /** `${hotspotId}:${dayKey}` windows this room already opened (or yielded) — a window opens at most once */
  private readonly raidWindows = new Set<string>();
  private raidCheckAt = 0;
  /** player uuid → its `ewa:dm:<id>` callback (§30.7.2: DMs pushed live while the player is in this room) */
  private readonly dmSubs = new Map<string, (m: DmPush) => void>();

  protected get deps(): RoomDeps {
    const d = (this.constructor as typeof ZoneRoom).roomDeps;
    if (d === null) throw new Error('ZoneRoom used without bindZoneRoom(deps)');
    return d;
  }

  private now(): number {
    return this.deps.clock();
  }

  // ─── lifecycle ──────────────────────────────────────────────────────────────

  override async onCreate(options: ZoneJoinOptions): Promise<void> {
    const deps = this.deps;
    // R2: only the server creates shards
    if (options?.ticket !== deps.ticket) throw new ServerError(403, 'noTicket');
    // 1. unknown id → throws (room creation fails)
    this.zone = zoneById(options.zoneId);
    const shard = options.shard ?? 0;
    // 2. content's memoised heightfield
    this.heightfield = getHeightfield(options.zoneId);
    // 3.
    this.maxClients = deps.env.ZONE_CAPACITY;
    this.patchRate = ZoneRoom.PATCH_MS;
    this.autoDispose = true;
    await this.setMetadata({ zoneId: options.zoneId, shard });
    // 4.
    const state = new ZoneState();
    state.harvestState = this.zone.harvestState;
    state.timeOfDay = (this.now() % ZoneRoom.DAY_LENGTH_MS) / ZoneRoom.DAY_LENGTH_MS;
    this.state = state;
    this.metrics = createRoomMetrics(this.roomId, this.zone.id, shard);
    deps.metrics.register(this.metrics);
    this.aoi = new AoiGrid();
    this.challenges = new ChallengeStore();
    // 5. seed
    const root = createRng(`${deps.worldSeed}:${options.zoneId}:${shard}:${this.now()}`);
    this.worldRng = root;
    const tuning = tuningFor(this.zone);
    const table = encounterTableFor(this.zone.id);
    const spawnRng = root.fork();
    this.spawns = tuning === null ? null : new SpawnDirector(this.zone, table, spawnRng, this.heightfield, tuning, deps.content);
    // §30.9.2: weekday variant, seasonal events, swarms — re-derived on every `ewa:liveops` rollover
    this.spawns?.setLiveOps(liveOpsModsFor(this.zone.id, this.now()));
    this.battles = new BattleCoordinator(root.fork(), {
      repos: deps.repos,
      content: deps.content,
      clock: deps.clock,
      log: deps.log.child({ roomId: this.roomId, zoneId: this.zone.id, shard }),
      zone: this.zone,
      host: this.battleHost(),
      metrics: this.metrics,
    });
    this.trades = new TradeCoordinator({
      repos: deps.repos,
      clock: deps.clock,
      log: deps.log.child({ roomId: this.roomId, zoneId: this.zone.id, shard }),
      host: {
        send: (playerId, msg) => this.sendTo(playerId, msg),
        setTrade: (playerId, tradeId) => {
          const c = this.clientOf(playerId);
          if (c?.userData !== undefined) c.userData.tradeId = tradeId;
          deps.presenceMirror.setTrade(playerId, tradeId);
        },
        eligible: (fromId, toId) => this.challengeable(fromId, toId, true),
        tradeOf: (playerId) => this.clientOf(playerId)?.userData?.tradeId ?? null,
      },
    });
    // 6. messages (R1: zod safeParse in the wrapper; R3: '*' counts unknown types)
    for (const type of Object.keys(CLIENT_MESSAGES) as ClientMessageType[]) {
      this.onMessage(type, (client: ZoneClient, payload: unknown) => this.dispatch(client, type, payload));
    }
    this.onMessage('*', (client: ZoneClient) => this.onUnknownMessage(client));
    // cross-room channels (unsubscribed in onDispose)
    await this.sub('ewa:kick', (m: { playerId: string; exceptRoomId?: string }) => this.onKick(m));
    await this.sub(`ewa:handover:done:${this.roomId}`, (m: { playerId: string }) => this.onHandoverDone(m.playerId));
    await this.sub('ewa:profile', (m: { playerId: string }) => void this.onProfile(m.playerId));
    await this.sub('ewa:liveops', () => this.spawns?.setLiveOps(liveOpsModsFor(this.zone.id, this.now())));
    await this.sub('ewa:repel', (m: { playerId: string; kind: 'repel' | 'lure'; steps: number }) => {
      const c = this.clientOf(m.playerId);
      if (c?.userData !== undefined) c.userData.repel = { kind: m.kind, steps: m.steps };
    });
    await this.sub('ewa:teleport', (m: { playerId: string }) => this.onTeleport(m.playerId));
    // 7.
    this.setTimestep((dt) => this.tick(dt), ZoneRoom.TICK_MS);
  }

  override async onAuth(_client: Client, options: ZoneJoinOptions, context: AuthContext): Promise<ZoneAuth> {
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
    const row = await deps.repos.db.transaction(async (tx) => {
      const player = await deps.repos.players.byId(tx, claims.sub);
      const badges = player === null ? [] : await deps.repos.progress.badges(tx, claims.sub);
      return player === null ? null : { player, badges };
    });
    if (row === null || row.player.bannedAt !== null || deps.bans.isBanned(claims.sub)) throw new ServerError(401, 'banned');
    if (this.zone.gate !== null && !row.badges.includes(this.zone.gate)) throw new ServerError(401, 'gated');
    return { playerId: claims.sub, username: row.player.username, isAdmin: row.player.isAdmin, ip: context.ip ?? null };
  }

  override async onJoin(client: ZoneClient, options: ZoneJoinOptions, auth: ZoneAuth): Promise<void> {
    const deps = this.deps;
    const { playerId, username } = auth;
    // 1. rows
    const loaded = await deps.repos.db.transaction(async (tx) => {
      const player = await deps.repos.players.byId(tx, playerId);
      const party = await deps.repos.creatures.party(tx, playerId);
      const badges = await deps.repos.progress.badges(tx, playerId);
      const flags = await deps.repos.progress.flags(tx, playerId);
      const inventory = await deps.repos.inventory.all(tx, playerId);
      const guild = await deps.repos.social.guildOf(tx, playerId);
      return { player, party, badges, flags, inventory, guildTag: guild?.tag ?? null };
    });
    if (loaded.player === null) throw new ServerError(401, 'noPlayer');
    if (loaded.party.length === 0) throw new ServerError(409, 'noParty');
    const row = loaded.player;

    // §30.2.7 destination: the handover option must match a presence reservation
    let arrival: ZoneUserData['arrival'] = null;
    if (options.handover !== undefined) {
      const raw = await this.presence.get(`ewa:handover:${playerId}`);
      const res = typeof raw === 'string' ? (JSON.parse(raw) as { fromRoomId: string; toRoomId: string; sessionId: string; x: number; z: number }) : null;
      if (res === null || res.toRoomId !== this.roomId || res.fromRoomId !== options.handover.fromRoomId || res.sessionId !== client.sessionId) {
        throw new ServerError(403, 'badHandover');
      }
      arrival = { fromRoomId: res.fromRoomId, x: res.x, z: res.z };
    }

    // 2. multi-tab collapse: the older client in this room is replaced
    const existing = this.state.players.get(playerId);
    for (const other of this.clients) {
      if (other === client || other.userData?.playerId !== playerId) continue;
      other.userData.replaced = true;
      this.sendMsg(other, { type: 'error', code: 'busy', detail: 'replaced' });
      other.leave(CLOSE_CODES.replaced);
    }
    // across rooms: one avatar per player, everywhere (a valid handover keeps the source for ≤ 5 s)
    const liveBattle = this.battles.ofPlayer(playerId);
    const prev = deps.presenceMirror.enter(playerId, {
      roomId: this.roomId,
      zoneId: this.zone.id,
      shard: this.metadata.shard,
      battleId: liveBattle?.id ?? null,
      tradeId: null,
      since: this.now(),
    });
    if (prev !== null && arrival === null) this.presence.publish('ewa:kick', { playerId, exceptRoomId: this.roomId });
    if (auth.ip !== null) deps.presenceStore.ipEnter(auth.ip);
    this.subscribePlayer(playerId);

    // 3. position
    let x: number;
    let z: number;
    let fallback = false;
    if (existing !== undefined) {
      x = existing.x;
      z = existing.z;
    } else if (arrival !== null) {
      x = arrival.x;
      z = arrival.z;
    } else if (row.zoneId === this.zone.id) {
      x = row.x;
      z = row.z;
    } else {
      x = this.zone.spawn.x;
      z = this.zone.spawn.z;
      fallback = true;
    }
    if (!isWalkable(this.heightfield, x, z)) {
      const snapped = nearestWalkable(this.heightfield, x, z, 8) ?? nearestWalkable(this.heightfield, this.zone.spawn.x, this.zone.spawn.z, 8);
      x = snapped?.[0] ?? this.zone.spawn.x;
      z = snapped?.[1] ?? this.zone.spawn.z;
      fallback = true;
    }

    // 4. PlayerState (reused on takeover)
    const ps = existing ?? new PlayerState();
    if (existing === undefined) {
      ps.id = playerId;
      ps.name = username;
      ps.x = x;
      ps.z = z;
      ps.angle = row.zoneId === this.zone.id ? row.angle : 0;
      ps.body = row.body;
      ps.guildTag = loaded.guildTag ?? '';
      this.state.players.set(playerId, ps);
    }
    this.owner.set(playerId, client.sessionId);

    this.meterClient(client);
    // 5. view + userData; the first tick computes the cell and adds the 3×3
    client.view = new StateView();
    client.view.add(ps);
    client.userData = {
      playerId,
      cell: null,
      lastSeq: existing?.seq ?? 0,
      budgetMs: 0,
      lastInputAt: this.now(),
      battleId: this.battles.ofPlayer(playerId)?.id ?? null,
      tradeId: null,
      limiter: createLimiterState(),
      flags: flagSet(loaded.flags, loaded.badges),
      badges: loaded.badges,
      inventory: loaded.inventory,
      handover: null,
      arrival,
      handoverCooldownUntil: arrival !== null ? this.now() + HANDOVER_COOLDOWN_MS : 0,
      replaced: false,
      handoverDone: false,
      moved: true,
      rejects: [],
      unknown: [],
      repel: null,
    };
    // R11: the join's AOI pass runs here, not on the first tick, so a chat/interact sent right after joining
    // already has a cell and an audience (a takeover client re-registers the viewer from scratch)
    if (existing !== undefined) this.aoi.removeViewer(playerId);
    const cell = cellOf(ps.x, ps.z);
    const { show } = this.aoi.moveViewer(playerId, null, cell);
    for (const e of show) client.view.add(e);
    client.userData.cell = cell;
    const { entered } = this.aoi.place(ps);
    for (const v of entered) this.clientOf(v)?.view?.add(ps);
    this.metrics.aoiAdds += show.length + entered.length;
    this.metrics.players = this.state.players.size;

    // §30.9.1: the first room join of a UTC day grants the daily login (once per day, shared with POST /auth/login);
    // the flag cache loaded above already says whether today's grant happened, so a same-day join costs nothing
    if (!client.userData.flags.has(`${STREAK_LAST_PREFIX}${dayKey(this.now())}`)) void this.grantDailyLogin(client, playerId);

    // P3: a reload mid-battle rejoins this room; the client gets the live battle back without asking
    const live = this.battles.ofPlayer(playerId);
    if (live !== null) {
      const resync = this.battles.resync(playerId, live.id);
      if (resync !== null) this.sendMsg(client, resync);
    }

    // 7. position write only for the fallback branches (handover writes are the ack's job)
    if (fallback && arrival === null) {
      await deps.repos.db.transaction((tx) => deps.repos.players.setPosition(tx, playerId, this.zone.id, x, z, ps.angle));
    }
  }

  override onDrop(client: ZoneClient, code?: number): void {
    const ud = client.userData;
    if (ud === undefined || ud.replaced || ud.handoverDone || code === CLOSE_CODES.replaced || code === CLOSE_CODES.handoverComplete || code === CLOSE_CODES.kicked) return;
    // 2. keep the avatar for 20 s; Colyseus calls onLeave when the reconnection fails
    this.allowReconnection(client, RECONNECT_S).catch(() => undefined);
  }

  override async onLeave(client: ZoneClient, _code?: number): Promise<void> {
    this.traffic.delete(client.sessionId);
    const ud = client.userData;
    if (ud === undefined) return;
    const deps = this.deps;
    if (client.auth?.ip != null) deps.presenceStore.ipLeave(client.auth.ip);
    // a newer socket owns the avatar: drop only this client's view
    if (ud.replaced || this.owner.get(ud.playerId) !== client.sessionId) {
      client.view?.dispose();
      return;
    }
    await this.removePlayer(client);
  }

  /** §30.2.2 step 3 — remove. */
  private async removePlayer(client: ZoneClient): Promise<void> {
    const deps = this.deps;
    const ud = client.userData!;
    const playerId = ud.playerId;
    const ps = this.state.players.get(playerId);
    await this.battles.forfeitIfActive(playerId, 'disconnect').catch((e: unknown) => deps.log.error({ err: e }, 'forfeitIfActive failed'));
    this.trades.cancelFor(playerId);
    this.raid?.leave(playerId);
    for (const c of this.challenges.dropFor(playerId)) {
      const otherId = c.fromId === playerId ? c.toId : c.fromId;
      const other = this.clientOf(otherId);
      if (other !== undefined) this.sendMsg(other, { type: 'challengeResult', targetId: c.fromId === otherId ? c.toId : c.fromId, result: 'unavailable' });
    }
    if (ps !== undefined) {
      for (const viewerId of this.aoi.removeEntity(ps)) this.clientOf(viewerId)?.view?.remove(ps);
      this.aoi.removeViewer(playerId);
      this.state.players.delete(playerId);
    }
    this.owner.delete(playerId);
    this.emoteSetAt.delete(playerId);
    client.view?.dispose();
    deps.presenceMirror.leave(playerId, this.roomId);
    this.unsubscribePlayer(playerId);
    this.metrics.players = this.state.players.size;
    // one position write with the last authoritative pose — unless a handover moved the row's owner
    const movedAway = ud.handoverDone || (ud.handover !== null && deps.presenceStore.get(playerId)?.roomId !== this.roomId);
    if (ps !== undefined && !movedAway) {
      await deps.repos.db
        .transaction((tx) => deps.repos.players.setPosition(tx, playerId, this.zone.id, ps.x, ps.z, ps.angle))
        .catch((e: unknown) => deps.log.error({ err: e, playerId }, 'leave position write failed'));
    }
  }

  override onDispose(): void {
    this.spawns?.dispose();
    this.battles?.dispose();
    this.trades?.dispose();
    this.raid = null;
    this.clock.clear();
    for (const [topic, cb] of this.subs) this.presence.unsubscribe(topic, cb);
    this.subs.length = 0;
    for (const id of [...this.dmSubs.keys()]) this.unsubscribePlayer(id);
    if (this.metrics !== undefined) this.deps.metrics.unregister(this.roomId);
  }

  // ─── metering (§30.10.2) ─────────────────────────────────────────────────────

  /**
   * Wraps the client's raw send: a frame whose protocol code (first byte & 0x1f, modifier bits masked) is
   * Protocol.ROOM_STATE_PATCH (15) is a schema patch
   * (counted with its byte length), anything else a message frame. Patch bytes are exactly what went on the wire.
   */
  private meterClient(client: ZoneClient): void {
    const t = { patchFrames: 0, patchBytes: 0, msgFrames: 0 };
    this.traffic.set(client.sessionId, t);
    const m = this.metrics;
    const raw = client.raw.bind(client);
    client.raw = ((data: Uint8Array | Buffer, ...rest: unknown[]) => {
      if (data !== undefined && data.length > 0 && (data[0]! & 0x1f) === ROOM_STATE_PATCH) {
        t.patchFrames++;
        t.patchBytes += data.length;
        m.patchFrames++;
        m.patchBytes += data.length;
      } else {
        t.msgFrames++;
      }
      return (raw as (...a: unknown[]) => unknown)(data, ...rest);
    }) as typeof client.raw;
  }

  // ─── presence channels ──────────────────────────────────────────────────────

  private async sub<T>(topic: string, cb: (m: T) => void): Promise<void> {
    this.subs.push([topic, cb as (m: never) => void]);
    await this.presence.subscribe(topic, cb);
  }

  private subscribePlayer(playerId: string): void {
    if (this.dmSubs.has(playerId)) return;
    const cb = (m: DmPush): void => this.sendTo(playerId, { type: 'dm', id: m.id, fromId: m.fromId, fromName: m.fromName, text: m.text, sentAt: m.sentAt });
    this.dmSubs.set(playerId, cb);
    void this.presence.subscribe(`ewa:dm:${playerId}`, cb);
  }

  private unsubscribePlayer(playerId: string): void {
    const cb = this.dmSubs.get(playerId);
    if (cb === undefined) return;
    this.dmSubs.delete(playerId);
    this.presence.unsubscribe(`ewa:dm:${playerId}`, cb);
  }

  private async grantDailyLogin(client: ZoneClient, playerId: string): Promise<void> {
    const deps = this.deps;
    const g = await deps.repos.db.transaction((tx) => dailyLogin(tx, deps.repos, playerId, this.now())).catch((e: unknown) => {
      deps.log.warn({ err: e, playerId }, 'daily login grant failed');
      return null;
    });
    if (g === null || client.userData === undefined) return;
    for (const [item, qty] of Object.entries(g.inventory)) client.userData.inventory[item] = qty;
    this.applyFlags(client.userData, g.flags);
    this.sendMsg(client, { type: 'inventoryDelta', items: { ...g.inventory }, money: g.money, creaturesAdded: [], creaturesRemoved: [], creaturesUpdated: [] });
    this.sendMsg(client, progressionOnly({ trainerExp: g.trainerExp, trainerLevel: g.trainerLevel, flags: [...g.flags] }));
    this.sendMsg(client, { type: 'toast', level: 'success', text: `Daily login — day ${g.streak} streak` });
  }

  private async leadLevel(playerId: string): Promise<number> {
    const deps = this.deps;
    const party = await deps.repos.db.transaction((tx) => deps.repos.creatures.party(tx, playerId));
    return party.find((c) => c.hp > 0)?.level ?? 0;
  }

  /** §30.6.3 escape rope: authoritative teleport to the zone's spawn point (snapped), not during a battle. */
  private onTeleport(playerId: string): void {
    const c = this.clientOf(playerId);
    const ps = this.state.players.get(playerId);
    if (c?.userData === undefined || ps === undefined || c.userData.battleId !== null) return;
    const p = isWalkable(this.heightfield, this.zone.spawn.x, this.zone.spawn.z) ? ([this.zone.spawn.x, this.zone.spawn.z] as const) : nearestWalkable(this.heightfield, this.zone.spawn.x, this.zone.spawn.z, 8);
    if (p === null) return;
    ps.x = p[0];
    ps.z = p[1];
    ps.moving = false;
    c.userData.moved = true;
    c.userData.handoverCooldownUntil = this.now() + HANDOVER_COOLDOWN_MS;
  }

  /** §30.5 `PlayerState.body/guildTag` re-read after POST /profile or any guild change (`ewa:profile`). */
  private async onProfile(playerId: string): Promise<void> {
    const ps = this.state.players.get(playerId);
    if (ps === undefined) return;
    const deps = this.deps;
    const r = await deps.repos.db
      .transaction(async (tx) => ({ row: await deps.repos.players.byId(tx, playerId), guild: await deps.repos.social.guildOf(tx, playerId) }))
      .catch(() => null);
    if (r?.row == null) return;
    ps.body = r.row.body;
    ps.guildTag = r.guild?.tag ?? '';
  }

  // ─── messaging ──────────────────────────────────────────────────────────────

  sendMsg(client: ZoneClient, msg: ServerMessage): void {
    this.metrics.msgsOut += 1;
    client.send(msg.type as never, msg as never);
  }

  private sendTo(playerId: string, msg: ServerMessage): void {
    const c = this.clientOf(playerId);
    if (c !== undefined) this.sendMsg(c, msg);
  }

  clientOf(playerId: string): ZoneClient | undefined {
    const sid = this.owner.get(playerId);
    if (sid !== undefined) {
      const c = this.clients.getById(sid);
      if (c !== undefined && c.userData !== undefined && !c.userData.replaced) return c;
    }
    return this.clients.find((c) => c.userData?.playerId === playerId && !c.userData.replaced);
  }

  private onUnknownMessage(client: ZoneClient): void {
    this.metrics.unknownMessages += 1;
    const ud = client.userData;
    if (ud === undefined) return;
    const now = this.now();
    ud.unknown = ud.unknown.filter((t) => now - t < UNKNOWN_KICK.windowMs);
    ud.unknown.push(now);
    if (ud.unknown.length >= UNKNOWN_KICK.max) this.kick(client, 'unknownMessages');
  }

  private kick(client: ZoneClient, reason: string): void {
    this.metrics.kicks += 1;
    this.deps.log.warn({ playerId: client.userData?.playerId, reason }, 'client kicked');
    client.leave(CLOSE_CODES.kicked);
  }

  private dispatch(client: ZoneClient, type: ClientMessageType, payload: unknown): void {
    const ud = client.userData;
    if (ud === undefined || ud.replaced) return;
    this.metrics.msgsIn += 1;
    const now = this.now();
    const key = roomLimitKey(type);
    if (!allow(ud.limiter, key, now)) {
      if (shouldNotify(ud.limiter, key, now)) this.sendMsg(client, { type: 'error', code: 'rateLimited', detail: type });
      return;
    }
    const parsed = CLIENT_MESSAGES[type].safeParse(payload);
    if (!parsed.success) {
      this.sendMsg(client, { type: 'error', code: 'invalidPayload', detail: type });
      return;
    }
    const data = parsed.data as never;
    const run = (): void | Promise<void> => {
      switch (type) {
        case 'input':
          return this.onInput(client, data);
        case 'emote':
          return this.onEmote(client, data);
        case 'chat':
          return this.onChat(client, data);
        case 'interact':
          return this.onInteract(client, data);
        case 'engageSpawn':
          return this.onEngageSpawn(client, data);
        case 'battleAction':
          return this.onBattleAction(client, data);
        case 'battleResync':
          return this.onBattleResync(client, data);
        case 'challenge':
          return this.onChallenge(client, data);
        case 'challengeReply':
          return this.onChallengeReply(client, data);
        case 'handoverAck':
          return this.onHandoverAck(client, data);
        case 'tradeRequest':
          return this.onTrade(client, this.tradeRequestGuard(client) ?? this.trades.request(client.userData!.playerId, (data as ClientPayload<'tradeRequest'>).targetId));
        case 'tradeReply': {
          const m = data as ClientPayload<'tradeReply'>;
          return this.onTrade(client, this.trades.reply(client.userData!.playerId, m.tradeId, m.accept));
        }
        case 'tradeOffer': {
          const m = data as ClientPayload<'tradeOffer'>;
          return this.trades.offer(client.userData!.playerId, m.tradeId, m.creatureIds, m.money).then((e) => this.onTrade(client, e));
        }
        case 'tradeConfirm': {
          const m = data as ClientPayload<'tradeConfirm'>;
          return this.trades.confirm(client.userData!.playerId, m.tradeId, m.offerHash).then((e) => this.onTrade(client, e));
        }
        case 'tradeCancel':
          return this.onTrade(client, this.trades.cancel(client.userData!.playerId, (data as ClientPayload<'tradeCancel'>).tradeId));
        default:
          // raids (§30.4.7) are wired below when the zone has a hotspot; otherwise a clear refusal, no state change
          return this.onRaidMessage(client, type, data);
      }
    };
    try {
      const r = run();
      if (r instanceof Promise) {
        r.catch((e: unknown) => {
          this.deps.log.error({ err: e, type }, 'message handler failed');
          if (client.userData !== undefined) this.sendMsg(client, { type: 'error', code: 'internal', detail: null });
        });
      }
    } catch (e) {
      this.deps.log.error({ err: e, type }, 'message handler failed');
      this.sendMsg(client, { type: 'error', code: 'internal', detail: null });
    }
  }

  // ─── input / emote / chat ───────────────────────────────────────────────────

  private onInput(client: ZoneClient, input: ClientPayload<'input'>): void {
    const ud = client.userData!;
    const ps = this.state.players.get(ud.playerId);
    if (ps === undefined) return;
    const verdict = validateInput(
      { x: ps.x, z: ps.z, lastSeq: ud.lastSeq, budgetMs: ud.budgetMs, inBattle: ud.battleId !== null, canSurf: (ud.inventory[SURF_ITEM] ?? 0) > 0 },
      input,
      this.heightfield,
    );
    ud.budgetMs = verdict.budgetMs;
    if (verdict.ok) {
      const dist = Math.hypot(verdict.x - ps.x, verdict.z - ps.z);
      ps.x = verdict.x;
      ps.z = verdict.z;
      ps.angle = verdict.angle;
      ps.running = verdict.running;
      ps.moving = dist > 0.001;
      ps.seq = input.seq;
      ud.lastSeq = input.seq;
      ud.lastInputAt = this.now();
      ud.moved = true;
      if (ud.repel !== null) {
        ud.repel.steps -= dist;
        if (ud.repel.steps <= 0) {
          ud.repel = null;
          this.sendMsg(client, { type: 'toast', level: 'info', text: 'The repel wore off.' });
        }
      }
      return;
    }
    const reason: RejectReason = verdict.reason;
    this.metrics.rejectedInputs[reason] += 1;
    if (reason === 'staleSeq') return; // dropped silently; the ack carries the real seq
    // the "ack with authoritative pose": seq echoed against the unchanged x/z; no error message
    ps.seq = input.seq;
    ud.lastSeq = input.seq;
    ps.moving = false;
    if (reason === 'speed' || reason === 'unwalkable' || reason === 'bounds') {
      const now = this.now();
      ud.rejects = ud.rejects.filter((t) => now - t < MOVE_KICK.windowMs);
      ud.rejects.push(now);
      if (ud.rejects.length >= MOVE_KICK.max) {
        const deps = this.deps;
        void deps.repos.db
          .transaction((tx) => deps.repos.audit.write(tx, { actorId: ud.playerId, action: 'movement.kick', subject: this.zone.id, detail: { count: ud.rejects.length, reason } }, new Date(now)))
          .catch(() => undefined);
        this.kick(client, 'movement');
      }
    }
  }

  private onEmote(client: ZoneClient, m: ClientPayload<'emote'>): void {
    const ps = this.state.players.get(client.userData!.playerId);
    if (ps === undefined) return;
    ps.emote = m.emote;
    this.emoteSetAt.set(ps.id, this.now());
  }

  /** §30.6.5: sanitise → censor → only viewers whose 3×3 contains the sender. Never persisted. */
  private onChat(client: ZoneClient, m: ClientPayload<'chat'>): void {
    const ps = this.state.players.get(client.userData!.playerId);
    if (ps === undefined) return;
    const clean = sanitizeChat(m.text);
    if (clean === null) return;
    const msg: ServerMessage = { type: 'chat', id: ps.id, name: ps.name, text: censor(clean) };
    for (const viewerId of this.aoi.viewersAt(ps.x, ps.z)) this.sendTo(viewerId, msg);
  }

  // ─── interact ───────────────────────────────────────────────────────────────

  private near(ps: PlayerState, x: number, z: number, range: number): boolean {
    return Math.hypot(ps.x - x, ps.z - z) <= range;
  }

  private async onInteract(client: ZoneClient, m: ClientPayload<'interact'>): Promise<void> {
    const deps = this.deps;
    const ud = client.userData!;
    const ps = this.state.players.get(ud.playerId);
    if (ps === undefined) return;
    if (ud.battleId !== null || ud.tradeId !== null) return this.sendMsg(client, { type: 'error', code: 'busy', detail: 'inBattle' });
    if (m.kind === 'healer' || m.kind === 'shop') return; // no-ops over the room (POST /heal, GET /shop/:zoneId)
    const target = findTarget(this.zone, m.kind, m.targetId);
    const cell = ud.cell ?? cellOf(ps.x, ps.z);
    let tx = target?.x ?? 0;
    let tz = target?.z ?? 0;
    if (target?.kind === 'static') {
      const snapped = nearestWalkable(this.heightfield, tx, tz, 8);
      if (snapped !== null) [tx, tz] = snapped;
    }
    // AOI membership first: a target outside the 3×3 is notFound (same as a non-existent id)
    if (target === null || !this.inCellRange(cell, tx, tz)) return this.sendMsg(client, { type: 'error', code: 'notFound', detail: null });
    if (!this.near(ps, tx, tz, rangeFor(target))) return this.sendMsg(client, { type: 'error', code: 'notAllowed', detail: 'tooFar' });
    const pos = { x: ps.x, z: ps.z };
    const seat = { playerId: ud.playerId, sessionId: client.sessionId };

    // §30.4.8: a story beat whose speaker is this npc/gym runs first; a story trainer (rule 6) fires the beat
    // whose battle names it, and nothing else
    if (target.kind === 'npc' || target.kind === 'trainer' || target.kind === 'gym') {
      const beat = beatFor(this.zone.id, ud.flags, m.targetId) ?? (target.kind === 'trainer' ? storyTrainerBeat(this.zone.id, ud.flags, target.trainer.id) : null);
      if (beat !== null) {
        this.sendMsg(client, { type: 'storyBeat', beatId: beat.id, phase: 'start' });
        if (beat.battle !== null) {
          const trainerId = beat.battle.trainerId;
          const trainer = this.zone.trainers.find((t) => t.id === trainerId);
          const res = trainer !== undefined ? await this.battles.startNpc(seat, { kind: 'trainer', trainer, rematch: false }, beat.id, pos) : await this.battles.startNpc(seat, { kind: 'league', league: leagueById(trainerId) }, beat.id, pos);
          if (!res.ok) this.sendMsg(client, { type: 'error', code: res.code, detail: res.detail });
          return;
        }
        const done = await deps.repos.db.transaction((t) => completeBeatInTx(t, deps.repos, ud.playerId, beat, new Date(this.now())));
        this.applyFlags(ud, done.flags);
        this.sendMsg(client, progressionOnly({ flags: [...done.flags], questProgress: done.questProgress.length > 0 ? [...done.questProgress] : null }));
        this.sendMsg(client, { type: 'storyBeat', beatId: beat.id, phase: 'complete' });
        return;
      }
    }

    switch (target.kind) {
      case 'npc': {
        // plain conversation: nothing over the wire, except talkTo quest progress
        const touched = await deps.repos.db.transaction((t) => advanceQuests(t, deps.repos, ud.playerId, [{ kind: 'talkTo', npcId: target.npc.id }], this.now()));
        if (touched.length > 0) this.sendMsg(client, progressionOnly({ questProgress: touched }));
        return;
      }
      case 'trainer': {
        const t = target.trainer;
        // §30.4.8 rule 6: a story trainer with no eligible beat naming it is a plain NPC — nothing over the wire
        // (otherwise its reward and `trainer:<id>:beaten` could be collected before the beat, then paid again)
        if (isStoryTrainer(t.id)) return;
        const flag = trainerBeatenFlag(t.id);
        let rematch = false;
        if (ud.flags.has(flag)) {
          if (t.rematchDays === null) return this.sendMsg(client, { type: 'error', code: 'notAllowed', detail: 'alreadyBeaten' });
          const setAt = await deps.repos.db.transaction((x) => deps.repos.progress.flagSetAt(x, ud.playerId, flag));
          if (setAt !== null && this.now() - setAt.getTime() < t.rematchDays * 86_400_000) return this.sendMsg(client, { type: 'error', code: 'notAllowed', detail: 'rematchLater' });
          rematch = true;
        }
        const res = await this.battles.startNpc(seat, { kind: 'trainer', trainer: t, rematch }, null, pos);
        if (!res.ok) this.sendMsg(client, { type: 'error', code: res.code, detail: res.detail });
        return;
      }
      case 'gym': {
        const refusal = this.leagueRefusal(ud, target.league.id);
        if (refusal !== null) {
          this.sendMsg(client, { type: 'toast', level: 'warn', text: refusal });
          return this.sendMsg(client, { type: 'error', code: 'notAllowed', detail: 'leagueLocked' });
        }
        const res = await this.battles.startNpc(seat, { kind: 'league', league: target.league }, null, pos);
        if (!res.ok) this.sendMsg(client, { type: 'error', code: res.code, detail: res.detail });
        return;
      }
      case 'item': {
        const flag = itemFlag(this.zone, target.item);
        if (ud.flags.has(flag)) return this.sendMsg(client, { type: 'error', code: 'notAllowed', detail: 'alreadyTaken' });
        const qty = await deps.repos.db.transaction(async (t) => {
          const already = await deps.repos.progress.flagSetAt(t, ud.playerId, flag);
          if (already !== null) return null;
          await deps.repos.progress.setFlags(t, ud.playerId, [flag], new Date(this.now()));
          return deps.repos.inventory.add(t, ud.playerId, target.item.item, target.item.qty);
        });
        if (qty === null) return this.sendMsg(client, { type: 'error', code: 'notAllowed', detail: 'alreadyTaken' });
        this.applyFlags(ud, [flag]);
        ud.inventory[target.item.item] = qty;
        this.sendMsg(client, { type: 'inventoryDelta', items: { [target.item.item]: qty }, money: null, creaturesAdded: [], creaturesRemoved: [], creaturesUpdated: [] });
        this.sendMsg(client, progressionOnly({ flags: [flag] }));
        return;
      }
      case 'lore':
        return; // content text; nothing changes
      case 'warp': {
        const w = target.warp;
        const snapped = isWalkable(this.heightfield, w.toX, w.toZ) ? ([w.toX, w.toZ] as const) : nearestWalkable(this.heightfield, w.toX, w.toZ, 8);
        if (snapped === null) return this.sendMsg(client, { type: 'error', code: 'notAllowed', detail: 'warpBlocked' });
        // authoritative teleport; the seq echo carries the client
        ps.x = snapped[0];
        ps.z = snapped[1];
        ps.moving = false;
        ud.moved = true;
        return;
      }
      case 'static': {
        const st = target.static;
        const gateFlag = st.when.startsWith('badge:') ? st.when : st.when.slice('flag:'.length);
        if (!ud.flags.has(gateFlag) || ud.flags.has(st.flag)) return this.sendMsg(client, { type: 'error', code: 'notAllowed', detail: 'staticLocked' });
        const res = await this.battles.startStatic(seat, st, pos);
        if (!res.ok) this.sendMsg(client, { type: 'error', code: res.code, detail: res.detail });
        return;
      }
    }
  }

  /** §30.4.4 league order rules; null = may challenge. Already beaten → refused (no rematch in v1). */
  private leagueRefusal(ud: ZoneUserData, leagueId: string): string | null {
    const lt = leagueById(leagueId);
    if (lt.stage === 'gym') {
      if (lt.badge !== null && ud.badges.includes(lt.badge)) return 'You already hold this badge.';
      if (lt.order > 1) {
        const prevGym = this.leagueByStageOrder('gym', lt.order - 1);
        if (prevGym?.badge != null && !ud.badges.includes(prevGym.badge)) return 'The gym leader wants to see the previous badge first.';
      }
      return null;
    }
    const beatenFlags = lt.setsFlags;
    if (beatenFlags.length > 0 && beatenFlags.every((f) => ud.flags.has(f))) return 'Already beaten.';
    if (lt.stage === 'elite') {
      if (ud.badges.length < 8) return 'The Wardens receive only holders of all eight badges.';
      if (lt.order > 1) {
        const prev = this.leagueByStageOrder('elite', lt.order - 1);
        if (prev !== null && !prev.setsFlags.every((f) => ud.flags.has(f))) return 'Face the previous Warden first.';
      }
      return null;
    }
    // champion: the 3 elite flags
    for (const e of [1, 2, 3]) {
      const elite = this.leagueByStageOrder('elite', e);
      if (elite !== null && !elite.setsFlags.every((f) => ud.flags.has(f))) return 'The Champion waits for those who passed the Wardens.';
    }
    return null;
  }

  private leagueByStageOrder(stage: 'gym' | 'elite', order: number) {
    for (const id of ['verdant_gym', 'blaze_gym', 'tidal_gym', 'volt_gym', 'stone_gym', 'phantom_gym', 'iron_gym', 'draco_gym', 'veil', 'aurelia', 'kirei']) {
      try {
        const l = leagueById(id);
        if (l.stage === stage && l.order === order) return l;
      } catch (_e) {
        // id not in content
      }
    }
    return null;
  }

  private applyFlags(ud: ZoneUserData, flags: readonly string[]): void {
    for (const f of flags) ud.flags.add(f);
  }

  private inCellRange(cell: Cell, x: number, z: number): boolean {
    const c = cellOf(x, z);
    return Math.abs(c[0] - cell[0]) <= 1 && Math.abs(c[1] - cell[1]) <= 1;
  }

  // ─── spawns / battles ───────────────────────────────────────────────────────

  private async onEngageSpawn(client: ZoneClient, m: ClientPayload<'engageSpawn'>): Promise<void> {
    const ud = client.userData!;
    const ps = this.state.players.get(ud.playerId);
    if (ps === undefined) return;
    if (ud.battleId !== null || ud.tradeId !== null) return this.sendMsg(client, { type: 'error', code: 'busy', detail: 'inBattle' });
    const cell = ud.cell ?? cellOf(ps.x, ps.z);
    const rec = this.spawns?.get(m.spawnId) ?? null;
    if (rec === null || !this.aoi.isNear(cell, rec.id)) return this.sendMsg(client, { type: 'error', code: 'notFound', detail: null });
    if (rec.medium === 'water' && !isWater(this.heightfield, ps.x, ps.z)) return this.sendMsg(client, { type: 'error', code: 'notAllowed', detail: 'needSurf' });
    // §30.6.3 repel: wild spawns below the lead's level refuse engagement (a notFound-equivalent toast)
    if (ud.repel?.kind === 'repel' && rec.level < (await this.leadLevel(ud.playerId))) {
      this.sendMsg(client, { type: 'toast', level: 'info', text: 'The repel keeps it away.' });
      return this.sendMsg(client, { type: 'error', code: 'notFound', detail: 'repelled' });
    }
    const verdict = this.spawns!.engage(rec.id, ud.playerId, this.now(), { x: ps.x, z: ps.z });
    if (verdict === 'notFound') return this.sendMsg(client, { type: 'error', code: 'notFound', detail: null });
    if (verdict === 'tooFar') return this.sendMsg(client, { type: 'error', code: 'notAllowed', detail: 'tooFar' });
    if (verdict === 'engaged') return this.sendMsg(client, { type: 'error', code: 'busy', detail: 'engaged' });
    const st = this.spawnStates.get(rec.id);
    if (st !== undefined) st.engagedBy = ud.playerId;
    ud.battleId = 'pending';
    const res = await this.battles.startWild({ playerId: ud.playerId, sessionId: client.sessionId }, rec, { x: ps.x, z: ps.z }).catch((e: unknown) => {
      this.deps.log.error({ err: e }, 'startWild failed');
      return { ok: false as const, code: 'internal' as const, detail: 'startFailed' };
    });
    if (!res.ok) {
      if (ud.battleId === 'pending') ud.battleId = null;
      this.spawns!.release(rec.id, 'playerLeft', this.now());
      if (st !== undefined) st.engagedBy = '';
      this.sendMsg(client, { type: 'error', code: res.code, detail: res.detail });
    }
  }

  private onBattleAction(client: ZoneClient, m: ClientPayload<'battleAction'>): void {
    const err = this.battles.action(client.userData!.playerId, m.battleId, m.turn, m.action);
    if (err !== null) this.sendMsg(client, { type: 'error', code: err.code, detail: err.detail });
  }

  private onBattleResync(client: ZoneClient, m: ClientPayload<'battleResync'>): void {
    const msg = this.battles.resync(client.userData!.playerId, m.battleId);
    if (msg === null) return this.sendMsg(client, { type: 'error', code: 'notFound', detail: null });
    this.sendMsg(client, msg);
  }

  private battleHost(): BattleHost {
    return {
      send: (playerId, msg) => this.sendTo(playerId, msg),
      onStart: (session) => this.onBattleStart(session),
      onEnd: (session, outcome) => this.onBattleEnd(session, outcome),
      onProgress: (playerId, p) => {
        const c = this.clientOf(playerId);
        if (c?.userData === undefined) return;
        if (p.flags !== undefined) this.applyFlags(c.userData, p.flags);
        if (p.badges !== undefined) {
          c.userData.badges = [...p.badges];
          for (const b of p.badges) c.userData.flags.add(badgeFlag(b));
        }
        if (p.inventory !== undefined) c.userData.inventory = { ...p.inventory };
      },
    };
  }

  private onBattleStart(session: BattleSession): void {
    const summary = new BattleSummary();
    summary.id = session.id;
    summary.format = session.format;
    summary.turn = session.state.turn;
    summary.x = session.x;
    summary.z = session.z;
    for (const seat of session.seats) {
      if (seat.playerId === null) continue;
      // §30.8.3: entering a battle cancels the player's trades (pending requests included)
      this.trades.cancelFor(seat.playerId);
      summary.participants.push(seat.playerId);
      const ps = this.state.players.get(seat.playerId);
      if (ps !== undefined) {
        ps.inBattle = true;
        ps.moving = false;
      }
      const c = this.clientOf(seat.playerId);
      if (c?.userData !== undefined) c.userData.battleId = session.id;
      this.deps.presenceMirror.setBattle(seat.playerId, session.id);
    }
    this.state.battles.set(session.id, summary);
    this.metrics.battles = this.battles.size;
  }

  private onBattleEnd(session: BattleSession, outcome: Parameters<BattleHost['onEnd']>[1]): void {
    this.state.battles.delete(session.id);
    for (const seat of session.seats) {
      if (seat.playerId === null) continue;
      const ps = this.state.players.get(seat.playerId);
      if (ps !== undefined) ps.inBattle = false;
      const c = this.clientOf(seat.playerId);
      if (c?.userData !== undefined && (c.userData.battleId === session.id || c.userData.battleId === 'pending')) c.userData.battleId = null;
      this.deps.presenceMirror.setBattle(seat.playerId, null);
    }
    if (session.spawnId !== null && this.spawns !== null) {
      const release =
        outcome === 'playerLeft' ? 'playerLeft' : outcome === 'void' ? 'timeout' : outcome.winner === 'caught' ? 'caught' : outcome.winner === 'fled' ? 'fled' : 'ko';
      this.spawns.release(session.spawnId, release, this.now());
      if (release === 'playerLeft') {
        const st = this.spawnStates.get(session.spawnId);
        if (st !== undefined) st.engagedBy = '';
      }
    }
    this.metrics.battles = this.battles.size;
  }

  // ─── trades (§30.8.3) ───────────────────────────────────────────────────────

  private tradeRequestGuard(client: ZoneClient): { code: 'busy'; detail: string } | null {
    return client.userData!.battleId !== null ? { code: 'busy', detail: 'inBattle' } : null;
  }

  private onTrade(client: ZoneClient, err: { readonly code: 'notFound' | 'notAllowed' | 'busy'; readonly detail: string | null } | null): void {
    if (err !== null && client.userData !== undefined) this.sendMsg(client, { type: 'error', code: err.code, detail: err.detail });
  }

  // ─── raids (§30.4.7, §30.9.2) ───────────────────────────────────────────────

  /** raid* messages; an id other than the open raid's (or no raid) → notFound, like a foreign battle id. */
  protected async onRaidMessage(client: ZoneClient, type: ClientMessageType, data: unknown): Promise<void> {
    const ud = client.userData!;
    const raid = this.raid;
    const m = data as { raidId: string };
    const reply = (e: { readonly code: 'notFound' | 'notAllowed' | 'busy' | 'internal'; readonly detail: string | null } | null): void => {
      if (e !== null && client.userData !== undefined) this.sendMsg(client, { type: 'error', code: e.code, detail: e.detail });
    };
    if (raid === null || m.raidId !== raid.id) return reply({ code: 'notFound', detail: null });
    switch (type) {
      case 'raidJoin': {
        const ps = this.state.players.get(ud.playerId);
        if (ps === undefined) return;
        if (ud.battleId !== null) return reply({ code: 'busy', detail: 'inBattle' });
        if (ud.tradeId !== null) return reply({ code: 'busy', detail: 'inTrade' });
        const h = raid.session.hotspot;
        if (Math.hypot(ps.x - h.x, ps.z - h.z) > RAID_JOIN_RANGE_M) return reply({ code: 'notAllowed', detail: 'tooFar' });
        const err = await raid.join(ud.playerId, this.now());
        if (err === null) this.sendMsg(client, { type: 'toast', level: 'success', text: 'You joined the raid' });
        return reply(err);
      }
      case 'raidReady':
        return reply(raid.ready(ud.playerId));
      case 'raidAction': {
        const a = data as ClientPayload<'raidAction'>;
        return reply(raid.action(ud.playerId, a.round, a.action));
      }
      case 'raidCatch':
        return reply(await raid.catchAttempt(ud.playerId, (data as ClientPayload<'raidCatch'>).orb));
      case 'raidLeave':
        if (!raid.isParticipant(ud.playerId)) return reply({ code: 'notFound', detail: null });
        raid.leave(ud.playerId);
        return;
      default:
        return reply({ code: 'notAllowed', detail: 'unavailable' });
    }
  }

  /** Opens a raid at `h` (the scheduler, after winning the election; tests call it directly). */
  openRaid(h: RaidHotspot, now: number): RaidRunner {
    const session = new RaidSession(h, this.worldRng.fork(), this.deps.content, now, TERRAIN_BY_BIOME[this.zone.biome]);
    const runner = new RaidRunner(session, {
      repos: this.deps.repos,
      content: this.deps.content,
      clock: this.deps.clock,
      log: this.deps.log.child({ roomId: this.roomId, zoneId: this.zone.id, raidId: session.id }),
      zone: this.zone,
      host: {
        send: (playerId, msg) => this.sendTo(playerId, msg),
        setFighting: (playerId, raidId) => this.setRaidFighting(playerId, raidId),
        onInventory: (playerId, inv) => {
          const c = this.clientOf(playerId);
          if (c?.userData !== undefined) c.userData.inventory = { ...inv };
        },
      },
    });
    this.raid = runner;
    const rs = new RaidState();
    this.state.raid = rs;
    this.mirrorRaid(now);
    this.metrics.raid = true;
    return runner;
  }

  /** Fight start / end for one participant: frozen like a battle, REST party mutations refused (presence battle). */
  private setRaidFighting(playerId: string, raidId: string | null): void {
    const c = this.clientOf(playerId);
    const ps = this.state.players.get(playerId);
    if (raidId !== null) {
      this.trades.cancelFor(playerId);
      if (c?.userData !== undefined && c.userData.battleId === null) c.userData.battleId = raidId;
      if (ps !== undefined) {
        ps.inBattle = true;
        ps.moving = false;
      }
      this.deps.presenceMirror.setBattle(playerId, raidId);
      return;
    }
    const current = this.raid?.id;
    if (c?.userData !== undefined && c.userData.battleId === current) c.userData.battleId = null;
    if (ps !== undefined && this.battles.ofPlayer(playerId) === null) ps.inBattle = false;
    if (this.deps.presenceStore.battleOf(playerId) === current) this.deps.presenceMirror.setBattle(playerId, null);
  }

  /** Copies the session's view into the broadcast `state.raid` (only changed fields are written). */
  private mirrorRaid(now: number): void {
    const raid = this.raid;
    const rs = this.state.raid;
    if (raid === null || rs === null) return;
    const v = raid.session.toState(now);
    if (rs.id !== v.id) rs.id = v.id;
    if (rs.bossSpecies !== v.bossSpecies) rs.bossSpecies = v.bossSpecies;
    if (rs.bossLevel !== v.bossLevel) rs.bossLevel = v.bossLevel;
    if (Math.abs(rs.hpPct - v.hpPct) > 1e-7) rs.hpPct = v.hpPct;
    if (rs.phase !== v.phase) rs.phase = v.phase;
    // whole seconds: the countdown patches once a second, not every tick
    const ends = Math.ceil(v.roundEndsInMs / 1000) * 1000;
    if (rs.roundEndsInMs !== Math.min(0xffff, ends)) rs.roundEndsInMs = Math.min(0xffff, ends);
    if (rs.x !== v.x) rs.x = v.x;
    if (rs.z !== v.z) rs.z = v.z;
    for (const [pid, dmg] of Object.entries(v.damageBoard)) if (rs.damageBoard.get(pid) !== dmg) rs.damageBoard.set(pid, dmg);
    for (const pid of [...rs.damageBoard.keys()]) if (!(pid in v.damageBoard)) rs.damageBoard.delete(pid);
  }

  /** §30.2.8 step 7 (raid half) + §30.9.2 hotspot scheduling (shard 0, once a second). */
  raidPass(now: number): void {
    if (now >= this.raidCheckAt) {
      this.raidCheckAt = now + 1000;
      this.scheduleRaids(now);
    }
    const raid = this.raid;
    if (raid === null) return;
    if (raid.session.phase === 0 && !hotspotOpen(raid.session.hotspot, now)) raid.close(now); // window ended, no fight
    if (raid.finished(now)) {
      this.raid = null;
      this.state.raid = null;
      this.metrics.raid = false;
      return;
    }
    raid.tick(now).catch((e: unknown) => this.deps.log.error({ err: e }, 'raid tick failed'));
    this.mirrorRaid(now);
  }

  /** Election: `ewa:raid:<hotspotId>:<dayKey>` — the first setex after a get miss wins; a lost race yields. */
  private scheduleRaids(now: number): void {
    if (this.raid !== null || this.metadata.shard !== 0) return;
    for (const h of hotspotsFor(this.zone.id)) {
      if (!hotspotOpen(h, now)) continue;
      const window = `${h.id}:${hotspotDayKey(h, now)}`;
      if (this.raidWindows.has(window)) continue;
      this.raidWindows.add(window);
      void this.electRaid(h, window, now);
      return;
    }
  }

  private async electRaid(h: RaidHotspot, window: string, now: number): Promise<void> {
    const key = `ewa:raid:${window}`;
    const cur = await this.presence.get(key);
    if (cur === null || cur === undefined) {
      await this.presence.setex(key, this.roomId, 3600);
      if ((await this.presence.get(key)) !== this.roomId) return;
    } else if (cur !== this.roomId) {
      return;
    }
    if (this.raid === null) this.openRaid(h, now);
  }

  // ─── challenges (§30.4.5) ───────────────────────────────────────────────────

  /**
   * Step 1 conditions, re-checked on accept: both present, within AOI and 12 m, not in battle/trade, not self.
   * `ignoreTrades` — the trade flow's own check (a requester is already marked as trading while its request is pending).
   */
  private challengeable(fromId: string, toId: string, ignoreTrades = false): boolean {
    if (fromId === toId) return false;
    const a = this.state.players.get(fromId);
    const b = this.state.players.get(toId);
    const ca = this.clientOf(fromId);
    const cb = this.clientOf(toId);
    if (a === undefined || b === undefined || ca?.userData === undefined || cb?.userData === undefined) return false;
    if (a.inBattle || b.inBattle || ca.userData.battleId !== null || cb.userData.battleId !== null) return false;
    if (!ignoreTrades && (ca.userData.tradeId !== null || cb.userData.tradeId !== null)) return false;
    const cell = ca.userData.cell ?? cellOf(a.x, a.z);
    if (!this.aoi.isNear(cell, toId)) return false;
    return Math.hypot(a.x - b.x, a.z - b.z) <= CHALLENGE_RANGE_M;
  }

  private onChallenge(client: ZoneClient, m: ClientPayload<'challenge'>): void {
    const ud = client.userData!;
    if (ud.battleId !== null) return this.sendMsg(client, { type: 'error', code: 'busy', detail: 'inBattle' });
    if (!this.challengeable(ud.playerId, m.targetId)) return this.sendMsg(client, { type: 'error', code: 'notAllowed', detail: 'unavailable' });
    const r = this.challenges.offer(ud.playerId, m.targetId, this.now());
    if (r === 'selfChallenge') return this.sendMsg(client, { type: 'error', code: 'notAllowed', detail: 'self' });
    if (r === 'duplicate' || r === 'targetBusy') return this.sendMsg(client, { type: 'error', code: 'busy', detail: r });
    const me = this.state.players.get(ud.playerId)!;
    this.sendTo(m.targetId, { type: 'challengeReceived', fromId: ud.playerId, fromName: me.name, expiresInMs: 45_000 });
    this.sendMsg(client, { type: 'toast', level: 'info', text: 'Challenge sent' });
  }

  private async onChallengeReply(client: ZoneClient, m: ClientPayload<'challengeReply'>): Promise<void> {
    const ud = client.userData!;
    const me = ud.playerId;
    const consumed = this.challenges.consume(m.fromId, me, this.now());
    if (!m.accept) {
      if (consumed) this.sendTo(m.fromId, { type: 'challengeResult', targetId: me, result: 'declined' });
      return;
    }
    // step 3: re-check every condition of step 1 against current state
    if (!consumed || !this.challengeable(m.fromId, me)) {
      this.sendMsg(client, { type: 'challengeResult', targetId: m.fromId, result: 'unavailable' });
      return;
    }
    const challenger = this.clientOf(m.fromId)!;
    const a = this.state.players.get(m.fromId)!;
    const b = this.state.players.get(me)!;
    const res = await this.battles.startPvp(
      { playerId: m.fromId, sessionId: challenger.sessionId },
      { playerId: me, sessionId: client.sessionId },
      { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 },
    );
    if (!res.ok) this.sendMsg(client, { type: 'challengeResult', targetId: m.fromId, result: 'unavailable' });
  }

  // ─── handover (§30.2.7) ─────────────────────────────────────────────────────

  private async beginHandover(client: ZoneClient, dir: LinkDir): Promise<void> {
    const deps = this.deps;
    const ud = client.userData!;
    const ps = this.state.players.get(ud.playerId);
    if (ps === undefined) return;
    const destId = this.zone.links[dir]!;
    const dest = zoneById(destId);
    // 1. gate: toast + push back 1 m along −d
    if (dest.gate !== null && !ud.badges.includes(dest.gate)) {
      this.sendMsg(client, { type: 'toast', level: 'warn', text: `The way is barred. Badge required: ${dest.gate}` });
      const [vx, vz] = LINK_VECTORS[dir];
      this.pushBack(ps, vx, vz);
      ud.moved = true;
      return;
    }
    ud.handover = 'reserving';
    try {
      const entry = entryPoint(dest, dir, ps.x, ps.z);
      // 2. reserve on the destination (shard 0 by preference)
      const room = await pickZoneRoom(destId, deps.ticket);
      const seat = await reserveZoneSeat(room, { zoneId: destId, shard: Number(room.metadata?.shard ?? 0), ticket: deps.ticket, handover: { fromRoomId: this.roomId, x: entry.x, z: entry.z } });
      // 3. the reservation the destination validates
      await this.presence.setex(
        `ewa:handover:${ud.playerId}`,
        JSON.stringify({ fromRoomId: this.roomId, toRoomId: seat.roomId, sessionId: seat.sessionId, x: entry.x, z: entry.z, at: this.now() }),
        10,
      );
      if (client.userData === undefined || this.clientOf(ud.playerId) !== client) return;
      // 4. the whole ISeatReservation
      this.sendMsg(client, { type: 'handover', roomId: seat.roomId, seat, zoneId: destId, x: entry.x, z: entry.z });
      // 5.
      ud.handover = { toRoomId: seat.roomId, sentAt: this.now() };
    } catch (e) {
      deps.log.error({ err: e, playerId: ud.playerId, dest: destId }, 'handover reservation failed');
      ud.handover = null;
      const [vx, vz] = LINK_VECTORS[dir];
      this.pushBack(ps, vx, vz);
      ud.moved = true;
    }
  }

  private pushBack(ps: PlayerState, vx: number, vz: number): void {
    const nx = ps.x - vx * PUSHBACK_M;
    const nz = ps.z - vz * PUSHBACK_M;
    if (isWalkable(this.heightfield, nx, nz)) {
      ps.x = nx;
      ps.z = nz;
      return;
    }
    const s = nearestWalkable(this.heightfield, nx, nz, 4);
    if (s !== null) {
      ps.x = s[0];
      ps.z = s[1];
    }
  }

  /** Destination: the one authoritative position write of a crossing. */
  private async onHandoverAck(client: ZoneClient, m: ClientPayload<'handoverAck'>): Promise<void> {
    const deps = this.deps;
    const ud = client.userData!;
    const arrival = ud.arrival;
    if (arrival === null || m.roomId !== this.roomId || m.seat !== client.sessionId) return this.sendMsg(client, { type: 'error', code: 'notAllowed', detail: 'noHandover' });
    ud.arrival = null;
    const ps = this.state.players.get(ud.playerId);
    const x = ps?.x ?? arrival.x;
    const z = ps?.z ?? arrival.z;
    const touched = await deps.repos.db.transaction(async (tx) => {
      await deps.repos.players.setPosition(tx, ud.playerId, this.zone.id, x, z, ps?.angle ?? 0);
      return advanceQuests(tx, deps.repos, ud.playerId, [{ kind: 'reachZone', zoneId: this.zone.id }], this.now());
    });
    if (touched.length > 0) this.sendMsg(client, progressionOnly({ questProgress: touched }));
    this.presence.publish(`ewa:handover:done:${arrival.fromRoomId}`, { playerId: ud.playerId });
    this.presence.del(`ewa:handover:${ud.playerId}`);
  }

  /** Source: the destination confirmed — remove without a position write (4002 path). */
  private onHandoverDone(playerId: string): void {
    const c = this.clientOf(playerId);
    if (c?.userData === undefined) return;
    c.userData.handoverDone = true;
    c.leave(CLOSE_CODES.handoverComplete);
  }

  private onKick(m: { playerId: string; exceptRoomId?: string }): void {
    if (m.exceptRoomId === this.roomId) return;
    const c = this.clientOf(m.playerId);
    if (c?.userData === undefined) return;
    this.sendMsg(c, { type: 'error', code: 'busy', detail: 'replaced' });
    c.leave(CLOSE_CODES.replaced);
  }

  // ─── tick (§30.2.8, verbatim order) ─────────────────────────────────────────

  tick(_dtMs: number): void {
    const t0 = performance.now();
    const now = this.now();
    const state = this.state;
    // 1.
    state.tick += 1;
    state.timeOfDay = (now % ZoneRoom.DAY_LENGTH_MS) / ZoneRoom.DAY_LENGTH_MS;
    // 2. budget refill (inputs are applied when they arrive)
    for (const c of this.clients) if (c.userData !== undefined) c.userData.budgetMs = refillBudget(c.userData.budgetMs, ZoneRoom.TICK_MS);
    // 3. emote timers (+ S8: `moving` clears once inputs stop, so remote avatars stop their walk cycle)
    for (const [pid, at] of this.emoteSetAt) {
      if (at + EMOTE_MS > now) continue;
      const ps = state.players.get(pid);
      if (ps !== undefined) ps.emote = 0;
      this.emoteSetAt.delete(pid);
    }
    for (const c of this.clients) {
      const ud = c.userData;
      if (ud === undefined || now - ud.lastInputAt < IDLE_MS) continue;
      const ps = state.players.get(ud.playerId);
      if (ps !== undefined && ps.moving) ps.moving = false;
    }
    // 4. AOI pass
    this.aoiPass();
    // 5. spawns
    this.spawnPass(now);
    // 6. handover triggers
    this.handoverPass(now);
    // 7. battles (deadlines, auto-actions, resolution, persistence) — async, guarded by `resolving`
    this.battles.tick(now).catch((e: unknown) => this.deps.log.error({ err: e }, 'battles.tick failed'));
    this.raidPass(now);
    // 8. trades — 120 s inactivity cancel
    this.trades.tick(now);
    // 9. challenges 45 s TTL
    for (const c of this.challenges.sweep(now)) this.sendTo(c.fromId, { type: 'challengeResult', targetId: c.toId, result: 'expired' });
    // 10. metrics: tick duration ring (p50/p99), 1 s rates, one info line per room every 60 s
    const ms = performance.now() - t0;
    recordTick(this.metrics, ms);
    rollRoomMetrics(this.metrics, now);
    if (now >= this.nextLogAt) {
      if (this.nextLogAt !== 0) this.deps.log.info(roomLogLine(this.metrics), 'room metrics');
      this.nextLogAt = now + LOG_EVERY_MS;
    }
    if (ms > 40) {
      this.overruns += 1;
      this.metrics.tickOverruns += 1;
      if (this.overruns === 3) this.deps.log.warn({ roomId: this.roomId, ms }, 'tick overrun');
    } else {
      this.overruns = 0;
    }
  }

  /** §30.2.5 tick steps 1–2. */
  aoiPass(): void {
    const moved: PlayerState[] = [];
    for (const c of this.clients) {
      const ud = c.userData;
      if (ud === undefined || ud.replaced || !ud.moved) continue;
      const ps = this.state.players.get(ud.playerId);
      if (ps === undefined) continue;
      ud.moved = false;
      moved.push(ps);
      const to = cellOf(ps.x, ps.z);
      const from = this.aoi.viewerCell(ud.playerId);
      if (from !== null && from[0] === to[0] && from[1] === to[1]) {
        ud.cell = to;
        continue;
      }
      const { show, hide } = this.aoi.moveViewer(ud.playerId, from, to);
      for (const e of show) c.view?.add(e);
      for (const e of hide) c.view?.remove(e);
      this.metrics.aoiAdds += show.length;
      this.metrics.aoiRemoves += hide.length;
      ud.cell = to;
    }
    for (const ps of moved) {
      const { entered, left } = this.aoi.place(ps);
      for (const v of entered) this.clientOf(v)?.view?.add(ps);
      for (const v of left) this.clientOf(v)?.view?.remove(ps);
      this.metrics.aoiAdds += entered.length;
      this.metrics.aoiRemoves += left.length;
    }
  }

  /** §30.2.8 step 5 + §30.2.5 step 3. R8: `state.spawns.set` precedes `view.add` (schema 5 refuses detached adds). */
  spawnPass(now: number): void {
    if (this.spawns === null) return;
    const players = [...this.state.players.values()].map((p) => ({ x: p.x, z: p.z }));
    const r = this.spawns.tick(now, this.state.timeOfDay, players);
    for (const rec of r.spawned) this.addSpawn(rec, now);
    for (const id of r.despawned) {
      const st = this.spawnStates.get(id);
      if (st === undefined) continue;
      for (const v of this.aoi.removeEntity(st)) this.clientOf(v)?.view?.remove(st);
      this.state.spawns.delete(id);
      this.spawnStates.delete(id);
    }
    for (const id of r.freed) {
      const st = this.spawnStates.get(id);
      if (st !== undefined) st.engagedBy = '';
    }
    this.metrics.spawns = this.spawnStates.size;
  }

  private addSpawn(rec: SpawnRecord, now: number): void {
    const st = new SpawnState();
    st.id = rec.id;
    st.speciesId = rec.speciesId;
    st.level = rec.level;
    st.x = rec.x;
    st.z = rec.z;
    st.variantKey = rec.variantKey;
    st.isAlpha = rec.isAlpha;
    st.engagedBy = '';
    st.despawnAtTick = this.state.tick + Math.ceil((rec.despawnAt - now) / ZoneRoom.TICK_MS);
    this.state.spawns.set(rec.id, st);
    this.spawnStates.set(rec.id, st);
    const { entered } = this.aoi.place(st);
    for (const v of entered) this.clientOf(v)?.view?.add(st);
  }

  /** §30.2.8 step 6. */
  handoverPass(now: number): void {
    for (const c of this.clients) {
      const ud = c.userData;
      if (ud === undefined || ud.replaced) continue;
      const h = ud.handover;
      if (h !== null && h !== 'reserving' && now - h.sentAt > HANDOVER_TIMEOUT_MS) {
        // the destination never confirmed: clear, push 1 m back inside, let them try again
        ud.handover = null;
        const ps = this.state.players.get(ud.playerId);
        const dir = ps === undefined ? null : crossedLink(this.zone, this.heightfield, ps.x, ps.z);
        if (ps !== undefined && dir !== null) {
          const [vx, vz] = LINK_VECTORS[dir];
          this.pushBack(ps, vx, vz);
          ud.moved = true;
        }
        continue;
      }
      if (h !== null || ud.battleId !== null || ud.tradeId !== null || now < ud.handoverCooldownUntil) continue;
      const ps = this.state.players.get(ud.playerId);
      if (ps === undefined) continue;
      const dir = crossedLink(this.zone, this.heightfield, ps.x, ps.z);
      if (dir !== null) void this.beginHandover(c, dir);
    }
  }
}

/** A ZoneRoom class bound to one process's dependencies. */
export function bindZoneRoom(deps: RoomDeps): typeof ZoneRoom {
  class BoundZoneRoom extends ZoneRoom {}
  BoundZoneRoom.roomDeps = deps;
  return BoundZoneRoom;
}

/**
 * R2 / §30.5.1 #26: Colyseus' own HTTP routes (`POST /matchmake/{joinOrCreate,create,join,joinById}/…`) call the
 * room class's **static** `onAuth` before they create a room or reserve a seat. Without the server's join ticket
 * it refuses with 403 `noTicket`, so a direct call can neither create a shard nor park a reservation in a live
 * room (reserved seats count against `maxClients`: a token holder could otherwise fill every shard and make the
 * server open new ones). Server-side reservations (`reserveZoneSeat`, no auth context) never call it, and the
 * instance `onAuth` still runs when any seat is consumed (a static returning `true` gives Colyseus no auth data,
 * so it does not skip the instance hook). `/matchmake/reconnect` does not call `onAuth` and keeps working.
 *
 * Installed after `matchMaker.defineRoomType`: registration logs "instance-level onAuth will be ignored" for a
 * class that defines both hooks, which is false for this static and would mislead whoever reads the boot log.
 */
export function refuseDirectMatchmaking(klass: typeof ZoneRoom, ticket: string): void {
  klass.onAuth = async (_token: string, options: ZoneJoinOptions | undefined): Promise<true> => {
    if (options?.ticket !== ticket) throw new ServerError(403, 'noTicket');
    return true;
  };
}
