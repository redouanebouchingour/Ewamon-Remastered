# @ewa/render — implementation notes (part 1: host, materials, lighting, post, stats)

Binding contract: `.design/SPEC.md` §1 and §10 (plus §40.3.4, §50.2, §50.4.6). This file records every place the
code differs from the SPEC's text, why, and what three.js 0.186 actually does. Every three.js fact below was read
from `packages/render/node_modules/three` (0.186.0) and `@types/three` (0.186.0).

## Layout (SPEC §10.0.2)

| File | Owns |
|---|---|
| `src/index.ts` | public re-exports |
| `src/descriptors.ts` | plain-data types: `EffectsFlags`, `RenderCaps`, `RenderStats`, `BudgetPass/Counts`, `LightSource`, `LIGHT_BUDGET`, `LAYERS` |
| `src/renderer.ts` | §10.1 `createRenderer`, pixel-ratio policy, resize, dispose; §10.10 `createZoneView`, `createBudgetProbe` |
| `src/materials/{library,surfaces,harvest,wind,triplanar}.ts` | §10.2 (+ `graph.ts` = `buildSurfaceGraph`, `manifest.ts` = §40.3.4 types/parsing) |
| `src/lighting/{rig,sky,daycycle,fog}.ts` | §10.3 (+ `weather.ts` = §10.3.6, `color.ts` = pure sRGB helpers) |
| `src/post/{pipeline,grade}.ts` | §10.8 (+ `effects.ts` = §10.8.4 ReducedEffects helpers) |
| `src/stats.ts` | §10.10 stats record, counts, timestamps, `dumpZone`, differential pass ms |
| `src/contracts.ts` | verbatim interfaces of §10.4–§10.7/§10.9 subsystems other agents implement |
| `src/defaults.ts` | placeholder implementations of those contracts (replacement point: `DEFAULT_SUBSYSTEMS` in `renderer.ts`) |
| `src/env.ts` | `isDevBuild()` (`import.meta.env.DEV`, default dev) |

`src/surfaces/**` belongs to the material-bake work. `materials/surfaces.ts` re-exports its canonical `SURFACES`
table (leaf files only, not `surfaces/index.ts`, which builds every bake recipe at module load) so the baked
textures and the runtime graph cannot disagree.

## three.js 0.186 corrections vs the SPEC text

| # | SPEC says | Installed code says | What the code does |
|---|---|---|---|
| C1 | `trackTimestamp` is missing from `@types/three` `WebGPUBackendParameters`; pass it through a typed cast (§10.1.2 step 1, §50.2.3) | It is declared (`src/renderers/webgpu/WebGPUBackend.d.ts` line 11) | Passed without a cast |
| C2 | `pipeline.dispose()` "also disposes the display nodes' render targets" (§10.1.5) | `RenderPipeline.dispose()` only disposes its quad material | `PostStack` walks the graph and disposes every node that renders into its own targets (GTAO/TRAA/Bloom/DOF/SMAA, and the `RTTNode`s that `traa()`/`dof()`/`chromaticAberration()` create via `convertToTexture`), plus the scene pass |
| C3 | `cameraProjectionMatrixInverse` / `cameraWorldMatrix` in the DOF plane reconstruction (§10.8.2) | Inside a post graph these resolve to the fullscreen `QuadMesh`'s camera | `uniform(camera.projectionMatrixInverse)` / `uniform(camera.matrixWorld)` (the GTAONode pattern) |
| C4 | `triplanarTexture(texture(set.albedo), …)` (§10.2.4) | `triplanarTextures` reads `textureXNode.value` at build time and creates fresh `texture(value, uv)` nodes, so a later map re-point does not reach the samples | `materials/triplanar.ts` samples `texture(baseNode, uv)`, which clones with `referenceNode = baseNode` and follows `baseNode.value` |
| C5 | `m.colorNode = mix(…)` is a vec3 (§10.2.4) | Alpha test reads `diffuseColor.a`; `Renderer._getShadowNodes` multiplies the shadow alpha by `colorNode.a` | `colorNode = vec4(rgb, alb.a)` |
| C6 | Level-2 normal `mix(normalMap(…), normalGeometry, h)` | `normalMap()` returns a VIEW-space normal (`TBNViewMatrix.mul(n)`); `normalGeometry` is the object-space attribute | `mix(normalMap(…), normalView, h).normalize()`; `normalView` inside the NORMAL sub-build is the geometry normal (face normal on unwelded meshes) |
| C7 | `windDisplace = Fn(([p, amp, freq, stiffUv], u) => …)` (§10.2.5) | A TSL `Fn` callback's second argument is the `NodeBuilder` | Plain graph factory closing over the shared uniforms; `stiffnessFromUv` resolved at build time |
| C8 | `csm.updateFrustums()` on resize (§10.1.3, §10.3.1) | `CSMShadowNode.updateFrustums()` dereferences `this.camera`, which is only set on the node's first build (`setup → _init(builder)`) | `LightRig.updateFrustums()` is a no-op until the first render |
| C9 | `renderer.setAnimationLoop` is not used; the client owns the loop (§10.1.2) | `Renderer.init()` always starts `Animation` (an internal rAF loop that does `info.reset()` + `nodeFrame.update()` per display frame) | Kept (it is how `info.autoReset` works); frame-scoped node updates run once per `frameId`, so `frame()` advances the node frame itself when called twice inside one rAF tick (warm-up, harness loops) |
| C10 | `GPUAdapterInfo.description` for `caps.adapter` | The backend does not keep the adapter; the device exposes `adapterInfo` | Reads `device.adapterInfo.description`, falling back to `vendor architecture`, else null |
| C11 | Programs: "every material graph exists (warm-compiled) before the first zone" (§10.5.9) | Programs are deduplicated by WGSL source (`Pipelines.programs.{vertex,fragment}` keyed by shader text), TSL inlines constants into that text, and the scene's light set is part of the shader (LightsNode) | Per-surface numbers are uniforms (see M1). Warm-up renders one frame through the real pipeline (MRT + shadow variants); `compileAsync` alone would compile non-MRT programs the scene pass never uses. **Open for the zone agent / leak test:** a zone's punctual lights change every lit program's source, so a zone with lights compiles its own variants on first load; `programs` returns to baseline after unload only if the zone meshes' render objects are released (render objects die on object/material `dispose`, not geometry dispose) |
| C12 | `SkyMesh` scaled 200 at the origin (§10.3.3) | SkyMesh projects to the far plane and derives the ray from `positionWorld − cameraPosition` | The visible sky is re-centred on the camera every frame (a 200 m box at the origin is exited on a 240 m route field); `SkyMesh` already sets `material.fog = false` |
| C13 | Sun toggling | Toggling a light's `visible` changes the lights set → every program's cache key | The directional light is never hidden; intensity 0 instead (same for harvest-level-2 punctuals, as the SPEC says) |
| C14 | `chromaticAberration(focused, u.chroma, null, float(1.1))` (§10.8.2) | The documented `center = null → screen centre` default is not implemented: the null reaches the layout `Fn` and the build throws (`Cannot read properties of null (reading 'build')`, seen in the browser) | Explicit `vec2(0.5, 0.5)` |
| C15 | Lighting numbers (§10.2.1, §10.3.5: "albedo 0.85 × noon sun 1.0 = 0.85", IBL ≤ 0.25, ceiling 1.10) | three r155+ lights are physically based: a directional / hemisphere light of intensity E yields ρE/π on a Lambert surface | `SPEC_LIGHT_UNIT = π`: the rig multiplies the SPEC's sun / moon / hemisphere values by π. `LightSource.intensity` ("candela-scaled three intensity") is written unchanged |
| C16 | `SkyMesh` → PMREM with `envIntensity` 0.12 … 0.85 (§10.3.3/§10.3.5) | Measured in the sandbox: SkyMesh's Preetham radiance seen by a 150° upward probe is ≈ 1.05 at noon (≈ 2.3 zenith / 5.9 horizon with a 100° view) and 0.0014 after dusk; unnormalised, IBL supplied ~2/3 of all light and the frame bloomed | `scene.environmentIntensity = envIntensity × norm`, `norm = clamp(0.3 / L, 0, 200)`: L predicted synchronously per bake from `SKY_LUMINANCE_BY_ELEVATION` (measured table) × a correction factor, refined by an async 16² probe readback (absorbs weather cloud cover and the harvested sky). Result at noon: median 0.34, p99 0.65 scene-linear; only emissive housings exceed 1.15 (bloom gap holds) |
| C17 | `renderer.info.memory.texturesSize` is the texture-memory metric (§50.2.2 cap 700 MB) | `Info._getTextureMemorySize` returns **1 byte** for every compressed texture, so KTX2 materials are invisible to it | `RenderStats.textureBytes` and the probe's `counts().texturesSize` add `materials.residentTextureBytes()` (level-data bytes of resident sets). The budget harness must use these, not raw `info` |
| C18 | `renderTargets ≤ 24`, steady state 20 (§10.10.2, §50.2.2) | Measured at 1280×720 with the full graph: scene MRT 1, GTAO 1, TRAA 2 + input RTT 1, bloom 11, DOF 6 + its internal Gaussian blur 2 + input RTT 1, chroma input RTT 1, PMREM target + ping-pong 2, IBL probe 1, shadow maps 4 cascades + 1 per local caster: **34** with one spot caster (41 with the full 8) | **Open SPEC question** (not fixable here): the cap omits shadow maps, PMREM and the `convertToTexture` RTTs three's display nodes create. Also: each CSM cascade allocates a colour attachment beside its depth texture (≈ 32 MB per 2048² cascade, ≈ 128 MB for four) |
| C19 | Warm-up (§10.1.2 step 8) | The first frame compiles every pipeline synchronously on the main thread; on the dev machine (Chrome 152, Intel Gen-12, D3D12) the step-8 frame took ≈ 16 s | Kept (the SPEC wants the first zone frame to compile nothing). Follow-up option: `compileAsync` with the scene pass's render target + MRT set on the renderer, which compiles the same pipelines off the main thread |

## Deviations / interpretations (not API corrections)

| # | Where | What and why |
|---|---|---|
| M1 | §10.2.4 graph | Per-surface numbers (albedo tint, roughness, metalness, tile scale, emissive, clearcoat, wind, transmission, back tint) are per-material **uniforms**, so surfaces of the same structure share one program (C11). 83 surfaces with constants would exceed the 96-program cap. |
| M2 | §10.2.4 graph | Albedo/roughness/metalness are `map × scale + bias`: while the placeholder is bound, scale 0 / bias = SurfaceDef value (the placeholder renders as the surface's base colour — "nothing renders black"); once the baked set is bound, scale 1 / bias 0. The SPEC's `alb × color(def.albedo)` and `orm.g × def.roughness × 2` only make sense for the neutral placeholder: the bake writes absolute colour/roughness (§40.3.6), so they would double-apply. A re-point writes uniforms only; no program. |
| M3 | §10.2.4 / §40.3.2 | UV-mapped surfaces multiply `uv()` by `tileScale = 1 / manifest.metres` (default by class until the manifest arrives): builders emit UVs in metres (cards 0..1, metres 1). This is what "repeat is world-constant in the shader" requires. |
| M4 | §10.2.3 `MaterialLibrary` | Adds `ready`, `warmup()`, `describe()`, `manifest()`, `warnings()`. Materials are keyed by surface (one shared instance); texture sets by `(surface, tier)`. `preloadHero` re-points in place and releases the surface's field set. |
| M5 | §10.2.3 placeholder | If `placeholder_*.ktx2` cannot be loaded (bake not run yet), a runtime 4×4 neutral `DataTexture` set is bound (dev fallback; `describe().ktx2 === false` so the audit still fails). Missing manifest / entries / failed fetches keep the placeholder and are listed in `warnings()`. Every bound texture carries the identical sampler stamp so re-points never change `RenderObject.getMaterialCacheKey()`. |
| M6 | §10.2.4 `color` attribute | Level 2 reads `vertexColor()`; three renders white where the geometry has no `color` attribute. `paintSurfaceColor(geometry, id)` writes the SurfaceDef albedo (linear) for builders. |
| M7 | §10.2.2 features | Values without a `SurfaceDef` field live in `SURFACE_EXTRAS` (water transmission, `unmade_stone` always level 2, `stained_glass` emissive-from-albedo, leaf back-face tint). |
| M8 | §10.3.4 | The one directional light fades to 0 across the sun/moon switch (sun: elevation −4°…+2°, moon: +4°…+10°) so the direction flip at −4° does not pop shadows. |
| M9 | §10.3.5 | Fog colour and hemisphere colours blend the palette's night/noon pair by the keyframe sun intensity; the palette values other than fog (sky zenith, ground bounce) are provisional until the zone agent's `PALETTES` land (`GROVE_LIGHTING`). |
| M10 | §10.3.6 | Rain/hail sheet is one `LineSegments` of 4 000 streaks animated in the vertex stage from `windTime` (hitstop freezes it); WebGPU has no wide lines, so hail is short bright streaks instead of `pointWidth 3`. Hail also sets wetness (interpretation). |
| M11 | §10.8.2 signature | `buildPostGraph` became `planPostGraph` (pure: which stages, which numbers) + `buildPostOutput` (TSL) + `PostStack` (one `RenderPipeline`, persistent scene pass, rebuild by `outputNode` + `needsUpdate`). |
| M12 | §10.8.2 | GTAO `useTemporalFiltering` only when TRAA is in the graph (GTAONode requires it). DOF `bokehScale` is a uniform `6 × pixelRatio`. Vignette uses a `height/width` uniform (0.5625 at 16:9) instead of the literal. Grade clamps `c·gain + lift` at 0 before `pow`. |
| M13 | §10.8.4 | `coerceTimeScale`: `s = 0` is gated by `hitstop`, other `s ≠ 1` by `slowmo`; with both off (reduced) every `s ≠ 1` → 1, which is the Pillar 8 assertion. |
| M14 | §10.1.1 options | `RendererOptions` adds `materialsUrl` (default `/materials/`) and `clock` (for `frameMs`; the package never reads a wall clock itself). |
| M15 | §10.10 | `dumpZone().shadowDrawCalls` is an upper-bound estimate (visible casters × 4 cascades + per local caster its passes over casters in range); `culledChunks` is 0 until the zone agent reports it. `createBudgetProbe(renderer, zoneId)` works without a zone (sandbox); `measurePassMs` runs the §50.2.3 differential procedure. |
| M16 | §10.1 subsystems | Camera rig, battle stage, HUD, actor pool, zone loader and per-frame hooks are injected through `RendererSubsystems`; `DEFAULT_SUBSYSTEMS` wires placeholders (`BasicDioramaRig` holds the §10.7.1 pose without springs; `loadZone` rejects until §10.5 lands). |
| M17 | §10.2.4 graph | Cheap feature flags are uniforms too (wetness response, emissive / emissive-from-albedo, forced harvest, clearcoat values, card wind amplitude, card back tint), so programs exist per `surfaceStructure()` = {standard, physical, card, water} × triplanar × trunk wind: **7 structures for the 83 surfaces**. Measured: library fragment programs 27 → 8; total programs after warm-up 118 → 63. |
| M18 | §10.1.3 `resize` | A hidden / not-yet-laid-out canvas reports 0×0; `resize` ignores sizes < 1 and keeps the last valid size (a 1×1 drawing buffer otherwise renders one stretched pixel). |
| M19 | §10.3.7 fog | SPEC numbers kept (density 0.018 per m of view depth, base 0, falloff 0.35 per m). Observation for the art pass: at the 26 m default camera distance the player's feet are already 37 % fogged, which lifts and flattens the whole diorama. |
| M20 | §10.8.3 vignette | The SPEC's corner arithmetic has a slip: `smoothstep(0.35, 0.85, 0.574)` is 0.42, not 0.36, so vignette 0.22 darkens the 16:9 far corner by 9.3 %, not 8 %. The code implements the formula (the test asserts 9.3 %). |
| M21 | For the bake owner | The `plaster` recipe darkens AO toward its tile edges; with world-constant 2 m tiling on a 6 m wall this reads as a panel grid (visible in the sandbox). Probably wants per-face UVs or no edge AO. |

## Measured in the browser (sandbox, Chrome 152 WebGPU, Intel Gen-12 iGPU, 1280×720, pr 1)

- Backend `webgpu`, KTX2 target `bc7`, `timestamp-query` available, adapter `intel gen-12lp`. The baked Mirevale slice (15 surfaces) loads with no warnings: BC7 1024² hero sets with 11 mips, sRGB albedo, one NoColorSpace ORM texture on `aoMap`/`roughnessMap`/`metalnessMap`; 10 hero surfaces re-pointed in place with **no new programs**.
- Baseline after step 8: 63 programs, 32 render targets, 14 geometries. With the diorama (14 surfaces + 1 foreign stand-in, 1 shadow spot + 1 point light): 81 programs (+18 = the diorama's light-set variants, C11), 34 render targets (C18), 171 draws, 6 091 triangles, 281 MB textures (C17 corrected).
- Harvest level 0 ↔ 2 compiles nothing (programs unchanged); level 2 renders flat vertex colour, no emissive housings, punctual lights at 0, grey sky.
- `dumpZone()`: 14/15 materials with all three KTX2 maps (the 15th is the foreign stand-in), lamp housing distance 0.00 m, brazier 0.15 m (Pillar 4 ≤ 0.6).
- Noon HDR (scene pass `output`): median 0.34, p99 0.65, max 5.6 (emissive housings only above 1.15).
- CPU `frame()` ≈ 5–7 ms steady; GPU ≈ 17–31 ms (shadows and the ~30 post render passes dominate on this iGPU). The budget belongs to the RTX 3060 reference machine and the harness.

## Tests (vitest, node, no GPU): 80 tests in 7 files

`daycycle.test.ts` (keyframes, interpolation, wrap, sun/moon geometry, fade, re-bake rule) · `lighting.test.ts` (light budget, kinds, flicker, cascades, SPEC light unit, punctual lifecycle, weather, fog, sky normalisation, wetness) · `material-library.test.ts` (shared instances, RangeError, ≤ 8 structures, placeholder degradation, dedupe, stamping, hero re-point, eviction, in-flight eviction, dispose contract, MaterialBudget) · `materials-manifest.test.ts` (§40.3.4 parsing, URL planning, surface table vs §10.2.2) · `post-graph.test.ts` (real TSL graph: order by ancestry, §10.8.3 numbers, flags remove nodes, webgl2 SMAA, pass switches, tilt plane) · `renderer-policy.test.ts` (pixel-ratio policy, KTX2 target, ReducedEffects, time-scale coercion, shake refusal, rig pose, grade/vignette) · `stats-dispose.test.ts` (stats record, counts + caps, differential pass ms, PostStack / DayCycle / LightRig dispose bookkeeping).

## Sandbox

`pnpm --filter @ewa/render sandbox` → http://localhost:5180 (Vite, `packages/client/public` as public dir). `window.__ewaSandbox`: `stats()`, `counts()`, `dump()`, `plan()`, `warnings()`, `caps()`, `setTime(hours)`, `setReducedEffects(bool)`, `setHarvest(level)`, `setWeather(kind)`, `capViolations()`, `shot(name, frames?)` (renders at a forced 1280×720 and writes `sandbox/.shots/<name>.jpg` through a dev-only `POST /__shot` endpoint; works while the window is hidden and rAF is paused).

---

# Part 3: creature billboards, camera, battle stage, actors, VFX, HUD (§10.4, §10.7, §10.9)

## Layout

| File | Owns |
|---|---|
| `src/sprites/typeColors.ts` | §10.4.6 type colour table (legacy `TYPE_COLORS` verbatim), colourblind-table validation |
| `src/sprites/tables.ts` | §10.4.3/§10.4.6/§10.4.7 numbers, the 5 variant palettes as uniforms, pose keyframes, bob/hurt math (pure, node-tested) |
| `src/sprites/atlas.ts` | §10.4.1 `AtlasMap`/`AtlasSet` (verbatim), WebP decode (level 0 + 3 pipeline mips), texture sampler contract, party singles (runtime crops), the refcounted `AtlasCache` |
| `src/sprites/billboard.ts` | §10.4.2 `SpritePool` (verbatim) → `BillboardPool`, `CreatureBillboard`, the one material graph per atlas (§10.4.5), the shared contact decal (§10.4.7) |
| `src/sprites/overlayMrt.ts` | MRT outputs for decals and VFX that keep the scene's normal/velocity/mask (P4) |
| `src/camera/rig.ts` | §10.7.1 constants + §10.7.2 `CameraRig` → `DioramaRig` (spring, dead zone, eases, shots, cues, shake) |
| `src/camera/battle.ts` | §10.7.4 arena framing constants, `CAMERA_WORK` (verbatim), battle/inspector poses, battler slots |
| `src/camera/dof.ts` | §10.7.3 `TiltShiftDOF` numbers + CPU mirrors (CoC, off-plane distance) |
| `src/stage/battleStage.ts` | §10.7.5 `BattleStage` → `Stage` (arena dressing, reserved beacons, battlers, spectators, inspector) |
| `src/stage/vfx.ts` | §10.7.5 `VFX_IDS` (47) + recipes + the pooled particle system |
| `src/stage/actors.ts` | §10.7.6 `ActorPool` → `CharacterPool`, §10.7.7 procedural character fallback + the shared `'character'` material |
| `src/hud/layer.ts` | §10.9 `HudLayer` → `CanvasHudLayer`, the `HudModel` mirror (20-client.md §20.6 verbatim) |
| `src/stage/wiring.ts` | one part-3 bundle per renderer, `PART3_SUBSYSTEMS` (plugged into `DEFAULT_SUBSYSTEMS`), the per-frame hook, warm-up objects, `part3Of(renderer)` |

Renderer edits (surgical): `DEFAULT_SUBSYSTEMS` camera/stage/hud/actors/hooks/warmup come from `PART3_SUBSYSTEMS` (lazy references: `wiring.ts` imports `renderer.ts`); `FrameHook.update(dtScaled, dtReal)` and `FrameHook.onZone(handle)` (called after `loadZone` resolves; gives the stage/actors the collider); the HUD overlay renders with `outputColorSpace = workingColorSpace` (P1). `contracts.ts` re-exports the real `HudModel`.

## three.js 0.186 corrections vs the SPEC text (part 3)

| # | SPEC says | Installed code says | What the code does |
|---|---|---|---|
| P1 | HUD: `gpu.render(hudScene, ortho)` after `pipeline.render()` with `autoClear = false`; `CanvasTexture` `SRGBColorSpace` (§10.9, §10.1.4) | `Renderer.needsFrameBufferTarget` is true whenever `outputColorSpace ≠ workingColorSpace`, so a plain `render()` draws into the intermediate framebuffer target and its output pass copies that (stale) target over the canvas: the post image would be replaced | The host renders the overlay with `outputColorSpace = workingColorSpace` (what `RenderPipeline.render` does); the canvas texture carries raw sRGB bytes (`NoColorSpace`) and composites premultiplied (`CustomBlending` One / OneMinusSrcAlpha), byte-exact browser compositing |
| P2 | `texture.mipmaps = [level1, level2, level3]` (§10.4.1) | `Textures.getMipLevels` = `mipmaps.length`; `WebGPUTextureUtils.updateTexture` uploads `mipmaps[i]` to level i | `mipmaps = [l0, l1, l2, l3]`, `image = l0`, `generateMipmaps = false` (4 levels, max LOD 3) |
| P3 | `cameraYaw = atan2(camDir.x, camDir.z)`, camDir = camera forward (§10.4.4) | the SPEC's `yawRot` maps the quad's +Z face onto that direction, i.e. AWAY from the camera; `FrontSide` culls it | yaw from the direction toward the camera: `atan2(−f.x, −f.z)` |
| P4 | contact decal multiply-blended with `mask.x = 1` (§10.4.7); VFX never write `mask.y` (§10.7.5) | in an MRT pass only `output` uses the material blending; every other attachment defaults to `NoBlending` (`MRTNode.getBlendMode`), so a transparent decal/particle overwrites normal/velocity/mask under it | `overlayMrt()`: normal/velocity blend with factors (0, 1) (kept), the decal's mask blends `max` with (1, 0), VFX keep the mask. `MultiplyBlending` requires `premultipliedAlpha = true` on WebGPU; the decal sets `fog = false` (fog would tint the multiply factor) |
| P5 | billboard `side = FrontSide` (§10.4.5) | the shadow pass renders `_shadowSide[FrontSide] = BackSide`: a camera-facing card casts NO shadow when the sun is on the camera's side | `shadowSide = DoubleSide` |
| P6 | `typeColor: Color` read as `userData('typeColor', 'vec3')` | a `'vec3'` uniform reads `.x/.y/.z`; a `Color` has `.r/.g/.b` | `userData('typeColor', 'color')` |
| P7 | (the billboard graph does not mention `map`) | `Renderer._getShadowNodes` multiplies the shadow alpha by `material.map.a` sampled at the RAW quad uv (the whole atlas) | `material.map` stays null; the albedo is published as `material.userData.ewaAlbedo`. **For the orchestrator:** `stats.ts` `dumpZone` reads `m.map` for `sprites[]`; one line (`(m.userData?.ewaAlbedo ?? m.map)`) makes `sprites.nearest` see the atlas albedo (not changed: not a part-3 file) |
| P8 | VFX: "a pooled `Points` cloud … `PointsNodeMaterial`" (§10.7.5) | a `Points` object rasterises 1-px points on WebGPU; sized particles go through `PointsNodeMaterial.setupVertexSprite`, i.e. an instanced `Sprite` (`sprite.count`) | one instanced `Sprite` (count 4096 = 8 emitters × 512) with the one shared additive `PointsNodeMaterial`; the Sprite quad geometry is three's module-level shared one (never disposed) |
| P9 | the card is turned by `positionNode` | `positionNode` does not rotate `normalLocal`; the normal map would light an unturned card | `positionNode` assigns `normalLocal`/`tangentLocal` (the `SkinningNode` pattern); the shared quad carries a tangent attribute |
| P10 | "2 shadow-casting beacons … reserved slots" | toggling a light's visibility (or parenting it under an invisible group) changes the light set → every lit program recompiles (C13) | the two `SpotLight`s live under the always-visible stage root from `createRenderer` on (warm-up light set), intensity 0 and `shadow.autoUpdate = false` while undressed |

## Deviations / interpretations (part 3)

| # | Where | What and why |
|---|---|---|
| Q1 | §10.4.4 facing | The card also **leans back** toward the camera about its foot line by `0.5 × camera pitch-down` (uniform `cameraLean`, written with `cameraYaw`, read by the same `positionNode`, so shadows match). A strictly vertical card seen from the −52° diorama camera is foreshortened to cos 52° = 0.62 of its height and reads as a squat card. With the lean the apparent height is cos 26° = 0.90 (battle camera 0.97, inspector ≈ 1). |
| Q2 | §10.4.5 shimmer | driven by a pool clock advanced by `dt × timeScale` (hitstop freezes it), not `time`. |
| Q3 | §10.4.5 dissolve | the hole mask is folded into the alpha (`select(hash < dissolve, 0, a.a)`), so `maskShadowNode` punches the same holes in the shadow. |
| Q4 | §10.4.2 `CreatureBillboard` | extras: `setPoseAxis` (lunge direction), `setGroundNormal` (decal on the terrain normal), `topWorld`/`feet` (HUD/VFX anchors), `bound`. The pool drives `update(dt)` for every live billboard (host step 3). A billboard acquired before its atlas is bound stays hidden and is re-pointed when the bind lands. |
| Q5 | §10.7.4 arena axis | "perpendicular to the diorama heading" contradicts "the player's battler is the nearer one" and the +12° anti-eclipse yaw; the battler line runs along the heading's view direction (player side 0 near, back sprite). |
| Q6 | §10.7.2 `CameraRig` | extras: `setFocus` (sandbox/harness), `setCueTarget` (the stage tells the rig where attacker/defender/ko/throw are), `inspect(aim, ms)` (the §10.7.5 4 m inspector pose, pitch −18° so the background is ground, not fogged sky). `cue(kind, ms)`: `ms > 0` is the shot length (hold = ms − ease-in), else the row's `hold`. A `ko` cue's slow-mo is gated by `effects.slowmo` and restored after its ms (real time). |
| Q7 | §10.7.5 `BattleStage` | extras: `setAccentType` (zone `accentType`; default from the battle terrain), `setGround`, `undressSpectator(x, z)`; `undress(ms)` removes the main arena if dressed, else the spectator arenas. Spectator arenas get ring + beacon housings but no lights (only 2 reserved slots exist). Spectators are procedural characters from the actor pool. The arena rises from / sinks into the ground over 450 ms instead of fading (opaque library materials cannot fade). `setBattler` keeps the billboard when the same creature arrives in a fresh descriptor object (variant/alpha re-applied as uniforms). |
| Q8 | §10.7.5 VFX lights | none: a light appearing mid-battle recompiles every lit program (C13); impacts pulse the reserved beacons instead. |
| Q9 | §10.7.7 characters | the look GLBs are not shipped: every look is a deterministic procedural figure (one merged geometry, six flat vertex colours, 7-bone rigid skin, one draw, `castShadow`), animated by procedural bone rotation (idle/walk/run blend, wave/happy emotes). The shared `'character'` material is built in `stage/actors.ts` (the library has no `'character'` class). `AnimationMixer` + GLB loading is the follow-up when `models.manifest.json` lands. |
| Q10 | §10.7.6 emotes / nameplates | drawn by the HUD (§10.9: nameplates are HUD; the HUD canvas is the package's only `CanvasTexture`), anchored 1.95 m above the feet; `screenPositions(out)` writes head anchors in pool-slot order (NaN when behind the camera). |
| Q11 | §10.9 HUD | the HUD clock advances by frame dt (no wall clock); chat lines fade from 6 s to 8 s after arrival; HP bars tween over 500 ms at 30 Hz toward the model's `hp`; party thumbs are drawn as initials (thumbnail WebPs are the client's). |
| Q12 | §10.7.3 CoC arithmetic | SPEC: `smoothstep(0, 6, 2.90) = 0.518 → 3.1 px`; the formula gives **0.475 → 2.85 px at pr 1** (4.44 px, not 4.1, at 4 m). The Pillar 1 "≥ 3 px at 1440p" holds from pixel ratio 1.06 up (4.3 px at pr 1.5). Open SPEC question (the numbers are part 1's `POST_PARAMS`, unchanged). |
| Q13 | light budget | the 2 beacons are counted by `RenderStats.shadowLights` (scene-wide) but not by `LightRig.createPunctuals`' budget assert (they are not rig handles): zone specs must stay ≤ 6 shadow casters for the total to hold ≤ 8. |
