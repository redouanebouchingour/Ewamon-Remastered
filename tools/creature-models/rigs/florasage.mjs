// Florasage's rig: an upright leaf dragon with antlers, two huge fans of leaf wings, a thick tail that curls into an
// upright coil behind it on its left (+X), and a thin vine tail on its right (-X) that rises into a big sunflower.
// The coil rests on the ground, so it only breathes a little; the vine's sunflower nods, sways and spins. Numbers are
// scad/florasage.scad's (its S() turns art sheet readings into scad points; the same function is here).
import { K, both, merge, osc, rigDef, smooth } from './lib/anim.mjs';
import { any, bipedClips, chain, ell, limb, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near, side } from './lib/geo.mjs';

const X0 = -1.5;
const G = 4.8;
const S = (sx, sz, y) => { const x = (sx - X0 - 0.5 * y) / 0.866; return [x, y, sz - G - 0.17 * (-0.5 * x + 0.866 * y)]; };

const SKIN = [0.37, 0.51, 0.28];
const LEAVES = [[0.37, 0.53, 0.28], [0.45, 0.62, 0.31], [0.22, 0.33, 0.2], [0.17, 0.26, 0.16]];
const FLOWER = [[0.95, 0.6, 0.24], [0.8, 0.36, 0.14], [0.4, 0.24, 0.13], [0.7, 0.5, 0.3]];
const ANTLER = [0.56, 0.4, 0.28];

const TAIL = [S(0.5, 10.4, 3.0), S(4.5, 11.6, 4.5), S(9, 13.0, 5.5), S(13, 13.7, 6), S(16, 13.2, 6), S(17.1, 11.4, 6),
  S(16.2, 9.6, 6), S(13.7, 9.0, 6), S(11.2, 9.6, 6), S(10.1, 11.0, 6), S(10.9, 12.3, 6)];
const TAIL_R = [3.1, 2.7, 2.5, 2.3, 2.1, 1.9, 1.7, 1.5, 1.3, 1.0, 0.7];
const VINE = [[-2.2, 4.2, 3.0], S(-6, 8.0, 3), S(-10, 8.4, 2.5), S(-13, 9.2, 2), S(-14.9, 10.6, 2), S(-15.4, 12.4, 2), S(-15.3, 14.6, 2)];
const VINE_R = [1.8, 1.4, 1.15, 0.95, 0.75, 0.6, 0.5];
const FLOWER_C = S(-15.3, 15.3, 1.6);
const WROOT = [3.0, 2.6, 17.4];

const eyeL = { side: 'L', at: [1.6, -4.55, 24.15], size: 1.1, yaw: 26, flat: 0.5 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: SKIN });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4.1, 0, 7.6]),
  { name: 'body', parent: 'root', at: [0, 1, 6] },
  { name: 'head', parent: 'body', at: [0, -1.6, 20.6] },
  { name: 'armL', parent: 'body', at: [4.0, -0.8, 16.6] },
  { name: 'armR', parent: 'body', at: [-4.0, -0.8, 16.6] },
  { name: 'foreL', parent: 'armL', at: [5.0, -1.6, 12.6] },
  { name: 'foreR', parent: 'armR', at: [-6.8, -1.2, 12.2] },
  ...pair('wing*', 'body', WROOT),
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[2] },
  { name: 'tail3', parent: 'tail2', at: TAIL[4] },
  { name: 'tail4', parent: 'tail3', at: TAIL[7] },
  { name: 'vine1', parent: 'body', at: VINE[0] },
  { name: 'vine2', parent: 'vine1', at: VINE[2] },
  { name: 'flower', parent: 'vine2', at: VINE[5], rot: [90, 0, 30] },   // local z is the flower's axis
  ...face.joints,
];

const TOR = [[[5.0, 4.6, 4.6], [0, 1.5, 7.5]], [[4.8, 4.4, 5.0], [0, -0.4, 12.5]], [[4.2, 3.9, 3.9], [0, -1.2, 17]]];
const parts = [
  ['leg*', any(ell([2.9, 3.8, 4.0], [4.1, 0.0, 6.6]), limb([4.3, -1.6, 4.2], [4.0, -0.6, 1.3], 1.7, 1.25),
    limb([4.0, -0.4, 0.95], [3.6, -3.4, 0.8], 1.3, 1.2), limb([3.6, -3.4, 0.8], [3.6, -5.2, 0.4], 0.6, 0.3))],
  ['body', any(...TOR.map(([r, p]) => ell(r, p)), ell([3.3, 2.3, 7.6], [0, -2.9, 12.6]), limb([0, -1.2, 18.5], [0, -2.1, 22.2], 3.1, 2.6),
    limb([0, 1.6, 20.2], [0, 5.8, 6.2], 0.9, 0.9), limb([0, 5.8, 6.2], [0, 7.4, 6.4], 0.8, 0.3))],
  ['head', any(ell([2.6, 3.1, 3.0], [0, -2.2, 24.2]), limb([0, -4.6, 23.3], [0, -7.6, 22.9], 1.75, 1.15),
    ell([2.1, 2.6, 1.3], [0, -4.3, 21.6]), limb([0, -3.4, 26.0], [0, -1.4, 27.9], 1.2, 0.5),
    limb([0, -0.2, 27.2], [0, 1.3, 27.8], 0.9, 0.3), limb([1.3, 0.2, 25.8], [2.2, 1.8, 25.8], 0.9, 0.3),
    limb([-1.3, 0.2, 25.8], [-2.2, 1.8, 25.8], 0.9, 0.3), limb([0, 0.4, 24.6], [0, 2.3, 24.8], 0.9, 0.3),
    limb([2.4, -1.2, 25.1], [4.4, 0.1, 25.6], 0.8, 0.2), limb([-2.4, -1.2, 25.1], [-4.4, 0.1, 25.6], 0.8, 0.2))],
  ['armL', limb([4.0, -0.8, 16.6], [5.0, -1.6, 12.6], 1.45, 1.2)],
  ['foreL', any(limb([5.0, -1.6, 12.6], [2.8, -4.2, 9.6], 1.2, 0.95), limb([2.6, -4.9, 9.0], [2.5, -5.4, 8.2], 0.6, 0.3))],
  ['armR', limb([-4.0, -0.8, 16.6], [-6.8, -1.2, 12.2], 1.45, 1.2)],
  ['foreR', any(limb([-6.8, -1.2, 12.2], [-8.6, -3.3, 9.4], 1.2, 0.95), limb([-8.9, -3.9, 8.7], [-9.0, -4.3, 7.8], 0.6, 0.3))],
  ['wing*', limb([WROOT[0] - 2.6, WROOT[1], WROOT[2] - 1.2], [WROOT[0] + 2.2, WROOT[1], WROOT[2] + 0.4], 1.6, 1.3)],
  ...chain(['tail1', 'tail1', 'tail2', 'tail2', 'tail3', 'tail3', 'tail3', 'tail4'], TAIL, TAIL_R),
  ...chain(['vine1', 'vine1', 'vine2', 'vine2', 'vine2', 'flower'], VINE, VINE_R),
];

function assign(c, rgb) {
  if (FLOWER.some((f) => near(rgb, f, 0.015))) {
    if (c[0] < -10 && c[2] < 15.5) return 'flower';                         // the vine's sunflower
    return `wing${side(c)}`;                                               // the sunflowers set in the wings
  }
  if (isAny(rgb, LEAVES, 0.015)) {
    if (c[0] < -9 && c[2] < 10) return 'vine2';                            // the two small leaves on the vine
    if (Math.abs(c[0]) > 2.5 && c[2] > 10) return `wing${side(c)}`;
  }
  if (near(rgb, ANTLER, 0.015)) return 'head';
  const j = pick(c, parts);
  // the neck: the head takes it above its pivot
  if ((j === 'body' || j === 'head') && Math.abs(c[0]) < 3.4 && c[1] < 1 && c[2] > 18) return c[2] > 20.8 ? 'head' : 'body';
  return j;
}

// the coil breathes; the vine sways and its sunflower nods
const coil = (u, cycles, amp = 1) => ({
  tail1: { r: [0, 0, 1.2 * amp * osc(u, cycles)] },
  tail2: { r: [0, 0, 1.6 * amp * osc(u, cycles, -0.1)] },
  tail3: { r: [-1.5 * amp * osc(u, cycles, -0.2), 0, 2 * amp * osc(u, cycles, -0.2)] },
  tail4: { r: [-3 * amp * osc(u, cycles, -0.3), 0, 0] },
  vine1: { r: [0, 0, 1.5 * amp * osc(u, cycles, 0.2)] },
  vine2: { r: [0, 0, 2.5 * amp * osc(u, cycles, 0.1)] },
  flower: { r: [5 * amp * osc(u, cycles, -0.4), 4 * amp * osc(u, cycles, -0.15), 0] },
});

const base = bipedClips({
  face, hipH: 7.6, stride: 18, armSwing: 14, hopScale: 0.4, hopH: 3,
  wing: { open: [0, -12, -16], flap: 12 },
  cheer: { arm: [-80, -40, 0], fore: [-20, 0, 0] },
  punch: { arm: [-60, 10, 0], fore: [-30, 0, 0] },
  add: {
    idle: (t, u) => coil(u, 1),
    walk: (t, u) => coil(u, 1, 2),
    idle_look: (t, u) => coil(u, 1),
    lunge: (t, u) => merge(coil(u, 1, 2), { flower: { r: [0, 0, 120 * K(u, [[0.1, 0], [0.5, 1]])] } }),
    hurt: (t, u) => coil(u, 2, 2.5),
    faint: (t, u) => { const d = smooth((u - 0.2) / 0.6); return { vine2: { r: [0, 0, -6 * d] }, flower: { r: [30 * d, 0, 0] } }; },
    celebrate: (t, u) => merge(coil(u, 2, 2), { flower: { r: [0, 0, 360 * smooth(u)] } }),
    enter: (t, u) => ({ flower: { r: [0, 0, 180 * smooth((u - 0.2) / 0.6)] } }),
  },
});

const clips = {
  ...base,

  // fidget: basks in the sun, wings fanned wide, face up, eyes shut, the vine's sunflower turned up beside it
  idle_bask: {
    seconds: 3,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.78, 1], [0.95, 0]]);
      return merge({
        ...face.pose(on > 0.5 ? 'happy' : 'open'),
        body: { r: [-4 * on, 0, 0] },
        head: { r: [-18 * on, 0, 6 * on] },
        ...both('wing', { r: [0, -14 * on + 2 * osc(u, 3) * on, -12 * on] }),
        ...both('arm', { r: [0, -12 * on, 0] }),
        vine2: { r: [0, 0, 4 * on] },
        flower: { r: [-20 * on, 0, 0] },
      }, coil(u, 1));
    },
  },

  // fidget: turns to the sunflower on its vine, sniffs it and spins it once
  idle_sniff: {
    seconds: 2.6,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.18, 1], [0.8, 1], [0.95, 0]]);
      const spin = 360 * smooth((u - 0.4) / 0.35);
      return {
        ...face.pose('open', blinks(u, [[0.3, 0.38]])),
        head: { r: [10 * on, 0, -28 * on] },
        body: { r: [0, 0, -6 * on] },
        vine2: { r: [0, 0, 10 * on] },
        flower: { r: [-10 * on, 0, spin] },
        ...both('wing', { r: [0, 3 * osc(u, 2), 0] }),
      };
    },
  },
};

// the coil and the vine lie on the ground: their first links undo the root's and the body's pitch and roll (and half
// the yaw), so a lunge or a faint does not lift them off the ground behind or push them into it
for (const c of Object.values(clips)) {
  const f = c.pose;
  c.pose = (t, u) => {
    const p = f(t, u);
    const r = [0, 1, 2].map((i) => (p.root?.r?.[i] ?? 0) + (p.body?.r?.[i] ?? 0));
    const undo = { r: [-r[0], -r[1], -0.5 * r[2]] };
    return merge(p, { tail1: undo, vine1: undo });
  };
}

export default rigDef({ joints, assign, extras: face.extras, clips });
