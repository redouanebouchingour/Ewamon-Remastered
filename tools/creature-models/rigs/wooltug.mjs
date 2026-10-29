// Wooltug's rig: a sturdy shaggy sheep on four legs, a long sleepy face under a wool fringe, curled horns and a bell
// on a leather collar (its own joint, so it swings). Numbers are scad/wooltug.scad's.
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, ell, limb, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { fold, isAny, near, petalD, side } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const WOOL = [[0.93, 0.83, 0.64], [0.85, 0.73, 0.54]];
const FACE = [0.96, 0.82, 0.7];
const LEG = [0.88, 0.72, 0.62];
const HOOF = [0.32, 0.24, 0.18];
const BELL = [0.72, 0.52, 0.28];
const BELL_DK = [0.504, 0.364, 0.196];

const eyeL = { side: 'L', at: [3, -17, 25], size: 1.3, yaw: -22, flat: 0.6 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FACE });

const FRINGE = [[0, -14.6, 29, 3], [-3.6, -14, 28.4, 2.6], [3.6, -14, 28.4, 2.6], [0, -11, 30.4, 3.2],
  [-3.4, -10, 29.4, 2.8], [3.4, -10, 29.4, 2.8], [-1.8, -16.2, 27.6, 1.8], [1.8, -16.2, 27.6, 1.8],
  [0, -8, 26.5, 4.2], [-5.4, -12, 26, 2.2], [5.4, -12, 26, 2.2]];

const joints = [
  { name: 'root', at: [0, 1.5, 0] },
  { name: 'legFL', parent: 'root', at: [5.5, -7, 9] },
  { name: 'legFR', parent: 'root', at: [-5.5, -7, 9] },
  { name: 'legBL', parent: 'root', at: [5.5, 10, 9] },
  { name: 'legBR', parent: 'root', at: [-5.5, 10, 9] },
  { name: 'body', parent: 'root', at: [0, 3, 10] },
  { name: 'bell', parent: 'body', at: [0, -12.6, 17.4] },
  { name: 'head', parent: 'body', at: [0, -10, 21] },
  { name: 'earL', parent: 'head', at: [5, -12.4, 25] },
  { name: 'earR', parent: 'head', at: [-5, -12.4, 25] },
  { name: 'tail1', parent: 'body', at: [0, 16, 19] },
  ...face.joints,
];

const legT = (y) => any(limb([5.5, y, 9], [5.8, y - 0.5, 2.2], 1.9, 1.5), ell([2.1, 2.1, 1.4], [5.8, y - 0.8, 1.2]));
const parts = [
  ['legF*', legT(-7)],
  ['legB*', legT(10)],
  ['body', any(ell([14, 17.5, 12], [0, 3, 16]), ell([3.4, 3.4, 4.8], [8.5, -8, 8]), ell([3.4, 3.4, 4.8], [8.5, 0, 8]),
    ell([3.4, 3.4, 4.8], [8.5, 9, 8]), ell([3.4, 3.4, 4.8], [-8.5, -8, 8]), ell([3.4, 3.4, 4.8], [-8.5, 0, 8]), ell([3.4, 3.4, 4.8], [-8.5, 9, 8]))],
  ['head', any(ell([5.4, 5, 5.4], [0, -13, 24]), ell([3.6, 3, 3], [0, -17.5, 20.8]), ...FRINGE.map(([x, y, z, r]) => ell([r, r, r], [x, y, z])))],
  ['tail1', ell([2.4, 2.4, 3], [0, 18, 19])],
];

function assign(c, rgb) {
  const S = side(c);
  const F = c[1] < 1.5 ? 'F' : 'B';
  if (near(rgb, HOOF) || near(rgb, LEG)) return `leg${F}${S}`;
  if (isAny(rgb, [BELL, BELL_DK], 0.03) && c[2] < 18) return 'bell';
  if (near(rgb, FACE) && petalD(fold(c), [3, 1.3, 1.2], [7.4, -12.4, 25], [0, 15, 15]) < 1.4) return `ear${S}`;
  if (!isAny(rgb, WOOL)) return c[2] > 19.5 && c[1] < -8 ? 'head' : 'body';   // face, eyes, horns / collar
  return pick(c, parts);
}

const bellSwing = (amp, cycles, u, ph = 0) => ({ bell: { r: [amp * osc(u, cycles, ph), 0.6 * amp * osc(u, cycles, ph + 0.25), 0] } });

const clips = quadrupedClips({
  face, tail: ['tail1'], hipH: 9, stride: 14,
  add: {
    idle: (t, u) => bellSwing(2, 2, u),
    walk: (t, u) => bellSwing(10, 2, u, 0.1),
    idle_shake: (t, u) => bellSwing(18, 8, u),
    lunge: (t, u) => bellSwing(16, 1, u),
    hurt: (t, u) => bellSwing(20, 3, u),
    celebrate: (t, u) => bellSwing(16, 2, u),
    faint: (t, u) => bellSwing(10 * (1 - u), 2, u),
  },
});

// fidget: nods off standing up, the head sinking slowly, then jerks awake with a jingle
clips.idle_doze = {
  seconds: 3.2,
  pose: (t, u) => {
    const sink = K(u, [[0, 0], [0.15, 0], [0.7, 1], [0.74, 1], [0.8, -0.25], [0.95, 0]]);
    const jolt = win(u, 0.72, 0.9, 0.03);
    return merge({
      head: { r: [16 * sink, 0, 3 * sink] },
      body: { r: [2 * sink, 0, 0] },
      earL: { r: [12 * sink, 0, 0] },
      earR: { r: [12 * sink, 0, 0] },
      ...face.pose(sink > 0.4 ? 'shut' : 'open', sink > 0.4 ? 0 : blinks(u, [[0.9, 0.95]]) + sink * 1.5),
    }, bellSwing(18 * jolt, 6, u));
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
