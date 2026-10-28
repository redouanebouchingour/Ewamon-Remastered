// Acier's rig: a four-armed steel brawler. The lower pair (arm / fore / hand) hangs and swings the cleaver; the upper
// pair (arm2 / fore2 / hand2) holds two swords crossed overhead. Numbers are scad/acier.scad's.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blade, blob, ell, limb, mx, pair, pick } from './lib/biped.mjs';

// the swords as rig.mjs sees them: [hand, grip point, direction, blade length, width, grip length]
export const SWORDS = [
  ['hand2R', [-9.5, -2.5, 35.5], [0.6, 0.15, 1], 17, 2.4, 3],
  ['hand2L', [9.5, -2.5, 35.5], [0.5, 0.3, 1], 17, 2.4, 3],
  ['handR', [-11, -3, 12.5], [-0.12, -0.1, 1], 19, 4.4, 2.5],
  ['body', [5, 5.2, 14], [-0.35, 0.02, 1], 22, 3, 4],
];
/** The rest rotation that turns a joint's +Z along d (lib.scad _dir_rot), so rz spins a sword about its blade. */
export const dirRot = (d) => [0, (Math.acos(d[2] / Math.hypot(...d)) * 180) / Math.PI, (Math.atan2(d[1], d[0]) * 180) / Math.PI];

export const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [3.6, 0, 11]),
  { name: 'body', parent: 'root', at: [0, 0, 13.5] },
  { name: 'head', parent: 'body', at: [0, -0.8, 27.5] },
  ...pair('arm*', 'body', [5.5, 0.5, 21]),
  ...pair('fore*', 'arm*', [10.5, 0, 18.5]),
  ...pair('hand*', 'fore*', [11, -3, 12.5]),
  ...pair('arm2*', 'body', [7.5, 0, 26.5]),
  ...pair('fore2*', 'arm2*', [11, -1, 30]),
  { name: 'hand2L', parent: 'fore2L', at: [9.5, -2.5, 35.5], rot: dirRot(SWORDS[1][2]) },
  { name: 'hand2R', parent: 'fore2R', at: [-9.5, -2.5, 35.5], rot: dirRot(SWORDS[0][2]) },
];

export const swordParts = (swords) => swords.map(([j, p, d, l, w, g]) => [j, blade(p, d, g * 0.5 + l, w * 0.9, g)]);

export const parts = [
  ['body', any(blob([[[8, 5.5, 5], [0, 0, 24]], [[5, 4, 4], [0, 0, 17]]]), ell([5.4, 4.4, 1.3], [0, 0, 14.6]), ell([2.6, 1, 2.6], [0, -3.5, 12]),
    mx(ell([3.4, 3.4, 2.6], [7, 0, 26.5])))],
  ['head', blob([[[3.6, 3.6, 3.8], [0, -0.5, 31]], [[2.6, 2.6, 2], [0, -1.5, 28]]])],
  ['arm2*', limb([7.5, 0, 26.5], [11, -1, 30], 2.9, 2.6)],
  ['fore2*', any(ell([3, 3, 3], [11, -1, 30]), limb([11, -1, 30], [9.5, -2, 35], 2.5, 2.3))],
  ['hand2*', ell([2.5, 2.5, 2.5], [9.5, -2.5, 35.5])],
  ['arm*', limb([5.5, 0.5, 21], [10, 0, 19], 2.6, 2.4)],
  ['fore*', any(ell([2.8, 2.8, 2.8], [10.5, 0, 18.5]), limb([10.5, 0, 18.5], [11, -2.5, 13], 2.3, 2.2))],
  ['hand*', ell([2.4, 2.4, 2.4], [11, -3, 12.5])],
  ['leg*', any(ell([2.8, 2.8, 3.2], [3.6, 0, 11]), ell([1.8, 1.8, 1.4], [4.4, -1, 8]), limb([4.4, -0.5, 7.5], [5, 0, 3], 2.2, 2.3),
    blob([[[2.6, 3.4, 1.5], [5, -1.2, 1.5]], [[2.2, 2, 1.4], [5, 1, 1.5]]]))],
  ...swordParts(SWORDS),
];

// upper swords: a chop forward on the hit, raised back on the windup
export const upper = {
  idle: (t, u) => both('arm2', { r: [2 * osc(u, 2, 0.1), -2 * osc(u, 1, 0.3), 0] }),
  walk: (t, u) => both('arm2', { r: [3 * osc(u, 1), 0, 0] }, { r: [-3 * osc(u, 1), 0, 0] }),
  windup: (t, u) => { const w = smooth(u / 0.8); return { ...both('arm2', { r: [-18 * w, -6 * w, 0] }), ...both('fore2', { r: [-10 * w, 0, 0] }) }; },
  lunge: (t, u) => {
    const hit = K(u, [[0.1, 0], [0.4, 1], [0.65, 1], [1, 0]]);
    return { ...both('arm2', { r: [-18 * K(u, [[0, 1], [0.1, 1], [0.3, 0]]) + 55 * hit, 8 * hit, 0] }), ...both('fore2', { r: [35 * hit, 0, 0] }) };
  },
  hurt: (t, u) => { const k = K(u, [[0, 0], [0.18, 1], [1, 0.45]]); return both('arm2', { r: [-12 * k, -14 * k, 0] }); },
  faint: (t, u) => { const d = smooth((u - 0.18) / 0.55); return { ...both('arm2', { r: [30 * d, 20 * d, 0] }), ...both('fore2', { r: [40 * d, 0, 0] }) }; },
  celebrate: (t, u) => { const up = win(u, 0, 1, 0.15); const p = Math.sin(TAU * 2 * u); return { ...both('arm2', { r: [-10 * up, -10 * up + 8 * p, 0] }), ...both('hand2', { r: [0, 0, 360 * smooth(u)] }) }; },
  enter: (t, u) => { const over = win(u, 0.45, 0.9, 0.12); return both('arm2', { r: [-10 * over, -12 * over, 0] }); },
};

export const clipsFor = ({ parts: _p, extra = {} } = {}) => {
  const base = bipedClips({
    hipH: 11, stride: 18, armSwing: 14, hopScale: 0.4, arms2: 0.3,
    punch: { arm: [-70, -10, 0], fore: [-20, 0, 0] },
    cheer: { arm: [0, -60, 0], fore: [-50, 0, 0] },
    add: Object.fromEntries([...new Set([...Object.keys(upper), ...Object.keys(extra)])].map((k) => [k, (t, u) => merge(upper[k]?.(t, u), extra[k]?.(t, u))])),
  });
  return {
    ...base,

    // fidget: both overhead swords spin a full turn about their blades, the lower fists flex
    idle_flourish: {
      seconds: 2.4,
      pose: (t, u) => {
        const on = win(u, 0.05, 0.9, 0.1);
        const spin = 360 * smooth((u - 0.15) / 0.6);
        return {
          body: { r: [-3 * on, 0, 4 * osc(u, 1)] },
          head: { r: [-6 * on, 0, 10 * osc(u, 1)] },
          ...both('arm2', { r: [-6 * on, -8 * on, 0] }),
          hand2L: { r: [0, 0, spin] }, hand2R: { r: [0, 0, -spin] },
          ...both('fore', { r: [-70 * on, 0, 0] }),
          ...both('arm', { r: [0, -25 * on, 0] }),
        };
      },
    },

    // fidget: the two upper blades clang together over the helm, a shudder, then apart
    idle_clang: {
      seconds: 1.8,
      pose: (t, u) => {
        const hit = K(u, [[0, 0], [0.25, 0], [0.38, 1], [0.6, 1], [0.8, 0]]);
        const sh = u > 0.38 ? Math.sin(TAU * 8 * (u - 0.38)) * Math.max(0, 1 - (u - 0.38) / 0.3) : 0;
        return {
          body: { r: [0, 0, 0] },
          head: { r: [-12 * hit, 0, 0] },
          ...both('arm2', { r: [0, 14 * hit + 2 * sh, 0] }),
          ...both('fore2', { r: [0, 10 * hit, 0] }),
          ...both('fore', { r: [-10 * hit, 0, 0] }),
        };
      },
    },
  };
};

export default rigDef({ joints, assign: (c) => pick(c, parts), clips: clipsFor() });
