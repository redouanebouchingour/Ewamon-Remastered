/**
 * Dex research: every species has research tasks, each with tier thresholds on one counter the server keeps per player
 * and species (`dex_entries.counters`). Every tier reached gives the task's points; the points give a research level
 * 0..5 (`researchLevel`). The tasks come from templates (see, catch, defeat, see at night, see on water, evolve, obtain
 * by evolution, record a variant) plus hand-written specials (see a battle form, see the signature move, raise one to
 * High / Low Honor, catch an alpha). A template appears only where the species can complete it: night only with a
 * night slot, water only with a water slot, a variant or an alpha only when the species or an ancestor is wild.
 * Legendaries and mythicals get smaller counts at double points, so level 5 stays reachable for them.
 *
 * The server writes the counters (packages/server `game/research.ts`); the client reads the same tasks to show them.
 */
import type { SpeciesDef } from '@ewa/core';
import type { EncounterTable } from '../types';
import { SPECIES } from './species';
import { ENCOUNTER_TABLES } from './encounters';
import { LEGENDARY_IDS, MYTHICAL_IDS } from './statics';

/** The counters the server keeps. A battle form's counter is `form:<form id>` (`formCounter`). */
export const RESEARCH_COUNTERS = [
  'seen',
  'caught',
  'defeated',
  'seenNight',
  'seenWater',
  'evolved',
  'evolvedInto',
  'variant',
  'alpha',
  'signature',
  'honorHigh',
  'honorLow',
] as const;
export type ResearchCounter = (typeof RESEARCH_COUNTERS)[number];

export const FORM_COUNTER_PREFIX = 'form:';
export function formCounter(formId: string): string {
  return `${FORM_COUNTER_PREFIX}${formId}`;
}

/** A counter id the server may write: one of RESEARCH_COUNTERS or `form:<id>`. */
export function isResearchCounter(id: string): boolean {
  if (id.startsWith(FORM_COUNTER_PREFIX)) return /^form:[a-z0-9_]{1,24}$/.test(id);
  return (RESEARCH_COUNTERS as readonly string[]).includes(id);
}

/** The honor a creature of an honor-split line must reach (at least / at most minus) for the honor tasks. */
export const RESEARCH_HONOR_LINE = 5;

export const RESEARCH_MAX_LEVEL = 5;
/** The points each research level 1..5 needs. */
export const RESEARCH_LEVEL_POINTS: readonly number[] = [1, 4, 8, 12, 16];

export type ResearchTaskKind = 'template' | 'special';

export interface ResearchTask {
  /** unique within the species, stable (reward and UI keys) */
  readonly id: string;
  readonly kind: ResearchTaskKind;
  /** the counter the task reads */
  readonly counter: string;
  /** short display text, e.g. 'Times seen', 'Signature move seen: Kamehameha' */
  readonly title: string;
  /** ascending counts; reaching one gives `points` */
  readonly tiers: readonly number[];
  /** points per tier reached */
  readonly points: number;
}

export interface ResearchTaskProgress {
  readonly task: ResearchTask;
  readonly count: number;
  /** tiers reached, 0..tiers.length */
  readonly tiersReached: number;
  readonly points: number;
}

export interface ResearchProgress {
  readonly speciesId: string;
  readonly tasks: readonly ResearchTaskProgress[];
  readonly points: number;
  /** the points every tier of every task gives */
  readonly maxPoints: number;
  readonly level: number;
}

/** The research level of `points`: 0..5. */
export function researchLevel(points: number): number {
  let level = 0;
  for (let i = 0; i < RESEARCH_LEVEL_POINTS.length; i++) if (points >= RESEARCH_LEVEL_POINTS[i]!) level = i + 1;
  return level;
}

/** Common species: counts and points of the templates. Legendaries / mythicals: smaller counts, double points. */
const COMMON = {
  seen: [1, 5, 15, 30, 60],
  caught: [1, 3, 8, 15],
  defeated: [1, 5, 15, 30, 50],
  night: [1, 5],
  water: [1, 5],
  evolved: [1, 3],
  evolvedInto: [1, 3],
  variant: [1, 3],
  points: 1,
} as const;
const RARE = {
  seen: [1, 3, 5],
  caught: [1],
  defeated: [1, 3, 5],
  night: [1],
  water: [1],
  evolved: [1],
  evolvedInto: [1],
  variant: [1],
  points: 2,
} as const;
/** Specials give 2 points per tier. */
const SPECIAL_POINTS = 2;
const FORM_TIERS = [1, 3] as const;
const SIGNATURE_TIERS = [1, 3, 10] as const;
const HONOR_TIERS = [1] as const;
const ALPHA_TIERS = [1, 3] as const;

/** What the generator reads: the species table and the encounter tables (overridable for validation). */
export interface ResearchInputs {
  readonly species: readonly SpeciesDef[];
  readonly tables: readonly EncounterTable[];
}

const DEFAULT_INPUTS: ResearchInputs = { species: SPECIES, tables: ENCOUNTER_TABLES };

/** True for the legendaries and mythicals (smaller counts). */
export function isResearchRare(sp: SpeciesDef): boolean {
  return LEGENDARY_IDS.includes(sp.id) || MYTHICAL_IDS.includes(sp.id) || sp.rarity === 'legendary' || sp.rarity === 'mythical';
}

/**
 * The species' signature moves: a battle form's `signatureMove`, and for a legendary or mythical the newest move it
 * alone learns (the move pinned as its newest learnable move).
 */
export function signatureMovesOf(sp: SpeciesDef, species: readonly SpeciesDef[] = SPECIES): string[] {
  const out: string[] = [];
  for (const f of formsOfSpecies(sp)) if (f.signatureMove !== undefined && !out.includes(f.signatureMove.move)) out.push(f.signatureMove.move);
  if (isResearchRare(sp)) {
    let best: { move: string; level: number } | null = null;
    for (const e of sp.learnableMoves) {
      if (species.some((o) => o.id !== sp.id && o.learnableMoves.some((x) => x.move === e.move))) continue;
      if (best === null || e.level >= best.level) best = { move: e.move, level: e.level };
    }
    if (best !== null && !out.includes(best.move)) out.push(best.move);
  }
  return out;
}

function formsOfSpecies(sp: SpeciesDef): readonly NonNullable<SpeciesDef['battleForm']>[] {
  if (sp.battleForm !== undefined) return [sp.battleForm];
  return sp.battleForms ?? [];
}

/** True when the species has an honor-split evolution (dustcub, cryptorb). */
function honorSplit(sp: SpeciesDef): boolean {
  const e = sp.evolution;
  return e !== null && e.kind === 'split' && e.branches.some((b) => b.condition !== null && b.condition.kind === 'honor');
}

function hasEvolution(sp: SpeciesDef): boolean {
  const e = sp.evolution;
  if (e === null) return false;
  if (e.kind === 'split') return e.branches.length > 0;
  return true;
}

/** Builds the tasks of one species. Pure over `inputs`. */
export function researchTasksFor(sp: SpeciesDef, inputs: ResearchInputs = DEFAULT_INPUTS): ResearchTask[] {
  const byId = new Map(inputs.species.map((s) => [s.id, s]));
  const slots = inputs.tables.flatMap((t) => t.slots);
  const wild = (id: string): boolean => slots.some((s) => s.species === id);
  // the species or one of its ancestors is wild: a variant or an alpha evolves along with the creature
  let lineWild = false;
  for (let cur: SpeciesDef | undefined = sp, guard = 0; cur !== undefined && guard < 8; cur = cur.evolvesFrom === null ? undefined : byId.get(cur.evolvesFrom), guard++) {
    if (wild(cur.id)) lineWild = true;
  }
  const c = isResearchRare(sp) ? RARE : COMMON;
  const tasks: ResearchTask[] = [
    { id: 'seen', kind: 'template', counter: 'seen', title: 'Times seen', tiers: c.seen, points: c.points },
    { id: 'caught', kind: 'template', counter: 'caught', title: 'Times caught', tiers: c.caught, points: c.points },
    { id: 'defeated', kind: 'template', counter: 'defeated', title: 'Times defeated', tiers: c.defeated, points: c.points },
  ];
  if (slots.some((s) => s.species === sp.id && s.timeOfDay === 'night')) {
    tasks.push({ id: 'seenNight', kind: 'template', counter: 'seenNight', title: 'Seen at night', tiers: c.night, points: c.points });
  }
  if (slots.some((s) => s.species === sp.id && s.medium === 'water')) {
    tasks.push({ id: 'seenWater', kind: 'template', counter: 'seenWater', title: 'Seen on water', tiers: c.water, points: c.points });
  }
  if (hasEvolution(sp)) tasks.push({ id: 'evolved', kind: 'template', counter: 'evolved', title: 'Times evolved', tiers: c.evolved, points: c.points });
  if (sp.evolvesFrom !== null) {
    tasks.push({ id: 'evolvedInto', kind: 'template', counter: 'evolvedInto', title: 'Obtained by evolution', tiers: c.evolvedInto, points: c.points });
  }
  if (lineWild) tasks.push({ id: 'variant', kind: 'template', counter: 'variant', title: 'Variants caught', tiers: c.variant, points: c.points });
  // ── specials ──
  for (const f of formsOfSpecies(sp)) {
    tasks.push({ id: formCounter(f.id), kind: 'special', counter: formCounter(f.id), title: `Battle form seen: ${f.name}`, tiers: FORM_TIERS, points: SPECIAL_POINTS });
  }
  const sigs = signatureMovesOf(sp, inputs.species);
  if (sigs.length > 0) {
    tasks.push({ id: 'signature', kind: 'special', counter: 'signature', title: `Signature move seen: ${sigs.join(' / ')}`, tiers: SIGNATURE_TIERS, points: SPECIAL_POINTS });
  }
  if (honorSplit(sp)) {
    tasks.push({ id: 'honorHigh', kind: 'special', counter: 'honorHigh', title: 'Raised to High Honor', tiers: HONOR_TIERS, points: SPECIAL_POINTS });
    tasks.push({ id: 'honorLow', kind: 'special', counter: 'honorLow', title: 'Raised to Low Honor', tiers: HONOR_TIERS, points: SPECIAL_POINTS });
  }
  if (lineWild) tasks.push({ id: 'alpha', kind: 'special', counter: 'alpha', title: 'Alphas caught', tiers: ALPHA_TIERS, points: SPECIAL_POINTS });
  return tasks;
}

const CACHE = new Map<string, readonly ResearchTask[]>();

/** The research tasks of a species (the shipped tables). Throws RangeError for an unknown id. */
export function researchTasksOf(speciesId: string): readonly ResearchTask[] {
  const hit = CACHE.get(speciesId);
  if (hit !== undefined) return hit;
  const sp = SPECIES.find((s) => s.id === speciesId);
  if (sp === undefined) throw new RangeError(`unknown species '${speciesId}'`);
  const tasks = researchTasksFor(sp);
  CACHE.set(speciesId, tasks);
  return tasks;
}

/** The points every tier of every task gives. */
export function researchMaxPoints(tasks: readonly ResearchTask[]): number {
  let n = 0;
  for (const t of tasks) n += t.tiers.length * t.points;
  return n;
}

/** Progress of one species from its counters (absent counter = 0). */
export function researchProgressOf(speciesId: string, counters: Readonly<Record<string, number>>, tasks: readonly ResearchTask[] = researchTasksOf(speciesId)): ResearchProgress {
  let points = 0;
  const out: ResearchTaskProgress[] = [];
  for (const task of tasks) {
    const count = counters[task.counter] ?? 0;
    let tiersReached = 0;
    for (const n of task.tiers) if (count >= n) tiersReached++;
    const p = tiersReached * task.points;
    points += p;
    out.push({ task, count, tiersReached, points: p });
  }
  return { speciesId, tasks: out, points, maxPoints: researchMaxPoints(tasks), level: researchLevel(points) };
}

/** The research level of one species from its counters. */
export function researchLevelOf(speciesId: string, counters: Readonly<Record<string, number>>): number {
  return researchProgressOf(speciesId, counters).level;
}
