/**
 * Arena PvP — battles that live outside the world (30-server-netcode.md §30.4.10, 20-client.md §20.9.9d).
 *
 * A player opens the PvP screen from anywhere, queues for a mode (or invites a friend, or starts AI training), and on a
 * match the client leaves its zone room and joins a dedicated `arena` room created for that one battle. Both teams
 * fight as fully healed copies (synthetic ids, never written back: no hp lost, no creature exp, no honor); Level 50,
 * Ranked and the Weekly Cup set every creature to exactly `ARENA_LEVEL`. Only Ranked moves the rating. Afterwards the
 * client rejoins the world where the player stood.
 *
 * The in-world PvP (the walk-up challenge §30.4.5 and the Mirevale ranked queue §30.4.5a) is unchanged.
 */
import { z } from 'zod';
import { SeatReservationSchema } from './messages/common';
import type { SeatReservation } from './messages/common';

/** Every creature in a Level 50 / Ranked / Cup battle fights at exactly this level (raised or lowered). */
export const ARENA_LEVEL = 50;
/** The modes a player can queue for (matched by the arena matcher). */
export const ARENA_MODES = ['standard', 'level50', 'ranked', 'cup'] as const;
export type ArenaMode = (typeof ARENA_MODES)[number];
/** Every kind of arena battle: the queued modes, a friend invite, AI training. */
export const ARENA_KINDS = [...ARENA_MODES, 'friend', 'training'] as const;
export type ArenaKind = (typeof ARENA_KINDS)[number];
/** The level rule of a friend battle or a training battle: own levels (`standard`) or everyone at `ARENA_LEVEL`. */
export const ARENA_RULES = ['standard', 'level50'] as const;
export type ArenaRules = (typeof ARENA_RULES)[number];
/** AI training: the opponent's species pool (the tower's pools 0 / 1 / 3) and its AI. */
export const ARENA_DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type ArenaDifficulty = (typeof ARENA_DIFFICULTIES)[number];

/** The level a kind / rules fights at: `ARENA_LEVEL`, or null = each creature's own level. */
export function arenaLevel(kind: ArenaKind, rules: ArenaRules | null = null): number | null {
  if (kind === 'level50' || kind === 'ranked' || kind === 'cup') return ARENA_LEVEL;
  if (kind === 'friend' || kind === 'training') return rules === 'level50' ? ARENA_LEVEL : null;
  return null;
}

/** Display names (PvP screen, history, arena banner). */
export const ARENA_KIND_LABELS: Readonly<Record<ArenaKind, string>> = {
  standard: 'Standard',
  level50: 'Level 50',
  ranked: 'Ranked',
  cup: 'Weekly Cup',
  friend: 'Friend battle',
  training: 'Training',
};

/**
 * The queue (`ewa:arena:queue:<mode>`). Ranked pairs within the ranked window (`rankedWindow`, ±100 widening to ±400);
 * the other modes pair the two longest-waiting players. `idle` reasons: `left` (left the queue), `busy` (in a battle,
 * trade, raid or arena), `party` (no creature able to battle), `cup` (the party breaks this week's cup rule — `detail`
 * says which), `cancelled` (the match fell through: the opponent left or never arrived), `started` (the arena battle
 * began), `timeout` (no match within `ARENA_QUEUE_TIMEOUT_MS`).
 */
export const ARENA_QUEUE_STATES = ['idle', 'queued', 'matched'] as const;
export type ArenaQueueState = (typeof ARENA_QUEUE_STATES)[number];
export const ARENA_IDLE_REASONS = ['left', 'busy', 'party', 'cup', 'cancelled', 'started', 'timeout'] as const;
export type ArenaIdleReason = (typeof ARENA_IDLE_REASONS)[number];
/** A queue entry older than this is dropped with `idle / timeout`. */
export const ARENA_QUEUE_TIMEOUT_MS = 5 * 60_000;
/** How long a friend invite stays open. */
export const ARENA_INVITE_TTL_MS = 45_000;
/** How long the arena room waits for every seat to be taken before it cancels. */
export const ARENA_ARRIVAL_MS = 20_000;

/** The queue state (the `arenaStatus` message minus `type`, and the body of the queue routes). */
export interface ArenaStatus {
  readonly state: ArenaQueueState;
  /** the queued / matched kind; null when idle */
  readonly kind: ArenaKind | null;
  readonly waitedMs: number;
  /** ranked: the current rating window; 0 otherwise */
  readonly window: number;
  readonly opponent: { readonly name: string; readonly rating: number } | null;
  /** set only while `matched`: the reservation for the arena room (consumeSeatReservation) */
  readonly seat: SeatReservation | null;
  readonly reason: ArenaIdleReason | null;
  /** a human-readable detail for `cup` (which rule failed); null otherwise */
  readonly detail: string | null;
}

/** The arena room's own phase. */
export const ARENA_PHASES = ['waiting', 'fighting', 'ended', 'cancelled'] as const;
export type ArenaPhase = (typeof ARENA_PHASES)[number];

export interface ArenaSeatView {
  readonly playerId: string;
  readonly name: string;
  readonly rating: number;
}

/** The weekly cup on show (content `weeklyCup(at)`). */
export interface ArenaCupView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** ISO time the cup rotates */
  readonly endsAt: string;
}

// ---- server → client messages (registered in messages/server.ts) ----------------------------------------------------

export type ArenaServerMessage =
  | ({ readonly type: 'arenaStatus' } & ArenaStatus)
  /** a friend invited this player (`POST /arena/invite`), wherever they are */
  | {
      readonly type: 'arenaInvite';
      readonly inviteId: string;
      readonly fromId: string;
      readonly fromName: string;
      readonly rules: ArenaRules;
      /** unix ms */
      readonly expiresAt: number;
    }
  /** to the inviter: the invite was declined, expired or could not start */
  | { readonly type: 'arenaInviteResult'; readonly inviteId: string; readonly toName: string; readonly result: 'declined' | 'expired' | 'unavailable' }
  /** inside the arena room: on join and on every phase change */
  | {
      readonly type: 'arenaState';
      readonly matchId: string;
      readonly kind: ArenaKind;
      /** ARENA_LEVEL, or null = own levels */
      readonly level: number | null;
      readonly phase: ArenaPhase;
      /** the human seats in side order (training: one) */
      readonly players: readonly ArenaSeatView[];
      /** training: the AI trainer's display name; null otherwise */
      readonly foeName: string | null;
      readonly cup: ArenaCupView | null;
      /** `cancelled`: why (e.g. 'noShow', 'left', 'party', 'cup') */
      readonly reason: string | null;
    };

const Name = z.string().min(1).max(40);
export const ArenaKindSchema = z.enum(ARENA_KINDS);
export const ArenaModeSchema = z.enum(ARENA_MODES);
export const ArenaRulesSchema = z.enum(ARENA_RULES);
export const ArenaDifficultySchema = z.enum(ARENA_DIFFICULTIES);
export const ArenaCupSchema = z.object({ id: z.string().min(1).max(40), name: Name, description: z.string().max(200), endsAt: z.string() });
const ArenaSeatSchema = z.object({ playerId: z.string().min(1).max(64), name: Name, rating: z.number().int() });

export const ArenaStatusBody = z.object({
  state: z.enum(ARENA_QUEUE_STATES),
  kind: ArenaKindSchema.nullable(),
  waitedMs: z.number().int().min(0),
  window: z.number().int().min(0),
  opponent: z.object({ name: Name, rating: z.number().int() }).nullable(),
  seat: SeatReservationSchema.nullable(),
  reason: z.enum(ARENA_IDLE_REASONS).nullable(),
  detail: z.string().max(200).nullable(),
});
export const ArenaStatusMsg = ArenaStatusBody.extend({ type: z.literal('arenaStatus') });
export const ArenaInviteMsg = z.object({
  type: z.literal('arenaInvite'),
  inviteId: z.string().min(1).max(64),
  fromId: z.string().min(1).max(64),
  fromName: Name,
  rules: ArenaRulesSchema,
  expiresAt: z.number().int().min(0),
});
export const ArenaInviteResultMsg = z.object({
  type: z.literal('arenaInviteResult'),
  inviteId: z.string().min(1).max(64),
  toName: Name,
  result: z.enum(['declined', 'expired', 'unavailable']),
});
export const ArenaStateMsg = z.object({
  type: z.literal('arenaState'),
  matchId: z.string().min(1).max(64),
  kind: ArenaKindSchema,
  level: z.number().int().min(1).max(100).nullable(),
  phase: z.enum(ARENA_PHASES),
  players: z.array(ArenaSeatSchema).min(1).max(2),
  foeName: Name.nullable(),
  cup: ArenaCupSchema.nullable(),
  reason: z.string().max(40).nullable(),
});

// ---- REST (registered in rest.ts ROUTES) ---------------------------------------------------------------------------

/** GET /arena — the PvP screen's data. `live` = the arena room this player is seated in (a reload rejoins it). */
export const ArenaInfoRes = z.object({
  rating: z.number().int(),
  peakRating: z.number().int(),
  rankedMatches: z.number().int().min(0),
  level: z.number().int(),
  cup: ArenaCupSchema,
  status: ArenaStatusBody,
  live: z.object({ roomId: z.string().min(1) }).nullable(),
});
/** POST /arena/queue — join a mode's queue (a second join of the same mode keeps the first entry and its wait). */
export const ArenaQueueReq = z.object({ mode: ArenaModeSchema });
/** POST /arena/training — an AI battle starts at once; the seat is in the response. */
export const ArenaTrainingReq = z.object({ rules: ArenaRulesSchema, difficulty: ArenaDifficultySchema });
export const ArenaSeatRes = z.object({ seat: SeatReservationSchema });
/** POST /arena/invite — invite a friend (accepted friendship, online, not busy). */
export const ArenaInviteReq = z.object({ username: z.string().min(3).max(20), rules: ArenaRulesSchema });
export const ArenaInviteRes = z.object({ inviteId: z.string().min(1).max(64), expiresAt: z.number().int().min(0) });
/** POST /arena/invite/reply — the invitee's answer; on accept both get a seat (the invitee in this response). */
export const ArenaInviteReplyReq = z.object({ inviteId: z.string().min(1).max(64), accept: z.boolean() });
export const ArenaInviteReplyRes = z.object({ seat: SeatReservationSchema.nullable() });
