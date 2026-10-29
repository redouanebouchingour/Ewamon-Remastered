// Necrogeist Majin's rig: Necrogeist's (necroRig() in necrogeist.mjs) on the feral egg-shaped body: the belly is the
// body (its red gem the core), the wide head with its little horns the head (red eyes and the fanged maw decals), the
// crimson crown and white halo the halo joint, the torn bat wings (a plate in their own plane) wingL / wingR. No aura.
// Numbers are scad/necrogeist_majin.scad's.
import { merge, osc } from './lib/anim.mjs';
import { capD, ellD, fold, isAny, near, plateD, subFrame } from './lib/geo.mjs';
import { necroRig } from './necrogeist.mjs';

const BODY_HI = [0.32, 0.2, 0.48];
const WING = [[0.55, 0.85, 0.85], [0.45, 0.25, 0.62]];
const RED = [0.9, 0.08, 0.2];
const RED_DK = [0.55, 0.04, 0.12];
const CROWN = [[0.85, 0.12, 0.25], [0.98, 0.95, 0.98]];
const EYE_RED = [1, 0.2, 0.25];
const FANG = [1, 0.95, 0.95];
const WHITE = [1, 1, 1];

const WING_SHAPE = [[0, -6], [0, 6], [6, 12], [14, 17], [23, 21], [20, 15], [22, 10], [17.5, 9], [19, 3], [14, 3], [15, -3],
  [10.5, -2], [11, -8], [7, -6], [5, -11], [2, -8]];
const wingFrame = subFrame([6, 3, 28], [90, 0, 14]);
// the wing is an outline in the frame's x / y, extruded along its z (1.8 thick with the bone): plateD wants it as x / z
const wingD = (q) => plateD([q[0], q[2], q[1]], WING_SHAPE, 1.8);
const inWing = (c) => wingD(wingFrame.local(fold(c))) < 1.3;

const chest = (c) => Math.abs(c[0]) < 3 && c[1] < -6 && Math.abs(c[2] - 21) < 3;
const maw = (c) => Math.abs(c[0]) < 5.5 && c[1] < -6 && c[2] > 24.5 && c[2] < 30.5;

export default necroRig({
  TAIL: [[0, 0, 15], [0.5, 0.5, 10], [2.5, 1, 6], [4.5, 1.5, 3], [6.5, 1, 1.2], [8, 0.5, 1.6], [8.4, 0, 3.4]],
  TAIL_R: [7, 5.4, 3.6, 2.3, 1.4, 0.8, 0.5],
  ARM: [[7, -1, 24], [10.5, -3, 21], [12, -5, 18]],
  ARM_R: [2.4, 2, 1.9],
  claws: [-40, -10, 20].map((a) => [12 + Math.sin((a * Math.PI) / 180) * 2.8, -8, 15.2]),
  coreAt: [0, -7.6, 21],
  headAt: [0, 0, 26],
  eyesAt: [0, -8.4, 34],
  mouthAt: [0, -8.8, 28.4],
  haloAt: [0, 0, 42],
  wingAt: [6, 3, 28],
  aura: null,
  wingFrame,
  wingD,
  headD: (c) => Math.min(ellD(c, [9.5, 8.5, 9], [0, 0, 32]), ellD(c, [4.5, 3, 3.5], [-3, -2, 38.5]), capD(fold(c), [6, 0, 38], [8, 0.5, 42.5], 1.9, 0.25)),
  torsoD: (c) => Math.min(ellD(c, [8.5, 7.5, 8], [0, 0, 20]), ellD(c, [7, 6.5, 3], [0, 0, 24])),
  colour: (c, rgb) => {
    if (near(rgb, EYE_RED, 0.03)) return 'eyes';
    if (near(rgb, WHITE, 0.02)) return chest(c) ? 'core' : 'eyes';
    if (near(rgb, FANG, 0.02)) return 'mouth';
    if (isAny(rgb, CROWN, 0.03)) return 'halo';
    if (isAny(rgb, WING, 0.03)) return 'wing';
    if (near(rgb, BODY_HI, 0.03)) return 'head';
    if (isAny(rgb, [RED, RED_DK], 0.03)) {
      if (chest(c)) return 'core';
      if (maw(c)) return 'mouth';
      if (inWing(c)) return 'wing';
    }
    return null;   // the body colour (the wings' dark middle too) and the red cracks: by shape
  },
  fidgets: ({ wings, halo }) => ({
    // fidget: a feral snarl: hunches, the maw gapes, the gem throbs, the torn wings shiver
    idle_snarl: {
      seconds: 2.2,
      pose: (t, u) => {
        const on = Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.1) / 0.75)));
        const sh = osc(u, 16) * on;
        return merge({
          body: { p: [0, 0, 0.4], r: [6 * on, 0, 2 * sh] },
          head: { r: [-6 * on, 0, 3 * sh] },
          mouth: { s: [1 + 0.15 * on, 1, 1 + 0.35 * on] },
          eyes: { s: [1, 1, 1 - 0.2 * on] },
          core: { s: 1 + 0.15 * on * (0.5 + 0.5 * osc(u, 6)) },
          armL: { r: [-20 * on, -15 * on, 0] },
          armR: { r: [-20 * on, 15 * on, 0] },
        }, wings(u, 3 * on, 12, 8 * on), halo(u, 0.5, 1));
      },
    },
  }),
});
