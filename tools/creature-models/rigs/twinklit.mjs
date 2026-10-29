// Twinklit's rig: a puffy five-pointed star (one rigid body: its tips are hulled into the core, so they do not bend)
// with a sleepy face, and a swirl of sparkles under it that drifts as the template's tail. Numbers are
// scad/twinklit.scad's (the old model, rigged before its sprite-accuracy rebuild).
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { isAny } from './lib/geo.mjs';

const SPARK = [[1, 0.92, 0.6], [1, 0.8, 0.85]];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 21] },
  { name: 'tail1', parent: 'root', at: [3, 1, 6] },
];

function assign(c, rgb) {
  if (isAny(rgb, SPARK, 0.03) && c[2] < 11) return 'tail1';
  return 'body';
}

// the sparkle swirl turns slowly round under the star
const swirl = (deg) => ({ tail1: { r: [0, 0, deg] } });

const base = floaterClips({
  tail: ['tail1'], bob: 1,
  add: {
    idle: (t, u) => merge(swirl(10 * osc(u, 1)), { body: { r: [0, 5 * osc(u, 1, 0.25), 0] } }),
    walk: (t, u) => merge(swirl(14 * osc(u, 1)), { body: { r: [0, -8, 0] } }),
  },
});
delete base.idle_spin;   // no head: the whole star twirls in idle_twinkle instead

const clips = {
  ...base,

  // fidget: a sleepy twinkle, the star rocking on its points like a pendulum, then a quick cartwheel
  idle_twinkle: {
    seconds: 2.4,
    pose: (t, u) => {
      const rock = 14 * osc(u, 2) * win(u, 0.05, 0.5, 0.08);
      const wheel = K(u, [[0.5, 0], [0.85, 360]]);
      return merge({
        body: { p: [0, 0, 1 + 1.2 * win(u, 0.5, 0.95, 0.1)], r: [0, rock + wheel, 0], s: 1 + 0.04 * Math.sin(TAU * 4 * u) },
      }, swirl(30 * win(u, 0.4, 0.95, 0.1)));
    },
  },
};

export default rigDef({ joints, assign, clips });
