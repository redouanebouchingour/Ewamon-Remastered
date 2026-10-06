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
