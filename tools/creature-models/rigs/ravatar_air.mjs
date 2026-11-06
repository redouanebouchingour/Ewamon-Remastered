// Ravatar (air relic)'s rig: Ravatar's body (rigs/ravatar.mjs) in pale swirl armour. The armour rides its part
// (pauldrons on the upper arms, bracers on the forearms, plates and greaves on the legs), the wind curling round the
// claws rides the hands, the whirls on the ground round the feet are one joint (`gust`, off the root) that keeps
// turning, and the cloud tail is tail1..tail5: its root, the plume's foot, the plume, the band and the curled tip.
// Numbers are scad/ravatar_air.scad's.
import { TAU, osc, rigDef, win } from './lib/anim.mjs';
import { any, blob, ell, limb, mx, pick } from './lib/biped.mjs';
import { isAny, rot } from './lib/geo.mjs';
import { ELBOW, HAND, HIP, SHOULDER, WRIST, armTests, baseJoints, bodyParts, clipsFor, faceFor } from './ravatar.mjs';

const FUR = [0.75, 0.64, 0.5];
const TAILC = [[0.76, 0.79, 0.82], [0.95, 0.98, 0.99], [0.6, 0.66, 0.7], [0.26, 0.27, 0.29]];
const WIND = [[0.86, 0.93, 0.96], [0.95, 0.98, 0.99]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

const TORSO = [[[3.8, 3, 2.5], [0, 0.2, 15.5]], [[6.2, 3.9, 3.6], [0, -0.2, 20]], [[5.6, 3.6, 2.6], [0, 0.6, 23]]];
const KNEE = [7.6, -1.2, 8.2];
const ANKLE = [9.6, -1.4, 3.2];
const FOOT = [9.8, -1.6, 0];
const ROOT = [[1, 3.5, 12], [5, 6.5, 4.6]];
const BAND = [[[16, 8, 19], 4.5], [[20, 7.5, 23], 3.3], [[25, 7, 24], 2.6], [[29.5, 6.5, 26], 1.5]];
const TIP = [[29.5, 6.5, 26], [30.4, 6.5, 28.6], [29.4, 6.5, 30.6], [27.6, 6.5, 30.6], [27, 6.5, 29.4]];
const TIP_R = [1.5, 1.2, 0.9, 0.6, 0.3];
const PEBBLES = [[23.7, 6, 29], [30.6, 6, 17.5]];
const WHIRL = [16.5, -1];
export const tails = ['tail1', 'tail2', 'tail3', 'tail4', 'tail5'];

const face = faceFor(FUR);
const joints = [
  ...baseJoints.filter((j) => !j.name.startsWith('tail')),
  { name: 'tail1', parent: 'body', at: ROOT[0] },
  { name: 'tail2', parent: 'tail1', at: ROOT[1] },
  { name: 'tail3', parent: 'tail2', at: [12, 8.2, 9] },
  { name: 'tail4', parent: 'tail3', at: [16, 8, 19] },
  { name: 'tail5', parent: 'tail4', at: [22.5, 7.2, 23.5] },
  { name: 'gust', parent: 'root', at: [0, 0, 0] },
  ...face.joints,
];

// scad shard(p, rot, w, t, h): a plate from p to its point h along the turned +Z
const shard = (p, r, w, h) => limb(p, add(p, rot(r, [0, 0, h])), w * 0.75, 0.3);
const ARM = armTests(SHOULDER, ELBOW, WRIST, HAND);
const S = SHOULDER;
const head = bodyParts.find(([n]) => n === 'head')[1];
const foot = (p) => add(FOOT, rot([0, 0, 18], p));
const parts = [
  ['body', any(blob(TORSO), mx(ell([2.7, 1.3, 1.9], [2.7, -3, 20.6])), mx(ell([2.8, 1, 2], [2.8, -3.55, 21])),
    ell([5.4, 3.2, 2.3], [0, -0.4, 24]), ell([0.8, 0.5, 1.15], [0, -4.4, 21.2]),
    ell([4.3, 3.6, 0.95], [0, 0.2, 14.9]), ell([4.1, 3.3, 2], [0, 0.3, 13.4]),
    shard([0, -3.3, 14.4], [180, 0, 0], 2.6, 7), shard([0, 3.6, 14.4], [178, 0, 0], 2.4, 7.6))],
  ['head', head],
  ['arm*', any(ARM.arm, ell([4.3, 4.2, 3.4], add(S, [0.6, 0, 1.1])), ell([3, 3.6, 2.2], add(S, [2.1, 0, -0.7])),
    limb(add(S, [1.6, -0.8, 4]), add(S, [2.7, -1.3, 7.8]), 1.3, 0.5), limb(add(S, [1.4, 1.6, 3.8]), add(S, [2.2, 2.6, 6.8]), 1, 0.3))],
  ['fore*', any(ARM.fore, limb(ELBOW, WRIST, 2.6, 2.6))],
  ['hand*', ARM.hand],
  ['leg*', any(limb(HIP, KNEE, 3, 2.4), ell([2.1, 2, 1.8], add(KNEE, [0, -0.6, 0.6])), limb(KNEE, ANKLE, 2.3, 1.8),
    ell([2.8, 2.4, 3.9], [6.5, -2.2, 11]), ell([1.7, 1, 1.7], add(KNEE, [0.5, -2.2, 0.6])),
    blob([[[2.8, 2.8, 1.4], [8.9, -1.4, 6.8]], [[3.3, 3.3, 1.4], [9.3, -1.5, 3]]]),
    ell([1.9, 1.7, 1.3], foot([0, 0.4, 1.4])), ell([2, 1.6, 1.1], foot([0, -1.8, 1.1])),
    ...[-1.15, 0, 1.15].map((dx) => limb(foot([dx, -3.1, 0.75]), foot([dx * 1.25, -4.9, 0.15]), 0.65, 0.2)))],
];
const tailParts = [
  ['tail1', limb(ROOT[0], ROOT[1], 2, 2.6)],
  ['tail2', any(ell([3.2, 2.4, 3], [5, 6.5, 4.6]), ell([4.2, 3, 3.6], [10, 8, 5]), ell([2.8 * 1.2, 2.8 * 0.75, 2.8 * 0.85], [18, 7.6, 9.6]))],
  ['tail3', any(ell([5.2, 3.6, 5.2], [14, 8.5, 12]), ell([3, 2.2, 3], [8, 7, 10]), ell([2.4 * 1.2, 2.4 * 0.75, 2.4 * 0.85], [19.2, 7.4, 14.6]))],
  ['tail4', any(ell([4.5, 3.2, 4.5], [16, 8, 19]), ell([3.5, 2.6, 3.5], [11.5, 7.5, 19.5]), limb(BAND[0][0], BAND[1][0], 4.5, 3.3),
    ell([2.6 * 1.2, 2.6 * 0.75, 2.6 * 0.85], [12.4, 7.6, 22.6]), ell([2.2 * 1.2, 2.2 * 0.75, 2.2 * 0.85], [17.4, 7.4, 24.2]))],
  ['tail5', any(limb(BAND[1][0], BAND[2][0], 3.3, 2.6), limb(BAND[2][0], BAND[3][0], 2.6, 1.5), ell([2.3, 1.4, 1.6], [22.6, 7, 26]),
    ...TIP.slice(1).map((p, i) => limb(TIP[i], p, TIP_R[i], TIP_R[i + 1])), ...PEBBLES.map((p) => ell([1.2, 1.2, 1.2], p)))],
];

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function assign(c, rgb) {
  if (isAny(rgb, WIND, 0.015)) {
    // the whirls on the ground (and the curls standing on them) turn as one; the rest curls round the hands
    const r = Math.hypot(Math.abs(c[0]) - WHIRL[0], c[1] - WHIRL[1]);
    if (c[2] < 3.6 && r > 3.8 && r < 9) return 'gust';
    if (isAny(rgb, [WIND[0]], 0.015)) return c[0] >= 0 ? 'handL' : 'handR';
  }
  if (isAny(rgb, TAILC, 0.015) || PEBBLES.some((p) => dist(c, p) < 1.2)) return pick(c, tailParts);
  return pick(c, parts);
}

// the ground whirls turn a whole number of times per loop; on the hit they flare
const spin = (turns, k = 1) => (t, u) => ({ gust: { r: [0, 0, 360 * turns * u], s: k } });
const clips = clipsFor({
  face,
  extra: {
    idle: spin(1),
    walk: spin(0.5),
    idle_look: spin(0.5),
    windup: (t, u) => ({ gust: { r: [0, 0, 40 * u], s: 1 - 0.15 * u } }),
    lunge: (t, u) => ({ gust: { r: [0, 0, 180 * u], s: 0.85 + 0.35 * win(u, 0.3, 0.9, 0.1) } }),
    hurt: (t, u) => ({ gust: { r: [0, 0, -60 * u], s: 1 + 0.1 * osc(u, 3) } }),
    faint: (t, u) => ({ gust: { r: [0, 0, 90 * u], s: 1 - 0.6 * win(u, 0.3, 1.2, 0.4) } }),
    celebrate: spin(1, 1.1),
    enter: (t, u) => ({ gust: { r: [0, 0, 360 * u], s: 0.4 + 0.6 * Math.min(1, u * 2) } }),
    exit: spin(1),
    idle_roar: (t, u) => ({ gust: { r: [0, 0, 720 * u], s: 1 + 0.25 * win(u, 0.2, 0.75, 0.1) } }),
    idle_swish: spin(1),
  },
});

// fidget: it calls up the wind. Arms sweep up from the sides, the whirls race round, the gust streams up and ripples
clips.idle_gale = {
  seconds: 2.4,
  pose: (t, u) => {
    const on = win(u, 0.1, 0.85, 0.15);
    const f = Math.sin(TAU * 4 * u) * on;
    return {
      body: { r: [-4 * on, 0, 0] },
      head: { r: [-14 * on, 0, 3 * f] },
      ...face.pose(on > 0.5 ? 'shut' : 'open', on * 2),
      armL: { r: [-10 * on, -60 * on, 0] }, armR: { r: [-10 * on, 60 * on, 0] },
      foreL: { r: [0, 0, 20 * on] }, foreR: { r: [0, 0, -20 * on] },
      ...Object.fromEntries(tails.map((n, i) => [n, { r: [-3 * on * (1 + 0.4 * i), 0, (1 + i) * f] }])),
      gust: { r: [0, 0, 1080 * u], s: 1 + 0.3 * on },
    };
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
