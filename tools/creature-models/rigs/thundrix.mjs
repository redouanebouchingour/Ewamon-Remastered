// Thundrix's rig: a thunder eagle with its wings flung up in a V (an inner and an outer joint each: the outer one is
// the wrist with the primaries, the inner one the arm root, the white band and the low flight feathers), a swept crest
// on a golden head, a fanned tail and talons, the far one gripping a lightning bolt. Numbers are scad/thundrix.scad's.
// The wings are authored there in a sheet frame (u = sheet x, v = depth, w = z) stood in the scad by `WM`; the rig
// takes each point back to that frame to find the nearest feather.
import { K, TAU, both, merge, osc, rigDef, shake, smooth, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, capD, capsule, closest, ellD, fold, isAny, side } from './lib/geo.mjs';

const BOLT = [[0.39, 0.66, 0.89], [0.82, 0.96, 1], [0.98, 0.86, 0.4]];

// ---- the wing frame (scad WM): y = Y0 + S u + v, x = ((1 - S / 2) u - v / 2 - Y0 / 2) / cos 30
const Y0 = 1.0;
const S = 0.05;
const C30 = Math.cos(Math.PI / 6);
const toScad = ([u, v, w]) => [((1 - 0.5 * S) * u - 0.5 * v - 0.5 * Y0) / C30, S * u + v + Y0, w];
const toWing = (f) => { const u = C30 * f[0] + 0.5 * f[1]; return [u, f[1] - Y0 - S * u, f[2]]; };
const ARM0 = [2.0, 20.4];
const ARM1 = [13.5, 35.3];
const armT = ([u, w]) => {
  const a = [ARM1[0] - ARM0[0], ARM1[1] - ARM0[1]];
  return Math.min(1, Math.max(0, ((u - ARM0[0]) * a[0] + (w - ARM0[1]) * a[1]) / (a[0] ** 2 + a[1] ** 2)));
};
const ROWS = [
  [[12.8, 32.6], [15.8, 38.4], 2.0], [[13.3, 31.0], [18.0, 36.7], 2.0], [[13.6, 29.4], [19.1, 33.4], 2.0],
  [[13.6, 27.8], [19.6, 30.0], 2.0], [[13.2, 26.2], [19.3, 25.9], 2.0], [[12.6, 24.6], [18.0, 23.2], 2.0],
  [[11.7, 23.2], [16.4, 20.9], 1.9], [[10.7, 22.0], [14.5, 18.9], 1.9], [[9.7, 21.0], [12.8, 17.2], 1.9],
  [[8.6, 20.2], [11.0, 15.6], 1.8], [[7.4, 19.5], [8.9, 15.3], 1.8], [[6.1, 19.0], [6.6, 15.2], 1.8],
  [[4.8, 18.6], [4.5, 15.5], 1.7],
];
const WHITES = [
  [[9.6, 29.8], [13.0, 28.4]], [[8.6, 28.4], [12.8, 26.7]], [[7.6, 27.0], [12.2, 25.1]], [[6.6, 25.6], [11.4, 23.6]],
  [[5.6, 24.2], [10.4, 22.2]], [[4.6, 22.8], [9.2, 21.0]], [[3.6, 21.5], [7.8, 20.0]], [[3.0, 20.4], [6.2, 19.2]],
];
// the wing's primitives as [p1, p2, r1, r2, v, t] in the wing frame (t: the share of the arm its root sits at)
const VK = 2.5;   // depth counts 2.5 x: the feathers are flat
const P = (a, v) => [a[0], v * VK, a[1]];
const WPRIM = [
  [P([2.0, 20.4], -0.4), P([7.6, 28.0], -0.4), 1.6, 1.4, null],
  [P([7.6, 28.0], -0.4), P([13.5, 35.3], -0.4), 1.4, 0.8, null],
  ...WHITES.map(([a, b]) => [P(a, -0.15), P(b, -0.15), 1.2, 1.0, armT(a)]),
  ...ROWS.flatMap(([B, T, w]) => {
    const L = Math.hypot(T[0] - B[0], T[1] - B[1]);
    const d = [(T[0] - B[0]) / L, (T[1] - B[1]) / L];
    const at = (k) => [B[0] + d[0] * k, B[1] + d[1] * k];
    const t = armT(B);
    return [[P(at(-1.6), -0.2), P(at(1.6), -0.2), 1.0, 1.0, t], [P(at(0.5), 0.35), P(T, 0.35), w / 2, 0.3, t]];
  }),
];
function wingHit(f) {
  const q = toWing(f);
  const p = [q[0], q[1] * VK, q[2]];
  let best = { d: Infinity, t: 0 };
  for (const [a, b, r1, r2, t] of WPRIM) {
    const h = capsule(p, a, b, r1, r2);
    if (h.d < best.d) best = { d: h.d, t: t ?? armT([q[0], q[2]]) };
  }
  return best;
}

// ---- body, head, tail, legs
const TORSO = [[[4.3, 4.0, 4.6], [0, 1, 16.2]], [[3.0, 3.0, 2.4], [0, 1.4, 11.8]], [[1.4, 1.6, 1.2], [0, 1.2, 10.2]]];
const NECK = [[3.4, 3.2, 2.6], [0, 0.4, 20.4]];
const HEAD = [0, -2.4, 24.3];
const HEAD_R = [3.0, 3.2, 3.0];
const TAIL_B = [0, 2.6, 11.6];
const TAIL = [-50, -25, 0, 25, 50].map((a) => {
  const L = 10.4 - Math.abs(a) * 0.01;
  const r = (a * Math.PI) / 180;
  return [TAIL_B[0] + L * Math.sin(r), TAIL_B[1] + 2.5, TAIL_B[2] - L * Math.cos(r)];
});
const LEG = {
  L: { hip: [2.0, -0.4, 13.2], ankle: [3.2, -1.5, 11.4], toes: [[2.2, -3.2, 9.6], [3.3, -3.4, 9.3], [4.4, -2.9, 9.7], [3.4, 0.3, 9.9]] },
  R: { hip: [-2.0, -0.3, 13.2], ankle: [-6.3, -1.3, 12.0], toes: [[-7.6, -3.1, 11.9], [-7.3, -3.2, 10.6], [-6.0, -3.0, 10.2]] },
};
const legD = (c, L) => Math.min(capD(c, L.hip, L.ankle, 1.4, 0.8), ...L.toes.map((t) => capD(c, L.ankle, t, 0.6, 0.35)));
const sheetX = (c) => C30 * c[0] + 0.5 * c[1];

const EYE = { side: 'L', at: [1.75, -4.5, 24.9], size: 0.95, yaw: 38, flat: 0.5 };
const face = eyeKit({ eyes: [EYE, mirrorEye(EYE)], skin: [0.93, 0.76, 0.35] });

const SHOULDER = toScad([2.0, 0, 20.4]);
const ELBOW = toScad([7.6, 0, 28.0]);
const mx = (p) => [-p[0], p[1], p[2]];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: LEG.L.hip },
  { name: 'legR', parent: 'root', at: LEG.R.hip },
  { name: 'body', parent: 'root', at: [0, 1, 11] },
  { name: 'head', parent: 'body', at: [0, 0.2, 21.5] },
  { name: 'tail1', parent: 'body', at: TAIL_B },
  { name: 'wingL', parent: 'body', at: SHOULDER },
  { name: 'wingR', parent: 'body', at: mx(SHOULDER) },
  { name: 'wing2L', parent: 'wingL', at: ELBOW },
  { name: 'wing2R', parent: 'wingR', at: mx(ELBOW) },
  ...face.joints,
];

function assign(c, rgb) {
  const Sd = side(c);
  const f = fold(c);
  if (isAny(rgb, BOLT, 0.05)) {
    const sx = sheetX(c);
    return sx > -9.8 && sx < -0.4 && c[2] < 14.5 ? 'legR' : 'body';   // the bolt in the far talons; the rest float
  }
  const w = wingHit(f);
  const neck = blobD(c, [NECK]);
  const parts = [
    ['body', Math.min(blobD(c, TORSO), c[2] < 21.6 ? neck : Infinity)],
    ['head', Math.min(ellD(c, HEAD_R, HEAD), c[2] >= 21.6 ? neck : Infinity, c[2] > 22 && Math.abs(c[0]) < 3.3 && c[1] < 2.6 && c[1] > -8 ? 1.05 : Infinity)],
    ['tail1', Math.min(...TAIL.map((t) => capD(c, TAIL_B, t, 1.4, 0.4)))],
    ['legL', legD(c, LEG.L)],
    ['legR', legD(c, LEG.R)],
    [w.t >= 0.5 ? `wing2${Sd}` : `wing${Sd}`, w.d],
  ];
  return closest(parts);
}

// The template raises the wings 40 to 70 degrees in battle, for wings that hang; these already stand in a steep V and
// would cross over the head. Thundrix's battle clips beat them DOWN instead and raise them only a little.
const wings = (up, fold = 0) => ({
  ...both('wing', { r: [fold, -up, 0] }),
  ...both('wing2', { r: [0, -up * 0.5, 0] }),
});
const tailFan = (a, b = 0) => ({ tail1: { r: [a, 0, b] } });

const clips = {
  ...birdClips({
    face, tail: ['tail1'], flapUp: 14,
    add: {
      // the V-wings never fold flat: the template's droops are halved by lifting them back up a little
      faint: (t, u) => { const d = smooth((u - 0.2) / 0.55); return { wingL: { r: [0, -10 * d, 0] }, wingR: { r: [0, 10 * d, 0] } }; },
      // the wave goodbye: the template lifts the left wing 55 to 75 degrees; this one waves round its V instead
      exit: (t, u) => ({ wingL: { r: [0, 55 * win(u, 0, 0.85, 0.2), 0] } }),
    },
  }),

  // battle: rears back, wings swept back and up a touch, eyes narrowed
  windup: {
    seconds: 0.25,
    pose: (t, u) => {
      const w = smooth(u / 0.8);
      return {
        body: { r: [-10 * w, 0, -8 * w] },
        head: { r: [6 * w, 0, 6 * w] },
        ...face.pose('open', 0.45 * w),
        ...wings(10 * w, -18 * w),
        ...tailFan(-8 * w),
      };
    },
  },

  // battle: a diving strike at u = 0.4, the wings beating down hard
  lunge: {
    seconds: 0.3,
    pose: (t, u) => {
      const back = K(u, [[0, 0.6], [0.12, 1], [0.22, 0]]);
      const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]);
      return {
        body: { r: [-8 * back + 22 * hit, 0, 0] },
        head: { r: [-4 * back + 14 * hit, 0, 0] },
        ...face.pose('open', 0.35),
        ...wings(10 * back - 38 * hit, -18 * back + 10 * hit),
        ...tailFan(-6 * back + 10 * hit),
      };
    },
  },

  // battle: hit. The body squashes back, the wings jolt down and shudder, eyes > <
  hurt: {
    seconds: 0.26,
    pose: (t, u) => {
      const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.45]]);
      const sh = shake(u, 5);
      return {
        body: { r: [-10 * k, 5 * sh, 4 * sh], s: [1 + 0.05 * k, 1 + 0.05 * k, 1 - 0.08 * k] },
        head: { r: [-16 * k, 6 * sh, 0] },
        ...face.pose(u > 0.06 ? 'squeeze' : 'open'),
        ...wings(-26 * k + 6 * sh),
        ...tailFan(-10 * k, 8 * sh),
      };
    },
  },

  // battle / evolution: two hops, big down-beats, ^ ^
  celebrate: {
    seconds: 0.6,
    pose: (t, u) => {
      const hp = Math.abs(Math.sin(TAU * u));
      const fl = Math.sin(TAU * 4 * u) * 0.5 + 0.5;
      return {
        root: { p: [0, 0, 2 * hp] },
        body: { r: [-6 * hp, 0, 0], s: [1 - 0.03 * hp, 1 - 0.03 * hp, 1 + 0.05 * hp] },
        head: { r: [-8, 0, 0] },
        ...face.pose('happy'),
        ...wings(-30 + 40 * fl),
        ...tailFan(-6 * hp, 10 * Math.sin(TAU * 4 * u)),
      };
    },
  },

  // sent out: pops out squashed with the wings low, then flings them open into the V with a small overshoot
  enter: {
    seconds: 0.45,
    pose: (t, u) => {
      const on = smooth((u - 0.1) / 0.4);
      const over = win(u, 0.4, 0.9, 0.12);
      return {
        body: { s: [1 + 0.12 * (1 - on) - 0.04 * over, 1 + 0.12 * (1 - on) - 0.04 * over, 1 - 0.2 * (1 - on) + 0.08 * over] },
        ...face.pose(on < 0.5 ? 'shut' : 'open'),
        ...wings(-40 * (1 - on) + 10 * over),
        ...tailFan(0, 8 * over * Math.sin(TAU * 2 * u)),
      };
    },
  },

  // fidget: rears up and screams at the sky, the wings shuddering with static
  idle_screech: {
    seconds: 2.2,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.2, 1], [0.7, 1], [0.86, 0]]);
      const sh = Math.sin(TAU * 14 * u) * win(u, 0.25, 0.7, 0.04);
      return {
        body: { r: [-8 * up, 0, 0] },
        head: { r: [-28 * up + 3 * sh, 0, 0] },
        ...face.pose(up > 0.5 ? 'squeeze' : 'open'),
        wingL: { r: [0, -8 * up + 3 * sh, 0] },
        wingR: { r: [0, 8 * up - 3 * sh, 0] },
        wing2L: { r: [0, -6 * up + 4 * sh, 0] },
        wing2R: { r: [0, 6 * up - 4 * sh, 0] },
        tail1: { r: [-10 * up, 0, 6 * sh] },
      };
    },
  },

  // fidget: shakes out each wing in turn and settles its crest
  idle_rouse: {
    seconds: 2.4,
    pose: (t, u) => {
      const l = Math.sin(TAU * 8 * u) * win(u, 0.1, 0.4, 0.05);
      const r = Math.sin(TAU * 8 * u) * win(u, 0.45, 0.75, 0.05);
      return merge({
        body: { r: [0, 4 * osc(u, 2), 0] },
        head: { r: [0, 0, 10 * win(u, 0.1, 0.4, 0.08) - 10 * win(u, 0.45, 0.75, 0.08)] },
        ...face.pose('open'),
        wingL: { r: [0, 8 * l, 0] },
        wing2L: { r: [0, 10 * l, 0] },
        wingR: { r: [0, -8 * r, 0] },
        wing2R: { r: [0, -10 * r, 0] },
      });
    },
  },
};
delete clips.idle_preen;

export default rigDef({ joints, assign, extras: face.extras, clips });
