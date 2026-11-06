// Rimetusk's rig: a woolly mammoth on four pillar legs under a glacier of ice blocks (on the body), a long trunk
// hanging between huge spiral tusks (a three-link chain passed as the template's mane), big ears. Numbers are
// scad/rimetusk.scad's (the 2026-11-04 sprite-match model, Shagtusk's fur technique).
// The template's sniff dips the head 24 deg, which would drive the trunk into the ground, so it is left out.
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, ell, limb, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { chainHit, ellD, fold, isAny, near } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const FACE = [0.5, 0.34, 0.24];
const ICE = [[0.82, 0.92, 0.92], [0.5, 0.7, 0.82], [0.62, 0.8, 0.88], [0.33, 0.5, 0.64]];
const ICE_DK = [0.33, 0.5, 0.64];
const IVORY = [0.93, 0.91, 0.81];

const B = [[[0, -1, 20], [12.5, 10, 12.5]], [[0, 6, 18.5], [12.5, 9, 11.5]], [[0, 13, 15.5], [12, 10, 10.5]]];
const H = [[0, -9.5, 22], [9.5, 8, 9]];
const M = [[0, -13.5, 16.5], [5.6, 4.5, 5]];
const TRUNK = [[0, -16.8, 19.5], [0, -17.9, 15.5], [0, -18.4, 12], [0, -18.6, 9], [0, -19, 6.6], [0, -20.4, 5.8]];
const TRUNK_R = [3, 2.7, 2.4, 2.1, 1.8, 1.4];
const trunk = ['trunk1', 'trunk2', 'trunk3'];
const LEGS = [['F', 7.6, -9.5], ['B', 7.6, 12.5]];
const EAR = [9, -9.6, 25.6];

const eyeL = { side: 'L', at: [5, -15.9, 23], size: 2.4, yaw: 26, flat: 0.5 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FACE });

const joints = [
  { name: 'root', at: [0, 2, 0] },
  ...LEGS.flatMap(([k, x, y]) => [{ name: `leg${k}L`, parent: 'root', at: [x, y, 10.5] }, { name: `leg${k}R`, parent: 'root', at: [-x, y, 10.5] }]),
  { name: 'body', parent: 'root', at: [0, 3, 12] },
  { name: 'head', parent: 'body', at: [0, -7, 20] },
  { name: 'earL', parent: 'head', at: [7.8, -9.6, 25.6] },
  { name: 'earR', parent: 'head', at: [-7.8, -9.6, 25.6] },
  ...trunk.map((name, i) => ({ name, parent: i === 0 ? 'head' : trunk[i - 1], at: TRUNK[i] })),
  { name: 'tail1', parent: 'body', at: [0, 20, 18.5] },
  ...face.joints,
];

const grow = ([c, r], g) => ell(r.map((v) => v + g), c);
const legT = (x, y) => any(limb([x, y, 10.5], [x, y, 4.6], 4.2, 4.4), ell([5.2, 5.2, 3], [x, y, 3]), ell([5.9, 5.9, 3.4], [x, y, 9.6]));
const tuskT = ell([6.5, 5, 7.5], [12.2, -13.4, 15.4]);
const parts = [
  ...LEGS.map(([k, x, y]) => [`leg${k}*`, legT(x, y)]),
  ['body', any(...B.map((e) => grow(e, 1.4)), ell([9, 9, 7], [0, 3, 31]))],
  ['head', any(grow(H, 1.3), grow(M, 0.5), tuskT)],
  ['ear*', ell([2.6, 4.6, 5.2], EAR)],
  ['tail1', any(limb([0, 20, 18.5], [0, 24, 13.5], 1.7, 1.2), limb([0, 24, 13.5], [0, 26.6, 9.6], 1.4, 0.3))],
];
const legOf = (c) => `leg${c[1] < 1.5 ? 'F' : 'B'}${c[0] >= 0 ? 'L' : 'R'}`;

function assign(c, rgb) {
  if (near(rgb, IVORY, 0.03)) return 'head';                                 // the tusks
  if (isAny(rgb, ICE, 0.03)) {
    if (near(rgb, ICE_DK, 0.03) && c[2] < 2.2) return legOf(c);               // the toenails
    if (c[2] < 7 && Math.abs(c[0]) > 2.5 && c[1] > -14) return legOf(c);       // the snow cuffs
    if (tuskT(fold(c)) < 1.25) return 'head';                                // the tusks' crust and ice chunks
    if (c[1] > 23 && c[2] < 16) return 'tail1';
    if (ellD(c, H[1].map((v) => v + 1.2), H[0]) < 1.06 && c[2] < 30.5 && c[1] < -8) return 'head';   // the forehead ice
    return 'body';                                                           // the glacier, the mantle, the droplets
  }
  const t = chainHit(c, TRUNK, TRUNK_R);
  if (t.d < 1.25 && c[2] < 19 && Math.abs(c[0]) < 4) return trunk[Math.min(2, t.i)];
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
