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

## Battle replays (2026-10-20)

- Routes `historyShare` (`POST /history/battles/:battleId/share`, bearer) and `replay` (`GET /replay/:token`, auth
  none, limit `replay`): 74 routes. `ReplayRes.start.sides` and `actions` are `z.unknown()` like persist's opaque
  snapshot: the client checks a replay by its final digest, not by schema. `REPLAY_BATTLE_ID = 'replay'` is the
  createBattle id both the server (digest at share time) and the client use.

## Creature history (2026-10-20)

- `creatureHistory` (`GET /creature/:id/history`, bearer): `CreatureHistoryRes { originalTrainer, events }`, the
  events a discriminated union on `kind` (`traded` / `sold` / `gift` share one shape through a `z.enum`). 75 routes.

## The daily challenge (2026-10-20)

- `ARENA_KINDS` gains `daily` (label "Daily challenge", `arenaLevel('daily') = ARENA_LEVEL`). `DailyRes` (`GET /daily`)
  and `POST /daily/start` (→ `ArenaSeatRes`); `LEADERBOARD_MODES` gains `daily`, and `LeaderboardRow` the optional
  `dailyTurns` / `dailyMarks`. 77 routes. `DAILY_FIRST_DAY` is #1.

## Challenge modes (2026-10-20)

- `RegisterReq.challenge?`, `POST /challenge` (`ChallengeReq` / `ChallengeRes { flags }`), `LEADERBOARD_MODES` gains
  `nuzlocke` / `hardcore` and `LeaderboardRow` the optional `challengeBadges` / `challengeState`. 78 routes.

## Verified speedruns (2026-10-20)

- `GET /speedrun`, `GET /speedrun/:username` (`SpeedrunRes`); `LEADERBOARD_MODES` gains `speedrun` and
  `LeaderboardRow` the optional `speedrunMs`. 80 routes.

## Weather from real life (2026-10-20)

- Server message `realWeather { kind | null }` (24 types). Routes `weatherCities` (limit `weather`), `weatherCity`,
  `weather` with `WeatherCitySchema`, `RealWeatherRes`. 83 routes.

## Ranked seasons and spectator mode (2026-10-20)

- `seasons`, `seasonStandings`, `seasonTitles`, `arenaLive`, `arenaLiveFeed` (88 routes). `LiveFeedRes.replay` is the
  shared replay's shape with `digest` for the turns shared so far; `outcome` uses `BattleOutcomeSchema`.

## Honor shapes the world (2026-10-20)

- `ZoneState.shadow` (uint8, after `harvestState`: the field order is the wire order, server and client move
  together); `worldShadow` route (89 routes).

## Majin vs Tenjin seasons (2026-10-20)

- `factions`, `factionJoin`, `factionSky` (92 routes); `FactionsRes` carries the Chronicle lines the server derived.

## One roaming legendary per season (2026-10-20)

- `legends` route (93 routes): the roamer, its route and next move while uncaught, the catches.

## Ghost trainers (2026-10-20)

- `ghost` route (94 routes).

## Breeding (2026-10-21)

- `daycare`, `daycareLeave`, `daycareTake`, `daycareCollect`, `eggMove` routes (99 routes); `eggHatched` server
  message (25 types); `CreatureInstanceSchema.bandborn` (a literal true, optional: the client's battle-state digest
  must keep it); history event `hatched`.

## Nemeses (2026-10-21)

- `nemeses` route `GET /nemeses` (100 routes); `nemesisAmbush` and `nemesisNews` server messages (27 types);
  `NEMESIS_SCAR_IDS` mirrors content's `NEMESIS_SCARS` (protocol does not import content); history event `nemesis`.

## A living ecosystem (2026-10-21)

- `worldEcosystem` route `GET /world/ecosystem/:zoneId` (101 routes): `EcoParams` takes a known zone id, `EcosystemRes`
  carries the reading's lists (`EcoSpeciesSchema`, `ECO_CAUSES` mirrors content's `EcoCause`: protocol does not import
  content).

## The bounty board (2026-10-21)

- `bounties` (`GET /bounties`) and `bountyPost` (`POST /bounties`) (103 routes); `BountiesRes` with the three poster kinds
  (`BOUNTY_KINDS`), the caller's posts (`BOUNTY_STATUSES`), claims and the ghosts that can be posted on; history event
  `bounty`. No new server message: a claim's payout rides the battle's rewards and a `toast`.

## NPC tools (2026-10-22)

- `npcAct` (`POST /npc/act`, `NpcActReq` / `NpcActRes`, `NPC_ACTIONS`, `NPC_MONEY_MAX`): the client NPC talk's
  money and creature tools. Not in the SPEC (a local-model feature).
- `battle` (2026-10-23) in `NPC_ACTIONS`: the NPC starts an Ewamon battle with the player (the zone room opens it; the
  reply moves nothing). Its NPC side's `trainerId` is `villager:<npc id>` (`villagerTrainerId` / `villagerNpcId`).
  No new client message: the route reaches the room over the event bus, as the escape rope does.

## Breakdance emote (2026-10-22)

- `EmoteMsg.emote` accepts 1..7: 7 is the breakdance (`EMOTE_BREAKDANCE`), which stays on `PlayerState.emote` for
  `BREAKDANCE_MS` (6 s) instead of 2 s. Not in the spine (§4.1 lists 1..6).

## NPC memory and town reputation (2026-10-24)

- Routes `npcMemory` (`GET /npc/memory/:npcId`) and `npcMemoryWrite` (`POST /npc/memory`, dedicated limit
  `npcMemory`), the schemas `NpcMemoryRes` / `NpcMemoryReq` / `TownStandingSchema`, and the shared rules both sides
  read: `NPC_DEEDS` (`NPC_TALK_DEEDS` the client may report), `NPC_DEED_DELTA`, `writeDelta`, `NPC_DEED_COOLDOWN_MS`,
  the bands `standingOf` (`hostile` / `wary` / `neutral` / `liked` / `trusted`, `STANDING_LABEL`), `townScore`,
  `feelingScore`, `clampStanding`. Later features (haggling, rumours) read the standing through these.

## Followers with field powers (2026-10-21)

- `PlayerState.lead` (string) and `leadFlags` (uint8, `encodeLeadFlags` / `decodeLeadFlags`: shiny, alpha, variant) are
  appended last, so every earlier field index is unchanged; `ZoneState.fieldPowers` likewise. Both written on a change
  only: the follower costs nothing per tick on the wire.
- `InputMsg.glide` (optional): the take-off and the unit direction the server re-plans from. A client sends a separate
  payload object for a glide window, never a `glide: undefined` key (msgpack would carry it as nil, which zod refuses).
- Client message `fieldPower` (25 keys, limit 2 per second) and server message `fieldPower` (28 variants: one flat shape
  for burn / dig / dive / sense, `ghosts` empty except for sense). The refusal details (`FIELD_POWER_REFUSALS`) are named
  so none collides with another flow's (`tooFar` is the raids'): the client's router treats them as explained by the
  server's toast.

## Camp bases (2026-10-22)

- `ZoneState.campOwner` / `campName` / `campTrophies` (strings, appended last; the trophy kinds comma-separated rather
  than an `ArraySchema`, written only when the camp changes).
- Client message `camp { action: 'claim' | 'raid' }` (26 keys, limit 1 per 2 s): claiming and raiding happen at the
  fire, so they go to the zone room, which knows where the player stands; refusals are a toast plus `error notAllowed`.
- `camps` (`GET /camps`), `campEdit` (`POST /camps/edit`), `campAbandon` (`POST /camps/abandon`) (106 routes);
  `CAMP_TROPHY_KINDS` mirrors content's `TROPHY_KINDS` (protocol does not import content).

## NPC side quests (2026-10-24)

- Routes `npcQuests` (`GET /npc/quests`, the journal), `npcQuest` (`GET /npc/quests/:npcId`: the open favour with that
  NPC and what it would ask now, `next`, or why not), `npcQuestOffer`, `npcQuestAnswer` (accept / decline / abandon),
  `npcQuestClaim`. Schemas `NpcQuestObjectiveSchema` (catch / defeat / show / deliver / visit), `NpcQuestRewardSchema`,
  `NpcQuestPlanSchema`, `NpcQuestViewSchema`, `NpcQuestRes`, `NpcQuestsRes`, `NpcQuestClaimRes`, and the rules both
  sides read: `NPC_QUEST_OPEN_MAX` (3), `NPC_QUEST_MONEY_MAX` (800), the cooldowns, the offer lifetime, the minimum
  standing, the safe reward and delivery item lists, `NPC_QUEST_PREFIX` / `npcQuestKey` (a favour's `questProgress`
  entry is `npc:<id>` / `main`).
- `NPC_DEEDS` gains `helped` (+2, `NPC_DEED_DELTA`): the server records it at the hand-in; it is not a talk deed.

## Battle commentary banks (2026-10-24)

- `commentary.ts`: `CASTER_BANK_KEYS` / `TRAINER_BANK_KEYS`, `CasterBankSchema` / `TrainerBankSchema` (each key an
  optional array of strings, dropped on its own when it does not parse), `BANK_LINES_MAX`. Client only: the shape the
  local model's line banks must have (LLM feature 3). Nothing goes over the wire; it lives here because the client
  reaches zod only through this package.

## Shop haggling (2026-10-24, not in the SPEC)

- `rest.ts` "shop haggling": `POST /shop/haggle` (`shopHaggle`: `HaggleReq` { npcId, kind discount | markup, percent
  1..`HAGGLE_PERCENT_MAX` }, `HaggleRes` { deal, granted, keeper }), `HaggleDealSchema`, `HaggleKeeperSchema` and the
  rules both sides read: `HAGGLE_DISCOUNT_CAP` by standing (hostile 0, wary 5, neutral 10, liked 20, trusted 25),
  `HAGGLE_MARKUP_MAX` (25), `HAGGLE_DEAL_MS` (10 min), `HAGGLE_COOLDOWN_MS` (2 min), `HAGGLE_WINDOW_MS` (1 h),
  `haggleFactor` (1, 1/2, 1/4, then 0 per discount won in the window), `dealBuyPrice` / `dealSellPrice` (the client
  shows and the server charges the same numbers; a sell price under a deal stays below the buy price under it) and
  `shopkeeperName` (content calls every keeper "Shopkeeper"; a name from the id, the same on both sides).
- `ShopRes` moved below the haggling section and gained two optional fields, `deal` and `keeper` (absent with
  `NPC_TOOLS` off, so older readers and the progression walker see the same body).
- `NPC_DEEDS` gains `haggledRudely` (-1): the server records it when a haggle ends in a markup. A discount given is
  recorded as the existing `giftReceived` (0). Rudeness itself (an insult, a threat) is still the conversation's talk
  deed, written when the talk ends; a new server-only deed keeps the markup from counting that insult twice.
- Route count 114 → 115.

## A recurring rival (2026-10-24, not in the SPEC)

- `src/rival.ts` (exported from the index): `RivalViewSchema` (name, look, temperament, signature root, arc, the record,
  the last meeting with the rival's parting `words`, and a team of `{ speciesId, level }`), `RivalRes` { enabled, rival }
  for `GET /rival` (`rival` null before the first battle; `enabled` false with the server's `RIVAL=off`),
  `RivalWordsReq` { text, 1..200 } for `POST /rival/words`, and `RivalMsg`.
- A new server message `rival` { phase: near | approach, x, z, rival }: `near` the rival is on this route (the client
  pre-writes its taunt; nothing shows), `approach` it stepped out at (x, z) and holds the player like `trainerSpotted`.
  The client's answer is the existing `interact { kind: 'npc', targetId: 'rival:<name>' }`, so no client message is
  added. Server messages 28 → 29.
- Route count 115 → 117 (`rival`, `rivalWords`).
