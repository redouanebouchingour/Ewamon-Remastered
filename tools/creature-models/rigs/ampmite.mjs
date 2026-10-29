// Ampmite's rig: a low armoured beetle-mite on six splayed legs: the thorax carries the two capacitor bulbs and their
// lightning, the rear three shell segments are the abdomen, a big lowered head (scaled 1.45 about the neck) with rust
// mandibles, and slate antennae ending in sparks. Its eyes are gold compound domes: no face kit. Numbers are
// scad/ampmite.scad's.
import { merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, ell, limb, pick, spike } from './lib/biped.mjs';
import { chainHit, fold, side } from './lib/geo.mjs';
import { insectClips } from './lib/insect.mjs';

const H = (p) => [p[0] * 1.45, -8 + (p[1] + 8) * 1.45, 10 + (p[2] - 10) * 1.45];
const ANT = [[1.6, -13.5, 13.5], [3, -15.5, 17], [5, -16, 22], [6.6, -15.5, 26]];
const ANT_R = [0.55, 0.5, 0.45, 0.35];
const MAND = [[1.6, -14.8, 6.6], [2.2, -17, 6], [1, -18.2, 6]].map(H);
// [y, splay, reach] of leg(); hip [5, y, 8.5]
const LEGS = [[-5, -5, 6], [2, 0, 6.5], [9, 5, 6]].map(([y, splay, reach]) => ({
  hip: [5, y, 8.5], knee: [5 + reach * 0.6, y + splay * 0.4, 10], foot: [5 + reach, y + splay, 1.2],
}));
const SEGS = [[[0, -4, 11], [6.5, 5.5, 4.6]], [[0, 3, 11], [7, 4.5, 5]], [[0, 8.5, 10.5], [6.4, 4, 4.6]],
  [[0, 13.5, 9.8], [5.6, 3.8, 4]], [[0, 17.8, 9.2], [4.4, 3.2, 3.2]]];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...LEGS.flatMap(({ hip }, i) => [
    { name: `leg${i + 1}L`, parent: 'root', at: hip },
    { name: `leg${i + 1}R`, parent: 'root', at: [-hip[0], hip[1], hip[2]] },
  ]),
  { name: 'body', parent: 'root', at: [0, 0, 7] },
  { name: 'abdomen', parent: 'body', at: [0, 6, 10] },
  { name: 'head', parent: 'body', at: [0, -8, 10] },
  { name: 'mandL', parent: 'head', at: MAND[0] },
  { name: 'mandR', parent: 'head', at: [-MAND[0][0], MAND[0][1], MAND[0][2]] },
  ...['L', 'R'].flatMap((S) => [0, 1, 2].map((i) => ({
    name: `ant${S}${i + 1}`, parent: i === 0 ? 'head' : `ant${S}${i}`, at: [ANT[i][0] * (S === 'L' ? 1 : -1), ANT[i][1], ANT[i][2]],
  }))),
];

const legTest = ({ hip, knee, foot }) => any(limb(hip, knee, 1.6, 1.3), limb(knee, foot, 1.3, 0.9), ell([1.6, 1.6, 1.6], knee),
  ell([0.8, 0.8, 0.8], foot), spike(foot, [-0.3, -1.8, -1], 0.8), spike(foot, [1.1, -1.8, -1], 0.8));
const segTest = (list) => any(...list.map(([p, r]) => ell(r, p)), ...list.map(([p, r]) => ell([r[0] * 1.04, r[1] * 0.96, r[2] * 0.8], [p[0], p[1], p[2] - r[2] * 0.25])));
const parts = [
  ...LEGS.map((l, i) => [`leg${i + 1}*`, legTest(l)]),
  ['body', any(segTest(SEGS.slice(0, 2)), ell([4.4, 4.4, 4.4], [-4.4, -1.5, 19.5]), ell([4.8, 4.8, 4.8], [4.8, 6, 19.5]),
    limb([-4.4, -1.5, 22], [-4, -2.5, 31], 3), limb([4.8, 6, 22], [5.8, 5, 31.5], 3), limb([8.8, 6, 21], [12, 6, 27], 1.5),
    limb([-1, 2, 22], [-0.6, 2, 26.5], 1.2))],
  ['abdomen', segTest(SEGS.slice(2))],
  ['head', any(ell([5.4, 4.6, 4.2].map((v) => v * 1.45), H([0, -11, 9])), ell([4, 3.6, 2.8].map((v) => v * 1.45), H([0, -11.6, 10.6])),
    ...[1, -1].map((s) => ell([3.4, 2.4, 3.5], H([2.6 * s, -14.4, 9.6]))), ...[1, -1].map((s) => ell([3.2, 1.8, 1.5], H([3.4 * s, -12.6, 6.8]))))],
];

function assign(c) {
  const f = fold(c);
  const S = side(c);
  const m = chainHit(f, MAND, [0.8, 0.6, 0.25].map((r) => r * 1.45));
  if (m.d < 1.15 && f[1] < -16.5) return `mand${S}`;
  if (f[0] > 5.6 && f[1] < -14 && f[2] > 25.5) return `ant${S}3`;     // the spark tips
  const a = chainHit(f, ANT, ANT_R);
  if (a.d < 1.5 && f[2] > 13.5 && f[1] < -12) return `ant${S}${a.i + 1}`;
  return pick(c, parts);
}

const clips = insectClips({ ant: 3, stride: 14, lift: 12 });

// fidget: the capacitors charge (the bulbs swell) and discharge in a jolt that rattles the whole mite
clips.idle_discharge = {
  seconds: 2,
  pose: (t, u) => {
    const charge = win(u, 0.1, 0.6, 0.3);
    const jolt = win(u, 0.6, 0.75, 0.02);
    return merge({
      root: { p: [0, 0, 0.6 * jolt] },
      body: { r: [0, 2 * osc(u, 24) * jolt, 0], s: 1 + 0.025 * charge },
      head: { r: [-6 * jolt, 0, 0] },
      mandL: { r: [0, 0, 12 * jolt] },
      mandR: { r: [0, 0, -12 * jolt] },
      antL1: { r: [-10 * jolt, -8 * jolt, 0] },
      antR1: { r: [-10 * jolt, 8 * jolt, 0] },
    });
  },
};

export default rigDef({ joints, assign, clips });
