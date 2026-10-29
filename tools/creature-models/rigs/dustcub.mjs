// Dustcub's rig: a chubby badger cub playing cowboy, the right paw raised palm out, the left fist at the hip, a wide
// stance in spurred boots. The hat, the wheat stalk and the bandana's knot are their own joints. Numbers are
// scad/dustcub.scad's (the sprite-matched model, 2026-10-28).
import { K, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, pair, pick, ppFrame } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { capD, ellD, isAny, near } from './lib/geo.mjs';

const FUR = [0.23, 0.17, 0.16];
const CREAM = [0.78, 0.68, 0.53];
const TAN = [0.67, 0.58, 0.46];
const HAT = [[0.40, 0.32, 0.25], [0.33, 0.25, 0.21], [0.50, 0.42, 0.34]];
const LEATHER = [0.60, 0.48, 0.37];
const BOOT = [0.35, 0.27, 0.22];
const STEEL = [0.56, 0.52, 0.48];
const RED = [0.60, 0.23, 0.23];
const PINK = [0.62, 0.36, 0.34];
const BLACK = [0.08, 0.05, 0.05];

const KNOT = [7.2, 1.8, 25.6];
const PAW = [-11.7, -4.5, 21.4];
const STALK = [[-1.0, -11.0, 25.6], [-4.2, -13.5, 26.2]];

const eyeL = { side: 'L', at: [3.35, -6.0, 28.9], size: 1.45, yaw: 22 };
export const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FUR });

export const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [4.6, 0.2, 10] },
  { name: 'legR', parent: 'root', at: [-4.6, 0.2, 10] },
  { name: 'body', parent: 'root', at: [0, 0, 11] },
  { name: 'head', parent: 'body', at: [0, -0.5, 24.5] },
  { name: 'hat', parent: 'head', at: [0.7, 0.3, 32.6] },
  { name: 'wheat', parent: 'head', at: STALK[0] },
  ...pair('ear*', 'head', [6.6, 0.3, 31]),
  { name: 'knot', parent: 'body', at: KNOT },
  { name: 'armL', parent: 'body', at: [7.6, -0.4, 21.6] },
  { name: 'handL', parent: 'armL', at: [11.6, 1.2, 20.3] },
  { name: 'armR', parent: 'body', at: [-7.4, -0.6, 21] },
  { name: 'handR', parent: 'armR', at: [-10.2, -3.2, 19.8] },
  ...face.joints,
];

// the lasso coil hangs in the picture plane ppc(-7.5) (pp(-7.5) then x - 0.8), written in its own numbers
const lassoF = ppFrame(-7.5);
const lasso = (c) => {
  const q = lassoF.local(c);
  q[0] += 0.8;
  return Math.min(ellD(q, [3.7, 1.3, 4.1], [10.6, 0.3, 9.6]), capD(q, [12.3, 0, 7.2], [12.0, 0.4, 3.8], 0.6));
};
const boot = (ankle, toe, heel, spur) => any(
  blob([[[2.3, 2.3, 2.3], ankle], [[2.0, 1.9, 1.9], toe], [[2.0, 2.0, 2.0], heel]]),
  ell([3.3, 3.1, 1], [ankle[0], ankle[1], ankle[2] + 2.7]), ell([1.2, 1.2, 1.2], spur));

const parts = [
  ['legL', any(limb([4.6, 0.2, 10], [9.0, 0.8, 5.0], 3.3, 3.0), boot([9.0, 0.8, 2.3], [11.2, 1.6, 1.9], [8.0, 0.3, 2.0], [6.4, -0.5, 2.6]))],
  ['legR', any(limb([-4.6, 0.2, 10], [-8.1, -2.0, 5.0], 3.3, 3.0), boot([-8.1, -2.0, 2.3], [-9.6, -4.6, 1.9], [-7.0, -1.0, 2.0], [-6.3, 0.0, 1.5]))],
  ['body', any(ell([9.5, 8.5, 9.0], [0, 0, 15.6]), ell([7.9, 7.0, 1.4], [0, 0, 11.3]), lasso,
    blob([[[1.9, 1.3, 1.6], [-6.3, -3.4, 13.0]], [[2.0, 1.4, 1.6], [-7.4, -4.4, 9.2]]]), ell([6.2, 5.6, 1], [0, -0.6, 24]))],
  ['head', any(ell([7.8, 6.2, 5.0], [0, -0.8, 28.8]),
    blob([[[6.6, 4.4, 3.9], [0, -2.8, 27.5]], [[2.8, 2.4, 2.1], [0.4, -8.2, 26.9]], [[1.9, 1.5, 1.7], [0.5, -10.6, 27.0]]]),
    ell([2.4, 2.0, 2.2], [6.6, -2.6, 27.0]))],
  ['ear*', ell([1.7, 1.1, 1.7], [6.6, 0.3, 31.0])],
  ['armL', limb([7.6, -0.4, 21.6], [11.6, 1.2, 20.3], 2.5, 2.4)],
  ['handL', ell([2.9, 2.7, 2.8], [11.3, 1.4, 18.2])],
  ['armR', limb([-7.4, -0.6, 21.0], [-10.2, -3.2, 19.8], 2.5, 2.4)],
  ['handR', ell([2.5, 2.3, 2.7], PAW)],
];

function assign(c, rgb) {
  if (isAny(rgb, HAT, 0.025) && c[2] > 28) return 'hat';
  if (near(rgb, RED, 0.03)) return ellD(c, [1.8, 1.6, 1.6], KNOT) < 1.25 || c[0] > 8.2 || (c[1] > 3.2 && c[0] > 6) ? 'knot' : 'body';
  if (isAny(rgb, [BOOT, STEEL], 0.03) || (near(rgb, BLACK) && c[2] < 4)) return c[0] > 0 ? 'legL' : 'legR';
  if (near(rgb, LEATHER, 0.03)) return 'body';
  if (near(rgb, PINK, 0.03)) return 'handR';
  if (near(rgb, TAN, 0.03)) {
    if (capD(c, STALK[0], STALK[1], 1.2) < 1.2 || (c[0] < -0.5 && c[1] < -10.5 && c[2] > 24.5)) return 'wheat';
    if (ellD(c, [1.6, 1.2, 1.6], [Math.abs(c[0]) > 0 ? 6.9 * Math.sign(c[0]) : 6.9, -0.4, 31]) < 1.3) return `ear${c[0] >= 0 ? 'L' : 'R'}`;
    if (ellD(c, [5, 5, 5], PAW) < 1) return 'handR';
    if (ellD(c, [4.5, 4.5, 4.5], [9.5, -0.5, 19.5]) < 1) return 'handL';
    return c[2] < 16 ? 'body' : 'head';
  }
  if (near(rgb, CREAM, 0.03) && c[2] < 22) return 'body';
  return pick(c, parts);
}

// the hat bounces on the head and the knot's tails flutter
const hatBob = (amp, cycles, u) => ({ hat: { r: [amp * osc(u, cycles, 0.2), 0, 0.6 * amp * osc(u, cycles / 2, 0.4)] } });
const knot = (amp, cycles, u) => ({ knot: { r: [0, 6 * amp * osc(u, cycles), 8 * amp * osc(u, cycles, 0.25)] } });
const chew = (u, cycles, amp = 1) => ({ wheat: { r: [0, 4 * amp * osc(u, cycles), 6 * amp * osc(u, cycles, 0.3)] } });

const base = bipedClips({
  face, hipH: 10, stride: 18, armSwing: 14,
  punch: { arm: [-50, 0, 10] },
  add: {
    idle: (t, u) => merge(hatBob(1, 2, u), knot(0.5, 4, u), chew(u, 4)),
    walk: (t, u) => merge(hatBob(3, 2, u), knot(1.4, 2, u), chew(u, 2, 0.6)),
    idle_look: (t, u) => merge(knot(0.6, 3, u), chew(u, 3)),
    lunge: (t, u) => merge(knot(1.5, 1, u), { hat: { r: [-6 * win(u, 0.3, 0.8, 0.1), 0, 0] } }),
    hurt: (t, u) => { const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.3]]); return merge(knot(1.6, 2, u), { hat: { p: [0, 0, 1.6 * k], r: [-18 * k, 0, 10 * k] }, wheat: { r: [0, 0, 20 * k] } }); },
    recoil: (t, u) => ({ hat: { r: [-8 * K(u, [[0, 0], [0.4, 1], [1, 0]]), 0, 0] } }),
    faint: (t, u) => { const d = smooth((u - 0.18) / 0.55); return { hat: { r: [22 * d, 0, -8 * d], p: [0, -0.6 * d, -0.6 * d] }, wheat: { r: [-25 * d, 0, 0] } }; },
    celebrate: (t, u) => merge(hatBob(6, 2, u), knot(1.5, 2, u)),
    enter: (t, u) => ({ hat: { r: [-10 * win(u, 0.45, 0.9, 0.12), 0, 0] } }),
  },
});

const clips = {
  ...base,

  // fidget: tips the hat with the raised right paw and winks at the camera
  idle_hattip: {
    seconds: 2.4,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.2, 1], [0.7, 1], [0.88, 0]]);
      const tip = win(u, 0.28, 0.62, 0.08);
      const wink = win(u, 0.36, 0.56, 0.05);
      return merge({
        ...face.pose('open'),
        lidL: { s: wink < 0.02 ? 1e-4 : [1, 1, wink] },
        head: { r: [12 * up + 5 * tip, -12 * up, 10 * up] },
        armR: { r: [-10 * up, 85 * up, 0] },
        handR: { r: [0, 35 * up, 0] },
        hat: { r: [14 * tip, 0, 0] },
      }, chew(u, 3, 0.8));
    },
  },

  // fidget: chews the wheat stalk, swings it out to the front with a twitch of the muzzle and back
  idle_chew: {
    seconds: 2,
    pose: (t, u) => {
      const flip = K(u, [[0, 0], [0.3, 0], [0.42, 1], [0.7, 1], [0.84, 0]]);
      return merge({
        ...face.pose('open', blinks(u, [[0.12, 0.17]])),
        head: { r: [2 * osc(u, 4), 0, -4 * flip] },
        wheat: { r: [0, 0, 35 * flip] },
      }, chew(u, 6, 1.2));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
