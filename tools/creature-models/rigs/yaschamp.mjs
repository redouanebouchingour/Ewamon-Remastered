// Yaschamp's rig: a hulking jackal boxer, fists on its hips, a white headband whose tails stream behind. Numbers are
// scad/yaschamp.scad's; the head is jackal_head() inside translate([-1.5, -2.5, 35.5]) scale(1.3). Yasprime reuses
// all of it (`yas({ sx: 1.08 })`, its body() is scaled [1.08, 1.08, 1]).
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, inFrame, limb, mx, pair, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { fold, isAny, near, rot, subFrame } from './lib/geo.mjs';

export const FUR = [0.45, 0.3, 0.17];
const GLOVE = [0.85, 0.08, 0.06];
const GLOVE_HI = [1, 0.35, 0.3];
const BAND = [0.9, 0.9, 0.9];
const NL = [[0.75, 0.1, 0.12], [0.1, 0.2, 0.6]];

export const H = subFrame([-1.5, -2.5, 35.5], [0, 0, 0], 1.3);
const EAR = rot([-8, 18, 0], [0, 0, 1]);
const hf = (test) => (c) => test(fold(H.local(c)));    // a mirror_x() part inside the head
const hp = (test) => (c) => test(H.local(c));          // an unsided part inside the head

export function yas({ sx = 1 } = {}) {
  // body() numbers scaled [sx, sx, 1]; a test sees the centroid scaled back
  const S = (p) => [p[0] * sx, p[1] * sx, p[2]];
  const bs = (test) => (c) => test([c[0] / sx, c[1] / sx, c[2]]);
  const eyeL = { side: 'L', at: [2.5, -2.8, 1.25], size: 1.15, yaw: -24, frame: H };
  const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FUR });
  const earAt = H.world([2.2, 1, 3]);
  const joints = [
    { name: 'root', at: [0, 0, 0] },
    ...pair('leg*', 'root', S([6.5, 0.3, 12])),
    { name: 'body', parent: 'root', at: S([0, 0.5, 13]) },
    { name: 'head', parent: 'body', at: [-0.5, -0.5, 32.5] },
    { name: 'earL', parent: 'head', at: earAt },
    { name: 'earR', parent: 'head', at: H.world([-2.2, 1, 3]) },
    { name: 'band', parent: 'head', at: H.world([1.5, 4.2, 1.9]) },
    ...pair('arm*', 'body', S([10.5, 0, 27])),
    ...pair('fore*', 'arm*', S([14.5, 0.5, 21.5])),
    ...pair('hand*', 'fore*', S([9.5, -1, 16.5])),
    ...face.joints,
  ];
  const parts = [
    ['body', any(bs(blob([[[9.5, 6, 6.5], [0, 0, 27]], [[7, 5, 5], [0, 0.5, 20]]])), bs(mx(ell([4, 1.8, 3], [3.4, -4.6, 27.5]))),
      bs(mx(ell([4.2, 4, 3.8], [9, 0, 28]))), bs(blob([[[7.5, 5.5, 3], [0, 0.5, 15.5]], [[8.5, 5.5, 2.5], [0, 0.5, 13]]])),
      blob([[[4, 3.5, 2], [-1, -1, 32]], [[5, 4, 2], [0, 0, 30]]]))],
    ['head', any(hp(blob([[[3.7, 4.2, 3.6], [0, 0.5, 0.8]], [[2.8, 3, 2.4], [0, -2.5, 0]]])),
      hp(blob([[[3, 3.2, 2.2], [0, -2, -1.4]], [[1.3, 2, 1.2], [0, -8.5, -1.2]]])), hp(ell([1.8, 3, 0.4], [0, -6, -2.8])),
      hf(ell([1.45, 0.5, 1.3], [2.5, -2.5, 1.25])), hf(limb([1.1, -3.8, 1.85], [3.5, -2, 2.75], 0.6)),
      hf(spike([0.9, -8.3, -2.3], [0, -0.1, -1], 0.3)), hp(ell([4.2, 4.3, 1], [0, 0.5, 2.5])))],
    ['ear*', hf(limb([2.2, 1, 3], [2.2 + 7.5 * EAR[0], 1 + 7.5 * EAR[1], 3 + 7.5 * EAR[2]], 1.6, 0.3))],
    ['arm*', bs(limb([10.5, 0, 27], [14.5, 0.5, 21.5], 3.2, 2.8))],
    ['fore*', bs(limb([14.5, 0.5, 21.5], [9.5, -1, 16.5], 2.8, 2.4))],
    ['hand*', bs(ell([3, 3, 2.8], [9.8, -1.5, 16.2]))],
    ['leg*', any(bs(limb([5.5, 0.5, 13], [9, -0.5, 9], 4, 3.6)), bs(limb([9, -0.5, 9], [10.5, -1, 4.5], 3.2, 2.6)),
      bs(limb([10.5, -1, 4.5], [10, -0.5, 2], 2.6, 2.3)), bs(blob([[[2.8, 4, 1.4], [10.5, -2.2, 1.3]], [[2.4, 2, 1.6], [10.2, 0.8, 1.6]]])))],
  ];
  // colour rules shared by both forms; the form adds its own first
  const assign = (c, rgb, pre) => {
    const S2 = c[0] >= 0 ? 'L' : 'R';
    const r = pre?.(c, rgb, S2);
    if (r) return r;
    if (isAny(rgb, [GLOVE, GLOVE_HI])) return `hand${S2}`;
    if (isAny(rgb, NL)) return 'legL';
    if (near(rgb, BAND)) {
      if (c[2] > 33) return H.local(c)[1] > 3.6 ? 'band' : 'head';
      if (c[2] > 15) return `hand${S2}`;
      return `leg${S2}`;
    }
    return pick(c, parts);
  };
  return { joints, parts, assign, face, S };
}

// the headband tails stream behind, faster when it moves
export const flutter = (u, cycles, amp = 1) => ({ band: { r: [6 * amp * osc(u, cycles), 0, 9 * amp * osc(u, cycles, 0.25)] } });

export function clipsFor({ face, cape = [], add = {} }) {
  const own = {
    idle: (t, u) => flutter(u, 4, 0.5),
    walk: (t, u) => flutter(u, 2, 1.3),
    lunge: (t, u) => flutter(u, 1, 1.5),
    hurt: (t, u) => flutter(u, 2, 1.6),
    celebrate: (t, u) => ({ ...flutter(u, 2, 1.5), ...both('hand', { s: 1 + 0.1 * Math.abs(Math.sin(TAU * u)) }) }),
  };
  const base = bipedClips({
    face, hipH: 12, stride: 16, armSwing: 8, hopScale: 0.35, droop: 0.7, cape,
    // the right fist leaves the hip and drives forward: the forearm straightens, the arm swings up and in
    punch: { arm: [-78, 0, 18], fore: [0, 85, 0] },
    cheer: { arm: [-10, -100, 0], fore: [0, -70, 0] },
    add: Object.fromEntries([...new Set([...Object.keys(own), ...Object.keys(add)])].map((k) => [k, (t, u) => merge(own[k]?.(t, u), add[k]?.(t, u))])),
  });
  return {
    ...base,

    // fidget: a double-biceps flex, chin up and a smug squint, then back to the hips
    idle_flex: {
      seconds: 2.6,
      pose: (t, u) => {
        const on = K(u, [[0, 0], [0.18, 1], [0.7, 1], [0.88, 0]]);
        const pump = Math.sin(TAU * 3 * u) * win(u, 0.25, 0.65, 0.05);
        return merge({
          body: { r: [-4 * on, 0, 0], s: [1 + 0.03 * on, 1, 1] },
          head: { r: [-10 * on, 0, 8 * on] },
          ...face.pose('open', 0.4 * on + blinks(u, [[0.9, 0.95]])),
          ...both('arm', { r: [-10 * on, -55 * on - 4 * pump, 0] }),
          ...both('fore', { r: [-95 * on, -40 * on, 0] }),
          ...both('hand', { s: 1 + 0.06 * on * Math.abs(pump) }),
        }, flutter(u, 3, 0.8));
      },
    },

    // fidget: boxer's footwork, bouncing on its toes with a quick shoulder roll
    idle_bounce: {
      seconds: 1.8,
      pose: (t, u) => {
        const on = win(u, 0.05, 0.92, 0.1);
        const b = Math.abs(Math.sin(TAU * 3 * u));
        return merge({
          root: { p: [0, 0, 0.8 * b * on] },
          body: { r: [3 * on, 0, 4 * Math.sin(TAU * 1.5 * u) * on] },
          head: { r: [2 * on, 0, -3 * Math.sin(TAU * 1.5 * u) * on] },
          ...face.pose('open'),
          ...both('arm', { r: [3 * b * on, -6 * on, 0] }),
          ...both('leg', { r: [-3 * b * on, 0, 0] }),
        }, flutter(u, 3, 1.1));
      },
    },
  };
}

const Y = yas();
export default rigDef({ joints: Y.joints, assign: (c, rgb) => Y.assign(c, rgb), extras: Y.face.extras, clips: clipsFor({ face: Y.face }) });
