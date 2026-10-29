// Galeforth's rig: Gustling grown into a proud raptor. A scowling head with one long crest blade, a red scarf with its
// ends streaming out, broad half-open wings, two tail streamers ending in red tufts. Numbers are scad/galeforth.scad's
// (the pre sprite-accuracy model: re-rig when its new model lands).
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { any, chain, ell, inFrame, limb, pair, petal, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { subFrame } from './lib/geo.mjs';

const TAN = [0.8, 0.62, 0.36];

// the head block: translate([0, -1, 29]) scale(1.2) translate([0, 0, -29])
const headF = subFrame([0, -1, 29 - 1.2 * 29], [0, 0, 0], 1.2);
const CREST = [[0, -2.5, 37.5], [0.5, -1, 41.5], [2.5, 0.5, 44.5], [6, 2, 46], [10, 3.5, 45], [13, 4.5, 42.5], [14, 5, 39.5]];
const CREST_R = [1.6, 1.8, 1.8, 1.6, 1.3, 0.9, 0.3];
const SCARF_A = [[6, -2, 28], [10, -1, 29], [14, 0, 29.5], [17, 0.5, 30.5]];
const SCARF_B = [[6, -2, 27.5], [9.5, -0.5, 26], [13, 0.5, 26], [16, 1, 25]];
const TAIL_A = [[2, 6, 11], [8, 9, 12], [14, 9, 14], [18, 8, 13]];
const TAIL_B = [[1, 6, 10], [6, 9, 7], [11, 9, 5], [14, 8, 3]];
const CHAINS = [SCARF_A, SCARF_B, TAIL_A, TAIL_B];
const trail = ['scarfA', 'scarfB', 'tailA', 'tailB'].map((n) => [1, 2, 3].map((i) => `${n}${i}`));

const eyeL = { side: 'L', at: [2.1, -5.25, 33.4], size: 1.5, yaw: 14, frame: headF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: TAN });

const crestW = CREST.map(headF.world);
const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4, 0, 9]),
  { name: 'body', parent: 'root', at: [0, 0, 8] },
  { name: 'head', parent: 'body', at: [0, -1, 28.5] },
  { name: 'crest1', parent: 'head', at: crestW[0] },
  { name: 'crest2', parent: 'crest1', at: crestW[2] },
  { name: 'crest3', parent: 'crest2', at: crestW[4] },
  ...pair('wing*', 'body', [8.5, 1, 25]),
  ...CHAINS.flatMap((pts, k) => trail[k].map((name, i) => ({ name, parent: i === 0 ? 'body' : trail[k][i - 1], at: pts[i] }))),
  ...face.joints,
];

const parts = [
  ['leg*', any(ell([3, 3.2, 3.6], [4, 0, 9]), limb([4.2, -0.5, 6], [4.5, -1, 1.2], 1, 0.9), ell([4, 4.5, 1.4], [4.5, -1.2, 0.8]))],
  ['body', any(ell([8.5, 7.5, 9], [0, 0, 21]), ell([6.5, 6, 5], [0, 0.5, 12]), limb([0, 0.3, 12], [0, 0, 21], 6.5, 8.5),
    ell([6.5, 6.2, 2.3], [0, -0.5, 28]), ell([1.8, 1.6, 1.6], [5.5, -2, 28]), limb([0, -5, 27.8], [0, -6.2, 23], 1.5, 0.6))],
  ['head', inFrame(headF, any(ell([5.5, 5.5, 5.2], [0, -0.5, 33.5]), ell([3.8, 3.5, 3.4], [0, -3, 32]), limb([0, -6.2, 31.8], [0, -8.6, 30.6], 1.4, 0.4),
    ...[[-2, 32], [0, 34.5], [2, 32]].map(([x, z]) => spike([x, 3.8, z], [x * 0.5, 3, 1.5], 1.4))))],
  ...chain(['crest1', 'crest1', 'crest2', 'crest2', 'crest3', 'crest3'], CREST, CREST_R).map(([n, t]) => [n, inFrame(headF, t)]),
  ['wing*', any(ell([2.4, 5, 3.2], [8.5, 1, 25]), ell([1.7, 6.8, 5.5], [12.5, 2, 11]), limb([8.5, 1, 25], [12.5, 2, 11], 2.4, 2.2),
    ell([1.3, 2.7, 4.1], [10, -1.5, 20]), ...[0, 1, 2].flatMap((r) => [0, 1, 2].map((k) => ell([0.7, 1.4, 2], [11.2 + r * 0.6, -2.4 + k * 2.4 + (r % 2) * 1.2, 21 - r * 3.4]))),
    ...[0, 1, 2, 3, 4].map((i) => limb([12.6, -2.5 + i * 2, 9], [13.4 + i * 0.25, -1.7 + i * 2, 2.8 - (i % 2)], 1.1, 0.4)))],
  ...CHAINS.flatMap((pts, k) => chain(trail[k], pts, k < 2 ? [1.6, 1.8, 1.5, 0.6] : [1, 0.9, 0.8, 0.8])),
  ['tailA3', petal([1.6, 1.3, 2.8], [18.4, 8, 15], [0, -20, 0])],
  ['tailB3', petal([1.6, 1.3, 2.8], [14.4, 8, 1.6], [0, 15, 0])],
];

const clips = birdClips({ face, crest: ['crest1', 'crest2', 'crest3'], trail, flapUp: 45 });

// the scarf ends flutter all the time, faster in the wind of a walk
const flutter = (amp, cycles) => (t, u) => Object.fromEntries(trail.slice(0, 2).flatMap((ch, k) => ch.map((n, i) => [n, { r: [amp * osc(u, cycles, 0.1 * i + 0.3 * k), 0, 0] }])));
for (const [name, amp, cycles] of [['idle', 5, 4], ['walk', 10, 2], ['celebrate', 12, 4], ['idle_flap', 12, 6], ['hurt', 14, 3]]) {
  const base = clips[name].pose;
  clips[name].pose = (t, u) => merge(base(t, u), flutter(amp, cycles)(t, u));
}

// fidget: a fierce stare into the wind, wings opening half way, the scarf whipping, the crest raised
clips.idle_stare = {
  seconds: 2.6,
  pose: (t, u) => {
    const on = K(u, [[0, 0], [0.18, 1], [0.75, 1], [0.92, 0]]);
    return merge({
      body: { r: [-4 * on, 0, -8 * on] },
      head: { r: [-6 * on, 0, 18 * on] },
      crest1: { r: [-8 * on, 0, 0] },
      ...face.pose('open', 0.35 * on + blinks(u, [[0.86, 0.9]])),
      wingL: { r: [0, -30 * on, 0] },
      wingR: { r: [0, 30 * on, 0] },
    }, flutter(4 + 14 * on, 6)(t, u));
  },
};

// fidget: smooths its scarf with the beak, then a satisfied fluff
clips.idle_scarf = {
  seconds: 2.2,
  pose: (t, u) => {
    const dip = K(u, [[0, 0], [0.2, 1], [0.6, 1], [0.72, 0]]);
    const nib = osc(u, 8) * win(u, 0.22, 0.58, 0.04);
    const fluff = Math.sin(TAU * 9 * u) * win(u, 0.74, 0.95, 0.03);
    return merge({
      body: { r: [0, 6 * fluff, 0] },
      head: { r: [26 * dip + 4 * nib, 0, 30 * dip] },
      ...face.pose(dip > 0.5 ? 'shut' : 'open'),
      wingL: { r: [0, -10 * Math.abs(fluff), 0] },
      wingR: { r: [0, 10 * Math.abs(fluff), 0] },
    }, flutter(3 + 6 * Math.abs(fluff), 4)(t, u));
  },
};

export default rigDef({ joints, assign: (c) => pick(c, parts), extras: face.extras, clips });
