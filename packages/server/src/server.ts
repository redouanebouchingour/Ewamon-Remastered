/**
 * §30.1.1 — one process, two listeners. `boot(deps)` wires Colyseus (WS) and Fastify (REST) around one
 * set of repositories and one process-local runtime (presence store, ban cache, metrics, join ticket).
 *
 * Order (R9): the REST app is BUILT (not listening) first, because the room's `onAuth` verifies access
 * tokens with the REST instance's `@fastify/jwt` verifier (same secret/iss/aud by construction). Then:
 * presence/driver → Colyseus Server → define 'zone' → listen WS → listen REST → jobs. `stop()` = jobs →
 * rest.close() → Colyseus graceful shutdown (rooms disposed, transport closed).
 */
import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { LocalDriver, LocalPresence, Server, matchMaker } from '@colyseus/core';
import type { MatchMakerDriver, Presence } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { fnv1a32 } from '@ewa/core';
import type { FastifyInstance } from 'fastify';
import type { AccessClaims, BanCache, ServerDeps } from './deps';
import { envWarnings } from './env';
import { startMarketExpiry } from './jobs/marketExpiry';
import { startLiveOpsRollover } from './liveops/rollover';
import { createMailer } from './mail/mailer';
import { MetricsRegistry, timedDb } from './metrics';
import { buildRest } from './rest/app';
import type { RestDeps } from './rest/http';
import { localRateLimiter, presenceRateLimiter } from './rest/rateLimit';
import { MatchQueue, RANKED_ARENA, RANKED_TICK_MS } from './rooms/matchQueue';
import { ArenaLobby } from './rooms/arenaLobby';
import { ARENA_TICK_MS } from './rooms/arenaQueue';
import { bindArenaRoom, refuseDirectArenaMatchmaking } from './rooms/ArenaRoom';
import { PresenceMirror } from './rooms/presenceMirror';
import { PresenceStore } from './rooms/presenceStore';
import { ARENA_ROOM, ZONE_ROOM, pickZoneRoom } from './rooms/matchmaking';
import { bindZoneRoom, refuseDirectMatchmaking } from './rooms/ZoneRoom';
import { RealWeather } from './game/realWeather';
import { LiveBoard } from './game/liveBoard';
import { startSeasonRollover } from './jobs/seasonRollover';

export const MAX_SOCKETS_PER_IP = 8;

/** 127.0.0.0/8, ::1 and their IPv4-mapped forms. */
export function isLoopback(ip: string): boolean {
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  return v4 === '::1' || v4.startsWith('127.');
}

/**
 * The per-IP socket cap (§30.1.1 beforeUpgrade). Loopback is exempt outside production so the netcode harness
 * (200 bots from 127.0.0.1, §30.10.3) can run; production never exempts anything (P5).
 */
export function socketCapApplies(env: { readonly NODE_ENV: string }, ip: string): boolean {
  if (ip === '') return false;
  return env.NODE_ENV === 'production' || !isLoopback(ip);
}
export const BAN_REFRESH_MS = 30_000;
export const RATE_SWEEP_MS = 60_000;
export const PRESENCE_SWEEP_MS = 30_000;

export interface Booted {
  readonly colyseus: Server;
  readonly rest: FastifyInstance;
  /** the bound ports (useful with PORT_* = 0 in tests) */
  readonly ports: { readonly ws: number; readonly rest: number };
  readonly runtime: RestDeps;
  stop(): Promise<void>;
}

function createBanCache(deps: ServerDeps): BanCache {
  const set = new Set<string>();
  return {
    isBanned: (id) => set.has(id),
    add: (id) => void set.add(id),
    remove: (id) => void set.delete(id),
    async refresh() {
      const ids = await deps.repos.db.transaction((tx) => deps.repos.players.bannedIds(tx));
      set.clear();
      for (const id of ids) set.add(id);
    },
  };
}

export async function boot(deps: ServerDeps): Promise<Booted> {
  const { env, log } = deps;
  const worldSeed = env.SERVER_SEED ?? String(fnv1a32(`${process.pid}:${deps.clock()}`));
  if (env.SERVER_SEED === undefined) log.info({ worldSeed }, 'SERVER_SEED absent — derived world seed');
  for (const w of envWarnings(env)) log.warn(w);

  // 1. presence / driver — the `colyseus` bundle (auth, tools, monitor, playground, redis) is imported only
  //    when Redis is configured, so a dev/test process never loads it
  let presence: Presence;
  let driver: MatchMakerDriver;
  if (env.REDIS_URL !== undefined) {
    const { RedisPresence, RedisDriver } = await import('colyseus');
    presence = new RedisPresence(env.REDIS_URL);
    driver = new RedisDriver(env.REDIS_URL);
  } else {
    presence = new LocalPresence();
    driver = new LocalDriver();
  }

  const presenceStore = new PresenceStore();
  const presenceMirror = new PresenceMirror(presenceStore, presence);
  const bans = createBanCache(deps);
  await bans.refresh();
  const local = localRateLimiter(deps.clock);
  const limiter = env.REDIS_URL !== undefined ? presenceRateLimiter(presence, deps.clock) : local;

  let verify: ((token: string) => AccessClaims) | null = null;
  const metrics = new MetricsRegistry(deps.clock);
  const ticket = randomBytes(24).toString('base64url');
  // Phase D13: the queue lives in presence (any shard / process adds and drops entries); the lease holder matches
  const matchQueue = new MatchQueue(presence, {
    clock: deps.clock,
    arenaRoom: async () => {
      const room = await pickZoneRoom(RANKED_ARENA.zoneId, ticket);
      return { roomId: room.roomId };
    },
    isOnline: async (playerId) => (await presenceMirror.lookup(playerId)) !== null,
  });
  // every transaction the server runs is timed (§30.10.2 db.txPerSec / txP99Ms / poolInUse)
  const repos = { ...deps.repos, db: timedDb(deps.repos.db, metrics) };
  // Arena PvP: the out-of-world queues (presence hashes per mode; the lease holder matches), invites, training
  const arena = new ArenaLobby(presence, { repos, clock: deps.clock, log: log.child({ component: 'arena' }), presenceMirror, ticket });
  const runtime: RestDeps = {
    ...deps,
    repos,
    presenceStore,
    presenceMirror,
    bus: { publish: (topic, data) => void presence.publish(topic, data) },
    metrics,
    bans,
    limiter,
    ticket,
    worldSeed,
    mailer: deps.mailer ?? createMailer(env, log),
    matchQueue,
    arena,
    realWeather: new RealWeather({ fetch: deps.fetch ?? ((url, init) => fetch(url, init)), clock: deps.clock }),
    live: new LiveBoard(presence, deps.clock),
    verifyAccess: (token) => {
      if (verify === null) throw new Error('verifier not ready');
      return verify(token);
    },
  };

  // REST built first (R9) so rooms verify tokens with the same @fastify/jwt instance
  const rest = buildRest(runtime, { publishKick: (playerId) => presence.publish('ewa:kick', { playerId }) });
  await rest.ready();
  verify = (token) => rest.jwt.verify<AccessClaims>(token);

  // 2. Colyseus server
  const colyseus = new Server({
    presence,
    driver,
    transport: new WebSocketTransport({
      pingInterval: 5000,
      pingMaxRetries: 3,
      beforeUpgrade: (_request, context) => {
        const ip = context.ip ?? '';
        if (socketCapApplies(env, ip) && presenceStore.ipCount(ip) >= MAX_SOCKETS_PER_IP) return new Response(null, { status: 429 });
        return undefined;
      },
    }),
    ...(env.PUBLIC_ADDRESS !== undefined ? { publicAddress: env.PUBLIC_ADDRESS } : {}),
    greet: false,
    // R10: signals are handled by main.ts (stop REST + DB too), not by Colyseus' process.exit handler
    gracefullyShutdown: false,
  });
  // 3. the only room type
  const zoneRoom = bindZoneRoom(runtime);
  matchMaker.defineRoomType(ZONE_ROOM, zoneRoom).filterBy(['zoneId', 'shard']);
  // R2: Colyseus' /matchmake/* HTTP routes are refused without the join ticket (after defineRoomType, see there)
  refuseDirectMatchmaking(zoneRoom, runtime.ticket);
  // Arena PvP: one `arena` room per match (created by the lobby with the ticket; seats reserved server-side only)
  const arenaRoom = bindArenaRoom(runtime);
  matchMaker.defineRoomType(ARENA_ROOM, arenaRoom);
  refuseDirectArenaMatchmaking(arenaRoom, runtime.ticket);
  // 4.
  await colyseus.listen(env.PORT_WS);
  const wsPort = (colyseus.transport.server?.address() as AddressInfo | null)?.port ?? env.PORT_WS;
  // 5.
  await rest.listen({ port: env.PORT_REST, host: '0.0.0.0' });
  const restPort = (rest.server.address() as AddressInfo | null)?.port ?? env.PORT_REST;
  // 6. jobs (marketExpiry, liveOpsRollover are part 2; presenceSweep refreshes the 90 s presence keys)
  const timers: NodeJS.Timeout[] = [
    setInterval(() => void bans.refresh().catch((e: unknown) => log.warn({ err: e }, 'ban cache refresh failed')), BAN_REFRESH_MS),
    setInterval(() => local.sweep(), RATE_SWEEP_MS),
    setInterval(() => presenceMirror.sweep(), PRESENCE_SWEEP_MS),
    setInterval(() => void matchQueue.tick().catch((e: unknown) => log.warn({ err: e }, 'ranked matcher pass failed')), RANKED_TICK_MS),
    setInterval(() => void arena.tick().catch((e: unknown) => log.warn({ err: e }, 'arena matcher pass failed')), ARENA_TICK_MS),
  ];
  for (const t of timers) t.unref();
  const jobs: { stop(): void }[] = [startMarketExpiry(deps), startLiveOpsRollover({ ...deps, bus: runtime.bus })];
  // ranked seasons: an ended season is closed (standings kept, ratings halfway back) within a minute
  if (env.SEASON_ROLLOVER === 'on') jobs.push(startSeasonRollover(deps));
  log.info({ ws: wsPort, rest: restPort, db: env.DATABASE_URL !== undefined ? 'postgres' : 'pglite' }, 'ewa server listening');

  let stopped = false;
  return {
    colyseus,
    rest,
    ports: { ws: wsPort, rest: restPort },
    runtime,
    async stop() {
      if (stopped) return;
      stopped = true;
      // 7. jobs → rest.close() → matchMaker graceful shutdown
      for (const t of timers) clearInterval(t);
      arena.dispose();
      for (const j of jobs) j.stop();
      await rest.close();
      await colyseus.gracefullyShutdown(false);
    },
  };
}
