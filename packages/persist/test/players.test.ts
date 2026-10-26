/**
 * PlayerRepo money / rating / identity and ProgressRepo. Phase E5 moved toPublic / publicProfile to public.test.ts and
 * the refresh-token cases to auth.test.ts (§50.4.4 file names).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { playerRepo } from '../src/repos/players';
import { progressRepo } from '../src/repos/progress';
import { T0, at, expectPersistError, mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

describe('PlayerRepo money / rating / identity', () => {
  it('create refuses duplicate usernames (case-insensitively) and emails', async () => {
    await db.transaction(async (tx) => {
      await mkPlayer(tx, 'Dupe');
      await expectPersistError('UsernameTaken', () => playerRepo.create(tx, { username: 'dupe', email: 'other@test.local', passwordHash: 'h' }, T0));
      await expectPersistError('EmailTaken', () => playerRepo.create(tx, { username: 'fresh', email: 'DUPE@test.local', passwordHash: 'h' }, T0));
      expect((await playerRepo.byUsername(tx, 'DUPE'))!.username).toBe('Dupe');
      expect((await playerRepo.byEmail(tx, ' Dupe@Test.Local '))!.username).toBe('Dupe');
    });
  });

  it('addMoney never goes negative (typed InsufficientFunds, row untouched); applyRating floors at 0 and tracks the peak', async () => {
    await db.transaction(async (tx) => {
      const id = await mkPlayer(tx);
      expect(await playerRepo.addMoney(tx, id, -3000)).toBe(0);
      await expectPersistError('InsufficientFunds', () => playerRepo.addMoney(tx, id, -1));
      expect((await playerRepo.byId(tx, id))!.money).toBe(0);
      await expectPersistError('InvalidArgument', () => playerRepo.addMoney(tx, id, 1.5));
      await expectPersistError('NotFound', () => playerRepo.addMoney(tx, '00000000-0000-0000-0000-000000000000', 5));
      expect(await playerRepo.applyRating(tx, id, 250)).toEqual({ rating: 1250, peakRating: 1250 });
      expect(await playerRepo.applyRating(tx, id, -2000)).toEqual({ rating: 0, peakRating: 1250 });
      expect((await playerRepo.byId(tx, id))!.rankedMatches).toBe(2);
      expect(await playerRepo.addTrainerExp(tx, id, 999)).toEqual({ trainerExp: 999, trainerLevel: 1 });
      expect(await playerRepo.addTrainerExp(tx, id, 1)).toEqual({ trainerExp: 1000, trainerLevel: 2 });
      await expectPersistError('InvalidArgument', () => playerRepo.addTrainerExp(tx, id, -1));
    });
  });

  it('bannedIds lists exactly the banned players', async () => {
    await db.transaction(async (tx) => {
      const a = await mkPlayer(tx);
      const b = await mkPlayer(tx);
      await playerRepo.ban(tx, a, 'spam', T0);
      const ids = await playerRepo.bannedIds(tx);
      expect(ids).toContain(a);
      expect(ids).not.toContain(b);
      await playerRepo.unban(tx, a);
      expect(await playerRepo.bannedIds(tx)).not.toContain(a);
      await playerRepo.setAdmin(tx, b, true);
      expect((await playerRepo.byId(tx, b))!.isAdmin).toBe(true);
    });
  });

  it('lock() returns the row FOR UPDATE and setPosition / ban / unban behave', async () => {
    await db.transaction(async (tx) => {
      const id = await mkPlayer(tx);
      const locked = await playerRepo.lock(tx, id);
      expect(locked.id).toBe(id);
      await playerRepo.setPosition(tx, id, 'cinderhold', 1.5, -2.25, 3.125);
      expect(await playerRepo.byId(tx, id)).toMatchObject({ zoneId: 'cinderhold', x: 1.5, z: -2.25, angle: 3.125 });
      await playerRepo.ban(tx, id, 'griefing', T0);
      expect(await playerRepo.byId(tx, id)).toMatchObject({ bannedAt: T0, banReason: 'griefing' });
      await playerRepo.unban(tx, id);
      expect(await playerRepo.byId(tx, id)).toMatchObject({ bannedAt: null, banReason: null });
      await expectPersistError('NotFound', () => playerRepo.lock(tx, '00000000-0000-0000-0000-000000000000'));
    });
  });
});

describe('ProgressRepo.flagSetAt', () => {
  it('returns when a flag was set, null when absent', async () => {
    await db.transaction(async (tx) => {
      const id = await mkPlayer(tx);
      expect(await progressRepo.flagSetAt(tx, id, 'trainer:x:beaten')).toBeNull();
      await progressRepo.setFlags(tx, id, ['trainer:x:beaten'], at(5000));
      expect(await progressRepo.flagSetAt(tx, id, 'trainer:x:beaten')).toEqual(at(5000));
    });
  });
});

describe('ProgressRepo', () => {
  it('badges are idempotent, dex tracks seen/caught/variants/alpha, quests advance and claim once', async () => {
    await db.transaction(async (tx) => {
      const id = await mkPlayer(tx);
      expect(await progressRepo.awardBadge(tx, id, 'bloom', T0)).toBe(true);
      expect(await progressRepo.awardBadge(tx, id, 'bloom', at(1))).toBe(false);
      expect(await progressRepo.badges(tx, id)).toEqual(['bloom']);
      await progressRepo.markSeen(tx, id, 'glimfin', T0);
      expect(await progressRepo.markCaught(tx, id, 'glimfin', 'normal', false, at(1))).toEqual({ newSpecies: true });
      expect(await progressRepo.markCaught(tx, id, 'glimfin', 'dusk', true, at(2))).toEqual({ newSpecies: false });
      expect(await progressRepo.markCaught(tx, id, 'cindercap', 'ember', false, at(3))).toEqual({ newSpecies: true });
      expect(await progressRepo.dex(tx, id)).toMatchObject({ seen: ['cindercap', 'glimfin'], caught: ['cindercap', 'glimfin'], variants: { cindercap: ['ember'], glimfin: ['normal', 'dusk'] }, alpha: ['glimfin'], shiny: [] });
      await progressRepo.setFlags(tx, id, ['met_elder', 'met_elder', 'saw_shrine'], T0);
      expect(await progressRepo.flags(tx, id)).toEqual(['met_elder', 'saw_shrine']);
      await progressRepo.advance(tx, id, 'q1', 'catch3', 2, false);
      expect(await progressRepo.claim(tx, id, 'q1', T0)).toBe(false);
      await progressRepo.advance(tx, id, 'q1', 'catch3', 3, true);
      expect(await progressRepo.claim(tx, id, 'q1', T0)).toBe(true);
      expect(await progressRepo.claim(tx, id, 'q1', at(1))).toBe(false);
      await progressRepo.advance(tx, id, 'q1', 'catch3', 0, false); // a claimed objective is never rewound
      expect(await progressRepo.quest(tx, id, 'q1')).toEqual([{ objectiveId: 'catch3', count: 3, done: true, claimedAt: T0 }]);
      expect(await progressRepo.claimedQuestIds(tx, id)).toEqual(['q1']);
    });
  });
});
