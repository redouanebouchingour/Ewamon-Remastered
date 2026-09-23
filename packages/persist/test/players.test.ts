import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { authRepo, hashRefreshToken } from '../src/repos/auth';
import { PUBLIC_PROFILE_KEYS, playerRepo } from '../src/repos/players';
import { progressRepo } from '../src/repos/progress';
import { socialRepo } from '../src/repos/social';
import { refreshTokens } from '../src/schema/index';
import { T0, at, expectPersistError, mkCreature, mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

const SPEC_KEYS = ['id', 'username', 'title', 'motto', 'body', 'rating', 'peakRating', 'tier', 'trainerLevel', 'badges', 'guildTag', 'dexCaughtCount', 'showcase', 'createdAt'];
const FORBIDDEN = ['email', 'passwordHash', 'password_hash', 'password', 'money', 'isAdmin', 'bannedAt', 'banReason', 'refresh', 'refreshToken', 'refreshTokens', 'token', 'tokenHash', 'usernameLower', 'lastSeenAt', 'x', 'z', 'zoneId', 'angle'];

describe('toPublic() is an allow-list (§5.3)', () => {
  it('Object.keys equals the §5.3 list exactly, in order, and no sensitive value leaks through', async () => {
    await db.transaction(async (tx) => {
      const id = await mkPlayer(tx, 'Ranger_Rei');
      const row = (await playerRepo.byId(tx, id))!;
      expect(row.email).toBe('ranger_rei@test.local');
      expect(row.passwordHash).toBe('argon2id$fake');
      const pub = playerRepo.toPublic(row, { badges: ['bloom'], guildTag: null, dexCaughtCount: 3, showcase: [] });
      expect(Object.keys(pub)).toEqual(SPEC_KEYS);
      expect([...PUBLIC_PROFILE_KEYS]).toEqual(SPEC_KEYS);
      for (const k of FORBIDDEN) expect(pub).not.toHaveProperty(k);
      const json = JSON.stringify(pub);
      expect(json).not.toContain('test.local');
      expect(json).not.toContain('argon2id');
      expect(pub).toMatchObject({ id, username: 'Ranger_Rei', tier: 'bronze', trainerLevel: 1, badges: ['bloom'], guildTag: null, dexCaughtCount: 3, showcase: [], createdAt: T0 });
    });
  });

  it('publicProfile() gathers badges / guild tag / dex count / showcase from the database and nulls ownerId on showcase creatures', async () => {
    await db.transaction(async (tx) => {
      const id = await mkPlayer(tx, undefined, 10_000);
      for (let i = 0; i < 5; i++) await mkCreature(tx, id, { kind: 'party', index: i }, { speciesId: `s${i}` });
      await progressRepo.awardBadge(tx, id, 'bloom', T0);
      await progressRepo.awardBadge(tx, id, 'ember', at(1));
      await progressRepo.markCaught(tx, id, 'bramblecub', 'normal', false, T0);
      await progressRepo.markCaught(tx, id, 'glimfin', 'dusk', true, T0);
      await progressRepo.markSeen(tx, id, 'cindercap', T0); // seen only
      await socialRepo.createGuild(tx, { leaderId: id, name: 'Publics', tag: 'PUB' }, T0);
      await playerRepo.applyRating(tx, id, 300);
      await playerRepo.addTrainerExp(tx, id, 4200);
      const pub = (await playerRepo.publicProfile(tx, id))!;
      expect(Object.keys(pub)).toEqual(SPEC_KEYS);
      expect(pub.badges).toEqual(['bloom', 'ember']);
      expect(pub.guildTag).toBe('PUB');
      expect(pub.dexCaughtCount).toBe(2);
      expect(pub.showcase).toHaveLength(3);
      expect(pub.showcase.map((c) => c.speciesId)).toEqual(['s0', 's1', 's2']);
      for (const c of pub.showcase) expect(c.ownerId).toBeNull();
      expect(pub.rating).toBe(1300);
      expect(pub.tier).toBe('gold');
      expect(pub.trainerLevel).toBe(5);
      const json = JSON.stringify(pub);
      expect(json).not.toContain('@test.local');
      expect(json).not.toContain('argon2id');
      expect(await playerRepo.publicProfile(tx, '00000000-0000-0000-0000-000000000000')).toBeNull();
    });
  });
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

describe('AuthRepo refresh tokens — only hashes are stored, rotation is one-shot', () => {
  it('issue → rotate → replay of the old token fails; revokeAll kills every live token', async () => {
    await db.transaction(async (tx) => {
      const id = await mkPlayer(tx);
      const first = await authRepo.issueRefresh(tx, id, T0);
      expect(first.expiresAt.getTime()).toBe(T0.getTime() + 30 * 24 * 3_600_000);
      const stored = await tx.select().from(refreshTokens);
      expect(stored.map((r) => r.tokenHash)).toEqual([hashRefreshToken(first.token)]);
      expect(stored[0]!.tokenHash).not.toBe(first.token);
      const rotated = await authRepo.rotateRefresh(tx, first.token, at(1000));
      expect(rotated).toMatchObject({ playerId: id });
      expect(rotated!.token).not.toBe(first.token);
      expect(await authRepo.rotateRefresh(tx, first.token, at(2000))).toBeNull(); // replay
      expect(await authRepo.rotateRefresh(tx, rotated!.token, rotated!.expiresAt)).toBeNull(); // expired at `now`
      const again = await authRepo.rotateRefresh(tx, rotated!.token, at(3000));
      expect(again).not.toBeNull();
      expect(await authRepo.revokeAll(tx, id, at(4000))).toBe(1);
      expect(await authRepo.rotateRefresh(tx, again!.token, at(5000))).toBeNull();
      expect(await authRepo.purge(tx, at(1_000_000))).toBe(3);
    });
  });

  it('ownerOf finds a token in any state (reuse detection) and null for a never-issued one', async () => {
    await db.transaction(async (tx) => {
      const id = await mkPlayer(tx);
      const first = await authRepo.issueRefresh(tx, id, T0);
      expect(await authRepo.ownerOf(tx, first.token)).toMatchObject({ playerId: id, revokedAt: null });
      await authRepo.rotateRefresh(tx, first.token, at(1000));
      const revoked = await authRepo.ownerOf(tx, first.token);
      expect(revoked?.playerId).toBe(id);
      expect(revoked?.revokedAt).toEqual(at(1000));
      expect(await authRepo.ownerOf(tx, 'never-issued')).toBeNull();
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
      expect(await progressRepo.dex(tx, id)).toEqual({ seen: ['cindercap', 'glimfin'], caught: ['cindercap', 'glimfin'], variants: { cindercap: ['ember'], glimfin: ['normal', 'dusk'] }, alpha: ['glimfin'] });
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
