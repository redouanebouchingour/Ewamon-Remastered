// Murkrat's rig: a big charcoal rat crouched on its long hind feet, one clawed arm reaching forward, the other paw
// held at its chest, so the quadruped template (the front "legs" are the arms); a cloud of smoke billowing off its
// back on two joints that roll on their own. Numbers are scad/murkrat.scad's, authored in sheet z and dropped by G.
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, blob, chain, ell, inFrame, limb, petal, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near, subFrame } from './lib/geo.mjs';
import { legs, quadrupedClips } from './lib/quadruped.mjs';

const G = 3.6;
const S = ([x, y, z]) => [x, y, z - G];
const F = subFrame([0, 0, -G]);
const sh = (test) => inFrame(F, test);

const FUR = [0.3, 0.32, 0.35];
const FUR_DK = [0.21, 0.22, 0.25];
const EAR = [0.12, 0.11, 0.14];
const CLAW = [0.47, 0.47, 0.49];
const TAILC = [0.35, 0.35, 0.38];
const RING = [0.26, 0.27, 0.3];
const SMOKE = [0.17, 0.17, 0.21];
const SMOKE_LT = [0.35, 0.38, 0.41];

const HC = [-3.5, -13, 18.3];
const HROT = [22, 0, -25];
const headF = subFrame(S(HC), HROT);
const inHead = (test) => inFrame(headF, test);

const TAIL = [[1.5, 11, 13], [5, 13.5, 9], [8, 11, 5.5], [8.6, 5, 4.6], [7.2, -2, 4.5], [4.2, -8, 4.5], [2.6, -10.2, 5.4]];
const TAIL_R = [1.4, 1.2, 1, 0.8, 0.65, 0.5, 0.3];
const tail = ['tail1', 'tail2', 'tail3', 'tail4'];

const eyeL = { side: 'L', at: [2.1, -3.5, 1.2], size: 1.6, yaw: 55, flat: 0.5, frame: headF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FUR_DK });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legFL', parent: 'root', at: S([4, -4, 16]) },
  { name: 'legFR', parent: 'root', at: S([-4.5, -7, 14]) },
  { name: 'legBL', parent: 'root', at: S([5, 0.5, 12]) },
  { name: 'legBR', parent: 'root', at: S([-5, 0.5, 12]) },
  { name: 'body', parent: 'root', at: S([0, 0, 12]) },
  { name: 'head', parent: 'body', at: S([-1.8, -8.5, 17.8]) },
  { name: 'earL', parent: 'head', at: headF.world([2.5, 1.4, 2.6]) },
  { name: 'earR', parent: 'head', at: headF.world([-2.5, 1.4, 2.6]) },
  { name: 'smoke1', parent: 'body', at: S([0, 3, 21]) },
  { name: 'smoke2', parent: 'smoke1', at: S([0.6, 3.5, 28.5]) },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: S(TAIL[[0, 2, 3, 4][i]]) })),
  ...face.joints,
];

const claws = (p, d, r) => [-1, 0, 1].map((k) => spike([p[0] + 0.55 * k, p[1], p[2]], [d[0] * k, d[1], d[2]], r));
const parts = [
  ['body', sh(any(blob([[[6, 6, 6.5], [0, -5, 15]], [[7.5, 7.5, 8.5], [0, 4, 14.5]], [[6, 7, 4.5], [0, 0, 20]]]), limb([0, -4, 17.5], [-1.8, -8.5, 17.8], 5, 4.4)))],
  ['head', inHead(any(blob([[[4.2, 4.4, 4.1], [0, 0, 0]], [[2.4, 3, 2], [0, -4.5, 0]], [[1.1, 1.3, 1], [0, -9, -0.2]]]), ell([0.85, 0.75, 0.75], [0, -9.9, -0.2]),
    blob([[[1.8, 2, 1], [0, -3.5, -2.6]], [[0.9, 1, 0.6], [0, -7.5, -2.7]]]), ell([1.4, 3, 0.8], [0, -5.6, -1.9]),
    limb([0.9, -8.2, -0.4], [4.6, -9.2, -0.4], 0.3), limb([-0.9, -8.2, -0.4], [-4.6, -9.2, -0.4], 0.3)))],
  ['earL', inHead(petal([2.3, 0.7, 2.4], [2.5, 1.4, 3.7], [0, 25, 35]))],
  ['earR', inHead(petal([2.3, 0.7, 2.4], [-2.5, 1.4, 3.7], [0, -25, -35]))],
  ['legFR', sh(any(limb([-4.5, -7, 14], [-5.6, -12, 10.4], 1.9, 1.2), limb([-5.6, -12, 10.4], [-6.6, -18, 9.6], 1.2, 0.9), ell([1.1, 1.5, 0.8], [-6.8, -18.8, 9.2]),
    ...claws([-6.8, -19.6, 9], [0.25, -1, -2.2], 0.36)))],
  ['legFL', sh(any(limb([4, -4, 16], [4.4, -7, 10.6], 1.8, 1.2), limb([4.4, -7, 10.6], [3.2, -10.3, 12], 1.2, 0.9), ell([1, 1, 1.1], [3.1, -10.8, 11.6]),
    ...claws([3.1, -11.3, 11], [0.15, -0.6, -2.4], 0.32)))],
  ['legBL', sh(any(ell([3.5, 5, 5.5], [5, 0.5, 12]), limb([5.3, 3, 8.5], [5.6, 7, 4.8], 1.7, 1), blob([[[1.1, 1.6, 0.8], [5.6, 6.5, 4.4]], [[1, 1.2, 0.6], [5.4, -2, 4.2]]]),
    ...claws([5.4, -2.9, 4.1], [0.2, -1.4, -0.3], 0.3)))],
  ['legBR', sh(any(ell([3.5, 5, 5.5], [-5, 0.5, 12]), limb([-5, 0, 9], [-5, -1, 4.8], 1.7, 1), blob([[[1.2, 1.8, 0.8], [-5, -1, 4.4]], [[1, 1.2, 0.6], [-5, -8.5, 4.2]]]),
    ...claws([-5, -9.4, 4.1], [0.2, -1.4, -0.3], 0.3)))],
  // links 0-1 (out of the rump and down) on tail1, then one link each, the last two on the tip
  ...chain(['tail1', 'tail1', 'tail2', 'tail3', 'tail4'], TAIL, TAIL_R).map(([n, t]) => [n, sh(t)]),
];

function assign(c, rgb) {
  // the cloud (and its pale streaks): the top rolls on smoke2
  if ((near(rgb, SMOKE, 0.02) || near(rgb, SMOKE_LT, 0.02)) && c[2] + G > 15) return c[2] + G > 28.5 ? 'smoke2' : 'smoke1';
  if (!isAny(rgb, [FUR, FUR_DK, EAR, CLAW, TAILC, RING], 0.02)) return 'head';   // eyes, nose, mouth, teeth, drool
  return pick(c, parts.map(([n, t]) => [n, t]));
}

// the plume rolls: a slow lean and swell, the top puffs lagging behind
const smoke = (u, cycles = 1, amp = 1) => ({
  smoke1: { r: [3 * amp * osc(u, cycles), 0, 4 * amp * osc(u, cycles, 0.25)], s: 1 + 0.05 * amp * osc(u, cycles, 0.1) },
  smoke2: { r: [5 * amp * osc(u, cycles, -0.15), 0, 7 * amp * osc(u, cycles, 0.1)], s: 1 + 0.08 * amp * osc(u, cycles, -0.1) },
});

const base = quadrupedClips({
  face, tail, hipH: 8.4, stride: 14,
  add: {
    idle: (t, u) => smoke(u, 2),
    walk: (t, u) => merge(smoke(u, 1, 1.4), { smoke1: { r: [-8, 0, 0] }, smoke2: { r: [-10, 0, 0] } }),
    idle_sniff: (t, u) => smoke(u, 1),
    idle_shake: (t, u) => smoke(u, 3, 2.2),
    idle_wag: (t, u) => smoke(u, 1),
    windup: (t, u) => ({ smoke1: { s: 1 + 0.15 * u }, smoke2: { s: 1 + 0.2 * u } }),
    lunge: (t, u) => { const h = K(u, [[0, 0], [0.4, 1], [1, 0]]); return { smoke1: { r: [-14 * h, 0, 0], s: 1.15 - 0.1 * h }, smoke2: { r: [-18 * h, 0, 0], s: 1.2 - 0.1 * h } }; },
    hurt: (t, u) => smoke(u, 2, 2),
    faint: (t, u) => { const d = Math.min(1, u / 0.7); return { smoke1: { r: [10 * d, 0, 0], s: 1 - 0.3 * d }, smoke2: { r: [16 * d, 0, 0], s: 1 - 0.4 * d } }; },
    celebrate: (t, u) => merge(smoke(u, 2, 1.5), { smoke1: { s: 1.1 }, smoke2: { s: 1.15 } }),
    enter: (t, u) => ({ smoke1: { s: 0.6 + 0.4 * Math.min(1, u / 0.6) + 0.1 * win(u, 0.5, 0.9, 0.1) }, smoke2: { s: 0.55 + 0.45 * Math.min(1, u / 0.7) } }),
    exit: (t, u) => ({ smoke1: { s: 1 + 0.25 * u }, smoke2: { s: 1 + 0.35 * u } }),
  },
});

const clips = {
  ...base,

  // fidget: a furtive look over each shoulder, hunched low, then it rubs its front claws together
  idle_skulk: {
    seconds: 2.8,
    pose: (t, u) => {
      const look = K(u, [[0, 0], [0.1, 0], [0.2, 30], [0.36, 30], [0.46, -28], [0.6, -28], [0.68, 0]]);
      const low = win(u, 0.06, 0.9, 0.1);
      const rub = Math.sin(TAU * 6 * u) * win(u, 0.66, 0.94, 0.04);
      return merge({
        root: { p: [0, 0, -0.5 * low] },
        body: { r: [3 * low, 0, 0.3 * look] },
        head: { r: [-5 * low, 0, look] },
        ...face.pose('open', 0.3 * low + blinks(u, [[0.62, 0.66]])),
        earL: { r: [-12 * low, 0, 0] }, earR: { r: [-12 * low, 0, 0] },
        ...legs({ r: [-14 * win(u, 0.66, 0.94, 0.04), 6 * rub, 0] }, { r: [0, 0, 0] }, { r: [-14 * win(u, 0.66, 0.94, 0.04), -6 * rub, 0] }),
      }, smoke(u, 1, 0.7));
    },
  },

  // fidget: it coughs up a puff: the plume swells, the head jerks down twice, the smoke shrinks back
  idle_cough: {
    seconds: 2,
    pose: (t, u) => {
      const c1 = win(u, 0.25, 0.35, 0.03); const c2 = win(u, 0.45, 0.55, 0.03);
      const swell = K(u, [[0, 0], [0.25, 0], [0.4, 1], [0.6, 1], [0.95, 0]]);
      return merge({
        body: { r: [4 * (c1 + c2), 0, 0] },
        head: { r: [14 * (c1 + c2), 0, 0] },
        ...face.pose(c1 + c2 > 0.3 ? 'squeeze' : 'open'),
        smoke1: { s: 1 + 0.15 * swell, r: [-2 * swell, 0, 0] },
        smoke2: { s: 1 + 0.15 * swell, r: [-3 * swell, 0, 0] },
      }, smoke(u, 1, 0.6));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
