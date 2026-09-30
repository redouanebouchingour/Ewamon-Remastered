/**
 * @ewa/content — typed game data validated by zod, the world of .design/spec/00-spine.md §3.
 * Nothing here is loaded at runtime from disk or network: it is a compiled module.
 */
import type { AbilityDef, ConsumableDef, ContentIndex, ItemDef, MoveDef, OrbDef, SpeciesDef } from '@ewa/core';
import type { EncounterTable, LeagueTrainer, LegendaryStatic, QuestDef, StoryBeat, ZoneDef, ZoneId } from './types';
import { SPECIES } from './data/species';
import { MOVES } from './data/moves';
import { ABILITIES } from './data/abilities';
import { ITEMS } from './data/items';
import { ORBS } from './data/orbs';
import { CONSUMABLES } from './data/consumables';
import { TYPE_CHART } from './data/typechart';
import { ZONES } from './data/zones';
import { ENCOUNTER_TABLES } from './data/encounters';
import { LEGENDARY_STATICS } from './data/statics';
import { LEAGUE } from './data/league';
import { QUESTS } from './data/quests';
import { STORY } from './data/story';
import { getHeightfield } from './heightfield';
import type { Heightfield } from './heightfield';

// ─── types (§3) ──────────────────────────────────────────────────────────────
export type {
  Act,
  AcquisitionPath,
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
  LeagueStage,
  LeagueTeamMember,
  LeagueTrainer,
  LegendaryStatic,
  LinkDir,
  LoreTabletDef,
  Medium,
  NpcDef,
  QuestDef,
  QuestObjective,
  RaidHotspot,
  RosterReport,
  SeasonalEvent,
  SpawnTuning,
  StaticGate,
  StoryBeat,
  TimeOfDay,
  TrainerDef,
  ValidationResult,
  ValidationStats,
  VariantPalette,
  VariantPalettes,
  WarpDef,
  Weekday,
  WeekdayVariant,
  ZoneDef,
  ZoneId,
  ZoneKind,
} from './types';
export { BADGE_ORDER, ZONE_MARGIN, ZONE_ORDER, ZONE_SIZE } from './types';

// ─── §2 definition tables (generated from legacy) ────────────────────────────
export { SPECIES } from './data/species';
export { MOVES } from './data/moves';
export { ABILITIES } from './data/abilities';
export { ITEMS } from './data/items';
export { ORBS } from './data/orbs';
export { CONSUMABLES } from './data/consumables';
export { TYPE_CHART } from './data/typechart';

// ─── §3 world tables ─────────────────────────────────────────────────────────
export { ZONES } from './data/zones';
export {
  ALPHA_CHANCE,
  ENCOUNTER_BANDS,
  ENCOUNTER_TABLES,
  ROUTE_TUNING,
  STORY_TUNING,
  TOWN_SPAWN_TUNING,
  VARIANT_CHANCE,
} from './data/encounters';
export { LEGENDARY_IDS, LEGENDARY_STATICS, MYTHICAL_IDS } from './data/statics';
export { BADGES, LEAGUE, LEAGUE_STORY_GATES } from './data/league';
export { QUESTS } from './data/quests';
export { STORY } from './data/story';
export { DAILY_SWARMS, RAID_HOTSPOTS, SEASONAL_EVENTS, VARIANT_PALETTES, WEEKDAY_VARIANT } from './data/liveops';
export { BATTLE_PASS } from './data/battlePass';
export { MARKET, SHOP_STOCK_DEFAULT } from './data/shop';
export { BODIES, LOOKS, TITLES } from './data/bodies';
export { BADGE_FLAGS, FLAG_IDS, FLAG_REGISTRY, badgeFlag, isKnownFlag } from './flags';
export type { FlagEntry } from './flags';

// ─── schemas ─────────────────────────────────────────────────────────────────
export * from './schema';

// ─── §3.5 story runtime ──────────────────────────────────────────────────────
export { beatDoneFlag, beatEligible, flagsAfterBeat, harvestStateFor, leagueStoryGate, nextStoryBeat } from './story';

// ─── §3.11 heightfield ───────────────────────────────────────────────────────
export type { Heightfield, HeightfieldJson, ZoneSurface } from './heightfield';
export {
  HEIGHTFIELD_STEP,
  buildHeightfield,
  buildZoneSurface,
  decodeHeightfield,
  digestHeightfield,
  encodeHeightfield,
  getHeightfield,
  getZoneSurface,
  heightfieldResFor,
  isWalkable,
  isWater,
  nearestWalkable,
  playableBounds,
  reachableWithin,
  sampleHeight,
  walkableComponent,
  walkableRatio,
  waterRatio,
  zonePlan,
  zoneSizeFor,
} from './heightfield';

// ─── the zone plan (layout, buildings, lights, props, footprints; audit R1) ───
export type {
  Bounds,
  BuildingKind,
  CircleSolid,
  Dir,
  Door,
  DoorApproach,
  FootprintStamp,
  HousingGenerator,
  LightRole,
  PlanBuilding,
  PlanCircle,
  PlanEllipse,
  PlanLight,
  PlanProp,
  PlanRoad,
  PlanSetPiece,
  PlanSolid,
  RectSolid,
  RoadMeander,
  RoofKind,
  SetPieceId,
  Solid,
  SolidSource,
  Vec2,
  WarpPair,
  WaterBody,
  ZonePlan,
} from './plan';
export {
  BIOME_LIGHT_GENERATOR,
  BIOME_ROOFS,
  BIOME_SOLID_SCATTER,
  DOOR_APPROACH_M,
  FENCE_HALF,
  HANDOVER_INSET,
  HEART_TREE_RADIUS,
  INTERIOR_SIZE,
  MOVER_RADIUS,
  PROP_SOLID_RADIUS,
  ROUTE_LAYOUT,
  SET_PIECE_BY_ZONE,
  SET_PIECE_EXTENT,
  SET_PIECE_LIGHT_SLOTS,
  SOLID_SET_PIECES,
  STORY_LAYOUT,
  TOWN_LAYOUT,
  ZONE_LIGHT_CAP,
  buildingFootprints,
  doorOf,
  edgePoint,
  footprintDistance,
  planZone,
  roadZAt,
  solidContains,
  stampFootprints,
  waterBodies,
} from './plan';

// ─── roster + validate ───────────────────────────────────────────────────────
export { childrenOf, computeRosterReport, stageOf } from './roster';
export type { RosterInputs, Stage } from './roster';
export { DEFAULT_TABLES, validate } from './validate';
export type { ContentTables, ValidateOptions } from './validate';

// ─── accessors ───────────────────────────────────────────────────────────────

const zoneById: ReadonlyMap<ZoneId, ZoneDef> = new Map(ZONES.map((z) => [z.id, z]));
const tableById: ReadonlyMap<string, EncounterTable> = new Map(ENCOUNTER_TABLES.map((t) => [t.id, t]));
const leagueById: ReadonlyMap<string, LeagueTrainer> = new Map(LEAGUE.map((l) => [l.id, l]));
const questById: ReadonlyMap<string, QuestDef> = new Map(QUESTS.map((q) => [q.id, q]));
const beatById: ReadonlyMap<string, StoryBeat> = new Map(STORY.map((b) => [b.id, b]));

function must<T>(map: ReadonlyMap<string, T>, kind: string, id: string): T {
  const v = map.get(id);
  if (v === undefined) throw new RangeError(`unknown ${kind} '${id}'`);
  return v;
}

/** throws RangeError on unknown id */
export function zone(id: ZoneId): ZoneDef {
  return must(zoneById, 'zone', id);
}
/** in ZONE_ORDER */
export function allZones(): readonly ZoneDef[] {
  return ZONES;
}
export function encounterTable(id: string): EncounterTable {
  return must(tableById, 'encounter table', id);
}
/** the zone's table, or null when it has none */
export function encounterTableFor(zoneId: ZoneId): EncounterTable | null {
  const z = zone(zoneId);
  return z.encounterTable === null ? null : encounterTable(z.encounterTable);
}
export function statics(): readonly LegendaryStatic[] {
  return LEGENDARY_STATICS;
}
export function staticsFor(zoneId: ZoneId): readonly LegendaryStatic[] {
  return LEGENDARY_STATICS.filter((s) => s.zoneId === zoneId);
}
export function league(id: string): LeagueTrainer {
  return must(leagueById, 'league trainer', id);
}
export function quest(id: string): QuestDef {
  return must(questById, 'quest', id);
}
export function storyBeat(id: string): StoryBeat {
  return must(beatById, 'story beat', id);
}
export function storyBeatsFor(zoneId: ZoneId): readonly StoryBeat[] {
  return STORY.filter((b) => b.zoneId === zoneId);
}
export function heightfield(zoneId: ZoneId): Heightfield {
  return getHeightfield(zoneId);
}

// ─── §2.20 ContentIndex ──────────────────────────────────────────────────────

const speciesById: ReadonlyMap<string, SpeciesDef> = new Map(SPECIES.map((s) => [s.id, s]));
const moveById: ReadonlyMap<string, MoveDef> = new Map(MOVES.map((m) => [m.id, m]));
const abilityById: ReadonlyMap<string, AbilityDef> = new Map(ABILITIES.map((a) => [a.id, a]));
const itemById: ReadonlyMap<string, ItemDef | ConsumableDef> = new Map<string, ItemDef | ConsumableDef>([
  ...ITEMS.map((i): [string, ItemDef | ConsumableDef] => [i.id, i]),
  ...CONSUMABLES.map((c): [string, ItemDef | ConsumableDef] => [c.id, c]),
]);
const orbById: ReadonlyMap<string, OrbDef> = new Map(ORBS.map((o) => [o.id, o]));
const speciesByDex: readonly SpeciesDef[] = [...SPECIES].sort((a, b) => a.dexNumber - b.dexNumber);

/** The §2.20 ContentIndex over the committed tables. Every lookup throws RangeError on an unknown id. */
export function createContentIndex(): ContentIndex {
  return {
    species: (id) => must(speciesById, 'species', id),
    move: (id) => must(moveById, 'move', id),
    ability: (id) => must(abilityById, 'ability', id),
    item: (id) => must(itemById, 'item', id),
    orb: (id) => must(orbById, 'orb', id),
    typeChart: TYPE_CHART,
    allSpecies: () => speciesByDex,
  };
}
