// Budwing's rig: Bloomdrake's hatchling, a caterpillar-dragon on four pairs of stubby legs, so like Bloomdrake it uses
// the insect template with hanging legs (`hang`, four pairs): the upright ringed neck and the first three plated pods
// are the body, the pods curling back to its left the abdomen, the big head carries the antlers and its plates, the
// small leaf wings sit behind the neck, the tail stalk (tail1) carries the flower bud (tail2). The eyes are painted
// decals on the head, so the eyeKit lids are sized to cover them. Numbers are scad/budwing.scad's: the head block is
// `translate(HC)`, each pod `translate(p) rotate([0, 0, -heading])`.
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { insectClips } from './lib/insect.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { capD, chainHit, closest, ellD, fold, isAny, near, side, subFrame } from './lib/geo.mjs';

const SKIN_LT = [0.52, 0.65, 0.37];
const FEATHER = [[0.42, 0.54, 0.31], [0.56, 0.69, 0.4]];
const RED = [0.8, 0.36, 0.22];
const ANTLER = [0.6, 0.45, 0.33];
const BUD = [[0.96, 0.52, 0.16], [0.82, 0.3, 0.14], [1, 0.8, 0.35], [0.5, 0.66, 0.36]];
const STALK_C = [0.45, 0.32, 0.24];
const FACE = [[0.98, 0.56, 0.16], [0.86, 0.26, 0.12], [1, 0.84, 0.4], [0.13, 0.14, 0.08], [0.9, 0.9, 0.74]];

const HC = [0, -7.8, 24.6];
const headF = subFrame(HC);
const CR = [[0, -0.8, 0.5], [8.6, 8.0, 6.6]];
const SN = [[0, -4.5, -0.6], [8.0, 5.0, 5.0]];
const JW = [[0, -2.6, -4.3], [7.6, 5.4, 2.8]];
// the head's bark plates (head frame): [centre, largest radius], the mirrored ones folded to +X
const HEAD_PLATES = [[[0, -5.6, 5.0], 2.2], [[0, -1.2, 6.7], 2.6], [[0, 3.0, 6.0], 2.4], [[0, 6.0, 3.3], 2.2], [[0, 7.3, -0.6], 2.0],
  [[5.6, 4.6, 0.4], 1.8], [[6.0, 3.6, -2.4], 1.9], [[5.2, 5.2, 2.6], 1.8], [[3.6, 0.8, 5.8], 2.0], [[5.0, 4.0, 3.4], 1.9],
  [[3.8, 6.4, -0.2], 1.8], [[3.0, 6.0, -3.8], 1.7]];
const CH = [0, -2];
const CHS = [[5.6, [4.3, 4.0, 2.5], 0], [8.7, [5.1, 4.6, 2.5], -0.6], [11.8, [5.3, 4.7, 2.5], -0.8], [14.8, [4.7, 4.2, 2.4], -0.5],
  [17.6, [4.1, 3.8, 2.3], -0.5]];
const NP = [[18.2, 4.1, 3.8, -0.5], [15.0, 4.7, 4.2, -0.5], [12.0, 5.3, 4.7, -0.8], [9.0, 5.1, 4.6, -0.6]];
// the neck's plates (folded to +X): back column, back-side column, flank column with the runes
const NECK_PLATES = NP.flatMap(([z, rx, ry, dy]) => [
  [[0, CH[1] + dy + ry * 0.98, z + 0.6], 2.0], [[rx * 0.62, CH[1] + dy + ry * 0.76, z], 2.0], [[rx * 0.92, CH[1] + dy + ry * 0.12, z - 0.2], 2.1],
]);
const PODS = [
  [1, 1.5, 8.7, 19, [4.0, 3.2, 3.6]],
  [2.5, 4.5, 8.5, 34, [3.9, 3.1, 3.5]],
  [5.0, 7.0, 8.3, 48, [3.8, 3.0, 3.4]],
  [7.8, 9.2, 8.1, 54, [3.7, 3.0, 3.3]],
  [10.6, 11.0, 7.8, 61, [3.5, 2.9, 3.1]],
  [12.7, 11.9, 7.4, 69, [3.1, 2.6, 2.8]],
  [13.7, 12.3, 6.9, 72, [2.4, 2.2, 2.3]],
];
const STALK = [[13.4, 12.4, 8.8], [13.1, 12.6, 11.2], [12.6, 12.9, 13.3]];
const STALK_R = [0.75, 0.6, 0.5];
const BUD_AT = [12.55, 12.95, 14.9];
const WR = [2.4, 2.2, 17.2];

// the legs as the scad's legPair() places them: hip top and foot (z 1.55), per pair and side
const LEG_DEF = [[0, -2.3, 0, 2.6, 4.8], [2.5, 4.5, 40, 2.6, 5.9], [6.1, 8.1, 48, 2.6, 5.7], [10.3, 11, 62, 2.4, 5.3]];
const LEGS = LEG_DEF.flatMap(([x, y, a, o, tz], i) => [1, -1].map((sg) => {
  const n = [Math.cos(a * Math.PI / 180) * sg, -Math.sin(a * Math.PI / 180) * sg];
  const h = [x + n[0] * o, y + n[1] * o];
  return { name: `leg${i + 1}${sg > 0 ? 'L' : 'R'}`, top: [h[0], h[1], tz], foot: [h[0] + n[0] * 0.3, h[1] + n[1] * 0.3, 1.55] };
}));

// the painted eye's centre sits 1.2 under the face; the lid (a lib eye of this size) just covers the decal
const eyeL = { side: 'L', at: [5.5, -6.7, 0.6], size: 2.2, yaw: 40, flat: 0.3, frame: headF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: SKIN_LT });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...LEGS.map((l) => ({ name: l.name, parent: 'root', at: l.top })),
  { name: 'body', parent: 'root', at: [0.5, 1.0, 4.5] },
  { name: 'abdomen', parent: 'body', at: [6.4, 8.1, 8.2] },
  { name: 'tail1', parent: 'abdomen', at: STALK[0] },
  { name: 'tail2', parent: 'tail1', at: STALK[2] },
  { name: 'head', parent: 'body', at: [0, -3.0, 19.5] },
  { name: 'wingL', parent: 'body', at: WR },
  { name: 'wingR', parent: 'body', at: [-WR[0], WR[1], WR[2]] },
  ...face.joints,
];

const podD = (c, i) => {
  const [x, y, z, a, r] = PODS[i];
  return ellD(subFrame([x, y, z], [0, 0, -a]).local(c), [r[0] * 1.25, r[1] * 1.05, r[2] * 1.15]);
};
const pods = (c, lo, hi) => Math.min(...PODS.slice(lo, hi).map((_, k) => podD(c, lo + k)));
const headD = (c) => {
  const q = headF.local(c);
  const f = fold(q);
  return Math.min(
    ellD(q, CR[1], CR[0]) * 0.97, ellD(q, SN[1], SN[0]) * 0.97, ellD(q, JW[1], JW[0]),
    ...HEAD_PLATES.map(([p, r]) => ellD(f, [r, r, r], p)),
    ellD(c, [4.0, 3.7, 3.0], [0, -3.6, 20.4]),
  );
};
const chestD = (c) => Math.min(
  ...CHS.map(([z, r, dy]) => ellD(c, r.map((v) => v * 1.06), [CH[0], CH[1] + dy, z])),
  ...NECK_PLATES.map(([p, r]) => ellD(fold(c), [r, r, r], p)),
);
const legD = (c, l) => capD(c, l.top, l.foot, 2.1, 1.95);

function assign(c, rgb) {
  const S = side(c);
  if (isAny(rgb, BUD, 0.015) && ellD(c, [3, 3, 3.2], BUD_AT) < 1.4) return 'tail2';
  if (near(rgb, STALK_C, 0.015)) return 'tail1';
  if (near(rgb, ANTLER, 0.015) || isAny(rgb, FACE, 0.015)) return 'head';
  if (isAny(rgb, FEATHER, 0.015)) return `wing${S}`;
  if (near(rgb, RED, 0.03)) {
    if (c[2] < 2.2) return closest(LEGS.map((l) => [l.name, legD(c, l)]));
    return `wing${S}`;
  }
  return closest([
    ...LEGS.map((l) => [l.name, legD(c, l) * (c[2] < 3 ? 0.85 : 1.1)]),
    ['head', headD(c)],
    ['body', Math.min(chestD(c), pods(c, 0, 3))],
    ['abdomen', pods(c, 3, 7)],
    ['tail1', chainHit(c, STALK, STALK_R).d],
  ]);
}

const wings = (a) => ({ wingL: { r: [0, -a, 0] }, wingR: { r: [0, a, 0] } });

const clips = {
  ...insectClips({
    face, tail: ['tail1', 'tail2'], legs: 4, hang: true, stride: 14, lift: 10, buzz: 26,
    add: {
      walk: (t, u) => merge(wings(5 * osc(u, 2)), { head: { r: [0, 0, 3 * osc(u, 1)] } }),
      idle: (t, u) => merge(wings(4 * osc(u, 1)), { tail2: { r: [0, 6 * osc(u, 1, 0.3), 4 * osc(u, 1)] } }),
      celebrate: (t, u) => wings(24 * Math.abs(Math.sin(TAU * 2 * u))),
    },
  }),

  // fidget: turns to look back at its flower bud, which bobs open-and-shut, then a pleased wriggle of the wings
  idle_bud: {
    seconds: 2.6,
    pose: (t, u) => {
      const look = K(u, [[0, 0], [0.18, 1], [0.62, 1], [0.78, 0]]);
      const bob = osc(u, 4) * win(u, 0.2, 0.6, 0.05);
      const wr = osc(u, 6) * win(u, 0.7, 0.95, 0.04);
      return merge({
        head: { r: [-4 * look, 0, 40 * look] },
        body: { r: [0, 0, 5 * look + 2 * wr] },
        abdomen: { r: [0, 0, -8 * look - 3 * wr] },
        tail1: { r: [10 * bob, 0, -14 * look] },
        tail2: { r: [8 * bob, 0, 0] },
        ...face.pose(look > 0.5 && bob > 0.3 ? 'happy' : 'open', blinks(u, [[0.9, 0.94]])),
      }, wings(10 * wr));
    },
  },
};

// the rear legs stand under the abdomen's pods: blend them into it like the front ones into the body
const seams = { allow: [['abdomen', 'leg3L'], ['abdomen', 'leg3R'], ['abdomen', 'leg4L'], ['abdomen', 'leg4R']] };

export default rigDef({ joints, assign, extras: face.extras, clips, seams });
