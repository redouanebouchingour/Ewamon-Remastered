# @ewa/server — implementation notes (part 1)

Binding spec: `.design/SPEC.md` §30 (+ §3.11, §4, §5.2/§5.5, §50.4.5). The spec was not edited. Every
deviation below is either forced by the installed libraries (verified against their `.d.ts` / source under
`node_modules`) or resolves something the spec leaves open. Items are referenced from code as `R<n>` (room /
process), `S<n>` (spec gaps) or `W<n>` (spawn director).

## Verified against the installed libraries

- **Colyseus 0.18.14** (`@colyseus/core/src/Room.ts`, `RoomMessages.ts`):
  - A validator passed to `onMessage(type, schema, cb)` that rejects a payload makes Colyseus
    `client.leave(4002)` — it does not reach `onUncaughtException`. The spec's "rejection answered with
    `error { code: 'invalidPayload' }`" is therefore implemented in the handler wrapper (**R1**, below).
  - A message whose type has no handler is **not** silently dropped: outside dev mode `#noHandler` calls
    `client.leave(4002)`. See **R3**.
  - `onDrop(client, code)` (not `onLeave`) is where `allowReconnection` belongs in 0.18: `_onLeave` routes a
    non-consented close to `onDrop` and calls `onLeave` itself when the reconnection fails.
  - `RoomOptions` is `{ state, metadata, client }`; auth/userData are typed through
    `Client<{ userData; auth }>` — the spec's `Room<{ state; metadata; auth; userData }>` is the pre-0.18
    shape. `ZoneRoom extends Room<{ state: ZoneState; metadata: ZoneMeta; client: ZoneClient }>`.
  - A room created by `matchMaker.createRoom` runs the instance `onAuth` again when the seat is consumed
    (`_onJoin` → `onAuth(client, joinOptions, authContext)`), with `authContext.token` = the SDK's
    `_authToken` query param (`@colyseus/ws-transport`).
  - Close codes 4001/4002/4003 are Colyseus' SERVER_SHUTDOWN / WITH_ERROR / FAILED_TO_RECONNECT; the SDK
    auto-reconnects only on 1001/1005/1006/4010, so reusing them as replaced / handover / kicked (protocol
    `CLOSE_CODES`) is safe for the client. The server never trusts the code alone (see R4 `handoverDone`).
  - `Server.gracefullyShutdown(exit = true)` calls `process.exit`; the constructor registers signal handlers
    unless `gracefullyShutdown: false`.
- **@colyseus/schema 5.0.32** `StateView.add` throws on a detached instance ("assign the instance to the
  state before calling view.add()"). See **R8**.
- **@fastify/jwt 10.2.2**: numeric `expiresIn` is seconds (converted to ms for fast-jwt); `jwt.verify` is
  synchronous and applies the plugin's `allowedIss/allowedAud/algorithms`.
- **@node-rs/argon2 2.2.1**: `Algorithm` is an ambient `const enum` — not usable under `isolatedModules`;
  `ARGON2.algorithm` is the literal `2` (= `Argon2id`) cast to the enum type.
- **@pm2/io** (pulled in by `@colyseus/core` Stats) calls `process.send` when it exists; the vitest forks
  pool's channel chokes on it. `test/helpers.ts` drops `axm:*` messages only.

## Deviations

- **R1 — zod validation in the wrapper.** Every `CLIENT_MESSAGES` type is registered with
  `onMessage(type, handler)` (no schema argument); the handler rate-limits, `safeParse`s with the protocol
  schema, and answers `error { code: 'invalidPayload' }` on failure. Same schemas, same "no handler runs on a
  malformed payload" guarantee, without Colyseus disconnecting the client.
- **R2 — server-only join tickets.** Colyseus' own `/matchmake/*` HTTP routes would let any authenticated
  client create shards or join rooms directly, skipping `/zone/enter`. Every seat the server reserves carries
  `ticket` (a per-process random secret) in its join options; `onCreate` and `onAuth` refuse options without
  it. Seat options never reach the client (`ISeatReservation` has none). Consequence: `/zone/enter` and the
  handover are the only ways in. `/zone/enter` additionally answers 409 `wrongZone` unless `zoneId` is the
  player's persisted zone or live presence zone — crossings are handovers; without this a client could
  "fast travel" by entering any ungated zone (the spec's onJoin step 3 would place it at the spawn).
- **R3 — unknown message types.** A `'*'` handler exists but only counts (`metrics.unknownMessages`) and kicks
  with 4003 at 5 within 10 s, sending no reply — the behaviour §4.3/§30.5.1 #1 describe. Without it Colyseus
  disconnects on the first unknown type (see above). The spec's "No '*' handler exists" is the one sentence
  not followed.
- **R4 — `ZoneUserData` additions:** `flags`, `badges`, `inventory` (caches the spec's §30.4.8 / §30.2.7
  already assume), `handover` / `arrival` / `handoverCooldownUntil`, `replaced`, `handoverDone`, `moved`,
  `rejects`, `unknown`. `ZoneAuth.ip` carries the socket IP for the per-IP socket count.
- **R5 — gym marker.** Content has no coordinate for a gym door. The server fixes `LEAGUE_MARKER = (0, −26)`
  (the plaza ring's north side) in every town with a gym and in `solenne` (Wardens / Champion), checked at
  4 m. **Open question for the client/render agents:** place the gym door there, or add `ZoneDef.gymAt` to
  content and point `rooms/interactables.ts` at it.
- **R6 — link directions:** `n = −z`, `s = +z`, `e = +x`, `w = −x`. The render/client adapter must agree.
- **R7 — handover trigger line** is 6 m inside the **playable** edge (`playableBounds`), not the field edge:
  the 16 m margin is unwalkable, so the field edge is unreachable. Entry point = 6.5 m inside the
  destination's playable edge, same lateral coordinate, snapped. A fresh arrival has a 3 s trigger cooldown.
- **R8 — spawn insertion order:** `state.spawns.set(id, spawn)` precedes `view.add` (schema 5 refuses detached
  adds); invisible to everyone until `view.add` because `spawns` is `@view()`-tagged.
- **R9 — boot order:** the REST app is built (`ready()`, not listening) before the Colyseus server so rooms
  verify access tokens with the REST instance's `@fastify/jwt` verifier. Listening order is the spec's (WS,
  then REST). The `colyseus` bundle (Redis presence/driver) is imported lazily, only when `REDIS_URL` is set.
- **R10 — signals:** `gracefullyShutdown: false` on the Colyseus `Server`; `main.ts` handles SIGINT/SIGTERM
  (`stop()` = jobs → REST close → Colyseus graceful shutdown → DB close → exit).
- **R11 — join-time AOI pass:** `onJoin` registers the viewer and places the avatar in the grid immediately
  (the spec defers it to the first tick). A `chat`/`interact` arriving before the first tick would otherwise
  find no cell and no audience (observed as a flaky test).
- **S1 — reconnection:** `onDrop` calls `allowReconnection(client, 20)` except for replaced / kicked /
  handover-complete clients; the avatar is removed in `onLeave` only when the leaving session still owns it
  (a per-player owner map), so a timed-out reconnection cannot remove an avatar a newer tab took over.
- **S2 — position write on leave** is skipped when a handover moved the player (presence entry now in another
  room, or `handoverDone`), whatever close code the client used (the SDK's `leave(true)` sends 4000).
- **S3 — movement rule order:** `bounds` is checked before `unwalkable` (spec lists them 6/5). The margin is
  `walkable = 0`, so with the spec order `bounds` could never be observed; the accept set is identical.
  Rejections other than `staleSeq` also advance `userData.lastSeq` (no replay of a rejected seq).
  Water-only samples are standable with `HM Surf` in the inventory cache (§30.3).
- **S4 — battle persistence failures:** a `resolveTurn` throw voids the battle (`battleEnd { draw }`, no
  rewards). A failed transaction keeps `before`, clears `pending`, sends `error { internal, 'turnRejected' }`
  and reopens the turn; two consecutive failures void the battle (a deterministic failure must not loop).
- **S5 — item/orb balance at validate time:** core does not know inventories, so `battleAction` also checks
  the per-battle inventory snapshot (refreshed after every committed turn) and answers `notAllowed 'noItem' /
  'noOrb'`; the spend itself is `inventory.add(-1)` inside the turn transaction (a negative result throws and
  the turn is rejected — never duplicated).
- **S6 — `/creature/:id/setup` held items:** equipping takes one from the inventory and returns the
  previously held item (the spec leaves the economy of held items open).
- **S7 — PvP disconnect forfeit** is resolved through core (`forfeit` action; a replacement phase gets an
  auto-switch first). Wild/trainer/league disconnects end with no rewards; the spawn is freed only before
  turn 1 resolves (`playerLeft`), otherwise despawned.
- **S8 — `PlayerState.moving`** is cleared 250 ms after the last accepted input (tick step 3), so remote
  avatars stop their walk cycle when a client stops sending; the spec only sets it on accepted inputs.
- **S9 — `tsx` needs `tsconfig.dev.json`.** tsx applies a tsconfig only to files its `include` matches, so with
  `tsconfig.json` (`src/**` only) protocol's schema classes were compiled with TC39 decorators and crashed at
  import. `dev`/`start` pass `--tsconfig tsconfig.dev.json` (covers every workspace source, legacy decorators,
  `useDefineForClassFields: false`). vitest is unaffected (esbuild reads the nearest tsconfig per file).
- **S10 — battle replay:** `battle_history` stores `seed` + `actions` as specified, but not the initial parties,
  so a database-only replay (`createBattle(seed)` + actions, §30.11) is not possible without them. Spec gap;
  the in-process digest test (client preview vs server events over seeded battles) stands in for it.
- **W1 — spawn warm-up:** until a director first reaches `targetCount`, the respawn delay is skipped (one spawn
  per tick) so a fresh room is populated in < 1 s; afterwards the spec's 8–20 s cadence applies. The rng
  draw for the delay is consumed either way (sequence stays reproducible).
- **W2 — `SpawnDirector.tick(now, timeOfDay, players)`** takes the player positions (the ≥ 10 m clearance
  rule needs them) and additionally returns `freed` (engagements stalled past `engagedTimeoutMs`).

## Fixes in other packages (minimal, each with a test)

- `@ewa/persist` `createDb({ pgliteDir })` — PGlite persisted on disk, so `pnpm dev:server` works without
  Docker (`migrations.test.ts`).
- `@ewa/persist` `authRepo.ownerOf(tx, token)` — refresh-reuse detection needs the owner of an already-revoked
  token (§30.5.1 #24) (`players.test.ts`).
- `@ewa/persist` `progressRepo.flagSetAt(tx, id, flag)` — trainer rematch windows (§30.4.4 `rematchDays`).
- `@ewa/persist` `playerRepo.bannedIds(tx)` — the ban cache rebuild (§30.6.7); `playerRepo.setAdmin` — the
  dev-only `ADMIN_BOOTSTRAP_USERNAME` (§30.1.2).

## Part 2 seams (not implemented here, by scope)

Raids (`raid*` messages answer `error { notAllowed, 'unavailable' }`), trades (`trade*` likewise), social
(friends / DMs / guilds / presence mirror beyond the 90 s key), marketplace + expiry job, live-ops (daily /
weekly missions, login streak, swarms/seasonal → `SpawnDirector.setLiveOps`, raid hotspots), `/admin/stats`
and `/admin/players`, observability rates and the 60 s metrics line, `presenceRateLimiter` tuning, the chat
blocklist (`chat/blocklist.ts` is empty; `censor` is a pass-through), the netcode harness, `/leaderboard`
`mode=dex`, `/item/use` for repel / lure / escape rope, `POST /profile` → `ewa:profile` re-read.

## For the client / harness agents

- REST routes are mounted at the root (`/auth/register`, `/me`, …) exactly as protocol's `ROUTES` spell them.
  The Vite dev proxy `/api → :4000` must **strip** the `/api` prefix (`rewrite: (p) => p.replace(/^\/api/, '')`).
- Joining: `POST /zone/enter { zoneId }` → `{ seat }`; then `sdk.auth.token = access` and
  `sdk.consumeSeatReservation(seat, ZoneState)` against `ws://localhost:2567`. The room's `onAuth` reads the
  token from the SDK's `_authToken` query parameter. `zoneId` must be the player's current zone
  (`GET /me` → `presence.zoneId`); other zones answer 409 `wrongZone` (R2).
- Handover: on `handover { seat }` consume that seat (same token), wait for the destination state, send
  `handoverAck { roomId: dest.roomId, seat: dest.sessionId }` to the destination; the source closes you with
  4002 once the destination confirms.
- Server messages are sent as `client.send(msg.type, msg)` — the payload is the whole `ServerMessage` object
  (including `type`), so `parseServerMessage` works on it directly.
- `beforeUpgrade` refuses a 9th concurrent socket from one IP (429). The part-2 netcode harness (200 bots from
  127.0.0.1) needs `MAX_SOCKETS_PER_IP` raised or loopback exempted.

## Spec coverage (part 1)

| Section | State |
|---|---|
| §30.0 module layout | done for part-1 modules (`raidSession`, `tradeSession`, `liveops/*`, `jobs/marketExpiry` are part 2) |
| §30.1 process layout, env | done (R9/R10) |
| §30.2.1–30.2.2 ZoneRoom lifecycle | done (R1–R4, S1, S2) |
| §30.2.3–30.2.4 heightfield + movement | done (S3) |
| §30.2.5 AOI | done (R8) — real StateView/Encoder test + two-client integration |
| §30.2.6 capacity / sharding | done (R2); multi-process untested (no Redis here) |
| §30.2.7 handover | done (R6, R7) |
| §30.2.8 tick | done except step 8 (trades, part 2) and tick percentiles (part 2) |
| §30.3 spawn director | done (W1, W2); live-ops mods wiring is part 2 (`setLiveOps` exists) |
| §30.4.1–30.4.5 battles, formats, pvp handshake | done (S4, S5, S7); raid format is part 2 |
| §30.4.6 interacts | done (R5); `lore` / `healer` / `shop` are no-ops as specified |
| §30.4.7 raids | part 2 |
| §30.4.8 story beats | done |
| §30.5 authority matrix + §30.5.1 list | #1–#9, #10–#12, #13, #15–#19, #22 (repo), #23–#25 tested; #14 (raids), #20 (market), #21 (trades) are part 2 |
| §30.6.1–30.6.3 REST | auth, me, zone/enter, profile, quests/claim (QuestDef), party, creature, item/use, heal, dex, shop, battle-pass, history, players, leaderboard (rating/trainerLevel), admin ban/unban/metrics, health. Marketplace, friends, messages, guilds, admin stats/players, leaderboard dex: part 2 |
| §30.6.4 rate limits | done (room + REST); presence limiter tuning is part 2 |
| §30.6.5 chat filter | `sanitizeChat` done; blocklist part 2 |
| §30.6.6 string hygiene | usernames lowercased + equality; no user RegExp; LIKE users are part 2 routes |
| §30.6.7 bans | done (cache rebuilt every 30 s, admin route, onAuth + requireAuth checks, `ewa:kick`) |
| §30.7–§30.10 | part 2 (presence mirror key written; metrics counters kept) |
| §30.11 legacy checklist | presence, challenge re-check, toPublic, rate limits, chat sanitiser: tested; replay: S10 |

## Tests

`pnpm exec vitest run packages/server` — 9 files: `aoi` (real Encoder/StateView/Decoder), `movement`,
`spawn-director`, `stores` (challenge/presence/rate-limit/chat/env), `battle-room` (coordinator on PGlite),
`authority` (the adversarial suite, real server + SDK clients), `rest-auth` (fastify.inject), `zone-room`
(two-client integration), `world` (story beats, ground items, handover, gate push-back, pvp handshake).
