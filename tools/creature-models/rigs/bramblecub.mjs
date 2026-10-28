// Bramblecub's rig: a squat mossy bear cub with a big head, leaf ears, stubby arms and a curling vine tail. Numbers are
// scad/bramblecub.scad's (the ears are petals rotated [0, -35, 0]).
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, pair, petal, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye, blinks } from './lib/face.mjs';

const GREEN_DK = [0.2, 0.45, 0.1];
const TAIL = [[3, 7, 6], [9, 9, 6], [14, 8, 9], [16, 6, 14], [15, 5, 18], [13, 5, 17]];
const tails = ['tail1', 'tail2', 'tail3', 'tail4'];

const eyeL = { side: 'L', at: [4, -8.5, 24.3], size: 2.4, yaw: 4 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: GREEN_DK });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [5.5, -0.5, 4.5]),
  { name: 'body', parent: 'root', at: [0, 0, 5] },
  { name: 'head', parent: 'body', at: [0, -1, 18] },
  ...pair('ear*', 'head', [7.5, 0, 28.5]),
  ...pair('arm*', 'body', [7.5, -2, 14]),
  ...pair('hand*', 'arm*', [9.6, -6, 7.8]),
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[1] },
  { name: 'tail3', parent: 'tail2', at: TAIL[2] },
  { name: 'tail4', parent: 'tail3', at: TAIL[3] },
  ...face.joints,
];

const parts = [
  ['body', any(blob([[[9, 8, 7.5], [0, 1, 9]], [[7.5, 7, 6], [0, 0, 14]]]), ell([5.5, 3, 5.5], [0, -5.5, 9.5]), ell([7.6, 5, 3.2], [0, 3.5, 15.5]), ell([7, 4.5, 4.5], [0, 5, 7.5]))],
  ['head', any(blob([[[10.5, 9, 8.5], [0, -1, 24]], [[8.5, 8, 7], [0, 0, 27]]]), blob([[[6.5, 3.5, 3.4], [0, -8.2, 20.5]], [[4, 3, 2.5], [0, -9.3, 22]]]),
    ell([7.5, 6.8, 5], [-1, -2.2, 28.6]), limb([2.2, -1, 31.5], [3.2, -1.5, 36], 0.75, 0.5), limb([-2.2, -1, 31.5], [-3.2, -1.5, 36], 0.75, 0.5))],
  ['ear*', any(petal([4.2, 1.3, 4], [8.5, 0, 30], [0, -35, 0]), limb([8.5, 0, 30], [5.06, 0, 34.9], 2, 0.3))],
  ['arm*', limb([7.5, -2, 14], [9.5, -5.5, 9], 2.6, 2.3)],
  ['hand*', ell([2.6, 2.4, 2], [9.6, -6, 7.8])],
  ['leg*', any(ell([3.8, 4, 4], [5.5, -0.5, 4.5]), ell([3, 4, 1.8], [5.6, -2.5, 1.6]))],
  ...chain(tails, TAIL, [1.4, 1.2, 1.1, 1, 0.9, 0.8]),
  ['tail4', any(petal([1.6, 0.6, 4], [16.5, 5, 21.5], [0, 25, 0]), petal([1.4, 0.6, 3], [13.5, 5, 20.5], [0, -30, 0]))],
];

const leafy = (u, cycles, amp = 1) => both('ear', { r: [0, -6 * amp * osc(u, cycles), 4 * amp * osc(u, cycles, 0.3)] });

const base = bipedClips({
  face, tail: tails, hipH: 4.5, stride: 26, armSwing: 26, droop: 0.4,
  punch: { arm: [-80, 10, 0], fore: [0, 0, 0] },
  cheer: { arm: [-10, -120, 0], fore: [0, 0, 0] },
  add: {
    idle: (t, u) => leafy(u, 2, 0.5),
    walk: (t, u) => leafy(u, 2, 1.2),
    celebrate: (t, u) => leafy(u, 2, 2),
    hurt: (t, u) => leafy(u, 3, 2),
  },
});

const clips = {
  ...base,

  // fidget: three determined little punches at the air, then a proud nod and a puff of the chest
  idle_spar: {
    seconds: 2.4,
    pose: (t, u) => {
      const p = (u0) => win(u, u0, u0 + 0.1, 0.03);
      const l = p(0.12) + p(0.38);
      const r = p(0.25);
      const proud = win(u, 0.55, 0.92, 0.08);
      return merge({
        root: { p: [0, 0, 0.6 * Math.abs(osc(u, 6)) * (1 - proud) * win(u, 0.05, 0.55, 0.05)] },
        body: { r: [4 * (l + r) - 5 * proud, 0, -10 * l + 10 * r], s: [1, 1, 1 + 0.04 * proud] },
        head: { r: [10 * win(u, 0.62, 0.74, 0.04) - 6 * proud, 0, 0] },
        armL: { r: [-80 * l, 0, 0] }, armR: { r: [-80 * r, 0, 0] },
        ...face.pose('open', 0.3 * (l + r)),
      }, leafy(u, 2, 0.5));
    },
  },

  // fidget: it spots its own tail leaf, turns to look and the vine curls up to wave back
  idle_tail: {
    seconds: 2.6,
    pose: (t, u) => {
      const look = K(u, [[0, 0], [0.2, 1], [0.75, 1], [0.92, 0]]);
      const wv = Math.sin(TAU * 3 * u) * look;
      return merge({
        body: { r: [0, 0, 12 * look] },
        head: { r: [-6 * look, -10 * look, 26 * look] },
        ...face.pose('open', blinks(u, [[0.5, 0.55]])),
        ...Object.fromEntries(tails.map((n, i) => [n, { r: [-6 * look * (1 + 0.4 * i), 0, 8 * wv * (1 + 0.3 * i)] }])),
        armL: { r: [-20 * look, -20 * look, 0] },
      }, leafy(u, 3, look));
    },
  },
};

export default rigDef({ joints, assign: (c) => pick(c, parts), extras: face.extras, clips });
