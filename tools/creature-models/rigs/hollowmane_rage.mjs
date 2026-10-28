// Hollowmane Rage's rig: Hollowmane's skeleton and clips; the rage form's jaw hangs lower and gapes wider, a crown of
// black horns rakes off the skull and shoulders, and a fidget of its own shakes with fury. Numbers are
// scad/hollowmane_rage.scad's.
import { K, TAU, both, osc, rigDef, win } from './lib/anim.mjs';
import { any, ell, mx, pick, spike } from './lib/biped.mjs';
import { add, baseClips, fidgets, joints, parts as baseParts } from './hollowmane.mjs';

const parts = [
  ...baseParts.filter(([j]) => j !== 'jaw'),
  ['jaw', any(ell([2.6, 2, 1.2], [0, -8.4, 27.6]), ell([2, 1.2, 1], [0, -9.4, 29]), ell([2.2, 0.5, 0.6], [0, -10.4, 30]))],
  ['head', mx(any(spike([3, 0, 37], [6, 3, 7], 1.3), spike([6, 1, 34], [8, 2, 5], 1.3)))],
  ['body', mx(any(spike([9, 1, 30], [9, 1, 6], 1.3), spike([10, 0, 26], [7, 0, 7], 1.3)))],
];

const clips = {
  ...baseClips({
    stride: 17, armSwing: 14,
    add: {
      ...add,
      idle: (t, u) => ({ jaw: { r: [3 + 2 * osc(u, 4), 0, 0] } }),
      celebrate: (t, u) => ({ jaw: { r: [16 * win(u, 0.05, 0.95, 0.1), 0, 0] } }),
    },
  }),
  ...fidgets,

  // fidget: fury boils over: it trembles, hunches, flexes both scythes out wide and roars with the jaw gaping
  idle_fury: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.25, 1], [0.75, 1], [0.95, 0]]);
      const tr = Math.sin(TAU * 14 * u) * on;
      return {
        root: { r: [0, 0, 0.8 * tr] },
        body: { r: [8 * on, 0, 0], p: [0, 0, -0.4 * on] },
        head: { r: [-14 * on + tr, 0, 0] },
        jaw: { r: [24 * on, 0, 0] },
        ...both('arm', { r: [-10 * on, -24 * on + tr, 0] }),
        ...both('fore', { r: [-20 * on, 0, 0] }),
        cape1: { r: [-6 * on + tr, 0, 0] },
      };
    },
  },
};

export default rigDef({ joints, assign: (c) => pick(c, parts), clips });
