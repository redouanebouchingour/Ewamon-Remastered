// Sunjaw's rig: a golden lion brawler in a wide stance, its huge wild mane on the head, two huge round gauntlets held
// out wide on the forearms, and a smoke scarf: the band round the neck stays on the body, the cloud rising off the +X
// shoulder (scarfL) and the wisp curling up on the -X side (scarfR) stream on their own joints. Numbers are
// scad/sunjaw.scad's; the head block is translate(HC) rotate([0, 0, HEAD_YAW]) scale(HS) (HF below).
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, chain, ell, inFrame, limb, mx, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near, side, subFrame } from './lib/geo.mjs';

const FUR = [0.93, 0.62, 0.13];
const MANE = [[0.97, 0.72, 0.17], [0.99, 0.84, 0.34], [0.82, 0.5, 0.09]];
const GAUNTLET = [[0.3, 0.2, 0.16], [0.57, 0.42, 0.32], [0.48, 0.35, 0.27], [1, 0.48, 0.08], [1, 0.6, 0.15]];
const SMOKE = [[0.9, 0.87, 0.81], [0.68, 0.62, 0.56]];
const RED = [[0.83, 0.17, 0.09], [0.57, 0.1, 0.07]];
const CREAM = [0.96, 0.9, 0.78];
const CLAW = [0.9, 0.84, 0.72];
const INK = [0.12, 0.04, 0.03];
const EYE_RED = [0.86, 0.1, 0.05];
const NOSE = [0.55, 0.2, 0.1];

// the head block: translate(HC) rotate([0, 0, HEAD_YAW]) scale(HS)
const HF = subFrame([-1, -2.5, 29.2], [0, 0, -12], 1.15);

const TAIL = [[1.5, 4.6, 13.2], [6, 6.6, 12], [11.4, 6.4, 8.8], [13.2, 3.6, 5], [9.4, 4.6, 3.6], [5.2, 2.6, 4.2], [3, 0.6, 5.2]];
const TAIL_R = [1.7, 1.55, 1.4, 1.3, 1.2, 1.15, 1.1];
const tails = ['tail1', 'tail2', 'tail3'];

const eyeL = { side: 'L', at: [2.15, -2.95, 0.8], size: 0.85, yaw: 10, frame: HF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FUR });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [3.6, 0.5, 14]),
  { name: 'body', parent: 'root', at: [0, 0.3, 14] },
  { name: 'head', parent: 'body', at: [-0.2, 0.1, 24.8] },
  ...pair('arm*', 'body', [6.6, 0.5, 24.4]),
  ...pair('fore*', 'arm*', [11, 1.4, 21.4]),
  { name: 'scarfL', parent: 'body', at: [6.6, -0.6, 26.4] },
  { name: 'scarfR', parent: 'body', at: [-7, 0.4, 25.6] },
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[1] },
  { name: 'tail3', parent: 'tail2', at: TAIL[2] },
  ...face.joints,
];

// the gauntlet's frame: translate([16, -1.5, 20.2]) rotate([0, 0, 14]) scale(1.13), mirrored for the right one
const GF = subFrame([16, -1.5, 20.2], [0, 0, 14], 1.13);
const gauntlet = inFrame(GF, any(limb([0, -2.1, 0], [0, 3.3, 0], 5.45), ell([5, 2.4, 4.8], [0, -2.6, 0])));

const parts = [
  ['head', any(limb([0, 0.5, 23.5], [-0.7, -1.6, 28.2], 3, 2.7),
    inFrame(HF, any(ell([3.4, 3.3, 3.3], [0, 0, 0.6]), ell([5.6, 4.6, 5.6], [0, 3.4, 1.8]), limb([0, -2.9, 0.2], [0, -4.4, -0.45], 0.9, 1.15),
      ell([0.95, 0.6, 0.6], [0, -5.45, -0.45]), mx(ell([1.7, 1.4, 1.35], [1.05, -4.15, -1.95])), ell([1.6, 1.25, 0.95], [0, -3.85, -3.4]),
      mx(ell([1, 0.6, 1.1], [2.15, -2.95, 0.8])), mx(limb([0.7, -3.2, 1.55], [3.2, -1.9, 2.3], 0.6)), mx(ell([1.05, 0.55, 1.05], [2.8, 0.2, 2.6])))))],
  ['body', any(limb([0, 0, 22.5], [0, 0.3, 18], 5.2, 3.8), mx(ell([3.2, 0.8, 1.9], [2.5, -3.7, 22.6])), mx(ell([3.2, 1.4, 3.4], [2.9, 3.3, 22])),
    mx(ell([1.8, 1, 1.6], [2.4, 3.9, 25])), limb([0, 0.2, 19.6], [0, 0.5, 13], 4.6, 7.5))],
  ['arm*', any(ell([3.1, 3, 2.9], [6.6, 0.5, 24.4]), limb([7.3, 0.5, 23.8], [11, 1.4, 21.4], 2.5, 2.1), ell([2.1, 1.8, 2], [9, -0.4, 23.6]))],
  ['fore*', any(limb([11, 1.4, 21.4], [14.8, 2, 20.4], 2.1, 2.3), gauntlet)],
  ['leg*', any(limb([3.6, 0.5, 14], [8, -1.2, 9.2], 4, 2.8), ell([2.6, 2, 3], [5.8, -2.2, 11.6]), limb([8, -1.2, 9.2], [9.2, 1, 4.2], 2.7, 1.8),
    limb([9.2, 1, 4.2], [10.2, -1.5, 1.4], 1.6, 1.4), ell([2.4, 2.8, 1.35], [10.2, -1.8, 1.35]), limb([8.3, -4.2, 0.9], [12.1, -4.2, 0.9], 0.9))],
  ...chain(tails, TAIL, TAIL_R),
];

// the smoke: the collar round the neck on the body, the rising band and cloud on scarfL, the -X wisp on scarfR
const smokeParts = [
  ...chain(['body'], [[-7.6, 2.8, 23.4], [-7.4, 2.2, 24.8], [-5.6, 2.6, 26.4], [-2.5, 4, 27.6], [1, 4.2, 28.4], [4.2, 2.8, 28.8], [6.2, 0.2, 27.6],
    [6.4, -2.4, 24.6]], [1.2, 1.6, 1.8, 1.9, 1.9, 1.9, 1.8, 1.5]),
  ...chain(['scarfL'], [[6.6, -0.6, 26.4], [8.4, 0.8, 28.6], [11, 2, 30.4], [14, 3, 31.2], [17, 3, 31.8], [19.8, 3, 33.4], [20.4, 3, 35.4],
    [18.2, 3.2, 36.2], [16.2, 3, 34.8]], [1.4, 1.8, 2.1, 2.3, 2.2, 2, 1.6, 1.2, 0.8]),
  ...[[10.6, 2.4, 32, 2], [13.4, 3.2, 33.4, 2.3], [16.4, 3.2, 34.2, 2.1], [12.4, 3, 29.4, 1.6], [17.6, 3, 30.4, 1.5], [19.6, 3, 32, 1.4]]
    .map((p) => ['scarfL', ell([p[3] * 1.2, p[3] * 1.02, p[3] * 0.96], [p[0], p[1], p[2]])]),
  ...chain(['scarfR'], [[-7, 0.4, 25.6], [-9.6, -0.8, 26.4], [-11.2, -1, 28.8], [-11.1, -1, 31.8], [-10, -1.2, 33.8], [-8.8, -1.2, 33.4]],
    [1.3, 1.4, 1.3, 1.1, 0.8, 0.4]),
];

function assign(c, rgb) {
  const S = side(c);
  if (isAny(rgb, GAUNTLET)) return `fore${S}`;
  if (isAny(rgb, SMOKE)) return pick(c, smokeParts);
  if (isAny(rgb, RED)) return 'body';
  if (isAny(rgb, MANE)) return c[2] < 15 ? 'tail3' : 'head';   // the tail's tuft is mane-coloured
  if (near(rgb, INK) || near(rgb, EYE_RED) || near(rgb, NOSE)) return 'head';
  if (near(rgb, CREAM)) return c[2] > 24.5 ? 'head' : 'body';   // muzzle and fangs; the chest scar
  if (near(rgb, CLAW)) return `leg${S}`;
  return pick(c, parts);
}

// the scarf's cloud and wisp stream and billow; faster when it moves
const flutter = (u, cycles, amp = 1, lift = 0) => ({
  scarfL: { r: [6 * amp * osc(u, cycles), -lift, 8 * amp * osc(u, cycles, 0.25)] },
  scarfR: { r: [8 * amp * osc(u, cycles, 0.4), lift * 0.5, -6 * amp * osc(u, cycles, 0.65)] },
});

const base = bipedClips({
  face, tail: tails, hipH: 14, stride: 16, armSwing: 10, hopScale: 0.4, droop: 0.6,
  // a heavy hook: the right gauntlet swings in from the side and forward
  punch: { arm: [-20, 0, 60], fore: [0, 0, 25] },
  // the left gauntlet thrust up and out
  cheer: { arm: [-10, -55, 0], fore: [0, -20, 0] },
  add: {
    idle: (t, u) => flutter(u, 2, 0.5),
    walk: (t, u) => flutter(u, 2, 1.2, 6),
    lunge: (t, u) => flutter(u, 1, 1.6, 10),
    hurt: (t, u) => flutter(u, 2, 1.4),
    celebrate: (t, u) => flutter(u, 3, 1.4, 8),
    exit: (t, u) => flutter(u, 1, 1),
  },
});

const clips = {
  ...base,

  // fidget: a mighty roar. It rears back, the head throws up and the mane flares, then it settles with a snort
  idle_roar: {
    seconds: 2.4,
    pose: (t, u) => {
      const r = K(u, [[0, 0], [0.15, -0.4], [0.3, 1], [0.6, 1], [0.75, 0]]);
      const tr = Math.sin(TAU * 12 * u) * win(u, 0.3, 0.6, 0.03);
      const on = Math.max(0, r);
      return merge({
        root: { r: [-3 * on, 0, 0] },
        body: { r: [-8 * r, 0, 0] },
        head: { r: [-20 * r + 1.5 * tr, 0, 0], s: 1 + 0.06 * on },
        ...face.pose(on > 0.5 ? 'squeeze' : 'open', blinks(u, [[0.85, 0.9]])),
        ...both('arm', { r: [10 * on, -15 * on, 0] }),
        ...both('fore', { r: [0, -15 * on, 0] }),
      }, flutter(u, 4, 1 + on));
    },
  },

  // fidget: it swings the gauntlets in and knocks them together twice in front of its chest, then shakes them out
  idle_knuckles: {
    seconds: 2,
    pose: (t, u) => {
      const k = K(u, [[0, 0], [0.12, 1], [0.7, 1], [0.85, 0]]);
      const knock = win(u, 0.25, 0.33, 0.03) + win(u, 0.45, 0.53, 0.03);
      const shake = Math.sin(TAU * 8 * u) * win(u, 0.75, 0.98, 0.05);
      return merge({
        body: { r: [3 * k, 0, 0] },
        head: { r: [6 * k, 0, 0] },
        ...face.pose('open', 0.3 * k),
        ...both('arm', { r: [-10 * k, 14 * k + 4 * shake, -34 * k - 5 * knock] }),
        ...both('fore', { r: [0, 0, -22 * k], s: 1 + 0.04 * knock }),
      }, flutter(u, 2, 0.6));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
