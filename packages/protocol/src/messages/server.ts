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
} from './common';

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

/** Mirrors @colyseus/shared-types ISeatReservation (0.18.2) so the client can call sdk.consumeSeatReservation(seat) with no re-encoding. */
export interface SeatReservation {
  readonly name: string;
  readonly sessionId: string;
  readonly roomId: string;
  readonly publicAddress?: string;
  readonly processId?: string;
  readonly reconnectionToken?: string;
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
export type StoryBeatPhase = 'start' | 'complete';

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
    }
  | {
      readonly type: 'battleEvents';
      readonly battleId: string;
      readonly turn: number;
      readonly events: readonly BattleEvent[];
      readonly stateDigest: string;
      readonly rng: RngState;
    }
  | { readonly type: 'battleResync'; readonly battleId: string; readonly state: BattleState; readonly stateDigest: string }
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
  'error',
] as const satisfies readonly ServerMessageType[];

// ---- zod (client-side validation) -------------------------------------------------------------------------

/** looseObject: the reservation is handed to `consumeSeatReservation` unchanged, so unknown keys must survive. */
export const SeatReservationSchema = z.looseObject({
  name: z.string().min(1),
  sessionId: z.string().min(1),
  roomId: z.string().min(1),
  publicAddress: z.string().optional(),
  processId: z.string().optional(),
  reconnectionToken: z.string().optional(),
});

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
});
export const BattleEventsMsg = z.object({
  type: z.literal('battleEvents'),
  battleId: z.string().min(1),
  turn: z.number().int().min(1),
  events: BattleEvents,
  stateDigest: Digest,
  rng: RngStateSchema,
});
export const BattleResyncServerMsg = z.object({
  type: z.literal('battleResync'),
  battleId: z.string().min(1),
  state: BattleStateSchema,
  stateDigest: Digest,
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
  ErrorMsg,
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
  error: ErrorMsg,
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
