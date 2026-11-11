// Veilpup's rig: a chubby navy wolf pup standing on two short legs, the far arm reaching out with red and blue wisps
// over its claws, the near paw at its chest by a cyan spark, a big white mane over a blindfolded head with two glowing
// eyes, tall ears and a dark brush tail with a white flame tip. The mane's lilac cascade down the back is a one-link
// cape. Numbers are scad/veilpup.scad's (sprite-match remodel, 2026-11-06; swept-lock mane 2026-11-11).
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, chain, ell, inFrame, limb, pick } from './lib/biped.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { subFrame } from './lib/geo.mjs';

const MASK = [0.06, 0.06, 0.13];
const D2R = Math.PI / 180;
const add = (a, b, k = 1) => a.map((v, i) => v + b[i] * k);

// the head block: translate(HC) rotate([0, 0, HEAD_YAW]) scale(HEAD_S)
const HC = [-3.6, -3.4, 24.0];
const hf = subFrame(HC, [0, 0, -10], 1.18);
const EYE = [3.0, -3.75, -0.9];
const EAR = [[3.2, 0.2, 3.4], [2.8, 0.8, 7.0]];
const EAR_FAR = [-5.6, -2.8, 3.6];
const face = eyeKit({
  eyes: [
    { side: 'L', at: EYE, size: 1.25, yaw: 32, frame: hf },
    { side: 'R', at: [-EYE[0], EYE[1], EYE[2]], size: 1.25, yaw: -32, frame: hf },
  ],
  skin: MASK,
});
const earAt = (s) => hf.world([s * EAR[0][0], EAR[0][1], EAR[0][2]]);
const ear = (s) => {
  const b = [s * EAR[0][0], EAR[0][1], EAR[0][2]];
  const d = s > 0 ? EAR[1] : EAR_FAR;
  return inFrame(hf, any(limb(b, add(b, d, 0.5), 2.0, 1.2), limb(add(b, d, 0.5), add(b, d), 1.2, 0.3)));
};

const LEGS = {
  L: [[4.4, 0.4, 7.2], [6.0, -0.6, 2.2], [6.4, -2.0, 1.3], [0.15, -1]],
  R: [[-5.0, 0.6, 7.2], [-7.8, 0.2, 2.4], [-8.6, -1.2, 1.3], [-0.55, -0.85]],
};
const leg = (L) => any(ell([3.6, 4.0, 4.2], L[0]), limb(add(L[0], [0, -0.4, -1.5]), L[1], 2.6, 2.1), ell([2.6, 3.4, 1.5], L[2]),
  limb(L[2], [L[2][0] + L[3][0] * 4.2, L[2][1] + L[3][1] * 4.2, 0.6], 1.4, 0.4));

// arms: shoulder, elbow, wrist, paw; F = far (-X, reaching out), N = near (+X, paw at the chest)
const SF = [-5.6, -0.6, 16.8]; const EF = [-9.0, -2.4, 12.8]; const WF = [-12.2, -3.8, 12.2]; const PF = [-13.4, -4.2, 12.4];
const SN = [5.4, -0.6, 16.8]; const EN = [7.2, -1.2, 13.4]; const WN = [4.6, -5.2, 14.0]; const PN = [3.8, -6.0, 14.3];
const FING_F = [[[-14.4, -5.4, 12.4], [-15.7, -5.6, 11.4]], [[-14.9, -4.4, 12.6], [-16.2, -4.4, 11.8]],
  [[-14.8, -3.2, 12.6], [-16.0, -3.0, 12.2]], [[-13.0, -5.4, 13.2], [-13.6, -6.4, 14.4]]];
const WISPS = [[[-15.8, -6.4, 15.4], 3.2, 0.7, 0.7], [[-16.6, -5.6, 14.4], 2.2, 0.5, -0.5], [[-13.8, -6.6, 15.8], 2.8, 0.6, -0.4],
  [[-12.7, -6.2, 14.8], 2.0, 0.45, 0.4]];

// the ruff's hem rings
const ring = (a0, a1, step, cx, rx, cy, ry, z) => {
  const out = [];
  for (let a = a0; a <= a1; a += step) out.push([cx + rx * Math.sin(a * D2R), cy - ry * Math.cos(a * D2R), z]);
  return out;
};
const HEM = ring(-150, 150, 25, -0.9, 5.6, -1.0, 5.1, 16.2);
const UPPER = ring(-120, 120, 30, -1.3, 4.4, -1.5, 4.2, 19.6);

// the mane: lockPts() of the scad, each lock three tapering segments
const SK = [-3.6, -2.8, 24.7];
const SKR = [6.4, 5.8, 5.8];
const sweepD = (az, el) => [Math.sin(az * D2R) * Math.cos(el * D2R), Math.cos(az * D2R) * Math.cos(el * D2R), Math.sin(el * D2R)];
const unit = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };
const lockPts = ([az, el, az1, el1, az2, el2, L, , , a]) => {
  const p0 = add(SK, [SKR[0] * Math.sin(az * D2R) * Math.cos(el * D2R), SKR[1] * Math.cos(az * D2R) * Math.cos(el * D2R), SKR[2] * Math.sin(el * D2R)]);
  const D1 = sweepD(az1, el1); const D2 = sweepD(az2, el2);
  const p1 = add(add(p0, D1, L * 0.35), unit(p0.map((v, i) => v - SK[i])), a);
  const p2 = add(p1, unit(add(D1, D2)), L * 0.35);
  return [p0, p1, p2, add(p2, D2, L * 0.3)];
};
const lock = (q, w) => any(limb(q[0], q[1], w * 0.45, w * 0.43), limb(q[1], q[2], w * 0.43, w * 0.32), limb(q[2], q[3], w * 0.32, 0.2));
const MANE = [
  [180, 14, -5, 52, 40, 20, 15, 4.4, 0, 1.4], [-160, 14, -15, 55, 35, 30, 15, 4.4, 1, 1.4],
  [-140, 16, -35, 55, 20, 45, 14, 4.4, 0, 1.2], [-120, 18, -70, 50, 0, 60, 13, 4.2, 2, 1.0],
  [170, 30, 5, 60, 50, 10, 15, 4.6, 0, 1.2], [-170, 32, -10, 62, 40, 30, 14, 4.6, 2, 1.2],
  [-60, 55, 0, 70, 45, 30, 14, 5.2, 0, 1.0], [0, 72, 30, 50, 55, 5, 14, 5.2, 1, 1.0], [-20, 40, 20, 35, 55, -10, 14, 5.2, 0, 0.8],
  [40, 35, 50, 20, 60, -15, 12.5, 5.0, 0, 0.8], [30, 12, 45, -10, 55, -35, 12.5, 4.8, 2, 0.6],
  [-115, 22, -100, 40, -110, 60, 9.5, 4.2, 0, 0.6], [-100, 6, -116, 10, -120, 25, 8.5, 3.8, 2, 0.5],
  [0, 25, 20, -10, 35, -50, 13, 5.4, 2, 0.6], [-35, 25, 0, -20, 15, -60, 13, 5.4, 2, 0.5], [-70, 28, -40, -10, -20, -50, 11.5, 4.8, 2, 0.5],
  [-90, 38, -60, 30, -30, 0, 11, 4.6, 1, 0.6], [-40, 50, 0, 40, 30, 0, 13, 5.4, 1, 0.8],
];
// the three lilac locks combed down the back are the cape
const CAPE = new Set([13, 14, 15]);

// the tail: a fluffy brush, soft dark fur locks, a white tip of long tapered locks
const TAIL = [[2.6, 4.2, 8.4], [7.0, 7.2, 6.4], [11.4, 8.6, 7.4], [12.4, 8.4, 11.0]];
const TAIL_R = [2.4, 3.3, 3.6, 3.0];
const tails = ['tail1', 'tail2', 'tail3'];
const FUR = [
  [[5.2, 6.2, 5.0], [7.6, 6.8, 3.4], [10.0, 8.2, 3.6], 4.0], [[8.8, 8.2, 4.8], [11.6, 9.4, 3.6], [14.0, 9.4, 5.0], 4.0],
  [[12.4, 9.2, 6.4], [14.8, 9.4, 7.2], [16.4, 9.0, 9.4], 4.0], [[13.0, 9.0, 9.0], [15.4, 8.8, 10.6], [16.4, 8.6, 12.8], 3.6],
  [[7.0, 9.6, 8.2], [9.6, 11.4, 8.0], [11.8, 12.4, 9.0], 3.8], [[10.4, 10.6, 9.4], [12.4, 12.0, 10.4], [13.8, 12.0, 12.4], 3.6],
];
const furJoint = (p) => (p[0] < 6 ? 'tail1' : p[0] < 10 ? 'tail2' : 'tail3');
const TIP = [
  [[[12.2, 8.4, 11.2], [12.6, 8.4, 13.8], [11.8, 8.3, 16.0], [9.8, 8.2, 17.4]], 4.6],
  [[[13.2, 8.6, 11.0], [14.2, 8.7, 13.4], [14.2, 8.8, 15.6], [13.0, 8.8, 17.4]], 4.0],
  [[[11.4, 8.2, 11.6], [10.4, 8.0, 13.4], [8.8, 7.8, 14.6], [7.0, 7.6, 15.2]], 3.6],
  [[[12.4, 10.0, 11.4], [12.8, 10.8, 14.0], [12.0, 11.2, 16.0], [10.6, 11.4, 17.0]], 4.0],
];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: LEGS.L[0] },
  { name: 'legR', parent: 'root', at: LEGS.R[0] },
  { name: 'body', parent: 'root', at: [0, 0.4, 9] },
  { name: 'head', parent: 'body', at: [-2.8, -2.6, 20] },
  { name: 'earL', parent: 'head', at: earAt(1) },
  { name: 'earR', parent: 'head', at: earAt(-1) },
  { name: 'armL', parent: 'body', at: SN },
  { name: 'foreL', parent: 'armL', at: EN },
  { name: 'armR', parent: 'body', at: SF },
  { name: 'foreR', parent: 'armR', at: EF },
  { name: 'cape1', parent: 'body', at: [-4.2, 2.6, 27] },
  ...tails.map((name, i) => ({ name, parent: i === 0 ? 'body' : tails[i - 1], at: TAIL[i] })),
  ...face.joints,
];

const parts = [
  // torso, ruff and gem
  ['body', any(ell([5.6, 4.8, 3.6], [0, 0.8, 8.6]), ell([6.2, 5.2, 5.4], [-0.4, -0.2, 12]), ell([5.4, 4.6, 4.2], [-0.6, -0.4, 16.2]),
    ell([4.6, 4.4, 1.2], [-1.4, -1.6, 19.4]), ell([6.0, 5.4, 1.4], [-0.9, -1.0, 16.4]), ell([1.15, 0.8, 1.15], [-2.4, -7.0, 15.9]))],
  ...HEM.map((p) => ['body', limb(p, [p[0] + (p[0] + 0.9) * 0.2, p[1] + (p[1] + 1.0) * 0.2, p[2] - 3.2], 1.3, 0.4)]),
  ...UPPER.map((p) => ['body', limb(p, [p[0] + (p[0] + 1.3) * 0.2, p[1] + (p[1] + 1.5) * 0.2, p[2] - 2.1], 1.1, 0.4)]),
  // legs
  ['legL', leg(LEGS.L)],
  ['legR', leg(LEGS.R)],
  // near arm: paw at the chest, with the cyan spark
  ['armL', any(ell([2.2, 2.2, 2.2], SN), limb(SN, EN, 2.1, 1.8), limb(add(EN, [0.6, 0.6, -0.6]), add(EN, [1.6, 1.5, -2.6]), 0.75, 0.3))],
  ['foreL', any(limb(EN, WN, 1.8, 1.4), ell([1.7, 1.5, 1.6], PN), limb(add(PN, [-0.6, -1.2, -0.6]), add(PN, [-1.1, -1.8, -2.0]), 0.5, 0.2),
    limb([2.8, -8.2, 17.4], [2.2, -7.9, 14.0], 0.4), limb([1.4, -7.9, 16.6], [1.0, -7.8, 15.4], 0.3))],
  // far arm: reaching out, claws round the wisps
  ['armR', any(ell([2.2, 2.2, 2.2], SF), limb(SF, EF, 2.1, 1.8), limb(add(EF, [-0.2, 0.6, -0.8]), add(EF, [0.2, 1.6, -2.8]), 0.75, 0.3))],
  ['foreR', any(limb(EF, WF, 1.8, 1.4), ell([1.8, 1.5, 1.4], PF),
    ...FING_F.map(([a, b]) => limb(add(a, add(b, a, -1), -0.3), add(a, add(b, a, -1), 1.2), 0.6, 0.2)),
    ...WISPS.map(([p, h, w, lean]) => limb(p, add(p, [lean, 0, h]), w, 0.15)))],
  // head: skull, cheeks, muzzle, jaw, nose, eyes, cap and bangs in the head frame
  ['head', inFrame(hf, any(ell([5.6, 5.0, 5.0], [0, 0.5, 0.6]), ell([4.8, 4.0, 3.0], [0, -1.2, -2.6]),
    limb([0, -3.4, -2.6], [0, -5.9, -3.0], 2.4, 1.5), limb([0, -2.6, -4.4], [0, -5.0, -4.5], 1.6, 1.0), ell([0.75, 0.55, 0.55], [0, -7.25, -2.7]),
    ell([1.3, 0.7, 1.4], EYE), ell([1.3, 0.7, 1.4], [-EYE[0], EYE[1], EYE[2]]),
    ...[1, -1].flatMap((s) => [[4.6, -0.4, -1.6, 2.0, 0.8, -0.6], [4.4, -1.2, -3.4, 1.8, 0.6, -1.6], [3.8, -0.4, -4.8, 1.0, 0.8, -2.0]]
      .map((c) => limb([c[0] * s, c[1], c[2]], [(c[0] + c[3]) * s, c[1] + c[4], c[2] + c[5]], 1.0, 0.3)))))],
  ['earL', ear(1)],
  ['earR', ear(-1)],
  // the mane rides the head; the locks combed down the back are the cape
  ...MANE.map((m, i) => [CAPE.has(i) ? 'cape1' : 'head', lock(lockPts(m), m[7])]),
  // tail
  ...chain(tails, TAIL, TAIL_R),
  ...FUR.map(([a, b, c, w]) => [furJoint(a), any(limb(a, b, w * 0.45, w * 0.36), limb(b, c, w * 0.36, 0.2))]),
  ['tail3', ell([2.0, 1.9, 1.7], [12.4, 8.4, 11.8])],
  ...TIP.map(([q, w]) => ['tail3', lock(q, w)]),
];

const base = bipedClips({ face, tail: tails, hipH: 7, stride: 18, armSwing: 14, cape: ['cape1'] });

const clips = {
  ...base,

  // fidget: howls at the sky, the mane bristling, the tail stiff
  idle_howl: {
    seconds: 2.6,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.2, 1], [0.72, 1], [0.88, 0]]);
      const tr = osc(u, 16) * win(u, 0.22, 0.72, 0.05);
      return merge({
        body: { r: [-6 * up, 0, 0] },
        head: { r: [-28 * up + tr, 0, 0], s: 1 + 0.02 * up },
        ...face.pose(up > 0.5 ? 'shut' : 'open'),
        armL: { r: [0, 10 * up, 0] },
        armR: { r: [0, -10 * up, 0] },
        earL: { r: [-12 * up, 0, 0] },
        earR: { r: [-12 * up, 0, 0] },
        cape1: { r: [6 * up, 0, 0] },
      }, Object.fromEntries(tails.map((n, i) => [n, { r: [8 * up, 0, 3 * tr * (i + 1)] }])));
    },
  },

  // fidget: the wisps at its claws flare, it flexes its paws open and shut, grinning
  idle_wisps: {
    seconds: 2,
    pose: (t, u) => {
      const on = win(u, 0.1, 0.85, 0.08);
      const fl = Math.sin(TAU * 4 * u) * on;
      return merge({
        armL: { r: [-12 * on, -10 * on, 0] },
        armR: { r: [-12 * on, -10 * on, 0] },
        foreL: { r: [0, 0, 18 * fl], s: 1 + 0.06 * on },
        foreR: { r: [0, 0, -18 * fl], s: 1 + 0.06 * on },
        head: { r: [4 * on, 0, 6 * osc(u, 2) * on] },
        ...face.pose('open', blinks(u, [[0.88, 0.93]])),
      });
    },
  },
};

export default rigDef({ joints, assign: (c) => pick(c, parts), extras: face.extras, clips });
