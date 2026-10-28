// Pebblit's rig: a round boulder with a face, stubby arms with cobble fists, short legs on crystal feet and two quartz
// clusters on top (they twitch like ears). The boulder is the body and carries the face. Numbers are scad/pebblit.scad's.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, ell, limb, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';

const ROCK = [0.36, 0.24, 0.37];

// a crystal(p, d, r): a hexagonal prism with a point, tested as a tapering capsule
const cry = (p, d, r) => limb(p, [p[0] + d[0], p[1] + d[1], p[2] + d[2]], r * 1.05, r * 0.4);

const eyeL = { side: 'L', at: [2.9, -13.3, 20.6], size: 1.8 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], parent: 'body', skin: [1, 0.98, 1] });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [5.5, -1, 7]),
  { name: 'body', parent: 'root', at: [0, 0, 6] },
  ...pair('ear*', 'body', [5.5, -0.5, 27]),
  ...pair('arm*', 'body', [11, -1, 16]),
  ...pair('hand*', 'arm*', [15.5, -3, 14]),
  ...face.joints,
];

const parts = [
  ['body', any(ell([13.6, 12.6, 13.1], [0, 0, 17]), ell([8, 2.6, 7.4], [0, -10.2, 18.6]), cry([0, -11.6, 24.4], [0, -0.6, 1.4], 0.6),
    ell([3, 3, 1.4], [0, 0, 29.2]))],
  ['ear*', any(cry([5.5, -1, 27.5], [0.5, -0.3, 6.5], 1.4), cry([7.5, 0, 26.5], [2, 0.2, 4.6], 1.1), cry([4.2, 1, 28], [-0.8, 1, 4.4], 1))],
  ['arm*', limb([11, -1, 16], [15.5, -3, 14], 2.6, 2.4)],
  ['hand*', any(ell([3.4, 3.2, 3.2], [16.5, -3.5, 13.5]), ell([1.8, 1.6, 1.8], [17.5, -5.5, 14.5]))],
  ['leg*', any(limb([5.5, -1, 7], [6.5, -2, 3], 3, 2.6), cry([6.5, -2, 0], [0, 0, 3.6], 2.4), cry([5.2, -4.4, 0], [-0.6, -1, 2.6], 1.2),
    cry([7.6, -4.6, 0], [0.6, -1, 2.4], 1.1), cry([8.6, -1, 0], [1, 0, 2.6], 1.1))],
];

const assign = (c) => pick(c, parts);

// the boulder carries the face, so the head's looks go to the body (a whole-rock tilt)
const look = (u) => ({ body: { r: [0, 3 * K(u, [[0, 0], [0.14, 0], [0.24, 1], [0.46, 1], [0.56, -1], [0.82, -1], [0.92, 0]]), 8 * K(u, [[0, 0], [0.14, 0], [0.24, 1], [0.46, 1], [0.56, -1], [0.82, -1], [0.92, 0]])] } });

const clipsFor = () => {
  const base = bipedClips({
    face, hipH: 7, stride: 20, armSwing: 18, hopH: 3, droop: 0.5,
    // the arms stick out sideways: a punch swings the right fist round to the front, the cheer lifts them up
    punch: { arm: [0, 0, 75] },
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

export default rigDef({ joints, assign, extras: face.extras, clips: clipsFor() });
