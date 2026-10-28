// Dreadmaw's rig: Gnashfin grown into a hulking pirate shark. A heavy head on hunched shoulders (it turns a little),
// a grinning jaw, fin-arms with ragged blades, and a tail dragging a rusty chain and anchor. Numbers are scad/dreadmaw.scad's.
import { K, TAU, both, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, pair, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye, blinks } from './lib/face.mjs';
import { near } from './lib/geo.mjs';

const BLACK = [0.12, 0.12, 0.16];
const NAVY = [0.2, 0.28, 0.52];
const CREAM = [0.95, 0.9, 0.74];
const RUST = [0.78, 0.35, 0.15];

const rim = (t, z) => [12 * Math.sin((t * 80 * Math.PI) / 180), -3.2 - 11 * Math.cos((t * 80 * Math.PI) / 180) * (1 - 0.15 * t * t), z];
const teeth = (z0, dz, n, t0) => Array.from({ length: n }, (_, i) => { const p = rim(-t0 + (2 * t0 * i) / (n - 1), z0); return limb(p, [p[0], p[1], p[2] + dz], 1.4, 0.6); });
const UPPER = teeth(28, -3.6, 11, 0.96);
const LOWER = teeth(23.8, 3.3, 10, 0.88);

const TAIL = [[2, 6, 8], [9, 9, 6.5], [15, 9, 8], [19, 8, 11.5]];
const tails = ['tail1', 'tail2', 'tail3'];

const eye = { side: 'L', at: [6.2, -12, 33], size: 4.4, yaw: 22, squash: 0.6 };
const face = eyeKit({ eyes: [eye, mirrorEye(eye)], skin: BLACK });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [6, 0, 4.4]),
  { name: 'body', parent: 'root', at: [0, 0.5, 7] },
  { name: 'head', parent: 'body', at: [0, 1.5, 22] },
  { name: 'jaw', parent: 'head', at: [0, 2.5, 24.5] },
  ...pair('arm*', 'body', [10.5, 0, 21]),
  ...pair('fore*', 'arm*', [14.5, -0.8, 12.5]),
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[1] },
  { name: 'tail3', parent: 'tail2', at: TAIL[2] },
  ...face.joints,
];

const parts = [
  ['body', any(blob([[[12, 9.5, 8], [0, 0.5, 11]], [[11, 9, 7], [0, 1, 18]], [[9.5, 8, 5], [0, 1.5, 23]]]), blob([[[10, 6, 6.5], [0, -3.4, 10]], [[7.5, 4, 4], [0, -5.4, 14]]]),
    ell([10, 8, 4], [0, 2.4, 21.5]), ell([11.6, 9.8, 2], [0, 0.6, 20.4]))],
  ['head', any(ell([12.5, 9.5, 7.5], [0, 2.5, 30.5]), ell([11, 7, 5], [0, -7, 31]), ell([5, 2.8, 3], [0, -16, 29.6]), ell([12.4, 9.4, 7.4], [0, 2.5, 30.5]),
    limb([0, -1, 36.5], [0, 7, 50], 2, 0.6), limb([10, 2, 31], [15.5, 8, 33.5], 2.4, 0.5), limb([-10, 2, 31], [-15.5, 8, 33.5], 2.4, 0.5),
    limb([11.6, 0, 26.4], [9, -7.6, 27.6], 2, 1.1), limb([-11.6, 0, 26.4], [-9, -7.6, 27.6], 2, 1.1))],
  ['jaw', any(ell([11.4, 8, 4.4], [0, -1.5, 22]), ell([10.8, 6.6, 3.2], [0, -8, 21.8]), ell([5.4, 1.8, 1.6], [0, -14.4, 22.8]))],
  ['arm*', limb([10.5, 0, 21], [14.5, -0.8, 12], 3.8, 2.2)],
  ['fore*', any(limb([14.5, -0.8, 12.5], [17, -3.4, 4], 2.4, 0.6), limb([14.5, -0.8, 12.5], [15.6, 2.4, 5], 2.4, 0.6))],
  ['leg*', any(ell([4.4, 4.4, 4.2], [6, 0, 4.4]), ell([4, 5.2, 1.8], [6.2, -1.6, 1.8]))],
  ...chain(tails, TAIL, [6, 4.4, 3.2, 2.2]),
  ['tail2', limb([8, 8.4, 4.8], [15, 8.6, 6.4], 3, 2)],
  ['tail3', any(limb([19, 8, 11.5], [23, 11, 29], 3, 0.7), limb([19, 8, 10.5], [25, 9, 5], 1.5, 0.6))],
];

function assign(c, rgb) {
  if (near(rgb, RUST)) return c[0] > 15 ? 'tail3' : 'tail2';
  if (near(rgb, CREAM)) {
    const r = Math.hypot(c[0], c[1] + 3.2);
    if (Math.abs(c[2] - 23.6) < 1.1 && r > 9.5) return 'jaw';
    if (Math.abs(c[2] - 28.2) < 1.1 && r > 9.5) return 'head';
    const u = Math.min(...UPPER.map((t) => t(c)));
    const l = Math.min(...LOWER.map((t) => t(c)));
    if (Math.min(u, l) < 1.6) return l < u ? 'jaw' : 'head';
  }
  return pick(c, parts);
}

const base = bipedClips({
  face, tail: tails, hipH: 4.4, stride: 16, armSwing: 16, hopScale: 0.25, hopH: 3,
  cheer: { arm: [-12, -30, 0], fore: [0, -16, 0] },
  punch: { arm: [-62, 8, 0], fore: [-28, 0, 0] },
  add: {
    lunge: (t, u) => ({ jaw: { r: [12 * K(u, [[0, 0], [0.25, 1], [0.4, 0], [1, 0]]), 0, 0] } }),
    celebrate: (t, u) => ({ jaw: { r: [5 * Math.abs(Math.sin(TAU * 2 * u)), 0, 0] } }),
    faint: (t, u) => ({ head: { r: [-16 * smooth((u - 0.18) / 0.55), 0, 0] } }),
    enter: (t, u) => ({ head: { r: [-12 * (1 - smooth((u - 0.2) / 0.35)), 0, 0] } }),
  },
});

const clips = {
  ...base,

  // fidget: a slow, menacing grin: the jaw drops, the head tilts to the camera side, then it snaps shut
  idle_grin: {
    seconds: 2.2,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.6, 1], [0.66, 0]]);
      const snap = win(u, 0.66, 0.78, 0.03);
      return {
        body: { r: [-2 * on, 0, 3 * on] },
        head: { r: [-5 * on + 3 * snap, -6 * on, 8 * on] },
        jaw: { r: [10 * on, 0, 0] },
        ...face.pose('open', 0.3 * on + blinks(u, [[0.85, 0.92]])),
        ...both('fore', { r: [-10 * on, 0, 0] }),
      };
    },
  },
  // fidget: it hauls the anchor round with a swing of the tail and lets it thump down, then rolls a shoulder
  idle_anchor: {
    seconds: 2.4,
    pose: (t, u) => {
      const sw = K(u, [[0, 0], [0.3, 1], [0.5, 1], [0.62, 0]]);
      const thump = win(u, 0.6, 0.7, 0.03);
      const roll = win(u, 0.7, 0.98, 0.08);
      return {
        body: { r: [0, -2 * sw, -6 * sw], p: [0, 0, -0.3 * thump] },
        head: { r: [0, 0, 8 * sw] },
        tail1: { r: [0, 0, -10 * sw] },
        tail2: { r: [4 * sw, 0, -12 * sw] },
        tail3: { r: [6 * sw, 0, -10 * sw] },
        armL: { r: [-8 * roll, -10 * roll, 0] },
        ...face.pose('open', 0.6 * thump),
      };
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
