/**
 * Arena PvP content: the Weekly Cup rotation (one per week from Monday 00:00 UTC, the featured route cycling), the four
 * cup rules, and the training pools.
 */
import { describe, expect, it } from 'vitest';
import { ARENA_TRAINING, CUP_PARTY_SIZE, SPECIES, WEEKLY_CUPS, ZONES, cupRefusal, evolutionRoot, weeklyCup } from '../src/index';
import type { ActiveCup, CupMember } from '../src/index';

const DAY = 24 * 60 * 60 * 1000;
const mon = Date.UTC(2026, 9, 12); // Monday 2026-10-12
const cupOf = (kind: string): ActiveCup => {
  for (let w = 0; w < WEEKLY_CUPS.length; w++) {
    const c = weeklyCup(mon + w * 7 * DAY);
    if (c.def.rule.kind === kind) return c;
  }
  throw new Error(kind);
};
const m = (speciesId: string, zoneId: string | null = null): CupMember => ({ speciesId, caughtAt: zoneId === null ? null : { zoneId } });

describe('weeklyCup', () => {
  it('changes on Monday 00:00 UTC and lasts a week', () => {
    const c = weeklyCup(mon + 1);
    expect(c.startsAt).toBe(mon);
    expect(c.endsAt).toBe(mon + 7 * DAY);
    expect(weeklyCup(mon - 1).def.id).not.toBe(c.def.id);
    expect(weeklyCup(mon + 7 * DAY - 1).def.id).toBe(c.def.id);
  });

  it('cycles every cup, and the Origin Grounds featured route is a real zone that moves on', () => {
    const ids = new Set(Array.from({ length: WEEKLY_CUPS.length }, (_, w) => weeklyCup(mon + w * 7 * DAY).def.id));
    expect(ids.size).toBe(WEEKLY_CUPS.length);
    const origin = cupOf('caughtIn');
    expect(ZONES.some((z) => z.id === origin.zone)).toBe(true);
    expect(origin.description).toContain(ZONES.find((z) => z.id === origin.zone)!.name);
    expect(weeklyCup(origin.startsAt + WEEKLY_CUPS.length * 7 * DAY).zone).not.toBe(origin.zone);
  });
});

describe('cupRefusal', () => {
  it('needs a full party', () => {
    expect(cupRefusal([m('mufflo')], cupOf('sharedType'))).toMatch(/full party/);
  });

  it('noRepeatedTypes: six distinct types pass, a repeat fails', () => {
    const singles = SPECIES.filter((s) => s.types.length === 1);
    const distinct: string[] = [];
    const seen = new Set<string>();
    for (const s of singles) {
      if (seen.has(s.types[0]!) || distinct.length >= CUP_PARTY_SIZE) continue;
      seen.add(s.types[0]!);
      distinct.push(s.id);
    }
    const cup = cupOf('noRepeatedTypes');
    expect(cupRefusal(distinct.map((id) => m(id)), cup)).toBeNull();
    expect(cupRefusal([...distinct.slice(0, 5), distinct[0]!].map((id) => m(id)), cup)).toMatch(/more than once/);
  });

  it('starterLines counts evolved starters', () => {
    const cup = cupOf('starterLines');
    const evolved = SPECIES.find((s) => s.evolvesFrom !== null && evolutionRoot(s.id) === 'glimfin')!;
    const party = [m('bramblecub'), m(evolved.id), m('mufflo'), m('mufflo'), m('mufflo'), m('mufflo')];
    expect(cupRefusal(party, cup)).toBeNull();
    expect(cupRefusal([m('bramblecub'), ...Array.from({ length: 5 }, () => m('mufflo'))], cup)).toMatch(/starter lines/);
  });

  it('caughtIn counts the featured zone only', () => {
    const cup = cupOf('caughtIn');
    const z = cup.zone!;
    const ok = [m('mufflo', z), m('mufflo', z), m('mufflo', z), m('mufflo'), m('mufflo', 'mirevale'), m('mufflo')];
    expect(cupRefusal(ok, cup)).toBeNull();
    expect(cupRefusal([m('mufflo', z), m('mufflo', z), ...Array.from({ length: 4 }, () => m('mufflo'))], cup)).toMatch(/you have 2/);
  });

  it('sharedType: one common type', () => {
    const cup = cupOf('sharedType');
    const type = SPECIES[0]!.types[0]!;
    const same = SPECIES.filter((s) => s.types.includes(type)).slice(0, CUP_PARTY_SIZE);
    expect(same).toHaveLength(CUP_PARTY_SIZE);
    expect(cupRefusal(same.map((s) => m(s.id)), cup)).toBeNull();
    const other = SPECIES.find((s) => !s.types.includes(type))!;
    expect(cupRefusal([...same.slice(0, 5), other].map((s) => m(s.id)), cup)).toMatch(/share one type/);
  });
});

describe('ARENA_TRAINING', () => {
  it('every difficulty draws from a non-empty pool of real, non-legendary species', () => {
    for (const t of Object.values(ARENA_TRAINING)) {
      expect(t.pool.length).toBeGreaterThanOrEqual(6);
      for (const id of t.pool) expect(SPECIES.find((s) => s.id === id)?.legendary).toBe(false);
    }
  });
});
