/**
 * The honor ledger (dustcub's line): a creature whose species has an `honor` split evolution carries an honor score in
 * `CreatureInstance.honor` (absent = 0), changed by how it fights, and at the split's level the score picks the branch
 * (`evolutionTarget`). Every other creature never gains the field, so their battles compute exactly what they did before.
 */
import type { HonorReason, SpeciesDef } from './types';

export const HONOR_MIN = -10;
export const HONOR_MAX = 10;

/** What each deed is worth. */
export const HONOR_DELTAS: Readonly<Record<HonorReason, number>> = {
  dirtyTrick: -1, // it landed a Dark-type move
  wildKo: -1,     // a wild creature fainted while it stood on the field opposite
  spared: 1,      // a wild creature was caught while it stood on the field
  duelWon: 2,     // its side won a trainer, league or PvP battle it took part in
};

/** True when the species' evolution is decided by honor, i.e. its battles keep the ledger. */
export function tracksHonor(sp: SpeciesDef): boolean {
  const e = sp.evolution;
  if (e === null || e.kind !== 'split') return false;
  for (let i = 0; i < e.branches.length; i++) {
    const c = e.branches[i]!.condition;
    if (c !== null && c.kind === 'honor') return true;
  }
  return false;
}

export function clampHonor(n: number): number {
  return Math.max(HONOR_MIN, Math.min(HONOR_MAX, Math.trunc(n)));
}
