// Blighthex's rig: a hulking blight beetle. The spiked scythe forearms reach down to the ground, so they are the front
// legs (leg1); two pairs of back legs; the domed carapace with its venom orbs (the rear plates and orbs are the
// abdomen), a horned head with hanging fangs and long arching antennae. Its eyes are burning slits: no face kit.
// Numbers are scad/blighthex.scad's.
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, blob, ell, limb, pick, spike } from './lib/biped.mjs';
import { chainHit, fold, side } from './lib/geo.mjs';
import { insectClips } from './lib/insect.mjs';

const ANT = [[1.4, -17, 12], [3, -20, 19], [6, -17, 26], [10, -10, 29], [12, -4, 27]];
const ANT_R = [0.5, 0.45, 0.35, 0.25, 0.1];
const PLATES = [[-5, 10, 8, 8], [0, 11, 8.6, 9.6], [5, 10.6, 8.2, 9.2], [9.5, 9, 7, 7.6], [13, 7, 5.4, 5.6]];
const ORBS = [[-5.5, 2, 18.6, 4], [5.5, 3, 18.4, 3.8], [0, 8, 18, 4.2], [-8.5, 9, 12.6, 3], [8.5, 9.5, 12.4, 3.2],
  [0, 13.5, 13, 2.8], [-3, -3.5, 19.2, 2.6], [3.5, -3, 19, 2.4]];
const LEGS = [[[8, 1, 7], [13, 1.5, 10], [14.5, 0, 0.8], 1.8], [[7.5, 8, 7], [12, 11, 9.5], [13, 14, 0.8], 1.7]];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'leg1L', parent: 'root', at: [7, -8, 10] },
  { name: 'leg1R', parent: 'root', at: [-7, -8, 10] },
  ...LEGS.flatMap(([hip], i) => [
    { name: `leg${i + 2}L`, parent: 'root', at: hip },
    { name: `leg${i + 2}R`, parent: 'root', at: [-hip[0], hip[1], hip[2]] },
  ]),
  { name: 'body', parent: 'root', at: [0, 0, 6] },
  { name: 'abdomen', parent: 'body', at: [0, 7, 10] },
  { name: 'head', parent: 'body', at: [0, -9, 9] },
  ...['L', 'R'].flatMap((S) => [0, 1, 2, 3].map((i) => ({
    name: `ant${S}${i + 1}`, parent: i === 0 ? 'head' : `ant${S}${i}`, at: [ANT[i][0] * (S === 'L' ? 1 : -1), ANT[i][1], ANT[i][2]],
  }))),
];

const plateT = (list) => any(...list.flatMap(([y, a, b, c]) => [ell([a, b, c], [0, y, 10]), spike([0, y + 1, 10 + c * 0.95], [0, 1.4, 2.6], 1.1),
  spike([a * 0.75, y, 10 + c * 0.55], [1.8, 0.6, 1.8], 0.9), spike([-a * 0.75, y, 10 + c * 0.55], [-1.8, 0.6, 1.8], 0.9)]));
const orbT = (list) => any(...list.map(([x, y, z, r]) => ell([r, r, r], [x, y, z])));
const scythe = any(limb([7, -8, 10], [12, -13, 13], 2.8, 2.6), limb([12, -13, 13], [14, -18, 5], 2.8, 2.2),
  ...[0, 1, 2].map((i) => spike([12.6 + i * 0.6, -14 - i * 1.5, 12 - i * 2.6], [1.6, 0.6, 1.4], 0.7)),
  ell([2.4, 2.4, 2], [14, -18.5, 4]), limb([14, -20, 4], [14, -22.6, 0.4], 2.2));
const legT = ([hip, knee, foot, r]) => any(limb(hip, knee, r * 1.4, r * 1.1), limb(knee, foot, r * 1.1, r * 0.6),
  spike(knee, [0, 0, 2], r * 0.6), spike(foot, [0, -1.4, -foot[2] + 0.05], r * 0.5));
const parts = [
  ['leg1*', scythe],
  ...LEGS.map((l, i) => [`leg${i + 2}*`, legT(l)]),
  ['body', any(plateT(PLATES.slice(0, 3)), orbT(ORBS.filter((o) => o[1] < 7)), ell([8, 8, 4], [0, -2, 6]))],
  ['abdomen', any(plateT(PLATES.slice(3)), orbT(ORBS.filter((o) => o[1] >= 7)), ell([8, 6, 4], [0, 10, 6]))],
  ['head', any(blob([[[6.4, 5, 5], [0, -11, 9]], [[4.6, 3.8, 3.6], [0, -15, 8]]]), ell([7, 4.4, 2.4], [0, -12, 13]),
    ...[1, -1].flatMap((s) => [limb([3.6 * s, -12, 13.6], [6 * s, -12, 16.6], 1.2, 0.8), limb([6 * s, -12, 16.6], [8 * s, -9, 18.4], 0.8, 0.2),
      spike([5.4 * s, -11.5, 10], [3.6 * s, 0.5, 1], 1.1), ell([2, 1.2, 1], [2.8 * s, -17.6, 10.2]), limb([2.4 * s, -17, 7], [3 * s, -18, 3.5], 0.9)]))],
];

function assign(c) {
  const f = fold(c);
  const S = side(c);
  const a = chainHit(f, ANT, ANT_R);
  if (a.d < 1.5 && f[2] > 12.2 && (f[1] < -15 || f[2] > 20)) return `ant${S}${Math.min(4, a.i + 1)}`;
  return pick(c, parts);
}

const clips = insectClips({ ant: 4, stride: 10, lift: 10 });

// fidget: the venom orbs swell and throb, it rears on its scythes and shakes them with a hiss
clips.idle_brandish = {
  seconds: 2.6,
  pose: (t, u) => {
    const up = K(u, [[0, 0], [0.2, 1], [0.7, 1], [0.85, 0]]);
    const shk = osc(u, 10) * win(u, 0.25, 0.68, 0.05);
    return merge({
      body: { r: [-8 * up, 0, 0], p: [0, 0, 1.2 * up] },
      abdomen: { s: 1 + 0.04 * (osc(u, 4) * 0.5 + 0.5) * up },
      head: { r: [-6 * up, 0, 3 * shk] },
      leg1L: { r: [-30 * up, -30 * up + 6 * shk, 0] },
      leg1R: { r: [-30 * up, 30 * up + 6 * shk, 0] },
      antL1: { r: [-12 * up, 0, 0] },
      antR1: { r: [-12 * up, 0, 0] },
    });
  },
};

export default rigDef({ joints, assign, clips });
