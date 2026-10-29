// Galaxion's rig: a hulking armoured dragon standing hunched on two legs, huge plated forearms hanging low with long
// claws, a galaxy core in its chest, a wedge head with a glowing jaw and flame-tipped horns, a burning tail. Numbers are
// scad/galaxion.scad's; the head sits in its translate([0, -3, 31]) scale(1.35) translate([0, 3, -31]) block (H()).
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, pair, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { subFrame } from './lib/geo.mjs';

const HF = subFrame([0, -3, 31], [0, 0, 0], 1.35);
const H = (p) => HF.world([p[0], p[1] + 3, p[2] - 31]);
const local = (c) => { const q = HF.local(c); return [q[0], q[1] - 3, q[2] + 31]; };
const inHead = (test) => (c) => test(local(c));

const eyeL = { side: 'L', at: [3, -2.75, 3.1], size: 1.5, yaw: -30, frame: HF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.26, 0.22, 0.22] });

const TAIL = [[2, 5, 10], [7, 9, 7], [13, 9, 6], [18, 6, 7], [21, 2, 9]];
const tail = ['tail1', 'tail2', 'tail3'];

const joints = [
  { name: 'root', at: [0, 0.5, 0] },
  ...pair('leg*', 'root', [4.5, 1, 11]),
  { name: 'body', parent: 'root', at: [0, 0.5, 12] },
  { name: 'head', parent: 'body', at: [0, -1, 28] },
  { name: 'jaw', parent: 'head', at: H([0, -2, 30.6]) },
  ...pair('arm*', 'body', [10.5, 0, 24]),
  ...pair('fore*', 'arm*', [13.5, -1.5, 16]),
  ...pair('hand*', 'fore*', [14.6, -3, 8.5]),
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[1] },
  { name: 'tail3', parent: 'tail2', at: TAIL[3] },
  ...face.joints,
];

const parts = [
  ['leg*', any(limb([4.5, 1, 11], [6.5, -0.5, 6], 3.6, 3.2), limb([6.5, -0.5, 6], [7, 0.5, 2], 2.8, 2.4), ell([2.4, 2, 2.4], [6.7, -3, 6]),
    blob([[[3, 4, 1.5], [7, -2, 1.5]], [[2.4, 2, 1.4], [7, 1, 1.5]]]), limb([7, -5.6, 1.1], [7, -7.2, 0.5], 1.2))],
  ['body', any(ell([9, 6.5, 7], [0, 0, 22]), ell([6, 5, 5], [0, 0.5, 15]), ell([6.5, 5, 3], [0, 0.5, 10]), ell([4.6, 2.2, 4.6], [0, -6, 21]),
    ell([4.6, 4.4, 3.6], [9.5, 0, 26]), ell([4.6, 4.4, 3.6], [-9.5, 0, 26]), limb([0, 5, 26], [0, 8, 14], 2.6), ell([4, 2.4, 5], [4.2, 5.8, 24]),
    ell([4, 2.4, 5], [-4.2, 5.8, 24]))],
  ['arm*', limb([10.5, 0, 24], [13, -1, 17], 2.6, 2.4)],
  ['fore*', any(blob([[[3.6, 3.6, 3.2], [13.5, -1.5, 16]], [[3.2, 3.2, 3], [14.5, -2.5, 10]]]), ell([1.6, 4.4, 6.4], [16.8, -2, 13]),
    ell([2, 2.6, 2.6], [18, -2, 13]), limb([13.5, 1, 17.5], [14.7, 3.2, 18.5], 1.2))],
  ['hand*', any(ell([2.6, 2.6, 2], [14.6, -3, 7.5]), limb([14.6, -4, 6.5], [15, -6.5, 2], 2.4))],
  ['head', any(limb([0, 0, 27], [0, -3, 30], 4.2, 3.6), inHead(any(ell([4.4, 4, 3.6], [0, -3, 33]), ell([2.8, 3.4, 2.2], [0, -8.5, 31.5]),
    limb([3, -1.5, 35], [6, -0.5, 38.3], 1.4), limb([-3, -1.5, 35], [-6, -0.5, 38.3], 1.4), ell([2.5, 2, 4], [6, -0.5, 41]),
    ell([2.5, 2, 4], [-6, -0.5, 41]), limb([0, -1, 35.5], [0, 0.5, 38], 1.6))))],
  ['jaw', inHead(any(ell([3.4, 2.6, 1.3], [0, -4, 30]), ell([2.2, 2.6, 1], [0, -8, 29.8])))],
  ...chain(['tail1', 'tail2', 'tail3', 'tail3'], TAIL, [3.2, 2.8, 2.3, 1.8, 1.3]),
  ['tail3', any(ell([4, 4, 7], [21, 1.5, 14]), ell([3, 3, 5], [17, 6, 10]))],
];

function assign(c) {
  const j = pick(c, parts);
  if (j === 'head' || j === 'jaw') {
    const q = local(c);
    if (q[1] < -2.5 && q[2] < 30.45 && q[2] > 27) return 'jaw';
    return 'head';
  }
  return j;
}

const base = bipedClips({ face, tail, hipH: 11, stride: 16, armSwing: 14, droop: 0.6 });

const clips = {
  ...base,

  // fidget: flexes the huge forearms one after the other, claws spreading, a rumble in the throat
  idle_flex: {
    seconds: 2.4,
    pose: (t, u) => {
      const l = K(u, [[0.05, 0], [0.2, 1], [0.38, 1], [0.48, 0]]);
      const r = K(u, [[0.45, 0], [0.6, 1], [0.78, 1], [0.88, 0]]);
      return merge({
        body: { r: [-3 * (l + r), 0, 4 * (l - r)] },
        armL: { r: [-20 * l, -25 * l, 0] },
        foreL: { r: [-60 * l, 0, 0] },
        handL: { r: [0, 0, 6 * l * osc(u, 6)] },
        armR: { r: [-20 * r, 25 * r, 0] },
        foreR: { r: [-60 * r, 0, 0] },
        handR: { r: [0, 0, -6 * r * osc(u, 6)] },
        jaw: { r: [6 * (l + r), 0, 0] },
        ...face.pose('open', 0.3 * (l + r)),
      }, Object.fromEntries(tail.map((n, i) => [n, { r: [0, 0, 6 * (1 + 0.3 * i) * osc(u, 2)] }])));
    },
  },

  // fidget: throws its head back in a silent roar, jaw wide, horns' flames flaring
  idle_roar: {
    seconds: 2,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.25, 1], [0.65, 1], [0.85, 0]]);
      const tr = osc(u, 14) * win(u, 0.25, 0.65, 0.05);
      return merge({
        body: { r: [-8 * up, 0, 0] },
        head: { r: [-24 * up + 1.5 * tr, 0, 0] },
        jaw: { r: [30 * up + 2 * tr, 0, 0] },
        ...face.pose(up > 0.5 ? 'squeeze' : 'open'),
        ...{ armL: { r: [0, -16 * up, 0] }, armR: { r: [0, 16 * up, 0] } },
      }, Object.fromEntries(tail.map((n, i) => [n, { r: [10 * up, 0, 4 * (1 + 0.3 * i) * tr] }])));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
