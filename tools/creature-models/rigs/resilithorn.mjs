// Resilithorn's rig: a six-legged armoured forest beast. The domed shell and chest are the body, the masked head
// carries the brow horn and the leaf ears, the two branching antlers are antenna chains (ant1 = the base bough and its
// low branch, ant2 = the upper boughs), and the thick plated tail lies on the ground behind (tail1..tail3). Numbers
// are scad/resilithorn.scad's (the head block sits in translate([0, -3, 8]): hd()).
import { K, TAU, merge, rigDef, win } from './lib/anim.mjs';
import { any, blob, ell, limb, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { capD, chainHit, fold, isAny, near, side } from './lib/geo.mjs';
import { insectClips } from './lib/insect.mjs';

const hd = ([x, y, z]) => [x, y - 3, z + 8];
const BARK = [[0.44, 0.3, 0.2], [0.32, 0.21, 0.14]];
const BERRY = [0.3, 0.45, 0.85];
const LEAF_HI = [0.7, 0.9, 0.5];
const RED = [0.82, 0.12, 0.2];
const B = { b0: [3, -13, 27], b1: [6, -12, 33], b2: [7, -11, 41], b3: [12.5, -11, 38], b4: [3.5, -11.5, 39], b5: [11.5, -11.5, 31] };
const LEGS = [[[7, -7, 10], -2], [[8, 1, 9.5], 0], [[7, 9, 10], 2]].map(([b, fwd]) => {
  const k = [b[0] + 4, b[1] + fwd, b[2] - 3];
  return [b, k, [k[0] + 1.2, k[1] + fwd * 0.4, 1.2]];
});
const TAIL = [[0, 14, 11], [2, 19, 7], [5, 21.5, 3.5], [8, 22, 2]];
const tail = ['tail1', 'tail2', 'tail3'];

const eyeL = { side: 'L', at: hd([2.7, -16.4, 15.3]), size: 1.75, yaw: 12, flat: 0.5 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.27, 0.42, 0.16] });

const sided = (S, p) => [S === 'L' ? p[0] : -p[0], p[1], p[2]];
const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...LEGS.flatMap(([b], i) => ['L', 'R'].map((S) => ({ name: `leg${i + 1}${S}`, parent: 'root', at: sided(S, b) }))),
  { name: 'body', parent: 'root', at: [0, 1, 9] },
  { name: 'head', parent: 'body', at: hd([0, -10, 12]) },
  ...['L', 'R'].flatMap((S) => [
    { name: `ant${S}1`, parent: 'head', at: sided(S, B.b0) },
    { name: `ant${S}2`, parent: `ant${S}1`, at: sided(S, B.b1) },
  ]),
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i] })),
  ...face.joints,
];

const legD = (f, [b, k, ft]) => Math.min(capD(f, b, k, 2.4, 2), ell([2.8, 3, 3.8], [k[0] + 0.6, k[1], k[2] - 1.6])(f), capD(f, k, ft, 2, 1.8),
  ell([2.4, 2.6, 2], [k[0] + 0.2, k[1] - 0.4, k[2] + 1.4])(f));
const antD = (f) => {
  const a1 = Math.min(capD(f, B.b0, B.b1, 1.3, 1), capD(f, [B.b0[0] + 1.5, B.b0[1], B.b0[2] + 2.5], B.b5, 0.65, 0.35), Math.hypot(...B.b5.map((v, i) => v - f[i])) / 3.5);
  const a2 = Math.min(capD(f, B.b1, B.b2, 1, 0.55), capD(f, B.b1, B.b3, 0.75, 0.4), capD(f, B.b1, B.b4, 0.6, 0.35),
    ...[B.b2, B.b3, B.b4].map((p) => Math.hypot(...p.map((v, i) => v - f[i])) / 3.5));
  return a1 < a2 ? 1 : 2;
};
const parts = [
  ['body', any(ell([9, 12, 5], [0, 2, 11]), ell([10.5, 13.5, 7.5], [0, 2.5, 15]), blob([[[7.5, 5, 6], [0, -8, 18]], [[6, 4, 4], [0, -9, 12]]]),
    ell([5, 2.6, 4.5], [0, -12, 15.5]), ell([4, 4.6, 4], [9, 2, 14.5]), ell([4, 4.6, 4], [-9, 2, 14.5]), ell([4, 6, 4], [0, -1, 23]))],
  ['head', any(blob([[[5.2, 4.6, 4.6], hd([0, -12, 15.5])], [[4.2, 3.4, 3.6], hd([0, -14.6, 13.5])]]), ell([5.6, 3, 2.4], hd([0, -13.5, 19])),
    ell([2.8, 2.4, 3], hd([3.6, -15, 12.8])), ell([2.8, 2.4, 3], hd([-3.6, -15, 12.8])), ell([2.2, 1.2, 2.4], hd([0, -16.3, 12])),
    limb(hd([0, -14, 20]), hd([0, -17, 26]), 1.4, 0.3), ell([1.5, 1.5, 3], hd([5.2, -12, 20.5])), ell([1.5, 1.5, 3], hd([-5.2, -12, 20.5])))],
];

function assign(c, rgb) {
  const f = fold(c);
  const S = side(c);
  if ((isAny(rgb, BARK, 0.03) || near(rgb, BERRY) || near(rgb, LEAF_HI)) && c[2] > 26.5 && c[1] < -7) return `ant${S}${antD(f)}`;
  if (near(rgb, RED)) {
    let bi = 0; let bd = Infinity;
    LEGS.forEach(([, , ft], i) => { const d = Math.hypot(f[0] - ft[0], f[1] - ft[1] + 2, f[2] - ft[2]); if (d < bd) { bd = d; bi = i; } });
    return `leg${bi + 1}${S}`;
  }
  const t = chainHit(c, TAIL, [4, 3.2, 2.2, 1.2]);
  const lg = LEGS.map((l) => legD(f, l));
  const li = lg.indexOf(Math.min(...lg));
  return pick(c, [...parts, ['tail', () => t.d * 1.05], [`leg${li + 1}${S}`, () => lg[li]]])
    .replace(/^tail$/, tail[Math.min(2, t.i)]);
}

const base = insectClips({ face, ant: 2, tail, stride: 10, lift: 9 });

const clips = {
  ...base,
  // fidget: shakes its antlers like a stag, berries swinging, then a snort
  idle_rattle: {
    seconds: 2.2,
    pose: (t, u) => {
      const on = win(u, 0.1, 0.7, 0.08);
      const sh = Math.sin(TAU * 7 * u) * on;
      const snort = K(u, [[0.72, 0], [0.78, 1], [0.92, 0]]);
      return merge(base.idle.pose(t, u), {
        head: { r: [-4 * on + 8 * snort, 4 * sh, 6 * sh] },
        antL2: { r: [0, -4 * sh, 0] }, antR2: { r: [0, 4 * sh, 0] },
        body: { r: [0, 0, 2 * sh], s: [1 + 0.03 * snort, 1 + 0.03 * snort, 1] },
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
