// Hollowmane Rage's rig: Hollowmane's skeleton and clips (rigs/hollowmane.mjs) on the rage body: the jaw hangs open
// at rest and gapes wider, the tall crown horns go with the skull, the long shoulder spikes with the arms, the barbed
// blades, wrist claws and blade flames with the forearms and the foot flames with the legs; the blood-red mane streaks
// hang with the mane. A fidget of its own shakes with fury. Numbers are scad/hollowmane_rage.scad's.
import { K, TAU, both, osc, win } from './lib/anim.mjs';
import { any, chain, ell, limb, spike } from './lib/biped.mjs';
import { unrot } from './lib/geo.mjs';
import { H, add, baseClips, face, fidgets, hollowRig, inHead, inHeadMx, parts as baseParts } from './hollowmane.mjs';

const JAW = 50;
const HINGE = [0, -0.8, -2.6];
// a point in the dropped jaw's own numbers (scad: translate(HINGE) rotate([JAW, 0, 0]) translate(-HINGE) inside the skull)
const inJaw = (test) => (c) => {
  const l = H.local(c);
  const q = unrot([JAW, 0, 0], [l[0] - HINGE[0], l[1] - HINGE[1], l[2] - HINGE[2]]);
  return test([q[0] + HINGE[0], q[1] + HINGE[1], q[2] + HINGE[2]]);
};
const deg = Math.PI / 180;
const lowerTeeth = []; for (let a = 200; a <= 340; a += 20) lowerTeeth.push(ell([0.19, 0.16, 0.55], [1.6 * Math.cos(a * deg), -2.5 + 1.62 * Math.sin(a * deg), -2.8]));

const BLADE = [[15, -1, 18.6], [17, -1.2, 15.8], [18.8, -1.4, 12.4], [19.8, -1.5, 9], [20.1, -1.5, 6], [19.6, -1.4, 3.9], [18.8, -1.3, 2.9]];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const plus = (a, b) => a.map((v, i) => v + b[i]);
const nrm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const barbs = [];
for (let k = 1; k <= 5; k++) {
  const p = BLADE[k]; const d = nrm(sub(BLADE[k - 1], p)).map((x) => x * 2);
  barbs.push(spike(plus(p, [0.9, 0, 0.2]), plus(d, [2.3, 0.2, 0.8]), 0.8), spike(plus(p, [-0.8, -0.2, 0.4]), plus(d, [-1.5, -0.3, 0.5]), 0.7));
}
// scad flame(p, h): a drop at p, a waist at p + [0.12 h, 0, 0.55 h], a tip at p + [-0.05 h, 0, h]
const flame = ([x, y, z, h]) => {
  const m = [x + h * 0.12, y, z + h * 0.55];
  return any(limb([x, y, z], m, 1.1, 0.6), limb(m, [x - h * 0.05, y, z + h], 0.6, 0.1));
};

const parts = [
  ...baseParts.filter(([j]) => j !== 'jaw'),
  ['jaw', inJaw(any(ell([1.5, 1.65, 0.85], [0, -2.5, -3.5]), ...lowerTeeth))],
  ['head', any(inHead(ell([1.45, 1.5, 1.1], [0, -1.9, -3])), inHead(ell([1.35, 0.9, 1.1], [0, -3.1, -3.5])),
    inHeadMx((l) => Math.min(...chain(['h'], [[1.6, 0.6, 3.6], [2.4, 0.9, 6.3], [2.9, 2, 8.4], [3, 3.6, 9.6]], [0.9, 0.75, 0.5, 0.12]).map(([, t]) => t(l)))))],
  ['arm*', any(spike([9.4, 2, 28.5], [9, 2, 10.5], 1.4), spike([9.8, 2.4, 29], [8.4, 1.9, 9.6], 0.75), spike([10.6, 1, 26.6], [7, 0.5, 4.2], 1.2),
    ell([0.6, 0.6, 1.5], [9, -2.8, 27.2]))],
  ['body', ell([4, 0.7, 4], [0, -5.05, 21.2])],
  ['fore*', any(...barbs,
    ...[-1, 0, 1].map((k) => (c) => Math.min(...chain(['f'], [[15.4 + 0.5 * k, -1.8, 16.8], [15.6 + 0.8 * k, -3.2, 15.6], [15.3 + 0.9 * k, -3.6, 14.4]], [0.42, 0.3, 0.06]).map(([, t]) => t(c)))),
    ...[[19.4, 0.4, 10.5, 4.2], [21.4, -1.5, 7.5, 5], [20.8, -2, 13.5, 4], [18.2, -3.6, 4.5, 4.4], [16.8, -2, 18.5, 3.4]].map(flame))],
  ...chain(['fore*'], BLADE, [1.2, 1.55, 1.6, 1.4, 1.05, 0.55, 0.1]),
  ['leg*', any(...[[11.8, -0.8, 1.2, 4.4], [8.2, -1.4, 1.2, 3.6], [12.3, 2.4, 1.2, 3.8], [7.6, 2.6, 1.6, 3]].map(flame))],
];

const clips = {
  ...baseClips({
    stride: 16, armSwing: 14,
    add: {
      ...add,
      idle: (t, u) => ({ jaw: { r: [3 + 2 * osc(u, 4), 0, 0] } }),
      celebrate: (t, u) => ({ jaw: { r: [12 * win(u, 0.05, 0.95, 0.1), 0, 0] } }),
    },
  }),
  ...fidgets,

  // fidget: fury boils over: it trembles, hunches, flexes both blades out wide and roars with the jaw gaping
  idle_fury: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.25, 1], [0.75, 1], [0.95, 0]]);
      const tr = Math.sin(TAU * 14 * u) * on;
      return {
        root: { r: [0, 0, 0.8 * tr] },
        body: { r: [6 * on, 0, 0], p: [0, 0, -0.4 * on] },
        head: { r: [-12 * on + tr, 0, 0] },
        jaw: { r: [16 * on, 0, 0] },
        ...both('arm', { r: [-10 * on, -22 * on + tr, 0] }),
        ...both('fore', { r: [-18 * on, 0, 0] }),
        cape1: { r: [-6 * on + tr, 0, 0] },
        ...face.pose('open', 0),
      };
    },
  },
};

export default hollowRig({ list: parts, maneCols: [[0.72, 0.09, 0.22]], clips });
