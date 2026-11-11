// Voltaura's rig: a slim electric biped leaning forward, its right arm out front holding a gold orb over the palm,
// lightning-bolt wings on its back (an upper and a lower bolt per side, one joint each side), gold blade-horns (the ear
// joints) and a long looping tail that ends in a blue crystal. Numbers are scad/voltaura.scad's. The head sits off
// centre (x -0.9), so its eyes and horns are written out per side instead of mirrored.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, mx, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { isAny, near } from './lib/geo.mjs';

const BLUE = [0.08, 0.28, 0.53];
const WING = [[0.94, 0.97, 0.69], [0.6, 0.86, 0.95]];
const SPARK = [0.67, 0.91, 0.96];
const CRYSTAL = [0.3, 0.55, 0.85];
const add = (a, b) => a.map((v, i) => v + b[i]);

// head
const H = [-0.9, -7, 28.6];
const HEAD = [[[2.55, 2.75, 2.1], add(H, [0, 0.4, 0.75])], [[2.0, 2.4, 1.7], add(H, [0, -2.5, -0.5])], [[1.45, 1.6, 1.0], add(H, [0, -2.6, -1.65])]];
const EYE = [1.85, -3.0, -0.5];
const eyeAt = (s) => [H[0] + s * EYE[0], H[1] + EYE[1], H[2] + EYE[2]];
const face = eyeKit({
  eyes: [
    { side: 'L', at: eyeAt(1), size: 1.0, yaw: 46, flat: 0.5 },
    { side: 'R', at: eyeAt(-1), size: 1.0, yaw: -46, flat: 0.5 },
  ],
  skin: BLUE,
});
const HORN = [[1.45, -4.0, 0.15], [2.05, -2.2, 1.2], [2.05, -0.2, 1.95], [2.25, 2.0, 4.1], [2.7, 4.6, 5.9], [3.1, 7.6, 6.4], [3.6, 11.8, 6.0]];
const HORN_R = [0.24, 0.38, 0.75, 0.9, 0.55, 0.26, 0.12];
const horn = (s) => HORN.map((q) => [H[0] + s * q[0], H[1] + q[1], H[2] + q[2]]);
const hornTip = (s) => { const t = HORN[HORN.length - 1]; return [H[0] + s * (t[0] + 0.2), H[1] + t[1] + 0.3, H[2] + t[2] + 0.2]; };

// torso, arms, legs
const NECK = [[0, -2.5, 22.8], [-0.35, -4.4, 25.6], [-0.8, -6.0, 27.6]];
const CHEST = [[[3.3, 2.0, 1.5], [0, -2.6, 22.6]], [[3.0, 2.2, 2.4], [0, -2.2, 20.3]], [[1.9, 1.7, 1.8], [0, -1.2, 16.8]]];
const ARM_N = [[3.7, -2.6, 22.0], [6.7, 0.4, 19.6], [6.2, -3.0, 13.8]];
const ARM_F = [[-3.7, -2.6, 22.0], [-3.7, -3.4, 17.3], [-7.2, -8.0, 17.5]];
const HAND_F = [-8.4, -9.5, 18.3];
const ORB = [-8.2, -9.3, 22.9];
const LEG_N = [[1.9, 0.3, 12.3], [4.2, -2.6, 9.2], [5.4, 0.4, 5.2], [5.9, -0.8, 1.4], [7.0, -2.9, 0.7]];
const LEG_F = [[-1.9, 0.3, 12.3], [-3.8, -2.4, 9.0], [-3.6, 1.2, 5.5], [-3.8, -0.4, 1.4], [-4.6, -2.9, 0.7]];
const legTest = ([hip, knee, hock, ankle, toe]) => any(
  limb(hip, knee, 2.2, 1.4), limb(knee, hock, 1.45, 1.15), limb(hock, ankle, 1.15, 0.95),
  blob([[[1.1, 1.1, 0.85], add(ankle, [0, 0, -0.55])], [[0.95, 0.95, 0.65], toe]]),
  ell([1.5, 1.5, 1.0], add(toe, [(toe[0] - ankle[0]) * 0.4, (toe[1] - ankle[1]) * 0.4, 0])));

// tail: two cords from the hip, then one tube round the loop, the cup and the crystal
const T_ROOT = [[0, 2.5, 13.6], [5.25, 2.4, 12.6], [8.5, 1.8, 9.8], [10.3, 1.2, 6.3], [12.5, 0.8, 4.4]];
const T_ROOT2 = T_ROOT.map((p) => add(p, [0.65, 0, 0.65]));
const T_LOOP = [[12.5, 0.8, 4.4], [16.5, 0.4, 3.7], [20.4, 0, 4.9], [21.9, 0, 7.6], [21.6, 0, 10.2], [20.3, 0, 12.6], [19.6, 0, 14.8], [20.0, 0, 16.0]];
const T_LOOP_R = [0.7, 0.72, 0.72, 0.7, 0.62, 0.5, 0.42, 0.42];
const CRYS = [20.4, 0, 17.4];
const tails = ['tail1', 'tail2', 'tail3', 'tail4', 'tail5', 'tail6'];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: LEG_N[0] },
  { name: 'legR', parent: 'root', at: LEG_F[0] },
  { name: 'body', parent: 'root', at: [0, 0.3, 13] },
  { name: 'head', parent: 'body', at: NECK[0] },
  { name: 'earL', parent: 'head', at: horn(1)[2] },
  { name: 'earR', parent: 'head', at: horn(-1)[2] },
  { name: 'wingL', parent: 'body', at: [1.2, 0.4, 22] },
  { name: 'wingR', parent: 'body', at: [-1.2, 0.4, 22] },
  { name: 'armL', parent: 'body', at: ARM_N[0] },
  { name: 'foreL', parent: 'armL', at: ARM_N[1] },
  { name: 'handL', parent: 'foreL', at: ARM_N[2] },
  { name: 'armR', parent: 'body', at: ARM_F[0] },
  { name: 'foreR', parent: 'armR', at: ARM_F[1] },
  { name: 'handR', parent: 'foreR', at: ARM_F[2] },
  { name: 'orb', parent: 'handR', at: ORB },
  { name: 'tail1', parent: 'body', at: T_ROOT[0] },
  { name: 'tail2', parent: 'tail1', at: T_ROOT[2] },
  { name: 'tail3', parent: 'tail2', at: T_LOOP[0] },
  { name: 'tail4', parent: 'tail3', at: T_LOOP[2] },
  { name: 'tail5', parent: 'tail4', at: T_LOOP[4] },
  { name: 'tail6', parent: 'tail5', at: T_LOOP[6] },
  ...face.joints,
];

const parts = [
  ['body', any(blob(CHEST), ell([1.8, 1.6, 2.0], [0, -0.5, 15.2]), ell([2.6, 2.2, 2.0], [0, 0.3, 12.6]), ell([2.2, 2.0, 1.3], [0, -2.75, 23.6]))],
  ['head', any(...chain(['h'], NECK, [1.75, 1.45, 1.25]).map((e) => e[1]), blob(HEAD))],
  ['head', any(limb(horn(1)[0], horn(1)[1], 0.24, 0.38), limb(horn(1)[1], horn(1)[2], 0.38, 0.75),
    limb(horn(-1)[0], horn(-1)[1], 0.24, 0.38), limb(horn(-1)[1], horn(-1)[2], 0.38, 0.75))],
  ...chain(['earL'], horn(1).slice(2), HORN_R.slice(2)),
  ...chain(['earR'], horn(-1).slice(2), HORN_R.slice(2)),
  ['earL', ell([0.9, 0.9, 1.6], add(hornTip(1), [0, 0, 0.6]))],
  ['earR', ell([0.9, 0.9, 1.6], add(hornTip(-1), [0, 0, 0.6]))],
  ['arm*', ell([1.55, 1.6, 1.7], [3.7, -2.6, 22.1])],
  ['armL', any(limb(ARM_N[0], ARM_N[1], 1.1, 0.95), ell([1.4, 1.4, 1.4], add(ARM_N[0], [0.9, 0.6, -0.8])))],
  ['foreL', limb(ARM_N[1], ARM_N[2], 1.3, 1.1)],
  ['handL', any(ell([1.05, 1.0, 1.1], [6.1, -3.2, 13.0]),
    ...[-1.5, -0.5, 0.5, 1.5].map((k) => spike(add([6.1, -3.3, 12.6], [0.866 * k * 0.75, 0.5 * k * 0.75, 0]), [k * 0.35, -0.5, -2.7], 0.36)))],
  ['armR', any(limb(ARM_F[0], ARM_F[1], 1.1, 1.0), ell([1.3, 1.3, 0.6], add(ARM_F[0], [-0.3, 0, -1.2])))],
  ['foreR', limb(ARM_F[1], ARM_F[2], 1.3, 1.1)],
  ['handR', any(ell([1.3, 1.3, 0.85], HAND_F),
    ...[100, 140, 180, 220, 330].map((a) => { const c = Math.cos((a * Math.PI) / 180); const s = Math.sin((a * Math.PI) / 180); return spike(add(HAND_F, [c * 1.05, s * 1.05, 0.3]), [c * 0.55, s * 0.55, 2.0], 0.38); }))],
  ['orb', ell([2.15, 2.15, 2.15], ORB)],
  ['legL', legTest(LEG_N)],
  ['legR', legTest(LEG_F)],
  ...chain(['tail1', 'tail1', 'tail2', 'tail2'], T_ROOT, [0.55, 0.42, 0.4, 0.42, 0.55]),
  ...chain(['tail1', 'tail1', 'tail2', 'tail2'], T_ROOT2, [0.5, 0.38, 0.36, 0.38, 0.5]),
  ...chain(['tail3', 'tail3', 'tail4', 'tail4', 'tail5', 'tail5', 'tail6'], T_LOOP, T_LOOP_R),
  ['tail6', any(ell([1.0, 1.0, 1.6], [20.05, 0, 16.0]), ell([0.95, 0.9, 1.35], CRYS))],
];

function assign(c, rgb) {
  if (isAny(rgb, WING)) return c[0] > 0 ? 'wingL' : 'wingR';
  if (near(rgb, SPARK)) {
    if (c[2] > 32) return c[0] > H[0] ? 'earL' : 'earR';
    if (Math.hypot(c[0] - ORB[0], c[1] - ORB[1], c[2] - ORB[2]) < 4) return 'orb';
    return 'tail6';
  }
  if (near(rgb, CRYSTAL)) return 'tail6';
  // the orb's gold and its dark seams
  if (Math.hypot(c[0] - ORB[0], c[1] - ORB[1], c[2] - ORB[2]) < 2.5) return 'orb';
  return pick(c, parts);
}

// the orb hums: a slow spin, a pulse on counted beats
const orb = (u, spins = 1, pulse = 0.05) => ({ orb: { r: [0, 0, 360 * spins * u], s: 1 + pulse * Math.abs(Math.sin(TAU * 4 * u)) } });
// the tail crystal flickers
const bulb = (u, beats = 8) => ({ tail6: { s: 1 + 0.08 * ((Math.floor(u * beats) * 7) % 3 === 0 ? 1 : -0.3) } });

const base = bipedClips({
  face, tail: tails, hipH: 12.3, stride: 20, armSwing: 18, hopScale: 0.9, hopH: 3,
  wing: { open: [0, -14, 10], flap: 12 },
  // the orb thrust forward and up at the foe, swung outwards so it clears the face
  punch: { arm: [-30, 0, -20], fore: [-15, 0, 0] },
  cheer: { arm: [-6, -110, 0], fore: [-8, 10, 0] },
  add: {
    idle: (t, u) => ({ ...orb(u, 1), ...bulb(u, 16) }),
    walk: (t, u) => ({ ...orb(u, 1), ...bulb(u, 4) }),
    idle_look: (t, u) => ({ ...orb(u, 1), ...bulb(u, 8) }),
    windup: (t, u) => orb(u, 0.5, 0.25 * smooth(u)),
    lunge: (t, u) => orb(u, 1, 0.35 * K(u, [[0, 0], [0.4, 1], [1, 0]])),
    // the orb arm stays out front (the template would raise it over the head, the orb through the face): undo
    // most of its cheer and lift the orb a little instead
    celebrate: (t, u) => {
      const up = win(u, 0, 1, 0.15);
      return { ...orb(u, 2, 0.2), ...bulb(u, 8), armR: { r: [6 * up - 20 * up, -100 * up, 0] }, foreR: { r: [8 * up, 10 * up, 0] } };
    },
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
        ...tails.reduce((o, n, i) => ({ ...o, [n]: { r: [0, 0, 4 * osc(u, 1, i * 0.1)] } }), {}),
      };
    },
  },

  // fidget: a crackle of charge: the wings buzz open, the horns and the tail crystal flare, a quick shiver
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
        tail6: { s: 1 + 0.3 * on + 0.1 * buzz },
      }, orb(u, 2, 0.3 * on));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
