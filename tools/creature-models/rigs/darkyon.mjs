// Darkyon's rig: a tall shadow sorcerer in a long ragged gown, a teal ruff and horned shoulders, a crown of blue fire
// over a hooded head with one red eye, a fireball in its right claw. Numbers are scad/darkyon.scad's (the old model;
// re-rig when the sprite-matched one lands). The gown reaches the ground, so it bobs only a little.
import { K, merge, osc, rigDef } from './lib/anim.mjs';
import { eyeKit } from './lib/face.mjs';
import { floaterClips } from './lib/floater.mjs';
import { blobD, capD, closest, ellD, fold, isAny, near, side } from './lib/geo.mjs';

const SHADE = [0.17, 0.17, 0.2];
const SHADE_HI = [0.28, 0.29, 0.33];
const TEALS = [[0.18, 0.55, 0.6], [0.3, 0.7, 0.72]];
const FLAMES = [[0.1, 0.25, 0.85], [0.2, 0.5, 0.97], [0.45, 0.85, 1]];
const BALL = [-12.2, -5, 12.5];

const face = eyeKit({ eyes: [{ side: 'R', at: [-1.6, -3.55, 30.8], size: 1.7, yaw: 10 }], skin: SHADE });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 12] },
  { name: 'head', parent: 'body', at: [0, -0.5, 28.5] },
  { name: 'wisp1', parent: 'head', at: [0.6, -0.5, 34] },
  { name: 'armL', parent: 'body', at: [6.5, 0, 24.5] },
  { name: 'handL', parent: 'armL', at: [11.5, -2.5, 15] },
  { name: 'armR', parent: 'body', at: [-6.5, 0, 24.5] },
  { name: 'handR', parent: 'armR', at: [-11.5, -2.5, 15] },
  { name: 'core', parent: 'handR', at: BALL },
  ...face.joints,
];

function assign(c, rgb) {
  const S = side(c);
  const f = fold(c);
  if (isAny(rgb, FLAMES)) {
    if (c[2] < 9) return 'body';
    if (ellD(c, [4.5, 4.5, 6.5], [BALL[0], BALL[1], 14.5]) < 1) return 'core';
    return 'wisp1';
  }
  if (isAny(rgb, TEALS)) return f[0] > 9 && c[2] < 21 ? `arm${S}` : 'body';
  if (!near(rgb, SHADE) && !near(rgb, SHADE_HI)) return 'head';   // the eye
  if (near(rgb, SHADE_HI) && f[0] > 10 && c[2] < 15) return `hand${S}`;
  return closest([
    ['body', Math.min(blobD(c, [[[4.5, 3.6, 3], [0, 0, 24]], [[9, 7.5, 2], [0, 0.5, 4]]]), ellD(c, [11, 9.5, 6], [0, 0.5, 5]),
      blobD(c, [[[5.4, 4, 3.4], [0, 0, 25.5]], [[3.6, 3, 2.5], [0, 0, 21.5]]]), ellD(f, [3, 2.8, 2.6], [6, 0.5, 26]),
      capD(f, [7, 0.5, 27.5], [10.5, 1, 32.5], 1.6, 0.4), ellD(c, [8.5, 7, 4], [0, 0.4, 11]))],
    ['head', Math.min(blobD(c, [[[3.8, 3.6, 4], [0, -0.5, 31]], [[2.4, 2.4, 2], [0, 1.4, 34]]]), ellD(c, [2.6, 1.6, 1.2], [-1.8, -3.2, 32.5]))],
    [`arm${S}`, capD(f, [6.5, 0, 24.5], [9.5, -1, 19], 1.5, 1.2)],
    [`hand${S}`, Math.min(capD(f, [9.5, -1, 19], [11.5, -2.5, 15], 1.2, 1), ellD(f, [2.6, 2.6, 2.6], [12, -4.4, 12.8]))],
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
