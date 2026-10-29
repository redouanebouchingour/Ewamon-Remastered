// Grubolt's rig: an armoured grub reared up on its rear segments, so it uses the serpent template: the low rear
// segments and the stubby walking legs are the root, the plated body rises in a spine chain to the hooded head, the
// two pairs of little chest legs are the arms (arm = the upper pair, fore = the lower pair), the mandibles the jaw and
// the drill bit the tail. Numbers are scad/grubolt.scad's.
import { K, TAU, merge, rigDef, win } from './lib/anim.mjs';
import { any, ell, limb, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { capD, chainHit, fold, near, side, unrot } from './lib/geo.mjs';
import { serpentClips } from './lib/serpent.mjs';

const SEGS = [[-1, 22, 9.4, 8.2, 5.4, -30], [0.5, 17, 10, 8.8, 5.6, -15], [1.5, 11.5, 10, 9, 5.6, 0],
  [3.5, 6.5, 9, 8.4, 5, 25], [7.5, 4, 7.4, 7, 4.4, 55], [11.5, 3.5, 5.8, 5.6, 3.6, 75]];
const SEG_OWNER = ['spine3', 'spine2', 'spine1', 'spine1', 'root', 'root'];
const spine = ['spine1', 'spine2', 'spine3'];
const tail = ['tail1', 'tail2'];
const HEAD = [0.55, 0.6, 0.66];
const DRILL = [[0.5, 0.55, 0.62], [0.3, 0.33, 0.38]];
const ARM = [[4.6, -5, 16], [6.4, -8, 14.5], [5.4, -10, 15.5]];
const FORE = [[4.8, -5, 12], [6.6, -8, 10.8], [5.6, -9.8, 11.6]];
const MAND = [[1.6, -12.5, 19.6], [2.2, -13.6, 18.2], [1.2, -14, 17]];

const eyeL = { side: 'L', at: [3.2, -9.6, 23], size: 1.3, yaw: -30 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: HEAD });

const joints = [
  { name: 'root', at: [0, 4, 0] },
  { name: 'spine1', parent: 'root', at: [0, 3, 8] },
  { name: 'spine2', parent: 'spine1', at: [0, 1, 14.5] },
  { name: 'spine3', parent: 'spine2', at: [0, 0, 19.5] },
  { name: 'head', parent: 'spine3', at: [0, -5, 21.5] },
  { name: 'jaw', parent: 'head', at: [0, -12, 20] },
  { name: 'armL', parent: 'spine2', at: ARM[0] },
  { name: 'armR', parent: 'spine2', at: [-ARM[0][0], ARM[0][1], ARM[0][2]] },
  { name: 'foreL', parent: 'spine1', at: FORE[0] },
  { name: 'foreR', parent: 'spine1', at: [-FORE[0][0], FORE[0][1], FORE[0][2]] },
  { name: 'tail1', parent: 'root', at: [0, 14, 4.6] },
  { name: 'tail2', parent: 'tail1', at: [0, 14 + 7 * Math.sin(38 * Math.PI / 180), 4.6 + 7 * Math.cos(38 * Math.PI / 180)], rot: [-38, 0, 0] },
  ...face.joints,
];

const segD = (c, [y, z, rx, ry, rz, tilt]) => ell([rx, ry, rz], [0, 0, 0])(unrot([tilt, 0, 0], [c[0], c[1] - y - 0.3, c[2] - z - 0.2]));
// the drill: a cone along the tail's axis (rotate([-38, 0, 0]) from (0, 14, 4.6)), 14.4 long
const drillAt = (c) => { const q = unrot([-38, 0, 0], [c[0], c[1] - 14, c[2] - 4.6]); return { h: q[2], d: Math.hypot(q[0], q[1]) / Math.max(0.6, 3.6 - q[2] * 0.24) }; };

function assign(c, rgb) {
  const f = fold(c);
  const S = side(c);
  const dr = drillAt(c);
  if (DRILL.some((d) => near(rgb, d, 0.03)) && dr.d < 1.4 && dr.h > -0.5) return dr.h < 7 ? 'tail1' : 'tail2';
  const segs = SEGS.map((s) => segD(c, s));
  const si = segs.indexOf(Math.min(...segs));
  return pick(c, [
    [SEG_OWNER[si], () => segs[si]],
    ['spine3', () => ell([8.6, 7.4, 4.6], [0, 0, 0])(unrot([-40, 0, 0], [c[0], c[1] + 2, c[2] - 26]))],
    ['spine1', () => (c[2] > 5 && c[2] < 19.5 ? ell([5.6, 3, 2])([c[0], c[1] + 5.6, (c[2] - 12) * 0.2]) : 9)],
    ['head', any(ell([5.6, 4.6, 4.4], [0, -6.5, 22]), ell([3.4, 3, 2.8], [0, -10.5, 20.5]), ell([1.6, 1.4, 1.4], [3.2, -10, 23]), ell([1.6, 1.4, 1.4], [-3.2, -10, 23]))],
    ['jaw', () => Math.min(chainHit(f, MAND, [0.7, 0.55, 0.25]).d, ell([1.5, 0.5, 0.4], [0, -13.2, 20.2])(c))],
    [`arm${S}`, () => chainHit(f, ARM, [1.1, 0.9, 0.6]).d],
    [`fore${S}`, () => chainHit(f, FORE, [1.1, 0.9, 0.6]).d],
    ['root', () => Math.min(capD(f, [5, -3.5, 5], [5.6, -4.2, 1.2], 2, 1.6), ell([2, 2.4, 1.1], [5.6, -4.8, 1.1])(f), capD(f, [5.6, 3, 4], [6.2, 2.8, 1.2], 1.8, 1.4))],
    ['tail1', () => (dr.h > -0.5 ? dr.d : 9)],
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

export default rigDef({ joints, assign, extras: face.extras, clips });
