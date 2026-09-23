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
import { Box3, Mesh, PointLight, SpotLight, TimestampQuery, Vector3 } from 'three/webgpu';
import type { BufferGeometry, InstancedMesh, Material, Object3D, Texture, WebGPURenderer } from 'three/webgpu';
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

/** §50.2.2 count caps, for the harness and the sandbox overlay. */
export const COUNT_CAPS = Object.freeze({
  drawCalls: 400, triangles: 2_500_000, texturesSize: 734_003_200, materials: 48,
  shadowLights: 8, nonShadowLights: 24, renderTargets: 24, programs: 96,
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
  private readonly onResolved = (ms: number | undefined): void => { this.inFlight = false; this.target.gpuMs = ms ?? null; };
  private readonly onFailed = (): void => { this.inFlight = false; };

  constructor(private readonly gpu: WebGPURenderer, private readonly enabled: boolean, private readonly target: MutableRenderStats) {}

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
    return ms;
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

// ---- the zone dump (§10.10.1, verbatim types) -------------------------------------------------------------

export type DumpMaterialClass = MaterialClass | 'billboard' | 'impostor' | 'decal' | 'character' | 'water';

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

export interface DumpInput {
  readonly zone: string;
  readonly harvestLevel: HarvestLevel;
  readonly root: Object3D;
  readonly library: MaterialLibrary;
  readonly counts: BudgetCounts;
  readonly culledChunks?: number;
  /** Cascades rendered by the sun (4). */
  readonly cascades?: number;
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

/** Classifies a material: library bookkeeping first, then `userData.ewaClass` set by other subsystems. */
function classify(m: Material, lib: MaterialLibrary): { cls: DumpMaterialClass; surface: SurfaceId | null; maps: { albedo: boolean; orm: boolean; normal: boolean }; ktx2: boolean } {
  const info = lib.describe(m);
  if (info) return { cls: info.cls, surface: info.surface, maps: info.maps, ktx2: info.ktx2 };
  const any = m as Material & { map?: Texture | null; aoMap?: Texture | null; roughnessMap?: Texture | null; metalnessMap?: Texture | null; normalMap?: Texture | null };
  const cls = (m.userData?.ewaClass as DumpMaterialClass | undefined) ?? 'standard';
  const orm = !!any.aoMap && any.aoMap === any.roughnessMap && any.aoMap === any.metalnessMap;
  const ktx2 = !!any.map && (any.map as Texture & { isCompressedTexture?: boolean }).isCompressedTexture === true;
  return { cls, surface: null, maps: { albedo: !!any.map, orm, normal: !!any.normalMap }, ktx2 };
}

const _box = new Box3();
const _p = new Vector3();

/** Walks `root` into a `ZoneDump` (allocates freely: an audit call, not a per-frame one). */
export function dumpZone(i: DumpInput): ZoneDump {
  const materials: Mutable<ZoneDump['materials'][number]>[] = [];
  const geometries: Mutable<ZoneDump['geometries'][number]>[] = [];
  const sprites: Mutable<ZoneDump['sprites'][number]>[] = [];
  const lights: (PointLight | SpotLight)[] = [];
  const housings: Mesh[] = [];
  const casters: Mesh[] = [];
  const seenM = new Set<string>();
  const seenG = new Set<string>();

  i.root.updateMatrixWorld(true);
  const visit = (o: Object3D): void => {
    if ((o.layers.mask & DEBUG_MASK) !== 0) return;
    if (o instanceof PointLight || o instanceof SpotLight) lights.push(o);
    if (o instanceof Mesh) {
      const mats: Material[] = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        const c = classify(m, i.library);
        if (c.cls === 'emissive' || m.userData?.ewaHousing === true) housings.push(o);
        if (!seenM.has(m.uuid)) {
          seenM.add(m.uuid);
          materials.push({ uuid: m.uuid, cls: c.cls, surface: c.surface, maps: c.maps, ktx2: c.ktx2 });
          if (c.cls === 'billboard') {
            const map = (m as Material & { map?: Texture | null }).map;
            sprites.push({ atlas: String(m.userData?.ewaAtlas ?? ''), magFilter: map?.magFilter ?? -1, anisotropy: map?.anisotropy ?? -1 });
          }
        }
      }
      const g = o.geometry as BufferGeometry;
      if (!seenG.has(g.uuid)) {
        seenG.add(g.uuid);
        const inst = (o as Mesh & { isInstancedMesh?: boolean }).isInstancedMesh ? (o as unknown as InstancedMesh).count : 1;
        geometries.push({ uuid: g.uuid, type: g.type, parameters: numericParams(g), triangles: triangleCount(g), instanced: inst });
      }
      if (o.castShadow && o.visible) casters.push(o);
    }
    for (const c of o.children) visit(c);
  };
  visit(i.root);

  const housingDistance = (l: PointLight | SpotLight): number => {
    l.getWorldPosition(_p);
    let best = Number.POSITIVE_INFINITY;
    for (const h of housings) {
      const g = h.geometry as BufferGeometry;
      if (!g.boundingBox) g.computeBoundingBox();
      if (!g.boundingBox) continue;
      _box.copy(g.boundingBox).applyMatrix4(h.matrixWorld);
      best = Math.min(best, _box.distanceToPoint(_p));
    }
    return best;
  };

  const lightRows = lights.map((l) => {
    l.getWorldPosition(_p);
    return {
      id: String(l.userData?.ewaLightId ?? l.name),
      type: (l instanceof SpotLight ? 'SpotLight' : 'PointLight') as 'PointLight' | 'SpotLight',
      castShadow: l.castShadow,
      position: [_p.x, _p.y, _p.z] as const,
      housingDistance: housingDistance(l),
    };
  });

  // Upper-bound estimate: every visible caster in every sun cascade, plus per local caster its passes
  // (spot 1, point 6) over casters within its range. The ≤ 564 audit rule is an upper-bound check.
  const cascades = i.cascades ?? 4;
  let shadowDrawCalls = casters.length * cascades;
  for (const l of lights) {
    if (!l.castShadow) continue;
    l.getWorldPosition(_p);
    const range = l.distance > 0 ? l.distance : Number.POSITIVE_INFINITY;
    let n = 0;
    for (const c of casters) { c.getWorldPosition(_box.min); if (_box.min.distanceTo(_p) <= range) n++; }
    shadowDrawCalls += n * (l instanceof PointLight ? 6 : 1);
  }

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
  };
}
