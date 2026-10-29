// Coalette's rig: a chubby lump-of-coal lizard standing up on fat thighs, stubby arms held out, an ember core in its
// belly, flames along its head and spine and a thick tail curling up into a tall flame. Biped template (it stands
// upright), the tail a three-link chain. Numbers are scad/coalette.scad's.
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, pair, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { capD, isAny, near } from './lib/geo.mjs';

const FLAMES = [[0.9, 0.22, 0.05], [1, 0.55, 0.08], [1, 0.88, 0.35]];
const CLAW = [0.85, 0.7, 0.45];

const eyeL = { side: 'L', at: [3.3, -7.8, 24], size: 2.2, yaw: 6 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.24, 0.2, 0.23] });

const TAIL = [[2, 5.5, 6], [6, 10, 4.5], [11, 11, 6], [14, 8.5, 10], [15, 6, 15], [14.5, 5, 19]];
const TAIL_R = [3.8, 3.2, 2.7, 2.2, 1.8, 1.4];
const tail = ['tail1', 'tail2', 'tail3'];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [5, -0.5, 7]),
  { name: 'body', parent: 'root', at: [0, 0, 8] },
  { name: 'head', parent: 'body', at: [0, -1, 19] },
  ...pair('arm*', 'body', [6, -1.5, 16]),
  ...pair('hand*', 'arm*', [10, -5, 13]),
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[2] },
  { name: 'tail3', parent: 'tail2', at: TAIL[4] },
  ...face.joints,
];

const parts = [
  ['leg*', any(ell([3.6, 3.8, 3.8], [5, -0.5, 5]), blob([[[2.8, 4, 1.6], [5.3, -2.4, 1.6]], [[2.3, 2, 1.4], [5.3, 0.6, 1.5]]]))],
  ['body', any(ell([8.5, 7.5, 7.5], [0, 0.5, 9.5]), ell([6.8, 6, 6], [0, -0.5, 16.5]), ell([4.8, 2.2, 5], [0, -6.2, 11.5]))],
  ['head', any(ell([6.4, 5.8, 5.2], [0, -1.5, 23]), ell([4.6, 4.2, 3.4], [0, -6, 22]), ell([4, 3, 1.4], [0, -7, 24.2]), ell([3, 2.4, 2.4], [3.3, -8, 25]),
    ell([3, 2.4, 2.4], [-3.3, -8, 25]))],
  ['arm*', limb([6, -1.5, 16], [9.6, -4.5, 13.5], 2, 1.6)],
  ['hand*', ell([1.8, 1.7, 1.4], [10, -5, 13])],
  ...chain(['tail1', 'tail1', 'tail2', 'tail2', 'tail3'], TAIL, TAIL_R),
];
const tailNear = (c) => {
  let best = 'tail3'; let bd = Infinity;
  for (let i = 0; i < TAIL.length - 1; i++) { const d = capD(c, TAIL[i], TAIL[i + 1], 3); if (d < bd) { bd = d; best = ['tail1', 'tail1', 'tail2', 'tail2', 'tail3'][i]; } }
  return c[2] > 17 ? 'tail3' : best;
};

function assign(c, rgb) {
  if (isAny(rgb, FLAMES, 0.04)) {
    if (c[0] > 5 && c[1] > 2.5) return tailNear(c);
    return c[1] < 2 && c[2] > 24 ? 'head' : 'body';
  }
  if (near(rgb, CLAW, 0.04)) return c[2] > 8 ? `hand${c[0] >= 0 ? 'L' : 'R'}` : `leg${c[0] >= 0 ? 'L' : 'R'}`;
  return pick(c, parts);
}

const base = bipedClips({ face, tail, hipH: 7, stride: 18, armSwing: 18, hopH: 2 });

const clips = {
  ...base,

  // fidget: puffs itself up, the ember core and the flames flaring, then a contented sigh
  idle_flare: {
    seconds: 2.2,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.3, 1], [0.6, 1], [0.8, 0]]);
      const sigh = win(u, 0.7, 0.95, 0.06);
      return merge({
        body: { s: [1 + 0.06 * up, 1 + 0.06 * up, 1 + 0.03 * up], r: [-4 * up + 3 * sigh, 0, 0] },
        head: { r: [-8 * up + 6 * sigh, 0, 0] },
        ...{ armL: { r: [0, -30 * up, 0] }, armR: { r: [0, 30 * up, 0] } },
        ...face.pose(up > 0.5 ? 'happy' : sigh > 0.4 ? 'shut' : 'open'),
      }, Object.fromEntries(tail.map((n, i) => [n, { r: [6 * up, 0, 0], s: 1 + 0.06 * up * (i + 1) }])));
    },
  },

  // fidget: warms its stubby claws over its own tail flame, rubbing them together
  idle_warm: {
    seconds: 2.6,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.15, 1], [0.8, 1], [0.95, 0]]);
      const rub = osc(u, 8) * win(u, 0.18, 0.78, 0.05);
      return merge({
        body: { r: [0, 0, 18 * on] },
        head: { r: [6 * on, 0, 20 * on] },
        armL: { r: [-30 * on, 20 * on, 30 * on + 6 * rub] },
        armR: { r: [-30 * on, -40 * on, 30 * on - 6 * rub] },
        ...face.pose(on > 0.5 ? 'happy' : 'open'),
      }, Object.fromEntries(tail.map((n, i) => [n, { r: [0, 0, -10 * on * (1 + 0.3 * i)] }])));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
