/**
 * §30.6.1 `buildRest(deps)` — Fastify 5 with plugins/hooks in the spec's registration order:
 * 1 cors · 2 jwt · 3 requireAuth · 4 requireAdmin · 5 zod bodies (handlers parse; Ajv bypassed) ·
 * 6 error handler · 7 request logging · 8 trustProxy · 9 64 KiB body limit, pageSize ≤ 50.
 *
 * Part 2 added marketplace (routes/market.ts), friends / messages / guilds (routes/social.ts) and admin
 * stats + players (routes/admin.ts).
 */
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { corsOrigins } from '../env';
import { JWT_AUD, JWT_ISS } from './auth';
import { installErrorHandler } from './http';
import type { RestDeps } from './http';
import { registerAdminRoutes } from './routes/admin';
import { registerArenaRoutes } from './routes/arena';
import { registerReplayRoutes } from './routes/replay';
import { registerWeatherRoutes } from './routes/weather';
import { registerSeasonRoutes } from './routes/seasons';
import { registerFactionRoutes } from './routes/factions';
import { registerAuthRoutes } from './routes/auth';
import { registerCatalogRoutes } from './routes/catalog';
import { registerMarketRoutes } from './routes/market';
import { registerMeRoutes } from './routes/me';
import { registerPartyRoutes } from './routes/party';
import { registerSocialRoutes } from './routes/social';

export const BODY_LIMIT = 64 * 1024;

export interface RestOptions {
  /** drops a banned player from every room (presence.publish('ewa:kick')) */
  readonly publishKick?: (playerId: string) => void;
}

export function buildRest(deps: RestDeps, opts: RestOptions = {}): FastifyInstance {
  const env = deps.env;
  // the pino instance makes Fastify's logger generic `Logger`; routes take the default instance type
  const app = Fastify({
    loggerInstance: deps.log.child({ component: 'rest' }),
    // 8.
    trustProxy: env.TRUST_PROXY === 'false' ? false : env.TRUST_PROXY,
    // 9.
    bodyLimit: BODY_LIMIT,
  }) as unknown as FastifyInstance;
  // 1. exact-origin CORS, no credentials, GET/POST only
  void app.register(cors, { origin: corsOrigins(env), credentials: false, methods: ['GET', 'POST'] });
  // 2. HS256 access tokens with iss/aud
  void app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_ACCESS_TTL_S, iss: JWT_ISS, aud: JWT_AUD, algorithm: 'HS256' },
    verify: { allowedIss: JWT_ISS, allowedAud: JWT_AUD, algorithms: ['HS256'] },
  });
  // 6.
  installErrorHandler(app);
  // 7. request id / player id on the request logger; onResponse → metrics.rest[route].count/ms
  app.addHook('onRequest', async (req) => {
    req.log = req.log.child({ route: req.routeOptions.url ?? req.url });
  });
  app.addHook('onResponse', async (req, reply) => {
    deps.metrics.recordRest(`${req.method} ${req.routeOptions.url ?? 'unknown'}`, reply.statusCode, reply.elapsedTime);
  });
  // 3–5 are per-route hooks (requireAuth / requireAdmin / zod parse) — see ./http.ts and ./routes/*
  registerRoutes(app, deps, opts);
  return app;
}

export function registerRoutes(app: FastifyInstance, deps: RestDeps, opts: RestOptions): void {
  registerAuthRoutes(app, deps);
  registerMeRoutes(app, deps);
  registerPartyRoutes(app, deps);
  registerCatalogRoutes(app, deps);
  registerMarketRoutes(app, deps);
  registerSocialRoutes(app, deps);
  registerArenaRoutes(app, deps);
  registerReplayRoutes(app, deps);
  registerWeatherRoutes(app, deps);
  registerSeasonRoutes(app, deps);
  registerFactionRoutes(app, deps);
  registerAdminRoutes(app, deps, opts.publishKick ?? (() => undefined));
}
