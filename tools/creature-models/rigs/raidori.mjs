// Raidori's rig: a thunder beast on four thick legs, a lightning mane round the head, sabre fangs and a tail arcing to
// a yellow star. Numbers are scad/raidori.scad's (the pre-sprite-pass model: re-rig when its new model lands).
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, blob, ell, limb, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { chainHit, isAny, near } from './lib/geo.mjs';
import { legs, quadrupedClips } from './lib/quadruped.mjs';

const BODY = [0.33, 0.34, 0.45];
const MANE = [[0.98, 0.8, 0.12], [0.85, 0.6, 0.05]];
const PAW = [0.95, 0.95, 0.97];
const STAR = [1, 0.86, 0.3];

export const TAIL = [[0, 13, 18], [1, 16, 24], [4, 18, 28.5], [8, 19, 30], [12, 18.5, 28], [13.5, 18, 24], [13.5, 18, 21]];
const TAIL_R = [1.5, 1.3, 1.2, 1.1, 1.0, 0.9, 0.8];
export const tail = ['tail1', 'tail2', 'tail3', 'tail4'];
const LEGS = [['F', -8, true], ['B', 8, false]];

const eyeL = { side: 'L', at: [2.4, -18.45, 29], size: 1.55, yaw: 20, flat: 0.5 };
export const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: BODY });

export const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...LEGS.flatMap(([k, y]) => [{ name: `leg${k}L`, parent: 'root', at: [4.6, y, 14] }, { name: `leg${k}R`, parent: 'root', at: [-4.6, y, 14] }]),
  { name: 'body', parent: 'root', at: [0, 0, 15] },
  { name: 'head', parent: 'body', at: [0, -11, 24] },
  { name: 'earL', parent: 'head', at: [2.8, -13.5, 31.5] },
  { name: 'earR', parent: 'head', at: [-2.8, -13.5, 31.5] },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[[0, 1, 3, 5][i]] })),
  ...face.joints,
];

const leg = (y, front) => any(
  limb([4.6, y, 14], [4.83, y + (front ? -1 : 1), 6], front ? 3.2 : 3.6, 2.4),
  limb([4.83, y + (front ? -1 : 1), 6], [4.83, y + (front ? -1.5 : 0.5), 1.6], 2.4, 2.2),
  ell([2.6, 3.2, 1.6], [4.83, y + (front ? -2.5 : -0.5), 1.4]),
  ell([2.2, 1.6, 1], [4.83, y + (front ? -5 : -3), 1]));
export const parts = [
  ...LEGS.map(([k, y, front]) => [`leg${k}*`, leg(y, front)]),
  ['body', any(blob([[[7, 8, 6.5], [0, -5, 17]], [[6.5, 7, 6], [0, 6, 16]]]), ell([5, 5, 5], [0, -9, 22]),
    spike([0, 4, 21], [0, 1, 6], 1.6), spike([0, 9.5, 21], [0, 3.3, 6], 1.6), ell([4.2, 1.6, 4], [0, -11.6, 15.5]))],
  ['head', any(ell([4.6, 4.6, 4.4], [0, -13, 26]), ell([4.6, 5, 4.2], [0, -15, 28]), ell([7, 4, 7], [0, -10.5, 25.5]),
    blob([[[3.4, 3, 2.4], [0, -19.5, 26]], [[2.6, 2, 1.8], [0, -21.5, 25.5]]]))],
  ['ear*', spike([2.8, -13.5, 31.5], [1.4, 1, 4], 1.4)],
];

function assign(c, rgb) {
  if (near(rgb, STAR, 0.03)) return 'tail4';
  if (near(rgb, PAW)) return pick(c, parts.slice(0, 2));
  if (isAny(rgb, MANE, 0.03)) return c[1] > -8 && Math.abs(c[0]) < 3 ? 'body' : 'head';
  const t = chainHit(c, TAIL, TAIL_R);
  if (t.d < 1.15 && c[1] > 12.5) return tail[[0, 1, 1, 2, 2, 3][t.i]];
  return pick(c, parts);
}

// the mane crackles: the head gives a little static shiver now and then
const crackle = (u, beats, amp) => ({ head: { s: 1 + amp * Math.max(0, Math.sin(TAU * beats * u)) ** 8 } });

export const clips = {
  ...quadrupedClips({
    face, tail, hipH: 14, stride: 14,
    add: { idle: (t, u) => crackle(u, 2, 0.02), celebrate: (t, u) => crackle(u, 4, 0.04), hurt: (t, u) => crackle(u, 5, 0.05) },
  }),

  // fidget: plants its feet, bares its fangs and lets out a crackling roar, the tail star raised
  idle_roar: {
    seconds: 2.2,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.18, 1], [0.7, 1], [0.86, 0]]);
      const tr = osc(u, 14) * win(u, 0.2, 0.7, 0.05);
      return merge({
        body: { r: [-5 * up, 0, 0] },
        head: { r: [-16 * up + 2 * tr, 0, 0], s: 1 + 0.03 * up },
        ...legs({ r: [-6 * up, 0, 0] }, { r: [4 * up, 0, 0] }),
        ...face.pose('open', 0.4 * up),
        earL: { r: [-18 * up, 0, 0] },
        earR: { r: [-18 * up, 0, 0] },
      }, Object.fromEntries(tail.map((n, i) => [n, { r: [10 * up * (i === 0 ? 1 : 0.3), 0, 4 * tr] }])));
    },
  },

  // fidget: paws the ground twice with a front foot, like a bull about to charge
  idle_paw: {
    seconds: 2,
    pose: (t, u) => {
      const sc = Math.max(0, Math.sin(TAU * 2 * ((u - 0.15) / 0.6))) * win(u, 0.15, 0.75, 0.04);
      return merge({
        body: { r: [3 * win(u, 0.1, 0.8, 0.1), 0, 0] },
        head: { r: [10 * win(u, 0.1, 0.8, 0.1), 0, 0] },
        legFL: { r: [30 * sc - 10 * sc * sc, 0, 0], p: [0, 0, 1.2 * sc] },
        ...face.pose('open', blinks(u, [[0.82, 0.87]])),
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
