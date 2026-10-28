// Rambull's rig: a hulking ram brawler on two digitigrade legs, huge shoulders, arms hanging forward to dark hooves, a
// smug face (the scad scales the head block 1.2x) inside great spiral horns. Numbers are scad/rambull.scad's.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, inFrame, limb, mx, pair, petal, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near, side, subFrame } from './lib/geo.mjs';

const WOOL = [[0.93, 0.83, 0.64], [0.84, 0.72, 0.53]];
const FACE = [0.96, 0.84, 0.72];
const HORN = [[0.3, 0.29, 0.26], [0.45, 0.43, 0.38]];
const SKIN = [0.8, 0.64, 0.54];
const HOOF = [0.36, 0.26, 0.2];
// translate([0, -5, 33]) scale(1.2) translate([0, 5, -33]) { the face }
const H = subFrame([0, 1, -6.6], [0, 0, 0], 1.2);

const eyeL = { side: 'L', at: [2.6, -8, 34], size: 1.2, yaw: -22, flat: 0.6, frame: H };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FACE });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [6, 1, 12]),
  { name: 'body', parent: 'root', at: [0, 0, 13] },
  { name: 'head', parent: 'body', at: [0, -3, 30] },
  ...pair('arm*', 'body', [11.5, 0, 27]),
  ...pair('fore*', 'arm*', [14, -1.5, 18]),
  ...pair('hand*', 'fore*', [14.5, -5, 11]),
  { name: 'tail1', parent: 'body', at: [0, 6, 16] },
  ...face.joints,
];

const parts = [
  ['body', any(blob([[[10, 7.5, 8], [0, 0, 22]], [[12, 8, 6], [0, 0.5, 27]], [[8, 7, 6], [0, 0, 16]]]), mx(ell([5, 2.6, 3.6], [4.2, -6.4, 26])),
    mx(limb([8, -6.4, 29], [4, -7.6, 25.5], 1.2, 1.1)), mx(limb([4, -7.6, 25.5], [0.2, -7.8, 22], 1.1, 0.9)))],
  ['arm*', any(ell([5, 5, 5], [11.5, 0, 27]), ell([4, 4, 5], [14, -1, 21]))],
  ['fore*', any(limb([13.5, -1, 19], [14.5, -4, 14], 3.6, 3.2), limb([14.5, -4, 14], [14.5, -5, 11], 3.2, 2.8), ell([3.4, 3.4, 2.4], [14.5, -5, 13]))],
  ['leg*', any(ell([4.6, 5, 5.5], [6, 1, 12]), limb([6.5, 1, 9], [7, 3.5, 4.5], 3, 1.8), limb([7, 3.5, 4.5], [7, 1.5, 1.4], 1.8, 1.5))],
  ['head', any(inFrame(H, blob([[[4.6, 4.8, 5], [0, -4, 33]], [[3, 3, 3], [0, -9.5, 30]]])), ...[[0, -5, 38, 2.8], [-2.4, -3, 38, 2.4], [2.4, -3, 38, 2.4], [0, -1, 36.4, 2.8]]
    .map(([x, y, z, r]) => ell([r, r, r], [x, y, z])), mx(petal([2.6, 1, 1], [6, -6.4, 31], [0, 20, 30])))],
  ['tail1', ell([2.4, 2.4, 3], [0, 7.6, 16])],
];

function assign(c, rgb) {
  const S = side(c);
  if (near(rgb, HOOF)) return c[2] > 5 ? `hand${S}` : `leg${S}`;
  if (near(rgb, SKIN)) return `leg${S}`;
  if (isAny(rgb, HORN)) return 'head';
  if (!isAny(rgb, WOOL, 0.03)) return 'head';   // face, nose, mouth, eyes
  return pick(c, parts);
}

const base = bipedClips({
  face, tail: ['tail1'], hipH: 12, stride: 16, armSwing: 14, hopScale: 0.3, droop: 0.6,
  add: {
    idle: (t, u) => ({ body: { s: [1 + 0.012 * osc(u, 2), 1 + 0.012 * osc(u, 2), 1] } }),
    walk: (t, u) => ({ head: { r: [3 * osc(u, 2), 0, 0] } }),
  },
});

const clips = {
  ...base,

  // fidget: a double-biceps flex with a smug head tilt and a slow blink
  idle_flex: {
    seconds: 2.6,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.18, 1], [0.7, 1], [0.88, 0]]);
      const pump = Math.sin(TAU * 3 * u) * win(u, 0.25, 0.65, 0.05);
      return {
        body: { p: [0, 0, 0.3 * on], r: [-4 * on, 0, 0], s: [1 + 0.03 * on, 1 + 0.03 * on, 1] },
        head: { r: [-6 * on, 10 * on, 16 * on] },
        ...face.pose('open', 0.5 * on + blinks(u, [[0.5, 0.6]])),
        ...both('arm', { r: [0, -80 * on + 4 * pump, 0] }),
        ...both('fore', { r: [-100 * on - 8 * pump, 0, 0] }),
        ...both('hand', { s: 1 + 0.05 * Math.abs(pump) }),
      };
    },
  },

  // fidget: it lowers its horns and paws the ground with a hoof, snorting, ready to charge
  idle_paw: {
    seconds: 2.2,
    pose: (t, u) => {
      const low = K(u, [[0, 0], [0.15, 1], [0.8, 1], [0.95, 0]]);
      const scrape = (u0) => win(u, u0, u0 + 0.14, 0.04);
      const s = scrape(0.25) + scrape(0.5);
      return merge({
        root: { r: [3 * low, 0, 0] },
        body: { r: [8 * low, 0, 0] },
        head: { r: [18 * low - 4 * Math.abs(osc(u, 4)) * low, 0, 0] },
        ...face.pose('open', 0.55 * low),
        legR: { r: [-14 * s + 10 * win(u, 0.32, 0.42, 0.03) + 10 * win(u, 0.57, 0.67, 0.03), 0, 0], p: [0, 0, 0.8 * s] },
        ...both('arm', { r: [-10 * low, 0, 0] }),
        ...both('fore', { r: [-20 * low, 0, 0] }),
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
