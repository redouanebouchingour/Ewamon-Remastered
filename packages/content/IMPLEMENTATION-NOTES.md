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
   boundary and snap inward as the CHANGELOG predicts. Prop footprints are render data and are not modelled.
   Walkable ratio: 61.3 % (saltmourn) … 74.4 % (siege_route, deepcut_route).
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
heightfields 21 · min walkable 61.3%
```

Generator rewrites (also in the generated headers): `Moonblast` `lower_spAtk → lower_atk` (§2.4); no move carried
`weaknessPolicy` after all (the §2.4 note is honoured by code, not needed by data).
