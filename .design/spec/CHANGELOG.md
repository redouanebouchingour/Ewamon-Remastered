# `.design/spec/` CHANGELOG

Format per `50-verification-budget.md` §50.7 rule 2: `## <date> — <file> §<section> — <one-line change>`, then `Why`, `Evidence`, `Affects`. Newest entry at the top. Every entry below is the 2026-09-18 reconciliation pass that produced the first assembled `.design/SPEC.md`; each edit in the part files carries a `<!-- reconciled 2026-09-18: … -->` mark pointing back here.

Inputs read for the pass: `00-spine.md`, `10-render.md`, `20-client.md`, `30-server-netcode.md`, `40-pipelines.md`, `50-verification-budget.md`; `.design/story-bible.md` (§5 beats, §7 legendaries, §11 flags); `.design/roster-coverage.md` (§4–§7, §12, §16); `.design/audits/legacy-render-audit.md` §7 (32 questions); `packages/persist/IMPLEMENTATION-NOTES.md` + `src/repos/*.ts` + `src/schema/*.ts` + `src/errors.ts` + `src/constants.ts`; `packages/core/IMPLEMENTATION-NOTES.md` + `src/index.ts`.

---

## 2026-09-24 — `40-pipelines.md` §40.3.5 — per-map material byte targets become targets, not gates; set budgets bind
Why: the targets assumed RDO shrinks UASTC maps 2–3×. Measured on the full bake it does not: detailed normal maps stay at 0.4–0.85 byte/texel unless quality drops to about 20 dB, so 122 of 363 maps exceed 0.10 / 0.40 MB. Every set budget passes with margin.
Evidence: `tools/material-bake/qa/qa-report.json`; `materials.manifest.json` fieldBytes 21.92 MB, heroBytes 33.77 MB, total 55.69 MB; Mirevale field 3.71 MB.
Affects: `tools/material-bake/test/budget.test.ts` (over-target allowed only with `rdo: 4` and < 3× target, listed in the QA report); `tools/material-bake/IMPLEMENTATION-NOTES.md`.

## 2026-09-24 — `40-pipelines.md` §40.1.6.3–§40.1.6.4 — binary atlas alpha, atlas-level transparent-RGB rule, exact binary mip coverage; measured byte arithmetic; acceptance tests 4, 5, 7 rebased on measurements
Why: the first full v2 build failed the 35 MiB budget at the bottom rung (47.3 MB). Lossless WebP alpha of the soft lanczos silhouette cost a third of every albedo file although alpha-tested billboards never show soft alpha. Binary alpha shipped the set at the top rung (36.25 MB, q88 / q92). Acceptance test 4 applied atlas-wide mean figures to each sprite's worst 64×64 edge crop, so about half the sprites failed at the best quality the budget allows; test 5's ± 2 on every flat texel and test 7's transparent-RGB claim were never measured before this run (libwebp rewrites RGB under `a = 0`; `sharp` has no `exact` flag).
Evidence: `tools/sprite-pipeline/README.md` measured table; `tools/sprite-pipeline/qa/qa-report.json` (rungsTried, 0 actionable); distributions quoted inline in §40.1.6.4; `pnpm exec vitest run tools/sprite-pipeline` 57/57.
Affects: `tools/sprite-pipeline/src/{types,mips,pipeline,index}.ts` (`PIPELINE_VERSION` 4, `SPRITE_STAGE_VERSION`, `ALPHA_THRESHOLD`, `binarizeAlpha`, `selectBinaryCoverage`, `cleanTransparentRgb` on the atlas); `test/encoding.test.ts`; `packages/client/public/creatures/`.

## 2026-09-23 — `50-verification-budget.md` §50.4.3 — `rest.test.ts` row: ServerMessage variant count 17 → 16
Why: the count was stale. The `ServerMessage` union in `00-spine.md` §4.4 declares 16 variants (battleStart, battleEvents, battleResync, battleEnd, inventoryDelta, progressionDelta, handover, challengeReceived, challengeResult, tradeUpdate, raidEvents, chat, dm, storyBeat, toast, error); the lower-numbered section wins.
Evidence: `packages/protocol/test/server-messages.test.ts` "lists the 16 variants of the §4.4 block"; HANDOFF.md outstanding note.
Affects: `.design/spec/50-verification-budget.md` §50.4.3 only; no code change.

## 2026-09-18 — `.design/SPEC.md` — first assembly of the binding SPEC from the six part files
Why: `PLAN.md` and `spec/README.md` name `SPEC.md` as the binding contract; it did not exist.
Evidence: `.design/spec/assemble.mjs` concatenates `00`…`50` in filename order behind a 40-line header and a generated table of contents; §50.7 rule 5 (no redefined exported identifier) checked by the script before writing.
Affects: `.design/SPEC.md`, `.design/spec/README.md`, `.design/spec/assemble.mjs`.

## 2026-09-18 — `00-spine.md` §3.11 — Heightfield moved here from `30-server-netcode.md` §30.2.3; `water: Uint8Array`, `isWater`, `playableBounds` added
Why: the sampler is a `@ewa/content` export consumed by the server (validation) and the client (render `ZoneSpec`); a higher section may not define a content export. `10-render.md` §10.6.1 and `20-client.md` OQ 2 / `30` OQ 7 asked for one home. `water` is roster-coverage amendment A2.
Evidence: `30-server-netcode.md` §30.2.3 "DECIDED: it lives in @ewa/content"; eslint import graph spine §0.3.
Affects: `packages/content/src/heightfield.ts`; `10-render.md` §10.5.1 `HeightfieldData`, §10.6.1 `TerrainCollider.water`; `30` §30.2.3 now a reference; tests `heightfield.test.ts`, `collider.test.ts`.

## 2026-09-18 — `00-spine.md` §3.1 — zone extents fixed: fields 160 / 240 / 200 m, 16 m unwalkable margin, playable ±64 / ±104 / ±84
Why: three sections disagreed (`20` ±64 / 128×64 / ±48; `10` 128×128 / 256×128 / 96×96; `30` 160 / 240 / 200). Roster-coverage's authored coordinates (routes to z 104, story zones to z 84) fit only the server's field sizes.
Evidence: roster-coverage §7 statics (`glacinid` −96/−96, `voidraxis` 0/84), §12.4 hotspots (`raid_ascent_pyrothal` 0/104); story-bible §6 zone layouts.
Affects: `10-render.md` §10.5.1 `ZoneSpec.size`, §10.6.1 bounds; `20-client.md` §20.4.4; `30-server-netcode.md` §30.2.3; content `validate.ts` rule 9 (snap or fail); `heightfield.test.ts`.
Factual note on the bibles (not edited): `voidraxis` `(0, 84)` in `the_rift` and `raid_ascent_pyrothal` `(0, 104)` in `ascent_route` sit exactly on the playable boundary; `validate.ts` snaps them inward with `nearestWalkable(h, x, z, 8)`.

## 2026-09-18 — `00-spine.md` §3.1 — `ZoneDef` gains `spawn: { x, z }` and `warps: WarpDef[]`
Why: `30` OQ 4 (join fallback needed a spawn point; the file guessed `(0, 6)`); the `warp` `InteractMsg` kind had no data anywhere.
Evidence: `30-server-netcode.md` §30.2.2 onJoin step 3, §30.4.6 `warp`.
Affects: content zones; `20-client.md` §20.4.4 (`spec.warps`); `10-render.md` §10.5.1 `Marker`/`ZoneSpec.warps`.

## 2026-09-18 — `00-spine.md` §3.2 — roster-coverage amendments A1, A2, A3 accepted; `LegendaryStatic`/`StaticGate`/`SpawnTuning` tables defined here
Why: A1 (4 story tables) is the only home for the 45–60 level band and for `aonred`/`darkyon`/`devourest`; A2 (`medium`) gives HM Surf a consumer; A3 (wild ability roll) makes the `Lightning Rod → aonred` split reachable from a wild `darkone`. §3.10 rule 7 referenced a `LegendaryStatic` record no section defined; roster §4.2 defined it and the tunings under `packages/content`.
Evidence: roster-coverage §4.3, §16 items 1–3; story-bible §7.1.1 (exactly 8 statics, `galaxion` gate `flag:ledger_read`).
Affects: `30-server-netcode.md` §30.3 (`SpawnRecord.ability/medium`, tunings imported, water placement/engagement), §30.4.4 wild row; `50` `counts.test.ts`, `encounters.test.ts`, `statics.test.ts`, `spawn-director.test.ts`.
Factual notes on the bibles (not edited): roster §8's statement that every wild `darkone` carries `Lightning Rod` (ability index 0) is superseded by A3; roster §7's `galaxion` gate `badge:anvil` was a declared placeholder — the bible's `flag:ledger_read` is canonical; roster §4.2's "nobody else may change them" shapes moved verbatim into the spine (the `TOWN_SPAWN_TUNING` name is kept; `30`'s `TOWN_TUNING` with zero counts is gone).

## 2026-09-18 — `00-spine.md` §3.5 — story runtime: `beatDoneFlag`, `nextStoryBeat`, `harvestStateFor`; harvest is per player
Why: story-bible §5.1.2 and §11.3 hand `nextStoryBeat` semantics and the done-marker spelling to the server; no section defined either. `ZoneState.harvestState` was a single shared value, which cannot represent one player's Act II in a shared room.
Evidence: story-bible §5.1.2–5.1.4, §11.3; spine §4.1 `ZoneState`; the 33-beat table validates against §3.5 (fields, 19 zone ids, 44 flags all in §11).
Affects: `30-server-netcode.md` §30.4.8 (new), §30.2.2 step 4; `20-client.md` §20.4.3, §20.4.7; `00-spine.md` §4.1 comment, §4.4 `storyBeat` variant; `story.test.ts`, `story-beats.test.ts`, authority A17.
Factual note on the bible (not edited): §5.1.4 describes harvest transitions as if world-wide ("permanent"); under this SPEC they are per player, derived from that player's done flags. §7.2.1's "`canFlee: false` on the legendary's side" maps to core's `Side.canFlee` on the **player** side (§2.9: `canFlee` is the fleeing side's flag).

## 2026-09-18 — `00-spine.md` §3.10 — validate rules 2, 7, 8, 9 extended; rules 11 (`|Z(zone)| ≤ 16`) and 12 (heightfields) added; report gains `roster`, `Z(zone)`, digests, `dist/heightfields/*.json`
Why: `40-pipelines.md` OQ-4 (sprite planner needs the bind cap and the sets); `10-render.md` OQ 2 (collider fixture); roster OQ 5 (quest givers must exist); legacy-render-audit Q12 (walkable ratio), Q23 (zone ids at build).
Evidence: `40` §40.1.4 arithmetic (8 atlases × 2 species); `.design/audits/legacy-render-audit.md` R-11 (legacy 10.7 % walkable).
Affects: `packages/content/src/validate.ts`; `heightfield.test.ts`, `encounters.test.ts`, `statics.test.ts`.

## 2026-09-18 — `00-spine.md` §3.12 — `BodyDef`/`BODIES`/`TITLES` added
Why: `players.body` defaults to `'ranger_m'` (persist, implemented and migrated) while `40-pipelines.md` ships Quaternius looks named `casual_male …`; a body is a content row mapping to a look, and `POST /profile` needs the value lists it validates against.
Evidence: `packages/persist/src/schema/players.ts` line 18; `40` §40.2.5 `looks`.
Affects: content; `30` §30.6.3 `/profile`; `rest.test.ts`.

## 2026-09-18 — `00-spine.md` §4.3 — `battleResync` is in the `CLIENT_MESSAGES` block (20 keys); unknown message types are dropped, not answered
Why: §4.5 named the message in prose only; `50` §50.4.3 counted "19 plus battleResync". `30` §30.5.1 #1 (no `'*'` handler, count + kick) and `50` A1 (`invalidPayload`) disagreed on unknown types.
Evidence: `@colyseus/core` 0.18 `onMessage` semantics as `30` reads them.
Affects: `packages/protocol`; `50` §50.1.12, authority A1; `30` §30.6.4 `battleResync` limit.

## 2026-09-18 — `00-spine.md` §4.4 — `ServerMessage` gains `chat`, `dm`, `storyBeat`; `handover.seat` widened to `SeatReservation`
Why: `30` OQ 1 (seat was a JSON string), OQ 2 (chat/DM rode `toast`); `20` §20.4.7 expected a `dialogue` message no section defined — NPC lines are content, so `storyBeat` confirms beats instead.
Evidence: `@colyseus/shared-types` 0.18.2 `ISeatReservation`; `30` §30.6.5, §30.7.2.
Affects: `packages/protocol`; `30` §30.2.7 step 4, §30.6.5, §30.7.2, §30.4.8; `20` §20.3.4, §20.4.6, §20.4.7; `rest.test.ts` (17 variants).

## 2026-09-18 — `00-spine.md` §4.5 — PvP `battleResync` sends the opponent's full party (accepted for v1)
Why: `30` OQ 6; no team-preview projection type exists and PvP is challenge-only between players already in the same room.
Evidence: `30` §30.4.3 `battleResync`.
Affects: none beyond documentation; a future projection is a SPEC change.

## 2026-09-18 — `00-spine.md` §4.7 — `POST /zone/enter`, `POST /profile`, `POST /quests/claim`, `GET /admin/metrics` added; `GET /me` gains `presence`, `unreadDm`, `friendRequests`, `liveOps`; guild tag `{2,4}` → `{3,4}`
Why: `30` used all four routes (§30.2.6, §30.5, §30.9.1, §30.10.2) and asked for `presence` (OQ 3); the `{2,4}`/`{3,4}` conflict (OQ 5) — the persist column is `varchar(4)` and a 2-letter tag collides with the HUD's 2-letter type glyphs.
Evidence: `30` §30.2.6 seat flow; `20` §20.9.8.
Affects: `packages/protocol/src/rest.ts`; `20` §20.3.4 `WorldSession.enter`, §20.9.8; `50` `rest.test.ts`, authority A20.

## 2026-09-18 — `00-spine.md` §2.10 — `validateAction(state, side, action, content?)`; `InvalidActionError` exported
Why: folded from `packages/core/IMPLEMENTATION-NOTES.md` items 1–2: `unknownMove`, `statusMoveBlocked`, the item errors and `unknownOrb` cannot be decided without the `ContentIndex`, and the server needs a typed error to map to the wire.
Evidence: `packages/core/src/index.ts` line 53.
Affects: `30` §30.4.2 (already passes content); `validate-action.test.ts`.

## 2026-09-18 — `00-spine.md` §2.4, §2.11, §2.14, §2.15, §2.16 — core clarifications folded: damaging moves always target the foe; `cannotForfeit`; NPC policy never illegal; `power === 0` before Wonder Guard; "always" effects roll nothing; replacement-phase order; `weatherTick`; flinch storage; contact-hook conditions; pvp exp; `CATCH_B` exported
Why: `packages/core/IMPLEMENTATION-NOTES.md` items 3–13 — behaviour the first draft left open, now implemented and tested; the code is the reference.
Evidence: `packages/core/src/{turn,damage,effects,npc,catch}.ts`; `packages/core/test/*`.
Affects: `packages/core/test/fuzz-digests.json` stays authoritative; `50` §50.4.1 unchanged in shape.

## 2026-09-18 — `00-spine.md` §5.1–§5.5 — §5 follows `packages/persist` as implemented
Why: the task made the code the reference for §5; deviations were improvements. Folded: explicit `now: Date` on every stamping method; `toPublic(row, extras)` with nullable `guildTag` and `PUBLIC_PROFILE_KEYS`; `CreatureRecord`, `lockMany`, `lock`, `swap`, `byOwner`, `recordById`; `battlePass` repo; `HistoryRepo.completeTrade` as the one-transaction trade; `AuthRepo.revoke/purge`; `InventoryRepo.qty/addMany`, delete-at-0; `ProgressRepo.clearFlags/allQuests/claimedQuestIds`; the closed `PersistErrorCode` union (`BidAboveBuyNow`, `ListingHasBids`, `NoBuyNow`, `InsufficientItems`, `InventoryOverflow`, `PartyFull`, `InvalidSlot`, `InvalidReorder`, `NotInEscrow`, `GuildFull`, `AlreadyInGuild`, `GuildNameTaken`, `UsernameTaken`, `EmailTaken`, `AlreadyClaimed`, `Forbidden`, `InvalidArgument`, `NotFound`); `cancel` with bids refused; guild founding cost 5000; `players_money_ck`; party-slot staging band 100..105; `friendships_pair_uq`; `release` refuses ever-listed creatures; schema folder layout; seed moved to the server package; constants/types copied with `TODO(core|content)`.
Evidence: `packages/persist/IMPLEMENTATION-NOTES.md`; `src/repos/index.ts`, `src/schema/*.ts`, `src/errors.ts`, `src/constants.ts`; 55/55 tests on PGlite and PostgreSQL 17.6 (2026-09-18).
Affects: `30` §30.6.1 error mapping, §30.7.3, §30.8.3; `50` §50.4.4 rows (`slots`, `transfer`, `market`, `inventory`, `public`, `social`, `battle-pass`, `auth`).

## 2026-09-18 — `10-render.md` §10.4.1–§10.4.3 — sprite manifest v2 wins: WebP 2048² zone-affinity atlases (≤ 8 per zone), `AtlasMap { url, mips }`, `bindSingle` runtime crop, `lodMaxClamp 3`
Why: `40-pipelines.md` measured UASTC 1.57× **larger** than lossless WebP on sprite content, the bundled encoder refuses > 12 Mpix, ETC1S quantises the alpha slice, and a literal per-zone 4096² layout stores 72 species 140 times; `10`'s draft (`AtlasSet.size 4096 | 8192`, `single_<species>` files, KTX2 urls) could not meet 35 MB. KTX2 UASTC stays for materials (opaque tiles ≤ 1 Mpix) and model textures.
Evidence: `40` §40.1.6.1 tables (1 961 vs 1 252 KB; 12 Mpix probe), §40.1.4 accounting (65 atlases, ≤ 304 MB VRAM), §40.1.6.3 budget 32.0 MB.
Affects: `packages/render/src/sprites/*`; `10` §10.0.3 rule 4, §10.1.2 step 5, §10.2.7, non-negotiable 2; `40` §40.1.5 (v2 is the source); `50` §50.4.6 `textures.ktx2Only` exemption by class, §50.4.8 sprite tests.

## 2026-09-18 — `10-render.md` §10.2.1, §10.2.3 — material texture sets in two tiers (`field` 512² for all, `hero` 1024² for ≤ 50 surfaces); 2048² dropped; `SurfaceDef.hero`, `MaterialLibrary.preloadHero`
Why: `40` OQ-2: the single tier is ≈ 143 MB against a 60 MB ceiling and 28.8 MB for Mirevale against `20`'s 6 MB first-frame phase. At 3 m tiling 512² is 1.5 texel/px at the default view; 1024² covers the battle push-in.
Evidence: `40` §40.3.5 arithmetic (field 24.9 MB + hero ≤ 60 MB).
Affects: `40` §40.3.1–§40.3.6, §40.6 (materials ceiling 60 → **90 MB**, total 189 → **219 MB**); `20` §20.10.3 (phase 2 = field ≤ 6 MB, phase 5 = hero); `material-bake` tests.

## 2026-09-18 — `10-render.md` §10.4.2, §10.4.6, §10.7.2, §10.7.4 — `BattlerPose` gains `recoil`/`celebrate`; `CameraRig.cue`/`CAMERA_WORK` gain `throw`
Why: `20-client.md` §20.5.1 `Keyframe` used pose values and a camera shot that render did not define (BattleEvent fields used by the client vs defined by render).
Evidence: `20` §20.5.1 `Keyframe` union.
Affects: `packages/render/src/stage/*`, `camera/battle.ts`; `timeline.test.ts` asserts the sets match.

## 2026-09-18 — `10-render.md` §10.7.7 — character models: `public/models/looks/<look>.glb`, one shared `'character'` material (vertex colour + placeholder ORM/normal), 7 clips; legendaries with KTX2 maps and `lod1`
Why: `40` §40.2 measured the Quaternius sources carry 0 images (six flat-colour materials), so "the GLB's own three maps" did not exist; paths and clip list follow the pipeline output.
Evidence: `40` §40.2.1 table, §40.2.3, §40.2.5.
Affects: `10` §10.0.3 rule 4 (class exemption), `40` §40.5.2 `textures.ktx2Only`/`materials.threeMaps` exemptions; `model-pipeline` budget test.

## 2026-09-18 — `10-render.md` §10.10.1 — `ZoneDump` gains `culledChunks` and `lightIds`; `BudgetPass/BudgetCounts/BudgetProbe` no longer restated
Why: legacy-render-audit Q19 asks for the cull rate to be reported and Q29 for the light list to be unchanged in battle; §50.7 rule 5 forbids a second, differently-formatted declaration of `50`'s types.
Evidence: `.design/audits/legacy-render-audit.md` §7 Q19, Q29.
Affects: `tools/asset-audit` `scatter.instanced`; `pillars.spec.ts` Pillar 7.

## 2026-09-18 — `10-render.md` §10.4.1, §10.5.1 — mirrors of `TypeName`, `VariantKey`, `WeatherKind`, `Terrain`, `Biome` made text-identical to the spine
Why: §50.7 rule 5 refuses a redefined identifier with different text; render may not import core/content, so the mirrors stay but must be byte-identical declarations.
Evidence: `assemble.mjs` duplicate-identifier check.
Affects: `50` §50.7 rule 5 (mirror clause added).

## 2026-09-18 — `20-client.md` §20.4.5 — one movement table: `MOVEMENT` walk 4.2 / run 7.0 / radius 0.35; the server validates by cap, not by re-simulation
Why: `20` had 4.5 / 8.0 / 0.4 and "30 validates against exactly this function"; `30` had 4.2 / 7.0 with a cap + budget + heightfield check; `10` §10.6.2 `MOVER.capsuleRadius 0.35`. Server behaviour is `30`'s to decide; the constants must be one table.
Evidence: `30` §30.2.4 rules 3–5.
Affects: `packages/protocol/src/movement.ts`; `30` §30.2.4 re-exports; `50` `movement.test.ts` (protocol and server rows).

## 2026-09-18 — `20-client.md` §20.3.4 — `WorldSession.enter` = `POST /zone/enter` + `consumeSeatReservation`; no `joinOrCreate`
Why: shard selection is the server's (`30` §30.2.6); the client draft called `joinOrCreate('zone', …)`.
Evidence: `30` §30.2.6 steps 1–3.
Affects: `packages/client/src/net/WorldSession.ts`; `slice-e2e.spec.ts`.

## 2026-09-18 — `20-client.md` §20.4.1, §20.4.4 — consumed render surface points at `10-render.md`'s definitions; `zoneSpecFor` mapping completed (`heightfield`, `seed`, `biome`, `size`, `layout`, `props`, `lights`, `water`, `warps`)
Why: `10` OQ 1 — the client listed a smaller, differently-named surface; the reconciler adjusts the consumer.
Evidence: `10` §10.1.1, §10.5.1, §10.7.2, §10.7.5, §10.7.6, §10.9.
Affects: `packages/client/src/scene/*`; the `zoneSpecFor` snapshot test.

## 2026-09-18 — `20-client.md` §20.2.2 — one type-colour table (render's legacy `TYPE_COLORS`)
Why: `20` carried a second, different 19-hex table; a type must read the same in the DOM and in the world rim light.
Evidence: `10` §10.4.6 table; legacy `world3d-data.js TYPE_COLORS`.
Affects: `tokens.json` `typeColors.default`; `design-system.test.ts` equality assertion.

## 2026-09-18 — `20-client.md` §20.1.1, §20.9.6 — shop without a shop → 404 (was 403)
Why: `30` §30.6.3 returns 404 and owns server behaviour.
Evidence: `30` §30.6.3 `/shop/:zoneId`.
Affects: `ShopScreen` error state.

## 2026-09-18 — `20-client.md` §20.4.7 — no `dialogue` message: NPC lines from content + flags; `storyBeat` confirms beats
Why: see the §4.4 entry; `30` §30.4.6 says lines are content.
Evidence: `30` §30.4.6, §30.4.8.
Affects: `DialogueBox`, `LocalPlayerController` interaction path.

## 2026-09-18 — `20-client.md` §20.7.4, §20.9.8, §20.10.2, §20.10.3 — pre-skip note and 16-bar stems; guild tag `{3,4}` + cost; thumbnails at `public/creatures/thumbs/`; preload phases recomputed for tiers and 2048² atlases
Why: `40` OQ-5 (loop points), OQ-2 (phases), §40.1.6.5 (thumb path); spine §4.7 (tag, cost).
Evidence: `40` §40.4.5, §40.4.7, §40.1.6.5, §40.6.
Affects: `AudioDirector`, `GuildScreen`, `CreatureCard`, `BootScreen` phases; `first-frame.spec.ts`.

## 2026-09-18 — `30-server-netcode.md` §30.4.8 — story-beat runtime added (fire on `interact`, complete after the battle, `beat:<id>:done`, per-player harvest)
Why: see the spine §3.5 entry; `BattleSession` gains `beatId` and `staticSpecies`; §30.4.3 step 3g completes beats and sets static flags in the battle transaction.
Evidence: story-bible §5.1.2, §7.2.1, §11.
Affects: `rooms/storyBeats.ts`, `rooms/battleSession.ts`; `story-beats.test.ts`, authority A17–A18.

## 2026-09-18 — `30-server-netcode.md` §30.2.3, §30.2.6, §30.2.7, §30.3, §30.4.4, §30.4.6, §30.6.1, §30.6.3, §30.6.4, §30.6.5, §30.7.2, §30.7.3, §30.8.3, §30.9.1 — aligned with the spine (heightfield reference, `/zone/enter`, seat object, spawn tunings from content + `ability`/`medium`, wild ability roll, warps/statics, persist error mapping, `/me` shape, emote 1 / 1.5 s, `chat`/`dm` variants, guild create via repo, `completeTrade`, `/quests/claim`)
Why: each was one of `30`'s seven open questions, a spine/`30` disagreement (emote limit 6 / 5 s vs 1 per 1.5 s; guild tag), or a persist signature the draft predated.
Evidence: spine §3.2, §3.11, §4.3, §4.4, §4.7, §5.2, §5.5.
Affects: `packages/server/src/*`; `50` §50.4.5 rows.

## 2026-09-18 — `40-pipelines.md` §40.3, §40.5.2, §40.6, §40.4.6 — two material tiers; `MaterialsManifest v2`; audit rules `geometry.noOutlineShells`, `scatter.instanced`, class exemptions; ceilings 90 / 219 MB; `AudioManifest` block deduplicated; recipe `Field` → `ScalarField`
Why: OQ-2 decision; legacy-render-audit Q4/Q19 rules had no home; §50.7 rule 5 (the `AudioManifest` block differed from `20`'s by a comment; `Field` collided with spine §2.9 `Field`).
Evidence: this pass's duplicate-identifier check.
Affects: `tools/material-bake`, `tools/asset-audit/src/rules/*`.

## 2026-09-18 — `50-verification-budget.md` §50.1, §50.3, §50.4, §50.5, §50.7, §50.8 — tests absorbed from `20`/`30`/`40`; authority cases aligned (A1, A2, A4, A5, A15) and extended (A17–A20); leak baseline defined once; tokens path/rule, 1280 px, 12/14 px minimums; audit-rule list unified; §50.8 maps the 32 legacy audit questions to tests
Why: `20` OQ 4, `40` OQ-7, `10` OQ 4; several rows contradicted the owning section (`invalidPayload` for unknown types, `notAllowed` for a silent speed reject, `> 6 units` engage range vs 3 m, `flagged: []` vs the informational flag classes, `routes.ts` vs `app/router.tsx`, `styles/tokens.css` vs `ui/tokens.css`, `react/forbid-dom-props` vs `ewa/no-inline-style`, 1024 vs 1280 px, ≥ 14 px for all text vs 12 px captions); the legacy audit's questions needed a named test each (Q4, Q5, Q7, Q8, Q9, Q11, Q12, Q15, Q16, Q17, Q19, Q21, Q26, Q28, Q29, Q31 had none).
Evidence: `.design/audits/legacy-render-audit.md` §7; the owning sections cited per row.
Affects: every test file named in §50.4; CI `pnpm check`.
Factual notes on the audit (not edited): Q6 asks for 0.5 u housing distance — the spine's Pillar 4 number is 0.6 and stands; Q22 says "69 roots" — the content has 67 evolution families (roster-coverage §10), the audit's figure was the legacy count.

## 2026-09-18 — open items this pass could not decide
- **`40-pipelines.md` OQ-6 / `PLAN.md` open dependency 1** — the AI audio provider and `.design/audio-bible.md` do not exist; `40` §40.4.1 fixes the manifest shape the bible must be transcribed into, and `plan` runs without a key.
- **Static-caster shadow caching** (`10` §10.11) and **server-side interest management beyond 3×3** (`30` cut list) stay follow-ups gated on the M2 capture and the N = 200 harness respectively.
- **PvP team preview** — accepted as full-state for v1 (spine §4.5); a projection type is a future SPEC change.
- **Roster hero-surface list** — the 11 per-biome signature surfaces in `40` §40.3.5 are a first pick; the M2/M3 hostile audits may move a surface between tiers (a §50.7 entry each time).
