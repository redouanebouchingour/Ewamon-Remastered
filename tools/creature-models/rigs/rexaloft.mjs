// Rexaloft's rig: an upright emerald dragon with a frilled fan behind its head, a hooked horn, clawed arms held in
// front, a curling tail and two huge bat wings in the picture plane that reach the ground. Numbers are
// scad/rexaloft.scad's, written in creature() terms (the scad drops the whole model by FOOT, the rig's joints too).
import { K, TAU, both, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, inFrame, limb, mx, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near, subFrame } from './lib/geo.mjs';

const FOOT = 3.2;
const S = (p) => [p[0], p[1], p[2] - FOOT];

const GREEN_LT = [0.10, 0.52, 0.32];
const FRILL = [[0.20, 0.67, 0.41], [0.03, 0.28, 0.22]];
const WING = [[0.09, 0.20, 0.41], [0.10, 0.11, 0.28], [0.17, 0.24, 0.56]];
const INK = [0.08, 0.10, 0.13];
const CLAW = [0.26, 0.24, 0.24];
const EYE = [[1, 0.9, 0.2], [0.03, 0.17, 0.17]];

// head(): translate([-0.5, -1, 0]) rotate([0, 0, -40]); inplane(2.5): translate([0, 2.5, 0]) rotate 30 translate([-1.25, 0, 0]),
// folded into one frame whose local numbers are the plane's own
const HEAD0 = subFrame([-0.5, -1, 0], [0, 0, -40]);
const PLANE0 = subFrame([-1.25 * Math.cos(Math.PI / 6), 2.5 - 1.25 * Math.sin(Math.PI / 6), 0], [0, 0, 30]);
const inPlane = (x, z) => S(PLANE0.world([x, 0, z]));

const eyeL = { side: 'L', at: [2.0, -2.1, 26.7], size: 0.6, yaw: 60, flat: 0.5, frame: subFrame([-0.5, -1, -FOOT], [0, 0, -40]) };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: GREEN_LT });

const TAIL = [[0.5, 2, 12], [4, 4, 12], [7, 5.5, 12], [9.5, 6, 12.3], [10.5, 5.5, 13.6], [10.3, 4.6, 15.5], [9.8, 4.0, 17.0]];
const TAIL_R = [3.0, 2.6, 2.2, 1.8, 1.5, 1.4, 0.6];
const TAIL_J = ['body', 'tail1', 'tail1', 'tail2', 'tail2', 'tail3'];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: S([4.3, 2.2, 12.5]) },
  { name: 'legR', parent: 'root', at: S([-2.8, 0.5, 12]) },
  { name: 'body', parent: 'root', at: S([0, 0.5, 12]) },
  { name: 'head', parent: 'body', at: S([-0.7, -1.4, 25]) },
  { name: 'frill', parent: 'head', at: inPlane(-0.3, 27.8), rot: [0, 0, 30] },
  { name: 'armL', parent: 'body', at: S([2.5, -1.5, 23]) },
  { name: 'foreL', parent: 'armL', at: S([6.2, -1.2, 17.5]) },
  { name: 'handL', parent: 'foreL', at: S([3.4, -5, 13.5]) },
  { name: 'armR', parent: 'body', at: S([-2.6, -1.5, 23]) },
  { name: 'foreR', parent: 'armR', at: S([-3.5, -2.5, 16]) },
  { name: 'handR', parent: 'foreR', at: S([-6.2, -4.3, 11.5]) },
  { name: 'wingL', parent: 'body', at: inPlane(3, 22), rot: [0, 0, 30] },
  { name: 'wingR', parent: 'body', at: inPlane(-3.2, 22), rot: [0, 0, 30] },
  { name: 'tail1', parent: 'body', at: S(TAIL[1]) },
  { name: 'tail2', parent: 'tail1', at: S(TAIL[3]) },
  { name: 'tail3', parent: 'tail2', at: S(TAIL[5]) },
  ...face.joints,
];

const H = [[-2.1, -2.9, 29.3], [-3.5, -2.5, 33], [-3.8, -1.5, 36.3], [-2.2, 0, 38.5], [0, 1, 39.1], [2.6, 1.8, 38.3], [4.3, 2.1, 36.3], [5.1, 2.4, 33.8]];
const chainAny = (pts, rs) => any(...pts.slice(1).map((p, i) => limb(pts[i], p, rs[i], rs[i + 1])));

// tests in creature() numbers (the centroid is lifted by FOOT before they run)
const parts = [
  ['body', any(blob([[[3.6, 3.5, 3.6], [0, 0, 12]], [[3.6, 3.8, 4.2], [-0.6, -1, 16.5]], [[3.8, 4.0, 4.2], [-0.8, -1.5, 20.5]]]),
    ell([2.4, 1.6, 5.2], [-1.5, -4.6, 18]), mx(ell([1.5, 1.8, 1.5], [2.6, 0.4, 23])), limb([-0.2, 1.9, 17], [-0.45, 0.9, 28], 1.4, 1.4),
    limb([-1, -2, 23.5], [-0.5, -1, 26.8], 2.5, 2.1))],
  ['head', any(inFrame(HEAD0, any(blob([[[2.4, 2.3, 2.8], [0, 0.5, 27.3]], [[2.1, 1.9, 2.4], [0, -2.3, 27.2]], [[1.6, 1.4, 1.6], [0, -4.0, 26.3]],
    [[1.1, 1.0, 1.1], [0, -4.8, 25.7]]]), limb([0, -0.3, 24.7], [0, -4.4, 24.6], 1.4, 0.8), mx(ell([1.2, 1.7, 0.55], [1.75, -2.4, 27.7])),
    spike([0.3, -1.2, 29.4], [0.2, -0.2, 3.9], 0.5), spike([-0.2, 1.0, 29.3], [-0.1, 0.4, 3.8], 0.5))),
    chainAny(H, [1.3, 1.1, 1.0, 1.0, 1.0, 1.05, 1.1, 0.3]), limb([4.6, 2.2, 35], [2.0, 1.5, 37.6], 0.85), spike([-0.3, 0.8, 39.2], [0.1, 0, 1.4], 0.45))],
  ['armL', limb([2.5, -1.5, 23], [6.2, -1.2, 17.5], 1.5, 1.3)],
  ['foreL', limb([6.2, -1.2, 17.5], [3.4, -5, 13.5], 1.3, 1.0)],
  ['handL', ell([1.1, 1.1, 1.0], [3, -5.2, 12.8])],
  ['armR', limb([-2.6, -1.5, 23], [-3.5, -2.5, 16], 1.5, 1.4)],
  ['foreR', limb([-3.5, -2.5, 16], [-6.2, -4.3, 11.5], 1.4, 1.15)],
  ['handR', ell([1.2, 1.2, 1.0], [-6.4, -4.5, 11])],
  ['legL', any(ell([2.3, 2.8, 3.6], [4.3, 2.2, 12.5]), chainAny([[5.2, 3.2, 9.5], [6, 3.4, 6], [6, 3.2, 4.2]], [1.7, 1.1, 1.0]),
    limb([4.8, 3.3, 4.0], [8.2, 3, 3.5], 1.1, 0.8), limb([8.4, 3, 3.4], [10, 3, 3.1], 0.5))],
  ['legR', any(ell([2.2, 2.8, 3.4], [-2.8, 0.5, 12]), chainAny([[-2.3, -0.8, 9], [-2.8, -2.2, 5.5], [-2.9, -2.4, 4.2]], [1.6, 1.1, 1.0]),
    limb([-3, -2.5, 3.9], [-5.8, -4.2, 3.5], 1.0, 0.8), limb([-6, -4.4, 3.4], [-7.2, -5.4, 3.1], 0.5))],
  ...TAIL.slice(1).map((p, i) => [TAIL_J[i], any(limb(TAIL[i], p, TAIL_R[i], TAIL_R[i + 1]), i > 0 && i < 5 ? spike([p[0], p[1], p[2] + TAIL_R[i] * 0.75], [0, 0.3, 1.3], 0.4) : () => 9)]),
  // the wing bones in the picture plane (the arm up to the elbow, the fingers); the side is the plane's x
  ['wingL', inFrame(PLANE0, (q) => (q[0] > 1.5 ? any(limb([3, 0, 22], [8.2, 0, 30], 1.3), limb([8.2, 0, 30], [11, 0, 31], 1),
    limb([11, 0, 31], [14.4, 0, 20], 0.9), limb([14.4, 0, 20], [11.5, 0, 4.3], 0.8))(q) : 9))],
  ['wingR', inFrame(PLANE0, (q) => (q[0] < -1.5 ? any(limb([-3.2, 0, 22], [-5.8, 0, 35.8], 1.3), limb([-6.5, 0, 35.5], [-14.3, 0, 18], 0.9),
    limb([-14.3, 0, 18], [-12.6, 0, 5.4], 0.75), limb([-7.8, 0, 33.5], [-7.6, 0, 23.4], 0.85))(q) : 9))],
];

// the picture plane's own x
const planeX = (c) => PLANE0.local(c)[0];
const near0 = (c, p, r) => Math.hypot(c[0] - p[0], c[1] - p[1], c[2] - p[2]) < r;

function assign(c, rgb) {
  const c0 = [c[0], c[1], c[2] + FOOT];
  if (isAny(rgb, FRILL)) return 'frill';
  if (isAny(rgb, EYE, 0.06)) return 'head';
  if (isAny(rgb, WING) || (near(rgb, INK) && !near0(c0, [-1.5, -3.5, 25], 3.5))) return planeX(c0) > 0 ? 'wingL' : 'wingR';
  if (near(rgb, INK)) return 'head';                                                   // the mouth line
  if (near(rgb, CLAW)) {
    const ends = [['handL', [2.7, -5.4, 12.3]], ['handR', [-6.6, -4.7, 10.8]], ['legL', [8.4, 3, 3.4]], ['legR', [-6, -4.4, 3.4]]];
    return ends.reduce((b, e) => (Math.hypot(...e[1].map((v, i) => v - c0[i])) < Math.hypot(...b[1].map((v, i) => v - c0[i])) ? e : b))[0];
  }
  // the frill's hub disc
  const q = PLANE0.local(c0);
  if (Math.hypot(q[0] + 0.3, q[2] - 27.8) < 1.8 && Math.abs(q[1]) < 0.6) return 'frill';
  return pick(c0, parts);
}

const base = bipedClips({
  face, tail: ['tail1', 'tail2', 'tail3'], hipH: 9, stride: 14, armSwing: 12, droop: 0.6, hopScale: 0.4,
  wing: { open: [0, -9, -6], flap: 6 },
  // a raking swipe of the near claw
  punch: { arm: [-70, 10, 0], fore: [-25, 0, 0] },
  cheer: { arm: [-110, 20, 0], fore: [-30, 0, 0] },
  add: {
    idle: (t, u) => ({ frill: { s: [1 + 0.03 * osc(u, 2), 1, 1 + 0.03 * osc(u, 2)] } }),
    windup: (t, u) => ({ frill: { s: 1 + 0.18 * smooth(u / 0.8) } }),
    lunge: (t, u) => ({ frill: { s: 1 + 0.18 * K(u, [[0, 1], [0.4, 1], [1, 0]]) } }),
    hurt: (t, u) => ({ frill: { s: [1 - 0.12 * K(u, [[0, 0], [0.2, 1], [1, 0.4]]), 1, 1 - 0.12 * K(u, [[0, 0], [0.2, 1], [1, 0.4]])] } }),
    faint: (t, u) => ({ frill: { s: 1 - 0.2 * smooth((u - 0.2) / 0.6) } }),
    celebrate: (t, u) => ({ frill: { s: 1 + 0.12 * Math.abs(Math.sin(TAU * u)) } }),
  },
});

const clips = {
  ...base,

  // fidget: it flares the frill wide, lifts its head and both wings, holds the display, then folds back
  idle_display: {
    seconds: 2.6,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.7, 1], [0.9, 0]]);
      const tr = Math.sin(TAU * 10 * u) * win(u, 0.25, 0.65, 0.05);
      return {
        body: { r: [-4 * on, 0, 0] },
        head: { r: [-14 * on, 0, 10 * on] },
        frill: { s: 1 + 0.22 * on, r: [0, 2 * tr, 0] },
        ...face.pose('open', blinks(u, [[0.78, 0.84]])),
        ...both('wing', { r: [0, -16 * on, -6 * on] }),
        ...both('arm', { r: [-14 * on, 0, 0] }),
        tail1: { r: [-6 * on, 0, 0] }, tail2: { r: [-8 * on, 0, 0] }, tail3: { r: [-10 * on, 0, 0] },
      };
    },
  },

  // fidget: a slow stretch of one wing then the other, the tail swishing
  idle_stretch: {
    seconds: 3,
    pose: (t, u) => {
      const l = win(u, 0.05, 0.45, 0.12);
      const r = win(u, 0.5, 0.9, 0.12);
      return {
        body: { r: [0, 3 * (r - l), 0] },
        head: { r: [-5 * (l + r), 0, 14 * l - 14 * r] },
        ...face.pose('open', blinks(u, [[0.46, 0.5]])),
        wingL: { r: [0, -18 * l, -10 * l] },
        wingR: { r: [0, 18 * r, 10 * r] },
        tail1: { r: [0, 0, 6 * osc(u, 1)] }, tail2: { r: [0, 0, 8 * osc(u, 1, 0.1)] }, tail3: { r: [0, 0, 10 * osc(u, 1, 0.2)] },
      };
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
