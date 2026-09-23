/**
 * §30.6.2 Auth — argon2id password hashing, HS256 access JWTs (15 min, iss/aud), opaque rotating refresh
 * tokens (30 d, stored as sha-256 hex by persist). Refresh reuse after rotation revokes the whole family.
 */
import { hash, verify } from '@node-rs/argon2';
import type { Algorithm, Options } from '@node-rs/argon2';
import type { FastifyInstance } from 'fastify';
import type { Repos, Tx } from '@ewa/persist';
import type { AccessClaims } from '../deps';

/** Algorithm.Argon2id — the enum is an ambient `const enum`, unusable under isolatedModules; 2 is its value. */
const ARGON2ID = 2 as Algorithm;
export const ARGON2: Options = { algorithm: ARGON2ID, memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 };

export const ACCESS_TTL_S = 900;
export const REFRESH_TTL_D = 30;
export const JWT_ISS = 'ewa-server';
export const JWT_AUD = 'ewa';

/** PHC string; 16-byte random salt from the library. */
export function hashPassword(pw: string): Promise<string> {
  return hash(pw, ARGON2);
}

/** Never compares strings: argon2 verify. A malformed PHC is a mismatch, not a crash. */
export async function verifyPassword(phc: string, pw: string): Promise<boolean> {
  try {
    return await verify(phc, pw);
  } catch (_e) {
    return false;
  }
}

let dummyPhc: Promise<string> | null = null;
/** A fixed dummy PHC so a login for a missing user costs the same as a real verify (no user enumeration by timing). */
export function dummyHash(): Promise<string> {
  dummyPhc ??= hashPassword('ewa-dummy-password-for-timing');
  return dummyPhc;
}

/** refresh = 32 random bytes, base64url, stored as sha-256 hex */
export interface TokenPair {
  readonly access: string;
  readonly refresh: string;
}

export function signAccess(fastify: FastifyInstance, player: { readonly id: string; readonly username: string; readonly isAdmin: boolean }): string {
  const claims: AccessClaims = { sub: player.id, usr: player.username, adm: player.isAdmin };
  return fastify.jwt.sign(claims);
}

export async function issueTokens(
  tx: Tx,
  repos: Pick<Repos, 'auth'>,
  fastify: FastifyInstance,
  player: { readonly id: string; readonly username: string; readonly isAdmin: boolean },
  now: Date,
): Promise<TokenPair> {
  const { token } = await repos.auth.issueRefresh(tx, player.id, now);
  return { access: signAccess(fastify, player), refresh: token };
}

export type RotateResult = { readonly ok: true; readonly tokens: TokenPair; readonly playerId: string } | { readonly ok: false; readonly reuse: boolean; readonly playerId: string | null };

/**
 * Rotating: the presented token is revoked and a new one issued in the same tx. A token that exists but is
 * already revoked is a replay → `revokeAll` (token-theft response) + audit `auth.refreshReuse`.
 */
export async function rotateTokens(tx: Tx, repos: Pick<Repos, 'auth' | 'players' | 'audit'>, fastify: FastifyInstance, refresh: string, now: Date): Promise<RotateResult> {
  const rotated = await repos.auth.rotateRefresh(tx, refresh, now);
  if (rotated === null) {
    const owner = await repos.auth.ownerOf(tx, refresh);
    if (owner !== null && owner.revokedAt !== null) {
      await repos.auth.revokeAll(tx, owner.playerId, now);
      await repos.audit.write(tx, { actorId: owner.playerId, action: 'auth.refreshReuse', subject: owner.playerId, detail: {} }, now);
      return { ok: false, reuse: true, playerId: owner.playerId };
    }
    return { ok: false, reuse: false, playerId: owner?.playerId ?? null };
  }
  const row = await repos.players.byId(tx, rotated.playerId);
  if (row === null || row.bannedAt !== null) {
    await repos.auth.revokeAll(tx, rotated.playerId, now);
    return { ok: false, reuse: false, playerId: rotated.playerId };
  }
  return { ok: true, playerId: row.id, tokens: { access: signAccess(fastify, { id: row.id, username: row.username, isAdmin: row.isAdmin }), refresh: rotated.token } };
}
