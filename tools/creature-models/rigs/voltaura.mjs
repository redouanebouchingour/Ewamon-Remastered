// Voltaura's rig: a slender electric humanoid, the right arm out to the side holding a gold orb, lightning-bolt wings
// on its back, gold antenna-horns (the ear joints) and a whip tail with a spark bulb. Numbers are scad/voltaura.scad's.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, mx, pair, petal, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near } from './lib/geo.mjs';

const BLUE = [0.08, 0.22, 0.6];
const WING = [[1, 1, 0.78], [0.55, 0.85, 1]];
const TAIL = [[0, 2.6, 15], [3, 6, 11], [7, 8, 5], [12, 7, 2.5], [15.5, 4, 4], [16, 1.5, 9], [14.5, 1, 12.5]];
const TAIL_R = [1.4, 1.1, 0.8, 0.65, 0.55, 0.5, 0.45];
const tails = ['tail1', 'tail2', 'tail3', 'tail4', 'tail5'];
const ORB = [-11.6, -3.6, 26.6];
const BULB = [14.2, 0.8, 13.8];
const sin = (a) => Math.sin((a * Math.PI) / 180);
const ANT = [[1, -1, 32.6], [2.4, -0.5, 35.5], [3.6, 0.6, 38.5], [5.4, 2.5, 40], [6.6, 3.8, 39.6]];

const eyeL = { side: 'L', at: [1.45, -3, 31.2], size: 1.25, yaw: 22 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: BLUE });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [2.8, 0, 15]),
  { name: 'body', parent: 'root', at: [0, 0, 15.5] },
  { name: 'head', parent: 'body', at: [0, -0.4, 25.5] },
  ...pair('ear*', 'head', ANT[0]),
  ...pair('wing*', 'body', [1.2, 2.4, 22]),
  { name: 'armL', parent: 'body', at: [5, 0, 24.5] },
  { name: 'foreL', parent: 'armL', at: [7, -1, 19] },
  { name: 'handL', parent: 'foreL', at: [7.6, -2.4, 14.5] },
  { name: 'armR', parent: 'body', at: [-5, 0, 24.5] },
  { name: 'foreR', parent: 'armR', at: [-8.5, -1.5, 22] },
  { name: 'handR', parent: 'foreR', at: [-11, -3, 23.5] },
  { name: 'orb', parent: 'handR', at: ORB },
  ...TAIL.slice(0, 5).map((p, i) => ({ name: tails[i], parent: i ? tails[i - 1] : 'body', at: p })),
  ...face.joints,
];

const parts = [
  ['body', any(blob([[[4.6, 3.2, 2.8], [0, 0, 15.5]], [[3, 2.4, 2.4], [0, 0, 19]]]), blob([[[4.8, 3.2, 3.6], [0, 0, 23]], [[2.8, 2.4, 2.4], [0, 0, 19.5]]]),
    mx(petal([2.2, 1, 0.8], [2.6, -1.6, 25.6], [0, 10, -20])))],
  ['head', any(limb([0, -0.4, 25], [0, -1.5, 29.5], 1.5, 1.3), blob([[[2.2, 2.4, 2.4], [0, -1.6, 31]], [[1.3, 1.8, 1.3], [0, -4.8, 29.6]]]),
    mx(ell([1.6, 1.2, 1], [1.6, -3.1, 32.2])))],
  ...chain(['ear*'], ANT, [0.9, 0.85, 0.7, 0.45, 0.25]),
  ['ear*', ell([0.7, 0.7, 0.7], [6.8, 4, 39.6])],
  ['arm*', any(ell([1.8, 1.6, 1.6], [5, 0, 24.8]), ell([1.8, 1.8, 0.8], [5.3, 0, 24]))],
  ['armL', limb([5, 0, 24.5], [7, -1, 19], 1.2, 1)],
  ['foreL', any(limb([7, -1, 19], [7.6, -2.4, 14.5], 1, 0.8), ell([1.2, 1.2, 1.5], [7.2, -1.5, 17.5]))],
  ['handL', any(...[-30, 0, 30].map((a) => spike([7.6 + sin(a) * 0.6, -2.6, 13.8], [sin(a) * 0.6, -0.6, -1.6], 0.3)))],
  ['armR', limb([-5, 0, 24.5], [-8.5, -1.5, 22], 1.2, 1)],
  ['foreR', any(limb([-8.5, -1.5, 22], [-11, -3, 23.5], 1, 0.9), ell([1.2, 1.2, 1.2], [-9.8, -2.2, 22.7]))],
  ['handR', any(ell([1.3, 1.2, 0.9], [-11.4, -3.2, 23.6]), ...[-30, 30].map((a) => spike([-11.4 + sin(a), -3.6, 24.2], [sin(a) * 0.4, -0.3, 1.4], 0.3)))],
  ['orb', ell([2.4, 2.4, 2.4], ORB)],
  ['leg*', any(limb([2.8, 0, 15], [3.8, -2, 10], 2.4, 1.8), limb([3.8, -2, 10], [4.2, 1, 5], 1.6, 1.1), limb([4.2, 1, 5], [4.4, -0.5, 1.2], 1, 0.9),
    blob([[[1.4, 2.4, 0.9], [4.4, -1.5, 0.9]]]), ell([1.6, 1.2, 0.6], [3.8, -2.3, 10.2]), ell([1.4, 1.2, 0.5], [4.4, -4.2, 0.6]))],
  ...chain(tails, TAIL, TAIL_R.map((r) => r * 1.3)),
  ['tail5', ell([1.3, 1.3, 1.8], BULB)],
];

function assign(c, rgb) {
  if (isAny(rgb, WING)) {
    if (c[2] > 37) return c[0] > 0 ? 'earL' : 'earR';
    if (Math.hypot(c[0] - BULB[0], c[1] - BULB[1], c[2] - BULB[2]) < 2.6) return 'tail5';
    return c[0] > 0 ? 'wingL' : 'wingR';
  }
  if (near(rgb, [0.9, 0.97, 1])) return 'tail5';
  return pick(c, parts);
}

// the orb hums: a slow spin, a pulse on counted beats
const orb = (u, spins = 1, pulse = 0.05) => ({ orb: { r: [0, 0, 360 * spins * u], s: 1 + pulse * Math.abs(Math.sin(TAU * 4 * u)) } });
// the spark bulb flickers
const bulb = (u, beats = 8) => ({ tail5: { s: 1 + 0.12 * ((Math.floor(u * beats) * 7) % 3 === 0 ? 1 : -0.3) } });

const base = bipedClips({
  face, tail: tails, hipH: 14.5, stride: 20, armSwing: 18, hopScale: 0.9, hopH: 3,
  wing: { open: [0, -14, 10], flap: 12 },
  // the orb arm swings round to the front, the orb thrust at the foe
  punch: { arm: [0, 0, 60], fore: [0, 0, 25] },
  cheer: { arm: [-6, -110, 0], fore: [-8, 10, 0] },
  add: {
    idle: (t, u) => ({ ...orb(u, 1), ...bulb(u, 16) }),
    walk: (t, u) => ({ ...orb(u, 1), ...bulb(u, 4) }),
    idle_look: (t, u) => ({ ...orb(u, 1), ...bulb(u, 8) }),
    windup: (t, u) => orb(u, 0.5, 0.25 * smooth(u)),
    lunge: (t, u) => orb(u, 1, 0.35 * K(u, [[0, 0], [0.4, 1], [1, 0]])),
    celebrate: (t, u) => ({ ...orb(u, 2, 0.2), ...bulb(u, 8) }),
    enter: (t, u) => ({ ...orb(smooth(u), 1, 0.2), ...bulb(u, 6) }),
    exit: (t, u) => orb(u, 1),
  },
});

const clips = {
  ...base,

  // fidget: it tosses the orb up off its palm, watches it spin and catches it
  idle_toss: {
    seconds: 2,
    pose: (t, u) => {
      const air = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.2) / 0.5))));
      const flick = win(u, 0.12, 0.28, 0.05) + win(u, 0.66, 0.8, 0.05);
      return {
        orb: { p: [0, 0, 9 * air], r: [0, 0, 720 * smooth((u - 0.2) / 0.5)] },
        head: { r: [-14 * air, 0, -14 * air] },
        ...face.pose('open', blinks(u, [[0.86, 0.92]])),
        armR: { r: [0, 0, 0] }, foreR: { r: [-8 * flick, -14 * flick, 0] },
        ...both('ear', { r: [-6 * air, 0, 0] }),
        ...tails.reduce((o, n, i) => ({ ...o, [n]: { r: [0, 0, 5 * osc(u, 1, i * 0.1)] } }), {}),
      };
    },
  },

  // fidget: a crackle of charge: the wings buzz open, the antennae and the tail bulb flare, a quick shiver
  idle_charge: {
    seconds: 1.8,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.65, 1], [0.85, 0]]);
      const buzz = Math.sin(TAU * 12 * u) * on;
      return merge({
        body: { r: [-3 * on, 0, 0.8 * buzz] },
        head: { r: [-6 * on, 0, 0] },
        ...face.pose(on > 0.5 ? 'squeeze' : 'open'),
        ...both('wing', { r: [0, -14 * on + 3 * buzz, 10 * on] }),
        ...both('ear', { r: [-10 * on, -2 * buzz, 0] }),
        ...both('arm', { r: [0, -10 * on, 0] }),
        tail5: { s: 1 + 0.4 * on + 0.15 * buzz },
      }, orb(u, 2, 0.3 * on));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
