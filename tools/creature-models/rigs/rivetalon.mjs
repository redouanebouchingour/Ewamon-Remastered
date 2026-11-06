// Rivetalon's rig: a steel raptor in a forward-leaning crouch, huge blade wings spread wide and raised (the near one
// swept back, the far one forward), a crown of blade crests, a gold hooked beak, a blade tail fanned out to its left.
// Numbers are scad/rivetalon.scad's (sprite-match model, 2026-11-04). The scad builds the bird in a local frame turned
// T degrees about Z (as Alloylark); the parts are tested in that frame and every joint's rest frame is that turn, so
// the clips' nods, flaps and leg swings follow the bird's own axis. The two wings are not mirror images: each has its
// own blade list.
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { any, ell, limb, petal, pick } from './lib/biped.mjs';
import { rot } from './lib/geo.mjs';
import { blinks, eyeKit } from './lib/face.mjs';

const T = 20;
const D = Math.PI / 180;
const KA = Math.sin((30 + T) * D);
const KW = Math.cos((30 + T) * D);
/** scad S(s, z, w): the local point that lands on sheet (s, z) at lateral offset w. */
const S = (s, z, w = 0) => { const y = (s - KW * w) / KA; return [w, y, z - 0.17 * (-0.82 * w + 0.57 * y)]; };
/** local -> scad (the scad's rotate([0, 0, -T])) and back. */
const W = (p) => rot([0, 0, -T], p);
const toLocal = (c) => rot([0, 0, T], c);
const FR = { rot: [0, 0, -T] };
const add = (a, b) => a.map((v, i) => v + b[i]);
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

const DARK = [0.2, 0.2, 0.31];
const WW = 1.3;

/** blade(a, b, w): a flat blade feather, tested as a tapering capsule. */
const bl = (a, b, w) => limb(a, b, w * 0.8, 0.3);

// [root, tip, half-width, colour, cyan tip] as in the scad
const NEAR = [
  [S(4.5, 28, 7), S(22.9, 39.9, 24), 2.7], [S(5.5, 26.5, 7.5), S(24.2, 32.7, 25), 2.7], [S(5.5, 24.5, 7.5), S(20, 26.1, 22), 2.5],
  [S(4.5, 23, 7), S(14.5, 21, 17), 2.0], [S(5, 27, 7.5), S(18.5, 33.5, 19), 2.4], [S(5.5, 25.5, 7.5), S(18, 28.5, 19), 2.4],
  [S(5, 24, 7.5), S(14, 24.5, 15), 2.2],
  [S(-0.5, 25.5, 5.5), S(8.4, 30.9, 10), 1.8], [S(2.5, 27, 6.5), S(13.5, 35.1, 13), 2.0], [S(3, 25.5, 6.5), S(15.5, 30, 16), 1.9],
  [S(3, 24.5, 6.5), S(11, 27.5, 12), 1.9], [S(2.5, 23.5, 6), S(9, 24.5, 10.5), 1.7],
  [S(3, 22.5, 6.5), S(8.5, 17.5, 11), 1.3, 'tip'], [S(4, 23, 7), S(12, 18.5, 14), 1.4, 'tip'],
];
const FAR = [
  [S(-4, 27.5, -7), S(-23, 39.5, -24), 2.7], [S(-5, 26, -7.5), S(-24.2, 32.6, -25), 2.7], [S(-4, 27, -6.5), S(-17.4, 37.2, -18), 2.2],
  [S(-4, 26, -6), S(-14.7, 34.3, -15), 1.6], [S(-5, 24, -7), S(-19, 27.2, -19), 2.0], [S(-4.5, 25.5, -6), S(-12.5, 30.5, -11), 1.8],
  [S(-4.5, 27, -7), S(-20, 36.2, -21), 2.3], [S(-5, 25, -7.5), S(-21, 30.5, -21), 2.3], [S(-4, 26.5, -6), S(-10.5, 33, -10), 1.5],
  [S(-5, 22.5, -6.5), S(-10.5, 17.5, -11), 1.3, 'tip'], [S(-5.5, 23, -7), S(-14, 18.5, -14), 1.4, 'tip'],
];
const TAIL = [
  [S(4, 16, 1.5), S(16.7, 16.2, 6), 1.7], [S(4, 14, 1.5), S(19.6, 10.1, 9), 2.0], [S(4, 13, 1), S(10.8, 9.2, 4), 1.4],
  [S(4, 13, 2), S(17, 5, 13), 1.8], [S(3.5, 12.5, 0), S(12, 3.5, 7), 1.6], [S(3.5, 13.5, -0.5), S(13, 12.5, 2), 1.4],
];

const CHEST = [S(-9, 19.5), [4.6, 5, 6]];
const BACK = [S(-2.5, 20.5), [5.2, 6.2, 5.2]];
const BELLY = [S(-3.5, 14.5), [4.6, 6, 4.2]];
const RUMP = [S(3.5, 15), [3.8, 5, 3.8]];
const HEAD = [S(-10.3, 26.8), [3.1, 3.7, 3.2]];
const EYE = S(-10.3, 28.6, 2.55);

// lib.scad eye(EYE, 0.72, yaw = 62, lid = 0.3) on each side (mirror_x() inside the turned frame)
const face = eyeKit({
  eyes: [
    { side: 'L', at: W(EYE), size: 0.72, yaw: 62 - T },
    { side: 'R', at: W([-EYE[0], EYE[1], EYE[2]]), size: 0.72, yaw: -62 - T },
  ],
  skin: DARK,
});

const WINGL = [5, -2, 25];
const WINGR = [-5, -2, 25];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: W(S(2, 11, 3.6)), ...FR },
  { name: 'legR', parent: 'root', at: W(S(-5, 11, -3.6)), ...FR },
  { name: 'body', parent: 'root', at: W(S(-2, 10)), ...FR },
  { name: 'head', parent: 'body', at: W(S(-9.8, 23.5)), ...FR },
  { name: 'crest1', parent: 'head', at: W(S(-12, 29.5)), ...FR },
  { name: 'wingL', parent: 'body', at: W(WINGL), ...FR },
  { name: 'wingR', parent: 'body', at: W(WINGR), ...FR },
  { name: 'tail1', parent: 'body', at: W(S(4, 13.5, 1)), ...FR },
  ...face.joints,
];

const thighPlate = (k) => petal([2.6, 3.8, 4], S(1.5, 13, 4 * k), [15, 0, 0]);
/** a wing: its blades, the inner fan (root to 38 % of each blade), the arm along the leading edge and the gold trim */
const wing = (list, root, k) => any(
  ...list.map(([a, b, w]) => bl(a, b, w * WW)),
  ...list.filter((b) => !b[3]).map(([a, b]) => limb(root, lerp(a, b, 0.38), 1.6, 0.9)),
  limb(root, k > 0 ? S(10, 29.5, 11) : S(-10, 29.5, -11), 1.8, 1),
  limb(add(root, [-0.5 * k, -0.4, 2.6]), k > 0 ? S(10, 31, 11) : S(-10, 31, -11), 0.4, 0.35),
);

const parts = [
  ['legL', any(limb(S(2, 11, 3.6), S(5, 4.2, 3.8), 2.2, 1.6), ell([2.1, 2.2, 1.9], S(5, 4, 3.8)),
    limb(S(5, 3.6, 3.8), S(3, 1.2, 5.6), 1.2, 0.25), limb(S(5, 3.6, 3.8), S(5, 0.2, 4), 1.3, 0.25),
    limb(S(5, 3.6, 3.8), S(8.2, 1, 3), 1.2, 0.25), limb(S(5, 3.6, 3.8), S(7, 3, 2.5), 1.0, 0.2), thighPlate(1))],
  ['legR', any(limb(S(-5, 11, -3.6), S(-10.5, 3.6, -3.8), 2.2, 1.6), ell([2.1, 2.2, 1.9], S(-10.5, 3.4, -3.8)),
    limb(S(-10.5, 3, -3.8), S(-17, 0.4, -3.8), 1.3, 0.25), limb(S(-10.5, 3, -3.8), S(-15, 0.3, -2), 1.2, 0.25),
    limb(S(-10.5, 3, -3.8), S(-15, 0.3, -5.8), 1.2, 0.25), limb(S(-10.5, 3, -3.8), S(-7.5, 1.2, -3.8), 1.0, 0.2), thighPlate(-1))],
  // the torso (the gold plates and seams lie on it, grown a little)
  ['body', any(...[CHEST, BACK, BELLY, RUMP].map(([p, r]) => ell(r, p)))],
  ['body*', petal([1.9, 4.4, 3.6], S(-1.5, 24.5, 4.6), [20, 15, 0])],
  ['head', any(ell(HEAD[1], HEAD[0]), limb(S(-9.5, 21.5), add(HEAD[0], [0, 0.6, -0.8]), 3.6, 2.8),
    // beak, lower beak, the visor
    limb(S(-13, 26.2), S(-16.8, 24.2), 1.5, 0.25), limb(S(-12.8, 25), S(-15, 24.6), 1.1, 0.3),
    limb(S(-15.4, 26.4), S(-12.5, 28.6), 0.35, 1.6), ell([2.9, 3, 1.4], S(-9.5, 29.4)), ell([2.2, 2, 1.1], S(-12.5, 28.6)))],
  ['head*', any(limb(S(-12.6, 28.4, 1.8), S(-8, 30.2, 2.4), 0.4, 0.8), ell([0.85, 0.85, 0.95], EYE))],
  ['crest1', any(bl(S(-12.5, 29.2), S(-11.6, 35), 0.9), bl(S(-12.8, 29.6), S(-7.3, 37.2), 1.6))],
  ['crest1*', any(bl(S(-11.5, 29.4, 1), S(-3.6, 35, 1.6), 1.5), bl(S(-11.5, 29, 1.8), S(-2, 32.8, 2.6), 1.4),
    bl(S(-10.5, 28.6, 2.3), S(-3, 30.5, 3.2), 1.0))],
  ['wingL', wing(NEAR, WINGL, 1)],
  ['wingR', wing(FAR, WINGR, -1)],
  ['tail1', any(...TAIL.map(([a, b, w]) => bl(a, b, w)))],
];

// '*' parts are mirrored parts of one joint: strip the side suffix pick() adds.
const assign = (c) => pick(toLocal(c), parts).replace(/^(body|head|crest1)[LR]$/, '$1');

const clips = birdClips({
  face, crest: ['crest1'], tail: ['tail1'], flapUp: 24,
  add: { hurt: (t, u) => ({ crest1: { r: [-10 * win(u, 0, 1, 0.1), 0, 0] } }) },
});

// fidget: a slow display, the great wings spread wider and the blades rattle, the head raised proudly
clips.idle_display = {
  seconds: 2.4,
  pose: (t, u) => {
    const on = K(u, [[0, 0], [0.2, 1], [0.72, 1], [0.92, 0]]);
    const rattle = osc(u, 18) * win(u, 0.25, 0.7, 0.05);
    return merge({
      body: { r: [-5 * on, 0, 0] },
      head: { r: [-10 * on, 0, 8 * Math.sin(TAU * u) * on] },
      crest1: { r: [2 * rattle, 0, 0] },
      ...face.pose('open', blinks(u, [[0.8, 0.85]])),
      wingL: { r: [0, -12 * on - 2 * rattle, -6 * on] },
      wingR: { r: [0, 12 * on + 2 * rattle, 6 * on] },
      tail1: { r: [0, 0, 4 * smooth(on) * osc(u, 2)] },
    });
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
