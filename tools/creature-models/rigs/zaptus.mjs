// Zaptus's rig: a purple egg on two stubby feet (the egg is the head too), flipper arms, a dark wick on the crown that
// spits two sparks. It hops instead of walking. Numbers are scad/zaptus.scad's.
import { K, TAU, both, hash, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { ellD, fold, isAny, near, petalD, side } from './lib/geo.mjs';

const BODY = [0.4, 0.27, 0.62];
const DARK = [0.24, 0.15, 0.4];
const SPARK = [[0.72, 0.82, 1], [0.92, 0.96, 1]];

// the eye sits on the egg at azimuth 24, elevation 12 (scad), scaled 1.15
const eyeL = { side: 'L', at: [4.38, -8.94, 17.7], size: 2.7, yaw: 24, flat: 0.3 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], parent: 'body', skin: BODY });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [5, -2.5, 2.5] },
  { name: 'legR', parent: 'root', at: [-5, -2.5, 2.5] },
  { name: 'body', parent: 'root', at: [0, 0, 3] },
  { name: 'armL', parent: 'body', at: [8, -1, 13.4] },
  { name: 'armR', parent: 'body', at: [-8, -1, 13.4] },
  { name: 'wick', parent: 'body', at: [0, 0.5, 27.5] },
  { name: 'spark', parent: 'wick', at: [3.5, -0.5, 33.5] },
  { name: 'spark2', parent: 'wick', at: [-1, 0, 35] },
  ...face.joints,
];

const parts = [
  ['body', ell([11, 10, 13], [0, 0, 15])],
  ['arm*', (c) => petalD(c, [4, 2.2, 1.8], [11, -1, 12], [0, -25, -10])],
  ['wick', any(blob([[[3.6, 3.4, 2], [0, 0.5, 27.5]], [[2.2, 2, 1.6], [0.6, 0.5, 30]]]), limb([0.6, 0.5, 30], [3.5, -0.5, 33.5], 2, 0.7),
    ell([1.6, 1.4, 2.2], [-1.8, 0.8, 30]), ell([1.4, 1.4, 1.8], [2.2, 1.2, 29.6]))],
];

function assign(c, rgb) {
  if (isAny(rgb, SPARK, 0.04)) return c[0] < 0.5 && c[2] > 34 ? 'spark2' : 'spark';
  if (near(rgb, DARK, 0.03) && c[2] < 5) return `leg${side(c)}`;
  if (near(rgb, BODY, 0.03) && ellD(fold(c), [11, 10, 13], [0, 0, 15]) > 1.02) return pick(c, parts);
  if (c[2] > 26 && near(rgb, DARK, 0.03)) return 'wick';
  return pick(c, parts.slice(0, 1));
}

// the wick sways and the sparks crackle (scale flicker on a beat that closes the loop)
const crackle = (u, steps, amp = 0.35) => {
  const k = Math.floor(u * steps) % steps;
  return { spark: { s: 1 - amp + 2 * amp * hash(k) }, spark2: { s: 1 - amp + 2 * amp * hash(k + 37) } };
};
const wick = (u, amp = 4, cycles = 2) => ({ wick: { r: [amp * osc(u, cycles), 0, amp * 0.8 * osc(u, cycles, 0.25)] } });

const base = bipedClips({
  face, hop: true, hopH: 2.4, hipH: 3, armSwing: 18, droop: 0.4, hopScale: 1,
  add: {
    idle: (t, u) => merge(wick(u, 3, 2), crackle(u, 16)),
    walk: (t, u) => merge(wick(u, 8, 2), crackle(u, 6)),
    idle_look: (t, u) => merge(wick(u, 3, 2), crackle(u, 12)),
    windup: (t, u) => ({ wick: { r: [-10 * smooth(u / 0.8), 0, 0] }, spark: { s: 1 + 0.5 * smooth(u / 0.8) }, spark2: { s: 1 + 0.5 * smooth(u / 0.8) } }),
    lunge: (t, u) => { const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]); return { wick: { r: [14 * hit, 0, 0] }, spark: { s: 1 + 0.8 * hit }, spark2: { s: 1 + 0.6 * hit } }; },
    hurt: (t, u) => merge(wick(u, 12, 3), crackle(u, 8, 0.6)),
    recoil: (t, u) => wick(u, 6, 1),
    faint: (t, u) => { const d = smooth((u - 0.2) / 0.5); return { wick: { r: [30 * d, 0, -10 * d] }, spark: { s: 1 - 0.7 * d }, spark2: { s: 1 - 0.7 * d } }; },
    celebrate: (t, u) => merge(wick(u, 10, 3), crackle(u, 6, 0.5)),
    enter: (t, u) => ({ spark: { s: 0.3 + 0.9 * win(u, 0.3, 1, 0.1) }, spark2: { s: 0.3 + 0.9 * win(u, 0.3, 1, 0.1) } }),
    exit: (t, u) => wick(u, 6, 2),
  },
});

const clips = {
  ...base,

  // fidget: the wick fizzes up into a big spark, the egg shudders and squeezes its eyes, then a little pop
  idle_fizz: {
    seconds: 2.2,
    pose: (t, u) => {
      const on = win(u, 0.15, 0.7, 0.08);
      const pop = win(u, 0.7, 0.82, 0.04);
      const sh = Math.sin(TAU * 14 * u) * on;
      return merge({
        root: { p: [0, 0, 1.4 * pop] },
        body: { r: [0, 2 * sh, 0], s: [1 + 0.04 * on - 0.05 * pop, 1 + 0.04 * on - 0.05 * pop, 1 - 0.05 * on + 0.08 * pop] },
        ...face.pose(on > 0.4 ? 'squeeze' : pop > 0.3 ? 'happy' : 'open'),
        ...both('arm', { r: [0, -30 * pop - 10 * on, 0] }),
        wick: { r: [0, 0, 6 * sh] },
        spark: { s: 1 + 0.9 * on + 0.5 * pop },
        spark2: { s: 1 + 0.9 * on + 0.5 * pop },
      }, crackle(u, 22, 0.3 * on));
    },
  },

  // fidget: rocks from foot to foot like a wobbling egg, flippers out for balance
  idle_wobble: {
    seconds: 2,
    pose: (t, u) => {
      const on = win(u, 0.05, 0.9, 0.12);
      const s = osc(u, 2);
      return merge({
        body: { r: [0, 10 * s * on, 3 * s * on] },
        legL: { p: [0, 0, 0.5 * Math.max(0, -s) * on] },
        legR: { p: [0, 0, 0.5 * Math.max(0, s) * on] },
        ...face.pose('open', blinks(u, [[0.5, 0.55]])),
        ...both('arm', { r: [0, -25 * on, 0] }),
      }, wick(u, 8 * on, 2), crackle(u, 10));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
