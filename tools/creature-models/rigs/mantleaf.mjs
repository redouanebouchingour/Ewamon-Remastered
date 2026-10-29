// Mantleaf's rig: a leaf mantis on four stilt legs (leg1 front, leg2 back), raised scythe arms (claw = upper arm,
// pinch = the bladed forearm), a slim upright thorax, a fat abdomen under folded leaf wings, and a lotus crown round
// the head. Numbers are scad/mantleaf.scad's.
import { K, TAU, merge, rigDef, win } from './lib/anim.mjs';
import { any, blob, ell, limb, pair, pick, spike } from './lib/biped.mjs';
import { chainHit, fold, near, side } from './lib/geo.mjs';
import { insectClips } from './lib/insect.mjs';

const PINK = [[1, 0.56, 0.6], [0.9, 0.42, 0.48]];
const GREEN_DK = [0.3, 0.45, 0.11];
const ANT = [[1, -3.5, 30.5], [2, -3, 34], [3.5, -2.5, 37], [5, -3, 38.5]];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg1*', 'root', [3, 3, 11]),
  ...pair('leg2*', 'root', [3, 8, 10]),
  { name: 'body', parent: 'root', at: [0, 4, 11] },
  { name: 'abdomen', parent: 'body', at: [0, 5, 12] },
  { name: 'head', parent: 'body', at: [0, -1.5, 22] },
  ...['L', 'R'].flatMap((S) => [0, 1, 2].map((i) => ({
    name: `ant${S}${i + 1}`, parent: i === 0 ? 'head' : `ant${S}${i}`, at: [(S === 'L' ? 1 : -1) * ANT[i][0], ANT[i][1], ANT[i][2]],
  }))),
  ...pair('claw*', 'body', [2, -2, 21]),
  ...pair('pinch*', 'claw*', [7, -4.5, 25]),
];

const parts = [
  ['leg1*', any(limb([3, 3, 11], [8, -1, 12], 1.2, 1), limb([8, -1, 12], [9.5, -4, 0.8], 1, 0.6), ell([1.2, 1.8, 0.6], [9.5, -4.6, 0.6]))],
  ['leg2*', any(limb([3, 8, 10], [8, 11, 11], 1.2, 1), limb([8, 11, 11], [9.5, 14, 0.8], 1, 0.6), ell([1.2, 1.8, 0.6], [9.5, 14.4, 0.6]))],
  ['abdomen', blob([[[7.5, 9, 6], [0, 9, 12]], [[5, 6, 4.5], [0, 15, 10]]])],
  ['body', any(limb([0, 3, 12], [0, 0, 17], 2.8, 2.4), limb([0, 0, 17], [0, -1.5, 22], 2.4, 2.2))],
  ['head', any(ell([5, 3.2, 2.8], [0, -2, 28.5]), limb([0, -2, 28.5], [0, -3.5, 24], 2.8, 1.4), ell([2.4, 1.3, 1.8], [3.2, -3.6, 28]),
    ell([2.4, 1.3, 1.8], [-3.2, -3.6, 28]))],
  ['claw*', limb([2, -2, 21], [7, -4.5, 25], 1.2, 1)],
  ['pinch*', any(limb([7, -4.5, 25], [8.5, -5.5, 15], 1.3, 0.7), limb([8.6, -5.2, 24], [9.4, -5.8, 15], 1.2, 0.3),
    ...[0, 1, 2, 3].map((i) => spike([8.9 + i * 0.12, -5.5, 22 - i * 2], [1.6, -0.2, -0.6], 0.5)))],
];

function assign(c, rgb) {
  const f = fold(c);
  const S = side(c);
  if (PINK.some((p) => near(rgb, p))) return 'head';                        // the lotus crown
  if (near(rgb, GREEN_DK) && c[2] > 29.5) return `ant${S}${Math.min(3, chainHit(f, ANT, [0.35, 0.3, 0.25, 0.2]).i + 1)}`;
  // the folded leaf wings lie over the abdomen
  if (c[1] > 1 && c[2] > 9 && f[0] < 13 && c[2] < 21 && pick(c, parts) === 'abdomen') return 'abdomen';
  if (c[1] > 2 && c[2] > 12 && c[2] < 22 && f[0] > 2.5 && !pick(c, parts).startsWith('leg')) return 'abdomen';
  return pick(c, parts);
}

const base = insectClips({ ant: 3, legs: 2, stride: 12, lift: 10 });

const clips = {
  ...base,
  // fidget: the praying sway, rocking side to side with the scythes folded, then a quick snatch at the air
  idle_sway: {
    seconds: 2.6,
    pose: (t, u) => {
      const rock = Math.sin(TAU * 2 * u) * win(u, 0, 0.65, 0.1);
      const snatch = K(u, [[0.66, 0], [0.74, 1], [0.86, 0]]);
      return merge(base.idle.pose(t, u), {
        body: { r: [0, 6 * rock, 0] },
        head: { r: [0, -8 * rock, 0] },
        clawL: { r: [-30 * snatch, 0, -10 * snatch] }, clawR: { r: [-30 * snatch, 0, 10 * snatch] },
        pinchL: { r: [50 * snatch, 0, 0] }, pinchR: { r: [50 * snatch, 0, 0] },
      });
    },
  },
};

export default rigDef({ joints, assign, clips });
