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

`test/*.test.ts` run under the root vitest config. Each file opens one fresh in-memory PGlite and
applies the committed migration through `drizzle-orm/pglite/migrator` (`openTestDb`). With
`DATABASE_URL` set, the same helper opens node-postgres, truncates the persist tables, and the
otherwise-skipped concurrency suite in `market.test.ts` runs: 20 concurrent equal bids → exactly one
`fulfilled`, 19 `BidTooLow`; 20 concurrent `buyNow` → one sale, 19 `ListingClosed`, one
`creature.transfer` audit row. PGlite is single-connection and cannot exercise `FOR UPDATE`
contention, which is why that suite is gated.

Run against a real database with something like
`DATABASE_URL=postgres://user:pass@localhost:5432/ewamon_persist_test pnpm exec vitest run packages/persist`
(the helper **truncates** the persist tables in that database — use a dedicated one).

Not yet written: `src/seed.ts` (§5.4 demo players with the three starters) — the server package
owns creature construction (species/moves/hp come from `@ewa/core`), so the seed waits for it.

## Verified on real Postgres (2026-09-18)

The full suite (55/55, including the three `DATABASE_URL`-gated 20-way concurrency tests) passed
against PostgreSQL 17.6 (the local `supabase-db` container, throwaway database `ewamon_persist_test`).
The root `vitest.config.ts` disables file parallelism when `DATABASE_URL` is set because all test
files share that one database; with PGlite (default) each file has its own in-memory instance.

```bash
DATABASE_URL=postgres://postgres:<pw>@127.0.0.1:54322/ewamon_persist_test pnpm exec vitest run packages/persist
```

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
