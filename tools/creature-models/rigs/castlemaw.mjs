// Castlemaw's rig: a hulking honey badger under a shaggy fur cloak, arms ending in cannon barrels (the forearm joint
// is the barrel), a big badger head scaled up about the neck with a snarling jaw. The cloak is one mound with the
// body. Numbers are scad/castlemaw.scad's; castlemaw_rage.mjs reuses this with its own jaw and fidget.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, mx, pair, pick, spike } from './lib/biped.mjs';
import { eyeKit, mirrorEye, blinks } from './lib/face.mjs';
import { near } from './lib/geo.mjs';

const CREAM = [0.9, 0.86, 0.74];

// the head block: translate([0, 2.5, 28.5]) scale(1.5) translate([0, 0, -29])
export const Hw = (p) => [1.5 * p[0], 1.5 * p[1] + 2.5, 1.5 * (p[2] - 29) + 28.5];
export const hLocal = (c) => [c[0] / 1.5, (c[1] - 2.5) / 1.5, (c[2] - 28.5) / 1.5 + 29];
const headFrame = { world: Hw, local: hLocal, scale: [1.5, 1.5, 1.5], rot: [0, 0, 0] };

export const HEAD = blob([[[5.2, 5, 4], [0, -4, 33.6]], [[3.6, 3.4, 2.8], [0, -9, 32.8]], [[1.6, 1.6, 1.4], [0, -13.6, 31.8]]]);
export const JAW = any(blob([[[4, 3.2, 1.6], [0, -5, 30]], [[1.8, 1.2, 1], [0, -11, 29.4]]]), blob([[[2.8, 2.4, 0.9], [0, -8.6, 30.5]], [[1.3, 0.8, 0.6], [0, -12, 30.4]]]),
  spike([1.6, -11.4, 29.6], [0, -0.1, 1.3], 0.5), spike([-1.6, -11.4, 29.6], [0, -0.1, 1.3], 0.5));

export const parts = [
  ['body', any(
    blob([[[7, 5.5, 5], [0, 2, 12]], [[8.4, 6.4, 5], [0, 0.5, 18]], [[12, 7, 5], [0, -0.5, 25]], [[7, 5.5, 4], [0, -2.5, 30]]]),
    blob([[[8, 4.5, 4.5], [0, 5, 38]], [[15, 7, 5], [0, 8, 30]], [[16, 7.5, 7], [0, 9.5, 20]], [[12.5, 6, 4], [0, 8.5, 6]]]),
    mx(blob([[[2.6, 2.6, 2], [9.5, -2, 27]], [[2, 2, 2], [11, -4, 16]], [[2, 2.4, 1.5], [12.5, -1, 5]]])),
    blob([[[8.5, 6, 4], [0, 1, 30]], [[7, 5, 4], [0, 2, 35]]]),
    blob([[[6.5, 2.4, 4.3], [0, -7.5, 21.8]], [[4.2, 2, 2.4], [0, -7.7, 18.5]]]),
    mx(blob([[[4.6, 5, 2.8], [12, 0, 27]], [[2.6, 4.2, 1.6], [14.5, -0.5, 24]]])))],
  ['arm*', limb([13.6, 0, 24], [14.8, -2.6, 16.5], 3.2, 3.4)],
  ['fore*', any(limb([14.8, -2.6, 16.5], [15.6, -10.5, 10.5], 3.4, 3), spike([15.6, -7.4, 8.2], [0, -1, -2.6], 1.4))],
  ['leg*', any(blob([[[4.6, 4.8, 5.4], [6, 1.5, 10]], [[3.6, 3.8, 3.4], [7.5, 0, 4]]]), blob([[[3.8, 5, 1.8], [7.8, -1.6, 1.8]]]),
    spike([7.8, -5.8, 1.4], [0, -1.8, -1], 1.4))],
];

const eyeL = { side: 'L', at: [2.4, -10.6, 33.2], size: 1.5, yaw: -38, frame: headFrame };
export const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.09, 0.09, 0.1] });

export const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [6, 1.5, 10]),
  { name: 'body', parent: 'root', at: [0, 2, 11.5] },
  { name: 'head', parent: 'body', at: Hw([0, -2, 31]) },
  { name: 'jaw', parent: 'head', at: Hw([0, -3, 30.6]) },
  ...pair('arm*', 'body', [13.6, 0, 24]),
  ...pair('fore*', 'arm*', [14.8, -2.6, 16.5]),
  ...face.joints,
];

// the upper fangs hang into the mouth but belong to the skull
const FANGS = any(...[-1, -0.45, 0.45, 1].map((t) => spike([1.8 * t, -12 + Math.abs(t) * 1.4, 31.4], [0, -0.1, -1.4], 0.5)));

/** assign(): nearest primitive, the head block's parts tested in its own frame; cream there is always skull. */
export const assignWith = (jaw) => {
  const all = [...parts, ['head', (c) => Math.min(HEAD(hLocal(c)), FANGS(hLocal(c)) * 0.9)], ['jaw', (c) => jaw(hLocal(c))]];
  return (c, rgb) => {
    const h = hLocal(c);
    const inHead = Math.abs(h[0]) < 6.5 && h[1] < 1.6 && h[1] > -16.5 && h[2] > 27.5 && h[2] < 38.5;
    if (inHead && near(rgb, CREAM)) return 'head';
    return pick(c, all);
  };
};

// the barrel kicks up (rx < 0 lifts a forward-pointing part) when the shot goes off at the lunge's hit
const kick = (u, at = 0.4) => K(u, [[at - 0.02, 0], [at + 0.06, 1], [at + 0.35, 0]]);

export const clipsFor = ({ extra = {}, fidgets = {} } = {}) => {
  const base = bipedClips({
    face, hipH: 10, stride: 13, armSwing: 9, hopScale: 0.2,
    punch: { arm: [-38, 0, 0], fore: [-14, 0, 0] },
    cheer: { arm: [-30, -70, 0], fore: [-20, 0, 0] },
    add: {
      ...extra,
      lunge: (t, u) => merge({ foreR: { r: [-22 * kick(u), 0, 0] }, jaw: { r: [10 * K(u, [[0.2, 0], [0.4, 1], [1, 0]]), 0, 0] } }, extra.lunge?.(t, u)),
    },
  });
  return {
    ...base,

    // fidget: raises the right cannon, sweeps it across the horizon, fires (a kick) and lowers it with a grunt
    idle_aim: {
      seconds: 3,
      pose: (t, u) => {
        const up = K(u, [[0, 0], [0.15, 1], [0.85, 1], [1, 0]]);
        const sweep = K(u, [[0, 0], [0.2, 0], [0.4, -1], [0.55, 0.6], [0.62, 0.6], [0.85, 0]]);
        const k = kick(u, 0.64);
        return {
          body: { r: [0, 0, -6 * up + 4 * sweep] },
          head: { r: [4 * up, 0, -10 * up + 12 * sweep] },
          armR: { r: [-40 * up, 0, -14 * sweep] },
          foreR: { r: [-16 * up - 26 * k, 0, 0] },
          armL: { r: [6 * up, -4 * up, 0] },
          jaw: { r: [8 * k, 0, 0] },
          ...face.pose('open', 0.4 * up + 0.6 * k),
        };
      },
    },

    // fidget: a snarl. The jaw snaps twice with a jerk of the head, then it licks its chops and settles
    idle_snarl: {
      seconds: 2,
      pose: (t, u) => {
        const snap = win(u, 0.15, 0.27, 0.04) + win(u, 0.36, 0.48, 0.04);
        const on = win(u, 0.08, 0.7, 0.1);
        return {
          body: { r: [4 * on, 0, 0] },
          head: { r: [6 * on - 6 * snap, 0, 3 * Math.sin(TAU * 6 * u) * on] },
          jaw: { r: [18 * snap + 4 * on, 0, 0] },
          ...both('arm', { r: [-6 * on, -6 * on, 0] }),
          ...face.pose('open', 0.35 * on + blinks(u, [[0.8, 0.86]])),
        };
      },
    },
    ...fidgets,
  };
};

export default rigDef({ joints, assign: assignWith(JAW), extras: face.extras, clips: clipsFor() });
