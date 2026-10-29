// Mudbub's rig: a round, squat mud toad, body and head one lump (the body joint carries the face), little arms resting on
// its belly, big haunches with flat feet and a stubby paddle tail. Biped template with the hopping walk: a toad sitting
// up hops on its haunches rather than trotting. Numbers are scad/mudbub.scad's.
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, chain, ell, limb, pair, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';

const eyeL = { side: 'L', at: [5.3, -6.6, 26.4], size: 2.5, yaw: -15, flat: 0.6 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], parent: 'body', skin: [0.62, 0.43, 0.28] });

const TAIL = [[3, 9, 5], [8, 14, 5], [12, 16, 8]];
const tail = ['tail1', 'tail2'];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [9, 1, 7]),
  { name: 'body', parent: 'root', at: [0, 0, 6] },
  ...pair('arm*', 'body', [9.5, -3, 16]),
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[1] },
  ...face.joints,
];

const parts = [
  ['leg*', any(ell([5, 6.5, 5], [9, 1, 6]), ell([3, 4, 1.2], [8, -4, 1.2]), limb([8, -5, 1], [8, -8.5, 0.8], 2.6))],
  ['body', any(ell([12, 10.5, 9], [0, 1, 10]), ell([10.5, 9, 7], [0, -0.5, 18]), ell([9.5, 8, 4], [0, -1, 23]),
    ell([7.5, 4, 8], [0, -6.4, 10.5]), ell([8.6, 3.4, 2.8], [0, -6.4, 18.6]), ell([3.4, 3.2, 3.2], [5, -4, 26]), ell([3.4, 3.2, 3.2], [-5, -4, 26]))],
  ['arm*', any(limb([9.5, -3, 16], [8, -7.5, 10.5], 2, 1.6), limb([8, -7.8, 10.2], [8, -9.6, 9.6], 1.6))],
  ...chain(['tail1', 'tail2'], TAIL, [3.5, 3.4, 2.8]),
  ['tail2', ell([2.4, 3, 1.8], [10, 15, 8.4])],
];

const assign = (c) => pick(c, parts);

const base = bipedClips({
  face, tail, hipH: 6, hop: true, hopH: 3, armSwing: 8, lift: 30,
  punch: { arm: [-70, 0, 0] }, cheer: { arm: [-40, -70, 0] },
});

const clips = {
  ...base,

  // fidget: the throat bulges in a croak, the whole lump swelling, twice
  idle_croak: {
    seconds: 2.2,
    pose: (t, u) => {
      const sw = (u0) => K(u, [[u0, 0], [u0 + 0.14, 1], [u0 + 0.24, 1], [u0 + 0.32, 0]]);
      const s = sw(0.1) + sw(0.52);
      return merge({
        body: { s: [1 + 0.06 * s, 1 + 0.08 * s, 1 - 0.03 * s], r: [-3 * s, 0, 0] },
        ...face.pose(s > 0.5 ? 'happy' : 'open'),
      }, Object.fromEntries(tail.map((n, i) => [n, { r: [0, 0, 6 * (1 + 0.3 * i) * osc(u, 2)] }])));
    },
  },

  // fidget: wriggles itself deeper into the mud, then blinks contentedly
  idle_wriggle: {
    seconds: 1.8,
    pose: (t, u) => {
      const on = win(u, 0.08, 0.7, 0.08);
      return {
        body: { r: [0, 5 * osc(u, 6) * on, 4 * osc(u, 6, 0.25) * on], p: [0, 0, -0.4 * on] },
        ...face.pose(u > 0.75 && u < 0.85 ? 'shut' : 'open'),
        tail1: { r: [0, 0, 14 * osc(u, 6) * on] },
        tail2: { r: [0, 0, 18 * osc(u, 6, 0.1) * on] },
      };
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
