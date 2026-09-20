/**
 * Zone sets for the atlas planner (spec §40.1.4):
 *
 *   Z(zone) = species(ENCOUNTER_TABLES[zone])              15 zones have a table
 *           ∪ { s.species : s ∈ LEGENDARY_STATICS, s.zoneId = zone }
 *           ∪ { t.species : t ∈ ZoneDef.trainers[*].team }
 *           ∪ { t.species : t ∈ LEAGUE, t.zoneId = zone }   the town's gym; solenne's elite + champion
 *
 * `@ewa/content` does not export the tables yet (OQ-4), so the encounter tables and the
 * legendary statics are parsed from the machine-parsed tables of `.design/roster-coverage.md`
 * (§6 `zoneId | species | weight | levelMin | levelMax | time | tier | medium` and §7
 * `species | level | zoneId | …`); trainer and league teams come from the legacy `world.js`
 * via `legacy.ts`. Swapping the source for `@ewa/content` changes nothing downstream.
 */
import { readFileSync } from 'node:fs';
import type { LegacyData } from './legacy.js';

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
const ZONE_SET: ReadonlySet<string> = new Set(ZONE_ORDER);

export function isZoneId(v: string): v is ZoneId {
  return ZONE_SET.has(v);
}

export interface RosterTables {
  /** Zone -> distinct species in table order (§6). */
  encounters: Map<ZoneId, string[]>;
  /** §7 rows. */
  statics: Array<{ species: string; zoneId: ZoneId }>;
}

function cells(line: string): string[] | null {
  const t = line.trim();
  if (!t.startsWith('|') || !t.endsWith('|')) return null;
  return t
    .slice(1, -1)
    .split('|')
    .map((c) => c.trim());
}

/** Parses §6 (spawn tables) and §7 (legendary statics) of `roster-coverage.md`. */
export function parseRosterTables(markdown: string): RosterTables {
  const lines = markdown.split(/\r?\n/);
  const encounters = new Map<ZoneId, string[]>();
  const statics: RosterTables['statics'] = [];
  let section: 'none' | 'spawn' | 'statics' = 'none';
  for (const line of lines) {
    const h = line.match(/^## (\d+)\./);
    if (h) {
      const n = Number(h[1]);
      section = n === 6 ? 'spawn' : n === 7 ? 'statics' : 'none';
      continue;
    }
    if (section === 'none') continue;
    const c = cells(line);
    if (!c || c.length < 3 || c[0] === 'zoneId' || c[0] === 'species' || /^-+$/.test(c[0]!)) continue;
    if (section === 'spawn') {
      if (c.length < 8 || !isZoneId(c[0]!)) continue;
      const list = encounters.get(c[0]) ?? [];
      if (!list.includes(c[1]!)) list.push(c[1]!);
      encounters.set(c[0], list);
    } else if (c.length >= 3 && /^[a-z0-9_]+$/.test(c[0]!) && isZoneId(c[2]!)) {
      statics.push({ species: c[0]!, zoneId: c[2] });
    }
  }
  return { encounters, statics };
}

export function loadRosterTables(rosterPath: string): RosterTables {
  return parseRosterTables(readFileSync(rosterPath, 'utf8'));
}

export type ZoneSets = Map<ZoneId, string[]>;

export interface ZoneInputs {
  /** Z(zone): everything (placement affinity). */
  sets: ZoneSets;
  /** The league-team part of Z(zone): deferrable to `home` crops when a zone cannot hold the cap. */
  league: ZoneSets;
}

export interface ZoneSetInput {
  roster: RosterTables | null;
  legacy: Pick<LegacyData, 'league' | 'trainers'> | null;
}

/**
 * Z(zone) for all 21 zones (sorted species; every zone present, possibly empty). Species not
 * in `known` are an error: a roster typo must not silently drop a creature from its zone.
 */
export function buildZoneSets(input: ZoneSetInput, known: ReadonlySet<string>): ZoneSets {
  return buildZoneInputs(input, known).sets;
}

export function buildZoneInputs(input: ZoneSetInput, known: ReadonlySet<string>): ZoneInputs {
  const sets = new Map<ZoneId, Set<string>>();
  const league = new Map<ZoneId, Set<string>>();
  for (const z of ZONE_ORDER) {
    sets.set(z, new Set());
    league.set(z, new Set());
  }
  const unknown: string[] = [];
  const add = (zone: string | null, species: string, origin: string, isLeague = false): void => {
    if (!zone || !isZoneId(zone)) return;
    if (!known.has(species)) {
      unknown.push(`${species} (${origin} in ${zone})`);
      return;
    }
    sets.get(zone)!.add(species);
    if (isLeague) league.get(zone)!.add(species);
  };
  if (input.roster) {
    for (const [zone, list] of input.roster.encounters) for (const s of list) add(zone, s, 'encounter table');
    for (const s of input.roster.statics) add(s.zoneId, s.species, 'legendary static');
  }
  if (input.legacy) {
    for (const t of input.legacy.trainers) for (const s of t.species) add(t.zoneId, s, `trainer ${t.id}`);
    for (const t of input.legacy.league) for (const s of t.species) add(t.zoneId, s, `league ${t.id}`, true);
  }
  if (unknown.length) throw new Error(`zone sets reference unknown species: ${[...new Set(unknown)].sort().join(', ')}`);
  const outSets: ZoneSets = new Map();
  const outLeague: ZoneSets = new Map();
  for (const z of ZONE_ORDER) {
    outSets.set(z, [...sets.get(z)!].sort());
    // A species that is also a field species (table / static / trainer) is never deferrable.
    outLeague.set(z, [...league.get(z)!].filter((s) => !isField(input, z, s)).sort());
  }
  return { sets: outSets, league: outLeague };
}

function isField(input: ZoneSetInput, zone: ZoneId, species: string): boolean {
  if (input.roster?.encounters.get(zone)?.includes(species)) return true;
  if (input.roster?.statics.some((s) => s.zoneId === zone && s.species === species)) return true;
  return input.legacy?.trainers.some((t) => t.zoneId === zone && t.species.includes(species)) ?? false;
}
