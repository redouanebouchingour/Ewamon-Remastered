// Stellaria's rig: a slender star spirit in a navy gown, arms held out wide, the long night-sky hair falling down her
// back (one joint, the template's cape layer: it is a hull) and two cloth cape-sleeves hanging from the shoulders that
// flare like wings (the template's wing layer). Numbers are scad/stellaria.scad's.
import { K, TAU, both, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, chain, ell, limb, mx, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';

const eyeL = { side: 'L', at: [2.1, -4.6, 37], size: 1.75, yaw: -22, flat: 0.5 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.62, 0.86, 0.72] });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [2, 0, 15]),
  { name: 'body', parent: 'root', at: [0, 0, 15] },
  { name: 'head', parent: 'body', at: [0, -0.3, 31.5] },
  { name: 'cape1', parent: 'head', at: [0, 2.6, 36] },
  ...pair('wing*', 'body', [3, 0, 30]),
  ...pair('arm*', 'body', [3, -0.3, 29.5]),
  ...pair('fore*', 'arm*', [8.5, -1.4, 27.5]),
  ...pair('hand*', 'fore*', [13.5, -2, 27.2]),
  ...face.joints,
];

const D = Math.PI / 180;
const crown = [];
for (let a = -80; a <= 260; a += 32) crown.push(ell([1.8, 0.8, 1.8], [6 * Math.cos(a * D), 0.4, 39 + 4.8 * Math.sin(Math.min(170, Math.max(10, a)) * D) + 0.8]));

const parts = [
  // the hem petals: a ring of ellipsoids round [7, 5.6] at z 8.6
  ['body', any((c) => 1 + Math.hypot((Math.hypot(c[0] / 7, c[1] / 5.6) - 1) * 5.6 / 1.6, (c[2] - 8.6) / 1.4), limb([0, 0, 25], [0, 0, 9], 3.4, 6.5), ell([7.8, 6.4, 2], [0, 0, 9]), ell([3.4, 2.6, 3.4], [0, 0, 27]), limb([0, 0, 29], [0, -0.3, 31], 1.2),
    mx(ell([1.8, 0.8, 1], [1.6, -2.4, 30])), ell([1.6, 0.8, 1.6], [0, -2.9, 30]))],
  ['head', any(ell([5, 4.6, 5.6], [0, -0.6, 37]), ell([5.8, 5, 5], [0, 1.2, 39]), ell([0.9, 0.4, 0.3], [0, -5.1, 34]), ell([1.2, 0.6, 1.2], [0, -4.6, 41]),
    ell([2.2, 0.8, 2.2], [0, 0, 45.4]), ...crown)],
  ['cape1', any(limb([0, 2.6, 37], [0, 4.4, 17], 4.4, 3.4), ...chain(['c', 'c', 'c'], [[5, 0, 37], [6.6, 1.2, 31], [7.4, 2.2, 24], [6.6, 3, 17]], [2, 2, 1.6, 0.6]).map(([, t]) => mx(t)),
    ...chain(['c', 'c', 'c'], [[3.8, 2.4, 33], [8.6, 3, 26], [9.6, 3.6, 19], [8.4, 4.6, 14]], [1.6, 1.6, 1.2, 0.4]).map(([, t]) => mx(t)))],
  ['wing*', any(limb([3, 0, 30], [8, 1, 18], 1.2, 1.4), limb([8, 1, 18], [13, 1.5, 9], 1.4, 1.8), limb([8, 1, 18], [7, 2.5, 6], 1.4, 1.8),
    limb([13.6, 1.5, 7], [13.2, 1.5, 15], 1.4), ell([3, 0.9, 1.1], [10, 2.4, 6.6]))],
  ['arm*', limb([3, -0.3, 29.5], [8.5, -1.4, 27.5], 1.1, 0.9)],
  ['fore*', limb([8.5, -1.4, 27.5], [13.5, -2, 27.2], 0.9, 0.7)],
  ['hand*', any(ell([1.3, 0.6, 0.9], [14.6, -2, 27.2]), limb([15, -2, 27.2], [16.6, -2.2, 27.2], 0.5))],
  ['leg*', any(limb([2, 0, 15], [2.2, -0.5, 7], 1.5, 1.1), limb([2.2, -0.5, 7], [2.6, -1.4, 0.8], 1.1, 0.6))],
];

const assign = (c) => pick(c, parts);

const base = bipedClips({
  face, cape: ['cape1'], hipH: 15, stride: 10, hopScale: 0.4, droop: 0.6,
  wing: { open: [0, -18, 0], flap: 8 },
  // the arms are held out sideways: a cast swings the right hand round to the front
  punch: { arm: [0, 0, 70], fore: [0, 0, 10] },
  cheer: { arm: [0, -45, 0], fore: [0, -15, 0] },
});

const clips = {
  ...base,

  // fidget: a slow pirouette on her toes, sleeves flaring, eyes closed
  idle_twirl: {
    seconds: 2.8,
    pose: (t, u) => {
      const spin = 360 * K(u, [[0, 0], [0.15, 0], [0.75, 1], [1, 1]]);
      const on = win(u, 0.1, 0.85, 0.1);
      return {
        root: { r: [0, 0, spin] },
        body: { p: [0, 0, 0.3 * on] },
        head: { r: [-6 * on, 0, 0] },
        ...face.pose(on > 0.5 ? 'shut' : 'open'),
        ...both('wing', { r: [0, -28 * on, 0] }),
        ...both('arm', { r: [0, -12 * on, 0] }),
        cape1: { r: [10 * on, 0, -8 * on] },
      };
    },
  },

  // fidget: she traces a star in the air with her right hand, then blinks up at it
  idle_trace: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.12, 1], [0.8, 1], [0.95, 0]]);
      const a = TAU * 2 * Math.min(1, Math.max(0, (u - 0.15) / 0.55));
      return {
        head: { r: [-10 * on, 0, -12 * on] },
        ...face.pose('open', blinks(u, [[0.82, 0.88]])),
        armR: { r: [-20 * on, 0, 40 * on] },
        foreR: { r: [10 * Math.sin(a) * on, 0, 18 * Math.cos(a) * on] },
        handR: { r: [0, 20 * on, 0] },
        armL: { r: [0, 4 * osc(u, 1), 0] },
      };
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
