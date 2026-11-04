// Mesadrake's rig: a long, low crawling drake with three mesa buttes on its back, a big round head on a short neck,
// splayed legs (the far front paw raised) and a long tail curling back on the ground. Numbers are
// scad/mesadrake.scad's; the head is authored in its translate(HP) rotate([0, 0, HR]) block (HEAD). The big and middle
// buttes ride the body, the small one sits on the tail root and rides tail1.
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { chain } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, capD, closest, ellD, fold, isAny, near, subFrame } from './lib/geo.mjs';
import { legs, quadrupedClips } from './lib/quadruped.mjs';

const VIOLET = [0.5, 0.3, 0.65];
const MESA = [[0.79, 0.38, 0.17], [0.6, 0.26, 0.12], [0.44, 0.22, 0.11], [0.9, 0.5, 0.24]];
const CLAW = [0.98, 0.89, 0.71];
const EYE_COLS = [[0.97, 0.95, 0.93], [0.24, 0.11, 0.28], [0.07, 0.03, 0.08], [1, 1, 1]];

const HP = [-2.5, -29.5, 17.5];
const HR = 0;
const HEAD = subFrame(HP, [0, 0, HR], 1);
const HEAD_BLOB = [[[9.5, 8, 8.6], [0, 0, 0.4]], [[7, 6, 4.8], [0, -5.5, -3.4]]];
const EYE = [5.1, -7.1, -0.3];
const EYE_S = 2.5;

const eyeL = { side: 'L', at: EYE, size: EYE_S, yaw: 26, flat: 0.55, frame: HEAD };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: VIOLET });

const BODY = [[[8, 7.5, 7.5], [-1.5, -22, 14.5]], [[10, 9.5, 10], [0, -13, 17]], [[9.5, 9, 9], [0, -1, 16]], [[9, 8.5, 8.5], [0.5, 11, 15.5]]];
const NECK = [-2.2, -24, 15.5];
const TAIL = [[0, 14, 15], [2.5, 24, 14.5], [7.5, 31, 12], [13.5, 35, 8.5], [16.5, 32, 5], [14.5, 26, 3], [11.5, 21.5, 2.2]];
const TAIL_R = [7, 5.8, 4.6, 3.4, 2.5, 1.7, 0.7];
const TAIL_UNDER = TAIL.slice(0, 4).map((p) => [p[0], p[1], p[2] - 1.3]);
const tail = ['tail1', 'tail2', 'tail3'];
const SEG = ['tail1', 'tail1', 'tail2', 'tail2', 'tail3', 'tail3'];

const SH_FL = [7.5, -15.5, 15];
const SH_FR = [-7.5, -16.5, 15];
const HIP = [7.5, 10, 13.5];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legFL', parent: 'root', at: SH_FL },
  { name: 'legFR', parent: 'root', at: SH_FR },
  { name: 'legBL', parent: 'root', at: HIP },
  { name: 'legBR', parent: 'root', at: [-HIP[0], HIP[1], HIP[2]] },
  { name: 'body', parent: 'root', at: [0, -1, 15] },
  { name: 'head', parent: 'body', at: NECK },
  { name: 'eyeL', parent: 'head', at: HEAD.world(EYE) },
  { name: 'eyeR', parent: 'head', at: HEAD.world([-EYE[0], EYE[1], EYE[2]]) },
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[2] },
  { name: 'tail3', parent: 'tail2', at: TAIL[4] },
  ...face.joints,
];

// foot(p, ry): ell([3.8, 4.4, 2], [0, 0, 0.2]) and three claws reaching 5.4 forward
const footD = (c, p) => Math.min(ellD(c, [3.8, 4.4, 2.2], [p[0], p[1], p[2] + 0.2]), capD(c, [p[0], p[1] - 3, p[2]], [p[0], p[1] - 5.6, p[2] - 0.6], 2.8, 1));
const legFL = (c) => Math.min(ellD(c, [5, 5.4, 5.4], SH_FL), capD(c, SH_FL, [12, -17, 8], 4.4, 3.9), capD(c, [12, -17, 8], [11, -19.5, 2.8], 3.7, 3),
  capD(c, [13.2, -14.6, 9], [12.4, -16.6, 3.4], 2.6, 1.9), footD(c, [11, -21, 1.6]));
const legFR = (c) => Math.min(ellD(c, [5, 5.4, 5.4], SH_FR), capD(c, SH_FR, [-12, -20, 9], 4.1, 3.6), capD(c, [-12, -20, 9], [-11, -24, 5], 3.4, 2.8),
  footD(c, [-11, -25.5, 3.8]));
// hind legs, mirrored: test the folded point
const legB = (f) => Math.min(ellD(f, [5.4, 6, 6], HIP), capD(f, HIP, [12, 7, 8], 4.2, 3.6), capD(f, [12, 7, 8], [11.5, 8.6, 2.6], 3.3, 2.7),
  footD(f, [11.5, 7, 1.6]));

const headD = (c) => {
  const l = HEAD.local(c);
  const f = fold(l);
  return Math.min(blobD(l, HEAD_BLOB), capD(f, [5.4, 0.2, 5], [6.9, 1.6, 10.4], 2.1, 0.5), ellD(c, [7, 7, 6.8], NECK));
};
const bodyD = (c) => Math.min(blobD(c, BODY), ellD(c, [7.5, 7, 7], [-2.5, -21, 19.5]));
const tailParts = [...chain(SEG, TAIL, TAIL_R), ...chain(SEG, TAIL_UNDER, TAIL_R.slice(0, 4).map((r) => r * 0.88))];

function assign(c, rgb) {
  const l = HEAD.local(c);
  const S = l[0] >= 0 ? 'L' : 'R';
  const dEye = Math.hypot(Math.abs(l[0]) - EYE[0], l[1] - EYE[1], l[2] - EYE[2]);
  if (dEye < EYE_S * 1.45 && isAny(rgb, EYE_COLS, 0.03)) return `eye${S}`;
  if (isAny(rgb, MESA, 0.03)) return Math.hypot(c[0] - 3.5, c[1] - 26) < 7 ? 'tail1' : 'body';
  const B = c[0] >= 0 ? 'L' : 'R';
  if (near(rgb, CLAW, 0.03)) {
    if (c[1] > 0) return `legB${B}`;
    return `legF${B}`;
  }
  return closest([
    ['head', headD(c)],
    ['body', bodyD(c)],
    ['legFL', legFL(c)],
    ['legFR', legFR(c)],
    [`legB${B}`, legB(fold(c))],
    ...tailParts.map(([n, t]) => [n, t(c)]),
  ]);
}

const clips = quadrupedClips({ face, tail, hipH: 14, stride: 12 });

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
