// Ravatar's rig: a tall lion-hound warrior with long hanging arms, a wild mane and short antlers on the head, a plated
// loincloth on the hips and a long bushy tail curling out to its left and up (tail1..tail4, one per hulled segment).
// Numbers are scad/ravatar.scad's. The five relic forms import the pieces below and add their own props.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, mx, pair, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';

export const FUR = [0.9, 0.76, 0.55];

export const eye = { side: 'L', at: [2.15, -4.4, 34.9], size: 1.3, yaw: -18 };
export const faceFor = (skin = FUR) => eyeKit({ eyes: [eye, mirrorEye(eye)], skin });

export const TAIL = [[2, 4, 15], [7, 6, 9], [12.5, 4.5, 7], [16.5, 2, 10], [18, 0.5, 15], [17.6, 0, 20.5]];
const TAIL_R = [1.8, 3, 3.5, 3.3, 2.6, 0.9];
const CREAM = [[7, 4.4, 7.8], [12.5, 2.4, 5.6], [16, -0.2, 8.6], [17, -1.2, 13.5]];
export const tails = ['tail1', 'tail2', 'tail3', 'tail4'];

export const baseJoints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [3.6, 0, 16]),
  { name: 'body', parent: 'root', at: [0, 0, 16.5] },
  { name: 'head', parent: 'body', at: [0, -0.8, 31.5] },
  ...pair('ear*', 'head', [3.6, -0.6, 37.6]),
  ...pair('arm*', 'body', [7.2, 0, 28.5]),
  ...pair('fore*', 'arm*', [9.4, -0.6, 21]),
  ...pair('hand*', 'fore*', [10.4, -1.6, 14.5]),
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[1] },
  { name: 'tail3', parent: 'tail2', at: TAIL[2] },
  { name: 'tail4', parent: 'tail3', at: TAIL[3] },
];

const deg = (a) => (a * Math.PI) / 180;
// the rock chunks round each greave (left side numbers)
const CHUNKS = [[0, 4, 1.7], [72, 5, 1.6], [144, 4, 1.5], [216, 5.5, 1.6], [288, 4.2, 1.6], [20, 8.2, 1.6], [110, 8.6, 1.4], [200, 8, 1.5], [300, 8.4, 1.4]]
  .map(([a, z, r]) => ell([1.2 * r, 0.9 * r, r], [5.3 + 2.8 * Math.sin(deg(a)), -0.2 - 2.8 * Math.cos(deg(a)), z]));
const MANE = [[-4, 0, 41, -2, 1.4, 3], [-1.5, 0.5, 42, -0.6, 1.6, 4], [1.5, 0.6, 42, 1, 2, 3.8], [4, 0.4, 40.5, 2.6, 2, 2.4],
  [-5, 2, 38, -3.4, 2.4, 1], [5, 2, 38, 3.4, 2.4, 1.2], [0, 3, 40.5, 0, 5, 2.6], [-3, 4, 38, -1.4, 5, 0.6],
  [3, 4, 38, 1.6, 5, 0.6], [0, 5.5, 35, 0, 4, -2], [-3, 5, 33, -1.4, 3, -3], [3, 5, 33, 1.4, 3, -3]]
  .map((s) => spike([s[0], s[1], s[2]], [s[3], s[4], s[5]], 2.1));
const RUFF = [...Array.from({ length: 8 }, (_, i) => -70 + 20 * i).map((a) => spike([Math.sin(deg(a)) * 5.2, -3 + Math.abs(Math.sin(deg(a))) * 1.2, 30.5], [Math.sin(deg(a)) * 1.4, -1.2, -4], 1.3)),
  ...Array.from({ length: 12 }, (_, i) => 30 * i).map((a) => spike([Math.cos(deg(a)) * 5, Math.sin(deg(a)) * 3.8, 31], [Math.cos(deg(a)) * 2.2, Math.sin(deg(a)) * 2.2, -2], 1.6))];

export const baseParts = [
  ['body', any(ell([6, 4.2, 3.4], [0, 0, 16.5]), blob([[[4.8, 3.6, 3.6], [0, 0, 20]], [[7.4, 4.6, 4.4], [0, 0, 27]]]), ell([6.3, 4.5, 0.8], [0, 0, 18.2]),
    ...[-4, -1.4, 1.4, 4].map((x) => spike([x, -3.6, 17.5], [x * 0.15, -0.6, -5.5], 1.6)), ...[-3, 0, 3].map((x) => spike([x, 3.6, 17.5], [x * 0.15, 0.6, -4.5], 1.5)),
    mx(ell([3.2, 0.6, 1.4], [2.4, -3.95, 28.2])), ...RUFF, limb([0, 4.8, 30], [0.2, 3.8, 19.5], 0.8))],
  ['head', any(blob([[[4.6, 4.2, 4.2], [0, -0.8, 35]], [[3.6, 3.4, 3], [0, -1.6, 32.6]]]), ell([2.6, 2, 1.8], [0, -4.6, 32.6]), ell([0.9, 0.6, 0.6], [0, -6.4, 33.4]),
    mx(spike([3.4, -2.6, 31], [2, 0.4, -1], 1.2)), mx(spike([3.4, -2.6, 33], [2, 0.4, -1], 1.2)), mx(limb([1, -5.25, 35.75], [3.7, -3.6, 37], 0.6)),
    limb([0, -4, 38], [0, -2.2, 39.2], 0.8), mx(limb([2, -1.2, 38.6], [5.4, -0.6, 44], 0.7, 0.2)),
    blob([[[5, 4.6, 4], [0, 2, 37.5]], [[4, 3.6, 3], [0, 4.6, 33]]]), ...MANE, limb([0, 1.5, 42.2], [0, 7.4, 35.5], 0.8))],
  ['ear*', spike([3.6, -0.6, 37.6], [1.8, 0.4, 2.2], 1.2)],
  ['arm*', any(ell([3, 3, 2.8], [7.2, 0, 28.5]), limb([7.6, 0, 28], [9.4, -0.6, 21], 2.5, 2.1))],
  ['fore*', limb([9.4, -0.6, 21], [10.4, -1.6, 14.5], 2.1, 1.7)],
  ['hand*', any(ell([1.9, 1.7, 2], [10.6, -1.8, 13]), spike([10.6, -3, 11.6], [0, -0.8, -1.4], 0.45))],
  ['leg*', any(limb([3.6, 0, 16], [5, -0.6, 9], 3, 2.6), limb([5, -0.6, 9], [5.4, 0.4, 3], 2.4, 2), ell([3, 3, 3.6], [5.3, -0.2, 6]), ...CHUNKS,
    spike([5.8, -2.6, 9.5], [0.6, -1.2, 2.4], 1), blob([[[2.6, 3.4, 1.4], [5.6, -1.6, 1.4]], [[2.2, 2, 1.4], [5.6, 0.8, 1.6]]]), spike([5.6, -4.8, 1], [0, -1.4, -0.4], 0.55))],
  ...chain(['tail1', 'tail2', 'tail3', 'tail4', 'tail4'], TAIL, TAIL_R),
  ...chain(['tail2', 'tail3', 'tail4'], CREAM, [2.4, 2.6, 2.4, 1.6]),
  ['tail2', any(spike([10, 7.6, 8.5], [1.4, 1, 1], 1.2), spike([10, 3.4, 4.6], [1.2, -0.6, -1.4], 1.1))],
  ['tail3', any(spike([14.5, 5.8, 9], [1.4, 1, 1], 1.2), spike([14.5, 0.8, 5.2], [1.2, -0.6, -1.4], 1.1))],
  ['tail4', any(spike([18.4, 3, 15], [1.4, 1, 1], 1.2), spike([18.5, -1.4, 10], [1.2, -0.6, -1.4], 1.1))],
];

/** The clips: `extra` layers form-specific poses per clip (props, relic tails); `opts` overrides bipedClips options. */
export function clipsFor({ face, extra = {}, opts = {} }) {
  const X = (k) => (t, u) => extra[k]?.(t, u);
  const base = bipedClips({
    face, tail: tails, hipH: 16, stride: 18, armSwing: 18, hopScale: 0.6, hopH: 3, droop: 0.8,
    punch: { arm: [-88, 6, 0], fore: [-12, 0, 0] },
    ...opts,
    add: extra,
  });
  return {
    ...base,

    // fidget: a roar. It rears up, chest out, arms flung wide with the claws spread, the mane and ears flat back
    idle_roar: {
      seconds: 2.4,
      pose: (t, u) => {
        const on = K(u, [[0, 0], [0.2, 1], [0.7, 1], [0.88, 0]]);
        const tr = Math.sin(TAU * 12 * u) * win(u, 0.25, 0.7, 0.05);
        return merge({
          root: { r: [-2 * on, 0, 0] },
          body: { r: [-7 * on, 0, 0.6 * tr] },
          head: { r: [-20 * on + 0.8 * tr, 0, 0] },
          ...face.pose(on > 0.5 ? 'squeeze' : 'open', on * 2),
          ...both('arm', { r: [-14 * on, -38 * on, 0] }),
          ...both('fore', { r: [-30 * on, 0, 0] }),
          ...both('hand', { s: 1 + 0.12 * on }),
          ...both('ear', { r: [26 * on, -10 * on, 0] }),
          ...Object.fromEntries(tails.map((n, i) => [n, { r: [-6 * on * (1 + 0.3 * i), 0, 3 * tr] }])),
        }, X('idle_roar')(t, u));
      },
    },

    // fidget: it looks back over its shoulder at its own tail, which swishes, and gives it a lazy swat
    idle_swish: {
      seconds: 2.6,
      pose: (t, u) => {
        const look = K(u, [[0, 0], [0.18, 1], [0.72, 1], [0.9, 0]]);
        const swat = win(u, 0.42, 0.62, 0.06);
        const sw = Math.sin(TAU * 2 * u) * look;
        return merge({
          body: { r: [0, 0, 14 * look] },
          head: { r: [-4 * look, 0, 34 * look] },
          ...face.pose('open', blinks(u, [[0.3, 0.35], [0.8, 0.85]])),
          armL: { r: [8 * swat, -10 * swat, 30 * swat] }, foreL: { r: [-30 * swat, 0, 0] },
          ...Object.fromEntries(tails.map((n, i) => [n, { r: [2 * sw, 0, (6 * sw - 4 * swat) * (1 + 0.25 * i)] }])),
        }, X('idle_swish')(t, u));
      },
    },
  };
}

const face = faceFor();
export default rigDef({ joints: [...baseJoints, ...face.joints], assign: (c) => pick(c, baseParts), extras: face.extras, clips: clipsFor({ face }) });
