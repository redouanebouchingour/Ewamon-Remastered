/**
 * Dev measurement (run from tools/model-pipeline: `npx tsx dev/anims2.ts`): forward kinematics over the walk / run clips;
 * per toe the planted fraction and the backward speed while planted (IMPLEMENTATION-NOTES K6; the build uses `gaitSpeed`).
 */
import { NodeIO } from '@gltf-transform/core';
import type { Node } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const K = '../../assets-src/models/kaykit-adventurers/Animations/gltf/Rig_Medium/';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
type V = number[];
function sample(times: Float32Array, vals: Float32Array, n: number, t: number): V {
  if (t <= times[0]!) return Array.from(vals.subarray(0, n));
  const last = times.length - 1;
  if (t >= times[last]!) return Array.from(vals.subarray(last * n, last * n + n));
  let i = 0; while (times[i + 1]! < t) i++;
  const a = Array.from(vals.subarray(i * n, i * n + n)), b = Array.from(vals.subarray((i + 1) * n, (i + 1) * n + n));
  const k = (t - times[i]!) / (times[i + 1]! - times[i]!);
  if (n === 4) { let d = 0; for (let j = 0; j < 4; j++) d += a[j]! * b[j]!; const s = d < 0 ? -1 : 1; const o = a.map((x, j) => x * (1 - k) + s * b[j]! * k); const l = Math.hypot(...o); return o.map((x) => x / l); }
  return a.map((x, j) => x * (1 - k) + b[j]! * k);
}
function compose(t: V, q: V, s: V): number[] {
  const [x, y, z, w] = q as [number, number, number, number];
  const x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  return [(1 - (yy + zz)) * s[0]!, (xy + wz) * s[0]!, (xz - wy) * s[0]!, 0, (xy - wz) * s[1]!, (1 - (xx + zz)) * s[1]!, (yz + wx) * s[1]!, 0, (xz + wy) * s[2]!, (yz - wx) * s[2]!, (1 - (xx + yy)) * s[2]!, 0, t[0]!, t[1]!, t[2]!, 1];
}
function mul(a: number[], b: number[]): number[] { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r]! * b[c * 4 + k]!; o[c * 4 + r] = s; } return o; }
const doc = await io.read(K + 'Rig_Medium_MovementBasic.glb');
const byName = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n] as const));
for (const a of doc.getRoot().listAnimations()) {
  if (!/Walking|Running/.test(a.getName())) continue;
  const tracks = new Map<Node, Map<string, { t: Float32Array; v: Float32Array }>>();
  let dur = 0;
  for (const c of a.listChannels()) { const s = c.getSampler()!; const t = s.getInput()!.getArray() as Float32Array; dur = Math.max(dur, t[t.length - 1]!); const m = tracks.get(c.getTargetNode()!) ?? new Map(); m.set(c.getTargetPath()!, { t, v: s.getOutput()!.getArray() as Float32Array }); tracks.set(c.getTargetNode()!, m); }
  const world = (n: Node, t: number): number[] => {
    const tr = tracks.get(n);
    const g = (p: string, k: number, d: V) => tr?.get(p) ? sample(tr.get(p)!.t, tr.get(p)!.v, k, t) : d;
    const local = compose(g('translation', 3, n.getTranslation()), g('rotation', 4, n.getRotation()), g('scale', 3, n.getScale()));
    const p = n.getParentNode();
    return p ? mul(world(p, t), local) : local;
  };
  const N = 400;
  for (const foot of ['toes.l', 'toes.r', 'foot.l']) {
    const ys: number[] = [], zs: number[] = [];
    for (let k = 0; k <= N; k++) { const w = world(byName.get(foot)!, dur * k / N); ys.push(w[13]!); zs.push(w[14]!); }
    const minY = Math.min(...ys);
    let sv = 0, sn = 0, planted = 0;
    for (let k = 1; k <= N; k++) if (ys[k]! < minY + 0.01 && ys[k - 1]! < minY + 0.01) { sv += (zs[k]! - zs[k - 1]!) / (dur / N); sn++; planted++; }
    console.log(a.getName().padEnd(12), foot.padEnd(7), 'dur', dur.toFixed(3), 'planted frac', (planted / N).toFixed(2), 'stance vz', (sv / Math.max(1, sn)).toFixed(3), 'z range', Math.min(...zs).toFixed(3), Math.max(...zs).toFixed(3), 'minY', minY.toFixed(3));
  }
}
