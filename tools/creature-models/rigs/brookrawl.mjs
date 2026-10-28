// Brookrawl's rig: a crouching stone turtle boxer in a top hat (its own joint), the right glove raised high, the left
// one guarding the belly, a plated shell on its back. Numbers are scad/brookrawl.scad's.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, pair, pick } from './lib/biped.mjs';
import { isAny } from './lib/geo.mjs';

const GLOVE = [[0.8, 0.12, 0.12], [0.95, 0.3, 0.25], [0.55, 0.06, 0.08]];
const HAT = [[0.15, 0.16, 0.22], [0.75, 0.1, 0.1]];
const GL_R = [-13.5, -9, 28];
const GL_L = [3, -12.5, 15.5];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [6, 0, 11]),
  { name: 'body', parent: 'root', at: [0, 0, 11] },
  { name: 'head', parent: 'body', at: [0, -3, 27] },
  { name: 'hat', parent: 'head', at: [0, -3.5, 33] },
  { name: 'armL', parent: 'body', at: [8.5, -1, 22] },
  { name: 'foreL', parent: 'armL', at: [10, -4, 16] },
  { name: 'handL', parent: 'foreL', at: GL_L },
  { name: 'armR', parent: 'body', at: [-8.5, -1, 24] },
  { name: 'foreR', parent: 'armR', at: [-12.5, -2, 20] },
  { name: 'handR', parent: 'foreR', at: GL_R },
  { name: 'tail1', parent: 'body', at: [0, 9, 9] },
];

const parts = [
  ['body', any(blob([[[10, 8.5, 9], [0, 0, 17]], [[8.5, 7.5, 6], [0, -0.5, 24]]]), ell([10.5, 7, 11], [0, 3.5, 18]), ell([11.5, 8.5, 12.5], [0, 3.5, 18]))],
  ['head', blob([[[4.6, 4.2, 3.6], [0, -4, 30]], [[3.4, 3, 2.6], [0, -6.8, 29]]])],
  ['armL', limb([8.5, -1, 22], [10, -4, 16], 3, 2.6)],
  ['foreL', limb([10, -4, 16], [5, -8, 15], 2.6, 2.4)],
  ['armR', limb([-8.5, -1, 24], [-12.5, -2, 20], 3, 2.6)],
  ['foreR', limb([-12.5, -2, 20], [-12, -6, 26], 2.6, 2.4)],
  ['leg*', any(limb([6, 0, 11], [10, -2, 6], 3.6, 3), limb([10, -2, 6], [9.5, -2, 1.6], 3, 2.6), ell([3.2, 3.2, 2.6], [9.5, -2, 6]),
    blob([[[3, 4, 1.4], [9.5, -4, 1.4]], [[2.6, 2, 1.3], [9.5, -1, 1.4]]]))],
  ['tail1', limb([0, 9, 9], [0, 13, 5], 2.2, 1)],
];

function assign(c, rgb) {
  if (isAny(rgb, GLOVE, 0.03)) return Math.hypot(...c.map((v, i) => v - GL_R[i])) < Math.hypot(...c.map((v, i) => v - GL_L[i])) ? 'handR' : 'handL';
  if (isAny(rgb, HAT, 0.03) && c[2] > 32.5) return 'hat';
  return pick(c, parts);
}

const base = bipedClips({
  hipH: 11, stride: 14, guard: true, hopScale: 0.5, droop: 0.7,
  punch: { arm: [-55, 0, 0], fore: [45, 0, 0] },
  cheer: { arm: [-35, -30, 0], fore: [-20, 0, 0] },
  add: {
    idle: (t, u) => ({ hat: { r: [1.5 * osc(u, 2, 0.3), 0, 0] } }),
    walk: (t, u) => ({ hat: { r: [3 * osc(u, 2, 0.2), 0, 2 * osc(u, 1)] } }),
    hurt: (t, u) => ({ hat: { p: [0, 0, 2.5 * Math.sin(Math.PI * u)], r: [-14 * Math.sin(Math.PI * u), 0, 10 * Math.sin(Math.PI * u)] } }),
    faint: (t, u) => ({ hat: { r: [0, 0, 0], p: [0, -2 * smooth((u - 0.4) / 0.4), -1 * smooth((u - 0.4) / 0.4)] } }),
    celebrate: (t, u) => ({ hat: { p: [0, 0, 3 * Math.abs(Math.sin(TAU * u))], r: [0, 0, 180 * smooth(u)] } }),
  },
});

const clips = {
  ...base,

  // fidget: the top hat pops off its head, spins a full turn in the air and lands back with a little squash
  idle_hat: {
    seconds: 2,
    pose: (t, u) => {
      const air = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.15) / 0.55))));
      const land = win(u, 0.7, 0.85, 0.03);
      return {
        body: { r: [-3 * air, 0, 0] },
        head: { r: [-12 * air + 6 * land, 0, 0] },
        hat: { p: [0, 0, 8 * air], r: [0, 0, 360 * smooth((u - 0.15) / 0.55)], s: [1, 1, 1 - 0.15 * land] },
        foreR: { r: [10 * air, 0, 0] },
      };
    },
  },

  // fidget: shadowboxing, two low jabs from the belly glove and a big cross from the high one
  idle_shadowbox: {
    seconds: 2.2,
    pose: (t, u) => {
      const jab = (u0) => win(u, u0, u0 + 0.12, 0.04);
      const j = jab(0.15) + jab(0.35);
      const cross = win(u, 0.55, 0.72, 0.05);
      const on = win(u, 0.06, 0.86, 0.08);
      return merge({
        root: { p: [0, 0, 0.4 * Math.abs(osc(u, 6)) * on] },
        body: { r: [4 * on, 0, 10 * j - 16 * cross] },
        head: { r: [3 * on, 0, -6 * j + 8 * cross] },
        armL: { r: [-30 * j, 0, 0] }, foreL: { r: [0, 0, 40 * j] },
        armR: { r: [-55 * cross, 0, 0] }, foreR: { r: [45 * cross, 0, 0] },
        hat: { r: [2 * osc(u, 6), 0, 0] },
      });
    },
  },
};

export default rigDef({ joints, assign, clips });
