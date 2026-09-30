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

// ---- ground-cover masks (IMPLEMENTATION-NOTES Part 5, T1 / T3) -----------------------------------------------

/** Cover classes a mask disc can affect (bit set). */
export const COVER = Object.freeze({ ground: 1, small: 2, large: 4, tree: 8 });

/**
 * The cover class of a scatter kind by its builder name (`ScatterKind.name`, the dump's `ewaScatterKind`): grass
 * tufts, tall grass and flower patches are ground cover; big rocks are large; trees are trees; everything else
 * (small rocks and pebbles, bushes, stumps, logs) is small.
 */
export function coverClassOf(kind: string): number {
  if (kind.startsWith('tree')) return COVER.tree;
  if (kind === 'rock_a') return COVER.large;
  if (kind === 'grass_tuft' || kind === 'tall_grass' || kind === 'flower_patch') return COVER.ground;
  return COVER.small;
}

/** Mask discs per zone (arena slots + revealed creatures; see `stage/groundCover.ts`). */
export const SCATTER_MASK_SLOTS = 24;
/** A vertical factor at or below this hides the instance entirely (a zero matrix: nothing rasterises). */
export const MASK_HIDE_BELOW = 0.04;
/** Disc edits smaller than this (m, or factor) are ignored: a creature idling in place never rewrites a buffer. */
const MASK_EPS = 0.01;
const MASK_STRIDE = 5;

/**
 * Discs that flatten or hide scatter instances without rebuilding anything (IMPLEMENTATION-NOTES Part 5, T1): a
 * masked instance is written into its tier buffer with its vertical axis scaled by the disc's factor — `floor`
 * inside `inner`, easing back to 1 at `outer` — and a factor ≤ `MASK_HIDE_BELOW` writes a zero 3×3 (a degenerate
 * instance: nothing rasterises, in the beauty pass or the shadow maps). The source matrices, the meshes, the
 * materials, the programs and the zone graph are never touched; clearing a disc rewrites the original matrices.
 * Nothing is allocated. One mask per zone root (`scatterMaskFor`), read by every `ScatterField` of that root.
 */
export class ScatterMask {
  /** Bumped whenever a factor can have changed; fields re-apply on their next `sync`. */
  generation = 0;
  private readonly d = new Float32Array(SCATTER_MASK_SLOTS * MASK_STRIDE);   // x, z, inner, outer, floor
  private readonly cls = new Uint8Array(SCATTER_MASK_SLOTS);                 // 0 = free slot
  private used = 0;

  /**
   * Writes disc `slot`: scatter of the `classes` bit set within `outer` m of (x, z) is scaled vertically by `floor`
   * inside `inner`, easing (smoothstep) to 1 at `outer`; `floor` 0 hides. Unchanged values bump nothing.
   */
  set(slot: number, x: number, z: number, inner: number, outer: number, floor: number, classes: number): void {
    if (!(slot >= 0 && slot < SCATTER_MASK_SLOTS) || !Number.isFinite(x) || !Number.isFinite(z)) return;
    const o = slot * MASK_STRIDE; const d = this.d;
    const r0 = Math.max(0, inner); const r1 = Math.max(r0 + MASK_EPS, outer); const f = Math.min(1, Math.max(0, floor));
    const c = classes & 0xff;
    if (this.cls[slot] === c && Math.abs(d[o]! - x) < MASK_EPS && Math.abs(d[o + 1]! - z) < MASK_EPS && Math.abs(d[o + 2]! - r0) < MASK_EPS
      && Math.abs(d[o + 3]! - r1) < MASK_EPS && Math.abs(d[o + 4]! - f) < MASK_EPS) return;
    if (this.cls[slot] === 0 && c !== 0) this.used++;
    if (this.cls[slot] !== 0 && c === 0) this.used--;
    d[o] = x; d[o + 1] = z; d[o + 2] = r0; d[o + 3] = r1; d[o + 4] = f;
    this.cls[slot] = c;
    this.generation++;
  }

  clear(slot: number): void {
    if (!(slot >= 0 && slot < SCATTER_MASK_SLOTS) || this.cls[slot] === 0) return;
    this.cls[slot] = 0;
    this.used--;
    this.generation++;
  }

  clearAll(): void {
    if (this.used === 0) return;
    this.cls.fill(0);
    this.used = 0;
    this.generation++;
  }

  /** Discs in use. */
  get count(): number { return this.used; }
  isSet(slot: number): boolean { return slot >= 0 && slot < SCATTER_MASK_SLOTS && this.cls[slot] !== 0; }

  /** Vertical factor at (x, z) for an instance of class `cls` (1 = untouched): the smallest over the discs. */
  factor(x: number, z: number, cls: number): number {
    let f = 1;
    const d = this.d;
    for (let s = 0; s < SCATTER_MASK_SLOTS; s++) {
      if ((this.cls[s]! & cls) === 0) continue;
      const o = s * MASK_STRIDE;
      const dx = x - d[o]!; const dz = z - d[o + 1]!;
      const r2 = dx * dx + dz * dz; const outer = d[o + 3]!;
      if (r2 >= outer * outer) continue;
      const inner = d[o + 2]!; const floor = d[o + 4]!;
      let g = floor;
      const r = Math.sqrt(r2);
      if (r > inner) { const t = (r - inner) / (outer - inner); g = floor + (1 - floor) * t * t * (3 - 2 * t); }
      if (g < f) f = g;
    }
    return f;
  }

  /** Whether a disc of class `cls` reaches the rectangle [x0, x1] × [z0, z1]. */
  touches(x0: number, z0: number, x1: number, z1: number, cls: number): boolean {
    if (this.used === 0) return false;
    const d = this.d;
    for (let s = 0; s < SCATTER_MASK_SLOTS; s++) {
      if ((this.cls[s]! & cls) === 0) continue;
      const o = s * MASK_STRIDE;
      const cx = d[o]!; const cz = d[o + 1]!; const r = d[o + 3]!;
      const dx = cx < x0 ? x0 - cx : cx > x1 ? cx - x1 : 0;
      const dz = cz < z0 ? z0 - cz : cz > z1 ? cz - z1 : 0;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }
}

const MASKS = new WeakMap<Object3D, ScatterMask>();

/** The ground-cover mask of a zone root (created on first use; every `ScatterField` under that root reads it). */
export function scatterMaskFor(root: Object3D): ScatterMask {
  let m = MASKS.get(root);
  if (m === undefined) { m = new ScatterMask(); MASKS.set(root, m); }
  return m;
}

interface UpdateRange { start: number; count: number }

/** Adds [lo, hi) to an attribute's pending upload (one range, grown in place: nothing allocated after the first). */
function extendUpload(attr: InstancedMesh['instanceMatrix'], lo: number, hi: number, spare: UpdateRange): void {
  if (hi <= lo) return;
  const r = attr.updateRanges as UpdateRange[];
  if (r.length > 0) {
    const e = r[0]!;
    const end = Math.max(e.start + e.count, hi);
    e.start = Math.min(e.start, lo);
    e.count = end - e.start;
  } else {
    spare.start = lo; spare.count = hi - lo;
    r.push(spare);
  }
  attr.needsUpdate = true;
}

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
  /** The zone root's ground-cover mask and this kind's cover class (T1 / T3). */
  readonly mask: ScatterMask;
  readonly coverClass: number;
  private maskGeneration = -1;
  /** Per chunk slice: its first instance index in its current tier buffer (−1 = not written), whether it is masked. */
  private dstAt: Int32Array = new Int32Array(0);
  private masked: Uint8Array = new Uint8Array(0);
  private halfCell = 16;
  private readonly spare: UpdateRange[] = [{ start: 0, count: 0 }, { start: 0, count: 0 }, { start: 0, count: 0 }, { start: 0, count: 0 }];
  private readonly lo = new Float64Array(4);
  private readonly hi = new Float64Array(4);

  constructor(readonly kind: ScatterKind, instances: readonly Instance[], chunks: ChunkSet, parent: Object3D, tints: readonly Color[]) {
    this.mask = scatterMaskFor(parent);
    this.coverClass = coverClassOf(kind.name);
    this.halfCell = chunks.grid.cell / 2;
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
    this.dstAt = new Int32Array(this.recs.length).fill(-1);
    this.masked = new Uint8Array(this.recs.length);
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

  /**
   * Rewrites the tier buffers from the active chunks when the chunk set changed, and re-applies the zone's
   * ground-cover mask when it changed (only the chunk slices a disc reaches, or reached, are rewritten and uploaded).
   * Zero allocation.
   */
  sync(chunks: ChunkSet): void {
    const maskChanged = this.mask.generation !== this.maskGeneration;
    if (chunks.generation === this.generation && !maskChanged) return;
    this.maskGeneration = this.mask.generation;
    if (chunks.generation === this.generation) { this.applyMask(false); return; }
    this.generation = chunks.generation;
    this.dstAt.fill(-1);
    this.masked.fill(0);
    for (let t = 0; t < 4; t++) {
      const group = this.tierMeshes[t];
      if (!group) continue;
      const head = group[0]!;
      const dstM = head.instanceMatrix.array as Float32Array;
      let colorAttr: InstancedMesh['instanceColor'] = null;
      for (let i = 0; i < group.length; i++) if (group[i]!.instanceColor !== null) { colorAttr = group[i]!.instanceColor; break; }
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
        this.dstAt[c] = k;
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
        head.instanceMatrix.clearUpdateRanges(); extendUpload(head.instanceMatrix, 0, k * 16, this.spare[t]!);
        if (colorAttr) { colorAttr.clearUpdateRanges(); colorAttr.addUpdateRange(0, k * 3); colorAttr.needsUpdate = true; }
      }
      for (const m of group) { m.count = k; m.visible = k > 0; }
    }
    this.applyMask(true);
  }

  /**
   * Writes the masked matrices of every written chunk slice a disc reaches (and restores the originals of slices a
   * disc no longer reaches). `fresh`: the buffers were just rewritten from the originals (and are uploaded whole).
   */
  private applyMask(fresh: boolean): void {
    const mask = this.mask; const cls = this.coverClass; const h = this.halfCell;
    this.lo.fill(Infinity); this.hi.fill(-Infinity);
    for (let c = 0; c < this.recs.length; c++) {
      const k = this.dstAt[c]!;
      if (k < 0) continue;
      const rec = this.recs[c]!;
      const cx = rec.centre.x; const cz = rec.centre.z;
      const touched = mask.touches(cx - h, cz - h, cx + h, cz + h, cls);
      if (!touched && this.masked[c] === 0) continue;
      const group = this.tierMeshes[rec.tier];
      if (!group) continue;
      const dstM = group[0]!.instanceMatrix.array as Float32Array;
      const s = this.starts[c]!; const n = this.counts[c]!;
      const src = this.matrices;
      for (let i = 0; i < n; i++) {
        const so = (s + i) * 16; const d = (k + i) * 16;
        for (let e = 0; e < 16; e++) dstM[d + e] = src[so + e]!;
        if (!touched) continue;
        const f = mask.factor(src[so + 12]!, src[so + 14]!, cls);
        if (f >= 1) continue;
        if (f <= MASK_HIDE_BELOW) { for (let e = 0; e < 11; e++) dstM[d + e] = 0; }
        else { dstM[d + 4] = dstM[d + 4]! * f; dstM[d + 5] = dstM[d + 5]! * f; dstM[d + 6] = dstM[d + 6]! * f; }
      }
      this.masked[c] = touched ? 1 : 0;
      const t = rec.tier;
      if (k * 16 < this.lo[t]!) this.lo[t] = k * 16;
      if ((k + n) * 16 > this.hi[t]!) this.hi[t] = (k + n) * 16;
    }
    if (fresh) return;
    for (let t = 0; t < 4; t++) {
      const group = this.tierMeshes[t];
      if (!group || !(this.hi[t]! > this.lo[t]!)) continue;
      extendUpload(group[0]!.instanceMatrix, this.lo[t]!, this.hi[t]!, this.spare[t]!);
    }
  }

  /** The matrix currently written for build-order instance `i` (tests / the Pillar 7 check), or null when not written. */
  writtenMatrix(i: number, out: Float32Array): Float32Array | null {
    for (let c = 0; c < this.recs.length; c++) {
      const s = this.starts[c]!; const n = this.counts[c]!;
      if (i < s || i >= s + n) continue;
      const k = this.dstAt[c]!;
      const group = this.tierMeshes[this.recs[c]!.tier];
      if (k < 0 || !group) return null;
      out.set((group[0]!.instanceMatrix.array as Float32Array).subarray((k + i - s) * 16, (k + i - s + 1) * 16));
      return out;
    }
    return null;
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
