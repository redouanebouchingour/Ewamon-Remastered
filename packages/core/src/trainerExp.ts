/** §2.18 — trainer exp (Battle Pass). */
import type { TrainerExpEvent } from './types';

export const TRAINER_EXP: Readonly<Record<TrainerExpEvent, number>> = {
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

export function trainerExpFor(e: TrainerExpEvent): number {
  return TRAINER_EXP[e];
}

/** Linear: level = min(100, floor(exp / 1000) + 1). */
export function trainerLevelFor(exp: number): number {
  return Math.min(100, Math.floor(Math.max(0, exp) / 1000) + 1);
}
