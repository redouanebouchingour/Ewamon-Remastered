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
