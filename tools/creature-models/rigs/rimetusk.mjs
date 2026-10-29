// Rimetusk's rig: a woolly mammoth on four pillar legs, a heap of glacier ice on the crown, a long trunk hanging to the
// ground (a three-link chain passed as the template's mane) and huge curled tusks on the head. Numbers are
// scad/rimetusk.scad's (the pre-sprite-pass model: re-rig when its new model lands).
// The template's sniff dips the head 24 deg, which would drive the trunk into the ground, so it is left out.
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, ell, limb, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { chainHit, isAny, near } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const FUR_DK = [0.35, 0.2, 0.1];
const SNOW = [[0.76, 0.88, 0.96], [0.6, 0.82, 0.97], [0.4, 0.62, 0.88]];
const NAIL = [0.8, 0.9, 0.96];
const IVORY = [0.95, 0.9, 0.76];

const TRUNK = [[0, -16.6, 14], [0, -18.6, 9.5], [0, -19.4, 5.5], [0, -19.6, 2.6], [0, -21.4, 1.6], [0, -22.6, 2.8]];
const TRUNK_R = [3.2, 2.7, 2.2, 1.8, 1.5, 1.2];
const trunk = ['trunk1', 'trunk2', 'trunk3'];
const LEGS = [['F', -2.5], ['B', 11]];

const eyeL = { side: 'L', at: [3.8, -15.5, 19.6], size: 2.1, yaw: 8 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FUR_DK });

const joints = [
  { name: 'root', at: [0, 4, 0] },
  ...LEGS.flatMap(([k, y]) => [{ name: `leg${k}L`, parent: 'root', at: [6.4, y, 10] }, { name: `leg${k}R`, parent: 'root', at: [-6.4, y, 10] }]),
  { name: 'body', parent: 'root', at: [0, 4, 11] },
  { name: 'head', parent: 'body', at: [0, -7, 19] },
  { name: 'earL', parent: 'head', at: [7.2, -9, 19] },
  { name: 'earR', parent: 'head', at: [-7.2, -9, 19] },
  ...trunk.map((name, i) => ({ name, parent: i === 0 ? 'head' : trunk[i - 1], at: TRUNK[[0, 1, 2][i]] })),
  { name: 'tail1', parent: 'body', at: [0, 17, 15] },
  ...face.joints,
];

const legT = (y) => any(limb([6.4, y, 10], [6.4, y, 2.4], 3.7, 3.5), ell([4.3, 4.3, 1.9], [6.4, y, 2.6]), ell([3, 1.2, 1], [6.4, y - 3.6, 0.9]));
const parts = [
  ...LEGS.map(([k, y]) => [`leg${k}*`, legT(y)]),
  ['body', any(ell([10.5, 8.5, 10], [0, -1, 18.5]), ell([9.5, 7.5, 8], [0, 10, 14]), ell([10.4, 11, 5.5], [0, 4, 11]),
    ell([12.2, 12.6, 7], [0, 4, 8]))],
  ['head', any(ell([7.2, 6.5, 7.5], [0, -8.5, 24]), ell([6.2, 4.6, 6], [0, -13.5, 17.5]), ell([3.6, 2.8, 3.2], [0, -16.8, 13]))],
  ['ear*', any(ell([1.8, 4.2, 5.8], [8, -7, 19]), limb([9, -7.2, 19.5], [9.6, -6.8, 13.4], 1.1))],
  ['tail1', any(limb([0, 17, 15], [0, 19, 10.5], 1.1, 0.8), spike([0, 19, 10.5], [0, 1.4, -3], 1.2))],
];
const legOf = (c) => `leg${c[1] < 4 ? 'F' : 'B'}${c[0] >= 0 ? 'L' : 'R'}`;

function assign(c, rgb) {
  if (near(rgb, NAIL, 0.03) && c[2] < 2.5) return legOf(c);
  if (near(rgb, IVORY, 0.03)) return 'head';
  if (isAny(rgb, [...SNOW, NAIL], 0.03)) {
    if (c[2] < 5.5 && c[1] > -15) return legOf(c);
    if (c[1] > 18 && c[2] < 12) return 'tail1';
    if (Math.abs(c[0]) > 8.5 && c[1] < -16) return 'head';                  // the tusks' frost
    if (c[2] > 25) return c[1] < -3.5 ? 'head' : 'body';                     // the ice heap and the snow cap
  }
  const t = chainHit(c, TRUNK, TRUNK_R);
  if (t.d < 1.25 && c[2] < 13.5 && Math.abs(c[0]) < 4) return trunk[Math.min(2, t.i)];
  return pick(c, parts);
}

const curl = (k) => Object.fromEntries(trunk.map((n, i) => [n, { r: [-k * (0.6 + 0.4 * i), 0, 0] }]));
const base = quadrupedClips({
  face, tail: ['tail1'], mane: trunk, hipH: 10, stride: 10,
  add: {
    lunge: (t, u) => curl(30 * K(u, [[0.15, 0], [0.4, 1], [0.6, 1], [1, 0]])),
    faint: (t, u) => curl(24 * smooth((u - 0.15) / 0.6)),
    celebrate: (t, u) => curl(30 * win(u, 0, 1, 0.15)),
  },
});
delete base.idle_sniff;

const clips = {
  ...base,

  // fidget: the trunk swings up into a trumpet, the head lifts and the ears flare
  idle_trumpet: {
    seconds: 2.6,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.22, 1], [0.7, 1], [0.88, 0]]);
      const blare = osc(u, 12) * win(u, 0.3, 0.68, 0.04);
      return merge({
        body: { r: [-3 * up, 0, 0] },
        head: { r: [-10 * up, 0, 0] },
        ...curl(48 * up + 3 * blare),
        earL: { r: [0, 0, -30 * up] },
        earR: { r: [0, 0, 30 * up] },
        ...face.pose(up > 0.5 ? 'squeeze' : 'open'),
      });
    },
  },

  // fidget: a heavy stamp of a front foot that shakes the snow on its back
  idle_stomp: {
    seconds: 2,
    pose: (t, u) => {
      const lift = K(u, [[0.1, 0], [0.3, 1], [0.4, 0]]);
      const jolt = Math.sin(TAU * 6 * u) * win(u, 0.4, 0.75, 0.03) * (1 - u);
      return merge({
        legFL: { r: [-18 * lift, 0, 0], p: [0, 0, 1.4 * lift] },
        body: { r: [0, 2 * jolt - 2 * lift, 0] },
        head: { r: [2 * jolt, 0, 0] },
        ...face.pose('open', blinks(u, [[0.4, 0.46]])),
      }, Object.fromEntries(trunk.map((n, i) => [n, { r: [0, 0, 6 * jolt * (1 + 0.3 * i)] }])));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
