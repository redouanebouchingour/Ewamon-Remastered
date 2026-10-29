// Auroracle's rig: a regal crystal fox on four slender legs, a leafy mane, nine crystal tails fanned behind (one tail
// joint, so the fan sways as one) and ice shards floating round it (their own joint off the root). Numbers are
// scad/auroracle.scad's; everything above the legs sits in its translate([0, 0, -3]) block (dz()).
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, blob, ell, limb, pick, spike } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const dz = ([x, y, z]) => [x, y, z - 3];
const BODY = [0.55, 0.72, 0.95];
const TAILS = [[0.5, 0.68, 0.95], [0.65, 0.8, 0.99]];
const VEIN = [0.88, 0.95, 1];
const SHARD = [0.75, 0.9, 1];
const PAW = [0.3, 0.45, 0.85];

const eyeL = { side: 'L', at: dz([2.8, -13.2, 29.2]), size: 1.75, yaw: 4, flat: 0.4 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.33, 0.52, 0.88] });

const joints = [
  { name: 'root', at: [0, 2, 0] },
  { name: 'legFL', parent: 'root', at: [3.2, -5.5, 12] },
  { name: 'legFR', parent: 'root', at: [-3.2, -5.5, 12] },
  { name: 'legBL', parent: 'root', at: [3.2, 9.5, 12] },
  { name: 'legBR', parent: 'root', at: [-3.2, 9.5, 12] },
  { name: 'body', parent: 'root', at: [0, 2, 12] },
  { name: 'head', parent: 'body', at: dz([0, -8, 23.5]) },
  { name: 'earL', parent: 'head', at: dz([3.4, -8, 32.5]) },
  { name: 'earR', parent: 'head', at: dz([-3.4, -8, 32.5]) },
  { name: 'tail1', parent: 'body', at: dz([0, 11, 17]) },
  { name: 'shards', parent: 'root', at: [0, 2, 0] },
  ...face.joints,
];

const leg = (x, y) => any(limb([x, y, 12], [x, y - 0.4, 5], 2.2, 1.6), limb([x, y - 0.4, 5.4], [x, y - 1, 1], 1.7, 1.8),
  ell([2, 2.8, 1.1], [x, y - 1.7, 1.1]), spike([x, y + 0.4, 10.5], [0.6, 1, -4], 1.4));
const parts = [
  ['legF*', leg(3.2, -5.5)],
  ['legB*', leg(3.2, 9.5)],
  ['body', any(blob([[[5.2, 6, 5.6], [0, -3, 13]], [[4.8, 6, 5], [0, 6, 12.5]]]), ell([4.4, 8, 3], [0, 1, 8.5]),
    ell([10.5, 9.5, 9], dz([0, -6.5, 19.5])), ell([1.8, 6, 2.5], dz([0, 3, 21.5])))],
  ['head', any(ell([6, 5.8, 5.6], dz([0, -9, 28.5])), blob([[[3, 2.6, 2.4], dz([0, -13, 27])], [[1.3, 1.4, 1.2], dz([0, -17.4, 26.6])]]),
    ell([6.5, 3, 3], dz([6.5, -9.5, 27])), ell([6.5, 3, 3], dz([-6.5, -9.5, 27])), ell([1.6, 1.6, 4], dz([0, -10.5, 35])))],
  ['ear*', any(limb(dz([3.4, -8, 32.5]), dz([4.6, -8, 41.5]), 2.6, 0.5), ell([2.8, 2.2, 2.2], dz([6.5, -7, 33.2])))],
  ['tail1', ell([3, 3, 3], dz([0, 11.5, 17]))],
];

function assign(c, rgb) {
  if (near(rgb, SHARD, 0.025)) return 'shards';
  if (isAny(rgb, TAILS, 0.025)) return 'tail1';
  if (near(rgb, VEIN, 0.025)) return c[1] > 6 ? 'tail1' : 'head';
  if (near(rgb, PAW)) return pick(c, parts.slice(0, 2));
  return pick(c, parts);
}

// the shards drift up and down and turn slowly round the fox
const drift = (u, amp = 1, cycles = 1) => ({ shards: { p: [0, 0, 0.8 * amp * osc(u, cycles)], r: [0, 0, 4 * amp * osc(u, cycles, 0.25)] } });
// the nine tails sway as one fan
const fan = (u, amp = 4, cycles = 1) => ({ tail1: { r: [2 * amp * osc(u, cycles, 0.3) / 4, 0, amp * osc(u, cycles)] } });

const base = quadrupedClips({
  face, hipH: 12, stride: 14,
  add: {
    idle: (t, u) => merge(drift(u, 1, 1), fan(u, 4, 2)),
    walk: (t, u) => merge(drift(u, 0.6, 2), fan(u, 6, 1)),
    idle_sniff: (t, u) => merge(drift(u, 1, 1), fan(u, 3, 2)),
    idle_shake: (t, u) => merge(drift(u, 2, 3), fan(u, 10 * win(u, 0.1, 0.8, 0.06), 7)),
    celebrate: (t, u) => merge(drift(u, 2, 2), fan(u, 10, 3)),
    hurt: (t, u) => drift(u, 2, 3),
    faint: (t, u) => ({ shards: { p: [0, 0, -2 * K(u, [[0.2, 0], [0.9, 1]])] } }),
  },
});
const { idle_wag: _wag, ...clips0 } = base;

const clips = {
  ...clips0,
  // fidget: the shards circle the fox once while it watches them go round, eyes half closed, tails fanning up
  idle_aurora: {
    seconds: 3.2,
    pose: (t, u) => {
      const on = win(u, 0.05, 0.92, 0.12);
      const spin = K(u, [[0.05, 0], [0.9, 360]]);
      return merge({
        shards: { r: [0, 0, spin], p: [0, 0, 1.4 * on] },
        head: { r: [-8 * on, 0, 22 * Math.sin((TAU * spin) / 360)] },
        body: { r: [0, 0, 6 * Math.sin((TAU * spin) / 360)] },
        tail1: { r: [10 * on, 0, 4 * osc(u, 2)] },
        ...face.pose('open', 0.45 * on),
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
