# EWAMON REMASTERED — SPEC §10: @ewa/render

**Status:** BINDING, subordinate to `00-spine.md`. Where this file and the spine disagree, the spine wins. Where a higher-numbered section (`20-client.md`, `30-server-netcode.md`, `50-verification-budget.md`) names a render symbol, this file is the definition; the reconciler adjusts their consumed-surface lists to the names here, never the other way round (`20-client.md` §20.4.1 states the same rule).

Inputs: `00-spine.md` §1 (the eight pillars, each with its acceptance test), §3.1 `ZoneDef`, §3.7 `VARIANT_PALETTES`; `PLAN.md` (rendering architecture, frame budget, the harvested-zone mechanic); `20-client.md` §20.4.1 (consumed surface), §20.4.4 (`zoneSpecFor` field mapping), §20.6 (`HudModel`), §20.8.2 (`EffectsFlags`); `30-server-netcode.md` §30.2.3 (`Heightfield`, decided to live in `@ewa/content`); `50-verification-budget.md` §50.2 (`BudgetProbe`, per-pass table, count caps) and §50.4.6 (render tests, asset-audit rules); `eslint.config.js` (`ewa/render`: `three` only — no `@ewa/*`, no react, no node builtins); the legacy `world3d-data.js` `TYPE_COLORS` and `liveOps.js` `VARIANT_PALETTES`.

Every library symbol below was read from `packages/render/node_modules/three@0.186.0` and `@types/three@0.186.0`, not from memory. Import paths as resolved by `three/package.json` `exports` (`"./webgpu"`, `"./tsl"`, `"./addons/*"` → `examples/jsm/*`):

| Symbol | Import | Verified fact |
|---|---|---|
| `WebGPURenderer` | `three/webgpu` | `new WebGPURenderer({ forceWebGL, antialias, alpha, depth, stencil, outputBufferType, powerPreference, trackTimestamp })`; `await renderer.init()`; `renderer.backend.isWebGPUBackend` / `isWebGLBackend`; `renderer.info.render.{drawCalls,triangles,timestamp}`, `renderer.info.memory.{geometries,textures,texturesSize,programs,renderTargets,attributes,attributesSize,total}`; `resolveTimestampsAsync(TimestampQuery.RENDER)`; `shadowMap.enabled`, `shadowMap.transmitted`; `compileAsync(scene, camera)`. `trackTimestamp` is a `WebGPUBackend.js` `@property` missing from `WebGPUBackendParameters` in the `.d.ts` — passed through one typed cast in `renderer.ts` (as `50-verification-budget.md` §50.2.3 already states) |
| `RenderPipeline` | `three/webgpu` | `new RenderPipeline(renderer, outputNode?)`; `outputNode`, `outputColorTransform`, `needsUpdate`, `render()`, `dispose()`. `PostProcessing` is a deprecated alias since r183 and is not used |
| `PMREMGenerator` | `three/webgpu` | `fromScene(scene, sigma = 0, near = 0.1, far = 100, { size = 256, position, renderTarget })`; `dispose()` |
| `pass`, `mrt`, `output`, `normalView`, `velocity`, `renderOutput`, `acesFilmicToneMapping`, `screenUV`, `uniform`, `texture`, `triplanarTexture`, `hue`, `saturation`, `luminance`, `vertexColor`, `userData`, `time`, `hash`, `mx_noise_float`, `positionWorld`, `positionView`, `positionGeometry`, `normalGeometry`, `normalWorld`, `cameraPosition`, `cameraProjectionMatrixInverse`, `getViewPosition`, `fog`, `densityFogFactor`, `smoothstep`, `mix`, `select`, `Fn`, `If`, `Discard`, `float`, `vec2`, `vec3`, `vec4`, `color` | `three/tsl` | `PassNode.setMRT(mrt({...}))`, `getTextureNode(name = 'output')`, `getViewZNode(name = 'depth')`, `getLinearDepthNode`, `setResolutionScale`; `MRTNode.merge` merges a material's `mrtNode` into the pass MRT (`NodeMaterial.js` line 564–574); `renderOutput(color, toneMapping = null, outputColorSpace = null)`; `hue(color, radians)` (rotation about `(0.577, 0.577, 0.577)`, verified in `ColorAdjustment.js`); `triplanarTexture(texX, texY?, texZ?, scale = 1, position = positionLocal, normal = normalLocal)`; `userData(name, type)` reads `object.userData[name]` per render object |
| `ao` (`GTAONode`) | `three/addons/tsl/display/GTAONode.js` | `ao(depthNode, normalNode, camera)`; uniforms `radius`, `thickness`, `scale`, `samples`; `resolutionScale`; `useTemporalFiltering`; `getTextureNode()`; `distanceExponent`/`distanceFallOff` deprecated since r186 (not set) |
| `traa` (`TRAANode`) | `three/addons/tsl/display/TRAANode.js` | `traa(beauty, depthTextureNode, velocityTextureNode, camera)`; "MSAA must be disabled when TRAA is in use" |
| `bloom` (`BloomNode`) | `three/addons/tsl/display/BloomNode.js` | `bloom(node, strength, radius, threshold)`; uniform `smoothWidth` (default 0.01); `setResolutionScale`; 5 mips fixed |
| `dof` (`DepthOfFieldNode`) | `three/addons/tsl/display/DepthOfFieldNode.js` | `dof(node, viewZNode, focusDistance, focalLength, bokehScale)`; CoC = `smoothstep(0, focalLength, |−viewZ − focusDistance|)`, split into near (`signedDist < 0`) and far fields; no mask input exists |
| `film`, `chromaticAberration` | `three/addons/tsl/display/{FilmNode,ChromaticAberrationNode}.js` | `film(input, intensityNode?)` mixes `base` with `base·(1 + noise)` by `intensity`; `chromaticAberration(node, strength, center = null, scale = 1.1)` |
| `CSMShadowNode` | `three/addons/csm/CSMShadowNode.js` | `new CSMShadowNode(directionalLight, { cascades, maxFar, mode: 'uniform'|'logarithmic'|'practical'|'custom', lightMargin, customSplitsCallback })`; `fade`; `updateFrustums()`; each cascade clones `light.shadow` (so `mapSize` is shared) with `bias × (i + 1)`; attached through `light.shadow.shadowNode` (read in `AnalyticLightNode.js` line 214) |
| `SunLight` / `SunLightShadow` | `three/addons/lights/SunLight.js` | **Not used.** `SunLightShadow` is "two cascaded shadow maps" (its own header); Pillar 4 requires 4 |
| `SkyMesh` | `three/addons/objects/SkyMesh.js` | uniforms `turbidity`, `rayleigh`, `mieCoefficient`, `mieDirectionalG`, `sunPosition`, `cloudCoverage`, `cloudDensity`, `cloudScale`, `cloudSpeed`, `cloudElevation`, `showSunDisc`; node-material sky (the `Sky` class is the WebGL one) |
| `KTX2Loader` | `three/addons/loaders/KTX2Loader.js` | `setTranscoderPath(path)`, `detectSupport(renderer)` (after `renderer.init()`), `loadAsync`, `dispose()`; transcoder files `basis_transcoder.js` + `basis_transcoder.wasm` in `three/examples/jsm/libs/basis/` |
| `MeshStandardNodeMaterial`, `MeshPhysicalNodeMaterial`, `MeshBasicNodeMaterial` | `three/webgpu` | node slots `colorNode`, `normalNode`, `emissiveNode`, `roughnessNode`, `metalnessNode`, `aoNode`, `positionNode`, `castShadowPositionNode`, `maskShadowNode`, `alphaTestNode`, `mrtNode`, `outputNode`; physical adds `clearcoatNode`, `clearcoatRoughnessNode`. Shadow pass (`Renderer.js` `_getShadowNodes`): uses `castShadowPositionNode` else `positionNode`; multiplies shadow alpha by `map.a`/`colorNode.a`; discards where `maskShadowNode`/`maskNode` is false |
| `SpriteNodeMaterial` | `three/webgpu` | **Not used for creatures** — it is unlit (`NodeMaterial` with sprite defaults); Pillar 5 needs a lit surface. Used for nothing in v1 |
| `InstancedMesh`, `LOD`, `PlaneGeometry`, `LatheGeometry`, `ExtrudeGeometry`, `OrthographicCamera`, `CanvasTexture`, `DirectionalLight`, `SpotLight`, `PointLight`, `HemisphereLight` | `three/webgpu` | `LOD.addLevel(object, distance, hysteresis)`; `CompressedTexture.generateMipmaps === false` by default, `flipY === false` |

---

## §10.0 SCOPE, LAYOUT, NON-NEGOTIABLES

10.0.1 `@ewa/render` draws what it is told. It receives **descriptors** (plain data: `ZoneSpec`, `SpriteDescriptor`, `LightSource`, `HeightfieldData`) built by `@ewa/client` from `@ewa/content`, and never sees a `SpeciesDef`, a `ZoneDef`, a `BattleState` or a socket. It contains no game rule. Its only dependency is `three`.

10.0.2 File layout, `packages/render/src/`:

| File | Owns |
|---|---|
| `index.ts` | Re-exports exactly the symbols named `export` in this file |
| `renderer.ts` | §10.1 `createRenderer`, `createZoneView`, pixel-ratio policy, resize, dispose |
| `materials/library.ts`, `materials/surfaces.ts`, `materials/harvest.ts`, `materials/wind.ts`, `materials/triplanar.ts` | §10.2 |
| `lighting/rig.ts`, `lighting/sky.ts`, `lighting/daycycle.ts`, `lighting/fog.ts` | §10.3 |
| `sprites/billboard.ts`, `sprites/atlas.ts`, `sprites/typeColors.ts` | §10.4 |
| `zone/builder.ts`, `zone/generators/{grove,cinder,salt,storm,marrow,vesper,forge,sky,capital,shrine,rift}.ts`, `zone/scatter.ts`, `zone/lod.ts`, `zone/layout.ts` | §10.5 |
| `terrain/collider.ts`, `terrain/mesh.ts` | §10.6 |
| `camera/rig.ts`, `camera/battle.ts`, `camera/dof.ts` | §10.7 |
| `post/pipeline.ts`, `post/grade.ts` | §10.8 |
| `hud/layer.ts` | §10.9 |
| `stats.ts` | §10.10 |
| `stage/battleStage.ts`, `stage/actors.ts`, `stage/vfx.ts` | `BattleStage`, `ActorPool`, the VFX id table (§10.7.5) |

`layout.ts`, `lod.ts` and every `descriptors` type are pure TypeScript with no `three` object construction, so `50-verification-budget.md` §50.4.6 `dispose-contract.test.ts` can test them in node.

10.0.3 Non-negotiables of this file (in addition to the spine's):

1. **One `WebGPURenderer`, one `RenderPipeline`, one `Scene`, one `PerspectiveCamera` per `createRenderer`.** Zones, arenas and actors are children of that scene; nothing constructs a second renderer.
2. **No `Math.random`, no `Date.now`, no `performance.now` in any builder.** Every generator takes a `seed: number` and uses the `Prng` in §10.5.2. Two clients with the same `ZoneSpec` build byte-identical geometry (asserted by the snapshot test in `20-client.md` §20.4.4 plus the geometry digest in §10.5.9).
3. **Materials are shared instances from `MaterialLibrary`.** A builder never calls `new Mesh*NodeMaterial` outside `materials/`. `dispose()` of a builder never calls `material.dispose()` or `texture.dispose()` on a library object (spied in `dispose-contract.test.ts`).
4. **Every lit opaque material has three maps** (`map`, the ORM texture bound to `aoMap`/`roughnessMap`/`metalnessMap`, `normalMap`) from KTX2 files. No `CanvasTexture`, no `DataTexture`, no PNG reaches a lit material. Creature billboards (class `'billboard'`) are the one lit class whose maps are WebP (§10.4.1, `40-pipelines.md` §40.1.6) and the `'character'` class reads vertex colour with the placeholder ORM/normal (§10.7.7); both are exempt from `textures.ktx2Only`/`materials.threeMaps` by class, never by flag. The single `CanvasTexture` in the package is the HUD's (§10.9), on an unlit overlay excluded from `dumpZone()`. <!-- reconciled 2026-09-18 -->
5. **Zero per-frame allocation** in `frame()`, `CameraRig.update`, `ActorPool.setTransform`, `HudLayer.draw`, `CreatureBillboard.set*`. Scratch `Vector3`/`Matrix4`/`Quaternion` are module-level.
6. **The harvested look is a uniform, not a code path** (spine §1, last paragraph). `setHarvestLevel(l)` writes one `uniform` read by every library material and every billboard; it constructs and disposes nothing.
7. **Effects flags remove passes, not just zero them.** `setEffects` rebuilds the pipeline graph so a disabled pass costs 0 ms; §10.8.4.
8. **Every `dispose()` is idempotent** and returns `renderer.info.memory` to the pre-load baseline exactly (§10.5.9, spine-level leak test).

---

## §10.1 RENDERER HOST

### 10.1.1 Public surface (verbatim)

```ts
import type { WebGPURenderer, Scene, PerspectiveCamera } from 'three/webgpu';

/** From 20-client.md §20.4.1, verbatim. */
export interface EffectsFlags {
  readonly dof: boolean; readonly bloom: boolean; readonly grain: boolean; readonly chroma: boolean;
  readonly shake: boolean; readonly hitstop: boolean; readonly slowmo: boolean; readonly taa: boolean;
}

export interface RendererOptions {
  readonly canvas: HTMLCanvasElement;
  readonly pixelRatio: number;                 // requested; §10.1.3 clamps it
  readonly effects: EffectsFlags;
  readonly forceWebGL?: boolean;               // default false; test harnesses only
  readonly trackTimestamp?: boolean;           // default false; the budget harness passes true
  readonly transcoderPath?: string;            // default '/basis/'; where basis_transcoder.{js,wasm} are served
}

export type Backend = 'webgpu' | 'webgl2';

export interface RenderCaps {
  readonly backend: Backend;
  readonly timestampQuery: boolean;            // renderer.hasFeature('timestamp-query') on webgpu; false on webgl2
  readonly maxTextureSize: number;             // 8192 minimum required; createRenderer rejects below
  readonly ktx2: 'astc' | 'bc7' | 'etc2' | 'rgba8';   // KTX2Loader.workerConfig -> chosen transcode target
  readonly adapter: string | null;             // GPUAdapterInfo.description when exposed; null otherwise
}

export type WeatherKind = 'none' | 'sun' | 'rain' | 'sand' | 'hail';   // text-identical mirror of spine §2.5 (render may not import core)
export type HarvestLevel = 0 | 1 | 2;                                 // intact · thinning · harvested

export interface RenderStats {
  readonly drawCalls: number; readonly triangles: number;
  readonly textures: number; readonly textureBytes: number; readonly geometries: number; readonly programs: number; readonly renderTargets: number;
  readonly materials: number;                  // distinct Material.uuid under the zone root, debug layer excluded
  readonly shadowLights: number; readonly nonShadowLights: number;
  readonly gpuMs: number | null;               // last resolved whole-frame GPU ms; null without timestamp-query
  readonly passMs: Readonly<Record<BudgetPass, number | null>>; // filled only by the differential harness (§10.10.3); null in play
  readonly frameMs: number;                    // CPU ms of the last frame() call
}

export interface Renderer {
  readonly renderer: WebGPURenderer;           // the one three renderer
  readonly backend: Backend;
  readonly caps: RenderCaps;
  readonly scene: Scene;                       // zone root + arena + actors are children; the client never adds to it directly
  readonly camera: CameraRig;                  // §10.7
  readonly stage: BattleStage;                 // §10.7.5
  readonly hud: HudLayer;                      // §10.9
  readonly actors: ActorPool;                  // §10.7.6
  readonly materials: MaterialLibrary;         // §10.2 (read-only use by the client: stats, prewarm)
  loadZone(spec: ZoneSpec): Promise<ZoneHandle>;   // rejects if a zone is loaded and not yet disposed
  setTimeOfDay(t: number): void;               // 0..1; §10.3.5
  setWeather(w: WeatherKind): void;            // §10.3.7
  setHarvestLevel(l: HarvestLevel): void;      // §10.2.6
  setEffects(f: EffectsFlags): void;           // rebuilds the post graph; §10.8.4
  setPixelRatio(r: number): void;              // re-clamped by §10.1.3
  resize(cssWidth: number, cssHeight: number): void;
  setTimeScale(s: number): void;               // 1 normal · 0 hitstop · 0.35 crit slow-mo; scales every render-side animation
  frame(dtMs: number): void;                   // exactly one pipeline.render() + one HUD draw when dirty
  stats(): RenderStats;
  dispose(): void;                             // idempotent; after it, renderer.info.memory.total === 0 is asserted in tests
}

export function createRenderer(o: RendererOptions): Promise<Renderer>;
```

### 10.1.2 Construction sequence (the order is the contract)

1. `const gpu = new WebGPURenderer({ canvas, antialias: false, alpha: false, depth: true, stencil: false, forceWebGL: o.forceWebGL ?? false, powerPreference: 'high-performance', outputBufferType: HalfFloatType, ...(o.trackTimestamp ? { trackTimestamp: true } : {}) } as WebGPURendererParameters)`. `antialias: false` is required: TRAA (§10.8) forbids MSAA.
2. `await gpu.init()`. Rejection → `createRenderer` rejects with `RenderInitError('no-gpu')`; the client shows its static message.
3. `backend = gpu.backend.isWebGPUBackend ? 'webgpu' : 'webgl2'`. On `webgl2` the renderer still runs (three's automatic fallback), the post graph drops `traa` to `smaa` (§10.8.3) and `caps.timestampQuery = false`. Nothing else branches on the backend; the WebGL2 path is allowed to run and is not budgeted (`50-verification-budget.md` §50.3).
4. `gpu.toneMapping = NoToneMapping; gpu.outputColorSpace = SRGBColorSpace; gpu.shadowMap.enabled = true; gpu.shadowMap.transmitted = false; gpu.info.autoReset = true`. Tone mapping happens **in the post graph** (`acesFilmicToneMapping`, §10.8), never in the renderer, so bloom's threshold and the DOF mask are evaluated on scene-linear values.
5. `ktx2 = new KTX2Loader().setTranscoderPath(o.transcoderPath ?? '/basis/').detectSupport(gpu)`. `caps.ktx2` = `'astc'` if `workerConfig.astcSupported`, else `'bc7'` if `bptcSupported`, else `'etc2'` if `etc2Supported`, else `'rgba8'`. Below `maxTextureSize 8192` → reject `RenderInitError('texture-size')` (the MRT targets at the 3840-wide drawing-buffer cap need it; the largest asset texture is a 2048² sprite atlas, §10.4.1). <!-- reconciled 2026-09-18: atlases are 2048², not 8192² -->
6. `scene = new Scene()`; `camera = new PerspectiveCamera(28, w / h, 0.5, 220)` (Pillar 1: vertical FOV 28°; near 0.5 and far 220 are fixed — the far zoom stop plus the far LOD band fits inside 220 m).
7. Lighting rig (§10.3), sky + PMREM (§10.3.3), fog node (§10.3.7), post graph for `o.effects` (§10.8), HUD (§10.9), `BattleStage`, `ActorPool` are constructed **before** `createRenderer` resolves, so the first `frame()` has no lazy allocation.
8. `gpu.compileAsync(scene, camera)` is awaited once with a warm-up scene holding one instance of every library material and one billboard, so the first zone frame compiles nothing. `RenderStats.programs` after this step is the programs baseline of the leak test.

`renderer.setAnimationLoop` is **not** used. The client owns the loop (`20-client.md` §20.4.2: fixed 60 Hz simulation, then exactly one `renderer.frame(frameDt)`). `frame(dtMs)`: (1) `camera.update(dtMs * timeScale)`; (2) `daycycle.update()` (uniforms only; PMREM re-bake when due, §10.3.4); (3) `billboards.update(dtMs * timeScale)` (uniform writes only); (4) `pipeline.render()`; (5) `hud.drawIfDirty()` then `gpu.autoClear = false; gpu.render(hudScene, hudCamera); gpu.autoClear = true`; (6) copy `gpu.info` into the stats record; (7) when `caps.timestampQuery` and a resolve is not in flight, `gpu.resolveTimestampsAsync(TimestampQuery.RENDER).then(ms => stats.gpuMs = ms ?? null)`. Render-on-demand: when `document.hidden`, the client does not call `frame()`; the package renders nothing on its own.

### 10.1.3 Pixel-ratio policy

```
pr = min(o.pixelRatio, 1.5, 3840 / cssWidth)
```

so a 2560×1440 canvas renders at most 3840×2160 (`pr 1.5`) and a 3840-wide canvas at most `pr 1.0`. `renderer.setPixelRatio(pr); renderer.setSize(cssWidth, cssHeight, false)` (the client owns the CSS size). Every render target in the graph follows the drawing-buffer size through `PassNode.setSize`, which `RenderPipeline` drives; the GTAO and bloom nodes carry their own `resolutionScale` (§10.8). `resize()` also calls `camera.setAspect`, `hud.resize(cssWidth, cssHeight, pr)` and `csm.updateFrustums()`.

### 10.1.4 Colour management

`ColorManagement.enabled` stays `true` (default). All albedo KTX2 textures are tagged `SRGBColorSpace`; ORM, normal, emissive-mask and sprite-normal textures are `NoColorSpace`. Output: the graph ends in `renderOutput(graded, NoToneMapping, SRGBColorSpace)` with `pipeline.outputColorTransform = false`, so the working-space→sRGB encode happens exactly once, after grain. The HUD canvas is drawn in sRGB and composited unlit on top with `toneMapped = false` semantics (its `MeshBasicNodeMaterial.colorNode` is `texture(hudTex)` and the overlay render uses `gpu.toneMapping = NoToneMapping`, which is already the renderer setting).

### 10.1.5 Dispose order

`dispose()`: `hud.dispose()` → `stage.dispose()` → `actors.dispose()` → current `ZoneHandle.dispose()` if any → `pipeline.dispose()` (also disposes the display nodes' render targets) → `daycycle.dispose()` (PMREM generator + its target, sky mesh) → `materials.disposeAll()` (§10.2.8) → `ktx2.dispose()` → `await gpu.dispose()`. Calling it twice is a no-op. The leak test's baseline is taken **after** step 8 of §10.1.2 and before any `loadZone`, so library textures/materials/programs are part of the baseline and zone loads must return to it exactly.

---

## §10.2 MATERIAL LIBRARY

### 10.2.1 Texture sets

Every surface has one **texture set**, baked by `tools/` (`40-pipelines.md`) into three KTX2 files, cached by content hash:

| Map | Channels | Colour space | Encoding | Size |
|---|---|---|---|---|
| `<surface>_albedo.ktx2` | RGB (RGBA for alpha cards) | `SRGBColorSpace` | UASTC + RDO + zstd, mip chain to 1×1 | `hero` tier 1024² · `field` tier 512² |
| `<surface>_orm.ktx2` | R = AO, G = roughness, B = metalness | `NoColorSpace` | UASTC, mip chain | same as albedo |
| `<surface>_normal.ktx2` | RGB tangent-space normal (3×3 Sobel of the procedural heightfield, Pillar 2) | `NoColorSpace` | UASTC, mip chain | same as albedo |

<!-- reconciled 2026-09-18: 40-pipelines.md OQ-2 — a single 1024²/2048² tier is ≈ 143 MB on disk against a 60 MB ceiling and 28.8 MB for Mirevale against a 6 MB first-frame phase; two tiers from one recipe: `field` (512², every surface, ≈ 0.10 MB per map) ships first, `hero` (1024², `SurfaceDef.hero === true`: the 6 shared surfaces, every terrain layer and one signature surface per biome, ≤ 50 surfaces world-wide) streams after the first frame and re-points the same material's maps. 2048² is dropped everywhere: at 3 m tiling 1024² is 341 texel/m against 386 px/m at the battle push-in -->
Every surface ships **both tiers** under `<surface>.<tier>_<map>.ktx2` (`40-pipelines.md` §40.3.4). `MaterialLibrary.preload(ids)` resolves when the `field` tier of every id is resident; `preloadHero(ids)` upgrades the bound materials in place (a map re-point on a shared material, no new program) and is what `20-client.md` §20.10.3 phase 5 awaits. A `field` texture at 512² over a 3 m tile is 170 texel/m — 1.5 texels per screen pixel at the default 111 px/m view — so the first frame is never visibly under-textured.

Runtime texture state stamped by the library on load: `wrapS = wrapT = RepeatWrapping`, `minFilter = LinearMipmapLinearFilter`, `magFilter = LinearFilter`, `anisotropy = 8`, `generateMipmaps = false` (compressed; the chain is in the file). The ORM texture object is bound to `aoMap`, `roughnessMap` and `metalnessMap` of the same material — one texture, one sampler, three slots. `aoMap` in node materials samples `uv` (verified: `MaterialNode.js` line 403–405, `aoMap.r − 1) · aoMapIntensity + 1`); no `uv1` attribute is required. Albedo textures are baked with **maximum luminance 0.85** (asset-audit rule `materials.albedoCeiling`); with the noon sun at 1.0 and the IBL at ≤ 0.25 (§10.3.5) the brightest non-emissive pixel is ≤ 1.10 scene-linear, under the 1.15 bloom threshold (Pillar 8).

### 10.2.2 Surface ids

**Mirevale slice (M2), 15 surfaces, in the order the audit prints them:**

| id | Base albedo (sRGB) | Roughness | Metal | Features |
|---|---|---|---|---|
| `grove_bark` | `#5a4632` | 0.78–0.92 | 0 | vertical fibre, wind (trunk sway amplitude 0.02) |
| `grove_leaf_canopy` | `#4f7a3a` | 0.62 | 0 | alpha-tested card (`alphaTest 0.5`), `DoubleSide`, subsurface tint on backface via `frontFacing`, wind |
| `grove_moss` | `#4a6b33` | 0.88 | 0 | terrain layer (triplanar) |
| `path_gravel` | `#8d8272` | 0.80 | 0 | terrain layer (triplanar), wetness |
| `cobble` | `#6f6a63` | 0.55–0.75 | 0 | plaza; wetness; clearcoat 0.25 when wet |
| `plaster` | `#d9cfbb` | 0.72 | 0 | walls; edge-darkening baked in ORM AO |
| `timber` | `#6b4a2e` | 0.66 | 0 | frames, fences, bridge deck |
| `slate_roof` | `#3f444c` | 0.42 | 0 | roofs; wetness → roughness 0.18, clearcoat 0.4 |
| `thatch` | `#a3813f` | 0.95 | 0 | roofs |
| `water_pond` | `#2b5666` | 0.05 | 0 | `MeshPhysicalNodeMaterial`, `transmission 0.6`, normal scroll (§10.5.6), no shadow cast |
| `stone_wall` | `#7d7569` | 0.70 | 0 | low walls, tablet plinths; wetness |
| `lantern_metal` | `#2e2a26` | 0.45 | 0.85 | lamp posts, brackets |
| `glass_warm` | `#ffd9a0` | 0.12 | 0 | emissive housing: `emissive #ffb35c`, `emissiveIntensity 3.2` (the light source, Pillar 4); `toneMapped` irrelevant (post ACES) |
| `dirt` | `#6a5238` | 0.90 | 0 | terrain layer (triplanar) |
| `tall_grass` | `#5f8a3c` | 0.75 | 0 | 3-card tufts, alpha-tested, wind, `vertexColor` tint variation |

**Full list by biome** (a zone binds only its biome's rows plus the 6 shared rows `cobble plaster timber stone_wall lantern_metal glass_warm`; `MaterialBudget` counts the bound set):

| Biome | Surfaces (ids) |
|---|---|
| grove | the 15 above |
| cinder | `cinder_basalt`, `cinder_ash_soil`, `cinder_scoria`, `lava_crust`, `lava_glow` (emissive `#ff5a1f` 4.0, PointLight housing), `obsidian` (clearcoat 0.6), `charred_timber`, `iron_grate`, `forge_brick` |
| salt | `salt_sand`, `wet_rock` (clearcoat 0.5), `barnacle_stone`, `driftwood`, `rope`, `sailcloth` (alpha card), `harbour_plank`, `sea_water` (`transmission 0.7`), `tide_pool` |
| storm | `storm_slate`, `copper_oxide` (metal 0.9, roughness 0.35), `coil_brass` (metal 1.0), `insulator_glass`, `lightning_glass` (emissive `#9fd0ff` 3.6), `tower_stone`, `wet_flagstone` |
| marrow | `marrow_sandstone`, `bone_chalk`, `ore_vein` (emissive `#ffc766` 1.6), `mine_timber`, `rail_iron`, `canyon_dust`, `gypsum_crystal` |
| vesper | `vesper_bark_black`, `grave_moss`, `wrought_iron`, `candle_wax` (emissive `#ffd08a` 2.4), `mist_glass`, `willow_leaf` (alpha card), `bog_water`, `lichen_stone` |
| forge | `forge_steel_plate` (metal 1.0, roughness 0.30), `rivet_iron`, `anvil_black`, `coal_glow` (emissive `#ff7a2a` 3.0), `castle_granite`, `banner_cloth` (alpha card), `chain` |
| sky | `sky_marble`, `cloud_stone`, `gold_leaf` (metal 1.0, roughness 0.22), `prayer_silk` (alpha card), `dragon_scale_tile`, `frost_glass`, `pine_needle` (alpha card), `snow` |
| capital (`solenne`) | `sun_marble`, `gilt_bronze`, `stained_glass` (emissive per-texel mask 2.0), `plaza_pale_stone`, `fountain_water`, `laurel_leaf` |
| shrine (`eclipse_shrine`, `celestial_spire`) | `void_glass` (emissive `#7be0d0` 2.8), `star_iron`, `eclipse_stone`, `ring_light` (emissive `#c7f4ff` 3.4) |
| rift (`the_rift`) | `rift_shard` (emissive `#b46bff` 2.2), `unmade_stone` (**always** renders at harvest level 2 — the Rift is the in-fiction origin of the flat look), `void_floor` |

Ids are `snake_case` strings; `SurfaceId` is the union of every id above (declared in `surfaces.ts`). Unknown ids throw `RangeError` at `MaterialLibrary.get`.

### 10.2.3 Public interface (verbatim)

```ts
import type { MeshStandardNodeMaterial, MeshPhysicalNodeMaterial, Texture, WebGPURenderer } from 'three/webgpu';

export type SurfaceId = /* union of every id in §10.2.2 */ string;
export type MaterialClass = 'standard' | 'physical' | 'card' | 'water' | 'emissive';

export interface SurfaceDef {
  readonly id: SurfaceId;
  readonly cls: MaterialClass;
  readonly albedo: string;                         // base colour used when harvestLevel >= 1 (vertex colour source) and as `color` multiplier
  readonly roughness: number; readonly metalness: number;
  readonly emissive: { readonly color: string; readonly intensity: number } | null;
  readonly clearcoat: { readonly base: number; readonly wet: number; readonly roughness: number } | null;
  readonly triplanar: boolean;                     // terrain layers
  readonly wind: { readonly amplitude: number; readonly frequency: number; readonly stiffnessFromUv: boolean } | null;
  readonly wetness: boolean;                       // roughness/clearcoat respond to weather 'rain'
  readonly alphaTest: number | null;               // cards: 0.5
  readonly doubleSide: boolean;
  readonly castShadow: boolean;                    // false for water and glass
  readonly hero: boolean;                          // true → a 1024² `hero` tier exists besides the 512² `field` tier (§10.2.1); the 6 shared surfaces, every triplanar layer and one signature surface per biome
}
export const SURFACES: Readonly<Record<SurfaceId, SurfaceDef>>;

export interface TextureSet { readonly albedo: Texture; readonly orm: Texture; readonly normal: Texture; readonly bytes: number; readonly tier: 'field' | 'hero' }

export interface MaterialLibrary {
  /** Shared instance; never dispose it. Loads the KTX2 set on first call (awaitable through `ready`). */
  get(id: SurfaceId): MeshStandardNodeMaterial | MeshPhysicalNodeMaterial;
  /** Resolves when the `field` tier of every surface in `ids` is resident. loadZone awaits this before building. */
  preload(ids: readonly SurfaceId[]): Promise<void>;
  /** Resolves when the `hero` tier of every `hero: true` surface in `ids` is resident and re-pointed; no-op for field-only ids. Never awaited before the first frame. */
  preloadHero(ids: readonly SurfaceId[]): Promise<void>;
  /** Releases the texture sets of surfaces not in `keep`; materials stay (their maps are re-pointed on next preload). */
  evictExcept(keep: readonly SurfaceId[]): void;
  /** Uniform group shared by every material: harvestLevel, wetness, windTime, windDir, timeOfDay. */
  readonly uniforms: SharedUniforms;
  stats(): { readonly liveMaterials: number; readonly residentSets: number; readonly textureBytes: number };
  disposeAll(): void;                              // only Renderer.dispose calls this, last
}

export interface SharedUniforms {
  readonly harvestLevel: UniformNode<'float', number>;   // 0 | 1 | 2 written by setHarvestLevel; materials read it as 0..2 and clamp
  readonly wetness: UniformNode<'float', number>;        // 0..1; 'rain' ramps to 1 over 4 s, back over 12 s
  readonly windTime: UniformNode<'float', number>;       // seconds × timeScale
  readonly windDir: UniformNode<'vec2', Vector2>;        // unit xz
  readonly timeOfDay: UniformNode<'float', number>;
}

export function createMaterialLibrary(renderer: WebGPURenderer, ktx2: KTX2Loader, baseUrl: string): MaterialLibrary;

export class MaterialBudget {
  /** Throws in dev builds (import.meta.env.DEV) when a zone binds more than `max` distinct materials; logs in prod. */
  static assert(zoneRoot: Object3D, max: 48): number;
}
```

`get()` is synchronous and returns the material immediately; until `preload` resolves the maps are a shared 4×4 neutral KTX2 placeholder set (albedo `#808080`, ORM `(1, 0.5, 0)`, normal `(0.5, 0.5, 1)`), so nothing renders black. `loadZone` awaits `preload` for the zone's bound set before adding the zone root, so players never see the placeholder.

### 10.2.4 The one material graph

Every library material of class `standard`/`physical`/`card` is built by one function, `buildSurfaceGraph(def, set, u)`, which assigns these node slots (TSL, `three/tsl`):

```ts
const h   = u.harvestLevel.clamp(0, 2).div(2);                    // 0 intact .. 1 harvested
const uvN = def.triplanar ? null : uv();
const alb = def.triplanar
  ? triplanarTexture(texture(set.albedo), null, null, float(1 / 3.0), positionWorld, normalWorld)   // 3 m tiles
  : texture(set.albedo, uvN);
const orm = def.triplanar ? triplanarTexture(texture(set.orm), null, null, float(1 / 3.0), positionWorld, normalWorld) : texture(set.orm, uvN);
const nrm = def.triplanar ? triplanarTexture(texture(set.normal), null, null, float(1 / 3.0), positionWorld, normalWorld) : texture(set.normal, uvN);

// Pillar 2 vs harvested: the SAME graph, blended by one uniform.
m.colorNode     = mix(alb.rgb.mul(color(def.albedo)), vertexColor().rgb, h);        // level 2 = flat vertex colour (the builder writes def.albedo into the `color` attribute)
m.normalNode    = mix(normalMap(nrm, float(1)), normalGeometry, h);                 // level 2 = geometry normal
m.roughnessNode = mix(orm.g.mul(float(def.roughness).mul(2)), float(0.95), h);      // level 2 = flat rough
m.metalnessNode = mix(orm.b.mul(def.metalness > 0 ? 1 : 0), float(0), h);
m.aoNode        = mix(orm.r, float(1), h);
m.emissiveNode  = def.emissive ? color(def.emissive.color).mul(def.emissive.intensity).mul(oneMinus(h)) : null;  // level 2: no light sources (Pillar 4 off)
if (def.clearcoat) { pm.clearcoatNode = mix(float(def.clearcoat.base), float(def.clearcoat.wet), u.wetness).mul(oneMinus(h)); pm.clearcoatRoughnessNode = float(def.clearcoat.roughness); }
if (def.wetness)   { m.roughnessNode = m.roughnessNode.mul(mix(1, 0.45, u.wetness)); }
if (def.wind)      { m.positionNode = windDisplace(positionLocal, def.wind, u); }    // §10.2.5
if (def.alphaTest !== null) { m.alphaTest = def.alphaTest; m.maskShadowNode = alb.a.greaterThan(def.alphaTest); }
```

Flat shading at level 2: `normalGeometry` is the interpolated vertex normal; the zone builder emits **unwelded** triangles for buildings and rocks (each face its own vertices), so `normalGeometry` is the face normal and the level-2 look is faceted, exactly the old game's look. Terrain and scatter stay welded (their level-2 look is smooth vertex colour, which matches the old terrain). `harvestLevel 1` ("thinning") is the midpoint blend: maps at 50 %, normal detail halved, emissive at 50 %.

`MaterialClass 'water'` is §10.5.6; `'emissive'` (`glass_warm`, `lava_glow`, …) is the same graph with `emissiveNode` set and `castShadow: false`.

### 10.2.5 Wind vertex animation (TSL, verbatim)

```ts
export const windDisplace = /*@__PURE__*/ Fn(([ p, amp, freq, stiffUv ]: [Node, Node, Node, Node], u: SharedUniforms) => {
  const wp   = modelWorldMatrix.mul(vec4(p, 1)).xyz;
  const phase = wp.x.mul(0.35).add(wp.z.mul(0.21)).add(u.windTime.mul(freq));
  const gust  = mx_noise_float(vec3(wp.xz.mul(0.05), u.windTime.mul(0.07))).mul(0.5).add(0.5);   // 0..1 slow gust field
  const sway  = sin(phase).mul(0.7).add(sin(phase.mul(2.3).add(1.7)).mul(0.3));
  const weight = stiffUv.equal(1).select(uv().y, p.y.div(6.0).clamp(0, 1));                   // cards: uv.y (0 at the stem); trunks: height / 6 m
  const w = weight.mul(weight);                                                                 // quadratic stiffness
  const d = vec3(u.windDir.x, 0, u.windDir.y).mul(sway.mul(amp).mul(gust).mul(w));
  return p.add(d);
});
```

Amplitudes: `grove_bark 0.02`, `grove_leaf_canopy 0.12`, `tall_grass 0.18`, `banner_cloth 0.25`, `prayer_silk 0.30`; frequency 1.1 for trunks, 1.9 for cards. The same `positionNode` feeds the shadow pass (`_getShadowNodes` falls back to `positionNode`), so shadows sway with the geometry. `windTime` advances by `dt × timeScale`, so hitstop freezes foliage too (the spine's Pillar 8 test counts hitstop frames, not foliage, but freezing everything is the simplest way to be identical).

### 10.2.6 `setHarvestLevel`

Writes `materials.uniforms.harvestLevel.value = l` and `billboards.uniforms.harvestLevel.value = l` (§10.4.6), sets `lightRig.setPunctualEnabled(l < 2)` (Pillar 4 off: every `PointLight`/`SpotLight` of the zone gets `intensity 0` — objects are not removed, so the audit still counts housings), and sets `sky.setHarvest(l)` (level 2: `turbidity 20`, desaturated PMREM, §10.3.3). Cost: 4 uniform writes + `N ≤ 32` light intensity writes. Nothing is created or disposed. `harvest.spec.ts` (`50-verification-budget.md` §50.4.6) asserts `dumpZone()` reports the same material classes at level 0 and 2.

### 10.2.7 Budget

`MaterialBudget.assert(zoneRoot, 48)` runs at the end of `loadZone` and counts distinct `Material.uuid` reachable from the zone root, skipping `Layers` bit 31 (debug). The M2 slice binds 15 surfaces (the 6 shared ids are among them) + ≤ 8 billboard atlas materials + ≤ 6 party singles + 1 contact-decal + 1 impostor + 1 `character` = ≤ 32. <!-- reconciled 2026-09-18: atlas count per 40-pipelines.md §40.1.4 -->

### 10.2.8 Dispose contract

1. `MaterialLibrary` owns every material and texture it hands out. Callers never call `.dispose()` on them (spied in `dispose-contract.test.ts`).
2. `evictExcept(keep)` runs at the end of `loadZone` with the new zone's bound set, so a zone change frees the previous biome's texture sets (`texture.dispose()` inside the library) while the material objects and their compiled programs stay — programs are keyed by the node graph, which does not change when a map is re-pointed.
3. `disposeAll()` disposes every material, every resident texture set and the placeholder set. Only `Renderer.dispose()` calls it.
4. Baseline rule for the leak test: the library is fully constructed and warm-compiled before the baseline capture, so `programs` and `materials` are constant across zone cycles, and `textures/texturesSize` return to the baseline because `evictExcept([])` on `ZoneHandle.dispose()` frees the zone's sets.

---

## §10.3 LIGHTING RIG

### 10.3.1 Sun + 4 cascades

```ts
const sun = new DirectionalLight(0xffffff, 1.0);     // colour/intensity driven per frame by §10.3.5
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);                  // cloned per cascade by CSMShadowNode -> 4 × 2048²
sun.shadow.bias = -0.0004;                           // cascade i gets bias × (i + 1) (CSMShadowNode.js line ~183)
sun.shadow.normalBias = 0.02;
sun.shadow.radius = 2;
const csm = new CSMShadowNode(sun, { cascades: 4, maxFar: 160, mode: 'custom', lightMargin: 60,
  customSplitsCallback: (cascades, near, far, breaks) => { breaks.push(14 / far, 34 / far, 72 / far, 1); } });
csm.fade = true;
sun.shadow.shadowNode = csm;
scene.add(sun, sun.target);
```

Split distances (camera-space depth): **0–14 m, 14–34 m, 34–72 m, 72–160 m**. At the default view (§10.7.1) the player stands 26 m from the camera inside cascade 1 (14–34), whose 2048 texels span a 20 m depth slab; the near cascade covers the foreground of the diorama. `csm.updateFrustums()` is called on resize, zoom-stop change and heading change (camera projection or basis change), never per frame. The `sun.target` is the camera's focus point (§10.7.1) so the cascades follow the player.

Local shadow casters: `SpotLight` with `angle 0.87 rad (100°)`, `penumbra 0.5`, `shadow.mapSize 512²`, `shadow.bias -0.0006`, `shadow.normalBias 0.03`, `shadow.radius 2`; `PointLight` casters (only `kind: 'lava' | 'fire'`) use `shadow.mapSize 256²` (6 faces). Shadow maps are rendered every frame in v1 (a static-caster cache is a follow-up; the budget row `shadows 2.0 ms` in `50-verification-budget.md` §50.2.1 is the assertion this design must meet).

### 10.3.2 Light budget and descriptor

```ts
export type LightKind = 'lamp' | 'lantern' | 'brazier' | 'forge' | 'lava' | 'beacon' | 'window' | 'crystal' | 'candle' | 'fire';

export interface LightSource {
  readonly id: string;
  readonly kind: LightKind;
  readonly color: string;                  // sRGB hex
  readonly intensity: number;              // candela-scaled three intensity at night; day multiplier from §10.3.5
  readonly position: readonly [number, number, number];
  readonly castShadow: boolean;            // ≤ 8 true per zone
  readonly range: number;                  // PointLight.distance / SpotLight.distance; decay 2
  readonly housing: HousingRef;            // the emissive mesh within 0.6 u of `position` (Pillar 4)
  readonly flicker: { readonly amplitude: number; readonly hz: number } | null;   // brazier/forge/lava/candle/fire
}
export type HousingRef = { readonly kind: 'generated'; readonly generator: 'lantern' | 'brazier' | 'beacon' | 'window' | 'crystal' | 'candle'; readonly seed: number }
                        | { readonly kind: 'mesh'; readonly meshId: string };     // a prop already placed (lava pool, forge)

export const LIGHT_BUDGET = { shadowCasters: 8, nonShadow: 24 } as const;
```

`ZoneBuilder` throws `RangeError('light budget')` in dev at the 9th `castShadow: true` or the 25th `castShadow: false` source (Pillar 4 test: the count check fails the build). Each `LightSource` becomes one `SpotLight` (pointing −Y, `lamp`/`lantern`/`beacon`/`window`) or `PointLight` (`brazier`/`forge`/`lava`/`crystal`/`candle`/`fire`) plus its housing mesh whose material is the biome's emissive surface; the housing's world position is asserted within 0.6 u of the light's in `dumpZone()`. Flicker: `intensity × (1 + amplitude · sin(2π·hz·t) · 0.6 + amplitude · hash(floor(t·hz·3)) · 0.4)`, amplitude ≤ 0.15, written once per frame from the render-side clock (display only).

Default sources for the slice: Mirevale 6 shadow-casting `lantern` (plaza ring + gym door + healer door) + 10 non-shadow (`window` ×8, `lantern` ×2); Mire Route 2 shadow `lantern` (route sign, bridge) + 6 non-shadow `crystal` at the tablets and the tall-grass edges.

### 10.3.3 Sky and IBL

```ts
const sky = new SkyMesh(); sky.scale.setScalar(200); sky.layers.set(30);     // layer 30 = sky, excluded from GTAO normal write and from dumpZone
sky.turbidity.value = 3; sky.rayleigh.value = 1.2; sky.mieCoefficient.value = 0.004; sky.mieDirectionalG.value = 0.8;
sky.cloudCoverage.value = 0.35; sky.cloudDensity.value = 0.4; sky.cloudScale.value = 0.0002; sky.cloudSpeed.value = 0.00002;
```

The PMREM is generated from a **separate** `Scene` containing only a second `SkyMesh` (same uniforms) with `showSunDisc.value = 0` (the header of `SkyMesh.js` recommends hiding the disc for environment maps), through `pmrem.fromScene(skyScene, 0, 0.1, 400, { size: 128 })`. `scene.environment = pmremTarget.texture; scene.environmentIntensity = envIntensity(t)`. Re-bake rule: when `|Δ sun elevation| ≥ 2°` since the last bake **or** 20 s of real time have passed, whichever first; at most one bake per frame; a bake at `size 128` costs ≤ 0.6 ms on the reference GPU and is not on the per-pass table (it is amortised inside `opaque`'s remainder). The previous `renderTarget` is reused (`options.renderTarget`), so re-bakes allocate nothing. Harvest level 2 sets `turbidity 20`, `rayleigh 0.2`, `cloudCoverage 0.9`, giving the grey flat sky of a forgotten place.

Hemisphere fill: `new HemisphereLight(skyColor, groundColor, 0.18)` whose colours are sampled from the palette's `skyZenith`/`groundBounce` at the current keyframe; it exists so the shadowed side of a sprite never reads pure black under the noon set (Pillar 5 luminance test needs shadowed pixels that are lit, not clipped).

### 10.3.4 Day/night driver

`timeOfDay t ∈ [0, 1)`, one full day = 48 real minutes (spine §4.1). `t = 0` midnight, `0.25` sunrise, `0.5` noon, `0.75` sunset.

```
elevationDeg(t) = 70 · sin(2π · (t − 0.25))                     // −70 at midnight, +70 at noon
azimuthDeg(t)   = 360 · t − 90                                   // rises at +x (east), sets at −x
sunDir          = (cos(el)·sin(az), sin(el), cos(el)·cos(az))    // unit vector FROM the scene TOWARD the sun
sun.position    = focus + sunDir · 120; sun.target.position = focus
moon: elevation −elevationDeg(t), azimuth azimuthDeg(t) + 180
```

When `elevationDeg < −4` the `DirectionalLight` **becomes the moon**: same object, colour/intensity from the `moon` row, `csm` unchanged. There is no second directional light. `SkyMesh.sunPosition` follows the real sun even below the horizon (the sky model handles twilight).

### 10.3.5 Colour-temperature table (6 keyframes, linearly interpolated in sRGB then converted)

| key | t | Kelvin / note | sRGB | sun intensity | envIntensity | punctual multiplier |
|---|---|---|---|---|---|---|
| `night` | 0.00 | moon (look decision, not blackbody) | `#8fa6d8` | 0.05 | 0.12 | 1.00 |
| `predawn` | 0.22 | 2400 K | `#ff9d3f` | 0.15 | 0.20 | 0.80 |
| `golden_am` | 0.30 | 3200 K | `#ffbb78` | 0.60 | 0.50 | 0.25 |
| `noon` | 0.50 | 5600 K | `#fff3ef` | 1.00 | 0.85 | 0.00 |
| `golden_pm` | 0.72 | 3000 K | `#ffb46b` | 0.55 | 0.45 | 0.30 |
| `dusk` | 0.80 | 2200 K | `#ff932c` | 0.12 | 0.18 | 0.90 |

Wrap: `dusk (0.80) → night (1.00 ≡ 0.00)`. `punctual multiplier` scales every `LightSource.intensity` — lamps are off at noon and full at night (Pillar 4: night is a light-set change). Pillar 5 test pair: `noon` vs `dusk` — mean luminance over a billboard's opaque pixels must differ by ≥ 12 %; with sun 1.00 → 0.12 and lamps 0 → 0.9 the difference is designed to be ≥ 35 %. `envIntensity` caps the IBL contribution at ≤ 0.25 scene-linear on a 0.85-albedo surface (0.85 × 0.85 × 0.3 average irradiance ≈ 0.22), which is the number behind the 1.10 ceiling in §10.2.1.

### 10.3.6 Weather

`setWeather(w)`: `rain` → `wetness` ramps to 1 (4 s), rain particle sheet (one `Points` of 4 000 streaks, `layers 29`, no shadow), sun intensity ×0.55, `cloudCoverage 0.85`; `sun` → `cloudCoverage 0.1`, `envIntensity ×1.1`; `sand` → fog density ×2.5, tint `#c9a24a`; `hail` → rain sheet with `pointWidth 3`, tint white; `none` → defaults. Weather is cosmetic in the overworld (spine §4.1); battles set their own through `BattleStage.setWeather`.

### 10.3.7 Height fog (TSL, no raymarch)

```ts
const fogFactor = Fn(() => {
  const dist  = positionView.z.abs();
  const hFall = exp(positionWorld.y.sub(u.fogBase).max(0).mul(u.fogFalloff).negate());   // 1 at/below base height, decays upward
  return oneMinus(exp(dist.mul(u.fogDensity).negate())).mul(hFall);
});
scene.fogNode = fog(u.fogColor, fogFactor());
```

Palette values for grove: `fogDensity 0.018`, `fogBase 0.0` (m), `fogFalloff 0.35` (per m), `fogColor` from the keyframe (`#b9c7a8` noon, `#1a2030` night). `scene.fogNode` is read by `NodeManager.getFogNode` (verified, line 24). The sky mesh has `fog = false`. Light-shaft cards (≤ 6 per zone, additive alpha cards under lanterns at night, `layers 29`) are the only volumetric suggestion; there is no raymarch (§10.11).

---

## §10.4 CREATURE SPRITE SYSTEM (Pillars 5 and 6)

### 10.4.1 Descriptors (verbatim)

```ts
// text-identical mirrors of spine §2.8 / §2.2 (render imports only `three`; 50-verification-budget.md §50.7 rule 5 allows a mirror whose declaration text is identical)
export type VariantKey = 'normal' | 'dawn' | 'dusk' | 'verdant' | 'ember';
export type TypeName =
  | 'Normal' | 'Fire' | 'Water' | 'Grass' | 'Electric' | 'Ice' | 'Fighting' | 'Poison'
  | 'Ground' | 'Flying' | 'Psychic' | 'Bug' | 'Rock' | 'Ghost' | 'Dragon' | 'Steel'
  | 'Fairy' | 'Dark' | 'Cosmic';

/** One side of a creature. The client builds it from 40-pipelines.md's SpriteManifestV2 (`uv → rect`, `footV`, `aspect`, `px` for singles). */
export interface SpriteFrame {
  readonly atlas: string;                  // ManifestAtlasV2.id, e.g. 'a-017'
  readonly rect: readonly [number, number, number, number];   // u0, v0, u1, v1 in the atlas, v up (= ManifestSpriteV2.<side>.uv)
  readonly px: readonly [number, number, number, number];     // x, y, w, h level-0 texels, y down (= .px); used only by bindSingle's crop
  readonly footV: number;                  // 0..1 from the bottom of the rect where the feet touch the ground (pipeline value 0.08)
  readonly aspect: number;                 // rect width / height in texels (1 for the 1024² normalised frames)
}
export interface SpriteDescriptor {
  readonly id: string;                     // creature/spawn/battler id (render-side key)
  readonly front: SpriteFrame; readonly back: SpriteFrame;
  readonly sizeScale: number;              // SpeciesDef.sizeScale 0.5..2.2
  readonly types: readonly [TypeName] | readonly [TypeName, TypeName];
  readonly variant: VariantKey;
  readonly isAlpha: boolean;
}
/** One map of an atlas: WebP level 0 plus pipeline-built levels 1..3 (40-pipelines.md §40.1.6.3). Never KTX2 — see the note below. */
export interface AtlasMap { readonly url: string; readonly mips: readonly string[] }
export interface AtlasSet {
  readonly id: string;                     // ManifestAtlasV2.id
  readonly albedo: AtlasMap;               // sRGB, straight alpha, lossy q85 with lossless alpha
  readonly normal: AtlasMap;               // NoColorSpace; at `normalScale` × the albedo resolution
  readonly emissive: AtlasMap;             // two-valued mask in R; uploaded as RedFormat/R8
  readonly size: 2048;                     // level-0 texels per side; 2 species (4 cells of 1024²) per atlas
  readonly normalScale: 0.5 | 1;
}
```

<!-- reconciled 2026-09-18: the sprite manifest is 40-pipelines.md's v2 (this section's earlier `AtlasSet { size: 4096 | 8192 }`, per-zone 4096² atlases and `single_<species>` files are superseded); creature atlases are WebP because UASTC measured 1.57× LARGER than lossless WebP on sprite content, the bundled encoder refuses > 12 Mpix, and ETC1S quantises the alpha slice — KTX2 UASTC stays the format for materials (§10.2.1) and model textures. 40-pipelines OQ-1 and OQ-3 are decided here -->
Atlases are **zone-affinity 2048² sets holding 2 species each** (front + back, 4 cells of 1024²); a zone binds the atlases listed in `manifest.zones[zoneId]` — **≤ 8 per zone** (the same texel budget as 2 × 4096²) — so a route's spawn set plus its statics, trainers and gym teams is ≤ 8 binds. A creature not in the current zone's atlases (a traded-in party member) is bound through `SpritePool.bindSingle(set, frame)`: render fetches its `home` atlas files and decodes only the creature's cells with `createImageBitmap(blob, x, y, w, h)` per map and mip level into a 1024² (normal 512²) texture set — the `single` is a runtime crop, never a file on disk; ≤ 6 such binds exist at a time (party size). Textures are built from the decoded `ImageBitmap`s with `texture.mipmaps = [level1, level2, level3]`, `generateMipmaps = false`, so the sampler's `lodMaxClamp` is 3 and the 256²-per-sprite level covers every authored view (a `sizeScale 1` creature at `zoomStop 2` is ≈ 137 px tall → level 2.9).

### 10.4.2 `CreatureBillboard` (verbatim)

```ts
export type BattlerPose = 'idle' | 'lunge' | 'windup' | 'hurt' | 'recoil' | 'faint' | 'enter' | 'exit' | 'celebrate';   // reconciled 2026-09-18: 'recoil' and 'celebrate' added — 20-client.md §20.5.1 Keyframe.pose uses them

export class CreatureBillboard {
  constructor(pool: SpritePool, d: SpriteDescriptor);
  readonly id: string;
  readonly object: Group;                                  // quad + contact decal; add to the zone/arena root
  setPosition(x: number, y: number, z: number): void;      // y = ground height at the feet (the caller samples the collider)
  setFacing(side: 'front' | 'back'): void;                 // battler faces: player's battler shows back, foe shows front
  setSharp(on: boolean): void;                             // DOF mask (Pillar 1): the player's creature and active battlers are true
  setPose(p: BattlerPose, ms: number): void;               // drives the pose uniforms over ms × timeScale
  setHurt(strength: number): void;                         // 0..1 flash, decays over 220 ms
  setFaint(progress: number): void;                        // 0..1 dissolve; 1 = invisible
  setVariant(v: VariantKey, isAlpha: boolean): void;       // rewrites the 4 uniforms + scale
  update(dtMs: number): void;                              // idle bob, flash decay, pose tween — uniform writes only
  dispose(): void;                                         // returns the quad to the pool; idempotent
}
export interface SpritePool {
  bindAtlas(set: AtlasSet): Promise<void>;                 // fetches 3 maps × 4 levels (WebP), one MeshStandardNodeMaterial per atlas
  /** A party single: decodes only `frame.px` (and the matching cells of the mip files) of the creature's home atlas into a private 1024² set keyed `single:<set.id>:<frame.px>`. ≤ 6 live. */
  bindSingle(set: AtlasSet, frame: SpriteFrame): Promise<void>;
  releaseAtlas(id: string): void;                          // also releases singles keyed on it when no billboard uses them
  acquire(d: SpriteDescriptor): CreatureBillboard;
  readonly uniforms: { readonly harvestLevel: UniformNode<'float', number>; readonly cameraYaw: UniformNode<'float', number> };
  stats(): { readonly live: number; readonly atlases: number; readonly bytes: number };
  dispose(): void;
}
```

### 10.4.3 Geometry and anchoring

Quad: `PlaneGeometry(1, 1)` shared by every billboard, scaled per instance. World height `H = 1.6 m × sizeScale` (range 0.8–3.52 m); width `H × aspect`. The quad's local origin is the **foot point**: vertices span `y ∈ [−footV·H, (1 − footV)·H]`, so `setPosition` places the feet on the sampled ground. Texel density: 1024 texels over 1.6 m = 640 texel/m.

At the default view (26 m, FOV 28°, 1440 px) the screen shows 12.97 m vertically → 111 px/m → a `sizeScale 1` creature is 178 px tall (5.8 texels/px, minified). At the battle camera (12 m) it is 386 px (2.65 texels/px). Magnification (Pillar 6's test regime) happens in the dex/party inspector (`stage.inspect`, 4 m) and at `zoomStop 0`. Filters: `magFilter = NearestFilter` (hard texels when magnified, Pillar 6), `minFilter = LinearMipmapLinearFilter` with the pipeline-built WebP mip chain (levels 1–3, box-filtered in premultiplied space, coverage-preserving so `alphaTest 0.5` does not thin creatures at distance — `40-pipelines.md` §40.1.6.3) so minification does not shimmer, `anisotropy = 1`, `generateMipmaps = false`. <!-- reconciled 2026-09-18: WebP chain, not KTX2 --> The Pillar 6 test reads the scene pass `output` MRT texture (pre-TRAA) at 1.3× magnification: along a 200-pixel straight opaque edge every alpha is 0 or 1. TRAA is the only stage allowed to soften it afterwards, by construction.

### 10.4.4 Facing the camera (Y-axis only) — shadow-safe

`billboarding()` from `three/tsl` reads `cameraViewMatrix`, which during the shadow pass is the **light's** view, so a billboard would face the sun in its own shadow map. Not used. Instead one uniform, written once per frame from the main camera:

```ts
pool.uniforms.cameraYaw.value = Math.atan2(camDir.x, camDir.z);           // camera forward projected to xz
const yawRot = Fn(([ p ]) => { const c = cos(u.cameraYaw), s = sin(u.cameraYaw); return vec3(p.x.mul(c).add(p.z.mul(s)), p.y, p.z.mul(c).sub(p.x.mul(s))); });
mat.positionNode = yawRot(positionLocal.add(vec3(0, bob, 0)));           // bob: §10.4.6
```

Because the shadow pass falls back to `positionNode` (`Renderer.js` `_getShadowNodes`), the shadow silhouette is the same yaw as the visible quad. `castShadowPositionNode` is left `null`.

### 10.4.5 The billboard material graph (one `MeshStandardNodeMaterial` per atlas)

```ts
const a   = texture(atlas.albedo, uvRect);                       // uvRect = rect.xy + uv * (rect.zw - rect.xy), from userData per object
const n   = texture(atlas.normal, uvRect);
const em  = texture(atlas.emissive, uvRect).r;                   // 0..1 mask
const h   = pool.uniforms.harvestLevel.clamp(0, 2).div(2);
// variant palette — 4 uniforms via userData (per-object on a shared material)
const hueR = userData('hueShift', 'float'), satM = userData('satMul', 'float'), litM = userData('lightMul', 'float'), glow = userData('alphaGlow', 'float');
let c = hue(a.rgb, hueR); c = saturation(c, satM); c = c.mul(litM);
const flash = userData('hurt', 'float');
c = mix(c, vec3(1), flash.mul(0.85));
mat.colorNode     = vec4(mix(c, a.rgb, h), a.a);                 // harvested: raw albedo, no palette (Pillar 5 off means unlit-looking; lighting below)
mat.normalNode    = mix(normalMap(n, float(1)), normalGeometry, h);   // derived normal lights the sprite (Pillar 5); level 2: flat
mat.roughnessNode = float(0.85); mat.metalnessNode = float(0);
mat.alphaTest     = 0.5;
mat.alphaTestNode = float(0.5).add(userData('dissolve', 'float').mul(0.5));                 // faint dissolve raises the cut
mat.maskShadowNode = a.a.greaterThan(mat.alphaTestNode);         // shadow from alpha (verified path: _getShadowNodes discards where mask is false)
// rim + emissive
const V     = cameraPosition.sub(positionWorld).normalize();
const rim   = pow(oneMinus(abs(dot(normalWorld, V))), 3.0);      // normalWorld here is the normal-mapped one (alpha-edge bevel gives outward normals at the silhouette)
const typeC = userData('typeColor', 'vec3');
const shimmer = glow.mul(0.25).mul(sin(time.mul(3.0).add(uv().y.mul(8.0))).mul(0.5).add(0.5));
mat.emissiveNode = typeC.mul(rim).mul(0.6).add(a.rgb.mul(em).mul(1.8)).add(a.rgb.mul(shimmer)).mul(oneMinus(h));
mat.mrtNode = mrt({ mask: vec2(1, userData('sharp', 'float')) });   // x: exclude from GTAO darkening; y: DOF-sharp (§10.8.2)
mat.side = FrontSide; mat.transparent = false; mat.depthWrite = true;
```

Dissolve additionally discards `hash(floor(uvRect.mul(1024))).lessThan(userData('dissolve','float'))` texels, so a fainting creature breaks into texel-sized holes rather than fading (Pillar 6: alpha stays binary). Creature emissive pixels output `1.8 × albedo` ≥ 1.35 scene-linear where the mask is 1 — above the 1.15 bloom threshold, below the housings' 3.2, and the environment's 1.10 ceiling sits under it: the threshold is in the gap (Pillar 8).

Per-object parameters through `userData(name, type)` (verified `UserDataNode.js`): `object.userData = { rect: Vector4, hueShift, satMul, lightMul, alphaGlow, hurt, dissolve, sharp, typeColor: Color, bob }` — a preallocated record per billboard, scalar writes only.

### 10.4.6 Uniform tables

**Variant palettes** — the spine §3.7 triples verbatim, hue converted to radians for `hue()`:

| variant | hueShift (deg → rad) | satMul | lightMul |
|---|---|---|---|
| `normal` | 0 → 0 | 1.00 | 1.00 |
| `dawn` | 18 → 0.31416 | 1.08 | 1.04 |
| `dusk` | 204 → 3.56047 | 1.10 | 0.95 |
| `verdant` | 110 → 1.91986 | 1.12 | 1.05 |
| `ember` | −18 → −0.31416 | 1.15 | 1.02 |

`lightMul` is a scene-linear multiply (the legacy applied an HSL lightness multiply on sRGB pixels; the difference at ±5 % is below the audit's tolerance and is accepted). `isAlpha`: `alphaGlow 1`, quad scale ×1.12, contact decal ×1.12.

**Type colours** (`typeColors.ts`, the legacy `TYPE_COLORS` verbatim; the rim light and the gym beacons read this table):

| Type | hex | Type | hex | Type | hex |
|---|---|---|---|---|---|
| Normal | `#a8a290` | Poison | `#9a5bb0` | Rock | `#b09a6f` |
| Fire | `#ee6f4a` | Ground | `#c9a24a` | Ghost | `#6a5b9a` |
| Water | `#4aa3d6` | Flying | `#8aa6e0` | Dragon | `#6a52d0` |
| Grass | `#6fae5a` | Psychic | `#e06fa0` | Steel | `#9aa6b0` |
| Electric | `#f4cf3f` | Bug | `#9aa83a` | Fairy | `#f0a6d0` |
| Ice | `#8fd6e8` | Fighting | `#c0492f` | Dark | `#5b4b66` |
| | | | | Cosmic | `#7be0d0` |

Dual-typed creatures use `types[0]`. `20-client.md` §20.8.3 colourblind palettes replace this table through the descriptor (`SpriteDescriptor` carries types, the client passes a `typeColorTable` to `createRenderer`'s stage via `stage.setTypeColors(table)` — declared in §10.7.5).

**Animation uniforms** (all per-object `userData`, driven by `update(dt × timeScale)`):

| Effect | Rule |
|---|---|
| Idle bob | `bob = 0.015 · H · sin(2π · 0.5 · t + phase)` — 0.5 Hz, ±1.5 % of height; `phase = hash(id) · 2π` so a party does not bob in unison |
| Hurt flash | `hurt = strength` at `setHurt`, then `hurt *= exp(−dt / 70 ms)`; visible ≈ 220 ms |
| Faint dissolve | `dissolve` set by the client's timeline (`KO_HOLD` 900 ms in `20-client.md`), linear 0 → 1 |
| Poses | `lunge`: position +0.9 m toward the foe over 120 ms, back over 180; `windup`: scale y 0.94 then 1.04 over 250 ms; `hurt`: −0.3 m recoil 80 ms + flash; `recoil`: −0.25 m back over 100 ms, return over 150, no flash (the `damage { cause: 'recoil' }` cue); `enter`/`exit`: dissolve 1 → 0 / 0 → 1 over 450/350 ms; `faint`: dissolve + 0.4 m sink; `celebrate`: two 0.15 m hops over 600 ms (battle end, winner's active battler) |

No pose creates a material or geometry; every pose is uniform writes on the shared quad and material.

### 10.4.7 Contact shadow and grounding

Each billboard owns one decal: `PlaneGeometry(1, 1)` (shared), rotated flat, scaled to `1.1 m × sizeScale` (×1.12 alpha), positioned at the feet on the sampled terrain height + normal (`TerrainCollider.normal`, §10.6), `MeshBasicNodeMaterial` shared across all billboards: `colorNode = vec4(0, 0, 0, 1)`, `opacityNode = smoothstep(0.5, 0.05, length(uv().sub(0.5))).mul(0.55).mul(oneMinus(h))`, `transparent = true`, `blending = MultiplyBlending`, `depthWrite = false`, `polygonOffset = true, polygonOffsetFactor = -2, polygonOffsetUnits = -2`, `renderOrder = 5`, `layers 28` (decals; excluded from GTAO via the `mask.x` MRT channel like sprites). The decal is the "soft occlusion gradient at the feet" of Pillar 5; the real cast shadow from `maskShadowNode` is the hard one. No y-epsilon anywhere: `polygonOffset` does the work.

### 10.4.8 Pillar tests owned here

- Pillar 5: `pillars.spec.ts` renders one `sizeScale 1` billboard at the arena position under `noon` and `dusk`, reads the scene pass `output` over the pixels where the albedo alpha is 1, and asserts mean luminance differs by ≥ 12 %; reads the cascade-1 shadow map texel count covered by the billboard's projected quad and asserts > 0.
- Pillar 6: as §10.4.3.
- Sprites audit: `sprites.nearest` (`50-verification-budget.md` §50.4.6) asserts `magFilter === NearestFilter && anisotropy === 1` on every atlas albedo in `dumpZone()`.

---

## §10.5 ZONE BUILDER

### 10.5.1 `ZoneSpec` and `ZoneHandle` (verbatim)

Field names follow `20-client.md` §20.4.4's adapter table (`palette`, `generators`, `setPiece`, `edges`, `actors`, `pickups`, `tablets`, `buildings`, `tallGrass`, `harvestLevel`, `accentType`) so `zoneSpecFor` needs no rename.

```ts
export type Biome = 'grove' | 'cinder' | 'salt' | 'storm' | 'marrow' | 'vesper' | 'forge' | 'sky' | 'capital' | 'shrine' | 'rift';   // text-identical mirror of spine §3.1
export type Layout = 'town' | 'route' | 'story';
export type Dir = 'n' | 'e' | 's' | 'w';
export type GeneratorSet = 'grove' | 'cinder' | 'salt' | 'storm' | 'marrow' | 'vesper' | 'forge' | 'sky' | 'capital' | 'shrine' | 'rift';   // BIOME_GENERATORS keys = Biome
export type SetPieceId =
  | 'grove_heart_tree' | 'mire_boardwalk' | 'cinder_caldera' | 'ash_lava_bridge' | 'salt_lighthouse' | 'tide_wreck'
  | 'storm_coil_tower' | 'galvan_span' | 'marrow_mineshaft' | 'deepcut_arch' | 'vesper_witch_hut' | 'hollow_lantern_road'
  | 'forge_great_gate' | 'siege_trebuchet' | 'sky_shrine' | 'ascent_stair' | 'solenne_cathedral' | 'eclipse_engine'
  | 'umbral_dome' | 'celestial_spire' | 'rift_maw';                                        // exactly 21; one per zone

export interface HeightfieldData {          // structurally identical to @ewa/content Heightfield (00-spine.md §3.11); the client passes content's object as-is
  readonly zoneId: string; readonly size: number; readonly step: 0.5; readonly res: number;
  readonly originX: number; readonly originZ: number;
  readonly heights: Float32Array; readonly walkable: Uint8Array; readonly water: Uint8Array; readonly digest: string;
}
export interface Marker { readonly id: string; readonly x: number; readonly z: number }   // warps (door markers), pickups, tablets share this shape
export interface PropPlacement { readonly kind: string; readonly x: number; readonly z: number; readonly yaw: number; readonly scale: number; readonly seed: number }   // kind = a generator prop id (§10.5.4)
export interface BuildingSpec { readonly id: string; readonly kind: 'house' | 'gym' | 'shop' | 'healer' | 'landmark'; readonly x: number; readonly z: number; readonly yaw: number; readonly w: number; readonly d: number; readonly floors: 1 | 2; readonly roof: 'slate' | 'thatch' | 'tile' | 'plate'; readonly seed: number }
export interface ActorSpawn { readonly id: string; readonly look: string; readonly x: number; readonly z: number; readonly kind: 'npc' | 'trainer' }
export interface Pickup { readonly id: string; readonly x: number; readonly z: number }
export interface Tablet { readonly id: string; readonly x: number; readonly z: number }
export interface Edge { readonly toZone: string; readonly x: number; readonly z: number }
export interface WaterSpec { readonly kind: 'pond' | 'sea' | 'river' | 'lava' | 'bog'; readonly level: number; readonly polygon: readonly (readonly [number, number])[] }

export interface ZoneSpec {
  readonly id: string;
  readonly seed: number;                                      // ZoneDef.layoutSeed, uint32
  readonly biome: Biome;
  readonly palette: string;                                   // ZoneDef.palette -> PALETTES[palette] (§10.5.3)
  readonly generators: GeneratorSet;
  readonly layout: Layout;
  readonly size: { readonly w: number; readonly d: number };  // the playable interior: town 128×128, route 208×208, story 168×168 (00-spine.md §3.1 extents) — reconciled 2026-09-18
  readonly heightfield: HeightfieldData;                      // the full field (160 / 240 / 200 m): the 16 m margin is scenery, never walkable (walkable = 0 there)
  readonly warps: readonly Marker[];                          // ZoneDef.warps → door markers (interior sub-areas are laid out by the builder at the warp's toX/toZ)
  readonly setPiece: SetPieceId;
  readonly edges: Readonly<Partial<Record<Dir, Edge>>>;
  readonly buildings: readonly BuildingSpec[];
  readonly props: readonly PropPlacement[];                   // hand-placed props; scatter is generated from seed + layout
  readonly lights: readonly LightSource[];                    // ≤ 8 shadow + ≤ 24 non-shadow
  readonly actors: readonly ActorSpawn[];
  readonly pickups: readonly Pickup[];
  readonly tablets: readonly Tablet[];
  readonly tallGrass: boolean;
  readonly water: WaterSpec | null;
  readonly accentType: TypeName | null;                       // gym beacon + arena ring colour
  readonly harvestLevel: HarvestLevel;
}

export interface ZoneHandle {
  readonly id: string;
  readonly group: Group;                                      // the zone root (Pillar 7: never removed during a battle)
  readonly collider: TerrainCollider;                         // §10.6
  readonly bounds: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
  readonly geometryDigest: string;                            // fnv1a32 over every geometry's position attribute bytes, in build order, 8 hex chars (§10.5.9)
  stats(): RenderStats;
  dispose(): void;                                            // idempotent; §10.5.9
}
```

### 10.5.2 Determinism

`Prng` (`zone/prng.ts`) is sfc32 with the spine's exact step (`| 0`, `>>> 0`, splitmix32 expansion of a numeric seed, 12 warm-up draws) re-implemented inside render — render may not import `@ewa/core`, and two copies of a 12-line function are cheaper than a rule exception. `packages/render/test/prng.test.ts` asserts `createPrng(12345).int(1000)` equals the constant committed in `packages/core/test/rng.test.ts` (the same literal, copied), so the two copies cannot drift silently. Every generator receives a `Prng` forked from `spec.seed` with a fixed label order (`fork('layout')`, `fork('scatter')`, `fork('props')`, `fork('lights')`), so adding a generator never reseeds the others.

### 10.5.3 Palettes

`PALETTES: Record<string, Palette>` where `Palette = { skyZenith, skyHorizon, groundBounce, fogColor: [night, noon], grade: { lift: [r,g,b], gamma: [r,g,b], gain: [r,g,b] }, terrainLayers: [SurfaceId, SurfaceId, SurfaceId], scatterTints: string[] }`. The slice ships `grove_mirevale` and `grove_mire`: `grade { lift [0.01, 0.012, 0.0], gamma [1.0, 0.98, 0.96], gain [1.02, 1.03, 0.98] }` (warm greens); night lift `[0.0, 0.004, 0.02]`.

### 10.5.4 Biome generators (verbatim signatures; `grove` in full, the other sets follow the same shape)

Every generator returns `BufferGeometry` objects with `position`, `normal`, `uv`, `color` (vertex colour = the surface's `albedo`, so harvest level 2 renders it) and, for buildings/rocks, **unwelded** triangles (§10.2.4). Nothing returned is a stock primitive: Pillar 3's audit asserts zero `BoxGeometry`, `ConeGeometry`, `IcosahedronGeometry(r, 0)` or `SphereGeometry` with `widthSegments < 24` under the zone root; generators build from `LatheGeometry`, `ExtrudeGeometry`, `Shape` paths and raw `Float32Array`s only.

```ts
export interface GeoLod { readonly lod0: BufferGeometry; readonly lod1: BufferGeometry; readonly lod2: BufferGeometry; readonly impostorKind: string | null }
export interface PropGeo extends GeoLod { readonly surfaces: readonly SurfaceId[]; readonly groups: readonly { readonly surface: SurfaceId; readonly start: number; readonly count: number }[] }

export type TreeKind = 'oak' | 'birch' | 'willow';
/** Trunk: LatheGeometry, 12 radial × 8 height segments, radius 0.32·s at the base flaring to 0.50·s over 5 root lobes (0..0.6 m), tapering to 0.14·s at 6 m·s; 2–4 branches (lathed, 8 radial) at 55–70 % height; canopy: 24 (lod0) / 12 (lod1) / 4 (lod2) alpha-tested cards 1.6–2.4 m; s = 0.8 + prng.next() · 0.6. lod0 ≈ 1 900 tris, lod1 ≈ 700, lod2 ≈ 180. */
export function makeTree(kind: TreeKind, seed: number): PropGeo;
/** Lathed 10-point profile (16 radial), then 3–5 planar cuts with prng normals (vertices beyond a cut plane are projected onto it and re-triangulated), then fBm displacement ±0.06 r; unwelded. 300–900 tris; lod1 = 8 radial, lod2 = 6 radial no cuts. */
export function makeRock(seed: number): PropGeo;
/** Walls: ExtrudeGeometry of the footprint Shape with { bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 } — the 4 cm chamfer (Pillar 3); door + 2–4 window recesses cut as Shape holes and lined 0.12 m deep; roof: two ExtrudeGeometry slabs at 38° pitch, 0.35 m overhang, ridge beam, chimney lathe; timber frame as a separate group (surface 'timber'); plaster walls, roof surface from spec.roof. lod1 drops recess linings and frame; lod2 is the chamfered shell. */
export function makeHouse(spec: BuildingSpec): PropGeo;
/** Post: 8-radial lathe 2.6 m; bracket; head: 6-sided chamfered cage (0.28 m) with an inner 'glass_warm' pane (the housing mesh). Returns the housing's local position so the LightSource can be checked within 0.6 u. */
export function makeLantern(seed: number): PropGeo & { readonly housingLocal: readonly [number, number, number] };
/** Posts every 1.8 m along `path` (world xz polyline), two rails, 4 cm chamfers on the rail profiles; merged. */
export function makeFence(path: readonly (readonly [number, number])[], seed: number): PropGeo;
/** Arched deck (12 planks, ExtrudeGeometry), two side rails via makeFence, 4 posts; span from `a` to `b`, sagitta 0.35 m. */
export function makeBridge(a: readonly [number, number], b: readonly [number, number], seed: number): PropGeo;
/** Bank ring (lathe of the polygon, 0.4 m lip, surface stone_wall) + water plane (§10.5.6); returns both. */
export function makePond(spec: WaterSpec, seed: number): { readonly bank: PropGeo; readonly water: Mesh };
/** One tuft = 3 crossed alpha cards 0.5–0.8 m; returns the tuft geometry; scatter places it as InstancedMesh with per-instance colour tint from palette.scatterTints. */
export function makeTallGrass(seed: number): GeoLod;
/** The zone's unique set-piece. Only the id decides which sub-generator runs. */
export function makeSetPiece(id: SetPieceId, seed: number): PropGeo & { readonly lights: readonly LightSource[] };
```

Prop kinds for `PropPlacement.kind` in the grove set: `tree_oak`, `tree_birch`, `tree_willow`, `rock_s`, `rock_m`, `rock_l`, `stump`, `log`, `bush`, `flower_patch`, `sign`, `well`, `cart`, `crate`, `barrel`. Scatter kinds (generated from `layout` + `seed`, not listed in `props`): `tree_*` (density 0.028/m² in the town margin, 0.045 on the route), `rock_*` (0.006), `bush` (0.02), `flower_patch` (0.012), `tall_grass` tufts (2.2/m² inside tall-grass patches).

### 10.5.5 Layout

`layout.ts` (pure): `town` = a plaza (radius 14 m, `cobble`) centred at `(0, 0)`, 6–10 buildings on a ring of radius 22–30 m facing the plaza with 4 m gaps, gym at the north-most slot, shop/healer flanking the south road, roads (`path_gravel`, 3.5 m wide) from the plaza to each `edge`; `route` = a 12 m corridor along x with 3–5 tall-grass patches (ellipses 8×5 m) alternating sides, 2–3 clearings, the set-piece at the midpoint; `story` = the set-piece at the origin, a 20 m approach from the single edge. Trainers/npcs/pickups/tablets come from `spec.actors/pickups/tablets` (content positions) and are **not** moved by layout; layout only refuses to place scatter inside a 1.5 m radius of them or inside a building footprint. The layout writes the terrain splat (`color` attribute: R path, G dirt, B moss weight) and the footprints that content's `Heightfield.walkable` already encodes; render never edits `walkable` (§10.6).

### 10.5.6 Water

`water_pond`/`sea_water`/… are `MeshPhysicalNodeMaterial` with `transmission`, `roughnessNode = float(0.05)`, `normalNode = normalMap(texture(set.normal, uv().add(vec2(u.windTime.mul(0.012), u.windTime.mul(0.007)))), 0.35)` blended with a second sample at 0.7× scale scrolling the other way; depth tint `mix(shallow, deep, saturate(depthBelow / 2.5))` where `depthBelow` is the terrain height sampled into a vertex attribute at build time (no depth-buffer read). `castShadow = false`, `receiveShadow = true`. Harvest level 2 collapses it to the flat vertex colour like every other surface.

### 10.5.7 Scatter, LOD, culling

Scatter is chunked into **32 m cells** (the AOI cell of spine §4.2): one `InstancedMesh` per `(kind, chunk, lodTier)` that has ≥ 1 instance, `frustumCulled = true`, `computeBoundingSphere()` once after `instanceMatrix` is filled, `instanceMatrix.setUsage(StaticDrawUsage)`. Per-instance tint through `instanceColor` (`setColorAt`), read by `vertexColor()` in the material graph where the generator marks `scatterTint: true`. LOD per chunk, not per instance: a chunk's tier is chosen each frame from the distance of its centre to the camera — **0–40 m LOD0, 40–90 m LOD1, 90–160 m LOD2, > 160 m impostor** — with 4 m hysteresis; the three tier meshes of a chunk exist from build time and toggle `visible`, so tier switches allocate nothing. Buildings and set-pieces use `LOD` objects (`addLevel(lod0, 0), addLevel(lod1, 40, 0.1), addLevel(lod2, 90, 0.1)`).

Impostors: a camera-facing card per scatter kind beyond 160 m, textured from an 8-yaw × 2-pitch atlas (16 views of 128² in one 512² `RenderTarget`, `HalfFloatType`) rendered **once per zone load** per kind (≤ 6 kinds → ≤ 6 render targets, ≤ 3 ms each, counted in `renderTargets ≤ 24`). The card material is one shared `MeshBasicNodeMaterial` (`alphaTest 0.5`), lit by a baked flat term, and is excluded from the three-maps audit by class `'impostor'`.

Geometry of the view: at `zoomStop 1` the camera sits 20.5 m above the focus and pitched 52°; the top frustum edge (52° − 14° = 38° below horizontal) meets the ground 26.2 m past the camera's ground point, so the default view sees at most ≈ 45 m of ground and 8 m tree tops out to ≈ 60 m. LOD2 and impostors are therefore reached by `zoomStop 2` (34 m), by `pushIn`/`release`, by the spectator arenas and by the hostile-audit free camera — they exist so those shots hold the budget, not for the default view. The tiers are still built for every zone; the cost is geometry memory (≤ 40 % of LOD0), not draw calls.

### 10.5.8 Draw-call derivation (the ≤ 400 cap, `50-verification-budget.md` §50.2.2)

| Group | Worst-case draws |
|---|---|
| Terrain chunks (32 m cells, town 5×5 field = 25, ≤ 12 in frustum) | 12 |
| Buildings: per building 2 groups (walls+roof, timber) × ≤ 10 + gym/shop/healer landmarks 3×3 | 29 |
| Set-piece | ≤ 8 |
| Scatter: ≤ 6 visible chunks × ≤ 8 kinds × ≤ 2 tiers present | 96 |
| Hand-placed props (merged per surface per chunk) | ≤ 24 |
| Lights' housings (merged per surface) | 3 |
| Water | 1 |
| Billboards (≤ 40 visible: 16 nameplated players, 12 spawns, 6 party, 6 npc/trainer) + contact decals | 80 |
| Actors' character meshes (≤ 24 remote + local, 1 draw each, §10.7.6) | 25 |
| Sky, rain sheet, light-shaft cards | 8 |
| Arena dressing during a battle (ring, 2 lights' housings, 6 spectator billboards) | 10 |
| Shadow passes: 4 cascades × (terrain 12 + buildings 29 + scatter 60 + billboards 40) is counted by `renderer.info` as draw calls | reported separately in `dumpZone()`; the ≤ 400 cap applies to the beauty pass and the post quads (≤ 14) |
| **Total (beauty + post)** | **≤ 310** |

### 10.5.9 Disposal contract — the leak test

`ZoneHandle.dispose()`: (1) `scene.remove(group)`; (2) traverse `group` **once**, in the reverse of build order, calling `geometry.dispose()` on every geometry the builder created (recorded in a `Set<BufferGeometry>` at build time — shared library geometries such as the billboard quad and the decal plane are **not** in the set and are never disposed here), `dispose()` on every `InstancedMesh` (frees `instanceMatrix`/`instanceColor` attributes), `texture.dispose()` + `renderTarget.dispose()` on the ≤ 6 impostor targets, `light.dispose()` on every `PointLight`/`SpotLight` (frees its shadow map through `LightShadow.dispose`); (3) `materials.evictExcept(nextKeep)` where `nextKeep` is `[]` unless a `loadZone` is already pending (handover pre-load), in which case it is the next zone's bound set; (4) `pool.releaseAtlas` for the zone's atlases (party singles stay); (5) `collider` reference dropped; (6) `disposed = true`. A second call returns immediately.

Assertion (spine-level, `leak.spec.ts` in `50-verification-budget.md` §50.4.6): after `dispose()`, `renderer.info.memory.{geometries, textures, texturesSize, programs, renderTargets, attributes, attributesSize}` equal the baseline captured after §10.1.2 step 8 **exactly (±0)**; after 100 load/unload cycles `renderer.info.memory.total` equals the baseline. Programs are constant because every material graph exists (warm-compiled) before the first zone; a new graph appearing during a zone load is itself a leak-test failure and therefore a spec violation.

`geometryDigest` is `fnv1a32` over the concatenated `position` attribute bytes of every builder-created geometry in build order; `20-client.md` §20.4.4's snapshot test compares it across two builds of the same `ZoneSpec` (determinism), and CI compares it across Node (`layout` only — no GPU) and the browser.

---

## §10.6 TERRAIN = COLLISION

### 10.6.1 The data is content's; the solver is render's

`00-spine.md` §3.11 defines the heightfield as a pure `@ewa/content` export (`buildHeightfield(zone)`) so the server and the client sample the same `Float32Array`. Render cannot import content, so `HeightfieldData` (§10.5.1) is the structurally identical descriptor; `zoneSpecFor` passes `getHeightfield(zone.id)` through unchanged. Render never writes `heights`, `walkable` or `water`. <!-- reconciled 2026-09-18: the home is the spine, not 30-server-netcode.md --> The terrain mesh is built from the same array, so what you see is exactly what you collide with (the walkable-space fix in `PLAN.md`).

```ts
export class TerrainCollider {
  constructor(h: HeightfieldData);
  /** Bilinear over the 4 surrounding samples (identical to content's sampleHeight). NaN outside the field. */
  sample(x: number, z: number): number;
  /** Central differences over ±step; normalised; writes into `out` (no allocation). */
  normal(x: number, z: number, out: Vector3): Vector3;
  /** Nearest sample's walkable bit; false outside. Identical to content's isWalkable. */
  walkable(x: number, z: number): boolean;
  /** Nearest sample's water bit; false outside. Identical to content's isWater (water surface meshes and 'water' spawns sit on it). */
  water(x: number, z: number): boolean;
  /** Slope in degrees at (x, z) from `normal`. */
  slopeDeg(x: number, z: number): number;
  readonly bounds: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };  // the playable interior = content's playableBounds(h): field extent shrunk by the 16 m margin (00-spine.md §3.1)
}
```

`packages/render/test/collider.test.ts` (node): for 10 000 prng points over a fixture field, `collider.sample` equals content's `sampleHeight` to `1e-6` and `collider.walkable` equals `isWalkable` exactly (the fixture is the JSON dump of `mirevale`'s field committed by content's validate step, so the two implementations cannot drift).

### 10.6.2 Movement solver contract (client prediction; the server is authoritative)

```ts
export const MOVER = { capsuleRadius: 0.35, capsuleHeight: 1.7, stepHeight: 0.4, slopeLimitDeg: 40, skin: 0.02 } as const;
export interface MoveResult { readonly x: number; readonly z: number; readonly y: number; readonly blocked: boolean; readonly slid: boolean }
/** Pure. Resolves a desired xz displacement against the collider. Never returns an unwalkable position. */
export function resolveMove(c: TerrainCollider, fromX: number, fromZ: number, dx: number, dz: number): MoveResult;
```

Rules, in order: (1) target `(tx, tz) = (fromX + dx, fromZ + dz)`; (2) if `walkable(tx, tz)` and `sample(tz) − sample(from) ≤ stepHeight` and `slopeDeg(tx, tz) ≤ slopeLimitDeg` → accept; (3) else try the two axis-separated moves `(dx, 0)` then `(0, dz)` with the same tests → accept the first that passes, `slid = true`; (4) else probe 8 directions of the capsule radius (`0.35` at 45° steps) around the target and accept the walkable one with the smallest angle to the desired direction, `slid = true`; (5) else stay, `blocked = true`. `y = sample(x, z)`. The `slopeLimitDeg 40` only affects sliding feel between walkable samples; the `walkable` bitmap (which content marks 0 above 35°) is the sole authority on where a player may stand, and the server's `validateInput` accepts only `walkable = 1` positions — so the client can never predict itself somewhere the server will refuse on walkability grounds.

---

## §10.7 CAMERA

### 10.7.1 `DioramaCamera` (Pillar 1)

Constants (`camera/rig.ts`):

| Name | Value | Note |
|---|---|---|
| `FOV_V` | 28° | spine Pillar 1 (35 mm-equivalent as the spine defines it; on 16:9 this is a 47.2° horizontal FOV) |
| `PITCH` | −52° from horizontal | fixed |
| `YAW_BASE` | −35° | heading 0; heading `k ∈ 0..3` → `−35° + 90°·k` |
| `DISTANCE` | 20 · 26 · 34 m | `zoomStop 0 · 1 · 2`; default 1 |
| `SPRING_TAU` | 0.12 s | critically damped: `ω = 1/τ`, `x' = x + (v·dt)`, `v' = v − (2ω·v + ω²·(x − target))·dt`, semi-implicit Euler at the render dt |
| `DEAD_ZONE` | 0.8 m | the target does not move until the player's feet leave a 0.8 m radius around the last target; then the target follows the feet minus the dead-zone radius along the offset |
| `HEADING_TURN_MS` | 320 | yaw eased `smoothstep` between headings; `csm.updateFrustums()` at the end |
| `ZOOM_MS` | 260 | distance eased between stops |

Camera position = `target + dist · (cos(pitch)·sin(yaw), sin(−pitch)·, cos(pitch)·cos(yaw))` → at stop 1: height `26·sin 52° = 20.49 m`, horizontal offset `26·cos 52° = 16.01 m`. The target point is the followed actor's **feet** (`ActorPool` provides it) — the DOF focal plane passes through it.

### 10.7.2 `CameraRig` (verbatim; the surface `20-client.md` §20.4.1 lists)

```ts
export interface CameraRig {
  setHeading(h: 0 | 1 | 2 | 3): void;
  setZoomStop(z: 0 | 1 | 2): void;
  follow(actorId: string | null): void;                     // null = hold position
  /** Pillar 7: eases from the current pose to the battle pose (§10.7.4) over ms; input to the rig is ignored until release. */
  pushIn(target: { readonly x: number; readonly z: number }, ms: number): void;
  release(ms: number): void;                                // back to the diorama pose
  /** Additive rotational shake: amplitude in world units at the focus distance (20-client.md SHAKE_AMP ≤ 0.5), decays over ms; ignored when effects.shake is false. */
  shake(amp: number, ms: number): void;
  /** Battle camera cue from the timeline (20-client.md MoveAnimDef.camera and Keyframe.camera.shot). */
  cue(kind: 'attacker' | 'defender' | 'impact' | 'wide' | 'ko' | 'throw', ms: number): void;   // reconciled 2026-09-18: 'throw' added for the orb sequence
  update(dtMs: number): void;                               // called by frame(); zero allocation
  readonly focus: Readonly<Vector3>;                        // the point the DOF plane passes through (feet of the followed actor)
  readonly camera: PerspectiveCamera;
  setAspect(aspect: number): void;
}
```

Shake is applied as a rotation about the camera's right and up axes **after** the spring pose, plus a roll of `amp · 0.4°`, so `lookAt`-style follow never cancels it; with `effects.shake === false` the call returns before writing anything (Pillar 8: zero frames with offset ≠ 0).

### 10.7.3 `TiltShiftDOF` (Pillar 1)

The focal plane passes through `rig.focus` and is **tilted 24° from the view-perpendicular toward the ground plane** about the camera's right axis. With pitch 52°, its normal is `n = normalize(−cos 76°·f_h + sin 76°·up) = (−0.2419·f_h, 0.9703)` where `f_h` is the horizontal forward unit vector. Per-pixel signed distance `d = dot(P_world − focus, n)` from world position reconstructed by `getViewPosition(screenUV, depth, cameraProjectionMatrixInverse)` transformed by `cameraWorldMatrix`.

| Parameter | Value | Consequence |
|---|---|---|
| tilt | 24° | a prop 12 m nearer/farther along the ground is `12 · 0.2419 = 2.90 m` off-plane |
| `focalLength` (full blur distance) | 6.0 m | CoC = `smoothstep(0, 6, |d|)`; at 2.90 m → 0.518 |
| `bokehScale` | 6 px (scaled by `pr`) | max CoC 6 px; at 2.90 m → 3.1 px ≥ 3 px (spine Pillar 1 test); 4 m above the plane → 4.1 px |
| f-stop equivalent | ≈ f/2.8 on the 35 mm-equivalent lens (informative) | the two numbers above are the binding ones |
| `focusDistance` passed to `dof()` | 0 | the node computes `signedDist = −viewZ − focusDistance`; we pass `viewZNode = d.negate()` so `signedDist = d`; near field = below the plane, far field = above |

Mask: MRT channel `mask.y` (§10.8.2), 1.0 over every pixel of a billboard with `sharp = 1` (the player's creature, both active battlers, the inspected creature); the composite is `mix(dofOut, preDof, maskTex.y)`. The player **character** mesh is also `sharp` (its own material sets `mrtNode = mrt({ mask: vec2(0, 1) })`). Pillar 1 test: mask value 1.0 over the whole billboard → `pillars.spec.ts` reads the `mask` MRT texture.

### 10.7.4 `BattleCamera` and arena framing (Pillar 7)

Arena: the two battlers stand **5.5 m apart** on the line through the `BattleSummary (x, z)` perpendicular to the diorama heading; the player's battler is the nearer one, showing its **back** sprite. Default battle pose: camera **12 m** from the arena centre, **28° pitch**, yaw = diorama yaw + 12° (so the two battlers are staggered, not eclipsed), FOV unchanged (28°). `pushIn` eases position/pitch/yaw from the diorama pose over 600 ms with `smoothstep`; the battle pose is always within 40 u of the pre-battle player position (Pillar 7 test: 12 m + 5.5 m/2 < 40).

```ts
export interface CameraWork {
  readonly push: { readonly distance: number; readonly ms: number } | null;   // dolly toward the cue target (m)
  readonly orbit: { readonly deg: number; readonly ms: number } | null;       // yaw around the arena centre
  readonly shake: { readonly amp: number; readonly ms: number } | null;       // forwarded to rig.shake (effects.shake gates)
  readonly slowmo: { readonly scale: number; readonly ms: number } | null;    // forwarded to setTimeScale (effects.slowmo gates)
  readonly hold: number;                                                       // ms before returning to the arena pose
}
export const CAMERA_WORK: Readonly<Record<'attacker' | 'defender' | 'impact' | 'wide' | 'ko' | 'throw', CameraWork>> = {
  attacker: { push: { distance: 2.5, ms: 220 }, orbit: { deg: -10, ms: 220 }, shake: null, slowmo: null, hold: 300 },
  defender: { push: { distance: 2.5, ms: 220 }, orbit: { deg: 10, ms: 220 }, shake: null, slowmo: null, hold: 300 },
  impact:   { push: { distance: 1.2, ms: 90 },  orbit: null, shake: { amp: 0.25, ms: 180 }, slowmo: null, hold: 200 },
  wide:     { push: { distance: -3.0, ms: 400 }, orbit: { deg: 25, ms: 400 }, shake: null, slowmo: null, hold: 500 },
  ko:       { push: { distance: 1.8, ms: 300 }, orbit: { deg: 35, ms: 900 }, shake: null, slowmo: { scale: 0.35, ms: 400 }, hold: 900 },
  throw:    { push: { distance: 1.5, ms: 600 }, orbit: { deg: 15, ms: 600 }, shake: null, slowmo: null, hold: 700 },   // follows the orb to the wild battler; the orb shakes play in this pose
};
```

Per-move overrides come from the client's `MOVE_ANIMS` through `rig.cue(kind, ms)`; the registry above is the render-side default per cue kind. `shake.amp` from the timeline (`SHAKE_AMP(frac)`) replaces the row's `amp` when the client passes one.

### 10.7.5 `BattleStage` (the surface `20-client.md` consumes) and the VFX id table

```ts
export type Terrain = 'none' | 'grove' | 'cinder' | 'salt' | 'storm' | 'marrow' | 'vesper' | 'forge' | 'sky' | 'shrine' | 'rift';   // text-identical mirror of spine §2.9
export interface BattlerRef { readonly side: 0 | 1; readonly slot: number }

export interface BattleStage {
  /** Dresses the arena at (x, z): a 7 m ring (surface cobble / the biome's plaza stone), 2 shadow-casting beacons whose colour is accentType, ≤ 6 spectator billboards (npc looks), rope posts; all within the zone's light budget (the 2 beacons are reserved slots). */
  dress(at: { readonly x: number; readonly z: number }, terrain: Terrain, participants: readonly string[]): void;
  dressSpectator(x: number, z: number): void;           // ring + beacons only
  undress(ms: number): void;                            // fades and removes the dressing; disposes nothing shared
  setBattler(ref: BattlerRef, d: SpriteDescriptor | null): void;   // null = empty slot; the two active refs get sharp = true
  setPose(ref: BattlerRef, pose: BattlerPose, ms: number): void;
  hurt(ref: BattlerRef, strength: number): void;
  faint(ref: BattlerRef, ms: number): void;
  setWeather(w: WeatherKind): void;                     // arena-local: the battle's Field.weather
  vfx(id: VfxId, from: BattlerRef | null, to: BattlerRef | null, ms: number): void;
  prewarm(ids: readonly VfxId[]): void;                 // compiles/instantiates the pooled effects (20-client.md preview rule 1)
  syncFrom(hp: readonly { readonly ref: BattlerRef; readonly hpFrac: number }[]): void;   // after battleResync: poses reset, no animation
  setTypeColors(table: Readonly<Record<TypeName, string>>): void;   // colourblind palettes (20-client.md §20.8.3)
  inspect(d: SpriteDescriptor | null): void;            // 4 m close-up pose for the party/dex inspector; null exits
  dispose(): void;
}

export type VfxId =
  | `type_${Lowercase<TypeName>}`                        // 19 projectile/burst effects, one per type, colour from the type table
  | 'impact_normal' | 'impact_super' | 'impact_resist' | 'impact_crit'
  | 'status_burn' | 'status_poison' | 'status_paralyze' | 'status_sleep' | 'status_freeze' | 'status_confuse'
  | 'stat_up' | 'stat_down' | 'heal' | 'drain' | 'recoil'
  | 'weather_sun' | 'weather_rain' | 'weather_sand' | 'weather_hail'
  | 'orb_throw' | 'orb_shake' | 'orb_catch' | 'orb_break'
  | 'switch_out' | 'switch_in' | 'faint' | 'trap' | 'flinch';
export const VFX_IDS: readonly VfxId[];                  // exactly 19 + 4 + 6 + 5 + 4 + 4 + 5 = 47 entries; the client's MOVE_ANIMS/DEFAULT_BY_TYPE reference only these
```

Every VFX is a pooled `Points` cloud (≤ 512 particles, additive, `layers 29`, one shared `PointsNodeMaterial` with per-particle `instancedBufferAttribute` for birth/lifetime/colour) or a pooled alpha-card burst (≤ 8 cards); pools are allocated in `createRenderer` (§10.1.2 step 7) and never grow. `impact_super` adds a 120 ms `chroma` request (`effects.chroma` gates it) and `impact_crit` a 3-frame white flash on the target (`hurt 1.0`). VFX never writes `mask.y = 1`, so effects blur with the scene and never sharpen; VFX never covers the HUD rects (the HUD is a later overlay pass — Pillar 8 readability gate in `50-verification-budget.md` §50.1 rule 15).

### 10.7.6 `ActorPool`

```ts
export interface ActorDescriptor { readonly look: string; readonly name: string; readonly guildTag: string; readonly isLocal: boolean }
export interface ActorPool {
  spawn(id: string, d: ActorDescriptor): void;                 // character mesh from the look table (§10.7.7); pool of 48 rigs preallocated
  setTransform(id: string, x: number, z: number, angle: number, moving: boolean, running: boolean): void;   // y from the collider; walk/run blend by speed
  setEmote(id: string, n: 0 | 1 | 2 | 3 | 4 | 5 | 6): void;    // 0 clears; 1..6 = wave happy sad alert heart cool (spine §4.1) — a 2 s card over the head
  despawn(id: string): void;
  feetOf(id: string, out: Vector3): Vector3 | null;            // for CameraRig.follow and the DOF focus
  screenPositions(out: Float32Array): number;                  // xy pairs in CSS px for HudLayer nameplates; returns count
  dispose(): void;
}
```

### 10.7.7 Character models

Player and NPC looks are `SkinnedMesh` rigs loaded once per `createRenderer` from `public/models/looks/<look>.glb` (`models.manifest.json` `looks`, the CC0 Quaternius set the plan carries forward, `40-pipelines.md` §40.2 re-encodes them with meshopt; the source files carry **no images**, so the pipeline bakes their 6 flat colours into `COLOR_0`). Each look is one draw (one primitive, one material), `castShadow = true`, and its material is the one shared library `MeshStandardNodeMaterial` of class `'character'`: the §10.2.4 graph with `vertexColor()` as albedo and the neutral placeholder ORM/normal set (`aoNode 1`, roughness 0.6, metalness 0, geometry normal) — exempt from `materials.threeMaps` by class, and flattened at harvest level 2 like everything else. Animation: `AnimationMixer` with the 7 kept clips `idle`/`walk`/`run`/`victory`/`defeat`/`sitdown`/`standup`, `mixer.update(dt × timeScale)`. Legendary GLBs (`public/models/legendaries/<id>.glb` + `<id>.lod1.glb`, skinned, one `idle` clip, three KTX2 maps) are the only skinned meshes with real maps and use the §10.2.4 graph unmodified; they switch to `lod1` beyond 40 m. Nameplates are HUD (§10.9), never `Sprite`s. <!-- reconciled 2026-09-18: paths, material and clip list from 40-pipelines.md §40.2.3/§40.2.5 -->

---

## §10.8 POST STACK

### 10.8.1 Order (from `PLAN.md`, realised as one `RenderPipeline` graph)

```
scenePass (MRT: output · normal · velocity · mask)
 → GTAO (half-res, 16 spp) applied to opaque pixels only (mask.x == 0)
 → TRAA
 → bloom (threshold 1.15 scene-linear, strength 0.35, radius 0.6)
 → tilt-shift DOF, composited through mask.y
 → chromatic aberration (transient; 0 at rest)
 → ACES
 → grade (lift/gamma/gain from the palette)
 → vignette 0.22
 → grain 0.035
 → renderOutput (→ sRGB)
 → HUD overlay (second renderer.render, §10.9)
```

The plan's "opaque → GTAO → sprite pass" ordering is realised **inside one scene pass** through the `mask.x` channel: GTAO is computed from the full depth/normal (billboards still occlude the ground beneath them) but multiplied only into pixels whose `mask.x == 0`. A second scene pass sharing depth is not possible with `PassNode` 0.186 without a custom render target, and the mask channel achieves the same image at zero extra passes.

### 10.8.2 The graph (verbatim TS)

```ts
import { RenderPipeline, NoToneMapping, SRGBColorSpace, HalfFloatType } from 'three/webgpu';
import { pass, mrt, output, normalView, velocity, vec2, vec3, vec4, float, uniform, mix, screenUV, length, smoothstep, pow, oneMinus,
         renderOutput, acesFilmicToneMapping, getViewPosition, cameraProjectionMatrixInverse, cameraWorldMatrix, dot, Fn } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { smaa } from 'three/addons/tsl/display/SMAANode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';
import { film } from 'three/addons/tsl/display/FilmNode.js';
import { chromaticAberration } from 'three/addons/tsl/display/ChromaticAberrationNode.js';

export interface PostUniforms {
  readonly focusPoint: UniformNode<'vec3', Vector3>;   // rig.focus (world)
  readonly planeNormal: UniformNode<'vec3', Vector3>;  // §10.7.3 n, world space
  readonly chroma: UniformNode<'float', number>;       // 0 at rest; CHROMA_SUPER 0.012 for 120 ms
  readonly lift: UniformNode<'vec3', Vector3>; readonly gamma: UniformNode<'vec3', Vector3>; readonly gain: UniformNode<'vec3', Vector3>;
  readonly vignette: UniformNode<'float', number>;     // 0.22
  readonly grain: UniformNode<'float', number>;        // 0.035
  readonly exposure: UniformNode<'float', number>;     // 1.0
}

export function buildPostGraph(gpu: WebGPURenderer, scene: Scene, camera: PerspectiveCamera, u: PostUniforms, f: EffectsFlags, backend: Backend, passes: Readonly<Record<BudgetPass, boolean>>): { pipeline: RenderPipeline; nodes: PostNodes } {
  const scenePass = pass(scene, camera, { depthBuffer: true });
  scenePass.setMRT(mrt({ output, normal: normalView, velocity, mask: vec2(0, 0) }));    // 4 colour targets, HalfFloatType (PassNode allocates one type for all), + depth
  const beauty = scenePass.getTextureNode('output');
  const depthT = scenePass.getTextureNode('depth');
  const normalT = scenePass.getTextureNode('normal');
  const velT   = scenePass.getTextureNode('velocity');
  const maskT  = scenePass.getTextureNode('mask');
  const viewZ  = scenePass.getViewZNode('depth');

  // GTAO — half resolution, 16 spp, temporal filtering (TRAA follows)
  let lit = beauty;
  if (passes.gtao) {
    const aoNode = ao(depthT, normalT, camera);
    aoNode.resolutionScale = 0.5; aoNode.samples.value = 16; aoNode.radius.value = 0.9; aoNode.thickness.value = 0.6; aoNode.scale.value = 1.0; aoNode.useTemporalFiltering = true;
    const aoT = aoNode.getTextureNode();
    lit = vec4(beauty.rgb.mul(mix(aoT.r, float(1), maskT.x)), beauty.a);             // sprites/decals (mask.x = 1) keep their own contact gradient
  }

  // Anti-aliasing — TRAA on webgpu, SMAA on the webgl2 fallback (TRAA needs the velocity MRT + timestamp-free history it gets on both, but the fallback is not budgeted; SMAA is the safe choice there)
  const aa = !passes.traa ? lit : (f.taa && backend === 'webgpu') ? traa(lit, depthT, velT, camera) : smaa(lit);

  // Bloom
  const bloomed = passes.bloom && f.bloom
    ? (() => { const b = bloom(aa, 0.35, 0.6, 1.15); b.smoothWidth.value = 0.05; b.setResolutionScale(0.5); return aa.add(b); })()
    : aa;

  // Tilt-shift DOF through the sharp mask
  const worldPos = cameraWorldMatrix.mul(vec4(getViewPosition(screenUV, depthT, cameraProjectionMatrixInverse), 1)).xyz;
  const planeDist = dot(worldPos.sub(u.focusPoint), u.planeNormal);                    // §10.7.3 d
  const blurred = passes.dof && f.dof ? dof(bloomed, planeDist.negate(), 0, 6.0, 6.0) : bloomed;
  const focused = passes.dof && f.dof ? mix(blurred, bloomed, maskT.y) : bloomed;

  // Chromatic aberration (transient)
  const ca = f.chroma ? chromaticAberration(focused, u.chroma, null, float(1.1)) : focused;

  // ACES then grade (display-referred), vignette, grain
  const aces = passes.grade ? acesFilmicToneMapping(ca.rgb, u.exposure) : ca.rgb;
  const graded = passes.grade ? pow(aces.mul(u.gain).add(u.lift), vec3(1).div(u.gamma)).clamp(0, 1) : aces;   // lift/gamma/gain: out = (in·gain + lift)^(1/gamma)
  const r = length(screenUV.sub(0.5).mul(vec2(1, 0.5625)));                            // aspect-corrected radius (16:9)
  const vig = passes.grade ? graded.mul(oneMinus(smoothstep(0.35, 0.85, r).mul(u.vignette))) : graded;
  const grained = f.grain && passes.grade ? film(vec4(vig, 1), u.grain).rgb : vig;

  const pipeline = new RenderPipeline(gpu, renderOutput(vec4(grained, 1), NoToneMapping, SRGBColorSpace));
  pipeline.outputColorTransform = false;
  return { pipeline, nodes: { scenePass, maskT } };
}
```

Grain 0.035 is `film`'s `intensity` mix (verified body: `mix(base, base + base·(noise + 0.1), intensity)`), i.e. ≤ 3.85 % luminance modulation. The `mask` target is read by two consumers (AO exclusion, DOF composite) and by `pillars.spec.ts`. Every uniform in `PostUniforms` is written in `frame()` from the rig and the palette; `setEffects` and `BudgetProbe.setPassEnabled` call `buildPostGraph` again and assign `pipeline.outputNode = …; pipeline.needsUpdate = true` (disposing the previous display nodes), so a disabled pass has **no** render target and **no** cost.

### 10.8.3 Numbers that are assertions

| Stage | Setting | Where checked |
|---|---|---|
| MRT | 4 HalfFloat targets + depth at drawing-buffer size: at 3840×2160 that is 4 × 66.4 MB = 265.4 MB, inside the 700 MB texture cap with ≈ 180 MB of zone textures and ≈ 40 MB of atlases | `budget.spec.ts` `texturesSize` |
| GTAO | 1280×720 at `pr 1` on 1440p (`resolutionScale 0.5`), `samples 16` | §50.2.1 row `GTAO 1.2 ms` |
| TRAA | MSAA off (`antialias: false`) | `createRenderer` throws if `gpu.samples > 0` |
| Bloom | threshold 1.15 > 1.10 environment ceiling, < 1.35 creature emissive, < 3.2 housings | asset-audit `materials.albedoCeiling` + `pillars.spec.ts` bloom-gap shot (the brightest non-emissive pixel in the noon shot's beauty target ≤ 1.15) |
| DOF | tilt 24°, focalLength 6 m, bokehScale 6 px, mask over sharp billboards | Pillar 1 test |
| Vignette | 0.22 at the corners (`r = 0.5·√(1 + 0.5625²) ≈ 0.574` → `smoothstep(0.35, 0.85, 0.574) = 0.36` → 8 % darkening at the far corner; 22 % is the cap the uniform expresses) | shot readback in the hostile audit |
| Grain | 0.035 | reduced effects → the `film` node is absent from the graph |

### 10.8.4 `ReducedEffects` — always wins

`setEffects(f)` is the only entry; the client computes `f` through `effectsFlags(settings, reduced)` (`20-client.md` §20.8.2), where reduced sets `dof/grain/chroma/shake/hitstop/slowmo = false`. Render enforces the same on its side: when `f.shake === false`, `CameraRig.shake` returns without writing; when `f.hitstop === false` or `f.slowmo === false`, `setTimeScale(s)` with `s !== 1` is coerced to 1 (so a stale timeline frame cannot freeze the render clock); when `f.dof === false` the DOF node is not built; when `f.grain === false` the film node is not built; when `f.chroma === false` the aberration node is not built. Bloom and TRAA stay (static; Pillar 8 lists exactly grain, aberration, shake, hitstop). Pillar 8 test: 600 frames with reduced effects → zero frames with shake offset ≠ 0 and zero frames with `timeScale !== 1`.

---

## §10.9 IN-CANVAS HUD LAYER

```ts
export interface HudLayer {
  /** Accepts exactly the HudModel field names of 20-client.md §20.6; unknown keys throw in dev. Marks the touched regions dirty. */
  set(partial: Partial<HudModel>): void;
  /** Called by frame(); redraws only dirty regions into the 2D canvas and uploads (`texture.needsUpdate = true`) only when something was drawn. Never called from the fixed step. */
  drawIfDirty(): boolean;
  setFonts(body: string, display: string): void;      // CSS font strings; the client waits on document.fonts.load before the first draw
  setScale(uiScale: number): void;                     // 0.9..1.4; every metric below multiplies by it
  resize(cssWidth: number, cssHeight: number, pr: number): void;
  dispose(): void;
}
```

Implementation: one `OffscreenCanvas` (fallback `HTMLCanvasElement`) at `cssWidth·pr × cssHeight·pr`, one `CanvasTexture` (`SRGBColorSpace`, `minFilter = LinearFilter`, `magFilter = LinearFilter`, `generateMipmaps = false`, `premultiplyAlpha = true`), one full-screen `PlaneGeometry(2, 2)` with `MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false })` and `colorNode = texture(hudTex)`, rendered by `gpu.render(hudScene, new OrthographicCamera(-1, 1, 1, -1, 0, 1))` after `pipeline.render()` with `gpu.autoClear = false`. The HUD is therefore never touched by bloom, DOF, grain or aberration (Pillar 8; `50-verification-budget.md` §50.1 rule 15 measures exactly this).

Regions (each with its own dirty bit; a `set` marks only the regions its keys belong to): `party` (top-left strip, 48 px thumbs), `zoneName` (centre-top display face 48 px), `timeOfDay` + `questHint` (top-right), `chat` (bottom-left, 6 lines, fade 8 s — the fade re-marks the region dirty at 4 Hz while a line is fading), `prompt` (bottom-centre), `nameplates` (positions from `ActorPool.screenPositions`, redrawn when a position moves ≥ 1 px), `battle` (bars anchored above the billboards via the stage's projected positions; HP tween at 30 Hz while a `hp` frame is active), `connection`, `dev`. Text: body 14 px minimum at `uiScale 1` (spine/plan: "text ≥ 14 px"), numerals `tabular-nums`, 2 px dark outline under every glyph over the world. Nameplates cap at 16 (the model's cap). `drawIfDirty` costs 0 when nothing changed; the `20-client.md` §20.10.2 dirty test asserts that 600 idle frames produce 0 uploads.

---

## §10.10 RENDER STATS AND BUDGET

### 10.10.1 `BudgetProbe` and `createZoneView` (the `50-verification-budget.md` §50.2.3 contract, verbatim there; implemented here)

```ts
// BudgetPass, BudgetCounts, BudgetProbe: defined verbatim in 50-verification-budget.md §50.2.3 and exported from @ewa/render unchanged (not restated here — §50.7 rule 5).

export interface ZoneDump {
  readonly zone: string; readonly harvestLevel: HarvestLevel;
  readonly materials: readonly { readonly uuid: string; readonly cls: MaterialClass | 'billboard' | 'impostor' | 'decal' | 'character' | 'water'; readonly surface: SurfaceId | null; readonly maps: { readonly albedo: boolean; readonly orm: boolean; readonly normal: boolean }; readonly ktx2: boolean }[];
  readonly geometries: readonly { readonly uuid: string; readonly type: string; readonly parameters: Readonly<Record<string, number>> | null; readonly triangles: number; readonly instanced: number }[];
  readonly lights: readonly { readonly id: string; readonly type: 'PointLight' | 'SpotLight'; readonly castShadow: boolean; readonly position: readonly [number, number, number]; readonly housingDistance: number }[];
  readonly sprites: readonly { readonly atlas: string; readonly magFilter: number; readonly anisotropy: number }[];
  readonly counts: BudgetCounts;
  readonly shadowDrawCalls: number;
  readonly culledChunks: number;              // scatter chunks outside the frustum this frame (legacy-render-audit Q19: the cull rate is reported, not assumed) — reconciled 2026-09-18
  readonly lightIds: readonly string[];       // LightSource ids present, sorted; pillars.spec.ts compares it before and during a battle (Pillar 7)
}

export interface ZoneViewOptions extends RendererOptions { readonly zone: ZoneSpec; readonly shots: readonly CameraShot[] }
export interface CameraShot { readonly id: string; readonly heading: 0 | 1 | 2 | 3; readonly zoomStop: 0 | 1 | 2; readonly focus: readonly [number, number]; readonly timeOfDay: number; readonly battle: boolean }
export interface ZoneView extends BudgetProbe { readonly renderer: Renderer; setShot(s: CameraShot): void; frame(dtMs: number): void; setSimMs(ms: number): void; dispose(): void }
export function createZoneView(o: ZoneViewOptions): Promise<ZoneView>;   // createRenderer + loadZone + scripted rig; no network, no client store
```

`setPassEnabled('opaque' | 'sprites' | 'shadows', false)` are realised outside the post graph: `opaque` → the zone root's `visible = false` (billboards stay), `sprites` → `layers` 28/29 and the billboard layer 27 disabled on the camera, `shadows` → `gpu.shadowMap.enabled = false`. The other five are post-graph rebuilds (§10.8.2). `gpuFrameMs()` = `gpu.resolveTimestampsAsync(TimestampQuery.RENDER)`; `undefined` without `timestamp-query`.

### 10.10.2 Assertions (the `PLAN.md` table, made per-pass by `50-verification-budget.md` §50.2.1, restated as what this package must hit on the reference machine)

| Row | Target ms | Ceiling ms | What in this file decides it |
|---|---|---|---|
| opaque | 2.6 | 3.4 | ≤ 310 beauty draws (§10.5.8), ≤ 2.5 M tris, chunked LOD, one material graph |
| sprites | 0.8 | 1.2 | ≤ 40 billboards, alpha-tested (no sorting), pooled VFX ≤ 512 particles each |
| shadows | 2.0 | 2.6 | 4 × 2048² cascades + ≤ 8 local casters at 512²/256² |
| GTAO | 1.2 | 1.6 | half-res, 16 spp |
| TRAA | 0.7 | 1.0 | full-res resolve, no MSAA |
| bloom | 0.7 | 1.0 | `resolutionScale 0.5`, 5 mips |
| DOF | 0.9 | 1.3 | full-res CoC + half-res near blur (node internals) + 1 composite |
| grade / HUD | 0.5 | 0.7 | one quad for ACES/grade/vignette/grain, one HUD overlay draw |
| **total** | **10.0** | **13.5** | with sim 0.6 |

Counts (`50-verification-budget.md` §50.2.2): draw calls ≤ 400, triangles ≤ 2 500 000, `texturesSize` ≤ 734 003 200 bytes, materials ≤ 48, shadow lights ≤ 8, non-shadow ≤ 24, render targets ≤ 24 (scene MRT 1 + GTAO 2 + TRAA 2 + bloom 10 + DOF 4 + impostors ≤ 6 = 25 → **impostor targets are disposed after their atlas is copied into one 2048² `Texture` per zone**, bringing the steady state to 20), programs ≤ 96.

### 10.10.3 `RenderStats.passMs`

Filled only by the differential procedure of `50-verification-budget.md` §50.2.3 (`T_all − T_without_p`), which `createZoneView` runs when the harness asks; during play every entry is `null`. `stats()` copies numbers into a preallocated record — no object is created per call.

---

## §10.11 CUT DELIBERATELY

| Cut | One-line reason | Replacement |
|---|---|---|
| **SSR** (`SSRNode` exists) | a second depth-dependent trace per pixel with no budget row (`50-verification-budget.md` §50.3 already cuts it) | correct PMREM from the physical sky + `clearcoat` on wet stone (`wetness` uniform) |
| **SSGI** (`SSGINode` exists) | ≥ 2 ms at 1440p; the art scale is served by baked ORM AO + GTAO + IBL | GTAO half-res 16 spp + hemisphere fill |
| **Raymarched / volumetric fog** | per-pixel march through shadow maps ≥ 1.5 ms; the diorama camera looks down, so shafts are rarely in frame | analytic height fog (§10.3.7) + ≤ 6 light-shaft cards |
| **RTGI / any GI** | no path exists in three 0.186's WebGPU renderer that fits 13.5 ms; zones are authored and can bake | ORM AO baked at build, PMREM IBL swapped with the day cycle |
| **Planar reflections** (`Reflector`, `ReflectorNode`) | one extra scene render per reflector | water uses `transmission` + the PMREM + scrolling normals |
| **AgX tone mapping** | ACES is the palette every sprite was authored against; re-verifying 130 species' emissive masks and 19 type colours is not paid for | `acesFilmicToneMapping` in the post graph |
| **`SunLight` + `SunLightShadow`** | fixed at 2 cascades; Pillar 4 requires 4 | `DirectionalLight` + `CSMShadowNode({ cascades: 4 })` |
| **`SpriteNodeMaterial` for creatures** | unlit; Pillar 5 requires lit surfaces | `MeshStandardNodeMaterial` quad with a yaw uniform (§10.4.4) |
| **`billboarding()` TSL helper** | reads `cameraViewMatrix`, which is the light's during the shadow pass | one `cameraYaw` uniform written per frame |
| **MSAA** | forbidden with TRAA (`TRAANode.js` header) | TRAA (webgpu) / SMAA (webgl2 fallback) |
| **Per-instance LOD, GPU-driven culling, `BatchedMesh`** | chunked `InstancedMesh` already meets ≤ 400 draws; the extra machinery has no budget row | 32 m chunk LOD (§10.5.7) |
| **Runtime texture generation (`CanvasTexture`/`DataTexture` on lit materials)** | the old world's zero-texture look came from exactly this; KTX2 at build is 4–6× smaller and mipped | build-time KTX2 sets, `textures.ktx2Only` audit rule |
| **A second code path for harvested zones** | the spine forbids it | `harvestLevel` uniform in the one material graph (§10.2.4) |
| **Static-caster shadow caching** | not in v1; the 2.0 ms shadows row is met with per-frame updates on the reference GPU | follow-up if the M2 capture says otherwise (`50-verification-budget.md` §50.7 change log) |
| **WebGL2 as a designed tier** | allowed to run, never budgeted or audited (`50-verification-budget.md` §50.3) | `WebGPURenderer` with three's automatic fallback; `smaa` substituted for `traa` |

---

## NON-NEGOTIABLES (this file)

1. One renderer, one pipeline, one scene, one camera; the zone root is never removed during a battle (Pillar 7).
2. Every lit opaque material carries albedo + ORM + normal from KTX2 (billboards: WebP atlases with the same three roles; characters: vertex colour + placeholder); no runtime-generated texture reaches a lit material.
3. The harvested look is `harvestLevel` — one uniform in one graph. `setHarvestLevel` allocates nothing.
4. Billboards are lit `MeshStandardNodeMaterial` quads with `NearestFilter` magnification, a normal map, a type-coloured rim, `maskShadowNode` alpha shadows and a multiply contact decal; the variant palette is four `userData` values, never re-baked pixels.
5. The DOF focal plane passes through the followed actor's feet, tilted 24°, and the `mask.y` MRT channel keeps the player's creature and both active battlers at CoC 0.
6. Bloom threshold 1.15 sits above the 1.10 environment ceiling (albedo ≤ 0.85 × sun 1.0 + IBL ≤ 0.25) and below the 1.35 creature-emissive floor.
7. Lights: ≤ 8 shadow casters + ≤ 24 non-shadow per zone, each with an emissive housing within 0.6 u; the sun has 4 × 2048² cascades at 14 / 34 / 72 / 160 m.
8. Effects flags remove passes from the graph; `shake` and `timeScale ≠ 1` are refused when their flag is false.
9. `ZoneHandle.dispose()` returns `renderer.info.memory` to the post-warm-up baseline exactly; the library's materials, textures and programs are part of that baseline.
10. No `Math.random`, `Date`, `performance.now` or per-frame allocation anywhere in `packages/render/src`.

## OPEN QUESTIONS FOR OTHER SECTIONS — RESOLVED 2026-09-18

<!-- reconciled 2026-09-18: each question below is answered in the named section; the list is kept as the audit trail -->
1. `20-client.md` §20.4.1 → **done**: the client's consumed-surface block now points at this file's definitions (§10.1.1, §10.5.1, §10.7.2, §10.7.5, §10.7.6, §10.9) and lists the extra members; `zoneSpecFor` (§20.4.4) passes `getHeightfield(zone.id)` unchanged and fills `seed`, `biome`, `size`, `layout`, `props`, `lights`, `water`, `warps`; `MOVE_ANIMS`/`DEFAULT_BY_TYPE` reference only the 47 `VFX_IDS` (§20.5.2, asserted by `timeline.test.ts`). The client's `Keyframe.pose` values `recoil`/`celebrate` and `camera.shot 'throw'` were added here (§10.4.2, §10.7.2, §10.7.4) rather than removed there.
2. `30-server-netcode.md` §30.2.3 → **done**: the `Heightfield` block moved to `00-spine.md` §3.11 (content owns it; `water` added); `validate.ts` commits `dist/heightfields/<zoneId>.json` for every zone (spine §3.10), and `collider.test.ts` reads `mirevale.json`.
3. `40-pipelines.md` → **done, in 40's favour for creatures**: material texture sets are KTX2 UASTC in two tiers (§10.2.1 here, §40.3 there); creature atlases are WebP 2048² zone-affinity sets, ≤ 8 per zone, singles are runtime crops (§10.4.1 here = SpriteManifestV2 there); the placeholder set, meshopt GLBs (KTX2 maps on legendaries only) and `public/basis/` are as §40.2/§40.3.4/§40.6 state.
4. `50-verification-budget.md` → **done**: §50.4.6 now names the pre-TRAA `output` read for Pillar 6, the `mask` read for Pillar 1, the rules `materials.albedoCeiling`, `shadows.drawCalls`, `harvest.same`, `geometry.noOutlineShells`, `scatter.instanced`, the bloom-gap shot, `renderTargets` steady state 20 ≤ 24 and `programs` constant across cycles.
