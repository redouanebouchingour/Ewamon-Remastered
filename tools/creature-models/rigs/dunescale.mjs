// Dunescale's rig: a chunky orange ankylosaur on four short legs, a domed shell of rust plates on its back, a big
// horned head turned 20 deg to its right (scaled 1.12 in the scad: HF), two purple fin frills behind the cheeks and a
// short tail with a purple spike tip. Numbers are scad/dunescale.scad's.
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, blob, chain, ell, limb } from './lib/biped.mjs';
import { eyeKit } from './lib/face.mjs';
import { blobD, capD, closest, ellD, fold, isAny, near, plateD, rot, subFrame } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const FACE = [0.95, 0.72, 0.33];
const VIOLET = [0.5, 0.26, 0.72];
const EYE_COLS = [[0.97, 0.96, 0.97], [0.17, 0.12, 0.14], [0.24, 0.12, 0.32], [1, 1, 1]];

// the head block: translate(HP) rotate([0, 0, HR]) scale(HS)
const HP = [-1.5, -16.4, 26.5];
const HR = -20;
const HS = 1.12;
const HF = subFrame(HP, [0, 0, HR], HS);
const HEAD = [[[6.2, 6.5, 7], [0, 1, 1]], [[4.6, 5, 4.8], [0, -5, -2.5]], [[3.6, 3.5, 3.8], [0, -11, -4.6]]];
const EYE = [5, -3, 0.6];
const EYE_S = 3;
const add = (a, b) => a.map((v, i) => v + b[i]);
const inHead = (p) => add(HP, rot([0, 0, HR], p.map((v) => v * HS)));

// eye frames: translate(EYE) rotate([0, 35, 50]) inside the head, mirrored for the far (right) eye
const eyeL = { side: 'L', at: [0, 0, 0], size: EYE_S, frame: subFrame(inHead(EYE), [0, 35, HR + 50], HS) };
const eyeR = { side: 'R', at: [0, 0, 0], size: EYE_S, frame: subFrame(inHead([-EYE[0], EYE[1], EYE[2]]), [0, -35, HR - 50], HS) };
const face = eyeKit({ eyes: [eyeL, eyeR], skin: FACE });

// frill fans: translate([4.6, 3, 0.5]) rotate([0, 0, 12]) plate(FAN) inside the head, mirrored
const FAN = [[-0.3, -4.5], [-0.6, 4.5], [5.6, 10.5], [7.5, 8.2], [10.2, 6.5], [9.2, 4.6], [10, 2.2], [9.5, 0.2], [7.8, -2.2], [3.8, -5]];
const RIM = [[-1, 3.8], [-0.5, 5.2], [5.4, 10.8], [6.9, 12.6], [6.3, 10], [0.4, 4.2]];
const FRILL = subFrame([4.6, 3, 0.5], [0, 0, 12], 1);

const TAIL = [[0, 13, 12.5], [2.5, 19, 10.8], [5.5, 24.5, 10], [8, 28.5, 10.4]];
const tail = ['tail1', 'tail2'];
const SC = [0, 3.5, 18];
const SR = [10, 15.5, 15];
const BODY = [[[6.5, 5.5, 6], [0, -15, 14.5]], [[8, 9, 6], [0, -3, 14]], [[7.5, 8, 5.8], [0, 8, 13.5]], [[6, 5, 5], [0, 14, 13]]];

const joints = [
  { name: 'root', at: [0, -2, 0] },
  { name: 'legFL', parent: 'root', at: [7, -15, 11.5] },
  { name: 'legFR', parent: 'root', at: [-7, -15, 11.5] },
  { name: 'legBL', parent: 'root', at: [7, 11, 11.5] },
  { name: 'legBR', parent: 'root', at: [-7, 11, 11.5] },
  { name: 'body', parent: 'root', at: [0, -2, 13] },
  { name: 'head', parent: 'body', at: [-0.8, -13, 20] },
  { name: 'eyeL', parent: 'head', at: inHead(EYE) },
  { name: 'eyeR', parent: 'head', at: inHead([-EYE[0], EYE[1], EYE[2]]) },
  { name: 'earL', parent: 'head', at: inHead([4.6, 3, 0.5]) },
  { name: 'earR', parent: 'head', at: inHead([-4.6, 3, 0.5]) },
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[2] },
  ...face.joints,
];

const leg = (y, t) => any(ell([4.2 * t, 4.6 * t, 4.8 * t], [7, y, 11.5]), limb([7, y, 10], [7, y - 0.4, 3], 3.6, 3.3), ell([3.9, 3.9, 1.6], [7, y - 0.3, 6.2]),
  ell([3.8, 4.3, 2], [7, y - 1, 2]), limb([7, y - 4.3, 1.2], [7, y - 6, 0.6], 2.6, 0.6));

// the head's own parts, tested in the head frame
const headD = (l) => Math.min(blobD(l, HEAD), ellD(l, [4.8, 4.6, 2.4], [0, -3.6, 5.6]), ellD(l, [5, 4.4, 2.8], [0, 2.6, 6.6]),
  capD(l, [0, 3.6, 9], [0, 6, 12], 2, 0.6), capD(l, [0, -10.6, -2.4], [0, -15.2, 1], 3.1, 0.5));
const frillD = (l) => { const f = FRILL.local(fold(l)); return Math.min(plateD(f, FAN, 1.6), plateD(f, RIM, 1.8)); };

const bodyD = (c) => Math.min(blobD(c, BODY), ellD(c, SR, SC), capD(c, [0, -11, 17], [-1.2, -15, 22], 5, 4.5));
const tailParts = [
  ...chain(['tail1', 'tail1', 'tail2'], TAIL, [4.4, 3.5, 2.6, 1.8]),
  ['tail2', limb(TAIL[3], [9.6, 31.1, 12], 1.9, 0.4)],
];

function assign(c, rgb) {
  const l = HF.local(c);
  const S = l[0] >= 0 ? 'L' : 'R';
  const dEye = Math.hypot(Math.abs(l[0]) - EYE[0], l[1] - EYE[1], l[2] - EYE[2]);
  if (dEye < 3.7 && isAny(rgb, EYE_COLS, 0.03)) return `eye${S}`;
  if (dEye < 2.4 && near(rgb, VIOLET, 0.03)) return `eye${S}`;
  const f = fold(c);
  const side = c[0] >= 0 ? 'L' : 'R';
  return closest([
    ['head', headD(l)],
    [`ear${S}`, frillD(l)],
    ['body', bodyD(c)],
    [`legF${side}`, leg(-15, 1)(f)],
    [`legB${side}`, leg(11, 1.1)(f)],
    ...tailParts.map(([n, t]) => [n, t(c)]),
  ]);
}

const base = quadrupedClips({ face, tail, hipH: 11.5, stride: 14 });

const clips = {
  ...base,
  // fidget: flares the frills up and wide and rattles the tail spike, a lizard's threat display
  idle_frill: {
    seconds: 2.2,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.15, 1], [0.72, 1], [0.88, 0]]);
      const rat = Math.sin(TAU * 12 * u) * win(u, 0.2, 0.7, 0.04);
      return merge({
        body: { r: [-3 * on, 0, 0] },
        head: { r: [-8 * on, 0, 0] },
        earL: { r: [0, -16 * on, 0], s: 1 + 0.12 * on },
        earR: { r: [0, 16 * on, 0], s: 1 + 0.12 * on },
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
