// Rambull's rig: a buff ram bodybuilder on two legs (the +X one stepping with its knee forward), a barrel chest under
// a painted wool bib, huge arms ending in dark hoof hands, a smug half-lidded sheep face inside great curled horns.
// Shaggy wool locks hang over the arms, chest and back. Numbers are scad/rambull.scad's (the head block is
// translate(HP) rotate(HR) scale(HK)).
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, inFrame, limb, mx, pair, petal, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near, rot, side, subFrame } from './lib/geo.mjs';

const WOOL = [0.93, 0.83, 0.65];
const MUSCLE = [0.84, 0.69, 0.5];
const SHIN = [0.76, 0.6, 0.44];
const HOOF = [0.35, 0.25, 0.19];
const H = subFrame([-0.6, -4.6, 33.4], [3, 0, -15], 1.28);

const eyeL = { side: 'L', at: [2.65, -3.75, 1], size: 0.95, yaw: 34, flat: 0.6, frame: H };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.95, 0.83, 0.72] });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [5.5, 0, 12.5] },
  { name: 'legR', parent: 'root', at: [-5.8, 0.5, 12.5] },
  { name: 'body', parent: 'root', at: [0, 0, 13] },
  { name: 'head', parent: 'body', at: [-0.6, -3.5, 30.5] },
  ...pair('arm*', 'body', [12.4, 0.5, 24.5]),
  ...pair('fore*', 'arm*', [15.2, -1, 17]),
  ...pair('hand*', 'fore*', [14.8, -3, 12]),
  ...face.joints,
];

const TORSO = [[[10.5, 7.5, 7], [0, 0, 22]], [[9.8, 8, 6.5], [0, 0.4, 15.5]], [[8, 5, 4], [0, 2, 28.5]]];
// the scad's wool locks: ring() and lock() as there (a lock is a petal hanging from its point)
const DEG = Math.PI / 180;
const ring = (c, r, z, azs, len, w) => azs.map((a, i) => {
  const k = i % 2;
  return [[c[0] + r * Math.cos(a * DEG), c[1] + r * Math.sin(a * DEG), z + 0.7 * k], [Math.cos(a * DEG), Math.sin(a * DEG), 0], len * (1 - 0.2 * k), w * (1 - 0.1 * k)];
});
const onE = (r, c, d) => { const n = Math.hypot(...d); return c.map((v, i) => v + (r[i] * d[i]) / n); };
const lockTest = ([p, n, len, w]) => {
  const rr = [15, 0, Math.atan2(n[1], n[0]) / DEG - 90];
  const o = rot(rr, [0, 0, -0.4 * len]);
  return petal([w, 0.5 * w, 0.6 * len], [p[0] + o[0], p[1] + o[1], p[2] + o[2]], rr);
};
const BODY_LOCKS = [
  ...ring([-1, -4.8], 3.2, 26.8, [-150, -120, -90, -60, -30], 3.2, 2.2),
  ...[[-0.8, -1, 0.3], [-0.55, -1, -0.05], [-0.3, -1, -0.45], [0.3, -1, -0.45], [0.5, -1, -0.05], [0.7, -1, 0.3]]
    .map((d) => [onE(TORSO[0][0].map((v) => v - 0.3), TORSO[0][1], d), [d[0], d[1], 0], 3.6, 2.2]),
  ...ring([0, 1], 7.2, 25.4, [35, 60, 90, 120, 145], 3.6, 2.4),
];
const SHOULDER_LOCKS = ring([12.4, 0.5], 4.2, 24.6, [-120, -75, -30, 15, 60, 105], 4.5, 2.2);
const UPPER_LOCKS = ring([14.6, -1], 3.2, 19.4, [-100, -50, 0, 50], 3.6, 1.9);
const FORE_LOCKS = ring([15.4, -1.6], 3.1, 15.4, [-70, -15, 40], 3, 1.6);
const parts = [
  ['body', any(blob(TORSO), mx(ell([5.2, 1.8, 3.4], [4.6, -5.9, 23.2])), mx(ell([5.4, 3.4, 5], [3.6, 5.2, 14])),
    ell([6.6, 3, 2.2], [-1, -4.8, 27.4]), ...BODY_LOCKS.map(lockTest))],
  ['arm*', any(ell([4.4, 4.4, 4], [12.4, 0.5, 25]), ell([3.6, 3.7, 4], [14.6, -1.4, 20.3]), limb([12.6, 0.5, 24], [14.6, -0.8, 18.5], 3.3, 3),
    ell([4.7, 4.7, 3.4], [12.4, 0.6, 25.8]), ...SHOULDER_LOCKS.map(lockTest), ...UPPER_LOCKS.map(lockTest))],
  ['fore*', any(ell([3.5, 3.3, 3.6], [15.6, -1.4, 15.2]), limb([15, -1, 17], [14.8, -3, 12], 2.9, 2.3), ...FORE_LOCKS.map(lockTest))],
  ['legL', any(ell([4.8, 5, 5.5], [5.5, 0, 12]), limb([5.5, -0.5, 11], [4.6, -5, 6], 3.8, 2.6))],
  ['legR', ell([4.8, 5, 5.5], [-5.8, 0.5, 12])],
  ['head', inFrame(H, any(blob([[[3.4, 3.8, 3.6], [0, 0.5, 0.6]], [[3.3, 3, 3.2], [0, -3.5, -0.7]], [[2.5, 3, 2.5], [0, -7.2, -2.7]]]),
    ell([3.3, 3.4, 1.4], [0, -0.4, 3.7]), ...[[-2.3, -2.9, 3.3], [0, -3.4, 3.4], [2.3, -2.9, 3.3]].map((q) => ell([1.4, 1.1, 0.9], q)),
    ell([3.2, 2.4, 3], [0, 3, 1])))],
];

function assign(c, rgb) {
  const S = side(c);
  if (near(rgb, HOOF)) return c[2] > 5 ? `hand${S}` : `leg${S}`;
  // wool, muscle and shin are close: test them tightly
  if (isAny(rgb, [WOOL, MUSCLE], 0.015)) return pick(c, parts);
  if (near(rgb, SHIN, 0.015)) return `leg${S}`;
  return 'head';   // face, horns, ears, eyes, nose, mouth
}

const base = bipedClips({
  face, hipH: 12, stride: 16, armSwing: 14, hopScale: 0.3, droop: 0.6,
  add: {
    idle: (t, u) => ({ body: { s: [1 + 0.012 * osc(u, 2), 1 + 0.012 * osc(u, 2), 1] } }),
    walk: (t, u) => ({ head: { r: [3 * osc(u, 2), 0, 0] } }),
  },
});

const clips = {
  ...base,

  // fidget: a double-biceps flex with a smug head tilt and a slow blink
  idle_flex: {
    seconds: 2.6,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.18, 1], [0.7, 1], [0.88, 0]]);
      const pump = Math.sin(TAU * 3 * u) * win(u, 0.25, 0.65, 0.05);
      return {
        body: { p: [0, 0, 0.3 * on], r: [-4 * on, 0, 0], s: [1 + 0.03 * on, 1 + 0.03 * on, 1] },
        head: { r: [-6 * on, 10 * on, 16 * on] },
        ...face.pose('open', 0.5 * on + blinks(u, [[0.5, 0.6]])),
        ...both('arm', { r: [0, -80 * on + 4 * pump, 0] }),
        ...both('fore', { r: [-100 * on - 8 * pump, 0, 0] }),
        ...both('hand', { s: 1 + 0.05 * Math.abs(pump) }),
      };
    },
  },

  // fidget: it lowers its horns and paws the ground with a hoof, snorting, ready to charge
  idle_paw: {
    seconds: 2.2,
    pose: (t, u) => {
      const low = K(u, [[0, 0], [0.15, 1], [0.8, 1], [0.95, 0]]);
      const scrape = (u0) => win(u, u0, u0 + 0.14, 0.04);
      const s = scrape(0.25) + scrape(0.5);
      return merge({
        root: { r: [3 * low, 0, 0] },
        body: { r: [8 * low, 0, 0] },
        head: { r: [18 * low - 4 * Math.abs(osc(u, 4)) * low, 0, 0] },
        ...face.pose('open', 0.55 * low),
        legR: { r: [-14 * s + 10 * win(u, 0.32, 0.42, 0.03) + 10 * win(u, 0.57, 0.67, 0.03), 0, 0], p: [0, 0, 0.8 * s] },
        ...both('arm', { r: [-10 * low, 0, 0] }),
        ...both('fore', { r: [-20 * low, 0, 0] }),
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
