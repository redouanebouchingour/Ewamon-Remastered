// Gemknight's rig: a crystal knight in a wide stance, a long crystal blade held low and out in the right hand, a kite
// shield on the left arm (handL), a rainbow cape billowing out to both sides behind it (two links: collar to billow,
// billow to hem) and a burst of light behind the helm that breathes. The scad builds everything in the sheet's frame
// and lowers it by G = 2.8 at the end, so every number here goes through low(). Numbers are scad/gemknight.scad's.
// 2026-11-11 sprite match (second pass: a bulkier knight, the cape a cloth hanging behind it and blown out to -X
// instead of a bell round the hips): the helm turned 22 deg towards the viewer, the eye glints on their own joint (they blink,
// flare in the windup and go narrow when hurt), bigger pauldrons and legs, a cut-crystal shield face, soft folds in
// the cape and a lavender cowl on its back, a bigger corona whose layers now share one depth.
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { blinks } from './lib/face.mjs';
import { any, bipedClips, ell, fromSheet, limb, mx, pick, plate, ppFrame } from './lib/biped.mjs';
import { ellD, plateD } from './lib/geo.mjs';

const G = 2.8;
const low = ([x, y, z]) => [x, y, z - G];
const fs = (sx, z, y) => low(fromSheet(sx, z, y));
const add3 = (a, b) => a.map((v, i) => v + b[i]);
const lowF = (f) => ({ local: (c) => f.local([c[0], c[1], c[2] + G]) });

const LEGS = {
  L: [fs(2.6, 16.5, -0.2), fs(4.7, 12.8, -1), fs(7.2, 6.6, -1), fs(9.4, 3.4, -2.2)],
  R: [fs(-1.6, 16.5, 0.4), fs(-3.9, 12.6, -0.4), fs(-6, 6.6, -0.4), fs(-9, 3.4, -2.6)],
};
const ARMS = {
  L: [[5.3, 0.5, 30.2], [8.6, -0.2, 26.4], [11.4, 0.6, 23.4]].map(low),
  R: [[-5.3, 0.5, 30.2], [-7.4, -0.6, 25.6], [-7.7, -2.2, 20.3]].map(low),
};
const H = low([0.6, -0.3, 35.4]);
const bladePts = [[-9.05, 20.45], [-7.75, 19.35], [-17.6, 8.7], [-20.4, 6.8], [-18.9, 9.8]];
const kite = [[10.6, 33.6], [16.0, 27.0], [15.6, 20.0], [10.6, 12.9], [6.0, 19.6], [5.0, 27.2]];

const FOLD = [0, 0.7, 1.1];
// the cape hangs behind the knight: the scad's columns [collar, billow, hem] as scad [x, y, z] (sheet z), subdivided
// four times like capePt(), the billow and hem rippling in depth
const capeKeys = [
  [[-5.5, 2.4, 30.3], [-24.0, 4.0, 28.0], [-24.5, 4.6, 18.6]],
  [[-4.4, 3.0, 30.8], [-18.5, 4.8, 24.5], [-18.5, 5.2, 16.0]],
  [[-3.0, 3.4, 31.0], [-12.5, 5.2, 20.5], [-12.5, 5.5, 13.0]],
  [[-1.0, 3.6, 31.2], [-6.0, 5.6, 18.5], [-6.5, 6.0, 11.0]],
  [[1.0, 3.6, 31.2], [0.5, 5.8, 18.0], [0.5, 6.2, 10.5]],
  [[3.0, 3.4, 31.0], [5.5, 5.6, 18.5], [6.5, 6.0, 11.0]],
  [[4.4, 3.0, 30.8], [9.5, 5.0, 19.5], [11.0, 5.4, 11.0]],
  [[5.5, 2.4, 30.3], [12.5, 4.0, 21.0], [14.0, 4.4, 12.0]],
];
const capeCols = Array.from({ length: (capeKeys.length - 1) * 4 + 1 }, (_, i) => [0, 1, 2].map((row) => {
  const k = Math.min(Math.floor(i / 4), capeKeys.length - 1);
  const u = (i % 4) / 4;
  const a = capeKeys[k][row]; const b = capeKeys[Math.min(k + 1, capeKeys.length - 1)][row];
  const q = a.map((v, j) => v + (b[j] - v) * u);
  return low([q[0], q[1] + FOLD[row] * Math.sin((i * Math.PI) / 2), q[2]]);
}));
const capeLink = (row) => any(...capeCols.flatMap((col, i) => [limb(col[row], col[row + 1], 1.1),
  ...(i + 1 < capeCols.length ? [limb(col[row], capeCols[i + 1][row + 1], 1.1)] : [])]));

// the light burst: three nested flame stars round sheet (1, 28.8) at pp depth 8 (0.4, 0.8, 1.2 thick), streaks at depth 9
const coronaR = [10.2, 6.4, 9.2, 5.8, 11.0, 6.2, 8.5, 6.0, 9.9, 5.8, 9.0, 6.4];
const star = (k) => [[1, 27.5], ...Array.from({ length: 25 }, (_, i) => {
  const a = ((-8 + (196 * i) / 24) * Math.PI) / 180;
  const r = coronaR[i % coronaR.length] * k;
  return [1 + r * Math.cos(a), 28.8 + r * Math.sin(a)];
})];
const corona = (c) => Math.min(...[0, 1, 2].map((l) => plateD(lowF(ppFrame(8)).local(c), star(1 - 0.17 * l), 0.4 + 0.4 * l)));
const streaks = (c) => {
  const q = lowF(ppFrame(9)).local(c);
  const r = Math.hypot(q[0] - 0.5, q[2] - 22);
  return Math.abs(q[1]) < 0.4 && r > 9 && r < 21.5 ? 0.9 : 9;
};
const AURA_C = low(ppFrame(8).world([1, 0, 28.8]));

const shieldF = lowF(ppFrame(-6.3));
const legTest = ([hip, knee, ankle, toe]) => any(limb(hip, knee, 2.6, 2.3), limb(knee, ankle, 2.2, 1.9), ell([2.3, 2, 2], add3(knee, [0, -0.9, 0])),
  limb(add3(ankle, [0, 0, -2]), add3(toe, [0, 0, 0.35]), 2, 1.2), limb(add3(ankle, [0, 0, -3.2]), add3(toe, [0, 0, -0.6]), 1.7, 1));

// the eye glints: the scad's two glints at H + (+-0.95, -3.09, -0.95), turned 22 deg round the helm's axis
const TURN = (22 * Math.PI) / 180;
const turn = ([x, y, z]) => [x * Math.cos(TURN) - y * Math.sin(TURN), x * Math.sin(TURN) + y * Math.cos(TURN), z];
const GLINTS = [[0.95, 0.62], [-0.95, 0.5]].map(([x, r]) => [add3(H, turn([x, -3.086, -0.95])), r]);
const EYES = GLINTS[0][0].map((v, i) => (v + GLINTS[1][0][i]) / 2);

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: LEGS.L[0] },
  { name: 'legR', parent: 'root', at: LEGS.R[0] },
  { name: 'body', parent: 'root', at: low([0, 0, 17.5]) },
  { name: 'head', parent: 'body', at: low([0.6, -0.3, 31.9]) },
  { name: 'eyes', parent: 'head', at: EYES },
  ...['L', 'R'].flatMap((S) => [
    { name: `arm${S}`, parent: 'body', at: ARMS[S][0] },
    { name: `fore${S}`, parent: `arm${S}`, at: ARMS[S][1] },
    { name: `hand${S}`, parent: `fore${S}`, at: ARMS[S][2] },
  ]),
  { name: 'cape1', parent: 'body', at: low([0, 1.8, 30.9]) },
  { name: 'cape2', parent: 'cape1', at: low([0.5, 5.8, 18]) },
  { name: 'aura', parent: 'body', at: AURA_C },
];

const parts = [
  ['legL', legTest(LEGS.L)], ['legR', legTest(LEGS.R)],
  ['body', any(ell([4.4, 3.2, 3.4], low([0, 0.2, 28.2])), ell([3.7, 2.8, 2.3], low([0, 0, 23.8])), ell([3.85, 3, 0.8], low([0, 0, 21.4])),
    ell([4, 3, 1.5], low([0, 0, 20.2])), ell([4.3, 3.1, 1.3], low([0, 0.1, 17.6])), ell([1.2, 0.7, 3], low([0, -2.9, 18.2])),
    mx(ell([1.3, 1.9, 2.2], low([4.1, 0.2, 18.2]))), mx(ell([1.8, 0.8, 2.4], low([2.6, -2.3, 18.3]))),
    mx(ell([3.6, 3.4, 3], low([6.2, 0.5, 31.6]))), mx(ell([2.9, 2.7, 1.6], low([6.2, 0.1, 33.3]))), mx(ell([3.3, 3.1, 1], low([6.5, 0.5, 29]))),
    mx(ell([3, 2.9, 0.9], low([6.8, 0.5, 27.8]))), mx(ell([2.2, 1.1, 1.6], low([6.4, -2.6, 31]))), ell([3, 2.8, 1.2], low([0.3, 0, 31.4])),
    limb(low([-4.6, 2.6, 30.9]), low([4.6, 2.6, 30.9]), 1.2))],
  ['head', any(ell([3.25, 3.25, 3.48], H), ell([2.7, 2.7, 1], low([0.6, -0.3, 32])), limb(H, low([0.6, -0.3, 32.2]), 3.1))],
  ...['L', 'R'].flatMap((S) => [
    [`arm${S}`, limb(ARMS[S][0], ARMS[S][1], 2, 1.85)],
    [`fore${S}`, any(limb(ARMS[S][1], ARMS[S][2], 1.85, 2.1), ell([1.95, 1.85, 1.6], ARMS[S][1]))],
  ]),
  ['handL', (c) => plateD(shieldF.local(c), kite, 3.4)],
  ['eyes', (c) => Math.min(...GLINTS.map(([p, r]) => ellD(c, [r + 0.25, 0.55, 0.55], p)))],
  ['handR', any(ell([1.75, 1.65, 1.5], ARMS.R[2]), ell([2.25, 1.85, 1.4], add3(ARMS.R[2], [0, 0, 1.7])),
    (c) => plateD(lowF(ppFrame(1.6)).local(c), bladePts, 1.4), limb(low(ppFrame(1.6).world([-9.1, 0, 21.2])), low(ppFrame(1.6).world([-6.5, 0, 22.2])), 0.9))],
  ['cape1', any(capeLink(0), limb(low([-6.5, 2.6, 30.2]), low([-24, 4, 28]), 1.1), limb(low([-23.6, 3.6, 25]), low([-23.9, 4, 20]), 1),
    ...[-4.4, 4.4].map((x) => limb(low([x, 3.8, 29.6]), low([0, 5.9, 23.4]), 1)), limb(low([-4.4, 3.8, 29.6]), low([4.4, 3.8, 29.6]), 1))],
  ['cape2', capeLink(1)],
  ['aura', (c) => Math.min(corona(c), streaks(c))],
];

const assign = (c) => pick(c, parts);

// the aura breathes and turns a little
const auraPulse = (u, cycles, amp = 1) => ({ aura: { s: 1 + 0.04 * amp * osc(u, cycles), r: [0, 4 * amp * osc(u, cycles / 2, 0.25), 0] } });

// the glints: a squash is a blink (never below 0.3: the glint sits in the slit, shrinking it far opens a hole)
const glint = (sz, s = 1) => ({ eyes: { s: [s, 1, s * sz] } });
const blink = (u, at) => glint(1 - 0.65 * blinks(u, at));

const clipsFor = (extra = {}) => {
  const add = {
    idle: (t, u) => merge(auraPulse(u, 2), blink(u, [[0.42, 0.47]])),
    walk: (t, u) => auraPulse(u, 2, 0.6),
    windup: (t, u) => ({ aura: { s: 1 + 0.1 * smooth(u / 0.8) }, ...glint(1, 1 + 0.3 * smooth(u / 0.6)) }),
    lunge: (t, u) => { const hit = K(u, [[0.1, 0], [0.4, 1], [1, 0]]); return { aura: { s: 1.1 + 0.12 * hit }, handL: { r: [-10 * hit, 0, 0] }, ...glint(1, 1.3 - 0.3 * smooth((u - 0.5) / 0.5)) }; },
    hurt: (t, u) => ({ aura: { s: 1 - 0.15 * K(u, [[0, 0], [0.18, 1], [1, 0.3]]) }, ...glint(1 - 0.65 * K(u, [[0, 0], [0.15, 1], [0.7, 1], [1, 0.3]])) }),
    recoil: (t, u) => glint(1 - 0.6 * K(u, [[0, 0], [0.3, 1], [1, 0]])),
    faint: (t, u) => ({ aura: { s: 1 - 0.6 * smooth((u - 0.1) / 0.7) }, ...glint(1 - 0.68 * smooth((u - 0.2) / 0.5)) }),
    celebrate: (t, u) => ({ aura: { s: 1.12 + 0.08 * Math.sin(TAU * 2 * u), r: [0, 30 * smooth(u), 0] } }),
    enter: (t, u) => ({ aura: { s: 0.3 + 0.7 * smooth((u - 0.2) / 0.5) + 0.1 * win(u, 0.5, 0.9, 0.1) } }),
    exit: (t, u) => auraPulse(u, 2),
  };
  for (const [k, f] of Object.entries(extra)) { const a = add[k]; add[k] = (t, u) => merge(a?.(t, u), f(t, u)); }
  const base = bipedClips({
    hipH: 13.7, stride: 16, armSwing: 10, hopScale: 0.3, hopH: 3,
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
        }, auraPulse(u, 2));
      },
    },

    // fidget: brings the sword up in a forward arc, the blade catching the light, and back down
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
        }, auraPulse(u, 2, 1.5));
      },
    },
  };
  // the form's layers on the fidgets too (the template clips took them through `add`)
  for (const k of ['idle_shield', 'idle_flourish']) {
    const f = clips[k].pose;
    if (extra[k]) clips[k].pose = (t, u) => merge(f(t, u), extra[k](t, u));
  }
  return clips;
};

export default rigDef({ joints, assign, clips: clipsFor() });
