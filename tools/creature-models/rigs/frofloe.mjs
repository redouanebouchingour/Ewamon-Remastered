// Frofloe's rig: an ice wolf stalking low, legs splayed wide, its big head turned to stare at the viewer (hd(): the
// scad's headAt() frame, turned 30 degrees and scaled 1.1; the lower jaw and the ears are joints), a dense collar of
// flat ice shards round the face (mane1, off the body, so the head turns inside it), more shards over the shoulders
// (body) and a bushy plume of a tail curling up and over (three links). Numbers are scad/frofloe.scad's.
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, blob, ell, fromSheet, limb } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { capD, chainHit, closest, isAny, near, subFrame } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const D = Math.PI / 180;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = (a) => mul(a, 1 / Math.hypot(...a));

// the head block: translate(HC) rotate([0, 0, 30]) scale(1.1)
const HC = [0, -14, 20.5];
const HF = subFrame(HC, [0, 0, 30], 1.1);
const hd = HF.world;
const TAIL_C = [0.51, 0.72, 0.86];
const ICES = [[0.88, 0.97, 0.99], [0.66, 0.84, 0.92], [0.47, 0.69, 0.82], [0.33, 0.53, 0.68]];

const eyeL = { side: 'L', at: [2.5, -3.3, -0.8], size: 1.45, yaw: 14, flat: 0.5, frame: HF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.9, 0.97, 0.99] });

// ---- every shard of the scad as [joint, base, tip, half-width] (world)
const shards = [];
const shard = (j, p, d, r) => shards.push([j, p, add(p, d), r]);
// mane round the face (in the head frame)
const MC = [0, 2.6, 0.8];
const maneShard = (a, l, back, ring) => {
  const c = Math.cos(a * D); const s = Math.sin(a * D);
  const p = add(MC, [c * (5.6 - ring), ring * 1.4, s * (5.8 - ring)]);
  shard('mane1', hd(p), sub(hd(add(p, mul([c, back, s * 1.02], l * 1.05))), hd(p)), 3.3);
};
for (const [a, l] of [[-20, 8.5], [0, 9.5], [20, 10.5], [40, 11.5], [58, 12.5], [74, 12.5], [90, 13], [106, 13], [122, 12],
  [140, 9.5], [158, 6.5], [178, 5.5], [198, 5], [218, 4.5], [-40, 7]]) maneShard(a, l, 0.45, 0);
for (const [a, l] of [[-30, 6], [10, 7], [30, 8], [49, 9], [66, 9.5], [82, 10], [98, 9], [114, 10], [131, 8.5], [149, 6.5],
  [168, 4.6], [188, 4.2], [208, 3.8]]) maneShard(a, l, 0.25, 1.2);
for (const x of [-3.4, -1.2, 1.2, 3.4]) {
  const p = [x, -1.6, -6.4];
  shard('mane1', hd(p), sub(hd(add(p, [x * 0.35, -1.2, -4.6])), hd(p)), 1.8 * 1.1);
}
// cheek ruffs (head)
for (const k of [1, -1]) {
  for (const [p, d] of [[[4.4, -1.4, -1.2], [2.8, 0.6, 0.2]], [[4.6, -1.2, -2.9], [2.6, 0.6, -1.2]], [[3.8, -1.6, -4.6], [1.9, 0.4, -2.1]]]) {
    const q = [p[0] * k, p[1], p[2]];
    shard('head', hd(q), sub(hd(add(q, [d[0] * k, d[1], d[2]])), hd(q)), 1.2);
  }
}
// shoulder mane (body)
const SC = [0, -5.5, 23.5];
const SR = [6.2, 5.5, 5];
for (const [lat, lon, l] of [[20, 20, 8], [20, 55, 9], [20, 90, 9.5], [20, 125, 9], [20, 160, 8], [45, 40, 9], [45, 75, 10],
  [45, 105, 10], [45, 140, 9], [70, 90, 9], [0, 60, 7.5], [0, 120, 7.5], [-15, 45, 6.5], [-15, 135, 6.5]]) {
  for (const k of [1, -1]) {
    const n = [Math.cos(lat * D) * Math.cos(lon * D) * k, Math.cos(lat * D) * Math.sin(lon * D), Math.sin(lat * D)];
    const d = nrm(add(mul(n, 0.8), [0, 0.45, 0.55]));
    shard('body', add(SC, mul([SR[0] * n[0], SR[1] * n[1], SR[2] * n[2]], 0.85)), mul(d, l), 2.7);
  }
}
// legs: [joint, shoulder / hip, elbow / stifle, wrist / hock, paw]
const FORE = [['legFL', [5, -7, 18], [9.2, -4, 10], [11, -3.6, 3], [11.5, -4.4, 0]],
  ['legFR', [-5, -7, 18], [-10, -10, 10], [-12.8, -13.3, 3.2], [-13.3, -14.8, 0]]];
const HIND = [['legBL', [5, 18, 20], [6.5, 16, 12.5], [7, 25, 6.5], [7.4, 24.2, 0]],
  ['legBR', [-5, 18, 20], [-7, 13, 12.5], [-9, 19.5, 6.5], [-9.5, 17.5, 0]]];
for (const [j, sh, el] of FORE) shard(j, add(el, [0, 1.2, 0.4]), add([0, 2.4, 1.6], mul(sub(el, sh), 0.15)), 0.9);
for (const [j, , , hk] of HIND) shard(j, add(hk, [0, 0.8, 0.4]), [0, 2.6, 1.4], 0.8);

// ---- the tail: points read off the sheet, stood in a plane turned 40 degrees from +Y towards +X
const TA = 40 * D;
const TR = [1.5, 22.5];
const TU = [Math.sin(TA), Math.cos(TA), 0];
const TK = 0.866 * Math.sin(TA) + 0.5 * Math.cos(TA);
const TS0 = 0.866 * TR[0] + 0.5 * TR[1];
const tp = (sx, z) => add(add([TR[0], TR[1], 0], mul(TU, (sx - TS0) / TK)), [0, 0, z - 3.8]);
const TP = [[13, 25], [17, 26.8], [18.6, 30], [18, 33.8], [15, 36.8], [11, 37.8], [7.5, 37.6], [5, 36.8]].map(([x, z]) => tp(x, z));
const TW = [2.6, 3, 3.4, 3.6, 3.6, 3.3, 2.6, 1.6];
const TN = [Math.cos(TA), -Math.sin(TA), 0];
const tail = ['tail1', 'tail2', 'tail3'];
const tailOf = (i) => tail[i < 2 ? 0 : i < 4 ? 1 : 2];
const TCEN = tp(12.5, 31.5);
for (let i = 1; i < TP.length; i++) {
  const p = TP[i];
  const t = nrm(sub(TP[Math.min(i + 1, TP.length - 1)], TP[Math.max(i - 1, 0)]));
  const o0 = sub(p, TCEN);
  const o = nrm(sub(o0, mul(TN, dot(o0, TN))));
  for (const k of [0, 1]) {
    const d = nrm(add(mul(o, k === 0 ? 0.6 : 0.35), mul(t, k === 0 ? 0.8 : 0.95)));
    shard(tailOf(i), add(add(p, mul(o, TW[i] * 0.45)), mul(TN, k === 0 ? -0.6 : 0.6)), mul(d, 3.4 + TW[i] * 0.7 - k * 0.5), 1.3 + TW[i] * 0.28);
  }
}
for (let k = 0; k < 3; k++) shard('tail3', tp(6.5, 37.2 - k * 0.3), mul(nrm(add(mul(TU, -1), [0, 0, -0.25 - k * 0.35])), 3.6 - k * 0.5), 1.0);
for (let k = 0; k < 3; k++) shard('tail1', tp(16, 26), mul(nrm(add(mul(TU, 1 - k * 0.2), [0, 0, -0.1 - k * 0.45])), 4.2), 1.4);
// floating crystals (root)
for (const [x, z, y] of [[-13, 35.5, -12], [-16.5, 13.5, -12], [10, 34.5, 2], [10.5, 11.5, -8]]) shard('root', fromSheet(x, z, y), [0.2, 0, 1.6], 0.6);

const shardHit = (c) => closest(shards.map(([j, a, b, r]) => [j, capD(c, a, b, r * 1.2, r * 0.3)]));

// ---- the fur, skin and face parts
const inHead = (test) => (c) => test(HF.local(c));
const legTest = ([, sh, el, wr, pw], fore) => fore
  ? any(ell([3.4, 3.9, 4.4], sh), limb(add(sh, [0, 0, -1]), el, 3.3, 2.6), limb(el, wr, 2.6, 2), ell([3.6, 4, 2.6], add(pw, [0, -0.6, 1.4])))
  : any(limb(sh, el, 3.8, 2.8), limb(el, wr, 2.7, 1.9), limb(wr, add(pw, [0, 0, 1.4]), 1.9, 1.8), ell([3.3, 3.6, 2.4], add(pw, [0, -0.5, 1.3])));
const ear = (k) => inHead(any(limb([3.3 * k, 0.6, 4.4], [5.5 * k, 0.3, 8.6], 2, 0.4)));
const parts = [
  ...FORE.map((l) => [l[0], legTest(l, true)]),
  ...HIND.map((l) => [l[0], legTest(l, false)]),
  ['body', any(blob([[[4.8, 4, 5.2], [0, -11, 21]], [[6.6, 6.5, 7.5], [0, -6.5, 19.5]]]), blob([[[5.4, 6, 4.8], [0, 6, 23.4]], [[6, 6, 6.2], [0, 18, 22]]]),
    ell([5.4, 6, 4.8], [0, 6, 23.4]), ell([3.6, 6, 6], [4.6, 18, 20.2]), ell([3.6, 6, 6], [-4.6, 18, 20.2]))],
  ['head', inHead(any(ell([5, 4.6, 5], [0, 0.5, 1.5]), ell([5.6, 3.8, 3.6], [0, -0.8, -2.4]),
    blob([[[2.9, 2.6, 2.3], [0, -3.2, -3.4]], [[1.9, 1.7, 1.5], [0, -6.3, -4.3]]]), ell([1.25, 0.8, 0.85], [0, -7.75, -4.1]),
    limb([0.7, -4.1, 0.75], [3.9, -2.9, 1.9], 0.8), limb([-0.7, -4.1, 0.75], [-3.9, -2.9, 1.9], 0.8),
    ell([1.9, 0.7, 1.2], [2.6, -2.95, -0.8]), ell([1.9, 0.7, 1.2], [-2.6, -2.95, -0.8])))],
  ['jaw', inHead(any(blob([[[2.6, 2.3, 1.3], [0, -3, -6.7]], [[1.5, 1.3, 0.9], [0, -5.6, -7.1]]]),
    ell([2.6, 1.6, 0.6], [0, -4.6, -5.95])))],
  ['earL', ear(1)],
  ['earR', ear(-1)],
];

function assign(c, rgb) {
  if (isAny(rgb, ICES, 0.02)) return shardHit(c);
  if (near(rgb, TAIL_C, 0.02)) return tailOf(chainHit(c, TP, TW).i);
  // the cheek ruffs' white halves and the blaze are head; the teeth and fangs are on the upper jaw (head)
  return closest(parts.map(([n, f]) => [n, f(c)]));
}

const J = (open) => ({ jaw: { r: [open, 0, 0] } });
const base = quadrupedClips({
  face, tail, mane: ['mane1'], hipH: 19, stride: 11,
  add: {
    idle: (t, u) => J(2 * (osc(u, 2) * 0.5 + 0.5)),
    windup: (t, u) => J(10 * smooth(u / 0.8)),
    lunge: (t, u) => J(20 * K(u, [[0, 0.5], [0.3, 1], [0.42, 0], [1, 0]])),
    hurt: (t, u) => J(12 * K(u, [[0, 0], [0.18, 1], [1, 0.4]])),
    faint: (t, u) => J(10 * smooth((u - 0.2) / 0.55)),
    celebrate: (t, u) => J(10),
  },
});

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...FORE.map(([name, at]) => ({ name, parent: 'root', at })),
  ...HIND.map(([name, at]) => ({ name, parent: 'root', at })),
  { name: 'body', parent: 'root', at: [0, 0, 20] },
  { name: 'mane1', parent: 'body', at: hd(MC) },
  { name: 'head', parent: 'body', at: hd([0, 2, -1]) },
  { name: 'jaw', parent: 'head', at: hd([0, -1.8, -6]) },
  { name: 'earL', parent: 'head', at: hd([3.3, 0.6, 4.4]) },
  { name: 'earR', parent: 'head', at: hd([-3.3, 0.6, 4.4]) },
  { name: 'tail1', parent: 'body', at: TP[0] },
  { name: 'tail2', parent: 'tail1', at: TP[2] },
  { name: 'tail3', parent: 'tail2', at: TP[4] },
  ...face.joints,
];

const clips = {
  ...base,
  // fidget: a low growl: head down, jaw working, the mane bristling up in shivers
  idle_growl: {
    seconds: 2.2,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.15, 1], [0.75, 1], [0.9, 0]]);
      const tr = Math.sin(TAU * 18 * u) * win(u, 0.18, 0.72, 0.04);
      return merge({
        body: { r: [4 * on, 0, 0], p: [0, 0, -0.5 * on] },
        head: { r: [8 * on + tr, 0, 0] },
        mane1: { s: 1 + 0.06 * on + 0.015 * tr },
        ...J(8 * on + 2 * tr),
        ...face.pose('open', 0.45 * on),
      }, Object.fromEntries(tail.map((n, i) => [n, { r: [-6 * on * (1 + 0.2 * i), 0, 0] }])));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
