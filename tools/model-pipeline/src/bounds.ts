/**
 * Rest-pose bounds for `ModelEntry.bounds` (SPEC §40.2.5), measured on the float document before quantization
 * (after `quantize()` a skinned mesh's positions live in the [-1, 1] quantization volume and the correction sits in
 * the inverse-bind matrices). A skinned vertex is placed as three.js places it in the bind pose,
 * `Σ wᵢ · (world(jointᵢ) · IBMᵢ) · p`; an unskinned one by its node's world matrix.
 */
import type { Document, Node } from '@gltf-transform/core';

type Mat4 = number[];

function mul(a: readonly number[], b: readonly number[]): Mat4 {
  const o = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r]! * b[c * 4 + k]!;
    o[c * 4 + r] = s;
  }
  return o;
}

function apply(m: readonly number[], x: number, y: number, z: number, out: number[]): void {
  out[0] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
  out[1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
  out[2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
}

export interface Bounds { readonly min: [number, number, number]; readonly max: [number, number, number] }

/** Rounded to 1e-4 (0.1 mm) so float noise between runs cannot change the manifest. */
const r4 = (v: number): number => Math.round(v * 1e4) / 1e4 || 0;

export function restPoseBounds(doc: Document): Bounds {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const p = [0, 0, 0];
  const acc = [0, 0, 0];
  const el: number[] = [];
  const j: number[] = [];
  const w: number[] = [];
  const grow = (v: readonly number[]): void => {
    for (let k = 0; k < 3; k++) {
      if (v[k]! < min[k]!) min[k] = v[k]!;
      if (v[k]! > max[k]!) max[k] = v[k]!;
    }
  };
  const nodes: Node[] = [];
  for (const scene of doc.getRoot().listScenes()) scene.traverse((n) => { if (n.getMesh()) nodes.push(n); });
  for (const node of nodes) {
    const skin = node.getSkin();
    const joints = skin ? skin.listJoints() : [];
    const ibm = skin?.getInverseBindMatrices() ?? null;
    const jointMats: Mat4[] = joints.map((jn, i) => {
      const inv: number[] = [];
      if (ibm) ibm.getElement(i, inv); else inv.push(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
      return mul(jn.getWorldMatrix(), inv);
    });
    const world = node.getWorldMatrix();
    for (const prim of node.getMesh()!.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const J = prim.getAttribute('JOINTS_0');
      const W = prim.getAttribute('WEIGHTS_0');
      for (let i = 0, n = pos.getCount(); i < n; i++) {
        pos.getElement(i, el);
        if (skin && J && W) {
          J.getElement(i, j);
          W.getElement(i, w);
          acc[0] = acc[1] = acc[2] = 0;
          let ws = 0;
          for (let k = 0; k < 4; k++) {
            const wk = w[k] ?? 0;
            if (wk === 0) continue;
            apply(jointMats[j[k]!]!, el[0]!, el[1]!, el[2]!, p);
            acc[0] += wk * p[0]!; acc[1] += wk * p[1]!; acc[2] += wk * p[2]!;
            ws += wk;
          }
          if (ws > 0) grow([acc[0]! / ws, acc[1]! / ws, acc[2]! / ws]);
        } else {
          apply(world, el[0]!, el[1]!, el[2]!, p);
          grow(p);
        }
      }
    }
  }
  if (!Number.isFinite(min[0]!)) return { min: [0, 0, 0], max: [0, 0, 0] };
  return { min: [r4(min[0]!), r4(min[1]!), r4(min[2]!)], max: [r4(max[0]!), r4(max[1]!), r4(max[2]!)] };
}
