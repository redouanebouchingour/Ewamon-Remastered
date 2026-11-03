// Acier Majin's rig: the same body, pose and swords as Acier (scad/acier_majin.scad keeps every joint number of
// scad/acier.scad), so it takes Acier's joints, parts and clips, plus a menacing fidget of its own. The horns follow the head and the shoulders.
import { K, TAU, both, rigDef, win } from './lib/anim.mjs';
import { any, pick, spike } from './lib/biped.mjs';
import { clipsFor, joints, parts } from './acier.mjs';

const clips = {
  ...clipsFor(),

  // fidget: it hunches over the cleaver, head low, all four fists trembling with rage, then rolls its shoulders
  idle_seethe: {
    seconds: 2.6,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.15, 1], [0.7, 1], [0.85, 0]]);
      const tr = Math.sin(TAU * 13 * u) * on;
      const roll = win(u, 0.72, 0.98, 0.08);
      return {
        root: { r: [2 * on, 0, 0] },
        body: { r: [8 * on, 0, 0.6 * tr] },
        head: { r: [10 * on, 0, 0] },
        ...both('arm', { r: [-8 * on, -6 * on + 1.2 * tr, 0] }),
        ...both('fore', { r: [-30 * on, 0, 0] }),
        ...both('arm2', { r: [-10 * on + 14 * roll, -6 * roll, 0] }),
        ...both('fore2', { r: [0.8 * tr, 0, 0] }),
      };
    },
  },
};

// the bronze horns on the upper shoulders stay with the body (the inner -X one sits next to the helm)
const horns = ['body', any(spike([-5.3, 0.2, 22.4], [0.2, 0, 3], 0.62), spike([-3.4, -0.6, 21.6], [0.3, -0.1, 2.5], 0.55),
  spike([5, 0, 22.4], [-0.1, 0, 2.3], 0.55), spike([7.3, 0.3, 21.8], [0.4, 0, 2.9], 0.62))];

export default rigDef({ joints, assign: (c) => pick(c, [...parts, horns]), clips });
