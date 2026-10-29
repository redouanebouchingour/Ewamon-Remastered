// Kindlegrub's rig: a soot grub lying along the ground on five pairs of stubby bone legs (the insect template's
// tripod gait runs down all five), its big head out front with bone horns, the segments behind the first as a tail
// chain, and the magma rock on its back carrying a flickering flame. Numbers are scad/kindlegrub.scad's.
import { TAU, hash, merge, rigDef, win } from './lib/anim.mjs';
import { ell, pick } from './lib/biped.mjs';
import { capD, fold, isAny, near, side } from './lib/geo.mjs';
import { insectClips } from './lib/insect.mjs';

const SEGS = [[-2, 8.6, 9], [4, 8.4, 8.8], [10, 8, 8.4], [15.5, 7.2, 7.6], [20, 6, 6.4]];
const SEG_OWNER = ['body', 'body', 'tail1', 'tail2', 'tail3'];
const LEG_Y = [-6, -2, 4, 10, 16];
const tail = ['tail1', 'tail2', 'tail3'];
const BONE = [0.78, 0.7, 0.6];
const FLAME = [[0.95, 0.3, 0.08], [1, 0.58, 0.1], [1, 0.88, 0.35]];
const ROCK = [0.25, 0.21, 0.19];
const LAVA = [[1, 0.45, 0.08], [1, 0.75, 0.2]];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...LEG_Y.flatMap((y, i) => ['L', 'R'].map((S) => ({ name: `leg${i + 1}${S}`, parent: 'root', at: [S === 'L' ? 5.5 : -5.5, y, 3] }))),
  { name: 'body', parent: 'root', at: [0, 0, 4] },
  { name: 'head', parent: 'body', at: [0, -5, 9] },
  { name: 'tail1', parent: 'body', at: [0, 7, 8.6] },
  { name: 'tail2', parent: 'tail1', at: [0, 12.8, 8] },
  { name: 'tail3', parent: 'tail2', at: [0, 17.8, 7] },
  { name: 'flame', parent: 'body', at: [0, 4.2, 27.6] },
];

// the rock lumps (scaled 1.35 about (0, 4, 15))
const rockD = (c) => ell([7.6, 7, 6.5], [0, 4, 15 + (19.6 - 15) * 1.35])(c);

function assign(c, rgb) {
  const f = fold(c);
  const S = side(c);
  if (isAny(rgb, FLAME, 0.03) && c[2] > 26 && Math.abs(c[0]) < 3.5) return 'flame';
  if (isAny(rgb, FLAME, 0.03)) return 'body';                    // the floating embers beside the flame
  if ((near(rgb, ROCK, 0.02) && c[2] > 14) || (isAny(rgb, LAVA, 0.03) && rockD(c) < 1.1 && c[2] > 16)) return 'body';
  if (near(rgb, BONE)) {
    if (c[2] < 4.5 && c[1] > -10) { const i = LEG_Y.map((y) => Math.abs(c[1] - y + 0.3)).reduce((a, d, k, all) => (d < all[a] ? k : a), 0); return `leg${i + 1}${S}`; }
    return 'head';
  }
  const segs = SEGS.map(([y, r, z]) => ell([r, 3.6 + 1.6, r * 0.92], [0, y + 0.8, z])(c));
  const si = segs.indexOf(Math.min(...segs));
  return pick(c, [
    [SEG_OWNER[si], () => segs[si]],
    ['head', () => Math.min(ell([9.6, 8, 9.6], [0, -9, 13])(c), ell([5, 3, 3.2], [0, -15, 8.6])(c), ell([2.4, 1.4, 2.9], [4.4, -15.6, 14.6])(f), ell([1.5, 0.9, 1.4], [7.2, -12.6, 8.8])(f))],
    ...LEG_Y.map((y, i) => [`leg${i + 1}${S}`, () => capD(f, [5.5, y, 3], [6.6, y - 0.6, 0.9], 1.5, 1.1)]),
  ]);
}

// the flame flickers in every clip (whole beats per clip, so loops close)
const flick = (t, u, seconds) => {
  const n = Math.max(1, Math.round(seconds * 8));
  const k = Math.floor(u * n) % n;
  const a = hash(k + 1); const b = hash(k + 31);
  return { flame: { s: [0.9 + 0.2 * a, 0.9 + 0.2 * a, 0.85 + 0.3 * b], r: [0, (a - 0.5) * 10, 0] } };
};
const base0 = insectClips({ tail, legs: 5, stride: 10, lift: 8, buzz: 0 });
const base = Object.fromEntries(Object.entries(base0).map(([n, c]) => [n, { ...c, pose: (t, u) => merge(c.pose(t, u), flick(t, u, c.seconds)) }]));

const clips = {
  ...base,
  // fidget: the flame flares up big, the grub puffs proudly, then it dies back with a little cough
  idle_flare: {
    seconds: 2,
    pose: (t, u) => {
      const up = win(u, 0.1, 0.6, 0.12);
      const cough = Math.sin(TAU * 6 * u) * win(u, 0.65, 0.85, 0.03);
      return merge(base.idle.pose(t, u), {
        flame: { s: [1 + 0.5 * up, 1 + 0.5 * up, 1 + 0.8 * up] },
        body: { r: [-3 * up + 2 * cough, 0, 0] },
        head: { r: [-8 * up + 6 * cough, 0, 0] },
      });
    },
  },
};

export default rigDef({ joints, assign, clips });
