/**
 * What the Dex knows of a species, computed from content alone: where it lives (encounter tables, statics, quests,
 * raids, the battle pass, the roamers), how its line evolves (a real tree, one condition per edge), how types hit it,
 * and which moves it can learn (level-up, TMs, tutors). Pure and deterministic; the professor's facts
 * (talk/professorFacts.ts) word the same lookups for a save, the Dex shows them as tables.
 */
import {
  BATTLE_PASS,
  ENCOUNTER_TABLES,
  LEGENDARY_IDS,
  LEGENDARY_STATICS,
  MYTHICAL_IDS,
  QUESTS,
  RAID_HOTSPOTS,
  ROAMERS,
  ROAM_ZONES,
  SPECIES,
  TM_MOVES,
  TYPE_CHART,
  ZONES,
  ZONE_ORDER,
  canLearnMachineMove,
  stageOf,
} from '@ewa/content';
import type { BadgeId, EncounterSlot, Stage, ZoneDef, ZoneId } from '@ewa/content';
import { TYPE_NAMES, formsOf, typeMultiplier } from '@ewa/core';
import type { BattleFormDef, MoveDef, Rarity, SpeciesDef, TypeName } from '@ewa/core';
import { itemInfo, move, species } from './content';

const zoneById = new Map<ZoneId, ZoneDef>(ZONES.map((z) => [z.id, z]));
const zoneRank = (id: ZoneId | string): number => {
  const i = ZONE_ORDER.indexOf(id as ZoneId);
  return i === -1 ? ZONE_ORDER.length : i;
};

// ---- matchups ------------------------------------------------------------------------------------------------------

/** Types whose moves hit these defending types for double damage or more. */
export function superEffectiveOn(defending: readonly TypeName[]): TypeName[] {
  return TYPE_NAMES.filter((t) => typeMultiplier(TYPE_CHART, t, defending) >= 2);
}
/** Types whose moves do half damage or less (but some) to these defending types. */
export function resistedBy(defending: readonly TypeName[]): TypeName[] {
  return TYPE_NAMES.filter((t) => {
    const m = typeMultiplier(TYPE_CHART, t, defending);
    return m > 0 && m < 1;
  });
}
export function immuneTo(defending: readonly TypeName[]): TypeName[] {
  return TYPE_NAMES.filter((t) => typeMultiplier(TYPE_CHART, t, defending) === 0);
}
/** Defending types this attacking type hits for double damage. */
export function strongAgainst(attacking: TypeName): TypeName[] {
  return TYPE_NAMES.filter((t) => typeMultiplier(TYPE_CHART, attacking, [t]) >= 2);
}

export interface MatchupRow {
  /** 4, 2, 0.5, 0.25 or 0 */
  readonly mult: number;
  readonly types: readonly TypeName[];
}
const MATCHUP_ORDER: readonly number[] = [4, 2, 0.5, 0.25, 0];

/** Every attacking type that does not hit these defending types for x1, grouped by multiplier (weakest spot first). */
export function defensiveMatchups(defending: readonly TypeName[]): readonly MatchupRow[] {
  const by = new Map<number, TypeName[]>();
  for (const t of TYPE_NAMES) {
    const m = typeMultiplier(TYPE_CHART, t, defending);
    if (m === 1) continue;
    const list = by.get(m) ?? [];
    list.push(t);
    by.set(m, list);
  }
  return MATCHUP_ORDER.filter((m) => by.has(m)).map((m) => ({ mult: m, types: by.get(m)! }));
}

/** "x4", "x2", "x½", "x¼", "x0" */
export function multLabel(mult: number): string {
  if (mult === 0.5) return 'x½';
  if (mult === 0.25) return 'x¼';
  return `x${mult}`;
}

// ---- where a species lives -----------------------------------------------------------------------------------------

export type DayTime = 'day' | 'night' | 'any';
const TIER_RANK: Readonly<Record<EncounterSlot['tier'], number>> = { common: 0, uncommon: 1, rare: 2, alpha: 3 };

/** One zone a species turns up in the wild, its slots merged (alpha slots only flag `alpha`). */
export interface Habitat {
  readonly zoneId: ZoneId;
  readonly gate: BadgeId | null;
  readonly levelMin: number;
  readonly levelMax: number;
  /** 'any' when it turns up at any hour (or by day and by night) */
  readonly time: DayTime;
  readonly land: boolean;
  readonly water: boolean;
  /** the commonest tier it has there */
  readonly tier: 'common' | 'uncommon' | 'rare';
  /** an alpha slot exists for it there */
  readonly alpha: boolean;
}

function mergeTime(a: DayTime | null, b: DayTime): DayTime {
  if (a === null) return b;
  return a === b ? a : 'any';
}

const habitatIndex = new Map<string, Habitat[]>();
{
  type Acc = { min: number; max: number; time: DayTime | null; land: boolean; water: boolean; tier: Habitat['tier'] | null; alpha: boolean };
  const acc = new Map<string, Map<ZoneId, Acc>>();
  for (const t of ENCOUNTER_TABLES) {
    for (const s of t.slots) {
      const zones = acc.get(s.species) ?? new Map<ZoneId, Acc>();
      acc.set(s.species, zones);
      const a = zones.get(t.zoneId) ?? { min: Infinity, max: -Infinity, time: null, land: false, water: false, tier: null, alpha: false };
      zones.set(t.zoneId, a);
      if (s.tier === 'alpha') {
        a.alpha = true;
        continue;
      }
      a.min = Math.min(a.min, s.levelMin);
      a.max = Math.max(a.max, s.levelMax);
      a.time = mergeTime(a.time, s.timeOfDay);
      if (s.medium === 'water') a.water = true;
      else a.land = true;
      if (a.tier === null || TIER_RANK[s.tier] < TIER_RANK[a.tier]) a.tier = s.tier;
    }
  }
  for (const [sp, zones] of acc) {
    const list: Habitat[] = [];
    for (const [zoneId, a] of zones) {
      if (a.tier === null) continue; // alpha-only: not a habitat of its own
      list.push({ zoneId, gate: zoneById.get(zoneId)?.gate ?? null, levelMin: a.min, levelMax: a.max, time: a.time ?? 'any', land: a.land, water: a.water, tier: a.tier, alpha: a.alpha });
    }
    list.sort((x, y) => zoneRank(x.zoneId) - zoneRank(y.zoneId));
    habitatIndex.set(sp, list);
  }
}

/** The wild habitats of a species, in zone (story) order. */
export function habitatsOf(speciesId: string): readonly Habitat[] {
  return habitatIndex.get(speciesId) ?? [];
}

/** The species found wild in a zone, in dex order, each with its habitat there. */
export function zoneRoster(zoneId: ZoneId): readonly { readonly sp: SpeciesDef; readonly habitat: Habitat }[] {
  const out: { sp: SpeciesDef; habitat: Habitat }[] = [];
  for (const sp of SPECIES) {
    const h = habitatIndex.get(sp.id)?.find((x) => x.zoneId === zoneId);
    if (h !== undefined) out.push({ sp, habitat: h });
  }
  return out.sort((a, b) => a.sp.dexNumber - b.sp.dexNumber);
}

/** The zones with a wild roster, in story order. */
export const HABITAT_ZONES: readonly ZoneId[] = ZONE_ORDER.filter((z) => ENCOUNTER_TABLES.some((t) => t.zoneId === z));

/** Ways to get a species other than meeting it in the wild. */
export type Origin =
  | { readonly kind: 'static'; readonly zoneId: ZoneId; readonly level: number }
  | { readonly kind: 'quest'; readonly title: string; readonly level: number }
  | { readonly kind: 'raid'; readonly zoneId: ZoneId; readonly level: number }
  | { readonly kind: 'battlePass'; readonly level: number }
  | { readonly kind: 'roamer'; readonly zones: readonly string[] }
  | { readonly kind: 'evolve'; readonly from: string; readonly how: EvoCondition };

/** Every non-wild way to get a species, in a fixed order (static, roamer, quest, raid, battle pass, evolution). */
export function originsOf(speciesId: string): readonly Origin[] {
  const out: Origin[] = [];
  for (const st of LEGENDARY_STATICS) if (st.species === speciesId) out.push({ kind: 'static', zoneId: st.zoneId, level: st.level });
  if (ROAMERS.includes(speciesId)) out.push({ kind: 'roamer', zones: ROAM_ZONES });
  for (const q of QUESTS) {
    const c = q.rewards.creature;
    if (c?.species === speciesId) out.push({ kind: 'quest', title: q.title, level: c.level });
  }
  for (const r of RAID_HOTSPOTS) if (r.boss.species === speciesId) out.push({ kind: 'raid', zoneId: r.zoneId, level: r.boss.level });
  for (const b of BATTLE_PASS) {
    if (b.creature?.species === speciesId || (b.mythicalChoice?.includes(speciesId) ?? false)) out.push({ kind: 'battlePass', level: b.level });
  }
  const sp = species(speciesId);
  if (sp?.evolvesFrom !== null && sp?.evolvesFrom !== undefined) {
    const from = species(sp.evolvesFrom);
    if (from !== undefined) out.push({ kind: 'evolve', from: from.id, how: evolveCondition(from, speciesId) });
  }
  return out;
}

// ---- evolution -----------------------------------------------------------------------------------------------------

/** How one stage becomes the next. In a split, `otherwise` is the branch taken when the other's condition fails. */
export type EvoCondition =
  | { readonly kind: 'level'; readonly level: number }
  | { readonly kind: 'honor'; readonly level: number; readonly high: boolean; readonly atLeast: number }
  | { readonly kind: 'ability'; readonly level: number; readonly ability: string; readonly otherwise: boolean }
  | { readonly kind: 'item'; readonly item: string }
  | { readonly kind: 'trade' };

/** How `from` evolves into `into` (a level step when the data has no edge between them). */
export function evolveCondition(from: SpeciesDef, into: string): EvoCondition {
  const e = from.evolution;
  if (e === null) return { kind: 'level', level: 0 };
  if (e.kind === 'level') return { kind: 'level', level: e.atLevel };
  if (e.kind === 'item') return { kind: 'item', item: e.item };
  if (e.kind === 'trade') return { kind: 'trade' };
  const b = e.branches.find((x) => x.into === into);
  const honor = e.branches.find((x) => x.condition?.kind === 'honor')?.condition;
  if (honor?.kind === 'honor') return { kind: 'honor', level: e.atLevel, high: b?.condition?.kind === 'honor', atLeast: honor.atLeast };
  const ability = e.branches.find((x) => x.condition?.kind === 'ability')?.condition;
  if (ability?.kind === 'ability') return { kind: 'ability', level: e.atLevel, ability: ability.ability, otherwise: b?.condition === null };
  return { kind: 'level', level: e.atLevel };
}

/** The condition as a short chip: "Lv 16", "Lv 30 · High Honor", "Ember Stone", "Trade". */
export function evoLabel(c: EvoCondition): string {
  switch (c.kind) {
    case 'level':
      return `Lv ${c.level}`;
    case 'honor':
      return `Lv ${c.level} · ${c.high ? 'High' : 'Low'} Honor`;
    case 'ability':
      return `Lv ${c.level} · ${c.otherwise ? `not ${c.ability}` : c.ability}`;
    case 'item':
      return itemInfo(c.item).name;
    case 'trade':
      return 'Trade';
  }
}

/** The condition as a sentence for a tooltip or a screen reader. */
export function evoSentence(c: EvoCondition): string {
  switch (c.kind) {
    case 'level':
      return `Evolves at level ${c.level}.`;
    case 'honor':
      return c.high
        ? `Evolves at level ${c.level} with honor ${c.atLeast} or more.`
        : `Evolves at level ${c.level} with honor below ${c.atLeast}.`;
    case 'ability':
      return c.otherwise ? `Evolves at level ${c.level} without the ability ${c.ability}.` : `Evolves at level ${c.level} with the ability ${c.ability}.`;
    case 'item':
      return `Evolves when given a ${itemInfo(c.item).name}.`;
    case 'trade':
      return 'Evolves when traded.';
  }
}

export interface EvoNode {
  readonly sp: SpeciesDef;
  /** how the parent becomes this stage; null at the root */
  readonly how: EvoCondition | null;
  readonly children: readonly EvoNode[];
}

/** The ids `sp` can evolve into, in the order its data lists them. */
export function evolutionTargets(sp: SpeciesDef): readonly string[] {
  const e = sp.evolution;
  if (e === null) return [];
  if (e.kind === 'split') return e.branches.map((b) => b.into);
  return [e.into];
}

function rootOf(id: string): SpeciesDef | undefined {
  let root = species(id);
  const seen = new Set<string>();
  while (root !== undefined && root.evolvesFrom !== null && !seen.has(root.id)) {
    seen.add(root.id);
    root = species(root.evolvesFrom);
  }
  return root;
}

/** The whole line of `id` as a tree from its first stage, every edge with its condition; null for an unknown id. */
export function evolutionTree(id: string): EvoNode | null {
  const root = rootOf(id);
  if (root === undefined) return null;
  const build = (sp: SpeciesDef, how: EvoCondition | null, depth: number): EvoNode => ({
    sp,
    how,
    children:
      depth > 4
        ? []
        : evolutionTargets(sp)
            .map((to) => species(to))
            .filter((c): c is SpeciesDef => c !== undefined)
            .map((c) => build(c, evolveCondition(sp, c.id), depth + 1)),
  });
  return build(root, null, 0);
}

/** Every species in the line of `id`, root first, breadth first. */
export function lineOf(id: string): readonly SpeciesDef[] {
  const tree = evolutionTree(id);
  if (tree === null) return [];
  const out: SpeciesDef[] = [];
  const queue: EvoNode[] = [tree];
  while (queue.length > 0) {
    const n = queue.shift()!;
    out.push(n.sp);
    queue.push(...n.children);
  }
  return out;
}

// ---- moves ---------------------------------------------------------------------------------------------------------

export interface LevelMove {
  readonly level: number;
  readonly move: MoveDef;
}

/** The level-up learnset, by level (a move listed twice keeps its first level). */
export function levelUpMoves(sp: SpeciesDef): readonly LevelMove[] {
  const seen = new Set<string>();
  const out: LevelMove[] = [];
  for (const e of sp.learnableMoves) {
    const m = move(e.move);
    if (m === undefined || seen.has(m.id)) continue;
    seen.add(m.id);
    out.push({ level: e.level, move: m });
  }
  return out;
}

/** The TM moves this species can be taught, in TM order. */
export function tmMoves(sp: SpeciesDef): readonly MoveDef[] {
  return TM_MOVES.map((id) => move(id)).filter((m): m is MoveDef => m !== undefined && canLearnMachineMove(sp, m));
}

/** The tutor moves this species can be taught, each with the zone of its tutor. */
export function tutorMoves(sp: SpeciesDef): readonly { readonly move: MoveDef; readonly zoneId: ZoneId }[] {
  const out: { move: MoveDef; zoneId: ZoneId }[] = [];
  for (const z of ZONES) {
    for (const n of z.npcs) {
      for (const id of n.tutor ?? []) {
        const m = move(id);
        if (m !== undefined && canLearnMachineMove(sp, m) && !out.some((x) => x.move.id === m.id)) out.push({ move: m, zoneId: z.id });
      }
    }
  }
  return out;
}

// ---- stats, forms, sorting -----------------------------------------------------------------------------------------

export interface BaseStats {
  readonly hp: number;
  readonly atk: number;
  readonly def: number;
  readonly spd: number;
}

export function baseStats(sp: SpeciesDef, form?: BattleFormDef | null): BaseStats {
  const b = form ?? sp;
  return { hp: sp.baseHp, atk: b.baseAtk, def: b.baseDef, spd: b.baseSpd };
}

export function statTotal(sp: SpeciesDef): number {
  return sp.baseHp + sp.baseAtk + sp.baseDef + sp.baseSpd;
}

/** Every battle form of a species (Majin / Tenjin / rage, or the relic forms), in data order. */
export function formsOfSpecies(sp: SpeciesDef): readonly BattleFormDef[] {
  return formsOf(sp);
}

export const RARITY_RANK: Readonly<Record<Rarity, number>> = { common: 0, uncommon: 1, rare: 2, legendary: 3, mythical: 4 };

export function isLegend(speciesId: string): boolean {
  return LEGENDARY_IDS.includes(speciesId) || MYTHICAL_IDS.includes(speciesId);
}

export function stageOfSpecies(sp: SpeciesDef): Stage {
  return stageOf(sp);
}

/** The Dex entry of a species, as a link any screen can hand out. */
export function dexHref(speciesId: string): string {
  return `/play/dex?id=${encodeURIComponent(speciesId)}`;
}

/** The highest base stat of any species or form: the full length of a Dex stat bar. */
export const MAX_BASE_STAT: number = Math.max(
  ...SPECIES.flatMap((s) => [s.baseHp, s.baseAtk, s.baseDef, s.baseSpd, ...formsOf(s).flatMap((f) => [f.baseAtk, f.baseDef, f.baseSpd])]),
);

// ---- what an entry shows -------------------------------------------------------------------------------------------

export type DexState = 'caught' | 'seen' | 'unknown';

/** Which parts of an entry are open. Without a research level a recorded species shows everything but the gold frame. */
export interface DexAccess {
  /** types, flavour, habitats, the battle-form line, the evolution line's names */
  readonly basics: boolean;
  readonly stats: boolean;
  readonly abilities: boolean;
  /** the form and variant art, the form stats */
  readonly forms: boolean;
  readonly moves: boolean;
  readonly matchups: boolean;
  /** the condition chip on each evolution edge */
  readonly evoConditions: boolean;
  readonly compare: boolean;
  readonly goldFrame: boolean;
}

/** Research level each locked part needs (after it is recorded). */
export const RESEARCH_GATE = { moves: 2, matchups: 3, evoConditions: 3, compare: 3, goldFrame: 5 } as const;

export function dexAccess(state: DexState, research?: number): DexAccess {
  const seen = state !== 'unknown';
  const rec = state === 'caught';
  const at = (n: number): boolean => rec && (research === undefined || research >= n);
  return {
    basics: seen,
    stats: rec,
    abilities: rec,
    forms: rec,
    moves: at(RESEARCH_GATE.moves),
    matchups: at(RESEARCH_GATE.matchups),
    evoConditions: at(RESEARCH_GATE.evoConditions),
    compare: at(RESEARCH_GATE.compare),
    goldFrame: rec && research !== undefined && research >= RESEARCH_GATE.goldFrame,
  };
}

/** What opens a locked part: "Record it to read this." or "Reach research level 3 to read this." */
export function unlockHint(state: DexState, gate: number | null): string {
  if (state !== 'caught' || gate === null) return 'Record it to read this.';
  return `Reach research level ${gate} to read this.`;
}
