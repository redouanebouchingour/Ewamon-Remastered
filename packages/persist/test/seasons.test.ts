/**
 * Ranked seasons (migration 0011): closing a season ranks everyone with a rated fight in it by rating, with their rated
 * wins and losses there, once (the second close is refused), and pulls every rating halfway back to the base; the
 * standings so far follow the same order; a player's titles are their top-eight places.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { seasonByNumber, seasonResetRating } from '@ewa/content';
import type { AnyDb, Tx } from '../src/db';
import { historyRepo } from '../src/repos/history';
import { seasonRepo } from '../src/repos/seasons';
import { players } from '../src/schema/index';
import { mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

const s1 = seasonByNumber(1);

async function rated(tx: Tx, playerId: string, result: 'win' | 'loss', at: number, ratingDelta: number | null = 10): Promise<void> {
  await historyRepo.recordBattle(tx, {
    battleId: randomUUID(),
    playerId,
    opponent: 'someone',
    format: 'pvp',
    result,
    turns: 3,
    ratingDelta,
    rewards: { money: 0, items: {}, trainerExp: 0, ratingDelta, badge: null },
    seed: [1, 2, 3, 4],
    actions: [],
    happenedAt: new Date(at),
  });
}

const setRating = (tx: Tx, id: string, rating: number) => tx.update(players).set({ rating }).where(eq(players.id, id));
const ratingOf = async (tx: Tx, id: string) => (await tx.select({ r: players.rating }).from(players).where(eq(players.id, id)))[0]!.r;

describe('seasons', () => {
  it('closes once: the standings by rating with the rated record; ratings halfway back; titles', async () => {
    await db.transaction(async (tx) => {
      const [a, b, c, idle, early] = [await mkPlayer(tx), await mkPlayer(tx), await mkPlayer(tx), await mkPlayer(tx), await mkPlayer(tx)];
      await setRating(tx, a, 1240);
      await setRating(tx, b, 1301);
      await setRating(tx, c, 899);
      await setRating(tx, idle, 1100);
      await setRating(tx, early, 1050);
      await rated(tx, a, 'win', s1.startsAt + 1000);
      await rated(tx, a, 'win', s1.startsAt + 2000);
      await rated(tx, a, 'loss', s1.finalsAt + 1000);
      await rated(tx, b, 'win', s1.endsAt - 1);
      await rated(tx, c, 'loss', s1.startsAt);
      // not in the season: an unrated fight, a rated one before it and one after it
      await rated(tx, idle, 'win', s1.startsAt + 5000, null);
      await rated(tx, early, 'win', s1.startsAt - 1);
      await rated(tx, early, 'win', s1.endsAt);

      const sofar = await seasonRepo.current(tx, s1.startsAt, s1.endsAt - 1, 8);
      expect(sofar.map((r) => [r.player.id, r.rank, r.wins, r.losses])).toEqual([
        [b, 1, 1, 0],
        [a, 2, 2, 1],
        [c, 3, 0, 1],
      ]);

      expect(await seasonRepo.lastClosed(tx)).toBe(0);
      expect(await seasonRepo.close(tx, s1, new Date(s1.endsAt + 1000))).toBe(true);
      expect(await seasonRepo.close(tx, s1, new Date(s1.endsAt + 2000))).toBe(false);
      expect(await seasonRepo.lastClosed(tx)).toBe(1);

      const final = await seasonRepo.standings(tx, 1, 1, 50);
      expect(final.map((r) => [r.player.id, r.rank, r.rating, r.wins, r.losses])).toEqual([
        [b, 1, 1301, 1, 0],
        [a, 2, 1240, 2, 1],
        [c, 3, 899, 0, 1],
      ]);
      expect(await ratingOf(tx, b)).toBe(seasonResetRating(1301));
      expect(await ratingOf(tx, b)).toBe(1150);
      expect(await ratingOf(tx, c)).toBe(950);
      expect(await ratingOf(tx, idle)).toBe(1050);
      expect(await seasonRepo.titles(tx, a)).toEqual([{ season: 1, rank: 2 }]);
      expect(await seasonRepo.titles(tx, idle)).toEqual([]);

      // a catch-up close without the reset keeps the ratings
      const s2 = seasonByNumber(2);
      expect(await seasonRepo.close(tx, s2, new Date(s2.endsAt + 1), false)).toBe(true);
      expect(await ratingOf(tx, b)).toBe(1150);
      expect((await seasonRepo.standings(tx, 2, 1, 50)).map((r) => r.player.id)).toEqual([early]);
    });
  });
});
