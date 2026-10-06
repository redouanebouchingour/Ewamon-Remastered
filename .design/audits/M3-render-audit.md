# M3 render audit

**Date:** 2026-10-06 (first pass); all 126 shots and all 21 budgets re-run the same day, 16:14–17:41 UTC.
**Revision:** the current shots and budget JSON (`.screenshots/audit/M3/`, `.screenshots/budget/M3/`) are from `main` at `ba1a91e`. That revision includes the town arrival point (`0e28b50`), the fixed light layout (`ffe5d48`) and Handover II (`ba1a91e`). The two later commits (`e73fa65`, `2fc4157`) change only audio and docs; render, client, content and harness code are identical through `2fc4157`. The first pass was `main` at `e58c8ab` plus the Phase E1/E2 tail (committed in `5611ede`). Its findings text is kept below where the re-shoot did not change it.
**Author:** the Phase E1/E2 render agent. §50.6 asks for a reviewer who did not implement render, so this file is a findings record written in the hostile-audit format. A second, independent pass is still owed before M3's "audit written and answered" box can be ticked (see M3-all-1).
**Protocol:** `.design/SPEC.md` §50.6 as amended 2026-10-06. Every zone takes all six rows, with recorded fallback anchors (§50.6.1). The nine attack lines are applied per zone, not per shot. Shots where a line has nothing to report are not repeated. The §50.2.2 caps are as amended 2026-09-25 / 2026-09-30.
**Bar:** the user's decision for Phase E: "All towns as good as Mirevale."

## Machine note

- Captures ran on the dev laptop: i7-13620H, Windows 11, headless Chrome 154 on WebGPU, Intel UHD (Gen-12LP) iGPU, 1440×900 at dpr 1.
- Budget runs used `--set M3 --frames 20 --warmup 10 --no-diff --budget-ms 0`. These are counts only; the milliseconds are iGPU numbers and are not judged.
- Shot runs used `--set M3 --settle 45`.
- **Re-run (current files):** one harness bundle, built 16:14 UTC from `ba1a91e` into a private `EWA_HARNESS_BUILD_DIR`, served all 126 shots and all 21 budgets. The zones ran one after another, shots then budget per zone. All 42 runs completed on the first attempt; none died from GPU contention.
- The first pass used two bundles:
  - **Rebuilt 12:10 UTC, after the other session's texture-residency and atlas merge:** all 21 budgets, the shots of cinderhold, ash_route, marrowdig, deepcut_route, solenne, celestial_spire and the_rift, and the M2 re-shoot (§5).
  - **Built 09:26 UTC:** the shots of the other zones.

  Two first-pass harness runs died at 12:31–13:03 when another session's Playwright Chrome shared the GPU. The re-run supersedes all of them. §5 (M2) was not re-shot.

## 1. The re-measure (E1.1): what the old note got right

The 2026-09-25 smoke said "towns other than Mirevale show no buildings from their spawn point." At the first pass it was still true, and commit `33a852e` (content zone plan) had not changed it. §1.1 records the change since then. The cause is content's spawn, not missing buildings:

- **Every town but Mirevale spawns at (−50, 0)**, on the west road 14 m inside the 64 m walkable edge and 50 m from its plaza. Its nearest house is 22–29 m away.
- The diorama frame at the default stop is ≈ ±10 m wide at the focus, and its top edge meets the ground ≈ 10 m past the focus. So from (−50, 0) no building, plaza or set-piece can be in frame.
- Mirevale spawns on its plaza at (0, 6). Routes spawn on their road at (−92, 0).

Sandbox smoke from spawn (heading 0, zoom 1, 10:00; scratchpad `phaseE/smoke.mjs`):

- Before: scratchpad `phaseE/before/<zone>.png`. The re-landed lighting already applies from `cinderhold` on, because it landed during the run.
- After: `phaseE/after/<zone>.png`. This run predates the cinder / marrow bush removal.
- Counts are in render IMPLEMENTATION-NOTES "Phase E1–E2".

| | Before | After (dressing pass) |
|---|---|---|
| Towns ≠ Mirevale, spawn view | A stone road through ≈ 15 sparse tufts on bare ground; nothing else in frame | Verge clusters along both road edges (bushes in salt / storm / forge / vesper, tufts, stones), rock clusters, scree; boundary wall / fence / dyke with gate piers when the frame reaches the edge |
| Routes, spawn view | Road + tufts; the margin forest at the frame's edge in green biomes | The same with verge clusters and rock clusters; galvan / tide / ascent noticeably fuller |
| Barren / story zones | An empty floor | Banded scree everywhere; glowing crystal-shard clusters in shrine / rift |
| Spawn-view triangles | 252k–841k | 455k–882k (cap 2.5 M) |
| Spawn-view beauty draws | 55–100 | 57–119 (cap 400) |

**Verdict on E1:** every zone is visibly denser than before, and no zone breaks a count cap. **No town other than Mirevale reads as rich as Mirevale from its spawn** (M3-all-2). Mirevale's richness at its spawn is its plaza (heart tree, stalls, benches, lanterns), and every other town's spawn is 50 m from its plaza. Render may add only walk-through cover there, because content owns every solid and the server's heightfield is stamped from it. *(First-pass verdict. §1.1 records the re-shoot from the plaza arrival point.)*

### 1.1 The spawn shot from the town arrival point (re-shoot, `ba1a91e`)

Since `0e28b50`, the `spawn-noon` anchor in the eight towns other than Mirevale is content's `arrivalPoint`. That is the first usable point on a ring `plaza.r − 3` m round the plaza centre, tried from due south in ±30° steps. Fast travel, the escape rope and fallback joins land there too. `ZoneDef.spawn` is unchanged. Mirevale keeps its spawn (0, 6).

| Town | Anchor | Rule (sidecar `anchor.rule`) |
|---|---|---|
| cinderhold, saltmourn, vesperveil, forgewall, skyrend, solenne | (5.5, 9.5) | plaza ring 30° |
| stormrook, marrowdig | (0, 11) | plaza ring 0° |

**Removed:** the stale first-pass files `spawn-noon--50_0*` (cinderhold, stormrook, marrowdig, vesperveil, forgewall, skyrend), `spawn-noon--50_-6*` (saltmourn) and `spawn-noon--50_0.5*` (solenne), both the sidecars and the PNGs. The other five rows keep their stems in every town; their fallback anchors still derive from `ZoneDef.spawn`.

**Framing.** The table's heading 0 ("+z forward", rig heading 2) looks away from the plaza centre. So in every town the set-piece stands between the camera and the player: it sits in the near foreground at the bottom-right, and the DOF softens it. Mirevale's own row frames its heart-tree crown the same way. M3-all-11 covers what a player actually sees on arrival.

**What each frame shows** (`<town>/spawn-noon-<x>_<z>-full.png`). Draws are from the full variant's sidecar. Luma is p1 / p50 / p99 of the reduced variant, with the top 80 px (HUD) excluded:

| Town | In frame | House in frame | Draws (first pass → now) | Luma | Against Mirevale |
|---|---|---|---|---|---|
| `mirevale` (the bar, `spawn-noon-0_6`) | stall, crate, bench, the child NPC, flower beds, a lush verge; the heart-tree crown blurred over the right half | none | 383 (unchanged) | 48 / 120 / 156 | — |
| `cinderhold` | two dark-timber stalls, barrel, bench, a lit brazier, a dead tree with a long shadow; the lava-basin set-piece with its block kerb (bottom right, glowing) | a brick corner at the top-left edge | 174 → 264 | 42 / 84 / 227 | About as dense. Darker overall (p50 84). Green tufts on the ash (M3-all-3). |
| `saltmourn` | one canvas stall, barrel, planter, bench, one lamp post on the salt road; the lighthouse is a white sliver at the right edge | none | 238 → 309 | 72 / 136 / 215 | **Below the bar.** The thinnest frame of the eight. Green tufts on the white sand fill the left third (M3-saltmourn-1). |
| `stormrook` | verdigris-roofed stall, crate, planter, the child NPC, three lantern posts; the dome set-piece blurred in the bottom-right corner | none | 181 → 307 | 58 / 102 / 204 | Close to the bar. Plaza and ground are the same flagstone (M3-stormrook-1). |
| `marrowdig` | stall, crate, bench, four lamp posts; the ore-cart set-piece on its rails with lamp crates | a brick-and-timber corner with crates, top left | 199 → 277 | 56 / 148 / 207 | As dense. Green tufts on the canyon dust (M3-marrowdig-1). |
| `vesperveil` | thatched stall, planter, barrel, bench, two candle lamps, the lantern-maker NPC, a willow bush; the lantern pavilion clipped at the right edge | none | 201 → 272 | 40 / 99 / 177 | Close to the bar. M3-vesperveil-2: the NPC's nameplate overlaps the HUD badge. |
| `forgewall` | two heraldic-banner stalls, barrel, planter, bench, two braziers, boulders, a pine (blurred, foreground left); the stepped bastion set-piece fills the bottom right, blurred | a stone corner at the top left | 202 → 289 | 37 / 102 / 164 | As dense. |
| `skyrend` | two prayer-flag stalls, crate, planter, bench, three brass lamps, snow boulders; the teal-roofed shrine set-piece bottom right, blurred | a corner at the top left | 211 → 305 | 67 / 210 / 221 | As dense, but it does not read as well. Snow and pale paving merge (p50 210). The flags read as rainbow planks (M3-skyrend-2), and the tufts are green on snow (M3-skyrend-1). |
| `solenne` | the league hall's façade (stained glass, slate roof) fills the right half, blurred; bench, planter, two lamp posts, a crate, star-flower beds on the lawn | the league hall | 246 → 337 | 79 / 172 / 211 | Close to the bar. It has the strongest building, but fewer small props: no stall and no NPC. |

**Verdict (re-shoot; author's judgement, not reviewed).**

The arrival point removes M3-all-2's cause. Every town now opens on its plaza with Mirevale's plaza kit (stall, crate or barrel, planter, bench, lamps) in its own biome skin, and with its set-piece in frame. On density, every town but saltmourn is now close to the bar:

- **Comparable to Mirevale:** cinderhold, marrowdig and forgewall.
- **Close:** stormrook, vesperveil, skyrend and solenne.
- **Below:** saltmourn.

**No town clearly exceeds Mirevale's frame.** The remaining gap is not missing solids. It is three other things:
- green grass tufts on non-grass ground in four towns: ash, sand, dust and snow (M3-all-3);
- skyrend's flat white read;
- saltmourn's sparse plaza side.

**M3-all-2's check** (≥ 1 building and ≥ 6 hand-placed props in the spawn-noon frame):
- **Passes:** cinderhold, marrowdig, forgewall, skyrend (each with a house corner at the frame edge) and solenne (the hall; 6 props only when the flower beds count).
- **Fails on the building half:** saltmourn, stormrook and vesperveil.
- **Mirevale's own frame fails the building half too:** no house is in it. The check as written asks for something the bar does not show. The reviewer should decide whether it stands.

## 2. Budget honesty (line 9, all 21 zones)

From `.screenshots/budget/M3/<zone>.json`, as re-run on `ba1a91e`. Each cell is the worst value over the six shots. Beauty = draws − shadow-map draws, and triangles are the per-shot `countsMax`.

**Against the first pass,** every worst-case count is unchanged except:
- textures: ±1 MB;
- programs moved by 2–4 in seven zones:
  - up: stormrook 107 → 111, forgewall 109 → 111, galvan_route / siege_route / ascent_route 107 → 109;
  - down: saltmourn 107 → 105, marrowdig 103 → 101.
- solenne's plaza `spawn-noon` now ties its `lamps-night` as the worst beauty shot, at 125 (the first-pass road shot was 92).

The eight town `spawn-noon` rows rose from road to plaza: their beauty draws are 98–125. Solenne's 125 equals its zone worst. Every other count stays below that zone's battle row. The fixed light layout (`ffe5d48`) leaves the light counts as they were. The GPU milliseconds are iGPU numbers and, as before, are not judged.

| Zone | shots | beauty draws (worst shot) | shadow draws | triangles | textures | materials | lights | RT | programs | GPU median ms (worst) | violations |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `mirevale` | 6 | 186 (battle) | 496 | 1.24 M (battle) | 456 MB | 18 | 3 + 17 | 36 | 111 (sprite-edge) | 83 (link-east) | 0 |
| `mire_route` | 6 | 119 (battle) | 206 | 1.44 M (battle) | 520 MB | 14 | 3 + 9 | 36 | 111 (sprite-edge) | 51 (lamps-night) | 0 |
| `cinderhold` | 6 | 129 (battle) | 229 | 1.08 M (battle) | 475 MB | 18 | 2 + 18 | 35 | 105 (sprite-edge) | 58 (lamps-night) | 0 |
| `ash_route` | 6 | 113 (battle) | 134 | 0.87 M (battle) | 524 MB | 11 | 2 + 9 | 35 | 103 (sprite-edge) | 34 (spawn-noon) | 0 |
| `saltmourn` | 6 | 149 (battle) | 298 | 1.06 M (battle) | 540 MB | 18 | 3 + 16 | 36 | 105 (sprite-edge) | 55 (sprite-edge) | 0 |
| `tide_route` | 6 | 125 (battle) | 161 | 0.72 M (battle) | 567 MB | 11 | 2 + 8 | 35 | 105 (sprite-edge) | 40 (spawn-noon) | 0 |
| `stormrook` | 6 | 125 (battle) | 235 | 1.03 M (battle) | 484 MB | 18 | 2 + 18 | 35 | 111 (sprite-edge) | 57 (spawn-noon) | 0 |
| `galvan_route` | 6 | 118 (battle) | 147 | 1.00 M (battle) | 625 MB | 12 | 2 + 9 | 35 | 109 (sprite-edge) | 58 (spawn-noon) | 0 |
| `marrowdig` | 6 | 140 (battle) | 261 | 1.12 M (battle) | 444 MB | 15 | 3 + 20 | 36 | 101 (sprite-edge) | 60 (gym-dusk) | 0 |
| `deepcut_route` | 6 | 112 (battle) | 142 | 0.82 M (battle) | 563 MB | 8 | 2 + 8 | 35 | 101 (sprite-edge) | 48 (battle) | 0 |
| `vesperveil` | 6 | 130 (battle) | 253 | 0.99 M (battle) | 479 MB | 17 | 2 + 20 | 35 | 107 (sprite-edge) | 70 (lamps-night) | 0 |
| `hollow_route` | 6 | 112 (battle) | 163 | 1.27 M (battle) | 594 MB | 10 | 2 + 10 | 35 | 107 (sprite-edge) | 69 (spawn-noon) | 0 |
| `forgewall` | 6 | 126 (battle) | 274 | 0.97 M (battle) | 550 MB | 19 | 2 + 19 | 35 | 111 (sprite-edge) | 66 (spawn-noon) | 0 |
| `siege_route` | 6 | 114 (battle) | 176 | 0.90 M (battle) | 601 MB | 10 | 2 + 8 | 35 | 109 (sprite-edge) | 52 (sprite-edge) | 0 |
| `skyrend` | 6 | 132 (battle) | 207 | 1.11 M (battle) | 549 MB | 18 | 3 + 20 | 36 | 109 (sprite-edge) | 73 (sprite-edge) | 0 |
| `ascent_route` | 6 | 119 (battle) | 155 | 0.81 M (battle) | 594 MB | 11 | 2 + 9 | 35 | 109 (sprite-edge) | 56 (spawn-noon) | 0 |
| `solenne` | 6 | 125 (spawn-noon) | 252 | 1.00 M (battle) | 619 MB | 20 | 3 + 19 | 36 | 113 (sprite-edge) | 98 (battle) | 0 |
| `eclipse_shrine` | 6 | 103 (battle) | 138 | 1.01 M (battle) | 543 MB | 6 | 2 + 9 | 35 | 103 (sprite-edge) | 51 (battle) | 0 |
| `umbral_observatory` | 6 | 106 (battle) | 201 | 0.99 M (battle) | 557 MB | 10 | 2 + 5 | 35 | 105 (sprite-edge) | 53 (battle) | 0 |
| `celestial_spire` | 6 | 102 (battle) | 122 | 1.06 M (battle) | 543 MB | 6 | 2 + 5 | 35 | 103 (sprite-edge) | 44 (lamps-night) | 0 |
| `the_rift` | 6 | 105 (battle) | 122 | 1.15 M (battle) | 573 MB | 5 | 2 + 5 | 35 | 101 (sprite-edge) | 43 (gym-dusk) | 0 |

- Every count cap holds in all 126 shots of the re-run. Every report lists **0 count-cap violations** (`violations: []`):
  - beauty ≤ 400: worst 186;
  - shadows ≤ 564: worst 496;
  - triangles ≤ 2.5 M: worst 1.44 M;
  - textures ≤ 700 MB: worst 625 MB;
  - materials ≤ 48: worst 20;
  - RT ≤ 41: worst 36;
  - programs ≤ 128: worst 113.
- **Before the residency merge**, the first budget run (07:08–10:39 UTC, the bundle without the other session's creature texture residency) failed the texture cap in ten zones. The worst cases were galvan_route 876 MB, solenne 848 MB, siege_route 825 MB, ascent_route / hollow_route 817 MB, the_rift 765 MB and tide_route 765 MB. Those numbers were all-atlas residency plus each zone's hero surfaces; none of the bytes came from the dressing pass, which binds no new surface. The re-run after the merge passes everywhere (M3-all-7).
- **`pnpm audit:assets -- --dump <zone>.dump.json`**, re-run on the 21 new dumps, gives the same result as the first pass:
  - 18 zones pass every evaluated rule. `harvest.same` is N/A in the_rift and umbral_observatory, as before: the dump lacks its input.
  - `lights.housing` fails in three zones, with unchanged distances: galvan_route, siege_route and umbral_observatory (M3-all-6).

## 3. Cross-zone findings

- **M3-all-1** · blocker (process): this file was written by the agent that implemented E1/E2. §50.6 requires a reviewer who did not implement render. *Answer:* open. A hostile pass on these 126 PNGs is owed.
- **M3-all-2** · major (line 7, the Phase E bar): no town except Mirevale reads like Mirevale from its spawn.
  - Cause: content spawns 8 towns at (−50, 0) on the entry road, 50 m from the plaza, and render cannot add solids.
  - *Fix:* content. Move `ZoneDef.spawn` on or beside the plaza as in Mirevale (fast travel and login land there), or give `planProps` an entry-street program: trees, carts, fences, a gatehouse on the plaza side of the boundary. Either one restamps the heightfield and changes the server's walkable set, so it must run with the progression walker's fixtures.
  - Check: from every town's spawn-noon, ≥ 1 building and ≥ 6 hand-placed props in frame.
  - *Answer:* content took a third route in `0e28b50`. A derived **arrival point** on each plaza ring is used for fast travel, the escape rope, fallback joins and the harness spawn shot. `ZoneDef.spawn` and every heightfield are unchanged.
  - Re-shot on `ba1a91e` (§1.1):
    - All eight towns now open on their plaza.
    - Check result: 5 / 8 pass. Saltmourn, stormrook and vesperveil have no house in frame. Mirevale's own frame has no house either.
    - Author's density judgement: one town (saltmourn) is still below the bar.
  - Open for the independent reviewer to accept or reject.
- **M3-all-3** · major (line 1): ground tufts are crossed "X" cards in saturated grass green in every biome. The per-biome `grassTints` (dressing.ts) multiply the `tall_grass` texture, which can darken it but cannot desaturate it, so tufts on white salt sand, snow and canyon dust read as green confetti.
  - Visible in `tide_route/spawn-noon--92_0-full.png`, `skyrend/gym-dusk-0_-18-full.png` and `deepcut_route/spawn-noon--92_0-full.png`.
  - *Fix:* a per-biome tuft surface (a dry-grass / dune-grass / sedge card in the salt, marrow, sky and cinder rows), or a tint mode that lerps toward the tint instead of multiplying.
  - Check: mean chroma of tuft pixels in the reduced spawn shot ≤ the biome ground's chroma + 20 %.
- **M3-all-4** · major (line 2): tall grass in the encounter patches is the same bright card at the same height in every biome. See `hollow_route/sprite-edge--87.68_6.21-full.png`, `ash_route/sprite-edge--88.21_2.67-full.png` and `siege_route/spawn-noon--92_0-full.png`. The M2 finding M2-sprite-edge-2 (paper strips) is unchanged in all 15 zones that have tall grass. *Fix:* as M2-sprite-edge-2, plus a biome tint.
- **M3-all-5** · major (line 9, harness): the `gym-dusk` fallback (no gym: routes and story zones) aims 8 m past the set-piece's keep-clear extent along +z. For long set-pieces (mire_boardwalk hw 15, galvan_span, tide_wreck) that leaves the set-piece out of frame and shows a meadow. See `mire_route/gym-dusk-0_21.32-full.png`. *Fix:* offset by `hd + 6` (not `max(hw, hd) + 8`) and turn the heading toward the set-piece. Check: the set-piece covers ≥ 15 % of the frame in every fallback gym-dusk shot.
- **M3-all-6** · major (line 3): unmotivated set-piece lights. In three zones, `audit:assets` `lights.housing` finds no emissive housing within 0.6 m of a set-piece light:
  - galvan_route `setpiece0/1`: nearest housing 10.3 m;
  - siege_route `setpiece0`: nearest housing 5.2 m;
  - umbral_observatory `setpiece0`: nearest housing 15.3 m.
  `SET_PIECE_LIGHTS` (layout.ts) and those set-piece builders (storm `galvan_span`, forge `siege_trebuchet`, vesper `umbral_dome`) disagree on where the lamps are.
  - *Fix:* put the housing at the table's light points, as `grove_heart_tree` / `mire_boardwalk` do with `spLights()`.
  - Check: `audit:assets` 17 / 17 on all 21 dumps.
  - Not caused by E1; first measured here.
- **M3-all-7** · Fixed (line 9): the texture cap. It failed in ten zones on the pre-residency bundle and passes in all 21 after the merge of the creature texture residency (another session; render IMPLEMENTATION-NOTES Part 9).
- **M3-all-8** · minor (line 6): `maskCoverage.battlers[1]` (the far battler) reads 0.14–0.38 in most battle shots. The mask PNGs show a solid silhouette (`the_rift/battle-27.92_-31.68-mask.png`), so the low number comes from the battler rect, which includes the VFX burst and transparent sprite margin. It is not blur on the battler. *Fix (harness):* measure coverage over the sprite's opaque pixels (alpha from the atlas), not the rect. *Answer:* Accepted as a metric artefact only after the harness change confirms ≥ 0.9 over opaque pixels.
- **M3-all-9** · minor (line 4): the staged fallback creatures in towns (sprite-edge / battle, "no encounter table") stand on the town road. A town has no wild spawns, so the shots audit the billboard on town ground, not a gameplay situation. Recorded so nobody reads them as a design.
- **M3-all-10** · major (line 1): noon is darker and still compressed. The M2 re-shoot reduced spawn-noon reads luma p1 / p50 / p99 **51 / 120 / 156**, against 83 / 148 / 179 before the re-light. The blacks opened, but the highlights fell: nothing in a noon frame exceeds ≈ 62 % grey. M2-spawn-noon-2's check (p1 ≤ 40, p99 ≥ 215) still fails on p99. Dusk is the clear win: gym-dusk went from 17 / 24 / 58 (night) to **42 / 73 / 215**, a golden hour with a raking key. *Fix (Spec §10.3.5 / §10.8):* raise noon exposure or the key (sun 1.0 → 1.3, or exposure 1.0 → 1.2) until p99 ≥ 215 with p1 ≤ 45. Check: the M2 spawn-noon reduced percentiles.
  - *Re-shoot (`ba1a91e`, §1.1 table; top 80 px excluded):* Mirevale's spawn-noon still reads 48 / 120 / 156. Five of the eight plaza shots reach p99 ≥ 207, but only on bright surfaces: lava 227, snow 221, salt sand 215, marble 211, dust 207. Their mid-tones are unchanged in character. Vesperveil (177) and forgewall (164) stay compressed. The exposure finding stands.
- **M3-all-11** · minor (line 9, harness framing; new in the re-shoot): **the `spawn-noon` row does not show what a town arrival shows.**
  - The table's heading 0 ("+z forward") drives rig heading 2. The game camera keeps its rig heading across fast travel and joins (`SceneDirector`; default rig 0, which looks ≈ −z). `arrival.ts` puts the arrival on the plaza's south side for exactly that reason: rig 0 looks at the set-piece.
  - So the committed row looks away from the plaza centre, with the set-piece blurred in the near foreground.
  - A scratch capture at rig heading 0 (`harness:shots --shots spawn-noon --headings rig`; not committed, because the `headings-rig/` sidecars are outside the M3 set) frames each set-piece sharp, mid-frame, beside the player:
    - cinderhold: the lava basin, with its NPC by the brazier;
    - saltmourn: the lighthouse base and door;
    - stormrook: the round stone set-piece base;
    - vesperveil: the thatched, timber-framed set-piece;
    - solenne: the league-hall door and steps;
    - Mirevale: the heart tree's roots and lamp.

    In every town that view reads richer than the committed row.
  - *Fix (spec §50.6.1 / harness):* give `spawn-noon` the arrival's own camera (rig heading 0, the default), or record the rig-0 arrival view as a seventh M3 town row.
  - Check: the set-piece is in focus (mask = 1.0 over ≥ 50 % of its pixels) in every town's arrival shot.

## 4. Per-zone findings

Paths are relative to `.screenshots/audit/M3/<zone>/`. "FB" marks a fallback anchor (sidecar `rule` starts with `fallback:`). Lines with nothing new beyond §3 are not repeated.

**Re-shoot, the rows other than the town spawn shots.** They kept their stems in all 21 zones, and their full-variant draw counts are unchanged.
- Mean luma (full variant) moved by more than 6 in nine shots:
  - deepcut_route `sprite-edge` 144 → 137;
  - galvan_route `gym-dusk` 100 → 107;
  - hollow_route `spawn-noon` 117 → 108;
  - hollow_route `gym-dusk` 82 → 91;
  - saltmourn `sprite-edge` 130 → 137;
  - skyrend `lamps-night` 68 → 59;
  - solenne `gym-dusk` 116 → 106;
  - tide_route `lamps-night` 47 → 58;
  - umbral_observatory `gym-dusk` 102 → 108.
- These were not re-judged image by image here. The per-zone text below is the first pass's, except where it says "re-shoot". The independent pass covers the current PNGs.

### Towns

**`mirevale`** — `spawn-noon-0_6`, `gym-dusk-0_-18`, `sprite-edge-2_12` (FB), `lamps-night-1.34_17.63`, `battle-3_11` (FB), `link-east-58_0`.
- M3-mirevale-1 · Fixed: the M2 blocker M2-spawn-noon-9 is closed. `maskCoverage.player` is 0.49 and the crown is dithered over the player.
- M3-mirevale-2 · minor (line 3): at night, flower patches near the lamp read self-lit; the tints are bright, and no shadowing reaches the card heads (`lamps-night-1.34_17.63-full.png`).
- M3-mirevale-3 · minor (line 7): in the staged battle, a lamp post stands between the camera and the ring (`battle-3_11-full.png`; M2 Part 5 open item 2).

**`cinderhold`** — `spawn-noon-5.5_9.5`, `gym-dusk-0_-18`, `sprite-edge--48_6` (FB), `lamps-night-1.34_17.63`, `battle--47.39_5.08` (FB), `link-east-58_0`.
- M3-cinderhold-1 · major (line 7), first pass: the road spawn (`spawn-noon--50_0`, now removed) was a road through ash with tufts and scree. The braziers and the boulder dyke with gate piers were the only built objects (M3-all-2). *Re-shoot:* the plaza frame shows two stalls, a barrel, a bench, a brazier, a dead tree, a house corner and the lava basin (§1.1). The green tufts on the ash remain (M3-all-3).
- M3-cinderhold-2 · Fixed: the green `tall_grass` "bushes" of the first dressing cut read as lawn on ash. They are removed for cinder and marrow (`DRESSING.cinder.bush = null`).
- The dusk and night shots read well: a warm raking key, and brazier and lava pools at night.

**`saltmourn`** — `spawn-noon-5.5_9.5`, `gym-dusk-0_-18`, `sprite-edge--48_0` (FB), `lamps-night--48.46_7.89` (FB: no shop), `battle--47.39_-0.92` (FB), `link-east-58_0`.
- M3-saltmourn-1 · major: bright-green tufts and grass clumps on white sand (M3-all-3). They fill the left third of the plaza frame (`spawn-noon-5.5_9.5-full.png`).
- M3-saltmourn-2 · major (line 7, the Phase E bar; re-shoot): the plaza frame is the thinnest of the eight towns.
  - In frame: one stall, a barrel, a planter, a bench and one lamp post. The lighthouse is only a white sliver at the right edge, and no house is in frame (§1.1).
- The post-and-rail boundary fence and its piers read correctly (`link-east-58_0-full.png`).

**`stormrook`** — `spawn-noon-0_11`, `gym-dusk-0_-18`, `sprite-edge--48_6` (FB), `lamps-night-1.69_21.85`, `battle--47.39_5.08` (FB), `link-east-58_0`.
- M3-stormrook-1 · minor (line 1): `wet_flagstone` covers the whole town ground layer as well as the plaza, so ground and road do not separate (`gym-dusk-0_-18-full.png`; also the plaza rim in `spawn-noon-0_11-full.png`). It is a palette choice (`storm_stormrook` layers).

**`marrowdig`** — `spawn-noon-0_11`, `gym-dusk-0_-18`, `sprite-edge--48_6` (FB), `lamps-night-1.52_17.69`, `battle--47.39_5.08` (FB), `link-east-58_0`.
- M3-marrowdig-1 · major (line 1): green tufts on canyon dust (M3-all-3).
- First pass: a pocket's sandstone crag canopy dominated the road spawn frame and read as a mesa, which is acceptable. *Re-shoot:* the plaza frame shows a stall, a crate, a bench, four lamp posts, the ore-cart set-piece on rails and a house corner (§1.1).

**`vesperveil`** — `spawn-noon-5.5_9.5`, `gym-dusk-0_-18`, `sprite-edge--48_6` (FB), `lamps-night-1.69_21.85`, `battle--47.39_5.08` (FB), `link-east-58_0`.
- The closest town to the bar: willow-leaf verge bushes, black willows and a fence line (`link-east-58_0-full.png`).
- M3-vesperveil-1 · minor: the mossy road's yellow lichen speckle tiles visibly at the default stop.
- M3-vesperveil-2 · minor (line 7; re-shoot): in `spawn-noon-5.5_9.5-full.png` the lantern-maker NPC's nameplate overlaps the HUD party badge (top left).

**`forgewall`** — `spawn-noon-5.5_9.5`, `gym-dusk-0_-18`, `sprite-edge--48_6` (FB), `lamps-night-3.56_18.36`, `battle--47.39_5.08` (FB), `link-east-58_0`.
- M3-forgewall-1 · minor (line 2): the pine-needle verge bushes read as small dark blobs at the default stop. This was seen in the first-pass road frame (`spawn-noon--50_0`, now removed). In the plaza frame (`spawn-noon-5.5_9.5-full.png`) only one such bush shows, beside the boulders at the top left. The finding was not re-judged there.

**`skyrend`** — `spawn-noon-5.5_9.5`, `gym-dusk-0_-18`, `sprite-edge-38.87_19.81`, `lamps-night-3.56_18.36`, `battle-39.49_18.89`, `link-east-58_0`.
- M3-skyrend-1 · major: green tufts on snow (M3-all-3), and noon mean luma ≈ 191–200, the brightest zone with snow at the key. In the plaza frame, snow and pale paving merge (reduced p50 210).
- M3-skyrend-2 · minor (line 2): the plaza stall's prayer-flag card reads as a striped rainbow plank (`gym-dusk-0_-18-full.png`; both stalls in `spawn-noon-5.5_9.5-full.png`).

**`solenne`** — `spawn-noon-5.5_9.5`, `gym-dusk-0_-18`, `sprite-edge--27.44_44.93`, `lamps-night-1.47_19.03`, `battle--26.82_44.01`, `link-east--58_0` (FB: west link).
- M3-solenne-1 · Fixed (live report): the league-hall foyer rug was a 4.2 × 2.8 m slab of pale `sun_marble` that read as a missing texture at dusk. It is now a 3.4 × 2.2 m `grove_moss` field with gilt-bronze border, bands and fringe. Verified in the sandbox (`?zone=solenne&interior=solenne.league&x=51&z=-7&t=19.25`; scratchpad `phaseE/rug/solenne.png`).

### Routes

**`mire_route`** — `spawn-noon--92_0`, `gym-dusk-0_21.32` (FB), `sprite-edge--80.94_5.3`, `lamps-night--69.4_6.25` (FB), `battle--80.32_4.38`, `link-east-98_0`.
- The richest route: flowers, bushes, stones and trees (`link-east-98_0-full.png`). It meets the bar.
- M3-mire_route-1 · minor (line 6): in `lamps-night` an oak crown sits between the camera and the player. The fade keeps him readable (`maskCoverage.player` 0.41), but the frame is mostly crown.

**`ash_route`**, **`tide_route`**, **`galvan_route`**, **`deepcut_route`**, **`hollow_route`**, **`siege_route`**, **`ascent_route`** — six shots each, with gym-dusk and lamps-night as fallbacks.
- M3-routes-1 · major: in every non-grove route the spawn view is a road with verge cover and tall-grass patches (M3-all-3, M3-all-4). galvan / siege / forge-side routes gain pine trees at the frame edge.
- M3-routes-2 · minor (line 7): the staged level-2 wild creatures are 40–70 px tall at zoomStop 0 (`ash_route/sprite-edge--88.21_2.67-full.png`), which is small for an edge audit.

### Story zones

**`eclipse_shrine`**, **`celestial_spire`**, **`umbral_observatory`**, **`the_rift`** — six shots each (gym-dusk, lamps-night and link-east are fallbacks where the zone lacks the subject).
- M3-story-1 · major (line 1): shrine scree is `eclipse_stone` on an `eclipse_stone` floor and vanishes. Only the void-glass / rift shards read (`eclipse_shrine/lamps-night--63.24_-2.94-full.png`). *Fix:* scree in `star_iron` for shrine, or a darker tint.
- M3-story-2 · minor (line 3): the shard clusters glow (void_glass, rift_shard are emissive) with no light. They are their own source, which is acceptable for crystals, but bloom picks them up at night.
- M3-story-3 · minor (line 4): in the_rift the far battler (umbrit, ghost / dark) is a dark sprite on a dark floor (`the_rift/battle-27.92_-31.68-full.png`). Its rim lift is the only separation.

## 5. M2 shots re-taken (E2)

`harness:shots --set M2` for mirevale and mire_route, from the 12:10 bundle (re-light + dressing). Luma percentiles p1 / p50 / p99 and mean of the reduced variant, HUD rows excluded:

| Shot | before (committed M2) | after (re-light) |
|---|---|---|
| `mirevale/gym-dusk-0_-18-reduced.png` | [17, 24, 58] / 26.9 | [42, 73, 215] / 79.7 |
| `mirevale/lamps-night-1.34_17.63-reduced.png` | [14, 19, 98] / 23.4 | [12, 25, 109] / 29.2 |
| `mirevale/link-east-58_0-reduced.png` | [78, 148, 180] / 143.6 | [46, 113, 157] / 107.9 |
| `mirevale/spawn-noon-0_6-reduced.png` | [83, 148, 179] / 146.2 | [51, 120, 156] / 117.1 |
| `mire_route/battle--80.32_4.38-reduced.png` | [57, 158, 231] / 153.7 | [35, 137, 224] / 132.0 |
| `mire_route/sprite-edge--80.94_5.3-reduced.png` | [75, 138, 174] / 135.9 | [54, 108, 150] / 108.4 |

The pre-re-light PNGs are kept in the scratchpad (`phaseE/M2-before/`).

- M2-gym-dusk-2 ("dusk renders as night") is closed: the sun is 10° up at t 0.80, warm, with long shadows.
- M2-lamps-night-5 (no moon shadows) is closed: the moon at 0.30 casts readable shadows beside the lamp pools.
- M2-spawn-noon-2 is half closed: the blacks opened, the highlights did not (M3-all-10).

## Answers

| Id | Answer |
|---|---|
| M3-all-1 | Open: an independent hostile pass is owed |
| M3-all-2 | Addressed by content (`0e28b50`, plaza arrival point) and re-shot on `ba1a91e`: 5 / 8 towns pass the check. Pending the independent reviewer |
| M3-saltmourn-2 | Open: content (plaza props on the arrival side) |
| M3-all-11 | Open: spec §50.6.1 / harness (the arrival camera) |
| M3-all-3, M3-saltmourn-1, M3-marrowdig-1, M3-skyrend-1 | Open: needs per-biome tuft surfaces (`40-pipelines.md` material bake) or a lerp tint mode |
| M3-all-4 | Open: as M2-sprite-edge-2 |
| M3-all-5 | Open: harness fallback rule |
| M3-all-6 | Open: three set-piece builders |
| M3-all-7 | Fixed: texture residency (another session); all 21 zones ≤ 625 MB |
| M3-all-8 | Open: harness metric |
| M3-all-9 | Accepted: towns have no wild creatures; the staged billboard still audits Pillars 5 / 6 on town ground |
| M3-all-10 | Open: Spec §10.3.5 exposure |
| M3-mirevale-1 | Fixed (Part 5 occluder fade; re-measured here) |
| M3-cinderhold-1 | Open for the reviewer: the road frame it describes was replaced by the plaza frame (§1.1); the tufts are tracked under M3-all-3 |
| M3-cinderhold-2 | Fixed: `DRESSING.cinder/marrow.bush = null` |
| M3-solenne-1 | Fixed: `ThemeKit.rug` (commit `5611ede`) |
| the rest | Open (minor) |
