/**
 * SPEC §10.1 — the renderer host (+ §10.10.1 `createZoneView` / `BudgetProbe`).
 *
 * `createRenderer(o)` follows the §10.1.2 construction order exactly; `frame(dtMs)` follows the seven
 * steps listed under it; `dispose()` follows §10.1.5. The subsystems other agents own (camera rig,
 * battle stage, HUD, actor pool, zone builder, billboard hooks) are injected through
 * `RendererSubsystems`; `DEFAULT_SUBSYSTEMS` wires the placeholders from `defaults.ts` and is the single
 * replacement point when those modules land.
 *
 * three 0.186 facts this file depends on (verified in node_modules, recorded in IMPLEMENTATION-NOTES.md):
 * - `WebGPURenderer.init()` starts an internal rAF loop (`Animation.start()`) that runs
 *   `info.reset()` + `nodeFrame.update()` once per display frame even without `setAnimationLoop`, so
 *   `info.autoReset = true` counts per rAF tick. Frame-scoped node updates (TRAA jitter, GTAO/bloom/DOF
 *   passes) run once per `frameId`; when `frame()` is called more than once inside one tick (warm-up,
 *   harness loops) the host advances the frame itself (`advanceStaleFrame`).
 * - `trackTimestamp` IS declared in `@types/three` 0.186 `WebGPUBackendParameters` (the SPEC says it
 *   is missing); no cast is needed.
 * - `GPUAdapterInfo` is not kept by the backend; `device.adapterInfo` is read instead.
 */
import {
  BufferAttribute, ColorManagement, Group, HalfFloatType, Matrix4, Mesh, NoToneMapping, PerspectiveCamera, PlaneGeometry, SRGBColorSpace, Scene,
  Vector3, WebGPURenderer,
} from 'three/webgpu';
import { velocity } from 'three/tsl';
import type { BufferGeometry, Camera, Object3D, RenderTarget } from 'three/webgpu';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import type {
  ActorPool, BattleStage, CameraRig, HudLayer, ZoneHandle, ZoneSpec,
} from './contracts.js';
import type { ZoneLoader } from './defaults.js';
import { zoneSystemFor } from './zone/system.js';
import { PART3_SUBSYSTEMS } from './stage/wiring.js';
import {
  ALL_EFFECTS, LAYERS, type Backend, type BudgetCounts, type BudgetPass, type EffectsFlags, type HarvestLevel, type RenderCaps,
  type RenderStats, type WeatherKind,
} from './descriptors.js';
import { toHarvestLevel } from './materials/harvest.js';
import { countMaterials, createMaterialLibrary, MaterialBudget, type MaterialLibrary } from './materials/library.js';
import { SURFACES, SURFACE_IDS } from './materials/surfaces.js';
import { WATER_DEPTH_ATTRIBUTE } from './materials/graph.js';
import { DayCycle, daylight, GROVE_LIGHTING, type LightingPalette } from './lighting/daycycle.js';
import { createHeightFog, type HeightFog } from './lighting/fog.js';
import { LightRig } from './lighting/rig.js';
import { SkyController } from './lighting/sky.js';
import { PrecipitationSheet, weatherParams } from './lighting/weather.js';
import { coerceTimeScale } from './post/effects.js';
import { GROVE_GRADE, type GradePalette } from './post/grade.js';
import { ALL_PASSES_ON, GRAPH_PASSES, PostStack, type PassSwitches } from './post/pipeline.js';
import {
  computePassMs, copyInfo, countPunctualLights, createRenderStats, dumpZone, median, PassTimer, readBudgetCounts, TimestampResolver,
  type LightCountsOut, type MutableRenderStats, type TimestampPoolLike, type ZoneDump,
} from './stats.js';

// ---- §10.1.1 public surface (verbatim) --------------------------------------------------------------------

export interface RendererOptions {
  readonly canvas: HTMLCanvasElement;
  readonly pixelRatio: number;                 // requested; §10.1.3 clamps it
  readonly effects: EffectsFlags;
  readonly forceWebGL?: boolean;               // default false; test harnesses only
  readonly trackTimestamp?: boolean;           // default false; the budget harness passes true
  readonly transcoderPath?: string;            // default '/basis/'; where basis_transcoder.{js,wasm} are served
  // ---- additions (documented in IMPLEMENTATION-NOTES.md) ----
  /** Where `materials.manifest.json` and the KTX2 sets are served. Default `'/materials/'`. */
  readonly materialsUrl?: string;
  /** Millisecond clock for `RenderStats.frameMs`; render never reads a wall clock itself (§10 NN 10). Default: none (frameMs = 0). */
  readonly clock?: () => number;
  /**
   * Shader pre-compilation progress (IMPLEMENTATION-NOTES Part 4, H4): `createRenderer` step 8 (`phase 'boot'`) and
   * every `loadZone` (`phase 'zone'`) compile the scene-pass programs through `compileAsync` before anything is drawn;
   * `loaded` / `total` count render objects. For the client's BootScreen.
   */
  readonly onCompileProgress?: (p: CompileProgress) => void;
}

/** One `onCompileProgress` report. `done` is true on the last report of a phase (with its wall time when a clock is set). */
export interface CompileProgress {
  readonly phase: 'boot' | 'zone';
  readonly zone: string | null;
  readonly loaded: number;
  readonly total: number;
  readonly done: boolean;
  readonly ms: number | null;
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

export type RenderInitErrorCode = 'no-gpu' | 'texture-size' | 'msaa';

export class RenderInitError extends Error {
  constructor(readonly code: RenderInitErrorCode, detail?: string) {
    super(`@ewa/render: renderer init failed (${code})${detail ? `: ${detail}` : ''}`);
    this.name = 'RenderInitError';
  }
}

// ---- §10.1.3 pixel-ratio policy (pure) ---------------------------------------------------------------------

export const PIXEL_RATIO_CAP = 1.5;
export const MAX_DRAWING_WIDTH = 3840;

/** `pr = min(requested, 1.5, 3840 / cssWidth)`; invalid inputs fall back to 1 / no width cap. */
export function clampPixelRatio(requested: number, cssWidth: number): number {
  const r = Number.isFinite(requested) && requested > 0 ? requested : 1;
  const w = Number.isFinite(cssWidth) && cssWidth > 0 ? MAX_DRAWING_WIDTH / cssWidth : Number.POSITIVE_INFINITY;
  return Math.min(r, PIXEL_RATIO_CAP, w);
}

// ---- §10.1.2 step 5 helpers (pure) --------------------------------------------------------------------------

export const MIN_MAX_TEXTURE_SIZE = 8192;

export interface Ktx2SupportLike { readonly astcSupported?: boolean; readonly bptcSupported?: boolean; readonly etc2Supported?: boolean }

/** `'astc'` if ASTC, else `'bc7'` if BPTC, else `'etc2'`, else `'rgba8'` (§10.1.2 step 5). */
export function chooseKtx2Target(c: Ktx2SupportLike | null | undefined): RenderCaps['ktx2'] {
  if (c?.astcSupported) return 'astc';
  if (c?.bptcSupported) return 'bc7';
  if (c?.etc2Supported) return 'etc2';
  return 'rgba8';
}

/** §10.1.2 step 6 (Pillar 1): vertical FOV 28°, near 0.5, far 220. */
export const CAMERA_PARAMS = Object.freeze({ fovV: 28, near: 0.5, far: 220 });

/** Layers the scene camera renders: default + billboards 27, decals 28, fx 29, sky 30 (debug 31 excluded). */
export const CAMERA_LAYERS: readonly number[] = Object.freeze([LAYERS.default, LAYERS.billboards, LAYERS.decals, LAYERS.fx, LAYERS.sky]);

// ---- subsystem injection -------------------------------------------------------------------------------------

/** What the host exposes to subsystems, the sandbox and the budget harness (`rendererInternals`). */
export interface HostContext {
  readonly gpu: WebGPURenderer;
  readonly backend: Backend;
  readonly caps: RenderCaps;
  readonly scene: Scene;
  readonly camera3: PerspectiveCamera;
  readonly ktx2: KTX2Loader;
  readonly materials: MaterialLibrary;
  readonly lighting: LightRig;
  readonly sky: SkyController;
  readonly fog: HeightFog;
  readonly day: DayCycle;
  readonly precipitation: PrecipitationSheet;
  readonly post: PostStack;
  readonly statsRecord: MutableRenderStats;
  effects(): EffectsFlags;
  timeScale(): number;
  harvestLevel(): HarvestLevel;
  /** The loaded zone root, or the root registered through `setZoneRoot` (sandbox), or null. */
  zoneRoot(): Group | null;
  /** Registers a zone root built outside `loadZone` (sandbox / harness); counted by stats and the probe. */
  setZoneRoot(root: Group | null): void;
  setLightingPalette(p: LightingPalette): void;
  setGrade(g: GradePalette): void;
  /** `BudgetCounts` captured right after construction step 8 (the leak-test baseline, §50.1.9). */
  readonly baseline: BudgetCounts;
  /** `RenderStats.materials` / light counts refresh (called after zone changes). */
  refreshSceneCounts(): void;
}

/** Per-frame hooks from other subsystems (e.g. billboards: uniform writes only). */
export interface FrameHook {
  /** `dtRealMs` (unscaled) is passed as a second argument for hooks that must not stop at hitstop (HUD clock, fades). */
  update?(dtScaledMs: number, dtRealMs?: number): void;
  setHarvestLevel?(l: HarvestLevel): void;
  /** Called after `loadZone` resolves (part 3: the stage/actors sample the zone's collider for ground heights). */
  onZone?(zone: ZoneHandle | null): void;
  dispose?(): void;
}

export interface HudBinding {
  readonly layer: HudLayer;
  /** The overlay drawn after `pipeline.render()` with `autoClear = false` (§10.9); null = nothing to draw. */
  readonly overlay: { readonly scene: Scene; readonly camera: Camera } | null;
}

export interface RendererSubsystems {
  camera(ctx: HostContext): CameraRig;
  stage(ctx: HostContext): BattleStage;
  hud(ctx: HostContext): HudBinding;
  actors(ctx: HostContext): ActorPool;
  zones(ctx: HostContext): ZoneLoader;
  hooks(ctx: HostContext): readonly FrameHook[];
  /** Extra objects rendered in the step-8 warm-up frame (e.g. one billboard). */
  warmup(ctx: HostContext): readonly Object3D[];
}

/** The replacement point for §10.4–§10.9 (see defaults.ts). */
export const DEFAULT_SUBSYSTEMS: RendererSubsystems = {
  // part 3 (§10.4 sprites, §10.7 camera/stage/actors, §10.9 HUD) — lazy references: stage/wiring.ts imports this module
  camera: (ctx) => PART3_SUBSYSTEMS.camera(ctx),
  stage: (ctx) => PART3_SUBSYSTEMS.stage(ctx),
  hud: (ctx) => PART3_SUBSYSTEMS.hud(ctx),
  actors: (ctx) => PART3_SUBSYSTEMS.actors(ctx),
  zones: (ctx) => zoneSystemFor(ctx),
  hooks: (ctx) => [zoneSystemFor(ctx), ...PART3_SUBSYSTEMS.hooks(ctx)],
  warmup: (ctx) => PART3_SUBSYSTEMS.warmup(ctx),
};

const INTERNALS = new WeakMap<Renderer, RendererHost>();

/** Host internals for subsystems, the sandbox and the harness. `undefined` for foreign objects. */
export function rendererInternals(r: Renderer): HostContext | undefined {
  return INTERNALS.get(r);
}

// ---- construction --------------------------------------------------------------------------------------------

interface WebGPUDeviceLike { readonly limits?: { readonly maxTextureDimension2D?: number }; readonly adapterInfo?: { readonly description?: string; readonly vendor?: string; readonly architecture?: string } }
interface BackendLike { readonly isWebGPUBackend?: boolean; readonly device?: WebGPUDeviceLike; readonly gl?: { getParameter(p: number): unknown; readonly MAX_TEXTURE_SIZE: number } }

function readDeviceCaps(gpu: WebGPURenderer, backend: Backend): { maxTextureSize: number; adapter: string | null } {
  const b = gpu.backend as unknown as BackendLike;
  if (backend === 'webgpu') {
    const d = b.device;
    const info = d?.adapterInfo;
    const desc = info?.description && info.description.length > 0
      ? info.description
      : [info?.vendor, info?.architecture].filter((s) => s !== undefined && s.length > 0).join(' ');
    return { maxTextureSize: d?.limits?.maxTextureDimension2D ?? 0, adapter: desc.length > 0 ? desc : null };
  }
  const gl = b.gl;
  const max = gl ? Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) : 0;
  return { maxTextureSize: Number.isFinite(max) ? max : 0, adapter: null };
}

/**
 * §10.1.2 — the order is the contract:
 * 1 renderer · 2 init · 3 backend · 4 colour/shadow state · 5 KTX2 + caps · 6 scene + camera ·
 * 7 lighting, sky + PMREM, fog, post, HUD, stage, actors · 8 warm-up compile (baseline after it).
 */
export async function createRenderer(o: RendererOptions, subsystems: RendererSubsystems = DEFAULT_SUBSYSTEMS): Promise<Renderer> {
  // 1.
  const gpu = new WebGPURenderer({
    canvas: o.canvas, antialias: false, alpha: false, depth: true, stencil: false, forceWebGL: o.forceWebGL ?? false,
    powerPreference: 'high-performance', outputBufferType: HalfFloatType,
    ...(o.trackTimestamp ? { trackTimestamp: true } : {}),
  });
  // 2.
  try {
    await gpu.init();
  } catch (e) {
    throw new RenderInitError('no-gpu', e instanceof Error ? e.message : String(e));
  }
  // 3.
  const backend: Backend = (gpu.backend as unknown as BackendLike).isWebGPUBackend === true ? 'webgpu' : 'webgl2';
  if (gpu.samples > 0) {   // §10.8.3: TRAA forbids MSAA
    await gpu.dispose();
    throw new RenderInitError('msaa', `samples = ${gpu.samples}`);
  }
  // 4.
  gpu.toneMapping = NoToneMapping;
  gpu.outputColorSpace = SRGBColorSpace;
  gpu.shadowMap.enabled = true;
  gpu.shadowMap.transmitted = false;
  gpu.info.autoReset = true;
  // 5.
  const ktx2 = new KTX2Loader().setTranscoderPath(o.transcoderPath ?? '/basis/').detectSupport(gpu);
  const dev = readDeviceCaps(gpu, backend);
  const caps: RenderCaps = Object.freeze({
    backend,
    timestampQuery: backend === 'webgpu' && gpu.hasFeature('timestamp-query'),
    maxTextureSize: dev.maxTextureSize,
    ktx2: chooseKtx2Target(ktx2.workerConfig),
    adapter: dev.adapter,
  });
  if (caps.maxTextureSize < MIN_MAX_TEXTURE_SIZE) {
    ktx2.dispose();
    await gpu.dispose();
    throw new RenderInitError('texture-size', `maxTextureSize ${caps.maxTextureSize} < ${MIN_MAX_TEXTURE_SIZE}`);
  }
  // 6. + 7.
  const host = new RendererHost(gpu, backend, caps, ktx2, o, subsystems);
  // 8.
  await host.warmUp();
  INTERNALS.set(host, host);
  return host;
}

/** A tiny quad carrying every attribute zone geometry carries (position/normal/uv/color + water depth). */
function createWarmupGeometry(): BufferGeometry {
  const g = new PlaneGeometry(0.5, 0.5, 1, 1);
  const n = g.getAttribute('position').count;
  g.setAttribute('color', new BufferAttribute(new Float32Array(n * 3).fill(0.5), 3));
  g.setAttribute(WATER_DEPTH_ATTRIBUTE, new BufferAttribute(new Float32Array(n).fill(1), 1));
  return g;
}

const _focusFallback = new Vector3();

/** Concurrent `compileAsync` calls of one pre-compile (H4): several pipelines in flight for the driver's workers. */
export const COMPILE_CONCURRENCY = 4;
/** Fallback render call depth of the scene pass when none was measured yet (`PostStack.sceneCallDepth`). */
const SCENE_PASS_CALL_DEPTH = 2;

interface CompileStat { readonly objects: number; readonly ms: number | null; readonly groups: number }

class RendererHost implements Renderer, HostContext {
  readonly renderer: WebGPURenderer;
  readonly scene = new Scene();
  readonly camera3: PerspectiveCamera;
  readonly camera: CameraRig;
  readonly stage: BattleStage;
  readonly hud: HudLayer;
  readonly actors: ActorPool;
  readonly materials: MaterialLibrary;
  readonly lighting: LightRig;
  readonly sky: SkyController;
  readonly fog: HeightFog;
  readonly day: DayCycle;
  readonly precipitation: PrecipitationSheet;
  readonly post: PostStack;
  readonly statsRecord = createRenderStats();
  baseline: BudgetCounts = readBudgetCounts({ render: { drawCalls: 0, triangles: 0 }, memory: { textures: 0, texturesSize: 0, geometries: 0, programs: 0, renderTargets: 0, attributes: 0, attributesSize: 0, total: 0 } }, 0, 0, 0);

  private readonly hudOverlay: HudBinding['overlay'];
  private readonly zones: ZoneLoader;
  private readonly hooks: readonly FrameHook[];
  private readonly timestamps: TimestampResolver;
  /** Per-context GPU time → `passMs` (only when timestamps are tracked; IMPLEMENTATION-NOTES Part 4, H6). */
  readonly passTimer: PassTimer | null;
  /** Set once `measurePassMs` wrote the differential numbers: the live per-context values stop overwriting them. */
  passMsLatched = false;
  private readonly clock: (() => number) | null;
  private readonly onCompileProgress: ((p: CompileProgress) => void) | null;
  private readonly warmObjects: Object3D[] = [];
  /** The step-8 warm-up group (kept, detached): recompiled against every zone's light set (H4). */
  private warmGroup: Group | null = null;
  /** While a pre-compile runs: the renderer state frames must render with (the compile keeps the scene pass's). */
  private compileHold: { readonly target: RenderTarget | null; readonly mrt: ReturnType<WebGPURenderer['getMRT']>; readonly velocityProjection: Matrix4 | null } | null = null;
  /** The unjittered projection the velocity MRT reads while a pre-compile runs (what TRAA sets during its render). */
  private readonly compileProjection = new Matrix4();
  /** Last pre-compile per phase: render objects compiled and wall ms (sandbox / harness). */
  readonly compileStats: { boot: CompileStat | null; zone: CompileStat | null } = { boot: null, zone: null };
  private readonly lightCounts: LightCountsOut = { shadow: 0, nonShadow: 0 };
  private effectsFlags: EffectsFlags;
  private passes: PassSwitches = ALL_PASSES_ON;
  private requestedPr: number;
  private cssW = 1;
  private cssH = 1;
  private scale = 1;
  private harvest: HarvestLevel = 0;
  private renderClockS = 0;
  private zone: ZoneHandle | null = null;
  private externalRoot: Group | null = null;
  private loading = false;
  private lastFrameId = -1;
  private disposed = false;

  constructor(
    gpu: WebGPURenderer,
    readonly backend: Backend,
    readonly caps: RenderCaps,
    readonly ktx2: KTX2Loader,
    o: RendererOptions,
    subsystems: RendererSubsystems,
  ) {
    this.renderer = gpu;
    this.effectsFlags = o.effects ?? ALL_EFFECTS;
    this.requestedPr = o.pixelRatio;
    this.clock = o.clock ?? null;
    this.onCompileProgress = o.onCompileProgress ?? null;

    // 6.
    const cssW = o.canvas.clientWidth || o.canvas.width || 1;
    const cssH = o.canvas.clientHeight || o.canvas.height || 1;
    this.camera3 = new PerspectiveCamera(CAMERA_PARAMS.fovV, cssW / cssH, CAMERA_PARAMS.near, CAMERA_PARAMS.far);
    for (const l of CAMERA_LAYERS) this.camera3.layers.enable(l);
    this.scene.name = 'ewa:scene';

    // Library (needs the KTX2 loader from step 5; its maps are resolved before step 8).
    this.materials = createMaterialLibrary(gpu, ktx2, o.materialsUrl ?? '/materials/');

    // 7. lighting rig, sky + PMREM, fog node, post graph, HUD, stage, actors — all before resolve.
    this.lighting = new LightRig(this.scene);
    this.sky = new SkyController(gpu, this.scene);
    this.fog = createHeightFog();
    this.scene.fogNode = this.fog.node;
    this.day = new DayCycle({ rig: this.lighting, sky: this.sky, fog: this.fog, shared: this.materials.uniforms });
    this.precipitation = new PrecipitationSheet(this.materials.uniforms);
    this.scene.add(this.precipitation.object);
    this.post = new PostStack(gpu, this.scene, this.camera3, backend, this.effectsFlags, this.passes);
    const trackTs = caps.timestampQuery && o.trackTimestamp === true;
    this.passTimer = trackTs ? new PassTimer((rt) => this.classifyRender(rt)) : null;
    if (this.passTimer !== null) gpu.inspector = this.passTimer;
    this.timestamps = new TimestampResolver(gpu, trackTs, this.statsRecord, this.passTimer !== null ? () => this.collectPassMs() : undefined);

    this.camera = subsystems.camera(this);
    const hud = subsystems.hud(this);
    this.hud = hud.layer;
    this.hudOverlay = hud.overlay;
    this.stage = subsystems.stage(this);
    this.actors = subsystems.actors(this);
    this.zones = subsystems.zones(this);
    this.hooks = subsystems.hooks(this);
    this.warmObjects.push(...subsystems.warmup(this));

    this.resize(cssW, cssH);
  }

  /** §10.1.2 step 8: one frame through the real pipeline with every library material on screen. */
  async warmUp(): Promise<void> {
    await this.materials.ready;
    const geo = createWarmupGeometry();
    const group = new Group();
    group.name = 'ewa:warmup';
    const mats = this.materials.warmup();
    const cols = Math.ceil(Math.sqrt(mats.length));
    mats.forEach((m, i) => {
      const mesh = new Mesh(geo, m);
      const id = SURFACE_IDS[i]!;
      mesh.castShadow = SURFACES[id].castShadow;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.position.set((i % cols) * 0.6 - cols * 0.3, 0.3, Math.floor(i / cols) * 0.6 - cols * 0.3);
      mesh.rotation.x = -Math.PI / 2;
      group.add(mesh);
    });
    for (const o of this.warmObjects) { o.frustumCulled = false; group.add(o); }
    // H4: the scene-pass programs compile off the main thread first; the frame below then only builds the post
    // chain's quads and the shadow-pass variants synchronously. The day cycle runs once before, so the PMREM
    // environment (part of every lit program's source) exists when the programs are built.
    // One frame without the warm group first: it builds the post chain and records the scene pass's render depth
    // (H4 point 3). Then the day cycle has baked the PMREM environment, which is part of every lit program's source.
    this.frame(0);
    await this.precompile('boot', null, [group]);
    this.scene.add(group);
    const rainWasVisible = this.precipitation.object.visible;
    this.precipitation.object.visible = true;
    this.frame(0);
    this.precipitation.object.visible = rainWasVisible;
    this.scene.remove(group);
    // The warm meshes are kept (never `dispose`d): their render objects keep the compiled programs alive.
    this.warmObjects.push(...group.children);
    this.warmGroup = group;
    geo.dispose();
    this.captureBaseline();
  }

  /**
   * H4 (IMPLEMENTATION-NOTES Part 4): compiles every program the renderable children of `containers` need in the
   * scene pass — with the scene's light set — through `gpu.compileAsync` (`createRenderPipelineAsync`, a yield per
   * object), as `COMPILE_CONCURRENCY` concurrent calls so the driver compiles several pipelines at once. What three
   * 0.186 requires for the result to be the programs the real frame uses (each point measured in the browser):
   * 1. Light set: every call sees the scene's lights through `targetScene` and its own subtree's through projection,
   *    so the containers' renderable children are moved into detached groups while the containers keep their lights
   *    (the zone root stays attached, holding only its lights, so a frame rendered meanwhile draws no zone geometry
   *    and compiles nothing synchronously); `LightsNode` sorts lights by id, so list order is irrelevant.
   * 2. Target + MRT: `compileAsync` captures the render context in its synchronous prologue, but every node build
   *    runs later in its async loop and reads `renderer.getRenderTarget()` / `getMRT()` again
   *    (`NodeMaterial.setupOutput`, `NodeBuilder.needsPreviousData`); restored early, each fragment stage had one
   *    output against a 4-attachment context and every async pipeline failed validation. So the scene pass's target
   *    + MRT stay set for the whole compile and `frame()` swaps the canvas state in and out (`compileHold`).
   * 3. Render context: `RenderObject.getMaterialCacheKey()` includes `renderContext.id`, and `RenderContexts.get` keys
   *    contexts by call depth; the scene pass renders nested in whichever display node's quad first reads its
   *    textures (depth 2 with the full graph: the DOF CoC quad), `compileAsync` asks for depth 0 — every node build
   *    was redone on the CPU by the first frame (8.6–11 s, profiled). The prologue asks for the depth the scene pass
   *    last rendered at (`PostStack.sceneCallDepth`, measured from its own `updateBefore`).
   * 4. TRAA sets `velocity.setProjectionMatrix(unjittered)` only during its render, and `VelocityNode.setup` emits
   *    `uniform(projectionMatrix)` instead of `cameraProjectionMatrix` when one is set: compiled without it every lit
   *    program was the wrong variant (29 compiled, 26 rebuilt by the first frame). While compiling, the velocity node
   *    carries a projection whenever TRAA is in the graph, re-applied after every frame that runs meanwhile.
   * For the prologue every object is also made visible and un-culled (LOD levels, far scatter tiers, out-of-view
   * props compile too). Not covered (built by the first real render): shadow-pass variants (`ShadowNode.updateBefore`
   * returns while pre-compiling) and the post chain's own quads.
   */
  private async precompile(phase: 'boot' | 'zone', zone: string | null, containers: readonly Object3D[]): Promise<void> {
    type Compile = (scene: Object3D, camera: Camera, targetScene?: Scene | null, onProgress?: ((e: { loaded: number; total: number }) => void) | null) => Promise<void>;
    const gpu = this.renderer as WebGPURenderer & { compileAsync?: Compile; _renderContexts?: { get(rt: RenderTarget | null, mrt: unknown, depth?: number): unknown } };
    if (typeof gpu.compileAsync !== 'function') return;
    const pass = this.post.nodes.scenePass as unknown as { renderTarget: RenderTarget; getMRT(): unknown };
    const t0 = this.clock !== null ? this.clock() : null;

    // 1. renderable children → detached groups (containers keep their lights)
    const groups: Group[] = [];
    for (let k = 0; k < COMPILE_CONCURRENCY; k++) groups.push(new Group());
    const originals = containers.map((c) => c.children.slice());
    let n = 0;
    const renderable = (o: Object3D): boolean => (o as Object3D & { isLight?: boolean }).isLight !== true && !(o.type === 'Object3D' && o.children.length === 0);   // lights and spot targets stay
    for (const kids of originals) for (const o of kids) if (renderable(o)) groups[n++ % groups.length]!.add(o);
    const jobsGroups = groups.filter((g) => g.children.length > 0);
    const touched: Object3D[] = []; const state: number[] = [];
    for (const g of jobsGroups) g.traverse((o) => { touched.push(o); state.push((o.visible ? 1 : 0) | (o.frustumCulled ? 2 : 0)); o.visible = true; o.frustumCulled = false; });

    const loaded = new Array<number>(jobsGroups.length).fill(0);
    const totals = new Array<number>(jobsGroups.length).fill(0);
    const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);
    const report = (done: boolean): void => {
      const ms = t0 !== null && this.clock !== null ? this.clock() - t0 : null;
      if (done) this.compileStats[phase] = { objects: sum(totals), ms, groups: jobsGroups.length };
      this.onCompileProgress?.({ phase, zone, loaded: sum(loaded), total: sum(totals), done, ms });
    };

    const traa = this.post.plan.some((st) => st.id === 'traa');
    const hold = { target: gpu.getRenderTarget(), mrt: gpu.getMRT(), velocityProjection: traa ? this.compileProjection.copy(this.camera3.projectionMatrix) : null };
    const vel = velocity as unknown as { setProjectionMatrix(m: Matrix4 | null): void };
    const contexts = gpu._renderContexts;
    const getContext = contexts?.get;
    const jobs: Promise<void>[] = [];
    try {
      gpu.setRenderTarget(pass.renderTarget);
      gpu.setMRT(pass.getMRT() as Parameters<WebGPURenderer['setMRT']>[0]);
      vel.setProjectionMatrix(hold.velocityProjection);                                          // 4.
      const depth = this.post.sceneCallDepth ?? SCENE_PASS_CALL_DEPTH;
      if (contexts && getContext) contexts.get = (rt, mrt, d) => getContext.call(contexts, rt, mrt, d ?? depth);   // 3.
      this.compileHold = hold;                                                                   // 2.
      jobsGroups.forEach((g, i) => {
        jobs.push(gpu.compileAsync!(g, this.camera3, this.scene, (e) => { loaded[i] = e.loaded; totals[i] = e.total; report(false); }));
      });
    } finally {
      if (contexts && getContext) contexts.get = getContext;
      touched.forEach((o, i) => { o.visible = (state[i]! & 1) !== 0; o.frustumCulled = (state[i]! & 2) !== 0; });
    }
    try {
      await Promise.all(jobs);
    } finally {
      this.compileHold = null;
      vel.setProjectionMatrix(null);
      gpu.setRenderTarget(hold.target);
      gpu.setMRT(hold.mrt);
      // children back into their containers, in their original order
      for (const g of groups) g.remove(...g.children);
      containers.forEach((c, i) => { c.remove(...c.children); c.add(...originals[i]!); });
    }
    report(true);
  }

  private captureBaseline(): void {
    this.refreshSceneCounts();
    this.baseline = readBudgetCounts(this.renderer.info, this.statsRecord.materials, this.lightCounts.shadow, this.lightCounts.nonShadow, this.materials.residentTextureBytes());
  }

  // ---- HostContext ------------------------------------------------------------------------------------

  get gpu(): WebGPURenderer { return this.renderer; }
  effects(): EffectsFlags { return this.effectsFlags; }
  timeScale(): number { return this.scale; }
  harvestLevel(): HarvestLevel { return this.harvest; }
  zoneRoot(): Group | null { return this.zone?.group ?? this.externalRoot; }

  setZoneRoot(root: Group | null): void {
    this.externalRoot = root;
    this.refreshSceneCounts();
  }

  setLightingPalette(p: LightingPalette): void {
    this.day.setPalette(p);
    this.day.invalidateEnvironment();
  }

  setGrade(g: GradePalette): void { this.post.setGrade(g); }

  refreshSceneCounts(): void {
    const root = this.zoneRoot();
    this.statsRecord.materials = root ? countMaterials(root) : 0;
    countPunctualLights(this.scene, this.lightCounts);
    this.statsRecord.shadowLights = this.lightCounts.shadow;
    this.statsRecord.nonShadowLights = this.lightCounts.nonShadow;
  }

  // ---- Renderer ------------------------------------------------------------------------------------------

  async loadZone(spec: ZoneSpec): Promise<ZoneHandle> {
    if (this.disposed) throw new Error('@ewa/render: loadZone after dispose()');
    if (this.loading || (this.zone !== null && !isDisposedHandle(this.zone))) {
      throw new Error(`@ewa/render: loadZone('${spec.id}') while a zone is loaded and not yet disposed`);
    }
    this.loading = true;
    try {
      const handle = await this.zones.load(spec);
      this.zone = handle;
      // H4: the zone's light set is part of every lit program — compile the zone, then the kept warm-up group
      // (library structures, billboard, character, beacon housing, VFX) against it, before the first zone frame
      await this.precompile('zone', spec.id, this.warmGroup !== null ? [handle.group, this.warmGroup] : [handle.group]);
      for (const h of this.hooks) h.onZone?.(handle);
      this.setHarvestLevel(spec.harvestLevel);
      MaterialBudget.assert(handle.group, 48);
      this.refreshSceneCounts();
      return handle;
    } finally {
      this.loading = false;
    }
  }

  setTimeOfDay(t: number): void { this.day.setTime(t); }

  setWeather(w: WeatherKind): void {
    this.day.setWeather(w);
    this.precipitation.setMode(weatherParams(w).precipitation);
  }

  /** §10.2.6: 4 uniform writes + ≤ 32 light intensity writes; nothing is created or disposed. */
  setHarvestLevel(l: HarvestLevel): void {
    const lv = toHarvestLevel(l);
    this.harvest = lv;
    this.materials.uniforms.harvestLevel.value = lv;
    for (const h of this.hooks) h.setHarvestLevel?.(lv);   // billboards.uniforms.harvestLevel (§10.4.6)
    this.lighting.setPunctualEnabled(lv < 2);
    this.sky.setHarvest(lv);
    this.day.invalidateEnvironment();
  }

  setEffects(f: EffectsFlags): void {
    this.effectsFlags = f;
    this.scale = coerceTimeScale(this.scale, f);
    this.post.rebuild(f, this.passes);
  }

  setPixelRatio(r: number): void {
    this.requestedPr = r;
    this.resize(this.cssW, this.cssH);
  }

  /** §10.1.3: `setPixelRatio(pr); setSize(w, h, false)`; camera aspect, HUD, CSM frustums follow. */
  resize(cssWidth: number, cssHeight: number): void {
    if (this.disposed) return;
    // A hidden / not-yet-laid-out canvas reports 0×0: keep the last valid size instead of a 1×1 buffer.
    if (!(cssWidth >= 1 && cssHeight >= 1)) return;
    this.cssW = Math.floor(cssWidth);
    this.cssH = Math.floor(cssHeight);
    const pr = clampPixelRatio(this.requestedPr, this.cssW);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(this.cssW, this.cssH, false);
    const aspect = this.cssW / this.cssH;
    this.camera.setAspect(aspect);
    this.hud.resize(this.cssW, this.cssH, pr);
    this.lighting.updateFrustums();
    this.post.setPixelRatio(pr);
    this.post.setAspect(aspect);
  }

  get pixelRatio(): number { return this.renderer.getPixelRatio(); }

  setTimeScale(s: number): void {
    this.scale = coerceTimeScale(s, this.effectsFlags);   // §10.8.4
  }

  /** §50.2.3 budget toggles realised outside the graph (opaque / sprites / shadows) or as a rebuild. */
  setPassEnabled(pass: BudgetPass, on: boolean): void {
    this.passes = { ...this.passes, [pass]: on };
    if (pass === 'opaque') { const root = this.zoneRoot(); if (root) root.visible = on; return; }
    if (pass === 'sprites') {
      for (const l of [LAYERS.billboards, LAYERS.decals, LAYERS.fx]) { if (on) this.camera3.layers.enable(l); else this.camera3.layers.disable(l); }
      return;
    }
    if (pass === 'shadows') { this.renderer.shadowMap.enabled = on; return; }
    if (GRAPH_PASSES.includes(pass)) this.post.rebuild(this.effectsFlags, this.passes);
  }

  passSwitches(): PassSwitches { return this.passes; }

  /**
   * §50.2.1 row of a render call by its target: the canvas (final output quad, HUD overlay) is `grade`, the scene
   * pass and the stages' own targets come from the post graph, shadow maps by three's texture names; anything else
   * (PMREM bakes, the IBL probe) is `opaque` — §10.3.3 amortises the bake inside opaque's remainder.
   */
  private classifyRender(rt: RenderTarget | null): BudgetPass | null {
    if (rt === null) return 'grade';
    const p = this.post.passOfTarget(rt);
    if (p !== null) return p;
    const n = rt.texture?.name;
    if (n === 'ShadowMap' || n === 'PointShadowMap' || n === 'VSMVertical' || n === 'VSMHorizontal') return 'shadows';
    return null;
  }

  private collectPassMs(): void {
    if (this.passTimer === null || this.passMsLatched) return;
    const pool = (this.renderer.backend as unknown as { timestampQueryPool?: { render?: TimestampPoolLike | null } }).timestampQueryPool?.render;
    this.passTimer.collect(pool, this.statsRecord.passMs);
  }

  /**
   * Frame-scoped node updates run once per `nodeFrame.frameId`, which three's internal rAF loop advances.
   * When `frame()` runs twice inside one rAF tick, advance it here (and reset the per-frame counters).
   */
  private advanceStaleFrame(): void {
    const gpu = this.renderer as WebGPURenderer & { _nodes?: { nodeFrame?: { frameId: number; update(): void } } };
    const nf = gpu._nodes?.nodeFrame;
    if (!nf) return;
    if (nf.frameId === this.lastFrameId) {
      if (gpu.info.autoReset) gpu.info.reset();
      nf.update();
      (gpu.info as { frame: number }).frame = nf.frameId;
    }
    this.lastFrameId = nf.frameId;
  }

  /** §10.1.2 frame steps (1)–(7). Zero allocation on the steady path. */
  frame(dtMs: number): void {
    if (this.disposed) return;
    const hold = this.compileHold;
    if (hold === null) { this.frameSteps(dtMs); return; }
    // a pre-compile is running with the scene pass's target + MRT set on the renderer (H4): render this frame with
    // the state it had before, then put the compile's back (the frame is synchronous, the compile never sees it)
    const gpu = this.renderer;
    const target = gpu.getRenderTarget(); const mrt = gpu.getMRT();
    gpu.setRenderTarget(hold.target); gpu.setMRT(hold.mrt);
    try { this.frameSteps(dtMs); } finally {
      gpu.setRenderTarget(target); gpu.setMRT(mrt);
      (velocity as unknown as { setProjectionMatrix(m: Matrix4 | null): void }).setProjectionMatrix(hold.velocityProjection);   // TRAA reset it
    }
  }

  private frameSteps(dtMs: number): void {
    const t0 = this.clock !== null ? this.clock() : 0;
    this.advanceStaleFrame();
    const dt = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0;
    const scaled = dt * this.scale;

    // (1) camera
    this.camera.update(scaled);
    const focus = (this.camera.focus as Vector3) ?? _focusFallback;
    // (2) day cycle: uniforms only (+ PMREM re-bake when due)
    this.materials.uniforms.windTime.value += scaled / 1000;
    this.renderClockS += scaled / 1000;
    this.day.update(dt, scaled / 1000, focus);
    this.lighting.update(this.renderClockS);
    this.sky.follow(this.camera3.position);
    this.precipitation.follow(focus);
    // (3) billboards and other subsystem hooks (uniform writes only)
    for (const h of this.hooks) h.update?.(scaled, dt);
    this.post.setFocus(focus);
    this.post.setDaylight(daylight(this.day.sample));
    // (4) the one pipeline render
    this.post.render();
    // (5) HUD
    this.hud.drawIfDirty();
    if (this.hudOverlay !== null) {
      // Working-space output (as RenderPipeline.render does): with sRGB output three 0.186 routes a plain render through
      // the intermediate framebuffer target, whose output pass would overwrite the post image (IMPLEMENTATION-NOTES P3).
      const cs = this.renderer.outputColorSpace;
      this.renderer.outputColorSpace = ColorManagement.workingColorSpace;
      this.renderer.autoClear = false;
      this.renderer.render(this.hudOverlay.scene, this.hudOverlay.camera);
      this.renderer.autoClear = true;
      this.renderer.outputColorSpace = cs;
    }
    // (6) stats
    copyInfo(this.renderer.info, this.statsRecord, this.materials.residentTextureBytes());
    // (7) GPU timestamps
    this.timestamps.poll();
    this.statsRecord.frameMs = this.clock !== null ? this.clock() - t0 : 0;
  }

  stats(): RenderStats { return this.statsRecord; }

  counts(): BudgetCounts {
    return readBudgetCounts(this.renderer.info, this.statsRecord.materials, this.statsRecord.shadowLights, this.statsRecord.nonShadowLights, this.materials.residentTextureBytes());
  }

  gpuFrameMs(): Promise<number | undefined> { return this.timestamps.resolveNow(); }

  /** §10.1.5 dispose order. Idempotent. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.hud.dispose();
    this.stage.dispose();
    this.actors.dispose();
    if (this.zone !== null) this.zone.dispose();
    this.zone = null;
    for (const h of this.hooks) h.dispose?.();
    this.post.dispose();
    this.day.dispose();              // PMREM generator + its target, sky meshes
    this.precipitation.dispose();
    this.lighting.dispose();
    this.materials.disposeAll();
    this.ktx2.dispose();
    void this.renderer.dispose();
  }

  // ---- zone view / probe support ----------------------------------------------------------------------------

  dump(zoneId: string): ZoneDump {
    const root = this.zoneRoot() ?? new Group();
    const culled = (this.zones as ZoneLoader & { culledChunks?: () => number }).culledChunks?.() ?? 0;
    return dumpZone({ zone: zoneId, harvestLevel: this.harvest, root, library: this.materials, counts: this.counts(), culledChunks: culled });
  }
}

function isDisposedHandle(h: ZoneHandle): boolean {
  return (h as ZoneHandle & { disposed?: boolean }).disposed === true || h.group.parent === null;
}

// ---- §10.10.1 BudgetProbe / createZoneView -------------------------------------------------------------------

/** 50-verification-budget.md §50.2.3, verbatim (the harness codes against nothing else). */
export interface BudgetProbe {
  /** Disables one pass in the pipeline graph. The frame still renders (the pass's input is passed through). */
  setPassEnabled(pass: BudgetPass, on: boolean): void;
  /** Counts for the frame that most recently completed. */
  counts(): BudgetCounts;
  /**
   * Whole-frame GPU time in ms for the last resolved frame:
   * `await renderer.resolveTimestampsAsync(TimestampQuery.RENDER)`; undefined when the adapter lacks 'timestamp-query'.
   */
  gpuFrameMs(): Promise<number | undefined>;
  /** CPU time of the last fixed step in ms, measured by the client around its tick and pushed here. */
  simMs(): number;
  /** JSON dump of the zone graph for tools/asset-audit: materials, geometries (class + parameters), lights, sprite textures. */
  dumpZone(): ZoneDump;
}

/** SPEC §10.10.1, verbatim. */
export interface CameraShot { readonly id: string; readonly heading: 0 | 1 | 2 | 3; readonly zoomStop: 0 | 1 | 2; readonly focus: readonly [number, number]; readonly timeOfDay: number; readonly battle: boolean }
export interface ZoneViewOptions extends RendererOptions { readonly zone: ZoneSpec; readonly shots: readonly CameraShot[] }
export interface ZoneView extends BudgetProbe { readonly renderer: Renderer; setShot(s: CameraShot): void; frame(dtMs: number): void; setSimMs(ms: number): void; dispose(): void }

/** Options of the differential per-pass measurement (§50.2.3). */
export interface PassMeasureOptions { readonly frames: number; readonly warmup: number; readonly dtMs?: number }

/** A `BudgetProbe` bound to a renderer, plus `setShot`/`frame`/`measurePassMs` (additions, documented). */
export interface RendererProbe extends ZoneView {
  /** Runs the §50.2.3 differential procedure, fills `RenderStats.passMs` and returns it with the totals. */
  measurePassMs(o: PassMeasureOptions): Promise<{ readonly passMs: RenderStats['passMs']; readonly totalMs: { readonly median: number; readonly p95: number } } | undefined>;
}

/**
 * Wraps an existing renderer in the probe (the sandbox uses it without a zone; `createZoneView` with one).
 * `zoneId` is what `dumpZone()` reports.
 */
export function createBudgetProbe(r: Renderer, zoneId: string, ownsRenderer = false): RendererProbe {
  const host = INTERNALS.get(r);
  if (!host) throw new Error('@ewa/render: createBudgetProbe needs a renderer from createRenderer');
  let sim = 0;
  const probe: RendererProbe = {
    renderer: r,
    setPassEnabled: (p, on) => host.setPassEnabled(p, on),
    counts: () => host.counts(),
    gpuFrameMs: () => host.gpuFrameMs(),
    simMs: () => sim,
    setSimMs: (ms) => { sim = ms; },
    dumpZone: () => host.dump(zoneId),
    frame: (dt) => host.frame(dt),
    setShot: (s) => {
      host.camera.setHeading(s.heading);
      host.camera.setZoomStop(s.zoomStop);
      const rig = host.camera as CameraRig & { setFocus?: (x: number, y: number, z: number) => void };
      if (s.battle) rig.pushIn({ x: s.focus[0], z: s.focus[1] }, 0);
      else { rig.release(0); rig.setFocus?.(s.focus[0], 0, s.focus[1]); }
      host.setTimeOfDay(s.timeOfDay);
      host.lighting.updateFrustums();
    },
    dispose: () => { if (ownsRenderer) r.dispose(); },
    async measurePassMs(o) {
      if (!host.caps.timestampQuery) return undefined;
      const dt = o.dtMs ?? 1000 / 60;
      const run = async (): Promise<number[]> => {
        for (let i = 0; i < o.warmup; i++) { host.frame(dt); await host.gpuFrameMs(); }
        const xs: number[] = [];
        for (let i = 0; i < o.frames; i++) { host.frame(dt); const ms = await host.gpuFrameMs(); if (ms !== undefined) xs.push(ms); }
        return xs;
      };
      const all = await run();
      const tAll = median(all);
      const without: Partial<Record<BudgetPass, number>> = {};
      for (const p of ['sprites', 'shadows', 'gtao', 'traa', 'bloom', 'dof', 'grade'] as const) {
        host.setPassEnabled(p, false);
        without[p] = median(await run());
        host.setPassEnabled(p, true);
      }
      const passMs = computePassMs(tAll, without, sim);
      host.passMsLatched = true;
      for (const k of Object.keys(passMs) as BudgetPass[]) host.statsRecord.passMs[k] = passMs[k];
      const sorted = [...all].sort((a, b) => a - b);
      const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? Number.NaN;
      return { passMs, totalMs: { median: tAll, p95 } };
    },
  };
  return probe;
}

/** SPEC §10.10.1: `createRenderer + loadZone + scripted rig; no network, no client store`. */
export async function createZoneView(o: ZoneViewOptions): Promise<ZoneView> {
  const r = await createRenderer(o);
  try {
    await r.loadZone(o.zone);
  } catch (e) {
    r.dispose();
    throw e;
  }
  const probe = createBudgetProbe(r, o.zone.id, true);
  const first = o.shots[0];
  if (first) probe.setShot(first);
  return probe;
}

export { GROVE_GRADE, GROVE_LIGHTING };
