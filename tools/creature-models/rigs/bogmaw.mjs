// Bogmaw's rig: a hulking crouched bog toad on splayed legs, a broad head with a grin of square teeth over an orange
// throat sac (the jaw), warts and moss over its back and a long crocodile tail curling to its left. Numbers are
// scad/bogmaw.scad's.
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, chain, ell, limb, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const THROAT = [0.8, 0.5, 0.3];
const MOSS = [0.4, 0.55, 0.22];
const MOUTH = [[0.88, 0.83, 0.66], [0.2, 0.12, 0.1]];

const eyeL = { side: 'L', at: [6.6, -10.6, 26.4], size: 1.7, yaw: -20, flat: 0.6 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.38, 0.36, 0.27] });

const TAIL = [[0, 16, 8], [5, 22, 4], [12, 25, 2.5], [19, 24, 1.8], [23, 20, 1.4]];
const tail = ['tail1', 'tail2', 'tail3'];

const joints = [
  { name: 'root', at: [0, 2, 0] },
  { name: 'legFL', parent: 'root', at: [10, -4, 15] },
  { name: 'legFR', parent: 'root', at: [-10, -4, 15] },
  { name: 'legBL', parent: 'root', at: [11, 8, 7] },
  { name: 'legBR', parent: 'root', at: [-11, 8, 7] },
  { name: 'body', parent: 'root', at: [0, 2, 10] },
  { name: 'head', parent: 'body', at: [0, -3, 19] },
  { name: 'jaw', parent: 'head', at: [0, -4, 17] },
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[1] },
  { name: 'tail3', parent: 'tail2', at: TAIL[3] },
  ...face.joints,
];

const parts = [
  ['legF*', any(limb([10, -4, 15], [14, -8, 9], 3, 2.4), limb([14, -8, 9], [13, -11, 1.4], 2.4, 2), ell([3, 3, 1.3], [13, -12, 1.2]),
    limb([13, -13.4, 1], [13, -16, 0.6], 1.6), ell([1.6, 1.6, 0.6], [14.5, -8.5, 10.2]))],
  ['legB*', any(ell([6, 7, 6], [11, 8, 7]), limb([12, 8, 5], [15, 4, 2], 3, 2.2), limb([15, 4, 2], [15, 0, 1.2], 2.2, 1.8),
    limb([15, -1, 1], [15, -3.6, 0.6], 1.6), ell([2.4, 2.4, 0.8], [13, 10, 11.5]))],
  ['body', any(ell([13, 11, 9], [0, 4, 13]), ell([12, 9, 9], [0, -3, 16]), ell([9, 8, 6], [0, 11, 9]), ell([9, 6, 6], [0, -5, 9]))],
  ['head', any(ell([13, 8, 5], [0, -7, 22]), ell([11, 6, 4], [0, -10, 23]), ell([3.6, 3.4, 2.8], [6.5, -8, 26]), ell([3.6, 3.4, 2.8], [-6.5, -8, 26]))],
  ['jaw', any(ell([12.5, 7, 4.5], [0, -9, 14.5]), ell([10, 5, 3], [0, -11, 15.5]))],
  ...chain(['tail1', 'tail2', 'tail3', 'tail3'], TAIL, [5, 4, 3, 2, 1]),
];

function assign(c, rgb) {
  if (isAny(rgb, MOUTH, 0.03)) return 'head';
  if (near(rgb, THROAT, 0.03)) return 'jaw';
  if (near(rgb, MOSS, 0.03) && c[1] < -14 && c[2] < 16.8) return 'jaw';      // moss drips off the jaw
  return pick(c, parts);
}

const clips = quadrupedClips({
  face, tail, hipH: 9, stride: 10,
  add: {
    idle: (t, u) => ({ jaw: { s: [1 + 0.04 * (osc(u, 4) * 0.5 + 0.5), 1, 1 + 0.08 * (osc(u, 4) * 0.5 + 0.5)] } }),
  },
});

// fidget: the throat sac swells huge and lets out a deep croak, twice
clips.idle_croak = {
  seconds: 2.4,
  pose: (t, u) => {
    const sw = (u0) => K(u, [[u0, 0], [u0 + 0.18, 1], [u0 + 0.28, 1], [u0 + 0.36, 0]]);
    const s = sw(0.08) + sw(0.5);
    return merge({
      jaw: { s: [1 + 0.18 * s, 1 + 0.1 * s, 1 + 0.35 * s], r: [-3 * s, 0, 0] },
      head: { r: [-5 * s, 0, 0] },
      body: { r: [-2 * s, 0, 0] },
      ...face.pose(s > 0.5 ? 'shut' : 'open'),
    }, Object.fromEntries(tail.map((n, i) => [n, { r: [0, 0, 4 * (1 + 0.3 * i) * osc(u, 2)] }])));
  },
};

// fidget: snaps at a fly, the maw clapping shut with a satisfied grin
clips.idle_fly = {
  seconds: 2,
  pose: (t, u) => {
    const look = K(u, [[0, 0], [0.2, 1], [0.45, 1], [0.6, 0]]);
    const snap = K(u, [[0.4, 0], [0.47, 1], [0.55, 0]]);
    const grin = win(u, 0.6, 0.95, 0.06);
    return {
      head: { r: [-10 * look + 8 * snap, 0, 18 * look] },
      jaw: { r: [30 * snap, 0, 0] },
      ...face.pose(grin > 0.4 ? 'happy' : 'open'),
    };
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
