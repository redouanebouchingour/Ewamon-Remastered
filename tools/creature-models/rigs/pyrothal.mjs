// Pyrothal's rig: a navy dragon on two legs, claws raised, a golden horn and blue crest on a head the scad draws in a
// rotated, scaled block, ice crystals along its back, arms, legs and a long tail. Numbers are scad/pyrothal.scad's.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, inFrame, limb, pair, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near, subFrame } from './lib/geo.mjs';

const BLUES = [[0.14, 0.27, 0.55], [0.08, 0.16, 0.38], [0.24, 0.42, 0.72]];
const GOLDS = [[0.93, 0.74, 0.2], [0.75, 0.55, 0.12]];
const ICE = [[0.6, 0.85, 0.96], [0.38, 0.66, 0.85]];
const CLAW = [0.3, 0.28, 0.3];
const HD = subFrame([-1, -2, 33.5], [0, 0, -12], 1.3);

const TAIL = [[2, 3, 12], [7, 5, 7], [13, 4.5, 4.5], [18, 2.5, 5.5], [20.5, 0.5, 9.5], [20.5, -1, 15]];
const TAIL_R = [4, 3.4, 2.6, 2, 1.5, 0.9];
const tail = ['tail1', 'tail2', 'tail3', 'tail4', 'tail5'];

const eyeL = { side: 'L', at: [1.9, -2.95, 0.75], size: 1.4, yaw: 26, flat: 0.5, frame: HD };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: BLUES[0] });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4.8, 0.5, 11]),
  { name: 'body', parent: 'root', at: [0, 0.5, 12] },
  { name: 'head', parent: 'body', at: [-0.5, -0.5, 27.5] },
  ...pair('arm*', 'body', [5.5, -0.5, 25.5]),
  ...pair('fore*', 'arm*', [9.5, -2, 20.5]),
  ...pair('hand*', 'fore*', [12, -4.5, 25]),
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i] })),
  ...face.joints,
];

// crystal(p, d, r): two spikes; tested as one tapering capsule
const crystal = (p, d, r = 0.9) => spike(p, d, r * 1.2);
const tailCrystals = [1, 2, 3, 4].map((i) => [tail[Math.min(4, i)], crystal(TAIL[i].map((v, k) => v + [0, 0.8, TAIL_R[i] * 0.8][k]), [0.6, 1.6, 2.4], TAIL_R[i] * 0.45)]);

const parts = [
  ['body', any(blob([[[6.5, 5.5, 6], [0, 0.5, 17]], [[5.5, 4.8, 5.5], [0, -0.5, 24]]]),
    blob([[[4.6, 2, 5], [-0.6, -4.6, 16.5]], [[3.6, 2, 4.5], [-0.8, -4.6, 24]], [[2.4, 1.6, 2], [-1, -3.6, 29]]]),
    ...[0, 1, 2, 3].flatMap((i) => [1, -1].map((k) => crystal([2 * k, 4.5 + i * 0.2, 29 - i * 4.5], [1.4 * k, 3.6, 2.4 - i * 0.4], 1.5 - i * 0.12))))],
  ['head', any(blob([[[3.4, 3.2, 3], [-0.5, -0.5, 28]], [[3, 3, 2.6], [-1, -1.5, 31.5]]]), inFrame(HD, any(
    blob([[[3.2, 3.4, 2.8], [0, 0.5, 0]], [[2, 3, 1.8], [0, -5, -0.4]]]), blob([[[2.6, 2.6, 1.2], [0, -1.4, -2]], [[1.5, 2.2, 0.9], [0, -5.6, -1.6]]]),
    limb([-1.2, -1, 2], [-2.4, 2, 10.4], 1.4, 0.2), limb([1.4, -0.6, 2], [2.5, 2.1, 6.6], 1, 0.2), ell([4, 4, 4], [0, 2, 1]))))],
  ['arm*', any(limb([5.5, -0.5, 25.5], [9.5, -2, 20.5], 2.2, 1.9), crystal([6.5, 2.5, 28], [1.6, 2, 2.4], 1.1))],
  ['fore*', any(limb([9.5, -2, 20.5], [12, -4.5, 25], 1.9, 1.6), crystal([10, 0, 21.5], [1.6, 1.4, -2]))],
  ['hand*', any(ell([1.9, 1.8, 1.9], [12.2, -5, 25.8]), spike([12.2, -5.6, 27.2], [0, -0.6, 2.2], 1.4), spike([13.6, -5.4, 25], [1.6, -0.6, -0.4], 0.6))],
  ['leg*', any(ell([3.8, 4, 4.4], [4.8, 0.5, 11]), limb([5, 0, 10], [6.5, -2.5, 6], 3.2, 2.2), limb([6.5, -2.5, 6], [6.8, 0, 2], 2.2, 1.9),
    blob([[[2.6, 3.8, 1.3], [7, -2.4, 1.2]], [[2, 1.8, 1.4], [6.8, 0.6, 1.4]]]), spike([7, -5.6, 0.9], [0, -1.6, -0.4], 1.6),
    crystal([7.6, -2.6, 6.5], [1.6, -0.8, 0.6], 0.8), crystal([8.2, 1.6, 10], [1.8, 1, 1], 0.9))],
  ...chain(tail, TAIL, TAIL_R),
  ...chain(tail, TAIL.map((p) => [p[0], p[1] - 0.6, p[2] - 0.9]), TAIL_R.map((r) => r * 0.85)),
  ...tailCrystals,
];

function assign(c, rgb) {
  if (isAny(rgb, [...BLUES, ...GOLDS, ...ICE, CLAW], 0.03)) return pick(c, parts);
  return 'head';   // eyes, sockets
}

const base = bipedClips({
  face, tail, hipH: 10, stride: 18, guard: true, hopScale: 0.6, droop: 0.8,
  // a raking slash: the right claw sweeps forward and across
  punch: { arm: [-50, 0, 25], fore: [45, 0, 0] },
  cheer: { arm: [-20, -110, 0], fore: [-10, 20, 0] },
  add: {
    idle: (t, u) => both('hand', { r: [0, 0, 5 * osc(u, 2)] }),
  },
});

const clips = {
  ...base,

  // fidget: a roar at the sky: it rears back, claws spread, head thrown up, tail lashing
  idle_roar: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.65, 1], [0.85, 0]]);
      const tr = Math.sin(TAU * 12 * u) * win(u, 0.25, 0.65, 0.05);
      return {
        root: { r: [-3 * on, 0, 0] },
        body: { r: [-8 * on, 0, 0] },
        head: { r: [-22 * on + 1.5 * tr, 0, 0] },
        ...face.pose(on > 0.5 ? 'squeeze' : 'open'),
        ...both('arm', { r: [-10 * on, -25 * on, 0] }),
        ...both('fore', { r: [0, 0, 0] }),
        ...both('hand', { s: 1 + 0.1 * on }),
        ...Object.fromEntries(tail.map((n, i) => [n, { r: [-6 * on, 0, 10 * Math.sin(TAU * 2 * u - i * 0.6) * on] }])),
      };
    },
  },

  // fidget: it flexes its claws one by one and admires the ice crystals on its forearm
  idle_admire: {
    seconds: 2.6,
    pose: (t, u) => {
      const look = K(u, [[0, 0], [0.15, 1], [0.75, 1], [0.9, 0]]);
      return merge({
        body: { r: [0, 0, 8 * look] },
        head: { r: [14 * look, 0, 26 * look] },
        ...face.pose('open', blinks(u, [[0.45, 0.5]])),
        armL: { r: [-20 * look, 0, -20 * look] }, foreL: { r: [0, 0, -30 * look] },
        handL: { r: [12 * osc(u, 3) * look, 0, 20 * look] },
      }, Object.fromEntries(tail.map((n, i) => [n, { r: [0, 0, 4 * osc(u, 1, -0.1 * i)] }])));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
