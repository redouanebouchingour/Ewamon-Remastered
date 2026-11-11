// Tsunamite's rig: Tidespine grown into a crocodile-dragon standing side-on in a stride. Built like Tidespine's: a
// thick neck into a head turned 50 deg towards the creature's right (the scad's headFrame, authored with S()) whose
// cream lower jaw opens, the far arm reaching forward in its purple gauntlet, the near one hanging under the big
// shoulder crystal, legs off the root (not mirrored: the far one strides forward), a tail curling up into the paddle,
// and the great purple sail on its own joint (it flares). Numbers are scad/tsunamite.scad's.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, inFrame, limb, pick, ppFrame, slab, spike } from './lib/biped.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { isAny, near, plateD, subFrame, unrot } from './lib/geo.mjs';

const TEAL = [0.27, 0.55, 0.64];
const CREAM = [0.94, 0.89, 0.64];
const TOOTH = [0.98, 0.97, 0.9];
const BUBBLE = [0.75, 0.93, 0.97];
const GEM = [0.35, 0.8, 1];
const PURPLES = [[0.55, 0.45, 0.7], [0.56, 0.45, 0.72], [0.25, 0.21, 0.36], [0.3, 0.55, 0.56]];
const PADDLE = [[0.56, 0.67, 0.67], [0.4, 0.5, 0.56]];

// ---- the head frame (scad headFrame(): translate(HC) rotate([0, 0, -50]))
const HEAD_YAW = -50;
const HC = [-6.5, -11.5, 0];
const HS = 0.866 * HC[0] + 0.5 * HC[1];
const HF = subFrame(HC, [0, 0, HEAD_YAW], 1);
const S = (sx, z, x = 0) => [x, (sx - HS - 0.174 * x) / 0.985, z];
const H = (sx, z, x = 0) => HF.world(S(sx, z, x));

const eyes = [1, -1].map((k) => ({ side: k > 0 ? 'L' : 'R', at: S(-11.5, 31.2, 2.6 * k), size: 1.05, yaw: 64 * k, flat: 0.55, frame: HF }));
const face = eyeKit({ eyes, skin: TEAL });
// the eye kit places its joints in world terms; the head joint carries the head's yaw, so take it out again
const faceJoints = face.joints.map((j) => ({ ...j, rot: [j.rot[0], j.rot[1], j.rot[2] - HEAD_YAW] }));

const NECK = [[-1.6, -5, 22], [-3.2, -8, 26.5], [-4.6, -10, 29.6], [-5.8, -11.4, 31.2]];
const NECK_R = [6, 5.2, 4.2, 3.4];
const TAIL = [[0, 5.5, 11], [2.8, 10, 9.6], [6.4, 13, 9], [10.2, 14, 10.4], [11, 13.8, 13.6], [11.4, 13.6, 17.8], [11.8, 13.6, 21.6], [12.4, 13.6, 25.4]];
const TAIL_R = [5, 4.2, 3.6, 3, 2.4, 1.9, 1.5, 1.1];
const LEGS = {
  L: { thigh: [5.2, 2.2, 12], tr: [4.2, 5.2, 6.4], knee: [5.8, 4.6, 6.4], ankle: [6, 5, 2.4], foot: [6, 2.6, 1.3] },
  R: { thigh: [-5, -1, 12], tr: [3.8, 4.8, 5.8], knee: [-5.6, -4.8, 7.2], ankle: [-5.8, -7.4, 2.6], foot: [-6, -9.6, 1.3] },
};
const ARMS = {
  L: [[3.4, -6.8, 21], [3.6, -9.8, 16.6], [2.6, -11.6, 13.2]],
  R: [[-3.4, -6.6, 21], [-6, -10.4, 17.6], [-7.4, -14.2, 14.6]],
};
const ARM_R = { L: [2.5, 2.1, 1.9], R: [2.6, 2.3, 2] };
const PCX = 16.2;
const PADDLE_PTS = Array.from({ length: 18 }, (_, i) => [PCX + 3.7 * Math.cos((i * 20 * Math.PI) / 180), 24.5 + 6.1 * Math.sin((i * 20 * Math.PI) / 180)]);
const SAIL_PTS = [[-1.2, 21.6], [-3.2, 25], [-3.6, 30], [-2.6, 34.4], [-1.4, 37.8], [0, 40], [2.2, 40], [3.4, 38.8], [4.6, 38.2],
  [5.4, 36.8], [6.4, 35.2], [7, 33.8], [7.8, 32.8], [8.4, 31], [9.2, 29.4], [9.6, 27.4], [9.8, 24], [10, 19.6],
  [9.6, 15], [9.2, 12.4], [8, 10.6], [5.6, 12.4], [2.6, 16.6]];
const SAILF = ppFrame(3.4);
const sailLocal = (c) => { const q = SAILF.local(c); const r = unrot([-24, 0, 0], [q[0], q[1], q[2] - 16]); return [r[0], r[1], r[2] / 1.09 + 16]; };
const SAIL = (c) => plateD(sailLocal(c), SAIL_PTS, 1.6);
const add = (a, b) => a.map((v, i) => v + b[i]);

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: LEGS.L.thigh },
  { name: 'legR', parent: 'root', at: LEGS.R.thigh },
  { name: 'body', parent: 'root', at: [0, 1.5, 11] },
  { name: 'sail', parent: 'body', at: SAILF.world([4, 0, 16]) },
  { name: 'head', parent: 'body', at: NECK[1], rot: [0, 0, HEAD_YAW] },
  { name: 'jaw', parent: 'head', at: H(-8.6, 27.6) },
  { name: 'armL', parent: 'body', at: ARMS.L[0] },
  { name: 'foreL', parent: 'armL', at: ARMS.L[1] },
  { name: 'armR', parent: 'body', at: ARMS.R[0] },
  { name: 'foreR', parent: 'armR', at: ARMS.R[1] },
  { name: 'tail1', parent: 'body', at: TAIL[1] },
  { name: 'tail2', parent: 'tail1', at: TAIL[3] },
  { name: 'tail3', parent: 'tail2', at: TAIL[5] },
  ...faceJoints,
];

const legTest = ({ thigh, tr, knee, ankle, foot }) => any(
  ell(tr, thigh), limb(add(thigh, [0.2, 0.6, -3]), knee, 3.4, 2.6), limb(knee, ankle, 2.6, 2.2), limb(ankle, foot, 2.2, 1.8),
  ell([2.6, 2.8, 1.3], foot), limb(add(foot, [-2, -2.1, -0.2]), add(foot, [2, -2.1, -0.2]), 1.3),
  ...[-1, 0, 1].map((k) => spike(add(foot, [k * 2, -2.6 - Math.abs(k) * 0.3, -0.1]), [k * 0.4, -1.5, -0.8], 0.9)));
const HAND = {
  L: any(ell([2.2, 2, 1.8], [2.2, -12.6, 11.8]), limb([1.1, -13.8, 11.2], [3.5, -14.4, 8.4], 1), ell([4.2, 3.2, 4.2], [5, -10.2, 18.2]),
    limb([5.4, -10.6, 20.2], [4.2, -13.4, 23.6], 1.6), limb([5.4, -8, 19], [7.6, -9, 21.6], 1.2)),
  R: any(ell([2.3, 2.1, 1.9], [-7.8, -15.6, 13.4]), limb([-9, -16.8, 13], [-6.4, -17.6, 9.6], 1), ell([3.6, 3.8, 3.6], [-6.8, -12.4, 16]),
    limb([-7.6, -11.6, 17.4], [-10, -11.8, 21.4], 1.5), limb([-8.4, -13.2, 15.6], [-11.4, -14.6, 17.4], 1.3), limb([-6, -11.2, 18.2], [-6.2, -12.2, 21.4], 1.1)),
};

const parts = [
  ['body', any(ell([5.6, 5.6, 6.8], [-1.6, -5, 19]), ell([7, 7, 7.4], [0.4, 2.6, 13.5]), limb(NECK[0], NECK[1], NECK_R[0], NECK_R[1]))],
  ['sail', SAIL],
  ['head', any(limb(NECK[1], NECK[2], NECK_R[1], NECK_R[2]), limb(NECK[2], NECK[3], NECK_R[2], NECK_R[3]),
    inFrame(HF, any(blob([[[3.3, 3.6, 2.9], S(-11.2, 31.4)], [[3.3, 2.6, 3.2], S(-7.8, 30.8)], [[2.4, 2.6, 1.7], S(-15.4, 28.6)], [[1.8, 1.6, 1.1], S(-19.6, 27.4)]]),
      limb(S(-13.4, 33.2, 1.4), S(-12.2, 36.8, 1.8), 1.1), limb(S(-13.4, 33.2, -1.4), S(-12.2, 36.8, -1.8), 1.1),
      limb(S(-9.8, 33.6, 1.5), S(-7.6, 36.8, 1.9), 1.2), limb(S(-9.8, 33.6, -1.5), S(-7.6, 36.8, -1.9), 1.2))))],
  ['jaw', inFrame(HF, blob([[[1.6, 1.6, 0.75], S(-19.4, 25.2)], [[2.9, 3.2, 1.6], S(-10.6, 26.4)]]))],
  ...['L', 'R'].flatMap((s) => [
    [`arm${s}`, limb(ARMS[s][0], ARMS[s][1], ARM_R[s][0], ARM_R[s][1])],
    [`fore${s}`, any(limb(ARMS[s][1], ARMS[s][2], ARM_R[s][1], ARM_R[s][2]), HAND[s])],
    [`leg${s}`, legTest(LEGS[s])],
  ]),
  ...chain(['body', 'tail1', 'tail1', 'tail2', 'tail2', 'tail3', 'tail3'], TAIL, TAIL_R.map((r) => r * 1.15)),
  ['tail3', slab(PADDLE_PTS, 2.4, 1.4, ppFrame(5.4))],
];
const only = (...names) => parts.filter(([n]) => names.includes(n));

function assign(c, rgb) {
  if (near(rgb, BUBBLE) || near(rgb, GEM)) return 'body';
  if (isAny(rgb, PADDLE) && c[0] > 9) return 'tail3';
  if (isAny(rgb, PURPLES)) return pick(c, only('sail', 'foreL', 'foreR', 'tail3'));
  if (near(rgb, TOOTH)) return HF.local(c)[2] < 26.2 ? 'jaw' : 'head';
  if (near(rgb, CREAM)) {
    if (pick(c, only('head', 'jaw')) === 'jaw' && HF.local(c)[2] < 27.4) return 'jaw';
    return pick(c, only('body', 'head', 'tail1', 'tail2'));
  }
  return pick(c, parts.filter(([n]) => n !== 'sail'));
}

const jawK = (k) => ({ jaw: { r: [k, 0, 0] } });

const base = bipedClips({
  face, tail: ['tail1', 'tail2', 'tail3'], hipH: 12, stride: 13, armSwing: 10, hopScale: 0.3, droop: 0.6,
  // a crystal-gauntlet hammer blow, jaws wide
  punch: { arm: [-75, 10, 0], fore: [-25, 0, 0] },
  cheer: { arm: [-20, -95, 0], fore: [-30, 0, 0] },
  add: {
    idle: (t, u) => ({ sail: { r: [1.5 * osc(u, 2, 0.4), 0, 0] } }),
    walk: (t, u) => ({ sail: { r: [2 * osc(u, 2, 0.2), 0, 1.5 * osc(u, 1)] } }),
    windup: (t, u) => merge(jawK(14 * Math.min(1, u / 0.8)), { sail: { s: 1 + 0.05 * Math.min(1, u / 0.8) } }),
    lunge: (t, u) => merge(jawK(22 * K(u, [[0, 0.6], [0.3, 1], [0.45, 0], [1, 0]])), { sail: { s: 1.05 - 0.05 * u } }),
    hurt: (t, u) => jawK(10 * K(u, [[0, 0], [0.2, 1], [1, 0.3]])),
    celebrate: (t, u) => merge(jawK(18 * win(u, 0, 1, 0.15)), { sail: { s: 1 + 0.06 * Math.abs(Math.sin(TAU * u)) } }),
  },
});

const clips = {
  ...base,

  // fidget: the croc snap. It eyes something, then the jaws clap shut twice, hard
  idle_snap: {
    seconds: 2.2,
    pose: (t, u) => {
      const eye = K(u, [[0, 0], [0.15, 1], [0.8, 1], [0.95, 0]]);
      const snap = (u0) => K(u, [[u0, 0], [u0 + 0.08, 1], [u0 + 0.12, 0]]);
      const s = snap(0.35) + snap(0.55);
      return {
        body: { r: [4 * eye, 0, 0] },
        head: { r: [6 * eye - 4 * s, 0, 8 * eye] },
        ...jawK(26 * s),
        ...face.pose('open', 0.35 * eye),
        ...both('arm', { r: [-8 * eye, 0, 0] }),
      };
    },
  },

  // fidget: it rears up and flares its great sail, then shakes it down with a rattle
  idle_flare: {
    seconds: 2.8,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.25, 1], [0.55, 1], [0.7, 0]]);
      const rat = Math.sin(TAU * 9 * u) * win(u, 0.65, 0.95, 0.04);
      return {
        root: { r: [-2 * up, 0, 0] },
        body: { r: [-7 * up, 0, 2 * rat] },
        head: { r: [-10 * up, 0, 0] },
        sail: { s: 1 + 0.08 * up, r: [3 * rat, 0, 2 * rat] },
        ...jawK(14 * up),
        ...face.pose(up > 0.6 ? 'squeeze' : 'open', blinks(u, [[0.88, 0.93]])),
        ...both('arm', { r: [-20 * up, -25 * up, 0] }),
        ...both('fore', { r: [-30 * up, 0, 0] }),
      };
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
