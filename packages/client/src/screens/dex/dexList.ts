/**
 * The Dex list (2026-10-26): which entries a filter set keeps and in what order, read from the URL
 * (`?q=&type=&state=&zone=&rarity=&stage=&form=1&now=1&sort=&dir=&density=`). Pure; the grid, the list view and the
 * entry's previous / next all walk the same ordered rows. Filters that would tell what an unknown entry is (type,
 * rarity, stage, form) drop unknown entries; zone and "catchable now" keep them as silhouettes, since something lives
 * there.
 */
import type { BadgeId, Stage, ZoneId } from '@ewa/content';
import type { Rarity, SpeciesDef, TypeName } from '@ewa/core';
import { RARITY_RANK, formsOfSpecies, habitatsOf, stageOfSpecies, statTotal } from '../../data/dexInfo';
import type { DexState } from '../../data/dexInfo';

export type SortKey = 'num' | 'name' | 'hp' | 'atk' | 'def' | 'spd' | 'total' | 'rarity';
export type SortDir = 'asc' | 'desc';
export type StateFilter = DexState | 'all' | 'shiny';
export type Density = 'tiles' | 'list';

export const SORT_KEYS: readonly SortKey[] = ['num', 'name', 'total', 'hp', 'atk', 'def', 'spd', 'rarity'];
export const SORT_LABEL: Readonly<Record<SortKey, string>> = {
  num: 'Number',
  name: 'Name',
  total: 'Stat total',
  hp: 'HP',
  atk: 'Attack',
  def: 'Defense',
  spd: 'Speed',
  rarity: 'Rarity',
};
/** the direction a sort starts in: numbers and names up, stats and rarity down (the strongest first) */
export const SORT_DIR: Readonly<Record<SortKey, SortDir>> = { num: 'asc', name: 'asc', total: 'desc', hp: 'desc', atk: 'desc', def: 'desc', spd: 'desc', rarity: 'desc' };

export interface DexRow {
  readonly sp: SpeciesDef;
  readonly state: DexState;
}

export interface DexQuery {
  readonly q: string;
  readonly type: TypeName | '';
  readonly state: StateFilter;
  readonly zone: ZoneId | '';
  readonly rarity: Rarity | '';
  readonly stage: Stage | '';
  readonly form: boolean;
  readonly now: boolean;
  readonly sort: SortKey;
  readonly dir: SortDir;
  readonly density: Density;
}

export function readQuery(p: URLSearchParams): DexQuery {
  const sortRaw = p.get('sort') as SortKey | null;
  const sort: SortKey = sortRaw !== null && SORT_KEYS.includes(sortRaw) ? sortRaw : 'num';
  const dirRaw = p.get('dir');
  return {
    q: p.get('q') ?? '',
    type: (p.get('type') ?? '') as TypeName | '',
    state: (p.get('state') ?? 'all') as StateFilter,
    zone: (p.get('zone') ?? '') as ZoneId | '',
    rarity: (p.get('rarity') ?? '') as Rarity | '',
    stage: (p.get('stage') ?? '') as Stage | '',
    form: p.get('form') === '1',
    now: p.get('now') === '1',
    sort,
    dir: dirRaw === 'asc' || dirRaw === 'desc' ? dirRaw : SORT_DIR[sort],
    density: p.get('density') === 'list' ? 'list' : 'tiles',
  };
}

/** True when any filter beyond search / type / state is on (the "more filters" row shows them). */
export function hasExtraFilters(qy: DexQuery): boolean {
  return qy.zone !== '' || qy.rarity !== '' || qy.stage !== '' || qy.form || qy.now;
}

/** Whether `timeOfDay` (the room's 0..1 clock, day = [0.25, 0.75)) is day; null when unknown. */
export function isDay(timeOfDay: number | null): boolean | null {
  return timeOfDay === null ? null : timeOfDay >= 0.25 && timeOfDay < 0.75;
}

export interface FilterCtx {
  readonly shiny: ReadonlySet<string>;
  readonly badges: readonly BadgeId[];
  /** the room's clock, or null away from a zone */
  readonly timeOfDay: number | null;
}

/** Wild in an open zone at this hour (any hour when the clock is unknown). */
export function catchableNow(sp: SpeciesDef, ctx: FilterCtx): boolean {
  const day = isDay(ctx.timeOfDay);
  return habitatsOf(sp.id).some(
    (h) => (h.gate === null || ctx.badges.includes(h.gate)) && (day === null || h.time === 'any' || (h.time === 'day') === day),
  );
}

export function filterRows(rows: readonly DexRow[], qy: DexQuery, ctx: FilterCtx): DexRow[] {
  const needle = qy.q.trim().toLowerCase();
  return rows.filter(({ sp, state: st }) => {
    if (qy.state === 'shiny') {
      if (!ctx.shiny.has(sp.id)) return false;
    } else if (qy.state !== 'all' && st !== qy.state) return false;
    const unknown = st === 'unknown';
    if (qy.type !== '' && (unknown || !(sp.types as readonly string[]).includes(qy.type))) return false;
    if (qy.rarity !== '' && (unknown || sp.rarity !== qy.rarity)) return false;
    if (qy.stage !== '' && (unknown || stageOfSpecies(sp) !== qy.stage)) return false;
    if (qy.form && (unknown || formsOfSpecies(sp).length === 0)) return false;
    if (qy.zone !== '' && !habitatsOf(sp.id).some((h) => h.zoneId === qy.zone)) return false;
    if (qy.now && !catchableNow(sp, ctx)) return false;
    if (needle.length > 0) {
      if (unknown) return String(sp.dexNumber).includes(needle);
      return sp.name.toLowerCase().includes(needle) || String(sp.dexNumber).includes(needle);
    }
    return true;
  });
}

/** The value a row sorts by. A hidden value (an unknown name, an unrecorded stat) sorts after every shown one. */
export function sortValue(key: SortKey, dir: SortDir): (r: DexRow) => number | string {
  const hiddenNum = dir === 'asc' ? Number.MAX_SAFE_INTEGER : -1;
  const stat = (f: (sp: SpeciesDef) => number) => (r: DexRow) => (r.state === 'caught' ? f(r.sp) : hiddenNum);
  switch (key) {
    case 'num':
      return (r) => r.sp.dexNumber;
    case 'name':
      return (r) => (r.state === 'unknown' ? (dir === 'asc' ? '￿' : '') : r.sp.name);
    case 'hp':
      return stat((sp) => sp.baseHp);
    case 'atk':
      return stat((sp) => sp.baseAtk);
    case 'def':
      return stat((sp) => sp.baseDef);
    case 'spd':
      return stat((sp) => sp.baseSpd);
    case 'total':
      return stat(statTotal);
    case 'rarity':
      return (r) => (r.state === 'unknown' ? hiddenNum : RARITY_RANK[r.sp.rarity]);
  }
}

export function sortRowsBy(rows: readonly DexRow[], key: SortKey, dir: SortDir): DexRow[] {
  const v = sortValue(key, dir);
  const d = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = v(a);
    const vb = v(b);
    return (va < vb ? -1 : va > vb ? 1 : 0) * d || a.sp.dexNumber - b.sp.dexNumber;
  });
}
