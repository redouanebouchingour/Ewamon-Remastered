/**
 * One roaming legendary per season (migration 0014): only the season's first catch is recorded; each season has its
 * own; the list is newest first; the catcher's name outlives the account.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { AnyDb } from '../src/db';
import { legendRepo } from '../src/repos/legends';
import { players } from '../src/schema/index';
import { mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

const at = (d: number): Date => new Date(Date.UTC(2026, 9, d, 12));

describe('season legends', () => {
  it('the first catch only, one per season, newest first; the name outlives the account', async () => {
    await db.transaction(async (tx) => {
      const [a, b] = [await mkPlayer(tx, 'legend_a'), await mkPlayer(tx, 'legend_b')];
      expect(await legendRepo.of(tx, 1)).toBeNull();
      expect(await legendRepo.claim(tx, 1, 'voltaura', a, 'legend_a', at(10))).toBe(true);
      expect(await legendRepo.claim(tx, 1, 'voltaura', b, 'legend_b', at(11))).toBe(false);
      expect(await legendRepo.claim(tx, 2, 'sunjaw', b, 'legend_b', at(30))).toBe(true);
      expect(await legendRepo.of(tx, 1)).toEqual({ season: 1, species: 'voltaura', playerName: 'legend_a', caughtAt: at(10) });
      expect((await legendRepo.all(tx)).map((l) => [l.season, l.playerName])).toEqual([
        [2, 'legend_b'],
        [1, 'legend_a'],
      ]);
      await tx.delete(players).where(eq(players.id, a));
      expect((await legendRepo.of(tx, 1))?.playerName).toBe('legend_a');
    });
  });
});
