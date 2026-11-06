// Shiveruff's rig: a chibi arctic fox pup on four short navy-socked legs in a wide stance, a big cyan feather ruff (on
// the body), a huge head turned 15 degrees to its right with big round blue eyes and an open grin, tall ears splayed
// wide and sheathed in ice crystal plates, and a snowball tail on a short stalk swung out to its left. Numbers are scad/shiveruff.scad's.
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, blob, ell, limb } from './lib/biped.mjs';
import { eyeKit } from './lib/face.mjs';
import { closest, fold, isAny, near, subFrame } from './lib/geo.mjs';
import { legs, quadrupedClips } from './lib/quadruped.mjs';

const FUR = [0.92, 0.97, 0.99];
const SHADE = [0.74, 0.83, 0.95];
const CYAN = [[0.57, 0.91, 0.97], [0.40, 0.72, 0.90], [0.38, 0.72, 0.86], [0.76, 0.93, 0.99]];   // ruff, ice, brows
const TAIL_BLUE = [0.47, 0.77, 0.90];
const PAWS = [[0.13, 0.26, 0.48], [0.26, 0.46, 0.66]];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// the scad's tuft(p, d, w) and shard(p, d, r): a leaf / crystal from p along d
const tuft = (p, d, w) => limb(p, add3(p, d), w * 0.7, 0.3);
const shard = (p, d, r) => limb(p, add3(p, d), r * 0.8, 0.3);

// ---- the head block: translate(HC) rotate([0, 0, HEAD_YAW])
const HC = [-1.7, -10.5, 25];
const HEAD_YAW = -15;
const hf = subFrame(HC, [0, 0, HEAD_YAW]);
const EYE = [6.5, -6.5, 0.3];
const EYE_YAW = 12;
const EAR_B = [6.2, 0.4, 5.6];
const EAR_TILT = 37;
const EAR_L = 12.4;
const ef = subFrame(EAR_B, [0, EAR_TILT, 0]);   // the ear block inside the head block

// the eyes: pupEye(EYE, 2.7, ±12) inside the head block; their front sits at about 0.5 × size (squash 0.6)
const eyes = [1, -1].map((s) => ({
  side: s > 0 ? 'L' : 'R', at: [0, 0, 0], size: 2.7, flat: 0.42, squash: 0.6,
  frame: subFrame(hf.world([s * EYE[0], EYE[1], EYE[2]]), [0, 0, s * EYE_YAW + HEAD_YAW]),
}));
const face = eyeKit({ eyes, skin: FUR, lid: [1.1, 1, 0.98] });

// ---- the legs: the scad's LEGS ([hip, foot]); the knee is 45 % of the way down at z 5.6
const LEGS = {
  legFL: [[4.2, -5.6, 9.5], [5.2, -8.8, 0]],
  legFR: [[-4.2, -5.6, 9.5], [-8.4, -10.6, 0]],
  legBL: [[4.6, 6.6, 9.5], [7.2, 12, 0]],
  legBR: [[-4.4, 6.6, 9.5], [-4.8, 9.6, 0]],
};
const legTest = ([hip, foot]) => {
  const knee = [...lerp3(hip, foot, 0.45).slice(0, 2), 5.6];
  return any(limb(hip, knee, 3.3, 3), limb(knee, add3(foot, [0, 0, 1.8]), 3, 3), ell([3.3, 3.9, 1.7], add3(foot, [0, -0.8, 1.5])),
    ell([2.2, 1.3, 1], add3(foot, [0, -3.1, 1.8])), limb(add3(knee, [0, 0, 1.6]), add3(knee, [0, 0, -0.8]), 3.9));
};
const legParts = Object.entries(LEGS).map(([name, l]) => [name, legTest(l)]);

// ---- the parts in the head frame (ears folded onto +X)
const inHead = (test) => (c) => test(hf.local(c));
const headTest = inHead(any(ell([11, 8.5, 8.3]), ell([10.6, 7.2, 5.6], [0, -0.6, -3.4]),
  blob([[[4.8, 3.6, 3.4], [0, -5.2, -3.4]], [[1.6, 1.3, 1.3], [0, -9.4, -3]]]),
  blob([[[4.6, 3.6, 2.6], [0.3, -4.8, -5.8]], [[2.4, 1.4, 1.4], [0.6, -8.4, -6]]]),
  tuft([0, -1, 7.4], [0, -0.4, 2.2], 2), shard([2.8, -3.8, 6.8], [0.2, -0.6, 2.8], 1.7),
  (p) => any(tuft([8.8, -2.2, -3.2], [3.4, 0.4, -1.8], 3.6), tuft([9.6, 0.4, -0.4], [3.4, 1, 0.4], 3.4),
    tuft([9, 2.6, 2.8], [2.6, 1.2, 1.4], 3), tuft([4, 5, 4.6], [0.8, 2.4, 1.2], 2.4))(fold(p))));
// the ear in its own frame (Z up the ear, -Y its front, +X its outer edge): the white ear, the lining, the plates
const earShape = (q) => any(blob([[[4.4, 1.9, 3.2], [0, 0, 1]], [[2.2, 1.2, 2], [0, -0.2, EAR_L * 0.55]], [[0.4, 0.4, 0.4], [0, -0.2, EAR_L]]]),
  shard([-0.2, -1.4, 0.6], [0, -0.3, EAR_L * 0.86], 2.7), shard([1.2, 1, 0.8], [0.7, 0.2, EAR_L * 0.92], 2.3),
  shard([3, 0.6, 0.4], [2.2, 0.2, EAR_L * 0.68], 2), shard([4.2, 0.2, -0.2], [3, 0, EAR_L * 0.45], 1.7),
  shard([-3.2, -0.5, 0.4], [-0.4, -0.2, 6.6], 2))(ef.local(q));
const earTest = (s) => (c) => {
  const p = hf.local(c);
  return Math.sign(p[0]) === s ? earShape(fold(p)) : Infinity;
};

// ---- the body with the ruff, and the tail
const RC = [-1, -9.5, 15.6];
const bodyTest = any(blob([[[7, 7, 6.6], [0, -4.5, 12.6]], [[7, 6.6, 6.4], [0, 6.5, 12.4]]]), ell([5, 8.6, 2.4], [0, 0.5, 6.8]),
  ell([12, 10.5, 9], RC), (c) => any(ell([4.8, 5.4, 5.6], [4.6, 8, 11.2]), tuft([6.2, 1.5, 10], [1.2, 1, -2.8], 2.6))(fold(c)));
const TB = [8, 14, 20.5];
const tailTest = any(limb([2, 9, 15], TB, 3.2, 3.8), ell([7.2, 7.2, 7.2], TB));

const joints = [
  { name: 'root', at: [0, 1, 0] },
  ...Object.entries(LEGS).map(([name, [hip]]) => ({ name, parent: 'root', at: hip })),
  { name: 'body', parent: 'root', at: [0, 1, 11] },
  { name: 'head', parent: 'body', at: [-1.2, -9.5, 19] },
  { name: 'earL', parent: 'head', at: hf.world(EAR_B) },
  { name: 'earR', parent: 'head', at: hf.world([-EAR_B[0], EAR_B[1], EAR_B[2]]) },
  { name: 'tail1', parent: 'body', at: [2, 9, 15] },
  ...face.joints,
];

function assign(c, rgb) {
  if (near(rgb, TAIL_BLUE, 0.02)) return 'tail1';
  if (isAny(rgb, PAWS, 0.03)) return closest(legParts.map(([n, t]) => [n, t(c)]));
  if (isAny(rgb, CYAN, 0.025)) {
    // the ruff rides the body; above it the brow marks and the crystals of the crown and the ears
    if (c[2] < 22) return 'body';
    return closest([['head', headTest(c)], ['earL', earTest(1)(c)], ['earR', earTest(-1)(c)]]);
  }
  if (near(rgb, FUR, 0.02) || near(rgb, SHADE, 0.025)) {
    return closest([['head', headTest(c)], ['earL', earTest(1)(c)], ['earR', earTest(-1)(c)], ['body', bodyTest(c)],
      ['tail1', tailTest(c)], ...legParts.map(([n, t]) => [n, t(c)])]);
  }
  return 'head';   // eyes, nose, the red mouth and the fangs
}

const clips = {
  ...quadrupedClips({ face, tail: ['tail1'], hipH: 9.5, stride: 16 }),

  // fidget: shivers from nose to tail, the ruff and snowball tail fluffing up, then a pleased ^ ^
  idle_shiver: {
    seconds: 2,
    pose: (t, u) => {
      const on = win(u, 0.08, 0.66, 0.05);
      const sh = Math.sin(TAU * 18 * u) * on;
      const happy = win(u, 0.7, 0.95, 0.04);
      return merge({
        body: { r: [0, 2 * sh, 0], s: [1 + 0.05 * on, 1, 1 + 0.03 * on] },
        head: { r: [-4 * happy, 1.5 * sh, 8 * happy] },
        tail1: { s: 1 + 0.1 * on, r: [10 * happy, 0, 0] },
        ...legs({ r: [0, 1.5 * sh, 0] }),
        ...face.pose(on > 0.4 ? 'squeeze' : happy > 0.4 ? 'happy' : 'open'),
        earL: { r: [-10 * on, 0, 0] },
        earR: { r: [-10 * on, 0, 0] },
      });
    },
  },

  // fidget: a fox pounce on its own spot: crouch, wiggle the rump, hop nose down
  idle_pounce: {
    seconds: 2.4,
    pose: (t, u) => {
      const crouch = K(u, [[0, 0], [0.2, 1], [0.5, 1], [0.58, 0]]);
      const wig = osc(u, 10) * win(u, 0.22, 0.48, 0.04);
      const hop = K(u, [[0.5, 0], [0.62, 1], [0.76, 0]]);
      return merge({
        root: { p: [0, 0, -0.8 * crouch + 3 * hop] },
        body: { r: [5 * crouch + 14 * hop, 0, 4 * wig] },
        head: { r: [8 * crouch + 12 * hop, 0, 0] },
        ...legs({ r: [-10 * crouch - 20 * hop, 0, 0] }, { r: [6 * crouch + 20 * hop, 0, 0] }),
        tail1: { r: [12 * crouch, 0, 14 * wig] },
        ...face.pose(hop > 0.3 ? 'shut' : 'open', 0.3 * crouch),
        earL: { r: [10 * crouch, 0, 0] },
        earR: { r: [10 * crouch, 0, 0] },
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
