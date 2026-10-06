/**
 * SPEC §10.6.1 / §10.5.5 — the terrain mesh, built from the SAME `heights` array the collider samples (what you
 * see is what you collide with), in 32 m chunks (the AOI cell), plus the skirt that continues the land beyond the
 * field so the world never ends at a cliff of void.
 *
 * Layers: the library has one shared material per surface (a builder never makes materials, §10.0.3 rule 3), so
 * the splat is realised geometrically: every triangle is clipped along the zero lines of the layout's signed
 * layer fields (plaza > path > detail > ground, `splatAt`), each piece goes to its layer's index range, and the
 * chunk is one indexed `BufferGeometry` with a group per layer (one draw per layer present). Boundaries are the
 * exact interpolated iso-lines — smooth curves at 0.5 m resolution, never triangle staircases. Layers keep their
 * own vertices so the `color` attribute (harvest level 2) is the layer albedo; normals come from the heightfield
 * (central differences), identical on both sides of every seam.
 */
import { BufferAttribute, BufferGeometry, Mesh, Vector3 } from 'three/webgpu';
import type { Material } from 'three/webgpu';
import type { HeightfieldData } from '../contracts.js';
import { linearRgb } from '../materials/graph.js';
import { surfaceDef, type SurfaceId } from '../materials/surfaces.js';
import { roadDistance, splatAt, type SplatContext, type SplatFields } from '../zone/layout.js';
import type { ChunkGrid } from '../zone/lod.js';
import { fbm2, valueNoise } from '../zone/prng.js';
import { heightClamped } from './field.js';

/** Layer order = priority: plaza, path, detail, ground. */
export type TerrainLayers = readonly [plaza: SurfaceId, path: SurfaceId, detail: SurfaceId, ground: SurfaceId];

interface V { key: string; x: number; y: number; z: number; nx: number; ny: number; nz: number; f0: number; f1: number; f2: number }

class LayerBuf {
  /** UV scale (plaza stones read larger than the baked 2 m tile at the diorama distance). */
  constructor(readonly uvScale = 1) {}
  readonly pos: number[] = [];
  readonly nrm: number[] = [];
  readonly uv: number[] = [];
  readonly idx: number[] = [];
  readonly map = new Map<string, number>();
  vertex(v: V): number {
    let i = this.map.get(v.key);
    if (i !== undefined) return i;
    i = this.pos.length / 3;
    this.map.set(v.key, i);
    this.pos.push(v.x, v.y, v.z);
    const l = Math.hypot(v.nx, v.ny, v.nz) || 1;
    this.nrm.push(v.nx / l, v.ny / l, v.nz / l);
    this.uv.push(v.x * this.uvScale, v.z * this.uvScale);
    return i;
  }
}

const field = (v: V, k: number): number => (k === 0 ? v.f0 : k === 1 ? v.f1 : v.f2);

function lerpV(a: V, b: V, t: number, k: number): V {
  const [ka, kb] = a.key < b.key ? [a.key, b.key] : [b.key, a.key];
  return {
    key: `${ka}|${kb}|${k}`,
    x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t,
    nx: a.nx + (b.nx - a.nx) * t, ny: a.ny + (b.ny - a.ny) * t, nz: a.nz + (b.nz - a.nz) * t,
    f0: a.f0 + (b.f0 - a.f0) * t, f1: a.f1 + (b.f1 - a.f1) * t, f2: a.f2 + (b.f2 - a.f2) * t,
  };
}

/** Sutherland–Hodgman split of a convex polygon by field k > 0 (inside) / ≤ 0 (outside). */
function split(poly: readonly V[], k: number): [V[], V[]] {
  const inside: V[] = []; const outside: V[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!; const b = poly[(i + 1) % poly.length]!;
    const fa = field(a, k); const fb = field(b, k);
    if (fa > 0) inside.push(a); else outside.push(a);
    if ((fa > 0) !== (fb > 0)) {
      const t = fa / (fa - fb);
      const m = lerpV(a, b, t, k);
      inside.push(m); outside.push(m);
    }
  }
  return [inside, outside];
}

function emit(buf: LayerBuf, poly: readonly V[]): void {
  if (poly.length < 3) return;
  const i0 = buf.vertex(poly[0]!);
  for (let i = 1; i + 1 < poly.length; i++) buf.idx.push(i0, buf.vertex(poly[i]!), buf.vertex(poly[i + 1]!));
}

/** Recursive layer assignment: level 0 plaza, 1 path, 2 detail, 3 ground. */
function processPoly(bufs: readonly LayerBuf[], poly: readonly V[], level: number): void {
  if (poly.length < 3) return;
  if (level === 3) { emit(bufs[3]!, poly); return; }
  let pos = 0; let neg = 0;
  for (const v of poly) { if (field(v, level) > 0) pos++; else neg++; }
  if (neg === 0) { emit(bufs[level]!, poly); return; }
  if (pos === 0) { processPoly(bufs, poly, level + 1); return; }
  const [inn, out] = split(poly, level);
  emit(bufs[level]!, inn);
  processPoly(bufs, out, level + 1);
}

/** Plaza layer UV scale: 0.62 → stones 1.6× the baked size. */
export const PLAZA_UV_SCALE = 0.62;

export interface TerrainChunk { readonly mesh: Mesh; readonly geometry: BufferGeometry; readonly centre: readonly [number, number]; readonly triangles: number }

const _c = new Vector3();

function finishGeometry(bufs: readonly LayerBuf[], layers: TerrainLayers, material: (id: SurfaceId) => Material): { geometry: BufferGeometry; materials: Material[]; triangles: number } | null {
  let verts = 0; let tris = 0;
  for (const b of bufs) { verts += b.pos.length / 3; tris += b.idx.length / 3; }
  if (tris === 0) return null;
  const pos = new Float32Array(verts * 3); const nrm = new Float32Array(verts * 3);
  const uv = new Float32Array(verts * 2); const col = new Float32Array(verts * 3);
  const idx = verts > 65535 ? new Uint32Array(tris * 3) : new Uint16Array(tris * 3);
  const g = new BufferGeometry();
  const materials: Material[] = [];
  let v0 = 0; let i0 = 0;
  bufs.forEach((b, layer) => {
    const n = b.pos.length / 3;
    if (b.idx.length === 0) { return; }
    pos.set(b.pos, v0 * 3); nrm.set(b.nrm, v0 * 3); uv.set(b.uv, v0 * 2);
    linearRgb(surfaceDef(layers[layer]!).albedo, _c);
    for (let i = 0; i < n; i++) { col[(v0 + i) * 3] = _c.x; col[(v0 + i) * 3 + 1] = _c.y; col[(v0 + i) * 3 + 2] = _c.z; }
    for (let i = 0; i < b.idx.length; i++) idx[i0 + i] = b.idx[i]! + v0;
    g.addGroup(i0, b.idx.length, materials.length);
    materials.push(material(layers[layer]!));
    v0 += n; i0 += b.idx.length;
  });
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('normal', new BufferAttribute(nrm, 3));
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.setIndex(new BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return { geometry: g, materials, triangles: tris };
}

/**
 * Builds the terrain chunk meshes of the field. Each chunk covers its 32 m cell ∩ the field at the heightfield's
 * 0.5 m step; neighbouring chunks share their border sample rows (identical positions and normals).
 */
export function buildTerrainChunks(h: HeightfieldData, grid: ChunkGrid, splat: SplatContext, layers: TerrainLayers, material: (id: SurfaceId) => Material): TerrainChunk[] {
  const out: TerrainChunk[] = [];
  const res = h.res; const step = h.step;
  const f: SplatFields = { plaza: 0, path: 0, detail: 0 };
  // per-sample fields and normals, computed once for the field
  const n2 = res * res;
  const F0 = new Float32Array(n2); const F1 = new Float32Array(n2); const F2 = new Float32Array(n2);
  for (let r = 0; r < res; r++) {
    const z = h.originZ + r * step;
    for (let c = 0; c < res; c++) {
      const x = h.originX + c * step;
      splatAt(splat, x, z, f);
      const i = r * res + c;
      F0[i] = f.plaza; F1[i] = f.path; F2[i] = f.detail;
    }
  }
  const vert = (r: number, c: number): V => {
    const i = r * res + c;
    const x = h.originX + c * step; const z = h.originZ + r * step;
    const hx = (h.heights[r * res + Math.min(res - 1, c + 1)]! - h.heights[r * res + Math.max(0, c - 1)]!) / ((Math.min(res - 1, c + 1) - Math.max(0, c - 1)) * step);
    const hz = (h.heights[Math.min(res - 1, r + 1) * res + c]! - h.heights[Math.max(0, r - 1) * res + c]!) / ((Math.min(res - 1, r + 1) - Math.max(0, r - 1)) * step);
    return { key: `g${i}`, x, y: h.heights[i]!, z, nx: -hx, ny: 1, nz: -hz, f0: F0[i]!, f1: F1[i]!, f2: F2[i]! };
  };
  for (let cz = 0; cz < grid.cells; cz++) {
    for (let cx = 0; cx < grid.cells; cx++) {
      const x0 = grid.origin + cx * grid.cell; const z0 = grid.origin + cz * grid.cell;
      const c0 = Math.max(0, Math.ceil((x0 - h.originX) / step - 1e-6));
      const c1 = Math.min(res - 1, Math.floor((x0 + grid.cell - h.originX) / step + 1e-6));
      const r0 = Math.max(0, Math.ceil((z0 - h.originZ) / step - 1e-6));
      const r1 = Math.min(res - 1, Math.floor((z0 + grid.cell - h.originZ) / step + 1e-6));
      if (c1 <= c0 || r1 <= r0) continue;
      const bufs = [new LayerBuf(PLAZA_UV_SCALE), new LayerBuf(), new LayerBuf(), new LayerBuf()];
      const cache = new Map<number, V>();
      const get = (r: number, c: number): V => {
        const k = r * res + c;
        let v = cache.get(k);
        if (v === undefined) { v = vert(r, c); cache.set(k, v); }
        return v;
      };
      for (let r = r0; r < r1; r++) {
        for (let c = c0; c < c1; c++) {
          const a = get(r, c); const b = get(r, c + 1); const cc = get(r + 1, c); const d = get(r + 1, c + 1);
          // alternate the diagonal so the mesh has no directional bias
          if (((r + c) & 1) === 0) { processPoly(bufs, [a, cc, b], 0); processPoly(bufs, [b, cc, d], 0); }
          else { processPoly(bufs, [a, cc, d], 0); processPoly(bufs, [a, d, b], 0); }
        }
      }
      const built = finishGeometry(bufs, layers, material);
      if (built === null) continue;
      const mesh = new Mesh(built.geometry, built.materials);
      mesh.name = `ewa:terrain:${cx},${cz}`;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      out.push({ mesh, geometry: built.geometry, centre: [x0 + grid.cell / 2, z0 + grid.cell / 2], triangles: built.triangles });
    }
  }
  return out;
}

export interface SkirtOpts {
  /** How far the skirt reaches past the field edge. */
  readonly reach: number;
  /** Peak hill height at the far edge. */
  readonly rise: number;
  /** Exits (world x/z of the road axis) where the land stays low so roads run on into a valley. */
  readonly exits: readonly { readonly dir: 'n' | 'e' | 's' | 'w'; readonly offset: number }[];
  readonly salt: number;
  /** Phase E3: linked neighbours whose terrain replaces the hills on their side (absent → hills everywhere). */
  readonly neighbours?: readonly NeighbourField[];
}

/**
 * Phase E3 (audit M2-link-east-1): a linked neighbour's terrain as the skirt sees it — built by the zone builder from
 * `ZoneSpec.neighbours`. World (x, z) maps to the neighbour's own frame as (x − dx, z − dz); its heights get `dy`.
 */
export interface NeighbourField {
  /** The side of THIS field the neighbour lies on. */
  readonly dir: 'n' | 'e' | 's' | 'w';
  readonly h: HeightfieldData;
  readonly dx: number; readonly dz: number; readonly dy: number;
  /** The neighbour's layer fields (its road / plaza continue into the skirt); null → ground and slope detail only. */
  readonly splat: SplatContext | null;
}

export const NEIGHBOUR_SKIRT = Object.freeze({
  /** Metres past this field's edge over which the generic hills give way to the neighbour's heights. */
  blendM: 20,
  /** Metres over which the neighbour's road / plaza layers fade in … */
  layerBlendM: 3,
  /** … starting this far inside the field edge, so the neighbour's road is nearly full width where this zone's road ends. */
  layerLeadM: 2,
  /** Metres inside the neighbour field's own boundary over which it fades back into the hills. */
  rimM: 16,
  /** Skirt trees and rocks keep this far from the neighbour's roads (metres from the road edge). */
  roadClearM: 4,
});

function smooth01(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** Weight in [0, 1] of the neighbour's terrain at world (x, z): 0 on this field, off its side and outside its field. */
export function neighbourWeight(n: NeighbourField, half: number, x: number, z: number, blend: number = NEIGHBOUR_SKIRT.blendM, lead = 0): number {
  const along = n.dir === 'e' ? x - half : n.dir === 'w' ? -x - half : n.dir === 's' ? z - half : -z - half;
  if (along <= 0) return 0;
  const nh = n.h.size / 2;
  const inside = Math.min(nh - Math.abs(x - n.dx), nh - Math.abs(z - n.dz));
  if (inside <= 0) return 0;
  return smooth01((along + lead) / blend) * smooth01(inside / NEIGHBOUR_SKIRT.rimM);
}

/** Phase E3: whether skirt scatter may stand at world (x, z) — not on (or within `roadClearM` of) a neighbour's road / plaza. */
export function skirtClearFn(h: HeightfieldData, o: SkirtOpts): (x: number, z: number) => boolean {
  const half = h.size / 2;
  const ns = (o.neighbours ?? []).filter((n) => n.splat !== null);
  if (ns.length === 0) return () => true;
  return (x: number, z: number): boolean => {
    for (const n of ns) {
      if (neighbourWeight(n, half, x, z, NEIGHBOUR_SKIRT.layerBlendM) <= 0.05) continue;
      const lx = x - n.dx; const lz = z - n.dz;
      const plan = n.splat!.plan;
      if (plan.plaza && Math.hypot(lx - plan.plaza.x, lz - plan.plaza.z) < plan.plaza.r + NEIGHBOUR_SKIRT.roadClearM) return false;
      if (roadDistance(n.splat!.roads, lx, lz) < NEIGHBOUR_SKIRT.roadClearM) return false;
    }
    return true;
  };
}

/**
 * The land beyond the field: a ring from 1 m inside the field edge (5 cm under the field terrain, so there is no
 * crack) out to `reach`, rising into hills; low valleys where roads leave. 2 m step, ground/detail layers, 32 m
 * segments (frustum-culled). Not walkable and not in the collider (outside the field).
 */
export function buildSkirt(h: HeightfieldData, o: SkirtOpts, layers: TerrainLayers, material: (id: SurfaceId) => Material): TerrainChunk[] {
  const half = h.size / 2;
  const R = half + o.reach;
  const step = 2;
  const inner = half - 1;
  const hf = skirtHeightFn(h, o);
  const heightAtSkirt = (x: number, z: number): number => (Math.max(Math.abs(x), Math.abs(z)) <= half ? heightClamped(h, x, z) - 0.05 : hf(x, z));
  const out: TerrainChunk[] = [];
  const seg = 32;
  const quads: { x0: number; x1: number; z0: number; z1: number }[] = [];
  // north / south bands span the full width; east / west bands fill between them
  for (let x = -R; x < R - 1e-6; x += seg) { quads.push({ x0: x, x1: Math.min(R, x + seg), z0: -R, z1: -inner }); quads.push({ x0: x, x1: Math.min(R, x + seg), z0: inner, z1: R }); }
  for (let z = -inner; z < inner - 1e-6; z += seg) { quads.push({ x0: -R, x1: -inner, z0: z, z1: Math.min(inner, z + seg) }); quads.push({ x0: inner, x1: R, z0: z, z1: Math.min(inner, z + seg) }); }
  for (const q of quads) {
    const nx = Math.max(1, Math.round((q.x1 - q.x0) / step)); const nz = Math.max(1, Math.round((q.z1 - q.z0) / step));
    const bufs = [new LayerBuf(), new LayerBuf(), new LayerBuf(), new LayerBuf()];
    const verts: V[] = [];
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const x = q.x0 + ((q.x1 - q.x0) * i) / nx; const z = q.z0 + ((q.z1 - q.z0) * j) / nz;
        const y = heightAtSkirt(x, z);
        const e = 0.5;
        const hx = (heightAtSkirt(x + e, z) - heightAtSkirt(x - e, z)) / (2 * e);
        const hz = (heightAtSkirt(x, z + e) - heightAtSkirt(x, z - e)) / (2 * e);
        const slope = Math.hypot(hx, hz);
        const n = valueNoise(x * 0.15, z * 0.15, o.salt + 9);
        let f0 = -1; let f1 = -1; let f2 = (slope - 0.55) * 3 + n * 0.8;
        // E3: the neighbour's road / plaza / detail layers continue into the skirt on its side
        for (const nb of o.neighbours ?? []) {
          if (nb.splat === null) continue;
          const wl = neighbourWeight(nb, half, x, z, NEIGHBOUR_SKIRT.layerBlendM, NEIGHBOUR_SKIRT.layerLeadM);
          if (wl <= 0) continue;
          splatAt(nb.splat, x - nb.dx, z - nb.dz, _sf);
          f0 += (_sf.plaza - f0) * wl; f1 += (_sf.path - f1) * wl; f2 += (_sf.detail - f2) * wl;
        }
        verts.push({ key: `s${j * (nx + 1) + i}`, x, y, z, nx: -hx, ny: 1, nz: -hz, f0, f1, f2 });
      }
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = verts[j * (nx + 1) + i]!; const b = verts[j * (nx + 1) + i + 1]!;
      const c = verts[(j + 1) * (nx + 1) + i]!; const d = verts[(j + 1) * (nx + 1) + i + 1]!;
      processPoly(bufs, [a, c, b], 0); processPoly(bufs, [b, c, d], 0);
    }
    const built = finishGeometry(bufs, layers, material);
    if (built === null) continue;
    const mesh = new Mesh(built.geometry, built.materials);
    mesh.name = 'ewa:skirt';
    mesh.castShadow = false; mesh.receiveShadow = true;
    out.push({ mesh, geometry: built.geometry, centre: [(q.x0 + q.x1) / 2, (q.z0 + q.z1) / 2], triangles: built.triangles });
  }
  return out;
}

const _sf: SplatFields = { plaza: 0, path: 0, detail: 0 };

/** The skirt height function exposed for scatter placement beyond the field (same formula, pure). */
export function skirtHeightFn(h: HeightfieldData, o: SkirtOpts): (x: number, z: number) => number {
  const half = h.size / 2;
  const hills = hillsHeightFn(h, o);
  const ns = o.neighbours ?? [];
  if (ns.length === 0) return hills;
  // E3: on a linked side the hills give way to the neighbour's own terrain (offset so the two link points meet)
  return (x: number, z: number): number => {
    let y = hills(x, z);
    for (const n of ns) {
      const w = neighbourWeight(n, half, x, z);
      if (w > 0) y += (heightClamped(n.h, x - n.dx, z - n.dz) + n.dy - y) * w;
    }
    return y;
  };
}

/** The generic skirt: hills rising away from the field, valleys where roads leave. */
function hillsHeightFn(h: HeightfieldData, o: SkirtOpts): (x: number, z: number) => number {
  const half = h.size / 2;
  return (x: number, z: number): number => {
    const d = Math.max(Math.abs(x), Math.abs(z)) - half;
    const edge = heightClamped(h, x, z);
    if (d <= 0) return edge;
    let valley = 1;
    for (const e of o.exits) {
      const along = e.dir === 'e' || e.dir === 'w' ? z - e.offset : x - e.offset;
      const outward = e.dir === 'e' ? x > 0 : e.dir === 'w' ? x < 0 : e.dir === 's' ? z > 0 : z < 0;
      if (!outward) continue;
      const t = Math.min(1, Math.max(0, (Math.abs(along) - 5) / 16));
      valley = Math.min(valley, t * t * (3 - 2 * t));
    }
    const hills = (0.55 + 0.45 * fbm2(x * 0.018, z * 0.018, 3, o.salt)) * o.rise;
    const t = Math.min(1, d / (o.reach * 0.75));
    const ramp = t * t * (3 - 2 * t);
    return edge + ramp * hills * (0.15 + 0.85 * valley) + valueNoise(x * 0.2, z * 0.2, o.salt + 3) * 0.25 * Math.min(1, d / 6);
  };
}
