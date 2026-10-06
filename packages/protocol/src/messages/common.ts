/**
 * zod schemas for the core (§2) shapes that ride the wire inside server messages and REST
 * responses: CreatureInstance, RngState, BattleOutcome, BattleEvent, BattleState, RewardsSummary.
 *
 * The client trusts the server (§4.4: only `progressionDelta`/`inventoryDelta` mutate client
 * state, and they carry these shapes), so BattleEvent/BattleState are validated structurally —
 * discriminant + the fields the client reads — rather than re-encoding all 36 event variants.
 */
import { z } from 'zod';
import { BADGE_IDS, VARIANT_KEYS } from '../types';

export const STATUS_IDS = ['burn', 'poison', 'paralyze', 'sleep', 'freeze', 'confuse'] as const;
export const BATTLE_FORMATS = ['wild', 'trainer', 'league', 'pvp', 'raid'] as const;
export const WEATHER_KINDS = ['none', 'sun', 'rain', 'sand', 'hail'] as const;

export const Uuid = z.string().uuid();
export const VariantKeySchema = z.enum(VARIANT_KEYS);
export const BadgeIdSchema = z.enum(BADGE_IDS);
export const BattleFormatSchema = z.enum(BATTLE_FORMATS);
export const StatusIdSchema = z.enum(STATUS_IDS);

/** Absolute item counts, item id -> qty. */
export const ItemCounts = z.record(z.string().min(1).max(40), z.number().int().min(0));

export const MoveSlotSchema = z.object({
  id: z.string().min(1).max(40),
  pp: z.number().int().min(0),
  ppMax: z.number().int().min(0),
});

/** §2.8 — the persisted truth, as it travels in inventoryDelta / REST. */
export const CreatureInstanceSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().nullable(),
  speciesId: z.string().min(1).max(40),
  nickname: z.string().max(16).nullable(),
  level: z.number().int().min(1).max(100),
  exp: z.number().int().min(0),
  hp: z.number().int().min(0),
  moves: z.array(MoveSlotSchema).min(1).max(4),
  status: z.array(StatusIdSchema),
  ability: z.string().min(1).max(40),
  heldItem: z.string().max(40).nullable(),
  variantKey: VariantKeySchema,
  isAlpha: z.boolean(),
  /** Phase D4: present (true) only on a shiny */
  isShiny: z.boolean().optional(),
  caughtAt: z.object({ zoneId: z.string(), at: z.number().int() }).nullable(),
  ribbons: z.array(z.string()),
  favorite: z.boolean(),
  locked: z.boolean(),
});

/** §2.1 — four uint32 words. */
export const RngStateSchema = z.tuple([
  z.number().int().min(0).max(0xffffffff),
  z.number().int().min(0).max(0xffffffff),
  z.number().int().min(0).max(0xffffffff),
  z.number().int().min(0).max(0xffffffff),
]);

/** §2.9 BattleOutcome */
export const BattleOutcomeSchema = z.union([
  z.object({ winner: z.union([z.literal(0), z.literal(1)]) }),
  z.object({ winner: z.literal('draw') }),
  z.object({ winner: z.literal('fled') }),
  z.object({ winner: z.literal('caught'), slot: z.number().int().min(0).max(5) }),
]);

/** §2.19 — validated by discriminant only; the animation layer switches on `t`. */
export const BattleEventSchema = z.looseObject({ t: z.string().min(1).max(32) });

const RefSchema = z.object({ side: z.union([z.literal(0), z.literal(1)]), slot: z.number().int().min(0).max(5) });
export { RefSchema };

export const BattlerSchema = z.looseObject({
  creature: CreatureInstanceSchema,
  maxHp: z.number().int().min(1),
  atk: z.number().int().min(0),
  def: z.number().int().min(0),
  spd: z.number().int().min(0),
  participated: z.boolean(),
});

export const SideSchema = z.looseObject({
  kind: z.enum(['player', 'wild', 'npc']),
  party: z.array(BattlerSchema).min(1).max(6),
  active: z.number().int().min(0).max(5),
  trainerId: z.string().nullable(),
  canFlee: z.boolean(),
  canCatch: z.boolean(),
  mustSwitch: z.boolean(),
  consumedItems: z.array(z.string()),
  /** Phase D6: doubles only — party index on field position 0 and 1 */
  actives: z.tuple([z.number().int().min(0).max(5), z.number().int().min(0).max(5)]).optional(),
});

/** §2.9 BattleState — the full state (battleStart / battleResync). */
export const BattleStateSchema = z.looseObject({
  id: z.string().min(1),
  format: BattleFormatSchema,
  sides: z.tuple([SideSchema, SideSchema]),
  field: z.looseObject({
    weather: z.object({ kind: z.enum(WEATHER_KINDS), turns: z.number().int().min(0) }),
    terrain: z.string(),
  }),
  turn: z.number().int().min(0),
  rng: RngStateSchema,
  ended: BattleOutcomeSchema.nullable(),
  zoneId: z.string(),
  /** Phase D6: 2 in a doubles battle; absent in singles */
  slots: z.literal(2).optional(),
});

/** §4.4 RewardsSummary */
export const RewardsSummarySchema = z.object({
  money: z.number().int(),
  items: ItemCounts,
  trainerExp: z.number().int().min(0),
  ratingDelta: z.number().int().nullable(),
  badge: BadgeIdSchema.nullable(),
});

/** 8 lowercase hex chars (fnv1a32). */
export const Digest = z.string().regex(/^[0-9a-f]{8}$/);
