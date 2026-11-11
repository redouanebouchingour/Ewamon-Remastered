// Toxshade's rig: a huge hunched black rat-beast. Long arms (the near one hanging at its chest, the far one reaching
// forward), the head thrust out low with a dropped jaw that drools, smoke tendrils streaming off its back and a bare
// tail rising in a hook behind. Numbers are scad/toxshade.scad's, authored in sheet z and dropped by G; the head block
// is `translate(HC) rotate(HROT) scale(HS)` (HF). The Majin form imports the pieces below.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, chain, ell, inFrame, limb, mx, petal, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near, subFrame } from './lib/geo.mjs';

export const G = 3;
const S = ([x, y, z]) => [x, y, z - G];
const F = subFrame([0, 0, -G]);
export const sh = (test) => inFrame(F, test);

export const FURS = [[0.28, 0.29, 0.33], [0.44, 0.46, 0.49], [0.16, 0.16, 0.2]];
const SKIN = [0.36, 0.3, 0.36];
const CLAW = [0.36, 0.22, 0.46];
const RING = [0.25, 0.22, 0.27];
const MOUTH = [0.2, 0.07, 0.17];

export const HC = [-2.7, -14.5, 26.5];
const HROT = [16, 0, 6];
export const HF = subFrame(S(HC), HROT, 1.42);
const inHead = (test) => inFrame(HF, test);
const hw = (p) => [...HF.world(p).slice(0, 2), HF.world(p)[2] + G];   // a head point in sheet z

// the body ellipsoids and the fur locks laid on them (lock() in the scad)
const HUMP = [[9.5, 8.5, 11], [0, 3, 25.5]];
const SHOULDER = [[8.5, 7, 8], [0, -4, 29]];
const RUMP = [[9.5, 9, 9], [0, 6, 13]];
const CHEST = [[7.5, 6, 9], [0, -5, 18]];
const BELLY = [[8.5, 8, 4.5], [0, 2, 8.5]];
const BODY = [HUMP, SHOULDER, RUMP, CHEST, BELLY];
export const HAUNCH = [[6.5, 7.5, 8.5], [7, 7, 13]];
const LC = [0, 1, 20];
const DEG = Math.PI / 180;
const rayT = (d, [r, c]) => {
  const q = [0, 1, 2].map((i) => (LC[i] - c[i]) / r[i]); const v = [0, 1, 2].map((i) => d[i] / r[i]);
  const a = v[0] ** 2 + v[1] ** 2 + v[2] ** 2; const b = 2 * (q[0] * v[0] + q[1] * v[1] + q[2] * v[2]); const cc = q[0] ** 2 + q[1] ** 2 + q[2] ** 2 - 1;
  const D = b * b - 4 * a * cc;
  return D < 0 ? -1 : (-b + Math.sqrt(D)) / (2 * a);
};
const dirOf = (az, el) => [Math.cos(el * DEG) * Math.sin(az * DEG), -Math.cos(el * DEG) * Math.cos(az * DEG), Math.sin(el * DEG)];
const onBody = (az, el, out = 0) => { const d = dirOf(az, el); const t = Math.max(...BODY.map((e) => rayT(d, e))) + out; return LC.map((v, i) => v + d[i] * t); };
const LOCKS = [];
for (let r = 0; r < 6; r++) {
  for (let i = 0; i < 14; i++) {
    const az = -180 + (i * 360) / 14 + ((r % 2) * 180) / 14; const el = 70 - r * 18; const len = 4.8;
    const p = onBody(az, el, -0.3);
    const el2 = el - (len / Math.hypot(p[0] - LC[0], p[1] - LC[1], p[2] - LC[2])) / DEG;
    LOCKS.push(limb(p, onBody(az, el2, 1), 1.3, 0.7));
  }
}
const onEll = ([r, c], az, el, k = 1) => [c[0] + r[0] * k * Math.cos(el * DEG) * Math.sin(az * DEG), c[1] - r[1] * k * Math.cos(el * DEG) * Math.cos(az * DEG), c[2] + r[2] * k * Math.sin(el * DEG)];
const HLOCKS = [];
for (let r = 0; r < 3; r++) {
  for (let i = 0; i < 5; i++) {
    const az = -10 + i * 40 + r * 20; const el = 50 - r * 32;
    HLOCKS.push(limb(onEll(HAUNCH, az, el, 0.97), onEll(HAUNCH, az, Math.max(-80, el - (3.6 / HAUNCH[0][2]) / DEG), 1.06), 1.4, 0.7));
  }
}

export const TAIL = [[1.5, 12, 11], [2.5, 16.5, 6], [3.2, 20.5, 4.4], [3.8, 23.5, 7], [3.8, 24.3, 12], [3.6, 24, 16.5], [3.8, 24, 20.5],
  [4.6, 24.6, 23.2], [5.5, 25.2, 23.3], [6, 25.6, 21.8], [5.8, 25.4, 20.4]];
const TAIL_R = [1.3, 1.1, 0.95, 0.85, 0.75, 0.68, 0.6, 0.52, 0.45, 0.38, 0.3];
export const tails = ['tail1', 'tail2', 'tail3', 'tail4'];

export const TENDRILS = [
  [[0, -6, 31], [-0.8, -8, 34.2], [0.6, -9.2, 36.4], [-0.2, -10.6, 38]],
  [[1, -1, 34], [0, -2.2, 37.2], [1.4, -3, 39.2], [0.6, -4.4, 40.6]],
  [[-2, 5, 35], [-0.8, 6, 38.2], [0.8, 6.8, 40], [0, 8.4, 41.2]],
  [[2, 10, 33.5], [3, 12, 36.2], [2.2, 13.6, 37.8], [3.4, 15.6, 39]],
  [[3, 13, 30], [4.4, 15, 32.8], [3.6, 16.8, 34.2], [5, 18.6, 35.6]],
  [[3, 15, 24], [4, 17.6, 26.8], [3.2, 19.4, 28.4], [4.6, 21, 30]],
  [[-7, -7, 28], [-9.6, -8.2, 30], [-10.4, -9.4, 32.2], [-12, -9.6, 34]],
  [[-8, -5, 22], [-10.8, -6.8, 23.6], [-11.8, -8, 26], [-13.4, -8.4, 28.6]],
  [[-4, -2, 33], [-5.8, -2.8, 35.8], [-5, -4, 37.8], [-6.6, -4.8, 39.4]],
  [[7.5, 2, 30], [10, 2.6, 32.6], [9.6, 3.4, 34.6], [11.2, 4.2, 36]],
  [[-7.5, 6, 30], [-10, 6.6, 32.6], [-9.6, 7.4, 34.6], [-11.2, 8.2, 36]],
  [[4, 4, 34], [5.4, 5, 37], [4.6, 6, 39.2], [6, 7.2, 40.4]],
  [[-4, 9, 32], [-5.2, 10.6, 35], [-4.4, 12, 37], [-5.8, 13.6, 38.2]],
  [[5, -6, 29], [7, -7.2, 32], [6.4, -8.4, 34], [8, -9.2, 35.4]],
  [[0, 12, 28], [0.8, 14.4, 31], [-0.4, 16.2, 33], [0.8, 18, 34.2]],
];
const TR = [1.15, 0.75, 0.45, 0.2];

const eyeL = { side: 'L', at: [3.2, -3.9, 0.9], size: 1.45, yaw: 40, flat: 0.5, frame: HF };
export const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FURS[2] });

// the arms differ: the near (L, +X) one hangs at the chest, the far (R) one reaches forward
const ARM_L = [[6.5, -6, 25], [7.5, -10, 18], [5, -13, 14.5]];
const ARM_R = [[-6.5, -6, 25.5], [-8.4, -12, 20.5], [-7, -18.5, 18]];
const fingers = (palm, at, d1, d2, cd, r) => [-1.5, -0.5, 0.5, 1.5].flatMap((k) => {
  const b = [at[0] + 0.85 * k, at[1], at[2]];
  const p1 = [b[0] + d1[0] * k, b[1] + d1[1], b[2] + d1[2]]; const p2 = [b[0] + d2[0] * k, b[1] + d2[1], b[2] + d2[2]];
  return [limb(b, p1, r, r * 0.8), limb(p1, p2, r * 0.8, r * 0.6), limb(p2, [p2[0] + cd[0] * k, p2[1] + cd[1], p2[2] + cd[2]], 0.3, 0.15)];
});

export const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...['L', 'R'].map((s) => ({ name: `leg${s}`, parent: 'root', at: S([s === 'L' ? 7 : -7, 7, 13]) })),
  { name: 'body', parent: 'root', at: S([0, 4, 12]) },
  { name: 'head', parent: 'body', at: S([-1.6, -10, 26]) },
  { name: 'jaw', parent: 'head', at: HF.world([0, -3, -2.6]) },
  { name: 'armL', parent: 'body', at: S(ARM_L[0]) }, { name: 'foreL', parent: 'armL', at: S(ARM_L[1]) }, { name: 'handL', parent: 'foreL', at: S(ARM_L[2]) },
  { name: 'armR', parent: 'body', at: S(ARM_R[0]) }, { name: 'foreR', parent: 'armR', at: S(ARM_R[1]) }, { name: 'handR', parent: 'foreR', at: S(ARM_R[2]) },
  { name: 'tail1', parent: 'body', at: S(TAIL[0]) },
  { name: 'tail2', parent: 'tail1', at: S(TAIL[3]) },
  { name: 'tail3', parent: 'tail2', at: S(TAIL[5]) },
  { name: 'tail4', parent: 'tail3', at: S(TAIL[7]) },
  ...face.joints,
];

export const parts = [
  ['body', sh(any(...BODY.map(([r, c]) => ell(r, c)), ell([5.5, 6, 5.5], [-1.6, -10, 26]), ...LOCKS,
    ...TENDRILS.flatMap((t) => t.slice(1).map((p, i) => limb(t[i], p, TR[i], TR[i + 1])))))],
  ['head', inHead(any(ell([5, 5, 4.5]), ell([3.5, 3.6, 2.9], [0, -5.8, -1]), ell([1.8, 1.6, 1.5], [0, -10.6, -1.8]),
    mx(petal([2.6, 0.75, 2.8], [4.5, 1.2, 4], [0, 28, 40])), mx(limb([4.2, -0.5, -1.2], [5.2, 1.2, -3.8], 1.3, 0.45)),
    mx(limb([3.9, -2.2, 2.3], [1.6, -6, 1.2], 1.3, 0.8)), mx(limb([1, -10.9, -1.1], [5.4, -12.3, -1.1], 0.3))))],
  ['jaw', inHead(any(limb([0, -4, -3.4], [0, -9.8, -3.5], 2.4, 1)))],
  ['armL', sh(limb(ARM_L[0], ARM_L[1], 3.2, 2.2))],
  ['foreL', sh(limb(ARM_L[1], ARM_L[2], 2.2, 1.6))],
  ['handL', sh(any(ell([1.8, 1.7, 1.5], [4.8, -13.6, 13.9]), ...fingers(null, [4.8, -14.6, 13.5], [0.25, -0.9, -1.6], [0.3, -1.1, -3.2], [0.1, 0.2, -1.4], 0.42),
    limb([4.2, -15.6, 9.1], [5.9, -15.8, 10.7], 0.4)))],
  ['armR', sh(limb(ARM_R[0], ARM_R[1], 3.2, 2.2))],
  ['foreR', sh(limb(ARM_R[1], ARM_R[2], 2.2, 1.6))],
  ['handR', sh(any(ell([1.9, 1.8, 1.4], [-7, -19.1, 17.8]), ...fingers(null, [-7, -20.3, 17.4], [0.3, -1.2, -1], [0.35, -1.4, -2.8], [0.1, 0.4, -1.5], 0.44),
    limb([-8.2, -22.1, 12.9], [-6.4, -22.1, 10.7], 0.6)))],
  ['leg*', sh(any(ell(...HAUNCH), limb([8, 9, 9], [8.6, 6, 5], 2.2, 1.6), ell([2.1, 4, 1.2], [9, 2, 1.4 + G]), ell([1.8, 1.6, 1.3], [9, 6, 1.7 + G]),
    limb([8.1, -1.6, 1.2 + G], [10.9, -3.4, 0.5 + G], 0.5), ...HLOCKS))],
  ...chain(['tail1', 'tail1', 'tail1', 'tail2', 'tail2', 'tail3', 'tail3', 'tail4', 'tail4', 'tail4'], TAIL, TAIL_R).map(([n, t]) => [n, sh(t)]),
];

/** assign() for the toxin colours (drool, drips, shards) and extra rules first. */
export const makeAssign = (TOX, rules = () => null) => (c, rgb) => {
  const r = rules(c, rgb);
  if (r) return r;
  const z = c[2] + G;   // sheet z
  if (isAny(rgb, TOX)) {
    const lip = hw([0, -8.6, -3.4]);
    if (c[1] < -16 && Math.hypot(c[0] - lip[0], c[1] - lip[1]) < 3.5 && z > 13) return 'jaw';   // drool
    if (c[1] < -14 && z < 14) return pick(c, parts.filter(([n]) => n.startsWith('hand')));        // claw drips
    return pick(c, parts);                                                                          // shards
  }
  if (near(rgb, MOUTH)) return 'jaw';
  if (!isAny(rgb, [...FURS, SKIN, CLAW, RING])) return 'head';   // eyes, nose, ears, fangs, whiskers
  return pick(c, parts);
};

export const jawK = (k) => ({ jaw: { r: [k, 0, 0] } });

export const clipsFor = ({ face: f = face, extra = {} } = {}) => {
  const base = bipedClips({
    face: f, tail: tails, hipH: 9.5, stride: 12, armSwing: 14, hopScale: 0.25, droop: 0.5,
    // a raking claw swipe from overhead
    punch: { arm: [-70, 10, 0], fore: [-40, 0, 0] },
    cheer: { arm: [-40, -60, 0], fore: [-40, 0, 0] },
    add: {
      ...extra,
      idle: (t, u) => merge(jawK(3 * osc(u, 2, 0.3)), extra.idle?.(t, u)),
      lunge: (t, u) => merge(jawK(20 * K(u, [[0.1, 0], [0.35, 1], [0.6, 0.3], [1, 0]])), extra.lunge?.(t, u)),
      hurt: (t, u) => merge(jawK(14 * K(u, [[0, 0], [0.2, 1], [1, 0.4]])), extra.hurt?.(t, u)),
      celebrate: (t, u) => merge(jawK(12 * win(u, 0, 1, 0.15)), extra.celebrate?.(t, u)),
    },
  });
  return {
    ...base,

    // fidget: it sniffs the air with quick snout twitches, then grins wide and drools
    idle_sniff: {
      seconds: 2.4,
      pose: (t, u) => {
        const up = K(u, [[0, 0], [0.12, 1], [0.5, 1], [0.6, 0]]);
        const tw = Math.sin(TAU * 10 * u) * win(u, 0.12, 0.48, 0.03);
        const grin = win(u, 0.6, 0.95, 0.08);
        return merge({
          head: { r: [-12 * up + 2 * tw, 0, 3 * tw] },
          ...jawK(16 * grin),
          ...f.pose('open', 0.4 * grin + blinks(u, [[0.3, 0.35]])),
          ...both('arm', { r: [3 * up, 0, 0] }),
        }, extra.idle_sniff?.(t, u));
      },
    },

    // fidget: it rakes the ground with one claw, twice, glaring at the camera side
    idle_rake: {
      seconds: 2.2,
      pose: (t, u) => {
        const on = K(u, [[0, 0], [0.1, 1], [0.8, 1], [0.95, 0]]);
        const rk = Math.max(0, Math.sin(TAU * 2 * (u - 0.15))) * win(u, 0.15, 0.75, 0.03);
        return merge({
          body: { r: [3 * on, 0, 4 * on] },
          head: { r: [4 * on, 0, 14 * on] },
          ...f.pose('open', 0.45 * on),
          armL: { r: [-20 * rk, 0, 0] }, foreL: { r: [-25 * rk + 20 * on, 0, 0] }, handL: { r: [30 * rk, 0, 0] },
        }, extra.idle_rake?.(t, u));
      },
    },
  };
};

export default rigDef({ joints, assign: makeAssign([[0.45, 0.22, 0.7], [0.62, 0.4, 0.86]]), extras: face.extras, clips: clipsFor() });
