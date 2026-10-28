// Raikitsune's rig: an upright thunder fox, a crackling orb held out in its right paw (the orb rides the forearm; its crackles spin on their own
// joint), a scarf whose tails flutter, and nine tails fanned behind it, each on its own joint off the hips so they
// sway, fan wide and fold. Numbers are scad/raikitsune.scad's.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, mx, pair, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { ellD, isAny } from './lib/geo.mjs';

const FUR = [0.92, 0.42, 0.1];
const ORB = [[0.6, 0.95, 1], [0.9, 1, 1]];
const ORB_C = [-11, -5, 23.5];
const D = Math.PI / 180;
const HO = [0, -0.5, 27];   // the head block's translate()
const h = (p) => [p[0] + HO[0], p[1] + HO[1], p[2] + HO[2]];

// the nine tails: angle, and the scad's base / mid / m2 / tip points
const ANGLES = [-110, -80, -52, -26, 0, 26, 52, 80, 110];
const TAILS = ANGLES.map((a) => {
  const len = 17 - Math.abs(a) * 0.02;
  const dir = [Math.sin(a * D), 0.3, Math.cos(a * D)];
  const base = [0, 3.5, 14];
  const at = (k, dy) => base.map((v, i) => v + dir[i] * len * k + (i === 1 ? dy : 0));
  return { a, base, mid: at(0.5, 1.5), m2: at(0.78, 2.2), tip: at(1, 2.6) };
});
const fans = ANGLES.map((_, i) => `fan${i + 1}`);

const eyeL = { side: 'L', at: h([1.95, -2.7, 1.1]), size: 1.1, yaw: -22, flat: 0.4 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FUR });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [3.4, 0, 12]),
  { name: 'body', parent: 'root', at: [0, 0, 12] },
  { name: 'head', parent: 'body', at: [0, -0.5, 24.5] },
  ...pair('ear*', 'head', h([2, 0.5, 2.2])),
  { name: 'scarf', parent: 'body', at: [3, -2.5, 24.3] },
  { name: 'armL', parent: 'body', at: [4.6, 0, 22.5] },
  { name: 'foreL', parent: 'armL', at: [6.5, -1.5, 17.5] },
  { name: 'armR', parent: 'body', at: [-4.6, 0, 22.5] },
  { name: 'foreR', parent: 'armR', at: [-7.5, -2, 20] },
  { name: 'orb', parent: 'foreR', at: ORB_C },
  ...fans.map((name) => ({ name, parent: 'body', at: [0, 3.5, 14] })),
  ...face.joints,
];

const parts = [
  ['leg*', any(limb([3.4, 0, 12], [4.4, -1.5, 7.5], 2.8, 2.2), limb([4.4, -1.5, 7.5], [4.6, 0.5, 3], 1.9, 1.5), ell([2, 2.8, 1.3], [4.8, -1.4, 1.3]),
    spike([4.8, -4, 0.9], [0, -1.1, -0.4], 1.2))],
  ['body', any(blob([[[5, 4, 4.5], [0, 0, 20]], [[4, 3.4, 3.6], [0, 0, 14]]]), blob([[[3, 1.6, 4.2], [0, -2.8, 19]], [[2.2, 1.4, 3], [0, -2.6, 14]]]),
    ell([1.5, 0.6, 1.5], [0, -4.5, 21]), ell([4.2, 4, 1.4], [0, -0.3, 24]))],
  ['head', any(blob([[[3.6, 3.4, 3.2], h([0, 0, 0])], [[1.4, 2.2, 1.2], h([0, -4.6, -0.8])]]), mx(ell([2, 1.5, 1.5], h([2.4, -1.6, -1.2]))),
    limb(h([0, -1, -2]), h([0, -4.5, -1.6]), 3, 1.4), mx(limb(h([0.75, -3.3, 1.8]), h([3.05, -1.7, 2.7]), 0.5)), mx(limb(h([3, -1.2, -0.6]), h([5, -0.6, -1.6]), 0.9, 0.2)),
    mx(limb(h([3, -0.2, -1.2]), h([5, 0.4, -2.4]), 0.9, 0.2)))],
  ['ear*', any(limb(h([2, 0.5, 2.2]), h([3.2, 1, 7]), 1.2, 0.3), ell([0.8, 0.3, 1.4], h([2.2, -0.2, 3.6])))],
  ['scarf', any(limb([3, -2.5, 24.5], [6, -3.5, 25.5], 1.1, 1), limb([6, -3.5, 25.5], [9, -2.5, 27], 1, 0.8), limb([9, -2.5, 27], [11.5, -3, 26], 0.8, 0.4),
    limb([3, -2.5, 24], [6, -3, 23], 1, 0.8), limb([6, -3, 23], [8.5, -2, 22.5], 0.8, 0.4))],
  ['armL', limb([4.6, 0, 22.5], [6.5, -1.5, 17.5], 1.5, 1.2)],
  ['foreL', any(limb([6.5, -1.5, 17.5], [6.8, -2.8, 14], 1.2, 1.1), spike([6.8, -3, 13.4], [0, -0.6, -1.2], 0.9))],
  ['armR', limb([-4.6, 0, 22.5], [-7.5, -2, 20], 1.5, 1.2)],
  ['foreR', limb([-7.5, -2, 20], [-10, -4, 21], 1.2, 1.1)],
  ...TAILS.map((t, i) => [fans[i], any(limb(t.base, t.mid, 1.5, 3.6), limb(t.mid, t.m2, 3.6, 2.2), limb(t.m2, t.tip, 1.95, 0.3), ell([4.6, 2.5, 4.6], t.mid))]),
];

function assign(c, rgb) {
  // the orb and its crackles (cyan rays within reach of it) spin; the sprite's bolts over the tails go with a tail
  if (isAny(rgb, ORB) || (ellD(c, [4.6, 4.6, 4.6], ORB_C) < 1 && c[1] < -2)) return 'orb';
  if (!isAny(rgb, [FUR, [1, 0.6, 0.22], [0.98, 0.86, 0.66], [0.12, 0.12, 0.16], [0.25, 0.75, 0.85], [0.45, 0.9, 1], [0.85, 0.88, 0.92], [0.7, 0.26, 0.06]], 0.03)) return 'head';
  return pick(c, parts);
}

// the fan: each tail sways on its own phase; `spread` fans them wider (ry along its own angle), `lift` swings them back
const fan = (u, cycles = 1, amp = 1, spread = 0, lift = 0) => Object.fromEntries(TAILS.map((t, i) => [fans[i], {
  r: [lift + 3 * amp * osc(u, cycles, -0.07 * i), spread * Math.sign(t.a) * Math.min(1, Math.abs(t.a) / 52) + 3 * amp * osc(u, cycles, 0.25 - 0.07 * i), 0],
}]));
const flutter = (u, cycles = 2, amp = 1) => ({ scarf: { r: [6 * amp * osc(u, cycles), 0, 8 * amp * osc(u, cycles, 0.25)] } });
const spin = (u, turns = 1) => ({ orb: { r: [0, 72 * turns * u, 0] } });

const base = bipedClips({
  face, hipH: 12, stride: 20, armSwing: 18, hopScale: 1, hopH: 4,
  // the orb thrust out in front: the right arm swings forward about the shoulder
  punch: { arm: [0, 0, 55], fore: [0, 0, 20] },
  add: {
    idle: (t, u) => merge(fan(u, 2), flutter(u, 4, 0.6), spin(u, 5)),
    walk: (t, u) => merge(fan(u, 1, 1.4, 0, 6), flutter(u, 2, 1.4), spin(u, 1)),
    idle_look: (t, u) => merge(fan(u, 1), flutter(u, 2), spin(u, 3)),
    windup: (t, u) => merge(fan(u, 0, 0, 14 * u, -4 * u), spin(u, 1), { orb: { s: 1 + 0.25 * u } }),
    lunge: (t, u) => { const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]); return merge(fan(u, 0, 0, 14 - 8 * hit, 6 * hit), spin(u, 2), flutter(u, 1, 2), { orb: { s: 1.25 + 0.25 * hit } }); },
    hurt: (t, u) => merge(fan(u, 2, 3, -8 * u), flutter(u, 2, 2), spin(u, 1)),
    recoil: (t, u) => fan(u, 1, 1.5),
    faint: (t, u) => { const d = Math.min(1, u / 0.7); return merge(fan(u, 0, 0, -16 * d, 12 * d), { orb: { s: 1 - 0.5 * d } }); },
    celebrate: (t, u) => merge(fan(u, 2, 3, 18 * win(u, 0, 1, 0.15)), flutter(u, 2, 2), spin(u, 2)),
    enter: (t, u) => merge(fan(u, 0, 0, -20 * (1 - Math.min(1, u / 0.6)) + 10 * win(u, 0.5, 0.9, 0.12)), spin(u, 1)),
    exit: (t, u) => merge(fan(u, 1, 1.5), flutter(u, 1, 1.4), spin(u, 1)),
  },
});

const clips = {
  ...base,

  // fidget: the nine tails fan out wide one after another like a peacock, crackle, then fold back
  idle_fan: {
    seconds: 2.6,
    pose: (t, u) => {
      const open = (i) => K(u, [[0, 0], [0.1 + 0.04 * i, 0], [0.25 + 0.04 * i, 1], [0.7, 1], [0.9, 0]]);
      const tails = Object.fromEntries(TAILS.map((tt, i) => [fans[i], { r: [-6 * open(i), 22 * Math.sign(tt.a) * Math.min(1, Math.abs(tt.a) / 52) * open(i) + 2 * osc(u, 4, 0.1 * i) * open(i), 0] }]));
      const on = open(4);
      return merge(tails, {
        body: { r: [-3 * on, 0, 0] },
        head: { r: [-8 * on, 0, 10 * on] },
        ...face.pose(on > 0.5 ? 'happy' : 'open'),
        ...both('ear', { r: [-10 * on, 0, 0] }),
      }, flutter(u, 2), spin(u, 4), { orb: { s: 1 + 0.15 * Math.abs(osc(u, 6)) * on } });
    },
  },

  // fidget: it tosses the orb from paw to paw... nearly: a little toss up out of its right paw and a catch
  idle_toss: {
    seconds: 1.8,
    pose: (t, u) => {
      const up = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.2) / 0.45))));
      const bob = win(u, 0.1, 0.3, 0.04) + win(u, 0.6, 0.8, 0.04);
      return merge({
        head: { r: [-12 * up, 0, -10 * up] },
        ...face.pose('open', blinks(u, [[0.85, 0.9]])),
        armR: { r: [0, 8 * bob, 0] }, foreR: { r: [0, 0, -10 * bob] },
        orb: { p: [0, 0, 7 * up], r: [0, 360 * u, 0] },
        ...both('ear', { r: [-8 * up, 0, 0] }),
      }, fan(u, 1), flutter(u, 2));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
