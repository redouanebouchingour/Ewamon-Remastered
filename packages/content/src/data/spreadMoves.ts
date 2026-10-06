/**
 * Phase D6 — the curated doubles reach of moves (`MoveDef.spread`). `'foes'` hits both foes, `'all'` every other
 * battler on the field (the ally too). Read only in doubles; a spread move that strikes 2+ targets deals ×0.75 to each.
 * `data/moves.ts` is generated from legacy (which has no notion of reach), so the reach is laid over it here.
 */
import type { MoveDef, MoveSpread } from '@ewa/core';
import { MOVES as GENERATED } from './moves';

export const SPREAD_MOVES: Readonly<Record<string, MoveSpread>> = {
  // both foes
  'Rock Slide': 'foes',
  'Heat Wave': 'foes',
  Blizzard: 'foes',
  'Dazzling Gleam': 'foes',
  Snarl: 'foes',
  Twister: 'foes',
  'Powder Snow': 'foes',
  'Frozen Tempest': 'foes',
  'Gem Storm': 'foes',
  Growl: 'foes',
  'String Shot': 'foes',
  // every other battler, the ally included
  Earthquake: 'all',
  Discharge: 'all',
  Bulldoze: 'all',
  'Petal Blizzard': 'all',
  'Sparkling Aria': 'all',
};

/** MOVES with the curated `spread` applied (the ContentIndex and every MOVES consumer read this). */
export const MOVES: readonly MoveDef[] = GENERATED.map((m) => {
  const s = SPREAD_MOVES[m.id];
  return s === undefined ? m : { ...m, spread: s };
});
