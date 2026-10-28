// Ravatar (earth relic)'s rig: Ravatar's body (rigs/ravatar.mjs) in mossy stone armour. Pauldrons ride the upper arms,
// the gauntlets split at the wrist, the chest plate and back shell sit on the body, and the six boulders at its feet
// are joints of their own (stone1..6) that lift and settle on the green energy. Numbers are scad/ravatar_earth.scad's.
import { TAU, osc, rigDef, win } from './lib/anim.mjs';
import { any, ell, limb, mx, pick, spike } from './lib/biped.mjs';
import { baseJoints, baseParts, clipsFor, faceFor } from './ravatar.mjs';

const STONES = [[-12, -3, 1.6, 1.8], [12, -2, 1.2, 1.4], [-14, 3, 1.4, 1.5], [15, 4, 1.6, 1.7], [-9, -6, 0.9, 1], [8, -6, 0.9, 1]];
const stones = STONES.map((_, i) => `stone${i + 1}`);

const face = faceFor();
const joints = [...baseJoints, ...STONES.map((b, i) => ({ name: stones[i], parent: 'root', at: [b[0], b[1], b[2]] })), ...face.joints];

const parts = [
  ...baseParts,
  ['arm*', any(ell([4.6, 4.6, 3.4], [7.8, 0, 29.8]), ell([2.9, 2.2, 2.4], [9.6, -1, 28]), spike([8.4, 0.5, 32], [0.8, 0.4, 3.2], 1.6),
    ell([1, 0.6, 1.3], [7.6, -4.4, 30.2]), ell([1, 0.6, 1.3], [7.6, 4.4, 30.2]))],
  ['fore*', any(limb([9.6, -0.8, 19.5], [10.1, -1.3, 16.2], 2.6, 2.9), ell([2.2, 1.6, 1.8], [11.4, -1.6, 17]))],
  ['hand*', ell([3.2, 3.2, 3.2], [10.6, -1.8, 13])],
  ['body', any(ell([7.6, 5.8, 4.4], [0, 0.4, 27]), ell([7.8, 6.2, 5.6], [0, -0.4, 26.5]), ell([1.5, 0.9, 2], [0, -5.4, 27]))],
  ...STONES.map((b, i) => [stones[i], ell([1.2 * b[3], 0.9 * b[3], b[3]], [b[0], b[1], b[2]])]),
  ['root', any(mx(ell([6, 6, 0.6], [6, -2, 0.3])))],
];
// the energy arcs: rings of radius 5 round [±6, -2] on the ground
const assign = (c) => (c[2] < 0.8 && Math.abs(Math.hypot(Math.abs(c[0]) - 6, c[1] + 2) - 5) < 0.8 ? 'root' : pick(c, parts));

// the boulders hover: each rises 0..lift on its own phase, a whole number of bobs per loop
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

// fidget: it stamps; the boulders jump and drop back, the head nods with the blow
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
