// Tidespine's rig: a small blue dinosaur standing side-on in a stride, an ice-crystal sail on its back, a long thick
// neck into a head turned 50 deg towards the creature's right (the scad's headFrame, authored with S()) whose cream
// lower jaw opens, short arms with stone-and-crystal hands (the near one in front of the belly, the far one reaching
// forward) and a thick tail curling up into a grey fan fin. The legs are not mirrored (the far one strides forward),
// so every sided part is written out. Numbers are scad/tidespine.scad's.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, inFrame, limb, pick, ppFrame, slab, spike } from './lib/biped.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { isAny, near, subFrame } from './lib/geo.mjs';

const BLUE = [0.24, 0.49, 0.62];
const CREAM = [0.89, 0.85, 0.63];
const CREAM_DK = [0.74, 0.69, 0.5];
const STONES = [[0.34, 0.37, 0.37], [0.46, 0.5, 0.48], [0.2, 0.25, 0.27]];
const CRYSTALS = [[0.73, 0.85, 0.86], [0.87, 0.97, 0.97], [0.57, 0.68, 0.7]];
const FAN = [0.5, 0.54, 0.53];
const GEM = [0.35, 0.8, 1];
const EYES = [[0.07, 0.13, 0.19], [0.45, 0.78, 0.95], [0.03, 0.07, 0.1], [1, 1, 1]];

// ---- the head frame (scad headFrame(): translate(HC) rotate([0, 0, -50]))
const HEAD_YAW = -50;
const HC = [-6.5, -11.5, 0];
const HS = 0.866 * HC[0] + 0.5 * HC[1];
const HF = subFrame(HC, [0, 0, HEAD_YAW], 1);
const S = (sx, z, x = 0) => [x, (sx - HS - 0.174 * x) / 0.985, z];
const H = (sx, z, x = 0) => HF.world(S(sx, z, x));

const eyes = [1, -1].map((k) => ({ side: k > 0 ? 'L' : 'R', at: S(-13.3, 33.6, 2.7 * k), size: 1.9, yaw: 64 * k, flat: 0.55, frame: HF }));
const face = eyeKit({ eyes, skin: BLUE });
// the eye kit places its joints in world terms; the head joint carries the head's yaw, so take it out again
const faceJoints = face.joints.map((j) => ({ ...j, rot: [j.rot[0], j.rot[1], j.rot[2] - HEAD_YAW] }));

const NECK = [[-1.6, -5, 23], [-3.2, -8, 27.5], [-4.6, -10, 31], [-5.8, -11.4, 33.4]];
const NECK_R = [5.6, 5, 4.2, 3.4];
const TAIL = [[0, 5, 12], [2.6, 9.4, 10.6], [6, 12.2, 10], [9.6, 13.2, 11.2], [12, 13.2, 14.4], [13, 13, 18.6], [13.6, 13, 22.6], [14.4, 13, 26.6]];
const TAIL_R = [4.4, 3.7, 3.2, 2.7, 2.2, 1.8, 1.4, 1];
const LEGS = {
  L: { thigh: [4.8, 2.2, 12.8], tr: [3.8, 4.8, 6.2], knee: [5.4, 4.6, 6.8], ankle: [5.6, 5, 2.4], foot: [5.6, 2.8, 1.1] },
  R: { thigh: [-4.6, -1, 12.8], tr: [3.4, 4.4, 5.4], knee: [-5.2, -4.6, 7.6], ankle: [-5.4, -7, 2.6], foot: [-5.6, -9, 1.1] },
};
const ARMS = {
  L: [[3, -6.8, 21.4], [4, -8.6, 18], [2.6, -9.8, 16]],
  R: [[-3.2, -6.4, 21.2], [-5.4, -9.4, 18.8], [-6.6, -12.4, 17.2]],
};
const ARM_R = { L: [2.1, 1.8, 1.6], R: [2.3, 2, 1.8] };
const FAN_PTS = [[14.6, 19.4], [13.4, 22.6], [13.3, 26.6], [14.4, 29.4], [16.4, 31], [18.6, 31.2], [20.5, 29.6], [21.4, 26.6], [21.2, 22.6], [20, 19.6], [18.2, 17.8], [16.2, 18]];
const FANF = ppFrame(4.8);
const add = (a, b) => a.map((v, i) => v + b[i]);

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: LEGS.L.thigh },
  { name: 'legR', parent: 'root', at: LEGS.R.thigh },
  { name: 'body', parent: 'root', at: [0, 1.5, 12] },
  { name: 'head', parent: 'body', at: NECK[1], rot: [0, 0, HEAD_YAW] },
  { name: 'jaw', parent: 'head', at: H(-10.4, 30.8) },
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
  ell(tr, thigh), limb(add(thigh, [0.2, 0.6, -2.6]), knee, 3, 2.3), limb(knee, ankle, 2.3, 1.9), limb(ankle, foot, 1.9, 1.6),
  ell([2.3, 2.5, 1.2], foot), limb(add(foot, [-1.7, -1.9, -0.2]), add(foot, [1.7, -1.9, -0.2]), 1.2), ell([1.3, 1.1, 0.7], add(ankle, [0, 0.9, -1.1])),
  ...[-1, 0, 1].map((k) => spike(add(foot, [k * 1.7, -2.3 - Math.abs(k) * 0.3, -0.1]), [k * 0.4, -1.3, -0.7], 0.7)));
const HAND = {
  L: any(ell([2.5, 1.9, 2], [2.4, -10.6, 15.6]), ell([1.9, 1.5, 1.3], [1.4, -11.4, 14]), ell([1.2, 1, 1.1], [3.8, -10.6, 14.8]), ell([1.2, 1, 1.1], [0.2, -11.4, 15.6]),
    ell([1.4, 0.8, 1.4], [2.6, -12.3, 16.2]), limb([3.2, -10.4, 17], [3.6, -10.8, 19.6], 0.7), limb([4.2, -9.8, 16.4], [5.2, -10, 18.4], 0.7),
    limb([0.9, -11.6, 13.6], [2.7, -12, 13.6], 0.6), limb([1.8, -11.8, 13.6], [1.8, -12.3, 11.9], 0.6)),
  R: any(ell([2, 2, 2], [-7.2, -13.4, 17]), ell([1.7, 1.5, 1.5], [-7.6, -15, 15.6]), ell([1.3, 1.3, 1.3], [-8, -13.6, 18.8]), ell([1.2, 0.8, 1.2], [-6.4, -14.6, 16.6]),
    limb([-7.8, -14.6, 17.8], [-9, -17, 20], 0.9), limb([-8.5, -15.2, 15], [-6.7, -15.6, 15], 0.6), limb([-7.6, -15.4, 15], [-7.6, -16, 13.2], 0.6)),
};

const parts = [
  ['body', any(ell([5, 5.2, 6.2], [-1.4, -5, 20]), ell([6.2, 6.4, 7.4], [0.4, 2.6, 15]), limb(NECK[0], NECK[1], NECK_R[0], NECK_R[1]),
    ell([3.6, 2.2, 3.6], [-3.4, -10.8, 22]), ell([2.4, 2, 2.4], [2.2, 7.6, 16.4]),
    spike([0, 6.2, 19.6], [0.3, 1.4, 2.2], 1), spike([0, 7.4, 16.6], [0.3, 1.4, 2.2], 1), spike([0.6, 8.2, 14.2], [0.3, 1.4, 2.2], 1))],
  ['head', any(limb(NECK[1], NECK[2], NECK_R[1], NECK_R[2]), limb(NECK[2], NECK[3], NECK_R[2], NECK_R[3]),
    inFrame(HF, blob([[[3.6, 4.6, 4], S(-12, 34.8)], [[3.2, 2.8, 3.6], S(-8.4, 34)], [[2.3, 2.4, 2.1], S(-19.4, 31.3)]])))],
  ['jaw', inFrame(HF, blob([[[1.85, 1.9, 0.9], S(-19.2, 29.6)], [[2.7, 3.2, 1.5], S(-12, 30)]]))],
  ...['L', 'R'].flatMap((s) => [
    [`arm${s}`, limb(ARMS[s][0], ARMS[s][1], ARM_R[s][0], ARM_R[s][1])],
    [`fore${s}`, any(limb(ARMS[s][1], ARMS[s][2], ARM_R[s][1], ARM_R[s][2]), HAND[s])],
    [`leg${s}`, legTest(LEGS[s])],
  ]),
  ...chain(['body', 'tail1', 'tail1', 'tail2', 'tail2', 'tail3', 'tail3'], TAIL, TAIL_R.map((r) => r * 1.15)),
  ['tail2', spike([4.2, 11.2, 13.2], [0.3, 1.4, 2.2], 1)],
  ['tail2', spike([7.8, 13, 13.6], [0.3, 1.4, 2.2], 1)],
  ['tail3', slab(FAN_PTS, 1.8, 1.2, FANF)],
];
const only = (...names) => parts.filter(([n]) => names.includes(n));

function assign(c, rgb) {
  // the sail: crystals and stones standing on the back
  if ((isAny(rgb, CRYSTALS) || isAny(rgb, STONES)) && c[2] > 20.5 && c[1] > -4.5 && c[0] < 11 && c[0] > -9) return 'body';
  if (near(rgb, FAN)) return 'tail3';
  if (isAny(rgb, EYES, 0.03) && c[2] > 29) return 'head';
  if (near(rgb, CREAM)) {
    const h = pick(c, only('head', 'jaw'));
    if (h === 'jaw' && HF.local(c)[2] < 31) return 'jaw';
    return pick(c, only('body', 'head', 'tail1', 'tail2'));
  }
  if (near(rgb, CREAM_DK)) return pick(c, only('body', 'head'));
  return pick(c, parts);
}

const base = bipedClips({
  face, tail: ['tail1', 'tail2', 'tail3'], hipH: 12, stride: 14, armSwing: 10, hopScale: 0.7, droop: 0.7,
  // a little claw swipe with the jaw snapping
  punch: { arm: [-60, 10, 0], fore: [-30, 0, 0] },
  cheer: { arm: [-20, -90, 0], fore: [-30, 0, 0] },
  add: {
    lunge: (t, u) => ({ jaw: { r: [22 * K(u, [[0.1, 0], [0.3, 1], [0.45, 0], [1, 0]]), 0, 0] } }),
    celebrate: (t, u) => ({ jaw: { r: [14 * win(u, 0, 1, 0.15), 0, 0] } }),
  },
});

const clips = {
  ...base,

  // fidget: snout up, three quick sniffs, a sneeze that jolts the whole body
  idle_sniff: {
    seconds: 2.4,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.12, 1], [0.6, 1], [0.7, 0]]);
      const sn = 2 * Math.max(0, Math.sin(TAU * 6 * u)) * win(u, 0.15, 0.5, 0.03);
      const ah = K(u, [[0.5, 0], [0.62, 1], [0.66, -1], [0.78, 0]]);
      return {
        body: { r: [-3 * up + 6 * Math.max(0, -ah), 0, 0] },
        head: { r: [-16 * up + sn - 6 * Math.max(0, ah) + 18 * Math.max(0, -ah), 0, 0] },
        jaw: { r: [6 * Math.max(0, ah), 0, 0] },
        ...face.pose(Math.max(0, ah) > 0.5 || -ah > 0.3 ? 'squeeze' : 'open', blinks(u, [[0.85, 0.9]])),
        ...both('arm', { r: [-10 * up, 0, 0] }),
      };
    },
  },

  // fidget: a happy tail swish from side to side, the head bobbing along
  idle_swish: {
    seconds: 2,
    pose: (t, u) => {
      const on = win(u, 0.05, 0.95, 0.15);
      const sw = Math.sin(TAU * 2 * u) * on;
      return merge({
        body: { r: [0, 0, 3 * sw] },
        head: { r: [3 * Math.abs(sw), 0, -5 * sw] },
        tail1: { r: [0, 0, 12 * sw] }, tail2: { r: [0, 0, 9 * sw] }, tail3: { r: [0, 0, 7 * sw] },
        ...face.pose('happy'),
      }, both('arm', { r: [4 * osc(u, 4), 0, 0] }));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
