# @ewa/persist — implementation notes

Deviations from `.design/spec/00-spine.md` §5 and the reasons for each. The spec is binding; every
item here either adds to it without contradicting it, or resolves something the spec leaves open.
Nothing in the spec was edited.

## Schema (§5.1) — three additions, no removals

| Table | Addition | Why |
|---|---|---|
| `players` | `CHECK players_money_ck (money >= 0)` | Defence in depth behind `PlayerRepo.addMoney`, whose `WHERE money + delta >= 0` guard is the primary mechanism. A raw write can never produce negative money. |
| `creature_instances` | `creature_party_slot_ck` allows `slot_index BETWEEN 100 AND 105` in addition to `0..5` for `slot_kind = 'party'` | `reorderParty` is the spec's two-phase renumber ("slot_index += 100, then final"). The spec's own check (`between 0 and 5`) would reject phase one. The band is transaction-local: the same transaction always renumbers back into 0..5, and `swap` uses the same parking trick for one row. Tests assert nothing is left parked. |
| `friendships` | `UNIQUE INDEX friendships_pair_uq ON (least(requester_id, addressee_id), greatest(requester_id, addressee_id))` | The spec's PK `(requester_id, addressee_id)` allows both A→B and B→A rows. One row per unordered pair is what the REST surface (`/friends/request|accept|decline|remove`) assumes; `requestFriend` turns a reverse request into an acceptance of the pending row instead of inserting a mirror. |

Everything else — columns, types, defaults, enums, indexes, FKs, `ON DELETE` behaviour — matches
§5.1 exactly. `drizzle-kit generate` against the committed snapshot reports "No schema changes".
The schema lives in `src/schema/*.ts` (one file per area, all re-exported from `src/schema/index.ts`)
rather than a single `schema.ts`; `drizzle.config.ts` globs the folder.

## Repository signatures (§5.2)

- **Explicit clocks.** Every method that stamps a time takes `now: Date` as its last parameter
  (`create`, `transferCreature`, `placeBid`, `buyNow`, `cancel`, `closeExpired`, `awardBadge`,
  `issueRefresh`, …). Persist never reads the wall clock, so tests are reproducible and a request
  has one meaning of "now". `MarketQuery.now` exists for the same reason.
- **`toPublic(row, extras)`.** §5.3's `PublicProfile` includes `badges`, `guildTag`,
  `dexCaughtCount` and `showcase`, none of which live on the `players` row, so the pure function
  takes them as a second argument. `playerRepo.publicProfile(tx, id)` gathers them from the
  database and calls `toPublic`. `guildTag` is `string | null` (a player may be in no guild).
  The allow-list is also exported as `PUBLIC_PROFILE_KEYS` and asserted key-for-key in tests.
- **`lockForTransfer` / `lock` return `CreatureRecord`**, a `CreatureInstance` plus
  `slotKind`/`slotIndex`/`version` — persist-side facts core does not model.
- **`createRepos(db)`** returns the stateless repository objects (they take `tx` explicitly) plus
  `db`, so one handle can be carried around. A `battlePass` repo (claims + level-50 mythical
  choice, backing `/battle-pass/*`) is included beyond the spec's list.
- **Extra error codes.** `PersistError.code` is a closed union; beyond the spec's names it adds
  `BidAboveBuyNow` (a bid ≥ `buyNowPrice` must use `buyNow`), `ListingHasBids`, `NoBuyNow`,
  `InsufficientItems`/`InventoryOverflow` (the spec's "Insufficient" for inventory), `PartyFull`,
  `InvalidSlot`, `InvalidReorder`, `NotInEscrow`, `GuildFull`, `AlreadyInGuild`, `GuildNameTaken`,
  `UsernameTaken`, `EmailTaken`, `AlreadyClaimed`, `Forbidden`, `InvalidArgument`, `NotFound`.
- **`closeExpired`** is the spec's expiry job (the task brief calls it `expireDue`).

## Locking discipline

Every multi-row lock is taken in the same global order so no two transactions can deadlock:

1. `listings` row (`FOR UPDATE`; `SKIP LOCKED` in `closeExpired`)
2. `players` rows, ascending uuid (`playerRepo.lockMany` → `sortIds`)
3. `creature_instances` rows, ascending uuid (`ORDER BY id … FOR UPDATE` in trades)
4. `guilds` row for membership changes (the 50-member cap is counted under this lock)

`moveToSlot` and `release` peek the owner without a lock, lock the owner, then lock the creature and
re-check the owner (`lockOwnerThenRow`) — the earlier creature-then-owner order would have deadlocked
against a concurrent `transferCreature`.

## Transaction contract for callers

A `PersistError` thrown inside `db.transaction` rolls everything back **only if it propagates**.
Several methods write before they can fail — `placeBid` refunds the previous bidder before charging
the new one (spec order), `completeTrade` moves money before creatures — so a caller must never
catch a `PersistError` inside the transaction and carry on. The tests model this with
`rejectsInTx` (one transaction per failing call) and assert that escrow is untouched afterwards.

## Behavioural decisions the spec leaves open

- **`cancel` with bids is refused (`ListingHasBids`)**, per §5.2 ("assert … currentBid === null").
  Consequently there is no "cancel refunds the bidder" path: the escrow of the current bidder is
  never stranded because the listing stays active and settles at expiry (`closeExpired` → sold).
- **`release` refuses a creature that has ever been listed** (`InvalidArgument`). `listings.creature_id`
  references `creature_instances.id` with the spec's default `ON DELETE NO ACTION`, so deleting such
  a row would violate the FK. Keeping the history intact was preferred over widening the FK. A
  follow-up could soft-delete instead.
- **Raising your own bid** refunds the previous escrow and charges the new amount inside one
  transaction, so the player needs only the difference on hand.
- **Guild founding costs `GUILD_CREATE_COST` (5000)** by default, charged in the same transaction;
  callers may pass `cost: 0`. Not in the spec; easy to remove.
- **`inventory.add` deletes the row when qty reaches 0** so `all()` never lists zero-quantity items.
- **Constants copied from the spine** (`MARKET`, `MIN_BID_INCREMENT`, `RANK_TIERS`, `tierFor`,
  `trainerLevelFor`) and **types copied from §2** (`CreatureInstance`, `MoveSlot`, `StatusId`,
  `Action`, `RngState`, `ZoneId`, `BadgeId`, `RewardsSummary`) live in `src/constants.ts` /
  `src/types.ts` until `@ewa/core` and `@ewa/content` export them; each carries a `TODO(core|content)`
  to become a re-export. Shapes are verbatim so the switch is mechanical.

## Tests (§5.4)

`test/*.test.ts` run under the root vitest config, on the Postgres of `EWA_TEST_DATABASE_URL` (default the
docker-compose `postgres` service, `postgres://ewa:ewa@localhost:5432/ewa`). Each file opens a scratch database of its
own (`openTestDb` → `openScratchDb`, `src/scratch.ts`): a `CREATE DATABASE … TEMPLATE ewa_tpl_<hash>` copy of a
template that already holds every committed migration (built once per migration set, under an advisory lock, named
by a hash over `./drizzle`), dropped again on `close()`. Files therefore keep running in parallel, and the
concurrency suite in `market.test.ts` always runs: 20 concurrent equal bids → exactly one `fulfilled`, 19 `BidTooLow`;
20 concurrent `buyNow` → one sale, 19 `ListingClosed`, one `creature.transfer` audit row. The root
`vitest.setup-db.ts` names each run (`EWA_TEST_RUN`) and drops that run's leftovers, and any older than six hours,
at the end.

Not yet written: `src/seed.ts` (§5.4 demo players with the three starters) — the server package
owns creature construction (species/moves/hp come from `@ewa/core`), so the seed waits for it.

## Verified on real Postgres (2026-09-18)

The full suite (55/55, including the then `DATABASE_URL`-gated 20-way concurrency tests) passed against PostgreSQL
17.6. Superseded by "PGlite removed" below: every run is on Postgres now.

## Server part 2 additions (2026-09-25)

Migration `0001_battle_replay`: `battle_history.start jsonb` (`BattleStartSnapshot` — the `createBattle` input minus
the seed) and `battle_history.final_digest varchar(8)`, both nullable, so a battle replays from the database alone.
Repository additions for the server's part-2 routes: `playerRepo.byIds / search (escapeLike + ESCAPE '\') / counts`,
`leaderboard` gains `'dex'` and excludes banned players in SQL, `progressRepo.markSeen` returns whether the species
was new, `claimObjective`, `pruneSyntheticQuests`, `marketRepo.closeExpiredDetailed` (`closeExpired` delegates).
Tests: `test/admin-replay.test.ts`; `migrations.test.ts` now compares the migration count with the journal.

## Phase C6 additions (2026-10-06)

Migration `0002_email_tokens` (generated by `drizzle-kit generate --name email_tokens`): `players.email_verified_at`
(nullable timestamptz) and the `email_tokens` table (`id`, `player_id` → players cascade, `kind` varchar(8) with the
check `email_tokens_kind_ck` in ('reset', 'verify') — a check instead of a pg enum keeps the enum list of §5.1 at five,
`token_hash` unique, `expires_at`, `used_at`, `created_at`; index `(player_id, kind)`). Repository additions:
`authRepo.issueEmailToken(tx, playerId, kind, ttlMs, now)` (supersedes older unused tokens of the kind),
`consumeEmailToken(tx, token, kind, now)` → `{ ok, playerId } | { ok: false, reason: 'unknown' | 'expired' | 'used' }`
under FOR UPDATE (expiry exclusive at `expires_at`), `purgeEmailTokens(tx, before)`; `playerRepo.markEmailVerified(tx,
id, now)` (first stamp kept). Tokens reuse `hashRefreshToken` (sha-256 hex). Tests: `test/email-tokens.test.ts`,
`migrations.test.ts` (19 tables, the 0002 column/table/indexes/check).

## Phase D4 — shinies (2026-10-06)

Migration `0003_shiny` (generated by `drizzle-kit generate --name shiny`): `creature_instances.is_shiny`,
`dex_entries.shiny_caught`, `listings.is_shiny` — all `boolean NOT NULL DEFAULT false`. `rowToCreature` adds
`isShiny: true` only when set (a normal creature keeps its exact pre-D4 key set); `creatureToColumns` writes
`isShiny === true`. `markCaught(…, now, isShiny = false)` ORs into `shiny_caught` (never cleared); `dex()` returns
`shiny: string[]`. `ListingView.isShiny`, `ClosedListing.isShiny`, `MarketQuery.isShiny` (search filter).
`BattleStartSnapshot.weather?` (Phase D7, jsonb, no migration). Phase D5: `progressRepo.caughtCount(tx, playerId)`.
Tests: `test/shiny.test.ts` (4); `players.test.ts` dex expectation gains `shiny: []`.

## Phase D6 — doubles (2026-10-06)

- Types only (no migration): `Action` move gains `target?`; `ReplayChoice = Action | null | [Action | null, Action | null]`
  and `battle_history.actions` is `[ReplayChoice, ReplayChoice][]` (jsonb); `BattleStartSnapshot.slots?: 2`.

## Phase D14 — battle tower streaks (2026-10-06)

- Migration `0004_player_streaks` (drizzle-kit generated): `player_streaks (player_id uuid PK → players cascade, current
  int ≥ 0, best int ≥ current, updated_at)`, index on `best`. Schema `src/schema/streaks.ts`.
- `streakRepo` (`Repos.streaks`): `get`, `byPlayers`, `recordWin` (upsert current + 1, best = greatest(best, current + 1)),
  `endRun` (current 0), `leaderboard(page, size)` (best > 0, banned excluded, best desc, current desc, username_lower).
- `BattleStartSnapshot.noExp?: true` (jsonb, no migration).
- Tests: `test/streaks.test.ts` (3); `migrations.test.ts` lists `player_streaks`; `helpers.ts` truncates it.

## Phase E5 — the §50.4.4 test files (2026-10-06)

- **File names now follow §50.4.4.** The slot cases moved from `creatures.test.ts` to `slots.test.ts`, the
  transfer / release cases to `transfer.test.ts`, the `toPublic` cases from `players.test.ts` to `public.test.ts`
  and the refresh-token cases to `auth.test.ts`. They moved verbatim; nothing is duplicated. New assertions per row:
  - `slots.test.ts`: the party-slot duplicate through the unique index; `creature_party_slot_ck` (rejects 6 / 99 / 106,
    accepts 0..5 and 100..105); a committed 0↔1 swap leaves no row in the staging band; `nextBox` = max + 1.
  - `transfer.test.ts`: the refusals leave both players' rows byte-identical (`canonicalJson`, row count, audit
    count); exactly one audit row; `release` of a creature that was ever listed → `InvalidArgument`.
  - `public.test.ts`: an extra column on the row never reaches the profile; a guildless `guildTag` is null.
  - `auth.test.ts`: `revoked_at` stamped on rotation; `purge` removes only expired / revoked rows before the cutoff; a
    frozen clock produces identical rows. The argon2id `m=19456 t=2 p=1` read-back is a server fact (persist stores
    the PHC opaquely) and stays in `packages/server/test/rest-auth.test.ts`.
  - `battle-pass.test.ts` and `escape-like.test.ts` are new.
- `migrate.test.ts` is `migrations.test.ts`; the market / trade / inventory / social rows already matched.
- **Defect fixed: `insert` into a taken party index threw `InvalidSlot`.** Spine §5.2 says `PartyFull` ("when party
  index taken / party has 6"). `creatureRepo.insert` now checks this before `resolveSlot`. A party index ≥ 6 is still
  `InvalidSlot`. No server caller relied on the old code: every caller computes a free index first.
- **Defect fixed: `setMythicalChoice` created a missing level-50 row.** Spine §5.2 says "requires the level-50 row".
  Together with a route that never checked the trainer level, this let a level-1 account claim a level-50 mythical
  through `POST /battle-pass/mythical-choice`. The method now throws `Forbidden` without the row and `AlreadyClaimed`
  on a second choice. The server route now claims level 50 itself, gated on trainer level (server notes, Phase E5).

## Migration 0005_honor (2026-10-08)

`creature_instances.honor smallint NOT NULL DEFAULT 0` — the honor ledger (core `honor.ts`). `rowToCreature` emits `honor` only
when non-zero, like `isShiny`, so every other creature keeps its exact shape; `creatureToColumns` writes `c.honor ?? 0`.
No check constraint: core clamps to ±10 and the wire schema validates the range. Test: `test/honor.test.ts`.

## Migration 0006_battle_shares (2026-10-20)

- `battle_shares (token varchar(16) PK, player_id → players cascade, battle_id uuid, replay jsonb, created_at)`, unique
  `(player_id, battle_id)`. `replay` is the server's `SharedReplay` (anonymised, frozen at share time), opaque to
  persist like `BattleStartSnapshot`.
- `historyRepo.createShare` inserts with `on conflict do nothing` and then reads the player's share of that battle, so a
  concurrent share of the same battle returns the one that won; null means the token already belongs to another share
  (the caller retries with a fresh token).

## Migration 0007_creature_history (2026-10-20)

- `creature_instances.original_trainer_id` (→ players, `on delete set null`) and `original_trainer_name` (the
  username then, so it outlives the account), written by `creatureRepo.insert` from the locked owner row. Older rows
  stay null: the client says "Not recorded" rather than guessing a history from the current owner.
- `creature_events (id, creature_id → creature_instances cascade, kind, detail jsonb, at)`: `insert` writes `met`
  (`caught` at the catch time when `caughtAt` is set, else `received` at now); `transferCreature` writes `traded` /
  `sold` / `gift` with both usernames; `addEvent` / `history` for the server. `history` orders by `at`, then `id`.
- Not part of `CreatureInstance` (core's type is battle state): the history is read on demand.

## Migration 0008_daily_results (2026-10-20)

- `daily_results (player_id, day_key)` PK: `attempts` and the best win (`turns`, `marks`, `battle_id`, `won_at`, null
  until the first win). `dailyRepo.record` locks the row (`for update`), adds the attempt and replaces the best only
  for fewer turns, so a tie keeps the earlier win. `winners` and `leaderboard` leave banned players out.

## Challenge modes (2026-10-20)

- No migration: a run is story flags and a fallen creature a ribbon. `progressRepo.challengeBoard` takes the flags
  from the server (persist knows no content) and orders cleared runs (earliest clear first), then going, then failed,
  each by a badge-count subquery.

## Migration 0009_play_clock (2026-10-20)

- `players.play_ms` (banked) and `players.play_started_at` (set while a room holds the player): the clock now is
  `play_ms + (now - play_started_at)`, one SQL expression (`clockNow`), so `runRepo.split` writes inside any
  transaction without a server-side timer. `start` keeps a running clock (a crossing), `stop` banks it, `stopAll`
  (boot) stops stale clocks without charging the gap. `run_splits` keeps the first time of each split.

## Migration 0010_weather_city (2026-10-20)

- `players.weather_city jsonb` (`WeatherCity { name, country, lat, lon }`, null: off) and `players.setWeatherCity`.
  The server rounds the coordinates before storing them; nothing else about the place is kept.

## Migration 0011_seasons (2026-10-20)

- `seasons` (the close's lock row) and `season_results`. `seasonRepo.close` inserts the row first (`on conflict do
  nothing`): only the inserting transaction writes the standings and resets the ratings. Participants are read from
  `battle_history` rows with a `rating_delta` in the season window (no new per-battle bookkeeping); their order is
  rating at the close, then wins, then name.
- The reset is `1000 + (rating - 1000) / 2` in SQL; Postgres integer division truncates towards zero, the same as
  content `seasonResetRating`.

## Migration 0012_world_honor (2026-10-20)

- `world_honor (season, zone_id, light, shadow)`; `worldHonorRepo.add` is one upsert adding to both columns, so turns
  in different rooms never lose each other's points.

## Migration 0013_season_factions (2026-10-20)

- `season_factions`: one row per (season, player). `join` inserts once and reads back the side held, so a second
  request for the other side cannot switch it. Side totals are a `group by` over the rows (no separate counter to
  keep in step).

## Migration 0014_season_legends (2026-10-20)

- `season_legends`, one row per season; `claim` is an insert that does nothing on conflict, so two catches in the same
  moment cannot both be first. `player_id` is set null when the account goes; the name stays.

## Migration 0015_ghosts (2026-10-20)

- `ghosts` holds the party as `CreatureInstance[]` JSON at the moment of leaving (a snapshot: later changes to the
  real creatures do not reach it until the next leave). `report` marks fights told in the same statement that returns
  them, so two joins cannot both tell the same fight.

## Migration 0016_breeding (2026-10-21)

- Creatures at the Daycare are rows in a new slot kind `daycare` (an `ALTER TYPE ... ADD VALUE`), like `listing`: out
  of every party / box read, so trades, the market, release, battles and the arena never see them. Slot index = the
  order they were left (`nextBox` within the kind).
- Eggs are their own table, not creature rows: an egg never takes a party slot, so none of the party paths (battles,
  arena copies, ghosts, the tower, trades) can meet one. Everything the hatchling inherits is fixed when it is laid.
- `creatures.insert` takes an optional first history event (`hatched`) in place of `met`; `bandborn` is a column.

## Nemeses (2026-10-21)

- Migration `0017_nemeses` (drizzle-kit generated, renamed from its random tag): one `nemeses` table; `status` keeps the
  ended ones (`beaten`, `caught`, `faded`) instead of deleting them, so a later trophy view can read them. `rise` fades
  the oldest past the cap in the same transaction.
- History event `nemesis { how: 'beaten' | 'caught', name, speciesId, rank, zoneId }` needs no migration
  (`creature_events.kind` is a varchar and `detail` jsonb).

## A living ecosystem (2026-10-21)

- Migration `0018_ecosystem` (drizzle-kit generated): one `eco_takes` table keyed by (zone, week, species) with catches
  and knockouts. Rows are never pruned: a week is a handful of rows per zone, and only this week and last are read.

## The bounty board (2026-10-21)

- Migration `0019_bounties` (drizzle-kit generated, renamed from its random tag): one `bounties` table for the three
  kinds. A partial unique index keeps one open game bounty per ghost. Nemesis claims are written as already-claimed
  rows (never open) so the daily claim cap counts every kind with one query; the public lists leave them out.
- `claim` picks the candidates, then marks each with an update guarded by `status = 'open'`, so a bounty is claimed
  once even if two battles end in the same moment. `expireDue` is one update returning the rows, so each refund is paid
  once. Money is never moved here: the server does it next to the audit row.
- `ghostRepo.everywhere` (every ghost still haunting, banned owners left out) for the board's postings and its list.
- History event `bounty { target, targetKind, reward, zoneId }` needs no migration (`creature_events.kind` is a varchar).

## NPC memory (2026-10-24)

- Migration `0021_npc_memory` (drizzle-kit generated as 0020, renamed: main's `0020_camps` keeps its number, so a
  merge slots it in before this one; the journal entry's `idx` is 21 and its `when` the generation time). One
  `npc_memories` table keyed by (player, npc): `zone_id` (the zone the NPC stands in; interior residents carry their
  town), a rolling `summary` (varchar 400), `standing` smallint checked -10..10, the last five `deeds` as jsonb
  `{ deed, at }`, `talks`, `updated_at`; an index on (player, zone) for a town's reputation in one read. A player's rows
  go with the player (cascade).
- `npcMemoryRepo.remember` creates the row on first contact, locks it, clamps the standing, rolls the summary
  (`rollSummary`: older sentences drop off the front past the cap) and keeps the last five deeds. The deltas and the
  cooldowns are the server's (`game/npcMemory.ts`); the repo only bounds what it stores.
- Note for the next migration: drizzle-kit numbers a new file by the journal's entry count, so the next one comes out
  as `0021_*` too and needs the same rename (to 0022).

## Camp bases (2026-10-22)

- Migration `0020_camps` (drizzle-kit generated, `--name camps`): `camps` keyed by zone with a unique owner (one owner
  per camp, one camp per owner: `claim` is an insert `on conflict do nothing`, so two claims racing write one row), and
  `camp_raids` (the owner's log with a `seen` flag like `ghost_battles`, the raider's daily cooldown, `held` for the
  faction points). Trophies are stored as they were set (id, kind, label), so a renamed nemesis or a pruned bounty never
  changes a camp. The guard is a jsonb party snapshot like a ghost's.
- `transfer` names the owner it takes from, so a takeover after the owner abandoned (or someone else took it) writes
  nothing. Money is never moved here: the server does it next to the audit row.
- `nemesisRepo.ended` and `bountyRepo.claimedBy` for the trophies.

## NPC side quests (2026-10-24)

- Migration `0022_npc_quests` (drizzle-kit named it 0022 itself: the journal has 0020_camps from main now, so no
  rename). One `npc_quests` table, a row per favour an NPC asked of a player: `npc_id`, `zone_id` (where the NPC stands:
  the hand-in), `seq` (that NPC's favours for the player, numbered; it seeds the next one), `status` (checked:
  `offered` / `active` / `claimed` / `declined` / `abandoned` / `expired`), the `objective` and `reward` as jsonb
  (protocol `NpcQuestObjective` / `NpcQuestReward`, typed loosely here since persist does not import protocol),
  `target` / `progress`, `created_at` / `accepted_at` / `closed_at`. A partial unique index keeps one open (offered or
  active) favour per player and NPC; indexes on (player, status) and (player, npc). A player's rows go with the player.
- `npcQuestRepo`: `open`, `ofNpc` (newest first), `claimed` (the journal), `lock`, `offer`, `setStatus` (stamps
  `accepted_at` / `closed_at`), `setProgress` (never past the target), `expireOffers`. The caps, the cooldowns and the
  rewards are the server's (`game/npcQuests.ts`).

## A recurring rival (2026-10-24)

- Migration `0023_rivals` (drizzle-kit named it 0023 itself, `--name rivals`; the journal entry's `when` is the
  generation time). One `rivals` table keyed by player (cascade): the identity as drawn (`name`, `look`, `temperament`,
  `signature`: stored, so a world seed that changes between boots never renames the rival), the record (`player_wins`,
  `rival_wins`, `draws`, `meetings`, checked non-negative), the last meeting (`last_result` checked won / lost / draw
  from the player's side, `last_zone`, `last_met_at`, `last_team` jsonb `{ speciesId, level }[]`, `last_words` varchar
  200), `next_at` (the end of the cooldown) and `created_at`.
- `rivalRepo`: `of`, `ensure` (insert on conflict do nothing, so a second call keeps the first identity),
  `recordMeeting` (under a row lock: the counts, the last meeting, its words cleared, `next_at = now + cooldown`),
  `setWords` (one update guarded by `last_words is null` and `last_met_at` inside the window: the words are taken once
  per meeting). The rules and the cooldown length are the server's.
- Tests: `test/rivals.test.ts`; `migrations.test.ts` lists the table.

## The rumour board (2026-10-24)

- No table: `worldNewsRepo` (`repos/worldNews.ts`, `repos.worldNews`) reads what other tables already keep, across
  players, read-only: `badgesBetween` (badges in a window with the username), `splitsBetween` (a run split such as
  `champion`), `campTakeovers` (won raids that took a camp over, with the raider's name as the camp shows it),
  `risingNemeses` (active nemeses last seen in some zones from a rank, by their own name, never their trainer's) and
  `salesBetween` (sold listings with their price). Banned players are left out of the named reads; every list is
  capped and fully ordered, so the same rows come back in the same order.
- Names: only what is already public. The rankings and public profiles show usernames and badges (there is no opt-in
  there to follow), camps show their holder, the bounty board its claimers.
- Tests: `test/world-news.test.ts`.

## The adventure journal (2026-10-24)

- Migration `0024_journal` (drizzle-kit generated, `--name journal`; the journal entry's `when` is the generation
  time): one `journal_entries` table keyed by (player, UTC day `YYYY-MM-DD`), cascade with the player: `day_number`
  (checked at least 1), `text` varchar 600 (checked 1 to 600 characters), `facts` jsonb (the digest the entry was
  written from, `JournalFactJson`, typed loosely since persist does not import protocol) and `written_at`.
- `journalRepo` (`repos/journal.ts`, `repos.journal`): `entry`, `entries` (newest day first, before a day when asked),
  `write` (an upsert: the caller decides who may write a day twice), and the reads behind a day's digest, each inside
  [from, to) and the player's own: `creatureEvents` (creature history joined to the creatures the player owns now, with
  species, nickname, shiny and alpha), `battles` (with the zone from the replay start snapshot), `audit` (chosen
  actions), `badges`, `splits` (run splits) and `memories` (every NPC's memory of the player; the deeds carry times).
  Every read is capped (`JOURNAL_READ_MAX` 400) and fully ordered.
- Tests: `test/journal.test.ts`; `migrations.test.ts` lists the table.

## Dex research (2026-10-26, not in the SPEC yet)

- Migration `0025_dex_research` (drizzle-kit generated, renamed to `0025_dex_research` in the file and the journal):
  `dex_entries.counters` jsonb NOT NULL DEFAULT `{}` (counter id to count), `first_seen_zone` varchar(32) and
  `viewed_at` timestamptz, both nullable; a `dex_rewards` table (player, `reward_id` varchar 64, `claimed_at`), primary
  key (player, reward), cascade with the player. A hand-written UPDATE at the end of the migration backfills existing
  entries: seen 1, caught 1 when caught, alpha 1 when `alpha_seen`, variant = the non-normal variants on record, and
  `viewed_at` = `COALESCE(caught_at, seen_at)` so an old collection shows no "new" markers.
- `progressRepo.markSeen(tx, player, species, now, { zone?, also? })` is an upsert (`RETURNING xmax = 0` tells a new
  row) that counts every sighting in `counters.seen` plus `also` (`seenNight`, `seenWater`) and keeps the first zone.
  `markCaught` counts `caught`, `variant` for a non-normal variant and `alpha`; a row it creates also counts seen 1.
  `bumpCounter` / `bumpCounters` add to an existing entry only (one atomic `counters || jsonb_build_object(...)`
  statement; nothing is created, so a counter never makes a species seen); every counter is capped at
  `DEX_COUNTER_MAX` (1,000,000). `counters(tx, player, speciesIds)`, `markViewed`, `claimReward` (idempotent, true on
  the first claim) and `claimedRewards`. `dex()` / `DexSummary` gained `entries` (seenAt, caughtAt, counters,
  firstSeenZone, viewedAt per species).
- Tests: `test/dex-research.test.ts` (6, incl. the backfill statement); `migrations.test.ts` lists `dex_rewards`.

## PGlite removed (2026-10-27)

Production runs on a VPS with a real PostgreSQL, so the PGlite driver is gone: `createDb({ url })` is node-postgres
only (`url` required, `kind` and the `pgliteDir` option dropped; `AnyDb` is the opened database with `drizzle` and
`pool`). The dev database is the docker-compose `postgres` service (`DEV_DATABASE_URL`, `ensureDatabase` creates a
missing one in development). Tests run on scratch databases (see Tests). `src/migrate.ts` without `DATABASE_URL`
migrates the dev database instead of an in-memory PGlite.

## Talking to other players (2026-10-28)

- Migration 0026: `players.dms_from` (`'everyone'` default) and `player_blocks (blocker_id, blocked_id)` with a not-self
  check and an index on `blocked_id`. `socialRepo.block` also deletes any friendship row between the two.
