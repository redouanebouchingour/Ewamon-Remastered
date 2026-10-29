// Pyremoth's rig: a fluffy moth standing on one pair of short legs, two little clawed arms held in front (the claws),
// four flame wings (wing = the raised upper pair, wing2 = the lower pair), feathered antennae and a plum tail tuft. The
// falling embers stay on the root. Numbers are scad/pyremoth.scad's.
import { K, TAU, merge, rigDef, win } from './lib/anim.mjs';
import { any, blob, ell, limb, pair, pick, spike } from './lib/biped.mjs';
import { ellD, fold, near, side, unrot } from './lib/geo.mjs';
import { insectClips } from './lib/insect.mjs';

const WING = [[0.9, 0.3, 0.1], [1, 0.58, 0.16], [0.45, 0.22, 0.1], [1, 0.75, 0.15]];
const EMBER = [1, 0.6, 0.15];
const GREY = [0.3, 0.3, 0.32];
const PLUM = [0.45, 0.2, 0.3];
// wing(base, len, wid, ang): upper and lower (the left ones; mirror_x)
const UP = [[3, 3.5, 22], 21, 9.5, 48];
const LO = [[3, 3.5, 15], 16, 6.5, -38];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg1*', 'root', [2.6, 0, 6]),
  { name: 'body', parent: 'root', at: [0, 0, 6] },
  { name: 'head', parent: 'body', at: [0, -0.5, 23] },
  { name: 'antL1', parent: 'head', at: [2, -0.4, 33.5] },
  { name: 'antR1', parent: 'head', at: [-2, -0.4, 33.5] },
  ...pair('wing*', 'body', [3, 3.5, 22]),
  ...pair('wing2*', 'body', [3, 3.5, 15]),
  ...pair('claw*', 'body', [6.4, -3, 20]),
];

const wingD = (f, [base, len, wid, ang]) => {
  const q = unrot([0, -ang, 0], unrot([-28, 0, 12], [f[0] - base[0], f[1] - base[1], f[2] - base[2]]));
  return ellD(q, [len * 0.7, 2.2, wid * 1.2], [len * 0.62, 0, 0]);
};

const parts = [
  ['leg1*', any(limb([2.6, 0, 6], [3, -0.5, 1.6], 1.5, 1.3), spike([3, -1.6, 0.8], [0, -1.2, -0.4], 0.6))],
  ['body', any(blob([[[8, 6.4, 7.5], [0, 0, 12.5]], [[7, 6, 5.5], [0, 0, 19.5]]]), ell([7.5, 6, 3], [0, 0, 6.5]), limb([1, 3, 8], [2.5, 5, 3], 2, 0.3))],
  ['head', any(ell([7.6, 6.4, 6.4], [0, -0.6, 28.5]), ell([9, 7.8, 2.6], [0, -0.4, 23.5]))],
  ['ant1*', any(ell([2.3, 1.3, 6], [3.6, 0, 37.5]), limb([2, -0.4, 33.5], [3, 0, 34.5], 0.6))],
  ['claw*', any(limb([6.4, -3, 20], [7.6, -5, 16], 1.4, 1.2), spike([7.6, -5.6, 15.4], [0, -0.6, -1.2], 0.6))],
];

function assign(c, rgb) {
  const f = fold(c);
  const S = side(c);
  if (near(rgb, EMBER, 0.03) && c[2] < 3) return Math.hypot(f[0] - 3, c[1] + 2) < 2 ? `leg1${S}` : 'root';
  if (WING.some((w) => near(rgb, w, 0.03))) {
    const a = wingD(f, UP);
    const b = wingD(f, LO);
    if (Math.min(a, b) < 1.3) return a < b ? `wing${S}` : `wing2${S}`;
  }
  if (near(rgb, GREY) || (c[2] > 33 && f[0] > 1.2)) return `ant${S}1`;
  if (near(rgb, PLUM)) return 'body';
  const j = pick(c, parts);
  return j.startsWith('ant') ? `ant${S}1` : j;
}

const base = insectClips({ ant: 1, legs: 1, stride: 10, lift: 10, buzz: 24 });

const clips = {
  ...base,
  // fidget: fans its big wings slowly open and shut, basking, embers glowing
  idle_bask: {
    seconds: 3,
    pose: (t, u) => {
      const open = K(u, [[0, 0], [0.25, 1], [0.45, 0.6], [0.65, 1], [0.9, 0]]);
      return merge(base.idle.pose(t, u), {
        body: { r: [-4 * open, 0, 0] },
        head: { r: [-6 * open, 0, 0] },
        wingL: { r: [0, 0, 18 * open] }, wingR: { r: [0, 0, -18 * open] },
        wing2L: { r: [0, 0, 12 * open] }, wing2R: { r: [0, 0, -12 * open] },
      });
    },
  },
  // fidget: a sneeze of sparks: the antennae flick back, the body jolts, wings flutter
  idle_sneeze: {
    seconds: 1.6,
    pose: (t, u) => {
      const in_ = K(u, [[0, 0], [0.4, 1], [0.48, 0]]);
      const jolt = win(u, 0.46, 0.6, 0.03);
      const fl = Math.sin(TAU * 10 * u) * win(u, 0.5, 0.85, 0.04);
      return merge(base.idle.pose(t, u), {
        head: { r: [-12 * in_ + 18 * jolt, 0, 0] },
        body: { r: [-4 * in_ + 6 * jolt, 0, 0] },
        antL1: { r: [-20 * in_ + 25 * jolt, 0, 0] }, antR1: { r: [-20 * in_ + 25 * jolt, 0, 0] },
        wingL: { r: [0, -10 * fl, 0] }, wingR: { r: [0, 10 * fl, 0] },
      });
    },
  },
};

export default rigDef({ joints, assign, clips });
