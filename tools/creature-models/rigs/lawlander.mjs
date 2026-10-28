// Lawlander's rig: a badger sheriff hunched forward, paws hanging low, a duster cape down his back (one joint: it is a
// single hull), a cowboy hat (its own joint, for tipping) and a wheat stalk in the mouth (chewed). Numbers are
// scad/lawlander.scad's.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, inFrame, limb, mx, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { subFrame } from './lib/geo.mjs';

const eyeL = { side: 'L', at: [2.6, -10.5, 31.5], size: 1.45, yaw: 6 };
export const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.48, 0.44, 0.4] });

const HAT = subFrame([0, -6.5, 34.8], [8, 0, 0]);

// the duster: a hull shell from the shoulders (z 27) to the hem (z 9), the front half cut away (y < 2)
const capeT = (c) => {
  if (c[1] < 1.2 || c[2] < 7.5 || c[2] > 28.5) return 9;
  const f = Math.min(1, Math.max(0, (27 - c[2]) / 18));
  const rx = 9.4 + 1.6 * f; const ry = 7 + 1.4 * f; const cy = 1 + 0.5 * f;
  return 1 + Math.abs(Math.hypot(c[0] / rx, (c[1] - cy) / ry) - 1) * ry / 0.6;
};

export const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4.2, 0.5, 15]),
  { name: 'body', parent: 'root', at: [0, 0.5, 15.5] },
  { name: 'head', parent: 'body', at: [0, -4, 28] },
  { name: 'hat', parent: 'head', at: [0, -6.5, 35] },
  { name: 'wheat', parent: 'head', at: [1.4, -12.2, 28.5] },
  { name: 'cape1', parent: 'body', at: [0, 2, 27] },
  ...pair('arm*', 'body', [8.6, 0, 26.5]),
  ...pair('fore*', 'arm*', [11, -1.5, 20]),
  ...pair('hand*', 'fore*', [11.5, -3, 14.5]),
  ...face.joints,
];

export const parts = [
  ['body', any(ell([8, 6.4, 7.5], [0, -0.5, 24]), ell([7.2, 5.6, 3], [0, 0.5, 19]), ell([7.5, 5.5, 3.6], [0, 0.5, 15.5]), ell([7.6, 5.8, 1], [0, 0.5, 17.4]),
    blob([[[1.5, 1.4, 2.6], [7.6, -1.5, 14.5]], [[1.2, 1.2, 1], [7.4, -1.2, 16.6]]]), limb([8.4, 1.5, 9.8], [8.4, 1.5, 15.2], 2.6, 2.6), limb([8.6, 2.5, 10.5], [8.8, 3, 6.5], 0.4),
    (c) => (c[2] > 26 ? ell([9.6, 7.6, 7.6], [0, 0.5, 25])(c) : 9), limb([-4.2, -8.4, 27.2], [-0.8, -8.4, 21.6], 0.8), limb([4.2, -8.4, 27.2], [-0.8, -8.4, 21.6], 0.8),
    ell([5.6, 5, 1], [0, -4, 27.6]), limb([5, -2, 29.4], [8.5, -0.5, 31.2], 1, 0.4), limb([5, -2, 29.4], [8.2, 0.5, 28.2], 1, 0.4),
    limb([6.5, -4.6, 29.5], [3, -6.9, 26], 1.4), limb([3, -6.9, 26], [-1.5, -7.4, 22.5], 1.4), limb([-1.5, -7.4, 22.5], [-6.5, -5.4, 18.6], 1.4))],
  ['head', any(ell([6.2, 5.8, 5.4], [0, -6, 31]), mx(ell([2.6, 2.4, 3], [3.4, -7.6, 29.6])), blob([[[3.4, 3, 2.6], [0, -9, 30]], [[1.9, 1.8, 1.5], [0, -12.4, 29.6]]]),
    ell([1.1, 0.7, 0.8], [0, -14, 29.9]), ell([1.4, 3, 2.8], [0, -9.6, 33.4]), mx(limb([2.6, -10, 31.6], [4.6, -5, 33.2], 1.2, 1.7)), mx(ell([1.6, 1, 1.4], [2.6, -11.2, 31.5])),
    mx(ell([1.6, 1.2, 0.9], [2.6, -10.5, 32.8])), ell([1.4, 0.4, 0.25], [0, -12, 28.4]), mx(ell([1.4, 0.9, 1.4], [4.4, -4, 35])))],
  ['hat', inFrame(HAT, any(ell([9.4, 8.2, 1.2], [0, 0, 0.4]), ell([5, 4.6, 4.5], [0, 0, 3]), ell([4, 4.2, 1.8], [0, 0, 4.8])))],
  ['wheat', any(limb([1.4, -12.2, 28.5], [6.5, -13.4, 27], 0.3, 0.25), limb([5.9, -13.2, 27.2], [7.3, -13.2, 26.8], 0.6))],
  ['cape1', capeT],
  ['arm*', any(ell([3.4, 3.8, 2.6], [8.2, 0, 28.2]), limb([9, 0, 26], [11, -1.5, 20], 2.8, 2.6))],
  ['fore*', any(limb([11, -1.5, 20], [11.5, -3, 14.5], 2.9, 2.6), ell([2.9, 2.9, 0.5], [11.2, -2.2, 17.6]))],
  ['hand*', any(ell([2.6, 2.4, 2.4], [11.6, -3.6, 12.4]), limb([11.6, -4.6, 11.4], [11.6, -6.2, 8.4], 1.8, 0.3))],
  ['leg*', any(blob([[[2.8, 4.2, 1.7], [5.5, -1.4, 1.7]], [[2.6, 2.6, 3.4], [5.5, 0.6, 4.5]]]), limb([5.5, 3.4, 1.5], [5.5, 3.4, 3.7], 0.6),
    ell([2.85, 2.85, 0.6], [5.5, 0.6, 2.3]), limb([5.5, 0.6, 7], [5.2, 0, 10.5], 3, 3.4), limb([5.2, 0, 10.5], [4.2, 0.5, 15], 3.4, 3.8))],
];

export const assign = (list) => (c) => pick(c, list);

const addAll = (...maps) => Object.fromEntries([...new Set(maps.flatMap((m) => Object.keys(m)))]
  .map((k) => [k, (t, u) => merge(...maps.map((m) => m[k]?.(t, u)))]));

// the stalk bobs as he chews; it flips on a hit
const chew = {
  idle: (t, u) => ({ wheat: { r: [0, 6 * osc(u, 4), 4 * osc(u, 2)] } }),
  walk: (t, u) => ({ wheat: { r: [0, 4 * osc(u, 2), 0] } }),
  hurt: (t, u) => ({ wheat: { r: [0, 20 * Math.sin(TAU * 2 * u) * (1 - u), 0] }, hat: { r: [-10 * Math.sin(Math.PI * u), 0, 0], p: [0, 0, 0.8 * Math.sin(Math.PI * u)] } }),
  faint: (t, u) => ({ hat: { r: [14 * K(u, [[0.2, 0], [0.8, 1]]), 0, 0] } }),
};

export const clipsFor = (extra = {}) => {
  const base = bipedClips({
    face, hipH: 15, stride: 16, armSwing: 14, hopScale: 0.4, droop: 0.6, cape: ['cape1'],
    punch: { arm: [-80, 0, 0], fore: [-15, 0, 0] },
    add: addAll(chew, extra),
  });
  return {
    ...base,

    // fidget: a slow tip of the hat with the left paw, eyes half shut
    idle_tip: {
      seconds: 2.6,
      pose: (t, u) => {
        const up = K(u, [[0, 0], [0.25, 1], [0.7, 1], [0.9, 0]]);
        const tip = win(u, 0.32, 0.62, 0.08);
        return {
          head: { r: [6 * tip, 0, 8 * up] },
          hat: { r: [14 * tip, 0, 0] },
          ...face.pose('open', 0.5 * up),
          armL: { r: [-70 * up, -20 * up, 0] }, foreL: { r: [-70 * up, 0, 0] },
          wheat: { r: [0, 6 * osc(u, 3), 0] },
        };
      },
    },

    // fidget: the paw drops to the holster, hovers, taps twice, and he settles back with a smug chew
    idle_draw: {
      seconds: 2.4,
      pose: (t, u) => {
        const at = K(u, [[0, 0], [0.2, 1], [0.75, 1], [0.92, 0]]);
        const tap = Math.max(0, Math.sin(TAU * 4 * u)) * win(u, 0.3, 0.7, 0.04);
        return {
          body: { r: [0, 0, 6 * at] },
          head: { r: [-4 * at, 0, 10 * at] },
          ...face.pose('open', 0.4 * at + blinks(u, [[0.8, 0.86]])),
          armL: { r: [6 * at, -10 * at, 0] }, foreL: { r: [10 * at, 0, 0] },
          handL: { r: [-10 * tap, 0, 0] },
          wheat: { r: [0, 12 * osc(u, 4) * (1 - at), 0] },
        };
      },
    },
  };
};

export default rigDef({ joints, assign: assign(parts), extras: face.extras, clips: clipsFor() });
