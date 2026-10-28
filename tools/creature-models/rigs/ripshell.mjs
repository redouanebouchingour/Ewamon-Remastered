// Ripshell's rig: a hulking turtle brawler, huge armoured fists up in guard, a broad gold shell on the body and a
// leather backpack (`pack`, off the body) that bounces on top. Numbers are scad/ripshell.scad's.
import { K, TAU, both, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, mx, pair, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near } from './lib/geo.mjs';

const TEAL = [0.18, 0.55, 0.5];
const SHELL = [[0.85, 0.65, 0.18], [0.62, 0.43, 0.1]];
const LEATHER = [[0.45, 0.28, 0.14], [0.3, 0.18, 0.09]];
const PLASTRON = [0.72, 0.62, 0.22];

const eye = { side: 'L', at: [2.3, -8.7, 29.3], size: 1.9, yaw: 30, squash: 0.6 };
const face = eyeKit({ eyes: [eye, mirrorEye(eye)], skin: TEAL });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [5.5, 0, 11]),
  { name: 'body', parent: 'root', at: [0, 0, 12] },
  { name: 'head', parent: 'body', at: [0, -3, 26] },
  { name: 'pack', parent: 'body', at: [0, 9, 26] },
  ...pair('arm*', 'body', [9, -1, 24]),
  ...pair('fore*', 'arm*', [11.5, -4.5, 16.5]),
  ...pair('hand*', 'fore*', [11, -7, 22]),
  ...face.joints,
];

const parts = [
  ['body', blob([[[7.5, 6, 6], [0, 0, 16]], [[8.5, 6.5, 6], [0, 0, 22]]])],
  ['head', any(blob([[[4.5, 4.5, 4], [0, -3, 29]], [[3.5, 3.5, 3], [0, -6.5, 28]]]), mx(spike([2.8, -2, 32], [1.8, 0.5, 5], 1.2)),
    spike([0, -7.5, 30], [0, -1.5, 2.5], 0.8), mx(ell([2.4, 1.6, 2.2], [2.3, -8.4, 29.5])))],
  ['arm*', any(ell([3.4, 3.4, 3.4], [9, -1, 24]), limb([9.5, -1, 23], [11.5, -4, 17], 2.6, 2.4))],
  ['fore*', any(ell([3, 3.2, 3], [11.5, -4.5, 16.5]), limb([11.5, -4.5, 16.5], [11, -7, 22], 2.4, 2.4))],
  ['hand*', any(blob([[[3.4, 3.2, 3.6], [11, -8, 24]], [[2.6, 2.6, 2.8], [11, -9, 26]]]), ell([2.6, 0.5, 0.5], [11, -11.1, 25.6]))],
  ['leg*', any(ell([3.6, 3.8, 4], [5.5, 0, 11]), limb([5.5, 0, 11], [8, -1, 5], 3.2, 2.6), ell([3, 3, 2.4], [8, -1, 5]),
    blob([[[3, 4.2, 1.6], [8.5, -2.5, 1.6]], [[2.6, 2.4, 1.6], [8.5, 0.5, 1.6]]]), spike([8.5, -6.2, 1], [0, -1.3, -0.4], 0.5), spike([10.5, 0, 8], [1.6, 0, 0.8], 0.6))],
];

function assign(c, rgb) {
  if (isAny(rgb, LEATHER)) return 'pack';
  if (isAny(rgb, SHELL)) return 'body';
  if (near(rgb, PLASTRON)) return c[2] > 25.5 && c[1] < -6 ? 'head' : 'body';
  return pick(c, parts);
}

// the pack lags behind the body: a bounce in z and a little tip
const pack = (u, cycles, amp = 1, phase = 0.15) => ({ pack: { p: [0, 0, 0.25 * amp * (1 + osc(u, cycles, phase))], r: [3 * amp * osc(u, cycles, phase + 0.1), 0, 0] } });
const base = bipedClips({
  face, hipH: 11, stride: 14, guard: true, hopScale: 0.3, hopH: 2.5, droop: 0.6,
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

  // fidget: it pulls its head back into the shell, eyes shut, then peeks out and looks about
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
