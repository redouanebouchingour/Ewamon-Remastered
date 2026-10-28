// Elemutt's rig: a cream puppy with its arms flung wide, floppy ears, a top-knot bun and a curled tail. The arms lie
// out sideways, so the punch swings the right one forward about z and the cheer lifts both into a V. Numbers are
// scad/elemutt.scad's.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny } from './lib/geo.mjs';

const FUR = [0.96, 0.82, 0.6];
const BUN = [[0.42, 0.38, 0.35], [0.5, 0.46, 0.42], [0.55, 0.32, 0.12]];
const TAIL = [[2, 3.4, 10], [4.5, 5.6, 9.5], [7, 6.5, 11], [8.4, 6, 14], [8, 5, 16.5]];
const tails = ['tail1', 'tail2', 'tail3', 'tail4'];

const eyeL = { side: 'L', at: [2.7, -5.2, 24.6], size: 1.5, yaw: -20 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FUR });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [3.2, 0, 10]),
  { name: 'body', parent: 'root', at: [0, 0, 10] },
  { name: 'head', parent: 'body', at: [0, -0.3, 19.5] },
  { name: 'bun', parent: 'head', at: [0, 0.5, 30.6] },
  ...pair('ear*', 'head', [5.2, -0.5, 28.5]),
  ...pair('arm*', 'body', [3.6, 0, 17]),
  ...pair('fore*', 'arm*', [8, -0.8, 18]),
  ...pair('hand*', 'fore*', [12.2, -1.6, 20]),
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[1] },
  { name: 'tail3', parent: 'tail2', at: TAIL[2] },
  { name: 'tail4', parent: 'tail3', at: TAIL[3] },
  ...face.joints,
];

const parts = [
  ['leg*', any(limb([3.2, 0, 10], [4, -0.5, 4], 2.4, 2.2), ell([3.2, 3.2, 3.6], [4, -0.5, 6.8]),
    blob([[[2.4, 3.2, 1.4], [4.2, -1.4, 1.4]], [[2, 2, 1.4], [4.2, 0.8, 1.6]]]))],
  ['body', any(blob([[[5, 4, 4.2], [0, 0, 12]], [[4, 3.4, 3.4], [0, 0, 16.5]]]), ell([3, 1.4, 3.2], [0, -3.2, 13.5]), limb([0, 3.4, 18.5], [0, 3.8, 10], 0.9))],
  ['head', any(blob([[[6.8, 6, 6], [0, 0, 25]], [[5.5, 5, 4.6], [0, -0.5, 22.5]]]), ell([3.2, 2.2, 2.2], [0, -5.4, 22.2]), limb([0, 4.8, 20.5], [0.4, 4, 19], 0.6))],
  ['ear*', any(limb([5.2, -0.5, 28.5], [7.4, -1.2, 23], 1.5, 2))],
  ['arm*', limb([3.6, 0, 17], [8, -0.8, 18], 1.6, 1.4)],
  ['fore*', limb([8, -0.8, 18], [11.6, -1.4, 19.6], 1.4, 1.2)],
  ['hand*', any(ell([1.6, 1.3, 1.5], [12.4, -1.6, 20]), ell([1.2, 1, 1.6], [13.6, -1.6, 20.4]))],
  ...chain(tails, TAIL, [1.4, 1.4, 1.3, 1.1, 0.6]),
];

function assign(c, rgb) {
  if (isAny(rgb, BUN) && c[2] > 29.5) return 'bun';
  return pick(c, parts);
}

const bunBob = (u, cycles, amp = 1) => ({ bun: { r: [3 * amp * osc(u, cycles, 0.3), 4 * amp * osc(u, cycles / 2, 0.1), 0] } });

const base = bipedClips({
  face, tail: tails, hipH: 10, stride: 22, armSwing: 18, hopH: 3,
  punch: { arm: [0, 0, 75], fore: [0, 0, 15] },
  cheer: { arm: [0, -45, 0], fore: [0, -20, 0] },
  add: {
    idle: (t, u) => merge(bunBob(u, 2), both('ear', { r: [0, 2 * osc(u, 2, 0.2), 0] })),
    walk: (t, u) => merge(bunBob(u, 2, 2), both('ear', { r: [0, 6 * osc(u, 2), 0] })),
    // the right arm draws back along the shoulder line instead of up
    windup: (t, u) => { const w = smooth(u / 0.8); return { armR: { r: [-40 * w, -10 * w, -30 * w] }, foreR: { r: [50 * w, 0, -20 * w] } }; },
    lunge: (t, u) => {
      const back = K(u, [[0, 0.6], [0.12, 1], [0.22, 0]]);
      return { armR: { r: [-40 * back, -10 * back, -30 * back] }, foreR: { r: [50 * back, 0, 0] }, armL: { r: [15 * back, 8, -20 * K(u, [[0.12, 0], [0.4, 1], [1, 0]])] } };
    },
    hurt: (t, u) => merge(bunBob(u, 3, 3), both('ear', { r: [0, -30 * K(u, [[0, 0], [0.18, 1], [1, 0.4]]), 0] })),
    faint: (t, u) => { const d = smooth((u - 0.18) / 0.55); return merge(both('arm', { r: [0, 55 * d, 0] }), both('fore', { r: [0, 20 * d, 0] }), both('ear', { r: [10 * d, -6 * d, 0] }), { bun: { r: [20 * d, 0, 0] } }); },
    celebrate: (t, u) => merge(bunBob(u, 4, 2), both('ear', { r: [0, -16 * Math.abs(Math.sin(TAU * u)), 0] })),
    exit: (t, u) => both('ear', { r: [0, -8 * win(u, 0, 0.85, 0.2), 0] }),
  },
});

const clips = {
  ...base,

  // fidget: a happy wag, the whole rear swinging with it, eyes ^ ^
  idle_wag: {
    seconds: 1.6,
    pose: (t, u) => {
      const on = win(u, 0.05, 0.9, 0.1);
      return {
        ...face.pose(on > 0.4 ? 'happy' : 'open'),
        body: { r: [0, 0, 4 * osc(u, 4) * on] },
        head: { r: [-6 * on, 5 * osc(u, 2) * on, 0] },
        ...Object.fromEntries(tails.map((n, i) => [n, { r: [0, 0, (16 + 6 * i) * osc(u, 4, -0.08 * i) * on] }])),
        ...both('arm', { r: [0, -10 * on + 4 * osc(u, 4), 0] }),
        ...bunBob(u, 4, 1.5),
      };
    },
  },

  // fidget: a wet-dog head shake, the ears flinging out and the bun wobbling, eyes shut
  idle_shake: {
    seconds: 1.4,
    pose: (t, u) => {
      const on = win(u, 0.1, 0.75, 0.06);
      const sh = osc(u, 7) * on;
      return {
        ...face.pose(on > 0.3 ? 'shut' : 'open', blinks(u, [[0.82, 0.9]])),
        head: { r: [0, 6 * sh, 22 * sh] },
        body: { r: [0, 0, -5 * sh] },
        earL: { r: [0, -40 * on + 18 * sh, 0] },
        earR: { r: [0, 40 * on + 18 * sh, 0] },
        bun: { r: [10 * sh, 12 * sh, 0] },
      };
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
