// Joeyjab's rig: a young kangaroo boxer that hops instead of walking, gloves up in guard. Numbers are scad/joeyjab.scad's.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { bipedClips } from './lib/biped.mjs';
import { eyeKit, mirrorEye, blinks } from './lib/face.mjs';
import { blobD, capD, chainHit, closest, ellD, fold, isAny, near, petalD, side } from './lib/geo.mjs';

const FUR = [0.8, 0.52, 0.24];
const FUR_DK = [0.66, 0.4, 0.17];
const CREAM = [0.98, 0.88, 0.62];
const EAR_IN = [0.98, 0.8, 0.6];
const BAND = [0.97, 0.96, 0.92];
const GLOVE = [0.82, 0.14, 0.1];
const GLOVE_HI = [0.92, 0.25, 0.18];

const TAIL = [[0, 4.5, 9], [2, 9, 5.5], [6, 12, 6.5], [9, 12.5, 10], [10, 11.5, 15]];
const TAIL_R = [3.2, 2.6, 2, 1.4, 0.7];
const tails = ['tail1', 'tail2', 'tail3', 'tail4'];

const face = eyeKit({ eyes: [{ side: 'L', at: [3, -5.2, 27.2], size: 1.6, yaw: -28 }, mirrorEye({ side: 'L', at: [3, -5.2, 27.2], size: 1.6, yaw: -28 })], skin: FUR });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [4.6, 1.2, 8] },
  { name: 'legR', parent: 'root', at: [-4.6, 1.2, 8] },
  { name: 'body', parent: 'root', at: [0, 0.5, 9] },
  { name: 'head', parent: 'body', at: [0, -0.8, 22] },
  { name: 'earL', parent: 'head', at: [3.2, 0.3, 31] },
  { name: 'earR', parent: 'head', at: [-3.2, 0.3, 31] },
  { name: 'band', parent: 'head', at: [6, -0.6, 29.5] },
  { name: 'armL', parent: 'body', at: [4.4, 0, 19.5] },
  { name: 'foreL', parent: 'armL', at: [5.6, -3.5, 16] },
  { name: 'handL', parent: 'foreL', at: [5, -6.5, 20] },
  { name: 'armR', parent: 'body', at: [-4.4, 0, 19.5] },
  { name: 'foreR', parent: 'armR', at: [-5.6, -3.5, 16] },
  { name: 'handR', parent: 'foreR', at: [-5, -6.5, 20] },
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[1] },
  { name: 'tail3', parent: 'tail2', at: TAIL[2] },
  { name: 'tail4', parent: 'tail3', at: TAIL[3] },
  ...face.joints,
];

function assign(c, rgb) {
  const f = fold(c);
  const S = side(c);
  if (isAny(rgb, [GLOVE, GLOVE_HI])) return `hand${S}`;
  if (near(rgb, BAND)) {
    if (c[2] < 23) return `hand${S}`;                          // the wrist cuffs
    return c[0] > 5.4 ? 'band' : 'head';                         // the knot and its tails flutter; the band hugs the head
  }
  if (near(rgb, EAR_IN)) return `ear${S}`;
  if (!isAny(rgb, [FUR, FUR_DK, CREAM])) return 'head';          // eyes, nose, smile
  const tail = chainHit(c, TAIL, TAIL_R);
  return closest([
    [`ear${S}`, f[2] > 30 ? petalD(f, [2.2, 1.1, 5.8], [3.4, 0.4, 35], [0, 14, 0]) : 9],
    ['head', Math.min(ellD(c, [6.2, 5.6, 5.6], [0, -1, 26.5]), blobD(c, [[[3.4, 3, 2.6], [0, -5, 24.8]], [[1.6, 1.6, 1.4], [0, -8, 24.6]], [[3, 2.4, 1.8], [0, -5.6, 23.6]]]))],
    ['body', Math.min(blobD(c, [[[6.2, 5.6, 6.5], [0, 0.5, 12.5]], [[4.6, 4.2, 4.6], [0, -0.4, 19.5]]]), blobD(c, [[[4.4, 3, 5.4], [0, -2.8, 12.5]], [[3, 2.6, 3.4], [0, -2.8, 18.5]]]))],
    [`arm${S}`, capD(f, [4.4, 0, 19.5], [5.6, -3.5, 16], 1.4, 1.2)],
    [`fore${S}`, capD(f, [5.6, -3.5, 16], [5, -6.5, 20], 1.2, 1.1)],
    [`leg${S}`, Math.min(ellD(f, [3.4, 4.6, 5], [4.6, 1.2, 8]), capD(f, [4.8, 2, 5], [5, 1.4, 1.6], 1.6, 1.3),
      blobD(f, [[[1.8, 3.6, 1.2], [5, -1.6, 1.2]], [[1.4, 1.4, 1.2], [5, 1, 1.4]], [[1.7, 1.6, 1.1], [5, -4.4, 1.1]]]))],
    [`tail${Math.min(4, tail.i + 1)}`, tail.d],
  ]);
}

// the headband's knot and tails stream behind the head, faster when it moves
const flutter = (u, cycles, amp = 1) => ({ band: { r: [8 * amp * osc(u, cycles), 0, 10 * amp * osc(u, cycles, 0.25)] } });

const base = bipedClips({
  face, tail: tails, hipH: 8, hop: true, hopH: 5, guard: true,
  punch: { arm: [-45, 0, 0], fore: [53, 0, 0] },
  add: {
    idle: (t, u) => flutter(u, 4, 0.6),
    walk: (t, u) => flutter(u, 2, 1.4),
    lunge: (t, u) => flutter(u, 1, 1.5),
    hurt: (t, u) => flutter(u, 2, 1.6),
    celebrate: (t, u) => ({ ...flutter(u, 2, 1.5), ...both('hand', { s: 1 + 0.1 * Math.abs(Math.sin(TAU * u)) }) }),
  },
});

const clips = {
  ...base,

  // fidget: shadowboxing, jab-jab-cross with a little bounce, eyes narrowed
  idle_shadowbox: {
    seconds: 2.2,
    pose: (t, u) => {
      const jab = (u0) => win(u, u0, u0 + 0.12, 0.04);
      const j1 = jab(0.15); const j2 = jab(0.35); const cross = win(u, 0.55, 0.72, 0.05);
      const on = win(u, 0.06, 0.86, 0.08);
      return merge({
        root: { p: [0, 0, 0.5 * Math.abs(osc(u, 6)) * on] },
        body: { r: [4 * on, 0, -10 * (j1 + j2) + 16 * cross] },
        head: { r: [3 * on, 0, 6 * (j1 + j2) - 8 * cross] },
        ...face.pose('open', 0.35 * on),
        armL: { r: [-45 * (j1 + j2), 0, 0] }, foreL: { r: [53 * (j1 + j2), 0, 0] },
        armR: { r: [-45 * cross, 0, 0] }, foreR: { r: [53 * cross, 0, 0] },
        ...both('ear', { r: [-8 * on, 0, 0] }),
      }, flutter(u, 6, 1));
    },
  },

  // fidget: one ear flicks, then the other, it looks up at a noise and blinks
  idle_ears: {
    seconds: 2,
    pose: (t, u) => {
      const fl = (u0) => Math.sin(TAU * 3 * Math.min(1, Math.max(0, (u - u0) / 0.15))) * win(u, u0, u0 + 0.15, 0.02);
      const up = K(u, [[0, 0], [0.45, 0], [0.55, 1], [0.85, 1], [1, 0]]);
      return merge({
        head: { r: [-10 * up, 6 * up, 10 * up] },
        earL: { r: [-18 * fl(0.1), 12 * fl(0.1), 0] },
        earR: { r: [-18 * fl(0.28), -12 * fl(0.28), 0] },
        ...face.pose('open', blinks(u, [[0.62, 0.68]])),
        ...both('arm', { r: [3 * osc(u, 2), 0, 0] }),
      }, flutter(u, 3, 0.7));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
