# EWAMON — HOSTILE RENDER & ARCHITECTURE AUDIT OF THE LEGACY BUILD

**Author:** Lead technical art director
**Status:** INPUT to `.design/SPEC.md`. Nothing here is binding; every finding is a claim the SPEC must either answer or explicitly decline.
**Subject:** `C:\Users\Flowmatic - Redouane\Ewamon\ewamon\frontend\src\world3d\` (the 3D overworld) and the 2D battle path under `frontend/src/components/battle/`, plus the backend files they depend on. Line numbers are against the working tree at commit `7ad5aaf`.
**Method:** every claim below was produced by reading or grepping the named file and is reproducible with the quoted grep. Where a number is *derived* rather than *measured* it says so. Where `PLAN.md` states a number this audit could not reproduce, section 6 says so.

Line counts (`wc -l`): `overworld.js` 2594, `ui.js` 607, `world.js` 622, `characterModels.js` 317, `state.js` 259, `audio.js` 227, `World3D.js` 212, `data.js` 160, `hud.css` 158, `remoteAppearance.js` 96. Total under `world3d/`: 5260.

---

## 0. VERDICT

The old world is a competently organised toy. The image is a flat-shaded vertex-colour primitive soup under a single 92 × 92-unit shadow box, with three lights for an entire zone and a post stack that is one bloom pass plus a 15-line vignette. The code holds rendering, content, collision, camera, day/night, weather, puzzles, story scripting, networking, DOM HTML and minimap painting in one 2594-line object literal, leaks every geometry and material on every zone change, rebuilds HUD DOM inside the 60 Hz fixed step, and awards gym badges from the client. The battle screen is a separate React page that draws PNGs onto a PNG. Roughly a quarter of the roster is unreachable by play, and four whole server subsystems are keyed to zone ids that were deleted in the world rewrite.

None of this is an engine ceiling. It is an art-pipeline, lighting-discipline and package-boundary problem, which is exactly what the SPEC exists to fix.

---

## 1. THE IMAGE

Findings are numbered **R-n**. Each has: the claim, the evidence, why it costs quality.

### R-1. There is no image texture on any environment surface.

- `grep -n "TextureLoader" world3d/*.js` → **0 hits.**
- The only textures in the world are `CanvasTexture`s painted at module load: `overworld.js:128` (64² pixel face, `NearestFilter`), `:275/:286/:325/:354` (text, emote and chat bubble sprites), `:379` `DOT_TEX` 64² radial, `:383` `DISC_TEX` 64², `:385` `RING_TEX` 128², `:390` `GRASS_TEX` 64².
- The only `MeshStandardMaterial` in the world with a `map` is the ground-clutter blade material at `overworld.js:955` (`map: GRASS_TEX`).
- Every other surface is `propMat(color, rough, emissive)` at `overworld.js:375-376`: `new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02, flatShading: true })`. No normal, no roughness map, no AO map, no env map (`grep -n "envMap\|PMREM\|environment" world3d/*.js` → 0 material hits).
- Terrain is per-vertex colour only: `overworld.js:880-889` fills a `Float32Array(pos.count*3)` colour attribute and creates `MeshStandardMaterial({ vertexColors: true, roughness: 0.97, flatShading: true })`.

**Cost.** Nothing has scale. A 0.3-unit rock and a 40-unit mountain cone read as the same material because they are the same material. Biomes differ only by the colour table at `overworld.js:459-471` (`BIOME.forest` … `BIOME.spire`, each a bag of hex strings).

### R-2. Everything is a primitive.

- Trees: `overworld.js:402-431` — trunk `CylinderGeometry(0.13s, 0.26s, h, 6)`, pine canopy `ConeGeometry(r, h, 7)` × 3–4 layers, round canopy `IcosahedronGeometry(r, 0)` × 4–6 blobs.
- Rocks: `:432-434` `DodecahedronGeometry(r, 0)`. Bushes: `:435-436` `IcosahedronGeometry(r, 0)`. Flowers: `:928` `ConeGeometry(0.13, 0.42, 4)`. Mountains: `:895-897` `CylinderGeometry` / `DodecahedronGeometry(hh*0.7, 0)` / `ConeGeometry(11+rng()*9, hh, 5)`.
- Buildings: `:1050-1060` `BoxGeometry` walls on a `BoxGeometry` plinth with `BoxGeometry` posts; 29 `new THREE.Mesh(` sites in the 1040–1200 building block, all box/cylinder/cone/plane.
- Humanoids: `createTrainerModel` `:144-262`, 24 `part(...)` calls, every part `box()` or `cyl(t, b, h, 6)`.
- There is exactly one chamfer, fillet, lathe or extrusion in the file: **none** (`grep -n "LatheGeometry\|ExtrudeGeometry\|ShapeGeometry\|bevel" overworld.js` → 0).

**Cost.** A 90° box edge catches one flat value. Nothing in frame has a specular line that moves with the camera, so the eye reads "model kit", not "place".

### R-3. No material reuse; a new material per mesh.

- `grep -c "new THREE.MeshStandardMaterial" overworld.js` → **30** literal sites.
- `grep -o "propMat(" overworld.js | wc -l` → **131** call sites, each allocating a fresh `MeshStandardMaterial` (`:375`).
- `grep -o "toonMat(" overworld.js | wc -l` → **10** sites, each a fresh `MeshToonMaterial` (`:79`).
- Shared materials that do exist: `HUMAN_OUTLINE` `:73`, `WORLD_OUTLINE` `:373`, `AO_MAT` `:389`, `TOON_GRAD` `:77`. Four.
- Materials are created inside per-instance loops: `makeTree` creates a new `propMat` for the trunk and *one per canopy blob* (`:405`, `:418`, `:427`); with `50·dens` perimeter trees (`:912`) and `11·dens` hero trees (`:915`) in a forest zone (`dens 1.25`, `:459`) that is ~75 trees × 5–7 materials ≈ 450 materials for trees alone, none deduplicated.

**Cost.** Three.js cannot batch across materials; every material is a program-state change; and every one of them is leaked on zone change (A-2).

### R-4. Outlines double the draw count.

- `hOutline(mesh, k)` `overworld.js:74` and `wOutline(mesh, k)` `:374`: `new THREE.Mesh(mesh.geometry, OUTLINE_MAT)` with `side: THREE.BackSide`, `scale *= 1+k`, added as a child of the mesh.
- 30 direct `wOutline(`/`hOutline(` call sites, plus `part()` at `:151` applies `hOutline` to each of the 24 humanoid parts. Every tree trunk, canopy blob, rock, bush, post, wall and spire gets one.
- The outline material is unlit `MeshBasicMaterial`, so it still costs a full draw with its own program.

**Cost.** For every outlined mesh the GPU rasterises the geometry twice. The BackSide trick also fails on concave geometry and at silhouette self-intersections — the seam where canopy blobs overlap shows a dark web at `k = 0.04`.

### R-5. One 2048² shadow map over a 92 × 92-unit box.

- `overworld.js:690-692`: `sun = new DirectionalLight(0xfff2d8, 1.15); sun.castShadow = true; sun.shadow.mapSize.set(2048,2048); near 1; far 130; left/right/top/bottom = ∓46/±46; bias -0.0006; normalBias 0.02.`
- `World3D.js:66-67`: `shadowMap.enabled = quality !== 'low'; type = PCFSoftShadowMap.`
- The box follows the player: `:2181-2182` `sun.position.copy(center).addScaledVector(sdir, 40); sun.target.position.copy(center)`.
- Texel = 92 / 2048 = **4.5 cm**. Anything beyond 46 units from the player has no shadow at all; the perimeter forest at `r = 39..63` (`:912`) is built with `shadow = false` (`:913`) to hide that.
- No cascades (`grep -n "CSM\|cascade" world3d/*.js` → 0).

**Cost.** The mountain ring, the far half of the perimeter forest and the sea plane (`:905-907`) sit in flat hemisphere light while the foreground has contact shadows. The image has a visible "shadow horizon".

### R-6. Three lights for a whole outdoor zone; every "light source" is an emissive that lights nothing.

- The complete outdoor rig: `overworld.js:689` `HemisphereLight(0xcfe8ff, 0x4a5a3a, 0.85)`, `:690` the sun, `:695` `DirectionalLight(0x9ab6e0, 0.35)` fill. `grep -n "PointLight\|SpotLight\|RectAreaLight" overworld.js` → one hit, `:1239`, **inside interiors only** (two `PointLight(th.light, 1.0, 30, 2)` per room).
- Street lamps `:963-970`: post + `IcosahedronGeometry(0.24, 0)` bulb with `emissive '#ffcf6a', emissiveIntensity 0.3`. The bulb's intensity is driven by `windowMats` at `:2184-2185` (`glow = 0.3 + (1-day)*1.7 + dark*0.6`). No light is attached to any lamp.
- Same pattern for windows `:1055`, gym beacon spire `:1077`, cracks `:1175`, gym cloth `:1187`, puzzle plates `:1380`, legendary self-illumination `:1973` (`emissiveMap = map; emissive white; intensity 0.6`).
- Night is a global multiply: `:2177-2179` `sun.intensity = (0.55 + day*0.75)*(1-dark*0.45); hemi.intensity = (0.65 + day*0.45)*(1-dark*0.4)`.

**Cost.** At night the lamps glow but the ground under them is the same brightness as the ground between them. There is no pool of light anywhere in the game. This single fact is most of why the world reads as a toy.

### R-7. Post stack is bloom + vignette. No AO, no TAA, no DOF, no IBL.

- `World3D.js:14-18` imports exactly `EffectComposer, RenderPass, UnrealBloomPass, OutputPass, ShaderPass`.
- `:79-88`: `WebGLRenderTarget(w, h, { type: HalfFloatType, samples: 4 })` → `RenderPass` → `UnrealBloomPass(res, strength 0.6, radius 0.6, threshold 0.82)` (skipped on `quality === 'low'`) → `OutputPass` → `ShaderPass(GRADE_SHADER)`.
- `GRADE_SHADER` `:27-45`: tint multiply, luma desaturate, `smoothstep(0.42, 0.85, d) * uVig` vignette, `clamp(col, 0, 1)`. That is the entire "colour grade".
- Anti-aliasing is 4× MSAA on the render target plus `antialias: true` on the renderer (`:64`), which the composer path ignores.
- Bloom threshold 0.82 is fixed and is not tied to any measured scene value; the emissive puzzle plates at `emissiveIntensity 1.2` (`:1369`) and legendary orbs at `1.1..1.4` (`:1281`, `:1956`) bloom, but so does the `#fff` text sprite and the `#ffe06a` warp marker.

**Cost.** No occlusion darkening anywhere: crevices, building bases and tree roots are lifted to the same value as open ground, which is what makes the AO decals at `:963` (`_aoBlob`, a `DOT_TEX` plane at α 0.34) necessary as a hand-placed fake.

### R-8. Sky is a 3-colour gradient; fog is a per-zone scalar.

- `overworld.js:699-703`: `SphereGeometry(420, 32, 18)`, `ShaderMaterial` with `top/bot/glow` colours and a `smoothstep` horizon band. `_setSky` `:1008-1014` derives `top = horizon * 0.62`.
- `:769` `scene.fog = new FogExp2(a.sky, a.fog || 0.01)`; interiors `:1218` `FogExp2(th.fog, 0.012)`. Weather multiplies density `×3.0 / ×1.8 / ×1.3` (`:1499`).
- Sky bodies are `Sprite`s with `depthTest: false` (`:2210`). There is no sun disc that agrees with the shadow direction.

**Cost.** No IBL means the sky contributes nothing to shading; `HemisphereLight` is a two-colour approximation with no directionality. Chrome, water (`:905`, `metalness 0.1`) and wet stone cannot read.

### R-9. Camera: an orbit rig with hand-tuned magic numbers.

- `overworld.js:688` `PerspectiveCamera(55, aspect, 0.1, 900)`. `:652` `cam = { yaw 0.6, pitch 0.52, dist 11.5 }`. Wheel clamps `dist` to `7..20` (`:726`); drag clamps `pitch` to `0.06..1.15` rad (`:725`).
- Follow lerps at three different rates: `dt*8` yaw/pitch, `dt*6` dist (`:2135`), `dt*12` position (`:2145`), `dt*24` snap-in vs `dt*6` drift-out for occlusion (`:2142`).
- `_camCollide` `:2150-2175` runs a ray-vs-AABB over every collider and a ray-vs-circle over every solid **every fixed step**.
- `far = 900` against a sky dome of radius 420 that rides the camera (`:2146`): 480 units of far plane buy nothing but depth precision loss.

**Cost.** The framing is whatever the player last dragged. There is no authored lens, no fixed angle, no DOF plane. The 55° vertical FOV at 11.5 units is a wide-angle "RPG camera", the opposite of the diorama the PLAN calls for.

### R-10. Instancing exists only for scatter; no LOD, no merging, no culling strategy.

- Instanced: flowers `:937` (one `InstancedMesh` per colour), ground clutter `:956` (`520·dens` positions × 2 crossed blades per colour), tall grass `:1720` (4 patches × 60 blades).
- Not instanced: every tree, rock, bush, building, lamp, NPC, mountain (`:402-436`, `:912-920`, `:895-902`).
- `grep -n "THREE.LOD\|BufferGeometryUtils\|mergeGeometries" world3d/*.js` → **0**.
- `frustumCulled = false` is set on the ambience `Points` `:1451`, rain `:1481`, flakes `:1488`, sky glow `:400` and every legendary mesh `:1971`.
- `renderer.info` is never read (`grep -n "renderer.info" world3d/*.js` → 0). The old build never measured its own draw calls.

**Derived draw-call estimate for Mirevale** (forest, `dens 1.25`, not measured — see §7 Q-3):

| Source | Count | Draws each (mesh + outline) | Main pass |
|---|---|---|---|
| Perimeter trees `:912` | 62 | 10–14 | ~740 |
| Hero trees `:915` (cast shadow) | 13 | 10–14 | ~156 (+156 shadow pass) |
| Rocks `:919` / bushes `:920` | 11 / 13 | 2–4 / 4–6 | ~100 |
| Humanoids (5 NPC + attendant + player, `world.js` mirevale block, `overworld.js:1730`) | 7 | 49 (24 parts × 2 + face) | ~343 (+~170 shadow) |
| Buildings `:1040-1200` (gym, shop, healer) | 3 | ~20–30 | ~75 (+~40 shadow) |
| Ground, path, plaza, sky, sea, mountains `:895`, lamps, signature set-piece, instanced scatter (≤ 12) | — | — | ~60 |
| **Total** | | | **≈ 1,450 main + ≈ 370 shadow ≈ 1,800** |

The PLAN's "~1,000–1,200" is therefore probably an *under*-estimate. Either way it is 3–4× the rebuild's 400-draw cap and it must be measured, not derived (Q-3).

### R-11. Terrain is 226 × 226 units; the player may use 74 × 74 of it.

- `overworld.js:658` `const HALF = 38`. `:858-859` `SIZE = HALF*2 + 150 = 226; PlaneGeometry(226, 226, 120, 120)` — 14,641 vertices, 28,800 triangles, rebuilt on every `loadArea`.
- A real heightfield is computed (`hAt`, `:864-877`: micro noise, ramp past `coreR`, mesa steps, water level) and stored as `groundHeightAt` (`:878`) — then used **only for the camera** (`:2144`).
- The player is hard-clamped: `:2095` `if (Math.abs(x) > HALF-1 || Math.abs(z) > HALF-1) return null;` → walkable |x|,|z| ≤ 37, i.e. 74 × 74 = 5,476 of 51,076 units² = **10.7 %**.
- Gravity is against `y = 0` (`:2099` `if (player.position.y <= 0) { player.position.y = 0; … }`); the heightfield is not a collision surface.

**Cost.** Everything with vertical interest — the ramp, the mesa, the shoreline — is scenery you cannot reach. The PLAN's "76×76" should read 74×74 (`HALF-1`).

### R-12. Per-step allocation in the frame loop.

Inside `update(dt)` (`overworld.js:2058-2078`) and its callees, per 1/60 s step: `:2136` `player.position.clone().add(new THREE.Vector3(...))`, `:2137` `new THREE.Vector3(...)`, `:2143` `tgt.clone()`, `:2181` `new THREE.Vector3(...)` for the sun direction, `:2124` a `new THREE.Vector3` per pickup within 5 units, `:2227` two `new THREE.Vector3` in `_updateSkyBodies`. Minimum 6 `Vector3` per step → 360/s at steady state, 1,800/s during a 5-step catch-up (`World3D.js:144`).

`_updateGrass` `:2238-2250` recomposes a `Matrix4` for **every** tall-grass blade (240 blades, `:1720`) every step and uploads `instanceMatrix` even when nothing moved.

### R-13. Assets: 36 MB of pretty-printed glTF awaited before first frame.

- `frontend/public/models/quaternius/`: 19 `.gltf`, **36 MB** (`du -sh`). Example `BlueSoldier_Male.gltf`: 1,857,885 bytes, **28,432 lines**, one embedded `data:…;base64` buffer. `legendaries/`: 8.8 MB.
- No KTX2, meshopt or Draco anywhere in the engine (`grep -n "KTX2\|meshopt\|DRACO" world3d/{World3D,overworld,characterModels}.js` → 0).
- `characterModels.js:172-177`: `CAST_SET` = union of `PLAYER_LOOKS` (2), `ROLE_FIXED` (5), all `NPC_POOLS` (7+6+4+8), every `CAST` entry and the two Order looks; `preloadOverworldCast()` is `Promise.all(CAST_SET.map(loadCharacter))`.
- `MapExplorer.tsx:181`: `preloadOverworldCast().then(() => world.start())`. Nothing renders until every character in the game has downloaded.
- `loadCharacter` `:59-66` caches per key (good) but `new GLTFLoader()` per call and no `KTX2Loader`/`MeshoptDecoder` registration.

### R-14. Variant tinting is a per-pixel CPU HSL pass.

- `components/shared/VariantSprite.jsx:38-59` hand-rolled `hslToRgb`; `:65-74` per-pixel hue/sat/light shift; `:159-160` `getImageData` → `applyVariantToImageData` → `putImageData` on an offscreen canvas, per sprite, per mount.
- Five palettes (`normal/dawn/dusk/verdant/ember`, `utils/liveOps.js`) × alpha flag = 10 CPU passes over a 148 × 148 draw target per visible sprite.

### R-15. Battles are a different application drawing PNGs on a PNG.

- `MapExplorer.tsx:86-91`: on encounter `world.pause()` then `window.dispatchEvent(new CustomEvent("ewamon:start-battle", { detail: { mapId } }))`. `App.jsx:75` `const [tab, setTab] = useState("dashboard")`; `:124` `setTab("battle")`. The 3D canvas is hidden; a React page is shown.
- `BattleScene.jsx:24-33`: `battleBackgrounds = { pvp: "pvp-battle-bg.png", wild: "wild-battle-bg.png", trainer: "trainer-battle-bg.png" }`, applied as CSS `backgroundImage: linear-gradient(...), url(...)`, `backgroundSize: "cover"`.
- Creatures are `<img>`: `WildBattleScreen.jsx:36-38` `src = \`${SPRITE_BASE}${dir}/${speciesId}(${dir}).png\`` via `VariantSprite`, `width={148} height={148}`.
- Move VFX are DOM: `BattleAnimationLayer.jsx:41-43` `<div className="battle-scene-overlay">` + slot divs; eleven hand-authored SVG components (`CosmicMiracleSVG`, `KamehamehaSVG`, `FoxfireVoltageSVG`, `FrozenTempestSVG`, `RiftCollapseSVG`, `SparkingGraceSVG`, `StellarDevourSVG`, `SunbreakerBarrageSVG`, `CosmicPyreSVG`, `StatChangeSVG`, `StatusConditionSVG`, 168–389 lines each).
- The zone's lights, sky, fog, weather and time of day are not visible in the fight. The `theme: a` passed at `overworld.js:2269` reaches the battle screen as a colour hint, not a scene.

---

## 2. THE ARCHITECTURE

Findings are numbered **A-n**.

### A-1. One object literal owns everything.

`overworld.js` exports a single `Overworld` object whose methods include: `loadArea` (`:759`), `_buildGround`, `_buildProps`, `_buildBuildings`, `_buildLamps`, `_buildNPCs`, `_buildGrass`, `_buildAmbience`, `_buildWeather`, `_buildInterior`/`_interiorShell` (`:1216`), `_pzWin`/puzzle logic (`:1360-1437`), `_gymChallenge`/`_eliteChallenge`/`_championChallenge` (`:2326-2340`), `_onBattleEnd` with badge and story-flag awards (`:2455-2491`), `_warpAllowed` (`:2493`), `_journalHTML` and a `style.cssText` journal panel (`:2553-2556`), `_drawMinimap` (`:2508`), `_broadcastPosition` (`:1697`), `upsertRemotePlayer` (`:1580`), `sendChat`/`emote` (`:1633-1660`), `_updateCamera`/`_camCollide`, `_updateDayNight`, `_updateWeather`, `_eclipseProgress`. Rendering, content, collision, camera, networking, story, DOM and 2D painting in one file. There is no boundary an ESLint rule could enforce because there is no module to point it at.

### A-2. Zone change disposes nothing.

- `loadArea` `overworld.js:763`: `while (areaGroup.children.length) areaGroup.remove(areaGroup.children[0]);` — `Object3D.remove` detaches; it does not call `geometry.dispose()` or `material.dispose()`.
- A correct helper exists, `disposeObject3D` `:290-293` (traverses, disposes geometry, every `isTexture` property, then the material). It is called in exactly seven places — remote-player avatars (`:1609`, `:1618`, `:1624`), chat/emote bubbles (`:362`, `:1669`, `:1673`) and the story cast (`:2430`) — never for the zone.
- Per `loadArea`, leaked: one 14,641-vertex terrain (`:859`), ~75 trees × (1 trunk + 3–6 canopy) geometries each (`makeTree` allocates fresh `CylinderGeometry`/`ConeGeometry`/`IcosahedronGeometry` per tree, `:404-427`), all rocks/bushes/buildings/NPC parts, every `propMat` material (R-3), every `CanvasTexture` name tag (`makeTextSprite`, `:272`).
- Only `Overworld.dispose()` (`:2578-2588`) traverses `scene` and disposes — on React unmount, not on warp. A session that walks 21 zones holds 21 zones of GPU memory.

### A-3. The HUD is DOM rebuilt inside the fixed step.

- `World3D.js:24` `STEP = 1/60`; `:144` `while (this._acc >= STEP && n < 5) { Overworld.update(STEP); … }`.
- `Overworld.update` `:2058-2078` ends with `UI.updateHUD();` (`:2076`) and `this._drawMinimap();` (`:2077`).
- `UI.updateHUD` `ui.js:158-183`: sets four `textContent`s, `badgeCase.innerHTML = BADGES.map(...).join('')` (`:165`), then `rib.innerHTML = ''` and re-creates one card element per party member via `el(\`<div class="pmini">…\`)` (`:168-182`) — six `innerHTML` parses + six `appendChild`s per step.
- `_drawMinimap` `:2508-2540` clears and repaints a 168² 2D canvas — background, path, every grass patch, every warp, every interact dot, quest marker, player arrow — per step.
- Worst case after a hitch: 5 steps in one frame → 5 HUD rebuilds and 5 minimap repaints for one displayed frame. `World3D.js:147` also calls `UI.update(dt)` once per frame, so there are two HUD update paths.

### A-4. Gym badges are awarded client-side, and the server accepts the laundering flag.

- `overworld.js:2332`: `award: { badge: G.badge, flag: 'gymwin_' + a.gym, post: G.post }`.
- `:2457-2462`, verbatim: *"Register the gym Badge on a win. The server SHOULD grant it via the league battle, but that round-trip is unreliable, so the overworld (the canonical gym path) awards it directly; it persists via the accepted `gymwin_` flag, which hydrateFromPlayer re-derives the badge from on the next load."* Then `awardBadge(aw.badge)`.
- `state.js:199` `awardBadge(id) { state.player.badges.push(id); setFlag('badge_' + id); }`; `:117-124` on hydrate, every `gymwin_*` flag is turned back into a badge (`GYM_BADGE[k.slice(7)]`) and re-emitted as `badge_*`.
- Server `routes/player.js:621-623` comment says progression flags "are rejected here"; `:629` `ALLOW_PREFIX = /^(done_|saw_|met_|lore_|found_|gymwin_|leg_|visited_|tr_|pk_)/` — `gymwin_` is **in** the allow-list.
- Consequence: `POST /player/world-state { storyFlags: { gymwin_verdant: true } }` from any client → badge on next hydrate → `_warpAllowed` `:2495` (`!hasBadge(a.gate)`) opens the east gate. The server's own league path (`wildBattleService.js:158-166`) also awards the badge, so the client path is both redundant and exploitable.
- Same route, `:656-663`: overworld pickups are granted for **any** `pk.id` string ≤ 40 chars whose `item` is in `FINDABLE` (includes `prism_orb`, `crest_orb`, `dusk_orb`), qty ≤ 3 — with no check that the id exists in any zone. Unlimited invented ids = unlimited orbs.
- `overworld.js:2437` `addToParty(instantiateCreature(id, 5))` mutates the mirrored party locally; `state.js:239` admits *"The server only accepts position + dex sightings."* The in-world starter grant is a UI-only mutation.

### A-5. Wild encounters are rolled twice, from two different tables, and the client's roll is discarded.

- Client: `overworld.js:2264-2269` `table = ENCOUNTERS[a.encounter]` (from `world.js:453`, keys `mire, ash, tide, galvan, deepcut, hollow, siege, ascent`; **39 distinct species**), picks a species, calls `instantiateCreature(pick[0], level)`.
- `MapExplorer.tsx:86-91` ignores that creature and forwards only `{ mapId }`.
- Server: `wildEncounterService.js:93` `rollEncounter(zone)` from `worldImported.js:53` `ENCOUNTER_TABLES` (keys `mire_route … ascent_route`; **49 distinct species**).
- Two spawn tables, two key namespaces, different rosters; the grass tells you one creature and the battle shows another.

### A-6. Presence is an un-ticked relay; fanout is quadratic.

- Client send: `overworld.js:1697-1700` `_moveAcc += dt; if (_moveAcc < 0.1) return;` → **10 Hz** while moving.
- Server: `worldSocket.js:253` limiter `{ windowMs: 1000, max: 15 }`; `:289` silent drop; `:299` `socket.to(res.area).emit("world_move", …)` — every accepted packet to every other socket in the area. No tick, no batching, no AOI.
- Rate = 10 · N · (N−1) msg/s: N=30 → 8,700; N=200 → 398,000.
- Client mitigation: `:649` `REMOTE_CAP = 30`; `:1585` `if (remotePlayers.size >= REMOTE_CAP) return false;` — the 31st avatar is dropped *after* its packets are parsed.
- Smoothing: `:1628-1631` `k = min(1, dt*10); cur += (target - cur) * k` — exponential, no timestamps, no interpolation buffer; rubber-bands on jitter.
- Coordinate clamp: `worldSocket.js:45` `COORD_BOUND = 128` vs walkable ±37 (R-11) — a modified client may stand 3.4× outside the zone.
- Every remote body change rebuilds the whole avatar (`:1604-1611`).

### A-7. Four server subsystems are keyed to zone ids that no longer exist.

Canonical ids: `worldImported.js:21-36` `MAP_NAMES` = the 21 `mirevale … the_rift`.

| Subsystem | File | Ids used | Overlap with `MAP_NAMES` |
|---|---|---|---|
| Quests | `questUtils.js:32-110` | 16 distinct `zoneId`s: `bloom-route`, `ember-town`, `tidal-route`, `volt-town`, `stone-route`, `phantom-town`, `iron-route`, `draco-town`, `vanguard-arena` … | **0** |
| Seasonal events / featured zones | `liveOps.js:33` `EARLY_GAME_ZONES = pallet_town, route_1, route_21`; `:69` `featuredZones` | **0** |
| Daily swarms | `liveOps.js:84-89` `pallet_town, route_1, route_21, route_2, cerulean_city, safari_zone` | **0** |
| Exploration hotspots / raids | `explorationDirector.js:15-23` `ZONE_ORDER` 8 `*-route` ids; `:48` *"TMJ maps are 30 wide × 20 high"*; `:49-108` **16** hotspots with tile `x, y` | **0** |

`questUtils.js:224-232` `markZoneObjective(player, zoneId)` compares `obj.zoneId === zoneId` against `mapPosition.mapId`. It has never matched. The hotspot coordinates are in a tile space the world does not have.

### A-8. Roster coverage.

Measured by evaluating `ewamon.js` and grepping `world.js` (`ENCOUNTERS`, `LEGENDARIES`), `worldImported.js` (`ENCOUNTER_TABLES`) and `routes/auth.js:63` (starters `bramblecub, glimfin, cindercap`):

- Data: **130** species, **193** moves, **19** types, **25** abilities, **17** items, **10** orbs (`ewamon.js:2903` exports). **61** `evolvesInto` edges → **69** evolution roots.
- Species in `world.js ENCOUNTERS`: 39. In `worldImported ENCOUNTER_TABLES`: 49. In `LEGENDARIES`: 10.
- Species in **no** spawn, legendary or starter table: **81 / 130**.
- Whole evolution lines with **no** member in any table: **39** species. Removing the two registration-starter lines that are not in tables (`bramblecub→briarbear→thornback`, `cindercap→pyrecap→infernomorel`) leaves **33 species unobtainable by play** — they exist only as trainer/league opponents or nowhere.
- The PLAN's five named (`wraithtide, kygra, ripshell, bloomsprite, acier`) are all confirmed: none appears in any table; `acier` appears once in `world.js`, in a trainer team (`T('acier', 42)`).
- Battle-pass grants (`battlePass.js:69` `lumyth|noxmyth` choice; `zenryu`) do not change the count above.

### A-9. Two battle implementations that disagree.

- `grep -c accuracy battleSocket.js wildBattleService.js` → **0, 0**. The four sub-80 moves (`Poison Fog 75, Hypno Fog 55, Dragon Rush 75, Blizzard 70`) never miss. Nothing misses.
- `battleSocket.js:173` `case "lower_atk": attacker.atk = …*0.8` (hits the **attacker**); `wildBattleService.js:60` `defender.atk = …*0.8`.
- Stat changes are permanent mutations of `atk/def/spd` in both (`battleSocket.js:173-178`, `wildBattleService.js:60-80`); no stage table.
- `ewamon.js:2879-2880`: `crit = Math.random() < 0.0625 ? 1.5 : 1; return Math.max(1, floor(base*rand*crit*typeMult))` — min 1 at `typeMult 0`; no STAB factor anywhere in the function.
- `battleSocket.js:702-714` `Intimidate` ×0.8 on switch-in, in addition to the per-calc handling.
- `rankUtils.js:73` `loserDelta = Math.max(10, round(loserK*(0-expectedLoser)))` — the loser gains ≥ 10.
- `league.js:314` `championCleared: defeatedSet.has("goku")`.
- 23 distinct `effect` keys in `MOVES`; the two switch statements implement a subset each.

### A-10. Four visual languages, 577 tiny type declarations, a ~940 ms blocking transition.

- `world3d/hud.css:14` `'Trebuchet MS'` cream-paper HUD; `components/cosmic/atoms.jsx:24` `PX = "'Press Start 2P',monospace"`; `overworld.js:2553-2556` journal panel via `style.cssText` with a hard-coded gold gradient; the PvP challenge modal is inline-styled in `App.jsx`.
- `grep -rc "fontSize: *[5-8]\b\|font-size: *[5-8]px" components` → **577** declarations at 5–8 px (top: `cosmic-page-polish.css` 73, `MapExplorer.css` 62, `BattleArena.css` 56, `RaidOverlay.css` 41). In-world HUD: `hud.css:95-99` level 9 px, status 8 px, HP 8 px.
- `components/cosmic/motion.jsx:221-233` `AppOverlay`: `pointerEvents = 'all'`, `clip-path 500ms` circle-in, then `opacity 380ms ease 60ms` out → **~940 ms** of blocked input per tab change; `App.jsx:406` mounts it globally.
- Navigation is `useState("dashboard")` (`App.jsx:75`): no URL, no back button.

---

## 3. WHAT PLAN.MD CLAIMED, AND WHAT THE CODE SAYS

| PLAN.md claim | Verified? | Correction |
|---|---|---|
| No `TextureLoader` | Yes (R-1) | — |
| "`new MeshStandardMaterial` per mesh across 122 call sites" | Yes in spirit | 30 literal + 131 `propMat` + 10 `toonMat` = **171** allocation sites (R-3) |
| BackSide outline clones | Yes (R-4) | — |
| One 2048² map, 92 × 92 frustum, nothing past ~46 units | Yes (R-5) | — |
| Lamps/lava/braziers/beacons are emissive-only | Yes outdoors (R-6) | Interiors have 2 `PointLight`s per room (`:1239`) — the only real lights in the game |
| Post = bloom + 15-line vignette | Yes (R-7) | The grade shader is 13 lines incl. tint + desaturate; bloom `(0.6, 0.6, 0.82)`; 4× MSAA target |
| Battles 2D PNG on PNG | Yes (R-15) | — |
| Zone change never disposes | Yes (A-2) | `disposeObject3D` exists and is used for 7 non-zone cases |
| HUD DOM rebuilt in the fixed step | Yes (A-3) | Plus the minimap canvas repaint, plus a second `UI.update` per frame |
| Client-side badge via `gymwin_` | Yes (A-4) | Server allow-list **accepts** `gymwin_` (`player.js:629`); pickups are also exploitable |
| Fanout 10·N·(N−1) | Yes (A-6) | Server cap 15/s/socket; client 10 Hz |
| Dead subsystems on retired ids | Yes (A-7) | 16 quest zone ids, 16 hotspots, 6 swarm ids, 3 early-game ids — 0 overlap |
| "45 of 130 species appear nowhere" | **Not reproduced** | 81 absent from all tables; 39 whole lines absent; **33 unobtainable by play** (A-8). The five named are confirmed |
| "~1,000–1,200 draw calls" | **Not measured** | Derivation gives ≈ 1,450 main + ≈ 370 shadow (R-10); must be measured |
| "226 × 226 terrain, 76 × 76 walkable" | Yes / off by two | Clamp is `HALF-1` → **74 × 74** (R-11) |
| "36 MB pretty-printed base64 glTF awaited before first frame" | Yes (R-13) | 19 files, 28,432 lines each, `Promise.all` before `world.start()` |
| "900 ms blocking clip-path transition" | Approximately | 500 ms in + 60 ms delay + 380 ms out ≈ **940 ms** (A-10) |
| "5–8 px `Press Start 2P` for most labels" | Partly | 577 declarations at 5–8 px; the in-world HUD is Trebuchet, not Press Start |
| "67 evolution lines" | **Not reproduced** | 61 edges → **69** roots (A-8) |
| "two catch formulas" | Not re-verified here | `wildBattleService.js:421-425` has one; the PvP path has no catch. Left to the core audit |

---

## 4. WHAT WAS GENUINELY GOOD AND IS CARRIED FORWARD

**G-1. The `AREAS[id]` authoring record.** `world.js:37-448`, 21 zones. One record per zone: `name, type, kind, music, ground, ground2, sky, fog, dark, props, landmark, veinColor, gym, shop, healer, links, npcs[], trainers[], encounter, gate`. Layered lookups behind it: `BIOME[a.props]` (`overworld.js:459-471`), `LAYOUT[a.layout]` (`:546-556`), `SIGNATURE[id]` (`:562-583`), `terrainFor(a)`. A designer edits ~15 scalars and the world rebuilds. **Keep the shape; replace the generators.**

**G-2. Deterministic seeding.** Every scatter uses `mulberry(hashStr(a.name) + k)` (`:891`, `:909`, `:1717`). A zone rebuilds identically. This is the prerequisite for the leak test and the screenshot diff in the SPEC's verification section.

**G-3. Presence store purity.** `worldSocket.js:111-160` `createPresenceStore()` returns plain `Map`s (`areas: area → Map<playerId, Presence>`, `sockets: socketId → {playerId, area}`, `playerSockets: playerId → Set<socketId>`); `removeSocket`/`enterArea` are pure functions over it, exported for tests (`:423`). Presence is keyed by **playerId** so multi-tab collapses to one avatar. **Keep as the model for the AOI grid.**

**G-4. Challenge handshake re-checks presence before committing.** `worldSocket.js:379-386`: after `takeChallenge` succeeds, *"Re-check the challenger is STILL present in our area … Bail before createDirectBattle."* The comment explains the failure it prevents (a half-started room stranding both players). **Keep the pattern: re-validate at the moment of side effect, not at the moment of request.**

**G-5. `toPublic()` as an allow-list.** `Player.js:336-344`: iterate `PUBLIC_FIELDS`, copy only those. New fields are private by default. **Carry into the Drizzle repository layer as a typed projection.**

**G-6. `escapeRegex` on every user string reaching a query.** `utils/escapeRegex.js:4` `replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`, used in `routes/admin.js`, `routes/marketplace.js`, `routes/player.js`. Postgres `ILIKE` needs the equivalent for `%`/`_`.

**G-7. The battle timeline concept.** `moveAnimationRegistry.js` (per-move recipe) → `buildTurnTimeline(events, slotMap)` (`buildTurnTimeline.js:22`, normalises slots, maps server events to timed presentation steps) → `useBattleTimeline` (`useBattleTimeline.js:24`, a promise queue with a global speed factor `1 / 0.5 / 0.2`) → an animation layer. Server truth in, presentation out, one direction. **Retarget the same four stages from DOM to the 3D arena.**

**G-8. Smaller things worth keeping.** Scoped input listeners removed on dispose (`World3D.js:92-94`, `:192-206`); the 5-step spiral-of-death cap (`:144`); the wind shader's `USE_INSTANCING` branch (`overworld.js:440-456`); `disposeObject3D` (`:290-293`) as the shape of a correct disposal, just applied everywhere; the world-state route's *intent* of an allow-list (`player.js:621-633`) — the list is wrong, the idea is right.

---

## 5. WHAT THE SPEC MUST NOT INHERIT

Stated so the SPEC can say "cut deliberately" against each:

1. The BackSide outline as a style. Toon outlines belong in a post pass (depth/normal edge) or nowhere.
2. `flatShading: true` as the default material look.
3. A hemisphere + one directional as "lighting".
4. The orbit camera with wheel zoom as the default view.
5. Per-frame DOM as an HUD strategy.
6. A `fade` div and a 320–360 ms `setTimeout` as a zone transition (`overworld.js:1205`, `:1211`, `:2505`).
7. Client-side `instantiateCreature`, `addToParty`, `awardBadge`, `setFlag` for anything that touches progression.
8. Two spawn tables.
9. Any zone id that is not one of the 21 in `MAP_NAMES`.
10. Per-pixel canvas tinting for variants.

---

## 6. FRAME BUDGET CONTEXT

The old build has no budget and no instrument. `renderer.info` is never read; there is no GPU timer; `quality` is a two-state string (`World3D.js:65-67`, `:82`) that toggles shadows, bloom and pixel ratio. Against the PLAN's 10.0 ms target (6.0 scene + sim, 4.0 post, 13.5 hard ceiling) the old build's *known* costs are: ≈ 1,800 draws with ≈ 171 material programs (R-3, R-10), a 2048² PCF-soft shadow pass over ≈ 370 casters (R-5), 4× MSAA HalfFloat target + UnrealBloom at full res (R-7), ≈ 14.6 k-vertex terrain + ≈ 1,300 instanced clutter blades + 240 CPU-recomposed grass matrices per step (R-11, R-12), and 6+ HUD `innerHTML` parses per step (A-3). None of these numbers was ever put on a graph.

---

## 7. AUDIT QUESTIONS THE NEW SPEC MUST ANSWER

Each is phrased as a test. A SPEC that cannot state the expected value for a question has not answered it.

1. **Texture presence.** For every opaque environment material in Mirevale, assert `material.map`, `material.normalMap` and the ORM texture are non-null and are KTX2-sourced. Count of materials with `flatShading: true` and no maps must be 0 outside a "harvested" zone.
2. **Material count.** After building a zone, `materialStats().liveMaterials ≤ N` where the SPEC states N per zone. The build fails above N.
3. **Draw calls, measured.** `renderer.info.render.calls ≤ 400` at the fixed audit camera in Mirevale and Mire Route, read by the asset-audit tool, not derived. Shadow-pass draws reported separately.
4. **Outlines.** `grep -c "side: THREE.BackSide"` in `packages/render` equals the number of sky/backdrop shells, and no scene mesh has a scaled child sharing its geometry.
5. **Shadow reach.** With 4 cascades, a shadow-casting prop at 120 units from the camera produces a shadow with texel ≤ 8 cm; the SPEC states the cascade splits and per-cascade texel size.
6. **Visible light sources.** For every `PointLight`/`SpotLight` in a zone there is an emissive mesh within 0.5 units of it; for every emissive mesh tagged `lightSource` there is a light within 0.5 units. Both directions asserted.
7. **Night is a lighting change.** At `tod = 0.0`, ground luminance directly under a lamp ≥ 4× ground luminance 10 units away. Under the old build this ratio is 1.0.
8. **Post chain presence and order.** The pipeline contains GTAO, TAA, bloom, DOF, ACES, grade in the stated order, and the SPEC names each node's parameters (GTAO radius/samples, TAA jitter, bloom threshold relative to measured scene max, DOF focal plane and mask).
9. **Bloom threshold.** Measured brightest environment pixel < threshold < brightest creature pixel at the audit camera in every zone.
10. **DOF never touches the actor.** Circle-of-confusion at the active creature's billboard = 0 in a battle capture; asserted per move animation.
11. **Camera is solved, not tuned.** The SPEC names the focal length, the fixed pitch/yaw, the fill fraction and the solve procedure; no `dist: 11.5`-style constant appears in `packages/render` without a derivation.
12. **Walkable = rendered.** Every point of the terrain heightfield within the zone bounds is reachable, or explicitly marked non-walkable by the collision layer; the ratio walkable/rendered ≥ the SPEC's stated value (old: 10.7 %).
13. **Zero allocation in the sim step.** A 10-second capture of the fixed step shows 0 `new Vector3/Matrix4/Quaternion/Color` allocations; the SPEC names the scratch-object convention.
14. **Disposal contract.** Load and unload every zone 50 times; `renderer.info.memory.geometries` and `.textures` and `materialStats().liveMaterials` return to baseline ± 0. This is the leak test and it runs in CI.
15. **No DOM in the frame.** During overworld play, `MutationObserver` on `document.body` records 0 mutations per second while the HUD is static; the SPEC states the HUD is canvas- or WebGPU-drawn and how HP/party changes propagate.
16. **Zone transition.** Crossing a zone border produces no frame > 33 ms and no full-screen fade; the SPEC states the streaming protocol and pre-subscribe distance.
17. **Asset gating.** Time-to-first-frame with a cold cache ≤ the SPEC's stated value; the SPEC states what is awaited before first frame (and that it is not "every character in the game").
18. **Compressed assets.** Every GLB is meshopt-compressed and every texture KTX2; total creature atlas ≤ 35 MB; the SPEC states per-zone texture memory.
19. **Instancing and LOD.** Every scatter class (tree, rock, bush, flower, clutter, lamp) is an `InstancedMesh`; three LOD levels plus impostor exist with stated switch distances; frustum + occlusion culling is on and its cull rate is reported.
20. **Authority.** An adversarial client that posts `gymwin_*`, `badge_*`, invented pickup ids, party mutations, EXP or catch results gains nothing; every progression write has a server-side origin check. Written as a test with a list of forged messages.
21. **One spawn table.** `packages/content` exports exactly one encounter table keyed by the 21 zone ids; the client has no roll; a fuzz over 10,000 encounters per zone yields only species in that table.
22. **Roster.** For each of 130 species, a path exists: spawn table, legendary, starter, gift or evolution from one of those. The test enumerates all 130 and all 69 roots.
23. **Zone ids.** Every `zoneId` in quests, events, swarms, raids and hotspots is a member of the 21-id enum at build time (zod), not at runtime.
24. **Presence fanout.** A headless harness with N ∈ {50, 100, 200} clients in one zone measures server egress ≤ the AOI model's prediction (linear in N × neighbours), not 10·N·(N−1).
25. **Coordinate validation.** A `world_move` outside the zone's heightfield bounds or exceeding the speed cap is rejected; the SPEC states both numbers.
26. **Interpolation.** Remote avatars use a timestamped snapshot buffer with stated delay; a 100 ms jitter injection produces no positional reversal.
27. **One combat implementation.** `packages/core` battle resolves identically on client and server for 1,000 seeded battles; accuracy is rolled; STAB is applied; `typeMult 0` yields 0; stat stages are −6..+6; `lower_atk` targets the defender; Elo loser delta is negative.
28. **Variants in shader.** No `getImageData` in `packages/client` or `packages/render`; the sprite material exposes the five palettes as uniforms.
29. **Battle in place.** A battle capture's camera position is within the zone's world bounds and the zone's light list is unchanged from the overworld frame before it.
30. **Typography.** No font size below the SPEC's stated minimum (in px at 1440p) appears in any stylesheet; a lint rule enforces it.
31. **Transition budget.** Route changes block input for 0 ms; any transition animation is non-blocking and ≤ the SPEC's stated duration.
32. **Boundaries.** `eslint.config.js` fails the build on `packages/render` importing `@ewa/core`, `@ewa/content`, `@colyseus/*` or `react`; on `@ewa/core` importing anything; on `@ewa/client` importing `@ewa/server` or `@ewa/persist`.
