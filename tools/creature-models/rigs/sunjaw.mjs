// Sunjaw's rig: a golden lion brawler with a blazing mane, huge bronze gauntlets and a white scarf streaming off both
// shoulders. Numbers are scad/sunjaw.scad's; the head block is scaled 1.3 about [0, -1, 29] (HF below).
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, inFrame, limb, mx, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near, side, subFrame } from './lib/geo.mjs';

const FUR = [0.93, 0.66, 0.16];
const MANE = [[0.98, 0.74, 0.18], [0.88, 0.55, 0.1]];
const BRONZE = [[0.35, 0.25, 0.18], [0.55, 0.4, 0.25]];
const EMBER = [1, 0.5, 0.1];
const SCARF = [0.92, 0.9, 0.85];
const CLAW = [0.95, 0.92, 0.85];

// the head block: translate([0, -1, 29]) scale(1.3) translate([0, 1, -29]); points inside are written shifted
const HF = subFrame([0, -1, 29], [0, 0, 0], 1.3);
const hs = (p) => [p[0], p[1] + 1, p[2] - 29];

const TAIL = [[0, 4, 12], [4, 8, 7], [9, 8, 3], [13, 5, 3], [14, 2, 6]];
const TAIL_R = [1.4, 1.2, 1.1, 1, 0.9];
const tails = ['tail1', 'tail2', 'tail3'];

const eyeL = { side: 'L', at: hs([2, -5.3, 33.2]), size: 1.2, yaw: -12, frame: HF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FUR });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4, 0, 13]),
  { name: 'body', parent: 'root', at: [0, 0, 14] },
  { name: 'head', parent: 'body', at: [0, -0.5, 27.5] },
  ...pair('arm*', 'body', [8, 0, 26]),
  ...pair('fore*', 'arm*', [11, -1, 19.5]),
  ...pair('scarf*', 'body', [8, 3, 28.5]),
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[1] },
  { name: 'tail3', parent: 'tail2', at: TAIL[2] },
  ...face.joints,
];

const head = any(
  inFrame(HF, blob([[[4, 3.6, 3.8], hs([0, -2, 32.5])], [[2.6, 2.2, 1.8], hs([0, -5.4, 31])]])),
  inFrame(HF, ell([6, 5, 6], hs([0, 2, 32]))),
  limb([0, 0, 27], [0, -1.5, 30], 3, 2.8),
);
const parts = [
  ['head', head],
  ['body', any(blob([[[7.5, 5, 5.5], [0, 0, 23]], [[5, 4, 4], [0, 0, 16]]]), mx(ell([3.2, 1.4, 2.4], [2.6, -4, 23])),
    mx(ell([3.4, 1.4, 3.6], [3, 4, 22.5])), mx(ell([1.8, 1, 1.6], [2.6, 4.6, 26])), ell([5.6, 4.6, 1.6], [0, 0, 14.5]),
    limb([0, -4.5, 14], [0, -4.8, 8], 1.2), limb([0, 4.2, 14], [0, 4.8, 8.5], 1.2), mx(limb([4.2, 0, 13.5], [5.2, -0.6, 9.5], 1)),
    mx(limb([0, -4, 26.5], [6, -1, 27.5], 2.2)), mx(limb([0, 4.6, 27.5], [6, 3, 28], 2.4)))],
  ['arm*', any(ell([3.4, 3.4, 3.2], [8, 0, 26]), limb([8.5, 0, 25], [11, -1, 19.5], 2.8, 2.4), ell([2.4, 2.4, 2.6], [10, -1.5, 22.5]))],
  ['fore*', any(ell([4.4, 4.4, 4.6], [12.5, -2.5, 15]), ell([2, 2, 2.5], [12, -1.3, 20]))],
  ['leg*', any(limb([4, 0, 13], [5.5, -2, 8], 4, 3.2), limb([5.5, -2, 8], [5.8, 0.5, 3.5], 2.8, 2), ell([2.6, 3.4, 1.5], [6, -1.5, 1.5]),
    ell([2.2, 1.6, 2.6], [4.7, -2.4, 11]), limb([6, -4.4, 1], [6, -5.6, 0.6], 1))],
  ...chain(tails, TAIL, TAIL_R),
  ['tail3', ell([2.8, 2.8, 3], [14, 2, 7])],
];

function assign(c, rgb) {
  const S = side(c);
  const ax = Math.abs(c[0]);
  if (near(rgb, SCARF)) return ax > 8.5 ? `scarf${S}` : 'body';
  if (isAny(rgb, BRONZE) || near(rgb, EMBER)) return `fore${S}`;
  if (isAny(rgb, MANE)) {
    if (c[2] < 10 && c[1] > -1) return 'tail3';
    if (ax > 9 && c[2] < 22) return `fore${S}`;
    return 'head';
  }
  if (near(rgb, CLAW)) {
    if (c[2] < 2.5) return `leg${S}`;
    if (ax > 9 && c[2] < 16) return `fore${S}`;
    if (c[2] > 27) return 'head';
    return 'body';
  }
  return pick(c, parts);
}

// the scarf ends stream behind the shoulders; faster when it moves
const flutter = (u, cycles, amp = 1, lift = 0) => both('scarf',
  { r: [8 * amp * osc(u, cycles), -lift, 10 * amp * osc(u, cycles, 0.25)] },
  { r: [8 * amp * osc(u, cycles, 0.4), lift, -10 * amp * osc(u, cycles, 0.65)] });

const base = bipedClips({
  face, tail: tails, hipH: 13, stride: 18, armSwing: 16, hopScale: 0.6, droop: 0.7,
  // a heavy straight right from the gauntlet
  punch: { arm: [-80, 8, 0], fore: [-15, 0, 0] },
  cheer: { arm: [0, -135, 0], fore: [0, 25, 0] },
  add: {
    idle: (t, u) => flutter(u, 2, 0.5),
    walk: (t, u) => flutter(u, 2, 1.2, 6),
    lunge: (t, u) => flutter(u, 1, 1.6, 12),
    hurt: (t, u) => flutter(u, 2, 1.4),
    celebrate: (t, u) => flutter(u, 3, 1.4, 10),
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
        head: { r: [-22 * r + 1.5 * tr, 0, 0], s: 1 + 0.06 * on },
        ...face.pose(on > 0.5 ? 'squeeze' : 'open', blinks(u, [[0.85, 0.9]])),
        ...both('arm', { r: [10 * on, -30 * on, 0] }),
        ...both('fore', { r: [-30 * on, 0, 0] }),
      }, flutter(u, 4, 1 + on));
    },
  },

  // fidget: it knocks the gauntlets together twice in front of its chest, then shakes out its fists
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
        ...both('arm', { r: [-45 * k, 22 * k - 6 * knock + 6 * shake, 0] }),
        ...both('fore', { r: [-45 * k, 0, 0], s: 1 + 0.05 * knock }),
      }, flutter(u, 2, 0.6));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
