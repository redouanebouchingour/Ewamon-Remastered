// Scalewisp's rig: a teal wyvern pup crouched on all fours, the head turned to its right, two bat wings in the
// picture plane (the right one raised high, the left one spread low) and a tail looping out behind the left wing up
// into a spined frond. Numbers are scad/scalewisp.scad's; the whole creature sits in its translate([0, 0, -FOOT])
// block (dz()). The quadruped template has no wings: they are wingL / wingR here, moved by the `add` layers.
import { K, TAU, merge, osc, rigDef, shake, smooth, win } from './lib/anim.mjs';
import { any, ell, inFrame, limb, pick } from './lib/biped.mjs';
import { eyeKit } from './lib/face.mjs';
import { chainHit, isAny, subFrame } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const FOOT = 6.4;
const dz = ([x, y, z]) => [x, y, z - FOOT];
const up = (c) => [c[0], c[1], c[2] + FOOT];

const TEAL = [0.11, 0.53, 0.51];
const TEAL_LT = [0.25, 0.71, 0.64];
const PURPLES = [[0.43, 0.23, 0.48], [0.62, 0.35, 0.62], [0.26, 0.14, 0.31]];

// head(): translate([-3, -4, 0]) rotate([0, 0, -35]); the wings: inplane(2.5) (both in the same plane)
const HEAD = subFrame([-3, -4, 0], [0, 0, -35]);
const HEAD_EYES = subFrame([-3, -4, -FOOT], [0, 0, -35]);
const WING = subFrame([-1.25 * Math.cos(Math.PI / 6), 2.5 - 1.25 * Math.sin(Math.PI / 6), 0], [0, 0, 30]);

const T = [[2, 7, 13.5], [5, 10, 12.5], [8, 11.5, 13.5], [10, 11.5, 16.5], [11, 11.5, 19.5], [9.5, 10, 21.5], [7.5, 8.2, 22.5],
  [6, 6.5, 23.5], [4.3, 5.0, 26.5], [2.2, 3.5, 29.8], [0.1, 2.0, 33], [-1.0, 1.0, 36]];
const TR = [2.3, 1.9, 1.6, 1.4, 1.3, 1.3, 1.4, 1.6, 1.7, 1.45, 1.05, 0.35];
const tail = ['tail1', 'tail2', 'tail3'];
const tailOf = (i) => (i < 4 ? 'tail1' : i < 7 ? 'tail2' : 'tail3');

const eyes = [1, -1].map((s) => ({ side: s > 0 ? 'L' : 'R', at: [2.45 * s, -4.2, 14.1], size: 1.2, yaw: 62 * s, flat: 0.55, frame: HEAD_EYES }));
const face = eyeKit({ eyes, skin: TEAL });

const joints = [
  { name: 'root', at: dz([1, 1, 6.4]) },
  { name: 'legFL', parent: 'root', at: dz([4.2, -1, 13.5]) },
  { name: 'legFR', parent: 'root', at: dz([-1.8, -1.8, 13.5]) },
  { name: 'legBL', parent: 'root', at: dz([4, 5.2, 13.5]) },
  { name: 'legBR', parent: 'root', at: dz([-2.6, 5, 14.2]) },
  { name: 'body', parent: 'root', at: dz([1, 1, 13]) },
  { name: 'head', parent: 'body', at: dz([-0.5, -4.5, 16]) },
  { name: 'wingR', parent: 'body', at: dz(WING.world([-3.3, 0, 19.8])), rot: [0, 0, 30] },
  { name: 'wingL', parent: 'body', at: dz(WING.world([3, 0, 20.5])), rot: [0, 0, 30] },
  { name: 'tail1', parent: 'body', at: dz(T[0]) },
  { name: 'tail2', parent: 'tail1', at: dz(T[4]) },
  { name: 'tail3', parent: 'tail2', at: dz(T[7]) },
  ...face.joints,
];

const legParts = [
  ['legFL', any(limb([4.2, -1, 13.5], [4.4, -1.8, 10], 1.9, 1.4), limb([4.4, -1.8, 10], [4.2, -2.4, 7.6], 1.4, 1.2),
    limb([4.2, -2.8, 7.1], [4.2, -4.8, 6.9], 1.1, 0.9), ell([1.5, 1.6, 0.8], [4.2, -5.8, 6.5]))],
  ['legFR', any(limb([-1.8, -1.8, 13.5], [-2.2, -2.6, 10], 1.9, 1.4), limb([-2.2, -2.6, 10], [-1.8, -3, 7.6], 1.4, 1.2),
    limb([-1.8, -3.4, 7.1], [-2.2, -5.8, 6.9], 1.1, 0.9), ell([1.5, 1.6, 0.8], [-2.3, -6.8, 6.5]))],
  ['legBL', any(ell([2.3, 3.2, 3.6], [4, 5.2, 13.5]), limb([4.3, 6.8, 10.8], [3.2, 7.6, 8.3], 1.6, 1.2), limb([3.2, 7.6, 8.3], [2.8, 7.6, 7], 1.2, 1.1),
    limb([2.8, 7.4, 6.9], [6.5, 6.2, 6.7], 1.0, 0.85), ell([1.6, 1.5, 0.8], [7.6, 5.8, 6.5]))],
  ['legBR', any(ell([2.3, 3.2, 3.2], [-2.6, 5, 14.2]), limb([-1.5, 7.2, 11.5], [-1.3, 8.8, 8.5], 1.5, 1.2), limb([-1.3, 8.8, 8.5], [-1.2, 9.2, 7], 1.2, 1.1),
    limb([-1.2, 9, 6.9], [-1.5, 6.8, 6.7], 1.0, 0.85), ell([1.5, 1.6, 0.8], [-1.5, 5.8, 6.5]))],
];
const parts = [
  ...legParts,
  ['body', any(ell([3.6, 4, 4.5], [0.5, -3, 14.8]), ell([3.6, 3.8, 4.1], [1, 1.5, 15.2]), ell([3.8, 3.4, 3.7], [2, 6.5, 14.5]),
    ell([2.9, 3.4, 1.7], [0.5, -3.5, 11.8]), ell([1.7, 1.9, 1.7], [3, 0.5, 18.8]), ell([1.7, 1.9, 1.7], [-3, 0.5, 18.8]),
    ell([2.8, 2.5, 1.8], [0.5, 0.5, 19.5]), limb([0.8, -1.5, 19.6], [0.8, 3.5, 22.6], 0.7, 0.4), limb([2.5, 1.5, 20], [3.5, 4.5, 25], 1.7, 1.5))],
  ['head', any(limb([-0.5, -4.5, 16], [-3, -5, 15.3], 2.8, 2.5), inFrame(HEAD, any(
    ell([3.1, 2.9, 4.6], [0, 0.5, 15.2]), ell([2.8, 2.4, 4.0], [0, -3.2, 15.0]), ell([2.1, 1.8, 2.8], [0, -5.6, 15.4]),
    ell([1.5, 1.5, 1.8], [0, -7.8, 12.4]), limb([0, -0.5, 11.2], [0, -7.4, 11], 2.6, 1.3),
    ell([1.5, 2, 1.4], [2.0, -4.0, 15.9]), ell([1.5, 2, 1.4], [-2.0, -4.0, 15.9]), ell([1.6, 1.6, 2], [2.45, -4.2, 14.1]), ell([1.6, 1.6, 2], [-2.45, -4.2, 14.1]),
    limb([1.6, -5.6, 18.2], [1.9, -5.9, 21], 0.6, 0.2), limb([-1.6, -5.6, 18.2], [-1.9, -5.9, 21], 0.6, 0.2),
    limb([0, -3.2, 19], [0, 1.6, 19.6], 0.6, 0.4))))],
  // the wing bones, in the wing plane
  ['wingR', inFrame(WING, any(limb([-3.3, 0, 19.8], [-4.6, 0, 24.5], 1.1, 0.95), limb([-4.6, 0, 24.5], [-4.3, 0, 31.3], 0.95, 0.9),
    limb([-4.4, 0, 31.3], [-5.3, 0, 34.3], 0.5, 0.2), limb([-3.8, 0, 31.2], [-3, 0, 33.2], 0.42, 0.2),
    limb([-5.0, 0, 32.4], [-18.6, 0, 39.5], 0.95, 0.4), limb([-5.0, 0, 29.8], [-19, 0, 28.7], 0.5, 0.3), limb([-5.6, 0, 27.4], [-16.4, 0, 24.2], 0.45, 0.3),
    ell([1.6, 1, 1.2], [-17.8, 0, 39.1])))],
  ['wingL', inFrame(WING, any(limb([3, 0, 20.5], [8.5, 0, 23], 1.1, 0.9), limb([8.5, 0, 23], [12, 0, 27.6], 0.9, 0.8),
    limb([12, 0, 27.8], [19.2, 0, 30.3], 0.6, 0.35), limb([12.4, 0, 27], [13.0, 0, 18.5], 0.6, 0.5), limb([13.0, 0, 18.5], [10.9, 0, 10.8], 0.5, 0.3),
    limb([19.3, 0, 25.5], [14.8, 0, 14], 0.4, 0.4), limb([14.8, 0, 14], [10.8, 0, 10.6], 0.4, 0.3)))],
];

function assign(c0, rgb) {
  const c = up(c0);
  if (isAny(rgb, PURPLES)) return WING.local(c)[0] < 0 ? 'wingR' : 'wingL';
  const t = chainHit(c, T, TR);
  // the frond's light spines
  if (isAny(rgb, [TEAL_LT]) && c[2] > 21) return 'tail3';
  const best = pick(c, parts);
  const bd = parts.find(([n]) => n === best)?.[1](c) ?? Infinity;
  return t.d < bd ? tailOf(t.i) : best;
}

// the wings: `lift` raises both (ry, mirrored), `beat` sways them out of the plane; the low left wing moves less
const W = (lift, beat = 0, liftR = lift) => ({
  wingL: { r: [beat * 0.6, -lift * 0.6, 0] },
  wingR: { r: [beat, liftR, 0] },
});

const base = quadrupedClips({
  face, tail, hipH: 7, stride: 14,
  add: {
    idle: (t, u) => W(2 * osc(u, 2), 2 * osc(u, 1, 0.3)),
    walk: (t, u) => W(4 * osc(u, 2, 0.1), 3 * osc(u, 1)),
    idle_sniff: (t, u) => W(-3 * win(u, 0.14, 0.6, 0.1), 0),
    idle_shake: (t, u) => { const k = win(u, 0.1, 0.8, 0.06); return W(8 * k * Math.sin(TAU * 7 * u), 6 * k * Math.sin(TAU * 7 * u + 1)); },
    windup: (t, u) => { const w = smooth(u / 0.8); return W(14 * w, -8 * w); },
    lunge: (t, u) => { const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]); return W(14 - 26 * hit, -8 + 16 * hit); },
    hurt: (t, u) => { const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.45]]); return W(18 * k + 4 * shake(u, 5), -10 * k); },
    recoil: (t, u) => { const k = K(u, [[0, 0], [0.4, 1], [1, 0]]); return W(-8 * k, 4 * k); },
    faint: (t, u) => { const d = smooth((u - 0.2) / 0.55); return W(-22 * d, 6 * d); },
    celebrate: (t, u) => W(10 + 16 * Math.sin(TAU * 3 * u), 6 * osc(u, 3, 0.25)),
    enter: (t, u) => { const over = win(u, 0.4, 0.9, 0.12); const on = smooth((u - 0.1) / 0.4); return W(-14 * (1 - on) + 20 * over, 0); },
    exit: (t, u) => { const k = win(u, 0, 0.85, 0.2); return { ...W(0, 0), wingR: { r: [0, (14 + 14 * Math.sin(TAU * 2 * u)) * k, 0] } }; },
  },
});
const { idle_wag: _wag, ...clips0 } = base;

const clips = {
  ...clips0,
  // fidget: a big stretch: the wings spread wide and quiver, the back arches, the front paws push forward, a slow
  // blink at the end
  idle_stretch: {
    seconds: 2.8,
    pose: (t, u) => {
      const k = K(u, [[0, 0], [0.25, 1], [0.6, 1], [0.8, 0]]);
      const q = Math.sin(TAU * 10 * u) * win(u, 0.3, 0.6, 0.05);
      return merge({
        root: { p: [0, 0, -0.4 * k] },
        body: { r: [8 * k, 0, 0] },
        head: { r: [-14 * k, 0, 10 * k] },
        legFL: { r: [-18 * k, 0, 0] },
        legFR: { r: [-18 * k, 0, 0] },
        ...face.pose(k > 0.5 ? 'shut' : 'open'),
      }, W(22 * k + 2 * q, -6 * k), Object.fromEntries(tail.map((n, i) => [n, { r: [6 * k * (1 + 0.3 * i), 0, 0] }])));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });

