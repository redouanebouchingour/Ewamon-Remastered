// Hollowolf's rig: a lean upright werewolf. One hand on the hip (L), the other claw raised (R) with three orbs that
// circle it (the `orbit` joint), the mane's cascade down the back as a two-link cape, a big brush tail and two
// glowing eyes in the blindfold. Numbers are scad/hollowolf.scad's (sprite-match remodel, 2026-11-04).
import { K, TAU, both, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, inFrame, limb, pick, spike } from './lib/biped.mjs';
import { subFrame } from './lib/geo.mjs';
import { eyeKit, blinks } from './lib/face.mjs';

const MASK = [0.06, 0.06, 0.13];
const TAIL = [[2.6, 3.5, 10.5], [6.5, 7.5, 6.8], [10.5, 9.5, 7.2], [13, 10, 11], [13.2, 9.8, 15.5]];
const TAIL_R = [2.4, 3.0, 3.4, 3.1, 2.7];
const tails = ['tail1', 'tail2', 'tail3', 'tail4'];
const ORBIT = [-12.7, -5, 16.5];

// the head block: translate(HC) rotate([0, 0, HEAD_YAW])
const HC = [-1.3, -4.5, 27.3];
const hf = subFrame(HC, [0, 0, -30]);
const EYE = [2.45, -2.3, -0.1];
const EAR = [[1.8, 1.8, 2.6], [1.1, 6.6, 6.6]];
const face = eyeKit({
  eyes: [
    { side: 'L', at: EYE, size: 1.0, yaw: 40, frame: hf },
    { side: 'R', at: [-EYE[0], EYE[1], EYE[2]], size: 1.0, yaw: -40, frame: hf },
  ],
  skin: MASK,
});
const earAt = (s) => hf.world([s * EAR[0][0], EAR[0][1], EAR[0][2]]);

const SN = [4.6, -1.5, 21]; const EN = [8.4, 0.5, 17.5]; const WN = [6.0, -1.8, 14.8];
const SF = [-4.2, -1.6, 20.6]; const EF = [-8.6, -2.5, 15.8]; const WF = [-12.2, -3.5, 20.8];
const PALM = [-12.8, -3.6, 22];
const LEGS = {
  L: [[3.4, 1, 11], [7.4, -2.2, 6.8], [8.2, 1.2, 3.4], [8.8, -1.4, 1.0], [0.3, -1]],
  R: [[-3.4, 1, 11], [-7.6, -1.6, 7.4], [-8.4, 1.4, 3.4], [-8.9, -1.2, 1.0], [-0.3, -1]],
};

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: LEGS.L[0] },
  { name: 'legR', parent: 'root', at: LEGS.R[0] },
  { name: 'body', parent: 'root', at: [0, 0.5, 12] },
  { name: 'head', parent: 'body', at: [-0.8, -3.4, 25] },
  { name: 'earL', parent: 'head', at: earAt(1) },
  { name: 'earR', parent: 'head', at: earAt(-1) },
  { name: 'armL', parent: 'body', at: SN },
  { name: 'foreL', parent: 'armL', at: EN },
  { name: 'armR', parent: 'body', at: SF },
  { name: 'foreR', parent: 'armR', at: EF },
  { name: 'handR', parent: 'foreR', at: WF },
  { name: 'orbit', parent: 'foreR', at: ORBIT },
  { name: 'cape1', parent: 'body', at: [0.5, 4.5, 29] },
  { name: 'cape2', parent: 'cape1', at: [0.5, 6, 22] },
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[1] },
  { name: 'tail3', parent: 'tail2', at: TAIL[2] },
  { name: 'tail4', parent: 'tail3', at: TAIL[3] },
  ...face.joints,
];

// a plock(p0, p1, p2, w) of the scad as two tapering capsules
const lock = (m) => any(limb(m[0], m[1], m[3] * 0.45, m[3] * 0.36), limb(m[1], m[2], m[3] * 0.36, 0.3));
// the swept mane: [root, azimuth, elevation, length, width, colour, arch] -> sweepPts() of the scad
const MANE_ROOTS = [[-1, -2, 33.5], [-0.5, 0, 32], [0, 2.5, 29.5], [-3, -4.5, 31.5]];
const MANE = [
  [0, 20, 85, 7, 4.4, 0, 0], [0, 45, 48, 8.5, 4.6, 0, 0.5], [0, 60, 34, 9.5, 4.8, 0, 0.6], [0, 60, 6, 11, 4.8, 0, 0.8],
  [0, -20, 60, 9, 4.2, 1, 0.4],
  [1, 50, 22, 9, 4.8, 1, 0.6], [1, 60, -9, 11, 5.0, 0, 0.8], [1, 70, -17, 12.5, 5.0, 1, 0.8], [1, -40, 25, 10, 4.4, 1, 0.5],
  [1, 30, 5, 12, 4.8, 0, 0.6],
  [2, 65, -29, 11.5, 4.8, 2, 0.6], [2, 55, -55, 12.5, 4.6, 2, 0.4], [2, 30, -45, 14, 4.6, 1, 0.4], [2, 0, -60, 17, 4.6, 2, 0.4],
  [2, -30, -40, 13, 4.4, 2, 0.4], [2, 80, -40, 11, 4.4, 2, 0.4],
  [3, -80, 37, 9.8, 3.8, 0, 0.3], [3, -90, 3, 7.8, 3.6, 1, 0.3], [3, -45, 68, 8.8, 4.0, 0, 0.3],
];
const D2R = Math.PI / 180;
const sweep = ([ri, az, el, L, w, , arch]) => {
  const r = MANE_ROOTS[ri];
  const d = [Math.sin(az * D2R) * Math.cos(el * D2R), Math.cos(az * D2R) * Math.cos(el * D2R), Math.sin(el * D2R)];
  const l = L * 1.12;
  return [r, r.map((v, i) => v + d[i] * l * 0.5 + (i === 2 ? arch : 0)), r.map((v, i) => v + d[i] * l), w * 0.82];
};
const MANE_PTS = MANE.map(sweep);
const TIP = [
  [[13, 9.8, 14.5], [12.8, 9.8, 17.5], [12, 9.8, 19.5], 4.4], [[14.4, 9.8, 14.5], [15.2, 9.8, 17], [15.6, 9.8, 18.6], 3.0],
  [[13, 8.3, 14.5], [12.8, 7.9, 17.5], [12.2, 7.7, 19.2], 3.4],
  [[13, 9.8, 16], [13.4, 9.8, 20.5], [11.6, 9.8, 25], 5.0], [[14.4, 9.8, 15.5], [15.8, 9.8, 19], [15.4, 9.8, 22.5], 3.4],
  [[11.8, 9.8, 16], [10.6, 9.8, 19.5], [9.6, 9.8, 21.5], 3.2], [[13, 11.4, 16.5], [13.2, 11.8, 20.5], [12.2, 11.8, 23.5], 3.6],
  [[13, 8.2, 16.5], [13, 7.9, 20], [11.8, 7.8, 23], 3.6],
];
const FLUFF = [
  [[5.5, 7, 4.6], [0.6, 0.8, -2.4]], [[8.5, 8.6, 4.2], [0.5, 0.8, -2.4]], [[11.5, 10, 4.8], [1.2, 0.6, -2.2]],
  [[15.2, 10.2, 8.5], [1.6, 0.4, -0.8]], [[15.4, 10.2, 12], [1.6, 0.3, 0.2]],
  [[8, 11, 8], [0, 2.4, -0.6]], [[12, 12.6, 9.5], [0.5, 2.4, 0]],
];
const fluffJoint = (p) => (p[0] < 7 ? 'tail1' : p[2] > 10 ? 'tail4' : p[0] < 11 ? 'tail2' : 'tail3');
const hemRing = (n0, n1, step, rx, ry, cy, z) => {
  const out = [];
  for (let a = n0; a <= n1; a += step) {
    const r = (a * Math.PI) / 180;
    out.push([rx * Math.sin(r), cy - ry * Math.cos(r), z]);
  }
  return out;
};
const HEM = hemRing(-130, 130, 26, 4.7, 4.1, -2.2, 19.6);
const CHEST = hemRing(-110, 110, 22, 4.6, 3.8, -1.5, 16.0);

const leg = (L) => any(limb(L[0], L[1], 2.7, 2.3), limb(L[1], L[2], 2.2, 1.6), limb(L[2], L[3], 1.6, 1.4),
  ell([2.6, 3.2, 1.4], [L[3][0], L[3][1], L[3][2] + 0.3]), limb(L[3], [L[3][0] + L[4][0] * 4.6, L[3][1] + L[4][1] * 4.6, 0.4], 1.4, 0.5));

const parts = [
  ['body', any(ell([4.4, 3.8, 3.4], [0, 0, 14]), ell([5.3, 4.3, 3.6], [0, -1.5, 17.8]), limb([0, -1.5, 19], [-0.8, -3.5, 24], 2.8, 2.4),
    blob([[[3.2, 3.2, 0.9], [-0.8, -3.4, 25]], [[5.1, 4.5, 1.4], [0, -2.2, 19.6]]]), ell([1.0, 0.7, 1.0], [0, -7.0, 18.9]))],
  ...HEM.map((p) => ['body', limb(p, [p[0] * 1.2, -2.2 + (p[1] + 2.2) * 1.2, p[2] - 3.8], 1.2, 0.4)]),
  ...CHEST.map((p) => ['body', limb(p, [p[0] * 1.15, -1.5 + (p[1] + 1.5) * 1.2, p[2] - 3.4], 1.15, 0.4)]),
  ['legL', leg(LEGS.L)],
  ['legR', leg(LEGS.R)],
  ['body', ell([4.6, 4.0, 3.0], [0, 1, 11.6])],
  ['head', inFrame(hf, any(ell([3.2, 3.6, 3.3], [0, 1, 0.6]), blob([[[2.6, 2.6, 2.2], [0, -2.5, 0.6]], [[1.8, 1.6, 1.6], [0, -4.8, 0.4]]]),
    blob([[[2.2, 2.4, 1.8], [0, -3, -1.5]], [[1.3, 1.3, 1.2], [0, -5.8, -1.9]]]), blob([[[1.9, 2.2, 1.1], [0, -2, -3]], [[0.9, 1, 0.6], [0, -5.2, -2.9]]]),
    ell([0.75, 0.6, 0.55], [0, -6.6, -1.75]), ell([1.1, 0.6, 1.2], EYE), ell([1.1, 0.6, 1.2], [-EYE[0], EYE[1], EYE[2]])))],
  ['earL', inFrame(hf, spike(EAR[0], EAR[1], 1.5))],
  ['earR', inFrame(hf, spike([-EAR[0][0], EAR[0][1], EAR[0][2]], [-EAR[1][0], EAR[1][1], EAR[1][2]], 1.5))],
  // the white crown rides the head, the back of the mane and its lilac cascade are the cape
  ['head', any(ell([4.2, 4.2, 3.6], [-1, -0.5, 32.5]), ell([3, 3, 2.4], [-3.6, -4, 31.6]))],
  ['cape1', any(ell([5, 4.5, 4.5], [0.3, 3, 30]), ell([5, 4, 4.5], [0.5, 5, 25]))],
  ['cape2', ell([3.6, 3, 3.2], [0.5, 6, 18.5])],
  // crown and forelock locks ride the head; the locks from the back of the head are the cape, the long low ones its
  // second link
  ...MANE_PTS.flatMap((q, i) => (MANE[i][0] === 2
    ? [['cape1', limb(q[0], q[1], q[3] * 0.45, q[3] * 0.36)], ['cape2', limb(q[1], q[2], q[3] * 0.36, 0.3)]]
    : [[MANE[i][0] === 1 ? 'cape1' : 'head', lock(q)]])),
  // near arm, hand on the hip
  ['armL', any(ell([2.2, 2.2, 2.2], SN), limb(SN, EN, 2.0, 1.6))],
  ['foreL', any(limb(EN, WN, 1.6, 1.3), ell([1.5, 1.3, 1.6], [5.4, -2.3, 14.2]), limb([5, -3.2, 13.6], [4.7, -3.7, 12.2], 0.5, 0.3),
    limb([4.3, -3.2, 13.6], [3.8, -3.7, 12.2], 0.5, 0.3), limb([5.7, -3.2, 13.6], [5.6, -3.7, 12.2], 0.5, 0.3), limb([9, 1.1, 17.1], [10.2, 2.1, 14.9], 1.2, 0.4))],
  // far arm, raised with the claws fanned
  ['armR', any(ell([1.9, 1.9, 1.9], SF), limb(SF, EF, 1.8, 1.6))],
  ['foreR', any(limb(EF, WF, 1.6, 1.25), limb([-9, -2.1, 15.2], [-9.6, -0.9, 12.8], 1.2, 0.4))],
  ['handR', any(ell([1.6, 1.1, 1.8], PALM), limb([-14, -3.6, 22], [-15.8, -3.8, 22.8], 0.6, 0.3), limb([-13.8, -3.6, 23], [-15.1, -3.8, 24.8], 0.6, 0.3),
    limb([-13, -3.6, 23.5], [-13.3, -3.8, 25.6], 0.6, 0.3), limb([-11.8, -3.6, 22.5], [-10.9, -3.8, 24.4], 0.6, 0.3))],
  ['orbit', any(ell([1.5, 1.5, 1.5], [-16.6, -5, 19.9]), ell([2.3, 1.8, 2.3], ORBIT), ell([1.4, 1.4, 1.4], [-8.9, -5, 13]))],
  // tail
  ...chain(tails, TAIL, TAIL_R),
  ...FLUFF.map(([p, d]) => [fluffJoint(p), limb(p, [p[0] + d[0], p[1] + d[1], p[2] + d[2]], 1.6, 0.4)]),
  ...TIP.map((m) => ['tail4', lock(m)]),
];

// the orbs circle the claw: one turn per idle loop, faster when it shows off
const orbit = (deg) => ({ orbit: { r: [0, 0, deg] } });

const base = bipedClips({
  face, tail: tails, hipH: 11, stride: 20, armSwing: 14, hopScale: 0.7, hopH: 3.5, cape: ['cape1', 'cape2'],
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
