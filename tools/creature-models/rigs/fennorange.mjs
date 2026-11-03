// Fennorange's rig: a fennec kit hugging a big orange, in a fez, huge ears. The arms only hug, so they are paws the
// template does not swing (pawL / pawR); the orange, the fez and the two scarf ends are joints of their own. Numbers
// are scad/fennorange.scad's (remodelled to the sprite 2026-11-03).
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, inFrame, limb, mx, pair, pick, plate, slab, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near, rot, subFrame } from './lib/geo.mjs';

const FUR = [0.84, 0.70, 0.40];
const ORANGE = [0.96, 0.51, 0.07];
const FEZ = [[0.50, 0.10, 0.14], [0.36, 0.05, 0.09]];
const GREEN = [0.26, 0.38, 0.19];
const SCARF = [GREEN, [0.62, 0.14, 0.12]];
const FRUITC = [ORANGE, [1, 0.62, 0.16], [0.34, 0.5, 0.22]];
const INK = [0.12, 0.03, 0.01];
const tails = ['tail1', 'tail2'];

// the eyes: eye() inside translate(EYE) rotate([0, 0, 16]) scale([1.3, 1, 0.95]); the lids sized to that scale
const EYE = [4.55, -6.0, 22.6];
const eyeL = { side: 'L', at: EYE, size: 1.6, yaw: 16, flat: 0.5 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FUR, lid: [1.5, 1.1, 1.05] });

// the ear plate: translate([4.6, 0.6, 0]) rotate([0, 0, 22]) plate(EAR shifted by -2.78 in x)
const EAR = [[2.2, 27.5], [2.7, 30.4], [4.5, 32.2], [6.5, 33.5], [9, 34.8], [11.2, 35.6], [12, 37], [11, 38.3],
  [11.4, 39.2], [13.5, 38.9], [14.6, 37.5], [15, 35.5], [14.8, 33], [13.8, 30], [12.1, 26.6], [9.5, 24.6], [7, 23.2],
  [5.2, 23.5], [3.5, 25]].map(([x, z]) => [x - 2.78, z]);
const earFrame = subFrame([4.6, 0.6, 0], [0, 0, 22]);
// the tail plume: pp(2) translate([1.5, 0, 0]) slab(TAIL, 4.8)
const TAIL = [[5, 8], [5.6, 6.5], [8.3, 5.9], [11, 6.8], [13.1, 8.8], [13.9, 11.5], [13.9, 13.8], [13.3, 16], [13.1, 17.7],
  [15, 18.9], [13.9, 19.8], [11.6, 19.8], [8.9, 18.5], [7.3, 17], [6.5, 15.8], [6, 13], [5.6, 10.5]];
const tailFrame = subFrame(rot([0, 0, 30], [1.5, 2, 0]), [0, 0, 30]);
const FR = [-7.6, -2.6, 14.3];
const TORSO = [[[4.7, 4.1, 4.6], [0, 0.4, 10.5]], [[3.3, 3, 2.8], [0, 0, 15.2]], [[3.9, 3.6, 3.6], [0, -1.1, 8.6]]];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [3.3, 0.6, 7.2]),
  { name: 'body', parent: 'root', at: [0, 0, 7.2] },
  { name: 'orange', parent: 'body', at: FR },
  { name: 'scarf', parent: 'body', at: [4.2, -0.6, 17.2] },
  { name: 'scarfB', parent: 'body', at: [0, 3.3, 16.8] },
  ...pair('paw*', 'body', [3.4, -0.45, 15.25]),
  { name: 'head', parent: 'body', at: [0, -0.6, 17.4] },
  { name: 'fez', parent: 'head', at: [0.2, 0.4, 27.6] },
  ...pair('ear*', 'head', [4.8, 0.3, 26.8]),
  { name: 'tail1', parent: 'body', at: [1.2, 3.2, 6.5] },
  { name: 'tail2', parent: 'tail1', at: [8.5, 7.2, 11] },
  ...face.joints,
];

const parts = [
  ['leg*', any(ell([2.8, 3.1, 3.4], [3.3, 0.6, 7.2]), limb([3.9, 0.4, 5], [4.6, -0.4, 1.8], 1.8, 1.45), ell([1.9, 2.7, 1.15], [4.8, -1.3, 1.15]))],
  ['body', blob(TORSO)],
  ['head', any(
    ell([8, 6.4, 5.8], [0, -1, 23]), ell([7.5, 6.1, 3.6], [0, -1.4, 20.6]),
    blob([[[2.6, 2.2, 2], [0, -5.6, 20.4]], [[1.5, 1.3, 1.2], [0, -8.1, 20.5]]]), ell([0.8, 0.6, 0.55], [0, -9.35, 20.9]),
    mx(spike([7.2, -1.8, 21.8], [1.8, -0.2, -0.5], 1.1)), mx(spike([7, -1.4, 20.6], [1.3, 0, -1.1], 0.9)),
    mx(ell([2.6, 1.8, 2], EYE)),
  )],
  ['ear*', plate(EAR, 2, earFrame)],
  ['pawL', any(limb([3.4, -0.5, 15.3], [3.1, -3.6, 13], 1.55, 1.45), limb([3.1, -3.6, 13], [-2.2, -4.7, 13.6], 1.45, 1.3), ell([1.4, 1.3, 1.2], [-2.8, -4.6, 13.7]))],
  ['pawR', any(limb([-3.4, -0.4, 15.2], [-5, -0.8, 12.4], 1.4, 1.2), limb([-5, -0.8, 12.4], [-5.8, -1.6, 10.9], 1.2, 1.1), ell([1.2, 1.2, 1.05], [-6.1, -1.9, 10.6]))],
  ['tail1', limb([1.2, 3.2, 6.5], [4.5, 5.2, 7.8], 1.4, 2.2)],
  ['plume', slab(TAIL, 4.8, 1.6, tailFrame)],
];
const scarfParts = [
  ['scarf', inFrame(subFrame([5.3, -0.4, 15.4], [0, -30, 10]), ell([1.25, 0.5, 2.3]))],
  ['scarfB', inFrame(subFrame([0, 3.75, 13.6], [10, 0, 0]), ell([1.25, 0.5, 3.4]))],
  ['body', ell([4.3, 4, 1.75], [0, -0.2, 16.9])],
];

function assign(c, rgb) {
  if (isAny(rgb, FEZ)) return 'fez';
  if ((near(rgb, GREEN) || near(rgb, INK)) && c[2] > 28.5) return 'fez';           // the star and the tassel
  const dFruit = Math.hypot(c[0] - FR[0], c[1] - FR[1], c[2] - FR[2]);
  if (isAny(rgb, FRUITC) && dFruit < 8 && c[2] > 9.5 && c[0] < -2.5) return 'orange';
  if (near(rgb, GREEN) && c[0] < -5) return 'orange';                              // the calyx star and the stem
  if (isAny(rgb, SCARF)) return pick(c, scarfParts);
  const j = pick(c, parts);
  if (j === 'plume') return c[2] > 11.5 ? 'tail2' : 'tail1';
  return j;
}

const scarf = (u, cycles, amp = 1) => ({
  scarf: { r: [6 * amp * osc(u, cycles, 0.2), 4 * amp * osc(u, cycles, 0.45), 0] },
  scarfB: { r: [4 * amp * osc(u, cycles, 0.3), 0, 3 * amp * osc(u, cycles, 0.55)] },
});
const hug = (u, cycles, amp = 1) => ({ ...both('paw', { r: [2 * amp * osc(u, cycles), 0, 0] }), orange: { r: [0, 0, 1.5 * amp * osc(u, cycles)] } });

const base = bipedClips({
  face, tail: tails, hipH: 7.2, stride: 18, hopH: 2.5,
  add: {
    idle: (t, u) => merge(scarf(u, 2), hug(u, 2), { fez: { r: [0, 2 * osc(u, 1, 0.3), 0] } }),
    walk: (t, u) => merge(scarf(u, 2, 2.2), hug(u, 2, 1.5), { fez: { r: [3 * osc(u, 2), 0, 0] }, orange: { p: [0, 0, 0.3 * Math.abs(osc(u, 2))] } }),
    windup: (t, u) => { const w = smooth(u / 0.8); return { orange: { p: [1 * w, 1.5 * w, 0.5 * w], r: [0, 0, -12 * w] }, pawR: { r: [12 * w, 0, -8 * w] }, pawL: { r: [8 * w, 0, -10 * w] } }; },
    // shoves the orange forward like a cannonball, then hugs it back
    lunge: (t, u) => {
      const hit = K(u, [[0.1, 0], [0.4, 1], [0.62, 1], [1, 0]]);
      return merge(scarf(u, 1, 2), { orange: { p: [0.5 * hit, -3.5 * hit, 0.8 * hit], r: [-25 * hit, 0, 0] }, pawR: { r: [-24 * hit, 0, 0] }, pawL: { r: [-18 * hit, 0, 6 * hit] } });
    },
    hurt: (t, u) => { const k = K(u, [[0, 0], [0.18, 1], [1, 0.4]]); return merge(scarf(u, 2, 2), { orange: { p: [0, 0, 0.6 * k] }, fez: { r: [-12 * k, 0, 8 * k], p: [0, 0, 0.8 * k] } }); },
    // the orange slips out of the paws and rolls forward, the fez tips over the eyes
    faint: (t, u) => {
      const d = smooth((u - 0.25) / 0.5);
      return { orange: { p: [-0.4 * d, -2.6 * d, -3.2 * d], r: [-50 * d, 0, 0] }, ...both('paw', { r: [-10 * d, 0, 8 * d] }), fez: { r: [20 * d, 0, 0] } };
    },
    celebrate: (t, u) => merge(scarf(u, 2, 2), { orange: { s: 1 + 0.08 * Math.abs(Math.sin(TAU * u)) }, fez: { r: [-8 * Math.abs(Math.sin(TAU * u)), 0, 0] } }, both('ear', { r: [0, -10 * Math.abs(Math.sin(TAU * u)), 0] })),
    enter: (t, u) => ({ fez: { r: [-8 * win(u, 0.45, 0.9, 0.12), 0, 0] } }),
    exit: (t, u) => ({ pawL: { r: [-50 * win(u, 0, 0.85, 0.2), -30 * win(u, 0, 0.85, 0.2), 0] } }),
  },
});

const clips = {
  ...base,

  // fidget: sniffs its orange, the nose dipping towards it twice, ears perked, a happy squint
  idle_sniff: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.15, 1], [0.8, 1], [0.95, 0]]);
      const sn = Math.max(0, osc(u, 6)) * win(u, 0.2, 0.75, 0.05);
      return merge({
        ...face.pose(sn > 0.5 ? 'happy' : 'open'),
        head: { r: [14 * on + 3 * sn, 0, -26 * on] },
        body: { r: [4 * on, 0, -4 * on] },
        orange: { r: [0, 0, 6 * on] },
        ...both('ear', { r: [-10 * on, 0, 0] }),
      }, hug(u, 3, 1.5));
    },
  },

  // fidget: the big ears swivel to two sounds, one after the other, and the tail flicks
  idle_ears: {
    seconds: 2,
    pose: (t, u) => {
      const l = win(u, 0.1, 0.45, 0.06);
      const r = win(u, 0.45, 0.82, 0.06);
      return {
        ...face.pose('open', blinks(u, [[0.48, 0.53]])),
        head: { r: [0, 4 * (l - r), 10 * (l - r)] },
        earL: { r: [-14 * l, 0, 20 * l] },
        earR: { r: [-14 * r, 0, -20 * r] },
        fez: { r: [0, 3 * (r - l), 0] },
        ...Object.fromEntries(tails.map((n, i) => [n, { r: [0, 0, 8 * (1 + 0.3 * i) * osc(u, 2, -0.1 * i)] }])),
      };
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
