// Mufflo's rig: a round lamb that is almost all fleece, on four short pink legs, a pink face peeking out of a woolly
// fringe (the fringe goes with the head), floppy ears and a little curled tail. Numbers are scad/mufflo.scad's.
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, chain, ell, limb, pick, petal } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const FACE = [0.98, 0.84, 0.78];
const FRINGE = [[0, -13, 26.4, 3], [-3.8, -12.4, 25.6, 2.8], [3.8, -12.4, 25.6, 2.8], [-6, -11, 23.4, 2.4], [6, -11, 23.4, 2.4], [0, -9.5, 28, 3.2],
  [-3.2, -8, 27, 3], [3.2, -8, 27, 3], [-1.9, -14.6, 24.6, 1.8], [1.9, -14.6, 24.6, 1.8], [0, -6, 25, 4]];
const TAIL = [[0, 15, 16], [0, 17.5, 18.5], [0, 17, 21.5], [0, 15.6, 21]];

const eyeL = { side: 'L', at: [3, -15.4, 21.6], size: 1.4, yaw: -22, flat: 0.6 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FACE });

const joints = [
  { name: 'root', at: [0, 3, 0] },
  { name: 'legFL', parent: 'root', at: [6, -4, 5] },
  { name: 'legFR', parent: 'root', at: [-6, -4, 5] },
  { name: 'legBL', parent: 'root', at: [6, 10, 5] },
  { name: 'legBR', parent: 'root', at: [-6, 10, 5] },
  { name: 'body', parent: 'root', at: [0, 3, 5] },
  { name: 'head', parent: 'body', at: [0, -9, 19] },
  { name: 'earL', parent: 'head', at: [5.5, -11, 21.8] },
  { name: 'earR', parent: 'head', at: [-5.5, -11, 21.8] },
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  ...face.joints,
];

const leg = (y) => any(limb([6, y, 5], [6, y, 1.2], 2.1, 1.9), ell([2.1, 2.3, 1.1], [6, y - 0.3, 1.1]));
const parts = [
  ['legF*', leg(-4)],
  ['legB*', leg(10)],
  ['body', ell([13.5, 14.5, 11], [0, 3, 12.5])],
  ['head', any(ell([5.6, 5, 5.2], [0, -11.5, 20.5]), ell([3.6, 2.8, 2.6], [0, -15, 18.6]), ...FRINGE.map(([x, y, z, r]) => ell([r, r, r], [x, y, z])))],
  ['ear*', any(petal([3.4, 1.5, 1.4], [7.6, -11.2, 21.8], [0, 15, 20]), petal([2.4, 0.8, 0.9], [7.8, -12.3, 21.6], [0, 15, 20]))],
  ...chain(['tail1'], TAIL, [1.9, 1.8, 1.6, 1.3]),
];

const assign = (c) => pick(c, parts);

const base = quadrupedClips({
  face, tail: ['tail1'], hipH: 5, stride: 18,
  add: {
    // the ears flop: they lag the head and swing down
    walk: (t, u) => ({ earL: { r: [0, 8 * osc(u, 2, 0.2), 0] }, earR: { r: [0, -8 * osc(u, 2, 0.2), 0] } }),
    celebrate: (t, u) => ({ earL: { r: [0, 14 * osc(u, 2, 0.2), 0] }, earR: { r: [0, -14 * osc(u, 2, 0.2), 0] } }),
  },
});

const clips = {
  ...base,
  // fidget: a boing: the fleece squashes down onto the legs and springs back up with a wobble
  idle_boing: {
    seconds: 1.6,
    pose: (t, u) => {
      const sq = K(u, [[0, 0], [0.2, 1], [0.32, -0.6], [0.46, 0.35], [0.6, -0.15], [0.75, 0]]);
      return merge({
        body: { s: [1 + 0.07 * sq, 1 + 0.07 * sq, 1 - 0.1 * sq] },
        head: { p: [0, 0, -1.2 * sq] },
        earL: { r: [0, -12 * sq, 0] },
        earR: { r: [0, 12 * sq, 0] },
        ...face.pose(sq > 0.5 ? 'happy' : 'open'),
      });
    },
  },
  // fidget: dozes off standing, head nodding lower and lower, then a startled blink awake
  idle_doze: {
    seconds: 3,
    pose: (t, u) => {
      const nod = K(u, [[0, 0], [0.3, 0.5], [0.4, 0.3], [0.7, 1], [0.76, 0]]);
      const sway = Math.sin(TAU * 2 * u) * win(u, 0.05, 0.7, 0.1);
      return merge({
        head: { r: [14 * nod, 0, 3 * sway] },
        body: { r: [0, 1.5 * sway, 0] },
        ...face.pose(nod > 0.4 && u < 0.72 ? 'shut' : 'open', blinks(u, [[0.8, 0.85], [0.87, 0.91]])),
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
