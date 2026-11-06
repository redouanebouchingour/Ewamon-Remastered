// Shardling's rig: a stocky crystal golem with a big round paneled head, the far (-X, R) fist raised in front gripping
// a prism sword, the near (+X, L) arm hanging with a heavy gauntlet fist. The eyes are painted flush on the face; they
// are their own joints (eyeL / eyeR, with the brows) and blink with eyeKit lids set just under the face surface
// (`squash`). No aura (the art's aura is not modelled). Numbers are scad/shardling.scad's.
import { K, TAU, both, merge, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, ell, limb, mx, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near } from './lib/geo.mjs';

const SKIN = [0.84, 0.91, 0.97];
const EYE_COLS = [[0.18, 0.42, 0.72], [0.5, 0.9, 1], [0.74, 0.97, 1], [0.1, 0.13, 0.2], [1, 1, 1]];
const H = [0, 0.3, 23.6];
// the near eye's painted centre on the head, and the lid's centre a little inside along the head's normal there
const E = [3.7, -6.04, 22.6];
const EL = [3.5, -5.59, 22.68];
const SW0 = [-11.2, -4.4, 8.4];
const SW1 = [-18, -6, 23.8];

const eyeL = { side: 'L', at: EL, size: 1.6, yaw: 24, squash: 0.8 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: SKIN });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [5.6, 0.4, 7.2]),
  { name: 'body', parent: 'root', at: [0, 0, 6] },
  { name: 'head', parent: 'body', at: [0, 0.3, 18.5] },
  ...pair('eye*', 'head', E),
  ...pair('arm*', 'body', [11, 0.3, 18.6]),
  { name: 'foreL', parent: 'armL', at: [12.4, 0.5, 14.2] },
  { name: 'foreR', parent: 'armR', at: [-12.4, 0.3, 14.6] },
  { name: 'handR', parent: 'foreR', at: [-11.9, -4.2, 12.4] },
  ...face.joints,
];

const knuckles = [0, 1, 2].map((k) => ell([1.05, 1.1, 1], [12.6 + k * 1.3, -2.7 + k * 0.3, 7.6]));
const fingers = [0, 1, 2].map((k) => ell([1.15, 0.9, 0.7], [-11.2 + k * 0.15, -6.5, 10.9 + k * 1.3]));
const parts = [
  ['body', ell([10, 8.2, 7.6], [0, 0.6, 13.6])],
  ['head', ell([8.2, 7.2, 6.7], H)],
  ['arm*', mx(ell([3.9, 4.1, 3.6], [11, 0.3, 18.6]))],
  ['armL', ell([2.8, 3, 3.2], [11.8, 0.6, 14.6])],
  ['armR', ell([2.8, 3, 3.1], [-12.4, 0.4, 15])],
  ['foreL', any(ell([3.5, 3.7, 4.8], [14.2, 0, 11.6]), ...knuckles)],
  ['foreR', ell([2.8, 3.1, 2.8], [-12.6, -2, 13.2])],
  ['handR', any(ell([3.3, 3, 3.4], [-11.9, -4.2, 12.4]), ...fingers, limb(SW0, SW1, 2.4, 1.4))],
  ['leg*', mx(any(ell([3.4, 3.4, 2.8], [5.6, 0.4, 7.2]), ell([3.2, 3.3, 2.7], [7.6, -0.1, 4.4]), limb([8.4, -2, 1.3], [8.4, 0.8, 1.3], 2.6, 2.6)))],
];

function assign(c, rgb) {
  const de = Math.hypot(Math.abs(c[0]) - E[0], c[1] - E[1], c[2] - E[2]);
  // the brow shares the mouth's ink: only above z 21.6 is it a brow
  const eyeCol = isAny(rgb, EYE_COLS.slice(0, 3)) || near(rgb, [1, 1, 1], 0.02);
  if (de < 2.9 && ((eyeCol && c[2] > 20.4) || (near(rgb, EYE_COLS[3]) && c[2] > 21.6))) return c[0] >= 0 ? 'eyeL' : 'eyeR';
  return pick(c, parts);
}

const base = bipedClips({
  face, hipH: 6, stride: 16, armSwing: 14, hopScale: 0.8, hopH: 2.5, droop: 0.5,
  // a thrust with the prism sword
  punch: { arm: [-75, 0, 0], fore: [-10, 0, 0] },
  cheer: { arm: [-6, -110, 0], fore: [0, 0, 0] },
});

const clips = {
  ...base,

  // fidget: it flips the prism sword forward over its fist, catches it, and grins with its eyes shut happy
  idle_twirl: {
    seconds: 2.2,
    pose: (t, u) => {
      const up = win(u, 0.08, 0.85, 0.1);
      const flip = K(u, [[0.2, 0], [0.6, 1]]);
      return merge({
        body: { r: [0, 0, -6 * up] },
        head: { r: [-4 * up, 6 * up, -12 * up] },
        armR: { r: [-30 * up, 8 * up, 0] },
        foreR: { r: [-25 * up, 0, 0] },
        handR: { r: [-360 * flip, 0, 0] },
      }, u > 0.66 && u < 0.84 ? face.pose('happy') : face.pose('open', blinks(u, [[0.9, 0.95]])));
    },
  },

  // fidget: it puffs up its chest, chin up, and lifts the sword to catch the light, a slow proud blink
  idle_gleam: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = win(u, 0.12, 0.82, 0.12);
      return {
        body: { p: [0, 0, 0.3 * on], r: [-5 * on, 0, 0], s: [1 + 0.04 * on, 1 + 0.04 * on, 1] },
        head: { r: [-12 * on, 0, 8 * Math.sin(TAU * u) * on] },
        ...both('arm', { r: [0, -14 * on, 0] }),
        armR: { r: [-20 * on, 20 * on, 0] },
        handR: { r: [0, 0, 25 * Math.sin(TAU * 2 * u) * on] },
        ...face.pose('open', blinks(u, [[0.42, 0.56]])),
      };
    },
  },
};

// the painted eyes are thin decals: keep their seams rigid, or the 3.5 cm blend smears them into the head
export default rigDef({ joints, assign, clips, extras: face.extras, rigid: ['eyeL', 'eyeR'] });
