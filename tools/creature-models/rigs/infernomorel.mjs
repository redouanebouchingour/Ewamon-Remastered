// Infernomorel's rig: a hunched charcoal brute under a broad smouldering cap. Short bowed legs, heavy arms hanging
// forward to huge claws, and the crown of fire on the cap (the `flame` joint) flickering and flaring; it only ever grows
// (a flame smaller than at rest would open the cap's hidden top). Numbers are scad/infernomorel.scad's (the Majin form
// imports the pieces).
import { K, TAU, both, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, pair, pick } from './lib/biped.mjs';
import { isAny, subFrame } from './lib/geo.mjs';

export const CAP = subFrame([0, 1, 30], [-6, 0, 0]);
export const FLAMES = [[0.93, 0.22, 0.05], [1, 0.55, 0.08], [1, 0.88, 0.35]];

export const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [5, 0, 9]),
  { name: 'body', parent: 'root', at: [0, 0, 9] },
  { name: 'head', parent: 'body', at: [0, -1, 23] },
  { name: 'cap', parent: 'head', at: CAP.world([0, 0, 0]), rot: [-6, 0, 0] },
  { name: 'flame', parent: 'cap', at: CAP.world([0, 0, 3.5]), rot: [-6, 0, 0] },
  ...pair('arm*', 'body', [10, 0, 21]),
  ...pair('fore*', 'arm*', [13.5, -2.5, 14]),
  ...pair('hand*', 'fore*', [15, -5, 9]),
];

// the cap's parts, tested in its own (tilted) frame
const capD = (c) => { const q = CAP.local(c); return Math.min(ell([17, 15.5, 5])(q), ell([16, 14.5, 1.6], [0, 0, -0.6])(q)); };

export const parts = [
  ['body', any(blob([[[8, 7, 6], [0, 0, 10]], [[11.5, 8, 7], [0, 0.5, 19]]]), ell([5.6, 1.5, 3.8], [0, -6.6, 15.5]))],
  ['head', blob([[[7.5, 6.5, 5.5], [0, -3.5, 25.5]], [[6.5, 6, 4], [0, -1, 28]]])],
  ['cap', capD],
  ['arm*', limb([10, 0, 21], [13.5, -2.5, 14], 3.4, 3)],
  ['fore*', limb([13.5, -2.5, 14], [15, -5, 9], 3, 3.4)],
  ['hand*', any(ell([4.4, 4, 3.6], [15.5, -6, 8]), limb([15.5, -8.5, 7], [15.5, -11, 4], 3.2, 1.6), limb([17.5, -3, 15], [19.5, -5, 9], 1.2, 0.8))],
  ['leg*', any(limb([5, 0, 9], [7.5, -1, 4], 3.6, 3.2), blob([[[3.2, 4.4, 2], [7.8, -2, 2]], [[3, 3, 2], [7.8, 0.5, 2.2]]]), limb([7.8, -6.2, 1.2], [7.8, -7.6, 0.7], 2.4, 1))],
];

export function assign(c, rgb) {
  if (isAny(rgb, FLAMES) && CAP.local(c)[2] > 2) return 'flame';
  return pick(c, parts);
}

/** The crown of fire: scales of 1 and up only, whole cycles per clip so loops close. */
export const fire = (u, k = 1, cyc = [3, 7, 11]) => {
  const f = (a, b) => 0.5 + 0.5 * Math.sin(TAU * (a * u) + b);
  return { flame: { s: [1 + 0.04 * k * f(cyc[0], 0.3), 1 + 0.04 * k * f(cyc[1], 1.1), 1 + k * (0.06 * f(cyc[0], 0) + 0.05 * f(cyc[1], 2) + 0.03 * f(cyc[2], 4))] } };
};

export const add = {
  idle: (t, u) => ({ ...fire(u, 1, [6, 14, 22]), cap: { r: [0.8 * osc(u, 2, 0.1), 0, 0] } }),
  walk: (t, u) => ({ ...fire(u, 1.2, [1, 2, 3]), cap: { r: [-2 + 1.5 * osc(u, 2, 0.2), 0, 1.5 * osc(u, 1, 0.3)] } }),
  idle_look: (t, u) => fire(u, 1, [3, 7, 11]),
  windup: (t, u) => fire(u, 1.5 + 2 * smooth(u)),
  lunge: (t, u) => ({ ...fire(u, 2 + 2.5 * K(u, [[0, 0], [0.4, 1], [1, 0.3]]), [1, 2, 3]), cap: { r: [-6 * K(u, [[0.1, 0], [0.4, 1], [1, 0]]), 0, 0] } }),
  hurt: (t, u) => ({ ...fire(u, 2, [2, 3, 5]), cap: { r: [8 * K(u, [[0, 0], [0.2, 1], [1, 0.3]]), 0, 0] } }),
  // the cap is wide: the head droops less than the template's so it does not plough into the ground
  faint: (t, u) => ({ ...fire(u, 1.4 * (1 - smooth(u)), [2, 4, 6]), head: { r: [-16 * smooth((u - 0.18) / 0.55), 0, 0] } }),
  celebrate: (t, u) => ({ ...fire(u, 4 * win(u, 0, 1, 0.15), [2, 4, 6]), cap: { r: [0, 0, 4 * osc(u, 2)] } }),
  enter: (t, u) => ({ ...fire(u, 4 * win(u, 0.35, 0.95, 0.15), [1, 2, 3]), head: { r: [-10 * (1 - smooth((u - 0.2) / 0.35)), 0, 0] } }),
};

export const baseClips = (o = {}) => bipedClips({
  hipH: 9, stride: 15, armSwing: 12, hopScale: 0.25, hopH: 2.5,
  punch: { arm: [-62, 6, 0], fore: [-24, 0, 0] },
  cheer: { arm: [-8, -50, 0], fore: [-6, -20, 0] },
  add,
  ...o,
});

export const fidgets = {
  // fidget: it stokes its crown: head ducks, the fire roars up tall, then it shakes out the sparks
  idle_stoke: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.6, 1], [0.8, 0]]);
      const shk = Math.sin(TAU * 8 * u) * win(u, 0.62, 0.9, 0.04);
      return {
        body: { r: [6 * on, 0, 0] },
        head: { r: [10 * on, 0, 4 * shk] },
        cap: { r: [0, 3 * shk, 0] },
        ...fire(u, 1 + 5 * on, [4, 9, 13]),
        ...both('arm', { r: [-6 * on, -10 * on, 0] }),
        ...both('fore', { r: [-14 * on, 0, 0] }),
      };
    },
  },
  // fidget: flexes the claws open and shut one hand after the other, eyeing them
  idle_claws: {
    seconds: 2,
    pose: (t, u) => {
      const a = win(u, 0.1, 0.45, 0.08);
      const b = win(u, 0.45, 0.8, 0.08);
      return {
        head: { r: [8 * (a + b), 0, 14 * a - 14 * b] },
        armL: { r: [-30 * a, 0, 0] }, foreL: { r: [-40 * a, 0, 0] }, handL: { r: [-20 * a + 15 * a * osc(u, 6), 0, 0] },
        armR: { r: [-30 * b, 0, 0] }, foreR: { r: [-40 * b, 0, 0] }, handR: { r: [-20 * b + 15 * b * osc(u, 6), 0, 0] },
        ...fire(u, 1, [4, 8, 12]),
      };
    },
  },
};

export default rigDef({ joints, assign, clips: { ...baseClips(), ...fidgets } });
