// Resilith's rig: a hovering hunter bug. The thorax is the body; the head carries the red eyes (their own joints) and
// two antenna links per side; the four-segment abdomen rising behind is a tail chain (tail1 / tail2) ending in the
// crystal sprigs (tail3); four leaf wings (wing = the upper blade, wing2 = the lower) buzz. Per side: the green
// armoured foreleg is the claw (its red talon the pinch), leg1 the raised hook leg, leg2 / leg3 the walking legs,
// leg4 the hind leg held high. Self-contained (Resilian's rig has another body plan). Numbers are scad/resilith.scad's.
import { K, TAU, merge, rigDef, win } from './lib/anim.mjs';
import { pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { capD, chainHit, ellD, fold, isAny, plateD, side, unrot } from './lib/geo.mjs';
import { insectClips } from './lib/insect.mjs';

// colours (scad constants)
const BODY = [0.56, 0.69, 0.33];
const BODY_HI = [0.66, 0.78, 0.4];
const BODY_DK = [0.31, 0.37, 0.18];
const WINGC = [[0.72, 0.86, 0.47], [0.54, 0.64, 0.32], [0.82, 0.94, 0.62], [0.66, 0.74, 0.44], [0.8, 0.38, 0.4], [0.56, 0.2, 0.22]];
const MARK = [0.72, 0.2, 0.25];
const THORN = [0.78, 0.25, 0.29];
const CLAW = [0.82, 0.26, 0.3];
const LEG = [0.24, 0.24, 0.28];
const FACE = [[0.6, 0.41, 0.28], [0.72, 0.53, 0.38], [0.88, 0.52, 0.2], [0.14, 0.1, 0.08], [0.2, 0.12, 0.09]];
const EYE = [[0.88, 0.16, 0.2], [1, 0.3, 0.3], [1, 1, 1]];
const ANTC = [0.22, 0.22, 0.27];
const SPRIG = [[0.27, 0.37, 0.2], [0.5, 0.78, 0.55], [0.84, 0.97, 0.84]];

// geometry
const H = [0, -10.5, 12.3];
const HR = [5.6, 4.6, 4.7];
const PRO = { p: [0, -6.5, 14.4], r: [4.4, 4.2, 4.0] };
const THX = { p: [0, -0.5, 14.8], r: [5.2, 6, 4.6] };
const UNDER = { p: [0, -0.5, 11.2], r: [4.4, 5.4, 2.2] };
const THORNS = [[-8.6, 17.7], [-5, 18.5], [-1.4, 19.2], [2.2, 18.8]];
const SEG_A = -40;
const seg = (i) => [0, 6 + 2 * i, 19.2 + 2.3 * i];
const SEG_R = [[2.3, 2.1, 1.5], [2.35, 2.15, 1.5], [2.45, 2.2, 1.5], [2.55, 2.3, 1.55]];
const SEG0 = { p: [0, 4.2, 17.6], r: [2.2, 2, 1.2] };
const CAP = { p: [0, 14, 28.4], r: [2.1, 1.9, 1.3] };
const ANT = [[1.0, -14.5, 14.3], [3.4, -16.2, 17.6], [6.4, -15.2, 21], [7.4, -13, 23]];
const ANT_R = [0.26, 0.24, 0.22, 0.2];
const ANT_TIP = [7.4, -13, 23];
const STALK = [[0.6, 14.3, 29.2], [2.3, 14.8, 30.6], [3.9, 15, 31.8], [4.1, 15, 35.2]];
const UPPER = [[0, -0.9], [0, 0.9], [4, 3], [11, 4.3], [18.5, 4.5], [23.5, 3.6], [25.8, 1.4], [25.6, -1], [22.5, -3.2],
  [16, -4.2], [8.5, -3.6], [3, -2]];
const LOWER = [[0, -0.8], [0, 0.8], [4, 2.8], [11, 3.9], [16.5, 3.9], [20.3, 2.7], [21.4, 0.3], [20.3, -2], [15.5, -3.5],
  [8.5, -3.4], [3, -1.8]];
// [root, sweep back, elevation, tilt, outline, scale]: translate(root) rotate([0,0,s]) rotate([0,-e,0]) rotate([t,0,0]) scale([k,1,k])
const WINGS = [[[3.4, -1.2, 17.8], 29, 33, -15, UPPER, 1.08], [[3.4, 0.2, 16.2], 27, 8, -15, LOWER, 1.1]];
// limbs (left side numbers)
const ARM = { upper: [[4.3, -5.5, 11.5], [11, -4, 13.5], 1.0, 1.1], fore: [[11, -4, 13.2], [13.5, -5, 6.6], 1.9, 1.85] };
const TALON = { pts: [[13.6, -5.2, 6.4], [14.1, -6.0, 3.2], [14.0, -6.8, 0.5]], rs: [1.35, 0.9, 0.14] };
const LEGS = [
  // [leg pts, leg radii, claw pts, claw radii]
  [[[3.6, -7.5, 12.4], [7.2, -9.6, 14.8], [10.6, -9, 15]], [1.05, 1.0, 0.9], [[10.6, -9, 15], [12.2, -9.6, 13.4], [12.1, -10.4, 11.2]], [0.9, 0.62, 0.14]],
  [[[3.8, -5, 10.5], [7.6, -8.5, 10.6], [6.9, -10.4, 4.8]], [1.25, 1.15, 1.0], [[6.9, -10.4, 4.8], [6.6, -10.9, 2.3], [6.1, -11.3, 0.2]], [1.02, 0.7, 0.14]],
  [[[4, -1.5, 10.5], [9.8, -2, 10.8], [8.8, -3.2, 4.8]], [1.25, 1.15, 1.0], [[8.8, -3.2, 4.8], [8.4, -3.5, 2.3], [7.8, -3.8, 0.2]], [1.02, 0.7, 0.14]],
  [[[3.8, 2.5, 12.5], [7.6, 4, 16.2], [9.4, 4.5, 14.8]], [1.15, 1.1, 0.95], [[9.4, 4.5, 14.8], [9.7, 4.3, 12.8], [9.5, 3.8, 10.6]], [0.95, 0.66, 0.14]],
];

const eyeL = { side: 'L', at: [2.7, -14.0, 12.9], size: 1.2, yaw: 26, flat: 0.8 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FACE[0] });

const mid = (a, b) => a.map((v, k) => (v + b[k]) / 2);
const segOwner = ['tail1', 'tail1', 'tail2', 'tail2'];
const pairJ = (name, parent, at) => ['L', 'R'].map((S) => ({ name: `${name}${S}`, parent: parent.endsWith('*') ? `${parent.slice(0, -1)}${S}` : parent, at: [S === 'L' ? at[0] : -at[0], at[1], at[2]] }));

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, -3, 12] },
  { name: 'head', parent: 'body', at: [0, -7.5, 12.5] },
  { name: 'eyeL', parent: 'head', at: eyeL.at },
  { name: 'eyeR', parent: 'head', at: [-eyeL.at[0], eyeL.at[1], eyeL.at[2]] },
  ...pairJ('ant', 'head', ANT[0]).map((j) => ({ ...j, name: `${j.name}1` })),
  ...pairJ('ant', 'head', ANT[1]).map((j) => ({ ...j, name: `${j.name}2`, parent: `${j.name}1` })),
  { name: 'tail1', parent: 'body', at: SEG0.p },
  { name: 'tail2', parent: 'tail1', at: mid(seg(1), seg(2)) },
  { name: 'tail3', parent: 'tail2', at: mid(seg(3), CAP.p) },
  ...pairJ('wing', 'body', WINGS[0][0]),
  ...pairJ('wing2', 'body', WINGS[1][0]),
  ...pairJ('claw', 'body', ARM.upper[0]),
  ...pairJ('pinch', 'claw*', TALON.pts[0]),
  ...LEGS.flatMap(([pts], i) => pairJ(`leg${i + 1}`, 'root', pts[0])),
  ...face.joints,
];

const wingD = (f, [p, s, e, t, pts, k]) => {
  const q = unrot([t, -e, s], [f[0] - p[0], f[1] - p[1], f[2] - p[2]]);
  return plateD([q[0] / k, q[1], q[2] / k], pts, 1.2);
};
const segD = (c, i) => ellD(unrot([SEG_A, 0, 0], c.map((v, k) => v - seg(i)[k])), SEG_R[i]);
const segHit = (c) => {
  let best = { i: 0, d: Infinity };
  for (let i = 0; i < 4; i++) { const d = segD(c, i); if (d < best.d) best = { i, d }; }
  return best;
};
const tipD = (c, P) => ellD(unrot([SEG_A, 0, 0], c.map((v, k) => v - P.p[k])), P.r);
const sprigD = (f) => Math.min(chainHit(f, STALK, [0.6, 0.5, 0.45, 0.35]).d, ellD(f, [2.6, 2.4, 3.6], [4.1, 15, 34]));
const limbs = (f) => [
  ['claw', Math.min(capD(f, ...ARM.upper), capD(f, ...ARM.fore))],
  ['pinch', chainHit(f, TALON.pts, TALON.rs).d],
  ...LEGS.map(([lp, lr, cp, cr], i) => [`leg${i + 1}`, Math.min(chainHit(f, lp, lr).d, chainHit(f, cp, cr).d)]),
];

function assign(c, rgb) {
  const f = fold(c);
  const S = side(c);
  if (isAny(rgb, WINGC, 0.025)) {
    const a = wingD(f, WINGS[0]);
    const b = wingD(f, WINGS[1]);
    if (Math.min(a, b) < 2) return a < b ? `wing${S}` : `wing2${S}`;
  }
  if (isAny(rgb, SPRIG, 0.03) && sprigD(f) < 1.5) return 'tail3';
  if (isAny(rgb, EYE, 0.03) && ellD(f, [1.6, 1.6, 1.7], eyeL.at) < 1.2) return `eye${S}`;
  // the antennae share their near-black with the legs: tell them apart by the antenna chain
  if (isAny(rgb, [ANTC], 0.012)) {
    const h = chainHit(f, ANT, ANT_R);
    if (h.d < 2) return h.i === 0 ? `ant${S}1` : `ant${S}2`;
  }
  if (isAny(rgb, [THORN], 0.03)) {
    if (Math.hypot(f[0] - ANT_TIP[0], f[1] - ANT_TIP[1], f[2] - ANT_TIP[2]) < 2.5) return `ant${S}2`;
    return 'body';
  }
  if (isAny(rgb, FACE, 0.03)) return 'head';
  if (isAny(rgb, [MARK], 0.03)) return segOwner[segHit(c).i];
  if (isAny(rgb, [LEG, CLAW], 0.03)) {
    const [n] = limbs(f).reduce((a, b) => (b[1] < a[1] ? b : a));
    return `${n}${S}`;
  }
  // the green body parts: nearest primitive
  const sg = segHit(c);
  return pick(c, [
    ['head', (p) => ellD(p, HR, H)],
    ['body', (p) => Math.min(ellD(p, PRO.r, PRO.p), ellD(p, THX.r, THX.p), ellD(p, UNDER.r, UNDER.p))],
    ['tail1', (p) => tipD(p, SEG0)],
    [segOwner[sg.i], () => sg.d],
    ['tail3', (p) => tipD(p, CAP)],
    ['claw*', (p) => capD(p, ...ARM.fore)],
  ]);
}

const tail = ['tail1', 'tail2', 'tail3'];
const base = insectClips({ face, ant: 2, tail, legs: 4, stride: 12, lift: 12, buzz: 34 });
const clips = {
  ...base,
  // fidget: the abdomen rears up and the crystal sprigs shake, wings flicking
  idle_pompom: {
    seconds: 2,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.18, 1], [0.75, 1], [0.92, 0]]);
      const sh = Math.sin(TAU * 8 * u) * win(u, 0.22, 0.72, 0.04);
      return merge(base.idle.pose(t, u), {
        tail1: { r: [-10 * up, 0, 0] },
        tail2: { r: [-8 * up, 0, 6 * sh] },
        tail3: { r: [0, 10 * sh, 12 * sh] },
        wingL: { r: [0, -8 * Math.abs(sh), 0] }, wingR: { r: [0, 8 * Math.abs(sh), 0] },
        ...face.pose(up > 0.5 ? 'happy' : 'open'),
      });
    },
  },
};

export default rigDef({ joints, assign, rigid: ['eyeL', 'eyeR'], extras: face.extras, clips });
