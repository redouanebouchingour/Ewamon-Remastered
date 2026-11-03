// Bloomdrake's rig: a caterpillar-dragon on four pairs of stubby legs, so it uses the insect template with hanging legs
// (`hang`, tripod phases over four pairs): the upright chest, the neck and the first three body pods are the body, the
// pods curling back to its left are the abdomen, the head carries the antlers, the leaf wings are spread in a V, and
// the tail stem (tail1) carries the flower (tail2). Numbers are scad/bloomdrake.scad's: the head block is
// `translate(HC)`, each pod `translate(p) rotate([0, 0, -heading])`, each wing `translate(WR) rotate([0, 0, 18])`.
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { insectClips } from './lib/insect.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { capD, chainHit, closest, ellD, fold, near, side, subFrame } from './lib/geo.mjs';

const SKIN = [0.45, 0.56, 0.32];
const FEATHER = [[0.41, 0.52, 0.3], [0.48, 0.6, 0.35]];
const RED = [0.8, 0.36, 0.22];
const ANTLER = [0.62, 0.47, 0.33];
const FLOWER = [[0.95, 0.6, 0.24], [0.8, 0.34, 0.14], [0.52, 0.34, 0.15], [0.92, 0.74, 0.42]];

const HC = [0, 0.2, 21.8];
const headF = subFrame(HC);
const CH = [0, -2];
const CHS = [[6.0, [4.3, 3.9, 2.6]], [9.4, [4.5, 4.1, 2.6]], [12.8, [4.2, 3.8, 2.5]], [16.0, [3.6, 3.3, 2.4]]];
const PODS = [
  [1, 1.5, 6.1, 19, [4.0, 3.2, 3.4]],
  [2.25, 4.5, 5.9, 34, [3.8, 3.0, 3.3]],
  [4.73, 7, 5.7, 48, [3.7, 3.0, 3.25]],
  [7.5, 9.2, 5.5, 54, [3.6, 2.9, 3.15]],
  [10.3, 11, 5.2, 61, [3.4, 2.8, 3.0]],
  [13.2, 12.3, 4.8, 69, [3.0, 2.6, 2.7]],
  [15.9, 13.2, 4.2, 72, [2.3, 2.3, 2.2]],
];
const STEM = [[15.9, 13.2, 4.1], [17.5, 13.6, 6.0], [18.0, 13.6, 9.8], [17.9, 13.4, 13.6]];
const STEM_R = [2.0, 1.5, 1.15, 0.9];
const WR = [2.2, 2.0, 14.6];

// the legs as the scad's legPair() places them: hip top (z 3.4) and foot (z 1.1), per pair and side
const LEG_DEF = [[0, -2.3, 0, 2.6], [2.25, 4.5, 40, 2.6], [6.1, 8.1, 48, 2.6], [10.3, 11, 62, 2.4]];
const LEGS = LEG_DEF.flatMap(([x, y, a, o], i) => [1, -1].map((sg) => {
  const n = [Math.cos(a * Math.PI / 180) * sg, -Math.sin(a * Math.PI / 180) * sg];
  const h = [x + n[0] * o, y + n[1] * o];
  return { name: `leg${i + 1}${sg > 0 ? 'L' : 'R'}`, top: [h[0], h[1], 3.4], foot: [h[0] + n[0] * 0.4, h[1] + n[1] * 0.4, 1.1] };
}));

const eyeL = { side: 'L', at: [3.4, -3.4, 1.2], size: 1.75, yaw: 28, flat: 0.45, frame: headF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: SKIN });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...LEGS.map((l) => ({ name: l.name, parent: 'root', at: l.top })),
  { name: 'body', parent: 'root', at: [0.5, 1.5, 4] },
  { name: 'abdomen', parent: 'body', at: [6.1, 8.1, 5.6] },
  { name: 'tail1', parent: 'abdomen', at: STEM[0] },
  { name: 'tail2', parent: 'tail1', at: STEM[3] },
  { name: 'head', parent: 'body', at: [0, -0.8, 18.0] },
  { name: 'wingL', parent: 'body', at: WR },
  { name: 'wingR', parent: 'body', at: [-WR[0], WR[1], WR[2]] },
  ...face.joints,
];

const podD = (c, i) => {
  const [x, y, z, a, r] = PODS[i];
  return ellD(subFrame([x, y, z], [0, 0, -a]).local(c), [r[0] * 1.25, r[1] * 1.05, r[2] * 1.12]);
};
const pods = (c, lo, hi) => Math.min(...PODS.slice(lo, hi).map((_, k) => podD(c, lo + k)));
const headD = (c) => {
  const q = headF.local(c);
  const f = fold(q);
  return Math.min(
    ellD(q, [5.6, 4.8, 4.5], [0, 0.3, 0.6]), ellD(q, [6.0, 4.2, 3.0], [0, -0.6, -1.6]), ellD(q, [3.8, 3.3, 2.6], [0, -4.0, -1.4]),
    ellD(q, [2.9, 2.6, 1.6], [0, -2.0, 4.25]), ellD(q, [2.5, 2.3, 1.3], [0, 1.0, 4.7]), ellD(q, [2.3, 2.0, 1.6], [0, 3.6, 3.0]),
    ellD(q, [2.2, 2.0, 1.6], [0, 4.9, 0.3]),
    ellD(f, [1.6, 1.4, 2.0], [5.9, 1.3, 3.7]), ellD(f, [1.8, 1.2, 1.0], [6.4, 0.9, 0.5]),
  );
};
const chestD = (c) => Math.min(
  ...CHS.map(([z, r]) => ellD(c, [r[0] * 1.06, r[1] * 1.06, r[2] * 1.06], [CH[0], CH[1], z])),
  ...CHS.map(([z, r]) => ellD(c, [2.2, 1.4, 1.6], [CH[0], CH[1] + r[1] * 0.8, z + 0.3])),
  ellD(fold(c), [1.6, 2.2, 2.2], [3.2, -0.8, 12.6]), ellD(fold(c), [1.4, 2.0, 2.0], [3.2, -0.8, 15.8]),
);
const legD = (c, l) => capD(c, l.top, l.foot, 2.1, 1.8);

function assign(c, rgb) {
  const S = side(c);
  if (FLOWER.some((f) => near(rgb, f, 0.015))) return 'tail2';
  if (near(rgb, ANTLER, 0.015)) return 'head';
  if (FEATHER.some((f) => near(rgb, f, 0.015))) return `wing${S}`;
  if (near(rgb, RED, 0.03)) {
    if (c[2] < 2.2) return closest(LEGS.map((l) => [l.name, legD(c, l)]));
    return headD(c) < 1.6 ? 'head' : `wing${S}`;
  }
  const stem = chainHit(c, STEM, STEM_R);
  return closest([
    ...LEGS.map((l) => [l.name, legD(c, l) * (c[2] < 2.6 ? 0.85 : 1.1)]),
    ['head', headD(c)],
    ['body', Math.min(chestD(c), pods(c, 0, 3))],
    ['abdomen', pods(c, 3, 7)],
    ['tail1', stem.d * (c[2] > 6 ? 0.9 : 1.15)],
  ]);
}

const wings = (a) => ({ wingL: { r: [0, -a, 0] }, wingR: { r: [0, a, 0] } });

const clips = {
  ...insectClips({
    face, tail: ['tail1', 'tail2'], legs: 4, hang: true, stride: 12, lift: 10, buzz: 18,
    add: {
      walk: (t, u) => wings(4 * osc(u, 2)),
      idle: (t, u) => merge(wings(3 * osc(u, 1)), { tail2: { r: [0, 0, 6 * osc(u, 1, 0.3)] } }),
      celebrate: (t, u) => wings(20 * Math.abs(Math.sin(TAU * 2 * u))),
    },
  }),

  // fidget: shakes its antlered head like a stag, then the flower on its tail turns to the sun and bobs
  idle_bloom: {
    seconds: 2.8,
    pose: (t, u) => {
      const sh = Math.sin(TAU * 6 * u) * win(u, 0.06, 0.4, 0.05);
      const turn = K(u, [[0.42, 0], [0.56, 1], [0.86, 1], [0.98, 0]]);
      return merge({
        head: { r: [4 * Math.abs(sh), 0, 14 * sh] },
        ...face.pose(Math.abs(sh) > 0.3 ? 'squeeze' : 'open'),
        tail1: { r: [-10 * turn, 0, 16 * turn] },
        tail2: { r: [0, 0, 20 * turn + 6 * osc(u, 4) * turn] },
      }, wings(6 * turn));
    },
  },
};

// the rear legs stand under the abdomen's pods: blend them into it like the front ones into the body
const seams = { allow: [['abdomen', 'leg3L'], ['abdomen', 'leg3R'], ['abdomen', 'leg4L'], ['abdomen', 'leg4R']] };

export default rigDef({ joints, assign, extras: face.extras, clips, seams });
