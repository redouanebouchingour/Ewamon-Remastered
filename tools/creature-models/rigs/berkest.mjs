// Berkest's rig: a slim fennec street juggler. The three oranges are joints of their own (fruit1 to fruit3, off the
// root) and really juggle in the loops: thrown from the right glove over the fez, caught in the left, carried back
// low in front. The battle clips leave them where the scad froze them, in their arc. The scad's motion arcs hang on
// a hidden joint (trail). The scarf's two ends differ: scarfL flies out sideways from the neck, scarfR hangs down the
// right hip. Numbers are scad/berkest.scad's (its sheet midline offset OX and fs() included).
import { HIDE, K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, fromSheet, limb, mx, pair, pick, plate } from './lib/biped.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { isAny, near, subFrame } from './lib/geo.mjs';

const OX = 2.4;
const fs = (sx, z, y = 0) => fromSheet(sx + OX, z - 0.17 * y, y);

const FUR = [0.82, 0.69, 0.39];
const FRUIT_COLS = [[0.93, 0.47, 0.06], [0.98, 0.62, 0.16], [0.3, 0.5, 0.2]];
const TRAIL_COLS = [[0.97, 0.56, 0.14], [0.45, 0.62, 0.26]];
const FRUITS = [fs(-14.1, 29.8, -1), fs(-13.8, 22.0, -1), fs(9.8, 25.0, -1)];
const fruits = ['fruit1', 'fruit2', 'fruit3'];

// head (scad SKULL, CROWN, JAW, RUFF, MUZ1 / MUZ2, NOSE, FEZ)
const SKULL = [[5.7, 4.4, 3.8], [0, -0.4, 26.4]];
const CROWN = [[2.2, 2.2, 1.8], [4.0, 0.6, 28.4]];
const JAW = [[3.4, 3.0, 2.0], [0, -2.4, 23.9]];
const RUFF = [[2.3, 2.0, 1.9], [4.9, 0.2, 25.0]];
const MUZ = [[[2.5, 2.3, 2.0], [0, -3.8, 25.2]], [[1.25, 1.1, 1.0], [0, -6.3, 25.1]]];
const FEZ = [0.3, -1.0, 29.6];

// the ears: mirror_x() translate(EAR_AT) rotate(EAR_ROT) plates of earPts (x outward, z up from the root)
const EAR = subFrame([6.0, 1.0, 29.4], [-8, 4, 12]);
const earPts = [[-2.6, 1.7], [-1.8, 4.0], [0.1, 6.0], [2.0, 7.6], [3.6, 8.2], [5.3, 9.9], [6.3, 10.0], [7.4, 8.9], [7.4, 7.0],
  [7.0, 5.2], [6.3, 3.4], [5.5, 1.5], [4.2, 0.7], [2.7, -1.4], [1.0, -2.4], [-1.0, -2.4], [-2.8, -0.6]];
const EAR_PIVOT = EAR.world([-0.8, 0, 0.4]);

// eyes: each eye() squashed about its centre by EYE_SQ: translate(EYE) scale(EYE_SQ) translate(-EYE) eye(EYE, ...)
const EYE = [3.1, -3.6, 26.9];
const EYE_SQ = [1.4, 1, 0.74];
const eyeAt = (k) => {
  const at = [k * EYE[0], EYE[1], EYE[2]];
  return { side: k > 0 ? 'L' : 'R', at, size: 1.25, yaw: k * 22, flat: 0.5,
    frame: subFrame(at.map((v, i) => v * (1 - EYE_SQ[i])), [0, 0, 0], EYE_SQ) };
};
const face = eyeKit({ eyes: [eyeAt(1), eyeAt(-1)], skin: FUR, lid: [1.1, 1.0, 0.6] });

// body
const TORSO = [[[3.5, 3.0, 2.6], [0, 0.3, 13.4]], [[3.9, 3.2, 3.0], [0, 0, 18.4]]];
const PELVIS = [[3.5, 3.0, 2.4], [0, 0.4, 11.4]];
const SC = [[4.2, 3.6, 1.6], [0, -0.3, 21.7]];
const SC_FLY = [[3.4, -1.6, 21.6], [7.4, -1.8, 21.6], [10.8, -1.6, 21.3], [13.4, -1.3, 21.0]];
const SC_HANG = [[-3.6, 0.4, 17.6], [-5.0, -0.6, 14.8], [-7.2, -1.1, 12.2], [-9.2, -1.5, 10.0]];
// arms and legs (the +X side)
const SHO = [3.9, -0.2, 19.8];
const ELB = [7.0, -1.2, 17.3];
const WRI = [9.9, -2.4, 16.6];
const HAND = [10.9, -2.9, 16.5];
const HIP = [2.4, 0.5, 10.6];
const HAUNCH = [[2.6, 2.8, 2.7], [3.8, 0.4, 8.8]];
const KNEE = [5.2, -0.2, 6.6];
const ANKLE = [6.0, -0.6, 3.4];
// the tail's spine (sheet x, sheet z, depth, radius), scaled 0.85 in y
const TAIL = [[0.4, 10.8, 3.0, 1.8], [4.4, 9.0, 4.6, 3.8], [8.6, 8.8, 5.8, 4.9], [12.6, 9.4, 6.2, 4.8], [14.4, 13.0, 6.2, 4.4],
  [15.2, 16.0, 6.0, 3.6], [16.8, 18.4, 5.8, 2.4], [18.8, 18.8, 5.6, 1.0]].map(([sx, z, d, r]) => [fs(sx, z, d), r]);
const tailSeg = (i) => limb(TAIL[i][0], TAIL[i + 1][0], TAIL[i][1] * 0.95, TAIL[i + 1][1] * 0.95);

const joints = [
  { name: 'root', at: [0, 0, 0.9] },
  ...pair('leg*', 'root', HIP),
  { name: 'body', parent: 'root', at: [0, 0.4, 11.4] },
  { name: 'head', parent: 'body', at: [0, -0.3, 22.6] },
  { name: 'earL', parent: 'head', at: EAR_PIVOT },
  { name: 'earR', parent: 'head', at: [-EAR_PIVOT[0], EAR_PIVOT[1], EAR_PIVOT[2]] },
  { name: 'scarfL', parent: 'body', at: SC_FLY[0] },
  { name: 'scarfR', parent: 'body', at: SC_HANG[0] },
  ...pair('arm*', 'body', SHO),
  ...pair('fore*', 'arm*', ELB),
  ...pair('hand*', 'fore*', WRI),
  { name: 'tail1', parent: 'body', at: TAIL[0][0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[3][0] },
  ...fruits.map((name, i) => ({ name, parent: 'root', at: FRUITS[i] })),
  { name: 'trail', parent: 'root', at: [0, -1, 24], scale: HIDE },
  ...face.joints,
];

const strip = (pts, w) => any(...pts.slice(1).map((p, i) => limb(pts[i], p, w)));
const parts = [
  ['body', any(blob(TORSO), ell(...PELVIS), ell(...SC), limb([0, 0.2, 20.5], [0, -0.6, 21.5], 2.1, 2.0),
    ell([4.4, 3.8, 1.4], [0, 0.4, 12.0]), ell([1.6, 1.0, 1.4], [-3.6, -2.0, 11.6]), ell([1.6, 1.0, 1.4], [2.6, -3.0, 11.4]),
    ell([1.6, 1.0, 1.4], [2.4, 3.1, 11.6]), ell([1.6, 1.0, 1.4], [-2.4, 3.1, 11.6]))],
  ['head', any(blob([SKULL, JAW]), mx(ell(...CROWN)), blob(MUZ), mx(ell(...RUFF)), ell([0.75, 0.6, 0.55], [0, -7.2, 25.5]),
    mx(limb([6.3, 0.2, 25.7], [8.0, 0.1, 25.5], 0.95)), mx(limb([6.0, 0, 24.3], [7.4, -0.2, 23.3], 0.85)),
    limb([0, -0.6, 23.0], [0, -0.6, 23.5], 2.0), limb(FEZ, [FEZ[0] + 0.5, FEZ[1], FEZ[2] + 6.2], 3.0, 2.8))],
  ['ear*', plate(earPts, 1.1, EAR)],
  ['scarfL', any(strip(SC_FLY, 1.25), limb(SC_FLY[3], [15.4, -1.2, 21.0], 1.0))],
  ['scarfR', any(strip(SC_HANG, 1.45), limb(SC_HANG[3], [-10.6, -1.6, 8.4], 1.1))],
  ['arm*', limb(SHO, ELB, 1.2, 1.0)],
  ['fore*', limb(ELB, WRI, 1.0, 0.85)],
  ['hand*', any(ell([1.7, 1.55, 1.0], [11.3, -3.0, 16.5]), limb(WRI, HAND, 0.95, 1.0),
    ...[[13.6, -2.6, 18.6], [13.1, -4.0, 18.9], [11.9, -4.9, 18.6], [9.8, -4.3, 17.9]].map((f) => limb([11.5, -3.3, 16.9], f, 0.5)))],
  ['leg*', any(ell(...HAUNCH), limb(HIP, KNEE, 2.0, 1.3), limb(KNEE, ANKLE, 1.05, 0.8),
    limb(ANKLE, [6.2, -2.3, 1.7], 0.8), ell([1.3, 1.5, 0.75], [6.2, -2.8, 1.65]),
    limb(ANKLE, [7.6, -1.6, 1.7], 0.8), ell([1.6, 1.6, 0.75], [8.0, -1.9, 1.65]))],
  ['tail1', any(tailSeg(0), tailSeg(1), tailSeg(2))],
  ['tail2', any(tailSeg(3), tailSeg(4), tailSeg(5), tailSeg(6))],
];

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function assign(c, rgb) {
  if (isAny(rgb, TRAIL_COLS, 0.02)) return 'trail';
  if (isAny(rgb, FRUIT_COLS, 0.015)) {
    let best = 0;
    FRUITS.forEach((f, i) => { if (dist(c, f) < dist(c, FRUITS[best])) best = i; });
    if (dist(c, FRUITS[best]) < 3.6) return fruits[best];
  }
  return pick(c, parts);
}

// the cascade path, s in 0..1: thrown from the right glove (x < 0) up over the fez into the left glove, then carried
// back low in front of the vest. `top` is the peak height.
const R = [-11.2, -3.4, 19];
const L = [11.2, -3.4, 19];
function path(s, top = 39) {
  const f = ((s % 1) + 1) % 1;
  if (f < 0.72) {
    const k = f / 0.72;
    return [R[0] + (L[0] - R[0]) * k, -3.6, R[2] + 4 * (top - R[2]) * k * (1 - k)];
  }
  const k = (f - 0.72) / 0.28;
  return [L[0] + (R[0] - L[0]) * k, -3.6 - 3 * Math.sin(Math.PI * k), L[2] - 3 * Math.sin(Math.PI * k)];
}
/** The three oranges a third apart on the path, `cycles` loops per clip; `amp` 0 leaves them at rest. */
const juggle = (u, cycles, top = 39, amp = 1) => {
  const out = {};
  fruits.forEach((n, i) => {
    const p = path(u * cycles + i / 3, top);
    out[n] = { p: p.map((v, a) => (v - FRUITS[i][a]) * amp) };
  });
  // the gloves dip as they catch and rise as they throw, three throws per loop
  const b = osc(u, cycles * 3);
  return merge(out, { handR: { r: [-10 * b * amp, 0, 0] }, handL: { r: [10 * b * amp, 0, 0] }, ...both('fore', { r: [-6 * b * amp, 0, 0] }) });
};

// the flying end flaps up and down, the hanging one swings
const scarf = (u, cycles, amp = 1) => ({
  scarfL: { r: [0, 8 * amp * osc(u, cycles), 6 * amp * osc(u, cycles, 0.25)] },
  scarfR: { r: [4 * amp * osc(u, cycles, 0.1), 5 * amp * osc(u, cycles, 0.35), 0] },
});

const TAIL_J = ['tail1', 'tail2'];
const base = bipedClips({
  face, tail: TAIL_J, hipH: 9.7, stride: 22, armSwing: 6,
  punch: { arm: [-60, 20, 0], fore: [-20, 0, 0] },
  cheer: { arm: [0, -60, 0], fore: [0, -20, 0] },
  add: {
    idle: (t, u) => merge(juggle(u, 2), scarf(u, 2)),
    walk: (t, u) => merge(juggle(u, 1, 40), scarf(u, 2, 1.6)),
    idle_look: (t, u) => merge(juggle(u, 1, 39), scarf(u, 1)),
    windup: (t, u) => scarf(u, 1, 0.6),
    // it lobs the near orange (fruit3) at the foe on the hit, and it comes back like a boomerang
    lunge: (t, u) => merge(scarf(u, 1, 1.4), { fruit3: { p: [-6 * win(u, 0.2, 0.95, 0.2), -30 * K(u, [[0.1, 0], [0.45, 1], [0.95, 0]]), 4 * Math.sin(Math.PI * u)] } }),
    hurt: (t, u) => merge(scarf(u, 3, 1.6), Object.fromEntries(fruits.map((n, i) => [n, { p: [0, 0, -3 * Math.sin(Math.PI * u) * (i % 2 ? 1 : 0.6)] }]))),
    celebrate: (t, u) => merge(juggle(u, 1, 42), scarf(u, 2, 1.5)),
    exit: (t, u) => scarf(u, 1),
  },
});

const clips = {
  ...base,

  // fidget: a showman's bow with a flourish of the right arm, the oranges still flying, a wink
  idle_bow: {
    seconds: 2.4,
    pose: (t, u) => {
      const bow = K(u, [[0, 0], [0.25, 0], [0.45, 1], [0.65, 1], [0.85, 0]]);
      return merge({
        body: { r: [22 * bow, 0, 0] },
        head: { r: [10 * bow, 0, 0] },
        ...face.pose('open', 0),
        lidL: { s: [1, 1, Math.max(1e-4, win(u, 0.5, 0.62, 0.03))] },
        armR: { r: [-40 * bow, 30 * bow, 30 * bow] },
        foreR: { r: [-30 * bow, 0, 0] },
        ...both('ear', { r: [16 * bow, 0, 0] }),
        ...scarf(u, 2),
      }, juggle(u, 1, 41));
    },
  },

  // fidget: one orange is caught on the fez and balanced there, wobbling, while the other two keep going
  idle_balance: {
    seconds: 3,
    pose: (t, u) => {
      const j = juggle(u, 2, 39);
      const hold = win(u, 0.2, 0.8, 0.08);
      const wob = Math.sin(TAU * 6 * u) * hold;
      const top = [FEZ[0] + 0.5, FEZ[1], FEZ[2] + 7.6];
      const F = fruits.length - 1;
      const p0 = j[fruits[F]].p;
      return merge(j, {
        [fruits[F]]: { p: [0, 1, 2].map((a) => (top[a] - FRUITS[F][a] - p0[a]) * hold + (a === 0 ? 0.6 * wob : 0)) },
        head: { r: [-4 * hold, 3 * wob, 2 * wob] },
        body: { r: [0, -1.5 * wob, 0] },
        ...face.pose('open', blinks(u, [[0.5, 0.56]])),
        ...both('ear', { r: [0, -4 * wob, 0] }),
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
