// Slushpup's rig: a chubby seal pup lying on its belly, the front flippers and the round hind paws on its flanks as
// short legs, a round head low at the front with crystal ears, a crystal tail cluster and a cloud of frost breath (its
// own joint, so it can billow). Numbers are scad/slushpup.scad's (the 2026-11-06 sprite-match model, second pass).
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, ell, limb, petal, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { ellD, isAny, near } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const FUR = [0.84, 0.89, 0.92];
const FUR_LO = [0.71, 0.78, 0.83];
const FLIP = [0.94, 0.97, 0.98];
const BELLY_C = [0.90, 0.94, 0.96];
const ICE = [[0.60, 0.74, 0.85], [0.80, 0.90, 0.96]];
const PAD = [0.56, 0.73, 0.88];
const PUFF = [[0.93, 0.97, 0.99], [0.74, 0.82, 0.87]];
const EYE_INK = [[0.12, 0.14, 0.21], [0.47, 0.57, 0.63], [1, 1, 1]];

// the scad's masses
const BODY = [[20, 21, 18.5], [0, 10, 18.5]];
const BELLY = [[13, 10, 11], [0, -12, 11]];
const REAR = [[17, 12, 13], [0, 22, 13]];
const HEADT = [[10.5, 9.5, 8.5], [0, -18, 27]];
const HEADB = [[11.5, 9, 7.5], [0, -19.5, 19.5]];
const NECK = [[12, 8, 10], [0, -9, 22]];
const MUZ = [[5, 3.4, 3.8], [0, -27.6, 14.8]];
const FL_ROOT = [12.5, -6, 14];
const FL_MID = [12.6, -10.5, 9];
const FL_TIP = [10.8, -15, 4.6];
const PAW = [17.6, 1.2, 10.5];
const PAW_R = [3.4, 5.8, 6.5];
const PAW_YAW = -38;
const TAIL = [12, 30.5, 11];
const EAR = [8.5, -19.5, 30];

// the eye: front(HEADB, 5, 19.6, 0.75) in the scad
const frontY = ([r, c], x, z, s) => c[1] - r[1] * Math.sqrt(Math.max(0, 1 - ((x - c[0]) / r[0]) ** 2 - ((z - c[2]) / r[2]) ** 2)) + s;
const EYE = [5, frontY(HEADB, 5, 19.6, 0.75), 19.6];
const ES = 2.6;
const eyeL = { side: 'L', at: EYE, size: ES, yaw: 28, flat: 0.6 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FUR });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legFL', parent: 'root', at: FL_ROOT },
  { name: 'legFR', parent: 'root', at: [-FL_ROOT[0], FL_ROOT[1], FL_ROOT[2]] },
  { name: 'legBL', parent: 'root', at: PAW },
  { name: 'legBR', parent: 'root', at: [-PAW[0], PAW[1], PAW[2]] },
  { name: 'body', parent: 'root', at: [0, 2, 4] },
  { name: 'head', parent: 'body', at: [0, -11, 19] },
  { name: 'earL', parent: 'head', at: EAR },
  { name: 'earR', parent: 'head', at: [-EAR[0], EAR[1], EAR[2]] },
  { name: 'eyeL', parent: 'head', at: EYE },
  { name: 'eyeR', parent: 'head', at: [-EYE[0], EYE[1], EYE[2]] },
  { name: 'breath', parent: 'head', at: [-2, -31, 14] },
  { name: 'tail1', parent: 'body', at: TAIL },
  ...face.joints,
];

const parts = [
  ['legF*', any(limb(FL_ROOT, FL_MID, 2.4, 2.6), limb(FL_MID, FL_TIP, 2.6, 2.4))],
  ['legB*', petal(PAW_R, PAW, [0, 0, PAW_YAW])],
  ['body', any(ell(...BODY), ell(...BELLY), ell(...REAR))],
  ['head', any(ell(...HEADT), ell(...HEADB), ell(...NECK), ell(...MUZ))],
  ['tail1', ell([4, 4.5, 3.6], TAIL)],
];

function assign(c, rgb) {
  const S = c[0] >= 0 ? 'L' : 'R';
  if (isAny(rgb, PUFF, 0.02) && c[1] < -27) return 'breath';
  if (near(rgb, PAD, 0.03)) return `legB${S}`;
  if (near(rgb, FLIP, 0.015)) return `legF${S}`;
  if (isAny(rgb, ICE, 0.03)) return c[2] > 26 ? `ear${S}` : 'tail1';
  const nearEye = Math.hypot(Math.abs(c[0]) - EYE[0], c[1] - EYE[1], c[2] - EYE[2]) < ES * 1.35;
  if (nearEye && isAny(rgb, EYE_INK, 0.03)) return `eye${S}`;
  if (near(rgb, FUR_LO, 0.02) || near(rgb, BELLY_C, 0.012)) return 'body';
  if (!near(rgb, FUR, 0.02)) return 'head';                                   // nose, mouth, brows, muzzle
  const j = pick(c, parts);
  if (j !== 'head' && j !== 'body') return j;
  // the ball (and its back tufts) is body; the neck hull in front of it and above the chest is head, a clean cut
  if (Math.min(ellD(c, ...BODY), ellD(c, ...REAR)) < 1.06) return 'body';
  return c[2] > 11.5 && c[1] < -9 ? 'head' : 'body';
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
