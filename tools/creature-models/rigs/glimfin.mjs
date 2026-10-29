// Glimfin's rig: a round anglerfish pup on little feet (the body is its head), side fins, a crest of three spikes, a
// forked tail and an angler stalk arching forward to a glowing lure. Numbers are scad/glimfin.scad's.
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, ell, limb, pair, petal, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { fishClips } from './lib/fish.mjs';
import { chainHit, isAny, near } from './lib/geo.mjs';

const CYAN = [0.3, 0.72, 0.85];
const YELLOW = [1, 0.84, 0.25];
const YELLOW_HI = [1, 0.96, 0.65];

const STALK = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]
  .map((t) => [-1 - 16 * t, -2 - 7 * t, 24.5 + 9 * Math.sin(t * Math.PI) - 2 * t]);
const STALK_R = STALK.map((_, i) => 0.8 - i * 0.03);
const lure = ['lure1', 'lure2', 'lure3'];
const LURE_AT = [STALK[0], STALK[4], STALK[7]];
const LURE = [-17.2, -9, 19.8];

const eyeL = { side: 'L', at: [4.4, -9.4, 16.5], size: 2.8, yaw: -25 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], parent: 'body', skin: CYAN });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [5, -3, 3]),
  { name: 'body', parent: 'root', at: [0, 0, 5] },
  ...pair('fin*', 'body', [10.5, 0.5, 13.5]),
  { name: 'dorsal1', parent: 'body', at: [0, 3, 22] },
  { name: 'tail1', parent: 'body', at: [0, 9, 9] },
  { name: 'tail2', parent: 'tail1', at: [0, 13.5, 7.6] },
  ...lure.map((name, i) => ({ name, parent: i === 0 ? 'body' : lure[i - 1], at: LURE_AT[i] })),
  ...face.joints,
];

const parts = [
  ['leg*', ell([2.6, 3.6, 1.6], [5, -3, 1.6])],
  ['body', ell([12, 11, 11], [0, 0, 13])],
  ['fin*', any(petal([6, 1.2, 3.4], [12.5, 0, 14], [0, -30, -15]), ell([2, 1.4, 1.8], [17, -0.8, 16.8]))],
  ['dorsal1', any(...[0, 1, 2].map((i) => petal([0.9, 3.4, 6 - i], [0, 1 + i * 4, 25 - i * 2.5], [-30 - i * 15, 0, 0])))],
  ['tail1', limb([0, 9, 9], [0, 13, 7], 2.5, 1.6)],
  ['tail2', any(petal([0.9, 4, 1.8], [0, 15 + 2 * Math.cos(0.7), 8 + 2 * Math.sin(0.7)], [40, 0, 0]),
    petal([0.9, 4, 1.8], [0, 15 + 2 * Math.cos(0.7), 8 - 2 * Math.sin(0.7)], [-40, 0, 0]))],
];

function assign(c, rgb) {
  if (near(rgb, YELLOW_HI) || (isAny(rgb, [YELLOW]) && c[0] < -12)) return 'lure3';
  const h = chainHit(c, STALK, STALK_R);
  if (h.d < 1.4 && c[2] > 23) return lure[h.i < 4 ? 0 : h.i < 7 ? 1 : 2];
  if (near(rgb, YELLOW) && Math.abs(c[0]) > 14) return c[0] > 0 ? 'finL' : 'finR';
  if (!isAny(rgb, [CYAN, [0.14, 0.3, 0.62], [0.08, 0.18, 0.42]])) return 'body';   // eyes, mouth, stars
  return pick(c, parts);
}

const clips = fishClips({
  face, tail: ['tail1', 'tail2'], dorsal: ['dorsal1'], lure, sweep: 12,
});

// fidget: spots something, the lure lights up bobbing, then it giggles (the whole body shakes, ^ ^)
clips.idle_giggle = {
  seconds: 1.8,
  pose: (t, u) => {
    const on = win(u, 0.1, 0.85, 0.08);
    const sh = osc(u, 12) * on;
    return merge({
      body: { r: [-4 * on, 3 * sh, 0], s: [1, 1, 1 + 0.03 * Math.abs(sh)] },
      ...face.pose(on > 0.4 ? 'happy' : 'open', blinks(u, [[0.9, 0.95]])),
      ...Object.fromEntries(['finL', 'finR'].map((n, i) => [n, { r: [0, (i ? 1 : -1) * 18 * on * (osc(u, 6) * 0.5 + 0.5), 0] }])),
      lure3: { r: [0, 0, 20 * osc(u, 4) * on], s: 1 + 0.2 * K(u, [[0, 0], [0.2, 1], [0.7, 1], [0.85, 0]]) },
    }, { tail1: { r: [0, 0, 14 * osc(u, 6) * on] } });
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
