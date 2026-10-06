# @ewa/protocol — implementation notes

Binding spec: `.design/spec/00-spine.md` §4 (+ §2.20 digest), `30-server-netcode.md` §30.2, `20-client.md` §20.4.
Everything below is either a decision the spec left open, a deviation, or a fact verified against the
installed library that future readers should not have to re-derive. The spec itself was not edited.

## Verified against the installed libraries

- **`@colyseus/schema` 5.0.32 decorators are LEGACY.** `build/annotations.d.ts`: `type(type, options?): PropertyDecorator`
  and `view<T>(tag?: number): (target: T, fieldName: string) => void` — both take `(prototype, fieldName)`, i.e. TypeScript's
  `experimentalDecorators` shape, not TC39 stage-3 decorators. Its README ("TypeScript support") requires
  `experimentalDecorators: true` **and** `useDefineForClassFields: false`. `tsconfig.base.json` targets ES2022, whose default is
  `useDefineForClassFields: true` — that would make each class-field initializer define an own data property that shadows the
  `@type` accessor installed on the prototype (change tracking silently breaks). `packages/protocol/tsconfig.json` therefore sets
  both flags explicitly (with a comment). esbuild (vitest) reads both from the nearest tsconfig, so `tsc` and `vitest` compile the
  classes identically — proven by `test/schema.test.ts` round-tripping through the real `Encoder`/`Decoder`.
- **`~__numFields` in class metadata is the LAST field index**, not the count (the library iterates `i <= numFields`). Tests
  reading metadata account for this.
- **`StateView` binds lazily to the Encoder's Root on its first `add()`** (`StateView.d.ts` `_bindRoot`). The `Encoder` must exist
  before `view.add(...)` — as a Colyseus room's serializer does before any client joins. A view created before the encoder is
  silently inert. Test helper documents this.
- **`@view()`-tagged fields are NOT in a plain `encodeAll()`.** A decoder with no view receives every broadcast field and zero
  `players`/`spawns` rows. Per-view delivery is `encodeAll(it)` (shared) + `encodeAllView(view, sharedOffset, it)`, and per tick
  `encode(it)` + `encodeView(view, sharedOffset, it)` + `discardChanges()` — the README "Encoding with views" recipe.
- **zod 4.6.5**: `z.number()` already rejects NaN/±Infinity; `.finite()` is a deprecated no-op, so the spine's `.finite()` calls
  are satisfied by the default and omitted. `z.object` STRIPS unknown keys (the payload tests state this). `z.string().uuid()`
  still exists (used as the spine writes it). `z.iso.datetime({ offset: true })` is used for wire timestamps.

## Deviations / decisions (spec left open or conflicted)

1. **`@ewa/content` exports nothing yet** (concurrent implementation). All content types the wire needs (`ZoneId`, `BadgeId`,
   `HarvestState`, `BattlePassReward`, id tuples) are structural copies in `src/types.ts`, each marked `TODO(content)`. Nothing is
   imported from `@ewa/content` (not even `import type`) so protocol compiles regardless of content's state.
2. **`POST /profile` — `title ∈ TITLES`, `body ∈ BODIES`** are content VALUE lists protocol may not import. `ProfileReq` validates
   the base shape; `profileRequestFor(titles, bodies)` returns the refined schema for the server to build with content's lists.
   `rest.test.ts` proves rejection with fake lists.
3. **`ServerMessage` has 16 variants**, exactly the §4.4 block (battleStart, battleEvents, battleResync, battleEnd, inventoryDelta,
   progressionDelta, handover, challengeReceived, challengeResult, tradeUpdate, raidEvents, chat, dm, storyBeat, toast, error).
   `50-verification-budget.md` §50.4.3 says "17 variants"; the count there is stale — the binding §4.4 union has 16.
4. **Server-message zod is structural for core interiors.** `BattleEvent` validates `{ t: string }` (loose) and `BattleState`
   validates id/format/turn/rng/ended/zoneId + two sides with typed battlers, not all 36 event variants. §4.4 makes the client
   trust the server for these; the strict schema is `handover` (its `seat` is passed unchanged to `consumeSeatReservation`, so
   `SeatReservationSchema` is a `looseObject` that preserves unknown keys such as `publicAddress`/`processId`/dev flags).
5. **`MOVEMENT` matches §20.4.5 verbatim.** The task also asked for "tolerance, dt budget" in protocol; §30.2.4 defines those on the
   server, so they live in a separate `MOVEMENT_VALIDATION` constant (`speedTolerance 1.15`, `budgetMinMs -100`, `budgetMaxMs 250`,
   `quantisationSlack 0.02`, `segmentSampleM 0.25`) plus `speedCap(running)` / `maxStep(running, dtMs)` helpers the server may
   re-export. `MOVEMENT` itself is untouched.
6. **`stepMovement` semantics** (the spec fixes the signature and constants, not the integrator): velocity moves toward
   `input × speed` at `accel` and SNAPS onto it when within one step (an idle stick stops the avatar exactly — no exponential tail,
   §20.4.6); heading is `atan2(ax, az)` (angle 0 = +z) turned along the shortest arc at `turnRate`, wrapped to `[-π, π)` like the
   server's ack; `dtMs ≤ 0`/non-finite is a no-op and `dtMs > maxDtMs` is clamped; the collider runs last with `MOVEMENT.radius`.
   Plain IEEE doubles, no `Math.fround`: deterministic for identical inputs on one engine (asserted over 10 000 steps); cross-engine
   bit-identity is not required because the server validates rather than re-simulates.
7. **`tradeOfferHash`** (`TradeConfirmMsg.offerHash`, "fnv1a32 of both offers, canonical"): hashed over `{ playerId, creatureIds,
   money }` only, offers sorted by `playerId`, 8 lowercase hex — so a `confirmed` flip does not change the hash and both seats
   compute the same value (§50.4.5 challenge-trade: "a changed offer resets both confirmed flags").
8. **Shapes §4.7 names but never lists** — defined here with `TODO(spec)` comments: `PlayerProfile` (self-view of the `players` row
   minus secrets), `LeaderboardRow`, `LiveOpsSummary` (loose), `QuestView` (loose), `/admin/stats` body (loose). `FriendView`
   follows §30.7.1 (`online/zoneId/inBattle/lastSeenAt`), not persist's minimal `{ id, username, since }`. `ListingView`/`BidView`/
   `MessageView`/`GuildView`/`PublicProfile` mirror `packages/persist/src/types.ts` with `Date` → ISO string.
9. **`/admin/unban`**: the table shows one request shape `{ username, reason: 1..200 }` for ban+unban; `UnbanReq` makes `reason`
   optional (an unban has no natural reason). `BanReq` requires it.
10. **`/marketplace/list`** adds the §30.8.2 rule `buyNowPrice === null || buyNowPrice > startingBid` as a zod refine so the client
    fails fast; the server still enforces it.
11. **Marketplace/leaderboard/messages query schemas coerce** (`z.coerce.number()`, `'true'|'false'` → boolean) because Fastify
    delivers query strings; `pageSize` caps at 50, `limit` at 50, `page ≥ 1`, defaults applied.
12. **`CLIENT_MESSAGE_LIMITS`** restates the §4.3 rate limits as data (per message type). `challengeReply`, `tradeReply/Offer/
    Confirm/Cancel` and `handoverAck` have no row in §4.3; they take the generic 4 / 1 s. The server's `LIMITS` table (§30.6.4) stays
    authoritative.
13. **`CLOSE_CODES`** (4000/4001/4002/4003 from §30.2.2/§30.2.4/§30.2.7) are exported from `messages/index.ts` so client and server
    share them.
14. **AOI (`src/aoi.ts`)** is pure cell math only (`cellOf`, `neighbourCells` row-major, `inNeighbourhood`, `cellTransition`); the
    stateful `AoiGrid` is the server's (§30.2.5). Non-finite coordinates map to cell 0 rather than producing a `NaN` key.
15. **REST route table**: 60 routes (every §4.7 row expanded). `response: null` marks 204 routes. `RouteRequest<K>` /
    `RouteResponse<K>` / `RouteQuery<K>` / `RouteParams<K>` derive types from the table; `routePath(key, params)` substitutes
    `:param` segments.

## Verification (2026-09-20)

- `pnpm exec vitest run packages/protocol` — 7 files, **157 tests, all passing**.
- `pnpm exec tsc -p packages/protocol --noEmit` — exit 0 (protocol clean).
- `pnpm typecheck` (`tsc -b`, whole repo) — **fails in `packages/content/src/data/zones.ts:355`** (unterminated string: an unescaped
  apostrophe in `'…Or I'm older…'`), which is the concurrent content agent's WIP. Because protocol references content, `tsc -b`
  stops there; protocol itself is clean (above).
- `pnpm lint` — protocol `src/` and `test/` clean; the same content parse error is the only other report.

## Phase C3 — `fastTravel` (2026-10-06)

- `CLIENT_MESSAGES.fastTravel = FastTravelMsg { zoneId: z.enum(ZONE_IDS) }` — the 21st client message
  (`CLIENT_MESSAGE_COUNT` 21); `CLIENT_MESSAGE_LIMITS.fastTravel` 4 / 1 s (the server adds a 3 s cooldown of its own).
- `FAST_TRAVEL_REFUSALS` — the `error { code: 'notAllowed', detail }` reasons (`notTown`, `notVisited`, `travelGated`,
  `travelBusy`, `travelCooldown`, `travelBlocked`, `travelFailed`), typed for the server and read by the client so it does
  not toast an error the server already explained with its own toast. No server message changed: an accepted trip is the
  ordinary `handover`.
- `test/payloads.test.ts`: 21 keys in spine order, the valid example and four malformed payloads.

## Phase D2–D3 — tutor route, evolve response (2026-10-06)

- `TutorReq { move, forget: string | null }` and `ROUTES.creatureTutor` (`POST /creature/:id/tutor`, response
  `CreatureSetupRes` = creature + `inventoryDelta` carrying the new money). 65 routes.
- `CreatureEvolveRes` = `CreatureInstanceSchema.extend({ inventoryDelta: InventoryDeltaBodySchema.optional() })` replaces
  the bare creature on `creatureEvolve`: a stone evolution reports the spent stone's count; level / trade evolutions omit
  it, so older clients reading only the creature fields keep working.
- `ItemUseRes.events` is loose already; a stone answers `{ t: 'evolveReady', into, item }`.

## Phase D4 — shinies (2026-10-06)

- `CreatureInstanceSchema.isShiny` optional; `SpawnState` gains `@type('boolean') isShiny = false` appended LAST (earlier
  field indexes unchanged; `schema.test.ts` pins the order); `ListingViewSchema.isShiny` optional; `MarketQuery.isShiny`
  (`QueryBool`); `DexRes.shiny` optional. Every addition optional so pre-D4 payloads stay valid.
- `ZoneState.weather` already existed (Phase D7 only starts writing it).
- Tests: `test/shiny.test.ts` (4).

## Phase D6 — doubles (2026-10-06)

- `BattleActionMsg.pos?: 0 | 1` (the doubles field position; absent = the server fills the lowest waiting one; ignored in
  singles); the `move` action gains `target?: FieldRefSchema` (`{ side: 0|1, pos: 0|1 }`). `SideSchema.actives?`
  (tuple of two party indices) and `BattleStateSchema.slots?: 2`. All optional, so singles payloads and parse outputs
  carry no new keys (`test/doubles.test.ts`).

## Phase D8–D11 — world systems (2026-10-06)

- `MOVEMENT.bikeSpeed` 10.5 (9 keys now), `gaitSpeed(running, bike)`, `speedCap/maxStep(…, bike = false)`,
  `MoveInput.bike?` (stepMovement rides at bikeSpeed, `running` ignored).
- `InputMsg.bike?: boolean`; `INTERACT_KINDS` + `'obstacle'`; `FishMsg { angle }` (an empty object would have matched
  the forged-progressionDelta test, and the heading is what the server samples water along), `FISH_REACH_M` 2.5,
  `FISH_REFUSALS`; `CLIENT_MESSAGES.fish` (22 keys), limit 1 per 1.5 s.
- `PlayerState.surfing` / `biking` appended LAST (earlier field indexes unchanged).
- Tests: `payloads.test.ts` (22 keys, fish cases, obstacle kind, bike flag), `schema.test.ts` (fields),
  `movement.test.ts` (bike speed / caps).

## Phase D12–D13 — ranked queue (2026-10-06)

- `RankedQueueMsg { action: 'join' | 'leave' }`, `CLIENT_MESSAGES.rankedQueue` (23 keys), limit 4 per 5 s.
  `RANKED_WINDOW { base 100, step 50, stepMs 10 000, max 400 }` + `rankedWindow(waitedMs)` (shared by the server's
  matcher and the client's panel).
- `rankedStatus { state, rating, waitedMs, window, opponent, reason }` appended LAST to `SERVER_MESSAGE_TYPES` (17);
  `RANKED_STATES`, `RANKED_IDLE_REASONS` (`left`, `busy`, `party`, `cancelled`, `started`).
- Tests: `payloads.test.ts` (rankedQueue cases, 23 keys, limit, window), `server-messages.test.ts` (example, 17).

## Phase D14 — post-game (2026-10-06)

- `TowerMsg` (`start { picks: 3 ids } | next | quit`), `CLIENT_MESSAGES.tower` (24 keys), limit 4/s; `TOWER_REFUSALS`
  (`locked`, `tooFar`, `badPicks`, `running`, `noRun`, `inBattle`).
- `towerState { phase, streak, runWins, best, set, fight, picks, reward }` appended after `rankedStatus` (18 variants);
  `TOWER_PHASES`.
- `BattleStateSchema.noExp` (optional literal true). `LEADERBOARD_MODES` gains `towerStreak`; `LeaderboardRow` gains
  optional `towerBest` / `towerCurrent` (optional so older fixtures stay valid; the server always fills them).
- Tests: `payloads.test.ts` (tower cases, 24 keys, limit), `server-messages.test.ts` (example, 18).
