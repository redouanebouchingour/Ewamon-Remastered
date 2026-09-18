/** §2.17 — Elo. Server-side only; not part of resolveTurn. */
import type { EloResult } from './types';

export const ELO_K = 32;
export const ELO_DEFAULT = 1000;

function expected(a: number, b: number): number {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

/** winnerDelta = round(K * (1 - expected(w, l))); loserDelta = -round(K * expected(l, w)). */
export function eloDelta(winnerRating: number, loserRating: number): EloResult {
  const winnerDelta = Math.round(ELO_K * (1 - expected(winnerRating, loserRating)));
  const loserDelta = -Math.round(ELO_K * expected(loserRating, winnerRating));
  return { winnerDelta, loserDelta };
}

/** Draw: both deltas = round(K * (0.5 - expected(self, other))). */
export function eloDrawDelta(a: number, b: number): readonly [number, number] {
  return [Math.round(ELO_K * (0.5 - expected(a, b))), Math.round(ELO_K * (0.5 - expected(b, a)))];
}

export const RANK_TIERS: readonly { readonly key: string; readonly label: string; readonly minRating: number }[] = [
  { key: 'bronze', label: 'Bronze', minRating: 0 },
  { key: 'silver', label: 'Silver', minRating: 1100 },
  { key: 'gold', label: 'Gold', minRating: 1250 },
  { key: 'platinum', label: 'Platinum', minRating: 1400 },
  { key: 'diamond', label: 'Diamond', minRating: 1600 },
  { key: 'master', label: 'Master', minRating: 1800 },
];

export function tierFor(rating: number): (typeof RANK_TIERS)[number] {
  let best = RANK_TIERS[0]!;
  for (let i = 1; i < RANK_TIERS.length; i++) {
    const t = RANK_TIERS[i]!;
    if (rating >= t.minRating) best = t;
  }
  return best;
}
