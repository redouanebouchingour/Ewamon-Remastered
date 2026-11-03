// Chrysotox's rig: a hulking gorilla-shaped golem shingled with long hanging fibre strands, its head sunk between two
// fans of up-swept strands on the shoulders, huge arms hanging to the ground on hooked fingers. The beard and the dark
// maw under it drop as a jaw; the angry violet eyes blink with eyeKit lids. Numbers are scad/chrysotox.scad's: the
// strand lists below repeat its coat() / coatLimb() / leaf() loops, so each strand rides the part it is rooted on.
import { K, TAU, both, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, ell, inFrame, limb, mx, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { subFrame } from './lib/geo.mjs';

const D = Math.PI / 180;
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, k) => a.map((v) => v * k);
const nz = (v) => mul(v, 1 / Math.hypot(...v));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// ---- the scad's strand helpers, as [p0, p1, w] lists
const eS = (c, r, az, el, k = 1) => add(c, mul([r[0] * Math.cos(el * D) * Math.cos(az * D), r[1] * Math.cos(el * D) * Math.sin(az * D), r[2] * Math.sin(el * D)], k));
const eN = (r, az, el) => nz([Math.cos(el * D) * Math.cos(az * D) / r[0], Math.cos(el * D) * Math.sin(az * D) / r[1], Math.sin(el * D) / r[2]]);
const shag = (c, r, list, lift = 1.4) => list.map(([az, el, az1, el1, w]) => [eS(c, r, az, el, 0.96), add(eS(c, r, az1, el1), mul(eN(r, az1, el1), lift)), w]);
const coat = (c, r, rows, az0 = -180, az1 = 180, lift = 1.4, azk = 1) => shag(c, r, rows.flatMap((row, k) =>
  Array.from({ length: row[1] }, (_, i) => { const az = az0 + (i + (k % 2 === 0 ? 0.5 : 1)) * (az1 - az0) / row[1]; return [az, row[0], az * azk, row[0] - row[2], row[3]]; })), lift);
const coatLimb = (A, B, r, rows) => {
  const ax = nz(sub(B, A));
  const e1 = nz(cross(ax, [0, 1, 0]));
  const e2 = cross(ax, e1);
  return rows.flatMap((row, k) => Array.from({ length: row[1] }, (_, i) => {
    const ph = (i + (k % 2) * 0.5) * 360 / row[1] * D;
    const rad = add(mul(e1, Math.cos(ph)), mul(e2, Math.sin(ph)));
    const p0 = add(add(A, mul(sub(B, A), row[0])), mul(rad, r * 0.95));
    return [p0, add(add(p0, mul(ax, row[2])), mul(rad, row[4])), row[3]];
  }));
};
// a strand tested as a capsule along its spine
const strands = (list) => any(...list.map(([p0, p1, w]) => limb(p0, p1, w * 0.45, 0.35)));

// ---- torso and shoulders
const CH = [0, 0.5, 22.5]; const CHR = [9, 7.5, 7];
const BE = [0, 0, 15]; const BER = [7.2, 6.2, 5];
const CHEST = [[70, 4, 55, 3.6], [42, 7, 55, 3.2], [14, 7, 55, 3.2], [-14, 7, 45, 3.2]];
const BACK = [[70, 5, 55, 3.6], [42, 6, 55, 3.6], [14, 6, 55, 3.4], [-14, 6, 45, 3.4]];
const SH = [10.5, 0.5, 27.5]; const SHR = [5.2, 5.2, 4.4];
const FAN = [[8, 8.5], [30, 9.2], [54, 8.8], [80, 7.6], [106, 6.4]];
const fan = [0, 1, 2].flatMap((l) => FAN.map(([a0, L0], k) => {
  const y = (l - 1) * 3.4; const a = (a0 + (l === 1 ? 6 : 0)) * D; const L = L0 - Math.abs(l - 1) * 1.2;
  const p0 = [8.2 + k * 0.4, y, 26.2];
  return [p0, add(p0, [Math.sin(a) * L, y * 0.45, Math.cos(a) * L]), 3.2];
}));
const bodyTest = any(ell(CHR, CH), ell(BER, BE), strands(coat(CH, CHR, CHEST, -180, 0)), strands(coat(CH, CHR, BACK, 0, 180)),
  strands(coat(BE, BER, [[5, 9, 55, 3.8], [-30, 6, 40, 3.6]])),
  mx(any(ell(SHR, SH), strands(fan), strands(coat(SH, SHR, [[40, 7, 55, 3.4], [-10, 8, 45, 3.2]], -180, 180, 1.2)))));

// ---- the head block: translate(HC) rotate([0, 0, HEAD_YAW])
const HC = [0, -7.5, 32];
const HEAD_YAW = 25;
const hf = subFrame(HC, [0, 0, HEAD_YAW]);
const EYE = [2.15, -3.75, -1.9];
const L2 = (p0, p1, w) => [p0, p1, w];
const crown = [
  ...[-3, -2, -1, 0, 1, 2, 3].map((k) => { const a = k * 22 * D; const e = 1 - Math.abs(k) * 0.06;
    return L2([k * 0.4, -4.1, -0.8], [Math.sin(a) * 4.8 * e, -0.8 + Math.abs(k) * 0.9, 1.2 + Math.cos(a) * 5.6 * e], 2.4); }),
  ...[-2, -1, 0, 1, 2].map((k) => { const a = k * 30 * D; return L2([k * 1.2, -1, 2.5], [Math.sin(a) * 4.2, 2.6, 2 + Math.cos(a) * 4.4], 2.6); }),
  ...[1, -1].flatMap((s) => [L2([3.4 * s, -2.2, 0.4], [5.6 * s, 2.2, 3.2], 2.4), L2([3.4 * s, -2, -2], [5.8 * s, 2, -1], 2.4)]),
  ...shag([0, 0, 0], [4.4, 4.2, 4.3], [...[10, 50, 90, 130, 170].map((az) => [az, 35, az, -15, 3]), ...[30, 90, 150].map((az) => [az, 75, az, 30, 3]), ...[0, 45, 90, 135, 180].map((az) => [az, 55, az, 5, 2.8])]),
];
const beard = [
  ...[1, -1].flatMap((s) => [0.6, 2].map((x) => L2([x * s, -4.3, -2.9], [(x + 0.2) * s, -4.5, -4.3], 1))),
  ...[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((k) => { const x = k * 0.85; const a = Math.abs(k);
    return L2([x, -3.8 + a * 0.12, -3], [x * 1.12, -4.6 + a * 0.22, -7.3 + a * 0.35], k % 2 === 0 ? 1 : 0.75); }),
  ...[1, -1].map((s) => L2([3 * s, -2.6, -2.2], [3.7 * s, -3.2, -6.6], 1.8)),
];
const headTest = inFrame(hf, any(ell([4.4, 4.2, 4.3]), ell([3.9, 2.1, 3.2], [0, -2.4, -1.5]), strands(crown),
  ...[1, -1].map((s) => ell([1.6, 1.2, 1.4], [EYE[0] * s, EYE[1], EYE[2]]))));
const jawTest = inFrame(hf, any(ell([2.6, 1, 1.5], [0, -3.6, -3.7]), strands(beard)));

// ---- the eyes: eye(EYE, 1.1, yaw = 18) inside the head block, mirrored
const eyeL = { side: 'L', at: EYE, size: 1.1, yaw: 18, frame: hf };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.6, 0.58, 0.52], lid: [1.12, 1, 0.8] });

// ---- arms (the +X numbers; mirrored)
const S = [10.5, 0.5, 27.5]; const E = [12.7, -3, 16]; const W = [16, -4.5, 8.5]; const F = [16.3, -5, 6.6];
const armTest = any(limb(S, E, 3.6, 3.3), strands(coatLimb(S, E, 3.5, [[0.2, 5, 6, 3.4, 1.6], [0.6, 5, 5.5, 3.4, 1.8]])));
const foreTest = any(limb(E, W, 3.8, 3.4), ell([4.4, 4.3, 4.5], [14.6, -3.9, 12.2]),
  strands(coatLimb(E, W, 4.3, [[-0.2, 6, 6.5, 3.8, 1.8], [0.25, 6, 6.5, 3.8, 2], [0.7, 6, 4.5, 3.4, 1.8]])),
  strands([0, 1, 2].map((k) => L2(add(E, [2, -1.5 + k * 1.8, 1 + k * 0.5]), add(E, [5.2 + k * 0.6, -1.5 + k * 2.4, 7.5 - k * 1.8]), 2.8))));
const fingers = [-50, -15, 20, 55].map((a) => { const dx = Math.sin(a * D); const dy = -Math.cos(a * D);
  return [add(F, [dx * 2.2, dy * 2.2, -1.2]), add(F, [dx * 3.2, dy * 3.2, -2.6]), add(F, [dx * 2.9, dy * 2.9 - 0.4, -3.6]), add(F, [dx * 2, dy * 2 - 0.6, -2.4])]; });
const handTest = any(ell([3.3, 3.3, 2.9], F), ...fingers.flatMap((p) => [limb(p[0], p[1], 0.85, 0.65), limb(p[1], p[2], 0.65, 0.4), limb(p[2], p[3], 0.4, 0.2)]));

// ---- legs
const H = [8, -0.5, 13]; const A = [8.3, -1.5, 3.8]; const FT = [8.3, -2.2, 1.8];
const legTest = any(limb(H, A, 4.4, 4.0), ell([3.8, 4.4, 1.8], FT),
  strands(coatLimb(add(H, [0, 0, 1]), A, 4.3, [[0, 6, 6.5, 3.8, 1.6], [0.5, 7, 5.5, 3.8, 2.4], [1.02, 7, 3.4, 3.4, 2.2]])),
  strands([-1, 0, 1].map((k) => L2(add(FT, [k * 2, -2.5, 1.6]), add(FT, [k * 2.8, -6.6, -1.3]), 2.8))));

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', H),
  { name: 'body', parent: 'root', at: [0, 0.5, 13] },
  { name: 'head', parent: 'body', at: [0, -5, 29] },
  { name: 'jaw', parent: 'head', at: hf.world([0, -2.2, -2.8]) },
  ...pair('arm*', 'body', S),
  ...pair('fore*', 'arm*', E),
  ...pair('hand*', 'fore*', W),
  ...face.joints,
];

const parts = [
  ['body', bodyTest],
  ['head', headTest],
  ['jaw', jawTest],
  ['arm*', armTest],
  ['fore*', foreTest],
  ['hand*', handTest],
  ['leg*', legTest],
];

const assign = (c) => pick(c, parts);

const base = bipedClips({
  face, hipH: 13, stride: 12, armSwing: 9, hopScale: 0,
  punch: { arm: [-70, 0, -20], fore: [-30, 0, 0] },
  cheer: { arm: [-10, -90, 0], fore: [-20, 0, 0] },
  add: {
    // the arms are long: the template's hanging-arm idle lifts them a touch more so the claws clear the ground
    idle: (t, u) => both('hand', { r: [-3 * osc(u, 2, 0.3), 0, 0] }),
    walk: (t, u) => both('hand', { r: [-6, 0, 0] }),
  },
});

const clips = {
  ...base,

  // fidget: a toxic exhale. The chest heaves, the head tips back, the jaw hangs open, then it slumps with a shudder
  idle_exhale: {
    seconds: 2.8,
    pose: (t, u) => {
      const inh = K(u, [[0, 0], [0.3, 1], [0.45, 1], [0.7, 0]]);
      const out = win(u, 0.42, 0.75, 0.08);
      const sh = Math.sin(TAU * 9 * u) * win(u, 0.72, 0.9, 0.04);
      return {
        body: { p: [0, 0, 0.5 * inh], r: [-6 * inh + 4 * out, 0, sh], s: [1 + 0.03 * inh, 1 + 0.04 * inh, 1] },
        head: { r: [-14 * inh + 6 * out, 0, 0] },
        jaw: { r: [22 * out, 0, 0] },
        ...both('arm', { r: [4 * out, -6 * inh, 0] }),
        ...both('fore', { r: [-6 * inh, 0, 0] }),
        ...face.pose('open', Math.max(0.55 * out, blinks(u, [[0.86, 0.92]]))),
      };
    },
  },

  // fidget: rakes one great claw along the ground beside it, head turned to watch the furrow
  idle_rake: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = win(u, 0.08, 0.88, 0.12);
      const rake = K(u, [[0, 0], [0.2, -1], [0.62, 1], [0.85, 0]]);
      return {
        body: { r: [4 * on, 0, -8 * on] },
        head: { r: [10 * on, 0, 22 * on] },
        armL: { r: [-18 * rake, -12 * on, 0] },
        foreL: { r: [-10 * on, 0, 0] },
        handL: { r: [-14 * on + 10 * smooth((u - 0.2) / 0.4) * on, 0, 0] },
        jaw: { r: [6 * on, 0, 0] },
        ...face.pose('open', blinks(u, [[0.3, 0.36]])),
      };
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
