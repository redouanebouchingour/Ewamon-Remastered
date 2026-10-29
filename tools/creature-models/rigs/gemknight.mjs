// Gemknight's rig: a crystal knight in a wide stance, a long crystal blade held low and out in the right hand, a kite
// shield on the left arm (handL), a rainbow cape billowing out to both sides behind it (two links: collar to billow,
// billow to hem) and a burst of light behind the helm that breathes. The scad builds everything in the sheet's frame
// and lowers it by G = 2.8 at the end, so every number here goes through low(). Numbers are scad/gemknight.scad's.
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, ell, fromSheet, limb, mx, pick, plate, ppFrame } from './lib/biped.mjs';
import { plateD, polyD } from './lib/geo.mjs';

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

// the cape: the scad's columns [collar, billow, hem] as [sheet x, z, depth], subdivided four times like capePt()
const capeKeys = [
  [[-5.8, 30.3, 1.4], [-19.6, 28.4, 1.0], [-20.3, 18.6, 1.2]],
  [[-4.6, 30.8, 2.4], [-16.0, 24.5, 2.6], [-17.0, 17.6, 2.6]],
  [[-3.0, 31.0, 3.2], [-11.5, 20.5, 4.0], [-12.6, 13.0, 4.0]],
  [[-1.0, 31.2, 3.6], [-6.0, 18.5, 5.0], [-6.0, 9.8, 5.0]],
  [[1.0, 31.2, 3.6], [1.0, 17.5, 5.6], [1.4, 7.7, 5.6]],
  [[3.0, 31.0, 3.2], [7.0, 18.5, 5.6], [9.0, 9.4, 5.6]],
  [[4.6, 30.8, 2.4], [13.0, 19.5, 5.0], [16.0, 7.4, 4.6]],
  [[5.8, 30.3, 1.4], [18.6, 20.0, 3.4], [19.4, 9.0, 3.0]],
];
const capeCols = Array.from({ length: (capeKeys.length - 1) * 4 + 1 }, (_, i) => [0, 1, 2].map((row) => {
  const k = Math.min(Math.floor(i / 4), capeKeys.length - 1);
  const u = (i % 4) / 4;
  const a = capeKeys[k][row]; const b = capeKeys[Math.min(k + 1, capeKeys.length - 1)][row];
  return fs(...a.map((v, j) => v + (b[j] - v) * u));
}));
const capeLink = (row) => any(...capeCols.flatMap((col, i) => [limb(col[row], col[row + 1], 1.1),
  ...(i + 1 < capeCols.length ? [limb(col[row], capeCols[i + 1][row + 1], 1.1)] : [])]));

// the light burst: three flame stars round sheet (1, 28.8) at pp depth 8, 7.6, 7.2, and streaks at pp depth 9
const coronaR = [9.0, 5.6, 8.0, 5.0, 9.6, 5.4, 7.4, 5.2, 8.6, 5.0, 7.8, 5.6];
const star = (k) => [[1, 27.5], ...Array.from({ length: 25 }, (_, i) => {
  const a = ((-8 + (196 * i) / 24) * Math.PI) / 180;
  const r = coronaR[i % coronaR.length] * k;
  return [1 + r * Math.cos(a), 28.8 + r * Math.sin(a)];
})];
const corona = (c) => Math.min(...[0, 1, 2].map((l) => plateD(lowF(ppFrame(8 - 0.4 * l)).local(c), star(1 - 0.2 * l), 0.4)));
const streaks = (c) => {
  const q = lowF(ppFrame(9)).local(c);
  const r = Math.hypot(q[0] - 0.5, q[2] - 22);
  return Math.abs(q[1]) < 0.4 && r > 9 && r < 21.5 ? 0.9 : 9;
};
const AURA_C = low(ppFrame(8).world([1, 0, 28.8]));

const shieldF = lowF(ppFrame(-6.3));
const legTest = ([hip, knee, ankle, toe]) => any(limb(hip, knee, 2, 1.75), limb(knee, ankle, 1.7, 1.45), ell([1.6, 1.5, 1.5], add3(knee, [0, -0.7, 0])),
  limb(add3(ankle, [0, 0, -2]), add3(toe, [0, 0, 0.3]), 1.6, 1), limb(add3(ankle, [0, 0, -3.2]), add3(toe, [0, 0, -0.6]), 1.5, 0.9));

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: LEGS.L[0] },
  { name: 'legR', parent: 'root', at: LEGS.R[0] },
  { name: 'body', parent: 'root', at: low([0, 0, 17.5]) },
  { name: 'head', parent: 'body', at: low([0.6, -0.3, 31.9]) },
  ...['L', 'R'].flatMap((S) => [
    { name: `arm${S}`, parent: 'body', at: ARMS[S][0] },
    { name: `fore${S}`, parent: `arm${S}`, at: ARMS[S][1] },
    { name: `hand${S}`, parent: `fore${S}`, at: ARMS[S][2] },
  ]),
  { name: 'cape1', parent: 'body', at: low([0, 1.8, 30.9]) },
  { name: 'cape2', parent: 'cape1', at: fs(1, 17.5, 5.6) },
  { name: 'aura', parent: 'body', at: AURA_C },
];

const parts = [
  ['legL', legTest(LEGS.L)], ['legR', legTest(LEGS.R)],
  ['body', any(ell([3.5, 2.5, 3], low([0, 0.2, 28.4])), ell([3, 2.2, 2], low([0, 0, 24])), ell([3.1, 2.4, 0.7], low([0, 0, 21.6])),
    ell([3.6, 2.6, 1.4], low([0, 0, 20.4])), ell([3.6, 2.6, 1.2], low([0, 0.1, 17.6])), ell([1, 0.6, 2.9], low([0, -2.3, 18.2])),
    mx(ell([1.1, 1.6, 2.1], low([3.4, 0.2, 18.2]))), mx(ell([1.5, 0.9, 2.3], low([2.15, -1.75, 18.3]))),
    mx(ell([2.9, 2.7, 2.4], low([5.3, 0.5, 31.4]))), mx(ell([2.4, 2.1, 1.3], low([5.4, 0.1, 32.9]))), mx(ell([2.7, 2.5, 0.9], low([5.7, 0.5, 29.3]))),
    mx(ell([1.9, 1, 1.4], low([5.6, -1.8, 31]))), ell([2.5, 2.3, 1.1], low([0.3, 0, 31.3])), limb(low([-4.6, 1.8, 30.9]), low([4.6, 1.8, 30.9]), 1.2))],
  ['head', any(ell([3, 3, 3.2], H), ell([2.75, 2.75, 1], low([0.6, -0.3, 31.9])), limb(H, low([0.6, -0.3, 32.2]), 2.9))],
  ...['L', 'R'].flatMap((S) => [
    [`arm${S}`, limb(ARMS[S][0], ARMS[S][1], 1.6, 1.5)],
    [`fore${S}`, any(limb(ARMS[S][1], ARMS[S][2], 1.5, 1.7), ell([1.5, 1.4, 1.3], ARMS[S][1]))],
  ]),
  ['handL', (c) => plateD(shieldF.local(c), kite, 2.2)],
  ['handR', any(ell([1.6, 1.5, 1.5], ARMS.R[2]), ell([1.9, 1.6, 1.3], add3(ARMS.R[2], [0, 0, 1.6])),
    (c) => plateD(lowF(ppFrame(1.6)).local(c), bladePts, 1.4), limb(low(ppFrame(1.6).world([-9.1, 0, 21.2])), low(ppFrame(1.6).world([-6.5, 0, 22.2])), 0.9))],
  ['cape1', any(capeLink(0), limb(fs(-6.5, 30.2, 1.6), fs(-19.9, 27.6, 0.8), 1.1), limb(fs(-19.6, 25, 0.6), fs(-19.8, 20, 0.6), 1))],
  ['cape2', capeLink(1)],
  ['aura', (c) => Math.min(corona(c), streaks(c))],
];

const assign = (c) => pick(c, parts);

// the aura breathes and turns a little
const auraPulse = (u, cycles, amp = 1) => ({ aura: { s: 1 + 0.04 * amp * osc(u, cycles), r: [0, 4 * amp * osc(u, cycles / 2, 0.25), 0] } });

const clipsFor = (extra = {}) => {
  const add = {
    idle: (t, u) => auraPulse(u, 2),
    walk: (t, u) => auraPulse(u, 2, 0.6),
    windup: (t, u) => ({ aura: { s: 1 + 0.1 * smooth(u / 0.8) } }),
    lunge: (t, u) => { const hit = K(u, [[0.1, 0], [0.4, 1], [1, 0]]); return { aura: { s: 1.1 + 0.12 * hit }, handL: { r: [-10 * hit, 0, 0] } }; },
    hurt: (t, u) => ({ aura: { s: 1 - 0.15 * K(u, [[0, 0], [0.18, 1], [1, 0.3]]) } }),
    faint: (t, u) => ({ aura: { s: 1 - 0.6 * smooth((u - 0.1) / 0.7) } }),
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
