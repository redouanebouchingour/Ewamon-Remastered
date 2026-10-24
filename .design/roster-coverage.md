# EWAMON REMASTERED — ROSTER COVERAGE SPEC v1.0

**Author:** Lead content designer
**Status:** BINDING for `packages/content` encounters, statics, live-ops keys and `validate.ts` rule 7. Subordinate to `.design/spec/00-spine.md`: every interface below that the spine already defines is consumed verbatim, never redefined. Three additive amendments to the spine are requested in §4.3 (A1–A3); until A1 lands, the four `kind: 'story'` tables in §6 are authored but not exported.
**Method:** every number in this file was computed by the script in Appendix A over `.design/legacy/ewamon.js` (130 species) and the 8 legacy route tables in `.design/legacy/world.js` / `worldImported.js`. The slot tables in §6 are the data — the script parses them out of this file, so the document and the check cannot drift.

Authoritative counts, read from the legacy data and never adjusted by hand:
`species 130` · `evolution roots 67` · stages `base 49 / mid 13 / final 50 / single 18` · `legendary 8` · `mythical 2` · legacy rarities `common 33 / uncommon 30 / rare 44 / epic 13 / legendary 8 / mythical 2` · `types 19` · evolution kinds: **level only**, 61 families; **one** ability split (`darkone` L20 → `aonred` when ability = `Lightning Rod`, else `darkyon`); **zero** item/stone evolutions.

---

## 1. THE PROBLEM, MEASURED

The legacy world had eight wild tables (`mire, ash, tide, galvan, deepcut, hollow, siege, ascent`), 43 rows, **39 distinct species**. Closing that set under evolution and adding the 10 legendary/mythical statics and the 3 registration starters reaches **99 of 130**. The remaining **31 species belong to 17 families whose root never spawned**:

| Root (legacy rarity, catch rate) | Types | Unobtainable members |
|---|---|---|
| fennorange (common, 45) | Ground | fennorange, berkest, clementar |
| shiveruff (common, 40) | Ice/Normal | shiveruff, blizzhowl, auroracle |
| snapling (common, 44) | Grass/Poison | snapling, venobulb |
| resilian (common, 50) | Bug/Flying | resilian, resilith, resilithorn |
| rimeidol (uncommon, 36) | Dark | rimeidol, murmink, velvetomb |
| fibrostis (uncommon, 40) | Poison | fibrostis, chrysotox |
| ripshell (uncommon, 16) | Water/Fighting | ripshell |
| bloomsprite (uncommon, 28) | Grass/Fairy | bloomsprite |
| acier (rare, 10) | Steel/Fighting | acier |
| miscarmen (rare, 12) | Psychic | miscarmen, mismagmen |
| moflame (rare, 10) | Fire | moflame, moblaze |
| yahit (rare, 20) | Fighting | yahit, yaschamp, yasprime |
| wraithtide (rare, 14) | Water/Ghost | wraithtide |
| flowbot (epic, 5) | Electric/Steel | flowbot |
| kygra (epic, 5) | Water | kygra |
| raidori (epic, 5) | Electric | raidori |
| malice (rare, 20) | Ghost/Fairy | malice, devourest, necrogeist |

`PLAN.md`'s "45 of 130 appear nowhere" counted species with no direct placement of any kind; the number that matters for the Dex is the post-closure 31. Five of them (`wraithtide, kygra, ripshell, bloomsprite, acier`) were additionally referenced by dead systems (raid pools, swarms, a gym team) and so *looked* placed. `berkest` was in a legacy table without its root `fennorange`, so the family was completable only downward.

Also dead, and rewritten here against real `ZoneId`s: 8 quests keyed to `bloom-route … vanguard-arena`, 3 seasonal events keyed to `victory_road / cerulean_city / pallet_town / route_1 / route_2 / route_21`, 7 daily swarms keyed to the same, 16 hotspots and 4 raid pools keyed to `tidal-route / stone-route / phantom-route / draco-route`. None ever matched a live zone id.

---

## 2. PILLARS

**Pillar 1 — Every root spawns.** All 57 non-legendary evolution roots and single-stage species appear in at least one `EncounterSlot`. A family that can only be completed downward from a wild mid-stage is a bug, because the Dex entry for the root is the "witness" the story is built on.

**Pillar 2 — A family completes by level from a wild root, with the player alone.** No stone, no trade, no friend. The two finals that cannot be reached by level from a wild root under the spine's rules (`aonred`/`darkyon`, §8) spawn wild themselves.

**Pillar 3 — Bands are monotone with badge order.** Route bands step `2–6 → 7–11 → 11–15 → 15–20 → 20–25 → 25–30 → 30–35 → 35–42`; the three town tables and the four story tables sit above the route that feeds them. No slot's `levelMax` exceeds its zone's band, and no slot's `levelMin` is below it.

**Pillar 4 — Night is a different roster, not a darker one.** Every Ghost- or Dark-typed slot is `night`. Every table still has ≥ 4 day-eligible and ≥ 4 night-eligible slots and ≥ 3 `any` slots, so neither half of the 48-minute day is empty.

**Pillar 5 — Tiers are weights, not adjectives.** `common 6–9`, `uncommon 5`, `rare 2–4`, `alpha 1`. Disjoint ranges, machine-checked. A slot's probability is `weight / Σ weight over slots eligible at that time of day`; §5 prints the sums and the resulting mean interval for each zone's rarest slot.

**Pillar 6 — Legendaries are gated statics; mythicals are rewards.** The 8 legendaries appear exactly once each, in `LEGENDARY_STATICS`, gated by a badge or the champion flag. `lumyth` and `noxmyth` are `rewards.creature` of two Act III quests (§7) and, as the spine already fixes, the battle-pass 50 choice.

**Pillar 7 — Finals do not spawn wild.** Evolution is the memory becoming certain of itself; the player sees it happen. Mid-stages spawn only at `evolvesAt + 2` or higher and only in zones after the one their root spawns in. The sole exception is the ability split (§8).

**Pillar 8 — Keyed to `ZoneId`, validated at build.** Every table, static, quest, event, swarm and hotspot names a `ZoneId` from the spine's 21. `validate.ts` rule 7 (coverage) and the RC rules below fail the build; Appendix A is the reference implementation of those checks and runs against this file.

---

## 3. RULES (RC-1 … RC-13, each asserted by Appendix A and by `content/validate.ts`)

| Rule | Assertion |
|---|---|
| RC-1 | Every species with `evolvesFrom === null` and `legendary === false` appears in ≥ 1 `EncounterSlot`. |
| RC-2 | `BAND[zone].min ≤ levelMin ≤ levelMax ≤ BAND[zone].max` for every slot (bands in §5). |
| RC-3 | `weight` in `common 6..9`, `uncommon 5..5`, `rare 2..4`, `alpha 1..1` by `tier`. |
| RC-4 | No species with `legendary === true` appears in any table, swarm or raid boss. |
| RC-5 | A mid-stage slot has `levelMin ≥ parent.evolution.atLevel + 2`. |
| RC-6 | No final form appears in a table, except `aonred` and `darkyon`. |
| RC-7 | A slot whose species has type `Ghost` or `Dark` has `timeOfDay === 'night'`. |
| RC-8 | Every `route` table has exactly one `tier: 'alpha'` slot, at `[BAND.max, BAND.max]`; no other table has one. |
| RC-9 | In a `story` table a base form is allowed only when `evolution.atLevel ≤ BAND.min` (a level-57 `glacifang` is a memory that refused to change; a level-57 `glimp` is a tuning error). |
| RC-10 | Every table has ≥ 3 `any` slots, ≥ 4 slots eligible by day and ≥ 4 eligible by night. |
| RC-11 | `(species, timeOfDay, tier)` is unique within a table. |
| RC-12 | Every `DailySwarm.species` entry is a species in that zone's table; weekdays 0..6 appear exactly once. |
| RC-13 | Every static and hotspot `(x, z)` lies inside `±(size/2 − 1)` of its zone (`route ±119`, `town ±79`, `story ±99`), and `nearestWalkable(h, x, z, 8) !== null`. |

Rule 7 of the spine (closure ⊇ 130) is the outcome; RC-1 … RC-13 are why it stays true when someone edits a row.

---

## 4. INTERFACES

### 4.1 Consumed verbatim from `00-spine.md` §3.2 (not redefined here)

```ts
export type EncounterTier = 'common' | 'uncommon' | 'rare' | 'alpha';
export interface EncounterSlot {
  readonly species: string; readonly weight: number; readonly levelMin: number; readonly levelMax: number;
  readonly timeOfDay: 'day' | 'night' | 'any'; readonly tier: EncounterTier;
}
export interface EncounterTable { readonly id: string; readonly zoneId: ZoneId; readonly slots: readonly EncounterSlot[] }
export const ALPHA_CHANCE = 0.02;
export const VARIANT_CHANCE = 0.03;
```

Table id convention: `enc_<zoneId>` (`enc_mire_route`, `enc_saltmourn`, …). `ZoneDef.encounterTable` is `enc_<id>` for the 15 zones in §5 and `null` for the other 6 (`mirevale, cinderhold, stormrook, marrowdig, vesperveil, forgewall`).

### 4.2 New exports — `packages/content/src/statics.ts` and `validate.ts` (verbatim; nobody else may change them)

```ts
import type { BadgeId, ZoneId } from './zones';

/** `badge:<BadgeId>` or `flag:<story flag>`; the server re-checks the gate on every `interact { kind: 'static' }`. */
export type StaticGate = `badge:${BadgeId}` | `flag:${string}`;

export interface LegendaryStatic {
  readonly species: string;            // one of the 8 non-mythical legendaries, each exactly once
  readonly level: number;
  readonly zoneId: ZoneId;
  readonly x: number; readonly z: number;   // authored; snapped with nearestWalkable(h, x, z, 8) at validate
  readonly flag: string;               // set on win OR catch; the static never appears again for that player
  readonly when: StaticGate;
}
export const LEGENDARY_STATICS: readonly LegendaryStatic[];   // exactly 8 rows, §7

/** The 5 story-zone tables and the 3 town tables get their own tuning (30-server-netcode.md §30.3 owns SpawnTuning). */
export const STORY_TUNING = { targetCount: 36, respawnMinMs: 2_000, respawnMaxMs: 5_000, lifetimeMs: 300_000, engagedTimeoutMs: 90_000 } as const;   // amended 2026-10-08: was 6 / 12–30 s / 180 s
export const TOWN_SPAWN_TUNING = { targetCount: 20, respawnMinMs: 2_000, respawnMaxMs: 5_000, lifetimeMs: 300_000, engagedTimeoutMs: 90_000 } as const;   // amended 2026-10-08: was 4 / 8–20 s / 180 s

export type AcquisitionPath =
  | { readonly kind: 'wild'; readonly zones: readonly ZoneId[] }
  | { readonly kind: 'evolve'; readonly from: string; readonly atLevel: number }
  | { readonly kind: 'static'; readonly zoneId: ZoneId; readonly when: StaticGate }
  | { readonly kind: 'quest'; readonly questId: string }
  | { readonly kind: 'raid'; readonly zones: readonly ZoneId[] };

export interface RosterReport {
  readonly species: 130;
  readonly families: 67;
  readonly directlyPlaced: number;      // |E| in spine rule 7 — 79 for the tables in this file
  readonly obtainable: number;          // |R(E) ∪ statics ∪ mythicals| — must be 130
  readonly unobtainable: readonly string[];   // must be []
  readonly paths: Readonly<Record<string, AcquisitionPath>>;   // one primary path per species id
  readonly perZone: Readonly<Record<ZoneId, readonly string[]>>; // distinct species per table, sorted
}

/** Runs spine rule 7 plus RC-1 … RC-13. Throws with the failing rule ids and offending ids; returns the report otherwise. */
export function assertRosterCoverage(): RosterReport;
```

`assertRosterCoverage()` is called from `validate.ts` and its `RosterReport` is written to `dist/content-report.json` under `roster`, where `50-verification-budget.md`'s `coverage.test.ts` and `families.test.ts` read it.

### 4.3 Spine amendments requested (additive; the reconciler decides)

| Id | Where | Change | Why |
|---|---|---|---|
| **A1** | `00-spine.md` §3.2 comment and §3.10 rule 8 | `ENCOUNTER_TABLES` = 8 route + 3 town + **4 story** tables; rule 8 becomes "a `story` table's slots must satisfy RC-9". `30-server-netcode.md` §30.3: `SpawnDirector` for a `story` zone uses `STORY_TUNING`. | `PLAN.md` fixes "all spawn tables rewritten across the 21 zones"; the endgame bands 45–60 do not exist anywhere else, and 8 species (`aonred, darkyon, devourest` and the level-55+ singles) have no other sensible home. |
| **A2** | `00-spine.md` §3.2 `EncounterSlot` | Add `readonly medium?: 'land' \| 'water'` (default `'land'`); `Heightfield` gains `readonly water: Uint8Array` (1 = water surface). `SpawnDirector` positions a `water` slot on a `water` sample, otherwise on `walkable`. Engagement of a `water` spawn requires the player to be on a `water` sample (HM Surf, `fieldVerb: 'surf'`, or standing on the harbour boardwalk cells the layout marks as both). | Water species that spawn on grass read as wrong. Without A2 the §6 `medium` column is dropped at transcription and every slot is `land`; coverage is unaffected either way. |
| **A3** | `30-server-netcode.md` §30.4.4 `wild` row | Wild battler ability = `species.abilities[rng.int(abilities.length)]` (one draw, from the spawn's rng) instead of index 0. | Makes `darkyon` reachable by evolution from a wild `darkone` (`Competitive`). Not required for coverage — §8 places both finals — but without it every wild `darkone` is a `Lightning Rod` and the split is decorative. |

---

## 5. BANDS, TUNING AND WEIGHT SUMS

`kind` from the spine §3.1 table. `targetCount` from `ROUTE_TUNING` (80), `TOWN_SPAWN_TUNING` (20), `STORY_TUNING` (36) <!-- amended 2026-10-08: denser wild spawns; were 14 / 4 / 6 -->. Weight sums are computed by Appendix A from §6 (`daySum` = Σ weight of `any`+`day` slots, `nightSum` = Σ of `any`+`night`). With the cadence in §30.3 a zone below target spawns one creature every 1.5–3.5 s on a route (mean 2.5 s) and every 2–5 s in a town or story zone (mean 3.5 s), so the mean wait for a specific slot while the zone is below target is `mean × Σ / weight`; the last column is that number for the zone's rarest **day** slot (amended 2026-10-08: was 8–20 s, mean 14 s, for every kind).

| Zone | Kind | Band | Table id | targetCount | Slots | daySum | nightSum | Rarest day slot → mean wait |
|---|---|---|---|---|---|---|---|---|
| mire_route | route | 2–6 | enc_mire_route | 80 | 11 | 45 | 44 | bloomsprite 2/45 → 56 s |
| ash_route | route | 7–11 | enc_ash_route | 80 | 10 | 37 | 35 | cindercap 3/37 → 31 s |
| tide_route | route | 11–15 | enc_tide_route | 80 | 11 | 48 | 46 | kygra 2/48 → 60 s |
| galvan_route | route | 15–20 | enc_galvan_route | 80 | 10 | 43 | 41 | wooltug 4/43 → 27 s |
| deepcut_route | route | 20–25 | enc_deepcut_route | 80 | 13 | 56 | 61 | pyrecap 2/56 → 70 s |
| hollow_route | route | 25–30 | enc_hollow_route | 80 | 15 | 28 | 69 | fibrostis 5/28 → 14 s |
| siege_route | route | 30–35 | enc_siege_route | 80 | 11 | 48 | 48 | flowbot 2/48 → 60 s |
| ascent_route | route | 35–42 | enc_ascent_route | 80 | 11 | 47 | 40 | serpyre 3/47 → 39 s |
| saltmourn | town | 14–24 | enc_saltmourn | 20 | 6 | 17 | 17 | kygra 2/17 → 30 s |
| skyrend | town | 38–44 | enc_skyrend | 20 | 6 | 21 | 21 | veilpup 2/21 → 37 s |
| solenne | town | 40–45 | enc_solenne | 20 | 6 | 26 | 28 | bloomsprite 3/26 → 30 s |
| eclipse_shrine | story | 45–50 | enc_eclipse_shrine | 36 | 9 | 23 | 35 | shardling 5/23 → 16 s |
| umbral_observatory | story | 42–48 | enc_umbral_observatory | 36 | 12 | 27 | 53 | fibrostis 5/27 → 19 s |
| celestial_spire | story | 50–55 | enc_celestial_spire | 36 | 9 | 44 | 27 | flowbot 2/44 → 77 s |
| the_rift | story | 55–60 | enc_the_rift | 36 | 13 | 26 | 41 | kygra 2/26 → 46 s |

Per-slot roll, as §30.3 already fixes: `ALPHA_CHANCE 0.02` on every spawn plus the forced `alpha` slot (weight 1 of ~45 ≈ +2.2 % on routes); `VARIANT_CHANCE 0.03`; swarm species ×`weightBoost` (§12.3).

---

## 6. SPAWN TABLES

Column order is fixed and machine-parsed: `zoneId | species | weight | levelMin | levelMax | time | tier | medium`. `time` ∈ `any/day/night` maps to `EncounterSlot.timeOfDay`; `medium` is the A2 field (dropped if A2 is refused). One row = one `EncounterSlot`.

### 6.1 mire_route — grove, Grass, L2–6

| zoneId | species | weight | levelMin | levelMax | time | tier | medium |
|---|---|---|---|---|---|---|---|
| mire_route | mossling | 8 | 2 | 5 | any | common | land |
| mire_route | glimp | 7 | 2 | 4 | any | common | land |
| mire_route | smellduck | 7 | 2 | 5 | any | common | land |
| mire_route | mufflo | 6 | 2 | 4 | any | common | land |
| mire_route | seedrift | 6 | 3 | 5 | day | common | land |
| mire_route | resilian | 5 | 2 | 5 | day | uncommon | land |
| mire_route | dreambud | 5 | 3 | 5 | night | uncommon | land |
| mire_route | snapling | 5 | 3 | 6 | night | uncommon | land |
| mire_route | bramblecub | 3 | 4 | 6 | any | rare | land |
| mire_route | bloomsprite | 2 | 4 | 6 | day | rare | land |
| mire_route | mossling | 1 | 6 | 6 | any | alpha | land |

### 6.2 ash_route — cinder, Fire, L7–11

| zoneId | species | weight | levelMin | levelMax | time | tier | medium |
|---|---|---|---|---|---|---|---|
| ash_route | flampling | 8 | 7 | 10 | day | common | land |
| ash_route | embrock | 7 | 7 | 10 | any | common | land |
| ash_route | fennorange | 7 | 7 | 10 | any | common | land |
| ash_route | pebfist | 6 | 7 | 9 | any | common | land |
| ash_route | coalette | 5 | 8 | 11 | any | uncommon | land |
| ash_route | wickling | 5 | 7 | 10 | night | uncommon | land |
| ash_route | cindercap | 3 | 8 | 11 | any | rare | land |
| ash_route | moflame | 2 | 9 | 11 | night | rare | land |
| ash_route | cryptorb | 2 | 9 | 11 | night | rare | land |
| ash_route | flampling | 1 | 11 | 11 | day | alpha | land |

### 6.3 tide_route — salt, Water, L11–15 (surf zone)

| zoneId | species | weight | levelMin | levelMax | time | tier | medium |
|---|---|---|---|---|---|---|---|
| tide_route | mudbub | 8 | 11 | 14 | any | common | land |
| tide_route | brookrawl | 7 | 11 | 14 | any | common | land |
| tide_route | shiveruff | 7 | 11 | 14 | any | common | land |
| tide_route | slushpup | 6 | 12 | 15 | any | common | land |
| tide_route | mossling | 6 | 11 | 13 | any | common | land |
| tide_route | glowtent | 5 | 12 | 15 | night | uncommon | water |
| tide_route | tidespine | 5 | 12 | 15 | any | uncommon | water |
| tide_route | glimfin | 3 | 13 | 15 | any | rare | water |
| tide_route | ripshell | 3 | 13 | 15 | any | rare | water |
| tide_route | kygra | 2 | 14 | 15 | day | rare | water |
| tide_route | mudbub | 1 | 15 | 15 | any | alpha | land |

### 6.4 galvan_route — storm, Electric, L15–20

| zoneId | species | weight | levelMin | levelMax | time | tier | medium |
|---|---|---|---|---|---|---|---|
| galvan_route | ampmite | 8 | 15 | 18 | any | common | land |
| galvan_route | stormchick | 7 | 15 | 18 | day | common | land |
| galvan_route | gustuff | 7 | 15 | 18 | any | common | land |
| galvan_route | mufflo | 6 | 15 | 17 | any | common | land |
| galvan_route | shardling | 5 | 17 | 20 | any | uncommon | land |
| galvan_route | glimfin | 5 | 16 | 20 | any | uncommon | water |
| galvan_route | wooltug | 4 | 20 | 20 | any | rare | land |
| galvan_route | darkone | 3 | 17 | 20 | night | rare | land |
| galvan_route | raidori | 2 | 18 | 20 | night | rare | land |
| galvan_route | ampmite | 1 | 20 | 20 | any | alpha | land |

### 6.5 deepcut_route — marrow, Rock, L20–25

| zoneId | species | weight | levelMin | levelMax | time | tier | medium |
|---|---|---|---|---|---|---|---|
| deepcut_route | pebblit | 8 | 20 | 23 | any | common | land |
| deepcut_route | fennorange | 7 | 20 | 23 | any | common | land |
| deepcut_route | pebfist | 7 | 20 | 23 | any | common | land |
| deepcut_route | embrock | 6 | 20 | 23 | any | common | land |
| deepcut_route | coalette | 5 | 22 | 25 | any | uncommon | land |
| deepcut_route | berkest | 5 | 21 | 24 | any | uncommon | land |
| deepcut_route | dustcub | 5 | 20 | 24 | any | uncommon | land |
| deepcut_route | wooltug | 5 | 20 | 23 | any | uncommon | land |
| deepcut_route | rimeidol | 5 | 21 | 25 | night | uncommon | land |
| deepcut_route | yahit | 3 | 22 | 25 | any | rare | land |
| deepcut_route | pyrecap | 2 | 20 | 23 | any | rare | land |
| deepcut_route | lithokrysm | 2 | 24 | 25 | any | rare | land |
| deepcut_route | pebblit | 1 | 25 | 25 | any | alpha | land |

### 6.6 hollow_route — vesper, Ghost, L25–30

| zoneId | species | weight | levelMin | levelMax | time | tier | medium |
|---|---|---|---|---|---|---|---|
| hollow_route | nettlewisp | 8 | 25 | 28 | night | common | land |
| hollow_route | murkrat | 7 | 25 | 28 | night | common | land |
| hollow_route | zaptus | 7 | 25 | 28 | any | common | land |
| hollow_route | hexroach | 6 | 26 | 29 | any | common | land |
| hollow_route | fibrostis | 5 | 25 | 28 | any | uncommon | land |
| hollow_route | nerohat | 5 | 27 | 30 | night | uncommon | land |
| hollow_route | umbrit | 5 | 27 | 30 | night | uncommon | land |
| hollow_route | briarbear | 5 | 25 | 28 | any | uncommon | land |
| hollow_route | nebucloak | 5 | 25 | 28 | any | uncommon | land |
| hollow_route | murmink | 5 | 25 | 28 | night | uncommon | land |
| hollow_route | darkone | 3 | 28 | 30 | night | rare | land |
| hollow_route | miscarmen | 3 | 26 | 29 | night | rare | land |
| hollow_route | malice | 2 | 27 | 30 | night | rare | land |
| hollow_route | wraithtide | 2 | 28 | 30 | night | rare | water |
| hollow_route | nettlewisp | 1 | 30 | 30 | night | alpha | land |

### 6.7 siege_route — forge, Steel, L30–35

| zoneId | species | weight | levelMin | levelMax | time | tier | medium |
|---|---|---|---|---|---|---|---|
| siege_route | grubolt | 8 | 30 | 33 | any | common | land |
| siege_route | coldplate | 7 | 30 | 33 | any | common | land |
| siege_route | shardling | 7 | 30 | 33 | any | common | land |
| siege_route | scraphog | 6 | 32 | 35 | any | common | land |
| siege_route | alloylark | 5 | 32 | 35 | day | uncommon | land |
| siege_route | lithokrysm | 5 | 30 | 33 | any | uncommon | land |
| siege_route | yaschamp | 5 | 30 | 33 | any | uncommon | land |
| siege_route | coalette | 5 | 30 | 33 | night | uncommon | land |
| siege_route | flowbot | 2 | 33 | 35 | any | rare | land |
| siege_route | acier | 2 | 33 | 35 | any | rare | land |
| siege_route | grubolt | 1 | 35 | 35 | any | alpha | land |

### 6.8 ascent_route — sky, Dragon, L35–42 (surf: the glacier melt)

| zoneId | species | weight | levelMin | levelMax | time | tier | medium |
|---|---|---|---|---|---|---|---|
| ascent_route | scalewisp | 8 | 35 | 38 | any | common | land |
| ascent_route | budwing | 7 | 35 | 38 | day | common | land |
| ascent_route | shiveruff | 7 | 35 | 38 | any | common | land |
| ascent_route | glacifang | 6 | 36 | 39 | any | common | land |
| ascent_route | tidalfang | 5 | 36 | 39 | any | uncommon | water |
| ascent_route | blizzhowl | 5 | 35 | 38 | night | uncommon | land |
| ascent_route | bloomdrake | 5 | 36 | 39 | day | uncommon | land |
| ascent_route | resilith | 5 | 35 | 38 | any | uncommon | land |
| ascent_route | serpyre | 3 | 39 | 42 | any | rare | land |
| ascent_route | umbrit | 3 | 38 | 42 | night | rare | land |
| ascent_route | scalewisp | 1 | 42 | 42 | any | alpha | land |

### 6.9 saltmourn — town static: the drowned harbour, L14–24 (all water)

The only town whose "static" species are the point of the town. `TOWN_SPAWN_TUNING`, 4 concurrent. Every slot is `water`: the harbour basin and the sunken quay.

| zoneId | species | weight | levelMin | levelMax | time | tier | medium |
|---|---|---|---|---|---|---|---|
| saltmourn | tidespine | 5 | 14 | 18 | any | uncommon | water |
| saltmourn | ripshell | 5 | 15 | 19 | any | uncommon | water |
| saltmourn | glimfin | 3 | 14 | 18 | any | rare | water |
| saltmourn | kygra | 2 | 16 | 20 | day | rare | water |
| saltmourn | wraithtide | 2 | 16 | 20 | night | rare | water |
| saltmourn | voltide | 2 | 20 | 24 | any | rare | water |

### 6.10 skyrend — town static: the cliff roosts, L38–44

| zoneId | species | weight | levelMin | levelMax | time | tier | medium |
|---|---|---|---|---|---|---|---|
| skyrend | scalewisp | 6 | 38 | 42 | any | common | land |
| skyrend | budwing | 5 | 38 | 42 | any | uncommon | land |
| skyrend | alloylark | 5 | 38 | 42 | day | uncommon | land |
| skyrend | glacifang | 5 | 39 | 44 | night | uncommon | land |
| skyrend | resilith | 3 | 40 | 44 | any | rare | land |
| skyrend | veilpup | 2 | 38 | 41 | any | rare | land |

### 6.11 solenne — town static: the suburb park and pond, L40–45

| zoneId | species | weight | levelMin | levelMax | time | tier | medium |
|---|---|---|---|---|---|---|---|
| solenne | glimp | 6 | 40 | 43 | any | common | land |
| solenne | smellduck | 6 | 40 | 43 | any | common | water |
| solenne | mufflo | 6 | 40 | 43 | any | common | land |
| solenne | dreambud | 5 | 40 | 44 | night | uncommon | land |
| solenne | wooltug | 5 | 41 | 45 | any | uncommon | land |
| solenne | bloomsprite | 3 | 42 | 45 | day | rare | land |

### 6.12 eclipse_shrine — story, Cosmic, L45–50 (A1)

| zoneId | species | weight | levelMin | levelMax | time | tier | medium |
|---|---|---|---|---|---|---|---|
| eclipse_shrine | zaptus | 7 | 45 | 48 | any | common | land |
| eclipse_shrine | scalewisp | 6 | 45 | 48 | day | common | land |
| eclipse_shrine | umbrit | 6 | 45 | 48 | night | common | land |
| eclipse_shrine | nebucloak | 5 | 45 | 49 | any | uncommon | land |
| eclipse_shrine | shardling | 5 | 45 | 48 | any | uncommon | land |
| eclipse_shrine | nerohat | 5 | 45 | 48 | night | uncommon | land |
| eclipse_shrine | miscarmen | 3 | 45 | 48 | night | rare | land |
| eclipse_shrine | malice | 2 | 46 | 50 | night | rare | land |
| eclipse_shrine | devourest | 2 | 46 | 50 | night | rare | land |

### 6.13 umbral_observatory — story, Ghost/Dark, L42–48 (A1)

| zoneId | species | weight | levelMin | levelMax | time | tier | medium |
|---|---|---|---|---|---|---|---|
| umbral_observatory | darkone | 7 | 42 | 45 | night | common | land |
| umbral_observatory | zaptus | 6 | 42 | 45 | any | common | land |
| umbral_observatory | hexroach | 6 | 42 | 45 | any | common | land |
| umbral_observatory | rimeidol | 5 | 42 | 46 | night | uncommon | land |
| umbral_observatory | nerohat | 5 | 42 | 46 | night | uncommon | land |
| umbral_observatory | murmink | 5 | 43 | 47 | night | uncommon | land |
| umbral_observatory | nebucloak | 5 | 42 | 46 | any | uncommon | land |
| umbral_observatory | fibrostis | 5 | 42 | 46 | any | uncommon | land |
| umbral_observatory | miscarmen | 3 | 43 | 47 | night | rare | land |
| umbral_observatory | aonred | 2 | 44 | 48 | night | rare | land |
| umbral_observatory | darkyon | 2 | 44 | 48 | night | rare | land |
| umbral_observatory | castlemaw | 2 | 44 | 48 | night | rare | land |

### 6.14 celestial_spire — story, Cosmic, L50–55 (A1)

| zoneId | species | weight | levelMin | levelMax | time | tier | medium |
|---|---|---|---|---|---|---|---|
| celestial_spire | gustuff | 7 | 50 | 53 | any | common | land |
| celestial_spire | seedrift | 6 | 50 | 53 | day | common | land |
| celestial_spire | stormchick | 6 | 50 | 53 | day | common | land |
| celestial_spire | dreambud | 5 | 50 | 53 | any | uncommon | land |
| celestial_spire | shardling | 5 | 50 | 53 | any | uncommon | land |
| celestial_spire | alloylark | 5 | 51 | 55 | any | uncommon | land |
| celestial_spire | resilith | 5 | 52 | 55 | any | uncommon | land |
| celestial_spire | bloomsprite | 3 | 52 | 55 | day | rare | land |
| celestial_spire | flowbot | 2 | 53 | 55 | any | rare | land |

### 6.15 the_rift — story, Cosmic, L55–60 (A1; surf: the black water)

| zoneId | species | weight | levelMin | levelMax | time | tier | medium |
|---|---|---|---|---|---|---|---|
| the_rift | umbrit | 7 | 55 | 58 | night | common | land |
| the_rift | glacifang | 6 | 55 | 58 | any | common | land |
| the_rift | murkrat | 6 | 55 | 58 | night | common | land |
| the_rift | tidalfang | 5 | 55 | 58 | any | uncommon | water |
| the_rift | yaschamp | 5 | 55 | 58 | any | uncommon | land |
| the_rift | serpyre | 3 | 57 | 60 | any | rare | land |
| the_rift | malice | 2 | 56 | 60 | night | rare | land |
| the_rift | devourest | 2 | 57 | 60 | night | rare | land |
| the_rift | wraithtide | 2 | 56 | 60 | night | rare | water |
| the_rift | acier | 2 | 58 | 60 | any | rare | land |
| the_rift | ripshell | 2 | 57 | 60 | any | rare | water |
| the_rift | kygra | 2 | 58 | 60 | day | rare | water |
| the_rift | hollowmane | 2 | 57 | 60 | night | rare | land |

Totals (Appendix A): **15 tables, 152 slots, 79 distinct species placed directly**; closure under evolution = 120; plus 8 statics and 2 mythical rewards = **130**.

Post-legacy additions (`.design/additions/species.js`, not counted by Appendix A, which reads only `ewamon.js`): `hollowmane` (#131, Ghost/Fighting single stage) — the_rift `night rare 2` L57–60; `dustcub` (#132, Ground) → `badlander` (#133, Ground/Dark) @30 — deepcut_route `uncommon 5` L20–24; `veilpup` (#134, Psychic) → `hollowolf` (#135, Psychic/Cosmic) @42 — skyrend `any rare 2` L38–41; `castlemaw` (#136, Dark/Steel single stage, with a Rage Form) — umbral_observatory `night rare 2` L44–48. Dustcub's evolution is an honor split at 30 (core honor.ts): `lawlander` (#137, Ground/Fighting, the High Honor branch, honor ≥ 0) or `badlander` (Low Honor); lawlander is obtainable by evolution only, so the directly placed count does not change. `hyoryu` (#138, Ice/Dragon legendary, a Majin Form that turns it Dragon/Dark) is the ninth static: eclipse_shrine L60 after the title (§7), in no table (on ascent_route the sprite planner duplicated 6 species in the_rift). `cryptorb` (#139, Electric/Ghost; ash_route `night rare 2` L9–11) splits by honor at 34 into `vysion` (#141, Steel/Psychic, High Honor) or `ultraze` (#140, Steel/Dark, Low Honor), both obtainable by evolution only. With them the game has 157 slots, 84 species placed directly, 141 obtainable, 73 families. The mythical Elemutt line (2026-10-25): `elemutt` (#142, Normal) is quest q13's reward (Mirevale, Act I, L5) and evolves at 16 into `katamute` (#143, Normal), at 36 into `ravatar` (#144, Normal, five relic forms opened by held relics from the four postgame shrines and quest q14); in no table, so the slots stay 157. Now 85 species placed directly, **144** obtainable, 74 families.

---

## 7. LEGENDARY STATICS AND MYTHICAL REWARDS

`LEGENDARY_STATICS`, exactly 9 rows: the 8 legacy legendaries and the post-legacy `hyoryu` (#138, 2026-10-13). Gates keep the legacy conditions where the legacy flag survives the story rewrite (badges; the champion flag `champion:zeon:beaten`, which `30-server-netcode.md` §30.4.4 sets on `championWin`). `galaxion`'s legacy gate `flag:hq_done` belonged to the retired plot; it becomes `badge:anvil` (the badge after the observatory act) until `story-bible.md` names an Act II flag, in which case the bible's flag replaces it and nothing else changes. Levels are the legacy levels except `galaxion` (38 → 45, inside its zone's band). Coordinates are authored inside RC-13 bounds; `validate.ts` snaps them.

| species | level | zoneId | x | z | flag | when | staging |
|---|---|---|---|---|---|---|---|
| raikitsune | 30 | galvan_route | -84 | 96 | `leg_raikitsune` | `badge:circuit` | lightning-struck pylon, night only visible glow |
| bankaiser | 42 | forgewall | 52 | -60 | `leg_bankaiser` | `badge:anvil` | the sealed vault under the bastion |
| galaxion | 45 | umbral_observatory | 0 | -72 | `leg_galaxion` | `badge:anvil` | the great lens, aimed at nothing |
| sunjaw | 55 | ash_route | 96 | -88 | `leg_sunjaw` | `flag:champion:zeon:beaten` | the caldera lip |
| glacinid | 55 | ascent_route | -96 | -96 | `leg_glacinid` | `flag:champion:zeon:beaten` | the frozen cirque |
| voltaura | 55 | galvan_route | 92 | -40 | `leg_voltaura` | `flag:champion:zeon:beaten` | the storm's eye |
| zenryu | 60 | eclipse_shrine | 0 | -80 | `leg_zenryu` | `flag:champion:zeon:beaten` | the altar-stone |
| voidraxis | 65 | the_rift | 0 | 84 | `leg_voidraxis` | `flag:champion:zeon:beaten` | the edge |
| hyoryu | 60 | eclipse_shrine | -70 | -70 | `leg_hyoryu` | `flag:champion:zeon:beaten` | the frozen terrace at the head of the Ascent |

A static battle is `format: 'wild'` with `canFlee` false on the legendary's side and `canCatch` true (§30.4.4 `static` row). Win **or** catch sets `flag`; a KO'd legendary is gone for that player. `catchRate` is the species value (2–3); the spine's single catch curve applies; no rate is inflated.

Mythicals — two quests (§12.1) carry `rewards.creature`: `q11_first_night → { species: 'noxmyth', level: 60 }`, `q12_first_morning → { species: 'lumyth', level: 60 }`. The battle-pass 50 `mythicalChoice: ['lumyth', 'noxmyth']` stays as the spine has it; a player who takes one there still completes the pair through the quests, and spine rule 7 is satisfied by the quest path alone. The Elemutt line (2026-10-25) is a mythical family: `q13_unaligned_pup → { species: 'elemutt', level: 5 }` gives its root, and its later stages count through that root (`roster.ts`: a mythical whose root is a quest reward or the battle-pass choice).

---

## 8. STARTERS AND THE ONE SPLIT

Registration starters and their lines complete by level from the starter alone: `bramblecub → briarbear @16 → thornback @32`, `glimfin → voltide @18 → abysspark @35`, `cindercap → pyrecap @16 → infernomorel @34`. For the Dex all three roots also spawn wild as `rare` slots in the first three routes (`bramblecub` mire_route 3/45, `cindercap` ash_route 3/37, `glimfin` tide_route 3/48 water + galvan_route 5/43 + saltmourn), so a player who picked one starter can witness the other two without trading. Their mid-stages spawn later at RC-5 levels (`briarbear` hollow_route 25–28, `pyrecap` deepcut_route 20–23, `voltide` saltmourn 20–24).

The split. `darkone` (`abilities: ['Lightning Rod', 'Competitive']`) evolves at 20 into `aonred` when its ability is `Lightning Rod`, else `darkyon`. Under `30-server-netcode.md` §30.4.4 a wild battler is projected with **ability index 0**, so every wild `darkone` carries `Lightning Rod` and evolves into `aonred`; `darkyon` is unreachable by evolution. Coverage therefore does not depend on the ability: **both finals spawn wild** in `umbral_observatory` (`night`, `rare` 2/51 each, L44–48) — the sole RC-6 exception — and `darkone` itself spawns in three zones (galvan_route night, hollow_route night, umbral_observatory night). A3 (§4.3) makes the split meaningful for a player raising their own `darkone`; it is not needed for 130/130.

---

## 9. EVOLUTION ITEMS — THE FINDING

There are none. Every one of the 61 evolving families in `ewamon.js` evolves by `evolvesAt` (levels 16–50); the only non-level rule is the ability split above. The spine reserves `ConsumableEffect { kind: 'evolutionStone' }` with zero entries and lists evolution stones under "cut deliberately"; this document introduces none. `Hard Stone` in legacy `shop.js` is a +20 % Rock held item, not an evolution item. `Eviolite` applies to species with `evolution !== null`, which after this rewrite is exactly the 62 non-final, non-single species.

---

## 10. COVERAGE MATRIX — every family, where its root is obtained, how it completes

One row per evolution root (67) plus the legendary/mythical singles. `wild:` lists the zones whose table carries the root; `→ @L` is the level rule that completes the family; a `raid` note marks an additional direct path (raid catch window) for a final that would otherwise exist only by evolution.

| Family (root → … ) | Root obtained | Completes |
|---|---|---|
| smellduck → bloomduck | wild: mire_route, solenne | @20 |
| budwing → bloomdrake → florasage | wild: ascent_route, skyrend; bloomdrake wild ascent_route | @18, @36 |
| fennorange → berkest → clementar | wild: ash_route, deepcut_route; berkest wild deepcut_route | @16, @36 |
| glimp → glimmereen | wild: mire_route, solenne | @16 |
| bramblecub → briarbear → thornback | starter; wild: mire_route; briarbear wild hollow_route | @16, @32 · thornback raid mire_route |
| shiveruff → blizzhowl → auroracle | wild: tide_route, ascent_route; blizzhowl wild ascent_route | @22, @36 |
| pebblit → lithokrysm → prismolith | wild: deepcut_route; lithokrysm wild deepcut_route, siege_route | @22, @36 · prismolith raid deepcut_route |
| nettlewisp → briarvaunt | wild: hollow_route (night) | @24 |
| ampmite → luxtrik | wild: galvan_route | @20 |
| gustuff → cirrileap | wild: galvan_route, celestial_spire | @21 |
| brookrawl | wild: tide_route | single |
| zaptus → nebucloak → archonosis | wild: hollow_route, eclipse_shrine, umbral_observatory; nebucloak wild same three | @18, @38 |
| grubolt → ironcarab | wild: siege_route | @20 |
| embrock → magmolith | wild: ash_route, deepcut_route | @26 |
| mudbub → bogmaw | wild: tide_route | @22 |
| mufflo → wooltug → rambull | wild: mire_route, galvan_route, solenne; wooltug wild galvan_route, deepcut_route, solenne | @18, @36 |
| stormchick → thundrix | wild: galvan_route, celestial_spire | @21 |
| scalewisp → rexaloft | wild: ascent_route, skyrend, eclipse_shrine | @24 |
| tidalfang → abyssrake | wild: ascent_route, the_rift (water) | @26 |
| glacifang → blizzraak | wild: ascent_route, skyrend, the_rift | @25 |
| mossling → verdatide | wild: mire_route, tide_route | @28 |
| slushpup → frofloe | wild: tide_route | @22 |
| glowtent → toxiveil | wild: tide_route (night, water) | @24 |
| snapling → venobulb | wild: mire_route (night) | @24 |
| seedrift → blossomsail | wild: mire_route, celestial_spire | @20 |
| coldplate → glaciarm | wild: siege_route | @28 |
| wickling → ignispectre | wild: ash_route (night) | @23 |
| dreambud → starwhim | wild: mire_route, solenne, celestial_spire | @26 |
| shardling → gemknight | wild: galvan_route, siege_route, eclipse_shrine, celestial_spire | @27 |
| murkrat → toxshade | wild: hollow_route, the_rift (night) | @24 |
| pebfist → geoboxer | wild: ash_route, deepcut_route | @24 |
| flampling → solpyre | wild: ash_route (day) | @22 |
| resilian → resilith → resilithorn | wild: mire_route; resilith wild ascent_route, skyrend, celestial_spire | @21, @40 |
| rimeidol → murmink → velvetomb | wild: deepcut_route, umbral_observatory (night); murmink wild hollow_route, umbral_observatory | @23, @35 |
| darkone → aonred / darkyon | wild: galvan_route, hollow_route, umbral_observatory (night); both finals wild umbral_observatory | @20 by ability (§8) |
| nerohat → fedoraith | wild: hollow_route, eclipse_shrine, umbral_observatory (night) | @22 |
| tidespine → tsunamite | wild: tide_route, saltmourn (water) | @30 |
| fibrostis → chrysotox | wild: hollow_route, umbral_observatory | @32 |
| cindercap → pyrecap → infernomorel | starter; wild: ash_route; pyrecap wild deepcut_route | @16, @34 |
| glimfin → voltide → abysspark | starter; wild: tide_route, galvan_route, saltmourn (water); voltide wild saltmourn | @18, @35 |
| alloylark → rivetalon | wild: siege_route, skyrend, celestial_spire | @36 |
| hexroach → blighthex | wild: hollow_route, umbral_observatory | @35 |
| scraphog → trenchtusk | wild: siege_route | @26 |
| coalette → caldermole | wild: ash_route, deepcut_route, siege_route | @24 |
| ripshell | wild: tide_route, saltmourn, the_rift (water) | single |
| bloomsprite | wild: mire_route, solenne, celestial_spire (day) | single |
| umbrit → voidraith | wild: hollow_route, ascent_route, eclipse_shrine, the_rift (night) | @28 |
| acier | wild: siege_route, the_rift · raid siege_route | single |
| miscarmen → mismagmen | wild: hollow_route, eclipse_shrine, umbral_observatory (night) | @18 |
| moflame → moblaze | wild: ash_route (night) | @26 · moblaze raid ash_route |
| yahit → yaschamp → yasprime | wild: deepcut_route; yaschamp wild siege_route, the_rift | @20, @36 |
| serpyre → pyrothal | wild: ascent_route, the_rift | @28 · pyrothal raid ascent_route |
| wraithtide | wild: saltmourn, hollow_route, the_rift (night, water) · raid hollow_route | single |
| flowbot | wild: siege_route, celestial_spire | single |
| kygra | wild: tide_route, saltmourn, the_rift (day, water) · raid tide_route | single |
| raidori | wild: galvan_route (night) · raid galvan_route | single |
| malice → devourest → necrogeist | wild: hollow_route, eclipse_shrine, the_rift (night); devourest wild eclipse_shrine, the_rift | @30, @50 |
| glacinid · galaxion · voltaura · voidraxis · sunjaw · raikitsune · bankaiser · zenryu · hyoryu | `LEGENDARY_STATICS` (§7) | single |
| lumyth · noxmyth | quest rewards q12 / q11 (§12.1); battle-pass 50 choice | single |
| elemutt → katamute → ravatar | quest reward q13 (§12.1), mythical | @16, @36 |

Type coverage of direct placements: all 19 types have ≥ 3 directly placed species; Cosmic (3 species, all legendary/mythical) is covered by statics and quests only, by construction.

---

## 11. THE PREVIOUSLY UNOBTAINABLE FIVE

| Species | Legacy state | Now |
|---|---|---|
| wraithtide (Water/Ghost, cr 14) | raid pool for retired `phantom-route`; never spawned | saltmourn harbour `night water rare 2/17` L16–20 (the "drowned harbour" the legacy gym title already promised); hollow_route `night water rare 2/69` L28–30; the_rift `night water rare 2/39` L56–60; raid boss hollow_route (§12.4); Sunday–Friday swarm species on Friday (§12.3); quest `q04_drowned_harbour` points at it |
| kygra (Water, cr 5) | swarm/event species for retired `cerulean_city`; never spawned | tide_route `day water rare 2/48` L14–15; saltmourn `day water rare 2/17` L16–20; the_rift `day water rare 2/26` L58–60; raid boss tide_route |
| ripshell (Water/Fighting, cr 16) | swarm species for retired `victory_road`; never spawned | tide_route `water rare 3/48` L13–15; saltmourn `water uncommon 5/17` L15–19; the_rift `water rare 2/26` L57–60; Tuesday swarm |
| bloomsprite (Grass/Fairy, cr 28) | nowhere | mire_route `day rare 2/45` L4–6 (the first rare a new player can meet); solenne park `day rare 3/26` L42–45; celestial_spire `day rare 3/44` L52–55 |
| acier (Steel/Fighting, cr 10) | Marshal Rell's L42 gym member only | siege_route `rare 2/48` L33–35; the_rift `rare 2/26` L58–60; raid boss siege_route L48; Saturday swarm; quest `q08_anvil_debt` |

---

## 12. LIVE-OPS, RE-KEYED TO REAL ZONE IDS

### 12.1 Quests (14) — shape `QuestDef`, spine §3.4

Giver ids follow `<zoneId>.<role>`; the story bible must author these `NpcDef`s (or the row's `giver` becomes `null`, auto-offered). Trainer ids in `defeatTrainer` are `TrainerDef` ids the zone authoring must create. Item ids are spine consumable/orb ids. `requires` chains the list in order unless stated.

| id | act | zoneId · giver | objectives (kind → target) | rewards |
|---|---|---|---|---|
| `q01_first_witness` | 1 | mirevale · `mirevale.archivist` | reachZone mire_route; catchSpecies 3 | 600 · potion 3, crest_orb 3 |
| `q02_thin_hedgerow` | 1 | mire_route · `mire_route.forager` | catchSpecific seedrift; catchSpecific snapling (night) | 900 · verdant_orb 2, superpotion 2 |
| `q03_ember_yard` | 1 | cinderhold · `cinderhold.yardmaster` | defeatTrainer `ash_route.kindler`; catchSpecific fennorange; earnBadge ember | 1400 · ember_orb 3, revive 1 |
| `q04_drowned_harbour` | 1 | saltmourn · `saltmourn.harbourmaster` | catchSpecific wraithtide; winBattles wild 10 | 2500 · tide_orb 3, phantom_orb 2 · flag `harbour_witness` |
| `q05_static_at_midnight` | 1 | stormrook · `stormrook.linekeeper` | catchSpecific darkone; catchSpecific ampmite; earnBadge circuit | 2200 · dusk_orb 3, hyper_potion 2 |
| `q06_the_deep_cut` | 2 | marrowdig · `marrowdig.foreman` | reachZone deepcut_route; catchSpecific yahit; catchSpecies 30 | 3000 · prism_orb 3, rarecandy 1 |
| `q07_lens_and_latch` | 2 | vesperveil · `vesperveil.medium` | reachZone umbral_observatory; catchSpecific miscarmen; catchSpecies 45 | 4000 · phantom_orb 3, full_heal 3 |
| `q08_anvil_debt` | 2 | forgewall · `forgewall.quartermaster` | deliverItem full_heal 3 → `forgewall.quartermaster`; catchSpecific acier; earnBadge anvil | 5000 · mythos_orb 1, prism_orb 3 |
| `q09_thin_air` | 2 | skyrend · `skyrend.shrinekeeper` | catchSpecific serpyre; catchSpecies 60; earnBadge ascend | 6000 · mythos_orb 2, rarecandy 2 |
| `q10_restore_the_grove` | 3 | mirevale · `mirevale.archivist` | flag `act3_started` (bible); restoreZone mire_route; catchSpecies 80 | 8000 · aether_orb 1 · flag `grove_restored` |
| `q11_first_night` | 3 | eclipse_shrine · `null` | flag `champion:zeon:beaten`; catchSpecies 100; winBattles pvp 5 | 10000 · **creature noxmyth L60** · flag `mythical_night` |
| `q12_first_morning` | 3 | celestial_spire · `null` | flag `mythical_night`; catchSpecies 120; winBattles any 20 | 15000 · **creature lumyth L60** · flag `mythical_morning` |
| `q13_unaligned_pup` | 1 | mirevale · `mirevale.gardener` | requires q01; winBattles any 3; catchSpecies 5 | 500 · **creature elemutt L5** |
| `q14_harmonic_cycle` | 3 | saltmourn · `null` | flag `champion:zeon:beaten`; the four relic shrine guardians beaten (saltmourn, marrowdig, cinderhold, skyrend) | 20000 · spirit_water_vial 1 |

`catchSpecies` counts distinct species in the Dex (`markCaught`), so `q12`'s 120 of the 128 non-mythical species is the Dex-as-win-condition made mechanical: `lumyth` is the last memory you are handed, not the first you find.

### 12.2 Seasonal events (4) — shape `SeasonalEvent`

Windows are equinox/solstice anchored, 14 days each, in the first live year; the reconciler shifts the year, never the dates. `alphaBonus`/`variantBonus` add to `0.02`/`0.03`; `featuredSpecies` get the spine's fixed `+0.025 variant / +0.01 alpha`.

| id | name | startsAt → endsAt (UTC) | featuredZones | featuredSpecies | alpha / variant bonus |
|---|---|---|---|---|---|
| `verdant_bloom` | Verdant Bloom | 2027-03-20T00:00:00Z → 2027-04-03T00:00:00Z | mire_route, solenne | bloomsprite, seedrift, bramblecub, resilian, snapling | 0.008 / 0.04 |
| `tideglass_festival` | Tideglass Festival | 2027-06-21T00:00:00Z → 2027-07-05T00:00:00Z | tide_route, saltmourn | kygra, ripshell, glimfin, shiveruff, wraithtide | 0.012 / 0.028 |
| `starfall_surge` | Starfall Surge | 2027-09-22T00:00:00Z → 2027-10-06T00:00:00Z | galvan_route, celestial_spire | raidori, flowbot, alloylark, stormchick, gustuff | 0.018 / 0.03 |
| `long_night` | The Long Night | 2027-12-21T00:00:00Z → 2028-01-04T00:00:00Z | hollow_route, umbral_observatory, the_rift | darkone, malice, rimeidol, umbrit, miscarmen | 0.015 / 0.035 |

### 12.3 Daily swarms (7) — shape `DailySwarm`, index = `Date#getUTCDay()` (0 = Sunday)

`weightBoost` multiplies the listed species' slot weights in that zone for the UTC day (RC-12: species ⊆ the zone's table).

| weekday | day | zoneId | species | weightBoost |
|---|---|---|---|---|
| 0 | Sunday | mire_route | mossling, seedrift, resilian | 3 |
| 1 | Monday | ash_route | flampling, fennorange, wickling | 3 |
| 2 | Tuesday | tide_route | shiveruff, brookrawl, ripshell | 3 |
| 3 | Wednesday | galvan_route | ampmite, gustuff, darkone | 3 |
| 4 | Thursday | deepcut_route | pebblit, rimeidol, yahit | 3 |
| 5 | Friday | hollow_route | nettlewisp, hexroach, wraithtide | 3 |
| 6 | Saturday | siege_route | grubolt, coldplate, acier | 3 |

With boost 3 a Friday `wraithtide` is `6/73` of night rolls in hollow_route (mean wait 2.8 min) instead of `2/69` (8.1 min).

### 12.4 Raid hotspots (8) — shape `RaidHotspot`, one per route

Boss level sits above the route band so the raid is the zone's ceiling; `hpMultiplier` scales `calcMaxHp`; `minBadges` equals the route's index in badge order; windows are 30-minute UTC slots staggered one hour apart so a player can chase two in an evening. The catch window at phase 4 is the direct path for four finals (`thornback, moblaze, prismolith, pyrothal`) and for four singles that are also wild.

| id | zoneId | x | z | boss | level | hpMultiplier | minBadges | window | minutes |
|---|---|---|---|---|---|---|---|---|---|
| `raid_mire_thornback` | mire_route | 60 | -40 | thornback | 18 | 6 | 0 | 17:00 | 30 |
| `raid_ash_moblaze` | ash_route | -72 | 36 | moblaze | 26 | 8 | 1 | 18:00 | 30 |
| `raid_tide_kygra` | tide_route | 88 | 64 | kygra | 30 | 10 | 2 | 19:00 | 30 |
| `raid_galvan_raidori` | galvan_route | -40 | -90 | raidori | 34 | 12 | 3 | 20:00 | 30 |
| `raid_deepcut_prismolith` | deepcut_route | 30 | 100 | prismolith | 40 | 14 | 4 | 21:00 | 30 |
| `raid_hollow_wraithtide` | hollow_route | -96 | -20 | wraithtide | 44 | 16 | 5 | 22:00 | 30 |
| `raid_siege_acier` | siege_route | 70 | -70 | acier | 48 | 18 | 6 | 23:00 | 30 |
| `raid_ascent_pyrothal` | ascent_route | 0 | 104 | pyrothal | 56 | 20 | 7 | 0:00 | 30 |

---

## 13. SPAWN BUDGET

The cost of this roster is server rows and AOI traffic, not frame time. Numbers from `30-server-netcode.md` §30.2 (32 m cells, 3×3 view) and §30.3.

| | route | town (3 with tables) | story | total, one shard each |
|---|---|---|---|---|
| Concurrent spawns (`targetCount`) | 80 | 20 | 36 | 8×80 + 3×20 + 4×36 = **844** <!-- amended 2026-10-08: was 14 / 4 / 6 = 148 --> |
| Spawn rows a client can see (≤ 3×3 of a 240/160/200 m field; a 96 m view of a 240 m route holds ≈ 16 %) | ≈ 13, ≤ 80 | ≤ 20 | ≤ 36 | — |
| Spawn cadence when below target | 1 per 1.5–3.5 s | 1 per 2–5 s | 1 per 2–5 s | — |
| `SpawnState` bytes per row (schema, ≈) | 64 | 64 | 64 | 54 KB resident for all 15 tables |
| Rng draws per spawn | 2 + 1 alpha + 1–2 variant + ≤ 8 position | same | same | ≤ 13 |
| Distinct species per table (sprite atlas bind cost, `10-render.md`) | 8–13 | 5–6 | 8–11 | max **13** (hollow_route) |

Hard ceilings: no table exceeds **16 slots** or **14 distinct species** (the per-zone sprite atlas in `PLAN.md`'s pipeline is sized for 16); no zone exceeds `targetCount 80` (amended 2026-10-08: was 14; at 14 a route held about 0.1 creatures in the 20 × 17 m diorama view, and a 180 s lifetime against a 14 s mean respawn capped it near 13 anyway). `validate.ts` fails a table at 17 slots or 15 species.

---

## 14. NON-NEGOTIABLES

1. **130/130 at build, by closure, from the tables in this file.** Spine rule 7 plus RC-1 … RC-13 run in `validate.ts`; Appendix A is the same check run against this document. A change to any row that breaks either fails the build.
2. **Every root spawns wild; no family needs a trade, a stone or a second account.** Registration starters included.
3. **Legendaries appear exactly once each and only in `LEGENDARY_STATICS`.** No legendary in a table, swarm or raid pool. Gym-team legendaries (`glacinid` in Sylvane's team) are NPC-owned and do not count.
4. **Ghost and Dark are night-only, everywhere, with no exceptions**, including the four story tables.
5. **Bands are the spine's badge order.** No slot in a zone spawns above `BAND.max`; `sanitize`/clamp code in the server never raises a level to compensate.
6. **Finals do not spawn wild** except `aonred`/`darkyon`. A raid catch window is the only other direct path to a final, and only for the four bosses in §12.4.
7. **All keys are `ZoneId`s.** A quest, event, swarm or hotspot naming a non-`ZoneId` is a type error, not a runtime miss.
8. **Weights are the probability model.** No hidden rarity multiplier, no "rare tier ×0.5" elsewhere in server code; `ALPHA_CHANCE`, `VARIANT_CHANCE`, swarm `weightBoost` and event bonuses are the only modifiers, exactly as §30.3 lists them.

---

## 15. CUT DELIBERATELY

- **Evolution stones and trade evolutions.** Legacy has none; adding an item gate would make a family depend on shop stock or another player. Reserved kind stays at zero entries.
- **Roaming legendaries.** Legacy `noxmyth` roamed on a separate flag (`roam_noxmyth`) and the comments in `world.js` record the deadlock that caused. Legendaries are stationary statics with one flag each.
- **Town tables beyond the three the netcode names.** A pond in `mirevale` or a graveyard in `vesperveil` reads well, but a town is the social hub; every extra table is a `SpawnDirector`, AOI rows in the zone where players idle and trade, and wild engagements inside the healer's sightline. The three that exist (`saltmourn`, `skyrend`, `solenne`) are where the roster needs them (§11).
- **Fishing, headbutt, cave-only or weather-only slots.** One `timeOfDay` axis and (with A2) one `medium` axis. Each extra axis multiplies the RC-10 emptiness checks and the sprite atlas per zone.
- **Hidden-ability or IV systems.** The one ability split is data the roster already has; nothing new is introduced to make `darkyon` "special".
- **Level scaling of wild spawns to the player.** Bands are the world's; a level-58 `glimp` never exists.
- **Legacy `epic` rarity.** The 13 legacy `epic` species take `rarity: 'rare'` in `SpeciesDef` (the spine's `Rarity` has no `epic`); the encounter `tier` is independent of `rarity`, so nothing is lost.
- **Guaranteed-catch statics.** No `aether_orb` handout before a legendary; `catchRate 2–3` with the spine's single curve is the design.

---

## 16. OPEN QUESTIONS

1. **A1** (story tables) must be accepted for §6.12–6.15 to export; without it `darkyon`, `aonred` and `devourest` move to `hollow_route` (`night rare`, L28–30 — below RC-5 for `devourest @30+2`, so `devourest` would fall back to evolution only) and the 55–60 band disappears from the game.
2. **A2** (`medium`) — accept, or drop the column at transcription. Coverage is identical either way.
3. **A3** (wild ability roll) — a one-line netcode change; recommended.
4. `galaxion`'s gate is `badge:anvil` until `story-bible.md` names the Act II flag that replaces legacy `hq_done`.
5. Quest givers `<zone>.<role>` and trainers `ash_route.kindler` are ids the bible / zone authoring must create, or `giver` becomes `null`.
6. Seasonal event dates assume a 2027 live year; shift the year, keep the dates.
7. `RosterReport.directlyPlaced` is 79 for this file; the assert is on `obtainable === 130` and `unobtainable.length === 0`, not on 79, so rows may be added freely.

---

## APPENDIX A — the check (`roster-check.cjs`; becomes `packages/content/src/validate.ts` rule 7 + RC-1 … RC-13)

Run: `node roster-check.cjs <legacy ewamon.js copied as .cjs> .design/roster-coverage.md [--matrix]`. The repo root is `"type": "module"`, so the legacy CommonJS file must be loaded through a `.cjs` name. Exit code 1 lists every failed rule; `--matrix` prints one line per family with its root's zones. The output for this file, verbatim:

```
species 130 · roots 67 · stages {"base":49,"final":50,"mid":13,"single":18} · legendary 8 · mythical 2
tables 15 · slots 152 · direct |E| 79 · closure |R| 130 · unobtainable 0
statics 8 · swarms 7 · raids 8
OK — 130/130 obtainable, 67/67 families completable (68 terminal branches incl. the darkone split)
```

```js
// roster-check.cjs — checks .design/roster-coverage.md against the legacy species data.
// usage: node roster-check.cjs <legacy ewamon.js copied as .cjs> <roster-coverage.md> [--matrix]
// The slot tables in the .md ARE the data: every row shaped
//   | zoneId | species | weight | levelMin | levelMax | time | tier | medium |
// is parsed. Statics, swarms and raids are parsed from their own tables (§7, §12).
'use strict';
const fs = require('fs');
const [, , legacyPath, mdPath, ...flags] = process.argv;
const { EWAMON_SPECIES: S } = require(require('path').resolve(legacyPath));
const md = fs.readFileSync(mdPath, 'utf8').split('\n');
const IDS = Object.keys(S);

const parentOf = {};
for (const id of IDS) {
  const s = S[id];
  if (s.evolvesInto) parentOf[s.evolvesInto] = id;
  if (s.splitEvolvesInto) for (const b of s.splitEvolvesInto) parentOf[b.into] = id;
}
const childrenOf = (id) => [S[id].evolvesInto, ...(S[id].splitEvolvesInto || []).map((b) => b.into)].filter(Boolean);
const roots = IDS.filter((id) => !parentOf[id]);
const LEGENDARY = IDS.filter((id) => S[id].rarity === 'legendary');
const MYTHICAL = IDS.filter((id) => S[id].rarity === 'mythical');
const stageOf = (id) => { const c = childrenOf(id).length > 0, p = !!parentOf[id]; return !p && !c ? 'single' : !p ? 'base' : c ? 'mid' : 'final'; };
const nocturnal = (id) => S[id].type.includes('Ghost') || S[id].type.includes('Dark');

const STORY = ['eclipse_shrine', 'umbral_observatory', 'celestial_spire', 'the_rift'];
const kindOf = (z) => (z.endsWith('_route') ? 'route' : STORY.includes(z) ? 'story' : 'town');
const BAND = {
  mire_route: [2, 6], ash_route: [7, 11], tide_route: [11, 15], galvan_route: [15, 20], deepcut_route: [20, 25],
  hollow_route: [25, 30], siege_route: [30, 35], ascent_route: [35, 42], saltmourn: [14, 24], skyrend: [38, 44],
  solenne: [40, 45], eclipse_shrine: [45, 50], umbral_observatory: [42, 48], celestial_spire: [50, 55], the_rift: [55, 60],
};
const TIER_WEIGHT = { common: [6, 9], uncommon: [5, 5], rare: [2, 4], alpha: [1, 1] };
const HALF = { route: 119, town: 79, story: 99 };

const SLOT = /^\| ([a-z_]+) \| ([a-z]+) \| (\d+) \| (\d+) \| (\d+) \| (any|day|night) \| (common|uncommon|rare|alpha) \| (land|water) \|$/;
const STATIC = /^\| ([a-z]+) \| (\d+) \| ([a-z_]+) \| (-?\d+) \| (-?\d+) \| `([a-z_]+)` \| `((?:badge|flag):[a-z_:]+)` \|/;
const SWARM = /^\| ([0-6]) \| [A-Za-z]+ \| ([a-z_]+) \| ([a-z, ]+) \| (\d+(?:\.\d+)?) \|$/;
const RAID = /^\| `([a-z_]+)` \| ([a-z_]+) \| (-?\d+) \| (-?\d+) \| ([a-z]+) \| (\d+) \| (\d+(?:\.\d+)?) \| (\d) \| (\d+):00 \| (\d+) \|$/;
const T = {}; const statics = []; const swarms = []; const raids = [];
for (const line of md) {
  let m;
  if ((m = SLOT.exec(line))) (T[m[1]] ||= []).push({ species: m[2], weight: +m[3], levelMin: +m[4], levelMax: +m[5], time: m[6], tier: m[7], medium: m[8] });
  else if ((m = STATIC.exec(line))) statics.push({ species: m[1], level: +m[2], zoneId: m[3], x: +m[4], z: +m[5], flag: m[6], when: m[7] });
  else if ((m = SWARM.exec(line))) swarms.push({ weekday: +m[1], zoneId: m[2], species: m[3].split(',').map((s) => s.trim()), boost: +m[4] });
  else if ((m = RAID.exec(line))) raids.push({ id: m[1], zoneId: m[2], x: +m[3], z: +m[4], boss: m[5], level: +m[6], hp: +m[7], minBadges: +m[8], utcHour: +m[9], minutes: +m[10] });
}

const fail = []; const E = new Set(); const sums = {};
for (const [zone, slots] of Object.entries(T)) {
  const band = BAND[zone]; if (!band) { fail.push(`${zone}: no band defined`); continue; }
  const [lo, hi] = band; const kind = kindOf(zone);
  let alpha = 0, any = 0, dayOK = 0, nightOK = 0, daySum = 0, nightSum = 0; const seen = new Set();
  for (const s of slots) {
    const sp = s.species;
    if (!S[sp]) { fail.push(`${zone}: unknown species ${sp}`); continue; }
    E.add(sp); const st = stageOf(sp);
    if (LEGENDARY.includes(sp) || MYTHICAL.includes(sp)) fail.push(`${zone}: legendary/mythical ${sp} in a table (RC-4)`);
    if (st === 'final' && sp !== 'aonred' && sp !== 'darkyon') fail.push(`${zone}: final form ${sp} spawns wild (RC-6)`);
    if (st === 'mid' && s.levelMin < S[parentOf[sp]].evolvesAt + 2) fail.push(`${zone}: mid ${sp} levelMin ${s.levelMin} < evolvesAt+2 (RC-5)`);
    if (nocturnal(sp) && s.time !== 'night') fail.push(`${zone}: Ghost/Dark ${sp} not night (RC-7)`);
    if (kind === 'story' && st === 'base' && S[sp].evolvesAt > lo) fail.push(`${zone}: story-zone base ${sp} evolvesAt ${S[sp].evolvesAt} > band min ${lo} (RC-9)`);
    if (s.levelMin > s.levelMax) fail.push(`${zone}: ${sp} levelMin > levelMax`);
    if (s.levelMin < lo || s.levelMax > hi) fail.push(`${zone}: ${sp} [${s.levelMin},${s.levelMax}] outside band [${lo},${hi}] (RC-2)`);
    const [wl, wh] = TIER_WEIGHT[s.tier];
    if (s.weight < wl || s.weight > wh) fail.push(`${zone}: ${sp} ${s.tier} weight ${s.weight} not in [${wl},${wh}] (RC-3)`);
    if (s.tier === 'alpha') { alpha++; if (s.levelMin !== hi || s.levelMax !== hi) fail.push(`${zone}: alpha slot must be [${hi},${hi}] (RC-8)`); }
    if (s.time === 'any') any++;
    if (s.time !== 'night') { dayOK++; daySum += s.weight; }
    if (s.time !== 'day') { nightOK++; nightSum += s.weight; }
    const k = `${sp}|${s.time}|${s.tier}`; if (seen.has(k)) fail.push(`${zone}: duplicate slot ${k} (RC-11)`); seen.add(k);
  }
  if (kind === 'route' && alpha !== 1) fail.push(`${zone}: route needs exactly one alpha slot, has ${alpha} (RC-8)`);
  if (kind !== 'route' && alpha !== 0) fail.push(`${zone}: only routes carry alpha slots (RC-8)`);
  if (any < 3) fail.push(`${zone}: fewer than 3 'any' slots (RC-10)`);
  if (dayOK < 4 || nightOK < 4) fail.push(`${zone}: needs >= 4 day-eligible and >= 4 night-eligible slots (day ${dayOK}, night ${nightOK}) (RC-10)`);
  if (slots.length > 16 || new Set(slots.map((s) => s.species)).size > 14) fail.push(`${zone}: over budget (§13)`);
  sums[zone] = { slots: slots.length, daySum, nightSum };
}
for (const z of Object.keys(BAND)) if (!T[z]) fail.push(`missing table for ${z}`);
for (const sw of swarms) { const zs = new Set((T[sw.zoneId] || []).map((s) => s.species)); for (const sp of sw.species) if (!zs.has(sp)) fail.push(`swarm ${sw.zoneId}: ${sp} not in that zone's table (RC-12)`); }
if (new Set(swarms.map((s) => s.weekday)).size !== 7) fail.push(`swarms: need weekday 0..6 exactly once (have ${swarms.length})`);
for (const r of raids) { if (!S[r.boss]) fail.push(`raid ${r.id}: unknown boss ${r.boss}`); else E.add(r.boss); const h = HALF[kindOf(r.zoneId)]; if (Math.abs(r.x) > h || Math.abs(r.z) > h) fail.push(`raid ${r.id}: (${r.x},${r.z}) outside ±${h} (RC-13)`); }
if (raids.length !== 8) fail.push(`raids: expected 8, parsed ${raids.length}`);
for (const l of statics) { if (!LEGENDARY.includes(l.species)) fail.push(`static ${l.species} is not a legendary (RC-4)`); const h = HALF[kindOf(l.zoneId)]; if (Math.abs(l.x) > h || Math.abs(l.z) > h) fail.push(`static ${l.species}: (${l.x},${l.z}) outside ±${h} (RC-13)`); }
if (new Set(statics.map((l) => l.species)).size !== 8) fail.push(`LEGENDARY_STATICS must be exactly the 8 legendaries (parsed ${statics.length})`);

const R = new Set(E);
for (let grew = true; grew;) { grew = false; for (const id of [...R]) for (const c of childrenOf(id)) if (!R.has(c)) { R.add(c); grew = true; } }
for (const l of statics) R.add(l.species);
for (const m of MYTHICAL) R.add(m); // q11 / q12 rewards.creature (§7)
const unobtainable = IDS.filter((id) => !R.has(id));
if (unobtainable.length) fail.push(`unobtainable: ${unobtainable.join(', ')}`);
for (const r of roots) if (!LEGENDARY.includes(r) && !MYTHICAL.includes(r) && !E.has(r)) fail.push(`root ${r} never spawns (RC-1)`);

const stages = IDS.reduce((a, id) => ((a[stageOf(id)] = (a[stageOf(id)] || 0) + 1), a), {});
console.log(`species ${IDS.length} · roots ${roots.length} · stages ${JSON.stringify(stages)} · legendary ${LEGENDARY.length} · mythical ${MYTHICAL.length}`);
console.log(`tables ${Object.keys(T).length} · slots ${Object.values(T).reduce((n, s) => n + s.length, 0)} · direct |E| ${E.size} · closure |R| ${R.size} · unobtainable ${unobtainable.length}`);
console.log(`statics ${statics.length} · swarms ${swarms.length} · raids ${raids.length}`);
if (flags.includes('--sums')) for (const [z, v] of Object.entries(sums)) console.log(`  ${z.padEnd(19)} slots ${String(v.slots).padStart(2)}  daySum ${String(v.daySum).padStart(2)}  nightSum ${String(v.nightSum).padStart(2)}`);
if (flags.includes('--matrix')) for (const root of roots) {
  const chain = []; let cur = root;
  while (cur) { chain.push(cur); const c = childrenOf(cur); if (c.length === 2) { chain.push(c.join('/')); break; } cur = c[0]; }
  const where = Object.entries(T).filter(([, s]) => s.some((x) => x.species === root)).map(([z]) => z);
  console.log(`${chain.join(' → ')} :: ${where.join(', ') || (statics.find((l) => l.species === root) ? 'static' : 'quest')}`);
}
if (fail.length) { console.error(`\nFAIL (${fail.length})`); for (const f of fail) console.error(' - ' + f); process.exit(1); }
console.log('OK — 130/130 obtainable, 67/67 families completable (68 terminal branches incl. the darkone split)');
```
