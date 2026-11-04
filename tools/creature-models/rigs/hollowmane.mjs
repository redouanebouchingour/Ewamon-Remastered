// Hollowmane's rig: a lean armoured werewolf-demon in a low crouch, its ram skull thrust forward on a long neck (the
// neck goes with the head), a jaw that gapes, bone scythes on the forearms and the huge white mane on the back as a
// two-link cape (the crown and the face locks stay on the body). Numbers are scad/hollowmane.scad's; Hollowmane Rage
// (scad/hollowmane_rage.scad, the same body) builds its rig with hollowRig() and its own extra parts.
import { K, TAU, both, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, chain, ell, limb, mx, pair, pick, spike } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, subFrame } from './lib/geo.mjs';

export const BONE = [0.9, 0.88, 0.79];
export const MANE = [[0.95, 0.95, 0.97], [0.68, 0.67, 0.71]];
// the skull's frame: translate(HC) rotate([0, 0, HEAD_YAW])
export const H = subFrame([0, -10.8, 30], [0, 0, 20]);
export const inHead = (test) => (c) => test(H.local(c));
export const inHeadMx = (test) => (c) => { const l = H.local(c); return test([Math.abs(l[0]), l[1], l[2]]); };
const deg = Math.PI / 180;

// lib.scad eye(EYE, EYE_SIZE, yaw = 22, …) inside the skull frame, mirrored
const eyeL = { side: 'L', at: [1.55, -2.75, 0.75], size: 1, yaw: 22, frame: H };
export const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], parent: 'head', skin: BONE });

export const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [3.4, 1.2, 13.5]),
  { name: 'body', parent: 'root', at: [0, 1, 14] },
  { name: 'head', parent: 'body', at: [0, -2, 23.5] },
  { name: 'jaw', parent: 'head', at: H.world([0, -0.8, -2.6]) },
  ...pair('arm*', 'body', [8.4, 0.2, 25.5]),
  ...pair('fore*', 'arm*', [13.2, -0.5, 21]),
  { name: 'cape1', parent: 'body', at: [0, 6, 29] },
  { name: 'cape2', parent: 'cape1', at: [0, 9.5, 19] },
  ...face.joints,
];

// the grin's teeth, as the scad lays them out (head numbers): the upper row on the skull, the lower on the jaw
const upperTeeth = []; for (let a = 195; a <= 345; a += 15) upperTeeth.push(ell([0.21, 0.17, 0.45], [1.9 * Math.cos(a * deg), -2.6 + 1.75 * Math.sin(a * deg), -2.25]));
const lowerTeeth = []; for (let a = 200; a <= 340; a += 20) lowerTeeth.push(ell([0.19, 0.16, 0.38], [1.6 * Math.cos(a * deg), -2.5 + 1.62 * Math.sin(a * deg), -2.95]));

export const parts = [
  ['leg*', any(limb([3.4, 1.2, 13.5], [7.8, 0.5, 9.9], 2.8, 2.2), limb([3, 1.9, 13], [7.3, 1.3, 9.6], 2.6, 2), ell([2.2, 2.2, 1.9], [7.9, 0.3, 9.9]),
    spike([8, -1.4, 10.3], [1.6, -3.4, 1.9], 1.05), limb([7.9, 0.5, 9.6], [8.8, 4, 5], 1.9, 1.45), limb([8, -0.7, 8.8], [8.9, 2.9, 5.3], 1.45, 1.1),
    spike([8, 2.4, 8.6], [0.3, 2.4, 1.8], 0.75), ell([1.5, 1.5, 1.5], [8.8, 4, 5]), spike([8.9, 5, 4.6], [0.2, 2.4, -0.4], 0.7),
    limb([8.8, 4, 5], [10, 0.6, 1.4], 1.4, 1.3), ell([2, 2.1, 1.15], [10, 0.2, 1.15]),
    ...[-1.2, 0, 1.2].map((dx) => spike([10 + dx, -1.4, 1.2], [dx * 0.5, -2.5, -0.9], 0.6)),
    ell([0.22, 0.22, 0.85], [13.4, -3, 7.2]), ell([0.22, 0.22, 0.85], [6, -3.8, 5]), ell([0.22, 0.22, 0.85], [12.6, 2, 3.5]))],
  ['body', any(blob2([[[6, 4, 3.8], [0, -1.2, 21.5]], [[6.5, 3.8, 3.2], [0, 0.5, 24]]]), limb([0, -0.3, 19], [0, 0.6, 14.5], 3.4, 3),
    ell([4.4, 3.3, 2.5], [0, 1, 13.3]), ell([1.7, 0.8, 1.7], [0, -2.1, 13]), mx(ell([2.8, 1.2, 1.9], [2.9, -4, 22.6])),
    ell([1.8, 0.8, 1.8], [0, -4.9, 21.2]), ell([1.3, 0.8, 1.3], [0, -5.2, 21.2]), ell([0.45, 0.4, 0.45], [0.25, -5.85, 21.5]),
    ell([3.4, 2.95, 0.35], [0, -0.25, 17.1]), ell([3.25, 2.8, 0.35], [0, 0.2, 15.6]))],
  ['arm*', any(ell([3.5, 3.4, 3], [8.4, 0.2, 26.4]), ell([3.6, 3.3, 1.1], [8.6, 0.2, 24.5]), spike([8.2, 0.5, 28.6], [0.4, 0.6, 4.2], 1.2),
    spike([10.4, -0.5, 27], [2.3, -1.6, 2.3], 1), spike([8.6, 2.6, 27.5], [0.5, 2.5, 2.5], 0.85), limb([8.4, 0.2, 25.5], [13.2, -0.5, 21], 2.3, 1.9))],
  ['fore*', any(ell([1.95, 1.95, 1.95], [13.2, -0.5, 21]), spike([13.7, 1, 21.6], [0.5, 2.4, 1.4], 0.65), limb([13.2, -0.5, 21], [15.2, -1, 17.2], 1.9, 1.6),
    spike([14.9, 0.075, 20.85], [1.3, 0.8, 1.5], 0.55), spike([15.6, -0.1, 19.52], [1.3, 0.8, 1.5], 0.55), ell([1.8, 1.8, 1.2], [15.1, -1, 17.6]),
    ell([0.22, 0.22, 0.85], [21.8, -1.5, 15.5]))],
  ...chain(['fore*'], [[15, -1, 18.6], [17, -1.2, 15.8], [18.8, -1.4, 12.4], [19.8, -1.5, 9], [20.1, -1.5, 6], [19.6, -1.4, 3.9], [18.8, -1.3, 2.9]],
    [1, 1.2, 1.15, 1, 0.72, 0.38, 0.08]),
  ...chain(['fore*'], [[16.3, -1.8, 15.6], [17.9, -2, 12.4], [18.9, -2.1, 9], [19.2, -2.1, 6.2]], [0.55, 0.6, 0.5, 0.28]),
  ['head', any(limb([0, -2, 23.5], [0, -9, 28.5], 2.5, 1.9), ...[0.25, 0.5, 0.75].map((t) => ell([2.1 - t * 0.4, 1, 1], [0, -2 - 7 * t, 22.4 + 5 * t])),
    inHead(any(ell([3, 2.9, 2.8], [0, 0.6, 1.7]), blob2([[[2.5, 2, 2.1], [0, -1.3, 0.6]], [[1.5, 1.4, 1.5], [0, -2.6, -2.7]]]),
      ell([1.85, 1.7, 0.33], [0, -2.6, -2.6]), ...upperTeeth)),
    inHeadMx(any(ell([1, 0.45, 1.15], [1.55, -2.75, 0.75]), ell([0.3, 0.25, 0.55], [0.5, -3.75, -1.1]),
      (l) => Math.min(...chain(['h'], [[2, 1, 3], [3.8, 1.4, 4.4], [5.9, 1.4, 3.9], [7.2, 1, 1.8], [7.2, 0.2, -0.6], [6.3, -0.6, -2.4], [5, -1.2, -2.7], [4.3, -1.4, -1.9]],
        [1.3, 1.4, 1.3, 1.15, 1, 0.8, 0.55, 0.2]).map(([, t]) => t(l))))))],
  ['jaw', inHead(any(ell([1.5, 1.65, 0.85], [0, -2.5, -3.5]), ...lowerTeeth))],
];
function blob2(ps) { return (c) => Math.min(...ps.map(([r, p]) => ell(r, p)(c))); }

// The mane by colour: the crown, the face locks and the front of the mass stay on the body; the back hangs as a cape
// from the top of the shoulders (cape1) down to the curtain (cape2).
export function maneJoint(c) {
  if (c[1] < 3 || c[2] > 30) return 'body';
  return c[2] > 19 ? 'cape1' : 'cape2';
}

/** The rig's assign(): the mane colours (plus `maneCols`) by maneJoint(), the rest by the nearest primitive. */
export const makeAssign = (list, maneCols = []) => (c, rgb) => (isAny(rgb, [...MANE, ...maneCols], 0.03) ? maneJoint(c) : pick(c, list));

export const add = {
  // keep the scythe tips off the ground as the body folds, and the long-necked skull droops less
  faint: (t, u) => ({ ...both('arm', { r: [0, -14 * smooth((u - 0.18) / 0.55), 0] }), head: { r: [-14 * smooth((u - 0.18) / 0.55), 0, 0] } }),
  enter: (t, u) => ({ head: { r: [-10 * (1 - smooth((u - 0.2) / 0.35)), 0, 0] } }),
  lunge: (t, u) => ({ jaw: { r: [16 * K(u, [[0.1, 0], [0.4, 1], [0.7, 1], [1, 0]]), 0, 0] } }),
  hurt: (t, u) => ({ jaw: { r: [10 * K(u, [[0, 0], [0.2, 1], [1, 0.4]]), 0, 0] } }),
};

export const baseClips = (o = {}) => bipedClips({
  face, hipH: 13.5, stride: 14, armSwing: 10, hopScale: 0.3, hopH: 3, cape: ['cape1', 'cape2'], droop: 0.6,
  punch: { arm: [-55, 22, 0], fore: [-30, 0, 0] },
  cheer: { arm: [-15, -70, 0], fore: [-10, 10, 0] },
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
        head: { r: [6 * on, 8 * on, -6 * on] },
        jaw: { r: [3 * on, 0, 0] },
        ...both('arm', { r: [-28 * on, 20 * on, 0] }),
        ...both('fore', { r: [-16 * on + 6 * s, 0, 10 * on] }, { r: [-16 * on - 6 * s, 0, 10 * on] }),
        ...face.pose('open', 0),
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
        body: { r: [-6 * on, 0, 0] },
        head: { r: [-18 * on + 1.5 * tr, 0, 0] },
        jaw: { r: [22 * on, 0, 0] },
        ...both('arm', { r: [6 * on, -14 * on, 0] }),
        cape1: { r: [-8 * on + 2 * tr, 0, 0] }, cape2: { r: [-6 * on, 0, 0] },
        ...face.pose('open', 0),
      };
    },
  },
};

/** The rig for Hollowmane's body: `list` the [joint, test] parts (default this file's), `maneCols` extra mane colours. */
export const hollowRig = ({ list = parts, maneCols = [], clips }) =>
  rigDef({ joints, extras: face.extras, assign: makeAssign(list, maneCols), clips });

export default hollowRig({ clips: { ...baseClips({ add }), ...fidgets } });
