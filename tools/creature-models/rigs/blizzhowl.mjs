// Blizzhowl's rig: a fluffy white arctic fox on long navy-socked legs, a big feathery ice ruff (on the body), a fox
// head turned a little to its right with sly slanted eyes and an open howling mouth (the lower jaw on its own joint),
// tall ears and a peacock fan of eight soft pillow tails, each on its own joint off the body so the fan sways out of
// phase, spreads and folds. Numbers are scad/blizzhowl.scad's.
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, blob, ell, limb } from './lib/biped.mjs';
import { eyeKit } from './lib/face.mjs';
import { closest, ellD, isAny, near, subFrame } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const FUR = [0.98, 0.99, 1];
const SHADE = [0.80, 0.87, 0.99];
const RUFF = [[0.60, 0.84, 0.99], [0.33, 0.78, 0.97]];
const TAIL = [[0.50, 0.62, 0.95], [0.86, 0.9, 1], [0.94, 0.97, 1]];
const EAR_IN = [0.25, 0.38, 0.85];
const PAW = [0.13, 0.16, 0.55];
const TONGUE = [0.96, 0.46, 0.52];
const D = Math.PI / 180;
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const fold = (c) => [Math.abs(c[0]), c[1], c[2]];
// the scad's tuft(p, d, w): a leaf from p along d, w wide
const tuft = (p, d, w) => limb(p, add3(p, d), w * 0.7, 0.3);

// ---- the head block: translate(HC) rotate([0, 0, HEAD_YAW])
const HC = [0, -11.5, 28.4];
const HEAD_YAW = -8;
const hf = subFrame(HC, [0, 0, HEAD_YAW]);
const inHead = (test) => (c) => test(hf.local(c));
const inHeadMx = (test) => (c) => test(fold(hf.local(c)));

// the sly eyes: foxEye(EYE, 1.9, ±22, ∓14) inside the head block, so each eye's frame is rotate([0, tilt, yaw + HEAD_YAW])
const EYE = [3.4, -4.5, -0.8];
const eyeAt = (s) => hf.world([s * EYE[0], EYE[1], EYE[2]]);
const eyes = [
  { side: 'L', at: [0, 0, 0], size: 1.9, flat: 0.45, squash: 0.72, frame: subFrame(eyeAt(1), [0, -14, 22 + HEAD_YAW]) },
  { side: 'R', at: [0, 0, 0], size: 1.9, flat: 0.45, squash: 0.72, frame: subFrame(eyeAt(-1), [0, 14, -22 + HEAD_YAW]) },
];
const face = eyeKit({ eyes, skin: FUR, lid: [1.12, 1, 0.55] });

// ---- the tails: the scad's TAILS ([sheet angle, sheet length, width]) and tailYaw / tailPitch / tailLen
const ROOT = [0, 13.5, 15.5];
const FAN_YAW = 45;
const TAILS = [[92, 21, 8], [76, 22, 8.5], [61, 23, 9], [46, 22.5, 9], [29, 22.3, 9], [10, 20, 8.5], [-7, 21, 8], [-32, 18, 7.5]]
  .map(([A, L, w], i) => {
    const yaw = FAN_YAW + (i % 2 === 0 ? -10 : 10);
    const proj = Math.cos(yaw * D) * 0.866 + Math.sin(yaw * D) * 0.5;
    const pitch = Math.atan2(Math.sin(A * D), Math.cos(A * D) / proj) / D;
    const len = L / Math.hypot(proj * Math.cos(pitch * D), Math.sin(pitch * D));
    return { A, len, w, yaw, frame: subFrame(ROOT, [0, -pitch, yaw]) };
  });
const fans = TAILS.map((_, i) => `fan${i + 1}`);

// ---- the legs: the scad's LEGS ([hip, knee, foot])
const LEGS = {
  legFL: [[3.4, -9, 12.5], [4.4, -12.8, 8.6], [5.2, -15.8, 1.1]],
  legFR: [[-3.4, -9, 12.5], [-5, -14.4, 8.6], [-6.2, -19.2, 1.1]],
  legBL: [[3.6, 7, 12.5], [4.2, 11.8, 8.2], [4.6, 14.5, 1.1]],
  legBR: [[-3.6, 7, 12.5], [-4.1, 9.1, 8.2], [-4.6, 9.5, 1.1]],
};
const legTest = ([hip, knee, foot]) => any(limb(hip, knee, 2.4, 1.9), limb(knee, add3(foot, [0, 0, 0.2]), 1.5, 1.4),
  ell([2.1, 2.7, 1.25], add3(foot, [0, -0.6, -0.1])), ell([2.4, 2.4, 2.4], add3(knee, [0, -0.2, -0.4])));

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...Object.entries(LEGS).map(([name, [hip]]) => ({ name, parent: 'root', at: hip })),
  { name: 'body', parent: 'root', at: [0, 0, 12] },
  { name: 'head', parent: 'body', at: [0, -11, 24] },
  { name: 'jaw', parent: 'head', at: hf.world([0, -3, -4.6]) },
  { name: 'earL', parent: 'head', at: hf.world([4.6, -0.3, 3.8]) },
  { name: 'earR', parent: 'head', at: hf.world([-4.6, -0.3, 3.8]) },
  ...TAILS.map((t, i) => ({ name: fans[i], parent: 'body', at: ROOT, rot: [0, 0, t.yaw] })),
  ...face.joints,
];

const headTest = any(
  inHead(any(ell([6.2, 5.8, 5.4], [0, 0, 0.3]), ell([5.2, 4.2, 3.2], [0, -2.2, -3]),
    blob([[[3.2, 2.6, 2.3], [0, -4.8, -2.4]], [[0.9, 0.9, 0.8], [0, -7.9, -3.1]]]), tuft([0, -1.5, 5.2], [0, -0.6, 2], 1))),
  inHeadMx(any(tuft([4.6, -2.6, -2.6], [2.6, 0.8, -1.6], 1.3), tuft([5.4, -0.6, -1.2], [2.8, 1.2, -0.6], 1.3),
    tuft([4.2, -3.8, -4], [1.6, 0, -2.2], 1.1), tuft([5.2, 1.5, -2], [2.2, 1.6, -1.4], 1.2), tuft([1.8, 0, 5.3], [0.6, 0.2, 1.8], 0.9),
    limb([0.9, -7, -3.7], [0.9, -7, -4.5], 0.4), ell([2.1, 1.2, 1.5], EYE))),
);
const jawTest = inHead(blob([[[2.2, 1.8, 1], [0, -3.8, -5.9]], [[0.7, 0.6, 0.45], [0, -7.4, -6.2]]]));
const earTest = (s) => (c) => {
  const p = hf.local(c);
  if (Math.sign(p[0]) !== s) return Infinity;
  return any(limb([4.6, -0.3, 3.8], [7, -0.8, 11.8], 2.9, 0.4), tuft([6.9, -0.5, 5], [2.4, 0.3, 3.4], 1.1),
    tuft([7.4, -0.3, 3], [3, 0.6, 1.4], 1))(fold(p));
};
const RC = [0, -11.5, 20.8];
const bodyTest = any(blob([[[6.2, 6.5, 6.5], [0, -8, 14]], [[5.6, 6, 5.8], [0, 7, 14.5]]]), ell([4.6, 9, 2.4], [0, 0, 9]), ell([3.4, 3.4, 3.4], ROOT),
  ell([7.8, 6.4, 4.8], RC), (c) => any(ell([3.6, 5, 5], [3.6, 8, 12.5]), tuft([6, 10, 10.5], [0.6, 1.8, -2.6], 1.4), tuft([5.4, -4, 14], [1.2, 2, -2.6], 2),
    tuft([5.4, 2, 14], [1.2, 2, -2.6], 2))(fold(c)),
  ...[[-3, -10], [0, -11], [3, -10], [-3.5, -4], [3.5, -4], [-3.5, 2], [3.5, 2]].map(([x, y]) => tuft([x, y, 9], [x * 0.2, -0.8, -2.8], 1.5)));
// a tail in its own frame: the paddle and its tip
const tailTest = (t) => (c) => {
  const p = t.frame.local(c);
  return Math.min(ellD(p, [t.len * 0.56, 2.2, t.w * 0.62], [t.len * 0.52, 0, 0]), ellD(p, [t.len * 0.2, 1.8, t.w * 0.3], [t.len * 0.88, 0, 0]));
};
const legParts = Object.entries(LEGS).map(([name, l]) => [name, legTest(l)]);
const tailParts = TAILS.map((t, i) => [fans[i], tailTest(t)]);
const EYES_W = [eyeAt(1), eyeAt(-1)];

function assign(c, rgb) {
  if (isAny(rgb, TAIL, 0.015)) return closest(tailParts.map(([n, t]) => [n, t(c)]));
  if (near(rgb, PAW, 0.03) && c[2] < 12) return closest(legParts.map(([n, t]) => [n, t(c)]));
  if (near(rgb, EAR_IN, 0.03)) return hf.local(c)[0] > 0 ? 'earL' : 'earR';
  if (near(rgb, TONGUE, 0.03)) return 'jaw';
  if (isAny(rgb, RUFF, 0.025)) {
    // the ears' ice tufts, the eyes' blue crescent (the same cyan) and the ruff, which rides the body
    if (EYES_W.some((e) => ellD(c, [2.2, 2.2, 2.2], e) < 1)) return 'head';
    if (c[2] > 29.5) return hf.local(c)[0] > 0 ? 'earL' : 'earR';
    return 'body';
  }
  if (near(rgb, FUR, 0.02) || near(rgb, SHADE, 0.025)) {
    return closest([['head', headTest(c)], ['jaw', jawTest(c)], ['earL', earTest(1)(c)], ['earR', earTest(-1)(c)], ['body', bodyTest(c)],
      ...legParts.map(([n, t]) => [n, t(c)]), ...tailParts.map(([n, t]) => [n, t(c) + 0.15])]);
  }
  return 'head';   // eyes, nose, the red mouth
}

// the fan in each tail's own frame (local X along the tail's yaw, local Y the fan's normal): ry turns a tail within
// its plane (> 0 lowers it), rz swings it out of it. `spread` opens the fan from its middle (about 35 degrees up),
// `lift` raises every tail, `amp` / `cycles` sway each tail a little later than the one above it.
const fan = (u, { cycles = 1, amp = 1, spread = 0, lift = 0 } = {}) => Object.fromEntries(TAILS.map((t, i) => {
  const out = Math.max(-1, Math.min(1, (t.A - 35) / 45));
  return [fans[i], { r: [0, -lift - spread * out + 3 * amp * osc(u, cycles, -0.08 * i), 2.5 * amp * osc(u, cycles, 0.25 - 0.08 * i)] }];
}));

const base = quadrupedClips({
  face, hipH: 12, stride: 16,
  add: {
    idle: (t, u) => fan(u, { cycles: 2 }),
    walk: (t, u) => fan(u, { cycles: 1, amp: 1.6, lift: -4 }),
    idle_sniff: (t, u) => fan(u, { cycles: 2, amp: 0.8 }),
    idle_shake: (t, u) => fan(u, { cycles: 7, amp: 3.5 * win(u, 0.1, 0.8, 0.06) }),
    windup: (t, u) => fan(u, { cycles: 0, amp: 0, spread: 10 * smooth(u / 0.8), lift: 6 * smooth(u / 0.8) }),
    lunge: (t, u) => fan(u, { cycles: 0, amp: 0, spread: 10 - 14 * K(u, [[0.1, 0], [0.4, 1], [1, 0.3]]), lift: 6 }),
    hurt: (t, u) => fan(u, { cycles: 2, amp: 2, spread: -8 * K(u, [[0, 0], [0.18, 1], [1, 0.5]]), lift: -10 * K(u, [[0, 0], [0.18, 1], [1, 0.4]]) }),
    recoil: (t, u) => fan(u, { cycles: 1, amp: 1.5, spread: -5 * K(u, [[0, 0], [0.4, 1], [1, 0]]) }),
    faint: (t, u) => { const d = smooth((u - 0.2) / 0.55); return fan(u, { cycles: 0, amp: 0, spread: -12 * d, lift: -14 * d }); },
    celebrate: (t, u) => fan(u, { cycles: 2, amp: 2.5, spread: 14 * win(u, 0, 1, 0.15), lift: 6 }),
    enter: (t, u) => fan(u, { cycles: 0, amp: 0, spread: -14 * (1 - smooth(u / 0.6)) + 8 * win(u, 0.5, 0.9, 0.12) }),
    exit: (t, u) => fan(u, { cycles: 1, amp: 1.5, spread: -10 * smooth(u / 0.85) }),
  },
});
const { idle_wag: _wag, ...clips0 } = base;

const clips = {
  ...clips0,
  // fidget: sits back a little, points its nose at the sky and howls, the jaw wide and the fan spread high
  idle_howl: {
    seconds: 2.8,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.2, 1], [0.78, 1], [0.95, 0]]);
      const wob = Math.sin(TAU * 5 * u) * win(u, 0.25, 0.75, 0.05);
      return merge({
        body: { r: [-8 * up, 0, 0] },
        head: { r: [-34 * up + 1.5 * wob, 0, 0] },
        jaw: { r: [16 * up + 2 * wob, 0, 0] },
        earL: { r: [-10 * up, 0, 0] },
        earR: { r: [-10 * up, 0, 0] },
        ...face.pose(up > 0.5 ? 'shut' : 'open'),
      }, fan(u, { cycles: 2, amp: 1, spread: 12 * up, lift: 6 * up }));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
