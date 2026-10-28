// Ravatar (air relic)'s rig: Ravatar's body (rigs/ravatar.mjs) in sky-blue armour. The armour follows its part, the
// gust streaks and curls ride the tail, the wind rings round the claws spin on the hands, and the rings round the
// feet are one joint (`gust`) that keeps turning. Numbers are scad/ravatar_air.scad's.
import { TAU, osc, rigDef, win } from './lib/anim.mjs';
import { any, ell, limb, mx, pick } from './lib/biped.mjs';
import { near } from './lib/geo.mjs';
import { baseJoints, baseParts, clipsFor, faceFor } from './ravatar.mjs';

const WIND = [[0.82, 0.9, 0.98], [0.96, 0.98, 1]];

const face = faceFor();
const joints = [...baseJoints, { name: 'gust', parent: 'root', at: [0, 0, 0] }, ...face.joints];

const parts = [
  ...baseParts,
  ['leg*', any(ell([3.3, 3.3, 2.2], [5.3, -0.2, 3.8]), ell([2.6, 1.2, 2], [5.6, -2.8, 8.6]))],
  ['arm*', any(ell([3.8, 3.8, 2.6], [7.4, 0, 29.6]), ell([1.6, 3.6, 0.6], [8.6, 0, 28.4]))],
  ['fore*', limb([9.7, -0.8, 19], [10.3, -1.3, 15.5], 2.3, 2)],
  ['hand*', ell([3.2, 3.2, 1], [10.6, -1.8, 13])],
  ['body', any(ell([6.6, 3.6, 3.8], [0, -1.2, 26.6]), mx(limb([4.2, -3.6, 30], [1.2, -4.3, 24.2], 0.45)), ell([1.4, 0.8, 1.6], [0, -4.6, 23.4]))],
  ['tail4', any(ell([2.4, 1, 2.4], [17, 0, 21.5]), ell([2, 1, 2], [19.5, 1, 17]), ell([1.6, 1, 1.6], [14, 1, 19]))],
];

function assign(c, rgb) {
  // the rings round the feet: wind-coloured, low and away from the legs
  if (c[2] < 3.1 && WIND.some((w) => near(rgb, w, 0.015)) && Math.hypot(c[0], c[1]) > 6) return 'gust';
  return pick(c, parts);
}

// the foot rings turn a whole number of times per loop; on the hit they flare
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

// fidget: it calls up the wind. Arms sweep up from the sides, the rings race round, the tail streams straight up
clips.idle_gale = {
  seconds: 2.4,
  pose: (t, u) => {
    const on = win(u, 0.1, 0.85, 0.15);
    const f = Math.sin(TAU * 4 * u) * on;
    return {
      body: { r: [-4 * on, 0, 0] },
      head: { r: [-14 * on, 0, 3 * f] },
      ...face.pose(on > 0.5 ? 'shut' : 'open', on * 2),
      armL: { r: [-10 * on, -70 * on, 0] }, armR: { r: [-10 * on, 70 * on, 0] },
      foreL: { r: [0, 0, 20 * on] }, foreR: { r: [0, 0, -20 * on] },
      tail1: { r: [-8 * on, 0, 2 * f] }, tail2: { r: [-10 * on, 0, 3 * f] }, tail3: { r: [-12 * on, 0, 4 * f] }, tail4: { r: [-14 * on, 0, 5 * f] },
      gust: { r: [0, 0, 1080 * u], s: 1 + 0.3 * on },
    };
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
