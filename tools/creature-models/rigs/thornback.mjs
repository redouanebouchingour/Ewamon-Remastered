// Thornback's rig: a huge hunched bark bear under a leaf mantle, long thorny arms that hang to the ground, stumpy
// trunk legs and an amber heart-stone in its chest (its own joint, so it can pulse). Numbers are scad/thornback.scad's;
// the Tenjin form imports the pieces below and adds its halo, cape and veins.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, mx, pair, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { ellD, isAny, near, side } from './lib/geo.mjs';

export const PALETTE = {
  bark: [0.42, 0.26, 0.13], barkDk: [0.28, 0.17, 0.08], barkHi: [0.56, 0.38, 0.2],
  leaves: [[0.24, 0.52, 0.16], [0.42, 0.68, 0.22], [0.15, 0.36, 0.1]],
  thorn: [0.9, 0.8, 0.64], muzzle: [0.9, 0.84, 0.72], amber: [[0.98, 0.66, 0.08], [1, 0.92, 0.4]],
};

export const HEART = [0, -10.5, 18.5];
export const baseJoints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [7, 0, 5.5]),
  { name: 'body', parent: 'root', at: [0, 0, 8] },
  { name: 'heart', parent: 'body', at: [0, -11.5, 18.5] },
  { name: 'head', parent: 'body', at: [0, -4, 27] },
  ...pair('arm*', 'body', [13, -1, 21]),
  ...pair('hand*', 'arm*', [16, -3, 9]),
];

const ARM_THORNS = [[17.5, -5.5, 17, 1, -1.5, 1.5], [18.5, -1, 14, 2, 0, 1], [17, -6.5, 11, 0.8, -1.8, 0.4], [19.5, -3, 9, 2, -0.8, 0.3], [16, 2, 18, 1, 1.5, 1.5], [14.5, -5, 21, 0.5, -1.5, 1.8]];
export const parts = [
  ['body', any(blob([[[13, 10.5, 9], [0, 0.5, 11]], [[13.5, 10, 8.5], [0, 0, 20]]]), blob([[[10, 8, 3], [0, 1.5, 27]], [[7, 6, 2], [0, 2, 29.5]]]),
    ell([5.5, 2.5, 6], [0, 13.5, 20]), mx(spike([11, -6, 26], [2.4, -2.9, 4.3], 1.6)), mx(spike([14, 0, 26], [3.6, 0, 4.8], 1.6)))],
  ['head', any(blob([[[7.5, 7, 6.5], [0, -5.5, 29.5]], [[6.5, 6, 5], [0, -3, 32.5]]]), blob([[[4.4, 3.4, 3], [0, -11, 27.5]], [[3, 3, 2.3], [0, -13, 28]]]),
    mx(ell([2, 1.3, 2], [5.6, -3, 36.5])), mx(limb([5.6, -9.6, 33.6], [1.3, -11.9, 32.6], 1.4, 1)), mx(limb([3.5, -2, 36], [14, -1, 49], 1.6, 0.6)),
    mx(limb([11, -1.5, 45], [16.5, -1, 49.5], 0.8)), mx(limb([7, -2, 41], [10, -2.5, 40.5], 0.8)), ell([2, 1.5, 3], [0, -3, 39]))],
  ['arm*', any(limb([13, -1, 21], [16, -3, 9], 4.6, 4.2), ...ARM_THORNS.map((t) => spike([t[0], t[1], t[2]], [t[3] * 2.4, t[4] * 2.4, t[5] * 2.4], 1.5)))],
  ['hand*', any(ell([4.4, 4.4, 3.4], [16.2, -4, 5.5]), spike([16.2, -7.6, 3.4], [0, -1.6, -0.8], 0.8), limb([14, -7.6, 3.4], [18.4, -7.6, 3.4], 0.9))],
  ['leg*', any(ell([5, 5.5, 5.5], [7, 0, 5.5]), blob([[[4.6, 5.5, 2], [7.2, -1.5, 2]], [[4, 4, 2.5], [7.2, 1, 3]]]), limb([4.2, -6.5, 1.2], [10.2, -6.5, 1.2], 1))],
];

/** assign() for a palette and extra [joint, test] parts (the Tenjin's). */
export const makeAssign = (C, extra = [], rules = () => null) => (c, rgb) => {
  const r = rules(c, rgb);
  if (r) return r;
  // the heart-stone: its amber and the dark / leaf rims of the front stone
  if (ellD(c, [5.4, 2.6, 6], [0, -10.8, 18.5]) < 1.15 && c[1] < -9.5 && (isAny(rgb, C.amber) || near(rgb, C.barkDk) || isAny(rgb, C.leaves))) return 'heart';
  if (isAny(rgb, C.amber)) return 'body';
  if (isAny(rgb, C.leaves)) return c[2] > 35 ? 'head' : 'body';
  if (near(rgb, C.barkHi)) return 'head';
  if (near(rgb, C.muzzle)) return 'head';
  if (!isAny(rgb, [C.bark, C.barkDk, C.thorn])) return 'head';   // eyes, nose, mouth
  return pick(c, [...parts, ...extra]);
};

const eyeL = { side: 'L', at: [3.6, -10.7, 31], size: 1.9, yaw: 12, flat: 0.5 };
export const faceFor = (e, skin) => eyeKit({ eyes: [e, mirrorEye(e)], skin });

/** The clips, for a face and extra pose layers per clip. */
export const clipsFor = ({ face, extra = {}, cape = [] }) => {
  const base = bipedClips({
    face, cape, hipH: 5.5, stride: 14, armSwing: 10, hopScale: 0.15, droop: 0.55,
    // a big overhead-forward swipe of the right paw
    punch: { arm: [-95, 15, 0] },
    cheer: { arm: [-20, -95, 0] },
    add: {
      ...extra,
      // a lumbering roll from side to side
      walk: (t, u) => merge({ body: { r: [0, 4 * osc(u, 1), 0] }, heart: { s: 1 } }, extra.walk?.(t, u)),
      idle: (t, u) => merge({ heart: { s: 1 + 0.04 * Math.max(0, Math.sin(TAU * 2 * u)) ** 4 } }, extra.idle?.(t, u)),
      lunge: (t, u) => merge({ heart: { s: 1 + 0.12 * K(u, [[0.2, 0], [0.4, 1], [0.8, 0]]) } }, extra.lunge?.(t, u)),
    },
  });
  return {
    ...base,

    // fidget: the heart-stone thumps twice, bright; it looks down at it and lays a paw over it
    idle_heartbeat: {
      seconds: 2.6,
      pose: (t, u) => {
        const look = K(u, [[0, 0], [0.12, 1], [0.75, 1], [0.9, 0]]);
        const beat = (u0) => Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (u - u0) / 0.1))));
        const paw = win(u, 0.4, 0.78, 0.1);
        return merge({
          body: { r: [3 * look, 0, 0] },
          head: { r: [16 * look, 0, -6 * look] },
          heart: { s: 1 + 0.14 * (beat(0.2) + beat(0.32)) },
          ...face.pose('open', blinks(u, [[0.6, 0.66]])),
          armR: { r: [-55 * paw, 30 * paw, 0] },
          handR: { r: [-20 * paw, 0, 0] },
        }, extra.idle_heartbeat?.(t, u));
      },
    },

    // fidget: a big lazy stretch. Arms out wide, head back, eyes squeezed, then a shake through the mantle
    idle_stretch: {
      seconds: 3,
      pose: (t, u) => {
        const s = K(u, [[0, 0], [0.25, 1], [0.55, 1], [0.7, 0]]);
        const sh = Math.sin(TAU * 6 * u) * win(u, 0.7, 0.95, 0.04);
        return merge({
          root: { r: [-2 * s, 0, 0] },
          body: { r: [-8 * s, 0, 5 * sh] },
          head: { r: [-18 * s, 0, 6 * sh] },
          ...face.pose(s > 0.6 ? 'happy' : 'open'),
          ...both('arm', { r: [-25 * s, -50 * s, 0] }),
          ...both('hand', { r: [0, -15 * s, 0] }),
        }, extra.idle_stretch?.(t, u));
      },
    },
  };
};

const face = faceFor(eyeL, PALETTE.barkDk);
export default rigDef({ joints: [...baseJoints, ...face.joints], assign: makeAssign(PALETTE), extras: face.extras, clips: clipsFor({ face }) });
