/**
 * §50.4.4 `battle-pass.test.ts` — claims are one-shot (`claim` twice → the second returns false, the server answers
 * 409 `AlreadyClaimed`); `setMythicalChoice` needs the level-50 row (Forbidden without it — Phase E5 fix: it used to
 * create the row) and is one-time (AlreadyClaimed); `BATTLE_PASS_MYTHICAL_LEVEL === 50`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { BATTLE_PASS_MAX_LEVEL, BATTLE_PASS_MYTHICAL_LEVEL, battlePassRepo } from '../src/repos/battlePass';
import { T0, at, expectPersistError, mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

describe('battle pass (§5.2 battlePass repo)', () => {
  it('BATTLE_PASS_MYTHICAL_LEVEL === 50, levels 1..100', () => {
    expect(BATTLE_PASS_MYTHICAL_LEVEL).toBe(50);
    expect(BATTLE_PASS_MAX_LEVEL).toBe(100);
  });

  it('claim twice → the second returns false and writes nothing; levels outside 1..100 are refused', async () => {
    await db.transaction(async (tx) => {
      const id = await mkPlayer(tx);
      expect(await battlePassRepo.claim(tx, id, 3, T0)).toBe(true);
      expect(await battlePassRepo.claim(tx, id, 3, at(1))).toBe(false);
      expect(await battlePassRepo.claim(tx, id, 1, at(2))).toBe(true);
      expect(await battlePassRepo.claimedLevels(tx, id)).toEqual([1, 3]);
      for (const bad of [0, 101, 2.5]) await expectPersistError('InvalidArgument', () => battlePassRepo.claim(tx, id, bad, T0));
      // claims are per player
      const other = await mkPlayer(tx);
      expect(await battlePassRepo.claim(tx, other, 3, T0)).toBe(true);
    });
  });

  it('setMythicalChoice without the level-50 row throws (Forbidden) and writes nothing', async () => {
    await db.transaction(async (tx) => {
      const id = await mkPlayer(tx);
      await battlePassRepo.claim(tx, id, 49, T0);
      await expectPersistError('Forbidden', () => battlePassRepo.setMythicalChoice(tx, id, 'lumyth', T0));
      expect(await battlePassRepo.claimedLevels(tx, id)).toEqual([49]);
      expect(await battlePassRepo.mythicalChoice(tx, id)).toBeNull();
    });
  });

  it('with the level-50 row: one choice; a second choice throws AlreadyClaimed and keeps the first', async () => {
    await db.transaction(async (tx) => {
      const id = await mkPlayer(tx);
      expect(await battlePassRepo.claim(tx, id, BATTLE_PASS_MYTHICAL_LEVEL, T0)).toBe(true);
      expect(await battlePassRepo.mythicalChoice(tx, id)).toBeNull();
      await battlePassRepo.setMythicalChoice(tx, id, 'noxmyth', at(1));
      expect(await battlePassRepo.mythicalChoice(tx, id)).toBe('noxmyth');
      await expectPersistError('AlreadyClaimed', () => battlePassRepo.setMythicalChoice(tx, id, 'lumyth', at(2)));
      expect(await battlePassRepo.mythicalChoice(tx, id)).toBe('noxmyth');
      expect(await battlePassRepo.claimedLevels(tx, id)).toEqual([50]);
    });
  });
});
