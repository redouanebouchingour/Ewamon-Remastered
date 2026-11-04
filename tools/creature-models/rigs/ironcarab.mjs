// Ironcarab's rig: a steel rhinoceros beetle drawn side-on, so the scad builds it in a body frame turned 25 degrees to
// its right (YAW); every number here is scad/ironcarab.scad's, written in that frame and turned with B. The elytra,
// belly, pronotum and its hooked horn are the body; the head carries the long snout horn, the short head horn, the
// orange eyes (eyeKit lids) and the fang mandibles. Six thick jointed legs off the root, drawn mid-step (not mirrored).
import { K, TAU, merge, rigDef, win } from './lib/anim.mjs';
import { any, ell, limb, petal, spike } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { chainHit, closest, subFrame } from './lib/geo.mjs';
import { insectClips } from './lib/insect.mjs';

const DEG = Math.PI / 180;
const VIEW = 30;
const YAW = 25;
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
const grow = (r, g) => r.map((v) => v + g);

const BRONZE = [0.5, 0.42, 0.32];
const E1 = [[12, 9, 17.6], Fb(7.2, 21, 0)];
const E2 = [[11, 9.6, 13.6], Fb(15.4, 20.5, 0)];
const PRO = [[10, 8.6, 10.2], Fb(-1.4, 26.8, 0)];
const BELLY = [[9, 15, 5.5], Fb(9, 15.5, 0)];
const HEAD = [[6, 6.2, 6], Fb(-7.2, 18.6, 0)];
const JAW = [[4.2, 4.6, 3.6], Fb(-7.8, 14, 0)];
const EYE_N = [0.932, -0.362];
const EYE = add(HEAD[1], [HEAD[0][0] * EYE_N[0] * 0.93, HEAD[0][1] * EYE_N[1] * 0.93, 0.3]);
const EYE_YAW = 69;
const HORN_L = [Fb(-9.4, 15.8, 0), Fb(-13.5, 19.4, 0), Fb(-17, 23.6, 0), Fb(-19.2, 28.5, 0), Fb(-20.3, 33.5, 0), Fb(-20.8, 38.4, 0)];
const HORN_LR = [2.3, 2.2, 2.0, 1.75, 1.25, 0.2];
const HORN_S = [Fb(-8.6, 22.5, 0), Fb(-10.6, 27.5, 0), Fb(-12, 31.5, 0), Fb(-12.6, 34.8, 0)];
const HORN_SR = [1.6, 1.25, 0.85, 0.15];
const HORN_P = [Fb(-4, 30, 0), Fb(-5.6, 34.6, 0), Fb(-7.6, 37.9, 0), Fb(-10.2, 38.9, 0), Fb(-12, 37.9, 0), Fb(-12.6, 36.8, 0)];
const HORN_PR = [2.6, 2.2, 1.8, 1.3, 0.7, 0.12];
const FANG = [Fb(-6, 14, 2.4), Fb(-6.2, 10.8, 2.8), Fb(-7.4, 8.4, 2.2)];
const FANG_R = [1, 0.75, 0.12];
const FANG2 = [Fb(-9, 13.6, 1.2), Fb(-9.3, 11, 1.4), Fb(-10.2, 9.2, 1)];
const FANG2_R = [0.8, 0.6, 0.1];
// [hip, knee, ankle, foot tip, r], the scad's LEGS in order.
const LEGS = {
  leg1L: [Fb(-3, 14.5, 5), Fb(-3.5, 11, 9), Fz(-1, 5, 10.5), Fz(0.5, 1.4, 11.5), 2.3],
  leg1R: [Fb(-10, 15, -5), Fb(-13.5, 14, -8), Fz(-18.5, 6, -9.5), Fz(-23, 2.6, -10), 2.4],
  leg2L: [Fb(5, 16, 7), Fb(7.5, 11.5, 10), Fz(6, 4, 10.5), Fz(4.5, 1.2, 11), 2.5],
  leg2R: [Fb(9, 15, -7), Fb(13, 12, -10), Fz(14, 5, -11), Fz(14.5, 1.6, -12), 2.1],
  leg3L: [Fb(13, 15, 7), Fb(16, 12, 10), Fz(16.5, 5, 10.5), Fz(17, 1.2, 11), 2.3],
  leg3R: [Fb(17, 16, -7), Fb(21.5, 15, -10), Fz(23, 6, -11), Fz(24.5, 2.6, -12), 2.1],
};

const chainT = (pts, rs) => (c) => chainHit(c, pts, rs).d;
// The scad's leg(hip, knee, ankle, tip, r), its two claws included.
const legT = ([hip, knee, ankle, tip, r]) => {
  const d = sub(tip, ankle);
  const n = Math.hypot(d[0], d[1]);
  const sd = [-d[1] / n, d[0] / n, 0];
  const u = mul(d, 1.1 / Math.hypot(...d));
  return any(
    limb(hip, knee, r * 1.05, r), ell(mul([r, r, r], 1.12), knee), limb(knee, ankle, r * 0.95, r * 0.85),
    ell(mul([r, r, r], 0.88), ankle), limb(ankle, tip, r * 0.7, r * 0.45),
    ...[-1, 1].map((s) => spike(tip, add(add(u, mul(sd, s * 0.9)), [0, 0, -0.9]), r * 0.38)),
  );
};

const proT = (g, off = [0, 0, 0]) => petal(grow(PRO[0], g), add(PRO[1], off), [-12, 0, 0]);
const body = any(
  ell(...BELLY), ell(grow(E1[0], 0.35), E1[1]), ell(grow(E2[0], 0.35), E2[1]),
  proT(0), proT(0.35, [0, 2.2, -0.4]),
);
const eyeR = [2.3, 1.3, 2.1];
const head = any(ell(...HEAD), ell(...JAW), ell(eyeR, EYE), ell(eyeR, mx(EYE)));
const parts = [
  ...Object.entries(LEGS).map(([n, L]) => [n, legT(L)]),
  ['body', body],
  ['body', chainT(HORN_P, HORN_PR)],
  ['head', head],
  ['head', chainT(HORN_L, HORN_LR)],
  ['head', chainT(HORN_S, HORN_SR)],
  ['mandL', any(chainT(FANG, FANG_R), chainT(FANG2, FANG2_R))],
  ['mandR', any(chainT(FANG.map(mx), FANG_R), chainT(FANG2.map(mx), FANG2_R))],
];

const eyeL = { side: 'L', at: EYE, size: 1.35, yaw: EYE_YAW, flat: 0.55, frame: B };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: BRONZE, lid: [1.3, 1.3, 1.2] });

// Every joint rests in the body frame (rot -YAW), so a nod or a leg swing follows the beetle's own axes.
const R0 = [0, 0, -YAW];
const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...Object.entries(LEGS).map(([n, L]) => ({ name: n, parent: 'root', at: W(L[0]), rot: R0 })),
  { name: 'body', parent: 'root', at: W([0, 4, 14]), rot: R0 },
  { name: 'head', parent: 'body', at: W(Fb(-4.5, 17.5, 0)), rot: R0 },
  { name: 'mandL', parent: 'head', at: W(FANG[0]), rot: R0 },
  { name: 'mandR', parent: 'head', at: W(mx(FANG[0])), rot: R0 },
  ...face.joints,
];

function assign(c) {
  return closest(parts.map(([n, t]) => [n, t(B.local(c))]));
}

const base = insectClips({ face, stride: 14, lift: 12 });

const clips = {
  ...base,
  // fidget: lowers its head and shoves with the horns, twice, like clearing a log
  idle_shove: {
    seconds: 2.2,
    pose: (t, u) => {
      const low = K(u, [[0, 0], [0.15, 1], [0.8, 1], [0.95, 0]]);
      const push = Math.max(0, Math.sin(TAU * 2 * ((u - 0.2) / 0.55))) * win(u, 0.2, 0.75, 0.04);
      return merge(base.idle.pose(t, u), {
        body: { r: [6 * low, 0, 0], p: [0, -0.8 * push, 0] },
        head: { r: [10 * low - 12 * push, 0, 0] },
      });
    },
  },
};

export default rigDef({ joints, assign, clips, extras: face.extras });
