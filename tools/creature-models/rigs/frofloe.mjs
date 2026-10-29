// Frofloe's rig: an ice wolf prowling low, a starburst mane of ice shards round its face (mane1, off the body, so the
// head turns inside it), a snarling head enlarged round its centre in the scad (hd(); the lower jaw is a joint) and a
// bushy plume of a tail curling up over its back. Numbers are scad/frofloe.scad's.
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, blob, ell, limb, pick, spike } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { chainHit, ellD, isAny, subFrame } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

// the head block: translate(HC + [0, 1.4, -1.6]) scale(1.8) translate(-HC), HC = [0, -15, 16.5]
const HF = subFrame([0, 13.4, -14.8], [0, 0, 0], 1.8);
const hd = HF.world;
const ICES = [[0.66, 0.85, 1.0], [0.86, 0.95, 1.0], [0.42, 0.64, 0.93]];
const TAIL = [[0, 11.4, 18], [0, 15.6, 19.8], [0, 19.2, 22.8], [0, 20.4, 27], [0, 18.4, 30.6], [0, 14.4, 32], [0, 11, 30.6], [0, 12.4, 31.2]];
const TAIL_R = [2.8, 4.2, 5.2, 5.4, 4.9, 3.8, 2.4, 2].map((r) => r + 3.5);
const tail = ['tail1', 'tail2', 'tail3'];
const tailOf = (i) => tail[i < 2 ? 0 : i < 4 ? 1 : 2];
const DRIFT = [[-10, -9, 12], [10.5, -6, 17], [-8.5, 4, 22], [9, 13, 10]];
const MANE_C = [0, -12.2, 16.4];

const eyeL = { side: 'L', at: [1.9, -17.1, 17.6], size: 1.38, yaw: 26, flat: 0.5, frame: HF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.74, 0.87, 0.98] });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legFL', parent: 'root', at: [4.8, -7.4, 13] },
  { name: 'legFR', parent: 'root', at: [-4.8, -7.4, 13] },
  { name: 'legBL', parent: 'root', at: [4.3, 8.6, 14] },
  { name: 'legBR', parent: 'root', at: [-4.3, 8.6, 14] },
  { name: 'body', parent: 'root', at: [0, 0, 14] },
  { name: 'mane1', parent: 'body', at: MANE_C },
  { name: 'head', parent: 'body', at: hd([0, -13.4, 16.6]) },
  { name: 'jaw', parent: 'head', at: hd([0, -14.6, 14.9]) },
  { name: 'earL', parent: 'head', at: hd([2.1, -14.2, 18.6]) },
  { name: 'earR', parent: 'head', at: hd([-2.1, -14.2, 18.6]) },
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[2] },
  { name: 'tail3', parent: 'tail2', at: TAIL[4] },
  ...face.joints,
];

const inHead = (test) => (c) => test(HF.local(c));
const legF = any(blob([[[3, 3.4, 4], [4.8, -7.4, 13]], [[2.4, 2.4, 2.4], [7, -9.6, 7.6]]]), limb([7, -9.6, 7.6], [8.2, -11.6, 2], 2.5, 2),
  ell([3.4, 4.4, 2.4], [8.6, -13, 1.2]), limb([7.8, -8, 8.2], [9.4, -5.2, 9.8], 1.2, 0.5), limb([8.6, -9.4, 5.6], [10.4, -7, 6.2], 1, 0.4));
const legB = any(blob([[[2.9, 3.9, 4.4], [4.3, 8.6, 14]], [[2.2, 2.3, 2.2], [5, 6.6, 8.8]]]), limb([5, 6.4, 8.6], [5.3, 11.4, 4.8], 2.3, 1.6),
  limb([5.3, 11.4, 4.8], [5.4, 10.2, 1.4], 1.6, 1.7), ell([3, 3.6, 2], [5.4, 8.6, 1]), limb([5.4, 12.2, 5.4], [5.8, 14.8, 6.8], 1, 0.4));
const parts = [
  ['legF*', legF],
  ['legB*', legB],
  ['body', any(blob([[[5.6, 6.2, 6], [0, -6, 15.6]], [[4.6, 4.4, 5], [0, -9.5, 13]], [[4.2, 4, 4], [0, -2, 16.6]]]),
    blob([[[3.9, 3, 3.6], [0, 2.5, 16.6]], [[4.2, 4, 4], [0, -2, 16.6]]]), blob([[[5, 4.6, 4.9], [0, 8, 16]], [[3.9, 3, 3.6], [0, 3.5, 16.8]]]),
    blob([[[4.2, 4.6, 3.2], [0, -8, 10.6]], [[2.6, 3, 2], [0, -2, 12.4]]]), ell([2.8, 4.4, 4.8], [4.4, -6, 16.4]), ell([2.8, 4.4, 4.8], [-4.4, -6, 16.4]),
    ell([3, 4.4, 4.8], [3.8, 8.6, 15.2]), ell([3, 4.4, 4.8], [-3.8, 8.6, 15.2]))],
  ['head', inHead(any(blob([[[3.5, 3.2, 3], [0, -13.6, 17.4]], [[2.9, 1.8, 2.1], [0, -15.8, 16.9]], [[0.9, 1, 0.8], [0, -19.6, 16.7]]]),
    blob([[[2.4, 1.6, 1.6], [0, -16.2, 15.9]], [[1.3, 1.1, 1], [0, -20.4, 16.15]]]), ell([0.8, 0.65, 0.6], [0, -21.3, 16.6]),
    ell([4.5, 2.2, 2.2], [3.6, -14.4, 15.2]), ell([4.5, 2.2, 2.2], [-3.6, -14.4, 15.2]), ell([2.4, 1.2, 1.4], [1.9, -16.8, 18.6]),
    ell([2.4, 1.2, 1.4], [-1.9, -16.8, 18.6])))],
  ['jaw', inHead(any(blob([[[1.7, 1.6, 0.9], [0, -15.4, 14.3]], [[0.95, 1.1, 0.65], [0, -19.4, 14.5]]]), ell([1, 2.6, 0.6], [0, -17.6, 15.2])))],
  ['ear*', inHead(any(spike([2.1, -14.2, 18.6], [1.5, 0.6, 4.6], 1.6), spike([2.25, -14.75, 19.4], [1.2, 0.45, 3.1], 0.9)))],
];

function assign(c, rgb) {
  if (isAny(rgb, ICES, 0.02) && Math.min(...DRIFT.map((d) => ellD(c, [1.2, 1.2, 2], [d[0], d[1], d[2] + 0.8]))) < 1) return 'root';
  const t = chainHit(c, TAIL, TAIL_R);
  if (c[1] > 9 && c[2] > 16 && t.d < 1) return tailOf(t.i);
  if (isAny(rgb, ICES, 0.02)) {
    const leg = pick(c, parts.slice(0, 2));
    const legD = Math.min(legF([Math.abs(c[0]), c[1], c[2]]), legB([Math.abs(c[0]), c[1], c[2]]));
    if (legD < 1.3) return leg;
    // the mane rings round the face and the bib under the jaw
    return 'mane1';
  }
  return pick(c, parts);
}

const J = (open) => ({ jaw: { r: [open, 0, 0] } });
const base = quadrupedClips({
  face, tail, mane: ['mane1'], hipH: 13, stride: 12,
  add: {
    idle: (t, u) => J(2 * (osc(u, 2) * 0.5 + 0.5)),
    windup: (t, u) => J(10 * smooth(u / 0.8)),
    lunge: (t, u) => J(22 * K(u, [[0, 0.5], [0.3, 1], [0.42, 0], [1, 0]])),
    hurt: (t, u) => J(14 * K(u, [[0, 0], [0.18, 1], [1, 0.4]])),
    faint: (t, u) => J(12 * smooth((u - 0.2) / 0.55)),
    celebrate: (t, u) => J(12),
  },
});

const clips = {
  ...base,
  // fidget: a low growl: head down, jaw working, the mane bristling up in shivers
  idle_growl: {
    seconds: 2.2,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.15, 1], [0.75, 1], [0.9, 0]]);
      const tr = Math.sin(TAU * 18 * u) * win(u, 0.18, 0.72, 0.04);
      return merge({
        body: { r: [4 * on, 0, 0], p: [0, 0, -0.5 * on] },
        head: { r: [8 * on + tr, 0, 0] },
        mane1: { s: 1 + 0.06 * on + 0.015 * tr },
        ...J(8 * on + 2 * tr),
        ...face.pose('open', 0.45 * on),
      }, Object.fromEntries(tail.map((n, i) => [n, { r: [-6 * on * (1 + 0.2 * i), 0, 0] }])));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
