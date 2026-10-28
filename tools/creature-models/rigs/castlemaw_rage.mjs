// Castlemaw (Rage)'s rig: Castlemaw's, with the roaring jaw dropped lower (scad/castlemaw_rage.scad), a constant
// tremble of fury in the idle and a seething fidget in place of the snarl.
import { K, TAU, both, rigDef, win } from './lib/anim.mjs';
import { any, blob, spike } from './lib/biped.mjs';
import { assignWith, clipsFor, face, joints } from './castlemaw.mjs';

const JAW = any(blob([[[4, 3.2, 1.6], [0, -5, 29.4]], [[1.8, 1.2, 1], [0, -10.6, 27.6]]]), blob([[[2.8, 2.4, 1.4], [0, -8.6, 30]], [[1.4, 0.8, 1.2], [0, -11.6, 29.2]]]),
  spike([1.5, -11, 28.2], [0, -0.1, 1.5], 0.5), spike([-1.5, -11, 28.2], [0, -0.1, 1.5], 0.5));

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

export default rigDef({ joints, assign: assignWith(JAW), extras: face.extras, clips });
