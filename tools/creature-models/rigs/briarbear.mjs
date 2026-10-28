// Briarbear's rig: a hulking moss bear, head low and forward, heavy arms ending in bark gauntlets near the ground,
// bark pauldrons on the body and a vine tail ending in a berry bud. Numbers are scad/briarbear.scad's.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, mx, pair, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye, blinks } from './lib/face.mjs';

const GREEN = [0.16, 0.42, 0.18];
const TAIL = [[3, 8, 8], [9, 12, 6], [15, 12, 7], [18, 9, 10], [18, 7, 14]];
const tails = ['tail1', 'tail2', 'tail3', 'tail4'];

const eyeL = { side: 'L', at: [3.4, -9.8, 28.6], size: 1.5, yaw: -22 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: GREEN });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [6.5, 0, 6]),
  { name: 'body', parent: 'root', at: [0, 0, 6] },
  { name: 'head', parent: 'body', at: [0, -3, 22.5] },
  ...pair('ear*', 'head', [5.5, -2, 33]),
  ...pair('arm*', 'body', [12, -1, 18]),
  ...pair('hand*', 'arm*', [13.6, -4.5, 9]),
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[1] },
  { name: 'tail3', parent: 'tail2', at: TAIL[2] },
  { name: 'tail4', parent: 'tail3', at: TAIL[3] },
  ...face.joints,
];

const parts = [
  ['body', any(blob([[[11, 9, 8], [0, 0.5, 10]], [[11.5, 9, 7.5], [0, 0, 18]]]), ell([7, 3.4, 7], [0, -7.2, 12]), ell([10.5, 5, 3.4], [0, 4.5, 21]),
    mx(ell([6, 7.5, 4.5], [11, 0, 21])), ell([9, 8.5, 3.5], [0, -1, 24.5]), ell([4, 1.5, 4.5], [0, -9, 19]))],
  ['head', any(blob([[[7.5, 6.8, 6.5], [0, -4, 27]], [[6, 6, 5], [0, -2, 30]]]), ell([5, 4.5, 3], [0, -0.5, 32.5]),
    blob([[[4.6, 3.2, 3], [0, -9.5, 25]], [[3.2, 3, 2.4], [0, -11, 26]]]), ell([5, 2, 5], [0, 5, 27]))],
  ['ear*', ell([2.4, 1.4, 2.4], [5.5, -2, 34])],
  ['arm*', limb([12, -1, 18], [13.5, -4, 10], 3.6, 3.4)],
  ['hand*', blob([[[3.9, 4, 3], [13.6, -4.5, 9]], [[3.5, 3.5, 2.5], [13.8, -5, 5.5]]])],
  ['leg*', any(ell([4.5, 4.8, 5], [6.5, 0, 5.5]), blob([[[3.8, 4.5, 2], [6.8, -1.5, 2]], [[3.6, 3.6, 2.4], [6.8, 0.5, 3]]]))],
  ...chain(tails, TAIL, [1.5, 1.3, 1.1, 1, 0.9]),
  ['tail4', any(ell([2.6, 2.6, 2.8], [18, 7, 16.5]), ell([1.4, 1.4, 1.1], [18, 6.6, 19]))],
];

const base = bipedClips({
  face, tail: tails, hipH: 6, stride: 16, armSwing: 12, hopScale: 0, droop: 0.6,
  punch: { arm: [-75, 0, 0], fore: [0, 0, 0] },
  cheer: { arm: [-20, -95, 0], fore: [0, 0, 0] },
  add: {
    walk: (t, u) => ({ body: { r: [0, 0, -3 * osc(u, 1)] } }),
    lunge: (t, u) => ({ handR: { r: [-20 * win(u, 0.25, 0.7, 0.1), 0, 0] } }),
  },
});

const clips = {
  ...base,

  // fidget: it lifts its muzzle and sniffs the air in quick little bobs, then closes its eyes, content
  idle_sniff: {
    seconds: 2.6,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.18, 1], [0.8, 1], [0.95, 0]]);
      const sniff = Math.max(0, Math.sin(TAU * 10 * u)) * win(u, 0.2, 0.5, 0.04);
      const content = win(u, 0.55, 0.85, 0.06);
      return {
        body: { r: [-4 * up, 0, 0] },
        head: { r: [-16 * up - 3 * sniff, 0, 6 * content] },
        ...(content > 0.3 ? face.pose('happy') : face.pose('open', blinks(u, [[0.12, 0.16]]))),
        ...both('ear', { r: [-10 * up, 0, 0] }),
      };
    },
  },

  // fidget: a big stretch, the gauntlets swing wide, the back arches, then it settles with a shake of the shoulders
  idle_stretch: {
    seconds: 3,
    pose: (t, u) => {
      const st = K(u, [[0, 0], [0.3, 1], [0.6, 1], [0.75, 0]]);
      const sh = Math.sin(TAU * 8 * u) * win(u, 0.75, 0.97, 0.04);
      return merge({
        body: { r: [-10 * st, 4 * sh, 0], p: [0, 0, 0.5 * st] },
        head: { r: [-14 * st, 0, 0] },
        ...face.pose(st > 0.5 ? 'shut' : 'open', st * 2),
        ...both('arm', { r: [-25 * st, -40 * st, 0] }),
        ...both('ear', { r: [0, -6 * sh, 0] }),
      }, Object.fromEntries(tails.map((n, i) => [n, { r: [-8 * st * (1 + 0.3 * i), 0, 0] }])));
    },
  },
};

export default rigDef({ joints, assign: (c) => pick(c, parts), extras: face.extras, clips });
