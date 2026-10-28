// Berkest's rig: a lanky fennec street juggler. The four oranges are joints of their own (fruit1 to fruit4, off the
// root) and really juggle in the loops: thrown from the right glove over the fez, caught in the left, carried back
// low in front. The battle clips leave them where the scad froze them, mid-arc. The scad's motion swooshes hang on
// a hidden joint (trail). Numbers are scad/berkest.scad's.
import { HIDE, K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, pair, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye, blinks } from './lib/face.mjs';
import { isAny, near } from './lib/geo.mjs';

const FUR_DK = [0.7, 0.57, 0.36];
const FRUIT_COLS = [[0.96, 0.5, 0.1], [1, 0.66, 0.25], [0.3, 0.55, 0.2]];
const SWOOSH = [0.95, 0.6, 0.2];
const FRUITS = [[-12, -3, 25], [-13, -3, 19.5], [11, -3, 23.5], [6, -4, 31.5]];
const fruits = ['fruit1', 'fruit2', 'fruit3', 'fruit4'];
const TAIL = ['tail1', 'tail2'];

const eyeL = { side: 'L', at: [2.2, -3.55, 28.6], size: 1.55, yaw: 8, flat: 0.42 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FUR_DK });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [2.6, 0.5, 12]),
  { name: 'body', parent: 'root', at: [0, 0.4, 12] },
  { name: 'head', parent: 'body', at: [0, -0.6, 23.5] },
  ...pair('ear*', 'head', [3.2, 0.4, 30.5]),
  ...pair('scarf*', 'body', [3, -1.5, 22]),
  ...pair('arm*', 'body', [4.4, 0, 20.5]),
  ...pair('fore*', 'arm*', [7.6, -1, 16.5]),
  ...pair('hand*', 'fore*', [10.8, -3.2, 16]),
  { name: 'tail1', parent: 'body', at: [1.2, 3.4, 11] },
  { name: 'tail2', parent: 'tail1', at: [8, 6, 8.5] },
  ...fruits.map((name, i) => ({ name, parent: 'root', at: FRUITS[i] })),
  { name: 'trail', parent: 'root', at: [0, -3, 22], scale: HIDE },
  ...face.joints,
];

const parts = [
  ['body', any(blob([[[4.4, 3.4, 3.6], [0, 0.4, 13]], [[4.6, 3.6, 4.2], [0, 0, 19]]]), ell([4.8, 3.8, 3.6], [0, 0.4, 13.4]), ell([5, 4, 4.4], [0, 0, 19]),
    ell([3.8, 3.4, 1.4], [0, 0, 22.6]), ell([4.6, 3.6, 0.9], [0, 0.4, 11.4]))],
  ['head', any(blob([[[5.2, 4.6, 4.6], [0, -0.3, 27.6]], [[3.6, 3.6, 3.2], [0, -2, 26.4]]]), blob([[[2.4, 2, 1.8], [0, -4, 26]], [[1, 1.2, 0.9], [0, -7, 26.4]]]),
    ell([3, 3, 2.6], [0.4, 0, 33.4]))],
  ['ear*', limb([3.2, 0.4, 30.5], [8.2, 2.9, 42], 2.4, 0.5)],
  ['scarf*', limb([3, -1.5, 22], [8, -2.4, 19.5], 0.8, 1)],
  ['arm*', limb([4.4, 0, 20.5], [7.6, -1, 16.5], 1.2, 1)],
  ['fore*', limb([7.6, -1, 16.5], [10.4, -3, 16], 1, 0.9)],
  ['hand*', any(ell([1.4, 1.5, 0.9], [11.2, -3.4, 15.9]), ell([2, 2, 1.2], [11.2, -4.6, 16.5]))],
  ['leg*', any(limb([2.6, 0.5, 12], [3.4, 1.4, 6], 1.8, 1.3), limb([3.4, 1.4, 6], [3.4, 0.6, 1.4], 1.3, 1.1), ell([1.5, 2.6, 1.1], [3.4, -1, 1.1]))],
  ['tail1', any(ell([1.4, 1.4, 1.4], [1.2, 3.4, 11]), ell([3.6, 3.2, 3.4], [6, 6, 7.5]))],
  ['tail2', any(ell([4.6, 3.6, 4.6], [11, 6, 10]), ell([4.4, 3.4, 4], [11.8, 6, 12]), ell([1.8, 1.6, 2], [13, 5.5, 18]))],
];

function assign(c, rgb) {
  if (near(rgb, SWOOSH, 0.03)) return 'trail';
  if (isAny(rgb, FRUIT_COLS, 0.03)) {
    let best = 0;
    FRUITS.forEach((f, i) => { if (Math.hypot(c[0] - f[0], c[1] - f[1], c[2] - f[2]) < Math.hypot(c[0] - FRUITS[best][0], c[1] - FRUITS[best][1], c[2] - FRUITS[best][2])) best = i; });
    if (Math.hypot(c[0] - FRUITS[best][0], c[1] - FRUITS[best][1], c[2] - FRUITS[best][2]) < 3.5) return fruits[best];
  }
  return pick(c, parts);
}

// the cascade path, s in 0..1: thrown from the right glove (x < 0) up over the fez into the left glove, then carried
// back low in front of the vest. `top` is the peak height.
const R = [-11, -4, 17.5];
const L = [11, -4, 17.5];
function path(s, top = 38) {
  const f = ((s % 1) + 1) % 1;
  if (f < 0.72) {
    const k = f / 0.72;
    return [R[0] + (L[0] - R[0]) * k, -4, R[2] + 4 * (top - R[2]) * k * (1 - k)];
  }
  const k = (f - 0.72) / 0.28;
  return [L[0] + (R[0] - L[0]) * k, -4 - 2.6 * Math.sin(Math.PI * k), L[2] - 3 * Math.sin(Math.PI * k)];
}
/** The four oranges a quarter apart on the path, `cycles` loops per clip; `amp` 0 leaves them at rest. */
const juggle = (u, cycles, top = 38, amp = 1) => {
  const out = {};
  fruits.forEach((n, i) => {
    const p = path(u * cycles + i / 4, top);
    out[n] = { p: p.map((v, a) => (v - FRUITS[i][a]) * amp) };
  });
  // the gloves dip as they catch and rise as they throw, four throws per loop
  const b = osc(u, cycles * 4);
  return merge(out, { handR: { r: [-10 * b * amp, 0, 0] }, handL: { r: [10 * b * amp, 0, 0] }, ...both('fore', { r: [-6 * b * amp, 0, 0] }) });
};

const scarf = (u, cycles, amp = 1) => both('scarf', { r: [0, 6 * amp * osc(u, cycles), 5 * amp * osc(u, cycles, 0.25)] });

const base = bipedClips({
  face, tail: TAIL, hipH: 12, stride: 22, armSwing: 6,
  punch: { arm: [-60, 20, 0], fore: [-20, 0, 0] },
  cheer: { arm: [0, -60, 0], fore: [0, -20, 0] },
  add: {
    idle: (t, u) => merge(juggle(u, 2), scarf(u, 2)),
    walk: (t, u) => merge(juggle(u, 1, 32), scarf(u, 2, 1.6)),
    idle_look: (t, u) => merge(juggle(u, 1, 34), scarf(u, 1)),
    windup: (t, u) => scarf(u, 1, 0.6),
    // it lobs the left-most orange (fruit3) at the foe on the hit, and it comes back like a boomerang
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
      }, juggle(u, 1, 40));
    },
  },

  // fidget: one orange is caught on the fez and balanced there, wobbling, while the other three keep going
  idle_balance: {
    seconds: 3,
    pose: (t, u) => {
      const j = juggle(u, 2, 38);
      const hold = win(u, 0.2, 0.8, 0.08);
      const wob = Math.sin(TAU * 6 * u) * hold;
      const fez = [0.4, -0.2, 37.6];
      const p0 = j.fruit4.p;
      return merge(j, {
        fruit4: { p: [(fez[0] - FRUITS[3][0] - p0[0]) * hold + 0.6 * wob, (fez[1] - FRUITS[3][1] - p0[1]) * hold, (fez[2] - FRUITS[3][2] - p0[2]) * hold] },
        head: { r: [-4 * hold, 3 * wob, 2 * wob] },
        body: { r: [0, -1.5 * wob, 0] },
        ...face.pose('open', blinks(u, [[0.5, 0.56]])),
        ...both('ear', { r: [0, -4 * wob, 0] }),
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
