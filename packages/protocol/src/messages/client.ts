/**
 * §4.3 Client → server messages. zod v4 schemas; every payload is validated before any handler
 * runs (the room registers each with `onMessage(name, schema, handler)`; zod v4 implements
 * Standard Schema). Exactly 20 keys in CLIENT_MESSAGES — a `type` outside them has no handler.
 *
 * zod v4 `z.number()` already rejects NaN/±Infinity (`.finite()` is a deprecated no-op), so the
 * spine's `.finite()` calls are satisfied by the default. Objects STRIP unknown keys (zod default).
 */
import { z } from 'zod';

export const InputMsg = z.object({
  seq: z.number().int().min(0).max(0xffffffff),
  x: z.number(),
  z: z.number(),
  angle: z.number(),
  running: z.boolean(),
  dtMs: z.number().int().min(1).max(100),
});
export const EmoteMsg = z.object({ emote: z.number().int().min(1).max(6) });
export const ChatMsg = z.object({ text: z.string().min(1).max(120) });

export const INTERACT_KINDS = ['npc', 'item', 'lore', 'gym', 'healer', 'shop', 'warp', 'static', 'switch'] as const;
export type InteractKind = (typeof INTERACT_KINDS)[number];
export const InteractMsg = z.object({ targetId: z.string().min(1).max(64), kind: z.enum(INTERACT_KINDS) });
export const EngageSpawnMsg = z.object({ spawnId: z.string().min(1).max(64) });

export const BattleActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('move'), move: z.string().min(1).max(40) }),
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
} as const; // exactly 20 keys

export type ClientMessageType = keyof typeof CLIENT_MESSAGES;
export type ClientPayload<T extends ClientMessageType> = z.infer<(typeof CLIENT_MESSAGES)[T]>;
export type ClientMessage = {
  [K in ClientMessageType]: { readonly type: K; readonly payload: ClientPayload<K> };
}[ClientMessageType];
export type BattleAction = z.infer<typeof BattleActionSchema>;

export const CLIENT_MESSAGE_TYPES = Object.freeze(Object.keys(CLIENT_MESSAGES) as ClientMessageType[]);
export const CLIENT_MESSAGE_COUNT = 20;

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
