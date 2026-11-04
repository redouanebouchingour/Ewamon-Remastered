// Ravatar's rig: a hunched werewolf warrior in a wide stance, long arms out to the sides with big clawed hands, a
// wild mane and short antlers on a low head, a bark skirt and plated thighs, and a big bushy tail sweeping out to its
// left, down and up (tail1..tail5). Numbers are scad/ravatar.scad's (its named constants are copied below). The relic
// forms import the pieces below and add their own props.
import { K, TAU, both, merge, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, mx, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, rot } from './lib/geo.mjs';

export const FUR = [0.74, 0.56, 0.37];
const TAILC = [[0.4, 0.38, 0.35], [0.8, 0.75, 0.62]];

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export const HEAD = [[[4.3, 3.8, 3.8], [0, -0.6, 26.8]], [[3.4, 3.1, 2.8], [0, -0.3, 30]]];
export const TORSO = [[[3.8, 3, 2.5], [0, 0.2, 15.5]], [[6.2, 3.9, 3.6], [0, -0.2, 20]], [[5.6, 3.6, 2.6], [0, 0.6, 23]]];
const RUFF = [[[5.8, 3.4, 2.6], [0, -0.6, 24]], [[4.2, 2.6, 2], [0, -2.2, 22.2]]];
const MANE = [[[3.6, 2.4, 2.4], [0, 2.2, 29.4]], [[4.4, 3.6, 2.6], [0, 1.4, 32]], [[4.6, 3.4, 2.6], [1.2, 1.8, 35]], [[3.2, 2.6, 1.8], [2, 2.2, 37.8]]];
export const SHOULDER = [8.3, 0, 21.8];
export const ELBOW = [11.5, -2.4, 17];
export const WRIST = [14.2, -2.3, 14.4];
export const HAND = [14.6, -2.4, 12.6];
export const HIP = [4.2, 0.3, 13.2];
const KNEE = [7.6, -1.2, 8.2];
const ANKLE = [9.6, -1.4, 3.2];
const FOOT = [9.8, -1.6, 0];
export const TAIL = [[1, 3.2, 11.5], [6, 6, 7.4], [11, 6, 7.2], [16, 4.5, 10.2], [17, 3, 15.4], [18, 2, 20], [18.6, 1.6, 23.4]];
const TAIL_R = [2, 3.3, 4.2, 4.6, 4.2, 3, 0.6];
const CREAM = [[6, 5.4, 5.4], [11.6, 5.4, 4.9], [18.3, 3.9, 9.2], [19.8, 2.4, 15.4], [20, 1.6, 19.5]];
const CREAM_R = [2.4, 3.2, 3.5, 3, 1.8];
export const tails = ['tail1', 'tail2', 'tail3', 'tail4', 'tail5'];

export const eye = { side: 'L', at: [2.4, -3.45, 27.3], size: 0.9, yaw: 22 };
export const faceFor = (skin = FUR) => eyeKit({ eyes: [eye, mirrorEye(eye)], skin });

export const baseJoints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', HIP),
  { name: 'body', parent: 'root', at: [0, 0.3, 13.5] },
  { name: 'head', parent: 'body', at: [0, -0.4, 23.6] },
  ...pair('arm*', 'body', SHOULDER),
  ...pair('fore*', 'arm*', ELBOW),
  ...pair('hand*', 'fore*', WRIST),
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[1] },
  { name: 'tail3', parent: 'tail2', at: TAIL[2] },
  { name: 'tail4', parent: 'tail3', at: TAIL[3] },
  { name: 'tail5', parent: 'tail4', at: TAIL[4] },
];

// scad shard(p, rot, w, t, h): a plate from p to its point h along the turned +Z
const shard = (p, r, w, h) => limb(p, add(p, rot(r, [0, 0, h])), w * 0.75, 0.3);
const lock = (p, d1, d2, d3, r) => {
  const a = add(p, d1); const b = add(a, d2); const c = add(b, d3);
  return any(limb(p, a, r, r * 0.75), limb(a, b, r * 0.75, r * 0.45), limb(b, c, r * 0.45, 0.1));
};
const LOCKS = [[[0, 1.4, 38.5], [-0.6, 0.4, 1.4], [-0.6, 0.6, 1], [-0.4, 0.6, 0.6], 1.6],
  [[1.4, 1.4, 38], [1, 0.6, 1.4], [1.4, 0.8, 0.8], [1.4, 0.8, 0.2], 1.5],
  [[2.8, 1.4, 36], [1.8, 0.4, 0.9], [2, 0.6, 0.4], [1.6, 0.8, -0.2], 1.6],
  [[3.2, 1.8, 33.6], [2, 0.4, 0.2], [1.8, 0.8, -0.4], [1.4, 1, -0.8], 1.5],
  [[-1.6, 1.2, 37.8], [-0.8, 0.4, 1.4], [-1, 0.6, 0.8], [-0.8, 0.8, 0.4], 1.5],
  [[-3, 1.4, 35.8], [-1.8, 0.4, 0.8], [-1.6, 0.8, 0.4], [-1.2, 0.8, 0], 1.6],
  [[-3.2, 1.8, 33.4], [-1.8, 0.6, -0.2], [-1.4, 1, -0.6], [-1, 1, -0.8], 1.4],
  [[0.5, 3.6, 36.4], [0.2, 1.2, 1.6], [0.3, 1, 1.4], [0.2, 0.8, 0.8], 1.6],
  [[2.2, 3.6, 34.4], [1.2, 1.2, 1], [1.4, 0.8, 0.8], [1, 0.6, 0.4], 1.4],
  [[-2, 3.6, 34.2], [-1.2, 1.2, 0.8], [-1.2, 0.8, 0.8], [-0.8, 0.6, 0.4], 1.4],
  [[0, 3.8, 32.4], [0, 1.6, -0.8], [0, 1.2, -1.6], [0, 0.6, -1.4], 1.5]].map((l) => lock(...l));
const ANTLER = [[3.6, 0, 29.6], [5.4, 0.2, 32.2], [6.6, 0.4, 35], [6.3, 0.6, 37.2]];
const ANTLER_R = [1.1, 0.9, 0.6, 0.15];

// the greave plates round each shin and the paw (left side numbers)
const GREAVE = [-50, 10, 70, 140, 210].map((a) => {
  const base = add([8.8, -1.4, 4], rot([0, 0, a], [0, -2.2, 0]));
  return limb(base, add(base, rot([16, 0, a], [0, 0, 4])), 1.2, 0.3);
});
const foot = (p) => add(FOOT, rot([0, 0, 18], p));
const PAW = [ell([1.9, 1.7, 1.3], foot([0, 0.4, 1.4])), ell([2, 1.6, 1.1], foot([0, -1.8, 1.1])),
  ...[-1.15, 0, 1.15].map((dx) => limb(foot([dx, -3.1, 0.75]), foot([dx * 1.25, -4.9, 0.15]), 0.65, 0.2))];
/** One arm's tests (scad arm(S, E, W, H), the creature's left numbers): forms with a posed arm reuse it. */
export const armTests = (S, E, W, H) => ({
  arm: any(ell([2.8, 2.8, 2.6], S), limb(S, E, 2.5, 2.2), ell([1.4, 0.6, 1.4], [8.6, -2.5, 22.9]), ell([1.3, 0.6, 1.3], [9.3, 2.3, 22.6])),
  fore: limb(E, W, 2.2, 2.1),
  hand: any(ell([2.4, 2.1, 2.5], H), ...[-1.3, -0.45, 0.45, 1.3].map((dx) => limb(add(H, [dx, -0.7, -1.5]), add(H, [dx * 1.45, -2.1, -4.4]), 0.65, 0.3))),
});
const ARM = armTests(SHOULDER, ELBOW, WRIST, HAND);

// the tail's fur tufts, each with the tail joint it hangs on
const TUFTS = [[[9.6, 5, 4], [3.4, -0.4, -1.2], 1.7, 'tail2'], [[14.8, 3.8, 5], [3.8, -0.4, -0.2], 1.8, 'tail3'],
  [[20, 2.6, 9.8], [1.8, -0.4, 3.2], 1.7, 'tail4'], [[20.6, 1.6, 13.6], [1, -0.2, 3.6], 1.6, 'tail4'],
  [[20, 1.2, 18.2], [0.3, 0, 3.4], 1.4, 'tail5'], [[12.4, 6.6, 11.2], [-1, 0, 3.6], 1.7, 'tail3'],
  [[14.2, 5, 15], [-1.2, 0, 3.6], 1.6, 'tail4'], [[11, 8.4, 8.8], [3, 0.8, 0.6], 1.7, 'tail3'],
  [[16.6, 6.8, 12.4], [0.6, 0.6, 3.2], 1.6, 'tail4'], [[5.6, 7.6, 9.4], [3, 0.6, -0.6], 1.5, 'tail2'],
  [[18, 1.8, 21.2], [-0.9, 0, 3.6], 1.9, 'tail5']];
const tailParts = [
  ...chain(tails, TAIL, TAIL_R),
  ...chain(['tail2', 'tail3', 'tail4', 'tail5'], CREAM, CREAM_R),
  ...TUFTS.map(([p, d, w, n]) => [n, limb(p, add(p, d), w, 0.3)]),
];

/** Every part but the tail, nearest primitive wins. */
export const bodyParts = [
  ['body', any(blob(TORSO), mx(ell([2.7, 1.3, 1.9], [2.7, -3, 20.6])), mx(ell([1.05, 0.7, 0.62], [1.05, -3, 17])),
    mx(ell([1.8, 0.6, 1.8], [3.5, 3.45, 20.4])), blob(RUFF), limb([0, -4.3, 21], [0, -4.3, 18.6], 1.2, 0.4),
    mx(limb([2.8, -3.7, 22.6], [5.2, -2.7, 21.6], 1.4, 0.5)),
    ell([4.1, 3.3, 2], [0, 0.3, 13.4]), ell([4.25, 3.55, 0.9], [0, 0.2, 15.6]),
    shard([0, -3.3, 15.4], [180, 0, 0], 2.6, 8.6), mx(shard([2.3, -2.9, 15.2], [182, -12, 0], 1.8, 6.6)),
    shard([0, 3.6, 15.4], [178, 0, 0], 2.2, 6.8), mx(shard([2.6, 3, 15.2], [178, -12, 0], 1.7, 5.6)),
    mx(shard([3.9, -1.4, 15.4], [178, -28, 0], 1.8, 5.2)), mx(shard([3.9, 1.4, 15.4], [178, -28, 0], 1.7, 4.8)))],
  ['head', any(blob(HEAD), ell([2.1, 1.9, 1.5], [0, -3.9, 24.4]), ell([1.6, 1.4, 0.9], [0, -3.6, 23.1]), ell([0.9, 0.55, 0.52], [0, -5.65, 25.3]),
    mx(ell([3, 1, 1.7], [4.6, -1.4, 25.2])), mx(ell([2.4, 0.9, 1.3], [4.2, -2.2, 23.4])), mx(ell([0.85, 0.6, 1.7], [3.4, 0.2, 30.6])),
    mx(ell([0.9, 0.5, 1.05], eye.at)), mx(limb([0.9, -4.05, 27.9], [3.6, -2.95, 28.8], 0.25)),
    blob(MANE), ...LOCKS, mx((c) => Math.min(...ANTLER.slice(1).map((p, i) => limb(ANTLER[i], p, ANTLER_R[i], ANTLER_R[i + 1])(c)))),
    mx(limb([5.45, 0.2, 32.4], [7.3, -0.1, 33.6], 0.6, 0.15)))],
  ['arm*', ARM.arm],
  ['fore*', ARM.fore],
  ['hand*', ARM.hand],
  ['leg*', any(limb(HIP, KNEE, 3, 2.4), ell([2.1, 2, 1.8], add(KNEE, [0, -0.6, 0.6])), limb(KNEE, ANKLE, 2.3, 1.8),
    shard([5.9, -2.8, 7.8], [-15, -8, 0], 2.5, 7), shard([8.1, -1.2, 8.4], [-10, 22, 0], 2.2, 6.2), shard([4.4, -2.5, 10.4], [-18, -16, 0], 1.9, 5),
    shard([8.4, 0.8, 8.6], [10, 24, 0], 1.8, 4.8), shard([6.2, 2.2, 9.6], [18, 8, 0], 1.8, 4.6),
    ell([2.6, 2.6, 2.5], [8.8, -1.4, 5]), ...GREAVE, ...PAW)],
];

export const baseParts = [...bodyParts, ...tailParts];

/** Tail-coloured triangles go to the tail chain, the rest to the nearest body part (pass bodyParts plus a form's own). */
export const assignFor = (parts = bodyParts) => (c, rgb) => (isAny(rgb, TAILC, 0.012) ? pick(c, tailParts) : pick(c, parts));

/** The clips: `extra` layers form-specific poses per clip (props, relic tails); `opts` overrides bipedClips options. */
export function clipsFor({ face, extra = {}, opts = {} }) {
  const X = (k) => (t, u) => extra[k]?.(t, u);
  const base = bipedClips({
    face, tail: tails, hipH: 13.2, stride: 16, armSwing: 14, hopScale: 0.4, hopH: 2.4, droop: 0.8,
    punch: { arm: [-80, 14, 0], fore: [-14, 0, 0] },
    ...opts,
    add: extra,
  });
  return {
    ...base,

    // fidget: a roar. It rears up, chest out, arms flung wide with the claws spread, the tail bristling
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
          ...both('arm', { r: [-14 * on, -30 * on, 0] }),
          ...both('fore', { r: [-26 * on, 0, 0] }),
          ...both('hand', { s: 1 + 0.12 * on }),
          ...Object.fromEntries(tails.map((n, i) => [n, { r: [-5 * on * (1 + 0.3 * i), 0, 3 * tr], s: 1 + 0.06 * on }])),
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
          body: { r: [0, 0, 12 * look] },
          head: { r: [-4 * look, 0, 30 * look] },
          ...face.pose('open', blinks(u, [[0.3, 0.35], [0.8, 0.85]])),
          armL: { r: [6 * swat, -8 * swat, 24 * swat] }, foreL: { r: [-24 * swat, 0, 0] },
          ...Object.fromEntries(tails.map((n, i) => [n, { r: [2 * sw, 0, (5 * sw - 3 * swat) * (1 + 0.2 * i)] }])),
        }, X('idle_swish')(t, u));
      },
    },
  };
}

const face = faceFor();
export default rigDef({ joints: [...baseJoints, ...face.joints], assign: assignFor(), extras: face.extras, clips: clipsFor({ face }) });
