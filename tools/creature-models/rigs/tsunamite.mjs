// Tsunamite's rig: Tidespine grown into a hulking spinosaur. A croc snout whose lower jaw opens, a webbed sail on its
// own joint (it flares), purple crystal gauntlets and a tail ending in a stone paddle. Numbers are scad/tsunamite.scad's.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, mx, pair, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { isAny, near, subFrame } from './lib/geo.mjs';

const TEAL = [0.13, 0.55, 0.62];
const CREAM = [0.93, 0.86, 0.62];
const PURPLES = [[0.42, 0.3, 0.6], [0.56, 0.45, 0.75], [0.28, 0.2, 0.42], [0.25, 0.55, 0.58]];
const PADDLE = [0.36, 0.5, 0.52];
const ROCKS = [[0.42, 0.52, 0.54], [0.33, 0.38, 0.45]];
const GEM = [0.4, 0.85, 1];
const BUBBLE = [0.82, 0.94, 1];
const TOOTH = [1, 1, 0.95];
const HORN = [0.16, 0.18, 0.22];

const TAIL = [[0, 5, 10], [3, 10, 6.5], [8, 13, 5.5], [13, 13, 8], [15.5, 11, 12.5], [16, 9.5, 17]];
const TAIL_R = [4, 3.2, 2.5, 1.9, 1.5, 1.2];
const tails = ['tail1', 'tail2', 'tail3'];

const eyeAt = (k) => subFrame([2.3 * k, -6.6, 32.6], [0, 0, 28 * k], 1);
const face = eyeKit({ eyes: [1, -1].map((k) => ({ side: k > 0 ? 'L' : 'R', at: [0.01, 0, 0], size: 1.7, squash: 0.6, frame: eyeAt(k) })), skin: TEAL });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [5, 0.5, 8.5]),
  { name: 'body', parent: 'root', at: [0, 1.5, 10] },
  { name: 'sail', parent: 'body', at: [0, 6, 15] },
  { name: 'head', parent: 'body', at: [0, -3, 26] },
  { name: 'jaw', parent: 'head', at: [0, -3.5, 28.3] },
  ...pair('arm*', 'body', [5.5, -2, 21.5]),
  ...pair('fore*', 'arm*', [8, -3.5, 17]),
  { name: 'tail1', parent: 'body', at: TAIL[1] },
  { name: 'tail2', parent: 'tail1', at: TAIL[2] },
  { name: 'tail3', parent: 'tail2', at: TAIL[4] },
  ...face.joints,
];

const teeth = (lower) => [0, 1, 2, 3, 4].map((i) => (lower
  ? spike([1.7 - i * 0.08, -7.8 - i * 1.7, 28.7], [0, 0, 0.8], 0.4)
  : spike([1.9 - i * 0.08, -7 - i * 1.7, 29], [0, 0, -0.9], 0.4)));
const parts = [
  ['body', any(blob([[[7, 6.5, 7], [0, 1.5, 13]], [[5.2, 5, 5], [0, -1, 21]]]), blob([[[4.6, 2.6, 5.6], [0, -4.2, 12.5]], [[3, 2.2, 3.6], [0, -4.4, 20.5]]]),
    limb([0, -1, 22], [0, -3, 26], 4, 3.4), mx(ell([1.2, 1, 1.2], [4.5, 6, 16])), mx(ell([1.2, 1, 1.2], [5.5, 5, 9.5])), ell([1.3, 0.9, 1.5], [3.6, 6.4, 12.5]))],
  ['head', any(limb([0, -3, 26], [0, -4, 28.5], 3.4, 3.2), ell([3.4, 2.6, 3], [0, -4, 25.5]), blob([[[3.8, 3.8, 3.2], [0, -4, 30.5]], [[2.2, 5, 1.6], [0, -11, 29.6]]]),
    mx(spike([2.4, -2.6, 32.6], [1.2, 1.8, 3.6], 0.9)), mx(spike([3.4, -1.2, 31.6], [2, 2.2, 1.8], 0.7)), ...teeth(false).map(mx))],
  ['jaw', any(blob([[[3, 3.4, 1.3], [0, -5.4, 28]], [[1.8, 5, 1], [0, -11, 28.2]]]), ...teeth(true).map(mx))],
  ['arm*', limb([5.5, -2, 21.5], [8, -3.5, 17], 2.2, 1.9)],
  ['fore*', any(limb([8, -3.5, 17], [8.4, -6, 14.5], 1.9, 1.6), ell([3, 3, 3], [8.2, -4.6, 16]), ell([1.8, 1.6, 1.4], [8.6, -7, 13.6]),
    limb([8.6, -8.2, 13.6], [8.8, -9.4, 11], 1.6))],
  ['leg*', any(ell([4, 4.6, 5], [5, 0.5, 8.5]), limb([5.4, 1, 5], [5.6, 2, 2.6], 2.8, 1.9), limb([5.6, 2, 2.6], [5.6, -0.2, 1.1], 1.9, 1.6),
    blob([[[2.5, 3.6, 1.2], [5.6, -2.2, 1.2]], [[1.8, 1.8, 1.1], [5.6, 1.2, 1.1]]]), ell([2.6, 2.6, 2.6], [7.6, -1.4, 10.4]), limb([4, -5.4, 0.9], [7.2, -7, 0.6], 0.8))],
  ...chain(['body', 'tail1', 'tail2', 'tail2', 'tail3'], TAIL, TAIL_R),
];

function assign(c, rgb) {
  const ax = Math.abs(c[0]);
  if (near(rgb, BUBBLE) || near(rgb, GEM)) return 'body';
  if (near(rgb, PADDLE) || (isAny(rgb, ROCKS) && c[0] > 12)) return 'tail3';
  if (isAny(rgb, PURPLES)) {
    if (ax < 4.5 && c[1] > 2) return 'sail';
    if (c[2] > 12.5) return pick(c, parts.filter(([n]) => n === 'fore*'));
    return pick(c, parts.filter(([n]) => n === 'leg*'));
  }
  if (near(rgb, TOOTH)) return pick(c, parts.filter(([n]) => n === 'head' || n === 'jaw'));
  if (near(rgb, HORN, 0.02) && c[2] > 30) return 'head';
  if (near(rgb, CREAM) && c[2] > 26.6 && c[1] < -3) return pick(c, parts.filter(([n]) => n === 'head' || n === 'jaw'));
  if (!isAny(rgb, [TEAL, CREAM, [0.25, 0.68, 0.72], [0.1, 0.36, 0.48], [0.82, 0.74, 0.5], [0.2, 0.22, 0.26], ...ROCKS])) return 'head';   // eyes
  return pick(c, parts);
}

const jawK = (k) => ({ jaw: { r: [k, 0, 0] } });

const base = bipedClips({
  face, tail: tails, hipH: 8.5, stride: 15, armSwing: 10, hopScale: 0.3, droop: 0.6,
  // a crystal-gauntlet hammer blow, jaws wide
  punch: { arm: [-75, 10, 0], fore: [-25, 0, 0] },
  cheer: { arm: [-20, -95, 0], fore: [-30, 0, 0] },
  add: {
    idle: (t, u) => ({ sail: { r: [1.5 * osc(u, 2, 0.4), 0, 0] } }),
    walk: (t, u) => ({ sail: { r: [2 * osc(u, 2, 0.2), 0, 1.5 * osc(u, 1)] } }),
    windup: (t, u) => merge(jawK(14 * Math.min(1, u / 0.8)), { sail: { s: 1 + 0.06 * Math.min(1, u / 0.8) } }),
    lunge: (t, u) => merge(jawK(22 * K(u, [[0, 0.6], [0.3, 1], [0.45, 0], [1, 0]])), { sail: { s: 1.06 - 0.06 * u } }),
    hurt: (t, u) => jawK(10 * K(u, [[0, 0], [0.2, 1], [1, 0.3]])),
    celebrate: (t, u) => merge(jawK(18 * win(u, 0, 1, 0.15)), { sail: { s: 1 + 0.08 * Math.abs(Math.sin(TAU * u)) } }),
  },
});

const clips = {
  ...base,

  // fidget: the croc snap. It eyes something, then the jaws clap shut twice, hard
  idle_snap: {
    seconds: 2.2,
    pose: (t, u) => {
      const eye = K(u, [[0, 0], [0.15, 1], [0.8, 1], [0.95, 0]]);
      const snap = (u0) => K(u, [[u0, 0], [u0 + 0.08, 1], [u0 + 0.12, 0]]);
      const s = snap(0.35) + snap(0.55);
      return {
        body: { r: [4 * eye, 0, 0] },
        head: { r: [6 * eye - 4 * s, 0, 8 * eye] },
        ...jawK(26 * s),
        ...face.pose('open', 0.35 * eye),
        ...both('arm', { r: [-8 * eye, 0, 0] }),
      };
    },
  },

  // fidget: it rears up and flares its great sail, then shakes it down with a rattle
  idle_flare: {
    seconds: 2.8,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.25, 1], [0.55, 1], [0.7, 0]]);
      const rat = Math.sin(TAU * 9 * u) * win(u, 0.65, 0.95, 0.04);
      return {
        root: { r: [-2 * up, 0, 0] },
        body: { r: [-7 * up, 0, 2 * rat] },
        head: { r: [-10 * up, 0, 0] },
        sail: { s: 1 + 0.1 * up, r: [3 * rat, 0, 2 * rat] },
        ...jawK(14 * up),
        ...face.pose(up > 0.6 ? 'squeeze' : 'open', blinks(u, [[0.88, 0.93]])),
        ...both('arm', { r: [-20 * up, -25 * up, 0] }),
        ...both('fore', { r: [-30 * up, 0, 0] }),
      };
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
