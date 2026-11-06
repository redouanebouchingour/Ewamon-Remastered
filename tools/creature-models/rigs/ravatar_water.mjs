// Ravatar (water relic)'s rig: Ravatar's body (rigs/ravatar.mjs) in pale aqua scale armour. The pauldrons ride the
// upper arms, the gauntlets the forearms, the water gloves the hands; the tail is a great wave: its sweep is
// tail1..tail4, its rising column tail5 and its curling crest (with the drops) tail6, which rolls; the stream round
// each hand (streamL / streamR, off the hands) and the whirl round each foot (whirlL / whirlR, off the legs) swirl.
// Numbers are scad/ravatar_water.scad's.
import { TAU, osc, rigDef, win } from './lib/anim.mjs';
import { any, blob, chain, ell, limb, mx, pair, pick } from './lib/biped.mjs';
import { isAny, rot } from './lib/geo.mjs';
import { ELBOW, HAND, SHOULDER, WRIST, baseJoints, bodyParts, clipsFor, faceFor, tails } from './ravatar.mjs';

const FUR = [0.77, 0.68, 0.54];
const WATERC = [[0.5, 0.72, 0.86], [0.3, 0.52, 0.7], [0.84, 0.96, 0.99]];
const STREAMC = [[0.22, 0.58, 0.98]];

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const lerp = (a, b, t) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);

const FOOT = [9.8, -1.6, 0];
const WAVE = [[1, 3.2, 11.5], [6, 6, 7.4], [11, 6, 7.2], [16, 4.5, 10.2], [18, 2.6, 14], [15.8, 2.6, 19.5], [14.6, 2.8, 25],
  [16.2, 2.6, 29], [19.6, 2.2, 30.6], [22.6, 2, 29.2], [23.2, 2, 26.6], [21.8, 2, 25.4]];
const WAVE_R = [2, 3.3, 4.2, 4.6, 4.6, 4.4, 3.8, 3.4, 3, 2.4, 1.6, 0.6];
const DROPS = [[25.4, 1.6, 31.4, 0.6], [24.8, 1, 27.6, 0.45], [20.4, 1.6, 33.2, 0.5], [26.2, 2, 25, 0.4], [13.6, 2, 31, 0.4]];
const BACKPLATE = [[[5.8, 1.8, 4.5], [0, 3.4, 23.5]], [[4.4, 1.5, 3], [0, 3, 17.6]]];
const ABPLATE = [[3.4, 1.6, 2.8], [0, -2.4, 17.4]];

// scad spiral(c, R, a0, a1, z0, dz, r0, r1, col, n): a thinning stream winding round the axis through c
const spiral = (c, R, a0, a1, z0, dz, r0, r1, n) => {
  const pts = []; const rs = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n; const a = ((a0 + (a1 - a0) * t) * Math.PI) / 180; const rr = R * (1 - 0.25 * t);
    pts.push(add(c, [rr * Math.cos(a), rr * Math.sin(a), z0 + dz * t])); rs.push(r0 + (r1 - r0) * t);
  }
  return any(...pts.slice(1).map((p, i) => limb(pts[i], p, rs[i] + 0.3, rs[i + 1] + 0.3)));
};
// scad shard(p, rot, w, t, h): a plate from p to its point h along the turned +Z
const shard = (p, r, w, h) => limb(p, add(p, rot(r, [0, 0, h])), w * 0.75, 0.3);

const WAVE_J = ['tail1', 'tail2', 'tail3', 'tail4', 'tail5', 'tail5', 'tail6'];
const waterParts = [
  ...chain(WAVE_J, WAVE, WAVE_R.map((r) => r * 1.1)),
  ...DROPS.map(([x, y, z, r]) => ['tail6', ell([r * 1.5, r * 1.5, r * 1.8], [x, y, z])]),
  ['whirl*', spiral(add(FOOT, [0.4, 0.4, 0]), 6.4, -40, 290, 0.4, 3.6, 0.6, 0.15, 16)],
  ['whirl*', spiral(add(FOOT, [0.4, 0.4, 0]), 4.6, 120, 420, 0.3, 1.4, 0.45, 0.12, 12)],
];
const S = SHOULDER; const E = ELBOW; const W = WRIST; const H = HAND;
const parts = [
  ...bodyParts,
  ['arm*', any(ell([3.4, 3.3, 2.4], add(S, [0.4, 0, 1.6])), shard(add(S, [0.6, -1.2, 2.6]), [10, 30, 0], 2.9, 6.2),
    shard(add(S, [1.6, 0.6, 2.4]), [-8, 42, 0], 2.7, 5.2), shard(add(S, [0.4, 1.6, 2.6]), [-18, 20, 0], 2.5, 4.8),
    ell([0.6, 0.5, 0.6], add(S, [1, -3.1, 1.6])))],
  ['fore*', any(ell([2.5, 2.5, 2.5], E), limb(lerp(E, W, 0.2), lerp(W, H, 0.3), 2.5, 3),
    shard(add(lerp(E, W, 0.7), [2.4, 0.2, -0.4]), [0, 28, 0], 2.8, 5.6), shard(add(W, [2.6, -0.6, -1.6]), [8, 62, 0], 2.3, 3.8),
    shard(add(lerp(E, W, 0.3), [1.6, 1.2, 0.6]), [-14, 16, 0], 2.2, 4.2), ell([0.6, 0.5, 0.6], add(lerp(E, W, 0.55), [0.2, -2.55, 0])))],
  ['hand*', ell([2.6, 2.3, 2.6], H)],
  ['body', any(mx(ell([3.1, 1.5, 2.3], [2.8, -3, 20.8])), mx(ell([0.6, 0.5, 0.6], [3.6, -3.4, 24.2])), ell([0.75, 0.6, 0.75], [0, -4.75, 22.5]),
    ell(...ABPLATE), ell([0.7, 0.6, 0.7], [0, -3.65, 15.4]), blob(BACKPLATE))],
];

function assign(c, rgb) {
  if (isAny(rgb, STREAMC, 0.03)) return c[0] >= 0 ? 'streamL' : 'streamR';
  if (isAny(rgb, WATERC, 0.03)) return pick(c, waterParts);
  return pick(c, parts);
}

const face = faceFor(FUR);
const joints = [
  ...baseJoints.map((j) => (j.name === 'tail5' ? { ...j, at: WAVE[4] } : j)),
  { name: 'tail6', parent: 'tail5', at: WAVE[6] },
  ...pair('stream*', 'hand*', add(H, [0.6, 0, 0])),
  ...pair('whirl*', 'leg*', add(FOOT, [0.4, 0.4, 0])),
  ...face.joints,
];
const waveTail = [...tails, 'tail6'];

// the crest rolls, the streams and whirls swirl (whole cycles per loop, so a loop's last frame equals its first)
const flow = (u, cycles, k = 1) => ({
  tail6: { r: [0, 10 * k * osc(u, cycles, 0.25), 4 * k * osc(u, cycles)] },
  streamL: { r: [0, 0, 25 * k * osc(u, cycles)] }, streamR: { r: [0, 0, -25 * k * osc(u, cycles)] },
  whirlL: { r: [0, 0, 20 * k * osc(u, cycles, 0.3)], s: [1 + 0.06 * k * osc(u, cycles), 1 + 0.06 * k * osc(u, cycles), 1] },
  whirlR: { r: [0, 0, -20 * k * osc(u, cycles, 0.3)], s: [1 + 0.06 * k * osc(u, cycles), 1 + 0.06 * k * osc(u, cycles), 1] },
});
const clips = clipsFor({
  face,
  opts: { tail: waveTail },
  extra: {
    idle: (t, u) => flow(u, 2),
    walk: (t, u) => flow(u, 1, 0.6),
    idle_look: (t, u) => flow(u, 1),
    windup: (t, u) => ({ ...flow(u, 1), tail6: { r: [0, -18 * u, 0] } }),
    lunge: (t, u) => ({ ...flow(u, 1, 1.4), tail6: { r: [0, 30 * win(u, 0.2, 0.8, 0.15), 0] } }),
    hurt: (t, u) => flow(u, 2, 1.5),
    recoil: (t, u) => flow(u, 1, 1.2),
    faint: (t, u) => flow(u, 1, 1 - 0.8 * win(u, 0.3, 1.5, 0.5)),
    celebrate: (t, u) => flow(u, 2, 2),
    enter: (t, u) => flow(u, 1),
    exit: (t, u) => flow(u, 1),
    idle_roar: (t, u) => flow(u, 3, 1.5),
    idle_swish: (t, u) => flow(u, 2),
  },
});

// fidget: it draws a slow circle of water with both palms, the crest winding up and unrolling
clips.idle_flow = {
  seconds: 2.8,
  pose: (t, u) => {
    const on = win(u, 0.08, 0.9, 0.15);
    const a = TAU * u;
    return {
      ...flow(u, 2, 1.2),
      body: { r: [0, 0, 8 * Math.sin(a) * on] },
      head: { r: [3 * on, 0, 10 * Math.sin(a) * on] },
      ...face.pose('open', 0.5 * on),
      armL: { r: [(-40 - 15 * Math.sin(a)) * on, -10 * on, 0] }, foreL: { r: [-35 * on, 0, 20 * Math.cos(a) * on] },
      armR: { r: [(-40 + 15 * Math.sin(a)) * on, 10 * on, 0] }, foreR: { r: [-35 * on, 0, 20 * Math.cos(a) * on] },
      streamL: { r: [0, 0, 360 * u * on] }, streamR: { r: [0, 0, -360 * u * on] },
      tail6: { r: [0, 40 * Math.sin(a) * on, 0] },
    };
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
