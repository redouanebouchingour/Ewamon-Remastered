import { describe, expect, it } from 'vitest';
import { accStageRatio, createRng } from '../src/index';
import type { Battler, StatStage } from '../src/index';
import { accuracyCheck, accuracyThreshold } from '../src/accuracy';
import { battler, content, countingRng, customMove, scriptedRng } from './helpers';

const A = (): Battler => battler({ species: 'bramblecub', level: 50 });
const D = (): Battler => battler({ species: 'mufflo', level: 50 });
const M100 = content.move('Tackle'); // accuracy 100, power 40
const M55 = content.move('Hypno Fog'); // accuracy 55, power 0
const M70 = customMove('Tackle', 'T:acc70', { accuracy: 70 });
const NEVER_MISS = customMove('Tackle', 'T:accNull', { accuracy: null });
const STATUS100 = content.move('Growl');

function withStages(b: Battler, acc: StatStage, eva: StatStage): Battler {
  return { ...b, stages: { ...b.stages, acc, eva } };
}

describe('§2.12 accuracy', () => {
  it('exactly one rng draw per check, including accuracy === null', () => {
    for (const m of [M100, M55, M70, NEVER_MISS, STATUS100]) {
      const rng = countingRng(createRng(3));
      accuracyCheck(A(), D(), m, 'none', content, rng);
      expect(rng.count()).toBe(1);
    }
    const self = countingRng(createRng(3));
    accuracyCheck(A(), null, content.move('Howl'), 'none', content, self);
    expect(self.count()).toBe(1);
  });

  it('hit iff rng.int(100) < threshold', () => {
    expect(accuracyThreshold(A(), D(), M70, 'none', content)).toBe(70);
    expect(accuracyCheck(A(), D(), M70, 'none', content, scriptedRng([69]))).toBe(true);
    expect(accuracyCheck(A(), D(), M70, 'none', content, scriptedRng([70]))).toBe(false);
    expect(accuracyCheck(A(), D(), M70, 'none', content, scriptedRng([99]))).toBe(false);
    expect(accuracyCheck(A(), D(), M100, 'none', content, scriptedRng([99]))).toBe(true);
    expect(accuracyCheck(A(), D(), M55, 'none', content, scriptedRng([54]))).toBe(true);
    expect(accuracyCheck(A(), D(), M55, 'none', content, scriptedRng([55]))).toBe(false);
  });

  it('accuracy null never misses, even at roll 99 and −6 accuracy / +6 evasion', () => {
    const a = withStages(A(), -6, 0);
    const d = withStages(D(), 0, 6);
    expect(accuracyCheck(a, d, NEVER_MISS, 'sand', content, scriptedRng([99]))).toBe(true);
    const rng = createRng('never');
    for (let i = 0; i < 20_000; i++) expect(accuracyCheck(a, d, NEVER_MISS, 'none', content, rng)).toBe(true);
  });

  it('a 55 % move hits 55 % ± 2 % over 20 000 rolls', () => {
    const rng = createRng('hypno');
    let hits = 0;
    for (let i = 0; i < 20_000; i++) if (accuracyCheck(A(), D(), M55, 'none', content, rng)) hits++;
    const rate = hits / 20_000;
    expect(rate).toBeGreaterThan(0.53);
    expect(rate).toBeLessThan(0.57);
  });

  it('a 70 % move misses on rolls 70..99 (repair: accuracy is rolled at all)', () => {
    for (let roll = 70; roll < 100; roll++) expect(accuracyCheck(A(), D(), M70, 'none', content, scriptedRng([roll]))).toBe(false);
    for (let roll = 0; roll < 70; roll++) expect(accuracyCheck(A(), D(), M70, 'none', content, scriptedRng([roll]))).toBe(true);
  });

  it('the threshold formula at every acc/eva stage combination (169 cases), for accuracies 100, 70 and 55', () => {
    for (const m of [M100, M70, M55]) {
      for (let acc = -6; acc <= 6; acc++) {
        for (let eva = -6; eva <= 6; eva++) {
          const [accNum, accDen] = accStageRatio(acc as StatStage);
          const [evaNum, evaDen] = accStageRatio(eva as StatStage);
          const expected = Math.floor((Math.floor((m.accuracy! * accNum) / accDen) * evaDen) / evaNum);
          const got = accuracyThreshold(withStages(A(), acc as StatStage, 0), withStages(D(), 0, eva as StatStage), m, 'none', content);
          expect(got).toBe(expected);
        }
      }
    }
    // spot values
    expect(accuracyThreshold(withStages(A(), 6, 0), D(), M100, 'none', content)).toBe(300);
    expect(accuracyThreshold(A(), withStages(D(), 0, 6), M100, 'none', content)).toBe(33);
    expect(accuracyThreshold(withStages(A(), -1, 0), D(), M100, 'none', content)).toBe(75);
    expect(accuracyThreshold(A(), withStages(D(), 0, -1), M100, 'none', content)).toBe(133);
    expect(accuracyThreshold(withStages(A(), 1, 0), withStages(D(), 0, 1), M100, 'none', content)).toBe(99); // floor(133 * 3/4)
  });

  it('a self-targeted move ignores evasion (defender null)', () => {
    expect(accuracyThreshold(withStages(A(), -1, 0), null, content.move('Howl'), 'none', content)).toBe(75);
    expect(accuracyThreshold(A(), null, content.move('Howl'), 'none', content)).toBe(100);
  });

  it('Hustle ×0.8 on damaging moves only', () => {
    const hustle = battler({ species: 'bramblecub', level: 50, ability: 'Hustle' });
    expect(accuracyThreshold(hustle, D(), M100, 'none', content)).toBe(80);
    expect(accuracyThreshold(hustle, D(), M70, 'none', content)).toBe(56);
    expect(accuracyThreshold(hustle, D(), STATUS100, 'none', content)).toBe(100);
    expect(accuracyThreshold(hustle, D(), M55, 'none', content)).toBe(55);
    expect(accuracyCheck(hustle, D(), M100, 'none', content, scriptedRng([80]))).toBe(false);
    expect(accuracyCheck(hustle, D(), M100, 'none', content, scriptedRng([79]))).toBe(true);
  });

  it('Sand Veil ×0.8 on the defender only in sand, for any move', () => {
    const veil = battler({ species: 'mufflo', level: 50, ability: 'Sand Veil' });
    expect(accuracyThreshold(A(), veil, M100, 'sand', content)).toBe(80);
    expect(accuracyThreshold(A(), veil, STATUS100, 'sand', content)).toBe(80);
    expect(accuracyThreshold(A(), veil, M100, 'none', content)).toBe(100);
    expect(accuracyThreshold(A(), veil, M100, 'rain', content)).toBe(100);
    expect(accuracyThreshold(A(), veil, M100, 'hail', content)).toBe(100);
  });

  it('ability multipliers apply attacker side then defender side, each floored, after the stage ratios', () => {
    const hustle = withStages(battler({ species: 'bramblecub', level: 50, ability: 'Hustle' }), 1, 0);
    const veil = withStages(battler({ species: 'mufflo', level: 50, ability: 'Sand Veil' }), 0, 1);
    // 100 → acc +1: 133 → eva +1: floor(133 * 3/4) = 99 → Hustle: floor(99 * 4/5) = 79 → Sand Veil: floor(79 * 4/5) = 63
    expect(accuracyThreshold(hustle, veil, M100, 'sand', content)).toBe(63);
  });
});
