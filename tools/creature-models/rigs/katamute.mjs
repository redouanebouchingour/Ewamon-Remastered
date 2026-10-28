// Katamute's rig: a shaggy puppy brawler holding a double-biceps flex (the rest pose: upper arms out, forearms up, fists
// by the head), floppy ears, a long grey ponytail streaming off its top-knot (pony1..3) and a bushy tail.
// Numbers are scad/katamute.scad's.
import { K, TAU, both, merge, osc, rigDef, wave, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, pair, pick, spike } from './lib/biped.mjs';
import { eyeKit, mirrorEye, blinks } from './lib/face.mjs';

const FUR = [0.95, 0.83, 0.62];
const PONY = [[0, 1, 36.5], [2.5, 2, 39], [6, 2.5, 39], [9.5, 3, 37], [13, 3.5, 38]];
const ponies = ['pony1', 'pony2', 'pony3'];
const tails = ['tail1', 'tail2', 'tail3'];

const eye = { side: 'L', at: [2.6, -4.85, 27.5], size: 1.45, yaw: 6 };
const face = eyeKit({ eyes: [eye, mirrorEye(eye)], skin: FUR });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [3.6, 0, 11]),
  { name: 'body', parent: 'root', at: [0, 0, 11] },
  { name: 'head', parent: 'body', at: [0, 0, 22] },
  ...pair('ear*', 'head', [5.2, -0.5, 31.5]),
  { name: 'pony1', parent: 'head', at: PONY[1] },
  { name: 'pony2', parent: 'pony1', at: PONY[2] },
  { name: 'pony3', parent: 'pony2', at: PONY[3] },
  ...pair('arm*', 'body', [6.2, 0, 19.5]),
  ...pair('fore*', 'arm*', [10.5, -0.6, 19.5]),
  ...pair('hand*', 'fore*', [11, -1.2, 25]),
  { name: 'tail1', parent: 'body', at: [2, 3.5, 10] },
  { name: 'tail2', parent: 'tail1', at: [7, 5.5, 9] },
  { name: 'tail3', parent: 'tail2', at: [11.5, 5, 11.5] },
  ...face.joints,
];

const parts = [
  ['body', any(blob([[[4.6, 3.8, 3.6], [0, 0, 12.5]], [[6.4, 4.6, 4.4], [0, 0, 18]]]), ell([3.4, 1.4, 3], [0, -3.4, 14]), ell([5.5, 4.5, 2.4], [0, 0, 20.5]))],
  ['head', any(blob([[[6.6, 5.8, 5.6], [0, 0, 28]], [[5.5, 5, 4.6], [0, -0.5, 25.5]]]), ell([3.2, 2.4, 2.2], [0, -5.4, 25]), ell([2.6, 2.6, 2.4], [0, 0.6, 35.6]),
    limb([0, 0.5, 33.2], [0, 0.5, 34.4], 2.2, 1.9))],
  ...chain(['head', ...ponies], PONY, [2.4, 2.3, 1.9, 1.3, 0.4]),
  ...chain(['head', 'head', 'pony1'], [[-0.5, 0.5, 37], [-1.5, 1.5, 40], [0.5, 2.5, 41.5], [3.5, 3, 41.5]], [1.6, 1.4, 1, 0.3]),
  ...chain(['pony1', 'pony2'], [[4, 2.4, 39], [7, 3.6, 37], [9.5, 4.6, 36.6]], [1, 0.8, 0.2]),
  ['ear*', any(limb([5.2, -0.5, 31.5], [7.2, -1.2, 26.5], 1.6, 2))],
  ['arm*', any(ell([2.6, 2.6, 2.4], [6.2, 0, 19.5]), limb([6.2, 0, 19.5], [10.5, -0.6, 19.5], 2.2, 2.1), ell([2.2, 1.8, 1.6], [9, -0.4, 21]))],
  ['fore*', any(limb([10.5, -0.6, 19.5], [11, -1.2, 25], 2.1, 1.8), spike([12.2, -0.6, 20.5], [1.6, 0.4, -1.2], 0.9), spike([12.2, -0.6, 22.5], [1.6, 0.4, -1.2], 0.9))],
  ['hand*', ell([2.2, 2, 2.3], [11, -1.4, 26.5])],
  ['leg*', any(limb([3.6, 0, 11], [5, -0.5, 4], 2.8, 2.6), ell([3.6, 3.4, 4.2], [5, -0.5, 6.5]), blob([[[2.8, 3.6, 1.5], [5.2, -1.6, 1.5]], [[2.3, 2.2, 1.5], [5.2, 0.8, 1.7]]]),
    spike([5.2, -5, 1], [0, -1.4, -0.4], 1))],
  ['tail1', ell([2, 2, 2], [2, 3.5, 10])],
  ['tail2', any(ell([3.6, 3, 3.2], [7, 5.5, 9]), spike([7, 6, 6.2], [1.6, -0.4, -1.6], 1.3), limb([5, 3, 11.6], [9, 3, 12], 0.7))],
  ['tail3', any(ell([3.4, 2.6, 3.4], [11, 5, 11]), blob([[[2.6, 2.2, 2.8], [12.5, 4.5, 13]], [[1.2, 1, 2], [14, 3.8, 17.5]]]), spike([13, 4.6, 9.5], [1.6, -0.4, -1.6], 1.3))],
];

// the ponytail streams: a wave down its links, whole cycles per clip
const pony = (u, amp = 5, cycles = 1) => wave(ponies, u, { cycles, amp: [amp * 0.6, 0, amp], lag: 0.15, grow: 0.4 });

const base = bipedClips({
  face, tail: tails, hipH: 11, stride: 20, guard: true, hopScale: 0.8, hopH: 3.5,
  punch: { arm: [0, 0, 70], fore: [80, 0, 0] },
  cheer: { arm: [0, -22, 0], fore: [0, -12, 0] },
  add: {
    idle: (t, u) => pony(u, 4, 2),
    walk: (t, u) => pony(u, 9, 1),
    idle_look: (t, u) => pony(u, 6, 2),
    lunge: (t, u) => ({ ...pony(u, 10, 1), handR: { s: 1 } }),
    hurt: (t, u) => pony(u, 12, 2),
    faint: (t, u) => pony(u, 6, 1),
    celebrate: (t, u) => ({ ...pony(u, 12, 2), ...both('hand', { s: 1 + 0.12 * Math.abs(Math.sin(TAU * u)) }) }),
    enter: (t, u) => pony(u, 8, 1),
    exit: (t, u) => pony(u, 6, 1),
  },
});

const clips = {
  ...base,

  // fidget: a double-biceps pump, pump, hold, chin up, a smug squint
  idle_flex: {
    seconds: 2.4,
    pose: (t, u) => {
      const p = win(u, 0.08, 0.28, 0.05) + win(u, 0.32, 0.52, 0.05);
      const hold = K(u, [[0, 0], [0.55, 0], [0.62, 1], [0.86, 1], [0.95, 0]]);
      return merge({
        body: { r: [-4 * hold, 0, 0], s: [1 + 0.03 * (p + hold), 1, 1] },
        head: { r: [-10 * hold, 0, 6 * hold] },
        ...both('arm', { r: [0, -10 * p - 16 * hold, 0] }),
        ...both('fore', { r: [0, -6 * p - 6 * hold, 0] }),
        ...both('hand', { s: 1 + 0.15 * p + 0.1 * hold }),
        ...face.pose('open', 0.45 * hold),
      }, pony(u, 5, 2));
    },
  },
  // fidget: a flick of the head that tosses the ponytail over, one ear flopping
  idle_toss: {
    seconds: 1.8,
    pose: (t, u) => {
      const fl = K(u, [[0, 0], [0.18, -1], [0.32, 1], [0.55, 0]]);
      const swing = Math.sin(TAU * 2 * Math.max(0, u - 0.3)) * Math.max(0, 1 - (u - 0.3) / 0.6) * (u > 0.3 ? 1 : 0);
      return {
        head: { r: [-6 * Math.abs(fl), 0, 14 * fl] },
        pony1: { r: [12 * fl, 0, -20 * fl + 8 * swing] },
        pony2: { r: [8 * fl, 0, -14 * fl + 10 * swing] },
        pony3: { r: [6 * fl, 0, -10 * fl + 12 * swing] },
        earL: { r: [0, -20 * Math.max(0, fl) + 10 * swing, 0] },
        earR: { r: [0, 14 * Math.max(0, -fl), 0] },
        ...face.pose('open', blinks(u, [[0.6, 0.68]])),
        ...tails.reduce((o, n, i) => ({ ...o, [n]: { r: [0, 0, 5 * osc(u, 2, -0.1 * i)] } }), {}),
      };
    },
  },
};

export default rigDef({ joints, assign: (c) => pick(c, parts), extras: face.extras, clips });
