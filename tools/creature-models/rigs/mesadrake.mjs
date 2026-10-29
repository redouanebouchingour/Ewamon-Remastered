// Mesadrake's rig: a low, heavy crawling drake with three mesa buttes on its back, splayed legs and a long tail lying
// on the ground. The dust swirls ride the root. Numbers are scad/mesadrake.scad's; the head sits in its
// translate([0, -9, 9]) scale(1.3) translate([0, 9, -9]) block (H()).
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, chain, ell, limb, pick, spike } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near, side, subFrame } from './lib/geo.mjs';
import { legs, quadrupedClips } from './lib/quadruped.mjs';

const MESA = [[0.78, 0.33, 0.13], [0.6, 0.24, 0.09], [0.85, 0.42, 0.18]];
const CLAW = [0.96, 0.9, 0.78];
const DUST = [0.98, 0.78, 0.45];

const HEAD = subFrame([0, -9, 9], [0, 0, 0], 1.3);
const H = (p) => HEAD.world([p[0], p[1] + 9, p[2] - 9]);
const Hr = (r) => r.map((v) => v * 1.3);

const eyeL = { side: 'L', at: [3.3, -9.9, 1], size: 1.8, yaw: -22, frame: HEAD };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.9, 0.68, 0.3] });

// mirror([1, 0, 0]): the tail sweeps to the creature's own left (+X)
const TAIL = [[0, 14, 7.5], [3, 20, 5], [8, 24, 3], [13, 24.5, 2], [16, 21.5, 1.6]];
const TAIL_R = [4.6, 3.6, 2.6, 1.7, 0.8];
const tail = ['tail1', 'tail2', 'tail3'];

const joints = [
  { name: 'root', at: [0, 1, 0] },
  { name: 'legFL', parent: 'root', at: [6.4, -6, 9] },
  { name: 'legFR', parent: 'root', at: [-6.4, -6, 9] },
  { name: 'legBL', parent: 'root', at: [6.4, 8, 9] },
  { name: 'legBR', parent: 'root', at: [-6.4, 8, 9] },
  { name: 'body', parent: 'root', at: [0, 2, 8] },
  { name: 'head', parent: 'body', at: [0, -9, 9.5] },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i] })),
  ...face.joints,
];

const legT = (y) => any(limb([6.4, y, 9], [10, y - 1, 5.5], 3.2, 2.6), limb([10, y - 1, 5.5], [10.4, y - 2, 1.6], 2.4, 2),
  ell([2.6, 3, 1.4], [10.4, y - 2.8, 1.4]), spike([10.4, y - 5.4, 1], [0, -1.4, -0.3], 1.4));
const parts = [
  ['legF*', legT(-6)],
  ['legB*', legT(8)],
  ['body', any(ell([9.5, 8.5, 6], [0, -2, 10]), ell([8.5, 8, 5.5], [0, 7, 9.5]), ell([6, 6, 4.5], [0, 14, 8]), ell([8.6, 8, 4], [0, -2, 7.2]),
    ell([7.6, 7.4, 3.6], [0, 7, 6.6]), ell([2, 3, 2.8], [8, 0, 9]), ell([2, 3, 2.8], [-8, 0, 9]), ell([2, 3, 2.8], [8.2, 6, 8.5]),
    ell([2, 3, 2.8], [-8.2, 6, 8.5]), ell([1.8, 2.8, 2.6], [6.6, -6.5, 10]))],
  ['head', any(ell(Hr([6.6, 5.6, 4.6]), H([0, -12.5, 9.5])), ell(Hr([5, 4, 3.4]), H([0, -17, 8])), ell(Hr([6, 4.6, 2.6]), H([0, -11, 12])),
    ell(Hr([1.5, 1.5, 2.5]), H([4.4, -10, 14.5])), ell(Hr([1.5, 1.5, 2.5]), H([-4.4, -10, 14.5])))],
  ...chain(['tail1', 'tail2', 'tail3'], TAIL, TAIL_R),
];

function assign(c, rgb) {
  if (near(rgb, DUST, 0.03)) return 'root';
  if (isAny(rgb, MESA, 0.03)) return 'body';
  if (near(rgb, CLAW, 0.03)) return `leg${c[1] < 1 ? 'F' : 'B'}${side(c)}`;
  return pick(c, parts);
}

const clips = quadrupedClips({ face, tail, hipH: 9, stride: 12 });

// fidget: stamps a front foot twice, raising dust, then a satisfied snort
clips.idle_stomp = {
  seconds: 2.2,
  pose: (t, u) => {
    const lift = (u0) => K(u, [[u0, 0], [u0 + 0.08, 1], [u0 + 0.14, 0]]);
    const st = lift(0.15) + lift(0.4);
    const snort = win(u, 0.62, 0.78, 0.04);
    return merge({
      ...legs({ r: [-18 * st, -10 * st, 0] }, { r: [0, 0, 0] }, { r: [0, 0, 0] }, { r: [0, 0, 0] }),
      body: { r: [-2 * st, 3 * st, 0] },
      head: { r: [-6 * snort + 2 * osc(u, 2), 0, 4 * snort] },
      ...face.pose(snort > 0.5 ? 'squeeze' : 'open'),
    }, Object.fromEntries(tail.map((n, i) => [n, { r: [0, 0, 6 * (1 + 0.3 * i) * osc(u, 2)] }])));
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
