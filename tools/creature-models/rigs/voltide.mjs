// Voltide's rig: a sleek electric anglerfish resting on its belly fins, built side-on in its own frame (the scad's F():
// the whole fish turned YAW = -35 about Z, u across, v along to the tail). An underbite jaw rising before the snout,
// two pectoral fins swept up the flanks, two pelvic fins, a swept dorsal sail, a three-link tail ending in the
// three-pointed fin and a thick angler stalk arching to the crackling lure. Numbers are scad/voltide.scad's.
import { K, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { fishClips } from './lib/fish.mjs';
import { chainHit, closest, ellD, isAny, plateD, rot, slabD, unrot } from './lib/geo.mjs';

const YAW = -35;

// the scad's L(): a sheet point at depth u -> the fish frame; F(): fish frame -> scad
const L = (sx, zs, u = 0) => { const v = (sx - 0.42262 * u) / 0.90631; return [u, v, zs + 0.1574 * u - 0.0734 * v]; };
const F = (p) => rot([0, 0, YAW], p);
const toFish = (c) => unrot([0, 0, YAW], c);
// side(u0)'s inverse: a fish-frame point -> the sheet-authored plate frame [x, y, z]
const unside = ([u, v, z], u0 = 0) => { const x = (v + 0.46631 * u0) / 1.10338; return [x, u0 - u, z + 0.08099 * x - 0.19163 * u0]; };
// hinged(u0, zh, a)'s inverse (the near side; fold the far one onto it first)
const unhinge = (l, u0, zh, a) => { const q = unrot([0, a, 0], [l[0] - u0, l[1], l[2] - zh]); return unside([q[0] + u0, q[1], q[2] + zh], u0); };
const ellAt = (l, s) => ellD(l, [s[2], s[3], s[4]], L(s[0], s[1]));
// a hull of two sections: the nearest point on the segment between their centres, radii blended
const hullD = (l, a, b) => {
  const pa = L(a[0], a[1]); const pb = L(b[0], b[1]);
  const d = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
  const t = Math.min(1, Math.max(0, ((l[0] - pa[0]) * d[0] + (l[1] - pa[1]) * d[1] + (l[2] - pa[2]) * d[2]) / (d[0] ** 2 + d[1] ** 2 + d[2] ** 2)));
  const r = [2, 3, 4].map((i) => a[i] + (b[i] - a[i]) * t);
  return ellD(l, r, [pa[0] + d[0] * t, pa[1] + d[1] * t, pa[2] + d[2] * t]);
};
const chainD = (l, secs) => Math.min(...secs.slice(0, -1).map((s, i) => hullD(l, s, secs[i + 1])), ellAt(l, secs[0]));

const BODY = [[-23.6, 15.4, 2.6, 1.4, 5], [-19, 16.5, 5.6, 3, 8.8], [-11, 17, 7.6, 4.5, 11.4], [-2, 16.5, 7.4, 4, 10.4],
  [6, 16, 6, 3.5, 8.4], [13, 15.5, 4.2, 3, 6], [19, 15.5, 2.4, 2, 3.5], [22.5, 15.5, 1.5, 1.2, 2.3]];
// the jaw chain as sections [sx, sz, half-width, r, r]
const JAW = [[-20.5, 8.2, 3, 1.6], [-24, 9.6, 2.6, 1.5], [-25.9, 12.6, 2.1, 1.3], [-26.3, 16.5, 1.7, 1.1], [-26.2, 20, 1.3, 0.9],
  [-25.7, 21.6, 0.9, 0.6]].map(([x, z, u, r]) => [x, z, u, r, r]);
const SAIL = [[-14, 26], [-12, 28.6], [-8, 31.6], [-5.3, 35.6], [-1, 37.6], [3.2, 39.4], [4.8, 39.8], [0.3, 32.5], [-1, 27], [-8, 25]];
const SAIL2 = [[-1, 29], [0.3, 32.5], [5.6, 32.1], [2.9, 27.4], [0, 25.5]];
const VENT = [[[8, 9.6], [9.5, 7.2], [13, 7.6], [13, 11.5]], [[12, 11.5], [13, 7.6], [14.4, 6.6], [15.5, 11.8]],
  [[14, 11.6], [13.9, 8.6], [17.5, 8.1], [18, 12.5]], [[17, 12.5], [17.2, 10.6], [19.5, 11.5], [21.4, 12.8], [19, 14]]];
const TAIL = [[[18.5, 18.8], [24, 23.5], [29.5, 29.4], [36, 32.5], [42.7, 34.4], [41, 33], [37.5, 27.5], [32.6, 18.6], [28, 15], [21, 14.5]],
  [[27, 17], [32.6, 18.6], [38, 18.9], [34.5, 14.3], [29.1, 12], [25, 13.5]],
  [[20, 12.4], [24.5, 7.3], [28.7, 5.8], [33.8, 6.2], [30.3, 8.5], [29.1, 12], [24, 14.5]]];
const TAIL_D = [2.6, 2.2, 2.2];
const PEC = { hinge: [6.4, 15, 24], shape: [[-4.6, 14.6], [-3.5, 16], [2, 21], [7.5, 26], [11, 29], [16, 31], [19.9, 33.4], [20.8, 33.4],
  [20.2, 30.1], [17.4, 27.2], [20.6, 26.8], [16.4, 21], [13, 17.4], [8, 14], [3, 12.8], [-2, 13.2]], t: 1.9 };
const PELV = { hinge: [5, 10, -22], shape: [[-2.5, 12.5], [3, 13], [8, 11], [10.5, 8], [13.3, 0.4], [10.5, 2.5], [8.5, 3.5], [6.5, 1.5],
  [4, 4.5], [1, 8], [-2.5, 10.5]], t: 1.7 };
const STALK = [[-13.5, 27], [-15, 30.8], [-17.6, 33.2], [-21, 34.3], [-24.6, 33.8], [-27.8, 32], [-30, 29.6], [-31.4, 27.6]]
  .map(([x, z]) => L(x, z));
const STALK_R = STALK.map((_, i) => 1.45 - i * 0.06);
const LURE = L(-35, 22.7);
const GLOWS = [[1, 0.87, 0.1], [1, 0.99, 0.88], [1, 0.88, 0.12]];
const SOCKET = [0.02, 0.1, 0.3];

const lure = ['lure1', 'lure2', 'lure3'];
const tail = ['tail1', 'tail2', 'tail3'];
const W = (sx, z, u = 0) => F(L(sx, z, u));
const A = (p, s = 1) => F([p[0] * s, p[1], p[2]]);
const TAIL_AT = [14, 19.5, 22.5];
const vT = TAIL_AT.map((x) => L(x, 15.5)[1]);

// the eyes: lib.scad eye() inside F() at L(-12.4, 15.2, 6.5), yaw 70 in the fish frame; the lids hang off the body,
// whose rest frame is the fish frame, so they take the fish-frame yaw
const E = L(-12.4, 15.2, 6.5);
const face = eyeKit({
  eyes: [{ side: 'L', at: F(E), size: 2.6, yaw: 70 }, { side: 'R', at: F([-E[0], E[1], E[2]]), size: 2.6, yaw: -70 }],
  parent: 'body', skin: SOCKET,
});

const pecAt = L(-1, 14.8, PEC.hinge[0]);
const pelvAt = L(0.5, 11, PELV.hinge[0]);
const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: W(-3, 16), rot: [0, 0, YAW] },
  { name: 'jaw', parent: 'body', at: W(-21, 8.6) },
  { name: 'finL', parent: 'body', at: A(pecAt), rot: [0, 0, YAW] },
  { name: 'finR', parent: 'body', at: A(pecAt, -1), rot: [0, 0, YAW] },
  { name: 'fin2L', parent: 'body', at: A(pelvAt), rot: [0, 0, YAW] },
  { name: 'fin2R', parent: 'body', at: A(pelvAt, -1), rot: [0, 0, YAW] },
  { name: 'dorsal1', parent: 'body', at: W(-4, 26.5) },
  { name: 'tail1', parent: 'body', at: W(TAIL_AT[0], 15.5) },
  { name: 'tail2', parent: 'tail1', at: W(TAIL_AT[1], 15.5) },
  { name: 'tail3', parent: 'tail2', at: W(TAIL_AT[2], 15.5) },
  { name: 'lure1', parent: 'body', at: F(STALK[0]) },
  { name: 'lure2', parent: 'lure1', at: F(STALK[3]) },
  { name: 'lure3', parent: 'lure2', at: F(STALK[6]) },
  ...face.joints,
];

function assign(c, rgb) {
  const l = toFish(c);
  const f = [Math.abs(l[0]), l[1], l[2]];
  const S = l[0] >= 0 ? 'L' : 'R';
  // the lure: the glowing ball, its core and the sparks round it (the body's yellow marks are all behind x -9)
  if (ellD(l, [5.9, 5.9, 5.9], LURE) < 1 || (isAny(rgb, GLOWS, 0.04) && l[1] < L(-20, 0)[1])) return 'lure3';
  const h = chainHit(l, STALK, STALK_R);
  if (h.d < 1.3 && l[2] > STALK[0][2] - 0.5) return lure[h.i < 2 ? 0 : h.i < 5 ? 1 : 2];
  // fins, each in its own plate frame
  const [pu, pz, pa] = PEC.hinge;
  if (plateD(unhinge(f, pu, pz, pa), PEC.shape, PEC.t) < 1.4 && f[0] > pu - 1) return `fin${S}`;
  const [vu, vz, va] = PELV.hinge;
  if (plateD(unhinge(f, vu, vz, va), PELV.shape, PELV.t) < 1.4 && f[0] > vu - 1 && l[2] < vz + 4) return `fin2${S}`;
  // the midline parts and the body: the sail on the dorsal joint, the fork on the last tail link, the rest by length
  const m = unside(l);
  const list = [
    ['sail', Math.min(slabD(m, SAIL, 3.3, 1.1), slabD(m, SAIL2, 2.7, 0.8))],
    ['fork', Math.min(...TAIL.map((t, i) => slabD(m, t, TAIL_D[i] + 0.4, 1)))],
    ['vent', Math.min(...VENT.map((v) => slabD(m, v, 1.8, 0.4)))],
    ['body', chainD(l, BODY)],
    ['jaw', chainD(l, JAW)],
  ];
  const pick = closest(list);
  if (pick === 'jaw') return 'jaw';
  if (pick === 'sail') return 'dorsal1';
  if (pick === 'fork' || l[1] > vT[2] + 0.5) return 'tail3';
  if (l[1] > vT[1]) return 'tail2';
  if (l[1] > vT[0]) return 'tail1';
  return 'body';
}

// the long stalk: the template's limp lure (24 deg per link, compounding) would drop the big ball onto the jaw, so
// faint only lets it sag a little
const sag = (t, u) => { const down = smooth((u - 0.2) / 0.5); return { lure1: { r: [-16 * down, 0, 0] }, lure2: { r: [-20 * down, 0, 0] }, lure3: { r: [-24 * down, 0, 0] } }; };
const clips = fishClips({ face, tail, dorsal: ['dorsal1'], lure, sweep: 10, add: { faint: sag } });

// fidget: a charge builds (the fins shiver, the lure jitters), then a crackle runs down the body and the jaw snaps
clips.idle_charge = {
  seconds: 2.2,
  pose: (t, u) => {
    const build = K(u, [[0, 0], [0.55, 1], [0.62, 1], [0.7, 0]]);
    const zap = win(u, 0.6, 0.78, 0.03);
    const jit = osc(u, 22) * build;
    return merge({
      body: { r: [-3 * build, 2 * osc(u, 30) * zap, 0], s: 1 + 0.02 * zap },
      jaw: { r: [16 * zap, 0, 0] },
      ...face.pose(zap > 0.3 ? 'squeeze' : 'open', blinks(u, [[0.88, 0.93]])),
      finL: { r: [0, -6 * jit - 20 * zap, 0] },
      finR: { r: [0, 6 * jit + 20 * zap, 0] },
      lure3: { r: [8 * jit, 0, 10 * jit], s: 1 + 0.25 * zap },
      tail1: { r: [0, 0, 10 * osc(u, 8) * zap] },
    });
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
