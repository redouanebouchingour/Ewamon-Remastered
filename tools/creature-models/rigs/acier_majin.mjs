// Acier Majin's rig: Acier's body and swords (the scad keeps every number), plus a menacing fidget of its own. The
// crest horns, crack bands, bone spikes and the chain on the cleaver follow their nearest part.
import { K, TAU, both, rigDef, win } from './lib/anim.mjs';
import { pick } from './lib/biped.mjs';
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

export default rigDef({ joints, assign: (c) => pick(c, parts), clips });
