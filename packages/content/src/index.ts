/**
 * @ewa/content — typed game data validated by zod, the world of .design/spec/00-spine.md §3.
 * Nothing here is loaded at runtime from disk or network: it is a compiled module.
 */
import type { AbilityDef, ConsumableDef, ContentIndex, ItemDef, MoveDef, OrbDef, SpeciesDef } from '@ewa/core';
import type { EncounterTable, LeagueRematch, LeagueTrainer, LegendaryStatic, QuestDef, StoryBeat, ZoneDef, ZoneId } from './types';
import { SPECIES } from './data/species';
import { MOVES } from './data/spreadMoves';
import { ABILITIES } from './data/abilities';
import { ITEMS } from './data/items';
import { ORBS } from './data/orbs';
import { CONSUMABLES } from './data/consumables';
import { EVOLUTION_STONES, KEY_ITEMS } from './data/progressionItems';
import { RELICS } from './data/relics';
import { TYPE_CHART } from './data/typechart';
import { ZONES } from './data/zones';
import { ENCOUNTER_TABLES } from './data/encounters';
import { LEGENDARY_STATICS } from './data/statics';
import { localToWorld } from './interiors';
import { interiorsFor } from './interiorIndex';
import { LEAGUE, LEAGUE_REMATCH } from './data/league';
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
  InteriorDef,
  InteriorGate,
  InteriorGateStyle,
  InteriorItem,
  InteriorNpc,
  InteriorNpcRole,
  InteriorPlacement,
  InteriorProp,
  InteriorRoom,
  InteriorSwitch,
  InteriorSwitchKind,
  InteriorTemplate,
  InteriorTheme,
  InteriorTrainer,
  InteriorWall,
  InteriorWallStyle,
  LocalPoint,
  LocalRect,
  LeagueStage,
  LeagueRematch,
  LeagueTeamMember,
  LeagueTrainer,
  LegendaryStatic,
  LinkDir,
  LoreTabletDef,
  Medium,
  NpcDef,
  ObstacleDef,
  ObstacleKind,
  QuestDef,
  QuestObjective,
  RaidHotspot,
  RosterReport,
  SeasonalEvent,
  SpawnTuning,
  StaticGate,
  StoryBeat,
  TimeOfDay,
  TowerDef,
  WeeklyCupDef,
  WeeklyCupRule,
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
export { MOVES } from './data/spreadMoves';
export { SPREAD_MOVES } from './data/spreadMoves';
export { ABILITIES } from './data/abilities';
export { ITEMS } from './data/items';
export { ORBS } from './data/orbs';
export { CONSUMABLES } from './data/consumables';
export {
  BIKE_ITEM,
  BIKE_PRICE,
  EVOLUTION_STONES,
  KEY_ITEMS,
  MAJIN_BAND,
  MOVE_TUTOR_PRICE,
  PROGRESSION_STOCK,
  TENJIN_BAND,
  TM_MOVES,
  TM_PREFIX,
  TRADE_EVOLVE_RIBBON,
  canLearnMachineMove,
  tmItemId,
  tmMoveOf,
} from './data/progressionItems';
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
export { BATTLE_PASS_MYTHICALS, LEGENDARY_IDS, LEGENDARY_STATICS, MYTHICAL_IDS } from './data/statics';
export { BADGERMOLE_GEM, RELICS, SKY_BISON_WHISTLE, SPIRIT_KOI_SCALE, SPIRIT_WATER_VIAL, SUN_DRAGON_EMBER } from './data/relics';
export { SHRINES, shrineGuardianId, shrineRelicFlag } from './data/shrines';
export type { ShrineDef } from './data/shrines';
export {
  BADGES,
  LEAGUE,
  LEAGUE_REMATCH,
  LEAGUE_REMATCH_COOLDOWN_DAYS,
  LEAGUE_REMATCH_LEVELS,
  LEAGUE_REMATCH_REWARD_MULTIPLIER,
  LEAGUE_STORY_GATES,
  POSTGAME_FLAG,
  leagueRematchFlag,
} from './data/league';
export { TOWER, towerSetReward, towerTier } from './data/tower';
export { ARENA_DAILY, ARENA_TRAINING, CUP_PARTY_SIZE, STARTER_ROOTS, WEEKLY_CUPS, cupRefusal, evolutionRoot, weeklyCup } from './data/arena';
export type { ActiveCup, CupMember } from './data/arena';
export { QUESTS } from './data/quests';
export { ACHIEVEMENTS, ACHIEVEMENT_IDS, isAchievement } from './data/achievements';
/** Phase D5: the story quests (QUESTS without the achievements). */
export const STORY_QUESTS: readonly QuestDef[] = QUESTS.filter((q) => q.kind !== 'achievement');
export { STORY } from './data/story';
export { DAILY_SWARMS, RAID_HOTSPOTS, SEASONAL_EVENTS, VARIANT_PALETTES, WEEKDAY_VARIANT } from './data/liveops';
export { SHINY_FALLBACK, SHINY_TUNING, shinyPaletteOf } from './data/shiny';
export { SHINY_DERIVED } from './data/shinyDerived';
export { BATTLE_PASS } from './data/battlePass';
export { MARKET, SHOP_STOCK_DEFAULT } from './data/shop';
export {
  FORM_COUNTER_PREFIX,
  RESEARCH_COUNTERS,
  RESEARCH_HONOR_LINE,
  RESEARCH_LEVEL_POINTS,
  RESEARCH_MAX_LEVEL,
  formCounter,
  isResearchCounter,
  isResearchRare,
  researchLevel,
  researchLevelOf,
  researchMaxPoints,
  researchProgressOf,
  researchTasksFor,
  researchTasksOf,
  signatureMovesOf,
} from './data/research';
export type { ResearchCounter, ResearchInputs, ResearchProgress, ResearchTask, ResearchTaskKind, ResearchTaskProgress } from './data/research';
export { BODIES, LOOKS, TITLES } from './data/bodies';
export {
  BANNER_BACKDROPS,
  BANNER_FRAMES,
  BANNER_PINS,
  BANNER_PIN_SLOTS,
  BANNER_RARITIES,
  BANNER_TRACKERS,
  BANNER_TRACKER_SLOTS,
  DEFAULT_BANNER,
  bannerBackdrop,
  bannerFormRefusal,
  bannerForms,
  bannerFrame,
  bannerPin,
  bannerProgress,
  bannerRefusal,
  bannerShown,
  bannerTracker,
  bannerUnlockHint,
  bannerUnlocked,
  pinTier,
} from './data/banners';
export type { BannerBackdropDef, BannerChoice, BannerCount, BannerFrameDef, BannerPinDef, BannerRarity, BannerStats, BannerTrackerDef, BannerUnlock } from './data/banners';
export { BADGE_FLAGS, FLAG_IDS, FLAG_REGISTRY, VISITED_FLAGS, VISITED_PREFIX, badgeFlag, isKnownFlag, visitedFlag } from './flags';
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
  obstacleAt,
  playableBounds,
  reachableWithin,
  sampleHeight,
  walkableComponent,
  walkableRatio,
  waterRatio,
  zonePlan,
  zoneSizeFor,
} from './heightfield';

// ─── town arrival point (fast travel, escape rope, fallback join; M3 audit §1) ───
export type { ArrivalPoint } from './arrival';
export { ARRIVAL_CLEARANCE_M, ARRIVAL_RIM_INSET_M, arrivalPoint, arrivalPointFor } from './arrival';

// ─── Phase D10: Cut / Strength obstacles ─────────────────────────────────────
export {
  OBSTACLE_CAPSULE_M,
  OBSTACLE_HM,
  OBSTACLE_INTERACT_M,
  OBSTACLE_PREFIX,
  OBSTACLE_RADIUS,
  OBSTACLE_TYPES,
  obstacleFlag,
  obstacleRefusal,
  obstacleRefusalText,
  obstacleStampRadius,
  stampObstacles,
} from './obstacles';
export type { ObstacleRefusal, StampField } from './obstacles';

// ─── the Mire Route foosball club (a layer beside ZoneDef: trainers that never move the layout) ─────────
export { FOOSBALL_CLUB, foosballClubIn, foosballPlayer, foosballTrainers } from './data/foosball';
export type { FoosballBanterLine, FoosballClub, FoosballModel, FoosballPlayer } from './data/foosball';
// ─── Team Ewamon HQ (Mirevale house 5 redressed: the original team at their desk) ─────────
export { DEV_TEAM, DEV_TEAM_DESK_ID, DEV_TEAM_FRONT, DEV_TEAM_HOUSE, DEV_TEAM_NPC_IDS, OG_2022_SPECIES, devTeamAwayRoll, devTeamBanter, devTeamFrontIn, devTeamIn, devTeamMember, devTeamModels, devTeamPets, isOg2022 } from './data/devTeam';
export type { DevTeam, DevTeamBanterLine, DevTeamFront, DevTeamMember, DevTeamModel } from './data/devTeam';

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

// ─── interiors (pockets reached by door warps) ───────────────────────────────
export type { InteriorPlan, InteriorWalk, PlacedInterior, WorldGate, WorldLeader, WorldSwitch } from './interiors';
export {
  ARENA_CLEARANCE_M,
  ARENA_SLOT_M,
  INTERIOR_EDGE_CLEAR_M,
  INTERIOR_SCREEN_M,
  INTERIOR_WALL_H,
  INTERIOR_WALL_T,
  checkInterior,
  inFootprint,
  interiorDefFor,
  leaderSpot,
  localToWorld,
  localYawToWorld,
  onFloor,
  planInteriors,
  rectToWorld,
  stampInteriors,
  walkInterior,
  worldToLocal,
} from './interiors';
export {
  gatesClosedFor,
  interiorArenaFor,
  interiorAt,
  interiorFootprintAt,
  interiorGates,
  interiorItems,
  interiorLeaders,
  interiorNpcs,
  interiorSwitches,
  interiorTrainers,
  interiorWarps,
  interiorsFor,
} from './interiorIndex';
export { GYM_HALL, LEAGUE_HALL, interiorTrainerFlag, switchFlag } from './data/interiors';
export { CRYPT_HALL, CRYPT_STATIC_AT, HIDEOUTS, SUNKEN_CRYPT, hideoutBounds, hideoutBuilding, hideoutDoor, hideoutsFor } from './data/hideouts';
export type { HideoutDef } from './data/hideouts';

// ─── Phase C3 world map ──────────────────────────────────────────────────────
export type { MapCell } from './worldMap';
export { MAP_STEP, computeMapPositions, zoneMapPositions, zoneMapSize } from './worldMap';

// ─── roster + validate ───────────────────────────────────────────────────────
export { childrenOf, computeRosterReport, evolveLevelOf, stageOf } from './roster';
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
const staticsMemo = new Map<ZoneId, readonly LegendaryStatic[]>();
/**
 * The zone's statics where they stand: a static that waits inside a hall (`interior`, data/hideouts.ts) comes with the
 * world point inside its pocket in `x` / `z`, the way the halls' trainers and items do.
 */
export function staticsFor(zoneId: ZoneId): readonly LegendaryStatic[] {
  const hit = staticsMemo.get(zoneId);
  if (hit !== undefined) return hit;
  const out = LEGENDARY_STATICS.filter((s) => s.zoneId === zoneId).map((s) => {
    if (s.interior === undefined) return s;
    const { building, lx, lz } = s.interior;
    const p = interiorsFor(zoneId).find((q) => q.def.building === building);
    if (p === undefined) throw new RangeError(`static ${s.species}: no hall '${building}' in ${zoneId}`);
    const [x, z] = localToWorld(p, lx, lz);
    return { ...s, x, z };
  });
  staticsMemo.set(zoneId, out);
  return out;
}
export function league(id: string): LeagueTrainer {
  return must(leagueById, 'league trainer', id);
}
const rematchById: ReadonlyMap<string, LeagueRematch> = new Map(LEAGUE_REMATCH.map((r) => [r.leagueId, r]));
/** Phase D14: the league trainer's post-game rematch (throws RangeError on an unknown id). */
export function leagueRematch(leagueId: string): LeagueRematch {
  return must(rematchById, 'league rematch', leagueId);
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
  // Phase D1–D3: old_rod + TMs (key) and the six evolution stones (consumables)
  ...KEY_ITEMS.map((i): [string, ItemDef | ConsumableDef] => [i.id, i]),
  ...EVOLUTION_STONES.map((c): [string, ItemDef | ConsumableDef] => [c.id, c]),
  // the Original Master Relics (held items that open ravatar's relic forms)
  ...RELICS.map((i): [string, ItemDef | ConsumableDef] => [i.id, i]),
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
export {
  CHALLENGE_CLEARED_FLAG,
  CHALLENGE_FAILED_FLAG,
  CHALLENGE_LABELS,
  CHALLENGE_MODES,
  CHALLENGE_MODE_FLAG,
  FALLEN_MEMORIAL_RIBBON,
  FALLEN_RIBBON,
  challengeActive,
  challengeMetFlag,
  challengeOf,
  isFallen,
} from './data/challenge';
export type { ChallengeMode, ChallengeState, ChallengeStatus } from './data/challenge';
export {
  SEASON_ANCHOR_MS,
  SEASON_BASE_RATING,
  SEASON_FINALISTS,
  SEASON_FINALS_MS,
  SEASON_LENGTH_MS,
  finalsWeek,
  seasonAt,
  seasonByNumber,
  seasonResetRating,
  seasonTitle,
} from './data/seasons';
export type { Season } from './data/seasons';
export {
  HOLLOWED_FLAG,
  HOLLOWED_LINES,
  HOLLOWED_TOWN,
  LIGHT_POINTS,
  SHADOW_DARK_BOOST,
  SHADOW_MAX,
  SHADOW_MIN_DEEDS,
  SHADOW_POINTS,
  SHADOW_THRESHOLDS,
  deedsOf,
  lightLevel,
  shadowDarkWeight,
  shadowLevel,
  shadowNotice,
} from './data/worldHonor';
export type { Deeds, ShadowLevel } from './data/worldHonor';
export {
  ECO_FACTOR_MAX,
  ECO_FACTOR_MIN,
  ECO_LAST_WEEK_WEIGHT,
  ECO_MIN_TAKES,
  ECO_NOTABLE,
  ECO_WEEK_MS,
  FOOD_CHAIN_HAND,
  LIGHT_RARE_BOOST,
  MIGRANT_SOURCE_FACTOR,
  MIGRANT_WEIGHT,
  MIGRATIONS_PER_SEASON,
  MIGRATION_ROUTES,
  PREDATOR_BST_MARGIN,
  SHADOW_GHOST_BOOST,
  ecoWeek,
  ecoWeekStart,
  ecosystemOf,
  foodChain,
  foodChainAmong,
  huntsByType,
  migrantSlot,
  migrationsFor,
  neighbourZones,
  scarce,
  surging,
} from './data/ecosystem';
export type { EcoCause, EcoInput, EcoSpecies, Ecosystem, FoodLink, MigrationRoute, SpeciesTake } from './data/ecosystem';
export { FACTIONS, FACTION_LABELS, FACTION_POINTS, FACTION_SKY_ZONE, chronicleLine, factionWinner } from './data/factions';
export type { Faction } from './data/factions';
export { ROAMERS, ROAMER_CHANCE, ROAMER_LEVEL, ROAM_PERIOD_MS, ROAM_ZONES, roamerMovesAt, roamerOf, roamerZoneAt } from './data/roamer';
export { GHOSTS_PER_ZONE, GHOST_CHANCE, GHOST_DAYS, GHOST_LEVEL_SPAN, ghostOwner, ghostReport, ghostReward, ghostTrainerId, isGhostTrainer } from './data/ghosts';
export {
  BREED_REFUSAL_TEXT,
  DAYCARE,
  DAYCARE_LINES,
  EGG_CARRY_MAX,
  EGG_MAX,
  EGG_READY_MS,
  EGG_SHINY_ODDS,
  EGG_SHINY_ODDS_SHINY_PARENT,
  EGG_STEPS,
  HATCH_LEVEL,
  breedRefusal,
  canInheritMove,
  eggAbility,
  eggHonor,
  eggMoves,
  eggSpecies,
  eggSteps,
  eggVariant,
  hatchMoves,
  isBandbornPair,
} from './data/daycare';
export type { BreedRefusal } from './data/daycare';
export {
  NEMESIS_AMBUSH_CHANCE,
  NEMESIS_GAIN,
  NEMESIS_LEVEL_MAX,
  NEMESIS_MAX,
  NEMESIS_OVER_LEAD,
  NEMESIS_PROMOTE_CHANCE,
  NEMESIS_RANK_GAIN,
  NEMESIS_RANK_MAX,
  NEMESIS_SCARS,
  NEMESIS_SCAR_TEXT,
  NEMESIS_UNDER_LEAD,
  nemesisAmbushChance,
  nemesisFightLevel,
  nemesisFullName,
  nemesisMove,
  nemesisMoves,
  nemesisName,
  nemesisPromoteChance,
  nemesisScarRibbon,
  nemesisTaunt,
  scarOf,
  scarOfRibbons,
} from './data/nemesis';
export type { NemesisMemory, NemesisRng, NemesisScar, TauntNames } from './data/nemesis';
export {
  BADLANDER_LINE,
  BOUNTY_BOARD_AT,
  BOUNTY_CLAIMS_PER_DAY,
  BOUNTY_CUT,
  BOUNTY_HONOR,
  BOUNTY_MARSHAL_AT,
  BOUNTY_MARSHAL_LINES,
  BOUNTY_OFFICES,
  BOUNTY_OPEN_MAX,
  BOUNTY_PERIOD_MS,
  BOUNTY_POST_HOURS,
  BOUNTY_REFUSAL_TEXT,
  GAME_BOUNTY_MAX,
  GAME_BOUNTY_MIN_WINS,
  GAME_BOUNTY_PER_WIN,
  LAWLANDER_LINE,
  NEMESIS_BOUNTY_MIN_RANK,
  NEMESIS_BOUNTY_PER_RANK,
  PLAYER_BOUNTY_MAX,
  PLAYER_BOUNTY_MIN,
  WANTED_GHOST_CHANCE,
  bountyFee,
  bountyMarshalId,
  bountyPayout,
  bountyPeriod,
  gameBountyReward,
  hasBountyBoard,
  holdsLine,
  lawlanderBonus,
  nemesisBounty,
  postExpiry,
  postRefusal,
  withBountyBoard,
} from './data/bounties';
export type { BountyKind, BountyRefusal } from './data/bounties';

// ─── the rumour board (LLM feature 8) ────────────────────────────────────────
export { CRIER_AT, CRIER_LINES, crierId, crierTown, hasRumourBoard, rumourZones, withTownCrier } from './data/rumours';

// ─── followers with field powers (SPEC §3.18) ────────────────────────────────
export {
  BRAMBLES,
  BRAMBLE_PREFIX,
  BRAMBLE_RADIUS,
  BRAMBLE_SOLID_HALF,
  DARK_ZONES,
  DIG_LOOT,
  DIG_PREFIX,
  DIG_SPOTS,
  DIVE_LOOT,
  DIVE_PREFIX,
  DIVE_SPOTS,
  FIELD_INTERACT_M,
  FIELD_POWERS,
  FIELD_POWER_TEXT,
  FIELD_POWER_TYPE,
  GLIDE,
  HAUNT,
  LAVA_BIOMES,
  brambleFlag,
  brambleSolid,
  brambleSolidsFor,
  bramblesFor,
  cliffSample,
  digFlag,
  digSpotsFor,
  diveFlag,
  diveSpotsFor,
  diveWater,
  fieldDayKey,
  fieldLead,
  fieldLoot,
  fieldPowersOf,
  fieldSpotReady,
  glideAltitude,
  glideProgress,
  hauntPath,
  hauntPosition,
  isDarkHere,
  leadLook,
  planGlide,
  reachFromSpawn,
} from './fieldPowers';
export type { BrambleDef, FieldLoot, FieldPower, FieldSpotDef, GlidePlan } from './fieldPowers';

// ─── camp bases (SPEC §3.19) ─────────────────────────────────────────────────
export {
  CAMP_HELD_PER_DAY,
  CAMP_HELD_POINTS,
  CAMP_INACTIVE_DAYS,
  CAMP_LEVEL_SPAN,
  CAMP_NAME_MAX,
  CAMP_PROMPT_M,
  CAMP_RAID_CAP,
  CAMP_RAID_COOLDOWN_MS,
  CAMP_RAID_HONOR,
  CAMP_RAID_SHADOW,
  CAMP_RAID_SHARE,
  CAMP_RANGE_M,
  CAMP_REFUSAL_TEXT,
  CAMP_SLOT_RADIUS,
  CAMP_TROPHY_SLOTS,
  TROPHY_KINDS,
  TROPHY_KIND_LABEL,
  campGuardOwner,
  campGuardTrainerId,
  campInactive,
  campLogLine,
  campOf,
  campRaidCut,
  campWelcome,
  campZones,
  claimRefusal,
  defaultCampName,
  nearCamp,
  raidRefusal,
  raidWonText,
  trophyId,
  trophyKindOf,
} from './data/camps';
export type { CampDef, CampLogEntry, CampRefusal, CampSlot, Trophy, TrophyKind } from './data/camps';

// ─── a recurring rival (LLM feature 7) ───────────────────────────────────────
export {
  RIVAL_ARCS,
  RIVAL_CHANCE,
  RIVAL_COOLDOWN_MS,
  RIVAL_COUNTER,
  RIVAL_LOOKS,
  RIVAL_MIN_BADGES,
  RIVAL_NAMES,
  RIVAL_RESPECT_BADGES,
  RIVAL_SPAWN_M,
  RIVAL_TEMPERAMENTS,
  RIVAL_TEMPERAMENT_TEXT,
  RIVAL_WALK_ALWAYS_M,
  RIVAL_WALK_M,
  RIVAL_WORDS_MAX,
  RIVAL_WORDS_WINDOW_MS,
  isRivalTrainer,
  rivalArc,
  rivalIdentity,
  rivalLevelLead,
  rivalNameOf,
  rivalReward,
  rivalTeamSize,
  rivalTrainerId,
  signatureSpecies,
  signatureStage,
} from './data/rival';
export type { RivalArc, RivalIdentity, RivalRecord, RivalTemperament } from './data/rival';
export { DEX_REWARDS, DEX_STAMPS, DEX_TITLES, dexRewardById, dexRewardProgress, dexRewardReady, dexStampsOf, dexTitlesOf } from './data/dexRewards';
export type { DexRewardCtx, DexRewardDef, DexRewardNeed, DexStamp } from './data/dexRewards';
