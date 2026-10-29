// Blizzhowl's rig: a lean white fox with navy socks, a bristling ice-blue ruff, frosted ears and a fan of seven
// feathery tails (one tail joint, so the fan sways as one). Numbers are scad/blizzhowl.scad's; everything above the
// legs sits in its translate([0, 0, -3]) block (dz()).
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, blob, ell, limb, pick, spike } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const dz = ([x, y, z]) => [x, y, z - 3];
const FUR = [0.93, 0.95, 1];
const TAILS = [[0.45, 0.58, 0.94], [0.7, 0.78, 0.98]];
const RUFF = [[0.45, 0.78, 0.96], [0.25, 0.6, 0.92]];
const ICE = [0.55, 0.82, 0.98];
const PAW = [0.13, 0.17, 0.5];

const eyeL = { side: 'L', at: dz([3.1, -14.9, 27.6]), size: 1.8, yaw: -24, flat: 0.4 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FUR });

const joints = [
  { name: 'root', at: [0, 2, 0] },
  { name: 'legFL', parent: 'root', at: [3.4, -5.5, 11] },
  { name: 'legFR', parent: 'root', at: [-3.4, -5.5, 11] },
  { name: 'legBL', parent: 'root', at: [3.4, 9.5, 11] },
  { name: 'legBR', parent: 'root', at: [-3.4, 9.5, 11] },
  { name: 'body', parent: 'root', at: [0, 2, 11] },
  { name: 'head', parent: 'body', at: dz([0, -8, 22]) },
  { name: 'earL', parent: 'head', at: dz([3.6, -8, 31]) },
  { name: 'earR', parent: 'head', at: dz([-3.6, -8, 31]) },
  { name: 'tail1', parent: 'body', at: dz([0, 11, 17]) },
  ...face.joints,
];

const leg = (x, y) => any(limb([x, y, 11], [x, y - 0.4, 5], 2.3, 1.9), limb([x, y - 0.4, 5.6], [x, y - 0.8, 1.2], 2.1),
  ell([2.3, 3, 1.3], [x, y - 1.5, 1.3]), spike([x, y - 2, 6.4], [0, -0.3, -1.8], 1.2));
const parts = [
  ['legF*', leg(3.4, -5.5)],
  ['legB*', leg(3.4, 9.5)],
  ['body', any(blob([[[5.6, 6, 5.8], [0, -3, 12]], [[5.2, 6, 5.2], [0, 6, 11.5]]]), ell([4.8, 8, 3], [0, 1, 7.5]))],
  ['head', any(ell([7.2, 6.6, 6.4], dz([0, -9, 27])), blob([[[3.4, 2.6, 2.6], dz([0, -13, 25.6])], [[1.6, 1.6, 1.5], dz([0, -17, 25.4])]]),
    ell([5, 3, 3], dz([6.5, -10, 25.5])), ell([5, 3, 3], dz([-6.5, -10, 25.5])), spike(dz([0, -11.5, 32]), [0, -1.5, 2.6], 1.6))],
  ['ear*', any(limb(dz([3.6, -8, 31]), dz([5, -8, 39.5]), 2.7, 0.5), spike(dz([5.6, -7.5, 31]), [3.5, 1, 3], 1.3),
    spike(dz([5.8, -7, 29.5]), [4, 1.5, 1], 1.2))],
  ['tail1', ell([3.2, 3.2, 3], dz([0, 11.5, 17]))],
];

function assign(c, rgb) {
  if (isAny(rgb, TAILS, 0.025)) return 'tail1';
  if (isAny(rgb, RUFF, 0.025) || near(rgb, ICE, 0.025)) {
    // the ruff is the body's collar; the ears carry dark rims and ice tufts
    if (c[2] > 26 && Math.abs(c[0]) > 2.5) return c[0] > 0 ? 'earL' : 'earR';
    return 'body';
  }
  if (near(rgb, PAW)) return pick(c, parts.slice(0, 2));
  if (near(rgb, FUR, 0.03) && c[1] > 8 && c[2] > 13) return 'tail1';   // the tails' white spikes and their root
  return pick(c, parts);
}

const fan = (u, amp = 4, cycles = 1, lift = 0) => ({ tail1: { r: [lift + 2 * osc(u, cycles, 0.3), 0, amp * osc(u, cycles)] } });

const base = quadrupedClips({
  face, hipH: 11, stride: 16,
  add: {
    idle: (t, u) => fan(u, 4, 2),
    walk: (t, u) => fan(u, 7, 1),
    idle_sniff: (t, u) => fan(u, 3, 2),
    idle_shake: (t, u) => fan(u, 12 * win(u, 0.1, 0.8, 0.06), 7),
    windup: (t, u) => fan(u, 3, 3, 10 * smooth(u / 0.8)),
    hurt: (t, u) => fan(u, 0, 1, -10 * K(u, [[0, 0], [0.18, 1], [1, 0.4]])),
    faint: (t, u) => fan(u, 0, 1, -12 * smooth((u - 0.2) / 0.55)),
    celebrate: (t, u) => fan(u, 12, 4, 10),
  },
});
const { idle_wag: _wag, ...clips0 } = base;

const clips = {
  ...clips0,
  // fidget: sits back a little, points its nose at the sky and howls, tails fanned up
  idle_howl: {
    seconds: 2.8,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.2, 1], [0.78, 1], [0.95, 0]]);
      const wob = Math.sin(TAU * 5 * u) * win(u, 0.25, 0.75, 0.05);
      return merge({
        body: { r: [-8 * up, 0, 0] },
        head: { r: [-34 * up + 1.5 * wob, 0, 0] },
        earL: { r: [-10 * up, 0, 0] },
        earR: { r: [-10 * up, 0, 0] },
        ...face.pose(up > 0.5 ? 'shut' : 'open'),
      }, fan(u, 3, 2, 12 * up));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
