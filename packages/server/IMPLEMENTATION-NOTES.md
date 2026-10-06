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
- **R5 — gym marker.** *(Superseded by Phase A interiors, 2026-10-06: league trainers are challenged at their
  `interiorLeaders` spot inside their hall; the marker below is only the fallback for a league trainer with no hall.)*
  Content has no coordinate for a gym door. The server fixes `LEAGUE_MARKER = (0, −26)`
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
  Water-only samples are standable with `HM Surf` in the inventory cache (§30.3) — never lava (S11, part 3).
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

---

# Part 2

Binding spec unchanged (§30.2.8 step 8, §30.4.7, §30.5.1 #14/#20/#21, §30.6.3, §30.6.5, §30.7–§30.11, §50.4.5,
§50.5 M2/M4 server boxes). Items are referenced from code as `P<n>` (client-agent fixes), `Q<n>` (other part-2
deviations). This section is written incrementally; the coverage table at the end is the summary.

## Fixes found by the client agent

- **P1 — REST side effects return an `inventoryDelta`.** New protocol schema `InventoryDeltaBodySchema` (= the §4.4
  `inventoryDelta` message minus `type`). Responses extended *additively* (every spine field is still at the top
  level): `CreatureSetupRes = CreatureInstance & { inventoryDelta }` (`POST /creature/:id/setup`: absolute counts of
  the equipped and the returned held item, the creature in `creaturesUpdated`), `GuildCreateRes = GuildView &
  { inventoryDelta }` (`POST /guilds`: `money` after the 5 000 charge), `ListingMutationRes = ListingView &
  { inventoryDelta }` for `POST /marketplace/list` (the escrowed creature in `creaturesRemoved`), `/:id/bid`
  (`money` after escrow), `/:id/buy-now` (`money` + `creaturesAdded`) and `/:id/cancel` (the creature back in
  `creaturesAdded`). Bid / buy-now / cancel were included because they move money/creatures the same way.
- **P2 — `/me` dex + guild id: not added (spec gap recorded).** The spine §4.7 `GET /me` type is `PlayerProfile &
  { party, box, inventory, badges, flags, quests, battlePass, presence, unreadDm, friendRequests, liveOps }` — no dex
  field and no guild id, and `PlayerProfile` itself has no field list in the spine. Per instructions protocol was not
  extended. The client gets dex from `GET /dex` (seen/caught/variants/alpha — exactly the four Progression dex
  fields) and its guild tag from `GET /players/:ownUsername` (`guildTag`); there is no spine route for "my guild id".
  Suggested spine change: `GET /me` gains `guild: { id, tag, role } | null` and `dexCaughtCount`.
- **P3 — reload mid-battle.** `POST /zone/enter` no longer answers 409 `inBattle` for the zone the battle lives in:
  it reserves a seat in the battle's own room (`presence.roomId`, looked up with `matchMaker.getRoomById`), and
  `ZoneRoom.onJoin` sends `battleResync { battleId, state, stateDigest }` to a joining player who holds a live
  battle seat. Any other zone is still 409 `inBattle`. The rejoin works inside the 20 s reconnection window
  (after it, `onLeave` removes the player and the battle is forfeited/voided as before). Dropped clients leave
  `room.clients` before `onDrop` (0.18 `_onLeave`), so the owner map (S1) keeps the old socket's late `onLeave`
  from removing the avatar.
- **P4 — `CLOSE_CODES.replaced` is 4101** (protocol constant; was 4001 = Colyseus `SERVER_SHUTDOWN`). 4100–4199 is
  not used by Colyseus 0.18 (`CloseCode`: 1000/1001/1005/1006, 4000–4003, 4010) and the SDK does not auto-reconnect
  on it. The spec's §30.2.2 "`client.leave(4001)`" is the one sentence not followed. `handoverComplete` 4002 and
  `kicked` 4003 are unchanged (they coincide with Colyseus WITH_ERROR / FAILED_TO_RECONNECT, which the SDK also
  does not auto-reconnect on; the server never relies on the code alone).
- **P5 — loopback is exempt from the 8-sockets-per-IP cap outside production** (`socketCapApplies(env, ip)`:
  `127.0.0.0/8`, `::1`, `::ffff:127.*`). `NODE_ENV=production` never exempts anything.
- **P6 — DB-only battle replay.** persist migration `0001_battle_replay` adds `battle_history.start jsonb`
  (`BattleStartSnapshot { zoneId, terrain, sides }` — the `createBattle` input minus the seed, deep-copied before
  the call) and `battle_history.final_digest varchar(8)` (`digestBattleState` of the final state). Both nullable
  (rows written before the migration have neither). `fixes.test.ts` plays a wild battle through the room, then
  replays `createBattle({ id, format, seed, ...start })` + `resolveTurn` over `actions` from the row alone and
  matches the last `battleEvents.stateDigest` (= `final_digest`). S10 of part 1 is resolved.

## Chat, social, marketplace

- **Q1 — blocklist.** `chat/blocklist.ts` is the legacy `backend/src/utils/chatFilter.js` list transcribed verbatim
  from the legacy repository (`../Ewamon/ewamon/backend/src/utils/`): **19** entries, not the spec's "20" (the legacy
  file has 19; none were invented). `filter.ts` compiles one `\b l[\W_]*e[\W_]*t…\b` pattern per word at module load
  and matches over `normalizeLeet` (lowercase → `LEET_MAP` per char → `ph`→`f`). `censor` maps every normalised
  code unit back to its original span, so leet and `ph` forms are starred in the ORIGINAL string at their original
  length (legacy `censorText` replaced on the original text with the un-normalised pattern and missed them).
- **Q2 — presence mirror.** `rooms/presenceMirror.ts` wraps `PresenceStore` + Colyseus `Presence`: every
  enter/leave/setBattle/setTrade writes `ewa:presence:<id>` `{ roomId, zoneId, shard, battleId, tradeId }` (90 s,
  swept every 30 s). `GET /friends` and the DM push decision read it with `lookup()` (local first, then the key), so
  they are process-agnostic. `refuseInBattle` / `/zone/enter` still read the local store (single process; with
  Redis a room on another process would need `lookup` there too — noted, not needed for the harness or tests).
- **Q3 — DM push.** `POST /messages/:username` publishes `ewa:dm:<toId>` when `lookup(toId)` finds the recipient;
  the room holding the player subscribed that channel at join (unsubscribed on removal / dispose) and forwards the
  spine `dm` variant. `fromName` is the sender's `usr` claim (usernames never change). A user literally named `read`
  cannot be DM'd: `POST /messages/read` is the protocol's mark-read route (spec/protocol path collision, recorded).
- **Q4 — friends.** A reverse request accepts the pending row (persist decision, kept) instead of refusing "row in
  either direction". The 100-friend cap is checked for both players on request and on accept (409 `friendLimit`).
  Self → 409 `self`; unknown or banned target → 404.
- **Q5 — guilds.** Leave by a leader with members → 409 `leaderMustPromote` (pre-checked; persist's `Forbidden`
  would be 403). Promote: member → officer, officer → leader (caller becomes officer); promoting the leader → 409
  `alreadyLeader`. The last member's leave returns the deleted guild's view with `memberCount: 0`. Any guild change
  publishes `ewa:profile { playerId }`; the room re-reads `body` + guild tag into `PlayerState` (also on
  `POST /profile`, the part-1 seam). Kick/promote permission failures are persist `Forbidden` → 403.
- **Q6 — marketplace.** `POST /marketplace/list` is refused with 409 `inBattle` during a live battle (the party is
  projected there). Buy-now and job sales mark the buyer's dex (seen + caught with the variant/alpha) and grant
  `tradeComplete` trainer exp to buyer and seller, in the sale transaction. persist gained
  `marketRepo.closeExpiredDetailed` (what each closed listing became) — `closeExpired` is now a wrapper returning
  its length, so persist's own tests are unchanged. Every listing attempt counts against `LIMITS.listing` (the
  limiter runs before validation), rejected or not.
- **Q7 — market-concurrency.test.ts** runs on PGlite by default (single connection: the 20 transactions are
  serialised, asserting the serial outcome) and on real Postgres when `DATABASE_URL` is set (pool of 32, genuine
  `FOR UPDATE` contention / `SKIP LOCKED`). It never truncates: its expiry listings are created with a 2001 clock so
  nothing else is due at the job's `now`.

## Trades (§30.8.3, tick step 8)

- **Q8 — `rooms/tradeSession.ts`** = pure `TradeSession` (spec shape + `open`, `has`, `other`, `idle`, `toMessage`) and
  `TradeCoordinator` (the room's sessions; `TradeHost` interface, no Colyseus). The offer hash is protocol's
  `tradeOfferHash` (canonical `{ playerId, creatureIds, money }` pair **sorted by playerId**, `confirmed` excluded),
  not the spec's literal "[offers[0], offers[1]]" order: it is the one function the client already calls, and it
  makes the hash independent of seat order. Confirming never changes the hash.
- **Q9 — busy rules.** The requester is marked trading (`userData.tradeId`, presence `tradeId`) from its request;
  the target only from its accept (a pending request does not freeze the target — it can walk, battle, hand over).
  Accept re-checks every request condition (presence, AOI + 12 m, not in battle, target not in another trade) and
  voids the target's other pending requests. Entering a battle (`onBattleStart`), leaving (`removePlayer`),
  `tradeCancel`, `tradeReply { accept: false }` and 120 s without activity (tick step 8) → `cancelled`.
- **Q10 — completion transaction** (lock order §5.5): `players.lockMany([a, b])` first, then every offered creature in
  ascending uuid: owner / not locked / party-or-box re-asserted, `moveToSlot(…, 'trade_escrow', 'nextBox')`; then
  persist `completeTrade` (money both ways, `transferCreature` both ways into the receiver's box, two
  `trade_history` rows, audit); dex marks for received species; `tradeComplete` exp to both. Any failure (e.g. money
  spent between offer and confirm → `InsufficientFunds`) rolls back and both get `tradeUpdate cancelled`. After
  commit: `tradeUpdate complete`, then per player `inventoryDelta` (absolute money, `creaturesRemoved` = given,
  `creaturesAdded` = received rows) and `progressionDelta` (trainerExp/Level, dexSeen/dexCaught). An empty trade
  (both offers empty) cannot be confirmed (`notAllowed 'emptyTrade'`).
- Errors: unknown / foreign trade id → `notFound`; wrong phase → `notAllowed 'badPhase'`; offer validation →
  `notAllowed` with `notOwner | notTradable | locked | partyMinimum | insufficientFunds | duplicate | tooMany`;
  `tradeConfirm` with an old hash → `notAllowed 'staleOffer'`; a message during the completion tx → `busy`.

## Live-ops (§30.9)

- **Q11 — mission data lives in the server.** `DAILY_MISSIONS` (8-entry rotating pool, 3 picked per UTC day by
  fnv1a32(dayKey) with a coprime stride), `WEEKLY_GOALS` (3, fixed) and `LOGIN_STREAK` (7 rows) are spec'd as
  `packages/content/src/liveops.ts` additions, but content does not ship them and is not this agent's package; they
  are `packages/server/src/liveops/missions.ts` with the spec's shapes, adapted from legacy liveOps.js onto the
  spec's `DailyMetric` set (legacy rewards were items only; money was added). Move them to content verbatim later.
- **Progress** uses synthetic quest ids `daily:<dayKey>` / `weekly:<weekKey>` (objective = mission id) through the
  same `advanceQuests` call as QuestDefs ("one code path"). New `QuestEvent`s: `battle { format }` (every ended
  battle → `pvpBattles` for pvp), `seen { species }` (persist `markSeen` now returns whether the species was new →
  `newSpeciesSeen`; battle start lead, battle switch-ins, trade receipts), `trade` (→ `tradesCompleted`). `wildWins`
  = wild wins; `trainerWins` = trainer + league wins; `zonesVisited` = handover arrivals (counts arrivals, not
  distinct zones — no per-day visited list is stored). The handover ack now sends the touched quest progress.
- **Claims** `POST /quests/claim { questId: 'daily:<key>' | 'weekly:<key>', objectiveId }`: the mission must be in
  that key's set (404 otherwise, also when `objectiveId` is missing), done (409 `questIncomplete`) and unclaimed
  (409 `AlreadyClaimed`, persist `claimObjective` — a per-objective claim was added); grants money + items. Any key
  whose rows still exist may be claimed (a mission finished at 23:59 is claimable after midnight until pruned).
- **`GET /me`** lists today's `daily:` and this week's `weekly:` quest (progress for every mission, count 0 when
  untouched) with a loose `missions: [{ id, title, metric, target, reward, claimed }]`; `liveOps` (loose
  LiveOpsSummary) = `{ dayKey, weekKey, weekdayVariant, loginStreak, dailyMissions, weeklyGoals, swarm, events,
  raids }` (`raids[]` carries each hotspot's window and `open`).
- **Q13 — login streak.** `liveops/login.ts dailyLogin(tx, …)` locks the player, and when `streak:last:<today>` is
  absent: continues (`streak:last:<yesterday>` present) or resets the streak, rewrites the `streak:<n>` /
  `streak:last:<day>` story flags (spec: no schema change), grants `LOGIN_STREAK[min(n,7)]` + `dailyLogin` exp,
  audit `liveops.login`. Called from `POST /auth/login`, from the room join (only when the cached flags lack today's
  marker; the grant is pushed as `inventoryDelta` + `progressionDelta` + a toast) **and from `POST /auth/register`**
  (registration is the account's first login — day 1; otherwise every fresh account's first join would write
  asynchronously right after the join). A fresh account therefore starts with 3 100 money and 30 trainer exp;
  tests use `START_MONEY` / `START_EXP`. `/me.flags` includes the `streak:*` flags.
- **Q12 — seasonal featured species.** `liveOpsModsFor(zoneId, now)` (pure, `liveops/schedule.ts`): weekday
  variant pool, active `SEASONAL_EVENTS` for featured zones (bonuses summed), `DAILY_SWARMS[weekday]` for its zone.
  The legacy per-species `+0.025 variant / +0.01 alpha` needs the director to know the species at roll time, so
  `LiveOpsMods` gained an optional `featuredSpecies` (the spec's interface is otherwise verbatim); the roll adds
  the bonus to the same draws (draw count unchanged → seeded sequences unchanged).
- **Rollover** `liveops/rollover.ts` (60 s job started by boot): on a day/week key change → `ewa:liveops`, and
  synthetic rows older than 14 days are deleted (persist `pruneSyntheticQuests`). Rooms apply
  `liveOpsModsFor(zone, now)` at create and on every `ewa:liveops`.

## Raids (§30.4.7, §30.9.2 hotspots)

- **Q14 — `rooms/raidSession.ts`** = pure `RaidSession` (spec constants verbatim; `join/ready/action/tick/catchAttempt/
  leave/boss/toState`) + `RaidRunner` (the room's DB side, `RaidHost` interface, no Colyseus). Each participant holds a
  private `BattleState` (format `raid`, seed forked from the room rng at join); per round the boss battler (HP,
  stages, status) is copied in before each participant's `resolveTurn([action, null])` and read back after, in
  ascending playerId order. Rounds are two-phase — `prepareRound()` (pure, nothing mutated) → ONE transaction
  (participants locked ascending; changed creature rows, consumables, rewards) → `commitRound()` — so a failed
  transaction leaves every private state and the boss unchanged (`rejectRound` re-opens the round, `error internal
  'turnRejected'`), the battle pipeline's NON-NEGOTIABLE 1 applied to raids. Spec signature deviations:
  `action(...)` also returns `'notParticipant' | 'alreadySubmitted' | 'notFighting'`; `tick(now)` returns whether
  a timer transition happened (outbound messages are the runner's job); `catchAttempt` adds `'unknownOrb'`.
- **Q15 — boss PP.** The boss acts once per participant per round, so it would run out of PP (core's NPC choice then
  ends the private battle while the boss stands). The shared boss's PP is restored to ppMax on every copy-in.
  A client preview of a raid turn must apply the same rule. A private battle that ended while the boss stands makes
  its owner a spectator (defensive).
- **Enrage** (phase 2) is applied by the server after the participant turn that crosses `hpPct < 0.30`:
  `stages.atk += 2` once (clamped), events `abilityTrigger { detail: 'enraged' }` + `statStage { cause: 'ability' }`
  appended to every participant's round events. Phase numbering is `RaidState.phase` (0 lobby, 1 fight,
  2 enraged, 3 catch window, 4 over).
- **Lobby:** the fight starts when every present participant is ready, or after `RAID_LOBBY_MS` with ≥ 1 ready
  (unready participants are dropped at the start). A participant is frozen like a battle while fighting
  (`userData.battleId = raidId`, `PlayerState.inBattle`, presence battle → REST party mutations 409), and released
  at the catch window / when fainted out / on leave. `raidJoin` requires ≤ 8 m from the hotspot, no battle/trade,
  `minBadges`, ≤ 8 players, a standing party member.
- **Rewards / catch:** on the defeating round, every participant with damage > 0 gets `50 × bossLevel` money +
  `raidClear` trainer exp in that round's transaction; the client learns it through `inventoryDelta`,
  `progressionDelta` and **`battleEnd { battleId: raidId, outcome: { winner: 0 }, rewards }`** (the spine has no
  raid-end variant — the client must route a `battleEnd` whose battleId is the open raid's id to the raid UI).
  `raidCatch` (one per participant with damage > 0, #14 → `notAllowed 'already'`, no second orb): core's §2.15 via a
  catch-only `resolveTurn` on a copy of the private battle with the boss at H = 1 (its status kept); the orb is
  spent either way; a success inserts that participant's own full-HP copy (party or box), dex, catch exp, quests.
  The roll's events come back as a `raidEvents` message with the roll state's digest.
- **RaidState broadcast.** `state.raid` mirrors `toState()` once per tick, writing only changed fields;
  `roundEndsInMs` is rounded up to whole seconds so the countdown patches ≤ 1/s. Total raid patches are bounded by
  the 20 Hz patch rate regardless of N (asserted in `aoi-fanout.test.ts`).
- **Scheduling:** the shard-0 room checks its zone's `RAID_HOTSPOTS` once a second; when a window is open and not yet
  handled it runs the election (`presence.get('ewa:raid:<id>:<dayKey>')`, miss → `setex(roomId, 3600)` → re-read,
  yield when another room holds it) and opens the raid at `(x, z)`. A lobby still unstarted when the window ends
  closes (phase 4); a finished raid lingers 10 s, then `state.raid = null`. Raid ids other than the open raid's →
  `notFound` (like a foreign battle id).

## Observability (§30.10) and the netcode harness contract (§30.10.3)

- **Q16 — metrics.** `metrics.ts`: rooms keep raw counters; `rollRoomMetrics` turns them into per-second rates once
  a second and recomputes `tickMsP50/P99` over a 1 200-tick (60 s) ring; one `info` line per room every 60 s
  (`roomLogLine`: numbers only). Patch bytes are measured on the wire: `ZoneRoom.meterClient` wraps each client's
  `raw` send and counts frames whose protocol code (`byte0 & 0x1f`, modifier bits masked) is
  `Protocol.ROOM_STATE_PATCH` (15) — `patchBytesPerSec`, plus additions `patchFramesPerSec` and `framesOutPerSec`
  (patch frames + message frames); `room.traffic` keeps the same per client. REST: an `onResponse` hook records
  `METHOD /route` count / p50 / p99 / 4xx / 5xx (bounded 1 000-sample ring). DB: the runtime's `repos.db` is
  `timedDb(...)` (every server transaction timed; `poolInUse` from the pg pool, 0 on PGlite). `GET /admin/metrics`
  = `MetricsRegistry.snapshot()` (the spec's `ProcessMetrics`).
- **Q17 — netcode harness.** `netcode/harness.ts` is the pure §30.10.3 contract (`checkRun`, `checkScaling`,
  `powerLawExponent`, `quadraticModel`, exported from `@ewa/server`) for `tools/netcode-harness` (not in this
  package; not written here) and `aoi-fanout.test.ts`. "msgsOut/s" is read as **websocket frames the server sends**:
  with per-client StateViews a client gets one patch frame per tick however many neighbours changed, which is what
  is linear in N. The entity-level count (PlayerState updates) at a fixed field size grows with density, so its
  exponent is ≈ 1.8 by construction; it is bounded instead per client (≤ its view population × ticks + 10 %) and in
  total (≤ 0.3 × the quadratic model), both as §50.4.5 states.
- **aoi-fanout.test.ts deviations:** bots move 0.30 m per 45 ms running input (6.7 m/s) instead of the matrix's
  "1 unit per tick" (20 m/s is a `speed` reject under §30.2.4's 8.05 m/s cap); they bounce off unwalkable samples
  and a 14 m margin (no handover triggers). The 200-join assertion is < 15 s in-process (measured 4.7–5.4 s): the
  test server runs on single-connection PGlite with all 200 SDK clients in the same event loop; §30.10.3 #5's 5 s
  belongs to the harness against a Postgres-backed server. Bots are created in the DB with today's login already
  granted (so a join is not also a reward write). The raid broadcast is measured on a 20 s round clock (the lobby's
  90 s countdown sits at `RaidState.roundEndsInMs`'s uint16 clamp and would not change). The cheating-profile run
  of §30.10.3 is the harness tool's; the per-client movement authority (speed / dt budget / kick) stays covered by
  `movement.test.ts` + `authority.test.ts`.
- **Measured (10 s windows, this machine):**

  | N | PlayerState patches/s | quadratic 20·N·(N−1) | ratio | server frames/s | mean neighbours | patch B/s/client | tick p99 |
  |---|---|---|---|---|---|---|---|
  | 50 | 10 900 | 49 000 | 0.222 | 795 | 12.7 | 2 937 | 2.27 ms |
  | 100 | 41 703 | 198 000 | 0.211 | 1 586 | 25.4 | 5 532 | 2.76 ms |
  | 200 (+ live raid) | 126 244 | 796 000 | 0.159 | 3 189 | 49.0 | 8 691 | 6.25 ms |

  frames/s power-law exponent **1.002** (< 1.3); raid patches ≤ 1.0 /s per client at N = 200 (≤ 20 asserted);
  zero honest-bot rejections.

## Remaining §30.6.3 rows

- **Admin:** `GET /admin/stats` (loose `AdminStatsRes`: `total, banned, online` + `admins, rooms, battles, raids`),
  `GET /admin/players?q=&page=` (persist `players.search`: `username_lower ILIKE '%'||escapeLike(q)||'%' ESCAPE '\'`,
  q capped at 32 chars, page of 25, newest first). `/leaderboard?mode=dex` ranks by dex caught count; banned
  players are now excluded in SQL for every mode (pages stay full; part 1 filtered after paging).
- **Q18 — field items** (`/item/use`, part-1 seam): `repel` / `lure` (qty 1) spend one and publish
  `ewa:repel { playerId, kind, steps }`; the room holding the player keeps `userData.repel` (metres left, decremented
  by accepted movement, a toast when it wears off); a repel makes `engageSpawn` on a spawn below the party lead's
  level answer a toast + `error { notFound, 'repelled' }`. Lure is recorded only (the spec gives it no server
  effect; the client-side encounter filter reads its own state). This replaces the spec's presence key
  `ewa:repel:<playerId>` with a publish to the owning room (same reach, multi-process safe). `escape_rope` (qty 1,
  route zones only, 409 `notUsableHere` elsewhere or when not in a room — nothing spent) publishes `ewa:teleport`;
  the room snaps the avatar to `zone.spawn` (not during a battle) with a handover cooldown.

## Protocol / persist changes (part 2)

- **protocol** (additive, wire shapes widened only where a response had to carry state): `CLOSE_CODES.replaced`
  4001 → **4101** (P4); `InventoryDeltaBodySchema` / `InventoryDeltaBody`; `CreatureSetupRes`,
  `GuildCreateRes`, `ListingMutationRes` (P1) wired into `ROUTES.creatureSetup`, `guildCreate`, `marketplaceList`,
  `marketplaceBid`, `marketplaceBuyNow`, `marketplaceCancel`. Nothing else changed; protocol's own tests unchanged.
- **persist**: migration `0001_battle_replay` (`battle_history.start jsonb`, `battle_history.final_digest
  varchar(8)`, type `BattleStartSnapshot`); `playerRepo.byIds / search / counts`, `leaderboard(mode: 'rating' |
  'trainerLevel' | 'dex')` (banned excluded in SQL, rating ties by peak then username);
  `progressRepo.markSeen` returns `boolean` (was `void`), `claimObjective`, `pruneSyntheticQuests`;
  `marketRepo.closeExpiredDetailed` (+ `ClosedListing`), `closeExpired` delegates to it; `historyRepo.recordBattle`
  accepts optional `start` / `finalDigest`. `migrations.test.ts` counts journal entries instead of "1";
  `test/admin-replay.test.ts` covers the additions. `pnpm db:generate` → no schema changes.

## For the client (exact names)

- Close code **4101** = replaced by another tab/device (`CLOSE_CODES.replaced`); **4001** is now only Colyseus'
  `SERVER_SHUTDOWN` — `ConnectionOverlay` can drop the "…or the server restarted" dual copy for 4101 and treat
  4001 as a restart/reconnect case.
- `POST /creature/:id/setup` → `CreatureSetupRes` (the creature + `inventoryDelta`); `POST /guilds` →
  `GuildCreateRes` (+ `inventoryDelta.money`); `POST /marketplace/list | /:id/bid | /:id/buy-now | /:id/cancel` →
  `ListingMutationRes` (+ `inventoryDelta`: list → `creaturesRemoved: [creatureId]`, bid → `money`, buy-now →
  `money` + `creaturesAdded`, cancel → `creaturesAdded`). Apply `res.inventoryDelta` through the one
  `applyInventoryDelta` writer (shape = the `inventoryDelta` message minus `type`).
- Reload mid-battle: `POST /zone/enter` for the battle's zone now returns a seat in the battle's room; after
  joining, a `battleResync` arrives unprompted — rebuild the battle UI from it. Other zones stay 409 `inBattle`.
- `GET /me` still has no dex fields / guild id (P2 spec gap): use `GET /dex` and `GET /players/:ownUsername`
  (`guildTag`). `me.quests` now includes `daily:<dayKey>` and `weekly:<weekKey>` entries with a `missions[]` list;
  claim with `POST /quests/claim { questId, objectiveId: missionId }`. `me.liveOps` gained `dailyMissions`,
  `weeklyGoals`, `swarm`, `events`, `raids[]` (loose schema). `me.flags` contains `streak:<n>` /
  `streak:last:<day>` bookkeeping flags — ignore `streak:*` in story logic.
- Raids: `state.raid` (`RaidState`, phase 0–4, `hpPct` only); messages `raidJoin/raidReady/raidAction/raidCatch/
  raidLeave` with `raidId = state.raid.id`; `raidEvents` per round (and one for a catch roll); rewards arrive as
  **`battleEnd` with `battleId === state.raid.id`**. While fighting, `PlayerState.inBattle` is true and inputs are
  refused like a battle.
- Trades: `tradeUpdate` per change; send `tradeConfirm { tradeId, offerHash }` with the hash from the latest
  `tradeUpdate` (or `tradeOfferHash(offers)`); on completion both get `inventoryDelta` + `progressionDelta`.
- DMs arrive live as `dm`; `POST /messages/:username` refuses blocked words with 400 `blockedWord`, strangers
  409 `notFriends`. A fresh account starts at 3 100 money / 30 trainer exp (registration = login day 1).

## Spec coverage (part 2)

| Section | State |
|---|---|
| §30.2.8 tick | done — step 8 trades, step 7 raid half, step 10 percentiles + 60 s line |
| §30.4.7 raids | done (Q14, Q15); RaidState ≤ 1 patch/s measured |
| §30.5.1 #14 / #20 / #21 | done (`raid.test.ts`, `market-routes.test.ts` + `market-concurrency.test.ts`, `challenge-trade.test.ts`) |
| §30.6.3 routes | done: friends, messages, guilds, marketplace (+ expiry job), admin stats/players, leaderboard dex, field items (Q18) |
| §30.6.5 chat filter | done (legacy list, Q1) — DM hard reject, overworld soft censor |
| §30.7 social | done (Q2–Q5); presence distributed half = `PresenceMirror`; `refuseInBattle` still local-only (Q2) |
| §30.8.2 marketplace | done (Q6, Q7) |
| §30.8.3 trades | done (Q8–Q10) |
| §30.9 live-ops | done with data in the server (Q11–Q13); battle pass claim / mythical choice were part 1 (unchanged) |
| §30.10.1 logs | partly: per-room/REST child loggers existed; 60 s room line added; no new redaction work |
| §30.10.2 metrics | done (Q16) |
| §30.10.3 harness | contract done (Q17, `netcode/harness.ts`); `tools/netcode-harness` itself not written (outside this package) |
| §30.11 checklist | chat filter, raid, market expiry, DB-only replay now tested; presence/challenge/toPublic/rate limits from part 1 |
| §50.4.5 matrix | `aoi-fanout`, `challenge-trade`, `raid` added; `handover.test.ts` / `story-beats.test.ts` remain folded into `world.test.ts` (part 1) |
| §50.5 M2/M4 server boxes | aoi-fanout 50/100/200 ✓, challenge-trade ✓, raid ✓, guild routes in rest-auth ✓, market-concurrency ✓ on PGlite (Postgres run needs `DATABASE_URL`; not run here — Docker was not running) |

---

# Part 3 — authority follow-ups (SPEC amendments of 2026-09-25)

§30.4.8 rule 6, §30.5.1 #26–#28 and §50.4.5 A21–A24 (`.design/audits/spec-verification.md` L2-02/03/07/08/25).

- **R2, amended — `/matchmake/*` refused before any reservation (#26, A21).** `onCreate`/instance `onAuth` already
  refused options without the ticket, but Colyseus' `POST /matchmake/joinOrCreate|join|joinById` on a *live* room
  answered 200 with a seat: the refusal came only when the seat was consumed, and the dangling reservation counted
  against `maxClients` for its lifetime (a token holder could fill every shard and make the server open new ones).
  `refuseDirectMatchmaking(klass, ticket)` installs a **static** `onAuth` (the hook `callOnAuth` runs for every HTTP
  matchmaking call, before `createRoom`/`reserveSeatFor`) that throws `ServerError(403, 'noTicket')` without the
  ticket and otherwise returns `true` — which gives Colyseus no auth data, so the instance `onAuth` still runs on
  every seat consumption. Server-side reservations pass no auth context and never call it; `/matchmake/reconnect`
  does not call `onAuth`. It is installed right after `matchMaker.defineRoomType`, because registration logs
  "instance-level onAuth will be ignored" for a class that defines both hooks — false for this static.
- **#27 (A22)** `wrongZone` was already enforced (R2); **#28 (A23)** `inBattle` on `/marketplace/list` was already
  enforced (Q6). Both are now in `authority.test.ts`.
- **S12 — story trainers are fired by their beat only (§30.4.8 rule 6, A24).** `storyBeats.ts STORY_BATTLE_IDS`
  (every `StoryBeat.battle.trainerId`). An `interact` on such a TrainerDef: when the zone's next eligible beat's
  battle names it, that beat runs (`storyBeat start` + its battle, exactly as facing the speaker — the trainer stands
  beside the speaking NPC); otherwise it is a plain NPC: nothing over the wire (no battle, reward or
  `trainer:<id>:beaten`; before, it fell through to the plain trainer row and paid twice). The first half is this
  package's reading of rule 6's "when no eligible beat names it" — the spec does not say what happens when one does.
- **S11 — lava (L2-25).** Content's heightfield has one `water` mask (pond, sea, bog **and** lava; the client renders
  the cinder biome's water as lava). Open water is `walkable = 0` in content, so nobody *walks* on lava; but
  `standable()` let an HM Surf holder stand on any water-only sample, lava included (cinderhold 97 samples,
  ash_route 350). `movement.ts LAVA_BIOMES = {cinder}` / `isLava(h, x, z)` (per zone — the field has no per-sample
  water kind): a surfer is refused lava with `unwalkable`; the boardwalk strip over a lava pond stays walkable
  (content marks it walkable and render draws a pier there, so prediction and truth agree). `SpawnDirector` refuses
  lava for `medium: 'water'` spawns (no draw added: seeded sequences unchanged; no cinder table has water slots
  today). No content change, no heightfield digest change. The SPEC's R10 (a per-sample lava mask in content) would
  replace the per-zone rule.

Tests: `authority.test.ts` A21 (7 direct matchmaking calls, incl. a forged ticket and `joinById` on the live room →
403 `noTicket`; room list, client count and state unchanged; the same player still enters via REST), A22 (offline and
while connected), A23 (second party member, so only the battle can refuse it), A24 (+ the positive control: with
`met_wynn` the same interact fires `mire_rival`); `movement.test.ts` lava in cinderhold / ash_route;
`spawn-director.test.ts` a water-only table in ash_route places nothing. Each was checked against a mutant (fix
removed → the test fails).

---

# Part 4 — the Act I slice loop (SPEC §50.5 M2: "Act I opening plays from STORY", "one clears Grove-Keeper Mira")

- **S13 — the gym's story gate (story-bible §6.1 / §5.4 / §11.1).** The bible says content gates the `verdant_gym`
  interaction on `saw_thinning` (set by `grove_stone`, the gym's own pre-fight beat) so Mira's stone scene precedes
  the fight; neither content nor `leagueRefusal` carried it, so a fresh account could fight (and badge) Mira before
  meeting Wynn or Sable. Content now exports `LEAGUE_STORY_GATES` (`{ verdant_gym: 'saw_thinning' }`, only the gate
  the bible names; `validate.ts` checks each flag is set by a beat that league id speaks in its town) and
  `leagueStoryGate(id)`; `ZoneRoom.leagueRefusal` refuses with the toast "Mira Thornwell is not taking challengers
  yet." + `error { notAllowed, 'leagueLocked' }`. Beats still run first (§30.4.8 step 1), so the chain is
  wynn → sable (beat battle) → the gym door plays `grove_stone` → the next interact is the league battle →
  `bloom_after` after the badge. "You already hold this badge." is checked before the gate (a badge holder is never
  told the gym is closed).
- **S14 — a failed pvp start tells both players, naming the side (client part 2 finding 1).** `startPvp` failures
  carry the `playerId` whose party / battle stopped them; `onChallengeReply` sends
  `challengeResult { result: 'unavailable', reason: { code: 'noUsableParty' | 'inBattle', playerId } }` to the
  accepter **and** the challenger. The step-3 re-check (§30.4.5: accepter only, spec kept) now also carries a
  reason (`expired`, `left`, `inBattle`, `trading`, `tooFar` — `tooFar` names the challenger). `reason` is an
  optional protocol field (older clients ignore it).
- **S15 — `inventoryDelta.placement` (client part 2 finding 2).** Optional, additive
  `placement: Record<creatureId, 'party' | 'box'>` on the wire message (and so on `InventoryDeltaBody`): a battle
  catch and a raid catch report the slot they were inserted in, a trade and marketplace buy-now / cancel report
  `box` (persist moves those into the box). A delta without it is placed by the client's old catch rule.

Tests: `story-beats.test.ts` (new, §50.4.5 M2 row): the chain end to end through the room (wynn → gym refused
before its beat, nothing written → `sable_mire` via the story trainer, its content team, won: flags + 300 money,
then a plain NPC → `grove_stone` at the door → the league battle with Mira's `LEAGUE` team verbatim, won: badge via
`progressionDelta`, `badges` row, reward, gymWin → `bloom_after` → "already hold this badge", nothing written);
forged gym interacts (out of range / another town's gym / unknown id) write nothing; the loss path (no badge, no
money, flags unchanged, the fight offered again after `POST /heal`). `challenge-trade.test.ts`: a pvp start refused
for a fainted party reaches both players with `reason.playerId` = the fainted side (accepter and challenger cases),
nothing persisted; the expired accept carries `reason.code 'expired'`; the trade delta's `placement` is `box`.
`battle-room.test.ts` (catch → `placement party`), `market-routes.test.ts` (buy-now → `placement box`).

# Part 5 — footprints are in the heightfield (audit R1, 2026-09-30)

Content's `getHeightfield` now stamps the zone plan's footprints (buildings, solid set-piece cores, props incl. fence
runs, lamp posts, tree trunks, big rocks) into `walkable` (packages/content IMPLEMENTATION-NOTES, R1). No server code
changed: `validateInput` and the `SpawnDirector` already sample only the heightfield. `test/footprints.test.ts` pins
it: a step from every town building's door step through its door is `unwalkable`; no sample inside any building wall
is walkable; no footprint covers a water sample (a surfer cannot stand in one either); 15 zones × about 1 000–4 000
spawn rolls each never place a spawn whose sample is inside a footprint or inside a house; every npc / trainer / item
/ lore / warp end is walkable. One authored point moved: solenne's spawn (−50, 0) sits in a lamp post's footprint and
the room's existing `nearestWalkable` snap places players 0.5 m away at (−50, 0.5). `movement.test.ts`'s thin-wall
case, vacuous before (mire_route had no thin wall), now runs against a fence / post and got a `dtMs` inside the speed
cap.

# Phase A interiors (2026-10-06)

Every town building opens into a pocket hall in the zone's own outer band (content `interiors.ts` /
`interiorIndex.ts`). Walls and screens are stamped `walkable = 0`, so movement validation refuses them unchanged.

- **Interact targets** (`rooms/interactables.ts`): `warp` = `zone.warps ∪ interiorWarps`; `npc` also resolves hall
  trainers (`interiorTrainers`, plain `TrainerDef`s → `kind: 'trainer'`, flag `trainer:<id>:beaten`, no rematch);
  `item` also resolves `interiorItems` (same `item:<zone>:<id>` flag); `gym` is checked at the leader's own
  `interiorLeaders` x/z (4 m) — `LEAGUE_MARKER` is only the fallback for a league trainer without a hall (supersedes
  R5); new `switch` kind from `interiorSwitches`. Interior NPCs (shopkeepers, residents) are client-local and never
  resolve.
- **Battle position** (`ZoneRoom.battleAt`): `interiorArenaFor(zone, x, z) ?? player position`, used for every
  `startNpc` / `startStatic` (story-beat battles included) and for pvp (the midpoint). Wild battles keep the player
  position (spawns never stand in a pocket). `BattleSession.yaw` (new, `null` outside a hall) and `battleStart` now
  carry `x`, `z`, `yaw` for every sender (npc, static, wild, pvp all go through `open`).
- **Switches** (`case 'switch'`): every `requires` flag held, else toast + `error notAllowed 'switchLocked'`; a
  non-null `sets` not yet held is written in one transaction (`progress.setFlags`), applied, and sent as
  `progressionOnly({ flags })`; a `warpTo` teleports through the same snap as warps (`ZoneRoom.teleport`) — also when
  the flag is already held.
- **Per-player gates**: `ZoneUserData.closedGates` (the `.solid`s of `gatesClosedFor(zone, flags)`; the shared empty
  `NO_GATES` in zones without gates) is passed to `validateInput` as `MovePrev.closedGates`; `standable` /
  `segmentStandable` refuse a sample inside one. It is computed on join (handover arrivals join through the same path)
  and recomputed by `applyFlags` only when a flag is new and some gate is still shut. `applyFlags` is now the only
  writer of `ud.flags` after join: the battle-end badge path (`onProgress` → `badge:<id>`) was writing the set
  directly and now goes through it; battle-end flags (`trainer:<id>:beaten`, `elite:*:beaten`) already did.
- **Spawn director**: a roll inside a pocket footprint (`interiorFootprintAt`) is skipped like an unwalkable one (no
  extra draw, seeded sequences outside pockets unchanged).
- **League order** is unchanged (`leagueRefusal`); the Wardens are now fought at their chambers of `solenne.league`,
  each chamber gate opening on the previous Warden's `elite:*:beaten`.
- **Tests**: `test/interiors.test.ts` (10 tests: pure gate validation; spawn rolls never in a pocket; door warps both
  ways + a hall wall refused; a gate refused → opened by a trainer win → for that player only → open on join from a
  stored flag; Mira at the hall arena with `battleStart` x/z/yaw and nothing at the old door marker; an open-world
  battle keeps the position and `yaw: null`; switch `requires` / `sets` once / `warpTo` incl. with the flag held;
  Solenne Wardens in order with the c1 gate opened by the Veil win; a full Mirevale walk with real inputs → badge).
  `story-beats.test.ts` now challenges Mira 2.5 m in front of her in the hall (was the (0, −23.5) door marker); the
  forged-interact "too far" cases (story-beats, authority A6) stand 26 m away inside the hall (the old spot is outside the AOI now → notFound).
  `footprints.test.ts`'s spawn check uses the STAMPED solids (content drops scatter solids overlapping a pocket from
  the stamp, `interiorPlan.droppedSolids`) and also asserts no spawn in a pocket.
- **Open (content/render)**: a dropped scatter solid is dropped when its circle merely OVERLAPS a pocket footprint,
  so a tree/rock whose centre is outside the footprint (e.g. skyrend `tree@41.82,53.71` between house2 and house3)
  loses its walk block while — unless render also filters `droppedSolids` — it may still be drawn.

## Phase B1–B3 (quest objectives)

- **`restoreZone`**: `completeBeatInTx` adds a `{ kind: 'restoreZone', zoneId }` quest event beside the `flags` event
  when `beat.harvest?.to === 'intact'` (both the plain-beat path in ZoneRoom and the battle-beat path in
  battleSession go through it). Today that is `restore_the_grove` (mire_route) → q10 `restore`, and `solenne`'s restore beat.
- **`deliverItem`**: `ZoneRoom.onInteract` `case 'npc'` runs one transaction: `deliveriesFor(npcId)` lists the open
  `deliverItem` objectives of active quests naming that npc; for each, the bag is read from the DB (`inventory.qty`,
  not the cached `ud.inventory`, which REST purchases do not update); with `qty` or more the items are spent
  (`inventory.add(-qty)`) and a `{ kind: 'deliver', npcId, item, qty }` event joins the `talkTo` event in the same
  `advanceQuests` call. Then `inventoryDelta` (new quantities) + `progressionDelta.questProgress`. Short of items:
  nothing is spent and the player gets an info toast `Bring <qty> × <item name> to deliver.` (deviation: the spec named
  no feedback). A story beat whose speaker is the npc still runs first (no delivery that interact).
- No route change: `POST /quests/claim` (all objectives done, grants money / items / creature / flag once, 409
  `questIncomplete` / `AlreadyClaimed`) already existed in `rest/routes/me.ts`.
- **Tests**: new `test/quests.test.ts` (5: restoreZone only for its zone and only while q10 is active; `deliveriesFor`
  only while q08 is active; short → toast + nothing spent; enough → spent in the same tx with `inventoryDelta` +
  `questProgress`, once; no q08 → items kept; claim 409 until all done, then once). `story-beats.test.ts` + 1
  (`restore_the_grove` advances q10 `restore`, a beat without harvest does not).
