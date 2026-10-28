// Chrysotox's rig: a hulking bark-and-shard golem, its small head sunk between spiked shoulders, huge clawed arms
// hanging to the ground. The chin and its shard beard drop as a jaw. Numbers are scad/chrysotox.scad's.
import { K, TAU, both, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, mx, pair, pick } from './lib/biped.mjs';

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [6, 0, 13]),
  { name: 'body', parent: 'root', at: [0, 0.5, 13] },
  { name: 'head', parent: 'body', at: [0, -4, 30] },
  { name: 'jaw', parent: 'head', at: [0, -6.5, 28.6] },
  ...pair('arm*', 'body', [13, 0, 27]),
  ...pair('fore*', 'arm*', [18.5, -1, 18]),
  ...pair('hand*', 'fore*', [20, -3, 7]),
];

const parts = [
  ['body', any(blob([[[12, 9, 7], [0, 0, 25]], [[7.5, 6.5, 5], [0, 0.5, 15]]]), ell([5, 2.6, 4], [0, -6.8, 21.5]), mx(ell([7, 6.5, 5.5], [12.5, 0.5, 28.5])))],
  ['head', any(blob([[[5.4, 4.8, 4.4], [0, -6, 32]], [[4.6, 4, 3], [0, -8, 29.5]]]), ell([5.8, 1.8, 1.3], [0, -10, 33]))],
  ['arm*', limb([13, 0, 27], [18.5, -1, 18], 3.8, 3.4)],
  ['fore*', any(blob([[[4.6, 4.6, 4], [19, -1.5, 15]], [[4.2, 4.2, 3.5], [20, -3, 8]]]), ell([2.4, 2.6, 4], [18.6, -4.6, 11]))],
  ['hand*', any(ell([3.8, 3.6, 3], [20.2, -3.8, 4.8]), limb([20.2, -6, 4.4], [20.2, -8, 2.4], 1.6, 1.2))],
  ['leg*', any(limb([6, 0, 13], [7, -0.5, 3], 4.6, 4.2), blob([[[4.6, 5.2, 2.2], [7, -1.5, 2.2]], [[3.6, 3, 2], [7, 1.5, 2]]]))],
];

const assign = (c) => {
  const j = pick(c, parts);
  // the chin under the maw and the hanging shard beard
  if (j === 'head' && c[1] < -7 && c[2] < 28.3) return 'jaw';
  return j;
};

const base = bipedClips({
  hipH: 13, stride: 12, armSwing: 9, hopScale: 0,
  punch: { arm: [-70, 0, -20], fore: [-30, 0, 0] },
  cheer: { arm: [-10, -90, 0], fore: [-20, 0, 0] },
  add: {
    // the arms are long: the template's hanging-arm idle lifts them a touch more so the claws clear the ground
    idle: (t, u) => both('hand', { r: [-3 * osc(u, 2, 0.3), 0, 0] }),
    walk: (t, u) => both('hand', { r: [-6, 0, 0] }),
  },
});

const clips = {
  ...base,

  // fidget: a toxic exhale. The chest heaves, the head tips back, the jaw hangs open, then it slumps with a shudder
  idle_exhale: {
    seconds: 2.8,
    pose: (t, u) => {
      const inh = K(u, [[0, 0], [0.3, 1], [0.45, 1], [0.7, 0]]);
      const out = win(u, 0.42, 0.75, 0.08);
      const sh = Math.sin(TAU * 9 * u) * win(u, 0.72, 0.9, 0.04);
      return {
        body: { p: [0, 0, 0.5 * inh], r: [-6 * inh + 4 * out, 0, sh], s: [1 + 0.03 * inh, 1 + 0.04 * inh, 1] },
        head: { r: [-14 * inh + 6 * out, 0, 0] },
        jaw: { r: [22 * out, 0, 0] },
        ...both('arm', { r: [4 * out, -6 * inh, 0] }),
        ...both('fore', { r: [-6 * inh, 0, 0] }),
      };
    },
  },

  // fidget: rakes one great claw along the ground beside it, head turned to watch the furrow
  idle_rake: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = win(u, 0.08, 0.88, 0.12);
      const rake = K(u, [[0, 0], [0.2, -1], [0.62, 1], [0.85, 0]]);
      return {
        body: { r: [4 * on, 0, -8 * on] },
        head: { r: [10 * on, 0, 22 * on] },
        armL: { r: [-18 * rake, -12 * on, 0] },
        foreL: { r: [-10 * on, 0, 0] },
        handL: { r: [-14 * on + 10 * smooth((u - 0.2) / 0.4) * on, 0, 0] },
        jaw: { r: [6 * on, 0, 0] },
      };
    },
  },
};

export default rigDef({ joints, assign, clips });
