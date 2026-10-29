// Verdatide's rig: a great sea turtle with a meadow on its shell (the body), a big old head on a thick neck with a
// moss beard (mane1), and four flippers as the legs. The template's walk swings legs with rx, which would drive a
// flipper lying forward into the ground: here stride is 0 and the walk paddles them with rz through `add`. Numbers are
// scad/verdatide.scad's; the head sits in its translate([0, -20, 9]) scale(1.22) translate([0, 21.6, -6.4]) block
// (HF, the head's own numbers p map to p + [0, 21.6, -6.4]).
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, ell, limb, pick, spike } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near, subFrame } from './lib/geo.mjs';
import { legs, quadrupedClips } from './lib/quadruped.mjs';

const SHELL = [[0.16, 0.3, 0.12], [0.3, 0.52, 0.2], [0.38, 0.6, 0.24], [0.45, 0.32, 0.2], [0.42, 0.7, 0.24],
  [0.55, 0.57, 0.55], [1, 0.8, 0.25], [0.75, 0.55, 0.95], [0.45, 0.6, 1], [0.95, 0.6, 0.85], [1, 0.9, 0.4], [0.5, 0.72, 0.28], [0.4, 0.5, 0.2]];
const BARNACLE = [[0.78, 0.76, 0.72], [0.45, 0.43, 0.4]];

const HF = subFrame([0, -20, 9], [0, 0, 0], 1.22);
const H = (p) => HF.world([p[0], p[1] + 21.6, p[2] - 6.4]);
const local = (c) => { const q = HF.local(c); return [q[0], q[1] - 21.6, q[2] + 6.4]; };
const inHead = (test) => (c) => test(local(c));

const eyeL = { side: 'L', at: [3.6, -1.2, 5.3], size: 1.95, yaw: 24, flat: 0.55, frame: HF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.3, 0.42, 0.2] });

const FLIP = { F: [[11, -10, 5], [19, -24, 0.6], 7], B: [[11, 10, 4.5], [19, 21, 0.6], 4.4] };

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legFL', parent: 'root', at: [11, -10, 5] },
  { name: 'legFR', parent: 'root', at: [-11, -10, 5] },
  { name: 'legBL', parent: 'root', at: [11, 10, 4.5] },
  { name: 'legBR', parent: 'root', at: [-11, 10, 4.5] },
  { name: 'body', parent: 'root', at: [0, 0, 5] },
  { name: 'head', parent: 'body', at: H([0, -11, 8]) },
  { name: 'mane1', parent: 'head', at: H([0, -22.6, 7.4]) },
  { name: 'tail1', parent: 'body', at: [0, 15, 5.5] },
  ...face.joints,
];

const flip = ([root, tip, w]) => any(limb(root, tip, w * 0.5, w * 0.25), ell([w, w, 1.6], root.map((v, i) => v + (tip[i] - v) * 0.45)));
const parts = [
  ['legF*', flip(FLIP.F)],
  ['legB*', flip(FLIP.B)],
  ['body', any(ell([12, 13.5, 4.2], [0, 0, 4.6]), ell([15.5, 17, 15], [0, 0, 7]))],
  ['head', inHead(any(limb([0, -12, 8], [0, -17, 9.4], 5), ell([5.6, 5, 4.8], [0, -19.5, 10.6]), ell([3.8, 2.6, 3.2], [0, -24, 9.8])))],
  ['tail1', spike([0, 16, 5.5], [0, 4, -1.8], 1.8)],
];

function assign(c, rgb) {
  if (isAny(rgb, BARNACLE, 0.03)) return `leg${c[1] < 0 ? 'F' : 'B'}${c[0] >= 0 ? 'L' : 'R'}`;
  const q = local(c);
  if (q[1] < -21 && q[2] < 7.3 && Math.abs(q[0]) < 6) return 'mane1';     // the beard
  if (isAny(rgb, SHELL, 0.03) && c[2] > 3.5) return 'body';                // shell, meadow, rim and rim moss
  return pick(c, parts);
}

const paddle = (u, amp, cycles = 1) => legs(
  { r: [0, -4 * Math.max(0, osc(u, cycles, 0.25)), amp * osc(u, cycles)] },
  { r: [0, 0, 0.5 * amp * osc(u, cycles, 0.5)] },
  { r: [0, -4 * Math.max(0, osc(u, cycles, 0.75)), amp * osc(u, cycles, 0.5)] },
  { r: [0, 0, 0.5 * amp * osc(u, cycles)] },
);
const beard = (u, amp, cycles = 2) => ({ mane1: { r: [amp * osc(u, cycles), 0, 0.6 * amp * osc(u, cycles, 0.25)] } });

const clips = quadrupedClips({
  face, tail: ['tail1'], hipH: 4, stride: 0,
  add: {
    idle: (t, u) => beard(u, 3, 2),
    walk: (t, u) => merge(paddle(u, 14), beard(u, 6, 2), { body: { r: [0, 0, 2 * osc(u, 1)] } }),
    idle_shake: (t, u) => beard(u, 14 * win(u, 0.1, 0.9, 0.05), 8),
    lunge: (t, u) => beard(u, 10, 1),
    hurt: (t, u) => beard(u, 12, 3),
    celebrate: (t, u) => merge(paddle(u, 16, 2), beard(u, 10, 2)),
  },
});

// fidget: a slow, sage nod, then strokes the beard with a front flipper
clips.idle_ponder = {
  seconds: 3.6,
  pose: (t, u) => {
    const nod = K(u, [[0, 0], [0.15, 1], [0.3, 0], [0.4, 1], [0.5, 0]]);
    const stroke = win(u, 0.55, 0.9, 0.08);
    return merge({
      head: { r: [8 * nod - 4 * stroke, 0, 8 * stroke] },
      legFL: { r: [0, -18 * stroke, -26 * stroke + 6 * stroke * osc(u, 6)] },
      ...face.pose(nod > 0.5 ? 'shut' : 'open', stroke * 0.4),
    }, beard(u, 4 + 6 * stroke, 6));
  },
};

// fidget: a big sigh that lifts the shell, the meadow's flowers trembling with it
clips.idle_sigh = {
  seconds: 2.4,
  pose: (t, u) => {
    const b = Math.sin(Math.PI * Math.min(1, u / 0.85));
    return merge({
      body: { p: [0, 0, 0.7 * b], s: [1 + 0.02 * b, 1 + 0.02 * b, 1 + 0.03 * b] },
      head: { r: [-6 * b, 0, 0] },
      ...face.pose(b > 0.6 ? 'shut' : 'open'),
    }, beard(u, 4 * b, 4), { tail1: { r: [0, 0, 10 * Math.sin(TAU * 2 * u) * b] } });
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
