/**
 * The Dex list (screens/dex/dexList.ts): the URL read into a query, filters that keep or drop unknown entries, catchable
 * now by badge gate and hour, and sorts that put hidden values (unknown names, unrecorded stats) last.
 */
import { describe, expect, it } from 'vitest';
import { SPECIES } from '@ewa/content';
import { habitatsOf } from '../src/data/dexInfo';
import { catchableNow, filterRows, readQuery, sortRowsBy } from '../src/screens/dex/dexList';
import type { DexRow } from '../src/screens/dex/dexList';

const byDex = [...SPECIES].sort((a, b) => a.dexNumber - b.dexNumber);
const rows = (caught: string[], seen: string[] = []): DexRow[] =>
  byDex.map((sp) => ({ sp, state: caught.includes(sp.id) ? 'caught' : seen.includes(sp.id) ? 'seen' : 'unknown' }));
const ctx = { shiny: new Set<string>(), badges: [], timeOfDay: null };
const q = (search: string) => readQuery(new URLSearchParams(search));

describe('readQuery', () => {
  it('defaults to number order, tiles, everything', () => {
    const d = q('');
    expect([d.sort, d.dir, d.density, d.state, d.form, d.now]).toEqual(['num', 'asc', 'tiles', 'all', false, false]);
  });
  it('a stat sort starts strongest first; ?dir overrides; a bad sort falls back', () => {
    expect(q('sort=total').dir).toBe('desc');
    expect(q('sort=total&dir=asc').dir).toBe('asc');
    expect(q('sort=nonsense').sort).toBe('num');
  });
});

describe('filterRows', () => {
  it('type, rarity, stage and form filters never list an unknown entry', () => {
    const all = rows([]);
    for (const s of ['type=Fire', 'rarity=common', 'stage=base', 'form=1']) expect(filterRows(all, q(s), ctx)).toEqual([]);
  });

  it('a zone filter keeps unknown entries that live there (as silhouettes)', () => {
    const z = habitatsOf(byDex[0]!.id)[0]?.zoneId ?? habitatsOf('dustcub')[0]!.zoneId;
    const out = filterRows(rows([]), q(`zone=${z}`), ctx);
    expect(out.length).toBeGreaterThan(0);
    for (const r of out) expect(habitatsOf(r.sp.id).some((h) => h.zoneId === z)).toBe(true);
  });

  it('form=1 lists only recorded species with a battle form', () => {
    const out = filterRows(rows(['toxshade', 'dustcub']), q('form=1'), ctx);
    expect(out.map((r) => r.sp.id)).toEqual(['toxshade']);
  });
});

describe('catchableNow', () => {
  it('needs an open zone and the right hour', () => {
    const night = SPECIES.find((sp) => habitatsOf(sp.id).length > 0 && habitatsOf(sp.id).every((h) => h.time === 'night' && h.gate === null));
    if (night === undefined) return;
    expect(catchableNow(night, { ...ctx, timeOfDay: 0.9 })).toBe(true);
    expect(catchableNow(night, { ...ctx, timeOfDay: 0.5 })).toBe(false);
    expect(catchableNow(night, { ...ctx, timeOfDay: null })).toBe(true);
  });
});

describe('sortRowsBy', () => {
  it('sorts recorded species by stat total, strongest first, unrecorded last', () => {
    const caught = byDex.slice(0, 10).map((s) => s.id);
    const out = sortRowsBy(rows(caught, [byDex[20]!.id]), 'total', 'desc');
    const totals = out.slice(0, 10).map((r) => r.sp.baseHp + r.sp.baseAtk + r.sp.baseDef + r.sp.baseSpd);
    expect([...totals].sort((a, b) => b - a)).toEqual(totals);
    expect(out.slice(10).every((r) => r.state !== 'caught')).toBe(true);
  });

  it('by name puts unknown entries last both ways', () => {
    const r = rows([byDex[0]!.id, byDex[1]!.id]);
    expect(sortRowsBy(r, 'name', 'asc').slice(0, 2).every((x) => x.state === 'caught')).toBe(true);
    expect(sortRowsBy(r, 'name', 'desc').slice(0, 2).every((x) => x.state === 'caught')).toBe(true);
  });
});
