/**
 * §30.6.2 Auth — argon2id password hashing, HS256 access JWTs (15 min, iss/aud), opaque rotating refresh
 * tokens (30 d, stored as sha-256 hex by persist). Refresh reuse after rotation revokes the whole family.
 */
import { randomBytes } from 'node:crypto';
import { argon2Verify, argon2id } from 'hash-wasm';
import type { FastifyInstance } from 'fastify';
import type { Repos, Tx } from '@ewa/persist';
import type { AccessClaims } from '../deps';

/**
 * argon2id via `hash-wasm` (WebAssembly). It replaced `@node-rs/argon2` on 2026-10-05: Windows application
 * control blocks unsigned native `.node` bindings on the dev machine, so the server could not boot. Same
 * algorithm, same parameters, same PHC string format (`$argon2id$v=19$m=19456,t=2,p=1$…`), so stored hashes
 * from either library verify with the other. `algorithm: 2` keeps the old enum value for readers of the constant.
 */
export const ARGON2 = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export const ACCESS_TTL_S = 900;
export const REFRESH_TTL_D = 30;
export const JWT_ISS = 'ewa-server';
export const JWT_AUD = 'ewa';

/** PHC string; 16-byte random salt. */
export function hashPassword(pw: string): Promise<string> {
  return argon2id({
    password: pw,
    salt: randomBytes(16),
    memorySize: ARGON2.memoryCost,
    iterations: ARGON2.timeCost,
    parallelism: ARGON2.parallelism,
    hashLength: ARGON2.outputLen,
    outputType: 'encoded',
  });
}

/** Never compares strings: argon2 verify. A malformed PHC is a mismatch, not a crash. */
export async function verifyPassword(phc: string, pw: string): Promise<boolean> {
  try {
    return await argon2Verify({ password: pw, hash: phc });
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
