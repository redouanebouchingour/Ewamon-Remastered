// Gemknight (Tenjin form)'s rig: Gemknight's rig on the form's own scad (2026-11-11 sprite match). The knight's body is
// the base's, scaled by S = 1.03 about the feet after lowering by G = 2.8 (body numbers go through B()); the parts traced
// off the tenjin sheet (golden blade, kite shield with its pearl boss, the cream cape, the halo and the motes) are only
// lowered by GT = 0.4 (T()). No rainbow burst and no eye glints (a dark visor): the halo floats over the helm on its own
// joint and six motes of light (one joint at the waist) drift round the knight. Second pass: a bulkier knight and the
// cape a cloth hanging behind it, blown out to -X. Numbers are scad/gemknight_tenjin.scad's.
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, ell, fromSheet, limb, mx, pick, ppFrame } from './lib/biped.mjs';
import { plateD } from './lib/geo.mjs';

const G = 2.8;
const S = 1.03;
const GT = 0.4;
const B = ([x, y, z]) => [S * x, S * y, S * (z - G)];
const unB = (c) => [c[0] / S, c[1] / S, c[2] / S + G];
const T = ([x, y, z]) => [x, y, z - GT];
const unT = (c) => [c[0], c[1], c[2] + GT];
/** a test written in the base body's scad numbers / in the tenjin sheet's scad numbers */
const inB = (test) => (c) => test(unB(c));
const inT = (test) => (c) => test(unT(c));
const add3 = (a, b) => a.map((v, i) => v + b[i]);

const LEGS = {
  L: [fromSheet(2.6, 16.5, -0.2), fromSheet(4.7, 12.8, -1), fromSheet(7.2, 6.6, -1), fromSheet(9.4, 3.4, -2.2)],
  R: [fromSheet(-1.6, 16.5, 0.4), fromSheet(-3.9, 12.6, -0.4), fromSheet(-6, 6.6, -0.4), fromSheet(-9, 3.4, -2.6)],
};
const ARMS = {
  L: [[5.3, 0.5, 30.2], [8.6, -0.2, 26.4], [11.4, 0.6, 23.4]],
  R: [[-5.3, 0.5, 30.2], [-7.4, -0.6, 25.6], [-7.7, -2.2, 20.3]],
};
const H = [0.6, -0.3, 35.4];
const bladePts = [[-9.1, 19.0], [-7.6, 17.7], [-17.8, 6.2], [-20.8, 3.9], [-19.3, 7.3]];
const kite = [[12.4, 32.9], [17.0, 26.0], [17.0, 17.0], [12.1, 10.0], [6.4, 16.4], [5.4, 26.3]];

const FOLD = [0, 0.7, 1.1];
// the cape (tenjin sheet) hangs behind the knight: the scad's columns [collar, billow, hem] as scad [x, y, z],
// subdivided like capePt(), the billow and hem rippling in depth
const capeKeys = [
  [[-5.7, 2.5, 29.3], [-24.0, 4.2, 22.5], [-24.5, 4.8, 16.5]],
  [[-4.5, 3.1, 29.8], [-18.5, 4.9, 21.5], [-18.5, 5.3, 13.5]],
  [[-3.1, 3.5, 30.0], [-12.5, 5.3, 19.0], [-12.5, 5.6, 10.5]],
  [[-1.0, 3.7, 30.2], [-6.0, 5.7, 17.5], [-6.5, 6.1, 8.8]],
  [[1.0, 3.7, 30.2], [0.5, 5.9, 17.0], [0.5, 6.3, 8.3]],
  [[3.1, 3.5, 30.0], [5.5, 5.7, 17.5], [6.5, 6.1, 8.8]],
  [[4.5, 3.1, 29.8], [10.0, 5.1, 18.0], [11.5, 5.5, 9.0]],
  [[5.7, 2.5, 29.3], [13.5, 4.1, 19.0], [15.5, 4.5, 10.0]],
];
const capeCols = Array.from({ length: (capeKeys.length - 1) * 4 + 1 }, (_, i) => [0, 1, 2].map((row) => {
  const k = Math.min(Math.floor(i / 4), capeKeys.length - 1);
  const u = (i % 4) / 4;
  const a = capeKeys[k][row]; const b = capeKeys[Math.min(k + 1, capeKeys.length - 1)][row];
  const q = a.map((v, j) => v + (b[j] - v) * u);
  return [q[0], q[1] + FOLD[row] * Math.sin((i * Math.PI) / 2), q[2]];
}));
const capeLink = (row) => any(...capeCols.flatMap((col, i) => [limb(col[row], col[row + 1], 1.1),
  ...(i + 1 < capeCols.length ? [limb(col[row], capeCols[i + 1][row + 1], 1.1)] : [])]));

// the halo: a ring of radius 4.75 round sheet (1.3, 35.7), squashed to 0.88 in z, at pp depth 2.2
const haloF = ppFrame(2.2);
const haloD = (c) => {
  const q = haloF.local(c);
  return Math.hypot(Math.hypot(q[0] - 1.3, (q[2] - 35.7) / 0.88) - 4.75, q[1]) / 0.45;
};
const HALO_C = T(haloF.world([1.3, 0, 35.7]));
const motes = [[-11.5, 30.5, 1], [-14.0, 11.5, 0], [6.5, 36.0, 1], [18.5, 21.0, 0], [-4.5, 33.0, 2], [19.0, 30.0, -1]]
  .map(([x, z, d]) => ppFrame(d).world([x, 0, z]));

const legTest = ([hip, knee, ankle, toe]) => any(limb(hip, knee, 2.6, 2.3), limb(knee, ankle, 2.2, 1.9), ell([2.3, 2, 2], add3(knee, [0, -0.9, 0])),
  limb(add3(ankle, [0, 0, -2]), add3(toe, [0, 0, 0.35]), 2, 1.2), limb(add3(ankle, [0, 0, -3.2]), add3(toe, [0, 0, -0.6]), 1.7, 1));

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: B(LEGS.L[0]) },
  { name: 'legR', parent: 'root', at: B(LEGS.R[0]) },
  { name: 'body', parent: 'root', at: B([0, 0, 17.5]) },
  { name: 'head', parent: 'body', at: B([0.6, -0.3, 31.9]) },
  ...['L', 'R'].flatMap((s) => [
    { name: `arm${s}`, parent: 'body', at: B(ARMS[s][0]) },
    { name: `fore${s}`, parent: `arm${s}`, at: B(ARMS[s][1]) },
    { name: `hand${s}`, parent: `fore${s}`, at: B(ARMS[s][2]) },
  ]),
  { name: 'cape1', parent: 'body', at: B([0, 1.8, 30.9]) },
  { name: 'cape2', parent: 'cape1', at: T([0.5, 5.9, 17]) },
  { name: 'halo', parent: 'head', at: HALO_C },
  { name: 'motes', parent: 'root', at: [0, 0, 20] },
];

const parts = [
  ['legL', inB(legTest(LEGS.L))], ['legR', inB(legTest(LEGS.R))],
  ['body', inB(any(ell([4.4, 3.2, 3.4], [0, 0.2, 28.2]), ell([3.7, 2.8, 2.3], [0, 0, 23.8]), ell([3.85, 3, 0.8], [0, 0, 21.4]),
    ell([4, 3, 1.5], [0, 0, 20.2]), ell([4.3, 3.1, 1.3], [0, 0.1, 17.6]), ell([1.2, 0.7, 3], [0, -2.9, 18.2]),
    mx(ell([1.3, 1.9, 2.2], [4.1, 0.2, 18.2])), mx(ell([1.8, 0.8, 2.4], [2.6, -2.3, 18.3])),
    mx(ell([3.6, 3.4, 3], [6.2, 0.5, 31.6])), mx(ell([2.9, 2.7, 1.6], [6.2, 0.1, 33.3])), mx(ell([3.3, 3.1, 1], [6.5, 0.5, 29])),
    mx(ell([3, 2.9, 0.9], [6.8, 0.5, 27.8])), mx(ell([2.2, 1.1, 1.6], [6.4, -2.6, 31])), ell([3, 2.8, 1.2], [0.3, 0, 31.4])))],
  ['head', inB(any(ell([3.25, 3.25, 3.48], H), ell([2.7, 2.7, 1], [0.6, -0.3, 32]), limb(H, [0.6, -0.3, 32.2], 3.1)))],
  ...['L', 'R'].flatMap((s) => [
    [`arm${s}`, inB(limb(ARMS[s][0], ARMS[s][1], 2, 1.85))],
    [`fore${s}`, inB(any(limb(ARMS[s][1], ARMS[s][2], 1.85, 2.1), ell([1.95, 1.85, 1.6], ARMS[s][1])))],
  ]),
  ['handL', inT((c) => plateD(ppFrame(-6.3).local(c), kite, 3.6))],
  ['handR', any(inB(any(ell([1.75, 1.65, 1.5], ARMS.R[2]), ell([2.25, 1.85, 1.4], add3(ARMS.R[2], [0, 0, 1.7])),
    ell([2.15, 1.8, 0.4], add3(ARMS.R[2], [0, 0, 2.8])), limb(ppFrame(1.6).world([-7.5, 0, 21.1]), ppFrame(1.6).world([-6.5, 0, 22.2]), 0.8))),
  inT(any((c) => plateD(ppFrame(1.6).local(c), bladePts, 1.4), limb(ppFrame(1.6).world([-9.9, 0, 19.7]), ppFrame(1.6).world([-7.35, 0, 16.85]), 0.8))))],
  ['cape1', any(inT(capeLink(0)), inT(limb([-6.5, 2.6, 29.2], [-24, 4.2, 22.5], 0.9)),
    inB(any(...[-1.6, 1.6].flatMap((x) => [limb([-4.8, 3.8, 29.6], [x, 5.9, 23.6], 1), limb([4.8, 3.8, 29.6], [x, 5.9, 23.6], 1)]),
      limb([-4.8, 3.8, 29.6], [4.8, 3.8, 29.6], 1), limb([-4.6, 2.6, 30.9], [4.6, 2.6, 30.9], 1.2))))],
  ['cape2', inT(capeLink(1))],
  ['halo', inT(haloD)],
  ['motes', inT((c) => Math.min(...motes.map((m) => Math.hypot(c[0] - m[0], c[1] - m[1], c[2] - m[2]) / 0.4)))],
];

const assign = (c) => pick(c, parts);

// the halo floats and tilts; the motes drift round the waist and bob
const drift = (u, cycles, amp = 1) => ({
  halo: { p: [0, 0, 0.35 * amp * osc(u, cycles)], r: [3 * amp * osc(u, cycles / 2, 0.25), 0, 0] },
  motes: { r: [0, 0, 25 * amp * osc(u, 1)], p: [0, 0, 0.6 * amp * osc(u, cycles, 0.3)] },
});

const add = {
  idle: (t, u) => drift(u, 2),
  walk: (t, u) => drift(u, 2, 0.5),
  windup: (t, u) => ({ halo: { s: 1 + 0.08 * smooth(u / 0.8) }, ...drift(u, 1, 0.5) }),
  lunge: (t, u) => { const hit = K(u, [[0.1, 0], [0.4, 1], [1, 0]]); return { halo: { s: 1.08 + 0.06 * hit }, handL: { r: [-10 * hit, 0, 0] } }; },
  hurt: (t, u) => ({ halo: { r: [14 * Math.sin(TAU * 3 * u) * (1 - u), 0, 8 * Math.sin(TAU * 2 * u) * (1 - u)] } }),
  faint: (t, u) => { const d = smooth((u - 0.2) / 0.6); return { halo: { p: [0, 0, -1.2 * d], r: [-25 * d, 0, 10 * d] }, motes: { s: 1 - 0.9 * d } }; },
  celebrate: (t, u) => ({ halo: { p: [0, 0, 1.2 * Math.abs(Math.sin(TAU * u))], s: 1.05 }, motes: { r: [0, 0, 180 * smooth(u)], p: [0, 0, 1.5 * Math.sin(TAU * u)] } }),
  enter: (t, u) => ({ halo: { s: 0.2 + 0.8 * smooth((u - 0.15) / 0.5) }, motes: { s: smooth((u - 0.3) / 0.5) + 1e-3 } }),
  exit: (t, u) => drift(u, 2),
};

const base = bipedClips({
  hipH: 14.1, stride: 16, armSwing: 10, hopScale: 0.3, hopH: 3,
  cape: ['cape1', 'cape2'],
  punch: { arm: [-70, 0, 20], fore: [-25, 0, 0] },
  cheer: { arm: [-10, -115, 0], fore: [-10, 10, 0] },
  add,
});

const clips = {
  ...base,

  // fidget: raises the shield in front of the helm and peers over it, then lowers it
  idle_shield: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.18, 1], [0.75, 1], [0.92, 0]]);
      const peek = win(u, 0.35, 0.65, 0.06);
      return merge({
        body: { r: [2 * on, 0, 6 * on] },
        head: { r: [6 * on - 6 * peek, 0, -8 * on + 12 * peek] },
        armL: { r: [-35 * on, 0, -12 * on] },
        foreL: { r: [-40 * on, 0, 0] },
        armR: { r: [8 * on, 0, 0] },
      }, drift(u, 2));
    },
  },

  // fidget: brings the golden blade up in a forward arc, and back down
  idle_flourish: {
    seconds: 2.2,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.25, 1], [0.6, 1], [0.85, 0]]);
      const tw = win(u, 0.3, 0.6, 0.06);
      return merge({
        body: { r: [0, 0, -6 * up] },
        head: { r: [-6 * up, 0, -12 * up] },
        armR: { r: [-40 * up, 0, 14 * up] },
        foreR: { r: [-30 * up, 0, 0] },
        handR: { r: [-50 * up, 0, 30 * tw * Math.sin(TAU * 2 * (u - 0.3))] },
      }, drift(u, 2, 1.5));
    },
  },
};

export default rigDef({ joints, assign, clips });
