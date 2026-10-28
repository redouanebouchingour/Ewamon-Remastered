// Murkrat's rig: a hunched charcoal rat on all fours (its clawed front legs reach the ground), so the quadruped
// template; a smoke plume rolling off its back on two joints that billow on their own. Numbers are scad/murkrat.scad's.
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, blob, chain, ell, limb, mx, petal, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { ellD, isAny, near } from './lib/geo.mjs';
import { legs, quadrupedClips } from './lib/quadruped.mjs';

const FUR = [0.24, 0.26, 0.29];
const FUR_HI = [0.36, 0.38, 0.42];
const FUR_DK = [0.15, 0.16, 0.19];
const SKIN = [0.42, 0.42, 0.45];
const RING = [0.315, 0.315, 0.3375];
const SMOKE = [0.17, 0.18, 0.22];
const SMOKE_HI = [0.3, 0.32, 0.36];

const TAIL = [[0, 11, 6], [2, 16, 3], [7, 18, 1.2], [12, 14, 1], [14, 8, 1.4], [13, 3, 2.5]];
const TAIL_R = [1.6, 1.2, 1, 0.8, 0.6, 0.4];
const tail = ['tail1', 'tail2', 'tail3', 'tail4'];
// the plume's puffs, swirls and wisps as the scad places them ([r, p] after its * 0.8 / 0.85 + 2 transforms)
const at = ([x, y, z]) => [x * 0.9, y + 1, z * 0.85 + 2];
const PUFFS = [
  ...[[[7, 6, 6], [0, 8, 21]], [[6, 5, 6], [-6, 9, 25]], [[6, 5, 6], [6, 9, 25]], [[6, 5, 5.5], [0, 11, 29]], [[4.5, 4, 5], [-5, 12, 33]],
    [[4.5, 4, 5], [4, 12, 34]], [[3.5, 3.5, 3.5], [-1, 13, 38]], [[4, 4, 4], [-9, 6, 19]], [[4, 4, 4], [9, 6, 19]], [[3.5, 3.5, 3.5], [-10, 10, 28]],
    [[3.5, 3.5, 3.5], [10, 10, 29]]].map(([r, p]) => [r.map((v) => v * 0.8), at(p)]),
  ...[[[2.5, 1, 2], [-3, 3, 24]], [[2, 1, 1.8], [4, 4, 27]], [[2.2, 1, 1.6], [0, 6, 31]], [[1.8, 1, 1.4], [-6, 7.5, 31]], [[2, 1, 1.6], [3, 13, 23]],
    [[2.2, 1, 1.8], [-4, 15, 28]], [[1.8, 1, 1.5], [2, 16, 32]]].map(([r, p]) => [r.map((v) => v * 1.2), at(p)]),
  ...[[-12, 8, 35, 1.4], [11, 9, 37, 1.2], [3, 10, 42, 1.3], [-13, 4, 22, 1.2], [13, 6, 24, 1]].map(([x, y, z, w]) => [[w * 0.8, w * 0.8, w * 1.28], [x * 0.9, y, z * 0.85 + 2]]),
];

const eyeL = { side: 'L', at: [2.6, -12.7, 11.2], size: 1.8, yaw: 18, flat: 0.5 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FUR });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legFL', parent: 'root', at: [4, -6, 8] },
  { name: 'legFR', parent: 'root', at: [-4, -6, 8] },
  { name: 'legBL', parent: 'root', at: [5.5, 4, 7.5] },
  { name: 'legBR', parent: 'root', at: [-5.5, 4, 7.5] },
  { name: 'body', parent: 'root', at: [0, 2, 8] },
  { name: 'head', parent: 'body', at: [0, -7, 10] },
  { name: 'earL', parent: 'head', at: [3.6, -6.8, 12.5] },
  { name: 'earR', parent: 'head', at: [-3.6, -6.8, 12.5] },
  { name: 'smoke1', parent: 'body', at: [0, 9, 16] },
  { name: 'smoke2', parent: 'smoke1', at: [0, 11, 26] },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i] })),
  ...face.joints,
];

const parts = [
  ['body', any(blob([[[8, 9, 8], [0, 3, 11]], [[6, 6, 5.5], [0, -4, 9]], [[5, 4, 4], [0, 8, 6]]]), ell([6.5, 7, 4], [0, 3, 16]),
    ell([5, 6, 3], [0, 0, 5.5]))],
  ['head', any(blob([[[5, 5, 4.6], [0, -9, 10.5]], [[2.6, 3, 2.4], [0, -15, 8.5]], [[1.4, 1.5, 1.4], [0, -17.6, 8]]]), ell([1, 0.9, 0.9], [0, -18.6, 8.2]),
    ell([1.8, 1.8, 0.7], [0, -15.2, 6.7]), mx(spike([0.6, -16.8, 7.3], [0, 0, -1], 0.35)), limb([0.8, -15, 6.3], [1.1, -15.3, 3.6], 0.7, 0.45),
    limb([-0.9, -14.5, 6.3], [-1, -14.6, 4.6], 0.55, 0.4), ell([0.7, 0.7, 0.9], [1.1, -15.3, 3.3]), mx(ell([1.9, 1.6, 1.6], [2.6, -12.2, 11.1])),
    mx(limb([4.1, -11, 13.3], [1.4, -13.9, 12.6], 1.1, 0.6)), mx(limb([1.6, -17, 8], [5.2, -18.7, 8], 0.4)))],
  ['ear*', any(petal([2.6, 0.8, 2.8], [4, -7, 14.5], [10, 0, -30]), petal([1.8, 0.4, 2], [3.9, -7.5, 14.5], [10, 0, -30]))],
  ['legF*', any(limb([4, -6, 8], [4.6, -10, 4.5], 1.8, 1.1), limb([4.6, -10, 4.5], [4.8, -12.5, 1.2], 1.1, 0.8), spike([4.8, -13, 0.9], [0, -2.2, -0.6], 1.2))],
  ['legB*', any(ell([3.5, 5, 5], [5.5, 4, 7.5]), ...[0, 1, 2].map((k) => limb([8.2, k * 3, 12 - k * 1.5], [8.7, 3 + k * 3, 8.5 - k * 1.5], 1.2, 0.3)), blob([[[1.8, 4.5, 1.1], [6, 0.5, 1.1]], [[1.5, 1.5, 1.2], [6, 4, 1.5]]]), spike([6, -3.6, 0.8], [0, -1.8, -0.4], 1.2))],
  ...chain(tail, TAIL, TAIL_R),
];

function assign(c, rgb) {
  if ((near(rgb, SMOKE, 0.02) || near(rgb, SMOKE_HI, 0.02)) && c[2] > 14) {
    // whole puffs go to one joint: the upper ones roll on smoke2
    let best = PUFFS[0]; let bd = Infinity;
    for (const q of PUFFS) { const d = ellD(c, q[0], q[1]); if (d < bd) { bd = d; best = q; } }
    return best[1][2] > 25.5 ? 'smoke2' : 'smoke1';
  }
  if (!isAny(rgb, [FUR, FUR_HI, FUR_DK, SKIN, RING], 0.02)) return 'head';   // eyes, mouth, drool, nose
  return pick(c, parts);
}

// the plume rolls: a slow lean and swell, the top puffs lagging behind
const smoke = (u, cycles = 1, amp = 1) => ({
  smoke1: { r: [3 * amp * osc(u, cycles), 0, 4 * amp * osc(u, cycles, 0.25)], s: 1 + 0.05 * amp * osc(u, cycles, 0.1) },
  smoke2: { r: [5 * amp * osc(u, cycles, -0.15), 0, 7 * amp * osc(u, cycles, 0.1)], s: 1 + 0.08 * amp * osc(u, cycles, -0.1) },
});

const base = quadrupedClips({
  face, tail, hipH: 7.5, stride: 14,
  add: {
    idle: (t, u) => smoke(u, 2),
    walk: (t, u) => merge(smoke(u, 1, 1.4), { smoke1: { r: [-8, 0, 0] }, smoke2: { r: [-10, 0, 0] } }),
    idle_sniff: (t, u) => smoke(u, 1),
    idle_shake: (t, u) => smoke(u, 3, 2.2),
    idle_wag: (t, u) => smoke(u, 1),
    windup: (t, u) => ({ smoke1: { s: 1 + 0.15 * u }, smoke2: { s: 1 + 0.2 * u } }),
    lunge: (t, u) => { const h = K(u, [[0, 0], [0.4, 1], [1, 0]]); return { smoke1: { r: [-14 * h, 0, 0], s: 1.15 - 0.1 * h }, smoke2: { r: [-18 * h, 0, 0], s: 1.2 - 0.1 * h } }; },
    hurt: (t, u) => smoke(u, 2, 2),
    faint: (t, u) => { const d = Math.min(1, u / 0.7); return { smoke1: { r: [10 * d, 0, 0], s: 1 - 0.35 * d }, smoke2: { r: [16 * d, 0, 0], s: 1 - 0.5 * d } }; },
    celebrate: (t, u) => merge(smoke(u, 2, 1.5), { smoke1: { s: 1.1 }, smoke2: { s: 1.15 } }),
    enter: (t, u) => ({ smoke1: { s: 0.3 + 0.7 * Math.min(1, u / 0.6) + 0.1 * win(u, 0.5, 0.9, 0.1) }, smoke2: { s: 0.2 + 0.8 * Math.min(1, u / 0.7) } }),
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
