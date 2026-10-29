// Cirrileap's rig: a long-legged cloud ram, golden curled horns (part of the head), a cloud ruff, a billowing cloud
// tail and two great feathered wings off the shoulders. The quadruped template has no wings: wingL / wingR are moved
// by `add` layers. Numbers are scad/cirrileap.scad's.
import { K, TAU, both, merge, osc, rigDef, shake, smooth, win } from './lib/anim.mjs';
import { any, blob, ell, limb, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near, side } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const FACE = [0.72, 0.82, 1];
const WINGS = [[0.45, 0.6, 0.95], [0.72, 0.84, 1], [0.28, 0.42, 0.82]];
const HORNS = [[0.72, 0.55, 0.3], [0.5, 0.36, 0.18]];
const HOOF = [0.25, 0.3, 0.6];
const TAIL = [[0, 13, 21, 4], [0, 16, 24, 3.6], [0, 18.5, 27.5, 3.2], [0, 18.5, 31, 2.6], [0, 16.5, 33, 2]];
const tail = ['tail1', 'tail2'];
// the body's cloud puffs and the ruff's
const PUFFS = [[-5.5, -5, 19, 4.5], [5.5, -5, 19, 4.5], [0, -8, 17, 4.6], [-6, 2, 20, 4.2], [6, 2, 20, 4.2], [-5, 8, 19, 4], [5, 8, 19, 4],
  [0, 4, 23.5, 4.5], [-6, -2, 14.5, 3.8], [6, -2, 14.5, 3.8], [-5.5, 7, 14.5, 3.6], [5.5, 7, 14.5, 3.6], [0, 1, 13, 4.2],
  [0, -11, 21, 4.6], [-4.5, -9.5, 23, 4], [4.5, -9.5, 23, 4], [0, -10, 26, 4], [-3.5, -8, 26.5, 3.4], [3.5, -8, 26.5, 3.4], [0, -12.5, 17, 3.6]];

const eyeL = { side: 'L', at: [2.8, -16.2, 31.6], size: 1.4, yaw: -22 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FACE });

const joints = [
  { name: 'root', at: [0, 1, 0] },
  { name: 'legFL', parent: 'root', at: [4.4, -6, 12] },
  { name: 'legFR', parent: 'root', at: [-4.4, -6, 12] },
  { name: 'legBL', parent: 'root', at: [4.4, 8, 12] },
  { name: 'legBR', parent: 'root', at: [-4.4, 8, 12] },
  { name: 'body', parent: 'root', at: [0, 1, 13] },
  { name: 'head', parent: 'body', at: [0, -10, 27] },
  { name: 'earL', parent: 'head', at: [4.4, -10.5, 32] },
  { name: 'earR', parent: 'head', at: [-4.4, -10.5, 32] },
  { name: 'wingL', parent: 'body', at: [5, -2, 25] },
  { name: 'wingR', parent: 'body', at: [-5, -2, 25] },
  { name: 'tail1', parent: 'body', at: [0, 12, 20] },
  { name: 'tail2', parent: 'tail1', at: [0, 18, 27.5] },
  ...face.joints,
];

const leg = (y) => any(ell([3, 3.2, 3.4], [4.4, y, 12]), limb([4.4, y, 11], [4.4, y - 0.5, 1.6], 2, 1.5), ell([2.6, 2.6, 2.4], [4.4, y - 0.2, 8]),
  ell([1.9, 2.3, 1.2], [4.4, y - 0.9, 1.1]));
const parts = [
  ['legF*', leg(-6)],
  ['legB*', leg(8)],
  ['body', any(blob([[[7, 10, 6.5], [0, 2, 17]], [[7, 6, 7], [0, -5, 18]]]), ...PUFFS.map(([x, y, z, r]) => ell([r, r, r], [x, y, z])))],
  ['head', any(blob([[[5.6, 5.4, 5.2], [0, -12, 31]], [[3.2, 3, 2.8], [0, -18, 29]]]), ell([4.8, 4.4, 3.4], [0, -11, 35]))],
  ['ear*', ell([1.6, 1.6, 2.4], [5.2, -10.5, 31.6])],
  ['tail1', any(ell([4, 4, 4], TAIL[0].slice(0, 3)), ell([3.6, 3.6, 3.6], TAIL[1].slice(0, 3)))],
  ['tail2', any(...TAIL.slice(2).map((p) => ell([p[3], p[3], p[3]], p.slice(0, 3))))],
];

function assign(c, rgb) {
  if (isAny(rgb, WINGS, 0.012)) return `wing${side(c)}`;
  if (isAny(rgb, HORNS, 0.03)) return 'head';
  if (near(rgb, HOOF, 0.03)) return pick(c, parts.slice(0, 2));
  return pick(c, parts);
}

// the wings: `lift` raises both (ry), `sweep` swings them forward or back (rx)
const W = (lift, sweep = 0) => both('wing', { r: [sweep, -lift, 0] });
const base = quadrupedClips({
  face, tail, hipH: 12, stride: 18,
  add: {
    idle: (t, u) => W(3 * osc(u, 2), 2 * osc(u, 1, 0.3)),
    walk: (t, u) => W(5 * osc(u, 2, 0.1), 3 * osc(u, 1)),
    idle_sniff: (t, u) => W(-4 * win(u, 0.14, 0.6, 0.1), 0),
    idle_shake: (t, u) => { const k = win(u, 0.1, 0.8, 0.06); return W(10 * k * Math.sin(TAU * 7 * u), 6 * k * Math.sin(TAU * 7 * u + 1)); },
    windup: (t, u) => W(16 * smooth(u / 0.8), -8 * smooth(u / 0.8)),
    lunge: (t, u) => { const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]); return W(16 - 26 * hit, -8 + 16 * hit); },
    hurt: (t, u) => { const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.45]]); return W(22 * k + 4 * shake(u, 5), -10 * k); },
    recoil: (t, u) => W(-10 * K(u, [[0, 0], [0.4, 1], [1, 0]]), 0),
    faint: (t, u) => { const d = smooth((u - 0.2) / 0.55); return W(-20 * d, 8 * d); },
    celebrate: (t, u) => W(16 + 20 * Math.sin(TAU * 3 * u), 6 * osc(u, 3, 0.25)),
    enter: (t, u) => { const over = win(u, 0.4, 0.9, 0.12); const on = smooth((u - 0.1) / 0.4); return W(-14 * (1 - on) + 24 * over, 0); },
    exit: (t, u) => { const k = win(u, 0, 0.85, 0.2); return { ...W(0, 0), wingL: { r: [0, (-16 - 16 * Math.sin(TAU * 2 * u)) * k, 0] } }; },
  },
});
const { idle_wag: _wag, ...clips0 } = base;

const clips = {
  ...clips0,
  // fidget: a springy leap straight up on all four legs, the wings beating once, ^ ^ at the top
  idle_leap: {
    seconds: 1.6,
    pose: (t, u) => {
      const crouch = K(u, [[0, 0], [0.18, 1], [0.26, 0], [0.62, 0], [0.7, 0.6], [0.85, 0]]);
      const air = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.24) / 0.44))));
      const tuck = (r) => ({ r });
      return merge({
        root: { p: [0, 0, 6 * air - 1.2 * crouch] },
        body: { r: [-4 * air, 0, 0] },
        head: { r: [-8 * air, 0, 0] },
        legFL: tuck([14 * air, 0, 0]), legFR: tuck([14 * air, 0, 0]),
        legBL: tuck([-14 * air, 0, 0]), legBR: tuck([-14 * air, 0, 0]),
        ...face.pose(air > 0.6 ? 'happy' : 'open'),
      }, W(30 * Math.sin(TAU * 2 * u) * air + 10 * air, -6 * air), Object.fromEntries(tail.map((n, i) => [n, { r: [12 * air * (1 + 0.3 * i), 0, 0] }])));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
