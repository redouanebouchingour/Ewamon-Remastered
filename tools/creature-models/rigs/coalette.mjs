// Coalette's rig: a baby coal kaiju crouched on big haunches, hunched forward, the far arm reaching out with open
// claws and the near one hanging, an ember core on its belly, a ridge of soft flames from its brow down its back and
// tail, and a thick plated tail curling up into a tall flame plume. Biped template (it stands on its hind feet), the
// tail a three-link chain rising in an S, the plume and the flames on its upper half riding the last links. Numbers are scad/coalette.scad's.
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb } from './lib/biped.mjs';
import { eyeKit } from './lib/face.mjs';
import { capD, isAny, near } from './lib/geo.mjs';

const COAL_DK = [0.22, 0.15, 0.19];
const FLAMES = [[0.8, 0.23, 0.05], [0.93, 0.5, 0.06], [0.98, 0.76, 0.24], [0.96, 0.59, 0.12], [0.57, 0.17, 0.1]];
const CLAW = [0.7, 0.53, 0.4];

// the scad's S(): a point read off the front sheet at depth y
const S = (sx, sz, y) => [(sx - 0.5 * y) / 0.866, y, sz - 0.17 * y];

const H = [-2, -9.5, 20.6];
const add = (a, b) => a.map((v, i) => v + b[i]);
const eyeL = { side: 'L', at: add(H, [4, -4.2, -0.1]), size: 1.35, yaw: 30 };
const eyeR = { side: 'R', at: add(H, [-4, -4.2, -0.1]), size: 1.35, yaw: -30 };
const face = eyeKit({ eyes: [eyeL, eyeR], skin: COAL_DK });

const TAIL = [[3, 7, 7], [7.5, 10, 7], [11.5, 10.5, 10], [13, 9, 15], [12.5, 7.5, 20], [11.5, 6.5, 24], [11, 6, 26.5]];
const TAIL_R = [4, 3.6, 3.3, 3.0, 2.7, 2.3, 1.9].map((r) => r * 1.03);
const TAIL_J = ['tail1', 'tail1', 'tail2', 'tail2', 'tail3', 'tail3'];
const tail = ['tail1', 'tail2', 'tail3'];

// the ridge flames: base, height and the joint each rides
const RIDGE = [
  [S(-9.4, 21.5, -13), 10, 'head'], [S(-6.2, 24, -9), 9, 'head'], [S(-1.6, 22.5, -4.5), 7, 'body'],
  [S(3.2, 19.5, 2.5), 8, 'body'], [S(6.5, 16, 6), 5.5, 'body'], [[11.5, 10.5, 12.3], 6, 'tail2'], [[15.3, 9, 15.5], 7, 'tail2'],
  [[14.6, 7.5, 20.5], 8, 'tail3'], [[10.6, 7.5, 20.5], 7, 'tail3'], [[12.8, 6.5, 24.5], 9, 'tail3'], [[9.2, 6.5, 24.5], 8, 'tail3'],
  [add(TAIL[6], [0, 0, -1]), 15, 'tail3'],
];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [8.6, 2.5, 8.5] },
  { name: 'legR', parent: 'root', at: [-8.6, 2.5, 8.5] },
  { name: 'body', parent: 'root', at: [0, 0, 8] },
  { name: 'head', parent: 'body', at: [-2, -7, 19] },
  { name: 'armL', parent: 'body', at: [6, -3.5, 14] },
  { name: 'foreL', parent: 'armL', at: [7.6, -6.5, 10] },
  { name: 'handL', parent: 'foreL', at: [6.3, -9, 6.4] },
  { name: 'armR', parent: 'body', at: [-5.6, -3.5, 14] },
  { name: 'foreR', parent: 'armR', at: [-10.5, -6, 10.5] },
  { name: 'handR', parent: 'foreR', at: [-14.6, -7.8, 8.2] },
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[2] },
  { name: 'tail3', parent: 'tail2', at: TAIL[4] },
  ...face.joints,
];

const torso = [[[8, 7.5, 6.6], [-1, -0.5, 8]], [[6.6, 6, 6.2], [0, 0.5, 14.5]], [[4.6, 4.4, 4.4], [-1.6, -5, 17.5]]];
const head = [[[4.6, 4.6, 4.8], add(H, [0, 0.8, 0.6])], [[4.6, 3.4, 3.6], add(H, [0, -3, -0.8])], [[3.4, 3.2, 2.6], add(H, [0, -5.6, -1.6])]];

// both sides spelled out: the arms are posed differently (pick() folds '*' names, so these use plain names)
const parts = [
  ['body', blob(torso)],
  ['head', any(blob(head), ell([3.0, 3.0, 1.3], add(H, [0, -3.6, -3.7])), ell([2.4, 2.4, 2.4], eyeL.at), ell([2.4, 2.4, 2.4], eyeR.at))],
  ['legL', any(ell([4.4, 5, 4.6], [8.6, 2.5, 8.5]), limb([8.2, 0, 5.5], [6.3, -6, 2], 2.9, 2.3), blob([[[2.6, 3.4, 1.7], [6.2, -8, 1.7]], [[2.2, 2, 1.5], [6.2, -5.5, 1.6]]]))],
  ['legR', any(ell([4.4, 5, 4.6], [-8.6, 2.5, 8.5]), limb([-8.2, 0, 5.5], [-6.3, -6, 2], 2.9, 2.3), blob([[[2.6, 3.4, 1.7], [-6.2, -8, 1.7]], [[2.2, 2, 1.5], [-6.2, -5.5, 1.6]]]))],
  ['armL', limb([6, -3.5, 14], [7.6, -6.5, 10], 2.4, 2.1)],
  ['foreL', limb([7.6, -6.5, 10], [6.4, -8.6, 7], 2.1, 1.8)],
  ['handL', ell([1.9, 1.9, 1.6], [6.3, -9, 6.4])],
  ['armR', limb([-5.6, -3.5, 14], [-10.5, -6, 10.5], 2.4, 2.1)],
  ['foreR', limb([-10.5, -6, 10.5], [-14, -7.5, 8.6], 2.1, 1.8)],
  ['handR', ell([2, 1.9, 1.6], [-14.6, -7.8, 8.2])],
  ...chain(TAIL_J, TAIL, TAIL_R),
];
const closestOf = (c) => { let best = null; let bd = Infinity; for (const [n, t] of parts) { const d = t(c); if (d < bd) { bd = d; best = n; } } return best; };

function assign(c, rgb) {
  if (isAny(rgb, FLAMES, 0.04)) {
    // the ember core rings on the belly stay on the body
    if (c[1] < -2 && c[2] < 14 && c[0] < 2) return 'body';
    let best = 'body'; let bd = Infinity;
    for (const [b, h, j] of RIDGE) { const d = capD(c, b, add(b, [0, 0, h]), 1.5); if (d < bd) { bd = d; best = j; } }
    return best;
  }
  if (near(rgb, CLAW, 0.04)) {
    if (c[2] > 4) return c[0] >= 0 ? 'handL' : 'handR';
    return c[0] >= 0 ? 'legL' : 'legR';
  }
  return closestOf(c);
}

const base = bipedClips({ face, tail, hipH: 8.5, stride: 16, armSwing: 16, hopH: 2, hopScale: 0.5 });

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
