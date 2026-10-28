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
import { DEFAULT_ZOOM_STOP, DISTANCE, PITCH } from './camera/rig.js';
import { orbitPosition, type OrbitPose } from './camera/battle.js';
import { hasRenderable, orderUnits, planZoneCompile, type ViewGuess } from './compilePlan.js';
import { isDevBuild } from './env.js';
import { occlusionStrength, setOcclusion } from './materials/occlusion.js';
import type { BufferGeometry, Camera, Object3D, RenderTarget } from 'three/webgpu';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import type {
  ActorPool, BattleStage, CameraRig, HudLayer, ZoneHandle, ZoneSpec,
} from './contracts.js';
import type { ZoneLoader } from './defaults.js';
import { zoneSystemFor, type PreparedZone } from './zone/system.js';
import { createSliceStats, STEPS_CANCELLED, type SliceStats } from './steps.js';
import { isZoneMesh } from './zone/builder.js';
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
import { LightRig, createLightingLayout } from './lighting/rig.js';
import { SkyController } from './lighting/sky.js';
import { PrecipitationSheet, weatherParams } from './lighting/weather.js';
import { coerceTimeScale } from './post/effects.js';
import { GROVE_GRADE, type GradePalette } from './post/grade.js';
import { ALL_PASSES_ON, GRAPH_PASSES, PostStack, type PassSwitches } from './post/pipeline.js';
import { QUALITY_PROFILES, recommendedQuality, type GraphicsQuality } from './quality.js';
import { DETAIL_DISTANCE_M, setDetailFocus, setDetailRadius, setLodScale, type DetailDistance } from './zone/detail.js';
import { setWaterBackdrop } from './materials/waterBackdrop.js';
import type { NpcModels } from './stage/npcModels.js';
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
  /** Quality preset (`quality.ts`); `'auto'` picks `recommendedQuality(caps)`. Default `'high'` (the SPEC numbers). */
  readonly quality?: GraphicsQuality | 'auto';
  /** Where `models.manifest.json`, the character GLBs and the look atlas are served (§10.7.7; IMPLEMENTATION-NOTES Part 6). Default `'/models/'`; null = no character bodies (decals and nameplates only). */
  readonly modelsUrl?: string | null;
  /** Where the 3D creature bodies (`index.json` + `<sprite id>.glb`, IMPLEMENTATION-NOTES "3D creatures") are served. Default `'/creature-models/'`; null = cards only. */
  readonly creatureModelsUrl?: string | null;
  /** Where the rigged NPC set pieces (`index.json` + `<id>.rig.glb`, IMPLEMENTATION-NOTES "NPC models") are served. Default `'/npc-models/'`; null = none. */
  readonly npcModelsUrl?: string | null;
  /** Millisecond clock for `RenderStats.frameMs`; render never reads a wall clock itself (§10 NN 10). Default: none (frameMs = 0). */
  readonly clock?: () => number;
  /**
   * Shader pre-compilation progress (IMPLEMENTATION-NOTES Part 4 H4, Part 5 T4): `createRenderer` step 8 (`phase
   * 'boot'`), every `loadZone`'s blocking phase 1 (`'zone'`: what the first view draws) and its background phase 2
   * (`'background'`: the rest, after `loadZone` resolved). `loaded` / `total` count compile units (`compileAsync`
   * roots: one zone root child or LOD level, one warm-up object). For the client's BootScreen and handover indicator.
   */
  readonly onCompileProgress?: (p: CompileProgress) => void;
  /** Default true. False skips the H4 pre-compile (first frames compile synchronously): A/B measurements only. */
  readonly precompile?: boolean;
  /**
   * T4: true → `loadZone` resolves after phase 1 and phase 2 runs in the background; false → `loadZone` resolves only
   * when every program of the zone is compiled (the Part 4 behaviour, for deterministic captures). Default: true, and
   * false when `trackTimestamp` is set (the budget / shot harness measures fully compiled zones).
   */
  readonly backgroundCompile?: boolean;
  /**
   * Phase E6: the WebGPU device was lost (driver reset, GPU process crash, TDR). Called once; from then on `frame()`
   * renders nothing and `deviceLost` holds the info. The renderer cannot be revived: the owner disposes it and creates
   * a new one (client: World3D re-runs the renderer boot and reloads the current zone). Never called for the device
   * `dispose()` destroys itself, nor on the WebGL2 fallback.
   */
  readonly onDeviceLost?: (info: DeviceLostInfo) => void;
  /**
   * Load time (addition 2026-10-25): called once the host exists, right before step 8's warm-up compile. That compile
   * waits on the GPU process for seconds with the main thread idle; an owner that knows the zone it will enter can start
   * `prepareZone` here so the zone's texture fetch and build run meanwhile (`loadZone` adopts it; a wrong guess is
   * dropped there). A throw is logged (dev builds) and swallowed: the boot goes on.
   */
  readonly beforeWarmUp?: (r: Renderer) => void;
}

/** Phase E6: what `GPUDevice.lost` resolved with (`GPUDeviceLostInfo.reason` / `.message`). */
export interface DeviceLostInfo { readonly reason: string | null; readonly message: string }

/** The part of a `GPUDevice` `watchDeviceLost` reads. */
export interface DeviceLostSource { readonly lost?: PromiseLike<{ readonly reason?: string | null; readonly message?: string } | null | undefined> }

/**
 * Phase E6: subscribes `onLost` to `device.lost`. A loss with reason `'destroyed'` (our own `dispose()` →
 * `device.destroy()`) or one that resolves after `isDisposed()` turned true is ignored. Returns false when the device
 * has no `lost` promise (WebGL2 backend, no device). Pure: tested with a fake device.
 */
export function watchDeviceLost(device: DeviceLostSource | null | undefined, onLost: (info: DeviceLostInfo) => void, isDisposed: () => boolean): boolean {
  const lost = device?.lost;
  if (lost === undefined || lost === null || typeof lost.then !== 'function') return false;
  lost.then((info) => {
    if (isDisposed() || info?.reason === 'destroyed') return;
    onLost({ reason: info?.reason ?? null, message: info?.message !== undefined && info.message !== '' ? info.message : 'GPU device lost' });
  }, () => undefined);
  return true;
}

/**
 * The WebGL2 fallback's lost context: three's WebGLBackend calls `renderer.onDeviceLost` from its `webglcontextlost`
 * listener (it also calls `preventDefault`, so the browser restores the context later). Wraps that hook; a loss after
 * `isDisposed()` turned true (three's `dispose` calls `loseContext()`) is ignored.
 */
export function watchContextLost(gpu: { onDeviceLost: (info: { message?: string }) => void }, onLost: (info: DeviceLostInfo) => void, isDisposed: () => boolean): void {
  const prev = gpu.onDeviceLost.bind(gpu);
  gpu.onDeviceLost = (info) => {
    prev(info);
    if (isDisposed()) return;
    onLost({ reason: 'context-lost', message: info?.message !== undefined && info.message !== '' ? info.message : 'WebGL context lost' });
  };
}

/** One `onCompileProgress` report. `done` is true on the last report of a phase (with its wall time when a clock is set). */
export interface CompileProgress {
  readonly phase: 'boot' | 'zone' | 'background';
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
  /** Rigged NPC set pieces (`stage/npcModels.ts`, addition 2026-10-28); absent on fakes. */
  readonly npcModels?: NpcModels;
  readonly materials: MaterialLibrary;         // §10.2 (read-only use by the client: stats, prewarm)
  loadZone(spec: ZoneSpec, opts?: LoadZoneOptions): Promise<ZoneHandle>;   // rejects if a zone is loaded and not yet disposed
  /** T4 addition: resolves when the loaded zone's background compile finished (or its zone was disposed). */
  compileIdle?(): Promise<void>;
  /**
   * E3 addition (handover): call right before disposing the current zone for `next` — the dispose keeps `next`'s texture
   * sets resident (shared surfaces are not fetched / transcoded again), then `loadZone(next)` as usual.
   */
  prepareHandover?(next: ZoneSpec): void;
  /**
   * Handover addition (SPEC §10.1.2 "Handover keep" as amended 2026-10-06): builds `next` off the scene while the
   * current zone stays up and compiles it in the background (valid because the fixed light layout makes a compile
   * now key-identical to `next`'s own frames). The next `loadZone` of the same zone (id, seed, harvest level) adopts it:
   * no build, and only what is still uncompiled is compiled. Resolves when it is fully compiled (or dropped); a prepare
   * of another zone, a `loadZone` of another zone or `dropPrepared()` drops it. One prepared zone at a time.
   */
  prepareZone?(next: ZoneSpec, opts?: LoadZoneOptions): Promise<void>;
  /** Drops the prepared zone, if any (its geometry, instance buffers and render objects are released). */
  dropPrepared?(): void;
  /** E6 addition: the lost-device info once `GPUDevice.lost` resolved (then `frame()` renders nothing); null while alive. */
  readonly deviceLost?: DeviceLostInfo | null;
  setTimeOfDay(t: number): void;               // 0..1; §10.3.5
  setWeather(w: WeatherKind): void;            // §10.3.7
  /** Honor shapes the world: the zone's shadow level 0..4 (lighting/weather.ts `shadowParams`). Optional for fakes. */
  setShadow?(level: number): void;
  /** Majin vs Tenjin seasons: the winning side's sky (lighting/weather.ts `skyMoodParams`); null clears it. Optional for fakes. */
  setSkyMood?(mood: 'majin' | 'tenjin' | null): void;
  /** World effects (§10.7.8): false stills the air (the ambient motes) indoors. Optional for fakes. */
  setAmbient?(on: boolean): void;
  setHarvestLevel(l: HarvestLevel): void;      // §10.2.6
  setEffects(f: EffectsFlags): void;           // rebuilds the post graph; §10.8.4
  setPixelRatio(r: number): void;              // re-clamped by §10.1.3
  /**
   * Render scale addition (performance 2026-10-27): a factor (0.25..1) on the pixel ratio AFTER §10.1.3's clamp, so it
   * also shrinks the buffer where the quality preset's cap already holds the ratio (a 1.25 DPR display on `low`).
   * The client's render scale × its dynamic resolution. Optional for fakes.
   */
  setResolutionScale?(s: number): void;
  /** Quality preset addition (`quality.ts`): pixel-ratio cap, sun cascade size, GTAO / DOF, the water backdrop. Optional for fakes. */
  setQuality?(q: GraphicsQuality | 'auto'): void;
  /** The preset in effect (`'auto'` resolved). Optional for fakes. */
  readonly quality?: GraphicsQuality;
  /** Detail distance addition (`zone/detail.ts`): grass tufts, flowers, pebbles and ambient motes within 4 / 8 / 16 m of the player, or all. Optional for fakes. */
  setDetailDistance?(d: DetailDistance): void;
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

/** `pr = min(requested, cap, 3840 / cssWidth)` (cap 1.5, lower on the quality presets); invalid inputs fall back to 1 / no width cap. */
export function clampPixelRatio(requested: number, cssWidth: number, cap: number = PIXEL_RATIO_CAP): number {
  const r = Number.isFinite(requested) && requested > 0 ? requested : 1;
  const w = Number.isFinite(cssWidth) && cssWidth > 0 ? MAX_DRAWING_WIDTH / cssWidth : Number.POSITIVE_INFINITY;
  return Math.min(r, cap, w);
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

/** A host without NPC set pieces (custom subsystems): placing them is a no-op. */
const NO_NPC_MODELS: NpcModels = { set: () => undefined, play: () => false, clips: () => [] };

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
  /** `RendererOptions.modelsUrl` (null = no character bodies). */
  readonly modelsUrl: string | null;
  /** `RendererOptions.creatureModelsUrl` (null = creature cards only). */
  readonly creatureModelsUrl: string | null;
  /** `RendererOptions.npcModelsUrl` (null = no NPC set pieces). */
  readonly npcModelsUrl: string | null;
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
  /** World effects (§10.7.8): the overworld weather, honor shadow, sky mood and ambient switch, as the host got them. */
  setWeather?(w: WeatherKind): void;
  setShadow?(level: number): void;
  setSkyMood?(mood: 'majin' | 'tenjin' | null): void;
  setAmbient?(on: boolean): void;
  /** Called after `loadZone` resolves (part 3: the stage/actors sample the zone's collider for ground heights). */
  onZone?(zone: ZoneHandle | null): void;
  /**
   * Bytes `renderer.info.memory.texturesSize` counts twice for this subsystem's textures (part 3: the sprite atlases'
   * level 0, `BillboardPool.infoOvercountBytes`); subtracted from the §50.2.2 texture metric like the KTX2 correction.
   */
  textureOvercountBytes?(): number;
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
  /** Rigged NPC set pieces (addition 2026-10-28); optional (absent = none). */
  npcModels?(ctx: HostContext): NpcModels;
  zones(ctx: HostContext): ZoneLoader;
  hooks(ctx: HostContext): readonly FrameHook[];
  /** Extra objects rendered in the step-8 warm-up frame (e.g. one billboard). */
  warmup(ctx: HostContext): readonly Object3D[];
  /**
   * T4: objects that live in the scene, hidden until used (the battle arena), compiled at boot and in every zone's
   * background phase so their first appearance compiles nothing. Optional.
   */
  persistent?(ctx: HostContext): readonly Object3D[];
}

/** The replacement point for §10.4–§10.9 (see defaults.ts). */
export const DEFAULT_SUBSYSTEMS: RendererSubsystems = {
  // part 3 (§10.4 sprites, §10.7 camera/stage/actors, §10.9 HUD) — lazy references: stage/wiring.ts imports this module
  camera: (ctx) => PART3_SUBSYSTEMS.camera(ctx),
  stage: (ctx) => PART3_SUBSYSTEMS.stage(ctx),
  hud: (ctx) => PART3_SUBSYSTEMS.hud(ctx),
  actors: (ctx) => PART3_SUBSYSTEMS.actors(ctx),
  npcModels: (ctx) => PART3_SUBSYSTEMS.npcModels(ctx),
  zones: (ctx) => zoneSystemFor(ctx),
  hooks: (ctx) => [zoneSystemFor(ctx), ...PART3_SUBSYSTEMS.hooks(ctx)],
  warmup: (ctx) => PART3_SUBSYSTEMS.warmup(ctx),
  persistent: (ctx) => PART3_SUBSYSTEMS.persistent(ctx),
};

const INTERNALS = new WeakMap<Renderer, RendererHost>();

/** Host internals for subsystems, the sandbox and the harness. `undefined` for foreign objects. */
export function rendererInternals(r: Renderer): HostContext | undefined {
  return INTERNALS.get(r);
}

// ---- construction --------------------------------------------------------------------------------------------

interface WebGPUDeviceLike { readonly limits?: { readonly maxTextureDimension2D?: number }; readonly adapterInfo?: { readonly description?: string; readonly vendor?: string; readonly architecture?: string } }
interface BackendLike { readonly isWebGPUBackend?: boolean; readonly device?: WebGPUDeviceLike; readonly gl?: { getParameter(p: number): unknown; readonly MAX_TEXTURE_SIZE: number; readonly RENDERER: number } }

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
  // Chrome / Edge expose the (sanitised) ANGLE renderer string here, e.g. "ANGLE (Intel, Intel(R) UHD Graphics 620 …)"
  const name = gl ? gl.getParameter(gl.RENDERER) : null;
  return { maxTextureSize: Number.isFinite(max) ? max : 0, adapter: typeof name === 'string' && name.length > 0 ? name : null };
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
  gpu.lighting = createLightingLayout();   // the fixed light layout (§10.3.2 as amended 2026-10-06: handover)
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
  // E6: a lost device stops the frames and tells the owner (subscribed before the warm-up, which can take seconds)
  if (backend === 'webgpu') watchDeviceLost((gpu.backend as unknown as BackendLike).device as DeviceLostSource | undefined, (info) => host.handleDeviceLost(info), () => host.isDisposed);
  // … and on the WebGL2 fallback a lost context (`webglcontextlost`, which three's WebGLBackend turns into
  // `onDeviceLost`; its own handler still logs). Our own `dispose()` loses the context on purpose, after `isDisposed`.
  else watchContextLost(gpu as unknown as Parameters<typeof watchContextLost>[0], (info) => host.handleDeviceLost(info), () => host.isDisposed);
  // 8. (the owner may start a zone's prepare first: it builds while the warm-up compiles)
  try { o.beforeWarmUp?.(host); } catch (e) { if (isDevBuild()) console.error('@ewa/render: beforeWarmUp threw', e); }
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

/** Concurrent `compileAsync` calls of a blocking pre-compile (boot, a zone's phase 1; H4): several pipelines in flight. */
export const COMPILE_CONCURRENCY = 4;
/**
 * Concurrent calls of a zone's background phase (T4): one — the driver compiles on the GPU process's threads, so the
 * frames keep theirs; the main thread only builds one unit's nodes at a time, in `yieldToMain` slices.
 */
export const BACKGROUND_CONCURRENCY = 1;
/** Fallback render call depth of the scene pass when none was measured yet (`PostStack.sceneCallDepth`). */
const SCENE_PASS_CALL_DEPTH = 2;

/** One pre-compile: render objects compiled, wall ms, workers, compile units (`compileAsync` roots). */
interface CompileStat { readonly objects: number; readonly ms: number | null; readonly groups: number; readonly units: number }

/** One compile run: the boot, or one zone's phases 1 + 2 (cancelled when that zone is disposed; T4). */
interface CompileRun { cancelled: boolean; /** a prepared zone's run once its zone is adopted: no background slots */ urgent?: boolean }

/** What `ZoneSystem.prepare` takes from the renderer (Handover II: the sliced build's controls). */
interface PrepareOptions { readonly eager?: boolean; readonly cancelled?: () => boolean; readonly urgent?: () => boolean; readonly stats?: SliceStats }

/** A zone being prepared off-scene (handover (b)): its build, its compile run and when that run ends. */
interface PreparedRecord { readonly spec: ZoneSpec; readonly ready: Promise<PreparedZone | null>; readonly run: CompileRun; readonly done: Promise<void> }

function sameZone(a: ZoneSpec, b: ZoneSpec): boolean {
  return a.id === b.id && a.seed === b.seed && a.harvestLevel === b.harvestLevel;
}
/** One `compileAsync` root; `owned` = zone meshes (released again when their zone is disposed mid-compile). */
interface CompileItem { readonly object: Object3D; readonly owned: boolean }
/** Thrown inside three's compile loop for a unit whose zone was disposed: nothing further is built for it (T4). */
const COMPILE_ABORT = new Error('@ewa/render: compile cancelled (the zone was disposed)');
const VELOCITY = velocity as unknown as { setProjectionMatrix(m: Matrix4 | null): void };

/** A low-priority slot before each background unit (T4): `scheduler.postTask('background')`, else a frame's worth. */
function backgroundSlot(): Promise<void> {
  const s = (globalThis as { scheduler?: { postTask?(cb: () => void, o: { priority: string }): Promise<void> } }).scheduler;
  if (s?.postTask) return s.postTask(() => undefined, { priority: 'background' });
  return new Promise((r) => setTimeout(r, 16));
}

/** `loadZone` options (addition, IMPLEMENTATION-NOTES Part 5, T4). */
export interface LoadZoneOptions {
  /** Where the player will stand (spawn / handover arrival): phase 1 compiles what the diorama camera sees from there. Absent → the rig's focus. */
  readonly focus?: { readonly x: number; readonly z: number } | null;
  /**
   * `prepareZone` only (load-time addition 2026-10-25): no frames to protect (the boot compile is running): the build
   * runs in larger task slices and the first view's units compile at `COMPILE_CONCURRENCY` instead of in background slots.
   */
  readonly eager?: boolean;
}

class RendererHost implements Renderer, HostContext {
  readonly renderer: WebGPURenderer;
  readonly scene = new Scene();
  readonly camera3: PerspectiveCamera;
  readonly camera: CameraRig;
  readonly stage: BattleStage;
  readonly hud: HudLayer;
  readonly actors: ActorPool;
  readonly materials: MaterialLibrary;
  readonly modelsUrl: string | null;
  readonly creatureModelsUrl: string | null;
  readonly npcModelsUrl: string | null;
  readonly npcModels: NpcModels;
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
  /** The host's inspector (always): shadow-map draw calls per frame (B2); per-context timing when tracked. */
  private readonly inspector: PassTimer;
  /** `BudgetCounts` of the last completed `frame()`, taken at its step 6: readable after any await (B1). */
  private frameCounts: BudgetCounts | null = null;
  private frameShadowDraws = 0;
  /** Set once `measurePassMs` wrote the differential numbers: the live per-context values stop overwriting them. */
  passMsLatched = false;
  private readonly clock: (() => number) | null;
  private readonly onCompileProgress: ((p: CompileProgress) => void) | null;
  private readonly precompileEnabled: boolean;
  private readonly backgroundEnabled: boolean;
  private readonly warmObjects: Object3D[] = [];
  /** The subsystems' warm-up objects (billboard, VFX, character, beacon housing), as opposed to the library quads. */
  private readonly warmSubsystem = new Set<Object3D>();
  /** Scene objects hidden until used (the arena), compiled with every light set (T4). */
  private readonly persistent: Object3D[] = [];
  /** The step-8 warm-up group (kept, detached): recompiled against every zone's light set (H4). */
  private warmGroup: Group | null = null;
  private warmGeometry: BufferGeometry | null = null;
  /** While a pre-compile runs: the renderer state frames must render with (the compile keeps the scene pass's). */
  private compileHold: { readonly target: RenderTarget | null; readonly mrt: ReturnType<WebGPURenderer['getMRT']>; readonly velocityProjection: Matrix4 | null } | null = null;
  /** The unjittered projection the velocity MRT reads while a pre-compile runs (what TRAA sets during its render). */
  private readonly compileProjection = new Matrix4();
  /** Last pre-compile per phase: render objects compiled and wall ms (sandbox / harness). */
  readonly compileStats: { boot: CompileStat | null; zone: CompileStat | null; background: CompileStat | null } = { boot: null, zone: null, background: null };
  private readonly lightCounts: LightCountsOut = { shadow: 0, nonShadow: 0 };
  private effectsFlags: EffectsFlags;
  private passes: PassSwitches = ALL_PASSES_ON;
  private requestedPr: number;
  private resolutionScale = 1;
  quality: GraphicsQuality;
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
  /** E6: set once the WebGPU device was lost; `frame()` renders nothing from then on. */
  deviceLost: DeviceLostInfo | null = null;
  private readonly onDeviceLost: ((info: DeviceLostInfo) => void) | null;

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
    this.quality = o.quality === 'auto' ? recommendedQuality(caps) : o.quality ?? 'high';
    this.clock = o.clock ?? null;
    this.modelsUrl = o.modelsUrl === undefined ? '/models/' : o.modelsUrl;
    this.creatureModelsUrl = o.creatureModelsUrl === undefined ? '/creature-models/' : o.creatureModelsUrl;
    this.npcModelsUrl = o.npcModelsUrl === undefined ? '/npc-models/' : o.npcModelsUrl;
    this.onCompileProgress = o.onCompileProgress ?? null;
    this.onDeviceLost = o.onDeviceLost ?? null;
    this.precompileEnabled = o.precompile !== false;
    // measurement renderers (`trackTimestamp`: the budget / shot harness) compile a zone fully before `loadZone`
    // resolves unless they ask otherwise, so a capture never runs while far units are still gated (T4)
    this.backgroundEnabled = o.backgroundCompile ?? o.trackTimestamp !== true;

    // 6.
    const cssW = o.canvas.clientWidth || o.canvas.width || 1;
    const cssH = o.canvas.clientHeight || o.canvas.height || 1;
    this.camera3 = new PerspectiveCamera(CAMERA_PARAMS.fovV, cssW / cssH, CAMERA_PARAMS.near, CAMERA_PARAMS.far);
    for (const l of CAMERA_LAYERS) this.camera3.layers.enable(l);
    this.scene.name = 'ewa:scene';

    // Library (needs the KTX2 loader from step 5; its maps are resolved before step 8).
    this.materials = createMaterialLibrary(gpu, ktx2, o.materialsUrl ?? '/materials/');

    // 7. lighting rig, sky + PMREM, fog node, post graph, HUD, stage, actors — all before resolve.
    if (this.materials.uniforms.occlusion !== undefined) this.materials.uniforms.occlusion.camera = this.camera3;   // M2-spawn-noon-9
    this.lighting = new LightRig(this.scene);
    this.lighting.setShadowMaps(QUALITY_PROFILES[this.quality].sunShadowMap, QUALITY_PROFILES[this.quality].actorShadowMap);
    if (this.materials.uniforms.waterBackdrop !== undefined) setWaterBackdrop(this.materials.uniforms.waterBackdrop, QUALITY_PROFILES[this.quality].waterBackdrop);
    setLodScale(QUALITY_PROFILES[this.quality].lodScale);
    this.sky = new SkyController(gpu, this.scene);
    this.fog = createHeightFog();
    this.scene.fogNode = this.fog.node;
    this.day = new DayCycle({ rig: this.lighting, sky: this.sky, fog: this.fog, shared: this.materials.uniforms });
    this.precipitation = new PrecipitationSheet(this.materials.uniforms);
    this.scene.add(this.precipitation.object);
    this.post = new PostStack(gpu, this.scene, this.camera3, backend, this.effectsFlags, this.passes, this.quality);
    const trackTs = caps.timestampQuery && o.trackTimestamp === true;
    // B1 / B2: one inspector always — it counts the shadow-map draw calls of every frame; timing only when tracked
    this.inspector = new PassTimer((rt) => this.classifyRender(rt), trackTs, () => gpu.info);
    gpu.inspector = this.inspector;
    this.passTimer = trackTs ? this.inspector : null;
    this.timestamps = new TimestampResolver(gpu, trackTs, this.statsRecord, this.passTimer !== null ? () => this.collectPassMs() : undefined);

    this.camera = subsystems.camera(this);
    const hud = subsystems.hud(this);
    this.hud = hud.layer;
    this.hudOverlay = hud.overlay;
    this.stage = subsystems.stage(this);
    this.actors = subsystems.actors(this);
    this.npcModels = subsystems.npcModels?.(this) ?? NO_NPC_MODELS;
    this.zones = subsystems.zones(this);
    this.hooks = subsystems.hooks(this);
    this.warmObjects.push(...subsystems.warmup(this));
    for (const w of this.warmObjects) this.warmSubsystem.add(w);
    this.persistent.push(...(subsystems.persistent?.(this) ?? []));
    this.installCompileAbort();
    this.installBuildKeep();
    this.installPipelineHold();

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
    if (this.precompileEnabled) await this.precompile('boot', [group]);
    this.scene.add(group);
    const rainWasVisible = this.precipitation.object.visible;
    this.precipitation.object.visible = true;
    this.frame(0);
    this.precipitation.object.visible = rainWasVisible;
    this.scene.remove(group);
    // The warm meshes are kept (never `dispose`d): their render objects keep the compiled programs alive.
    this.warmObjects.push(...group.children);
    this.warmGroup = group;
    // H5: the warm quad stays alive with the warm meshes (part of the baseline). Disposed here, it was re-uploaded
    // by every zone pre-compile of the warm group — 5 attributes / 192 B nothing freed again.
    this.warmGeometry = geo;
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
  /** Boot (step 8): every warm-up object (the detached warm group) and the persistent scene objects, blocking. */
  private async precompile(phase: 'boot', containers: readonly Object3D[]): Promise<void> {
    const items: CompileItem[] = [];
    for (const c of containers) for (const o of c.children) if (hasRenderable(o)) items.push({ object: o, owned: false });
    for (const o of this.persistent) items.push({ object: o, owned: false });
    await this.compileQueue(phase, null, items, COMPILE_CONCURRENCY, { cancelled: false }, false);
  }

  /** T4: runs holding the scene pass's target + MRT on the renderer (`compileHold`); the last one restores. */
  private holdCount = 0;

  private beginCompileHold(): void {
    if (this.holdCount++ > 0) return;
    const gpu = this.renderer;
    const pass = this.post.nodes.scenePass as unknown as { renderTarget: RenderTarget; getMRT(): unknown };
    const traa = this.post.plan.some((st) => st.id === 'traa');
    const hold = { target: gpu.getRenderTarget(), mrt: gpu.getMRT(), velocityProjection: traa ? this.compileProjection.copy(this.camera3.projectionMatrix) : null };
    gpu.setRenderTarget(pass.renderTarget);                                                     // 2.
    gpu.setMRT(pass.getMRT() as Parameters<WebGPURenderer['setMRT']>[0]);
    VELOCITY.setProjectionMatrix(hold.velocityProjection);                                     // 4.
    this.compileHold = hold;
  }

  private endCompileHold(): void {
    if (--this.holdCount > 0) return;
    const hold = this.compileHold;
    this.compileHold = null;
    VELOCITY.setProjectionMatrix(null);
    if (hold !== null) { this.renderer.setRenderTarget(hold.target); this.renderer.setMRT(hold.mrt); }
  }

  /**
   * T4: compiles `items` with `concurrency` workers, each unit by one in-place `compileAsync(unit, camera, scene)` —
   * the unit stays where it is (a LOD level in its LOD, a chunk mesh under the zone root), so a frame rendered meanwhile
   * sees the scene as it is; a zone unit is gated (`gate`) until its own compile finished, so no frame compiles it
   * synchronously. `background`: a low-priority slot before each unit. A cancelled run stops pulling units and aborts
   * the ones in flight (`COMPILE_ABORT` from the node build). Reports `onCompileProgress` in units.
   */
  private async compileQueue(phase: CompileProgress['phase'], zone: string | null, items: readonly CompileItem[], concurrency: number, run: CompileRun, background: boolean): Promise<void> {
    const gpu = this.renderer as WebGPURenderer & { compileAsync?: unknown };
    if (typeof gpu.compileAsync !== 'function') return;
    const t0 = this.clock !== null ? this.clock() : null;
    let next = 0; let done = 0; let objects = 0;
    const workers = Math.max(1, Math.min(concurrency, items.length));
    const report = (fin: boolean): void => {
      const ms = t0 !== null && this.clock !== null ? this.clock() - t0 : null;
      if (fin) this.compileStats[phase] = { objects, ms, groups: workers, units: done };
      this.onCompileProgress?.({ phase, zone, loaded: done, total: items.length, done: fin, ms });
    };
    report(false);
    this.beginCompileHold();
    try {
      const worker = async (): Promise<void> => {
        while (!run.cancelled && next < items.length) {
          const item = items[next++]!;
          if (item.owned && !this.isGated(item.object)) { done++; continue; }   // compiled by another run meanwhile
          if (background && run.urgent !== true) await backgroundSlot();
          if (run.cancelled) break;
          objects += await this.compileUnit(item, run);
          if (!run.cancelled) this.ungate(item.object);
          done++;
          report(false);
        }
      };
      const jobs: Promise<void>[] = [];
      for (let k = 0; k < workers; k++) jobs.push(worker());
      await Promise.all(jobs);
    } finally {
      this.endCompileHold();
    }
    report(true);
  }

  /**
   * One unit (H4 facts 1–4 per call): the prologue — synchronous inside `compileAsync` — sees the unit visible and
   * un-culled (every LOD level, far tier and empty instanced mesh compiles), the gate layer enabled on the camera and
   * render contexts at the scene pass's call depth; all of it is restored before this returns to the event loop.
   * Lights come from the scene (`targetScene`), so a unit compiles against the scene's light set exactly once.
   * Returns the render objects compiled.
   */
  private async compileUnit(item: CompileItem, run: CompileRun): Promise<number> {
    type Compile = (scene: Object3D, camera: Camera, targetScene?: Scene | null, onProgress?: ((e: { loaded: number; total: number }) => void) | null) => Promise<void>;
    const gpu = this.renderer as WebGPURenderer & { compileAsync: Compile; _renderContexts?: { get(rt: RenderTarget | null, mrt: unknown, depth?: number): unknown } };
    const o = item.object;
    const touched: Object3D[] = []; const state: number[] = [];
    o.traverse((x) => { touched.push(x); state.push((x.visible ? 1 : 0) | (x.frustumCulled ? 2 : 0)); x.visible = true; x.frustumCulled = false; this.runOf.set(x, run); });
    const contexts = gpu._renderContexts;
    const getContext = contexts?.get;
    const depth = this.post.sceneCallDepth ?? SCENE_PASS_CALL_DEPTH;
    const layers = this.camera3.layers;
    const gateWasOn = layers.isEnabled(LAYERS.compileGate);
    let total = 0;
    let job: Promise<void>;
    try {
      if (contexts && getContext) contexts.get = (rt, mrt, d) => getContext.call(contexts, rt, mrt, d ?? depth);   // 3.
      layers.enable(LAYERS.compileGate);
      job = gpu.compileAsync(o, this.camera3, this.scene, (e) => { total = e.total; });
    } finally {
      if (contexts && getContext) contexts.get = getContext;
      if (!gateWasOn) layers.disable(LAYERS.compileGate);
      touched.forEach((x, i) => { x.visible = (state[i]! & 1) !== 0; x.frustumCulled = (state[i]! & 2) !== 0; });
    }
    try {
      await job;
    } catch (e) {
      if (e !== COMPILE_ABORT) throw e;
    }
    // a zone disposed mid-compile: render objects three created for its meshes after their dispose event are released
    if (run.cancelled && item.owned) for (const x of touched) if (isDrawable(x)) x.dispatchEvent({ type: 'dispose' } as never);
    return total;
  }

  /** Zone meshes not compiled yet → the gate layer only (the scene camera skips them); `ungate` restores (T4). */
  private readonly gated = new Map<Object3D, number>();

  private gate(o: Object3D): void {
    o.traverse((x) => { if (isDrawable(x) && !this.gated.has(x)) { this.gated.set(x, x.layers.mask); x.layers.set(LAYERS.compileGate); } });
  }

  private ungate(o: Object3D): void {
    o.traverse((x) => { const m = this.gated.get(x); if (m !== undefined) { x.layers.mask = m; this.gated.delete(x); } });
    this.lighting.refreshShadows();
  }

  private isGated(o: Object3D): boolean {
    let g = false;
    o.traverse((x) => { if (!g && this.gated.has(x)) g = true; });
    return g;
  }

  /** The compile run a mesh belongs to (the node-build abort check). */
  private readonly runOf = new WeakMap<Object3D, CompileRun>();

  /**
   * T4: one check around three's `NodeManager.getForRenderAsync` (only `compileAsync` calls it): a render object of a
   * cancelled run throws `COMPILE_ABORT` before and after its node build, so three's compile loop stops before it
   * uploads geometry, creates bindings or takes a pipeline for a disposed zone.
   */
  private installCompileAbort(): void {
    const nodes = (this.renderer as unknown as { _nodes?: { getForRenderAsync?(ro: { object: Object3D }): Promise<unknown> } })._nodes;
    const orig = nodes?.getForRenderAsync?.bind(nodes);
    if (!nodes || !orig) return;
    nodes.getForRenderAsync = async (ro: { object: Object3D }): Promise<unknown> => {
      if (this.runOf.get(ro.object)?.cancelled === true) throw COMPILE_ABORT;
      const r = await orig(ro);
      if (this.runOf.get(ro.object)?.cancelled === true) throw COMPILE_ABORT;
      return r;
    };
  }

  /** Handover II: node builder states a zone mesh made, kept past their last render object (`installBuildKeep`). */
  readonly buildKeep = { states: 0 };

  /**
   * Handover II (IMPLEMENTATION-NOTES): three drops a node build from its cache (`NodeManager.delete`) when its last
   * render object goes, so a cold crossing — the old zone disposed, then the new one built — rebuilt every key the two
   * zones share (the same library surfaces on the same geometry layouts). The first time a zone mesh's build would be
   * dropped it is kept instead (one extra use, once per build): the next zone's meshes with that key find it in the
   * cache. A build holds the generated shader text and the binding layout — no GPU object (programs and pipelines are
   * still released with their render objects, so `programs` returns to the baseline as before). Bounded by the distinct
   * keys: library surface × geometry layout × render context (the light key is fixed since the light layout). Shadow-pass
   * builds are not kept: they are cheap (16 per crossing, 36 ms), and kept ones re-initialised hero textures the library
   * had disposed (+5 textures per Mirevale reload in the sandbox leak cycle).
   */
  private installBuildKeep(): void {
    type State = { usedTimes: number };
    const nodes = (this.renderer as unknown as { _nodes?: { delete?(o: unknown): unknown; get?(o: unknown): { nodeBuilderState?: State } } })._nodes;
    const orig = nodes?.delete?.bind(nodes);
    if (!nodes || !orig || typeof nodes.get !== 'function') return;
    const kept = new WeakSet<State>();
    nodes.delete = (o: unknown): unknown => {
      const ro = o as { isRenderObject?: boolean; object?: Object3D; material?: { isShadowPassMaterial?: boolean } };
      if (ro.isRenderObject === true && ro.object !== undefined && isZoneMesh(ro.object) && ro.material?.isShadowPassMaterial !== true) {
        const st = nodes.get!(o).nodeBuilderState;
        if (st !== undefined && !kept.has(st)) { kept.add(st); st.usedTimes++; this.buildKeep.states++; }
      }
      return orig(o);
    };
  }

  /** Handover II: render objects of a disposed zone whose pipeline release waits for the next zone's phase 1 (null: none held). */
  private heldPipelines: object[] | null = null;
  private releasePipelines: (held: readonly object[]) => void = () => {};
  /** Handover II: pipelines held across the last crossing (diagnostics). */
  readonly pipelineHold = { held: 0 };

  /**
   * Handover II (IMPLEMENTATION-NOTES): a cold crossing disposes the old zone, then builds and compiles the new one.
   * three releases a render object's pipeline (and its programs, at zero users) when the object goes, so the new zone's
   * phase 1 re-created every pipeline the two zones share — GPU pipeline compiles the main thread waited for (≈ 0.4 s
   * idle in the cold crossing's profile). While a zone is disposed, its render objects' pipeline releases are held;
   * they run once the next zone's phase 1 finished (its first view's pipelines are cache hits meanwhile), or in the next
   * task when no zone load follows the dispose. Pipeline keys are structural (material state, render context, geometry
   * layout), so they carry over. Programs are back to the counts without the hold as soon as the hold is released.
   */
  private installPipelineHold(): void {
    const pipes = (this.renderer as unknown as { _pipelines?: { delete?(o: object): unknown } })._pipelines;
    const orig = pipes?.delete?.bind(pipes);
    if (!pipes || !orig) return;
    pipes.delete = (o: object): unknown => {
      const ro = o as { isRenderObject?: boolean; object?: Object3D };
      if (this.heldPipelines !== null && ro.isRenderObject === true && ro.object !== undefined && isZoneMesh(ro.object)) { this.heldPipelines.push(o); return undefined; }
      return orig(o);
    };
    this.releasePipelines = (held) => { for (const o of held) orig(o); };
  }

  /** Starts holding zone pipeline releases (a zone is about to be disposed). */
  private holdPipelines(): void {
    if (this.heldPipelines === null) this.heldPipelines = [];
  }

  /** Releases every held pipeline (the next zone's phase 1 is done, no load followed, or the renderer goes). */
  private releaseHeldPipelines(): void {
    const held = this.heldPipelines;
    if (held === null) return;
    this.heldPipelines = null;
    this.pipelineHold.held = held.length;
    this.releasePipelines(held);
  }

  /** The current zone's background phase (T4): resolves when it finished or its zone was disposed. */
  private background: Promise<void> = Promise.resolve();

  compileIdle(): Promise<void> { return this.background; }

  /**
   * T4: the diorama view the player gets at `focus` (the rig's heading and zoom, the §10.7.1 pitch), or null when the
   * rig does not expose them (then the whole zone is phase 1).
   */
  private predictView(handle: ZoneHandle, focus: { readonly x: number; readonly z: number } | null): ViewGuess | null {
    const rig = this.camera as CameraRig & { readonly dioramaYaw?: number; readonly zoomStop?: 0 | 1 | 2 };
    const f = focus ?? { x: rig.focus.x, z: rig.focus.z };
    if (typeof rig.dioramaYaw !== 'number' || !Number.isFinite(f.x) || !Number.isFinite(f.z)) return null;
    const collider = (handle as ZoneHandle & { readonly collider?: { sampleClamped?(x: number, z: number): number } }).collider;
    const y = collider?.sampleClamped?.(f.x, f.z) ?? 0;
    const cam = this.viewGuess;
    cam.fov = this.camera3.fov; cam.aspect = this.camera3.aspect; cam.near = this.camera3.near; cam.far = this.camera3.far;
    cam.updateProjectionMatrix();
    const pose: OrbitPose = { center: new Vector3(f.x, Number.isFinite(y) ? y : 0, f.z), yaw: rig.dioramaYaw, pitch: (PITCH * Math.PI) / 180, distance: DISTANCE[rig.zoomStop ?? DEFAULT_ZOOM_STOP] };
    orbitPosition(pose, cam.position);
    cam.lookAt(pose.center);
    cam.updateMatrixWorld();
    return { camera: cam, focus: pose.center };
  }

  private readonly viewGuess = new PerspectiveCamera();

  /**
   * T4: the zone's compile units — phase 1: what the predicted first view draws plus the actor / billboard / decal /
   * VFX warm objects; phase 2: the beacon housing and the arena (battle readiness), then the zone's other units nearest
   * first, the warm library quads last. Every zone unit is gated until compiled. Background off: one phase.
   */
  private planZone(handle: ZoneHandle, focus: { readonly x: number; readonly z: number } | null): { near: CompileItem[]; far: CompileItem[] } {
    const units = planZoneCompile(handle.group, this.backgroundEnabled ? this.predictView(handle, focus) : null);
    for (const u of units) this.gate(u.object);
    const near: CompileItem[] = orderUnits(units.filter((u) => u.near)).map((u) => ({ object: u.object, owned: true }));
    const farZone = units.filter((u) => !u.near).sort((a, b) => a.distance - b.distance).map((u) => ({ object: u.object, owned: true }));
    const far: CompileItem[] = [];
    const quads: CompileItem[] = [];
    for (const o of this.warmGroup?.children ?? []) {
      if (!this.warmSubsystem.has(o)) quads.push({ object: o, owned: false });
      else if ((o.userData as { ewaCompileDeferred?: boolean }).ewaCompileDeferred === true) far.push({ object: o, owned: false });
      else near.push({ object: o, owned: false });
    }
    for (const o of this.persistent) far.push({ object: o, owned: false });
    far.push(...farZone, ...quads);
    if (!this.backgroundEnabled) return { near: [...near, ...far], far: [] };
    return { near, far };
  }

  /** T4: wraps the handle's `dispose`: the zone's compile run is cancelled first and the hooks hear `onZone(null)`. */
  private watchDispose(handle: ZoneHandle, run: CompileRun): void {
    const h = handle as ZoneHandle & { dispose(): void };
    const dispose = h.dispose.bind(h);
    const root = handle.group;
    h.dispose = (): void => {
      if (run.cancelled) { dispose(); return; }
      run.cancelled = true;
      for (const hk of this.hooks) hk.onZone?.(null);
      const mine: Object3D[] = [];
      root.traverse((o) => { if (this.gated.has(o)) mine.push(o); });
      if (!this.disposed) this.holdPipelines();   // Handover II: released after the next zone's phase 1
      dispose();
      for (const o of mine) this.gated.delete(o);
      if (this.heldPipelines !== null) setTimeout(() => { if (!this.loading) this.releaseHeldPipelines(); }, 0);
      this.scheduleWarmRekey();
    };
  }

  /** E3: the pending / running re-key of the warm objects after an unload (cancelled by the next `loadZone`). */
  private rekeyRun: CompileRun | null = null;

  /**
   * Phase E3 (render Part 5 Open 1, "programs +2 after unload"): a zone's compile re-keys the warm objects (library
   * quads, the billboard / decal / VFX / character warm-ups) and the persistent arena to the zone's light set. Once the
   * zone is gone nothing renders them, so their render objects keep the zone's light-set variants alive (measured +4
   * programs after a Mirevale unload: the `dirt` / `glass_warm` / `mist_glass` quads, the character decal, the surf
   * ripple), against a baseline captured with the boot light set. Unless a next zone starts loading within this task (a
   * handover, whose own compile re-keys them to its light set), they are compiled against the zone-less light set in
   * the background — the boot's set, so exactly the baseline programs come back and the zone variants are released.
   * `compileIdle()` resolves when it is done; the leak check reads the counts after it.
   */
  private scheduleWarmRekey(): void {
    if (!this.precompileEnabled || this.disposed) return;
    const run: CompileRun = { cancelled: false };
    this.rekeyRun = run;
    let settle!: () => void;
    const done = new Promise<void>((res) => { settle = res; });
    const prev = this.background;
    this.background = prev.then(() => done);
    setTimeout(() => {
      if (run.cancelled || this.disposed || this.loading || (this.zone !== null && !isDisposedHandle(this.zone))) { settle(); return; }
      const items: CompileItem[] = [];
      for (const o of this.warmGroup?.children ?? []) items.push({ object: o, owned: false });
      for (const o of this.persistent) items.push({ object: o, owned: false });
      void prev
        .then(() => (run.cancelled ? undefined : this.compileQueue('background', null, items, BACKGROUND_CONCURRENCY, run, true)))
        .catch((e: unknown) => { if (isDevBuild()) console.error('@ewa/render: warm re-key failed', e); })
        .finally(() => { if (this.rekeyRun === run) this.rekeyRun = null; settle(); });
    }, 0);
  }

  private captureBaseline(): void {
    this.refreshSceneCounts();
    this.baseline = readBudgetCounts(this.renderer.info, this.statsRecord.materials, this.lightCounts.shadow, this.lightCounts.nonShadow, this.textureCorrection());
  }

  get isDisposed(): boolean { return this.disposed; }

  /**
   * E6: the device is gone. Frames stop (three also skips its render calls once `_isDeviceLost` is set; the host's own
   * frame steps — compile holds, HUD uploads, timestamp resolves — would only raise errors on a dead device), the
   * running zone compile is cancelled through the zone's dispose by the owner, and the owner hears it once.
   */
  handleDeviceLost(info: DeviceLostInfo): void {
    if (this.disposed || this.deviceLost !== null) return;
    this.deviceLost = info;
    (this.renderer as unknown as { _isDeviceLost?: boolean })._isDeviceLost = true;
    try { this.onDeviceLost?.(info); } catch (e) { if (isDevBuild()) console.error('@ewa/render: onDeviceLost threw', e); }
  }

  // ---- HostContext ------------------------------------------------------------------------------------

  get gpu(): WebGPURenderer { return this.renderer; }
  effects(): EffectsFlags { return this.effectsFlags; }
  timeScale(): number { return this.scale; }
  harvestLevel(): HarvestLevel { return this.harvest; }
  zoneRoot(): Group | null { return currentZoneRoot(this.zone, this.externalRoot); }

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
    this.lighting.refreshShadows();   // the static shadow map holds the zone's casters
    countPunctualLights(this.scene, this.lightCounts);
    this.statsRecord.shadowLights = this.lightCounts.shadow;
    this.statsRecord.nonShadowLights = this.lightCounts.nonShadow;
  }

  // ---- Renderer ------------------------------------------------------------------------------------------

  /** Handover (b): the zone prepared off-scene, if any. */
  private prepared: PreparedRecord | null = null;
  /** Handover II: the last prepare's sliced build (slices, the longest step; sandbox / harness diagnostics). */
  prepareStats: SliceStats | null = null;

  prepareZone(next: ZoneSpec, opts: LoadZoneOptions = {}): Promise<void> {
    if (this.disposed || !this.precompileEnabled) return Promise.resolve();
    const zones = this.zones as ZoneLoader & { prepare?(s: ZoneSpec, o?: PrepareOptions): Promise<PreparedZone> };
    if (typeof zones.prepare !== 'function') return Promise.resolve();
    if (this.prepared !== null) {
      if (sameZone(this.prepared.spec, next)) return this.prepared.done;
      this.dropPrepared();
    }
    const run: CompileRun = { cancelled: false };
    // Handover II: the build runs in slices between frames; a drop stops it, an adopting `loadZone` hurries it
    const stats = createSliceStats();
    this.prepareStats = stats;
    const eager = opts.eager === true;
    const ready = zones.prepare(next, { eager, cancelled: () => run.cancelled || this.disposed, urgent: () => run.urgent === true, stats }).then((z) => {
      if (run.cancelled || this.disposed) { z.drop(); return null; }
      return z;
    }, (e: unknown) => {
      if (e !== STEPS_CANCELLED && isDevBuild()) console.error(`@ewa/render: prepareZone('${next.id}') failed`, e);
      return null;
    });
    const done = ready.then(async (z) => {
      if (z === null || run.cancelled) return;
      // every unit gated (a frame after the adoption never compiles one synchronously), nearest the arrival first
      const units = planZoneCompile(z.handle.group, this.predictView(z.handle, opts.focus ?? null));
      for (const u of units) this.gate(u.object);
      const near: CompileItem[] = orderUnits(units.filter((u) => u.near)).map((u) => ({ object: u.object, owned: true }));
      const far: CompileItem[] = units.filter((u) => !u.near).sort((a, b) => a.distance - b.distance).map((u) => ({ object: u.object, owned: true }));
      if (eager) {
        // the first view at full concurrency (no frames to protect), the rest in background slots as usual
        await this.compileQueue('background', next.id, near, COMPILE_CONCURRENCY, run, false);
        if (!run.cancelled) await this.compileQueue('background', next.id, far, BACKGROUND_CONCURRENCY, run, true);
      } else {
        await this.compileQueue('background', next.id, [...near, ...far], BACKGROUND_CONCURRENCY, run, true);
      }
    }).catch((e: unknown) => { if (isDevBuild()) console.error(`@ewa/render: prepareZone('${next.id}') compile failed`, e); });
    this.prepared = { spec: next, ready, run, done };
    return done;
  }

  dropPrepared(): void {
    const p = this.prepared;
    if (p === null) return;
    this.prepared = null;
    p.run.cancelled = true;
    void p.ready.then((z) => {
      if (z === null) return;
      const mine: Object3D[] = [];
      z.handle.group.traverse((o) => { if (this.gated.has(o)) mine.push(o); });
      z.drop();
      for (const o of mine) this.gated.delete(o);
    });
  }

  async loadZone(spec: ZoneSpec, opts: LoadZoneOptions = {}): Promise<ZoneHandle> {
    if (this.disposed) throw new Error('@ewa/render: loadZone after dispose()');
    if (this.loading || (this.zone !== null && !isDisposedHandle(this.zone))) {
      throw new Error(`@ewa/render: loadZone('${spec.id}') while a zone is loaded and not yet disposed`);
    }
    this.loading = true;
    if (this.rekeyRun !== null) { this.rekeyRun.cancelled = true; this.rekeyRun = null; }   // E3: the new zone re-keys them
    try {
      // handover (b): adopt the zone prepared off-scene for this spec (any other prepared zone is dropped)
      const prepared = this.prepared !== null && sameZone(this.prepared.spec, spec) ? this.prepared : null;
      if (prepared === null) this.dropPrepared();
      else { this.prepared = null; prepared.run.urgent = true; }   // a build still in slices finishes without waits
      const pz = prepared !== null ? await prepared.ready : null;
      if (prepared !== null && pz !== null) return await this.adoptPrepared(spec, prepared, pz, opts);
      let openHero: () => void = () => {};
      const heroGate = new Promise<void>((res) => { openHero = res; });
      const handle = await this.zones.load(spec, { heroGate });
      this.zone = handle;
      const run: CompileRun = { cancelled: false };
      this.watchDispose(handle, run);
      // H4 / T4: the zone's light set is part of every lit program. Phase 1 compiles what the first view draws (and the
      // actor / billboard / VFX warm objects) against it before `loadZone` resolves; phase 2 compiles the rest in the
      // background, each unit gated until its programs exist. H5: the hero texture stream opens after phase 1 (field
      // sets are retired, not disposed, since H5c, so a re-point during phase 2 re-initialises nothing).
      try {
        if (this.precompileEnabled) {
          const plan = this.planZone(handle, opts.focus ?? null);
          await this.compileQueue('zone', spec.id, plan.near, COMPILE_CONCURRENCY, run, false);
          if (plan.far.length > 0) {
            this.background = this.compileQueue('background', spec.id, plan.far, BACKGROUND_CONCURRENCY, run, true).catch((e: unknown) => {
              if (isDevBuild()) console.error('@ewa/render: background compile failed', e);
            });
          }
        }
      } finally {
        openHero();
      }
      for (const h of this.hooks) h.onZone?.(handle);
      this.setHarvestLevel(spec.harvestLevel);
      MaterialBudget.assert(handle.group, 48);
      this.refreshSceneCounts();
      return handle;
    } finally {
      this.loading = false;
      this.releaseHeldPipelines();   // Handover II: the first view's pipelines exist (both paths resolve after phase 1)
    }
  }

  /**
   * Handover (b): the prepared zone becomes the current one. Its root joins the scene with every unit its background
   * run has not compiled yet still gated; phase 1 compiles the still-gated units of the first view (the run goes on
   * without background slots, units it already compiled are skipped), then `loadZone` resolves as usual.
   */
  private async adoptPrepared(spec: ZoneSpec, prepared: PreparedRecord, pz: PreparedZone, opts: LoadZoneOptions): Promise<ZoneHandle> {
    const handle = pz.adopt();
    this.zone = handle;
    const run = prepared.run;
    run.urgent = true;
    this.watchDispose(handle, run);
    try {
      const view = this.backgroundEnabled ? this.predictView(handle, opts.focus ?? null) : null;
      const near = planZoneCompile(handle.group, view).filter((u) => (view === null || u.near) && this.isGated(u.object));
      await this.compileQueue('zone', spec.id, orderUnits(near).map((u) => ({ object: u.object, owned: true })), COMPILE_CONCURRENCY, run, false);
      if (!this.backgroundEnabled) await prepared.done;
      else this.background = Promise.all([this.background, prepared.done]).then(() => undefined);
    } finally {
      pz.openHero();
    }
    for (const h of this.hooks) h.onZone?.(handle);
    this.setHarvestLevel(spec.harvestLevel);
    MaterialBudget.assert(handle.group, 48);
    this.refreshSceneCounts();
    return handle;
  }

  prepareHandover(next: ZoneSpec): void {
    (this.zones as ZoneLoader & { prepareHandover?(s: ZoneSpec): void }).prepareHandover?.(next);
  }

  setTimeOfDay(t: number): void { this.day.setTime(t); }

  setWeather(w: WeatherKind): void {
    this.day.setWeather(w);
    this.precipitation.setMode(weatherParams(w).precipitation);
    for (const h of this.hooks) h.setWeather?.(w);
  }

  setShadow(level: number): void {
    this.day.setShadow(level);
    for (const h of this.hooks) h.setShadow?.(level);
  }

  setSkyMood(mood: 'majin' | 'tenjin' | null): void {
    this.day.setSkyMood(mood);
    for (const h of this.hooks) h.setSkyMood?.(mood);
  }

  setAmbient(on: boolean): void {
    for (const h of this.hooks) h.setAmbient?.(on);
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

  setResolutionScale(s: number): void {
    const next = Number.isFinite(s) ? Math.min(1, Math.max(0.25, s)) : 1;
    if (next === this.resolutionScale) return;
    this.resolutionScale = next;
    this.resize(this.cssW, this.cssH);
  }

  setQuality(q: GraphicsQuality | 'auto'): void {
    if (this.disposed) return;
    const next = q === 'auto' ? recommendedQuality(this.caps) : q;
    if (next === this.quality) return;
    this.quality = next;
    this.lighting.setShadowMaps(QUALITY_PROFILES[next].sunShadowMap, QUALITY_PROFILES[next].actorShadowMap);
    if (this.materials.uniforms.waterBackdrop !== undefined) setWaterBackdrop(this.materials.uniforms.waterBackdrop, QUALITY_PROFILES[next].waterBackdrop);
    setLodScale(QUALITY_PROFILES[next].lodScale);
    this.post.setQuality(next);
    this.resize(this.cssW, this.cssH);
  }

  setDetailDistance(d: DetailDistance): void {
    setDetailRadius(DETAIL_DISTANCE_M[d] ?? Infinity);
  }

  /** §10.1.3: `setPixelRatio(pr); setSize(w, h, false)`; camera aspect, HUD, CSM frustums follow. */
  resize(cssWidth: number, cssHeight: number): void {
    if (this.disposed) return;
    // A hidden / not-yet-laid-out canvas reports 0×0: keep the last valid size instead of a 1×1 buffer.
    if (!(cssWidth >= 1 && cssHeight >= 1)) return;
    this.cssW = Math.floor(cssWidth);
    this.cssH = Math.floor(cssHeight);
    const pr = clampPixelRatio(this.requestedPr, this.cssW, QUALITY_PROFILES[this.quality].pixelRatioCap) * this.resolutionScale;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(this.cssW, this.cssH, false);
    const aspect = this.cssW / this.cssH;
    this.camera.setAspect(aspect);
    this.hud.resize(this.cssW, this.cssH, pr);
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
    if (this.disposed || this.deviceLost !== null) return;
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
    setDetailFocus(focus.x, focus.z);
    // the diorama occluder fade (M2-spawn-noon-9): camera → the followed feet, faded out as a shot blends in, off in
    // first person (the rig posed the eye this same update, so the toggle never shows a frame of dither)
    const occ = this.materials.uniforms.occlusion;
    if (occ !== undefined) {
      const rig = this.camera as CameraRig & { shotBlend?: number; firstPersonActive?: boolean };
      setOcclusion(occ, this.camera3.position, focus, occlusionStrength(rig.shotBlend ?? 0, rig.firstPersonActive === true));
    }
    // (2) day cycle: uniforms only (+ PMREM re-bake when due)
    this.materials.uniforms.windTime.value += scaled / 1000;
    this.renderClockS += scaled / 1000;
    this.day.update(dt, scaled / 1000, focus);
    this.lighting.update(this.renderClockS);
    this.lighting.scheduleShadows();   // the actor shadow map follows the focus; the static one re-renders when due
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
    // (6) stats — and the frame's counts, kept: three's own rAF loop resets `renderer.info` before the next frame,
    // so `counts()` / `dumpZone()` read after an await would otherwise see an empty frame (B1)
    copyInfo(this.renderer.info, this.statsRecord, this.textureCorrection());
    this.frameShadowDraws = this.inspector.takeShadowDraws();
    this.frameCounts = this.readCounts();
    // (7) GPU timestamps
    this.timestamps.poll();
    this.statsRecord.frameMs = this.clock !== null ? this.clock() - t0 : 0;
  }

  stats(): RenderStats { return this.statsRecord; }

  /** B1: the last completed frame's counts (plus beauty / shadow draw calls, B2); live counts before the first frame. */
  counts(): BudgetCounts {
    const c = this.frameCounts ?? this.readCounts();
    const shadow = this.frameCounts !== null ? this.frameShadowDraws : 0;
    return { ...c, beautyDrawCalls: Math.max(0, c.drawCalls - shadow), shadowDrawCalls: shadow };
  }

  private readCounts(): BudgetCounts {
    return readBudgetCounts(this.renderer.info, this.statsRecord.materials, this.statsRecord.shadowLights, this.statsRecord.nonShadowLights, this.textureCorrection());
  }

  /**
   * What `Info.texturesSize` gets wrong, as one signed term for §50.2.2's texture metric: + the KTX2 bytes it counts as 1
   * each (the material library's resident bytes), − what it counts twice (the sprite atlases' level 0, the hooks'
   * `textureOvercountBytes`; render IMPLEMENTATION-NOTES Part 9). No allocation (runs every frame).
   */
  private textureCorrection(): number {
    let over = 0;
    for (let i = 0; i < this.hooks.length; i++) over += this.hooks[i]!.textureOvercountBytes?.() ?? 0;
    return this.materials.residentTextureBytes() - over;
  }

  gpuFrameMs(): Promise<number | undefined> { return this.timestamps.resolveNow(); }

  /** §10.1.5 dispose order. Idempotent. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.hud.dispose();
    this.stage.dispose();
    this.actors.dispose();
    this.dropPrepared();
    if (this.zone !== null) this.zone.dispose();
    this.zone = null;
    this.releaseHeldPipelines();
    for (const h of this.hooks) h.dispose?.();
    this.post.dispose();
    this.day.dispose();              // PMREM generator + its target, sky meshes
    this.precipitation.dispose();
    this.lighting.dispose();
    this.materials.disposeAll();
    this.warmGeometry?.dispose();
    this.warmGeometry = null;
    this.ktx2.dispose();
    void this.renderer.dispose();
  }

  // ---- zone view / probe support ----------------------------------------------------------------------------

  dump(zoneId: string): ZoneDump {
    const root = this.zoneRoot() ?? new Group();
    const culled = (this.zones as ZoneLoader & { culledChunks?: () => number }).culledChunks?.() ?? 0;
    const counts = this.frameCounts ?? this.readCounts();
    return dumpZone({
      zone: zoneId, harvestLevel: this.harvest, root, library: this.materials, counts, culledChunks: culled, spriteScan: this.scene,
      ...(this.frameCounts !== null ? { shadowDrawCalls: this.frameShadowDraws } : {}),
    });
  }
}

/** A mesh, line, points or sprite (what three draws and a compile gate hides). */
function isDrawable(o: Object3D): boolean {
  const r = o as Object3D & { isMesh?: boolean; isLine?: boolean; isPoints?: boolean; isSprite?: boolean };
  return r.isMesh === true || r.isLine === true || r.isPoints === true || r.isSprite === true;
}

/**
 * The zone root the stats, the probe and the budget toggles act on: the loaded zone's, else the root registered through
 * `setZoneRoot`. A disposed handle stays in `zone` until the next `loadZone` (the load / compile guards read it), so it
 * must not shadow a registered root — the arena backdrop stands in while no zone is loaded (it did, 2026-10-12: the
 * stadium was never counted). Pure; exported for the tests.
 */
export function currentZoneRoot(zone: ZoneHandle | null, external: Group | null): Group | null {
  return zone !== null && !isDisposedHandle(zone) ? zone.group : external;
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
