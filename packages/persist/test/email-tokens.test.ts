/**
 * Phase C6 — single-use email tokens (password reset, email verification) and `players.email_verified_at`.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { authRepo, hashRefreshToken } from '../src/repos/auth';
import { playerRepo } from '../src/repos/players';
import { emailTokens } from '../src/schema/index';
import { T0, at, mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

const MIN = 60_000;

describe('email tokens (Phase C6)', () => {
  it('stores only the sha-256 of the token; consume is single use and kind-bound', async () => {
    await db.transaction(async (tx) => {
      const id = await mkPlayer(tx);
      const { token, expiresAt } = await authRepo.issueEmailToken(tx, id, 'reset', 30 * MIN, T0);
      expect(expiresAt.getTime()).toBe(T0.getTime() + 30 * MIN);
      const rows = await tx.select().from(emailTokens).where(eq(emailTokens.playerId, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]!.tokenHash).toBe(hashRefreshToken(token));
      expect(rows[0]!.tokenHash).not.toBe(token);
      // the wrong kind does not consume it
      expect(await authRepo.consumeEmailToken(tx, token, 'verify', at(MIN))).toEqual({ ok: false, reason: 'unknown' });
      expect(await authRepo.consumeEmailToken(tx, token, 'reset', at(MIN))).toEqual({ ok: true, playerId: id });
      expect(await authRepo.consumeEmailToken(tx, token, 'reset', at(2 * MIN))).toEqual({ ok: false, reason: 'used' });
      expect(await authRepo.consumeEmailToken(tx, 'never-issued', 'reset', at(MIN))).toEqual({ ok: false, reason: 'unknown' });
    });
  });

  it('an expired token is refused (expiry is exclusive at expires_at)', async () => {
    await db.transaction(async (tx) => {
      const id = await mkPlayer(tx);
      const { token } = await authRepo.issueEmailToken(tx, id, 'reset', 30 * MIN, T0);
      expect(await authRepo.consumeEmailToken(tx, token, 'reset', at(30 * MIN))).toEqual({ ok: false, reason: 'expired' });
    });
  });

  it('a newer token of the same kind supersedes the older one; the other kind is untouched', async () => {
    await db.transaction(async (tx) => {
      const id = await mkPlayer(tx);
      const verify = await authRepo.issueEmailToken(tx, id, 'verify', 60 * MIN, T0);
      const first = await authRepo.issueEmailToken(tx, id, 'reset', 30 * MIN, T0);
      const second = await authRepo.issueEmailToken(tx, id, 'reset', 30 * MIN, at(MIN));
      expect(await authRepo.consumeEmailToken(tx, first.token, 'reset', at(2 * MIN))).toEqual({ ok: false, reason: 'used' });
      expect(await authRepo.consumeEmailToken(tx, second.token, 'reset', at(2 * MIN))).toEqual({ ok: true, playerId: id });
      expect(await authRepo.consumeEmailToken(tx, verify.token, 'verify', at(2 * MIN))).toEqual({ ok: true, playerId: id });
    });
  });

  it('purgeEmailTokens deletes expired and used tokens older than the cut-off', async () => {
    await db.transaction(async (tx) => {
      const id = await mkPlayer(tx);
      const used = await authRepo.issueEmailToken(tx, id, 'verify', 60 * MIN, T0);
      await authRepo.consumeEmailToken(tx, used.token, 'verify', at(MIN));
      await authRepo.issueEmailToken(tx, id, 'reset', 30 * MIN, T0); // expires at +30 min
      const live = await authRepo.issueEmailToken(tx, id, 'reset', 30 * MIN, at(40 * MIN)); // supersedes the previous reset (used at +40)
      const n = await authRepo.purgeEmailTokens(tx, at(45 * MIN));
      expect(n).toBeGreaterThanOrEqual(2); // global: earlier cases in this file left tokens too
      const left = await tx.select().from(emailTokens).where(eq(emailTokens.playerId, id));
      expect(left.map((r) => r.tokenHash)).toEqual([hashRefreshToken(live.token)]);
    });
  });

  it('markEmailVerified stamps once and keeps the first timestamp', async () => {
    await db.transaction(async (tx) => {
      const id = await mkPlayer(tx);
      expect((await playerRepo.byId(tx, id))!.emailVerifiedAt).toBeNull();
      expect(await playerRepo.markEmailVerified(tx, id, at(MIN))).toBe(true);
      expect(await playerRepo.markEmailVerified(tx, id, at(2 * MIN))).toBe(false);
      expect((await playerRepo.byId(tx, id))!.emailVerifiedAt?.getTime()).toBe(at(MIN).getTime());
    });
  });
});
