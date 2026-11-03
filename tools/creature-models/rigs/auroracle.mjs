// Auroracle's rig: an elegant crystal fox on four slim legs, a big ruff of crystal-feather plates (on the body), a fox
// head turned to the viewer with calm almond eyes, tall splayed ears, a fan of nine curling crystal plumes (each on its
// own joint off the body, so the fan sways out of phase, spreads and folds) and ice shards floating round it (their
// own joint off the root). Numbers are scad/auroracle.scad's.
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, blob, ell, limb } from './lib/biped.mjs';
import { eyeKit } from './lib/face.mjs';
import { closest, ellD, isAny, near, subFrame } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const FURS = [[0.50, 0.76, 0.93], [0.60, 0.82, 0.95], [0.30, 0.58, 0.84], [0.72, 0.89, 0.97], [0.85, 0.98, 0.99]];
const HEAD_FUR = [0.60, 0.82, 0.95];
const EAR_IN = [0.14, 0.41, 0.76];
const PAW = [0.10, 0.34, 0.72];
const TAIL = [[0.45, 0.70, 0.92], [0.78, 0.93, 0.99], [0.94, 0.99, 1.00]];
const SHARD = [0.75, 0.90, 1.00];
const D = Math.PI / 180;
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const fold = (c) => [Math.abs(c[0]), c[1], c[2]];
// the scad's tuft(p, d, w): a plate from p along d, w wide
const tuft = (p, d, w) => limb(p, add3(p, d), w * 0.7, 0.3);

// ---- the head block: translate(HC) rotate([0, 0, HEAD_YAW]) scale(HS)
const HC = [0, -14.5, 29.9];
const HEAD_YAW = 14;
const HS = 1.2;
const hf = subFrame(HC, [0, 0, HEAD_YAW], HS);
const inHead = (test) => (c) => test(hf.local(c));
const inHeadMx = (test) => (c) => test(fold(hf.local(c)));

// the eyes: foxEye(EYE, 1.33, ±28, ∓3) inside the head block, so each eye's frame is rotate([0, tilt, yaw + HEAD_YAW])
const EYE = [2.15, -4.2, -1.67];
const eyeAt = (s) => hf.world([s * EYE[0], EYE[1], EYE[2]]);
const eyes = [
  { side: 'L', at: [0, 0, 0], size: 1.33 * HS, flat: 0.45, squash: 0.68, frame: subFrame(eyeAt(1), [0, -3, 28 + HEAD_YAW]) },
  { side: 'R', at: [0, 0, 0], size: 1.33 * HS, flat: 0.45, squash: 0.68, frame: subFrame(eyeAt(-1), [0, 3, -28 + HEAD_YAW]) },
];
const face = eyeKit({ eyes, skin: HEAD_FUR, lid: [1.12, 1, 0.6] });

// ---- the tails: the scad's TAILS ([sheet angle, sheet length, width]), YAWS and tailYaw / tailPitch / tailLen
const ROOT = [0, 10.5, 18.5];
const FAN_YAW = 50;
const YAWS = [-22, 20, -8, 24, -18, 10, -24, 16, 0];
const BEND = 0.32;
const TAIL_ROLL = 10;
const PT = [0.04, 0.36, 0.7, 0.9];
const PW = [0.3, 0.5, 0.46, 0.28];
const TAILS = [[78, 18, 11], [24, 24.5, 12], [3, 24.5, 12], [-12, 24, 12], [-26, 24, 12], [-39, 24.5, 12], [-54, 24, 11.5],
  [-74, 21, 11], [-116, 15, 8]]
  .map(([A, L, w], i) => {
    const yaw = FAN_YAW + YAWS[i];
    const proj = Math.cos(yaw * D) * 0.866 + Math.sin(yaw * D) * 0.5;
    const pitch = Math.atan2(Math.sin(A * D), Math.cos(A * D) / proj) / D;
    const len = L / Math.hypot(proj * Math.cos(pitch * D), Math.sin(pitch * D));
    return { A, len, w, yaw, frame: subFrame(ROOT, [-TAIL_ROLL, -pitch, yaw]) };
  });
const fans = TAILS.map((_, i) => `fan${i + 1}`);
const sp = (L, t) => [L * t, 0, BEND * L * t * t];

// ---- the legs: the scad's LEGS ([hip, knee, foot])
const LEGS = {
  legFL: [[3.4, -8, 12.5], [3.8, -11.5, 7.2], [4.2, -16, 1.3]],
  legFR: [[-3.4, -8, 12.5], [-4.4, -12.4, 7.4], [-5, -16.4, 1.3]],
  legBL: [[3.6, 6.5, 12.5], [4.2, 11, 7.6], [4.6, 14.5, 1.3]],
  legBR: [[-3.6, 6.5, 12.5], [-4, 5.4, 7.4], [-4.4, 3.6, 1.3]],
};
const legTest = ([hip, knee, foot]) => any(limb(hip, knee, 2.6, 1.9), limb(knee, add3(foot, [0, 0, 0.3]), 1.75, 1.4),
  ell([2.1, 2.7, 1.3], add3(foot, [0, -0.6, 0])),
  ...[30, 150, 270].map((a) => tuft(add3(knee, [Math.cos(a * D) * 1.4, Math.sin(a * D) * 1.4, 1.6]), [Math.cos(a * D) * 0.7, Math.sin(a * D) * 0.7, -2.8], 1.4)));

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...Object.entries(LEGS).map(([name, [hip]]) => ({ name, parent: 'root', at: hip })),
  { name: 'body', parent: 'root', at: [0, 0, 12] },
  { name: 'head', parent: 'body', at: [0, -13.4, 24] },
  { name: 'earL', parent: 'head', at: hf.world([3.6, 1.4, 3]) },
  { name: 'earR', parent: 'head', at: hf.world([-3.6, 1.4, 3]) },
  ...TAILS.map((t, i) => ({ name: fans[i], parent: 'body', at: ROOT, rot: [0, 0, t.yaw] })),
  { name: 'shards', parent: 'root', at: [0, 2, 0] },
  ...face.joints,
];

// the scad's leafXZ(p, ang, l, w): a flat leaf from p at ang degrees from +X in the XZ plane
const leafXZ = (p, ang, l, w) => limb(p, add3(p, [l * Math.cos(ang * D), 0, l * Math.sin(ang * D)]), w, 0.3);
const CHEEKS = [[4.4, -0.6, -0.6, 4, 4.4, 1.3], [4.6, -1.2, -2.2, -14, 5, 1.4], [4.4, -1.4, -3.6, -32, 5, 1.4], [3.8, -1.8, -4.8, -50, 4.6, 1.3],
  [2.8, -2.4, -5.6, -68, 3.8, 1.2], [5, 0.8, -1.6, -22, 4.4, 1.3], [4.6, 1, -3.4, -42, 4.2, 1.3]];
const headTest = any(
  inHead(any(blob([[[5, 4.4, 4], [0, 1, 0]], [[5.4, 3.6, 3], [0, -0.8, -3]], [[3, 2.4, 2.2], [0, -3.4, -3.4]]]),
    blob([[[2.9, 2.4, 2.2], [0, -3.3, -3.2]], [[0.9, 0.8, 0.7], [0, -6.6, -4.4]]]),
    blob([[[2.4, 2, 1.4], [0, -3, -4.8]], [[0.7, 0.6, 0.5], [0, -5.7, -5.2]]]), ell([1, 0.9, 2], [0, -2.9, 1.4]),
    tuft([-0.8, 0.6, 3.8], [-0.3, 0.2, 3.2], 1), tuft([1, 0.8, 3.8], [0.4, 0.2, 2.6], 0.9), tuft([0, -0.6, 4], [0, -0.3, 2], 0.8))),
  inHeadMx(any(...CHEEKS.map(([x, y, z, a, l, w]) => leafXZ([x, y, z], a, l, w)), ell([1.6, 1, 1.1], EYE))),
);
const earTest = (s) => (c) => {
  const p = hf.local(c);
  if (Math.sign(p[0]) !== s) return Infinity;
  return any(limb([3.6, 1.4, 3], [6.2, 2, 8.6], 2.9, 0.35), tuft([3.4, 0.4, 3.8], [0.6, 0, 2.8], 0.9),
    leafXZ([5.4, 1.6, 4.2], 28, 3, 0.8), leafXZ([5.8, 1.8, 5.8], 40, 2.6, 0.7), leafXZ([4.6, 1.5, 2.6], 10, 2.8, 0.8))(fold(p));
};
// the mane: its core, the neck and the rows of petal plates (MANE, the scad's petals()), the chest fringe
const RC = [0, -11.5, 17];
const RR = [8.4, 7.6, 8.2];
const MANE = [[52, 10, 4.6, 2.2, 0], [26, 13, 5.2, 2.4, 14], [0, 14, 5.6, 2.5, 0], [-24, 13, 5.6, 2.5, 14], [-44, 11, 5.2, 2.3, 0]];
const manePlates = [];
for (const [lat, n, l, w, ph] of MANE) {
  for (let i = 0; i < n; i++) {
    const lon = (i * 360) / n + ph;
    const nr = [Math.cos(lat * D) * Math.cos(lon * D), Math.cos(lat * D) * Math.sin(lon * D), Math.sin(lat * D)];
    const d0 = [nr[0] * 0.55, nr[1] * 0.55, nr[2] * 0.55 - 1];
    const k = l / Math.hypot(...d0);
    manePlates.push(tuft(add3(RC, [RR[0] * nr[0] * 0.9, RR[1] * nr[1] * 0.9, RR[2] * nr[2] * 0.9]), d0.map((v) => v * k), w));
  }
}
const bodyTest = any(
  blob([[[6.4, 6.2, 6.4], [0, -6, 14.2]], [[6, 5.8, 5.8], [0, 6.5, 14.8]]]), ell([4.2, 8.5, 2.4], [0, 0, 9.6]), ell([3.2, 3.2, 3.2], ROOT),
  ell([4.6, 4.4, 4.6], [0, -13, 23]), ell(RR, RC), ...manePlates,
  ...[-4.5, -1.5, 1.5, 4.5].map((x) => tuft([x, -17.6, 13], [x * 0.15, -0.5, -5.6], 2.2)),
  ...[-1, 4].map((y) => tuft([0, y, 20.2], [0, 3.6, -0.4], 2.8)),
  (c) => any(ell([3.6, 4.8, 4.8], [3.4, 7.5, 12.6]), tuft([5.8, 9.5, 11], [0.6, 1.8, -3], 1.8),
    ...[-1.5, 3].map((y) => tuft([4.6, y, 18], [1.6, 4, -1.6], 3)),
    ...[-0.5, 4].map((y) => tuft([6, y, 13.6], [1.6, 2.8, -3.6], 2.9)),
    ...[-1, 4].map((y) => tuft([3.2, y, 9.6], [0.8, 1.2, -3], 2)))(fold(c)),
);
// a plume in its own frame: the spine stations and the flicked tip
const tailTest = (t) => (c) => {
  const p = t.frame.local(c);
  const L = t.len; const w = t.w;
  let d = Infinity;
  for (let k = 0; k < PT.length; k++) d = Math.min(d, ellD(p, [L * 0.18, 2.8, PW[k] * w * 1.3], sp(L, PT[k])));
  d = Math.min(d, ellD(p, [L * 0.12, 2.4, w * 0.35], add3(sp(L, 0.95), [0, 0, 0.3 * w])));
  return d;
};
const legParts = Object.entries(LEGS).map(([name, l]) => [name, legTest(l)]);
const tailParts = TAILS.map((t, i) => [fans[i], tailTest(t)]);

function assign(c, rgb) {
  if (near(rgb, SHARD, 0.012)) return 'shards';
  if (isAny(rgb, TAIL, 0.02)) return closest(tailParts.map(([n, t]) => [n, t(c)]));
  if (near(rgb, PAW, 0.03)) return closest(legParts.map(([n, t]) => [n, t(c)]));
  if (near(rgb, EAR_IN, 0.03)) return hf.local(c)[0] > 0 ? 'earL' : 'earR';
  if (isAny(rgb, FURS, 0.02)) {
    return closest([['head', headTest(c)], ['earL', earTest(1)(c)], ['earR', earTest(-1)(c)], ['body', bodyTest(c)],
      ...legParts.map(([n, t]) => [n, t(c)])]);
  }
  return 'head';   // the eyes and the nose
}

// the fan in each plume's own frame (local X along the plume's yaw): ry turns a plume within its plane (> 0 lowers
// it), rz swings it out of it. `spread` opens the fan from its middle, `lift` raises every plume, `amp` / `cycles`
// sway each plume a little later than the one above it.
const fan = (u, { cycles = 1, amp = 1, spread = 0, lift = 0 } = {}) => Object.fromEntries(TAILS.map((t, i) => {
  const out = Math.max(-1, Math.min(1, (t.A + 10) / 50));
  return [fans[i], { r: [0, -lift - spread * out + 3 * amp * osc(u, cycles, -0.08 * i), 2.5 * amp * osc(u, cycles, 0.25 - 0.08 * i)] }];
}));
// the shards drift up and down and turn slowly round the fox
const drift = (u, amp = 1, cycles = 1) => ({ shards: { p: [0, 0, 0.8 * amp * osc(u, cycles)], r: [0, 0, 4 * amp * osc(u, cycles, 0.25)] } });

const base = quadrupedClips({
  face, hipH: 12, stride: 16,
  add: {
    idle: (t, u) => merge(fan(u, { cycles: 2 }), drift(u, 1, 1)),
    walk: (t, u) => merge(fan(u, { cycles: 1, amp: 1.6, lift: -4 }), drift(u, 0.6, 2)),
    idle_sniff: (t, u) => merge(fan(u, { cycles: 2, amp: 0.8 }), drift(u, 1, 1)),
    idle_shake: (t, u) => merge(fan(u, { cycles: 7, amp: 3.5 * win(u, 0.1, 0.8, 0.06) }), drift(u, 2, 3)),
    windup: (t, u) => fan(u, { cycles: 0, amp: 0, spread: 10 * smooth(u / 0.8), lift: 6 * smooth(u / 0.8) }),
    lunge: (t, u) => fan(u, { cycles: 0, amp: 0, spread: 10 - 14 * K(u, [[0.1, 0], [0.4, 1], [1, 0.3]]), lift: 6 }),
    hurt: (t, u) => merge(fan(u, { cycles: 2, amp: 2, spread: -8 * K(u, [[0, 0], [0.18, 1], [1, 0.5]]), lift: -10 * K(u, [[0, 0], [0.18, 1], [1, 0.4]]) }), drift(u, 2, 3)),
    recoil: (t, u) => fan(u, { cycles: 1, amp: 1.5, spread: -5 * K(u, [[0, 0], [0.4, 1], [1, 0]]) }),
    faint: (t, u) => { const d = smooth((u - 0.2) / 0.55); return merge(fan(u, { cycles: 0, amp: 0, spread: -12 * d, lift: -14 * d }), { shards: { p: [0, 0, -2 * K(u, [[0.2, 0], [0.9, 1]])] } }); },
    celebrate: (t, u) => merge(fan(u, { cycles: 2, amp: 2.5, spread: 14 * win(u, 0, 1, 0.15), lift: 6 }), drift(u, 2, 2)),
    enter: (t, u) => fan(u, { cycles: 0, amp: 0, spread: -14 * (1 - smooth(u / 0.6)) + 8 * win(u, 0.5, 0.9, 0.12) }),
    exit: (t, u) => fan(u, { cycles: 1, amp: 1.5, spread: -10 * smooth(u / 0.85) }),
  },
});
const { idle_wag: _wag, ...clips0 } = base;

const clips = {
  ...clips0,
  // fidget: the shards circle the fox once while it watches them go round, eyes half closed, the fan spread high
  idle_aurora: {
    seconds: 3.2,
    pose: (t, u) => {
      const on = win(u, 0.05, 0.92, 0.12);
      const spin = K(u, [[0.05, 0], [0.9, 360]]);
      return merge({
        shards: { r: [0, 0, spin], p: [0, 0, 1.4 * on] },
        head: { r: [-8 * on, 0, 22 * Math.sin((TAU * spin) / 360)] },
        body: { r: [0, 0, 6 * Math.sin((TAU * spin) / 360)] },
        ...face.pose('open', 0.45 * on),
      }, fan(u, { cycles: 2, amp: 1, spread: 10 * on, lift: 5 * on }));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
