import { describe, expect, it } from 'vitest';
import { ELO_DEFAULT, ELO_K, RANK_TIERS, createRng, eloDelta, eloDrawDelta, tierFor } from '../src/index';

describe('§2.17 Elo', () => {
  it('constants', () => {
    expect(ELO_K).toBe(32);
    expect(ELO_DEFAULT).toBe(1000);
  });

  it('repair: the loser never gains — 10 000 seeded rating pairs', () => {
    // Legacy: `Math.max(10, negative)` paid the loser +10 on a ranked loss.
    const rng = createRng('elo');
    for (let i = 0; i < 10_000; i++) {
      const w = rng.int(3000);
      const l = rng.int(3000);
      const { winnerDelta, loserDelta } = eloDelta(w, l);
      expect(winnerDelta).toBeGreaterThanOrEqual(0);
      expect(loserDelta).toBeLessThanOrEqual(0);
      // §2.17 is zero-sum: expected(l, w) = 1 - expected(w, l), so |loserDelta| = winnerDelta exactly
      // (§50.4.1's "|w| + |l| within 1 of K" line contradicts the binding §2.17 formula; the spine wins).
      expect(Math.abs(loserDelta)).toBe(winnerDelta);
      expect(winnerDelta).toBeLessThanOrEqual(ELO_K);
      expect(Number.isInteger(winnerDelta) && Number.isInteger(loserDelta)).toBe(true);
    }
  });

  it('hand-computed values', () => {
    expect(eloDelta(1000, 1000)).toEqual({ winnerDelta: 16, loserDelta: -16 });
    // expected(1200, 1000) = 1 / (1 + 10^-0.5) = 0.7597 → winner 32 * 0.2403 = 7.69 → 8; loser -round(32 * 0.2403) = -8
    expect(eloDelta(1200, 1000)).toEqual({ winnerDelta: 8, loserDelta: -8 });
    // upset: expected(1000, 1200) = 0.2403 → winner round(32 * 0.7597) = 24; loser -24
    expect(eloDelta(1000, 1200)).toEqual({ winnerDelta: 24, loserDelta: -24 });
    // extreme gap: strong beats weak → ~0 / ~0; weak beats strong → 32 / -32
    expect(eloDelta(3000, 0).winnerDelta).toBe(0);
    expect(eloDelta(0, 3000)).toEqual({ winnerDelta: 32, loserDelta: -32 });
  });

  it('ratings floor at 0 when the caller applies the delta (loserDelta magnitude ≤ K)', () => {
    const { loserDelta } = eloDelta(10, 10);
    expect(loserDelta).toBe(-16);
    expect(Math.max(0, 10 + loserDelta)).toBe(0);
    expect(eloDelta(5, 2000).loserDelta).toBe(-32);
    expect(eloDelta(2000, 5).loserDelta).toBe(0); // a hopeless underdog loses nothing
  });

  it('draws: equal ratings → 0/0; the lower-rated side gains, the higher loses; symmetric', () => {
    expect(eloDrawDelta(1000, 1000)).toEqual([0, 0]);
    const [a, b] = eloDrawDelta(1200, 1000);
    expect(a).toBeLessThan(0);
    expect(b).toBeGreaterThan(0);
    expect(a).toBe(-b);
    const [c, d] = eloDrawDelta(1000, 1200);
    expect([c, d]).toEqual([b, a]);
  });

  it('RANK_TIERS and tierFor on each threshold and threshold − 1', () => {
    expect(RANK_TIERS.map((t) => [t.key, t.minRating])).toEqual([
      ['bronze', 0],
      ['silver', 1100],
      ['gold', 1250],
      ['platinum', 1400],
      ['diamond', 1600],
      ['master', 1800],
    ]);
    for (let i = 0; i < RANK_TIERS.length; i++) {
      const t = RANK_TIERS[i]!;
      expect(tierFor(t.minRating).key).toBe(t.key);
      if (i > 0) expect(tierFor(t.minRating - 1).key).toBe(RANK_TIERS[i - 1]!.key);
    }
    expect(tierFor(0).key).toBe('bronze');
    expect(tierFor(-50).key).toBe('bronze');
    expect(tierFor(99_999).key).toBe('master');
    expect(tierFor(ELO_DEFAULT).key).toBe('bronze');
  });
});
