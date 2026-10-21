/**
 * A living ecosystem (migration 0018): a zone's weekly tally per species adds up across battles, keeps zones, weeks and
 * species apart and ignores an empty take. It lives in the database, so a restart reads the same weights back.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { ecosystemRepo } from '../src/repos/ecosystem';
import { openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

describe('ecosystem takes', () => {
  it('adds catches and knockouts per zone, week and species', async () => {
    await db.transaction(async (tx) => {
      expect(await ecosystemRepo.week(tx, 'deepcut_route', 2)).toEqual([]);
      await ecosystemRepo.add(tx, 'deepcut_route', 2, 'pebblit', 1, 0);
      await ecosystemRepo.add(tx, 'deepcut_route', 2, 'pebblit', 0, 1);
      await ecosystemRepo.add(tx, 'deepcut_route', 2, 'pebblit', 2, 0);
      await ecosystemRepo.add(tx, 'deepcut_route', 2, 'embrock', 0, 0);
      await ecosystemRepo.add(tx, 'deepcut_route', 3, 'pebblit', 0, 5);
      await ecosystemRepo.add(tx, 'mire_route', 2, 'mossling', 1, 0);
      await ecosystemRepo.add(tx, 'deepcut_route', 2, 'coalette', 0, 1);
      expect(await ecosystemRepo.week(tx, 'deepcut_route', 2)).toEqual([
        { speciesId: 'coalette', caught: 0, ko: 1 },
        { speciesId: 'pebblit', caught: 3, ko: 1 },
      ]);
      expect(await ecosystemRepo.week(tx, 'deepcut_route', 3)).toEqual([{ speciesId: 'pebblit', caught: 0, ko: 5 }]);
      expect(await ecosystemRepo.week(tx, 'mire_route', 2)).toEqual([{ speciesId: 'mossling', caught: 1, ko: 0 }]);
    });
  });
});
