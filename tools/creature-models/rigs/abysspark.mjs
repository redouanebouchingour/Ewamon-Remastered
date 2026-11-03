// Abysspark's rig: a long navy anglerfish-shark resting on its fins, built side-on in its own frame (the scad's F():
// the whole fish turned YAW = -35 about Z, u across, v along to the tail). A gaping lower jaw, two pectoral fins, the
// throat fins on the jaw, a swept dorsal crest, a three-link tail ending in the forked fin and an angler stalk to the
// lure. Numbers are scad/abysspark.scad's; abyssparkRig({ tenjin: true }) takes scad/abysspark_tenjin.scad's (the
// same fish, shorter and deeper: jade feathers on the back for the crest, five feather strands per pectoral, a pearl
// grin, a gold halo arch on the body and a gold-ringed bulb).
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { fishClips } from './lib/fish.mjs';
import { capD, chainHit, closest, ellD, isAny, near, plateD, rot, slabD, unrot } from './lib/geo.mjs';

const YAW = -35;

// the scad's L(): a sheet point at depth u -> the fish frame; F(): fish frame -> scad
const L = (sx, zs, u = 0) => { const v = (sx - 0.42262 * u) / 0.90631; return [u, v, zs + 0.1574 * u - 0.0734 * v]; };
const F = (p) => rot([0, 0, YAW], p);
const toFish = (c) => unrot([0, 0, YAW], c);
// side(u0)'s inverse: a fish-frame point -> the sheet-authored plate frame [x, y, z]
const unside = ([u, v, z], u0 = 0) => { const x = (v + 0.46631 * u0) / 1.10338; return [x, u0 - u, z + 0.08099 * x - 0.19163 * u0]; };
// hinged(u0, zh, a)'s inverse (the near side; fold the far one onto it first)
const unhinge = (l, u0, zh, a) => { const q = unrot([0, a, 0], [l[0] - u0, l[1], l[2] - zh]); return unside([q[0] + u0, q[1], q[2] + zh], u0); };
const secD = (l, s) => ellD(l, [s[2], s[3], s[4]], L(s[0], s[1]));
// a hull of two sections: the nearest point on the segment between their centres, radii blended
const hullD = (l, a, b) => {
  const pa = L(a[0], a[1]); const pb = L(b[0], b[1]);
  const d = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
  const t = Math.min(1, Math.max(0, ((l[0] - pa[0]) * d[0] + (l[1] - pa[1]) * d[1] + (l[2] - pa[2]) * d[2]) / (d[0] ** 2 + d[1] ** 2 + d[2] ** 2)));
  const r = [2, 3, 4].map((i) => a[i] + (b[i] - a[i]) * t);
  return ellD(l, r, [pa[0] + d[0] * t, pa[1] + d[1] * t, pa[2] + d[2] * t]);
};
// the tenjin scad's leaf(a, b, w): a feather strand outline
const leaf = (a, b, w) => {
  const d = [b[0] - a[0], b[1] - a[1]]; const n0 = Math.hypot(...d); const n = [-d[1] / n0, d[0] / n0];
  const P = (k, m) => [a[0] + d[0] * k + n[0] * w * m, a[1] + d[1] * k + n[1] * w * m];
  return [P(0, 0.5), P(0.45, 0.55), P(0.8, 0.25), [b[0], b[1]], P(0.72, -0.1), P(0.62, -0.4), P(0.4, -0.3), P(0.3, -0.5), P(0, -0.5)];
};
const pts = (list) => list.map(([x, z]) => L(x, z));

const BASE = {
  body: [[-19.8, 20.9, 2.2, 1.2, 1.7], [-15, 24.1, 4.3, 3, 4.7], [-8, 22.4, 6, 4, 9], [0, 20, 6.4, 4, 9],
    [6, 18.4, 5.4, 3, 7.2], [11, 17.6, 3.3, 2, 4], [15, 17.4, 2, 1.5, 2.3], [17.6, 17.8, 1.3, 1, 1.6]],
  jaw: [[-17.6, 15.8, 2.4, 1.3, 1.5], [-10, 14.6, 4.6, 2.5, 2.6]],
  crest: [[[-8.5, 29.5], [-6.4, 32.6], [-1, 36.4], [7.2, 39.6], [2.6, 34.2], [3.4, 30.5], [-2, 28.6]],
    [[2.2, 30.6], [4.2, 32.2], [9, 33.4], [13.3, 34], [8.6, 29.6], [6.4, 26.8]],
    [[6.4, 26.2], [8.6, 29.3], [12.4, 29.2], [16.1, 28.8], [10.6, 24.4], [8.6, 23.6]]],
  crestD: (m) => Math.min(...[2.6, 2.2, 2].map((t, i) => slabD(m, BASE.crest[i], t + 0.4, 1))),
  crestTail: [[9.8, 21.4], [11, 22.8], [13, 22.2], [12.8, 20.6]],
  forkD: (m) => Math.min(slabD(m, [[14.6, 19.2], [20, 21.8], [30.2, 26.4], [26.4, 21], [22.8, 15.6], [15.6, 15.4]], 2.8, 1.2),
    slabD(m, [[15.6, 16.2], [21.6, 15.6], [26.1, 10.8], [21, 11.8], [16.4, 13]], 2.4, 1)),
  pec: { hinge: [4.6, 16.6, -36], shapes: [[[-1.2, 17.6], [4, 18.6], [10, 17.2], [16, 12.7], [19.4, 9.9], [16.9, 8.2], [22.7, 3.8],
    [13.6, 4.9], [15.5, -0.1], [8, 4.6], [8, 1.3], [4.7, 4.6], [3.9, 3.3], [1.7, 8.5], [-1.4, 11.4]]], t: 1.7, at: [4.6, 3.4, 16.6] },
  throatFin: { hinge: [2.2, 14.4, -16], shape: [[-18.4, 15.6], [-25.5, 5.8], [-17.2, 10.5], [-15, 7.4], [-12.8, 11], [-11.1, 9.9],
    [-10.6, 13.6], [-14, 15]], at: [2.2, -17.6, 14.4] },
  stalk: pts([[-7.5, 30.5], [-8, 34.5], [-9.5, 37.8], [-12, 39.4], [-15, 39.5], [-18, 38.3], [-20.8, 36], [-22.8, 33.6], [-23.6, 32.2]]),
  stalkR: (i) => 0.62 - i * 0.022,
  lure: L(-23.8, 30.1),
  lureR: 2.4,
  glows: [[0.99, 0.98, 0.86], [0.98, 0.95, 0.32]],
  eye: { at: L(-13.4, 25.3, 3.8), size: 1.5 },
  skin: [0.07, 0.16, 0.39],
  pearl: [0.86, 0.9, 0.9],
  // the mouth: teeth rows (base, then the tooth's length up or down)
  upper: [0, 0.25, 0.5, 0.75, 1].map((t) => [L(-19.2 + 7 * t, 19.5 + 0.2 * t, 1.1 + 2.6 * t), -1.6 + 0.4 * t]),
  lower: [0, 0.25, 0.5, 0.75, 1].map((t) => [L(-17.6 + 7.4 * t, 16.9 + 0.3 * t, 1.6 + 2.5 * t), 1.5 - 0.3 * t]),
  gum: [0.62, 0.07, 0.11],
  pivots: { body: [-2, 17], jaw: [-8.5, 16.8], jawBack: -8, dorsal: [0, 28.5], tail: [[10.5, 17.6], [14.5, 17.4], [17.4, 17.8]] },
};

const TJ_PEC = [[[-0.5, 13.5], [0.5, 3.7], 3.2], [[2.5, 14.5], [8.6, 3.2], 3.6], [[4.5, 15], [16.5, 1.4], 4], [[6.5, 15.5], [21, 2], 4],
  [[8, 16], [19, 9.6], 3.4]];
const TJ_FEATH = [[[-1.5, 31.5], [0.3, 33.6], [2.4, 36], [4.4, 38.2], [5.9, 40], [6, 38.2], [5.6, 36.4], [5.9, 35.2], [4.9, 34.4],
  [4.4, 33.2], [3.4, 32], [2.4, 30.6]],
[[5.5, 30.5], [8, 31.8], [11, 33.6], [14, 35.8], [16.3, 37.6], [17.8, 39.2], [17.9, 37.2], [17.3, 35], [16, 33.5],
  [16.8, 32.4], [15, 31.6], [14.2, 30.4], [14.8, 29.6], [12.6, 28.6], [12.2, 27.4], [11, 26.6], [9.5, 25.2], [7.5, 25.5]]];
const TENJIN = {
  body: [[-16.4, 19.3, 2.4, 1.2, 2.4], [-12.8, 22.8, 4.4, 2.5, 4.8], [-7.5, 21, 6, 3, 9.5], [-1.5, 20, 6.4, 3, 10],
    [4, 19, 5.6, 2.6, 8.5], [8, 18.2, 3.8, 2, 5], [11, 18, 2.2, 1.4, 2.6], [13, 18.3, 1.4, 1, 1.8]],
  jaw: [[-15, 14.8, 2.4, 1.2, 1.4], [-9, 13.8, 4.6, 2.2, 2.4]],
  crestD: (m) => Math.min(...TJ_FEATH.map((f) => plateD(m, f, 2.2))),
  crestTail: null,
  forkD: (m) => plateD(m, [[10, 19], [13, 21], [17, 23], [21.4, 24.4], [19.4, 21], [18.2, 19.4], [19.6, 17.2], [18.4, 15], [19, 12.5],
    [18.4, 10], [15.5, 12.5], [12.5, 15], [10.5, 16]], 2.6),
  pec: { hinge: [5, 15.5, -26], shapes: TJ_PEC.map(([a, b, w]) => leaf(a, b, w)), t: 1.9, at: [5, 2.1, 15.5] },
  throatFin: { hinge: [2.2, 13, -10], shape: [[-16, 14.6], [-18, 15.7], [-19.5, 13.4], [-20.8, 10.8], [-19, 9.5], [-18, 3.7],
    [-15.5, 5.2], [-12.5, 1.1], [-10.8, 6], [-9.2, 9.5], [-10.6, 13.6]], at: [2.2, -18.7, 13] },
  stalk: pts([[-7.9, 27], [-8.6, 29.5], [-9.6, 31], [-11.3, 32.6], [-13, 33.2], [-15, 32.6], [-16.6, 31.2], [-17.6, 29.7]]),
  stalkR: (i) => 0.72 - i * 0.03,
  lure: L(-18.6, 27.1),
  lureR: 4.4,
  glows: [[0.98, 0.9, 0.5]],
  eye: { at: L(-10.2, 21.6, 4.6), size: 1.7 },
  skin: [0.11, 0.22, 0.42],
  pearl: [0.95, 0.94, 0.78],
  // the pearl beads: the lower lip row (on the jaw) and the upper lip row (on the head), as capsules along each row
  upper: [[L(-9, 17.7, 4.9), L(-4, 18.8, 5.5)]],
  lower: [[L(-15.4, 15.3, 2.1), L(-6.6, 17.4, 5.3)], [L(-16, 15.4, 0.9), L(-15.4, 15.3, 2.1)]],
  gum: null,
  halo: L(-7.5, 28.8),
  pivots: { body: [-3, 16.5], jaw: [-7, 15.6], jawBack: -6.5, dorsal: [4, 29], tail: [[8, 18.2], [11, 18], [13, 18.3]] },
};

const lure = ['lure1', 'lure2', 'lure3'];
const tail = ['tail1', 'tail2', 'tail3'];

export function abyssparkRig({ tenjin = false } = {}) {
  const C = tenjin ? TENJIN : BASE;
  const P = C.pivots;
  // the eyes: lib.scad eye() at C.eye (and its mirror) inside F(), yaw 58 in the fish frame; the lids hang off the
  // body, whose rest frame is the fish frame, so they take the fish-frame yaw
  const E = C.eye.at;
  const face = eyeKit({
    eyes: [{ side: 'L', at: F(E), size: C.eye.size, yaw: 58 }, { side: 'R', at: F([-E[0], E[1], E[2]]), size: C.eye.size, yaw: -58 }],
    parent: 'body', skin: C.skin,
  });
  const W = (sx, z, u = 0) => F(L(sx, z, u));
  const A = (p, s = 1) => F([p[0] * s, p[1], p[2]]);
  const vT = P.tail.map(([x, z]) => L(x, z)[1]);
  const stalkR = C.stalk.map((_, i) => C.stalkR(i));

  const joints = [
    { name: 'root', at: [0, 0, 0] },
    { name: 'body', parent: 'root', at: W(...P.body), rot: [0, 0, YAW] },
    { name: 'jaw', parent: 'body', at: W(...P.jaw) },
    { name: 'finL', parent: 'body', at: A(C.pec.at) },
    { name: 'finR', parent: 'body', at: A(C.pec.at, -1) },
    { name: 'fin2L', parent: 'jaw', at: A(C.throatFin.at) },
    { name: 'fin2R', parent: 'jaw', at: A(C.throatFin.at, -1) },
    { name: 'dorsal1', parent: 'body', at: W(...P.dorsal) },
    { name: 'tail1', parent: 'body', at: W(...P.tail[0]) },
    { name: 'tail2', parent: 'tail1', at: W(...P.tail[1]) },
    { name: 'tail3', parent: 'tail2', at: W(...P.tail[2]) },
    { name: 'lure1', parent: 'body', at: F(C.stalk[0]) },
    { name: 'lure2', parent: 'lure1', at: F(C.stalk[3]) },
    { name: 'lure3', parent: 'lure2', at: F(C.stalk[6]) },
    ...face.joints,
  ];

  const rowD = (f, list) => Math.min(...list.map(([p, q]) => (Array.isArray(q) ? capD(f, p, q, 0.8, 0.8) : capD(f, p, [p[0], p[1], p[2] + q], 0.5, 0.15))));

  function assign(c, rgb) {
    const l = toFish(c);
    const f = [Math.abs(l[0]), l[1], l[2]];
    const S = l[0] >= 0 ? 'L' : 'R';
    // the lure: the glowing bulb (and the Tenjin's ring and rays), then the stalk by link
    if (isAny(rgb, C.glows, 0.04) || ellD(l, [C.lureR, C.lureR, C.lureR + 0.2], C.lure) < 1.05) return 'lure3';
    const h = chainHit(l, C.stalk, stalkR);
    if (h.d < 1.5 && l[2] > C.stalk[0][2] - 0.7) return lure[h.i < 3 ? 0 : h.i < 6 ? 1 : 2];
    // the Tenjin's halo arch and gem ride the body
    if (C.halo && f[0] < 1.6 && l[2] > C.halo[2] - 4) {
      const r = Math.hypot(l[1] - C.halo[1], l[2] - C.halo[2]);
      if (Math.abs(r - 5.1) < 1.2) return 'body';
    }
    // fins, each in its own plate frame
    const [pu, pz, pa] = C.pec.hinge;
    const pm = unhinge(f, pu, pz, pa);
    if (Math.min(...C.pec.shapes.map((s) => plateD(pm, s, C.pec.t))) < 1.4 && f[0] > pu - 1) return `fin${S}`;
    const [tu, tz, ta] = C.throatFin.hinge;
    if (plateD(unhinge(f, tu, tz, ta), C.throatFin.shape, 1.6) < 1.4 && f[0] > tu - 1 && l[2] < tz + 3) return `fin2${S}`;
    // the mouth: gums on the jaw, teeth or pearls by row
    if (C.gum && near(rgb, C.gum, 0.05)) return 'jaw';
    if (near(rgb, C.pearl, 0.04) && ellD(f, [2.8, 2.8, 2.8], E) > 1) {
      const up = rowD(f, C.upper); const lo = rowD(f, C.lower);
      if (Math.min(up, lo) < 1.5) return up < lo ? 'body' : 'jaw';
    }
    // the midline parts: the crest (or the feathers) on the dorsal joint, the base's small last spike on the tail, the fork
    const m = unside(l);
    const bodyD = Math.min(...C.body.slice(0, -1).map((s, i) => hullD(l, s, C.body[i + 1])));
    const jawD = Math.min(hullD(l, C.jaw[0], C.jaw[1]), secD(l, C.jaw[0]) * 1.02);
    const list = [['crest', C.crestD(m)], ['fork', C.forkD(m)], ['body', bodyD], ['jaw', jawD]];
    if (C.crestTail) list.push(['crestD', slabD(m, C.crestTail, 1.8, 1)]);
    const pick = closest(list);
    if (pick === 'jaw' && l[1] < L(P.jawBack, 16)[1]) return 'jaw';
    if (pick === 'crest') return 'dorsal1';
    if (pick === 'crestD') return 'tail1';
    if (pick === 'fork' || l[1] > vT[2] + 1) return 'tail3';
    if (l[1] > vT[1]) return 'tail2';
    if (l[1] > vT[0]) return 'tail1';
    return 'body';
  }

  const clips = fishClips({ face, tail, dorsal: ['dorsal1'], lure, sweep: 9 });

  // fidget: opens its maw wide in a slow yawn of a threat, the lure crackling, the crest bristling
  clips.idle_maw = {
    seconds: 2.4,
    pose: (t, u) => {
      const open = K(u, [[0, 0], [0.3, 1], [0.6, 1], [0.75, 0]]);
      const crackle = osc(u, 20) * win(u, 0.3, 0.6, 0.05);
      return merge({
        body: { r: [-5 * open, 0, 0] },
        jaw: { r: [(tenjin ? 16 : 24) * open, 0, 0] },
        ...face.pose('open', blinks(u, [[0.85, 0.9]])),
        dorsal1: { r: [-8 * open, 0, 0] },
        lure3: { r: [6 * crackle, 0, 6 * crackle], s: 1 + 0.2 * open },
        finL: { r: [0, -12 * open, 0] },
        finR: { r: [0, 12 * open, 0] },
      });
    },
  };

  return rigDef({ joints, assign, extras: face.extras, clips });
}

export default abyssparkRig();
