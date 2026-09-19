import { describe, expect, it } from 'vitest';
import { CATCH_B, createRng } from '../src/index';
import type { Battler, OrbDef } from '../src/index';
import { catchStatusBonus, catchValue, orbMultiplier, resolveCatch } from '../src/catch';
import { battler, catchWith, content, countingRng, eventsOf, findSeed, scriptedRng, startBattle, turn } from './helpers';

const orb = (id: string): OrbDef => content.orb(id);
const sp = (b: Battler) => content.species(b.creature.speciesId);

describe('§2.15 CATCH_B', () => {
  it('has 256 entries, [0] = 0, [255] = 65536, monotonic non-decreasing, all integers', () => {
    expect(CATCH_B.length).toBe(256);
    expect(CATCH_B[0]).toBe(0);
    expect(CATCH_B[255]).toBe(65536);
    for (let i = 1; i < 256; i++) {
      expect(Number.isInteger(CATCH_B[i])).toBe(true);
      expect(CATCH_B[i]!).toBeGreaterThanOrEqual(CATCH_B[i - 1]!);
    }
  });

  it('regenerating with Math.pow on this engine is compared and reported; the committed literal wins', () => {
    const mismatches: number[] = [];
    for (let a = 1; a <= 255; a++) {
      const regen = Math.floor(65536 / (255 / a) ** 0.1875);
      if (regen !== CATCH_B[a]) mismatches.push(a);
    }
    if (mismatches.length > 0) {
      // Reported, not failed: the literal is the truth (§2.15). Any engine that disagrees is the reason the table is committed.
      console.warn(`CATCH_B: ${mismatches.length} entries differ from Math.pow regeneration on this engine: ${mismatches.join(',')}`);
    }
    expect(mismatches.length).toBeLessThanOrEqual(255);
    expect(CATCH_B[1]).toBe(23187);
    expect(CATCH_B[128]).toBe(57591);
  });
});

describe('§2.15 the a formula', () => {
  interface Row {
    readonly species: string;
    readonly hpFraction: number; // H / M
    readonly orb: string;
    readonly status?: 'sleep' | 'freeze' | 'burn' | 'poison' | 'paralyze';
    readonly alpha?: boolean;
    readonly expectRate: number;
    readonly expectOrb: number;
    readonly expectStatus: number;
  }
  // 12 rows: (M, H, rate, orb, status, alpha)
  const rows: readonly Row[] = [
    { species: 'bramblecub', hpFraction: 1, orb: 'spark_orb', expectRate: 45, expectOrb: 1, expectStatus: 1 },
    { species: 'bramblecub', hpFraction: 0.5, orb: 'spark_orb', expectRate: 45, expectOrb: 1, expectStatus: 1 },
    { species: 'bramblecub', hpFraction: 1, orb: 'crest_orb', expectRate: 45, expectOrb: 1.75, expectStatus: 1 },
    { species: 'bramblecub', hpFraction: 1, orb: 'prism_orb', status: 'sleep', expectRate: 45, expectOrb: 2.5, expectStatus: 2 },
    { species: 'bramblecub', hpFraction: 1, orb: 'spark_orb', status: 'freeze', expectRate: 45, expectOrb: 1, expectStatus: 2 },
    { species: 'bramblecub', hpFraction: 1, orb: 'spark_orb', status: 'burn', expectRate: 45, expectOrb: 1, expectStatus: 1.5 },
    { species: 'bramblecub', hpFraction: 1, orb: 'spark_orb', status: 'poison', expectRate: 45, expectOrb: 1, expectStatus: 1.5 },
    { species: 'bramblecub', hpFraction: 1, orb: 'spark_orb', status: 'paralyze', expectRate: 45, expectOrb: 1, expectStatus: 1.5 },
    { species: 'bramblecub', hpFraction: 1, orb: 'verdant_orb', expectRate: 45, expectOrb: 3, expectStatus: 1 }, // Grass type bonus x3
    { species: 'cindercap', hpFraction: 1, orb: 'verdant_orb', expectRate: 30, expectOrb: 1, expectStatus: 1 }, // no Grass → no bonus
    { species: 'bramblecub', hpFraction: 1, orb: 'mythos_orb', alpha: true, expectRate: 22, expectOrb: 6, expectStatus: 1 }, // alpha halves rate; mythos 1.5 x4
    { species: 'glacinid', hpFraction: 0.1, orb: 'spark_orb', alpha: true, expectRate: 3, expectOrb: 1, expectStatus: 1 }, // catchRate 3 → alpha floor(1.5)=1 → min 3
  ];

  it('12 (M, H, rate, orb, status, alpha) rows', () => {
    for (const r of rows) {
      const full = battler({ species: r.species, level: 30, isAlpha: r.alpha ?? false, status: r.status === undefined ? [] : [r.status] });
      const H = Math.max(1, Math.floor(full.maxHp * r.hpFraction));
      const wild: Battler = { ...full, creature: { ...full.creature, hp: H } };
      const M = wild.maxHp;
      const o = orb(r.orb);
      expect(orbMultiplier(o, wild, sp(wild))).toBe(r.expectOrb);
      expect(catchStatusBonus(wild)).toBe(r.expectStatus);
      const expected = Math.max(1, Math.floor(((3 * M - 2 * H) * r.expectRate * r.expectOrb * r.expectStatus) / (3 * M)));
      expect(catchValue(wild, sp(wild), o)).toBe(expected);
    }
  });

  it('full hp → a = floor(rate * orb * status / 3); 1 hp → nearly rate * orb * status', () => {
    const full = battler({ species: 'bramblecub', level: 30 });
    expect(catchValue(full, sp(full), orb('spark_orb'))).toBe(15); // 45 / 3
    const low: Battler = { ...full, creature: { ...full.creature, hp: 1 } };
    const M = full.maxHp;
    expect(catchValue(low, sp(low), orb('spark_orb'))).toBe(Math.floor(((3 * M - 2) * 45) / (3 * M)));
  });

  it('aether_orb (999) makes a ≥ 255 for every species at full hp; alpha_or_variant bonus fires on a variant too', () => {
    for (const s of content.allSpecies()) {
      const w = battler({ species: s.id, level: 50 });
      expect(catchValue(w, s, orb('aether_orb'))).toBeGreaterThanOrEqual(255);
    }
    const variant = battler({ species: 'bramblecub', level: 30 });
    const dawn: Battler = { ...variant, creature: { ...variant.creature, variantKey: 'dawn' } };
    expect(orbMultiplier(orb('mythos_orb'), dawn, sp(dawn))).toBe(6);
    expect(orbMultiplier(orb('mythos_orb'), variant, sp(variant))).toBe(1.5);
  });
});

describe('§2.15 shakes', () => {
  it('a ≥ 255 → caught with 0 rng draws, shakes 4', () => {
    const w = battler({ species: 'bramblecub', level: 30 });
    const rng = countingRng(createRng(1));
    const r = resolveCatch(w, sp(w), orb('aether_orb'), rng);
    expect(r).toEqual({ a: expect.any(Number), caught: true, shakes: 4 });
    expect(r.a).toBeGreaterThanOrEqual(255);
    expect(rng.count()).toBe(0);
  });

  it('otherwise up to four rng.int(65536) draws against CATCH_B[a]; caught iff all four pass', () => {
    const w = battler({ species: 'bramblecub', level: 30 }); // a = 15
    const b = CATCH_B[15]!;
    expect(resolveCatch(w, sp(w), orb('spark_orb'), scriptedRng([b - 1, b - 1, b - 1, b - 1]))).toEqual({ a: 15, caught: true, shakes: 4 });
    const fail0 = scriptedRng([b, 0, 0, 0]);
    expect(resolveCatch(w, sp(w), orb('spark_orb'), fail0)).toEqual({ a: 15, caught: false, shakes: 0 });
    expect(fail0.draws()).toBe(1);
    const fail1 = scriptedRng([b - 1, b, 0, 0]);
    expect(resolveCatch(w, sp(w), orb('spark_orb'), fail1)).toEqual({ a: 15, caught: false, shakes: 1 });
    expect(fail1.draws()).toBe(2);
    const fail3 = scriptedRng([b - 1, b - 1, b - 1, 65535]);
    expect(resolveCatch(w, sp(w), orb('spark_orb'), fail3)).toEqual({ a: 15, caught: false, shakes: 3 });
    expect(fail3.draws()).toBe(4);
  });

  it('catch probability tracks (b / 65536)^4 over 20 000 seeded throws', () => {
    const w = battler({ species: 'bramblecub', level: 30 });
    const b = CATCH_B[15]!; // ~0.705 → p^4 ≈ 0.247
    const p = (b / 65536) ** 4;
    const rng = createRng('shakes');
    let caught = 0;
    for (let i = 0; i < 20_000; i++) if (resolveCatch(w, sp(w), orb('spark_orb'), rng).caught) caught++;
    expect(Math.abs(caught / 20_000 - p)).toBeLessThan(0.015);
  });
});

describe('§2.15 in the turn', () => {
  it('a guaranteed catch: catchThrow, three catchShake, catchResult { caught: true, shakes: 4 }, battle ends with the slot; end-of-turn is skipped', () => {
    const start = startBattle({ a: { species: 'bramblecub' }, b: { species: 'cindercap' }, format: 'wild' });
    const r = turn(start.state, catchWith('aether_orb'), null);
    const types = r.events.map((e) => e.t);
    expect(types).toEqual(['turnStart', 'catchThrow', 'catchShake', 'catchShake', 'catchShake', 'catchResult', 'battleEnd']);
    expect(eventsOf(r.events, 'catchShake').map((e) => e.n)).toEqual([1, 2, 3]);
    expect(eventsOf(r.events, 'catchResult')[0]).toEqual({ t: 'catchResult', caught: true, target: { side: 1, slot: 0 }, shakes: 4 });
    expect(r.state.ended).toEqual({ winner: 'caught', slot: 0 });
    expect(r.state.turn).toBe(1);
    expect(r.state.sides[0].consumedItems).toEqual(['aether_orb']);
  });

  it('on failure the orb is still consumed, catchShake count is min(3, shakes), and the wild side still acts', () => {
    const fail = findSeed((seed) => {
      const start = startBattle({ a: { species: 'bramblecub', level: 100 }, b: { species: 'glacinid', level: 20 }, format: 'wild', seed });
      const r = turn(start.state, catchWith('spark_orb'), null);
      const res = eventsOf(r.events, 'catchResult')[0]!;
      return res.caught ? null : r;
    });
    const res = eventsOf(fail.events, 'catchResult')[0]!;
    expect(res.caught).toBe(false);
    expect(eventsOf(fail.events, 'catchShake').length).toBe(Math.min(3, res.shakes));
    expect(fail.state.ended).toBeNull();
    expect(fail.state.sides[0].consumedItems).toEqual(['spark_orb']);
    const idx = fail.events.map((e) => e.t);
    expect(idx.indexOf('catchResult')).toBeLessThan(idx.indexOf('moveUsed'));
    expect(eventsOf(fail.events, 'moveUsed')[0]!.who.side).toBe(1);
  });

  it('catch is rejected outside a catchable side (cannotCatch) and for unknown orbs (unknownOrb)', () => {
    const trainer = startBattle({ a: { species: 'bramblecub' }, b: { species: 'cindercap' }, format: 'trainer' });
    expect(() => turn(trainer.state, catchWith('spark_orb'), null)).toThrow(/cannotCatch/);
    const wild = startBattle({ a: { species: 'bramblecub' }, b: { species: 'cindercap' }, format: 'wild' });
    expect(() => turn(wild.state, catchWith('poke_ball'), null)).toThrow(/unknownOrb/);
  });
});
