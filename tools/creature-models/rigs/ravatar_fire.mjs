// Ravatar (fire relic)'s rig: Ravatar's body (rigs/ravatar.mjs) in obsidian armour. The pauldrons ride the upper
// arms, the bracers the forearms; the blaze round each fist is its own joint (flameL / flameR, off the hands) that
// flickers; the tail's lower sweep is tail1..tail4 and the great flame rising off it is tail5, which flickers too;
// the fire at each foot (fireL / fireR, off the legs) licks. Numbers are scad/ravatar_fire.scad's.
import { TAU, both, hash, rigDef, win } from './lib/anim.mjs';
import { any, blob, chain, ell, limb, mx, pair, pick } from './lib/biped.mjs';
import { isAny, rot } from './lib/geo.mjs';
import { ELBOW, HAND, SHOULDER, WRIST, baseJoints, bodyParts, clipsFor, faceFor, tails } from './ravatar.mjs';

const FUR = [0.75, 0.56, 0.41];
const FLAMEC = [[0.97, 0.45, 0.1], [0.99, 0.8, 0.28], [0.94, 0.26, 0.07]];
const TAILC = [[0.42, 0.24, 0.19], [0.7, 0.34, 0.2]];

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const lerp = (a, b, t) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);

const TAIL = [[1, 3.2, 11.5], [6, 6, 7.4], [11, 6, 7.2], [16, 4.5, 10.2], [17, 3, 15.4]];
const TAIL_R = [2, 3.3, 4.2, 4.6, 3.2];
const CREAM = [[6, 5.4, 5.4], [11.6, 5.4, 4.9], [18.3, 3.9, 9.2], [19.4, 2.8, 13.4]];
const CREAM_R = [2.4, 3.2, 3.5, 2.4];
const FOOT = [9.8, -1.6, 0];
const BACKPLATE = [[[5.8, 1.8, 4.5], [0, 3.4, 23.5]], [[4.4, 1.5, 3], [0, 3, 17.6]]];
const FIST_BODY = [[[0.2, -0.2, 0.8], [0.4, -0.3, 3.4]], [3, 2.5]];
const FIST_FL = [[[0, -0.2, 1.6], [0.8, -0.4, 6.6], 2, [0.9, 0, 0]], [[1.4, 0.2, 0.8], [2.8, 0.2, 5.2], 1.7, [0.6, 0, 0.4]],
  [[-1.2, -0.4, 1.2], [-1.6, -0.4, 4.8], 1.5, [-0.6, 0, 0]], [[1.4, -0.6, -0.6], [4, -0.6, 1.4], 1.4, [0, 0, -1.2]],
  [[0.2, 1, 1], [0.4, 1.4, 4.8], 1.5, [0.5, 0.3, 0]], [[-0.4, -1.4, -1.4], [2.4, -1.2, -2.2], 1.2, [0.8, 0, -0.6]]];
const TAIL_BODY = [[[15.6, 3.6, 11.5], [18.6, 2.8, 16.5], [20.4, 2.4, 22.5], [21, 2.2, 26]], [4.4, 4.8, 3.8, 2.2]];
const TAIL_FL = [[[20, 2.4, 19], [2, -0.4, 16], 3.6, [-1.8, 0, 0], 5], [[21, 2.4, 15], [6, 0, 12], 2.9, [1, 0, 0.6], 5],
  [[17.4, 3, 16], [-1.8, 0, 13], 2.7, [-1, 0, 0], 5], [[20, 2.6, 10.5], [6.5, -0.4, 6], 2.4, [0, 0, 1.2], 4],
  [[14, 4.6, 9], [-0.4, 0.4, 9.5], 2.6, [-0.8, 0, 0], 3], [[16.5, 5.4, 9], [0.6, 1.8, 11], 2.6, [0.8, 0, 0], 4],
  [[9.5, 3.6, 1.2], [2.5, -0.6, 6.5], 2.2, [0.8, 0, 0], 2], [[15, 3, 1.4], [3, -0.6, 6], 2, [0.6, 0, 0.6], 3]];
const FOOT_FL = [[[12.2, -1.6, 0.4], [5.4, -1, 6.6], 2.2, [0.8, 0, -1.4]], [[11, -4.4, 0.4], [1.8, -2.2, 4], 1.4, [0.6, 0, 0]],
  [[12, 1.4, 0.4], [2.4, 1.6, 4.2], 1.5, [0.6, 0, 0]], [[6.6, -2.4, 0.4], [-2.4, -0.6, 4.2], 1.6, [-0.6, 0, 0]]];

// scad flame(p, d, w, bend): a cubic S-curve through p, p + d / 3 + bend, p + 2d / 3 - bend / 2, p + d, radii FL_R * w
const FL_R = [0.85, 1, 0.78, 0.45, 0.1];
const cb = (a, b, c, e, t) => [0, 1, 2].map((i) => (1 - t) ** 3 * a[i] + 3 * t * (1 - t) ** 2 * b[i] + 3 * t * t * (1 - t) * c[i] + t ** 3 * e[i]);
const flame = (p, d, w, bend) => {
  const q = add(p, d);
  const b = add(lerp(p, q, 1 / 3), bend);
  const c = add(lerp(p, q, 2 / 3), bend.map((v) => -v / 2));
  const pts = [0, 0.25, 0.5, 0.75, 1].map((t) => cb(p, b, c, q, t));
  return any(...pts.slice(1).map((e, i) => limb(pts[i], e, w * FL_R[i] * 1.05, Math.max(0.3, w * FL_R[i + 1] * 1.05))));
};
const fireBody = ([pts, rs]) => any(...pts.slice(1).map((e, i) => limb(pts[i], e, rs[i], rs[i + 1])));
// scad shard(p, rot, w, t, h): a plate from p to its point h along the turned +Z
const shard = (p, r, w, h) => limb(p, add(p, rot(r, [0, 0, h])), w * 0.75, 0.3);

const flameParts = [
  ['flame*', fireBody([FIST_BODY[0].map((q) => add(HAND, q)), FIST_BODY[1]])],
  ...FIST_FL.map(([p, d, w, b]) => ['flame*', flame(add(HAND, p), d, w, b)]),
  ['tail5', fireBody(TAIL_BODY)],
  ...TAIL_FL.map(([p, d, w, b, j]) => [`tail${j}`, flame(p, d, w, b)]),
  ...FOOT_FL.map(([p, d, w, b]) => ['fire*', flame(p, d, w, b)]),
];
const TUFTS = [[[9.6, 5, 4], [3.4, -0.4, -1.2], 1.7, 'tail2'], [[14.8, 3.8, 5], [3.8, -0.4, -0.2], 1.8, 'tail3'],
  [[12.4, 6.6, 11.2], [-1, 0, 3.6], 1.7, 'tail3'], [[11, 8.4, 8.8], [3, 0.8, 0.6], 1.7, 'tail3'], [[5.6, 7.6, 9.4], [3, 0.6, -0.6], 1.5, 'tail2']];
const tailParts = [
  ...chain(tails, TAIL, TAIL_R),
  ...chain(['tail2', 'tail3', 'tail4'], CREAM, CREAM_R),
  ...TUFTS.map(([p, d, w, n]) => [n, limb(p, add(p, d), w, 0.3)]),
];
const S = SHOULDER;
const parts = [
  ...bodyParts,
  ['arm*', any(ell([3.3, 3.2, 2.3], add(S, [0.3, 0, 1.8])), shard(add(S, [0.6, -1.3, 3.2]), [12, 18, 0], 1.3, 5.6),
    shard(add(S, [0.4, 1.2, 3.2]), [-12, 15, 0], 1.2, 5), shard(add(S, [2.1, 0, 2.8]), [0, 38, 0], 1.2, 4.4),
    shard(add(S, [2.8, -1.4, 1.6]), [15, 62, 0], 1, 3.4), ell([0.8, 0.5, 0.6], add(S, [1, -3.05, 1.8])))],
  ['fore*', any(limb(lerp(ELBOW, WRIST, 0.2), lerp(ELBOW, WRIST, 0.75), 2.45, 2.35), shard(add(lerp(ELBOW, WRIST, 0.45), [1.8, 0.4, 0]), [0, 70, 15], 0.9, 3.2))],
  ['body', any(mx(ell([3, 1.45, 2.15], [2.8, -3.05, 20.6])), mx(ell([2.2, 0.5, 1.15], [2.75, -4.25, 20.6])),
    ell([2.4, 1.05, 2.2], [0, -2.75, 15.6]), ell([0.6, 0.5, 1.4], [0, -3.75, 15.6]), blob(BACKPLATE),
    mx(shard([3.6, 3.7, 26.6], [-25, 15, 0], 1.1, 3.2)))],
  ['leg*', ell([0.6, 0.5, 0.9], [8.6, -4.1, 5.4])],
];

function assign(c, rgb) {
  if (isAny(rgb, FLAMEC, 0.03)) return pick(c, flameParts);
  if (isAny(rgb, TAILC, 0.03)) return pick(c, tailParts);
  return pick(c, parts);
}

const face = faceFor(FUR);
const joints = [
  ...baseJoints,
  ...pair('flame*', 'hand*', add(HAND, [0.2, -0.2, 0.8])),
  ...pair('fire*', 'leg*', FOOT),
  ...face.joints,
];

// flicker on beats counted in u, so a loop's last frame equals its first
const flick = (u, steps, k = 1, base = 1) => {
  const i = Math.floor(u * steps) % steps;
  const a = (n) => base + k * 0.18 * (hash(i * 7 + n) - 0.5);
  return {
    ...both('flame', { s: [a(1), a(2), a(3) + 0.1 * k * (hash(i + 9) - 0.5)] }, { s: [a(4), a(5), a(6)] }),
    ...both('fire', { s: [a(8), a(8), a(9) + 0.1 * k] }, { s: [a(10), a(10), a(11) + 0.1 * k] }),
    tail5: { s: [1, 1, 1 + 0.6 * (a(12) - base)] },
  };
};
const clips = clipsFor({
  face,
  extra: {
    idle: (t, u) => flick(u, 40),
    walk: (t, u) => flick(u, 8),
    idle_look: (t, u) => flick(u, 24),
    windup: (t, u) => flick(u, 4, 1, 1 + 0.25 * u),
    lunge: (t, u) => flick(u, 6, 1.4, 1 + 0.35 * win(u, 0.25, 0.8, 0.1)),
    hurt: (t, u) => flick(u, 5, 2, 0.85),
    recoil: (t, u) => flick(u, 5, 1, 0.9),
    faint: (t, u) => flick(u, 18, 1, 1 - 0.75 * win(u, 0.3, 1.5, 0.5)),
    celebrate: (t, u) => flick(u, 12, 1.5, 1.25),
    enter: (t, u) => flick(u, 9, 1, 0.3 + 0.8 * Math.min(1, u * 1.6)),
    exit: (t, u) => flick(u, 7, 1, 1),
    idle_roar: (t, u) => flick(u, 48, 2, 1 + 0.4 * win(u, 0.2, 0.75, 0.1)),
    idle_swish: (t, u) => flick(u, 52),
  },
});

// fidget: it holds a blazing fist up before its face, the flame roars bigger, and it shakes it out
clips.idle_blaze = {
  seconds: 2.4,
  pose: (t, u) => {
    const up = win(u, 0.1, 0.75, 0.12);
    const shakeOut = win(u, 0.75, 0.97, 0.04) * Math.sin(TAU * 6 * u);
    return {
      ...flick(u, 48, 1.5, 1 + 0.5 * win(u, 0.25, 0.7, 0.1)),
      body: { r: [0, 0, 6 * up] },
      head: { r: [4 * up, 0, 14 * up] },
      ...face.pose('open', 0.4 * up),
      armL: { r: [-55 * up, -16 * up, 0] },
      foreL: { r: [-50 * up, 0, 0] },
      handL: { r: [0, 0, 10 * shakeOut] },
    };
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
