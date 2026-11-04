// Hexroach's rig: a low cockroach drawn side-on, so the scad builds it in a body frame turned 20 degrees to its right
// (YAW); every number here is scad/hexroach.scad's, written in that frame and turned with B. A plated carapace (the
// pronotum and the first abdomen plate with the front egg sacs are the body, the rear plates, the big sacs and the
// tail tip the abdomen), a wedge head with slanted orange eyes (eyeKit lids), hooked mandibles and two long antennae
// that are not mirrored. Six spiny legs off the root: the front pair are raptorial, the far one (leg1R) raised before
// the head with its sickle hanging down, the near one (leg1L) lowered with its hook along the ground.
import { merge, osc, rigDef, win } from './lib/anim.mjs';
import { ell, limb, spike } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { chainHit, closest, subFrame } from './lib/geo.mjs';
import { insectClips } from './lib/insect.mjs';

const DEG = Math.PI / 180;
const VIEW = 30;
const YAW = 20;
const A = (VIEW + YAW) * DEG;
const Fb = (sx, sz, bx) => {
  const by = (sx - Math.cos(A) * bx) / Math.sin(A);
  const d = -Math.sin(A) * bx + Math.cos(A) * by;
  return [bx, by, sz - 0.17 * d];
};
const Fz = (sx, z, bx) => [bx, (sx - Math.cos(A) * bx) / Math.sin(A), z];
const B = subFrame([0, 0, 0], [0, 0, -YAW]);
const W = (p) => B.world(p);
const mx = (p) => [-p[0], p[1], p[2]];
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, k) => a.map((v) => v * k);
const lerp = (p, q, t) => p.map((v, i) => v + (q[i] - v) * t);

const SHELL = [0.16, 0.13, 0.2];
const PLATES = [[-4, 21.5, 11, 9, 8.6], [-11, 22.5, 9, 6, 6.2], [3, 19.5, 11.5, 8.6, 10], [8.5, 19.5, 11.2, 8.4, 9.4],
  [13.5, 18.8, 10, 8, 8.4], [18.5, 18.2, 7.8, 7, 7], [22.5, 17.8, 5, 5.2, 5.4]];
const pl = (i) => Fb(PLATES[i][0], PLATES[i][1], 0);
const BELLY = [[9, 22, 5], Fb(8, 14.5, 0)];
const HEAD = [[7, 7.2, 6], Fb(-14.5, 14.5, 0)];
const SNOUT = [[4.2, 3.4, 3.4], Fb(-19, 12.5, 0)];
const EYE = Fb(-9.6, 17.3, 6.1);
const EYE_SIZE = 2.9;
const SACS = [[[7, -3.9, 30.5], 3.6, 1.8], [[7, 13, 27.5], 6.5, 1.12], [[5, 24.5, 21.5], 2.4, 1], [[-5, 24.5, 21.5], 2.4, 1],
  [[-8, -1, 27], 3.4, 1.7], [[-8.5, 13, 24], 6, 1]];
const ANT_N = [Fb(-13, 21, 2), Fb(-12.6, 27, 2.4), Fb(-10.2, 32, 2.8), Fb(-5.6, 35.8, 3.2), Fb(0, 38.2, 3.6), Fb(5, 39.2, 4),
  Fb(8.6, 39, 4.2)];
const ANT_NR = [0.75, 0.7, 0.62, 0.55, 0.45, 0.33, 0.15];
const ANT_F = [Fb(-16.5, 21, -2), Fb(-18.5, 26, -2.6), Fb(-19.8, 31, -3.2), Fb(-18.6, 35.2, -3.8), Fb(-16, 37.8, -4.2),
  Fb(-12.6, 39.8, -4.5)];
const ANT_FR = [0.75, 0.68, 0.6, 0.5, 0.36, 0.15];
const MAND = [[2.4, -22.5, 14.5], [3.2, -25.2, 13.6], [2.6, -27.2, 12.2], [1.2, -28, 10.6]];
const MAND_R = [1.1, 0.85, 0.5, 0.08];
const LEG2 = [Fb(5, 12, 6.5), Fb(10, 12, 12.5), Fz(3.5, 1.4, 14), 2.4];
const LEG3 = [Fb(15, 11.5, 6.5), Fb(21.5, 11.5, 13), Fz(26.5, 1.4, 16), 2.4];
const TARS2 = [2.6, -2.6, -0.4];
const TARS3 = [2.4, 4.2, -0.4];
const LEG1N = [Fb(-5, 12.5, 6), Fb(-1, 13.5, 11.5), Fb(1.5, 7, 12.5), 2.3];
const HOOK_N = [Fb(1.5, 7, 12.5), Fz(-2.5, 3, 12.5), Fz(-6, 1.2, 12), Fz(-8.5, 0.8, 11)];
const HOOK_NR = [1.9, 1.6, 1.0, 0.1];
const LEG1F = [Fb(-13, 13, -6), Fb(-21.5, 20.5, -10.5), Fb(-27, 15.5, -11.5), 2.3];
const HOOK_F = [Fb(-27, 15.5, -11.5), Fb(-28.6, 11.5, -11.5), Fb(-29, 7, -11), Fb(-28, 3.8, -10.5)];
const HOOK_FR = [2.2, 1.9, 1.2, 0.12];
// The abdomen joint takes the shell behind this body-frame y.
const SPLIT = 8;

// lib.scad chain() as one test.
const chainT = (pts, rs) => (c) => chainHit(c, pts, rs).d;
const any = (...ts) => (c) => Math.min(...ts.map((t) => t(c)));
const rot2 = (v, a) => [v[0] * Math.cos(a * DEG) - v[1] * Math.sin(a * DEG), v[0] * Math.sin(a * DEG) + v[1] * Math.cos(a * DEG), v[2]];
// The scad's leg(hip, knee, foot, r, tars), in the body frame.
const legT = ([hip, knee, foot, r], tars) => {
  const out = [Math.sign(knee[0]), 0, 0];
  const ts = [
    limb(hip, knee, r * 1.25, r * 1.05), ell([r * 1.2, r * 1.2, r * 1.2], knee), limb(knee, foot, r * 1.05, r * 0.6),
    ...[0.3, 0.62].map((t) => spike(lerp(knee, foot, t), add(mul(out, 1.2), [0, 0.6, 1.6]), r * 0.45)),
    spike(lerp(hip, knee, 0.5), [0, 0.5, 1.8], r * 0.45),
  ];
  if (tars) {
    const tip = add(foot, tars);
    ts.push(limb(foot, tip, r * 0.6, r * 0.35), ...[-40, 40].map((a) => spike(tip, add(mul(rot2(tars, a), 0.45), [0, 0, -0.4]), r * 0.32)));
  }
  return any(...ts);
};
const sacT = ([c, r, st]) => ell([r, r * st, r], c);

const legs = [
  ['leg1L', any(legT(LEG1N), chainT(HOOK_N, HOOK_NR))],
  ['leg1R', any(legT(LEG1F), chainT(HOOK_F, HOOK_FR), spike(add(lerp(LEG1F[0], LEG1F[1], 0.5), [0, 0, -1]), [0, -0.8, -3.4], 0.8))],
  ['leg2L', legT(LEG2, TARS2)], ['leg2R', legT(LEG2.map((p, i) => (i < 3 ? mx(p) : p)), mx(TARS2))],
  ['leg3L', legT(LEG3, TARS3)], ['leg3R', legT(LEG3.map((p, i) => (i < 3 ? mx(p) : p)), mx(TARS3))],
];
const shellParts = [
  ...PLATES.map((P, i) => [i <= 2 ? 'body' : 'abdomen', ell([P[2], P[3], P[4]], pl(i))]),
  ['abdomen', spike(Fb(24.6, 18, 0), [0, 4.2, 0.2], 2.4)],
  ['belly', ell(...BELLY)],
  ...SACS.map((s) => [s[0][1] < SPLIT ? 'body' : 'abdomen', sacT(s)]),
];
const eyeR = [EYE_SIZE, EYE_SIZE * 0.5, EYE_SIZE * 1.15];
const head = any(ell(...HEAD), ell(...SNOUT), ell(eyeR, EYE), ell(eyeR, mx(EYE)));
const linkName = (S, i) => `ant${S}${1 + (i >= 2) + (i >= 4)}`;
const antParts = (S, pts, rs) => pts.slice(1).map((p, i) => [linkName(S, i), limb(pts[i], p, rs[i], rs[i + 1])]);
const parts = [
  ...legs,
  ...shellParts,
  ['head', head],
  ['mandL', chainT(MAND, MAND_R)],
  ['mandR', chainT(MAND.map(mx), MAND_R)],
  ...antParts('L', ANT_N, ANT_NR),
  ...antParts('R', ANT_F, ANT_FR),
];

const eyeL = { side: 'L', at: EYE, size: EYE_SIZE, yaw: 52, flat: 0.5, frame: B };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: SHELL, lid: [1.25, 1.25, 1.22] });

const antJoints = (S, pts) => [0, 2, 4].map((k, i) => ({
  name: `ant${S}${i + 1}`, parent: i === 0 ? 'head' : `ant${S}${i}`, at: W(pts[k]),
}));
const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'leg1L', parent: 'root', at: W(LEG1N[0]) },
  { name: 'leg1R', parent: 'root', at: W(LEG1F[0]) },
  ...[LEG2, LEG3].flatMap(([hip], i) => [
    { name: `leg${i + 2}L`, parent: 'root', at: W(hip) },
    { name: `leg${i + 2}R`, parent: 'root', at: W(mx(hip)) },
  ]),
  { name: 'body', parent: 'root', at: W([0, 2, 12]) },
  { name: 'abdomen', parent: 'body', at: W([0, SPLIT, 17]) },
  { name: 'head', parent: 'body', at: W([0, -13, 16]) },
  { name: 'mandL', parent: 'head', at: W(MAND[0]) },
  { name: 'mandR', parent: 'head', at: W(mx(MAND[0])) },
  ...antJoints('L', ANT_N),
  ...antJoints('R', ANT_F),
  ...face.joints,
];

function assign(c) {
  const l = B.local(c);
  const j = closest(parts.map(([n, t]) => [n, t(l)]));
  if (j === 'belly') return l[1] < SPLIT ? 'body' : 'abdomen';
  // The antenna roots inside the head stay with it.
  if (j?.startsWith('ant') && j.endsWith('1') && head(l) < 1.15) return 'head';
  return j;
}

const clips = insectClips({ face, ant: 3, stride: 14, lift: 12 });

// fidget: the egg sacs on its back throb and the whole roach shudders, mandibles working
clips.idle_throb = {
  seconds: 2.4,
  pose: (t, u) => {
    const on = win(u, 0.1, 0.85, 0.1);
    const th = (osc(u, 6) * 0.5 + 0.5) * on;
    return merge({
      abdomen: { s: [1 + 0.05 * th, 1 + 0.03 * th, 1 + 0.07 * th] },
      body: { r: [0, 1.5 * osc(u, 18) * on, 0] },
      head: { r: [-4 * on, 0, 0] },
      mandL: { r: [0, 0, 8 * th] },
      mandR: { r: [0, 0, -8 * th] },
    }, face.pose('open', 0));
  },
};

export default rigDef({ joints, assign, clips, extras: face.extras });
