// Roobrawler's rig: Joeyjab grown into a muscled kangaroo fighter. It still hops instead of walking, the red-wrapped
// fists stay up in guard, the gold belt rides the body and the bandaged tail swings in four links. Numbers are
// scad/roobrawler.scad's; the clips follow rigs/joeyjab.mjs, heavier.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, mx, pair, petal, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny } from './lib/geo.mjs';

const FUR = [0.8, 0.52, 0.24];
const TAIL = [[0, 4.5, 10], [4, 8.5, 6], [10, 9, 5.5], [15, 7, 9], [17, 4.5, 15]];
const TAIL_R = [3.6, 3.5, 3, 2.4, 1.2];
const tails = ['tail1', 'tail2', 'tail3', 'tail4'];

const eye = { side: 'L', at: [2.5, -4.1, 30.5], size: 1.5, yaw: 8, flat: 0.4 };
const face = eyeKit({ eyes: [eye, mirrorEye(eye)], skin: FUR });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4.8, 1.4, 8.4]),
  { name: 'body', parent: 'root', at: [0, 0.5, 10] },
  { name: 'head', parent: 'body', at: [0, -0.5, 26.5] },
  ...pair('ear*', 'head', [2.8, 0.4, 32.5]),
  ...pair('arm*', 'body', [8.2, 0, 23]),
  ...pair('fore*', 'arm*', [9.4, -3, 17.5]),
  ...pair('hand*', 'fore*', [6.4, -6.5, 24]),
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[1] },
  { name: 'tail3', parent: 'tail2', at: TAIL[2] },
  { name: 'tail4', parent: 'tail3', at: TAIL[3] },
  ...face.joints,
];

const parts = [
  ['body', any(blob([[[5.4, 4.6, 5], [0, 0.6, 15]], [[7.6, 5.6, 5], [0, 0, 22]]]), blob([[[4.2, 2.6, 4], [0, -3.4, 15]], [[5.2, 3, 3.4], [0, -3.6, 21.5]]]),
    mx(ell([2.4, 1, 1.8], [2.2, -6.2, 22])), mx(ell([1.3, 0.6, 1], [1.4, -5.9, 15.6])), mx(ell([1.3, 0.6, 1], [1.4, -5.9, 18.4])),
    mx(ell([2.4, 1, 2.8], [3.2, 4.7, 22.4])), mx(ell([1.8, 0.8, 3], [3.6, 4.1, 17.8])), limb([0, 5.3, 25], [0, 4.8, 14.5], 0.45),
    ell([7.4, 6.2, 1.2], [0, 0.6, 12.6]), ell([2.6, 0.8, 2.6], [0, -5.9, 12.6]))],
  ['head', any(ell([4.8, 4.8, 4.8], [0, -0.6, 30]), blob([[[3.2, 3, 2.4], [0, -4.4, 28.6]], [[1.4, 1.4, 1.2], [0, -8.2, 28.4]]]),
    blob([[[2.6, 2.2, 1.6], [0, -4.8, 27.4]], [[1.2, 1.2, 0.9], [0, -7.8, 27.6]]]), ell([0.9, 0.7, 0.6], [0, -9.4, 28.9]), mx(ell([1.8, 1, 0.9], [2.5, -4.3, 31.8])))],
  ['ear*', any(petal([1.8, 1, 5.4], [2.8, 0.6, 37.5], [0, 12, 0]), petal([1, 0.5, 4], [2.9, -0.2, 37.5], [0, 12, 0]))],
  ['arm*', any(limb([8.2, 0, 23], [9.4, -3, 17.5], 2.4, 2), ell([3.4, 3.4, 3.2], [7, 0, 23.2]))],
  ['fore*', limb([9.4, -3, 17.5], [6.4, -6.5, 24], 1.9, 1.6)],
  ['hand*', any(limb([6.4, -6.6, 24], [5.6, -7.6, 26.4], 1.7, 2.2), ell([2.15, 2.15, 0.6], [6, -7.2, 25]))],
  ['leg*', any(ell([4, 5, 5.4], [4.8, 1.4, 8.4]), limb([5, 2.6, 5], [5.2, 2, 1.6], 1.8, 1.4), blob([[[2, 4.2, 1.3], [5.2, -1.6, 1.3]], [[1.6, 1.6, 1.3], [5.2, 1.4, 1.5]]]),
    spike([5.2, -5.2, 0.9], [0, -1.5, -0.4], 0.55))],
  ...chain(tails, TAIL, TAIL_R),
];

// the gold belt and its buckle ride the body (its flat rim would otherwise go to the haunches)
const GOLD = [[0.98, 0.78, 0.12], [1, 0.92, 0.4]];
const assign = (c, rgb) => (isAny(rgb, GOLD) ? 'body' : pick(c, parts));

const base = bipedClips({
  face, tail: tails, hipH: 8.4, hop: true, hopH: 4.5, guard: true, hopScale: 0.7,
  punch: { arm: [-45, 0, 0], fore: [53, 0, 0] },
  add: {
    celebrate: (t, u) => both('hand', { s: 1 + 0.1 * Math.abs(Math.sin(TAU * u)) }),
  },
});

const clips = {
  ...base,

  // fidget: a one-two then a big hook, bouncing on the balls of its feet, the tail swaying for balance
  idle_combo: {
    seconds: 2.4,
    pose: (t, u) => {
      const j = win(u, 0.14, 0.26, 0.04);
      const c = win(u, 0.32, 0.44, 0.04);
      const hook = win(u, 0.52, 0.7, 0.05);
      const on = win(u, 0.05, 0.9, 0.08);
      return {
        root: { p: [0, 0, 0.6 * Math.abs(osc(u, 6)) * on] },
        body: { r: [4 * on, 0, -10 * j + 14 * c - 22 * hook] },
        head: { r: [3 * on, 0, 6 * j - 8 * c + 12 * hook] },
        ...face.pose('open', 0.4 * on),
        armL: { r: [-45 * j, 0, 0] }, foreL: { r: [53 * j, 0, 0] },
        armR: { r: [-45 * c - 30 * hook, 40 * hook, 0] }, foreR: { r: [53 * c + 40 * hook, 0, 0] },
        ...Object.fromEntries(tails.map((n, i) => [n, { r: [0, 0, (8 * j - 10 * c + 14 * hook) * (1 + 0.3 * i)] }])),
      };
    },
  },

  // fidget: it leans back on its tail like a stool, arms folded down, and looks smug, then springs back up
  idle_tailrest: {
    seconds: 2.6,
    pose: (t, u) => {
      const lean = K(u, [[0, 0], [0.2, 1], [0.72, 1], [0.85, 0]]);
      return merge({
        root: { r: [-7 * lean, 0, 0] },
        body: { r: [-4 * lean, 0, 0] },
        head: { r: [8 * lean, 0, 10 * lean] },
        ...face.pose('open', 0.45 * lean + blinks(u, [[0.5, 0.56]])),
        ...both('arm', { r: [20 * lean, 0, 0] }), ...both('fore', { r: [-40 * lean, 0, 0] }),
        ...both('leg', { r: [7 * lean, 0, 0] }),
        ...Object.fromEntries(tails.map((n, i) => [n, { r: [10 * lean, 0, 0] }])),
        ...both('ear', { r: [10 * lean, 0, 0] }),
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
