// Kykaiser's rig: a stout penguin-emperor with no arms; two long blade wings hang at its sides (wingL / wingR, the
// template's wing layer), a swept-back mane on the head and a big three-plume tail. Numbers are scad/kykaiser.scad's;
// the head block is translate([0, -1.5, 29.5]) scale(1.2).
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, inFrame, limb, mx, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { subFrame } from './lib/geo.mjs';

export const HEAD = subFrame([0, -1.5, 29.5], [0, 0, 0], 1.2);
const eyeL = { side: 'L', at: [2.2, -4.6, 0.35], size: 1.05, yaw: -22, frame: HEAD };
export const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.2, 0.34, 0.68] });

const add = (a, b, k = 1) => a.map((v, i) => v + b[i] * k);
// the blade wings: shoulder s, direction d, length l, width vector w
const WINGS = { R: [[-7, -0.5, 23], [-0.6, -0.35, -0.72], 21, [-2.52, 0.84, 2.24]], L: [[7, -0.5, 23], [0.5, -0.4, -0.77], 20, [2.52, 0.84, 1.96]] };
const wingT = ([s, d, l, w]) => any(limb(add(s, w, 0.2), add(add(s, d, l * 0.5), w, 0.4), 3.2, 3), limb(add(add(s, d, l * 0.5), w, 0.4), add(s, d, l), 3, 0.8));

// the tail: three plumes, each link to the joint of its index
const TAILS = [
  [[4, 3, 12], [10, 4, 15], [14, 4, 20], [16, 3, 26], [14, 2, 29]],
  [[4, 3.5, 10], [11, 5, 11], [17, 4.5, 15], [20, 3, 20], [21, 2, 23]],
  [[4, 4, 8], [10, 6, 6], [15, 6, 6], [19, 5, 8.5]],
];
const TAIL_W = [[3.6, 3.6, 3.2, 2.4, 1], [3.2, 3.2, 2.8, 2, 0.8], [2.8, 2.6, 2, 0.8]];
export const tails = ['tail1', 'tail2', 'tail3'];
const tailParts = TAILS.flatMap((pts, k) => pts.slice(1).map((p, i) => [tails[Math.min(i, 2)], limb(pts[i], p, TAIL_W[k][i], TAIL_W[k][i + 1])]));

export const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [4.2, 0.5, 9] },
  { name: 'legR', parent: 'root', at: [-4.2, 0.5, 9] },
  { name: 'body', parent: 'root', at: [0, 0.5, 9] },
  { name: 'head', parent: 'body', at: [0, -1, 26] },
  { name: 'wingL', parent: 'body', at: WINGS.L[0] },
  { name: 'wingR', parent: 'body', at: WINGS.R[0] },
  { name: 'tail1', parent: 'body', at: [4, 3.5, 10] },
  { name: 'tail2', parent: 'tail1', at: [10.3, 5, 10.7] },
  { name: 'tail3', parent: 'tail2', at: [15.3, 4.8, 13.7] },
  ...face.joints,
];

const plumeH = (pts, ws) => any(...pts.slice(1).map((p, i) => limb(pts[i], p, ws[i], ws[i + 1])));
const legT = any(ell([3.2, 3.4, 3.4], [4.2, 0.5, 9]), limb([4.4, 0, 8], [5.4, -1.4, 4.5], 2.2, 1.6), limb([5.4, -1.4, 4.5], [5.2, -0.4, 2], 1.9, 1.4),
  ell([1.6, 1.8, 1.1], [5.2, -0.8, 1.2]), limb([5.2, -2, 0.9], [5.2, -4.8, 0.5], 1.8, 0.4), ell([1.4, 1.5, 1.2], [6.4, -0.3, 9.6]));

export const parts = [
  ['body', any(blob([[[7.5, 6.5, 7.5], [0, 0.5, 15]], [[6.5, 6, 5.5], [0, 0, 22]]]), blob([[[5, 2.5, 6], [0, -4.6, 14.5]], [[4, 2.2, 3], [0, -4.4, 20]]]),
    ell([6.6, 5.5, 2.6], [0, 0, 24.5]), ell([6.9, 6, 1], [0, 0, 22.8]), mx(ell([4, 4.2, 3.4], [6.6, 0, 24.8])), mx(ell([4.1, 4.3, 0.8], [6.6, 0, 22.6])),
    blob([[[5.2, 1.6, 3.2], [0, 5.6, 21.5]], [[2.5, 1.4, 2], [0, 6.2, 18]]]), ell([8, 7.5, 6], [0, 0.6, 12.5]))],
  ['head', inFrame(HEAD, any(blob([[[4.4, 4.4, 4.2], [0, 0.5, 0]], [[3, 3.2, 2.4], [0, -3, -1.4]]]), ell([2.6, 2.4, 1.3], [0, -2.8, -2.6]),
    limb([0, -3.8, 1.5], [0, -5.6, -2.2], 4), limb([0, -4.6, 9], [0, -6, -1.8], 1.2), mx(limb([2.2, -3.6, 7], [2.6, -4.6, 2], 1.2)),
    plumeH([[0, 1, 3], [0, 3, 8], [-0.5, 7, 11], [0, 11, 11]], [2.6, 2.4, 2, 1]),
    mx(plumeH([[2, 1, 2.5], [2.8, 4, 7], [3, 8, 9], [3.5, 12, 8.5], [3.8, 14, 10]], [2.2, 2.2, 1.8, 1.2, 0.5])),
    mx(plumeH([[3, 2, 0], [4, 6, 2.5], [4.5, 10, 3], [5, 13, 5]], [2, 1.8, 1.3, 0.5]))))],
  ['wingL', wingT(WINGS.L)],
  ['wingR', wingT(WINGS.R)],
  ['leg*', legT],
  ...tailParts,
];

export const assign = (list) => (c) => pick(c, list);

const addAll = (...maps) => Object.fromEntries([...new Set(maps.flatMap((m) => Object.keys(m)))]
  .map((k) => [k, (t, u) => merge(...maps.map((m) => m[k]?.(t, u)))]));

// the right blade sweeps forward and up on the hit (it has no arm to punch with)
const slash = {
  windup: (t, u) => ({ wingR: { r: [25 * smooth(u / 0.8), 0, 10 * smooth(u / 0.8)] } }),
  lunge: (t, u) => {
    const back = K(u, [[0, 1], [0.12, 1], [0.22, 0]]);
    const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]);
    return { wingR: { r: [25 * back - 70 * hit, 20 * hit, 10 * back - 30 * hit] } };
  },
};

export const clipsFor = (extra = {}) => {
  const base = bipedClips({
    face, tail: tails, hipH: 9, stride: 16, hopScale: 0.5, droop: 0.6,
    wing: { open: [0, -32, 0], flap: 10 },
    add: addAll(slash, {
      // a penguin's waddle: the whole body rocks side to side over the stride
      walk: (t, u) => ({ body: { r: [0, 6 * osc(u, 1), 0] } }),
    }, extra),
  });
  return {
    ...base,

    // fidget: an imperial survey, chin up, a slow look across its court, the blades tucked and the tail swishing once
    idle_survey: {
      seconds: 3,
      pose: (t, u) => {
        const on = K(u, [[0, 0], [0.15, 1], [0.8, 1], [0.95, 0]]);
        const pan = K(u, [[0, 0], [0.2, -1], [0.45, -1], [0.7, 1], [0.85, 1], [1, 0]]);
        return {
          body: { r: [-5 * on, 0, 6 * pan], s: [1, 1, 1 + 0.03 * on] },
          head: { r: [-10 * on, 0, 18 * pan] },
          ...face.pose('open', 0.35 * on + blinks(u, [[0.55, 0.6]])),
          ...both('wing', { r: [0, 6 * on, 0] }),
          ...Object.fromEntries(tails.map((n, i) => [n, { r: [0, 0, 8 * (1 + 0.4 * i) * Math.sin(TAU * u) * on] }])),
        };
      },
    },

    // fidget: it spreads both blades wide and gives them a sharp double flap, settling its feathers
    idle_flare: {
      seconds: 1.8,
      pose: (t, u) => {
        const open = K(u, [[0, 0], [0.2, 1], [0.7, 1], [0.9, 0]]);
        const flap = Math.sin(TAU * 4 * u) * win(u, 0.25, 0.65, 0.05);
        return {
          body: { r: [-4 * open, 0, 0] },
          head: { r: [-6 * open + 3 * flap, 0, 0] },
          ...face.pose(u > 0.3 && u < 0.6 ? 'shut' : 'open'),
          ...both('wing', { r: [0, -55 * open + 12 * flap, 0] }),
          ...Object.fromEntries(tails.map((n, i) => [n, { r: [-6 * open * (1 + 0.3 * i), 0, 0] }])),
        };
      },
    },
  };
};

export default rigDef({ joints, assign: assign(parts), extras: face.extras, clips: clipsFor() });
