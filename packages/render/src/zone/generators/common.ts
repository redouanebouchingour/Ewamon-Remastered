/**
 * Helpers shared by the biome sets' set-pieces: lantern housings at exact light positions (post or hanging),
 * lathed towers, arches, stairs, rings of blocks, and the §10.5.4 generator facade (`generatorsFor`) that exposes a
 * `BiomeSet` through the verbatim `BiomeGenerators` signatures.
 */
import { BufferAttribute, BufferGeometry, Matrix4, Mesh, Vector3 } from 'three/webgpu';
import type { Material } from 'three/webgpu';
import type { BuildingSpec, SetPieceId, WaterSpec } from '../../contracts.js';
import { WATER_DEPTH_ATTRIBUTE } from '../../materials/graph.js';
import type { SurfaceId } from '../../materials/surfaces.js';
import { HOUSING_LOCAL, SET_PIECE_LIGHTS } from '../layout.js';
import { Parts, beam, box, lathe, propGeo } from '../geo.js';
import { createPrng } from '../prng.js';
import type { BiomeGenerators, PropGeo, TreeKind } from '../types.js';
import { buildHouse } from './buildings.js';
import { TREE_SHAPES, buildRock, buildTallGrass, buildTree } from './nature.js';
import { buildBridge, buildFence, buildLantern, buildPondBank } from './props.js';
import { setPieceLights, type BiomeSet, type SetPieceContext } from './set.js';

const TAU = Math.PI * 2;

/** Adds the geometry of a PropGeo tier to `parts` (one surface per group), transformed. */
export function addPropTier(parts: Parts, g: PropGeo, tier: 0 | 1 | 2, m?: Matrix4): void {
  const geo = tier === 0 ? g.lod0 : tier === 1 ? g.lod1 : g.lod2;
  const groups = geo.groups;
  const surfaces = g.surfaces;
  if (groups.length === 0) return;
  for (const gr of groups) {
    const s = surfaces[gr.materialIndex ?? 0] ?? surfaces[0]!;
    const sub = sliceGeometry(geo, gr.start, gr.count);
    parts.add(s, sub, m);
    sub.dispose();
  }
}

/** A non-indexed geometry's vertex range as its own geometry (temporary). */
function sliceGeometry(g: BufferGeometry, start: number, count: number): BufferGeometry {
  const out = new BufferGeometry();
  for (const name of ['position', 'normal', 'uv'] as const) {
    const a = g.getAttribute(name);
    if (!a) continue;
    const arr = (a.array as Float32Array).subarray(start * a.itemSize, (start + count) * a.itemSize);
    out.setAttribute(name, new BufferAttribute(arr, a.itemSize));
  }
  return out;
}

export function disposeProp(g: PropGeo): void { g.lod0.dispose(); g.lod1.dispose(); g.lod2.dispose(); }

/**
 * A lantern whose housing centre is exactly at set-piece-local (x, y, z); the post stands on `groundY`
 * (a stone footing fills any gap). `tiers` receive lod0/1/2.
 */
export function lanternAt(tiers: readonly Parts[], set: BiomeSet, x: number, y: number, z: number, groundY: number, seed: number): void {
  const L = buildLantern(set.props, seed);
  const base = y - L.housingLocal[1];
  const m = new Matrix4().makeTranslation(x, base, z);
  tiers.forEach((t, k) => addPropTier(t, L, k as 0 | 1 | 2, m));
  if (base > groundY + 0.02) tiers.forEach((t) => box(t, set.props.stone, x, groundY - 0.2, z, 0.5, base - groundY + 0.22, 0.5, 0, 0.04));
  disposeProp(L);
}

/** Hanging lantern built with a matrix (housing centre at local origin + (0, 0, 0)). */
export function hangingLantern(tiers: readonly Parts[], set: BiomeSet, x: number, y: number, z: number, topY: number): void {
  const st = set.props;
  const m = new Matrix4().makeTranslation(x, y, z);
  tiers.forEach((t, k) => {
    lathe(t, st.metal, [[0.05, 0.32], [0.17, 0.3], [0.11, 0.2], [0.001, 0.2]], { segments: 6, smooth: false }, m);
    lathe(t, st.housingGlass, [[0.001, -0.15], [0.11, -0.15], [0.12, 0.15], [0.001, 0.2]], { segments: 6, smooth: false, phase: Math.PI / 6 }, m);
    lathe(t, st.metal, [[0.001, -0.22], [0.13, -0.17], [0.13, -0.14], [0.001, -0.14]], { segments: 6, smooth: false }, m);
    if (k < 2) for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6;
      beam(t, st.metal, [Math.cos(a) * 0.125 + x, y - 0.16, Math.sin(a) * 0.125 + z], [Math.cos(a) * 0.125 + x, y + 0.2, Math.sin(a) * 0.125 + z], 0.022, 0.022, 0.006);
    }
    if (k < 2) beam(t, st.metal, [x, y + 0.32, z], [x, topY, z], 0.02, 0.02, 0.005);
  });
}

/** A generated housing of `generator` whose glowing centre is at (x, y, z). */
export function housingAt(tiers: readonly Parts[], set: BiomeSet, generator: keyof typeof HOUSING_LOCAL, x: number, y: number, z: number, groundY: number, seed: number, build: (seed: number) => PropGeo): void {
  if (generator === 'lantern') { lanternAt(tiers, set, x, y, z, groundY, seed); return; }
  const g = build(seed);
  const base = y - HOUSING_LOCAL[generator][1];
  const m = new Matrix4().makeTranslation(x, base, z);
  tiers.forEach((t, k) => addPropTier(t, g, k as 0 | 1 | 2, m));
  if (base > groundY + 0.02) tiers.forEach((t) => box(t, set.props.stone, x, groundY - 0.2, z, 0.6, base - groundY + 0.22, 0.6, 0, 0.04));
  disposeProp(g);
}

/** Light positions of a set-piece in its local frame, for housing placement. */
export function spLights(id: SetPieceId): readonly { readonly x: number; readonly y: number; readonly z: number }[] {
  return SET_PIECE_LIGHTS[id].map((l) => ({ x: l.local[0], y: l.local[1], z: l.local[2] }));
}

/** A ring of chamfered blocks (curbs, well tops, crowns). */
export function blockRing(parts: Parts, surface: SurfaceId, r: number, y: number, count: number, w: number, h: number, d: number, seed: number): void {
  const p = createPrng(seed);
  for (let k = 0; k < count; k++) {
    const a = (k / count) * TAU + (p.next() - 0.5) * 0.02;
    box(parts, surface, Math.cos(a) * r, y, Math.sin(a) * r, w * (0.9 + p.next() * 0.2), h * (0.9 + p.next() * 0.2), d, -a + Math.PI / 2, 0.035);
  }
}

/** A round tower: lathed shaft with a base course and a crown. */
export function tower(parts: Parts, wall: SurfaceId, trim: SurfaceId, r: number, h: number, seg: number, m?: Matrix4): void {
  lathe(parts, trim, [[r + 0.35, -0.4], [r + 0.35, 0.5], [r + 0.2, 0.7]], { segments: seg, smooth: false }, m);
  lathe(parts, wall, [[r + 0.2, 0.7], [r, 1.0], [r * 0.9, h]], { segments: seg, smooth: true }, m);
  lathe(parts, trim, [[r * 0.9, h], [r * 0.9 + 0.3, h + 0.2], [r * 0.9 + 0.3, h + 0.55], [r * 0.9 + 0.05, h + 0.6], [0.001, h + 0.6]], { segments: seg, smooth: false }, m);
}

/** An arch of voussoir blocks between two piers, spanning `span` at height `h` (in the local XY plane, depth along Z). */
export function archway(parts: Parts, surface: SurfaceId, span: number, h: number, depth: number, pier: number, m: Matrix4): void {
  const hs = span / 2;
  for (const s of [-1, 1]) {
    const pm = m.clone().multiply(new Matrix4().makeTranslation(s * (hs + pier / 2), 0, 0));
    box(parts, surface, 0, -0.3, 0, pier, h + 0.3, depth, 0, 0.05, pm);
  }
  const n = 11;
  for (let k = 0; k < n; k++) {
    const a0 = Math.PI - (k / n) * Math.PI; const a1 = Math.PI - ((k + 1) / n) * Math.PI;
    const am = (a0 + a1) / 2;
    const r = hs + pier * 0.35;
    const bm = m.clone().multiply(new Matrix4().makeTranslation(Math.cos(am) * r, h + Math.sin(am) * r, 0)).multiply(new Matrix4().makeRotationZ(am - Math.PI / 2));
    box(parts, surface, 0, -pier * 0.35, 0, (r * Math.PI) / n - 0.03, pier * 0.7, depth + 0.1, 0, 0.04, bm);
  }
}

/** A straight flight of chamfered steps rising `rise` over `run` along +z, width `w`. */
export function stair(parts: Parts, surface: SurfaceId, w: number, run: number, rise: number, n: number, m: Matrix4): void {
  for (let k = 0; k < n; k++) {
    const z = (k / n) * run;
    box(parts, surface, 0, -0.4, z + run / n / 2, w, 0.4 + ((k + 1) / n) * rise, run / n + 0.02, 0, 0.03, m);
  }
}

export function vec(x: number, y: number, z: number): Vector3 { return new Vector3(x, y, z); }

/** Three empty tiers. */
export function tiers3(): [Parts, Parts, Parts] { return [new Parts(), new Parts(), new Parts()]; }

/** Build a PropGeo from tiers with the set's surfaces ordered. */
export function finish(t: readonly Parts[], order?: readonly SurfaceId[]): PropGeo {
  return propGeo(t[0]!, t[1]!, t[2]!, null, order);
}

// ---- §10.5.4 verbatim facade ------------------------------------------------------------------------------

/** A simple polygon water mesh (the `makePond` return) with a bowl-shaped depth attribute. */
function pondWater(spec: WaterSpec, material: Material): Mesh {
  const poly = spec.polygon;
  let cx = 0; let cz = 0;
  for (const [x, z] of poly) { cx += x; cz += z; }
  cx /= Math.max(1, poly.length); cz /= Math.max(1, poly.length);
  let r = 0;
  for (const [x, z] of poly) r = Math.max(r, Math.hypot(x - cx, z - cz));
  const pos: number[] = []; const nrm: number[] = []; const uv: number[] = []; const dep: number[] = []; const col: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!; const b = poly[(i + 1) % poly.length]!;
    for (const [x, z, d] of [[cx, cz, 1], [b[0], b[1], 0], [a[0], a[1], 0]] as const) {
      pos.push(x, spec.level, z); nrm.push(0, 1, 0); uv.push(x, z); dep.push(d * Math.max(0.6, r * 0.18)); col.push(0.1, 0.2, 0.25);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nrm), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.setAttribute(WATER_DEPTH_ATTRIBUTE, new BufferAttribute(new Float32Array(dep), 1));
  const m = new Mesh(g, material);
  m.castShadow = false; m.receiveShadow = true;
  return m;
}

/**
 * The §10.5.4 generator functions for a set, with its surfaces bound. `material` resolves library materials
 * (only `makePond` builds a Mesh). Missing set-pieces fall back to the set's first one.
 */
export function generatorsFor(set: BiomeSet, material: (id: SurfaceId) => Material, allSetPieces: Readonly<Partial<Record<SetPieceId, (ctx: SetPieceContext) => PropGeo>>>): BiomeGenerators {
  const treeShape = (kind: TreeKind): { bark: SurfaceId; leaf: SurfaceId; shape: (typeof TREE_SHAPES)[keyof typeof TREE_SHAPES] } => {
    const t = set.trees.find((x) => x.kind === `tree_${kind}`) ?? set.trees[0]!;
    return { bark: t.bark, leaf: t.leaf, shape: kind === 'willow' ? TREE_SHAPES.willow : kind === 'birch' ? TREE_SHAPES.birch : TREE_SHAPES.oak };
  };
  return {
    biome: set.biome,
    makeTree: (kind, seed) => { const t = treeShape(kind); return buildTree(t.bark, t.leaf, t.shape, seed); },
    makeRock: (seed) => buildRock(set.rock, seed),
    makeHouse: (spec: BuildingSpec) => buildHouse(set.building, spec),
    makeLantern: (seed) => buildLantern(set.props, seed),
    makeFence: (path, seed) => buildFence(set.props, path, seed),
    makeBridge: (a, b, seed) => buildBridge(set.props, a, b, seed),
    makePond: (spec, seed) => {
      let cx = 0; let cz = 0;
      for (const [x, z] of spec.polygon) { cx += x; cz += z; }
      const n = Math.max(1, spec.polygon.length); cx /= n; cz /= n;
      let r = 0; for (const [x, z] of spec.polygon) r = Math.max(r, Math.hypot(x - cx, z - cz));
      const bank = buildPondBank(set.props, r, seed);
      const water = pondWater(spec, material(set.props.water ?? 'water_pond'));
      return { bank, water };
    },
    makeTallGrass: (seed) => buildTallGrass(set.tallGrass ?? set.props.leaf, seed),
    makeSetPiece: (id, seed) => {
      const b = allSetPieces[id];
      const g = b ? b({ set, seed, ground: () => 0 }) : finish(tiers3());
      return { ...g, lights: setPieceLights(id) };
    },
  };
}
