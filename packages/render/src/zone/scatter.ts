/**
 * SPEC §10.5.7 — scatter, chunked into 32 m cells (the AOI cell), LOD per chunk (0–40 / 40–90 / 90–160 / > 160 m
 * from the chunk centre to the camera, 4 m hysteresis), per-instance tint through `instanceColor`.
 *
 * Realisation (IMPLEMENTATION-NOTES Part 2, C21 — three 0.186 facts): an `InstancedMesh` with ≤ 1024 instances
 * keeps its matrices in a uniform array whose WGSL name carries a per-build uniform id, so EVERY such mesh
 * compiles its own vertex program (measured: 175 programs for one town, cap 96); above 1024 three switches to a
 * count- and identity-free instanced attribute. Per-(kind, chunk, tier) meshes are therefore replaced by ONE
 * `InstancedMesh` per (kind, tier, alpha class) for the whole zone, sized ≥ 1025, whose instance buffer is
 * rewritten from the chunks' slices whenever a chunk changes tier or enters / leaves the camera frustum (padded
 * by the shadow reach). The chunk still decides the tier of its instances; nothing is allocated after the build —
 * the tier buffers are preallocated and only copied into (plus one partial upload). Draw calls no longer scale
 * with the number of chunks: one draw per kind × tier × class present.
 */
import { Box3, Color, Frustum, InstancedMesh, Matrix4, Quaternion, Sphere, StaticDrawUsage, Vector3 } from 'three/webgpu';
import type { BufferGeometry, Camera, Material , Object3D} from 'three/webgpu';
import { LAYERS } from '../descriptors.js';
import { chooseTier, chunkCentre, chunkOf, type ChunkGrid, type Tier } from './lod.js';
import { hash2 } from './prng.js';
import { CARD_RENDER_ORDER } from './split.js';

/** One scatter instance (world placement + tint). */
export interface Instance { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly scale: number; readonly tint: number }

/** One alpha class of a tier geometry (see split.ts). */
export interface TierPart { readonly geometry: BufferGeometry; readonly cls: 0 | 1; readonly casts: boolean }

/** A scatter kind: its tier geometries split by alpha class (null = not drawn at that tier) and per-group materials. */
export interface ScatterKind {
  readonly name: string;
  readonly tiers: readonly [readonly TierPart[] | null, readonly TierPart[] | null, readonly TierPart[] | null, readonly TierPart[] | null];
  readonly materials: readonly Material[];
  readonly castShadow: boolean;
  /** Tiers ≥ this do not cast shadows. */
  readonly shadowTierLimit: number;
  /**
   * Which parts carry the per-instance tint: 'cards' (foliage, the default) or 'all' (flower petals). A tinted
   * instanced mesh compiles its own fragment variant (the `vInstanceColor` varying), so bark, rock and wood stay
   * untinted and share the plain meshes' fragment programs (IMPLEMENTATION-NOTES Part 2, C21).
   */
  readonly tint?: 'cards' | 'all' | 'none';
}

/** Everything that belongs to one 32 m chunk. */
export interface ChunkRec {
  readonly index: number;
  readonly centre: Vector3;
  tier: Tier;
  /** Inside the camera frustum padded by the shadow reach. */
  active: boolean;
  /** Objects shown only at a tier (merged static props). */
  readonly byTier: [Object3D[], Object3D[], Object3D[], Object3D[]];
  /** Objects visible at every tier (terrain). */
  readonly always: Object3D[];
}

/** Horizontal padding of a chunk's box for the activity test: shadows of things outside the view still land in it. */
export const SHADOW_REACH_M = 16;

const _frustum = new Frustum();
const _vp = new Matrix4();
const _box = new Box3();

export class ChunkSet {
  readonly chunks = new Map<number, ChunkRec>();
  private readonly list: ChunkRec[] = [];
  /** Bumped whenever any chunk's tier or activity changed (scatter buffers rebuild on change). */
  generation = 0;
  constructor(readonly grid: ChunkGrid) {}

  get(index: number, y = 0): ChunkRec {
    let c = this.chunks.get(index);
    if (c === undefined) {
      const [x, z] = chunkCentre(this.grid, index);
      c = { index, centre: new Vector3(x, y, z), tier: 0, active: true, byTier: [[], [], [], []], always: [] };
      this.chunks.set(index, c);
      this.list.push(c);
    }
    return c;
  }

  at(x: number, z: number): ChunkRec { return this.get(chunkOf(this.grid, x, z)); }

  /** Per-frame tier + activity update. Zero allocation. Returns the number of chunks at the impostor tier. */
  update(cameraPos: Vector3, camera: Camera | null): number {
    if (camera) _frustum.setFromProjectionMatrix(_vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const half = this.grid.cell / 2 + SHADOW_REACH_M;
    let far = 0; let changed = false;
    for (let i = 0; i < this.list.length; i++) {
      const c = this.list[i]!;
      const t = chooseTier(c.centre.distanceTo(cameraPos), c.tier);
      let active = true;
      if (camera) {
        _box.min.set(c.centre.x - half, c.centre.y - 6, c.centre.z - half);
        _box.max.set(c.centre.x + half, c.centre.y + 24, c.centre.z + half);
        active = _frustum.intersectsBox(_box);
      }
      if (t !== c.tier || active !== c.active) {
        changed = true;
        for (const o of c.byTier[c.tier]) o.visible = false;
        c.tier = t; c.active = active;
        for (const o of c.byTier[t]) o.visible = active;
      }
      if (t === 3) far++;
    }
    if (changed) this.generation++;
    return far;
  }

  /** Initial visibility (tier 0, active, until the first update). */
  initVisibility(): void {
    for (const c of this.list) for (let t = 0; t < 4; t++) for (const o of c.byTier[t]!) o.visible = t === c.tier && c.active;
    this.generation++;
  }

  records(): readonly ChunkRec[] { return this.list; }
}

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);
const _col = new Color();

/** three switches instancing to the count-free attribute path above 1024 instances (64 KB of mat4). */
export const MIN_INSTANCE_CAPACITY = 1025;

export function instanceCapacity(n: number): number { return Math.max(MIN_INSTANCE_CAPACITY, n); }

/** A kind's instances, sorted by chunk, and its zone-wide tier meshes. */
export class ScatterField {
  readonly meshes: InstancedMesh[] = [];
  private readonly matrices: Float32Array;
  private readonly colors: Float32Array;
  private readonly starts: number[] = [];
  private readonly counts: number[] = [];
  private readonly recs: ChunkRec[] = [];
  /** Per tier: the class meshes sharing one instance buffer (null when the kind has no geometry at that tier). */
  private readonly tierMeshes: (InstancedMesh[] | null)[] = [null, null, null, null];
  private readonly spheres = [new Sphere(), new Sphere(), new Sphere(), new Sphere()];
  private generation = -1;
  readonly total: number;

  constructor(readonly kind: ScatterKind, instances: readonly Instance[], chunks: ChunkSet, parent: Object3D, tints: readonly Color[]) {
    const byChunk = new Map<number, Instance[]>();
    for (const it of instances) {
      const k = chunkOf(chunks.grid, it.x, it.z);
      let a = byChunk.get(k);
      if (a === undefined) { a = []; byChunk.set(k, a); }
      a.push(it);
    }
    const n = instances.length;
    this.total = n;
    this.matrices = new Float32Array(n * 16);
    this.colors = new Float32Array(n * 3);
    let o = 0;
    for (const k of [...byChunk.keys()].sort((a, b) => a - b)) {
      const list = byChunk.get(k)!;
      this.starts.push(o); this.counts.push(list.length); this.recs.push(chunks.get(k));
      for (const it of list) {
        _q.setFromAxisAngle(_up, it.yaw);
        _m.compose(_p.set(it.x, it.y, it.z), _q, _s.set(it.scale, it.scale, it.scale));
        _m.toArray(this.matrices, o * 16);
        const c = tints[it.tint] ?? _col.set(1, 1, 1);
        this.colors[o * 3] = c.r; this.colors[o * 3 + 1] = c.g; this.colors[o * 3 + 2] = c.b;
        o++;
      }
    }
    const mats = kind.materials.length === 1 ? kind.materials[0]! : [...kind.materials];
    const cap = instanceCapacity(n);
    for (let t = 0; t < 4; t++) {
      const parts = kind.tiers[t];
      if (!parts || parts.length === 0) continue;
      const group: InstancedMesh[] = [];
      let matrixAttr: InstancedMesh['instanceMatrix'] | null = null;
      let colorAttr: InstancedMesh['instanceColor'] = null;
      const tint = kind.tint ?? 'cards';
      for (const part of parts) {
        if (part.geometry.getAttribute('position').count === 0) continue;
        const mesh = new InstancedMesh(part.geometry, mats, cap);
        mesh.name = `ewa:scatter:${kind.name}:t${t}:a${part.cls}`;
        // read by dumpZone (§40.5.2 `scatter.instanced`: the dump gains the scatter kind and LOD tier; 3 = impostor)
        mesh.userData = { ewaScatterKind: kind.name, ewaScatterTier: t };
        if (matrixAttr === null) { mesh.instanceMatrix.setUsage(StaticDrawUsage); matrixAttr = mesh.instanceMatrix; }
        else mesh.instanceMatrix = matrixAttr;                          // every class shares one instance buffer
        if (tint === 'all' || (tint === 'cards' && part.cls === 1)) {
          if (colorAttr === null) {
            mesh.setColorAt(0, _col.set(1, 1, 1));                      // creates instanceColor (capacity-sized)
            colorAttr = mesh.instanceColor!;
            colorAttr.setUsage(StaticDrawUsage);
          } else mesh.instanceColor = colorAttr;
        }
        mesh.count = 0;
        mesh.visible = false;
        mesh.renderOrder = part.cls === 1 ? CARD_RENDER_ORDER : 0;
        mesh.frustumCulled = true;
        mesh.boundingSphere = this.spheres[t]!;
        mesh.castShadow = kind.castShadow && part.casts && t < kind.shadowTierLimit;
        mesh.receiveShadow = true;
        mesh.layers.set(LAYERS.default);
        parent.add(mesh);
        group.push(mesh);
        this.meshes.push(mesh);
      }
      this.tierMeshes[t] = group.length > 0 ? group : null;
    }
  }

  /** Rewrites the tier buffers from the active chunks when the chunk set changed. Zero allocation. */
  sync(chunks: ChunkSet): void {
    if (chunks.generation === this.generation) return;
    this.generation = chunks.generation;
    for (let t = 0; t < 4; t++) {
      const group = this.tierMeshes[t];
      if (!group) continue;
      const head = group[0]!;
      const dstM = head.instanceMatrix.array as Float32Array;
      const colorAttr = group.find((m) => m.instanceColor !== null)?.instanceColor ?? null;
      const dstC = colorAttr ? colorAttr.array as Float32Array : null;
      const sphere = this.spheres[t]!;
      let k = 0;
      let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
      for (let c = 0; c < this.recs.length; c++) {
        const rec = this.recs[c]!;
        if (rec.tier !== t || !rec.active) continue;
        const s = this.starts[c]!; const n = this.counts[c]!;
        dstM.set(this.matrices.subarray(s * 16, (s + n) * 16), k * 16);
        if (dstC) dstC.set(this.colors.subarray(s * 3, (s + n) * 3), k * 3);
        k += n;
        const cx = rec.centre.x; const cz = rec.centre.z;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cz < minZ) minZ = cz;
        if (cz > maxZ) maxZ = cz;
      }
      if (k > 0) {
        const h = chunks.grid.cell * 0.75 + 10;
        sphere.center.set((minX + maxX) / 2, 4, (minZ + maxZ) / 2);
        sphere.radius = Math.hypot((maxX - minX) / 2 + h, 14, (maxZ - minZ) / 2 + h);
        head.instanceMatrix.clearUpdateRanges(); head.instanceMatrix.addUpdateRange(0, k * 16); head.instanceMatrix.needsUpdate = true;
        if (colorAttr) { colorAttr.clearUpdateRanges(); colorAttr.addUpdateRange(0, k * 3); colorAttr.needsUpdate = true; }
      }
      for (const m of group) { m.count = k; m.visible = k > 0; }
    }
  }

  /** Instance matrices in build order (for the geometry digest). */
  instanceData(): Float32Array { return this.matrices; }
}

// ---- deterministic point sets ------------------------------------------------------------------------------

/**
 * Jittered-grid points with density `density` (per m²) over [x0, x1] × [z0, z1]: one candidate per cell of edge
 * 1/√density, kept with probability `accept(x, z)` (0..1). Pure in (salt, bounds, density).
 */
export function jitteredPoints(x0: number, x1: number, z0: number, z1: number, density: number, salt: number, accept: (x: number, z: number, h: number) => number): { x: number; z: number; h: number }[] {
  const out: { x: number; z: number; h: number }[] = [];
  if (density <= 0) return out;
  const cell = 1 / Math.sqrt(density);
  const i0 = Math.floor(x0 / cell); const i1 = Math.ceil(x1 / cell);
  const j0 = Math.floor(z0 / cell); const j1 = Math.ceil(z1 / cell);
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      const x = (i + hash2(i, j, salt)) * cell;
      const z = (j + hash2(i, j, salt + 1)) * cell;
      if (x < x0 || x >= x1 || z < z0 || z >= z1) continue;
      const h = hash2(i, j, salt + 2);
      const a = accept(x, z, h);
      if (a <= 0 || h >= a) continue;
      out.push({ x, z, h: hash2(i, j, salt + 3) });
    }
  }
  return out;
}
