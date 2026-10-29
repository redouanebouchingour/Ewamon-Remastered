// Elemutt's rig: a cream puppy with its arms flung wide (the left one raised), floppy ears, a top-knot bun, rocky
// knees and a short tail out to its left. The head is turned 14 degrees towards the camera in the scad, so the head's
// parts are tested in that frame (headF). The arms lie out sideways, so the punch swings the right one forward about z
// and the cheer lifts both into a V. Numbers are scad/elemutt.scad's.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, chain, ell, inFrame, limb, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, subFrame } from './lib/geo.mjs';

const FUR = [0.94, 0.8, 0.62];
const BUN = [[0.47, 0.42, 0.39], [0.6, 0.54, 0.5], [0.36, 0.23, 0.19]];
const TAIL = [[3.5, 3.6, 8.8], [7.5, 4.2, 8.6], [11, 3.8, 10], [13.6, 3.2, 12.8]];
const tails = ['tail1', 'tail2', 'tail3'];
const headF = subFrame([0.3, -1.2, 26], [0, 0, 14]);
// the arms: [shoulder, elbow, wrist, paw] per side (the left one raised)
const ARM = {
  L: [[4.2, -0.4, 17], [9.5, -0.8, 16.9], [14.5, -1.1, 18.2], [15, -1.2, 18.5]],
  R: [[-4.2, -0.4, 16.4], [-9, -0.8, 14.8], [-13.2, -1.1, 14.6], [-13.6, -1.2, 14.8]],
};
// the legs: knee x, foot x per side
const LEG = { L: [6.8, 8.8], R: [-6.2, -7.8] };

const eyeL = { side: 'L', at: [3.6, -5.75, -1.5], size: 2, yaw: 2, frame: headF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FUR });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [3.4, 0, 12] },
  { name: 'legR', parent: 'root', at: [-3.4, 0, 12] },
  { name: 'body', parent: 'root', at: [0, 0, 12] },
  { name: 'head', parent: 'body', at: [0.3, -0.6, 20] },
  { name: 'bun', parent: 'head', at: [1.6, 0.4, 32.9] },
  { name: 'earL', parent: 'head', at: headF.world([5.8, 0, 5]) },
  { name: 'earR', parent: 'head', at: headF.world([-5.8, 0, 5]) },
  ...['L', 'R'].flatMap((S) => [
    { name: `arm${S}`, parent: 'body', at: ARM[S][0] },
    { name: `fore${S}`, parent: `arm${S}`, at: ARM[S][1] },
    { name: `hand${S}`, parent: `fore${S}`, at: ARM[S][2] },
  ]),
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[1] },
  { name: 'tail3', parent: 'tail2', at: TAIL[2] },
  ...face.joints,
];

const leg = (S) => {
  const s = S === 'L' ? 1 : -1;
  const [kx, fx] = LEG[S];
  return any(limb([3.4 * s, 0, 12], [kx, -0.3, 7.6], 3, 2.6), ell([3.2, 3, 3.5], [kx, -0.6, 7.4]), ell([2.6, 2.4, 2.6], [kx + 2 * s, -1.4, 7.4]),
    limb([kx + 0.2 * s, -0.6, 5.5], [fx, -1, 2.6], 2.3, 2), ell([2.7, 2.7, 1.3], [fx + 0.4 * s, -1.3, 1.3]), ell([2.4, 2.4, 1.2], [fx + 2.2 * s, -2.6, 0.8]));
};
const parts = [
  ['legL', leg('L')], ['legR', leg('R')],
  ['body', any(limb([0, 0, 11], [0, 0, 16.5], 5.8, 4.1), ell([6, 5.4, 5.5], [0, 0, 11]), limb([2.6, -4.8, 16.3], [2.6, -5.3, 14.4], 1),
    limb([-0.8, 3, 19.6], [0.5, 5.4, 12.8], 0.9))],
  ['head', inFrame(headF, any(ell([7.8, 7, 7.2]), ell([6.8, 6.6, 5.5], [0, -0.8, -2.5]), ell([2.6, 1.8, 1.7], [-0.5, -5.6, -3.6]),
    ell([2.2, 1.6, 1.4], [3.6, -5.75, -1.5]), ell([2.2, 1.6, 1.4], [-3.6, -5.75, -1.5]), ell([0.8, 0.5, 0.55], [-0.6, -7.3, -3.9]),
    limb([-2.4, -6.6, -5.7], [0.8, -6.6, -5.7], 0.4)))],
  // the ears are mirrored inside the turned head, so each side is tested in the head's frame
  ...[['earL', 1], ['earR', -1]].map(([n, s]) => [n, inFrame(headF, any(limb([5.8 * s, 0, 5], [9 * s, 0.3, 1.8], 1.5, 2.6), ell([1.6, 1.7, 2], [9.3 * s, 0, 0.2])))]),
  ...['L', 'R'].flatMap((S) => [
    [`arm${S}`, limb(ARM[S][0], ARM[S][1], 2, 1.8)],
    [`fore${S}`, any(limb(ARM[S][1], ARM[S][2], 1.8, 1.7), limb(ARM[S][1].map((v, i) => v + [0, 2, 0.8][i]), ARM[S][2].map((v, i) => v + [0, 2.3, 1.2][i]), 0.6))],
    [`hand${S}`, any(ell([2, 1.5, 2.4], ARM[S][3]), ell([1.2, 1.2, 2.4], ARM[S][3].map((v, i) => v + [S === 'L' ? 1.9 : -1.9, 0, 0.2][i])))],
  ]),
  ...chain(tails, TAIL, [1.8, 1.8, 1.5, 0.7]),
];

function assign(c, rgb) {
  if (isAny(rgb, BUN) && c[2] > 31.8) return 'bun';
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
