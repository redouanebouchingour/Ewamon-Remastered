// Scraphog's rig: a stone-plated boar on four stout legs, a ridge of spikes and violet crystals on its back, a big snout
// and curled tusks on the head. Numbers are scad/scraphog.scad's (the pre-sprite-pass model: re-rig when its new model
// lands).
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, ell, limb, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { chainHit, isAny } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const ROCK_DK = [0.46, 0.3, 0.2];
const CRYSTAL = [[0.62, 0.42, 0.78], [0.82, 0.68, 0.95]];
const TAIL = [[0, 12, 15], [0, 14, 15.5], [0.8, 15, 14]];
const LEGS = [['F', -6], ['B', 8]];

const eyeL = { side: 'L', at: [3.1, -15.2, 15.2], size: 1.75, yaw: 10, flat: 0.55 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: ROCK_DK });

const joints = [
  { name: 'root', at: [0, 1, 0] },
  ...LEGS.flatMap(([k, y]) => [{ name: `leg${k}L`, parent: 'root', at: [5.5, y, 11] }, { name: `leg${k}R`, parent: 'root', at: [-5.5, y, 11] }]),
  { name: 'body', parent: 'root', at: [0, 1, 12] },
  { name: 'head', parent: 'body', at: [0, -8, 13] },
  { name: 'earL', parent: 'head', at: [4.6, -9.5, 17] },
  { name: 'earR', parent: 'head', at: [-4.6, -9.5, 17] },
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  ...face.joints,
];

const legT = (y) => any(limb([5.5, y, 11], [6, y - 0.5, 2.5], 3, 2.6), ell([3.7, 3.7, 5.4], [5.8, y, 7]), ell([2.8, 3, 1.4], [6, y - 1, 1.4]),
  ell([2.4, 1.4, 1], [6, y - 3.6, 1]));
const parts = [
  ...LEGS.map(([k, y]) => [`leg${k}*`, legT(y)]),
  ['body', ell([9.8, 12.8, 9.3], [0, 1, 13])],
  ['head', any(ell([7.6, 6.8, 6.8], [0, -11, 13.5]), ell([5, 3, 4.2], [0, -14, 13]), ell([3.4, 2.4, 2.8], [0, -17.6, 11.6]),
    ell([3.6, 2.4, 1.4], [0, -15.6, 9.6]))],
  ['ear*', ell([2, 1.8, 3.2], [5, -9.5, 18.6])],
];

function assign(c, rgb) {
  if (isAny(rgb, CRYSTAL, 0.03)) return 'body';
  if (chainHit(c, TAIL, [1, 0.7, 0.3]).d < 1.3 && c[1] > 11.5) return 'tail1';
  // the back spikes stand along the spine above the plates
  if (c[2] > 19 && c[1] > -7) return 'body';
  // the tusks curl out of the jaw
  if (chainHit(c, [[2.4, -16.6, 9.8], [4.6, -18.6, 8.6], [6.8, -19.4, 10.4], [7.4, -18.6, 13.4], [6.8, -17.2, 15.4]].map((p) => (c[0] < 0 ? [-p[0], p[1], p[2]] : p)), [1.4, 1.3, 1, 0.6, 0.1]).d < 1.4) return 'head';
  return pick(c, parts);
}

const clips = {
  ...quadrupedClips({ face, tail: ['tail1'], hipH: 11, stride: 12 }),

  // fidget: two snorts that jolt the snout up, then it scrapes a front hoof, ready to charge
  idle_snort: {
    seconds: 2.4,
    pose: (t, u) => {
      const sn = Math.max(0, Math.sin(TAU * 2 * ((u - 0.08) / 0.34))) * win(u, 0.08, 0.42, 0.03);
      const sc = Math.max(0, Math.sin(TAU * 2 * ((u - 0.48) / 0.36))) * win(u, 0.48, 0.84, 0.03);
      const low = K(u, [[0.4, 0], [0.5, 1], [0.86, 1], [0.96, 0]]);
      return merge({
        body: { r: [4 * low, 0, 0] },
        head: { r: [-10 * sn + 10 * low, 0, 0], s: 1 + 0.03 * sn },
        legFL: { r: [26 * sc, 0, 0], p: [0, 0, 1 * sc] },
        ...face.pose(sn > 0.5 ? 'shut' : 'open', 0.4 * low),
        earL: { r: [-14 * low, 0, 0] },
        earR: { r: [-14 * low, 0, 0] },
        tail1: { r: [0, 0, 20 * osc(u, 8) * low] },
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
