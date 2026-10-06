import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNotNull, isNull, lte, or } from 'drizzle-orm';
import { REFRESH_TOKEN_TTL_MS } from '../constants';
import type { Tx } from '../db';
import { emailTokens, refreshTokens } from '../schema/index';
import type { EmailTokenKind } from '../schema/index';

/** sha-256 hex of the opaque token — the only form persisted. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function mintToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Why `consumeEmailToken` refused a token (the server maps all three to one 400, the client words them). */
export type EmailTokenRefusal = 'unknown' | 'expired' | 'used';

export const authRepo = {
  /** Issues a fresh opaque refresh token (30 d). Only its hash is stored. */
  async issueRefresh(tx: Tx, playerId: string, now: Date): Promise<{ token: string; expiresAt: Date }> {
    const token = mintToken();
    const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
    await tx.insert(refreshTokens).values({ playerId, tokenHash: hashRefreshToken(token), expiresAt, createdAt: now });
    return { token, expiresAt };
  },

  /**
   * Rotation: the presented token must exist, be unrevoked and unexpired at `now`. It is revoked
   * (under FOR UPDATE so a replay loses the race) and a new one issued. null = invalid token.
   */
  async rotateRefresh(tx: Tx, token: string, now: Date): Promise<{ playerId: string; token: string; expiresAt: Date } | null> {
    const [row] = await tx
      .select()
      .from(refreshTokens)
      .where(and(eq(refreshTokens.tokenHash, hashRefreshToken(token)), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, now)))
      .for('update');
    if (!row) return null;
    await tx.update(refreshTokens).set({ revokedAt: now }).where(eq(refreshTokens.id, row.id));
    const fresh = await authRepo.issueRefresh(tx, row.playerId, now);
    return { playerId: row.playerId, ...fresh };
  },

  /**
   * The owner of a token in ANY state (live, revoked or expired), for refresh-reuse detection: a presented
   * token that `rotateRefresh` refuses but that exists revoked is a replay, and the server revokes the
   * whole family (server §30.5.1 #24). null = never issued.
   */
  async ownerOf(tx: Tx, token: string): Promise<{ playerId: string; revokedAt: Date | null; expiresAt: Date } | null> {
    const [row] = await tx
      .select({ playerId: refreshTokens.playerId, revokedAt: refreshTokens.revokedAt, expiresAt: refreshTokens.expiresAt })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashRefreshToken(token)))
      .limit(1);
    return row ?? null;
  },

  /** Revokes one token (logout). true when a live token was revoked. */
  async revoke(tx: Tx, token: string, now: Date): Promise<boolean> {
    const res = await tx
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(and(eq(refreshTokens.tokenHash, hashRefreshToken(token)), isNull(refreshTokens.revokedAt)))
      .returning({ id: refreshTokens.id });
    return res.length > 0;
  },

  /** Revokes every live token of a player (password change, ban). */
  async revokeAll(tx: Tx, playerId: string, now: Date): Promise<number> {
    const res = await tx
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(and(eq(refreshTokens.playerId, playerId), isNull(refreshTokens.revokedAt)))
      .returning({ id: refreshTokens.id });
    return res.length;
  },

  /**
   * Phase C6: issues a single-use email token (password reset or email verification). Only its sha-256 is
   * stored. Any earlier unused token of the same kind for the player is superseded (marked used), so only the
   * newest link in the inbox works.
   */
  async issueEmailToken(tx: Tx, playerId: string, kind: EmailTokenKind, ttlMs: number, now: Date): Promise<{ token: string; expiresAt: Date }> {
    await tx
      .update(emailTokens)
      .set({ usedAt: now })
      .where(and(eq(emailTokens.playerId, playerId), eq(emailTokens.kind, kind), isNull(emailTokens.usedAt)));
    const token = mintToken();
    const expiresAt = new Date(now.getTime() + ttlMs);
    await tx.insert(emailTokens).values({ playerId, kind, tokenHash: hashRefreshToken(token), expiresAt, createdAt: now });
    return { token, expiresAt };
  },

  /**
   * Phase C6: consumes a single-use email token of `kind` under FOR UPDATE (a concurrent replay loses the race).
   * A live token is marked used and its owner returned; otherwise the refusal says why.
   */
  async consumeEmailToken(tx: Tx, token: string, kind: EmailTokenKind, now: Date): Promise<{ ok: true; playerId: string } | { ok: false; reason: EmailTokenRefusal }> {
    const [row] = await tx
      .select()
      .from(emailTokens)
      .where(and(eq(emailTokens.tokenHash, hashRefreshToken(token)), eq(emailTokens.kind, kind)))
      .for('update');
    if (!row) return { ok: false, reason: 'unknown' };
    if (row.usedAt !== null) return { ok: false, reason: 'used' };
    if (row.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: 'expired' };
    await tx.update(emailTokens).set({ usedAt: now }).where(eq(emailTokens.id, row.id));
    return { ok: true, playerId: row.playerId };
  },

  /** Phase C6 housekeeping: deletes email tokens that expired or were used before `before`. */
  async purgeEmailTokens(tx: Tx, before: Date): Promise<number> {
    const res = await tx
      .delete(emailTokens)
      .where(or(lte(emailTokens.expiresAt, before), and(isNotNull(emailTokens.usedAt), lte(emailTokens.usedAt, before))))
      .returning({ id: emailTokens.id });
    return res.length;
  },

  /** Housekeeping: deletes tokens expired or revoked before `before`. */
  async purge(tx: Tx, before: Date): Promise<number> {
    const res = await tx
      .delete(refreshTokens)
      .where(or(lte(refreshTokens.expiresAt, before), and(isNotNull(refreshTokens.revokedAt), lte(refreshTokens.revokedAt, before))))
      .returning({ id: refreshTokens.id });
    return res.length;
  },
};

export type AuthRepo = typeof authRepo;
