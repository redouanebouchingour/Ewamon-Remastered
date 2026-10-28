// Tidespine's rig: a small upright blue dinosaur with an ice-crystal sail on its back, a cream jaw that opens, short
// clawed arms and a long tail ending in a stone fan fin. Numbers are scad/tidespine.scad's.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, mx, pair, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near } from './lib/geo.mjs';

const BLUE = [0.18, 0.43, 0.62];
const CREAM = [0.93, 0.87, 0.66];
const CRYSTALS = [[0.78, 0.9, 0.96], [0.92, 0.97, 1], [0.66, 0.8, 0.9]];
const ROCKS = [[0.55, 0.55, 0.58], [0.34, 0.34, 0.37], [0.66, 0.66, 0.68]];
const GEM = [0.4, 0.85, 1];

const TAIL = [[0, 4, 9], [3, 9, 6], [8, 12, 5.5], [13, 12, 8], [15, 10, 12], [15, 8.5, 16]];
const TAIL_R = [3.6, 2.8, 2.2, 1.7, 1.3, 1];
const tails = ['tail1', 'tail2', 'tail3'];

const eyeL = { side: 'L', at: [2.7, -4.8, 30.6], size: 1.2, yaw: -30 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: BLUE });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4.4, 0, 7.8]),
  { name: 'body', parent: 'root', at: [0, 1, 9] },
  { name: 'head', parent: 'body', at: [0, -1.5, 24.5] },
  { name: 'jaw', parent: 'head', at: [0, -2, 28] },
  ...pair('arm*', 'body', [4.4, -1.5, 19]),
  ...pair('fore*', 'arm*', [6, -3.5, 15.5]),
  { name: 'tail1', parent: 'body', at: TAIL[1] },
  { name: 'tail2', parent: 'tail1', at: TAIL[2] },
  { name: 'tail3', parent: 'tail2', at: TAIL[4] },
  ...face.joints,
];

const parts = [
  ['body', any(blob([[[6, 5.5, 6.5], [0, 1, 12]], [[4.4, 4.2, 4.4], [0, -0.5, 19.5]]]), blob([[[3.8, 2.4, 5.2], [0, -3.6, 11.5]], [[2.4, 2, 3.2], [0, -3.2, 19]]]),
    limb([0, 0, 20], [0, -1.5, 24.5], 3.4, 2.9))],
  ['head', any(limb([0, -1.5, 24.5], [0, -2.5, 28], 2.9, 2.8), ell([3.2, 2.4, 2.8], [0, -2.4, 24.2]), blob([[[3.4, 3.6, 3], [0, -2.4, 30]], [[2.2, 4.6, 1.8], [0, -8.5, 29]]]),
    mx(ell([1.6, 1, 0.5], [2.6, -4.6, 31.9])))],
  ['arm*', limb([4.4, -1.5, 19], [6, -3.5, 15.5], 1.6, 1.3)],
  ['fore*', any(limb([6, -3.5, 15.5], [6.4, -5.5, 14], 1.3, 1.2), ell([1.5, 1.4, 1.2], [6.6, -6.4, 13.6]), limb([6.6, -7.3, 13.4], [6.6, -8.4, 12.8], 0.6),
    spike([6.8, -5.6, 14.6], [0.8, 0, 1.8], 0.6))],
  ['leg*', any(ell([3.4, 4, 4.4], [4.4, 0, 7.8]), limb([4.6, 0.6, 5], [5, 1.6, 2.6], 2.4, 1.6), limb([5, 1.6, 2.6], [5, -0.4, 1], 1.6, 1.4),
    blob([[[2.2, 3.2, 1.1], [5, -2, 1.1]], [[1.6, 1.6, 1], [5, 1, 1]]]), limb([3.6, -4.8, 0.8], [6.4, -6.2, 0.6], 0.7))],
  ...chain(['body', 'tail1', 'tail2', 'tail2', 'tail3'], TAIL, TAIL_R),
];

function assign(c, rgb) {
  if (near(rgb, GEM)) return 'body';
  if (isAny(rgb, ROCKS)) return c[0] > 10 ? 'tail3' : 'body';           // the fan fin, or the hip rocks / gem setting
  if (isAny(rgb, CRYSTALS)) {
    if (c[0] > 13 && c[2] > 14) return 'tail3';                          // the tip crystal
    if (c[1] > 3 && c[2] > 13.5 && c[0] < 10) return 'body';             // the sail
  }
  if (near(rgb, CREAM) && c[2] > 26.4 && c[2] < 28.8 && c[1] < -1.5) return 'jaw';
  return pick(c, parts);
}

const base = bipedClips({
  face, tail: tails, hipH: 8, stride: 16, armSwing: 10, hopScale: 0.8, droop: 0.8,
  // a little claw swipe with the jaw snapping
  punch: { arm: [-60, 10, 0], fore: [-30, 0, 0] },
  cheer: { arm: [-20, -90, 0], fore: [-30, 0, 0] },
  add: {
    lunge: (t, u) => ({ jaw: { r: [22 * K(u, [[0.1, 0], [0.3, 1], [0.45, 0], [1, 0]]), 0, 0] } }),
    celebrate: (t, u) => ({ jaw: { r: [14 * win(u, 0, 1, 0.15), 0, 0] } }),
  },
});

const clips = {
  ...base,

  // fidget: snout up, three quick sniffs, a sneeze that jolts the whole body
  idle_sniff: {
    seconds: 2.4,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.12, 1], [0.6, 1], [0.7, 0]]);
      const sn = 2 * Math.max(0, Math.sin(TAU * 6 * u)) * win(u, 0.15, 0.5, 0.03);
      const ah = K(u, [[0.5, 0], [0.62, 1], [0.66, -1], [0.78, 0]]);
      return {
        body: { r: [-3 * up + 6 * Math.max(0, -ah), 0, 0] },
        head: { r: [-16 * up + sn - 6 * Math.max(0, ah) + 18 * Math.max(0, -ah), 0, 0] },
        jaw: { r: [6 * Math.max(0, ah), 0, 0] },
        ...face.pose(Math.max(0, ah) > 0.5 || -ah > 0.3 ? 'squeeze' : 'open', blinks(u, [[0.85, 0.9]])),
        ...both('arm', { r: [-10 * up, 0, 0] }),
      };
    },
  },

  // fidget: a happy tail swish from side to side, the head bobbing along
  idle_swish: {
    seconds: 2,
    pose: (t, u) => {
      const on = win(u, 0.05, 0.95, 0.15);
      const sw = Math.sin(TAU * 2 * u) * on;
      return merge({
        body: { r: [0, 0, 3 * sw] },
        head: { r: [3 * Math.abs(sw), 0, -5 * sw] },
        tail1: { r: [0, 0, 14 * sw] }, tail2: { r: [0, 0, 10 * sw] }, tail3: { r: [0, 0, 8 * sw] },
        ...face.pose('happy'),
      }, both('arm', { r: [4 * osc(u, 4), 0, 0] }));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
