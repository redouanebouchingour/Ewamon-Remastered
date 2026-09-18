import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNotNull, isNull, lte, or } from 'drizzle-orm';
import { REFRESH_TOKEN_TTL_MS } from '../constants';
import type { Tx } from '../db';
import { refreshTokens } from '../schema/index';

/** sha-256 hex of the opaque token — the only form persisted. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function mintToken(): string {
  return randomBytes(32).toString('base64url');
}

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
