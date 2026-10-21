# EWAMON REMASTERED — SPEC §30: @ewa/server + NETCODE

**Status:** BINDING. Codes against `00-spine.md` and may not redefine anything in it. Where this file and `00-spine.md` disagree, the spine wins. Where `20-client.md` or `50-verification-budget.md` disagree with this file on a server behaviour, this file wins.

Verified against the installed `.d.ts`, not memory: `@colyseus/core 0.18.14` (`Room.d.ts`: `onCreate/onJoin/onLeave/onDispose/onAuth(client, options, context)`, `setTimestep(cb, delayMs)` with `setSimulationInterval` as its deprecated forwarding alias, `setFixedTimestep`, `onMessage(type, validationSchema: StandardSchemaV1, cb)`, `broadcast`, `allowReconnection(client, seconds)`, `setMetadata`, `lock/unlock`, `maxClients`, `patchRate`, `clock: ClockTimer`, `presence: Presence`; `MatchMaker.d.ts`: `query`, `findOneRoomAvailable`, `createRoom`, `reserveSeatFor(room: IRoomCache, options, authData)`, `getLocalRoomById`, `remoteRoomCall`, `defineRoomType`; `RegisteredHandler.d.ts`: `filterBy`, `sortBy`; `Transport.d.ts`: `Client.view?: StateView`, `AuthContext { token?, ip, headers }`; `IPC.d.ts`: `subscribeIPC`, `requestFromIPC`; `presence/Presence.d.ts`: `setex/get/del/hincrbyex/publish/subscribe`), `@colyseus/shared-types 0.18.2` (`ISeatReservation { name, sessionId, roomId, publicAddress?, processId?, reconnectionToken? }`), `@colyseus/schema 5.0.32` (`StateView.add/remove/dispose`), `@colyseus/ws-transport 0.18` (`WebSocketTransport({ pingInterval, pingMaxRetries, beforeUpgrade })`), `colyseus 0.18.5` (re-exports `RedisPresence`, `RedisDriver`), `@colyseus/sdk 0.18.2` (`consumeSeatReservation(ISeatReservation)`), `fastify 5.12.4`, `@fastify/jwt 10.2.2` (`FastifyJWTOptions { secret, sign: { expiresIn } }`, `request.jwtVerify()`, `reply.jwtSign()`), `@node-rs/argon2 2.2.1` (`hash(password, { memoryCost, timeCost, parallelism, algorithm: Algorithm.Argon2id })`, `verify`), `drizzle-orm 0.45.2` (`.for('update', { skipLocked: true })`), `pino 9.14.0`. `@fastify/rate-limit` is **not** installed; rate limiting is a server module (§30.6.4).

<!-- amended 2026-09-25: behaviours of the installed Colyseus the first draft got wrong; every item below was read from source and is what the implemented server relies on (packages/server IMPLEMENTATION-NOTES "Verified against the installed libraries") -->
Behaviours of `@colyseus/core` 0.18.14 / `@colyseus/schema` 5.0.32 this file depends on (paths relative to the package roots):

- `Room<T extends RoomOptions>` with `RoomOptions { state?; metadata?; client? }`; auth and user data are typed on `Client<{ userData; auth }>` (`src/Room.ts` lines 107–121, `src/Transport.ts` line 213). The pre-0.18 `Room<{ state; metadata; auth; userData }>` shape does not type-check the way §30.2.1's first draft assumed.
- A payload rejected by the `onMessage(type, validator, cb)` validator closes the client with 4002 (`src/RoomMessages.ts` lines 189–196); a message with no registered handler does the same outside dev mode (lines 334–342). Hence §30.2.2 step 6: zod runs in the handler wrapper and a `'*'` handler counts unknown types.
- A non-consented close is routed to `onDrop(client, code)`, where `allowReconnection(client, seconds)` belongs; `onLeave` is called only when the reconnection fails or the leave was consented (`src/Room.ts` lines 650, 2313–2315, 2361–2373).
- `CloseCode`: 4000 consented, 4001 server shutdown, 4002 with error, 4003 failed to reconnect, 4010 may try reconnect (`@colyseus/shared-types` `src/Protocol.ts` lines 279–284); the SDK auto-reconnects on 1001/1005/1006/4010 (`@colyseus/sdk` `src/Room.ts` lines 166–173).
- `Server({ gracefullyShutdown })` defaults to registering SIGINT/SIGTERM/SIGUSR2 and `uncaughtException` handlers that end in `process.exit` (`src/Server.ts` lines 180–181, 411; `src/utils/Utils.ts` lines 67–79).
- Colyseus always mounts its HTTP matchmaking routes `POST /matchmake/:method/:roomName` for `joinOrCreate | create | join | joinById | reconnect` (`src/router/default_routes.ts` line 6, `src/matchmaker/controller.ts` line 22, `src/Server.ts` lines 331–340), guarded only by the room's **static** `onAuth`, whose default returns `true` (`src/Room.ts` lines 788–794): without §30.2.6's join ticket any authenticated client could create shards or join any zone room with arbitrary options.
- `StateView.add` throws on an instance not yet attached to the state (`@colyseus/schema` `src/encoder/StateView.ts` lines 334–349).

---

## §30.0 MODULE LAYOUT

`packages/server/src/`:

| File | Owns |
|---|---|
| `main.ts` | Boots one process: env parse → `createRepos` → Colyseus `Server` on `PORT_WS` → Fastify on `PORT_REST` → expiry/live-ops jobs. The only file with side effects at import time. |
| `env.ts` | `Env` (zod-parsed `process.env`, §30.1.2). Throws at boot on any invalid value. |
| `rooms/ZoneRoom.ts` | `ZoneRoom extends Room<{ state: ZoneState; metadata: ZoneMeta; client: ZoneClient }>`. Tick, movement, AOI, handover, sharding. |
| `rooms/matchmaking.ts` | `pickZoneRoom`, `reserveZoneSeat`: every seat carries the per-process join ticket (§30.2.6). |
| `rooms/aoi.ts` | Pure `AoiGrid` (§30.2.5). Unit-tested without Colyseus. |
| `rooms/movement.ts` | Pure `validateInput` (§30.2.4). |
| `rooms/spawnDirector.ts` | Pure `SpawnDirector` (§30.3). |
| `rooms/battleSession.ts` | `BattleSession` + `BattleCoordinator` (§30.4). |
| `rooms/raidSession.ts` | `RaidSession` (§30.4.7). |
| `rooms/tradeSession.ts` | `TradeSession` (§30.8.3). |
| `rooms/challengeStore.ts` | Pure `ChallengeStore` (§30.4.5) — the legacy `createChallengeStore` shape, ported. |
| `rooms/matchQueue.ts` | Phase D13 `MatchQueue` (presence-keyed ranked queue + leased matcher), `pairUp`, `RankedArena` (§30.4.5a). |
| `rooms/arenaQueue.ts` · `rooms/arenaLobby.ts` · `rooms/ArenaRoom.ts` | Arena PvP (§30.4.10): the per-mode presence queue, the lobby (match step, invites, training, rejoin, pushes), the `arena` room type. <!-- amended 2026-10-11: arena PvP --> |
| `rooms/storyBeats.ts` | Beat firing and completion on `interact` (§30.4.8); uses content's `nextStoryBeat`/`beatDoneFlag`/`harvestStateFor`. |
| `rooms/presenceStore.ts` | Pure `PresenceStore` (§30.7.4). |
| `rest/app.ts` | `buildRest(deps): FastifyInstance` — plugins, hooks, route registration. |
| `rest/routes/*.ts` | One file per row group of the §4.7 table. |
| `rest/auth.ts` | argon2id, JWT issue/verify, refresh rotation. |
| `rest/rateLimit.ts` | `RateLimiter` (§30.6.4). |
| `chat/filter.ts` | `censor`, `containsBlocked` over `chat/blocklist.ts` data (§30.6.5). |
| `liveops/*.ts` | Daily/weekly/battle-pass/swarm/raid scheduling (§30.9). |
| `jobs/marketExpiry.ts` | 60 s `closeExpired` loop (§30.8.2). |
| `metrics.ts`, `log.ts` | pino root logger, per-room counters (§30.10). |

Server code never imports `three`, `react`, `@ewa/render`, `@ewa/client` or `@colyseus/sdk` (eslint `ewa/server-side`). Server code never re-implements a formula that exists in `@ewa/core`; every battle number comes out of `resolveTurn`, every catch out of core, every Elo delta out of `eloDelta`.

---

## §30.1 PROCESS LAYOUT

### 30.1.1 One process, two listeners

```ts
// packages/server/src/main.ts — the shape, verbatim
import { Server, matchMaker, LocalPresence, LocalDriver } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { RedisPresence, RedisDriver } from 'colyseus';
import Fastify from 'fastify';

export interface ServerDeps {
  readonly env: Env;
  readonly repos: ReturnType<typeof createRepos>;
  readonly content: ContentIndex;
  readonly log: Logger;               // pino
  readonly clock: () => number;       // Date.now, injected so tests can freeze it
}

export async function boot(deps: ServerDeps): Promise<{ colyseus: Server; rest: FastifyInstance; stop(): Promise<void> }>;
```

`boot`:

1. `presence = env.REDIS_URL ? new RedisPresence(env.REDIS_URL) : new LocalPresence()`; `driver = env.REDIS_URL ? new RedisDriver(env.REDIS_URL) : new LocalDriver()`.
2. `colyseus = new Server({ presence, driver, transport: new WebSocketTransport({ pingInterval: 5000, pingMaxRetries: 3, beforeUpgrade }), publicAddress: env.PUBLIC_ADDRESS, greet: false, gracefullyShutdown: false })` — `false` because the library's own handler calls `process.exit` from inside its signal handler; `main.ts` handles SIGINT/SIGTERM itself and calls `stop()` (step 7) <!-- amended 2026-09-25: server IMPLEMENTATION-NOTES R10 -->. The REST app is built (`ready()`, not listening) before this step so rooms verify access tokens with the REST instance's `@fastify/jwt` verifier (R9); listening order stays WS then REST. `beforeUpgrade` returns `new Response(null, { status: 429 })` when the connecting IP has more than 8 open sockets (counted in `PresenceStore`, §30.7.4), and `403` when the IP is on the in-memory ban cache (§30.6.7).
3. `matchMaker.defineRoomType('zone', ZoneRoom).filterBy(['zoneId', 'shard'])` — `zoneId` and `shard` are `onCreate` options and metadata fields (§30.2.6). No other room type exists: battles, raids and trades are sub-states of `ZoneRoom`.
4. `await colyseus.listen(env.PORT_WS)`.
5. `rest = buildRest(deps)`; `await rest.listen({ port: env.PORT_REST, host: '0.0.0.0' })`.
6. Start `marketExpiry` (60 s), `liveOpsRollover` (checks every 60 s for a UTC day/week boundary), `presenceSweep` (30 s).
7. `stop()` = stop jobs → `rest.close()` → `colyseus.gracefullyShutdown(false)` → DB close.

Dev ports: **2567** WebSocket, **4000** REST. The Vite client proxies `/api` → `:4000` and connects Colyseus to `ws://localhost:2567` directly. Production puts both behind one TLS terminator; the ports are not exposed.

Multi-process: only when `REDIS_URL` is set. Every cross-room call in this file uses `matchMaker.remoteRoomCall` or `presence.publish`, never a direct `getLocalRoomById` without a local fallback check, so a room on another process behaves identically. `getLocalRoomById` is used only as a fast path guarded by `if (local) … else remoteRoomCall`.

### 30.1.2 Environment

```ts
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT_WS: z.coerce.number().int().min(1).max(65535).default(2567),
  PORT_REST: z.coerce.number().int().min(1).max(65535).default(4000),
  PUBLIC_ADDRESS: z.string().min(1).optional(),                 // host[:port] the SDK should reach; required when REDIS_URL is set
  DATABASE_URL: z.string().url().optional(),                    // absent → PGlite at DATA_DIR/pglite (dev/test only; refused in production)
  DATA_DIR: z.string().min(1).default('./.data'),
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32),                               // ≥ 32 bytes; no default, boot fails without it
  JWT_ACCESS_TTL_S: z.coerce.number().int().min(60).max(3600).default(900),      // 15 min
  REFRESH_TTL_D: z.coerce.number().int().min(1).max(90).default(30),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),   // comma-separated exact origins
  TRUST_PROXY: z.union([z.literal('false'), z.literal('loopback'), z.string()]).default('loopback'),
  SERVER_SEED: z.string().min(1).optional(),                    // world rng seed; absent → fnv1a32(`${processId}:${bootMs}`) logged at boot
  WORLD_WEATHER: z.enum(['on', 'off']).default('on'),           // Phase D7: the overworld weather schedule; testEnv sets 'off'
  SEASON_ROLLOVER: z.enum(['on', 'off']).default('on'),         // ranked seasons: the close job (§30.4.10); testEnv sets 'off' (added 2026-10-20)
  ROAMING_ENCOUNTERS: z.enum(['on', 'off']).default('on'),      // the roaming legendary and ghost trainers in tall grass (§30.4.3a); testEnv sets 'off' (added 2026-10-20)
  WILD_ENCOUNTERS: z.enum(['grass', 'overworld']).default('grass'), // amended 2026-10-20: 'grass' = no overworld spawns, tall grass / surfing roll encounters (§30.3); testEnv sets 'overworld'
  TRAINER_SIGHT: z.enum(['on', 'off']).default('on'),           // amended 2026-10-20: an unbeaten trainer who sees the player starts its fight (§30.3); testEnv sets 'off'
  NEMESES: z.enum(['on', 'off', 'always']).default('on'),      // added 2026-10-21: nemeses (§30.4.3a, spine §3.15); 'always' promotes every qualifying escape and ambushes whenever it can (live checks); testEnv sets 'off'
  ECOSYSTEM: z.enum(['on', 'off']).default('on'),             // added 2026-10-21: a living ecosystem (§30.4.3a, spine §3.16); testEnv sets 'off'
  ZONE_CAPACITY: z.coerce.number().int().min(2).max(500).default(200),
  TICK_HZ: z.literal('20').default('20'),                       // not configurable in v1; present so the value is visible
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  ADMIN_BOOTSTRAP_USERNAME: z.string().optional(),              // dev only: sets is_admin on this username at boot
  // Phase C6 mail — all optional
  SMTP_URL: z.string().url().optional(),                        // smtp(s)://user:pass@host:port; wins over the SMTP_HOST group
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  SMTP_SECURE: z.enum(['true', 'false']).default('false'),      // 'true' = implicit TLS (465)
  MAIL_FROM: z.string().min(3).default('Ewamon <no-reply@localhost>'),
  PUBLIC_WEB_URL: z.string().url().default('http://localhost:5173'),   // origin of the links in emails
});
export type Env = z.infer<typeof EnvSchema>;
```

`NODE_ENV=production` additionally requires `DATABASE_URL`, `PUBLIC_ADDRESS` when `REDIS_URL` is set, and refuses `ADMIN_BOOTSTRAP_USERNAME`.

Mail is optional by design (Phase C6): production without SMTP, with the `@localhost` `MAIL_FROM` or with a localhost `PUBLIC_WEB_URL` boots with a **warning** (`envWarnings`), never a refusal. The `Mailer` (`ServerDeps.mailer`, `src/mail/mailer.ts`) is nodemailer SMTP when `SMTP_URL`/`SMTP_HOST` is set; otherwise the dev transport writes each message as an `.eml` file under `DATA_DIR/mail` (nodemailer composes the MIME), and `NODE_ENV=test` defaults to an in-memory mailer. Delivery is fire-and-forget after the response: a request never waits on SMTP, and a failure is logged without the address.

---

## §30.2 ZoneRoom

### 30.2.1 Definition

```ts
export interface ZoneMeta { readonly zoneId: ZoneId; readonly shard: number }         // shard 0..
export interface ZoneJoinOptions { readonly zoneId: ZoneId; readonly shard?: number; readonly ticket?: string; readonly handover?: { readonly fromRoomId: string; readonly x: number; readonly z: number } }   // ticket: §30.2.6, never sent to a client
export interface ZoneAuth { readonly playerId: string; readonly username: string; readonly isAdmin: boolean; readonly ip: string | null }   // ip: the per-IP socket count
export interface ZoneUserData {
  readonly playerId: string;
  cell: readonly [number, number] | null;   // last AOI cell; null before first tick
  lastSeq: number;                          // last accepted input seq
  budgetMs: number;                         // §30.2.4 dt budget
  lastInputAt: number;                      // clock ms
  battleId: string | null;
  tradeId: string | null;
  limiter: RateLimiterState;                // per-message sliding windows (§30.6.4)
  // the implementation adds caches and handover bookkeeping here (flags, badges, inventory, handover, arrival, replaced, handoverDone, …; server IMPLEMENTATION-NOTES R4)
}
export type ZoneClient = Client<{ userData: ZoneUserData; auth: ZoneAuth }>;   // @colyseus/core 0.18: auth/userData are typed on Client, not on Room

export class ZoneRoom extends Room<{ state: ZoneState; metadata: ZoneMeta; client: ZoneClient }> {   // amended 2026-09-25: 0.18 RoomOptions = { state, metadata, client }
  static readonly TICK_MS = 50;             // 20 Hz
  static readonly PATCH_MS = 50;            // one schema patch per tick
  static readonly DAY_LENGTH_MS = 48 * 60_000;
  zone!: ZoneDef;
  heightfield!: Heightfield;
  aoi!: AoiGrid;
  spawns!: SpawnDirector;
  battles!: BattleCoordinator;
  raid: RaidSession | null = null;
  trades!: Map<string, TradeSession>;
  challenges!: ChallengeStore;
  worldRng!: Rng;                           // createRng(`${SERVER_SEED}:${zoneId}:${shard}:${bootMs}`).fork() per subsystem
}
```

### 30.2.2 Lifecycle (verbatim order)

**`onCreate(options: ZoneJoinOptions)`**
1. `this.zone = ZONES_BY_ID[options.zoneId]` — throws (room creation fails) on an unknown id; content ids are validated at build, so this can only be a forged join option.
2. `this.heightfield = getHeightfield(options.zoneId)` — content's memoised `buildHeightfield` (`00-spine.md` §3.11); the first call per process costs ≤ 40 ms per zone, then 0.
3. `this.maxClients = env.ZONE_CAPACITY`; `this.patchRate = ZoneRoom.PATCH_MS`; `this.autoDispose = true`; `await this.setMetadata({ zoneId: options.zoneId, shard: options.shard ?? 0 })`.
4. `this.state = new ZoneState()`; `state.harvestState = zone.harvestState` (the content default only — harvest is per player, spine §3.5/§4.1; the room never changes it); `state.timeOfDay = ((clock() % DAY_LENGTH_MS) / DAY_LENGTH_MS)` (wall-clock-anchored so every shard of every zone agrees on the hour).
5. Seed: `const root = createRng(`${env.SERVER_SEED}:${zoneId}:${shard}:${clock()}`)`; `this.worldRng = root`; `this.spawns = new SpawnDirector(zone, table, root.fork())`; `this.battles = new BattleCoordinator(root.fork(), …)`.
6. Register every message in `CLIENT_MESSAGES` with `this.onMessage(name, handler)` — **no** validator argument: `@colyseus/core` 0.18.14 closes the client with 4002 when a Standard Schema validator rejects a payload (see the header). The handler wrapper rate-limits (§30.6.4), then `CLIENT_MESSAGES[name].safeParse(payload)`; a failure is answered with `error { code: 'invalidPayload' }` and no handler logic runs. One `'*'` handler exists and only counts unknown types (`metrics.unknownMessages`), sends nothing, and closes the client with 4003 at the 5th within 10 s (spine §4.3) — without it Colyseus disconnects on the first unknown type. <!-- amended 2026-09-25: server IMPLEMENTATION-NOTES R1, R3 --> `onCreate` and `onAuth` refuse options without the per-process join ticket (§30.2.6).
7. `this.setTimestep((dt) => this.tick(dt), ZoneRoom.TICK_MS)`.

**`onAuth(client, options, context)`** — `context.token` is the access JWT (the SDK sends it as the auth token). Verify with the same `JWT_SECRET`/algorithm as REST (`HS256`, `aud: 'ewa'`, `iss: 'ewa-server'`). Reject (`ServerError(401)`) on invalid/expired token, on `banned_at !== null`, and when `options.zoneId` is gated (`zone.gate !== null`) and the player lacks that badge in `badges` — the badge check runs here so a player cannot enter a gated room by joining it directly. Return `{ playerId, username, isAdmin }`.

**`onJoin(client, options, auth)`**
1. Load `players` row (`repos.players.byId`) + party (`repos.creatures.party`). A player with zero party members is refused (`ServerError(409, 'noParty')`) — cannot happen after registration, guards a corrupt row.
2. Multi-tab collapse: if `state.players.has(auth.playerId)` — another socket of the same player is already in this room — the **older** client is sent `error { code: 'busy', detail: 'replaced' }` and `client.leave(4101)` (`CLOSE_CODES.replaced`; 4001 is Colyseus' own `SERVER_SHUTDOWN`, so a restart would read as "another tab took over" — amended 2026-09-25, server IMPLEMENTATION-NOTES P4); the new one takes over the existing `PlayerState` (position kept). Across rooms: `PresenceStore.enter(playerId, roomId)`; if the player is present in a different room, that room is told via `presence.publish('ewa:kick', { playerId, exceptRoomId })` and drops the older session. One avatar per player, everywhere, always.
3. Position: `options.handover` present and `fromRoomId` matches a pending handover for this player (§30.2.7) → `(x, z)` from the handover, else from the row when `row.zoneId === this.zone.id`, else the zone's arrival point `arrivalPoint(zone.id)` (spine §3.1 "Spawn and arrival point": a town's plaza, facing its centre; `mirevale`'s spawn `{ x: 0, z: 6 }`, the `players.z` default; every other zone's spawn) <!-- amended 2026-10-06: town arrival point -->. The avatar faces `arrivalPoint.angle` when it lands there (a fallback join, or a handover whose `(x, z)` is the arrival point — fast travel, spine §4.6); otherwise `row.angle` when the row is for this zone, else 0. An edge handover's entry point (§30.2.7) is unchanged. The position is then **snapped**: `isWalkable(heightfield, x, z) ? (x, z) : nearestWalkable(heightfield, x, z, 8)` (spiral search, 0.5 m step). <!-- reconciled 2026-09-18: ZoneDef.spawn exists (OQ 4) -->
4. Takeover (step 2 found a `PlayerState`): reuse it — position kept — and reset `ps.seq = 0`, because the new socket is always a new client (a reload or another tab; a Colyseus reconnection never reaches `onJoin`) whose input seqs start at 1; keeping the old seq as the stale-seq baseline froze a reload inside the 20 s reconnection window until the new count caught up. Otherwise `const ps = new PlayerState(); ps.id = playerId; ps.name = username; ps.x = x; ps.z = z; ps.body = row.body; ps.guildTag = guildTag ?? ''; state.players.set(playerId, ps)`.
5. `client.view = new StateView(); client.view.add(ps)` (after step 4's `state.players.set` — `StateView.add` throws on a detached instance); `client.userData = { playerId, cell: null, lastSeq: 0, budgetMs: 0, lastInputAt: clock(), battleId: null, tradeId: null, limiter: createLimiterState(), … }`. The viewer is registered and the avatar placed in the AOI grid immediately, so a `chat`/`interact` arriving before the first tick finds its cell and audience (amended 2026-09-25, server IMPLEMENTATION-NOTES R11).
6. Send `toast { level: 'info', text: zone.name }` is **not** done here — the client reads `state.harvestState` and the zone name from content. Nothing is sent on join except the schema.
7. `repos.players.setPosition(tx, playerId, zone.id, x, z, angle)` only when the position came from step 3's fallback branches (row was for another zone, or snapped). Handover writes are the destination's job (§30.2.7).

**`onDrop(client, code)` and `onLeave(client, code)`** <!-- amended 2026-09-25: 0.18 routes a non-consented close to onDrop and calls onLeave only when the reconnection fails (header); server IMPLEMENTATION-NOTES S1, S2 -->
1. `onDrop` (non-consented close): `this.allowReconnection(client, 20)` unless the client was replaced, kicked or has completed a handover; on success the same `PlayerState` continues (no position change); on failure Colyseus calls `onLeave`.
2. `onLeave` (consented 4000 — the SDK's `leave(true)` always closes with 4000, including after a handover — or a failed reconnection): remove, but only when this session still owns the avatar (a per-player owner map), so a late leave of a replaced socket cannot remove the avatar a newer tab took over; skip the position write when a handover moved the player (presence now in another room, or `handoverDone`).
3. Remove = `battles.forfeitIfActive(playerId, 'disconnect')` (§30.4.4 — a PvP battle is a forfeit; wild/trainer/league end with no rewards; a raid seat is vacated), `trades.cancelFor(playerId)`, `challenges.dropFor(playerId)`, `aoi.removeEntity(ps)` (which calls `view.remove` on every viewer), `state.players.delete(playerId)`, `client.view.dispose()`, `PresenceStore.leave(playerId, roomId)`, one `setPosition` write with the last authoritative pose.

**`onDispose()`** — `spawns.dispose()`, cancel clock timers, flush metrics. Rooms auto-dispose when empty (`autoDispose = true`) after Colyseus' default grace; a zone with zero players costs zero ticks.

### 30.2.3 Heightfield contract — it lives in `@ewa/content` (`00-spine.md` §3.11)

<!-- reconciled 2026-09-18: the verbatim block this section used to hold moved to the spine (a higher section may not define a content export); `water` was added there (roster-coverage A2). The decision stands: pure content function, one Float32Array for server and client -->
The render package cannot import content (eslint `ewa/render`: three only) and the server cannot import render. Both can import `@ewa/content`, so the walkable-surface function is the pure content export `buildHeightfield(zone)` / `getHeightfield(zoneId)` of spine §3.11, built from `ZoneDef.layoutSeed`; the client hands the object to render as a descriptor (data, not code), and the server samples the same arrays with `sampleHeight`, `isWalkable`, `isWater`, `nearestWalkable`, `playableBounds`. `validate.ts` writes every zone's `digest` into `dist/content-report.json` and the full fields into `dist/heightfields/<zoneId>.json`; `50-verification-budget.md` §50.4.2 rebuilds all 21 in Node and in a browser worker and asserts equal digests. The server and the client therefore agree on walkability to the sample. **Zone bounds for movement are `playableBounds(h)`** — the field shrunk by the 16 m scenery margin: town ±64, route ±104, story ±84 (spine §3.1 extents).

### 30.2.4 Movement validation (pure)

```ts
// packages/server/src/rooms/movement.ts — verbatim
import { MOVEMENT } from '@ewa/protocol';   // 20-client.md §20.4.5: the ONE constants table for prediction and validation (reconciled 2026-09-18)
export const WALK_SPEED = MOVEMENT.walkSpeed;   // 4.2 m/s
export const RUN_SPEED = MOVEMENT.runSpeed;     // 7.0 m/s
export const SPEED_TOLERANCE = 1.15; // +15 %
export const MAX_WALK_STEP = WALK_SPEED * SPEED_TOLERANCE;   // 4.83 m/s
export const MAX_RUN_STEP = RUN_SPEED * SPEED_TOLERANCE;     // 8.05 m/s
export const BIKE_SPEED = MOVEMENT.bikeSpeed;                 // 10.5 m/s — Phase D11
export const MAX_BIKE_STEP = BIKE_SPEED * SPEED_TOLERANCE;    // 12.075 m/s
export const BUDGET_MIN_MS = -100;   // an input may not spend more than 100 ms of time the server has not seen
export const BUDGET_MAX_MS = 250;    // idle time does not bank more than 250 ms

export type InputVerdict =
  | { readonly ok: true; readonly x: number; readonly z: number; readonly angle: number; readonly running: boolean; readonly budgetMs: number; readonly bike: boolean }   // bike: Phase D11, the bike cap applied
  | { readonly ok: false; readonly reason: 'staleSeq' | 'dtBudget' | 'speed' | 'unwalkable' | 'bounds' | 'inBattle'; readonly budgetMs: number };

export function validateInput(
  prev: { readonly x: number; readonly z: number; readonly lastSeq: number; readonly budgetMs: number; readonly inBattle: boolean; readonly canSurf?: boolean;   // canSurf = inventory['HM Surf'] > 0 (§30.3)
    readonly closedGates?: readonly RectSolid[];         // Phase A
    readonly clearedObstacles?: ReadonlySet<string>;     // Phase D10: this zone's obstacle ids the player cleared
    readonly canBike?: boolean },                        // Phase D11: inventory.bike > 0 && the start is outdoors (interiorAt === null)
  input: z.infer<typeof InputMsg>,            // { seq, x, z, angle, running, dtMs }
  h: Heightfield,
): InputVerdict;
```

Rules, in this order (first failure wins):

1. `seq <= prev.lastSeq` → `staleSeq` (replay or reorder; dropped silently — no snap, no error, the ack will carry the real `seq`).
2. `prev.inBattle` → `inBattle` (position is frozen during a battle; see §30.4.1).
3. `budget = prev.budgetMs - dtMs`; if `budget < BUDGET_MIN_MS` → `dtBudget`. The tick adds `TICK_MS` to every client's budget and clamps at `BUDGET_MAX_MS`, so the sum of accepted `dtMs` can never exceed real elapsed time by more than 100 ms. This is what closes the "send dt = 100 at 30 Hz" speed hack.
4. `dist = hypot(x - prev.x, z - prev.z)`; `cap = (bike ? MAX_BIKE_STEP : running ? MAX_RUN_STEP : MAX_WALK_STEP) * dtMs / 1000` where `bike = input.bike === true && prev.canBike` (Phase D11: an unearned flag is checked against run / walk); `dist > cap + 0.02` → `speed` (0.02 m absorbs float32 quantisation on the wire).
5. Outside the bounds of §30.2.3 → `bounds`. (Checked before walkability: the 16 m margin is `walkable = 0`, so with the opposite order `bounds` could never be observed and `movement.test.ts`'s `bounds` case could not pass; the accept set is identical — amended 2026-09-25, server IMPLEMENTATION-NOTES S3.)
6. Not standable → `unwalkable`, where standable = `!inClosedGate && (isWalkable(h, x, z) || clearedObstacles.has(obstacleAt(h, x, z)) || (canSurf && isWater(h, x, z) && !isLava))` with `canSurf = prev.canSurf && !bike` (Phase D10: a cleared obstacle's stamped samples, content `obstacleAt`; Phase D11: a ridden segment never touches open water) <!-- amended 2026-10-06: Phase D8–D11 world systems -->. Additionally the segment `prev → new` is sampled every 0.25 m; any sample that is not standable → `unwalkable` (no tunnelling through a 0.5 m wall in one 8 cm step is possible at these caps, but the check costs nothing).
7. Otherwise `ok`; `angle` is wrapped into `[-π, π)`; `budgetMs = budget`. Rejections other than `staleSeq` also advance `userData.lastSeq` (a rejected seq cannot be replayed).

Application (`ZoneRoom.onInput`): on `ok`, write `ps.x/z/angle/running`, `ps.moving = dist > 0.001`, `ps.seq = input.seq`, `userData.lastSeq = seq`; Phase D8 / D11: `ps.surfing = water && !walkable` at the new pose and `ps.biking = verdict.bike`, each written only on change. `userData.clearedObstacles` is derived from the flags at join and recomputed by `applyFlags` when an `obstacle:` flag arrives. On any failure other than `staleSeq`, the server does **not** move the avatar and sets `ps.seq = input.seq` anyway — the client's reconciler (`20-client.md`) sees a `seq` acknowledged against an unchanged authoritative `x/z` and snaps to it. That single mechanism is the "ack with authoritative pose"; there is no separate correction message. `speed`, `unwalkable` and `bounds` rejections increment `metrics.rejectedInputs[reason]`; 30 rejections within 10 s from one client → `client.leave(4003)` and an `audit_log` row `movement.kick`.

`Room.input`/`defineInput` (Colyseus' built-in input buffer) is **not** used in v1: the message path above is validated by zod and by `validateInput`, and prediction runs against the `seq` echo. `setFixedTimestep` is likewise not used — 20 Hz `setTimestep` with the budget rule above is sufficient for a turn-based game whose only real-time element is walking.

### 30.2.5 AOI — `StateView` per client (the spine's §4.2 rule, implemented)

Cell size **32 units**, neighbourhood **3×3** (the spine fixes these; the earlier 24 m / 5×5 proposal is superseded).

```ts
// packages/server/src/rooms/aoi.ts — verbatim. No Colyseus import: `Viewer` is structural.
export const AOI_CELL = 32;
export interface Viewer { add(e: object): void; remove(e: object): void }
export interface AoiEntity { readonly id: string; x: number; z: number }
export type Cell = readonly [number, number];
export function cellOf(x: number, z: number): Cell;             // [Math.floor(x / AOI_CELL), Math.floor(z / AOI_CELL)]
export function neighbours(c: Cell): readonly Cell[];           // the 9 cells, sorted row-major

export class AoiGrid<E extends AoiEntity> {
  /** Entity moved or was created: updates its cell; returns the viewers whose 3x3 it entered/left. */
  place(e: E): { readonly entered: readonly string[]; readonly left: readonly string[] };   // viewer ids
  removeEntity(e: E): readonly string[];                        // viewers that could see it
  /** Viewer moved: returns entities newly inside / no longer inside its 3x3. */
  moveViewer(viewerId: string, from: Cell | null, to: Cell): { readonly show: readonly E[]; readonly hide: readonly E[] };
  removeViewer(viewerId: string): void;
  entitiesNear(c: Cell): readonly E[];                          // 3x3 union, for interact/engage range checks
  readonly stats: { cells: number; entities: number; viewers: number };
}
```

Tick order for AOI (after movement, before spawns):

1. For each client with an accepted move this tick: `to = cellOf(ps.x, ps.z)`; if `to` differs from `userData.cell`: `{ show, hide } = aoi.moveViewer(playerId, from, to)`; `for e of show: client.view.add(e)`; `for e of hide: client.view.remove(e)`; `userData.cell = to`. Own `PlayerState` is never removed (it was added in `onJoin` and `moveViewer` excludes the viewer's own entity).
2. For each entity (player or spawn) whose cell changed: `{ entered, left } = aoi.place(e)`; the corresponding clients' views get `add`/`remove`.
3. New spawn: `state.spawns.set(id, spawn)` **first** (`@colyseus/schema` 5.0.32 `StateView.add` throws on an instance not attached to the state; the `@view()` tag keeps it invisible to everyone until added), then `aoi.place(spawn)` and `view.add` on every viewer returned. Despawn: `view.remove` on every viewer from `aoi.removeEntity(spawn)`, then `state.spawns.delete(id)`. <!-- amended 2026-09-25: the draft ordered set after add, which throws — server IMPLEMENTATION-NOTES R8 -->

Only `players` and `spawns` are `@view()`-tagged; `battles`, `raid`, `tick`, `timeOfDay`, `weather`, `harvestState` broadcast to all. A client therefore receives per tick: its own row, ≤ N₉ player rows and ≤ S₉ spawn rows where N₉/S₉ are the 3×3 populations, plus the small broadcast set. The netcode harness (§30.10.3) asserts this shape.

### 30.2.6 Capacity and sharding

`maxClients = ZONE_CAPACITY` (200). Join flow, in the REST layer's `POST /zone/enter { zoneId }` (spine §4.7; the client calls it before every first Colyseus join and after a reload, using `GET /me`.presence.zoneId; it answers 403 `gated` when the zone's `gate` badge is missing, 409 `wrongZone` unless `zoneId` is the player's persisted `zone_id` or live presence zone, and — during a battle — a seat in the battle's own room for that zone, 409 `inBattle` for any other): <!-- reconciled 2026-09-18: OQ 3 — both the route and the `presence` field exist --> <!-- amended 2026-09-25: wrongZone, battle-room seat and join tickets — server IMPLEMENTATION-NOTES R2, P3 -->

**Join tickets.** Colyseus mounts `POST /matchmake/{joinOrCreate,create,join,joinById,reconnect}/:roomName` on every server, guarded only by the room's static `onAuth` (default `true`; header). Every seat the server reserves therefore carries `ticket` — a per-process random secret — in its join options; `ZoneRoom.onCreate` and `onAuth` refuse options without it (`ServerError(403, 'noTicket')`). Seat options never reach the client (`ISeatReservation` carries none), so `/zone/enter` and the handover are the only ways into a zone room. Without the ticket and `wrongZone`, a client could create shards at will or join any ungated zone and be placed at its spawn (onJoin step 3) — fast travel around the gate graph.

1. `rooms = await matchMaker.query({ name: 'zone', metadata: { zoneId } })` (typed `query<ZoneRoom>`), filtered `clients < maxClients && !locked`, sorted by `metadata.shard` ascending.
2. Pick the first; if none, `await matchMaker.createRoom('zone', { zoneId, shard: (max existing shard) + 1, ticket })`.
3. `return { seat: await matchMaker.reserveSeatFor(room, { zoneId, shard, ticket }, /* authData */ null) }` → the `ISeatReservation` handed to the client as the spine's `SeatReservation` (`{ name, sessionId, roomId, publicAddress?, processId? }`), which it passes to `consumeSeatReservation` unchanged. With `authData` null the instance `onAuth` runs again when the seat is consumed, with `context.token` = the SDK's `_authToken` query parameter.

A shard is a full, independent instance of the zone (own spawns, own raid). Players on different shards of the same zone do not see each other; friends see `presence.roomId`. Shard 0 is preferred for every join, so shards ≥ 1 drain and auto-dispose as population falls. Guild/party co-location is a follow-up (cut deliberately, see end).

### 30.2.7 Handover — zero visible hitch

Links are `zone.links[dir]`. The link edge is the **playable** boundary on that side (`playableBounds(h)`, spine §3.11) — the field boundary sits inside the 16 m unwalkable margin and is unreachable; the trigger line is **6 m** inside the playable edge, and a fresh arrival has a 3 s trigger cooldown. Link directions: `n = −z`, `s = +z`, `e = +x`, `w = −x`. <!-- amended 2026-09-25: server IMPLEMENTATION-NOTES R6, R7 -->

Source room, in `tick`, for each player not in a battle/trade whose accepted position crosses a trigger line for direction `d` and who has no pending handover:

1. `dest = zone.links[d]`; if `DEST.gate` is a badge the player lacks (checked against a badge set cached in `userData` at join and refreshed by `progressionDelta`): send `toast { level: 'warn', text: 'The way is barred. Badge required: <name>' }`, and push the player back 1.0 m along `−d` (authoritative pose changes; the `seq` echo snaps the client). No handover.
2. Otherwise reserve: `room = await pickZoneRoom(dest)` (§30.2.6 steps 1–2, on the destination's shard 0 by preference); `seat = await matchMaker.reserveSeatFor(room, { zoneId: dest, handover: { fromRoomId: this.roomId, x: x', z: z' } }, null)`, where `(x', z')` is the entry point on the destination's opposite edge: same lateral coordinate, 6.5 m inside the destination's playable edge, snapped to `nearestWalkable`.
3. `presence.setex(`ewa:handover:${playerId}`, JSON.stringify({ fromRoomId: this.roomId, toRoomId: seat.roomId, sessionId: seat.sessionId, x: x', z: z', at: clock() }), 10)`.
4. `client.send('handover', { roomId: seat.roomId, seat, zoneId: dest, x: x', z: z' })`. `seat` is the whole `ISeatReservation` object — the spine's `SeatReservation` type (§4.4) — because `consumeSeatReservation` needs `name`, `sessionId`, `roomId`, and on multi-process `publicAddress`/`processId`. <!-- reconciled 2026-09-18: OQ 1 — the spine field was widened from string to SeatReservation; no JSON encoding -->
5. Mark `userData.handover = { toRoomId, sentAt }`; the avatar keeps ticking in the source (inputs still accepted for ≤ 5 s so the walk animation continues across the line).

Client (`20-client.md` §20.3.4): `destRoom = await sdk.consumeSeatReservation(seat)`; wait for the first `onStateChange`; send `handoverAck { roomId, seat: seat.sessionId }` to the **destination**; keep the source room open until the destination's state has arrived. The source closes the client with 4002 (`CLOSE_CODES.handoverComplete`) once the destination confirms; a client-side `sourceRoom.leave(true)` closes with 4000 (the SDK sends `LEAVE_ROOM`, the server closes consented), so the server never trusts the code alone (`userData.handoverDone`, presence).

Destination room, `onJoin` with `options.handover`: validates `presence.get('ewa:handover:<playerId>')` — must exist, `toRoomId === this.roomId`, `fromRoomId === options.handover.fromRoomId`, `sessionId === client.sessionId`. Any mismatch → `ServerError(403, 'badHandover')` (a forged handover option cannot teleport). On `handoverAck` from that client: `repos.players.setPosition(tx, playerId, dest, x', z', angle)` — **the one authoritative position write of a crossing**, then `presence.publish(`ewa:handover:done:${fromRoomId}`, { playerId })`, then `presence.del` the key.

Source room, on `ewa:handover:done` for a player it still holds, or 5 s after sending `handover` if nothing arrived: `onLeave`-style removal without a position write (removal code 4002 path). If the destination never confirms and the client is still connected to the source after 5 s, the source clears `userData.handover`, pushes the player 1.0 m back inside and lets them try again; the reservation expires by itself (Colyseus default seat reservation 15 s).

Invariant: at every instant the player exists in at least one room's `state.players` until the source removes them, and never in two rooms for more than 5 s. The position row is written exactly once per crossing, by the destination. Legacy fade-to-black (`sanitizeMapPosition` + full reload) does not exist here.

### 30.2.8 `tick(dtMs)` — verbatim order

```
1. state.tick += 1; state.timeOfDay = (clock() % DAY_LENGTH_MS) / DAY_LENGTH_MS
1a'. honor shapes the world (added 2026-10-20): once a minute, state.shadow = shadowLevel(world_honor of (season, zone)) (written only when it differs)
1b. Phase D7 weather: when weatherBucket(now) changed, state.weather = weatherAt(SERVER_SEED, zone, now) (written only when it differs;
   env WORLD_WEATHER 'off' keeps 'none' — testEnv defaults to 'off' so room tests stay clock-independent)
2. for each client: userData.budgetMs = min(BUDGET_MAX_MS, budgetMs + TICK_MS)
   (inputs are applied when they arrive, in onMessage('input'); the tick only refills budget)
3. emote timers: any PlayerState with emote !== 0 whose emoteSetAt + 2000 <= now → emote = 0
4. AOI pass (§30.2.5 steps 1–2)
5. spawns.tick(now, state.timeOfDay, playerPositions) → { spawned, despawned, freed } → AOI step 3, state.spawns writes
6. handover triggers (§30.2.7)
7. battles.tick(now) — deadlines, auto-actions, resolution, persistence (§30.4.3); raid.tick(now)
8. trades.tick(now) — 120 s inactivity cancel
9. challenges.sweep(now) — 45 s TTL
10. metrics.tickMs = measured; if tickMs > 40 for 3 consecutive ticks → log warn 'tick overrun'
```

Step 7 may `await` (one DB transaction per resolved turn). The tick callback is `async`; Colyseus' `setTimestep` does not await it, so `battles.tick` must never resolve the same battle twice — `BattleSession.resolving: boolean` guards it, and a turn whose transaction is in flight when the next tick arrives is simply skipped that tick.

---

## §30.3 SPAWN DIRECTOR (server-owned wild spawns)

```ts
// packages/server/src/rooms/spawnDirector.ts — verbatim; pure, no Colyseus, no Date
export interface SpawnRecord {
  readonly id: string;              // `${zoneId}:${counter}` — counter is per-director, monotonic
  readonly speciesId: string; readonly level: number; readonly variantKey: VariantKey; readonly isAlpha: boolean;
  readonly isShiny?: boolean;       // Phase D4: shinyFromDraw(alpha draw) — the low 9 bits of the alpha draw's u32 are 0 (1/512); no extra draw
  readonly ability: string;         // species.abilities[rng.int(abilities.length)] — one draw at spawn (spine §3.2, roster-coverage A3)
  readonly medium: 'land' | 'water';// EncounterSlot.medium ?? 'land'
  readonly x: number; readonly z: number;
  readonly bornAt: number;          // ms
  engagedBy: string | null;         // player uuid
  engagedAt: number | null;
  despawnAt: number;                // ms; extended by engagement
}
import { ROUTE_TUNING, TOWN_SPAWN_TUNING, STORY_TUNING, type SpawnTuning } from '@ewa/content';   // spine §3.2 — reconciled 2026-09-18: tunings are content data, one copy
/** Tuning by zone: route → ROUTE_TUNING; the 3 towns with a table (saltmourn · skyrend · solenne) → TOWN_SPAWN_TUNING; story → STORY_TUNING; a zone with encounterTable null runs no director. */
export function tuningFor(zone: ZoneDef): SpawnTuning | null;

export interface LiveOpsMods { readonly alphaBonus: number; readonly variantBonus: number; readonly swarmSpecies: readonly string[]; readonly swarmWeightBoost: number; readonly variantPool: readonly VariantKey[]; readonly featuredSpecies?: readonly string[] }   // featuredSpecies: §30.9.2 per-species +0.01 alpha / +0.025 variant, added to the same draws
export interface SpawnTickResult { readonly spawned: readonly SpawnRecord[]; readonly despawned: readonly string[]; readonly freed: readonly string[] }   // freed: engagements stalled past engagedTimeoutMs

export class SpawnDirector {
  constructor(zone: ZoneDef, table: EncounterTable | null, rng: Rng, h: Heightfield, tuning: SpawnTuning, content: ContentIndex);
  setLiveOps(m: LiveOpsMods): void;                                      // re-read from §30.9 at each rollover
  tick(now: number, timeOfDay: number, players: readonly { readonly x: number; readonly z: number }[]): SpawnTickResult;   // players: the ≥ 10 m clearance rule needs their positions (amended 2026-09-25, server IMPLEMENTATION-NOTES W2)
  engage(spawnId: string, playerId: string, now: number): 'ok' | 'notFound' | 'engaged' | 'tooFar';
  release(spawnId: string, outcome: 'caught' | 'ko' | 'fled' | 'timeout' | 'playerLeft', now: number): void;  // despawns for caught/ko/fled/timeout; frees for playerLeft
  get(spawnId: string): SpawnRecord | null;
  readonly all: readonly SpawnRecord[];
}
```

Rules:

- **Day/night.** `timeOfDay` in `[0.25, 0.75)` is day, else night (dawn at 06:00, dusk at 18:00 of the 48-minute day). A roll considers slots whose `timeOfDay` is `'any'` or matches. A spawn born in the day is not despawned at dusk; it lives out `lifetimeMs`.
- **Roll.** Weight-proportional pick over eligible slots (weights multiplied by `swarmWeightBoost` for `swarmSpecies`, and by `WEATHER_TYPE_BOOST` for the player's real weather's types, §30.4.3a); `level = levelMin + rng.int(levelMax - levelMin + 1)`. One `rng.pick`-equivalent draw for the slot, one for the level.
- **Alpha.** `rng.next() < ALPHA_CHANCE + alphaBonus` where `ALPHA_CHANCE = 0.02` (content §3.2) — **not** 1/120: the content constant is the source of truth and 1/120 (0.0083) is the legacy value this replaces. A slot with `tier: 'alpha'` forces `isAlpha = true`. One draw.
- **Shiny (Phase D4).** No draw of its own: `isShiny = (u * 2^32) mod 512 === 0` where `u` is the alpha draw (`next()` is `u32 / 2^32`, exact), so P = 1/512 exactly, independent of the alpha threshold (which reads the high bits) to within 2^-23, and every seeded spawn sequence is byte-identical to pre-D4 (`shiny.test.ts` pins the digest). `SpawnState.isShiny` mirrors it; `startWild` projects it (`CreatureInstance.isShiny`); the catch persists it (`creature_instances.is_shiny`) and `markCaught(…, isShiny)` sets `dex_entries.shiny_caught`. Statics, trainers and raid bosses are never shiny.
- **Variant.** `rng.next() < VARIANT_CHANCE + variantBonus` (0.03 base) → `rng.pick(variantPool)`; `variantPool` is `WEEKDAY_VARIANT[weekday]` when non-null, else the 4 non-normal keys. Two draws when the first succeeds, one otherwise.
- **Position.** Up to 8 attempts: `x = originX + 1 + rng.next() * (size - 2)`, same for `z`, accepted if (`medium === 'water' ? isWater : isWalkable`) and ≥ 6 m from every other spawn and ≥ 10 m from every player. Failure → no spawn this tick. (The 16 m margin is `walkable = 0`, so spawns never land in scenery.)
- **Cadence.** When `all.length < targetCount` and `now >= nextSpawnAt`: spawn one, `nextSpawnAt = now + respawnMinMs + rng.int(respawnMaxMs - respawnMinMs + 1)`. At most one spawn per tick. Until the director first reaches `targetCount` the delay is not waited (one spawn per tick, so a fresh room is populated in < 1 s); the delay draw is consumed either way, so seeded sequences are unchanged (amended 2026-09-25, server IMPLEMENTATION-NOTES W1).
- **Footprints.** Position acceptance uses the heightfield only; it cannot see building/prop footprints (spine §3.11 open gap), so until recommendation R1 lands a spawn can be placed inside a footprint the client's collider blocks.
- **Despawn.** `now >= despawnAt` with `engagedBy === null`; engagement sets `despawnAt = max(despawnAt, now + engagedTimeoutMs)` so a 90 s stall (client vanished mid-fight) releases the creature for everyone. `SpawnState.despawnAtTick` mirrors `despawnAt` as a tick count so clients can fade it.
- **Engage.** `engageSpawn { spawnId }` from a client: requires no active battle, the spawn present in `aoi.entitiesNear(userData.cell)` (an out-of-AOI id → `notFound`), distance ≤ 3.0 m (`tooFar` → `error { code: 'notAllowed', detail: 'tooFar' }`), `engagedBy === null` (`engaged` → `busy`), and for a `medium: 'water'` spawn the player's own position on a `water` sample (`isWater(h, ps.x, ps.z)`; otherwise `notAllowed 'needSurf'` — standing on water requires the HM Surf key item, which the client checks before allowing the step onto a water-only sample and the server checks on `input`: a water-only sample is walkable for a player only when `inventory['HM Surf'] > 0`). Two players who send `engageSpawn` in the same tick for the same spawn: the first message processed wins; the second gets `error { code: 'busy' }`. Success → `SpawnState.engagedBy = playerId` (broadcast through AOI so others see it claimed) and `BattleCoordinator.startWild(...)` (§30.4.4).

The director's rng is `worldRng.fork()`; the sequence of spawns for a given `(SERVER_SEED, zoneId, shard, bootMs)` is reproducible in a test by driving `tick` with synthetic `now` values.

**Fishing** (Phase D9) <!-- amended 2026-10-06: Phase D8–D11 world systems --> — `fish { angle }`: refused while battling / trading / in a raid (`busy`); without `old_rod` (`noRod`); inside a hall or with no open-water (non-lava) sample within `FISH_REACH_M` = 2.5 m of the player's **accepted** position along `angle`, sampled every 0.5 m (`noWater`; a boardwalk sample counts — fishing from a pier); a refusal is an info toast plus `error { code: 'notAllowed', detail }`. Otherwise `rollFishing(table, fishRng, content, timeOfDay, waterPoint, id, now, liveOps)` picks one of the table's `water` slots eligible at this time of day with the spawn draws (slot, level, alpha + shiny from one draw, variant, ability; swarm and event bonuses apply) — none → `nothingBites` — and `startWild` runs it at the player like an engaged spawn (`ud.battleId = 'pending'` first). The bite never enters a director's population (`${zoneId}:fish:<n>`; the battle end's release of an unknown id is a no-op). `fishRng` is `createRng(`${seed}:${zoneId}:${shard}:${bootMs}:fish`)`, its own stream, so no fork of `worldRng` shifts.

**Tall grass and surfing** <!-- amended 2026-10-20: old-game encounters, the user's call -->: with `WILD_ENCOUNTERS = 'grass'` (the default) no creature stands in the overworld: `spawnPass` returns at once (the director is still built, for the live-ops mods `rollWild` reads) and `state.spawns` stays empty. Instead every accepted move (§30.2.4) of a player who is not battling, trading, crossing or in a raid, outside a hall, rolls once on the room's `wildRng` (`createRng(`${seed}:${zoneId}:${shard}:${bootMs}:wild`)`, its own stream) when the new position is inside a tall-grass ellipse of `zonePlan(zoneId).grassPatches` (the patches render grows the grass in; a zone with `encounterTable` null has none: medium `land`, `GRASS_RATE_PER_M` 0.07) or on open water (`PlayerState.surfing`: medium `water`, `SURF_RATE_PER_M` 0.035): the chance for `d` metres is `1 − (1 − rate)^d`, doubled by a lure. `ENCOUNTER_GRACE_M` (3 m) of such ground is walked first after joining and after every battle; `ENCOUNTER_REFUSED_GRACE_M` (12 m) after a refused start. A hit calls `rollWild(table, medium, …)` (the fishing roll with the medium as a parameter: `rollFishing` is `rollWild(…, 'water', …)` draw for draw), sets `ud.battleId = 'pending'` and starts the battle at the player like an engaged spawn (`${zoneId}:wild:<n>`, never in a director's population) unless the party has no usable creature (no battle, silently) or a repel is on and the creature is below the lead's level. Code: `rooms/encounters.ts`, `ZoneRoom.wildStep`.

**Trainer sight** <!-- amended 2026-10-20: old-game trainer battles are not optional, the user's call -->: with `TRAINER_SIGHT = 'on'` (the default), after each accepted move (before the grass roll) the nearest trainer of the zone or its halls within `SIGHT_M` (6 m) that the player has not beaten (`trainer:<id>:beaten` absent; a story trainer only while §30.4.8 rule 6 names it) and whose line to the player is clear (every 0.5 m sample walkable or water, outside every gate still shut for the player; a hall's trainers see only inside their hall) holds the player: `ud.spotted` is set, movement is refused like `inBattle`, and once the party read finds a usable creature the room sends `trainerSpotted { trainerId }` (none → the hold drops and sight is quiet for `SPOT_QUIET_MS`, 10 s). While held, only `interact { kind: 'npc', targetId: <that trainer> }` is accepted (anything else: `busy`, detail `spotted`), from any distance; it runs the trainer's beat battle (rule 6, `storyBeat start` first) or its plain fight. The client sends it after the trainer's lines; after `SPOT_TIMEOUT_MS` (45 s) without it the room starts the fight itself. A failed start drops the hold and quiets sight for `SPOT_QUIET_MS`.

---

## §30.4 BATTLE SUB-STATE

### 30.4.1 Session

```ts
// packages/server/src/rooms/battleSession.ts — verbatim
export interface Seat { readonly side: 0 | 1; readonly playerId: string | null; readonly sessionId: string | null } // null player = wild/NPC/league side
export interface BattleSession {
  readonly id: string;                       // uuid
  readonly format: BattleFormat;
  readonly zoneId: ZoneId;
  readonly seats: readonly [Seat, Seat];
  state: BattleState;                        // core; the ONLY copy of the truth
  readonly seed: RngState;                   // createBattle's seed snapshot, for battle_history.seed
  readonly actionsLog: [SideChoice, SideChoice][];   // one entry per resolved resolveTurn, for battle_history.actions (Phase D6: SideChoice)
  pending: [SideChoice, SideChoice];         // actions received for the CURRENT turn; Phase D6 doubles: one [pos0, pos1] pair per player side (NPC sides null)
  deadlineAt: number;                        // ms; 60 s after the turn opened (20 s for a replacement) — amended 2026-10-12: was 30 s
  resolving: boolean;
  readonly spawnId: string | null;           // wild: the SpawnRecord it consumes
  readonly npc: { readonly trainerId: string; readonly reward: number; readonly leagueId: string | null } | null;
  readonly beatId: string | null;            // §30.4.8: the story beat this battle completes on a side-0 win
  readonly staticSpecies: string | null;     // §30.4.6 `static`: the LegendaryStatic whose flag is set on win or catch
  readonly startedAt: number;
  readonly x: number; readonly z: number;    // where the arena dresses (BattleSummary)
}
export const TURN_DEADLINE_MS = 60_000;   // amended 2026-10-12: was 30_000
export const REPLACEMENT_DEADLINE_MS = 20_000;
```

The client shows the deadline as a turn timer (§20.5.6): `battleStart`, `battleEvents` (unless the battle ended) and `battleResync` carry `deadlineMs = max(0, deadlineAt − now)` as of sending; the client counts it down on its own clock, so no clock sync is needed. <!-- amended 2026-10-12: turn timer -->

While `userData.battleId !== null`: `input` messages are rejected with `inBattle` (avatar frozen at the pre-battle pose; `PlayerState.inBattle = true`), `engageSpawn`/`challenge`/`tradeRequest`/`interact` are answered `error { code: 'busy' }`, handover triggers are skipped. Emote and chat still work.

### 30.4.2 Message → action

`battleAction { battleId, turn, action }` handler:

1. `session = battles.get(battleId)`; `!session || session.seats.every(s => s.playerId !== playerId)` → `error { code: 'notFound' }` (a forged battleId for someone else's battle leaks nothing — the same code as a non-existent id).
2. `turn !== session.state.turn + 1` (the turn being collected) → `error { code: 'notAllowed', detail: 'wrongTurn' }`. Replacement phases keep the same `turn`, so the client sends the same `turn` again with a `switch`.
3. `side = seat.side`; `err = validateAction(session.state, side, action)`; `err !== null` → `error { code: 'notAllowed', detail: err }`.
4. `session.pending[side] !== null` → `error { code: 'notAllowed', detail: 'alreadySubmitted' }` (no changing your mind).
5. `session.pending[side] = action`. If every seat that must act has acted → `resolveNow(session)`.

"Must act": in a replacement phase only the `mustSwitch` side(s); otherwise every seat with a non-null `playerId`. NPC/wild sides never act — core chooses via `chooseNpcAction` when handed `null`.

### 30.4.3 Turn pipeline (one transaction)

`resolveNow(session)`:

1. `session.resolving = true`. `const before = session.state; const result = resolveTurn(before, session.pending, content)` — pure; a thrown error here is a server bug (validateAction ran), logged at `error`, the battle is voided (`battleEnd` with `{ winner: 'draw' }` and no rewards) and `metrics.battleFaults += 1`.
2. `session.actionsLog.push(session.pending)`; `session.state = result.state`; `session.pending = [null, null]`; `deadlineAt = now + (anyMustSwitch ? REPLACEMENT_DEADLINE_MS : TURN_DEADLINE_MS)`.
3. **Persist**, one `db.transaction` — for each seat with a `playerId`, in ascending `playerId` order:
   a. `repos.players.lock(tx, playerId)`.
   b. For each battler on that side whose `creature.id` is a real row: `repos.creatures.update(tx, creature)` **only** for fields battle may change — `hp`, `moves[].pp`, `status`, `exp`, `level`, `heldItem` (consumed berry/policy → `null`) — read back from `result.state`. Creatures are projected from rows at battle start; the row is the truth between turns.
   c. Consumables used this turn (`itemUsed` events with `consumedHeld === false`): `repos.inventory.add(tx, playerId, item, -1)` — the balance was checked at `validateAction` time from a party/inventory snapshot refreshed every turn; a negative result throws and voids the battle (cannot happen without a concurrent REST use; then the battle is voided rather than the item duplicated).
   d. Orbs thrown (`catchThrow`): `inventory.add(tx, playerId, orb, -1)`.
   e. `catchResult { caught: true }`: `repos.creatures.insert(tx, wildCreature with ownerId = playerId, caughtAt: { zoneId, at: now }, 'box' or party slot if party.length < 6)`; `repos.progress.markCaught(...)` → `{ newSpecies }`; `addTrainerExp(catch + newSpecies ? catchNewSpecies : 0)`.
   f. `levelUp`/`expGain` are already in the creature rows (b). `evolveReady` and `learnMove` are events only; nothing persists (§2.16 — REST actions).
   g. On `battleEnd`: rewards (§30.4.4), `repos.history.recordBattle(tx, …)` per player seat, `audit 'battle.end'`; when `session.beatId !== null` and side 0 won, the beat completion of §30.4.8 step 4; when `session.staticSpecies !== null` (a `LegendaryStatic` battle) and the outcome is a win or a catch, `setFlags([static.flag])`.
   h. `repos.progress.markSeen` for every wild/NPC species revealed this turn (first `switchIn` of an opposing slot).
4. Send, **after** commit: to each player seat `battleEvents { battleId, turn: result.state.turn, events: result.events, stateDigest: digestBattleState(result.state), rng: result.state.rng }`. Then, when 3 changed anything, `inventoryDelta` (absolute counts for touched items; `creaturesUpdated` with the rows written; `creaturesAdded` on catch) and `progressionDelta` (dex/trainerExp/badges/rating/flags/quests as touched). Then `battleEnd { outcome, rewards }` when ended.
5. `BattleSummary.turn = state.turn`. On end: `state.battles.delete(id)`, `PlayerState.inBattle = false`, `userData.battleId = null`, `spawns.release(spawnId, outcomeToRelease)`, `session.resolving = false`, drop the session. Wild battle ended by `fled`/`ko`/`caught` → spawn despawns for everyone; the only case that frees a spawn is `playerLeft` before turn 1 resolves.

A transaction failure rolls everything back and the session keeps `before` as its state (step 2's assignment is applied only after commit succeeds — implement as `next = …; await tx; session.state = next`). The client's preview is then wrong; the digest mismatch on the next `battleEvents` forces a `battleResync`.

`battleResync { battleId }`: answers `battleResync { battleId, state: session.state, stateDigest }` only to a seat holder; the full `BattleState` for the opposing side includes its party — for **pvp** the opposing side's unrevealed party members are sent with `hp`, `moves`, `heldItem`, `ability` intact (Pokémon-style team preview is a client choice; hiding them would require a projection the spine does not define). Accepted for v1 — spine §4.5 (reconciled 2026-09-18).

**Deadline.** `battles.tick(now)`: for a session with `now >= deadlineAt && !resolving`: for each seat that must act and has `pending === null` — replacement phase → `switch` to the lowest-index `hp > 0` party member; otherwise `{ kind: 'move', move: firstMoveWithPp }` or, if no PP anywhere, `{ kind: 'move', move: active.moves[0].id }` (core's struggle rule, if any, is core's; the spine defines none, so `validateAction` fails on `noPp` and the fallback is `forfeit` for pvp and `flee` for wild — `flee` fails when trapped, in which case the wild side simply acts). Then `resolveNow`. Two consecutive deadline auto-actions by the same player in a pvp battle = forfeit.

### 30.4.3a Battle weather (Phase D7)

`BattleDeps.weather(format, at, players)` (`players`: the human seats, amended 2026-10-20) names the ambient weather `open()` passes to `createBattle` (and records in `battle_history.start.weather`): `ZoneState.weather` for `wild` (incl. statics), `trainer` and `league` battles whose arena point is outside every interior pocket (`interiorAt(zone, x, z) === null` — halls are indoors, so every league fight and every gym-hall trainer fight starts with none); `none` for `pvp` (rating fairness) and raids. The schedule (`game/weather.ts`): `WEATHER_BUCKET_MS = 6 min`; each bucket's weather is one weighted draw from `createRng(`${SERVER_SEED}:weather:${zoneId}:${bucket}`)` over the biome's `WEATHER_SCHEDULE` weights (every zone, towns included).

**Weather from real life <!-- added 2026-10-20 -->.** A player may pick a city in Settings (`players.weather_city`). The server asks Open-Meteo (no key) for the current weather at its coordinates rounded to 0.1° (about 10 km; nothing about the player is sent) and caches each place for `REAL_WEATHER_TTL_MS` (30 min); a failed lookup keeps the last answer and is not retried for `REAL_WEATHER_RETRY_MS` (5 min); concurrent askers share one request (`game/realWeather.ts`, `RealWeather` on the runtime, `ServerDeps.fetch` injectable; tests pass a fake and the default test server is offline). WMO codes map to `WeatherKind`: drizzle, rain, showers and storms `rain`; snow `hail`; dry wind ≥ `SAND_WIND_KMH` (40 km/h) `sand`; a clear or mainly clear day `sun`; the rest `none`. The zone room keeps `realWeather` per player (looked up on join, re-read from the cache every `REAL_WEATHER_CHECK_MS` (1 min), reset when `POST /weather/city` publishes on `ewa:weather:<playerId>`) and sends `realWeather` on change. A battle with one human seat whose player has real weather starts under it instead of `ZoneState.weather` (the interior and format rules above still apply first); every other battle keeps the zone's. In tall grass, on water and fishing, the player's real weather multiplies the weight of slots whose species has one of its types by `WEATHER_TYPE_BOOST` (2): rain Water; sun Fire, Grass; hail Ice; sand Ground, Rock, Steel. With no city there is no bias and the rolls are the old ones draw for draw.

**Honor shapes the world <!-- added 2026-10-20 -->.** Every resolved turn of a world battle (wild, trainer, league, PvP; not the arena, the tower or a raid) adds its deeds to the zone's season tally in the turn's own transaction (`world_honor`, content `deedsOf`): a player side's creature landing a damaging Dark-type move 2 shadow, a wild creature fainting 1 shadow, a catch 3 light, a player side winning a trainer, league or PvP battle 3 light. The level (`shadowLevel`) is 0 below 40 points in all, else 1..4 from the shadow share at 55 / 65 / 75 / 85 %. The zone room reads its tally once a minute (`SHADOW_CHECK_MS`, tick step 1a') into `ZoneState.shadow`. In a shadowed zone Dark-type slots weigh `1 + 0.5 × level` in grass, surf and fishing rolls (`rollWild`'s last argument; 0 rolls as before). The tally is per season, so the world starts clear each season. Nothing is a story gate.

**One roaming legendary per season <!-- added 2026-10-20 -->.** The season's roamer (content `roamerOf`: Voltaura, Sunjaw, Glacinid in turn, Lv `ROAMER_LEVEL` 50, legendaries the world already holds as statics) is on one route of `ROAM_ZONES` at a time, `roamerZoneAt(season, now)`: a hash of (season, period) over 30-minute periods, never the same route two periods running, the same on every server (no shared state). While it is on a room's route and the room's minute read (with the shadow, `SHADOW_CHECK_MS`) found no first catch this season, each grass or surf encounter there meets it with `ROAMER_CHANCE` 1/16, drawn from the room's own `roam` stream so the wild rolls stay as they were; its spawn id is `<zone>:roamer:<season>:<n>`. When a battle against a roamer encounter ends in a catch, `persistTurn` records the season's first catch (`season_legends`, the insert is the race) in the same transaction, writes the `legendary` history event to the party and, after the commit, tells the catcher. After that the roamer is met nowhere until the next season. Nothing gates the story.

**A living ecosystem <!-- added 2026-10-21 -->.** The rules are content's (spine §3.16); the server's half is `game/ecosystem.ts`. While env `ECOSYSTEM` is 'on' the battle coordinator gets `ecosystem()` from the zone room and, in the turn transaction of a world wild battle (not the tower or the arena) whose spawn id is a plain wild one (`countsForEcosystem`: not the roamer's, not an ambush's; a static has none), adds the turn's take (`takeOf`: a catch, or the wild side's faint) to `eco_takes` for the wild creature's species in the zone's `ecoWeek`. The zone room reads `readEcosystem` (this week's and last week's rows, the season's honor tally into `shadowLevel` / `lightLevel`) with the shadow, once a minute, and rolls grass, surf and fishing on its table (`wildTable()`); the overworld director gets the same table (`SpawnDirector.setTable`, no new draw). A reading whose weights moved is logged ("ecosystem: encounter weights changed"). `GET /world/ecosystem/:zoneId` (`rest/routes/ecosystem.ts`) answers from the same read. Off, nothing is written and every room rolls its authored table. Dev: `pnpm --filter @ewa/server eco take <zone> <species> <n> [--ko] [--last-week]` and `eco roll <zone> [n] [--night] [--water]` (the room's roll on the authored table and on this week's, same draws).

**Nemeses <!-- added 2026-10-21 -->.** The rules are content's (spine §3.15); the server's half is `game/nemesis.ts`. While env `NEMESES` is not 'off' the battle coordinator gets `nemeses()` from the zone room (`{ always, shadow }`: the zone's shadow level now) and, for a world wild battle (not the tower, the arena or a ghost fight), folds every resolved turn into the session's `nemesisTrack` (`trackNemesis`: the last of the player's creatures the wild side knocked out and the move that did it, the last orb it broke out of and who faced it, the hardest blow the player's side landed, by move type), kept only after the turn's transaction commits. In the end transaction of side 0 (`settleNemesis`): a plain wild battle (a spawn id that is not the roamer's or an ambush's, no static, not a legendary species) whose creature knocked one out or broke out and was neither caught nor knocked out rises with `nemesisPromoteChance(shadow)` (1 under `always`) from `createRng(`nemesis:${battleId}:${turn}`)`: `riseNemesis` then `nemeses.rise` (the oldest past `NEMESIS_MAX` fade). An ambush battle (`session.nemesis`) ends it when caught (`end('caught')`; the inserted creature took the nemesis's name as nickname and the ribbon `nemesis-scar:<scar>`, and gets the history line `nemesis { how: 'caught' }`) or knocked out (`end('beaten')`; the player's creature that dealt the last damage before the faint, else the active one, gets `nemesis { how: 'beaten' }`), ranks it up when it knocked one out or broke out again (`rankUpOf`), else marks it seen. Each change is a `nemesisNews` sent after `battleEnd` (a rise that fades one sends `faded` too). Ambushes: a grass / surf roll that is not a ghost or the roamer tries an ambush with `nemesisAmbushChance(shadow)` from the room's own `nemesis` stream (`always`: every time); the player's active nemeses that rose in another zone (on water: a Water, Flying or Ice species) are read, one is picked from the same stream, and `startWild` builds it (`nemesisCreature`: its species at `nemesisFightLevel(level, lead)`, its name, coat, ability and gained move) under the spawn id `<zone>:nemesis:<n>`; `nemesisAmbush` (with `tauntOf`) follows its `battleStart`. With none the grass gives a wild creature as it would have. A repel does not keep a nemesis away. In a challenge run an ambush is that zone's encounter like any wild battle (`loadPlayers` with the zone). `GET /nemeses` (`rest/routes/nemeses.ts`) lists the active ones. Off, nothing is read, drawn or written: the suites and the progression walker run with it off.

**Breeding <!-- added 2026-10-21 -->.** The rules are content's (spine §3.14); the routes are `rest/routes/daycare.ts` (spine §4.7). Leaving and taking back move the creature row between `party` / `box` and the `daycare` slot kind in one transaction under the player-row lock; a pair that can breed sets `daycare.egg_at` to now + `EGG_READY_MS`, anything else clears it. Collecting lays the egg (`game/breeding.ts layEgg`: species, steps, honor, coat, ability slot, egg moves, bandborn, and the shiny from `createRng(`${worldSeed}:egg:${playerId}:${nowMs}`)`) and restarts the timer. Steps: the zone room's `EggWalker` (`rooms/eggWalk.ts`) loads a player's carried eggs on join; each accepted `input` adds its distance (metres = steps) unless a challenge run is active; it writes the walked metres every `EGG_FLUSH_M` (20) and when the player leaves the room (a crossing included), and a write that brings an egg to its total hatches it in its own transaction: `takeHatched`, the hatchling (`hatchling`: level 1, its level moves with the egg moves) into the party while it has room else the box, its history starting `hatched`, the Dex marked caught; then `inventoryDelta` (with `placement`), `progressionDelta` (`dexCaught`) and `eggHatched`. Collecting or moving an egg publishes `ewa:eggs`; the room holding the player flushes and re-reads. No env flag: nothing about the world, encounters or battles changes for a player without eggs (one map lookup per move).

**Ghost trainers <!-- added 2026-10-20 -->.** A real leave of the world (not a crossing, not into an arena) saves the player's party as their ghost in the zone they left (`ghosts`, replacing any earlier one). Each zone room keeps its `GHOSTS_PER_ZONE` (8) most recent ghosts of the last `GHOST_DAYS` (7) days, read with the shadow once a minute (banned trainers' never walk). A tall-grass encounter (land only) meets one of them, never the player's own, with `GHOST_CHANCE` 1/10 from the room's own `ghost` stream; it fights when the owner is offline and the ghost's best level is within `GHOST_LEVEL_SPAN` (12) of the player's lead, otherwise the grass gives a wild creature as it would have. The fight (`BattleCoordinator.startGhost`) is format `trainer` against an AI side `ghost:<username>` of healed copies (own levels, at most six, synthetic ids: nothing of the owner's is read again or written); a win pays `ghostReward(topLevel)` and the trainer exp of a trainer win, without a content flag. Its end records the fight for the owner (`ghost_battles`). When the owner joins a zone, the fights not yet told are told in one toast (`ghostReport`) and marked told. Ghosts and the roaming legendary meet players in the grass only with env `ROAMING_ENCOUNTERS` 'on' (the default; testEnv 'off', so grass tests meet only the zone's table).

### 30.4.3b Achievement events (Phase D5)

`advanceQuests` events added: `catch { isAlpha?, isShiny? }` (battle catch, raid catch), `dex { caught }` after a battle catch, a raid catch and a trade that received creatures (`progress.caughtCount`), `raidClear` with the raid's rewarded clear, `streak { days }` from `dailyLogin` (its `questProgress` rides the join's `progressionDelta`); `trade` already existed. `dexCaught` / `loginStreak` objectives are absolute (max-merged, an unchanged value writes nothing); the rest count +1 per matching event. Market purchases and evolutions do not emit `dex`; the next catch or trade catches the count up.

### 30.4.3c Doubles (Phase D6)

<!-- amended 2026-10-06 Phase D6 -->
- **Start.** `startNpc` opens a doubles battle (`createBattle({ …, slots: 2 })`, `battle_history.start.slots = 2`) when the opponent is authored doubles — `TrainerDef.doubles` / `LeagueTrainer.doubles` with a team of 2+ — **and** the player's party has two usable (`hp > 0`) creatures. With one usable creature the same trainer fights singles (documented fallback, never a refusal: doubles is never a gate). Wild, static, raid and pvp battles are always singles. The two leads are the first two usable party members.
- **`battleAction { battleId, turn, action, pos? }`.** In doubles one message per field position. `pos` absent = the lowest required position still empty (so a client that sends two plain messages works); a position that needs no action (`requiredPositions`, spine §2.10 doubles) → `actionNotRequired`; a filled position → `alreadySubmitted`; `validateAction(state, side, action, content, pos)`; a second switch to the creature the other position already chose → `switchToActive`; two item uses need two of that item (`noItem`). The turn resolves when every required position of every player seat is filled; `resolveTurn(before, pending)` gets the pairs (NPC sides `null`). `pos` is ignored in singles. **Rate limit:** a position-1 `battleAction` from a player in a doubles battle counts in its own window (`LIMITS.battleActionPos1`, 4 / 1 s, the same as `battleAction`), so a client that sends both picks in one burst is never refused; in singles `pos: 1` buys nothing (every `battleAction` shares the one 4 / 1 s window).
- **Deadline / leave.** `tick` auto-fills only the missing positions (`autoPair`: replacement → the lowest unchosen bench creature; otherwise the first move that validates for that position, else forfeit). A pvp leaver (not reachable in v1: pvp is singles) forfeits from its first required position.
- **Persistence** is unchanged: the per-side diff over `party` already covers both positions; `battle_history.actions` stores the pairs, and `createBattle({ id, format, seed, ...start })` + `resolveTurn` over them reproduces `final_digest` (`packages/server/test/doubles.test.ts`, the draco_gym / aurelia rows of `battle-room.test.ts`).
- **Walker.** The progression walker (`packages/server/test/walker.ts`) drives doubles with `chooseNpcDoubles` (replacement: the best matchup per required position) and sends one `battleAction { pos }` per position; its preview passes the pair.

### 30.4.4 Formats

| Format | Start | Side 1 | Rewards on side-0 win (`RewardsSummary`) | Elo |
|---|---|---|---|---|
| `wild` | `engageSpawn` accepted | `kind: 'wild'`, one battler projected from the `SpawnRecord` (species default moves at that level via `learnableMoves`, `ability = record.ability` — rolled at spawn, spine §3.2 / roster-coverage A3, reconciled 2026-09-18 — `heldItem null`, `hp = maxHp`), `canFlee` on side 0, `canCatch` on side 0 | money 0; `trainerExp: TRAINER_EXP.wildWin` (+ `catch`/`catchNewSpecies` on catch; the catch ends the battle as `caught`, which is also a win for exp purposes) | — |
| `trainer` | `interact { kind: 'npc', targetId }` on a `TrainerDef` within 3 m; refused if `story_flags` has `trainer:<id>:beaten` and (`rematchDays === null` or fewer than `rematchDays` days since the flag was set) | `kind: 'npc'`, `trainerId = TrainerDef.id`, team from content (same projection rule) | `money: TrainerDef.reward` (rematch: `floor(reward / 2)`); `trainerExp: trainerWin`; sets flag `trainer:<id>:beaten`; quest `defeatTrainer`/`winBattles` advance | — |
| `league` | `interact { kind: 'gym', targetId: LeagueTrainer.id }` within 4 m of the gym marker; gyms require the previous badge in order (order 1 needs none); elite require all 8 badges and the previous elite (order); champion requires the 3 elite flags. Refused with `toast` when already beaten — until `champion:zeon:beaten` is held: then an already-beaten trainer (gym: badge held; Warden / Champion: its `setsFlags`) takes a **rematch** (Phase D14) unless `league:<id>:rematchAt` was set less than `LEAGUE_REMATCH_COOLDOWN_DAYS` (1) ago (toast "… wants a rest. Come back tomorrow for a rematch.", `error leagueLocked`) | `kind: 'npc'`, `trainerId = LeagueTrainer.id`, team verbatim from content including `nickname/ability/heldItem` | `money: reward`; `badge: LeagueTrainer.badge` via `awardBadge` (audit `badge.award`); `trainerExp: gymWin/eliteWin/championWin` by stage; `setFlags(setsFlags)`; `championWin` additionally sets `champion:zeon:beaten` — the id is `'zeon'`, and the check anywhere in server code is `=== 'zeon'`. **Rematch** (Phase D14): team = `LEAGUE_REMATCH[id].team` (verbatim, same projection), `money: LeagueRematch.reward` (×1.5), the same stage `trainerExp`, **no** badge, **no** `setsFlags`; `league:<id>:rematchAt` is cleared and re-set in the same transaction (its set time = this win) | — |
| `pvp` | challenge handshake (§30.4.5), a ranked match (§30.4.5a) or an arena match (§30.4.10: Elo only for `ranked`, no creature writes) | `kind: 'player'` | `money 0`, `trainerExp: pvpWin` / `pvpLoss` to loser; `ratingDelta` from `eloDelta(winner.rating, loser.rating)` applied with `applyRating` to both, floor 0 (repo); `rankedMatches + 1`; draw → `eloDrawDelta` | yes |
| `raid` | §30.4.7 | shared boss `Side` | per participant: `trainerExp: raidClear`, `money: 50 * bossLevel`, catch window | — |

Side 0 is always the human player (pvp: the challenger). Losing a `trainer`/`league`/`wild` battle: every party creature keeps its post-battle `hp` (possibly 0); no money is lost (the legacy "blackout fee" is not carried); the client's `20-client.md` sends the player to the last healer on its own initiative via `POST /heal`, which requires being in a `healer: true` zone — so a wiped party in a route means walking back, which is the intended cost.

Exp share follows §2.16 (every participated non-fainted battler on the winning player side gets the full gain); core emits it; the server only persists rows.

### 30.4.5 PvP challenge handshake — presence re-checked before creation

```ts
// packages/server/src/rooms/challengeStore.ts — verbatim; pure
export const CHALLENGE_TTL_MS = 45_000;
export interface PendingChallenge { readonly fromId: string; readonly toId: string; readonly at: number }
export class ChallengeStore {
  offer(fromId: string, toId: string, now: number): 'ok' | 'duplicate' | 'targetBusy' | 'selfChallenge';
  /** Consumes the invite. true iff one exists from `fromId` to `toId` and now - at <= TTL. */
  consume(fromId: string, toId: string, now: number): boolean;
  dropFor(playerId: string): readonly PendingChallenge[];    // both directions; returned so the room can send challengeResult 'unavailable'
  sweep(now: number): readonly PendingChallenge[];           // expired; returned so the room can send challengeResult 'expired'
  readonly size: number;
}
```

1. `challenge { targetId }`: target must be in `state.players`, within `aoi.entitiesNear(cell)` **and** ≤ 12 m, not `inBattle`, not in a trade, not the sender. `store.offer(...)` → target gets `challengeReceived { fromId, fromName, expiresInMs: 45000 }`; sender gets `toast 'Challenge sent'`.
2. `challengeReply { fromId, accept: false }` → `store.consume`; challenger gets `challengeResult { targetId, result: 'declined' }`.
3. `challengeReply { fromId, accept: true }` → `store.consume(fromId, me)` must be true; then **re-check every condition of step 1 again against current state** (both present in this room, both not `inBattle`, both not trading, still within 12 m) — a player who walked away, entered a wild battle or disconnected during the 45 s makes the accept fail with `challengeResult { result: 'unavailable' }` to the accepter and nothing to the challenger. Only then `battles.startPvp(challenger, accepter)`: lock both players in one tx (ascending uuid) to read parties; `createBattle` with `seed = createRng(`${battleId}`).snapshot()`; write `BattleSummary`; send `battleStart` to both seats with `seat` 0/1.
4. `onLeave` of either party while pending → `dropFor` → the other side gets `'unavailable'`.

### 30.4.5a Ranked queue (Phase D13) <!-- amended 2026-10-06: Phase D13 -->

`rooms/matchQueue.ts`. The queue is keyed by player in Colyseus presence, not by room: the hash `ewa:ranked:queue` (field = playerId, value = `{ playerId, name, rating, joinedAt }`), so a queued player keeps their place across zone crossings, shards and processes. Every process ticks a matcher every `RANKED_TICK_MS = 1000`; only the holder of the lease `ewa:ranked:leader` (5 s, refreshed each tick) pairs players.

1. `rankedQueue { action: 'join' }` → the room reads the player row (rating) and party. Refused with `rankedStatus { state: 'idle', reason }`: `busy` (in a battle, trade or raid, mid-crossing, or already in an arena match), `party` (no party creature with `hp > 0`). Otherwise the entry is written (a second join keeps the first entry and its wait) and the player gets `rankedStatus { state: 'queued', waitedMs, window }`. `leave` removes the entry → `idle / left`. A real leave of the room (disconnect, not a crossing) and the start of any other battle remove the entry (the latter answers `idle / busy`).
2. **Window**: `rankedWindow(waitedMs) = min(400, 100 + 50 · floor(waitedMs / 10 000))` (protocol `RANKED_WINDOW`). Two entries pair when `|Δrating| ≤ min(window(a), window(b))`. `pairUp` walks the entries oldest first; each takes the unpaired entry with the smallest gap (ties: queue order). A gap above 400 never matches. Entries whose player has no presence key are dropped as stale.
3. **Match**: both entries are removed; the arena room is `pickZoneRoom(RANKED_ARENA.zoneId)` (`mirevale` — the one town without a badge gate — spots at (19, 16) and (25, 16), snapped walkable). The matcher publishes the match to `ewa:ranked:arena:<roomId>` (the arena room records it, expiry `RANKED_ARRIVAL_MS = 20 000`), then broadcasts `ewa:ranked:match`. The room hosting each player (not the destination side of a crossing in progress) sends `rankedStatus { state: 'matched', opponent }` and moves the player: a teleport when it is the arena room, else the §30.2.7 crossing from step 2 into that exact room (`seatHandover(…, roomId)`). A player who became busy stops the match: `idle / busy` to them, `ewa:ranked:cancel` to the rest (the other player gets `idle / cancelled`).
4. **Start**: the arena room's tick (step 9b) starts the match once both players are present with no crossing pending (handover acked) and not in a battle: `battles.startPvp(side 0 = the longer-waiting player, side 1)` at the midpoint — format `pvp`, so Elo applies exactly once per player through §30.4.4; both get `idle / started` after `battleStart`. A start refused for `noUsableParty` answers `idle / party` to that player and `idle / cancelled` to the other. A match not started by its expiry, or cancelled, sends `idle / cancelled` to whoever stands in the arena room.

### 30.4.6 Trainer NPC and league dialogue

`interact { kind: 'npc' }` on an `NpcDef` returns nothing over the wire for a plain conversation — lines are content and the client renders them (`when`/`until`/`react` flags come from `GET /me` and `progressionDelta`) — **unless** the NPC is the `speaker` of the player's next story beat in this zone, in which case §30.4.8 runs. The server otherwise acts only on interacts that change state: `TrainerDef` (battle), `gym` (league battle, or a beat whose `speaker` is the gym's league id — §30.4.8 first), `item` (ground item: once per player, flag `item:<zone>:<id>` in `story_flags`, `inventoryDelta`), `healer` (no-op over the room; healing is `POST /heal`), `shop` (no-op; `GET /shop/:zoneId`), `warp` (`ZoneDef.warps[id]`: authoritative teleport to `(toX, toZ)` snapped with `nearestWalkable`, ≤ 3 m check against `(x, z)`; the `seq` echo carries the client), `obstacle` (Phase D10, `ZoneDef.obstacles[id]`, ≤ `OBSTACLE_INTERACT_M` = 3 m from its centre: refused once cleared (`alreadyCleared`), without the kind's HM (`needHm`) or without a party member of one of `OBSTACLE_TYPES[kind]` (`needType`, fainted members count) — each with content's `obstacleRefusalText` as a warn toast; otherwise `obstacle:<zone>:<id>` and the hidden item (once) in one transaction, then `inventoryDelta`, `progressionDelta { flags }` and a success toast; movement accepts the stamped disc for that player from the next input), `static` (a `LegendaryStatic` battle — `format: 'wild'`, `canFlee: false` on the player side (the legendary cannot be run from) and `canCatch: true`; the record's `when` gate is re-checked here, the static is refused once its `flag` is held, and `flag` is set on win **or** catch). Every interact checks distance ≤ 3 m against the content coordinates and AOI membership first; an interact on an entity outside the 3×3 → `error { code: 'notFound' }`. <!-- reconciled 2026-09-18: warps have data (spine §3.1); static rules per story-bible §7.2.1 -->

### 30.4.8 Story beats — the runtime the bible left to this file

<!-- reconciled 2026-09-18: story-bible.md §5.1.2/§11.3 named `nextStoryBeat` and a server-owned done marker; no section defined them. Shapes are the spine's §3.5 exports -->
On `interact { kind: 'npc' | 'gym', targetId }` (distance and AOI checks passed), before any other handling:

1. `flags = userData.flags` (the player's `story_flags` ∪ `badge:<id>` for every held badge, cached at join and refreshed by every `progressionDelta` this room sends). `beat = nextStoryBeat(zone.id, flags)`; if `beat === null || beat.speaker !== targetId` → fall through to the plain handling above.
2. `client.send('storyBeat', { beatId: beat.id, phase: 'start' })`.
3. If `beat.battle !== null`: `battles.startTrainer(...)` against `beat.battle.trainerId` (a `TrainerDef` or `LeagueTrainer`; the league rules of §30.4.4 still apply for a league id), with `session.beatId = beat.id`. Completion waits for the win; a loss or flee completes nothing and the beat stays eligible.
4. Completion (immediately when `battle === null`, or inside the battle-end transaction of §30.4.3 step 3g when `session.beatId` is set and side 0 won): `setFlags(playerId, [...beat.set, beatDoneFlag(beat.id)])`; when `beat.harvest !== null` nothing else is persisted — `harvestStateFor` derives the state from the done flags; quest objectives of kind `flag` advance for every flag set; `audit 'story.beat'` with `{ beatId }`. After commit: `progressionDelta { flags }` then `storyBeat { beatId, phase: 'complete' }`.
5. `starter` beat: completion additionally requires the player to already own their starter (always true after registration); the flag it sets is the only thing that happens.
6. **Story trainers are fired by their beat only.** A `TrainerDef` whose id is some `StoryBeat.battle.trainerId` (the 7 story battle trainers, `rematchDays: null`, placed beside the speaking NPC) is not challengeable through the plain trainer row of §30.4.4: an `interact` on it when no eligible beat names it is handled like a plain NPC (nothing over the wire). Otherwise a player can fight the story trainer before the beat is reachable — collecting its reward and `trainer:<id>:beaten` early — and be paid a second time when the beat's own battle runs. <!-- amended 2026-09-25: packages/content IMPLEMENTATION-NOTES clarification 4 asked for this; packages/server/src/rooms/ZoneRoom.ts falls through to `case 'trainer'` (lines ~826–862) — server follow-up -->


`ZoneState.harvestState` is never written by this path. Two players in one room can therefore see the same route as `intact` and `harvested`; each renders its own `harvestStateFor` (spine §3.5). Beats are idempotent per player through the done flag; `authority.test.ts` A17 asserts a forged `interact` on a speaker whose beat's `need` is unmet writes nothing.

### 30.4.9 Battle tower (Phase D14) <!-- amended 2026-10-06: Phase D14 -->

`packages/server/src/rooms/towerSession.ts` (`TowerSessions`, one per zone room; only Solenne holds `TOWER.attendantId`, the
league hall foyer's interior NPC — elsewhere every `tower` message is refused `tooFar`). One run per player, in memory:

1. `tower { action: 'start', picks }`: refused (`toast` + `error { notAllowed, detail }`) unless `champion:zeon:beaten` is held
   (`locked`), no run is active (`running`), the player is in no battle / trade (`inBattle`), within `TOWER_RANGE_M` 3 m of the
   attendant (`tooFar`), and `picks` are three distinct party creature ids (`badPicks`). Then `player_streaks.current = 0`
   (`endRun`: a run starts at 0) and fight 1 starts.
2. A fight: the picks as `capLevel(creature, TOWER.levelCap)` copies with synthetic `tower:<id>` ids (fully healed; the stored
   rows are never written — `isPersistedId` skips them), against `towerTeam(seed = <runId>:<wins>, wins)` — `teamSize` distinct
   species of `TOWER.pools[towerTier(wins)]`, Lv 50, seeded ability, level-up moves. `BattleCoordinator.startTower`: format
   `trainer`, `CreateBattleOpts.noExp` (rides the start snapshot), `trainerId = TOWER.trainerId`, no inventory snapshot (items
   refused `noItem`), no flee, no catch. `towerState { phase: 'fighting' }`.
3. The end transaction (§30.4.3 step g) writes, instead of trainer rewards: a win → `streaks.recordWin` and, when the new
   `current` is a multiple of `TOWER.setLength` (7), `towerSetReward(current / 7)` — money + items in the same transaction,
   audit `tower.reward`, carried in `RewardsSummary.money/items`; a loss or a draw → `streaks.endRun` (current 0, best kept).
   No exp, no trainer flag, no quest `win`. `towerState { phase: 'won', reward }` or `{ phase: 'lost' }` (run over).
4. `tower { action: 'next' }` (within 8 m) → the next fight; `tower { action: 'quit' }` between fights → `endRun`, `towerState
   { phase: 'ended' }`. Leaving the room (or a void / abandoned tower battle) ends the run the same way; a pick that left the
   party between fights ends it with a toast.

`GET /leaderboard?mode=towerStreak` ranks `player_streaks.best` (§30.6.3).

### 30.4.10 Arena PvP — battles outside the world <!-- amended 2026-10-11: arena PvP -->

The player opens the PvP screen anywhere (20-client.md §20.9.9d) and fights in a dedicated `arena` room, not a zone; the
in-world PvP (§30.4.5, §30.4.5a) is unchanged. Protocol: `packages/protocol/src/arena.ts`; server: `rooms/arenaQueue.ts`,
`rooms/arenaLobby.ts`, `rooms/ArenaRoom.ts`, `rest/routes/arena.ts`.

**Kinds.** `standard` (own levels), `level50`, `ranked` (Lv 50, Elo), `cup` (Lv 50, a full party of 6 that passes this week's
rule: content `weeklyCup(at)` / `cupRefusal`, rotating Monday 00:00 UTC through Mirror Clause, Starter Bond, Origin Grounds,
Mono Pulse), `friend` (an invite; rules `standard` | `level50`), `training` (an AI; rules + difficulty `easy` | `normal` |
`hard`, team from `ARENA_TRAINING[d].pool` sized to the player's party, at the rules' level or the player's highest level).
Ranked is open to everyone.

**Teams.** One start transaction locks the players and reads the parties: the first six as healed synthetic copies
(`atLevel(c, 50 | null)`, ids `arena:<id>`), so `isPersistedId` skips every creature write — no hp or pp lost, no exp, no
honor (`noExp`). No bag items (inventory snapshot `[null, null]` → `noItem`); the Majin / Tenjin bands still come from the
inventory. Format `pvp` (training `trainer`), seed `createRng(battleId)`, terrain none (`{ id: 'arena', biome: 'capital' }`),
no weather, at (0, 0) yaw 0. The start snapshot carries `arena: <kind>`. A non-empty party may enter (copies are healed).

**End.** `ranked`: `eloDelta` / `eloDrawDelta` + `applyRating` once per player. Every other human kind: `pvpWin` / `pvpLoss`
trainer exp and the `win pvp` quest event, no rating. `training`: nothing (no exp, money, flags, quest events or dex seen).

**The daily challenge <!-- added 2026-10-20 -->.** Kind `daily` (`ARENA_KINDS`; `arenaLevel('daily') = ARENA_LEVEL`): one puzzle a UTC day, the same for everyone (`game/daily.ts`). `dailyPuzzle(dayKey)` tries seeded pairings (`daily:<dayKey>:teams:<k>`, k = 0..39) of three distinct species a side from `TOWER.pools[2]`, level 50, a seeded ability and their level-up moves, and keeps the first one that core's trainer AI wins for the player's side on the day's seed (`chooseNpcAction` on its own rng, the AI side passing null): so every daily is winnable, and that win's turn count is `par`. `POST /daily/start` opens a one-seat arena room (`ArenaLobby.daily`); `BattleCoordinator.startDaily` opens a `trainer` battle of the day's team (`daily:me:<i>`, the player's trainer id) against the AI (`daily:foe:<i>`, trainer `arena.daily`, content `ARENA_DAILY`) on `createRng('daily:<dayKey>')`, so the same choices always play out the same. Nothing about the player's creatures is read or written; like training it pays nothing (no exp, money, flags, quest events or dex seen). At the end the battle transaction re-runs the battle (`replayBattle`) for its strip (`dailyMarks`: per turn `K` a foe fainted, `L` one of the player's, `X` both, `.` neither) and writes `daily_results` (attempts + 1; a win with fewer turns becomes the best). The history row (arena `daily`) replays and shares like any other.

**Queue.** One presence hash per mode `ewa:arena:queue:<mode>` (a player in one mode at most); lease `ewa:arena:leader`;
a 1 s pass. Ranked pairs with `pairUp` and the ranked window; the other modes pair the two longest-waiting. Entries
without presence are dropped; entries older than `ARENA_QUEUE_TIMEOUT_MS` (5 min) get `idle / timeout`. A pair is
re-checked (busy = presence `battleId` / `tradeId`, or seated in an arena room in `waiting` / `fighting`); a busy side
gets `idle / busy` and the free side keeps its place and wait. Then the lobby creates the room
(`createRoom('arena', { ticket, match })`), reserves both seats and pushes `arenaStatus { matched, seat }`.

**Delivery anywhere.** The per-player topic `ewa:arena:<playerId>` carries a `ServerMessage`; the zone room and the
arena room holding the player forward it. Friend invites: `POST /arena/invite` needs an accepted friendship, the friend
online and free; the invite lives in presence for `ARENA_INVITE_TTL_MS` (45 s) and reaches the friend as `arenaInvite`;
`/arena/invite/reply` answers the inviter with `arenaInviteResult` (declined / expired / unavailable) or seats both.

**Arena room.** Static `onAuth` refuses without the server ticket (as `zone`); instance `onAuth` = JWT + ticket + ban +
one of the match's players. On join: presence `{ roomId: <arena>, zoneId: <where the player stood>, arena: true }` (no
`ewa:kick`), the topic subscribed, `arenaState` (+ `battleResync` for a returning seat). When every human is present →
`idle / started`, `arenaState fighting`, `battleStart`. `battleAction` / `battleResync` as in a zone room; a dropped
socket keeps the seat 20 s; a real leave forfeits (pvp) or abandons (training). `battleEnd` → `arenaState ended`.
Cancelled (`arenaState cancelled`, reason): `noShow` (a seat not taken within `ARENA_ARRIVAL_MS` 20 s), `left`, `party`,
`cup` (re-checked against the stored party at the start). The room disposes when empty. The zone room wrote the
player's position when the client left it; `POST /zone/enter` answers 409 `inArena` while the arena holds the player
in `waiting` / `fighting` (a reload rejoins through `POST /arena/rejoin`), and takes them back where they stood after.

**Spectator mode <!-- added 2026-10-20 -->.** A queued match between two players (standard, Level 50, ranked, cup; never a friend battle, training or the daily) goes on the live board (`game/liveBoard.ts`, the presence store, so any process lists and serves it): the room publishes it when the battle starts, after every `battleEvents` and in full when it ends. A feed is the fight as a replay: the start anonymised as a shared replay's (`anonymiseStart`), the seed, the resolved turns minus the last `LIVE_DELAY_TURNS` (1: a watcher is a turn behind the players, so watching beside one tells them nothing new), and the digest the anonymised run reaches (`replayBattle`, computed at publish). The index `ewa:live` holds one summary per match (names and ratings at the match, turn, `finals`); the feed `ewa:live:<matchId>` expires 10 min after its last write (a dead room drops off; the list also sweeps entries older than that) or 3 min after the end, when the full fight with its `outcome` is written and the index entry removed; a voided battle just leaves the index. **League Finals**: a ranked match in Finals week (content `finalsWeek`) whose two players are both in the season's top eight so far (`seasons.current`, read once at the start) is `finals` and listed first.

**Ranked seasons <!-- added 2026-10-20 -->.** Four weeks from Monday 2026-10-05 (content `seasons.ts`), the last seven days Finals week. `jobs/seasonRollover.ts` runs at boot and every 60 s (env `SEASON_ROLLOVER`, 'off' in testEnv): every ended season after the last closed one is closed (`seasons.close`; its row is the lock, so processes never close one twice): the final standings are written and every rating moves halfway back to 1000; after an outage that missed several closes only the last resets. Ratings are not otherwise touched; `peak_rating` keeps the all-time peak.

**Majin vs Tenjin seasons <!-- added 2026-10-20 -->.** A trainer takes a side for a season (`POST /factions/join`, content factions.ts); it holds until the season ends. Points go to the side of a trainer who has one, in the transaction of the deed: a ranked win 3 (the winner, in either ranked path of `persistTurn`), a rewarded raid clear 2 (each rewarded participant), a daily or weekly mission claimed 1 (`POST /quests/claim`). A season's winner is the side with more points (none on a tie); it holds the sky over Solenne all the next season (`GET /factions/sky`), and the Chronicle line of each closed season is derived from its totals (`chronicleLine`). No battle changes and nothing gates the story.

### 30.4.7 Raids

```ts
// packages/server/src/rooms/raidSession.ts — verbatim
export const RAID_ROUND_MS = 20_000;
export const RAID_LOBBY_MS = 90_000;
export const RAID_MAX_PLAYERS = 8;
export const RAID_CATCH_WINDOW_MS = 60_000;
export const RAID_ENRAGE_HP = 0.30;          // phase 2 below this hpPct
export const RAID_ENRAGE_ATK_STAGES = 2;     // applied once when phase 2 begins
export interface RaidParticipant { readonly playerId: string; ready: boolean; side: Side; pending: Action | null; damage: number; caughtAttempted: boolean }
export class RaidSession {
  constructor(hotspot: RaidHotspot, rng: Rng, content: ContentIndex, now: number);
  join(playerId: string, party: readonly CreatureInstance[], badges: number, now: number): 'ok' | 'full' | 'started' | 'badges' | 'already';
  ready(playerId: string): void;                 // lobby starts the fight when all present are ready or RAID_LOBBY_MS elapse with >= 1 ready
  action(playerId: string, round: number, a: Action): ActionError | 'wrongRound' | null;
  tick(now: number): readonly { readonly to: readonly string[]; readonly msg: ServerMessage }[];   // outbound
  catchAttempt(playerId: string, orb: string): 'ok' | 'noWindow' | 'already' | 'notParticipant';
  leave(playerId: string): void;
  readonly boss: Side;                           // ONE Side shared by every participant's private BattleState
  toState(): RaidState;                          // hpPct, phase, roundEndsInMs, damageBoard
}
```

Mechanics:

- The boss is one `Battler` (`hp = floor(calcMaxHp(base, level) * hpMultiplier)`, `hp` tracked as a raid-side integer; `maxHp` reported to core as that scaled value so `%` chip and `hpAfter` are consistent). Each participant holds a private `BattleState` whose side 1 **is** the shared boss battler object by value copied in before each `resolveTurn` and written back after: `stateP.sides[1].party[0].creature.hp = bossHp` before, `bossHp = result.sides[1]…hp` after, processed **in ascending playerId order** within the round so the outcome is deterministic given the actions. The boss's own move each participant-turn is chosen by core (`chooseNpcAction` against that participant), so the boss acts once per participant per round — this is the shared-boss compromise the spine's §2.11(8) delegates here.
- Round: `RAID_ROUND_MS` collect window → resolve all in order → one `raidEvents { raidId, round, events, stateDigest }` per participant with **their** events, and `RaidState` (`hpPct`, `damageBoard`, `phase`) updated for everyone. A participant with no action by the deadline gets the §30.4.3 auto-action.
- **Boss PP.** The boss acts once per participant per round, so its PP would run out in a few rounds and core's NPC policy would then forfeit the participant's private battle while the boss stands (§2.11 clarifications: no Struggle). The shared boss's move PP is restored to `ppMax` on every copy-in; any client preview of a raid turn applies the same rule. <!-- amended 2026-09-25: server IMPLEMENTATION-NOTES Q15 -->
- Rounds are two-phase — `prepareRound()` (pure) → one transaction (participants locked ascending; creature rows, consumables, rewards) → `commitRound()` — so a failed transaction leaves every private state and the boss unchanged (NON-NEGOTIABLE 1 applied to raids).
- Phase 2 (`hpPct < 0.30`): boss `stages.atk += 2` once (event `statStage cause 'ability'`, `detail 'enraged'` via `abilityTrigger`); nothing else changes.
- Boss defeat → phase 3 catch window `RAID_CATCH_WINDOW_MS`: every participant whose `damage > 0` may `raidCatch` once; each attempt is core's §2.15 with `H = 1` (a defeated boss counts as 1 HP), `statusBonus` from the boss's status, the participant's orb; success inserts a copy for that player (every successful participant gets their own instance — raids are not exclusive). Orb consumed either way.
- Participant faints all six → they remain in the lobby as spectators (`damageBoard` kept, no catch window unless `damage > 0`, which it will be).
- All participants leave/faint before the boss → phase 4 `over`, no rewards. Boss defeat → `RewardsSummary` per participant with `damage > 0`.
- One raid per zone room at a time (`state.raid`), opened by `liveops` when the hotspot's UTC window begins (§30.9) and closed at phase 4 or when the window ends with no fight started.

---

## §30.5 AUTHORITY MATRIX

Every mutable player-visible field, the only writer, and the only wire path that can change the client's copy. "Client" never appears in the writer column.

| Field / row | Writer (server module) | Trigger | Client learns via |
|---|---|---|---|
| `players.money` | `PlayerRepo.addMoney` from shop/market/trade/battle rewards/raid rewards/battle pass/quest and mission claims/daily-login streak/guild founding (5 000) | REST, battle or raid round tx, login | `inventoryDelta.money` / REST response (`inventoryDelta` body on `/guilds`, `/marketplace/*`) |
| `players.x/z/angle/zone_id` | `PlayerRepo.setPosition` from `ZoneRoom` (join fallback, leave, handover ack) | room lifecycle | schema `PlayerState` |
| `players.rating/peak_rating/ranked_matches` | `applyRating` from pvp end | battle end tx | `progressionDelta.rating` |
| `players.trainer_exp` | `addTrainerExp` (battle end, catch, quest claim, daily login, trade, zone restore) | tx | `progressionDelta.trainerExp/trainerLevel` |
| `players.title/motto/body` | REST `POST /profile` (values from the content option lists only) | REST | REST response |
| `players.banned_at/ban_reason/is_admin` | REST admin routes / boot bootstrap | REST | 403 on next request |
| `creature_instances.*` (hp, pp, status, exp, level, moves, ability, held_item, nickname, favorite, locked, species on evolve) | `CreatureRepo.update` from battle tx or the `/creature/:id/*` and `/item/use` REST handlers | tx | `inventoryDelta.creaturesUpdated` / REST |
| `creature_instances.owner_id/slot_kind/slot_index` | `transferCreature`, `moveToSlot`, `reorderParty`, `insert`, `release` | trade/market/party REST/catch tx | `inventoryDelta` / REST |
| `inventory_items.qty` | `InventoryRepo.add` | shop/use/battle/raid/quest/mission/battle pass/daily-login/ground item/`/creature/:id/setup` (equip takes one, returns the old held item) tx | `inventoryDelta.items` |
| `badges` | `ProgressRepo.awardBadge` from league win **only** | battle end tx | `progressionDelta.badges` |
| `story_flags` | `setFlags` from league win, trainer win, ground item, static, quest claim, story beat completion; the live-ops `streak:<n>` / `streak:last:<day>` bookkeeping rows (daily login, §30.9.1) | tx | `progressionDelta.flags` |
| `dex_entries` | `markSeen/markCaught` from battle tx and trade/market receipt | tx | `progressionDelta.dexSeen/dexCaught` |
| `quest_progress` | `advance/claim` from battle tx, interact handlers, REST claim | tx | `progressionDelta.questProgress` |
| `battle_pass` | REST claim / mythical choice | REST | REST response |
| `listings/bids` | `MarketRepo.*` | REST + expiry job | REST |
| `friendships/messages/guilds/guild_members` | `SocialRepo.*` | REST | REST |
| `refresh_tokens` | `AuthRepo.*` | REST auth | tokens in response |
| `SpawnState.*` | `SpawnDirector` | tick / engage | schema |
| `PlayerState.x/z/angle/moving/running/seq` | `ZoneRoom.onInput` after `validateInput` | `input` | schema |
| `PlayerState.emote` | `ZoneRoom` on `emote` (allow-list 1..6, cleared at 2 s) | `emote` | schema |
| `PlayerState.body/guildTag/name` | copied from rows at join; `body` re-read after `POST /profile` via `presence.publish('ewa:profile', …)` | REST | schema |
| `RaidState.*`, `BattleSummary.*` | `RaidSession`, `BattleCoordinator` | tick | schema |

<!-- amended 2026-09-25: the money / inventory / story_flags writer lists were incomplete against the implemented server (raid rewards, mission claims, daily-login streak, guild founding, setup equip) — a matrix that claims to name "the only writer" must name all of them -->
The `50-verification-budget.md` authority test fabricates every `CLIENT_MESSAGES` type (including well-formed `battleAction` for another player's battle, `handoverAck` without a reservation, `engageSpawn` for a spawn outside AOI) and every REST body with adversarial values, then diffs the database against a snapshot: **zero rows changed** except `audit_log`, `players.last_seen_at`, and the attacker's own rate-limit kicks.

### 30.5.1 Adversarial test list — expected server response

| # | Attack | Server response | Persisted effect |
|---|---|---|---|
| 1 | Client sends a `progressionDelta`/`inventoryDelta`-shaped message to the room | No handler for that type → the `'*'` handler counts it (`metrics.unknownMessages += 1`), no reply; 5 in 10 s → `client.leave(4003)` | none |
| 2 | `battleAction` with another player's `battleId` | `error { code: 'notFound' }` (identical to a missing id) | none |
| 3 | `battleAction` with own `battleId`, `turn` ≠ collecting turn | `error { notAllowed, 'wrongTurn' }` | none |
| 4 | `battleAction` `move` not in active moves / pp 0 / choice-locked | `error { notAllowed, <ActionError> }` from `validateAction` | none |
| 5 | Speed hack: `dtMs` honest, `dist` > cap | `speed` reject; avatar stays; `seq` echoed → client snaps | none (30 in 10 s → kick + `movement.kick` audit) |
| 6 | dt inflation: `dtMs = 100` every 33 ms | budget falls below −100 ms within 4 inputs → `dtBudget` reject on every input thereafter until budget refills at 50 ms/tick | none |
| 7 | Teleport: `x/z` far away in one input | `speed` reject (distance/dt) | none |
| 8 | Teleport via `handoverAck` to a room the player never reserved | destination `onJoin` fails `badHandover` (403); the seat was never reserved so the join itself is refused by Colyseus | none |
| 9 | Walk into water/void/prop | `unwalkable` reject | none |
| 10 | Negative or zero `qty` on `/shop/buy`, `/shop/sell`, `/item/use` | zod `min(1)` → 400 `invalidPayload` | none |
| 11 | `/shop/buy` with `qty * price > money` | `InsufficientFunds` → 409; tx rolled back | none |
| 12 | `/shop/sell` an item not owned / qty > owned | `InventoryRepo.add` would go negative → 409 | none |
| 13 | Duplicate catch: `catch` action twice in one turn, or a second `battleAction` after the first | step 4 `alreadySubmitted` → `notAllowed` | one orb deducted, one catch rolled, at most one insert (insert is inside the same tx as the roll) |
| 14 | Replayed `raidCatch` | `catchAttempt` → `'already'` → `notAllowed` | one orb, one roll |
| 15 | `interact`/`engageSpawn` on an id outside the 3×3 AOI | `notFound` | none |
| 16 | `engageSpawn` on an engaged spawn | `busy` | none |
| 17 | Replayed / reordered `input` (`seq` ≤ last) | dropped silently | none |
| 18 | `chat` > 120 chars / control chars / 5th message in 4 s | zod 400-equivalent `invalidPayload` / sanitiser strips / `rateLimited` and dropped | none (chat is never persisted) |
| 19 | Join a gated zone room directly with a valid token but no badge | `onAuth` → 401 `ServerError`; REST `/zone/enter` refuses earlier with 403 `gated` | none |
| 20 | Marketplace: bid on own listing / below minimum / after expiry / two bids racing | `SelfBid`/`BidTooLow`/`ListingClosed` → 409; the racing pair serialise on `FOR UPDATE`, exactly one wins | one bid row; loser's money untouched |
| 21 | Trade: modify offer after confirming, or `tradeConfirm` with a stale `offerHash` | phase reset to `open` (both confirmations cleared) / `notAllowed 'staleOffer'` | none until both confirm the same hash |
| 22 | Release / list / trade a `locked` creature or the last party member | repo throws `Locked`/`PartyMinimum` → 409 | none |
| 23 | Forged JWT (wrong secret / expired / `aud` mismatch) | REST 401; room `onAuth` 401 | none |
| 24 | Refresh token reuse after rotation | `rotateRefresh` returns null → 401 and `revokeAll(playerId)` (token theft response); audit `auth.refreshReuse` | all refresh tokens of that player revoked |
| 25 | Register 6th account from one IP within an hour | 429 `rateLimited` | none |
| 26 | Create or join a zone room directly through Colyseus' `POST /matchmake/*` routes (any options, any shard) | `onCreate`/`onAuth` without the join ticket → `ServerError(403, 'noTicket')` (§30.2.6) | none |
| 27 | `POST /zone/enter` for an ungated zone that is not the player's current zone (REST "fast travel") | 409 `wrongZone`, no seat | none |
| 28 | `POST /marketplace/list` of a party member during a live battle | 409 `inBattle` (§30.6.3) | none |

---

## §30.6 REST — Fastify 5

### 30.6.1 Plugins and hooks (registration order)

1. `@fastify/cors` `{ origin: env.CORS_ORIGINS.split(','), credentials: false, methods: ['GET', 'POST'] }` — exact-origin match; no wildcard in production (boot refuses `*`).
2. `@fastify/jwt` `{ secret: env.JWT_SECRET, sign: { expiresIn: env.JWT_ACCESS_TTL_S, iss: 'ewa-server', aud: 'ewa' }, verify: { allowedIss: 'ewa-server', allowedAud: 'ewa' } }`. Payload type `{ sub: playerId, usr: username, adm: boolean }`.
3. `fastify.decorate('requireAuth', async (req) => { await req.jwtVerify(); const banned = await banCache.isBanned(req.user.sub); if (banned) throw 403 })` — used as `onRequest` on every route in the §4.7 table marked `bearer`. `banCache` is refreshed from `players.banned_at` every 30 s and invalidated immediately by the admin ban route.
4. `fastify.decorate('requireAdmin', …)` — `requireAuth` + re-reads `is_admin` from the row (never trusts the token's `adm` claim for admin routes; the claim exists only so the client can show the panel).
5. Body validation: every route declares `schema: { body: zodToJsonSchema? }` — **no**: Fastify's Ajv path is bypassed. Instead each handler begins `const body = Schema.parse(req.body)` with the zod schema from `packages/protocol/src/rest.ts`; a `ZodError` is mapped by `setErrorHandler` to `400 { code: 'invalidPayload', issues }`. Responses are `Schema.parse`d in `NODE_ENV !== 'production'` (catches a handler leaking a field) and passed through in production.
6. `setErrorHandler`: `PersistError` (spine §5.5 codes) → `NotFound` 404, `Forbidden` 403, `InvalidArgument` 400, every other code (`InsufficientFunds`, `InsufficientItems`, `InventoryOverflow`, `BidTooLow`, `BidAboveBuyNow`, `ListingClosed`, `ListingHasBids`, `NoBuyNow`, `SelfBid`, `NotOwner`, `Locked`, `PartyMinimum`, `PartyFull`, `InvalidSlot`, `InvalidReorder`, `NotInEscrow`, `UsernameTaken`, `EmailTaken`, `AlreadyFriends`, `GuildFull`, `AlreadyInGuild`, `NotGuildMember`, `GuildNameTaken`, `AlreadyClaimed`) → 409 `{ code }`; `RateLimited` → 429 with `retry-after`; `ZodError` → 400 `invalidPayload`; `@fastify/jwt` errors → 401; everything else → 500 `{ code: 'internal' }` with the pino error id, never the message. <!-- reconciled 2026-09-18: the closed code list from the implemented persist -->
7. `onRequest`: `req.log` child with `{ reqId, playerId? }`; `onResponse`: `metrics.rest[route].count/ms`.
8. `trustProxy: env.TRUST_PROXY === 'false' ? false : env.TRUST_PROXY` on the Fastify constructor; `req.ip` is used for IP-keyed limits only.
9. Body limit 64 KiB; `GET` responses paginated at `pageSize ≤ 50` everywhere.

### 30.6.2 Auth

```ts
// packages/server/src/rest/auth.ts — verbatim
import { hash, verify } from '@node-rs/argon2';
import type { Algorithm, Options } from '@node-rs/argon2';
const ARGON2ID = 2 as Algorithm;   // Algorithm.Argon2id — the package's enum is an ambient `const enum`, unusable under isolatedModules (amended 2026-09-25, server IMPLEMENTATION-NOTES)
export const ARGON2: Options = { algorithm: ARGON2ID, memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 };
export function hashPassword(pw: string): Promise<string>;          // hash(pw, ARGON2) — PHC string, 16-byte random salt from the library
export function verifyPassword(phc: string, pw: string): Promise<boolean>;   // verify(phc, pw); never compares strings
export const ACCESS_TTL_S = 900;
export const REFRESH_TTL_D = 30;
export interface TokenPair { readonly access: string; readonly refresh: string }   // refresh = 32 random bytes, base64url; stored as sha-256 hex
export async function issueTokens(tx: Tx, fastify: FastifyInstance, player: { id: string; username: string; isAdmin: boolean }): Promise<TokenPair>;
/** Rotating: the presented token is revoked (revoked_at = now) and a new one issued in the same tx. Reuse of a revoked token → revokeAll + null. */
export async function rotateTokens(tx: Tx, fastify: FastifyInstance, refresh: string): Promise<TokenPair | null>;
```

- `POST /auth/register`: `username` `/^[a-z0-9_]{3,20}$/` (stored as given; `username_lower` for uniqueness), `email` zod `.email()` lowercased, `password` 8..128, `starter ∈ {bramblecub, glimfin, cindercap}`. One tx: `players.create`, starter `creatures.insert` at level 5 (`moves` = species default 4, `ability` index 0, `hp = maxHp`), `inventory.add` `potion 5`, `spark_orb 10`, `markSeen/markCaught(starter)`, `issueTokens`. Duplicate username/email → 409 `{ code: 'taken', field }` (both checked by the unique index; the error is mapped, never pre-checked-then-inserted).
- `POST /auth/login`: `byUsername(lower)`; on a missing row still run `verifyPassword` against a fixed dummy PHC so timing does not reveal existence; 401 `{ code: 'badCredentials' }` for both cases; `banned_at` → 403 `{ code: 'banned', reason }`; `last_seen_at = now`; `dailyLogin` trainer exp if the UTC day changed (§30.9.1).
- `POST /auth/refresh`, `POST /auth/logout` (revokes the presented refresh token; the access token expires by itself within 15 min).
- Phase C6 email routes (spine §4.7 rows, `email_tokens` §5.1): registration issues a 48 h verification token in its transaction and mails the link after commit. `POST /auth/forgot` lowercases the address, applies the per-address cap (`forgotEmail`) silently, and for a known unbanned account issues a 30 min reset token + audit `auth.forgot`. `POST /auth/reset` hashes the new password first (so an unknown token costs the same), then in one tx: `consumeEmailToken(reset)` under `FOR UPDATE` → `setPasswordHash` → `revokeAll` refresh tokens → `markEmailVerified` → audit `auth.passwordReset`. A new token of a kind supersedes (marks used) every older unused one of that kind. Tokens are 32 random bytes base64url, stored as sha-256 hex, single use.

### 30.6.3 Route table

The §4.7 table is the route table; this section only pins behaviours the table leaves to the server:

- `GET /me` returns the spine §4.7 shape: `presence: { roomId: string | null; zoneId; shard }` (from `PresenceStore`/`presence.get`; `zoneId` falls back to the row's `zone_id` when offline) for the client to `POST /zone/enter` after a reload, plus `battlePass`, `quests` (all `QUESTS` filtered by `requires` satisfied, with progress rows; daily/weekly synthetic quests included), `flags`, `badges`, `unreadDm`, `friendRequests`, `liveOps` (§30.9 summary). <!-- reconciled 2026-09-18: OQ 3 -->
- `POST /party/*`, `/creature/:id/*`, `/item/use`, `/heal`, `/shop/*` and `/marketplace/list` are refused with 409 `{ code: 'inBattle' }` while `PresenceStore.battleOf(playerId) !== null` — REST may not mutate or escrow a creature that is being projected in a live battle (a listed-then-bought creature would otherwise receive the battle transaction's hp/exp write under its new owner). A raid participant counts as in battle from the fight's start to the catch window. <!-- amended 2026-09-25: server IMPLEMENTATION-NOTES Q6, Q14 --> The check reads presence (in-memory or Redis), which the room updates at battle start/end.
- `/heal`: player must currently be in a zone room whose `zone.healer === true` (presence lookup); heals `hp = maxHp`, `status = []`, `pp = ppMax` for every party member; free.
- `/creature/:id/evolve { into }`: `into` must equal `applyExp(...)`-style readiness: `species.evolution` resolves to `into` at the current level and ability (split branch by ability, default last); performs core `evolve`, `markSeen/markCaught(into)`, audit `creature.evolve`.
- `/creature/:id/moves { moves }`: 1..4 unique ids, each in `learnableMoves` with `level <= creature.level`; kept slots keep their `pp`, new slots get `pp = ppMax = move.pp`.
- `/item/use`: `rareCandy` applies `applyExp(c, expToLevel(level + 1) - exp)`; `repel`/`lure` set a `presence` key `ewa:repel:<playerId>` with the step count that `SpawnDirector.engage` and the client-side encounter filter consult (repel: wild spawns below the lead's level refuse engagement — `'notFound'`-equivalent `toast`); `escapeRope` teleports to the zone's arrival point (`arrivalPoint`, spine §3.1 — on a route that is its spawn) via the room (`presence.publish('ewa:teleport')`), only in a `route` zone <!-- amended 2026-10-06: town arrival point -->.
- `/shop/:zoneId` prices: `ConsumableDef.price`/`OrbDef.price` from content; `stock = zone.shop ?? SHOP_STOCK_DEFAULT` when `zone.shop !== null`, 404 when the zone has no shop. Sell = `sellPrice`. Held items (`ItemDef.price !== null`) are sold only in `solenne`.
- `/players/:username`: `toPublic(row)` + showcase (≤ 3 `favorite` party members, `ownerId` nulled). Unknown → 404. Banned players return 404 too.
- `/leaderboard`: top 100 by `rating` desc (ties by `peak_rating`, then `username_lower`), or by dex caught count, or `trainer_exp`, or (Phase D14 `towerStreak`) by `player_streaks.best` desc (then `current`, then `username_lower`; players with best > 0 only); banned excluded; `page` of 25. Every row carries `towerBest` / `towerCurrent`.
- Creature history <!-- added 2026-10-20 -->: the battle transaction adds `badge { badge }` to every persisted creature of the winning side's party when a league win awards a badge, `champion` when it sets `champion:zeon:beaten`, and `legendary { species, caught }` when a legendary static is won or caught; `POST /creature/:id/evolve` adds `evolved { from, into }`; persist adds `met` at insert and the change of hands at transfer. `GET /creature/:id/history` reads `creatureRepo.history`.
- **Verified speedruns <!-- added 2026-10-20 -->.** The server keeps the time (`game/speedrun.ts`, persist `RunRepo`): a zone room starts the play clock when it has taken a player (`runs.start`, which keeps a running clock, so a crossing never pauses it) and stops it when the player leaves the world (not on a handover); an arena room starts and stops it the same way. At boot every running clock is stale and stops without banking the gap. Splits are written in the transaction of the moment: `beat:<id>` in `completeBeatInTx`, `badge:<id>` next to the only badge write, `champion` with the Champion's flag. A run counts when it holds the first beat's split (`RUN_START_SPLIT`): an account already past it when the clock arrived stays off the board. No client time is ever read; every battle of a run is in `battle_history` and replays.
- **Challenge modes <!-- added 2026-10-20 -->.** The run is story flags (content `challenge.ts`): a mode flag (`challenge:nuzlocke` / `challenge:hardcore`, from `POST /auth/register { challenge }` or `POST /challenge` before the first badge and before anything has fallen) until a result flag (`challenge:cleared` when the run beats the Champion, `challenge:failed` when nothing is left that has not fallen). While active: the battle start transaction (`loadPlayers` with the zone for wild and static battles, and the raid join) reads the run; a zone's first wild encounter sets `challenge:met:<zone>` (sent as a progressionDelta) and only that battle has `canCatch`; a raid's catch window is closed once the zone's encounter is spent, and an attempt spends it; Hardcore's battle bag is the orbs only (`orbsOnly`, kept after every refresh; a raid refuses bag items); a creature written with hp 0 gets `FALLEN_RIBBON`. `POST /party/withdraw`, the box side of `/party/swap`, `/creature/:id/evolve` and `/item/use` (a revive included) answer 409 `fallen`; `/heal` skips the fallen; a fallen creature cannot be listed or offered in a trade, and never fights as an arena or tower copy. A failed run rewrites the fallen with `FALLEN_MEMORIAL_RIBBON` (no rule reads it), so the account plays on.
- Battle replays <!-- added 2026-10-20 -->: `POST /history/battles/:battleId/share` loads the caller's own row, replays it (`replayBattle` over `start` + `seed` + `actions`) and refuses it unless it reaches `final_digest`; it then anonymises `start` (`game/replay.ts` `anonymiseStart`), replays that to its own final digest, and stores the frozen `SharedReplay` under a fresh `randomBytes(9).toString('base64url')` token (a token taken by another share is retried), audit `battle.share`. A second share of the battle returns the first token. `GET /replay/:token` is public (no bearer) and reads only `battle_shares`, so a share outlives the history page it came from. Labels: the sharer's username for their side, the history row's `opponent` for a player or NPC opponent, null for a wild side.
- Admin: `GET /admin/players?q=` uses `ILIKE '%' || escapeLike(q) || '%' ESCAPE '\'` on `username_lower`; ban writes `banned_at/ban_reason`, revokes refresh tokens, publishes `ewa:kick` so every room drops the player within one tick, audit `admin.ban`. Admins cannot be banned (409).

### 30.6.4 Rate limits

```ts
// packages/server/src/rest/rateLimit.ts — verbatim; pure sliding window, injected clock
export interface Limit { readonly max: number; readonly windowMs: number }
export const LIMITS = {
  register:  { max: 5,  windowMs: 3_600_000 },   // per IP
  login:     { max: 10, windowMs: 900_000 },     // per IP and per username_lower (both must pass)
  refresh:   { max: 30, windowMs: 900_000 },     // per IP
  listing:   { max: 5,  windowMs: 3_600_000 },   // per player (MARKET.listMaxPerHour)
  bid:       { max: 30, windowMs: 3_600_000 },   // per player (MARKET.bidMaxPerHour)
  message:   { max: 20, windowMs: 60_000 },      // DMs per player
  friendReq: { max: 20, windowMs: 3_600_000 },
  guildOp:   { max: 10, windowMs: 60_000 },
  restRead:  { max: 240, windowMs: 60_000 },     // every GET, per player
  restWrite: { max: 60,  windowMs: 60_000 },     // every other POST, per player
  forgot:    { max: 5,  windowMs: 3_600_000 },   // POST /auth/forgot per IP (429)
  forgotEmail: { max: 3, windowMs: 3_600_000 },  // reset mails per address: over it 204 and nothing sent
  emailToken: { max: 20, windowMs: 900_000 },    // POST /auth/reset + /auth/verify per IP
  resend:    { max: 3,  windowMs: 3_600_000 },   // POST /auth/resend per player
  replay:    { max: 60, windowMs: 60_000 },      // GET /replay/:token per IP (public; added 2026-10-20)
  weather:   { max: 20, windowMs: 60_000 },      // GET /weather/cities per player (each one an Open-Meteo request; added 2026-10-20)
  // room messages (per client), from the spine §4.3, restated so one table holds them all:
  input:     { max: 30, windowMs: 1_000 },
  emote:     { max: 1,  windowMs: 1_500 },       // spine §4.3: 1 per 1.5 s (reconciled 2026-09-18: the earlier 6 / 5 s row is gone)
  chat:      { max: 4,  windowMs: 4_000 },
  interact:  { max: 4,  windowMs: 1_000 },
  engageSpawn: { max: 2, windowMs: 1_000 },
  battleAction: { max: 4, windowMs: 1_000 },
  battleResync: { max: 4, windowMs: 1_000 },
  challenge: { max: 3,  windowMs: 5_000 },
  tradeRequest: { max: 3, windowMs: 5_000 },
  raid:      { max: 4,  windowMs: 1_000 },
} as const satisfies Record<string, Limit>;

export interface RateLimiterState { readonly windows: Map<string, number[]> }   // key -> sorted timestamps within window
export function createLimiterState(): RateLimiterState;
/** true = allowed (timestamp recorded); false = over limit (not recorded). Prunes timestamps older than windowMs. */
export function allow(s: RateLimiterState, key: keyof typeof LIMITS, now: number): boolean;
export interface RateLimiter { allow(scope: string, key: keyof typeof LIMITS, now: number): Promise<boolean> }  // scope = ip or playerId
export function localRateLimiter(clock: () => number): RateLimiter;                     // in-process Map<scope, RateLimiterState>, swept every 60 s
export function presenceRateLimiter(p: Presence, clock: () => number): RateLimiter;    // hincrbyex(`ewa:rl:${scope}:${key}:${bucket}`, …) fixed 1 s sub-buckets summed over the window
```

`localRateLimiter` ships and is used when `REDIS_URL` is absent; `presenceRateLimiter` when present (limits are then cluster-wide). Room messages use the per-client `RateLimiterState` in `userData` (one process owns a client, so no presence round trip). Over-limit room messages are dropped with **one** `error { code: 'rateLimited' }` per window (a flag in the state), never one per drop.

### 30.6.5 Chat filter — the legacy approach as data

```ts
// packages/server/src/chat/blocklist.ts — the BLOCKED_WORDS list from legacy chatFilter.js, verbatim, as data
export const BLOCKED_WORDS: readonly string[];            // 19 entries, lowercase — the legacy chatFilter.js list has 19 (amended 2026-09-25, server IMPLEMENTATION-NOTES Q1)
export const LEET_MAP: Readonly<Record<string, string>> = { '3': 'e', '4': 'a', '0': 'o', '1': 'i', '@': 'a', '$': 's', '!': 'i', '+': 't' };
// packages/server/src/chat/filter.ts
export function normalizeLeet(s: string): string;                 // lowercase; LEET_MAP per char; then 'ph' -> 'f'
export function containsBlocked(s: string): boolean;              // whole-word match allowing [\W_]* between letters, over normalizeLeet(s)
export function censor(s: string): string;                        // replaces each match in the ORIGINAL string with '*' × match.length
export function sanitizeChat(s: string): string | null;           // strip C0/C1 controls + zero-width (U+200B..U+200F, U+2060, U+FEFF); collapse whitespace runs to one space; trim; null when empty or > 120
```

Overworld `chat`: `sanitizeChat` → null → dropped; else `censor` (soft) → re-broadcast **only to viewers whose 3×3 contains the sender** via `client.send('chat', …)` — chat rides the AOI, not `broadcast`, so a 200-player zone does not fan out 200×. Message shape: the spine §4.4 variant `{ type: 'chat', id, name, text }`. Never persisted. <!-- reconciled 2026-09-18: OQ 2 — the variant exists; no toast fallback --> DMs (`POST /messages/:username`): `containsBlocked` → 400 `{ code: 'blockedWord' }` (hard reject, as legacy did for DMs), otherwise stored verbatim after `sanitizeChat` with the 300 cap.

The patterns are compiled once at module load from the data list; adding a word is a data change with a unit test asserting `containsBlocked('f.u.c.k') === true` and `containsBlocked('scunthorpe') === false` (whole-word boundary).

### 30.6.6 String hygiene

Every user-supplied string that reaches SQL `LIKE`/`ILIKE` passes through `escapeLike` (persist) and the query appends `ESCAPE '\'`. There is no `$regex`/`RegExp` construction from user input anywhere in `@ewa/server`; the chat filter's regexes are built from the constant blocklist only. Usernames in URLs (`/players/:username`, `/messages/:username`) are lowercased and matched by equality on `username_lower`, never `LIKE`. `search` on `/marketplace` and `/guilds` is capped at 32 chars before escaping.

### 30.6.7 Bans

`banCache: Set<playerId>` per process, rebuilt from `players where banned_at is not null` every 30 s and on `presence.subscribe('ewa:ban')`. `beforeUpgrade` cannot know the player yet (no token parsed at upgrade), so the socket-level check is IP-count only; the player-level ban check runs in `onAuth`.

---

## §30.7 SOCIAL

### 30.7.1 Friends

`friendships` rows keyed `(requester, addressee)`. Request: target exists, not self, not banned, ≤ 100 accepted friends for both players (409 `friendLimit`, checked on request and on accept); a reverse pending request is accepted instead of refused (spine §5.2 `requestFriend`, `friendships_pair_uq`) <!-- amended 2026-09-25: "no row in either direction" contradicted the spine's requestFriend; server IMPLEMENTATION-NOTES Q4 -->. Accept: only the addressee of a `pending` row; sets `accepted`. Decline/remove: deletes the row (either party). `GET /friends` returns `FriendView { id, username, title, body, online: boolean, zoneId: ZoneId | null, inBattle: boolean, lastSeenAt }` — `online/zoneId/inBattle` come from `PresenceStore` (§30.7.4), never from the DB. Friend gifts (legacy `/friends/gift`) are **not** carried; trades exist.

### 30.7.2 DMs (persisted)

`POST /messages/:username`: both players must be accepted friends (409 `notFriends`); `sanitizeChat` (300 cap) + `containsBlocked` reject; insert `messages`; if the recipient is online, `presence.publish(`ewa:dm:${toId}`, { id, fromId, fromName, text, sentAt })` and the recipient's room forwards it as the spine §4.4 variant `dm { id, fromId, fromName, text, sentAt }` (`sentAt` unix ms). <!-- reconciled 2026-09-18: OQ 2 --> `GET /messages/:username?before=&limit` pages by `sent_at desc` from `messages_pair_idx` (both directions merged in SQL). `POST /messages/read { username }` sets `read_at = now` on every unread row from that sender. Unread count is `count(*) where to_id = me and read_at is null` via `messages_to_unread_idx`, included in `GET /me`.

### 30.7.3 Guilds

```ts
export const GUILD = { createCost: 5000, maxMembers: 50, tag: /^[A-Z0-9]{3,4}$/, name: { min: 3, max: 24 }, motd: 200, roles: ['leader', 'officer', 'member'] as const } as const;
```

- Create: `socialRepo.createGuild({ leaderId: me, name, tag })` — charges `GUILD_CREATE_COST` 5000 in the same tx (409 `InsufficientFunds`), inserts `guilds` (`leader_id = me`) and the `leader` member row; `tag` `/^[A-Z0-9]{3,4}$/` (spine §4.7 — reconciled 2026-09-18, OQ 5: the spine regex is now `{3,4}`), unique (409 `GuildNameTaken` for name or tag). One guild per player (`guild_members_player_uq`, 409 `AlreadyInGuild`).
- Join: open join in v1 (no invites); refused at 50 members (409 `guildFull`) or when already in a guild.
- Leave: a leader may leave only after `promote` handed leadership to another member (409 `leaderMustPromote`); the last member leaving deletes the guild.
- Kick: `leader` may kick anyone but themselves; `officer` may kick `member`. Promote: `leader` → any member to `officer`, or an officer to `leader` (the caller becomes `officer`). All under one tx with `lock` on the guild row (`select … for update`).
- `PlayerState.guildTag` is set at room join from the member row and refreshed by `presence.publish('ewa:profile', { playerId })` on any guild change.
- Guild chat, guild bank, wars: not in v1 (cut deliberately).

### 30.7.4 Presence — keyed by playerId, pure, unit-tested

```ts
// packages/server/src/rooms/presenceStore.ts — verbatim; pure, no I/O. The process-local half.
export interface PresenceEntry { readonly roomId: string; readonly zoneId: ZoneId; readonly shard: number; battleId: string | null; tradeId: string | null; readonly since: number }
export class PresenceStore {
  /** Returns the previous room if the player was already present elsewhere (caller kicks it). Multi-tab collapses: one entry per player. */
  enter(playerId: string, e: PresenceEntry): PresenceEntry | null;
  leave(playerId: string, roomId: string): boolean;          // false when the player is in a different room now (stale leave — ignored)
  get(playerId: string): PresenceEntry | null;
  isOnline(playerId: string): boolean;
  setBattle(playerId: string, battleId: string | null): void;
  setTrade(playerId: string, tradeId: string | null): void;
  ipCount(ip: string): number; ipEnter(ip: string): void; ipLeave(ip: string): void;
  readonly size: number;
}
```

Distributed half: every `enter`/`leave`/`setBattle`/`setTrade` also writes `presence.setex(`ewa:presence:${playerId}`, JSON, 90)` (refreshed by `presenceSweep` every 30 s for present players) so REST on any process answers `online/zoneId/inBattle` with one `presence.get`. With `LocalPresence` this is the same process, and the store is the cache in front of it. Tests drive `PresenceStore` with two "tabs" and assert `size === 1`, that the older room is returned for kicking, and that a stale `leave` from the kicked room does not remove the newer entry — the legacy `onlinePresence.js` guarantee (socketId → playerId, refcounted), rebuilt without the refcount because the room kicks the older session instead of tolerating two.

---

## §30.8 ECONOMY

### 30.8.1 Shop

`POST /shop/buy { item, qty }`: item ∈ stock for the player's current zone (presence); `price = content price × qty` (integer; `null` price → 409 `notForSale`); one tx: `lock(me)`, `addMoney(-price)`, `inventory.add(+qty)`, audit `shop.buy`. Sell: `sellPrice × qty` credited, `inventory.add(-qty)`; `sellOnly` items (`nugget` …) sell anywhere with a shop. `maxStack` enforced by the `0..999` CHECK and `ConsumableDef.maxStack` (409 `stackFull`).

### 30.8.2 Marketplace

Rules live in `MarketRepo` (spine §5.2) and are restated here only as the server's contract:

- `POST /marketplace/list`: `creatureId` owned, not `locked`, not the last party member; `startingBid >= MARKET.minStartingBid (100)`; `buyNowPrice === null || buyNowPrice > startingBid`; `durationHours ∈ MARKET.durationsHours`; rate `LIMITS.listing`. Tx: `creatures.moveToSlot(id, 'listing', 0)`, `market.create`, audit `listing.create`. The creature leaves the party/box immediately.
- `POST /:id/bid { amount }`: `market.placeBid` — `SELECT … FOR UPDATE` on the listing, then the bidder's player row, then the previous bidder's row (ascending uuid among the two player rows); minimum increment **50**; `amount < buyNowPrice` when set; escrow: `addMoney(bidder, -amount)`, refund the previous bidder in the same tx. Rate `LIMITS.bid`.
- `POST /:id/buy-now`: `market.buyNow` — FOR UPDATE; refund current bidder; `addMoney(buyer, -price)`; `transferCreature(creature, seller, buyer, 'marketSale')` (the creature is in `listing` slot for the seller; transfer rewrites owner + `box/nextBox`); `addMoney(seller, price - floor(price * MARKET.feePercent / 100))`; status `sold`; `tradeComplete` trainer exp to both; `markSeen/markCaught` for the buyer.
- `POST /:id/cancel`: seller, active, `currentBid === null` → creature back to seller's box, status `cancelled`.
- **Expiry job** (`jobs/marketExpiry.ts`): every **60 s**, `db.transaction(tx => market.closeExpired(tx, now, 100))` — `FOR UPDATE SKIP LOCKED` over `status = 'active' and expires_at <= now` (Drizzle `.for('update', { skipLocked: true })`), limit 100 per run; with a bid → transfer to the high bidder (money already escrowed — never re-checked) and pay the seller minus fee; without → creature back to the seller's box, `expired`. Loops until a run closes fewer than 100. Multi-process: every process runs the job; `SKIP LOCKED` makes concurrent runs partition the rows instead of colliding.
- Search: `ILIKE` on `species_id` (escaped), filters `variant_key`, `is_alpha`, `level between`, `sort ∈ { endingSoon, priceAsc, priceDesc, levelDesc, newest }`, `page`/`pageSize ≤ 50`. `bids[]` are never in list views; `GET /marketplace/:id` includes them.

### 30.8.3 Trades (room sub-state, atomic completion)

```ts
// packages/server/src/rooms/tradeSession.ts — verbatim
export const TRADE_IDLE_MS = 120_000;
export type TradePhase = 'requested' | 'open' | 'confirming' | 'complete' | 'cancelled';
export class TradeSession {
  readonly id: string; readonly a: string; readonly b: string;   // player uuids
  phase: TradePhase; offers: [TradeOffer, TradeOffer]; lastActivity: number;
  offerHash(): string;                    // protocol tradeOfferHash(offers): fnv1a32(canonicalJson of the two { playerId, creatureIds, money } sorted by playerId) as 8 hex — independent of seat order, confirmed excluded
  setOffer(playerId: string, creatureIds: readonly string[], money: number, now: number): 'ok' | 'notParty' | 'badPhase';   // clears BOTH confirmed flags
  confirm(playerId: string, hash: string, now: number): 'ok' | 'staleOffer' | 'badPhase' | 'notParty';
  bothConfirmed(): boolean;
}
```

Flow: `tradeRequest { targetId }` (same presence/AOI/12 m/not-busy checks as challenges; rate 3/5 s) → target `tradeUpdate phase 'requested'` → `tradeReply accept` → phase `open`, both get `tradeUpdate`; `tradeOffer { creatureIds ≤ 6, money ≥ 0 }` validated: every creature owned by the sender, in `party` or `box`, not `locked`, and the sender keeps ≥ 1 party member after giving; `money ≤ current money`. Every offer change resets both `confirmed` to false and re-sends `tradeUpdate` with the new `offerHash`. `tradeConfirm { tradeId, offerHash }` must match the current hash (`staleOffer` otherwise). When both confirmed: **one transaction** — `moveToSlot(..., 'trade_escrow', i)` for every offered creature (asserts current owner + not locked + not in listing), then `historyRepo.completeTrade(tx, tradeId, a, b, now)` (spine §5.2: locks both players ascending uuid, asserts escrow, `addMoney` both ways — an insufficient balance at this instant → rollback → `tradeUpdate 'cancelled'` — `transferCreature` both ways with reason `'trade'`, two `trade_history` rows, audit), then `markSeen/markCaught` for received species and `tradeComplete` trainer exp ×2. <!-- reconciled 2026-09-18: uses the implemented completeTrade --> Then `tradeUpdate 'complete'` + `inventoryDelta` to both. `tradeCancel`, `onLeave`, entering a battle, or 120 s without activity → `'cancelled'`; nothing was moved before the final tx, so cancellation writes nothing. There is no partial trade.

---

## §30.9 LIVE-OPS

All schedules are UTC. "Day" = UTC calendar day; "week" = ISO week (Monday 00:00 UTC). A `liveOpsRollover` job runs every 60 s and re-derives the active set when the day/week key changes, then `presence.publish('ewa:liveops', { dayKey, weekKey })` so every room calls `spawns.setLiveOps(...)`.

### 30.9.1 Daily / weekly rewards

```ts
// packages/content/src/liveops.ts additions (data) — the shapes the server reads
export interface DailyMission { readonly id: string; readonly title: string; readonly metric: DailyMetric; readonly target: number; readonly reward: { readonly money: number; readonly items: Readonly<Record<string, number>> } }
export type DailyMetric = 'catches' | 'wildWins' | 'trainerWins' | 'pvpBattles' | 'newSpeciesSeen' | 'zonesVisited' | 'tradesCompleted';
export const DAILY_MISSIONS: readonly DailyMission[];      // 3 per day: rotating pick by fnv1a32(dayKey) % pool, no duplicates
export const WEEKLY_GOALS: readonly DailyMission[];         // exactly 3, fixed
export const LOGIN_STREAK: readonly { readonly day: number; readonly money: number; readonly items: Readonly<Record<string, number>> }[]; // 7 rows; day 7 repeats
```

Progress lives in `quest_progress` under synthetic quest ids `daily:<dayKey>` / `weekly:<weekKey>` (objective id = mission id), advanced by the same `ProgressRepo.advance` calls that advance quests (one code path). `POST /quests/claim { questId, objectiveId? }` (spine §4.7) grants the reward once (`claimed_at`): a `QuestDef` claim requires every objective `done` and grants `rewards` (money, items, creature to party or box, flag → `progressionDelta.flags`); a daily/weekly claim names the `objectiveId` (mission id) and grants that mission's reward. <!-- reconciled 2026-09-18: the route is in the spine table --> Daily login: on the first `POST /auth/login` or room join of a UTC day, `addTrainerExp(dailyLogin)` and the streak row for `min(streak, 7)` (streak stored as `story_flags` `streak:<n>` + `streak:last:<dayKey>` — no schema change). Rows older than 14 days are deleted by the rollover job.

### 30.9.2 Seasonal variant schedule, swarms, hotspots

- `WEEKDAY_VARIANT[weekday]` (content) → `LiveOpsMods.variantPool`; `null` → all four.
- `SEASONAL_EVENTS` with `startsAt <= now < endsAt` → for zones in `featuredZones`: `alphaBonus`/`variantBonus` added; `featuredSpecies` get `+0.025 variant / +0.01 alpha` when rolled (legacy constants, kept).
- `DAILY_SWARMS[weekday]` → `swarmSpecies` + `swarmWeightBoost` for that `zoneId` only. The 7 entries are keyed to real `ZoneId`s by `validate.ts`, so they fire.
- `RAID_HOTSPOTS`: each has `window { utcHour, minutes }`; at `utcHour:00` the zone's shard-0 room (elected by `presence.setex('ewa:raid:<hotspotId>:<dayKey>', roomId, 3600)` — first `setex` after a `get` miss wins; a `get`-then-`setex` race between two shards is resolved by re-reading and yielding when the value differs) opens a `RaidSession` at `(x, z)`; `minBadges` gates `raidJoin`. `raidJoin` requires being within 8 m of `(x, z)`.
- `explorationDirector.js` hotspots/roaming rares are **not** carried (their zone ids were retired).

### 30.9.3 Battle pass

`BATTLE_PASS` (content, 100 rows in the legacy shape: `level, label, rarity, money, items, creature, mythicalChoice`). `GET /battle-pass` returns `trainerExp`, `trainerLevel = trainerLevelFor(exp)`, `claimed` (rows in `battle_pass`), `mythicalChoice`, `rewards`. `POST /battle-pass/claim { level }`: `level <= trainerLevel`, no row yet; one tx: insert `battle_pass(player, level)`, `addMoney(money)`, `inventory.add(items)`, `creatures.insert(creature)` when present (box if party full), audit. Level 50: the row is inserted with `mythical_choice = null` and money granted; `POST /battle-pass/mythical-choice { species }` (`lumyth | noxmyth`) requires the level-50 row with `mythical_choice is null`, inserts the creature at level 50 with default moves, sets the column, `markSeen/markCaught`. Exactly one mythical per account, ever.

---

## §30.10 OBSERVABILITY

### 30.10.1 Logs

pino root `{ level: env.LOG_LEVEL, base: { pid, processId: matchMaker.processId } }`; `pino-pretty` transport only when `NODE_ENV === 'development'`. Every log line from a room carries `{ roomId, zoneId, shard }`; from REST `{ reqId, route, playerId? }`. Never logged: passwords, tokens, refresh tokens, emails (username only), chat text (only `length` and `censored: boolean`). Player-facing errors log at `info`; 5xx at `error` with a stack; kicks and adversarial rejections at `warn` with `{ playerId, reason, count }`.

### 30.10.2 Metrics

```ts
export interface RoomMetrics {
  readonly roomId: string; readonly zoneId: ZoneId; readonly shard: number;
  players: number; spawns: number; battles: number; raid: boolean;
  msgsInPerSec: number; msgsOutPerSec: number;          // counted in onMessage / client.send wrappers; broadcast counts N
  patchBytesPerSec: number;                             // from SchemaSerializer's encoded byte length per patch × patches/s
  tickMsP50: number; tickMsP99: number; tickOverruns: number;   // tick > 40 ms
  rejectedInputs: Readonly<Record<'staleSeq' | 'dtBudget' | 'speed' | 'unwalkable' | 'bounds' | 'inBattle', number>>;
  aoiAddsPerSec: number; aoiRemovesPerSec: number;
  battleFaults: number; unknownMessages: number; kicks: number;
}
export interface ProcessMetrics { rooms: RoomMetrics[]; rest: Record<string, { count: number; p50Ms: number; p99Ms: number; s4xx: number; s5xx: number }>; db: { txPerSec: number; txP99Ms: number; poolInUse: number }; presenceSize: number; heapMb: number }
```

Exposed at `GET /admin/metrics` (admin) as JSON and logged as one `info` line per room every 60 s. No Prometheus exporter in v1 (cut deliberately).

### 30.10.3 Netcode harness contract (`50-verification-budget.md` runs it; this file defines the assertion)

`tools/netcode-harness` spawns **N ∈ {50, 100, 200}** headless `@colyseus/sdk` clients into one `mire_route` room (shard 0, `ZONE_CAPACITY` raised to 200 for the run), each walking a random walk at 30 inputs/s within a 240 m square, for 60 s, and records per client: schema patch bytes/s, messages received/s, and the server's `RoomMetrics`. Assertions:

1. For every client, `neighbours_i` = the mean number of other players in its 3×3 over the run (from the client's own `state.players.size − 1`). Then `msgsOut/s ≤ N × (mean neighbours + 1) × 20 × 1.2` in aggregate, and per client `patchBytes/s ≤ (neighbours_i + spawns_i + 1) × 48 × 20 × 1.2` (48 bytes = upper bound of one `PlayerState` delta: 3 float32 + 2 bool + uint32 seq + field headers).
2. Fit `msgsOut/s` against N over the three runs: the exponent of the best-fit power law is **< 1.3** (never quadratic; the legacy relay measured `10·N·(N−1)`).
3. `tickMsP99 < 25 ms` at N = 200.
4. Zero `rejectedInputs.speed/unwalkable/bounds` (the bots move legally) and `staleSeq === 0`.
5. 200 clients joining within 5 s: every join succeeds (no `busy`), and `aoiAddsPerSec` returns below 50 within 10 s after the last join.

A run also flips 10 % of the bots to a cheating profile (dt inflation, 12 m/s) and asserts every cheating input is rejected and every honest bot's stats are unchanged (rejections are per-client; nothing degrades for others).

---

## §30.11 PRESERVED-FROM-LEGACY CHECKLIST

| Legacy behaviour | Where it lives now | Test |
|---|---|---|
| Presence keyed by playerId, multi-tab collapses to one avatar (`onlinePresence.js`) | `PresenceStore` + `ZoneRoom.onJoin` step 2 | `presenceStore.test.ts`: two enters → size 1, older room returned; stale leave ignored |
| Pure, unit-testable presence store | `PresenceStore` has no I/O; the presence-key mirror is a wrapper | same file; no Colyseus import in the module |
| Challenge handshake re-checks presence before creating the battle (`worldSocket.js` 45 s TTL store) | `ChallengeStore` + §30.4.5 step 3 | `challenge.test.ts`: accept after the challenger walked out of range → `unavailable`, no `BattleSession` created |
| `toPublic()` allow-list | `PlayerRepo.toPublic` (persist §5.3); the server never spreads a row into a response | persist test asserts exact key list; server test asserts `/players/:username` keys ⊆ that list |
| `escapeRegex` on every user string reaching a query | `escapeLike` + `ESCAPE '\'`; zero `RegExp(userInput)` in `@ewa/server` (eslint `no-restricted-syntax` on `NewExpression[callee.name='RegExp']` in `packages/server/src/rest/**`) | `market.search('%_\\')` returns only literal matches |
| Chat filter with leet normalisation and whole-word patterns | `chat/blocklist.ts` data + `chat/filter.ts` | `filter.test.ts` (the two cases in §30.6.5 plus a soft-censor length check) |
| Rate limits per socket for map/battle events (`socketRateLimit.js`) | `LIMITS` table + per-client `RateLimiterState` | `rateLimit.test.ts`: 5th chat in 4 s → false; one `rateLimited` error per window |
| Raid 20 s rounds, shared boss HP, damage board, catch window (`raidSocket.js`) | `RaidSession` constants | `raid.test.ts`: two participants, deterministic boss HP after round 1 given the seed |
| Marketplace TTL expiry job returning unsold creatures (`marketplaceExpiry.js`) | `jobs/marketExpiry.ts` at 60 s over `closeExpired` | persist concurrency test (20 tx, one winner) + job test (expired-with-bid → transfer, expired-without → box) |
| Battle history with enough data to replay | `battle_history.start + seed + actions + final_digest` written at `battleEnd` (spine §5.1, migration 0001) | replay test: `createBattle({ id, format, seed, ...start })` + recorded actions reproduces `final_digest` from the row alone |

Not preserved, on purpose: client-side badge awards laundered through `gymwin_<id>` flags (badges are §30.4.4 league-win-only, server tx), the `/map` relay fanout, `sanitizeMapPosition` fade-to-black zone changes, fat-document `VersionError` retry wrappers, `Math.random` anywhere in spawn or battle code.

---

## NON-NEGOTIABLES (this file)

1. Every persisted change caused by a battle happens in **one** transaction after `resolveTurn` and before any `battleEvents` is sent; a failed transaction leaves `session.state` unchanged.
2. `validateAction` runs on every `battleAction` before `resolveTurn`; a `resolveTurn` throw is a server fault that voids the battle with no rewards, never a client-visible crash.
3. Movement is accepted only through `validateInput`; rejection never moves the avatar and always echoes `seq`.
4. AOI is exactly the spine's `StateView` rule: 32-unit cells, 3×3, `players` and `spawns` only; chat rides the same neighbourhood; nothing per-player is ever `broadcast`.
5. The position row is written by the destination room on `handoverAck`, once per crossing; a handover option without a matching presence reservation is refused; a join without the server's ticket is refused, and `/zone/enter` seats a player only in their current zone.
6. Badges are written by `awardBadge` from a league win inside the battle transaction and nowhere else.
7. Every cross-player creature or money movement (trade, buy-now, expiry, bid escrow) is one transaction with `FOR UPDATE` in ascending uuid order; the expiry job uses `SKIP LOCKED`.
8. Passwords: argon2id `m=19456 t=2 p=1`; tokens: HS256 access 15 min with `iss/aud`, opaque rotating refresh 30 d stored hashed; refresh reuse revokes the family.
9. No user string reaches `LIKE`/`ILIKE` without `escapeLike`; no `RegExp` is built from user input.
10. Rate limits are the `LIMITS` table; one `rateLimited` error per window; over-limit messages are dropped, never queued.
11. The champion id checked anywhere in server code is the literal `'zeon'`.
12. `SpawnDirector`, `AoiGrid`, `PresenceStore`, `ChallengeStore`, `validateInput`, `RateLimiter` and the chat filter are pure modules with no Colyseus, DB or clock import, each with its own vitest file.

## CUT DELIBERATELY (this file)

- **Colyseus `defineInput`/`setFixedTimestep` input buffers and `Rewind` lag compensation.** A turn-based game with walking does not need rollback; the zod-validated `input` message plus the dt budget is the whole real-time surface.
- **Server-side interest management beyond the 3×3 grid** (distance-weighted priority, `StateView.subscribe` streaming). The harness numbers at 200 players do not require it.
- **Guild/party co-location across shards, cross-shard chat, shard migration.** Shard 0 preference is the only placement rule.
- **Friend gifts, guild bank, guild chat, guild wars, weekly cups with party rules, mastery chains, profile cosmetics grid** (legacy `liveOps.js`). Titles/motto/body remain; the rest is not v1.
- **Legacy exploration hotspots / roaming rares** — retired zone ids; the story bible supplies `LEGENDARY_STATICS` instead.
- **Blackout money penalty on loss.** The walk back is the cost.
- **PvP spectating, ranked seasons.** (League rematches landed in Phase D14, §30.4.4 — amended 2026-10-06; the ranked queue in D13, §30.4.5a; the arena queues, invites and training on 2026-10-11, §30.4.10.)
- **Prometheus/OpenTelemetry exporters.** JSON metrics at `/admin/metrics` and pino lines.
- **`@fastify/rate-limit`.** Not installed; the pure `LIMITS` module is cluster-aware through `Presence` when Redis is present.
- **Team preview hiding in PvP resync.** The full `BattleState` is sent to both seats (decided, spine §4.5).

## TICK BUDGET (per `ZoneRoom` tick, 50 ms wall, N = 200 players, 14 spawns, 20 concurrent battles)

| Step | Target | Ceiling |
|---|---|---|
| Input application (amortised over the tick: ≤ 200 × 30 / 20 = 300 inputs) | 3.0 ms | 6 ms |
| AOI pass (cell diffs + `view.add/remove`) | 1.5 ms | 4 ms |
| Spawn director | 0.1 ms | 0.5 ms |
| Battles: `resolveTurn` calls this tick (≤ 20, each ≤ 0.2 ms pure) | 2.0 ms | 4 ms |
| Battles: persistence (awaited, off the tick's critical path; ≤ 20 tx in flight) | — | p99 tx 25 ms |
| Handover / trades / challenges sweeps | 0.2 ms | 1 ms |
| Schema patch encode + send (Colyseus, after the tick) | 4.0 ms | 8 ms |
| **Total on the loop thread** | **≈ 11 ms** | **25 ms (p99, asserted by the harness)** |

## OPEN QUESTIONS FOR THE RECONCILER — RESOLVED 2026-09-18

<!-- reconciled 2026-09-18: each answered in the spine or here; the list stays as the audit trail -->
1. `handover.seat` → **widened** to `SeatReservation` in spine §4.4; §30.2.7 step 4 sends the object.
2. `chat`/`dm` → **added** as spine §4.4 variants; §30.6.5 and §30.7.2 use them; the `toast` fallback is gone. A `storyBeat` variant was added for §30.4.8.
3. `GET /me.presence` **and** `POST /zone/enter` → both in spine §4.7; §30.2.6 and §30.6.3 reference them.
4. `ZoneDef.spawn` → **added** (spine §3.1), plus `warps` for the `warp` interact kind.
5. Guild tag → spine regex is now **`{3,4}`**.
6. PvP `battleResync` full party → **accepted for v1**, stated in spine §4.5.
7. Heightfield → the block **moved to spine §3.11** (with `water`); `20-client.md` §20.4.4 passes `getHeightfield(zone.id)` through as `spec.heightfield`; `10-render.md` §10.6.1 mirrors it as `HeightfieldData` and its `TerrainCollider` is asserted equal to content's samplers (`collider.test.ts`) — render solves movement against it but never defines the data.
