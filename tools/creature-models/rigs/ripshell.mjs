// Ripshell's rig: a turtle brawler in a wide lunge, its right (-X) fist raised beside the head and the left (+X) one
// low in front of the belly, a big gold shell dish on the body and a leather backpack (`pack`, off the body) that
// bounces on top. Numbers are scad/ripshell.scad's (the head's parts are its translate(H) block moved to world).
import { K, TAU, both, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { isAny } from './lib/geo.mjs';

const SKIN = [0.32, 0.58, 0.49];
const SHELL = [[0.84, 0.62, 0.22], [0.52, 0.33, 0.12], [0.36, 0.22, 0.09]];
const PACK = [[0.47, 0.31, 0.18], [0.30, 0.19, 0.10], [0.58, 0.40, 0.22], [0.92, 0.74, 0.32], [0.55, 0.66, 0.64]];

// H = [-1.2, -6, 30.5]; socket_eye([±2.15, -3.3, -0.4], 1.0, ±28) inside it
const H = [-1.2, -6, 30.5];
const at = (p) => [H[0] + p[0], H[1] + p[1], H[2] + p[2]];
const eyeL = { side: 'L', at: at([2.15, -3.3, -0.4]), size: 1.0, yaw: 28, squash: 0.6 };
const eyeR = { side: 'R', at: at([-2.15, -3.3, -0.4]), size: 1.0, yaw: -28, squash: 0.6 };
const face = eyeKit({ eyes: [eyeL, eyeR], skin: SKIN });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [4.5, 1, 12.5] },
  { name: 'legR', parent: 'root', at: [-4.5, 1, 12.5] },
  { name: 'body', parent: 'root', at: [0, 0, 12.5] },
  { name: 'head', parent: 'body', at: [-0.6, -2.5, 25.5] },
  { name: 'pack', parent: 'body', at: [0, 9.6, 30] },
  { name: 'armL', parent: 'body', at: [7.8, 0.5, 24] },
  { name: 'armR', parent: 'body', at: [-7.8, 0.5, 24.8] },
  { name: 'foreL', parent: 'armL', at: [11.2, 1.5, 17.5] },
  { name: 'foreR', parent: 'armR', at: [-11.2, -0.5, 20.8] },
  { name: 'handL', parent: 'foreL', at: [10.4, -5.4, 15.6] },
  { name: 'handR', parent: 'foreR', at: [-14.0, -3.2, 23.6] },
  ...face.joints,
];

const parts = [
  ['body', blob([[[6.2, 5.0, 4.2], [0, 0.8, 14.5]], [[7.0, 5.6, 5.0], [0, 0.2, 20.5]], [[7.6, 5.0, 3.4], [0, 0.6, 24.2]]])],
  ['head', any(
    blob([[[3.3, 3.3, 2.7], at([0, 0.4, 0.7])], [[2.2, 2.9, 1.9], at([0, -3.6, -1.2])]]),
    ell([2.3, 3.0, 1.2], at([0, -2.0, -2.9])),
    ell([1.6, 1.4, 1.5], eyeL.at), ell([1.6, 1.4, 1.5], eyeR.at),
    spike(at([2.4, -0.2, 2.2]), [0.8, -1.0, 4.3], 0.95), spike(at([-2.4, -0.2, 2.2]), [-0.8, -1.0, 4.3], 0.95),
    limb(at([0, -5.0, 0.2]), at([-0.2, -7.2, 1.6]), 1.0, 0.7), limb(at([-0.2, -7.2, 1.6]), at([-0.5, -9.5, 3.1]), 0.7, 0.15),
    limb([-0.5, -1.5, 24.5], [-1.2, -5.2, 28.8], 3.0, 2.8))],
  ['armR', any(ell([3.3, 3.4, 3.2], [-7.8, 0.5, 24.8]), limb([-8, 0.5, 24.5], [-11.2, -0.5, 20.8], 2.4, 2.2))],
  ['foreR', any(ell([2.4, 2.4, 2.4], [-11.2, -0.5, 20.8]), limb([-11.2, -0.5, 20.8], [-14.0, -3.2, 23.6], 2.5, 2.8))],
  ['handR', ell([3.1, 3.0, 4.2], [-14.8, -4.4, 24.6])],
  ['armL', any(ell([3.3, 3.4, 3.2], [7.8, 0.5, 24]), limb([8, 0.5, 23.5], [11.2, 1.5, 17.5], 2.4, 2.3))],
  ['foreL', any(ell([2.4, 2.4, 2.4], [11.2, 1.5, 17.5]), limb([11.2, 1.5, 17.5], [10.4, -5.4, 15.6], 2.5, 2.7))],
  ['handL', ell([2.9, 3.0, 3.4], [10, -7.4, 15.3])],
  ['legL', any(ell([3.4, 3.4, 3.4], [4.5, 1, 12.5]), limb([4.5, 1, 12.5], [8.4, -2.5, 7.5], 4.0, 3.3), ell([2.8, 2.6, 2.8], [8.4, -2.8, 7.5]),
    limb([8.4, -2.5, 7.5], [10.0, -1.0, 2.6], 3.1, 2.5), limb([9.6, -0.6, 1.6], [14.3, -5.3, 1.2], 2.6, 1.6),
    spike([11.4, -0.6, 8.0], [1.4, 1.3, 0.5], 0.8))],
  ['legR', any(ell([3.4, 3.4, 3.4], [-4.5, 1, 12.5]), limb([-4.5, 1, 12.5], [-11.5, 0.5, 10.5], 4.0, 3.3), ell([2.8, 2.6, 2.8], [-11.5, 0.2, 10.5]),
    limb([-11.5, 0.5, 10.5], [-13.5, 0.5, 2.6], 3.1, 2.5), limb([-13.4, 1.05, 1.6], [-15.8, -5.5, 1.2], 2.6, 1.6),
    spike([-15.7, 2.4, 7.2], [-1.2, 1.6, 0.5], 0.8))],
];

function assign(c, rgb) {
  if (isAny(rgb, PACK)) return 'pack';
  if (isAny(rgb, SHELL)) return 'body';
  return pick(c, parts);
}

// the pack lags behind the body: a bounce in z and a little tip
const pack = (u, cycles, amp = 1, phase = 0.15) => ({ pack: { p: [0, 0, 0.25 * amp * (1 + osc(u, cycles, phase))], r: [3 * amp * osc(u, cycles, phase + 0.1), 0, 0] } });
const base = bipedClips({
  face, hipH: 12.5, stride: 14, guard: true, hopScale: 0.3, hopH: 2.5, droop: 0.6,
  punch: { arm: [-70, 0, 0], fore: [100, 0, 0] },
  add: {
    idle: (t, u) => pack(u, 2, 0.4),
    walk: (t, u) => pack(u, 2, 1.2),
    lunge: (t, u) => ({ pack: { r: [-8 * win(u, 0.3, 0.8, 0.1), 0, 0] } }),
    hurt: (t, u) => pack(u, 3, 1.5),
    celebrate: (t, u) => pack(u, 2, 2),
    enter: (t, u) => pack(u, 1, 1),
  },
});

const clips = {
  ...base,

  // fidget: it pulls its head back under the shell, eyes shut, then peeks out and looks about
  idle_tuck: {
    seconds: 2.8,
    pose: (t, u) => {
      const tuck = K(u, [[0, 0], [0.12, 1], [0.45, 1], [0.6, 0.35], [0.82, 0.35], [0.95, 0]]);
      const peek = win(u, 0.55, 0.88, 0.05);
      return {
        body: { r: [4 * tuck, 0, 0] },
        head: { p: [0, 3.2 * tuck, -2.2 * tuck], r: [0, 0, 18 * Math.sin(TAU * 2 * (u - 0.55)) * peek] },
        ...face.pose(tuck > 0.6 ? 'shut' : 'open', blinks(u, [[0.62, 0.66]])),
        ...both('arm', { r: [-6 * tuck, 0, 0] }),
      };
    },
  },

  // fidget: it hitches the backpack up with a shrug, the pack hops and settles
  idle_hitch: {
    seconds: 1.8,
    pose: (t, u) => {
      const s = win(u, 0.15, 0.4, 0.08);
      const hop = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.22) / 0.4))));
      return {
        body: { p: [0, 0, 0.6 * s], r: [-3 * s, 0, 0] },
        head: { p: [0, 0, -0.6 * s] },
        ...face.pose('open', blinks(u, [[0.5, 0.56]])),
        ...both('arm', { r: [0, -8 * s, 0] }),
        pack: { p: [0, 0, 1.6 * hop], r: [-6 * hop, 0, 4 * hop] },
      };
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
