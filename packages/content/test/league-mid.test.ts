/**
 * Phase B7: every league trainer carries mid-battle banner lines (`LeagueTrainer.mid`) — non-empty, ≤ 140 chars,
 * distinct — and the schema refuses an empty or over-long one.
 */
import { describe, expect, it } from 'vitest';
import { LEAGUE, LeagueTrainerSchema, MID_LINE_MAX } from '../src/index';

describe('LeagueTrainer.mid (Phase B7)', () => {
  it('all 12 league trainers have both lines, non-empty and ≤ 140 chars', () => {
    expect(LEAGUE).toHaveLength(12);
    expect(MID_LINE_MAX).toBe(140);
    for (const l of LEAGUE) {
      expect(l.mid, l.id).toBeDefined();
      for (const line of [l.mid!.halfHp, l.mid!.lastStand]) {
        expect(line.trim().length, l.id).toBeGreaterThan(0);
        expect(line.length, `${l.id}: ${line}`).toBeLessThanOrEqual(MID_LINE_MAX);
      }
    }
  });

  it('no two trainers share a line', () => {
    const lines = LEAGUE.flatMap((l) => [l.mid!.halfHp, l.mid!.lastStand]);
    expect(new Set(lines).size).toBe(lines.length);
  });

  it('the schema validates them: an empty or over-long line is refused', () => {
    const mira = LEAGUE[0]!;
    expect(LeagueTrainerSchema.safeParse(mira).success).toBe(true);
    expect(LeagueTrainerSchema.safeParse({ ...mira, mid: { halfHp: '', lastStand: 'x' } }).success).toBe(false);
    expect(LeagueTrainerSchema.safeParse({ ...mira, mid: { halfHp: 'x', lastStand: 'y'.repeat(MID_LINE_MAX + 1) } }).success).toBe(false);
  });
});
