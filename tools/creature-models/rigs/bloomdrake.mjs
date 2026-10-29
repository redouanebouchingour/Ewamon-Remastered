// Bloomdrake's rig: a caterpillar-dragon on three pairs of stubby legs, so it uses the insect template (tripod walk):
// the front segments and the neck base are the body, the back segments the abdomen, the head rides the upper neck
// with its antlers, the leaf wings are spread in a V, and the tail stem (tail1) carries the sunflower (tail2).
// Template gap: insect.mjs swings sprawled legs forward with rz; these legs hang straight down, so the walk adds the
// stride as rx here. The head sits inside the scad's `translate([0, 0, 3.6]) scale(0.93)` (headF), the wings inside
// `translate([4, 4, 18]) rotate([0, 0, 12]) rotate([0, 12, 0])` (wingF). Numbers are scad/bloomdrake.scad's.
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { insectClips } from './lib/insect.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, capD, chainHit, closest, ellD, fold, isAny, near, rot, side, subFrame, unrot } from './lib/geo.mjs';

const GREEN = [0.36, 0.6, 0.27];
const GREEN_DK = [0.22, 0.42, 0.2];
const ANTLER = [0.5, 0.36, 0.25];
const CLAW = [0.85, 0.25, 0.18];
const FLOWER = [[0.95, 0.45, 0.12], [0.82, 0.28, 0.1], [0.42, 0.25, 0.1]];

const headF = subFrame([0, 0, 3.6], [0, 0, 0], 0.93);
const wingF = subFrame([4, 4, 18], [0, 12, 12]);
const SEGS = [[0, 7, 6.8], [4.5, 7, 6.6], [9, 6.6, 6.2], [13.5, 6, 5.6], [17.5, 5.2, 5], [21.2, 4.4, 4.2], [24.6, 3.5, 3.6], [27.6, 2.6, 3]];
const STEM = [[0, 29, 3.4], [-4, 31, 5], [-9, 30, 8], [-12, 27, 12]];
const NECK = [[0, -1, 8], [0, -3, 14], [0, -3.5, 21]];
const LEG_Y = [0, 8, 15];

const eyeL = { side: 'L', at: [4.3, -10.5, 23.4], size: 2.2, yaw: 22, flat: 0.45, frame: headF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: GREEN });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...LEG_Y.flatMap((y, i) => [
    { name: `leg${i + 1}L`, parent: 'root', at: [4.6, y, 4] },
    { name: `leg${i + 1}R`, parent: 'root', at: [-4.6, y, 4] },
  ]),
  { name: 'body', parent: 'root', at: [0, 3, 3] },
  { name: 'abdomen', parent: 'body', at: [0, 11.2, 5.8] },
  { name: 'tail1', parent: 'abdomen', at: STEM[0] },
  { name: 'tail2', parent: 'tail1', at: STEM[3] },
  { name: 'head', parent: 'body', at: [0, -3.2, 17.5] },
  { name: 'wingL', parent: 'body', at: [4, 4, 18] },
  { name: 'wingR', parent: 'body', at: [-4, 4, 18] },
  ...face.joints,
];

// the six leaf feathers of a wing, in the wing's own frame
const wingD = (f) => {
  const q = wingF.local(f);
  return Math.min(...[0, 1, 2, 3, 4, 5].map((k) => {
    const l = 13 + (5 - Math.abs(k - 1.5)) * 1.6;
    return ellD(unrot([0, 18 + k * 11, 0], q), [2, 0.6, l * 0.55], [0, 0, l * 0.55]);
  }), capD(q, [0, 0, 0], rot([0, 0, 0], [Math.sin(0.314) * 20, 0, Math.cos(0.314) * 20]), 1.2, 0.5));
};
const headD = (c) => {
  const q = headF.local(c);
  return Math.min(blobD(q, [[[9, 7.6, 6.8], [0, -3.5, 22]], [[6.8, 4.6, 4.2], [0, -9, 20.4]]]), ellD(q, [3.6, 3, 1.6], [0, -1, 27.6]),
    ellD(q, [2.4, 2.4, 1.2], [0, 2, 26]), ellD(fold(q), [2.4, 2.4, 1.4], [4.2, -1, 26.6]));
};

function assign(c, rgb) {
  const f = fold(c);
  const S = side(c);
  if (near(rgb, CLAW) || (near(rgb, GREEN_DK) && c[2] < 4.6 && f[0] > 3.4)) {
    const i = LEG_Y.reduce((b, y, k) => (Math.abs(c[1] - y) < Math.abs(c[1] - LEG_Y[b]) ? k : b), 0);
    return `leg${i + 1}${S}`;
  }
  if (isAny(rgb, FLOWER, 0.03)) return 'tail2';
  if (near(rgb, ANTLER, 0.03) && c[2] > 26) return 'head';
  const stem = chainHit(c, STEM, [1.8, 1.4, 1.1, 0.9]);
  const neck = chainHit(c, NECK, [5.6, 4.8, 4.2]);
  const segD = (lo, hi) => Math.min(...SEGS.slice(lo, hi).map(([y, r, z]) => ellD(c, [r * 1.05, 3.4, r], [0, y, z])));
  return closest([
    ['tail1', stem.d * (c[1] > 28.4 || c[0] < -1.5 ? 1 : 1.5)],
    [`wing${S}`, wingD(f)],
    ['head', Math.min(headD(c), neck.i === 1 && neck.t > 0.5 ? neck.d : Infinity)],
    ['body', Math.min(segD(0, 3), neck.i === 0 || neck.t <= 0.5 ? neck.d : Infinity, ellD(c, [5.2, 9, 2.5], [0, 6, 2.6]))],
    ['abdomen', segD(3, 8)],
  ]);
}

// the walk's stride for legs hanging straight down: rx, on the template's tripod phases
const stride = (u) => Object.fromEntries(LEG_Y.flatMap((_, i) => ['L', 'R'].map((S) => {
  const ph = (i % 2 === 0) === (S === 'L') ? 0 : 0.5;
  return [`leg${i + 1}${S}`, { r: [-14 * osc(u, 1, ph), 0, 0] }];
})));
const wings = (a) => ({ wingL: { r: [0, -a, 0] }, wingR: { r: [0, a, 0] } });

const clips = {
  ...insectClips({
    face, tail: ['tail1', 'tail2'], stride: 4, lift: 10, buzz: 18,
    add: {
      walk: (t, u) => merge(stride(u), wings(4 * osc(u, 2))),
      idle: (t, u) => merge(wings(3 * osc(u, 1)), { tail2: { r: [0, 0, 6 * osc(u, 1, 0.3)] } }),
      celebrate: (t, u) => wings(20 * Math.abs(Math.sin(TAU * 2 * u))),
    },
  }),

  // fidget: shakes its antlered head like a stag, then the sunflower tail turns to face the sun and bobs
  idle_bloom: {
    seconds: 2.8,
    pose: (t, u) => {
      const sh = Math.sin(TAU * 6 * u) * win(u, 0.06, 0.4, 0.05);
      const turn = K(u, [[0.42, 0], [0.56, 1], [0.86, 1], [0.98, 0]]);
      return merge({
        head: { r: [4 * Math.abs(sh), 0, 14 * sh] },
        ...face.pose(Math.abs(sh) > 0.3 ? 'squeeze' : 'open'),
        tail1: { r: [-10 * turn, 0, 16 * turn] },
        tail2: { r: [0, 0, 20 * turn + 6 * osc(u, 4) * turn] },
      }, wings(6 * turn));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
