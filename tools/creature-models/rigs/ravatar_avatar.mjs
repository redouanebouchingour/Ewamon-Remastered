// Ravatar (avatar relic)'s rig: all four relics on Ravatar's body (rigs/ravatar.mjs). The water wave arcing round its
// right side and its curl are one joint (`wave`, off the root) that surges, the fire on its left fist is `flameL` (off
// the hand) and flickers, the starry cloud over the head drifts (`cloud`, off the head), and the six floating boulders
// (rock1..6, off the root) bob on their own. Numbers are scad/ravatar_avatar.scad's.
import { TAU, hash, osc, rigDef, win } from './lib/anim.mjs';
import { any, ell, limb, pick } from './lib/biped.mjs';
import { isAny } from './lib/geo.mjs';
import { baseJoints, baseParts, clipsFor, faceFor } from './ravatar.mjs';

const FUR = [0.96, 0.92, 0.84];
const WATER = [[0.35, 0.62, 0.86], [0.75, 0.9, 1]];
const FLAME = [[0.92, 0.22, 0.06], [1, 0.55, 0.1], [1, 0.9, 0.45]];
const STAR = [1, 0.8, 0.4];
const ROCKS = [[-15, -2, 30, 1.4], [-11, -3, 5, 1.6], [13, -3, 4, 1.4], [-16, -1, 2, 1.2], [15, 0, 26, 1], [-8, -4, 34, 1]];
const rocks = ROCKS.map((_, i) => `rock${i + 1}`);
const CLOUD = [[0, 3, 44, 3.6], [4, 4, 44.5, 3], [7.5, 4, 43, 2.6], [-3, 3.5, 43.5, 2.6], [10.5, 3.5, 41, 2]];

const face = faceFor(FUR);
const joints = [...baseJoints,
  { name: 'flameL', parent: 'handL', at: [11, -1.8, 15] },
  { name: 'cloud', parent: 'head', at: [3, 3.5, 42] },
  { name: 'wave', parent: 'root', at: [0, 3, 20] },
  ...ROCKS.map((b, i) => ({ name: rocks[i], parent: 'root', at: [b[0], b[1], b[2]] })),
  ...face.joints];

const parts = [
  ...baseParts,
  ['cloud', any(...CLOUD.map(([x, y, z, r]) => ell([r * 1.2, r, r * 0.8], [x, y, z])))],
  ...ROCKS.map((b, i) => [rocks[i], ell([1.2 * b[3], 0.9 * b[3], b[3]], [b[0], b[1], b[2]])]),
];

function assign(c, rgb) {
  if (isAny(rgb, WATER)) {
    if (c[0] < -6) return 'wave';
    if (c[2] < 1) return 'root';   // the splashes under the feet
  }
  if (isAny(rgb, FLAME) && c[0] > 6) return 'flameL';
  if (isAny(rgb, [STAR])) return 'cloud';
  return pick(c, parts);
}

// the rocks bob on their own phases; the wave surges and the flame flickers on beats counted in u
const float = (u, amp = 0.8, cycles = 1) => Object.fromEntries(rocks.map((n, i) => [n, { p: [0, 0, amp * osc(u, cycles, i / 6)], r: [8 * osc(u, cycles, i / 5), 0, 14 * osc(u, cycles, i / 7)] }]));
const fx = (u, steps, cycles, k = 1, flame = 1) => {
  const i = Math.floor(u * steps) % steps;
  const a = (n) => flame * (1 + k * 0.2 * (hash(i * 5 + n) - 0.5));
  return {
    flameL: { s: [a(1), a(2), a(3)] },
    wave: { r: [0, 6 * k * osc(u, cycles), 0], s: 1 + 0.03 * k * osc(u, cycles, 0.25) },
    cloud: { p: [0.4 * osc(u, cycles), 0, 0.3 * osc(u, cycles, 0.25)], r: [0, 0, 6 * osc(u, cycles)] },
    ...float(u, 0.8 * k, cycles),
  };
};
const clips = clipsFor({
  face,
  extra: {
    idle: (t, u) => fx(u, 40, 1),
    walk: (t, u) => fx(u, 8, 1, 0.6),
    idle_look: (t, u) => fx(u, 24, 1),
    windup: (t, u) => fx(u, 4, 0, 1, 1 + 0.3 * u),
    lunge: (t, u) => ({ ...fx(u, 6, 1, 1.5, 1 + 0.4 * win(u, 0.25, 0.8, 0.1)), wave: { r: [0, -15 * win(u, 0.2, 0.8, 0.15), 0] } }),
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
      armL: { r: [-20 * on, -45 * on, 0] }, armR: { r: [-20 * on, 45 * on, 0] },
      foreL: { r: [-20 * on, 0, 0] }, foreR: { r: [-20 * on, 0, 0] },
      wave: { r: [0, -10 * on, 0], s: 1 + 0.06 * on },
      cloud: { s: 1 + 0.15 * on },
      ...Object.fromEntries(rocks.map((n, i) => [n, { p: [-0.25 * ROCKS[i][0] * on, 0, (1.5 + 0.8 * osc(u, 2, i / 6)) * on], r: [0, 0, 120 * on * (i % 2 ? 1 : -1) * Math.sin(TAU * u / 2)] }])),
    };
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
