/**
 * A living ecosystem: the species of a zone hunt and feed each other, players' catches and knockouts press on them week
 * by week, a few species migrate once a ranked season, and the zone's honor tilts what turns up. Pure: the server keeps
 * the tallies (per zone, per week, per species) and calls `ecosystemOf`; the room rolls its encounters on the table it
 * returns, and the Dex shows the same reading ("This week on <zone>").
 *
 * The rules, kept legible:
 * - **Food chain:** `FOOD_CHAIN_HAND` rows where it is obvious, then a type rule for the rest (`huntsByType`): a
 *   predator hits the prey super effectively with one of its types, the prey hits it back with neither, the predator is
 *   bigger (base stat total at least `PREDATOR_BST_MARGIN` higher), neither is legendary and they are not one family.
 *   A link only exists between species that share a zone's table.
 * - **Pressure:** a species' take is this week's catches and knockouts plus `ECO_LAST_WEEK_WEIGHT` of last week's, so
 *   a species left alone recovers within two weeks. Below `ECO_MIN_TAKES` takes in the zone nothing is judged. A species
 *   taken more than its share of the table (its authored weight share) is overhunted: `overhunt` runs 0..1 from its
 *   fair share to four times it. Its weight falls by 2^-overhunt; each predator of it rises by 2^(the most overhunted
 *   prey it has here). The pressure factor is `2^(surge - overhunt)`, so always within 0.5x..2x.
 * - **Migration:** once a ranked season (four weeks, seasons.ts), `MIGRATIONS_PER_SEASON` of `MIGRATION_ROUTES` shift:
 *   the species joins the target's table (`MIGRANT_WEIGHT`, uncommon, at the target's level band) and its source slots
 *   weigh `MIGRANT_SOURCE_FACTOR`. A route only exists where the target zone's sprite atlases already hold the species
 *   (the client binds a zone's atlases on arrival, planned from roster-coverage.md; a client test checks every route
 *   against the shipped manifest), between linked zones or two zones one table-less town apart.
 * - **Honor tilt** (worldHonor.ts): in a darkened zone (shadow level 1..4) Ghost species that are not Dark weigh
 *   `1 + SHADOW_GHOST_BOOST * level` (Dark species already weigh `shadowDarkWeight` in the roll itself, rollWild); in a
 *   lit zone (`lightLevel` 1..4) its rare slots weigh `1 + LIGHT_RARE_BOOST * level`.
 * - Every slot's ecosystem factor (pressure, migration and tilt together) is clamped to `ECO_FACTOR_MIN..ECO_FACTOR_MAX`.
 */
import { createRng } from '@ewa/core';
import type { SpeciesDef, TypeName } from '@ewa/core';
import type { EncounterSlot, EncounterTable, ZoneDef, ZoneId } from '../types';
import { ENCOUNTER_BANDS, ENCOUNTER_TABLES } from './encounters';
import { SEASON_ANCHOR_MS } from './seasons';
import { SPECIES } from './species';
import { TYPE_CHART } from './typechart';
import { SHADOW_MAX, shadowDarkWeight } from './worldHonor';
import { ZONES } from './zones';

/** A week of tallies: Monday 00:00 UTC to Monday, aligned with the seasons (the anchor is a Monday). */
export const ECO_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Takes (catches + knockouts, last week's weighted) a zone needs before any species counts as overhunted. */
export const ECO_MIN_TAKES = 12;
/** How much of last week's takes still press this week (two weeks left alone and a species is back). */
export const ECO_LAST_WEEK_WEIGHT = 0.5;
/** Every slot stays within these multiples of its authored weight. */
export const ECO_FACTOR_MIN = 0.5;
export const ECO_FACTOR_MAX = 2;
/** The panel calls a species surging at this factor or above, scarce at its inverse or below. */
export const ECO_NOTABLE = 1.15;
/** A predator's base stat total is at least this much higher than its prey's. */
export const PREDATOR_BST_MARGIN = 20;
export const MIGRATIONS_PER_SEASON = 3;
/** A migrant's weight in the target's table (an uncommon slot). */
export const MIGRANT_WEIGHT = 4;
/** What a migrant's slots weigh at home while it is away. */
export const MIGRANT_SOURCE_FACTOR = 0.5;
/** Per shadow level: Ghost species (not Dark) in a darkened zone (level 4: twice as often). */
export const SHADOW_GHOST_BOOST = 0.25;
/** Per light level: rare slots in a lit zone (level 4: twice as often). */
export const LIGHT_RARE_BOOST = 0.25;

const speciesById: ReadonlyMap<string, SpeciesDef> = new Map(SPECIES.map((s) => [s.id, s]));
const tableByZone: ReadonlyMap<ZoneId, EncounterTable> = new Map(ENCOUNTER_TABLES.map((t) => [t.zoneId, t]));
const zoneById: ReadonlyMap<ZoneId, ZoneDef> = new Map(ZONES.map((z) => [z.id, z]));
const sp = (id: string): SpeciesDef => {
  const s = speciesById.get(id);
  if (s === undefined) throw new RangeError(`unknown species '${id}'`);
  return s;
};

/** The ecosystem week at `atMs` (0 = the week of the first season's start; negative before it). */
export function ecoWeek(atMs: number): number {
  return Math.floor((atMs - SEASON_ANCHOR_MS) / ECO_WEEK_MS);
}
/** When ecosystem week `week` starts (ms). */
export function ecoWeekStart(week: number): number {
  return SEASON_ANCHOR_MS + week * ECO_WEEK_MS;
}

// ─── Food chain ─────────────────────────────────────────────────────────────────────────────────────────────────────

export interface FoodLink {
  readonly predator: string;
  readonly prey: string;
  /** 'hand': a FOOD_CHAIN_HAND row; 'type': the type rule */
  readonly source: 'hand' | 'type';
}

/** The obvious ones, where the type rule would miss them: a link holds in every zone both species share. */
export const FOOD_CHAIN_HAND: readonly { readonly predator: string; readonly prey: string }[] = Object.freeze([
  // the night hunters and the rats of Hollow Route and the Rift
  { predator: 'darkone', prey: 'murkrat' },
  { predator: 'umbrit', prey: 'murkrat' },
  // the big fish of the harbour and the tide take the small ones
  { predator: 'kygra', prey: 'glimfin' },
  { predator: 'kygra', prey: 'mudbub' },
  // the great flame of Ash Route feeds on the candles
  { predator: 'moflame', prey: 'wickling' },
  // the ice drake and the water drake on the heights
  { predator: 'glacifang', prey: 'tidalfang' },
  // the castle under the dome swallows the little idols
  { predator: 'castlemaw', prey: 'rimeidol' },
  // the mire's bear cub and the slow grazers
  { predator: 'bramblecub', prey: 'mufflo' },
  { predator: 'bramblecub', prey: 'smellduck' },
  // the storm route's night prowler and its fledglings and flock
  { predator: 'darkone', prey: 'stormchick' },
  { predator: 'darkone', prey: 'mufflo' },
  // the park pond's duck and the buds and sprites of Solenne's lawns
  { predator: 'smellduck', prey: 'dreambud' },
  { predator: 'smellduck', prey: 'glimp' },
]);

const bst = (s: SpeciesDef): number => s.baseHp + s.baseAtk + s.baseDef + s.baseSpd;

function familyRoot(s: SpeciesDef): string {
  let cur = s;
  for (let i = 0; i < 8 && cur.evolvesFrom !== null; i++) cur = sp(cur.evolvesFrom);
  return cur.id;
}

/** How hard one attacking type hits a defender's types (the chart's product). */
function hit(t: TypeName, defender: SpeciesDef): number {
  let m = 1;
  for (const d of defender.types) m *= TYPE_CHART[t]?.[d] ?? 1;
  return m;
}

/** The type rule: `p` hunts `q` (see the module comment). */
export function huntsByType(p: SpeciesDef, q: SpeciesDef): boolean {
  if (p.id === q.id || p.legendary || q.legendary) return false;
  if (familyRoot(p) === familyRoot(q)) return false;
  if (bst(p) < bst(q) + PREDATOR_BST_MARGIN) return false;
  if (!p.types.some((t) => hit(t, q) >= 2)) return false;
  return !q.types.some((t) => hit(t, p) >= 2);
}

/** The food chain among `species` (the species of one zone's table): hand rows first, then the type rule. */
export function foodChainAmong(species: readonly string[]): readonly FoodLink[] {
  const ids = [...new Set(species)];
  const present = new Set(ids);
  const out: FoodLink[] = [];
  const seen = new Set<string>();
  for (const h of FOOD_CHAIN_HAND) {
    if (!present.has(h.predator) || !present.has(h.prey)) continue;
    seen.add(`${h.predator}>${h.prey}`);
    out.push({ predator: h.predator, prey: h.prey, source: 'hand' });
  }
  for (const p of ids) {
    for (const q of ids) {
      const key = `${p}>${q}`;
      if (seen.has(key) || seen.has(`${q}>${p}`)) continue;
      if (!huntsByType(sp(p), sp(q))) continue;
      seen.add(key);
      out.push({ predator: p, prey: q, source: 'type' });
    }
  }
  return out;
}

const chainCache = new Map<ZoneId, readonly FoodLink[]>();
/** The food chain of a zone's authored table ([] for a zone without one). */
export function foodChain(zoneId: ZoneId): readonly FoodLink[] {
  let c = chainCache.get(zoneId);
  if (c === undefined) {
    const t = tableByZone.get(zoneId);
    c = t === undefined ? [] : foodChainAmong(t.slots.map((s) => s.species));
    chainCache.set(zoneId, c);
  }
  return c;
}

// ─── Seasonal migration ─────────────────────────────────────────────────────────────────────────────────────────────

export interface MigrationRoute {
  readonly species: string;
  readonly from: ZoneId;
  readonly to: ZoneId;
}

/**
 * Every migration a season can draw. Each species already sits in the target zone's sprite atlases (the shipped
 * manifest's `zones[to]`; client test `ecosystem-sprites.test.ts`), so a migrant costs the client no new texture.
 */
export const MIGRATION_ROUTES: readonly MigrationRoute[] = Object.freeze([
  { species: 'tidespine', from: 'tide_route', to: 'galvan_route' },
  { species: 'rimeidol', from: 'deepcut_route', to: 'galvan_route' },
  { species: 'yaschamp', from: 'the_rift', to: 'galvan_route' },
  { species: 'shardling', from: 'galvan_route', to: 'the_rift' },
  { species: 'wooltug', from: 'deepcut_route', to: 'umbral_observatory' },
  { species: 'flowbot', from: 'siege_route', to: 'skyrend' },
  { species: 'bloomdrake', from: 'ascent_route', to: 'skyrend' },
  { species: 'serpyre', from: 'ascent_route', to: 'skyrend' },
  { species: 'malice', from: 'eclipse_shrine', to: 'ascent_route' },
  { species: 'devourest', from: 'eclipse_shrine', to: 'ascent_route' },
  { species: 'zaptus', from: 'eclipse_shrine', to: 'solenne' },
  { species: 'nebucloak', from: 'eclipse_shrine', to: 'solenne' },
] satisfies MigrationRoute[]);

/** Whether `to` is one link from `from`, or two through a town without an encounter table. */
export function neighbourZones(from: ZoneId, to: ZoneId): boolean {
  const a = zoneById.get(from);
  if (a === undefined || from === to) return false;
  for (const b of Object.values(a.links).sort()) {
    if (b === undefined) continue;
    if (b === to) return true;
    const mid = zoneById.get(b);
    if (mid === undefined || mid.encounterTable !== null) continue;
    if (Object.values(mid.links).sort().includes(to)) return true;
  }
  return false;
}

/** The lowest level a species can be met at: its parent's evolution level when it evolves by level, else 1. */
function minLevelOf(s: SpeciesDef): number {
  if (s.evolvesFrom === null) return 1;
  const ev = sp(s.evolvesFrom).evolution;
  if (ev === null) return 1;
  return ev.kind === 'level' || ev.kind === 'split' ? ev.atLevel : 1;
}

/** The slot a migrant takes in its target's table: the target's level band, its time of day and medium at home. */
export function migrantSlot(r: MigrationRoute): EncounterSlot | null {
  const home = tableByZone.get(r.from)?.slots.find((s) => s.species === r.species && s.tier !== 'alpha');
  const band = ENCOUNTER_BANDS[r.to];
  if (home === undefined || band === undefined) return null;
  const lo = Math.max(band[0], minLevelOf(sp(r.species)));
  if (lo > band[1]) return null;
  const medium = home.medium ?? 'land';
  const base = { species: r.species, weight: MIGRANT_WEIGHT, levelMin: lo, levelMax: band[1], timeOfDay: home.timeOfDay, tier: 'uncommon' as const };
  return medium === 'land' ? base : { ...base, medium };
}

const migrationCache = new Map<number, readonly MigrationRoute[]>();
/**
 * The season's migrations: `MIGRATION_ROUTES` shuffled by the season number, then the first that keep one migrant per
 * target zone and per species, up to `MIGRATIONS_PER_SEASON`. None before the first season.
 */
export function migrationsFor(season: number): readonly MigrationRoute[] {
  if (season < 1) return [];
  const hit = migrationCache.get(season);
  if (hit !== undefined) return hit;
  const rng = createRng(`ecosystem:migration:${season}`);
  const pool = [...MIGRATION_ROUTES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const out: MigrationRoute[] = [];
  const targets = new Set<string>();
  const moved = new Set<string>();
  for (const r of pool) {
    if (out.length >= MIGRATIONS_PER_SEASON) break;
    if (targets.has(r.to) || moved.has(r.species) || migrantSlot(r) === null) continue;
    out.push(r);
    targets.add(r.to);
    moved.add(r.species);
  }
  const frozen = Object.freeze(out);
  migrationCache.set(season, frozen);
  return frozen;
}

// ─── The reading ────────────────────────────────────────────────────────────────────────────────────────────────────

export interface SpeciesTake {
  readonly speciesId: string;
  readonly caught: number;
  readonly ko: number;
}

export interface EcoInput {
  readonly zoneId: ZoneId;
  readonly season: number;
  readonly thisWeek: readonly SpeciesTake[];
  readonly lastWeek: readonly SpeciesTake[];
  /** the zone's shadow level this season (worldHonor `shadowLevel`) */
  readonly shadow: number;
  /** the zone's light level this season (worldHonor `lightLevel`) */
  readonly light: number;
}

/** Why a species weighs what it does this week (the strongest reason). */
export type EcoCause = 'hunted' | 'feeding' | 'shadow' | 'light' | 'migrant' | 'away';

export interface EcoSpecies {
  readonly speciesId: string;
  /** its weight this week over its authored weight (1 = as authored; a migrant's over MIGRANT_WEIGHT) */
  readonly factor: number;
  /** 0..1: how overhunted it is */
  readonly overhunt: number;
  /** 0..1: how much of its prey here is overhunted */
  readonly surge: number;
  /** this week's catches and knockouts */
  readonly caught: number;
  readonly ko: number;
  /** what it hunts and what hunts it here */
  readonly preyOn: readonly string[];
  readonly huntedBy: readonly string[];
  readonly cause: EcoCause | null;
}

export interface Ecosystem {
  readonly zoneId: ZoneId;
  readonly season: number;
  /** the table the zone rolls on this week (the authored one's slots, reweighted, plus migrants) */
  readonly table: EncounterTable;
  readonly species: readonly EcoSpecies[];
  readonly links: readonly FoodLink[];
  readonly migrantsIn: readonly MigrationRoute[];
  readonly migrantsOut: readonly MigrationRoute[];
  readonly shadow: number;
  readonly light: number;
  /** this week's takes in the zone (catches + knockouts) */
  readonly takes: number;
  /** whether the zone has enough history for pressure to count (`ECO_MIN_TAKES`) */
  readonly judged: boolean;
}

const clampFactor = (f: number): number => Math.min(ECO_FACTOR_MAX, Math.max(ECO_FACTOR_MIN, f));
const level = (n: number): number => Math.max(0, Math.min(SHADOW_MAX, Math.trunc(n)));

/** The ecosystem of a zone this week, or null for a zone without an encounter table. */
export function ecosystemOf(input: EcoInput): Ecosystem | null {
  const authored = tableByZone.get(input.zoneId);
  if (authored === undefined) return null;
  const shadow = level(input.shadow);
  const light = level(input.light);
  const migrations = migrationsFor(input.season);
  const migrantsIn = migrations.filter((m) => m.to === input.zoneId);
  const migrantsOut = migrations.filter((m) => m.from === input.zoneId);
  const away = new Set(migrantsOut.map((m) => m.species));
  // base slots: authored, a migrant's home slots lowered, the migrants' slots added (alpha slots stay as they are)
  const base: { readonly slot: EncounterSlot; readonly base: number; readonly migrant: boolean }[] = authored.slots.map((s) => ({
    slot: s,
    base: s.weight * (away.has(s.species) && s.tier !== 'alpha' ? MIGRANT_SOURCE_FACTOR : 1),
    migrant: false,
  }));
  for (const m of migrantsIn) {
    const slot = migrantSlot(m);
    if (slot !== null && !authored.slots.some((s) => s.species === m.species)) base.push({ slot, base: slot.weight, migrant: true });
  }
  const ids = [...new Set(base.map((b) => b.slot.species))];
  const links = foodChainAmong(ids);
  // takes: this week, plus a part of last week
  const takeOf = new Map<string, number>();
  const thisOf = new Map<string, SpeciesTake>();
  const present = new Set(ids);
  for (const t of input.thisWeek) {
    if (!present.has(t.speciesId)) continue;
    thisOf.set(t.speciesId, t);
    takeOf.set(t.speciesId, (takeOf.get(t.speciesId) ?? 0) + t.caught + t.ko);
  }
  for (const t of input.lastWeek) {
    if (!present.has(t.speciesId)) continue;
    takeOf.set(t.speciesId, (takeOf.get(t.speciesId) ?? 0) + ECO_LAST_WEEK_WEIGHT * (t.caught + t.ko));
  }
  let total = 0;
  for (const v of takeOf.values()) total += v;
  const judged = total >= ECO_MIN_TAKES;
  let baseTotal = 0;
  const baseOf = new Map<string, number>();
  for (const b of base) {
    baseTotal += b.base;
    baseOf.set(b.slot.species, (baseOf.get(b.slot.species) ?? 0) + b.base);
  }
  const overhunt = new Map<string, number>();
  for (const id of ids) {
    if (!judged || baseTotal <= 0) {
      overhunt.set(id, 0);
      continue;
    }
    const share = (takeOf.get(id) ?? 0) / total;
    const fair = (baseOf.get(id) ?? 0) / baseTotal;
    const ratio = fair > 0 ? share / fair : 0;
    overhunt.set(id, ratio <= 1 ? 0 : Math.min(1, Math.log2(ratio) / 2));
  }
  const preyOf = (id: string): string[] => links.filter((k) => k.predator === id).map((k) => k.prey);
  const huntersOf = (id: string): string[] => links.filter((k) => k.prey === id).map((k) => k.predator);
  const surge = new Map<string, number>();
  for (const id of ids) surge.set(id, preyOf(id).reduce((m, q) => Math.max(m, overhunt.get(q) ?? 0), 0));
  const speciesFactor = (id: string): number => {
    const s = sp(id);
    let f = 2 ** ((surge.get(id) ?? 0) - (overhunt.get(id) ?? 0));
    if (shadow > 0 && s.types.includes('Ghost') && !s.types.includes('Dark')) f *= 1 + SHADOW_GHOST_BOOST * shadow;
    return f;
  };
  const slots: EncounterSlot[] = base.map((b) => {
    const f = speciesFactor(b.slot.species) * (light > 0 && b.slot.tier === 'rare' ? 1 + LIGHT_RARE_BOOST * light : 1);
    return { ...b.slot, weight: b.slot.weight * clampFactor((b.base / b.slot.weight) * f) };
  });
  const table: EncounterTable = { id: authored.id, zoneId: authored.zoneId, slots };
  const species: EcoSpecies[] = ids.map((id) => {
    let was = 0;
    let now = 0;
    for (let i = 0; i < base.length; i++) {
      if (base[i]!.slot.species !== id) continue;
      was += base[i]!.slot.weight;
      now += slots[i]!.weight;
    }
    // the roll itself weighs Dark species in a darkened zone (rollWild); the reading shows it
    const s = sp(id);
    const dark = shadow > 0 && s.types.includes('Dark') ? shadowDarkWeight(shadow) : 1;
    const factor = was > 0 ? (now / was) * dark : 1;
    const o = overhunt.get(id) ?? 0;
    const g = surge.get(id) ?? 0;
    const migrant = migrantsIn.some((m) => m.species === id);
    const cause: EcoCause | null = migrant
      ? 'migrant'
      : o > 0 && o >= g
        ? 'hunted'
        : g > 0
          ? 'feeding'
          : away.has(id)
            ? 'away'
            : dark > 1 || (shadow > 0 && s.types.includes('Ghost'))
              ? 'shadow'
              : light > 0 && base.some((b) => b.slot.species === id && b.slot.tier === 'rare')
                ? 'light'
                : null;
    const t = thisOf.get(id);
    return { speciesId: id, factor, overhunt: o, surge: g, caught: t?.caught ?? 0, ko: t?.ko ?? 0, preyOn: preyOf(id), huntedBy: huntersOf(id), cause };
  });
  let takes = 0;
  for (const t of thisOf.values()) takes += t.caught + t.ko;
  return { zoneId: input.zoneId, season: input.season, table, species, links, migrantsIn, migrantsOut, shadow, light, takes, judged };
}

/** The panel's surging species (factor at or above `ECO_NOTABLE`), strongest first. */
export function surging(e: Ecosystem): readonly EcoSpecies[] {
  return e.species.filter((s) => s.factor >= ECO_NOTABLE && s.cause !== 'migrant').sort((a, b) => b.factor - a.factor || a.speciesId.localeCompare(b.speciesId));
}
/** The panel's scarce species (factor at or below 1 / `ECO_NOTABLE`), scarcest first. */
export function scarce(e: Ecosystem): readonly EcoSpecies[] {
  return e.species.filter((s) => s.factor <= 1 / ECO_NOTABLE).sort((a, b) => a.factor - b.factor || a.speciesId.localeCompare(b.speciesId));
}
