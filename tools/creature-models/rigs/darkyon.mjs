// Darkyon's rig: a tall dark wraith in a long ragged gown on a ring of blue fire, a teal ruff and horned shoulders, a
// light-blue hood over a dark head with one red eye, a crown of blue flames, a fireball cupped in its right claw.
// Numbers are scad/darkyon.scad's (sprite-matched 2026-11-04). The gown and its fire reach the ground, so it bobs
// only a little.
import { K, merge, osc, rigDef } from './lib/anim.mjs';
import { eyeKit } from './lib/face.mjs';
import { floaterClips } from './lib/floater.mjs';
import { blobD, chainHit, closest, ellD, fold, isAny, near } from './lib/geo.mjs';

const SHADE = [0.20, 0.21, 0.22];
const SHADE_HI = [0.30, 0.30, 0.32];
const INK = [0.11, 0.12, 0.15];
const TEALS = [[0.17, 0.58, 0.70], [0.19, 0.60, 0.76]];
const NAVYS = [[0.15, 0.31, 0.53], [0.15, 0.43, 0.69]];
const HOODS = [[0.26, 0.53, 0.86], [0.21, 0.45, 0.74]];
const FLAMES = [[0.17, 0.74, 0.93], [0.10, 0.40, 0.93], [0.15, 0.21, 0.83]];
const CORE = [0.18, 0.76, 0.94];

const ARM_R = [[-4.2, 0.1, 23.6], [-7.4, -1.4, 19.3], [-10.3, -2.5, 17.9]];
const PALM_R = [-10.9, -2.6, 17.6];
const BALL = [-10.6, -2.6, 20.3];
const ARM_L = [[4.2, 0.1, 23.8], [7.6, -0.6, 20.4], [10.4, -1.6, 15.4]];
const PALM_L = [10.8, -1.8, 14.6];
const HEAD = [[2.4, 2.3, 2.2], [0.2, -0.2, 29.6]];

const face = eyeKit({ eyes: [{ side: 'L', at: [0.85, -2.3, 29.75], size: 0.95, yaw: 14 }], skin: INK });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 12] },
  { name: 'head', parent: 'body', at: [0, 0.2, 27.6] },
  { name: 'wisp1', parent: 'head', at: [0, 1.6, 33.5] },
  { name: 'armL', parent: 'body', at: ARM_L[0] },
  { name: 'handL', parent: 'armL', at: ARM_L[2] },
  { name: 'armR', parent: 'body', at: ARM_R[0] },
  { name: 'handR', parent: 'armR', at: ARM_R[2] },
  { name: 'core', parent: 'handR', at: BALL },
  ...face.joints,
];

function assign(c, rgb) {
  if (near(rgb, CORE, 0.02) && ellD(c, [2.6, 2.6, 2.6], BALL) < 1.2) return 'core';
  if (isAny(rgb, FLAMES)) {
    if (c[2] < 12) return 'body';                                           // the hem's ring of fire
    if (ellD(c, [3.4, 3.4, 5.6], [BALL[0], BALL[1], BALL[2] + 2]) < 1) return 'core';   // the fireball and its flames
    if (c[0] > 12) return 'handL';                                          // the loose flame beside its left claw
    return 'wisp1';                                                         // the crown
  }
  if (isAny(rgb, HOODS)) return 'head';
  if (isAny(rgb, TEALS)) return 'body';
  if (isAny(rgb, NAVYS)) {
    if (c[0] < 0) return ellD(c, [3.4, 3.4, 3], PALM_R) < 1 ? 'handR' : 'armR';
    return c[2] < 15.6 ? 'handL' : 'armL';                                  // claws, or the blades on the forearm
  }
  if (!near(rgb, SHADE) && !near(rgb, SHADE_HI) && !near(rgb, INK)) return 'head';   // the eye
  return closest([
    ['body', Math.min(ellD(c, [9, 9, 12], [0, 0, 8]) * 1.1, blobD(c, [[[2.0, 1.8, 1.6], [0, 0.1, 20.6]], [[3.2, 2.4, 1.8], [0, 0.3, 24.6]]]),
      ellD(fold(c), [2.2, 1.9, 1.6], [3.8, 0.4, 25]), chainHit(fold(c), [[4.2, 0.5, 25.4], [6.6, 0.7, 26.2], [8.6, 0.7, 27.8], [9.5, 0.6, 30.2]], [1.4, 0.95, 0.5, 0.08]).d,
      ellD(c, [3.8, 3.4, 2.4], [0, 0.6, 28.4]))],
    ['head', Math.min(ellD(c, ...HEAD), ellD(c, [2.4, 0.9, 1.3], [0.2, -2.2, 27.6]) * 0.95)],
    ['armR', chainHit(c, ARM_R, [1.1, 0.75, 0.55]).d],
    ['armL', chainHit(c, ARM_L, [1.1, 0.8, 0.55]).d],
  ]);
}

const base = floaterClips({ face, wisp: ['wisp1'], bob: 0.35 });

const clips = {
  ...base,
  // fidget: weighs the fireball, tossing it up out of the claw and catching it, the fire crown flaring
  idle_toss: {
    seconds: 2.4,
    pose: (t, u) => {
      const ready = K(u, [[0, 0], [0.15, 1], [0.8, 1], [0.95, 0]]);
      const up = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.3) / 0.35))));
      return merge({
        head: { r: [10 * ready, 0, -12 * ready] },
        ...face.pose('open', 0.3 * ready),
        armR: { r: [-30 * ready, 0, 0] },
        handR: { r: [-20 * ready + 15 * up, 0, 0] },
        core: { p: [0, 0, 6 * up], r: [0, 0, 360 * up], s: 1 + 0.1 * (osc(u, 6) * 0.5 + 0.5) },
        wisp1: { s: [1, 1, 1 + 0.12 * up], r: [0, 0, 4 * osc(u, 4)] },
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
