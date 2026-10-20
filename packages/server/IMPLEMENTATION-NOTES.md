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

# Phase B progression walker (B5 + B6, 2026-10-06)

The §50.5 M3 walk — one headless account plays Acts I–III through the real server — restored from the WIP commit
`a6606df` (`test/walker.ts`, `test/pathing.ts`, `test/progression.ts`, `test/progression-act{1,2,3a,3b,3c}.test.ts`)
and taught the Phase A interiors.

- **Own vitest project.** `vitest.progression.config.ts` (root) runs `packages/server/test/progression-*.test.ts`
  one file at a time in file-name order (a `BaseSequencer` subclass), with the default config's aliases; root script
  `pnpm test:progression [leg]`. The default `vitest.config.ts` excludes those files, so `pnpm test` stays fast.
  `EWA_PROGRESSION_WRITE=1` rewrites a leg's end fixture (`test/fixtures/progression/<leg>.json`); without it the leg
  compares its end signature (zone, badges, story flags) with the committed one. Each leg starts from the previous
  leg's fixture. `EWA_WALK_LOG=<file>` streams a live trace.
- **Halls.** `Walker.walk()` leaves the hall it stands in when the goal lies elsewhere (through `<id>.out`, taking a
  warp tile first when the exit is beyond a sealed wall) and enters a goal's hall through its door warp (`<id>.in`).
  `Walker.reachLeader(id)` (used by `goTo('gym', …)`, so `winLeague`, `expectLocked` and league-speaker beats) walks
  to where the trainer stands for this player (`leaderSpot`: Kirei greets in the foyer until `wardens_met`), clearing
  the hall on the way: each step is re-planned from the player's real flags (GET /me ∪ `badge:*`) and position — the
  reachable unbeaten gym trainers and usable unset switches, ranked by content's own `walkInterior` order; when none
  is reachable, `hop()` takes a warp tile whose landing reaches a goal (Vesperveil's cells; its decoys never qualify).
  Gym trainers are fought healed (POST /heal works anywhere in a healer town — the halls' nurse counters are client
  dialogue) with the best lead; a loss heals and retries (twice). `winLeague` now heals **after** reaching the leader
  (the gym trainers on the way wear the party).
- **Pathing** (`test/pathing.ts`): `findPath` / `steps` take the player's closed gate solids
  (`gatesClosedFor(zone, flags)`) and pass them to `standable` / `segmentStandable` — the exact predicate the room
  uses — so no path crosses a gate the room would refuse. Hall walls are in the heightfield already.
- **Leg changes.** act1: Mira's pre-beat refusal (`expectLocked(verdant_gym)`) is dropped — she stands behind two gym
  trainers (L8–10) a fresh L5 starter cannot pass, and her gate flag is set by her own beat `grove_stone`, which plays
  the moment she is in reach; Karn's and Maren's refusals are still walked (their halls are cleared on the first
  visit, the refusal is asked at the leader).
- **Smoke.** `test/progression-halls.test.ts` (same project, ~4 min): every gym hall and the league hall walked with
  real inputs by a set-up account (five L100 creatures, previous badges and the leader's beats granted through the
  repos — setup only). It pins the planner on all eight gym designs and on the league hall (Kirei's foyer charge, the
  four chambers in order).
- **B6 — `scripts/seed-progression.ts`** (`pnpm --filter @ewa/server seed:progression <leg> <username>
  [--password <pw>]`; `DATA_DIR` resolved from `packages/server` like the server's `./.data`, or `DATABASE_URL`):
  loads a leg fixture into a dev account. An existing account keeps its login, look, admin bit and history; its
  progression rows (creatures, bag, badges, flags, dex, quests, battle pass) and `money / zone / position / title /
  trainer_exp` are replaced. A missing account is created (`<username>@dev.ewa`, password `correct horse battery`
  unless `--password`). Creature ids are regenerated; fixture columns the live schema lacks are dropped. Stop a
  PGlite dev server first (one writer per directory).

## Phase C1 raids (server half)

- **`battleResync { battleId: raidId }`** now goes to every participant twice (`RaidRunner.resyncAll`): at the fight
  start (lobby → phase 1, right after `setFighting`) with `RaidSession.viewFor(playerId)` — the private battle with the
  shared boss copied in, `turn 0`, `canCatch false` — and when the catch window opens (the round that fells the boss,
  after its `raidEvents` and **before** its `inventoryDelta` / `progressionDelta` / `battleEnd`) with
  `RaidSession.catchStateFor(playerId)`: the §2.15 roll's pre-state (lead at full HP, boss at 1 HP, nobody switching,
  `ended null`), `canCatch` true only while the participant may still `raidCatch` (damage > 0, no attempt yet).
  `rollCatch` builds its state from the same private `catchState(p, true)`, so the resync is exactly what the roll
  starts from. `stateDigest = digestBattleState(state)`. Before this, the client had no `BattleState` to seed a raid
  battle from (only `raidEvents` + `battleEnd`).
- No ZoneRoom change: a client-sent `battleResync { battleId: raidId }` still answers `notFound` (the client never
  sends one for a raid: a raid has no preview / digest check, like pvp).
- Tests: `raid.test.ts` — the room test asserts both resyncs per participant (fight start: format `raid`, turn 0, own
  trainerId, full boss HP, digest = `viewFor`; catch window: not ended, boss 1 HP, `canCatch` = damage > 0, ahead of
  the round's `battleEnd`; none to a non-participant); the pure phases test asserts `catchStateFor` (null for a
  stranger, `canCatch` false once the attempt is spent).

## Phase C3 — visited flags and fast travel (2026-10-06)

- **Visited.** `onJoin` (fresh join and handover arrival alike) fires `markVisited` when the cached flags lack
  `visited:<zone>`: one `progress.setFlags` transaction, then `applyFlags` and a `progressionDelta { flags: [flag] }`
  (asynchronous, like the daily-login grant, so the join never waits on it). Registration writes `visited:` for the
  starting zone inside the register transaction, so a new account's first join sends nothing and the authority
  snapshots (A1 / A21 / A22) stay byte-identical.
- **`fastTravel { zoneId }`** (`ZoneRoom.onFastTravel`) checks, in order: `notTown` (destination kind is not town),
  `notVisited` (flag cache), `travelGated` (badge gate, belt and braces), `travelBusy` (battle — raids included, they
  set `battleId` — trade, raid participant, or a crossing in progress), `travelCooldown` (`fastTravelReadyAt`: 3 s
  after an accepted trip and after any handover arrival). Each refusal is a warn toast + `error notAllowed <reason>`.
  Accepted: the cooldown starts and `seatHandover(client, dest, dest.spawn)` runs — steps 2–5 of the edge crossing,
  extracted from `beginHandover` unchanged (reserve on the destination, presence reservation, `handover`,
  `ud.handover = pending`); the destination validates and acks it exactly like an edge crossing (one position write,
  `reachZone` quest events). A trip to the zone you stand in teleports to its spawn (`travelBlocked` if nothing
  walkable is near).
- `LIMITS.fastTravel` 4 / 1 s (it would otherwise fall to `roomOther`).
- **Tests.** `test/fast-travel.test.ts` (5): registration marks the start zone; a first join of another zone writes the
  flag once (row + one delta), a rejoin nothing; an accepted trip from Mire Route = `handover` to Mirevale's spawn, the
  destination takes the player, the ack writes the row, the arrival starts the cooldown; refusals notVisited / notTown /
  travelGated, a same-zone hop then travelCooldown, accepted again after 3.1 s; travelBusy in a pvp battle.
  `test/helpers.ts` `storyOnly` now also drops `visited:`, so story-flag comparisons (world, story-beats, interiors, the
  progression walk) ignore the new bookkeeping flags.
- **Found, not fixed (pre-existing):** a page reload within the 20 s reconnect window takes the old avatar over
  (`existing` in `onJoin`) and keeps `lastSeq: existing.seq`; the new client counts from 1, so every input is
  `staleSeq` until its seq passes the old one (seen live: ~15 s of rejected movement after a reload).

## Reconnect input seq (2026-10-06, fixes the "found, not fixed" above)

- `ZoneRoom.onJoin` on a takeover (an existing `PlayerState`) now resets `ps.seq = 0` and starts `userData.lastSeq` at
  0 (spec §30.2.2 step 5 always said `lastSeq: 0`; step 4 now says the takeover resets `ps.seq`). A takeover is always
  a new client — a reload or a second tab; a Colyseus reconnection (the SDK's own, same client object) goes through
  `onReconnect`, never `onJoin` — and a new client counts from 1. Resetting only `lastSeq` would not have been enough:
  the client's reconciler ignores an ack below its last one (`LocalPlayerController.reconcile`), and the join state
  would have carried the old seq, so the echoed seq restarts with the baseline.
- Test: `test/authority.test.ts` A14b — seq 400 on the old socket, an abnormal close (the avatar is held for the
  reconnection window), a fresh `/zone/enter` seat from the same room, then `seq: 1` moves the avatar at once with no
  `staleSeq` counted. It fails before the fix (the echoed seq stays 400).

## Phase C6 — password reset + email verification (2026-10-06)

- **Routes** (`rest/routes/auth.ts`, protocol `ROUTES.authForgot/authReset/authVerify/authResend`):
  `POST /auth/forgot { email }` → always 204 (unknown address included); a known, unbanned account gets a 30 min reset
  token + audit `auth.forgot`. `POST /auth/reset { token, password }` → hashes first (an unknown token costs the same
  argon2id), then one tx: `consumeEmailToken('reset')` (FOR UPDATE) → `setPasswordHash` → `revokeAll` refresh tokens →
  `markEmailVerified` (the link proved the address) → audit `auth.passwordReset { revoked }`. `POST /auth/verify
  { token }` → stamps `email_verified_at` (first stamp kept), audit `auth.emailVerified`. `POST /auth/resend` (bearer) →
  a fresh 48 h verification link; 409 `alreadyVerified`. Bad tokens → 400 `{ code: 'badToken', reason: 'unknown' |
  'expired' | 'used' }` (the reason is safe to show: a token is 256 random bits, the reason reveals nothing about
  accounts). Registration issues a verification token in its transaction and mails it after commit.
- **Rate limits** (`LIMITS`): `forgot` 5/h per IP (429); `forgotEmail` 3/h per address — over it the 204 is answered and
  nothing is sent (a 429 there would reveal nothing either, but silence keeps the response uniform); `emailToken` 20 /
  15 min per IP on reset + verify; `resend` 3/h per player.
- **Tokens**: 32 random bytes base64url, sha-256 hex in `email_tokens` (persist migration `0002_email_tokens`), single
  use, and a new token of a kind supersedes every older unused one of that kind (only the newest link works).
- **Mailer** (`src/mail/mailer.ts`, `ServerDeps.mailer?` → `Runtime.mailer`): SMTP via nodemailer when `SMTP_URL` or
  `SMTP_HOST` is set; otherwise `fileMailer` writes `DATA_DIR/mail/<iso>-<n>-<reset|verify>.eml` (nodemailer's stream
  transport composes the MIME, so the file opens in any mail client; the link is in the text part); `NODE_ENV=test`
  without SMTP → `memoryMailer` (tests read `runtime.mailer.sent`). `deliver()` is fire-and-forget after the response
  (no SMTP latency in the request, no timing difference between known and unknown addresses beyond the DB lookup);
  failures are logged with the tag only.
- **Env** (`env.ts`): `SMTP_URL`, `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `MAIL_FROM`,
  `PUBLIC_WEB_URL` (default `http://localhost:5173`; links are `${PUBLIC_WEB_URL}/reset?token=…`, `/verify?token=…`).
  Decision: production without SMTP **warns** at boot (`envWarnings`: no SMTP, `@localhost` sender, localhost web URL),
  never refuses — mail is optional so a deployment stays possible without a mail provider.
- **Profile**: `PlayerProfile.emailVerified` (optional on the wire, always sent by this server) from
  `players.email_verified_at`.
- **Not done**: no periodic purge of used/expired email tokens (persist has `authRepo.purgeEmailTokens`; refresh tokens
  have no purge job either — one housekeeping job for both is the natural follow-up). A reset does not kick live room
  sessions; their access tokens lapse within 15 min and the next refresh fails.
- **Tests**: `test/rest-auth.test.ts` "Phase C6" (6), `test/mailer.test.ts` (4).

## Phase D1–D3 — story grants, TMs + tutor, stone and trade evolutions (2026-10-06)

- **Grants.** `completeBeatInTx` now takes `repos.inventory` and adds `beat.grant` in the beat's transaction (the done flag
  keeps it once per player); it returns `items` (absolute counts). `ZoneRoom.onInteract` (non-battle beats) updates
  `ud.inventory` and sends an `inventoryDelta` before the `progressionDelta`; `battleSession` merges them into the battle
  delta's `items` (the room cache refreshes from `inventoryAll` as before).
- **`POST /creature/:id/moves`.** Accepts, per id: a move the creature already knows (so a TM/tutor move survives a
  reorder), a level-learnset move at or below its level, or a `TM_MOVES` move whose `tm:<move>` the player owns and the
  species can be taught (`canLearnMachineMove`). TMs are never spent.
- **`POST /creature/:id/tutor { move, forget }`.** Presence zone must hold an NPC whose `tutor` lists `move`
  (`noTutorHere`) — zone-level like the shop, no distance check (presence has no position); learnable (`notLearnable`);
  not known (`alreadyKnown`); four moves need `forget` (`movesFull`, `notKnown`). Player row locked; money −
  `MOVE_TUTOR_PRICE` (`InsufficientFunds` from the repo); audit `creature.tutor`.
- **Shop.** A key item (TM) buys with `qty: 1` only (`oneAtATime`) and not when already owned (`alreadyOwned`); key
  items stay unsellable (`priceOf` gives held/key items no sell price).
- **`POST /item/use` with a stone.** Needs a target and qty 1, checks ownership and that the target reacts
  (`itemEvolutionTarget`, else `noEffect`), spends nothing and answers `creaturesUpdated: [creature]`, `events:
  [{ t: 'evolveReady', into, item }]`. Evolution stays an explicit second step.
- **`POST /creature/:id/evolve`.** Player row locked. In order: core's level `evolveReady`; else a stone evolution while
  the stone is owned (one spent, response `inventoryDelta.items`); else a trade evolution while the creature carries
  `TRADE_EVOLVE_RIBBON` (removed by the evolution); else `notReady`. Audit detail gains `via`.
- **Trades.** `tradeSession.complete` marks each received creature whose species evolves by trade with
  `TRADE_EVOLVE_RIBBON` (row updated in the same transaction) and lists it in that player's `creaturesUpdated` as well as
  `creaturesAdded`. The ribbon is the persisted licence, so the evolve prompt can be answered later ("Not now"), not only
  in the session of the trade. No migration: `ribbons` is an existing jsonb column nothing else used.
- **Not done**: a quest reward that names a TM the player already owns stacks a second copy (harmless, never used up);
  no per-NPC distance check for the tutor (zone presence only).
- Tests: `test/tms-evolution.test.ts` (8). Named so it is NOT matched by the `progression-*.test.ts` exclusion.

## Phase D4/D5/D7 (2026-10-06)

- **D4 shinies.** `shinyFromDraw(u)`: `(u · 2^32) mod 512 === 0` on the ALPHA draw — no extra draw, so every seeded spawn
  sequence is byte-identical to pre-D4 (`test/shiny.test.ts` pins the digest `8880f1e7` captured by running the HEAD
  director on the same seed). P = 1/512 exactly; independence from the alpha threshold to 2^-23. `SpawnRecord.isShiny?`
  (optional so existing literals compile), `SpawnState.isShiny`, `newCreature(…, { isShiny })`, `toInstance` carries it,
  the catch inserts it and `markCaught(…, isShiny)` marks the dex. Trade / market buy / market expiry / evolve pass the
  creature's flag to `markCaught`. `GET /marketplace?isShiny=`; `listingView` adds `isShiny` only when true.
  Statics, trainers, raid bosses: never shiny. No live-ops shiny bonus.
- **D5 achievements.** `game/quests.ts`: `target` covers the new kinds; `absoluteValue` (`dexCaught` ← `dex.caught`,
  `loginStreak` ← `streak.days`) max-merges and skips the write when nothing grew; `matches` adds `catchTier`,
  `completeTrades` (`trade`), `clearRaids` (`raidClear`). Emitters: battle catch (`catch` + isAlpha/isShiny, `dex`),
  raid catch (`catch` + isAlpha, `dex`), raid rewarded clear (`raidClear`), trade completion (`dex` when creatures were
  received; `trade` existed), `dailyLogin` (`streak`; `DailyLoginGrant.questProgress`, sent with the join's
  progressionDelta; the REST login path ignores it — the client reads `/me`). **Not wired**: market purchases and
  evolutions do not emit `dex` (the next catch / trade catches the absolute count up).
- **D7 weather.** `game/weather.ts`: `WEATHER_BUCKET_MS = 6 min`, `WEATHER_SCHEDULE` per biome, one draw per
  (seed, zone, bucket). ZoneRoom writes `state.weather` at create and in tick step 1b when the bucket changes (only when it
  differs). `BattleDeps.weather(format, at)` → `open()` passes it to `createBattle` and records it in
  `start.weather`: wild/static/trainer/league outside `interiorAt` pockets, never pvp/raid. `env.WORLD_WEATHER`
  ('on' | 'off', default 'on'); **`testEnv` defaults to 'off'** so every pre-existing room test (and the progression walk)
  stays independent of the wall clock — `test/weather.test.ts` turns it on.
- Tests: `test/shiny.test.ts` (4), `test/achievements.test.ts` (6), `test/weather.test.ts` (6); Phase D5 assertions added to
  `challenge-trade.test.ts` (trade source) and `raid.test.ts` (raid source). Full `npx vitest run packages/server`: 29 files,
  218 tests green.

## Phase D6 — doubles (2026-10-06)

- **Start.** `startNpc` opens `slots: 2` when the trainer / league row is `doubles: true` with a team of 2+ AND the
  player has two usable creatures; otherwise singles (the documented fallback — never a refusal). `open(…, doubles)`
  writes `slots: 2` into `battle_history.start` so the row replays alone. Wild / static / pvp / raid stay singles.
- **Actions.** `BattleCoordinator.action(…, pos?)` (ZoneRoom passes `m.pos`). Doubles goes through `actionAt`: `pos`
  absent → the lowest required position still empty; `actionNotRequired` / `alreadySubmitted` / `validateAction(…, pos)`
  / `switchToActive` (both positions to one creature) / `noItem` (two uses of one item need two). `pending` holds one
  `[pos0, pos1]` pair per PLAYER side (NPC sides stay `null`, so `battle_history.actions[i][1] === null` still holds for
  NPC battles); the turn resolves when every required position of every player seat is in (`sideReady`).
- **Rate limit.** A doubles turn's two `battleAction`s arrive in one burst; with the shared 4 / 1 s window the second
  pick was dropped (`rateLimited`) after two quick turns — found by the walker in act3a, a real client bug. `ZoneRoom.dispatch`
  now counts a `pos: 1` battleAction from a player in a doubles battle in its own window (`LIMITS.battleActionPos1`, 4 / 1 s);
  singles traffic, and `pos: 1` in a singles battle, stay on the one `battleAction` window. Clients should send `pos`.
- **Deadline / leave.** `autoPair` fills only missing positions (replacement → the lowest unchosen bench creature;
  otherwise the first move valid for the position, else forfeit). `forfeitIfActive` has a doubles branch (unreachable in
  v1: pvp is singles).
- **Walker** (`test/walker.ts`): `fight()` previews `resolveTurn(state, [pair, null])` and sends one
  `battleAction { pos }` per required position (each after a limiter advance); `chooseDoubles` = core's
  `chooseNpcDoubles`, or per required position the best-matchup bench creature in a replacement. Singles path unchanged.
- **Tests.** `test/doubles.test.ts` (5): doubles start + per-position play + reward/flag + DB replay; singles fallback
  with one usable creature; draco_gym doubles / a plain trainer singles; per-position rules + deadline fill; and the real
  room (interact with Rocker Jinx, two `battleAction { pos }` per turn, every digest = the client preview, win).
  `battle-room.test.ts`'s 12-league suite plays draco_gym and aurelia as doubles (desync 0, replay from the row).

## Phase D8–D11 — world systems (2026-10-06)

- **Movement.** `BIKE_SPEED` / `MAX_BIKE_STEP`; `MovePrev.clearedObstacles?` and `canBike?`; `standable` /
  `segmentStandable` gain a trailing `cleared` set (default empty — the walker's `pathing.ts` calls are unchanged); a
  sample stamped by a cleared obstacle (`obstacleAt`) is standable; `bike = input.bike && prev.canBike` picks the bike cap
  and turns `canSurf` off for that segment; the verdict carries `bike`. `onOpenWater(h, x, z)`.
- **Room.** `canBike` = owns `bike` && `interiorAt(zone, ps) === null`; `ps.surfing` / `ps.biking` written only on
  change. `ud.clearedObstacles` from the flags at join, recomputed by `applyFlags` on an `obstacle:` flag.
- **Fishing.** `onFish`: busy → `busy`; no `old_rod` → `noRod`; in a hall or no open (non-lava) water within 2.5 m along
  the cast heading of the ACCEPTED pose → `noWater` (a boardwalk counts); `rollFishing` (spawnDirector.ts, the spawn draws
  over the eligible water slots) from `fishRng` = `createRng(seed:zone:shard:boot:fish)` — its own stream so the root's
  forks (spawns, battles, raids) are unchanged; none → `nothingBites`; else `startWild` at the player. Bites never join
  a director (`<zone>:fish:<n>`; `release` of an unknown id is a no-op).
- **Obstacles.** `findTarget` resolves `obstacle`; `rangeFor` 3 m; `clearObstacle`: `alreadyCleared` / `needHm` /
  `needType` (party loaded from the repo; fainted members count), flag + hidden item in one transaction, then
  `inventoryDelta`, `progressionDelta`, success toast.
- `LIMITS.fish` 1 / 1.5 s.
- **Test change.** `spawn-director.test.ts`'s 100 000-roll weight test now samples the land slots only: a water slot's
  roll survives only when one of its 8 position draws lands on water (≈ 0.5 % of mire_route), which it under-represents by
  design (this was already true of every table with water slots; mire_route simply gained some). `shiny.test.ts`'s pinned
  pre-D4 spawn-stream digest is now computed over the director's pre-D8 inputs (mire_route's land slots and its field with
  the obstacle cells un-stamped): the digest is unchanged (`8880f1e7`), so the director code itself did not move.
- Tests: `test/world-systems.test.ts` (10: pure bike / ridden water / cleared obstacles / rollFishing ×2; live surf,
  fishing ×2, Cut, bike).

## Phase D12–D13 — ranked queue (2026-10-06)

- **`rooms/matchQueue.ts`.** `MatchQueue` over a structural `RankedKV` (Colyseus `Presence`): entries in the hash
  `ewa:ranked:queue` (field = playerId), so the queue spans zones / shards / processes and a crossing keeps the place.
  `tick()` runs on every process each `RANKED_TICK_MS` (1 s, `server.ts` timer; tests also call
  `runtime.matchQueue.tick()`), never re-entered; only the `ewa:ranked:leader` lease holder (5 s TTL, check-set-check like
  the raid hotspot owner) pairs. Stale entries (no presence key → the process died) are dropped. Pure `pairUp` (oldest
  first, smallest gap within BOTH players' `rankedWindow`) and `RankedArena` (the arena room's pending matches).
- **Arena = Mirevale (deviation from the brief's "Solenne").** Solenne is gated by `ascend` and `onAuth` refuses a
  seat in a gated zone, so most players could not be handed over there. `RANKED_ARENA` = mirevale (22, 16), spots ±3 m
  in x (snapped walkable; the east green: no NPC, interior or link edge).
- **Flow.** Match → arena room picked once (`pickZoneRoom`) → `ewa:ranked:arena:<roomId>` (the arena room records it,
  20 s expiry) → `ewa:ranked:match` broadcast; each room hosting a player (skipping the destination side of a crossing,
  `arrival` set) sends `rankedStatus matched` and teleports (same room) or runs `seatHandover(client, zone, spot, roomId)`
  (new optional `roomId`: `zoneRoomById` instead of `pickZoneRoom`). Busy at match time → `idle busy` + `ewa:ranked:cancel`;
  other rooms tell the other player `cancelled`; the arena room tells late arrivals in `rankedPass` (tick step 9b).
  `rankedPass` starts the battle once both are present with `arrival` / `handover` null and no battle: plain
  `battles.startPvp` (format `pvp`, Elo through the existing §30.4.4 path — once per player; no `ranked` flag on the
  session: every pvp battle was already rated). Then `idle started` to both.
- **Queue drops.** A real leave (`removePlayer` when not `movedAway`) leaves the queue and cancels an arena match the
  player belongs to; `onBattleStart` drops every seat holder from the queue (`idle busy` if they were queued).
- `LIMITS.rankedQueue` 4 / 5 s. `Runtime.matchQueue` (deps.ts), built in `boot` with the presence driver.
- Not done: a rejoin of a reconnecting player inside the 20 s window keeps the entry (allowReconnection does not run
  `removePlayer`), which is intended; a Redis multi-process run was not exercised (LocalPresence only in tests).
- Tests: `test/ranked.test.ts` (10: 5 pure, 5 live incl. cross-zone handover + Elo once, arrival expiry, widening and cap).

## Phase D14 — post-game (2026-10-06)

- **League rematch.** `ZoneRoom.leagueBeaten(ud, id)`: the champion flag held and the trainer beaten (gym: badge; Warden /
  Champion: `setsFlags`, plus the champion flag for Zeon). `leagueRefusal` returns null for it (before the Champion every
  refusal is unchanged — the progression walker's league legs see no difference). The `gym` interact then reads
  `flagSetAt(league:<id>:rematchAt)`: inside `LEAGUE_REMATCH_COOLDOWN_DAYS` → toast + `error leagueLocked`; otherwise
  `startNpc({ kind: 'league', league, rematch: leagueRematch(id) })` — team and reward from the rematch row, `rematch: true`
  on the session. The end transaction's rematch branch pays `npc.reward` and the stage exp, writes no badge and no
  `setsFlags`, and clears + re-sets the cooldown flag (`setFlags` is insert-or-ignore, so the set time would otherwise stay
  at the first win). Quest `defeatTrainer` / `win league` still advance.
- **Battle tower.** `rooms/towerSession.ts` (`TowerSessions`, constructed by every room, only Solenne holds the
  attendant): `start` / `next` / `quit` / `onLeave` / `onBattleEnd`; `towerTeam(seed, wins)` and `towerPosition(wins)` are
  pure. `BattleCoordinator.startTower(seat, picks, foes, trainerId, at)` — format `trainer`, `tower: true`, `noExp`, no
  inventory snapshot (items refused `noItem`), synthetic `tower:` ids (no creature row is written). The end transaction's
  tower branch: `streaks.recordWin` / `endRun`, the set reward (money + items, audit `tower.reward`) every 7th win, carried in
  `RewardsSummary.items` (the first non-empty use of that field); the result rides `session.towerResult` to the room's
  `onEnd` → `TowerSessions.onBattleEnd`. A draw ends the run like a loss.
- **Not done / honest limits:** the run lives in room memory — a server restart mid-run leaves `current` at its last value
  until the next `start` resets it (the leaderboard's `best` is unaffected). The tower fight forms where the player stands
  in the foyer (no arena room there). No live browser verification this phase.
- `GET /leaderboard?mode=towerStreak` (`streaks.leaderboard`); every mode's rows gain `towerBest` / `towerCurrent`.
- Tests: `test/postgame.test.ts` (10: rematch content, two coordinator rematches, pure tower rules, four coordinator tower
  runs incl. 7 wins + reward + retire, a loss, items refused; two live cases through the room — gym rematch refusal /
  cooldown / rematch team, tower start + leaderboard).

## Phase E5 — mythical choice gate (2026-10-06)

- **Defect fixed.** `POST /battle-pass/mythical-choice` did not check the trainer level, and persist's
  `setMythicalChoice` created the missing level-50 row. Any account could take a level-50 lumyth / noxmyth at trainer
  level 1. The client offers the choice in place of a Claim button on the level-50 tile, so the route now does both,
  in one transaction:
  1. `trainerLevelFor(exp) < 50` → 409 `levelLocked`, nothing written.
  2. If level 50 is not claimed yet, it claims it: the row, its 5 000 money and items, and the `battlePass.claim`
     audit.
  3. Then the one-time choice. A second choice → 409 `AlreadyClaimed`.
  Persist's `setMythicalChoice` now requires the row (`Forbidden` without it), per spine §5.2.
- Test: `authority.test.ts` A10b (the §50.5 M4 "battle-pass claim/mythical-choice … A10 plus a positive control at
  level 50").
- **Leg boundary clock** (`progression.ts startLeg`): each leg boots a fresh server whose injected clock starts at
  wall time, while the previous leg's clock had run hours ahead (the walker advances it for the rate-limit
  windows). act3c caught it: `circuit` (act2) carried an earlier `earned_at` than `current` (act1), so GET /me's
  badges (ordered by `earned_at`) came out of story order. `startLeg` now advances the new clock past the snapshot's
  latest timestamp (`latestTimestamp`); the seed script shifts all of a fixture's timestamps so the latest is now
  (order kept). A harness defect, not a game one.
- **Results on main after 9dc5b30 + the D/E phases** (one `pnpm test:progression progression-act` run, fixtures
  re-recorded with `EWA_PROGRESSION_WRITE=1`): act1 695 s, act2 810 s, act3a 331 s, act3b 393 s, act3c 229 s
  (≈ 41 min), desyncs 0 throughout; act3c ends with GET /me showing the 8 badges in story order, the three
  `elite:*:beaten` flags, `champion:zeon:beaten`, all 33 beats and all 8 statics. `progression-halls` 9/9 (254 s).
  The content/server defects suspected before Phase A (`umbral_observatory.stair`, the `hollis_siege` /
  `reeve_observatory` story trainers, galaxion's `flag:ledger_read` gate) did not reproduce: those beats, the warp and
  the static all pass through the room. A static reachability sweep (every npc, trainer, warp and static of all 21
  zones from every linked edge with the walker's own A*) found nothing unreachable.
- **Observed, not changed**: interact range is distance-only, so a warp tile can be pressed through a hall wall
  within 3 m — in Vesperveil the walker leaves the leader chamber via `decoy_1` (W cell, z 5.2) from the south side of
  the z = 4 wall instead of the `return` tile. Content's own `walkInterior` (`reachNear`, 3 m) has the same
  semantics, so this is consistent; a line-of-sight rule would be a design change.

## Town arrival point (2026-10-06)

- Fast travel (`onFastTravel`: the handover's entry point and the same-zone hop), the escape rope (`onTeleport`) and
  a fallback join (`onJoin` step 3 when the row is for another zone, and the last resort of its unwalkable snap) use
  content `arrivalPoint(zone.id)` instead of `zone.spawn`: the plaza in the eight towns whose spawn is on the west
  road, Mirevale's spawn `(0, 6)`, every other zone's spawn (so the rope, route-only, is unchanged).
- Facing: the avatar takes `arrivalPoint.angle` (toward the plaza centre) on a fallback join, a rope or a same-zone
  hop, and on a handover arrival whose `(x, z)` equals the arrival point (= a fast-travel arrival; an edge entry stands
  6.5 m inside an edge and never matches). The handover reservation carries no angle, so this keeps the protocol as is.
- Unchanged on purpose: `entryPoint` (edge handovers, including its `dest.spawn` last resort), `rankedArenaSpots`
  (Mirevale), and so every path the progression walker takes (it enters through its persisted row and crosses edges;
  `progression-halls.test.ts` re-run green).
- Tests: `test/fast-travel.test.ts` (cinderhold: handover to the arrival point, landing + facing, same-zone hop; a
  fallback join lands there), `test/fixes.test.ts` (the rope on a route = its spawn).

## Majin / Tenjin bands (2026-10-11)

- `rooms/battleSession.ts`: `bandsOf(inventory)` (exported) reads `majin_band` / `tenjin_band` from the start
  transaction's inventory snapshot; `playerSide(…, inventory)` adds `bands` only when the player holds one (wild, static,
  trainer / league and pvp starts; the tower passes none — bands are not used there). `startNpc` copies the trainer's /
  league trainer's content `bands` onto the NPC side. The start snapshot (battle_history.start) carries them, so a
  history replay transforms the same way. Action messages pass `transform` through to core's `validateAction`
  (`notAllowed` / `cannotTransform` when refused).
- Protocol: the `move` action accepts `transform: z.literal(true).optional()`.
- Tests: `test/bands.test.ts` (3: bandsOf; a Tenjin transformation end to end with digest = client preview and the second
  transform refused; no band → `cannotTransform`). `npx vitest run packages/server`: 35 files / 261 tests (the 12 seeded
  league battles, three of them with bands now, still desync 0).

## Arena PvP — battles outside the world (2026-10-11)

Protocol contract: `packages/protocol/src/arena.ts` (+ `ArenaState`). The in-world PvP (walk-up challenge §30.4.5, the
Mirevale ranked queue §30.4.5a) is unchanged.

- **Files.** `rooms/arenaQueue.ts` (pure `pairArena` + `ArenaQueue`, presence-keyed like `MatchQueue`),
  `rooms/arenaLobby.ts` (`ArenaLobby`: the queue's match step, invites, training, rejoin, busy rules, pushes;
  `Runtime.arena`), `rooms/ArenaRoom.ts` (room type `arena`, one per match), `rest/routes/arena.ts` (the 7 routes),
  `matchmaking.ts` (`ArenaMatch`, `openArenaRoom`, `reserveArenaSeat`). `server.ts` defines `arena` with the same
  ticket-only static `onAuth` as `zone` (`refuseDirectArenaMatchmaking`) and ticks the lobby every `ARENA_TICK_MS` (1 s).
- **Queue.** One hash per mode `ewa:arena:queue:<mode>`; a player is in one mode at most (another mode moves them, the
  same mode keeps the wait); lease `ewa:arena:leader`. Ranked pairs with `pairUp` (ranked window), the others pair the
  two longest-waiting. Each pass drops entries without presence (silently) and entries older than
  `ARENA_QUEUE_TIMEOUT_MS` (`arenaStatus idle/timeout`). The match step re-checks both (`availability`): offline →
  dropped, busy → `idle/busy` to them and the free side goes back into the queue with its wait. A real leave of the
  world (ZoneRoom `removePlayer`, not a crossing and not into an arena) drops the entry; the arena battle start drops
  both players from the arena queue and the in-world ranked queue.
- **Busy** = presence `battleId` or `tradeId` set (in-world battle, raid fight, trade) or seated in an arena room whose
  listing metadata `phase` is `waiting` / `fighting`. Not detected: a tower run between fights, a crossing in progress
  (both cheap only inside the zone room; the arena start's own transaction is the last guard).
- **Delivery anywhere.** Topic `ewa:arena:<playerId>` carries a ServerMessage; `ZoneRoom.subscribePlayer` and the arena
  room forward it to that player. `PresenceEntry` / `RemotePresence` got an optional `arena: true` (mirrored).
- **Arena room.** `createRoom('arena', { ticket, match })`; seats via `reserveSeatFor(room, { ticket }, null)`;
  instance `onAuth` = JWT + ticket + ban + "one of `match.players`". `maxClients` = 2 × players (a rejoin reservation
  while the old socket waits out its reconnection), `seatReservationTimeout` = 25 s (outlives ARENA_ARRIVAL_MS). onJoin:
  presence `{ roomId: arena, zoneId: where they stood, arena: true }` (no `ewa:kick`), topic subscribed, `arenaState`
  (+ `battleResync` for a returning seat; a second socket of the same player replaces the first). All humans present →
  `startArena`. Phases are mirrored to `state.phase` and the listing metadata. A 250 ms room interval drives
  `battles.tick` (deadlines) and the no-show check against the injected clock (`createdAt + ARENA_ARRIVAL_MS`). Cancel
  reasons: `noShow`, `left`, `party`, `cup` (`arenaState cancelled`; a player who never arrived gets
  `arenaStatus idle/cancelled` in the world). Battle start → `idle/started` push; end → `ended`; then the room locks.
  onDrop → allowReconnection 20 s (waiting / fighting only); a real leave forfeits (pvp) or abandons (training).
- **`BattleCoordinator.startArena`.** One transaction (loadPlayers) per start; copies = `arenaCopies` (first six,
  `atLevel(toInstance(c), level)`, `arena:<id>`); sides `player` (bands from the inventory kept), training side 1 =
  `npc` with `arenaTrainingTeam(<matchId>:foe, difficulty, party size, level ?? highest party level)`; format `pvp`
  (training `trainer`), seed `createRng(battleId)`, `noExp` (no exp, no honor), inventory `[null, null]` (bag items →
  `noItem`), x/z 0, yaw 0, no weather, terrain none (`BattleDeps.zone` widened to `{ id, biome }`; the arena passes
  `{ id: 'arena', biome: 'capital' }`; `BattleSession.zoneId` is now `string`). Session field
  `arena: { kind, ranked }`; the start snapshot carries `arena: kind` (persist `BattleStartSnapshot.arena`, optional),
  and `GET /history/battles` fills the row's `arena` from it.
- **End transaction.** Arena PvP: Elo + `applyRating` (rankedMatches + 1) only when `ranked`; every arena PvP kind pays
  `pvpWin` / `pvpLoss` trainer exp and the `win pvp` quest event (+ the `battle` event). Training: nothing — no exp, no
  money, no flags (the `trainer:<id>:beaten` branch never runs), no quest events, no dex `seen`. History rows for every
  human (opponent = the other player's id; training = the trainer id). Synthetic ids → `isPersistedId` skips every
  creature write (tested byte-for-byte); the item snapshot is never refreshed for an arena session.
- **Deviations / decisions.** (1) "Usable party" for the arena = a non-empty party: copies are healed, so a fainted
  party still fights (`party` only for an empty one). (2) `POST /zone/enter` answers 409 `inArena` (+ `roomId`) while an
  arena room holds the player in `waiting` or `fighting` (not only mid-battle), so a reload during the arrival window
  also goes through `/arena/rejoin`; after `ended` / `cancelled` the world takes them back as usual. (3) Every arena
  route needs presence (409 `offline`). Queue refusals answer 200 with `idle` + reason; training / invite refusals are
  409 `busy` / `party` / `cup` (+ `detail`) / `notFriends` / `self` / `friendOffline` / `friendBusy`; a reply to a
  missing / foreign invite is 404 `NotFound`, to an expired one 404 `expired` (the inviter is told `expired`). (4) The
  invite expiry push is a real-time timer (TTL) plus the lazy check on reply.
- Not done: a Redis multi-process run (LocalPresence in tests); the cup rule is checked against the week the match was
  made (a rotation between match and start keeps that week's cup).
- Tests: `test/arena.test.ts` (11: 4 pure, 7 live — Level 50 end to end with untouched creatures / no rating / pvp exp /
  history, Ranked Elo once, training, friend invite decline + accept + leave-forfeit, the cup refusal + queue moves,
  /zone/enter 409 + /arena/rejoin, no-show cancel).

## Old-game encounters: tall grass and trainer sight (2026-10-20)

The user asked for wild creatures only in tall grass (no longer standing in the overworld) and for trainer battles that
cannot be skipped: a trainer who sees the player starts the sequence, "!" over their head. SPEC §30.3 (amended).

- **`WILD_ENCOUNTERS`** (`grass` default, `overworld` = the §30.3 director as before). With `grass`, `spawnPass` returns at
  once and `state.spawns` stays empty; the director is still built because its live-ops mods feed the roll. Each accepted
  move of a free player outside a hall rolls on `wildRng` (its own seed, like `fishRng`) when the new position is in a
  `zonePlan(zone).grassPatches` ellipse (land slots, 0.07 per metre) or the player is surfing (water slots, 0.035 per
  metre): `1 - (1 - rate)^d`, doubled by a lure. 3 m of grace after joining and after any battle, 12 m after a refused
  start. The creature is `rollWild(table, medium, ...)`: `rollFishing` is now `rollWild(..., 'water', ...)` with the same
  draws in the same order, so every fishing result is unchanged. The battle holds the record alone (`<zone>:wild:<n>`).
  No usable creature: no battle and no message. Repel: the roll is spent, no battle below the lead's level.
- **`TRAINER_SIGHT`** (`on` default). After each accepted move (before the grass roll) `spotter` picks the nearest trainer
  of the zone or its halls within 6 m that the player has not beaten (a story trainer only while rule 6 names it), in the
  same hall (or both outdoors), with a clear line (0.5 m samples walkable or water, outside the player's shut gates).
  `ud.spotted` holds movement (the `inBattle` reject) while a party read runs; with a usable creature the client gets
  `trainerSpotted`, otherwise sight is quiet for 10 s. While held, only the spotter's `interact` is accepted (else `busy`
  `spotted`), from any distance; `startSpotted` runs the beat battle or the plain fight. 45 s without it: the tick starts
  the fight itself. A failed start drops the hold and quiets sight for 10 s.
- **Deviations / decisions.** (1) Sight is a range plus a line, not a facing cone: overworld `TrainerDef`s carry no facing
  (the client faces them to the zone origin) and the user wanted fights you cannot slip past. (2) A rematch stays a
  conversation (a beaten trainer never sees you). (3) `testEnv` keeps `overworld` + `off`, so every existing suite and
  the progression walker (which engages visible spawns and walks up to hall trainers) run as before; the walker does not
  exercise the new defaults.
- Tests: `test/encounters.test.ts` (8: 4 pure, 4 live on mire_route).

## Battle replays (2026-10-20)

- `game/replay.ts`: `replayOpts` (the createBattle input of a stored row, as `open()` passed it; the arena kind is not
  an input), `anonymiseStart` (player trainers `r:<side>`, every creature `r:<side>:<i>`, owners null), `seatOf`,
  `shareableReplay` (refuses `notReplayable` without start / digest, `stale` when the row no longer reaches its own
  digest, which is how a content change after the battle shows).
- `rest/routes/replay.ts`: the share route freezes the replay into `battle_shares` (audit `battle.share`); the public
  route reads only that table. Rate limit `replay` (60 / min per IP). The history row's `opponent` label is the
  opponent's name in the replay (a username in pvp, the trainer label otherwise; wild null).

## Creature history (2026-10-20)

- `battleSession` (the battle transaction, after the rewards): every persisted creature of the side's party gets
  `badge` when a league win awards one, `champion` when the win sets `champion:zeon:beaten`, `legendary { species,
  caught }` when a legendary static is won or caught. "In the party" is the claim, not "fought": core keeps no
  participation record and the history must not guess.
- `POST /creature/:id/evolve` adds `evolved { from, into }` (every evolution path goes through it). `GET
  /creature/:id/history` lets any signed-in player read any creature's history: a listed creature's past is part of
  what is offered, and the names in it are public usernames.

## The daily challenge (2026-10-20)

- `game/daily.ts`: `dailyPuzzle(dayKey)` keeps the first of 40 seeded pairings (tower pool 2, level 50) that core's
  trainer AI wins for the player's side on the day's seed, so every day is winnable and `par` is a real line (the
  test checks a quarter of days). The first version drew one pairing per day and a simple strategy lost most days.
  The result is cached per day (a handful of entries).
- `ArenaLobby.daily` → an arena room of kind `daily` (`ArenaMatch.daily.dayKey`); `ArenaRoom.start` calls
  `BattleCoordinator.startDaily`: the day's teams on `createRng('daily:<dayKey>')`, format `trainer`, trainer
  `arena.daily` (content `ARENA_DAILY`). In `persistTurn` a daily counts as training (nothing paid or written about the
  player) and, at the end, re-runs `replayBattle` over the actions log for the strip and writes `daily_results`.
- `GET /leaderboard?mode=daily` reads today's (UTC, `liveops/schedule.ts` `dayKey`) winners.
