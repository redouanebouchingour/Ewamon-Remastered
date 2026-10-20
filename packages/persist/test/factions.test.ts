/**
 * Majin vs Tenjin seasons (migration 0013): a trainer's side holds for the season (joining again returns the side
 * held); points go only to a trainer with a side; the totals add up both sides; the best list is per side, most
 * points first, banned trainers left out; a new season starts empty.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { AnyDb } from '../src/db';
import { factionRepo } from '../src/repos/factions';
import { players } from '../src/schema/index';
import { mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

const now = new Date(Date.UTC(2026, 9, 20, 12));

describe('factions', () => {
  it('a side holds for the season; points only with a side; totals, the best list, a new season empty', async () => {
    await db.transaction(async (tx) => {
      const [a, b, c, none, banned] = [await mkPlayer(tx), await mkPlayer(tx), await mkPlayer(tx), await mkPlayer(tx), await mkPlayer(tx)];
      expect(await factionRepo.join(tx, 1, a, 'majin', now)).toBe('majin');
      expect(await factionRepo.join(tx, 1, a, 'tenjin', now)).toBe('majin');
      await factionRepo.join(tx, 1, b, 'majin', now);
      await factionRepo.join(tx, 1, c, 'tenjin', now);
      await factionRepo.join(tx, 1, banned, 'tenjin', now);
      expect(await factionRepo.award(tx, 1, a, 3)).toBe('majin');
      expect(await factionRepo.award(tx, 1, a, 2)).toBe('majin');
      expect(await factionRepo.award(tx, 1, b, 1)).toBe('majin');
      expect(await factionRepo.award(tx, 1, c, 4)).toBe('tenjin');
      expect(await factionRepo.award(tx, 1, banned, 9)).toBe('tenjin');
      expect(await factionRepo.award(tx, 1, none, 3)).toBeNull();
      expect(await factionRepo.award(tx, 1, a, 0)).toBeNull();
      expect(await factionRepo.of(tx, 1, a)).toEqual({ side: 'majin', points: 5 });
      expect(await factionRepo.of(tx, 1, none)).toBeNull();
      expect(await factionRepo.totals(tx, 1)).toEqual({ points: { majin: 6, tenjin: 13 }, members: { majin: 2, tenjin: 2 } });
      await tx.update(players).set({ bannedAt: now }).where(eq(players.id, banned));
      expect((await factionRepo.top(tx, 1, 'majin', 5)).map((r) => [r.player.id, r.points])).toEqual([
        [a, 5],
        [b, 1],
      ]);
      expect((await factionRepo.top(tx, 1, 'tenjin', 5)).map((r) => r.player.id)).toEqual([c]);
      expect(await factionRepo.totals(tx, 2)).toEqual({ points: { majin: 0, tenjin: 0 }, members: { majin: 0, tenjin: 0 } });
      expect(await factionRepo.join(tx, 2, a, 'tenjin', now)).toBe('tenjin');
    });
  });
});
