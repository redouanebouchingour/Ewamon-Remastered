// Velvetomb's rig: a dark-violet shadow drifting over a ring of smoke. A small white mask in a horned hood (its long
// peak curling at the tip is the template's wisp chain), smoke streams flowing back to +X off the crown and shoulders
// (ribbons, scad ribbon(): a Catmull-Rom curve swept by thin flat ellipses), a sleeve reaching out to -X with a grey
// claw fist, a grey crescent claw on the near side, the glowing orb before its chest (the template's core), and the
// lower cloak, hem smoke and talons on a `hem` joint that drags a beat behind the body. The low dark stream C is the
// template's tail; the other streams copy the peak or the tail. Numbers are scad/velvetomb.scad's (the 2026-11-06
// sprite-match remodel).
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { floaterClips } from './lib/floater.mjs';
import { capD, closest, ellD, isAny, near, subFrame } from './lib/geo.mjs';

const INK = [0.08, 0.03, 0.14];
const MASK = [0.97, 0.95, 0.98];
const HEADONLY = [INK, [0.62, 0.48, 0.74], [0.80, 0.68, 0.92]];
const WHITE = [0.97, 0.95, 0.97];
const ORB = [[0.88, 0.82, 1.00], [1.00, 0.99, 1.00]];
const CLAW = [0.40, 0.36, 0.44];
const CLAW_LT = [0.68, 0.63, 0.64];
const TALON = [0.66, 0.58, 0.72];
const BACK_GLOW = [0.46, 0.32, 0.72];

// scad W(): a front-sheet point at depth y, the camera tilt taken out
const W = (s, z, y) => { const x = (s - 0.5 * y) / 0.866; return [x, y, z - 0.17 * (-0.5 * x + 0.866 * y)]; };
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, k) => a.map((v) => v * k);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => mul(v, 1 / Math.hypot(...v));
const sinD = (a) => Math.sin((a * Math.PI) / 180);
const cosD = (a) => Math.cos((a * Math.PI) / 180);

const H = W(-4.8, 30.5, -4);
const HY = 20;
const HF = subFrame(H, [0, 0, HY]);

// ---- ribbon() maths, as in the scad
const CAM = [0.5, -0.866, 0];
const CAMB = [0.5, 0.866, 0];
function cr(P, s) {
  const n = P.length;
  const i = Math.min(Math.floor(s), n - 2);
  const t = s - i;
  const [p0, p1, p2, p3] = [P[Math.max(i - 1, 0)], P[i], P[i + 1], P[Math.min(i + 2, n - 1)]];
  return [0, 1, 2].map((k) => 0.5 * (2 * p1[k] + (p2[k] - p0[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t
    + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t * t * t));
}
const lin = (V, s) => { const i = Math.min(Math.floor(s), V.length - 2); const t = s - i; return V[i] * (1 - t) + V[i + 1] * t; };
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
function ribbonHit(c, samples) {
  let best = { s: 0, d: Infinity };
  for (const e of samples) {
    const v = sub(c, e.p);
    const d = Math.hypot(dot(v, e.T) / 0.6, dot(v, e.wd) / e.w, dot(v, e.nn) / e.t);
    if (d < best.d) best = { s: e.s, d };
  }
  return best;
}

// ---- the streams (the scad's rows); `links` are the control points that start a joint
const STREAMS = [
  { name: 'wisp', parent: 'head', N: CAM, th: 0.9, links: [0, 1, 2, 3],
    P: [W(-5.2, 33.6, -1), W(-2.4, 36, 0.5), W(0.2, 38.4, 2), W(2.4, 39.7, 3), W(3.6, 39.2, 3.2), W(2.8, 38.5, 3.2)],
    Wv: [2.8, 2.2, 1.5, 1, 0.6, 0.15] },
  { name: 'crown', parent: 'head', N: CAM, th: 0.9, links: [0, 2, 4, 6],
    P: [W(-8.2, 34.2, -5), W(-5.6, 36.8, -4.4), W(-2, 37.8, -1.5), W(2, 36.8, 2), W(6, 37.4, 5), W(9.6, 37, 7), W(11.9, 38.6, 8), W(13.2, 37.6, 8.4), W(12.5, 36.9, 8.4)],
    Wv: [1.6, 2.4, 2.5, 2.2, 2, 1.6, 1.1, 0.6, 0.15] },
  { name: 'curlA', parent: 'head', N: CAM, th: 0.8, links: [0, 2, 3],
    P: [W(0.5, 34.2, 3), W(5, 34.2, 5), W(8.6, 33.6, 7), W(10.9, 34.6, 8), W(10.5, 36, 8), W(9.4, 35.3, 8)], Wv: [2.2, 2.2, 1.9, 1.3, 0.8, 0.15] },
  { name: 'curlB', parent: 'head', N: CAM, th: 0.9, links: [0, 2, 4],
    P: [W(-1, 31, 1.5), W(4.5, 32.2, 4), W(9.4, 29.8, 6.5), W(13, 31.4, 8.5), W(15.4, 32.6, 9.5), W(15.2, 33.6, 10), W(14.4, 32.9, 10)],
    Wv: [2.8, 2.6, 2.2, 1.8, 1.1, 0.6, 0.15] },
  { name: 'tail', parent: 'body', N: CAM, th: 0.9, links: [0, 2, 4],
    P: [W(1.5, 27.4, 1.5), W(7, 26.6, 4.5), W(11, 28.2, 7), W(14.6, 27.4, 9), W(16.8, 28, 10), W(17.7, 26.9, 10.5), W(16.9, 26.2, 10.5)],
    Wv: [3, 2.6, 2.2, 1.6, 1.1, 0.6, 0.15] },
  { name: 'curlC', parent: 'tail2', N: CAM, th: 0.7, links: [0],
    P: [W(10.6, 25, 6.5), W(13.2, 24.6, 8), W(14.6, 25.9, 8.5), W(13.7, 27, 8.5), W(12.9, 26.2, 8.5)], Wv: [1.8, 1.5, 1.1, 0.7, 0.15] },
  { name: 'curlD', parent: 'body', N: CAM, th: 0.8, links: [0, 2],
    P: [W(3.5, 23.4, 2.5), W(7.6, 24.2, 5), W(10.8, 23.8, 6.5), W(11.8, 22.4, 7), W(10.6, 21.8, 7)], Wv: [2.6, 2.2, 1.6, 0.8, 0.15] },
  { name: 'curlE', parent: 'body', N: CAMB, th: 0.8, links: [0, 2, 4],
    P: [[7, 4, 22], [11, 4.5, 19.5], [13.6, 4.5, 16], [13.8, 5, 12.4], [11.6, 6, 10], [12.6, 6.6, 8], [14.4, 5.6, 8.6]],
    Wv: [1.6, 1.8, 1.8, 1.6, 1.3, 0.8, 0.15] },
].map((r) => ({ ...r, samples: sweep(r.P, r.Wv, r.N, r.th), names: r.links.map((_, k) => `${r.name}${k + 1}`) }));
const stream = Object.fromEntries(STREAMS.map((r) => [r.name, r]));
const linkOf = (r, s) => { let k = 0; r.links.forEach((l, i) => { if (s >= l) k = i; }); return r.names[k]; };
const streamHits = (c) => STREAMS.map((r) => { const h = ribbonHit(c, r.samples); return [linkOf(r, h.s), h.d]; });

// ---- the cloak: core blob, twisted drapes, the far edge, the hem smoke
const BODY = [[[6, 5, 3.5], [-2.5, 0, 24.5]], [[7.6, 6.4, 4], [-1, 0.5, 16]], [[9, 7.4, 3], [0.8, 1.6, 9.5]]];
const rad = (a) => [sinD(a), -cosD(a), 0];
const DLO = [2.2, 5.6, 3, 6.6, 4.2, 1.6, 5, 2.6, 6.2, 3.8];
const LEAN = [2.6, 1.5, 0];
const DRAPES = Array.from({ length: 10 }, (_, k) => {
  const a = k * 36 + 10;
  const lo = DLO[k];
  const sw = k % 2 === 0 ? 12 : -10;
  const P = [add(mul(rad(a), 5.6), [0, 0, 22]), add(add(mul(rad(a + 9), 8.4), mul(LEAN, 0.3)), [0, 0, 15]),
    add(add(mul(rad(a + 20), 10.6), mul(LEAN, 0.6)), [0, 0, 9.5]), add(add(mul(rad(a + 28), 11.4), mul(LEAN, 0.85)), [0, 0, lo + 2.4]),
    add(add(mul(rad(a + 28 + sw), 12.6), LEAN), [0, 0, lo])];
  return sweep(P, [3, 4, 3.2, 1.7, 0.15], rad(a + 12), 1.3);
});
const EDGE = sweep([W(-8.4, 23, -2), W(-11.6, 18, -2), W(-14, 13.4, -1.5), W(-15, 9.6, -1)], [2.4, 2.8, 2.4, 0.6], CAM, 0.9);
// the three clouds (white hull + lumps) and the two mauve wisps on the right flank
const CLOUDS = [
  [W(10.6, 9, -2), [3.6, 3, 2.6]], [W(12.6, 13, 0.5), [2.8, 2.4, 2.2]], [W(8.4, 5.4, -3), [2.8, 2.4, 2]], [W(13.2, 6.2, 2.5), [2.8, 2.4, 2]],
  [W(9.6, 4.6, -1), [2.6, 2.2, 1.6]], [W(13, 4.8, 3), [2.4, 2, 1.6]], [W(11.6, 15.6, 1), [2.2, 1.9, 1.7]], [W(8, 11.8, -4.2), [2.2, 1.9, 1.8]],
  [W(13.9, 10.4, 1.5), [2.1, 1.8, 1.7]], [W(10.2, 7.8, -5.4), [2.3, 1.6, 1.9]], [W(14.8, 7.4, 4), [1.8, 1.6, 1.5]], [W(12, 11.6, -3.2), [1.7, 1.4, 1.5]],
  [W(-6, 6.6, -10.5), [2.6, 2.1, 2]], [W(-2.2, 8, -10.8), [2.2, 1.9, 1.7]], [W(-1, 5, -10.8), [2.4, 2, 1.8]],
  [W(-3, 3.8, -9.4), [2.2, 1.8, 1.3]], [W(-7.8, 8.4, -9.6), [1.8, 1.5, 1.4]], [W(-3.6, 9.8, -10.6), [1.6, 1.4, 1.3]],
  [W(-4.4, 5.6, -12.2), [1.8, 1.2, 1.4]], [W(0.6, 7.4, -11.6), [1.5, 1.3, 1.3]],
  [W(-15.6, 8.4, -3), [2.4, 2, 2]], [W(-14.4, 10.8, -2), [1.8, 1.6, 1.5]], [W(-16, 5.8, 0), [1.9, 1.7, 1.5]],
  [W(-13.4, 5.6, -5), [1.8, 1.6, 1.3]], [W(-16.6, 9.8, -2), [1.5, 1.3, 1.3]], [W(-14.6, 7.2, -5.4), [1.5, 1.2, 1.3]],
];
const puffD = (c, p, r) => ellD(c, [r, r * 0.85, r * 0.75], p);
const WISPS = [[W(12.6, 20.6, 3), 2.4], [W(14.2, 17.6, 4), 2.2]];
const COLLAR = [
  [W(-10, 29.6, -3), W(-8.9, 26.4, -6.6), W(-7.6, 22.8, -8.2), W(-7.6, 27.4, -7)],
  [W(-1.2, 29, -4.5), W(-3.6, 27, -7.2), W(-7.6, 22.8, -8.2), W(-3, 29.2, -5.8)],
];
const collarD = (c) => Math.min(...COLLAR.flatMap((q) => q.flatMap((a, i) => q.slice(i + 1).map((b) => capD(c, a, b, 0.8, 0.8)))));
const ORBP = W(-7.6, 19, -9.6);
const HEM_Z = 11.5;   // the lower cloak below this rides the hem joint

// the mask's eyes: dark almonds under a mask-coloured lid
const eyeL = { side: 'L', at: [1.22, -4.0, 0.1], size: 0.7, yaw: 14, frame: HF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: MASK });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0.5, 10] },
  { name: 'hem', parent: 'body', at: [0, 0.8, 12] },
  { name: 'head', parent: 'body', at: HF.world([0, 0.8, -2.6]) },
  { name: 'armL', parent: 'body', at: [5.4, -3.4, 21.4] },
  { name: 'handL', parent: 'armL', at: [8.6, -5.6, 17.8] },
  { name: 'armR', parent: 'body', at: [-6, 0, 25] },
  { name: 'handR', parent: 'armR', at: [-14.4, -2.8, 21.8] },
  { name: 'core', parent: 'body', at: ORBP },
  ...STREAMS.flatMap((r) => r.names.map((name, k) => ({ name, parent: k === 0 ? r.parent : r.names[k - 1], at: r.P[r.links[k]] }))),
  ...face.joints,
];

function assign(c, rgb) {
  if (isAny(rgb, HEADONLY, 0.025)) return 'head';
  if (isAny(rgb, ORB, 0.03)) return 'core';
  if (near(rgb, BACK_GLOW, 0.03)) return 'body';
  if (near(rgb, CLAW, 0.025)) return 'handR';
  if (near(rgb, CLAW_LT, 0.03)) return 'handL';
  if (near(rgb, TALON, 0.02) && c[2] < 3 && c[1] < -2) return 'hem';   // the talons
  if (c[2] < 6 && Math.min(capD(c, [5.4, -4.6, 5.6], [5.4, -5.2, 1.6], 1, 0.85), capD(c, [-10, -3.4, 5.6], [-10, -4, 1.6], 1, 0.85)) < 1.3) return 'hem';   // the shanks
  const h = HF.local(c);
  const low = c[2] < HEM_Z;
  const drape = Math.min(...DRAPES.map((d) => ribbonHit(c, d).d));
  const edge = ribbonHit(c, EDGE);
  // a cloud's hull swells past its spheres, so its distance is scaled down to win against the cloak it sits on
  const hem = Math.min(...CLOUDS.map(([p, r]) => ellD(c, r, p) * 0.8));
  return closest([
    ['head', Math.min(ellD(h, [3.3, 3.6, 4.1], [0, 1, 1.2]), ellD(h, [3.8, 1.2, 4.2], [0, -2.5, 0.5]),
      capD(h, [-2.2, -0.9, 3.8], [-3.2, -0.9, 7.4], 1.2, 0.15), ellD(h, [2.6, 1.4, 2.6], [0, -3.3, -0.2]))],
    ['body', Math.min(...BODY.map(([r, p]) => ellD(c, r, p)), collarD(c), capD(c, W(-8.6, 28, -3), add(W(-8.6, 28, -3), [-1.6, 0.6, 4.4]), 1.4, 0.15),
      ...WISPS.map(([p, r]) => puffD(c, p, r)),
      low ? Infinity : drape, edge.s < 2 ? edge.d : Infinity)],
    ['hem', Math.min(hem, low ? drape : Infinity, edge.s >= 2 ? edge.d : Infinity)],
    ['armR', capD(c, [-6, 0, 25], [-13.4, -2.4, 21.8], 2.0, 2.6)],
    ['handR', Math.min(ellD(c, [1.6, 2.9, 3], [-14.4, -2.8, 21.6]), ellD(c, [1.2, 1.8, 1.6], [-14.2, -3.6, 19.6]))],
    ['armL', capD(c, [5.4, -3.4, 21.4], [8.4, -5.4, 18.2], 2.1, 1.8)],
    ['handL', ellD(c, [1.7, 1.5, 1.5], [9.3, -6.6, 16.8])],
    ...streamHits(c),
  ]);
}

// the crown and the streams off the head copy the peak (wisp) a little softer; curl D and the back tendril copy the
// tail; the hem drags behind the body's sway
const COPY_W = { crown: 0.7, curlA: 0.6, curlB: 0.6 };
const COPY_T = { curlC: 0.8, curlD: 0.7, curlE: 0.6 };
function follow(clips) {
  const A = stream.wisp.names;
  const T = stream.tail.names;
  const rOf = (p, n) => p[n]?.r ?? [0, 0, 0];
  for (const c of Object.values(clips)) {
    const pose = c.pose;
    c.pose = (t, u) => {
      const p = pose(t, u);
      const out = { ...p };
      for (const [name, k] of Object.entries(COPY_W)) {
        stream[name].names.forEach((n, i) => { out[n] = { r: mul(rOf(p, A[Math.min(i + 1, A.length - 1)]), k) }; });
      }
      for (const [name, k] of Object.entries(COPY_T)) {
        stream[name].names.forEach((n, i) => { out[n] = { r: mul(rOf(p, T[Math.min(i, T.length - 1)]), k) }; });
      }
      const b = rOf(p, 'body');
      const drag = (v, k) => Math.max(-10, Math.min(10, -k * v));   // a beat of drag, never a twist
      out.hem = { r: add(p.hem?.r ?? [0, 0, 0], [drag(b[0], 0.45), drag(b[1], 0.45), drag(b[2], 0.35)]) };
      return out;
    };
  }
  return clips;
}

const base = floaterClips({
  face, tail: stream.tail.names, wisp: stream.wisp.names, bob: 0.6,
  add: {
    walk: () => Object.fromEntries(stream.wisp.names.map((n, i) => [n, { r: [0, 0, 5 + 2 * i] }])),
  },
});
delete base.idle_cackle;   // a mask: no grin to cackle with

const clips = follow({
  ...base,

  // fidget: bows the mask over the orb and gazes into it, the reaching claw sweeping in over it, the orb swelling
  idle_scry: {
    seconds: 2.8,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.2, 1], [0.78, 1], [0.92, 0]]);
      const glow = (Math.sin(2 * Math.PI * 3 * u) * 0.5 + 0.5) * up;
      return merge({
        body: { p: [0, 0, 0.6], r: [4 * up, 0, -8 * up] },
        head: { r: [16 * up, 0, -8 * up] },
        armR: { r: [-20 * up, 10 * up, 35 * up] },
        handR: { r: [0, -25 * up, 0] },
        core: { p: [0, 0, 1.2 * up], s: 1 + 0.25 * glow },
        ...face.pose('open', 0.35 * up),
      }, Object.fromEntries(stream.wisp.names.map((n, i) => [n, { r: [-6 * up + 3 * osc(u, 2, -0.1 * i), 0, 5 * osc(u, 1, -0.1 * i)] }])));
    },
  },

  // fidget: a slow bow with a sweep of the reaching sleeve, the smoke curling forward
  idle_bow: {
    seconds: 2.4,
    pose: (t, u) => {
      const b = K(u, [[0, 0], [0.3, 1], [0.6, 1], [0.85, 0]]);
      return merge({
        body: { p: [0, 0, 0.6], r: [10 * b, 0, 0] },
        head: { r: [14 * b, 0, 0] },
        armR: { r: [-30 * b, 10 * b, 30 * b] },
        ...face.pose('open', win(u, 0.3, 0.6, 0.05) * 0.6),
      }, Object.fromEntries(stream.wisp.names.map((n, i) => [n, { r: [8 * b * (1 + 0.2 * i), 0, 3 * osc(u, 1, -0.1 * i)] }])));
    },
  },
});

// layered streams overlap one another and the hood: blend every seam between two streams' links
const LINKS = STREAMS.flatMap((r) => r.names.map((n) => [r.name, n]));
const seams = { allow: LINKS.flatMap(([ra, a], i) => LINKS.slice(i + 1).filter(([rb]) => rb !== ra).map(([, b]) => [a, b])) };

export default rigDef({ joints, assign, extras: face.extras, clips, seams });
