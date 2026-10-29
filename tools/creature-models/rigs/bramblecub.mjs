// Bramblecub's rig: a mossy bear cub crouched on four legs to pounce, a huge round head turned back to the camera, leaf
// ears, a twig crown, the far front paw raised (armR / foreR, off the body) and a curling vine tail ending in a leaf.
// Since the sprite-accuracy model (2026-10-29) it is a quadruped. Numbers are scad/bramblecub.scad's.
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, blob, chain, ell, inFrame, limb, pick, plate, ppFrame, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { subFrame } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const GREEN_DK = [0.24, 0.45, 0.12];

// the head: translate(H) rotate([0, 0, HYAW])
const HEAD = subFrame([-6.9, -8, 24.5], [0, 0, 19]);
const EARS = ppFrame(-2.5);
const TWIGS = ppFrame(-3.5);
const TAILF = ppFrame(9);
const farEar = [[-26.4, 38.3], [-22, 37], [-18.5, 35.5], [-17, 33], [-17.5, 30.5], [-19.5, 29], [-22.5, 28.5], [-24.5, 29.5], [-26, 31.5], [-26.8, 34.5]];
const nearEar = [[0.5, 36], [3, 37.3], [9.6, 37.5], [9.9, 33], [9.5, 30.5], [7, 28], [4, 27], [1.5, 27.5], [0, 29.5], [-0.5, 33]];
const twigPts = [[-13.7, 39.1], [-11.8, 38.5], [-11.8, 37.7], [-12.6, 37.7], [-13.7, 36.7], [-12.6, 36.4], [-12.4, 35.4], [-11.3, 36.2], [-10, 36.2], [-9.4, 35.1], [-7.8, 35.1], [-7.3, 37], [-8.1, 37.2], [-8.1, 38.3], [-6, 37.5], [-5.7, 38.8], [-4.1, 39.1], [-4.4, 38.5], [-3.6, 38.3], [-3.6, 37.5], [-4.9, 37.2], [-5.5, 36.4], [-2.5, 35.9], [-1.8, 35.1], [-5.2, 34.8], [-6.3, 34.3], [-7.6, 32.5], [-9.7, 34.8], [-11.6, 34.8], [-13.7, 32.2], [-14.2, 34.6], [-15, 35.4], [-16.6, 37.5], [-16.3, 38.8], [-15.3, 38.8], [-14.2, 37.5]];
const leaf = [[27.6, 29], [29.2, 28.7], [28.2, 27.9], [28.7, 26.9], [27.4, 25.8], [27.6, 24.5], [27.1, 23.4], [24.2, 23.2], [23.7, 24.8], [22.4, 25], [22.1, 27.4], [24.5, 27.2], [25.5, 28.2], [26.1, 28.5]];
const T = [[11, 0, 8], [16, 0, 9.5], [17.6, 0, 12], [17.8, 0, 14.5], [16.5, 0, 17], [16, 0, 19.5], [16.4, 0, 22], [17.6, 0, 23.8], [19.5, 0, 24.6], [21.5, 0, 23.8], [22.8, 0, 22], [23.4, 0, 19.8]];
const TR = [2.2, 1.9, 1.7, 1.6, 1.5, 1.5, 1.5, 1.4, 1.4, 1.35, 1.3, 1.3];
const tails = ['tail1', 'tail2', 'tail3', 'tail4'];
const TAIL_AT = [0, 3, 6, 9];     // the T point each tail joint pivots on
const RAISED = [[-7, -8, 13], [-11, -13, 11.5], [-15, -16, 14]];

// the black eyes (not lib.scad eye()s): ellipsoids [2.7, 1.1, 3.1] at [±6, -8.6, -1.4] turned 18 deg, in the head
const eyeL = { side: 'L', at: [6, -8.6, -1.4], size: 2.5, yaw: 18, squash: 0.6, frame: HEAD };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: GREEN_DK });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legFL', parent: 'root', at: [6, -2, 15] },
  { name: 'legFR', parent: 'root', at: [-7, -10, 9] },
  { name: 'legBL', parent: 'root', at: [6.5, 11, 6] },
  { name: 'legBR', parent: 'root', at: [-6.5, 11, 6] },
  { name: 'body', parent: 'root', at: [0, 2, 10] },
  { name: 'armR', parent: 'body', at: RAISED[0] },
  { name: 'foreR', parent: 'armR', at: RAISED[1] },
  { name: 'head', parent: 'body', at: HEAD.world([0, 2, -8]) },
  { name: 'earL', parent: 'head', at: EARS.world([2, 0, 28.5]) },
  { name: 'earR', parent: 'head', at: EARS.world([-19.5, 0, 30]) },
  ...tails.map((name, i) => ({ name, parent: i === 0 ? 'body' : tails[i - 1], at: TAILF.world(T[TAIL_AT[i]]) })),
  ...face.joints,
];

const claws = (p, d, dz) => any(...[-1, 0, 1].map((k) => spike([p[0], p[1], p[2] + k * dz], d, 0.75)));
const parts = [
  ['body', blob([[[8.5, 8, 8.5], [-3, -6, 10.5]], [[8.5, 8, 9.5], [0, 3, 12.5]], [[8, 8, 9], [1.5, 12, 10]]])],
  ['head', any(inFrame(HEAD, any(ell([14, 10, 10.5]), ell([6.5, 4, 4.5], [5, -6.3, -5.2]), ell([6.5, 4, 4.5], [-5, -6.3, -5.2]),
    ell([1.7, 1, 1.1], [-1.2, -10.4, -3.9]))), plate(twigPts, 2.0, TWIGS))],
  ['earL', plate(nearEar, 1.8, EARS)],
  ['earR', plate(farEar, 1.8, EARS)],
  ['legFL', any(limb([6, -2, 15], [5.5, -9, 9], 3.6, 3.0), ell([3.3, 3.4, 2.6], [5.2, -11, 7.6]), ell([2.2, 1.6, 2.5], [6.5, -8, 13]),
    claws([3.2, -13.2, 8.3], [-1.6, -1.2, -0.3], 1.3))],
  ['legFR', any(limb([-7, -10, 9], [-9, -13.5, 3], 3.2, 2.8), blob([[[3, 3, 2], [-9.5, -13.5, 2]], [[2.6, 2.4, 1.6], [-10, -16.2, 1.6]]]))],
  ['legBL', any(ell([3.8, 4.5, 4.5], [6.5, 11, 6]), blob([[[3.2, 3.5, 2], [7.5, 9, 2]], [[2.8, 2.5, 1.6], [7.5, 5.5, 1.6]]]))],
  ['legBR', any(ell([3.8, 4.5, 4.5], [-6.5, 11, 6]), blob([[[3, 3.3, 2], [-6.5, 9, 2]], [[2.6, 2.4, 1.6], [-6.5, 6, 1.6]]]))],
  ['armR', limb(RAISED[0], RAISED[1], 3.2, 2.8)],
  ['foreR', any(limb(RAISED[1], RAISED[2], 2.8, 2.8), ell([1.6, 1.2, 1.4], [-15.5, -17.5, 15.5]), ell([3, 2.6, 2.4], [-17, -18.5, 12.6]),
    claws([-19.2, -19.8, 12.6], [-1.9, -1.4, 0], 1.4), ell([1.6, 0.8, 0.8], [-16.5, -20.6, 11.5]))],
  ...chain(['tail1', 'tail1', 'tail1', 'tail2', 'tail2', 'tail2', 'tail3', 'tail3', 'tail3', 'tail4'], T, TR).map(([n, t]) => [n, inFrame(TAILF, t)]),
  ['tail4', inFrame(TAILF, any(ell([1.8, 1.4, 1.8], [23.5, 0, 19.2]), (c) => plate(leaf, 1.0)(c)))],
];

const leafy = (u, cycles, amp = 1) => ({
  earL: { r: [0, -6 * amp * osc(u, cycles), 4 * amp * osc(u, cycles, 0.3)] },
  earR: { r: [0, 6 * amp * osc(u, cycles, 0.15), -4 * amp * osc(u, cycles, 0.45)] },
});
// the raised paw: rx < 0 lifts it (it points forward), rz swings it in front of the face
const paw = (lift, swing = 0, curl = 0) => ({ armR: { r: [-lift, 0, swing] }, foreR: { r: [-curl, 0, 0] } });

const base = quadrupedClips({
  face, tail: tails, hipH: 8, stride: 16,
  add: {
    idle: (t, u) => merge(leafy(u, 2, 0.5), paw(4 * osc(u, 2, 0.2), 0, 6 * osc(u, 4))),
    walk: (t, u) => merge(leafy(u, 2, 1.2), paw(10 + 6 * osc(u, 1), 0, 8 * osc(u, 1, 0.2))),
    idle_sniff: (t, u) => paw(-10 * win(u, 0.1, 0.8, 0.1)),
    idle_shake: (t, u) => paw(0, 10 * Math.sin(TAU * 8 * u) * win(u, 0.1, 0.9, 0.05)),
    idle_wag: (t, u) => paw(20 * win(u, 0.1, 0.9, 0.1), 0, 10 * osc(u, 4)),
    windup: (t, u) => paw(45 * smooth(u / 0.8), -10 * smooth(u / 0.8), 20 * smooth(u / 0.8)),
    lunge: (t, u) => { const k = K(u, [[0, 1], [0.2, 1.1], [0.4, -0.4], [0.7, -0.3], [1, 0]]); return paw(45 * k, -10 * k, 20 * k); },
    hurt: (t, u) => merge(leafy(u, 3, 2), paw(-15 * K(u, [[0, 0], [0.2, 1], [1, 0.4]]))),
    recoil: (t, u) => paw(25 * K(u, [[0, 0], [0.4, 1], [1, 0]]), 15 * K(u, [[0, 0], [0.4, 1], [1, 0]])),
    faint: (t, u) => paw(-25 * smooth((u - 0.2) / 0.55)),
    celebrate: (t, u) => merge(leafy(u, 2, 2), paw(55 + 15 * osc(u, 2), 0, 25 * osc(u, 2))),
    enter: (t, u) => paw(30 * win(u, 0.4, 0.9, 0.12)),
    exit: (t, u) => paw(50 * win(u, 0, 0.85, 0.2), 15 * Math.sin(TAU * 2 * u)),
  },
});

const clips = {
  ...base,

  // fidget: three quick swats of the raised paw at the air, then a proud lift of the head
  idle_swat: {
    seconds: 2.4,
    pose: (t, u) => {
      const s = (u0) => win(u, u0, u0 + 0.08, 0.025);
      const swat = s(0.12) + s(0.27) + s(0.42);
      const ready = win(u, 0.05, 0.55, 0.06);
      const proud = win(u, 0.6, 0.92, 0.08);
      return merge({
        body: { r: [3 * ready - 3 * proud, 0, 0] },
        head: { r: [-8 * proud, 0, 0] },
        ...face.pose('open', 0.4 * ready * (1 - proud)),
        ...paw(30 * ready - 40 * swat, 12 * swat, 25 * ready),
      }, leafy(u, 2, 0.5 + swat));
    },
  },

  // fidget: it spots its own tail leaf, turns to look and the vine curls up to wave back
  idle_tail: {
    seconds: 2.6,
    pose: (t, u) => {
      const look = K(u, [[0, 0], [0.2, 1], [0.75, 1], [0.92, 0]]);
      const wv = Math.sin(TAU * 3 * u) * look;
      return merge({
        body: { r: [0, 0, 8 * look] },
        head: { r: [-4 * look, 0, 24 * look] },
        ...face.pose('open', blinks(u, [[0.5, 0.55]])),
        ...Object.fromEntries(tails.map((n, i) => [n, { r: [0, 6 * wv * (1 + 0.3 * i), 0] }])),
        ...paw(15 * look),
      }, leafy(u, 3, look));
    },
  },
};

export default rigDef({ joints, assign: (c) => pick(c, parts), extras: face.extras, clips });
