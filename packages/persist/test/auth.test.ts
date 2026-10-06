/**
 * §50.4.4 `auth.test.ts` — refresh tokens (spine §5.2): only sha-256 hashes are stored; rotation revokes the old row
 * and a rotated-away token returns null; `revokeAll` returns the count; `purge` removes expired / revoked rows only;
 * every stamping method takes an explicit `now`, so a frozen clock produces identical rows.
 * The argon2id parameters (`m=19456 t=2 p=1`, read back from the PHC string) are the server's — persist stores the hash
 * opaquely — and are asserted in `packages/server/test/rest-auth.test.ts` ("m=19456 t=2 p=1, PHC string…").
 * (Phase E5: the refresh-token cases moved here from players.test.ts, plus the purge / frozen-clock cases.)
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb, Tx } from '../src/db';
import { authRepo, hashRefreshToken } from '../src/repos/auth';
import { playerRepo } from '../src/repos/players';
import { refreshTokens } from '../src/schema/index';
import { T0, at, mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

const rowsOf = (tx: Tx, playerId: string) => tx.select().from(refreshTokens).where(eq(refreshTokens.playerId, playerId)).orderBy(refreshTokens.createdAt, refreshTokens.expiresAt);

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

describe('AuthRepo — revocation, purge, explicit clocks', () => {
  it('rotation stamps revoked_at on the old row at `now`; the PHC string is stored as given', async () => {
    await db.transaction(async (tx) => {
      const phc = '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$aGFzaGhhc2hoYXNoaGFzaA';
      const { id } = await playerRepo.create(tx, { username: 'phc_keeper', email: 'phc@test.local', passwordHash: phc }, T0);
      expect((await playerRepo.byId(tx, id))!.passwordHash).toBe(phc);
      const first = await authRepo.issueRefresh(tx, id, T0);
      await authRepo.rotateRefresh(tx, first.token, at(500));
      const old = (await rowsOf(tx, id)).find((r) => r.tokenHash === hashRefreshToken(first.token))!;
      expect(old.revokedAt).toEqual(at(500));
      expect(await authRepo.rotateRefresh(tx, first.token, at(600))).toBeNull();
      expect(await authRepo.revoke(tx, first.token, at(700))).toBe(false); // already revoked
    });
  });

  it('revokeAll returns the number of live rows; purge removes only rows expired or revoked before the cutoff', async () => {
    await db.transaction(async (tx) => {
      const id = await mkPlayer(tx);
      await tx.delete(refreshTokens); // this case counts every row in the table
      const day = 24 * 3_600_000;
      const live1 = await authRepo.issueRefresh(tx, id, T0);
      const live2 = await authRepo.issueRefresh(tx, id, at(1));
      const early = await authRepo.issueRefresh(tx, id, new Date(T0.getTime() - 40 * day)); // expired 10 days before T0
      expect(early.expiresAt.getTime()).toBeLessThan(T0.getTime());
      await authRepo.revoke(tx, live2.token, at(2));
      // cutoff T0: only the expired row goes; the revoked-at-T0+2 row and the live row stay
      expect(await authRepo.purge(tx, T0)).toBe(1);
      expect((await rowsOf(tx, id)).map((r) => r.tokenHash).sort()).toEqual([hashRefreshToken(live1.token), hashRefreshToken(live2.token)].sort());
      expect(await authRepo.revokeAll(tx, id, at(3))).toBe(1);
      expect(await authRepo.revokeAll(tx, id, at(4))).toBe(0);
      expect(await authRepo.rotateRefresh(tx, live1.token, at(5))).toBeNull();
      expect(await authRepo.purge(tx, at(2))).toBe(1); // the row revoked at T0+2
      expect(await authRepo.purge(tx, at(3))).toBe(1); // the row revoked at T0+3
      expect(await rowsOf(tx, id)).toEqual([]);
    });
  });

  it('a frozen clock produces identical rows (no wall-clock read anywhere in issue / rotate / revoke)', async () => {
    const run = async (): Promise<unknown[]> =>
      db.transaction(async (tx) => {
        const id = await mkPlayer(tx);
        const a = await authRepo.issueRefresh(tx, id, T0);
        const b = await authRepo.issueRefresh(tx, id, at(10));
        await authRepo.rotateRefresh(tx, a.token, at(20));
        await authRepo.revoke(tx, b.token, at(30));
        await authRepo.issueEmailToken(tx, id, 'verify', 3_600_000, at(40));
        return (await rowsOf(tx, id)).map((r) => ({ createdAt: r.createdAt, expiresAt: r.expiresAt, revokedAt: r.revokedAt }));
      });
    const first = await run();
    await new Promise((res) => setTimeout(res, 25)); // the wall clock moves; the rows must not
    expect(await run()).toEqual(first);
    expect(first).toHaveLength(3);
  });
});
