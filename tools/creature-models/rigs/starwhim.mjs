// Starwhim's rig: a slender sky deer on four long legs (the front right lifted mid-step), the neck and head one joint,
// golden crescent antlers, a pastel mane streaming back in two links, a star trail on the ground at its hooves (left on
// the root, so it stays where it lies). Numbers are scad/starwhim.scad's (the pre-sprite-pass model: re-rig when its
// new model lands).
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, ell, limb, petal, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { chainHit, isAny, near } from './lib/geo.mjs';
import { legs, quadrupedClips } from './lib/quadruped.mjs';

const BLUE = [0.4, 0.6, 0.92];
const HOOF = [0.22, 0.3, 0.55];
const AQUA = [0.55, 0.88, 0.95];
const STAR_COLS = [[0.98, 0.82, 0.45], [0.72, 0.62, 0.95], [0.58, 0.76, 1], [0.28, 0.42, 0.78]];
const MANE = [[0.72, 0.62, 0.95], [0.98, 0.82, 0.45], [0.55, 0.88, 0.95], [0.95, 0.75, 0.9]];

const LEGS = {
  legFL: [[2, -5, 16], [2.2, -5.5, 8.5], [2.2, -5, 1.2]],
  legFR: [[-2, -5, 16], [-2.4, -8.5, 9.5], [-2.4, -9.5, 4.5]],
  legBL: [[2, 6.5, 16], [2.3, 8, 8.5], [2.2, 6.5, 1.2]],
  legBR: [[-2, 6.5, 16], [-2.3, 8.2, 8.5], [-2.2, 7, 1.2]],
};
const LOCKS = [[[0, -6.5, 32], [-1, -3, 34], [-2.5, 0.5, 34], [-3.5, 4, 36], [-5, 7, 36.5], [-7, 8.5, 38]],
  [[0, -6, 30.5], [-1.2, -2.5, 31], [-2.8, 1, 30.5], [-4, 4.5, 31.5], [-6, 8, 30.5], [-8, 9.5, 31.5]],
  [[0, -5.5, 28.5], [-0.8, -2, 27.5], [-2, 1.5, 26.5], [-3.5, 4.5, 26], [-5.5, 7.5, 24], [-7.5, 8, 25]],
  [[0.6, -6.5, 31], [1.4, -3, 32], [2, 0.5, 30], [2, 3.5, 28.5]],
  [[0, -5, 26], [-0.6, -2, 24.5], [-1.5, 1.5, 22.5], [-3, 4.5, 20.5], [-4, 6, 21.5]]];
const mane = ['mane1', 'mane2'];

const eyeL = { side: 'L', at: [2, -9.8, 30.6], size: 0.9, yaw: -55 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: BLUE });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...Object.entries(LEGS).map(([name, pts]) => ({ name, parent: 'root', at: pts[0] })),
  { name: 'body', parent: 'root', at: [0, 0.5, 17] },
  { name: 'head', parent: 'body', at: [0, -5.5, 21] },
  { name: 'earL', parent: 'head', at: [2.4, -6.8, 31] },
  { name: 'earR', parent: 'head', at: [-2.4, -6.8, 31] },
  { name: 'mane1', parent: 'head', at: [-0.5, -5, 29] },
  { name: 'mane2', parent: 'mane1', at: [-2.4, 1, 29] },
  { name: 'tail1', parent: 'body', at: [0, 10, 20] },
  ...face.joints,
];

const parts = [
  ...Object.entries(LEGS).map(([name, pts]) => [name, (c) => chainHit(c, pts, [1.6, 1, 0.8]).d]),
  ['body', any(ell([4, 4.6, 4.4], [0, -5, 18]), ell([3.6, 5, 3.8], [0, 0.5, 17.5]), ell([4, 4.4, 4.4], [0, 6, 18]), ell([3, 3.4, 2.4], [0, -0.5, 14.6]))],
  ['head', any(limb([0, -5.5, 20], [0, -7.5, 28], 3, 2), ell([2.8, 3.2, 2.7], [0, -8.2, 30]), limb([0, -9, 29.6], [0, -12.6, 28.4], 2.1, 1.3))],
  ['ear*', petal([0.9, 0.6, 2.2], [2.4, -6.8, 32.2], [10, 50, 0])],
  ['tail1', limb([0, 10, 20], [0, 11.5, 22.5], 1.2, 0.6)],
];

function assign(c, rgb) {
  if (c[2] < 3.2 && (c[1] > 8.8 || c[0] < -3.4) && isAny(rgb, [...STAR_COLS, AQUA], 0.03)) return 'root';   // the star trail
  if (near(rgb, AQUA, 0.02) && chainHit(c, LOCKS[2], [1, 1, 1, 1, 1, 1]).d > 2.2) return c[2] > 24 ? 'head' : 'body';   // sparkles
  if (near(rgb, HOOF, 0.03)) return pick(c, parts.slice(0, 4));
  if (isAny(rgb, MANE, 0.03) && c[2] > 19) {
    // the antlers and the forehead mark are gold too
    if (Math.abs(c[0]) > 1.2 && c[1] < -5.5 && c[2] > 31) return 'head';
    if (near(rgb, MANE[1], 0.03) && c[1] < -9.5) return 'head';
    const lock = Math.min(...LOCKS.map((l) => chainHit(c, l, l.map(() => 1.8)).d));
    if (lock < 1.4) return c[1] < 0.5 ? 'mane1' : 'mane2';
    return 'head';
  }
  return pick(c, parts);
}

const clips = {
  ...quadrupedClips({ face, tail: ['tail1'], mane, hipH: 15, stride: 14 }),

  // fidget: rears up on the hind legs and paws at the sky, the mane flying, ^ ^
  idle_rear: {
    seconds: 2.4,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.25, 1], [0.65, 1], [0.85, 0]]);
      const paw = osc(u, 4) * win(u, 0.25, 0.65, 0.05);
      return merge({
        body: { r: [-22 * up, 0, 0] },
        head: { r: [10 * up, 0, 0] },
        ...legs({ r: [-40 * up + 14 * paw, 0, 0] }, { r: [22 * up, 0, 0] }, { r: [-40 * up - 14 * paw, 0, 0] }),
        mane1: { r: [-8 * up, 0, 6 * osc(u, 3)] },
        mane2: { r: [-10 * up, 0, 10 * osc(u, 3, 0.2)] },
        ...face.pose(up > 0.5 ? 'happy' : 'open'),
      });
    },
  },

  // fidget: lifts its head to the stars, the ears turning, a slow blink
  idle_stargaze: {
    seconds: 3,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.2, 1], [0.75, 1], [0.92, 0]]);
      const ear = osc(u, 3) * win(u, 0.2, 0.75, 0.06);
      return merge({
        head: { r: [-14 * up, 0, 8 * Math.sin(TAU * u) * up] },
        earL: { r: [0, 0, 20 * ear] },
        earR: { r: [0, 0, -20 * ear] },
        mane1: { r: [0, 0, 4 * osc(u, 2)] },
        ...face.pose('open', blinks(u, [[0.42, 0.56]])),
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
