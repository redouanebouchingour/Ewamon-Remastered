// Blighthex's rig: a hulking blight beetle crouched low. The big clawed forearms are the front legs (leg1), then the
// front legs (leg2) and the wide-spread rear legs (leg3); the carapace with its egg sacs splits into body (front) and
// abdomen (rear rows and the sacs centred behind y 7.3); a wedge head turned to its right with slanted orange eyes
// (eyeKit lids), hooked fangs and two long antennae that are not mirrored (the near one arcs back over the shell, the
// far one curls out and forward). Numbers are scad/blighthex.scad's.
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, blob, chain, ell, inFrame, limb, petal, pick, spike } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { subFrame } from './lib/geo.mjs';
import { insectClips } from './lib/insect.mjs';

const HEAD_C = [0.22, 0.10, 0.33];
const headF = subFrame([-4, -18.5, 16.5], [12, 0, -30], 1.75);

// The carapace ellipsoid and the scad's surf() / nrm() for the plates and sacs.
const BC = [0, 6, 17];
const BR = [12, 22, 12.5];
const rad = (d) => (d * Math.PI) / 180;
const bs = (y) => Math.sqrt(Math.max(0, 1 - ((y - BC[1]) / BR[1]) ** 2));
const surf = (a, y) => [BR[0] * bs(y) * Math.sin(rad(a)), y, BC[2] + BR[2] * bs(y) * Math.cos(rad(a))];
const nrm = (a, y) => {
  const n = [Math.sin(rad(a)) / BR[0], ((y - BC[1]) / (BR[1] * BR[1])) * 1.4, Math.cos(rad(a)) / BR[2]];
  const l = Math.hypot(...n);
  return n.map((v) => v / l);
};
const ORBS = [[10, 6, 5.6], [32, 13, 4.6], [-16, -1, 2.2], [50, 21, 2.0], [76, 17, 3.8], [-40, 14, 3.6], [-70, 18, 2.2],
  [-10, 17, 3.4]]
  .map(([a, y, r]) => { const p = surf(a, y); const n = nrm(a, y); return [p.map((v, i) => v + n[i] * r * 0.7), r]; });
const SPLIT = 7.3;

// Antennae: the near one (+X, L) and the far one (-X, R), each spread over four joints.
const ANT_L = [[-1.7, -20, 22], [-1.2, -20, 26], [-0.6, -19, 30], [0, -17, 33.2], [1.2, -14, 36.8], [2.3, -10, 38.9],
  [3.5, -6, 40], [4, -2, 40.3]];
const ANT_LR = [0.65, 0.6, 0.55, 0.5, 0.42, 0.34, 0.25, 0.1];
const ANT_R = [[-3.5, -20, 21], [-7.5, -21, 25], [-12, -21, 29], [-13.5, -20, 32.4], [-13, -18, 35.4], [-10.6, -15, 36.8],
  [-6.9, -12, 37]];
const ANT_RR = [0.65, 0.6, 0.55, 0.48, 0.4, 0.3, 0.12];
const ANT_L_AT = [0, 2, 4, 5];
const ANT_R_AT = [0, 2, 3, 5];
const linkNames = (S, at, n) => Array.from({ length: n - 1 }, (_, i) => `ant${S}${at.filter((k) => k <= i).length}`);

// The scad's talon(p, d, r, hook) as a chain of capsules.
const talon = (p, d, r, hook) => {
  const l = Math.hypot(...d);
  const pts = [0, 0.36, 0.7, 1].map((t) => p.map((v, i) => v + d[i] * t + (i === 2 ? l * 0.3 * Math.sin(Math.PI * t) - hook * l * t * t : 0)));
  const rs = [r, r * 0.78, r * 0.48, 0.07];
  return any(...pts.slice(1).map((q, i) => limb(pts[i], q, rs[i], rs[i + 1])));
};
const add = (a, b) => a.map((v, i) => v + b[i]);
const SH = [8, -10, 18];
const EL = [15, -16, 23.5];
const WR = [16.5, -24, 14];
const lerp = (p, q, t) => p.map((v, i) => v + (q[i] - v) * t);
const forearm = any(limb(SH, EL, 3.0), ell([3.4, 3.4, 3.4], EL), limb(EL, WR, 3.4, 3.8),
  ...[0.2, 0.5, 0.8].flatMap((t) => [ell([2.7, 2.7, 1.95], add(lerp(EL, WR, t), [2.4, -0.3, 1.4])),
    spike(add(lerp(EL, WR, t), [3.4, 0, 1.4]), [2.0, 0.3, 1.8], 0.9)]),
  ell([2.6, 2.6, 1.9], add(lerp(SH, EL, 0.5), [1.2, 0, 2.2])), ell([3.6, 3.4, 3.0], add(WR, [0, 0, -0.8])),
  talon(add(WR, [-0.6, -2.6, -1.2]), [0.4, -5.8, 0], 1.5, 1.35), talon(add(WR, [1.8, -2.2, -1.0]), [2.4, -4.6, 0], 1.35, 1.2),
  talon(add(WR, [-2.4, -1.6, -1.4]), [-1.8, -4.2, 0], 1.25, 1.15), talon(add(WR, [2.6, 0.2, -1.6]), [3.6, -1.6, 0], 1.1, 1.1));
const LEGS = [[[7, -6, 10], [15, -9, 13.5], [12, -13, 1.8], 2.8], [[8, 12, 10], [17, 13, 15.5], [20, 16, 1.8], 3.0]];
const legT = ([hip, knee, foot, r]) => any(limb(hip, knee, r * 1.35, r * 1.1), limb(knee, foot, r * 1.15, r * 0.85),
  ell([r * 1.3, r * 1.3, r * 1.3], knee),
  ...[[hip, knee, r * 1.2], [knee, foot, r * 1.0]].flatMap(([p, q, rr]) => [0.35, 0.72].map((t) =>
    ell([rr * 0.95, rr * 0.95, rr * 0.68], add(lerp(p, q, t), [rr * 0.55, 0, rr * 0.45])))),
  spike(add(knee, [0, 0, r * 0.8]), [0.9, 0.5, 2.6], r * 0.6), ell([r * 1.15, r * 1.35, r * 0.8], add(foot, [0, 0, 0.3])),
  ...[-45, 0, 45].map((a) => talon(add(foot, [0, -r * 0.5, 0.3]), [Math.sin(rad(a)) * 3.4, -Math.cos(rad(a)) * 3.4, 0], 0.9, 0.5)));

const head = inFrame(headF, any(
  blob([[[3.6, 3.8, 3.2], [0, 0.5, 0.4]], [[2.7, 2.6, 2.2], [0, -3.4, -0.4]], [[1, 1.4, 1], [0, -7, -1.6]]]),
  ...[1, -1].flatMap((s) => [limb([1.2 * s, -5, 1.3], [2.6 * s, -3.9, 2.3], 0.6, 0.75), limb([2.6 * s, -3.9, 2.3], [3.4 * s, -2.2, 2.2], 0.75, 0.8),
    spike([2 * s, 0, 2.6], [1.6 * s, 3.8, 3.4], 1.0),
    spike([3.2 * s, 1.2, 0.8], [2.6 * s, 3, 1.6], 0.9), ell([1.4, 0.8, 1.6], [2.15 * s, -3.4, 0.8]),
    limb([2.3 * s, -2, -1.8], [2.7 * s, -2.8, -3.8], 0.75, 0.52), limb([2.7 * s, -2.8, -3.8], [2.1 * s, -3.8, -5.6], 0.52, 0.1),
    limb([1.1 * s, -5.2, -1.4], [1.3 * s, -5.9, -2.6], 0.42, 0.3), limb([1.3 * s, -5.9, -2.6], [0.8 * s, -6.4, -3.6], 0.3, 0.1)]),
));
// The shell, its belly and the hunched shoulder pauldrons (petal = the scad's rotated ellipsoids, mirrored).
const shell = any(ell(BR, BC), ell([10.6, 18.5, 10], [0, 5, 13.6]), ell([4.2, 1.6, 4.2], [0, 27.2, 17]),
  ...[1, -1].flatMap((s) => [petal([4.4, 4.8, 3.3], [9 * s, -10, 22.5], [0, 20 * s, 0]), petal([3.6, 3.8, 2.6], [10.5 * s, -6, 21.5], [0, 30 * s, 0]),
    spike([10 * s, -9.5, 24.5], [1.6 * s, 2.2, 3.8], 1.4)]));
const neck = ell([5.5, 5.5, 5], [-2, -15.5, 16]);

const eyeL = { side: 'L', at: [2.15, -3.4, 0.8], size: 1.35, yaw: 42, flat: 0.5, frame: headF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: HEAD_C });

const at = (S, list, idx) => idx.map((k, i) => ({ name: `ant${S}${i + 1}`, parent: i === 0 ? 'head' : `ant${S}${i}`, at: list[k] }));
const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'leg1L', parent: 'root', at: SH },
  { name: 'leg1R', parent: 'root', at: [-SH[0], SH[1], SH[2]] },
  ...LEGS.flatMap(([hip], i) => [
    { name: `leg${i + 2}L`, parent: 'root', at: hip },
    { name: `leg${i + 2}R`, parent: 'root', at: [-hip[0], hip[1], hip[2]] },
  ]),
  { name: 'body', parent: 'root', at: [0, 0, 8] },
  { name: 'abdomen', parent: 'body', at: [0, SPLIT, 14] },
  { name: 'head', parent: 'body', at: [-2.4, -15.5, 16] },
  ...at('L', ANT_L, ANT_L_AT),
  ...at('R', ANT_R, ANT_R_AT),
  ...face.joints,
];

const parts = [
  ['leg1*', forearm],
  ...LEGS.map((l, i) => [`leg${i + 2}*`, legT(l)]),
  ['head', head],
  ['shell', any(shell, neck)],
  ...chain(linkNames('L', ANT_L_AT, ANT_L.length), ANT_L, ANT_LR),
  ...chain(linkNames('R', ANT_R_AT, ANT_R.length), ANT_R, ANT_RR),
];

function assign(c) {
  // Egg sacs go with the half their centre is in; everything else on the shell splits at y SPLIT.
  for (const [p, r] of ORBS) if (Math.hypot(c[0] - p[0], c[1] - p[1], c[2] - p[2]) < r * 1.05) return p[1] < SPLIT ? 'body' : 'abdomen';
  const j = pick(c, parts);
  if (j === 'shell') return c[1] < SPLIT ? 'body' : 'abdomen';
  // The antenna roots inside the head stay with it.
  if (j?.startsWith('ant') && j.endsWith('1') && head(c) < 1.15) return 'head';
  return j;
}

const clips = insectClips({ face, ant: 4, stride: 10, lift: 10 });

// fidget: the egg sacs swell and throb, it rears on its claws and shakes them with a hiss
clips.idle_brandish = {
  seconds: 2.6,
  pose: (t, u) => {
    const up = K(u, [[0, 0], [0.2, 1], [0.7, 1], [0.85, 0]]);
    const shk = osc(u, 10) * win(u, 0.25, 0.68, 0.05);
    return merge({
      body: { r: [-8 * up, 0, 0], p: [0, 0, 1.2 * up] },
      abdomen: { s: 1 + 0.04 * (osc(u, 4) * 0.5 + 0.5) * up },
      head: { r: [-6 * up, 0, 3 * shk] },
      leg1L: { r: [-30 * up, -30 * up + 6 * shk, 0] },
      leg1R: { r: [-30 * up, 30 * up + 6 * shk, 0] },
      antL1: { r: [-12 * up, 0, 0] },
      antR1: { r: [-12 * up, 0, 0] },
    }, face.pose('open', 0));
  },
};

export default rigDef({ joints, assign, clips, extras: face.extras });
