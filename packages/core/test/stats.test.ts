import { describe, expect, it } from 'vitest';
import { accStageRatio, calcMaxHp, calcStat, clampStage, stageRatio } from '../src/index';
import type { StatStage } from '../src/index';
import { applyRatio, mulFloor, ratioOf } from '../src/stats';

// 20 tabulated (base, level) pairs, hand-computed from Math.floor(base * level / 50) + level + 10 (+20 for HP).
const TABLE: readonly [base: number, level: number, stat: number, hp: number][] = [
  [62, 5, 21, 31],
  [62, 50, 122, 132],
  [62, 100, 234, 244],
  [72, 1, 12, 22],
  [72, 50, 132, 142],
  [100, 100, 310, 320],
  [1, 1, 11, 21],
  [255, 100, 620, 630],
  [45, 33, 72, 82],
  [80, 77, 210, 220],
  [128, 100, 366, 376],
  [140, 50, 200, 210],
  [30, 10, 26, 36],
  [55, 15, 41, 51],
  [90, 60, 178, 188],
  [110, 45, 154, 164],
  [75, 99, 257, 267],
  [64, 64, 155, 165],
  [99, 3, 18, 28],
  [136, 88, 337, 347],
];

describe('§2.7 stats', () => {
  it('calcStat / calcMaxHp against 20 tabulated pairs', () => {
    for (const [base, level, stat, hp] of TABLE) {
      expect(calcStat(base, level)).toBe(stat);
      expect(calcMaxHp(base, level)).toBe(hp);
      expect(calcMaxHp(base, level) - calcStat(base, level)).toBe(10);
    }
  });

  it('stageRatio: the 13-entry atk/def/spd table', () => {
    const expected: Record<StatStage, [number, number]> = {
      [-6]: [2, 8], [-5]: [2, 7], [-4]: [2, 6], [-3]: [2, 5], [-2]: [2, 4], [-1]: [2, 3],
      0: [2, 2], 1: [3, 2], 2: [4, 2], 3: [5, 2], 4: [6, 2], 5: [7, 2], 6: [8, 2],
    };
    for (let s = -6; s <= 6; s++) {
      const [num, den] = stageRatio(s as StatStage);
      const [en, ed] = expected[s as StatStage];
      expect(num / den).toBe(en / ed);
      // stored as an integer ratio so floor(x * num / den) is integer arithmetic
      expect(Number.isInteger(num) && Number.isInteger(den)).toBe(true);
    }
    expect(stageRatio(0)[0] / stageRatio(0)[1]).toBe(1);
    expect(applyRatio(100, stageRatio(1))).toBe(150);
    expect(applyRatio(100, stageRatio(-1))).toBe(66);
    expect(applyRatio(100, stageRatio(6))).toBe(400);
    expect(applyRatio(100, stageRatio(-6))).toBe(25);
  });

  it('accStageRatio: the 13-entry acc/eva table', () => {
    const expected: Record<StatStage, [number, number]> = {
      [-6]: [3, 9], [-5]: [3, 8], [-4]: [3, 7], [-3]: [3, 6], [-2]: [3, 5], [-1]: [3, 4],
      0: [3, 3], 1: [4, 3], 2: [5, 3], 3: [6, 3], 4: [7, 3], 5: [8, 3], 6: [9, 3],
    };
    for (let s = -6; s <= 6; s++) {
      const [num, den] = accStageRatio(s as StatStage);
      const [en, ed] = expected[s as StatStage];
      expect(num / den).toBe(en / ed);
    }
    expect(applyRatio(100, accStageRatio(-1))).toBe(75);
    expect(applyRatio(100, accStageRatio(6))).toBe(300);
  });

  it('clampStage on −10..10', () => {
    for (let n = -10; n <= 10; n++) {
      const c = clampStage(n);
      expect(c).toBe(Math.max(-6, Math.min(6, n)));
      expect(c).toBeGreaterThanOrEqual(-6);
      expect(c).toBeLessThanOrEqual(6);
    }
    expect(clampStage(2.9)).toBe(2);
    expect(clampStage(-2.9)).toBe(-2);
  });

  it('ratioOf turns every content decimal into an exact small ratio', () => {
    expect(ratioOf(1.25)).toEqual([5, 4]);
    expect(ratioOf(1.5)).toEqual([3, 2]);
    expect(ratioOf(0.5)).toEqual([1, 2]);
    expect(ratioOf(1.2)).toEqual([6, 5]);
    expect(ratioOf(1.1)).toEqual([11, 10]);
    expect(ratioOf(0.125)).toEqual([1, 8]);
    expect(ratioOf(0.3333)).toEqual([1, 3]);
    expect(ratioOf(0.75)).toEqual([3, 4]);
    expect(ratioOf(0.8)).toEqual([4, 5]);
    expect(ratioOf(0.25)).toEqual([1, 4]);
    expect(ratioOf(2)).toEqual([2, 1]);
    expect(ratioOf(1)).toEqual([1, 1]);
    expect(mulFloor(99, 0.3333)).toBe(33);
    expect(mulFloor(7, 0.125)).toBe(0);
    expect(mulFloor(100, 0.8)).toBe(80);
    expect(mulFloor(101, 1.25)).toBe(126);
  });
});
