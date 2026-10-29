// Bankaiser's rig: a reaper standing in a shaggy feather mantle, a bone skull-helm, a bone gauntlet on its left arm and
// the huge crescent blade in its right hand (handR). The shoulder cape is a cape link (it trails); the collar, the
// skirt and the red wisps stay with the body. Numbers are scad/bankaiser.scad's.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, inFrame, limb, pick } from './lib/biped.mjs';
import { chainHit, isAny, near, side, subFrame } from './lib/geo.mjs';

const DEG = Math.PI / 180;
const S = (a) => Math.sin(a * DEG);
const C = (a) => Math.cos(a * DEG);
const BONE = [[0.88, 0.88, 0.86], [0.62, 0.62, 0.62]];
const RED = [[0.85, 0.1, 0.12], [0.6, 0.06, 0.08], [1, 0.15, 0.2]];
const ARMOR = [0.45, 0.45, 0.5];

// feather(p, d, w): a flat petal from p along d, tested as a tapering capsule
const feather = (p, d, w) => limb(p, [p[0] + d[0], p[1] + d[1], p[2] + d[2]], w * 0.75, 0.3);
const collar = Array.from({ length: 16 }, (_, k) => k * 22.5).filter((a) => C(a) >= -0.3 || Math.abs(S(a)) > 0.75)
  .map((a, k) => feather([5.2 * S(a), 5 * C(a) + 0.5, 26], [4 * S(a), 2.5 * C(a) + 2, 3.5 + (k % 2) * 1.5], 2.2));
const capeF = [];
for (let layer = 0; layer < 3; layer++) {
  for (let k = 0; k < 14; k++) {
    const a = -150 + (k * 300) / 13; const r = 6 + layer * 1.6; const z = 25 - layer * 5.5;
    if (!(Math.abs(a) > 140 && layer > 0)) capeF.push(feather([r * S(a), r * C(a) * 0.8 + 1.5, z], [3.5 * S(a), 2.5 * C(a) + 1.5, -6.5 - layer], 2.5));
  }
}
const skirt = Array.from({ length: 16 }, (_, k) => k * 22.5).filter((a) => C(a) >= -0.6)
  .map((a) => feather([6 * S(a), 5.5 * C(a) + 0.5, 14], [3 * S(a), 3 * C(a), -10], 2.6));
const panels = [0, 1, 2].flatMap((i) => [1, -1].map((m) => feather([m * (2.5 + i * 1.4), -4, 14], [m * (0.8 + i * 0.6), -0.5, -9 + i], 2)));
const WISPS = [
  [[[-8, -2, 4], [-4, -5, 2.5], [1, -5.5, 3.5], [5, -4, 2.5], [9, -2, 4], [11, 1, 6]], [0.7, 0.8, 0.7, 0.8, 0.7, 0.3]],
  [[[9, 3, 10], [12, 4, 13], [11, 6, 16], [13, 6, 19]], [0.7, 0.6, 0.5, 0.2]],
  [[[-10, 3, 26], [-8, 4, 29], [-10, 5, 32], [-8.5, 5, 34]], [0.7, 0.6, 0.5, 0.2]],
  [[[8, 2, 27], [10, 3, 29], [9, 4, 32]], [0.6, 0.5, 0.2]],
];
const onWisp = (c) => WISPS.some(([pts, rs]) => chainHit(c, pts, rs.map((r) => r + 0.6)).d < 1.3);

// the skull-helm: translate([0, -0.8, 29.5]) scale(1.25)
const headF = subFrame([0, -0.8, 29.5], [0, 0, 0], 1.25);
const hair = [0, 1, 2, 3, 4, 5, 6].map((k) => { const a = -75 + k * 25; return feather([2.8 * S(a), 2, 2], [5 * S(a), 5, -2.5 + (k % 2) * 3], 1.8); });
// the blade: translate([-12, -2.5, 19]) rotate([0, 0, 15]) rotate([68, 0, 0]), a crescent in its own xy plane
const bladeF = subFrame([-12, -2.5, 19], [68, 0, 15]);
const onBlade = (c) => { const q = bladeF.local(c); return Math.abs(q[2]) < 1.6 && Math.hypot(q[0], q[1]) < 14.6 && q[0] < 2.5; };

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [3.6, 0, 12] },
  { name: 'legR', parent: 'root', at: [-3.6, 0, 12] },
  { name: 'body', parent: 'root', at: [0, 0, 12] },
  { name: 'head', parent: 'body', at: [0, 0, 26] },
  { name: 'cape1', parent: 'body', at: [0, 1.5, 25] },
  { name: 'armL', parent: 'body', at: [6, 0, 23] },
  { name: 'foreL', parent: 'armL', at: [8, -2, 17] },
  { name: 'armR', parent: 'body', at: [-6, 0, 23] },
  { name: 'foreR', parent: 'armR', at: [-9, -2, 18.5] },
  { name: 'handR', parent: 'foreR', at: [-11, -3, 16] },
];

const leg = any(limb([3.6, 0, 12], [4.6, -1.5, 6.5], 2.8, 2.2), ell([1.8, 1.5, 2], [4.7, -3, 6.8]), limb([4.6, -1.5, 6.5], [4.8, 0, 2.5], 2, 1.7),
  blob([[[2.2, 3, 1.4], [5, -1.4, 1.3]]]), ell([1.6, 1.8, 1], [5, -4.6, 0.8]));
const parts = [
  ['leg*', leg],
  ['body', any(blob([[[5.5, 4, 5], [0, 0, 21]], [[4.5, 3.4, 4], [0, 0, 15]]]), blob([[[3.6, 1.6, 3.6], [0, -2.8, 21]], [[2.4, 1.4, 2.4], [0, -2.6, 16.5]]]),
    ...collar, ...skirt, ...panels)],
  ['cape1', any(...capeF)],
  ['head', inFrame(headF, any(ell([3.4, 3.4, 3.4], [0, 1.5, 0.4]), blob([[[2.8, 2.8, 2.8], [0, -0.5, 0.6]], [[1.7, 2.2, 1.5], [0, -4, -0.6]]]),
    limb([0.6, -1.5, 2.8], [1.4, 2.4, 8.2], 1, 0.3), limb([0, -5.2, -1.2], [0, -5.2, -2.1], 0.5), ...hair))],
  ['armL', limb([6, 0, 23], [8, -2, 17], 1.8, 1.5)],
  ['foreL', any(limb([8, -2, 17], [8.5, -3.5, 13], 1.5, 1.4), limb([8.5, -3.8, 12.3], [8.5, -4.5, 10.9], 0.5))],
  ['armR', limb([-6, 0, 23], [-9, -2, 18.5], 1.8, 1.5)],
  ['foreR', limb([-9, -2, 18.5], [-11, -3, 16], 1.5, 1.4)],
  ['handR', limb([-11.5, -3, 18], [-11.5, -3, 14], 0.8, 0.8)],
];

function assign(c, rgb) {
  if (isAny(rgb, BONE, 0.04)) {
    if (onBlade(c)) return 'handR';
    if (c[2] > 26) return 'head';
    if (c[0] > 6.5 && c[2] < 18) return 'foreL';
    if (c[0] < -8.5 && c[2] < 19.5) return 'foreR';
    return 'body';
  }
  if (isAny(rgb, RED, 0.05)) {
    if (c[2] > 27) return onWisp(c) ? 'body' : 'head';
    if (onWisp(c)) return 'body';
    if (c[2] < 7) return `leg${side(c)}`;
    if (c[0] > 7 && c[2] < 14) return 'foreL';
    return 'body';
  }
  if (near(rgb, ARMOR, 0.04)) return `leg${side(c)}`;
  return pick(c, parts);
}

// the blade hand: a slow menacing turn of the blade in idle, a big sweeping arc in the lunge
const base = bipedClips({
  hipH: 12, stride: 14, armSwing: 10, cape: ['cape1'], droop: 0.6, hopScale: 0,
  punch: { arm: [-30, 40, 0], fore: [-30, 0, 0] },
  add: {
    idle: (t, u) => ({ handR: { r: [0, 0, 4 * osc(u, 1)] } }),
    lunge: (t, u) => { const hit = K(u, [[0.1, 0], [0.4, 1], [0.62, 1], [1, 0]]); return { handR: { r: [-20 * hit, 0, -30 * hit] } }; },
  },
});

const clips = {
  ...base,

  // fidget: raises the blade and inspects its edge, the skull tilting, then a slow shoulder roll
  idle_whet: {
    seconds: 2.8,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.22, 1], [0.7, 1], [0.88, 0]]);
      const tilt = osc(u, 2) * win(u, 0.25, 0.7, 0.08);
      return {
        head: { r: [6 * up, 0, -18 * up + 6 * tilt] },
        armR: { r: [-30 * up, 20 * up, 0] },
        foreR: { r: [-25 * up, 0, 0] },
        handR: { r: [0, 0, 20 * tilt] },
        armL: { r: [0, -4 * up, 0] },
        cape1: { r: [2 * osc(u, 1), 0, 2 * osc(u, 1, 0.3)] },
      };
    },
  },

  // fidget: the mantle ruffles up like a crow's feathers, a cold shiver, the skull cocking to the side
  idle_ruffle: {
    seconds: 2,
    pose: (t, u) => {
      const on = win(u, 0.15, 0.7, 0.08);
      const sh = Math.sin(TAU * 10 * u) * on;
      return merge({
        body: { r: [-3 * on, 0, 0], s: [1 + 0.05 * on, 1 + 0.05 * on, 1] },
        head: { r: [-4 * on, 14 * win(u, 0.55, 0.95, 0.08), 0] },
        cape1: { r: [-6 * on + 3 * sh, 3 * sh, 0], s: [1 + 0.06 * on, 1 + 0.06 * on, 1] },
        ...both('arm', { r: [0, -6 * on, 0] }),
      });
    },
  },
};

export default rigDef({ joints, assign, clips });
