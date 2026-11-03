// Acier's rig: a four-armed iron warrior, one sword per fist (the 2026-11-03 sprite). The lower pair (arm / fore /
// hand) holds sword C (R, -X, blade up) and sword D (L, +X, point-down); the upper pair (arm2 / fore2 / hand2) holds
// sword A (R) and sword B (L) raised. The arms are posed differently per side, so each joint has its own numbers.
// Numbers are scad/acier.scad's; the swords are flat parts in pp(d) at their fist's depth, tested in that frame.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, inFrame, limb, mx, pick, ppFrame, spike } from './lib/biped.mjs';
import { subFrame } from './lib/geo.mjs';

const dOf = (p) => -0.5 * p[0] + 0.866 * p[1];
// scad direction of a sheet direction inside pp()
const ppDir = ([dx, dz]) => [dx * 0.866, dx * 0.5, dz];
/** The rest rotation that turns a joint's +Z along d (lib.scad _dir_rot), so rz spins a sword about its blade. */
export const dirRot = (d) => [0, (Math.acos(d[2] / Math.hypot(...d)) * 180) / Math.PI, (Math.atan2(d[1], d[0]) * 180) / Math.PI];

const H = [0.4, -2.2, 22.3];
const SH2 = [5.5, 0.5, 20.8];
const SH1 = [5.4, -0.3, 16.2];
const E2R = [-8.78, 0, 23]; const F2R = [-8.78, -1, 28.3];
const E2L = [10.28, 0.8, 21.8]; const F2L = [12.88, 1.5, 25.6];
const E1R = [-7.16, -0.8, 11.9]; const F1R = [-11.66, -2, 11.6];
const E1L = [9.93, 0.8, 13.4]; const W1L = [15.94, 1.6, 14.8]; const F1L = [17.78, 2, 17.8];
const R = (p) => [-p[0], p[1], p[2]];

export const joints = [
  { name: 'root', at: [0, 0, 4.3] },
  { name: 'legL', parent: 'root', at: [2.6, 0.2, 10.8] },
  { name: 'legR', parent: 'root', at: [-2.6, 0.2, 10.8] },
  { name: 'body', parent: 'root', at: [0, 0, 12] },
  { name: 'head', parent: 'body', at: [0.1, -0.7, 19.4] },
  { name: 'armL', parent: 'body', at: SH1 },
  { name: 'foreL', parent: 'armL', at: E1L },
  { name: 'handL', parent: 'foreL', at: F1L, rot: dirRot(ppDir([-5.3, -17.4])) },
  { name: 'armR', parent: 'body', at: R(SH1) },
  { name: 'foreR', parent: 'armR', at: E1R },
  { name: 'handR', parent: 'foreR', at: F1R, rot: dirRot(ppDir([-6.9, 21])) },
  { name: 'arm2L', parent: 'body', at: SH2 },
  { name: 'fore2L', parent: 'arm2L', at: E2L },
  { name: 'hand2L', parent: 'fore2L', at: F2L, rot: dirRot(ppDir([-1.5, 11.6])) },
  { name: 'arm2R', parent: 'body', at: R(SH2) },
  { name: 'fore2R', parent: 'arm2R', at: E2R },
  { name: 'hand2R', parent: 'fore2R', at: F2R, rot: dirRot(ppDir([5.7, 9.6])) },
];

// a rod / blade between two sheet points inside pp(d)
const ppRod = (d, a, b, r) => inFrame(ppFrame(d), limb([a[0], 0, a[1]], [b[0], 0, b[1]], r));

export const parts = [
  ['body', any(blob([[[5.9, 3.8, 3.3], [0, 0, 18.2]], [[3.8, 3, 2.2], [0, 0.2, 14.4]]]), ell([4.3, 3.6, 2.4], [0, 0.2, 12]),
    mx(ell([2.45, 2.4, 2.25], SH2)), mx(ell([2.4, 2.4, 2.2], SH1)))],
  ['head', any(limb([0, -0.6, 19.2], [0.3, -1.8, 21], 1.5, 1.4),
    inFrame(subFrame(H, [0, 0, 30]), any(ell([2.3, 2.2, 2.6], [0, 0.2, 0]), ell([2.4, 1.6, 1.4], [1.7, 0.3, 3]),
      ell([1.15, 0.6, 1.4], [1, -1.6, -0.2]), ell([1, 0.9, 0.8], [0.85, -1.3, -2.3]))))],
  // upper arms
  ['arm2R', limb(R(SH2), E2R, 1.95, 1.79)],
  ['fore2R', any(ell([1.99, 1.99, 1.99], E2R), limb(E2R, F2R, 1.8, 1.71))],
  ['hand2R', any(ell([1.55, 1.55, 1.55], F2R), ppRod(dOf(F2R), [-7.6, 29], [-1.9, 38.6], 1.3),
    ppRod(dOf(F2R), [-7.7, 28.9], [-10.3, 24.8], 0.6), ppRod(dOf(F2R), [-10.2, 24.8], [-10, 19.3], 1.2))],
  ['arm2L', limb(SH2, E2L, 1.95, 1.79)],
  ['fore2L', any(ell([1.99, 1.99, 1.99], E2L), limb(E2L, F2L, 1.75, 1.66))],
  ['hand2L', any(ell([1.55, 1.55, 1.55], F2L), ppRod(dOf(F2L), [10.6, 28], [10.2, 38.5], 2.3),
    ppRod(dOf(F2L), [11.1, 28.4], [13, 21], 0.7), ppRod(dOf(F2L), [11.8, 36], [14.6, 29.5], 0.6), ppRod(dOf(F2L), [14.6, 29.5], [12.8, 23.4], 0.6))],
  // lower arms
  ['armR', limb(R(SH1), E1R, 1.9, 1.75)],
  ['foreR', any(ell([1.94, 1.94, 1.94], E1R), limb(E1R, F1R, 1.65, 1.57))],
  ['handR', any(ell([1.6, 1.6, 1.6], F1R), ppRod(dOf(F1R), [-12.6, 15.5], [-16.2, 27], 2.3),
    ppRod(dOf(F1R), [-15.1, 12.05], [-8.4, 15.2], 0.7), ppRod(dOf(F1R), [-11.8, 13.7], [-9.4, 6.8], 0.8))],
  ['armL', limb(SH1, E1L, 1.9, 1.75)],
  ['foreL', any(ell([1.85, 1.85, 1.85], E1L), limb(E1L, W1L, 1.7, 1.5), limb(W1L, F1L, 1.3, 1.3))],
  ['handL', any(ell([1.6, 1.6, 1.6], F1L), ppRod(dOf(F1L), [15.6, 15.4], [12.6, 5], 1.6),
    ppRod(dOf(F1L), [13.8, 16], [17.6, 16], 1), ppRod(dOf(F1L), [16.3, 17], [17.7, 21.8], 0.7))],
  // legs
  ['leg*', any(limb([2.6, 0.2, 10.8], [4.9, -0.3, 8.3], 1.8, 1.55), ell([1.65, 1.65, 0.65], [4.9, -0.3, 8.3]),
    limb([4.9, -0.3, 8.3], [5.6, -0.3, 6.4], 1.55, 1.65), ell([1.7, 1.7, 0.45], [5.3, -0.3, 7.1]),
    blob([[[1.85, 1.9, 1.1], [5.6, -0.2, 5.4]], [[1.4, 1.6, 0.9], [6, -1.2, 5.2]]]),
    spike([5.7, -1.95, 4.95], [1.1, -1.2, -0.25], 0.55), spike([6.7, -2.45, 4.95], [1.1, -1.2, -0.25], 0.55))],
];

// upper swords: a chop forward on the hit, raised back on the windup
export const upper = {
  idle: (t, u) => both('arm2', { r: [2 * osc(u, 2, 0.1), -2 * osc(u, 1, 0.3), 0] }),
  walk: (t, u) => both('arm2', { r: [3 * osc(u, 1), 0, 0] }, { r: [-3 * osc(u, 1), 0, 0] }),
  windup: (t, u) => { const w = smooth(u / 0.8); return { ...both('arm2', { r: [18 * w, -6 * w, 0] }), ...both('fore2', { r: [10 * w, 0, 0] }) }; },
  lunge: (t, u) => {
    const hit = K(u, [[0.1, 0], [0.4, 1], [0.65, 1], [1, 0]]);
    return { ...both('arm2', { r: [18 * K(u, [[0, 1], [0.1, 1], [0.3, 0]]) - 50 * hit, 6 * hit, 0] }), ...both('fore2', { r: [-30 * hit, 0, 0] }) };
  },
  hurt: (t, u) => { const k = K(u, [[0, 0], [0.18, 1], [1, 0.45]]); return both('arm2', { r: [12 * k, -14 * k, 0] }); },
  faint: (t, u) => { const d = smooth((u - 0.18) / 0.55); return { ...both('arm2', { r: [10 * d, 40 * d, 0] }), ...both('fore2', { r: [-30 * d, 0, 0] }) }; },
  celebrate: (t, u) => { const up = win(u, 0, 1, 0.15); const p = Math.sin(TAU * 2 * u); return { ...both('arm2', { r: [0, -10 * up + 8 * p, 0] }), ...both('hand2', { r: [0, 0, 360 * smooth(u)] }) }; },
  enter: (t, u) => { const over = win(u, 0.45, 0.9, 0.12); return both('arm2', { r: [0, -12 * over, 0] }); },
};

export const clipsFor = ({ extra = {} } = {}) => {
  const base = bipedClips({
    hipH: 6.5, stride: 16, armSwing: 10, hopScale: 0.4, arms2: 0.3,
    punch: { arm: [-60, 0, 20], fore: [-10, 0, 0] },
    cheer: { arm: [0, -45, 0], fore: [0, -20, 0] },
    add: Object.fromEntries([...new Set([...Object.keys(upper), ...Object.keys(extra)])].map((k) => [k, (t, u) => merge(upper[k]?.(t, u), extra[k]?.(t, u))])),
  });
  return {
    ...base,

    // fidget: both raised blades spin a full turn about their blades, the lower fists flex
    idle_flourish: {
      seconds: 2.4,
      pose: (t, u) => {
        const on = win(u, 0.05, 0.9, 0.1);
        const spin = 360 * smooth((u - 0.15) / 0.6);
        return {
          body: { r: [-3 * on, 0, 4 * osc(u, 1)] },
          head: { r: [-6 * on, 0, 10 * osc(u, 1)] },
          ...both('arm2', { r: [0, -8 * on, 0] }),
          hand2L: { r: [0, 0, spin] }, hand2R: { r: [0, 0, -spin] },
          ...both('fore', { r: [-25 * on, 0, 0] }),
          ...both('arm', { r: [0, -12 * on, 0] }),
        };
      },
    },

    // fidget: the two raised blades clang together over the helm, a shudder, then apart
    idle_clang: {
      seconds: 1.8,
      pose: (t, u) => {
        const hit = K(u, [[0, 0], [0.25, 0], [0.38, 1], [0.6, 1], [0.8, 0]]);
        const sh = u > 0.38 ? Math.sin(TAU * 8 * (u - 0.38)) * Math.max(0, 1 - (u - 0.38) / 0.3) : 0;
        return {
          body: { r: [0, 0, 0] },
          head: { r: [-12 * hit, 0, 0] },
          ...both('arm2', { r: [0, -16 * hit - 2 * sh, 0] }),
          ...both('fore2', { r: [0, -14 * hit, 0] }),
          ...both('fore', { r: [-10 * hit, 0, 0] }),
        };
      },
    },
  };
};

export default rigDef({ joints, assign: (c) => pick(c, parts), clips: clipsFor() });
