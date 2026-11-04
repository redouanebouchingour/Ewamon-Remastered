// Necrogeist Majin's rig: Necrogeist's (necroRig() in necrogeist.mjs) on the feral egg of a ghost: the egg below the
// maw is the body (its red orb the core, the back cracks with it), the egg from the maw up with its little horns the
// head (red eye, maw and forehead crack decals), the curly ghost tail a hanging chain, the short clawed arms arm +
// hand, the crimson crown and the broken red ring over it the halo joint, and the upper and hind bat wings of a side
// one wing joint (both in planes behind the back). No aura. Numbers are scad/necrogeist_majin.scad's.
import { merge, osc } from './lib/anim.mjs';
import { chainHit, ellD, fold, isAny, near, subFrame } from './lib/geo.mjs';
import { necroRig } from './necrogeist.mjs';

const WING = [[0.29, 0.04, 0.38], [0.17, 0.03, 0.25], [0.73, 0.87, 0.88], [0.87, 0.05, 0.26]];
const EYE = [1, 0.15, 0.3];
const MAW = [[0.92, 0.1, 0.32], [0.55, 0.04, 0.15]];
const ORB = [[0.85, 0.02, 0.18], [1, 0.6, 0.7], [0.3, 0.02, 0.1]];
const CRACK = [0.8, 0.06, 0.2];
const CROWN = [[0.78, 0.1, 0.25], [0.68, 0.05, 0.18], [0.98, 0.95, 0.98]];

const EGG = [[[6.6, 5.8, 7], [0, 0, 15]], [[7, 6, 5.5], [0, 0, 22.5]]];
const eggD = (c) => Math.min(...EGG.map(([r, p]) => ellD(c, r, p)));
const HORN = [[4.9, 0.5, 25.8], [6.3, 0.5, 28.8], [7.3, 0.8, 31.3]];
const NECK = 18;   // the head is the egg from just under the maw up

export default necroRig({
  TAIL: [[0, 0.5, 11.5], [2.9, 1, 7.6], [6.6, 1.5, 5.4], [8.1, 4, 3.8], [8.1, 5, 2], [7.5, 5, 0.9], [9.3, 5.5, 0.8], [10.5, 6, 1.7]],
  TAIL_R: [4.2, 3, 1.9, 1.3, 1.0, 0.75, 0.55, 0.2],
  tailTop: 9.5,
  ARM: [[6.4, -1, 18.5], [10, -2, 18.5], [11.8, -3, 16], [12, -3.4, 15]],
  ARM_R: [1.7, 1.4, 1.1, 1.3],
  claws: [-0.9, 0, 0.9].map((dx) => [11.8 + dx * 1.3, -4.6, 12.4]),
  coreAt: [0, -5.4, 13.9],
  headAt: [0, 0, 17],
  eyesAt: [0, -5.6, 24],
  mouthAt: [0, -6, 20],
  haloAt: [0, 0, 32],
  wingAt: [3, 5, 19],
  aura: null,
  // the wings are all wing colours (caught by colour()): the shape test never needs them
  wingFrame: subFrame([0, 5.3, 0]),
  wingD: () => Infinity,
  headD: (c) => Math.min(c[2] > NECK ? eggD(c) : Infinity, chainHit(fold(c), HORN, [2, 1.1, 0.12]).d),
  torsoD: (c) => (c[2] > NECK ? Infinity : eggD(c)),
  colour: (c, rgb) => {
    if (near(rgb, EYE, 0.02)) return 'eyes';
    if (isAny(rgb, MAW, 0.02)) return 'mouth';
    if (isAny(rgb, ORB, 0.02)) return 'core';
    if (isAny(rgb, CROWN, 0.02)) return 'halo';
    if (isAny(rgb, WING, 0.02)) return 'wing';
    if (near(rgb, CRACK, 0.02)) return c[2] > NECK ? 'head' : 'body';
    return null;   // the body colour (the fangs too): by shape
  },
  fidgets: ({ wings, halo }) => ({
    // fidget: a feral snarl: hunches, the maw gapes, the orb throbs, the torn wings shiver
    idle_snarl: {
      seconds: 2.2,
      pose: (t, u) => {
        const on = Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.1) / 0.75)));
        const sh = osc(u, 16) * on;
        return merge({
          body: { p: [0, 0, 0.4], r: [6 * on, 0, 2 * sh] },
          head: { r: [-6 * on, 0, 3 * sh] },
          mouth: { s: [1 + 0.1 * on, 1, 1 + 0.25 * on] },
          eyes: { s: [1, 1, 1 - 0.15 * on] },
          core: { s: 1 + 0.15 * on * (0.5 + 0.5 * osc(u, 6)) },
          armL: { r: [-20 * on, -15 * on, 0] },
          armR: { r: [-20 * on, 15 * on, 0] },
        }, wings(u, 3 * on, 12, 8 * on), halo(u, 0.5, 1));
      },
    },
  }),
});
