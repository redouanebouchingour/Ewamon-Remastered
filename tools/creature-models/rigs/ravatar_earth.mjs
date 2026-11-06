// Ravatar (earth relic)'s rig: Ravatar's body (rigs/ravatar.mjs) in mossy stone armour. The pauldrons ride the upper
// arms, the stone gauntlets split at the wrist into forearm and fist, the gorget, pec plates and back shell sit on the
// body, the splinters and flying pebbles ride the tail's top link, and the six stones round its feet are joints of
// their own (stone1..6) that hover and jump on the green energy (the energy arcs stay on the root).
// Numbers are scad/ravatar_earth.scad's.
import { TAU, osc, rigDef, win } from './lib/anim.mjs';
import { any, blob, chain, ell, limb, mx, pick } from './lib/biped.mjs';
import { isAny, rot } from './lib/geo.mjs';
import { ELBOW, HAND, SHOULDER, TAIL, WRIST, armTests, baseJoints, bodyParts, clipsFor, faceFor, tails } from './ravatar.mjs';

const FUR = [0.74, 0.6, 0.42];
const TAILC = [[0.36, 0.33, 0.3], [0.86, 0.79, 0.6], [0.5, 0.42, 0.33], [0.34, 0.28, 0.23]];
const VEIN = [0.48, 0.88, 0.32];
const STONEC = [[0.4, 0.39, 0.31], [0.27, 0.26, 0.22], [0.42, 0.48, 0.26], [0.28, 0.74, 0.2], [0.78, 1, 0.62]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

const TORSO = [[[3.8, 3, 2.5], [0, 0.2, 15.5]], [[6.2, 3.9, 3.6], [0, -0.2, 20]], [[5.6, 3.6, 2.6], [0, 0.6, 23]]];
const SHELL = TORSO.map(([r, p]) => [r.map((x) => x + 0.9), p]);
const TAIL_R = [2, 3.3, 4.2, 4.6, 4.2, 3, 0.6];
const CREAM = [[6, 5.4, 5.4], [11.6, 5.4, 4.9], [18.3, 3.9, 9.2], [19.8, 2.4, 15.4]];
const CREAM_R = [2.4, 3.2, 3.5, 3];
const SPLINTERS = [[[17.4, 2.6, 18], [-1.6, 0.4, 7.4], 1.3], [[18.6, 1.8, 20.6], [0.6, 0, 6.4], 1.2],
  [[16.4, 3.4, 15.6], [-3, 1.2, 5.6], 1.1], [[19.6, 1.6, 17], [3, -0.2, 4.8], 1], [[18, 4, 18.6], [1.2, 2.4, 5.4], 1],
  [[19.2, 2.2, 13.4], [3.4, 0, 2.4], 0.9], [[16.6, 4.6, 13], [-2.6, 2, 4], 0.9]];
const PEBBLES = [[[21.6, 2, 27.2], 0.55], [[23.2, 1.2, 20.6], 0.5], [[14.6, 4.6, 27.6], 0.45], [[23.8, 2, 13.2], 0.5],
  [[20, 3.6, 30], 0.4]];
const STONES = [[[-16.5, 2, 5], 2.1], [[19.6, 3, 4.8], 2.1], [[11.2, -6, 1], 1.1], [[21, -3, 1.2], 1.2],
  [[-7.9, -6, 0.8], 0.8], [[-15.9, -2, 1.1], 1.1]];
const stones = STONES.map((_, i) => `stone${i + 1}`);

const face = faceFor(FUR);
const joints = [...baseJoints, ...STONES.map(([p], i) => ({ name: stones[i], parent: 'root', at: p })), ...face.joints];

const ARM = armTests(SHOULDER, ELBOW, WRIST, HAND);
const S = SHOULDER;
const d = [WRIST[0] - ELBOW[0], WRIST[1] - ELBOW[1], WRIST[2] - ELBOW[2]];
const at = (t) => add(ELBOW, d.map((x) => x * t));
const base = Object.fromEntries(bodyParts.map(([n, t]) => [n, t]));
const parts = [
  ['body', any(base.body, mx(ell([2.9, 1.15, 2.1], [2.85, -3.4, 21.2])), ell([5.6, 3.3, 2.4], [0, -0.4, 23.8]), ell([1.3, 0.6, 1.5], [0, -4.6, 21.3]))],
  ['head', base.head],
  ['arm*', any(ARM.arm, ell([4.3, 4.2, 3.3], add(S, [0.7, 0, 1.3])), ell([3.2, 3.2, 1.5], add(S, [0.5, 0, 3.4])),
    limb(add(S, [0.2, 0.2, 4.2]), add(S, [-0.6, 0.4, 8]), 1.8, 0.2), ell([2.4, 3, 1.8], add(S, [2.6, -0.8, -0.6])),
    ell([1, 0.6, 1.2], add(S, [1, -4.25, 1.6])), ell([0.9, 0.6, 1.1], add(S, [4.4, -1.2, 1.4])), ell([1, 0.6, 1.2], add(S, [1, 4.25, 1.6])))],
  ['fore*', any(ARM.fore, limb(at(0.12), WRIST, 2.9, 3), ell([1.8, 1.4, 0.7], add(at(0.5), [0.4, -0.6, 2.2])), ell([1.3, 1.8, 0.9], add(at(0.1), [1.8, 0.4, 1.2])))],
  ['hand*', any(ARM.hand, ell([2.9, 2.8, 2.4], add(HAND, [0, 0, 0.2])), ell([2.6, 2.4, 2], add(HAND, [0, -0.9, -1.2])),
    ...[-1.5, -0.5, 0.5, 1.5].map((dx) => ell([0.7, 0.6, 0.9], add(HAND, [dx, -2.9, -1.3]))))],
  ['leg*', base['leg*']],
];
const tailParts = [
  ...chain(tails, TAIL.slice(0, 6), TAIL_R),
  ...chain(['tail2', 'tail3', 'tail4'], CREAM, CREAM_R),
  ...SPLINTERS.map(([p, v, r]) => ['tail5', limb(p, add(p, v), r, 0.2)]),
  ...PEBBLES.map(([p, r]) => ['tail5', ell([r * 2, r * 2, r * 2], p)]),
];

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function assign(c, rgb) {
  // the energy arcs round the feet stay on the ground
  if (c[2] < 1 && isAny(rgb, [VEIN], 0.02)) return 'root';
  const s = STONES.findIndex(([p, r]) => dist(c, p) < 1.5 * r);
  if (s >= 0 && isAny(rgb, STONEC, 0.02)) return stones[s];
  if (isAny(rgb, TAILC, 0.015) || PEBBLES.some(([p, r]) => dist(c, p) < 2 * r)) return pick(c, tailParts);
  // the back shell is the body's, wherever the shoulders reach under it
  if (c[1] > 0.6 && c[2] > 18.2 && blob(SHELL)(c) < 1.08 && isAny(rgb, STONEC, 0.02)) return 'body';
  return pick(c, parts);
}

// the stones hover: each rises 0..lift on its own phase, a whole number of bobs per loop
const hover = (u, lift = 0.8, cycles = 1) => Object.fromEntries(stones.map((n, i) => [n, { p: [0, 0, lift * (0.5 - 0.5 * Math.cos(TAU * (cycles * u + i / 6)))], r: [0, 0, 10 * osc(u, cycles, i / 6)] }]));
const rise = (k) => Object.fromEntries(stones.map((n, i) => [n, { p: [0, 0, k * (2 + 0.6 * i)], r: [k * 25, 0, k * 40] }]));
const clips = clipsFor({
  face,
  extra: {
    idle: (t, u) => hover(u, 0.8, 1),
    idle_look: (t, u) => hover(u, 0.6, 1),
    windup: (t, u) => rise(0.6 * u),
    lunge: (t, u) => rise(0.6 * (1 - win(u, 0.35, 1.2, 0.3))),
    hurt: (t, u) => hover(u, 0.4, 2),
    celebrate: (t, u) => rise(Math.sin(Math.PI * u)),
    enter: (t, u) => rise(0.5 * Math.sin(Math.PI * u)),
    idle_roar: (t, u) => rise(win(u, 0.15, 0.85, 0.15)),
    idle_swish: (t, u) => hover(u, 0.8, 1),
  },
});

// fidget: it stamps; the stones jump and drop back, the head nods with the blow
clips.idle_stomp = {
  seconds: 2,
  pose: (t, u) => {
    const lift = win(u, 0.1, 0.32, 0.08);
    const hit = Math.max(0, 1 - Math.abs(u - 0.34) / 0.06);
    const jump = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.34) / 0.3))));
    return {
      legL: { r: [-26 * lift, -6 * lift, 0] },
      body: { r: [-3 * lift + 4 * hit, 0, -4 * lift] },
      head: { r: [8 * hit, 0, 0] },
      ...face.pose(hit > 0.2 ? 'squeeze' : 'open', 0),
      ...Object.fromEntries(['armL', 'armR'].map((a) => [a, { r: [4 * hit, 0, 0] }])),
      ...Object.fromEntries(stones.map((n, i) => [n, { p: [0, 0, 3 * jump * (0.7 + 0.1 * i)], r: [30 * jump, 0, 20 * jump * (i % 2 ? 1 : -1)] }])),
    };
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
