// Castlemaw (Rage)'s rig: Castlemaw's, with the roaring jaw dropped lower (scad/castlemaw_rage.scad), a constant
// tremble of fury in the idle and a seething fidget in place of the snarl.
import { K, TAU, both, rigDef, win } from './lib/anim.mjs';
import { any, ell, fromSheet, limb } from './lib/biped.mjs';
import { assignWith, clipsFor, face, jawAt, joints } from './castlemaw.mjs';

// the shag on the back, its streaks and embers, the lighter locks: only the cloak has these colours (the front drape is
// near the fur's own colour, so it goes by shape)
const CLOAK = [[0.47, 0.24, 0.22], [0.63, 0.23, 0.18], [0.94, 0.55, 0.32], [0.29, 0.28, 0.28]];
const fs = (pts) => pts.map(([sx, z, y]) => fromSheet(sx, z, y));
const wisp = (pts) => any(...pts.slice(1).map((p, i) => limb(pts[i], p, 0.6)));
const WISPS = any(wisp(fs([[-8.6, 32.6, -10], [-9.6, 33.6, -10], [-10.1, 35, -10], [-9.8, 36.2, -10], [-10.2, 37.2, -10]])),
  wisp(fs([[-3.6, 33.2, -11], [-2.4, 34.4, -10], [-0.5, 35.4, -9], [1.2, 36.6, -8], [2, 37.4, -8]])));
const licks = (pts) => any(...fs(pts).map((p) => ell([1.4, 1.4, 2.2], p)));
const assign = assignWith({
  jaw: jawAt(1.3),
  cloak: CLOAK,
  extra: [['head', WISPS], ['foreR', licks([[-19.2, 14.8, -8], [-18.2, 17.6, -8], [-17.8, 13.5, -10]])], ['foreL', licks([[17.6, 11.5, -6], [16.4, 9.4, -7]])]],
});

const tremble = (u, n, amp = 1) => ({ body: { r: [0, 0, 0.6 * amp * Math.sin(TAU * n * u)] }, head: { r: [0, 0.8 * amp * Math.sin(TAU * n * u + 1), 0] } });

const { idle_snarl: _snarl, ...clips } = clipsFor({
  extra: {
    idle: (t, u) => tremble(u, 24),
    idle_look: (t, u) => tremble(u, 14),
  },
  fidgets: {
    // fidget: it seethes. Shoulders hunch, the cannons shake, the jaw grinds wide and the head jerks side to side
    idle_seethe: {
      seconds: 2.4,
      pose: (t, u) => {
        const on = K(u, [[0, 0], [0.15, 1], [0.8, 1], [0.95, 0]]);
        const sh = Math.sin(TAU * 16 * u) * on;
        const jerk = K(u, [[0, 0], [0.3, 0], [0.38, 1], [0.5, -1], [0.62, 0.6], [0.75, 0]]);
        return {
          body: { p: [0, 0, 0.4 * on], r: [6 * on, 0, 1.2 * sh] },
          head: { r: [-8 * on, 1.5 * sh, 16 * jerk] },
          jaw: { r: [16 * on + 4 * Math.abs(sh), 0, 0] },
          ...both('arm', { p: [0, 0, 0.8 * on], r: [-10 * on, -8 * on + 2 * sh, 0] }),
          ...both('fore', { r: [-12 * on, 0, 0] }),
          ...face.pose('open', 0.5 * on),
        };
      },
    },
  },
});

export default rigDef({ joints, assign, extras: face.extras, clips });
