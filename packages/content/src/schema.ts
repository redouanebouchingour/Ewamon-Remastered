/**
 * zod v4 schemas mirroring every §2 definition type and every §3 content type.
 * Each schema is annotated `z.ZodType<T>` against the TypeScript interface so the two cannot drift:
 * a field added to the interface without a matching schema entry fails the typecheck here.
 */
import { z } from 'zod';
import type {
  AbilityDef,
  AbilityHook,
  ConsumableDef,
  ConsumableEffect,
  Evolution,
  HeldItemHook,
  ItemDef,
  LearnEntry,
  MoveDef,
  MoveEffect,
  MoveTarget,
  OrbDef,
  Rarity,
  SpeciesDef,
  SpeciesRole,
  StatKey,
  StatusId,
  TypeChart,
  TypeName,
  VariantKey,
  WeatherKind,
} from '@ewa/core';
import type {
  Act,
  BadgeDef,
  BadgeId,
  BattlePassReward,
  Biome,
  BodyDef,
  DailySwarm,
  EncounterSlot,
  EncounterTable,
  EncounterTier,
  GroundItemDef,
  HarvestState,
  LeagueTrainer,
  LegendaryStatic,
  LoreTabletDef,
  NpcDef,
  QuestDef,
  QuestObjective,
  RaidHotspot,
  SeasonalEvent,
  SpawnTuning,
  StaticGate,
  StoryBeat,
  TrainerDef,
  VariantPalettes,
  WarpDef,
  WeekdayVariant,
  ZoneDef,
  ZoneId,
} from './types';
import { BADGE_ORDER, ZONE_ORDER } from './types';

// ─── §2.2 types ──────────────────────────────────────────────────────────────

export const TYPE_NAME_VALUES = [
  'Normal',
  'Fire',
  'Water',
  'Grass',
  'Electric',
  'Ice',
  'Fighting',
  'Poison',
  'Ground',
  'Flying',
  'Psychic',
  'Bug',
  'Rock',
  'Ghost',
  'Dragon',
  'Steel',
  'Fairy',
  'Dark',
  'Cosmic',
] as const;

export const TypeNameSchema: z.ZodType<TypeName> = z.enum(TYPE_NAME_VALUES);

const Multiplier = z.union([z.literal(0), z.literal(0.5), z.literal(2)]);
export const TypeChartSchema: z.ZodType<TypeChart> = z.record(
  TypeNameSchema,
  z.partialRecord(TypeNameSchema, Multiplier),
);

const Id = z.string().min(1);
const SnakeId = z.string().regex(/^[a-z0-9_]+$/, 'snake_case id');
const Int = z.number().int();
const NonNegInt = Int.min(0);
const PosInt = Int.min(1);
const Money = NonNegInt;

// ─── §2.3 SpeciesDef ─────────────────────────────────────────────────────────

export const RaritySchema: z.ZodType<Rarity> = z.enum([
  'common',
  'uncommon',
  'rare',
  'legendary',
  'mythical',
]);

export const SpeciesRoleSchema: z.ZodType<SpeciesRole> = z.enum([
  'Physical Attacker',
  'Special Attacker',
  'Mixed Attacker',
  'Physical Defender',
  'Special Defender',
  'Mixed Defender',
  'Healer',
  'Speed',
  'Tank',
]);

export const LearnEntrySchema: z.ZodType<LearnEntry> = z.object({
  move: Id,
  level: Int.min(1).max(100),
});

const EvolveLevel = Int.min(2).max(99);

export const EvolutionSchema: z.ZodType<Evolution> = z.union([
  z.object({ kind: z.literal('level'), into: SnakeId, atLevel: EvolveLevel }),
  z.object({
    kind: z.literal('split'),
    atLevel: EvolveLevel,
    branches: z
      .array(
        z.object({
          into: SnakeId,
          condition: z.union([z.object({ kind: z.literal('ability'), ability: Id }), z.object({ kind: z.literal('honor'), atLeast: z.number().int() }), z.null()]),
        }),
      )
      .min(2),
  }),
  z.object({ kind: z.literal('item'), item: SnakeId, into: SnakeId }),
  z.object({ kind: z.literal('trade'), into: SnakeId }),
  z.null(),
]);

/** a mid-battle form (hollowmane's rage form); the stat key enum is inline because StatKeySchema is declared below */
const BandKindSchema = z.enum(['majin', 'tenjin']);

const BattleFormDefSchema = z.object({
  id: SnakeId,
  name: z.string().min(1),
  kind: BandKindSchema.optional(),
  hpBelowPct: Int.min(1).max(99),
  baseAtk: PosInt,
  baseDef: PosInt,
  baseSpd: PosInt,
  types: z.union([z.tuple([TypeNameSchema]), z.tuple([TypeNameSchema, TypeNameSchema])]).optional(),
  onEnter: z.object({
    clearNegativeStages: z.boolean(),
    lowerFoes: z.union([z.object({ stat: z.enum(['atk', 'def', 'spd', 'acc', 'eva']), stages: Int.min(1).max(6) }), z.null()]),
    cureStatus: z.boolean().optional(),
    healFraction: z.number().gt(0).max(1).optional(),
  }),
  sprite: z.object({ front: z.string().min(1), back: z.string().min(1) }),
  signatureMove: z.object({ replaces: z.string().min(1), move: z.string().min(1) }).optional(),
});

export const SpeciesDefSchema: z.ZodType<SpeciesDef> = z.object({
  id: SnakeId,
  name: z.string().min(1),
  dexNumber: Int.min(1).max(141),
  flavor: z.string(),
  types: z.union([z.tuple([TypeNameSchema]), z.tuple([TypeNameSchema, TypeNameSchema])]),
  baseHp: PosInt,
  baseAtk: PosInt,
  baseDef: PosInt,
  baseSpd: PosInt,
  rarity: RaritySchema,
  catchRate: Int.min(3).max(255),
  sizeScale: z.number().min(0.5).max(2.2),
  expYield: PosInt,
  moves: z.array(Id).min(1).max(4),
  learnableMoves: z.array(LearnEntrySchema).min(1),
  abilities: z.array(Id).min(1).max(2),
  role: SpeciesRoleSchema,
  evolution: EvolutionSchema,
  evolvesFrom: z.union([SnakeId, z.null()]),
  sprite: z.object({ front: z.string().min(1), back: z.string().min(1) }),
  legendary: z.boolean(),
  battleForm: BattleFormDefSchema.optional(),
});

// ─── §2.4 MoveDef ────────────────────────────────────────────────────────────

export const MOVE_EFFECT_VALUES = [
  'lower_atk',
  'first',
  'paralyze',
  'flinch',
  'crit',
  'confuse',
  'poison',
  'raise_def',
  'burn',
  'recoil',
  'lower_def',
  'drain',
  'heal',
  'sun',
  'lower_spd',
  'freeze',
  'raise_all',
  'trap',
  'weather',
  'sleep',
  'lower_spAtk',
  'raise_atk',
  'raise_spd',
] as const;

export const MoveEffectSchema: z.ZodType<MoveEffect> = z.enum(MOVE_EFFECT_VALUES);
export const MoveTargetSchema: z.ZodType<MoveTarget> = z.enum(['foe', 'self', 'field']);

export const MoveDefSchema: z.ZodType<MoveDef> = z.object({
  id: Id,
  type: TypeNameSchema,
  power: NonNegInt,
  pp: Int.min(5).max(40),
  accuracy: z.union([Int.min(1).max(100), z.null()]),
  priority: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  contact: z.boolean(),
  effect: z.union([MoveEffectSchema, z.null()]),
  effectChance: Int.min(1).max(100),
  target: MoveTargetSchema,
  description: z.string(),
  spread: z.enum(['foes', 'all']).optional(),
});

// ─── §2.5 AbilityDef ─────────────────────────────────────────────────────────

export const StatKeySchema: z.ZodType<StatKey> = z.enum(['atk', 'def', 'spd', 'acc', 'eva']);
export const WeatherKindSchema: z.ZodType<WeatherKind> = z.enum([
  'none',
  'sun',
  'rain',
  'sand',
  'hail',
]);
const MajorStatusSchema = z.enum(['burn', 'poison', 'paralyze', 'sleep', 'freeze']);
export const StatusIdSchema: z.ZodType<StatusId> = z.enum([
  'burn',
  'poison',
  'paralyze',
  'sleep',
  'freeze',
  'confuse',
]);

const StageRaise = z.object({ stat: StatKeySchema, stages: Int });

export const AbilityHookSchema: z.ZodType<AbilityHook> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('onSwitchIn'), lowerFoe: StageRaise }),
  z.object({
    kind: z.literal('onSwitchOut'),
    action: z.enum(['healFraction', 'cureStatus']),
    fraction: z.number().positive().max(1).optional(),
  }),
  z.object({ kind: z.literal('modifySpeed'), whenWeather: WeatherKindSchema, mul: z.number().positive() }),
  z.object({
    kind: z.literal('modifyAttack'),
    when: z.enum(['always', 'statused']),
    mul: z.number().positive(),
  }),
  z.object({
    kind: z.literal('modifyDamage'),
    side: z.enum(['attacker', 'defender']),
    moveTypes: z.array(TypeNameSchema).optional(),
    when: z.enum(['superEffective', 'flashFired']).optional(),
    mul: z.number().positive(),
  }),
  z.object({
    kind: z.literal('modifyAccuracy'),
    side: z.enum(['attacker', 'defender']),
    whenWeather: WeatherKindSchema.optional(),
    onlyDamaging: z.boolean().optional(),
    mul: z.number().positive(),
  }),
  z.object({
    kind: z.literal('typeImmunity'),
    moveType: TypeNameSchema,
    reaction: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('none') }),
      z.object({ kind: z.literal('heal'), fraction: z.number().positive().max(1) }),
      z.object({ kind: z.literal('flag'), flag: z.literal('flashFired') }),
      z.object({ kind: z.literal('raiseStat'), stat: StatKeySchema, stages: Int }),
    ]),
  }),
  z.object({ kind: z.literal('statusImmunity'), statuses: z.array(StatusIdSchema).min(1) }),
  z.object({ kind: z.literal('stageLowerImmunity'), stats: z.array(StatKeySchema).min(1) }),
  z.object({
    kind: z.literal('onContact'),
    reaction: z.discriminatedUnion('kind', [
      z.object({
        kind: z.literal('inflictStatus'),
        status: MajorStatusSchema,
        chance: Int.min(1).max(100),
      }),
      z.object({ kind: z.literal('damageFraction'), fraction: z.number().positive().max(1) }),
    ]),
  }),
  z.object({ kind: z.literal('onStatLowered'), raise: StageRaise }),
  z.object({ kind: z.literal('endOfTurn'), raise: StageRaise }),
  z.object({ kind: z.literal('wonderGuard') }),
]);

export const AbilityDefSchema: z.ZodType<AbilityDef> = z.object({
  id: Id,
  name: z.string().min(1),
  description: z.string(),
  hooks: z.array(AbilityHookSchema),
});

// ─── §2.6 Items ──────────────────────────────────────────────────────────────

export const HeldItemHookSchema: z.ZodType<HeldItemHook> = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('statMul'),
    stat: z.enum(['atk', 'def', 'spd']),
    mul: z.number().positive(),
    unevolvedOnly: z.boolean().optional(),
  }),
  z.object({ kind: z.literal('typeBoost'), type: TypeNameSchema, mul: z.number().positive() }),
  z.object({
    kind: z.literal('berry'),
    belowFraction: z.number().positive().max(1),
    heal: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('fraction'), value: z.number().positive().max(1) }),
      z.object({ kind: z.literal('flat'), value: PosInt }),
    ]),
  }),
  z.object({
    kind: z.literal('onSuperEffectiveHit'),
    raise: StageRaise,
    consume: z.literal(true),
  }),
  z.object({ kind: z.literal('choiceLock') }),
  z.object({ kind: z.literal('noStatusMoves') }),
  z.object({ kind: z.literal('hazardImmunity') }),
]);

export const ItemDefSchema: z.ZodType<ItemDef> = z.object({
  id: Id,
  name: z.string().min(1),
  description: z.string(),
  slot: z.enum(['held', 'key']),
  fieldVerb: z.union([z.enum(['surf', 'cut', 'strength']), z.null()]),
  hooks: z.array(HeldItemHookSchema),
  price: z.union([Money, z.null()]),
});

export const OrbDefSchema: z.ZodType<OrbDef> = z.object({
  id: SnakeId,
  name: z.string().min(1),
  description: z.string(),
  catchRate: z.number().positive(),
  bonus: z.union([
    z.object({ kind: z.literal('type'), type: TypeNameSchema, multiplier: z.number().positive() }),
    z.object({ kind: z.literal('alpha_or_variant'), multiplier: z.number().positive() }),
    z.null(),
  ]),
  price: Money,
  sellPrice: Money,
  maxStack: PosInt,
  rarity: RaritySchema,
});

const AmountOrFull = z.union([PosInt, z.literal('full')]);

export const ConsumableEffectSchema: z.ZodType<ConsumableEffect> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('healHp'), amount: AmountOrFull }),
  z.object({ kind: z.literal('revive'), fraction: z.union([z.literal(0.5), z.literal(1)]) }),
  z.object({
    kind: z.literal('cureStatus'),
    statuses: z.union([z.array(StatusIdSchema).min(1), z.literal('all')]),
  }),
  z.object({ kind: z.literal('fullRestore') }),
  z.object({ kind: z.literal('restorePp'), amount: AmountOrFull }),
  z.object({ kind: z.literal('rareCandy') }),
  z.object({ kind: z.literal('repel'), steps: PosInt }),
  z.object({ kind: z.literal('lure'), steps: PosInt }),
  z.object({ kind: z.literal('escapeRope') }),
  z.object({ kind: z.literal('evolutionStone') }),
  z.object({ kind: z.literal('sellOnly') }),
]);

export const ConsumableDefSchema: z.ZodType<ConsumableDef> = z.object({
  id: SnakeId,
  name: z.string().min(1),
  description: z.string(),
  effect: ConsumableEffectSchema,
  usableInBattle: z.boolean(),
  price: Money,
  sellPrice: Money,
  maxStack: PosInt,
});

// ─── §3.1 Zones ──────────────────────────────────────────────────────────────

export const ZoneIdSchema: z.ZodType<ZoneId> = z.enum(ZONE_ORDER);
export const BadgeIdSchema: z.ZodType<BadgeId> = z.enum(BADGE_ORDER);
export const BiomeSchema: z.ZodType<Biome> = z.enum([
  'grove',
  'cinder',
  'salt',
  'storm',
  'marrow',
  'vesper',
  'forge',
  'sky',
  'capital',
  'shrine',
  'rift',
]);
export const HarvestStateSchema: z.ZodType<HarvestState> = z.enum(['intact', 'thinning', 'harvested']);
export const ActSchema: z.ZodType<Act> = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const Coord = z.number().finite();
const Flag = z.string().min(1);
const Lines = z.array(z.string().min(1));

export const NpcDefSchema: z.ZodType<NpcDef> = z.object({
  id: Id,
  name: z.string().min(1),
  x: Coord,
  z: Coord,
  look: SnakeId,
  lines: Lines,
  when: z.union([Flag, z.null()]),
  until: z.union([Flag, z.null()]),
  react: z.array(z.object({ when: Flag, lines: Lines.min(1) })),
  tutor: z.array(Id).min(1).optional(),
});

export const TrainerDefSchema: z.ZodType<TrainerDef> = z.object({
  id: Id,
  name: z.string().min(1),
  x: Coord,
  z: Coord,
  look: SnakeId,
  team: z.array(z.object({ species: SnakeId, level: Int.min(1).max(100) })).min(1).max(6),
  lines: Lines,
  reward: Money,
  rematchDays: z.union([PosInt, z.null()]),
  doubles: z.literal(true).optional(),
  bands: z.array(BandKindSchema).min(1).max(2).optional(),
});

export const GroundItemDefSchema: z.ZodType<GroundItemDef> = z.object({
  id: Id,
  x: Coord,
  z: Coord,
  item: Id,
  qty: PosInt,
});

export const LoreTabletDefSchema: z.ZodType<LoreTabletDef> = z.object({
  id: Id,
  x: Coord,
  z: Coord,
  title: z.string().min(1),
  text: Lines.min(1),
});

export const WarpDefSchema: z.ZodType<WarpDef> = z.object({
  id: Id,
  x: Coord,
  z: Coord,
  toX: Coord,
  toZ: Coord,
  label: z.string().min(1),
});

export const ZoneDefSchema: z.ZodType<ZoneDef> = z.object({
  id: ZoneIdSchema,
  name: z.string().min(1),
  kind: z.enum(['town', 'route', 'story']),
  biome: BiomeSchema,
  type: z.union([TypeNameSchema, z.null()]),
  palette: SnakeId,
  layoutSeed: Int.min(0).max(0xffffffff),
  signature: SnakeId,
  spawn: z.object({ x: Coord, z: Coord }),
  links: z.partialRecord(z.enum(['n', 'e', 's', 'w']), ZoneIdSchema),
  gate: z.union([BadgeIdSchema, z.null()]),
  encounterTable: z.union([Id, z.null()]),
  npcs: z.array(NpcDefSchema),
  trainers: z.array(TrainerDefSchema),
  items: z.array(GroundItemDefSchema),
  lore: z.array(LoreTabletDefSchema),
  warps: z.array(WarpDefSchema),
  shop: z.union([z.array(Id), z.null()]),
  healer: z.boolean(),
  gym: z.union([Id, z.null()]),
  storyRole: z.object({
    1: z.union([z.string().min(1), z.null()]),
    2: z.union([z.string().min(1), z.null()]),
    3: z.union([z.string().min(1), z.null()]),
  }),
  harvestState: HarvestStateSchema,
  obstacles: z
    .array(
      z.object({
        id: Id,
        kind: z.enum(['tree', 'boulder']),
        x: Coord,
        z: Coord,
        item: z.object({ item: Id, qty: PosInt }).optional(),
      }),
    )
    .optional(),
});

// ─── §3.2 Encounters ─────────────────────────────────────────────────────────

export const EncounterTierSchema: z.ZodType<EncounterTier> = z.enum([
  'common',
  'uncommon',
  'rare',
  'alpha',
]);

export const EncounterSlotSchema: z.ZodType<EncounterSlot> = z.object({
  species: SnakeId,
  weight: PosInt,
  levelMin: Int.min(1).max(100),
  levelMax: Int.min(1).max(100),
  timeOfDay: z.enum(['day', 'night', 'any']),
  tier: EncounterTierSchema,
  medium: z.enum(['land', 'water']).optional(),
});

export const EncounterTableSchema: z.ZodType<EncounterTable> = z.object({
  id: z.string().regex(/^enc_[a-z_]+$/),
  zoneId: ZoneIdSchema,
  slots: z.array(EncounterSlotSchema).min(1).max(16),
});

export const StaticGateSchema: z.ZodType<StaticGate> = z
  .string()
  .regex(
    /^(badge:(bloom|ember|current|circuit|fault|wraith|anvil|ascend)|flag:[a-z0-9_:]+)$/,
  ) as unknown as z.ZodType<StaticGate>;

export const LegendaryStaticSchema: z.ZodType<LegendaryStatic> = z.object({
  species: SnakeId,
  level: Int.min(1).max(100),
  zoneId: ZoneIdSchema,
  x: Coord,
  z: Coord,
  flag: Flag,
  when: StaticGateSchema,
});

export const SpawnTuningSchema: z.ZodType<SpawnTuning> = z.object({
  targetCount: PosInt,
  respawnMinMs: PosInt,
  respawnMaxMs: PosInt,
  lifetimeMs: PosInt,
  engagedTimeoutMs: PosInt,
});

// ─── §3.3 League ─────────────────────────────────────────────────────────────

/** Phase B7: a league trainer's mid-battle banner line (`LeagueTrainer.mid`) fits one banner row. */
export const MID_LINE_MAX = 140;

export const LeagueTrainerSchema: z.ZodType<LeagueTrainer> = z.object({
  id: SnakeId,
  stage: z.enum(['gym', 'elite', 'champion']),
  order: Int.min(1).max(8),
  name: z.string().min(1),
  title: z.string().min(1),
  look: SnakeId,
  type: TypeNameSchema,
  badge: z.union([BadgeIdSchema, z.null()]),
  zoneId: ZoneIdSchema,
  pre: Lines.min(1),
  post: Lines.min(1),
  mid: z.object({ halfHp: z.string().min(1).max(MID_LINE_MAX), lastStand: z.string().min(1).max(MID_LINE_MAX) }).optional(),
  team: z
    .array(
      z.object({
        species: SnakeId,
        level: Int.min(1).max(100),
        nickname: z.union([z.string().min(1), z.null()]),
        ability: z.union([Id, z.null()]),
        heldItem: z.union([Id, z.null()]),
      }),
    )
    .min(1)
    .max(6),
  reward: Money,
  setsFlags: z.array(Flag),
  bands: z.array(BandKindSchema).min(1).max(2).optional(),
  doubles: z.literal(true).optional(),
});

export const BadgeDefSchema: z.ZodType<BadgeDef> = z.object({
  id: BadgeIdSchema,
  name: z.string().min(1),
  type: TypeNameSchema,
  gym: SnakeId,
});

// ─── §3.4 Quests ─────────────────────────────────────────────────────────────

const BattleFormatOrAny = z.enum(['wild', 'trainer', 'league', 'pvp', 'raid', 'any']);

export const QuestObjectiveSchema: z.ZodType<QuestObjective> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('reachZone'), zoneId: ZoneIdSchema }),
  z.object({ kind: z.literal('catchSpecies'), count: PosInt }),
  z.object({ kind: z.literal('catchSpecific'), species: SnakeId }),
  z.object({ kind: z.literal('defeatTrainer'), trainerId: Id }),
  z.object({ kind: z.literal('winBattles'), format: BattleFormatOrAny, count: PosInt }),
  z.object({ kind: z.literal('talkTo'), npcId: Id }),
  z.object({ kind: z.literal('deliverItem'), item: Id, qty: PosInt, npcId: Id }),
  z.object({ kind: z.literal('flag'), flag: Flag }),
  z.object({ kind: z.literal('earnBadge'), badge: BadgeIdSchema }),
  z.object({ kind: z.literal('restoreZone'), zoneId: ZoneIdSchema }),
  // Phase D5
  z.object({ kind: z.literal('dexCaught'), count: PosInt }),
  z.object({ kind: z.literal('catchTier'), tier: z.enum(['alpha', 'shiny']), count: PosInt }),
  z.object({ kind: z.literal('completeTrades'), count: PosInt }),
  z.object({ kind: z.literal('clearRaids'), count: PosInt }),
  z.object({ kind: z.literal('loginStreak'), days: PosInt }),
]);

export const QuestDefSchema: z.ZodType<QuestDef> = z.object({
  id: SnakeId,
  kind: z.enum(['story', 'achievement']).optional(),
  title: z.string().min(1),
  summary: z.string().min(1),
  giver: z.union([Id, z.null()]),
  zoneId: ZoneIdSchema,
  act: ActSchema,
  requires: z.array(SnakeId),
  objectives: z
    .array(z.object({ id: SnakeId, label: z.string().min(1), objective: QuestObjectiveSchema }))
    .min(1),
  rewards: z.object({
    money: Money,
    items: z.record(Id, PosInt),
    creature: z.union([z.object({ species: SnakeId, level: Int.min(1).max(100) }), z.null()]),
    flag: z.union([Flag, z.null()]),
  }),
});

// ─── §3.5 Story ──────────────────────────────────────────────────────────────

export const StoryBeatSchema: z.ZodType<StoryBeat> = z.object({
  id: SnakeId,
  act: ActSchema,
  zoneId: ZoneIdSchema,
  need: z.array(Flag),
  set: z.array(Flag).min(1),
  speaker: Id,
  lines: Lines.min(1),
  battle: z.union([z.object({ trainerId: Id }), z.null()]),
  after: Lines,
  harvest: z.union([z.object({ zoneId: ZoneIdSchema, to: HarvestStateSchema }), z.null()]),
  starter: z.boolean(),
  grant: z.record(Id, PosInt).optional(),
});

// ─── §3.6 Live-ops ───────────────────────────────────────────────────────────

const IsoUtc = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, 'ISO-8601 UTC');

export const SeasonalEventSchema: z.ZodType<SeasonalEvent> = z.object({
  id: SnakeId,
  name: z.string().min(1),
  description: z.string().min(1),
  startsAt: IsoUtc,
  endsAt: IsoUtc,
  alphaBonus: z.number().min(0).max(1),
  variantBonus: z.number().min(0).max(1),
  featuredZones: z.array(ZoneIdSchema).min(1),
  featuredSpecies: z.array(SnakeId).min(1),
});

export const DailySwarmSchema: z.ZodType<DailySwarm> = z.object({
  id: SnakeId,
  zoneId: ZoneIdSchema,
  species: z.array(SnakeId).min(1),
  weightBoost: z.number().positive(),
});

export const RaidHotspotSchema: z.ZodType<RaidHotspot> = z.object({
  id: SnakeId,
  zoneId: ZoneIdSchema,
  x: Coord,
  z: Coord,
  boss: z.object({
    species: SnakeId,
    level: Int.min(1).max(100),
    hpMultiplier: z.number().positive(),
  }),
  minBadges: Int.min(0).max(8),
  window: z.object({ utcHour: Int.min(0).max(23), minutes: Int.min(1).max(1440) }),
});

const VariantKeySchema: z.ZodType<VariantKey> = z.enum(['normal', 'dawn', 'dusk', 'verdant', 'ember']);
const VariantOrNull = z.union([VariantKeySchema, z.null()]);

export const WeekdayVariantSchema: z.ZodType<WeekdayVariant> = z.object({
  0: VariantOrNull,
  1: VariantOrNull,
  2: VariantOrNull,
  3: VariantOrNull,
  4: VariantOrNull,
  5: VariantOrNull,
  6: VariantOrNull,
});

// ─── §3.7 Palettes ───────────────────────────────────────────────────────────

const PaletteTriple = z.object({ hue: z.number(), saturation: z.number(), lightness: z.number() });
export const VariantPalettesSchema: z.ZodType<VariantPalettes> = z.object({
  normal: z.union([PaletteTriple, z.null()]),
  dawn: z.union([PaletteTriple, z.null()]),
  dusk: z.union([PaletteTriple, z.null()]),
  verdant: z.union([PaletteTriple, z.null()]),
  ember: z.union([PaletteTriple, z.null()]),
});

// ─── §3.9 Battle Pass ────────────────────────────────────────────────────────

export const BattlePassRewardSchema: z.ZodType<BattlePassReward> = z.object({
  level: Int.min(1).max(100),
  label: z.string().min(1),
  rarity: z.enum(['common', 'uncommon', 'rare', 'legendary', 'mythical', 'epic']),
  money: Money,
  items: z.record(Id, PosInt),
  creature: z.union([z.object({ species: SnakeId, level: Int.min(1).max(100) }), z.null()]),
  mythicalChoice: z.union([z.array(SnakeId).min(1), z.null()]),
});

// ─── §3.12 Bodies ────────────────────────────────────────────────────────────

export const BodyDefSchema: z.ZodType<BodyDef> = z.object({
  id: SnakeId,
  name: z.string().min(1),
  look: SnakeId,
  palette: z.union([SnakeId, z.null()]),
});

// ─── helper ──────────────────────────────────────────────────────────────────

/** Runs a schema over a table and returns one error string per failing row (`<label>[<index>/<id>]: <path> <message>`). */
export function schemaErrors<T>(
  label: string,
  schema: z.ZodType<T>,
  rows: readonly unknown[],
  idOf: (row: unknown) => string,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = schema.safeParse(rows[i]);
    if (!r.success) {
      for (const issue of r.error.issues) {
        out.push(`${label}[${i}/${idOf(rows[i])}]: ${issue.path.join('.')} ${issue.message}`);
      }
    }
  }
  return out;
}
