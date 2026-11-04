// Cirrileap's rig: a leaping cloud ram, one big billowy cloud body, a slim ram face looking at the viewer with
// golden coiled horns (part of the head), a curling cloud tail and two big feathered wings off the shoulders, the near
// one raised. Mid-leap: the near front hoof on the ground, the far front reaching forward, the hind legs tucked. The
// quadruped template has no wings: wingL / wingR are moved by `add` layers. Numbers are scad/cirrileap.scad's.
import { K, TAU, both, merge, osc, rigDef, shake, smooth, win } from './lib/anim.mjs';
import { any, blob, ell, inFrame, limb, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near, side, subFrame } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const CLOUD = [[0.55, 0.70, 0.95], [0.66, 0.78, 0.97], [0.47, 0.64, 0.93]];
const FACE = [0.80, 0.88, 0.99];
const LEGS = [[0.41, 0.58, 0.85], [0.27, 0.43, 0.77], [0.15, 0.28, 0.63]];
const WINGS = [[0.62, 0.75, 0.97], [0.51, 0.66, 0.94], [0.38, 0.54, 0.88], [0.25, 0.41, 0.78]];

// the body's billows [x, y, z, r] (flattened to 0.88 in z) and the rump's curls
const PUFFS = [
  [-4.5, -14.5, 13.5, 5.2], [3, -15.5, 12.5, 4.6], [-5, -12.5, 19.5, 5.2], [1.5, -15, 19, 5],
  [-1, -10, 24, 4.8], [4, -9, 23.5, 4.2], [1.5, -5, 28, 3.2], [3.5, -2.5, 27, 3.8], [2.5, -4.5, 31, 1.7],
  [-6, -15, 10.5, 3.6], [0, -17, 10.5, 3.2],
  [7, -3, 16, 5.2], [-7, -3, 16, 5.2], [5, 1, 22, 5.2], [-5, 1, 22, 5], [0, -4, 11.5, 4.6],
  [7, 8, 15, 5.4], [-7, 8, 15, 5.2], [4, 10, 21.5, 5.2], [-4, 10, 21.5, 5], [1, 15.5, 16, 5.6], [6, 14, 18, 4.5],
  [3, 13, 11.5, 4], [-3, 13, 11.5, 4], [7, 16, 11, 3.2], [8.5, 18.5, 9.5, 1.8]];
const TAIL = [[3, 18.5, 19, 4.4], [5, 21, 22.8, 2.8], [4.5, 20.5, 25.6, 1.6]];
const puff = ([x, y, z, r]) => ell([r, r, r * 0.88], [x, y, z]);
const tail = ['tail1', 'tail2'];

// the head block: translate(HP) rotate([0, 0, HY])
const HP = [-1.8, -19, 25];
const hf = subFrame(HP, [0, 0, 15]);
const eyeL = { side: 'L', at: [1.4, -2.45, 0.2], size: 0.6, yaw: 20, frame: hf };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FACE });

// the legs: [cuff, shin top, hoof], cuff radii
const LEG_FL = [[2.2, -17.5, 7], [2, -18, 5], [1.6, -19.8, 1.9]];
const LEG_FR = [[-3.8, -18.7, 9], [-3.9, -19.6, 7], [-4.7, -23.2, 4.3]];
const LEG_B = [[4.5, 10, 10.5], [4.5, 10.5, 9.5], [4.5, 11.8, 5.6]];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const fore = (L) => any(ell([2.8, 2.8, 3.4], L[0]), limb(L[1], L[2], 1.35, 1.05), ell([1.45, 1.8, 1], add3(L[2], [-0.2, -0.6, -0.9])));
const hind = any(ell([2.6, 2.8, 2.8], LEG_B[0]), limb(LEG_B[1], LEG_B[2], 1.45, 1.1), ell([1.45, 1.8, 1], add3(LEG_B[2], [0, -0.5, -0.9])));

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legFL', parent: 'root', at: [2.3, -16.5, 10.5] },
  { name: 'legFR', parent: 'root', at: [-3.6, -17.5, 11.5] },
  { name: 'legBL', parent: 'root', at: [4.5, 9.5, 12.5] },
  { name: 'legBR', parent: 'root', at: [-4.5, 9.5, 12.5] },
  { name: 'body', parent: 'root', at: [0, 0, 13] },
  { name: 'head', parent: 'body', at: [-1.2, -16.5, 22.5] },
  { name: 'wingL', parent: 'body', at: [6.5, -8, 22] },
  { name: 'wingR', parent: 'body', at: [-6.5, -8, 22] },
  { name: 'tail1', parent: 'body', at: [2.5, 16.5, 18] },
  { name: 'tail2', parent: 'tail1', at: [4.6, 20.4, 21.6] },
  ...face.joints,
];

const parts = [
  ['legFL', fore(LEG_FL)],
  ['legFR', fore(LEG_FR)],
  ['legB*', hind],
  ['body', any(blob([[[7.5, 7.5, 7], [0, -10, 15.5]], [[7.5, 8.5, 6.5], [0, 9, 16]]]), ...PUFFS.map(puff))],
  ['head', inFrame(hf, blob([[[2.9, 3, 2.8], [0, 0.6, 1.6]], [[1.6, 1.9, 1.6], [0, -2.3, -2.3]]]))],
  ['tail1', puff(TAIL[0])],
  ['tail2', any(puff(TAIL[1]), puff(TAIL[2]))],
];
const legParts = parts.slice(0, 3);

function assign(c, rgb) {
  if (isAny(rgb, WINGS, 0.012)) return `wing${side(c)}`;
  if (isAny(rgb, LEGS, 0.012)) return pick(c, legParts);
  if (isAny(rgb, CLOUD, 0.012)) return pick(c, parts);
  if (near(rgb, FACE, 0.012)) return 'head';
  return 'head';   // horns, eyes, nostrils, mouth
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
