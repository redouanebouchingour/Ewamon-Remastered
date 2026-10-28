// Thornback Tenjin's rig: Thornback's body and clips (the scad keeps its numbers) in the Tenjin palette, plus a gold
// halo that floats behind the head and a leaf cape down the back (one joint: the scad draws it as one hull).
import { osc, rigDef } from './lib/anim.mjs';
import { blob, ell, pick } from './lib/biped.mjs';
import { blobD, ellD, isAny, near } from './lib/geo.mjs';
import { baseJoints, clipsFor, faceFor, makeAssign, parts } from './thornback.mjs';

const C = {
  bark: [0.3, 0.18, 0.09], barkDk: [0.22, 0.13, 0.06], barkHi: [0.4, 0.25, 0.12],
  leaves: [[0.8, 0.86, 0.62], [0.93, 0.92, 0.76], [0.64, 0.74, 0.46]],
  thorn: [0.92, 0.74, 0.3], muzzle: [0.68, 0.48, 0.32], amber: [[1, 0.8, 0.12], [1, 0.92, 0.4]],
};
const GOLD = [0.95, 0.76, 0.25];
const HALO_GEM = [0.72, 0.78, 0.62];

const capeD = (c) => Math.min(
  blobD(c, [[[11, 3, 4], [0, 10.5, 22]], [[12.5, 3.5, 3], [1, 12.5, 10]], [[9, 3, 1.5], [8, 13.5, 1.5]], [[4, 2, 1], [20, 11, 1]]]),
  ellD(c, [9, 1.4, 6], [0, 12.8, 17]), ellD(c, [10, 1.4, 5], [1, 14.2, 8.5]), ellD(c, [8, 1.4, 2], [6, 14.6, 2.5]),
  ellD(c, [3, 3, 6], [17, 12.5, 2.5]), ellD(c, [3, 3, 6], [22, 10.5, 1.5]));

const face = faceFor({ side: 'L', at: [3.6, -11, 31], size: 1.5, yaw: -22 }, C.barkDk);

const joints = [
  ...baseJoints,
  { name: 'halo', parent: 'head', at: [0, 2, 40] },
  { name: 'cape1', parent: 'body', at: [0, 11, 26] },
  ...face.joints,
];

const rules = (c, rgb) => {
  if (near(rgb, HALO_GEM) || (isAny(rgb, [GOLD, C.thorn]) && c[1] > 0.5 && c[2] > 31)) return 'halo';
  if (isAny(rgb, C.leaves) && c[1] > 8 && c[2] < 26 && capeD(c) < 1.25) return 'cape1';
  if (near(rgb, GOLD)) return pick(c, parts);   // the veins follow the bark they lie on
  return null;
};

// the halo floats a little behind the head
const halo = (amp = 1) => (t, u) => ({ halo: { p: [0, 0, 0.4 * amp * osc(u, 2)], r: [0, 3 * amp * osc(u, 1, 0.3), 0] } });
const extra = { idle: halo(1), walk: halo(0.5), celebrate: halo(2), idle_stretch: halo(1.5) };

export default rigDef({
  joints, assign: makeAssign(C, [['halo', ell([9, 1, 9], [0, 2, 40])], ['cape1', blob([[[11, 3, 4], [0, 10.5, 22]]])]], rules),
  extras: face.extras, clips: clipsFor({ face, extra, cape: ['cape1'] }),
});
