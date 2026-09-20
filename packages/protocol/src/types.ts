/**
 * Structural copies of @ewa/content types the wire refers to.
 *
 * TODO(content): @ewa/content is being implemented concurrently and currently exports nothing, so
 * every alias below is copied verbatim from `.design/spec/00-spine.md` §3 rather than imported.
 * Re-point them at `import type { … } from '@ewa/content'` once content ships them; the shapes
 * are identical, so the switch is a pure re-export with no behavioural change. Value-level copies
 * (the id tuples) exist because zod enums need runtime lists and protocol may import only TYPES
 * from content.
 */
import type { Rarity, VariantKey } from '@ewa/core';

// ---- §3.1 ZoneId / BadgeId / HarvestState -------------------------------------------------------

export const ZONE_IDS = [
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
export type ZoneId = (typeof ZONE_IDS)[number];

export const BADGE_IDS = ['bloom', 'ember', 'current', 'circuit', 'fault', 'wraith', 'anvil', 'ascend'] as const;
export type BadgeId = (typeof BADGE_IDS)[number];

export const HARVEST_STATES = ['intact', 'thinning', 'harvested'] as const;
export type HarvestState = (typeof HARVEST_STATES)[number];

/** §2.8 (core owns the type; the runtime list is needed for zod enums). */
export const VARIANT_KEYS = ['normal', 'dawn', 'dusk', 'verdant', 'ember'] as const satisfies readonly VariantKey[];

/** §4.7 `POST /auth/register` starters (the only three). */
export const STARTERS = ['bramblecub', 'glimfin', 'cindercap'] as const;
export type StarterId = (typeof STARTERS)[number];

/** §4.7 `POST /battle-pass/mythical-choice` (level 50, once per account). */
export const MYTHICAL_CHOICES = ['lumyth', 'noxmyth'] as const;
export type MythicalChoice = (typeof MYTHICAL_CHOICES)[number];

// ---- §3.9 Battle Pass -------------------------------------------------------------------------

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

// ---- §30.9 live-ops summary (GET /me.liveOps) ---------------------------------------------------

export interface MissionProgress {
  readonly id: string;
  readonly title: string;
  readonly target: number;
  readonly count: number;
  readonly done: boolean;
  readonly claimed: boolean;
  readonly reward: { readonly money: number; readonly items: Readonly<Record<string, number>> };
}

/**
 * TODO(spec): `LiveOpsSummary` is named in §4.7 (`GET /me`) and §30.6.3 ("§30.9 summary") but no
 * section defines its fields. This is the minimal shape §30.9.1–§30.9.2 imply; the zod schema in
 * rest.ts is a looseObject so the server may add fields without breaking clients.
 */
export interface LiveOpsSummary {
  readonly dayKey: string;
  readonly weekKey: string;
  readonly weekdayVariant: VariantKey | null;
  readonly swarm: { readonly zoneId: ZoneId; readonly species: readonly string[] } | null;
  readonly activeEvents: readonly { readonly id: string; readonly name: string; readonly endsAt: string }[];
  readonly dailyMissions: readonly MissionProgress[];
  readonly weeklyGoals: readonly MissionProgress[];
  readonly loginStreak: number;
}

// ---- §4.4 progression ---------------------------------------------------------------------------

export interface QuestProgressEntry {
  readonly questId: string;
  readonly objectiveId: string;
  readonly count: number;
  readonly done: boolean;
}
