// Blizzraak's rig: Glacifang grown into a bulky crystal-armoured ice dragon, hunched on all fours, its jaw dropped
// open, huge frosted wings and a bladed tail curled round on the ground to its right. Built with Glacifang's
// drakeRig(); numbers are scad/blizzraak.scad's (the tail is written mirrored there: x flips).
import { blobD, capD, ellD, fold, subFrame } from './lib/geo.mjs';
import { drakeRig } from './glacifang.mjs';

const H = subFrame([0, -15.5, 15], [-8, 0, 0], 1.22);
const leg = (sh, a, b, foot) => (f) => Math.min(
  ellD(f, ...sh), capD(f, ...a), b ? capD(f, ...b) : Infinity,
  ellD(f, [2.3, 2.6, 1.2], foot), ellD(f, [1.8, 1.4, 1.1], [foot[0], foot[1] + 1.4, foot[2] + 0.4]), ellD(f, [2.4, 1.8, 1.2], [foot[0], foot[1] - 2.8, foot[2] - 0.4]),
);
const TAIL = [[0, 10, 12], [2, 16, 7], [8, 18.5, 3.6], [14, 15, 2.8], [16.5, 8, 3.4], [16.5, 1, 6.5], [16, -4, 13], [15, -6, 20], [14.8, -7, 30]]
  .map(([x, y, z]) => [-x, y, z]);

export default drakeRig({
  skin: [0.5, 0.72, 0.93],
  lidSkin: [0.12, 0.2, 0.42],
  head: H,
  eye: { at: [2.4, -3.6, 1.1], size: 1.55, yaw: 38, flat: 0.5 },
  jawAt: [0, 0.5, -1.8],
  jawCols: [[0.84, 0.93, 1.0], [0.32, 0.1, 0.18]],
  hipH: 11,
  stride: 10,
  legF: [[6.4, -6.5, 12], leg([[4, 4.6, 5.2], [6.4, -6.5, 12]], [[6.6, -7, 10], [8.2, -6.4, 5.4], 3.4, 2.6], [[8.2, -6.4, 5.4], [7.8, -10, 1.8], 2.6, 2.2], [7.6, -11, 1.3])],
  legB: [[6.2, 5, 10.5], leg([[4.8, 6, 6.4], [6.2, 5, 10.5]], [[6.8, 6.4, 6.5], [7.2, 4.2, 1.8], 3.2, 2.4], null, [7.2, 3.4, 1.3])],
  bodyAt: [0, 0, 12],
  body: (c) => Math.min(
    blobD(c, [[[7.8, 7, 7.6], [0, -4, 14]], [[7.2, 6, 6.6], [0, 4, 13]], [[6, 5.5, 4], [0, -2, 19.5]]]),
    blobD(c, [[[5.2, 4, 4.2], [0, -8.5, 11]], [[5, 6, 2.6], [0, 1, 7.6]]]),
    ellD(c, [5, 5, 5], [0, -8, 16]),
    // the crystal armour up the neck and along the back, the flank clumps
    capD(c, [0, -12, 21], [0, 11.4, 19], 5.5, 3.5) * 0.92,
    capD(fold(c), [6.8, -5, 14], [7, 2, 15], 2.8),
  ),
  headAt: [0, -12.5, 14.8],
  neckHead: (c) => Math.min(ellD(c, [3.8, 3.8, 3.6], [0, -14, 14.4]), ellD(c, [2.6, 2, 2], [0, -15, 12])),
  skull: (h) => Math.min(
    blobD(h, [[[3.9, 3.6, 3.2], [0, 0, 0.5]], [[2.9, 2.2, 2], [0, -5.6, 0]], [[2.2, 1.2, 1.3], [0, -8.8, -0.7]]]),
    capD(fold(h), [2.2, -0.6, 2.8], [4, 6.8, 5.4], 1.3, 0.4), capD(fold(h), [3.4, -1, -0.6], [6.4, 1.6, -1], 0.9, 0.3),
    capD(fold(h), [3.6, 0.4, 0.6], [6.8, 3.2, 1.4], 0.9, 0.3), capD(h, [0, -2.6, 2.4], [0, 1, 7.6], 2.4, 1.2),
  ),
  jaw: (h) => Math.min(blobD(h, [[[3.2, 2.6, 1.5], [0, -0.6, -3]], [[1.6, 1.2, 0.8], [0, -7.6, -4.6]]]), capD(h, [0, -1.4, -1.8], [0, -7.6, -2.8], 2.2, 1)),
  tailPts: TAIL,
  tailRs: [5, 3.8, 3, 2.5, 2.1, 1.7, 1.3, 0.9, 0.6].map((r) => r + 1),
  tailJoints: [0, 2, 4, 6],
  wing: [[5, -3, 19], [11, -1, 27], [13, 3, 38], [[24, 6, 36], [25, 10, 26], [21, 11, 17], [14, 11, 14.5]]],
  wingCols: [[0.7, 0.87, 1.0], [0.58, 0.79, 0.98], [0.42, 0.66, 0.93], [0.36, 0.6, 0.9], [0.93, 0.97, 1.0]],
  rimCols: [[0.18, 0.4, 0.84], [0.6, 0.84, 1.0]],
});
