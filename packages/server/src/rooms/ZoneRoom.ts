/**
 * §30.2 ZoneRoom — one room type; battles, raids and trades are sub-states. Tick, movement, AOI, handover,
 * sharding. Lifecycle and tick follow the spec's verbatim order; every deviation forced by the installed
 * Colyseus 0.18.14 is marked `R<n>` and listed in IMPLEMENTATION-NOTES.md.
 */
import { Room, ServerError } from '@colyseus/core';
import type { AuthContext, Client } from '@colyseus/core';
import { StateView } from '@colyseus/schema';
import {
  OBSTACLE_PREFIX,
  arrivalPoint,
  badgeFlag,
  encounterTableFor,
  gatesClosedFor,
  getHeightfield,
  interiorArenaFor,
  interiorAt,
  interiorGates,
  interiorTrainers,
  isWalkable,
  LEAGUE_REMATCH_COOLDOWN_DAYS,
  POSTGAME_FLAG,
  isWater,
  league as leagueById,
  leagueRematch,
  leagueRematchFlag,
  leagueStoryGate,
  nearestWalkable,
  obstacleFlag,
  obstacleRefusal,
  obstacleRefusalText,
  playableBounds,
  visitedFlag,
  zone as zoneById,
  zonePlan,
} from '@ewa/content';
import type { BadgeId, Heightfield, LinkDir, PlanEllipse, RaidHotspot, RectSolid, TrainerDef, ZoneDef, ZoneId } from '@ewa/content';
import { createRng } from '@ewa/core';
import type { Rng, WeatherKind } from '@ewa/core';
import { BattleSummary, CLIENT_MESSAGES, CLOSE_CODES, FISH_REACH_M, PlayerState, RaidState, SpawnState, ZoneState, rankedWindow } from '@ewa/protocol';
import type { ChallengeFailReason, ClientMessageType, ClientPayload, FastTravelRefusal, FishRefusal, RankedIdleReason, ServerMessage, ServerMessageOf } from '@ewa/protocol';
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
import { pickZoneRoom, reserveZoneSeat, zoneRoomById } from './matchmaking';
import { RANKED_CANCEL_TOPIC, RANKED_MATCH_TOPIC, RankedArena, rankedArenaTopic } from './matchQueue';
import { arenaTopic } from './arenaQueue';
import type { PendingRanked, RankedCancel, RankedMatch } from './matchQueue';
import { BIKE_ITEM, NO_CLEARED, NO_GATES, SURF_ITEM, isLava, onOpenWater, refillBudget, validateInput } from './movement';
import type { RejectReason } from './movement';
import { SpawnDirector, rollFishing, rollWild, tuningFor } from './spawnDirector';
import {
  ENCOUNTER_GRACE_M,
  ENCOUNTER_REFUSED_GRACE_M,
  GRASS_RATE_PER_M,
  LURE_FACTOR,
  SPOT_QUIET_MS,
  SPOT_TIMEOUT_MS,
  SURF_RATE_PER_M,
  encounterChance,
  inTallGrass,
  spotter,
} from './encounters';
import type { SpawnRecord } from './spawnDirector';
import { beatFor, completeBeatInTx, flagSet, isStoryTrainer, storyTrainerBeat } from './storyBeats';
import { RAID_JOIN_RANGE_M, RaidRunner, RaidSession } from './raidSession';
import { TradeCoordinator } from './tradeSession';
import { EggWalker } from './eggWalk';
import { EGGS_TOPIC } from '../rest/routes/daycare';
import { TowerSessions } from './towerSession';
import { advanceQuests, deliveriesFor } from '../game/quests';
import type { QuestEvent } from '../game/quests';
import { STREAK_LAST_PREFIX, dailyLogin } from '../liveops/login';
import { dayKey, hotspotDayKey, hotspotOpen, hotspotsFor, liveOpsModsFor } from '../liveops/schedule';
import { WEATHER_FORMATS, weatherAt, weatherBucket } from '../game/weather';
import { REAL_WEATHER_CHECK_MS, weatherTopic } from '../game/realWeather';
import type { Ghost, Nemesis, WeatherCity } from '@ewa/persist';
import { nemesisAmbushChance, nemesisFightLevel } from '@ewa/content';
import { ambushesOn, tauntOf } from '../game/nemesis';
import { GHOSTS_PER_ZONE, GHOST_CHANCE, GHOST_DAYS, GHOST_LEVEL_SPAN, ROAMER_CHANCE, ROAMER_LEVEL, ghostReport, roamerOf, roamerZoneAt, seasonAt, shadowLevel } from '@ewa/content';

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

/** Honor shapes the world: how often a zone room reads its season tally. */
export const SHADOW_CHECK_MS = 60_000;

export interface ZoneUserData {
  readonly playerId: string;
  /** weather from real life: the city the player picked (null: off) and its weather once known */
  weatherCity: WeatherCity | null;
  realWeather: WeatherKind | null;
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
  /**
   * Phase A: the interior gates still shut for this player (`gatesClosedFor(zone, flags)` `.solid`s), recomputed by
   * `applyFlags` — every flag write of this room goes through it. Shared empty array in zones without gates.
   */
  closedGates: readonly RectSolid[];
  /** Phase D10: ids of this zone's obstacles the player cleared (from `obstacle:<zone>:<id>` flags, kept by `applyFlags`) */
  clearedObstacles: ReadonlySet<string>;
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
  /** Phase C3: no `fastTravel` before this time (3 s after the last accepted one, or after any arrival) */
  fastTravelReadyAt: number;
  /** grass encounters: metres still to walk before the grass or the water can roll (after arriving, after a battle) */
  encounterGraceM: number;
  /**
   * trainer sight: the trainer who saw this player; movement is held until its fight starts (`at` = when it saw them;
   * the room starts the fight itself after SPOT_TIMEOUT_MS). `checking` while the party read is in flight.
   */
  spotted: { readonly trainerId: string; at: number; checking: boolean } | null;
  /** trainer sight is quiet until this time (a spotted fight that could not start) */
  sightQuietUntil: number;
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
/** Phase C3: the fast-travel cooldown (after an accepted travel, and after arriving by any handover). */
export const FAST_TRAVEL_COOLDOWN_MS = 3_000;
/** Phase D9: the key item a cast needs (content `old_rod`, Maren's gift). */
export const ROD_ITEM = 'old_rod';
/** Phase D9: the cast heading is sampled every 0.5 m from 0.5 m to FISH_REACH_M ahead of the accepted position. */
export const FISH_SAMPLE_M = 0.5;

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
  /** Phase D7: the weather bucket state.weather was derived for */
  private weatherBucketAt = Number.NaN;
  /** Phase D9: the fishing stream (seeded from the room seed; independent of the room's other forks) */
  private fishRng: Rng | null = null;
  private fishCounter = 0;
  /** tall-grass / surf encounters: their own stream (seeded like the fishing one) and the zone plan's grass patches */
  private wildRng: Rng | null = null;
  /** one roaming legendary per season: its own stream (the grass rolls stay as they were) and whether it was caught */
  private roamRng: Rng | null = null;
  private roamerCaught: { season: number; caught: boolean } | null = null;
  /** ghost trainers: this zone's recent ghosts (read with the shadow, once a minute) and their own stream */
  private ghosts: readonly Ghost[] = [];
  private ghostRng: Rng | null = null;
  /** nemeses: the ambush roll's own stream (the grass, roamer and ghost rolls stay as they were) */
  private nemesisRng: Rng | null = null;
  private wildCounter = 0;
  private grassPatches: readonly PlanEllipse[] = [];
  /** Phase D14: battle tower runs (only Solenne has the attendant; elsewhere every `tower` message is refused) */
  private tower!: TowerSessions;
  /** breeding: the steps carried eggs count, and their hatching */
  private eggs!: EggWalker;
  /**
   * player uuid → its `ewa:dm:<id>` callback (§30.7.2: DMs pushed live while the player is in this room) and its
   * `ewa:arena:<id>` callback (arena PvP: queue status, friend invites — a ServerMessage forwarded as is)
   */
  private readonly dmSubs = new Map<string, { readonly dm: (m: DmPush) => void; readonly arena: (m: ServerMessage) => void; readonly weather: (city: WeatherCity | null) => void }>();
  /** weather from real life: when the players' cities were last checked against the lookup cache */
  private realWeatherCheckedAt = 0;
  /** honor shapes the world: when the zone's tally was last read (and whether a read is in flight) */
  private shadowCheckedAt = Number.NEGATIVE_INFINITY;
  private shadowReading = false;
  /** Phase D13: ranked matches this room is the arena for, waiting for both players to arrive */
  private readonly rankedArena = new RankedArena();

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
    // Phase D7: the zone's scheduled weather (re-derived in tick step 1 when the bucket turns)
    this.weatherBucketAt = weatherBucket(this.now());
    state.weather = deps.env.WORLD_WEATHER === 'off' ? 'none' : weatherAt(deps.worldSeed, this.zone, this.now());
    this.state = state;
    this.metrics = createRoomMetrics(this.roomId, this.zone.id, shard);
    deps.metrics.register(this.metrics);
    this.aoi = new AoiGrid();
    this.challenges = new ChallengeStore();
    // 5. seed
    const root = createRng(`${deps.worldSeed}:${options.zoneId}:${shard}:${this.now()}`);
    this.worldRng = root;
    // Phase D9: its own seed, so adding it changes none of the root's forks (spawns, battles, raids)
    this.fishRng = createRng(`${deps.worldSeed}:${options.zoneId}:${shard}:${this.now()}:fish`);
    // grass encounters: their own seed too, so the root's forks (spawns, battles, raids) stay what they were
    this.wildRng = createRng(`${deps.worldSeed}:${options.zoneId}:${shard}:${this.now()}:wild`);
    this.roamRng = createRng(`${deps.worldSeed}:${options.zoneId}:${shard}:${this.now()}:roam`);
    this.ghostRng = createRng(`${deps.worldSeed}:${options.zoneId}:${shard}:${this.now()}:ghost`);
    this.nemesisRng = createRng(`${deps.worldSeed}:${options.zoneId}:${shard}:${this.now()}:nemesis`);
    this.grassPatches = deps.env.WILD_ENCOUNTERS === 'grass' && this.zone.encounterTable !== null ? zonePlan(this.zone.id).grassPatches : [];
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
      // Phase D7: wild / trainer / league fights take the zone's weather, never inside an interior (halls are indoors)
      weather: (format, at, players) => {
        if (!WEATHER_FORMATS.has(format) || interiorAt(this.zone.id, at.x, at.z) !== null) return 'none';
        // weather from real life: a player who picked a city fights in its weather (a PvE battle has one player)
        const own = players.length === 1 ? (this.clientOf(players[0]!)?.userData?.realWeather ?? null) : null;
        return own ?? (this.state.weather as WeatherKind);
      },
      // nemeses: on unless NEMESES=off; a darker zone (honor shapes the world) promotes more often
      nemeses: () => (deps.env.NEMESES === 'off' ? null : { always: deps.env.NEMESES === 'always', shadow: this.state.shadow }),
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
    this.eggs = new EggWalker({
      repos: deps.repos,
      content: deps.content,
      clock: deps.clock,
      log: deps.log.child({ roomId: this.roomId, zoneId: this.zone.id, shard }),
      send: (playerId, msg) => this.sendTo(playerId, msg),
    });
    this.tower = new TowerSessions({
      repos: deps.repos,
      content: deps.content,
      clock: deps.clock,
      log: deps.log.child({ roomId: this.roomId, zoneId: this.zone.id, shard }),
      zoneId: this.zone.id,
      battles: this.battles,
      send: (playerId, msg) => this.sendTo(playerId, msg),
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
    // breeding: an egg was collected or moved (daycare routes): the room holding the player re-reads its carried eggs
    await this.sub(EGGS_TOPIC, (m: { playerId: string }) => {
      if (this.clientOf(m.playerId) === undefined) return;
      void this.eggs
        .flush(m.playerId)
        .then(() => this.eggs.load(m.playerId))
        .catch((e: unknown) => deps.log.warn({ err: e, playerId: m.playerId }, 'egg reload failed'));
    });
    // Phase D13 ranked queue: matches (every room: move the players it hosts), cancels, and this room's arena matches
    await this.sub(RANKED_MATCH_TOPIC, (m: RankedMatch) => void this.onRankedMatch(m));
    await this.sub(RANKED_CANCEL_TOPIC, (m: RankedCancel) => this.onRankedCancel(m));
    await this.sub(rankedArenaTopic(this.roomId), (m: RankedMatch) => this.rankedArena.add(m));
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
    // a join with no position of its own in this zone lands on the zone's arrival point (content `arrivalPoint`: a
    // town's plaza, facing its centre; Mirevale's and every other zone's spawn), as fast travel and the rope do
    const land = arrivalPoint(this.zone.id);
    let x: number;
    let z: number;
    let facing: number | null = null;
    let fallback = false;
    if (existing !== undefined) {
      x = existing.x;
      z = existing.z;
    } else if (arrival !== null) {
      x = arrival.x;
      z = arrival.z;
      // a fast-travel arrival is the arrival point itself (an edge entry never is: it stands 6.5 m inside an edge)
      if (x === land.x && z === land.z) facing = land.angle;
    } else if (row.zoneId === this.zone.id) {
      x = row.x;
      z = row.z;
    } else {
      x = land.x;
      z = land.z;
      facing = land.angle;
      fallback = true;
    }
    if (!isWalkable(this.heightfield, x, z)) {
      const snapped = nearestWalkable(this.heightfield, x, z, 8) ?? nearestWalkable(this.heightfield, land.x, land.z, 8);
      x = snapped?.[0] ?? land.x;
      z = snapped?.[1] ?? land.z;
      fallback = true;
    }

    // 4. PlayerState (reused on takeover)
    const ps = existing ?? new PlayerState();
    if (existing === undefined) {
      ps.id = playerId;
      ps.name = username;
      ps.x = x;
      ps.z = z;
      ps.angle = facing ?? (row.zoneId === this.zone.id ? row.angle : 0);
      ps.body = row.body;
      ps.guildTag = loaded.guildTag ?? '';
      this.state.players.set(playerId, ps);
    } else {
      // A takeover is always a NEW client (a reload or a second tab; a Colyseus reconnection never reaches onJoin),
      // and a new client counts input seqs from 1. Keeping the old socket's seq as the stale baseline froze a
      // reload inside the 20 s window until the new count caught up; the echoed seq restarts at 0 with it so the
      // client's reconciler (which ignores acks below its last one) accepts the first new ack.
      ps.seq = 0;
    }
    this.owner.set(playerId, client.sessionId);

    this.meterClient(client);
    // 5. view + userData; the first tick computes the cell and adds the 3×3
    client.view = new StateView();
    client.view.add(ps);
    const flags = flagSet(loaded.flags, loaded.badges);
    client.userData = {
      playerId,
      cell: null,
      lastSeq: 0,
      budgetMs: 0,
      lastInputAt: this.now(),
      battleId: this.battles.ofPlayer(playerId)?.id ?? null,
      tradeId: null,
      limiter: createLimiterState(),
      flags,
      // join and handover arrival alike (both land here): the gate list starts from the loaded flags
      closedGates: this.closedGatesFor(flags),
      clearedObstacles: this.clearedObstaclesFor(flags),
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
      fastTravelReadyAt: arrival !== null ? this.now() + FAST_TRAVEL_COOLDOWN_MS : 0,
      encounterGraceM: ENCOUNTER_GRACE_M,
      spotted: null,
      sightQuietUntil: 0,
      weatherCity: row.weatherCity ?? null,
      realWeather: null,
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
    // Phase C3: the first join of this zone (fresh join or handover arrival) writes `visited:<zone>` (world map, fast travel)
    if (!client.userData.flags.has(visitedFlag(this.zone.id))) void this.markVisited(client, playerId);

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
    // verified speedruns: the play clock runs while a room holds the player (a handover keeps the running clock)
    await deps.repos.db.transaction((tx) => deps.repos.runs.start(tx, playerId, new Date(deps.clock()))).catch((e: unknown) => deps.log.error({ err: e, playerId }, 'play clock start failed'));
    // weather from real life: the city's weather (the cached answer at once, else one lookup)
    void this.refreshRealWeather(client);
    // ghost trainers: how the player's ghost fared while they were away
    void this.ghostWelcome(client, playerId);
    // breeding: the eggs the player carries count the steps walked here
    void this.eggs.load(playerId).catch((e: unknown) => deps.log.warn({ err: e, playerId }, 'egg load failed'));
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
    // breeding: the metres walked here are written before the player goes
    await this.eggs.drop(playerId).catch((e: unknown) => deps.log.error({ err: e }, 'egg drop failed'));
    // Phase D14: leaving ends a tower run (current 0, best kept)
    await this.tower.onLeave(playerId).catch((e: unknown) => deps.log.error({ err: e }, 'tower onLeave failed'));
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
    // Phase D13: a real leave (not a crossing) drops the queue entry and stops a ranked match waiting here
    if (!movedAway) {
      void deps.matchQueue.leave(playerId).catch((e: unknown) => deps.log.warn({ err: e, playerId }, 'ranked queue leave failed'));
      // arena PvP: leaving the world for good (not for an arena room: matched players are already out of the queue)
      if (deps.presenceStore.get(playerId)?.arena !== true) void deps.arena.queue.leave(playerId).catch((e: unknown) => deps.log.warn({ err: e, playerId }, 'arena queue leave failed'));
      const pending = this.rankedArena.involving(playerId);
      if (pending !== null) this.rankedArena.cancel(pending.match.matchId, playerId);
    }
    if (ps !== undefined && !movedAway) {
      await deps.repos.db
        .transaction((tx) => deps.repos.players.setPosition(tx, playerId, this.zone.id, ps.x, ps.z, ps.angle))
        .catch((e: unknown) => deps.log.error({ err: e, playerId }, 'leave position write failed'));
    }
    // ghost trainers: leaving the world for good (not a crossing, not an arena) leaves the party behind as a ghost here
    if (!movedAway && deps.presenceStore.get(playerId)?.arena !== true) {
      const name = client.auth?.username;
      if (name !== undefined) {
        await deps.repos.db
          .transaction(async (tx) => deps.repos.ghosts.save(tx, playerId, name, this.zone.id, await deps.repos.creatures.party(tx, playerId), new Date(deps.clock())))
          .catch((e: unknown) => deps.log.error({ err: e, playerId }, 'ghost save failed'));
      }
    }
    // verified speedruns: leaving the world stops the play clock (a crossing hands it to the next room running)
    if (!movedAway) {
      await deps.repos.db
        .transaction((tx) => deps.repos.runs.stop(tx, playerId, new Date(deps.clock())))
        .catch((e: unknown) => deps.log.error({ err: e, playerId }, 'play clock stop failed'));
    }
  }

  override onDispose(): void {
    this.spawns?.dispose();
    this.battles?.dispose();
    this.trades?.dispose();
    this.tower?.dispose();
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
    const dm = (m: DmPush): void => this.sendTo(playerId, { type: 'dm', id: m.id, fromId: m.fromId, fromName: m.fromName, text: m.text, sentAt: m.sentAt });
    const arena = (m: ServerMessage): void => this.sendTo(playerId, m);
    // weather from real life: POST /weather/city publishes the new city here
    const weather = (city: WeatherCity | null): void => {
      const c = this.clientOf(playerId);
      if (c?.userData === undefined) return;
      c.userData.weatherCity = city;
      c.userData.realWeather = null;
      this.sendMsg(c, { type: 'realWeather', kind: null });
      void this.refreshRealWeather(c);
    };
    this.dmSubs.set(playerId, { dm, arena, weather });
    void this.presence.subscribe(`ewa:dm:${playerId}`, dm);
    void this.presence.subscribe(arenaTopic(playerId), arena);
    void this.presence.subscribe(weatherTopic(playerId), weather);
  }

  private unsubscribePlayer(playerId: string): void {
    const cb = this.dmSubs.get(playerId);
    if (cb === undefined) return;
    this.dmSubs.delete(playerId);
    this.presence.unsubscribe(`ewa:dm:${playerId}`, cb.dm);
    this.presence.unsubscribe(arenaTopic(playerId), cb.arena);
    this.presence.unsubscribe(weatherTopic(playerId), cb.weather);
  }

  /**
   * One roaming legendary per season: while the season's roamer is on this route and nobody has caught it, an encounter
   * meets it with ROAMER_CHANCE (drawn from its own stream); null otherwise.
   */
  roamerEncounter(medium: 'land' | 'water', x: number, z: number): SpawnRecord | null {
    const now = this.now();
    const season = seasonAt(now).number;
    if (season < 1 || roamerZoneAt(season, now) !== this.zone.id) return null;
    if (this.roamerCaught === null || this.roamerCaught.season !== season || this.roamerCaught.caught) return null;
    if (this.roamRng!.next() >= ROAMER_CHANCE) return null;
    const speciesId = roamerOf(season);
    return {
      id: `${this.zone.id}:roamer:${season}:${this.wildCounter}`,
      speciesId,
      level: ROAMER_LEVEL,
      variantKey: 'normal',
      isAlpha: false,
      ability: this.deps.content.species(speciesId).abilities[0]!,
      medium,
      x,
      z,
      bornAt: now,
      engagedBy: null,
      engagedAt: null,
      despawnAt: now + 60_000,
    };
  }

  /** Honor shapes the world: the zone's shadow level this season (state.shadow, written only when it changes). */
  private async readShadow(now: number): Promise<void> {
    this.shadowReading = true;
    try {
      const deps = this.deps;
      const season = seasonAt(now).number;
      const t = await deps.repos.db.transaction((tx) => deps.repos.worldHonor.of(tx, season, this.zone.id));
      const level = shadowLevel(t.light, t.shadow);
      if (this.state.shadow !== level) this.state.shadow = level;
      // one roaming legendary per season: whether the season's roamer has been caught (read on the same minute)
      const legend = await deps.repos.db.transaction((tx) => deps.repos.legends.of(tx, season));
      this.roamerCaught = { season, caught: legend !== null };
      // ghost trainers: this zone's recent ghosts
      this.ghosts = await deps.repos.db.transaction((tx) => deps.repos.ghosts.recent(tx, this.zone.id, new Date(now - GHOST_DAYS * 86_400_000), GHOSTS_PER_ZONE));
    } catch (e) {
      this.deps.log.warn({ err: e }, 'shadow read failed');
    } finally {
      this.shadowReading = false;
    }
  }

  /** Weather from real life: the player's city's weather (one lookup when the cache has none), sent when it changes. */
  private async refreshRealWeather(client: ZoneClient): Promise<void> {
    const ud = client.userData;
    if (ud === undefined || ud.weatherCity === null) return;
    const city = ud.weatherCity;
    const kind = await this.deps.realWeather.lookup(city).catch(() => null);
    if (client.userData !== ud || ud.weatherCity !== city || kind === null || kind === ud.realWeather) return;
    ud.realWeather = kind;
    this.sendMsg(client, { type: 'realWeather', kind });
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
    this.sendMsg(client, progressionOnly({ trainerExp: g.trainerExp, trainerLevel: g.trainerLevel, flags: [...g.flags], ...(g.questProgress.length > 0 ? { questProgress: [...g.questProgress] } : {}) }));
    this.sendMsg(client, { type: 'toast', level: 'success', text: `Daily login — day ${g.streak} streak` });
  }

  /** Phase C3: persists `visited:<zone>` once, through `applyFlags`, and tells the client (progressionDelta). */
  private async markVisited(client: ZoneClient, playerId: string): Promise<void> {
    const deps = this.deps;
    const flag = visitedFlag(this.zone.id);
    const ok = await deps.repos.db
      .transaction((tx) => deps.repos.progress.setFlags(tx, playerId, [flag], new Date(this.now())))
      .then(() => true)
      .catch((e: unknown) => {
        deps.log.warn({ err: e, playerId, flag }, 'visited flag write failed');
        return false;
      });
    if (!ok || client.userData === undefined || client.userData.flags.has(flag)) return;
    this.applyFlags(client.userData, [flag]);
    this.sendMsg(client, progressionOnly({ flags: [flag] }));
  }

  private async leadLevel(playerId: string): Promise<number> {
    const deps = this.deps;
    const party = await deps.repos.db.transaction((tx) => deps.repos.creatures.party(tx, playerId));
    return party.find((c) => c.hp > 0)?.level ?? 0;
  }

  /**
   * §30.6.3 escape rope: authoritative teleport to the zone's arrival point (content `arrivalPoint`; on a route — the
   * only place the rope works — that is its spawn), snapped, not during a battle.
   */
  private onTeleport(playerId: string): void {
    const c = this.clientOf(playerId);
    const ps = this.state.players.get(playerId);
    if (c?.userData === undefined || ps === undefined || c.userData.battleId !== null) return;
    const land = arrivalPoint(this.zone.id);
    const p = isWalkable(this.heightfield, land.x, land.z) ? ([land.x, land.z] as const) : nearestWalkable(this.heightfield, land.x, land.z, 8);
    if (p === null) return;
    ps.x = p[0];
    ps.z = p[1];
    ps.angle = land.angle;
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

  /** Phase D6: a `battleAction` for position 1 from a player in a doubles battle (its own limiter window). */
  private doublesSecondPosition(playerId: string, payload: unknown): boolean {
    if (payload === null || typeof payload !== 'object' || (payload as { pos?: unknown }).pos !== 1) return false;
    return this.battles.ofPlayer(playerId)?.state.slots === 2;
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
    const key = type === 'battleAction' && this.doublesSecondPosition(ud.playerId, payload) ? 'battleActionPos1' : roomLimitKey(type);
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
        case 'fastTravel':
          return this.onFastTravel(client, data);
        case 'fish':
          return this.onFish(client, data);
        case 'tower':
          return this.onTower(client, data);
        case 'rankedQueue':
          return this.onRankedQueue(client, data);
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
    // Phase D11: the bike cap needs the bicycle and an outdoor start (halls are interiors)
    const canBike = input.bike === true && (ud.inventory[BIKE_ITEM] ?? 0) > 0 && interiorAt(this.zone.id, ps.x, ps.z) === null;
    const verdict = validateInput(
      {
        x: ps.x, z: ps.z, lastSeq: ud.lastSeq, budgetMs: ud.budgetMs, inBattle: ud.battleId !== null || ud.spotted !== null, canSurf: (ud.inventory[SURF_ITEM] ?? 0) > 0,
        closedGates: ud.closedGates, clearedObstacles: ud.clearedObstacles, canBike,
      },
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
      // Phase D8 / D11: remote avatars ride at water level / on the bicycle (written only on change)
      const surfing = onOpenWater(this.heightfield, verdict.x, verdict.z);
      if (ps.surfing !== surfing) ps.surfing = surfing;
      if (ps.biking !== verdict.bike) ps.biking = verdict.bike;
      ps.moving = dist > 0.001;
      ps.seq = input.seq;
      ud.lastSeq = input.seq;
      ud.lastInputAt = this.now();
      ud.moved = true;
      // breeding: carried eggs count the metres walked
      this.eggs.step(ud.playerId, dist, ud.flags);
      if (ud.repel !== null) {
        ud.repel.steps -= dist;
        if (ud.repel.steps <= 0) {
          ud.repel = null;
          this.sendMsg(client, { type: 'toast', level: 'info', text: 'The repel wore off.' });
        }
      }
      // a trainer who sees the player goes first; otherwise the grass (or the water) may roll
      if (!this.checkSight(client, ud, ps)) this.wildStep(client, ud, ps, dist);
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
    // a trainer saw the player: only its fight may start now, wherever it stands (the client walked it up)
    const spotted = ud.spotted !== null && !ud.spotted.checking && m.kind === 'npc' && ud.spotted.trainerId === m.targetId;
    if (ud.spotted !== null && !spotted) return this.sendMsg(client, { type: 'error', code: 'busy', detail: 'spotted' });
    if (spotted) return this.startSpotted(client, ud, ps, m.targetId);
    if (m.kind === 'healer' || m.kind === 'shop') return; // no-ops over the room (POST /heal, GET /shop/:zoneId)
    const target = findTarget(this.zone, m.kind, m.targetId, ud.flags);
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
    // every NPC / static battle (story-beat battles included) forms at the hall's arena when started inside one
    const pos = this.battleAt(ps.x, ps.z);
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
        // Phase D1: a beat's `grant` (HM Surf, Old Rod…) arrives as an inventoryDelta before the progression
        if (Object.keys(done.items).length > 0) {
          for (const [item, qty] of Object.entries(done.items)) ud.inventory[item] = qty;
          this.sendMsg(client, { type: 'inventoryDelta', items: { ...done.items }, money: null, creaturesAdded: [], creaturesRemoved: [], creaturesUpdated: [] });
        }
        this.sendMsg(client, progressionOnly({ flags: [...done.flags], questProgress: done.questProgress.length > 0 ? [...done.questProgress] : null }));
        this.sendMsg(client, { type: 'storyBeat', beatId: beat.id, phase: 'complete' });
        return;
      }
    }

    switch (target.kind) {
      case 'npc': {
        // plain conversation: nothing over the wire, except talkTo quest progress — and (Phase B2) a deliverItem
        // objective naming this npc: when the bag holds `qty`, the items are spent in the SAME transaction
        const npcId = target.npc.id;
        const r = await deps.repos.db.transaction(async (t) => {
          const events: QuestEvent[] = [{ kind: 'talkTo', npcId }];
          const spent: Record<string, number> = {};
          const short: { item: string; qty: number }[] = [];
          for (const d of await deliveriesFor(t, deps.repos, ud.playerId, npcId)) {
            const have = await deps.repos.inventory.qty(t, ud.playerId, d.item);
            if (have < d.qty) {
              short.push({ item: d.item, qty: d.qty });
              continue;
            }
            spent[d.item] = await deps.repos.inventory.add(t, ud.playerId, d.item, -d.qty);
            events.push({ kind: 'deliver', npcId, item: d.item, qty: d.qty });
          }
          return { touched: await advanceQuests(t, deps.repos, ud.playerId, events, this.now()), spent, short };
        });
        if (Object.keys(r.spent).length > 0) {
          for (const [item, qty] of Object.entries(r.spent)) ud.inventory[item] = qty;
          this.sendMsg(client, { type: 'inventoryDelta', items: r.spent, money: null, creaturesAdded: [], creaturesRemoved: [], creaturesUpdated: [] });
        }
        if (r.touched.length > 0) this.sendMsg(client, progressionOnly({ questProgress: r.touched }));
        for (const s of r.short) this.sendMsg(client, { type: 'toast', level: 'info', text: `Bring ${s.qty} × ${this.itemName(s.item)} to deliver.` });
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
        // Phase D14: after the Champion, a beaten league trainer takes a rematch once per cooldown (its own flag's set time)
        if (this.leagueBeaten(ud, target.league.id)) {
          const flag = leagueRematchFlag(target.league.id);
          const setAt = ud.flags.has(flag) ? await deps.repos.db.transaction((x) => deps.repos.progress.flagSetAt(x, ud.playerId, flag)) : null;
          if (setAt !== null && this.now() - setAt.getTime() < LEAGUE_REMATCH_COOLDOWN_DAYS * 86_400_000) {
            this.sendMsg(client, { type: 'toast', level: 'warn', text: `${target.league.name} wants a rest. Come back tomorrow for a rematch.` });
            return this.sendMsg(client, { type: 'error', code: 'notAllowed', detail: 'leagueLocked' });
          }
          const res = await this.battles.startNpc(seat, { kind: 'league', league: target.league, rematch: leagueRematch(target.league.id) }, null, pos);
          if (!res.ok) this.sendMsg(client, { type: 'error', code: res.code, detail: res.detail });
          return;
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
        if (!this.teleport(ud, ps, w.toX, w.toZ)) return this.sendMsg(client, { type: 'error', code: 'notAllowed', detail: 'warpBlocked' });
        return;
      }
      case 'switch': {
        // Phase A puzzle switch: `requires` gates it; `sets` is written once; `warpTo` teleports every time
        const sw = target.sw;
        if (!sw.requires.every((f) => ud.flags.has(f))) {
          this.sendMsg(client, { type: 'toast', level: 'warn', text: 'Nothing happens. Something else must come first.' });
          return this.sendMsg(client, { type: 'error', code: 'notAllowed', detail: 'switchLocked' });
        }
        const flag = sw.sets;
        if (flag !== null && !ud.flags.has(flag)) {
          await deps.repos.db.transaction((t) => deps.repos.progress.setFlags(t, ud.playerId, [flag], new Date(this.now())));
          this.applyFlags(ud, [flag]);
          this.sendMsg(client, progressionOnly({ flags: [flag] }));
        }
        if (sw.warpTo !== null && !this.teleport(ud, ps, sw.warpTo.x, sw.warpTo.z)) return this.sendMsg(client, { type: 'error', code: 'notAllowed', detail: 'warpBlocked' });
        return;
      }
      case 'obstacle':
        return this.clearObstacle(client, ud, target.obstacle);
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

  /**
   * §30.4.4 league order rules; null = may challenge. Already beaten → refused (no rematch in v1). Plus the story
   * gate content carries (story-bible §6.1: `verdant_gym` needs `saw_thinning`, so the gym's pre-fight beat
   * `grove_stone` plays before the fight — IMPLEMENTATION-NOTES S13).
   */
  private leagueRefusal(ud: ZoneUserData, leagueId: string): string | null {
    const lt = leagueById(leagueId);
    // Phase D14 post-game: once the Champion has fallen, a beaten trainer is a rematch (the cooldown is the caller's)
    if (this.leagueBeaten(ud, leagueId)) return null;
    const gate = leagueStoryGate(lt.id);
    if (lt.stage === 'gym' && lt.badge !== null && ud.badges.includes(lt.badge)) return 'You already hold this badge.';
    if (gate !== null && !ud.flags.has(gate)) return `${lt.name} is not taking challengers yet.`;
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

  /**
   * Phase D14: the player holds `champion:zeon:beaten` and has beaten this league trainer (its badge held, or its
   * `setsFlags` / the champion flag) — the interaction is a rematch. Never true before the Champion falls.
   */
  private leagueBeaten(ud: ZoneUserData, leagueId: string): boolean {
    if (!ud.flags.has(POSTGAME_FLAG)) return false;
    const lt = leagueById(leagueId);
    if (lt.stage === 'gym') return lt.badge !== null && ud.badges.includes(lt.badge);
    const flags = lt.id === 'zeon' ? [...lt.setsFlags, POSTGAME_FLAG] : lt.setsFlags;
    return flags.length > 0 && flags.every((f) => ud.flags.has(f));
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

  /** Display name of an item id for toasts (falls back to the id). */
  private itemName(id: string): string {
    try {
      return this.deps.content.item(id).name;
    } catch (_e) {
      return id;
    }
  }

  /** The ONLY writer of `ud.flags` after join: adds the flags and, when one is new, recomputes the closed gates. */
  private applyFlags(ud: ZoneUserData, flags: readonly string[]): void {
    let changed = false;
    let obstacle = false;
    for (const f of flags) {
      if (ud.flags.has(f)) continue;
      ud.flags.add(f);
      changed = true;
      if (f.startsWith(OBSTACLE_PREFIX)) obstacle = true;
    }
    if (changed && ud.closedGates.length > 0) ud.closedGates = this.closedGatesFor(ud.flags);
    if (obstacle) ud.clearedObstacles = this.clearedObstaclesFor(ud.flags);
  }

  /** Phase D10: this zone's obstacles `flags` say the player cleared (the shared empty set when none). */
  private clearedObstaclesFor(flags: ReadonlySet<string>): ReadonlySet<string> {
    const list = this.zone.obstacles ?? [];
    if (list.length === 0) return NO_CLEARED;
    const out = new Set<string>();
    for (const o of list) if (flags.has(obstacleFlag(this.zone.id, o.id))) out.add(o.id);
    return out.size === 0 ? NO_CLEARED : out;
  }

  /**
   * Phase D10 `interact { kind: 'obstacle' }` (range already checked): refused once cleared (`alreadyCleared`), without
   * the HM (`needHm`) or a party member of a suitable type (`needType`) — each with a toast. Otherwise the flag (and the
   * hidden item, once) in one transaction, then the same deltas as a ground item; movement accepts its samples from now.
   */
  private async clearObstacle(client: ZoneClient, ud: ZoneUserData, o: NonNullable<ZoneDef['obstacles']>[number]): Promise<void> {
    const deps = this.deps;
    const flag = obstacleFlag(this.zone.id, o.id);
    if (ud.flags.has(flag)) return this.sendMsg(client, { type: 'error', code: 'notAllowed', detail: 'alreadyCleared' });
    const party = await deps.repos.db.transaction((t) => deps.repos.creatures.party(t, ud.playerId));
    const types = party.map((c) => {
      try {
        return deps.content.species(c.speciesId).types as readonly string[];
      } catch (_e) {
        return [] as readonly string[];
      }
    });
    const why = obstacleRefusal(o.kind, ud.inventory, types);
    if (why !== null) {
      this.sendMsg(client, { type: 'toast', level: 'warn', text: obstacleRefusalText(o.kind, why) });
      return this.sendMsg(client, { type: 'error', code: 'notAllowed', detail: why });
    }
    const r = await deps.repos.db.transaction(async (t) => {
      if ((await deps.repos.progress.flagSetAt(t, ud.playerId, flag)) !== null) return null;
      await deps.repos.progress.setFlags(t, ud.playerId, [flag], new Date(this.now()));
      const items: Record<string, number> = {};
      if (o.item !== undefined) items[o.item.item] = await deps.repos.inventory.add(t, ud.playerId, o.item.item, o.item.qty);
      return items;
    });
    if (r === null) return this.sendMsg(client, { type: 'error', code: 'notAllowed', detail: 'alreadyCleared' });
    this.applyFlags(ud, [flag]);
    if (Object.keys(r).length > 0) {
      for (const [item, qty] of Object.entries(r)) ud.inventory[item] = qty;
      this.sendMsg(client, { type: 'inventoryDelta', items: r, money: null, creaturesAdded: [], creaturesRemoved: [], creaturesUpdated: [] });
    }
    this.sendMsg(client, progressionOnly({ flags: [flag] }));
    const found = o.item === undefined ? '' : ` Something was hidden behind it: ${this.itemName(o.item.item)}${o.item.qty > 1 ? ` x${o.item.qty}` : ''}.`;
    this.sendMsg(client, { type: 'toast', level: 'success', text: `${o.kind === 'tree' ? 'The tree was cut down.' : 'The boulder was pushed aside.'}${found}` });
  }

  /**
   * Phase D9 `fish { angle }`: the Old Rod in the bag (`noRod`), not in a hall, and open water (non-lava) within
   * FISH_REACH_M of the ACCEPTED position along `angle` (`noWater`); then one of the zone's water slots from the fishing
   * stream (`nothingBites` when the table has none for this time of day), started as a wild battle at the player.
   */
  /** Phase D14: `tower { start | next | quit }` — the run lives in `TowerSessions` (refusals, streak, rewards). */
  private async onTower(client: ZoneClient, m: ClientPayload<'tower'>): Promise<void> {
    const ud = client.userData!;
    const ps = this.state.players.get(ud.playerId);
    if (ps === undefined) return;
    if (m.action === 'quit') return this.tower.quit(ud.playerId);
    const asker = {
      seat: { playerId: ud.playerId, sessionId: client.sessionId },
      flags: ud.flags,
      x: ps.x,
      z: ps.z,
      busy: ud.battleId !== null || ud.tradeId !== null,
      at: this.battleAt(ps.x, ps.z),
    };
    return m.action === 'start' ? this.tower.start(asker, m.picks) : this.tower.next(asker);
  }

  private async onFish(client: ZoneClient, m: ClientPayload<'fish'>): Promise<void> {
    const ud = client.userData!;
    const ps = this.state.players.get(ud.playerId);
    if (ps === undefined) return;
    if (ud.battleId !== null || ud.tradeId !== null || this.raid?.isParticipant(ud.playerId) === true) return this.sendMsg(client, { type: 'error', code: 'busy', detail: 'inBattle' });
    const refuse = (detail: FishRefusal, text: string): void => {
      this.sendMsg(client, { type: 'toast', level: 'info', text });
      this.sendMsg(client, { type: 'error', code: 'notAllowed', detail });
    };
    if ((ud.inventory[ROD_ITEM] ?? 0) <= 0) return refuse('noRod', 'You need a fishing rod.');
    const water = interiorAt(this.zone.id, ps.x, ps.z) === null ? this.waterAhead(ps.x, ps.z, m.angle) : null;
    if (water === null) return refuse('noWater', 'There is no water to fish in here.');
    this.fishCounter += 1;
    const id = `${this.zone.id}:fish:${this.fishCounter}`;
    const rec = rollFishing(encounterTableFor(this.zone.id), this.fishRng!, this.deps.content, this.state.timeOfDay, water, id, this.now(), this.spawns?.liveOps, client.userData?.realWeather ?? null, this.state.shadow);
    if (rec === null) return refuse('nothingBites', 'Not even a nibble. Nothing seems to live in this water.');
    ud.battleId = 'pending';
    const res = await this.battles.startWild({ playerId: ud.playerId, sessionId: client.sessionId }, rec, { x: ps.x, z: ps.z }).catch((e: unknown) => {
      this.deps.log.error({ err: e }, 'startWild (fish) failed');
      return { ok: false as const, code: 'internal' as const, detail: 'startFailed' };
    });
    if (!res.ok) {
      if (ud.battleId === 'pending') ud.battleId = null;
      this.sendMsg(client, { type: 'error', code: res.code, detail: res.detail });
    }
  }

  // ─── tall grass and trainer sight (encounters.ts) ──────────────────────────────

  /**
   * Trainer sight after an accepted move: the nearest unbeaten trainer within SIGHT_M with a clear line holds the
   * player (true; the grass does not roll then). Once the party read says the player can fight, `trainerSpotted` goes
   * out and the client plays the approach; with no usable creature the trainer looks away for SPOT_QUIET_MS.
   */
  private checkSight(client: ZoneClient, ud: ZoneUserData, ps: PlayerState): boolean {
    if (ud.spotted !== null) return true;
    if (this.deps.env.TRAINER_SIGHT !== 'on' || this.now() < ud.sightQuietUntil) return false;
    if (ud.battleId !== null || ud.tradeId !== null || ud.handover !== null || this.raid?.isParticipant(ud.playerId) === true) return false;
    const room = interiorAt(this.zone.id, ps.x, ps.z)?.def.id ?? null;
    const t = spotter(
      this.sightTrainers(),
      (x) => this.sightEligible(ud, x),
      this.heightfield,
      ud.closedGates,
      ps.x,
      ps.z,
      (x) => (interiorAt(this.zone.id, x.x, x.z)?.def.id ?? null) === room,
    );
    if (t === null) return false;
    const spotted = { trainerId: t.id, at: this.now(), checking: true };
    ud.spotted = spotted;
    ps.moving = false;
    const lookAway = (): void => {
      if (ud.spotted !== spotted) return;
      ud.spotted = null;
      ud.sightQuietUntil = this.now() + SPOT_QUIET_MS;
    };
    void this.leadLevel(ud.playerId)
      .then((lead) => {
        if (ud.spotted !== spotted) return;
        if (lead <= 0) return lookAway();
        spotted.checking = false;
        spotted.at = this.now();
        this.sendMsg(client, { type: 'trainerSpotted', trainerId: t.id });
      })
      .catch(lookAway);
    return true;
  }

  private sightList: readonly TrainerDef[] | null = null;

  /** The zone's trainers and its halls' (world coordinates). */
  private sightTrainers(): readonly TrainerDef[] {
    this.sightList ??= [...this.zone.trainers, ...interiorTrainers(this.zone.id)];
    return this.sightList;
  }

  /** Unbeaten (a rematch stays a conversation), and a story trainer only while its beat is the zone's next (rule 6). */
  private sightEligible(ud: ZoneUserData, t: TrainerDef): boolean {
    if (ud.flags.has(trainerBeatenFlag(t.id))) return false;
    return !isStoryTrainer(t.id) || storyTrainerBeat(this.zone.id, ud.flags, t.id) !== null;
  }

  /**
   * The spotted trainer's fight, wherever it stands: its story beat when one names it (§30.4.8 rule 6), else the plain
   * fight: onInteract's paths without the range check. The hold ends when the start resolves.
   */
  private async startSpotted(client: ZoneClient, ud: ZoneUserData, ps: PlayerState, trainerId: string): Promise<void> {
    const spotted = ud.spotted;
    const t = this.sightTrainers().find((x) => x.id === trainerId);
    if (spotted === null || t === undefined || !this.sightEligible(ud, t)) {
      ud.spotted = null;
      return;
    }
    spotted.checking = true;
    const seat = { playerId: ud.playerId, sessionId: client.sessionId };
    const beat = storyTrainerBeat(this.zone.id, ud.flags, t.id);
    if (beat !== null) this.sendMsg(client, { type: 'storyBeat', beatId: beat.id, phase: 'start' });
    const res = await this.battles.startNpc(seat, { kind: 'trainer', trainer: t, rematch: false }, beat?.id ?? null, this.battleAt(ps.x, ps.z)).catch((e: unknown) => {
      this.deps.log.error({ err: e }, 'startNpc (spotted) failed');
      return { ok: false as const, code: 'internal' as const, detail: 'startFailed' };
    });
    if (ud.spotted === spotted) ud.spotted = null;
    if (!res.ok) {
      ud.sightQuietUntil = this.now() + SPOT_QUIET_MS;
      this.sendMsg(client, { type: 'error', code: res.code, detail: res.detail });
    }
  }

  /**
   * WILD_ENCOUNTERS=grass: `dist` metres walked inside a tall-grass patch (or surfed on open water) roll an encounter at
   * GRASS_RATE_PER_M (SURF_RATE_PER_M), doubled by a lure, after the grace metres. The creature comes from the zone's
   * `land` (`water`) slots with the fishing bite's draws and is held by the battle alone (never a visible spawn).
   */
  private wildStep(client: ZoneClient, ud: ZoneUserData, ps: PlayerState, dist: number): void {
    if (this.deps.env.WILD_ENCOUNTERS !== 'grass' || dist <= 0 || this.zone.encounterTable === null) return;
    if (ud.battleId !== null || ud.tradeId !== null || ud.handover !== null || this.raid?.isParticipant(ud.playerId) === true) return;
    const medium = ps.surfing ? 'water' : inTallGrass(this.grassPatches, ps.x, ps.z) ? 'land' : null;
    if (medium === null || interiorAt(this.zone.id, ps.x, ps.z) !== null) return;
    if (ud.encounterGraceM > 0) {
      ud.encounterGraceM -= dist;
      return;
    }
    const rate = (medium === 'land' ? GRASS_RATE_PER_M : SURF_RATE_PER_M) * (ud.repel?.kind === 'lure' ? LURE_FACTOR : 1);
    if (this.wildRng!.next() >= encounterChance(dist, rate)) return;
    this.wildCounter += 1;
    const id = `${this.zone.id}:wild:${this.wildCounter}`;
    // ghost trainers: in tall grass, now and then, another trainer's ghost steps out instead (its own stream)
    const roaming = this.deps.env.ROAMING_ENCOUNTERS === 'on';
    const ghost = roaming && medium === 'land' ? this.ghostEncounter(ud.playerId) : null;
    if (ghost !== null) {
      ud.encounterGraceM = ENCOUNTER_GRACE_M;
      ud.battleId = 'pending';
      ps.moving = false;
      void this.startGhostEncounter(client, ud, ps, ghost, id, medium);
      return;
    }
    // one roaming legendary per season: on its route, now and then, the encounter is the roamer
    const roamer = roaming ? this.roamerEncounter(medium, ps.x, ps.z) : null;
    // nemeses: now and then (more often in a darker zone) one of the player's nemeses born elsewhere ambushes them
    if (roamer === null && this.nemesisAmbushRoll()) {
      ud.encounterGraceM = ENCOUNTER_GRACE_M;
      ud.battleId = 'pending';
      ps.moving = false;
      void this.startNemesisEncounter(client, ud, ps, id, medium);
      return;
    }
    // weather from real life: the player's own weather favours its types (no bias without a city)
    const rec = roamer ?? rollWild(encounterTableFor(this.zone.id), medium, this.wildRng!, this.deps.content, this.state.timeOfDay, { x: ps.x, z: ps.z }, id, this.now(), this.spawns?.liveOps, ud.realWeather, this.state.shadow);
    if (rec === null) return;
    ud.encounterGraceM = ENCOUNTER_GRACE_M;
    ud.battleId = 'pending';
    ps.moving = false;
    void this.startEncounter(client, ud, ps, rec);
  }

  /** Ghost trainers: one of this zone's ghosts (not the player's own) with GHOST_CHANCE, else null. */
  ghostEncounter(playerId: string): Ghost | null {
    const others = this.ghosts.filter((g) => g.playerId !== playerId);
    if (others.length === 0) return null;
    if (this.ghostRng!.next() >= GHOST_CHANCE) return null;
    return others[this.ghostRng!.int(others.length)]!;
  }

  /**
   * Ghost trainers: the ghost fights if its owner is offline and its best creature is within GHOST_LEVEL_SPAN of the
   * player's lead; otherwise the grass gives a wild creature as it would have.
   */
  private async startGhostEncounter(client: ZoneClient, ud: ZoneUserData, ps: PlayerState, ghost: Ghost, id: string, medium: 'land' | 'water'): Promise<void> {
    const deps = this.deps;
    try {
      const lead = await this.leadLevel(ud.playerId);
      const owner = await deps.presenceMirror.lookup(ghost.playerId);
      if (lead > 0 && owner === null && Math.abs(ghost.topLevel - lead) <= GHOST_LEVEL_SPAN) {
        const res = await this.battles.startGhost({ playerId: ud.playerId, sessionId: client.sessionId }, { ownerId: ghost.playerId, name: ghost.name, party: ghost.party, topLevel: ghost.topLevel }, { x: ps.x, z: ps.z });
        if (res.ok) return;
      }
    } catch (e) {
      deps.log.error({ err: e }, 'ghost encounter failed');
    }
    const rec = rollWild(encounterTableFor(this.zone.id), medium, this.wildRng!, deps.content, this.state.timeOfDay, { x: ps.x, z: ps.z }, id, this.now(), this.spawns?.liveOps, ud.realWeather, this.state.shadow);
    if (rec === null) {
      if (ud.battleId === 'pending') ud.battleId = null;
      return;
    }
    await this.startEncounter(client, ud, ps, rec);
  }

  /** Nemeses: whether this encounter is an ambush try (NEMESES on: by the zone's shadow level; `always`: every one). */
  nemesisAmbushRoll(): boolean {
    const mode = this.deps.env.NEMESES;
    if (mode === 'off') return false;
    if (mode === 'always') return true;
    return this.nemesisRng!.next() < nemesisAmbushChance(this.state.shadow);
  }

  /**
   * Nemeses: one of the player's active nemeses that rose in another zone (and can come at them on this medium) ambushes
   * them, at its level held near their lead, opening with its taunt; with none, the grass gives a wild creature as it
   * would have. A repel does not keep a nemesis away.
   */
  private async startNemesisEncounter(client: ZoneClient, ud: ZoneUserData, ps: PlayerState, id: string, medium: 'land' | 'water'): Promise<void> {
    const deps = this.deps;
    try {
      const all = await deps.repos.db.transaction((tx) => deps.repos.nemeses.active(tx, ud.playerId));
      const here = all.filter((n) => n.bornZone !== this.zone.id && ambushesOn(deps.content, n, medium));
      const lead = here.length > 0 ? await this.leadLevel(ud.playerId) : 0;
      if (lead > 0) {
        const n = here[this.nemesisRng!.int(here.length)]!;
        const res = await this.battles.startWild({ playerId: ud.playerId, sessionId: client.sessionId }, this.nemesisSpawn(n, lead, medium, ps.x, ps.z), { x: ps.x, z: ps.z }, n);
        if (res.ok) {
          this.sendMsg(client, {
            type: 'nemesisAmbush',
            battleId: res.session.id,
            nemesisId: n.id,
            name: n.name,
            title: n.title,
            speciesId: n.speciesId,
            scar: n.scar as Extract<ServerMessage, { type: 'nemesisAmbush' }>['scar'],
            rank: n.rank,
            taunt: tauntOf(deps.content, n),
          });
          return;
        }
      }
    } catch (e) {
      deps.log.error({ err: e }, 'nemesis ambush failed');
    }
    const rec = rollWild(encounterTableFor(this.zone.id), medium, this.wildRng!, deps.content, this.state.timeOfDay, { x: ps.x, z: ps.z }, id, this.now(), this.spawns?.liveOps, ud.realWeather, this.state.shadow);
    if (rec === null) {
      if (ud.battleId === 'pending') ud.battleId = null;
      return;
    }
    await this.startEncounter(client, ud, ps, rec);
  }

  /** Nemeses: an ambush's spawn record (`<zone>:nemesis:<n>`, held by the battle alone like any grass encounter). */
  private nemesisSpawn(n: Nemesis, lead: number, medium: 'land' | 'water', x: number, z: number): SpawnRecord {
    const now = this.now();
    this.wildCounter += 1;
    return {
      id: `${this.zone.id}:nemesis:${this.wildCounter}`,
      speciesId: n.speciesId,
      level: nemesisFightLevel(n.level, lead),
      variantKey: n.variantKey,
      isAlpha: n.isAlpha,
      ...(n.isShiny ? { isShiny: true } : {}),
      ability: n.ability,
      medium,
      x,
      z,
      bornAt: now,
      engagedBy: null,
      engagedAt: null,
      despawnAt: now + 60_000,
    };
  }

  /** Ghost trainers: on coming back, how the player's ghost fared while they were away (each fight told once). */
  private async ghostWelcome(client: ZoneClient, playerId: string): Promise<void> {
    const deps = this.deps;
    const fights = await deps.repos.db.transaction((tx) => deps.repos.ghosts.report(tx, playerId)).catch(() => []);
    const won = fights.filter((f) => f.won).length;
    const text = ghostReport(won, fights.length - won);
    if (text !== null) this.sendMsg(client, { type: 'toast', level: 'info', text });
  }

  /** A grass / surf encounter's battle: none without a usable creature, none below the lead's level under a repel. */
  private async startEncounter(client: ZoneClient, ud: ZoneUserData, ps: PlayerState, rec: SpawnRecord): Promise<void> {
    const fail = (quietM: number): void => {
      if (ud.battleId === 'pending') ud.battleId = null;
      ud.encounterGraceM = Math.max(ud.encounterGraceM, quietM);
    };
    try {
      const lead = await this.leadLevel(ud.playerId);
      if (lead <= 0) return fail(ENCOUNTER_REFUSED_GRACE_M);
      if (ud.repel?.kind === 'repel' && rec.level < lead) return fail(0);
      const res = await this.battles.startWild({ playerId: ud.playerId, sessionId: client.sessionId }, rec, { x: ps.x, z: ps.z });
      if (!res.ok) {
        fail(ENCOUNTER_REFUSED_GRACE_M);
        if (res.detail !== 'noUsableParty') this.sendMsg(client, { type: 'error', code: res.code, detail: res.detail });
      }
    } catch (e) {
      this.deps.log.error({ err: e }, 'startWild (grass) failed');
      fail(ENCOUNTER_REFUSED_GRACE_M);
    }
  }

  /** Phase D9: the first open-water (non-lava) sample along `angle` from (x, z), within FISH_REACH_M; null when none. */
  private waterAhead(x: number, z: number, angle: number): { readonly x: number; readonly z: number } | null {
    const dx = Math.sin(angle);
    const dz = Math.cos(angle);
    for (let d = FISH_SAMPLE_M; d <= FISH_REACH_M + 1e-9; d += FISH_SAMPLE_M) {
      const wx = x + dx * d;
      const wz = z + dz * d;
      if (isWater(this.heightfield, wx, wz) && !isLava(this.heightfield, wx, wz)) return { x: wx, z: wz };
    }
    return null;
  }

  /** Phase A: the movement solids of the interior gates `flags` leave shut (the shared empty array when none). */
  private closedGatesFor(flags: ReadonlySet<string>): readonly RectSolid[] {
    if (interiorGates(this.zone.id).length === 0) return NO_GATES;
    const shut = gatesClosedFor(this.zone.id, flags);
    return shut.length === 0 ? NO_GATES : shut.map((g) => g.solid);
  }

  /** Where a battle started at (x, z) forms: the hall's room arena inside an interior, else right here. */
  private battleAt(x: number, z: number): { readonly x: number; readonly z: number; readonly yaw: number | null } {
    const a = interiorArenaFor(this.zone.id, x, z);
    return a === null ? { x, z, yaw: null } : { x: a.x, z: a.z, yaw: a.yaw };
  }

  /** Authoritative teleport (warps, warp switches), snapped to walkable ground; false when nothing walkable is near. */
  private teleport(ud: ZoneUserData, ps: PlayerState, x: number, z: number): boolean {
    const snapped = isWalkable(this.heightfield, x, z) ? ([x, z] as const) : nearestWalkable(this.heightfield, x, z, 8);
    if (snapped === null) return false;
    // the seq echo carries the client
    ps.x = snapped[0];
    ps.z = snapped[1];
    ps.moving = false;
    ud.moved = true;
    return true;
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
    const err = this.battles.action(client.userData!.playerId, m.battleId, m.turn, m.action, m.pos);
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
          this.applyFlags(c.userData, p.badges.map(badgeFlag));
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
      // Phase D13: any other battle takes a queued player out of the ranked queue
      this.dropFromRankedQueue(seat.playerId);
    }
    this.state.battles.set(session.id, summary);
    this.metrics.battles = this.battles.size;
  }

  private onBattleEnd(session: BattleSession, outcome: Parameters<BattleHost['onEnd']>[1]): void {
    this.state.battles.delete(session.id);
    // Phase D14: a tower fight hands its result (already written in the end transaction) to the run
    if (session.tower === true) void this.tower.onBattleEnd(session, outcome).catch((e: unknown) => this.deps.log.error({ err: e }, 'tower onBattleEnd failed'));
    for (const seat of session.seats) {
      if (seat.playerId === null) continue;
      const ps = this.state.players.get(seat.playerId);
      if (ps !== undefined) ps.inBattle = false;
      const c = this.clientOf(seat.playerId);
      if (c?.userData !== undefined && (c.userData.battleId === session.id || c.userData.battleId === 'pending')) c.userData.battleId = null;
      if (c?.userData !== undefined) c.userData.encounterGraceM = Math.max(c.userData.encounterGraceM, ENCOUNTER_GRACE_M);
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
    return this.challengeBlocker(fromId, toId, ignoreTrades) === null;
  }

  /**
   * The step-1 condition that fails first, naming the side it belongs to (`challengeResult.reason`, additive), or
   * null when both may battle. `tooFar` is mutual; it names the challenger (the one who has to walk back).
   */
  private challengeBlocker(fromId: string, toId: string, ignoreTrades = false): ChallengeFailReason | null {
    const a = this.state.players.get(fromId);
    const b = this.state.players.get(toId);
    const ca = this.clientOf(fromId);
    const cb = this.clientOf(toId);
    if (a === undefined || ca?.userData === undefined) return { code: 'left', playerId: fromId };
    if (b === undefined || cb?.userData === undefined) return { code: 'left', playerId: toId };
    if (a.inBattle || ca.userData.battleId !== null) return { code: 'inBattle', playerId: fromId };
    if (b.inBattle || cb.userData.battleId !== null) return { code: 'inBattle', playerId: toId };
    if (!ignoreTrades && ca.userData.tradeId !== null) return { code: 'trading', playerId: fromId };
    if (!ignoreTrades && cb.userData.tradeId !== null) return { code: 'trading', playerId: toId };
    const cell = ca.userData.cell ?? cellOf(a.x, a.z);
    if (!this.aoi.isNear(cell, toId) || Math.hypot(a.x - b.x, a.z - b.z) > CHALLENGE_RANGE_M) return { code: 'tooFar', playerId: fromId };
    return null;
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
    // step 3: re-check every condition of step 1 against current state — the accepter alone is told (spec), now
    // with the reason and the side it belongs to
    const blocker: ChallengeFailReason | null = !consumed ? { code: 'expired', playerId: m.fromId } : m.fromId === me ? { code: 'left', playerId: me } : this.challengeBlocker(m.fromId, me);
    if (blocker !== null) {
      this.sendMsg(client, { type: 'challengeResult', targetId: m.fromId, result: 'unavailable', reason: blocker });
      return;
    }
    const challenger = this.clientOf(m.fromId)!;
    const a = this.state.players.get(m.fromId)!;
    const b = this.state.players.get(me)!;
    const res = await this.battles.startPvp(
      { playerId: m.fromId, sessionId: challenger.sessionId },
      { playerId: me, sessionId: client.sessionId },
      this.battleAt((a.x + b.x) / 2, (a.z + b.z) / 2),
    );
    if (!res.ok) {
      // both players are told, with whose party / state stopped it (server finding: only the accepter was, and the
      // message could not say it was the accepter's own fainted party)
      const reason: ChallengeFailReason = { code: res.detail === 'noUsableParty' ? 'noUsableParty' : 'inBattle', playerId: res.playerId ?? me };
      this.sendMsg(client, { type: 'challengeResult', targetId: m.fromId, result: 'unavailable', reason });
      this.sendTo(m.fromId, { type: 'challengeResult', targetId: me, result: 'unavailable', reason });
    }
  }

  // ─── ranked queue (Phase D13) ───────────────────────────────────────────────

  private sendRanked(
    client: ZoneClient,
    rating: number,
    s:
      | { readonly state: 'idle'; readonly reason: RankedIdleReason }
      | { readonly state: 'queued'; readonly waitedMs: number }
      | { readonly state: 'matched'; readonly opponent: { readonly name: string; readonly rating: number } },
  ): void {
    const msg: ServerMessageOf<'rankedStatus'> = {
      type: 'rankedStatus',
      state: s.state,
      rating,
      waitedMs: s.state === 'queued' ? s.waitedMs : 0,
      window: s.state === 'queued' ? rankedWindow(s.waitedMs) : 0,
      opponent: s.state === 'matched' ? s.opponent : null,
      reason: s.state === 'idle' ? s.reason : null,
    };
    this.sendMsg(client, msg);
  }

  /** In a battle, trade, raid, crossing or an arena match already: may neither queue nor be moved to the arena. */
  private rankedBusy(ud: ZoneUserData): boolean {
    return (
      ud.battleId !== null ||
      ud.tradeId !== null ||
      ud.handover !== null ||
      ud.arrival !== null ||
      this.raid?.isParticipant(ud.playerId) === true ||
      this.rankedArena.involving(ud.playerId) !== null
    );
  }

  /**
   * `rankedQueue { join | leave }`. Join refusals (`rankedStatus idle`): `busy` (battle / trade / raid / crossing /
   * an arena match), `party` (no creature with hp > 0). A second join keeps the first entry and its wait.
   */
  private async onRankedQueue(client: ZoneClient, m: ClientPayload<'rankedQueue'>): Promise<void> {
    const deps = this.deps;
    const ud = client.userData!;
    const row = await deps.repos.db.transaction(async (tx) => ({
      player: await deps.repos.players.byId(tx, ud.playerId),
      party: m.action === 'join' ? await deps.repos.creatures.party(tx, ud.playerId) : [],
    }));
    if (client.userData === undefined || row.player === null) return;
    const rating = row.player.rating;
    if (m.action === 'leave') {
      await deps.matchQueue.leave(ud.playerId);
      return this.sendRanked(client, rating, { state: 'idle', reason: 'left' });
    }
    if (this.rankedBusy(ud)) return this.sendRanked(client, rating, { state: 'idle', reason: 'busy' });
    if (!row.party.some((c) => c.hp > 0)) return this.sendRanked(client, rating, { state: 'idle', reason: 'party' });
    const now = this.now();
    const entry = await deps.matchQueue.join({ playerId: ud.playerId, name: row.player.username, rating, joinedAt: now });
    this.sendRanked(client, entry.rating, { state: 'queued', waitedMs: Math.max(0, now - entry.joinedAt) });
  }

  private dropFromRankedQueue(playerId: string): void {
    const deps = this.deps;
    void deps.matchQueue
      .leave(playerId)
      .then(async (removed) => {
        const c = this.clientOf(playerId);
        if (!removed || c === undefined) return;
        const row = await deps.repos.db.transaction((tx) => deps.repos.players.byId(tx, playerId));
        if (row !== null) this.sendRanked(c, row.rating, { state: 'idle', reason: 'busy' });
      })
      .catch((e: unknown) => deps.log.warn({ err: e, playerId }, 'ranked queue drop failed'));
  }

  /**
   * A match was made (broadcast): each player this room hosts is told `matched` and moved to the arena — a teleport
   * when this room IS the arena room, else the handover path into that exact room. A player who became busy since
   * queueing stops the match (`busy` to them, `RANKED_CANCEL_TOPIC` for everyone else). The destination side of a
   * crossing in progress (`arrival` set) leaves the player to the source room, which still owns them.
   */
  private async onRankedMatch(m: RankedMatch): Promise<void> {
    for (const seat of m.players) {
      const c = this.clientOf(seat.playerId);
      const ud = c?.userData;
      if (c === undefined || ud === undefined || ud.arrival !== null) continue;
      const other = m.players[0].playerId === seat.playerId ? m.players[1] : m.players[0];
      const cancel = (reason: RankedIdleReason): void => {
        this.sendRanked(c, seat.rating, { state: 'idle', reason });
        const players: [string, string] = [m.players[0].playerId, m.players[1].playerId];
        this.presence.publish(RANKED_CANCEL_TOPIC, { matchId: m.matchId, playerId: seat.playerId, players } satisfies RankedCancel);
      };
      if (ud.battleId !== null || ud.tradeId !== null || ud.handover !== null || this.raid?.isParticipant(ud.playerId) === true) {
        cancel('busy');
        continue;
      }
      this.sendRanked(c, seat.rating, { state: 'matched', opponent: { name: other.name, rating: other.rating } });
      if (m.arenaRoomId === this.roomId) {
        const ps = this.state.players.get(seat.playerId);
        if (ps === undefined || !this.teleport(ud, ps, seat.x, seat.z)) cancel('cancelled');
        else ud.handoverCooldownUntil = this.now() + HANDOVER_COOLDOWN_MS;
        continue;
      }
      if (!(await this.seatHandover(c, m.zoneId, { x: seat.x, z: seat.z }, m.arenaRoomId))) cancel('cancelled');
    }
  }

  /** A match fell through: the arena room stops waiting; any room hosting the other player tells them. */
  private onRankedCancel(m: RankedCancel): void {
    this.rankedArena.cancel(m.matchId, m.playerId);
    for (const id of m.players) {
      if (id === m.playerId) continue;
      const c = this.clientOf(id);
      const ud = c?.userData;
      // mid-crossing players are told by the arena room once they land (rankedPass)
      if (c === undefined || ud === undefined || ud.arrival !== null || ud.handover !== null || ud.battleId !== null) continue;
      this.rankedArena.involving(id)?.notified.add(id);
      void this.deps.repos.db
        .transaction((tx) => this.deps.repos.players.byId(tx, id))
        .then((row) => {
          if (row !== null && this.clientOf(id) === c) this.sendRanked(c, row.rating, { state: 'idle', reason: 'cancelled' });
        })
        .catch(() => undefined);
    }
  }

  /** Tick step 9b: start each arena match whose players have both landed; expire or wind down cancelled ones. */
  private rankedPass(now: number): void {
    for (const p of this.rankedArena.list()) {
      if (p.starting) continue;
      const present = p.match.players.filter((s) => {
        const ud = this.clientOf(s.playerId)?.userData;
        return ud !== undefined && ud.arrival === null && ud.handover === null;
      });
      if (p.cancelled || now >= p.match.expiresAt) {
        for (const s of present) {
          if (p.notified.has(s.playerId)) continue;
          p.notified.add(s.playerId);
          const c = this.clientOf(s.playerId);
          if (c !== undefined && c.userData?.battleId === null) this.sendRanked(c, s.rating, { state: 'idle', reason: 'cancelled' });
        }
        if (now >= p.match.expiresAt || p.notified.size >= 2) this.rankedArena.delete(p.match.matchId);
        continue;
      }
      if (present.length === 2 && present.every((s) => this.clientOf(s.playerId)?.userData?.battleId === null)) {
        p.starting = true;
        void this.startRanked(p).catch((e: unknown) => {
          this.deps.log.error({ err: e, matchId: p.match.matchId }, 'ranked start failed');
          this.rankedArena.delete(p.match.matchId);
        });
      }
    }
  }

  /** Both players stand in the arena: the ordinary pvp start (Elo applies once per player at the end, §30.4.4). */
  private async startRanked(p: PendingRanked): Promise<void> {
    const [a, b] = p.match.players;
    const ca = this.clientOf(a.playerId);
    const cb = this.clientOf(b.playerId);
    const pa = this.state.players.get(a.playerId);
    const pb = this.state.players.get(b.playerId);
    if (ca === undefined || cb === undefined || pa === undefined || pb === undefined) {
      p.starting = false;
      return;
    }
    const res = await this.battles.startPvp(
      { playerId: a.playerId, sessionId: ca.sessionId },
      { playerId: b.playerId, sessionId: cb.sessionId },
      this.battleAt((pa.x + pb.x) / 2, (pa.z + pb.z) / 2),
    );
    this.rankedArena.delete(p.match.matchId);
    for (const [s, c] of [[a, ca], [b, cb]] as const) {
      if (c.userData === undefined) continue;
      const reason: RankedIdleReason = res.ok ? 'started' : res.detail === 'noUsableParty' && res.playerId === s.playerId ? 'party' : 'cancelled';
      this.sendRanked(c, s.rating, { state: 'idle', reason });
    }
  }

  // ─── handover (§30.2.7) ─────────────────────────────────────────────────────

  private async beginHandover(client: ZoneClient, dir: LinkDir): Promise<void> {
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
    if (!(await this.seatHandover(client, destId, entryPoint(dest, dir, ps.x, ps.z)))) {
      const [vx, vz] = LINK_VECTORS[dir];
      this.pushBack(ps, vx, vz);
      ud.moved = true;
    }
  }

  /**
   * Steps 2–5 of a crossing to `destId` at `entry` (edge crossings and Phase C3 fast travel): reserve a seat on the
   * destination, record the presence reservation it validates, send the `handover`. False when the reservation failed
   * (`ud.handover` is cleared again).
   */
  private async seatHandover(client: ZoneClient, destId: ZoneId, entry: { readonly x: number; readonly z: number }, roomId?: string): Promise<boolean> {
    const deps = this.deps;
    const ud = client.userData!;
    ud.handover = 'reserving';
    try {
      // 2. reserve on the destination (shard 0 by preference; Phase D13: a ranked match names its arena room)
      const room = roomId !== undefined ? await zoneRoomById(roomId) : await pickZoneRoom(destId, deps.ticket);
      if (room === null) throw new Error(`room ${roomId ?? destId} is gone`);
      const seat = await reserveZoneSeat(room, { zoneId: destId, shard: Number(room.metadata?.shard ?? 0), ticket: deps.ticket, handover: { fromRoomId: this.roomId, x: entry.x, z: entry.z } });
      // 3. the reservation the destination validates
      await this.presence.setex(
        `ewa:handover:${ud.playerId}`,
        JSON.stringify({ fromRoomId: this.roomId, toRoomId: seat.roomId, sessionId: seat.sessionId, x: entry.x, z: entry.z, at: this.now() }),
        10,
      );
      if (client.userData === undefined || this.clientOf(ud.playerId) !== client) return true;
      // 4. the whole ISeatReservation
      this.sendMsg(client, { type: 'handover', roomId: seat.roomId, seat, zoneId: destId, x: entry.x, z: entry.z });
      // 5.
      ud.handover = { toRoomId: seat.roomId, sentAt: this.now() };
      return true;
    } catch (e) {
      deps.log.error({ err: e, playerId: ud.playerId, dest: destId }, 'handover reservation failed');
      ud.handover = null;
      return false;
    }
  }

  /**
   * Phase C3 fast travel: a handover to a visited town's arrival point (content `arrivalPoint`: on its plaza, facing
   * the centre — not its `spawn`, which is on the west road in eight of the nine towns), free. Refused (toast + `error notAllowed <reason>`)
   * when the destination is not a town (`notTown`), not visited (`notVisited`), gated by a badge the player lacks
   * (`travelGated`), or while battling / trading / in a raid / mid-crossing (`travelBusy`), or inside the 3 s cooldown
   * (`travelCooldown`). Travelling to the zone the player stands in teleports them to its arrival point.
   */
  private async onFastTravel(client: ZoneClient, m: ClientPayload<'fastTravel'>): Promise<void> {
    const ud = client.userData!;
    const ps = this.state.players.get(ud.playerId);
    if (ps === undefined) return;
    const now = this.now();
    const dest = zoneById(m.zoneId);
    const refuse = (detail: FastTravelRefusal, text: string): void => {
      this.sendMsg(client, { type: 'toast', level: 'warn', text });
      this.sendMsg(client, { type: 'error', code: 'notAllowed', detail });
    };
    if (dest.kind !== 'town') return refuse('notTown', 'Fast travel only goes to towns.');
    if (!ud.flags.has(visitedFlag(dest.id))) return refuse('notVisited', `You have not been to ${dest.name} yet.`);
    if (dest.gate !== null && !ud.badges.includes(dest.gate)) return refuse('travelGated', `The way is barred. Badge required: ${dest.gate}`);
    if (ud.battleId !== null || ud.tradeId !== null || ud.handover !== null || this.raid?.isParticipant(ud.playerId) === true) {
      return refuse('travelBusy', 'You cannot travel right now.');
    }
    if (now < ud.fastTravelReadyAt) return refuse('travelCooldown', 'Catch your breath before travelling again.');
    ud.fastTravelReadyAt = now + FAST_TRAVEL_COOLDOWN_MS;
    const land = arrivalPoint(dest.id);
    if (dest.id === this.zone.id) {
      if (!this.teleport(ud, ps, land.x, land.z)) return refuse('travelBlocked', 'Something blocks the way.');
      ps.angle = land.angle;
      this.sendMsg(client, { type: 'toast', level: 'info', text: `Back at ${dest.name}.` });
      return;
    }
    if (!(await this.seatHandover(client, dest.id, land))) refuse('travelFailed', 'Travel failed — staying here.');
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
    // 1a. weather from real life: once a minute each player with a city reads the lookup cache (a stale place
    // refreshes in the background) and hears a change
    if (now - this.realWeatherCheckedAt >= REAL_WEATHER_CHECK_MS) {
      this.realWeatherCheckedAt = now;
      for (const c of this.clients) {
        const ud = (c as ZoneClient).userData;
        if (ud === undefined || ud.weatherCity === null) continue;
        const k = this.deps.realWeather.peek(ud.weatherCity);
        if (k !== null && k !== ud.realWeather) {
          ud.realWeather = k;
          this.sendMsg(c as ZoneClient, { type: 'realWeather', kind: k });
        }
      }
    }
    // 1a'. honor shapes the world: the zone's shadow level from its season tally, read once a minute
    if (now - this.shadowCheckedAt >= SHADOW_CHECK_MS && !this.shadowReading) {
      this.shadowCheckedAt = now;
      void this.readShadow(now);
    }
    // 1b. Phase D7 weather: one rng draw per bucket change, the field written only when it differs
    const bucket = weatherBucket(now);
    if (bucket !== this.weatherBucketAt && this.deps.env.WORLD_WEATHER !== 'off') {
      this.weatherBucketAt = bucket;
      const w = weatherAt(this.deps.worldSeed, this.zone, now);
      if (state.weather !== w) state.weather = w;
    }
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
    // 9b. Phase D13: ranked matches waiting in this arena room
    if (this.rankedArena.size > 0) this.rankedPass(now);
    // 9c. trainer sight: a spotted player whose client never sent the trainer's interact fights anyway
    for (const c of this.clients) {
      const sp = c.userData?.spotted;
      if (sp === undefined || sp === null || sp.checking || now - sp.at < SPOT_TIMEOUT_MS) continue;
      sp.at = now;
      const ps = this.state.players.get(c.userData!.playerId);
      if (ps !== undefined) void this.startSpotted(c, c.userData!, ps, sp.trainerId);
    }
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
    // WILD_ENCOUNTERS=grass: no creature stands in the overworld (the director stays for the live-ops mods it carries)
    if (this.spawns === null || this.deps.env.WILD_ENCOUNTERS === 'grass') return;
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
    st.isShiny = rec.isShiny === true;
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
