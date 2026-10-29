// Briarvaunt's rig: a great forest lion-stag on four thick legs, a shaggy mane, wide antlers hung with crystal fruit
// (part of the head), a long vine tail curling up behind and spirit motes drifting round it (their own joint). Its eyes
// are glowing slits, not lib.scad eye()s, so it has no lids. Numbers are scad/briarvaunt.scad's.
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, blob, chain, ell, limb, pick, spike } from './lib/biped.mjs';
import { ellD, fold, isAny } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const ORBS = [[0.5, 0.75, 1], [0.72, 0.6, 0.92], [0.45, 0.95, 0.95], [0.45, 0.7, 0.35]];
const MOTES = [[-14, -8, 26], [14, -4, 30], [-13, 6, 14], [15.5, -10, 13]];
const TAIL = [[2, 12, 18], [7, 16, 16], [13, 17, 18], [17, 15, 23], [17, 11, 27], [14, 9, 27]];
const tail = ['tail1', 'tail2', 'tail3'];

const joints = [
  { name: 'root', at: [0, 1, 0] },
  { name: 'legFL', parent: 'root', at: [4.2, -7, 15] },
  { name: 'legFR', parent: 'root', at: [-4.2, -7, 15] },
  { name: 'legBL', parent: 'root', at: [4.4, 9, 15] },
  { name: 'legBR', parent: 'root', at: [-4.4, 9, 15] },
  { name: 'body', parent: 'root', at: [0, 1, 15] },
  { name: 'head', parent: 'body', at: [0, -11, 24] },
  { name: 'earL', parent: 'head', at: [4.6, -10.5, 31] },
  { name: 'earR', parent: 'head', at: [-4.6, -10.5, 31] },
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[2] },
  { name: 'tail3', parent: 'tail2', at: TAIL[4] },
  { name: 'motes', parent: 'root', at: [0, 1, 0] },
];

const leg = (x, y) => any(limb([x, y, 15], [x, y - 0.5, 6], 3.2, 2.6), limb([x, y - 0.5, 6], [x, y - 0.8, 1.5], 2.6),
  ell([3, 3.6, 1.6], [x, y - 1.6, 1.6]), ell([3, 1.2, 1], [x, y - 4.8, 1.2]), limb([x + 2.4, y - 1.5, 9], [x + 2.4, y - 1.2, 2.5], 0.6));
const antler = any(limb([2.6, -10, 32], [11, -7, 40], 1.4, 0.8), limb([5, -9, 35.5], [6, -11, 43], 1, 1.4), limb([8, -8, 38.5], [8, -6, 45], 1, 1.4),
  limb([8, -8, 38.5], [14, -9, 39.6], 0.9, 1.3), limb([11, -7, 40], [12.6, -5.5, 43.4], 0.8, 1.2), ell([1.2, 1, 1], [4.6, -9.8, 37]));
const parts = [
  ['legF*', leg(4.2, -7)],
  ['legB*', leg(4.4, 9)],
  ['body', any(blob([[[7, 8, 7], [0, -4, 17]], [[6, 7, 6], [0, 6, 16]]]), ell([5.6, 10, 3], [0, 1, 11.5]), ell([10.6, 9.4, 10], [0, -6, 21.5]),
    ell([4.2, 1.8, 4], [0, -13.4, 17.5]), limb([0, -13, 20], [0, -13.8, 15], 2.5, 1.4))],
  ['head', any(blob([[[6, 5.6, 5.6], [0, -13, 28]], [[3.8, 3.2, 3], [0, -17.5, 26.2]]]), ell([3.4, 2.4, 2.2], [0, -18.6, 25]),
    ell([9, 3, 9], [0, -11, 27.5]), spike([0, -11, 32.5], [0, 1, 3.5], 1.4), (c) => antler(fold(c)))],
  ['ear*', ell([1.6, 1.2, 2.4], [5.5, -10.2, 32.2])],
  ...chain(['tail1', 'tail1', 'tail2', 'tail2', 'tail3'], TAIL, [1.8, 1.6, 1.4, 1.2, 1, 0.8]),
  ['tail3', ell([3.4, 2, 3.4], [14, 9, 27.5])],
];

function assign(c, rgb) {
  if (isAny(rgb, ORBS, 0.03) && Math.min(...MOTES.map((m) => ellD(c, [1.8, 1.8, 1.8], m))) < 1) return 'motes';
  return pick(c, parts);
}

const drift = (u, cycles = 1, amp = 1) => ({ motes: { p: [0, 0, 1.2 * amp * osc(u, cycles)], r: [0, 0, 5 * amp * osc(u, cycles, 0.25)] } });

const base = quadrupedClips({
  tail, hipH: 15, stride: 12,
  add: {
    idle: (t, u) => drift(u, 1),
    walk: (t, u) => drift(u, 2, 0.6),
    idle_sniff: (t, u) => drift(u, 1),
    idle_shake: (t, u) => drift(u, 3, 2),
    hurt: (t, u) => drift(u, 3, 2),
    faint: (t, u) => ({ motes: { p: [0, 0, -3 * K(u, [[0.2, 0], [0.9, 1]])] } }),
    celebrate: (t, u) => drift(u, 2, 2),
  },
});

const clips = {
  ...base,
  // fidget: lowers the antlers and shakes them so the crystal fruit sways, the motes swirling up round the head
  idle_antlers: {
    seconds: 2.6,
    pose: (t, u) => {
      const low = K(u, [[0, 0], [0.18, 1], [0.72, 1], [0.9, 0]]);
      const sh = Math.sin(TAU * 4 * u) * win(u, 0.22, 0.7, 0.05);
      return merge({
        body: { r: [3 * low, 0, 0] },
        head: { r: [16 * low, 4 * sh, 8 * sh] },
        motes: { r: [0, 0, 40 * low], p: [0, 0, 3 * low] },
      }, Object.fromEntries(tail.map((n, i) => [n, { r: [4 * low, 0, 5 * sh * (1 + 0.3 * i)] }])));
    },
  },
};

export default rigDef({ joints, assign, clips });
