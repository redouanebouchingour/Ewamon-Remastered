/**
 * @ewa/content types — .design/spec/00-spine.md §3, verbatim where the spine writes a shape.
 * The §2 definition types (SpeciesDef, MoveDef, …) come from @ewa/core; this file adds the world.
 */
import type { BattleFormat, Rarity, TypeName, VariantKey } from '@ewa/core';

// ─── §3.1 Zone record ────────────────────────────────────────────────────────

export const ZONE_ORDER = [
  'mirevale',
  'mire_route',
  'cinderhold',
  'ash_route',
  'saltmourn',
  'tide_route',
  'stormrook',
  'galvan_route',
  'marrowdig',
  'deepcut_route',
  'vesperveil',
  'hollow_route',
  'forgewall',
  'siege_route',
  'skyrend',
  'ascent_route',
  'solenne',
  'eclipse_shrine',
  'umbral_observatory',
  'celestial_spire',
  'the_rift',
] as const;

export type ZoneId = (typeof ZONE_ORDER)[number];

export type Biome =
  | 'grove'
  | 'cinder'
  | 'salt'
  | 'storm'
  | 'marrow'
  | 'vesper'
  | 'forge'
  | 'sky'
  | 'capital'
  | 'shrine'
  | 'rift';

export const BADGE_ORDER = [
  'bloom',
  'ember',
  'current',
  'circuit',
  'fault',
  'wraith',
  'anvil',
  'ascend',
] as const;
export type BadgeId = (typeof BADGE_ORDER)[number];

export type HarvestState = 'intact' | 'thinning' | 'harvested';
export type Act = 1 | 2 | 3;
export type ZoneKind = 'town' | 'route' | 'story';

export interface NpcDef {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly z: number;
  /** character model id (render descriptor key) */
  readonly look: string;
  readonly lines: readonly string[];
  /** story flag required to appear */
  readonly when: string | null;
  /** story flag that removes them */
  readonly until: string | null;
  readonly react: readonly { readonly when: string; readonly lines: readonly string[] }[];
}

export interface TrainerDef {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly z: number;
  readonly look: string;
  /** 1..6 */
  readonly team: readonly { readonly species: string; readonly level: number }[];
  readonly lines: readonly string[];
  readonly reward: number;
  readonly rematchDays: number | null;
}

export interface GroundItemDef {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly item: string;
  readonly qty: number;
}

export interface LoreTabletDef {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly title: string;
  readonly text: readonly string[];
}

/** An in-zone teleport pair (building door ↔ interior sub-area). `interact { kind: 'warp' }` within 3 m of (x, z) moves the player to (toX, toZ). */
export interface WarpDef {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly toX: number;
  readonly toZ: number;
  readonly label: string;
}

// ─── interiors (pockets inside the zone, reached by door warps) ──────────────

export type InteriorTemplate = 'gym_hall' | 'league_hall' | 'shop' | 'healer' | 'house_s' | 'house_m';
export type InteriorTheme =
  | 'grove'
  | 'cinder'
  | 'salt'
  | 'storm'
  | 'marrow'
  | 'vesper'
  | 'forge'
  | 'sky'
  | 'league'
  | 'shop'
  | 'healer'
  | 'house';

/** A point in an interior's local frame: origin at the floor centre, the door on the local +z wall. Metres. */
export interface LocalPoint {
  readonly lx: number;
  readonly lz: number;
}
/** An axis-aligned rectangle in the interior's local frame: centre and half extents (x, z). Metres. */
export interface LocalRect {
  readonly lx: number;
  readonly lz: number;
  readonly hw: number;
  readonly hd: number;
}

export type InteriorWallStyle = 'wall' | 'hedge' | 'grate' | 'channel' | 'boulder' | 'chasm' | 'iron' | 'counter' | 'rail';
/** A solid inside the hall (the physical extent; the walkable mask grows it by the capsule radius). */
export interface InteriorWall extends LocalRect {
  readonly style: InteriorWallStyle;
}

/** A battle room: the arena forms at `arena` (the hall axis is the battle axis); `leader` waits at `leaderAt`. */
export interface InteriorRoom {
  readonly id: string;
  readonly arena: LocalPoint;
  /** LeagueTrainer id fought here, or null */
  readonly leader: string | null;
  readonly leaderAt: LocalPoint | null;
  readonly bounds: LocalRect;
  /**
   * Until the player holds `until`, the leader waits at `at` instead (league hall: the Warden who gives the league's
   * story charge greets the player in the foyer, where the beat she speaks can play, then takes her chamber).
   */
  readonly greet?: { readonly at: LocalPoint; readonly until: string } | null;
}

export type InteriorGateStyle = 'hedge' | 'grate' | 'sluice' | 'barrier' | 'boulder' | 'rune' | 'portcullis';
/** A per-player door: solid until the player holds every flag of `opensWhen` (never stamped into the heightfield). */
export interface InteriorGate {
  readonly id: string;
  readonly rect: LocalRect;
  readonly opensWhen: readonly string[];
  readonly style: InteriorGateStyle;
}

export type InteriorSwitchKind = 'rootstone' | 'furnace' | 'lever' | 'breaker' | 'keystone' | 'tile' | 'anvil';
/**
 * `interact { kind: 'switch' }`: refused unless the player holds every flag of `requires`; then sets `sets` (a
 * `switch:<zone>:<id>` flag, or null for a plain teleport tile) and, when `warpTo` is given, teleports there.
 */
export interface InteriorSwitch {
  /** globally unique: `<interior id>.<local id>` */
  readonly id: string;
  readonly kind: InteriorSwitchKind;
  readonly lx: number;
  readonly lz: number;
  readonly sets: string | null;
  readonly requires: readonly string[];
  readonly warpTo: LocalPoint | null;
  readonly label: string;
}

export interface InteriorTrainer {
  /** globally unique: `<interior id>.<local id>`; beaten flag `trainer:<id>:beaten` */
  readonly id: string;
  readonly name: string;
  readonly lx: number;
  readonly lz: number;
  /** local yaw the trainer faces (0 = toward local +z, the door) */
  readonly facing: number;
  readonly look: string;
  readonly team: readonly { readonly species: string; readonly level: number }[];
  readonly lines: readonly string[];
  readonly reward: number;
}

export type InteriorNpcRole = 'shopkeeper' | 'nurse' | 'resident' | 'guide';
export interface InteriorNpc {
  readonly id: string;
  readonly name: string;
  readonly lx: number;
  readonly lz: number;
  readonly facing: number;
  readonly look: string;
  readonly lines: readonly string[];
  readonly role: InteriorNpcRole;
}

export interface InteriorItem {
  readonly id: string;
  readonly lx: number;
  readonly lz: number;
  readonly item: string;
  readonly qty: number;
}

/** Furniture and dressing; `solid` props are also listed in `walls` (style 'wall' or 'counter'). */
export interface InteriorProp {
  readonly kind: string;
  readonly lx: number;
  readonly lz: number;
  readonly yaw: number;
  readonly scale: number;
}

export interface InteriorDef {
  /** = the building id (`<zone>.gym`, `<zone>.league`, `<zone>.shop`, `<zone>.healer`, `<zone>.house<k>`) */
  readonly id: string;
  readonly zoneId: ZoneId;
  readonly building: string;
  readonly template: InteriorTemplate;
  readonly theme: InteriorTheme;
  /** the prompt names it: "Enter <label>" */
  readonly label: string;
  /** inner floor extent along local x (w) and local z (d); the door is the centre of the +z wall */
  readonly w: number;
  readonly d: number;
  /** where a player arrives through the door */
  readonly entry: LocalPoint;
  /** the 'Leave' marker by the door */
  readonly exit: LocalPoint;
  readonly rooms: readonly InteriorRoom[];
  readonly walls: readonly InteriorWall[];
  readonly gates: readonly InteriorGate[];
  readonly switches: readonly InteriorSwitch[];
  readonly trainers: readonly InteriorTrainer[];
  readonly npcs: readonly InteriorNpc[];
  readonly items: readonly InteriorItem[];
  readonly props: readonly InteriorProp[];
}

/** Where a pocket stands in its zone: the local origin's world position, its yaw, and the flattened floor height. */
export interface InteriorPlacement {
  readonly x: number;
  readonly z: number;
  /** multiple of π/2 */
  readonly yaw: number;
  readonly floorY: number;
}

export type LinkDir = 'n' | 'e' | 's' | 'w';

export interface ZoneDef {
  readonly id: ZoneId;
  readonly name: string;
  readonly kind: ZoneKind;
  readonly biome: Biome;
  /** the zone's signature type; null for solenne/the_rift */
  readonly type: TypeName | null;
  /** palette id in render descriptors (10-render.md) */
  readonly palette: string;
  /** uint32; the zone rebuilds identically from it */
  readonly layoutSeed: number;
  /** the one unique set-piece id for this zone */
  readonly signature: string;
  /** entry point for a fresh/escape-rope/fallback join; must be walkable. mirevale: { x: 0, z: 6 } */
  readonly spawn: { readonly x: number; readonly z: number };
  readonly links: Readonly<Partial<Record<LinkDir, ZoneId>>>;
  /** badge required to ENTER this zone */
  readonly gate: BadgeId | null;
  /** EncounterTable id; null = no wild spawns */
  readonly encounterTable: string | null;
  readonly npcs: readonly NpcDef[];
  readonly trainers: readonly TrainerDef[];
  readonly items: readonly GroundItemDef[];
  readonly lore: readonly LoreTabletDef[];
  /** [] for most zones */
  readonly warps: readonly WarpDef[];
  /** consumable/orb ids in stock; null = no shop */
  readonly shop: readonly string[] | null;
  readonly healer: boolean;
  /** gym id */
  readonly gym: string | null;
  /** one-line role per act, or null */
  readonly storyRole: Readonly<Record<Act, string | null>>;
  /** the zone's DEFAULT; the effective state is per player, from story flags (§3.5 harvestStateFor) */
  readonly harvestState: HarvestState;
}

/** §3.1 extents: field side in metres per zone kind. */
export const ZONE_SIZE: Readonly<Record<ZoneKind, number>> = { town: 160, route: 240, story: 200 };
/** §3.1: the outer 16 m on every side is scenery with walkable = 0. */
export const ZONE_MARGIN = 16;

// ─── §3.2 Encounter tables ───────────────────────────────────────────────────

export type EncounterTier = 'common' | 'uncommon' | 'rare' | 'alpha';
export type TimeOfDay = 'day' | 'night' | 'any';
export type Medium = 'land' | 'water';

export interface EncounterSlot {
  readonly species: string;
  readonly weight: number;
  readonly levelMin: number;
  readonly levelMax: number;
  readonly timeOfDay: TimeOfDay;
  readonly tier: EncounterTier;
  /** default 'land'. 'water' slots spawn on a Heightfield `water` sample */
  readonly medium?: Medium;
}

export interface EncounterTable {
  readonly id: string;
  readonly zoneId: ZoneId;
  readonly slots: readonly EncounterSlot[];
}

/** `badge:<BadgeId>` or `flag:<story flag>`; the server re-checks the gate on every `interact { kind: 'static' }`. */
export type StaticGate = `badge:${BadgeId}` | `flag:${string}`;

export interface LegendaryStatic {
  /** one of the 8 non-mythical legendaries, each exactly once */
  readonly species: string;
  readonly level: number;
  readonly zoneId: ZoneId;
  /** authored inside the playable interior (§3.1); snapped with nearestWalkable(h, x, z, 8) at validate */
  readonly x: number;
  readonly z: number;
  /** set on win OR catch; the static never appears again for that player */
  readonly flag: string;
  readonly when: StaticGate;
}

/** Spawn cadence per zone kind; 30-server-netcode.md §30.3 consumes these verbatim. */
export interface SpawnTuning {
  readonly targetCount: number;
  readonly respawnMinMs: number;
  readonly respawnMaxMs: number;
  readonly lifetimeMs: number;
  readonly engagedTimeoutMs: number;
}

// ─── §3.3 League ─────────────────────────────────────────────────────────────

export type LeagueStage = 'gym' | 'elite' | 'champion';

export interface LeagueTeamMember {
  readonly species: string;
  readonly level: number;
  readonly nickname: string | null;
  readonly ability: string | null;
  readonly heldItem: string | null;
}

export interface LeagueTrainer {
  /** 'verdant_gym' … 'draco_gym', 'veil', 'aurelia', 'kirei', 'zeon' */
  readonly id: string;
  readonly stage: LeagueStage;
  /** gyms 1..8, elite 1..3, champion 1 */
  readonly order: number;
  readonly name: string;
  readonly title: string;
  readonly look: string;
  readonly type: TypeName;
  /** gyms only */
  readonly badge: BadgeId | null;
  /** gym: its town; elite/champion: 'solenne' */
  readonly zoneId: ZoneId;
  readonly pre: readonly string[];
  readonly post: readonly string[];
  readonly team: readonly LeagueTeamMember[];
  readonly reward: number;
  readonly setsFlags: readonly string[];
}

export interface BadgeDef {
  readonly id: BadgeId;
  readonly name: string;
  readonly type: TypeName;
  readonly gym: string;
}

// ─── §3.4 Quests ─────────────────────────────────────────────────────────────

export type QuestObjective =
  | { readonly kind: 'reachZone'; readonly zoneId: ZoneId }
  | { readonly kind: 'catchSpecies'; readonly count: number }
  | { readonly kind: 'catchSpecific'; readonly species: string }
  | { readonly kind: 'defeatTrainer'; readonly trainerId: string }
  | { readonly kind: 'winBattles'; readonly format: BattleFormat | 'any'; readonly count: number }
  | { readonly kind: 'talkTo'; readonly npcId: string }
  | { readonly kind: 'deliverItem'; readonly item: string; readonly qty: number; readonly npcId: string }
  | { readonly kind: 'flag'; readonly flag: string }
  | { readonly kind: 'earnBadge'; readonly badge: BadgeId }
  | { readonly kind: 'restoreZone'; readonly zoneId: ZoneId };

export interface QuestDef {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  /** npc id; null = auto-offered */
  readonly giver: string | null;
  readonly zoneId: ZoneId;
  readonly act: Act;
  /** quest ids that must be complete */
  readonly requires: readonly string[];
  readonly objectives: readonly {
    readonly id: string;
    readonly label: string;
    readonly objective: QuestObjective;
  }[];
  readonly rewards: {
    readonly money: number;
    readonly items: Readonly<Record<string, number>>;
    readonly creature: { readonly species: string; readonly level: number } | null;
    readonly flag: string | null;
  };
}

// ─── §3.5 Story beats ────────────────────────────────────────────────────────

export interface StoryBeat {
  readonly id: string;
  readonly act: Act;
  readonly zoneId: ZoneId;
  /** flags; 'badge:<BadgeId>' is sugar for the badge flag */
  readonly need: readonly string[];
  /** flags set when the beat completes */
  readonly set: readonly string[];
  /** npc id or league id */
  readonly speaker: string;
  readonly lines: readonly string[];
  /** a TrainerDef id or LeagueTrainer id */
  readonly battle: { readonly trainerId: string } | null;
  /** lines after the battle / on completion */
  readonly after: readonly string[];
  /** the beat changes a zone's render state */
  readonly harvest: { readonly zoneId: ZoneId; readonly to: HarvestState } | null;
  /** exactly one beat has this */
  readonly starter: boolean;
}

// ─── §3.6 Live-ops ───────────────────────────────────────────────────────────

export interface SeasonalEvent {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** ISO-8601 UTC */
  readonly startsAt: string;
  readonly endsAt: string;
  /** added to ALPHA_CHANCE / VARIANT_CHANCE */
  readonly alphaBonus: number;
  readonly variantBonus: number;
  readonly featuredZones: readonly ZoneId[];
  readonly featuredSpecies: readonly string[];
}

export interface DailySwarm {
  readonly id: string;
  readonly zoneId: ZoneId;
  readonly species: readonly string[];
  readonly weightBoost: number;
}

export interface RaidHotspot {
  readonly id: string;
  readonly zoneId: ZoneId;
  readonly x: number;
  readonly z: number;
  readonly boss: { readonly species: string; readonly level: number; readonly hpMultiplier: number };
  readonly minBadges: number;
  readonly window: { readonly utcHour: number; readonly minutes: number };
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type WeekdayVariant = Readonly<Record<Weekday, VariantKey | null>>;

// ─── §3.7 Variant palettes ───────────────────────────────────────────────────

export interface VariantPalette {
  readonly hue: number;
  readonly saturation: number;
  readonly lightness: number;
}
export type VariantPalettes = Readonly<Record<VariantKey, VariantPalette | null>>;

// ─── §3.9 Battle Pass ────────────────────────────────────────────────────────

export interface BattlePassReward {
  readonly level: number;
  readonly label: string;
  readonly rarity: Rarity | 'epic';
  readonly money: number;
  readonly items: Readonly<Record<string, number>>;
  readonly creature: { readonly species: string; readonly level: number } | null;
  /** level 50 only: ['lumyth', 'noxmyth'] */
  readonly mythicalChoice: readonly string[] | null;
}

// ─── §3.12 Bodies ────────────────────────────────────────────────────────────

/** look = models.manifest.json `looks` key (40-pipelines.md §40.2.5) */
export interface BodyDef {
  readonly id: string;
  readonly name: string;
  readonly look: string;
  readonly palette: string | null;
}

// ─── roster report (roster-coverage.md §4.2) ─────────────────────────────────

export type AcquisitionPath =
  | { readonly kind: 'wild'; readonly zones: readonly ZoneId[] }
  | { readonly kind: 'evolve'; readonly from: string; readonly atLevel: number }
  | { readonly kind: 'static'; readonly zoneId: ZoneId; readonly when: StaticGate }
  | { readonly kind: 'quest'; readonly questId: string }
  | { readonly kind: 'raid'; readonly zones: readonly ZoneId[] };

export interface RosterReport {
  readonly species: number;
  readonly families: number;
  /** |E| in spine rule 7 */
  readonly directlyPlaced: number;
  /** |R(E) ∪ statics ∪ mythicals| — must be 130 */
  readonly obtainable: number;
  /** must be [] */
  readonly unobtainable: readonly string[];
  /** one primary path per species id */
  readonly paths: Readonly<Record<string, AcquisitionPath>>;
  /** distinct species per table, sorted */
  readonly perZone: Readonly<Partial<Record<ZoneId, readonly string[]>>>;
  /** roster-coverage RC-1 … RC-13 failures, empty when clean */
  readonly ruleFailures: readonly string[];
}

// ─── validate() result ───────────────────────────────────────────────────────

export interface ValidationStats {
  readonly species: number;
  readonly moves: number;
  readonly abilities: number;
  readonly items: number;
  readonly orbs: number;
  readonly consumables: number;
  readonly types: number;
  readonly zones: number;
  readonly encounterTables: number;
  readonly encounterSlots: number;
  readonly statics: number;
  readonly league: number;
  readonly quests: number;
  readonly storyBeats: number;
  readonly seasonalEvents: number;
  readonly dailySwarms: number;
  readonly raidHotspots: number;
  readonly battlePassLevels: number;
  readonly bodies: number;
  readonly flags: number;
  readonly roster: RosterReport;
  /** Z(zone) of §3.10 rule 11, sorted, per zone */
  readonly bindSets: Readonly<Record<ZoneId, readonly string[]>>;
  /**
   * per-zone heightfield digest and walkable ratio; `terrainWalkable` is the ratio before the zone plan's footprints
   * were stamped, `footprintSamples` the samples they made unwalkable, `solids` the plan's footprint count
   */
  readonly heightfields: Readonly<
    Record<
      ZoneId,
      {
        readonly digest: string;
        readonly walkable: number;
        readonly water: number;
        readonly terrainWalkable: number;
        readonly footprintSamples: number;
        readonly solids: number;
      }
    >
  >;
  /**
   * §3.10 rules 9 / 12: authored coordinates (spawn, npcs, trainers, items, lore, warps, statics, raid hotspots) whose
   * own sample is not walkable, and the walkable sample `nearestWalkable(h, x, z, 8)` snaps them to. `cause` names the
   * plan footprint covering the sample, or 'terrain' (margin, slope, water).
   */
  readonly snapped: readonly {
    readonly zoneId: ZoneId;
    readonly what: string;
    readonly x: number;
    readonly z: number;
    readonly toX: number;
    readonly toZ: number;
    readonly cause: string;
  }[];
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly stats: ValidationStats;
}
