// Pebblit's rig: a round pebble-studded boulder with a face painted on its front, a pebble fist reaching out on its
// right (-X), a pebbled arm with a crystal hand hanging on its left (+X), two crystal-clump feet and two quartz
// clusters on top (they twitch like ears). The boulder is the body and carries the face. Numbers are
// scad/pebblit.scad's.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, ell, limb, pick } from './lib/biped.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { blobD, isAny, near, rot, subFrame } from './lib/geo.mjs';

// a crystal(p, d, r): a hexagonal prism with a blunt point, tested as a tapering capsule
const cry = (p, d, r) => limb(p, [p[0] + d[0], p[1] + d[1], p[2] + d[2]], r * 1.05, r * 0.6);
const add = (a, b) => a.map((v, i) => v + b[i]);

// the boulder (scad C, R) and the face frame: translate(C) rotate([0, 0, FA])
const C = [0, 0, 21.1];
const R = [13.3, 13, 12.6];
const FA = 17;
// eyes: faceFrame() mirror_x() translate(E) scale(ESQ) translate(-E) eye(E, ES = 1.8, yaw = EYAW, flat = 0.38)
const E = [5.1, -12.2, 1.1];
const ESQ = [1.2, 1, 0.8];
const eyeAt = (k) => {
  const at = [k * E[0], E[1], E[2]];
  return { side: k > 0 ? 'L' : 'R', at, size: 1.8, yaw: k * 22, flat: 0.38,
    frame: subFrame(add(C, rot([0, 0, FA], at.map((v, i) => v * (1 - ESQ[i])))), [0, 0, FA], ESQ) };
};
// the lid flattened to the almond and its dark rim (the frame scales its size by 1.2 all round)
const face = eyeKit({ eyes: [eyeAt(1), eyeAt(-1)], parent: 'body', skin: [0.88, 0.83, 0.88], lid: [1.14, 0.85, 0.8] });

// arms (scad FARM / FIST on -X, NARM / HAND on +X)
const FARM = [[3.2, 3.2, 3.2], [-13.6, -5.6, 19.4]];
const FIST = [[4.2, 4, 4.1], [-17.6, -8.6, 18.6]];
const NARM = [[3.4, 3.3, 3.4], [16.4, -2, 15]];
const HAND = [[2.5, 2.4, 2.3], [18.2, -3.4, 10.6]];
const handCry = [[[0.4, -2.4, -4.6], 1.15], [[2.8, -0.8, -4.3], 1.1], [[-1.8, -1.6, -4.3], 1.05], [[1.4, 1.6, -4.4], 1], [[2.8, -1.8, 1.4], 0.9]];

// foot(at, out): a base ellipsoid, a heap of pebble lumps and three short crystal toes
const LUMPS = [[3, -1.8, 2.6, 2.4], [-2.8, -1.6, 2.8, 2.3], [0.2, -3.2, 2.4, 2.1], [2.6, 2.2, 2.8, 2.2], [-2.4, 2.4, 3, 2.1],
  [1, -1, 5.2, 2.8], [-1, 0.8, 5.8, 2.8], [0, 0.2, 8, 3.4]];
const foot = (at, o) => any(
  (c) => blobD(c, [[[4.8, 4.4, 2.4], add(at, [0, 0, 2.4])], ...LUMPS.map(([x, y, z, r]) => [[r, r * 0.95, r * 0.85], add(at, [x * o, y, z])])]),
  cry(add(at, [1.8 * o, -3.6, 1.6]), [0.6 * o, -1.8, -0.6], 1.1), cry(add(at, [-1.6 * o, -3.4, 1.6]), [-0.6 * o, -1.8, -0.6], 1),
  cry(add(at, [3.8 * o, -1.4, 1.6]), [1.8 * o, -0.6, -0.6], 1),
);
const FOOT_L = [7, -2.8, 0];
const FOOT_R = [-8.8, 2.8, 0];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [7, -2.6, 7] },
  { name: 'legR', parent: 'root', at: [-8.8, 2.8, 7] },
  { name: 'body', parent: 'root', at: [0, 0, 9] },
  { name: 'earL', parent: 'body', at: [6.6, 0.4, 30.2] },
  { name: 'earR', parent: 'body', at: [-6.6, 0.4, 30.2] },
  { name: 'armL', parent: 'body', at: [13, -1.6, 16.4] },
  { name: 'handL', parent: 'armL', at: [18, -3, 12.4] },
  { name: 'armR', parent: 'body', at: [-11.4, -3.8, 19.6] },
  { name: 'handR', parent: 'armR', at: [-15.4, -6.9, 19] },
  { name: 'eyeL', parent: 'body', at: add(C, rot([0, 0, FA], E)) },
  { name: 'eyeR', parent: 'body', at: add(C, rot([0, 0, FA], [-E[0], E[1], E[2]])) },
  ...face.joints,
];

const ear = (k) => any(cry([6.2 * k, 0.8, 30.2], [1.8 * k, 0, 7], 2.1), cry([8.8 * k, 0.2, 28.8], [2.8 * k, -0.4, 4.2], 1.6),
  cry([5 * k, -1.6, 30.2], [0.3 * k, -1.2, 4.6], 1.4));

const parts = [
  // the boulder with its pebbles and the painted face
  ['body', ell(R.map((v) => v + 0.6), C)],
  ['earL', ear(1)],
  ['earR', ear(-1)],
  ['armL', ell(NARM[0].map((v) => v + 0.5), NARM[1])],
  ['handL', any(ell(HAND[0], HAND[1]), ...handCry.map(([d, r]) => cry(HAND[1], d, r)))],
  ['armR', ell(FARM[0].map((v) => v + 0.5), FARM[1])],
  ['handR', ell(FIST[0].map((v) => v + 0.5), FIST[1])],
  ['legL', foot(FOOT_L, 1)],
  ['legR', foot(FOOT_R, -1)],
];

// the eyes (sclera, iris, pupil, shine and the dark rim round each) are their own joints
const EYE_COLS = [[0.99, 0.97, 0.99], [0.5, 0.44, 0.52], [0.16, 0.07, 0.24], [0.27, 0.14, 0.33]];
const faceLocal = (c) => rot([0, 0, -FA], [c[0] - C[0], c[1] - C[1], c[2] - C[2]]);
const assign = (c, rgb) => {
  const f = faceLocal(c);
  const nearEye = Math.hypot((Math.abs(f[0]) - E[0]) / ESQ[0], f[1] - E[1], (f[2] - E[2]) / ESQ[2]) < 1.8 * 1.5;
  if (nearEye && (isAny(rgb, EYE_COLS, 0.03) || near(rgb, [1, 1, 1], 0.015))) return f[0] >= 0 ? 'eyeL' : 'eyeR';
  return pick(c, parts);
};

// the boulder carries the face, so the head's looks go to the body (a whole-rock tilt)
const look = (u) => ({ body: { r: [0, 3 * K(u, [[0, 0], [0.14, 0], [0.24, 1], [0.46, 1], [0.56, -1], [0.82, -1], [0.92, 0]]), 8 * K(u, [[0, 0], [0.14, 0], [0.24, 1], [0.46, 1], [0.56, -1], [0.82, -1], [0.92, 0]])] } });

const clipsFor = () => {
  const base = bipedClips({
    face, hipH: 9, stride: 18, armSwing: 16, hopH: 3, droop: 0.5,
    // the right fist already reaches forward-left: a punch swings it round to the front, the cheer lifts the arms up
    punch: { arm: [-10, 0, 45] },
    cheer: { arm: [0, -50, 0] },
    add: {
      idle: (t, u) => look(u),
      walk: (t, u) => ({ body: { r: [0, 6 * osc(u, 1), 0] } }),
      idle_look: (t, u) => { const on = K(u, [[0, 0], [0.15, 1], [0.75, 1], [0.92, 0]]); return { body: { r: [-4 * on, -5 * on, 10 * on] } }; },
      hurt: (t, u) => { const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.45]]); return { body: { r: [-8 * k, 0, 0] } }; },
      celebrate: (t, u) => both('ear', { s: 1 + 0.15 * Math.abs(Math.sin(TAU * u)) }),
    },
  });
  return {
    ...base,

    // fidget: it rocks from foot to foot like a boulder settling, then plonks down with a happy face
    idle_rock: {
      seconds: 2.4,
      pose: (t, u) => {
        const on = win(u, 0.05, 0.75, 0.1);
        const sw = Math.sin(TAU * 2 * u) * on;
        const plonk = win(u, 0.72, 0.95, 0.06);
        return {
          body: { p: [0, 0, -0.4 * plonk], r: [0, 9 * sw, 0] },
          ...both('arm', { r: [0, -14 * on - 10 * plonk, 0] }),
          ...face.pose(u > 0.7 && u < 0.97 ? 'happy' : 'open'),
          ...both('ear', { r: [4 * sw, 0, 0] }),
        };
      },
    },

    // fidget: the crystals on top tingle and shine, it peeks up at them and blinks
    idle_shine: {
      seconds: 2,
      pose: (t, u) => {
        const up = K(u, [[0, 0], [0.2, 1], [0.75, 1], [0.95, 0]]);
        const tw = (ph) => 1 + 0.12 * Math.max(0, Math.sin(TAU * (3 * u + ph))) * up;
        return merge({
          body: { r: [-8 * up, 0, 0] },
          earL: { s: tw(0), r: [0, -4 * up, 0] }, earR: { s: tw(0.5), r: [0, -4 * up, 0] },
          ...face.pose('open', blinks(u, [[0.5, 0.56], [0.6, 0.66]])),
          ...both('arm', { r: [0, 6 * up, 0] }),
        });
      },
    },
  };
};

// the painted eyes keep a hard edge on the boulder (a blend would smear the sclera into the face)
export default rigDef({ joints, assign, rigid: ['eyeL', 'eyeR'], extras: face.extras, clips: clipsFor() });
