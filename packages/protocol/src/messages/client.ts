/**
 * §4.3 Client → server messages. zod v4 schemas; every payload is validated before any handler
 * runs (the room registers each with `onMessage(name, schema, handler)`; zod v4 implements
 * Standard Schema). Exactly 26 keys in CLIENT_MESSAGES (Phase C3 added `fastTravel`, Phase D9 `fish`, Phase D13 `rankedQueue`, Phase D14 `tower`, the followers `fieldPower`, camp bases `camp`): a `type` outside them has no handler.
 *
 * zod v4 `z.number()` already rejects NaN/±Infinity (`.finite()` is a deprecated no-op), so the
 * spine's `.finite()` calls are satisfied by the default. Objects STRIP unknown keys (zod default).
 */
import { z } from 'zod';
import { ZONE_IDS } from '../types';

export const InputMsg = z.object({
  seq: z.number().int().min(0).max(0xffffffff),
  x: z.number(),
  z: z.number(),
  angle: z.number(),
  running: z.boolean(),
  dtMs: z.number().int().min(1).max(100),
  /**
   * Phase D11: the message's displacement was ridden on the bicycle (cap `MOVEMENT.bikeSpeed × 1.15`). The server
   * grants the bike cap only to an owner standing outdoors on land along the whole segment; otherwise the run / walk
   * cap applies (a faster step is a `speed` rejection). Absent = false.
   */
  bike: z.boolean().optional(),
  /**
   * Followers with field powers (SPEC §3.18): the window's steps glided off a cliff with a Flying lead. The take-off
   * point and the unit direction the client planned with (content `planGlide`); the server re-plans from them, checks
   * the take-off against its accepted position and the message's position against the glide line, and holds the plan
   * until the flier lands. Absent = no glide.
   */
  glide: z.object({ x: z.number(), z: z.number(), dx: z.number().min(-1).max(1), dz: z.number().min(-1).max(1) }).optional(),
});
/** Emote 7 is the breakdance (not in the spine; protocol IMPLEMENTATION-NOTES): it plays for BREAKDANCE_MS, not 2 s. */
export const EMOTE_BREAKDANCE = 7;
export const BREAKDANCE_MS = 6_000;
/**
 * The emote wheel (G, 2026-10-27; not in the spine): 7 the breakdance and 8..14 high five, "you, me, battle", whip /
 * nae nae, dab, look left, look right, crying. Each stays on `PlayerState.emote` for its own length; 1..6 keep 2 s.
 */
export const EMOTE_MAX = 14;
const EMOTE_LENGTH_MS: readonly number[] = [0, 2_000, 2_000, 2_000, 2_000, 2_000, 2_000, BREAKDANCE_MS, 2_600, 3_400, 5_200, 3_000, 2_600, 2_600, 4_200];
/** How long emote `n` plays (ms); 2 s for an unknown one. */
export function emoteLengthMs(n: number): number {
  return EMOTE_LENGTH_MS[n] ?? 2_000;
}
export const EmoteMsg = z.object({ emote: z.number().int().min(1).max(EMOTE_MAX) });
export const ChatMsg = z.object({ text: z.string().min(1).max(120) });

/** Phase D10 adds `obstacle` (a Cut tree / Strength boulder of `ZoneDef.obstacles`, by id). */
export const INTERACT_KINDS = ['npc', 'item', 'lore', 'gym', 'healer', 'shop', 'warp', 'static', 'switch', 'obstacle'] as const;
export type InteractKind = (typeof INTERACT_KINDS)[number];
export const InteractMsg = z.object({ targetId: z.string().min(1).max(64), kind: z.enum(INTERACT_KINDS) });
export const EngageSpawnMsg = z.object({ spawnId: z.string().min(1).max(64) });

/** Phase D6: a field position — the doubles move target (`pos` 0/1 is a position on the field, not a party index). */
export const FieldRefSchema = z.object({ side: z.union([z.literal(0), z.literal(1)]), pos: z.union([z.literal(0), z.literal(1)]) });
export const BattleActionSchema = z.discriminatedUnion('kind', [
  // Phase D6: `target` (doubles only, optional; ignored in singles) — the foe or ally position a single-target move aims at
  // Majin / Tenjin: `transform` (optional) — the battler transforms before the move (core validateAction checks band, line, once)
  z.object({ kind: z.literal('move'), move: z.string().min(1).max(40), target: FieldRefSchema.optional(), transform: z.literal(true).optional() }),
  z.object({ kind: z.literal('switch'), to: z.number().int().min(0).max(5) }),
  z.object({
    kind: z.literal('item'),
    item: z.string().min(1).max(40),
    target: z.number().int().min(0).max(5).optional(),
  }),
  z.object({ kind: z.literal('catch'), orb: z.string().min(1).max(40) }),
  z.object({ kind: z.literal('flee') }),
  z.object({ kind: z.literal('forfeit') }),
]);
export const BattleActionMsg = z.object({
  battleId: z.string().uuid(),
  turn: z.number().int().min(1),
  action: BattleActionSchema,
  /**
   * Phase D6: the field position (0/1) this action is for in a doubles battle — one message per position. Absent in a
   * doubles battle = the lowest position still waiting for an action (so a client that sends two plain messages works).
   * Ignored in singles.
   */
  pos: z.union([z.literal(0), z.literal(1)]).optional(),
});
export const ChallengeMsg = z.object({ targetId: z.string().uuid() });
export const ChallengeReplyMsg = z.object({ fromId: z.string().uuid(), accept: z.boolean() });
export const TradeRequestMsg = z.object({ targetId: z.string().uuid() });
export const TradeReplyMsg = z.object({ tradeId: z.string().uuid(), accept: z.boolean() });
export const TradeOfferMsg = z.object({
  tradeId: z.string().uuid(),
  creatureIds: z.array(z.string().uuid()).max(6),
  money: z.number().int().min(0),
});
/** offerHash = fnv1a32 of both offers, canonical (digest.ts `tradeOfferHash`) */
export const TradeConfirmMsg = z.object({ tradeId: z.string().uuid(), offerHash: z.string().length(8) });
export const TradeCancelMsg = z.object({ tradeId: z.string().uuid() });
export const RaidJoinMsg = z.object({ raidId: z.string().uuid() });
export const RaidReadyMsg = z.object({ raidId: z.string().uuid() });
export const RaidActionMsg = z.object({
  raidId: z.string().uuid(),
  round: z.number().int().min(1),
  action: BattleActionMsg.shape.action,
});
export const RaidCatchMsg = z.object({ raidId: z.string().uuid(), orb: z.string().min(1).max(40) });
export const RaidLeaveMsg = z.object({ raidId: z.string().uuid() });
/** seat = the destination sessionId from the SeatReservation */
export const HandoverAckMsg = z.object({ roomId: z.string().min(1), seat: z.string().min(1) });
/** Phase C3: free fast travel to a visited town — the server answers with a `handover` to that zone's spawn. */
export const FastTravelMsg = z.object({ zoneId: z.enum(ZONE_IDS) });
/**
 * Phase C3: the `error { code: 'notAllowed', detail }` reasons a `fastTravel` can be refused with (each with a warn
 * toast of its own, so the client does not toast the error again).
 */
export const FAST_TRAVEL_REFUSALS = ['notTown', 'notVisited', 'travelGated', 'travelBusy', 'travelCooldown', 'travelBlocked', 'travelFailed'] as const;
export type FastTravelRefusal = (typeof FAST_TRAVEL_REFUSALS)[number];
/**
 * Phase D9: a successful cast of the Old Rod (the client's timing prompt). `angle` is the heading the line was cast
 * along (radians, the `input` convention: 0 = +z). The server checks the rod and a water (non-lava) sample within
 * `FISH_REACH_M` of the player's ACCEPTED position along that heading, rolls one of the zone's `water` slots from its
 * own rng and starts that wild battle like an engaged spawn. Refusals: `error { code: 'notAllowed', detail }` with a
 * `FISH_REFUSALS` reason (and a toast for each).
 */
export const FishMsg = z.object({ angle: z.number() });
/** Phase D9: how far ahead of the player a cast reaches water (m). */
export const FISH_REACH_M = 2.5;
export const FISH_REFUSALS = ['noRod', 'noWater', 'nothingBites'] as const;
export type FishRefusal = (typeof FISH_REFUSALS)[number];
/**
 * Phase D13: join or leave the ranked queue. The server answers every one with `rankedStatus` (queued / idle with a
 * `RankedIdleReason`); a match moves both players into the ranked arena (`RANKED_ARENA`) through the handover path and
 * starts a `pvp` battle there (Elo applies as for every pvp battle).
 */
export const RankedQueueMsg = z.object({ action: z.enum(['join', 'leave']) });
/**
 * Phase D13: the rating window two queued players must both fall within (|Δrating| ≤ the smaller of their windows):
 * `base` at once, `step` wider for every `stepMs` waited, never more than `max` (a larger gap never matches).
 */
export const RANKED_WINDOW = { base: 100, step: 50, stepMs: 10_000, max: 400 } as const;
export function rankedWindow(waitedMs: number): number {
  const steps = Math.floor(Math.max(0, waitedMs) / RANKED_WINDOW.stepMs);
  return Math.min(RANKED_WINDOW.max, RANKED_WINDOW.base + steps * RANKED_WINDOW.step);
}
/**
 * Phase D14 battle tower (post-game; Solenne's league hall foyer). `start` names three distinct party creature ids —
 * the server checks the champion flag, the attendant's 3 m, not busy, the picks in the party — then runs the first
 * fight; `next` runs the next fight after a win; `quit` retires between fights. Answers: `towerState`, or
 * `error { code: 'notAllowed', detail: TowerRefusal }` with a toast.
 */
export const TowerMsg = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start'), picks: z.array(z.string().min(1).max(64)).length(3) }),
  z.object({ action: z.literal('next') }),
  z.object({ action: z.literal('quit') }),
]);
export const TOWER_REFUSALS = ['locked', 'tooFar', 'badPicks', 'running', 'noRun', 'inBattle'] as const;
export type TowerRefusal = (typeof TOWER_REFUSALS)[number];
/**
 * Followers with field powers (SPEC §3.18): the lead's power used on a spot of the zone (content `data/fieldPowers.ts`).
 * `burn` a bramble (Fire), `dig` at a camp (Ground), `dive` at a dark-water spot (Water) by its id; `sense` (Psychic)
 * names no spot ('here'). Answers: `fieldPower` with what happened, or a toast + `error { code: 'notAllowed', detail:
 * FieldPowerRefusal }`.
 */
export const FIELD_POWER_ACTIONS = ['burn', 'dig', 'dive', 'sense'] as const;
export type FieldPowerAction = (typeof FIELD_POWER_ACTIONS)[number];
export const FieldPowerMsg = z.object({ power: z.enum(FIELD_POWER_ACTIONS), targetId: z.string().min(1).max(64) });
export const FIELD_POWER_REFUSALS = ['powersOff', 'noPower', 'noSpot', 'spotFar', 'burnt', 'usedToday', 'senseResting', 'powerIndoors'] as const;
export type FieldPowerRefusal = (typeof FIELD_POWER_REFUSALS)[number];
/**
 * Camp bases (SPEC §3.19): at the campfire of the zone's travellers' camp (content camps.ts; one camp per route, so no
 * id), `claim` a free camp or `raid` someone else's (a fight with its guard). Answers: a claim writes the camp and the
 * zone's `campOwner` / `campName` / `campTrophies` with a toast; a raid a `battleStart` against the guard; a refusal a
 * toast + `error { code: 'notAllowed', detail: CampRefusal }` (content `CAMP_REFUSAL_TEXT` words it).
 */
export const CAMP_ACTIONS = ['claim', 'raid'] as const;
export type CampAction = (typeof CAMP_ACTIONS)[number];
export const CampMsg = z.object({ action: z.enum(CAMP_ACTIONS) });
/** §4.5 */
export const BattleResyncMsg = z.object({ battleId: z.string().uuid() });

export const CLIENT_MESSAGES = {
  input: InputMsg,
  emote: EmoteMsg,
  chat: ChatMsg,
  interact: InteractMsg,
  engageSpawn: EngageSpawnMsg,
  battleAction: BattleActionMsg,
  battleResync: BattleResyncMsg,
  challenge: ChallengeMsg,
  challengeReply: ChallengeReplyMsg,
  tradeRequest: TradeRequestMsg,
  tradeReply: TradeReplyMsg,
  tradeOffer: TradeOfferMsg,
  tradeConfirm: TradeConfirmMsg,
  tradeCancel: TradeCancelMsg,
  raidJoin: RaidJoinMsg,
  raidReady: RaidReadyMsg,
  raidAction: RaidActionMsg,
  raidCatch: RaidCatchMsg,
  raidLeave: RaidLeaveMsg,
  handoverAck: HandoverAckMsg,
  fastTravel: FastTravelMsg,
  fish: FishMsg,
  rankedQueue: RankedQueueMsg,
  tower: TowerMsg,
  fieldPower: FieldPowerMsg,
  camp: CampMsg,
} as const; // exactly 26 keys

export type ClientMessageType = keyof typeof CLIENT_MESSAGES;
export type ClientPayload<T extends ClientMessageType> = z.infer<(typeof CLIENT_MESSAGES)[T]>;
export type ClientMessage = {
  [K in ClientMessageType]: { readonly type: K; readonly payload: ClientPayload<K> };
}[ClientMessageType];
export type BattleAction = z.infer<typeof BattleActionSchema>;

export const CLIENT_MESSAGE_TYPES = Object.freeze(Object.keys(CLIENT_MESSAGES) as ClientMessageType[]);
export const CLIENT_MESSAGE_COUNT = 26;

/**
 * §4.3 rate limits (per client, sliding window; excess dropped with ONE `error { code: 'rateLimited' }`
 * per window). Restated as data so the server's LIMITS table and the client's send throttles agree.
 */
export const CLIENT_MESSAGE_LIMITS: Readonly<Record<ClientMessageType, { readonly max: number; readonly windowMs: number }>> = {
  input: { max: 30, windowMs: 1_000 },
  emote: { max: 1, windowMs: 1_500 },
  chat: { max: 4, windowMs: 4_000 },
  interact: { max: 4, windowMs: 1_000 },
  engageSpawn: { max: 2, windowMs: 1_000 },
  battleAction: { max: 4, windowMs: 1_000 },
  battleResync: { max: 4, windowMs: 1_000 },
  challenge: { max: 3, windowMs: 5_000 },
  challengeReply: { max: 3, windowMs: 5_000 },
  tradeRequest: { max: 3, windowMs: 5_000 },
  tradeReply: { max: 4, windowMs: 1_000 },
  tradeOffer: { max: 4, windowMs: 1_000 },
  tradeConfirm: { max: 4, windowMs: 1_000 },
  tradeCancel: { max: 4, windowMs: 1_000 },
  raidJoin: { max: 4, windowMs: 1_000 },
  raidReady: { max: 4, windowMs: 1_000 },
  raidAction: { max: 4, windowMs: 1_000 },
  raidCatch: { max: 4, windowMs: 1_000 },
  raidLeave: { max: 4, windowMs: 1_000 },
  handoverAck: { max: 4, windowMs: 1_000 },
  fastTravel: { max: 4, windowMs: 1_000 },
  /** Phase D9: one cast per 1.5 s (the prompt itself takes longer) */
  fish: { max: 1, windowMs: 1_500 },
  /** Phase D13: join / leave, 4 per 5 s */
  rankedQueue: { max: 4, windowMs: 5_000 },
  /** Phase D14: start / next / quit */
  tower: { max: 4, windowMs: 1_000 },
  /** followers with field powers: a burn / dig / dive / sense, 2 per second */
  fieldPower: { max: 2, windowMs: 1_000 },
  /** camp bases: a claim or a raid on the camp here, one per 2 s */
  camp: { max: 1, windowMs: 2_000 },
};

export function isClientMessageType(type: unknown): type is ClientMessageType {
  return typeof type === 'string' && Object.hasOwn(CLIENT_MESSAGES, type);
}

export interface PayloadIssue {
  readonly path: string;
  readonly message: string;
}

export type ClientMessageRejection =
  /** `type` is not a CLIENT_MESSAGES key: no handler; the room counts metrics.unknownMessages (no error reply). */
  | { readonly ok: false; readonly reason: 'unknownType'; readonly type: string }
  /** a known type with a malformed body: answered with `error { code: 'invalidPayload' }`. */
  | { readonly ok: false; readonly reason: 'invalidPayload'; readonly type: ClientMessageType; readonly issues: readonly PayloadIssue[] };

export type ClientMessageParse = { readonly ok: true; readonly message: ClientMessage } | ClientMessageRejection;

/** Discriminated, non-throwing parse of an incoming `(type, payload)` pair. */
export function parseClientMessage(type: unknown, payload: unknown): ClientMessageParse {
  if (!isClientMessageType(type)) {
    return { ok: false, reason: 'unknownType', type: typeof type === 'string' ? type : String(type) };
  }
  const result = CLIENT_MESSAGES[type].safeParse(payload);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message }));
    return { ok: false, reason: 'invalidPayload', type, issues };
  }
  return { ok: true, message: { type, payload: result.data } as ClientMessage };
}
