// Hollowmane's rig: a hunched armoured horror in a ram-horned bone skull. Bent legs, arms hanging forward with bone
// scythes that reach the ground, a jaw that gapes, and the white mane's back curtain hanging off the shoulders as a
// two-link cape. Numbers are scad/hollowmane.scad's (Hollowmane Rage imports the pieces).
import { K, TAU, both, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, mx, pair, pick, spike } from './lib/biped.mjs';

export const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4, 1, 16]),
  { name: 'body', parent: 'root', at: [0, 1, 16] },
  { name: 'head', parent: 'body', at: [0, -1, 28] },
  { name: 'jaw', parent: 'head', at: [0, -7.4, 29.6] },
  ...pair('arm*', 'body', [8, 0, 27.5]),
  ...pair('fore*', 'arm*', [11, -3, 21]),
  { name: 'cape1', parent: 'body', at: [0, 9.5, 31] },
  { name: 'cape2', parent: 'cape1', at: [0, 11.5, 21] },
];

// the back curtain's tresses: the top link on the head (under the crown), the rest on the cape
const curtain = [];
for (let x = -7.5; x <= 7.5; x += 2.5) {
  curtain.push(...chain(['head', 'cape1', 'cape2'], [[x * 0.5, 5, 35], [x, 10, 31], [x * 1.1, 11.5, 21], [x * 1.25, 10, 9 + Math.abs(x) * 0.6]], [3, 2.8, 2, 0.25]));
}
// the crown tresses fan out of the skull's top: all on the head
const crown = [];
for (let i = 0; i <= 8; i++) {
  const a = ((-10 + i * 25) * Math.PI) / 180; const ca = Math.cos(a); const sa = Math.sin(a);
  const p0 = [ca * 4, 2, 34 + sa * 4]; const p1 = [p0[0] + ca * 6, p0[1] + 5, p0[2] + sa * 6 + 2];
  const p2 = [p1[0] + ca * 4, p1[1] + 5, p1[2] + sa * 2 - 3]; const p3 = [p2[0] + ca * 2, p2[1] + 3, p2[2] - 7];
  crown.push(...chain(['head'], [p0, p1, p2, p3], [3, 2.4, 1.4, 0.2]));
}

export const parts = [
  ['body', any(blob([[[6, 4.5, 4], [0, 1, 16]], [[5, 4, 4], [0, 0, 20]]]), blob([[[7.5, 5.5, 5], [0, -1, 26]], [[6, 5, 4], [0, 0.5, 21]]]),
    ell([1.9, 1, 1.9], [0, -6.4, 26]), mx(ell([3.8, 3.8, 3.2], [7.5, 0, 28])), mx(spike([8, 0, 30.5], [0.8, 0.3, 4.2], 1.2)),
    mx(spike([9.8, 0.5, 29], [3, 0.3, 2.4], 1)))],
  ['head', any(limb([0, -1, 28], [0, -4.5, 31], 3, 2.6), blob([[[3.6, 3.6, 3.8], [0, -6, 34]], [[2.4, 2.8, 2.2], [0, -9.2, 31]]]), ell([7.5, 6.5, 7.5], [0, 4, 32]))],
  ['head', mx((c) => Math.min(...chain(['h'], [[2.8, -5.5, 35.5], [5.5, -4, 37], [7.5, -2, 35.5], [7.6, -2.5, 32.5], [6.2, -4.6, 31.5], [5.6, -6, 33]], [1.5, 1.4, 1.2, 1, 0.7, 0.3]).map(([, t]) => t(c))))],
  ['head', mx((c) => Math.min(...chain(['h'], [[4.5, -2, 34], [6, -3.5, 30], [5.8, -3.5, 25], [5, -3, 21]], [2, 1.8, 1.2, 0.2]).map(([, t]) => t(c))))],
  ['jaw', any(ell([2.6, 2, 1.2], [0, -8.6, 28.8]), ell([2.2, 0.5, 0.6], [0, -10.4, 30]))],
  ['cape1', ell([7, 5, 7], [0, 7, 22])],
  ...curtain,
  ...crown,
  ['arm*', limb([8, 0, 27.5], [11, -3, 21], 2.3, 2)],
  ['fore*', any(limb([11, -3, 21], [12.5, -5, 15], 2, 1.7), spike([11, -2.5, 23], [1, 1.5, 2.5], 0.8))],
  ...chain(['fore*'], [[12.2, -3.6, 18.5], [15.5, -3.2, 14.5], [18.5, -2.8, 9.5], [19.6, -2.6, 4.5], [19, -2.6, 1.2]], [1.5, 1.4, 1.1, 0.7, 0.15]),
  ['fore*', ell([2, 2, 2.4], [12.5, -6, 13.5])],
  ['leg*', any(limb([4, 1, 16], [8, -1, 9], 3.4, 2.8), limb([8, -1, 9], [9.5, 1, 2.5], 2.6, 2), ell([2.4, 2.4, 2], [8, -1.5, 9.2]),
    blob([[[2.8, 3.6, 1.5], [9.8, -1, 1.5]], [[2, 2, 1.4], [9.6, 1.5, 1.6]]]), spike([8.6, -2.6, 9.5], [1.2, -2.8, 0.8], 1.1), spike([9.8, 2.5, 4], [1, 2.4, 0.4], 0.8))],
];

export const add = {
  // keep the scythe tips off the ground as the body folds
  // and the skull droops less than the template's, or the crown tresses flip up like a fan
  faint: (t, u) => ({ ...both('arm', { r: [0, -14 * smooth((u - 0.18) / 0.55), 0] }), head: { r: [-20 * smooth((u - 0.18) / 0.55), 0, 0] } }),
  enter: (t, u) => ({ head: { r: [-14 * (1 - smooth((u - 0.2) / 0.35)), 0, 0] } }),
  lunge: (t, u) => ({ jaw: { r: [14 * K(u, [[0.1, 0], [0.4, 1], [0.7, 1], [1, 0]]), 0, 0] } }),
  hurt: (t, u) => ({ jaw: { r: [8 * K(u, [[0, 0], [0.2, 1], [1, 0.4]]), 0, 0] } }),
};

export const baseClips = (o = {}) => bipedClips({
  hipH: 14, stride: 15, armSwing: 10, hopScale: 0.3, hopH: 3, cape: ['cape1', 'cape2'],
  punch: { arm: [-55, 22, 0], fore: [-30, 0, 0] },
  cheer: { arm: [-15, -78, 0], fore: [-10, 10, 0] },
  ...o,
});

export const fidgets = {
  // fidget: it whets one scythe on the other in front of its chest, skull cocked
  idle_whet: {
    seconds: 2.6,
    pose: (t, u) => {
      const on = win(u, 0.06, 0.88, 0.12);
      const s = osc(u, 4) * on;
      return {
        body: { r: [4 * on, 0, 0] },
        head: { r: [8 * on, 10 * on, -6 * on] },
        jaw: { r: [3 * on, 0, 0] },
        ...both('arm', { r: [-28 * on, 20 * on, 0] }),
        ...both('fore', { r: [-16 * on + 6 * s, 0, 10 * on] }, { r: [-16 * on - 6 * s, 0, 10 * on] }),
      };
    },
  },
  // fidget: a jerk of the skull back with the jaw dropping in a silent howl; the mane flies
  idle_howl: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.22, 1], [0.7, 1], [0.92, 0]]);
      const tr = Math.sin(TAU * 10 * u) * win(u, 0.25, 0.7, 0.05);
      return {
        body: { r: [-8 * on, 0, 0] },
        head: { r: [-24 * on + 1.5 * tr, 0, 0] },
        jaw: { r: [20 * on, 0, 0] },
        ...both('arm', { r: [6 * on, -14 * on, 0] }),
        cape1: { r: [-10 * on + 2 * tr, 0, 0] }, cape2: { r: [-6 * on, 0, 0] },
      };
    },
  },
};

export default rigDef({ joints, assign: (c) => pick(c, parts), clips: { ...baseClips({ add }), ...fidgets } });
