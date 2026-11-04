// Grubolt's rig: an armoured pill-bug grub standing upright, so it uses the serpent template: the low rear (the bottom
// plates, the tail roll and the stubby legs) is the root, the plated column rises in a spine chain to the hooded top,
// the side-on head sits under the hood off the last link, the two pairs of little chest arms are the arms (arm = the
// upper pair, fore = the lower pair), the mandibles the jaw and the drill bit the tail. Numbers are
// scad/grubolt.scad's: the shell plates and the head live in its `rotate([0, 0, CURL])` frame.
import { K, TAU, merge, rigDef, win } from './lib/anim.mjs';
import { pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, capD, chainHit, ellD, near, subFrame, unrot } from './lib/geo.mjs';
import { serpentClips } from './lib/serpent.mjs';

const CURL = -30;
const C = [-7, 21];
const SEAMS = [-100, -44, -28, -6, 17, 40, 66, 94, 190];
const BAND_J = ['root', 'root', 'spine1', 'spine2', 'spine2', 'spine3', 'spine3', 'spine3'];
const spine = ['spine1', 'spine2', 'spine3'];
const tail = ['tail1', 'tail2'];
const HEAD = [0.62, 0.64, 0.68];
const DRILL = [[0.6, 0.62, 0.66], [0.27, 0.29, 0.34]];
const BELLY = [[[7.8, 6, 5.5], [0, -3.8, 7]], [[8.2, 6.3, 6], [0, -4.2, 13.5]], [[7.2, 5.8, 5], [0, -4, 20]]];
const TAIL = [[[6.5, 5.5, 6], [5, 8, 8.5]], [[5.5, 5, 5.5], [9, 7.5, 10.5]], [[4.5, 4.2, 4.6], [12, 5, 12.5]]];
const ARM = [[6, -5.5, 21.5], [7.4, -9, 19.6], [6.2, -11.2, 17.8]];
const FORE = [[6, -6, 15.5], [7.4, -9.4, 13.8], [6.2, -11.6, 12]];
const LIMB_R = [1.5, 1.25, 1];
const MAND = [[1.4, -17.4, 24.6], [1.9, -18.3, 23], [1.2, -18.2, 21.4]];
// the drill: rotate(_dir_rot(DT - DB)) from DB, a banded cone 3 at the base
const DB = [13, 5, 15.5];
const DT = [16.5, 6.5, 24];
const D = DT.map((v, i) => v - DB[i]);
const DL = Math.hypot(...D);
const DROT = [0, (Math.acos(D[2] / DL) * 180) / Math.PI, (Math.atan2(D[1], D[0]) * 180) / Math.PI];

const curl = subFrame([0, 0, 0], [0, 0, CURL]);
const eyeL = { side: 'L', at: [3.9, -14.5, 28.3], size: 1.4, yaw: 70, frame: curl };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: HEAD });

const joints = [
  { name: 'root', at: [0, 3, 0] },
  { name: 'spine1', parent: 'root', at: [0, 0, 9] },
  { name: 'spine2', parent: 'spine1', at: [0, 0, 16.5] },
  { name: 'spine3', parent: 'spine2', at: [0, -1, 26] },
  { name: 'head', parent: 'spine3', at: curl.world([0, -7.5, 27.5]) },
  { name: 'jaw', parent: 'head', at: curl.world(MAND[0]) },
  { name: 'armL', parent: 'spine2', at: ARM[0] },
  { name: 'armR', parent: 'spine2', at: [-ARM[0][0], ARM[0][1], ARM[0][2]] },
  { name: 'foreL', parent: 'spine1', at: FORE[0] },
  { name: 'foreR', parent: 'spine1', at: [-FORE[0][0], FORE[0][1], FORE[0][2]] },
  { name: 'tail1', parent: 'root', at: DB },
  { name: 'tail2', parent: 'tail1', at: DB.map((v, i) => v + D[i] * 0.5), rot: DROT },
  ...face.joints,
];

const drillAt = (c) => {
  const q = unrot(DROT, [c[0] - DB[0], c[1] - DB[1], c[2] - DB[2]]);
  return { h: q[2], d: Math.hypot(q[0], q[1]) / Math.max(0.4, 3 * (1 - q[2] / DL) + 0.15) };
};
const shellD = (L) => Math.min(ellD(L, [10, 9.5, 19.5], [0, 1.5, 19.5]), ellD(L, [7.2, 11, 7], [0, -8, 32.5]));
const headD = (L) => Math.min(ellD(L, [6.2, 7, 5.6], [0, -6.5, 27.3]), ellD(L, [4.4, 5.6, 4.6], [0, -13.8, 28]),
  ellD(L, [3.4, 2.8, 2.9], [0, -17.2, 26.4]), ellD([Math.abs(L[0]), L[1], L[2]], [1.6, 1.4, 1.7], [3.9, -14.5, 28.3]));

function assign(c, rgb) {
  const L = curl.local(c);
  const dr = drillAt(c);
  if (DRILL.some((d) => near(rgb, d, 0.03)) && dr.h > -0.8 && dr.h < DL + 0.5 && dr.d < 1.3) return dr.h < DL * 0.5 ? 'tail1' : 'tail2';
  const ang = (Math.atan2(L[2] - C[1], L[1] - C[0]) * 180) / Math.PI;
  const a = ang < SEAMS[0] ? ang + 360 : ang;
  const band = Math.max(0, SEAMS.findIndex((s, i) => i > 0 && a < s) - 1);
  const bellyJ = c[2] < 9 ? 'root' : c[2] < 16.5 ? 'spine1' : 'spine2';
  const Lf = [Math.abs(L[0]), L[1], L[2]];
  return pick(c, [
    [BAND_J[band], () => shellD(L)],
    [bellyJ, () => blobD(c, BELLY)],
    ['root', () => blobD(c, TAIL)],
    ['root', (f) => Math.min(capD(f, [5.2, -2.5, 5.5], [5.6, -3.2, 1.4], 2, 1.5), ellD(f, [1.7, 2.3, 1.1], [5.6, -4, 1.1]))],
    ['head', () => headD(L)],
    ['jaw', () => chainHit(Lf, MAND, [0.65, 0.5, 0.25]).d],
    ['arm*', (f) => chainHit(f, ARM, LIMB_R).d],
    ['fore*', (f) => chainHit(f, FORE, LIMB_R).d],
  ]);
}

const base = serpentClips({ face, spine, tail });

const clips = {
  ...base,
  // fidget: spins the drill up with a whine, the body trembling, then a proud stretch
  idle_drill: {
    seconds: 2.2,
    pose: (t, u) => {
      const on = win(u, 0.1, 0.7, 0.08);
      const tr = Math.sin(TAU * 20 * u) * on;
      const st = K(u, [[0.7, 0], [0.82, 1], [0.95, 0]]);
      return merge(base.idle.pose(t, u), {
        tail1: { r: [0, 0, 1.5 * tr] },
        tail2: { r: [0, 0, 360 * K(u, [[0.1, 0], [0.7, 2]])] },
        spine1: { r: [-3 * st, tr * 0.5, 0] },
        spine2: { r: [-3 * st, 0, 0] },
        head: { r: [-6 * st, 0, 0] },
        ...face.pose(on > 0.5 ? 'squeeze' : 'open'),
      });
    },
  },
};

// the head's neck and the arms' shoulders sit in the belly and the tail roll meets the low plates: blend those too
const seams = { allow: [['head', 'spine2'], ['armL', 'spine1'], ['armR', 'spine1'], ['foreL', 'root'], ['foreR', 'root'], ['root', 'spine2']] };

export default rigDef({ joints, assign, extras: face.extras, clips, seams });
