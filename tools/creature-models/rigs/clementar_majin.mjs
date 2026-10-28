// Clementar Majin's rig: Clementar's, with both eyes open and glowing (scad/clementar_majin.scad), the snarl in the
// head, the vines following the parts they coil round, and darker fidgets: it crushes a blood orange and glares.
import { K, TAU, both, rigDef, win } from './lib/anim.mjs';
import { eyeKit, mirrorEye, blinks } from './lib/face.mjs';
import { EYE_L, assignWith, clipsFor, jointsFor, parts } from './clementar.mjs';

const EYE = { ...EYE_L, size: 1.65 };
const face = eyeKit({ eyes: [EYE, mirrorEye(EYE)], skin: [0.28, 0.17, 0.1] });

const clips = clipsFor(face, {
  // fidget: squeezes the right cluster until it splits, red light leaking, head lowered over it
  idle_crush: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.18, 1], [0.8, 1], [0.95, 0]]);
      const sq = win(u, 0.3, 0.62, 0.08);
      const sh = Math.sin(TAU * 14 * u) * sq;
      return {
        body: { r: [4 * on, 0, -4 * on] },
        head: { r: [12 * on, 0, -12 * on] },
        armR: { r: [-10 * on, 0, 14 * on] },
        foreR: { r: [-20 * on, 0, 0] },
        handR: { s: [1 + 0.08 * sq, 1 + 0.08 * sq, 1 - 0.18 * sq], r: [0, 1.5 * sh, 0] },
        ...face.pose('open', 0.45 * on + 0.3 * sq),
        ...both('ear', { r: [16 * on, -8 * on, 0] }),
      };
    },
  },

  // fidget: a slow turn of the head towards the camera side, lids lowering into a glare, ears flattening
  idle_glare: {
    seconds: 2.6,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.25, 1], [0.75, 1], [0.95, 0]]);
      return {
        body: { r: [3 * on, 0, 6 * on] },
        head: { r: [8 * on, 0, 22 * on] },
        ...both('ear', { r: [22 * on, -12 * on, 0] }),
        ...face.pose('open', 0.55 * on + blinks(u, [[0.86, 0.9]])),
        ...both('arm', { r: [4 * on, 6 * on, 0] }),
      };
    },
  },
});

export default rigDef({ joints: jointsFor(face), assign: assignWith(parts), extras: face.extras, clips });
