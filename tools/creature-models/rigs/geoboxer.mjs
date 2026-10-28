// Geoboxer's rig: a hulking clay brawler in a wide crouch, boulder fists raised in guard beside its head. The kicked-up
// dust round the feet stays on the root. Numbers are scad/geoboxer.scad's.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, mx, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { near } from './lib/geo.mjs';

const SKIN_DK = [0.47, 0.34, 0.22];
const DIRT = [0.45, 0.36, 0.25];
const DUST = [[-16, -2, 3.2], [16, -1, 3.2], [-15, 5, 2.6], [15, 5, 2.6], [-8, -8, 2.2], [8, -7, 2.2], [0, 6, 2.6]];
const SH = [10, 0.5, 23.5];
const EL = [14, 0, 17];
const FIST = [13, -4.5, 31];
const MID = EL.map((v, i) => (v + FIST[i]) / 2);

const eyeL = { side: 'L', at: [2.5, -7, 30.8], size: 1.45, yaw: 8, flat: 0.5 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: SKIN_DK });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4, 0.5, 10]),
  { name: 'body', parent: 'root', at: [0, 0.5, 10.5] },
  { name: 'head', parent: 'body', at: [0, -1, 25.5] },
  ...pair('arm*', 'body', SH),
  ...pair('fore*', 'arm*', EL),
  ...pair('hand*', 'fore*', [13, -3, 28.5]),
  ...face.joints,
];

const parts = [
  ['leg*', any(...chain(['x'], [[4, 0.5, 10], [9.5, -1.5, 6], [10.5, 0, 1.6]], [4, 3.2, 2.5]).map(([, t]) => t), ell([3, 2.8, 2.6], [9.4, -3, 7]),
    ell([2.8, 2.6, 2.6], [7.5, -1.5, 8.8]), blob([[[2.8, 4.2, 1.3], [11, -2, 1.3]], [[2.4, 2.2, 1.3], [10.5, 1, 1.5]]]))],
  ['body', any(blob([[[10.5, 6.5, 5.5], [0, 0.5, 21]], [[6.5, 5, 4], [0, 0, 13.5]]]), mx(ell([4.4, 2.2, 3.2], [3.4, -4.8, 21.5])),
    mx(ell([4.8, 2.6, 5], [3.8, 4.8, 21])), mx(ell([3, 2, 3], [2.8, 5, 13.5])), ell([6.8, 5, 3.2], [0, 0.5, 11]), mx(ell([3.1, 2.3, 2.6], [2.6, 4.4, 10.5])))],
  ['head', any(ell([6.2, 6, 6.6], [0, -2, 30.5]), mx(ell([1.1, 1.4, 1.7], [6.1, -1.2, 30])), ell([2.4, 1, 1], [0, -7.4, 26.6]))],
  ['arm*', any(ell([5, 5, 4.4], [SH[0] + 0.5, SH[1], SH[2] + 1]), ell([3.2, 3.2, 2.6], [SH[0] + 1.4, SH[1] - 2, SH[2] + 3.2]), limb(SH, EL, 3.6, 3.2))],
  ['fore*', any(ell([3, 3, 3], [EL[0] - 0.8, EL[1] - 1, EL[2] + 2]), limb(EL, [FIST[0], FIST[1] + 1.5, FIST[2] - 2.5], 3.4, 3.6),
    ell([4.8, 4.4, 5.6], [MID[0] + 1, MID[1] - 0.4, MID[2] - 0.5]))],
  ['hand*', any(ell([6.6, 6, 6.4], FIST), ell([4.5, 2, 1.8], [FIST[0], FIST[1] - 5.4, FIST[2] + 2.5]))],
];

function assign(c, rgb) {
  if (near(rgb, DIRT, 0.015) && DUST.some(([x, y, r]) => Math.hypot((c[0] - x) / r, (c[1] - y) / r, (c[2] - r * 0.25) / (r * 0.3)) < 1.3)) return 'root';
  if (near(rgb, DIRT, 0.015) && c[2] > 2) return 'root';               // the flying pebbles of dust
  return pick(c, parts);
}

const base = bipedClips({
  face, hipH: 9, stride: 16, guard: true, hopScale: 0, hopH: 2,
  punch: { arm: [-40, 0, 0], fore: [60, 0, 0] },
  cheer: { arm: [0, -55, 0], fore: [0, 35, 0] },
  add: {
    celebrate: (t, u) => both('fore', { r: [-10 * Math.abs(Math.sin(TAU * 2 * u)), 0, 0] }),
  },
});

const clips = {
  ...base,

  // fidget: lifts its left foot out to the side and stomps, the whole body shuddering
  idle_stomp: {
    seconds: 2,
    pose: (t, u) => {
      const lift = K(u, [[0, 0], [0.12, 0], [0.38, 1], [0.48, 0]]);
      const hit = u > 0.48 ? Math.sin(TAU * 5 * (u - 0.48)) * Math.max(0, 1 - (u - 0.48) / 0.35) : 0;
      return {
        ...face.pose('open', 0.35 + 0.4 * lift),
        root: { r: [0, 3 * lift, 0] },
        legL: { r: [-6 * lift, -32 * lift, 0] },
        body: { p: [0, 0, -0.4 * Math.abs(hit)], r: [2 * hit, -6 * lift + 2 * hit, 0] },
        head: { r: [3 * hit, 0, 8 * lift] },
        ...both('arm', { r: [3 * hit, 0, 0] }),
      };
    },
  },

  // fidget: a bodybuilder's flex, fists curled in, chest puffed, the snarl at the camera
  idle_flex: {
    seconds: 2.2,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.7, 1], [0.88, 0]]);
      const tr = win(u, 0.25, 0.68, 0.05) * Math.sin(TAU * 8 * u);
      return {
        ...face.pose('open', 0.45 * on + blinks(u, [[0.76, 0.8]])),
        body: { s: [1 + 0.05 * on, 1 + 0.04 * on, 1], r: [-4 * on, 0, 0] },
        head: { r: [4 * on, 0, 10 * on] },
        ...both('arm', { r: [0, -12 * on + tr, 0] }),
        ...both('fore', { r: [-18 * on + tr, 0, 6 * on] }),
      };
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
