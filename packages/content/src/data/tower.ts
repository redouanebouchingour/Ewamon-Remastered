/**
 * Phase D14 — the battle tower (post-game; Solenne's league hall foyer, the "Tower Attendant", interior NPC role
 * `tower`). A run is 3v3 singles with every creature on both sides capped at Lv 50 for the run (the stored creatures
 * are never changed: no exp, no hp written), the party healed between fights, opponents generated from `TOWER.pools`
 * by streak tier, a reward at the end of every `setLength` wins, and the run ends at the first loss. The server
 * (`rooms/towerSession.ts`) owns the run; this file is data plus the two pure rules the client also shows.
 *
 * Pools are derived from SPECIES at load: fully evolved (no further evolution), non-legendary, banded by base-stat
 * total so a longer streak meets stronger species. Bands overlap so every pool stays varied.
 */
import type { TowerDef } from '../types';
import { SPECIES } from './species';

const bst = (s: (typeof SPECIES)[number]): number => s.baseHp + s.baseAtk + s.baseDef + s.baseSpd;
const FINALS = SPECIES.filter((s) => !s.legendary && s.evolution === null);
const band = (lo: number, hi: number): readonly string[] =>
  Object.freeze(
    FINALS.filter((s) => bst(s) >= lo && bst(s) <= hi)
      .map((s) => s.id)
      .sort(),
  );

export const TOWER: TowerDef = Object.freeze({
  levelCap: 50,
  teamSize: 3,
  setLength: 7,
  attendantId: 'solenne.league.tower',
  trainerId: 'tower.challenger',
  trainerName: 'Tower Challenger',
  /** tier t serves streaks [7t, 7t + 7); the last tier every longer streak */
  pools: Object.freeze([band(300, 379), band(350, 399), band(380, 429), band(400, 999)]),
});

/** The pool tier for a streak of `wins` (wins so far in the run, before the fight). */
export function towerTier(wins: number): number {
  return Math.min(TOWER.pools.length - 1, Math.floor(Math.max(0, wins) / TOWER.setLength));
}

/**
 * The reward paid when a run's streak reaches `set × setLength` (set 1 = the 7th win): money growing per set (capped)
 * and items. Money and items only — never a gate.
 */
export function towerSetReward(set: number): { readonly money: number; readonly items: Readonly<Record<string, number>> } {
  const k = Math.max(1, Math.floor(set));
  const money = Math.min(15_000, 2_500 * k);
  if (k === 1) return { money, items: { rarecandy: 1 } };
  if (k === 2) return { money, items: { rarecandy: 1, max_revive: 1 } };
  return { money, items: { rarecandy: 2, big_nugget: 1 } };
}
