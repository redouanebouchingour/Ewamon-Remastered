// Ironcarab's rig: an armoured rhinoceros beetle on six jointed legs. The shell, pronotum and its hooked horn are the
// body; the head carries the two sickle horns, the glowing eyes and the mandibles. Numbers are scad/ironcarab.scad's.
import { K, TAU, merge, rigDef, win } from './lib/anim.mjs';
import { any, ell, limb, pair, pick, spike } from './lib/biped.mjs';
import { insectClips } from './lib/insect.mjs';

// [hip, knee, foot] per leg pair, front first (the left side; mirror_x)
const LEGS = [
  [[6.5, -6, 6], [11.5, -9.5, 8], [13, -12, 1]],
  [[8, 1, 6], [13.5, 1, 8], [15.5, 2, 1]],
  [[7, 8, 6], [12, 12.5, 8], [13.5, 15.5, 1]],
];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...LEGS.flatMap(([hip], i) => pair(`leg${i + 1}*`, 'root', hip)),
  { name: 'body', parent: 'root', at: [0, 1, 6] },
  { name: 'head', parent: 'body', at: [0, -11, 7] },
  ...pair('mand*', 'head', [1.4, -17.5, 5]),
];

const legTest = ([hip, knee, foot]) => any(limb(hip, knee, 2, 1.7), ell([1.9, 1.9, 1.9], knee), limb(knee, foot, 1.6, 1),
  spike(foot, [0.75, -1, -0.6], 0.5), spike(foot, [-0.75, -1, -0.6], 0.5));
const parts = [
  ...LEGS.map((l, i) => [`leg${i + 1}*`, legTest(l)]),
  ['body', any(ell([9.5, 13, 4.5], [0, 2, 8]), ell([11.8, 13.3, 12.3], [0, 4, 7]),
    ell([8.6, 6.4, 6.4], [0, -8.3, 11.3]), limb([0, -9, 15], [0, -9.5, 19.5], 2.4, 1.9), limb([0, -9.5, 19.5], [0, -8.5, 23], 1.9, 1.4),
    limb([0, -8.5, 23], [0, -6, 24.5], 1.4, 0.8), limb([0, -6, 24.5], [0, -4.5, 23.5], 0.8, 0.2))],
  ['head', any(ell([5.2, 4, 3.8], [0, -13, 7]), ell([3.8, 3.4, 3], [0, -16.5, 6.4]))],
  ['head*', any(ell([1.3, 1, 1.2], [3.4, -17.2, 8.4]), limb([4, -14.5, 9], [6.5, -17, 11], 1.6, 1.4), limb([6.5, -17, 11], [8.5, -19, 15], 1.4, 1.1),
    limb([8.5, -19, 15], [9.5, -19, 20], 1.1, 0.7), limb([9.5, -19, 20], [9, -17.5, 24], 0.7, 0.2))],
  ['mand*', any(limb([1.4, -17.5, 5], [2.4, -19, 3.6], 0.8, 0.6), limb([2.4, -19, 3.6], [1, -19.8, 2.8], 0.6, 0.2))],
];

function assign(c) {
  const j = pick(c, parts);
  return j === 'headL' || j === 'headR' ? 'head' : j;
}

const base = insectClips({ stride: 14, lift: 12 });

const clips = {
  ...base,
  // fidget: lowers its head and shoves with the horns, twice, like clearing a log
  idle_shove: {
    seconds: 2.2,
    pose: (t, u) => {
      const low = K(u, [[0, 0], [0.15, 1], [0.8, 1], [0.95, 0]]);
      const push = Math.max(0, Math.sin(TAU * 2 * ((u - 0.2) / 0.55))) * win(u, 0.2, 0.75, 0.04);
      return merge(base.idle.pose(t, u), {
        body: { r: [6 * low, 0, 0], p: [0, -0.8 * push, 0] },
        head: { r: [10 * low - 12 * push, 0, 0] },
      });
    },
  },
};

export default rigDef({ joints, assign, clips });
