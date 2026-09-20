/**
 * Atlas planning (spec §40.1.4) — every species once, packed by zone affinity.
 *
 * Species are laid out in one global sequence: walk `ZONE_ORDER`; for each zone append the
 * species of Z(zone) not yet placed, sorted by id; finally append every species in no zone
 * set (`home` species), sorted by id. Consecutive pairs form atlases `a-000, a-001, …` of
 * 2048² holding 2 species (front + back each).
 *
 * `zones[zone]` is the sorted list of atlases holding Z(zone). When a zone would bind more
 * than `cap` atlases, the planner duplicates the earliest-placed species of that zone into a
 * zone-local atlas `a-<zoneId>-dup-N` (2 species each) until the cap holds. `home` is a
 * species' first placement; the duplicate is recorded in `alt` so the client can find it.
 */
import { MAX_ATLASES_PER_ZONE, compareStrings } from './types.js';
import type { ZoneId, ZoneSets } from './zones.js';
import { ZONE_ORDER } from './zones.js';

export interface AtlasPlan {
  id: string;
  /** 1–2 species, sorted. */
  species: string[];
  /** Zone-local duplicate atlas (`a-<zoneId>-dup-N`). */
  dupFor: ZoneId | null;
}

export interface BindStat {
  atlases: number;
  duplicated: string[];
  /**
   * Species of Z(zone) the zone does NOT bind because even the ideal packing (2 species per
   * atlas) exceeds the cap; they are league-team species served from `home` at runtime
   * (only solenne, whose Z = park table + 3 elite teams + champion = 26 species).
   */
  unbound: string[];
}

export interface ZonePlan {
  /** Sorted by id: `a-000 … a-NNN`, then `a-<zoneId>-dup-N`. */
  atlases: AtlasPlan[];
  /** Species -> home atlas id (first placement). */
  home: Map<string, string>;
  /** Species -> every atlas id holding it (home first, then duplicates in id order). */
  placements: Map<string, string[]>;
  /** Zone -> sorted atlas ids (≤ cap), every zone present. */
  zones: Map<ZoneId, string[]>;
  bindStats: Record<string, BindStat>;
  /** Distinct species duplicated anywhere, sorted. */
  duplicated: string[];
}

export function atlasId(index: number): string {
  return `a-${String(index).padStart(3, '0')}`;
}

export function compareAtlasIds(a: string, b: string): number {
  return compareStrings(a, b);
}

/** The global species sequence (spec §40.1.4 "Order"). */
export function speciesSequence(speciesIds: readonly string[], zoneSets: ZoneSets): string[] {
  const known = new Set(speciesIds);
  const placed = new Set<string>();
  const seq: string[] = [];
  for (const zone of ZONE_ORDER) {
    for (const s of [...(zoneSets.get(zone) ?? [])].sort(compareStrings)) {
      if (!known.has(s) || placed.has(s)) continue;
      placed.add(s);
      seq.push(s);
    }
  }
  for (const s of [...speciesIds].sort(compareStrings)) {
    if (placed.has(s)) continue;
    placed.add(s);
    seq.push(s);
  }
  return seq;
}

/**
 * @param deferrable zone -> species that may be left out of the bind list (league teams) when
 *   `ceil(|Z| / 2) > cap`, i.e. when no packing at all can hold the cap for that zone.
 */
export function planAtlases(speciesIds: readonly string[], zoneSets: ZoneSets, cap = MAX_ATLASES_PER_ZONE, deferrable: ZoneSets = new Map()): ZonePlan {
  const seq = speciesSequence(speciesIds, zoneSets);
  const atlases: AtlasPlan[] = [];
  const home = new Map<string, string>();
  const homeIndex = new Map<string, number>();
  for (let i = 0; i < seq.length; i += 2) {
    const species = seq.slice(i, i + 2).sort(compareStrings);
    const id = atlasId(atlases.length);
    atlases.push({ id, species, dupFor: null });
    for (const s of species) {
      home.set(s, id);
      homeIndex.set(s, atlases.length - 1);
    }
  }

  const present = new Set(seq);
  const zones = new Map<ZoneId, string[]>();
  const bindStats: Record<string, BindStat> = {};
  const placements = new Map<string, string[]>();
  for (const s of seq) placements.set(s, [home.get(s)!]);

  for (const zone of ZONE_ORDER) {
    const members = [...(zoneSets.get(zone) ?? [])].filter((s) => present.has(s)).sort(compareStrings);
    const canFit = (list: readonly string[]): boolean => Math.ceil(list.length / 2) <= cap;
    // Everything when it can fit; otherwise the field species (table, statics, overworld
    // trainers) with the league teams deferred to `home` crops.
    const deferred = new Set(deferrable.get(zone) ?? []);
    const field = members.filter((s) => !deferred.has(s));
    if (!canFit(field)) throw new Error(`zone ${zone}: ${field.length} non-deferrable species cannot bind within ${cap} atlases of 2 species`);
    const bindSet = canFit(members) ? members : field;
    // Species -> atlas this zone binds it from (home unless duplicated for this zone).
    const bindFrom = new Map<string, string>();
    for (const s of bindSet) bindFrom.set(s, home.get(s)!);
    const binds = (): string[] => [...new Set(bindFrom.values())].sort(compareAtlasIds);

    const duplicated: string[] = [];
    let open: AtlasPlan | null = null;
    // Earliest-placed first (spec: "duplicates the earliest-placed species of that zone").
    const candidates = [...bindSet].sort((a, b) => homeIndex.get(a)! - homeIndex.get(b)! || compareStrings(a, b));
    for (const s of candidates) {
      if (binds().length <= cap) break;
      if (!open || open.species.length >= 2) {
        open = { id: `a-${zone}-dup-${duplicated.length >> 1}`, species: [], dupFor: zone };
        atlases.push(open);
      }
      open.species.push(s);
      open.species.sort(compareStrings);
      bindFrom.set(s, open.id);
      duplicated.push(s);
      placements.get(s)!.push(open.id);
    }
    let list = binds();
    if (list.length > cap) throw new Error(`zone ${zone} needs ${list.length} atlases even after duplicating ${duplicated.length} species (cap ${cap})`);
    // Deferred species whose home atlas is bound anyway ride along; the rest fill up to the
    // cap in placement order, and whatever is left is served from `home`.
    const unbound: string[] = [];
    if (bindSet !== members) {
      const bound = new Set(list);
      const league = members.filter((s) => deferred.has(s)).sort((a, b) => homeIndex.get(a)! - homeIndex.get(b)! || compareStrings(a, b));
      for (const s of league) {
        const h = home.get(s)!;
        if (bound.has(h)) continue;
        if (bound.size < cap) bound.add(h);
        else unbound.push(s);
      }
      list = [...bound].sort(compareAtlasIds);
    }
    zones.set(zone, list);
    bindStats[zone] = { atlases: list.length, duplicated: [...duplicated].sort(compareStrings), unbound: unbound.sort(compareStrings) };
  }

  atlases.sort((a, b) => compareAtlasIds(a.id, b.id));
  const duplicated = [...new Set(Object.values(bindStats).flatMap((b) => b.duplicated))].sort(compareStrings);
  // Home first, then duplicates in id order.
  for (const [s, list] of placements) {
    const h = home.get(s)!;
    placements.set(s, [h, ...list.filter((a) => a !== h).sort(compareAtlasIds)]);
  }
  return { atlases, home, placements, zones, bindStats, duplicated };
}
