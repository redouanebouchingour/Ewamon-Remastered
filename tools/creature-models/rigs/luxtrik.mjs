// Luxtrik's rig: a crouched mossy mantis-locust. Thick segmented forelegs with three-pronged claws (claw = upper arm,
// pinch = forearm and claw; the near left one braced on the ground, the right one raised forward, as drawn), thin
// twig middle legs (leg2) standing on the ground, big spiky hind clubs (leg3, off the abdomen, held off the ground),
// two pairs of raised leaf wings, and a head turned 35 degrees to its right carrying the two twig antennae, the palps
// (mand) and the compound eyes. Numbers are scad/luxtrik.scad's.
import { K, TAU, merge, rigDef, win } from './lib/anim.mjs';
import { any, ell, inFrame, limb, pair, petal, pick, plate, spike } from './lib/biped.mjs';
import { subFrame } from './lib/geo.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { insectClips } from './lib/insect.mjs';

const FACE = [0.57, 0.55, 0.2];
const DEG = 180 / Math.PI;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const dirRot = (d) => { const l = Math.hypot(...d); return [0, Math.acos(d[2] / l) * DEG, Math.atan2(d[1], d[0]) * DEG]; };
// the scad's seg(a, b, r): an ellipsoid along a -> b
const seg = (a, b, r) => { const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; return petal([r, r, Math.hypot(...d) / 2 + 0.5], mid(a, b), dirRot(d)); };
// the scad's leaf(p, d, w): a flat ellipsoid from p along d
const leaf = (p, d, w) => petal([w, w * 0.35, Math.hypot(...d) / 2], add(p, [d[0] / 2, d[1] / 2, d[2] / 2]), dirRot(d));
// spine(p, d, r): a spike with a bud at its tip
const spine = (p, d, r = 0.55) => any(spike(p, d, r), ell([0.38, 0.38, 0.38], add(p, d)));
const nub = (p, r = 1.3) => any(ell([r, r, r * 0.8], p), ell([0.42, 0.42, 0.42], add(p, [0, 0, r * 0.75])));
const chainT = (pts, rs) => any(...pts.slice(1).map((p, i) => limb(pts[i], p, rs[i], rs[i + 1])));

// ---- head block: translate(NECK) rotate([0, 0, HEADYAW])
const NECK = [0, -6, 16.6];
const HF = subFrame(NECK, [0, 0, -35]);
const EYE = [2.7, -4.9, 0.2];
const ANT_R = [[-1.3, -5.8, 4.0], [-2.4, -8.8, 8.8], [-5, -12, 11.5], [-8.5, -14.5, 10], [-11, -15.5, 5.5], [-12, -15, 1.5]];
const ANT_L = [[1.3, -5.8, 4.0], [2, -9, 7.5], [2.8, -13, 8], [3, -16.5, 4.5], [2.6, -18, -0.5]];
const PALP = [1, -7.5, -6.3];
const eyeL = { side: 'L', at: EYE, size: 2.2, yaw: 42, flat: 0.55, frame: HF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FACE });

// ---- wings: translate(AT) rotate([0, 0, rz]) rotate([0, ry, 0]) plate(...)
const FORE = [[0, 0], [2.4, 1.6], [4.4, 5.5], [5.4, 10.5], [5.2, 15], [4, 19.5], [1.8, 23], [0, 24.8], [-1.4, 23], [-3.2, 19.5],
  [-4.4, 14.5], [-4.6, 9.5], [-3.8, 4.5], [-2, 1.2]].map((p) => [p[0] * 1.1, p[1]]);
const HIND = [[0, 0], [2.4, 1.5], [4.6, 5], [5.2, 9.5], [4.6, 14], [3, 17.6], [0, 20.4], [-2, 18], [-3.6, 14], [-4.2, 9.5],
  [-3.6, 5], [-2, 1.4]];
const FORE_AT = [2.2, 0, 21.5];
const HIND_AT = [2.6, 3, 20.5];
const FF = subFrame(FORE_AT, [0, 47, 31.5]);
const HWF = subFrame(HIND_AT, [0, 63, 36.8]);

// ---- legs
const ARM_L = [[3.8, -6, 14.5], [8, -7.5, 9.5], [6.6, -12.4, 5.8], [6.4, -13.2, 4.4]];
const ARM_R = [[-3.8, -6, 14.5], [-8.8, -9, 13], [-12.8, -12, 9.6], [-14, -13, 7.8]];
const MID = [[3.6, -1, 13], [9.5, 0, 14], [12, 2, 5], [12.8, 1, 0.4]];
const HL = [[4.2, 6, 16], [8.5, 10, 13.4], [11, 13.5, 10], [12.5, 16.5, 6.4]];

const upperArm = (A, sp) => any(ell([2.1, 2.1, 2.1], A[0]), seg(A[0], A[1], 2.9), ...sp);
const foreArm = (A, drop) => any(ell([1.9, 1.9, 1.9], A[1]), ell([1.7, 1.7, 1.7], A[2]), seg(A[1], A[2], 2.6), ell([2.5, 2.6, 2.1], A[3]),
  ...[-1.4, 0, 1.4].map((k) => {
    const b = add(A[3], [0.87 * k, 0.5 * k - 0.8, -0.6]);
    const m = add(b, [0.15 * k, -1.4, -drop * 0.55]);
    const t = add(b, [0.25 * k, -1.2, -drop]);
    return any(limb(b, m, 1, 0.7), limb(m, t, 0.7, 0.18));
  }));

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg2*', 'root', MID[0]),
  { name: 'body', parent: 'root', at: [0, -1, 13] },
  { name: 'abdomen', parent: 'body', at: [0, 1.5, 17] },
  ...pair('leg3*', 'abdomen', HL[0]),
  { name: 'head', parent: 'body', at: NECK },
  { name: 'mandL', parent: 'head', at: HF.world(PALP) },
  { name: 'mandR', parent: 'head', at: HF.world([-PALP[0], PALP[1], PALP[2]]) },
  ...[['L', ANT_L], ['R', ANT_R]].flatMap(([S, P]) => [0, 1, 2, 3].map((i) => ({
    name: `ant${S}${i + 1}`, parent: i === 0 ? 'head' : `ant${S}${i}`, at: HF.world(P[i]),
  }))),
  ...pair('wing*', 'body', FORE_AT),
  ...pair('wing2*', 'body', HIND_AT),
  { name: 'clawL', parent: 'body', at: ARM_L[0] },
  { name: 'clawR', parent: 'body', at: ARM_R[0] },
  { name: 'pinchL', parent: 'clawL', at: ARM_L[1] },
  { name: 'pinchR', parent: 'clawR', at: ARM_R[1] },
  ...face.joints,
];

// an antenna: its links, leaves and buds (the scad's antenna()), each on joint min(i, 3) + 1
const antenna = (S, P, rs) => [
  ...P.slice(1).map((p, i) => [`ant${S}${Math.min(i, 3) + 1}`, limb(P[i], p, rs[i], rs[i + 1])]),
  ...P.slice(1).map((p, j) => {
    const i = j + 1;
    const sx = p[0] > 0 ? 1 : -1;
    const lf = leaf(p, [sx * (i % 2 === 0 ? 1.3 : -0.6), -0.6, i % 2 === 0 ? 1.1 : -1.2], 0.55);
    return [`ant${S}${Math.min(i, 3) + 1}`, i % 2 === 1 ? any(lf, ell([0.4, 0.4, 0.4], add(p, [0, 0, 0.45]))) : lf];
  }),
];
const headParts = [
  ['head', any(ell([3.4, 3.4, 3.4], [0, 0, 0.6]), ell([4.0, 3.8, 3.9], [0, -2.8, 1.8]), ell([3.0, 2.6, 2.8], [0, -6.0, -1.8]),
    ell([1.6, 1.6, 1.6], [0, -7.8, -5.6]), limb([0, -2.8, 1.8], [0, -7.8, -5.6], 2.6, 1.5), ell([3.1, 2.9, 1.7], [0, -3.6, 4.7]),
    ell([2.2, 2.2, 2.5], EYE), ell([2.2, 2.2, 2.5], [-EYE[0], EYE[1], EYE[2]]))],
  ['mandL', spike(PALP, [0.25, -0.6, -2.4], 0.6)],
  ['mandR', spike([-PALP[0], PALP[1], PALP[2]], [-0.25, -0.6, -2.4], 0.6)],
  ...antenna('L', ANT_L, [0.45, 0.42, 0.38, 0.32, 0.26]),
  ...antenna('R', ANT_R, [0.45, 0.42, 0.38, 0.34, 0.3, 0.26]),
].map(([n, t]) => [n, inFrame(HF, t)]);

const ABD = [[3.4, 16.8, 4.9, 2.9, 4.3], [6.8, 15.9, 4.7, 2.8, 4.0], [10.2, 14.5, 4.2, 2.6, 3.6], [13.4, 12.8, 3.4, 2.4, 3.0], [16.3, 10.9, 2.5, 2.0, 2.2]];
const NUBS = [[-2.2, -4.6, 21.8], [2.4, -3.6, 21.9], [0, -0.8, 22.4], [-3.4, 1, 21.4], [3.4, 2.6, 21], [0, 6, 20.6], [-2.8, 9.4, 18.2],
  [2.6, 12.2, 15.8], [4.6, -1.5, 19.4], [-4.8, -2, 19.2]];
const sprout = (pts, rs) => any(chainT(pts, rs), ...pts.slice(1, -1).map((p, j) => leaf(p, [((j + 1) % 2 === 0 ? 1.4 : -1.4), 0.3, 1.2], 0.55)),
  ell([0.6, 0.6, 0.6], pts[pts.length - 1]), leaf(pts[pts.length - 1], [0.8, -0.3, 1.4], 0.6));
const SPROUTS = [
  [[[-0.5, -2.5, 21], [-1.2, -1.8, 26], [-0.4, -1.5, 30], [-1.5, -1, 32.5]], [0.45, 0.4, 0.32, 0.28]],
  [[[1.2, 2.4, 20.8], [2.2, 4.4, 26], [2.8, 5.8, 30.5], [3.2, 6.2, 33.2]], [0.45, 0.4, 0.32, 0.28]],
  [[[2, 7.8, 19.2], [3.6, 9.8, 25], [5, 11.4, 30], [5.8, 12, 33.6]], [0.42, 0.38, 0.3, 0.26]],
];

const parts = [
  ...headParts,
  ['body', any(ell([4.3, 4.6, 4.2], [0, -3, 16.4]), ell([5.2, 3.6, 4.6], [0, -4.4, 17.6]), ell([5.3, 3.4, 4.6], [0, -0.8, 18.2]),
    ...NUBS.filter((p) => p[1] < 2.5).map((p) => nub(p)), sprout(...SPROUTS[0]), sprout(...SPROUTS[1]))],
  ['abdomen', any(limb([0, 2.5, 15.6], [0, 16.8, 10.6], 2.1, 1.0), ...ABD.map((s) => ell([s[2], s[3], s[4]], [0, s[0], s[1]])),
    ...NUBS.filter((p) => p[1] >= 2.5).map((p) => nub(p)), sprout(...SPROUTS[2]))],
  ['wing*', inFrame(FF, plate(FORE, 0.9))],
  ['wing2*', inFrame(HWF, plate(HIND, 0.9))],
  ['clawL', upperArm(ARM_L, [spine(add(ARM_L[0], [1.6, -0.3, 1.2]), [0.6, 0.4, 1.6]), spine(add(mid(ARM_L[0], ARM_L[1]), [2, 0, 0.6]), [1.4, 0.2, 0.8])])],
  ['clawR', upperArm(ARM_R, [spine(add(ARM_R[0], [-1.2, -0.6, 1.8]), [-0.5, 0, 1.6]), spine(add(mid(ARM_R[0], ARM_R[1]), [-1, -0.6, 2]), [-0.4, -0.4, 1.5])])],
  ['pinchL', foreArm(ARM_L, 4.2)],
  ['pinchR', foreArm(ARM_R, 3.4)],
  ['leg2*', any(chainT(MID, [0.8, 0.65, 0.55, 0.4]), spike(MID[3], [0.6, -1, -0.2], 0.4))],
  ['leg3*', any(ell([2.4, 2.4, 2.4], HL[1]), ell([2, 2, 2], HL[2]), seg(HL[0], HL[1], 3.4), seg(HL[1], HL[2], 2.9), limb(HL[2], HL[3], 1.9, 0.15),
    spine(add(HL[0], [1.4, 1.6, 2.4]), [0.2, 0.8, 1.8], 0.6), spine(add(HL[1], [0.6, 0.4, 2.4]), [0.3, 1, 1.7], 0.55),
    spine(add(HL[2], [0.4, 0.6, 2]), [0.3, 1.2, 1.4], 0.5), spine(add(HL[1], [2.2, 0.8, -0.6]), [1.4, 0.6, -0.4], 0.45))],
];

function assign(c) {
  return pick(c, parts);
}

const base = insectClips({ face, ant: 4, stride: 12, lift: 10, buzz: 18 });

const clips = {
  ...base,
  // the template's groom pulls the antennae down hard; this head is turned, so the near one would sweep across the face
  idle_groom: {
    ...base.idle_groom,
    pose: (t, u) => Object.fromEntries(Object.entries(base.idle_groom.pose(t, u))
      .map(([j, q]) => [j, j.startsWith('ant') && q.r ? { ...q, r: q.r.map((v) => v * 0.3) } : q])),
  },
  // fidget: clacks its claws together twice, proud of them
  idle_clack: {
    seconds: 1.8,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.15, 1], [0.8, 1], [0.95, 0]]);
      const clack = Math.max(0, Math.sin(TAU * 3 * ((u - 0.18) / 0.6))) * win(u, 0.18, 0.78, 0.03);
      return merge(base.idle.pose(t, u), {
        body: { r: [-4 * up, 0, 0] },
        clawL: { r: [-20 * up, 0, 14 * clack] }, clawR: { r: [-20 * up, 0, -14 * clack] },
        pinchL: { r: [0, 0, 10 * clack] }, pinchR: { r: [0, 0, -10 * clack] },
      });
    },
  },
};

export default rigDef({ joints, assign, clips, extras: face.extras });
