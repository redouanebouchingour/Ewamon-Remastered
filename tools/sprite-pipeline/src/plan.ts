/**
 * Atlas planning (spec §40.1.4): every species once, packed by zone affinity.
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
 * up to 12 earlier atlases, i.e. 26 duplicated species and 79 atlases, over both the
 * `duplicated ≤ 6` / `atlases ≤ 68` assertions and the 35 MB budget. Co-occurrence pairing
 * gives ≤ 7 binds per zone with no duplication, so every species is stored exactly once.
 *
 * Stability (spec §40.1.4 as amended 2026-10-26). Given the previous build's atlases as a
 * `baseline`, every baseline atlas stays pinned: same id, the members still in the roster, in
 * the same cells. Only the species without a pinned home are matched, among themselves and into
 * the free cell of a pinned single-species atlas when they share a zone with its occupant, by
 * the same weight; their atlases take the ids of emptied baseline atlases first, then the next
 * free index. A rebuild that only adds species therefore leaves every existing atlas file
 * byte-identical. When a zone would bind more than `cap` atlases, the pinned atlases that zone
 * binds are released and re-matched with the new species (repeated while a zone is over), so
 * the moves stay inside the zones that broke the cap; with no baseline every atlas is
 * "released" and the plan is the fresh one. Duplicates (`a-<zoneId>-dup-N`) are re-derived
 * every build, never pinned.
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
  /**
   * 1–2 species in cell order: a fresh atlas lists them sorted, a pinned one keeps its baseline
   * order (a freed cell is filled after the occupant), so no kept sprite changes cell.
   */
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

/** The previous build's home atlases (`a-NNN`; duplicates are ignored), species in cell order. */
export interface PlanBaseline {
  atlases: Array<{ id: string; species: string[] }>;
}

/** How the plan relates to its baseline (all lists sorted; empty without a baseline but `added`). */
export interface PlanStability {
  /** Same id, same species in the same cells as the baseline: the encoded files are unchanged. */
  kept: string[];
  /** Baseline ids whose members changed: a species left, a freed cell was filled, or re-matched. */
  changed: string[];
  /** Ids the baseline did not have. */
  added: string[];
  /** Baseline ids that hold nothing any more. */
  dropped: string[];
  /** Baseline atlases released to hold the cap, with the zones that forced it. */
  released: string[];
  releasedFor: ZoneId[];
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
  stability: PlanStability;
}

export function atlasId(index: number): string {
  return `a-${String(index).padStart(3, '0')}`;
}

export function compareAtlasIds(a: string, b: string): number {
  return compareStrings(a, b);
}

const HOME_ATLAS = /^a-(\d{3,})$/;

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

/** `100 · |Za ∩ Zb| − |Za ∪ Zb|` over the zones that bind each species. */
function pairWeight(ids: readonly string[], zoneSets: ZoneSets, cap: number, deferrable: ZoneSets): (a: string, b: string) => number {
  const known = new Set(ids);
  const zonesOf = new Map<string, Set<string>>();
  for (const s of ids) zonesOf.set(s, new Set());
  for (const zone of ZONE_ORDER) for (const s of bindMembers(zone, zoneSets, deferrable, cap, known)) zonesOf.get(s)!.add(zone);
  return (a, b) => {
    const za = zonesOf.get(a)!;
    const zb = zonesOf.get(b)!;
    let inter = 0;
    for (const z of za) if (zb.has(z)) inter++;
    return 100 * inter - (za.size + zb.size - inter);
  };
}

/**
 * Greedy maximum-weight matching of `free` species, visiting candidates in (weight desc, id, id)
 * order. A candidate is either two free species (a new atlas) or a free species and the occupant
 * of a single-species atlas in `singles` (filling its free cell); a fill needs a positive weight,
 * i.e. a shared zone, because it re-encodes an atlas that would otherwise stay as it is. Free
 * species left over get a single-species atlas each.
 */
function matchSpecies(
  free: readonly string[],
  singles: ReadonlyMap<string, string>,
  weight: (a: string, b: string) => number,
): { pairs: string[][]; fills: Map<string, string> } {
  const ids = [...new Set(free)].sort(compareStrings);
  const candidates: Array<{ w: number; a: string; b: string; fill: string | null }> = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) candidates.push({ w: weight(ids[i]!, ids[j]!), a: ids[i]!, b: ids[j]!, fill: null });
    for (const [atlas, occupant] of singles) {
      const w = weight(ids[i]!, occupant);
      if (w <= 0) continue;
      const [a, b] = compareStrings(ids[i]!, occupant) < 0 ? [ids[i]!, occupant] : [occupant, ids[i]!];
      candidates.push({ w, a, b, fill: atlas });
    }
  }
  candidates.sort((x, y) => y.w - x.w || compareStrings(x.a, y.a) || compareStrings(x.b, y.b));
  const unpaired = new Set(ids);
  const open = new Set(singles.keys());
  const pairs: string[][] = [];
  const fills = new Map<string, string>();
  for (const { a, b, fill } of candidates) {
    if (fill !== null) {
      const s = unpaired.has(a) ? a : b;
      if (!unpaired.has(s) || !open.has(fill)) continue;
      unpaired.delete(s);
      open.delete(fill);
      fills.set(fill, s);
      continue;
    }
    if (!unpaired.has(a) || !unpaired.has(b)) continue;
    unpaired.delete(a);
    unpaired.delete(b);
    pairs.push([a, b]);
  }
  for (const s of [...unpaired].sort(compareStrings)) pairs.push([s]);
  return { pairs, fills };
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
  return matchSpecies(ids, new Map(), pairWeight(ids, zoneSets, cap, deferrable)).pairs;
}

/**
 * Reads a `PlanBaseline` from a v2 manifest: its `a-NNN` atlases, each atlas's species ordered
 * by the cell of their home rects (top-left first), which is the order they were packed in.
 */
export function baselineFromManifest(manifest: {
  atlases: ReadonlyArray<{ id: string; species: readonly string[] }>;
  sprites: Readonly<Record<string, { front: { atlas: string; px: readonly number[] }; back: { atlas: string; px: readonly number[] } }>>;
}): PlanBaseline {
  const atlases: PlanBaseline['atlases'] = [];
  for (const a of manifest.atlases) {
    if (!HOME_ATLAS.test(a.id)) continue;
    const cell = (s: string): number => {
      let best = Infinity;
      for (const r of [manifest.sprites[s]?.front, manifest.sprites[s]?.back]) {
        if (r?.atlas === a.id) best = Math.min(best, r.px[1]! * 1e6 + r.px[0]!);
      }
      return best;
    };
    atlases.push({ id: a.id, species: [...a.species].sort((x, y) => cell(x) - cell(y) || compareStrings(x, y)) });
  }
  return { atlases: atlases.sort((x, y) => compareAtlasIds(x.id, y.id)) };
}

/**
 * Home atlases for every species: the `pinned` baseline atlases as they were (minus species no
 * longer present, plus a filled free cell), then the rest matched by co-occurrence. A new pair
 * that is exactly a released baseline atlas gets its id and cell order back; the others take the
 * emptied baseline ids in order, then the next free index, numbered by zone-walk position.
 */
function homeAtlases(
  seq: readonly string[],
  baseline: PlanBaseline,
  pinned: ReadonlySet<string>,
  weight: (a: string, b: string) => number,
): AtlasPlan[] {
  const present = new Set(seq);
  const position = new Map(seq.map((s, i) => [s, i] as const));
  const placed = new Set<string>();
  const kept: AtlasPlan[] = [];
  for (const a of baseline.atlases) {
    if (!pinned.has(a.id)) continue;
    const species = a.species.filter((s) => present.has(s) && !placed.has(s));
    if (!species.length) continue;
    for (const s of species) placed.add(s);
    kept.push({ id: a.id, species, dupFor: null });
  }
  const singles = new Map(kept.filter((a) => a.species.length === 1).map((a) => [a.id, a.species[0]!] as const));
  const { pairs, fills } = matchSpecies(
    seq.filter((s) => !placed.has(s)),
    singles,
    weight,
  );
  for (const a of kept) {
    const s = fills.get(a.id);
    if (s !== undefined) a.species = [...a.species, s];
  }

  const used = new Set(kept.map((a) => a.id));
  const fresh: AtlasPlan[] = [];
  const unnamed: string[][] = [];
  for (const pair of pairs) {
    const sorted = [...pair].sort(compareStrings);
    const back = baseline.atlases.find((a) => !used.has(a.id) && a.species.length === sorted.length && [...a.species].sort(compareStrings).join(',') === sorted.join(','));
    if (back) {
      used.add(back.id);
      fresh.push({ id: back.id, species: [...back.species], dupFor: null });
    } else unnamed.push(sorted);
  }
  // Atlases are numbered by the zone-walk position of their earliest member.
  unnamed.sort((p, q) => Math.min(...p.map((s) => position.get(s)!)) - Math.min(...q.map((s) => position.get(s)!)));
  const reusable = baseline.atlases.map((a) => a.id).filter((id) => !used.has(id));
  let next = baseline.atlases.reduce((n, a) => Math.max(n, Number(HOME_ATLAS.exec(a.id)![1]) + 1), 0);
  for (const species of unnamed) fresh.push({ id: reusable.shift() ?? atlasId(next++), species, dupFor: null });
  return [...kept, ...fresh].sort((a, b) => compareAtlasIds(a.id, b.id));
}

/**
 * @param deferrable zone -> species that may be left out of the bind list (league teams) when
 *   `ceil(|Z| / 2) > cap`, i.e. when no packing at all can hold the cap for that zone.
 * @param baseline the previous build's atlases (`baselineFromManifest`); null plans from scratch.
 */
export function planAtlases(
  speciesIds: readonly string[],
  zoneSets: ZoneSets,
  cap = MAX_ATLASES_PER_ZONE,
  deferrable: ZoneSets = new Map(),
  baseline: PlanBaseline | null = null,
): ZonePlan {
  const seq = speciesSequence(speciesIds, zoneSets);
  const present = new Set(seq);
  const base: PlanBaseline = { atlases: (baseline?.atlases ?? []).filter((a) => HOME_ATLAS.test(a.id)) };
  const weight = pairWeight(seq, zoneSets, cap, deferrable);
  const bindSets = new Map(ZONE_ORDER.map((z) => [z, bindMembers(z, zoneSets, deferrable, cap, present)] as const));

  // Pin every baseline atlas; release the ones a zone over the cap binds, until none is over or
  // nothing pinned is left in the way (the duplication below then handles the rest).
  const pinned = new Set(base.atlases.map((a) => a.id));
  const releasedFor = new Set<ZoneId>();
  let homes = homeAtlases(seq, base, pinned, weight);
  for (;;) {
    const homeOf = new Map(homes.flatMap((a) => a.species.map((s) => [s, a.id] as const)));
    const release = new Set<string>();
    for (const zone of ZONE_ORDER) {
      const bound = new Set(bindSets.get(zone)!.map((s) => homeOf.get(s)!));
      if (bound.size <= cap) continue;
      const mine = [...bound].filter((id) => pinned.has(id));
      if (!mine.length) continue;
      releasedFor.add(zone);
      for (const id of mine) release.add(id);
    }
    if (!release.size) break;
    for (const id of release) pinned.delete(id);
    homes = homeAtlases(seq, base, pinned, weight);
  }

  let plan = zoneStage(homes, seq, zoneSets, deferrable, bindSets, cap);
  // A pinned plan that still duplicates species falls back to releasing every baseline atlas
  // (a full re-plan that keeps only the ids of pairs it re-forms) when that duplicates fewer.
  if (pinned.size && plan.duplicated.length) {
    const all = homeAtlases(seq, base, new Set(), weight);
    const full = zoneStage(all, seq, zoneSets, deferrable, bindSets, cap);
    if (full.duplicated.length < plan.duplicated.length) {
      for (const z of ZONE_ORDER) if (plan.bindStats[z]!.duplicated.length) releasedFor.add(z);
      pinned.clear();
      homes = all;
      plan = full;
    }
  }
  return { ...plan, stability: stabilityOf(base, homes, pinned, releasedFor) };
}

function stabilityOf(base: PlanBaseline, homes: readonly AtlasPlan[], pinned: ReadonlySet<string>, releasedFor: ReadonlySet<ZoneId>): PlanStability {
  const before = new Map(base.atlases.map((a) => [a.id, a.species.join(',')] as const));
  const now = new Set(homes.map((a) => a.id));
  return {
    kept: homes.filter((a) => before.get(a.id) === a.species.join(',')).map((a) => a.id),
    changed: homes.filter((a) => before.has(a.id) && before.get(a.id) !== a.species.join(',')).map((a) => a.id),
    added: homes.filter((a) => !before.has(a.id)).map((a) => a.id),
    dropped: base.atlases.map((a) => a.id).filter((id) => !now.has(id)),
    released: base.atlases.map((a) => a.id).filter((id) => !pinned.has(id)),
    releasedFor: ZONE_ORDER.filter((z) => releasedFor.has(z)),
  };
}

/** Binds every zone from the home atlases, duplicating species where a zone is still over `cap`. */
function zoneStage(
  homes: readonly AtlasPlan[],
  seq: readonly string[],
  zoneSets: ZoneSets,
  deferrable: ZoneSets,
  bindSets: ReadonlyMap<ZoneId, string[]>,
  cap: number,
): Omit<ZonePlan, 'stability'> {
  const present = new Set(seq);
  const atlases: AtlasPlan[] = homes.map((a) => ({ ...a, species: [...a.species] }));
  const home = new Map<string, string>();
  const homeIndex = new Map<string, number>();
  atlases.forEach((a, i) => {
    for (const s of a.species) {
      home.set(s, a.id);
      homeIndex.set(s, i);
    }
  });

  const zones = new Map<ZoneId, string[]>();
  const bindStats: Record<string, BindStat> = {};
  const placements = new Map<string, string[]>();
  for (const s of seq) placements.set(s, [home.get(s)!]);

  for (const zone of ZONE_ORDER) {
    const members = [...(zoneSets.get(zone) ?? [])].filter((s) => present.has(s)).sort(compareStrings);
    // Everything when it can fit; otherwise the field species (table, statics, overworld
    // trainers) with the league teams deferred to `home` crops.
    const deferred = new Set(deferrable.get(zone) ?? []);
    const bindSet = bindSets.get(zone)!;
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
