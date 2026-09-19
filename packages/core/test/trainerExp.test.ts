import { describe, expect, it } from 'vitest';
import { TRAINER_EXP, trainerExpFor, trainerLevelFor } from '../src/index';
import type { TrainerExpEvent } from '../src/index';

describe('§2.18 trainer exp', () => {
  it('all 14 TRAINER_EXP values', () => {
    const expected: Record<TrainerExpEvent, number> = {
      wildWin: 10,
      catch: 25,
      catchNewSpecies: 50,
      trainerWin: 40,
      gymWin: 200,
      eliteWin: 400,
      championWin: 1000,
      pvpWin: 60,
      pvpLoss: 20,
      raidClear: 150,
      questComplete: 100,
      dailyLogin: 30,
      tradeComplete: 15,
      zoneRestored: 500,
    };
    expect(Object.keys(TRAINER_EXP).length).toBe(14);
    for (const k of Object.keys(expected).sort() as TrainerExpEvent[]) {
      expect(TRAINER_EXP[k]).toBe(expected[k]);
      expect(trainerExpFor(k)).toBe(expected[k]);
    }
  });

  it('trainerLevelFor is linear, min(100, floor(exp / 1000) + 1)', () => {
    expect(trainerLevelFor(0)).toBe(1);
    expect(trainerLevelFor(999)).toBe(1);
    expect(trainerLevelFor(1000)).toBe(2);
    expect(trainerLevelFor(49_000)).toBe(50);
    expect(trainerLevelFor(99_999)).toBe(100);
    expect(trainerLevelFor(200_000)).toBe(100);
    expect(trainerLevelFor(-5)).toBe(1);
  });
});
