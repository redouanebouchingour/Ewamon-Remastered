// Tidalfang's rig: a slender teal sea dragon coiled upright. An S of neck and chest into a head turned towards the
// camera and tipped nose-down (the scad's headFrame), a big pale sail behind the shoulders, little arms, legs off the
// root, and the coiled body: one joint for the loop round its side and past its feet (anything more ploughs it
// through the legs) and one for the spiral at the tip. The scad is authored in the art's sheet z and lowered G = 5 (the
// rock it stands on in the art is not modelled), so every number here goes through W(). Numbers are scad/tidalfang.scad's.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, fromSheet, inFrame, limb, pick, ppFrame, spike } from './lib/biped.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { isAny, near, plateD, subFrame, unrot } from './lib/geo.mjs';

const G = 5;
const TEAL = [0.14, 0.6, 0.66];
const DROP = [0.35, 0.62, 0.93];
const EYES = [[0.04, 0.06, 0.08], [0.7, 0.7, 0.82], [0.02, 0.03, 0.04], [1, 1, 1]];
const W = (p) => [p[0], p[1], p[2] - G];
const F = (sx, z, y) => W(fromSheet(sx, z, y));
const add = (a, b) => a.map((v, i) => v + b[i]);

// the head frame: translate(HC) rotate([0, 0, 15]) rotate([18, 0, 0]) scale(1.3), lowered
const HF = subFrame(W([-8, -3.6, 28.4]), [18, 0, 15], 1.3);
const eyeL = { side: 'L', at: [2.5, -2.3, 0.1], size: 1.4, yaw: 38, flat: 0.55, frame: HF };
const face = eyeKit({ eyes: [eyeL, { ...eyeL, side: 'R', at: [-2.5, -2.3, 0.1], yaw: -38 }], skin: TEAL });

// the sail: pp(4.2) translate([0, 0, 20]) rotate([-22, 0, 0]) scale([1, 1, 1.08]) translate([0, 0, -20]), lowered
const SAIL_PTS = [[-8.4, 26], [-8.2, 33], [-7.2, 37], [-6, 39.6], [-4.2, 39.8], [-1.6, 38.2], [1.8, 39.2], [3.4, 35.8], [6.4, 36.6],
  [7.9, 32.6], [10.9, 32.2], [11.4, 29.2], [12.9, 27.2], [13.2, 23.6], [10, 21], [4, 19.6], [-2, 19.6], [-6.4, 22]];
const PP = ppFrame(4.2);
const sailLocal = (c) => {
  const q = PP.local([c[0], c[1], c[2] + G]);
  const r = unrot([-22, 0, 0], [q[0], q[1], q[2] - 20]);
  return [r[0], r[1], r[2] / 1.08 + 20];
};
const SAIL = (c) => plateD(sailLocal(c), SAIL_PTS, 1.6);

// the scad's Catmull-Rom spline, so the tail test follows the same path
const cr = (a, b, c, d, t) => a.map((_, i) => 0.5 * (2 * b[i] + (c[i] - a[i]) * t + (2 * a[i] - 5 * b[i] + 4 * c[i] - d[i]) * t * t + (3 * b[i] - a[i] - 3 * c[i] + d[i]) * t * t * t));
const spline = (P, n) => [...P.slice(0, -1).flatMap((_, i) => Array.from({ length: n }, (_, k) => cr(P[Math.max(i - 1, 0)], P[i], P[i + 1], P[Math.min(i + 2, P.length - 1)], k / n))), P[P.length - 1]];
const lerpR = (R, n) => [...R.slice(0, -1).flatMap((r, i) => Array.from({ length: n }, (_, k) => r + ((R[i + 1] - r) * k) / n)), R[R.length - 1]];
const TAIL_C = [F(0, 12, 4.5), F(2.4, 18, 3.4), F(1.6, 22.6, 0.4), F(6, 24, -1.4), F(12, 22.4, -1.8), F(14.6, 17, -1.8), F(14, 10.4, -1.4),
  F(10, 6.8, -1), F(5.6, 7.4, 0.2), F(1, 6.6, 3), F(-5, 6.4, 3.4), F(-10, 6, 1.2), F(-14.6, 6, -1), F(-17.6, 8.4, -1.8),
  F(-17, 13, -1.8), F(-14, 14, -1.8), F(-12.4, 11.6, -1.8), F(-13.6, 9.6, -1.8)];
const TAIL = spline(TAIL_C, 2);
const TAIL_R = lerpR([3.4, 3.2, 3.1, 3.1, 3, 2.9, 2.8, 2.6, 2.4, 2.3, 2.2, 2, 1.9, 1.7, 1.4, 1.1, 0.85, 0.6], 2);
const SPLIT = 24;   // the spiral starts at control point 12

const SPINE = [[0, 1.6, 11], [-0.8, 0, 16.5], [-2.6, -1.4, 21], [-5.2, -2.6, 24.4], [-7.8, -3.2, 27.4]].map(W);
const SPINE_R = [4.6, 4.4, 3.6, 2.9, 2.6];
const ARMS = {
  L: [[2.6, -1.6, 19.4], [4.6, -3.2, 17.2], [5.8, -4, 19.4]].map(W),
  R: [[-3.6, -1.2, 19.4], [-6.4, -2.4, 17], [-7.8, -4, 15.4]].map(W),
};
const LEGS = {
  L: { thigh: W([3.8, 0.4, 12.4]), tr: [2.8, 3.4, 3], knee: W([4.6, 1.4, 9]), ankle: W([5, -0.6, 6.2]) },
  R: { thigh: W([-3.8, -0.6, 11.8]), tr: [2.6, 3.2, 2.8], knee: W([-5.2, -1.2, 8.4]), ankle: W([-6, -2.2, 6.2]) },
};

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: LEGS.L.thigh },
  { name: 'legR', parent: 'root', at: LEGS.R.thigh },
  { name: 'body', parent: 'root', at: SPINE[0] },
  { name: 'head', parent: 'body', at: SPINE[2] },
  { name: 'armL', parent: 'body', at: ARMS.L[0] },
  { name: 'foreL', parent: 'armL', at: ARMS.L[1] },
  { name: 'armR', parent: 'body', at: ARMS.R[0] },
  { name: 'foreR', parent: 'armR', at: ARMS.R[1] },
  { name: 'tail1', parent: 'root', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[SPLIT] },
  ...face.joints,
];

const legTest = ({ thigh, tr, knee, ankle }) => any(ell(tr, thigh), limb(add(thigh, [0, 0.4, -2]), knee, 2, 1.5), limb(knee, ankle, 1.5, 1.2),
  limb(add(ankle, [-1.8, -2.4, -1]), add(ankle, [1.8, -2.4, -1]), 1.1), limb(ankle, add(ankle, [0, -3.2, -1.3]), 1),
  limb(add(knee, [0, 1, 0]), add(knee, [Math.sign(knee[0]), 2.8, -1.6]), 0.8));
const HEAD = inFrame(HF, any(
  blob([[[3.9, 3.4, 3.1], [0, 0.2, 0.4]], [[3, 2.6, 2.4], [0, -2.6, -1.3]], [[1.9, 1.6, 1.5], [0, -4.6, -2.6]]]),
  limb([1.7, 0.6, 2.4], [2.5, 1.6, 7.2], 1.1, 0.4), limb([-1.7, 0.6, 2.4], [-2.5, 1.6, 7.2], 1.1, 0.4),
  limb([3, 1, 0.4], [7, 1, 0.4], 1.6), limb([-3, 1, 0.4], [-7, 1, 0.4], 1.6)));

const parts = [
  ['body', any(limb(SPINE[0], SPINE[1], SPINE_R[0], SPINE_R[1]), limb(SPINE[1], SPINE[2], SPINE_R[1], SPINE_R[2]), SAIL)],
  ['head', any(limb(SPINE[2], SPINE[3], SPINE_R[2], SPINE_R[3]), limb(SPINE[3], SPINE[4], SPINE_R[3], SPINE_R[4]), HEAD)],
  ...['L', 'R'].flatMap((s) => [
    [`arm${s}`, limb(ARMS[s][0], ARMS[s][1], 1.4, 1.1)],
    [`fore${s}`, any(limb(ARMS[s][1], ARMS[s][2], 1.1, 1), limb(ARMS[s][2], add(ARMS[s][2], s === 'L' ? [0, -0.6, 1.6] : [0, -1, -1.2]), 0.9),
      ...(s === 'R' ? [limb(W([-6.4, -2, 17.6]), W([-9.8, -1.6, 19.8]), 0.8), limb(W([-5.2, -1, 19.6]), W([-9.8, -1.6, 19.8]), 0.8)] : []))],
    [`leg${s}`, legTest(LEGS[s])],
  ]),
  ...chain(TAIL.slice(1).map((_, i) => (i < SPLIT ? 'tail1' : 'tail2')), TAIL, TAIL_R.map((r) => r * 1.12)),
  ['tail1', inFrame(ppFrame(-1.2), (c) => plateD([c[0], c[1], c[2] + G], [[7.4, 10.4], [8.6, 15.6], [10.6, 17.6], [11.6, 13.4], [11, 9.4], [9.4, 8.6]], 1.2))],
  ['tail2', inFrame(ppFrame(-1.2), (c) => plateD([c[0], c[1], c[2] + G], [[-15.8, 9.4], [-16.2, 12.6], [-14.6, 13.6], [-13.4, 12.2], [-14, 10.2]], 1.2))],
];

function assign(c, rgb) {
  if (near(rgb, DROP)) return 'body';
  if (isAny(rgb, EYES, 0.03) && c[2] > 18) return 'head';
  return pick(c, parts);
}

// the coil barely sways: it loops round the legs; the spiral at the tip curls a little
const tailK = (u, amp = 1) => ({ tail1: { r: [0, 0, 1.2 * amp * osc(u, 1)] }, tail2: { r: [0, 4 * amp * osc(u, 1, 0.3), 0] } });
// the long neck sways like a swan's
const neck = (u, amp = 1, cycles = 1) => ({ head: { r: [2 * amp * osc(u, cycles, 0.2), 0, 3 * amp * osc(u, cycles, 0.45)] } });

const base = bipedClips({
  face, hipH: 7, stride: 10, armSwing: 6, hopScale: 0.4, droop: 0.6,
  // a quick snap of the head forward with the claws out
  punch: { arm: [-40, 0, 0], fore: [-20, 0, 0] },
  cheer: { arm: [-20, -70, 0], fore: [-30, 0, 0] },
  add: {
    idle: (t, u) => merge(tailK(u), neck(u, 1, 1)),
    walk: (t, u) => merge(tailK(u, 0.6), neck(u, 0.8, 2)),
    lunge: (t, u) => ({ head: { r: [24 * K(u, [[0.1, 0], [0.4, 1], [0.65, 1], [1, 0]]), 0, 0] } }),
    hurt: (t, u) => tailK(u, 2),
    celebrate: (t, u) => merge(tailK(u, 2), neck(u, 1.5, 2)),
  },
});

const clips = {
  ...base,

  // fidget: it shakes the water off its head, ear frills flapping, then blinks happily
  idle_shake: {
    seconds: 2,
    pose: (t, u) => {
      const sh = Math.sin(TAU * 7 * u) * win(u, 0.1, 0.55, 0.06);
      const happy = win(u, 0.6, 0.9, 0.03);
      return merge({
        body: { r: [0, 0, 3 * sh] },
        head: { r: [-4 * happy, 4 * sh, 18 * sh] },
        ...face.pose(happy > 0.5 ? 'happy' : 'open', blinks(u, [[0.05, 0.1]])),
        ...both('arm', { r: [0, -6 * Math.abs(sh), 0] }),
      }, tailK(u, 1.5));
    },
  },

  // fidget: it looks back over its shoulder at its sail, then turns to the camera side
  idle_preen: {
    seconds: 2.8,
    pose: (t, u) => {
      const back = K(u, [[0, 0], [0.18, 1], [0.45, 1], [0.6, 0]]);
      const look = K(u, [[0.5, 0], [0.65, 1], [0.85, 1], [1, 0]]);
      return merge({
        body: { r: [0, 0, -10 * back + 5 * look] },
        head: { r: [-6 * back, 10 * back, -40 * back + 22 * look] },
        ...face.pose('open', blinks(u, [[0.48, 0.53]])),
      }, tailK(u));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
