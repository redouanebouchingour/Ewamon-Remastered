/**
 * @ewa/render sandbox — a small test diorama built WITHOUT content imports:
 * a ground plane with two terrain materials (moss | gravel path | moss), chamfered boxes (plaster house,
 * cobble plinth, stone wall, timber crates/frame, slate roof), a lamp with a real shadow-casting light and a
 * visible emissive housing, a brazier point light with flicker, a tree (bark + leaf cards), tall grass, a
 * pond, and a stand-in quad where a creature billboard will go (DOF-sharp, GTAO-excluded through `mask`).
 *
 * `window.__ewaSandbox` exposes `stats()`, `counts()`, `dump()`, `setTime(hours)`, `setReducedEffects(bool)`,
 * `setHarvest(level)`, `setWeather(kind)`, `plan()`, `warnings()`, `shot(name)` for inspection.
 */
import {
  BufferAttribute, CircleGeometry, ExtrudeGeometry, Group, LatheGeometry, Mesh, MeshStandardNodeMaterial, PlaneGeometry, Shape, Vector2,
  WebGPURenderer,
} from 'three/webgpu';
import type { BufferGeometry } from 'three/webgpu';
import { color, mrt, vec2 } from 'three/tsl';
import {
  ALL_EFFECTS, GROVE_LIGHTING, WATER_DEPTH_ATTRIBUTE, applyReducedEffects, capViolations, createBudgetProbe, createRenderer, paintSurfaceColor,
  rendererInternals,
} from '../src/index.js';
import type { BasicDioramaRig, HarvestLevel, LightSource, Renderer, SurfaceId, WeatherKind, ZoneHandleImpl } from '../src/index.js';
import { zone as contentZone } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import { withNeighbours, zoneSpecFor } from '@ewa/client-adapter';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const hudEl = document.getElementById('hud') as HTMLDivElement;
const errEl = document.getElementById('err') as HTMLDivElement;

// ---- geometry helpers (sandbox-only; the zone builder owns the real generators) ----------------------------

/** A box with 4 cm chamfers (Pillar 3), bottom at y = 0, centred in x/z; UVs in metres (WorldUVGenerator). */
function chamferedBox(w: number, h: number, d: number, c = 0.04): BufferGeometry {
  const s = new Shape();
  const hw = w / 2 - c; const hd = d / 2 - c;
  s.moveTo(-hw, -hd); s.lineTo(hw, -hd); s.lineTo(hw, hd); s.lineTo(-hw, hd); s.lineTo(-hw, -hd);
  const g = new ExtrudeGeometry(s, { depth: Math.max(0.001, h - 2 * c), bevelEnabled: true, bevelSize: c, bevelThickness: c, bevelSegments: 2, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  return g;
}

/** A gable roof prism: triangle profile (span × rise) extruded over `length`, chamfered. */
function roofPrism(span: number, rise: number, length: number, c = 0.04): BufferGeometry {
  const s = new Shape();
  s.moveTo(-span / 2, 0); s.lineTo(span / 2, 0); s.lineTo(0, rise); s.lineTo(-span / 2, 0);
  const g = new ExtrudeGeometry(s, { depth: length, bevelEnabled: true, bevelSize: c, bevelThickness: c, bevelSegments: 2, curveSegments: 1 });
  g.translate(0, 0, -length / 2);
  return g;
}

function lathe(points: readonly [number, number][], segments: number): BufferGeometry {
  return new LatheGeometry(points.map(([r, y]) => new Vector2(r, y)), segments).toNonIndexed();
}

function crossedCards(w: number, h: number, count: number): BufferGeometry {
  const parts: number[] = []; const uvs: number[] = []; const normals: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI;
    const cx = Math.cos(a) * w / 2; const cz = Math.sin(a) * w / 2;
    const nx = -Math.sin(a); const nz = Math.cos(a);
    const quad: [number, number, number, number, number][] = [
      [-cx, 0, -cz, 0, 0], [cx, 0, cz, 1, 0], [cx, h, cz, 1, 1],
      [-cx, 0, -cz, 0, 0], [cx, h, cz, 1, 1], [-cx, h, -cz, 0, 1],
    ];
    for (const [x, y, z, u, v] of quad) { parts.push(x, y, z); uvs.push(u, v); normals.push(nx, 0, nz); }
  }
  const g = new PlaneGeometry(1, 1).toNonIndexed();
  g.setAttribute('position', new BufferAttribute(new Float32Array(parts), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  return g;
}

// ---- the diorama ------------------------------------------------------------------------------------------

const SURFACES_USED: SurfaceId[] = [
  'grove_moss', 'path_gravel', 'dirt', 'cobble', 'plaster', 'timber', 'slate_roof', 'stone_wall', 'lantern_metal', 'glass_warm',
  'grove_bark', 'grove_leaf_canopy', 'tall_grass', 'water_pond',
];

function buildDiorama(r: Renderer): Group {
  const lib = r.materials;
  const root = new Group();
  root.name = 'sandbox:zone';
  const add = (geo: BufferGeometry, id: SurfaceId, x: number, y: number, z: number, opts: { ry?: number; shadow?: boolean } = {}): Mesh => {
    paintSurfaceColor(geo, id);
    const m = new Mesh(geo, lib.get(id));
    m.position.set(x, y, z);
    m.rotation.y = opts.ry ?? 0;
    m.castShadow = opts.shadow ?? true;
    m.receiveShadow = true;
    m.name = `sandbox:${id}`;
    root.add(m);
    return m;
  };

  // Ground: moss | gravel path (4 m) | moss; triplanar terrain layers (world-constant 3 m tiles).
  const ground = (w: number, cx: number, id: SurfaceId): void => {
    const g = new PlaneGeometry(w, 60, Math.max(1, Math.round(w / 2)), 30);
    g.rotateX(-Math.PI / 2);
    add(g, id, cx, 0, 0, { shadow: false });
  };
  ground(28, -16, 'grove_moss');
  ground(4, 0, 'path_gravel');
  ground(28, 16, 'grove_moss');

  // Cobble plinth under the lamp, dirt patch by the house.
  add(chamferedBox(5, 0.12, 5), 'cobble', 4.5, 0, 3.5, { shadow: false });
  add(chamferedBox(4, 0.06, 3), 'dirt', -6, 0, 5.5, { shadow: false });

  // House: plaster walls, slate roof, timber corner posts.
  add(chamferedBox(6, 3, 5), 'plaster', -6, 0, -3);
  add(roofPrism(6.7, 2.2, 5.7), 'slate_roof', -6, 3, -3);
  for (const [dx, dz] of [[-3, -2.5], [3, -2.5], [-3, 2.5], [3, 2.5]] as const) add(chamferedBox(0.24, 3.05, 0.24), 'timber', -6 + dx, 0, -3 + dz);

  // Stone wall and crates.
  add(chamferedBox(8, 0.9, 0.5), 'stone_wall', 7, 0, -6, { ry: 0.25 });
  add(chamferedBox(0.8, 0.8, 0.8), 'timber', 2.8, 0, -1.2, { ry: 0.4 });
  add(chamferedBox(0.7, 0.7, 0.7), 'timber', 3.4, 0, -0.2, { ry: -0.3 });

  // Lamp: lathed post (lantern_metal), faceted housing (glass_warm = the light source, Pillar 4), cap.
  const lx = 4.5; const lz = 3.5;
  add(lathe([[0.001, 0], [0.13, 0], [0.13, 0.12], [0.07, 0.18], [0.05, 2.32], [0.09, 2.4], [0.001, 2.4]], 12), 'lantern_metal', lx, 0.12, lz);
  add(lathe([[0.001, 2.4], [0.15, 2.42], [0.18, 2.6], [0.15, 2.78], [0.001, 2.8]], 6), 'glass_warm', lx, 0.12, lz, { shadow: false });
  add(lathe([[0.001, 2.8], [0.22, 2.82], [0.05, 3.0], [0.001, 3.02]], 6), 'lantern_metal', lx, 0.12, lz);

  // Brazier (point light with flicker): metal bowl + glowing coals.
  const bx = -2.8; const bz = 6.5;
  add(lathe([[0.001, 0], [0.12, 0], [0.1, 0.5], [0.42, 0.7], [0.46, 0.82], [0.001, 0.72]], 10), 'lantern_metal', bx, 0, bz);
  add(lathe([[0.001, 0.72], [0.36, 0.74], [0.2, 0.86], [0.001, 0.9]], 7), 'glass_warm', bx, 0, bz, { shadow: false });

  // Tree: bark trunk with root flare (wind) + leaf cards (alpha-tested, double-sided, wind).
  const tx = 9; const tz = 6;
  add(lathe([[0.001, 0], [0.5, 0], [0.34, 0.5], [0.26, 2], [0.18, 4.2], [0.12, 5.6], [0.001, 5.8]], 12), 'grove_bark', tx, 0, tz);
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26;
    add(crossedCards(2.2, 2.0, 2), 'grove_leaf_canopy', tx + Math.cos(a) * 0.9, 3.6 + (i % 2) * 0.8, tz + Math.sin(a) * 0.9, { ry: a });
  }

  // Tall grass tufts by the path.
  for (let i = 0; i < 12; i++) add(crossedCards(0.7, 0.7, 3), 'tall_grass', -3.2 - (i % 3) * 0.6, 0, -8 + i * 1.1, { ry: i * 0.7 });

  // Pond with a painted depth attribute (§10.5.6 depthBelow).
  const pond = new CircleGeometry(2.4, 32);
  pond.rotateX(-Math.PI / 2);
  pond.setAttribute(WATER_DEPTH_ATTRIBUTE, new BufferAttribute(new Float32Array(pond.getAttribute('position').count).fill(1.2), 1));
  add(pond, 'water_pond', 12, 0.03, -2, { shadow: false });

  // Creature stand-in: a lit quad marked DOF-sharp (mask.y = 1) and GTAO-excluded (mask.x = 1), as §10.4.5 will.
  const standIn = new MeshStandardNodeMaterial();
  standIn.colorNode = color('#e8d9b0');
  standIn.roughness = 0.85;
  standIn.mrtNode = mrt({ mask: vec2(1, 1) });
  const quad = new PlaneGeometry(1.2, 1.6);
  quad.translate(0, 0.8, 0);
  const creature = new Mesh(quad, standIn);
  creature.name = 'sandbox:creature-standin';
  creature.position.set(0.9, 0, 1.2);
  creature.rotation.y = -35 * Math.PI / 180;
  creature.castShadow = true;
  root.add(creature);

  return root;
}

const LIGHTS: LightSource[] = [
  { id: 'lamp_plinth', kind: 'lantern', color: '#ffb35c', intensity: 45, position: [4.5, 2.72, 3.5], castShadow: true, range: 14, housing: { kind: 'generated', generator: 'lantern', seed: 1 }, flicker: null },
  { id: 'brazier_path', kind: 'brazier', color: '#ff8a3c', intensity: 18, position: [-2.8, 1.05, 6.5], castShadow: false, range: 9, housing: { kind: 'mesh', meshId: 'sandbox:brazier' }, flicker: { amplitude: 0.12, hz: 5 } },
];

// ---- boot -------------------------------------------------------------------------------------------------

/** Waits for the GPU queue (so a frame's deferred pipeline compilation is inside the measured interval). */
async function gpuIdle(r: Renderer): Promise<void> {
  const dev = (r.renderer.backend as unknown as { device?: { queue: { onSubmittedWorkDone(): Promise<void> } } }).device;
  if (dev) await dev.queue.onSubmittedWorkDone();
}

/** Boot / zone timings for the Part 4 measurements (`__ewaSandbox.timing()`). */
const timing: Record<string, number | string | null> = {};
let holding = false;
let firstZoneFrame: (() => Promise<void>) | null = null;

/** WGSL of every program three holds (`renderer._pipelines.programs`), for "which programs did this frame add". */
function programCodes(r: Renderer): { vertex: string[]; fragment: string[] } {
  const p = (r.renderer as unknown as { _pipelines?: { programs?: { vertex: Map<string, unknown>; fragment: Map<string, unknown> } } })._pipelines?.programs;
  return { vertex: p ? [...p.vertex.keys()] : [], fragment: p ? [...p.fragment.keys()] : [] };
}
let programsAtLoad: { vertex: string[]; fragment: string[] } | null = null;
let programsAtBaseline: { vertex: string[]; fragment: string[] } | null = null;
let programNamesAtBaseline: string[] = [];
/** `stage:name` of every program three holds (multiset, sorted). */
function programNames(r: Renderer): string[] {
  const p = (r.renderer as unknown as { _pipelines?: { programs?: { vertex: Map<string, { name: string }>; fragment: Map<string, { name: string }> } } })._pipelines?.programs;
  if (!p) return [];
  return [...[...p.vertex.values()].map((x) => `v:${x.name}`), ...[...p.fragment.values()].map((x) => `f:${x.name}`)].sort();
}

interface TrackedGpu { readonly targets: Map<object, string>; readonly textures: Map<object, string>; readonly attributes: Map<object, string> }

/** A few frames of the call stack (file:line), for objects created after the first zone frame. */
function shortStack(): string {
  const lines = (new Error().stack ?? '').split('\n').slice(3).map((l) => l.trim().replace(/^at /, '').replace(/\(?https?:\/\/[^)]*\/([^/?)]+)(\?[^:)]*)?:(\d+):\d+\)?/, ' $1:$3'));
  return lines.filter((l) => !l.includes('main.ts')).slice(0, 7).join(' < ');
}

/**
 * `?track=1` (leak hunting, IMPLEMENTATION-NOTES Part 4): wraps three's texture bookkeeping so every render target /
 * texture three initialises after this call is listed with its name, size and creation phase until it is destroyed.
 * Installed from `WebGPURenderer.init` (below), i.e. before `createRenderer`'s step 8 — so the objects alive at the
 * step-8 baseline are known and `leaks()` can name what outlives it.
 */
function trackGpuObjects(gpu: WebGPURenderer, phase: () => string): TrackedGpu {
  const t = (gpu as unknown as { _textures: Record<string, (...a: unknown[]) => unknown> & { has(o: object): boolean; info: { createTexture(tx: object): void; destroyTexture(tx: object): void } } })._textures;
  const out: TrackedGpu = { targets: new Map(), textures: new Map(), attributes: new Map() };
  const describe = (o: { name?: string; texture?: { name?: string }; width?: number; height?: number; image?: { width?: number; height?: number } }): string =>
    `${o.texture?.name || o.name || (o as { constructor: { name: string } }).constructor.name} ${o.width ?? o.image?.width ?? '?'}x${o.height ?? o.image?.height ?? '?'} @${phase()}`;
  const upd = t.updateRenderTarget!.bind(t);
  t.updateRenderTarget = (rt: unknown, lvl: unknown) => {
    const had = t.has(rt as object) && (t as unknown as { get(o: object): { initialized?: boolean } }).get(rt as object).initialized === true;
    const res = upd(rt, lvl);
    if (!had) out.targets.set(rt as object, describe(rt as never));
    return res;
  };
  const destroyRT = t._destroyRenderTarget!.bind(t);
  t._destroyRenderTarget = (rt: unknown) => { out.targets.delete(rt as object); return destroyRT(rt); };
  const info = t.info;
  const destroyed = new WeakSet<object>();
  let current: { material?: { name?: string }; object?: { name?: string; type?: string } } | null = null;
  const bindings = (gpu as unknown as { _bindings: { getForRender(ro: unknown): unknown } })._bindings;
  const getForRender = bindings.getForRender.bind(bindings);
  bindings.getForRender = (ro: unknown) => { current = ro as typeof current; try { return getForRender(ro); } finally { current = null; } };
  const create = info.createTexture.bind(info);
  info.createTexture = (tx: object) => {
    const who = current ? ` by ${current.object?.type ?? '?'} '${current.object?.name ?? ''}' / '${current.material?.name ?? ''}'` : '';
    const again = destroyed.has(tx) ? ' RE-INIT after destroy' : '';
    out.textures.set(tx, describe(tx as never) + again + who + (phase() === 'play' || phase().startsWith('x') ? ` [${shortStack()}]` : ''));
    create(tx);
  };
  const inf = info as unknown as { createAttribute(a: object): void; destroyAttribute(a: object): void };
  const cA = inf.createAttribute.bind(inf);
  inf.createAttribute = (a: object) => { out.attributes.set(a, `${(a as { name?: string }).name || (a as { constructor: { name: string } }).constructor.name} n${(a as { count?: number }).count ?? '?'} x${(a as { itemSize?: number }).itemSize ?? '?'} @${phase()} [${shortStack()}]`); cA(a); };
  const dA = inf.destroyAttribute.bind(inf);
  inf.destroyAttribute = (a: object) => { out.attributes.delete(a); dA(a); };
  const destroy = info.destroyTexture.bind(info);
  info.destroyTexture = (tx: object) => { out.textures.delete(tx); destroyed.add(tx); destroy(tx); };
  return out;
}

/**
 * `?pipes=1` (compile-time hunting, IMPLEMENTATION-NOTES Part 5): times every `GPUDevice.createRenderPipeline(Async)`
 * call (label, start, duration, phase) so the zone compile's wall time can be split by pipeline.
 */
interface PipeRec { readonly label: string; readonly t0: number; dt: number; readonly async: boolean; readonly phase: string; readonly by: string }
const pipeRecs: PipeRec[] = [];
let pipePhase = 'boot';
/** The render object whose pipeline three is creating right now (set around `backend.createRenderPipeline`). */
let pipeBy = '';
/** Installed once the backend exists: names the object behind every pipeline (`PipeRec.by`). */
function tagPipelines(gpu: WebGPURenderer): void {
  const be = gpu.backend as unknown as { createRenderPipeline(ro: { object?: { name?: string; type?: string; isInstancedMesh?: boolean; count?: number }; material?: { name?: string } }, p: unknown): unknown };
  const orig = be.createRenderPipeline.bind(be);
  be.createRenderPipeline = (ro, p) => {
    pipeBy = `${ro.object?.type ?? '?'} '${ro.object?.name ?? ''}'${ro.object?.isInstancedMesh ? ` n${ro.object.count ?? 0}` : ''}`;
    try { return orig(ro, p); } finally { pipeBy = ''; }
  };
}
if (new URLSearchParams(location.search).get('pipes') === '1') {
  const proto = WebGPURenderer.prototype as unknown as { init(this: WebGPURenderer): Promise<unknown> };
  const init = proto.init;
  let tagged = false;
  proto.init = async function (this: WebGPURenderer): Promise<unknown> {
    const res = await init.call(this);
    if (!tagged) { tagged = true; tagPipelines(this); }
    return res;
  };
}
if (new URLSearchParams(location.search).get('pipes') === '1' && typeof GPUDevice !== 'undefined') {
  const proto = GPUDevice.prototype as unknown as { createRenderPipelineAsync(d: { label?: string }): Promise<unknown>; createRenderPipeline(d: { label?: string }): unknown };
  const pa = proto.createRenderPipelineAsync;
  proto.createRenderPipelineAsync = function (this: GPUDevice, d: { label?: string }): Promise<unknown> {
    const rec: PipeRec = { label: d.label ?? '', t0: performance.now(), dt: -1, async: true, phase: pipePhase, by: pipeBy };
    pipeRecs.push(rec);
    return pa.call(this, d).then((p) => { rec.dt = performance.now() - rec.t0; return p; });
  };
  const ps = proto.createRenderPipeline;
  proto.createRenderPipeline = function (this: GPUDevice, d: { label?: string }): unknown {
    const rec: PipeRec = { label: d.label ?? '', t0: performance.now(), dt: 0, async: false, phase: pipePhase, by: pipeBy };
    pipeRecs.push(rec);
    const p = ps.call(this, d);
    rec.dt = performance.now() - rec.t0;
    return p;
  };
}
function pipeSummary(): Record<string, unknown> {
  const by = new Map<string, PipeRec[]>();
  for (const r of pipeRecs) { const a = by.get(r.phase) ?? []; a.push(r); by.set(r.phase, a); }
  const out: Record<string, unknown> = {};
  for (const [ph, rs] of by) {
    const done = rs.filter((r) => r.dt >= 0);
    const span = rs.length ? Math.max(...done.map((r) => r.t0 + r.dt)) - Math.min(...rs.map((r) => r.t0)) : 0;
    out[ph] = {
      n: rs.length, async: rs.filter((r) => r.async).length, sync: rs.filter((r) => !r.async).length, pending: rs.length - done.length,
      sumMs: Math.round(done.reduce((s, r) => s + r.dt, 0)), spanMs: Math.round(span),
      top: [...done].sort((a, b) => b.dt - a.dt).slice(0, 40).map((r) => `${Math.round(r.dt)} @${Math.round(r.t0)} ${r.label} <- ${r.by}`),
    };
  }
  return out;
}

let trackPhase = 'boot';
let tracked: TrackedGpu | null = null;
if (new URLSearchParams(location.search).get('track') === '1') {
  const proto = WebGPURenderer.prototype as unknown as { init(this: WebGPURenderer): Promise<unknown> };
  const init = proto.init;
  proto.init = async function (this: WebGPURenderer): Promise<unknown> {
    const res = await init.call(this);
    if (tracked === null) tracked = trackGpuObjects(this, () => trackPhase);
    return res;
  };
}

/** Compile progress reports (T4) and the frames rendered while a background phase ran (ms between rAF ticks, frame() CPU). */
const compileLog: { phase: string; zone: string | null; loaded: number; total: number; done: boolean; ms: number | null; at: number }[] = [];
let backgroundActive = false;
const bgFrames: { gap: number; cpu: number; at: number }[] = [];
/** Main-thread long tasks (> 50 ms) while a background phase ran: start (ms since navigation) and duration. */
const bgLongTasks: { at: number; ms: number }[] = [];
try {
  const all: { at: number; ms: number }[] = [];
  (window as unknown as { __ewaLongTasks: typeof all }).__ewaLongTasks = all;
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      const rec = { at: Math.round(e.startTime), ms: Math.round(e.duration) };
      if (backgroundActive) bgLongTasks.push(rec);
      if (all.length < 400) all.push(rec);
    }
  }).observe({ type: 'longtask', buffered: false });
} catch { /* no long-task timing */ }
const idleFrames: { gap: number; cpu: number; at: number }[] = [];

async function main(): Promise<void> {
  const tBoot = performance.now();
  const r = await createRenderer({
    onCompileProgress: (p) => {
      compileLog.push({ ...p, at: Math.round(performance.now()) });
      if (p.phase === 'background') backgroundActive = !p.done;
      if (p.done) timing[`compile_${p.phase}_ms`] = p.ms === null ? null : Math.round(p.ms);
      if (p.done) timing[`compile_${p.phase}_units`] = p.total;
    },
    backgroundCompile: new URLSearchParams(location.search).get('bg') !== '0',   // `&bg=0`: single-phase (Part 4) A/B
    canvas,
    pixelRatio: window.devicePixelRatio || 1,
    effects: ALL_EFFECTS,
    trackTimestamp: true,
    transcoderPath: '/basis/',
    materialsUrl: '/materials/',
    clock: () => performance.now(),
    precompile: new URLSearchParams(location.search).get('precompile') !== '0',   // `&precompile=0`: the pre-H4 path (A/B)
  });
  // the step-8 baseline was captured inside createRenderer, with no await after it: this is the same moment
  const atBaseline = tracked ? { targets: new Set(tracked.targets.keys()), textures: new Set(tracked.textures.keys()), attributes: new Set(tracked.attributes.keys()) } : null;
  trackPhase = 'after-baseline';
  programsAtBaseline = programCodes(r);
  programNamesAtBaseline = programNames(r);
  await gpuIdle(r);
  timing.createRendererMs = Math.round(performance.now() - tBoot);
  timing.programsAfterWarmup = r.renderer.info.memory.programs;
  const host = rendererInternals(r)!;
  const probe = createBudgetProbe(r, 'sandbox');

  // ?zone=<ZoneId>: the REAL zone through the client adapter (SPEC §20.4.4) and renderer.loadZone (§10.5).
  // Optional: &x=&z= focus, &h=0..3 heading, &zoom=0..2, &t=hours, &harvest=intact|thinning|harvested.
  const params = new URLSearchParams(location.search);
  const zoneId = params.get('zone') as ZoneId | null;
  let zoneHandle: ZoneHandleImpl | null = null;
  const rig = r.camera as BasicDioramaRig;
  if (zoneId) {
    const harvest = (params.get('harvest') ?? 'intact') as 'intact' | 'thinning' | 'harvested';
    const def = contentZone(zoneId);
    // E3: the linked neighbours' terrain in the skirt, as the client builds it (`&neighbours=0`: the hills only, A/B)
    const spec0 = params.get('neighbours') === '0' ? zoneSpecFor(def, harvest) : withNeighbours(zoneSpecFor(def, harvest), def);
    // `&interiors=0`: the zone without its Phase A pockets (A/B for the program / draw counts)
    const spec = params.get('interiors') === '0' ? { ...spec0, interiors: [] } : spec0;
    // Phase A: `&interior=<pocket id>` (e.g. mirevale.gym) shows that pocket's hall (setActive), turns the camera to the
    // hall axis (setYawBase) and frames the hall (`&at=arena` frames the first battle room's arena instead)
    const interior = spec.interiors?.find((p) => p.id === params.get('interior')) ?? null;
    let ix = def.spawn.x; let iz = def.spawn.z;
    if (interior) {
      const room = interior.rooms[0];
      const lx = params.get('at') === 'arena' && room ? room.arena.lx : 0; const lz = params.get('at') === 'arena' && room ? room.arena.lz : 0;
      const c = Math.cos(interior.yaw); const sn = Math.sin(interior.yaw);
      ix = interior.x + c * lx + sn * lz; iz = interior.z - sn * lx + c * lz;
      rig.setYawBase((interior.yaw * 180) / Math.PI);
      if (room) (window as unknown as { __ewaInterior: unknown }).__ewaInterior = {
        id: interior.id,
        arena: { x: interior.x + c * room.arena.lx + sn * room.arena.lz, z: interior.z - sn * room.arena.lx + c * room.arena.lz },
        hall: { x: interior.x + c * room.bounds.lx + sn * room.bounds.lz, z: interior.z - sn * room.bounds.lx + c * room.bounds.lz, yaw: interior.yaw, hw: room.bounds.hw, hd: room.bounds.hd },
      };
    }
    const fx = Number(params.get('x') ?? ix); const fz = Number(params.get('z') ?? iz);
    rig.setHeading((Number(params.get('h') ?? 0) & 3) as 0 | 1 | 2 | 3);
    rig.setZoomStop(Math.max(0, Math.min(2, Number(params.get('zoom') ?? 1))) as 0 | 1 | 2);
    for (let i = 0; i < 30; i++) rig.update(16);     // settle the heading / zoom eases (the predicted view reads them)
    const t0 = performance.now();
    trackPhase = 'loadZone';
    pipePhase = 'zone';
    zoneHandle = await r.loadZone(spec, { focus: { x: fx, z: fz } }) as ZoneHandleImpl;
    pipePhase = 'background';
    trackPhase = 'firstFrame';
    pipePhase = 'firstFrame';
    timing.loadZoneMs = Math.round(performance.now() - t0);
    timing.programsAfterLoad = r.renderer.info.memory.programs;
    programsAtLoad = programCodes(r);
    console.info(`[sandbox] loaded ${zoneId} in ${(performance.now() - t0).toFixed(0)} ms`, zoneHandle.info);
    rig.setFocus(fx, zoneHandle.collider.sampleClamped(fx, fz), fz);
    if (interior && zoneHandle.interiors) {
      zoneHandle.interiors.setActive(interior.id);
      zoneHandle.interiors.setView(((interior.yaw * 180) / Math.PI + 90 * (Number(params.get('h') ?? 0) & 3)) * (Math.PI / 180));
      for (const g of params.get('open') === '1' ? interior.gates : []) zoneHandle.interiors.setGateOpen(g.id, true);
      for (const sw of params.get('on') === '1' ? interior.switches : []) zoneHandle.interiors.setSwitchOn(sw.id, true);
      zoneHandle.interiors.settle();
    }
    // the first zone frame: CPU time of frame() and until the GPU queue drained (sync pipeline compiles land here);
    // `&hold=1` defers it (and the loop) until `__ewaSandbox.release()`, so it can run under the CDP profiler
    firstZoneFrame = async (): Promise<void> => {
      const tf = performance.now();
      r.frame(16);
      timing.firstZoneFrameCpuMs = Math.round(performance.now() - tf);
      await gpuIdle(r);
      timing.firstZoneFrameMs = Math.round(performance.now() - tf);
      timing.programsAfterFirstFrame = r.renderer.info.memory.programs;
      trackPhase = 'play';
      if (!backgroundActive) pipePhase = 'play';
      void (r.compileIdle?.() ?? Promise.resolve()).then(() => { pipePhase = 'play'; timing.backgroundIdleAt = Math.round(performance.now() - t0); timing.programsAfterBackground = r.renderer.info.memory.programs; });
      holding = false;
    };
    if (params.get('hold') === '1') holding = true; else await firstZoneFrame();
    (window as unknown as { __ewaZone: unknown }).__ewaZone = { spec, handle: zoneHandle };
  } else {
    await r.materials.preload(SURFACES_USED);
    const root = buildDiorama(r);
    host.lighting.createPunctuals(LIGHTS, root);
    r.scene.add(root);
    host.setZoneRoot(root);
    rig.setFocus(0.9, 0, 1.2);
  }

  let hours = Number(new URLSearchParams(location.search).get('t') ?? 10);
  r.setTimeOfDay(hours / 24);
  const resize = (): void => { if (canvas.clientWidth > 0 && canvas.clientHeight > 0) r.resize(canvas.clientWidth, canvas.clientHeight); };
  new ResizeObserver(resize).observe(canvas);
  resize();

  let last = performance.now();
  const loop = (now: number): void => {
    const gap = now - last;
    const dt = Math.min(100, gap);
    last = now;
    const tc = performance.now();
    if (!holding) r.frame(dt);
    const rec = { gap: Math.round(gap * 10) / 10, cpu: Math.round((performance.now() - tc) * 10) / 10, at: Math.round(now) };
    if (backgroundActive) { if (bgFrames.length < 20000) bgFrames.push(rec); } else if (idleFrames.length < 600) idleFrames.push(rec);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  if (!zoneHandle) void r.materials.preloadHero(SURFACES_USED);

  const api = {
    renderer: r,
    probe,
    /** Boot / zone-load / first-frame timings (ms) and program counts at each step. */
    timing: () => ({ ...timing }),
    /** T4: every onCompileProgress report (phase, units, ms) and frame gaps / CPU during vs after the background phase. */
    compileLog: () => compileLog.filter((c) => c.done || c.loaded === 0),
    frameStats: () => {
      const q = (xs: number[], f: number): number => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * f))]! : Number.NaN; };
      const sum = (fs: { gap: number; cpu: number }[]) => ({ n: fs.length, gapP50: q(fs.map((f) => f.gap), 0.5), gapP95: q(fs.map((f) => f.gap), 0.95), gapMax: q(fs.map((f) => f.gap), 1), cpuP50: q(fs.map((f) => f.cpu), 0.5), cpuP95: q(fs.map((f) => f.cpu), 0.95), cpuMax: q(fs.map((f) => f.cpu), 1), over50: fs.filter((f) => f.gap > 50).length, over100: fs.filter((f) => f.gap > 100).length });
      const lt = bgLongTasks;
      return {
        background: sum(bgFrames), after: sum(idleFrames),
        longTasks: { n: lt.length, sumMs: lt.reduce((x, e) => x + e.ms, 0), maxMs: lt.reduce((x, e) => Math.max(x, e.ms), 0), top: [...lt].sort((a2, b2) => b2.ms - a2.ms).slice(0, 8) },
        slowFrames: bgFrames.filter((f) => f.gap > 100).slice(0, 40).map((f) => `${f.at}:${f.gap}`),
      };
    },
    /** T4: a zone handover measured like the client does it: dispose, then loadZone(next, focus); phase 1 ms returned. */
    handover: async (next: string, x?: number, z?: number) => {
      const def2 = contentZone(next as ZoneId);
      const spec2 = new URLSearchParams(location.search).get('neighbours') === '0' ? zoneSpecFor(def2, 'intact') : withNeighbours(zoneSpecFor(def2, 'intact'), def2);
      const hx = x ?? def2.spawn.x; const hz = z ?? def2.spawn.z;
      zoneHandle?.dispose();
      rig.setFocus(hx, 0, hz);
      bgFrames.length = 0; idleFrames.length = 0; bgLongTasks.length = 0;
      pipePhase = 'handover';
      const th = performance.now();
      zoneHandle = await r.loadZone(spec2, { focus: { x: hx, z: hz } }) as ZoneHandleImpl;
      const phase1 = Math.round(performance.now() - th);
      pipePhase = 'handover-bg';
      rig.setFocus(hx, zoneHandle.collider.sampleClamped(hx, hz), hz);
      (window as unknown as { __ewaZone: unknown }).__ewaZone = { spec: spec2, handle: zoneHandle };
      await (r.compileIdle?.() ?? Promise.resolve());
      return { phase1Ms: phase1, totalMs: Math.round(performance.now() - th), programs: r.renderer.info.memory.programs };
    },
    /** `?pipes=1`: render pipelines created per phase (count, summed / wall ms, the slowest). */
    pipes: () => pipeSummary(),
    pipeRecs: () => pipeRecs.map((p) => ({ ...p, t0: Math.round(p.t0), dt: Math.round(p.dt) })),
    /** `&hold=1`: renders the deferred first zone frame (then the loop resumes) and returns the timings. */
    release: async () => { if (firstZoneFrame && holding) await firstZoneFrame(); return { ...timing }; },
    /** Programs (WGSL) three holds now that it did not hold right after `loadZone` resolved, plus that snapshot. */
    newPrograms: () => {
      if (!programsAtLoad) return null;
      const now = programCodes(r);
      const at = programsAtLoad;
      return { vertex: now.vertex.filter((c) => !at.vertex.includes(c)), fragment: now.fragment.filter((c) => !at.fragment.includes(c)), atLoad: at };
    },
    /** Program names now vs the step-8 baseline (multiset difference both ways). */
    programNamesVsBaseline: () => {
      const now = programNames(r); const base = [...programNamesAtBaseline];
      const extra: string[] = [];
      for (const n of now) { const i = base.indexOf(n); if (i >= 0) base.splice(i, 1); else extra.push(n); }
      return { extra, missing: base };
    },
    /** Programs alive now that were not at the step-8 baseline, and baseline programs gone (first lines of their WGSL). */
    programsVsBaseline: () => {
      if (!programsAtBaseline) return null;
      const now = programCodes(r); const at = programsAtBaseline;
      const head = (c: string) => c.split(String.fromCharCode(10)).filter((l) => l.includes('fn ') || l.includes('NodeUniform') || l.includes('@location')).slice(0, 6).join(' | ').slice(0, 400);
      return {
        added: { vertex: now.vertex.filter((c) => !at.vertex.includes(c)).map(head), fragment: now.fragment.filter((c) => !at.fragment.includes(c)).map(head) },
        gone: { vertex: at.vertex.filter((c) => !now.vertex.includes(c)).length, fragment: at.fragment.filter((c) => !now.fragment.includes(c)).length },
      };
    },
    /** `?track=1`: render targets / textures three initialised after boot and still alive (name size @phase). */
    live: () => (tracked ? { targets: [...tracked.targets.values()], textures: [...tracked.textures.values()] } : null),
    /** A/B for the Part 4 shots: the DOF CoC masked under mask.y (H3; true = shipped) and a fog density override (H8). */
    setDofMaskedCoC: (on: boolean) => host.post.setBuildOptions({ dofMaskedCoC: on }),
    setFogDensity: (d: number) => host.setLightingPalette({ ...GROVE_LIGHTING, fogDensity: d }),
    /** `?track=1`: labels the objects created from now on (leak hunting). */
    setTrackPhase: (p: string) => { trackPhase = p; },
    /** `?track=1`: render targets / textures alive now that were not alive at the step-8 baseline. */
    leaks: () => {
      if (!tracked || !atBaseline) return null;
      const t = tracked;
      return {
        targets: [...t.targets.entries()].filter(([o]) => !atBaseline.targets.has(o)).map(([, d]) => d),
        textures: [...t.textures.entries()].filter(([o]) => !atBaseline.textures.has(o)).map(([, d]) => d),
        attributes: [...t.attributes.entries()].filter(([o]) => !atBaseline.attributes.has(o)).map(([, d]) => d),
        goneSinceBaseline: { targets: [...atBaseline.targets].filter((o) => !t.targets.has(o)).length, textures: [...atBaseline.textures].filter((o) => !t.textures.has(o)).length },
      };
    },
    stats: () => ({ ...r.stats(), passMs: { ...r.stats().passMs } }),
    counts: () => probe.counts(),
    dump: () => probe.dumpZone(),
    plan: () => host.post.plan.map((s) => s.id),
    warnings: () => r.materials.warnings(),
    caps: () => r.caps,
    setTime: (h: number) => { hours = h; r.setTimeOfDay(h / 24); (document.getElementById('time') as HTMLInputElement).value = String(h); },
    setReducedEffects: (on: boolean) => r.setEffects(on ? applyReducedEffects(ALL_EFFECTS) : ALL_EFFECTS),
    setHarvest: (l: HarvestLevel) => r.setHarvestLevel(l),
    setWeather: (w: WeatherKind) => r.setWeather(w),
    capViolations: () => capViolations(probe.counts()),
    /** Real-zone mode: move the focus (feet height from the collider), heading, zoom. */
    goto: (x: number, z: number, heading?: 0 | 1 | 2 | 3, zoom?: 0 | 1 | 2) => {
      rig.setFocus(x, zoneHandle ? zoneHandle.collider.sampleClamped(x, z) : 0, z);
      if (heading !== undefined) rig.setHeading(heading);
      if (zoom !== undefined) rig.setZoomStop(zoom);
      host.lighting.updateFrustums();
    },
    zone: () => zoneHandle,
    /** The BudgetCounts captured after construction step 8 (the leak-test baseline, §50.1.9). */
    baseline: () => host.baseline,
    /**
     * In-browser leak check (§10.5.9): unload the zone, render, compare `renderer.info.memory` with the baseline;
     * then reload it. `cycles` unload/reload rounds; returns the per-round diffs (all zeros = no leak).
     */
    leakCycle: async (cycles = 3) => {
      const spec = (window as unknown as { __ewaZone?: { spec: Parameters<Renderer['loadZone']>[0] } }).__ewaZone?.spec;
      if (!spec || !zoneHandle) return null;
      const keys = ['geometries', 'textures', 'programs', 'renderTargets', 'attributes', 'attributesSize'] as const;
      const rounds: Record<string, number>[] = [];
      for (let i = 0; i < cycles; i++) {
        trackPhase = `unload${i}`;
        zoneHandle.dispose();
        for (let k = 0; k < 3; k++) r.frame(16);
        // E3: the warm objects are re-keyed to the zone-less light set in the background after an unload
        await (r.compileIdle?.() ?? Promise.resolve());
        for (let k = 0; k < 3; k++) r.frame(16);
        const m = r.renderer.info.memory as unknown as Record<string, number>;
        const b = host.baseline as unknown as Record<string, number>;
        rounds.push(Object.fromEntries(keys.map((k) => [k, m[k]! - b[k]!])));
        trackPhase = `reload${i}`;
        zoneHandle = await r.loadZone(spec, { focus: { x: rig.focus.x, z: rig.focus.z } }) as ZoneHandleImpl;
        for (let k = 0; k < 3; k++) r.frame(16);
        if (new URLSearchParams(location.search).get('leakwait') !== '0') await (r.compileIdle?.() ?? Promise.resolve());
        trackPhase = 'play';
      }
      return rounds;
    },
    /** Beauty-only draw calls: renders one frame with shadows off, reads the count, restores. */
    beautyDraws: () => {
      probe.setPassEnabled('shadows', false); r.frame(16); r.frame(16);
      const c = probe.counts().drawCalls;
      probe.setPassEnabled('shadows', true); r.frame(16);
      return { beauty: c, total: probe.counts().drawCalls };
    },
    /**
     * Renders `frames` frames at a forced 1280×720 drawing buffer (works while the window is hidden and rAF
     * is paused) and POSTs a JPEG to the dev server, which writes `sandbox/.shots/<name>.jpg`.
     */
    shot: async (name: string, frames = 24): Promise<unknown> => {
      r.resize(1280, 720);                                   // always 16:9 at 1280×720 (the gameplay framing)
      for (let i = 0; i < frames; i++) r.frame(1000 / 60);
      const c = document.createElement('canvas');
      c.width = 1280; c.height = 720;
      c.getContext('2d')!.drawImage(canvas, 0, 0, 1280, 720);
      if (canvas.clientWidth > 0 && canvas.clientHeight > 0) r.resize(canvas.clientWidth, canvas.clientHeight);
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.88));
      if (!blob) return null;
      const resp = await fetch(`/__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob });
      return resp.json();
    },
  };
  (window as unknown as { __ewaSandbox: typeof api }).__ewaSandbox = api;
  // render part 3 demos: ?demo=lineup | ?demo=battle (creature billboards, arena, VFX, HUD — sandbox/part3.ts)
  const demo = new URLSearchParams(location.search).get('demo');
  if (demo) void import('./part3.js').then((m) => m.startPart3Demo(r, demo, api as unknown as Record<string, unknown>)).catch((e: unknown) => console.error(e));

  (document.getElementById('time') as HTMLInputElement).addEventListener('input', (e) => api.setTime(Number((e.target as HTMLInputElement).value)));
  (document.getElementById('reduced') as HTMLInputElement).addEventListener('change', (e) => api.setReducedEffects((e.target as HTMLInputElement).checked));
  (document.getElementById('harvest') as HTMLSelectElement).addEventListener('change', (e) => api.setHarvest(Number((e.target as HTMLSelectElement).value) as HarvestLevel));
  (document.getElementById('weather') as HTMLSelectElement).addEventListener('change', (e) => api.setWeather((e.target as HTMLSelectElement).value as WeatherKind));

  setInterval(() => {
    const s = r.stats();
    const c = probe.counts();
    const hh = Math.floor(hours); const mm = Math.round((hours - hh) * 60);
    hudEl.textContent = [
      `backend ${r.backend}  ktx2 ${r.caps.ktx2}  ts ${r.caps.timestampQuery}  ${r.caps.adapter ?? ''}`,
      `time ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  harvest ${host.harvestLevel()}`,
      `draws ${s.drawCalls}  tris ${s.triangles}  programs ${s.programs}  RTs ${s.renderTargets}`,
      `textures ${s.textures} (${(s.textureBytes / 1048576).toFixed(1)} MB)  geometries ${s.geometries}  materials ${s.materials}`,
      `lights ${s.shadowLights} shadow + ${s.nonShadowLights}  gpu ${s.gpuMs === null ? '—' : s.gpuMs.toFixed(2) + ' ms'}  cpu ${s.frameMs.toFixed(2)} ms`,
      `post ${host.post.plan.map((p) => p.id).join(' → ')}`,
      `library ${JSON.stringify(r.materials.stats())}  warnings ${r.materials.warnings().length}`,
      capViolations(c).length ? `CAP VIOLATIONS ${JSON.stringify(capViolations(c))}` : 'caps ok',
    ].join('\n');
  }, 250);
}

main().catch((e: unknown) => {
  errEl.textContent = e instanceof Error ? `${e.name}: ${e.message}\n${e.stack ?? ''}` : String(e);
  console.error(e);
});
