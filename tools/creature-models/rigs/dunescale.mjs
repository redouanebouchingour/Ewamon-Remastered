// Dunescale's rig: a sandy four-legged lizard with a shell of boulder plates on its back, a big horned head (scaled up
// round its neck in the scad: hd()), violet crystal cheek frills and a crystal-tipped tail. Numbers are
// scad/dunescale.scad's.
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, blob, chain, ell, limb, pick, spike } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

// the head block: translate([0, -9, 17.5]) scale(1.25) translate([0, 9, -15])
const hd = ([x, y, z]) => [x * 1.25, -9 + (y + 9) * 1.25, 17.5 + (z - 15) * 1.25];
const hb = (r, p) => [r.map((v) => v * 1.25), hd(p)];
const TAIL = [[0, 10, 11], [2, 16, 9], [6, 21, 8], [10, 24, 9], [13, 26.4, 12.2]];
const tail = ['tail1', 'tail2'];

const eyeL = { side: 'L', at: hd([3.6, -14.1, 17.3]), size: 2.1 * 1.25, yaw: 22 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.5, 0.25, 0.72] });

const joints = [
  { name: 'root', at: [0, 1, 0] },
  { name: 'legFL', parent: 'root', at: [5.8, -5, 9] },
  { name: 'legFR', parent: 'root', at: [-5.8, -5, 9] },
  { name: 'legBL', parent: 'root', at: [6, 7, 9] },
  { name: 'legBR', parent: 'root', at: [-6, 7, 9] },
  { name: 'body', parent: 'root', at: [0, 1, 10] },
  { name: 'head', parent: 'body', at: [0, -9, 15.5] },
  { name: 'earL', parent: 'head', at: hd([5.6, -9.4, 16.6]) },
  { name: 'earR', parent: 'head', at: hd([-5.6, -9.4, 16.6]) },
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[2] },
  ...face.joints,
];

const leg = (x, y) => any(limb([x, y, 9], [x * 1.05, y, 2], 2.8, 2.6), ell([3, 3, 1.2], [x * 1.05, y, 4.6]), ell([2.8, 3.4, 1.6], [x * 1.05, y - 0.6, 1.6]),
  ell([2.4, 1.4, 1], [x * 1.05, y - 4, 0.8]));
// the frill fan in its own frame: translate(hd([5.6, -9.4, 16.6])) rotate([0, -12, 25]), scaled with the head
const frill = (c) => {
  const p = hd([5.6, -9.4, 16.6]);
  return ell([5.5, 3, 6.5], [p[0] + 3, p[1] + 1.2, p[2]])(c);
};
const parts = [
  ['legF*', leg(5.8, -5)],
  ['legB*', leg(6, 7)],
  ['body', any(blob([[[8.4, 8, 7], [0, 0, 12]], [[7, 7, 6.4], [0, 7, 12]], [[6.4, 6, 6], [0, -6, 13]]]), ell([6.2, 9, 3.4], [0, 0, 6.8]),
    ell([9, 13, 7], [0, 3, 18]), ell([4.8, 1.2, 2.6], [0, -8.6, 11]))],
  ['head', any(blob([hb([6, 5.4, 5.2], [0, -11, 16]), hb([4, 4, 3.4], [0, -16, 13.8]), hb([2.6, 2.6, 2.4], [0, -19, 13])]),
  spike(hd([0, -19, 14.6]), [0, -2.5, 4.8], 2), limb(hd([3.6, -9, 20]), hd([4.8, -7.4, 23]), 1.4, 0.4), limb(hd([-3.6, -9, 20]), hd([-4.8, -7.4, 23]), 1.4, 0.4))],
  ['ear*', frill],
  ...chain(['tail1', 'tail1', 'tail2', 'tail2'], TAIL, [5, 3.8, 2.6, 1.8, 0.6]),
  ['tail2', ell([3, 3, 3], [5, 20.5, 11])],
];

const assign = (c) => pick(c, parts);

const base = quadrupedClips({ face, tail, hipH: 9, stride: 14 });

const clips = {
  ...base,
  // fidget: flares the cheek frills wide and rattles the tail tip, a lizard's threat display
  idle_frill: {
    seconds: 2.2,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.15, 1], [0.72, 1], [0.88, 0]]);
      const rat = Math.sin(TAU * 12 * u) * win(u, 0.2, 0.7, 0.04);
      return merge({
        body: { r: [-3 * on, 0, 0] },
        head: { r: [-8 * on, 0, 0] },
        earL: { r: [0, 0, 22 * on], s: 1 + 0.12 * on },
        earR: { r: [0, 0, -22 * on], s: 1 + 0.12 * on },
        tail1: { r: [6 * on, 0, 0] },
        tail2: { r: [10 * on, 0, 6 * rat] },
        ...face.pose('open', 0.4 * on),
      });
    },
  },
  // fidget: basks: settles low, eyes shut, the plates on its back rising and falling with slow breaths
  idle_bask: {
    seconds: 3.2,
    pose: (t, u) => {
      const low = K(u, [[0, 0], [0.2, 1], [0.8, 1], [0.95, 0]]);
      return {
        root: { p: [0, 0, -0.8 * low] },
        body: { s: [1, 1, 1 + 0.03 * low * osc(u, 2)] },
        head: { r: [6 * low, 0, 4 * low] },
        ...face.pose(low > 0.5 ? 'shut' : 'open'),
      };
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
