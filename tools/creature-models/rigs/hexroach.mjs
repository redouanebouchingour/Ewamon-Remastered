// Hexroach's rig: a low cockroach on six splayed legs, plated carapace (the rear plates and blisters are the abdomen),
// a wedge head with hooked mandibles and long antennae. Its eyes are glowing slits, not eye(): no face kit. Numbers are
// scad/hexroach.scad's.
import { merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, ell, limb, pick, spike } from './lib/biped.mjs';
import { blobD, chainHit, fold, side } from './lib/geo.mjs';
import { insectClips } from './lib/insect.mjs';

const ANT = [[1.4, -16, 8.6], [3.5, -18, 14], [6, -16, 20], [9, -11, 23]];
const ANT_R = [0.45, 0.4, 0.3, 0.12];
const MAND = [[2.6, -15.5, 4.8], [5, -18.5, 4], [4.6, -21.5, 3.4], [3, -23.6, 3], [0.8, -23.4, 2.8]];
const MAND_R = [1.3, 1.1, 0.85, 0.55, 0.1];
// [hip, knee, foot, r]
const LEGS = [
  [[6, -7, 4.5], [11, -11, 7], [12.5, -14, 0.6], 1.2],
  [[7, 0, 4.5], [13, 0, 7.5], [16, -1, 0.6], 1.1],
  [[6.5, 7, 4.5], [12, 10, 7], [14.5, 14, 0.6], 1.1],
];
const PLATES = [[-6, 8.5, 6.5, 5.2], [-1.5, 9.5, 7.5, 6.6], [3.5, 9.6, 7.6, 6.8], [8, 8.6, 6.8, 6], [12, 6.8, 5.4, 4.6]];
const BLISTERS = [[-3.5, 1, 12.6, 3.2], [3.2, 2, 12.6, 3], [0, 5.5, 13, 3.6], [-4.5, 7.5, 11.2, 2.6], [4.5, 8, 11, 2.6],
  [0, 10, 10.6, 2.4], [-1.5, -2.5, 12.6, 2.2], [2, -2.2, 12.4, 2]];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...LEGS.flatMap(([hip], i) => [
    { name: `leg${i + 1}L`, parent: 'root', at: hip },
    { name: `leg${i + 1}R`, parent: 'root', at: [-hip[0], hip[1], hip[2]] },
  ]),
  { name: 'body', parent: 'root', at: [0, 0, 4] },
  { name: 'abdomen', parent: 'body', at: [0, 5.5, 6] },
  { name: 'head', parent: 'body', at: [0, -9.5, 6] },
  { name: 'mandL', parent: 'head', at: MAND[0] },
  { name: 'mandR', parent: 'head', at: [-MAND[0][0], MAND[0][1], MAND[0][2]] },
  ...['L', 'R'].flatMap((S) => [0, 1, 2].map((i) => ({
    name: `ant${S}${i + 1}`, parent: i === 0 ? 'head' : `ant${S}${i}`, at: [ANT[i][0] * (S === 'L' ? 1 : -1), ANT[i][1], ANT[i][2]],
  }))),
];

const legTest = ([hip, knee, foot, r], i) => any(
  limb(hip, knee, r * 1.4, r * 1.1), limb(knee, foot, r * 1.1, r * 0.5),
  spike(knee, [0, 0, 1.8], r * 0.5), spike(foot, [0, -1, -foot[2] + 0.05], r * 0.4),
  ...(i === 0 ? [limb([12.5, -14, 2], [14, -16.5, 2.5], 0.9, 0.6), limb([14, -16.5, 2.5], [13, -18.5, 1.4], 0.6, 0.2)] : []),
);
const parts = [
  ...LEGS.map((l, i) => [`leg${i + 1}*`, legTest(l, i)]),
  ['body', any(...PLATES.slice(0, 3).map(([y, a, b, c]) => ell([a, b, c], [0, y, 6.5])), ell([7.5, 7, 3], [0, -2, 3.8]),
    ...BLISTERS.filter((b) => b[1] < 5).map(([x, y, z, r]) => ell([r, r, r], [x, y, z])))],
  ['abdomen', any(...PLATES.slice(3).map(([y, a, b, c]) => ell([a, b, c], [0, y, 6.5])), ell([7.5, 7, 3], [0, 9, 3.8]),
    ...BLISTERS.filter((b) => b[1] >= 5).map(([x, y, z, r]) => ell([r, r, r], [x, y, z])))],
  ['head', any((c) => blobD(c, [[[6, 4.6, 4.4], [0, -11, 6.4]], [[4.2, 3.4, 3.2], [0, -14.5, 5.8]]]),
    ell([6.4, 3.4, 1.8], [0, -10.5, 9.6]), spike([4.6, -11, 7], [3, 1.5, 1.5], 1),
    ell([1.8, 1.2, 1], [2.7, -16.4, 7.2]), limb([1.2, -17.4, 4.6], [1.5, -18.4, 3.2], 0.5, 0.3))],
];

function assign(c) {
  const f = fold(c);
  const S = side(c);
  const m = chainHit(f, MAND, MAND_R);
  if (m.d < 1.15 && f[1] < -16) return `mand${S}`;
  const a = chainHit(f, ANT, ANT_R);
  if (a.d < 1.5 && f[2] > 8.8) return `ant${S}${a.i + 1}`;
  return pick(c, parts);
}

const clips = insectClips({ ant: 3, stride: 14, lift: 12 });

// fidget: the blisters on its back throb and the violet seams pulse, the whole roach shuddering
clips.idle_throb = {
  seconds: 2.4,
  pose: (t, u) => {
    const on = win(u, 0.1, 0.85, 0.1);
    const th = (osc(u, 6) * 0.5 + 0.5) * on;
    return merge({
      abdomen: { s: [1 + 0.05 * th, 1 + 0.03 * th, 1 + 0.07 * th] },
      body: { r: [0, 1.5 * osc(u, 18) * on, 0] },
      head: { r: [-4 * on, 0, 0] },
      mandL: { r: [0, 0, 8 * th] },
      mandR: { r: [0, 0, -8 * th] },
    });
  },
};

export default rigDef({ joints, assign, clips });
