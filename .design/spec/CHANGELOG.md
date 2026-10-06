# `.design/spec/` CHANGELOG

Format per `50-verification-budget.md` §50.7 rule 2: `## <date> — <file> §<section> — <one-line change>`, then `Why`, `Evidence`, `Affects`. Newest entry at the top. Every entry below is the 2026-09-18 reconciliation pass that produced the first assembled `.design/SPEC.md`; each edit in the part files carries a `<!-- reconciled 2026-09-18: … -->` mark pointing back here.

Inputs read for the pass: `00-spine.md`, `10-render.md`, `20-client.md`, `30-server-netcode.md`, `40-pipelines.md`, `50-verification-budget.md`; `.design/story-bible.md` (§5 beats, §7 legendaries, §11 flags); `.design/roster-coverage.md` (§4–§7, §12, §16); `.design/audits/legacy-render-audit.md` §7 (32 questions); `packages/persist/IMPLEMENTATION-NOTES.md` + `src/repos/*.ts` + `src/schema/*.ts` + `src/errors.ts` + `src/constants.ts`; `packages/core/IMPLEMENTATION-NOTES.md` + `src/index.ts`.

---

<!-- 2026-10-06 handover: the fixed light layout and the off-scene prepare. Three entries. -->

## 2026-10-06 — `10-render.md` §10.3.2 (new paragraph "Fixed light layout"; the zone's shadow-map casters 6 → 2), §10.3.1 (point-light casters render no map), §10.1.2 step 8, §10.5.9, §10.10.2 — every zone renders with the boot's light set
Why: three 0.186's `LightsNode` keys every lit render object by each scene light's id and emits one light node per light, so a zone's own lights rebuilt every lit object on its first frame and added light-set variants (mirevale → mire_route: 6.4–8.9 s to the first destination frame on the dev iGPU, programs 109 → 119–125 → 113). The renderer's `lighting` is now `LightLayout` (`lighting/layout.ts`): all non-shadow point / spot lights in ONE looped uniform array (three's `DynamicLighting` addon needed 13 uniform buffers per lit fragment stage, over WebGPU's 12, and failed every lit pipeline); shadow-casting lights a fixed pool from construction — sun, hemisphere, 2 arena beacons, 2 zone slots. 2 slots, not 6: each slot is sampled by every lit fragment and 6 took the billboard material to 17 sampled textures (> 16); content's maximum is 1 per zone (all 21 surveyed), and no zone casts with a point light.
Evidence: render IMPLEMENTATION-NOTES "Handover: fixed light layout" (sandbox: programs 89 after step 8, 107 with Mirevale, 107 after a handover; leak cycles ±0 programs / render targets / geometries / attributes); `packages/render/test/light-layout.test.ts` (the layout key is the boot's for 6 zones while the stock key changes for each; the loop's rows; slots), `lighting.test.ts`; A/B shots (spawn-noon, gym-dusk, lamps-night on mirevale + cinderhold) differ by 0.2–0.7 / 255 on average, below the run-to-run noise of one build (0.8–5.5).
Affects: `packages/render/src/{lighting/layout,lighting/rig,renderer,stats,index}.ts`; `castsShadowMap` (spot kinds only), `LIGHT_LAYOUT`, `createLightingLayout`, `LightRig.slotLightsInUse`, `DumpInput.extraLights`; render targets +2 from construction (35 after step 8, 36 with Mirevale; cap 41).

## 2026-10-06 — `10-render.md` §10.1.2 (new paragraph "Handover prepare": `Renderer.prepareZone?` / `dropPrepared?`, optional additions like `prepareHandover`); `20-client.md` §20.10.3 (new paragraph "Handover prepare") — the destination zone is built and compiled off the scene before the crossing
Why: with the light set fixed, the crossing still built the destination and node-built every scatter `InstancedMesh` (three keys each by its uuid: 49 builds, 4.3 s of the remaining 5.4 s in the sandbox). A compile done while the current zone is up is now valid for the next zone's frames, so the client prepares the linked zone within 48 m of its link edge and `loadZone` adopts it.
Evidence: `handover-hitch.spec.ts` on the dev iGPU, preloaded: first destination frame 6 402 / 8 895 ms → 105 / 68 / 196 ms, `loadZone` 17–45 ms; the prepare 2.9–7.6 s in the background, longest frame 0.8–1.7 s (the synchronous zone build); `light-layout.test.ts` (`ZoneSystem.prepare`: off the scene, lights deferred to the adoption, the current zone's sets kept when dropped, the prepared sets kept through the current zone's dispose); sandbox: a prepared zone dropped returns geometries / attributes / programs to the loaded zone's values.
Affects: `packages/render/src/{renderer,zone/system}.ts`, `sandbox/main.ts` (`prepare`); `packages/client/src/scene/{SceneDirector,World3D}.ts` (`prepareZone`, `prepareNearEdge`), `src/harness/HarnessWorld.ts`.

## 2026-10-06 — `50-verification-budget.md` §50.2.2 (programs row), §50.4.7 (`first-frame.spec.ts`, `handover-hitch.spec.ts` rows) — measured numbers after the fixed light layout and the prepare
Why: the programs baseline moved (79 → 89, the 2 shadow slots' variants are compiled at boot) and stays constant across handovers; the handover spec's "preloaded" now prepares the destination and records the prepare's frame gaps and the program counts.
Evidence: handover not preloaded 7 734 / 8 562 → 3 781 / 3 742 / 4 659 ms (≤ 1 500 still not met on the iGPU); first frame 34–64 s → 25–26 s (two runs each, same day, same machine load); render IMPLEMENTATION-NOTES "Handover: fixed light layout".
Affects: `packages/client/test/handover-hitch.spec.ts` (`EWA_HARNESS_NO_BUILD`), `scripts/harness/common.ts` (`EWA_HARNESS_BUILD_DIR`).

<!-- 2026-10-06 town arrival point: eight of the nine towns spawn on the west road 50 m from their plaza; arrivals without an edge crossing now land on the plaza. Two entries. -->

## 2026-10-06 — `30-server-netcode.md` §30.2.2 (`onJoin` step 3), §30.6.3 (`escapeRope`); `00-spine.md` §4.6 (Fast travel) — fast travel, the escape rope and a fallback join land on `arrivalPoint(zone)` and face its `angle`; edge handovers unchanged
Why: Phase C3 fast travel handed over to `dest.spawn`, so a player travelling to any town but Mirevale arrived on an empty west road 50 m from the plaza with no building in frame (M3 render audit §1, M3-all-2); a fallback join did the same.
Evidence: `packages/server/src/rooms/ZoneRoom.ts` (`onJoin` position, `onTeleport`, `onFastTravel`); `packages/server/test/fast-travel.test.ts` (cinderhold: the handover carries the arrival point, the destination lands and faces it, a same-zone hop teleports there; a fallback join lands there), `test/fixes.test.ts` (the rope: a route's arrival is its spawn); server IMPLEMENTATION-NOTES "Town arrival point".
Affects: fast travel to the eight towns other than Mirevale, a fallback join into them; `entryPoint` (edge handovers), the ranked arena spots and the progression walker's paths are unchanged (the walker enters through its persisted row and crosses edges).

## 2026-10-06 — `00-spine.md` §3.1 (`ZoneDef.spawn` comment, new paragraph "Spawn and arrival point"), `50-verification-budget.md` §50.6.1 (M3 paragraph) — content `arrivalPoint(zoneId)`: Mirevale's spawn, a plaza-ring point in the other towns, the spawn elsewhere; `spawn-noon` anchors on it; validate checks it
Why: `spawn` cannot move — the heightfield seeds its clearings and keeps ponds dry around authored points including the spawn, so moving it reshuffles ponds → roads → buildings → interiors → the R1 fixture and the walker's recorded legs — but eight towns' spawns sit at (−50, 0) / (−50, −6) where nothing of the town is in frame (M3 render audit §1, M3-all-2). A derived arrival point, not an authored point, changes no digest.
Evidence: `packages/content/src/arrival.ts`, `src/validate.ts` (rule 12: walkable and reachable from the spawn); `packages/content/test/arrival.test.ts` (pins all nine towns; spawns unchanged; on the plaza, 8-neighbour walkable, reachable, clear of pockets / solids / set-piece / authored points, facing the centre); `pnpm --filter @ewa/content run validate` OK with every heightfield digest unchanged; `packages/client/test/harness-anchors.test.ts`; content / server / client IMPLEMENTATION-NOTES "Town arrival point".
Affects: `@ewa/content` exports `arrivalPoint`, `arrivalPointFor`, `ArrivalPoint`, `ARRIVAL_CLEARANCE_M`, `ARRIVAL_RIM_INSET_M`; the client harness `spawn-noon` anchor of the eight towns (their committed M3 `spawn-noon--50_0*` / `--50_-6*` sidecars are stale until `harness:shots --set M3` re-runs); Mirevale's M2 shots unchanged.

<!-- 2026-10-06 true-colour sprite cache: the per-sprite stage cache was a 256-colour dithered palette (sharp `png({ effort })`), and every static creature atlas was composed from it. Two entries, newest on top. -->

## 2026-10-06 — `50-verification-budget.md` §50.2.2 (Texture memory row), `10-render.md` §10.10 — the texture metric subtracts the level 0 three's `Info` counts twice for the creature atlases
Why: three 0.186 `Info._getTextureMemorySize` adds the image's level 0 AND every `mipmaps` entry; §10.4.1 puts level 0 into `mipmaps` (`[l0, l1, l2, l3]`, or three uploads level 1 as level 0), so every creature atlas, flipbook and single read 1.753 × the GPU memory it allocates (a 2048² atlas 58.7 MB for 33.5 MB, a 3072 × 2048 flipbook side 88.0 MB for 50.2 MB). The row measures GPU texture memory; it already corrects the KTX2 bytes three counts as 1.
Evidence: render IMPLEMENTATION-NOTES Part 9 R1 (three `src/renderers/common/Info.js` lines 449–509); `packages/render/test/residency.test.ts` (three's own count − `infoOvercountBytes` = the chain estimate, static and anim); client IMPLEMENTATION-NOTES "Creature textures" (every harness row read both ways).
Affects: `packages/render/src/{renderer,stage/wiring,sprites/atlas,sprites/billboard}.ts`; `RenderStats.textureBytes`, `BudgetCounts.texturesSize`, `harness:budget` (Mirevale idle 495.2 → 444.9 MB at 1440 × 900).

## 2026-10-06 — `10-render.md` §10.4.2 — `BillboardPool.atlasUsers` / `atlasRefs` / `infoOvercountBytes`, `CreatureBillboard.setFlipbook(on)`, `FrameHook.textureOvercountBytes?`
Why: the client's residency must not count an atlas a billboard still samples as freed, and must be able to free the flipbook of a card that stays up but is never on screen (a legendary static more than 52 m away).
Evidence: render IMPLEMENTATION-NOTES Part 9 R2–R3; `test/residency.test.ts`; client `test/creatureTextures.test.ts` (end to end on `BillboardPool`).
Affects: `packages/render/src/sprites/billboard.ts`, `renderer.ts`, `stage/wiring.ts`; no program, material, draw-call or per-frame allocation change.

## 2026-10-06 — `20-client.md` §20.4.4 (new paragraph "Creature texture residency"), `50-verification-budget.md` §50.2.2 (the creature share of the texture cap) — owners release every creature atlas; a view binds the ONE side it shows; 20 s grace, 2 flipbooks + 4 static atlases idle; a live creature budget = the cap − every other texture byte − 16 MiB
Why: the client bound a species' static atlas and BOTH flipbook sides the first time it saw it and never released a creature atlas; with the animated legendaries every legendary met or carried kept 100–150 MB for the session (a battle zenryu vs raikitsune 965 MB as three counted it; 10 legendary battles + 10 evolutions 3.9 GB; nothing returned on leaving).
Evidence: client IMPLEMENTATION-NOTES "Creature textures" (harness before / after table, `pnpm harness:textures`); `packages/client/test/creatureTextures.test.ts` (17 tests); render `test/residency.test.ts`.
Affects: `packages/client/src/scene/{creatureTextures,SpawnViews,LegendaryViews,RaidViews,EvolutionDirector,World3D,spriteCatalog}.ts`, `src/harness/*`, `scripts/harness/{textures,common}.ts`.

## 2026-10-06 — `20-client.md` §20.10.3 — phase 3 binds the zone's static set, the party's STATIC atlases and the FRONT flipbooks of legendary statics within 40 m of the arrival point (supersedes the same-day entry below that loaded both sides of the statics' and the party's flipbooks)
Why: a party flipbook only ever shows its back, in battle (bound by the battle when shown); a static shows its front, and only near the player. Binding both sides of all of them at zone load was the bulk of the leak above.
Evidence: client IMPLEMENTATION-NOTES "Creature textures" (galvan_route with both statics standing: 1471 → 878 MB raw, 990 → 652 MB corrected).
Affects: `packages/client/src/scene/World3D.ts` (`bindZoneAtlases`), `harness/HarnessWorld.ts`; galvan_route's phase-3 payload ≈ 4.7 MB → 0–2.4 MB; Mirevale unchanged.

## 2026-10-06 — `20-client.md` §20.10.3 — phase 3's creature-atlas figures follow the true-colour rebuild: Mirevale 0.83 MB (was 2 × 0.544), the 8-atlas zones 3.75 / 3.79 MB (was "4.35")
Why: the static atlases are 8 % smaller after the rebuild below, and the old figure for the 8-atlas zones was 8 × the per-atlas mean rather than their measured bytes (4.15 / 4.17 MB before the rebuild). The zones are now 0.21–0.25 MB under the 4 MB phase-3 figure on their own atlases; one party single still takes them over, so R12 stands.
Evidence: `packages/client/public/creatures/creatures.manifest.json` (`zones.mirevale`, `zones.galvan_route`, `zones.solenne` summed over each atlas's albedo + normal + emissive `bytes`).
Affects: no code; `first-frame.spec.ts` (Mirevale only) gains 0.10 MB of margin.

## 2026-10-06 — `40-pipelines.md` §40.1.2, §40.1.6.3, §40.1.6.4, §40.1.7, §40.1.8, §40.6 — the sprite cache stores lossless true colour (it held a dithered ≤ 256-colour palette); `SPRITE_STAGE_VERSION` 3 → 4, `PIPELINE_VERSION` 5 → 6; the static set rebuilt at the same top rung, 36.20 → 33.39 MB; the flipbooks byte-identical
Why: `cache.ts` wrote every stage raster with `png({ compressionLevel: 6, effort: 4 })`; sharp's `effort` implies `palette: true`, so libvips quantised each cached albedo and normal to ≤ 256 colours with dithering, and the 65 static atlases were composed from those copies — dither grain under the lossy WebP on all 130 species. `losslessPng` (RGBA8 / 8-bit grey, `palette: false`, none of `effort` / `colours` / `dither` / `quality`) is now the only writer for both caches; the version bumps invalidate every palette entry. Lossy WebP had been spending bits on the dither noise: the albedo is 11 % smaller at the same q88, so the ladder ships the same top rung with 3.31 MB of headroom, which it does not spend (it never steps up). §40.1.2's cache key also still named `PIPELINE_VERSION` and a 4096² atlas; fixed.
Evidence: cache vs stage output on the front sprites of auroracle / lumyth / dreambud / umbrit: 244 / 248 / 243 / 235 distinct RGB on opaque texels vs 141 k / 191 k / 74 k / 9.9 k, RGB PSNR 36.1 / 32.9 / 38.6 / 48.1 dB; `test/cache.test.ts` (bit-exact round trip of noise with ≫ 256 colours, a gradient and every grey level through both caches, true-colour IHDR, `processSprite` caches exactly what stages 2–4 produce; the old writer alters 21 854 of 32 204 bytes of the test gradient). Rebuild (cold, `--jobs 6`, 47 min): static 33 392 547 B (albedo 22.61 MB, normal 9.50, emissive 0.41 with all 260 files byte-identical, thumbs 0.70, manifest 0.18); against the true-colour raster the shipped albedo's whole-cell PSNR median 35.8 → 38.9 dB, min 30.2 → 33.1, edge-bad median 19 % → 5.5 %, interior-bad median 1.7 % → 0.3 %; 252 / 260 sprites better (up to +9.1 dB, zaptus front), 8 flat-block pixel-art sprites 0.05–1.9 dB lower (bogmaw back lowest at 36.4 dB); 141 560 silhouette texels (0.16 %) no longer moved by palette alpha. `encoding.test.ts` passes with every threshold unchanged; normal max mean angle 5.91° → 5.98° on a-050 (≤ 6°), the same 5.98° the v5 atlas measures against the true-colour normal. Flipbooks: 508 pages recomputed pixel-identical, 240 files + `qa/anim-*` byte-identical, 24 487 809 B at q80 / q80. `qa/contact-sheet.png` regenerated and reviewed; 0 actionable flags.
Affects: `tools/sprite-pipeline/src/{cache,anim,types,pipeline}.ts` (`pipeline.ts`: `qa` now reports the static `totalBytes` net of the manifest's anim share, which it had counted since the flipbooks landed — `budget.test.ts` rejected that report), `test/cache.test.ts` (new), `test/anim.test.ts`, `README.md`; `packages/client/public/creatures/` (520 albedo / normal atlas files, 130 thumbs, `creatures.manifest.json` `pipelineVersion` "6"); `qa/contact-sheet.png`, `qa/qa-report.json`.

---

## 2026-10-06 — `50-verification-budget.md` M3 checklist — the "8 badges + champion flag" step is met by the headless progression walk
Why: Phase B (story-complete) — Acts I–III and all 12 league fights must pass headless.
Evidence: `pnpm test:progression` — act1 695 s, act2 810 s, act3a 331 s, act3b 393 s, act3c 229 s, 0 desyncs; act3c asserts `GET /me` (8 badges in story order, `elite:*:beaten` ×3, `champion:zeon:beaten`, 33 beats, 8 legendaries); `progression-halls` 9/9.
Affects: the checklist box only (the walker drives the real rooms, movement validation and battles a browser drives).

<!-- 2026-10-06 Phase E5 (the missing §50.4 test suites). -->

## 2026-10-06 — `50-verification-budget.md` §50.4.4 (`battle-pass.test.ts`, `auth.test.ts` rows) — `setMythicalChoice` refuses without the level-50 row (`Forbidden`); the argon2id read-back stays in the server's `rest-auth.test.ts`
Why: Phase E5 wrote the missing `battle-pass.test.ts`, which exposed a defect. `setMythicalChoice` created the missing level-50 row, and `POST /battle-pass/mythical-choice` never checked the trainer level, so any account could take a level-50 mythical at trainer level 1.

Persist now follows spine §5.2 ("requires the level-50 row"). The route claims level 50 itself, gated on trainer level, because the client offers the choice in place of a Claim button. The argon2id parameters are the server's: persist stores the PHC string opaquely.
Evidence:
- `packages/persist/test/battle-pass.test.ts` (4)
- `packages/persist/test/auth.test.ts` (5)
- `packages/server/test/authority.test.ts` A10b
- `packages/server/test/rest-auth.test.ts` ("m=19456 t=2 p=1, PHC string…")
Affects: `packages/persist/src/repos/battlePass.ts`; `packages/server/src/rest/routes/catalog.ts` (`/battle-pass/mythical-choice`).

## 2026-10-06 — `50-verification-budget.md` §50.4.7 (`no-getimagedata`, `dof-mask`, `no-dom-in-frame`, `first-frame`, `slice-e2e` rows) — how each new file reads its row
Why: Phase E5 wrote these files against the current client, and four rows needed a reading or a status note.
- **`no-getimagedata`:** the Phase C3 minimap paints its base with `putImageData` (once per zone, from the heightfield, no sprite), so it is allow-listed by name.
- **`dof-mask`:** a billboard's screen rect also holds background, so "1.0 over the rect" is read as 1.0 over the subject's visible silhouette. The silhouette comes from forced-bit re-renders at the frame's own TRAA jitter offset.
- **`no-dom-in-frame`:** the background-compile pill and the Phase D12 tutorial card (event-driven) postdate the row.
- **`first-frame`:** the 2.5 s limit cannot be measured on the dev iGPU (≈ 46–48 s, synchronous shader warm-up). The spec follows the `handover-hitch` precedent and asserts milliseconds only with `EWA_REFERENCE_GPU=1`.
- **`slice-e2e`:** the trade, PvP and gym clear are not driven yet, and the row says so.
Evidence:
- `playwright test -c playwright.e2e.config.ts` — all four Playwright specs pass on the dev machine:
  - `slice-e2e` (2.6 min)
  - `no-dom-in-frame` (2.0 min)
  - `first-frame` (mark 48 s annotated, byte budgets 4.46 / 1.19 MB)
  - `dof-mask` (600 frames)
- `vitest run packages/client/test/no-getimagedata.test.ts` (7)
Affects:
- `packages/client/test/{slice-e2e,no-dom-in-frame,first-frame,dof-mask}.spec.ts`, `test/e2e/`, `test/dof-mask/`
- `playwright.config.ts` (additive project `client-e2e`); `playwright.e2e.config.ts` (new, without the fuzz `webServer`)

<!-- 2026-10-06 Phase E3 (render audit blockers + open items) and E6 (GPU device lost). -->

## 2026-10-06 — `10-render.md` §10.1.2 (device loss paragraph) — `GPUDevice.lost` → `Renderer.deviceLost` + `RendererOptions.onDeviceLost`, frames stop, the owner recreates; `20-client.md` §20.4.2 (paragraph) — World3D rebuilds the renderer and reloads the current zone behind the boot overlay
Why: Phase E6. A driver reset, TDR or GPU-process crash left the canvas dead with no way back short of a page reload. A reload loses the React tree and the WorldSession, and with them an open battle's UI state.
Evidence:
- `packages/render/test/device-lost.test.ts` (5) — `watchDeviceLost` with a fake device: one callback; `'destroyed'` and post-dispose losses ignored.
- `packages/client/test/device-lost.test.ts` (6) — the same wiring into `DeviceRecovery`:
  - order: overlay → teardown → new renderer → `loadZone` at the server's current position
  - the session is untouched
  - retries / give-up, merged losses, the loss-rate limit

Not reproduced on a real GPU.
Affects:
- `packages/render/src/renderer.ts` (`watchDeviceLost`, `DeviceLostInfo`, `handleDeviceLost`, `onDeviceLost`, `deviceLost`) and `index.ts`
- `packages/client/src/scene/deviceRecovery.ts` (new)
- `World3D.ts` (`bootRenderer`, `teardownRenderer`, `rendererOffs`, `enterZone(label)`)

## 2026-10-06 — `10-render.md` §10.5.1 `ZoneSpec.neighbours` + `NeighbourSpec`, §10.5.5 (skirt paragraph) — the skirt on a linked side is the neighbour zone's terrain and roads (audit M2-link-east-1)
Why: audit M2-link-east-1 (blocker): "the neighbouring zone streaming in must be visible". Beyond the field, the skirt showed generic hills on every side. `Renderer.loadZone` holds one zone, so a second, LOD-only zone root would duplicate the material, program and draw budgets.

The skirt instead takes the neighbour's heightfield and layout plan, which content already ships (a pure function of the zone): heights offset so the link points meet, road / plaza / detail layers, and scatter kept off its roads. It costs no new mesh, material or program.

`zoneSpecFor` stays unchanged (snapshot, digests); the client adds the field with `withNeighbours`.
Evidence:
- `packages/render/test/neighbour-skirt.test.ts` (5)
- `packages/client/test/neighbour-prefetch.test.ts` (`neighbourSpecsFor`, `withNeighbours`)
- sandbox A/B, render IMPLEMENTATION-NOTES Phase E3:
  - mirevale (92, 0) zoom 2: hills and trees → mire_route's road continuing
  - draws 129 → 131; materials and programs equal

The §50.6.1 shot-6 frame (zoom 1 at x = 58) ends at about x = 80, where the skirt begins.
Affects:
- `packages/render/src/{contracts,index}.ts`
- `terrain/mesh.ts` (`NeighbourField`, `NEIGHBOUR_SKIRT`, `neighbourWeight`, `skirtClearFn`, `skirtHeightFn`)
- `zone/builder.ts` (`neighbourFields`, scatter skirt clearance)
- `packages/client/src/scene/{zoneSpecFor,SceneDirector}.ts`
- `packages/render/sandbox/main.ts` (`&neighbours=0`)

## 2026-10-06 — `10-render.md` §10.1.2 (handover keep paragraph), §10.2.3 addition `MaterialLibrary.prefetch`; `20-client.md` §20.10.3 rules — phase 5's neighbour prefetch implemented, `prepareHandover` keeps the shared texture sets
Why: §20.10.3 phase 5 asked for the neighbouring zone's field materials and atlases after the hero tier. The client did not do it (client notes part 2, §20.10 row).

On a handover the old zone's dispose also evicted every texture set, so the next zone transcoded the shared grove surfaces again.
Evidence: `packages/client/test/neighbour-prefetch.test.ts` (plan, pacing, cancel). The handover's effect is measured by `handover-hitch.spec.ts` (next entry).
Affects:
- `packages/render/src/renderer.ts` (`prepareHandover`)
- `zone/system.ts`
- `materials/library.ts` (`prefetch`)
- `packages/client/src/scene/{prefetch.ts (new),World3D.ts,SceneDirector.ts}`

## 2026-10-06 — `10-render.md` §10.5.9 — the programs leak assertion is read after `compileIdle()`; after an unload the warm objects are re-keyed to the zone-less light set
Why: render Part 5 Open 1 — "programs +2 after unload". The cause was confirmed by program names: the warm quads `dirt` / `glass_warm` / `mist_glass`, the character decal and the surf ripple kept the unloaded zone's light-set variants, because nothing renders those objects after the zone is gone.
Evidence: Mirevale load → unload in the sandbox. Programs are +2 right after `dispose()` and **±0 after `compileIdle()`**; the name diff against the baseline is empty, and geometries / textures / render targets / attributes are ±0. The sandbox's `leakCycle` awaits it.
Affects: `packages/render/src/renderer.ts` (`scheduleWarmRekey`, cancelled by the next `loadZone`), `packages/render/sandbox/main.ts`.

## 2026-10-06 — `50-verification-budget.md` §50.6.1 (paragraph after the table) — shot 3 runs the sprite-edge scan at ≥ 1.3×; shot 6's neighbour is the skirt; mask variants sample the MRT without re-rendering
Why:
- **Audit M2-sprite-edge-5 (blocker).** The table's "one zoom step in" minifies the creature more than 10×. Even the 4 m inspector gives about 0.4× on a 1024² frame at 900 px, so §50.1 #6's 200-edge-pixel test could not run on any shot. The scan now stages the inspector, narrows the FOV to the magnification, isolates the billboard and reads the pre-TRAA `mask.y` in Node.
- **Programs (render Part 6 Open 1, audit M2-gym-dusk-8).** The harness's mask variant re-rendered the scene pass without TRAA at another render-call depth, which added 31 programs (one per visible material) for the rest of a shots run. That was the "139 after dusk". The light set does not change with the time of day.

Evidence:
- `.screenshots/audit/M2-E3/mire_route/sprite-edge--80.94_5.3.json` (`edgeScan`), `packages/client/test/harness-edge-scan.test.ts` (4).
- `harness:shots` mirevale, programs per shot: 109 / 144 / 144 / 144 → 109 / 113 / 113 / 113 (peak 144 → 113, cap 128).

Affects:
- `packages/client/src/harness/{edgeScan.ts (new),stage.ts,HarnessWorld.ts,main.tsx}`
- `packages/client/scripts/harness/shots.ts`
- `packages/render/src/stage/battleStage.ts` (`inspectedBillboard`)

## 2026-10-06 — `50-verification-budget.md` §50.4.7 `handover-hitch.spec.ts` row — the spec exists; its millisecond limits are asserted on the reference GPU only
Why: §50.4.7 listed the spec, but it did not exist. It can now run: the harness world crosses zones the way World3D does, with the neighbour skirt and the handover keep.

The 250 ms / 33 ms / 1 500 ms limits are reference-machine numbers (§50.2). The dev iGPU spends seconds on a zone's phase-1 compile, so asserting them there would only record a known gap as a failure.
Evidence: `packages/client/test/handover-hitch.spec.ts`; the measured numbers are in client IMPLEMENTATION-NOTES Phase E3.
Affects: `packages/client/test/handover-hitch.spec.ts` (new), `packages/client/src/harness/{HarnessWorld.ts (handover, backgroundCompile),main.tsx}`.

<!-- 2026-10-06 Phase E1 + E2 (density pass, M3 shot set, the re-landed art pass). -->

## 2026-10-06 — `50-verification-budget.md` §50.6.1 — from M3 on every zone takes all six audit rows, with recorded fallback anchors where a zone lacks the row's subject
Why: Phase E1. §50.5 M3 asks for "6 shots each, 126 files", but the §50.6.1 table names only `mirevale` and `mire_route`, so `harness:shots` / `harness:budget` refused the other 19 zones ("no §50.6.1 shot belongs to zone …"). Towns have no encounter table, story zones no gym or shop, several zones no east link; a rule per gap keeps every shot reproducible from committed data.
Evidence: `packages/client/src/harness/shotTable.ts` (`shotsForZone(zone, set)`, `TABLE_SETS = ['M2']`), `anchors.ts` (`tableAnchor` + `fallbackAnchor`), `stage.ts` (a fallback may turn the heading), `scripts/harness/{common,shots,budget}.ts` (`--set`); `packages/client/test/harness-anchors.test.ts` (all 21 zones resolve six walkable anchors; the slice's M3 anchors equal its M2 anchors; link fallbacks look at their edge).
Affects: `harness:shots -- --set M3`, `harness:budget -- --set M3`; the M2 set and its committed shots are unchanged.

## 2026-10-06 — `10-render.md` §10.5.4 — the Phase E1 dressing pass (walk-through verge / scree / shard cover, house skirts inside the collider pad, a boundary with gate piers for every town biome)
Why: Phase E1, the user's "all towns as good as Mirevale". The 21-zone smoke (2026-10-06, before) showed every town but Mirevale spawning at (−50, 0) on a bare road 50 m from its plaza (content's spawn), routes as a road through sparse tufts, barren biomes as bare ground with bright-green tufts, and towns without a boundary except the grove / forge / capital walls. Content owns every solid (the heightfield and the server's movement are stamped from its plan), so the render-side pass may only add cover a player wades through, dressing inside a building's footprint pad, and dressing outside the walkable square.
Evidence: `packages/render/src/zone/generators/dressing.ts`, `zone/builder.ts` (verge / rock / scree cover into the existing kinds, `crystal_shard`, per-biome tuft tints, `dressBoundary` for wall / fence / rocks with piers, house skirts); `packages/render/test/dressing.test.ts`; client `footprints.test.ts` unchanged (builder footprints still equal content's); before / after smoke and `.design/audits/M3-render-audit.md`.
Affects: every zone's geometry digest (no test pins a digest); spawn-view triangles +4–150 % (max 0.88 M; 1.44 M worst over the 126 M3 shots), beauty draws +0–19 (one `crystal_shard` kind in shrine / rift), materials unchanged, programs +0–2 (the casting `tall_grass` bush in salt); `harness:budget --set M3`: 0 count violations in all 21 zones (`.design/audits/M3-render-audit.md` §2).

## 2026-10-06 — `10-render.md` §10.3.3, §10.3.4, §10.3.5, §10.3.7, §10.8.1–§10.8.3; `50-verification-budget.md` §50.2.1 — the M2 re-light re-landed: sun path with sunrise 0.17 / sunset 0.83 and the moon on its own path, a warm key over a low normalised hemisphere fill (`hemi` column), fog with a 15 m clear zone (density 0.00486), golden-hour fog tint, zero-mean `GrainNode` 0.052
Why: Phase E2. The art pass written for audit findings M2-spawn-noon-2 (compressed tonal range: 16 % fog at the focus, hemisphere 0.18 + env 0.85 washing out the key), M2-gym-dusk-2 / M2-lamps-night-5 (t 0.80 had the sun 21.6° below the horizon, the moon mirrored the sun so night shadows matched day's) and M2-spawn-noon-13 (FilmNode only brightens: +2.1 % exposure, reduced effects changed the exposure) was snapshotted in `a6606df` / `aa19fa1` and reverted with them in `3f12cf0`; it never reached the SPEC. Re-landed unchanged in substance (dates moved to 2026-10-06); `lighting/`, `zone/palettes.ts` and `post/` had not changed since the revert, `camera/rig.ts` was never part of it.
Evidence: `packages/render/src/lighting/{daycycle,fog,rig}.ts`, `zone/palettes.ts`, `post/grain.ts`, `post/pipeline.ts`; tests `daycycle.test.ts` (table, sun / moon paths, switch fade, daylight / golden), `lighting.test.ts` (fog clear zone: 5.2 % at the 26 m focus, 20–48 % on the skirt), `post-graph.test.ts` (GrainNode in the graph, zero mean), `stats-dispose.test.ts` (hemisphere at the `hemi` level, unit sky, weather pulls the clear zone in); re-shot `.screenshots/audit/M2/`.
Affects: every lit frame; the server's gameplay day (`isDay`, spawn tables) is unchanged; client tests unaffected.
<!-- 2026-10-06 animated legendaries: the user approved restoring the animation of the 10 legendaries / mythicals (GIF / animated WebP in the original game, frozen on their frame-select page in the rebuild) under a separate budget of about 20 MB. Four entries, newest on top. -->

## 2026-10-06 — `20-client.md` §20.10.3 — phase 3 also loads the flipbooks of the zone's legendary statics and of animated party members
Why: the client binds a species' flipbook atlases with its static atlas so the creature plays from the first frame it is shown; the phase-3 payload grows by 0.64–1.81 MB per animated side where such a species is present (none in Mirevale, so the first-frame budget measured there is unchanged).
Evidence: `packages/client/src/scene/World3D.ts` `bindZoneAtlases` (content `staticsFor(zoneId)` + party via `speciesAtlases`), `ensureSpecies`; `tools/sprite-pipeline/qa/anim-report.json` (bytes per side).
Affects: `packages/client/src/scene/{World3D,spriteCatalog}.ts`, `harness/HarnessWorld.ts`; `galvan_route` (raikitsune + voltaura) adds ≈ 4.7 MB to a phase that was already over 4 MB there (R12).

## 2026-10-06 — `10-render.md` §10.4.1, §10.4.2, §10.4.5, §10.4.6 — `SpriteFrame.anim` (`SpriteAnim`), `AnimAtlasSet`, `SpritePool.bindAnimAtlas`; the billboard plays a flipbook by rewriting its per-object `rect` on a page change; per-object `dissolveCells`
Why: the animated legendaries must play wherever they appear (overworld spawns and statics, battle, inspector) without costing a program, a material switch or a draw call while playing; the per-object rect the static frame already uses is the one write a page needs. The flipbook holds while fainted so a fainting creature dissolves still. The dissolve hash keyed on atlas uv would cut 3 × 2-texel holes in a 6-column anim atlas; `dissolveCells` keeps holes at 1/512 of the cell on both kinds of atlas (static atlases and singles keep 1024 per uv: no change there).
Evidence: render IMPLEMENTATION-NOTES Part 8 (sandbox A/B, flipbooks off → on: lineup of 10 legendaries 235 → 235 draw calls, 110 → 110 programs, 15 → 15 materials; battle zenryu vs raikitsune 359 → 359 draws, 114 → 114 programs, the billboard program's code identical on static and anim materials; frame sequences in the inspector and in battle; the foe's page held through its faint); `test/flipbook.test.ts` (timing from the delays, per-instance phase, static frame until the anim atlas lands then one re-point, one material per anim atlas, rect writes only on a page change, ≤ 64 KB heap over 3000 frames with 20 flipbooks, pause on faint pose and `setFaint`, hitstop holds, `setFacing`, the anim atlas texture contract); `test/sprites.test.ts`, `evolution.test.ts`, `stage.test.ts` unchanged and green.
Affects: `packages/render/src/{contracts,index}.ts`, `sprites/{atlas,billboard,tables}.ts`, `stage/battleStage.ts` (`sameFrame` compares the flipbook atlas), `sandbox/part3.ts` (`?demo=legends`, `&mine=&foe=`, `&anim=0`); the client adapter maps the manifest's `anim` (40-pipelines.md §40.1.5).

## 2026-10-06 — `40-pipelines.md` §40.6 — new line `creatures/anim/` ≤ 24 MiB (measured 24.49 MB); `creatures/` measures everything but `anim/`; the `public/` total 219 → 243 MiB
Why: the user approved a separate budget of about 20 MB for the animated legendaries; the flipbooks cannot fit in the 35 MiB static line (0.50 MB headroom). The static line keeps its exact meaning: the manifest bytes the anim fields add are charged to the anim line (`animTotalBytes`), so `totalBytes` and the static manifest are byte-identical to before.
Evidence: `tools/sprite-pipeline/test/budget.test.ts` (`totalBytes` = static files + the static manifest; `animTotalBytes` = `anim/` + the manifest's anim share = 24 487 809 B ≤ 25 165 824; their sum = every byte on disk); `tools/asset-audit --bytes` (`creatures/anim/` line from `creaturesAnimShare`, which re-serialises the manifest without its anim fields; `rules.test.ts`); measured ladder 32.92 → 24.49 MB in `qa/anim-report.json`.
Affects: `tools/asset-audit/src/bytes.ts` (`CEILINGS.creaturesAnim`, `total` 243 MiB), `tools/sprite-pipeline/src/types.ts` (`ANIM_BUDGET_BYTES`), the README tables.

## 2026-10-06 — `40-pipelines.md` §40.1.1, §40.1.3, §40.1.5, §40.1.8 (new) — multiframe sources are animated: every page ships as a 512²-cell flipbook on the static frame's normalisation; `frame-select.json` picks the static frame; the manifest gains `sprites[id].anim`, `animAtlases`, `animTotalBytes`
Why: the 10 legendaries and mythicals animated in the original game and were frozen on page 0. One shared transform per side (the static cell's own, applied to the union crop of all pages) means no jitter or slide between pages and no jump between the static frame and the flipbook; normalising the union to its own 0.86 fill would have shrunk galaxion back by 11 % and lifted its feet. The 512 cell is ≈ 1:1 with the legendaries' 430–561 px battle height. The static ladder's bottom rung was still 25.38 MB, so the anim ladder extends it (normal first). The anim cache stores true-colour PNGs because the static cache's `png({ effort })` palette-quantises with dithering, which would re-dither each page differently.
Evidence: `tools/sprite-pipeline/qa/anim-sheet.png`, `qa/anim-report.json` (508 pages; every static page's bottom at row 470 = round(0.92 × 512) − 1; q80/q80 24.49 MB); `test/anim.test.ts` (fixture: pages per side, foot line ± 1 texel, zero jitter below a moving part, a bobbing page moves by exactly its source offset × the shared scale, static ↔ anim IoU > 0.95, the static set byte-identical to a build without animation, determinism + full cache, 16 malformed manifests rejected), `test/anim-output.test.ts` (the shipped files: pages and delays read back from every source, binary alpha in every level, foot line, union crop ± 1.5 texels, IoU > 0.95 on all 20 sides); the 910 static files hash-identical before / after the build, `serializeManifest(staticManifest(m))` byte-identical to the previous manifest, `contact-sheet.png` and `qa-report.json` unchanged.
Affects: `tools/sprite-pipeline/src/{anim,manifest,pipeline,qa,cli,types}.ts`, `README.md`; `packages/client/public/creatures/anim/` (240 files) and `creatures.manifest.json` (anim fields appended); `packages/client/src/scene/spriteCatalog.ts` (adapter).

---

<!-- 2026-10-05 evolution sequence: the user-approved design (stage it with the inspector camera, a white glow pulsing between the old and new silhouettes, a light burst and a banner; WCAG 2.3.1 flashing limits, a reduced-effects cross-fade, skip; server truth first; one sequence for every evolve path). Five entries, newest on top. -->

## 2026-10-05 — `20-client.md` §20.9.2, §20.9.3 — while an evolution plays, the open panel and the shortcut hint step aside and the evolution banner sits over the canvas; Rare Candy's `evolveReady` queues the evolve prompt from the Party screen
Why: the Party screen's "Use an item" (Rare Candy) can trigger an evolution while the 1120 px panel covers most of the canvas; the sequence is the moment, so the panel fades out (`visibility: hidden`: nothing in it takes focus or clicks) and returns where it was.
Evidence: `packages/client/src/app/PlayShell.tsx` / `PlayShell.module.css` (`data-evolving`), `world/EvolutionBanner.tsx`; `test/evolution.test.tsx` (the Rare Candy path queues the prompt and plays the sequence).
Affects: `packages/client/src/app/PlayShell.*`, `world/EvolutionBanner.*`; the shell hotkeys ignore keys while `ui.evolution` is set.

## 2026-10-05 — `20-client.md` §20.5.6 — evolving plays the evolution sequence after the server confirmed it: `evolveCreature` (REST → inventory writer → `playEvolution`), input locked with click / Space / Enter / Escape to skip, the DOM banner from the reveal, the next prompt after it
Why: an evolution was a confirm modal, a REST call and a toast — the creature just swapped. Server truth first keeps the game from showing an evolution that did not happen; one entry point (`app/evolution.ts`) serves the post-battle prompt, Rare Candy and future stones / trades.
Evidence: client IMPLEMENTATION-NOTES Part 6; `test/evolution.test.tsx` (a failed call plays nothing and keeps the prompt; a confirmed one plays the response's species after the response; Rare Candy and post-battle paths; the banner; `EvolutionDirector` locks input and the HUD during the sequence and restores them after, skip keys swallowed, phase callbacks deferred off the tick).
Affects: `packages/client/src/app/evolution.ts`, `scene/EvolutionDirector.ts`, `scene/World3D.ts` (`worldBlocked`, the avatar faces the creature), `world/PostBattlePrompts.tsx`, `state/ui.ts` (`evolution`); the success toast is replaced by the banner.

## 2026-10-05 — `10-render.md` §10.7.5 (VFX table) — sequence effects: the evolution sequence's recipes (`evolve_motes`, `evolve_converge`, `evolve_burst`; reduced `evolve_motes`, `evolve_reveal`) spawn into the pooled emitters outside the 47-id table
Why: the sequence needs rising sparkles, a converge and a burst in the new form's type colour; adding `VfxId`s would change the client's MOVE_ANIMS contract and the 47-id count for effects no move uses.
Evidence: `packages/render/src/stage/evolution.ts` `evolutionRecipes`, `VfxSystem.spawnRecipe`; `test/evolution.test.ts` (every phase ≤ 512 particles; the reduced set has no burst motion and no ring cards); sandbox frames (render IMPLEMENTATION-NOTES Part 7).
Affects: `packages/render/src/stage/vfx.ts` (`spawnRecipe`, `SequenceVfxRecipe`); `VFX_IDS` and the `VfxId` union unchanged.

## 2026-10-05 — `10-render.md` §10.7.5 — `BattleStage.evolve(request)`: the evolution sequence (inspector camera push-in, world dim, white glow alternating old / new silhouettes at ≤ 3 Hz, light burst, cheer, cleanup), with a reduced-effects cross-fade and skip
Why: the user approved a proper evolution moment in the HD-2D style; it must never exceed 3 flashes per second (WCAG 2.3.1), must cross-fade under reduced effects, must not change the light set or compile programs mid-sequence, and must give everything it borrows back exactly.
Evidence: render IMPLEMENTATION-NOTES Part 7 (sandbox frame sequences day / night / reduced / skip; 0 new programs during a sequence; max 5 swaps per second, ≥ 214 ms apart); `test/evolution.test.ts` (timing, WCAG proxy, reduced path, atlas gate, skip, cancel by `dress`, exact restore of camera, beacon, post, site and bindings).
Affects: `packages/render/src/stage/{evolution,battleStage,wiring}.ts` (`Stage.armWarmupShadows`, the beacons' shadow pass compiled in the step-8 warm-up frames), `camera/rig.ts` (`inspect(aim, ms, distance?)`, `dollyShot`), `contracts.ts` / `defaults.ts` (`EvolutionRequest`, `EvolutionHandle`, `EvolutionPhase`), `sandbox/part3.ts` (`?demo=evolve`).

## 2026-10-05 — `10-render.md` §10.4.5 — the billboard graph gains the per-object `glow` (white silhouette for the evolution sequence); `CreatureBillboard` gains `setGlow`, `setShown`, `setSizeMul`; the warm-up's neutral set is filterable like the atlases
Why: the hurt flash mixes the lit albedo only 85 % toward white, which reads grey at dusk; the evolution needs a glowing white silhouette of the card's own alpha at any time of day. In the one billboard program from boot, it costs no program at sequence time. The warm-up's neutral set had Nearest min + mag, which three 0.186 compiles as an unfilterable `textureLoad` variant — a program no atlas uses — so the first creature drawn (or a sequence in a zone without wild creatures) compiled the atlas variant; it now has a linear min filter.
Evidence: `packages/render/src/sprites/billboard.ts`, `tables.ts` (`BILLBOARD.glowGain` 1.3), `atlas.ts` (`neutralAtlasTextures`); sandbox (render IMPLEMENTATION-NOTES Part 7 E6): with no creature on screen before the sequence, 4 new programs before, 0 after; boot programs 111 → 107; `test/evolution.test.ts` (the neutral set is filterable like the atlases).
Affects: every billboard writes `glow = 0` (no visible change outside the sequence); the neutral placeholder is sampled linearly when minified (4 × 4, one level: no visible change).

<!-- 2026-10-06 Phase E4 (CC0 audio, the no-download half). -->

## 2026-10-06 — `40-pipelines.md` §40.4.8 (new) — CC0 ingest: `sources.json` → raw cache with salted request hashes, stem derivation for single-track themes, linked gain + no re-roll for CC0 clips in `process`, optional `derived` theme field in the output manifest, generated credits
Why: Phase E4. The user chose CC0 packs (orchestral/adventure) over the paid provider, so §40.4.2's `generate` has no input. CC0 tracks rarely ship four stems. Two options were weighed:
- Single-stem themes in the client would silence `threat` and `night` for every CC0 theme.
- Deriving the three layers from the base track keeps the four-stem contract of `20-client.md` §20.7.3 / §20.7.4 untouched.

Derivation needs two rules in `process`:
- Derived layers must keep the levels the ingest gave them. Independent −16 LUFS normalisation would turn a −10 dB air layer into a coherent doubling of base.
- A fixed file cannot be re-rolled.

The request-hash salt is appended only for CC0 jobs, so no existing hash moves.
Evidence: `tools/audio-pipeline/test/ingest.test.ts`, synthetic fixtures only, no downloads:
- re-ingest is a cache hit; an edited file re-ingests exactly its jobs
- the four stems are equal-length and periodic, with layer levels at the recipe ±0.5 dB
- `process --provider cc0` builds a complete manifest with one shared loop at nominal ± 5 ms
- missing files are reported, not thrown

`packages/client/test/audio-stems.test.ts`: a derived layer is never played without its base; a theme with fewer than four layers starts what exists. Implementation notes: `tools/audio-pipeline/IMPLEMENTATION-NOTES.md`, "Phase E4 ingest".
Affects:
- `tools/audio-pipeline/src/{sources,ingest,credits}.ts` (new)
- `jobs.ts` (salted `requestHash`, `CacheRecord.source`), `process.ts` (fixed sources, linked gain), `output-manifest.ts` (`ThemeEntry.derived`), `plan.ts`, `cli.ts`
- `packages/client/src/audio/manifest.ts` (`DerivedStem`, optional `derived`)
- `AudioDirector.ts`: tolerant `startTheme`; a generation token fixes the pre-existing double start on the first gesture
- `SettingsScreen.tsx` (audio credits link)
- `.design/audio/sources.json`, `.design/audio/sources.candidates.md`, `assets-src/audio/{CREDITS.md,licenses/}`, `packages/client/public/audio/CREDITS.txt`, `.gitignore` (`assets-src/audio/cc0/`)

`20-client.md` §20.7.4 is not edited. The new field is optional and specified in §40.4.8; restating the `AudioManifest` block would break the one-definition rule (§50.7 rule 5).

<!-- 2026-10-06 Phase D14 (post-game: league rematches, battle tower). -->

## 2026-10-06 — `00-spine.md` §2.9 `BattleState.noExp` + `capLevel`, §3.3 post-game block (`LeagueRematch`, `LEAGUE_REMATCH`, cooldown, `leagueRematchFlag`, `POSTGAME_FLAG`, `TowerDef` / `TOWER`, `towerTier`, `towerSetReward`, validate rules), §3.13 InteriorNpc role `tower`, §4.3 `TowerMsg` / `CLIENT_MESSAGES.tower` (24 keys) / rate limit, §4.4 `towerState` (18 variants), §4.7 `/leaderboard?mode=towerStreak`, §5.1 `BattleStartSnapshot.noExp`, §5.2 `StreakRepo` + `Repos.streaks`; `30-server-netcode.md` §30.4.4 league rematch row, §30.4.9 battle tower (new), §30.6.3 leaderboard `towerStreak`, cut list (league rematches removed); `20-client.md` §20.9.9c post-game (new) — league rematches after the Champion, the battle tower, the tower leaderboard
Why: Phase D14 post-game. After `champion:zeon:beaten` the league had nothing left to fight and the cut list deferred rematches; the D14 brief asked for Lv 65–75 rematch teams at ×1.5 reward with a 1-day cooldown (mirroring `TrainerDef.rematchDays`' use of the flag's set time, `progress.flagSetAt`) and a battle tower (3v3, Lv 50 cap without mutating stored creatures, seeded opponents by streak tier, heal between fights, sets of 7 with rewards, loss ends the run, persisted current / best, a leaderboard mode). Rematch cooldown flags are cleared and re-set on each win because `setFlags` is insert-or-ignore (the set time would otherwise stay at the first win). The tower's level cap needed a core rule: a capped creature at Lv 50 would still gain exp and could level past the cap mid-fight, so `BattleState.noExp` suppresses exp for the battle (absent = byte-identical, so the 1,000-battle fuzz digests are unchanged). The attendant is an interior NPC (league hall foyer), not a `ZoneDef` NPC: zone NPCs feed the layout RNG and would move Solenne's plan, fixture and heightfield.
Evidence: `packages/content/src/data/league.ts` (`LEAGUE_REMATCH`), `data/tower.ts`, `data/interiors.ts` (`solenne.league.tower`), `validate.ts`; `packages/core/src/battler.ts` (`capLevel`), `engine.ts` (`awardExp` gate), `turn.ts` / `doubles.ts`; `packages/persist/drizzle/0004_player_streaks.sql`, `src/repos/streaks.ts`; `packages/server/src/rooms/towerSession.ts`, `battleSession.ts` (`startTower`, rematch + tower branches of the end transaction), `ZoneRoom.ts` (`leagueBeaten`, rematch cooldown, `onTower`), `rest/routes/catalog.ts`; `packages/client/src/world/TowerModal.tsx`, `scene/dialogue.ts` (`rematchOffer`, `rematchOfBattle`), `screens/RankingsScreen.tsx`.
Affects: `packages/core/test/tower.test.ts`, `packages/content/test/postgame.test.ts`, `packages/persist/test/streaks.test.ts` + `migrations.test.ts`, `packages/protocol/test/payloads.test.ts` + `server-messages.test.ts`, `packages/server/test/postgame.test.ts`, `packages/client/test/postgame.test.tsx` + `dialogue-flow.test.tsx` (Zeon after the title now offers the rematch) + `rankings-profile.test.tsx`.

<!-- 2026-10-06 Phase D12 (guided tutorial) + D13 (ranked queue). -->

## 2026-10-06 — `00-spine.md` §4.3 `RankedQueueMsg` / `CLIENT_MESSAGES.rankedQueue` (23 keys) / rate limit, §4.4 `rankedStatus`; `30-server-netcode.md` files table `rooms/matchQueue.ts`, §30.4.4 `pvp` start, §30.4.5a (new) ranked queue; `20-client.md` §20.9.2a (new) tutorial, §20.9.9b (new) rankings + ranked queue — Prof. Wynn's guided tutorial and a cross-shard ranked queue
Why: Phase D12 + D13. Tutorial: the Act I opening had no guidance; it is client-side only — a step card driven by events the client already observes (walked metres from the authoritative avatar, `met_wynn` from the first_witness beat, the party panel, a wild battle, a catch, a win, a heal), so no story beat `need` / `set`, flag or message changes and the progression walker's legs are untouched; per-account progress in localStorage (`ewa.tutorial`), never shown again once done or skipped, and marked done on sight for any account past the opening (a badge or a post-`mire_rival` story flag). Ranked: pvp was challenge-only between players standing within 12 m. The queue is presence-keyed (a Colyseus presence hash), so it spans zones, shards and processes and survives crossings; one leased matcher pairs within a window that widens (±100, +50 per 10 s, cap 400) and checks both players' windows so a fresh joiner is never thrown at a far rating. Matched players reach one arena room through the existing handover path (Phase C3 `seatHandover`, now able to target a named room) or a teleport when already there; the battle is the ordinary `pvp` format, so Elo applies once per player through the existing §30.4.4 path (no new format, no new persist column). Mirevale hosts the arena because it is the only ungated town: Solenne (the brief's first suggestion) is gated by `ascend` and would refuse most players' seats.
Evidence: `packages/protocol/test/payloads.test.ts` (rankedQueue payloads, 23 keys, limit row, `rankedWindow` 100 / 150 / 250 / cap 400), `server-messages.test.ts` (rankedStatus example, 17 variants); `packages/server/test/ranked.test.ts` (pure `pairUp`: within / outside the window, widening for both players, cap, oldest-first closest-gap, outlier stays; arena spots walkable; `RankedArena`; live: `party` and `busy` refusals, idempotent join keeps the wait, leave and a disconnect drop the entry, a mire_route + a mirevale player matched — the far one handed over into the near one's room, the near one teleported, battle only after the handover ack, side 0 = the longer wait, both `idle / started`, a forfeit applies `eloDelta(1000, 1050)` once per player (battleEnd, players.rating, two battle_history rows), a matched player who never arrives → the other gets `cancelled` after 20 s and can re-queue, a 240 gap waits until 30 s widen the window while a 2 400 outlier never matches); `packages/client/test/tutorial-ranked.test.tsx` (steps advance on walk / met_wynn / party panel / wild battle / catch-as-win / heal; hidden under panels and battles; skip persists and survives a rehydrate with no closing toast; never shown for a `bloom` account; per account; RankedPanel join / queued elapsed + window / leave / matched + toasts / fainted party disabled / stale match idle / reset on room end); server authority, challenge-trade, fast-travel, world, zone-room, stores, fixes suites unchanged and green.
Affects: `@ewa/protocol` (`RankedQueueMsg`, `RANKED_WINDOW`, `rankedWindow`, `CLIENT_MESSAGE_LIMITS.rankedQueue`, `rankedStatus` + `RANKED_STATES` / `RANKED_IDLE_REASONS`), the server (`rooms/matchQueue.ts`, `ZoneRoom.ts` `onRankedQueue` / `onRankedMatch` / `onRankedCancel` / `rankedPass` / `startRanked`, `seatHandover(…, roomId?)`, queue drop on a real leave and on any battle start; `deps.ts` `Runtime.matchQueue`; `server.ts` matcher timer; `rateLimit.ts` `rankedQueue`), the client (`state/ranked.ts`, `screens/RankedPanel.tsx` in `RankingsScreen`, `net/messageRouter.ts`; `state/tutorial.ts`, `world/TutorialCard.tsx` in `PlayShell`, `noteTutorialEvent('healed')` in `app/actions.ts` and `scene/World3D.ts`). Not done: a dedicated arena set-piece (the players meet on Mirevale's east green); no team preview for ranked (spine §4.5 stands); casual challenges still move rating as before (every `pvp` battle is rated).

<!-- 2026-10-06 Phase D8–D11 (world systems: surf, fishing, Cut / Strength, bike). -->

## 2026-10-06 — `00-spine.md` §2 items (Phase D1–D3 table), §3.1 `ZoneDef.obstacles` + `ObstacleDef` + Obstacles rules, §3.2 `EncounterSlot.medium`, §3.11 (interiors amendment), §4.1 `PlayerState`, §4.3 `InputMsg.bike` / `InteractMsg` kinds / `FishMsg` / 22 keys / limits; `10-render.md` §10.5.1 `ZoneSpec.obstacles` / `ObstacleSpec` / `ObstaclesHandle` / `ZoneHandle.obstacles`, §10.6.1 surf mode (`passable(…, surf)`, `onWater`, `waterLevel`, `surfaceY`, `nearestPassable(…, surf)`), §10.6.2 surf heights, §10.7.7 grounding (water ride + ripple); `20-client.md` §20.4.5 bike binding, `MOVEMENT.bikeSpeed`, `MoveInput.bike`, collider adapter surf / obstacles, Fishing, Obstacles; `30-server-netcode.md` §30.2.4 bike cap / cleared obstacles / surfing + biking writes, §30.3 Fishing, §30.4.6 `obstacle` interact — surf, fishing, Cut / Strength obstacles and the bicycle
Why: Phase D8–D11. Surf: the server already accepted water for HM Surf holders but the client predicted none of it and rubber-banded; render's collider gains the surf term the spec named (`resolveMove(…, surf)`) plus the body level, so a surfer floats on the water mesh's plane, and everyone on open water rides it (remote surfers included: only a surfer can stand there). Fishing: the Old Rod (Phase D1) finally does something; the bite is server-authoritative (its own seeded stream, so no existing fork shifts) and engages like a spawn, and every non-lava zone with ponds and a table now fishes something (three tables gained water slots of species already placed elsewhere: the roster stays 79 directly placed / 130 obtainable / 67 families). Obstacles: shortcuts and treasure only — stamped last into the heightfield so every other zone's digest is byte-identical, re-opened per player through the same `standable` path as Phase A's gates, kept out of the layout's authored points (`plan.ts` / `heightfield.ts`) so no clearing or building moves; validate re-runs every reachability rule on the stamped field. Bike: a stateless per-message claim (`input.bike`) the server grants only to an owner standing outdoors whose segment stays on land — no mount message, no desync window; 10.5 m/s (1.5× run) with the same +15 % tolerance.
Evidence: `pnpm --filter @ewa/content run validate` (OK, 130/130, 67 families); `packages/content/test/encounters.test.ts` (water slots per zone, Water-type species, roster unchanged; obstacle stamps only walkable samples, recorded per id, disconnect nothing; zones without obstacles stamp nothing; HM / type rules; the bicycle a priced Saltmourn key item, never granted); `packages/content/test/plan.test.ts` (stamped count = footprints + obstacle cells); `packages/protocol/test/payloads.test.ts` (22 keys, `fish`, `obstacle`, `bike`), `schema.test.ts` (PlayerState fields), `movement.test.ts` (bikeSpeed, caps); `packages/server/test/world-systems.test.ts` (pure bike cap / ridden water / cleared obstacles / `rollFishing`; live surf with and without HM Surf, `PlayerState.surfing`; fish `noRod` / `noWater` / battle against a water species / `busy` / `nothingBites`; Cut `needHm` / `needType` / clear + item + flag + walk through + `alreadyCleared`; bike accepted for an owner with `PlayerState.biking`, refused for a non-owner); `packages/server/test/spawn-director.test.ts` (weight test over land slots: a water roll survives only when a position draw lands on water); `packages/render/test/world-systems.test.ts` (surf passable / level / surfaceY, resolveMove onto and off the water, 5 000 surf displacements stay passable, actor rides the level with a ripple and drops it on land, builder obstacles swap per id and change the digest); `packages/client/test/world-systems.test.ts` (FishingController catch / early / late / reduced window / cancel, `waterAhead`, StepCollider surf + obstacles, SceneDirector obstacle prompt / swap / collider push only on change, bike speed / `bike` flag / replay, KeyV); `packages/client/test/zoneSpecFor.test.ts` (snapshot: only the five obstacle zones changed).
Affects: heightfield digests of `mire_route`, `tide_route`, `deepcut_route`, `hollow_route`, `ascent_route` (obstacle stamps only; `dist/heightfields/*.json` rebuilt; every other zone byte-identical); `@ewa/content` (`types.ts`, `schema.ts`, `obstacles.ts`, `data/obstacles.ts`, `data/zones.ts`, `heightfield.ts` `obstacleCells` / `obstacleAt`, `data/encounters.ts`, `data/progressionItems.ts` `bike`, `validate.ts`); `@ewa/protocol` (`MOVEMENT.bikeSpeed`, `gaitSpeed`, `speedCap/maxStep(…, bike)`, `InputMsg.bike`, `FishMsg`, `FISH_REACH_M`, `FISH_REFUSALS`, `INTERACT_KINDS` + 'obstacle', `PlayerState.surfing/biking`); the server (`movement.ts`, `spawnDirector.ts` `rollFishing`, `interactables.ts`, `ZoneRoom.ts` `onFish` / `clearObstacle` / bike + surf writes, `rateLimit.ts` `fish`); `@ewa/render` (`terrain/collider.ts`, `terrain/field.ts` `waterBodies(h, labels?)`, `stage/actors.ts` ripple, `stage/wiring.ts`, `stage/battleStage.ts` `StageGround.surfaceY?/onWater?`, `zone/builder.ts` obstacles, `contracts.ts`); the client (`scene/collider.ts`, `LocalPlayerController.ts`, `fishing.ts`, `state/fishing.ts`, `world/FishingPrompt.tsx`, `SceneDirector.ts`, `World3D.ts`, `interaction.ts`, `input.ts`, `state/settings.ts` `bike`, `SettingsScreen` label, `zoneSpecFor.ts`, `PlayShell.tsx`). Not done: a bicycle model (a rider shows the run gait) and a surfing pose / mount (the avatar stands on the level with the ripple).

<!-- 2026-10-06 Phase D6 (double battles). -->

## 2026-10-06 — `10-render.md` §10.7.5 (`BattleStage.setBattler`, new "Doubles" paragraph); `20-client.md` §20.5.1 (doubles timeline), §20.5.4 (doubles addressing), §20.5.5 (doubles submit), §20.5.6 (doubles menu and plates) — four battlers on the stage, per-position menu with target selection, HP plates for four, one `battleAction { pos }` per position
Why: Phase D6 client/render half. Render `BattlerRef.slot` is the field position (never a party index); two battlers per side spread across the battle axis on the ring top, and hall arenas keep all four feet on the floor. The client maps core refs (party indices) to stage positions from `Side.actives` and `switchIn.pos`, so singles timelines are byte-identical. The menu picks position 0 then 1, asks for a foe / ally target only for single-target moves (spread, self and field moves need none), disables a creature the other position already chose, and sends each position's action with `pos` (the server gives position 1 its own limiter window).
Evidence: `packages/render/test/doubles.test.ts` (four distinct mirrored slots inside the ring and inside a narrow hall after `fitCentre`; singles placement unchanged); `packages/client/test/doubles.test.tsx` (target selection for single-target moves only, two picks → two `battleAction` with `pos` 0 and 1, four plates vs two, position-addressed timeline and switch-in swap); `timeline.test.ts` / `battle-controller.test.ts` unchanged and green; `pnpm typecheck`.
Affects: `@ewa/render` (`camera/battle.ts`, `stage/battleStage.ts`, `contracts.ts`), the client (`battle/BattleController.ts`, `BattleMenu.tsx` + CSS module, `BattleHud.ts`, `TimelinePlayer.ts`, `timeline.ts`, `controllerRef.ts`, `labels.ts` `badTarget`, `state/ui.ts`).

## 2026-10-06 — `00-spine.md` §2.4, §2.9, §2.10 (new "Doubles" rules), §2.19, §3.1 `TrainerDef`, §3.3 `LeagueTrainer`, §3.10 rule 3, §4.3 `BattleActionMsg`, §5.1 `battle_history`; `30-server-netcode.md` §30.4.1, §30.4.3c (new) — double battles behind `slots: 2`: `Side.actives`, `BattleState.slots`, `CreateBattleOpts.slots`, `FieldRef` move targets, `SideChoice`, spread moves (`MoveDef.spread`, ×0.75 at 2+ targets), `badTarget`, `chooseNpcDoubles` / `requiredPositions` / `validateSideChoice`; `battleAction.pos`; authored doubles (draco_gym, aurelia, five route trainers); `SPREAD_MOVES`; replay rows carry `start.slots`
Why: Phase D6 — the one step allowed to touch `BattleState`, and only behind the `slots` rule: with `slots` absent or 1 core runs the unchanged singles path and no new key appears in a singles state, so `packages/core/test/fuzz-digests.json` is byte-identical (sha256 47e764f9…, unchanged). The engine primitives that read "the foe's active" were generalised to explicit Refs with the singles call sites passing exactly the refs they computed before (same draws, same events) — the 1,000-battle fuzz proves it. Doubles gets its own committed digests (`packages/core/test/doubles-fuzz-digests.json`, 300 seeds): a diff there is a doubles semantics change and needs an entry here. Decisions: EXP is not split (as singles); the spread modifier applies only at 2+ targets and after the whole §2.14 pipeline; a fainted position with no bench stays on the field at hp 0; a replacement with fewer bench creatures than fainted positions fills the first fainted positions; doubles has no catch / flee; the server falls back to singles when the player has one usable creature (never a refusal: doubles is never a gate). Pairs of trainers fighting together are not authored (single trainers with `doubles: true` only).
Evidence: `packages/core/test/doubles.test.ts` (construction + singles shape identity, validation / targeting / retarget / ally target, spread `'foes'` / `'all'` / one target left / ignored in singles, order across four battlers + priority, switches before moves, replacement per position incl. two fainted / one bench, end, forfeit, EXP no split, Intimidate on both foes, NPC policy; the 300-seed doubles fuzz: terminates, two content instances agree, replays, committed digests); `npx vitest run packages/core` (singles digests unchanged); `packages/protocol/test/doubles.test.ts`; `packages/content/test/doubles.test.ts` (authored rows, `SPREAD_MOVES` identity with the ContentIndex, validate mutations); `pnpm --filter @ewa/content run validate`; `packages/server/test/doubles.test.ts` (doubles start + per-position play + reward / flag + DB replay; singles fallback; league doubles; `pos` absent / alreadySubmitted / switchToActive / badTarget / deadline auto-fill of the missing position; the real room with both positions' `battleAction { pos }` sent in one burst per turn at ~3 turns/s — refused before the limiter fix, accepted after — every digest = the client preview; in a singles battle alternating `pos` buys no extra window); `pnpm test:progression progression-halls` (draco_gym and aurelia won as doubles by the walker through the real room); `packages/server/test/battle-room.test.ts` (draco_gym and aurelia play as doubles, desync 0, replay from the row).
Affects: `@ewa/core` (`types.ts`, `engine.ts`, `effects.ts`, `turn.ts`, new `doubles.ts`, `npc.ts`, `index.ts`), `@ewa/protocol` (`BattleActionMsg.pos`, `FieldRefSchema`, move `target`, `SideSchema.actives`, `BattleStateSchema.slots`), `@ewa/persist` (types only: `Action.target`, `ReplayChoice`, `BattleStartSnapshot.slots`), `@ewa/content` (`TrainerDef.doubles`, `LeagueTrainer.doubles`, schema + validate, `data/spreadMoves.ts`, `data/zones.ts` `doubles(…)`, `data/league.ts`), the server (`battleSession.ts` `actionAt` / `autoPair` / `mustActSides` / `open(…, doubles)`, `ZoneRoom.onBattleAction` passes `pos`; `ZoneRoom.dispatch` + `LIMITS.battleActionPos1`: a doubles position-1 `battleAction` has its own 4 / 1 s window — the per-turn burst of two was being dropped by the shared window, a real client bug found by the walker), the progression walker (`test/walker.ts` sends one action per position).

<!-- 2026-10-06 Phase D4 (shinies), D5 (achievements), D7 (overworld weather). -->

## 2026-10-06 — `00-spine.md` §2.9; `10-render.md` §10.3.6; `30-server-netcode.md` §30.1 env, §30.2.8 step 1b, §30.4.3a (new) — overworld weather: a seeded per-biome schedule writes `ZoneState.weather`; `CreateBattleOpts.weather?` (ambient, turns 0); wild / trainer / league battles outside interiors start under it
Why: Phase D7 asked for overworld weather that matters in battle. Ambient weather never counts down (turns 0, no weatherTick) so a zone's rain lasts the fight; a move's weather still replaces it for 5 turns. Halls are indoors (`interiorAt` → none), PvP and raids get none (rating fairness). The new core input is optional and absent/'none' leaves state and events byte-identical, so the 1,000-battle fuzz digests do not move. `WORLD_WEATHER` ('on' default; testEnv 'off') keeps every existing room test independent of the wall clock.
Evidence: `packages/core/test/weather-ambient.test.ts` (absent ≡ 'none' digest + events; ambient start event; no countdown, sand chips every turn; a move replaces it for 5 turns); `npx vitest run packages/core` (fuzz digests unchanged); `packages/server/test/weather.test.ts` (pure schedule: determinism per bucket, biome weights ±5σ over 4 000 buckets, differs by zone and seed; the room writes the schedule and follows a bucket change; a wild battle in the open starts under the zone weather and records it in `start.weather`; one inside a pocket starts with none); `packages/client/test/interiors.test.ts` "Phase D7" (renderer weather outdoors, none in a pocket and during a battle, restored after both); `packages/client/test/timeline.test.ts` (ambient `weatherSet` reads as already falling).
Affects: `@ewa/core` (`CreateBattleOpts.weather`, `createBattle`, end-of-turn countdown guard), `@ewa/persist` (`BattleStartSnapshot.weather?`), the server (`game/weather.ts`, `ZoneRoom` tick step 1b + `BattleDeps.weather`, `env.WORLD_WEATHER`), the client (`SceneDirector` overworld weather / pocket suppression / restore after battle, `timeline` ambient text).

## 2026-10-06 — `00-spine.md` §3.4, §5.2; `20-client.md` §20.9.9a (new); `30-server-netcode.md` §30.4.3b (new) — achievements: 30 `QuestDef { kind: 'achievement' }` rows appended to `QUESTS`; objective kinds `dexCaught`, `catchTier`, `completeTrades`, `clearRaids`, `loginStreak`; events `dex`, `raidClear`, `streak`, `catch.isAlpha/isShiny`; journal Achievements tab
Why: Phase D5 asked for dex rewards and achievements through the existing quest path, so they auto-progress and claim through `POST /quests/claim` with no new route or table. Tiers do not chain (`requires: []`) so every tier counts from the first event; `dexCaught` and `loginStreak` are absolute (max-merged) so progress made before the achievement existed is picked up by the next event.
Evidence: `packages/content/test/achievements.test.ts` (30 rows, ids ≤ 48, giver null / requires [] / money-items only, coverage of every named family, the statics and league ids equal content's, validate green); `packages/content/test/counts.test.ts` (12 story + 30); `pnpm --filter @ewa/content run validate`; `packages/server/test/achievements.test.ts` (targets / absolute maths; battle catch → first catch + alpha + shiny + dex count; KO win → wins; max-merge never lowers, equal writes nothing; trade / raidClear events; daily login day 7 → `ach_streak_7`; REST claim once, 409 before done / after claim); `challenge-trade.test.ts` and `raid.test.ts` "Phase D5" lines (end-to-end trade and raid sources); `packages/client/test/achievements-shiny.test.tsx` (model helpers, hint exclusion, the Achievements tab claim); `rankings-profile.test.tsx` (profile lists achievements, `0 of 30 earned`).
Affects: `@ewa/content` (`types.ts` `QuestObjective` + `QuestKind`, `schema.ts`, `data/achievements.ts`, `data/quests.ts`, `validate.ts`, `ACHIEVEMENTS` / `STORY_QUESTS` / `isAchievement` exports), `@ewa/persist` (`progressRepo.caughtCount`), the server (`game/quests.ts` `target` / `absoluteValue` / `matches`, battle / raid / trade / login emitters, `DailyLoginGrant.questProgress`), the client (`data/quests.ts`, `QuestScreen` tabs, `ProfileScreen` achievements, `questHint`).

## 2026-10-06 — `00-spine.md` §2.8, §4.1, §4.7, §5.1, §5.2; `10-render.md` §10.4 `SpriteDescriptor`, §10.7.5 `VfxId`; `20-client.md` §20.9.5, §20.9.9, §20.9.9a; `30-server-netcode.md` §30.3 — shinies: a 1/512 tier read from the alpha draw's low bits (no extra draw), persisted (migration `0003_shiny`), on the wire as optional fields, sparkling billboards + the `shiny_sparkle` burst, Dex marker + filter, market filter
Why: Phase D4. The roll must not shift the seeded spawn stream: `next()` is `u32 / 2^32`, so `u32 mod 512 === 0` on the alpha draw is exactly 1/512 and independent of the alpha threshold. `isShiny` is present only when true on every creature shape, so non-shiny payloads, rows and battle states keep their exact pre-D4 shape. The sparkle rides the existing `alphaGlow` per-object value (+2) — no new uniform; the burst is the one VFX id beyond the 47 (48).
Evidence: `packages/server/test/shiny.test.ts` (1/512 over 512 000 draws ±5σ and the same among alpha-passing draws; 40 000 director spawns ±5σ; the pre-D4 fields of 3 000 seeded spawns hash to the value captured from the pre-D4 director; shiny spawn → shiny battler → catch persists `is_shiny` + `shiny_caught`); `packages/persist/test/shiny.test.ts` (0003 columns; round-trip with the key absent on normal creatures; dex shiny never cleared; listing denormalises and the search filters); `packages/protocol/test/shiny.test.ts`, `schema.test.ts` (field order, `isShiny` last); `packages/render/test/sprites.test.ts` (alphaGlow 2 / 3; setVariant keeps / clears), `stage.test.ts` (48 ids); `packages/client/test/achievements-shiny.test.tsx` (Dex marker and `?state=shiny`; timeline burst on a shiny switch-in).
Affects: `@ewa/core` (`CreatureInstance.isShiny?`), `@ewa/persist` (three columns, migration `0003_shiny` + snapshot, `markCaught(…, isShiny)`, `DexSummary.shiny`, `ListingView.isShiny`, `MarketQuery.isShiny`, `ClosedListing.isShiny`), `@ewa/protocol` (`CreatureInstanceSchema`, `SpawnState`, `ListingViewSchema`, `MarketQuery`, `DexRes`), `@ewa/render` (`SpriteDescriptor.isShiny?`, `paletteFor(…, isShiny)`, billboard sparkle, `CreatureBillboard.setVariant(…, isShiny?)`, `VFX_SHINY_IDS`), the server (`shinyFromDraw`, `SHINY_ODDS`, `SpawnRecord.isShiny?`, creatures / battle / trade / market / evolve dex writes), the client (`SpawnViews`, `spriteCatalog`, `World3D`, `BattleController` `shinyOf`, `timeline` `SHINY_MS`, `DexScreen`, `MarketScreen`, `ListingDetail`, `CreatureCard` `shiny` badge, session `dexShiny`, icon `sparkle`).

<!-- 2026-10-06 Phase D1–D3 (story grants, TMs + move tutor, evolution stones + trade evolutions). -->

## 2026-10-06 — `00-spine.md` §3.5 — `StoryBeat.grant?: Record<itemId, qty>`: HM Cut at `bloom_after`, Old Rod at `drowned_harbour` (Maren), HM Surf at `current_after`, HM Strength at `fault_after`
Why: the HMs and the rod were content with no way to obtain them; the beat that hands them over is the natural moment. Optional field, so every other beat is byte-identical; a grant is never a gate (nothing `need`s an item).
Evidence: `packages/content/test/progression-items.test.ts` "D1" (grants, key items, no gate, mutation: unknown grant item fails validate); `packages/server/test/tms-evolution.test.ts` "D1" (`completeBeatInTx` adds the items once and returns absolute counts; the room sends the `inventoryDelta` with Maren's beat completion; a second talk grants nothing).
Affects: `@ewa/content` (`StoryBeat`, `StoryBeatSchema`, validate), the server (`completeBeatInTx` takes `inventory`, returns `items`; `ZoneRoom` and `battleSession` forward them as `inventoryDelta`).

## 2026-10-06 — `00-spine.md` §2.6, §3.1, §4.7 — 39 reusable TMs (`tm:<Move>` key items), `canLearnMachineMove`, two move tutors (`NpcDef.tutor?`), `POST /creature/:id/tutor`, and `POST /creature/:id/moves` accepting owned-TM and already-known moves
Why: Phase D systems — TMs and a tutor. Learnability is one documented rule (Normal-type, a shared type, or already in the level learnset) so client and server agree without a compatibility table. `NpcDef.tutor` is data only; the layout RNG reads x/z only, so no plan or heightfield digest moves (`plan.test.ts`, `heightfield.test.ts` unchanged). A known move is always accepted by `/moves`, otherwise a TM- or tutor-taught move would be refused on the next reorder.
Evidence: `packages/content/test/progression-items.test.ts` "D2"; `packages/server/test/tms-evolution.test.ts` "D2" (TM teaches only when owned and compatible, never spent; shop: `oneAtATime`, `alreadyOwned`, `notSellable`; tutor: `noTutorHere` outside its town or for a move it does not teach, money − 3000, `alreadyKnown`, `notLearnable`); `packages/protocol/test/rest.test.ts` (65 routes); `packages/client/test/teach-evolve.test.tsx` (Teach section, tutor list from `?tutor=`).
Affects: `@ewa/content` (`KEY_ITEMS`, `TM_MOVES`, `tmItemId`, `tmMoveOf`, `canLearnMachineMove`, `MOVE_TUTOR_PRICE`, `PROGRESSION_STOCK`, town shop stock from Saltmourn on, three quest rewards), `@ewa/protocol` (`TutorReq`, `ROUTES.creatureTutor`), the server (`party.ts` `/moves` + `/tutor`, `catalog.ts` key-item purchase rule), the client (`TeachSection`, `teach` / `tutor` intents, World3D opens `/play/party?tutor=<npc>` after a tutor's lines).

## 2026-10-06 — `00-spine.md` §2.3, §2.6, §2.16, CUT list — `Evolution` gains `{ kind: 'item', item, into }` and `{ kind: 'trade', into }`; six evolution stones (`ConsumableEffect evolutionStone` loses its reserved fields); nine families switched; trade evolutions through `TRADE_EVOLVE_RIBBON`
Why: Phase D3. Level evolutions stay byte-identical (`applyExp` only reads `atLevel` for level/split) and the determinism fuzz runs on its own legacy fixture, so `packages/core/test/fuzz-digests.json` is unchanged. The switched families avoid every league team and every species the progression walker fixtures hold. A trade marks the received trade-evolver with a ribbon rather than a new column (no migration; ribbons are unused elsewhere); the evolve route consumes the mark. Coverage stays 130/130: the roster closure follows `evolutionChildren`, and `AcquisitionPath` gains `item` / `trade`.
Evidence: `packages/core/test/evolution-items.test.ts`; `packages/core/test/determinism.test.ts` (digests unchanged); `packages/content/test/coverage.test.ts` (130/130, `item` / `trade` paths), `packages/content/test/progression-items.test.ts` "D3" (species.ts = `STONE_AND_TRADE_EVOLUTIONS`, every stone used and sold, no league family, mutations); `packages/server/test/tms-evolution.test.ts` "D3" (`/item/use` answers `evolveReady { into, item }` without spending; `/evolve` spends one; wrong stone `noEffect`; no stone `notReady`; a trade lists the received trade-evolver in `creaturesUpdated`; evolve once, mark cleared); `packages/client/test/teach-evolve.test.tsx` (stone prompt carries the stone; trade prompt queued from the delta).
Affects: `@ewa/core` (`Evolution`, `ConsumableEffect`, `itemEvolutionTarget`, `tradeEvolutionTarget`, `evolutionChildren`), `@ewa/content` (`EVOLUTION_STONES`, `TRADE_EVOLVE_RIBBON`, `data/evolutions.ts` applied by `scripts/migrate-legacy.ts`, roster, validate), `@ewa/protocol` (`CreatureEvolveRes`), the server (`party.ts` `/evolve` + `/item/use`, `tradeSession`), the client (bag + creature panel stone use, evolve modal text, `queueTradeEvolutions` in the message router).

<!-- 2026-10-06 Phase C6 (password reset + email verification over SMTP) and the reconnect input-seq fix. -->

## 2026-10-06 — `00-spine.md` §4.7, §5.1; `30-server-netcode.md` §30.1.2, §30.6.2, §30.6.4; `20-client.md` §20.1.1, §20.9.1 — password reset + email verification: `POST /auth/forgot|reset|verify|resend`, `players.email_verified_at`, `email_tokens` (migration `0002_email_tokens`), optional SMTP env, `/forgot` `/reset` `/verify` screens
Why: Phase C asked for password reset; a reset needs a proven address, so verification ships with it. Mail stays optional so a deployment without SMTP still runs (production warns, never refuses; the dev transport writes `.eml` files under `DATA_DIR/mail`). Verification never gates play.
Evidence: `packages/persist/test/email-tokens.test.ts` (hash-only storage, single use, kind-bound, expiry, supersede, purge, `markEmailVerified`), `packages/persist/test/migrations.test.ts` (0002 column, table, indexes, kind check); `packages/server/test/rest-auth.test.ts` "Phase C6" (forgot always 204 incl. unknown email, per-IP 429, per-address cap; reset happy path revokes every refresh token, old password refused, reuse → `used`, expired → `expired`; verify once; resend 3/h → 429, `alreadyVerified`); `packages/server/test/mailer.test.ts` (env warnings, transports, `.eml` MIME); `packages/protocol/test/rest.test.ts` (64 routes); `packages/client/test/account-recovery.test.tsx`.
Affects: `@ewa/protocol` (`ForgotReq`, `ResetReq`, `VerifyReq`, `BadTokenErr`, `EmailToken`, `PlayerProfile.emailVerified?`, four `ROUTES`), `@ewa/persist` (`authRepo.issueEmailToken / consumeEmailToken / purgeEmailTokens`, `playerRepo.markEmailVerified`), the server (`ServerDeps.mailer`, `src/mail/mailer.ts`, `LIMITS.forgot / forgotEmail / emailToken / resend`, `envWarnings`, `nodemailer` dependency), the client (routes, `AccountScreens`, `EmailNudge`, `Profile.emailVerified`).

## 2026-10-06 — `30-server-netcode.md` §30.2.2 onJoin step 4 — a takeover resets `ps.seq` (and `userData.lastSeq` is 0, as step 5 already said)
Why: reloading inside the 20 s reconnection window reused the avatar with the old socket's seq as the stale-seq baseline while the new client counts from 1, so every input was dropped as `staleSeq` (~15 s frozen) and the client's reconciler ignored the low acks.
Evidence: `packages/server/test/authority.test.ts` A14b (fails before the fix: the echoed seq stayed 400).
Affects: `ZoneRoom.onJoin`; server IMPLEMENTATION-NOTES "Reconnect input seq".

<!-- 2026-10-06 Phase C3 (world map, minimap, fast travel): the user's decision "world map + HUD minimap + free fast travel to visited towns". -->

## 2026-10-06 — `00-spine.md` §4.3, §4.6 — `fastTravel { zoneId }` (21st client message, 4/s) and `visited:<ZoneId>` flags
Why: free fast travel between visited towns needs a server-checked request and a per-player record of where the player has been; the world map shows the same record.
Evidence: `packages/protocol/test/payloads.test.ts` (21 keys, fastTravel valid / invalid); `packages/server/test/fast-travel.test.ts` (registration and first joins write `visited:` once; accepted trip = handover to the town's spawn, the ack writes the row; refusals notVisited / notTown / travelGated / travelBusy / travelCooldown); `packages/content/test/worldMap.test.ts` (`isKnownFlag` accepts exactly the 21 `visited:` flags; map cells unique, linked zones adjacent).
Affects: `@ewa/content` (`visitedFlag`, `VISITED_FLAGS`, `zoneMapPositions`), `@ewa/protocol` (`FastTravelMsg`, `FAST_TRAVEL_REFUSALS`, `CLIENT_MESSAGE_LIMITS.fastTravel`), the server (`ZoneRoom.onFastTravel`, `markVisited`, `LIMITS.fastTravel`, registration), the client (`/play/map`, the `M` key, the HUD minimap). Server tests compare story flags through `storyOnly`, which now drops `visited:` like the streak bookkeeping.

<!-- 2026-10-06 Phase B (story-complete): battle presentation and league story gates. -->

## 2026-10-06 — `00-spine.md` §3.3 — `LeagueTrainer.mid { halfHp, lastStand }`: a line when the foe team first drops to half its total HP and one when its last creature enters, for all 12 league trainers
Why: the user's decision "visible opponent trainer + VS intro card + victory/badge card + mid-battle leader lines".
Evidence: `packages/content/test/league-mid.test.ts` (12 rows, non-empty, ≤ 140 chars); `packages/client/test/battle-presentation.test.tsx` (each line fires once, at the damage / switch-in event).
Affects: `@ewa/content` `types.ts`, `schema.ts`, `data/league.ts`; the client's `BattleController`, `BattleBanner`, `BattleIntroCard`, `BattleResultCard` and the foe-actor abstraction (`scene/foeActor.ts`).

## 2026-10-06 — `00-spine.md` §3.13 — `InteriorRoom.greet { at, until }`; `LEAGUE_STORY_GATES` covers all 12 league trainers
Why: every leader now waits for its town's preamble beat (re-landed from the reverted M3 progression work); the Wardens wait for `wardens_met`, set by Kirei's `wardens_charge`, but her chamber lies behind the gates Veil and Aurelia open — so the leader who speaks the hall's gate beat greets in the foyer until it has played.
Evidence: `packages/content/test/gates-reachable.test.ts`, `packages/content/test/interiors.test.ts` (Kirei greets until `wardens_met`; checkInterior: greet points reachable with every gate closed).
Affects: content `leaderSpot`; server `findTarget` / `leaguePosition` take the player's flags; client hall interactables and actors follow them.

<!-- 2026-10-06 Phase A (interiors, themed gym halls, puzzles, correct arenas): the user's decisions — walk inside through the door, the leader visible at the far end, the arena at an authored point in the hall; a unique themed hall per gym with 2–3 gym trainers and one gimmick; everything enterable as pockets inside the same zone; one league hall with four chambers. -->

## 2026-10-06 — `00-spine.md` §3.13 (new), §3.11, §3.10 — interiors: every town building opens into a pocket hall reached by door warps; gym halls with trainers, per-player gates and switch puzzles; Solenne's league hall
Why: gyms were solid shells — the challenge was an interact point at the door (0, −26) and the arena formed round the player in front of the wall, so its far half (foe, far ring, spectators) sat inside the building; the leader was never visible; Solenne could only challenge the first Warden. The fix is an authored arena inside a real hall.
Evidence: `packages/content/src/interiors.ts`, `interiorIndex.ts`, `data/interiors.ts`; `packages/content/test/interiors.test.ts` (70 pockets over 9 towns placed, disjoint, walkable floors, all 8 gym puzzles + 4 league chambers solvable by the walker and closed without flags, arena clearance ≥ 6.5 m, determinism); `validate()` green.
Affects: `@ewa/content` `ZoneSurface.interiors`, the 9 town heightfields (`dist/heightfields/*.json` regenerated), `plan.ts` (Solenne gets the `solenne.league` hall in its gym slot), Solenne's ZoneDef (stale `solenne.league_hall` warp removed; Comptroller Varn and Bursar Quill moved to the hall door), `test/fixtures/r1-pre-move.json` (Solenne re-captured); `@ewa/protocol` (`INTERACT_KINDS` += 'switch', `battleStart` += optional `x`, `z`, `yaw`); `@ewa/render` contracts (`ZoneSpec.interiors`, `InteriorsHandle`, `CameraRig.setYawBase`, `BattleStage.dress(…, hall)`); server, render and client consume them.

<!-- 2026-10-05 KayKit characters: the user's decision "3D people with 2D creatures" (stylised 3D people from the KayKit "Adventurers 2.0" free pack, creatures stay 2D lit billboards). Five entries, newest on top. -->

## 2026-10-05 — `10-render.md` §10.7.7 — the pixel-art character proposal of 2026-09-30 (`tools/character-pipeline`) is closed unapplied; its output and runtime are deleted
Why: the user chose 3D people with 2D creatures on 2026-10-05; the pixel-art billboards were a proposal (`tools/character-pipeline/IMPLEMENTATION-NOTES.md`, "proposed SPEC entries") that §10.7.7 only mentioned ("to be replaced by pixel-art character billboards in a separate task") and never adopted.
Evidence: `packages/client/public/characters/` and `packages/render/src/sprites/characterAtlas.ts` / `characterAnim.ts` / `test/characters.test.ts` removed; `tools/character-pipeline/README.md` marked superseded (its CLI refuses to write into `public/`).
Affects: `tools/character-pipeline` leaves the root `tsconfig.json` references and the default `vitest` run (`vitest.config.ts` excludes it); `RendererOptions.charactersUrl` and `HostContext.charactersUrl` are removed (`packages/client/src/scene/World3D.ts` no longer passes it).

## 2026-10-05 — `40-pipelines.md` §40.6 — the `models/` budget line: measured 7.42 MB of 12 (legendaries 5.61 + the KayKit set 1.79); the layout lists `characters/`
Why: the Quaternius looks (3.38 MB, `looks/<look>.glb`) are replaced by the KayKit character set; the phase-3 load note named "the body GLB".
Evidence: `tools/model-pipeline/test/budget.test.ts` (`dirBytes(public/models)` = `models.manifest.json totalBytes` = 7 420 209 B; `characters/` 1 794 168 B ≤ 5 MiB); `pnpm models` output.
Affects: none beyond the text (the ceiling, its test and `asset-audit --bytes` are unchanged).

## 2026-10-05 — `40-pipelines.md` §40.0.2 rule 6, §40.2.1–§40.2.6, non-negotiable 10 — the model pipeline builds the KayKit "Adventurers 2.0" set (15 shapes, 5 accessories, one animation file, one look atlas) and `models.manifest.json` version 2; the Quaternius looks are removed
Why: the user replaced the disliked Quaternius mannequins with KayKit's stylised characters (free tier, CC0, Kay Lousberg). KayKit characters are 6–9 skinned parts on one shared rig whose joint order differs per file, with one gradient-swatch texture each, so looks are built as shapes (parts merged into one primitive with joints remapped by name, heads moved between bodies) + per-look swatch recolours in one atlas + hand-held accessories; clips live once in a shared file with measured gait speeds.
Evidence: `tools/model-pipeline/IMPLEMENTATION-NOTES.md` K1–K8 (rig equality and joint orders, swatch usage per part, `prune` dropping UVs, OKLab recolour, atlas 47.5 KB vs 116 KB PNG, gait speeds walk 0.808 / run 3.367 units/s, one scale 0.6819, accessory slot rotations); tests `budget.test.ts`, `characters.test.ts`, `determinism.test.ts` (a rerun is 26/26 cache hits and reproduces the committed bytes; the 4 legendary outputs are byte-identical to before).
Affects: `tools/model-pipeline/src/{characters,kaykit,atlas,buildCharacters}.ts` (new), `sets.ts`, `build.ts`, `manifest.ts`, `transform.ts` (`keepAttributes`), `prepare.ts` (Quaternius rule removed); `public/models/characters/**`, `CREDITS.txt` (Kay Lousberg); `@ewa/render` reads manifest v2 (`stage/looks.ts`).

## 2026-10-05 — `10-render.md` §10.7.7, §10.5.8, non-negotiable 2 — characters are KayKit 3D bodies: one `'character'` material sampling a per-actor atlas tile, the shared clips blended by measured ground speed with foot-matched time scales, procedural wave and bow emotes, nearest-12 shadow casters, distance LOD
Why: the user's decision of 2026-10-05 ("3D people with 2D creatures", KayKit free tier). One material + a per-object tile uniform keeps the material count and the programs flat across 24 looks; gait from measured displacement keeps planted feet on the ground at the protocol's 4.2 / 7 m/s; the albedo gain / saturation and rim / floor keep the bright KayKit swatches readable from noon to night (audit M2-gym-dusk-6).
Evidence: render IMPLEMENTATION-NOTES Part 6 (sandbox lineup of the 24 looks walking, running and emoting at noon, dusk and night beside creature billboards; draw calls 0 / 24 / 48 actors: beauty 73 / 110 / 146, shadow 112 / 158 / 161, programs 112 / 114 / 114, materials 15; planted-toe drift −0.04 m/s at 0.7 m/s walk, ≤ 0.13 m/s at 4.2 / 7 m/s run); `test/actors.test.ts` (12 tests); client harness re-shots `.screenshots/audit/M2/{mirevale,mire_route}/`.
Affects: `packages/render/src/stage/{actors,looks,characterMaterial,wiring}.ts`, `renderer.ts` (`charactersUrl` removed), `index.ts`; §10.5.8's actor row becomes bodies + accessories + 1 decal (25 → 51; total beauty + post ≤ 336, still under the 400 cap); NN 2's character clause reads "the KTX2 look atlas, albedo only".

## 2026-10-05 — `10-render.md` §10.7.6 — `ActorPool` is the KayKit `CharacterPool`: 48 preallocated rigs owning cloned bodies recycled per shape, gait from measured displacement (the `moving` / `running` flags are hints), anchors at the head joint, one instanced contact decal
Why: the interface is unchanged, but its behaviour now depends on 3D bodies: remote interpolation, prediction corrections and teleports must animate from what the actor actually does (a jump > 3 m measures no speed), and nameplates follow a hop or a bow.
Evidence: render IMPLEMENTATION-NOTES Part 6; `test/actors.test.ts` (gait by measured speed, flags-only actors stand, facing along the shortest arc, emotes yield to walking, recycling, exact dispose, anchors).
Affects: none outside `@ewa/render` (the client's calls are unchanged; `HarnessWorld` passes the body's `look:palette` like `World3D`).

<!-- 2026-09-30 render hardening follow-up: the nine entries proposed at the end of render IMPLEMENTATION-NOTES Part 4 (P4-C1 … P4-C9) and the SPEC changes of render Part 5 (tasks T1–T5, audit blockers M2-battle-5/6/7/8, M2-spawn-noon-9, M2-gym-dusk-7, harness findings B1/B2/H1). -->

## 2026-09-30 — `50-verification-budget.md` §50.6.1 — heading numbers follow the rig: 0 looks toward −z, 1 −x, 2 +z, 3 +x
Why: the words "0 = +z forward, 1 = +x, 2 = −z, 3 = −x" are 180° from `10-render.md` §10.7.1 (yaw −35° + 90°·k, camera at target + (sin yaw, cos yaw)·d, looking toward −(sin yaw, cos yaw)); the harness followed the words and shot 1 then put the heart-tree crown between the camera and the player. The rig's numbering is what the game shows (heading 0 at the Mirevale spawn has the player in front of the heart tree), so the words change, not the rig.
Evidence: `packages/client/IMPLEMENTATION-NOTES.md` Part 4 H1; `packages/render/src/camera/rig.ts` `headingYaw`, `orbitPosition`; audit M2-spawn-noon-9.
Affects: `packages/client/src/harness/anchors.ts` / `shots.ts` (the `words` heading reading must become the rig reading — harness owner); `.design/audits/M2-render-audit.md` shot 1 and 2 headings.

## 2026-09-30 — `10-render.md` §10.5.8, `50-verification-budget.md` §50.2.2, `40-pipelines.md` §40.5.2 — the draw-call cap of 400 counts beauty + post: `BudgetCounts.beautyDrawCalls = drawCalls − shadowDrawCalls`
Why: §10.5.8 always excluded the shadow cascades from the cap ("reported separately … the ≤ 400 cap applies to the beauty pass and the post quads"), but §50.2.2's source column and the `budget.counts.drawCalls` rule read `renderer.info.render.drawCalls`, which includes them; Mirevale's gym-dusk (406) and lamps-night (408) failed on ~160 beauty + post draws.
Evidence: audit M2-gym-dusk-7 (dump `shadowDrawCalls` 248 at lamps-night); render Part 5 B2 (the host inspector counts the draw calls rendered into shadow maps every frame; `stats-dispose.test.ts`); `tools/asset-audit/src/rules/budget.counts.drawCalls.ts`, `packages/client/src/harness/budgetRules.ts` (+ tests).
Affects: `BudgetCounts` gains optional `beautyDrawCalls` / `shadowDrawCalls`; `ZoneDump.shadowDrawCalls` is the measured value; `harness:budget` and `audit:assets` exit 0 on the M2 dumps.

## 2026-09-30 — `50-verification-budget.md` §50.2.3 / `10-render.md` §10.10.1 — `BudgetProbe.counts()` and `dumpZone()` read the last completed frame's snapshot
Why: three's own rAF loop resets `renderer.info` before the next frame, so counts read after any await returned an empty frame (`drawCalls 0`) — the harness had to tick and read in the same task.
Evidence: `packages/client/IMPLEMENTATION-NOTES.md` Part 4 H6; render Part 5 B1 (`frame()` step 6 keeps the frame's `BudgetCounts`).
Affects: the harness may read counts at any time after a frame.

## 2026-09-30 — `10-render.md` §10.2.4 — the diorama occluder fade: library materials above the ground dither away between the camera and the player
Why: at the Mirevale spawn the heart-tree crown hid the player (4.7 % of the player sharp in the mask shot); H11's crown avoidance only moves shot cameras, and the diorama camera cannot move without leaving Pillar 1's pose.
Evidence: audit M2-spawn-noon-9; `packages/render/src/materials/occlusion.ts`; sandbox shots `occ-spawn-fade0/1` (render Part 5); `compile-plan.test.ts` (mask on cards and solids, not on triplanar ground or water; scene-camera gate).
Affects: every non-terrain library program carries the mask (compiled at step 8; no runtime compile); shadow maps are untouched.

## 2026-09-30 — `10-render.md` §10.5.7 — per-instance ground-cover masks; creatures within 15 m are readable in tall grass
Why: the M2 sprite-edge shot showed a wild creature nearly invisible inside tall grass; the arena needs the same mechanism (next entry). Rebuilding scatter per event is not acceptable (Pillar 7, no allocation).
Evidence: render Part 5 T1 / T3 (`ScatterMask`, `GroundCoverReveal`), `ground-cover.test.ts`; sandbox shots `t3-reveal0/1`.
Affects: `packages/render/src/zone/scatter.ts` (the mask), `stage/groundCover.ts`; no builder change.

## 2026-09-30 — `10-render.md` §10.7.5 — a dressed arena hides ground cover, small props and merged static props inside its ring, restored on undress; it is seated on the highest ground under its rim
Why: the M2 battle shot showed tall grass filling the ring and a fence post over the foe's face (80 % of the foe hidden); on a slope the terrain covered the ring's uphill half.
Evidence: audit M2-battle-3, M2-battle-8; `.screenshots/audit/M2/mire_route/battle--80.32_4.38-full.png` (before); render Part 5 T1 (`STAGE.coverHideM` 4.9 / `coverOuterM` 6.6 / `propHideM` 5.0, `PropCutaway`), `ground-cover.test.ts` (Pillar 7: zone root children and light list unchanged).
Affects: `packages/render/src/stage/battleStage.ts`, `stage/propCutaway.ts`, `stage/wiring.ts`.

## 2026-09-30 — `10-render.md` §10.7.4 — the battle camera frames both battlers above the DOM panel: fitted distance and tilt, clear-yaw search, cue scaling, shake room
Why: the fixed 12 m / −28° pose put the near battler and its HP bar under the bottom 28 % DOM panel, and the impact cue's dolly toward the defender swung the near battler below the frame (rect y 943–1217 of 900).
Evidence: audit M2-battle-5; render Part 5 T2 (`battleFraming`, `setShotInsets`, `setBattleSubjects`, `CROWN_YAW_STEPS`, `CUE_FIT_STEPS`), `battle-framing.test.ts` (1440×900 and 1280×720, every frame of impact / attacker / ko cues inside the band); sandbox shots `after-battle-1440-*`, `after-battle-1280-*`.
Affects: `20-client.md` §20.5.6 (the client passes the panel height; `FRAME_SHIFT_M` 0).

## 2026-09-30 — `10-render.md` §10.9, `20-client.md` §20.6 — battle plates carry type badges and stay above the DOM panel
Why: §50.1 #15 requires the battlers' type icons to be legible and none were drawn; the near plate sat under the panel.
Evidence: audit M2-battle-6, M2-battle-7; render Part 5 (`HUD.barW` 240, `typeBadge`, `setBottomInset`); `compile-plan.test.ts` (badges, ≥ 14 px), `battle-framing.test.ts` (bars above the panel).
Affects: `HudModel.battle.bars[].types` (optional), `packages/client/src/battle/BattleHud.ts` / `BattleController.ts`.

## 2026-09-30 — `10-render.md` §10.1.2, §10.5.9, `20-client.md` §20.10.4 — two-phase zone compile: `loadZone(spec, { focus })` resolves after the first view's programs; the rest compiles in the background, gated
Why: after P4-C3 `loadZone` resolved only when every program of the zone was compiled — 37–53 s cold on the dev iGPU (a zone handover stall). Each unique pipeline costs 1–5 s of driver time; about 40 % of them are not needed by the first view (warm library quads, beacon housing, far set-pieces and water).
Evidence: render Part 5 T4 (cold measurements, pipeline timings per phase, frame gaps during the background phase, leak checks with a dispose mid-background); `compile-plan.test.ts`.
Affects: `RendererOptions.backgroundCompile`, `CompileProgress.phase 'background'`, `Renderer.compileIdle()`, `LAYERS.compileGate` (26); the client's boot overlay and handover pill (§20.10.4); harnesses (`trackTimestamp`) keep the single-phase compile by default.

## 2026-09-30 — `10-render.md` §10.7.4 — P4-C9: the battle / inspector camera never enters a tree crown
Why: the battle camera landed inside crowns in live runs (client Part 2 render bug 6).
Evidence: render Part 4 H11 (`TerrainCollider.addCrown`, `crownClearance`, `DioramaRig` occluders), `camera-rig.test.ts`, `collider.test.ts`.
Affects: none beyond render.

## 2026-09-30 — `10-render.md` §10.9 — P4-C8: battle bars are clamped inside the margins, kept off the turn label, the party strip and the clock, and never overlap
Why: the far battler's bar left the canvas top for a tall species and the turn label overprinted the near bar (client Part 2 render bugs 3 and 4).
Evidence: render Part 4 H10, `hud.test.ts`.
Affects: none.

## 2026-09-30 — `10-render.md` §10.7.7 — P4-C7: one scale factor for every look; emotes play `victory` / `defeat` / `standup`
Why: per-look height normalisation erased relative heights; the model pipeline keeps no emote clips.
Evidence: render Part 4 H7, `actors-glb.test.ts`.
Affects: none (the looks are being replaced by pixel-art character billboards separately).

## 2026-09-30 — `10-render.md` §10.2.3 — P4-C6: `preloadHero` retires the replaced field set; retired sets are released at the next `evictExcept`; the hero stream starts after the zone's phase-1 compile
Why: three 0.186's shadow pass re-initialises a texture disposed while render objects of the zone can still be created (+21 textures per unload, then +1).
Evidence: render Part 4 H5a / H5c, `material-library.test.ts`, `zone-dispose.test.ts`; Part 5 T4 leak checks.
Affects: none.

## 2026-09-30 — `10-render.md` §10.10.1 — P4-C5: `ZoneDump` gains `materials[].side`, `geometries[].sharedBy / kind / tier? / instancedMesh`, `lightSources[] { id, lightDistance }`
Why: §40.5.2 says the dump gains these fields; the verbatim type did not list them.
Evidence: render Part 4 H2, `zone-dump.test.ts` (render and asset-audit).
Affects: none (the asset-audit mirror already read them).

## 2026-09-30 — `10-render.md` §10.6.2 — P4-C4: rule 4 probes at the step length around the start, ±22.5°…±90°; the stuck-inside escape steps at most the step length
Why: probing the capsule radius around the target and escaping up to 4 m moved a mover farther than its step; the server counts that as a speed rejection and kicks after 30.
Evidence: render Part 4 H9, `collider.test.ts` (`|result − from| ≤ |d|` over 20 000 displacements), client `collider.test.ts`.
Affects: none.

## 2026-09-30 — `10-render.md` §10.1.2 step 8, §10.5.9 — P4-C3: pre-compilation through `compileAsync` with the scene pass's target, MRT, call depth and TRAA's velocity projection
Why: the first zone frame compiled every pipeline synchronously (10.1 s CPU, 48.9 s to GPU idle); `compileAsync` alone compiled programs the frame did not use.
Evidence: render Part 4 H4 (facts a–e).
Affects: superseded in its `loadZone` part by the two-phase entry above.

## 2026-09-30 — `10-render.md` §10.10.3 — P4-C2: `passMs` is filled per render context when the renderer tracks timestamps; the uid map survives a second resolve of a batch
Why: "during play every entry is null" contradicted the per-context fill the host does with `trackTimestamp`; the harness then saw every context in `opaque` because `collect` deleted the batch's uids and the pool hands the same batch to a second resolve.
Evidence: render Part 4 H6; render Part 5 B1 (`PassTimer` two-generation map), `stats-dispose.test.ts`; client Part 4 H7.
Affects: the harness's per-context cross-check.

## 2026-09-30 — `40-pipelines.md` §40.5.2, `50-verification-budget.md` §50.4.x — P4-C1: `scatter.instanced` needs lod0–lod2 + impostor for trees only; other kinds need the tiers they are drawn at (≥ lod0 + lod1)
Why: small kinds are not drawn beyond 90 m and only trees get impostor cards (render Part 2 Z2), so the rule failed every real dump by design.
Evidence: render Part 4 H2 (tier sets on the built slice zones); `tools/asset-audit/src/rules/scatter.instanced.ts`, `rules.test.ts`.
Affects: `audit:assets` on real dumps.

---

<!-- 2026-09-25 spec-verification pass: every entry from here down to the next `---` is one fix from `.design/audits/spec-verification.md` (finding ids in each Evidence line). -->

## 2026-09-25 — `30-server-netcode.md` §30.6.2 — `ARGON2.algorithm` is the literal `2 as Algorithm`
Why: `@node-rs/argon2` 2.2.1 declares `Algorithm` as an ambient `const enum`, which cannot be referenced as a value under the repo's `isolatedModules`; the verbatim `Algorithm.Argon2id` does not compile.
Evidence: `packages/server/src/rest/auth.ts` lines 6–13; `packages/server/IMPLEMENTATION-NOTES.md` "Verified against the installed libraries". Finding L1-29.
Affects: none beyond the implemented server.

## 2026-09-25 — `30-server-netcode.md` §30.5 — the authority matrix names every writer of `players.money`, `inventory_items.qty` and `story_flags`
Why: the matrix claims to list "the only writer" per field but omitted raid rewards, mission claims, the daily-login streak (money, items and its `streak:*` story-flag rows), guild founding and the `/creature/:id/setup` equip, all of which the implemented server writes.
Evidence: `packages/server/IMPLEMENTATION-NOTES.md` S6, Q5, Q11–Q14; §30.9.1 (streak stored as `story_flags`). Finding L2-24.
Affects: `packages/server/test/authority.test.ts` snapshot expectations for those paths.

## 2026-09-25 — `50-verification-budget.md` §50.4.8 — the `encoding.test.ts` row carries the §40.1.6.4 thresholds as amended on 2026-09-24
Why: the 2026-09-24 amendment of §40.1.6.4 (per-sprite PSNR ≥ 30 / 26 dB, edge ≤ 50 %, interior ≤ 15 %, set medians, luma ≤ 40, flat ± 2 for ≥ 80 %, band luma ≤ 35) did not reach this row, which still listed the struck figures (36 dB, 18 %, 2 %, 24, ± 2, ± 12); the two sections contradicted each other.
Evidence: contradiction §50.4.8 vs §40.1.6.4; `tools/sprite-pipeline/test/encoding.test.ts` (57/57 with the amended thresholds, `.design/audits/M1-asset-audit.md`). Finding L1-44.
Affects: none.

## 2026-09-25 — `50-verification-budget.md` §50.2.2 — texture memory read from `RenderStats.textureBytes`; render targets ≤ 41; programs ≤ 128; shadow lights counted scene-wide
Why: three counts every compressed texture as 1 byte in `info.memory.texturesSize`, so the KTX2 materials were invisible to the cap; the stock display nodes need 29 render targets before shadows (measured 34 with one local caster) against a cap of 24; the light set is part of every lit program's source, so a zone adds its variants (measured 107) against a cap of 96.
Evidence: `three` `src/renderers/common/Info.js` lines 449–453; `packages/render/IMPLEMENTATION-NOTES.md` C17, C18, and Part 2 "Measured" (107 programs in every slice shot, 34 render targets); DOF owns 8 targets (`DepthOfFieldNode.js` lines 88–134, `GaussianBlurNode.js` lines 71, 80). Findings L1-14, L3-02, L3-03.
Affects: `10-render.md` §10.10.2, §10.8.3; `40-pipelines.md` §40.5.2 `budget.counts.*`; `50` §50.4.6 `budget.spec.ts`; `tools/asset-audit` rule constants.

## 2026-09-25 — `50-verification-budget.md` §50.2.3 — `trackTimestamp` needs no cast
Why: `trackTimestamp` is declared in `@types/three` 0.186's `WebGPUBackendParameters`; the "one typed cast" instruction described a gap that does not exist.
Evidence: `@types/three` `src/renderers/webgpu/WebGPUBackend.d.ts` line 11; `WebGPURenderer.d.ts` line 5; render IMPLEMENTATION-NOTES C1. Finding L1-01.
Affects: `10-render.md` header table, §10.1.2 step 1.

## 2026-09-25 — `40-pipelines.md` §40.2.2–§40.2.6 — model pipeline against gltf-transform 4.5: no `meshopt()` (its tail only), no `textureCompress` for KTX2, `joinPrimitives` for skinned looks, `simplifyWithAttributes` at error 0.01, slot-bound texture roles, detached clips, ≤ 512² legendary texture ladder, 19 looks
Why: `meshopt()` re-runs `reorder` + `quantize` after the explicit quantize; `textureCompress` has no KTX2 target; `join()` skips skinned nodes; `simplify()` is position-only and 0.001 stops at 24–29 k of 30 k triangles; the mean-colour role heuristic misreads the sources; `Animation.dispose()` leaves samplers alive; 1024² UASTC cannot fit 1.2 MB; the source directory and `LOOKS` hold 19 looks.
Evidence: `@gltf-transform/functions` 4.5.0 `src/meshopt.ts` lines 82–93, `src/texture-compress.ts` line 24, `src/join.ts` lines 177–178, `src/simplify.ts` lines 176–183; `@gltf-transform/core` `src/properties/animation.ts`; `tools/model-pipeline/IMPLEMENTATION-NOTES.md` M0–M9 (lumyth/zenryu 1.91–2.31 MB at 1024²; LOD1 220–248 KB; looks 150–217 KB, 3.38 MB; `public/models/` 8.58 MB). Findings L1-34, L1-35, L1-37, L1-42.
Affects: `50` §50.4.8 model-pipeline row (19 looks).

## 2026-09-25 — `40-pipelines.md` §40.3.2–§40.3.3, §40.0.2 rule 5, §40.3.1 — recipes live in `@ewa/render/surfaces`; per-level KTX2 encode + container assembly; UASTC pack level 0; seam metric = excess over the interior baseline; `Noise.periodic`, `CardRgb`, `rdo?`
Why: the `dist/surfaces.json` export was never built (the bake imports the pure subpath); ktx2-encoder 0.6.0 has no per-level input (mips as slices are refused by Basis) and no Zstandard level; pack 2 is larger and slower for equal PSNR; the literal seam check fails every textured seamless map; `fbm2` with lacunarity 2.03 cannot tile without a periodic lattice.
Evidence: `ktx2-encoder` `types/type.d.ts` lines 16, 37, 176–258; `packages/render/src/surfaces/recipe.ts` lines 13–70; `tools/material-bake/src/encode.ts` lines 28–41, 89, 130; `tools/material-bake/IMPLEMENTATION-NOTES.md` D0–D6 (cobble albedo 0.385 → 0.228 B/texel at equal PSNR). Findings L1-36, L1-38.
Affects: none beyond the implemented tools.

## 2026-09-25 — `40-pipelines.md` §40.1.2, §40.1.5, §40.6 — stale "today" rows and v1 block marked historical; v2 `ManifestMap` comments and `alt?` match the code; the `creatures/` and phase-3 byte arithmetic replaced by the shipped manifest
Why: rows 5–6 and the v1 block described the pre-v2 pipeline (4096², lossless, `selectEncoding`), the v2 comments named a 4096² layout, and §40.6 still computed 31.2 MB / 4.1 MB from the per-sprite estimates that the 2026-09-24 amendment of §40.1.6.3 had measured 1.5× optimistic; an 8-atlas zone is 4.35 MB, over the 4 MB phase-3 figure.
Evidence: `tools/sprite-pipeline/src/manifest.ts` lines 24–65; `tools/sprite-pipeline/README.md` output table (36.20 MB); `packages/client/public/creatures/creatures.manifest.json` (65 atlases, 35.33 × 10⁶ B of maps, `zones.galvan_route` / `zones.solenne` 8). Findings L1-39, L3-16, L3-17.
Affects: `20-client.md` §20.10.3 phases 2–3 (measured figures); recommendation R12.

## 2026-09-25 — `10-render.md` header table and §10.1–§10.1.5 — three 0.186 facts: `trackTimestamp` declared, `Renderer.init` starts its own `Animation` loop, compressed textures count 1 byte, `RenderPipeline.dispose` frees only its quad, `CSMShadowNode.updateFrustums` throws before the first build, warm-up is a real frame and the light set is part of every program, HUD overlay colour space, `adapterInfo`
Why: each draft sentence described behaviour the installed three.js does not have; implementers following them hit a crash (`updateFrustums`), a leak (display-node targets), a wrong metric (`texturesSize`), a blank overlay (HUD through the intermediate target) or a false "first zone frame compiles nothing".
Evidence: `three` `src/renderers/common/Renderer.js` line 842, `Animation.js` line 81, `Info.js` lines 449–453, `RenderPipeline.js` lines 165–167, `examples/jsm/csm/CSMShadowNode.js` lines 65, 160, 215–216, 506; `packages/render/IMPLEMENTATION-NOTES.md` C1, C2, C8–C11, C17, C19, P1. Findings L1-01, L1-02, L1-08, L1-09, L1-10, L1-11, L1-14, L1-16.
Affects: none beyond the implemented render package.

## 2026-09-25 — `10-render.md` §10.2.4–§10.2.5 — the surface graph block matches the implemented graph (absolute maps via uniform scale/bias, `vec4` colour, view-space normal mix, re-pointable triplanar sampling, per-surface uniforms); `windDisplace` is a plain factory
Why: the draft multiplied the baked absolute maps by the SurfaceDef values again, returned a vec3 colour (breaking alpha test and card shadows), mixed a view-space normal with an object-space attribute, sampled through `triplanarTexture` (which captures the texture at build time), inlined per-surface constants (one program per surface), and passed uniforms as a TSL `Fn`'s second argument (which is the NodeBuilder).
Evidence: `three` `src/nodes/utils/TriplanarTextures.js` lines 26–46, `src/nodes/display/NormalMapNode.js` line 126, `src/nodes/tsl/TSLCore.js` line 596; `packages/render/src/materials/graph.ts` lines 162–195, `wind.ts` lines 15–35; render IMPLEMENTATION-NOTES C4–C7, M1–M3, M17 (7 structures, fragment programs 27 → 8). Findings L1-04 … L1-07.
Affects: none beyond the implemented render package.

## 2026-09-25 — `10-render.md` §10.3.3, §10.3.5, §10.2.1 — SPEC light units (`× π` for three's physically based lights), IBL normalised to a 0.3 sky radiance, sky re-centred on the camera, sun/moon fade; the visible sky's radiance stated
Why: a directional light of intensity 1 gives `ρ/π` on a Lambert surface in three r155+, so "albedo 0.85 × noon sun 1.0 = 0.85" was off by π; SkyMesh's PMREM radiance (≈ 1.05 at noon) made the unnormalised IBL two thirds of all light and bloomed the frame; a 200 m sky box at the origin is exited on a 240 m route; the visible horizon reaches ≈ 5.9 scene-linear, above the bloom threshold.
Evidence: `packages/render/src/lighting/rig.ts` line 36 (`SPEC_LIGHT_UNIT = Math.PI`), `sky.ts` lines 17–44, 151, 183–213; `three` `examples/jsm/objects/SkyMesh.js` lines 215, 239; render IMPLEMENTATION-NOTES C12, C13, C15, C16, M8 (noon median 0.34, p99 0.65). Findings L1-12, L3-04, L3-05.
Affects: none beyond the implemented rig; recommendation R9 (visible sky).

## 2026-09-25 — `10-render.md` §10.3.7 — grove `fogDensity` 0.018 → 0.0068 per m; the binding number is the fog on the focus (16 % at the default stop)
Why: at 0.018 the player's feet — the DOF focal plane, 26 m of view depth at `y ≈ 0` — were 37 % fogged (46 % at the far stop), which lifted and flattened the whole diorama and washed the inspector close-up: atmosphere over readability, against Pillar 8.
Evidence: `fogFactor = 1 − exp(−26 × 0.018) = 0.374`; `packages/render/src/zone/palettes.ts` line 65 (`FOG_SCALE = 0.38`); render IMPLEMENTATION-NOTES M19, Z12, open item 4. Finding L3-01.
Affects: `packages/render/src/zone/palettes.ts` (already implemented as 0.018 × 0.38).

## 2026-09-25 — `10-render.md` §10.3.2, §10.7.5 — the ZoneBuilder budget throws at the 7th shadow caster (8 − 2 reserved beacons); beacons exist from `createRenderer`; VFX add no lights and draw through one instanced `Sprite`
Why: the beacons cannot be created at battle start (a new light recompiles every lit program), so they count scene-wide from boot; "throw at the 9th" let a zone spend 8 and the scene reach 10. `Points` are 1-px on WebGPU.
Evidence: render IMPLEMENTATION-NOTES P8, P10, Q8, Q13, Z11; `three` `src/materials/nodes/PointsNodeMaterial.js` lines 21–22, 166–173. Findings L1-31, L3-10.
Affects: `packages/render` zone builder assert (currently asserts ≤ 6 in the adapter test only); recommendation R7 (local casters vs the shadow draw-call derivation).

## 2026-09-25 — `10-render.md` §10.3.6 — rain/hail are one `LineSegments` sheet (no `Points`, no `pointWidth`)
Why: WebGPU has neither wide lines nor sized points, so `pointWidth 3` hail cannot be drawn.
Evidence: `PointsNodeMaterial.js` lines 21–22; render IMPLEMENTATION-NOTES M10. Finding L1-31.
Affects: none beyond the implemented weather.

## 2026-09-25 — `10-render.md` §10.4.1, §10.4.3–§10.4.5, §10.4.7 — `mipmaps` holds every level; `cameraYaw` points toward the camera and the card leans back half the pitch; `typeColor` is a `'color'` uniform; `shadowSide = DoubleSide`; `map = null`; decal writes valid MRT values with mask (0, 0); battle-only species are bound per battle
Why: `[level1, level2, level3]` uploads level 1 as level 0; `atan2(camDir.x, camDir.z)` turns the FrontSide quad away from the camera; a strictly vertical card reads at 0.62 of its height from the −52° camera; a `'vec3'` Color uploads NaN; the shadow pass renders FrontSide as BackSide and multiplies by `map.a` at the raw uv; MRT attachments are written unblended, so a transparent decal overwrote the ground's normal and mask; spine rule 11 no longer caps battle teams, which need a bind path.
Evidence: `three` `src/renderers/common/Textures.js` lines 506–508, `Renderer.js` lines 50, 3540–3558, 3767, `UniformsGroup.js` lines 365–367 vs 431–433, `WebGPUPipelineUtils.js` lines 131, 146; render IMPLEMENTATION-NOTES P2–P7, P9, Q1–Q3, Q14. Findings L1-17, L1-18, L1-19, L3-08, L3-15, L3-20.
Affects: render/client follow-up for per-battle opponent atlas binding (§10.4.1).

## 2026-09-25 — `10-render.md` §10.4.5 — the creature-emissive bloom claim is restated in luminance
Why: `BloomNode`'s high-pass keys on luminance, so `1.8 × albedo` crosses the 1.15 threshold only where luminance(albedo) > 0.639: warm and green accents bloom, saturated reds, blues and violets that the stage-4 mask selects never do.
Evidence: `three` `examples/jsm/tsl/display/BloomNode.js` lines 12–15; arithmetic for `(0.92, 0.52, 0.52)` → 0.64 and `(0.6, 0.6, 1)` → 0.66 against `(1, 1, 0.6)` → 1.71. Finding L3-11 (recommendation R8).
Affects: none until R8 is decided.

## 2026-09-25 — `10-render.md` §10.5.5, §10.5.7, §10.5.9, §10.6 — geometric splat; zone-wide instanced tier fields; `LOD.autoUpdate = false`; card/solid split; impostors are cards; dispose events and attribute release; blockers + `surf` in `resolveMove`
Why: per-chunk `InstancedMesh`es each compile their own program (175 → 271); three updates `LOD`s from shadow cameras; alternating `alphaTest` in the shadow pass cost 185 ms CPU per frame; impostor render targets would add to an over-cap count; plain meshes keep their programs until a `dispose` event; later-pass attributes leaked 9.8 MB per reload; content's walkable does not encode footprints; water-only samples are standable for HM Surf holders on the server but not predictable on the client.
Evidence: `three` `src/nodes/accessors/Instance.js` lines 41–67, `Renderer.js` line 3258, `LOD.js` line 83; render IMPLEMENTATION-NOTES C20–C26, Z1, Z2, Z5, Z6; `packages/server/src/rooms/movement.ts` lines 32–85. Findings L1-32, L1-33, L2-01, L2-05.
Affects: render follow-up: `resolveMove`/`resolveMoveInto` gain `surf`, the client's Collider adapter passes it.

## 2026-09-25 — `10-render.md` §10.7.3, §10.8.2–§10.8.3 — DOF camera matrices as own uniforms; CoC arithmetic corrected (0.475 → 2.85 px at `pr 1`: Pillar 1's 3 px fails on the reference machine); vignette 9.3 %; explicit chroma centre; GTAO temporal filtering only with TRAA; `vignetteAspect`/`bokehScale` uniforms; texture-memory arithmetic
Why: in a post graph the camera nodes resolve to the quad's camera; `smoothstep(0, 6, 2.90)` is 0.475, not 0.518 (4.44 px, not 4.1, at 4 m); `smoothstep(0.35, 0.85, 0.574)` is 0.42, not 0.36; a null chroma centre throws at build; the §10.8.3 memory row counted 40 MB of atlases where §40.1.4 gives ≤ 304 MB.
Evidence: `three` `src/nodes/accessors/Camera.js` lines 140, 236, `QuadMesh.js` line 9, `ChromaticAberrationNode.js` lines 136, 169, `DepthOfFieldNode.js` lines 375–379; render IMPLEMENTATION-NOTES C3, C14, M11, M12, M20, Q12. Findings L1-03, L1-13, L3-06, L3-07, L3-12.
Affects: recommendations R3 (DOF strength), R4 (DOF halo), R5 (texture cap).

## 2026-09-25 — `10-render.md` §10.7.5 — `undress` sinks the arena into the ground instead of fading it
Why: the arena is built from shared opaque library materials, which cannot fade without a transparent variant (a new program and a sorting change); the implemented stage rises and sinks the dressing over the same milliseconds.
Evidence: render IMPLEMENTATION-NOTES Q7. Finding L3-21.
Affects: none beyond the implemented stage.

## 2026-09-25 — `10-render.md` §10.7.4 — the battlers stand along the heading's view direction, not perpendicular to it
Why: "perpendicular to the diorama heading" puts both battlers at the same camera distance, contradicting "the player's battler is the nearer one" and the +12° anti-eclipse yaw in the same paragraph.
Evidence: internal contradiction §10.7.4; render IMPLEMENTATION-NOTES Q5. Finding L3-09.
Affects: none beyond the implemented stage.

## 2026-09-25 — `10-render.md` §10.10.2 — render targets ≤ 41 (29 + 4 cascades + ≤ 8 local casters, measured 34) and programs ≤ 128 (measured 107); programs return to baseline after unload, not constant during a zone
Why: see the §50.2.2 entry; the derivation "… impostors ≤ 6 → steady 20" omitted shadow maps, PMREM and `convertToTexture` targets, and "programs constant across a zone load" is impossible when the light set is part of each program's source.
Evidence: render IMPLEMENTATION-NOTES C11, C18, Part 2 "Measured" and "Leak, real GPU" (programs back to baseline ±0 after 3 reload cycles). Findings L3-02, L3-03.
Affects: `50` §50.2.2, §50.4.6; `40` §40.5.2; recommendation R6.

## 2026-09-25 — `20-client.md` §20.3.2, §20.5.5 — a matching preview state becomes `authoritative` wholesale
Why: an `authoritative` state patched from `hpAfter` only diverges from the server at the first stage, status, PP or weather change, after which every preview digest mismatches and the client requests a resync every turn.
Evidence: `packages/client/src/battle/BattleController.ts` header (lines 10–13, the implemented rule). Finding L2-22.
Affects: none beyond the implemented client.

## 2026-09-25 — `50-verification-budget.md` §50.4.5 — authority cases A21–A24 added (matchmake bypass, REST fast travel, listing during a battle, story trainer outside its beat); A14 expects 4101
Why: each is an attack the first draft of §30 left open (L2-02, L2-03, L2-07, L2-08); a case per attack is how §50 proves the fix. A14's 4001 collided with Colyseus' `SERVER_SHUTDOWN`.
Evidence: `30-server-netcode.md` §30.5.1 #26–#28, §30.4.8 rule 6; `packages/protocol/src/messages/index.ts` line 34 (`replaced: 4101`). Findings L2-02, L2-03, L2-07, L2-08, L1-25.
Affects: `packages/server/test/authority.test.ts` (A21–A24 to be written; A14 already uses `CLOSE_CODES.replaced`).

## 2026-09-25 — `50-verification-budget.md` §50.4.5 `aoi-fanout.test.ts` — bots move 0.30 m per 45 ms (6.7 m/s) over the playable interior, not "1 unit per tick"
Why: 1 unit per 50 ms tick is 20 m/s, which §30.2.4 rejects as `speed` (cap 8.05 m/s) — the test as written could only measure rejected inputs; the field-wide grid also put bots in the unwalkable margin.
Evidence: contradiction §50.4.5 vs §30.2.4; `packages/server/IMPLEMENTATION-NOTES.md` "aoi-fanout.test.ts deviations" (measured exponent 1.002, 0 honest rejections). Finding L2-14.
Affects: none (the implemented test already does this).

## 2026-09-25 — `30-server-netcode.md` §30.4.8 — rule 6: a story-battle `TrainerDef` is fired only by its beat
Why: the 7 story battle trainers are ordinary `TrainerDef`s in the zone; nothing stopped `interact` from starting a plain trainer battle before the beat was eligible, paying the reward and `trainer:<id>:beaten` early and a second reward when the beat's battle ran (a story sequence break).
Evidence: `packages/content/IMPLEMENTATION-NOTES.md` clarification 4; `packages/server/src/rooms/ZoneRoom.ts` (beat check, then fall-through to `case 'trainer'`). Finding L2-07.
Affects: `packages/server/src/rooms/ZoneRoom.ts` (follow-up: skip story trainers in the plain trainer path); `authority.test.ts` A24.

## 2026-09-25 — `30-server-netcode.md` §30.6.3 — `/marketplace/list` joins the in-battle REST refusals; raid participants count as in battle
Why: a creature projected in a live battle could be listed and bought mid-battle; the battle-end transaction would then write hp/exp/pp to a creature owned by someone else.
Evidence: `packages/server/IMPLEMENTATION-NOTES.md` Q6, Q14. Finding L2-08.
Affects: none beyond the implemented server; `authority.test.ts` A23.

## 2026-09-25 — `30-server-netcode.md` §30.4.7 — raid boss PP restored on every copy-in; rounds are prepare → one transaction → commit
Why: the boss acts once per participant per round, so its PP ran out and core's no-Struggle NPC policy forfeited private battles while the boss stood; a raid round had no stated failure semantics.
Evidence: `packages/server/IMPLEMENTATION-NOTES.md` Q14, Q15. Finding L2-09.
Affects: none beyond the implemented `raidSession.ts`.

## 2026-09-25 — `30-server-netcode.md` §30.2.6 — per-process join tickets on every reserved seat; `wrongZone`; battle-room seat on reload
Why: Colyseus 0.18 always exposes `POST /matchmake/*` guarded only by the static `onAuth` (default `true`), so any client could create shards or join any zone room with arbitrary options, and `/zone/enter` accepted any ungated zone — both teleport a player to another zone's spawn.
Evidence: `@colyseus/core` `src/router/default_routes.ts` line 6, `src/matchmaker/controller.ts` line 22, `src/Room.ts` lines 788–794; `packages/server/src/rooms/matchmaking.ts`, `ZoneRoom.ts` lines 222, 304; `packages/server/IMPLEMENTATION-NOTES.md` R2, P3. Findings L2-02, L2-03.
Affects: `30` §30.2.1 `ZoneJoinOptions.ticket`, §30.5.1 #26–#27, non-negotiable 5; spine §4.7.

## 2026-09-25 — `30-server-netcode.md` §30.2.4 — `bounds` is checked before `unwalkable`; `validateInput`'s `prev` gains `canSurf`
Why: the 16 m margin is `walkable = 0`, so with `unwalkable` first a `bounds` rejection could never happen and §50.4.5's `bounds` case could not pass; §30.3 makes water-only samples standable with HM Surf, which the verbatim signature had no input for.
Evidence: `packages/server/src/rooms/movement.ts` lines 32–41 (`MovePrev.canSurf`), 64–85; `packages/server/IMPLEMENTATION-NOTES.md` S3. Findings L2-04, L2-05.
Affects: `10-render.md` §10.6.2 (the client predicts water with HM Surf — see its own entry).

## 2026-09-25 — `30-server-netcode.md` §30.2.2, §30.2.5, §30.2.7, §30.1.1 and header — Colyseus 0.18.14 behaviours: `Room<{ state; metadata; client }>`, `onMessage` without a validator + `'*'` counter, `onDrop` for reconnection, `leave(4101)` for a replaced tab, spawns set before `view.add`, handover trigger at the playable edge, `gracefullyShutdown: false`
Why: each draft sentence named a behaviour the installed library does not have (validator rejection → 4002 disconnect, no-handler → 4002 disconnect, `allowReconnection` belongs in `onDrop`, `StateView.add` throws on a detached instance, 4001 is `SERVER_SHUTDOWN`, the SDK's `leave(true)` closes with 4000, the default shutdown handler calls `process.exit`).
Evidence: `@colyseus/core` `src/Room.ts` lines 107–121, 650, 2313–2373; `src/RoomMessages.ts` lines 189–196, 334–342; `src/Server.ts` lines 180–181, 411; `@colyseus/schema` `src/encoder/StateView.ts` lines 334–349; `@colyseus/shared-types` `src/Protocol.ts` lines 279–284; `packages/server/IMPLEMENTATION-NOTES.md` R1, R3, R7, R8, R10, R11, S1, S2, P4. Findings L1-20 … L1-25, L2-06.
Affects: none beyond the implemented server.

## 2026-09-25 — `30-server-netcode.md` §30.3 — `SpawnDirector.tick(now, timeOfDay, players)` returns `freed`; `LiveOpsMods.featuredSpecies`; warm-up cadence; the footprint gap stated
Why: the ≥ 10 m player-clearance rule needs player positions the draft signature did not pass; stalled engagements had no return path; seasonal featured species need the director to know the species at roll time.
Evidence: `packages/server/src/rooms/spawnDirector.ts` lines 32–40, 73–78, 111; `packages/server/IMPLEMENTATION-NOTES.md` W1, W2, Q12. Finding L2-16.
Affects: none beyond the implemented server.

## 2026-09-25 — `30-server-netcode.md` §30.6.5, §30.7.1, §30.8.3, §30.11 — 19 blocked words; a reverse friend request accepts; `offerHash` sorted by playerId; DB-only replay uses `start`
Why: the legacy list has 19 entries, not 20; "no row in either direction" contradicted the spine's `requestFriend`; the literal `[offers[0], offers[1]]` hash depends on seat order while protocol's `tradeOfferHash` (the function the client calls) sorts by playerId; replay needs the starting parties.
Evidence: `packages/server/IMPLEMENTATION-NOTES.md` Q1, Q4, Q8, P6; `packages/protocol/src/digest.ts` line 30. Findings L2-10, L2-11, L2-13, L2-15.
Affects: none beyond the implemented server.

## 2026-09-25 — `20-client.md` §20.3.4 — reconnection is the SDK's (`room.reconnection` configured to 1, 2, 4, 8, 8, 8 s); a replaced tab sees 4101
Why: `@colyseus/sdk` 0.18.2 reconnects internally on 1001/1005/1006/4010; a hand-rolled `client.reconnect()` loop races it. 4001 is Colyseus' `SERVER_SHUTDOWN`, so a restart looked like "another tab took over".
Evidence: `@colyseus/sdk` `src/Room.ts` lines 166–173, `src/Reconnection.ts` lines 68–82; `packages/client/IMPLEMENTATION-NOTES.md` D5 and "Server findings" 5. Findings L1-25, L1-26.
Affects: none beyond the implemented client.

## 2026-09-25 — `20-client.md` §20.1.1, §20.1.2 — `createAppRouter()` replaces the module-level router; `apiFetch(key: RouteKey, init)`; react-router resolves 7.18.4
Why: a module-level `createBrowserRouter` starts a browser router in every test that imports `routes`; `RestRoute<T>` was defined nowhere in the SPEC while protocol already ships the typed `ROUTES` table; the lockfile resolves react-router 7.18.4, not 7.9.
Evidence: `packages/client/src/app/router.tsx` lines 31, 171; `packages/client/src/net/api.ts` line 174; `node_modules/.pnpm/react-router@7.18.4_*`; `packages/client/IMPLEMENTATION-NOTES.md` D1, D2. Findings L1-27, L1-28.
Affects: none beyond the implemented client.

## 2026-09-25 — `20-client.md` §20.4.5 — zoom stops are 20 / 26 / 34 m (render's `DISTANCE`)
Why: the bindings table said 14 / 18 / 24 u, contradicting `10-render.md` §10.7.1, which owns the camera and whose numbers the Pillar 1 and texel-density arithmetic use.
Evidence: `packages/render/src/camera/rig.ts` line 37 (`DISTANCE = [20, 26, 34]`); contradiction §20.4.5 vs §10.7.1. Finding L3-14.
Affects: none (code already uses render's table).

## 2026-09-25 — `00-spine.md` §5.2 — repository interfaces gain the server-part-1/2 additions (setAdmin, bannedIds, byIds, search, counts, leaderboard 'dex', markSeen → boolean, flagSetAt, claimObjective, pruneSyntheticQuests, closeExpiredDetailed + ClosedListing, ownerOf)
Why: §5 is documented as "the implemented package is the reference"; the verbatim block had fallen behind the repos the server now calls (ban cache, admin routes, dex leaderboard, live-ops claims and rollover, refresh-reuse detection, expiry notifications).
Evidence: `packages/persist/src/repos/players.ts` lines 173–241, `progress.ts` lines 48, 86, 167, 188, `market.ts` lines 15–27 and 253–257, `auth.ts` line 46; `packages/server/IMPLEMENTATION-NOTES.md` "Fixes in other packages" and "Protocol / persist changes (part 2)". Finding L1-40.
Affects: documentation of `packages/persist` only; no code change.

## 2026-09-25 — `00-spine.md` §5.1 — `battle_history` gains `start jsonb` (`BattleStartSnapshot`) and `final_digest varchar(8)`
Why: `seed + actions` alone cannot replay a battle without its starting parties; the §30.11 checklist promised a database-only replay the schema could not deliver.
Evidence: `packages/persist/drizzle/0001_battle_replay.sql`; `packages/persist/src/schema/history.ts` lines 25–28; `packages/server/IMPLEMENTATION-NOTES.md` S10 (part 1) and P6 (part 2, `fixes.test.ts` replays a room battle from the row). Finding L2-15.
Affects: `30-server-netcode.md` §30.11 replay row; no further code change.

## 2026-09-25 — `00-spine.md` §4.7 — `/creature/:id/setup`, `/guilds`, `/marketplace/list|bid|buy-now|cancel` responses carry an `inventoryDelta` (`CreatureSetupRes`, `GuildCreateRes`, `ListingMutationRes`)
Why: those routes move money, items or creatures, but their spine responses carried neither, so the client's single-writer inventory went stale until the next `/me` (a client finding the server fixed additively).
Evidence: `packages/server/IMPLEMENTATION-NOTES.md` P1; `packages/client/IMPLEMENTATION-NOTES.md` "Server findings" 1–2; protocol `InventoryDeltaBodySchema`. Finding L2-12.
Affects: `packages/protocol/src/rest.ts` (already implemented); `20-client.md` §20.3.2 mapping (unchanged rule).

## 2026-09-25 — `00-spine.md` §4.7 — `POST /zone/enter` answers 409 `wrongZone` unless `zoneId` is the persisted or live presence zone; during a battle it seats the player in the battle's own room
Why: as written, any client could enter any ungated zone through REST and be placed at its spawn (onJoin step 3 fallback) — fast travel around the zone graph; and a reload mid-battle could not rejoin to receive `battleResync` (the CUT list promises it).
Evidence: `packages/server/src/rest/routes/me.ts` lines 96–119; `packages/server/IMPLEMENTATION-NOTES.md` R2, P3; `packages/client/IMPLEMENTATION-NOTES.md` "Server findings" 4. Finding L2-02.
Affects: `30-server-netcode.md` §30.2.6; `50-verification-budget.md` §50.4.5 A20 (unchanged), new authority expectation (a `wrongZone` enter writes nothing).

## 2026-09-25 — `00-spine.md` §4.6 — the handover trigger is 6 m inside the **playable** edge, not the field edge
Why: the field edge lies inside the 16 m margin whose samples are `walkable = 0` (§3.1), so a trigger 6 m inside the field edge can never be reached and no handover could ever fire.
Evidence: contradiction §3.1 extents vs §4.6 / §30.2.7; `packages/server/src/rooms/ZoneRoom.ts` lines 121–144 (`HANDOVER_TRIGGER_M` against `playableBounds`); `packages/server/IMPLEMENTATION-NOTES.md` R7. Finding L2-06.
Affects: `30-server-netcode.md` §30.2.7; `50-verification-budget.md` §50.4.5 `handover.test.ts`, §50.6.1 shot 6.

## 2026-09-25 — `00-spine.md` §4.4 — raid rewards arrive as `battleEnd { battleId: raidId }`
Why: the spine has no raid-end variant and did not say how a raid's result reaches the client; the server sends `battleEnd` keyed by the raid id.
Evidence: `packages/server/IMPLEMENTATION-NOTES.md` Q14 ("Rewards / catch"). Finding L2-17.
Affects: `packages/client` raid UI routing (a `battleEnd` whose `battleId === state.raid.id`).

## 2026-09-25 — `00-spine.md` §4.3 — unknown message types are counted by a `'*'` handler (no reply); payload validation runs inside the handler wrapper, not as the `onMessage` validator
Why: `@colyseus/core` 0.18.14 disconnects a client (4002) on the first message with no handler outside dev mode, and on a payload its `onMessage` validator rejects; "Colyseus drops it … no '*' handler exists" and "rejection answered with `invalidPayload`" were both impossible with the installed library.
Evidence: `node_modules/.pnpm/@colyseus+core@0.18.14_*/node_modules/@colyseus/core/src/RoomMessages.ts` lines 189–196 (`client.leave(CloseCode.WITH_ERROR)` on a validator throw) and 334–342 (`#noHandler`); `packages/server/src/rooms/ZoneRoom.ts` lines 275–279; `packages/server/IMPLEMENTATION-NOTES.md` R1, R3. Finding L1-22.
Affects: `30-server-netcode.md` §30.2.2 step 6, §30.5.1 #1; `50-verification-budget.md` §50.1.12, §50.4.5 A1.

## 2026-09-25 — `00-spine.md` §4.3 — `InputMsg` drops `.finite()`
Why: zod 4 `z.number()` already rejects NaN/±Infinity and `.finite()` is a deprecated no-op; the block now matches `packages/protocol/src/messages/client.ts`.
Evidence: `node_modules/.pnpm/zod@4.6.5/node_modules/zod/src/v4/classic/schemas.ts` lines 1132 (`@deprecated … This is a no-op`) and 1215–1216. Finding L1-30.
Affects: none (behaviour identical).

## 2026-09-25 — `00-spine.md` §3.11 — the missing building/prop footprints are recorded as an open authority gap
Why: the `walkable` comment requires footprints to be 0, but footprints are planned by render's layout, which content cannot import; as built, the server accepts movement through houses and spawns can land inside footprints. The spec stated a guarantee nothing implements.
Evidence: `packages/content/IMPLEMENTATION-NOTES.md` clarification 1; `packages/render/src/terrain/collider.ts` lines 8–13 (blockers); `packages/render/IMPLEMENTATION-NOTES.md` Z6. Finding L2-01 (recommendation R1).
Affects: `10-render.md` §10.5.5, §10.6.2 wording; server and content follow-up when R1 is decided.

## 2026-09-25 — `00-spine.md` §3.10 — `dist/heightfields/<zone>.json` is the exact compact encoding `q64-delta-varint-b64+rle`
Why: raw JSON arrays of a 481² field exceed 2 MB; the committed files are a bit-exact encoding, which the spec did not describe.
Evidence: `packages/content/IMPLEMENTATION-NOTES.md` D2 (routes ≈ 305 KB, 4.5 MB total, digest re-verified on decode). Finding L1-41.
Affects: none (documentation).

## 2026-09-25 — `00-spine.md` §3.10 rule 11 — the bind cap applies to the overworld set `O(zone)` = table ∪ statics; the full `Z(zone)` is reported, not capped
Why: `|Z(zone)| ≤ 16` cannot hold: `solenne`'s legacy Warden + Champion teams alone are 20 species (26 with its table) and `umbral_observatory`'s story teams make 20.
Evidence: `packages/content/IMPLEMENTATION-NOTES.md` D1; `validate.ts` enforces the subset. Finding L2-18.
Affects: `10-render.md` §10.4.1 (battle-only binding), `40-pipelines.md` §40.1.4, `50-verification-budget.md` §50.4.2 `encounters.test.ts`.

## 2026-09-25 — `00-spine.md` §2.11 — the sleep counter's effective length (`N − 1` skipped actions) is stated
Why: the §2.4 row reads "cannot act for `1 + rng.int(3)` turns", but the §2.11 step-6 algorithm the core implements (decrement at the start of every action, act normally on the one that reaches 0) skips `N − 1` actions; a third of all sleeps skip none.
Evidence: `packages/core/src/turn.ts` lines 322–330, `engine.ts` lines 318–321; `packages/core/IMPLEMENTATION-NOTES.md` item 15. Finding L2-20 (recommendation R11 on the feel).
Affects: none until R11 is decided (a change moves `fuzz-digests.json`).

## 2026-09-25 — `00-spine.md` §2.20 — the fuzz digest construction is stated; first commit of `packages/core/test/fuzz-digests.json` recorded
Why: §50.7 rule 3 makes `fuzz-digests.json` a SPEC artefact; its creation (1 000 seeds, `maxTurns` 200, per seed `fnv1a32` over the joined per-turn `digestBattleState` values, createBattle state first) was never entered here.
Evidence: `packages/core/IMPLEMENTATION-NOTES.md` item 17; `packages/core/test/fuzz.ts`. Finding L2-21.
Affects: none.

## 2026-09-25 — `00-spine.md` §2.10 — `resolveTurn`'s `null` rule includes every non-player side in every phase
Why: the block said an action may be null ONLY in the replacement-phase exception, which contradicted the server rule three lines below (the server passes `null` for every NPC side) and made an NPC whose active fainted unresolvable.
Evidence: `packages/core/src/turn.ts` lines 176–178; `packages/core/IMPLEMENTATION-NOTES.md` item 14. Finding L2-19.
Affects: `50-verification-budget.md` §50.4.1 `validate-action.test.ts` row.

---

## 2026-09-25 — `40-pipelines.md` §40.1.2 stage 4 — emissive mask = bright and vivid (HSV value ≥ 0.92, chroma ≥ 0.4) with an 8 % coverage cap
Why: the render part-3 browser check found pale creatures glowing at night and blooming at noon. HSL saturation × lightness tends to 1 for any faintly tinted near-white, so 42–49 % of `mufflo` and `dreambud` and 31 % of `glimp` were emissive, while a pure saturated red scored 0.5 and never emitted. Without a cap the corrected rule marks 30–54 % of flame creatures.
Evidence: coverage survey over the 260 cached sprites (old rule: 34 sprites above 10 %; new rule without cap: mufflo/dreambud/glimp 0 %, flampling 54 %); `packages/render/IMPLEMENTATION-NOTES.md` Part 3, orchestrator item 3.
Affects: `tools/sprite-pipeline/src/{emissive,emissive-overrides,types,index}.ts` (`SPRITE_STAGE_VERSION` 3, `PIPELINE_VERSION` 5), `test/stages.test.ts`; every emissive atlas under `packages/client/public/creatures/`.

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
