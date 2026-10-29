// Mossling's rig: a sleepy little tortoise under a high mossy shell (the body, seedlings and all), stubby mud-caked legs,
// leaf ears on its head and a pointed tail. The clods of earth ride the root. Numbers are scad/mossling.scad's.
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, ell, limb, petal, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { ellD, fold, isAny, near } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const SHELL = [[0.2, 0.42, 0.16], [0.33, 0.58, 0.22], [0.5, 0.72, 0.28], [0.45, 0.32, 0.2]];
const LEAF = [0.42, 0.7, 0.24];
const MUD = [0.42, 0.3, 0.2];
const CLODS = [[-14, -14, 0.5], [13, -15, 0.5], [-15, 12, 0.5]];

const eyeL = { side: 'L', at: [3.2, -22.2, 9.4], size: 1.7, yaw: 25, flat: 0.6 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.48, 0.6, 0.33] });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legFL', parent: 'root', at: [10, -9, 5] },
  { name: 'legFR', parent: 'root', at: [-10, -9, 5] },
  { name: 'legBL', parent: 'root', at: [10, 9, 5] },
  { name: 'legBR', parent: 'root', at: [-10, 9, 5] },
  { name: 'body', parent: 'root', at: [0, 0, 5] },
  { name: 'head', parent: 'body', at: [0, -12, 7] },
  { name: 'earL', parent: 'head', at: [5.5, -17, 9.8] },
  { name: 'earR', parent: 'head', at: [-5.5, -17, 9.8] },
  { name: 'tail1', parent: 'body', at: [0, 15, 5.5] },
  ...face.joints,
];

const legT = (y) => any(limb([10, y, 5], [12, y, 1.6], 3, 2.8), ell([3.1, 3.3, 1.2], [12, y, 0.9]), ell([1.2, 1.2, 1], [12.4, y - 2.5, 3]));
const parts = [
  ['legF*', legT(-9)],
  ['legB*', legT(9)],
  ['head', any(ell([7, 6, 5.6], [0, -17, 8.5]), ell([5.4, 4.2, 4], [0, -20.5, 7.6]), limb([0, -12, 7], [0, -16, 8], 4.6, 5))],
  ['tail1', spike([0, 16, 5.5], [0, 4, -1.5], 1.6)],
];
const ear = (f) => Math.min(petal([3.4, 0.7, 2], [7.6, -17, 9.5], [0, -15, -25])(f), petal([2.6, 0.6, 1.5], [6.6, -15, 12], [0, -40, 10])(f));

function assign(c, rgb) {
  const S = c[0] >= 0 ? 'L' : 'R';
  if (isAny(rgb, SHELL, 0.012)) return 'body';
  if (near(rgb, MUD, 0.012)) return CLODS.some((p) => ellD(c, [1.5, 1.5, 1.2], p) < 1) ? 'root' : `leg${c[1] < 0 ? 'F' : 'B'}${S}`;
  if (near(rgb, LEAF, 0.03)) return c[1] < -12 && c[2] < 14 && ear(fold(c)) < 2 ? `ear${S}` : 'body';
  return pick(c, parts);
}

const clips = quadrupedClips({ face, tail: ['tail1'], hipH: 5, stride: 10 });

// fidget: pulls its head into the shell for a nap, then peeks out again
clips.idle_tuck = {
  seconds: 3.4,
  pose: (t, u) => {
    const tuck = K(u, [[0, 0], [0.18, 1], [0.7, 1], [0.86, 0]]);
    const peek = win(u, 0.7, 0.8, 0.03);
    return merge({
      head: { p: [0, 5.5 * tuck, -1 * tuck], r: [-4 * peek, 0, 10 * peek] },
      earL: { r: [0, 0, 30 * tuck] },
      earR: { r: [0, 0, -30 * tuck] },
      body: { p: [0, 0, -0.4 * tuck] },
      ...face.pose(tuck > 0.3 ? 'shut' : 'open', blinks(u, [[0.9, 0.95]])),
    });
  },
};

// fidget: a slow, enormous yawn
clips.idle_yawn = {
  seconds: 2.6,
  pose: (t, u) => {
    const y = K(u, [[0, 0], [0.3, 1], [0.6, 1], [0.8, 0]]);
    return {
      head: { r: [-14 * y + 2 * osc(u, 2), 0, 0], s: [1, 1, 1 + 0.06 * y] },
      ...face.pose(y > 0.4 ? 'shut' : 'open', y * 2),
    };
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
