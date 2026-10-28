// Dustcub's rig: a chubby badger cub playing cowboy, fists up for a scrap. The hat, the wheat stalk and the bandana's
// knot are their own joints. Numbers are scad/dustcub.scad's.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near } from './lib/geo.mjs';

const BAND = [0.18, 0.13, 0.1];
const HAT = [[0.4, 0.28, 0.18], [0.3, 0.2, 0.13], [0.15, 0.12, 0.1]];
const BANDANA = [0.8, 0.16, 0.12];
const WHEAT = [0.9, 0.78, 0.4];

const eyeL = { side: 'L', at: [2.5, -5.4, 26.6], size: 1, yaw: -18 };
export const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: BAND });

export const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4.1, 0.5, 9.8]),
  { name: 'body', parent: 'root', at: [0, 0, 11] },
  { name: 'head', parent: 'body', at: [0, -0.5, 22.4] },
  { name: 'hat', parent: 'head', at: [0, 0.5, 29] },
  { name: 'wheat', parent: 'head', at: [-1.2, -7.8, 23.6] },
  ...pair('ear*', 'head', [4.6, 0, 29]),
  { name: 'knot', parent: 'body', at: [5, 1, 21.8] },
  ...pair('arm*', 'body', [6, -0.5, 18.5]),
  ...pair('fore*', 'arm*', [8.5, -2.5, 16]),
  { name: 'handL', parent: 'foreL', at: [9.5, -4.8, 21.5] },
  { name: 'handR', parent: 'foreR', at: [-8.2, -5.4, 22.6] },
  { name: 'tail1', parent: 'body', at: [0, 5.5, 9] },
  ...face.joints,
];

const parts = [
  ['leg*', any(blob([[[2.6, 3.8, 1.6], [4.5, -1.2, 1.6]], [[2.4, 2.4, 3], [4.5, 0.5, 4]]]), ell([2.6, 2.6, 0.8], [4.5, 0.5, 6.7]),
    limb([4.5, 0.5, 7], [4, 0.5, 10], 2.6, 3), ell([0.6, 1, 1], [4.5, 3, 2.4]))],
  ['tail1', limb([0, 5.5, 9], [0, 8, 8], 1.8, 1.2)],
  ['body', any(ell([7.2, 6.2, 8], [0, 0, 15]), ell([4.8, 2, 6], [0, -4.6, 14.5]), ell([7.15, 6.7, 1], [0, 0, 11.6]),
    blob([[[1.4, 1.2, 2.4], [-7.2, -1, 9.5]], [[1, 1, 1], [-7, -1, 12]]]), ell([1, 3, 3], [7.7, 0.5, 9.5]), ell([5.4, 5, 0.8], [0, -0.5, 21.6]))],
  ['head', any(ell([6.4, 5.8, 5.6], [0, -0.5, 26]), ell([4, 2.4, 3], [0, -4.2, 25.5]),
    blob([[[2.4, 2.4, 1.8], [0, -6.8, 24.5]], [[1.5, 1.5, 1.2], [0, -8.4, 24.8]]]), ell([1.6, 3, 3.4], [0, -4, 29.2]))],
  ['ear*', ell([1.6, 1, 1.6], [4.6, 0, 30])],
  ['arm*', limb([6, -0.5, 18.5], [8.5, -2.5, 16], 2.4, 2.2)],
  ['foreL', limb([8.5, -2.5, 16], [9.5, -4.5, 20.5], 2.2, 2.2)],
  ['foreR', limb([-8.5, -2.5, 16], [-8, -5, 21], 2.2, 2.2)],
  ['handL', ell([2.3, 2, 2.3], [9.5, -4.8, 21.5])],
  ['handR', any(ell([2.6, 2, 2.6], [-8.2, -5.4, 22.6]), ell([1.4, 0.4, 1.4], [-8.2, -7.4, 22.6]))],
];

function assign(c, rgb) {
  if (isAny(rgb, HAT, 0.025) && c[2] > 28) return 'hat';
  if (near(rgb, WHEAT)) return 'wheat';
  if (near(rgb, BANDANA) && c[0] > 4 && c[1] > -0.5) return 'knot';
  if (near(rgb, BANDANA)) return 'body';
  return pick(c, parts);
}

// the hat bounces on the head and the knot's tails flutter
const hatBob = (amp, cycles, u) => ({ hat: { r: [amp * osc(u, cycles, 0.2), 0, 0.6 * amp * osc(u, cycles / 2, 0.4)] } });
const knot = (amp, cycles, u) => ({ knot: { r: [0, 6 * amp * osc(u, cycles), 8 * amp * osc(u, cycles, 0.25)] } });
const chew = (u, cycles, amp = 1) => ({ wheat: { r: [0, 4 * amp * osc(u, cycles), 6 * amp * osc(u, cycles, 0.3)] } });

const base = bipedClips({
  face, tail: ['tail1'], hipH: 10, stride: 20, guard: true, hopH: 3,
  punch: { arm: [-45, 0, 0], fore: [53, 0, 0] },
  add: {
    idle: (t, u) => merge(hatBob(1, 2, u), knot(0.5, 4, u), chew(u, 4)),
    walk: (t, u) => merge(hatBob(3, 2, u), knot(1.4, 2, u), chew(u, 2, 0.6)),
    idle_look: (t, u) => merge(knot(0.6, 3, u), chew(u, 3)),
    lunge: (t, u) => merge(knot(1.5, 1, u), { hat: { r: [-6 * win(u, 0.3, 0.8, 0.1), 0, 0] } }),
    hurt: (t, u) => { const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.3]]); return merge(knot(1.6, 2, u), { hat: { p: [0, 0, 1.6 * k], r: [-18 * k, 0, 10 * k] }, wheat: { r: [0, 0, 20 * k] } }); },
    recoil: (t, u) => ({ hat: { r: [-8 * K(u, [[0, 0], [0.4, 1], [1, 0]]), 0, 0] } }),
    faint: (t, u) => { const d = smooth((u - 0.18) / 0.55); return { hat: { r: [22 * d, 0, -8 * d], p: [0, -0.6 * d, -0.6 * d] }, wheat: { r: [-25 * d, 0, 0] } }; },
    celebrate: (t, u) => merge(hatBob(6, 2, u), knot(1.5, 2, u)),
    enter: (t, u) => ({ hat: { r: [-10 * win(u, 0.45, 0.9, 0.12), 0, 0] } }),
  },
});

const clips = {
  ...base,

  // fidget: tips the hat with the left paw and winks at the camera
  idle_hattip: {
    seconds: 2.4,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.2, 1], [0.7, 1], [0.88, 0]]);
      const tip = win(u, 0.28, 0.62, 0.08);
      const wink = win(u, 0.36, 0.56, 0.05);
      return {
        ...face.pose('open'),
        lidL: { s: wink < 0.02 ? 1e-4 : [1, 1, wink] },
        head: { r: [5 * tip, 0, 14 * up] },
        armL: { r: [-30 * up, -20 * up, 0] },
        foreL: { r: [40 * up, 0, 0] },
        hat: { r: [14 * tip, 0, 0] },
        ...chew(u, 3, 0.8),
      };
    },
  },

  // fidget: chews the wheat stalk, swings it out to the front with a twitch of the muzzle and back
  idle_chew: {
    seconds: 2,
    pose: (t, u) => {
      const flip = K(u, [[0, 0], [0.3, 0], [0.42, 1], [0.7, 1], [0.84, 0]]);
      return merge({
        ...face.pose('open', blinks(u, [[0.12, 0.17]])),
        head: { r: [2 * osc(u, 4), 0, -4 * flip] },
        wheat: { r: [0, 0, 35 * flip] },
      }, chew(u, 6, 1.2));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
