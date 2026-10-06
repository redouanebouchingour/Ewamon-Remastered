/**
 * §50.4.4 `public.test.ts` — `toPublic(row, extras)` is an allow-list (spine §5.3): `Object.keys` equals
 * `PUBLIC_PROFILE_KEYS` in order, a column added to the row never appears, `guildTag` is null for a guildless player,
 * `showcase` ≤ 3 with `ownerId === null`, and `publicProfile(tx, id)` gathers the same from the database.
 * (Phase E5: the toPublic cases moved here from players.test.ts, plus the extra-column and guildless cases.)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { PUBLIC_PROFILE_KEYS, playerRepo } from '../src/repos/players';
import type { PlayerRow } from '../src/schema/index';
import { progressRepo } from '../src/repos/progress';
import { socialRepo } from '../src/repos/social';
import { T0, at, mkCreature, mkPlayer, openTestDb } from './helpers';

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

describe('toPublic() ignores what is not on the list', () => {
  it('a column added to the fixture row does not appear; guildTag null and the showcase capped at 3 for a guildless player', async () => {
    await db.transaction(async (tx) => {
      const id = await mkPlayer(tx);
      const row = (await playerRepo.byId(tx, id))!;
      const widened = { ...row, secretColumn: 'leak-me', stripeCustomerId: 'cus_123' } as unknown as PlayerRow;
      const pub = playerRepo.toPublic(widened, { badges: [], guildTag: null, dexCaughtCount: 0, showcase: [] });
      expect(Object.keys(pub)).toEqual([...PUBLIC_PROFILE_KEYS]);
      expect(JSON.stringify(pub)).not.toContain('leak-me');
      expect(JSON.stringify(pub)).not.toContain('cus_123');

      for (let i = 0; i < 6; i++) await mkCreature(tx, id, { kind: 'party', index: i }, { speciesId: `g${i}` });
      const full = (await playerRepo.publicProfile(tx, id))!;
      expect(full.guildTag).toBeNull();
      expect(full.showcase.length).toBeLessThanOrEqual(3);
      for (const c of full.showcase) expect(c.ownerId).toBeNull();
      expect(Object.keys(full)).toEqual([...PUBLIC_PROFILE_KEYS]);
    });
  });
});
