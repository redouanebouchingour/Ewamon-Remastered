// Vysion's rig: a floating synthezoid spirit, its waist tapering into a curling wisp tail, a golden cape in ribbons off
// the shoulders (capeL / capeR / capeB, layered on the floater clips), the chest gem as the pulsing core and its narrow
// glowing eyes as one decal. Numbers are scad/vysion.scad's.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, blob, ell, limb, pick } from './lib/biped.mjs';
import { floaterClips } from './lib/floater.mjs';
import { capD, chainHit, closest, fold, isAny, near, side } from './lib/geo.mjs';

const GOLD = [[1, 0.88, 0.4], [0.96, 0.74, 0.28], [1, 0.92, 0.45]];
const EYE = [1, 0.95, 0.75];
const CLAW = [0.62, 0.7, 0.66];

const TAIL = [[0.5, 0.6, 13], [1.5, 0.2, 9], [0.5, -0.5, 5.5], [-1.5, 0.5, 3], [-3, 1, 3], [-3.5, 1, 5]];
const TAIL_R = [2.2, 1.8, 1.4, 1, 0.7, 0.3];
const tail = ['tail1', 'tail2', 'tail3', 'tail4'];

// the cape's ribbons (mirror_x() ones written for +X), tested as capsules of their half widths
const SIDE_RIBBONS = [
  [[[4.5, 1, 34.5], [10, 1.5, 33], [15, 3.5, 28]], [1.4, 1.4, 0.6]],
  [[[10, 2, 33], [15, 3.5, 27], [17, 4.5, 20], [16.5, 5, 13], [15, 5.5, 8]], [2.8, 3, 2.8, 2, 0.6]],
  [[[8, 3, 32], [12, 4.5, 24], [12.5, 5.5, 16], [11, 6, 10]], [2.4, 2.6, 2, 0.5]],
  [[[3.5, 4, 32], [5, 5.5, 24], [5.5, 6.5, 15], [4.5, 7, 9]], [2.6, 2.8, 2.2, 0.5]],
];
const BACK_RIBBON = [[[0, 4.5, 31], [0, 6, 22], [0.5, 7, 14]], [3, 3, 0.8]];
const ribbonD = (c, [pts, rs]) => chainHit(c, pts, rs).d;

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 21] },
  { name: 'core', parent: 'body', at: [0, -4, 31.5] },
  { name: 'head', parent: 'body', at: [0, 0, 35] },
  { name: 'eyes', parent: 'head', at: [0, -3.6, 39.8] },
  { name: 'armL', parent: 'body', at: [7, 0, 32.5] },
  { name: 'handL', parent: 'armL', at: [9.5, -1, 25] },
  { name: 'armR', parent: 'body', at: [-7, 0, 32.5] },
  { name: 'handR', parent: 'armR', at: [-9.5, -1, 25] },
  { name: 'capeL', parent: 'body', at: [5, 1.5, 33.5] },
  { name: 'capeR', parent: 'body', at: [-5, 1.5, 33.5] },
  { name: 'capeB', parent: 'body', at: [0, 4.5, 31] },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i] })),
];

const parts = [
  ['head', any(blob([[[3.4, 3.4, 4], [0, -0.5, 39.5]]]), ell([2.4, 1.6, 2.8], [0, -2.4, 38.6]), ell([1.6, 1, 2.2], [0, -3.1, 39.6]),
    ell([0.9, 1.8, 0.8], [0, -1.4, 43.2]), limb([0, 0, 35], [0, -0.5, 37], 1.6), (c) => capD(fold(c), [2.8, -0.5, 40.5], [5.2, 1.5, 45.5], 1.5, 0.3))],
  ['body', any(blob([[[6.5, 3.8, 4], [0, 0, 31]], [[4, 3, 3], [0, 0, 26]]]), ell([3, 1.2, 3.2], [0, -2.4, 25.5]),
    blob([[[4, 3, 2.6], [0, 0.3, 21]]]), blob([[[3.2, 2.6, 3], [0, 0.5, 17]]]), (c) => ell([1.3, 1, 2], [1.8, -1.4, 19])(fold(c)),
    (c) => blob([[[1.4, 1, 3.6], [4.3, -2.2, 31]], [[1, 0.8, 2], [3, -2.8, 27]]])(fold(c)))],
  ['arm*', any(ell([2.6, 2.4, 2.2], [7, 0, 32.5]), limb([7.5, 0, 31], [9.5, -1, 25], 1.6, 1.4))],
  ['hand*', any(ell([1.6, 1.6, 1.6], [9.5, -1, 25]), limb([9.5, -1, 25], [10.5, -2.5, 19], 1.4, 1.3), ell([1.4, 1.2, 1.4], [10.8, -2.8, 18]))],
  ...TAIL.slice(0, -1).map((p, i) => [tail[Math.min(i, 3)], limb(p, TAIL[i + 1], TAIL_R[i], TAIL_R[i + 1])]),
];

function assign(c, rgb) {
  const S = side(c);
  if (near(rgb, EYE, 0.03) && c[2] > 38) return 'eyes';
  if (near(rgb, CLAW, 0.03)) return `hand${S}`;
  if (isAny(rgb, GOLD, 0.05)) {
    if (c[1] < -2.8) return c[2] > 36 ? 'head' : c[2] > 28 ? 'core' : 'body';
    if (capD(fold(c), [10.3, -2.3, 20.5], [10.3, -2.3, 20.5], 2) < 1) return `hand${S}`;
    if (c[2] < 9 && c[1] < 3) return 'body';                       // the sparks scattered round the tail
    return closest([[`cape${S}`, Math.min(...SIDE_RIBBONS.map((r) => ribbonD(fold(c), r)))], ['capeB', ribbonD(c, BACK_RIBBON)]]);
  }
  if (c[2] < 13.5 && c[1] > -3) {
    const h = chainHit(c, TAIL, TAIL_R);
    if (h.d < 1.6 || c[2] < 9) return tail[Math.min(h.i, 3)];
  }
  return pick(c, parts);
}

// the cape: ry flares a side drape out, rx streams it back (it hangs from the shoulders)
const cape = (back, flare = 0, sway = 0) => ({
  ...both('cape', { r: [back, -flare, sway] }),
  capeB: { r: [back * 1.2, 0, sway * 0.5] },
});
const add = {
  idle: (t, u) => cape(2 + 2 * osc(u, 2, 0.3), 2 * osc(u, 2, 0.6), 2 * osc(u, 1, 0.2)),
  walk: (t, u) => cape(14 + 3 * osc(u, 2, 0.2), 6, 3 * osc(u, 1)),
  windup: (t, u) => cape(-4 * smooth(u / 0.8), 14 * smooth(u / 0.8)),
  lunge: (t, u) => { const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]); return cape(18 * hit, 10 - 8 * hit); },
  hurt: (t, u) => { const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.45]]); return cape(-8 * k, 16 * k, 6 * Math.sin(TAU * 5 * u) * (1 - u)); },
  recoil: (t, u) => cape(-5 * K(u, [[0, 0], [0.4, 1], [1, 0]])),
  faint: (t, u) => { const d = smooth((u - 0.15) / 0.6); return cape(-10 * d, -6 * d); },
  celebrate: (t, u) => cape(8, 20 + 10 * Math.sin(TAU * 3 * u), 0),
  enter: (t, u) => cape(0, 24 * win(u, 0.4, 0.95, 0.12)),
  exit: (t, u) => cape(6, 10),
};

const clips = floaterClips({ tail, bob: 1, add });
delete clips.idle_spin;
delete clips.idle_cackle;

// fidget: scans the field like a machine, the head ticking round in steps, the eyes narrowing, the core flaring
clips.idle_scan = {
  seconds: 2.4,
  pose: (t, u) => {
    const step = (x) => Math.floor(x * 4) / 4 + smooth((x * 4 % 1) * 3) / 4;
    const turn = u < 0.45 ? -30 + 60 * step(u / 0.45) : 30 * K(u, [[0.45, 1], [0.6, -1], [0.75, -1], [0.9, 0]]);
    const on = win(u, 0.05, 0.9, 0.08);
    return merge({
      body: { p: [0, 0, 0.5 + 0.5 * osc(u, 1)] },
      head: { r: [0, 0, turn * on] },
      eyes: { s: [1, 1, 1 - 0.3 * on] },
      core: { s: 1 + 0.25 * on * (osc(u, 6) * 0.5 + 0.5) },
    }, cape(2, 2 * osc(u, 2)));
  },
};

// fidget: spreads its arms and lets the cape billow out like wings, rising, then settles
clips.idle_billow = {
  seconds: 2.6,
  pose: (t, u) => {
    const up = K(u, [[0, 0], [0.3, 1], [0.7, 1], [0.92, 0]]);
    return merge({
      body: { p: [0, 0, 0.5 + 1.6 * up], r: [-6 * up, 0, 0] },
      head: { r: [-10 * up, 0, 0] },
      core: { s: 1 + 0.2 * up },
      ...both('arm', { r: [0, -60 * up, 10 * up] }),
      ...both('hand', { r: [0, -20 * up, 0] }),
    }, cape(6 * up + 3 * osc(u, 3) * up, 30 * up + 6 * osc(u, 3) * up));
  },
};

export default rigDef({ joints, assign, clips });
