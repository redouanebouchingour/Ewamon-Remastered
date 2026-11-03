// Briarvaunt's rig: a great forest lion-stag on four thick legs, a big leaf-plated mane and a bark breastplate (on
// the body), a lion head turned a little to its left with wide antlers hung with glowing orbs (part of the head), leafy
// ears, a long plume of leaf plates curling up behind and spirit motes drifting round it (their own joint). The
// glowing teal eyes are lib.scad eye()s inside the scaled face block, so eyeKit gives them lids. Numbers are
// scad/briarvaunt.scad's.
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { capD, closest, ellD, isAny, petalD, subFrame } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const unit = (d) => mul3(d, 1 / Math.hypot(...d));
const foldX = (c) => [Math.abs(c[0]), c[1], c[2]];
const minOf = (...ds) => Math.min(...ds);
// the scad's lobe(p, d, l, w, th): an ellipsoid from p along d
const lobeD = (c, p, d, l, w) => capD(c, add3(p, mul3(unit(d), Math.min(w, l * 0.5))), add3(p, mul3(unit(d), l - Math.min(w, l * 0.5) * 0.6)), w, w * 0.6);
const hullElD = (c, parts) => minOf(...parts.map(([r, p]) => ellD(c, r, p)));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const D2R = Math.PI / 180;
// the scad's shingle(p, n, f, l, w, th, c, lift): a plate rooted at p running along f (on the surface), its tip lifted
const shingleSeg = (p, n, f, l, w, lift) => {
  const nn = unit(n);
  const ff = unit(sub3(f, mul3(nn, dot(f, nn))));
  const dir = add3(mul3(ff, Math.cos(lift * D2R)), mul3(nn, Math.sin(lift * D2R)));
  return [add3(p, mul3(dir, Math.min(w, l * 0.3))), add3(p, mul3(dir, l * 0.95 - Math.min(w, l * 0.3) * 0.5)), w];
};
const segD = (c, [a, b, w]) => capD(c, a, b, w, w * 0.8);

// ---- the head block: translate(HC) rotate([0, 0, HY]), the face inside it scale(HS)
const HC = [1.4, -12.5, 26.3];
const HY = 20;
const HS = 1.15;
const hf = subFrame(HC, [0, 0, HY]);
const hfs = subFrame(HC, [0, 0, HY], HS);
const EYE = [2.0, -4.1, -0.1];
const eyeL = { side: 'L', at: EYE, size: 0.9, yaw: 14, frame: hfs };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.47, 0.67, 0.51] });

// ---- the scad's arrays
const LEGS = {
  legFL: [[4.3, -10, 14], [4.5, -11, 6], [4.5, -11.4, 1.9]],
  legFR: [[-4.3, -10, 14], [-5.5, -14.8, 6], [-5.8, -16.6, 1.9]],
  legBL: [[4.6, 9, 14], [5, 12.5, 6.5], [5, 10.6, 1.9]],
  legBR: [[-4.6, 9, 14], [-5, 12.5, 6.5], [-5, 10.6, 1.9]],
};
const TAIL = [[1.7, 14, 16.5], [5.2, 16, 12.8], [8.6, 17.5, 12.2], [10.2, 18, 15.4], [10.3, 18, 19.4], [9.3, 18, 23.4], [7.3, 17.5, 25.2],
  [4.8, 17, 24.4], [4.2, 16.5, 21.2], [6.0, 16.5, 19.6]];
const TAIL_R = [1.8, 2.2, 2.6, 2.9, 3.0, 2.8, 2.4, 1.9, 1.4, 1.0];
const TC = [7.2, 17.2, 18.8];
const tail = ['tail1', 'tail2', 'tail3'];
const tailLink = (i) => (i < 2 ? 'tail1' : i < 5 ? 'tail2' : 'tail3');

// the drifting motes: [centre, colour] (orbs, wisps, the leaves' middles)
const MOTES = [[10.4, -2, 29.5], [6.9, -2, 34.3], [-13.3, -14, 22], [-14.2, -12, 14], [-10, -15, 12.5], [16.2, 4, 9.5],
  [-12.4, -10, 10.1], [15.4, 2, 8.9], [17.1, -4, 2.5]];
const MOTE_C = [[0.5, 0.75, 1], [0.75, 0.66, 0.95], [0.66, 0.88, 0.95], [0.42, 0.66, 0.33], [0.62, 0.45, 0.25]];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...Object.entries(LEGS).map(([name, [hip]]) => ({ name, parent: 'root', at: hip })),
  { name: 'body', parent: 'root', at: [0, -1, 15] },
  { name: 'head', parent: 'body', at: [0.6, -10.5, 23.5] },
  { name: 'earL', parent: 'head', at: hfs.world([4.2, 0.4, 2.4]) },
  { name: 'earR', parent: 'head', at: hfs.world([-4.2, 0.4, 2.4]) },
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[2] },
  { name: 'tail3', parent: 'tail2', at: TAIL[5] },
  { name: 'motes', parent: 'root', at: [0, 0, 0] },
  ...face.joints,
];

// ---- part tests (normalised distances; the nearest primitive wins)
const ANTLER = [
  [[2.6, 0.6, 4.1], [5.0, 1.0, 5.2], [8.0, 1.4, 6.8], [10.8, 1.4, 8.6], [12.6, 1.2, 11.2]],
  [[5.0, 1.0, 5.2], [5.4, 0.6, 8.8], [6.0, 0.2, 11.6]],
  [[8.0, 1.4, 6.8], [8.6, 1.2, 10.0], [9.0, 0.8, 12.4]],
  [[10.8, 1.4, 8.6], [12.8, 1.6, 7.8], [14.0, 1.6, 8.6]],
  [[5.0, 1.0, 5.2], [3.8, 0.8, 8.0], [3.6, 0.6, 9.8]],
];
const ORBS = [[6.2, 0, 12.5], [12.9, 1.0, 12.1], [4.4, 0.2, 4.0], [14.5, 1.6, 9.4], [10.4, 0.4, 7.4], [9.2, 0.6, 13.2], [7.4, 0.6, 5.6], [3.5, 0.4, 10.6]];
const antlerD = (p) => minOf(
  ...ANTLER.flatMap((b) => b.slice(1).map((q, i) => capD(p, b[i], q, 1.6, 1.2))),
  ...ORBS.map((o) => ellD(p, [1.6, 1.6, 1.6], o)),
);
const headD = (c) => {
  const s = hfs.local(c);
  const sf = foldX(s);
  return minOf(
    ellD(s, [4.9, 4.3, 4.3]), ellD(sf, [1.9, 1.1, 0.8], [1.9, -3.75, 0.95]), capD(s, [0, -3.6, 0.6], [0, -6.2, -1.3], 1.0, 0.85),
    ellD(s, [2.2, 2.4, 1.7], [0, -4.6, -2.4]), ellD(s, [1.5, 1.7, 0.9], [0, -4.8, -3.9]), ellD(s, [1.1, 0.9, 0.9], [0, -6.95, -1.5]),
    capD(s, [0, -1, 3.8], [0, -0.8, 5.8], 1.2, 0.9), capD(s, [0.2, -0.8, 5.8], [-1.8, -0.4, 7.3], 0.9, 0.5),
    lobeD(sf, [4.0, -1.8, -1.0], [1, 0.1, -0.4], 3.0, 2.0), lobeD(sf, [3.4, -2.4, -2.8], [0.7, 0, -1], 2.8, 1.8),
    lobeD(sf, [4.4, -0.4, 1.0], [1, 0.3, 0.2], 2.8, 1.8),
    antlerD(foldX(hf.local(c))),
  );
};
const earD = (sgn) => (c) => {
  const s = hfs.local(c);
  if (Math.sign(s[0]) !== sgn) return Infinity;
  return lobeD(foldX(s), [4.2, 0.4, 2.4], [1, 0.45, 0.5], 2.6, 1.3);
};

const TORSO = [[[6.6, 6.3, 6.6], [0, -11, 15.5]], [[6.9, 7.3, 6.5], [0, -1, 15.2]], [[6.5, 6.8, 6.3], [0, 9.5, 14.8]]];
const MOSS = [[[5.6, 6.3, 6.8], [0, -11, 15.8]], [[6.0, 7.3, 6.8], [0, -1, 15.5]], [[5.6, 6.8, 6.6], [0, 9.5, 15.0]]];
// the mane: its core (hull of MANE_E) and the leaf plates of MANE_ROWS, placed as the scad does
const MANE_E = [[[9.0, 7.0, 7.0], [0, -8, 23.2]], [[8.8, 6.2, 5.4], [0, -4.5, 18.6]]];
const MANE_ROWS = [[0, 72], [0, 48], [0, 24], [0, 0], [0, -24], [1, 0], [1, -26]];
const MANE = [];
MANE_ROWS.forEach(([ei, e], ri) => {
  const [R, C] = MANE_E[ei];
  for (let j = 0; j < 12; j++) {
    const a = (j * 30 + (ri % 2) * 15) * D2R;
    const ce = Math.cos(e * D2R);
    const p = add3(C, [R[0] * ce * Math.sin(a), -R[1] * ce * Math.cos(a), R[2] * Math.sin(e * D2R)]);
    const n = [ce * Math.sin(a) / R[0], -ce * Math.cos(a) / R[1], Math.sin(e * D2R) / R[2]];
    if (Math.hypot(...sub3(p, HC)) > 6.2 && !(ei === 1 && Math.cos(a) > 0.6)) {
      MANE.push(shingleSeg(sub3(p, mul3(unit(n), 0.3)), n, [0, 0.35, -1], 4.6, 2.4, 14));
    }
  }
});
const bodyD = (c) => minOf(
  hullElD(c, TORSO), hullElD(c, MOSS), hullElD(c, MANE_E),
  ...MANE.map((m) => segD(c, m)),
  ellD(c, [5, 3.2, 3.6], [0.8, -13.6, 20.2]),
  ...[-3, 0, 3].map((x) => lobeD(c, [x + 0.8, -15.6, 19.5], [x * 0.15, -0.6, -1], 2.4, 1.5)),
  ellD(c, [7.4, 7.1, 7.4], [0, -11, 15.5]),
);
const legD = ([h, k, f]) => (c) => minOf(
  capD(c, h, k, 3.9, 3.1), capD(c, k, f, 3.1, 2.9), ellD(c, [3.3, 3.9, 1.9], [f[0], f[1] - 0.7, f[2]]),
  ellD(c, [4.4, 1.6, 1.2], [f[0], f[1] - 3.9, 0.7]),
);
// the plume: a slim core and five leaf plates per point fanning in the tail's plane (normal TN)
const TN = [-0.375, 0.927, 0];
const PLUME = [];
for (let i = 0; i <= 8; i++) {
  const p = TAIL[i];
  const tg = unit(sub3(TAIL[i + 1], TAIL[Math.max(i - 1, 0)]));
  const pc = sub3(p, TC);
  const o0 = sub3(pc, mul3(tg, dot(pc, tg)));
  const o = unit(sub3(o0, mul3(TN, dot(o0, TN))));
  [-55, -22, 10, 40, 70].forEach((phi, j) => {
    const f = add3(mul3(tg, Math.cos(phi * D2R)), mul3(o, Math.sin(phi * D2R)));
    PLUME.push([tailLink(i), shingleSeg(add3(p, mul3(TN, j % 2 === 0 ? -0.45 : 0.45)), TN, f, 3.4 + TAIL_R[i] * 0.9, 0.9 + TAIL_R[i] * 0.35, 6)]);
  });
}
const tailD = (n) => (c) => {
  let best = Infinity;
  for (let i = 0; i < TAIL.length - 1; i++) {
    if (tailLink(i) === n) best = Math.min(best, capD(c, TAIL[i], TAIL[i + 1], TAIL_R[i] * 0.6, TAIL_R[i + 1] * 0.6));
  }
  for (const [name, seg] of PLUME) if (name === n) best = Math.min(best, segD(c, seg));
  if (n === 'tail1') best = Math.min(best, lobeD(c, add3(TAIL[2], [0, -1, -1.8]), [0.4, -0.5, -1], 1.6, 0.7));
  if (n === 'tail3') best = Math.min(best, lobeD(c, add3(TAIL[5], [0, -1, 2]), [-0.3, -0.5, 1], 1.6, 0.7));
  return best;
};

const PARTS = [
  ['head', headD], ['earL', earD(1)], ['earR', earD(-1)], ['body', bodyD],
  ...Object.entries(LEGS).map(([n, l]) => [n, legD(l)]),
  ...tail.map((n) => [n, tailD(n)]),
];

function assign(c, rgb) {
  if (isAny(rgb, MOTE_C, 0.03) && MOTES.some((m) => ellD(c, [2.2, 2.2, 2.2], m) < 1)) return 'motes';
  return closest(PARTS.map(([n, t]) => [n, t(c)]));
}

const drift = (u, cycles = 1, amp = 1) => ({ motes: { p: [0, 0, 1.2 * amp * osc(u, cycles)], r: [0, 0, 5 * amp * osc(u, cycles, 0.25)] } });

const base = quadrupedClips({
  face, tail, hipH: 14, stride: 12,
  add: {
    idle: (t, u) => drift(u, 1),
    walk: (t, u) => drift(u, 2, 0.6),
    idle_sniff: (t, u) => drift(u, 1),
    idle_shake: (t, u) => drift(u, 3, 2),
    hurt: (t, u) => drift(u, 3, 2),
    faint: (t, u) => ({ motes: { p: [0, 0, -3 * K(u, [[0.2, 0], [0.9, 1]])] } }),
    celebrate: (t, u) => drift(u, 2, 2),
  },
});

const clips = {
  ...base,
  // fidget: lowers the antlers and shakes them so the glowing orbs sway, the motes swirling up round the head
  idle_antlers: {
    seconds: 2.6,
    pose: (t, u) => {
      const low = K(u, [[0, 0], [0.18, 1], [0.72, 1], [0.9, 0]]);
      const sh = Math.sin(TAU * 4 * u) * win(u, 0.22, 0.7, 0.05);
      return merge({
        body: { r: [3 * low, 0, 0] },
        head: { r: [16 * low, 4 * sh, 8 * sh] },
        motes: { r: [0, 0, 40 * low], p: [0, 0, 3 * low] },
        ...face.pose(low > 0.5 && Math.abs(sh) > 0.4 ? 'squeeze' : 'open'),
      }, Object.fromEntries(tail.map((n, i) => [n, { r: [4 * low, 0, 5 * sh * (1 + 0.3 * i)] }])));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
