/**
 * Atlas planning (spec §40.1.4) — every species once, packed by zone affinity.
 *
 * Species are laid out in one global sequence: walk `ZONE_ORDER`; for each zone append the
 * species of Z(zone) not yet placed, sorted by id; finally append every species in no zone
 * set (`home` species), sorted by id. Atlases `a-000, a-001, …` (2048², 2 species = 4 sprites)
 * are numbered in that sequence order (by the earliest member).
 *
 * Which two species share an atlas is decided by `pairSpecies`: a deterministic greedy
 * maximum-weight matching whose weight rewards two species that are bound by the same zones
 * (`100 · |Za ∩ Zb| − |Za ∪ Zb|`, ties by id). The spec's first draft paired *consecutive*
 * species of the sequence instead; measured on the current roster that leaves the late zones
 * (`eclipse_shrine`, `umbral_observatory`, `the_rift`, …) re-binding species scattered over
 * up to 12 earlier atlases, i.e. 26 duplicated species and 79 atlases — over both the
 * `duplicated ≤ 6` / `atlases ≤ 68` assertions and the 35 MB budget. Co-occurrence pairing
 * gives ≤ 7 binds per zone with no duplication, so every species is stored exactly once.
 *
 * `zones[zone]` is the sorted list of atlases holding Z(zone). When a zone would still bind
 * more than `cap` atlases, the planner duplicates the earliest-placed species of that zone
 * into a zone-local atlas `a-<zoneId>-dup-N` (2 species each) until the cap holds. `home` is
 * a species' first placement; the duplicate is recorded in `alt` so the client can find it.
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

function fitsCap(count: number, cap: number): boolean {
  return Math.ceil(count / 2) <= cap;
}

/**
 * The species a zone actually binds (spec §40.1.4 + the solenne rule): everything in Z(zone)
 * when `ceil(|Z| / 2) ≤ cap`, otherwise the field species with the league teams deferred to
 * their `home` crops.
 */
function bindMembers(zone: ZoneId, zoneSets: ZoneSets, deferrable: ZoneSets, cap: number, known: ReadonlySet<string>): string[] {
  const members = [...(zoneSets.get(zone) ?? [])].filter((s) => known.has(s)).sort(compareStrings);
  if (fitsCap(members.length, cap)) return members;
  const deferred = new Set(deferrable.get(zone) ?? []);
  return members.filter((s) => !deferred.has(s));
}

/**
 * Pairs species into atlases by zone co-occurrence: a greedy maximum-weight matching over all
 * `n(n−1)/2` candidate pairs, weight `100 · |Za ∩ Zb| − |Za ∪ Zb|` where `Zs` is the set of
 * zones that bind `s`. Two species bound by exactly the same zones cost those zones one
 * atlas instead of two; a species bound nowhere (`home`) pairs with another such species
 * for free. Candidates are visited in (weight desc, id, id) order, so the result is a pure
 * function of its inputs. An odd species count leaves one single-species atlas.
 */
export function pairSpecies(speciesIds: readonly string[], zoneSets: ZoneSets, cap = MAX_ATLASES_PER_ZONE, deferrable: ZoneSets = new Map()): string[][] {
  const ids = [...new Set(speciesIds)].sort(compareStrings);
  const known = new Set(ids);
  const zonesOf = new Map<string, Set<string>>();
  for (const s of ids) zonesOf.set(s, new Set());
  for (const zone of ZONE_ORDER) for (const s of bindMembers(zone, zoneSets, deferrable, cap, known)) zonesOf.get(s)!.add(zone);
  const weight = (a: string, b: string): number => {
    const za = zonesOf.get(a)!;
    const zb = zonesOf.get(b)!;
    let inter = 0;
    for (const z of za) if (zb.has(z)) inter++;
    return 100 * inter - (za.size + zb.size - inter);
  };
  const candidates: Array<{ w: number; a: string; b: string }> = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) candidates.push({ w: weight(ids[i]!, ids[j]!), a: ids[i]!, b: ids[j]! });
  }
  candidates.sort((x, y) => y.w - x.w || compareStrings(x.a, y.a) || compareStrings(x.b, y.b));
  const unpaired = new Set(ids);
  const pairs: string[][] = [];
  for (const { a, b } of candidates) {
    if (!unpaired.has(a) || !unpaired.has(b)) continue;
    unpaired.delete(a);
    unpaired.delete(b);
    pairs.push([a, b]);
  }
  for (const s of [...unpaired].sort(compareStrings)) pairs.push([s]);
  return pairs;
}

/**
 * @param deferrable zone -> species that may be left out of the bind list (league teams) when
 *   `ceil(|Z| / 2) > cap`, i.e. when no packing at all can hold the cap for that zone.
 */
export function planAtlases(speciesIds: readonly string[], zoneSets: ZoneSets, cap = MAX_ATLASES_PER_ZONE, deferrable: ZoneSets = new Map()): ZonePlan {
  const seq = speciesSequence(speciesIds, zoneSets);
  const position = new Map(seq.map((s, i) => [s, i] as const));
  // Atlases are numbered by the zone-walk position of their earliest member.
  const pairs = pairSpecies(speciesIds, zoneSets, cap, deferrable).sort(
    (p, q) => Math.min(...p.map((s) => position.get(s)!)) - Math.min(...q.map((s) => position.get(s)!)),
  );
  const atlases: AtlasPlan[] = [];
  const home = new Map<string, string>();
  const homeIndex = new Map<string, number>();
  for (const pair of pairs) {
    const species = [...pair].sort(compareStrings);
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
    // Everything when it can fit; otherwise the field species (table, statics, overworld
    // trainers) with the league teams deferred to `home` crops.
    const deferred = new Set(deferrable.get(zone) ?? []);
    const bindSet = bindMembers(zone, zoneSets, deferrable, cap, present);
    if (!fitsCap(bindSet.length, cap)) throw new Error(`zone ${zone}: ${bindSet.length} non-deferrable species cannot bind within ${cap} atlases of 2 species (cap ${cap})`);
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
