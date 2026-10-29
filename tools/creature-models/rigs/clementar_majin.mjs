// Clementar Majin's rig: Clementar's, with both eyes open and glowing (scad/clementar_majin.scad), the snarl in the
// head, the vines following the parts they coil round, and darker fidgets: it crushes a blood orange and glares.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, pair, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye, blinks } from './lib/face.mjs';

// Clementar's old-model rig (scad/clementar_majin.scad is still built on it); clementar.mjs moved to its
// sprite-accuracy model on 2026-10-29. The robe below the sash is its own joint (skirt, on the root) so the hem stays
// on the ground while the body sways; the feet only peek out, so the walk is a small shuffle.
const EYE_L = { side: 'L', at: [2.4, -4, 28.8], size: 1.6, yaw: 8, flat: 0.42 };

const jointsFor = (face) => [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [3, 0, 4]),
  { name: 'skirt', parent: 'root', at: [0, 0, 13] },
  { name: 'body', parent: 'root', at: [0, 0, 13] },
  { name: 'head', parent: 'body', at: [0, -0.6, 23.4] },
  ...pair('ear*', 'head', [3.2, 0.4, 30.4]),
  ...pair('arm*', 'body', [4.8, 0, 21.4]),
  ...pair('fore*', 'arm*', [8.6, -1.4, 18.4]),
  ...pair('hand*', 'fore*', [10.6, -2.4, 21]),
  { name: 'tail1', parent: 'skirt', at: [1.5, 4.5, 9] },
  { name: 'tail2', parent: 'tail1', at: [11.8, 6.5, 10.5] },
  ...face.joints,
];

const parts = [
  ['body', any(blob([[[6.6, 5.4, 1], [0, 0.2, 3.5]], [[5.2, 4.2, 3], [0, 0, 13]], [[5.6, 4.2, 3.6], [0, 0, 20]]]), ell([6.5, 5.4, 1.5], [0, 0, 13.6]),
    ell([4.6, 3.2, 3.4], [0, 3.2, 23.4]), limb([-4.8, -2.6, 13.2], [-8, -2.5, 7], 0.8, 1.6), limb([-9.2, -2.5, 6.6], [-7.5, -2.5, 4.8], 1, 0.6))],
  ['head', any(ell([2.8, 2.6, 2], [0, -0.6, 23.4]), blob([[[5.6, 4.8, 4.8], [0, -0.6, 27.8]], [[3.8, 3.6, 3.2], [0, -2, 26.4]]]),
    blob([[[2.6, 2, 1.9], [0, -4.4, 26]], [[1.1, 1.2, 0.9], [0, -7.6, 26.4]]]), limb([0.2, 0, 31.3], [0.5, 0, 35.3], 3, 2.6))],
  ['ear*', limb([3.2, 0.4, 30.4], [8.2, 2.9, 41.9], 3, 0.6)],
  ['arm*', limb([4.8, 0, 21.4], [8.6, -1.4, 18.4], 1.9, 1.7)],
  ['fore*', limb([8.6, -1.4, 18.4], [10.6, -2.4, 21], 1.7, 1.6)],
  ['hand*', any(ell([1.6, 1.5, 1.2], [11, -2.6, 22.2]), ell([3.6, 2.6, 3.4], [11.2, -2.4, 25.6]))],
  ['leg*', any(ell([1.6, 2.6, 1.1], [3, -1.6, 1.1]), limb([3, 0, 1.4], [3, 0, 4], 1.3, 1.3))],
  ['tail1', blob([[[1.4, 1.4, 1.4], [1.5, 4.5, 9]], [[3.6, 3.2, 3.4], [7, 7, 6.5]], [[4.6, 3.6, 4.6], [11.5, 6.5, 9.5]]])],
  ['tail2', blob([[[4.4, 3.4, 4], [12.2, 6.5, 11.6]], [[1.8, 1.6, 2], [13.4, 6, 17.4]]])],
];

/** assign(): nearest primitive; the robe and sash below the sash's middle hang on the skirt. */
const assignWith = (list) => (c) => {
  const j = pick(c, list);
  return j === 'body' && c[2] < 13.2 ? 'skirt' : j;
};

// the hem sways a little behind the shuffle
const hem = (u, cycles, amp) => ({ skirt: { r: [0.4 * amp * osc(u, cycles * 2, 0.2), 0, amp * osc(u, cycles, 0.15)] } });

const clipsFor = (face, fidgets) => ({
  ...bipedClips({
    face, tail: ['tail1', 'tail2'], hipH: 4, stride: 12, armSwing: 5, hopScale: 0.5, hopH: 1.5,
    punch: { arm: [-40, 0, -10], fore: [-30, 0, 0] },
    cheer: { arm: [-10, -35, 0], fore: [-25, 0, 0] },
    add: {
      idle: (t, u) => hem(u, 1, 0.6),
      walk: (t, u) => hem(u, 1, 2.5),
      idle_look: (t, u) => hem(u, 1, 0.8),
      celebrate: (t, u) => merge(hem(u, 2, 2), both('hand', { r: [0, 0, 20 * osc(u, 2)] })),
      lunge: (t, u) => hem(u, 1, 1.5),
      hurt: (t, u) => ({ skirt: { r: [-2 * K(u, [[0, 0], [0.2, 1], [1, 0]]), 0, 0] } }),
    },
  }),
  ...fidgets,
});


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
