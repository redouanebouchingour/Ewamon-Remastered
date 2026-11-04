// Galeforth's rig: Gustling grown into a proud raptor. A scowling head turned to its right with one long crest blade,
// a red scarf with its ends streaming out, broad half-open wings, two tail streamers ending in red tufts. Numbers are
// scad/galeforth.scad's (sprite-matched 2026-11-04): the head block is `translate(HEAD_T) rotate([0, 0, HEAD_YAW])`,
// each wing `translate(WING_AT + [0, 0, WING_PIV]) rotate([0, WING_TILT, WING_YAW]) translate([0, 0, -WING_PIV])`
// with its pillow outline and feathers in that frame.
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { any, chain, ell, inFrame, limb, pair, petal, pick, slab } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { subFrame } from './lib/geo.mjs';

const TAN = [0.88, 0.68, 0.35];

const headF = subFrame([0, -2, 0], [0, 0, -25]);
const wingF = subFrame([6, -3, 23], [0, -6, 10]);
// a test written in the wing's own numbers (its z is the scad z: the frame's origin is the shoulder at z 23)
const inWing = (test) => (c) => { const l = wingF.local(c); return test([l[0], l[1], l[2] + 23]); };
const wingW = (p) => wingF.world([p[0], p[1], p[2] - 23]);
const CREST = [[0, -3, 35.6], [0.3, 1, 37.1], [1.2, 5.3, 38.4], [2.5, 9.2, 37.9], [3.3, 11.5, 36.4], [3.8, 12.5, 34.1], [4, 12.6, 32.6]];
const CREST_W = [2.1, 1.9, 1.7, 1.45, 1.15, 0.75, 0.25];
const SCARF_A = [[5.5, -2.6, 26.6], [9, -1.5, 28], [12.5, 0.5, 28.6], [16, 2, 29.6]];
const SCARF_AW = [1.5, 1.8, 1.6, 1.3];
const SCARF_B = [[5.5, -2.6, 25.6], [8.5, -1.5, 24.8], [11.5, 0, 25.2], [15, 1.5, 25.6]];
const SCARF_BW = [1.4, 1.6, 1.5, 1.2];
const TAIL_A = [[3, 5.5, 12], [8.4, 7.5, 15.1], [10.7, 8.5, 16.7], [13.3, 9, 17.1], [15, 9, 16.75]];
const TAIL_AR = [0.8, 0.65, 0.6, 0.6, 0.6];
const TUFT_A = [[15, 9, 16.75], [16.8, 9, 16.6], [17.7, 9, 15.4], [17.3, 9, 14], [16.4, 9, 13.6]];
const TUFT_AR = [0.8, 1.45, 1.4, 0.95, 0.35];
const TAIL_B = [[2.5, 5.5, 10.5], [9.8, 8, 12.7], [12.7, 8, 11.7], [16.2, 8, 11.2], [17.9, 8, 9.3], [16.7, 8, 7.4]];
const TAIL_BR = [0.8, 0.65, 0.6, 0.6, 0.6, 0.65];
const TUFT_B = [[16.7, 8, 7.4], [15.7, 8, 5.6], [15.3, 8, 3.9], [15.9, 8, 3]];
const TUFT_BR = [1.0, 1.6, 1.2, 0.35];
const WING_UP = [[0.3, 22], [1, 24.4], [2.6, 25.4], [4.2, 24.8], [6.2, 22], [8.3, 18.5], [9.8, 15.5], [7.5, 14], [4, 13.8],
  [1, 15], [-0.3, 17.5]];
const FEATHERS = [[1.6, 1.3, [0.9, 7]], [3.4, 3.6, [3.8, 5]], [5.2, 5.9, [6.6, 3.8]], [7, 8.2, [9.3, 4]], [8.6, 10.2, [11.7, 6.2]]];
// each primary as two capsules in the wing's (u, y, z): root (z 18.5) to the band (z 10.5) to the tip
const feathers = FEATHERS.flatMap(([r, m, t], i) => {
  const y = 0.12 * (i - 2);
  return [limb([r, y, 18.5], [m, y, 10.5], 1.0, 1.45), limb([m, y, 10.5], [t[0], y, t[1]], 1.45, 0.3)];
});
const trail = ['scarfA', 'scarfB', 'tailA', 'tailB'].map((n) => [1, 2, 3].map((i) => `${n}${i}`));

const eyeL = { side: 'L', at: [2.7, -4.1, 30.3], size: 1.75, yaw: 30, flat: 0.5, frame: headF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: TAN });

const crestW = CREST.map(headF.world);
const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [5, 0.8, 9.5]),
  { name: 'body', parent: 'root', at: [0, 0, 8] },
  { name: 'head', parent: 'body', at: [0, -1.5, 27.5] },
  { name: 'crest1', parent: 'head', at: crestW[0] },
  { name: 'crest2', parent: 'crest1', at: crestW[2] },
  { name: 'crest3', parent: 'crest2', at: crestW[4] },
  ...pair('wing*', 'body', wingW([1, 0, 23])),
  ...[SCARF_A, SCARF_B].flatMap((pts, k) => trail[k].map((name, i) => ({ name, parent: i === 0 ? 'body' : trail[k][i - 1], at: pts[i] }))),
  ...[[TAIL_A, 0, 2, 4], [TAIL_B, 0, 2, 4]].flatMap(([pts, ...ix], k) => trail[k + 2].map((name, i) => ({ name, parent: i === 0 ? 'body' : trail[k + 2][i - 1], at: pts[ix[i]] }))),
  ...face.joints,
];

const toes = [-45, 0, 45].map((a) => {
  const r = (a * Math.PI) / 180;
  return limb([5.4, 0.4, 1.1], [5.4 + Math.sin(r) * 3.6, 0.4 - Math.cos(r) * 3.6, 0.7], 0.8, 0.55);
});
const fringe = [];
for (let a = -100; a <= 100; a += 25) {
  const r = (a * Math.PI) / 180;
  fringe.push(petal([1.9, 0.9, 1.6], [Math.sin(r) * 5.2, -Math.cos(r) * 4.9 + 0.5, 9.2], [25, 0, a]));
}
const ribbon = (names, pts, ws) => chain(names, pts, ws.map((w) => w * 0.6));
const parts = [
  ['leg*', any(ell([2.6, 2.8, 2.8], [5, 0.8, 9.5]), limb([5.2, 0.6, 9], [5.4, 0.4, 1.4], 1.1, 0.9), ...toes, limb([5.4, 0.4, 1.1], [5.4, 2.4, 0.7], 0.7, 0.5))],
  ['body', any(ell([7.2, 6.5, 6.3], [0, 0.5, 14]), ell([5.4, 4.6, 6], [0, -2, 17.5]), ell([5.6, 5.2, 4.5], [0, 0, 21.5]), ell([4, 4, 3], [0, -0.5, 25]),
    limb([0, 0.5, 14], [0, 0, 21.5], 6.5, 5.4), ell([5.4, 5.2, 2.1], [0, -0.3, 26.4]), ell([1.6, 1.4, 1.5], [5, -2.6, 26]), ...fringe)],
  ['head', inFrame(headF, any(ell([5, 5.6, 5.3], [0, 0.3, 31.6]), ell([3.7, 3.4, 3.3], [0, -2.4, 30]),
    limb([0, -4.9, 29.9], [0, -6.9, 29.5], 1.4, 0.8), limb([0, -6.9, 29.5], [0, -7.5, 28.1], 0.8, 0.3), limb([0, -5, 28.6], [0, -6.4, 28.3], 0.8, 0.4),
    ...[[-1.6, 34.4], [1.6, 34.4], [0, 32.4], [0, 35.8]].map(([x, z]) => petal([0.9, 2.3, 0.6], [x, 5.3, z], [-18, 0, 0]))))],
  ...chain(['crest1', 'crest1', 'crest2', 'crest2', 'crest3', 'crest3'], CREST, CREST_W.map((w) => w * 0.7)).map(([n, t]) => [n, inFrame(headF, t)]),
  ['wing*', inWing(any(slab(WING_UP, 2, 1.6), ...feathers))],
  ...ribbon(trail[0], SCARF_A, SCARF_AW),
  ...ribbon(trail[1], SCARF_B, SCARF_BW),
  ...chain(['tailA1', 'tailA1', 'tailA2', 'tailA2'], TAIL_A, TAIL_AR),
  ...chain(['tailA3'], TUFT_A, TUFT_AR),
  ...chain(['tailB1', 'tailB1', 'tailB2', 'tailB2', 'tailB3'], TAIL_B, TAIL_BR),
  ...chain(['tailB3'], TUFT_B, TUFT_BR),
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
