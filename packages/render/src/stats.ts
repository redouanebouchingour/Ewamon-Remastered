/**
 * SPEC §10.10 — render stats and budget.
 *
 * - `RenderStats` lives in ONE preallocated record per renderer; `frame()` copies `renderer.info` into it
 *   and `stats()` returns it (§10.10.3: "no object is created per call").
 * - `gpuMs` comes from `resolveTimestampsAsync('render')` when the adapter has `timestamp-query` and the
 *   renderer was created with `trackTimestamp: true`; at most one resolve is in flight.
 * - `passMs` is filled only by the differential procedure (§50.2.3: `T_all − T_without_p`, `opaque` as
 *   the remainder) — `computePassMs` is that arithmetic, pure and node-tested.
 * - `dumpZone` walks a zone root into the `ZoneDump` JSON the asset audit reads (§10.10.1).
 */
import { Box3, InspectorBase, Mesh, PointLight, SpotLight, TimestampQuery, Vector3 } from 'three/webgpu';
import type { BufferGeometry, Camera, InstancedMesh, Material, Object3D, RenderTarget, Texture, WebGPURenderer } from 'three/webgpu';
import {
  BUDGET_PASSES, LAYERS, type BudgetCounts, type BudgetPass, type HarvestLevel, type RenderStats,
} from './descriptors.js';
import type { MaterialLibrary } from './materials/library.js';
import type { MaterialClass, SurfaceId } from './materials/surfaces.js';

// ---- the record ------------------------------------------------------------------------------------------

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
export type MutableRenderStats = Mutable<Omit<RenderStats, 'passMs'>> & { readonly passMs: Record<BudgetPass, number | null> };

export function createRenderStats(): MutableRenderStats {
  const passMs = {} as Record<BudgetPass, number | null>;
  for (const p of BUDGET_PASSES) passMs[p] = null;
  return {
    drawCalls: 0, triangles: 0, textures: 0, textureBytes: 0, geometries: 0, programs: 0, renderTargets: 0,
    materials: 0, shadowLights: 0, nonShadowLights: 0, gpuMs: null, passMs, frameMs: 0,
  };
}

/** The subset of `renderer.info` read here (typed structurally so tests can pass a plain object). */
export interface InfoLike {
  readonly render: { readonly drawCalls: number; readonly triangles: number };
  readonly memory: {
    readonly textures: number; readonly texturesSize: number; readonly geometries: number; readonly programs: number;
    readonly renderTargets: number; readonly attributes: number; readonly attributesSize: number; readonly total: number;
  };
}

/**
 * Step (6) of `frame()`: copy `gpu.info` into the preallocated record. `compressedBytes` is added to
 * `textureBytes` because three 0.186's `Info._getTextureMemorySize` counts every compressed (KTX2) texture as
 * 1 byte; the material library supplies the real resident bytes.
 */
export function copyInfo(info: InfoLike, s: MutableRenderStats, compressedBytes = 0): void {
  s.drawCalls = info.render.drawCalls;
  s.triangles = info.render.triangles;
  s.textures = info.memory.textures;
  s.textureBytes = info.memory.texturesSize + compressedBytes;
  s.geometries = info.memory.geometries;
  s.programs = info.memory.programs;
  s.renderTargets = info.memory.renderTargets;
}

/**
 * §50.2.3 `BudgetCounts` for the frame that most recently completed. `compressedBytes` corrects
 * `texturesSize` for KTX2 textures, which three 0.186's `Info` counts as 1 byte each (see `copyInfo`).
 */
export function readBudgetCounts(info: InfoLike, materials: number, shadowLights: number, nonShadowLights: number, compressedBytes = 0): BudgetCounts {
  return {
    drawCalls: info.render.drawCalls,
    triangles: info.render.triangles,
    texturesSize: info.memory.texturesSize + compressedBytes,
    textures: info.memory.textures,
    geometries: info.memory.geometries,
    programs: info.memory.programs,
    renderTargets: info.memory.renderTargets,
    attributes: info.memory.attributes,
    attributesSize: info.memory.attributesSize,
    materials,
    shadowLights,
    nonShadowLights,
  };
}

/**
 * §50.2.2 count caps (as amended 2026-09-25), for the harness and the sandbox overlay. Render targets ≤ 41 = 29
 * post/IBL + 4 CSM cascades + ≤ 8 local shadow casters (§10.10.2); programs ≤ 128 = the step-8 baseline + the zone's
 * light-set variants with ≈ 20 % headroom. `tools/asset-audit/src/caps.ts` carries the same numbers.
 */
export const COUNT_CAPS = Object.freeze({
  drawCalls: 400, triangles: 2_500_000, texturesSize: 734_003_200, materials: 48,
  shadowLights: 8, nonShadowLights: 24, renderTargets: 41, programs: 128,
});

export type CapViolation = { readonly metric: keyof typeof COUNT_CAPS; readonly value: number; readonly cap: number };

export function capViolations(c: BudgetCounts): CapViolation[] {
  const out: CapViolation[] = [];
  for (const k of Object.keys(COUNT_CAPS) as (keyof typeof COUNT_CAPS)[]) {
    const v = c[k];
    if (v > COUNT_CAPS[k]) out.push({ metric: k, value: v, cap: COUNT_CAPS[k] });
  }
  return out;
}

// ---- GPU timestamps ----------------------------------------------------------------------------------------

/** Step (7) of `frame()`: one `resolveTimestampsAsync(TimestampQuery.RENDER)` in flight at a time. */
export class TimestampResolver {
  private inFlight = false;
  private readonly onResolved = (ms: number | undefined): void => { this.inFlight = false; this.target.gpuMs = ms ?? null; this.afterResolve?.(); };
  private readonly onFailed = (): void => { this.inFlight = false; };

  /** `afterResolve` runs after every resolve (the per-pass timer reads the pool's per-context durations there). */
  constructor(private readonly gpu: WebGPURenderer, private readonly enabled: boolean, private readonly target: MutableRenderStats, private readonly afterResolve?: () => void) {}

  poll(): void {
    if (!this.enabled || this.inFlight) return;
    this.inFlight = true;
    this.gpu.resolveTimestampsAsync(TimestampQuery.RENDER).then(this.onResolved, this.onFailed);
  }

  /** `BudgetProbe.gpuFrameMs()`: `undefined` without timestamp-query. */
  async resolveNow(): Promise<number | undefined> {
    if (!this.enabled) return undefined;
    const ms = await this.gpu.resolveTimestampsAsync(TimestampQuery.RENDER);
    this.target.gpuMs = ms ?? null;
    this.afterResolve?.();
    return ms;
  }
}

// ---- per-context GPU time → §50.2.1 rows (IMPLEMENTATION-NOTES Part 4, H6) ----------------------------------------

/** The §50.2.1 row of one render call from its render target (null = not attributable → counted into `opaque`). */
export type PassClassifier = (renderTarget: RenderTarget | null, scene: Object3D, camera: Camera) => BudgetPass | null;

/** What `PassTimer` reads from three's render timestamp pool after a resolve (typed structurally for tests). */
export interface TimestampPoolLike { readonly timestamps: ReadonlyMap<string, number>; readonly frames: readonly number[] }

/** One timed render context of the last resolved frame (sandbox / harness cross-check, §50.2.3). */
export interface TimedContext { readonly uid: string; readonly pass: BudgetPass; readonly ms: number; readonly target: string }

/**
 * Sums the per-context durations of the LAST frame in `pool` by row into `out`: every row that rendered gets its sum,
 * every other row 0 (a pass that is off costs 0), `sprites` stays null (billboards, decals and VFX render inside
 * the one scene pass — §10.8.1 — so their GPU time is part of `opaque`; only the differential procedure splits
 * them). Returns the timed contexts, or null when the pool holds no frame.
 */
export function aggregatePassMs(pool: TimestampPoolLike, uidPass: ReadonlyMap<string, { readonly pass: BudgetPass; readonly target: string }>, out: Record<BudgetPass, number | null>): TimedContext[] | null {
  if (pool.frames.length === 0) return null;
  let last = pool.frames[0]!;
  for (const f of pool.frames) if (f > last) last = f;
  const suffix = `:f${last}`;
  for (const p of BUDGET_PASSES) out[p] = p === 'sprites' ? null : 0;
  const rows: TimedContext[] = [];
  for (const [uid, ms] of pool.timestamps) {
    if (!uid.endsWith(suffix)) continue;
    const c = uidPass.get(uid);
    const pass = c?.pass ?? 'opaque';
    out[pass] = (out[pass] ?? 0) + ms;
    rows.push({ uid, pass, ms, target: c?.target ?? '?' });
  }
  return rows;
}

/**
 * `renderer.inspector` that records which §50.2.1 row every render context belongs to (`beginRender(uid, scene,
 * camera, renderTarget)` is called by three 0.186 for every `render()` with the same uid the timestamp pool keys its
 * durations by — `Renderer.js` line 1751, `Backend.updateTimeStampUID`). After each `resolveTimestampsAsync` the
 * host calls `collect`, which fills `RenderStats.passMs` from the pool's per-context durations. Installed only when
 * the renderer tracks timestamps (harness / sandbox); it allocates one map entry per render call.
 */
export class PassTimer extends InspectorBase {
  private readonly uidPass = new Map<string, { pass: BudgetPass; target: string }>();
  last: TimedContext[] = [];

  constructor(private readonly classify: PassClassifier) { super(); }

  override beginRender(uid: string, scene: Object3D, camera: Camera, renderTarget: RenderTarget | null): void {
    if (this.uidPass.size > 16384) this.uidPass.clear();      // no resolve for a long time: drop stale uids
    const pass = this.classify(renderTarget, scene, camera) ?? 'opaque';
    this.uidPass.set(uid, { pass, target: renderTarget === null ? 'canvas' : renderTarget.texture?.name || `rt${renderTarget.width}x${renderTarget.height}` });
  }

  /** Reads the resolved pool into `out`; forgets the uids of the resolved batch. False when nothing was resolved. */
  collect(pool: TimestampPoolLike | null | undefined, out: Record<BudgetPass, number | null>): boolean {
    if (!pool) return false;
    const rows = aggregatePassMs(pool, this.uidPass, out);
    for (const uid of pool.timestamps.keys()) this.uidPass.delete(uid);
    if (rows === null) return false;
    this.last = rows;
    return true;
  }
}

// ---- differential per-pass timing (§50.2.3) ----------------------------------------------------------------

export function median(xs: readonly number[]): number {
  if (xs.length === 0) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function percentile(xs: readonly number[], p: number): number {
  if (xs.length === 0) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[i]!;
}

/**
 * `pass_ms(p) = T_all − T_without_p` for every measured pass; `opaque` = `T_all − Σ others − simMs`
 * (measured last, as the remainder). Negative differences (noise) clamp to 0. Missing entries → null.
 */
export function computePassMs(tAll: number, withoutMs: Partial<Record<BudgetPass, number>>, simMs: number): Record<BudgetPass, number | null> {
  const out = {} as Record<BudgetPass, number | null>;
  let sum = 0;
  for (const p of BUDGET_PASSES) {
    if (p === 'opaque') continue;
    const w = withoutMs[p];
    if (w === undefined || !Number.isFinite(w)) { out[p] = null; continue; }
    const d = Math.max(0, tAll - w);
    out[p] = d;
    sum += d;
  }
  out.opaque = Number.isFinite(tAll) ? Math.max(0, tAll - sum - simMs) : null;
  return out;
}

// ---- lights & materials under a root ---------------------------------------------------------------------

const DEBUG_MASK = 1 << LAYERS.debug;

export interface LightCountsOut { shadow: number; nonShadow: number }

/** Point/Spot lights under `root` by `castShadow` (§50.2.2), debug layer excluded. Writes into `out`. */
export function countPunctualLights(root: Object3D, out: LightCountsOut): LightCountsOut {
  out.shadow = 0; out.nonShadow = 0;
  const visit = (o: Object3D): void => {
    if ((o.layers.mask & DEBUG_MASK) !== 0) return;
    if (o instanceof PointLight || o instanceof SpotLight) { if (o.castShadow) out.shadow++; else out.nonShadow++; }
    for (const c of o.children) visit(c);
  };
  visit(root);
  return out;
}

// ---- the zone dump (§10.10.1 types + the §40.5.2 "the dump gains" fields) ------------------------------------

export type DumpMaterialClass = MaterialClass | 'billboard' | 'impostor' | 'decal' | 'character' | 'water';

/** three `Side`: FrontSide 0, BackSide 1, DoubleSide 2. */
export type DumpSide = 0 | 1 | 2;
/** Scatter LOD tier: 0/1/2 = LOD0–2, 3 = impostor (§10.5.7). */
export type DumpScatterTier = 0 | 1 | 2 | 3;

/**
 * §10.10.1 `ZoneDump`, verbatim, plus the fields §40.5.2 says "the dump gains" (IMPLEMENTATION-NOTES Part 4, H2):
 * `materials[].side`, `geometries[].sharedBy / kind / tier / instancedMesh`, and `lightSources[]` (the second
 * direction of `lights.housing`, §50.4.6). `tools/asset-audit/src/zone-dump.ts` mirrors it field for field.
 */
export interface ZoneDump {
  readonly zone: string; readonly harvestLevel: HarvestLevel;
  readonly materials: readonly { readonly uuid: string; readonly cls: MaterialClass | 'billboard' | 'impostor' | 'decal' | 'character' | 'water'; readonly surface: SurfaceId | null; readonly maps: { readonly albedo: boolean; readonly orm: boolean; readonly normal: boolean }; readonly ktx2: boolean; readonly side: DumpSide }[];
  readonly geometries: readonly {
    readonly uuid: string; readonly type: string; readonly parameters: Readonly<Record<string, number>> | null; readonly triangles: number; readonly instanced: number;
    /** Meshes under the root drawing this geometry. */
    readonly sharedBy: number;
    /** The scatter kind (`tree_oak`, `tall_grass`, …) of a scatter geometry; null otherwise. */
    readonly kind: string | null;
    /** The LOD tier of a scatter geometry (3 = impostor); absent otherwise. A geometry drawn at two tiers has one row per tier. */
    readonly tier?: DumpScatterTier;
    /** True when an `InstancedMesh` draws it (`instanced` is 1 for a plain mesh too). */
    readonly instancedMesh: boolean;
  }[];
  readonly lights: readonly { readonly id: string; readonly type: 'PointLight' | 'SpotLight'; readonly castShadow: boolean; readonly position: readonly [number, number, number]; readonly housingDistance: number }[];
  readonly sprites: readonly { readonly atlas: string; readonly magFilter: number; readonly anisotropy: number }[];
  readonly counts: BudgetCounts;
  readonly shadowDrawCalls: number;
  readonly culledChunks: number;              // scatter chunks outside the frustum this frame (legacy-render-audit Q19: the cull rate is reported, not assumed) — reconciled 2026-09-18
  readonly lightIds: readonly string[];       // LightSource ids present, sorted; pillars.spec.ts compares it before and during a battle (Pillar 7)
  /** Every `lightSource`-tagged emissive (light housings) and the distance to its nearest light (+Infinity = none). */
  readonly lightSources: readonly { readonly id: string; readonly lightDistance: number }[];
}

/**
 * A light housing's glowing part, tagged by its builder: an AABB in the local frame of the object whose
 * `userData[HOUSINGS_KEY]` carries it (transformed by that object's `matrixWorld`). The zone builder tags every
 * generated housing; a mesh whose material has `userData.lightSource === true` (the arena beacons) is tagged whole.
 */
export interface HousingTag { readonly id: string; readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number] }
export const HOUSINGS_KEY = 'ewaHousings';

export interface DumpInput {
  readonly zone: string;
  readonly harvestLevel: HarvestLevel;
  readonly root: Object3D;
  readonly library: MaterialLibrary;
  readonly counts: BudgetCounts;
  readonly culledChunks?: number;
  /** Cascades rendered by the sun (4). */
  readonly cascades?: number;
  /**
   * Where else to look for creature billboards (their pool lives outside the zone root; H2): `sprites[]` rows for
   * every billboard material found under it. `materials[]` stays the zone root's set (what `counts.materials` counts).
   */
  readonly spriteScan?: Object3D;
}

function numericParams(g: BufferGeometry): Record<string, number> | null {
  const p = (g as BufferGeometry & { parameters?: Record<string, unknown> }).parameters;
  if (!p) return null;
  const out: Record<string, number> = {};
  for (const k of Object.keys(p).sort()) { const v = p[k]; if (typeof v === 'number') out[k] = v; }
  return out;
}

function triangleCount(g: BufferGeometry): number {
  if (g.index) return Math.floor(g.index.count / 3);
  const pos = g.getAttribute('position');
  return pos ? Math.floor(pos.count / 3) : 0;
}

type MapsOf = Material & { map?: Texture | null; aoMap?: Texture | null; roughnessMap?: Texture | null; metalnessMap?: Texture | null; normalMap?: Texture | null };

/**
 * The albedo texture of a material: billboards publish theirs as `userData.ewaAlbedo` and keep `map` null
 * (IMPLEMENTATION-NOTES P7: three's shadow pass would multiply by `map.a` at the raw atlas uv).
 */
function albedoOf(m: Material): Texture | null {
  return (m.userData?.ewaAlbedo as Texture | undefined) ?? (m as MapsOf).map ?? null;
}

/** Classifies a material: library bookkeeping first, then `userData.ewaClass` set by other subsystems. */
function classify(m: Material, lib: MaterialLibrary): { cls: DumpMaterialClass; surface: SurfaceId | null; maps: { albedo: boolean; orm: boolean; normal: boolean }; ktx2: boolean } {
  const info = lib.describe(m);
  if (info) return { cls: info.cls, surface: info.surface, maps: info.maps, ktx2: info.ktx2 };
  const any = m as MapsOf;
  const cls = (m.userData?.ewaClass as DumpMaterialClass | undefined) ?? 'standard';
  const albedo = albedoOf(m);
  const orm = !!any.aoMap && any.aoMap === any.roughnessMap && any.aoMap === any.metalnessMap;
  const ktx2 = !!albedo && (albedo as Texture & { isCompressedTexture?: boolean }).isCompressedTexture === true;
  return { cls, surface: null, maps: { albedo: !!albedo, orm, normal: !!any.normalMap }, ktx2 };
}

const _v = new Vector3();
const _c = new Vector3();

/** Grid cell (m) that joins emissive triangles into one glowing part: vertices in one cell belong together. */
export const EMISSIVE_JOIN_M = 0.25;

/**
 * World AABBs of the connected glowing parts of `mesh`'s emissive groups (`isEmissive(materialIndex)`): triangles
 * with a vertex in a common 25 cm grid cell are one part (union-find), so a merged chunk mesh holding ten lantern
 * panes yields ten boxes instead of one chunk-sized box.
 */
function emissiveParts(mesh: Mesh, isEmissive: (materialIndex: number) => boolean): Box3[] {
  const g = mesh.geometry as BufferGeometry;
  const pos = g.getAttribute('position');
  if (!pos) return [];
  const idx = g.getIndex();
  const total = idx ? idx.count : pos.count;
  const ranges = g.groups.length > 0 ? g.groups.map((gr) => ({ start: gr.start, count: gr.count, mi: gr.materialIndex ?? 0 })) : [{ start: 0, count: total, mi: 0 }];
  const tris: number[] = [];
  for (const r of ranges) {
    if (!isEmissive(r.mi)) continue;
    const end = Math.min(total, r.start + r.count);
    for (let t = r.start; t + 2 < end; t += 3) tris.push(t);
  }
  if (tris.length === 0) return [];
  const parent = tris.map((_, k) => k);
  const find = (k: number): number => { let r = k; while (parent[r] !== r) { parent[r] = parent[parent[r]!]!; r = parent[r]!; } return r; };
  const cellOwner = new Map<string, number>();
  const vert = (t: number, k: number): number => (idx ? idx.getX(t + k) : t + k);
  tris.forEach((t, k) => {
    for (let c = 0; c < 3; c++) {
      const v = vert(t, c);
      const key = `${Math.floor(pos.getX(v) / EMISSIVE_JOIN_M)},${Math.floor(pos.getY(v) / EMISSIVE_JOIN_M)},${Math.floor(pos.getZ(v) / EMISSIVE_JOIN_M)}`;
      const o = cellOwner.get(key);
      if (o === undefined) cellOwner.set(key, k);
      else { const a = find(o); const b = find(k); if (a !== b) parent[b] = a; }
    }
  });
  const boxes = new Map<number, Box3>();
  tris.forEach((t, k) => {
    const root = find(k);
    let b = boxes.get(root);
    if (b === undefined) { b = new Box3(); boxes.set(root, b); }
    for (let c = 0; c < 3; c++) b.expandByPoint(_v.fromBufferAttribute(pos, vert(t, c)));
  });
  return [...boxes.values()].map((b) => b.applyMatrix4(mesh.matrixWorld));
}

function tagBox(o: Object3D, t: HousingTag): Box3 {
  return new Box3(new Vector3(...t.min), new Vector3(...t.max)).applyMatrix4(o.matrixWorld);
}

/** Walks `root` into a `ZoneDump` (allocates freely: an audit call, not a per-frame one). */
export function dumpZone(i: DumpInput): ZoneDump {
  const materials: Mutable<ZoneDump['materials'][number]>[] = [];
  const geometryRows = new Map<string, Mutable<ZoneDump['geometries'][number]>>();
  const meshesPerGeometry = new Map<string, number>();
  const sprites: Mutable<ZoneDump['sprites'][number]>[] = [];
  const lights: (PointLight | SpotLight)[] = [];
  const glowing: Box3[] = [];                                // every emissive part (the light → housing direction)
  const tagged: { id: string; box: Box3 }[] = [];             // lightSource-tagged housings (the housing → light direction)
  const casters: Mesh[] = [];
  const seenM = new Map<string, DumpMaterialClass>();

  i.root.updateMatrixWorld(true);
  const visit = (o: Object3D): void => {
    if ((o.layers.mask & DEBUG_MASK) !== 0) return;
    if (o instanceof PointLight || o instanceof SpotLight) lights.push(o);
    const tags = o.userData?.[HOUSINGS_KEY] as readonly HousingTag[] | undefined;
    if (Array.isArray(tags)) for (const t of tags) tagged.push({ id: t.id, box: tagBox(o, t) });
    if (o instanceof Mesh) {
      const mats: Material[] = Array.isArray(o.material) ? o.material : [o.material];
      const emissive: boolean[] = [];
      let lightSource = false;
      for (const m of mats) {
        let cls = seenM.get(m.uuid);
        if (cls === undefined) {
          const c = classify(m, i.library);
          cls = c.cls;
          seenM.set(m.uuid, cls);
          materials.push({ uuid: m.uuid, cls: c.cls, surface: c.surface, maps: c.maps, ktx2: c.ktx2, side: m.side as DumpSide });
          if (c.cls === 'billboard') {
            const map = albedoOf(m);
            sprites.push({ atlas: String(m.userData?.ewaAtlas ?? ''), magFilter: map?.magFilter ?? -1, anisotropy: map?.anisotropy ?? -1 });
          }
        }
        emissive.push(cls === 'emissive' || m.userData?.ewaHousing === true);
        if (m.userData?.lightSource === true) lightSource = true;
      }
      if (emissive.some(Boolean)) {
        const multi = Array.isArray(o.material);
        const parts = emissiveParts(o, (mi) => emissive[multi ? mi : 0] === true);
        for (const b of parts) glowing.push(b);
        if (lightSource && parts.length > 0) {
          const whole = new Box3();
          for (const b of parts) whole.union(b);
          tagged.push({ id: o.name || o.uuid, box: whole });
        }
      }
      const g = o.geometry as BufferGeometry;
      meshesPerGeometry.set(g.uuid, (meshesPerGeometry.get(g.uuid) ?? 0) + 1);
      const isInst = (o as Mesh & { isInstancedMesh?: boolean }).isInstancedMesh === true;
      const kind = typeof o.userData?.ewaScatterKind === 'string' ? o.userData.ewaScatterKind as string : null;
      const tier = kind !== null && typeof o.userData?.ewaScatterTier === 'number' ? o.userData.ewaScatterTier as DumpScatterTier : undefined;
      const key = tier === undefined ? g.uuid : `${g.uuid}:t${tier}`;
      if (!geometryRows.has(key)) {
        geometryRows.set(key, {
          uuid: g.uuid, type: g.type, parameters: numericParams(g), triangles: triangleCount(g),
          instanced: isInst ? (o as unknown as InstancedMesh).count : 1,
          sharedBy: 0, kind, ...(tier === undefined ? {} : { tier }), instancedMesh: isInst,
        });
      }
      if (o.castShadow && o.visible) casters.push(o);
    }
    for (const c of o.children) visit(c);
  };
  visit(i.root);
  if (i.spriteScan) {
    const seenSprite = new Set<string>(materials.filter((m) => m.cls === 'billboard').map((m) => m.uuid));
    i.spriteScan.traverse((o) => {
      const mat = (o as Mesh).material as Material | Material[] | undefined;
      if (mat === undefined) return;
      for (const m of Array.isArray(mat) ? mat : [mat]) {
        if (seenSprite.has(m.uuid) || m.userData?.ewaClass !== 'billboard') continue;
        seenSprite.add(m.uuid);
        const map = albedoOf(m);
        sprites.push({ atlas: String(m.userData?.ewaAtlas ?? ''), magFilter: map?.magFilter ?? -1, anisotropy: map?.anisotropy ?? -1 });
      }
    });
  }
  const geometries = [...geometryRows.values()];
  for (const row of geometries) row.sharedBy = meshesPerGeometry.get(row.uuid) ?? 0;

  const lightPositions = lights.map((l) => l.getWorldPosition(new Vector3()));
  const housingDistance = (p: Vector3): number => {
    let best = Number.POSITIVE_INFINITY;
    for (const b of glowing) best = Math.min(best, b.distanceToPoint(p));
    for (const t of tagged) best = Math.min(best, t.box.distanceToPoint(p));
    return best;
  };

  const lightRows = lights.map((l, k) => {
    const p = lightPositions[k]!;
    return {
      id: String(l.userData?.ewaLightId ?? l.name),
      type: (l instanceof SpotLight ? 'SpotLight' : 'PointLight') as 'PointLight' | 'SpotLight',
      castShadow: l.castShadow,
      position: [p.x, p.y, p.z] as const,
      housingDistance: housingDistance(p),
    };
  });

  const lightSources = tagged.map((t) => {
    let best = Number.POSITIVE_INFINITY;
    for (const p of lightPositions) best = Math.min(best, t.box.distanceToPoint(p));
    return { id: t.id, lightDistance: best };
  }).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // Upper-bound estimate: every visible caster in every sun cascade, plus per local caster its passes
  // (spot 1, point 6) over casters within its range. The ≤ 564 audit rule is an upper-bound check.
  const cascades = i.cascades ?? 4;
  let shadowDrawCalls = casters.length * cascades;
  lights.forEach((l, k) => {
    if (!l.castShadow) return;
    const p = lightPositions[k]!;
    const range = l.distance > 0 ? l.distance : Number.POSITIVE_INFINITY;
    let n = 0;
    for (const c of casters) { c.getWorldPosition(_c); if (_c.distanceTo(p) <= range) n++; }
    shadowDrawCalls += n * (l instanceof PointLight ? 6 : 1);
  });

  return {
    zone: i.zone,
    harvestLevel: i.harvestLevel,
    materials,
    geometries,
    lights: lightRows,
    sprites,
    counts: i.counts,
    shadowDrawCalls,
    culledChunks: i.culledChunks ?? 0,
    lightIds: lightRows.map((l) => l.id).sort(),
    lightSources,
  };
}
