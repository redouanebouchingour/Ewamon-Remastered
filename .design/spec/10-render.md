# EWAMON REMASTERED — SPEC §10: @ewa/render

**Status:** BINDING, subordinate to `00-spine.md`. Where this file and the spine disagree, the spine wins. Where a higher-numbered section (`20-client.md`, `30-server-netcode.md`, `50-verification-budget.md`) names a render symbol, this file is the definition; the reconciler adjusts their consumed-surface lists to the names here, never the other way round (`20-client.md` §20.4.1 states the same rule).

Inputs: `00-spine.md` §1 (the eight pillars, each with its acceptance test), §3.1 `ZoneDef`, §3.7 `VARIANT_PALETTES`; `PLAN.md` (rendering architecture, frame budget, the harvested-zone mechanic); `20-client.md` §20.4.1 (consumed surface), §20.4.4 (`zoneSpecFor` field mapping), §20.6 (`HudModel`), §20.8.2 (`EffectsFlags`); `30-server-netcode.md` §30.2.3 (`Heightfield`, decided to live in `@ewa/content`); `50-verification-budget.md` §50.2 (`BudgetProbe`, per-pass table, count caps) and §50.4.6 (render tests, asset-audit rules); `eslint.config.js` (`ewa/render`: `three` only — no `@ewa/*`, no react, no node builtins); the legacy `world3d-data.js` `TYPE_COLORS` and `liveOps.js` `VARIANT_PALETTES`.

Every library symbol below was read from `packages/render/node_modules/three@0.186.0` and `@types/three@0.186.0`, not from memory. Import paths as resolved by `three/package.json` `exports` (`"./webgpu"`, `"./tsl"`, `"./addons/*"` → `examples/jsm/*`):

| Symbol | Import | Verified fact |
|---|---|---|
| `WebGPURenderer` | `three/webgpu` | `new WebGPURenderer({ forceWebGL, antialias, alpha, depth, stencil, outputBufferType, powerPreference, trackTimestamp })`; `await renderer.init()`; `renderer.backend.isWebGPUBackend` / `isWebGLBackend`; `renderer.info.render.{drawCalls,triangles,timestamp}`, `renderer.info.memory.{geometries,textures,texturesSize,programs,renderTargets,attributes,attributesSize,total}`; `resolveTimestampsAsync(TimestampQuery.RENDER)`; `shadowMap.enabled`, `shadowMap.transmitted`; `compileAsync(scene, camera)`. `trackTimestamp` **is** declared (`@types/three` `src/renderers/webgpu/WebGPUBackend.d.ts` line 11, inherited by `WebGPURendererParameters`) and is passed without a cast; it is forced to `false` when the adapter lacks `timestamp-query` (`WebGPUBackend.js` line 298). `Renderer.init()` always starts three's internal `Animation` rAF loop, which runs `info.reset()` when `autoReset` (`Renderer.js` line 842, `Animation.js` line 81). `renderer.info.memory.texturesSize` counts every compressed texture as **1 byte** (`Info.js` lines 449–453) <!-- amended 2026-09-25: render IMPLEMENTATION-NOTES C1, C9, C17 --> |
| `RenderPipeline` | `three/webgpu` | `new RenderPipeline(renderer, outputNode?)`; `outputNode`, `outputColorTransform`, `needsUpdate`, `render()`, `dispose()` — `dispose()` disposes only its quad material, never the display nodes' render targets (`RenderPipeline.js` lines 165–167). `PostProcessing` is a deprecated alias since r183 and is not used |
| `PMREMGenerator` | `three/webgpu` | `fromScene(scene, sigma = 0, near = 0.1, far = 100, { size = 256, position, renderTarget })`; `dispose()` |
| `pass`, `mrt`, `output`, `normalView`, `velocity`, `renderOutput`, `acesFilmicToneMapping`, `screenUV`, `uniform`, `texture`, `triplanarTexture`, `hue`, `saturation`, `luminance`, `vertexColor`, `userData`, `time`, `hash`, `mx_noise_float`, `positionWorld`, `positionView`, `positionGeometry`, `normalGeometry`, `normalWorld`, `cameraPosition`, `cameraProjectionMatrixInverse`, `getViewPosition`, `fog`, `densityFogFactor`, `smoothstep`, `mix`, `select`, `Fn`, `If`, `Discard`, `float`, `vec2`, `vec3`, `vec4`, `color` | `three/tsl` | `PassNode.setMRT(mrt({...}))`, `getTextureNode(name = 'output')`, `getViewZNode(name = 'depth')`, `getLinearDepthNode`, `setResolutionScale`; `MRTNode.merge` merges a material's `mrtNode` into the pass MRT (`NodeMaterial.js` line 564–574); `renderOutput(color, toneMapping = null, outputColorSpace = null)`; `hue(color, radians)` (rotation about `(0.577, 0.577, 0.577)`, verified in `ColorAdjustment.js`); `triplanarTexture(texX, texY?, texZ?, scale = 1, position = positionLocal, normal = normalLocal)` — reads `texX.value` at build time and creates fresh `texture(value, uv)` nodes, so a later map re-point does not reach the samples (`TriplanarTextures.js` lines 26–46); `userData(name, type)` reads `object.userData[name]` per render object — a `'vec3'` uniform reads `.x/.y/.z`, so a `Color` must use type `'color'` (a `'vec3'` Color uploads NaN; `UniformsGroup.js` lines 365–367 vs 431–433). Inside a post graph `cameraProjectionMatrixInverse`/`cameraWorldMatrix` resolve to the fullscreen `QuadMesh`'s orthographic camera (`Camera.js` lines 140, 236; `QuadMesh.js` line 9) — scene-camera matrices are passed as own uniforms. `normalMap()` returns a **view**-space normal (`NormalMapNode.js` line 126); `normalGeometry` is the raw object-space attribute. A TSL `Fn` callback's second argument is the `NodeBuilder` (`TSLCore.js` line 596) <!-- amended 2026-09-25: render IMPLEMENTATION-NOTES C3, C4, C6, C7, P6 --> |
| `ao` (`GTAONode`) | `three/addons/tsl/display/GTAONode.js` | `ao(depthNode, normalNode, camera)`; uniforms `radius`, `thickness`, `scale`, `samples`; `resolutionScale`; `useTemporalFiltering`; `getTextureNode()`; `distanceExponent`/`distanceFallOff` deprecated since r186 (not set) |
| `traa` (`TRAANode`) | `three/addons/tsl/display/TRAANode.js` | `traa(beauty, depthTextureNode, velocityTextureNode, camera)`; "MSAA must be disabled when TRAA is in use" |
| `bloom` (`BloomNode`) | `three/addons/tsl/display/BloomNode.js` | `bloom(node, strength, radius, threshold)`; uniform `smoothWidth` (default 0.01); `setResolutionScale`; 5 mips fixed |
| `dof` (`DepthOfFieldNode`) | `three/addons/tsl/display/DepthOfFieldNode.js` | `dof(node, viewZNode, focusDistance = 1, focalLength = 1, bokehScale = 1)`; CoC = `smoothstep(0, focalLength, |−viewZ − focusDistance|)`, split into near (`signedDist < 0`) and far fields; no mask input exists; owns 6 render targets plus 2 inside its `GaussianBlurNode` (lines 88–134, 199) |
| `film`, `chromaticAberration` | `three/addons/tsl/display/{FilmNode,ChromaticAberrationNode}.js` | `film(input, intensityNode?)` mixes `base` with `base·(1 + noise)` by `intensity`; `chromaticAberration(node, strength, center, scale = 1.1)` — the documented `center = null → screen centre` default is **not implemented**: a `null` reaches the layout `Fn` and the build throws (lines 136, 169), so the centre is passed explicitly |
| `CSMShadowNode` | `three/addons/csm/CSMShadowNode.js` | `new CSMShadowNode(directionalLight, { cascades, maxFar, mode: 'uniform'|'logarithmic'|'practical'|'custom', lightMargin, customSplitsCallback })`; `fade`; `updateFrustums()` — dereferences `this.camera`, which is set only on the node's first build (lines 65, 160, 215–216, 506), so a call before the first render throws; each cascade clones `light.shadow` (so `mapSize` is shared) with `bias × (i + 1)` (lines 175–176); attached through `light.shadow.shadowNode` (read in `AnalyticLightNode.js` line 214) |
| `SunLight` / `SunLightShadow` | `three/addons/lights/SunLight.js` | **Not used.** `SunLightShadow` is "two cascaded shadow maps" (its own header); Pillar 4 requires 4 |
| `SkyMesh` | `three/addons/objects/SkyMesh.js` | uniforms `turbidity`, `rayleigh`, `mieCoefficient`, `mieDirectionalG`, `sunPosition`, `cloudCoverage`, `cloudDensity`, `cloudScale`, `cloudSpeed`, `cloudElevation`, `showSunDisc`; node-material sky (the `Sky` class is the WebGL one); projects to the far plane (`position.z = position.w`, line 215) and derives the view ray from `positionWorld − cameraPosition` (line 239), `BackSide`, `fog = false` (lines 385–387) |
| `KTX2Loader` | `three/addons/loaders/KTX2Loader.js` | `setTranscoderPath(path)`, `detectSupport(renderer)` (after `renderer.init()`), `loadAsync`, `dispose()`; transcoder files `basis_transcoder.js` + `basis_transcoder.wasm` in `three/examples/jsm/libs/basis/` |
| `MeshStandardNodeMaterial`, `MeshPhysicalNodeMaterial`, `MeshBasicNodeMaterial` | `three/webgpu` | node slots `colorNode`, `normalNode`, `emissiveNode`, `roughnessNode`, `metalnessNode`, `aoNode`, `positionNode`, `castShadowPositionNode`, `maskShadowNode`, `alphaTestNode`, `mrtNode`, `outputNode`; physical adds `clearcoatNode`, `clearcoatRoughnessNode`. Shadow pass (`Renderer.js` `_getShadowNodes`): uses `castShadowPositionNode` else `positionNode`; multiplies shadow alpha by `map.a` sampled at the raw uv **and** by `colorNode.a` (lines 3540, 3546); discards where `maskShadowNode`/`maskNode` is false; renders `FrontSide` materials with `BackSide` unless `material.shadowSide` is set (line 50, 3767). MRT blending: per-attachment blend state comes from the **pass/renderer** MRT (`renderObject.context.mrt`, `WebGPUPipelineUtils.js` lines 131, 146); a material's own `mrtNode` blend modes never reach the pipeline — unnamed attachments are written with no blending <!-- amended 2026-09-25: render IMPLEMENTATION-NOTES P4, P5, P7 --> |
| `SpriteNodeMaterial` | `three/webgpu` | **Not used for creatures** — it is unlit (`NodeMaterial` with sprite defaults); Pillar 5 needs a lit surface. Used for nothing in v1 |
| `InstancedMesh`, `LOD`, `PlaneGeometry`, `LatheGeometry`, `ExtrudeGeometry`, `OrthographicCamera`, `CanvasTexture`, `DirectionalLight`, `SpotLight`, `PointLight`, `HemisphereLight`, `Sprite` | `three/webgpu` | `LOD.addLevel(object, distance, hysteresis)`; the renderer calls `LOD.update(camera)` in `_projectObject` for **every** camera, shadow cameras included, unless `autoUpdate = false` (`Renderer.js` line 3258, `LOD.js` line 83); an `InstancedMesh` whose matrices fit the device's uniform-buffer limit (1 024 matrices at 64 KiB) keeps them in a per-mesh uniform array and compiles its own vertex program, above it an instanced attribute (`Instance.js` lines 41–67); `Points` rasterise 1-px points on WebGPU — sized particles are an instanced `Sprite` (`count`) with `PointsNodeMaterial` (`PointsNodeMaterial.js` lines 21–22, 166–173); `CompressedTexture.generateMipmaps === false` by default, `flipY === false`; a texture's `mipmaps` array holds **every** level including level 0 (`Textures.js` lines 506–508) <!-- amended 2026-09-25: render IMPLEMENTATION-NOTES C21, C23, P2, P8 --> |

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
  readonly adapter: string | null;             // device.adapterInfo.description (the backend keeps no adapter), else `vendor architecture`; null otherwise
}

export type WeatherKind = 'none' | 'sun' | 'rain' | 'sand' | 'hail';   // text-identical mirror of spine §2.5 (render may not import core)
export type HarvestLevel = 0 | 1 | 2;                                 // intact · thinning · harvested

export interface RenderStats {
  readonly drawCalls: number; readonly triangles: number;
  readonly textures: number; readonly textureBytes: number; readonly geometries: number; readonly programs: number; readonly renderTargets: number;
  readonly materials: number;                  // distinct Material.uuid under the zone root, debug layer excluded
  readonly shadowLights: number; readonly nonShadowLights: number;
  readonly gpuMs: number | null;               // last resolved whole-frame GPU ms; null without timestamp-query
  readonly passMs: Readonly<Record<BudgetPass, number | null>>; // the differential harness, or per render context with trackTimestamp (§10.10.3); null in play otherwise
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
  setShadow?(level: number): void;             // §10.3.7 honor shapes the world (added 2026-10-20): the zone's shadow 0..4; optional for fakes
  setSkyMood?(mood: 'majin' | 'tenjin' | null): void;   // §10.3.7 Majin vs Tenjin seasons (added 2026-10-20): the winning side's sky; optional for fakes
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

1. `const gpu = new WebGPURenderer({ canvas, antialias: false, alpha: false, depth: true, stencil: false, forceWebGL: o.forceWebGL ?? false, powerPreference: 'high-performance', outputBufferType: HalfFloatType, trackTimestamp: o.trackTimestamp ?? false })` — no cast: `trackTimestamp` is declared in `WebGPUBackendParameters` (header table; amended 2026-09-25). `antialias: false` is required: TRAA (§10.8) forbids MSAA.
2. `await gpu.init()`. Rejection → `createRenderer` rejects with `RenderInitError('no-gpu')`; the client shows its static message.
3. `backend = gpu.backend.isWebGPUBackend ? 'webgpu' : 'webgl2'`. On `webgl2` the renderer still runs (three's automatic fallback), the post graph drops `traa` to `smaa` (§10.8.3) and `caps.timestampQuery = false`. Nothing else branches on the backend; the WebGL2 path is allowed to run and is not budgeted (`50-verification-budget.md` §50.3).
4. `gpu.toneMapping = NoToneMapping; gpu.outputColorSpace = SRGBColorSpace; gpu.shadowMap.enabled = true; gpu.shadowMap.transmitted = false; gpu.info.autoReset = true`. Tone mapping happens **in the post graph** (`acesFilmicToneMapping`, §10.8), never in the renderer, so bloom's threshold and the DOF mask are evaluated on scene-linear values.
5. `ktx2 = new KTX2Loader().setTranscoderPath(o.transcoderPath ?? '/basis/').detectSupport(gpu)`. `caps.ktx2` = `'astc'` if `workerConfig.astcSupported`, else `'bc7'` if `bptcSupported`, else `'etc2'` if `etc2Supported`, else `'rgba8'`. Below `maxTextureSize 8192` → reject `RenderInitError('texture-size')` (the MRT targets at the 3840-wide drawing-buffer cap need it; the largest asset texture is a 2048² sprite atlas, §10.4.1). <!-- reconciled 2026-09-18: atlases are 2048², not 8192² -->
6. `scene = new Scene()`; `camera = new PerspectiveCamera(28, w / h, 0.5, 220)` (Pillar 1: vertical FOV 28°; near 0.5 and far 220 are fixed — the far zoom stop plus the far LOD band fits inside 220 m).
7. Lighting rig (§10.3), sky + PMREM (§10.3.3), fog node (§10.3.7), post graph for `o.effects` (§10.8), HUD (§10.9), `BattleStage`, `ActorPool` are constructed **before** `createRenderer` resolves, so the first `frame()` has no lazy allocation.
8. Warm-up: one frame is rendered **through the real pipeline** (scene-pass MRT + shadow variants) with a warm-up scene holding one instance of every library material structure and one billboard. `gpu.compileAsync(scene, camera)` alone is not enough: it compiles non-MRT programs the scene pass never uses (render IMPLEMENTATION-NOTES C11). `RenderStats.programs` after this step is the programs baseline of the leak test. Programs are deduplicated by WGSL source and **the scene's punctual-light set is part of every lit program's source** (`LightsNode`), so a zone whose light set differs from the warm-up's compiles one variant per lit structure on its first frame (measured +28 programs on Mirevale) — "the first zone frame compiles nothing" holds only if `loadZone` warm-compiles with the zone's light set before adding the root (recommendation R6). On the dev iGPU the step-8 frame took ≈ 16 s of synchronous compilation (C19). <!-- amended 2026-09-25: render IMPLEMENTATION-NOTES C11, C19, and Part 2 "Open: programs 107 > 96" --> Amended 2026-10-06 (handover): the renderer's `lighting` is the fixed light layout of §10.3.2, set at step 4, so the scene's light set — and every lit program's source and cache key — is the boot's in every zone. A zone compiles only its own structures (instanced scatter, its geometry layouts), never light-set variants. Measured: 89 programs after step 8, 107 with Mirevale, still 107 after a handover to mire_route and back (the harness: 109 before, at the first destination frame and settled; before the layout 109 → 119–125 → 113). <!-- amended 2026-10-06: handover fixed light layout — render IMPLEMENTATION-NOTES "Handover: fixed light layout" -->

`renderer.setAnimationLoop` is **not** used. The client owns the loop (`20-client.md` §20.4.2: fixed 60 Hz simulation, then exactly one `renderer.frame(frameDt)`). three's `Renderer.init()` nevertheless starts its internal `Animation` loop (header table), which resets `info` and advances the node frame once per display frame; `frame()` advances the node frame itself when it is called twice inside one rAF tick (warm-up, harness loops). `frame(dtMs)`: (1) `camera.update(dtMs * timeScale)`; (2) `daycycle.update()` (uniforms only; PMREM re-bake when due, §10.3.4); (3) `billboards.update(dtMs * timeScale)` (uniform writes only); (4) `pipeline.render()`; (5) `hud.drawIfDirty()` then `gpu.autoClear = false; gpu.render(hudScene, hudCamera); gpu.autoClear = true`, with `gpu.outputColorSpace = gpu.workingColorSpace` for that call (§10.9: otherwise `render()` draws into the intermediate framebuffer target whose output pass overwrites the post image); (6) copy `gpu.info` into the stats record; (7) when `caps.timestampQuery` and a resolve is not in flight, `gpu.resolveTimestampsAsync(TimestampQuery.RENDER).then(ms => stats.gpuMs = ms ?? null)`. Render-on-demand: when `document.hidden`, the client does not call `frame()`; the package renders nothing on its own.

**Pre-compilation and the two-phase zone compile** (amended 2026-09-30). Step 8 pre-compiles its warm-up objects and the persistent scene objects (the battle arena) through `gpu.compileAsync` before its warm-up frame, keeping the scene pass's render target, MRT, render call depth and TRAA's velocity projection set for the whole compile (render Part 4 H4: without each of them the pre-compiled programs differ from the frame's). `loadZone(spec, { focus })` then compiles the zone against **its** light set in two phases. Phase 1 — awaited: the units the first diorama view at `focus` draws (in the predicted view frustum padded 12 m, or within 28 m of the player, at the LOD level and scatter tiers ≤ 1 that view picks) plus the actor, billboard, decal and VFX warm objects; `loadZone` resolves when phase 1 is done. Phase 2 — in the background at low priority, one unit at a time with a `scheduler.postTask('background')` slot before each: the beacon housing and the arena, then the rest of the zone nearest first, then the warm library quads. Every zone unit stays on a gate layer the scene camera does not render until its own compile finished, so no frame ever compiles it synchronously (far units pop in when ready). Disposing the zone cancels its run: in-flight units abort inside the node build and the render objects created after the dispose are released. `onCompileProgress({ phase: 'boot' | 'zone' | 'background', zone, loaded, total, done, ms })` counts units. `Renderer.compileIdle()` resolves when the background phase ended; `RendererOptions.backgroundCompile: false` (and the default for `trackTimestamp` renderers, i.e. the harness) makes `loadZone` resolve only when everything is compiled. The first zone frame then builds only the shadow-pass variants and the post quads. Measured cold on the dev iGPU (fresh profile, no shader cache): see render IMPLEMENTATION-NOTES Part 5 T4. <!-- amended 2026-09-30: P4-C3 (render Part 4 H4) and render Part 5 T4 -->

**Device loss** (amended 2026-10-06, Phase E6). `createRenderer` subscribes to the WebGPU `GPUDevice.lost` promise right after step 3 (before the warm-up, which takes seconds). A loss — any reason except `'destroyed'`, which is `dispose()` destroying its own device — sets `Renderer.deviceLost = { reason, message }`, makes every later `frame()` a no-op and calls `RendererOptions.onDeviceLost(info)` once. A lost renderer is never revived: its owner disposes it (every dispose step tolerates the dead device) and creates a new one on the same canvas. The client does that without unmounting React or touching the session (`20-client.md` §20.4.2). The WebGL2 fallback has no device-lost path (a lost WebGL context is out of scope). Test: `packages/render/test/device-lost.test.ts` (`watchDeviceLost` with a fake device). <!-- amended 2026-10-06: Phase E6 -->

**Handover keep** (amended 2026-10-06, Phase E3). `Renderer.prepareHandover(next)`, called right before the current zone's `dispose()`, makes that dispose's `materials.evictExcept` keep `next`'s surfaces (step 3 of §10.5.9 with `nextKeep` = the next zone's bound set). Shared surfaces, most of a biome's set, are therefore not fetched and transcoded again; `loadZone(next)` follows as usual. `MaterialLibrary.prefetch(ids)` (an addition to §10.2.3) fetches the `field` files of non-resident surfaces into the browser's HTTP cache, one at a time at `priority: 'low'`, with no transcode and no GPU memory; this is the client's phase-5 neighbour prefetch (`20-client.md` §20.10.3). <!-- amended 2026-10-06: Phase E3 -->

**Handover prepare** (amended 2026-10-06, handover). `Renderer.prepareZone(next, { focus })` builds `next` off the scene while the current zone stays up — root not in the scene, its lights not created (every zone is laid out around the origin, so they would light the current one), its hero tier held — and compiles every unit in the background, nearest the arrival first, each gated as in phase 2. The compile is valid for `next`'s own frames only because of the fixed light layout (§10.3.2): a compile while the current zone is up sees the same light set. `next`'s surfaces stay resident through the current zone's dispose. The next `loadZone` of the same zone (id, seed, harvest level) adopts it: the root joins the scene, its lights are created, its palette applied, phase 1 compiles only the first view's units the background run has not finished, and the run continues without background slots. A prepare of another zone, a `loadZone` of another zone or `Renderer.dropPrepared()` drops it (its eviction keeps the current zone's surfaces); one prepared zone at a time. The client prepares the linked zone whose link edge point the player is within 48 m of (`20-client.md` §20.10.3). Measured (`handover-hitch.spec.ts`, Intel Gen-12 iGPU): first destination frame 68–196 ms after `handoverAck` (three runs), `loadZone` 17–45 ms; the prepare itself 2.9–7.6 s in the background (machine load), whose longest frame (0.8–1.7 s) is the synchronous zone build. <!-- amended 2026-10-06: handover fixed light layout — render IMPLEMENTATION-NOTES "Handover: fixed light layout" --> Amended 2026-10-06 (handover II): the prepare's build is time-sliced. The zone build is a generator of steps (a terrain chunk, a skirt segment, a building wall, a prop, a pocket part, a scatter kind, a batch of digested geometries); `ZoneSystem.prepare` runs one slice of ≤ 8 ms per frame, started in a task right after the frame's animation callback (a slice ends after the step that crosses 8 ms; the longest steps take 15–47 ms on the dev iGPU, inside the main thread's idle time of a GPU-bound frame). The synchronous `buildZone` drains the same steps, so the geometry digest is identical (all 21 zones, drained, sliced and interleaved); every build has its own chamfer-box cache, so two interleaved builds never share boxes. Dropping a prepare stops its build between slices; an adopting `loadZone` finishes the rest without waits. Three keeps across zones (render IMPLEMENTATION-NOTES "Handover II"): scatter draws read their instances from geometry attributes (§10.5.7), so all scatter draws of a material and layout share one node build; a zone mesh's scene-pass node build is kept in three's cache after its last render object goes (shadow-pass builds are not: they are cheap, and kept ones re-initialised disposed hero textures); a disposed zone's pipeline releases wait until the next zone's phase 1 ends, or the next task when no load follows. Measured (`handover-hitch.spec.ts`, dev iGPU, HEAD before → after in the same sessions): node builds during the crossing 78 → 6; not preloaded 2 062–2 995 ms → 687–1 348 ms; the prepare's longest frame 683–1 150 ms → 67 ms, the idle frame's length (no frame over 100 ms), the prepare 2.8–3.9 s → 3.1–4.1 s. <!-- amended 2026-10-06: handover II — render IMPLEMENTATION-NOTES "Handover II: shared scatter builds, a time-sliced build" -->

### 10.1.3 Pixel-ratio policy

```
pr = min(o.pixelRatio, 1.5, 3840 / cssWidth)
```

so a 2560×1440 canvas renders at most 3840×2160 (`pr 1.5`) and a 3840-wide canvas at most `pr 1.0`. `renderer.setPixelRatio(pr); renderer.setSize(cssWidth, cssHeight, false)` (the client owns the CSS size). Every render target in the graph follows the drawing-buffer size through `PassNode.setSize`, which `RenderPipeline` drives; the GTAO and bloom nodes carry their own `resolutionScale` (§10.8). `resize()` also calls `camera.setAspect`, `hud.resize(cssWidth, cssHeight, pr)` and `csm.updateFrustums()` — a no-op until the first render (`CSMShadowNode.updateFrustums` dereferences a camera set only on its first build; header table). A hidden or not-yet-laid-out canvas reports 0×0: `resize` ignores sizes < 1 and keeps the last valid size.

### 10.1.4 Colour management

`ColorManagement.enabled` stays `true` (default). All albedo KTX2 textures are tagged `SRGBColorSpace`; ORM, normal, emissive-mask and sprite-normal textures are `NoColorSpace`. Output: the graph ends in `renderOutput(graded, NoToneMapping, SRGBColorSpace)` with `pipeline.outputColorTransform = false`, so the working-space→sRGB encode happens exactly once, after grain. The HUD canvas is drawn in sRGB and composited unlit on top: the overlay render sets `outputColorSpace = workingColorSpace` (as `RenderPipeline.render` does — with the two different, `Renderer.needsFrameBufferTarget` is true and a plain `render()` goes through the intermediate target, whose output pass copies it over the canvas and replaces the post image), the `CanvasTexture` carries raw sRGB bytes (`NoColorSpace`), and the quad composites premultiplied (`CustomBlending` One / OneMinusSrcAlpha), which is byte-exact browser compositing. <!-- amended 2026-09-25: render IMPLEMENTATION-NOTES P1 -->

### 10.1.5 Dispose order

`dispose()`: `hud.dispose()` → `stage.dispose()` → `actors.dispose()` → current `ZoneHandle.dispose()` if any → `PostStack.dispose()` (`pipeline.dispose()` disposes only its quad material, so the stack walks the graph and disposes every node that renders into its own targets — GTAO, TRAA, Bloom, DOF, SMAA and the `RTTNode`s that `traa()`/`dof()`/`chromaticAberration()` create through `convertToTexture` — plus the scene pass; amended 2026-09-25, render IMPLEMENTATION-NOTES C2) → `daycycle.dispose()` (PMREM generator + its target, sky mesh) → `materials.disposeAll()` (§10.2.8) → `ktx2.dispose()` → `await gpu.dispose()`. Calling it twice is a no-op. The leak test's baseline is taken **after** step 8 of §10.1.2 and before any `loadZone`, so library textures/materials/programs are part of the baseline and zone loads must return to it exactly.

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
Every surface ships **both tiers** under `<surface>.<tier>_<map>.ktx2` (`40-pipelines.md` §40.3.4). `MaterialLibrary.preload(ids)` resolves when the `field` tier of every id is resident; `preloadHero(ids)` upgrades the bound materials in place (a map re-point on a shared material, no new program) and is what `20-client.md` §20.10.3 phase 5 awaits; the replaced `field` set is **retired**, not disposed, and retired sets are released at the next `evictExcept` (three 0.186's shadow pass re-initialises a texture disposed while render objects of the zone can still be created); the hero stream of a zone starts after its phase-1 compile (§10.1.2). <!-- amended 2026-09-30: P4-C6, render Part 4 H5 --> A `field` texture at 512² over a 3 m tile is 170 texel/m — 1.5 texels per screen pixel at the default 111 px/m view — so the first frame is never visibly under-textured.

Runtime texture state stamped by the library on load: `wrapS = wrapT = RepeatWrapping`, `minFilter = LinearMipmapLinearFilter`, `magFilter = LinearFilter`, `anisotropy = 8`, `generateMipmaps = false` (compressed; the chain is in the file). The ORM texture object is bound to `aoMap`, `roughnessMap` and `metalnessMap` of the same material — one texture, one sampler, three slots. `aoMap` in node materials samples `uv` (verified: `MaterialNode.js` line 403–405, `aoMap.r − 1) · aoMapIntensity + 1`); no `uv1` attribute is required. Albedo textures are baked with **maximum luminance 0.85** (asset-audit rule `materials.albedoCeiling`); with the noon sun at 1.0 and the IBL at ≤ 0.25 (§10.3.5, in SPEC light units — see there: three's physically based lights need the rig to write `value × π`) the brightest **diffuse** non-emissive pixel is ≤ 1.10 scene-linear, under the 1.15 bloom threshold (Pillar 8). Specular highlights are not bounded by this arithmetic (a wet `slate_roof` at roughness 0.18 or a `clearcoat` 0.4 can exceed it); measured on the intact Mirevale noon frame: median 0.34, p99 0.65, max 5.6 scene-linear, with only emissive housings above 1.15 (render IMPLEMENTATION-NOTES "Measured in the browser"). <!-- amended 2026-09-25: render IMPLEMENTATION-NOTES C15, C16 -->

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
| cinder | `cinder_basalt`, `cinder_ash_soil`, `cinder_scoria`, `lava_crust`, `lava_glow` (emissive per-texel: albedo × 4.0 <!-- amended 2026-10-11: M3 town art -->, PointLight housing), `obsidian` (clearcoat 0.6), `charred_timber`, `iron_grate`, `forge_brick` |
| salt | `salt_sand`, `wet_rock` (clearcoat 0.5), `barnacle_stone`, `driftwood`, `rope`, `sailcloth` (alpha card), `harbour_plank`, `sea_water` (`transmission 0.7`), `tide_pool` |
| storm | `storm_slate`, `copper_oxide` (metal 0.9, roughness 0.35), `coil_brass` (metal 1.0), `insulator_glass`, `lightning_glass` (emissive `#9fd0ff` 3.6), `tower_stone`, `wet_flagstone` |
| marrow | `marrow_sandstone`, `bone_chalk`, `ore_vein` (emissive `#ffc766` 1.6), `mine_timber`, `rail_iron`, `canyon_dust`, `gypsum_crystal` |
| vesper | `vesper_bark_black`, `grave_moss`, `wrought_iron`, `candle_wax` (emissive `#ffd08a` 2.4), `mist_glass`, `willow_leaf` (alpha card), `bog_water`, `lichen_stone` |
| forge | `forge_steel_plate` (metal 1.0, roughness 0.30), `rivet_iron`, `anvil_black`, `coal_glow` (emissive `#ff7a2a` 3.0), `castle_granite`, `banner_cloth` (alpha card), `chain` |
| sky | `sky_marble`, `cloud_stone`, `gold_leaf` (metal 1.0, roughness 0.22), `prayer_silk` (alpha card), `dragon_scale_tile`, `frost_glass`, `pine_needle` (alpha card), `snow` |
| capital (`solenne`) | `sun_marble`, `gilt_bronze`, `stained_glass` (emissive per-texel mask 2.0), `plaza_pale_stone`, `fountain_water`, `laurel_leaf` |
| shrine (`eclipse_shrine`, `celestial_spire`) | `void_glass` (emissive `#7be0d0` 2.8), `star_iron`, `eclipse_stone`, `ring_light` (emissive `#c7f4ff` 3.4) |
| rift (`the_rift`) | `rift_shard` (emissive `#b46bff` 2.2), `unmade_stone` (**always** renders at harvest level 2 — the Rift is the in-fiction origin of the flat look), `void_floor` |

A palette's three terrain layers and plaza may name a row of another biome (Stormrook's ground is `grave_moss`, Skyrend's paths `path_gravel`); the zone then binds that surface too and `MaterialBudget` counts it. <!-- amended 2026-10-11: M3 town art -->

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

**The diorama occluder fade** (amended 2026-09-30, render Part 5; audit M2-spawn-noon-9: the heart-tree crown hid the player at the Mirevale spawn). Every library material except the triplanar ground layers and water carries one `maskNode`: fragments inside a capsule around the segment from the camera to the player's chest (feet + 0.9 m; full fade inside 1.2 m, eased out by 1.8 m), at least 0.35 m in front of the player (1.0 m until 2026-10-06: a pine crown reaching down to chest height inside that last metre stippled the player, M3 review R-all-6), are discarded by an interleaved-gradient-noise dither keeping 12.5 % of them (TRAA resolves it), scaled by `1 − shotBlend` (off in battle / inspector shots). A second volume fades the **foreground** (amended 2026-10-06, M3 review R-all-9 / R-saltmourn-3: tall crowns, roofs and set-pieces between the camera and the focus missed the capsule and filled 20–45 % of the frame as DOF blur): fragments more than 2.0 m in front of the focus, measured horizontally toward the camera, and more than 3.2 m above the followed feet, each edge eased over 1.0 m, take the same dither. Ground dressing, fences, bushes and lamp posts in front of the focus stay; nothing behind the focus is touched. A render-group uniform makes it apply only to render calls with the scene camera, so shadow maps and probes keep the full occluder. The inputs are shared uniforms written once per frame; nothing compiles at runtime.

Every library material of class `standard`/`physical`/`card` is built by one function, `buildSurfaceGraph(def, set, u)`, which assigns these node slots (TSL, `three/tsl`):

```ts
// p = the surface's per-material UNIFORMS (albedoScale/Bias, roughScale/Bias, metalScale/Bias, tileScale, emissive, clearcoat,
// wetResponse, …): every per-surface number is a uniform, so surfaces of one structure share one program (§10.10.2 programs cap)
const h   = u.harvestLevel.clamp(0, 2).div(2);                    // 0 intact .. 1 harvested
const uvN = uv().mul(p.tileScale);                                // builders emit metre UVs; tileScale = 1 / manifest.metres
const sample = (base: TextureNode) => def.triplanar ? triplanarSample(base, p.tileScale) : texture(base, uvN);
// triplanarSample samples texture(base, uvAxis) — it follows base.value, so a hero-tier re-point reaches it; three's
// triplanarTexture() reads the texture at build time and would keep sampling the placeholder
const alb = sample(set.albedo), orm = sample(set.orm), nrm = sample(set.normal);

// Pillar 2 vs harvested: the SAME graph, blended by one uniform. The baked maps are ABSOLUTE colour/roughness
// (40-pipelines.md §40.3.6): scale 1 / bias 0 once the set is bound; scale 0 / bias = SurfaceDef value while the
// placeholder is bound, so the placeholder renders as the surface's base colour ("nothing renders black").
m.colorNode     = vec4(mix(alb.rgb.mul(p.albedoScale).add(p.albedoBias), vertexColor().rgb, h), alb.a);  // vec4: alpha test and the shadow pass read colorNode.a
// amended 2026-10-11 (M3 town art): albedoScale = SurfaceExtras.albedoCal (0.82–0.88 for snow, salt_sand, sky_marble, cloud_stone,
// bone_chalk, plaza_pale_stone, sun_marble; 1 otherwise) once the set is bound. A card surface first re-tones toward the zone's
// Palette.grassTone: rgb = mix(rgb, luminance(rgb) · tone.xyz, tone.w), one vec4 uniform (no program change)
m.normalNode    = mix(normalMap(nrm, float(1)), normalView, h).normalize();         // normalMap() is VIEW space; level 2 = geometry normal (face normal when unwelded)
m.roughnessNode = mix(orm.g.mul(p.roughScale).add(p.roughBias), float(0.95), h);   // level 2 = flat rough
m.metalnessNode = mix(orm.b.mul(p.metalScale).add(p.metalBias), float(0), h);
m.aoNode        = mix(orm.r, float(1), h);
m.emissiveNode  = mix(p.emissive, alb.rgb.mul(p.emissive), p.emissiveFromAlbedo).mul(oneMinus(h));   // p.emissive = colour × intensity (0 when none); stained_glass takes it from albedo; level 2: no light sources (Pillar 4 off)
if (def.clearcoat) { pm.clearcoatNode = mix(p.clearcoat.base, p.clearcoat.wet, u.wetness).mul(oneMinus(h)); pm.clearcoatRoughnessNode = p.clearcoat.roughness; }
m.roughnessNode = m.roughnessNode.mul(mix(float(1), float(0.45), u.wetness.mul(p.wetResponse)));   // wetResponse 0 for surfaces without `wetness`
if (def.wind)      { m.positionNode = windDisplace(positionLocal, p.wind, u); }    // §10.2.5
if (def.alphaTest !== null) { m.alphaTest = def.alphaTest; m.maskShadowNode = alb.a.greaterThan(def.alphaTest); }
```

<!-- amended 2026-09-25: the draft block multiplied the baked (absolute) maps by the SurfaceDef values a second time, returned a vec3 colour (breaks alpha test and card shadows), mixed a view-space normal with the object-space normalGeometry, sampled terrain through three's triplanarTexture (which never sees a re-pointed map) and inlined per-surface constants (83 surfaces → one program each, over the programs cap). Render IMPLEMENTATION-NOTES C4, C5, C6, M1, M2, M3, M17: 7 structures for 83 surfaces, library fragment programs 27 → 8 -->
Per-surface numbers are uniforms and the cheap feature flags too (wetness response, emissive-from-albedo, forced harvest, card wind amplitude, card back tint), so programs exist per `surfaceStructure()` = {standard, physical, card, water} × triplanar × trunk wind — **7 structures for the 83 surfaces**.

Flat shading at level 2: `normalView` inside the normal sub-build is the interpolated geometry normal; the zone builder emits **unwelded** triangles for buildings and rocks (each face its own vertices), so it is the face normal and the level-2 look is faceted, exactly the old game's look. Terrain and scatter stay welded (their level-2 look is smooth vertex colour, which matches the old terrain). `harvestLevel 1` ("thinning") is the midpoint blend: maps at 50 %, normal detail halved, emissive at 50 %.

`MaterialClass 'water'` is §10.5.6; `'emissive'` (`glass_warm`, `lava_glow`, …) is the same graph with `emissiveNode` set and `castShadow: false`.

### 10.2.5 Wind vertex animation (TSL, verbatim)

A TSL `Fn` callback's second argument is the `NodeBuilder` (header table), so the shared uniforms cannot be a second `Fn` parameter: `windDisplace` is a plain graph factory closing over `u`, and `stiffnessFromUv` is resolved at build time. <!-- amended 2026-09-25: render IMPLEMENTATION-NOTES C7 -->

```ts
export interface WindParams {
  readonly amplitude: UniformNode<'float', number>;
  readonly frequency: UniformNode<'float', number>;
  readonly stiffnessFromUv: boolean;          // cards: weight by uv.y (0 at the stem); trunks: by height / 6 m
}
export function windDisplace(p: Node, w: WindParams, u: SharedUniforms): Node {
  const amp = w.amplitude, freq = w.frequency;
  const wp   = modelWorldMatrix.mul(vec4(p, 1)).xyz;
  const phase = wp.x.mul(0.35).add(wp.z.mul(0.21)).add(u.windTime.mul(freq));
  const gust  = mx_noise_float(vec3(wp.xz.mul(0.05), u.windTime.mul(0.07))).mul(0.5).add(0.5);   // 0..1 slow gust field
  const sway  = sin(phase).mul(0.7).add(sin(phase.mul(2.3).add(1.7)).mul(0.3));
  const weight = w.stiffnessFromUv ? uv().y : p.y.div(6.0).clamp(0, 1);                       // cards: uv.y (0 at the stem); trunks: height / 6 m — chosen at build time
  const k = weight.mul(weight);                                                                 // quadratic stiffness
  const d = vec3(u.windDir.x, 0, u.windDir.y).mul(sway.mul(amp).mul(gust).mul(k));
  return p.add(d);
}
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

Split distances (camera-space depth): **0–14 m, 14–34 m, 34–72 m, 72–160 m**. At the default view (§10.7.1) the player stands 26 m from the camera inside cascade 1 (14–34), whose 2048 texels span a 20 m depth slab; the near cascade covers the foreground of the diorama. `csm.updateFrustums()` is called on resize, zoom-stop change and heading change (camera projection or basis change), never per frame, and is a no-op until the first render (header table). The `sun.target` is the camera's focus point (§10.7.1) so the cascades follow the player.

Local shadow casters: `SpotLight` with `angle 0.87 rad (100°)`, `penumbra 0.5`, `shadow.mapSize 512²`, `shadow.bias -0.0006`, `shadow.normalBias 0.03`, `shadow.radius 2`; `PointLight` casters (only `kind: 'lava' | 'fire'`) use `shadow.mapSize 256²` (6 faces). Amended 2026-10-06 (handover): superseded — a `castShadow` point source (lava / fire, like brazier / crystal / candle) counts against the shadow budget but renders no map; shadow maps are rendered only by the fixed layout's spot slots (§10.3.2). No zone casts with a point light (content survey: 0 of 21). <!-- amended 2026-10-06: handover fixed light layout — render IMPLEMENTATION-NOTES "Handover: fixed light layout" --> Shadow maps are rendered every frame in v1 (a static-caster cache is a follow-up; the budget row `shadows 2.0 ms` in `50-verification-budget.md` §50.2.1 is the assertion this design must meet).

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

**Fixed light layout** (amended 2026-10-06, handover). three 0.186's stock `LightsNode` puts every scene light's `id` into the cache key of every lit render object and emits one light node per light into its program, so each zone's own lights made every lit object a new node build on its first frame and, with a different count or kind mix, new programs (measured: a mirevale → mire_route crossing 6.4–8.9 s to the first destination frame, programs 109 → 119–125). The renderer's `lighting` (step 4 of §10.1.2) is therefore `LightLayout` (`lighting/layout.ts`):
- every non-shadow `PointLight` / `SpotLight` is looped from ONE uniform array (4 `vec4` per light: view position + cutoff, view axis + decay, colour × intensity + cos outer, cos inner) bounded by a uniform count, capacity 32 — the stock spot / point math (`getDistanceAttenuation`, `smoothstep(cos outer, cos inner, dot(L, axis))`; a point light is a spot whose cone factor is exactly 1). Adding or removing a zone's lamp, window, brazier or crystal changes uniform values, never a program or a cache key. One array: three's addon `DynamicLighting` keeps 3–4 arrays per light type, which took the lit fragment stages to 13 uniform buffers (WebGPU's per-stage limit is 12) and failed every lit pipeline;
- shadow-casting lights keep their own light node, keyed by id, so they are a fixed pool in the scene from construction: the sun, the hemisphere fill, the arena's 2 beacons and **2 shadow-casting spot slots** (`LIGHT_LAYOUT.shadowSpotSlots`) that a zone borrows for its shadow-map casters. A free slot has intensity 0, `shadow.autoUpdate = false` (never rendered) and a 1×1 map. 2, not 6: every slot is a shadow map each lit fragment samples whether lit or not, and WebGPU's 16 sampled textures per fragment stage bound the scene's maps (the billboard material with 4 cascades + 2 beacons + 6 slots measured 17). Content's maximum is 1 per zone (21 zones surveyed);
- `RenderStats.shadowLights` / `nonShadowLights` and the zone dump count the borrowed slots with the zone, never the free ones.
The visual result is unchanged: before/after shots (spawn-noon, gym-dusk, lamps-night on mirevale and cinderhold) differ by 0.2–0.7 / 255 on average, less than two runs of the same build. <!-- amended 2026-10-06: handover fixed light layout — render IMPLEMENTATION-NOTES "Handover: fixed light layout" -->

`ZoneBuilder` throws `RangeError('light budget')` in dev at the **7th** `castShadow: true` or the 25th `castShadow: false` source (Pillar 4 test: the count check fails the build). The shadow budget is 8 for the whole scene, and the arena's 2 shadow-casting beacons (§10.7.5) exist under the stage root from `createRenderer` on — they cannot be created at battle start, because adding a light changes the light set and recompiles every lit program — so a zone may spend at most 8 − 2 = 6. Amended 2026-10-06 (handover): a zone places at most **2** shadow-map casters (the layout's slots; the 3rd throws in dev, in prod it gets an unshadowed light and the audit fails); map-less `castShadow` sources still count toward the 8. `RenderStats.shadowLights` counts scene-wide (beacons included); the rig's own assert does not see the beacons. <!-- amended 2026-09-25: "9th" let a zone spend 8 and the scene reach 10 once the beacons were counted — render IMPLEMENTATION-NOTES P10, Q13, Z11 --> Each `LightSource` becomes one `SpotLight` (pointing −Y, `lamp`/`lantern`/`beacon`/`window`) or `PointLight` (`brazier`/`forge`/`lava`/`crystal`/`candle`/`fire`) plus its housing mesh whose material is the biome's emissive surface; the housing's world position is asserted within 0.6 u of the light's in `dumpZone()`. Flicker: `intensity × (1 + amplitude · sin(2π·hz·t) · 0.6 + amplitude · hash(floor(t·hz·3)) · 0.4)`, amplitude ≤ 0.15, written once per frame from the render-side clock (display only).

Default sources for the slice: Mirevale 6 shadow-casting `lantern` (plaza ring + gym door + healer door) + 10 non-shadow (`window` ×8, `lantern` ×2); Mire Route 2 shadow `lantern` (route sign, bridge) + 6 non-shadow `crystal` at the tablets and the tall-grass edges.

### 10.3.3 Sky and IBL

```ts
const sky = new SkyMesh(); sky.scale.setScalar(200); sky.layers.set(30);     // layer 30 = sky, excluded from GTAO normal write and from dumpZone; re-centred on the camera every frame (a 200 m box at the origin is exited on a 240 m route field)
sky.turbidity.value = 3; sky.rayleigh.value = 1.2; sky.mieCoefficient.value = 0.004; sky.mieDirectionalG.value = 0.8;
sky.cloudCoverage.value = 0.35; sky.cloudDensity.value = 0.4; sky.cloudScale.value = 0.0002; sky.cloudSpeed.value = 0.00002;
```

The PMREM is generated from a **separate** `Scene` containing only a second `SkyMesh` (same uniforms) with `showSunDisc.value = 0` (the header of `SkyMesh.js` recommends hiding the disc for environment maps), through `pmrem.fromScene(skyScene, 0, 0.1, 400, { size: 128 })`. `scene.environment = pmremTarget.texture; scene.environmentIntensity = envIntensity(t) × norm` (the sky-radiance normalisation of §10.3.5 "Units"). The **visible** sky is not normalised: at noon its horizon reaches ≈ 5.9 scene-linear, far above the 1.15 bloom threshold, which is acceptable only because no gameplay camera of §10.7 frames the sky (the default top frustum edge is 38° below horizontal, the battle camera's 14°, the inspector's 4°); a free or hostile-audit camera that sees the horizon blooms it (recommendation R9). Re-bake rule: when `|Δ sun elevation| ≥ 2°` since the last bake **or** 20 s of real time have passed, whichever first; at most one bake per frame; a bake at `size 128` costs ≤ 0.6 ms on the reference GPU and is not on the per-pass table (it is amortised inside `opaque`'s remainder). The previous `renderTarget` is reused (`options.renderTarget`), so re-bakes allocate nothing. Harvest level 2 sets `turbidity 20`, `rayleigh 0.2`, `cloudCoverage 0.9`, giving the grey flat sky of a forgotten place.

Hemisphere fill: one `HemisphereLight` whose colours are sampled from the palette's `skyZenith`/`groundBounce` (blended with the night pair by `daylight`), **normalised to a unit sky** (both divided by the sky colour's largest channel, so the ground keeps its ratio to the sky), and whose intensity is the §10.3.5 `hemi` column × the weather's `envMul` (noon 0.08; it was a fixed 0.18 that, with `envIntensity 0.85`, washed the noon key to ≈ 1.5:1). It exists so the shadowed side of a sprite never reads pure black under the noon set (Pillar 5 luminance test needs shadowed pixels that are lit, not clipped). <!-- amended 2026-10-06: Phase E2, the re-landed M2 re-light (audit M2-spawn-noon-2, M2-gym-dusk-2, M2-lamps-night-5, M2-spawn-noon-13); render IMPLEMENTATION-NOTES "Phase E1–E2" -->

### 10.3.4 Day/night driver

`timeOfDay t ∈ [0, 1)`, one full day = 48 real minutes (spine §4.1). `t = 0` midnight, `0.17` sunrise, `0.5` noon, `0.83` sunset (the render sun is a look decision: the server's gameplay day, `isDay` 0.25 ≤ t < 0.75, and its spawn tables are unchanged).

```
f = (t − 0.17) / 0.66                                            // 0 at sunrise … 1 at sunset (the day arc)
g = wrap(t − 0.83) / 0.34                                        // 0 at sunset … 1 at the next sunrise (the night arc)
elevationDeg(t) = day ? 70 · sin(π·f) : −60 · sin(π·g)           // +70 at noon, −60 at midnight; t 0.80 (shot 2) ≈ 10° up
azimuthDeg(t)   = day ? 150 − 120·f : 30 − 240·g                 // 150° at sunrise → 90° (+x) at noon → 30° at sunset; continuous
sunDir          = (cos(el)·sin(az), sin(el), cos(el)·cos(az))    // unit vector FROM the scene TOWARD the sun
sun.position    = focus + sunDir · 120; sun.target.position = focus
moon: its own path — elevation day ? −40·sin(π·f) : 40·sin(π·g) (40° up at midnight), azimuth day ? 360 − 60·f : 300 + 60·g
```

So `dusk` (0.80) is the golden hour with a raking key from the default heading's right, and the moon's shadows fall ≥ 110° from noon's. <!-- amended 2026-10-06: Phase E2, the re-landed M2 re-light (audit M2-spawn-noon-2, M2-gym-dusk-2, M2-lamps-night-5, M2-spawn-noon-13); render IMPLEMENTATION-NOTES "Phase E1–E2" -->

When `elevationDeg < −4` the `DirectionalLight` **becomes the moon**: same object, colour/intensity from the `moon` row, `csm` unchanged. There is no second directional light. `SkyMesh.sunPosition` follows the real sun even below the horizon (the sky model handles twilight).

### 10.3.5 Colour-temperature table (6 keyframes, linearly interpolated in sRGB then converted)

| key | t | Kelvin / note | sRGB | sun intensity | envIntensity | hemi | punctual multiplier |
|---|---|---|---|---|---|---|---|
| `night` | 0.00 | moon (look decision, not blackbody) | `#9fb4e6` | 0.30 | 0.10 | 0.06 | 1.00 |
| `predawn` | 0.15 | 2400 K | `#ff9d3f` | 0.10 | 0.18 | 0.07 | 0.80 |
| `golden_am` | 0.22 | 3000 K | `#ffbd7a` | 0.75 | 0.32 | 0.08 | 0.15 |
| `noon` | 0.50 | 5200 K | `#fff0dc` | 1.00 | 0.45 | 0.08 | 0.00 |
| `golden_pm` | 0.74 | 3600 K | `#ffd6a0` | 0.95 | 0.38 | 0.08 | 0.10 |
| `dusk` | 0.80 | 2400 K, sun 10° up | `#ffa04c` | 0.85 | 0.30 | 0.09 | 0.55 |

A warm key over a cool, low fill: noon key : hemisphere fill 12.5 : 1 and key : (fill + IBL) ≈ 1.9 : 1 (was 1.0 : 1.03). The `night` row is the moon at 0.30 over a 0.06 fill, so the moon casts readable shadows. `daylight` — the factor that blends the palette's night / noon pairs (hemisphere colours, fog colour, the grade's lift) — is the sun's elevation, `smoothstep(−8°, +14°, el)`, not the keyframe sun intensity (which the moon row now shares). Golden hour, `smoothstep(−3°, 2°, el) · (1 − smoothstep(16°, 30°, el))`, tints the fog toward the key colour (up to 45 % of it). <!-- amended 2026-10-06: Phase E2, the re-landed M2 re-light (audit M2-spawn-noon-2, M2-gym-dusk-2, M2-lamps-night-5, M2-spawn-noon-13); render IMPLEMENTATION-NOTES "Phase E1–E2" -->

Wrap: `dusk (0.80) → night (1.00 ≡ 0.00)`. `punctual multiplier` scales every `LightSource.intensity` — lamps are off at noon and full at night (Pillar 4: night is a light-set change).

**Units.** The `sun intensity` column (and the moon row and the `hemi` column of §10.3.3) is in *SPEC light units*: 1.0 lights a white Lambert surface to 1.0 scene-linear. three r155+ lights are physically based — a directional or hemisphere light of intensity `E` yields `ρ·E/π` on a Lambert surface — so the rig writes `value × SPEC_LIGHT_UNIT` with `SPEC_LIGHT_UNIT = π`; `LightSource.intensity` (candela-scaled three intensity) is written unchanged. The `envIntensity` column is also in SPEC units: `scene.environmentIntensity = envIntensity × norm`, `norm = clamp(0.3 / L, 0, 200)`, where `L` is the sky radiance seen by an upward 150° probe — predicted synchronously per bake from a measured `SKY_LUMINANCE_BY_ELEVATION` table and refined by an async 16² readback of the PMREM (which also absorbs weather cloud cover and the harvested sky). Unnormalised, `SkyMesh`'s Preetham radiance is ≈ 1.05 at noon (≈ 2.3 zenith / 5.9 horizon) and 0.0014 after dusk: the IBL supplied ~2/3 of all light and the frame bloomed. <!-- amended 2026-09-25: render IMPLEMENTATION-NOTES C15, C16; packages/render/src/lighting/rig.ts line 36, sky.ts lines 17–44 --> Pillar 5 test pair: `noon` vs `dusk` — mean luminance over a billboard's opaque pixels must differ by ≥ 12 %; with the key's luminance 1.00 → ≈ 0.45 (0.85 × the warmer `#ffa04c`, relative to noon), the IBL 0.45 → 0.30 and lamps 0 → 0.55 the difference is designed to be ≥ 35 % (2026-10-06; it was sun 1.00 → 0.12). `envIntensity` caps the IBL contribution at ≤ 0.25 scene-linear on a 0.85-albedo surface (0.85 × 0.85 × 0.3 average irradiance ≈ 0.22 — the 0.3 is the sky radiance the normalisation below holds the PMREM to), which is the number behind the 1.10 ceiling in §10.2.1. The directional light fades to 0 across the sun/moon switch (sun: elevation −4°…+2°, moon: +4°…+10°) so the direction flip at −4° does not pop shadows; it is never hidden (toggling `visible` changes the light set and recompiles every lit program).

### 10.3.6 Weather

`setWeather(w)`: `rain` → `wetness` ramps to 1 (4 s), rain sheet (one `LineSegments` of 4 000 streaks animated in the vertex stage from `windTime`, so hitstop freezes it; `layers 29`, no shadow), sun intensity ×0.55, `cloudCoverage 0.85`; `sun` → `cloudCoverage 0.1`, `envIntensity ×1.1`; `sand` → fog density ×2.5, tint `#c9a24a`; `hail` → the same sheet as short bright streaks (WebGPU has neither wide lines nor sized `Points`; header table), tint white, wetness as rain; `none` → defaults. <!-- amended 2026-09-25: `Points` + `pointWidth 3` cannot be drawn on WebGPU — render IMPLEMENTATION-NOTES M10, P8 --> Weather is cosmetic in the overworld (spine §4.1); battles set their own through `BattleStage.setWeather`. Phase D7: the client drives `setWeather` from `ZoneState.weather` (the server's per-biome schedule) and renders `none` inside an interior pocket and while a battle owns the stage.

### 10.3.7 Height fog (TSL, no raymarch)

```ts
const fogFactor = Fn(() => {
  const dist  = positionView.z.abs().sub(u.fogStart).max(0);                             // a clear zone round the camera (amended 2026-10-06)
  const hFall = exp(positionWorld.y.sub(u.fogBase).max(0).mul(u.fogFalloff).negate());   // 1 at/below base height, decays upward
  return oneMinus(exp(dist.mul(u.fogDensity).negate())).mul(hFall);
});
scene.fogNode = fog(u.fogColor, fogFactor());
```

Palette values for grove: `fogStart 15` (m of view depth before any fog), `fogDensity 0.00486` (per m past it; the implemented `0.018 × FOG_SCALE 0.27`), `fogBase 0.0` (m), `fogFalloff 0.35` (per m), `fogColor` from the keyframe (`#b9c7a8` noon, `#1a2030` night; golden hours pull it toward the key colour, §10.3.5). The binding number is the fog on the focus: the player's feet sit at `y ≈ 0` (so `hFall = 1`) and 26 m of view depth at the default stop, so `fogFactor = 1 − exp(−(26 − 15) · density)` — **5.2 %** (was 16 % at 0.0068 from the eye), 8.8 % at the far stop (34 m), while the skirt hills at 60–150 m still recede (20–48 %). Weather divides `fogStart` by its density multiplier. <!-- amended 2026-10-06: Phase E2, the re-landed M2 re-light (audit M2-spawn-noon-2, M2-gym-dusk-2, M2-lamps-night-5, M2-spawn-noon-13); render IMPLEMENTATION-NOTES "Phase E1–E2" --> The draft's 0.018 fogged the feet 37 % (46 % at 34 m), lifting and flattening the whole diorama and washing the inspector close-up; `sand` weather's ×2.5 still reaches 36 % at the default stop by design. <!-- amended 2026-09-25: render IMPLEMENTATION-NOTES M19, Z12, open item 4 --> `scene.fogNode` is read by `NodeManager.getFogNode` (verified, line 24). The sky mesh has `fog = false`. Light-shaft cards (≤ 6 per zone, additive alpha cards under lanterns at night, `layers 29`) are the only volumetric suggestion; there is no raymarch (§10.11).

**Shadow** <!-- added 2026-10-20: honor shapes the world -->. `DayCycle.setShadow(level)` (the client passes the zone's `ZoneState.shadow` outdoors, 0 in a pocket) multiplies, per level `l` 0..4 (`lighting/weather.ts` `shadowParams`): the sun by `1 − 0.12 l`, the hemisphere fill and the environment by `1 − 0.1 l`, the fog density by `1 + 0.2 l`, and moves the fog colour `0.14 l` of the way to `SHADOW_FOG` `#2b1e3a` after the weather's tint. Level 0 writes exactly what it wrote before. A change forces one PMREM re-bake.

**Sky mood** <!-- added 2026-10-20: Majin vs Tenjin seasons -->. `DayCycle.setSkyMood(mood)` (the client passes the last season's winning side in Solenne, outdoors) adds `turbidityAdd` to the sky's turbidity and multiplies its rayleigh by `rayleighMul` (`SkyController.setMood`, after the harvest blend), multiplies the environment by `envMul`, moves the sun's colour `sunMix` and the hemisphere's sky colour `hemiMix` of the way to `skyTint` (the top-down camera rarely sees the sky itself, so the side's light is what colours the capital), and moves the fog colour `fogMix` of the way to `fogTint` scaled by daylight (at least 0.2), before the shadow's tint: Majin `+9`, `×0.45`, `×0.92`, sky `#c0394f` (sun 0.35, fill 0.55), fog `#7a2433` at 0.38 (a hazed red light); Tenjin `−1.5`, `×0.7`, `×1.08`, sky `#ffd27a` (sun 0.3, fill 0.5), fog `#f0d79a` at 0.32 (a clear gold light). null writes exactly what it wrote before.

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
  readonly anim?: SpriteAnim;              // amended 2026-10-06: the side's flipbook (animated legendaries / mythicals only)
}
/** Amended 2026-10-06 (§10.4.5 flipbook; 40-pipelines.md §40.1.8): every page of an animated source, on the static frame's normalisation. */
export interface SpriteAnim {
  readonly atlas: string;                                                   // AnimAtlasSet.id, 'anim-<species>-<side>'
  readonly rects: readonly (readonly [number, number, number, number])[];  // per page u0, v0, u1, v1 in the anim atlas, v up
  readonly delaysMs: readonly number[];                                     // display time per page (the source's own delays)
  readonly staticFrame: number;                                             // the page `rect` shows
}
export interface SpriteDescriptor {
  readonly id: string;                     // creature/spawn/battler id (render-side key)
  readonly front: SpriteFrame; readonly back: SpriteFrame;
  readonly sizeScale: number;              // SpeciesDef.sizeScale 0.5..2.2
  readonly types: readonly [TypeName] | readonly [TypeName, TypeName];
  readonly variant: VariantKey;
  readonly isAlpha: boolean;
  readonly isShiny?: boolean;              // Phase D4 (additive): the sparkle; encoded as alphaGlow + 2 (no new per-object field)
  readonly shinyPalette?: ShinyPalette;    // <!-- added 2026-10-26 --> spine §3.7a `shinyPaletteOf`, worn in place of the variant's triple while isShiny; absent = the variant's
  readonly aura?: AuraKind;                // <!-- amended 2026-10-11: battle-form auras --> a battle form's live aura on the stage (§10.7.5); absent = none
}
export interface ShinyPalette { readonly hue: number; readonly saturation: number; readonly lightness: number }   // degrees, multipliers (spine §3.7a)
export type AuraKind = 'majin' | 'tenjin' | 'majin_gold';
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
/** Amended 2026-10-06: one side's flipbook — a cols × rows grid of `cell`² pages (non-square, ≤ 8192 per edge), 3 maps × 4 levels like an AtlasSet. */
export interface AnimAtlasSet {
  readonly id: string;                     // ManifestAnimAtlas.id, 'anim-<species>-<side>'
  readonly albedo: AtlasMap;
  readonly normal: AtlasMap;
  readonly emissive: AtlasMap;
  readonly width: number;                  // level-0 texels
  readonly height: number;
  readonly cell: number;                   // 512
  readonly normalScale: 0.5 | 1;
}
```

<!-- reconciled 2026-09-18: the sprite manifest is 40-pipelines.md's v2 (this section's earlier `AtlasSet { size: 4096 | 8192 }`, per-zone 4096² atlases and `single_<species>` files are superseded); creature atlases are WebP because UASTC measured 1.57× LARGER than lossless WebP on sprite content, the bundled encoder refuses > 12 Mpix, and ETC1S quantises the alpha slice — KTX2 UASTC stays the format for materials (§10.2.1) and model textures. 40-pipelines OQ-1 and OQ-3 are decided here -->
Atlases are **zone-affinity 2048² sets holding 2 species each** (front + back, 4 cells of 1024²); a zone binds the atlases listed in `manifest.zones[zoneId]` — **≤ 8 per zone** (the same texel budget as 2 × 4096²) — so a route's spawn set plus its statics, trainers and gym teams is ≤ 8 binds. A creature not in the current zone's atlases (a traded-in party member) is bound through `SpritePool.bindSingle(set, frame)`: render fetches its `home` atlas files and decodes only the creature's cells with `createImageBitmap(blob, x, y, w, h)` per map and mip level into a 1024² (normal 512²) texture set — the `single` is a runtime crop, never a file on disk; ≤ 6 such binds exist at a time (party size). An **opponent** battler whose species is outside the zone's bind list (the Warden/Champion teams in `solenne`, the story teams in `umbral_observatory` — spine §3.10 rule 11 caps only the overworld set) is bound for that battle by `bindAtlas` of its `home` atlas before `battleStart` plays and released after `battleEnd`; the zone's ≤ 8 plus ≤ 6 such battle binds is the worst case (render/client follow-up; amended 2026-09-25). Textures are built from the decoded `ImageBitmap`s with `image = level0`, `texture.mipmaps = [level0, level1, level2, level3]` (three reads `mipmaps[i]` as level `i` and the level count from `mipmaps.length`; header table), `generateMipmaps = false`, so the sampler's `lodMaxClamp` is 3 and the 256²-per-sprite level covers every authored view of a `sizeScale ≥ 1` creature (at `zoomStop 2` one is ≈ 122 px tall with the §10.4.4 lean → level 3.1, clamped to 3). <!-- amended 2026-09-25: `[level1, level2, level3]` would upload level 1 as level 0 — render IMPLEMENTATION-NOTES P2 -->

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
  bindAnimAtlas(set: AnimAtlasSet): Promise<void>;          // amended 2026-10-06: a flipbook atlas (§10.4.5), one material like any atlas; released by releaseAtlas(set.id)
  releaseAtlas(id: string): void;                          // also releases singles keyed on it when no billboard uses them
  acquire(d: SpriteDescriptor): CreatureBillboard;
  readonly uniforms: { readonly harvestLevel: UniformNode<'float', number>; readonly cameraYaw: UniformNode<'float', number>; readonly cameraLean: UniformNode<'float', number> };   // cameraLean: §10.4.4
  stats(): { readonly live: number; readonly atlases: number; readonly bytes: number };
  dispose(): void;
}
```

**Residency hooks** <!-- amended 2026-10-06 -->: `BillboardPool.atlasUsers(id)` / `atlasRefs(id)` report how many billboards sample an atlas and how many binds hold it (the client's residency never treats an atlas a billboard still samples as freed — render keeps it while users > 0); `BillboardPool.infoOvercountBytes()` is the level-0 bytes three's `Info` counts twice for every bound creature atlas, flipbook and single (subtracted from `RenderStats.textureBytes`, `50-verification-budget.md` §50.2.2); `CreatureBillboard.setFlipbook(on)` shows the card's static frame and stops sampling — and waiting for — its flipbook (a legendary static more than 52 m from the player); `FrameHook.textureOvercountBytes?()`. No program, material, draw-call or per-frame allocation change.

### 10.4.3 Geometry and anchoring

Quad: `PlaneGeometry(1, 1)` shared by every billboard, scaled per instance. World height `H = 1.6 m × sizeScale` (range 0.8–3.52 m); width `H × aspect`. The quad's local origin is the **foot point**: vertices span `y ∈ [−footV·H, (1 − footV)·H]`, so `setPosition` places the feet on the sampled ground. Texel density: 1024 texels over 1.6 m = 640 texel/m.

At the default view (26 m, FOV 28°, 1440 px) the screen shows 12.97 m vertically → 111 px/m → a `sizeScale 1` creature facing the camera squarely would be 178 px tall; with the §10.4.4 lean (card tilted 26° from vertical, 26° left between card and image plane) it is 178 · cos 26° ≈ **160 px** (6.4 texels/px, minified). At the battle camera (12 m, pitch 28°, lean 14°) it is 385 · cos 14° ≈ 374 px (2.7 texels/px). A strictly vertical card would read at `cos 52° = 0.62` of its height (110 px) in the diorama — the squat look the lean exists to remove. <!-- amended 2026-09-25: the 178 / 386 px figures ignored the camera pitch --> Magnification (Pillar 6's test regime) happens in the dex/party inspector (`stage.inspect`, 4 m) and at `zoomStop 0`. Filters: `magFilter = NearestFilter` (hard texels when magnified, Pillar 6), `minFilter = LinearMipmapLinearFilter` with the pipeline-built WebP mip chain (levels 1–3, box-filtered in premultiplied space, coverage-preserving so `alphaTest 0.5` does not thin creatures at distance — `40-pipelines.md` §40.1.6.3) so minification does not shimmer, `anisotropy = 1`, `generateMipmaps = false`. <!-- reconciled 2026-09-18: WebP chain, not KTX2 --> The Pillar 6 test reads the scene pass `output` MRT texture (pre-TRAA) at 1.3× magnification: along a 200-pixel straight opaque edge every alpha is 0 or 1. TRAA is the only stage allowed to soften it afterwards, by construction.

### 10.4.4 Facing the camera (yaw + half-pitch lean) — shadow-safe

`billboarding()` from `three/tsl` reads `cameraViewMatrix`, which during the shadow pass is the **light's** view, so a billboard would face the sun in its own shadow map. Not used. Instead two uniforms, written once per frame from the main camera:

```ts
pool.uniforms.cameraYaw.value  = Math.atan2(-camDir.x, -camDir.z);        // direction TOWARD the camera, projected to xz: the quad's +Z face must point at the camera (FrontSide)
pool.uniforms.cameraLean.value = 0.5 * Math.max(0, pitchDown);           // lean back about the foot line by half the camera's pitch-down (26° in the diorama, 14° in battle)
// positionNode: rotate the (bobbed) local position by cameraLean about local x at the foot point, then by cameraYaw about y;
// the same rotation is assigned to normalLocal/tangentLocal (the SkinningNode pattern) so the normal map lights the turned card
mat.positionNode = leanYaw(positionLocal.add(vec3(0, bob, 0)));          // bob: §10.4.6
```

<!-- amended 2026-09-25: `atan2(camDir.x, camDir.z)` with camDir = camera forward maps the quad's +Z face AWAY from the camera, where FrontSide culls it; a strictly vertical card is foreshortened to cos 52° = 0.62 of its height from the −52° diorama camera. Render IMPLEMENTATION-NOTES P3, P9, Q1 -->
Because the shadow pass falls back to `positionNode` (`Renderer.js` `_getShadowNodes`), the shadow silhouette has the same yaw and lean as the visible quad. `castShadowPositionNode` is left `null`. `positionNode` alone does not rotate `normalLocal`, so the graph assigns the turned normal and tangent explicitly (the shared quad carries a tangent attribute). Apparent height: `cos 26° = 0.90` of `H` in the diorama, 0.97 in battle, ≈ 1 in the inspector.

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
const evo = userData('glow', 'float');                           // §10.7.5 evolution sequence: 0 for every other billboard (amended 2026-10-05)
mat.colorNode     = vec4(mix(mix(c, a.rgb, h), vec3(1), evo), a.a);   // harvested: raw albedo, no palette (Pillar 5 off means unlit-looking; lighting below); evo → white
mat.normalNode    = mix(normalMap(n, float(1)), normalGeometry, h);   // derived normal lights the sprite (Pillar 5); level 2: flat
mat.roughnessNode = float(0.85); mat.metalnessNode = float(0);
mat.alphaTest     = 0.5;
mat.alphaTestNode = float(0.5).add(userData('dissolve', 'float').mul(0.5));                 // faint dissolve raises the cut
mat.maskShadowNode = a.a.greaterThan(mat.alphaTestNode);         // shadow from alpha (verified path: _getShadowNodes discards where mask is false)
// rim + emissive
const V     = cameraPosition.sub(positionWorld).normalize();
const rim   = pow(oneMinus(abs(dot(normalWorld, V))), 3.0);      // normalWorld here is the normal-mapped one (alpha-edge bevel gives outward normals at the silhouette)
const typeC = userData('typeColor', 'color');                    // 'color', not 'vec3': a vec3 uniform reads .x/.y/.z and a Color uploads NaN
const shimmer = glow.mul(0.25).mul(sin(pool.uniforms.clock.mul(3.0).add(uv().y.mul(8.0))).mul(0.5).add(0.5));   // pool clock advanced by dt × timeScale (hitstop freezes it), not `time`
mat.emissiveNode = typeC.mul(rim).mul(0.6).add(a.rgb.mul(em).mul(1.8)).add(a.rgb.mul(shimmer)).mul(oneMinus(h)).add(vec3(evo.mul(1.3)));   // evo: a glowing white silhouette of the card's own alpha
mat.mrtNode = mrt({ mask: vec2(1, userData('sharp', 'float')) });   // x: exclude from GTAO darkening; y: DOF-sharp (§10.8.2)
mat.side = FrontSide; mat.shadowSide = DoubleSide; mat.transparent = false; mat.depthWrite = true;
mat.map = null;   // the albedo is published as material.userData.ewaAlbedo: _getShadowNodes multiplies shadow alpha by map.a sampled at the RAW quad uv (the whole atlas)
```

<!-- amended 2026-09-25: typeColor 'vec3' → 'color', shimmer clock, shadowSide DoubleSide (the shadow pass renders FrontSide as BackSide, so a camera-facing card cast no shadow with the sun behind the camera), map null — render IMPLEMENTATION-NOTES P5, P6, P7, Q2 -->

Amended 2026-10-05 (render IMPLEMENTATION-NOTES Part 7): the per-object `glow` (0..1, `BILLBOARD.glowGain` 1.3) is the evolution sequence's white silhouette (§10.7.5). It is part of the one billboard program from the step-8 warm-up on, so a sequence compiles nothing — the warm-up billboard's 4 × 4 neutral set now uses a linear min filter (single level): three 0.186 treats a texture with Nearest min AND mag as unfilterable (`textureLoad`), so the Nearest/Nearest neutral set had compiled a different program from every atlas (Nearest mag, trilinear min), and the first creature drawn compiled the real one; `CreatureBillboard` gains `setGlow(v)`, `setShown(on)` (the group's visibility: a silhouette swap is no material, program or binding change) and `setSizeMul(k)` (a uniform scale about the foot point). <!-- amended 2026-10-05: render IMPLEMENTATION-NOTES Part 7 -->

Dissolve additionally discards `hash(floor(uvRect.mul(dissolveCells))).lessThan(userData('dissolve','float'))` texels, so a fainting creature breaks into texel-sized holes rather than fading (Pillar 6: alpha stays binary). <!-- amended 2026-10-06 --> `dissolveCells` is a per-object `userData('dissolveCells', 'vec2')`: 1024 per uv unit on a static atlas and a single (unchanged), `512 / (rect width, height in uv)` on a flipbook, so a 512² anim cell gets 1-texel holes — the same share of the creature as the static cell's 2-texel holes.

**Flipbook (amended 2026-10-06; 40-pipelines.md §40.1.8).** A side whose `SpriteFrame.anim` atlas is bound (`SpritePool.bindAnimAtlas`) plays its pages: each billboard advances its own flipbook clock by `dt × timeScale` (the pool's `update`, so hitstop holds it and slow-mo slows it), adds a per-id phase (`hash(id) × loop length`, so two creatures of a species never play in step) and maps the time onto the source's per-page `delaysMs`; when the page changes it writes the four scalars of the per-object `rect` — the same record the static frame uses — and nothing else (no allocation, no program, no material or texture switch, no draw call: the anim atlas is one ordinary atlas material of this graph, and every page lives in it). Lighting, the derived normal map, `maskShadowNode` (the alpha shadow), rim and emissive all sample the current page through `uvRect`; the card, its size, foot point and contact decal are the static frame's (the pages share its normalisation). The flipbook holds on its current page while the creature is fainted (the `faint` pose, or `setFaint(p > 0)` until a pose or `setFaint(0)`), so a fainting creature dissolves still; poses, the hurt flash, `enter`/`exit` dissolves and the evolution sequence (`glow`, `setShown`, `setSizeMul`) are unchanged. Until its anim atlas lands a side shows its static `rect` — the frame-select page, at the same place to the texel — and re-points once; a descriptor without `anim` never waits for or samples a flipbook. Thumbnails stay static. Measured in the sandbox (render IMPLEMENTATION-NOTES Part 8): the 10-legendary lineup and a two-legendary battle draw the same calls (235 / 359) and hold the same programs with flipbooks on as off. Creature emissive pixels output `1.8 × albedo` where the mask is 1. `BloomNode`'s high-pass thresholds **luminance** (`BloomNode.js` lines 12–15: `smoothstep(threshold, threshold + smoothWidth, luminance(rgb))`), so the emissive term alone crosses the 1.15 threshold only where `luminance(albedo_linear) > 1.15 / 1.8 = 0.639` (and contributes fully only above 1.20 / 1.8 = 0.667, the 0.05 smooth width). The §40.1.2 stage-4 mask (HSV value ≥ 0.92, chroma ≥ 0.4) admits warm and green accents that meet it (a `(1, 1, 0.6)` sRGB yellow: luminance 0.95 → 1.71) and saturated reds, blues and violets that do not (`(0.92, 0.52, 0.52)` red: 0.36 → 0.64; `(0.6, 0.6, 1)` blue: 0.37 → 0.66) — those glow in the beauty image but never bloom, at night or noon. The "threshold in the gap" claim therefore holds per hue, not per mask (recommendation R8). <!-- amended 2026-09-25: the draft read 1.8 × albedo ≥ 1.35 as a per-channel floor; bloom is luminance-keyed -->

Per-object parameters through `userData(name, type)` (verified `UserDataNode.js`): `object.userData = { rect: Vector4, hueShift, satMul, lightMul, alphaGlow, hurt, dissolve, sharp, typeColor: Color, bob }` — a preallocated record per billboard, scalar writes only. The dissolve hole mask is folded into the alpha, so `maskShadowNode` punches the same holes in the shadow. Billboards are alpha-tested: they are drawn in a `renderOrder ≥ 1` band so the shadow pass's shared override material does not flip its `alphaTest` between neighbouring solids and cards (§10.5.7).

### 10.4.6 Uniform tables

**Variant palettes** — the spine §3.7 triples verbatim, hue converted to radians for `hue()`:

| variant | hueShift (deg → rad) | satMul | lightMul |
|---|---|---|---|
| `normal` | 0 → 0 | 1.00 | 1.00 |
| `dawn` | 18 → 0.31416 | 1.08 | 1.04 |
| `dusk` | 204 → 3.56047 | 1.10 | 0.95 |
| `verdant` | 110 → 1.91986 | 1.12 | 1.05 |
| `ember` | −18 → −0.31416 | 1.15 | 1.02 |

A shiny whose descriptor carries `shinyPalette` (spine §3.7a, added 2026-10-26) writes that triple (hue → radians) into `hueShift` / `satMul` / `lightMul` instead of its variant's; `alphaGlow` keeps its +2 sparkle. `setVariant(v, isAlpha, isShiny?, shinyPalette?)` keeps the current shiny state and palette when the last two are omitted. The client's 2D thumbnails (`CreatureSprite shiny`) apply the same triple as `hue-rotate() saturate() brightness()`.

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
| Flipbook (amended 2026-10-06) | page = the source's per-page delays over `clock + hash(id) × loop`, `clock += dt × timeScale` except while fainted; `rect` rewritten on a page change only |
| Poses | `lunge`: position +0.9 m toward the foe over 120 ms, back over 180; `windup`: scale y 0.94 then 1.04 over 250 ms; `hurt` (amended 2026-10-21, §10.7.8 hit weight): 260 ms, squashed to scale y 0.86 at 50 ms, knocked back −0.38 m at 90 ms, a 1.05 rebound at 150 ms, settled by the end, + flash; `recoil`: −0.25 m back over 100 ms, return over 150, no flash (the `damage { cause: 'recoil' }` cue); `enter`/`exit`: dissolve 1 → 0 / 0 → 1 over 450/350 ms; `faint`: dissolve + 0.4 m sink; `celebrate`: two 0.15 m hops over 600 ms (battle end, winner's active battler) |

No pose creates a material or geometry; every pose is uniform writes on the shared quad and material.

### 10.4.7 Contact shadow and grounding

Each billboard owns one decal: `PlaneGeometry(1, 1)` (shared), rotated flat, scaled to `1.1 m × sizeScale` (×1.12 alpha), positioned at the feet on the sampled terrain height + normal (`TerrainCollider.normal`, §10.6), `MeshBasicNodeMaterial` shared across all billboards: `colorNode = vec4(0, 0, 0, 1)`, `opacityNode = smoothstep(0.5, 0.05, length(uv().sub(0.5))).mul(0.55).mul(oneMinus(h))`, `transparent = true`, `blending = MultiplyBlending` (which requires `premultipliedAlpha = true` on WebGPU), `fog = false` (fog would tint the multiply factor), `depthWrite = false`, `polygonOffset = true, polygonOffsetFactor = -2, polygonOffsetUnits = -2`, `renderOrder = 5`, `layers 28`. The pass MRT writes every non-`output` attachment with **no blending** (header table), so a transparent decal would overwrite the ground's normal/velocity/mask: the decal writes valid values — its own ground-up normal and velocity — and alpha-tests at 0.004 so fully transparent texels write nothing. It writes `mask (0, 0)`, not `(1, 0)`: it covers ground pixels, and excluding them from GTAO removed the ground's own contact occlusion inside the disc, which read as a light halo around every creature's feet. <!-- amended 2026-09-25: render IMPLEMENTATION-NOTES P4, Q14 --> The decal is the "soft occlusion gradient at the feet" of Pillar 5; the real cast shadow from `maskShadowNode` is the hard one. No y-epsilon anywhere: `polygonOffset` does the work.

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
  readonly obstacles?: readonly ObstacleSpec[];               // Phase D10: content `ZoneDef.obstacles` (id, kind, x, z); present only where content has some
  readonly neighbours?: Readonly<Partial<Record<Dir, NeighbourSpec>>>;   // Phase E3: the linked zones, keyed by the side of THIS zone they lie on (§10.5.5 skirt)
}

/** Phase E3: what the skirt needs of a neighbour, in ITS frame; `edge` = its playable-edge point on the shared link (`edgePoint(layout, opposite side)`). */
export interface NeighbourSpec { readonly id: string; readonly layout: Layout; readonly seed: number; readonly heightfield: HeightfieldData; readonly plan: ZonePlanData; readonly buildings: readonly BuildingSpec[]; readonly interiors?: readonly InteriorSpec[]; readonly edge: { readonly x: number; readonly z: number } }

/** Phase D10: drawn as its own object (tree: the biome's first scatter tree at 0.55 scale + a hidden stump; boulder: a 1.15 m rock); never merged. */
export interface ObstacleSpec { readonly id: string; readonly kind: 'tree' | 'boulder'; readonly x: number; readonly z: number }
/** Phase D10: per-player state on a built zone — a cleared tree shows its stump, a cleared boulder is gone; unknown ids ignored. */
export interface ObstaclesHandle { readonly ids: readonly string[]; setCleared(id: string, cleared: boolean): void; isCleared(id: string): boolean }

export interface ZoneHandle {
  readonly id: string;
  readonly group: Group;                                      // the zone root (Pillar 7: never removed during a battle)
  readonly collider: TerrainCollider;                         // §10.6
  readonly bounds: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
  readonly geometryDigest: string;                            // fnv1a32 over every geometry's position attribute bytes, in build order, 8 hex chars (§10.5.9)
  readonly obstacles?: ObstaclesHandle;                       // Phase D10: absent when the spec has none
  stats(): RenderStats;
  dispose(): void;                                            // idempotent; §10.5.9
}
```

### 10.5.2 Determinism

`Prng` (`zone/prng.ts`) is sfc32 with the spine's exact step (`| 0`, `>>> 0`, splitmix32 expansion of a numeric seed, 12 warm-up draws) re-implemented inside render — render may not import `@ewa/core`, and two copies of a 12-line function are cheaper than a rule exception. `packages/render/test/prng.test.ts` asserts `createPrng(12345).int(1000)` equals the constant committed in `packages/core/test/rng.test.ts` (the same literal, copied), so the two copies cannot drift silently. Every generator receives a `Prng` forked from `spec.seed` with a fixed label order (`fork('layout')`, `fork('scatter')`, `fork('props')`, `fork('lights')`), so adding a generator never reseeds the others.

### 10.5.3 Palettes

`PALETTES: Record<string, Palette>` where `Palette = { skyZenith, skyHorizon, groundBounce, fogColor: [night, noon], grade: { lift: [r,g,b], gamma: [r,g,b], gain: [r,g,b] }, terrainLayers: [SurfaceId, SurfaceId, SurfaceId], scatterTints: string[], grassTone?: { color: string; amount: number } }`. `grassTone` <!-- amended 2026-10-11: M3 town art (audit M3-all-3 / M3-all-4) --> re-tones the `tall_grass` card (tufts, tall grass, clumps) toward an sRGB target, so tufts read straw on salt sand, ash-brown on cinder and frosted on snow; absent = the baked green (grove, capital). The slice ships `grove_mirevale` and `grove_mire`: `grade { lift [0.01, 0.012, 0.0], gamma [1.0, 0.98, 0.96], gain [1.02, 1.03, 0.98] }` (warm greens); night lift `[0.0, 0.004, 0.02]`.

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

**Dressing pass** (amended 2026-10-06, Phase E1: "every town as rich as Mirevale"). `zone/generators/dressing.ts` adds, per biome (`DRESSING[biome]`), only what changes nothing a player can walk on — content's zone plan owns every solid and the server's heightfield is stamped from it: (1) walk-through verge clusters along every road and lane (door paths at half the rate): every 1.4 m and side, with probability `vergeRate` (0.70–0.85) × noise, a cluster 1.0–3.6 m past the edge — one or two bushes, 1–4 tufts, a flower patch, small stones; (2) small stones and tufts round each big rock (`rock_a`), and banded free scree in every biome (0.002–0.032 clusters/m²) plus crystal-shard clusters (scatter kind `crystal_shard`, the set's `props.crystal` surface, which those sets already bind) in shrine and rift; (3) a walk-through bush leaf for sets without one (salt: `tall_grass` clumps; storm / forge: `pine_needle`; cinder and marrow keep none — green clumps on ash and canyon sand read wrong), kept out of `BiomeSet.bushLeaf` so interiors and hand-placed bushes keep their look; per-biome ground-tuft tints (dry / ashen outside the grove); (4) wall-hugging house dressing (flower boxes, firewood, sacks, pots, kegs, small crates; 2–4 per wall side, never in front of the door, never at a gym) no deeper than 0.46 m, inside the building's collider pad (wall + 0.12 m + the 0.35 m capsule); (5) the town boundary for every biome just outside the walkable square (`half − 16 + 1.2`): dry-stone walls, post-and-rail fences or boulder dykes, with a gate pier either side of each 7.6 m road gap. Everything goes into the existing scatter kinds and per-chunk static meshes and binds only surfaces the set already binds: no draw call, material or program beyond the one shard kind (shrine / rift). (6) <!-- amended 2026-10-11: M3 town art --> walk-through clutter round a town plaza's rim (`PLAZA_CLUTTER`: salt nets, rope coils, fish baskets and lobster pots; storm cable spools; sky prayer cairns; cinder coal heaps, with kegs / small crates): 6–10 clusters of 2–4 items 1.3–2.3 m inside the rim, the first beside content's arrival point; every item ≤ 0.7 m tall and kept 0.9 m off hand-placed props and lights, 1.3 m off authored points, off roads, buildings and the set-piece. Measured in `.design/audits/M3-render-audit.md`; test `packages/render/test/dressing.test.ts`. <!-- amended 2026-10-06: Phase E1 -->

### 10.5.5 Layout

`layout.ts` (pure): `town` = a plaza (radius 14 m, `cobble`) centred at `(0, 0)`, 6–10 buildings on a ring of radius 22–30 m facing the plaza with 4 m gaps, gym at the north-most slot, shop/healer flanking the south road, roads (`path_gravel`, 3.5 m wide) from the plaza to each `edge`; `route` = a 12 m corridor along x with 3–5 tall-grass patches (ellipses 8×5 m) alternating sides, 2–3 clearings, the set-piece at the midpoint; `story` = the set-piece at the origin, a 20 m approach from the single edge. <!-- amended 2026-10-20: zone sculpts --> Every zone is sculpted (spine §3.11 Zone sculpts): a route's road winds edge to edge through cliffs, ravines, rivers and terraces on its own `road_main`, with authored tall grass and the set-piece on the road (`plan.corridor(x, z)` is the distance to that road, replacing `|z − roadZ(x)|`); towns and story zones keep their plaza / platform and gain their sculpt's landform. The builder draws the plan's `bridges` (a plank deck a hand above the walkable deck strip, fascias to below the waterline, posts and rails, segment by segment along the centreline; a crossing inside the set-piece's extent is the set-piece's own), `crags` (a faceted rock seated on each cliffed round lift), `structures` (curtain walls of stone blocks with merlons, palisades of stakes, round towers; nothing where a road cut the crest: a gate) and boulders bedded into every slope over 1.1 (cliff faces read as rock; walk-through, they stand on unwalkable samples). Scatter solids mirror content exactly (slope ≤ 0.9, `wetNear`, `roundBody` circles only for ponds); cinder water is drawn `lava_glow`. Trainers/npcs/pickups/tablets come from `spec.actors/pickups/tablets` (content positions) and are **not** moved by layout; layout only refuses to place scatter inside a 1.5 m radius of them or inside a building footprint. The terrain splat is geometric: the library has one material per surface, so terrain triangles are clipped on the zero lines of signed layer fields (plaza > path > detail > ground) into per-layer groups of one indexed chunk geometry, and `color` holds the layer albedo (the harvest level-2 colour), not blend weights. Building and prop footprints are **not** in content's `Heightfield.walkable` (spine §3.11 open gap): the builder registers them as `TerrainCollider` blockers (§10.6.2); render never edits `walkable`. <!-- amended 2026-09-25: "the footprints that content's walkable already encodes" was false — render IMPLEMENTATION-NOTES Z5, Z6 -->

**The skirt and the linked neighbours** (amended 2026-10-06, Phase E3; audit M2-link-east-1). Beyond the field, a skirt ring (2 m grid, reach 60 m, not walkable, not in the collider) continues the land, so the world never ends at a cliff of void. By default it rises into hills, with low valleys where roads leave. On a side whose link has a `ZoneSpec.neighbours` entry, the skirt is the neighbour's own terrain instead. The neighbour's `edge` point is laid on this zone's `edges[side]` point, and its heights are offset so the two points meet. Its heights replace the hills over the first 20 m past the field edge, and fade back to the hills over the 16 m inside the neighbour field's own boundary. Its road, plaza and detail layers (`splatAt` on its layout plan) fade in over 3 m. The skirt treeline and rocks keep 4 m clear of its roads. The neighbour's props, actors and lights are not drawn, so this adds no draw call, material or program beyond the skirt's existing terrain groups. The client adds `neighbours` with `withNeighbours(zoneSpecFor(z, h), z)`; `zoneSpecFor` itself, its snapshot, and the digest of a zone built without neighbours are unchanged. Test: `packages/render/test/neighbour-skirt.test.ts`. <!-- amended 2026-10-06: Phase E3 -->

### 10.5.6 Water

`water_pond`/`sea_water`/… are `MeshPhysicalNodeMaterial` with `transmission`, `roughnessNode = float(0.05)`, `normalNode = normalMap(texture(set.normal, uv().add(vec2(u.windTime.mul(0.012), u.windTime.mul(0.007)))), 0.35)` blended with a second sample at 0.7× scale scrolling the other way; depth tint `mix(shallow, deep, saturate(depthBelow / 2.5))` where `depthBelow` is the terrain height sampled into a vertex attribute at build time (no depth-buffer read). `castShadow = false`, `receiveShadow = true`. Harvest level 2 collapses it to the flat vertex colour like every other surface.

### 10.5.7 Scatter, LOD, culling

**Ground-cover masks** (amended 2026-09-30, render Part 5 T1 / T3). One `ScatterMask` per zone root (24 disc slots: 8 for arenas, 16 for creatures) scales masked scatter instances in the existing tier buffers: vertically by a disc's factor (`floor` inside `inner`, smoothstep back to 1 at `outer`), or to a zero 3×3 (nothing rasterises, in the beauty pass or the shadow maps) at a factor ≤ 0.04; per cover class (ground: grass / tufts / flowers; small; large: `rock_a`; tree). Only the chunk slices a disc reaches (or reached) are rewritten and uploaded (one update range per tier); nothing is allocated, no mesh, material or program changes; the source matrices and the digest are untouched. **Creatures stay readable in tall grass**: the grass within 0.55 m of every shown creature billboard within 15 m of the camera focus drops to 20 % height, easing back by 1.35 m; the effect is full inside 9 m and fades to nothing at 15 m (quantised in 0.1 steps), so distant creatures still hide in the grass and walking up parts it. Polled every 150 ms, stable slots, a creature idling in place rewrites nothing.

Scatter is chunked into **32 m cells** (the AOI cell of spine §4.2), but drawn through **one zone-wide `InstancedMesh` per `(kind, lodTier, class)`** with capacity ≥ 1 025: an `InstancedMesh` whose matrices fit the uniform-buffer limit keeps them in a uniform array whose WGSL name carries a per-build id, so every such mesh compiles its **own** vertex program (header table; per-chunk meshes took Mirevale from 175 to 271 programs, climbing as chunks came into view). The chunk/tier logic writes the active chunks' instance slices into the preallocated tier buffers when the chunk set changes (partial upload via `addUpdateRange`); chunks outside the camera frustum (padded 16 m for shadow reach) contribute no instances. `instanceMatrix.setUsage(StaticDrawUsage)`. Per-instance tint through `instanceColor` (`setColorAt`) only on card/flower meshes (a tinted instanced mesh compiles its own fragment variant). LOD per chunk, not per instance: a chunk's tier is chosen each frame from the distance of its centre to the camera — **0–40 m LOD0, 40–90 m LOD1, 90–160 m LOD2, > 160 m impostor** — with 4 m hysteresis; tier switches copy slices into preallocated buffers and allocate nothing. Buildings and set-pieces use `LOD` objects (`addLevel(lod0, 0), addLevel(lod1, 40, 0.1), addLevel(lod2, 90, 0.1)`) with `autoUpdate = false`, updated once per frame against the main camera — three calls `LOD.update` for every camera including the shadow cameras, which would pick levels from the sun's position. Meshes mixing solid and alpha-tested card surfaces are split into meshes over geometry views, cards at `renderOrder 1`: the shadow pass renders with one override material per light and copies each object's `alphaTest` onto it, and every flip across 0 bumps its `version` and forces a full cache-key recompute (interleaved, Mirevale cost 185 ms CPU per frame; 8 ms split). <!-- amended 2026-09-25: render IMPLEMENTATION-NOTES C20, C21, C23, Z1 --> Amended 2026-10-06 (handover II): the per-`(kind, lodTier, class)` draw is a `ScatterMesh`, not an `InstancedMesh`: three 0.186's `RenderObject.getMaterialCacheKey` adds `object.uuid` for `isInstancedMesh || count > 1` (its instance buffers are node attributes bound to that object), so every scatter mesh was its own node build (49 per crossing, 4.3 s on the dev iGPU). A `ScatterMesh` is a plain `Mesh` over an `InstancedBufferGeometry` that shares the part geometry's attributes, index and groups and adds the instance data as ordinary attributes read by name — `ewaInstM0..3` (vec4 rows of one `InstancedInterleavedBuffer`, 16 floats per instance, shared by the tier's class meshes) and `ewaInstColor` on tinted parts — drawn `instanceCount` times. Its cache key is the material's and the attribute layout's, so the scatter draws of one material share a build. The transform is three's instancing, prepended to `NodeMaterial.setupPosition` for geometries that carry `ewaInstM0` (beauty and shadow passes alike): position, normal, `vInstanceColor`, and the velocity MRT's previous position through the same matrix; wind (`positionNode`) runs after it as before. Buffers, chunk slices, masks, capacities and draw calls are unchanged; the previous-instance-matrix copies three kept per mesh are gone (attributes −288 on Mirevale). <!-- amended 2026-10-06: handover II — render IMPLEMENTATION-NOTES "Handover II: shared scatter builds, a time-sliced build" -->

Impostors: two crossed canopy cards per tree kind (the library card material) beyond 160 m, not a render-target atlas — offscreen impostor targets would add ≤ 6 render targets to a count already over its cap (§10.10.2), and the default view never reaches 160 m (below). Rocks use their lod2; small kinds are not drawn beyond 90 m. Class `'impostor'` stays exempt from the three-maps audit. <!-- amended 2026-09-25: render IMPLEMENTATION-NOTES Z2 -->

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
| Actors' bodies (≤ 24 remote + local, 1 draw each) + their hand-held accessories (≤ 1 each, none beyond 45 m) + 1 instanced contact decal (§10.7.6–7) <!-- amended 2026-10-05: KayKit characters --> | 51 |
| Sky, rain sheet, light-shaft cards | 8 |
| Arena dressing during a battle (ring, 2 lights' housings, 6 spectator billboards) | 10 |
| Shadow passes: 4 cascades × (terrain 12 + buildings 29 + scatter 60 + billboards 40) is counted by `renderer.info` as draw calls | reported separately in `dumpZone()` (`shadowDrawCalls`, measured per frame by the host's inspector since 2026-09-30) and in `BudgetCounts.shadowDrawCalls`; the ≤ 400 cap applies to the beauty pass and the post quads (≤ 14): `BudgetCounts.beautyDrawCalls = drawCalls − shadowDrawCalls` <!-- amended 2026-09-30: audit M2-gym-dusk-7, render Part 5 B2 --> |
| **Total (beauty + post)** | **≤ 336** |

### 10.5.9 Disposal contract — the leak test

Amended 2026-09-30 (render Part 5 T4): a zone disposed while its background compile runs cancels that run first (§10.1.2); the leak assertion below holds after the in-flight units abort (measured in the sandbox, render IMPLEMENTATION-NOTES Part 5).

`ZoneHandle.dispose()`: (1) `scene.remove(group)`; (2) traverse `group` **once**, in the reverse of build order, calling `geometry.dispose()` on every geometry the builder created (recorded in a `Set<BufferGeometry>` at build time — shared library geometries such as the billboard quad and the decal plane are **not** in the set and are never disposed here), `dispose()` on every `InstancedMesh` (frees `instanceMatrix`/`instanceColor` attributes; since handover II a scatter `ScatterMesh`, whose `dispose()` fires the object's `dispose` event and disposes its wrapper geometry, §10.5.7), `light.dispose()` on every `PointLight`/`SpotLight` (frees its shadow map through `LightShadow.dispose`); `dispatchEvent({ type: 'dispose' })` on every plain `Mesh` of the zone after its geometries — a plain `Mesh` has no `dispose()`, and its render objects (with the programs they hold) are released only on the object's or the material's `dispose` event, which library materials never fire; and the attribute lists of the zone's render objects, collected before disposal, are deleted from the renderer's attribute map afterwards — attributes a later pass binds (the velocity MRT's previous-instance-matrix buffers, three's wrapped instance colours) are otherwise never freed (measured +141 attributes / 9.8 MB per Mirevale reload before the fix, ±0 after) <!-- amended 2026-09-25: render IMPLEMENTATION-NOTES C22, C26 -->; (3) `materials.evictExcept(nextKeep)` where `nextKeep` is `[]` unless a `loadZone` is already pending (handover pre-load), in which case it is the next zone's bound set; (4) `pool.releaseAtlas` for the zone's atlases (party singles stay); (5) `collider` reference dropped; (6) `disposed = true`. A second call returns immediately.

Assertion (spine-level, `leak.spec.ts` in `50-verification-budget.md` §50.4.6): after `dispose()`, `renderer.info.memory.{geometries, textures, texturesSize, programs, renderTargets, attributes, attributesSize}` equal the baseline captured after §10.1.2 step 8 **exactly (±0)**; after 100 load/unload cycles `renderer.info.memory.total` equals the baseline. Programs return to the baseline after `dispose()` because every material graph exists (warm-compiled) before the first zone and the zone's render objects are released (above); **while** a zone is loaded, `programs` exceeds the baseline by the zone's light-set variants (§10.1.2 step 8: +28 on Mirevale, measured), which is not a leak. A program still alive after `dispose()` is a leak-test failure and therefore a spec violation. <!-- amended 2026-09-25: "programs are constant during a zone load" is impossible in three 0.186, where the light set is part of each program's source — render IMPLEMENTATION-NOTES C11 --> Amended 2026-10-06 (Phase E3): a zone's compile re-keys the warm objects and the persistent arena to the zone's light set, and after the zone is gone nothing renders them, so they would keep its light-set variants alive (measured +2…+4 on Mirevale). Unless a next `loadZone` starts in the same task (a handover, which re-keys them itself), `dispose()` schedules a background compile of those objects against the zone-less light set, which is the boot's set. The programs assertion is therefore read after `compileIdle()` resolves. Measured on Mirevale: +2 right after `dispose()`, **±0** after `compileIdle()`, with every other counter ±0 throughout. <!-- amended 2026-10-06: Phase E3 --> Amended 2026-10-06 (handover): with the fixed light layout no zone re-keys anything — the light set is the boot's — so the re-key compiles no new program (it is kept as a guard), and `programs` above the baseline while a zone is loaded are the zone's own structures (Mirevale +18), not light-set variants. A zone prepared off-scene and dropped (`Renderer.dropPrepared`) returns geometries, attributes, programs and render targets to the loaded zone's values exactly (Mirevale + prepared mire_route: geometries 506 → 740 → 506, attributes 1 840 → 3 007 → 1 840, programs 107 throughout). <!-- amended 2026-10-06: handover fixed light layout — render IMPLEMENTATION-NOTES "Handover: fixed light layout" -->

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
  /** Footprint blockers registered by the zone builder (spine §3.11 open gap: content does not mark footprints). walkable() stays byte-identical to content. */
  addBlocker(b: Blocker): void;
  blocked(x: number, z: number): boolean;
  passable(x: number, z: number, surf?: boolean): boolean; // (walkable || (surf && water)) && !blocked — Phase D8 surf mode
  /** Phase D8: water && !walkable (open water: only a surfer stands here). */
  onWater(x: number, z: number): boolean;
  /** Phase D8: the level of the water body under (x, z) (`waterBodies(h, labels)`, the plane the water mesh draws); NaN off water. */
  waterLevel(x: number, z: number): number;
  /** Phase D8: feet height — max(level, terrain) on open water, else `sample`. Everyone on open water is surfing (the server refuses it otherwise). */
  surfaceY(x: number, z: number): number;
  nearestPassable(x: number, z: number, radius: number, surf?: boolean): readonly [number, number] | null;
}
export type Blocker =
  | { readonly kind: 'rect'; readonly x: number; readonly z: number; readonly hw: number; readonly hd: number; readonly yaw: number }   // buildings
  | { readonly kind: 'circle'; readonly x: number; readonly z: number; readonly r: number };                                              // trunks, rocks, posts
```

`packages/render/test/collider.test.ts` (node): for 10 000 prng points over a fixture field, `collider.sample` equals content's `sampleHeight` to `1e-6` and `collider.walkable` equals `isWalkable` exactly (the fixture is the JSON dump of `mirevale`'s field committed by content's validate step, so the two implementations cannot drift).

### 10.6.2 Movement solver contract (client prediction; the server is authoritative)

```ts
export const MOVER = { capsuleRadius: 0.35, capsuleHeight: 1.7, stepHeight: 0.4, slopeLimitDeg: 40, skin: 0.02 } as const;
export interface MoveResult { readonly x: number; readonly z: number; readonly y: number; readonly blocked: boolean; readonly slid: boolean }
/** Pure. Resolves a desired xz displacement against the collider. Never returns a position that is not passable. `surf` = the player holds HM Surf (30-server-netcode.md §30.3). */
export function resolveMove(c: TerrainCollider, fromX: number, fromZ: number, dx: number, dz: number, surf?: boolean): MoveResult;
```

Phase D8 <!-- amended 2026-10-06: Phase D8–D11 world systems -->: with `surf` the solver measures heights with `surfaceY` (the water level on open water) and skips the slope limit on open-water samples, so a surfer floats on a flat surface and climbs back onto a bank or a boardwalk within `stepHeight`; `resolveMoveInto(out, c, …, surf)` likewise. The client passes `surf` only when the player holds HM Surf, the zone's water is not lava (render cannot tell lava from a pond) and the bike is folded.

Rules, in order, with `passable(x, z) = (walkable(x, z) || (surf && water(x, z))) && !blocked(x, z)` — `blocked` is the builder's footprint blockers (oriented rectangles for buildings, circles for trunks, big rocks, posts; §10.5.5): (1) target `(tx, tz) = (fromX + dx, fromZ + dz)`; (2) if `passable(tx, tz)` and `sample(tz) − sample(from) ≤ stepHeight` and `slopeDeg(tx, tz) ≤ slopeLimitDeg` → accept; (3) else try the two axis-separated moves `(dx, 0)` then `(0, dz)` with the same tests → accept the first that passes, `slid = true`; (4) else probe 8 directions **at the step length around the start**, ±22.5°, ±45°, ±67.5°, ±90° from the desired direction (never backwards), smallest angle first, and accept the first passable one, `slid = true`; (5) else stay, `blocked = true`. If the start itself is not passable, the mover steps toward the nearest passable sample within 4 m by **at most the step length**. Invariant: `|result − from| ≤ |(dx, dz)|` — the server counts a step over its speed cap as a rejection and kicks after 30 (render Part 4 H9). <!-- amended 2026-09-30: P4-C4 --> `y = sample(x, z)`. The `slopeLimitDeg 40`, `stepHeight` and the blockers only make prediction **stricter** than the server, whose `validateInput` accepts exactly `walkable || (canSurf && water)` (§30.2.4) — so the client never predicts itself somewhere the server refuses; the reverse is the open footprint gap of spine §3.11 (the server accepts positions the client's blockers refuse). Without the `surf` term the client could never predict a step onto water that the server accepts for an HM Surf holder, and surfing would be unreachable. <!-- amended 2026-09-25: §30.2.4/§30.3/§50.4.5 make water-only samples standable with HM Surf while this solver had no input for it; render follow-up: `resolveMove`/`resolveMoveInto` gain `surf`, the client's Collider adapter passes inventory['HM Surf'] > 0 — findings L2-05, L2-01 -->

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

The focal plane passes through `rig.focus` and is **tilted 24° from the view-perpendicular toward the ground plane** about the camera's right axis. With pitch 52°, its normal is `n = normalize(−cos 76°·f_h + sin 76°·up) = (−0.2419·f_h, 0.9703)` where `f_h` is the horizontal forward unit vector. Per-pixel signed distance `d = dot(P_world − focus, n)` from world position reconstructed by `getViewPosition(screenUV, depth, uniform(camera.projectionMatrixInverse))` transformed by `uniform(camera.matrixWorld)` — inside a post graph the `cameraProjectionMatrixInverse`/`cameraWorldMatrix` nodes resolve to the fullscreen quad's camera (header table; the `GTAONode` pattern). <!-- amended 2026-09-25: render IMPLEMENTATION-NOTES C3 -->

| Parameter | Value | Consequence |
|---|---|---|
| tilt | 24° | a prop 12 m nearer/farther along the ground is `12 · 0.2419 = 2.90 m` off-plane |
| `focalLength` (full blur distance) | 6.0 m | CoC = `smoothstep(0, 6, |d|)`; at 2.90 m, `t = 0.483` → `t²(3 − 2t)` = **0.475** |
| `bokehScale` | 6 px (scaled by `pr`) | max CoC 6 px; at 2.90 m → **2.85 px at `pr 1`** (4 m above the plane → 4.44 px). The reference machine (2560×1440, dpr 1) renders at `pr 1` (§10.1.3), so these values **fail** the spine's Pillar 1 "≥ 3 px at 1440p"; it holds from `pr ≥ 1.06` (4.3 px at `pr 1.5`). Recommendation R3 (bokehScale 7 px → 3.33 px, or focalLength 5.5 m → 3.24 px) is the art decision that closes it. <!-- amended 2026-09-25: the draft's 0.518 / 3.1 px / 4.1 px were arithmetic slips (render IMPLEMENTATION-NOTES Q12) --> |
| f-stop equivalent | ≈ f/2.8 on the 35 mm-equivalent lens (informative) | the two numbers above are the binding ones |
| `focusDistance` passed to `dof()` | 0 | the node computes `signedDist = −viewZ − focusDistance`; we pass `viewZNode = d.negate()` so `signedDist = d`; near field = below the plane, far field = above |

Mask: MRT channel `mask.y` (§10.8.2), 1.0 over every pixel of a billboard with `sharp = 1` (the player's creature, both active battlers, the inspected creature); the composite is `mix(dofOut, preDof, maskTex.y)`. That composite keeps the sharp pixels sharp, but the far-field gather still reads their colour, so every sharp billboard off the focal plane gets a soft coloured halo in the blurred pixels around it (seen in the sandbox; gone with DOF off) — recommendation R4 (feed the DOF a `viewZ` whose CoC is 0 under `mask.y`). The player **character** mesh is also `sharp` (its own material sets `mrtNode = mrt({ mask: vec2(0, 1) })`). Pillar 1 test: mask value 1.0 over the whole billboard → `pillars.spec.ts` reads the `mask` MRT texture.

### 10.7.4 `BattleCamera` and arena framing (Pillar 7)

Arena: the two battlers stand **5.5 m apart** on the line through the `BattleSummary (x, z)` **along** the diorama heading's horizontal view direction (player side near the camera, foe far); the player's battler is the nearer one, showing its **back** sprite. <!-- amended 2026-09-25: "perpendicular to the diorama heading" put both battlers at the same camera distance, contradicting "the nearer one" and the +12° anti-eclipse yaw below — render IMPLEMENTATION-NOTES Q5 --> Default battle pose: camera **12 m** from the arena centre, **28° pitch**, yaw = diorama yaw + 12° (so the two battlers are staggered, not eclipsed), FOV unchanged (28°). `pushIn` eases position/pitch/yaw from the diorama pose over 600 ms with `smoothstep`; the battle pose is always within 40 u of the pre-battle player position (Pillar 7 test: 12 m + 5.5 m/2 < 40).

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

**Framing above the DOM battle panel** (amended 2026-09-30, render Part 5 T2; audit M2-battle-5 / -6). The battle panel (`20-client.md` §20.5.6) covers the bottom of the canvas, so the battle pose is not a fixed 12 m: `rig.setShotInsets(topShare, bottomShare)` (the client passes the panel's measured height; the default is the SPEC panel, 28 % + margin; the top share holds the far battler's HP-bar allowance) and `setBattleSubjects(nearM, farM)` (the stage reports the tallest battler per side) feed `battleFraming`: the smallest distance in [12, 22] m and the downward tilt that put the near battler's feet and both tops inside that band (2 % head-room each side for shake). Every frame of a battle shot then (a) orbits, at push-in, to the nearest yaw offset (±15°…±45°) whose ray from the arena centre is clear of every tree crown before the H11 pull-in is used, (b) re-tilts the final camera so the near battler's feet clear the panel (the player's battler wins when both cannot fit), (c) scales a cue's push / orbit / aim back (bisection) whenever it would take either battler out of the band (anchors within NDC |x| ≤ 0.72), and (d) limits the shake to the band's remaining room. **Tree crowns** (P4-C9, render Part 4 H11): the zone collider exposes one crown sphere per scatter tree and the battle / inspector camera never enters one (pulled in along its orbit ray to 0.4 m before the first crown, never closer than 3 m). <!-- amended 2026-09-30: P4-C9 and render Part 5 T2 -->

### 10.7.5 `BattleStage` (the surface `20-client.md` consumes) and the VFX id table

**The ring is cleared for the battle** (amended 2026-09-30, render Part 5 T1; audit M2-battle-3 / -8). While an arena is dressed, the zone's ground cover inside it is hidden through the zone's `ScatterMask` (§10.5.7): grass, tufts and flowers vanish inside 4.9 m and grow back by 6.6 m; small props (bushes, small rocks, stumps, logs) and big rocks vanish inside 5.0 m; trees stay (the camera avoids their crowns). Static props merged into the chunk meshes (posts, fences, crates, plaza details) inside 5.0 m are hidden by a prop cutaway that makes their triangles degenerate (index or position rewrite, saved) — nothing is added to or removed from the zone root, no material or program changes, and undress restores the original buffers byte-exactly once the arena has sunk. The arena is seated against the slope: 24 ground samples on the ring's rim and on the curb's outer edge; the seat is the lowest height the 0.45 m skirt still closes on the downhill side (never above the highest sample), and **the terrain above the seat is levelled into a pad** inside 5.0 m (ring, curb, rope posts, pylons), easing back to the original ground by 7.0 m. The terrain chunk vertices are rewritten in place and restored byte-exactly on undress, like the prop cutaway, and the actor pool samples the same cut ground, so trainers and spectators stand on it (amended 2026-10-06, M3 review R-forgewall-2: seated on the highest rim sample capped at centre + skirt, the forgewall slope rose through the ring floor and buried the uphill posts). Without a loaded zone the highest sample wins, capped by the skirt. **The trainers stand beside their creatures** (amended 2026-10-06, M3 review R-all-1): 4.45 m from the ring centre, 45° off the battle axis toward the side away from the battle camera's +12° yaw (side 0 on the near half, to the camera's left; side 1 the point reflection), so the player's avatar never stands in the camera's ray to its own battler (< 5 % of any battler's screen rect covered in the stock framing and in every cue, singles and doubles: `battle-trainer.test.ts`); a hall fit keeps both slots on the floor. Pillar 7 test: the zone root's children and the light list are identical before, during and after the battle (`ground-cover.test.ts`).

```ts
export type Terrain = 'none' | 'grove' | 'cinder' | 'salt' | 'storm' | 'marrow' | 'vesper' | 'forge' | 'sky' | 'shrine' | 'rift';   // text-identical mirror of spine §2.9
export interface BattlerRef { readonly side: 0 | 1; readonly slot: number }

export interface BattleStage {
  /** Dresses the arena at (x, z): a 7 m ring (surface cobble / the biome's plaza stone), 2 shadow-casting beacons whose colour is accentType, ≤ 6 spectator billboards (npc looks), rope posts; all within the zone's light budget (the 2 beacons are reserved slots). */
  dress(at: { readonly x: number; readonly z: number }, terrain: Terrain, participants: readonly string[]): void;
  dressSpectator(x: number, z: number): void;           // ring + beacons only
  undress(ms: number): void;                            // sinks the dressing into the ground over ms, then removes it (opaque library materials cannot fade; it rises the same way on dress — amended 2026-09-25, render IMPLEMENTATION-NOTES Q7); disposes nothing shared
  setBattler(ref: BattlerRef, d: SpriteDescriptor | null): void;   // null = empty slot; the active refs get sharp = true (Phase D6: slot = field position 0 / 1, two per side in doubles)
  setPose(ref: BattlerRef, pose: BattlerPose, ms: number): void;
  hurt(ref: BattlerRef, strength: number): void;
  faint(ref: BattlerRef, ms: number): void;
  setWeather(w: WeatherKind): void;                     // arena-local: the battle's Field.weather
  vfx(id: VfxId, from: BattlerRef | null, to: BattlerRef | null, ms: number, type?: TypeName): void;   // <!-- amended 2026-10-08: move motion styles --> `type` colours a `style_*` effect (default Normal); a `type_*` effect keeps its own type's colour
  prewarm(ids: readonly VfxId[]): void;                 // compiles/instantiates the pooled effects (20-client.md preview rule 1)
  syncFrom(hp: readonly { readonly ref: BattlerRef; readonly hpFrac: number }[]): void;   // after battleResync: poses reset, no animation
  setTypeColors(table: Readonly<Record<TypeName, string>>): void;   // colourblind palettes (20-client.md §20.8.3)
  inspect(d: SpriteDescriptor | null): void;            // 4 m close-up pose for the party/dex inspector; null exits
  /** The evolution sequence (amended 2026-10-05): call only after the server confirmed the evolution; a new call or `dress` cancels a running one. */
  evolve(r: EvolutionRequest): EvolutionHandle;
  dispose(): void;
}

/** §10.7.5 evolution sequence phases; `fade` replaces `charge · alternate · peak` under effective reduced effects. */
export type EvolutionPhase = 'stage' | 'charge' | 'alternate' | 'peak' | 'fade' | 'reveal' | 'hold' | 'exit' | 'done';
export interface EvolutionRequest {
  readonly from: SpriteDescriptor;                       // the form before (bound or binding: the sequence waits for both atlases)
  readonly to: SpriteDescriptor;                         // the form after (the server's species)
  readonly at?: { readonly x: number; readonly z: number } | null;   // the trainer's feet (default: the camera focus); the creature appears in front of them
  readonly reduced: boolean;                             // effective reduced effects: a gentle cross-fade, no pulses, no burst, no shake
  readonly cheer?: string | null;                        // actor id that cheers at the reveal when within 6 m of the creature (the local player)
  readonly onPhase?: (phase: EvolutionPhase) => void;    // called from the frame hook on every phase entry: keep it cheap (defer store writes)
}
export interface EvolutionHandle {
  readonly phase: EvolutionPhase;
  readonly done: Promise<'done' | 'cancelled'>;          // after the cleanup: camera released, lights / post / bindings restored
  skip(): void;                                          // before the reveal → the reveal; during the reveal / hold → the exit
  cancel(): void;                                        // immediate cleanup (a battle starting, the stage disposed)
}

export type MoveStyle = 'slash' | 'bite' | 'punch' | 'tackle' | 'beam' | 'orb' | 'wave' | 'rain' | 'erupt' | 'spray' | 'bolt' | 'spin' | 'shard' | 'gust';   // <!-- amended 2026-10-08 --> a move's motion style (the client's MOVE_STYLE)

export type VfxId =
  | `type_${Lowercase<TypeName>}`                        // 19 projectile/burst effects, one per type, colour from the type table
  | 'impact_normal' | 'impact_super' | 'impact_resist' | 'impact_crit'
  | 'status_burn' | 'status_poison' | 'status_paralyze' | 'status_sleep' | 'status_freeze' | 'status_confuse'
  | 'stat_up' | 'stat_down' | 'heal' | 'drain' | 'recoil'
  | 'weather_sun' | 'weather_rain' | 'weather_sand' | 'weather_hail'
  | 'orb_throw' | 'orb_shake' | 'orb_catch' | 'orb_break'
  | 'switch_out' | 'switch_in' | 'faint' | 'trap' | 'flinch'
  | 'shiny_sparkle'                                      // Phase D4: the shiny encounter burst
  | 'form_rage'                                          // <!-- amended 2026-10-08: battle forms (hollowmane's rage form) --> the rage-form burst (crimson shards, embers, shockwave); also every Majin form's
  | 'form_tenjin'                                        // <!-- amended 2026-10-11: Majin / Tenjin --> a Tenjin form's burst: a gold ring, rising gold motes, a soft white-gold flash
  | `style_${MoveStyle}`;                                // <!-- amended 2026-10-08: move motion styles --> 14 motions (slash, bite, punch, tackle, beam, orb, wave, rain, erupt, spray, bolt, spin, shard, gust) drawn in the `type` passed to vfx()
export const VFX_IDS: readonly VfxId[];                  // exactly 19 + 4 + 6 + 5 + 4 + 4 + 5 = 47 entries + 'shiny_sparkle' (Phase D4) + 'form_rage' + 'form_tenjin' (<!-- amended 2026-10-11: Majin / Tenjin -->) + 14 `style_*` = 64; the client's MOVE_ANIMS/DEFAULT_BY_TYPE/MOVE_STYLE reference only these
```

Every VFX is a slice of one pooled instanced `Sprite` (`count` 4 096 = 8 emitters × 512 particles, additive, `layers 29`, one shared `PointsNodeMaterial` with per-particle `instancedBufferAttribute` for birth/lifetime/colour — a `Points` object rasterises 1-px points on WebGPU, header table) or a pooled alpha-card burst (≤ 8 cards); particles write valid MRT values (the view axis as normal, mask `(1, 0)`) and alpha-test at 0.004, because the pass MRT writes those attachments unblended and a zero normal made GTAO NaN. Pools are allocated in `createRenderer` (§10.1.2 step 7) and never grow. VFX add **no** lights (a light appearing mid-battle recompiles every lit program); impacts pulse the 2 reserved beacons instead, which live under the stage root from `createRenderer` on at intensity 0 with `shadow.autoUpdate = false` while undressed. <!-- amended 2026-09-25: render IMPLEMENTATION-NOTES P4, P8, P10, Q8 --> `impact_super` adds a 120 ms `chroma` request (`effects.chroma` gates it) and `impact_crit` a 3-frame white flash on the target (`hurt 1.0`). VFX never writes `mask.y = 1`, so effects blur with the scene and never sharpen; VFX never covers the HUD rects (the HUD is a later overlay pass — Pillar 8 readability gate in `50-verification-budget.md` §50.1 rule 15).

**Sequence effects** (amended 2026-10-05; `stage/evolution.ts` `evolutionRecipes(type, reduced)`): recipes outside the 47-id table (the `VfxId` union and its count are unchanged), built once per sequence with the new form's type colour and spawned through `VfxSystem.spawnRecipe` into the same pooled emitters and the one shared material — nothing allocated on the GPU, no program. Each phase is ≤ 512 particles, cards ≤ 8.

| Recipe | When | Phases |
|---|---|---|
| `evolve_motes` | charge → peak (5 000 ms) | rising stars (90, cream / white) + rising soft discs (200, type colour / warm white), swirling up from the feet |
| `evolve_converge` | peak (500 ms) | 160 stars drawn from a 1.6 m shell into the creature's chest |
| `evolve_burst` | reveal | one soft flare disc (2.4 m shrinking, 300 ms), a star burst (130, white / gold, 6.5 m/s), two ring cards (1.2 → 2.4 m), rising type-coloured stars (90) |
| `evolve_motes` (reduced) | fade (2 600 ms) | 60 stars + 90 discs, slower |
| `evolve_reveal` (reduced) | reveal | 110 rising stars — no burst, no ring cards |

**Evolution sequence** (amended 2026-10-05; render IMPLEMENTATION-NOTES Part 7; the user-approved design). `evolve(request)` plays a creature's evolution in place, beside the trainer; the client calls it only with the species the server returned (`20-client.md` §20.5.6), and every evolve path (the post-battle prompt, Rare Candy, future stones and trades) goes through it. Timeline (ms; `skip()` jumps to the reveal, a second `skip()` to the exit):

| Phase | Full | Reduced | What |
|---|---|---|---|
| `stage` | 0–1 100 | 0–1 100 | the camera pushes in on the §10.7.4 inspector pose (pitch −18°, distance `max(4, 2.6 × taller form, the creature + trainer span / (0.8 × the frame width at 1 m))` m, aimed at the middle of that span so both stay in frame); the old form dissolves in (250–750 ms) 1.2 m in front of the trainer and to one side by at least half the wider card + 0.3 m, so a big creature does not hide its trainer — the first of 9 candidate spots whose footprint and ground line toward the camera are clear of the collider's footprints; the world dims (post `exposure` × 0.74, `vignette` → 0.55); a soft light rises under the creature |
| `charge` | 1 100–2 000 | — | the old form turns into a glowing white silhouette (`glow` 0 → 1); motes rise |
| `alternate` | 2 000–5 600 | — | the white silhouettes alternate OLD ↔ NEW on a linear ramp from 0.7 to 2.4 full cycles per second (never above 3 Hz); each incoming silhouette pops from 0.88 × to full size over 110 ms; the camera dollies 0.6 m closer |
| `peak` | 5 600–6 100 | — | the new silhouette held white while sparkles converge on it (the gap that keeps the burst from adding a flash to the alternation's last second) |
| `fade` | — | 1 100–3 700 | the two forms cross-fade through the dissolve dither under a gentle glow (≤ 0.35, one slow rise and fall) |
| `reveal` | 6 100–7 000 | 3 700–4 600 | full: the light burst (the light × 2.4 and back, star burst, ring cards, a 0.06 / 300 ms shake that `effects.shake` gates), the glow fades into the new form's colours (held 120 ms, ease-out over 560 ms); reduced: rising sparkles only, no spike, no shake; both: the camera eases back to 0.4 m beyond its start distance (over the reveal and half the hold: the whole new form, room for the banner), the world brightens back, the trainer (`cheer`) plays its `cheer` emote when within 6 m, the new form bounces (`celebrate`, 640 ms) |
| `hold` | 7 000–8 800 | 4 600–6 400 | the new form idles (the client's DOM banner) |
| `exit` | 8 800–9 500 | 6 400–7 100 | the camera releases to the diorama pose (700 ms), the creature dissolves out (first 60 %), the light fades |

- **Flashing (WCAG 2.3.1)**: at most 5 silhouette swaps (opposing luminance changes) in any one second, ≥ 214 ms apart, the burst included (test: a luminance proxy of glow × area + light has ≤ 6 opposing changes of ≥ 10 % in every 1 s window); reduced: no swap, the light never exceeds its charge level, no pair of opposing changes in any second.
- **Light**: the reserved arena beacon 0 (it exists from `createRenderer`, so the light set never changes): a warm spot 1.15 m toward the camera and 0.2 m up, aimed at mid-height (angle 0.6, penumbra 0.9, range 9 m, decay 2, intensity 7 × the phase level). While borrowed its shadow camera renders only `LAYERS.billboards`, and the step-8 warm-up frames render both beacons' shadow maps over the warm group (`Stage.armWarmupShadows`), so the spot-shadow pass programs exist from boot: a sequence compiles nothing (measured: 0 new programs). A main arena still sinking after a battle is finished at once.
- **Site**: 450 ms into the stage the main arena's two ground-cover slots hide grass inside 1.3 m (back by 2.3 m) and small props inside 1.6 m of the creature, and the prop cutaway hides merged static props within 1.9 m of a point 1 m toward the camera; restored halfway through the exit (§10.5.7, byte-exact).
- **Atlases**: both billboards are acquired at the start; the stage holds just before its end until both atlases are bound, at most 8 s; past that, with the new form still unbound, the sequence goes straight to the reveal (the new form shows when its bind lands).
- **Cleanup** (done or cancelled): both billboards disposed (the pool's live count and the atlas refcounts as before), beacon 0's position, target, colour, intensity, cone, range, decay, shadow update and shadow-camera layers restored, post exposure / vignette restored, the site restored; cancelled: the VFX pool cleared and the camera released unless a battle's push-in owns it. `dress`, `inspect`, a second `evolve` and `dispose` cancel a running sequence. Per frame: scalar writes only, no allocation.

**Battle-form auras** <!-- amended 2026-10-11: battle-form auras (`.design/majin-tenjin.md` §8) -->. A battler whose `SpriteDescriptor.aura` is set shows a live, looping aura for as long as it holds the form, so a Majin or Tenjin form reads at a glance from any camera (`stage/aura.ts`, `AuraSystem`, owned by the stage). Three layers, all on the VFX clock (hitstop freezes them, slow-mo slows them): **flames** — 192 camera-facing particles born on an ellipse fitted to the card (0.42 × half width, 0.52 × half height) and rising off it, each particle's age `fract(clock / cycle + seed)`, so the loop costs no CPU work; Majin: flame tongues licking up and outward (0.55 s cycle, flickering) in orange-hot → blood red with no blue (a crimson with blue in it turned pink under bloom and the tone map), plus embers; Tenjin: calm gold streaks rising straight up from the shoulders and head (1.7 s cycle) plus slow star motes. **Sigil** — a disc on the ring under the creature (× 1.35 the card width, ≥ 1.3 m): Majin a jagged ring broken by one crack, spinning and pulsing hard; Tenjin a whole ring, an inner ring, a lens circle at the centre and 12 ticks turning slowly, breathing. **Rim** — the billboard's rim light takes the aura colour at HDR gain 4.2, pulsing (`CreatureBillboard.setRimColor`; `refreshTypeColor` restores the type rim). **`majin_gold`** (zenryu's Majin form, its Super Saiyan): the Majin motion and the crimson cracked sigil, with taller, straighter golden flames (rise 0.55, × 1.4 size, orange-gold → amber), electric-blue spark streaks instead of embers, and a gold rim; the client picks it per species (`SPECIES_MAJIN_AURA`). The aura fades in over 380 ms and out over 260 ms; it follows the posed card (a lunge carries it); `faint`, a descriptor without `aura`, `setBattler(ref, null)`, `undress` and `dispose` end it. Budget: 4 slots (every doubles field position), built at construction, one shared `PointsNodeMaterial` and one shared sigil material with per-object `userData` values, both compiled in the step-8 warm-up; additive, `layers 29`, the overlay MRT (`(1, 0)` / `(0, 0)`), no light (C13), never `mask.y = 1`. The transformation itself keeps its one-shot burst (`form_rage`). Proof: `packages/render/test/aura.test.ts`; sandbox `?demo=battle&mineAura=tenjin&foeAura=majin` (WebGPU over CDP).

**Doubles** <!-- amended 2026-10-06 Phase D6 -->. In a doubles battle the stage holds four battlers: `BattlerRef.slot` is the field position (0 / 1), never a party index. `battlerSlot(center, yaw, side, slot, count = 2)` keeps the sides 5.5 m apart along the battle axis and spreads each side's two `SLOT_SPACING` (1.8 m) across it, point-symmetric about the ring centre (each side's position 0 on its own left); `Stage.layoutSide` derives `count` from the highest slot a side holds, so one battler per side stays on the axis exactly as in singles. Every foot disc (`STAGE.battlerFootR` 0.55 m, the size-1 contact-shadow decal) lies on the 3.5 m ring top (≈ 2.89 m + 0.55 m from the centre), and in a hall `fitCentre` lists the four foot discs in its need set (they sit inside the 4.0 m ring-fit disc, so they cannot move the centre today; they keep the guarantee if the ring or the spacing changes). VFX anchors, cue targets, `syncFrom` and `projectBattler` are keyed per ref, so `from` / `to` work for either position of either side, an ally included; all four billboards are DOF-sharp. The client maps core refs (party indices) to these positions (`20-client.md` §20.5.4). Proof: `packages/render/test/doubles.test.ts`.

### 10.7.5a The arena stadium <!-- amended 2026-10-11: arena PvP -->

Arena PvP (30-server-netcode.md §30.4.10) fights outside the world: no zone is loaded. `createArenaBackdrop(): { root,
update(dtSeconds), dispose() }` (`stage/arenaBackdrop.ts`) is a round stadium bowl registered as the zone root
(`setZoneRoot`): a dark floor with paper-white markings and one orange line, a parapet with an LED ribbon at r 6.6 m,
tiered stands with 1 854 instanced seated figures (a crowd wave advanced by `update`, so hitstop freezes it), a canopy,
banner and screen panels. Everything inside r 6.6 m is flat (y 0) and empty: the stage dresses its ring at the origin
with `ARENA_BACKDROP.terrain` ('forge'). The client sets `ARENA_BACKDROP.timeOfDay` (21:30) and, while no zone is loaded,
`ARENA_LIGHTING` / `ARENA_GRADE`. Budget: 5 meshes, 5 materials, 5 main draws, no textures, no lights; the bowl is the
only sun-shadow caster. Every battle-camera sightline (all headings, cues, push-ins, framing distances) stays clear of
the crowd and under the canopy (`test/arena-backdrop.test.ts`). Sandbox `?demo=arena`.

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

Amended 2026-10-05 (render Part 6): the pool is `CharacterPool` (`stage/actors.ts`). The 48 rig records are preallocated and never grow (a 49th `spawn` throws in dev, logs in production); a rig owns a KayKit body cloned from its look's shape (§10.7.7), recycled per shape on `despawn`. `setTransform` stores the feet and heading only — the gait is chosen in the frame hook from the **measured** displacement, not from the flags, so remote interpolation, prediction corrections and teleports animate correctly (a jump > 3 m in one update measures no speed). `setTransform`, `setEmote` and the per-frame hook allocate nothing. `screenPositions` anchors at the head joint (it follows a hop or a bow). The pool owns one instanced contact decal for all actors and picks the shadow casters (§10.7.7). <!-- amended 2026-10-05: render IMPLEMENTATION-NOTES Part 6 -->

### 10.7.7 Character models

Amended 2026-10-05 (render IMPLEMENTATION-NOTES Part 6; the user's decision of 2026-10-05: "3D people with 2D creatures"): characters are **stylised 3D people from the KayKit "Adventurers 2.0" pack** (Kay Lousberg, CC0, free tier) built by `40-pipelines.md` §40.2; creatures stay 2D lit billboards (§10.4). The Quaternius looks (P4-C7) and the pixel-art character proposal of 2026-09-30 (`tools/character-pipeline`, never applied) are both retired.

- **Set** (`public/models/models.manifest.json` v2 `characters` + `looks`, §40.2.5): 15 body *shapes* (one skinned primitive each on the shared 23-joint `Rig_Medium`, UVs into the KayKit 8 × 4 swatch grid, no image), 5 hand-held accessories (mug, book, three shields — no weapon), one animation file and one atlas with a recoloured tile per look. Each of the 19 `LOOKS` and the 5 `BODIES` palette variants (`casual2_male:dusk` …) is `{ shape, tile, accessory, accessoryTile, scale, heightM }`; an id the manifest lacks resolves to its base look, else to a deterministic base look (spectators).
- **Bodies**: each actor is `SkeletonUtils.clone` of its shape's template (own bones, the template's geometry shared per shape), recycled per shape on despawn; ONE factor for every look (`characters.scale` = 1.55 m / the median bare-head top = 0.6819), so a bare head stands at 1.55 m and hats and helmets stay above it (`heightM` 1.47–1.81 m); a sizeScale-1 creature (~1 m) reaches the chest.
- **Material** (class `'character'`): ONE `MeshStandardNodeMaterial` for every body and accessory — albedo = the atlas sampled in the actor's tile (`userData.ewaTile`, a per-object uniform, so one program serves every look), × 0.72 with saturation 1.18 (the KayKit swatches are painted for flat renders and clip to white under the noon key), roughness 0.8, metalness 0, geometry normal (flat at harvest level 2), double-sided (capes are single sheets), a warm view-dependent rim (0.22) and an albedo floor (0.05) in `emissive` so a character is never a black cut-out at night (audit M2-gym-dusk-6). `mask` MRT: x 0 (GTAO applies), y = `userData.sharp` (the DOF-sharp local player). Exempt from `materials.threeMaps` by class: no ORM / normal maps (the low-poly gradient style has none).
- **Animation**: one `AnimationMixer` per actor over the shared clips `idle walk run cheer flinch use` (bound by joint name). Idle / walk / run are blended by the **measured** ground speed (smoothed displacement, τ 0.1 s; < 0.25 m/s stands, walk → run between 1.1 and 1.7 m/s) and each gait clip plays at `speed / (clip ground speed × scale)` — the pipeline measures the planted toe (walk 0.55 m/s, run 2.30 m/s at time scale 1) — so planted feet move with the ground (measured: mean planted-toe drift −0.04 m/s at 0.7 m/s, ≤ 0.13 m/s at the protocol's 4.2 and 7 m/s); `moving` / `running` are hints only. Facing turns toward the heading along the shortest arc (rate 14 / s). Emotes (spine §4.1) while standing, faded at 8 / s, yielding to walking: wave = the right arm raised and waving (procedural, over the idle), happy and heart = `cheer` (a hop), sad = head and chest bowed (procedural), alert = `flinch`, cool = `use`.
- **Grounding**: feet on the collider; one instanced contact decal for every actor (the §10.4.7 material, 0.85 m, on the ground normal); real shadows from the **nearest 12** bodies within 45 m of the camera (accessories never cast). Phase D8 <!-- amended 2026-10-06: Phase D8–D11 world systems -->: `setGround(sampler, water?)` — the wiring passes the collider's `surfaceY` and `onWater`; an actor on open water (a surfer, local or remote) stands flat on the level and its contact decal gives way to a second instanced mesh, the ripple ring (`RIPPLE`: 1.6 m, two rings expanding at 0.7 Hz and fading, additive white, its own time uniform, class 'decal'; one extra program).
- **LOD**: accessories hidden beyond 45 m, no shadow beyond 45 m, bodies culled beyond 140 m (the fog); frustum culling on a fixed bounding sphere per body (no per-frame skinned bounds).
- **Draws**: 1 per body + 1 per visible accessory + 1 decal draw for all actors; measured in the sandbox diorama at noon (render Part 6): 0 / 24 / 48 actors → beauty 73 / 110 / 146, shadow 112 / 158 / 161, programs 112 / 114 / 114, materials 15 / 15 / 15.
- **Loading**: the manifest, clips and atlas load once per `createRenderer` (`GLTFLoader` + `MeshoptDecoder` + the host's `KTX2Loader`), each shape and accessory once, on first use; until its shape is in, an actor shows its decal and nameplate only. The warm-up frame (§10.1.2 step 8) draws a 23-bone skinned body with the shipped attribute formats and an accessory on the character material, so their programs exist before the first character appears.

Nameplates are HUD (§10.9), never `Sprite`s, anchored at the head joint raised to the look's top (+ 0.18 m). Legendary GLBs (`public/models/legendaries/<id>.glb` + `<id>.lod1.glb`, skinned, one `idle` clip, three KTX2 maps) are the only skinned meshes with real maps and use the §10.2.4 graph unmodified; they switch to `lod1` beyond 40 m. <!-- amended 2026-10-05: render IMPLEMENTATION-NOTES Part 6; tools/model-pipeline IMPLEMENTATION-NOTES K1–K8 -->

### 10.7.8 World effects <!-- amended 2026-10-21: the overworld's small motion -->

The overworld's own small motion, one bundle per renderer (`worldfx/`, `WorldFx`) built with the part-3 subsystems and driven from their frame hook after the actor pool moved its rigs. It reads the zone through its handle (`ZoneHandleImpl.spec`, `.splat`: the plan, palette and collider the terrain was drawn from) and the actors through `CharacterPool.forEachWalker`; the client drives nothing per frame. No `Math.random`, no wall clock: the clock is `dt × timeScale` (hitstop freezes it) and jitter comes from a seeded mulberry32.

- **Particles** (`WorldParticles`): one ring buffer of 2 048 particles in preallocated instanced attributes, drawn as one instanced `Sprite` on one `PointsNodeMaterial` (layer 29, `overlayMrt(true)`), premultiplied alpha (One, OneMinusSrcAlpha) so dust darkens what is behind it; a particle's `glow` 0..1 moves it from lit-and-blended (takes the day's key light) to additive (embers). One draw call, one program, compiled in the warm-up frame.
- **Footsteps** (`Footsteps`): every actor within 30 m of the camera focus lands a foot per stride of the ground it covers (0.62 m at a walk, 1.0 m at a run, from the pool's measured speed, alternating 0.11 m left and right of its line) and throws what the ground throws behind it: `classify(x, z, wetness)` reads the plan's tall-grass patches, plaza and roads (`splatAt`) and the palette's terrain layers: a gravel road puffs tan, canyon dust red, salt sand throws grains, snow flakes and powder, ash a grey puff (with an ember now and then on cinder ground), moss a few soil bits, tall grass flicks blades, shallows splash with a ripple; paving is silent. Above 0.5 wetness earth turns to mud and paving to puddles. Above 5.2 m/s (the bike) a dust puff every 0.45 m between strides.
- **Prints** (`FootprintDecals`): sand, snow and mud keep a footprint: one `InstancedMesh` ring of 160 flat soles on the ground normal, multiply-blended like the contact decal (§10.4.7) in the ground's own tint, fading over the last 45 % of 14 s. One draw call, one program.
- **Grass that makes way** (`GrassPush`): `SharedUniforms.push` (addition to §10.2.3) holds 4 discs (x, z, radius, strength) the tall-grass card bends away from: `windDisplace` adds `pushDisplace` for a card whose per-material `push` uniform is 1 (`SurfaceExtras.pushable`, the `tall_grass` surface: tall grass, tufts and clumps), weighted by the card's stiffness, so the tips lean out up to 0.5 m and press down up to 0.32 m, full inside a quarter of the radius, and the shadow bends with them. The 4 walkers nearest the camera focus within 24 m hold a 1 m disc each (eased in at 9 / s, 0.6 strength while standing); a walker that leaves its disc lets the grass spring back (a damped cosine, 0.22 s, 2.4 Hz, over by 0.9 s). Every card keeps one program: the push is a uniform.
- **Encounter rustle** (`WorldFx.rustle(x, y, z, strength)`, `encounterAt(x, y, z)`: the rustle in tall grass, a spray on open water, else nothing): a burst of blades round the walker and a 2 m disc that shakes the grass (3.2 Hz, decaying over 1.5 s) when a wild battle starts in tall grass (the client calls it with the push-in); reduced effects keep a third of it.
- **Ambient motes** (`AmbientMotes`): 720 motes in a 40 m box round the focus (0 to 7 m above it), one instanced `Sprite` whose positions the vertex stage computes from fixed seeds (drift, a slow wander, a wrap that keeps them world-anchored, a fade at the box rim): a frame writes uniforms only. The first 480 follow the biome and the daylight (fireflies in grove, capital and marrow at night, pollen by day; wisps and spores in vesper; embers over cinder and, thinner, forge; salt spray; storm sparks; snow motes in sky; star motes at the shrine; void spores in the rift; rain and hail leave a quarter of them, sand half); the last 240 carry the zone's mood: falling ash where honor has cast a shadow (0.22 per level, `setShadow`), else the season's sky (`setSkyMood`: red embers for the Majin, gold motes for the Tenjin). A profile change fades the old air out before the new fades in. The host forwards `setWeather` / `setShadow` / `setSkyMood` to the frame hooks (`FrameHook` additions), and `Renderer.setAmbient?(on)` stills the field (the client: off inside a pocket).
- **Cloud shadows** (`materials/clouds.ts`): `SharedUniforms.clouds` (addition: strength, coverage, scale, drift) darkens every library surface (the §10.2.4 graph and the water graph multiply their colour by `cloudShade`): a two-octave noise of the world xz (features about 40 m, drifting 2.2 m/s down `windDir`) eases from clear to shaded round the weather's cloud coverage (§10.3.6: 0.35 clear, 0.1 sun, 0.85 rain), and the shaded ground takes up to `CLOUD_STRENGTH` 0.38 less light, scaled by daylight (none at night) and the weather (sun 0.6, sand 0.5, rain and hail 0.2: an overcast sky casts no edges); harvest level 2 none. A uniform: no program is added.
- **Light shafts** (`SunShafts`): the cut list's "≤ 6 light-shaft billboards" (`50-verification-budget.md` §50.3). Nine soft additive ribbons, one per 12 m world cell of the 3 × 3 block round the focus at a hashed spot, each a quad from the ground 18 m toward the sun, turned about its axis to face the camera, fading along it, across it and from 7 to 16 m from the focus (about six read at once; the block follows the focus a cell at a time without a pop). Brightness = the golden-hour weight (§10.3.5) × daylight × the weather's clearness (clear 1, sun 0.85, sand 0.5, rain and hail 0), in the sun's colour. One draw, positions from the vertex stage.
- **Weather on the ground** (`materials/weatherSurface.ts`, in the §10.2.4 graph): under `wetness` every solid darkens (× 0.86, × 0.7 on a wet-responding surface: roads, cobbles, flagstones, roofs) and on wet-responding surfaces that lie flat (world normal y 0.90 to 0.97) puddles open in a slow noise field, up to 42 % of the flat ground at full wetness: albedo × 0.5, roughness 0.05 and the geometry normal, so they mirror the sky. `SharedUniforms.frost` (addition, 0..1, up over 6 s of hail and down over 20 s, written by `WorldFx`) lays a fine rime on upward faces (normal y from 0.55), at most half white, in a grain over a soft coarse field. Cards take the darkening only. Both 0 in clear weather.
- **Heat haze** (post, §10.8): `PostUniforms.haze` / `hazeTime` (additions) shimmer the scene lookup at the head of the chain by up to `HAZE_UV` 0.0014 uv, never under the DOF-sharp mask (the player stays crisp): full over cinder by day (half at night), 0.55 over forge and 0.4 over marrow by day, × 1.25 in sun, × 0.8 in sand, none in rain or hail; eased at 0.8 / s, and 0 under reduced effects (it is motion: gated with `effects.shake`). The lookup is the plain one at 0, so the graph's stages are unchanged.
- **Water that lives** (`materials/waterLife.ts`, in the §10.5.6 water graph, from its `depthBelow` attribute): shore foam, a broken lip where the depth is under about 0.2 m and thin lines washing in parallel to the bank, matte and opaque (no transmission under it); caustics, two drifting ridge nets over beds shallower than 1.8 m, in the albedo (the sun lights them, night hides them). Strengths per surface (`SurfaceExtras.foam` / `.caustics`, per-material uniforms): sea 1 / 0.8, tide pool 0.8 / 1, pond 0.55 / 0.7, fountain 0.35 / 0.6, bog 0.15 / 0.
- **Fish** (`FishShadows`): six dark fish shapes (a tapered body, a beating tail) swim lazy loops on open water within 18 m of the focus, one `InstancedMesh` on the water surface, multiply-blended like the contact decal; a loop is chosen only where all of it is open water (`onWater`), a fish fades out and swims elsewhere when its path would leave the water or the focus has moved 24 m off; faint at night.
- **Surf wake** (in `Footsteps`): a surfer (an actor on open water) throws foam off both sides of the bow every 0.32 m and leaves a ring every 1.1 m behind, from 0.6 m/s; no footsteps or prints on the water.
- **Hit weight** (battle): the `hurt` pose squashes, knocks back and rebounds (§10.4.6 table); the HUD battle bar keeps a pale ghost of the HP a hit took (`HUD.ghostHoldMs` 420 held, then drained to the new value over `ghostDrainMs` 600, repainted at the HP tween's 30 Hz; none on a heal), so the chunk a hit took reads before it goes.
- **Creatures that sit in the light** (the §10.4.5 billboard graph): `BillboardUniforms.sunDir` / `.sunRim` (additions, written by the part-3 hook from the day cycle's sun and the key light's own colour and intensity, so weather and honor dim it too; 0 with the sun down) add a sun-coloured rim to the silhouette's edge (power 3.4, × `SUN_RIM_GAIN` 0.45 at the noon key), full when the creature stands against the sun and 0.3 of it from the side; and the card's lowest part, just above `footV`, takes a contact shade (albedo × 0.74 at the foot line, easing to 1 over 0.16 of the card; none at harvest level 2 or under the evolution glow). Uniforms only: no program is added; characters keep their own rim (§10.7.7).

Budget: + 5 draw calls, + 5 programs; nothing grows after construction.

### 10.7.9 Followers <!-- added 2026-10-21: followers with field powers (spine §3.18) -->

Each trainer's party lead walks behind them as its creature billboard (`stage/followers.ts`, `FollowerPool`, part of the
part-3 bundle as `Part3.followers`, updated in the frame hook after the actor pool, before the world effects).
- **API**: `set(owner, descriptor | null, frontOnly?)` (a new descriptor swaps the card in place; a full pool of
  `FOLLOWER.max` 16 refuses), `setShown(owner, on)` (a battle, a hall, the arena: hidden without dropping the card; shown
  again it reappears behind the owner), `positionOf`, `billboardOf`, `forEachWalker`, `setLight(owner | null, level)`.
  The owners are the `CharacterPool`'s actors (`feetOf`, `groundAt`). Which sprite and which atlas is the client's.
- **Trailing**: per owner a ring of `FOLLOWER.historyN` 30 points of the owner's path, one every 0.2 m; the follower
  heads for the point `FOLLOWER.gapM` 1.45 m back along that path (so it walks round a corner, never across it) at the
  owner's measured pace plus `catchPerM` 3.5 m/s per metre of lag past the gap (linear, never an exponential ease, at
  most 16 m/s), and a lag past `snapM` 7 m (a teleport, a warp, a handover) puts it straight behind the owner. It stands on
  the actors' ground (the water level on open water, a ring's level pad), never below the owner's own path height (so it
  floats along a glide), hops 0.07 m at 3.4 Hz while it walks (billboards have no walk cycle), and shows its back while it
  walks away from the camera (`frontOnly`: never). Drawn at 0.72 of its §10.4.3 size, never taller than 1.5 m.
- **World effects**: followers are walkers after the character rigs (slots `FOLLOWER.slot0` 48 .. 63; `STEPS.slots` is
  64), so they get footsteps, prints, grass bend and the surf wake like any actor (`combinedWalkers`).
- **The Fire lead's light**: one non-shadow `PointLight` (`#ff9a3c`, range 14 m, decay 2) always in the scene at intensity
  0, so turning it up changes no program (the layout loops every local light); `setLight` carries it 1.1 m over the
  owner's follower at `level` × 60 (twice a lantern: it has to read at night) with a gentle flicker; hidden or released, it goes back to 0.
- **The actor lift** (`CharacterPool.setLift(id, m)`, `groundAt(x, z)`; additions to §10.7.6): a gliding actor's feet
  float `m` over the ground, its contact shadow stays on the ground (smaller the higher it flies), and it is no walker for
  the world effects while lifted (no dust kicked up mid-air).
- **Field effects** (`WorldFx.field(kind, x, y, z, dx?, dz?)`, recipes in `WORLD_BURSTS`, the same particle pool and
  program): `burn` flames, smoke and embers; `dig` soil and dust; `dive` a column of spray and a ring; `diveMark` a slow
  dark ring and bubbles (a dark-water spot); `sense` / `wanted` a glowing mote on a ghost's haunt and `senseRing` /
  `wantedRing` where it walks now (pink; a wanted ghost the hot orange); `gust` a glide's take-off.
- **Brambles** (§10.5 builder): `ObstacleSpec.kind` gains `'bramble'`: a knot of four of the biome's bushes on its own
  object; cleared (burnt), it is gone. Movement is not render's business: the client's collider blocks an unburnt one.

Budget: + 0 draw calls and programs at rest (a follower is a creature billboard on its atlas's material, the light is a
local light); each follower is one billboard draw.

### 10.7.10 Camp bases <!-- added 2026-10-22: camp bases (spine §3.19) -->

`ZoneSpec.camps?: CampSpec[]` (a route's travellers' camp: `{ id, banner: CampSlotSpec, slots: CampSlotSpec[] }`, each
slot `{ x, z, yaw }` with local +z facing the fire) and `ZoneHandle.camps?: CampsHandle`:

```ts
export type CampTrophyKind = 'scar' | 'legend' | 'medal' | 'achievement' | 'bounty';
export interface CampsHandle {
  readonly ids: readonly string[];
  set(id: string, held: { readonly trophies: readonly (CampTrophyKind | null)[] } | null): void;   // null = a free camp: nothing shown
  shown(id: string): { readonly banner: boolean; readonly trophies: readonly (CampTrophyKind | null)[] } | null;
}
```

The builder (`buildCamps`, after the obstacles) puts, per camp, the banner pole and, per slot, one object for every trophy
kind, all hidden, each its own object on the ground (`heightClamped` - 0.04 m) under the zone root; `set` shows the banner
and one kind per slot. Every piece is the biome set's own prop builders and surfaces (`zone/generators/trophies.ts`): a
`legend` is the crystal housing on its carved stand, a `medal` a lit brazier, an `achievement` a post lantern, a `bounty`
a wanted board (two posts, a plank, three pinned notices) with a crate at its foot, a `scar` a standing stone with three
glowing claw marks; the banner a pole with a crossbar, a cloth flag with a metal band and a glowing diamond, a metal
finial. No collider footprint (walk-through), no heightfield change; the geometry is recorded in the zone digest.
Budget: the shown pieces only (a banner and up to three trophies, a few draws each); 16 hidden objects per camp cost no draw.

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
 → grain 0.052 (zero-mean, luminance-weighted: `post/grain.ts` `GrainNode`)
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
import { grain } from './grain.js';                           // GrainNode (amended 2026-10-06; three's FilmNode is not used)
import { chromaticAberration } from 'three/addons/tsl/display/ChromaticAberrationNode.js';

export interface PostUniforms {
  readonly focusPoint: UniformNode<'vec3', Vector3>;   // rig.focus (world)
  readonly planeNormal: UniformNode<'vec3', Vector3>;  // §10.7.3 n, world space
  readonly chroma: UniformNode<'float', number>;       // 0 at rest; CHROMA_SUPER 0.012 for 120 ms
  readonly lift: UniformNode<'vec3', Vector3>; readonly gamma: UniformNode<'vec3', Vector3>; readonly gain: UniformNode<'vec3', Vector3>;
  readonly vignette: UniformNode<'float', number>;     // 0.22
  readonly grain: UniformNode<'float', number>;        // 0.052 (GrainNode intensity)
  readonly exposure: UniformNode<'float', number>;     // 1.0
  readonly bokehScale: UniformNode<'float', number>;   // 6 × pixelRatio (§10.7.3)
  readonly vignetteAspect: UniformNode<'float', number>; // height / width, 0.5625 at 16:9
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
    aoNode.resolutionScale = 0.5; aoNode.samples.value = 16; aoNode.radius.value = 0.9; aoNode.thickness.value = 0.6; aoNode.scale.value = 1.0; aoNode.useTemporalFiltering = passes.traa && f.taa && backend === 'webgpu';   // temporal filtering needs TRAA in the graph
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
  const worldPos = uniform(camera.matrixWorld).mul(vec4(getViewPosition(screenUV, depthT, uniform(camera.projectionMatrixInverse)), 1)).xyz;   // scene-camera matrices as own uniforms (header table)
  const planeDist = dot(worldPos.sub(u.focusPoint), u.planeNormal);                    // §10.7.3 d
  const blurred = passes.dof && f.dof ? dof(bloomed, planeDist.negate(), 0, 6.0, u.bokehScale) : bloomed;
  const focused = passes.dof && f.dof ? mix(blurred, bloomed, maskT.y) : bloomed;

  // Chromatic aberration (transient)
  const ca = f.chroma ? chromaticAberration(focused, u.chroma, vec2(0.5, 0.5), float(1.1)) : focused;   // explicit centre: a null centre throws at build (header table)

  // ACES then grade (display-referred), vignette, grain
  const aces = passes.grade ? acesFilmicToneMapping(ca.rgb, u.exposure) : ca.rgb;
  const graded = passes.grade ? pow(aces.mul(u.gain).add(u.lift), vec3(1).div(u.gamma)).clamp(0, 1) : aces;   // lift/gamma/gain: out = (in·gain + lift)^(1/gamma)
  const r = length(screenUV.sub(0.5).mul(vec2(1, u.vignetteAspect)));                  // aspect-corrected radius: vignetteAspect = height / width (0.5625 at 16:9), written on resize
  const vig = passes.grade ? graded.mul(oneMinus(smoothstep(0.35, 0.85, r).mul(u.vignette))) : graded;
  const grained = f.grain && passes.grade ? grain(vec4(vig, 1), u.grain).rgb : vig;

  const pipeline = new RenderPipeline(gpu, renderOutput(vec4(grained, 1), NoToneMapping, SRGBColorSpace));
  pipeline.outputColorTransform = false;
  return { pipeline, nodes: { scenePass, maskT } };
}
```

As implemented the function is split into `planPostGraph` (pure: which stages, which numbers — what `post-graph.test.ts` asserts), `buildPostOutput` (the TSL above) and `PostStack` (one `RenderPipeline`, a persistent scene pass, rebuilds by `outputNode` + `needsUpdate`, and the dispose walk of §10.1.5); the grade also clamps `c·gain + lift` at 0 before `pow`. <!-- amended 2026-09-25: render IMPLEMENTATION-NOTES M11, M12, C14 -->
Grain is `GrainNode` (`post/grain.ts`): `c · (1 + k · (n − 0.5) · 4L(1 − L))` with `n` a per-pixel, per-frame uniform hash, `L` the luminance and `k = 0.052` — zero-mean (σ ≈ 1.5 % at mid-grey), blacks and whites untouched. three 0.186's `film` (`mix(base, base + base·clamp(noise + 0.1, 0, 1), intensity)`) never darkens, so at 0.035 it brightened every pixel by ≈ 2.1 % and toggling reduced effects changed the exposure while the grain itself stayed under one 8-bit level (audit M2-spawn-noon-13). <!-- amended 2026-10-06: Phase E2, the re-landed M2 re-light (audit M2-spawn-noon-2, M2-gym-dusk-2, M2-lamps-night-5, M2-spawn-noon-13); render IMPLEMENTATION-NOTES "Phase E1–E2" --> The `mask` target is read by two consumers (AO exclusion, DOF composite) and by `pillars.spec.ts`. Every uniform in `PostUniforms` is written in `frame()` from the rig and the palette; `setEffects` and `BudgetProbe.setPassEnabled` call `buildPostGraph` again and assign `pipeline.outputNode = …; pipeline.needsUpdate = true` (disposing the previous display nodes), so a disabled pass has **no** render target and **no** cost.

### 10.8.3 Numbers that are assertions

| Stage | Setting | Where checked |
|---|---|---|
| MRT | 4 HalfFloat targets + depth at drawing-buffer size: at 3840×2160 that is 4 × 66.4 MB = 265.4 MB. The draft's "inside the 700 MB cap with ≈ 180 MB of zone textures and ≈ 40 MB of atlases" undercounted: a zone binds ≤ 8 atlases ≈ 256 MB plus ≤ 6 singles ≈ 48 MB (`40-pipelines.md` §40.1.4; measured 167 MB for 5 atlases), each 2048² CSM cascade also allocates a colour attachment (≈ 32 MB, ≈ 128 MB for four), and TRAA/DOF/bloom/`convertToTexture` targets scale with the drawing buffer. MRT + atlases + singles + zone textures alone are ≈ 750 MB at 3840×2160 — over the cap before the shadow and post targets (recommendation R5). `renderer.info.memory.texturesSize` counts KTX2 textures as 1 byte each, so the metric is `RenderStats.textureBytes` (§50.2.2) <!-- amended 2026-09-25: render IMPLEMENTATION-NOTES C17, C18, part-3 measurements --> | `budget.spec.ts` `texturesSize` |
| GTAO | 1280×720 at `pr 1` on 1440p (`resolutionScale 0.5`), `samples 16` | §50.2.1 row `GTAO 1.2 ms` |
| TRAA | MSAA off (`antialias: false`) | `createRenderer` throws if `gpu.samples > 0` |
| Bloom | threshold 1.15 > 1.10 environment ceiling, < 1.35 creature emissive, < 3.2 housings | asset-audit `materials.albedoCeiling` + `pillars.spec.ts` bloom-gap shot (the brightest non-emissive pixel in the noon shot's beauty target ≤ 1.15) |
| DOF | tilt 24°, focalLength 6 m, bokehScale 6 px × `pr`, mask over sharp billboards (CoC at the Pillar 1 prop = 2.85 px at `pr 1` — §10.7.3, recommendation R3) | Pillar 1 test |
| Vignette | 0.22 at the corners (`r = 0.5·√(1 + 0.5625²) ≈ 0.574` → `t = 0.447`, `smoothstep(0.35, 0.85, 0.574) = t²(3 − 2t) = 0.42` → **9.3 %** darkening at the far corner; 22 % is the cap the uniform expresses) <!-- amended 2026-09-25: the draft's 0.36 / 8 % was an arithmetic slip; render IMPLEMENTATION-NOTES M20, the test asserts 9.3 % --> | shot readback in the hostile audit |
| Grain | `GrainNode` 0.052, mean-preserving (amended 2026-10-06) | reduced effects → the `GrainNode` is absent from the graph; `post-graph.test.ts` checks the zero mean |

### 10.8.4 `ReducedEffects` — always wins

`setEffects(f)` is the only entry; the client computes `f` through `effectsFlags(settings, reduced)` (`20-client.md` §20.8.2), where reduced sets `dof/grain/chroma/shake/hitstop/slowmo = false`. Render enforces the same on its side: when `f.shake === false`, `CameraRig.shake` returns without writing; when `f.hitstop === false` or `f.slowmo === false`, `setTimeScale(s)` with `s !== 1` is coerced to 1 (so a stale timeline frame cannot freeze the render clock); when `f.dof === false` the DOF node is not built; when `f.grain === false` the film node is not built; when `f.chroma === false` the aberration node is not built. Bloom and TRAA stay (static; Pillar 8 lists exactly grain, aberration, shake, hitstop). Pillar 8 test: 600 frames with reduced effects → zero frames with shake offset ≠ 0 and zero frames with `timeScale !== 1`.

---

## §10.9 IN-CANVAS HUD LAYER

**Battle plates** (amended 2026-09-30). Bars are clamped inside the screen margins, moved off the turn label, the party strip and the clock by the smallest move, never overlap one another (P4-C8, render Part 4 H10), and never sit under the DOM battle panel: `hud.setBottomInset(cssPx)` (the panel's height, from the client) lowers the bars' floor (render Part 5 T2, audit M2-battle-6). Each plate draws its creature's type badge(s) — amended 2026-10-11 (Broadcast UI): a 16 px square of the §10.4.6 type colour (the colourblind table when one is set) carrying the type's icon (`hud/typeIcons.ts`, the client's `ui/typeIcons.ts` verbatim; one cached `Path2D` per type) stroked in the ink of higher contrast; a surface without `Path2D` falls back to the 3-letter name — on its bottom row (`HudModel.battle.bars[].types`, `20-client.md` §20.6; audit M2-battle-7). The plate is 240 px wide (was 210) to hold two badges beside the status pill and the HP numbers. Since 2026-10-11 the whole layer is drawn in the client's Broadcast language: 0.92-alpha black/carbon slabs with a 12° cut edge, paper text, uppercase condensed display face (800, italic for names), skewed HP bars (paper > 50 %, amber, red), `#ff5b1f` only for the lead party card, the prompt's key chip, the turn chip, the zone banner's edge and the OBJECTIVE strip; no green, no rounded corners (render IMPLEMENTATION-NOTES "Broadcast UI"). <!-- amended 2026-10-11: Broadcast UI -->

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

Implementation: one `OffscreenCanvas` (fallback `HTMLCanvasElement`) at `cssWidth·pr × cssHeight·pr`, one `CanvasTexture` (`NoColorSpace` — it carries the canvas's raw sRGB bytes, `minFilter = LinearFilter`, `magFilter = LinearFilter`, `generateMipmaps = false`, `premultiplyAlpha = true`), one full-screen `PlaneGeometry(2, 2)` with `MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false })`, `blending = CustomBlending` One / OneMinusSrcAlpha (premultiplied) and `colorNode = texture(hudTex)`, rendered by `gpu.render(hudScene, new OrthographicCamera(-1, 1, 1, -1, 0, 1))` after `pipeline.render()` with `gpu.autoClear = false` **and `gpu.outputColorSpace = gpu.workingColorSpace`** for that call (§10.1.4: otherwise the render goes through the intermediate framebuffer target, whose output pass overwrites the post image). <!-- amended 2026-09-25: render IMPLEMENTATION-NOTES P1 --> The HUD is therefore never touched by bloom, DOF, grain or aberration (Pillar 8; `50-verification-budget.md` §50.1 rule 15 measures exactly this).

Regions (each with its own dirty bit; a `set` marks only the regions its keys belong to): `party` (top-left strip, 56×76 px cards carrying the species' front thumbnail, `/creatures/thumbs/<id>_front.webp`, loaded once per species — amended 2026-10-11), `zoneName` (a centre-top lower-third: a paper "NOW ENTERING" tag over an orange edge block and the 48 px name, 78 px tall — amended 2026-10-11), `timeOfDay` + `questHint` (top-right), `chat` (bottom-left, 6 lines, fade 8 s — the fade re-marks the region dirty at 4 Hz while a line is fading), `prompt` (bottom-centre), `nameplates` (positions from `ActorPool.screenPositions`, redrawn when a position moves ≥ 1 px), `battle` (bars anchored above the billboards via the stage's projected positions; HP tween at 30 Hz while a `hp` frame is active), `connection`, `dev`. Text: body 14 px minimum at `uiScale 1` (spine/plan: "text ≥ 14 px"), numerals `tabular-nums`, 2 px dark outline under every glyph over the world. Nameplates cap at 16 (the model's cap). `drawIfDirty` costs 0 when nothing changed; the `20-client.md` §20.10.2 dirty test asserts that 600 idle frames produce 0 uploads.

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
  readonly shadowDrawCalls: number;          // the frame's MEASURED shadow-map draw calls (host inspector); the upper-bound estimate only before a frame — amended 2026-09-30, B2
  readonly culledChunks: number;              // scatter chunks outside the frustum this frame (legacy-render-audit Q19: the cull rate is reported, not assumed) — reconciled 2026-09-18
  readonly lightIds: readonly string[];       // LightSource ids present, sorted; pillars.spec.ts compares it before and during a battle (Pillar 7)
  // amended 2026-09-30 (P4-C5, the fields §40.5.2 says the dump gains): materials[].side (0 | 1 | 2); geometries[].sharedBy,
  // .kind (scatter kind or null), .tier? (0..3, 3 = impostor), .instancedMesh; lightSources: { id, lightDistance }[] — every
  // tagged housing and the distance from its glowing part to the nearest light (+∞ → JSON null), Pillar 4 both directions
}

export interface ZoneViewOptions extends RendererOptions { readonly zone: ZoneSpec; readonly shots: readonly CameraShot[] }
export interface CameraShot { readonly id: string; readonly heading: 0 | 1 | 2 | 3; readonly zoomStop: 0 | 1 | 2; readonly focus: readonly [number, number]; readonly timeOfDay: number; readonly battle: boolean }
export interface ZoneView extends BudgetProbe { readonly renderer: Renderer; setShot(s: CameraShot): void; frame(dtMs: number): void; setSimMs(ms: number): void; dispose(): void }
export function createZoneView(o: ZoneViewOptions): Promise<ZoneView>;   // createRenderer + loadZone + scripted rig; no network, no client store
```

`setPassEnabled('opaque' | 'sprites' | 'shadows', false)` are realised outside the post graph: `opaque` → the zone root's `visible = false` (billboards stay), `sprites` → `layers` 28/29 and the billboard layer 27 disabled on the camera, `shadows` → `gpu.shadowMap.enabled = false`. The other five are post-graph rebuilds (§10.8.2). `gpuFrameMs()` = `gpu.resolveTimestampsAsync(TimestampQuery.RENDER)`; `undefined` without `timestamp-query`.

**Texture bytes** <!-- amended 2026-10-06 -->: `RenderStats.textureBytes` = `info.memory.texturesSize` + the library's resident KTX2 bytes − the sprite pool's `infoOvercountBytes()`; a 2048² creature atlas reads 33.5 MB (three's own count 58.7 MB), a 3072 × 2048 flipbook side 50.2 MB (88.0 MB).

### 10.10.2 Assertions (the `PLAN.md` table, made per-pass by `50-verification-budget.md` §50.2.1, restated as what this package must hit on the reference machine)

| Row | Target ms | Ceiling ms | What in this file decides it |
|---|---|---|---|
| opaque | 2.6 | 3.4 | ≤ 336 beauty draws (§10.5.8), ≤ 2.5 M tris, chunked LOD, one material graph |
| sprites | 0.8 | 1.2 | ≤ 40 billboards, alpha-tested (no sorting), pooled VFX ≤ 512 particles each |
| shadows | 2.0 | 2.6 | 4 × 2048² cascades + ≤ 8 local casters at 512²/256² |
| GTAO | 1.2 | 1.6 | half-res, 16 spp |
| TRAA | 0.7 | 1.0 | full-res resolve, no MSAA |
| bloom | 0.7 | 1.0 | `resolutionScale 0.5`, 5 mips |
| DOF | 0.9 | 1.3 | full-res CoC + half-res near blur (node internals) + 1 composite |
| grade / HUD | 0.5 | 0.7 | one quad for ACES/grade/vignette/grain, one HUD overlay draw |
| **total** | **10.0** | **13.5** | with sim 0.6 |

Counts (`50-verification-budget.md` §50.2.2): draw calls ≤ 400, triangles ≤ 2 500 000, texture bytes (`RenderStats.textureBytes`) ≤ 734 003 200 bytes, materials ≤ 48, shadow lights ≤ 8, non-shadow ≤ 24, **render targets ≤ 41**, **programs ≤ 128**.

<!-- amended 2026-09-25: the caps 24 and 96 were measured impossible with the stock three 0.186 display nodes — render IMPLEMENTATION-NOTES C18 and Part 2 "Measured" -->
Render targets, as the stock nodes allocate them (measured at 1280×720 with the full graph): scene MRT 1 + GTAO 1 + TRAA 2 + its input `RTTNode` 1 + bloom 11 + DOF 6 + its internal Gaussian blur 2 + its input `RTTNode` 1 + chromatic-aberration input `RTTNode` 1 + PMREM target and ping-pong 2 + IBL probe 1 = **29**, plus 4 CSM cascades and 1 per local shadow caster (≤ 8 scene-wide, beacons included, §10.3.2) = **≤ 41**; measured 32 after step 8 and **34** with a zone (1 local caster). The draft's "scene MRT 1 + GTAO 2 + TRAA 2 + bloom 10 + DOF 4 + impostors ≤ 6 → steady 20" omitted the shadow maps, the PMREM and the `convertToTexture` targets the display nodes create, and impostors no longer use render targets (§10.5.7). Amended 2026-10-06 (handover): the fixed light layout's 2 shadow slots exist from construction (1×1 maps until a zone borrows one): measured 35 after step 8 and 36 with Mirevale. Programs, as amended the same day: 89 after step 8 and 107 with Mirevale, constant across handovers (no light-set variants exist any more, §10.3.2). Before that amendment: Programs: 79 after step 8 (63 host + 16 stage/HUD) + the zone's light-set variants (C11; +28 on Mirevale) = **107 measured** in every slice shot; 128 leaves ≈ 20 % for a second light-set variant (a spectator arena, a harvested zone) — fewer distinct punctual-light sets per zone, or warm-compiling with the zone's set (recommendation R6), are the levers if a zone exceeds it.

### 10.10.3 `RenderStats.passMs`

Filled by the differential procedure of `50-verification-budget.md` §50.2.3 (`T_all − T_without_p`), which `createZoneView` runs when the harness asks; that is the budget measurement and, once run, its numbers stay (latched). A renderer created with `trackTimestamp` also fills `passMs` per render context between runs: the host's inspector maps every `render()` uid to a row by its target (scene pass → `opaque`, the stages' own targets → their row, shadow maps → `shadows`, canvas → `grade`, anything else → `opaque`), `sprites` stays `null` (billboards render inside the scene pass, §10.8.1). The uid map keeps two generations and is never pruned on a resolve: three's timestamp pool returns the previous batch unchanged when no query is pending, so a second resolve of one batch must attribute it the same way. Without `trackTimestamp` every entry is `null` in play. `stats()` copies numbers into a preallocated record — no object is created per call. <!-- amended 2026-09-30: render Part 4 H6 (P4-C2) and Part 5 B1 (the harness saw every context in `opaque` because a second resolve found the uids deleted) -->

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
| **`billboarding()` TSL helper** | reads `cameraViewMatrix`, which is the light's during the shadow pass | `cameraYaw` + `cameraLean` uniforms written per frame (§10.4.4) |
| **MSAA** | forbidden with TRAA (`TRAANode.js` header) | TRAA (webgpu) / SMAA (webgl2 fallback) |
| **Per-instance LOD, GPU-driven culling, `BatchedMesh`** | chunked `InstancedMesh` already meets ≤ 400 draws; the extra machinery has no budget row | 32 m chunk LOD (§10.5.7) |
| **Runtime texture generation (`CanvasTexture`/`DataTexture` on lit materials)** | the old world's zero-texture look came from exactly this; KTX2 at build is 4–6× smaller and mipped | build-time KTX2 sets, `textures.ktx2Only` audit rule |
| **A second code path for harvested zones** | the spine forbids it | `harvestLevel` uniform in the one material graph (§10.2.4) |
| **Static-caster shadow caching** | not in v1; the 2.0 ms shadows row is met with per-frame updates on the reference GPU | follow-up if the M2 capture says otherwise (`50-verification-budget.md` §50.7 change log) |
| **WebGL2 as a designed tier** | allowed to run, never budgeted or audited (`50-verification-budget.md` §50.3) | `WebGPURenderer` with three's automatic fallback; `smaa` substituted for `traa` |

---

## NON-NEGOTIABLES (this file)

1. One renderer, one pipeline, one scene, one camera; the zone root is never removed during a battle (Pillar 7).
2. Every lit opaque material carries albedo + ORM + normal from KTX2 (billboards: WebP atlases with the same three roles; characters: the KTX2 look atlas, albedo only — §10.7.7); no runtime-generated texture reaches a lit material.
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
4. `50-verification-budget.md` → **done**: §50.4.6 now names the pre-TRAA `output` read for Pillar 6, the `mask` read for Pillar 1, the rules `materials.albedoCeiling`, `shadows.drawCalls`, `harvest.same`, `geometry.noOutlineShells`, `scatter.instanced`, the bloom-gap shot, `renderTargets` steady state 20 ≤ 24 and `programs` constant across cycles (superseded 2026-09-25: `renderTargets ≤ 41`, `programs ≤ 128`, programs back to baseline after unload — §10.10.2, §10.5.9).
