// Pebfist's rig: a squat clay boxer in a wide crouch, slate gloves up in guard (the right one high by the face, the
// left one forward across the chest). Numbers are scad/pebfist.scad's.
import { TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, mx, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { ellD, isAny, near } from './lib/geo.mjs';

const SKIN = [0.66, 0.5, 0.33];
const GLOVES = [[0.42, 0.5, 0.55], [0.56, 0.64, 0.69], [0.3, 0.36, 0.4]];
const DIRT = [0.45, 0.36, 0.25];
const GLOVE_L = [2.5, -10.5, 19];
const GLOVE_R = [-11.5, -6.5, 28];

const eyeL = { side: 'L', at: [2.9, -7.6, 31], size: 1.65, yaw: 8, flat: 0.5 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: SKIN });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4, 0.5, 10.5]),
  { name: 'body', parent: 'root', at: [0, 0.5, 11.5] },
  { name: 'head', parent: 'body', at: [0, -1, 25] },
  { name: 'armL', parent: 'body', at: [8, 0, 23] },
  { name: 'foreL', parent: 'armL', at: [11.5, -1, 16.5] },
  { name: 'handL', parent: 'foreL', at: [5.5, -6, 18] },
  { name: 'armR', parent: 'body', at: [-8, 0, 23] },
  { name: 'foreR', parent: 'armR', at: [-12, -1, 17] },
  { name: 'handR', parent: 'foreR', at: [-12, -4, 24] },
  ...face.joints,
];

const parts = [
  ['body', any(blob([[[9, 6, 5], [0, 0.5, 21]], [[6.5, 5, 4], [0, 0, 14]]]), mx(ell([3.8, 1.8, 2.6], [3, -4.6, 21])),
    mx(ell([1.6, 1, 1.2], [1.7, -4.3, 13.5])), mx(ell([1.6, 1, 1.2], [1.7, -4.3, 16.3])), ell([6.6, 5, 3.2], [0, 0.5, 11.5]),
    mx(ell([4, 2, 4.5], [3.4, 4.6, 20.5])), mx(ell([3, 2.2, 2.6], [2.6, 4.4, 11])))],
  ['head', any(ell([7.6, 7.2, 8], [0, -1.5, 31]), mx(ell([1.3, 1.6, 2], [7.4, -0.5, 30.5])), mx(ell([2.1, 0.8, 1.8], [2.9, -7.3, 31.1])),
    mx(limb([5, -6.6, 33.5], [1.1, -8.4, 32.6], 1.3, 1)), ell([1.1, 1.3, 1.5], [0, -9, 29.4]))],
  ['armL', any(limb([8, 0, 23], [11.5, -1, 16.5], 3.3, 2.9), ell([3.6, 3.4, 3], [9, 0, 23.5]), ell([2.6, 2.6, 2.8], [11.6, -0.6, 18.5]))],
  ['foreL', limb([11.5, -1, 16.5], [5.5, -6, 18], 2.9, 2.5)],
  ['armR', any(limb([-8, 0, 23], [-12, -1, 17], 3.3, 2.9), ell([3.6, 3.4, 3], [-9, 0, 23.5]), ell([2.6, 2.6, 2.8], [-12.3, -0.8, 18.5]))],
  ['foreR', limb([-12, -1, 17], [-12, -4, 24], 2.9, 2.5)],
  ['leg*', any(limb([4, 0.5, 10.5], [9.5, -1.5, 6], 3.8, 3), limb([9.5, -1.5, 6], [10.5, 0, 1.6], 3, 2.3), ell([2.8, 2.6, 2.6], [8.6, -1.8, 7.5]),
    blob([[[2.6, 4, 1.3], [11, -2, 1.3]], [[2.2, 2, 1.3], [10.5, 1, 1.5]]]), ell([2.5, 1, 0.7], [11, -5.8, 0.7]))],
];

function assign(c, rgb) {
  if (isAny(rgb, GLOVES) && c[2] > 12) return ellD(c, [5.5, 5.8, 5.2], GLOVE_L) < ellD(c, [5, 5.3, 4.8], GLOVE_R) ? 'handL' : 'handR';
  if (near(rgb, DIRT) && c[2] < 5 && Math.abs(c[0]) > 12 || (near(rgb, DIRT) && c[2] < 2.5)) return 'root';
  return pick(c, parts);
}

// both gloves up in a V: the upper arms out and up, the forearms turned up from the elbow (k = share, wave = deg)
const cheerL = (k, wave = 0) => ({ armL: { r: [0, -122 * k, 0] }, foreL: { r: [0, (-152 + wave) * k, 0] } });
const cheerR = (k) => ({ armR: { r: [0, 116 * k, 0] }, foreR: { r: [0, -126 * k, 0] } });

const base = bipedClips({
  face, hipH: 10, stride: 14, guard: true, hopScale: 0.5, droop: 0.6,
  // the high right glove drives straight out from the cheek
  punch: { arm: [-70, 0, 0], fore: [100, 0, 0] },
  // the arms are not mirror images, so the cheer is set per arm below (the template only adds its pump)
  cheer: { arm: [0, 0, 0], fore: [0, 0, 0] },
  add: {
    idle: (t, u) => both('hand', { r: [0, 0, 4 * osc(u, 2)] }),
    // a boxer's bounce in the knees while it waddles
    walk: (t, u) => ({ body: { p: [0, 0, 0.3 * Math.abs(osc(u, 2))] } }),
    celebrate: (t, u) => ({ ...cheerL(win(u, 0, 1, 0.15)), ...cheerR(win(u, 0, 1, 0.15)) }),
    exit: (t, u) => cheerL(win(u, 0, 0.85, 0.2), 22 * Math.sin(TAU * 2 * u)),
  },
});

const clips = {
  ...base,

  // fidget: it bumps its gloves together twice and scowls harder, then rolls its neck
  idle_bump: {
    seconds: 2.2,
    pose: (t, u) => {
      const bump = (u0) => win(u, u0, u0 + 0.12, 0.04);
      const b = bump(0.18) + bump(0.4);
      const roll = win(u, 0.6, 0.95, 0.08);
      return {
        body: { r: [3 * b, 0, 0] },
        head: { r: [6 * b + 6 * Math.sin(TAU * 2 * u) * roll, 10 * Math.cos(TAU * (u - 0.6) / 0.35) * roll, 0] },
        ...face.pose('open', 0.3 * b + blinks(u, [[0.8, 0.86]])),
        armR: { r: [-10 * b, 18 * b, 0] }, foreR: { r: [-14 * b, 0, 0] },
        armL: { r: [0, 10 * b, 0] }, foreL: { r: [0, 0, -10 * b] },
      };
    },
  },

  // fidget: a quick jab-jab with the forward glove, bouncing on its toes
  idle_jab: {
    seconds: 1.8,
    pose: (t, u) => {
      const j = win(u, 0.2, 0.32, 0.04) + win(u, 0.42, 0.54, 0.04);
      const on = win(u, 0.05, 0.9, 0.1);
      return merge({
        root: { p: [0, 0, 0.6 * Math.abs(osc(u, 4)) * on] },
        body: { r: [3 * on, 0, -8 * j] },
        head: { r: [2 * on, 0, 5 * j] },
        ...face.pose('open', 0.35 * on),
        armL: { r: [-20 * j, 0, -10 * j] }, foreL: { r: [0, 0, 30 * j] },
        handL: { s: 1 + 0.08 * j },
      }, both('leg', { r: [-2 * on, 0, 0] }));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
