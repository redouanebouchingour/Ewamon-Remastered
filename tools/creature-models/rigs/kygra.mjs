// Kygra's rig: a hunched penguin-knight with two flipper blades (the right one swept down and forward to a point, the
// left one spread out sideways like a wing), a big helm with a gold trident over the face and a crown of five forked
// plumes (the two far-front ones and the two back-near ones move as ears). Numbers are scad/kygra.scad's: most parts
// are placed off the front sheet with P(sx, z, d) and the blades stand in the sp() planes.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, fromSheet, inFrame, limb, pick, ppFrame, slab } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { subFrame } from './lib/geo.mjs';

const BLUE = [0.23, 0.39, 0.71];
const DEG = Math.PI / 180;
const P = (sx, z, d) => [sx * Math.cos(30 * DEG) - d * Math.sin(30 * DEG), sx * Math.sin(30 * DEG) + d * Math.cos(30 * DEG), z];
// scad sp(ang, sx0, d): sheet-coordinate children in a plane turned `ang`, stretched by 1 / cos(ang - 30)
const spFrame = (ang, sx0, d) => {
  const f = subFrame(P(sx0, 0, d), [0, 0, ang], [1 / Math.cos((ang - 30) * DEG), 1, 1]);
  return { local: (c) => { const q = f.local(c); return [q[0] + sx0, q[1], q[2]]; } };
};

// ---- the head
const FACE0 = P(-6.6, 25.2, -2.5);
const FACEF = subFrame(FACE0, [0, 0, 25]);
const FACE_ELLS = [[[5.2, 3, 2.6], [0, 0, 2.6]], [[4.8, 3, 2.6], [0, -0.2, 0]], [[3.2, 2.6, 2], [0, -0.6, -3.4]], [[1.4, 1.6, 1.2], [0, -1.6, -5.4]]];
const SKULL = [[4.5, 4.4, 4.6], P(-3, 26.5, 0)];
const CREST = [[[3, 3.4, 2.6], P(3, 28.4, 2)], [[2.2, 1.6, 1.4], P(7.6, 29.4, 3)]];

const eyeL = { side: 'L', at: [3.6, -1.3, -3.1], size: 0.85, yaw: 35, frame: FACEF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.17, 0.33, 0.58] });

// plume(x, z0, z1, w, d): tested as the slab of its whole box
const plume = (x, z0, z1, w, d) => slab([[x - w / 2, z0], [x + w / 2, z0], [x + w / 2, z1], [x - w / 2, z1]], 1.7, 0.7, ppFrame(d));

// ---- the arms and blades
const SHL = [3, 0.6, 20.4];
const SHR = [-5.4, 0.6, 20.4];
const ROOTL = P(3.2, 18.2, 0.6);
const ROOTR = P(-5.2, 17, 3);
const bladeL = [[2.4, 19.8], [4.6, 21.6], [6.4, 22.2], [7.6, 23.8], [10, 23.4], [12, 24], [15, 24.4], [18.3, 24.9], [18.3, 22.4],
  [16.2, 19.6], [14, 16.4], [13.2, 13.2], [10.6, 12.5], [8.6, 13.1], [5, 13.1], [3.3, 15.8]];
const bladeR = [[-17.9, 6.3], [-13.6, 6.3], [-11.4, 7.6], [-9, 9.4], [-8.4, 11.6], [-6.8, 13.8], [-4.8, 15.2], [-4.8, 18.6],
  [-7.8, 18.8], [-10, 20.4], [-11.3, 19.6], [-15.4, 13.8], [-17.9, 10]];
const BLF = spFrame(10, 3, 0.6);
const BRF = spFrame(20, -5, 3);

// ---- the legs
const HIPR = fromSheet(-3.2, 14.2, 0.5); const KNEER = fromSheet(-8, 11.6, -3); const ANKR = fromSheet(-5, 6.4, 0); const FOOTR = fromSheet(-6.2, 5, -1);
const HIPL = fromSheet(1.6, 15, 0.5); const KNEEL = fromSheet(2.5, 9.6, -1.5); const ANKL = fromSheet(5.4, 4.2, 0.5); const FOOTL = fromSheet(5.3, 2.2, 0);
const toe = (f, tip, r) => limb(f, tip, r, 0.3);
const leg = (H, Kn, A, F, toes) => any(limb(H, Kn, 2.1, 1.4), limb(Kn, A, 1.4, 0.95), limb(A, F, 0.95, 0.9), ell([1.3, 1.3, 1], F), ...toes);

const TORSO = [[[4, 3.6, 4.4], [-1.2, 0.6, 16.2]], [[3.6, 3.2, 2.8], [-1.6, -0.6, 19.4]]];
const NECK = P(-4.2, 23, -1.5);

export const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: HIPL },
  { name: 'legR', parent: 'root', at: HIPR },
  { name: 'body', parent: 'root', at: [-1.2, 0.6, 14] },
  { name: 'head', parent: 'body', at: [NECK[0] + 0.4, NECK[1] + 0.6, 22] },
  // the plumes pivot where they leave the head: the far-front pair (R) and the back-near pair (L)
  { name: 'earR', parent: 'head', at: P(-5.2, 30, -0.8) },
  { name: 'earL', parent: 'head', at: P(5.6, 29.5, 2.5) },
  { name: 'armL', parent: 'body', at: SHL },
  { name: 'foreL', parent: 'armL', at: ROOTL },
  { name: 'armR', parent: 'body', at: SHR },
  { name: 'foreR', parent: 'armR', at: ROOTR },
  ...face.joints,
];

export const parts = [
  ['body', any(blob(TORSO), limb([-1.6, -0.6, 20], NECK, 2.4, 2.2),
    ...[-1, 0, 1, 2].map((i) => ell([1, 0.5, 3], [-1.2 + i * 2.3, 3.8 - Math.abs(i - 0.5) * 0.3, 18.6])))],
  ['head', any(inFrame(FACEF, blob(FACE_ELLS)), blob([SKULL, ...CREST]), limb(P(-7.2, 21, -4.6), P(-7.6, 18.7, -4.2), 1, 0.35),
    plume(-0.3, 29, 35, 2.3, 1))],
  ['earR', any(plume(-7.4, 28, 39.4, 3.1, -1.5), plume(-2.9, 29, 39.3, 3.4, 0))],
  ['earL', any(plume(3.6, 28.5, 38.3, 3.3, 2), plume(7.7, 28, 38.3, 3.5, 3))],
  ['armL', any(ell([1.8, 1.8, 1.6], SHL), limb(SHL, ROOTL, 1.5, 1.4))],
  ['armR', any(ell([1.4, 1.5, 1.4], SHR), limb(SHR, ROOTR, 1.5, 1.4))],
  ['foreL', slab(bladeL, 1.95, 0.6, BLF)],
  ['foreR', slab(bladeR, 1.95, 0.6, BRF)],
  ['legL', leg(HIPL, KNEEL, ANKL, FOOTL, [toe(FOOTL, fromSheet(2, 0.4, -3), 0.8), toe(FOOTL, fromSheet(8.5, 0.4, 2.5), 0.8),
    toe(FOOTL, fromSheet(5.8, 0.3, -3.5), 0.55)])],
  ['legR', leg(HIPR, KNEER, ANKR, FOOTR, [toe(FOOTR, fromSheet(-9.9, 4.6, -4), 0.75), toe(FOOTR, fromSheet(-8.6, 2.3, -2.5), 0.75),
    toe(FOOTR, fromSheet(-4.6, 4.2, 2), 0.45)])],
];

function assign(c) {
  return pick(c, parts);
}

/** Layers several `add` maps ({ clip: (t, u) => pose }) into one. */
export const addAll = (...maps) => Object.fromEntries([...new Set(maps.flatMap((m) => Object.keys(m)))]
  .map((k) => [k, (t, u) => merge(...maps.map((m) => m[k]?.(t, u)))]));

export const clipsFor = (extra = {}) => {
  const base = bipedClips({
    face, hipH: 13, stride: 18, armSwing: 8, hopScale: 0.7, droop: 0.6,
    // the low right blade slashes up and across
    punch: { arm: [-55, 0, -20], fore: [-25, 0, 0] },
    cheer: { arm: [-20, -45, 0], fore: [0, 0, 0] },
    add: addAll({ idle: (t, u) => both('ear', { r: [0, -3 * osc(u, 2), 0] }) }, extra),
  });
  return {
    ...base,

    // fidget: it lifts the low blade and inspects its edge, turning it in the light, then flicks it clean
    idle_inspect: {
      seconds: 2.6,
      pose: (t, u) => {
        const up = K(u, [[0, 0], [0.2, 1], [0.7, 1], [0.85, 0]]);
        const turn = Math.sin(TAU * 2 * (u - 0.2)) * win(u, 0.2, 0.7, 0.08);
        const flick = win(u, 0.78, 0.92, 0.04);
        return {
          body: { r: [0, 0, -8 * up] },
          head: { r: [10 * up, 0, -18 * up] },
          ...face.pose('open', 0.3 * up + blinks(u, [[0.5, 0.56]])),
          armR: { r: [-50 * up - 15 * flick, 0, -10 * up] },
          foreR: { r: [-30 * up, 25 * turn, 0] },
          ...both('ear', { r: [-6 * up, 0, 0] }),
        };
      },
    },

    // fidget: a proud crest flare, the plumes fanning out and back while it stretches tall
    idle_crest: {
      seconds: 2,
      pose: (t, u) => {
        const on = K(u, [[0, 0], [0.25, 1], [0.6, 1], [0.9, 0]]);
        const sh = Math.sin(TAU * 6 * u) * win(u, 0.3, 0.6, 0.05);
        return {
          body: { r: [-5 * on, 0, 0], s: [1, 1, 1 + 0.03 * on] },
          head: { r: [-10 * on, 0, 0] },
          ...face.pose('open', 0.4 * on),
          ...both('ear', { r: [-6 * on, 12 * on + 3 * sh, 0] }),
          ...both('arm', { r: [0, -6 * on, 0] }),
        };
      },
    },
  };
};

export default rigDef({ joints, assign, extras: face.extras, clips: clipsFor() });
