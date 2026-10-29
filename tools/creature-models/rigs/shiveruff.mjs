// Shiveruff's rig: an arctic fox pup on four navy-socked legs, an icy ruff on the body, a big head with crystal-lined
// ears and a crown of ice crystals, a snowball tail. Numbers are scad/shiveruff.scad's (the pre-sprite-pass model:
// re-rig when its new model lands).
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, ell, limb, pick, spike } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { capD, isAny, near } from './lib/geo.mjs';
import { legs, quadrupedClips } from './lib/quadruped.mjs';

const FUR = [0.93, 0.95, 1];
const RUFF = [[0.55, 0.82, 0.95], [0.38, 0.68, 0.9]];
const ICE = [[0.62, 0.86, 0.98], [0.4, 0.7, 0.93]];
const PAW = [0.12, 0.2, 0.42];
const LEGS = [['F', -4], ['B', 7.5]];

const eyeL = { side: 'L', at: [3.6, -14, 24], size: 2.3, yaw: -22 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FUR });

const joints = [
  { name: 'root', at: [0, 1, 0] },
  ...LEGS.flatMap(([k, y]) => [{ name: `leg${k}L`, parent: 'root', at: [4, y, 10] }, { name: `leg${k}R`, parent: 'root', at: [-4, y, 10] }]),
  { name: 'body', parent: 'root', at: [0, 1, 11] },
  { name: 'head', parent: 'body', at: [0, -7, 17] },
  { name: 'earL', parent: 'head', at: [4.5, -7, 28] },
  { name: 'earR', parent: 'head', at: [-4.5, -7, 28] },
  { name: 'tail1', parent: 'body', at: [0, 9, 16] },
  ...face.joints,
];

const legT = (y) => any(limb([4, y, 10], [4, y - 0.6, 1.2], 2.5, 2.4), ell([2.7, 3.3, 1.4], [4, y - 1.2, 1.4]), spike([4, y - 2.3, 5], [0, -0.3, -1.6], 1.1));
const parts = [
  ...LEGS.map(([k, y]) => [`leg${k}*`, legT(y)]),
  ['body', any(ell([6.5, 6.5, 6], [0, -2, 11.5]), ell([6, 6, 5.5], [0, 5, 11]))],
  ['head', any(ell([8.4, 7.6, 7.6], [0, -8, 23]), ell([3.6, 2.6, 2.6], [0, -14.4, 20.6]), ell([2.6, 1.6, 1.4], [0, -15.6, 19.2]),
    spike([6.8, -9, 21], [2.6, -0.3, -0.9], 1.8), spike([-6.8, -9, 21], [-2.6, -0.3, -0.9], 1.8))],
  ['ear*', (c) => Math.min(capD(c, [4.5, -7, 28], [6.4, -7, 35.5], 2.9, 0.4), capD(c, [4.8, -9, 28.5], [6, -9.2, 34.1], 1.2))],
  ['tail1', ell([7, 6.5, 7], [0, 13.5, 19])],
];

function assign(c, rgb) {
  if (near(rgb, PAW)) return pick(c, parts.slice(0, 2));
  if (isAny(rgb, RUFF, 0.03)) return c[1] > 8.5 ? 'tail1' : 'body';
  if (isAny(rgb, ICE, 0.03)) {
    const S = c[0] >= 0 ? 'L' : 'R';
    const f = [Math.abs(c[0]), c[1], c[2]];
    if (capD(f, [4.8, -9, 28.5], [6, -9.2, 34.1], 1.4) < 1.3) return `ear${S}`;
    return 'head';
  }
  return pick(c, parts);
}

const clips = {
  ...quadrupedClips({ face, tail: ['tail1'], hipH: 10, stride: 16 }),

  // fidget: shivers from nose to tail, the ruff and snowball tail fluffing up, then a pleased ^ ^
  idle_shiver: {
    seconds: 2,
    pose: (t, u) => {
      const on = win(u, 0.08, 0.66, 0.05);
      const sh = Math.sin(TAU * 18 * u) * on;
      const happy = win(u, 0.7, 0.95, 0.04);
      return merge({
        body: { r: [0, 2 * sh, 0], s: [1 + 0.05 * on, 1, 1 + 0.03 * on] },
        head: { r: [-4 * happy, 1.5 * sh, 8 * happy] },
        tail1: { s: 1 + 0.12 * on, r: [10 * happy, 0, 0] },
        ...legs({ r: [0, 1.5 * sh, 0] }),
        ...face.pose(on > 0.4 ? 'squeeze' : happy > 0.4 ? 'happy' : 'open'),
        earL: { r: [-10 * on, 0, 0] },
        earR: { r: [-10 * on, 0, 0] },
      });
    },
  },

  // fidget: a fox pounce on its own spot: crouch, wiggle the rump, hop nose down
  idle_pounce: {
    seconds: 2.4,
    pose: (t, u) => {
      const crouch = K(u, [[0, 0], [0.2, 1], [0.5, 1], [0.58, 0]]);
      const wig = osc(u, 10) * win(u, 0.22, 0.48, 0.04);
      const hop = K(u, [[0.5, 0], [0.62, 1], [0.76, 0]]);
      return merge({
        root: { p: [0, 0, -0.8 * crouch + 3 * hop] },
        body: { r: [5 * crouch + 14 * hop, 0, 4 * wig] },
        head: { r: [8 * crouch + 12 * hop, 0, 0] },
        ...legs({ r: [-10 * crouch - 20 * hop, 0, 0] }, { r: [6 * crouch + 20 * hop, 0, 0] }),
        tail1: { r: [12 * crouch, 0, 14 * wig] },
        ...face.pose(hop > 0.3 ? 'shut' : 'open', 0.3 * crouch),
        earL: { r: [10 * crouch, 0, 0] },
        earR: { r: [10 * crouch, 0, 0] },
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
