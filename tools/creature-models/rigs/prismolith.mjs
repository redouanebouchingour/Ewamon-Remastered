// Prismolith's rig: a hunched cobblestone golem with a crystal starburst on its back (body), a small plated head
// peering out, geode shoulders and huge shard-studded forearms reaching down to its knuckles. Numbers are
// scad/prismolith.scad's; the head block is translate([0, -10, 30]) scale(1.3) translate([0, 8, -27]).
import { K, TAU, both, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, inFrame, limb, mx, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { subFrame } from './lib/geo.mjs';

const HEAD = subFrame([0, 0.4, -5.1], [0, 0, 0], 1.3);
const eyeL = { side: 'L', at: [2.3, -11.9, 26.9], size: 1.45, yaw: 14, flat: 0.5, frame: HEAD };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.66, 0.55, 0.3] });
const cry = (p, d, r) => limb(p, [p[0] + d[0], p[1] + d[1], p[2] + d[2]], r * 1.05, r * 0.4);

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [5.5, 2, 12]),
  { name: 'body', parent: 'root', at: [0, 1, 12] },
  { name: 'head', parent: 'body', at: [0, -7, 28] },
  ...pair('arm*', 'body', [10.5, -1, 25]),
  ...pair('fore*', 'arm*', [13.5, -3, 15]),
  ...face.joints,
];

const BURST = [[0, 0, 14], [0, -40, 12], [0, 40, 12], [0, -75, 11], [0, 75, 11], [30, -20, 11], [30, 20, 11], [-25, 0, 10], [35, -60, 9],
  [35, 60, 9], [-20, -45, 9], [-20, 45, 9], [55, 0, 8], [10, -100, 8], [10, 100, 8], [60, -40, 7], [60, 40, 7]];
const D = Math.PI / 180;
const burst = BURST.map(([pitch, roll, len]) => {
  const d = [Math.sin(roll * D), Math.sin(pitch * D) * Math.cos(roll * D) + 0.45, Math.cos(pitch * D) * Math.cos(roll * D)];
  const n = Math.hypot(...d);
  return cry([0, 5, 26], d.map((x) => (x / n) * len * 1.7), len > 10 ? 2.2 : 1.8);
});

const parts = [
  ['body', any(blob([[[10, 8.5, 8], [0, 1, 21]], [[8, 7, 6.5], [0, -3, 25]], [[7, 6, 5], [0, 1, 14]]]), ell([11.6, 10, 9.6], [0, 1, 21]),
    ell([4, 1.6, 2], [0, -6.6, 15]), ell([2.4, 2, 2.4], [0, 8.5, 27]), ...burst)],
  ['head', any(inFrame(HEAD, any(blob([[[4.2, 4, 3.6], [0, -8, 27]], [[3, 2.8, 2.4], [0, -11, 25.5]]]), ell([3.4, 2, 1.6], [0, -10, 29.4]),
    mx(limb([3.4, -10.4, 28.6], [0.7, -12.2, 27.9], 1.2, 0.8)), ell([1.8, 1, 0.6], [0, -13.4, 24.6]), mx(cry([2.4, -8, 29.5], [1.5, 1.5, 4], 0.8)))),
    ...[-50, -25, 0, 25, 50].map((a) => cry([a / 25, -9, 33.5], [Math.sin(a * D) * 3, 1.5, 5.5 - Math.abs(a) / 25], 1.1)))],
  ['arm*', any(ell([5, 5, 5], [10.5, -1, 25]), inFrame(subFrame([14.6, -2, 25.5], [0, 90, -20]), ell([3.4, 3.4, 1.6], [0, 0, 0.8])),
    limb([11.5, -1, 22], [13.5, -3, 15], 3.4, 3.2))],
  ['fore*', any(limb([13.5, -3, 15], [13.5, -6, 8], 3.6, 3.8), ell([4, 4, 3], [13.5, -6.5, 6]), ell([3.6, 1.6, 1.3], [13.5, -9.5, 5]),
    cry([15.5, -3, 13], [4, 2, 2], 1.5), cry([16, -4.5, 10], [5.5, 1, 0], 1.5), cry([15.6, -5.5, 7], [5, 0, -1.5], 1.4), cry([13, -1, 11], [0.5, 4, 0], 1))],
  ['leg*', any(limb([5.5, 2, 12], [7, 0, 6], 3.8, 3.4), limb([7, 0, 6], [7, -1, 2], 3.4, 3.2), ell([3.4, 4.4, 1.8], [7, -2, 1.8]), ell([3, 1.4, 1], [7, -6, 1.2]),
    cry([9.5, 1, 10], [4, 1.5, -1], 1.2), cry([9.5, 2, 5], [4, 1, -1.5], 1), cry([8, 4, 6], [1.5, 4, -0.5], 1))],
];

const base = bipedClips({
  face, hipH: 12, stride: 12, armSwing: 10, hopScale: 0, droop: 0.5,
  punch: { arm: [-55, 0, 0], fore: [-35, 0, 0] },
  cheer: { arm: [-20, -80, 0], fore: [-20, 0, 0] },
});

const clips = {
  ...base,

  // fidget: a hunched shrug that makes the back burst shiver, then a slow blink
  idle_shrug: {
    seconds: 2.4,
    pose: (t, u) => {
      const up = win(u, 0.1, 0.5, 0.12);
      const sh = Math.sin(TAU * 9 * u) * win(u, 0.2, 0.55, 0.05);
      return {
        body: { r: [-4 * up + 0.8 * sh, 0, 0.8 * sh], p: [0, 0, 0.4 * up] },
        head: { r: [6 * up, 0, 0], p: [0, 0, -0.6 * up] },
        ...face.pose('open', blinks(u, [[0.7, 0.8]])),
        ...both('arm', { r: [0, -6 * up, 0] }),
      };
    },
  },

  // fidget: it knocks a knuckle on the ground twice, as if testing the rock, and peers at it
  idle_knock: {
    seconds: 2.2,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.15, 1], [0.75, 1], [0.92, 0]]);
      const knock = Math.max(0, Math.sin(TAU * 4 * (u - 0.2))) * win(u, 0.2, 0.7, 0.04);
      return {
        body: { r: [6 * on, 0, -4 * on] },
        head: { r: [12 * on, 0, -14 * on] },
        ...face.pose('open', 0.3 * on),
        armR: { r: [-10 * on + 8 * knock, 0, 0] },
        foreR: { r: [-6 * knock, 0, 0] },
        armL: { r: [2 * osc(u, 1), 0, 0] },
      };
    },
  },
};

export default rigDef({ joints, assign: (c) => pick(c, parts), extras: face.extras, clips });
