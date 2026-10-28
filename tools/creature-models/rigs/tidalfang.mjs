// Tidalfang's rig: a gentle aqua sea dragon on a long curved neck, a webbed sail behind the shoulders and little arms
// held up in front. Its tail loops up its side and sweeps across the front past its feet, so it is one joint off the
// root that barely sways (anything more ploughs it through the legs). Numbers are scad/tidalfang.scad's; the head block
// is scaled 1.18 about [0, -6, 34] (HF).
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, chain, ell, limb, mx, pair, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { isAny, near, side, subFrame } from './lib/geo.mjs';

const AQUA = [0.22, 0.72, 0.74];
const SAILS = [[0.7, 0.94, 0.9], [0.8, 0.78, 0.98], [0.3, 0.72, 0.74]];
const DROP = [0.45, 0.68, 0.95];

const HF = subFrame([0, -6, 34], [0, 0, 0], 1.18);
const H = (p) => HF.world(p);

// the scad's Catmull-Rom spline, so the tail test follows the same path
const cr = (a, b, c, d, t) => a.map((_, i) => 0.5 * (2 * b[i] + (c[i] - a[i]) * t + (2 * a[i] - 5 * b[i] + 4 * c[i] - d[i]) * t * t + (3 * b[i] - a[i] - 3 * c[i] + d[i]) * t * t * t));
const spline = (P, n) => [...P.slice(0, -1).flatMap((_, i) => Array.from({ length: n }, (_, k) => cr(P[Math.max(i - 1, 0)], P[i], P[i + 1], P[Math.min(i + 2, P.length - 1)], k / n))), P[P.length - 1]];
const TAIL = spline([[0, 5, 10], [6, 7, 8], [11.5, 5, 11], [12.5, 0.5, 17], [9.5, -4, 18.5], [7.5, -6, 13], [7, -7, 7.5],
  [2, -9, 5], [-5, -9, 5], [-11, -6.5, 6], [-14, -5.5, 10], [-12, -5, 13], [-9.6, -5, 11], [-10.6, -5, 9]], 3);
const TAIL_R = TAIL.map((_, i) => 3.6 - (3.1 * i) / (TAIL.length - 1));

const RIBS = [[0.5, 28, 3, 1, 43], [1.4, 25, 6, 4, 45], [2.2, 22, 9.5, 7, 43], [2.8, 19, 12, 9, 38], [3.2, 16, 13, 10, 31], [3.4, 13, 11, 9, 23]];

const eyeFrame = (S) => { const k = S === 'L' ? 1 : -1; return subFrame(H([2.3 * k, -7.6, 35.1]), [0, 0, 30 * k], 1.18); };
const face = eyeKit({ eyes: ['L', 'R'].map((S) => ({ side: S, at: [0.01, 0, 0], size: 2, flat: 0.6, squash: 0.7, frame: eyeFrame(S) })), skin: AQUA });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4.6, 1, 10.4]),
  { name: 'body', parent: 'root', at: [0, 1.5, 11] },
  { name: 'head', parent: 'body', at: [0, -2.4, 29.5] },
  ...pair('arm*', 'body', [4.4, -2.4, 22.5]),
  ...pair('fore*', 'arm*', [6, -3.6, 19]),
  { name: 'tail1', parent: 'root', at: [0, 5, 10] },
  ...face.joints,
];

const HORN = mx(any(...chain(['h'], [H([1.6, -4.4, 37.6]), H([2.4, -2.4, 40.6]), H([2.4, 0.4, 42.6]), H([1.8, 2.6, 43])], [1.3, 1, 0.7, 0.3]).map((e) => e[1])));
const AQUA_HI = [0.42, 0.85, 0.85];

const parts = [
  ['head', any(limb([0, -2.4, 29.5], [0, -4, 32.5], 2.9, 2.6), ell([4.25, 4.25, 3.8], H([0, -5, 35])), limb(H([0, -9, 34]), H([0, -11.4, 33.4]), 2.6, 1.5),
    limb(H([0, -6, 32.6]), H([0, -10.6, 32.8]), 1.6, 1), HORN,
    mx(limb(H([1.6, -4.4, 37.6]), H([2.4, 0.4, 42.6]), 1.2, 0.7)), mx(limb(H([3.2, -4.4, 34.6]), H([7.4, -1.8, 35.4]), 1.2)), mx(limb(H([3.2, -4.4, 34.6]), H([6, -1.4, 31.8]), 1.2)))],
  ['body', any(limb([0, 1.5, 11], [0, 0.5, 16], 6), limb([0, 0.5, 16], [0, -0.5, 21], 6, 5), limb([0, -0.5, 21], [0, -1.2, 25.5], 5, 3.7),
    limb([0, -1.2, 25.5], [0, -2.4, 29.5], 3.7, 2.9), ...RIBS.map((r) => mx(limb([1.4, r[0] + 1.6, r[1]], [r[2], r[3] + 1.6, r[4]], 1))),
    ...RIBS.map((r) => spike([0, r[0] + 2.2, r[1]], [0, 1.2, 1.4], 0.8)))],
  ['arm*', limb([4.4, -2.4, 22.5], [6, -3.6, 19], 1.4, 1.1)],
  ['fore*', any(limb([6, -3.6, 19], [4.4, -6.2, 18.6], 1.1, 0.9), limb([4.2, -6.8, 18.6], [4.2, -7.9, 19], 0.6), limb([6, -3.4, 19.4], [8.6, -1.6, 17.4], 0.6))],
  ['leg*', any(ell([3.8, 4.4, 4.6], [4.6, 1, 10.4]), limb([4.8, 0.4, 8.6], [5.6, 3, 5.4], 2.2, 1.5), limb([5.6, 3, 5.4], [5.4, 0.8, 3.4], 1.5, 1.2),
    ell([1.6, 2.6, 0.9], [5.4, -0.6, 3.2]), limb([4.4, -2.6, 3], [6.4, -4.2, 2.6], 0.6))],
  ...chain(['tail1'], TAIL, TAIL_R.map((r) => r * 1.1)),
];

function assign(c, rgb) {
  if (near(rgb, DROP)) return 'body';
  if (near(rgb, AQUA_HI) && HORN(c) < 1.4) return 'head';
  if (isAny(rgb, SAILS)) {
    if (c[2] < 23 && Math.abs(c[0]) > 3 && c[1] < 0) return `fore${side(c)}`;   // the elbow fins
    if (c[2] < 15 && c[1] < -3) return 'tail1';                                 // the curl's web
    if (c[1] < 0.5 && c[2] > 28) return 'head';                                 // the ear frills
    return 'body';
  }
  return pick(c, parts);
}

// the tail barely sways: it loops round the legs
const tailK = (u, amp = 1) => ({ tail1: { r: [0, 0, 1.2 * amp * osc(u, 1)] } });
// the long neck sways like a swan's
const neck = (u, amp = 1, cycles = 1) => ({ head: { r: [2 * amp * osc(u, cycles, 0.2), 0, 3 * amp * osc(u, cycles, 0.45)] } });

const base = bipedClips({
  face, hipH: 10, stride: 10, armSwing: 6, hopScale: 0.4, droop: 0.6,
  // a quick snap of the head forward with the claws out
  punch: { arm: [-40, 0, 0], fore: [-20, 0, 0] },
  cheer: { arm: [-20, -70, 0], fore: [-30, 0, 0] },
  add: {
    idle: (t, u) => merge(tailK(u), neck(u, 1, 1)),
    walk: (t, u) => merge(tailK(u, 0.6), neck(u, 0.8, 2)),
    lunge: (t, u) => ({ head: { r: [24 * K(u, [[0.1, 0], [0.4, 1], [0.65, 1], [1, 0]]), 0, 0] } }),
    hurt: (t, u) => tailK(u, 2),
    celebrate: (t, u) => merge(tailK(u, 2), neck(u, 1.5, 2)),
  },
});

const clips = {
  ...base,

  // fidget: it shakes the water off its head, ear frills flapping, then blinks happily
  idle_shake: {
    seconds: 2,
    pose: (t, u) => {
      const sh = Math.sin(TAU * 7 * u) * win(u, 0.1, 0.55, 0.06);
      const happy = win(u, 0.6, 0.9, 0.03);
      return merge({
        body: { r: [0, 0, 3 * sh] },
        head: { r: [-4 * happy, 4 * sh, 18 * sh] },
        ...face.pose(happy > 0.5 ? 'happy' : 'open', blinks(u, [[0.05, 0.1]])),
        ...both('arm', { r: [0, -6 * Math.abs(sh), 0] }),
      }, tailK(u, 1.5));
    },
  },

  // fidget: it looks back over its shoulder at its sail, then turns to the camera side
  idle_preen: {
    seconds: 2.8,
    pose: (t, u) => {
      const back = K(u, [[0, 0], [0.18, 1], [0.45, 1], [0.6, 0]]);
      const look = K(u, [[0.5, 0], [0.65, 1], [0.85, 1], [1, 0]]);
      return merge({
        body: { r: [0, 0, -14 * back + 6 * look] },
        head: { r: [-6 * back, 10 * back, -40 * back + 22 * look] },
        ...face.pose('open', blinks(u, [[0.48, 0.53]])),
      }, tailK(u));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
