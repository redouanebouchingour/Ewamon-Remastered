// Fennorange's rig: a fennec kit hugging a big orange, in a fez, huge ears. The arms only hug, so they are paws the
// template does not swing (pawL / pawR); the orange, the fez and the scarf end are joints of their own. Numbers are
// scad/fennorange.scad's.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near } from './lib/geo.mjs';

const FUR = [0.86, 0.73, 0.48];
const FEZ = [[0.5, 0.08, 0.1], [0.42, 0.06, 0.08], [0.15, 0.45, 0.2]];
const SCARF = [[0.6, 0.15, 0.12], [0.25, 0.42, 0.2]];
const FRUIT = [[0.96, 0.52, 0.1], [1, 0.66, 0.25], [0.3, 0.55, 0.2]];
const tails = ['tail1', 'tail2'];

const eyeL = { side: 'L', at: [2.8, -5.1, 24.6], size: 1.75, yaw: -24, flat: 0.42 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FUR });
// the ear() module: base p, tip p + d, width w
const EAR = { p: [4.4, 0, 27], d: [8.5, 3, 9.5], w: 3.9 };
const at = (k) => EAR.p.map((v, i) => v + EAR.d[i] * k);

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [3, 0.2, 6]),
  { name: 'body', parent: 'root', at: [0, 0, 6] },
  { name: 'orange', parent: 'body', at: [-5.2, -4, 11.5] },
  { name: 'scarf', parent: 'body', at: [2.3, -3.8, 16.3] },
  ...pair('paw*', 'body', [3.8, -0.5, 15]),
  { name: 'head', parent: 'body', at: [0, -0.3, 17.6] },
  { name: 'fez', parent: 'head', at: [0.4, 0, 28.6] },
  ...pair('ear*', 'head', EAR.p),
  { name: 'tail1', parent: 'body', at: [1.5, 4, 6] },
  { name: 'tail2', parent: 'tail1', at: [9.5, 6.5, 10.5] },
  ...face.joints,
];

const parts = [
  ['leg*', any(ell([2.6, 2.8, 3.2], [3, 0.2, 5.2]), limb([3, 0, 4], [3, -0.5, 1.4], 1.8, 1.5), ell([1.8, 2.6, 1.2], [3, -1.6, 1.2]))],
  ['body', any(blob([[[5.6, 4.8, 5], [0, 0.5, 9]], [[4.4, 3.8, 4], [0, 0, 14.5]]]), ell([3.6, 2.2, 4.5], [0, -3.1, 10]))],
  ['head', any(ell([7.2, 6.2, 6], [0, -0.5, 23]), blob([[[3.4, 2.4, 2.4], [0, -5, 21.6]], [[1.8, 1.8, 1.4], [0, -7, 21.8]]]))],
  ['head', limb([5.6, -1, 21.5], [7.8, -1, 20.1], 1.6, 0.3)],
  ['head', limb([-5.6, -1, 21.5], [-7.8, -1, 20.1], 1.6, 0.3)],
  ['ear*', any(limb(EAR.p, at(0.45), EAR.w * 0.7), limb(at(0.45), at(1), EAR.w * 0.8, 0.4))],
  ['pawR', limb([-3.8, -0.5, 15], [-4.6, -4.4, 14], 1.3, 1.1)],
  ['pawL', any(limb([3.8, -0.5, 15], [0, -5, 12.2], 1.3, 1.1), ell([1.3, 1.2, 1.1], [-0.6, -5.4, 12]))],
  ['tail1', limb([1.5, 4, 6], [7, 6.5, 7], 1.6, 3.4)],
  ['tail1', limb([7, 6.5, 7], [9.5, 6.5, 11], 3.4, 3.6)],
  ['tail2', any(ell([3.4, 3, 2.6], [9.8, 6.5, 13.4]), limb([9.8, 6.5, 13.4], [10.2, 6, 18], 3, 1.2))],
];

function assign(c, rgb) {
  if (isAny(rgb, FEZ) && c[2] > 28) return 'fez';
  if (isAny(rgb, FRUIT)) {
    if (c[1] > 3 && c[0] > 5) return 'tail2';                        // the tail's orange tip, not the fruit
    if (Math.hypot(c[0] + 5.2, c[1] + 4, c[2] - 11.5) < 6.5) return 'orange';
  }
  if (near(rgb, [1, 0.58, 0.12]) || near(rgb, [0.93, 0.5, 0.12])) return pick(c, parts.filter(([n]) => n === 'ear*' || n === 'tail2'));
  if (isAny(rgb, SCARF)) return c[2] < 15.4 && c[1] < -2.4 ? 'scarf' : 'body';
  const j = pick(c, parts);
  // the tail is one hull of long thin triangles: a single fur link and the tip, split by height
  if (j.startsWith('tail')) return c[2] > 11 ? 'tail2' : 'tail1';
  return j;
}

const scarf = (u, cycles, amp = 1) => ({ scarf: { r: [6 * amp * osc(u, cycles, 0.2), 4 * amp * osc(u, cycles, 0.45), 0] } });
const hug = (u, cycles, amp = 1) => ({ ...both('paw', { r: [2 * amp * osc(u, cycles), 0, 0] }), orange: { r: [0, 0, 1.5 * amp * osc(u, cycles)] } });

const base = bipedClips({
  face, tail: tails, hipH: 6, stride: 18, hopH: 2.5,
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
