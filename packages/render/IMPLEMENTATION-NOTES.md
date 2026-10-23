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
| P4 | contact decal multiply-blended with `mask.x = 1` (§10.4.7); VFX never write `mask.y` (§10.7.5) | the pipeline's per-attachment blend state comes from the RENDERER's MRT (`renderObject.context.mrt` = the scene pass MRT: only `output` uses material blending, the rest `NoBlending`); blend modes set on a material's own `mrtNode` never reach the pipeline. A transparent decal/particle therefore OVERWRITES normal/velocity/mask; measured: a particle writing a zero normal made GTAO NaN → black squares | `overlayMrt()` writes VALID values and the materials alpha-test at 0.004 (transparent texels write nothing): particles write the view axis as normal + mask (1, 0); decals keep their own (ground-up) normal/velocity + mask (0, 0) (Q14). `MultiplyBlending` requires `premultipliedAlpha = true` on WebGPU; the decal sets `fog = false` (fog would tint the multiply factor) |
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
| Q14 | §10.4.7 decal mask | the decal writes mask (0, 0), not (1, 0): it covers GROUND pixels, and excluding them from GTAO removed the ground's own contact occlusion inside the decal disc, which read as a light halo around every creature's feet (seen in the sandbox). The creature card itself keeps mask.x = 1. |
| Q15 | §10.7.5 beacons | placed as key lights on the audience (camera) side, ±40° off the view axis at r 4.7 m, 2.3 m high, spot 0.8 rad, aimed at the ring centre; the light colour is the accent mixed 55 % toward white (the housing glows the pure accent). Lateral beacons only grazed the cards: at dusk the player's back-view battler read as a silhouette. |
| Q16 | §10.9 regional redraw | region boxes are inflated by the glyph outline + panel stroke so every painted pixel lies inside its region's box (clears never erase a neighbour's pixels), the clip is restored in a `finally`, and every region draw starts at `globalAlpha 1`. `hud-coverage.test.ts` proves it with a clip-aware coverage canvas. |

## Measured in the browser (sandbox `?demo=lineup` / `?demo=battle`, real `creatures.manifest.json`, Chrome WebGPU, Intel Gen-12, 1280×720 shots)

- 5 mire_route atlases (10 species) bind in 0.85 s warm (7 s cold), 167 MB GPU (3 maps × 4 levels each). Billboards render lit through the derived normal map, with hard texels under magnification (inspector, 4 m), contact decal + real alpha shadows (castShadow on/off changes the ground under the foe by ≈ 0.9 % of a 300×150 crop at 08:30 / 12:00 / 16:30), DOF-sharp over a blurred background.
- Pillar 5: mean luminance over a battler's interior noon vs dusk (18:54): −93 % (player's back view), −70 % (foe) ≫ 12 %.
- Arena: rises out of the ground, beacons light the ring; HUD bars follow the battlers; VFX render as pooled pixel particles (after P4 fix) with the crit white flash on the target; `impact_super`/`impact_crit` cards toned down so the target stays readable.
- Whole scene after the lineup + walkers: 231 draws, 102 programs, 34 render targets (part 1's C18), ~11 ms GPU.

## Open items for the orchestrator (not part-3 files, not changed)

1. `stats.ts` `dumpZone` reads `m.map` for `sprites[]`; billboards publish `userData.ewaAlbedo` (P7). One line: `const map = (m.userData?.ewaAlbedo ?? m.map)`.
2. `post/pipeline.ts` DOF composite `mix(blurred, bloomed, mask.y)` smears the sharp sprite's colour into the blurred pixels around it — a soft coloured halo around every sharp billboard off the focal plane (sandbox: gone with the DOF pass off). Suggested: feed `planeDist.negate().mul(oneMinus(maskT.y))` as the DOF `viewZNode`, so sharp pixels have CoC 0 and contribute nothing to the far field.
3. Sprite pipeline: emissive masks flag large bright body regions (mufflo 37 %, glimp 21 %, bloomsprite 17 % of opaque texels; snapling 0.3 %, mossling 0 %). With the SPEC's `1.8 × albedo` those creatures glow at night and bloom at noon.
4. Height fog (part 1, M19) washes the inspector close-up and pales sprites at noon.
5. Q12 (the Pillar 1 CoC arithmetic) and Q13 (beacons vs the rig's budget assert) are SPEC-level questions.

## Tests (part 3): 51 tests in 6 files (render total 171 in 18 files)

`camera-constants.test.ts` (§10.7.1 table, 20.49 / 16.01 m, §10.7.4 arena constants + CameraWork, §10.7.3 DOF numbers vs post, the no-stray-literal grep over `camera/*.ts`) · `camera-rig.test.ts` (heading/zoom eases, dead zone + critically damped spring, pushIn/release timing and battle pose within 40 u, input lock, cues incl. gated slow-mo, Pillar 8: 600 reduced frames with zero shake and bit-identical orientation) · `sprites.test.ts` (variant palettes, type colours, dims/anchoring, bob/hurt/poses, atlas chain + sampler contract, singles, cache refcount/dispose, pool: one material per atlas, userData writes, pending re-point, poses via update, cameraYaw toward the camera, colourblind re-colour) · `hud.test.ts` (field set, dirty regions, one upload per draw, 600 idle frames = 0 uploads and 0 context calls, ≥ 1 px anchor rule, HP tween at 30 Hz, chat fade, ≥ 14 px text + tabular digits, overlay blend/colour space, resize) · `hud-coverage.test.ts` (Q16) · `stage.test.ts` (47 VFX ids + recipes, fixed-capacity deterministic pool, dress/undress bookkeeping with the reserved light set unchanged and nothing shared disposed, spectator arenas, syncFrom, actor pool).

## Sandbox (part 3)

`?demo=lineup` (10 mire_route creatures, variants + one alpha, walkers with nameplates/emote, HUD) and `?demo=battle` (arena dressed on the part-1 diorama at `?ax=&az=`, two battlers, scripted turns with VFX / HP / cues; `&auto=0` for manual control). `window.__ewaSandbox.part3` = `{ bundle, species, manifest, tsl, three, … }`; lineup adds `facing(side)`, `pose(i, pose)`, `inspect(i | null)`; battle adds `turn(n)`, `loop()`, `battlers()`.

---

# Part 2: zone builder, biome generators, terrain = collision, scatter / LOD, disposal (§10.5, §10.6)

Binding contract: `.design/SPEC.md` §10.5, §10.6, §20.4.4, §50.2.2, §50.4.6 (plus §1 pillars, §3.1 extents, §3.11 heightfield).

## Layout

| File | Owns |
|---|---|
| `src/zone/prng.ts` | §10.5.2 `Prng` — core's sfc32 copied (splitmix32 seed, 12 warm-up draws), `fork(label)`; `hash2` / `valueNoise` / `fbm2` (stream-free noise for scatter and splat) |
| `src/zone/types.ts` | pure descriptor types: `Palette` (§10.5.3 + 3 fields), `GeoLod` / `PropGeo` / `BiomeGenerators` (§10.5.4 verbatim) |
| `src/zone/palettes.ts` | §10.5.3 `PALETTES` (21 ids = every `ZoneDef.palette`; the two grove rows carry the SPEC grade verbatim), `lightingPaletteOf`, `gradeOf` |
| `src/zone/layout.ts` | §10.5.5, pure: `planLayout` (plaza / roads / corridor / tall-grass patches / clearings / set-piece / water bodies / authored points), the adapter's seeded planners `planBuildings` / `planLights` / `planProps`, door paths, the terrain splat `splatAt`, `scatterClear`, set-piece extent + light tables, biome light / roof tables |
| `src/zone/lod.ts` | §10.5.7, pure: tiers 0–40 / 40–90 / 90–160 / > 160 m with 4 m hysteresis, the 32 m chunk grid, `BUILDING_LOD_LEVELS` |
| `src/zone/geo.ts` | geometry toolkit: per-surface triangle soups (`Parts`) baked from temporary `ExtrudeGeometry` / `Shape` / raw lathes into plain `BufferGeometry` (position, normal, metre uv, albedo `color`); chamfered boxes and beams (3–5 cm), cards (optionally two-sided), the geometry digest |
| `src/zone/generators/{grove,cinder,salt,storm,marrow,vesper,forge,sky,capital,shrine,rift}.ts` | §10.5.4 the eleven sets: surfaces, building / prop styles, tree mix, densities, boundary dressing, the 21 set-pieces (grove in full) |
| `src/zone/generators/{nature,buildings,props,common,set,index,biomes}.ts` | shared builders: trees (lathed tapered trunks, 5 root lobes + curved root arms, lathed branches, card canopies with volume normals), fractured rocks, tufts, bushes, flowers, stumps, logs; `buildHouse` (walls = extruded elevations with window / door holes, bevelled; timber framing; 38° slab roofs; chimneys; lod1 / lod2); lanterns and the other five housings, fence, bridge, well, bench, planter, crate, barrel, cart, stall, sign, garden, pond bank; `BIOME_GENERATORS`, `SET_PIECE_BUILDERS`, `generatorsFor` (the verbatim §10.5.4 signatures over a set) |
| `src/zone/scatter.ts` | §10.5.7 chunks (`ChunkSet`: tier + frustum activity per 32 m cell) and zone-wide instanced fields (`ScatterField`) |
| `src/zone/split.ts` | alpha / shadow class splitting of multi-surface meshes (C20) |
| `src/zone/water.ts` | §10.5.6 water meshes per heightfield water body, `depthBelow` attribute |
| `src/zone/builder.ts` | §10.5 `loadZone` / `buildZone` → `ZoneHandle` (build order, LOD objects, static prop chunks, boundary walls, pond banks + piers, plaza curb and paving, warp rooms, scatter, lights, digest, §10.5.9 dispose) |
| `src/zone/system.ts` | the renderer subsystem: `ZoneSystem` = `ZoneLoader` + frame hook (per-frame chunk tiers / activity, building LODs against the main camera; palette → lighting + grade) |
| `src/terrain/field.ts` | pure heightfield sampling (content's arithmetic statement for statement), playable bounds, water bodies |
| `src/terrain/collider.ts` | §10.6.1 `TerrainCollider` (+ blockers), §10.6.2 `MOVER`, `resolveMove` (+ allocation-free `resolveMoveInto`) |
| `src/terrain/mesh.ts` | terrain chunks from the collider's heights (iso-line layer clipping) and the skirt beyond the field |
| `packages/client/src/scene/zoneSpecFor.ts` | §20.4.4 the content → render adapter |

## three.js 0.186 facts found in part 2

| # | Where | What the installed code does | What the code does about it |
|---|---|---|---|
| C20 | shadow pass (`Renderer.renderObject`) | Every shadow map is rendered with ONE override material per light shadow; each object's `alphaTest` is copied onto it and `Material.alphaTest` bumps `version` whenever it crosses 0, after which every following render object recomputes its full cache key. Interleaving alpha-tested cards with solids made Mirevale cost **185 ms CPU per frame** (8 ms without the alternation, measured by forcing `alphaTest` on every solid). | `zone/split.ts`: meshes mixing solid and card surfaces are split into meshes over geometry views (shared attributes, disjoint groups); cards get `renderOrder 1` so each sorted render list flips once. Non-casting surfaces (glass, emissive, water — `SurfaceDef.castShadow`) are split into a `castShadow = false` mesh too. **For the sprite / stage owner:** billboards are alpha-tested — keep them in a renderOrder ≥ 1 band or they reintroduce the alternation. |
| C21 | `nodes/accessors/Instance.js` | An `InstancedMesh` with ≤ 1024 instances keeps its matrices in a uniform array whose WGSL name carries a per-build uniform id (`NodeBuffer_<id>`), so every such mesh compiles its OWN vertex program (Mirevale with per-chunk meshes: 175 → 271 programs, climbing as chunks came into view). Above 1024 it uses an instanced attribute (count- and identity-free); the storage path is named the same way. | One `InstancedMesh` per (kind, tier, class) for the whole zone, capacity ≥ 1025 (`ScatterField`); the chunk / tier logic writes the active chunks' slices into the preallocated tier buffers when the chunk set changes (partial upload via `addUpdateRange`). Draw calls no longer scale with chunks. Tint (`instanceColor`) only on card / flower meshes: a tinted instanced mesh compiles its own fragment variant. |
| C22 | `RenderObject` lifetime | A plain `Mesh` has no `dispose()`; its render objects (and the programs they hold) are released only on the object's or the material's `dispose` event — library materials are never disposed, so zone meshes would keep their programs forever (part-1 open item under C11). | `ZoneHandle.dispose()` dispatches `{ type: 'dispose' }` on every plain mesh of the zone after disposing its geometries (and calls `InstancedMesh.dispose()`), so programs return to baseline. |
| C23 | `LOD.update` | three's renderer calls `LOD.update(camera)` in `_projectObject` for EVERY camera, shadow cameras included, so building / set-piece levels would be re-picked from the sun's position (trees and houses casting LOD2 shadows). | `autoUpdate = false`; the zone system updates the LODs once per frame against the main camera. |
| C24 | DoubleSide cards | A back face's normal is flipped, so a card with up-bent normals renders dark from behind (grass read as dark crosses). | `card(…, twoSided)`: a back-to-back twin 1 cm behind with reversed winding and the same bent normals (grass tufts, tall grass, bushes, reeds, greenery). Canopy cards stay single (their back tint is the translucency look). |
| C25 | geometry / attributes bookkeeping | Instance attributes are freed by `Geometries`' dispose listener through the FIRST render object that initialised the geometry; sub-geometries share attributes. | Every instanced mesh has its own geometry or geometry view; views are disposed with the zone; the node leak test mirrors this bookkeeping. |
| C26 | node attributes on dispose | Attributes a LATER pass binds (the velocity MRT's previous-instance-matrix buffers, three's wrapped instance colours — module-private maps) are never freed: measured **+141 attributes / 9.8 MB per Mirevale reload** in the browser. | `ZoneBuildDeps.releaseGpu`: the zone system collects the attribute lists of the zone's render objects before `dispose()` and deletes each from the renderer's attribute map afterwards (reads `renderer._objects._renderObjects` / `renderer._attributes`; a no-op for anything three already freed). After it: 3 browser reload cycles leave `geometries`, `programs`, `attributes`, `attributesSize` at the step-8 baseline exactly (below). |

## Deviations / interpretations

| # | Where | What and why |
|---|---|---|
| Z1 | §10.5.7 per-(kind, chunk, tier) `InstancedMesh` | Replaced by zone-wide tier fields (C21). The 32 m chunks, their per-frame tier with 4 m hysteresis and "nothing allocated on a tier switch" are kept; a switch copies instance slices into preallocated buffers. Chunks outside the camera frustum (padded 16 m for shadow reach) contribute no instances and their static prop meshes are hidden. |
| Z2 | §10.5.7 impostors | The > 160 m tier is two crossed canopy cards per tree kind (library card material), not a 16-view render-target atlas: the render targets are already over the §50.2.2 cap (part-1 C18) and the default view never reaches 160 m (§10.5.7's own geometry note). Rocks use their lod2; small kinds are not drawn beyond 90 m. |
| Z3 | §10.5.4 generators return | Generators return plain `BufferGeometry` built from arrays (Pillar 3 audit-safe); `ExtrudeGeometry` / `LatheGeometry`-style lathes are temporaries baked in. Trunks are raw-array lathes (metre UVs, radial root-lobe modulation) rather than `LatheGeometry`. `makeHouse` takes an optional `drop` (terrain fall under the footprint) so the plinth reaches the ground; `makeSetPiece` builders receive a `ground(lx, lz)` function. |
| Z4 | §10.5.4 walls | "ExtrudeGeometry of the footprint Shape with holes" would cut vertical shafts; walls are extruded **elevations** (one per wall, 0.3 m thick) with the door / windows as holes, bevel 4 cm (chamfer round every opening), panes 0.12–0.14 m behind the face. |
| Z5 | terrain splat (§10.5.5 "color attribute: R path, G dirt, B moss") | The library has one material per surface, so the splat is geometric: triangles are clipped on the zero lines of signed layer fields (plaza > path > detail > ground) into per-layer groups of one indexed chunk geometry. `color` holds the layer albedo (the harvest level-2 colour), not the weights. Plaza stones use UV scale 0.62 (1.6× the baked stone size — legible at 26 m). |
| Z6 | heightfield footprints (§3.11) | Content marks margin, slope and water unwalkable but not building / prop footprints. `TerrainCollider` keeps `walkable()` byte-identical to content and adds **blockers** (buildings, trunks, big rocks, posts, well, stalls, benches, gardens, the heart-tree ring); `resolveMove` tests `passable = walkable && !blocked`, so client prediction is stricter than the server, never looser. **Blocker for content / server:** the server lets players walk through houses until content encodes footprints. |
| Z7 | `ZoneSpec.warps` (Marker has no destination) | The adapter emits the door marker plus an arrival marker `${id}:to` at (toX, toZ); the builder pairs them, puts a hut / hall whose door is the marker and a roofless room at the arrival point. |
| Z8 | `ZoneDef.signature` vs `SetPieceId` | Content's signature strings are story names ('grove_stone', …); the adapter maps each zone to its SPEC `SetPieceId` by ZONE_ORDER slot (`SET_PIECE_BY_ZONE`). Towns put the set-piece at the plaza centre, routes at the corridor midpoint, story zones at the origin. |
| Z9 | `spec.water` (one WaterSpec) | The adapter writes the largest heightfield water body; the builder renders every body of the water mask. Level = highest open-water sample + 4 cm, capped 3 cm under the lowest dry sample on the body's border, and the mesh is clipped to the mask dilated one sample — the visible shoreline is exactly where collision says water begins. |
| Z10 | gym (server door (0, −26)) | The gym is always placed with its door there; when authored points would sit inside or against the default 14 × 12 m hall it shrinks (depth ≥ 5 m, width ≥ 8 m) rather than covering them (cinderhold's tablet at (0, −34) → a 5 m-deep hall). |
| Z11 | light budget | Zones spend ≤ 1 shadow-casting light (a local caster re-renders its casters: draw calls) and ≤ 20 non-shadowing, leaving the arena's 2 beacons and headroom inside 8 / 24. Lamp posts are free-standing (housing directly above the post) so the housing is exactly at `HOUSING_LOCAL`. |
| Z12 | fog | Palettes scale the §10.3.7 density by 0.38 (`FOG_SCALE`): at 0.018 the player's feet are 37 % fogged at the default camera distance (part-1 M19) and the diorama read washed out. |
| Z13 | route patches | 4–5 of the SPEC's 3–5 tall-grass patches (semi-axes 8 × 5 m, 2.2 tufts / m²) — three read sparse on a 208 m route; route trees follow 0.045 / m² inside clumps and 0.008 elsewhere with a 9 m tree-free band along the road. |
| Z14 | windows | Most windows use a non-emissive glass (`mist_glass` in the grove); about one in three uses the biome's lit glass (`glass_warm`) — lit rooms by day, warm windows at night, without every facade blooming at noon. |

## Measured

Browser: sandbox `?zone=mirevale` / `?zone=mire_route` (real ZoneSpecs through the client adapter, baked KTX2 sets), Chrome WebGPU, Intel Gen-12 iGPU, 1280×720 shots, gameplay camera (FOV 28°, pitch −52°, 26 m). `draws` = `renderer.info.render.drawCalls` for the whole frame (beauty + 4 cascades + local shadow + ~30 post passes); `beauty` = the same with the shadow pass switched off (§10.5.8's ≤ 400 cap applies to beauty + post).

| Zone / shot | draws (total) | beauty + post | triangles | materials | programs | lights (shadow + non) | CPU `frame()` |
|---|---|---|---|---|---|---|---|
| mirevale plaza (6, 8), zoom 1, 10:00 | 247 | 89 | 348 k | 18 | 107 | 1 + 17 (+ 2 part-3 arena beacons) | 8–10 ms |
| mire_route spawn (−92, 0) | 153 | 83 | 537 k | 13 | 107 | 1 + 9 | 6–9 ms |
| mire_route boardwalk (0, 2), zoom 1 / 2 | 182 | 85 | 420 k | 13 | 107 | 1 + 9 | 6 / 11 ms |
| mire_route pond (−30, −20) | 165 | 73 | 531 k | 13 | 107 | 1 + 9 | 6 ms |

- Before C20 / C21 the same Mirevale view cost 517 draws, 175 → 271 programs and 185 ms CPU per frame.
- Node build times (all 21 zones, `buildZone`, no GPU): towns 0.4–0.85 s, routes 0.45–0.65 s, story 0.28–0.37 s; triangles built (all tiers, whole field + skirt): towns ≈ 250 k, routes ≈ 520 k, story ≈ 370 k; ≤ 18 materials in every zone.
- **Open (not fixable in zone files):** `programs` 107 > the §50.2.2 cap 96. The step-8 baseline is already 79 (part 1: 63, part 3 added 16); a zone adds 28, most of them the light-set variants of every lit structure (C11: the zone's punctual lights are part of each program's source). Options for the orchestrator: fewer punctual lights per zone (each distinct count recompiles), or warm-compiling with a representative light set.
- `renderTargets` 34 (part-1 C18, unchanged by zones: no impostor targets, Z2).
- **Leak, real GPU** (`__ewaSandbox.leakCycle(3)` on Mirevale, stage wiring present): after every unload `geometries`, `programs`, `attributes`, `attributesSize` equal the step-8 baseline exactly (±0); `textures` and `renderTargets` sit at +1 / +1 on every cycle — constant, not growing, and not zone-owned (the zone creates no texture or target; a lazily-created host/stage target allocated after the baseline capture). **Open for `leak.spec.ts`:** capture the baseline after one frame, or find that target (part 1 / part 3).
- Light budget with part 3: the stage's two arena beacons are shadow casters from startup; zones spend ≤ 1 (cap 8 − 2 = 6 asserted in the adapter test) and ≤ 20 non-shadowing.

## Tests (part 2): 29 tests in 5 files + the adapter's 4

`prng.test.ts` (core constant 546, draw-for-draw equality with core `createRng`, labelled forks) · `collider.test.ts` (10 000 points vs content `sampleHeight`/`isWalkable`/`isWater` on the committed mirevale field, normals, bounds, `MOVER.capsuleRadius === MOVEMENT.radius`, `resolveMove` never unwalkable over 10 000 displacements on mirevale and mire_route, slide / escape, water bodies) · `zone-layout.test.ts` (layout / lod / palettes pure, tiers + hysteresis, chunk grid, town ring + gym door + shop/healer flank, route corridor / patches / clearings, splat, set-piece tables, 21 palettes) · `zone-dispose.test.ts` (dispose-contract: idempotent, root removed, every geometry / InstancedMesh disposed, dispose events on plain meshes, lights released, `evictExcept([])`, zero Material/Texture `dispose` calls from the builder; only `BufferGeometry` and library materials, ≤ 32 on the slice; leak: 100 load/unload cycles with a mock GPU mirroring three's bookkeeping return geometries / attributes / textures / programs / render objects to baseline exactly with identical digests; mirevale and mire_route twice each) · `packages/client/test/zoneSpecFor.test.ts` (21 zones × 3 harvest states deterministic + snapshot, table mapping, gym door, authored points clear, light budget, water spec). Helpers in `test/zone-helpers.ts` (mock library / mock GPU / synthetic and real slice specs — render tests may not import the client package).

## Sandbox (part 2)

`?zone=<ZoneId>` loads the real zone through `@ewa/client-adapter` (vite alias to `packages/client/src/scene/zoneSpecFor.ts`, plus `@ewa/content` / `@ewa/core` / `@ewa/render` aliases) and `renderer.loadZone`; optional `&x=&z=` focus, `&h=` heading, `&zoom=`, `&t=` hours, `&harvest=`. `window.__ewaSandbox` adds `goto(x, z, heading?, zoom?)`, `zone()`, `baseline()`, `beautyDraws()` (frame with shadows off → beauty + post count), `leakCycle(n)` (dispose / render / diff `renderer.info.memory` against the step-8 baseline / reload); `shot()` now always renders at 1280×720.

---

# Part 4 — hardening (2026-09-25)

Scope: the amended SPEC §10 / §50.2 (2026-09-25: render targets ≤ 41, programs ≤ 128, fog 0.0068, × π light units,
billboard yaw + half-pitch lean, DOF arithmetic) and the findings / recommendations of
`.design/audits/spec-verification.md` that land in `@ewa/render`. The SPEC is not edited here; where a SPEC number or
sentence should change, the proposed CHANGELOG entry text is given at the end of this part.

Measurement setup (every browser number below): the render sandbox (`EWA_SANDBOX_NO_HMR=1 pnpm --filter @ewa/render
sandbox`, port 5180 — HMR off so saving a file never reloads a page mid-measurement), headless Chrome 153 over CDP
(`--headless=new --enable-unsafe-webgpu --enable-gpu --ignore-gpu-blocklist --disable-gpu-shader-disk-cache`, a fresh
profile per run, so every run compiles cold), dev machine Intel Gen-12 iGPU (D3D12), 1280×720 canvas, pixel ratio 1,
`?zone=mirevale&x=6&z=8&t=10` unless stated. `__ewaSandbox.timing()` (new) records `createRenderer` (incl. the step-8
warm-up frame and a GPU-queue drain), `loadZone`, and the first zone frame (CPU time of `frame()` and time until
`device.queue.onSubmittedWorkDone()`), with `programs` at each step.

## H1 — caps (task 1)

`stats.ts` `COUNT_CAPS` and `tools/asset-audit/src/caps.ts` `COUNT_CAPS` carry the amended §50.2.2 values:
`renderTargets 41`, `programs 128` (was 24 / 96). Both test files pin the literals; the render test also asserts the
measured slice numbers (34 render targets, 107 programs) raise no violation and 41 / 128 are inclusive. The sandbox's
`capViolations()` no longer flags every zone (M3 smoke note). The asset-audit README table follows.

## H2 — `dumpZone()` completeness (task 2)

`ZoneDump` gains the fields §40.5.2 says "the dump gains" (render's type = §10.10.1 verbatim + these; the asset-audit
mirror already had them as optional fields, so only its comments, README and the drift test's key lists changed):

| Field | Source |
|---|---|
| `materials[].side` | `Material.side` (0 Front, 1 Back, 2 Double) |
| `geometries[].sharedBy` | meshes under the root drawing the geometry |
| `geometries[].kind` / `.tier` | `InstancedMesh.userData.ewaScatterKind / ewaScatterTier`, written by `ScatterField` (null / absent for non-scatter). A geometry drawn at two tiers (rock_a's lod2 doubles as its impostor) gets one row per tier |
| `geometries[].instancedMesh` | `isInstancedMesh` (the verbatim `instanced` is 1 for a plain mesh too) |
| `lightSources[]` `{ id, lightDistance }` | the housing → light direction of Pillar 4 (§50.4.6 "both directions"): every **tagged** housing and the distance from its glowing part to the nearest light (+∞ → JSON null) |

- **Tagging.** The zone builder tags every generated housing with the world AABB of its emissive-class triangles at
  lod0 (`root.userData.ewaHousings`, `HousingTag`), computed from the real housing geometry at its real placement —
  not from the light position — so a generator whose glass drifts from `HOUSING_LOCAL` shows up. A mesh whose
  material has `userData.lightSource === true` (the arena beacon housings) is tagged whole.
- **Light → housing got tighter.** `housingDistance` used the bounding box of every mesh with an emissive material;
  static props are merged per 32 m chunk, so a lamp's "housing" was the whole chunk box (any light inside a chunk
  with one emissive triangle read 0). Now the emissive groups of each mesh are split into connected glowing parts
  (triangles sharing a 25 cm grid cell, union-find) and the distance is to the nearest part (or tagged housing).
- **Billboards.** `sprites[]` and the billboard material row read `userData.ewaAlbedo ?? map` (part-3 note P7), so
  `sprites.nearest` sees the atlas albedo (magFilter 1003, anisotropy 1) and `maps.albedo` is true.
- **Measured on the built slice zones** (`test/zone-dump.test.ts`, mock library, real specs): mirevale 18 lights /
  15 tagged housings, mire_route 10 / 8 (the rest are set-piece `mesh` housings, measured by direction 1 only); worst
  light → glowing-part distance 0.00 m and worst housing → light 0.00 m in both (the light sits inside its glass);
  sides {0, 2} only (no BackSide under a zone root). Moving one tag 5 m makes its `lightDistance` > 4 (test).
- **Finding for the audit (not changed here):** `scatter.instanced` requires lod0/lod1/lod2 + impostor for every
  scatter kind. The dump now shows the implemented tier sets: trees and rock_a {0, 1, 2, 3}; rock_b, bush, stump,
  log {0, 1, 2}; flower_patch, grass_tuft, tall_grass {0, 1} — the part-2 Z2 design (small kinds are not drawn
  beyond 90 m, only trees get impostor cards). The rule will therefore fail every real dump; proposed CHANGELOG
  entry P4-C1 below (accept "not drawn at that tier" for non-tree kinds).

## H3 — DOF halo around sharp billboards (task 3, R4)

`buildPostOutput` feeds the DOF `viewZNode = −d · (1 − mask.y)` instead of `−d` (`post/pipeline.ts`), so the circle
of confusion is 0 wherever a sharp billboard or the player character writes `mask.y = 1`; the composite
`mix(blurred, bloomed, mask.y)` is unchanged. Why this removes the halo (read in `DepthOfFieldNode.js`): the near
field's CoC is Gaussian-blurred (`_CoCBlurNode`) and the blur16 pass is a max filter over blur64 taps, so a sharp
sprite off the tilted plane spread its own CoC (and, through the max pass, its colour) into the in-focus ground
around it. With its CoC at 0 the sprite adds no near/far weight of its own. What remains by construction: an
out-of-focus background pixel next to a sprite still gathers the sprite's colour within its own CoC radius (a gather
DOF without per-tap depth weighting; three's node has none). That is much weaker and only happens where the
background is already blurred. `PostBuildOptions.dofMaskedCoC` (default true) keeps the part-1 graph available for
A/B (`__ewaSandbox.setDofMaskedCoC(false)`). Test: `post-graph.test.ts` walks the real TSL graph. Through its
`VarNode`, the DOF's `viewZNode` is a `*` whose left operand contains the depth texture and not the mask, and whose
right operand contains the mask texture and not the depth. With the option off, the mask is absent.

## H4 — shader pre-compilation (task 4, R6; coordinator item 4)

`renderer.loadZone` now resolves only after `precompile('zone', …)` has compiled the zone root and the kept step-8
warm-up group against the zone's light set; `createRenderer` step 8 pre-compiles the warm-up group before its warm-up
frame. Both go through `gpu.compileAsync` (`createRenderPipelineAsync` plus a yield per object), as
`COMPILE_CONCURRENCY = 4` concurrent calls. Progress: `RendererOptions.onCompileProgress({ phase: 'boot' | 'zone', zone,
loaded, total, done, ms })` for the client's BootScreen (the client still has to wire it; not a render file).
`RendererOptions.precompile: false` restores the old path (A/B only).

These three 0.186 facts each made the pre-compiled programs differ from the ones the first frame used. They were
measured by diffing `renderer._pipelines.programs` before and after the first zone frame (`__ewaSandbox.newPrograms()`):

| # | Fact (node_modules) | Symptom before the fix | Fix |
|---|---|---|---|
| a | `compileAsync` captures the render context in its synchronous prologue, but every node build runs later in its async loop and reads `renderer.getRenderTarget()` / `getMRT()` again (`NodeMaterial.setup` → `setupOutput`, `NodeBuilder.needsPreviousData`) | with the target and MRT restored after the prologue, every async pipeline failed validation ("Color target has no corresponding fragment stage output") | the scene pass's target and MRT stay set for the whole compile; `frame()` swaps the canvas state in and out around its synchronous body (`compileHold`) |
| b | `RenderObject.getMaterialCacheKey()` includes `renderContext.id`, and `RenderContexts.get(rt, mrt, callDepth)` keys contexts by render call depth. The scene pass renders nested inside the display node that first reads its textures (depth 3 measured with the full graph: pipeline quad → DOF CoC quad → pass), while `compileAsync` asks for depth 0 | the first frame redid every node build on the CPU (profiled: 10.4 s in `NodeManager.getForRender → NodeBuilder.build`) | the prologue's `RenderContexts.get` answers with the depth the scene pass last rendered at (`PostStack.sceneCallDepth`, recorded by wrapping the pass's `updateBefore`) |
| c | TRAA calls `velocity.setProjectionMatrix(unjittered)` only during its own render; `VelocityNode.setup` emits `uniform(projectionMatrix)` when a matrix is set and `cameraProjectionMatrix` otherwise, which is different WGSL | 29 programs pre-compiled, 26 of them rebuilt by the first frame, differing only in that line | while compiling, the velocity node carries a projection matrix whenever TRAA is in the graph (re-applied after any frame that runs meanwhile) |
| d | the light set is part of every lit program; a light listed twice counts as a different set | (design) | the containers' renderable children compile from detached groups while their lights and spot targets stay in place; `LightsNode` sorts by id, so order does not matter |
| e | `ShadowNode.updateBefore` returns while `_isPreCompiling`; post quads compile on their first render | 4 vertex + 4 fragment programs are still built by the first frame | not covered (small) |

Measured on Mirevale, cold (fresh Chrome profile, `--disable-gpu-shader-disk-cache`, Intel Gen-12 iGPU):

| | before (parts 1–3) | after |
|---|---|---|
| `createRenderer` incl. step 8 + GPU drain | 43.0 s | 16.4–23.0 s (boot pre-compile 15.2–20.2 s, 88 render objects in 4 groups) |
| `loadZone` | 7.2 s | 36.6–52.9 s (zone pre-compile 40–45 s, 569 render objects, including every LOD level, far scatter tier and off-screen prop) |
| first zone frame, CPU `frame()` | 10.1 s | 0.19–0.34 s |
| first zone frame until the GPU queue drains | 48.9 s | 1.9–3.4 s |
| programs after step 8 / after `loadZone` / after the first frame | 79 / 79 / 107 | 79 / 91 / 97 |
| boot → first finished zone frame | ≈ 99 s, then ≈ 50 s of ~1 fps frames (coordinator item 4) | ≈ 68 s, with no hitch after it |

The zone compile takes longer than the old synchronous first frame's CPU part because it also compiles what that
first frame never showed (LOD 1–2, scatter tiers 1–3, off-screen chunks). The old path compiled those later, as
hitches when the camera moved. The hero-tier texture stream now waits for the compile (H5a).

## H5 — leak baseline (task 5)

Measured against the step-8 baseline with `?track=1`. The sandbox hooks `WebGPURenderer.init`, so every render target,
texture and attribute three initialises after init is recorded with its name, size and creation phase. After the
first zone frame it also records the call stack and the render object that created it. `__ewaSandbox.leaks()` lists
what is alive now that was not alive at the baseline. Test: Mirevale, unload right after load, then a full cycle
(reload, 8 s of play, unload):

| After unload vs the step-8 baseline | before | with the pre-compile, before these fixes | after |
|---|---|---|---|
| render targets | +1 | 0 | **0** |
| textures | +1 … +2 | +21 | **0** |
| attributes / bytes | 0 | +5 / 192 B | **0 / 0** |
| programs, geometries | 0 | 0 | **0 / 0** |

After the fixes, both the immediate unload and the full cycle measure exactly 0 in every counter, with an empty
`leaks()` list. The Part 2 **+1 render target** was never alive in any tracked list: it was created by the first
frames after step 8, before the old tracker was installed. Step 8 now renders one frame before its pre-compile and
warm-up frame, so the target exists at the baseline (measured 0 ever since). The node leak test (`zone-dispose.test.ts`,
100 cycles with the mock GPU) asserts the exact baseline as before, plus the hero gate (H5a).

- **H5a (+21 textures): the hero stream during the compile.** `loadZone` started `preloadHero` at once. Hero sets
  bound mid-compile disposed the field sets while the compile was still building bindings from states made before
  the re-point, and those builds re-initialised the disposed field textures on the GPU. Fix: `ZoneBuildDeps.heroGate`.
  The renderer opens the hero stream after the pre-compile, and never for a zone that was disposed meanwhile.
- **H5b (+5 attributes / 192 B): the warm-up quad.** `warmUp` disposed the quad geometry but kept its meshes, so the
  zone pre-compile of the warm group re-uploaded the disposed geometry and nothing freed it again. The quad now stays
  alive with the warm meshes (it is part of the baseline) and is disposed in `dispose()`.
- **H5c (three 0.186, general): stale sampled textures in cached node-builder states.** `NodeBuilderState.createBindings()`
  clones every `NodeSampledTexture` with the `texture` captured when the state was built, and
  `Bindings._createBindings` calls `textures.updateTexture(binding.texture)` before `binding.update()` refreshes it
  from its node. So any render object created after a material re-point (a LOD or scatter tier appearing, a
  shadow-pass object) re-initialises the replaced, already disposed texture, and nothing disposes it again. The last
  +1 was exactly this. The tracker named it: "RE-INIT after destroy by Mesh 'ewa:scatter:tree_willow:t1:a0' /
  'ShadowMaterial'", a field albedo disposed at the hero bind and sampled by the shadow pass through
  `reference('map', 'texture', material)`, a node whose value updates only during a render. Two changes:
  (1) `preloadHero` **retires** the replaced field set instead of disposing it; retired sets are released at the next
  `evictExcept`, when the zone's render objects are gone (cost: the field sets of hero surfaces stay resident for the
  zone's lifetime, ≈ 1 MB each at 512² BC7). (2) Defensively, the library calls `beforeRelease` after every re-point and
  before it disposes anything (eviction, the KTX2 placeholder replacing the runtime one). The renderer's hook refreshes
  the sampled-texture bindings of every cached state (`refreshCachedTextureBindings`, `_nodes.nodeBuilderCache`).
  Tests: `material-library.test.ts` (retire then release at eviction, hook order, the refresh itself).

## H6 — per-pass GPU timing (task 6)

Why `passMs` was all null: nothing in play wrote it. §10.10.3 reserves it for the differential harness
(`measurePassMs`), and `resolveTimestampsAsync('render')` returns only the summed frame. three 0.186 can resolve
per-pass times, though. `WebGPUTimestampQueryPool._resolveQueries` keeps one duration per render-context uid in
`timestamps: Map<uid, ms>` for the last resolved batch, and `Renderer._renderScene` calls
`inspector.beginRender(uid, scene, camera, renderTarget)` with the same uid for every `render()` (`Renderer.js` line
1751). So with `trackTimestamp` on, the host installs a `PassTimer` (`stats.ts`, an `InspectorBase`) that maps each uid
to a §50.2.1 row by render target:
- the scene pass → `opaque`;
- the render targets each graph stage's display nodes own (including the `convertToTexture` RTTs) → that stage
  (`stageTargets`, rebuilt with the graph). The mapping reproduces the §10.10.2 derivation exactly: bloom 11, DOF 9
  (6 + Gaussian 2 + input RTT), TRAA 3, GTAO 1, chroma input RTT 1 (`grade` row), scene 1 (tested);
- `ShadowMap` / `PointShadowMap` / `VSM*` targets → `shadows`;
- the canvas (the output quad + HUD) → `grade`;
- anything else (PMREM bakes, the IBL probe) → `opaque`, as §10.3.3 amortises the bake inside opaque.

After every resolve, `collect` sums the last frame's durations per row into `RenderStats.passMs`. `sprites` stays null:
billboards, decals and VFX render inside the one scene pass (§10.8.1), so only the differential procedure can split
them out. Once `measurePassMs` has run, its numbers are latched. The client does not pass `trackTimestamp`, so in play
`passMs` stays null as §10.10.3 says (proposed entry P4-C2). Measured (Mirevale spawn, 1264×569, cold iGPU): `gpuMs`
108–137, opaque 91–119, shadows 6.9–7.5, gtao 2.9–3.4, traa 1.6–1.9, bloom 0.59–0.67, dof 3.4–4.1, grade 0.95–1.14 ms.
The rows sum to `gpuMs`. Only one resolve is in flight at a time, so a value lags the frame by a few frames.

## H7 — characters from GLB (task 7)

`stage/looks.ts` `createGlbLookSource` reads `models.manifest.json` once, loads each look's GLB once through
`GLTFLoader` + `MeshoptDecoder` + the host's `KTX2Loader` (`/models/${url}?v=${hash8}`), and keeps the one skinned
mesh, its clips and ONE scale for every look (`CHARACTER.heightM / median(bounds height)` = 1.7 / 3.1). Using one
factor keeps a viking's horns taller than a bare head. `CharacterPool`:
- on `spawn`, shows the look's GLB instance when the template is loaded; otherwise it shows the procedural figure and
  requests the load (one request per look), then swaps every live actor wearing that look. A look the manifest does
  not list (for example `ranger_m`) or a failed load keeps the procedural figure (warned once, in dev);
- an instance is `SkeletonUtils.clone(template)`: its own bones, the template's geometry (shared per look), the pool's
  one `'character'` material, `castShadow`, `userData = the rig's { sharp }` (DOF mask). That is one mesh per actor,
  so one draw per pass;
- one `AnimationMixer` per instance. `idle` / `walk` / `run` weights come from the existing gait blend
  (`1 − walk`, `walk · (1 − run)`, `walk · run`). Emotes play `victory` (wave, happy, heart, cool), `defeat` (sad) and
  `standup` (alert) over them with a 10/s fade. `mixer.update(dt × timeScale)` runs in the pool's frame hook with no
  per-frame allocation;
- a despawned instance is recycled per look, not re-cloned. `dispose()` stops and uncaches the mixers, disposes the
  skeletons and the look source (template geometries and materials).
`RendererOptions.modelsUrl` (default `/models/`, null = procedural only). Test: `actors-glb.test.ts` (4 tests, a
synthetic template shaped like the pipeline output). Legendary GLBs (§10.7.7, LOD1 beyond 40 m) are not wired: no
render subsystem draws a legendary yet, and battle creatures are billboards. Left open.

## H8 — fog and readability (task 8)

The zone palettes already carry the amended grove density: 0.018 × `FOG_SCALE` 0.38 = 0.00684 m⁻¹. Feet at 26 m are
16.3 % fogged, a 12 m battle close-up 7.9 % (5.5 % at 1 m height), the 4 m inspector 2.7 %. But the host defaults
(`GROVE_LIGHTING.fogDensity`, `createHeightFog`) were still the draft's 0.018. Those defaults are what every zone-less
view renders (boot, the part-3 lineup / inspector demo, frames before `loadZone` applies the zone palette), which is
where part 3 saw the washed-out inspector. Both are now `GROVE_FOG_DENSITY = 0.018 × 0.38` (test: equals
`PALETTES.grove_mirevale.fogDensity`, 16 % at 26 m, < 3 % at 4 m). Some zone rows keep their own densities (mire
route 0.02 × 0.38, rift 0.03 × 0.38); those are within §10.3.7 ("palette values for grove").

## H9 — `resolveMove` never moves farther than the step (coordinator item 1)

Rule 4 probed the capsule radius around the TARGET (up to step + 0.35 m) and the stuck-inside escape returned the
nearest passable sample (up to 4 m). The server counts a step over its speed cap as a rejection and kicks after 30,
which the client's two-player runs hit at walls. Now rule 4 probes AT THE STEP LENGTH around the START, at ±22.5°, ±45°,
±67.5° and ±90° from the desired direction (never backwards), taking the first that passes, and the escape walks toward
the nearest passable sample by at most the step. Invariant tested over the 20 000 random displacements:
`|result − start| ≤ |d|`. A head-on wall case slides along the wall at exactly the step length, and a start inside a
3 m blocker walks out at 0.1 m per call.

## H10 — battle HUD bars (coordinator items 2, 3)

`placeBars()` centres each bar above its battler's anchor and clamps it inside the screen margins. It then moves the
bar off three reserved boxes (the turn label's `HUD.turnBandW 320 × turnBandH 34` box at its old position, the party
strip, and the clock / quest hint) by the smallest move among up / down / left / right that stays on screen. Finally it
moves the bar past any earlier bar (below, else above, else beside), so bars never overlap. The dirty-region box and
the draw both use the placed positions. A first version reserved a full-width band under the top row. In the sandbox
battle shot that pushed the far battler's bar down onto its own sprite (the far battler stands at the top of the
battle frame), so only the label's box is reserved now. Test (`hud.test.ts`): the near battler's head at the top centre,
the far one off the right edge, both on one spot, the bottom-left corner, and a bar grazing the label that moves up a
few px instead of down.

## H11 — tree crowns for the shot camera (coordinator item 5)

The zone builder registers one crown sphere per scatter tree on the zone's `TerrainCollider` (`addCrown`), including
the unwalkable 16 m margin forest and the skirt treeline, which have no blockers. The sphere is the tree kind's leaf-card
bounding box (lod0), rotated and scaled per instance, radius 0.85 × the half extent. mire_route registers > 500. Query:
`crownClearance(a, b)` returns the first entry parameter along a segment (a start inside a crown counts as clear), plus
`inCrown(p)`, both allocation-free on a 4 m grid. `DioramaRig` takes `occluders` (the wiring passes the loaded zone's
collider, null once it is disposed). In a battle or inspector shot the camera is pulled in along the orbit ray to
0.4 m in front of the first crown between it and the orbit centre, never closer than 3 m, weighted by the shot blend.
The diorama camera (high above the canopy) is untouched. Tests: collider (entry parameter, pass-over, start-inside) and
rig (a crown two thirds of the way to the camera pulls the shot in and leaves it outside every crown; diorama unchanged).

## Proposed SPEC CHANGELOG entries (not applied — the SPEC is not edited here)

- **P4-C1** §40.5.2 `scatter.instanced`: "for every scatter kind present the dump lists 3 LOD tiers + `impostor`" →
  "tree kinds list lod0–lod2 + impostor; other kinds list the tiers they are drawn at (≥ lod0 + lod1), since small
  kinds are not drawn beyond 90 m (render Part 2 Z2)". As written, every real dump fails (render Part 4 H2).
- **P4-C2** §10.10.3: "`passMs` … during play every entry is null" → "… null unless the renderer tracks timestamps;
  then the host fills it per render context (scene pass → opaque, stage targets → their row, shadow maps → shadows,
  canvas → grade, `sprites` null). The differential procedure of §50.2.3 remains the budget measurement and overrides
  the per-context values once run" (render Part 4 H6).
- **P4-C3** §10.1.2 step 8 and §10.5.9: `loadZone` resolves after `compileAsync` has pre-compiled the zone and the
  warm-up group with the zone's light set (the R6 recommendation, done), keeping the scene pass's target, MRT, call
  depth and TRAA's velocity projection for the whole compile. The first zone frame then builds only shadow-pass
  variants and post quads (measured 4 + 4 programs, 0.3 s CPU vs 10.1 s). `RendererOptions.onCompileProgress` reports
  progress (render Part 4 H4).
- **P4-C4** §10.6.2 rule 4: "8 directions of the capsule radius (0.35 at 45° steps) around the target" → "8 directions
  at the step length around the start, ±22.5°…±90° from the desired direction, smallest angle first", and the
  stuck-inside escape "steps toward the nearest passable sample by at most the step length". Invariant:
  `|result − from| ≤ |(dx, dz)|` (render Part 4 H9).
- **P4-C5** §10.10.1 `ZoneDump`: add `materials[].side`, `geometries[].sharedBy / kind / tier? / instancedMesh` and
  `lightSources[] { id, lightDistance }` to the verbatim type (the fields §40.5.2 says the dump gains; render Part 4 H2).
- **P4-C6** §10.2.3 / §10.5.9: "`preloadHero` … releases the surface's field set" → "retires it; retired field sets
  are released at the next `evictExcept`", and the hero stream starts after the zone pre-compile. three 0.186's shadow
  pass re-initialises a texture disposed while render objects of the zone can still be created (render Part 4 H5).
- **P4-C7** §10.7.7: all looks are scaled by ONE factor `1.7 m / median look height`; emotes play
  `victory` / `defeat` / `standup` (the pipeline keeps no emote clips) (render Part 4 H7).
- **P4-C8** §10.9 `battle` region: bars are clamped inside the margins, kept off the turn label, the party strip and
  the clock, and never overlap (render Part 4 H10).
- **P4-C9** §10.7.4: the battle / inspector camera never enters a tree crown. The zone collider exposes crown spheres
  and the rig pulls the shot in along its orbit ray (render Part 4 H11).

## H2 addendum — sprites outside the zone root

Creature billboards live in the sprite pool, outside the zone root, so a zone dump never listed them and
`sprites.nearest` could not see them. `DumpInput.spriteScan` (the host passes its scene) adds one `sprites[]` row per
billboard material found anywhere in the scene. `materials[]` stays the zone root's set, which is what
`counts.materials` counts. Test: `zone-dump.test.ts` (a pool outside the root yields `{ atlas, magFilter 1003,
anisotropy 1 }` read from `userData.ewaAlbedo`).

## Measured summary (dev iGPU, cold compiles)

| Metric | before | after |
|---|---|---|
| caps (render targets / programs) | 24 / 96 (every zone flagged) | 41 / 128 (Mirevale 34 / 97 passes) |
| programs after step 8 / after `loadZone` / after the first zone frame | 79 / 79 / 107 | 79 / 91 / 97 |
| render targets (Mirevale / battle demo) | 34 / 34 | 34 / 36 (battle: +2 beacon shadow maps, unchanged by this part) |
| first zone frame CPU / to GPU idle | 10.1 s / 48.9 s | 0.19–0.34 s / 1.9–3.4 s |
| `createRenderer` (step 8 incl.) | 43.0 s | 16.4–23.0 s |
| `loadZone` | 7.2 s | 37–53 s (the compile moved here, incl. LOD / far tiers) |
| leak after unload (rt / tex / attr / prog / geo) | +1 / +1…+2 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 (immediate and after a full cycle) |
| `stats().passMs` in the sandbox | all null | resolves per row (Mirevale: opaque 91–119, shadows 6.9–7.5, gtao 2.9–3.4, traa 1.6–1.9, bloom 0.6, dof 3.4–4.1, grade 1.0 ms; battle demo: gpu 29–37, opaque 20, dof 4.8 ms) |
| actor | procedural figure, 1 mesh | GLB look (6 492 tris, 23 bones), 1 mesh; 6 draws per actor per frame = beauty + 4 cascades + the local spot, the same count as a procedural rig |
| DOF A/B, battle demo (same frame) | — | mean absolute difference 1.6 / 2.7 levels per channel around the far / near battler (max 66) |
| fog on the 4 m inspector | 0.018 host default | 0.0068; contrast σ 49.9 → 51.3, nearly identical at that distance |

## Tests (Part 4)

Render + asset-audit: **238 tests in 22 files, all passing** (baseline 215 in 20). New files: `test/zone-dump.test.ts`
(dump on the built slice zones, housings both directions, sprite scan) and `test/actors-glb.test.ts` (GLB looks). Extended:
`stats-dispose` (caps, per-context pass aggregation, `PassTimer`), `post-graph` (DOF mask CoC, stage → render-target
map), `collider` (step-bounded `resolveMove`, crowns), `camera-rig` (crown avoidance), `hud` (bar placement),
`material-library` (retire / `beforeRelease` / refresh), `zone-dispose` (hero gate), `lighting` (fog default),
asset-audit `rules` (caps) and `zone-dump` (new fields, drift keys). `packages/client` (read-only check): `tsc -b`
clean, `zoneSpecFor` snapshot unchanged, and the client suite passes.

## Sandbox (Part 4)

`EWA_SANDBOX_NO_HMR=1` disables HMR for measurements. After a dependency re-optimisation, reload the page by hand
(vite cannot reload it without HMR). URL flags: `&track=1` (GPU object tracker), `&hold=1` (defer the first zone frame;
`release()` renders it), `&precompile=0` (the pre-H4 path). `window.__ewaSandbox` adds `timing()`, `newPrograms()`,
`live()`, `leaks()`, `setTrackPhase(p)`, `setDofMaskedCoC(bool)`, `setFogDensity(d)` and `release()`. The lineup demo
walkers are two manifest looks (`casual_male`, `cowboy_female`) plus `ranger_m` (not in the manifest: procedural).

## Open (not done in Part 4)

1. **Legendary GLBs** (§10.7.7, LOD1 beyond 40 m): no render subsystem draws a legendary yet (battle creatures are
   billboards), so they are not wired. `createGlbLookSource` already passes the host `KTX2Loader` to `GLTFLoader`.
2. **`onCompileProgress` → BootScreen:** the option exists and reports progress; the client has to pass it into
   `createRenderer` and show it (client file, not changed here). Zone loads now take 37–53 s cold on the iGPU, and
   that time is in `loadZone`. A browser GPU shader cache (warm runs) should cut it; not measured.
3. **Shadow-pass variants and post quads** still compile on the first zone frame (4 + 4 programs, ≈ 0.3 s CPU).
4. **`scatter.instanced`** fails every real dump by design until P4-C1 is decided.
5. **Browser-side audit run:** the new dump fields are verified in node on the built slice zones and through the drift
   test. A `dump()` from the browser sandbox piped through `pnpm audit:assets` was not re-run after the last change.
6. **DOF gather leak:** out-of-focus background pixels next to a sharp sprite still gather its colour within their own
   CoC (H3). Removing that needs depth-weighted taps inside `DepthOfFieldNode`, i.e. a custom DOF node.
7. The `sprites` row of `passMs` stays null in play (inside the scene pass); only the differential probe splits it.

---

# Part 5 — slice fixes from the M2 audit (2026-09-30)

Scope: the first M2 audit shots (battle arena full of tall grass, the battle HUD hiding the player's battler, a wild
creature invisible in tall grass), the two-phase zone compile, the client's compile progress, the SPEC sync of the
Part 4 entries, and the audit blockers M2-battle-5/6/7/8, M2-spawn-noon-9 and M2-gym-dusk-7 plus the capture
harness's findings (heading convention, counts after an await, `passMs` all `opaque`). SPEC entries: CHANGELOG
2026-09-30 (P4-C1 … P4-C9 and one per change below). Measurement setup as in Part 4 (render sandbox, headless Chrome
over CDP, fresh profile, `--disable-gpu-shader-disk-cache`, Intel Gen-12 iGPU).

## T1 — the arena clears the ground cover (and the props) in its ring

- **`ScatterMask`** (`zone/scatter.ts`, one per zone root via `scatterMaskFor(root)`; every `ScatterField` of that
  root reads it, so the builder did not change): 24 disc slots `{ x, z, inner, outer, floor, classes }`. `sync()`
  writes a masked instance with its vertical axis scaled by the disc factor (`floor` inside `inner`, smoothstep to 1
  at `outer`), or a zero 3×3 at a factor ≤ `MASK_HIDE_BELOW` 0.04 (degenerate: nothing rasterises, beauty or shadow).
  Cover classes by kind name (`coverClassOf`): ground (`tall_grass`, `grass_tuft`, `flower_patch`), small (bushes,
  `rock_b`, stumps, logs), large (`rock_a`), tree. A mask change rewrites only the chunk slices a disc reaches or
  reached (per chunk `dstAt` / `masked`), uploaded as one update range per tier grown in place (`extendUpload`, no
  allocation after the first range object). A chunk rewrite (tier or frustum change) re-applies the mask. Source
  matrices and the digest are untouched.
- **Stage** (`stage/battleStage.ts`): `dress` → `coverArena(on)`: slot 2i hides ground cover inside 4.9 m, easing
  back by 6.6 m; slot 2i+1 hides small + large props inside 5.0 m (hard edge). Main arena + 3 spectator arenas (slots
  0–7). Cleared when the arena has sunk (`hideArena`) and in `dispose`. `setGroundCover(mask, cut)` comes from the
  wiring's `onZone` (null when the zone is disposed: the renderer now calls `onZone(null)` from the handle's dispose).
- **Prop cutaway** (`stage/propCutaway.ts`, audit M2-battle-8): hand-placed props are merged per chunk
  (`ewa:props:*`), so a fence post cannot be hidden per object. Triangles whose centroid is inside 5.0 m become
  degenerate (indexed: the three indices become one; otherwise the vertices collapse onto the first); the overwritten
  range is saved and restored byte-exactly on undress; geometry views sharing the attributes follow.
- **Seating** (found in the sandbox shots): the ring stood at the centre's ground height and a slope hid its uphill
  half; it now sits on the highest of 12 rim samples, capped by the 0.45 m skirt.
- **Pillar 7 test** (`ground-cover.test.ts`): dress → grass inside the ring zero-scaled, the post inside the ring
  degenerate, the one at 20 m untouched, `root.children` and the light list identical; undress → matrices and index
  buffer byte-identical to before.

## T2 — the battle camera frames both battlers above the DOM panel

- `battleFraming(fov, topShare, bottomShare, nearH, farH)` (`camera/battle.ts`, pure): the smallest distance in
  [12, 22] m (0.25 m steps) and the downward tilt that put the near battler's feet and both tops inside the band (2 %
  shake head-room at each edge). Exact in angle space: a tilt of α about the camera's right axis raises every point's
  vertical view angle by α. A view-offset lens shift was rejected: TRAA owns `camera.view` every frame.
- `DioramaRig.setShotInsets(topShare, bottomShare)` (default: the SPEC panel, 28 % + margin = 0.307) and
  `setBattleSubjects(nearM, farM)` (the stage reports the tallest battler per side on every layout); changes during a
  battle ease over 300 ms. The wiring's `setBattleInsets(topPx, bottomPx | null)` converts px (adding the far bar's
  allowance `margin + barLift + barH` at the HUD scale) and sets `hud.setBottomInset`.
- Per frame in a battle shot: `composePose` → **`correctTilt`** (the final camera — after the H11 crown pull-in and a
  cue — is re-tilted until the near feet clear the band, and down again while the tops are above it, as far as the
  feet allow) → a cue's push / orbit / aim is **bisected back** (`CUE_FIT_STEPS` 6) whenever the band's slack goes
  negative (feet, tops, and |NDC x| ≤ 0.72) → the **shake** uses at most the remaining slack / 1.5. At push-in the
  shot first **orbits to a clear yaw** (`CROWN_YAW_STEPS` ±15°…±45°) when the orbit ray enters a crown: in a
  mire_route grove the H11 pull-in alone left the camera 7.6 m from the arena, where both battlers cannot fit.
- HUD: `setBottomInset(cssPx)` lowers the battle bars' floor (`yMax`); bar stacking respects it (M2-battle-6).
- Tests (`battle-framing.test.ts`): solver; pushed-in pose at 1440×900 and 1280×720; every frame of impact /
  attacker / ko cues inside the band with shake on (the pushes are scaled); eased resize; bars above the panel.
- Shots (sandbox, `?zone=mire_route&x=-80.32&z=10.7&demo=battle&ax=-80.32&az=10.7&bg=0&t=12`, with a DOM panel
  stand-in of 28 vh + 24 px): `after-battle-1440-{a,b,c}.png`, `after-battle-1280-{a,b,c}.png`. The harness re-shoot
  is in `.screenshots/audit/M2/`. Before: the committed harness shot `.screenshots/audit/M2/mire_route/
  battle--80.32_4.38-full.png` and the superseded `battle--80.32_10.7-full.png`.

## T3 — wild creatures readable in tall grass

`stage/groundCover.ts` `GroundCoverReveal` is created by the wiring and applies to every billboard of the pool, so
the client's `SpawnViews`, the harness and the sandbox need no wiring. Every 150 ms, the ≤ 16 nearest *shown*
billboards (in the scene, every ancestor visible; an engaged spawn is hidden, so it is not revealed) within 15 m of
the camera focus get a ground-class disc: grass inside 0.55 m drops to 20 % height, back to full by 1.35 m; the
effect is full inside 9 m and fades out by 15 m in 0.1 steps. Slots are stable (8–23), and `ScatterMask.set`
ignores changes < 1 cm, so an idling creature rewrites nothing. Distant creatures keep their grass. Shots:
`t3-reveal0.png` / `t3-reveal1.png` (`?zone=mire_route&x=-80.94&z=11.62&h=1&zoom=0&demo=wild&wild=…&reveal=0|1`).
Test: `ground-cover.test.ts`.

## T4 — two-phase zone compile

What the data said (`?pipes=1` times every `createRenderPipeline(Async)` and names the render object behind it): a
mire_route zone compile is **23 unique render pipelines at 1–5 s of driver time each** (49 s summed, 20 s wall with 4
in flight); every other render object is a pipeline-cache hit. Of the 23, the first view at the spawn needs about 12.
The rest are the warm library quads (slate roof 4.7 s, wet rock 2.9 s, plaster), the beacon housing (2.2 s), a far
set-piece (boardwalk: tall-grass card 4.7 s, glass 2.8 s) and water (2.6 s).

- **Plan** (`compilePlan.ts`, pure): units are the zone root's renderable children and each LOD level. Phase 1 = in
  the predicted view (the rig's heading and zoom at `focus`, §10.7.1 pitch, frustum padded 12 m) or within 28 m of the
  player, at the level that view picks (LOD), scatter tiers ≤ 1, not a `:lod2` chunk mesh; plus the subsystem warm
  objects (billboard, decal, VFX, character) except those flagged `ewaCompileDeferred` (the beacon housing). Queue
  order: a new material key first (every worker starts on a unique pipeline), then nearest first.
- **Engine** (`renderer.ts`): each unit is compiled **in place** by one `compileAsync(unit, camera, scene)`. The Part 4
  facts a–d hold per call (target / MRT held by a refcounted `compileHold`, render-context depth patched in the
  prologue, velocity projection, lights from the scene). Phase 1 runs 4 workers, phase 2 one worker with a
  `scheduler.postTask('background')` slot before each unit. Every zone unit starts on `LAYERS.compileGate` (26), which
  the scene camera (and so the shadow cameras, which copy its mask) never renders; a unit is ungated when its own
  compile finished, so no frame compiles zone geometry synchronously. `loadZone` resolves after phase 1 and opens the
  hero stream then (H5c's retire makes a re-point during phase 2 safe; the tracker confirms 0 extra textures).
- **Cancellation**: the handle's `dispose` is wrapped: the run is cancelled, `onZone(null)` is sent, then the zone is
  disposed. A wrapper around three's `NodeManager.getForRenderAsync` (only `compileAsync` calls it) throws
  `COMPILE_ABORT` before and after the node build of a cancelled run's render object, so three stops before the
  geometry upload, the bindings and the pipeline. Afterwards the unit's meshes get `dispose` again, which releases
  render objects created after the zone's dispose.
- **Persistent objects** (`RendererSubsystems.persistent`): the main arena compiles at boot (its attributes are part
  of the baseline) and first in every zone's phase 2, with the beacon housing.
- API: `loadZone(spec, { focus })`, `compileIdle()`, `RendererOptions.backgroundCompile` (default true; **false by
  default when `trackTimestamp` is set**, so the harness keeps capturing fully compiled zones with no change on its
  side), `CompileProgress.phase` `'boot' | 'zone' | 'background'` counting units.

Measured cold (fresh profile, no shader cache). Machine load varied during the session, so every comparison below is
within one run set:

| | Part 4 path (session start, loaded machine) | single-phase now (`&bg=0`) | two-phase now |
|---|---|---|---|
| mire_route `loadZone` | 26.0 s / 23.8 s (compile 22.4 s span, 23 pipelines) | 11.3 s (compile 9.9 s, 291 units, 26 pipelines) | **6.6 s** (phase 1 5.2 s, 51 units, 12 pipelines) |
| mire_route background phase | — | — | 18.2 s, 240 units; frame gaps p50 33 / p95 50 / max 100 ms, none > 100 ms (after it: p95 50) |
| mirevale `loadZone` | 36.6–52.9 s (Part 4 table) | — | **10.4 s** (phase 1 8.6 s, 71 units); background 15.1 s |
| handover mirevale → mire_route | ≈ 26 s blocking | — | **7.2 s** blocking, 24.2 s until the background ends; frame gaps max 99.7 ms, none > 100 ms |
| first zone frame to GPU idle | 1.8–1.9 s | 0.7 s | 0.8 s |
| `createRenderer` (step 8) | 18.4–18.9 s | 8.2 s | 8.1 s |

An earlier two-phase run on the loaded machine measured mire_route `loadZone` 9.1–10.2 s (phase 1 7.2–7.8 s) and a
background phase of 26.6–40.6 s with 15–80 frames of 100–167 ms. Those gaps coincide with the driver compiling a
pipeline (GPU process) and with node-build chunks of three's `buildAsync` (≈ 30 ms each, profiled). The worst long
tasks (370–750 ms) are the synchronous work right after `loadZone` resolves (the first zone frame, hero uploads), not
the background phase.

**Leaks** (`?track=1`): disposing Mirevale **while its background phase runs**, then two full cycles and a final
unload: geometries, textures, render targets, attributes and attribute bytes **0**, `leaks()` empty. **Programs +2,
constant** (not growing across cycles; the same with the single-phase path). By name they are shadow-pass and
light-set variants that the persistent warm objects keep from the last zone's light set; nothing renders those
objects again until the next zone re-keys them. Part 4 measured 0; see Open.

## T5 — the client's compile progress (client notes part 5)

`World3D` passes `onCompileProgress`; `bootProgress.WorldBoot` gains `compile` and `background`. The overlay shows
"Compiling shaders n / m" and "Preparing Mirevale n / m" as a real bar, comes back for a handover's blocking phase
("Travelling to …") until the new zone's first frame, and `BackgroundCompile` is the small corner pill ("Preparing
distant scenery n / m") while phase 2 runs.

## The occluder fade (audit M2-spawn-noon-9)

`materials/occlusion.ts`: every non-terrain library material gets `maskNode = occlusionKeep(u.occlusion)`. Fragments
within a capsule (full inside 1.2 m, eased out by 1.8 m) around camera → player chest (focus + 0.9 m), at least
1.0 m in front of the player, are dithered away by interleaved gradient noise that keeps 12.5 % (TRAA resolves it),
scaled by `1 − shotBlend`. `pass` is a render-group uniform set per render call: 1 only when `frame.camera` is the
scene camera, so shadow maps and probes keep the occluder; solids get a constant `maskShadowNode` so their shadow
programs do not carry the fade. The host writes the uniforms each frame (`setOcclusion`, zero allocation). Shots:
`occ-spawn-fade0/1.png` (Mirevale (0, 6), rig heading 2 = the SPEC wording's heading 0, a player actor at the focus):
the player hidden by the heart-tree crown → visible through a soft-edged cutaway. Test: `compile-plan.test.ts`.

## Budget and harness findings (B1, B2)

- **B1** `counts()` / `dumpZone()` read the snapshot `frame()` takes at step 6 (three's rAF resets `info` before the
  next frame). `PassTimer` keeps two generations of uid → row and never deletes on `collect`: three's timestamp pool
  returns the previous batch unchanged when no query is pending, so the harness's `gpuFrameMs()` beside `frame()`'s
  own poll resolved the same batch twice, and the second pass found every uid gone → all `opaque` (client H7).
- **B2** the inspector (now always installed; timing only with `trackTimestamp`) counts the draw calls rendered into
  shadow maps (a typed stack over nested renders, zero allocation). `counts()` adds `beautyDrawCalls` /
  `shadowDrawCalls`; `dumpZone().shadowDrawCalls` is the measured value. The draw-call cap is beauty + post
  (`budget.counts.drawCalls` = `drawCalls − shadowDrawCalls`; `budgetRules.ts` reads `beautyDrawCalls`). Mirevale's
  406 / 408 were ≈ 160 beauty + post. Tests: `stats-dispose.test.ts`, asset-audit `rules.test.ts`, client
  `harness-budget.test.ts`.
- **Heading convention**: the rig is kept (heading 0 at the spawn shows the player in front of the heart tree);
  SPEC §50.6.1's words now follow it. The harness's `words` reading (`rig = (h + 2) & 3`) must become the identity
  (harness owner).
- **Type badges** (M2-battle-7): `HudModel.battle.bars[].types` (optional), 3-letter badges at 14 px / weight 800 on
  the type colour (the colourblind table through the stage's `setTypeColors`), ink chosen by luminance;
  `HUD.barW` 240.

## SPEC sync (task 6)

The nine Part 4 entries (P4-C1 … P4-C9) are applied to the part files with one CHANGELOG entry each, plus entries for
T1, T2, T3, T4/T5, the occluder fade, the badges, B1, B2 and the heading convention (18 entries dated 2026-09-30,
newest on top); `.design/SPEC.md` is regenerated with `assemble.mjs`. P4-C1: trees need lod0–lod2 + impostor, other
kinds the tiers they are drawn at (≥ lod0 + lod1); `tools/asset-audit` `scatter.instanced` and its test follow, and
`budget.counts.drawCalls` measures beauty + post.

## Tests (Part 5)

New: `ground-cover.test.ts` (mask, Pillar 7 arena, reveal, cutaway), `battle-framing.test.ts`, `compile-plan.test.ts`
(plan, occluder mask + gate, badges). Extended: `stats-dispose.test.ts` (double resolve, shadow draws),
`camera-rig.test.ts` (insets for the §10.7.4 pose), asset-audit `rules.test.ts`, client `harness-budget.test.ts`.

## Open

1. **Programs +2 after unload** (constant; see T4 Leaks). Likely the persistent warm objects keeping the last zone's
   light-set variants; re-keying the warm group after each unload would close it at a compile cost.
2. **Props between the camera and the ring** (a lamp post in the sandbox shot) stay: only props inside the ring are
   cut, and the occluder fade is off in battle shots.
3. The **harness's `words` heading reading** must follow the amended §50.6.1 (not a render file).
4. GLB character looks compile synchronously on their first appearance (skinning with the look's bone count). Answered
   by Part 6: the KayKit bodies all have 23 joints and the warm-up frame compiles that skinning program.

---

# Part 6 — KayKit 3D characters (2026-10-05)

Scope: the user's decision of 2026-10-05 — "3D people with 2D creatures" — with the KayKit "Adventurers 2.0" free
pack (Kay Lousberg, CC0) instead of the Quaternius mannequins. Creatures stay lit billboards (§10.4). The pixel-art
character runtime of 2026-09-30 (`sprites/characterAtlas.ts`, `sprites/characterAnim.ts`, the instanced card path in
`stage/actors.ts`, `test/characters.test.ts`, `public/characters/`) is deleted; `RendererOptions.charactersUrl` is gone.
The asset side is `tools/model-pipeline` (IMPLEMENTATION-NOTES K1–K8). SPEC: §10.7.6, §10.7.7, §10.5.8, NN 2, §40.2,
§40.6 (CHANGELOG 2026-10-05). Measurement setup as in Parts 4–5 (render sandbox, headless Chrome 154 over CDP, Intel
UHD / Gen-12 iGPU, D3D12, 1280 × 720 shots).

## Layout

| File | What |
|---|---|
| `stage/looks.ts` | `models.manifest.json` v2 mirror (`parseCharacterSet`), `resolveLook` (variant → base look → hash pick), `CharacterSource` (the seam) and the browser `createGltfCharacterSource` (GLTFLoader + MeshoptDecoder + the host's KTX2Loader; manifest, clips and atlas once; each shape / accessory once, on first use) |
| `stage/characterMaterial.ts` | the one `'character'` material and its uniforms |
| `stage/actors.ts` | `CharacterPool`: rigs, bodies, accessories, gait, facing, emotes, decals, shadow casters, LOD, anchors, warm-up |
| `stage/wiring.ts` | builds the pool with `createGltfCharacterSource({ baseUrl: modelsUrl, ktx2 })` |
| `test/actors.test.ts` | 12 tests over a synthetic source shaped like the pipeline output |
| `sandbox/part3.ts` | `?demo=people`: the 24 looks in two rows, creature billboards for scale, walkers / runners; walkers move inside the renderer's frame hook, so `shot()` frames animate |

## Design

**C1 — one material, a tile per actor.** Every body and accessory draws with ONE `MeshStandardNodeMaterial`: albedo =
the atlas sampled at `(tileCell + uv) / (columns, rows)` with `tile = userData.ewaTile`, an OBJECT-scope uniform (the
same mechanism as the DOF `sharp` bit). 24 looks cost no material and no program: the material count of the sandbox
stays 15 from 0 to 48 actors. The atlas is a texture node re-pointed once from a 4 × 4 placeholder to the KTX2 (the
placeholder lives until `dispose`, so no render object can re-initialise a disposed texture — H5c). The KTX2 is BC7
on this GPU with `colorSpace = SRGBColorSpace` (sampled linear), level 0 only, `LinearFilter`.

**C2 — colour.** KayKit swatches are painted for flat renders (skin #f5b993, cloth whites at 0.97); under the noon key
+ sky fill + ACES the first sandbox lineup clipped faces and shirts to near white. `albedoGain` 0.72 (linear) and a
saturation of 1.18 around the luminance bring the characters into the baked world's albedo range with their hues
(checked on close-ups of all 24 looks at noon and dusk). Readability at night (audit M2-gym-dusk-6): an albedo floor
of 0.05 and a warm rim (`pow(1 − |n·v|, 3) × 0.22`) in `emissive` — at noon a few percent, at night the silhouettes,
faces and clothing stay legible between lamp pools (`kk-night-wide`). Roughness 0.8, metalness 0, double-sided
(capes are single sheets), flat normals at harvest level 2, mask MRT x 0 (GTAO applies to 3D bodies) / y `sharp`.

**C3 — bodies.** `SkeletonUtils.clone(template.scene)`: own bones, the template's geometry shared per shape, the pool
material. Clones are recycled per shape on despawn (and accessories per id). The root carries the manifest's one scale
(0.6819); each body has a fixed bounding sphere (model units: centre y 1.1, radius 1.75), so frustum culling works
without per-frame skinned bounds. All KayKit shapes have 23 joints, so one skinning program serves every shape.

**C4 — gait by measured speed.** The protocol moves players at 4.2 m/s (walk input) and 7 m/s (run); a 1.55 m chibi's
walk clip covers 0.55 m/s and its run 2.30 m/s at time scale 1 (the pipeline's planted-toe measurement × scale). So
the gait follows the measured ground speed, not the flags: speed = smoothed displacement / dt (τ 0.1 s; a jump > 3 m
in one update measures nothing), stand below 0.25 m/s, walk → run blended between 1.1 and 1.7 m/s, and each clip
plays at `speed / natural speed` (walk ≤ × 3.2, run ≤ × 4; at 4.2 m/s the run clip plays × 1.83, at 7 m/s × 3.04).
Measured in the sandbox (`march`, 4 actors, 150 frames, a toe counts as planted within 2 cm of its lowest point):
mean planted-toe velocity along the walk −0.04 m/s at 0.7 m/s and −0.06 m/s at 1.0 m/s (the foot stays put; the
unsigned mean of 0.26 m/s is toe roll that cancels), 0.12 m/s at 4.2 and 0.13 m/s at 7 m/s (2–3 % of the body
speed). Inside the 1.1–1.7 m/s blend the two cycles mix and slide (0.49 m/s at 1.4 m/s); actors rarely sit there.
A `moving` actor that does not move stands. Each actor starts its cycles at a hash phase (a crowd does not march in
step).

**C5 — facing.** The displayed yaw turns toward the heading at 14 / s along the shortest arc (3.0 → −3.0 rad goes
through ±π); the first transform snaps.

**C6 — emotes.** KayKit ships no wave and nothing downcast. wave = procedural (after the mixer: the right upper arm
aimed up and out, the forearm swinging ±0.42 rad at 2.2 Hz, by world-space aim, so no bone axis is assumed); sad =
procedural bow (head 0.42 rad, chest 0.16 rad about the actor's right axis); happy and heart = `cheer` (a hop,
looping for the 2 s); alert = `flinch`; cool = `use`. Clip emotes take weight from the gait (base = 1 − emote weight,
so the weights always sum to 1 — below 1 the bind T-pose bleeds in, which the first procedural wave showed);
procedural ones keep the full gait under them. Emotes play while standing and yield to walking.

**C7 — accessories.** A clone of the accessory's mesh node (its quantization transform) with the manifest's slot
rotation baked in (`T(R·p)·R·S`, no extra node), parented to the hand-slot joint, `castShadow` false, its own
`userData` (the look's or the source texture's tile, the actor's `sharp`). The slot rotations were measured in the
sandbox (idle: right slot +X down, left slot +X up, +Y forward along the forearm): mugs stand upright in the right
hand, books and shields hang upright in the left with their face outward.

**C8 — shadows and LOD.** After the per-actor update the pool sorts its 48 slots by camera distance (insertion sort,
no allocation) and lets the nearest 12 bodies within 45 m cast; accessories never cast. Accessories hide beyond 45 m;
bodies are hidden (and their mixers skipped) beyond 140 m. At the diorama distances (camera 20 / 26 / 34 m from the
player) every visible actor of a busy frame is within 45 m.

**C9 — grounding and anchors.** Feet on the collider; one instanced contact decal (the §10.4.7 material, 0.85 m, on
the collider normal, 1 cm up) for every actor: one draw. The nameplate / emote anchor is the head joint's world
position raised to the look's top (`heightM − headRestY × scale`, + 0.18 m), so plates follow a hop or a bow and sit
above helmets and the straw hat.

**C10 — loading and warm-up.** Until its shape arrives an actor shows its decal and nameplate (one request per shape
per renderer). The warm-up frame (§10.1.2 step 8) renders a 23-bone `SkinnedMesh` with the shipped attribute formats
(int16-normalised position and normal, uint16-normalised UV, uint8 joints, uint8-normalised weights) and a rigid
accessory, both on the character material and casting shadows, so the skinned and rigid programs exist before the
first character.

## Measured

Sandbox diorama, noon, `?demo=people` (`window.__ewaSandbox.counts()` after 40 settled frames):

| | beauty draws | shadow draws | programs | materials | bodies / shadow casters / accessories shown |
|---|---|---|---|---|---|
| 0 actors | 73 | 112 | 112 | 15 | 0 / 0 / 0 |
| 24 actors (every look) | 110 | 158 | 114 | 15 | 24 / 12 / 12 |
| 48 actors | 146 | 161 | 114 | 15 | 48 / 12 / 24 |

Per actor: 1 beauty draw + 1 per shown accessory; shadows are capped by the 12 casters (+ 46 at 24 actors, + 3 more
at 48). The decal is 1 draw for all. Programs: +2 over the warm-up when the first real bodies draw.

Client harness re-shoot (`harness:shots -- --set M2`, 1440 × 900; `.screenshots/audit/M2/{mirevale,mire_route}/`) and
a short budget probe (`harness:budget -- --frames 60 --warmup 30 --no-diff --report-only`, a fresh session per zone):

| Shot | beauty draws (HEAD → now) | shadow draws | materials | programs, shots run (HEAD → now) | programs, budget probe | player mask coverage (HEAD → now) |
|---|---|---|---|---|---|---|
| mirevale spawn-noon | 109 → 110 | 247 → 247 | 18 | 101 → 107 | 107 | 0.667 → 0.495 |
| mirevale gym-dusk | 106 → 107 | 288 → 288 | 18 | 128 → 139 | 107 | 0.749 → 0.559 |
| mirevale lamps-night | 124 → 125 | 271 → 267 | 18 | 128 → 139 | 107 | 0.749 → 0.561 |
| mirevale link-east | 74 → 74 | 77 → 77 | 18 | 128 → 139 | 107 | 0.754 → 0.560 |
| mire_route sprite-edge | 80 → 80 | 92 → 86 | 13 | 103 → 111 | 111 | 0.584 → 0.523 |
| mire_route battle (6 spectators) | 114 → 116 | 201 → 199 | 13 | 122 → 137 | 111 | 0.710 → 0.609 |

Draw calls and materials are unchanged within ±2 (the scenes hold 1–7 characters). The player's mask coverage is
measured on the harness's player cylinder (now 0.4 × 1.6 m for the chibi; a wide head over narrow legs fills less of
it) and stays above the 0.45 check. Programs: the shots run keeps every post variant it built (reduced, mask) alive,
so it climbs with the session (audit M2-gym-dusk-8: HEAD already read 128 there); the character material adds its
skinned / rigid beauty and shadow programs per light set on top. A fresh session at the same positions reads 107
(Mirevale) and 111 (Mire Route, the battle included), inside the 128 cap.

Spectators: a battle's six `spectator_<seed>_<i>` ids resolve to deterministic base looks. Plain FNV-1a (`hash01`)
barely moves its high bits when only the last character changes, so the first re-shoot had six ninjas around the
arena; `pickHash` adds a murmur3 finaliser (re-shot: a mixed crowd).

## Tests

`test/actors.test.ts` (new, 12): manifest v2 parsing; look resolution; no source → decals only; shared geometry per
shape, own skeleton, the one material, the per-actor tile, one load per shape, scale; accessories on the joint with
their tile; gait by measured speed with foot-matched time scales, flags alone stand; shortest-arc facing; emotes
(clip, yield, timeout); nearest-12 shadow casters, accessory LOD and culling; recycling; anchors; exact dispose; the
warm-up body. Removed: `test/characters.test.ts` (the pixel path). Render total: 22 files + this one.

## Open

1. **Programs over 128 in the harness's history-dependent runs** (see the table below): the full-effects shots after
   a dusk / night light set read 139, 11 over HEAD's 128, which already sat on the cap because every post variant
   built earlier in the session stays resident (audit M2-gym-dusk-8). The character material adds its skinned and
   rigid programs per light set; a fresh boot at noon reads 107 (cap 128).
2. **Wave / bow are procedural** over the idle (KayKit's free tier has no such clips); a paid KayKit animation pack or
   an authored clip would replace them through `EMOTE_CLIPS` without code changes.
3. The DOF gather noise reads as a fine speckle on out-of-focus faces in the 4 m inspector close-ups (Part 4 Open 6);
   the diorama distances do not show it.


---

# Part 7 — the evolution sequence (2026-10-05)

Scope: the user-approved evolution moment — stage it with the inspector camera, a white glow pulsing between the old
and new silhouettes with rising sparkles and a soft light under it, a light burst and the new form's bounce; flashing
≤ 3 per second at every moment (WCAG 2.3.1), a cross-fade under effective reduced effects, skip; played only after the
server confirmed the evolution (client Part 6). SPEC: §10.4.5, §10.7.5 (+ its VFX table) — CHANGELOG 2026-10-05.

## Layout

| File | What |
|---|---|
| `stage/evolution.ts` | `EVOLUTION` numbers, the two timelines (`EVOLUTION_TIMELINE`), the pure `sampleEvolution(t, reduced, out)` (what is shown, glow, dissolve, light, dim, pulse Hz), `alternationHz`, `spotScore`, the sequence effects (`evolutionRecipes`), the runtime `EvolutionSequence` (implements the contract's `EvolutionHandle`) |
| `stage/battleStage.ts` | `evolve(request)`, `evolution` (the running sequence), the site (`evolutionSite`: main-arena ground-cover slots 0/1 + cutaway slot 0), `armWarmupShadows`; `dress` / `inspect` / `dispose` / a second `evolve` cancel; the frame hook runs the sequence after the beacon writes |
| `sprites/billboard.ts`, `tables.ts` | the per-object `glow` (`BILLBOARD.glowGain` 1.3), `setGlow`, `setShown`, `setSizeMul`, `widthM` |
| `stage/vfx.ts` | `spawnRecipe` (any recipe into the pooled emitters), `SequenceVfxRecipe` |
| `camera/rig.ts` | `inspect(aim, ms, distance?)`, `dollyShot(distance, ms)` (eases the shot distance; the battle framing's ease now has its own duration field), `shotDistance` |
| `contracts.ts`, `defaults.ts`, `index.ts` | `BattleStage.evolve`, `EvolutionRequest`, `EvolutionHandle`, `EvolutionPhase` (SPEC verbatim); `NullBattleStage.evolve` |
| `stage/wiring.ts` | the stage gets the post uniforms (`exposure`, `vignette`); the warm-up arms the beacons' shadow maps |
| `sandbox/part3.ts`, `main.ts` | `?demo=evolve&from=&to=&reduced=&wild=`; `part3.evo.{play, skip, step, state, idle}`; `__ewaSandbox.pause(on)` for deterministic frame stepping |
| `test/evolution.test.ts` | 9 tests (below) |

## Design

**E1 — timeline** (ms; reduced in brackets): `stage` 0–1100 (same) · `charge` 1100–2000 · `alternate` 2000–5600 ·
`peak` 5600–6100 [`fade` 1100–3700] · `reveal` 6100–7000 [3700–4600] · `hold` 7000–8800 [4600–6400] · `exit`
8800–9500 [6400–7100]. Total 9.5 s [7.1 s]. `skip()` before the reveal jumps to it (the skipped phases' one-shot events
never run; the build-up's motes are cleared and the burst spawns), during the reveal / hold to the exit. The clock is
real time (the hook's `dtReal`), so a hitstop or slow-mo left over from a battle never stretches it.

**E2 — the silhouettes.** Both forms are billboards from the shared pool at the same feet. `glow` mixes the lit
albedo to white and adds `glow × 1.3` white emissive: a glowing white silhouette of the card's own binary alpha at any
time of day (the hurt flash mixes only 85 % into the LIT albedo, grey at dusk). A swap is `setShown` (group visibility):
no material, program or binding change. Alternation: `showNew = frac(cycles(τ)) ≥ 0.5` with `cycles` the integral of a
linear 0.7 → 2.4 Hz ramp (5.9 cycles, 12 swaps); each incoming silhouette pops from 0.88 × to full size over 110 ms
(`setSizeMul`, ease-out). The peak holds the new silhouette still for 500 ms, which keeps the burst out of the
alternation's last second.

**E3 — WCAG 2.3.1.** Measured on the pure timeline at 1 ms: max 2.4 Hz; at most 5 swaps in any one-second window
(≥ 214 ms apart); the luminance proxy (glow × area of the shown silhouette, the new one 1.6 × larger, + 0.25 × light)
has ≤ 6 opposing changes of ≥ 10 % of its range in every 1 s window, burst included (≤ 3 flashes). Reduced: no swap
(each form shown over one span), the light never above its charge level, no pair of opposing changes in any second.

**E4 — staging.** Placement: 9 candidate spots in front of the trainer (toward the camera) and to the side by at
least half the wider card + 0.3 m (a 2.2 m-wide Briarbear hid its trainer at 0.6 m); the first scoring 0 wins
(`spotScore`: not standable +100, a footprint under it +40 / within 0.45 m +10 each, every footprint sample on the
3.5 m ground line toward the camera +2 — the collider's `blocked` / `passable`). Camera: the §10.7.4 inspector pose
(pitch −18°) via `rig.inspect(aim, 1100, max(4, 2.6 × taller height, the creature + trainer span / (0.8 × the frame
width at 1 m)))`, aimed at 0.45 × the taller height and at the middle of the span from the creature's far edge to the
trainer's outer edge (both in frame — a fixed 25 % shift put the trainer at the frame edge once the spot moved further
out); a 0.6 m dolly-in over the build-up, a 0.4 m pull-back past the start at the reveal (the whole new form, room for
the client's bottom banner); H11 crown avoidance applies as for any shot. The site (450 ms in, restored halfway
through the exit): grass inside 1.3 m (back by 2.3 m) and small props inside 1.6 m via the main arena's ground-cover
slots 0/1, merged static props within 1.9 m of a point 1 m toward the camera via the cutaway's slot 0 (first runs put
a market stall's post across the creature). A main arena still sinking after a battle is finished at once.

**E5 — light and dim.** The soft underlight is the reserved arena beacon 0 (from `createRenderer`, so the light set
never changes, C13): a warm (1, 0.92, 0.78) spot 1.15 m toward the camera, 0.2 m up, aimed at mid-height, angle 0.6,
penumbra 0.9, range 9 m, decay 2, intensity 7 × the phase level (stage 0.45 → charge 0.7 → peak 1.15 → burst 2.4 with a
70 ms rise and a 220 ms decay → hold 0.55 → 0). Its shadow camera renders `LAYERS.billboards` only while borrowed. The
world dims by the post uniforms the stage now receives: `exposure` × 0.74 and `vignette` 0.22 → 0.55, back over the
reveal (no new pass; the creature's glow is emissive, so it stays bright).

**E6 — no program at sequence time.** First sandbox runs listed 4 new programs (v + f `ShadowMaterial`, v + f
`ewa:billboard:a-000`) on the sequence's first frame. Root cause (read in `WGSLNodeBuilder.isUnfilterable`): three
0.186 compiles a texture whose min AND mag filters are Nearest as unfilterable (`textureLoad`), and the warm-up
billboard's 4 × 4 neutral set had exactly that, so the step-8 warm-up compiled a billboard program (beauty + sun shadow)
that no atlas uses (Nearest mag, trilinear min); the first atlas billboard drawn — a wild creature in play, or the
evolution in a zone without wild creatures — compiled the real one. `neutralAtlasTextures` now uses a linear min filter
(one level, nothing visible changes): boot programs 111 → 107, and with NO creature on screen before it the sequence
compiles **0 programs** (measured, `&wild=0`). Two more guards: `Stage.armWarmupShadows` (called by the wiring's warm-up
objects) makes both beacons render their shadow maps over the warm group during the two step-8 frames
(`shadow.autoUpdate` held true for `STAGE.warmShadowFrames` 2 frames, aimed from (0, 4, 4)), which also readies a
battle's beacon shadows; and while borrowed, only billboards render into beacon 0's map. Render targets 36 → 36.

**E7 — atlases.** Both billboards are acquired at the start (a billboard whose atlas is still binding stays hidden and
is re-pointed when the bind lands, §10.4.2). The stage holds 1 ms before its end until both are bound (at most 8 s);
past that, with the new form unbound, the sequence goes straight to the reveal. The client binds the new species when
the evolve prompt opens and again at the start.

**E8 — cleanup** (done or cancelled): both billboards disposed (pool live count and atlas refcounts back), beacon 0's
position, target, colour, intensity, angle, penumbra, distance, decay, `shadow.autoUpdate` and shadow-camera layer mask
restored, post exposure / vignette restored, the site restored; on cancel the VFX pool is cleared and the camera
released unless a battle's push-in owns it (`dress` comes after `pushIn` in `SceneDirector.enterBattle`). The trainer
cheers (`setEmote(id, 2)`, the `cheer` clip) 150 ms into the reveal when within 6 m; the new form plays `celebrate`
(640 ms) 420 ms in. Per frame: scalar writes on preallocated objects; the phase callback runs once per phase.

**E9 — sequence effects** (`evolutionRecipes(type, reduced)`, recipes outside the 47 `VfxId`s, spawned through
`spawnRecipe` into the same pooled emitters and material): `evolve_motes` (rising cream stars + type-coloured soft
discs from charge to peak), `evolve_converge` (stars drawn into the chest at the peak), `evolve_burst` (a soft flare
disc, a white / gold star burst at 6.5 m/s, two ring cards 1.2 → 2.4 m, rising type-coloured stars); reduced: slower
motes and `evolve_reveal` (rising stars only). Tuned on the frames: pixel-square motes read as dust (now discs and
stars), a 3 m flare + 5 m rings washed the whole frame white (now 2.4 m / 2.4 m at lower intensity), the glow's linear
fade left the creature white until the reveal's end (now ease-out over 560 ms after a 120 ms hold).

## Measured

Sandbox (`?zone=mirevale&x=2&z=8&demo=evolve`, bramblecub → briarbear, headless Chrome 154 over CDP, Intel Gen-12 iGPU,
1280 × 720, the loop paused and `frame(16.67)` stepped by hand, a screenshot every 150 ms; frames under the session's
scratchpad, see the client notes for the in-client run):

| | idle (diorama) | stage | alternate | reveal | hold | after |
|---|---|---|---|---|---|---|
| beauty + post draws | 128 | 146 | 146 | 148 | 145 | 128 |
| shadow draws | 263 | 206 | 204 | 203 | 204 | 263 |
| programs / render targets | 111 / 36 | 109 / 36 | 109 / 36 | 109 / 36 | 109 / 36 | 109 / 36 |

(the program count drops by 2 when three releases unused programs; nothing is added; these runs predate the E6 neutral
fix, after which the same run reads 107 → 105). After `done`: live billboards
1 (the wild creature) as before, exposure 1, vignette 0.22, beacon intensity 0, rig `diorama`, blend 0. Day (11:00),
night (21:30), reduced and skip runs were captured; at night the white silhouettes, the burst halo and the underlit new
form read strongly.

## Tests

`test/evolution.test.ts` (9): the two timelines (spans, totals 9.5 / 7.1 s, boundaries); WCAG (≤ 3 Hz at every
millisecond, swaps ≥ 1/6 s apart, ≤ 6 swaps and ≤ 6 opposing luminance changes per 1 s window, the peak holds the new
silhouette); reduced (one span per form, no spike, glow ≤ 0.35, ≤ 1 change per second, no burst / ring recipes);
spot scoring; the runtime on a real `Stage` (phases in order and on time to one frame, dim / light / site / cheer /
glow seen, the shake requested only on the full path, then exact restore of the beacon light snapshot, post uniforms,
mask and cutaway slots, pool live count, atlas refcounts, rig mode and camera position < 1e-6 m); the atlas gate (holds
until the bind, then charges; never bound → reveal); skip (→ reveal without the skipped phases' events, → exit);
reduced runtime (both forms dithered at once, no shake, light ≤ charge level); `dress` cancels (the battle keeps the
camera, nothing borrowed stays), a second `evolve` cancels the first. Render total: 24 files, 233 tests.

## Open

1. **The spot-shadow pass of other materials** (props, trees in the beacon's cone) is still compiled on a battle's
   first beacon-shadow frame for materials the warm group does not hold (instanced scatter); the evolution avoids it by
   rendering billboards only. Not measured for battles here.
2. **Placement uses footprints only**: a building corner or a tree crown between the camera and the spot is not part of
   the score (the camera's crown pull-in still applies). A wall right behind the trainer can fill the background.
3. The atlas billboard's programs used to compile on the first creature drawn in every session (E6, fixed by the
   filterable neutral set); a fresh-profile harness re-run would show it as fewer programs and no first-creature hitch
   (the M2 budget JSONs were not re-captured here).

---

# Part 8 — flipbooks: the animated legendaries (2026-10-06)

Scope: the 10 legendaries / mythicals animated in the original game (GIF / animated WebP) and were frozen on their
frame-select page. The sprite pipeline now ships every page of each side as a flipbook (40-pipelines.md §40.1.8:
512² cells, one atlas per side, the static frame's normalisation); render plays it. SPEC: §10.4.1, §10.4.2, §10.4.5,
§10.4.6 — CHANGELOG 2026-10-06.

## Layout

| File | What |
|---|---|
| `contracts.ts` | `SpriteFrame.anim?: SpriteAnim` (`atlas`, `rects` per page, `delaysMs`, `staticFrame`) |
| `sprites/atlas.ts` | `AnimAtlasSet` (non-square grid, `width`/`height`/`cell`), `loadAnimAtlasTextures`, `chainBytesWH`, `animAtlasSetBytes` |
| `sprites/tables.ts` | `flipbookTotalMs`, `flipbookFrame(delays, total, t)` (pure, allocation-free, O(pages)), `flipbookPhase01(id)`, `BILLBOARD.dissolveCellsPerFrame` 512 |
| `sprites/billboard.ts` | `SpritePool.bindAnimAtlas`; `resolve()` prefers a bound flipbook; `CreatureBillboard` flipbook clock, page writes, faint hold, `animated` / `animFrame` / `animPaused`; per-object `dissolveCells` |
| `stage/battleStage.ts` | `sameFrame` also compares the flipbook atlas |
| `sandbox/part3.ts` | `?demo=legends` (`&species=`, `&side=back`, `&anim=0`), `?demo=battle&mine=&foe=`; the sandbox adapter maps `anim` like the client's |
| `test/flipbook.test.ts` | 9 tests (below) |

## Design

**F1 — one write per page.** A flipbook is an ordinary atlas material of the one billboard graph (`createBillboardMaterial`
on the anim atlas's textures): the per-object `rect` the static frame uses is the only thing a page changes. The
billboard's `update(dt)` (the pool's per-frame hook, `dt × timeScale`) advances a flipbook clock unless held, adds a per-id
phase (`flipbookPhase01(id) × loop`, FNV salted apart from the bob phase) and writes `rect` only when
`flipbookFrame` returns a new page — four scalars on a preallocated `Vector4`. No program, material, texture or draw call
changes while a flipbook plays; every page of a side lives in its one atlas.

**F2 — static frame first, one re-point.** `resolve(frame)` returns the flipbook material when `frame.anim.atlas` is
bound; otherwise the static path as before, and a ready static side registers a wait on the anim atlas id so the bind
landing re-points it once (`resolveWaiting` → `rebind`). The static rect is the frame-select page normalised identically
(the pipeline's shared transform), so the swap shows no jump (measured below). A descriptor without `anim` never waits.

**F3 — faint holds the page.** `animPaused` = the `faint` pose, or a `setFaint(p > 0)` not yet cleared by a pose or
`setFaint(0)` (the timeline's resync path and the evolution sequence's dissolves use `setFaint`). Hitstop needs no flag:
the pool is driven with `dt × timeScale`. Hurt flash, poses, `enter`/`exit` dissolves keep playing the flipbook.

**F4 — dissolve holes per cell.** The hole hash was `floor(uvRect × 1024)` in atlas uv — 2 texels (1/512 of the cell) on a
2048² static atlas but 3 × 2 texels (6/512 × 4/512 of the cell) on a 3072 × 2048 anim atlas. It now reads a per-object
`dissolveCells` (vec2): 1024 on static atlases and singles (unchanged), `512 / rect size` on a flipbook (1 anim texel =
1/512 of the cell). One more `userData` read in the one program; the program count is unchanged (below).

## Measured (sandbox, headless Chrome 154 over CDP, WebGPU, Intel Gen-12, 1280 × 720, loop paused, `frame(16.67)` stepped)

| Run | flipbooks off (`&anim=0`) | flipbooks on |
|---|---|---|
| `?demo=legends` (10 species, 2 rows) — draw calls (beauty + shadow) | 235 (87 + 148) | 235 (87 + 148) |
| — programs / materials | 110 / 15 | 110 / 15 |
| — sprite atlas cache (estimate) / three `texturesSize` | 468 MB / 1 034 MB | 1 529 MB / 2 808 MB |
| `?demo=battle&mine=zenryu&foe=raikitsune` — draw calls | 359 (94 + 265) | 359 (94 + 265) |
| — programs | 114 | 114 |

The billboard program has the same WGSL (vertex `7be5d308`, fragment `8e09143a` by FNV of the cache key) on a static and
an anim atlas material; the only difference in the program list is which material compiled it first (its name). A
character-skinning vertex variant differs between any two runs, flipbooks or not. An earlier battle run read 112 / 114:
compile timing, not repeatable.

- Binding the 10 species' static atlases + 20 flipbooks: 2.9 s warm. GPU per side by the cache estimate: 50 MB
  (3072 × 2048), 52 MB (2560²), 75 MB (3072²); three's `texturesSize` counts more (≈ 89 MB a side): 20 sides bound at
  once is 1.8 GB by its count, over the §50.2.2 700 MB cap — the lineup binds every legendary at once, play does not.
- Pages advance on the source delays: 125 ms pages change after 7–8 frames at 60 fps (`[0×6, 1×8, 2×…]` from page 0).
- Static ↔ flipbook alignment in the 4 m inspector (raikitsune front, `&anim=0` vs the flipbook stepped to page 0, same
  camera): same silhouette, position, size and foot line; only the texel size doubles (512 vs 1024 cell under Nearest).
- No TRAA ghost at page changes: a Laplacian sharpness measure over the creature is flat within a page (18.0–18.2,
  16.3–16.5, 15.6–15.8 for pages 0 / 1 / 2) and steps only with the content; the first frame of a page is not softer.
- Feet: across pages the paws stay on the same pixels while the body animates (no slide, no jitter).
- Battle: the player's zenryu plays its back flipbook, the foe raikitsune its front; `stage.faint(foe)` holds the foe on
  page 21 while its dissolve runs 0 → 1 and the player's advances 1 → 8; `enter` resumes it.
- Client harness (`/harness/shots?zone=galvan_route`, the real SpawnViews / BattleController; client notes Part 7):
  raikitsune as a wild spawn plays its front flipbook (pages 20 → 23 → 0 → 1 over 6 × 133 ms), then as the battle foe;
  programs 103 (boot) → 103 with the flipbook → 101 in battle.

Frame sequences: `.screenshots/anim-legends/` in the worktree (gitignored): `legends/lineup-00..05.png` +
`lineup-strip.png`, `inspect/raikitsune-00..05.png`, `align/raikitsune-static.png` / `raikitsune-anim-p0.png` /
`pair.png` / `raikitsune-f00..17.png` (1-frame steps) / `frames-strip.png` / `feet-strip.png`,
`battle/zenryu-vs-raikitsune-*.png` + `battle-grid.png`, `harness/galvan_route-raikitsune-{wild,battle}-*.png` +
`harness-grid.png`.

## Tests

`test/flipbook.test.ts` (9): timing from the delays incl. per-page delays, loop, negative / degenerate time; the phase
(deterministic, spread over the pages); the static frame until the anim atlas lands then one re-point, one material per
anim atlas shared by two creatures, `dissolveCells` 3072 × 2048 per uv; 600 frames at 60 fps — every page equals
`flipbookFrame(t + phase)`, all 24 pages seen, 79–81 rect writes over 10 s (one per page change), never a material
switch, two ids out of step; faint pose / `setFaint` hold, `enter` / `setFaint(0)` resume, hitstop (`dt 0`) holds, hurt
keeps playing; `setFacing` to a side whose flipbook is not bound shows its static rect, then re-points; a still creature
never animates; 20 flipbooks × 3000 frames grow the heap ≤ 64 KB between forced GCs; the anim atlas texture contract
(4 levels, Nearest mag, trilinear min, no generated mips, half-res normal, byte estimate). Render total: 25 files, 243
tests.

## Open

1. **GPU memory.** A flipbook side costs 1.5–2.4 static atlases of GPU memory; the client binds both sides with the static
   atlas and (pre-existing) never releases an atlas, so a session that meets many legendaries — or a party of several —
   accumulates 100–150 MB per species. Follow-up: bind the side being shown and release flipbooks no billboard uses
   (the `AtlasCache` already disposes at refs = users = 0).
2. **Inspector magnification**: at 4 m the flipbook's 512 cell is magnified ≈ 2× the static cell's texels (Nearest, hard
   texels); a 1024 flipbook would cost ≈ 4× the bytes.
3. The sandbox lineup binds all 10 legendaries at once and trips the `texturesSize` cap; it is a stress view, not play.

---

# Phase A interiors (2026-10-06)

Content places one **pocket** per town building (a roofless walled hall in the zone's own outer band, reached by door
warps; `@ewa/content` `interiors.ts`). Render draws it from `ZoneSpec.interiors` (`InteriorSpec[]`, contracts.ts) and
exposes `ZoneHandle.interiors` (`InteriorsHandle`).

## Layout

- `zone/generators/interiors.ts` — `buildInterior(spec, deps)`: the per-pocket group, the theme kits
  (`themeKit`, `interiorSurfaces`), props / internal walls / gates / switches by kind, the canopy and rim.
- `zone/interiors.ts` — `InteriorSystem` (the `InteriorsHandle`): visibility, wall drops, gate / switch eases.
- `zone/layout.ts` — `PocketRect`, `pocketRects`, `inPocket`; `createSplatContext(…, interiors)`; `splatAt` paves.
- `zone/builder.ts` — step 6b (pockets after the static props, before scatter; their geometries are recorded in that
  order, so the 9 town digests changed), scatter rejection, `warpRooms` skips arrivals inside a pocket,
  `zoneSurfaces` adds the pockets' surfaces (+ the doorway surface when the zone has buildings), the canopy LODs join
  the building LOD list, `updateLod` steps the interior eases, and `scatterInstances()` (tests / audit).
- `generators/buildings.ts` — doors stand open: a dark doorway (`DOORWAY_SURFACE` = `lantern_metal`, a shared
  surface) 1.3 m deep with dark reveals, the leaf (both leaves of a gym arch) swung 100° in; lod1's door slab is dark.
- `camera/rig.ts` — `setYawBase(deg | null)` (eases like a heading turn; the heading index is kept), `yawBaseDeg`,
  `headingYaw(h, baseDeg = YAW_BASE)` (additive optional parameter). `defaults.ts` — `BasicDioramaRig.setYawBase` and a
  `dioramaYaw` getter; `NullBattleStage.dress` takes the 4th parameter.
- `stage/battleStage.ts` — `dress(at, terrain, participants, hall?)`, `fitCentre`, `inHall`, `trainerSpot(side, out)`,
  `hallBounds`, the `STAGE` hall numbers.

## Design / deviations

1. **One group per pocket** `ewa:interior:<id>` at the local origin (`rotation.y = yaw` reproduces content's
   `toWorld`, y = `floorY`): `:hall` (hidden until `setActive`), `:canopy` (a `THREE.LOD`, hidden while active),
   `:rim` (always shown). Hall children: `:wall:back|front|left|right` (each its own mesh, origin on the floor, so
   `setView` is a `scale.y` to 0.5 / 2.4), `:floor` (slab top 3 cm over `floorY`, border, runner, an inlaid ring at
   each room arena — it hides under the battle ring's curb), `:static` (inner walls + tall props, casting),
   `:dressing` (small props + switch bases, no shadow), `:water` (channels, the library water graph's `depthBelow`),
   `:gate:<id>` holders, `:switch:<id>` holders (`:pivot` → `:moving`, `:glow`).
2. **Floor paving.** `splatAt`'s plaza field is positive inside floor + wall (crisp edge), so the terrain under a hall
   is the zone's plaza stone; the per-theme look comes from the hall's own floor slab (the terrain has only 4 layers
   per zone). The arena ring is seated on `floorY` (collider), 3 cm under the slab top — the ring top (6 cm) still
   sits proud of it.
3. **Themes** use only the theme biome's row + the shared row (gym themes: that biome's generator set; league: the
   capital set; shop / healer / house: the zone's own set). Gym theme = the town's biome in every town, so a zone binds
   almost nothing new (Mirevale stays ≤ 32 materials; sandbox programs 105 with or without pockets at the same view).
   No per-pocket material: switch "on" glows and lava are library emissive surfaces shown by `visible`; gates /
   switches / walls move by transform. Every live call is transform / visibility only (tested).
4. **Furniture solids.** Content lists solid furniture twice (a `wall` / `counter` rect and a prop). A rect holding
   exactly one prop at its centre draws nothing (the prop draws it, sized to the rect); a rect holding several props
   (shop shelves, healer cabinets) gets a low back counter under them; an empty `wall` rect is a 2 m partition.
5. **Gates**: hedge / boulder slide aside along their long axis toward the hall's centre line (into the wall beside
   them; boulders roll), the rest sink into the floor; fully open = hidden. Gates and switch moving parts cast no
   shadow (draw budget). **Switches** face the hall's centre line when beside a side wall, else the door.
6. **Canopy** (outside view): a knoll mesh over the whole footprint (smooth grid, the zone's ground layer, blending
   into the terrain at the footprint edge, 2.7 m over the floor inside the walls), crowned with the zone's first leafy
   tree kind every ~3.6 m and packed with bushes of the same leaf surface (no extra draw); barren biomes (cinder,
   marrow, shrine, rift: dead trees only) get a crag of big stones. Three LOD tiers (0 / 40 / 90 m like buildings);
   crowns cast at lod0 only, the knoll never. The rim (bushes or stones 1 m outside the walls in the screen band)
   stays when inside, so the hall reads as a clearing. Canopy trees register no crowns on the collider (the
   battle-camera crown avoidance would also fire inside the active hall).
7. **Scatter**: no instance of any kind whose centre lies inside a pocket's outer footprint (content's drop rule,
   `inFootprint`, no padding — trees / willows / rocks also skip their collider footprint). Hand-placed props and
   lights are avoided by content's placement.
8. **Collider**: the 4 outer walls and every solid internal wall (not channel / chasm) are registered with
   `addFootprint` (+ capsule radius), like buildings; walkability is the heightfield's. Gates are client blockers.
9. **Battle in a hall**: with `hall`, the ring centre is pulled in (per hall axis, the interval that keeps the ring +
   curb and both trainer slots ±4.45 m along the battle axis on the floor; an axis too short takes the middle), the
   rope posts shrink to ≥ 0.92 of their radius or the ones still outside hide (with the ropes), each pylon walks in
   along its bearing to ≥ 4.05 m or hides (its light stays at the pulled position), spectators step in to ≥ 4.9 m or
   are not spawned. All transforms / visibility; an open-ground `dress` restores the full dressing. The stage reads
   `rig.dioramaYaw`, so with `setYawBase(hall axis)` the battle axis runs along the hall (tested). Ground-cover
   masking is unchanged (masks are still written at the centre; a paved floor simply has no scatter under it).
   `trainerSpot(side, out)` gives the trainer positions on the (possibly pulled-in) centre — the client stages
   trainers from its own battle frame; if the centre moved they should read `trainerSpot` / `arenaCenter`. For every
   shipped hall arena the centre does not move (gym chamber 20 × 15, league chambers 20 × 14).
10. **Draw budget**: a first cut cost ~130 draws in the gym (410 > cap 400 in the sandbox); walls became
    single-surface (coping / plinth / pilasters in the wall surface), small dressing / gates / switch parts / rim
    stopped casting: the Mirevale gym interior view now reads 323 draws (caps ok). The `?demo=battle` scene is over
    the 400 cap with or without pockets (476 on open ground → 515 in the gym hall, same arena position).

## Sandbox

`?zone=mirevale&interior=mirevale.gym` (setActive + setYawBase(hall axis) + setView, focus on the floor centre;
`&at=arena` focuses the first room's arena, `&open=1` opens every gate, `&on=1` throws every switch);
`&demo=battle&interior=…&at=arena` dresses the battle at that arena with the room's `HallBounds`;
`&interiors=0` builds the zone without pockets (A/B). The sandbox's specs come from the client adapter
(`zoneSpecFor`), which already fills `interiors` (`interiorSpecsFor`).

## Tests

`test/interiors.test.ts` (10): every pocket of the 9 towns builds (4 walls, inner solids = spec walls, gates,
switches with hidden glows, canopy LOD 3, rim, footprints; all 12 themes); live controls change no geometry /
material / graph; a shown + rendered hall unloads to the mock-GPU baseline; 0 scatter centred in a footprint and
paved floors (mirevale, cinderhold, saltmourn); `dress(…, hall)` at every hall arena × 4 headings keeps ring, trainer
slots, visible posts / pylons, spectators on the floor, a too-small hall pulls in / hides, open ground restores;
`setYawBase` on both rigs. `zone-helpers.realSpec` now carries `interiors` (and accepts any `ZoneId`). Existing tests
needed no change (none pins a town digest).

## Open

1. Inner walls of the active hall never drop (only the outer walls do); ≤ 2 m, they hide a strip of floor behind
   them at the diorama pitch.
2. Canopy knoll edges read as a faceted ramp from close up; the outside of a pocket is mostly seen from 20–34 m.
3. The rim / canopy of the active pocket do not react to `setView` (rim bushes are ≤ 1.5 m and 1 m outside the
   walls, so they do not cover the floor at the diorama pitch).

## Phase D4 — shiny sparkle + burst (2026-10-06)

- `SpriteDescriptor.isShiny?` (additive). No new per-object field: `paletteFor(variant, isAlpha, out, isShiny = false)`
  writes `alphaGlow = (isAlpha ? 1 : 0) + (isShiny ? BILLBOARD.shinyGlow (2) : 0)`; the billboard graph decodes
  `shinyOn = step(1.5, glow)`, `alphaOn = glow − 2·shinyOn` (the alpha shimmer keeps reading 0/1) and adds a sparkle:
  twinkle cells (`sparkleCells 14`) re-hashed `sparkleRate 5`×/s, the top `sparkleDensity 6 %` lit at `sparkleGain 2.4` ×
  warm white, masked by the sprite alpha. Same material per atlas (no new program).
- `CreatureBillboard.setVariant(v, isAlpha, isShiny = current)` — the old two-argument call keeps the shiny state;
  `BattleStage.setBattler` passes `desc.isShiny`.
- VFX: `shiny_sparkle` (orbiting gold stars + one card flash, 30 particles) — `VFX_SHINY_IDS`, `VFX_IDS` is 48
  (`stage.test.ts` updated). Not verified on a GPU in this phase (node tests only).

## Phase D6 — doubles on the battle stage (2026-10-06)

- `battlerSlot` / `Stage.layoutSide` already spread `count` battlers per side; no placement change was needed. Doubles
  feet stand hypot(2.75, 0.9) ≈ 2.89 m from the ring centre; with `STAGE.battlerFootR` 0.55 m (new; the size-1 contact
  decal / 2) every foot disc is on the 3.5 m ring top. Each side's position 0 is on its own left (point-symmetric).
- `fitCentre` now lists the four doubles foot discs (radius `battlerFootR` + margin) in its need set. They are inside the
  4.0 m ring-fit disc, so no centre moves today (existing hall tests unchanged); the entries keep the guarantee if the
  ring or `SLOT_SPACING` changes.
- `layoutSide` takes `count` from the highest slot a side holds: removing slot 1 re-centres slot 0 (singles look). The
  client never clears a doubles position mid-battle (a battler fainted with no bench stays, fainted, on its slot).
- VFX anchors / cue targets / `projectBattler` / `syncFrom` were already keyed per ref; verified for all four refs.
- `contracts.ts`: `setBattler` comment says "the active refs get sharp" (not "the two").
- Tests: `test/doubles.test.ts` (3) — distinct, mirrored, in-ring feet for several yaws + singles unchanged; four foot
  discs on a narrow hall's floor after `fitCentre` (hall yaw 0 / 90° / 0.6 rad, axis along / across); a live `Stage` with
  four billboards (facing, sharp, ring top, VFX anchors for ally → ally, `impact_crit` hurts only its target).

## Phase D8 / D10 — surf mode, water ride, obstacles (2026-10-06)

- **Collider.** `passable(x, z, surf = false)` = `(walkable || (surf && water)) && !blocker`; `onWater` (water && !walkable);
  `waterLevel` from a lazily built per-sample level grid (`waterBodies(h, labels)` — the new optional `labels` out-param,
  same bodies, same order); `surfaceY` = max(level, terrain) on open water, else `sample`; `nearestPassable(…, surf)`.
  Lava: render cannot tell it from a pond, so the client never passes `surf` in a cinder zone.
- **Solver.** `resolveMoveInto(…, surf = false)` / `resolveMove(…, surf)`: heights from `surfaceY` in surf mode, the slope
  limit skipped on open water (the level is flat), the result's `y` is the surface.
- **Actors.** `setGround(sampler, water?)`; the wiring passes `surfaceY` / `onWater` when the ground has them
  (`StageGround.surfaceY?/onWater?`). On open water the feet stand flat on the level, the contact decal collapses and a
  second instanced mesh (`ewa:surf-ripples`, the decal plane geometry shared) draws `createRippleMaterial`: two rings
  expanding at 0.7 Hz and fading, additive-ish white, its own `ewaRippleTime` uniform advanced in `update`, class
  'decal'. +1 program (the open shader-program overage is unchanged otherwise). `onWater(id)` for tests / audio.
- **Obstacles.** `ZoneSpec.obstacles?` → `buildObstacles`: each obstacle its own object under the zone root (never merged
  into the chunk props): a tree is the biome's first scatter tree at `OBSTACLE_TREE_SCALE` 0.55 plus a hidden stump; a
  boulder a 1.15 m `buildRock`. Library materials only; every geometry recorded (digest + disposal). `ZoneHandle.obstacles`
  (`ObstaclesHandle`: `ids`, `setCleared`, `isCleared`). No collider footprint / crown is registered for them (movement
  is content's stamp; the battle camera's occluder scoring ignores them — a small tree, acceptable).
- Tests: `test/world-systems.test.ts` (5).

## Phase E3 — audit blockers and render open items (2026-10-06)

Measurement setup: the render sandbox on a private port (`EWA_SANDBOX_NO_HMR=1`, `?zone=mirevale`) and the client capture harness (`harness:shots`, 1440 × 900), in headless Chrome 154 over CDP on the Intel UHD (Gen-12) iGPU.

Another agent's art pass (density, daycycle, grain) was in the tree during both the before and after runs. Draw-call and frame-time deltas between those runs are therefore not attributable to this phase; program counts are.

### The neighbour skirt (audit M2-link-east-1)

**Data.** `ZoneSpec.neighbours?: Partial<Record<Dir, NeighbourSpec>>` (contracts.ts). A `NeighbourSpec` is a subset of the neighbour's own spec, in its own frame: id, layout, seed, heightfield, plan, buildings and interiors. It adds `edge`, the neighbour's playable-edge point on the shared link.

**Placement.** `zone/builder.ts` `neighbourFields(spec)` lays the neighbour's edge point on `edges[side]`. For mirevale e ↔ mire_route w that is d = (168, 0). It offsets the neighbour's heights so the two link points meet, and builds the neighbour's splat context from its layout plan (`layoutOf` + `createSplatContext`).

**Terrain** (`terrain/mesh.ts`):
- `skirtHeightFn` blends the generic hills toward the neighbour's terrain with `neighbourWeight`:
  - The neighbour's heights take over over the first 20 m past the field edge.
  - They fade back into the hills over the 16 m inside the neighbour field's own boundary, so there is no cliff where that field ends.
- `buildSkirt` mixes the neighbour's plaza, path and detail layer fields into the skirt vertices. They fade in over 3 m, starting 2 m inside the edge, so the neighbour's road is close to full width where this zone's road stops (mirevale's road ends at (80, 0)).
- `skirtClearFn` keeps the skirt treeline and rocks 4 m off the neighbour's roads and plaza.

**Cost.** No new material, mesh or program: the skirt's existing 32 m segments gain a path-layer group where the road crosses them. Sandbox at (92, 0), zoom 2, reduced effects: draws 129 → 131; materials 18 and programs 97 in both. Without `neighbours`, the spec, the skirt and the digest are unchanged. With them the digest changes and is deterministic (test).

**Shots:**
- `sk0-h1` / `sk1-h1` (mirevale (92, 0), heading 1, zoom 2) are the sandbox A/B. Without neighbours: hills and trees. With them: mire_route's road continues through its own terrain.
- `junc-h1` / `junc-h3` (zoom 0 at (80, 0)) show the join:
  - The two roads meet with a lateral jog of about 1–2 m.
  - The road edge is polygonal at the skirt's 2 m grid.
  - The straight seam between mirevale's worn-ground margin and the skirt grass predates this phase.
- The §50.6.1 shot-6 frame at (58, 0), zoom 1, ends at about x = 80, where the skirt starts. It therefore shows the edge of mirevale's field, not the skirt. The audit answer records this.

**Client.** `withNeighbours(zoneSpecFor(z, h), z)` in the SceneDirector, the harness and the sandbox (`&neighbours=0` for A/B). `zoneSpecFor` and its snapshot are unchanged.

**Test.** `test/neighbour-skirt.test.ts` (5):
- the join, continuity at the field edge, the neighbour's heights past the blend band, and the rim fade;
- skirt scatter off the road;
- a built mirevale: path triangles in the east skirt only when neighbours are passed, no skirt tree on the neighbour's road, and a deterministic digest.

### Handover keep and the phase-5 prefetch (prerequisites for handover-hitch)

- `Renderer.prepareHandover(next)` (`ZoneSystem.prepareHandover`) makes the next zone's surfaces the `nextKeep` of the old zone's dispose. Shared texture sets stay resident instead of being evicted and transcoded again. The SceneDirector calls it when a zone is loaded at the time `loadZone` runs.
- `MaterialLibrary.prefetch(ids)` (optional addition) fetches the `field` files of non-resident surfaces into the HTTP cache, one at a time at `priority: 'low'`, with no transcode and no GPU memory. It is used by the client's `scene/prefetch.ts`.

### Programs over the cap after dusk (render Part 6 Open 1, audit M2-gym-dusk-8)

**The light set is not the cause.** In the sandbox, at the spawn and at the gym, noon → dusk → night leaves programs at 107. The rig never toggles `visible` or `castShadow`, so the light set does not change with the time of day.

**What the harness shows** (`programNames()` diff): spawn-noon full 109 → reduced 101 → full 113 → mask 109 → **full 140**. The 31 added programs are lit scene variants of every visible material: cobble, dirt, bark, leaf, lichen, plaster, timber, character, decal, ripple and `ShadowMaterial`.

**Cause.** The harness's mask variant swapped the pipeline output to `mask.y` through the scene pass's texture node. That re-rendered the scene pass without TRAA (no velocity projection, Part 4 H4 fact c) at another render-call depth. The result was a second render object, with the TRAA-less program, for every visible object, and it stayed alive for the rest of the session. The shot order put the first full frame after a mask variant at gym-dusk, which is why it looked like "after dusk".

**Fix**, in the client harness: `drawMask` / `drawOutput` sample `scenePass.getTexture('mask' | 'output')` as plain textures. They show the last full frame and render no scene. The game itself always has TRAA in its graph, and no setting turns it off.

**Result.** `harness:shots` on mirevale (spawn-noon, gym-dusk, lamps-night, link-east × full / reduced / mask): programs **109 / 144 / 144 / 144 → 109 / 113 / 113 / 113**, reduced 132 → 101. Peak 144 → 113, against the 128 cap.

**What remains.** +2 programs in the sandbox (+4 in the harness) after the first full → reduced → full. This is bounded and does not grow on further toggles. It is one extra vertex program per small instanced mesh (the character decal, the surf ripple) for the second render context that a graph without DOF creates; the mesh's uniform-array name carries a per-build id (header table C21).

The task's hypothesis, "warm night variants in `compilePlan.ts`", was not needed: there is no night variant to warm.

### +2 programs after unload (Part 5 Open 1)

**Cause**, confirmed by program name: a zone's compile re-keys the warm objects and the persistent arena to its light set, and after the dispose nothing renders them. After a Mirevale unload, against the step-8 baseline, the extra programs are the warm quads `dirt`, `glass_warm`, `mist_glass` plus `character-decal` and `surf-ripple`; `grove_moss` and `plaster` are missing.

**Fix:** `renderer.ts` `scheduleWarmRekey`, called from the zone handle's dispose wrapper. Unless a `loadZone` starts in the same task, the warm group and the persistent objects are compiled in the background against the zone-less light set, which is the boot's set. A handover is the exception: the next compile re-keys them, and the pending run is cancelled. `compileIdle()` covers the background compile.

**Result.** Mirevale load → unload: programs **+2 right after `dispose()`, ±0 after `compileIdle()`**. The name diff against the baseline is empty. Geometries, textures, render targets and attributes are ±0. The sandbox's `leakCycle` now awaits `compileIdle()` after each unload. SPEC §10.5.9 is amended so the programs assertion is read after `compileIdle()`.

### DOF speckle (Part 4 Open 6 / Part 6 Open 3): deferred

**Where it comes from.** three 0.186's `DepthOfFieldNode` samples no noise. The speckle comes from its `blur16` near/far pass, a 16-tap max filter over the 64-tap bokeh result (`maxVal = max(tap.rgb, maxVal)`). That pass turns an isolated bright texel inside a large circle of confusion (a specular glint, a rim pixel) into a hard bright cluster. DOF runs after TRAA (§10.8.1), so nothing resolves the cluster over time. It shows only on out-of-focus faces in the 4 m inspector close-ups; at the diorama distances (20–34 m) the circle of confusion is small.

**Why deferred.** The fix is a custom DOF node: a weighted gather with per-tap depth weighting instead of the max pass. Part 4 Open 6 (the gather leak) needs the same node. It needs inspector A/B shots to judge, and it lands in `post/pipeline.ts`, which the art pass was rewriting during this phase for the grain node. It is deferred to the next post-stack pass together with the gather leak.

## Phase E6 — GPU device lost (2026-10-06)

**Detection.** `createRenderer` subscribes `watchDeviceLost(device, …)` right after step 3, before the warm-up. Two cases are ignored: the `'destroyed'` loss that our own `dispose()` causes, and anything after `dispose()`.

**On a loss**, `handleDeviceLost` runs once:
- sets `Renderer.deviceLost = { reason, message }` and three's `_isDeviceLost`;
- makes every later `frame()` return at once;
- calls `RendererOptions.onDeviceLost(info)`.

A lost renderer is not revived. Its owner disposes it and creates a new one; in the client that is World3D, `scene/deviceRecovery.ts`. three's own handler still logs its error. The WebGL2 fallback has no device-lost path; a lost WebGL context is out of scope.

**Test.** `test/device-lost.test.ts` (5), with a fake device whose `lost` promise the test resolves:
- one callback, with reason and message;
- `'destroyed'` is ignored;
- a loss after dispose is ignored;
- missing fields get defaults;
- no subscription when there is no `lost` promise.

**Not reproduced on a real GPU.** Chrome offers no scripted device loss short of `chrome://gpucrash`.

---

# Phase E1–E2 — density pass, M3 shot set, the re-landed art pass (2026-10-06)

User decision: "All towns as good as Mirevale; re-land the art pass; close audit blockers". The audit blockers (E3/E6:
neighbour skirt, compile plan, device loss) ran in parallel in the same tree and are described in their own sections.

## E1.1 — the 21-zone re-measure (before)

Sandbox (`vite --config vite.sandbox.config.ts --port 5186`, `EWA_SANDBOX_NO_HMR=1`), headless Chrome 154 over CDP,
Intel UHD (Gen-12LP), 1440×900, `?zone=<id>&t=10`, rig heading 0 / zoom 1 at `ZoneDef.spawn`, after `compileIdle`.
The script and PNGs live in the session scratchpad (`phaseE/smoke.mjs`, `phaseE/before/*.png`, `phaseE/after/*.png`),
not in the repo. The old note "towns other than Mirevale show no buildings from spawn" is still true; commit `33a852e`
did not change it. **Every town but Mirevale spawns at (−50, 0)** (content `ZoneDef.spawn`, the west road entry), 14 m
inside the 64 m walkable edge and 50 m from the plaza. The nearest house is 22–29 m away, outside the 26 m frame (≈ ±10 m
wide at the focus). Mirevale spawns on its plaza at (0, 6). Routes spawn at (−92, 0) on the road; story zones on their
approach. From spawn, towns and routes read as a road through sparse grass tufts (bright green even in cinder, marrow
and salt), barren biomes as bare ground, and story zones as an empty floor. No plaza set-piece can be in frame from
(−50, 0): the top frustum edge meets the ground ≈ 10 m past the focus. Render cannot move a spawn, a building or a
solid prop.

The re-landed lighting (E2) went into the tree while the before-run was going, so the before shots from `cinderhold` on
already carry it. The density is unaffected.

## E1.2 — the dressing pass (`zone/generators/dressing.ts`, wired in `zone/builder.ts`)

Content owns every solid. Its plan stamps the server's heightfield, and client `footprints.test.ts` asserts that the
builder's collider footprints equal content's. So the pass only adds what changes nothing a player can walk on:

1. **Verge clusters** (`vergeClusters`). Along every road and lane centreline, every 1.4 m and on each side (door
   paths at half the rate), a cluster is placed with probability `vergeRate` (0.70–0.85) × a 0..1 noise. It sits
   1.0–3.6 m past the edge and holds 1–2 bushes, 1–4 tufts, a flower patch and 1–3 small stones. Keep-clear:
   `scatterClear` (plaza, roads including door paths, buildings + 1 m, authored points + 1.5 m, water, set-piece,
   grass patches), plus pockets, hand-placed props, light posts and D10 obstacles.
2. **Rock clusters** (`rockClusters`): 1–6 small stones and 3 tufts round each big `rock_a` (scale > 0.8).
3. **Scree and shards** (`screeClusters`). Banded clusters of 3–7 small stones everywhere (0.002–0.032 per m²).
   Crystal-shard clusters (`buildShard`, the set's `props.crystal`) in shrine (0.012) and rift (0.014) only (marrow
   had 0.005 in the first cut; it bound `gypsum_crystal` as a new material in marrowdig / deepcut, so it was dropped). This is the one new scatter kind, `crystal_shard`: 3 tiers, no shadow, cover class small, so the arena
   clears it.
4. **Bushes for every green-ish biome.** `DressingStyle.bush` / `bushDensity` apply to sets without `bushLeaf`:
   `tall_grass` clumps in salt, cinder and marrow; `pine_needle` in storm and forge. They are not written into
   `BiomeSet.bushLeaf`, because the interiors' `foliageOf` and hand-placed `bush` props would change.
5. **Tuft tints per biome** (`grassTints`, replacing the builder's `GRASS_TINTS`). Dry and ashen bushes take them too.
6. **House skirts** (`skirtPlacements`, `buildSkirtItem`). 2–4 items per wall side: flower box, firewood stack, sacks,
   pot, keg, small crate. Each is centred `depth/2 + 0.02` m from the wall and at most `SKIRT_DEPTH_M` 0.46 m deep, so
   it stays inside the 0.47 m collider pad. None within 1.6 m of the door's centre line, none at a gym, none within
   0.9 m of a hand-placed prop or light. Merged into the per-chunk non-casting prop meshes.
7. **A boundary for every town biome** (`boundaryPieces`, `dressBoundary`). Runs of ≈ 2.8 m fill the stretches
   between 7.6 m road gaps at `half − 16 + 1.2`, outside the walkable square (tested on all 9 towns). A gate pier
   stands either side of each gap. The run is a dry-stone wall in grove, forge and capital (the old ~1 m blocks, laid
   inside each run), a post-and-rail fence in salt and vesper (it was a row of bare posts), or a boulder dyke in
   cinder, storm, marrow and sky (they had no boundary before). Rocks keep 1.7 m off the piers.

Everything binds only surfaces the set already binds. Instances go into the existing kinds (`bush`, `flower_patch`,
`grass_tuft`, `rock_b`), so the pass adds no draw call except `crystal_shard`. Every zone digest changes (no test pins
one). Test: `test/dressing.test.ts` covers the styles, skirt depth / door / gym rules, cover keep-clear on 4 zones, the
boundary outside the walkable square with its gaps, and determinism.

Spawn-view counts from the sandbox smoke, before → after. Beauty = draws − shadow-map draws. E3's neighbour skirt
landed in the tree during the run and accounts for the mire_route beauty +26 and the route materials +1.

| Zone | beauty draws | shadow draws | triangles | materials | programs |
|---|---|---|---|---|---|
| `mirevale` | 100 → 119 | 259 → 234 | 561k → 579k | 18 → 18 | 107 → 107 |
| `mire_route` | 89 → 115 | 78 → 74 | 841k → 882k | 13 → 14 | 107 → 107 |
| `cinderhold` | 70 → 78 | 81 → 108 | 320k → 658k | 18 → 18 | 99 → 101 |
| `ash_route` | 66 → 69 | 32 → 40 | 309k → 550k | 10 → 11 | 99 → 101 |
| `saltmourn` | 74 → 81 | 122 → 139 | 326k → 436k | 18 → 18 | 103 → 103 |
| `tide_route` | 75 → 78 | 34 → 42 | 302k → 411k | 10 → 11 | 101 → 101 |
| `stormrook` | 72 → 81 | 76 → 101 | 352k → 597k | 18 → 18 | 103 → 103 |
| `galvan_route` | 72 → 75 | 27 → 35 | 379k → 524k | 12 → 12 | 103 → 103 |
| `marrowdig` | 83 → 92 | 123 → 148 | 401k → 757k | 15 → 16 | 99 → 101 |
| `deepcut_route` | 73 → 79 | 24 → 32 | 276k → 505k | 7 → 9 | 97 → 99 |
| `vesperveil` | 84 → 89 | 113 → 118 | 459k → 533k | 17 → 17 | 101 → 101 |
| `hollow_route` | 76 → 76 | 41 → 41 | 591k → 657k | 9 → 10 | 101 → 101 |
| `forgewall` | 78 → 83 | 114 → 122 | 371k → 507k | 19 → 19 | 103 → 103 |
| `siege_route` | 72 → 75 | 34 → 42 | 322k → 461k | 9 → 10 | 103 → 103 |
| `skyrend` | 77 → 84 | 119 → 132 | 431k → 628k | 18 → 18 | 105 → 105 |
| `ascent_route` | 77 → 77 | 35 → 35 | 392k → 487k | 11 → 11 | 103 → 103 |
| `solenne` | 90 → 93 | 159 → 159 | 513k → 576k | 20 → 20 | 107 → 107 |
| `eclipse_shrine` | 56 → 58 | 16 → 16 | 287k → 671k | 6 → 6 | 99 → 99 |
| `umbral_observatory` | 63 → 63 | 40 → 40 | 400k → 455k | 10 → 10 | 101 → 101 |
| `celestial_spire` | 55 → 57 | 16 → 16 | 252k → 604k | 6 → 6 | 99 → 99 |
| `the_rift` | 70 → 72 | 16 → 16 | 272k → 682k | 5 → 5 | 95 → 97 |

The +2 programs in cinder, marrow, deepcut and ash are the casting `tall_grass` bush: beauty and shadow variants of
the instanced card graph. The total stays ≤ 128. The `harness:budget --set M3` numbers for all 21 zones are in
`.design/audits/M3-render-audit.md`.

## E1.3 — the M3 shot set (client harness)

- `shotTable.ts` `shotsForZone(zone, set)`: `M2` keeps the §50.6.1 table's own zones; any other set gives every zone
  all six rows.
- `anchors.ts`: `resolveAnchor = tableAnchor ?? fallbackAnchor`. The fallback rules are in §50.6.1 as amended
  2026-10-06; a fallback's sidecar `rule` starts with `fallback:`.
- `stage.ts` takes `anchor.heading.rig`, so a link-east fallback looks at its own edge.
- `harness:shots` and `harness:budget` take `--set` (page `?set=`).
- Test: `harness-anchors.test.ts` — all 21 zones resolve six walkable anchors; the slice's M3 anchors equal its M2
  anchors.
- M3 budget JSON goes to `.screenshots/budget/M3/<zone>.json` (+ `.dump.json`); M3 shots go to
  `.screenshots/audit/M3/<zone>/`.

## E2 — the art pass, re-landed

`git diff a6606df^ HEAD` was empty for `lighting/`, `zone/palettes.ts` and `post/`. So `lighting/daycycle.ts`,
`lighting/fog.ts`, `lighting/rig.ts`, `zone/palettes.ts` and the new `post/grain.ts` were taken from `aa19fa1` as they
were, with two edits: amendment dates moved to 2026-10-06, and `GrainNode`'s `static override get type` lost its
`override`, which @types/three 0.186 rejects on a static. `camera/rig.ts` was never part of those commits (they touched
`lighting/rig.ts`), so Phase A's `setYawBase` is untouched. New wiring: `post/pipeline.ts` calls `grain(…)` instead of
three's `film(…)`, with `POST_PARAMS.grain` 0.052.

What the pass changes:
- Sun path: sunrise 0.17, sunset 0.83, so t 0.80 is golden hour with the sun 10° up.
- The moon has its own path: 40° up at midnight, ≥ 110° from noon's shadows, intensity 0.30 so it casts.
- The §10.3.5 table: a warm key over a cool, low fill. The `hemi` column is 0.06–0.09 over hemisphere colours
  normalised to a unit sky; noon env is 0.45.
- `daylight` comes from the sun's elevation, not the keyframe intensity.
- Golden hours tint the fog toward the key colour.
- Fog has a 15 m clear zone and density 0.00486: 5.2 % at the 26 m focus.
- Grain is zero-mean and luminance-weighted.

Behaviour kept: interiors and the hall camera (no lighting hook), the doubles stage, the shiny glow, the surf ripple and
weather. Weather multipliers still apply: `envMul` scales the fill, and the fog density multiplier divides `fogStart`.
Tests updated: `daycycle.test.ts`, `lighting.test.ts`, `post-graph.test.ts`, `stats-dispose.test.ts`.

## Open — honest assessment

- From the town spawns the frame is still mostly road and ground with verge cover: richer than before, not Mirevale.
  The fix that would make every town read like Mirevale belongs to content: a spawn on or beside the plaza (as in
  Mirevale), or solid props and trees along the entry street in `planProps`. The heightfield, the server and the
  progression walker change with it. Not done here, because another agent's walker reads the same content.
- Tufts are still the crossed-card "X" clumps, and the `tall_grass` bushes in salt read as big tufts (cinder and
  marrow lost theirs after the first M3 shots: green clumps on ash and canyon sand read wrong).
- Shrine scree uses `eclipse_stone` on an `eclipse_stone` floor and nearly vanishes; only the shards read.
- House skirts are low and small, because they must fit the 0.47 m pad. They read at zoom 0 and barely at the default
  stop.

## Also in this phase

- **Interior rugs** (live report, Solenne league foyer at dusk: the `rug` read as a flat white slab — 4.2 × 2.8 m of
  the `sun_marble` runner). `generators/interiors.ts`: `ThemeKit.rug`, a muted non-card surface the theme already binds
  (`ThemeRow.rug`: grove `thatch`, forge `charred_timber`, sky `dragon_scale_tile`, league `grove_moss`; else the
  row's runner; shop / healer / house: the zone's cloth, else its wood — never an alpha card, the cloth surfaces are
  banner / sail / flag cards). The rug is 2.4 × 1.6 m before the prop scale, with a trim border, two inner bands and
  end fringes. Verified in the sandbox (`?zone=solenne&interior=solenne.league&x=51&z=-7`). Commit `5611ede`.
- **Harness battle script** (`client/src/harness/battleScript.ts`): the lead's first damaging move first (the M2
  choice), then the others weakest first; the wild level raised by 2 up to +10, then lowered to 6 / 4 / 2; last resort
  a turn 2 with only a move used. Needed for the M3 battle shots of vesperveil / hollow / forgewall / siege.
- **M3 measurements**: budget JSON `.screenshots/budget/M3/<zone>.json` + `.dump.json`, shots
  `.screenshots/audit/M3/<zone>/`; both untracked by design until committed with the audit.

## PROGRESS (resume point after a restart)

- Done (2026-10-06 13:35 UTC): E2 code + spec + tests; E1 dressing + spec + tests; harness M3 set; all 21 budgets on
  the 12:10 bundle (0 count violations; `audit:assets` 17/17 except `lights.housing` in galvan / siege / umbral, a
  set-piece light table mismatch that predates E1); 126 M3 shots; M2 re-shot; `.design/audits/M3-render-audit.md`.
- Left open (in the audit): content spawn / entry street (M3-all-2), per-biome tuft surface (M3-all-3), the gym-dusk
  fallback rule (M3-all-5), set-piece housings (M3-all-6), noon highlights (M3-all-10), a second, independent audit.

---

# Part 9 — creature texture residency, render's half (2026-10-06)

Resolves Part 8 open item 1 (GPU memory). The client now binds only the side a view shows and releases what nothing
shows (client IMPLEMENTATION-NOTES "Creature textures"); render gives it three small things and fixes the metric it is
judged by.

## Layout

| File | What |
|---|---|
| `sprites/atlas.ts` | `infoOvercountBytes(textures)`: the level 0 of each map (RGBA8 albedo + RGBA8 normal + R8 emissive) |
| `sprites/billboard.ts` | `BillboardPool.atlasUsers(id)` / `atlasRefs(id)` (billboards sampling / binds outstanding), `infoOvercountBytes()` (Σ over the loaded sets, kept in `load` and the cache's dispose callback); `CreatureBillboard.setFlipbook(on)` + `flipbookEnabled`; `resolve(frame, flipbook = true)` |
| `renderer.ts` | `FrameHook.textureOvercountBytes?()`; the host's `textureCorrection()` = `materials.residentTextureBytes()` − Σ hooks' overcount, used by `copyInfo` (RenderStats.textureBytes), `counts()` and the baseline |
| `stage/wiring.ts` | the part-3 hook reports `sprites.infoOvercountBytes()` |
| `test/residency.test.ts` | 3 tests (below) |

## Design

**R1 — the §50.2.2 texture metric counted a sprite atlas 1.75 ×.** three 0.186 `Info._getTextureMemorySize`
(`src/renderers/common/Info.js` lines 449–509) adds `width × height × bpp` of the image AND the size of every
`mipmaps` entry; render's atlases put level 0 into `mipmaps` too (Part 3: `[l0, l1, l2, l3]`, or three uploads level 1
as level 0), so each map's level 0 is counted twice: a 2048² static atlas reads 58.7 MB for 33.5 MB of GPU memory, a
3072 × 2048 flipbook side 88 MB for 50.2 MB — Part 8's "three counts more (≈ 89 MB a side)". The GPU texture is
created with `mipLevelCount = mipmaps.length` at the image's size, i.e. exactly the chain `atlasSetBytes` /
`animAtlasSetBytes` estimate. The host now subtracts the surplus like it adds the KTX2 bytes three counts as 1:
`textureBytes = info.texturesSize + residentTextureBytes() − Σ infoOvercountBytes()`, so a creature atlas reads its GPU
bytes (`BillboardPool.stats().bytes`) and the client's residency budget and the metric speak the same unit. Only the
sprite atlases / singles use the `mipmaps[0] = level 0` pattern (characters' GLB textures generate their mips; zone
materials are KTX2). The correction is one signed term, allocation-free, evaluated per frame. Every number in this part
gives both readings (`raw` = before the correction). **This changes how §50.2.2 is measured — proposed entry E1 below;
it needs approval, and is a one-line revert (`textureCorrection` → `residentTextureBytes()`).**

**R2 — `CreatureBillboard.setFlipbook(on)`.** A released atlas stays on the GPU while a billboard samples it (§10.4.2:
disposed at refs = users = 0), so the client cannot free a flipbook a standing card plays. `setFlipbook(false)`
re-resolves the side with the flipbook ignored: the card shows the static frame (the same one the bind-in-flight path
shows), un-uses the anim atlas and no longer waits for it; `true` re-resolves (plays at once when bound, else the usual
still → flipbook re-point on the bind). One re-resolve per call; no program, material or draw call is added. The client
turns it off for a legendary static beyond 52 m of the player (never on screen: the diorama camera's ground footprint
ends ≈ 24 m out at the widest zoom stop).

**R3 — `atlasUsers` / `atlasRefs`.** Read-only views of the cache's two refcounts, so the client's budget guard never
counts an atlas a billboard still samples as releasable (render would keep it anyway).

## Measured

The client's before / after runs (`pnpm --filter @ewa/client harness:textures`, client IMPLEMENTATION-NOTES "Creature
textures", 1440 × 900, Intel UHD) read every step both ways. The correction is exactly 0.753 × the bound creature
bytes: Mirevale idle 495.2 raw → 444.9 MB corrected (2 atlases, 66.8 MB of GPU memory); a zenryu vs raikitsune battle
with the residency 789.2 → 613.1 MB; galvan_route beside a static 966.0 → 701.7 MB. With the residency and the
correction every step of the four scenarios stays ≤ 707.1 MB (cap 734.0) and returns to 444.9 MB after leaving.
`setFlipbook` in play: galvan_route's statics show their still frame beyond 52 m and play beside the player (one
flipbook bound at a time). Programs / draw calls: unchanged by construction (no material, program or draw added).

## Tests

`test/residency.test.ts` (3): three's own `Info._getTextureMemorySize` on a static and an anim set equals the four-level
chain estimate + `infoOvercountBytes` (1.753 ×), so count − overcount = `bytes`; the pool's overcount follows its
loaded sets (bind, release, release-in-flight, dispose → 0) and `atlasRefs`; `setFlipbook(false)` shows the static
frame, stops sampling the flipbook (`atlasUsers` 0 → the release frees it) and ignores a bind landing meanwhile,
`setFlipbook(true)` plays at once when bound or re-points once when the bind lands. Client end-to-end on the pool:
`packages/client/test/creatureTextures.test.ts`. Render total: 29 files, 264 tests.

## Open

1. The metric change (R1) needs approval: entry E1.
2. The sandbox (`?demo=legends`) still binds all 20 sides at once — a stress view (Part 8 open item 3), not play.

## SPEC CHANGELOG entries (§50.7 form; applied by the integrating session, 2026-10-06)

```
## 2026-10-06 — `50-verification-budget.md` §50.2.2 (Texture memory row), `10-render.md` §10.10 — the texture metric subtracts the level 0 three's `Info` counts twice for the creature atlases
Why: three 0.186 `Info._getTextureMemorySize` adds the image's level 0 AND every `mipmaps` entry; §10.4.1 puts level 0 into `mipmaps` (`[l0, l1, l2, l3]`, or three uploads level 1 as level 0), so every creature atlas, flipbook and single read 1.753 × the GPU memory it allocates (a 2048² atlas 58.7 MB for 33.5 MB, a 3072 × 2048 flipbook side 88.0 MB for 50.2 MB). The row measures GPU texture memory; it already corrects the KTX2 bytes three counts as 1. Source column becomes: `renderer.info.memory.texturesSize` + `materials.residentTextureBytes()` − the sprite pool's `infoOvercountBytes()` (= `RenderStats.textureBytes`).
Evidence: render IMPLEMENTATION-NOTES Part 9 R1 (three `src/renderers/common/Info.js` lines 449–509; the GPU texture has `mipLevelCount = mipmaps.length` at the image's size); `packages/render/test/residency.test.ts` (three's own count − `infoOvercountBytes` = the chain estimate, static and anim); the harness runs (client IMPLEMENTATION-NOTES "Creature textures": every row read both ways).
Affects: `packages/render/src/{renderer,stage/wiring,sprites/atlas,sprites/billboard}.ts`; `RenderStats.textureBytes`, `BudgetCounts.texturesSize` and `harness:budget` reports read 0.753 × the bound creature bytes lower (Mirevale idle 495.2 → 444.9 MB at 1440 × 900); `tools/asset-audit` reads the dump's `counts.texturesSize` unchanged in shape.

## 2026-10-06 — `10-render.md` §10.4.2 — `BillboardPool.atlasUsers(id)` / `atlasRefs(id)` / `infoOvercountBytes()`, `CreatureBillboard.setFlipbook(on)`, `FrameHook.textureOvercountBytes?()`
Why: the client's residency (20-client.md §20.4.4, entry below) must not count an atlas a billboard still samples as freed (render keeps it while users > 0), and must be able to free the flipbook of a card that stays up but is never on screen (a legendary static more than 52 m from the player): `setFlipbook(false)` shows the card's static frame and stops sampling — and waiting for — its flipbook.
Evidence: render IMPLEMENTATION-NOTES Part 9 R2–R3; `test/residency.test.ts`; client `test/creatureTextures.test.ts` (end to end on `BillboardPool`).
Affects: `packages/render/src/sprites/billboard.ts`, `renderer.ts`, `stage/wiring.ts`; no program, material, draw-call or allocation-per-frame change.
```

# Handover: fixed light layout (2026-10-06)

The zone handover took 6–9 s on the dev iGPU (Intel Gen-12) to the first destination frame, against the SPEC's 250 ms
(preloaded) / 1 500 ms (not preloaded). This phase fixes it in two steps: (a) a fixed light layout, then (b) preparing
the destination off the scene before the crossing, which (a) makes possible.

## Cause

- three 0.186's `LightsNode.customCacheKey` hashes every scene light's `id` and `castShadow` into the cache key of
  every lit render object, and `setupLightsNode` emits one light node per light into each lit program.
- Each zone created its own `SpotLight` / `PointLight` objects. So on a zone's first frame every lit render object was
  a new node build, and a zone with a different light count or kind mix added program variants.
- Measured before (harness, mirevale → mire_route): first destination frame 6.4–8.9 s, programs 109 → 119–125 at the
  first frame → 113 settled.

## (a) The fixed light layout

**`lighting/layout.ts`** is set as the renderer's `lighting` at §10.1.2 step 4 (`createLightingLayout()` in `rig.ts`).
- `LayoutLightsNode` (a `LightsNode`):
  - Every non-shadow `PointLight` / `SpotLight` without `map` / `colorNode` goes to ONE `LocalLightsNode`.
  - Everything else keeps a stock light node per light: the sun with its CSM, the hemisphere, shadow casters.
  - `customCacheKey` hashes only the own-path lights, so a zone's lamps, windows, braziers and crystals never change a
    key or a program.
- `LocalLightsNode` stores 4 `vec4` per light in one `uniformArray` (capacity 32), updated per render call in view
  space, and loops over them by a uniform count:
  - row 0: view position + cutoff distance;
  - row 1: view axis (target → light) + decay;
  - row 2: colour × intensity + cos outer;
  - row 3: cos inner.

  The math is three's `SpotLightNode` / `PointLightNode`: `getDistanceAttenuation`, then
  `smoothstep(cosOuter, cosInner, dot(L, axis))`. A point light uses cone cosines −2 / −1, which makes the cone factor
  exactly 1.
- **Why not three's `DynamicLighting` addon** (the first attempt): it keeps 3–4 `uniformArray`s per light type, each a
  uniform buffer. The lit fragment stages reached 13 uniform buffers, over WebGPU's 12, and every lit pipeline failed
  validation ("The number of uniform buffers (13) in the Fragment stage exceeds the maximum per-stage limit (12)"). A
  first harness "after" run with it measured nothing real.

**The shadow slots** (`rig.ts`): shadow-casting lights stay one node each, keyed by id. They are therefore a fixed pool
in the scene from construction, in `LightRig.layout`: the sun, the hemisphere, the arena's 2 beacons (already
persistent), and `LIGHT_LAYOUT.shadowSpotSlots = 2` spot slots.
- A zone's shadow-map caster (`castsShadowMap`: spot kinds with `castShadow`) borrows a free slot, positioned in world
  space.
- `releasePunctuals` puts the slot back to idle: intensity 0, `shadow.autoUpdate = false` (never rendered), a 1×1 map
  (`shadow.map.setSize(1, 1)`).
- Non-shadow lights are still created and disposed per zone under the zone root (free under the layout).
- Why 2 and not 6 (8 − 2 beacons):
  - every slot is a shadow map that every lit fragment samples, lit or not;
  - with 6 slots, 4 cascades + 2 beacons + 6 slots took the billboard material to 17 sampled textures (> 16; second
    validation error of the first attempt);
  - content's maximum is 1 per zone. The survey of all 21 zones (intact): max 1 shadow-casting spot, 0 shadow-casting
    point lights, 20 non-shadow spots, 18 non-shadow points, 21 lights.
- `castsShadowMap` is now spot kinds only. A `castShadow` lava / fire point light counts against the budget but renders
  no map, as brazier / crystal / candle already did; no zone has one.
- The dev budget check throws at the 3rd shadow-map caster (no free slot). The 8 / 24 counts are unchanged.

**Stats / dump.**
- `countPunctualLights` skips idle slots (`userData.ewaIdle`).
- `dumpZone` takes `extraLights`; the renderer passes `LightRig.slotLightsInUse()` while a zone is loaded. The housing
  checks and `lightIds` therefore see the zone's shadow caster as before.

**Measured after (a) alone** (harness, same machine load):
- first destination frame: preloaded 5.9 s, cold 5.0 s;
- programs: 109 → 109 → 109.

The light set was not the main cost. Node-build instrumentation (sandbox, wrapping `NodeManager._createNodeBuilder`)
showed the remaining 76 builds / 5.4 s of the crossing:
- 49 scatter `InstancedMesh` builds = 4.3 s. three's `RenderObject.getMaterialCacheKey` adds `object.uuid` for every
  `InstancedMesh`, because its instance buffers live in the node graph, so each one is its own build whatever the
  lights.
- 11 plain meshes = 1.0 s.
- 16 shadow-pass builds = 36 ms.

## (b) Preparing the destination off the scene

This is valid only because of (a): a compile made while zone A is up now has the same light key as zone B's frames.
- **`Renderer.prepareZone(next, { focus })`**:
  - `ZoneSystem.prepare` builds `next` with `scene: null` and deferred lights. The builder's `createPunctuals` returns
    the array it keeps, filled at adoption. A light of `next` would light the current zone: every zone is laid out
    around the origin.
  - The hero tier is gated until adoption.
  - `next`'s surfaces stay resident through the current zone's dispose (`preparedKeep`).
  - The renderer gates every unit and compiles them in the background, nearest the arrival first (the same
    `compileQueue`).
- **`loadZone`** of the same zone (id, seed, harvest level) adopts it (`adoptPrepared`):
  - the root joins the scene, the lights are created and the palette applied;
  - phase 1 compiles only the first-view units the background run has not finished;
  - the run continues without background slots (`CompileRun.urgent`), skipping units already ungated.
- **Dropping**: a prepare of another zone, a `loadZone` of another zone, `dropPrepared()` or `dispose()` drops it.
  Dropping while a zone is current keeps that zone's surfaces in the eviction.
- **Client**:
  - `SceneDirector.prepareZone(id, harvest, focus)`;
  - World3D `prepareNearEdge`: within `PREPARE_EDGE_M` = 48 m of a link's edge point, checked every 30 fixed steps
    outside battles, it prepares that zone at the arrival 8 m inside its opposite edge;
  - the harness's preloaded handover prepares and records the prepare's frame gaps (`HandoverResult.prepare`).

## Measured

Intel Gen-12 iGPU, headless Chrome; other sessions' harness Chromes were running throughout. Before and after use two
harness bundles built from the same tree, without and with this change (`EWA_HARNESS_BUILD_DIR` +
`EWA_HARNESS_NO_BUILD`, two runs each; the third "after" value is the spec's own build path, run last).

| | before | after |
|---|---|---|
| handover preloaded: first destination frame (SPEC ≤ 250 ms) | 6 402 / 8 895 ms | **105 / 68 / 196 ms** (`loadZone` 36 / 17 / 45 ms) |
| handover not preloaded (SPEC ≤ 1 500 ms) | 7 734 / 8 562 ms | **3 781 / 3 742 / 4 659 ms** |
| programs: before the crossing → first destination frame → settled | 109 → 119 / 125 → 113 | **109 → 109 → 109** |
| the prepare (preloaded only, in the background before the crossing) | — | 3.9 / 2.9 / 7.6 s; longest frame 1 083 / 833 / 1 716 ms (the synchronous `buildZone`, 0.9 s in the sandbox), other frames at the idle rate |
| `first-frame.spec.ts` mark (SPEC ≤ 2 500 ms on the reference GPU) | 64.0 / 34.4 s | **24.9 / 25.9 s** |

Notes on the table:
- Frames over 33 ms remain the norm on this iGPU under that load: its idle frame is 70–130 ms with the full post chain.
  The "no frame > 33 ms" check is therefore meaningful only on the reference GPU.
- The not-preloaded crossing is still over 1 500 ms. It still builds the destination (0.9 s) and node-builds every
  scatter `InstancedMesh` and the new plain meshes (≈ 2.5 s here).

**Sandbox** (`?zone=mirevale&track=1`, layout on):
- programs 89 after step 8, 107 with Mirevale;
- a prepared mire_route adopted in 2 ms (phase 1: 0 units), programs 107;
- a cold cinderhold after it: phase 1 4.1 s, programs 99;
- render targets 35 after step 8 (the 2 idle slots) and 36 with Mirevale.

**Leaks:**
- `leakCycle(3)`: geometries, programs, render targets, attributes and attribute bytes are ±0 after every unload.
  Textures +1 from the second round on: the known water-normal re-init (HANDOFF open issue, not new).
- Prepare → drop with Mirevale loaded: geometries 506 → 740 → 506, attributes 1 840 → 3 007 → 1 840, programs 107
  throughout. The drop's eviction releases Mirevale's retired field sets (−33 compressed textures, H5c), as any
  eviction does.

**Visuals:** harness `stage()` shots (spawn-noon, gym-dusk, lamps-night) on mirevale and cinderhold, before vs after
bundle:
- mean |Δ| 0.2–0.7 / 255;
- two runs of the before bundle differ by 0.8–5.5 / 255 (TRAA and day-cycle timing);
- the lamp pools match (lamps-night).

The warm re-key after an unload (Phase E3) now compiles nothing new, since no zone changes the light set. It is kept
as a guard.

## Tests

- `test/light-layout.test.ts` (4):
  - the layout key equals the boot key with the lights of 6 zones, while the stock `LightsNode` key differs for each;
  - slots and idle counting;
  - the loop's rows (view-space position, cone cosines, point light cone factor 1) and its key;
  - `ZoneSystem.prepare` / `adopt` / `drop`: off the scene, lights deferred, the current zone's sets kept on drop, the
    prepared sets kept through the current zone's dispose.
- `lighting.test.ts`: `castsShadowMap` spot-only; a borrowed slot goes idle and is never disposed; the 3rd shadow-map
  caster throws.
- `zone-dispose.test.ts`: lights under the root + borrowed slots = `spec.lights`; the slot idles on dispose.
- `zone-dump.test.ts`: the dump gets `extraLights`.
- Client: no new vitest. `handover-hitch.spec.ts` records `programsBefore` / `programsSettled` / `prepare`, and
  `EWA_HARNESS_NO_BUILD=1` serves a pre-built bundle (A/B).

## Open

- **The not-preloaded crossing (3.7 s)** builds the zone synchronously and node-builds every scatter `InstancedMesh`
  (uuid-keyed). The fix: scatter instancing whose instance buffers are geometry attributes, read by name, so all
  scatter meshes of a material share one node build. That touches the material graph, the shadow pass and the TRAA
  velocity path.
- **The prepare's one long frame** (0.8–1.1 s) is `buildZone`. Splitting the build into yielding steps would remove it.
- The two items above are closed by "Handover II" below.
- **Slots**: a zone with more than 2 shadow-map casters needs `LIGHT_LAYOUT.shadowSpotSlots` raised, within the
  16-sampled-texture budget (≤ 5 with the current billboard material).

# Handover II: shared scatter builds, a time-sliced build (2026-10-06)

Closes the two open items of "Handover: fixed light layout" (the not-preloaded crossing, the prepare's long frame).

## PROGRESS (resume point after a restart)

- [x] baseline numbers (harness bundle of HEAD ffe5d48 in the session scratchpad `hitch2/base`): preloaded first frame
      79 ms, prepare 2.75 s with one 717 ms frame; cold crossing 2 510 ms (lighter machine load than the last phase).
- [x] (a) `zone/instancing.ts` ScatterMesh + the build keep (`Renderer.installBuildKeep`): cold 1 089 ms, prepare
      963 ms; A/B shots mean |Δ| 0.04–0.97 / 255, programs / draws / triangles identical, attributes −288.
- [x] (b) `steps.ts` + generator builders (`buildZoneSteps`, terrain / skirt / house / pocket / jittered points); the
      digests of all 21 zones equal HEAD's, sync and sliced (temp test). Longest step ≈ 15–30 ms (node).
- [x] (b) `ZoneSystem.prepare` builds sliced: one 8 ms slice per frame right after it (`nextFrame`), cancel on drop,
      urgent on adoption. Prepare max frame 66.8 ms (= idle), 0 frames > 100 ms; prepare 3.1–3.7 s (was one 1.1 s frame).
- [x] the pipeline hold (`Renderer.installPipelineHold`): a disposed zone's pipeline releases wait for the next zone's
      phase 1. Cold crossing 692–1 348 ms depending on machine load (base 2 510–2 995 ms in the same sessions).
- [x] tests, budgets, leaks, A/B shots, SPEC + CHANGELOG (done; the sections below are final)
- [x] the build keep skips shadow-pass builds (they re-initialised disposed hero textures: +5 textures per Mirevale
      reload in `leakCycle(3)`); leak cycles ±0 again; `test/handover-ii.test.ts` (7); A/B fresh + round-trip shots.

## Layout

| File | What |
|---|---|
| `src/zone/instancing.ts` (new) | `ScatterMesh`, `ScatterMatrices`, `scatterColors`, `installScatterInstancing` (the `setupPosition` prepend) |
| `src/steps.ts` (new) | `Steps<T>`, `drain`, `runSliced` (budget, `cancelled`, `urgent`, `SliceStats`), `nextSlice`, `nextFrame`, `STEPS_CANCELLED` |
| `src/zone/scatter.ts` | `ScatterField` builds `ScatterMesh`es (shared tier matrix / tint buffers, `instances` instead of `count`); `jitteredPointSteps` |
| `src/zone/builder.ts` | `buildZoneSteps` (generator; `buildZone` drains it; each build has its own shape cache), `loadZone` `sliceMs` / `sliceWait` / `cancelled` / `urgent` / `sliceStats`, `isZoneMesh` |
| `src/terrain/mesh.ts`, `zone/generators/{buildings,interiors}.ts`, `zone/geo.ts` | `terrainChunkSteps`, `skirtSteps`, `houseSteps`, `interiorSteps` (the old functions drain them); `swapShapeCache` |
| `src/zone/system.ts` | `prepare(spec, { sliced, cancelled, urgent, stats })`, `PREPARE_SLICE_MS`; a prepare's keep is cleared only if still its own |
| `src/renderer.ts` | `installBuildKeep` (`buildKeep.states`), `installPipelineHold` (`pipelineHold.held`), `prepareStats`; `prepareZone` passes cancel / urgent / stats |
| `src/stats.ts`, `src/compilePlan.ts` | a `ScatterMesh` counts as an instanced draw (dump `instancedMesh`, `instanced` = its instances; compile-plan bounds / unit key) |
| client `src/harness/HarnessWorld.ts` | `HandoverResult.prepare.build` (the sliced build's slices, work ms, longest slice / step) |

## Design

**(a) Scatter builds shared.** three 0.186 keys an `InstancedMesh`'s node build by its uuid
(`RenderObject.getMaterialCacheKey`: `isInstancedMesh || count > 1`), because its instance buffers are node attributes
bound to that one object (`BufferAttributeNode.attribute`, resolved before the geometry in `RenderObject.getAttributes`).
- `ScatterMesh` is a plain `Mesh` (`count` stays 1) over an `InstancedBufferGeometry` that references the part geometry's
  attributes, index, groups and draw range (nothing copied) and adds the instance data as plain geometry attributes:
  `ewaInstM0..3` (vec4 rows of one `InstancedInterleavedBuffer` per tier, shared by the tier's class meshes) and
  `ewaInstColor` (tinted parts). Draw count = `geometry.instanceCount` (`RenderObject.getDrawParameters` reads it first).
  Attributes read by name resolve against each object's own geometry, so the key is material + attribute layout.
- The transform is three's `Instance.js` moved in front of `NodeMaterial.prototype.setupPosition` (installed once), for
  geometries that carry `ewaInstM0` only, so no other key or program moves. It runs for the beauty pass and for the
  shadow pass's override material (which uses the base `setupPosition`): position, `transformNormal`, `vInstanceColor`
  (three's `setupDiffuseColor` multiplies it in when `object.instanceColor` is set), and `positionPrevious` through the
  same matrix for the velocity MRT (three's previous-matrix copy differed only on a tier rewrite frame). Wind
  (`positionNode`) still runs after it on the instanced position.
- `ScatterField` keeps its buffers, chunk slices, masks and capacities; `count` → `instances`. `ScatterMesh.dispose()`
  fires the object's `dispose` (render objects) and disposes the wrapper geometry.
- Within a zone this alone turns 49 scatter builds into one per material × layout. Across a cold crossing it is not
  enough: the old zone is disposed first, and three drops a node build (and a pipeline, and programs) with its last
  render object. Hence:
- **Build keep** (`installBuildKeep`, wraps `NodeManager.delete`): the first time a zone mesh's (`isZoneMesh`, a WeakSet
  the builder fills) scene-pass build would be dropped, it gets one extra use, so it stays in `nodeBuilderCache` for the
  session. A build is shader text + binding layout, no GPU object; bounded by surface × layout × context (31–38 kept
  after Mirevale + mire_route). Shadow-pass builds are NOT kept: with them `leakCycle(3)` showed +5 / +10 textures
  (1024² hero textures "RE-INIT after destroy by … / ShadowMaterial", the `?track=1` tracker), and they are cheap.
- **Pipeline hold** (`installPipelineHold`, wraps `Pipelines.delete`): while a zone is disposed its render objects'
  pipeline releases are queued; they run when the next `loadZone` ends (both paths resolve after phase 1), in the next
  task when no load follows (before the warm re-key), or on renderer dispose. Pipeline keys are structural
  (`WebGPUBackend.getRenderCacheKey`), so the new zone's first view hits them instead of waiting on GPU pipeline
  compiles (≈ 0.4 s idle in the cold profile). Programs return exactly as before once released.

**(b) The time-sliced build.** `buildZoneSteps` is the old `buildZone` body as a generator yielding a label after each
unit (terrain field rows / chunk, skirt segment, water body, house wall / roof / dressing, LOD tier, prop, housing,
boundary piece, pond stones / planks / posts, plaza curb / pattern, warp room, pocket wall / prop / gate / switch /
merge / canopy row / level, static chunk, scatter section / 4 096 jittered candidates / field, digest batch).
- `buildZone` = `drain(buildZoneSteps(...))`; `loadZone(..., { sliceMs })` = `runSliced`. Same code, same order.
- Every build runs each of its steps with its own chamfer-box cache (`swapShapeCache`): the module cache matches sizes to
  1 mm, so what is in it decides exact vertices; interleaved builds (a dropped prepare still in flight, two prepares)
  would otherwise change each other's digest.
- `ZoneSystem.prepare`: one slice of `PREPARE_SLICE_MS` = 8 ms per frame, started by `nextFrame()` (a task right after
  the next animation-frame callback; 250 ms stall fallback for hidden tabs). A first version yielded with
  `scheduler.postTask` between 8 ms slices: frames waited behind the current slice (prepare max frame 100–183 ms).
  Right after a frame, the main thread of a GPU-bound iGPU frame is idle, so even the longest steps (15–30 ms in node,
  40–55 ms in the browser: a set-piece's geometry, a pond bank, a gym wall) land in that gap.
- `cancelled()` (renderer: the run was dropped / the renderer disposed) stops between slices (`g.return()`,
  `STEPS_CANCELLED`, handled quietly); `urgent()` (set when `loadZone` adopts a prepare still building) runs the rest
  without waits. A prepare's surface keep is cleared only if it is still its own (`clearKeep`).
- The cold `loadZone` still builds synchronously (fastest to the first frame; the overlay covers it).

## Measured (Intel Gen-12 iGPU, headless Chrome 154; other sessions' Chromes running; HEAD = harness bundle of ffe5d48)

`handover-hitch.spec.ts`, HEAD and final bundles back to back (`EWA_HARNESS_NO_BUILD` + `EWA_HARNESS_BUILD_DIR`):

| | HEAD | final |
|---|---|---|
| not preloaded, first destination frame (SPEC ≤ 1 500) | 2 062 / 2 510 / 2 995 ms | **687 / 743 ms** (1 327 / 1 348 under heavier load, before the shadow-keep fix) |
| preloaded, first destination frame (SPEC ≤ 250) | 63 / 79 / 89 ms | 42 / 46 ms |
| the prepare: total / longest frame / frames > 100 ms | 2.8–3.7 s / 683–1 150 ms / 1–2 | 3.8–4.1 s / **67 ms** (= idle) / 0 |
| the prepare's build | one call | 70–74 slices, 731–823 ms work, longest slice 41–58 ms |
| programs before → first frame → settled | 109 → 109 → 109 | 109 → 109 → 109 |
| node builds during the crossing (incl. the prepare) | 49 instanced + 11 mesh + 18 shadow | 0 + 1 + 5 (cold and preloaded) |

Cold profile before the pipeline hold (unminified bundle, CPU profile window = the director's `loadZone`): 150 ms of
neighbour plans in the client (`withNeighbours` → content `zonePlan`), 810 ms synchronous build (terrain 436 ms), then
phase 1 ≈ 600 ms, of which ≈ 400 ms main-thread idle (GPU pipelines). After: phase 1 41 ms.

- **Leaks** (sandbox `?zone=mirevale&track=1`): `leakCycle(3)` ±0 on geometries / textures / programs / render targets /
  attributes / attribute bytes every round (HEAD the same in the same session; the earlier "+1 texture" did not
  reproduce). Prepare mire_route → drop: geometries 508 → 744 → 508, attributes 1 560 → 2 495 → 1 560, programs 107.
- **Budgets** (`harness:budget --set M3`, final bundle): 0 cap violations on mirevale, cinderhold, deepcut_route,
  the_rift. Mirevale: draws 383, programs 109, geometries +2 (wrapper geometries), attributes 1 879 → 1 591.
- **Visuals** (harness `stage()` spawn-noon / gym-dusk / lamps-night, 1440 × 900): fresh mirevale + cinderhold mean |Δ|
  0.04–0.72 / 255. After a cold round trip (zone → link → zone, with the kept builds and held pipelines in use) 0.2–2.6 /
  255, from wind phase and the DOF-blurred crown in front of the camera; the HEAD bundle's own fresh vs round-trip shots
  differ by 3.8 / 255. Draws, triangles and programs equal in every shot.
- **Digests**: all 21 zones equal HEAD's, drained and sliced (a one-off test against a HEAD source snapshot).

## Tests

- `test/handover-ii.test.ts` (7):
  - scatter draws: no `isInstancedMesh`, `count` 1, the row attributes on the tier's shared buffer, the tint attribute,
    tier-0 instances, fewer layouts than draws, shared buffers per tier;
  - dispose fires each draw's `dispose` and its wrapper geometry's;
  - drained / sliced / interleaved builds give the same digest and info (mirevale, cinderhold, mire_route);
  - `runSliced` budget, stats, cancel (the generator's `finally` runs), urgent;
  - `loadZone({ sliceMs })` and `ZoneSystem.prepare` (sliced by default, cancelled, urgent, adopt).
- `zone-dispose.test.ts` (scatter draws wrap their geometry in an `InstancedBufferGeometry`), `zone-helpers.ts` (the
  mock GPU counts a `ScatterMesh` as instanced), `zone-dump.test.ts` (comment).
- `npx vitest run packages/render packages/client`: 79 files, 641 tests; `pnpm typecheck`; `npx eslint packages/render
  packages/client` clean.

## Open

- The cold crossing still pays the synchronous build (≈ 0.6–0.8 s, half of it terrain) and the client's neighbour plans
  (≈ 150 ms, content `zonePlan` for the destination's neighbours). Faster terrain chunk generation needs its own digest
  check.
- The prepare now takes 3–4 s on this iGPU (one 8 ms slice per ~50 ms frame) and starts 48 m from the edge; a bike
  (10.5 m/s) reaches the edge in ≈ 4.6 s. A crossing that arrives first finishes the build without waits (`urgent`).
- The kept node builds live for the session (bounded by surface × layout; 31–38 after two zones). Why kept shadow-pass
  builds re-initialised disposed hero textures was not pinned down (three's shared shadow override material swaps
  `colorNode` per object), so shadow builds are never kept.
- `ScatterMesh` relies on two three internals: the `getMaterialCacheKey` rule above and `NodeMaterial.setupPosition`. A
  three upgrade must re-check both (the A/B shots and `handover-ii.test.ts` catch a broken transform or layout).

# M3 review: framing, battle, harness (2026-10-06/07)

The render half of the independent M3 review's fix list (`.design/audits/M3-render-audit.md` "Independent review"):
R-all-1 (blocker), R-forgewall-2, R-all-6 / R-all-9 / R-saltmourn-3. SPEC: four CHANGELOG entries of 2026-10-06
(§50.6.1 headings, §50.6.2 per zone, §10.2.4 occluder fade, §10.7.5 trainers + pad).

## R-all-1 — the trainers stand beside their creatures

- `camera/battle.ts` `trainerSlot(cx, cz, fx, fz, side, out)`: `TRAINER_SLOT_M` 4.45 m from the ring centre (the old
  on-axis distance, content `ARENA_SLOT_M`), `TRAINER_SIDE_DEG` 45° off the battle axis toward the side away from the
  battle camera's +12° yaw — side 0 on the near half to the camera's left, side 1 the point reflection. On the axis the
  avatar stood in the camera → near-battler ray (rect overlap 0.17–0.56 in 17 of 21 M3 battle rows).
- `Stage.trainerSpot` and `fitCentre` (hall fit) use it; the client places the local avatar and the foe actor with
  SceneDirector `trainerPose` (render `trainerSlot`, facing the ring centre).
- Why 45°: `test/battle-trainer.test.ts` projects the harness's own rects (player: a 0.4 m × 1.6 m cylinder; battler:
  the card, feet → top ± half width along the camera right) through the rig's stock battle framing with the client's
  panel insets at 1440×900 and 1280×720, every heading, cards 0.8–2.69 m (sizeScale 0.5–1.5 × alpha 1.12; every
  manifest frame is square) and 1.6 × 1.25, singles and doubles, and every frame of the six cues. 30° fails a 2.69 m
  doubles card (6.3 %); 35–55° pass; 45° covers 0 % everywhere (margin for a taller creature).
- Harness `forgewall/battle--47.39_5.08` re-shot (scratchpad, see below): player rect x 126–292 against Bramblecub's
  601–827, the creature whole; `maskCoverage.battlers[0].full` is now the creature's own share (0.277; it read 0.6725
  with the avatar merged into it — M3-all-8's blind spot no longer bites in the stock framing).

## R-forgewall-2 — the ring levels a terrain pad

- `stage/terrainPad.ts` `TerrainPad`: like `PropCutaway`, edits the zone's terrain chunk meshes
  (`ewa:terrain:<cx>,<cz>`) in place — every vertex above the seat inside `padInnerM` 5.0 m (ring, curb, posts, pylons)
  is lowered to it, easing back (smoothstep, lowered only) by `padOuterM` 7.0 m; normals on the flat pad become up;
  saved originals are written back on undress (overlapping pads re-apply from the originals, so they compose). Only the
  touched vertex range is uploaded; nothing is added to the zone root, no material change (Pillar 7).
- The seat (`placeArena`): 24 samples on the ring rim and the curb's outer edge; with a pad the seat is the lowest the
  0.45 m skirt still closes downhill, `min(hi, lo + skirt − 0.05)`; without a zone (no pad) the Part 5 rule stays.
- `TerrainPad.adjust(x, z, y)` is the same cut analytically; wiring routes the actor pool's ground sampler through it,
  so the trainers and the spectators stand on the pad / bank, not in the air or in the hill.
- The forgewall anchor: centre −0.54 m, rim −0.81 … +0.24 m. Before: seat −0.14, the uphill ground 0.3 m above the
  ring top. Now: seat −0.41, every terrain vertex inside 5 m ≤ the seat (`test/terrain-pad.test.ts`, which also pins
  lowered-only, the ease, byte-exact restore and adjust = mesh).
- Known limit: trees are scatter, not terrain — a tree inside the 5–7 m bank on a steep slope keeps its original base
  height (a few cm to dm above the cut). None seen in the re-shot frames.

## R-all-6 / R-all-9 / R-saltmourn-3 — the occluder fade reaches the foreground

`materials/occlusion.ts` (the mask node only; nothing else in materials/ touched): `clearM` 1.0 → 0.35 m (a pine
crown reaching chest height in the kept last metre stippled the player: maskCoverage 0.40–0.43), and a second volume:
fragments > `fgNearM` 2.0 m in front of the focus (horizontal, toward the camera) and > `fgHeightM` 3.2 m above the
followed feet, each eased over 1.0 m, take the same dither (`max` of the two amounts). Ground dressing, fences, bushes
and lamp posts in front of the focus stay; nothing behind the focus changes. Same uniforms, no new runtime compile;
shadow maps keep the full occluder (scene-camera gate).

# M3 review: the four towns below the bar (2026-10-06 … 10-11)

The art half of the review's fix list, blocker 3 (Saltmourn, Skyrend, Cinderhold, Stormrook below the Phase E bar) and
blocker 4 (M3-all-3, green tufts on non-grass ground). Begun 2026-10-06/07 in a session that left it uncommitted; finished
and verified 2026-10-11 from the arrival views (rig 0, `harness:shots -- --set M3 --shots spawn-noon,gym-dusk,lamps-night`).
SPEC: CHANGELOG 2026-10-11 "M3 town art".

- **Tufts take the biome's colour** (M3-all-3 / M3-all-4). The per-biome `grassTints` multiply the card and could not
  desaturate it. `SurfaceParams.tone` (vec4) re-tones a card surface: `rgb = mix(rgb, luminance(rgb) · tone.xyz, tone.w)`,
  `tone.xyz` = the target divided by the surface's base luminance, so the texture keeps its light / dark structure.
  `Palette.grassTone` sets it on `tall_grass` with the palette (`MaterialLibrary.setTone`, also applied to a material
  created later). One uniform: no program change. The dressing `grassTints` became near-white so they no longer
  fight the tone.
- **High-albedo calibration** (M3-all-10 / R-all-5 / R-all-4): `SurfaceExtras.albedoCal` 0.82–0.88 on snow, salt sand,
  sky marble, cloud stone, bone chalk, pale plaza stone and sun marble, written into `albedoScale` once the baked set
  binds. The bake and its ≤ 0.85 ceiling are unchanged.
- **Cinderhold** (R-cinderhold-3). Ash: the soil's albedo is keyed to the height, and the first cut's strong drifts
  (ripple amp 0.3) painted zebra stripes, while the pebbles take the top of the normalised range so the bare ash
  otherwise lands on one dark value. New optional soil `drift` (organic albedo patches from their own noise, independent
  of the height; absent = no change to any other soil): pale ash `#7d766c` at 0.55 over dark cinder, low ripples
  (amp 0.1). Lava: `lava_glow` glows per texel (`emissiveFromAlbedo`) with a near-black crust (`#1c1513`), so only the
  molten flow glows; the pool is a flat extruded disc (planar UVs: the lathed dome pinched the texture into a starburst)
  meeting the rim's slope at 0.31 m; 15 large crust plates packed along the rim and 7 small rafts in the middle give the
  cooled skin and the hot centre; the kerb is fractured basalt and obsidian shards, not 16 glossy blocks. Braziers
  22 / 10 m → 30 / 11 m (the night was red-brown murk).
- **Stormrook** (M3-stormrook-1 raised, R-galvan-1). The ground was `storm_slate` under a `wet_flagstone` plaza: one
  material at one value. Ground `grave_moss` (a dark olive moor; `grove_moss` read as Mirevale's lawn), roads
  `wet_flagstone`, the fringe `storm_slate` (slate shows through by the roads and buildings), the plaza `tower_stone`.
  `storm_slate` lost its facet cells (it read as paving) and gained heath lichen. Crystal lamps 18 / 10 m →
  38 / 12 m, `#b4dcff` (one cold pool per lamp, the town read as empty at night). Galvan Route shares the palette.
- **Skyrend** (M3-skyrend-1/-2, R-skyrend-3). Plaza `cobble` (was `sky_marble`: white on white), paths `path_gravel`;
  stall timber `timber` and stall roofs `dragon_scale_tile` (the teal stripe read as knitted fabric, the prayer-flag
  awning as a rainbow plank; the flags stay on the shrine).
- **Saltmourn** (M3-saltmourn-1/-2). Plaza `harbour_plank` (a deck, was a grey cobble grid); the arrival view now holds
  the lighthouse and its door.
- **Plaza clutter** (all four; the thin plazas). `dressing.ts` `PLAZA_CLUTTER` / `plazaClutter` / `buildClutterItem`:
  6–10 clusters of 2–4 walk-through items 1.3–2.3 m inside the rim — salt rope coils, net piles with floats, fish
  baskets, lobster pots, kegs, small crates; storm cable spools; sky prayer cairns, pots, flower boxes; cinder coal
  heaps, firewood, kegs. The first cluster stands 30° off the south road, beside content's arrival point, so every
  arrival view holds one (a random start put Skyrend's 8 items all out of frame). Keep-clear: 0.9 m off hand-placed
  props and lights, 1.3 m off authored points, off roads, buildings and the set-piece. Merged into the static chunk
  meshes (shadow-casting), surfaces the biome already binds (`dressing.test.ts`: storm's prop timber is
  `harbour_plank`, so "binds" means the biome row plus its `PropStyle`). The grove (the bar) gets none.
- Budget (`harness:budget -- --set M3 --shots all --no-diff --budget-ms 0`, counts only, worst of the six shots): 0 count-cap
  violations. saltmourn draws 454 / beauty 150 / programs 109 / materials 18 / textures 566 MB; skyrend 364 / 139 / 113 / 20 /
  618 MB; cinderhold 314 / 114 / 109 / 18 / 498 MB; stormrook 328 / 118 / 115 / 18 / 508 MB. The clutter is merged into
  the chunk meshes, so the arrival frames' draws did not move (cinderhold 291, skyrend 309, stormrook 328).
- The bake: `bake --surface cinder_ash_soil --surface lava_glow` rewrote `materials.manifest.json` with only those two
  surfaces (the README says partial bakes merge); a full `bake` restored it (unchanged surfaces bake byte-identical).

## `form_rage` VFX (2026-10-08)

- The 49th `VfxId` (`VFX_FORM_IDS`): hollowmane's rage form — 180 crimson pixel shards bursting outward, 120 red
  streaks torn upward, a two-ring shockwave; `flash: 1`, `beaconPulse: 1`, chroma 0.016 / 160 ms, 1 100 ms. Played by the
  client's `formChange` timeline; the sprite swap itself is `Stage.setBattler` with the form's descriptor (same id,
  new frames → the billboard is replaced in place).

## Move motion styles: 14 `style_*` VFX (2026-10-08)

- `VfxId` gains `style_${MoveStyle}` (14: slash, bite, punch, tackle, beam, orb, wave, rain, erupt, spray, bolt, spin,
  shard, gust; `MOVE_STYLES`, `VFX_STYLE_IDS`; 63 ids). Recipes in `stage/vfx.ts` `styleRecipe` draw their phases in
  'type' (the spawn type's colour from the stage's table, colourblind palettes included) and 'type2' (`TYPE_ACCENT`, the
  type's light / dark accent). `spawn` / `spawnRecipe` / `BattleStage.vfx` take an optional `type`: a recipe with its
  own type (`type_*`) keeps it, one without (`style_*`) uses the passed type (default Normal).
- Three emission motions, CPU-side only (the shader integrates them like every other): `sweep` (a diagonal arc across
  the target in the plane facing the attacker, born in order — a slash), `jaw` (two rows above and below the target
  closing on it within their life — a bite), `trail` (spaced along from → to, born in order — a ground wave). The line's
  horizontal direction and its right hand are computed per phase (`_d`, `_r`; no allocation).
- Tuned once against the harness battle (WebGPU, CDP): bite, slash, rain, erupt, bolt, shard and gust were too faint
  at the battle camera's distance — bigger cards, lower spawn heights (rain 2.4 m, bolt 2.6 m), more intensity.

## Broadcast UI (2026-10-11)

`hud/layer.ts` restyled to the "Broadcast" direction (`.screenshots/ui-revamp/BROADCAST.md`). Public API, `HudModel`,
regions, dirty bits, clipping, bar placement (anchoring, reserved boxes, collisions, bottom inset), the HP tween and the
chat fade are unchanged; `tick` still allocates nothing.

- Palette mirrored from the client tokens (render may not import the client): black `#0d0d0f` / carbon `#18181c` slabs
  at 0.92 over the world, paper `#f5f3ee` text, fog `#a3a3ad` labels, `#2a2a31` bar tracks, ONE orange `#ff5b1f` only
  for the lead party card's ring, the prompt's key chip, the turn chip, the zone banner's edge block, the OBJECTIVE
  strip and the in-battle nameplate edge. HP: paper > 50 %, amber `#ffb020` > 20 %, red `#ff4b3e` below. No green left
  (the old `#5fd068` HP, `#b8e0a8` guild tag, `#9fd3ff` chat names, `#ffd97a` targets are gone).
- Type: names, numbers, labels and the zone name in the display face (the client's `setFonts` display string), weight
  800, uppercase (cached per string: no per-redraw allocation), italic for names / the zone / the turn chip; running
  text (chat lines) stays in the body face. Every font ≥ 14 px at uiScale 1 (the `hud.test` floor). Tabular numerals
  now advance by the widest digit (Barlow's digits are proportional) and stroke every outline before any fill, so a
  digit's outline no longer eats its neighbour.
- Shapes (canvas paths, no `transform`/`setTransform`: the `Ctx2D` subset is unchanged): slabs with a 12° right cut,
  mirrored (left cut) for the top-right column; HP bars are 12° parallelograms; badges, status and shake markers are
  flat rectangles / squares; no rounded rects remain.
- Regions: party = 48 × 68 cards (neutral `#4a4a54` band, paper band for a variant — the model has no types —
  initials, HP % as a number or KO, skewed bar, status square, orange ring on slot 0). Zone = a centred lower-third: a
  paper "NOW ENTERING" tag strip (`HUD.zoneTagH` 22) over an orange edge block + black slab with the 48 px name
  (shrunk to fit the region); the region is 78 px tall (was 72; still clear of the connection pill at +96). Top-right =
  a clock slab (paper sun / crescent, DAY / NIGHT, hh:mm) and the quest hint as an orange OBJECTIVE strip + the hint
  uppercase, ellipsised to the 440 px column (cached). Chat = one slab per line fading with it, fog name, paper text,
  clipped to the column. Prompt = orange key chip + slab with the verb and the target (italic). Nameplates = one slab
  (fog guild tag inline before the name, no longer above it; orange left edge when in battle). Battle plates (240 × 52
  as before) = slab with a type-colour left edge, italic name, LV, skewed HP bar, type badges · status · stages left,
  HP numbers right (own side); turn label = orange skewed chip; orb shakes = paper / dark squares. Connection = slab
  with an amber / red edge. Dev = carbon panel.
- `HUD.badgeH` 18 → 16 (flat badges sit inside the plate's bottom row). Badge ink: whichever of black / paper has the
  higher contrast on the type colour (black above L ≈ 0.18; was paper below L 0.45, which put paper on Fire at
  2.9 : 1); every §10.4.6 colour now gets ≥ 4.2 : 1. Colourblind tables still flow through `setTypeColors`.
- Tests: `hud.test.ts` expectations that matched drawn strings now expect the uppercase forms ('MIRE ROUTE', 'TABLET',
  'ROWAN', 'TURN 1'); nothing else changed.
- Spec text now out of date (lead to amend): §10.9 "2 px dark outline under every glyph over the world" (glyphs now sit
  on 0.92 slabs; the outline is kept but no longer the legibility device), "centre-top display face 48 px" (now a
  lower-third with a tag strip), the badge description (flat rectangles, contrast-chosen ink, 16 px); §20.6 comments
  ("48 px thumbs" are 48 × 68 cards; the prompt reads "E · TALK TO FENKEEPER" in caps).
- **Type icons on the battle plates** (2026-10-11, the user asked for icons instead of letter codes): a badge is a
  flat type-colour square with the type's icon (`hud/typeIcons.ts`, the client's `ui/typeIcons.ts` verbatim) stroked
  in the luminance-chosen ink; one cached `Path2D` per type (built on first use, nothing per frame). Surfaces without
  `Path2D` or `translate`/`scale` (the node test fakes) fall back to the 3-letter name.
- **Creature sprites in the party cards** (2026-10-11, the user: "i want to see my ewamon sprites here"): each card
  (now 56×76, was 48×68) draws the species' 128 px WebP front thumbnail — the same file the client's DOM uses,
  `/creatures/thumbs/<id>_front.webp` — pixel-crisp (`imageSmoothingEnabled = false`), contained in the card's top
  40 px, with the HP % and bar below. One fetch + `createImageBitmap` per species on first ask; the party region is
  re-marked dirty when it lands; initials until then or when the file is missing. Nothing loads without
  `createImageBitmap` (node tests). Bitmaps are closed on `dispose`.

## Battle-form auras (2026-10-11)

The user asked that a Majin / Tenjin form be recognisable by an aura that moves in the game, not one drawn into the
sprites (`.design/majin-tenjin.md` §8; SPEC §10.7.5 "Battle-form auras").

- `stage/aura.ts` `AuraSystem`, owned by `Stage` (`stage.aura`): 4 slots (every doubles position), each a flames
  `Sprite` (192 particles) and a sigil `Mesh` under the stage root, built at construction and hidden while idle. One
  shared `PointsNodeMaterial` and one shared `MeshBasicNodeMaterial`; the per-slot values (feet, the camera's right
  and back, card size and kind, level, a seed) are read through `userData(...)`, so an aura never builds a program.
  Both materials are in the step-8 warm-up (`wiring.ts` `warmupObjects`).
- The loop costs no CPU: each particle's age is `fract(clock / cycle + seed)` on the VFX clock (static seeds in one
  instanced attribute). Per frame the CPU writes the slot's anchor (the posed card's world position + lift, so a lunge
  carries the aura), its fade level and the billboard's rim colour.
- Rim: `CreatureBillboard.setRimColor(r, g, b)` writes the per-object `typeColor` (the rim term's colour) with an HDR
  value; `refreshTypeColor()` restores it when the aura ends or the billboard changes hands.
- Stage hooks: `setBattler` passes `desc.aura` (a new billboard under the same ref takes the slot and fades in; the same
  creature re-set keeps its level), `faint` and `syncFrom` with hp 0 end it, `undress` clears all, `dispose` disposes.
- Tuning measured in the sandbox over CDP (WebGPU): a crimson with any blue turned pink under bloom + ACES, so Majin
  runs orange-hot (1, 0.13, 0.01) → blood red (0.72, 0, 0) with no blue; Tenjin's first white streaks were warmed to
  gold and shortened (rise 0.62 → 0.42 of the height). A first fade bug (`target > level` stepped a full aura back
  down every frame) is covered by the "same creature re-set keeps its level" assertion.
- Like every VFX it never writes `mask.y = 1`, so a far battler's flames are softened by the DOF while the creature
  stays sharp. That's acceptable (the sigil and rim carry the read), and it's noted in case a review wants them sharp
  (a mask write would also sharpen the floor behind every flame texel).
- Sandbox: `?demo=battle&mine=thornback&foe=hollowmane_rage&mineAura=tenjin&foeAura=majin`, `__ewaSandbox.part3.aura(side, kind | null)`.
- `majin_gold` (zenryu's Super Saiyan Majin form, the user's choice of a gold aura): kind index 2 in the same shared
  materials (no new program). Majin motion and sigil; flames orange-gold → amber, rise 0.55, × 1.4 size, outward 0.04;
  sparks are electric-blue streaks; rim gold. The first pass (cream 1, 0.92, 0.5) read pale under bloom; saturated to
  (1, 0.8, 0.18) → (1, 0.5, 0). Sandbox: `&mine=zenryu&mineAura=majin_gold`.

## `form_tenjin` — the Tenjin Form's burst (2026-10-11)

- A 64th `VfxId` (`contracts.ts` union, `VFX_FORM_IDS = ['form_rage', 'form_tenjin']`, `VFX_TABLE`): the Tenjin
  Form's transformation burst, the opposite of `form_rage` (`.design/majin-tenjin.md` §8). A whole gold ring opening
  at the feet (2 ring cards, 1 → 3.2), a slower white-gold inner ring (delay 0.15), 140 gold star motes rising
  straight up (gravity −2.2, slow, drag 0.4), a white-gold star card at the chest, `flash` 0.45 (soft; rage is 1),
  `beaconPulse` 0.7, no chroma, 1 100 ms default. Same pooled emitters, no new program.
- `form_rage` stays the Majin burst (the client plays it for form ids `rage` and `majin`).
- `test/stage.test.ts`: 63 → 64 ids; the form block is `['shiny_sparkle', 'form_rage', 'form_tenjin']` before the 14
  styles. SPEC §10.7.5's VfxId union needs `'form_tenjin'` (the lead amends it).
- Not tuned live: the colours follow the Tenjin aura's (gold that survived bloom + ACES in the aura pass), but the
  burst was not looked at in the sandbox or a battle.

## Arena backdrop — the PvP stadium (2026-10-11)

PvP battles leave the overworld: the client unloads the zone and fights in a dedicated venue. `stage/arenaBackdrop.ts`
`createArenaBackdrop(): ArenaBackdrop` (`{ root, update(dtSeconds), dispose() }`) builds a stadium bowl round a ring
dressed at the world origin; the client adds `root` to the scene and registers it with `setZoneRoot(root)` so it gets
the normal sun / hemisphere / CSM / fog, then `stage.dress({ x: 0, z: 0 }, ARENA_BACKDROP.terrain, …)`.

- **Shape follows the battle camera.** The camera orbits the ring centre at −28° pitch (FOV 28°), 12–22 m out
  (+3 m on the `wide` cue, −2.5 m on a push), i.e. always on the cone h = r·tan 28°. The 18 tiers are laid on that
  slope (0.85 m deep, 0.452 m rise) behind a 1.1 m parapet at r 6.6 m, so the crowd's heads stay ~2 m under every camera
  position over them; the concourse / back wall (r 24) and the canopy underside (13.4 m) stay outside / above the
  farthest camera (r 22.1, h 11.7). Everything is rotationally symmetric, so any diorama heading and every cue orbit is
  clear. Inside r 6.6 the floor is flat and empty (ring, curb, posts, pylons 4.7 m, trainers 4.45 m, the stage's
  spectators 5.9 m stand on it).
- **What the battle camera actually sees**: with a 28° FOV at −28° the frame's top edge looks ~16° down, so at the
  usual 13 m framing the world visible behind the far battler ends ~9 m past the centre. That is why the parapet sits
  at 6.6 m (not further out): its LED ribbon + orange line run along the frame's top edge, with crowd at the top
  corners; the full bowl reads on wider shots, the pre-battle view and cut-aways. A client that wants more stadium in
  frame needs a different camera (e.g. a shallower pitch) — not changed here.
- **Look** (Broadcast): carbon surfaces (vertex colours), paper-white floor markings (a line round the curb, a tick
  crown, an outer line), grey aisle nosings, one hot orange (`#ff5b1f`) only on the parapet's light line, the ribbon's
  chevrons and the screens' centre mark; no green (crowd shirts are greys / paper / blues / deep reds / ochre). The
  floor is a polished dark slab with fwidth-antialiased seams (TSL, no texture). LED ribbons (parapet + back wall) scroll
  paper slabs; four back-wall screens show a slanted broadcast card with a sweep; a light ring under the canopy; four
  floodlight masts with lamp grids.
- **Crowd**: one `InstancedMesh` (1 854 seated figures, 44 tris each; legs / torso / head by a vertex attribute,
  shirt colour + phase and skin per instance as `InstancedBufferAttribute`s). Bob and a wave rolling round the bowl
  (~8.4 s a lap) run in `positionNode` on one time uniform; `update(dtSeconds)` only advances it (wraps hourly). Pass
  the scaled frame time so hitstop freezes it.
- **Budget**: 5 meshes / 5 materials / 5 beauty draws; the structure is the only shadow caster (sun cascades). Measured
  in the sandbox (WebGPU, Intel Gen-12): +5 beauty draws, +11 total; 106 k triangles (82 k of them the crowd); no textures, no punctual lights
  (the stage's two beacons + emissive strips under bloom light it). Works on the WebGL2 fallback (standard node
  materials, instanced attributes, no compute).
- **Exports**: `ARENA_BACKDROP` (dimensions, `terrain: 'forge'`, `timeOfDay: 21.5 / 24`), `ARENA_COLORS`,
  `ARENA_LIGHTING` (a neutral night-venue `LightingPalette`) and `ARENA_GRADE` (neutral `GradePalette`) for the host's
  `setLightingPalette` / `setGrade` while no zone is loaded (otherwise the last zone's sky / fog / grade stay),
  `ARENA_CAMERA_MAX_DISTANCE`, `crowdSeats`, `tierFront`, `tierY`.
- **Sandbox**: `?demo=arena` (no zone; the backdrop as the zone root, `ARENA_LIGHTING` + `ARENA_GRADE` unless
  `&palette=0`, 21:30 unless `&t=`); the `?demo=battle` controls (`&mine=`, `&foe=`, `&auto=0`, `&panel=0`) plus
  `&terrain=` and `&h=0..3`. `window.__ewaArena` is the backdrop.
- **Tests** (`test/arena-backdrop.test.ts`, node): builds without a GPU (5 meshes, one instanced crowd, node materials,
  < 200 k tris, one caster, no lights); nothing above the floor inside the parapet and the stage's dressing fits inside
  it; the camera → battler corridor (24 headings × every cue orbit × push-in … widest framing, singles + doubles, feet
  and 3 m tops) stays ≥ 0.3 m over the crowd at the top of the wave and under the canopy; the tiers follow the camera
  cone; `dispose` frees 5 geometries + 5 materials once, detaches the root, is idempotent.
- Not in the SPEC yet (the lead amends §10.7 if the arena stays).
- **`zoneRoot()` and a disposed zone** (2026-10-12): the disposed handle stays in the host's `zone` until the next
  `loadZone`, and `zoneRoot()` returned its (detached) group, so `setZoneRoot(backdrop)` never took effect (stats,
  probe, `dumpZone`, the opaque budget toggle missed the stadium). `currentZoneRoot(zone, external)` now skips a
  disposed handle (tested in `arena-backdrop.test.ts`). The white world after leaving the arena was not render's: see
  the client notes, "Arena PvP" (the zone load predicted its first view at the zone's spawn).

## Zone sculpts (2026-10-20)

- Draws content's sculpted zones (SPEC §10.5.5 amended): `bridgeSteps` (plank deck, fascias down past the waterline,
  posts, rails, segment by segment along the deck centreline; a crossing inside the set-piece extent is skipped, the
  set-piece draws it), `cragSteps` (a faceted `buildRock` sized to each cliffed round lift, seated on the lowest ground
  round its foot), `structureSteps` (curtain-wall blocks with merlons, palisade stakes, `tower()` on its mound; nothing
  where the crest was cut down by a road, so gates stay open) and a `cliff_rock` scatter kind (boulders on every slope
  over 1.1, walk-through: they stand on unwalkable samples).
- Scatter mirrors content's new solid rules exactly (`slopeAt` / `SCATTER_MAX_SLOPE`, `wetNear`, `roundBody`):
  `client/test/footprints.test.ts` passes unchanged. Non-solid scatter (bushes, flowers, tufts, stumps, cover, margin
  trees and rocks) also keeps off the water mask, so nothing grows in a river or the sea.
- `layoutOf` adds `corridor(x, z)` (distance to the sculpted road, replacing `|z - roadZ(x)|` in the tree acceptance),
  `bridges`, `crags`, `structures` and `field`; the splat paints a broken shore band from the water mask round rivers,
  lakes and seas (`SplatContext.wet`), circles only round ponds (a river's area-equivalent circle had painted a dirt disc).
- Cinder water is drawn `lava_glow` (the ash ravine's lava, Cinderhold's lava lake).
- New prop builders `buildTent`, `buildCampfire` (`PROP_BLOCKER` 1.3 / 0.7 = content's table).
- Sandbox: `&far=<m>` sets a survey camera distance beyond the zoom stops (shape checks only; fog and DOF still apply).
- The deprecated `planLayout` no longer equals content's plan (sculpts are content-only); the harness anchors use
  `layoutOf(spec)` now, and its equality test is gone.

## Honor shapes the world (2026-10-20)

- `Renderer.setShadow?(level)` (optional so the fakes keep compiling) → `DayCycle.setShadow`: the shadow multiplies
  the sun, the hemisphere fill, the environment and the fog density and tints the fog after the weather's tint
  (`shadowParams`, pure). Level 0 is the identity, so a clear zone renders exactly as before.

## Majin vs Tenjin seasons (2026-10-20)

- `Renderer.setSkyMood?` → `DayCycle.setSkyMood` → `SkyController.setMood` (turbidity offset and rayleigh scale on
  both sky meshes, after the harvest blend), a sun and hemisphere tint (the diorama camera looks down, so the sky
  alone barely shows: checked live, the light is what reads), and a fog tint scaled by daylight so a red or gold haze
  does not glow at night. null is the identity.

## World effects: footsteps, prints and grass that makes way (2026-10-21)

SPEC §10.7.8. `worldfx/` (`WorldFx`, built in `stage/wiring.ts` with the part-3 bundle and updated right after the actor
pool; `Part3.worldFx`).
- `ZoneHandleImpl` carries `spec` and `splat` (the builder's own `SplatContext`), so the ground a foot lands on is
  classified from exactly what the terrain was drawn from. `CharacterPool.forEachWalker` hands out the rigs' own
  vectors (slot, feet, ground normal, measured speed, yaw, camera distance²), allocation-free.
- TSL scoping, measured in the WGSL: a node shared between `select` branches is emitted inside the FIRST branch that
  uses it. The particles' age (for the leaf's spin) was built in the leaf branch and read uninitialised by every other
  shape, so the fade was 0 and every particle was discarded. The life fraction and the spin are `varying`s now
  (computed once per particle in the vertex stage).
- The particle colour node is premultiplied by hand (glow 1 = additive, coverage 0): `premultipliedAlpha` stays false,
  or three multiplies by alpha a second time and every puff turns into a dark smudge. The discard is on the coverage
  before the glow term (an alpha test would drop every additive texel).
- Lit particles take `light`: the day's key colour × (0.22 + 0.53 × daylight) plus a cool fill, about 3/4 of the
  sun-lit ground at noon (checked against the live sun / hemisphere intensities in the sandbox).
- The prints reuse the decal recipe (MultiplyBlending needs `premultipliedAlpha` on WebGPU, §10.4.7).
- Sandbox: `__ewaSandbox.renderer()` returns the renderer (shader dumps with `renderer.debug.getShaderAsync`).
- Grass: `SharedUniforms.push` (4 × vec4, `ewaPush0..3`) is an addition to the verbatim §10.2.3 interface, optional like
  `occlusion`. `WindParams.push` is a per-material uniform on every card (1 only for `tall_grass`), so the card
  program count is unchanged; scatter's attribute instancing runs before `positionNode`, so `pushDisplace` works on
  the instanced (zone-frame) position and the shadow pass bends the same way. The existing `GroundCoverReveal`
  (creature reveal discs through `ScatterMask`) is untouched: the push is a vertex bend, the mask a per-instance scale.

## World effects: ambient motes (2026-10-21)

- `worldfx/ambient.ts`: one `Sprite` of 720 motes, two layers selected per instance (`extra.z`), each layer's look in
  uniforms (colour pair, drift, density / size / alpha / glow, wander / blink, height band). Positions are pure
  functions of seed and clock in the vertex stage; alpha, glow and colour are `varying`s (the TSL first-branch rule
  of the footsteps entry). Density is a per-mote threshold (`extra.x < density`), so thinning hides motes instead of
  fading all of them.
- `FrameHook` gains `setWeather?`, `setShadow?`, `setSkyMood?`, `setAmbient?`; the host forwards its own setters to every
  hook, and `Renderer.setAmbient?` exists only to reach them (the client turns the air off in a pocket).
- Honor has no "lit" level (shadow 0..4 only), so a clear zone shows its biome air; the season's sky mood is the bright
  counterpart (red or gold motes over Solenne).

## World effects: cloud shadows and light shafts (2026-10-21)

- Cloud shadows multiply the albedo (`colorNode`), so they dim the sky fill as well as the sun: stylised, and with
  no extra light term it costs two noise lookups per fragment and no program. Billboards and the character material
  are not shaded (their own graphs); a creature in a cloud shadow keeps its light, which read fine in the sandbox.
- The shafts' block of cells is centred on the focus's cell, so the outer ribbons jump when the focus crosses a cell
  boundary; they sit beyond the 16 m fade, where they are already invisible.
- Checked live in the sandbox (Mire Route: a cloud edge over the road at noon; shafts at 18:30).

## World effects: weather on the ground, heat haze (2026-10-21)

- Frost first read as a snowfield (whole route white, grass too) and then as camouflage blobs (a coarse noise with a
  narrow edge); the shipped rime is a fine grain (4.5 / m) shaped by a soft coarse field, at most half white, on
  upward faces only. Checked live under hail on Mire Route; rain shows puddles and mud prints there.
- Heat haze samples `beautyT` at an offset uv instead of reading it in place; GTAO, TRAA and the rest take that as their
  input. The offset is multiplied by `1 − mask.y` so the sharp player never wobbles. Velocity and depth stay
  unshifted (the shimmer is ≈ 2 px, below anything TRAA reprojects visibly).

## World effects: water that lives (2026-10-21)

- Foam and caustics come from the water mesh's `depthBelow`, never from a depth-buffer read (§10.5.6 keeps the water
  graph free of one). The first pass read wrong live on Tide Route: a solid white strip along the shore (0.45 m band on
  a gentle beach is metres wide) and a caustic web over the whole shallow sea; the shipped values are a 0.28 m band
  that breaks into a lip and washing lines, and caustics at 0.16 gain over 1.8 m.
- `GroundSource.surfaceY` (the collider's water level) places the fish on the surface; `FishShadows` picks loop centres
  with its own seeded mulberry32 and tests the whole loop for open water.

## Hit weight: the hurt pose and the ghost of lost HP (2026-10-21)

- `POSES.hurt` gained a squash and a rebound and a firmer knockback (260 ms); `sprites.test.ts` follows the new keys.
- The HUD's ghost shares the HP tween's repaint clock, so it adds no faster cadence; `hud.test.ts`'s 30 Hz check now
  spans the tween and the drain. The ghost only draws above the target value: a heal tweens the fill up with no ghost
  ahead of it (caught by `hud-ghost.test.ts`).

## Creatures that sit in the light (2026-10-21)

- The sun rim reads `ctx.lighting.sun` (colour × intensity ÷ the SPEC light unit), not the day table, so the weather's
  sun multiplier, honor's shadow and the season's sky colour all reach it. At 0.9 the backlit white creatures bloomed
  into blobs (Mire Route at 17:30, the camera facing the sun); 0.45 with a thinner edge (power 3.4) keeps a warm halo.
- The rim is masked by the card's alpha cut, so it never lights a transparent texel; the foot shade multiplies the
  albedo only (not the glow), between `footV` and `footV + 0.16` of the card's uv.

## First-person view (2026-10-22, not in the SPEC)

- `CameraRig.setFirstPerson(view | null)` (contract addition): with a look (the diorama yaw convention — forward is
  (−sin yaw, −cos yaw) — and pitch, clamped ±80°) the `DioramaRig` puts the eye at the followed feet + 1.2 m, 0.4 m
  in front of the body's axis (the chibi rigs are 1.54 m tall, 0.70 m deep: just in front of the face), with a 70° /
  near 0.08 m lens; null restores the diorama lens. Only the diorama pose of a followed actor: a battle / inspector shot
  ignores it. The shake keeps its diorama angle (computed at the default zoom distance, not the 1.4 m eye distance).
  `BasicDioramaRig` ignores it. While the followed body breakdances (`DioramaRigOptions.bodyTilt` →
  `CharacterPool.bodyTilt`) the eye rides it: the eye offset and the look are turned by the root's rotation relative to
  its upright facing, from the root's lifted position, so the view spins, flips and hangs upside down with the dance
  (last frame's body pose: the camera updates before the pool). A hidden body still poses while it dances.
- `ActorPool.setHidden(id, hidden)` (contract addition): hides one actor's body (its feet, decal and nameplate anchor
  stay); `spawn` resets it. The client hides the player's own body in first person.

## Breakdance (emote 7, 2026-10-22, not in the spine)

- `EmoteId` is 0..7: emote 7 plays for `BREAKDANCE_MS` (6 s; `emoteMs(n)`, the other emotes keep 2 s) as a procedural
  pose (`EMOTE_POSES[7] = 'breakdance'`, `poseBreakdance`): toprock, windmill, headspin, air flares and a freeze
  (`BREAKDANCE` numbers). The rigs have no dance clips, so the root lifts, tilts (Euler order YXZ) and spins per phase
  and the limbs are aimed in root space after the mixer. The frame start now writes `root.rotation.set(0, yaw, 0)` so a
  tilt never outlives the dance. Like every emote it yields to walking. The HUD card shows 🔥.
- `ActorPool.setHop(id, ms)` (contract addition): the actor hops in place (`HOP`), for villagers dancing along.

## Quality presets (2026-10-23, not in the SPEC)

- `quality.ts`: `GraphicsQuality` `'low' | 'medium' | 'high'` and `QUALITY_PROFILES`. `high` is the SPEC (pixel-ratio cap
  1.5, 4 × 2048² sun cascades, GTAO 16 spp, DOF, bloom). `medium`: cap 1.25, 4 × 1024², GTAO 8 spp. `low`: cap 1,
  4 × 1024², no GTAO, no DOF, no bloom (TRAA, the grade, grain and chroma stay; the user's toggles still apply on top).
- `RendererOptions.quality` (default `'high'`, so tests and harnesses see the SPEC graph) and `Renderer.setQuality(q)`
  (contract additions). `'auto'` resolves through `recommendedQuality(caps)`: `low` on an integrated Intel adapter
  (`isIntegratedIntel`: WebGPU `intel <arch>` or an ANGLE string; Arc / `xe-hpg` excluded), `medium` on the WebGL2
  fallback, else `high`. `RenderCaps.adapter` is now the GL `RENDERER` string on WebGL2 (was always null).
- Live switching: the pixel-ratio cap goes through `clampPixelRatio(requested, cssWidth, cap)`; the sun cascades through
  `LightRig.setSunShadowMap` (the CSM cascade lights' `mapSize`; `ShadowNode.renderShadow` re-sizes from it every update,
  no recompile); the post graph through `PostStack.setQuality` → `planPostGraph(f, backend, passes, quality)` (a rebuild
  only when the plan changes).
- Measured in the sandbox (`&quality=`, `__ewaSandbox.setQuality`), mirevale at 1440 × 900 CSS, DPR 2, headless Chrome on
  an M2 Max, median whole-frame GPU ms: high 228, medium 163, low 41; texture memory 583 → 192 MB, render targets 36 → 14.
  Bloom alone was ~50 ms of low's ~95 before it was dropped (its mip chain is a dozen passes; quarter resolution barely
  helped), so `low` turns it off rather than shrinking it.
