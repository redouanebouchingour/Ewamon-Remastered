// Tuskling's rig: a baby woolly mammoth on four stumpy legs, a big round head under a snow cap, round ears, a trunk
// curled up to its right (a three-link chain passed as the template's mane), little ice tusks and a tufted tail.
// Numbers are scad/tuskling.scad's (the pre-sprite-pass model: re-rig when its new model lands).
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, blob, ell, limb, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { chainHit, isAny, near } from './lib/geo.mjs';
import { legs, quadrupedClips } from './lib/quadruped.mjs';

const FUR = [0.55, 0.33, 0.18];
const NAIL = [0.3, 0.3, 0.33];
const ICE = [0.55, 0.78, 0.95];
const TRUNK = [[0, -11.5, 14.5], [-0.5, -13.8, 11.5], [-3, -15.2, 10.5], [-6, -15, 12.5], [-7.8, -14, 16.5], [-8, -12.6, 20.5], [-7, -12.2, 22]];
const TRUNK_R = [2.6, 2.2, 1.9, 1.7, 1.5, 1.4, 1.2];
const trunk = ['trunk1', 'trunk2', 'trunk3'];
const LEGS = [['F', -2], ['B', 9]];

const eyeL = { side: 'L', at: [3.6, -10.9, 18.3], size: 2, yaw: -25 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FUR });

const joints = [
  { name: 'root', at: [0, 3, 0] },
  ...LEGS.flatMap(([k, y]) => [{ name: `leg${k}L`, parent: 'root', at: [5, y, 8] }, { name: `leg${k}R`, parent: 'root', at: [-5, y, 8] }]),
  { name: 'body', parent: 'root', at: [0, 3, 9] },
  { name: 'head', parent: 'body', at: [0, -3, 14] },
  { name: 'earL', parent: 'head', at: [7, -2.5, 17.5] },
  { name: 'earR', parent: 'head', at: [-7, -2.5, 17.5] },
  ...trunk.map((name, i) => ({ name, parent: i === 0 ? 'head' : trunk[i - 1], at: TRUNK[[0, 2, 4][i]] })),
  { name: 'tail1', parent: 'body', at: [0, 13.5, 13] },
  ...face.joints,
];

const legT = (y) => any(limb([5, y, 8], [5, y, 2.2], 2.8, 2.6), ell([2.6, 1, 1], [5, y - 2.3, 0.8]));
const parts = [
  ...LEGS.map(([k, y]) => [`leg${k}*`, legT(y)]),
  ['body', any(blob([[[9, 10, 7.5], [0, 4, 12]], [[8, 6, 6.5], [0, -1, 12]]]), ell([10.6, 12, 6], [0, 3.5, 9]))],
  ['head', any(blob([[[8.5, 7.5, 8], [0, -5, 17.5]], [[5.5, 4.5, 4.5], [0, -9.5, 14.5]]]), ell([3, 1.4, 3.2], [3.6, -10.6, 18.3]),
    ell([3, 1.4, 3.2], [-3.6, -10.6, 18.3]))],
  ['ear*', ell([2.7, 1.6, 3.4], [7.7, -3.4, 17.5])],
  ['tail1', any(limb([0, 13.5, 13], [0, 15.5, 9.5], 0.8, 0.6), ell([1.2, 1.2, 1.6], [0, 15.8, 8.6]))],
];

function assign(c, rgb) {
  if (near(rgb, NAIL, 0.03)) return pick(c, parts.slice(0, 2));
  if (near(rgb, ICE, 0.03)) return 'head';
  const t = chainHit(c, TRUNK, TRUNK_R);
  if (t.d < 1.2 && (c[1] < -13 || c[0] < -3.5)) return trunk[[0, 0, 1, 1, 2, 2][t.i]];
  if (isAny(rgb, [FUR], 0.01) && t.d < 1.1 && c[1] < -11.8) return trunk[[0, 0, 1, 1, 2, 2][t.i]];
  return pick(c, parts);
}

const clips = {
  ...quadrupedClips({ face, tail: ['tail1'], mane: trunk, hipH: 8, stride: 16 }),

  // fidget: swings its trunk up and gives a tiny trumpet, bouncing on its front feet, ^ ^
  idle_toot: {
    seconds: 2.2,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.2, 1], [0.62, 1], [0.8, 0]]);
      const bnc = Math.abs(Math.sin(TAU * 3 * u)) * win(u, 0.22, 0.6, 0.04);
      return merge({
        body: { r: [-4 * bnc, 0, 0] },
        head: { r: [-8 * up, 0, 0] },
        ...Object.fromEntries(trunk.map((n, i) => [n, { r: [-20 * up * (1 + 0.3 * i), 0, 0] }])),
        ...legs({ r: [-10 * bnc, 0, 0] }, { r: [0, 0, 0] }),
        ...face.pose(up > 0.5 ? 'happy' : 'open'),
        earL: { r: [0, 0, -20 * up + 6 * osc(u, 6) * up] },
        earR: { r: [0, 0, 20 * up - 6 * osc(u, 6) * up] },
      });
    },
  },

  // fidget: flaps its round ears like fans and shakes the snow cap
  idle_ears: {
    seconds: 1.6,
    pose: (t, u) => {
      const on = win(u, 0.08, 0.84, 0.06);
      const fl = Math.sin(TAU * 5 * u) * on;
      return merge({
        head: { r: [0, 3 * fl, 0] },
        earL: { r: [0, 0, -26 * on - 14 * fl] },
        earR: { r: [0, 0, 26 * on + 14 * fl] },
        ...face.pose(on > 0.4 ? 'shut' : 'open'),
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
