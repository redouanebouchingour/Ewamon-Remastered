// Moblaze's rig: Moflame grown into a fire hound. A broad head turned to the viewer with fierce eyes, a candle-flame
// crest (crown), a flame banner blown back over the spine (mane1..3), a fan of flame tongues off the rump (one fan
// joint that sways and spreads), a cream bushy tail under it (tail1) and loose embers drifting round it (their own
// joint). Numbers are scad/moblaze.scad's.
import { K, TAU, hash, merge, osc, rigDef, win } from './lib/anim.mjs';
import { eyeKit } from './lib/face.mjs';
import { blobD, capD, chainHit, closest, ellD, fold, isAny, near, side, subFrame } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const D = Math.PI / 180;
const FUR = [0.61, 0.36, 0.24];
const COATS = [FUR, [0.82, 0.45, 0.25], [0.44, 0.32, 0.23], [0.69, 0.54, 0.38], [0.85, 0.74, 0.53], [0.15, 0.09, 0.07]];
const EAR_IN = [0.89, 0.61, 0.31];
const FLAMES = [[0.73, 0.11, 0.05], [0.97, 0.57, 0.07], [1, 0.8, 0.24], [0.99, 0.93, 0.72]];

// ---- the head block: translate(HC) rotate([0, 0, HY]) scale(HS)
const HC = [-3.8, -19, 23.4];
const HY = 15;
const HS = 1.25;
const hf = subFrame(HC, [0, 0, HY], HS);
const EYE = [3.0, -3.35, 0.6];
const eyes = [1, -1].map((s) => ({
  side: s > 0 ? 'L' : 'R', at: [0, 0, 0], size: 1.15, flat: 0.45, squash: 0.72,
  frame: subFrame(hf.world([s * EYE[0], EYE[1], EYE[2]]), [0, s * -12, s * 28 + HY], HS),
}));
const face = eyeKit({ eyes, skin: FUR, lid: [1.15, 1, 0.62] });
const EYES_W = [1, -1].map((s) => hf.world([s * EYE[0], EYE[1], EYE[2]]));

// ---- flame tongues (scad tongue()): sheet points read off the front sheet, laid in a vertical plane turned `yaw`
const OFF = -8;
const proj = (yaw) => Math.cos(30 * D) * Math.cos(yaw * D) + Math.sin(30 * D) * Math.sin(yaw * D);
const sheetOf = (p) => [0.866 * p[0] + 0.5 * p[1] + OFF, p[2]];
// a tongue's points in its plane: [l (along the plane), z (world)]
const inPlane = (root, yaw, pts) => {
  const rs = sheetOf(root);
  return pts.map((q) => {
    const r = q === 'R' ? [0, 0] : [q[0] - rs[0], q[1] - rs[1]];
    const l = r[0] / proj(yaw);
    return [l, root[2] + r[1] - 0.17 * l * (Math.cos(30 * D) * Math.sin(yaw * D) - Math.sin(30 * D) * Math.cos(yaw * D))];
  });
};
const tongueAt = (root, yaw, pts) => inPlane(root, yaw, pts).map(([l, z]) => [root[0] + Math.cos(yaw * D) * l, root[1] + Math.sin(yaw * D) * l, z]);
// normalised distance from a tongue: across the stroke by its width, through the plane by its thickness
function tongueD(c, root, yaw, pts, ws) {
  const P = inPlane(root, yaw, pts);
  const dx = c[0] - root[0]; const dy = c[1] - root[1];
  const l = dx * Math.cos(yaw * D) + dy * Math.sin(yaw * D);
  const n = -dx * Math.sin(yaw * D) + dy * Math.cos(yaw * D);
  let best = Infinity;
  for (let i = 0; i < P.length - 1; i++) {
    const [al, az] = P[i]; const [bl, bz] = P[i + 1];
    const el = bl - al; const ez = bz - az;
    const t = Math.min(1, Math.max(0, ((l - al) * el + (c[2] - az) * ez) / (el * el + ez * ez || 1e-9)));
    const w = Math.max(0.5, ws[i] + (ws[i + 1] - ws[i]) * t);
    best = Math.min(best, Math.hypot(Math.hypot(l - al - el * t, c[2] - az - ez * t) / w, n / 2));
  }
  return { d: best, l };
}

const ROOT = [1.5, 12.5, 20.5];
const TONGUES = [
  [62, ['R', [7, 25], [13, 28.5], [18, 32.4], [21, 37.6]], [3.4, 4.4, 4.2, 2.8, 0.5]],
  [54, ['R', [8, 23.2], [15, 25.2], [21, 26.6], [26.5, 27.2]], [3.6, 4.6, 4.2, 2.6, 0.5]],
  [44, ['R', [8, 20.3], [14, 20.8], [19.5, 21.6], [23, 22.2]], [3.2, 3.6, 3, 2, 0.4]],
  [66, ['R', [7, 17.4], [13, 15.4], [18.5, 14.2], [23.3, 14.8]], [3, 3.6, 3, 2, 0.4]],
  [72, ['R', [7, 15], [14, 12], [21, 11.4]], [2.6, 2.8, 2, 0.4]],
  [40, ['R', [5, 16], [9.5, 12.5], [13, 9.9]], [2.4, 2.4, 1.6, 0.4]],
  [50, [[5, 26], [10, 31], [16.5, 36.2]], [2.4, 1.8, 0.4]],
  [58, [[11, 27], [17, 29.5], [22.8, 31.2]], [2.6, 2, 0.4]],
  [48, [[9, 16], [15, 13.6], [20.2, 13.2]], [2.2, 1.8, 0.4]],
  [52, ['R', [5, 21.6], [10, 23], [14, 24]], [2.2, 2.2, 1.6, 0.6]],
];
const SROOT = [-3.4, -17.5, 29.5];
const STREAM = [
  [76, ['R', [-9, 33.2], [-4, 34.6], [0, 35.6], [3.2, 37.6]], [2.6, 3.8, 3.8, 2.8, 0.5]],
  [72, ['R', [-10, 31], [-5, 31.4], [-0.5, 32.2]], [2.2, 2.4, 2, 0.4]],
  [80, [[-12, 33.5], [-10.5, 36.4], [-8.5, 38]], [1.8, 1.3, 0.3]],
  [74, [[-6, 35], [-4, 37.4], [-2.4, 38.8]], [1.7, 1.2, 0.3]],
  [78, [[-1, 36], [1, 38.2], [2.6, 39.2]], [1.5, 1, 0.3]],
];
// the banner's links along its main tongue
const SP = tongueAt(SROOT, 76, STREAM[0][1]);
const mane = ['mane1', 'mane2', 'mane3'];
const MANE_AT = [SROOT, SP[1], SP[2]];
const maneOf = (c) => {
  const l = (c[0] - SROOT[0]) * Math.cos(76 * D) + (c[1] - SROOT[1]) * Math.sin(76 * D);
  const l1 = (SP[1][0] - SROOT[0]) * Math.cos(76 * D) + (SP[1][1] - SROOT[1]) * Math.sin(76 * D);
  const l2 = (SP[2][0] - SROOT[0]) * Math.cos(76 * D) + (SP[2][1] - SROOT[1]) * Math.sin(76 * D);
  return l < l1 ? 'mane1' : l < l2 ? 'mane2' : 'mane3';
};

const EMBERS = [[8, 35, 9], [21.5, 29.5, 16], [22.5, 18.5, 14], [12, 9.5, 12]].map(([sx, z, y]) => [(sx - OFF - 0.5 * y) / 0.866, y, z]);
const MARKS = [[6.2, -15.5, 10], [-2.7, -17, 10], [6.1, -17.3, 6.4], [5.2, -10, 19.5], [6.3, 5.5, 16], [6.1, 6.5, 13.6]];

// ---- legs (scad leg(hip, knee, foot, r))
const LEGS = {
  legFL: [[4.2, -10, 14], [4.4, -12.5, 7], [4.5, -14.5, 0], 3.7],
  legFR: [[-4.2, -10, 14], [-4.5, -14, 7], [-4.7, -16.5, 0], 3.7],
  legBL: [[4.3, 9, 14], [4.6, 12, 6], [4.5, 11, 0], 3.5],
  legBR: [[-4.3, 9, 14], [-4.6, 11, 6], [-4.5, 9.5, 0], 3.5],
};
const legD = ([hip, knee, foot, r]) => (c) => Math.min(
  capD(c, hip, knee, r * 1.05, r * 0.9),
  capD(c, knee, [foot[0], foot[1], foot[2] + 1.3], r * 0.9, r * 0.75),
  ellD(c, [r * 0.85, r * 1.1, 0.95], [foot[0], foot[1] - 0.7, foot[2] + 0.75]),
  ellD(c, [r * 0.7, 0.8, 0.6], [foot[0], foot[1] - 0.7 - r * 0.95, 0.5]),
  ellD(c, [r * 0.6 + 2, r * 0.6 + 2, 2.4], [foot[0], foot[1] - 0.4, 3]),   // the cream tufts over the paw
);
const legParts = Object.entries(LEGS).map(([name, l]) => [name, legD(l)]);

const TORSO = [[[5.8, 6.4, 7.4], [0, -8.5, 16]], [[5.6, 6.2, 6.8], [0, 8, 16.4]]];
const RUFF = [-1.8, -15.8, 15.5];
const bodyD = (c) => Math.min(
  blobD(c, TORSO),
  ellD(c, [4.3, 11, 3], [0, -0.5, 10.6]),
  ellD(fold(c), [3.2, 5.2, 5.8], [3.2, 8.5, 14.5]),
  blobD(c, [[[4.6, 4.2, 4.6], [0, -10.5, 19]], [[4.2, 4, 4.4], [-1.6, -14, 20]]]),
  ellD(c, [6.4, 5.4, 7], RUFF) * 0.97,
  ellD(c, [5.4, 4.6, 5], [RUFF[0], RUFF[1] + 0.5, RUFF[2] + 5]),
  ellD(c, [8.6, 7.4, 3.6], [RUFF[0], RUFF[1], RUFF[2] - 4.6]),   // the ragged lobes round its lower edge
  ellD(c, [8.6, 7.4, 3.2], [RUFF[0], RUFF[1], RUFF[2] + 0.5]),
);
const tailD = (c) => Math.min(
  chainHit(c, [[1.5, 13.5, 15.5], [3.5, 17, 12.5], [5.2, 19, 13.5], [6, 19.5, 15.5]], [2.4, 2.6, 2, 1]).d,
  ellD(c, [1.6, 1.6, 2.4], [4.7, 18.4, 15.8]), ellD(c, [1.6, 1.6, 2.4], [2.5, 16.2, 15.7]),
);
// in the head frame
const headD = (c) => {
  const p = hf.local(c);
  const f = fold(p);
  return Math.min(
    ellD(p, [4.4, 4.2, 4.4], [0, 0, 0.7]),
    blobD(p, [[[2.7, 2.3, 1.9], [0, -3.2, -1.9]], [[1.6, 1.3, 1.25], [0, -5.4, -2.3]]]),
    blobD(p, [[[2.5, 2, 1.3], [0, -2.8, -3.4]], [[1.4, 1.1, 0.95], [0, -4.9, -3.4]]]),
    ellD(p, [1.35, 0.85, 0.75], [0, -6.4, -2.1]),
    ellD(f, [1.6, 1, 1], [3, -3.35, 1]),
    capD(f, [3.4, -1.6, -2.2], [6.8, -1.2, -3.6], 1.8, 0.9),
    capD(f, [4, 0.2, -0.6], [7, 1, -0.8], 1.6, 0.8),
    capD(f, [3, -2.6, -3.4], [5.2, -2.8, -6], 1.6, 0.8),
    capD(f, [2.2, -0.4, 3.8], [3.2, 0.3, 10], 1.3, 0.3),
  );
};
const earD = (s) => (c) => {
  const p = hf.local(c);
  if (Math.sign(p[0] || 1) !== s) return Infinity;
  return capD(fold(p), [3.4, 0.6, 2.8], [7.4, 1.2, 7.6], 2.2, 0.3);
};
const crownD = (c) => {
  const p = hf.local(c);
  return Math.min(ellD(p, [4.6, 3.6, 7.4], [0.3, -0.7, 9.6]), ellD(p, [2.6, 2.4, 2.2], [0, -0.7, 4.4]));
};

const joints = [
  { name: 'root', at: [0, -1, 0] },
  ...Object.entries(LEGS).map(([name, [hip]]) => ({ name, parent: 'root', at: hip })),
  { name: 'body', parent: 'root', at: [0, -1, 13] },
  { name: 'head', parent: 'body', at: [-1.4, -13.5, 20] },
  { name: 'earL', parent: 'head', at: hf.world([3.4, 0.6, 2.8]) },
  { name: 'earR', parent: 'head', at: hf.world([-3.4, 0.6, 2.8]) },
  { name: 'crown', parent: 'head', at: hf.world([0, -0.4, 4.6]) },
  ...mane.map((name, i) => ({ name, parent: i === 0 ? 'head' : mane[i - 1], at: MANE_AT[i] })),
  { name: 'fan', parent: 'body', at: ROOT },
  { name: 'tail1', parent: 'body', at: [1.5, 13.5, 15.5] },
  { name: 'embers', parent: 'root', at: [0, 4, 0] },
  ...face.joints,
];

const furParts = (c) => [
  ...legParts.map(([n, t]) => [n, t(c)]),
  ['body', bodyD(c)],
  ['tail1', tailD(c)],
  ['head', headD(c)],
  ['earL', earD(1)(c)],
  ['earR', earD(-1)(c)],
];

function assign(c, rgb) {
  if (isAny(rgb, FLAMES, 0.03)) {
    if (EYES_W.some((e) => ellD(c, [2, 2, 2], e) < 1)) return 'head';      // the amber irises
    if (EMBERS.some((e) => ellD(c, [1.6, 1.6, 1.6], e) < 1)) return 'embers';
    if (MARKS.some((e) => ellD(c, [1.8, 1.8, 1.8], e) < 1)) return closest(furParts(c).filter(([n]) => n.startsWith('leg') || n === 'body'));
    const fanD = Math.min(...TONGUES.map(([yaw, pts, ws]) => tongueD(c, ROOT, yaw, pts, ws).d), ellD(c, [3, 3.4, 3], ROOT));
    const streamD = Math.min(...STREAM.map(([yaw, pts, ws]) => tongueD(c, SROOT, yaw, pts, ws).d));
    const k = closest([['crown', crownD(c)], ['fan', fanD], ['stream', streamD]]);
    return k === 'stream' ? maneOf(c) : k;
  }
  if (near(rgb, EAR_IN, 0.03)) return hf.local(c)[0] > 0 ? 'earL' : 'earR';
  if (isAny(rgb, COATS, 0.03)) {
    if (EYES_W.some((e) => ellD(c, [1.9, 1.9, 1.9], e) < 1)) return 'head';  // the eyes' ink and their fur lids
    return closest(furParts(c));
  }
  return 'head';   // the glints
}

// the fan sways and spreads, the embers drift and wink, the crown flickers
const fan = (u, amp = 5, cycles = 1, lift = 0) => ({ fan: { r: [lift + 2 * osc(u, cycles, 0.3), 0, amp * osc(u, cycles)] } });
const drift = (u, cycles = 1, amp = 1) => ({ embers: { p: [0, 0, 1.2 * amp * osc(u, cycles)], s: 1 + 0.12 * osc(u, cycles * 3, 0.2) } });
const crown = (u, steps = 12, amp = 1) => ({ crown: { s: [1, 1, 1 + 0.18 * amp * (hash((Math.floor(u * steps) % steps) * 5.3) - 0.5)] } });

const base = quadrupedClips({
  face, mane, tail: ['tail1'], hipH: 14, stride: 14, flicker: 0.12,
  add: {
    idle: (t, u) => merge(fan(u, 5, 2), drift(u, 1), crown(u, 48)),
    walk: (t, u) => merge(fan(u, 8, 1, 4), drift(u, 2), crown(u, 8)),
    idle_sniff: (t, u) => merge(fan(u, 4, 2), drift(u, 1), crown(u, 24)),
    idle_shake: (t, u) => merge(fan(u, 14 * win(u, 0.1, 0.8, 0.06), 7), drift(u, 2, 2), crown(u, 24, 2)),
    windup: (t, u) => merge(fan(u, 3, 3, 12), crown(u, 4, 2)),
    lunge: (t, u) => merge(fan(u, 4, 2, 10), crown(u, 4, 2)),
    hurt: (t, u) => merge(fan(u, 0, 1, -14 * K(u, [[0, 0], [0.18, 1], [1, 0.4]])), drift(u, 2, 2)),
    faint: (t, u) => { const d = K(u, [[0.2, 0], [0.8, 1]]); return { ...fan(u, 0, 1, -16 * d), embers: { p: [0, 0, -3 * d], s: 1 - 0.6 * d }, crown: { s: [1, 1, 1 - 0.7 * d] } }; },
    celebrate: (t, u) => merge(fan(u, 14, 4, 12), drift(u, 2, 2), crown(u, 6, 2)),
    enter: (t, u) => merge(fan(u, 8, 1, 10 * win(u, 0.4, 0.9, 0.12)), crown(u, 6, 2)),
  },
});
const { idle_wag: _wag, ...clips0 } = base;

const clips = {
  ...clips0,
  // fidget: the fire flares: the crown roars up, the fan spreads, the embers burst outwards and settle
  idle_flare: {
    seconds: 2,
    pose: (t, u) => {
      const k = K(u, [[0, 0], [0.18, 1], [0.6, 1], [0.9, 0]]);
      return merge({
        body: { r: [-4 * k, 0, 0] },
        head: { r: [-10 * k, 0, 0] },
        crown: { s: [1 + 0.15 * k, 1 + 0.15 * k, 1 + 0.5 * k] },
        embers: { s: 1 + 0.35 * k, p: [0, 0, 2 * k] },
        fan: { r: [10 * k, 0, 6 * Math.sin(TAU * 4 * u) * k], s: 1 + 0.12 * k },
        ...face.pose(k > 0.5 ? 'squeeze' : 'open'),
      }, crown(u, 16, 2 * k));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
