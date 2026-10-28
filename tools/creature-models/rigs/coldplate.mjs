// Coldplate's rig: a squat bronze-and-ice golem, stone fists hanging low, a round helmet sunk in big shoulder pads.
// Numbers are scad/coldplate.scad's.
import { K, TAU, both, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, mx, pair, pick } from './lib/biped.mjs';

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [6, 0, 10]),
  { name: 'body', parent: 'root', at: [0, 0, 10] },
  { name: 'head', parent: 'body', at: [0, -4.2, 27.4] },
  ...pair('arm*', 'body', [15, 0, 24]),
  ...pair('fore*', 'arm*', [17.5, -0.6, 17.4]),
  ...pair('hand*', 'fore*', [18, -2.8, 9.5]),
];

const parts = [
  ['body', any(ell([13.5, 11, 12], [0, 0, 20]), ell([12, 9.8, 2.2], [0, 0, 10.5]),
    mx(ell([6.6, 6.6, 6], [12.5, 0, 27.5])), mx(ell([6.2, 6.4, 5.8], [12.8, -0.4, 28.2])))],
  ['head', any(ell([6.4, 6.2, 6.6], [0, -4.5, 31]), ell([6.9, 6.8, 1.5], [0, -4.2, 27.4]), ell([1, 5.4, 1], [0, -4.2, 36.9]))],
  ['arm*', limb([15, 0, 24], [17.5, -0.5, 18], 3.8, 3.4)],
  ['fore*', any(ell([3.8, 3.8, 2.2], [17.5, -0.6, 17.4]), blob([[[4.4, 4.2, 4], [18, -1.6, 14]], [[3.6, 3.6, 3], [18, -2.6, 10.5]]]))],
  ['hand*', any(blob([[[4.6, 4.6, 3.8], [18, -3, 7.5]], [[3.8, 3.8, 2.6], [18, -3.4, 5.2]]]), ell([2.6, 1.4, 1.2], [18, -7.2, 6.4]))],
  ['leg*', any(limb([6, 0, 10], [7.5, -1, 6.5], 4.2, 4), ell([2.8, 2, 2.6], [7.6, -4.6, 6.8]), limb([7.5, -1, 6.5], [7.8, -1, 2.5], 4, 4),
    blob([[[4.6, 5.8, 1.8], [7.8, -1.8, 1.8]]]))],
];

const base = bipedClips({
  hipH: 10, stride: 14, armSwing: 14, hopScale: 0.3,
  punch: { arm: [-80, 0, -10], fore: [-20, 0, 0] },
  cheer: { arm: [-20, -75, 0], fore: [-30, 0, 0] },
});

const clips = {
  ...base,

  // fidget: knocks its stone fists together twice in front of its chest, a little shake of ice on each clack
  idle_knock: {
    seconds: 2.2,
    pose: (t, u) => {
      const on = win(u, 0.08, 0.86, 0.12);
      const knock = win(u, 0.3, 0.4, 0.04) + win(u, 0.52, 0.62, 0.04);
      const sh = Math.sin(TAU * 10 * u) * (win(u, 0.36, 0.48, 0.03) + win(u, 0.58, 0.7, 0.03));
      return {
        body: { r: [3 * on, 0, 1.5 * sh] },
        head: { r: [8 * on, 0, 0] },
        ...both('arm', { r: [-42 * on, 0, (-14 - 10 * knock) * on] }),
        ...both('fore', { r: [-38 * on, 0, 0] }),
        ...both('hand', { r: [0, 0, 2 * sh] }),
      };
    },
  },

  // fidget: a cold shudder runs through the plating, the helmet rattles, then it settles with a huff
  idle_shiver: {
    seconds: 1.8,
    pose: (t, u) => {
      const sh = Math.sin(TAU * 12 * u) * win(u, 0.1, 0.6, 0.05);
      const huff = K(u, [[0, 0], [0.6, 0], [0.72, 1], [1, 0]]);
      return {
        body: { p: [0, 0, 0.3 * huff], r: [-3 * huff, 0, 1.6 * sh] },
        head: { r: [-6 * huff, 2 * sh, 3 * sh] },
        ...both('arm', { r: [0, -4 * win(u, 0.1, 0.6, 0.05) + 1.5 * sh, 0] }),
        ...both('fore', { r: [-6 * win(u, 0.1, 0.6, 0.05), 0, 0] }),
        ...both('hand', { r: [0, 0, 0] }),
      };
    },
  },
};

// ice panels on the torso just under the helmet rim stay on the torso
const assign = (c) => {
  const j = pick(c, parts);
  return j === 'head' && ell([13.5, 11, 12], [0, 0, 20])(c) < 1.08 ? 'body' : j;
};

export default rigDef({ joints, assign, clips });
