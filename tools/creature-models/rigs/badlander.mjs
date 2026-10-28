// Badlander's rig: a hulking outlaw badger, paws hanging low, a duster cape down its back and a wheat stalk in its
// mouth (stalk). The duster is one joint (cape1): it is a hull whose triangles run from the shoulders to the hem, so
// it cannot bend in two. Numbers are scad/badlander.scad's.
import { K, TAU, both, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, mx, pair, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye, blinks } from './lib/face.mjs';
import { isAny, near } from './lib/geo.mjs';

export const CAPE = [[0.58, 0.5, 0.36], [0.476, 0.41, 0.295], [0.45, 0.47, 0.48]];
export const ROPE = [0.72, 0.6, 0.38];
export const WHEAT = [0.88, 0.76, 0.42];
export const BAND = [0.18, 0.14, 0.11];

export const eyeL = { side: 'L', at: [2.6, -10.5, 31.5], size: 1.45, yaw: 6 };
export const faceFor = (skin) => eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin });

export const jointsFor = (face) => [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4.4, 0.4, 14.5]),
  { name: 'body', parent: 'root', at: [0, 0.5, 15] },
  { name: 'head', parent: 'body', at: [0, -4, 28] },
  { name: 'stalk', parent: 'head', at: [1.4, -12.2, 28.5] },
  ...pair('arm*', 'body', [9, 0, 26]),
  ...pair('fore*', 'arm*', [11, -1.5, 20]),
  ...pair('hand*', 'fore*', [11.6, -3.6, 12.4]),
  { name: 'cape1', parent: 'body', at: [0, 4, 27] },
  ...face.joints,
];

export const parts = [
  ['body', any(blob([[[7.5, 5.5, 3.6], [0, 0.5, 15.5]]]), ell([7.2, 5.6, 3], [0, 0.5, 19]), ell([8, 6.4, 7.5], [0, -0.5, 24]),
    ell([9.6, 7.8, 8], [0, 0, 25]), mx(ell([3.4, 3.8, 2.6], [8.2, 0, 28.2])), blob([[[1.5, 1.4, 2.6], [7.6, -1.5, 14.5]]]),
    ell([5.6, 5, 1.2], [0, -4, 27.6]), ell([4.5, 1.2, 3], [0, -8.4, 25]))],
  ['head', any(ell([6.2, 5.8, 5.4], [0, -6, 31]), mx(ell([2.6, 2.4, 3], [3.4, -7.6, 29.6])),
    blob([[[3.4, 3, 2.6], [0, -9, 30]], [[1.9, 1.8, 1.5], [0, -12.4, 29.6]]]), ell([1.4, 3, 2.8], [0, -9.6, 33.4]),
    mx(ell([1.4, 0.9, 1.4], [4.4, -4, 35])), ell([9.4, 8.2, 2.2], [0, -6.5, 35.3]), ell([5, 4.6, 4.5], [0, -6.9, 38]))],
  ['leg*', any(blob([[[2.8, 4.2, 1.7], [5.5, -1.4, 1.7]], [[2.6, 2.6, 3.4], [5.5, 0.6, 4.5]]]), limb([5.5, 0.6, 7], [5.2, 0, 10.5], 3, 3.4),
    limb([5.2, 0, 10.5], [4.2, 0.5, 15], 3.4, 3.8))],
  ['arm*', limb([9, 0, 26], [11, -1.5, 20], 2.8, 2.6)],
  ['fore*', limb([11, -1.5, 20], [11.5, -3, 14.5], 2.9, 2.6)],
  ['hand*', ell([2.6, 2.4, 2.4], [11.6, -3.6, 12.4])],
];

export function assignWith(c, rgb, list = parts) {
  if (isAny(rgb, CAPE, 0.03) && c[1] > 1.5) return 'cape1';
  if (near(rgb, ROPE, 0.03)) return 'body';
  if (near(rgb, WHEAT, 0.03) && c[0] > 1.2 && c[1] < -11) return 'stalk';
  return pick(c, list);
}

// the stalk's chew: a waggle up and down (rx about the lips) and a little side to side
export const chew = (u, cycles, amp = 1) => ({ stalk: { r: [8 * amp * osc(u, cycles), 0, 6 * amp * osc(u, cycles / 2, 0.25)] } });

export const clipsFor = (face, extra = {}) => {
  const base = bipedClips({
    face, cape: ['cape1'], hipH: 14, stride: 18, armSwing: 14, hopScale: 0.2,
    punch: { arm: [-80, 0, 0], fore: [-15, 0, 0] },
    cheer: { arm: [-20, -115, 0], fore: [-10, 25, 0] },
    add: {
      idle: (t, u) => chew(u, 2, 0.4),
      walk: (t, u) => chew(u, 1, 0.6),
      hurt: (t, u) => chew(u, 3, 1.5),
      celebrate: (t, u) => chew(u, 2, 1.4),
      ...extra,
    },
  });
  return {
    ...base,

    // fidget: chews the wheat stalk, flicking it from one corner of the mouth to the other, eyes half shut
    idle_chew: {
      seconds: 2.4,
      pose: (t, u) => {
        const side = K(u, [[0, 0], [0.2, 0], [0.35, 1], [0.6, 1], [0.75, 0]]);
        return {
          head: { r: [2 * osc(u, 4), 0, 4 * side] },
          stalk: { r: [10 * osc(u, 6), 0, -40 * side] },
          ...(face ? face.pose('open', 0.45 * win(u, 0.1, 0.9, 0.1)) : {}),
          ...both('arm', { r: [2 * osc(u, 2), 0, 0] }),
        };
      },
    },

    // fidget: tips the hat brim with its left paw and a slow nod, then lets the arm swing back down
    idle_tiphat: {
      seconds: 2.2,
      pose: (t, u) => {
        const up = K(u, [[0, 0], [0.3, 1], [0.65, 1], [0.9, 0]]);
        const nod = win(u, 0.35, 0.62, 0.08);
        return {
          body: { r: [0, 0, 4 * up] },
          head: { r: [12 * nod, 0, 8 * up] },
          armL: { r: [-70 * up, 18 * up, -10 * up] },
          foreL: { r: [-85 * up, 0, 0] },
          handL: { r: [-20 * up, 0, 0] },
          ...(face ? face.pose('open', blinks(u, [[0.45, 0.55]])) : {}),
          ...chew(u, 2, 0.5),
        };
      },
    },
  };
};

const face = faceFor(BAND);
export default rigDef({ joints: jointsFor(face), assign: (c, rgb) => assignWith(c, rgb), extras: face.extras, clips: clipsFor(face) });
