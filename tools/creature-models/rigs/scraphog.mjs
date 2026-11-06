// Scraphog's rig: a low stone-plated boar on four short splayed legs, tan spikes from the crown down the spine and
// violet crystals on its back, a big low head with a wide snout, two tusks a side and pricked ears. Numbers are
// scad/scraphog.scad's (the sprite-match model, 2026-11-06).
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, ell, limb, mx, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { chainHit, isAny } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const SKIN = [0.55, 0.37, 0.29];
const CRYSTAL = [[0.60, 0.38, 0.60], [0.85, 0.65, 0.88]];
const SPIKE = [0.82, 0.65, 0.50];
const TUSK = [0.88, 0.75, 0.60];
const TAIL = [[0, 24.5, 20], [0, 27, 20.6], [0.6, 28, 19.2]];
// [hip, knee, ankle] of the left legs (scad LEGS)
const LEGS = { F: [[8.5, -3, 12], [11.4, -9, 6.6], [12, -14, 2.6]], B: [[8.5, 18, 12], [12, 22, 6.8], [12.8, 23.8, 2.6]] };

const BC = [0, 8.5, 18.8];
const BR = [12, 14.6, 11];
const HC = [0, -15.5, 22];
const HR = [9, 8.6, 7.6];
const NECK = [[7.5, 7, 6.5], [0, -6, 20.5]];
const grow = (r, k) => r.map((v) => v * k);

const eyeL = { side: 'L', at: [5.4, -21.4, 22.8], size: 1.6, yaw: 38, flat: 0.42 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: SKIN });

const joints = [
  { name: 'root', at: [0, 8, 0] },
  ...Object.entries(LEGS).flatMap(([k, [hip]]) => [
    { name: `leg${k}L`, parent: 'root', at: hip },
    { name: `leg${k}R`, parent: 'root', at: [-hip[0], hip[1], hip[2]] },
  ]),
  { name: 'body', parent: 'root', at: [0, 8, 14] },
  { name: 'head', parent: 'body', at: [0, -7, 21] },
  { name: 'earL', parent: 'head', at: [5.6, -12.5, 28.4] },
  { name: 'earR', parent: 'head', at: [-5.6, -12.5, 28.4] },
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  ...face.joints,
];

const legT = ([hip, knee, ank]) => any(
  limb(hip, knee, 5, 4.3), limb(knee, ank, 4.1, 3.5), ell([4.4, 4.2, 3.4], knee.map((v, i) => v + [0.5, -0.6, 0.2][i])),
  ell([3.2, 3.4, 1.6], [ank[0], ank[1] - 0.6, ank[2] - 1.1]), ell([3.6, 3.2, 1.2], [ank[0], ank[1] - 3, ank[2] - 1.6]),
);
// the grey rubble under the shell's rim (scad mirror_x() list)
const RUBBLE = [[[2, 3.6, 3.2], [10.6, 15.5, 15.4]], [[1.8, 3.2, 3], [10.2, 19.8, 18]], [[1.8, 3, 2.8], [8.6, 23, 20.5]],
  [[1.8, 3.2, 2.8], [11.6, 10.5, 16.2]], [[1.8, 3, 2.6], [11, 3, 13.4]], [[1.6, 2.6, 2.4], [11.8, 6.8, 13.6]]];
const parts = [
  ...Object.entries(LEGS).map(([k, L]) => [`leg${k}*`, legT(L)]),
  ['body', any(ell(grow(BR, 1.14), BC), ell(grow(NECK[0], 1.16), NECK[1]), ...RUBBLE.map(([r, p]) => mx(ell(grow(r, 1.25), p))))],
  ['head', any(ell(grow(HR, 1.13), HC), ell([6.6, 3, 5], [0, -20.6, 19]), ell([5.2, 2.6, 3.8], [0, -23.6, 17.6]),
    ell([4.4, 1.6, 3.2], [0, -25.4, 17.4]), ell([5.2, 4.4, 2], [0, -21.5, 14]), mx(limb([6.8, -19.4, 26], [2.4, -22.4, 25], 1.9)))],
  ['ear*', limb([5.6, -12.5, 28.4], [8.6, -13, 33], 2.5, 0.4)],
];

function assign(c, rgb) {
  if (isAny(rgb, CRYSTAL, 0.03)) return 'body';
  if (isAny(rgb, [TUSK], 0.03)) return 'head';
  if (chainHit(c, TAIL, [1.1, 0.8, 0.3]).d < 1.3 && c[1] > 23.5) return 'tail1';
  // spine spikes: the crown one rides the head, the rest the back
  if (isAny(rgb, [SPIKE], 0.03)) return c[1] < -12.5 ? 'head' : 'body';
  return pick(c, parts);
}

const clips = {
  ...quadrupedClips({ face, tail: ['tail1'], hipH: 12, stride: 11 }),

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
