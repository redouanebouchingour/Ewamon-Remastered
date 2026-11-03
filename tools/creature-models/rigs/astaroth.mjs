// Astaroth's rig: a hunched black demon warrior (sprite-matched 2026-11-03). A low wolf-dragon head in a wild mane,
// glowing slit eyes (eyeKit lids), the greatsword in the right hand (traced in the picture plane), a katana in the
// left, bat wings folded up behind and a five-link devil tail. Numbers are scad/astaroth.scad's.
import { K, TAU, both, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, inFrame, limb, petal, plate, spike } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { closest, isAny, rot, subFrame } from './lib/geo.mjs';

const HEAD = [0.22, 0.19, 0.22];
const WING = [[0.36, 0.12, 0.13], [0.17, 0.08, 0.09], [0.18, 0.15, 0.17]];
const SWORD = [[0.47, 0.41, 0.39], [0.31, 0.25, 0.25], [0.25, 0.18, 0.17], [0.37, 0.29, 0.24], [0.25, 0.19, 0.17],
  [0.5, 0.04, 0.04]];
const KATANA = [[0.08, 0.07, 0.10], [0.85, 0.07, 0.05], [0.34, 0.07, 0.08]];

// ---- the scad's frames
const SX = 3.25;
const VIEW = 30;
const SHIFT = [-SX * Math.cos((VIEW * Math.PI) / 180), -SX * Math.sin((VIEW * Math.PI) / 180), 0];
const ppS = (d) => { const o = rot([0, 0, VIEW], [0, d, 0]); return subFrame([SHIFT[0] + o[0], SHIFT[1] + o[1], 0], [0, 0, VIEW]); };
const VIEWN = [-Math.sin((VIEW * Math.PI) / 180), Math.cos((VIEW * Math.PI) / 180), 0];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };
// along(p, d, n): x along d, y towards n, z = x cross y (the scad module)
function along(p, d, n) {
  const X = unit(d);
  const k = dot(n, X);
  const Y = unit([n[0] - k * X[0], n[1] - k * X[1], n[2] - k * X[2]]);
  const Z = [X[1] * Y[2] - X[2] * Y[1], X[2] * Y[0] - X[0] * Y[2], X[0] * Y[1] - X[1] * Y[0]];
  return { local: (c) => { const v = [c[0] - p[0], c[1] - p[1], c[2] - p[2]]; return [dot(v, X), dot(v, Y), dot(v, Z)]; } };
}

// ---- the scad's numbers
const TAIL = [[0, 5, 12.5], [7.5, 7, 9], [10.4, 8, 6.6], [14.1, 8, 7.8], [15.3, 7, 10.8], [14.8, 6, 13.6], [15.8, 6, 16.2], [17.4, 6, 16.8]];
const TAIL_R = [1.3, 1, 0.85, 0.75, 0.65, 0.55, 0.5, 0.45];
const tails = ['tail1', 'tail2', 'tail3', 'tail4', 'tail5'];
const SPADE = [[20.4, 16.6], [20.9, 18.6], [22.6, 17.9], [25, 17.9], [22.7, 16.9], [21.6, 14.9], [21.2, 16.3]];
const GS_BLADE = [[-24.1, 2.7], [-22.6, 5.5], [-21.2, 6.6], [-20, 8.1], [-17.6, 10.9], [-17, 10.6], [-15.1, 13.5], [-12, 16.1],
  [-10.6, 17], [-9.6, 16.4], [-8.3, 13.2], [-7.9, 11.7], [-9.9, 10.5], [-11, 9.8], [-13.6, 7.3], [-16.5, 5.3],
  [-17.2, 5.4], [-19.3, 3.3], [-22, 2.3]];
const gsF = ppS(-4.2);
const ktF = along([14, -5.4, 14.6], [-16.3, -4.6, -11.9], VIEWN);
const TUFTS = [[[0, -6.4, 34.6], [0, 2, 3]], [[2.8, -5.4, 34.2], [1.4, 2.6, 2.6]], [[-2.8, -5.4, 34.2], [-1.4, 2.6, 2.6]],
  [[0, -1.8, 34], [0, 3.6, 2.2]], [[4, -2.2, 33], [2.4, 3.6, 1.6]], [[-4, -2.2, 33], [-2.4, 3.6, 1.6]],
  [[6, -4.2, 31.6], [3.2, 2, 1.4]], [[-6, -4.2, 31.6], [-3.2, 2, 1.4]], [[6, -6, 28.4], [2.6, -0.4, -1.6]],
  [[-6, -6, 28.4], [-2.6, -0.4, -1.6]], [[4.4, 0, 29], [2.2, 3.6, -0.6]], [[-4.4, 0, 29], [-2.2, 3.6, -0.6]],
  [[0, 0.2, 30], [0, 4.2, 0.4]]];
const CHEEK = [[[3.6, -9, 32.6], [1.6, -0.8, 2.2]], [[-3.6, -9, 32.6], [-1.6, -0.8, 2.2]]];
const tuft = ([p, d]) => limb(p, [p[0] + d[0], p[1] + d[1], p[2] + d[2]], 2.2, 0.3);
const D = Math.PI / 180;
const panel = (a) => petal([2.9, 0.5, 3.9], [6.7 * Math.sin(a * D), 0.5 - 5.4 * Math.cos(a * D), 11.4], [-14, 0, a]);

const eyeL = { side: 'L', at: [1.95, -12, 30.3], size: 0.7, yaw: 35, flat: 0.45 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: HEAD });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [4.5, 0.5, 12] },
  { name: 'legR', parent: 'root', at: [-4.5, 0.5, 12] },
  { name: 'body', parent: 'root', at: [0, 0, 12] },
  { name: 'head', parent: 'body', at: [0, -8, 30.2] },
  { name: 'jaw', parent: 'head', at: [0, -10.6, 28.7] },
  { name: 'armL', parent: 'body', at: [8.7, -4, 26.4] },
  { name: 'foreL', parent: 'armL', at: [13, -3.5, 19.5] },
  { name: 'handL', parent: 'foreL', at: [14, -5.4, 14.6] },
  { name: 'armR', parent: 'body', at: [-8.7, -4, 26.4] },
  { name: 'foreR', parent: 'armR', at: [-9.2, -6, 20] },
  { name: 'handR', parent: 'foreR', at: [-7.2, -9, 16] },
  { name: 'wingL', parent: 'body', at: [5, 3.8, 30.5] },
  { name: 'wingR', parent: 'body', at: [-5, 3.8, 30.5] },
  ...tails.map((name, i) => ({ name, parent: i ? tails[i - 1] : 'body', at: TAIL[i] })),
  ...face.joints,
];

const torso = blob([[[6, 4.8, 4], [0, -1, 16]], [[7.2, 4.6, 4.6], [0, -2.5, 22]]]);
const parts = [
  ['body', any(torso, ell([6.5, 5, 4], [0, 0.5, 12.5]), ell([7, 5.5, 4.5], [0, 0.5, 25]), ell([7, 5.6, 5], [0, -5.2, 30.6]),
    ...TUFTS.map(tuft), ...[0, 35, -35, 75, -75, 125, -125, 180].map(panel))],
  ['head', any(ell([3.4, 3.6, 2.9], [0, -9.8, 31.4]), blob([[[2, 2, 1.6], [0, -12, 30]], [[1.1, 1, 0.85], [0, -14.6, 28.3]]]),
    ell([0.6, 0.5, 0.45], [0, -15.45, 28.5]), ...CHEEK.map(tuft),
    ...[1, -1].map((s) => petal([1.2, 0.7, 0.4], [1.75 * s, -11.7, 31.05], [0, -22 * s, 32 * s])),
    ...[1, -1].map((s) => ell([0.8, 0.5, 0.8], [1.95 * s, -12, 30.3])),
    ...[1, -1].map((s) => limb([2.6 * s, -9.8, 33.3], [4.4 * s, -9.8, 35.5], 1.1, 0.9)),
    ...[1, -1].map((s) => limb([4.4 * s, -9.8, 35.5], [5 * s, -9.2, 37.8], 0.9, 0.6)),
    ...[1, -1].map((s) => limb([5 * s, -9.2, 37.8], [4.6 * s, -8.6, 40], 0.6, 0.15)))],
  ['jaw', any(blob([[[1.7, 1.8, 0.9], [0, -11.3, 28.3]], [[0.9, 1, 0.6], [0, -14, 27.6]]]),
    spike([0.7, -14.1, 27.9], [0, -0.1, -0.9], 0.25), spike([-0.7, -14.1, 27.9], [0, -0.1, -0.9], 0.25))],
  ['legL', any(limb([4.5, 0.5, 12], [8, -1, 9.8], 3.6, 2.8), ell([2.6, 2.1, 2.7], [8.4, -2.9, 10]), limb([8, -1, 9.8], [9.8, 2, 4.5], 2.4, 1.7),
    limb([9.8, 2, 4.5], [10, 1.2, 1.4], 1.4, 1.2), blob([[[1.9, 2.6, 1.2], [10, -0.4, 1.2]], [[1.4, 1.4, 1.1], [10, 1.4, 1.3]]]),
    limb([10, -2.6, 0.9], [10, -4.6, 0.3], 0.5), limb([10, 0.6, 1], [10, 1.6, 0.5], 0.4))],
  ['legR', any(limb([-4.5, 0.5, 12], [-6.8, -4.5, 10.4], 3.6, 2.8), ell([2.6, 2.1, 2.7], [-7.1, -6.5, 10.6]), limb([-6.8, -4.5, 10.4], [-6, -2.5, 4.5], 2.4, 1.7),
    limb([-6, -2.5, 4.5], [-6.2, -3.4, 1.4], 1.4, 1.2), blob([[[1.9, 2.6, 1.2], [-6.3, -5.4, 1.2]], [[1.4, 1.4, 1.1], [-6.2, -3.6, 1.3]]]),
    limb([-6.3, -7.6, 0.9], [-6.3, -9.6, 0.3], 0.5), limb([-6.3, -4.4, 1], [-6.3, -3.4, 0.5], 0.4))],
  ['armL', any(ell([3.6, 3.4, 2.8], [8.7, -4, 26.6]), ell([2.6, 2.4, 1.4], [8.9, -4.2, 28.6]), ell([3.3, 3.2, 1.5], [9.6, -4, 24.2]),
    limb([8.7, -4, 26], [13, -3.5, 19.5], 2.6, 2.3))],
  ['foreL', any(limb([13, -3.5, 19.5], [14, -5.2, 15.4], 2.3, 2), ell([2.7, 2.6, 3.2], [13.5, -4.3, 17.8]))],
  ['handL', any(ell([1.9, 1.9, 1.8], [14, -5.4, 14.6]), inFrame(ktF, limb([-5.6, 0, 0], [20.7, 0, 0], 0.7, 0.5)))],
  ['armR', any(ell([3.6, 3.4, 2.8], [-8.7, -4, 26.6]), ell([2.6, 2.4, 1.4], [-8.9, -4.2, 28.6]), ell([3.3, 3.2, 1.5], [-9.6, -4, 24.2]),
    limb([-8.7, -4, 26], [-9.2, -6, 20], 2.6, 2.3))],
  ['foreR', any(limb([-9.2, -6, 20], [-7.4, -8.6, 16.4], 2.3, 2), ell([2.7, 2.6, 3.1], [-8.4, -7.3, 18.2]))],
  ['handR', any(ell([1.9, 1.9, 1.8], [-7.2, -9, 16]), plate(GS_BLADE, 1, gsF))],
  ...chain(tails, TAIL, TAIL_R),
  [tails[4], plate(SPADE, 1, ppS(-3.5))],
];

function assign(c, rgb) {
  if (isAny(rgb, WING, 0.012)) return c[0] >= 0 ? 'wingL' : 'wingR';
  if (isAny(rgb, SWORD, 0.012)) return 'handR';
  if (isAny(rgb, KATANA, 0.012)) return 'handL';
  return closest(parts.map(([n, t]) => [n, t(c)]));
}

const base = bipedClips({
  face, tail: tails, hipH: 12, stride: 16, armSwing: 10, hopScale: 0.4,
  wing: { open: [0, -18, 10], flap: 16 },
  punch: { arm: [-75, 10, 0], fore: [-25, 0, 0] },
  cheer: { arm: [-15, -55, 0], fore: [-25, 15, 0] },
  add: {
    idle: (t, u) => ({ jaw: { r: [2 * Math.max(0, osc(u, 2, 0.1)), 0, 0] } }),
    lunge: (t, u) => ({ jaw: { r: [14 * win(u, 0.3, 0.7, 0.08), 0, 0] } }),
    celebrate: (t, u) => ({ jaw: { r: [12 * win(u, 0, 1, 0.15), 0, 0] }, head: { r: [-12 * win(u, 0, 1, 0.15), 0, 0] } }),
  },
});

const tailWave = (u, amp, flick = 0) => Object.fromEntries(tails.map((n, i) => [n, { r: [-10 * flick * (1 + 0.3 * i), 0, amp * (1 + 0.25 * i) * Math.sin(TAU * (u - 0.08 * i))] }]));

const clips = {
  ...base,

  // fidget: the wings unfurl wide and give two slow beats, head lifted, then fold back
  idle_wingstretch: {
    seconds: 3,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.75, 1], [0.95, 0]]);
      const beat = Math.sin(TAU * 2 * smooth((u - 0.2) / 0.55)) * on;
      return {
        body: { r: [-4 * on, 0, 0] },
        head: { r: [-10 * on, 0, 0] },
        jaw: { r: [4 * on, 0, 0] },
        ...both('wing', { r: [0, -20 * on + 16 * beat, 12 * on] }),
        ...both('arm', { r: [0, -6 * on, 0] }),
        ...tailWave(u, 5),
      };
    },
  },

  // fidget: it drags the greatsword's tip in a slow arc, rolls its head, and the spade tail cracks like a whip
  idle_menace: {
    seconds: 2.4,
    pose: (t, u) => {
      const drag = K(u, [[0, 0], [0.25, 1], [0.6, 1], [0.8, 0]]);
      const flick = win(u, 0.55, 0.75, 0.05);
      return {
        body: { r: [3 * drag, 0, -6 * drag] },
        head: { r: [6 * drag, 8 * drag, -14 * drag] },
        armR: { r: [-12 * drag, 0, 0] },
        foreR: { r: [0, 0, 18 * drag] },
        ...tailWave(u, 6 * (0.4 + flick), flick),
      };
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
