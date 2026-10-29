// Slushpup's rig: a round seal pup resting on its belly, the front flippers and the back feet as short legs, a low
// head with crystal ears, a crystal tail tuft and a puff of frost breath (its own joint, so it can billow). Numbers are
// scad/slushpup.scad's (the pre-sprite-pass model: re-rig when its new model lands).
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, blob, ell, petal, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const FUR = [0.86, 0.89, 0.93];
const ICE = [[0.68, 0.84, 0.97], [0.88, 0.95, 1.0]];
const PAD = [0.55, 0.7, 0.88];
const PUFF = [0.9, 0.94, 0.98];

const eyeL = { side: 'L', at: [3.6, -14.1, 14.2], size: 1.6, yaw: 30, flat: 0.6 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FUR });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legFL', parent: 'root', at: [6.5, -6, 4.5] },
  { name: 'legFR', parent: 'root', at: [-6.5, -6, 4.5] },
  { name: 'legBL', parent: 'root', at: [8.5, 8, 5] },
  { name: 'legBR', parent: 'root', at: [-8.5, 8, 5] },
  { name: 'body', parent: 'root', at: [0, 1, 4] },
  { name: 'head', parent: 'body', at: [0, -7, 10] },
  { name: 'earL', parent: 'head', at: [4.6, -8, 16] },
  { name: 'earR', parent: 'head', at: [-4.6, -8, 16] },
  { name: 'breath', parent: 'head', at: [-1.5, -21, 9] },
  { name: 'tail1', parent: 'body', at: [0, 13, 7] },
  ...face.joints,
];

const parts = [
  ['legF*', any(blob([[[2.6, 3.6, 1.6], [6.5, -9.5, 2.2]], [[2.2, 2.2, 2.4], [6.5, -6, 4]]]), ell([2.4, 1, 1], [6.5, -12.9, 2.6]))],
  ['legB*', any(ell([2.8, 2.4, 3.4], [8.5, 9, 3.6]), ell([2.4, 0.8, 2.6], [8.6, 11.3, 4.4]))],
  ['body', any(ell([11, 11, 9], [0, 3, 9.5]), ell([9, 8, 8], [0, -4, 10]), ell([7, 6, 5], [0, -8, 6.5]))],
  ['head', any(ell([7.2, 6.4, 6.4], [0, -9.5, 13]), ell([4.6, 4, 3.6], [0, -13.5, 11]), ell([3.4, 2.6, 2.4], [0, -15, 11.2]),
    ell([8.6, 4, 7], [0, -5.5, 13.5]))],
  ['ear*', petal([1.9, 0.6, 3.8], [5, -8, 19.2], [6, 28, 15])],
];

function assign(c, rgb) {
  if (near(rgb, PUFF, 0.02) && c[1] < -19) return 'breath';
  if (near(rgb, PAD, 0.03)) return c[0] >= 0 ? 'legBL' : 'legBR';
  if (isAny(rgb, ICE, 0.03)) {
    if (c[1] > 12) return 'tail1';
    if (c[2] > 15) return `ear${c[0] >= 0 ? 'L' : 'R'}`;
    return 'body';                                                           // the flank crystals
  }
  return pick(c, parts);
}

// the frost breath billows and drifts on every loop
const breath = (u, cycles, amp) => ({ breath: { s: 1 + amp * osc(u, cycles), p: [-0.4 * amp * osc(u, cycles, 0.25), -0.6 * amp, 0] } });

const clips = {
  ...quadrupedClips({
    face, tail: ['tail1'], hipH: 4, stride: 10,
    add: { idle: (t, u) => breath(u, 2, 0.15), walk: (t, u) => breath(u, 1, 0.1), celebrate: (t, u) => breath(u, 2, 0.25) },
  }),

  // fidget: a big inhale (the ball swells), then it blows a long frosty puff, the breath billowing out
  idle_puff: {
    seconds: 2.4,
    pose: (t, u) => {
      const inh = K(u, [[0, 0], [0.3, 1], [0.42, 0.2], [1, 0]]);
      const blow = K(u, [[0.35, 0], [0.45, 1], [0.8, 1], [0.95, 0]]);
      return merge({
        body: { s: [1 + 0.05 * inh, 1 + 0.03 * inh, 1 + 0.06 * inh] },
        head: { r: [-8 * inh + 4 * blow, 0, 0] },
        breath: { s: 0.6 + 0.9 * blow, p: [-1.5 * blow, -3 * blow, 0] },
        ...face.pose(blow > 0.4 ? 'happy' : 'open', blinks(u, [[0.15, 0.2]])),
      });
    },
  },

  // fidget: rolls onto one side and flaps a flipper, a seal's clap
  idle_clap: {
    seconds: 2,
    pose: (t, u) => {
      const roll = K(u, [[0, 0], [0.18, 1], [0.78, 1], [0.92, 0]]);
      const flap = Math.sin(TAU * 5 * u) * win(u, 0.2, 0.76, 0.04);
      return merge({
        body: { r: [0, 14 * roll, 0] },
        head: { r: [-6 * roll, -6 * roll, 10 * roll] },
        legFL: { r: [0, -30 * roll - 18 * flap, 0] },
        ...face.pose(roll > 0.5 ? 'happy' : 'open'),
        tail1: { r: [0, 0, 16 * flap] },
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
