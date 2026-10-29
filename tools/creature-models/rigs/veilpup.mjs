// Veilpup's rig: a navy wolf pup standing upright on two short legs (a biped, though it sits in the quadruped batch),
// arms held out with wisps at the claws, a wild white mane over a blindfolded head, one glowing eye, tall ears and a
// brush tail curling up to its left. Numbers are scad/veilpup.scad's (the pre-sprite-pass model: re-rig when its new
// model lands).
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, pair, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { chainHit, isAny, near } from './lib/geo.mjs';

const MASK = [0.08, 0.08, 0.12];
const MANE = [[0.92, 0.92, 0.98], [0.72, 0.72, 0.88]];
const RUFF = [0.33, 0.24, 0.48];
const GEM = [0.75, 0.1, 0.15];
const WISPS = [[0.9, 0.2, 0.3], [0.2, 0.75, 1]];
const TAIL = [[3, 5, 7], [9, 9, 6], [13, 11, 9], [15, 11, 17]];
const TAIL_R = [2.4, 3.2, 3.6, 3];
const tail = ['tail1', 'tail2', 'tail3'];

const face = eyeKit({ eyes: [{ side: 'L', at: [2.5, -7.7, 24.7], size: 1.9, yaw: 16 }], skin: MASK });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4.8, 0, 7]),
  { name: 'body', parent: 'root', at: [0, 0, 8] },
  { name: 'head', parent: 'body', at: [0, -1, 20] },
  ...pair('ear*', 'head', [5.2, 0, 29]),
  ...pair('arm*', 'body', [5.5, -1, 17]),
  ...pair('hand*', 'arm*', [10, -4, 13]),
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i] })),
  ...face.joints,
];

const parts = [
  ['leg*', any(ell([3.6, 3.8, 4.2], [4.8, 0, 5]), blob([[[2.8, 4, 1.6], [5, -2.4, 1.6]], [[2.4, 2, 1.4], [5, 0.6, 1.5]]]), ell([2.4, 1.6, 1], [5, -6.4, 1]))],
  ['body', any(blob([[[8, 6.5, 7], [0, 0, 9]], [[6.5, 5.5, 5.5], [0, -0.5, 15]]]), ell([5, 2.4, 5], [0, -5, 11]), ell([8.4, 7.6, 3.6], [0, 0, 18.5]),
    ell([6, 4, 4], [0, 6, 17]))],
  ['head', any(blob([[[6.5, 6, 5.8], [0, -0.5, 24]], [[4.5, 4.5, 4.2], [0, -4, 23]], [[3, 3, 2.3], [0, -8, 21.8]]]),
    blob([[[3, 3, 2.3], [0, -8, 21.6]], [[2.2, 2.4, 1.8], [0, -11, 21.6]]]), ell([7, 6, 5.5], [0, 2.5, 28]), ell([7.5, 5.5, 6], [0, 6, 22.5]))],
  ['ear*', any(ell([1.8, 0.9, 1], [5, 0, 29]), spike([5.4, 0, 29], [1.6, 0, 6], 0.9))],
  ['arm*', limb([5.5, -1, 17], [10, -4, 13], 2, 1.6)],
  ['hand*', any(ell([2, 1.8, 1.6], [10.6, -4.6, 12.6]), ell([1.8, 1.4, 1], [10.6, -6.4, 12.6]))],
];

function assign(c, rgb) {
  if (isAny(rgb, WISPS, 0.03) && Math.abs(c[0]) > 8.5) return `hand${c[0] >= 0 ? 'L' : 'R'}`;
  if (near(rgb, RUFF, 0.03) || near(rgb, GEM, 0.03)) return 'body';
  const t = chainHit(c, TAIL, TAIL_R);
  if (c[0] > 3.5 && c[1] > 4 && c[2] < 21 && t.d < 2.4) return tail[Math.min(2, t.i)];
  if (isAny(rgb, MANE, 0.03)) return c[2] < 19.5 ? 'body' : 'head';
  return pick(c, parts);
}

const base = bipedClips({ face, tail, hipH: 7, stride: 18, armSwing: 14 });

const clips = {
  ...base,

  // fidget: howls at the sky, the mane bristling, the tail stiff
  idle_howl: {
    seconds: 2.6,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.2, 1], [0.72, 1], [0.88, 0]]);
      const tr = osc(u, 16) * win(u, 0.22, 0.72, 0.05);
      return merge({
        body: { r: [-6 * up, 0, 0] },
        head: { r: [-28 * up + tr, 0, 0], s: 1 + 0.02 * up },
        ...face.pose(up > 0.5 ? 'shut' : 'open'),
        armL: { r: [0, 10 * up, 0] },
        armR: { r: [0, -10 * up, 0] },
        earL: { r: [-12 * up, 0, 0] },
        earR: { r: [-12 * up, 0, 0] },
      }, Object.fromEntries(tail.map((n, i) => [n, { r: [8 * up, 0, 3 * tr * (i + 1)] }])));
    },
  },

  // fidget: the wisps at its claws flare, it flexes them open and shut, grinning
  idle_wisps: {
    seconds: 2,
    pose: (t, u) => {
      const on = win(u, 0.1, 0.85, 0.08);
      const fl = Math.sin(TAU * 4 * u) * on;
      return merge({
        armL: { r: [-12 * on, -10 * on, 0] },
        armR: { r: [-12 * on, -10 * on, 0] },
        handL: { r: [0, 0, 18 * fl], s: 1 + 0.08 * on },
        handR: { r: [0, 0, -18 * fl], s: 1 + 0.08 * on },
        head: { r: [4 * on, 0, 6 * osc(u, 2) * on] },
        ...face.pose('open', blinks(u, [[0.88, 0.93]])),
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
