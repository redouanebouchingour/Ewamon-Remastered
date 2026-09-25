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
