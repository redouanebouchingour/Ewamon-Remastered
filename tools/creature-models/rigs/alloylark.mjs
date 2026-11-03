// Alloylark's rig: a steel songbird in a low crouch, a silver helm and crest blade, wings of long blade feathers
// raised up and back, a blade tail, one foot stepped forward. Numbers are scad/alloylark.scad's (sprite-match model,
// 2026-11-03). The scad builds the bird in a local frame turned T degrees about Z (its axis yawed to show the profile
// art); the parts are tested in that frame and every joint's rest frame is that turn, so the clips' nods, flaps and
// leg swings follow the bird's own axis.
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { any, ell, limb, petal, pick } from './lib/biped.mjs';
import { rot } from './lib/geo.mjs';
import { blinks, eyeKit } from './lib/face.mjs';

const T = 25;
const D = Math.PI / 180;
const KA = Math.sin((30 + T) * D);
const KW = Math.cos((30 + T) * D);
/** scad S(s, z, w): the local point that lands on sheet (s, z) at lateral offset w. */
const S = (s, z, w = 0) => { const y = (s - KW * w) / KA; return [w, y, z - 0.17 * (-0.82 * w + 0.57 * y)]; };
/** local -> scad (the scad's rotate([0, 0, -T])) and back. */
const W = (p) => rot([0, 0, -T], p);
const toLocal = (c) => rot([0, 0, T], c);
const FR = { rot: [0, 0, -T] };

const DARK = [0.2, 0.19, 0.25];

/** blade(a, b, w): a flat blade feather, tested as a tapering capsule. */
const bl = (a, b, w) => limb(a, b, w * 0.8, 0.3);

// The painted cyan slits on the head's sides, looking outward and a little forward (local yaw 90 - 20).
const eyeAt = (side) => W(S(-12.3, 29.4, 3.9 * side));
const face = eyeKit({
  eyes: [
    { side: 'L', at: eyeAt(1), size: 1, yaw: 70 - T },
    { side: 'R', at: eyeAt(-1), size: 1, yaw: -70 - T },
  ],
  skin: DARK,
  lid: [1.05, 0.85, 1.17],
});

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: W(S(2.2, 10.5, 3)), ...FR },
  { name: 'legR', parent: 'root', at: W(S(-3.5, 11, -3)), ...FR },
  { name: 'body', parent: 'root', at: W(S(-1, 9)), ...FR },
  { name: 'head', parent: 'body', at: W(S(-12, 23.5)), ...FR },
  { name: 'crest1', parent: 'head', at: W(S(-15, 30.5)), ...FR },
  { name: 'wingL', parent: 'body', at: W(S(1.5, 23.5, 5)), ...FR },
  { name: 'wingR', parent: 'body', at: W(S(1.5, 23.5, -5)), ...FR },
  { name: 'tail1', parent: 'body', at: W(S(5, 13.5)), ...FR },
  ...face.joints,
];

const CH = S(-10.5, 18.5);
const CHR = [5.2, 5.6, 7];
const thighPlate = (k) => petal([2.2, 4.4, 3.2], S(0.5, 12, 3.4 * k), [20, 0, 0]);

const parts = [
  ['legL', any(limb(S(2.2, 10.5, 3), S(3.3, 3.6, 3), 1.8, 1.3), ell([1.3, 1.3, 1.2], S(3.3, 3.2, 3)),
    bl(S(3.3, 3, 3), S(-1.3, 0.5, 4.2), 1.5), bl(S(3.3, 3, 3), S(1.6, 0.25, 3), 1.5), bl(S(3.3, 3, 3), S(7.2, 0.5, 2.4), 1.5),
    thighPlate(1))],
  ['legR', any(limb(S(-3, 11.5, -3), S(-8.5, 7.5, -3), 2.8, 1.8), limb(S(-5, 10, -3), S(-10.3, 5.2, -3), 1.8, 1.3),
    ell([1.3, 1.3, 1.2], S(-10.4, 5, -3)), bl(S(-10.4, 5, -3), S(-16, 0.5, -3.6), 1.5),
    bl(S(-10.4, 5, -3), S(-15.6, 3.8, -2.4), 1.5), bl(S(-10.4, 5, -3), S(-6, 3.2, -3), 1.1), thighPlate(-1))],
  ['body', any(petal(CHR, CH, [22, 0, 0]), ell([5.2, 5, 4.5], S(-3, 19.5)), ell([5, 6, 4], S(-2, 12.5)),
    ell([3.8, 5, 3.4], S(5, 14.5)), ell([3.8, 3.8, 4.4], S(-12.5, 23.5)))],
  ['body*', any(petal([2.4, 4.6, 5], S(-1.5, 21, 4.3), [15, 0, 0]), petal([2.2, 5, 3.4], S(4, 16, 3.4), [-15, 0, 0]),
    petal([2, 4.2, 2.4], S(8.5, 12.5, 2.2), [-10, 0, 0]))],
  ['head', any(ell([4.4, 6, 4.4], S(-13.5, 27.3)), ell([3, 3, 2.8], S(-18.5, 25.8)), limb(S(-19.5, 25.6), S(-23.8, 25.1), 1.4, 0.2),
    // the helm ridge
    limb(S(-24.8, 26.2), S(-19, 28.7), 0.3, 1.4), ell([2.4, 2.4, 1.4], S(-19, 28.7)), ell([3.6, 3.4, 1.6], S(-13, 31.2)),
    ell([2, 2.4, 1.3], S(-7.5, 33.3)), limb(S(-7.5, 33.3), S(-2.4, 35.6), 1.3, 0.3),
    bl(S(-19, 27), S(-24.5, 31.2), 1.8))],
  ['head*', any(ell([2.6, 2.8, 2.6], S(-8.5, 28.4, 2.2)), ell([1.4, 3.4, 1.5], S(-14.5, 25.6, 3.3)),
    ell([0.5, 0.85, 1.15], S(-12.3, 29.4, 3.9)))],
  ['crest1', any(bl(S(-15.5, 30.5), S(-7, 39.8), 2.3), bl(S(-18, 29.3), S(-25.2, 36.4), 1.9))],
  ['wing*', any(limb(S(3, 23.5, 5.5), S(12, 26.5, 7.5), 2.6, 2.4), bl(S(0.5, 24.5, 5.5), S(22.7, 37.8, 9.5), 2.6),
    bl(S(4.5, 24, 6), S(25, 31, 10), 2.4), bl(S(5.5, 21.5, 6), S(21, 22.8, 10), 2.2), bl(S(7, 19.5, 4.5), S(10, 17.5, 9), 0.7))],
  ['tail1', any(bl(S(5, 14.5, 1.2), S(18.3, 16.2, 2.6), 1.7), bl(S(5, 12.5, 1.2), S(16, 10.6, 3), 1.6),
    bl(S(6, 15.8, 0.6), S(11.5, 17.8, 1.2), 1.2))],
];

// body* / head* are mirrored parts of the body and head: strip the side suffix pick() adds.
const assign = (c) => {
  const n = pick(toLocal(c), parts);
  return n === 'bodyL' || n === 'bodyR' ? 'body' : n === 'headL' || n === 'headR' ? 'head' : n;
};

const clips = birdClips({
  face, crest: ['crest1'], tail: ['tail1'], flapUp: 30,
  add: { hurt: (t, u) => ({ crest1: { r: [-10 * win(u, 0, 1, 0.1), 0, 0] } }) },
});

// fidget: a little song, the head thrown back and the beak trilling, the crest blades ringing
clips.idle_sing = {
  seconds: 2,
  pose: (t, u) => {
    const up = K(u, [[0, 0], [0.15, 1], [0.8, 1], [0.95, 0]]);
    const trill = osc(u, 14) * win(u, 0.2, 0.78, 0.04);
    return merge({
      body: { r: [-4 * up, 0, 0] },
      head: { r: [-16 * up + 2 * trill, 0, 6 * Math.sin(TAU * 2 * u) * up] },
      crest1: { r: [3 * trill, 0, 2 * trill] },
      ...face.pose(up > 0.5 ? 'happy' : 'open', blinks(u, [[0.9, 0.95]])),
      wingL: { r: [0, -6 * up, 0] },
      wingR: { r: [0, 6 * up, 0] },
    });
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
