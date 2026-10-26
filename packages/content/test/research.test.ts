import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TABLES,
  LEGENDARY_IDS,
  MYTHICAL_IDS,
  RESEARCH_LEVEL_POINTS,
  SPECIES,
  formCounter,
  isResearchCounter,
  researchLevel,
  researchMaxPoints,
  researchProgressOf,
  researchTasksOf,
  signatureMovesOf,
  validate,
} from '../src/index';

const ids = (sp: string): string[] => researchTasksOf(sp).map((t) => t.id);

describe('Dex research tasks', () => {
  it('every species has tasks whose tiers can reach level 5', () => {
    for (const s of SPECIES) {
      const tasks = researchTasksOf(s.id);
      expect(tasks.length).toBeGreaterThanOrEqual(3);
      expect(researchMaxPoints(tasks)).toBeGreaterThanOrEqual(RESEARCH_LEVEL_POINTS[4]!);
      for (const t of tasks) expect(isResearchCounter(t.counter)).toBe(true);
    }
  });

  it('the templates appear only where the species can complete them', () => {
    // hollowmane: a night slot on the_rift, a Majin form with a signature move
    expect(ids('hollowmane')).toEqual(expect.arrayContaining(['seen', 'caught', 'defeated', 'seenNight', formCounter('rage'), 'signature', 'alpha', 'variant']));
    expect(ids('hollowmane')).not.toContain('seenWater');
    // glimfin: a water slot
    expect(ids('glimfin')).toContain('seenWater');
    // dustcub and cryptorb: the honor split
    for (const sp of ['dustcub', 'cryptorb']) expect(ids(sp)).toEqual(expect.arrayContaining(['honorHigh', 'honorLow', 'evolved']));
    expect(ids('lawlander')).toEqual(expect.arrayContaining(['evolvedInto']));
    expect(ids('lawlander')).not.toContain('honorHigh');
    // a legendary: no variant or alpha (never wild), a signature move
    expect(ids('glacinid')).toEqual(['seen', 'caught', 'defeated', 'signature']);
    // ravatar: one task per relic form
    for (const f of ['water', 'earth', 'fire', 'air', 'avatar']) expect(ids('ravatar')).toContain(formCounter(f));
  });

  it('signature moves: a form signature, and the newest move a legendary or mythical alone learns', () => {
    expect(signatureMovesOf(SPECIES.find((s) => s.id === 'hollowmane')!)).toEqual(['Hollow Crescent']);
    expect(signatureMovesOf(SPECIES.find((s) => s.id === 'hyoryu')!)).toEqual(['Crimson Lotus Prison']);
    expect(signatureMovesOf(SPECIES.find((s) => s.id === 'zenryu')!)).toEqual(['Kamehameha']);
    expect(signatureMovesOf(SPECIES.find((s) => s.id === 'galaxion')!)).toEqual(['Cosmic Pyre']);
    expect(signatureMovesOf(SPECIES.find((s) => s.id === 'bramblecub')!)).toEqual([]);
  });

  it('legendaries and mythicals get smaller counts at double points', () => {
    for (const id of [...LEGENDARY_IDS, ...MYTHICAL_IDS]) {
      const seen = researchTasksOf(id).find((t) => t.id === 'seen')!;
      expect(seen.points).toBe(2);
      expect(seen.tiers[seen.tiers.length - 1]).toBeLessThanOrEqual(5);
    }
    expect(researchTasksOf('bramblecub').find((t) => t.id === 'seen')!.points).toBe(1);
  });

  it('levels: points map to 0..5, counters to tiers', () => {
    expect(researchLevel(0)).toBe(0);
    expect(RESEARCH_LEVEL_POINTS.map((p) => researchLevel(p))).toEqual([1, 2, 3, 4, 5]);
    expect(researchLevel(RESEARCH_LEVEL_POINTS[1]! - 1)).toBe(1);
    expect(researchLevel(999)).toBe(5);
    const none = researchProgressOf('bramblecub', {});
    expect(none.level).toBe(0);
    expect(none.points).toBe(0);
    const some = researchProgressOf('bramblecub', { seen: 5, caught: 1, defeated: 1 });
    // seen 1 and 5, caught 1, defeated 1: 4 points
    expect(some.points).toBe(4);
    expect(some.level).toBe(2);
    expect(some.tasks.find((t) => t.task.id === 'seen')!.tiersReached).toBe(2);
    const all: Record<string, number> = {};
    for (const t of researchTasksOf('bramblecub')) all[t.counter] = 1000;
    expect(researchProgressOf('bramblecub', all)).toMatchObject({ level: 5, points: researchMaxPoints(researchTasksOf('bramblecub')) });
  });

  it('unknown counters and species are refused', () => {
    expect(isResearchCounter('seen')).toBe(true);
    expect(isResearchCounter('form:majin')).toBe(true);
    expect(isResearchCounter('form:')).toBe(false);
    expect(isResearchCounter('coins')).toBe(false);
    expect(() => researchTasksOf('nobody')).toThrow(RangeError);
  });

  it('mutation: elemutt without its evolution cannot reach level 5 and validation says so', () => {
    const mutated = SPECIES.map((s) => (s.id === 'elemutt' ? { ...s, evolution: null } : s));
    const r = validate({ skipHeightfields: true }, { ...DEFAULT_TABLES, species: mutated });
    expect(r.errors.some((e) => e.startsWith('research elemutt:') && e.includes('level 5'))).toBe(true);
  });
});
