// Thornback Tenjin's rig: Thornback's body, arms, legs and clips (the scad keeps their numbers) in the Tenjin palette,
// with its own smaller head (pale eyes, blossoming antlers), a gold halo that floats behind the head, and the leafy
// train down the back as one cape joint carrying the back heart-stone.
import { osc, rigDef } from './lib/anim.mjs';
import { any, blob, ell, limb, pick } from './lib/biped.mjs';
import { ellD, isAny, near, subFrame } from './lib/geo.mjs';
import { clipsFor, faceFor, jointsFor, makeAssign, partsFor } from './thornback.mjs';

const C = {
  bark: [0.3, 0.2, 0.1], barkDk: [0.17, 0.11, 0.05], barkHi: [0.46, 0.32, 0.16], antler: [0.36, 0.24, 0.12],
  leaves: [[0.74, 0.75, 0.51], [0.93, 0.9, 0.66], [0.56, 0.58, 0.4]],
  thorn: [0.94, 0.78, 0.38], muzzle: [0.74, 0.55, 0.4], amber: [[1, 0.8, 0.12], [1, 0.97, 0.62]],
};
const GOLD = [0.93, 0.77, 0.25];
const HALO_GEM = [0.62, 0.68, 0.56];
const HS = [0.5, -9.8, 17.9];
const BS = [0, 14, 20.5];
const HC = [-1, -4.5, 31.2];

const add = (a, b) => a.map((v, i) => v + b[i]);
const HD = [0.5, -9.6, 25.5];
const ROT = [10, 0, -6];
const hf = subFrame(HD, ROT);
const inF = (f, test) => (c) => test(f.local(c));
const antlerTests = (s) => {
  const B = add(HD, [s * 2.8, 3, 2.6]);
  const at = (v) => add(B, [s * v[0] * 0.85, v[1], v[2] * 1.3]);
  const p1 = at([3.2, 0.5, 2.9]); const p2 = at([7, 1, 5.2]); const q = at([9.8, 1.3, 6.4]); const p3 = at([12.4, 1.6, 8.3]);
  const tips = [[12.4, 1.6, 8.3], [2.4, 0.2, 8], [5.6, 0.6, 8.4], [9.4, 1.2, 8.6], [14.2, 1.8, 4.6]];
  return [limb(B, p1, 1.25, 1.1), limb(p1, p2, 1.1, 0.95), limb(p2, q, 0.95, 0.75), limb(q, p3, 0.75, 0.45),
    limb(p1, at([2.4, 0.2, 8]), 0.9, 0.4), limb(at([1, 0.2, 1]), at([-0.6, -0.6, 5.2]), 0.7, 0.35),
    limb(p2, at([5.6, 0.6, 8.4]), 0.85, 0.4), limb(q, at([9.4, 1.2, 8.6]), 0.7, 0.35), limb(q, at([14.2, 1.8, 4.6]), 0.7, 0.35),
    ...tips.map((v) => ell([1.5, 1.2, 1.5], add(at(v), [0, -0.5, 0.3])))];
};
const HEAD = {
  at: HD, rot: ROT, neck: [0.5, -6, 23], tuftZ: 27.5,
  tests: any(
    inF(hf, ell([4.8, 4.5, 4.2])), inF(hf, ell([5, 4.1, 3.2], [0, -0.5, -1.3])),
    inF(hf, blob([[[2.5, 2, 1.8], [0, -3.8, -1.4]], [[2.1, 1.5, 1.5], [0, -5.5, -1.2]]])), inF(hf, ell([2.2, 2.6, 1], [0, -4, -3.1])),
    inF(hf, (c) => ell([1.6, 1, 1.6], [3.9, 0.8, 3])([Math.abs(c[0]), c[1], c[2]])),
    ...antlerTests(1), ...antlerTests(-1),
    ell([4.5, 4.5, 5.2], add(HD, [0, 1.5, 6.5])),   // crown tuft
  ),
};

const parts = partsFor(HEAD);
// the halo: a ring of radius 5.2 in the plane turned 30 degrees, its gem on top
const haloF = subFrame(HC, [0, 0, 30]);
const haloD = (c) => {
  const l = haloF.local(c);
  return Math.max(Math.abs(Math.hypot(l[0], l[2]) - 5.2) / 1.6, Math.abs(l[1]) / 1.4);
};
const rules = (c, rgb) => {
  if (near(rgb, HALO_GEM) || (near(rgb, GOLD) && haloD(c) < 1)) return 'halo';
  // the train and the back heart-stone in its rosette
  if ((isAny(rgb, C.leaves) || isAny(rgb, C.amber)) && c[1] > 7 && (c[2] < 19 || ellD(c, [5.5, 3, 5.5], BS) < 1)) return 'cape1';
  if (isAny(rgb, C.leaves) && c[1] > 4 && c[0] > 10 && c[2] < 12) return 'cape1';   // the tip sweeping out
  if (near(rgb, GOLD)) return pick(c, parts);   // veins, ear insides and the blossoms' hearts follow what they lie on
  return null;
};

const face = faceFor(HEAD, { at: [2.1, -3.6, 1], size: 0.9, yaw: 16, flat: 0.5 }, C.bark);
const joints = [
  ...jointsFor(HEAD, HS),
  { name: 'halo', parent: 'head', at: HC },
  { name: 'cape1', parent: 'body', at: [0, 11, 22] },
  ...face.joints,
];

// the halo floats a little behind the head
const halo = (amp = 1) => (t, u) => ({ halo: { p: [0, 0, 0.4 * amp * osc(u, 2)], r: [0, 3 * amp * osc(u, 1, 0.3), 0] } });
const extra = { idle: halo(1), walk: halo(0.5), celebrate: halo(2), idle_stretch: halo(1.5) };

export default rigDef({
  joints, assign: makeAssign(C, HEAD, [], rules), extras: face.extras, clips: clipsFor({ face, extra, cape: ['cape1'] }),
});
