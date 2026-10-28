// Ravatar (water relic)'s rig: Ravatar's body (rigs/ravatar.mjs) in aqua scale armour. Finned pauldrons and gauntlets
// follow their parts, the wave curl at the tail tip rides tail4 and rolls, and the ripples round the feet (`ripple`,
// off the root) spread and fade in a loop. Numbers are scad/ravatar_water.scad's.
import { TAU, osc, rigDef, win } from './lib/anim.mjs';
import { any, ell, limb, mx, petal, pick } from './lib/biped.mjs';
import { isAny } from './lib/geo.mjs';
import { baseJoints, baseParts, clipsFor, faceFor } from './ravatar.mjs';

const face = faceFor();
const joints = [...baseJoints, { name: 'curl', parent: 'tail4', at: [16, 0.5, 20] }, { name: 'ripple', parent: 'root', at: [0, 0, 0] }, ...face.joints];

const parts = [
  ...baseParts,
  ['leg*', any(ell([3.3, 3.3, 2.4], [5.3, -0.2, 3.6]), petal([0.5, 2.2, 3], [7.8, 0.6, 7], [0, 20, 0]))],
  ['arm*', any(ell([4, 4, 2.8], [7.6, 0, 29.6]), petal([0.6, 3, 2.6], [10.4, 0.8, 30.8], [0, -35, 0]), ell([0.7, 0.7, 0.7], [7.6, -3.8, 30.2]))],
  ['fore*', any(limb([9.7, -0.8, 19.5], [10.4, -1.4, 14], 2.3, 2.1), petal([0.5, 2.4, 3.4], [12.2, 0.4, 17], [0, -20, 0]), ell([0.6, 0.6, 0.6], [10.2, -3.2, 16.5]))],
  ['hand*', ell([3.4, 3.4, 1], [10.6, -1.8, 13])],
  ['body', any(ell([7.6, 5.6, 4.8], [0, 0.4, 26.5]), ell([7.8, 6.2, 5.6], [0, -0.4, 26.5]), ell([0.9, 0.6, 0.9], [0, -5.4, 23.6]))],
  ['curl', any(ell([4.6, 1.8, 4.6], [16, 0.5, 20]), ell([1, 1, 1], [19, -1, 25]), ell([1, 1, 1], [14, 0, 25.5]), ell([1, 1, 1], [20.5, 1, 21]))],
];
// the rings on the ground (z < 1): round each foot (r 4 and 2.6 at [±6, -1]) and the wide arc (r 11)
const assign = (c, rgb) => (c[2] < 1 && isAny(rgb, [[0.62, 0.8, 0.94], [0.9, 0.97, 1]]) ? 'ripple' : pick(c, parts));

// the ripples swell and settle (whole cycles per loop); the curl rolls about its own centre
const wave = (u, cycles, k = 1) => ({ ripple: { s: [1 + 0.08 * k * osc(u, cycles), 1 + 0.08 * k * osc(u, cycles), 1] }, curl: { r: [0, 12 * k * osc(u, cycles, 0.25), 0] } });
const clips = clipsFor({
  face,
  extra: {
    idle: (t, u) => wave(u, 2),
    walk: (t, u) => wave(u, 1, 0.6),
    idle_look: (t, u) => wave(u, 1),
    windup: (t, u) => ({ curl: { r: [0, -20 * u, 0] } }),
    lunge: (t, u) => ({ curl: { r: [0, 40 * win(u, 0.2, 0.8, 0.15) - 20 * (1 - Math.min(1, u * 5)), 0] }, ripple: { s: [1 + 0.2 * win(u, 0.3, 1.2, 0.2), 1 + 0.2 * win(u, 0.3, 1.2, 0.2), 1] } }),
    hurt: (t, u) => wave(u, 2, 1.5),
    celebrate: (t, u) => wave(u, 2, 2),
    exit: (t, u) => wave(u, 1),
    idle_roar: (t, u) => wave(u, 3, 1.5),
    idle_swish: (t, u) => wave(u, 2),
  },
});

// fidget: it draws a slow circle of water with both palms, the tail curl winding up and unrolling
clips.idle_flow = {
  seconds: 2.8,
  pose: (t, u) => {
    const on = win(u, 0.08, 0.9, 0.15);
    const a = TAU * u;
    return {
      ...wave(u, 2, 1.2),
      body: { r: [0, 0, 8 * Math.sin(a) * on] },
      head: { r: [3 * on, 0, 10 * Math.sin(a) * on] },
      ...face.pose('open', 0.5 * on),
      armL: { r: [(-40 - 15 * Math.sin(a)) * on, -10 * on, 0] }, foreL: { r: [-35 * on, 0, 20 * Math.cos(a) * on] },
      armR: { r: [(-40 + 15 * Math.sin(a)) * on, 10 * on, 0] }, foreR: { r: [-35 * on, 0, 20 * Math.cos(a) * on] },
      curl: { r: [0, 60 * Math.sin(a) * on, 0] },
    };
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
