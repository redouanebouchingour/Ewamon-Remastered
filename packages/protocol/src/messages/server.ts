/**
 * §4.4 Server → client messages: the `ServerMessage` TS union (the server's contract) plus zod
 * schemas for the client side. The client MUST validate `handover` (its `seat` goes straight into
 * `sdk.consumeSeatReservation`); the rest are provided so `parseServerMessage` can guard the
 * whole union at the socket boundary.
 *
 * `progressionDelta` and `inventoryDelta` are the ONLY messages that change badges, exp, money,
 * items, creatures, dex, rating or flags on the client.
 */
import { z } from 'zod';
import type { BattleEvent, BattleFormat, BattleOutcome, BattleState, CreatureInstance, RngState } from '@ewa/core';
import { ZONE_IDS } from '../types';
import type { BadgeId, QuestProgressEntry, ZoneId } from '../types';
import {
  BadgeIdSchema,
  BattleEventSchema,
  BattleFormatSchema,
  BattleOutcomeSchema,
  BattleStateSchema,
  CreatureInstanceSchema,
  Digest,
  ItemCounts,
  RewardsSummarySchema,
  RngStateSchema,
  SeatReservationSchema,
} from './common';
import type { SeatReservation } from './common';
import { ArenaInviteMsg, ArenaInviteResultMsg, ArenaStateMsg, ArenaStatusMsg } from '../arena';
import type { ArenaServerMessage } from '../arena';

// ---- companion shapes ------------------------------------------------------------------------------

export interface TradeOffer {
  readonly playerId: string;
  readonly creatureIds: readonly string[];
  readonly money: number;
  readonly confirmed: boolean;
}

export interface RewardsSummary {
  readonly money: number;
  readonly items: Readonly<Record<string, number>>;
  readonly trainerExp: number;
  readonly ratingDelta: number | null;
  readonly badge: BadgeId | null;
}


export const SERVER_ERROR_CODES = ['rateLimited', 'invalidPayload', 'notAllowed', 'notFound', 'busy', 'internal'] as const;
export type ServerErrorCode = (typeof SERVER_ERROR_CODES)[number];

export type TradePhase = 'requested' | 'open' | 'confirming' | 'complete' | 'cancelled';
export type ChallengeResultKind = 'declined' | 'expired' | 'unavailable';
/**
 * Why an accepted challenge could not become a battle (additive, optional — older servers omit it): `code` names
 * the problem and `playerId` the side it belongs to, so each recipient can tell "your party" from "theirs".
 */
export const CHALLENGE_FAIL_CODES = ['noUsableParty', 'inBattle', 'trading', 'tooFar', 'left', 'expired'] as const;
export type ChallengeFailCode = (typeof CHALLENGE_FAIL_CODES)[number];
export interface ChallengeFailReason {
  readonly code: ChallengeFailCode;
  readonly playerId: string;
}
/** Where each of an `inventoryDelta`'s `creaturesAdded` was placed, by creature id (additive, optional). */
export type CreaturePlacement = 'party' | 'box';
export type ToastLevel = 'info' | 'success' | 'warn';
/**
 * Phase D13 ranked queue. `idle` reasons: `left` (the player left the queue), `busy` (in a battle, trade, raid or
 * crossing), `party` (no creature able to battle), `cancelled` (the match fell through: the opponent left, got busy or
 * did not reach the arena in time), `started` (the ranked battle began).
 */
export const RANKED_STATES = ['idle', 'queued', 'matched'] as const;
export type RankedState = (typeof RANKED_STATES)[number];
export const RANKED_IDLE_REASONS = ['left', 'busy', 'party', 'cancelled', 'started'] as const;
export type RankedIdleReason = (typeof RANKED_IDLE_REASONS)[number];
export type StoryBeatPhase = 'start' | 'complete';
/**
 * Phase D14 battle tower: `fighting` (a fight just started), `won` (awaiting `tower next` / `quit`), `lost` (the run is
 * over), `ended` (retired, or a pick left the party).
 */
export const TOWER_PHASES = ['fighting', 'won', 'lost', 'ended'] as const;
export type TowerPhase = (typeof TOWER_PHASES)[number];

// ---- the union -----------------------------------------------------------------------------------------

export type ServerMessage =
  | {
      readonly type: 'battleStart';
      readonly battleId: string;
      readonly format: BattleFormat;
      readonly seat: 0 | 1;
      readonly state: BattleState;
      readonly events: readonly BattleEvent[];
      readonly stateDigest: string;
      /** where the arena forms (a hall's authored arena point inside an interior, else the player's position) */
      readonly x?: number;
      readonly z?: number;
      /** the battle axis yaw inside a hall (the pocket's yaw), null/absent in the open world */
      readonly yaw?: number | null;
      /** ms left, as sent, before the server auto-acts for a seat that has not chosen (the turn timer); absent in raids */
      readonly deadlineMs?: number;
    }
  | {
      readonly type: 'battleEvents';
      readonly battleId: string;
      readonly turn: number;
      readonly events: readonly BattleEvent[];
      readonly stateDigest: string;
      readonly rng: RngState;
      /** ms left, as sent, before the server auto-acts for a seat that has not chosen (the turn timer); absent in raids */
      readonly deadlineMs?: number;
    }
  | { readonly type: 'battleResync'; readonly battleId: string; readonly state: BattleState; readonly stateDigest: string; readonly deadlineMs?: number }
  | { readonly type: 'battleEnd'; readonly battleId: string; readonly outcome: BattleOutcome; readonly rewards: RewardsSummary }
  | {
      readonly type: 'inventoryDelta';
      /** absolute counts */
      readonly items: Readonly<Record<string, number>>;
      readonly money: number | null;
      readonly creaturesAdded: readonly CreatureInstance[];
      readonly creaturesRemoved: readonly string[];
      readonly creaturesUpdated: readonly CreatureInstance[];
      /**
       * Where each `creaturesAdded` entry landed (a catch joins the party while it has room, a trade always goes to the
       * box). Optional and additive: a delta without it is placed by the client's catch rule.
       */
      readonly placement?: Readonly<Record<string, CreaturePlacement>>;
    }
  | {
      readonly type: 'progressionDelta';
      readonly badges: readonly BadgeId[] | null;
      readonly trainerExp: number | null;
      readonly trainerLevel: number | null;
      readonly rating: number | null;
      readonly dexSeen: readonly string[] | null;
      readonly dexCaught: readonly string[] | null;
      readonly flags: readonly string[] | null;
      readonly questProgress: readonly QuestProgressEntry[] | null;
    }
  | {
      readonly type: 'handover';
      readonly roomId: string;
      readonly seat: SeatReservation;
      readonly zoneId: ZoneId;
      readonly x: number;
      readonly z: number;
    }
  | { readonly type: 'challengeReceived'; readonly fromId: string; readonly fromName: string; readonly expiresInMs: number }
  | { readonly type: 'challengeResult'; readonly targetId: string; readonly result: ChallengeResultKind; readonly reason?: ChallengeFailReason }
  | {
      readonly type: 'tradeUpdate';
      readonly tradeId: string;
      readonly phase: TradePhase;
      readonly offers: readonly [TradeOffer, TradeOffer];
      readonly offerHash: string;
    }
  | { readonly type: 'raidEvents'; readonly raidId: string; readonly round: number; readonly events: readonly BattleEvent[]; readonly stateDigest: string }
  /** overworld chat, AOI-scoped, censored, never persisted (30-server-netcode.md §30.6.5) */
  | { readonly type: 'chat'; readonly id: string; readonly name: string; readonly text: string }
  /** a persisted DM pushed live (30-server-netcode.md §30.7.2) */
  | { readonly type: 'dm'; readonly id: number; readonly fromId: string; readonly fromName: string; readonly text: string; readonly sentAt: number }
  /** §3.5 runtime: the client renders the beat's `lines` on 'start' and `after` on 'complete' */
  | { readonly type: 'storyBeat'; readonly beatId: string; readonly phase: StoryBeatPhase }
  | { readonly type: 'toast'; readonly level: ToastLevel; readonly text: string }
  /**
   * A trainer saw the player (line of sight, like the old games): the server holds the player's movement until the
   * fight starts. The client plays the "!" over the trainer, walks it up and opens its lines; paging past them sends
   * `interact` for the trainer (the server starts it alone after a timeout).
   */
  | { readonly type: 'trainerSpotted'; readonly trainerId: string }
  /**
   * Weather from real life: the weather of the city the player picked (null: none picked, or no answer yet), sent on
   * joining a zone and when it changes. The client shows it instead of the zone's `weather`; the player's battles use it.
   */
  | { readonly type: 'realWeather'; readonly kind: 'none' | 'sun' | 'rain' | 'sand' | 'hail' | null }
  /**
   * Phase D13: the player's ranked-queue state, sent in answer to every `rankedQueue` and on each change (matched,
   * cancelled, started). `waitedMs` / `window` describe the queue at send time (0 when not queued); `opponent` is set
   * while `matched`; `reason` only on `idle`.
   */
  | {
      readonly type: 'rankedStatus';
      readonly state: RankedState;
      readonly rating: number;
      readonly waitedMs: number;
      readonly window: number;
      readonly opponent: { readonly name: string; readonly rating: number } | null;
      readonly reason: RankedIdleReason | null;
    }
  /**
   * Phase D14: the player's battle tower run, on every change. `set` / `fight` (1-based, fight 1..7 of the set) name
   * the fight starting, just won, lost, or next in line (`ended`); `streak` = player_streaks.current after the event (0
   * once the run is over); `runWins` = the run's wins; `best` = the best streak ever; `picks` = the run's three party
   * creature ids; `reward` = the set reward this win paid (every 7th win), else null.
   */
  | {
      readonly type: 'towerState';
      readonly phase: TowerPhase;
      readonly streak: number;
      readonly runWins: number;
      readonly best: number;
      readonly set: number;
      readonly fight: number;
      readonly picks: readonly string[];
      readonly reward: { readonly money: number; readonly items: Readonly<Record<string, number>> } | null;
    }
  /**
   * Breeding: a carried egg hatched (the server counted the steps). Sent right after the `inventoryDelta` that adds the
   * hatchling; the client plays the hatch reveal. `parents`: the parents' names as they were; `zoneId`: the Daycare's.
   */
  | {
      readonly type: 'eggHatched';
      readonly eggId: string;
      readonly creature: CreatureInstance;
      readonly placement: CreaturePlacement;
      readonly parents: readonly [string, string];
      readonly zoneId: string;
    }
  /**
   * Nemeses (content nemesis.ts): one of the player's nemeses ambushed them. Sent right after the wild `battleStart`
   * it opened (`battleId`); the client shows the taunt as a lower third over the battle.
   */
  | {
      readonly type: 'nemesisAmbush';
      readonly battleId: string;
      readonly nemesisId: string;
      readonly name: string;
      readonly title: string;
      readonly speciesId: string;
      readonly scar: NemesisScar;
      readonly rank: number;
      readonly taunt: string;
    }
  /**
   * Nemeses: what became of one after a battle (sent after its `battleEnd`): `rose` a new one, `rankUp` it beat or
   * escaped the player again, `beaten` knocked out, `caught`, `faded` pushed out by a newer one.
   */
  | {
      readonly type: 'nemesisNews';
      readonly event: NemesisEvent;
      readonly nemesisId: string;
      readonly name: string;
      readonly title: string;
      readonly speciesId: string;
      readonly scar: NemesisScar;
      readonly rank: number;
      readonly level: number;
    }
  /** arena PvP (../arena.ts): the queue state, a friend's invite, the invite's fate, the arena room's phase */
  | ArenaServerMessage
  | { readonly type: 'error'; readonly code: ServerErrorCode; readonly detail: string | null };

export type ServerMessageType = ServerMessage['type'];
export type ServerMessageOf<T extends ServerMessageType> = Extract<ServerMessage, { type: T }>;

export const SERVER_MESSAGE_TYPES = [
  'battleStart',
  'battleEvents',
  'battleResync',
  'battleEnd',
  'inventoryDelta',
  'progressionDelta',
  'handover',
  'challengeReceived',
  'challengeResult',
  'tradeUpdate',
  'raidEvents',
  'chat',
  'dm',
  'storyBeat',
  'toast',
  'trainerSpotted',
  'realWeather',
  'error',
  'rankedStatus',
  'towerState',
  'eggHatched',
  'nemesisAmbush',
  'nemesisNews',
  'arenaStatus',
  'arenaInvite',
  'arenaInviteResult',
  'arenaState',
] as const satisfies readonly ServerMessageType[];

// ---- zod (client-side validation) -------------------------------------------------------------------------

export const TradeOfferSchema = z.object({
  playerId: z.string().min(1),
  creatureIds: z.array(z.string()).max(6),
  money: z.number().int().min(0),
  confirmed: z.boolean(),
});

export const QuestProgressEntrySchema = z.object({
  questId: z.string().min(1),
  objectiveId: z.string().min(1),
  count: z.number().int().min(0),
  done: z.boolean(),
});

const BattleEvents = z.array(BattleEventSchema);

export const BattleStartMsg = z.object({
  type: z.literal('battleStart'),
  battleId: z.string().min(1),
  format: BattleFormatSchema,
  seat: z.union([z.literal(0), z.literal(1)]),
  state: BattleStateSchema,
  events: BattleEvents,
  stateDigest: Digest,
  x: z.number().finite().optional(),
  z: z.number().finite().optional(),
  yaw: z.number().finite().nullable().optional(),
  deadlineMs: z.number().int().min(0).optional(),
});
export const BattleEventsMsg = z.object({
  type: z.literal('battleEvents'),
  battleId: z.string().min(1),
  turn: z.number().int().min(1),
  events: BattleEvents,
  stateDigest: Digest,
  rng: RngStateSchema,
  deadlineMs: z.number().int().min(0).optional(),
});
export const BattleResyncServerMsg = z.object({
  type: z.literal('battleResync'),
  battleId: z.string().min(1),
  state: BattleStateSchema,
  stateDigest: Digest,
  deadlineMs: z.number().int().min(0).optional(),
});
export const BattleEndMsg = z.object({
  type: z.literal('battleEnd'),
  battleId: z.string().min(1),
  outcome: BattleOutcomeSchema,
  rewards: RewardsSummarySchema,
});
export const InventoryDeltaMsg = z.object({
  type: z.literal('inventoryDelta'),
  items: ItemCounts,
  money: z.number().int().min(0).nullable(),
  creaturesAdded: z.array(CreatureInstanceSchema),
  creaturesRemoved: z.array(z.string()),
  creaturesUpdated: z.array(CreatureInstanceSchema),
  placement: z.record(z.string().min(1), z.enum(['party', 'box'])).optional(),
});
export const ProgressionDeltaMsg = z.object({
  type: z.literal('progressionDelta'),
  badges: z.array(BadgeIdSchema).nullable(),
  trainerExp: z.number().int().min(0).nullable(),
  trainerLevel: z.number().int().min(1).max(100).nullable(),
  rating: z.number().int().nullable(),
  dexSeen: z.array(z.string()).nullable(),
  dexCaught: z.array(z.string()).nullable(),
  flags: z.array(z.string()).nullable(),
  questProgress: z.array(QuestProgressEntrySchema).nullable(),
});
/** §4.6 — the one message the client MUST validate before acting. */
export const HandoverMsg = z.object({
  type: z.literal('handover'),
  roomId: z.string().min(1),
  seat: SeatReservationSchema,
  zoneId: z.enum(ZONE_IDS),
  x: z.number(),
  z: z.number(),
});
export const ChallengeReceivedMsg = z.object({
  type: z.literal('challengeReceived'),
  fromId: z.string().min(1),
  fromName: z.string().min(1).max(20),
  expiresInMs: z.number().int().min(0),
});
export const ChallengeResultMsg = z.object({
  type: z.literal('challengeResult'),
  targetId: z.string().min(1),
  result: z.enum(['declined', 'expired', 'unavailable']),
  reason: z.object({ code: z.enum(CHALLENGE_FAIL_CODES), playerId: z.string().min(1) }).optional(),
});
export const TradeUpdateMsg = z.object({
  type: z.literal('tradeUpdate'),
  tradeId: z.string().min(1),
  phase: z.enum(['requested', 'open', 'confirming', 'complete', 'cancelled']),
  offers: z.tuple([TradeOfferSchema, TradeOfferSchema]),
  offerHash: Digest,
});
export const RaidEventsMsg = z.object({
  type: z.literal('raidEvents'),
  raidId: z.string().min(1),
  round: z.number().int().min(1),
  events: BattleEvents,
  stateDigest: Digest,
});
export const ChatServerMsg = z.object({
  type: z.literal('chat'),
  id: z.string().min(1),
  name: z.string().min(1).max(20),
  text: z.string().min(1).max(120),
});
export const DmMsg = z.object({
  type: z.literal('dm'),
  id: z.number().int().min(0),
  fromId: z.string().min(1),
  fromName: z.string().min(1).max(20),
  text: z.string().min(1).max(300),
  sentAt: z.number().int().min(0),
});
export const StoryBeatMsg = z.object({
  type: z.literal('storyBeat'),
  beatId: z.string().min(1).max(64),
  phase: z.enum(['start', 'complete']),
});
export const ToastMsg = z.object({
  type: z.literal('toast'),
  level: z.enum(['info', 'success', 'warn']),
  text: z.string().min(1).max(200),
});
export const TrainerSpottedMsg = z.object({
  type: z.literal('trainerSpotted'),
  trainerId: z.string().min(1).max(64),
});
export const RealWeatherMsg = z.object({
  type: z.literal('realWeather'),
  kind: z.enum(['none', 'sun', 'rain', 'sand', 'hail']).nullable(),
});
export const RankedStatusMsg = z.object({
  type: z.literal('rankedStatus'),
  state: z.enum(RANKED_STATES),
  rating: z.number().int(),
  waitedMs: z.number().int().min(0),
  window: z.number().int().min(0),
  opponent: z.object({ name: z.string().min(1).max(20), rating: z.number().int() }).nullable(),
  reason: z.enum(RANKED_IDLE_REASONS).nullable(),
});
export const TowerStateMsg = z.object({
  type: z.literal('towerState'),
  phase: z.enum(TOWER_PHASES),
  streak: z.number().int().min(0),
  runWins: z.number().int().min(0),
  best: z.number().int().min(0),
  set: z.number().int().min(1),
  fight: z.number().int().min(1),
  picks: z.array(z.string().min(1).max(64)).max(6),
  reward: z.object({ money: z.number().int().min(0), items: ItemCounts }).nullable(),
});
export const EggHatchedMsg = z.object({
  type: z.literal('eggHatched'),
  eggId: z.string().min(1),
  creature: CreatureInstanceSchema,
  placement: z.enum(['party', 'box']),
  parents: z.tuple([z.string().min(1).max(40), z.string().min(1).max(40)]),
  zoneId: z.string().min(1).max(32),
});
/** Nemeses: the scars (content `NEMESIS_SCARS`) and what can become of one (`nemesisNews.event`). */
export const NEMESIS_SCAR_IDS = ['burn', 'frost', 'lightning', 'venom', 'cracked_horn', 'brand', 'claw_marks', 'torn_ear'] as const;
export type NemesisScar = (typeof NEMESIS_SCAR_IDS)[number];
export const NEMESIS_EVENTS = ['rose', 'rankUp', 'beaten', 'caught', 'faded'] as const;
export type NemesisEvent = (typeof NEMESIS_EVENTS)[number];
const NemesisFields = {
  nemesisId: z.string().min(1).max(64),
  name: z.string().min(1).max(16),
  title: z.string().min(1).max(32),
  speciesId: z.string().min(1).max(32),
  scar: z.enum(NEMESIS_SCAR_IDS),
  rank: z.number().int().min(1).max(5),
};
export const NemesisAmbushMsg = z.object({
  type: z.literal('nemesisAmbush'),
  battleId: z.string().min(1),
  ...NemesisFields,
  taunt: z.string().min(1).max(200),
});
export const NemesisNewsMsg = z.object({
  type: z.literal('nemesisNews'),
  event: z.enum(NEMESIS_EVENTS),
  ...NemesisFields,
  level: z.number().int().min(1).max(100),
});
export const ErrorMsg = z.object({
  type: z.literal('error'),
  code: z.enum(SERVER_ERROR_CODES),
  detail: z.string().max(200).nullable(),
});

export const ServerMessageSchema = z.discriminatedUnion('type', [
  BattleStartMsg,
  BattleEventsMsg,
  BattleResyncServerMsg,
  BattleEndMsg,
  InventoryDeltaMsg,
  ProgressionDeltaMsg,
  HandoverMsg,
  ChallengeReceivedMsg,
  ChallengeResultMsg,
  TradeUpdateMsg,
  RaidEventsMsg,
  ChatServerMsg,
  DmMsg,
  StoryBeatMsg,
  ToastMsg,
  TrainerSpottedMsg,
  RealWeatherMsg,
  ErrorMsg,
  RankedStatusMsg,
  TowerStateMsg,
  EggHatchedMsg,
  NemesisAmbushMsg,
  NemesisNewsMsg,
  ArenaStatusMsg,
  ArenaInviteMsg,
  ArenaInviteResultMsg,
  ArenaStateMsg,
]);

/** Schemas by message type — the client picks one when it registers `room.onMessage(type, …)`. */
export const SERVER_MESSAGES = {
  battleStart: BattleStartMsg,
  battleEvents: BattleEventsMsg,
  battleResync: BattleResyncServerMsg,
  battleEnd: BattleEndMsg,
  inventoryDelta: InventoryDeltaMsg,
  progressionDelta: ProgressionDeltaMsg,
  handover: HandoverMsg,
  challengeReceived: ChallengeReceivedMsg,
  challengeResult: ChallengeResultMsg,
  tradeUpdate: TradeUpdateMsg,
  raidEvents: RaidEventsMsg,
  chat: ChatServerMsg,
  dm: DmMsg,
  storyBeat: StoryBeatMsg,
  toast: ToastMsg,
  trainerSpotted: TrainerSpottedMsg,
  realWeather: RealWeatherMsg,
  error: ErrorMsg,
  rankedStatus: RankedStatusMsg,
  towerState: TowerStateMsg,
  eggHatched: EggHatchedMsg,
  nemesisAmbush: NemesisAmbushMsg,
  nemesisNews: NemesisNewsMsg,
  arenaStatus: ArenaStatusMsg,
  arenaInvite: ArenaInviteMsg,
  arenaInviteResult: ArenaInviteResultMsg,
  arenaState: ArenaStateMsg,
} as const satisfies Record<ServerMessageType, z.ZodType>;

export type ServerMessageParse =
  | { readonly ok: true; readonly message: ServerMessage }
  | { readonly ok: false; readonly reason: 'unknownType' | 'invalidPayload'; readonly issues: readonly { path: string; message: string }[] };

/**
 * Non-throwing guard for a raw server message. The zod output is structurally a `ServerMessage`
 * (BattleState/BattleEvent are validated loosely — the server is trusted for their interior).
 */
export function parseServerMessage(raw: unknown): ServerMessageParse {
  const result = ServerMessageSchema.safeParse(raw);
  if (result.success) return { ok: true, message: result.data as unknown as ServerMessage };
  const issues = result.error.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message }));
  const type = typeof raw === 'object' && raw !== null ? (raw as { type?: unknown }).type : undefined;
  const known = typeof type === 'string' && Object.hasOwn(SERVER_MESSAGES, type);
  return { ok: false, reason: known ? 'invalidPayload' : 'unknownType', issues };
}
