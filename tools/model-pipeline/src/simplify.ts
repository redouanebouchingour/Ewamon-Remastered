/**
 * SPEC §40.2.3 legendary LOD1: `simplify({ simplifier: MeshoptSimplifier, ratio: 0.35, error: 0.001 })`, done with
 * meshoptimizer 0.24's `simplifyWithAttributes` so the skin weights (and normals, UVs) weigh in the collapse
 * error. gltf-transform 4.5's `simplify()` calls the position-only `simplifier.simplify` (read in
 * `functions/dist/index.js`), so this is its own transform (IMPLEMENTATION-NOTES M4). Edge collapse keeps every
 * surviving vertex's `JOINTS_0`/`WEIGHTS_0` untouched, so the skin stays bound by construction; weighting the
 * weights keeps the collapses away from joint boundaries.
 */
import { Primitive } from '@gltf-transform/core';
import type { Accessor, Document, Transform } from '@gltf-transform/core';
import { compactPrimitive, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

export interface SimplifyParams {
  /** Target fraction of the source index count. */
  readonly ratio: number;
  /** Error limit as a fraction of the mesh extent. */
  readonly error: number;
}

/**
 * §40.2.3 names `ratio: 0.35, error: 0.001` and "≈ 10 500 tris". Measured, the 0.001 bound (2 mm on these 2 m
 * creatures) stops the simplifier at 24 000–28 900 of 30 000 triangles (position-only or attribute-weighted), and
 * the resulting LOD1 GLBs are 505–619 KB against the 0.45 MB target. At 0.01 every legendary reaches the ratio
 * (10 435–10 493 tris) with a measured error of 0.0045–0.0081 of the extent — 0.9–1.6 cm, ≈ 1 px at the 40 m LOD1
 * distance (IMPLEMENTATION-NOTES M4). The achieved error is recorded per model in qa-report.json.
 */
export const LOD1_SIMPLIFY: SimplifyParams = Object.freeze({ ratio: 0.35, error: 0.01 });

/** Attribute streams fed to `simplifyWithAttributes`, with their weights (position error is the unit). */
export const SIMPLIFY_ATTRIBUTES: readonly { readonly semantic: string; readonly weight: number }[] = Object.freeze([
  { semantic: 'NORMAL', weight: 0.5 },
  { semantic: 'TEXCOORD_0', weight: 1.0 },
  { semantic: 'WEIGHTS_0', weight: 1.0 },
]);

function floatArray(a: Accessor): Float32Array {
  const n = a.getCount();
  const k = a.getElementSize();
  const out = new Float32Array(n * k);
  const el: number[] = [];
  for (let i = 0; i < n; i++) {
    a.getElement(i, el);
    for (let j = 0; j < k; j++) out[i * k + j] = el[j]!;
  }
  return out;
}

export interface SimplifyResult { readonly srcTriangles: number; readonly dstTriangles: number; readonly error: number }

export function simplifyPrimitiveSkinned(prim: Primitive, p: SimplifyParams): SimplifyResult {
  const pos = prim.getAttribute('POSITION');
  const idx = prim.getIndices();
  if (!pos || !idx) throw new Error('[model-pipeline] simplify: primitive without POSITION or indices');
  if (prim.getMode() !== Primitive.Mode.TRIANGLES) throw new Error('[model-pipeline] simplify: only TRIANGLES are supported');
  const positions = floatArray(pos);
  const n = pos.getCount();
  const streams = SIMPLIFY_ATTRIBUTES.map((s) => ({ ...s, acc: prim.getAttribute(s.semantic) })).filter((s): s is typeof s & { acc: Accessor } => s.acc !== null);
  const stride = streams.reduce((t, s) => t + s.acc.getElementSize(), 0);
  const attrs = new Float32Array(Math.max(1, n * stride));
  const weights: number[] = [];
  let off = 0;
  for (const s of streams) {
    const k = s.acc.getElementSize();
    const src = floatArray(s.acc);
    for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) attrs[i * stride + off + j] = src[i * k + j]!;
    for (let j = 0; j < k; j++) weights.push(s.weight);
    off += k;
  }
  const indices = Uint32Array.from(idx.getArray()!);
  const target = Math.floor((p.ratio * indices.length) / 3) * 3;
  const [dst, error] = stride > 0
    ? MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3, attrs, stride, weights, null, target, p.error, [])
    : MeshoptSimplifier.simplify(indices, positions, 3, target, p.error, []);
  const doc = idx.clone().setArray(dst);
  prim.setIndices(doc);
  if (idx.listParents().length === 1) idx.dispose();
  compactPrimitive(prim);
  const count = prim.getAttribute('POSITION')!.getCount();
  if (count <= 65534) prim.getIndices()!.setArray(new Uint16Array(prim.getIndices()!.getArray()!));
  return { srcTriangles: indices.length / 3, dstTriangles: dst.length / 3, error };
}

/** The LOD1 transform: weld (as gltf-transform's simplify does), then every triangle primitive simplified. */
export function simplifySkinned(p: SimplifyParams, out?: SimplifyResult[]): Transform {
  const fn: Transform = async (doc: Document) => {
    await MeshoptSimplifier.ready;
    await doc.transform(weld());
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        if (prim.getMode() !== Primitive.Mode.TRIANGLES) continue;
        const r = simplifyPrimitiveSkinned(prim, p);
        out?.push(r);
      }
    }
  };
  Object.defineProperty(fn, 'name', { value: 'simplify' });
  return fn;
}
