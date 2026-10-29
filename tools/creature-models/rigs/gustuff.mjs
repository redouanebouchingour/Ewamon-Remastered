// Gustuff's rig: a cloud-wool lamb on four legs, curled ram horns, little feathered wing-ears and two feather fans on
// its back. The quadruped template has no wings: wingL / wingR (off the body) move through the `add` layers. Numbers
// are scad/gustuff.scad's.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, ell, limb, petal, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const WOOL = [0.88, 0.87, 1];
const WINGS = [[0.66, 0.8, 0.97], [0.85, 0.92, 1]];
const HOOF = [0.3, 0.22, 0.18];

const eyeL = { side: 'L', at: [2.7, -17.2, 22.8], size: 1.7, yaw: -18 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.86, 0.85, 0.98] });

const PUFFS = [[-6, -5, 15, 4.5], [6, -5, 15, 4.5], [0, -8, 13, 4.5], [-6.5, 2, 16, 4.5], [6.5, 2, 16, 4.5],
  [-5, 8, 15, 4.2], [5, 8, 15, 4.2], [0, 11, 14, 4.5], [0, 3, 20, 5], [-4, -3, 20, 4.2], [4, -3, 20, 4.2],
  [0, 9, 19, 4], [-7, 6, 10, 3.8], [7, 6, 10, 3.8], [-6.5, -3, 10, 3.8], [6.5, -3, 10, 3.8], [0, 0, 8.5, 4.5], [0, -6, 9, 3.8]];

const joints = [
  { name: 'root', at: [0, 1, 0] },
  { name: 'legFL', parent: 'root', at: [4.6, -5, 8] },
  { name: 'legFR', parent: 'root', at: [-4.6, -5, 8] },
  { name: 'legBL', parent: 'root', at: [4.6, 7, 8] },
  { name: 'legBR', parent: 'root', at: [-4.6, 7, 8] },
  { name: 'body', parent: 'root', at: [0, 1, 10] },
  { name: 'head', parent: 'body', at: [0, -9, 18] },
  { name: 'earL', parent: 'head', at: [6.8, -9.5, 27.5] },
  { name: 'earR', parent: 'head', at: [-6.8, -9.5, 27.5] },
  { name: 'wingL', parent: 'body', at: [5.5, 2, 21] },
  { name: 'wingR', parent: 'body', at: [-5.5, 2, 21] },
  { name: 'tail1', parent: 'body', at: [0, 12.5, 16] },
  ...face.joints,
];

const legT = (y) => any(ell([3, 3, 3.4], [4.6, y, 7]), limb([4.6, y, 6], [4.6, y - 0.5, 1.6], 1.8, 1.6), ell([1.9, 2.2, 1.2], [4.6, y - 0.8, 1.1]));
const parts = [
  ['legF*', legT(-5)],
  ['legB*', legT(7)],
  ['body', any(ell([8, 10, 7], [0, 2, 13]), ell([7, 6, 7], [0, -4, 14]), ...PUFFS.map(([x, y, z, r]) => ell([r, r, r * 0.92], [x, y, z])))],
  ['tail1', ell([3.2, 3, 3], [0, 14, 17])],
  ['head', any(ell([7.5, 7, 6.8], [0, -11, 22]), ell([3.6, 3.6, 3.6], [4.2, -10, 26]), ell([3.6, 3.6, 3.6], [-4.2, -10, 26]),
    ell([4, 3.6, 4.6], [0, -10, 28]), ell([5.4, 3, 4.6], [0, -15, 21]), ell([3.6, 2.4, 2.8], [0, -17, 19.2]),
    ell([5.5, 3.5, 5.5], [7.2, -11, 24.5]), ell([5.5, 3.5, 5.5], [-7.2, -11, 24.5]))],
];
const ear = (f) => Math.min(...[0, 1, 2].map((k) => petal([0.9, 1.4, 4.2 - k * 0.6], [7.2 + k * 0.9, -9.5, 29.5 - k * 0.4], [0, 25 + k * 18, 0])(f)));
const wing = (f) => Math.min(...[0, 1, 2, 3, 4].map((k) => {
  const L = 8 - k * 0.9;
  return petal([1.2, 2.2, L], [6 + k * 1.2, 2 + k * 1.6, 22 + L * 0.6], [-35 - k * 6, 40 + k * 5, 0])(f);
}));

function assign(c, rgb) {
  const S = c[0] >= 0 ? 'L' : 'R';
  const f = [Math.abs(c[0]), c[1], c[2]];
  if (near(rgb, HOOF)) return `leg${c[1] < 1 ? 'F' : 'B'}${S}`;
  if (isAny(rgb, WINGS, 0.03)) return ear(f) < wing(f) ? `ear${S}` : `wing${S}`;
  if (!near(rgb, WOOL) && c[2] > 16 && c[1] < -6) return 'head';          // face, eyes, nose, horns
  return pick(c, parts);
}

// the back wings: `up` spreads them outwards (ry), `beat` flaps them
const W = (up, beat = 0) => both('wing', { r: [0, -(up + beat), 0] });
const clips = quadrupedClips({
  face, tail: ['tail1'], hipH: 8, stride: 16,
  add: {
    idle: (t, u) => W(2 * osc(u, 2), 0),
    walk: (t, u) => W(6, 6 * osc(u, 2)),
    idle_sniff: (t, u) => W(2, 0),
    idle_shake: (t, u) => W(10, 14 * Math.sin(TAU * 8 * u) * win(u, 0.1, 0.9, 0.05)),
    windup: (t, u) => W(20 * Math.min(1, u / 0.8)),
    lunge: (t, u) => W(20 * K(u, [[0, 1], [0.4, 0.2], [1, 0]]), 16 * K(u, [[0.2, 0], [0.4, 1], [0.7, 0]])),
    hurt: (t, u) => W(24 * K(u, [[0, 0], [0.18, 1], [1, 0.3]])),
    faint: (t, u) => W(-10 * Math.min(1, u / 0.7)),
    celebrate: (t, u) => W(20, 22 * Math.sin(TAU * 4 * u)),
    enter: (t, u) => W(26 * win(u, 0.4, 0.9, 0.12)),
  },
});

// fidget: flutters the back wings and the wing-ears, lifting into a tiny floaty hop
clips.idle_flutter = {
  seconds: 1.8,
  pose: (t, u) => {
    const on = win(u, 0.1, 0.85, 0.08);
    const fl = Math.sin(TAU * 8 * u) * on;
    return merge({
      root: { p: [0, 0, 1.4 * Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.2) / 0.55))) * on] },
      body: { r: [-3 * on, 0, 0] },
      head: { r: [-6 * on, 0, 0] },
      earL: { r: [0, -12 * fl, 0] },
      earR: { r: [0, 12 * fl, 0] },
      ...face.pose(on > 0.4 ? 'happy' : 'open', blinks(u, [[0.9, 0.95]])),
    }, W(16 * on, 18 * fl));
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
