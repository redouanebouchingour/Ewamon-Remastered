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
