# @ewa/content — implementation notes

Deviations from and clarifications of `.design/spec/00-spine.md` §2.3–§2.6, §2.20, §3 made while building the
package. The spec is not edited; each item is a candidate for a `.design/spec/CHANGELOG.md` entry under §50.7.
Numbers below are what `pnpm --filter @ewa/content run validate` prints on 2026-09-20.

## Deviations (spec text vs what is implemented)

**D1 — §3.10 rule 11 (`|Z(zone)| ≤ 16`) is enforced on the overworld subset.** The rule as written cannot hold:
`solenne` hosts the 3 Wardens and the Champion, whose legacy teams (mandated by the task) already contain **20**
distinct species before any table, and `umbral_observatory`'s bible-mandated story teams (`sable_observatory`,
`reeve_observatory`) push its set to 20. `validate.ts` therefore enforces `|table ∪ statics| ≤ 16` (the species a
zone can show in the overworld at once; max is 14 + 2 by construction) and emits the *full* `Z(zone)` =
table ∪ statics ∪ trainers ∪ league in `stats.bindSets` / `dist/content-report.json` `bindSets` for the sprite
planner exactly as §3.10 asks. Full sizes: solenne 26, umbral_observatory 20, every other zone ≤ 16. Battle-only
teams render in the arena, which binds per battle. Resolution belongs to `40-pipelines.md` §40.1.4.

**D2 — `dist/heightfields/<zone>.json` is a compact exact encoding, not raw arrays.** Raw JSON arrays of a
481² field are > 2 MB; base64 Float32 is 1.2 MB per route. The committed form (`encoding: 'q64-delta-varint-b64+rle'`)
stores the 1/64-m height integers row-major, delta-coded, zig-zag varint, base64, and the two masks run-length
encoded. `decodeHeightfield` rebuilds `Float32Array`/`Uint8Array` bit for bit and re-verifies the digest (test
`heightfield.test.ts` and the build script both assert the round trip). Sizes: routes ≈ 305 KB, story ≈ 212 KB,
towns ≈ 137 KB, total 4.5 MB for 21 zones — routes sit at the task's 300 KB guidance rather than under it;
reducing resolution would break §3.11's fixed `step: 0.5`. Heights are quantised to 1/64 m *in the sampler*
(`buildHeightfield`), so the runtime field and the committed file are the same numbers; `-0` is normalised to `+0`
so Float32 bit patterns match.

**D3 — §3.10 rule 6 "all 67 evolution families".** 67 is roster-coverage.md's root count *including* the 10
legendary/mythical singles (57 non-legendary families + 10). `validate` and `RosterReport.families` count roots
with `evolvesFrom === null` (67); `coverage.test.ts` asserts both 67 and 57.

**D4 — §2.3 schema clamps applied to legacy values.** `catchRate` 3..255 forced `galaxion` 2→3, `voltaura` 2→3,
`lumyth` 1→3, `noxmyth` 1→3 (roster-coverage §7 says "catchRate 2–3"; the spine's range wins); `sizeScale`
0.5..2.2 forced `ampmite` 0.45→0.5. Listed in the generated header of `src/data/species.ts`.

**D5 — `rarity: 'epic'` → `'rare'`** for the 13 legacy epic rows (clementar, prismolith, resilithorn, aonred,
voidraith, moblaze, yaschamp, yasprime, pyrothal, flowbot, kygra, raidori, necrogeist), per roster-coverage §15.

**D6 — `archonosis` loses `Abyssal Nova`.** Legacy names a move that has no MOVES row; it is dropped from both
`moves` (3 defaults remain) and `learnableMoves` (rule 2 would otherwise fail). Same handling as core's fixture.

**D7 — `evolvesFrom` is derived from the parents' `evolvesInto`/`splitEvolvesInto`**, not copied: legacy
`lithokrysm` has `evolvesFrom: null` while `pebblit` evolves into it. 12 legacy rows write `evolvesInto: null`
explicitly; null and undefined both mean "no evolution".

**D8 — `src/data/battlePass.ts` is generated**, not hand-authored: 100 rows copied from `battlePass.js` is exactly
the kind of transcription the generator exists for. Level 100's legacy `variantKey: 'dusk', isAlpha: true` on the
zenryu reward have no field in §3.9 `BattlePassReward` and are dropped (the row keeps `creature: { zenryu, 100 }`).

**D9 — 148 encounter slots, not 152.** roster-coverage.md's header claims 152; its own §6 tables sum to 148
(90 route + 17 town + 41 story). The tables are transcribed row for row; the 79-species direct placement and
130/130 closure match the appendix exactly.

**D10 — 19 looks, not 20.** `assets-src/models/quaternius/` holds 19 GLTF stems; `LOOKS` in `src/data/bodies.ts`
is their snake_case (`casual_male`, `old_classy_female`, …). `40-pipelines.md` says 20; the manifest key spelling
should be reconciled against `LOOKS` when the model pipeline lands. Every `NpcDef`/`TrainerDef`/`LeagueTrainer`
`look` and every `BodyDef.look` is validated against `LOOKS`.

**D11 — `validate(opts?, tables?)`** takes an optional `{ skipHeightfields }` and an optional override of the six
core tables (`DEFAULT_TABLES`) so mutation tests can inject a dangling move or an unmirrored link without
touching the committed data. The zero-argument call is the §3.10 gate.

## Clarifications (behaviour the spec leaves open)

1. **Heightfield layout.** "value noise + the layout's footprints" is implemented as: 4-octave value-noise fbm with a
   biome amplitude (grove 1.1 m … sky 2.6 m); a kind feature (town plaza r 22 m, story platform r 26 m, route road
   |z| < 7 m flattened to the coarse profile); biome ponds (the `water` mask) each with a 3 m boardwalk strip that is
   both walkable and water; and a flat, dry clearing (r 4 m, blended to 8 m) around every authored coordinate of the
   zone, so `spawn`/npcs/trainers/items/lore/warps are walkable by construction (`heightfield.test.ts` asserts
   `isWalkable` directly on them). Statics and raid hotspots are not in `ZoneDef`, so they are checked with
   `nearestWalkable(h, x, z, 8)`; `voidraxis (0, 84)` and `raid_ascent_pyrothal (0, 104)` sit on the interior
   boundary and snap inward as the CHANGELOG predicts. ~~Prop footprints are render data and are not modelled.~~
   Superseded by R1 below: the zone plan and its footprints are content's now. Terrain walkable ratio
   61.3 % (saltmourn) … 74.4 % (siege_route, deepcut_route); after footprints 56.9 % … 72.5 %.
2. **Water where tables need it.** `validate` adds a check the spec implies: a zone whose table has `medium: 'water'`
   slots must have ≥ 1 water sample and ≥ 1 boardwalk sample (walkable ∧ water), so a water spawn can be engaged
   without HM Surf. Salt-biome towns scale pond radius by 0.6 so the harbour fits beside the plaza.
3. **`NpcDef.when/until` accept badge sugar** (`badge:ember`), as story-bible §6 authors them; `isKnownFlag`
   treats `badge:<BadgeId>` as known. The §11 registry (44 ids + 4 elite/champion + 8 `leg_*` = 49 rows) is data in
   `src/flags.ts`; every flag anywhere in content must be in it.
4. **Story battle trainers** (`sable_mire`, `sable_tide`, `sable_deepcut`, `sable_observatory`,
   `reeve_observatory`, `hollis_siege`, `varn_spire`) are `TrainerDef`s with `rematchDays: null`, placed next to
   the speaking NPC. The server should treat a trainer referenced by a `StoryBeat.battle` as fired by the beat, not
   as a freely re-challengeable overworld trainer (30-server-netcode §30.4.8). 7 battle beats, as the bible's table
   lists (its prose says 8 "plus none in Act I").
5. **League `pre`/`post`.** Gym `post[1]` is the bible's concession line; `pre`/`post` for the Wardens and Zeon are
   authored from §4.5–§4.6. Team `ability`/`heldItem` are `null` (the server projects `species.abilities[0]`).
6. **Zone links** use `n`/`s` for the three story spurs: `vesperveil.n → umbral_observatory`,
   `marrowdig.s → the_rift`, `solenne.n → celestial_spire`; the main chain runs west→east. `eclipse_shrine.e →
   solenne` (legacy). All 21 zones are reachable ignoring gates; the k-th gym town is reachable with k−1 badges.
7. **Learnset levels** follow the §2.3 migration sentence (evenly spaced 5..min(evolvesAt ?? 40, 60), rounded to a
   multiple of 3) rather than the task's approximate "every 4–6 levels"; the same rule core's test fixture uses.
8. **Palette ids** follow the render slice's `<biome>_<zone>` form (`grove_mirevale`, `grove_mire`, …).
9. **`ENCOUNTER_BANDS`** (roster-coverage §5) is exported so the server and tests share the RC-2 bands.
10. **Route trainers** from legacy `world.js` (Eclipse Order acolytes etc.) are re-voiced for the Provision plot;
    teams/levels/rewards are legacy where they existed.
11. **Bible line lengths.** story-bible §9.2 says ≤ 140 characters per line; several §5.3 lines exceed it. Lines are
    transcribed verbatim; the limit is not enforced.
12. **`dist/content-report.json`** stays gitignored (regenerated by `validate`); `.gitignore` carves out only
    `packages/content/dist/heightfields/` so the 21 fields are tracked as §3.10 requires.

## Counts (validate output)

```
species 130 · moves 193 · abilities 25 · items 17 · orbs 10 · consumables 23 · types 19
zones 21 · tables 15 (148 slots) · statics 8 · league 12 · quests 12 · beats 33
events 4 · swarms 7 · raids 8 · battle pass 100 · bodies 14 · flags 49
roster: direct |E| 79 · obtainable 130/130 · families 67 · unobtainable 0
heightfields 21 · min walkable 56.9% (terrain 61.3%; plan footprints stamped, R1)
```

Generator rewrites (also in the generated headers): `Moonblast` `lower_spAtk → lower_atk` (§2.4); no move carried
`weaknessPolicy` after all (the §2.4 note is honoured by code, not needed by data).

## R1 — the zone plan moved into content; footprints in `walkable` (2026-09-30)

Audit recommendation R1 / finding L2-01 (`.design/audits/spec-verification.md`): building and prop footprints existed
only in render's collider, so the server's heightfield let a modified client walk through houses and the spawn
director could place creatures inside them. Closed.

**What moved.** `src/plan.ts` is render's layout, statement for statement: `planLayout` (plaza, roads, tall-grass
patches, clearings, set-piece placement, authored keep-clear points, warp pairs), `planBuildings`, `planLights`
(positions, shadow budget and housing seeds; appearance stays render's), `planProps`, `doorPaths`, `waterBodies`, and
the solid half of the builder's `buildScatter` (interior tree trunks, pond willows, big rocks: the same jittered grids,
`hash2` / `fbm2` noise and acceptance, playable interior only). Same seeds, same rng streams in the same order
(`fork('layout')` / `fork('scatter')` of `createRng(layoutSeed)` via `forkLabelled`, which reproduces render's
labelled fork; buildings / lights / props from three unlabelled forks, as the adapter drew them).

**API.** `zonePlan(zoneId)` (memoised with the field: `getZoneSurface(zoneId)` gives `{ heightfield, plan, footprints }`),
`planZone(zone, base)`, `buildingFootprints(plan)`, `stampFootprints`, `solidContains`, `roadZAt`, `waterBodies`,
`walkableComponent`, `reachableWithin`, and the tables (`SET_PIECE_BY_ZONE`, `SET_PIECE_EXTENT`, `SET_PIECE_LIGHT_SLOTS`,
`BIOME_ROOFS`, `BIOME_LIGHT_GENERATOR`, `BIOME_SOLID_SCATTER`, `PROP_SOLID_RADIUS`, `SOLID_SET_PIECES`, `FENCE_HALF`,
`HEART_TREE_RADIUS`, `MOVER_RADIUS`, `TOWN/ROUTE/STORY_LAYOUT`, `ZONE_LIGHT_CAP`, `HANDOVER_INSET`, `INTERIOR_SIZE`).
`ZonePlan.solids` holds every footprint in render's blocker shapes (`{kind:'rect', x, z, hw, hd, yaw}` /
`{kind:'circle', x, z, r}`, grown by the 0.35 m capsule radius, tagged `source` building / setpiece / prop / housing /
tree / willow / rock); `ZonePlan.doors` gives each building's door and approach strip.

**Stamping.** `buildHeightfield` = terrain (steps 1–5 as before), then `planZone(zone, terrain)`, then
`stampFootprints`: a sample whose centre is strictly inside a solid (render's `blocked` test) becomes `walkable = 0`,
except water samples (open water is unwalkable already; boardwalk piers stay walkable; no footprint covers any water
sample in the 21 zones, so `waterBodies` of the stamped field equal the plan's) and samples inside a door approach —
1.6 m wide, 1.2 m long, starting where the building's own footprint ends (plinth + capsule). Starting it at the plinth
line admitted positions 0.23 m inside a rotated facade (nearest-sample lookup; found by
`server/test/footprints.test.ts`). In the 21 zones no other footprint covers any approach, so the carve is a guarantee,
not a change. The digest is taken after stamping. Cost per zone 9–44 ms in Node (plan + stamp); all 21 in 481 ms in a
Chrome worker.

**Identity proof.** `test/fixtures/r1-pre-move.json` was captured from the render planners, the client adapter and the
zone builder at HEAD 689fd78 before anything moved (regenerated from a `git archive` of that tree after the first raw
capture was overwritten in scratch; counts and digests match the first capture). `test/plan.test.ts` asserts, for all
21 zones: every layout field, the door paths, the buildings (in full), the props, the light positions / shadow flags /
housing seeds, and the ordered list of every collider blocker the builder registered equal content's plan.
`packages/client/test/zoneSpecFor.test.ts` asserts every `ZoneSpec` field except `heightfield` and the new `plan` is
byte-identical to the pre-move adapter output; the 63 old snapshot digests are reproduced exactly by dropping `plan`
and restoring the pre-move field digest (checked once, then the snapshot was re-baselined).
`packages/client/test/footprints.test.ts` builds all 21 zones and asserts the builder's registered footprints are
content's `plan.solids`, in order, with no client-only blockers. Scratch-only checks: the builder's `geometryDigest`
is unchanged for all 21 zones in Node and for mirevale / mire_route in Chrome WebGPU (`ad2ad9d2`, `e2e1597b`), and
before / after sandbox shots of mirevale and mire_route are indistinguishable (< 0.04 % of town pixels differ by
more than 15/255, about 1 % on the routes: foliage sway and TAA jitter).

**Deliberate changes.** (1) Fence runs (garden pickets, route wayside fences) are solid: `FENCE_HALF` 1.865 × 0.065 m
plus capsule (render drew them walk-through; `PROP_BLOCKER.fence` was 0): 5–12 per town, 6 per route, 0 in story
zones. (2) Door approaches (above). (3) Client prediction equals server truth: the builder registers every footprint
with `TerrainCollider.addFootprint` (shape queries only: `blocked()` for SceneDirector's occluder scoring);
`passable()` is `walkable` (plus extra `addBlocker` shapes, none in a built zone).

**Walkable share, terrain → with footprints** (%, validate): mirevale 62.77 → 58.02 · mire_route 73.97 → 70.36 ·
cinderhold 63.01 → 58.82 · ash_route 74.29 → 72.46 · saltmourn 61.28 → 56.94 · tide_route 72.16 → 70.54 ·
stormrook 62.94 → 57.91 · galvan_route 74.03 → 71.65 · marrowdig 63.03 → 58.15 · deepcut_route 74.40 → 72.08 ·
vesperveil 62.75 → 58.49 · hollow_route 74.11 → 71.25 · forgewall 63.11 → 58.20 · siege_route 74.44 → 72.32 ·
skyrend 62.49 → 57.87 · ascent_route 73.72 → 71.48 · solenne 62.94 → 59.07 · eclipse_shrine 69.79 → 67.38 ·
umbral_observatory 69.21 → 66.93 · celestial_spire 69.79 → 67.45 · the_rift 67.71 → 65.16. Footprints: 151–232 per
town, 306–392 per story zone, 347–1035 per route (plus fences).

**Moved points** (rule 9 / 12 snap, now reported in `stats.snapped` / `content-report.json` and printed by the CLI):
`solenne` spawn (−50, 0) → (−50, 0.5), in the road-w lamp post's footprint (the layout keeps actors, items, lore and
warps clear, not the spawn; the room already snaps the spawn with `nearestWalkable`); `galvan_route` static `voltaura`
(92, −40) → (92, −39.5), in a big rock; unchanged boundary cases `ascent_route` raid (0, 104) → (0, 103.5) and
`the_rift` `voidraxis` (0, 84) → (0, 83.5). Every npc, trainer, item, lore tablet and warp end stays walkable.

**Validate additions (rule 12).** Reachability: a 4-neighbour flood fill from the spawn's snapped sample over
`walkable`; every npc / trainer / item / lore / warp end / static within 3 m, raid hotspot within 8 m, the league door
(0, −26) within 4 m (towns with a gym, and solenne), every building's door approach and every link's 6 m handover band
must contain a reached sample. All 21 zones pass (the walkable set is one component in every zone). `validate-cli` now
also writes `dist/heightfields/<zone>.json` (§3.10 says validate emits them; the separate `heightfields` script still
works). Files: 4.7 MB (was 4.5 MB).

**Findings.** (a) Warp huts are never placed: `planBuildings` puts the hut's door on the warp marker, and the marker is
itself an authored point that the 2.5 m clearance refuses, so saltmourn's harbourmaster hut, solenne's league hall and
umbral_observatory's stair have no building (behaviour kept; the seed draw is kept so nothing else moves). (b)
Determinism: the plan uses `Math.sin / cos / atan2 / hypot / pow` (render's arithmetic), so §3.11's "integer /
`Math.fround` arithmetic only" no longer holds for `buildHeightfield`. V8's software implementations make Node and
Chrome agree (the M0 browser check passes, 21/21); an engine with a different libm (JavaScriptCore) could differ in the
last ulp and, at worst, flip a boundary sample. Clients on such engines should load the committed
`dist/heightfields/*.json` (or the plan's inputs could be quantised): a decision for the SPEC owner. (c)
`packages/server/test/movement.test.ts`'s thin-wall case was vacuous on mire_route (no thin wall existed); fences and
posts provide one now, and its `dtMs` was raised so the step stays inside the speed cap.

**Left.** `packages/client/src/harness/anchors.ts` (the capture harness) still calls render's deprecated `planLayout`;
render keeps that planner (asserted equal to content's plan in render's `zone-layout.test.ts` and the client's
`zoneSpecFor.test.ts`) until the harness reads `layoutOf(spec)`; then it can be deleted. `resolveMove` still has no
`surf` argument (L2-05, render's).

### Proposed CHANGELOG entries (not applied: the SPEC is being edited elsewhere)

1. **§3.11 Heightfield.** Replace the "Open gap — building and prop footprints" paragraph with: "`buildHeightfield`
   builds the terrain (noise, kind feature, ponds, authored-point clearings; margin, slope and open water unwalkable),
   lays out the zone plan on it (`planZone`) and stamps every plan footprint `walkable = 0`: a sample is stamped when
   its centre lies strictly inside a solid (circle `d² < r²`; rect `|lx| < hw ∧ |lz| < hd` in its yawed frame), except
   water samples and samples inside a door approach. The digest is taken after stamping." Amend the determinism
   sentence: "The plan uses `Math.sin/cos/atan2/hypot/pow`; V8 (Node, Chrome) is bit-identical and §50.4.2 checks it;
   other engines load `dist/heightfields`." Add the plan API to the verbatim block: `zonePlan`, `planZone`,
   `getZoneSurface`, `buildingFootprints`, `stampFootprints`, `solidContains`, `ZonePlan`, `PlanSolid`, `DoorApproach`
   (shapes grown by the 0.35 m capsule radius, so `walkable` means "where a player's centre may stand").
2. **§3.10 rule 12.** "… `spawn` and every authored coordinate are walkable after snapping (each snapped point is
   reported with its cause); from the spawn, a 4-neighbour flood fill over `walkable` reaches every npc / trainer /
   item / lore / warp end / static within 3 m, raid hotspot within 8 m, the league door within 4 m, every building's
   door approach and every link's handover band." And: validate writes `dist/heightfields/<zoneId>.json`.
3. **§10.5.1 `ZoneSpec`** gains `readonly plan: ZonePlanData` (content's layout: plaza, roads, door paths, road
   meander, tall-grass patches, clearings, set-piece placement, keep-clear points, warp pairs).
4. **§10.5.5 Layout.** "The layout is content's (`zonePlan`); the builder reads `spec.plan` (`layoutOf`) and plans
   nothing. Building and prop footprints ARE in content's `walkable`; the builder registers their shapes with
   `TerrainCollider.addFootprint` for shape queries." (Reverts the 2026-09-25 amendment.)
5. **§10.6.1 / §10.6.2.** `addFootprint(b)` (shape only; `blocked()` sees it, `passable()` does not) beside
   `addBlocker(b)` (an extra client-only obstacle; both see it); `passable = walkable (∨ surf ∧ water) ∧ ¬extra
   blocker`; delete "the reverse is the open footprint gap of spine §3.11": prediction and validation sample the same
   bits.
6. **§20.4.4 adapter.** `spec.buildings` / `props` / `plan` = `zonePlan(zone.id)`; `spec.lights` = render
   `lightsFromPlan(plan.lights, biome, setPiece, type)`; `SET_PIECE_BY_ZONE` is content's.
7. **§30.3 Spawn director, "Footprints".** "Position acceptance samples the stamped heightfield, so a spawn never lands
   inside a footprint (`server/test/footprints.test.ts`)." §30.2.4 needs no change (movement into a house is refused
   as `unwalkable`).
8. **Audit table.** L2-01 / R1: closed.
9. **Render prop table.** Fences are solid (`FENCE_FOOTPRINT` 1.865 × 0.065 m plus capsule).

## Phase A — interiors (2026-10-06)

- **Pockets are a layer after the plan.** `planInteriors(zone, plan, base)` runs after `planZone` and never touches
  `ZoneDef.npcs/trainers/warps` or the plan's rng streams, so `r1-pre-move.json` holds for every zone but Solenne.
  Scatter solids (tree / willow / rock) whose shape falls in a pocket footprint are dropped from the stamp
  (`interiorPlan.droppedSolids`); `plan.solids` itself is unchanged, so render must drop them too.
- **Placement grid.** A 1 m lattice with a summed-area table of blocked cells (buildings + 2.5 m, roads and door paths
  + 1.5 m, the plaza + 2 m, water bodies + 3 m, the set-piece + 2 m, authored points / spawn / statics / raid hotspots
  + 3 m, props + 2 m, lights + 1.5 m, other solids + 1 m, linked edges 9 m). Candidates run outermost ring first, then
  by angle; the biggest halls go first. Tall-grass patches are blocked in a first pass and allowed in a second, lazily
  built pass (Saltmourn's gym hall needs it: its north band is cut by a pond and a patch, its east/west sides are
  linked). The 9 m linked-edge clearance keeps the handover arrival line (6.5 m) from snapping into a hall.
- **Floor height** = mean terrain height over the floor, quantised to 1/64; a 2 m screen band blends back to the
  terrain; the slope test re-runs one ring outside the screen (only ever turning samples unwalkable).
- **Solenne.** The league hall stands in the gym slot (door (0, −26), id `solenne.league`, kind 'gym'). The stale
  `solenne.league_hall` warp (to an unbuilt sub-area at (30, 44)) is removed. Comptroller Varn and Bursar Quill
  stood at (0, −30) / (6, −34), inside the new hall's footprint; they now flank its door at (±3.5, −22.5) beside
  the Public Ledger lectern. The hall's front stays 2 m from the lectern (0, −24), so the clearance loop falls back
  to the full 14 × 12 size, as the gym towns' halls do.
- **Gym trainers** fight with the leader's own non-legendary species a few levels under the leader's lowest, so no
  gym adds species to its zone's bind set.
- **Walker.** `walkInterior` BFSes the stamped field (4-neighbour, inside the pocket) with closed gates' solids as
  blockers, beats trainers / uses switches within 3 m (leaders 4 m) until a fixpoint. Interaction ranges ignore walls
  (as the server's do), so every switch carries `requires` for the gates that guard it — the puzzles are enforced by
  flags, not geometry alone.

## Phase B7 — league mid-battle lines (2026-10-06)

`LeagueTrainer.mid?: { halfHp, lastStand }` (types + `LeagueTrainerSchema`: each non-empty, ≤ `MID_LINE_MAX` 140 chars,
exported) with new lines for all 12 league trainers in their voices (`pre` / `post`). Presentation only — the server never
reads them; the client banners `halfHp` when the team's total HP first drops to half and `lastStand` when the last
creature enters. The lines name no creature: the replacement order is the battle AI's, not the team list's.
`test/league-mid.test.ts` pins all 12, the length cap, uniqueness and the schema refusal. Not in the SPEC (§3.3 lists
no such field) — a CHANGELOG entry is owed when the spec is next amended.

## Phase C3 — world map cells and visited flags (2026-10-06)

- **`zoneMapPositions()`** (`src/worldMap.ts`): every zone's map cell, computed — not authored — by a BFS over the
  4-neighbour `links` from `ZONE_ORDER[0]` (Mirevale at the west edge), n-e-s-w order, `e` = +x, `n` = −y (the same
  orientation as the handover vectors, n = −z). It throws on a clash or an unreachable zone. The committed world lays
  out as an 18 × 3 strip: the main road on the middle row, The Rift south of Marrowdig, the Umbral Observatory north of
  Vesperveil, the Celestial Spire north of Solenne. Also `zoneMapSize()`, `computeMapPositions(zones)`, `MAP_STEP`. No
  zone data changed (layout seeds, npcs, trainers and warps untouched), so no heightfield or layout moved.
- **`visited:<ZoneId>`** (`flags.ts`): `visitedFlag(id)`, `VISITED_PREFIX`, `VISITED_FLAGS` (exactly 21). `isKnownFlag`
  accepts them like the badge sugar (the registry stays the §11 story list); validate's need resolution treats them as
  settable (the server writes them on join).
- Tests: `test/worldMap.test.ts` (every zone placed, cells unique, linked zones adjacent in the link direction, the three
  branches off the road, refusal of a broken layout, the 21 visited flags known and nothing else with the prefix,
  validate green).

## Phase D1–D3 — story grants, TMs + tutors, evolution stones (2026-10-06)

- **Where the data lives.** `data/items.ts` / `data/consumables.ts` stay the generated legacy tables (17 / 23 rows; the
  counts tests and validate's `ITEMS.length` rule are unchanged). The Phase D items are hand-authored in
  `data/progressionItems.ts`: `KEY_ITEMS` (`old_rod` + one TM per `TM_MOVES`, id `tm:<Move id>`, name `TMnn <Move>`,
  priced by power 2000 / 2500 / 3500 / 5000) and `EVOLUTION_STONES` (six consumables, 3000 / 1500). The ContentIndex's
  `item()` resolves both; `ContentTables` gained optional `keyItems` / `stones` (default the committed tables).
- **D1 grants.** `StoryBeat.grant?` (schema: record of id → positive int). Grants: `bloom_after` HM Cut,
  `drowned_harbour` Old Rod (Maren speaks this beat as harbourmaster; `current_after` is his gym voice), `current_after`
  HM Surf, `fault_after` HM Strength. Each granting beat got one stage-direction `after` line announcing the gift.
  Validate: grant items exist; a grant is a source for the "obtainable" checks below.
- **D2 learnability** (`canLearnMachineMove`): Normal-type move, or a move sharing a type with the species, or one already
  in the species' level learnset. One rule for TMs and tutors; no per-species compatibility table.
- **D2 tutors.** `NpcDef.tutor?` (schema: optional non-empty id list). The zones.ts `npc()` helper only writes the key
  when given, so every other NPC record is unchanged; x/z are untouched, so `plan.test` / heightfield digests hold.
  Tutors: `vesperveil.lantern_maker` (Shadow Sneak, Spectral Burn, Night Slash, Endeavor) and `skyrend.roost_keeper`
  (Brave Bird, Sky Pierce, Dragon Rush, Double Edge), each with one new line naming the fee. `MOVE_TUTOR_PRICE` 3000.
- **Shops.** `PROGRESSION_STOCK` (TMs from Saltmourn, stones from Stormrook, Solenne sells all six) is appended to the
  town stock in zones.ts. Three quest rewards gained a TM (q05 Cross Poison — sold nowhere else, q06 Giga Drain,
  q07 Shadow Ball).
- **D3 families.** `data/evolutions.ts` `STONE_AND_TRADE_EVOLUTIONS` (9): embrock / flampling → ember_stone, stormchick
  → storm_stone, mossling → tide_stone, seedrift → verdant_stone, berkest → moon_stone, hexroach → dusk_stone, glowtent /
  resilith → trade. Chosen with no member in any league team or in `packages/server/test/fixtures/progression/*.json`
  (the walker's parties and boxes). `species.ts` was edited in place and `scripts/migrate-legacy.ts` applies the same
  table (keeping the legacy level for learnset spacing), so a regeneration reproduces it; `test/progression-items.test.ts`
  asserts species.ts equals the table.
- **Roster.** `childrenOf` = core `evolutionChildren`; new `evolveLevelOf` (0 for item / trade) replaces the
  `evolution?.atLevel` reads (RC-5 / RC-9); `AcquisitionPath` gains `{ kind: 'item', from, item }` / `{ kind: 'trade',
  from }`. Coverage stays 130/130, 79 directly placed, 67 families.
- **Validate (new block).** Grant items exist; every TM move exists, is unique, has a priced key item and is sold or
  rewarded somewhere; key items are `slot: 'key'` without hooks; every stone is used by some `item` evolution and is sold
  / found / rewarded somewhere (else its species would be unobtainable); an `item` evolution names a stone; tutors stand
  in towns and teach real moves; a shop never lists an unpriced key item.
- `TRADE_EVOLVE_RIBBON = 'trade_evolve'` is exported here so server and client share the marker.
- Tests: `test/progression-items.test.ts` (12); `test/coverage.test.ts` children/atLevel updated for the new kinds plus
  two path assertions.

## Phase D5 — achievements (2026-10-06)

- `QuestDef.kind?: 'story' | 'achievement'` (absent = story). Objective kinds added: `dexCaught { count }` and
  `loginStreak { days }` (absolute on the server), `catchTier { tier: 'alpha' | 'shiny', count }`, `completeTrades { count }`,
  `clearRaids { count }`. Schema + types updated.
- `data/achievements.ts`: 30 `ACHIEVEMENTS` (dex 10/30/60/90/130, catches 1/10/50/200, alpha, shiny, wins 10/100/500,
  trainer 50, PvP 1/25, all 8 badges, all 12 league trainers, champion, all 8 statics, trades 1/10/50, raids 1/10/50,
  streaks 7/30/100). Appended to `QUESTS` (so the server's quest path and `/quests/claim` need no change); `zoneId`
  'mirevale' (a required field with no meaning here), `act` a rough tier. Exports `ACHIEVEMENTS`, `ACHIEVEMENT_IDS`,
  `isAchievement`, `STORY_QUESTS` (index.ts; QUESTS without the achievements — defined in index to avoid an import cycle).
- validate: an achievement must have giver null, no requires, money/item rewards only; `dexCaught` ≤ species count.
- Tests: `test/achievements.test.ts` (4); `test/counts.test.ts` now checks 12 story + 30 achievements.

## Phase D6 — doubles (2026-10-06)

- `TrainerDef.doubles?: true` / `LeagueTrainer.doubles?: true` (schema `z.literal(true).optional()`; validate: a doubles
  row needs a team of 2+). Authored: `draco_gym`, `aurelia`, and five Act II/III route trainers (`galvan_route.rocker`,
  `deepcut_route.digger`, `hollow_route.medium`, `siege_route.engineer`, `ascent_route.tamer`) via a `doubles(tr(…))`
  wrapper in `data/zones.ts` (x/z untouched, so no layout / heightfield digest moves). None is a story trainer and none is
  a gate. Pairs of trainers fighting together were not done (single trainers with `doubles: true` only).
- `data/spreadMoves.ts`: `SPREAD_MOVES` (16 curated ids) laid over the generated `data/moves.ts` (which has no reach);
  `MOVES` exported from there, so `MOVES[i] === contentIndex.move(id)` still holds. `MoveDefSchema.spread?`; validate:
  every listed id is a foe-targeted MOVES row carrying that spread.

## Phase D8–D11 — world systems (2026-10-06)

- **Water slots (D8).** mire_route gains `mossling` (day, uncommon, water) and `mudbub` (night, uncommon, water), skyrend
  `tidalfang` (any, rare, water), umbral_observatory `wraithtide` (night, rare, water). All four species were already
  placed elsewhere, so `directlyPlaced` stays 79, obtainable 130, families 67; RC rules hold (uncommon weight 5,
  Ghost at night, no duplicate `species|time|tier` key, ≤ 16 slots). Every non-lava zone with a table and open water
  now has ≥ 1 water slot (what the Old Rod rolls); ash_route (lava) has none on purpose.
- **Obstacles (D10).** `ObstacleDef` / `ZoneDef.obstacles?` (schema + validate), data in `data/obstacles.ts` merged into
  `ZONES` (`BASE_ZONES.map`, so no zone literal changed). `obstacles.ts`: radii (tree 0.7, boulder 0.95) + 0.35 m
  capsule, `OBSTACLE_HM`, `OBSTACLE_TYPES` (Cut: Grass/Bug/Steel/Dark; Strength: Fighting/Rock/Ground/Steel — decided
  here), `obstacleFlag`, `obstacleRefusal(Text)`, `stampObstacles`. `buildZoneSurface` stamps them LAST (after
  `stampInteriors`) on still-walkable samples and keeps `ZoneSurface.obstacleCells` (sample → id); `obstacleAt(h, x, z)`
  reads it (null for a synthetic field of a zone without obstacles). Obstacles are NOT authored points: neither
  `plan.ts` nor `heightfield.ts` `authoredPoints` read them (the r1 fixture test is green). Positions were picked by a
  scratch scan: walkable disc + 1 m, in the spawn's component, ≥ 12 m from every authored point and from the progression
  walker's saved positions, |z| ≥ 16 on routes (off the road), ≥ 18 m inside the playable edge.
- **Heightfields changed:** `mire_route`, `tide_route`, `deepcut_route`, `hollow_route`, `ascent_route` (the stamps only;
  every other zone is byte-identical — `stampObstacles` is a no-op without obstacles). `dist/heightfields` rebuilt.
- **Bicycle (D11).** `bike` key item (`BIKE_ITEM`, `BIKE_PRICE` 30 000) in `buildKeyItems`, sold in Saltmourn
  (`PROGRESSION_STOCK.saltmourn` first). No beat grants it, nothing needs it.
- Tests: `test/encounters.test.ts` (8). `test/plan.test.ts`: the outside-towns stamp count now adds
  `obstacleCells.size` (the obstacle stamp runs after the footprints).

## Phase D14 — post-game (2026-10-06)

- **League rematches.** `LEAGUE_REMATCH` (`data/league.ts`): one row per `LEAGUE` entry — the trainer's type flavour at
  Lv 65–75 (originals evolved, a few new faces, the ace last), `pre` / `post` lines in each voice, reward
  `round(reward × 1.5)`. A legendary appears only where the original team carries it (Sylvane glacinid, Veil bankaiser,
  Aurelia voltaura, Kirei galaxion, Zeon zenryu). `POSTGAME_FLAG = 'champion:zeon:beaten'`,
  `LEAGUE_REMATCH_COOLDOWN_DAYS = 1`, `leagueRematchFlag(id)` = `league:<id>:rematchAt` (server bookkeeping, not in the §11
  registry — like `trainer:<id>:beaten`; nothing in content reads it). Accessor `leagueRematch(id)`.
- **Battle tower.** `data/tower.ts`: `TOWER { levelCap 50, teamSize 3, setLength 7, attendantId 'solenne.league.tower',
  trainerId 'tower.challenger', trainerName 'Tower Challenger', pools }` — pools derived from SPECIES at load (fully
  evolved, non-legendary, BST bands 300–379 / 350–399 / 380–429 / 400+; 20 / 29 / 29 / 21 species), `towerTier(wins)`,
  `towerSetReward(set)` (money 2 500 × set capped 15 000; rare candy, + max revive, then 2 rare candies + big nugget).
- **Attendant.** `InteriorNpcRole` gains `tower`; the league hall foyer (`leagueHall`) gains `${building}.tower` at
  (−6.5, half − 5), beside the nurse. An interior NPC on purpose: a `ZoneDef` NPC would feed Solenne's layout RNG (plan,
  r1 fixture, heightfield). Interior NPCs stamp nothing — every digest and heightfield is unchanged.
- **validate.ts:** rematch rows (one per league id, levels, ×1.5, legendary rule, nickname ≤ 16, abilities / items),
  tower pools (≥ 6, known, non-legendary), set-reward items. Still 130/130, 67 families. The bind-set cap is unchanged
  (rematch / tower teams are battle-only).
- Tests: `test/postgame.test.ts` (3).

## Phase E5 — the §50.4.2 test files (2026-10-06)

- `test/statics.test.ts`: the 8 rows are the 8 non-mythical legendaries. Each `when` resolves (badge id, or a flag
  set by a beat / quest / league row, registered in §11). `galaxion.when === 'flag:ledger_read'`. Each static and
  each raid hotspot snaps with `nearestWalkable(h, x, z, 8)`, the server's and client's placement, to a walkable
  sample inside `playableBounds`. The two boundary authors, `voidraxis (0, 84)` and `raid_ascent_pyrothal (0, 104)`,
  snap strictly inward.
- `test/families.test.ts`:
  - exactly 67 trees rooted at `evolvesFrom === null`, every species in exactly one tree, no cycle or merge
  - `into` ⇔ `evolvesFrom` agree both ways
  - every root is directly obtainable (wild / swarm / raid / static / quest / battle pass / the three register
    starters, pinned in the test because content cannot import protocol), and the closure under `into` is all 130
  - the one split (`darkone`) carries its null branch last
- `test/league.test.ts`:
  - 8 gyms `verdant_gym … draco_gym` with `BADGE_ORDER` badges in towns in `ZONE_ORDER` order; `BADGES` agrees
  - elite `veil / aurelia / kirei`, one champion `zeon`, all in solenne
  - gym levels non-decreasing (lowest and highest)
  - every league / rematch species, ability (and species-legal) and held item resolves
- `test/encounters.test.ts` (extended, not duplicated) gains the base §50.4.2 block:
  - 15 tables wired to their zones; level ranges and weights
  - RC-9 on the 4 story tables (band, Ghost / Dark night-only)
  - ≤ 16 slots / ≤ 14 species; `|O(zone)| ≤ 16` with `Z(zone)` ⊆ `bindSets`
  - medium omitted on land; water zones have water samples
  - `ALPHA_CHANCE` / `VARIANT_CHANCE`
  - a 100 000-roll seeded sample of `mire_route` (the spawn director's weighted pick) within ±1.5 pp of every slot
- No content defects were found.

## Town arrival point (2026-10-06)

- **Problem** (M3 render audit §1, M3-all-2): eight of the nine towns put `ZoneDef.spawn` on the west road at
  `(−50, 0)` (`saltmourn` `(−50, −6)`), 50 m from the plaza, so fast travel, the escape rope, a fallback join and the
  harness's `spawn-noon` shot all landed with nothing of the town in frame. `spawn` cannot move: `heightfield.ts`
  `authoredPoints` includes it, so it seeds a clearing and keeps ponds off it; moving it reshuffles ponds → roads →
  buildings → interiors → `r1-pre-move.json` and the walker's recorded legs.
- **`src/arrival.ts`**: `arrivalPoint(zoneId)` (memoised) / `arrivalPointFor(zone, surface)` →
  `{ zoneId, x, z, angle, rule }`. Mirevale and every non-town: the spawn (`rule: 'spawn'`; Mirevale faces the plaza
  centre, −π; others angle 0). Other towns: the first candidate on the ring `plaza.r − 3` = 11 m, at
  `0°, ±30°, ±60°, … 180°` from +z (due south first: the default camera, rig heading 0, looks ≈ −z across the plaza
  at the set-piece and the gym), snapped to its nearest sample (else `nearestWalkable` 2 m), accepted when the sample
  and its 8 neighbours are walkable and in the spawn's 4-neighbour component, it is inside the plaza, outside every
  pocket footprint and plan solid and ≥ 1 m outside the set-piece's keep-clear extent, and ≥ `ARRIVAL_CLEARANCE_M`
  2.5 m from every authored point (spawn, npcs, trainers, items, lore, warps + targets, pocket door warps, statics,
  raid hotspots, obstacles). `angle` = `atan2(dx, dz)` toward the plaza centre, wrapped to [−π, π).
- It is **not** an authored point: nothing in the layout keeps it clear, so every heightfield digest, the zone plans
  and the R1 fixture are unchanged (validate prints the same digests).
- Shipped (the `(0, 11)` candidate is blocked by the market stall at ≈ `(−2, 9.5)` and its crates / barrels in six towns):

  | town | arrival | rule | angle |
  |---|---|---|---|
  | mirevale | (0, 6) | spawn | −π |
  | stormrook, marrowdig | (0, 11) | plaza ring 0° | −π |
  | cinderhold, saltmourn, vesperveil, forgewall, skyrend, solenne | (5.5, 9.5) | plaza ring 30° | −2.6168 |

- `validate` rule 12: every zone's arrival point is walkable and in the spawn's walkable component (a town with no
  usable candidate is reported, not thrown). Tests: `test/arrival.test.ts`.

## Post-legacy species: hollowmane #131 (2026-10-08)

- **Source**: `.design/additions/species.js` (`EWAMON_SPECIES_ADDITIONS`, the legacy `EWAMON_SPECIES` row shape).
  `scripts/migrate-legacy.ts` appends those rows after the legacy ones, so dex numbers continue at 131 and the legacy
  rules (learnset spacing, clamps, sprite ids) apply unchanged. `ewamon.js` stays a verbatim copy of the old game:
  core's test content reads only it, so both fuzz digest files are byte-identical. Append new species at the end of
  the additions file; never reorder (dex = insertion order).
- **hollowmane**: Ghost/Fighting, single stage, rare, 98 / 134 / 84 / 122, catch rate 6, sizeScale 1.25,
  abilities Hustle / Guts (the first species to carry either), role Physical Attacker. Defaults Shadow Sneak,
  Night Slash, Low Kick, Phantom Strike; learns Bulk Up 6, Sucker Punch 15, Crunch 24, Close Combat 30,
  Poltergeist 39. Inspired by White (Bleach TYBW): the bone mask, the white mane, the red core in the chest.
- **Obtainable**: `enc_the_rift` `night rare 2` L57–60 (Ghost → night-only, RC rules; the_rift had 12 slots / 12 species,
  now 13). Directly placed 79 → 80, obtainable 131, families 68 (58 non-legendary).
- **Counts**: `validate.ts` rule 3 (131) and the family count (68), `schema.ts` `dexNumber ≤ 131`; the dex achievement
  keeps its persisted id `ach_dex_130` and targets the whole dex (131).
- **Layout**: encounter slots do not feed the zone layout RNG; every heightfield digest and `r1-pre-move.json` are unchanged.
- **Rage Form** (`battleForm`, core `BattleFormDef`; generator `migrateBattleForm`, schema `BattleFormDefSchema`): below
  50 % hp, once per battle — base Atk 162 / Def 66 / Spd 150 (max hp kept), sheds its negative stages, every foe on the
  field −1 Attack. Sprite ids `hollowmane_rage_front|back`; the sprite pipeline ships the art as `hollowmane_rage`.

## Post-legacy species: dustcub #132 → badlander #133 (2026-10-08)

- An outlaw line inspired by Arthur Morgan (Red Dead Redemption 2): a cowboy badger cub and the drifter it grows into.
  Same source and generator path as hollowmane (`.design/additions/species.js`, appended after it).
- **dustcub**: Ground, uncommon, 68 / 70 / 58 / 52, catch rate 90, sizeScale 0.78, abilities Sand Veil / Guts, role
  Physical Attacker. Defaults Tackle, Sand Attack, Mud-Slap, Dark Lasso; learns Bite 6, Howl 9, Bulldoze 15,
  Night Slash 21, Sucker Punch 24, Crunch 30. Evolves at 30.
- **badlander**: Ground/Dark, rare, 104 / 118 / 88 / 74, catch rate 30, sizeScale 1.1, abilities Intimidate / Guts,
  role Physical Attacker. Defaults Dark Lasso, Night Slash, Bulldoze, Sucker Punch; learns Howl 6, Bite 9, Slash 15,
  Crunch 21, Sand Tomb 24, Earthquake 30, Double Edge 36, Close Combat 39. Only moves and abilities that already
  existed: MOVES stays 193, ABILITIES 25.
- **Obtainable**: `enc_deepcut_route` (the canyon, which already has the cowboy trainers) `any uncommon 5` L20–24
  (RC-3 fixes route uncommon weight at 5); badlander by evolution. Directly placed 80 → 81, obtainable 133,
  families 69 (59 non-legendary). Deepcut's table is 13 slots / weight 61.
- **Counts**: `validate.ts` rule 3 (133), families (69), `schema.ts` `dexNumber ≤ 133`; `ach_dex_130` targets 133.
- **Layout**: encounter slots do not feed the zone layout RNG; heightfield digests and `r1-pre-move.json` unchanged.
- **Hollow Crescent** (2026-10-08): the Rage Form's signature move (`battleForm.signatureMove`: Night Slash → Hollow
  Crescent; Ghost 110, 95 %, 5 PP, high critical-hit ratio), from `.design/additions/moves.js` (the generator merges it
  into the legacy moves: 194). The learnset now ends with Night Slash at L39 so every wild hollowmane (L57–60, last four
  level-up moves) knows it; defaults Shadow Sneak / Low Kick / Phantom Strike / Bulk Up. `validate.ts`: a signature move
  exists, replaces a move the species learns, is learned by no species and is not a spread move.
- **Hollow Crescent** (2026-10-08): the Rage Form's signature move (`battleForm.signatureMove`: Night Slash → Hollow
  Crescent; Ghost 110, 95 %, 5 PP, high critical-hit ratio), from `.design/additions/moves.js` (the generator merges it
  into the legacy moves: 194). The learnset now ends with Night Slash at L39 so every wild hollowmane (L57–60, last four
  level-up moves) knows it; defaults Shadow Sneak / Low Kick / Phantom Strike / Bulk Up. `validate.ts`: a signature move
  exists, replaces a move the species learns, is learned by no species and is not a spread move.

## Post-legacy species: veilpup #134 → hollowolf #135 (2026-10-08)

- A blindfolded wolf line inspired by Gojo Satoru (Jujutsu Kaisen): a cocky pup and the untouchable sorcerer it grows
  into (Infinity, the red and blue sparks, Hollow Purple). Same source and generator path as hollowmane and dustcub
  (`.design/additions/species.js`, appended after badlander).
- **veilpup**: Psychic, rare, 64 / 60 / 56 / 84, catch rate 45, sizeScale 0.8, abilities Keen Eye / Competitive, role
  Special Attacker. Defaults Quick Attack, Confusion, Bite, Calm Mind; learns Psych Wave 6, Extrasensory 15,
  Starfall 24, Mind Crush 33, Future Sight 42. Evolves at 42.
- **hollowolf**: Psychic/Cosmic, rare, 90 / 122 / 80 / 126, catch rate 25, sizeScale 1.2, abilities Levitate / Keen Eye,
  role Special Attacker. Defaults Extrasensory, Starfall, Mind Crush, Calm Mind; learns Quick Attack 6, Brain Pulse 15,
  Future Sight 24, Eclipse Void 30, Rift Collapse 39. The first non-legendary Cosmic species (the user approved it); no
  rule reserves the type. Only existing moves and abilities: MOVES stays 194, ABILITIES 25.
- **Obtainable**: `enc_skyrend` (the cliff roosts) `any rare 2` L38–41 (below the evolution level; rare weight per
  RC-3); hollowolf by evolution. Directly placed 81 → 82, obtainable 135, families 70 (60 non-legendary). Skyrend's
  land table is 6 slots / day 21 / night 21. The first choice, `enc_ascent_route`, made the sprite planner's
  co-occurrence pairing duplicate 6 species (71 atlases, over the 68 cap); skyrend keeps 68 with none.
- **Counts**: `validate.ts` rule 3 (135), families (70), `schema.ts` `dexNumber ≤ 135`; `ach_dex_130` targets 135.
- **Layout**: encounter slots do not feed the zone layout RNG; heightfield digests and `r1-pre-move.json` unchanged.

## Post-legacy species: castlemaw #136 (2026-10-08)

- A vigilante inspired by the Punisher (Marvel): a honey badger in a long coat, a skull on its chest, cannon arms and a
  belt of bone rounds. Same source and generator path as the others (`.design/additions/species.js`, after hollowolf).
- **castlemaw**: Dark/Steel (the first species with that pairing), single stage, rare, 112 / 128 / 104 / 76, catch rate 8,
  sizeScale 1.2, abilities Intimidate / Iron Barbs, role Physical Attacker. Defaults Bite, Metal Burst, Snarl, Smart
  Strike; learns Iron Defense 6, Sucker Punch 15, Flash Cannon 24, Crunch 30, Iron Fist 39.
- **Rage Form** (`battleForm`, as hollowmane's): below 50 % hp, once per battle; Atk 160 / Def 86 / Spd 104 (max hp,
  types, ability kept), sheds its negative stages, every foe on the field −1 Defense. Signature move `Vendetta Volley`
  (Steel 110, 90 %, 5 PP, 30 % burn; `.design/additions/moves.js`, MOVES 194 → 195) replaces Flash Cannon, which every
  wild one (L44–48, its last four moves) knows. Sprite ids `castlemaw_rage_front|back`.
- **Obtainable**: `enc_umbral_observatory` `night rare 2` L44–48 (12 slots, day 27 / night 53). Directly placed 82 → 83,
  obtainable 136, families 71 (61 non-legendary). The first choice, `enc_siege_route`, made the sprite planner
  duplicate 8 species (73 atlases); umbral_observatory keeps 69 with none.
- **Counts**: `validate.ts` rule 3 (136, MOVES 195), families (71), `schema.ts` `dexNumber ≤ 136`; `ach_dex_130` targets 136.
- **Layout**: encounter slots do not feed the zone layout RNG; heightfield digests and `r1-pre-move.json` unchanged.

## The honor ledger: dustcub → lawlander #137 / badlander (2026-10-08)

- dustcub's evolution is a `split` at 30 with a new condition kind, `{ kind: 'honor', atLeast: 0 }` → `lawlander`, default
  `badlander` (core `honor.ts`; the rules are in spine §2.3). The additions row writes it as
  `splitEvolvesInto: [{ condition: "honor", value: 0, into: "lawlander" }, { into: "badlander" }]`; the generator maps
  `condition: 'honor'` with a numeric `value` to the honor condition. `schema.ts` accepts it; `validate.ts` checks an
  ability condition's ability and keeps an honor minimum inside −9..10.
- **lawlander** (#137): Ground/Fighting, rare, 110 / 106 / 98 / 70, catch rate 30, sizeScale 1.1, Keen Eye / Guts, role
  Physical Defender. Defaults Bulldoze, Counter, Mach Punch, Protect; learns Howl 6, Bulk Up 9, Power Jab 15, Slash 21,
  Iron Fist 24, Earthquake 30, Body Slam 36, Close Combat 39. Evolution only: the directly placed count stays 83, the
  families stay 71 (it is not a root), obtainable 137. `families.test.ts` / `index.test.ts` now expect two splits.

## Signature moves of the legendaries and mythicals (2026-10-08)

- **Every legendary / mythical owns one signature move** (the client plays its cinematic, `battle/signatures.ts`):
  galaxion Cosmic Pyre, voltaura Sparking Grace, sunjaw Sunbreaker Barrage, raikitsune Foxfire Voltage, zenryu
  Kamehameha, lumyth Cosmic Miracle, noxmyth Stellar Devour, bankaiser Bankai Sever, voidraxis Rift Collapse, and the
  new **Aurora Requiem** for glacinid (Ice 130, 90 %, 5 PP, freeze 10 % — `.design/additions/moves.js`; 196 moves).
  No other species learns one: hollowolf drops Rift Collapse (its learnset ends with Eclipse Void, now L39; Brain Pulse
  18, Future Sight 27), ironcarab's L39 Bankai Sever becomes Six-Blade Storm. The client's `signatures.test.tsx`
  asserts the exclusivity.
- **They know it when met.** The signature moves were level-1 defaults, which the server's last-four rule
  (`movesAtLevel`) pushed out: no wild static, league Warden or the Champion's zenryu ever used one. Each now leaves the
  defaults (3 defaults) and is pinned as the newest learnable move, at L39 (raikitsune L27: met at L30), at or below
  every level the creature is met at (statics 30–65, league 54–75, the battle-pass zenryu L100, the mythicals L50).
- **`.design/additions/patches.js`** (new): field patches to LEGACY species rows, since `ewamon.js` stays verbatim —
  whole `moves` / `learnableMoves` replacements and `learnLevels` pins. The generator (`migrate-legacy.ts`) applies them
  after loading the legacy rows (throws on an unknown species or field); a pinned move is left out of the even 5..40
  spacing, so no other level moves, and sorts last among equal levels (it is the newest). Core's fuzz reads only
  `ewamon.js`: the digests do not change.

## Majin / Tenjin forms and bands (2026-10-11)

- Schema: `BattleFormDefSchema` gains `kind` ('majin' | 'tenjin'), `onEnter.cureStatus`, `onEnter.healFraction`;
  `TrainerDefSchema` / `LeagueTrainerSchema` gain `bands` (1..2 kinds). `types.ts` `TrainerDef.bands` / `LeagueTrainer.bands`.
- Generator: `migrateBattleForm` carries `kind` and the two Tenjin onEnter fields (keys only when set);
  `.design/additions/patches.js` may now patch `battleForm` onto a legacy row (the sprite pipeline reads the same file).
  13 species have a form: hollowmane / castlemaw (id `rage`, now `kind: 'majin'`, "Majin Form"), badlander (majin) and
  lawlander (tenjin) in species.js; infernomorel, toxshade, necrogeist, zenryu (majin) and thornback, abysspark,
  gemknight, glimmereen, solpyre (tenjin) in patches.js. Majin: base atk +28 / def −18 / spd +28 and one foe stat −1;
  Tenjin: +10 / +30 / +10, clears its negative stages, cures its status, heals a fifth.
- Items: `MAJIN_BAND` / `TENJIN_BAND` key items (`slot: 'key'`, `price: null`), granted by story beats `sables_turn`
  and `the_requisition` (`grant`), with new after-lines (Sable hands over the field lens; Wynn's letter) and one Reeve line
  in `escorted_out`. Never a gate: nothing needs the bands.
- Trainers: `majinBand(tr(...))` on reeve_observatory, hollis_siege, varn_spire; league `bands` on veil (majin), aurelia
  (tenjin), zeon (majin, zenryu's Super Saiyan form). x / z unchanged, so no layout moves.
- `pnpm --filter @ewa/content run validate` OK; `npx vitest run packages/content` 21 files / 150 tests.

## hyoryu (#138, 2026-10-13)

- A legendary Ice/Dragon inspired by Daiguren Hyorinmaru (Bleach), from the user's four reference sprites
  (`.design/additions/species.js`). 138 species / 72 families / 197 moves; 11 legendary / mythical species.
- Its Majin Form changes types (Ice/Dragon to Dragon/Dark): `BattleFormDefSchema.types` (optional, one or two types) and
  the generator's `migrateFormTypes` (throws on an unknown type). Base 120 / 144 / 110 / 134, the form 172 / 92 / 162
  (the Majin template), every foe -1 Speed on entering it.
- Signature move **Crimson Lotus Prison** (Dragon 120, 90 %, 5 PP, freeze; `.design/additions/moves.js`), pinned at L39
  with `learnLevels` like the legacy legendaries. The L60 static knows Glacier Crash, Crunch, Dragon Rush and it.
- The ninth static: `LEGENDARY_STATICS` row on eclipse_shrine (-70, -70), L60, `flag:champion:zeon:beaten`, flag
  `leg_hyoryu` (flag registry; the "Nine Old Powers" achievement, was "Eight"). Not on ascent_route, the cold route the
  art suggests: there the sprite planner's pairing duplicated 6 species in the_rift (79 atlases); every zone not on the
  pair's path planned 76 with none duplicated (siege_route also failed). eclipse_shrine has no interiors and is no town, so
  no interior door or arrival point moves; the static is a separate layer from the zone plan (no layout reshuffle).
- The roster gate (`roster.ts`) wants 9 statics; `validate.ts` 138 species, 197 moves, 72 roots.

## Zone sculpts (2026-10-20)

- The user found the zones copy-paste and too linear. `src/sculpt.ts` (the field pass) and `src/data/sculpts.ts` (21
  hand-authored shapes) now give every zone its own landform; SPEC §3.11 "Zone sculpts" (amended in the same change).
- `applySculpt` runs inside `buildTerrainField` after the noise and the kind feature: lifts (polygon / circle /
  Catmull-Rom stroke, `edge` decides cliff or bank, `ragged` from the zone's own value noise), hills, road profiles
  (dry terrain, ±7 m moving average, 0.3 grade both ways, straight across `bridged` lifts), lakes, rivers, then the
  road flatten (deck samples over water are walkable and water). Random biome ponds follow (count from `sculpt.ponds`,
  kept off roads, rivers, lakes and lift outlines), then the authored-point clearings. Only + - * / and `Math.sqrt`,
  `floor`, `round`, `abs`, `min`, `max`: digests stay engine-independent.
- `placeOutcrops` scatters circle lifts from a seed (xorshift32), clear of roads, rivers, lakes, the authored points,
  the statics, the raid hotspots, the set-piece and each other; `ring` / `axes` keep a town's streets clear.
- The plan takes the sculpt's roads (`road_main` replaces the route meander, `road_<dir>` / `lane_s` replace a town's
  generated road, other ids are extra trails), its grass, its set-piece spot, fences and props, and passes on
  `bridges` (deck centrelines + heights), `crags` (cliffed round lifts) and `structures` (`dress` wall / palisade /
  tower) for render.
- Plan rules that changed for every zone: scatter keeps off slopes over 0.9 (`slopeAt`) and the water mask
  (`wetNear`), mirrored by render; water clearances use the mask for any body that is not a round pond (`roundBody`:
  r <= 18 and an extent under 2.6 r), circles stay for ponds; buildings need walkable ground varying <= 1.2 m; props keep
  off door approaches (a footprint there had a walkable hole: the spawn-director test found one under a Solenne well)
  and off the spawn, lamps too (Solenne's spawn no longer sits in a lamp post); a fence keeps its 1.87 m half-length off
  the authored points; interior pockets keep 2.5 m off water (a pocket's screen re-grades the shore and moved a water
  level).
- New prop kinds `tent` (1.3 m) and `campfire` (0.7 m) in `PROP_SOLID_RADIUS`, one travellers' camp per route.
- Retired: `test/fixtures/r1-pre-move.json` and the byte comparisons against the pre-R1 render planners (the sculpts
  change every zone on purpose). New: `test/sculpt.test.ts`. Re-baselined: `dist/heightfields/*.json`.
- `scripts/zone-map.ts` (`pnpm --filter @ewa/content zone-map <dir> [zones]`) draws top-down debug maps of the sculpts:
  the quickest way to check a shape and its reachability before looking at it in 3D.
- `pnpm test:progression` not re-run with the sculpts (about 41 min); the walker pathfinds (`server/test/pathing.ts`),
  and validate's rule 12 proves every story target reachable from the spawn.

## Handover landings on sculpted edges (2026-10-20)

- The first progression run on the sculpts stranded the walker twice: Ash Route → Cinderhold at z = -6 landed on the
  caldera rim at (58, -6), Tide Route → Stormrook at z = 11.5 on a pinnacle top. A handover keeps the lateral
  coordinate (server `entryPoint`), the routes' edges are open, and rule 12 only asks each handover band for one
  reachable sample. 14 links stranded some crossing. SPEC §3.11 "Handover landings" (amended in the same change).
- `shoulder(dir, half, from, to)` in `data/sculpts.ts`: a lift (h 12, edge 12, ragged 1) whose outline sits 4 m inside
  the playable edge, so its face runs from about 10 m in to the margin with no ledge flatter than 35° in the playable
  area. The trigger line (6 m in) closes from 2.7 m to 5 m past each end; an arrival landing on the face is unwalkable
  and snaps (8 m) to the ground at its foot. An end therefore sits 2.2 m inside the stranding stretch; a pocket narrower
  than about 5 m gets a 0.5 m sliver. A first try with a 4.5 m cliffed plateau failed the other way: its flat top is
  walkable, so the neighbour's arrivals landed on it.
- Lake shores and beds are applied after the lifts and flatten a face, so three crossings were fixed with water:
  tide_route's sea vertex (104, -30) is now (100, -24) and (125, -30) is (125, -24); its lagoon's (-104, 48) is
  (-104, 41); ascent_route's tarn lost its west end ((-108, -36) → (-94, -36), (-100, -60) → (-86, -60)) and the
  pier now ends in it at (-86, -44).
- The guard is a server test (it needs `entryPoint`): `server/test/handover-landing.test.ts`, every reachable
  trigger-line sample of every link, both ways, lands in the destination spawn's component.

## Challenge modes (2026-10-20)

- `data/challenge.ts`: the modes (`nuzlocke`, `hardcore`), their flags (`challenge:<mode>`, `challenge:cleared`,
  `challenge:failed`, `challenge:met:<zone>`), the ribbons (`fallen`, `fallen_memorial`), `challengeOf` /
  `challengeActive` / `isFallen` and the labels with each mode's rules, shared by the server and the client. The flags
  are the server's colon-namespaced ones, so `FLAG_REGISTRY` does not list them.

## Ranked seasons (2026-10-20)

- `data/seasons.ts`: `seasonAt` / `seasonByNumber` (four weeks from Monday 2026-10-05 UTC), `finalsWeek` (the last
  seven days), `seasonResetRating` (halfway back to 1000, truncated towards it, like the SQL), `seasonTitle`. Not a
  story gate and nothing in the zone layer, so no fixture moves.

## Honor shapes the world (2026-10-20)

- `data/worldHonor.ts`: the points per deed, `deedsOf` (a turn's events; only player sides' deeds count), `shadowLevel`
  (clear below 40 points, then 55 / 65 / 75 / 85 % shadow share), `shadowDarkWeight`, `shadowNotice`, and the
  hollowed town (`HOLLOWED_TOWN` Vesperveil, `HOLLOWED_LINES` by npc id, `HOLLOWED_FLAG` the client's pseudo-flag).
  Nothing here touches the zone layer, so no fixture moves; the lines are dialogue only, never a gate.

## Majin vs Tenjin seasons (2026-10-20)

- `data/factions.ts`: the two sides with their words (drawn from the bands' own descriptions: Sable's lens shows a
  thing unmade, Wynn's shows a thing held), the points per deed, `factionWinner` (none on a tie) and `chronicleLine`.

## One roaming legendary per season (2026-10-20)

- `data/roamer.ts`: the roamers (Voltaura, Sunjaw, Glacinid in turn; all three are also statics, so a missed season
  never costs a species) and the schedule: `roamerZoneAt` hashes (season, 30-minute period) over eight routes and
  steps on when it would repeat the last period's route. Every server derives the same route with no shared state.

## Ghost trainers (2026-10-20)

- `data/ghosts.ts`: the chance, the fade time, the level span, the per-zone count, the trainer id (`ghost:<username>`,
  public and unique, so the client can name the foe without a lookup), the reward and the report sentence.

## Breeding (2026-10-21)

- `data/daycare.ts`: the Daycare (Mirevale house 1) and every breeding rule as a small pure function (who breeds, what
  hatches, egg moves, honor / coat / ability slot, bandborn, egg steps by rarity, the shiny odds). The Daycare is an
  interiors-layer change only: `withDaycare` relabels the hall and turns its resident into the keeper (role
  `daycare`); the hall, its footprint, walls and props are the house's, and `ZoneDef` is untouched, so no plan, layout
  RNG, heightfield or progression fixture moves.
- The species is the first-left parent's first stage (`evolutionRoot`), so a player chooses the line by the order they
  leave the pair; legendaries and mythicals (`SpeciesDef.legendary`) never breed.

## Nemeses (2026-10-21)

- `data/nemesis.ts`: every nemesis rule as a small pure function (chances by shadow level, the fair fight level, the
  scar by how it won and its ribbon, names and titles by type, the gained move, the taunts). Nothing in `ZoneDef`, the
  plan, the layout RNG or the heightfield changes; the world gains no layer: a nemesis lives in the database and meets
  the player through the grass roll.
- Names are a type's head and a common tail (at most 12 letters, a nickname takes 16). The word tables are content so
  they can be read and tuned; none uses an em-dash.

## A living ecosystem (2026-10-21)

- `data/ecosystem.ts`: the food chain (hand rows, then a type rule over the zone's own species), the weekly pressure,
  the seasonal migrations and the honor tilt as one pure `ecosystemOf(input)` that returns the reweighted table and the
  reading the Dex shows. No `ZoneDef`, plan, layout RNG, heightfield or progression fixture moves: the authored
  `ENCOUNTER_TABLES` are untouched and a zone with no history rolls them exactly.
- `lightLevel` (worldHonor.ts) is `shadowLevel` with light and shadow swapped: the same minimum of history and the same
  thresholds over the light share. Nothing but the ecosystem reads it.
- The darkened tilt only adds Ghost species that are not Dark: `rollWild` already weighs Dark species by
  `shadowDarkWeight`, so a Dark/Ghost creature is weighed once. The reading still reports a Dark species' full factor.
- `MIGRATION_ROUTES` is hand authored, not derived: content cannot read the sprite manifest (it depends on core and zod
  only). The twelve routes were picked from the shipped manifest (a species in the target zone's atlases, not yet in its
  table, between neighbours); the client test `ecosystem-sprites.test.ts` re-checks them against the manifest, so a
  re-plan of the atlases that drops one fails a test instead of loading a stray atlas mid-battle.
- Neighbours count two zones one town apart when the town has no table: routes are only ever linked through towns.
