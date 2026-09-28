/**
 * REST plumbing shared by every route file: the error type, the error handler of §30.6.1 step 6, auth /
 * admin / rate-limit hooks, the in-battle guard, response validation, and small view mappers.
 */
import { zone as zoneById } from '@ewa/content';
import { isPersistError } from '@ewa/persist';
import type { PlayerRow } from '@ewa/persist';
import type { InventoryDeltaBody, PlayerProfile } from '@ewa/protocol';
import type { CreatureInstance } from '@ewa/core';
import { tierFor, trainerLevelFor } from '@ewa/core';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import type { z } from 'zod';
import type { AccessClaims, RoomDeps } from '../deps';
import type { LimitKey, RateLimiter } from './rateLimit';
import { LIMITS } from './rateLimit';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessClaims;
    user: AccessClaims;
  }
}

export interface RestDeps extends RoomDeps {
  readonly limiter: RateLimiter;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = 'HttpError';
  }
}

const PERSIST_STATUS: Readonly<Record<string, number>> = { NotFound: 404, Forbidden: 403, InvalidArgument: 400 };

/** §30.6.1 step 6. Never leaks an internal message; 5xx carry the pino request id. */
export function installErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError | Error, req, reply) => {
    if (err instanceof HttpError) {
      if (err.status === 429 && typeof err.extra['retryAfterS'] === 'number') void reply.header('retry-after', String(err.extra['retryAfterS']));
      const { retryAfterS: _r, ...extra } = err.extra;
      return reply.status(err.status).send({ code: err.code, ...extra });
    }
    if (err instanceof ZodError) {
      return reply.status(400).send({ code: 'invalidPayload', issues: err.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message })) });
    }
    if (isPersistError(err)) {
      const status = PERSIST_STATUS[err.code] ?? 409;
      return reply.status(status).send({ code: err.code });
    }
    const code = (err as FastifyError).code;
    if (typeof code === 'string' && (code.startsWith('FST_JWT') || code.startsWith('FAST_JWT'))) {
      return reply.status(401).send({ code: 'unauthorized' });
    }
    const statusCode = (err as FastifyError).statusCode;
    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({ code: statusCode === 413 ? 'payloadTooLarge' : 'invalidPayload' });
    }
    req.log.error({ err }, 'unhandled REST error');
    return reply.status(500).send({ code: 'internal', errorId: req.id });
  });
}

/** Readonly view of a zod input type: core's readonly shapes (CreatureInstance…) are assignable to it. */
export type DeepReadonly<T> = T extends (infer U)[] ? readonly DeepReadonly<U>[] : T extends Date ? T : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;

/** Parses a response in non-production (catches a handler leaking a field); passes through in production. */
export function out<S extends z.ZodType>(deps: RestDeps, schema: S, value: DeepReadonly<z.input<S>>): z.output<S> {
  if (deps.env.NODE_ENV === 'production') return value as z.output<S>;
  return schema.parse(value);
}

export function playerId(req: FastifyRequest): string {
  return req.user.sub;
}

/** `onRequest` for `bearer` routes: jwtVerify + ban cache (§30.6.1 step 3). */
export function requireAuth(deps: RestDeps) {
  return async (req: FastifyRequest): Promise<void> => {
    await req.jwtVerify();
    if (deps.bans.isBanned(req.user.sub)) throw new HttpError(403, 'banned');
  };
}

/** `onRequest` for admin routes: requireAuth + re-reads `is_admin` from the row (never trusts the `adm` claim). */
export function requireAdmin(deps: RestDeps) {
  const auth = requireAuth(deps);
  return async (req: FastifyRequest): Promise<void> => {
    await auth(req);
    const row = await deps.repos.db.transaction((tx) => deps.repos.players.byId(tx, req.user.sub));
    if (row === null || !row.isAdmin) throw new HttpError(403, 'forbidden');
  };
}

async function check(limiter: RateLimiter, scope: string, key: LimitKey): Promise<void> {
  if (!(await limiter.allow(scope, key))) throw new HttpError(429, 'rateLimited', { retryAfterS: Math.ceil(LIMITS[key].windowMs / 1000) });
}

/** `preHandler`: per-player restRead/restWrite + the route's dedicated limit (§30.6.4). Runs after auth. */
export function rateLimit(deps: RestDeps, dedicated?: LimitKey, by: 'player' | 'ip' = 'player') {
  return async (req: FastifyRequest): Promise<void> => {
    const hasUser = (req as { user?: AccessClaims }).user !== undefined && by === 'player';
    if (hasUser) await check(deps.limiter, req.user.sub, req.method === 'GET' ? 'restRead' : 'restWrite');
    if (dedicated !== undefined) await check(deps.limiter, by === 'ip' || !hasUser ? `ip:${req.ip}` : req.user.sub, dedicated);
  };
}

/** §30.6.3: party/creature/item/heal/shop mutations are refused while the player is in a live battle. */
export function refuseInBattle(deps: RestDeps, id: string): void {
  if (deps.presenceStore.battleOf(id) !== null) throw new HttpError(409, 'inBattle');
}

export function presenceZone(deps: RestDeps, id: string): ReturnType<typeof zoneById> | null {
  const p = deps.presenceStore.get(id);
  return p === null ? null : zoneById(p.zoneId);
}

export function iso(d: Date): string {
  return d.toISOString();
}

export function toProfile(row: PlayerRow): PlayerProfile {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    title: row.title,
    motto: row.motto,
    body: row.body,
    money: row.money,
    rating: row.rating,
    peakRating: row.peakRating,
    rankedMatches: row.rankedMatches,
    tier: tierFor(row.rating).key,
    trainerExp: row.trainerExp,
    trainerLevel: trainerLevelFor(row.trainerExp),
    isAdmin: row.isAdmin,
    zoneId: row.zoneId as PlayerProfile['zoneId'],
    createdAt: iso(row.createdAt),
  };
}

export type Reply = FastifyReply;

/**
 * The inventoryDelta-shaped body (protocol `InventoryDeltaBodySchema`) of a REST side effect (P1): absolute
 * counts for the touched items, absolute money or null, creatures by id.
 */
export function inventoryDeltaBody(p: {
  readonly items?: Readonly<Record<string, number>>;
  readonly money?: number | null;
  readonly creaturesAdded?: readonly CreatureInstance[];
  readonly creaturesRemoved?: readonly string[];
  readonly creaturesUpdated?: readonly CreatureInstance[];
  /** where `creaturesAdded` landed (protocol `inventoryDelta.placement`, additive) */
  readonly placement?: Readonly<Record<string, 'party' | 'box'>>;
}): InventoryDeltaBody {
  return {
    items: { ...(p.items ?? {}) },
    money: p.money ?? null,
    creaturesAdded: [...(p.creaturesAdded ?? [])] as InventoryDeltaBody['creaturesAdded'],
    creaturesRemoved: [...(p.creaturesRemoved ?? [])],
    creaturesUpdated: [...(p.creaturesUpdated ?? [])] as InventoryDeltaBody['creaturesUpdated'],
    ...(p.placement !== undefined ? { placement: { ...p.placement } } : {}),
  };
}
