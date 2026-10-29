// Luxtrik's rig: a hunched moss-beetle with crab pincer forelegs, four stubby back legs, two pairs of raised leaf-wings
// and twig antennae. The pincers are the claws (they hover just off the ground), the back legs leg2 / leg3. Numbers
// are scad/luxtrik.scad's.
import { K, TAU, merge, rigDef, win } from './lib/anim.mjs';
import { any, blob, ell, limb, pair, pick, spike } from './lib/biped.mjs';
import { chainHit, ellD, near, unrot } from './lib/geo.mjs';
import { insectClips } from './lib/insect.mjs';

const WING = [0.62, 0.66, 0.28];
const WING_LT = [0.76, 0.8, 0.42];
const VEIN = [0.4, 0.42, 0.14];
const BARK = [0.35, 0.24, 0.14];

const ANT = [[1.6, -11, 14.5], [4, -14, 19], [8, -16, 21.5], [12, -15, 20], [14, -14, 17]];
const antL = ['antL1', 'antL2', 'antL3', 'antL4'];
const BACK = [2, 9];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...BACK.flatMap((y, i) => pair(`leg${i + 2}*`, 'root', [5.5, y, 9])),
  { name: 'body', parent: 'root', at: [0, 2, 9] },
  { name: 'abdomen', parent: 'body', at: [0, 5, 12] },
  { name: 'head', parent: 'body', at: [0, -8, 11.5] },
  ...pair('mand*', 'head', [1.4, -15.5, 9.2]),
  ...['L', 'R'].flatMap((S) => antL.map((n, i) => ({
    name: `ant${S}${i + 1}`, parent: i === 0 ? 'head' : `ant${S}${i}`, at: [S === 'L' ? ANT[i][0] : -ANT[i][0], ANT[i][1], ANT[i][2]],
  }))),
  ...pair('wing*', 'body', [3, 0, 18]),
  ...pair('wing2*', 'body', [4, 4, 17]),
  ...pair('claw*', 'body', [5, -6, 11]),
  ...pair('pinch*', 'claw*', [9, -9, 8]),
];

// a raised leaf wing: the scad's wing(p, rot, s) ellipsoid, tested in its own frame through the axis of the leaf
const leafD = (c, p, r, s) => ellD(unrot(r, [c[0] - p[0], c[1] - p[1], c[2] - p[2]]), [s[0], 0.8, s[1]], [0, 0, s[1]]);
const parts = [
  ...BACK.map((y, i) => [`leg${i + 2}*`, any(limb([5.5, y, 9], [8.5, y + 1, 4], 1.8, 1.6), limb([8.5, y + 1, 4], [9.5, y, 1], 1.6, 1.4),
    spike([9.5, y, 1], [0.4, -1.6, -0.6], 0.6), spike([9.5, y, 1], [-0.4, -1.6, -0.6], 0.6))]),
  ['body', any(blob([[[7, 6.5, 6], [0, -2, 13]], [[6, 5, 5], [0, -6, 14]]]), ell([1.2, 1.2, 1.4], [-6.4, 0, 16.4]), ell([1.2, 1.2, 1.4], [6, 1, 17.2]),
    ell([1.3, 1.3, 1.4], [-3, -2, 19]), ell([1.3, 1.3, 1.4], [2.5, -3, 18.8]), ell([1.3, 1.3, 1.4], [0, 2, 19.6]))],
  ['abdomen', any(blob([[[7.5, 7, 6.5], [0, 6, 13]], [[5, 5, 4], [0, 12, 11]]]), ell([1.3, 1.3, 1.4], [-4.5, 5, 18.6]), ell([1.3, 1.3, 1.4], [4, 6, 18.8]),
    ell([1.3, 1.3, 1.4], [-1.5, 9, 18]), ell([1.3, 1.3, 1.4], [3, 11, 16]), ell([1.3, 1.3, 1.4], [-4, 12, 15]))],
  ['head', any(blob([[[4.6, 4, 4], [0, -9.5, 11.5]], [[3, 3, 2.6], [0, -13.5, 10]]]), ell([3.2, 2.4, 1.6], [0, -11, 14.4]), ell([1.8, 1.5, 1.8], [3.4, -11.4, 12]),
    ell([1.8, 1.5, 1.8], [-3.4, -11.4, 12]))],
  ['mand*', spike([1.4, -15.5, 9.2], [-0.6, -1.4, -0.8], 0.5)],
  ['claw*', any(limb([5, -6, 11], [9, -9, 8], 2.2, 2))],
  ['pinch*', any(limb([9, -9, 8], [10.5, -13, 5], 2, 2.4), ell([2.6, 3, 2.4], [10.5, -13.5, 4.8]), limb([9.4, -15, 4.4], [9, -18, 2.6], 1.1, 0.3),
    limb([11.8, -15, 4.4], [12.4, -18, 2.4], 1.1, 0.3), ell([1.2, 1.2, 1.4], [10.5, -12, 8]))],
];
// the antenna leaves hang off their twig links
const ANT_LEAF = [[ANT[1], 1], [ANT[2], 2], [ANT[3], 3], [ANT[4], 4]];

function assign(c, rgb) {
  const f = [Math.abs(c[0]), c[1], c[2]];
  const S = c[0] >= 0 ? 'L' : 'R';
  if (near(rgb, BARK)) return `ant${S}${Math.min(4, chainHit(f, ANT, [0.5, 0.45, 0.4, 0.35, 0.3]).i + 1)}`;
  if ((near(rgb, WING) || near(rgb, WING_LT) || near(rgb, VEIN)) && f[2] > 16.5 && f[1] > -6) {
    // the raised leaf-wings: front pair from (3, 0, 18), the hind pair from (4, 4, 17)
    const a = leafD(f, [3, 0, 18], [-35, 28, 0], [4.2, 10]);
    const b = leafD(f, [4, 4, 17], [-60, 52, 10], [3.4, 8.5]);
    if (Math.min(a, b) < 1.6) return a < b ? `wing${S}` : `wing2${S}`;
  }
  if (near(rgb, WING) || near(rgb, WING_LT)) {
    let best = null; let bd = Infinity;
    for (const [p, i] of ANT_LEAF) { const d = Math.hypot(f[0] - p[0], f[1] - p[1], f[2] - p[2]); if (d < bd) { bd = d; best = i; } }
    if (bd < 4) return `ant${S}${best}`;
  }
  return pick(c, parts);
}

const base = insectClips({ ant: 4, stride: 12, lift: 10, buzz: 18 });

const clips = {
  ...base,
  // fidget: clacks its pincers together twice, proud of them
  idle_clack: {
    seconds: 1.8,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.15, 1], [0.8, 1], [0.95, 0]]);
      const clack = Math.max(0, Math.sin(TAU * 3 * ((u - 0.18) / 0.6))) * win(u, 0.18, 0.78, 0.03);
      return merge(base.idle.pose(t, u), {
        body: { r: [-4 * up, 0, 0] },
        clawL: { r: [-20 * up, 0, 14 * clack] }, clawR: { r: [-20 * up, 0, -14 * clack] },
        pinchL: { r: [0, 0, 10 * clack] }, pinchR: { r: [0, 0, -10 * clack] },
      });
    },
  },
};

export default rigDef({ joints, assign, clips });
