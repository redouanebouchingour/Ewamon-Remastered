// Rimeidol's rig: a frost ghost drifting with its skull mask turned to the viewer, a horned hood, a far arm reaching
// out and a near one hanging under the body, and everything else wide flat ribbons of frost (scad ribbon(): a
// Catmull-Rom curve swept by thin flat ellipses). Streamer A over the top is the template's wisp chain, B (curling
// down at its end) and the pale band C under A copy it; the widest drape band is the template's tail and the other
// drape, fray and back strands copy it, softer. Numbers are scad/rimeidol.scad's (the 2026-11-06 ribbon remodel).
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { floaterClips } from './lib/floater.mjs';
import { capD, closest, ellD, fold, isAny, near, subFrame } from './lib/geo.mjs';

const SKULL = [0.93, 0.91, 0.87];
const HEADONLY = [SKULL, [0.78, 0.74, 0.77], [0.16, 0.11, 0.26], [0.72, 0.84, 1.00], [0.26, 0.26, 0.51]];
const FROST = [0.92, 0.96, 0.98];

// scad W(): a front-sheet point at depth y, the camera tilt taken out
const W = (s, z, y) => { const x = (s - 0.5 * y) / 0.866; return [x, y, z - 0.17 * (-0.5 * x + 0.866 * y)]; };

const H = W(-8.4, 21, -12);
const HY = 22;
const HF = subFrame(H, [0, 0, HY]);

// ---- ribbon() maths, as in the scad
const CAM = [0.5, -0.866, 0];
const BACK = [0, 1, 0];
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, k) => a.map((v) => v * k);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => mul(v, 1 / Math.hypot(...v));
function cr(P, s) {
  const n = P.length;
  const i = Math.min(Math.floor(s), n - 2);
  const t = s - i;
  const [p0, p1, p2, p3] = [P[Math.max(i - 1, 0)], P[i], P[i + 1], P[Math.min(i + 2, n - 1)]];
  return [0, 1, 2].map((k) => 0.5 * (2 * p1[k] + (p2[k] - p0[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t
    + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t * t * t));
}
const lin = (V, s) => { const i = Math.min(Math.floor(s), V.length - 2); const t = s - i; return V[i] * (1 - t) + V[i + 1] * t; };
/** The swept ellipses of one ribbon, sampled finer than the scad's hull steps. */
function sweep(P, Wv, N, th) {
  const n = P.length;
  const out = [];
  for (let s = 0; s <= n - 1 + 1e-9; s += 1 / 12) {
    const T = unit(sub(cr(P, Math.min(s + 0.05, n - 1)), cr(P, Math.max(s - 0.05, 0))));
    const wd = unit(cross(N, T));
    const w = lin(Wv, s);
    out.push({ s, p: cr(P, s), T, wd, nn: cross(T, wd), w, t: Math.max(0.16, th * Math.min(1, w / 1.4)) });
  }
  return out;
}
/** Nearest point of a swept ribbon: { s, d } with d the normalised distance from the nearest ellipse. */
function ribbonHit(c, samples) {
  let best = { s: 0, d: Infinity };
  for (const e of samples) {
    const v = sub(c, e.p);
    const d = Math.hypot(dot(v, e.T) / 0.6, dot(v, e.wd) / e.w, dot(v, e.nn) / e.t);
    if (d < best.d) best = { s: e.s, d };
  }
  return best;
}

// the scad's rows: points, widths, face, thickness; `links` are the control points that start a joint
const STRANDS = [
  { name: 'wisp', parent: 'head', N: CAM, th: 0.8, links: [0, 1, 2, 3, 4, 5, 6],
    P: [W(-4, 31.5, -8), W(-1.5, 35.8, -4), W(2.5, 37.4, 0), W(6.5, 36.3, 4), W(10.5, 37, 7.5), W(13.5, 38.6, 10), W(16.8, 36.6, 12), W(19.8, 34, 13.5)],
    Wv: [1.8, 2.3, 2.5, 2.6, 2.4, 2.1, 1.7, 0.3] },
  { name: 'band', parent: 'head', N: CAM, th: 0.6, links: [0, 2],
    P: [W(-2.5, 33, -6), W(2, 34.6, -1), W(6.5, 34, 3.5), W(10.5, 34.8, 7), W(14.5, 33.4, 9.5)], Wv: [1.5, 1.9, 1.9, 1.6, 0.3] },
  { name: 'wispB', parent: 'head', N: CAM, th: 0.8, links: [0, 2, 4, 5, 6, 7],
    P: [W(-1.5, 28.8, -7), W(3, 29.4, -2), W(7, 29.7, 2), W(11, 30.1, 6), W(15, 29.5, 9), W(18.3, 27.2, 11), W(19.2, 23, 11.5), W(18.3, 18.6, 11), W(16.8, 16, 10.5)],
    Wv: [2, 2.5, 2.6, 2.6, 2.4, 2.1, 1.8, 1.3, 0.3] },
  { name: 'tail', parent: 'head', N: CAM, th: 0.9, links: [0, 2, 4],
    P: [W(-3.5, 26, -4), W(1.5, 25, 0.5), W(6.5, 23.4, 4.5), W(10.5, 23.2, 7.5), W(14.5, 21.4, 10), W(17, 20.2, 11.5)], Wv: [3, 3.4, 3.4, 3, 2.2, 0.3] },
  { name: 'veil', parent: 'body', N: CAM, th: 0.8, links: [0, 2],
    P: [W(-2.5, 20.5, -2), W(3, 19.6, 2), W(8, 18, 6), W(12.5, 17, 9), W(16.6, 17.6, 11)], Wv: [3, 3.4, 3.2, 2.4, 0.3] },
  { name: 'fray', parent: 'body', N: CAM, th: 0.8, links: [0, 2],
    P: [W(0, 13.8, 0), W(5, 12.6, 4), W(10, 11.8, 7), W(14.6, 10.8, 9.5), W(17.6, 12.8, 11)], Wv: [3, 3.2, 2.8, 1.9, 0.3] },
  { name: 'frayb', parent: 'body', N: CAM, th: 0.8, links: [0, 2],
    P: [W(-1.5, 8.6, -1), W(3, 7.4, 2), W(8, 6.6, 5), W(11.6, 5, 7), W(13.2, 2.6, 8)], Wv: [2.8, 2.9, 2.5, 1.6, 0.3] },
  { name: 'veilb', parent: 'body', N: CAM, th: 0.8, links: [0, 2],
    P: [W(-1, 23.4, -1), W(4, 22.2, 3), W(9, 21, 7), W(12.6, 19.8, 10), W(14.6, 17.4, 12)], Wv: [2.6, 3, 2.8, 1.9, 0.3] },
  { name: 'veilc', parent: 'body', N: CAM, th: 0.8, links: [0, 2],
    P: [W(0, 17, 0), W(5, 16, 4.5), W(10, 14.8, 8), W(13.4, 13.2, 10.5), W(15, 11.2, 12)], Wv: [2.6, 3, 2.6, 1.6, 0.3] },
  { name: 'veild', parent: 'body', N: CAM, th: 0.8, links: [0, 2],
    P: [W(0.5, 11, 0.5), W(5, 9.8, 4.5), W(9.5, 8.8, 7.5), W(12.6, 7.6, 9.5)], Wv: [2.4, 2.6, 2, 0.3] },
  { name: 'back', parent: 'body', N: BACK, th: 0.8, links: [0, 2, 3, 4],
    P: [[-6, -4, 31], [-6.8, -0.6, 26], [-5.5, 4.5, 18], [-6, 6.5, 10], [-10, 4, 4.5], [-14, 0.5, 4], [-16.2, -1.5, 6.2]], Wv: [2.4, 3, 3.2, 3, 2.4, 1.6, 0.3] },
  { name: 'backb', parent: 'body', N: BACK, th: 0.8, links: [0, 2, 3],
    P: [[-2.5, -4.2, 31.5], [-1.8, -0.4, 25.5], [0.3, 5, 18], [1.5, 7.4, 10], [0.6, 6.4, 4], [-1.2, 4.6, 0.6]], Wv: [2.2, 2.8, 3.2, 3, 2, 0.3] },
  { name: 'backc', parent: 'body', N: BACK, th: 0.8, links: [0, 2],
    P: [[-10, -6.5, 28], [-11.5, -3, 22], [-10.5, 1, 15], [-11, 1.5, 9], [-12.5, -0.5, 5.5]], Wv: [2.2, 2.8, 3, 2.4, 0.3] },
  { name: 'backd', parent: 'body', N: BACK, th: 0.8, links: [0, 2],
    P: [[0.5, -6, 29.5], [2.5, -2, 23.5], [3.5, 2.5, 16], [4, 4, 9], [3.2, 3, 3.5]], Wv: [2, 2.6, 2.8, 2.2, 0.3] },
].map((r) => ({ ...r, samples: sweep(r.P, r.Wv, r.N, r.th), names: r.links.map((_, k) => `${r.name}${k + 1}`) }));
const strand = Object.fromEntries(STRANDS.map((r) => [r.name, r]));
// the near dangling tip under the body (a ribbon of the body)
const TIP = sweep([[3.4, -4, 6.4], [3.8, -5.6, 3], [4.4, -6.4, 0.3]], [2.6, 2.2, 0.4], CAM, 0.8);
const MOTES = [W(20, 28.5, 12), W(21.5, 31, 14), W(18.5, 13.5, 10), W(14, 7.5, 7), W(20.5, 21.5, 12), W(12, 3.2, 5),
  W(17.5, 8.5, 9), W(19.5, 17, 11), W(16, 5.5, 8), W(21, 25, 13), W(10, 1.2, 4)];

const linkOf = (r, s) => { let k = 0; r.links.forEach((l, i) => { if (s >= l) k = i; }); return r.names[k]; };
const strandHits = (c) => STRANDS.map((r) => { const h = ribbonHit(c, r.samples); return [linkOf(r, h.s), h.d]; });

// the skull's sockets: dark almonds turned 24 deg on the skull, closed by a skull-coloured lid
const eyeL = { side: 'L', at: [3.2, -5.2, 0], size: 2.3, yaw: 24, squash: 0.8, frame: HF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: SKULL, lid: [1.25, 1, 1.05] });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, -2, 9] },
  { name: 'head', parent: 'body', at: HF.world([0, 3, -4]) },
  { name: 'armL', parent: 'body', at: [4.6, -6.5, 13.5] },
  { name: 'handL', parent: 'armL', at: [5.8, -8.4, 9.8] },
  { name: 'armR', parent: 'body', at: [-5.2, -6.5, 15] },
  { name: 'handR', parent: 'armR', at: [-15.5, -7.5, 12.4] },
  ...STRANDS.flatMap((r) => r.names.map((name, k) => ({ name, parent: k === 0 ? r.parent : r.names[k - 1], at: r.P[r.links[k]] }))),
  ...face.joints,
];

function assign(c, rgb) {
  if (near(rgb, FROST, 0.03)) {
    // a speck rides the nearest strand link
    if (MOTES.some((p) => ellD(c, [1, 1, 1], p) < 1.3)) return closest(strandHits(c));
    return c[0] > 0 ? 'handL' : 'handR';   // the claws
  }
  if (isAny(rgb, HEADONLY, 0.025)) return 'head';
  const h = HF.local(c);
  return closest([
    ['head', Math.min(ellD(h, [8.6, 7.4, 8], [-0.4, 4.4, 2.8]), ellD(h, [8.1, 2.4, 8.3], [0, -2.8, 0.8]),
      capD(fold(h), [3.9, 2.2, 9.4], [5, 2, 15], 2.1, 0.25))],
    ['body', Math.min(
      ellD(c, [5.8, 5.4, 5.2], [-1.6, -7.5, 15.5]), ellD(c, [6.4, 6, 4.4], [0, -3.5, 10.5]), ellD(c, [4.2, 4.6, 2.6], [0.5, -1.5, 5.8]),
      ellD(c, [4.4, 3.6, 3.2], [-6.5, -6, 6.5]), ribbonHit(c, TIP).d)],
    ['armL', capD(c, [4.6, -6.5, 13.5], [5.8, -8.4, 9.8], 2.5, 1.9)],
    ['handL', ellD(c, [2.1, 1.8, 1.6], [5.8, -8.6, 8.8])],
    ['armR', capD(c, [-5.2, -6.5, 15], [-15.5, -7.5, 12.4], 2.6, 2)],
    ['handR', ellD(c, [2.7, 2.2, 2], [-16.8, -7.6, 11.8])],
    ...strandHits(c),
  ]);
}

// A at half the template's curl (seven links add up, or it stands up like an antenna), B and the band copying it;
// every other strand copies the tail (the widest drape band), softer the further from it
const COPY = { veil: 0.9, veilb: 0.8, veilc: 0.75, veild: 0.65, fray: 0.8, frayb: 0.7, back: 0.5, backb: 0.45, backc: 0.45, backd: 0.45 };
function follow(clips) {
  const A = strand.wisp.names;
  const T = strand.tail.names;
  const rOf = (p, n) => p[n]?.r ?? [0, 0, 0];
  for (const c of Object.values(clips)) {
    const pose = c.pose;
    c.pose = (t, u) => {
      const p = pose(t, u);
      const out = { ...p };
      A.forEach((n) => { out[n] = { r: mul(rOf(p, n), 0.5) }; });
      strand.wispB.names.forEach((n, i) => { out[n] = { r: mul(rOf(p, A[Math.min(i + 1, A.length - 1)]), 0.42) }; });
      strand.band.names.forEach((n, i) => { out[n] = { r: mul(rOf(p, A[2 * i]), 0.45) }; });
      for (const [name, k] of Object.entries(COPY)) {
        strand[name].names.forEach((n, i) => { out[n] = { r: mul(rOf(p, T[Math.min(i, T.length - 1)]), k) }; });
      }
      return out;
    };
  }
  return clips;
}

const base = floaterClips({
  face, tail: strand.tail.names, wisp: strand.wisp.names, bob: 0.7,
  add: {
    // the streamers stream out behind in the glide
    walk: () => Object.fromEntries(strand.wisp.names.map((n, i) => [n, { r: [0, 0, 4 + 1.5 * i] }])),
  },
});
delete base.idle_cackle;   // a skull with no jaw to cackle

const clips = follow({
  ...base,

  // fidget: a chill shudder, the claws flexing, the frost streamers lifting and rippling
  idle_shiver: {
    seconds: 2,
    pose: (t, u) => {
      const on = win(u, 0.1, 0.85, 0.08);
      const sh = osc(u, 14) * on;
      return merge({
        body: { p: [0, 0, 0.7 + 0.4 * on], r: [0, 1.5 * sh, 2 * sh] },
        head: { r: [-6 * on, 0, 3 * sh] },
        armL: { r: [0, -6 * on, -4 * on] },
        armR: { r: [0, 10 * on, 6 * on] },
        handL: { r: [-15 * on, 0, 0] },
        handR: { r: [-20 * on, 0, 0] },
        ...face.pose('open', 0.5 * on),
      },
      Object.fromEntries(strand.wisp.names.map((n, i) => [n, { r: [-10 * on * (1 + 0.3 * i) + 6 * sh, 0, 6 * osc(u, 4, -0.1 * i) * on] }])),
      Object.fromEntries(strand.tail.names.map((n, i) => [n, { r: [4 * sh, 0, 8 * osc(u, 4, -0.15 * i) * on] }])));
    },
  },

  // fidget: a slow beckon with the far, reaching claw, the hood tilting
  idle_beckon: {
    seconds: 2.6,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.18, 1], [0.78, 1], [0.92, 0]]);
      const curl = Math.max(0, osc(u, 3)) * win(u, 0.2, 0.75, 0.06);
      return merge({
        body: { p: [0, 0, 0.7], r: [4 * up, 0, -6 * up] },
        head: { r: [6 * up, 8 * up, -10 * up] },
        armR: { r: [0, 25 * up, 0] },
        handR: { r: [-40 * curl, 0, 0] },
        ...face.pose('open'),
      },
      Object.fromEntries(strand.wisp.names.map((n, i) => [n, { r: [4 * osc(u, 2, -0.1 * i), 0, 6 * osc(u, 1, -0.1 * i)] }])),
      Object.fromEntries(strand.tail.names.map((n, i) => [n, { r: [0, 0, 6 * osc(u, 1, -0.12 * i)] }])));
    },
  },
});

// layered strands overlap one another (cloth on cloth): blend every seam between two strands' links, so a band
// moving a little apart from its neighbour stretches instead of cracking open
const LINKS = STRANDS.flatMap((r) => r.names.map((n) => [r.name, n]));
const seams = { allow: LINKS.flatMap(([ra, a], i) => LINKS.slice(i + 1).filter(([rb]) => rb !== ra).map(([, b]) => [a, b])) };

export default rigDef({ joints, assign, extras: face.extras, clips, seams });
