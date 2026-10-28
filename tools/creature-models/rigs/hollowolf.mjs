// Hollowolf's rig: a lean upright werewolf. One hand on the hip (L), the other claw raised (R) with three orbs that
// circle it (the `orbit` joint), the white mane's cascade down the back as a two-link cape, a big brush tail and one
// glowing eye through the blindfold. Numbers are scad/hollowolf.scad's.
import { K, TAU, both, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, pair, pick, spike } from './lib/biped.mjs';
import { eyeKit, blinks } from './lib/face.mjs';

const MASK = [0.08, 0.08, 0.12];
const TAIL = [[2.5, 5, 15], [9, 8, 9], [15, 9, 8], [21, 8, 12], [23, 7, 17]];
const tails = ['tail1', 'tail2', 'tail3', 'tail4'];
const ORBIT = [-14.5, -4.3, 26.8];

const face = eyeKit({ eyes: [{ side: 'L', at: [2.2, -6.1, 35.3], size: 1.75, yaw: 18 }], skin: MASK });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4, 0.5, 14.5]),
  { name: 'body', parent: 'root', at: [0, 0.5, 15] },
  { name: 'head', parent: 'body', at: [0, 0.5, 30] },
  ...pair('ear*', 'head', [3.6, 0, 39]),
  { name: 'armL', parent: 'body', at: [6.5, 0.5, 26] },
  { name: 'foreL', parent: 'armL', at: [8.5, 0, 20] },
  { name: 'armR', parent: 'body', at: [-6.5, 0.5, 26] },
  { name: 'foreR', parent: 'armR', at: [-10.5, -1, 22] },
  { name: 'handR', parent: 'foreR', at: [-11.6, -3.2, 29.5] },
  { name: 'orbit', parent: 'foreR', at: ORBIT },
  { name: 'cape1', parent: 'body', at: [0, 7, 31] },
  { name: 'cape2', parent: 'cape1', at: [0, 7.5, 23] },
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[1] },
  { name: 'tail3', parent: 'tail2', at: TAIL[2] },
  { name: 'tail4', parent: 'tail3', at: TAIL[3] },
  ...face.joints,
];

const tuft = (p, d, r) => limb(p, [p[0] + d[0], p[1] + d[1], p[2] + d[2]], r, 0.3);
const crown = [[0, 70, 9], [30, 60, 10], [-30, 60, 10], [65, 45, 11], [-65, 45, 11], [95, 30, 11], [-95, 30, 11], [125, 25, 11], [-125, 25, 11],
  [155, 35, 10], [-155, 35, 10], [180, 50, 10], [180, 15, 11], [110, 0, 10], [-110, 0, 10], [140, -5, 10], [-140, -5, 10]].map(([az, el, l]) => {
  const a = (az * Math.PI) / 180; const e = (el * Math.PI) / 180;
  const d = [Math.sin(a) * Math.cos(e) * l, -Math.cos(a) * Math.cos(e) * l, Math.sin(e) * l];
  return ['head', tuft([d[0] * 0.3, 3 + d[1] * 0.3, 36 + d[2] * 0.3], d.map((v) => v * 0.9), 2.3)];
});
const locks = [];
for (let i = 0; i <= 6; i++) {
  const x = (i - 3) * 2.3;
  locks.push(['cape1', tuft([x, 8.5, 31 - Math.abs(i - 3) * 0.8], [x * 0.6, 5, -11 - (i % 2) * 3], 2.4)]);
  locks.push(['cape2', tuft([x * 0.8, 9.5, 24 - Math.abs(i - 3) * 0.6], [x * 0.5, 4, -9], 2)]);
}

const parts = [
  ['body', any(blob([[[5.5, 4.5, 4.5], [0, 0.5, 17]], [[6.5, 5, 5], [0, 0, 22]], [[7, 5.5, 4], [0, 0.5, 25]]]), ell([4, 2, 4], [0, -4.4, 22]),
    ell([6, 5, 3.5], [0, 0.5, 15]), ell([4.4, 4, 1], [0, 0.5, 30]), ell([7.5, 6, 1.5], [0, 0.5, 26]), ell([8, 6.5, 4], [0, 0.5, 24]))],
  ['head', any(blob([[[5, 5, 4.6], [0, -0.5, 35]], [[3.6, 3.8, 3.4], [0, -4, 34]], [[2.4, 2.6, 2], [0, -7.5, 33]]]),
    blob([[[2.4, 2.6, 1.8], [0, -7.8, 32.6]], [[1.8, 2, 1.4], [0, -10.6, 32.8]]]), ell([5.5, 5, 4.5], [0, 2.5, 38]), ell([1.6, 1.4, 1.4], [-5, 2, 35.8]))],
  ['ear*', any(ell([1.6, 0.9, 1], [3.6, 0, 39]), spike([3.8, 0, 39], [1.6, 0.5, 6.5], 1.2))],
  ['cape1', ell([7, 5, 6], [0, 5.5, 31])],
  ['cape2', any(ell([6, 4, 6], [0, 6, 23]), ell([3.5, 3, 3], [0, 6, 17]))],
  ...crown,
  ...locks,
  ['armL', limb([6.5, 0.5, 26], [8.5, 0, 20], 2, 1.7)],
  ['foreL', any(limb([8.5, 0, 20], [7, -2.5, 16.5], 1.7, 1.5), ell([1.8, 1.6, 1.6], [6.6, -3, 16]), spike([6.6, -4.4, 15.6], [0, -1.2, -0.5], 0.8))],
  ['armR', limb([-6.5, 0.5, 26], [-10.5, -1, 22], 2, 1.7)],
  ['foreR', limb([-10.5, -1, 22], [-11.5, -3, 28], 1.7, 1.5)],
  ['handR', any(ell([1.8, 1.4, 2], [-11.6, -3.2, 29.5]), spike([-11.6, -3.2, 31], [0, -0.4, 3], 1.6))],
  ['orbit', any(ell([1.8, 1.8, 1.8], [-15, -4, 31]), ell([2, 2, 0.8], [-16, -4, 26.5]), ell([1.6, 1.6, 1.6], [-13.5, -5, 22.5]))],
  ['leg*', any(limb([4, 0.5, 14.5], [5.5, -2.5, 9], 3.2, 2.4), limb([5.5, -2.5, 9], [6, 1.5, 4], 2.2, 1.6), limb([6, 1.5, 4], [6.2, -1.5, 1.2], 1.6, 1.4),
    ell([2.2, 3, 1.2], [6.2, -2.8, 1.2]), spike([6.2, -5.5, 0.9], [0, -1.3, -0.4], 0.8))],
  ...chain(tails, TAIL, [2.2, 3.4, 4, 4, 3.6]),
  ['tail4', any(blob([[[3.8, 3.6, 3.6], [23.5, 7, 20.5]], [[2.6, 2.6, 3], [24, 7, 24]]]), tuft([24, 7, 25], [0.5, 0, 7], 2.2), tuft([23, 7.5, 24], [-3.5, 0.5, 5.5], 1.9),
    tuft([25, 7.5, 23], [4.5, 0.5, 4], 1.9), tuft([25, 6.5, 21], [4.5, -0.5, 1], 1.7))],
];

// the orbs circle the claw: one turn per idle loop, faster when it shows off
const orbit = (deg) => ({ orbit: { r: [0, 0, deg] } });

const base = bipedClips({
  face, tail: tails, hipH: 14.5, stride: 20, armSwing: 14, hopScale: 0.7, hopH: 3.5, cape: ['cape1', 'cape2'],
  punch: { arm: [-30, 10, 0], fore: [70, 0, 0] },
  cheer: { arm: [-6, -60, 0], fore: [-8, 16, 0] },
  add: {
    idle: (t, u) => ({ ...orbit(360 * u), ...both('ear', { r: [2 * osc(u, 2, 0.3), 0, 0] }) }),
    idle_look: (t, u) => orbit(360 * u),
    celebrate: (t, u) => ({ ...orbit(720 * u), handR: { r: [0, 0, 20 * osc(u, 2)] } }),
    faint: (t, u) => orbit(-60 * smooth(u)),
    // the template flicks the tail forward on a hit; this brush curls up at the tip, so keep it behind
    hurt: (t, u) => Object.fromEntries(tails.map((n, i) => [n, { r: [-12 * K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.45]]) * (1 + 0.3 * i), 0, 0] }])),
    recoil: (t, u) => Object.fromEntries(tails.map((n, i) => [n, { r: [-7 * K(u, [[0, 0], [0.4, 1], [1, 0]]) * (1 + 0.3 * i), 0, 0] }])),
  },
});

const clips = {
  ...base,

  // fidget: it juggles the orbs round its claw faster and faster, watching them, then a flick and they settle
  idle_orbs: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = win(u, 0.05, 0.85, 0.12);
      return {
        body: { r: [0, 0, -6 * on] },
        head: { r: [-8 * on, -8 * on, -16 * on] },
        armR: { r: [-10 * on, -10 * on, 0] },
        handR: { r: [0, 0, 25 * osc(u, 3) * on] },
        ...orbit(720 * smooth(u)),
        ...face.pose('open', blinks(u, [[0.9, 0.95]])),
        ...both('ear', { r: [-8 * on, 0, 0] }),
        ...Object.fromEntries(tails.map((n, i) => [n, { r: [0, 0, 6 * osc(u, 2, -0.12 * i) * (1 + 0.3 * i)] }])),
      };
    },
  },
  // fidget: muzzle to the sky, a long silent howl, the brush tail curling up
  idle_howl: {
    seconds: 2.6,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.22, 1], [0.75, 1], [0.95, 0]]);
      const tr = Math.sin(TAU * 12 * u) * win(u, 0.25, 0.75, 0.05);
      return {
        body: { r: [-7 * on, 0, 0] },
        head: { r: [-30 * on + tr, 0, 0] },
        ...face.pose('open', 0.6 * on),
        ...both('ear', { r: [12 * on, 0, 0] }),
        ...orbit(360 * u),
        cape1: { r: [6 * on, 0, 0] },
        ...Object.fromEntries(tails.map((n, i) => [n, { r: [-5 * on, 0, 3 * tr] }])),
      };
    },
  },
};

export default rigDef({ joints, assign: (c) => pick(c, parts), extras: face.extras, clips });
