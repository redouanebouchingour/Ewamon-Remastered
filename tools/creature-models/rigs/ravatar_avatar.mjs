// Ravatar (avatar relic)'s rig: all four relics on Ravatar's body (rigs/ravatar.mjs). The left arm is raised out
// to the side (foreL / handL moved to the scad's ELBOW_A / WRIST_A) and its blazing fist is `flameL` (off the hand),
// which flickers; the water ring with its curl is one joint (`wave`, off the root) that surges; the starry cloud from
// the crown drifts (`cloud`, off the head); the cloud tail is tail1..tail4 (no fifth link); the seven floating
// boulders (rock1..7, off the root) bob on their own. Numbers are scad/ravatar_avatar.scad's.
import { TAU, hash, osc, rigDef, win } from './lib/anim.mjs';
import { limb, pick } from './lib/biped.mjs';
import { fold, isAny, rot } from './lib/geo.mjs';
import { ELBOW, HAND, SHOULDER, TAIL, WRIST, armTests, baseJoints, bodyParts, clipsFor, faceFor } from './ravatar.mjs';

const FUR = [0.9, 0.79, 0.64];
const ELBOW_A = [13.2, -2.4, 19.8];
const WRIST_A = [16.8, -4.6, 18.8];
const HAND_A = [17.8, -5.6, 18.4];
const WATER = [[0.2, 0.36, 0.55], [0.5, 0.67, 0.8], [0.78, 0.94, 0.98]];
const FLAME = [[0.72, 0.14, 0.04], [0.95, 0.5, 0.15], [1, 0.88, 0.55]];
const CLOUD = [[0.42, 0.44, 0.54], [0.66, 0.64, 0.72], [0.82, 0.83, 0.88], [1, 0.85, 0.5]];
const ROCKC = [[0.4, 0.3, 0.26], [0.28, 0.21, 0.19]];
const GROUND = 2;
// pp(d) on the art: art x, depth, art z -> the scad frame
const art = (x, d, z) => rot([0, 0, 30], [x, d, z - GROUND]);
const ROCKS = [[-16.5, 33.5, -1, 1.3], [-12, 36.5, 2, 0.9], [-19, 14, 1, 1.1], [-15, 9, -2, 1.6], [17.5, 13, -1, 1.1],
  [15, 8.5, 2, 1.2], [19, 4.5, -2, 1.4]].map(([x, z, d, r]) => [art(x, d, z), r]);
const rocks = ROCKS.map((_, i) => `rock${i + 1}`);
const CLOUD_TAIL = [[[2, 3.6, 10.8], 2.4], [[6, 6, 7.4], 3.4], [[11, 6, 7], 4], [[16, 4.5, 9.6], 4], [[17, 3, 13.4], 2.6]];
const tails = ['tail1', 'tail2', 'tail3', 'tail4'];

const face = faceFor(FUR);
const joints = [
  ...baseJoints.filter((j) => j.name !== 'tail5').map((j) => (j.name === 'foreL' ? { ...j, at: ELBOW_A } : j.name === 'handL' ? { ...j, at: WRIST_A } : j)),
  { name: 'flameL', parent: 'handL', at: HAND_A },
  { name: 'cloud', parent: 'head', at: [0, 0.5, 33] },
  { name: 'wave', parent: 'root', at: art(-1, 2, 21) },
  ...ROCKS.map(([p], i) => ({ name: rocks[i], parent: 'root', at: p })),
  ...face.joints,
];

// the right arm keeps the base pose (folded numbers, x < 0 only); the left one is raised
const onR = (t) => (c) => (c[0] < 0 ? t(fold(c)) : Infinity);
const onL = (t) => (c) => (c[0] >= 0 ? t(c) : Infinity);
const R = armTests(SHOULDER, ELBOW, WRIST, HAND);
const L = armTests(SHOULDER, ELBOW_A, WRIST_A, HAND_A);
const parts = [
  ...bodyParts.filter(([n]) => !['arm*', 'fore*', 'hand*'].includes(n)),
  ['armR', onR(R.arm)], ['foreR', onR(R.fore)], ['handR', onR(R.hand)],
  ['armL', onL(L.arm)], ['foreL', onL(L.fore)], ['handL', onL(L.hand)],
];
const tailParts = CLOUD_TAIL.slice(1).map(([p, r], i) => [tails[i], limb(CLOUD_TAIL[i][0], p, CLOUD_TAIL[i][1] + 1.5, r + 1.5)]);
const near = (c, p) => Math.hypot(c[0] - p[0], c[1] - p[1], c[2] - p[2]);

function assign(c, rgb) {
  if (isAny(rgb, WATER, 0.03)) return 'wave';
  if (isAny(rgb, FLAME, 0.03)) return near(c, HAND_A) < 13 ? 'flameL' : 'cloud';
  if (isAny(rgb, CLOUD, 0.03)) return c[2] > 22 ? 'cloud' : pick(c, tailParts);
  if (isAny(rgb, ROCKC, 0.02)) {
    const i = ROCKS.findIndex(([p, r]) => near(c, p) < 2.2 * r);
    if (i >= 0) return rocks[i];
  }
  return pick(c, parts);
}

// the rocks bob on their own phases; the wave surges and the flame flickers on beats counted in u
const float = (u, amp = 0.8, cycles = 1) => Object.fromEntries(rocks.map((n, i) => [n, { p: [0, 0, amp * osc(u, cycles, i / 7)], r: [8 * osc(u, cycles, i / 5), 0, 14 * osc(u, cycles, i / 7)] }]));
const fx = (u, steps, cycles, k = 1, flame = 1) => {
  const i = Math.floor(u * steps) % steps;
  const a = (n) => flame * (1 + k * 0.2 * (hash(i * 5 + n) - 0.5));
  return {
    flameL: { s: [a(1), a(2), a(3)] },
    wave: { r: [0, 4 * k * osc(u, cycles), 0], s: 1 + 0.03 * k * osc(u, cycles, 0.25) },
    cloud: { p: [0.4 * osc(u, cycles), 0, 0.3 * osc(u, cycles, 0.25)], r: [0, 0, 5 * osc(u, cycles)] },
    ...float(u, 0.8 * k, cycles),
  };
};
const clips = clipsFor({
  face,
  opts: { tail: tails },
  extra: {
    idle: (t, u) => fx(u, 40, 1),
    walk: (t, u) => fx(u, 8, 1, 0.6),
    idle_look: (t, u) => fx(u, 24, 1),
    windup: (t, u) => fx(u, 4, 0, 1, 1 + 0.3 * u),
    lunge: (t, u) => ({ ...fx(u, 6, 1, 1.5, 1 + 0.4 * win(u, 0.25, 0.8, 0.1)), wave: { r: [0, -12 * win(u, 0.2, 0.8, 0.15), 0] } }),
    hurt: (t, u) => fx(u, 5, 2, 1.6, 0.85),
    recoil: (t, u) => fx(u, 5, 1, 1, 0.9),
    faint: (t, u) => ({ ...fx(u, 18, 1, 1, 1 - 0.7 * win(u, 0.3, 1.5, 0.5)), wave: { s: 1 - 0.5 * win(u, 0.3, 1.5, 0.5) } }),
    celebrate: (t, u) => fx(u, 12, 2, 1.5, 1.25),
    enter: (t, u) => fx(u, 9, 1, 1, 0.3 + 0.8 * Math.min(1, u * 1.6)),
    exit: (t, u) => fx(u, 7, 1),
    idle_roar: (t, u) => fx(u, 48, 2, 2, 1 + 0.4 * win(u, 0.2, 0.75, 0.1)),
    idle_swish: (t, u) => fx(u, 52, 1),
  },
});

// fidget: it gathers the elements. Palms open wide, eyes shut, the wave rises, the cloud swells, the rocks lift and
// circle closer, then everything settles with a breath out
clips.idle_harmony = {
  seconds: 3,
  pose: (t, u) => {
    const on = win(u, 0.1, 0.85, 0.18);
    return {
      ...fx(u, 60, 2, 1, 1 + 0.3 * on),
      body: { r: [-3 * on, 0, 0] },
      head: { r: [-10 * on, 0, 0] },
      ...face.pose(on > 0.4 ? 'shut' : 'open', on * 2.5),
      armL: { r: [-10 * on, -15 * on, 0] }, armR: { r: [-20 * on, 45 * on, 0] },
      foreL: { r: [-10 * on, 0, 0] }, foreR: { r: [-20 * on, 0, 0] },
      wave: { r: [0, -8 * on, 0], s: 1 + 0.05 * on },
      cloud: { s: 1 + 0.12 * on },
      ...Object.fromEntries(rocks.map((n, i) => [n, { p: [-0.2 * ROCKS[i][0][0] * on, 0, (1.5 + 0.8 * osc(u, 2, i / 7)) * on], r: [0, 0, 120 * on * (i % 2 ? 1 : -1) * Math.sin(TAU * u / 2)] }])),
    };
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
