// Badlander Majin's rig: Badlander's body (the scad keeps its numbers) without the wheat stalk, plus the bandana tails
// that stream up as flames (flame1 to flame3) and flicker in every clip. Numbers are scad/badlander_majin.scad's.
import { K, TAU, both, hash, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, mx, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { chainHit, isAny, near } from './lib/geo.mjs';

// Badlander's numbers before its sprite-accuracy rebuild (2026-10-29): the Majin scad still has that body, so its
// rig keeps them here until the Majin model is rebuilt too.
const CAPE = [[0.58, 0.5, 0.36], [0.476, 0.41, 0.295], [0.45, 0.47, 0.48]];
const ROPE = [0.72, 0.6, 0.38];
const WHEAT = [0.88, 0.76, 0.42];
const BAND = [0.18, 0.14, 0.11];


const jointsFor = (face) => [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4.4, 0.4, 14.5]),
  { name: 'body', parent: 'root', at: [0, 0.5, 15] },
  { name: 'head', parent: 'body', at: [0, -4, 28] },
  { name: 'stalk', parent: 'head', at: [1.4, -12.2, 28.5] },
  ...pair('arm*', 'body', [9, 0, 26]),
  ...pair('fore*', 'arm*', [11, -1.5, 20]),
  ...pair('hand*', 'fore*', [11.6, -3.6, 12.4]),
  { name: 'cape1', parent: 'body', at: [0, 4, 27] },
  ...face.joints,
];

const parts = [
  ['body', any(blob([[[7.5, 5.5, 3.6], [0, 0.5, 15.5]]]), ell([7.2, 5.6, 3], [0, 0.5, 19]), ell([8, 6.4, 7.5], [0, -0.5, 24]),
    ell([9.6, 7.8, 8], [0, 0, 25]), mx(ell([3.4, 3.8, 2.6], [8.2, 0, 28.2])), blob([[[1.5, 1.4, 2.6], [7.6, -1.5, 14.5]]]),
    ell([5.6, 5, 1.2], [0, -4, 27.6]), ell([4.5, 1.2, 3], [0, -8.4, 25]))],
  ['head', any(ell([6.2, 5.8, 5.4], [0, -6, 31]), mx(ell([2.6, 2.4, 3], [3.4, -7.6, 29.6])),
    blob([[[3.4, 3, 2.6], [0, -9, 30]], [[1.9, 1.8, 1.5], [0, -12.4, 29.6]]]), ell([1.4, 3, 2.8], [0, -9.6, 33.4]),
    mx(ell([1.4, 0.9, 1.4], [4.4, -4, 35])), ell([9.4, 8.2, 2.2], [0, -6.5, 35.3]), ell([5, 4.6, 4.5], [0, -6.9, 38]))],
  ['leg*', any(blob([[[2.8, 4.2, 1.7], [5.5, -1.4, 1.7]], [[2.6, 2.6, 3.4], [5.5, 0.6, 4.5]]]), limb([5.5, 0.6, 7], [5.2, 0, 10.5], 3, 3.4),
    limb([5.2, 0, 10.5], [4.2, 0.5, 15], 3.4, 3.8))],
  ['arm*', limb([9, 0, 26], [11, -1.5, 20], 2.8, 2.6)],
  ['fore*', limb([11, -1.5, 20], [11.5, -3, 14.5], 2.9, 2.6)],
  ['hand*', ell([2.6, 2.4, 2.4], [11.6, -3.6, 12.4])],
];

function assignWith(c, rgb, list = parts) {
  if (isAny(rgb, CAPE, 0.03) && c[1] > 1.5) return 'cape1';
  if (near(rgb, ROPE, 0.03)) return 'body';
  if (near(rgb, WHEAT, 0.03) && c[0] > 1.2 && c[1] < -11) return 'stalk';
  return pick(c, list);
}

const chew = (u, cycles, amp = 1) => ({ stalk: { r: [8 * amp * osc(u, cycles), 0, 6 * amp * osc(u, cycles / 2, 0.25)] } });

const clipsFor = (face, extra = {}) => {
  const base = bipedClips({
    face, cape: ['cape1'], hipH: 14, stride: 18, armSwing: 14, hopScale: 0.2,
    punch: { arm: [-80, 0, 0], fore: [-15, 0, 0] },
    cheer: { arm: [-20, -115, 0], fore: [-10, 25, 0] },
    add: {
      idle: (t, u) => chew(u, 2, 0.4),
      walk: (t, u) => chew(u, 1, 0.6),
      hurt: (t, u) => chew(u, 3, 1.5),
      celebrate: (t, u) => chew(u, 2, 1.4),
      ...extra,
    },
  });
  return {
    ...base,

    // fidget: chews the wheat stalk, flicking it from one corner of the mouth to the other, eyes half shut
    idle_chew: {
      seconds: 2.4,
      pose: (t, u) => {
        const side = K(u, [[0, 0], [0.2, 0], [0.35, 1], [0.6, 1], [0.75, 0]]);
        return {
          head: { r: [2 * osc(u, 4), 0, 4 * side] },
          stalk: { r: [10 * osc(u, 6), 0, -40 * side] },
          ...(face ? face.pose('open', 0.45 * win(u, 0.1, 0.9, 0.1)) : {}),
          ...both('arm', { r: [2 * osc(u, 2), 0, 0] }),
        };
      },
    },

    // fidget: tips the hat brim with its left paw and a slow nod, then lets the arm swing back down
    idle_tiphat: {
      seconds: 2.2,
      pose: (t, u) => {
        const up = K(u, [[0, 0], [0.3, 1], [0.65, 1], [0.9, 0]]);
        const nod = win(u, 0.35, 0.62, 0.08);
        return {
          body: { r: [0, 0, 4 * up] },
          head: { r: [12 * nod, 0, 8 * up] },
          armL: { r: [-70 * up, 18 * up, -10 * up] },
          foreL: { r: [-85 * up, 0, 0] },
          handL: { r: [-20 * up, 0, 0] },
          ...(face ? face.pose('open', blinks(u, [[0.45, 0.55]])) : {}),
          ...chew(u, 2, 0.5),
        };
      },
    },
  };
};

// ---- the Majin itself

const FLAME_COLS = [[0.75, 0.12, 0.1], [0.95, 0.3, 0.1], [1, 0.6, 0.2]];
const FLAME = [[5, -2, 29.4], [8, 0, 33], [10, 2, 37.5], [13, 3, 41]];
const flames = ['flame1', 'flame2', 'flame3'];

const eyeL = { side: 'L', at: [2.6, -10.5, 31.5], size: 1.55, yaw: 6 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: BAND });

const joints = [
  ...jointsFor(face).filter((j) => j.name !== 'stalk'),
  { name: 'flame1', parent: 'body', at: FLAME[0] },
  { name: 'flame2', parent: 'flame1', at: FLAME[1] },
  { name: 'flame3', parent: 'flame2', at: FLAME[2] },
];

function assign(c, rgb) {
  if (isAny(rgb, FLAME_COLS, 0.03) && c[2] > 29 && c[0] > 4) return flames[Math.min(2, chainHit(c, FLAME, [1.3, 1.1, 0.8, 0.15]).i)];
  const j = assignWith(c, rgb);
  return j === 'stalk' ? 'head' : j;
}

// the flames lick upwards: a fast wave plus a beat of hashed flicker, counted in whole steps per loop
const lick = (u, cycles, amp = 1) => {
  const steps = Math.max(2, Math.round(cycles * 6));
  const k = Math.floor(u * steps) % steps;
  return Object.fromEntries(flames.map((n, i) => [n, {
    r: [amp * (5 * osc(u, cycles, -0.15 * i) + 3 * (hash(k * 7 + i) - 0.5)), 0, amp * 7 * osc(u, cycles, 0.25 - 0.15 * i)],
    s: 1 + 0.1 * amp * (hash(k * 13 + i) - 0.5),
  }]));
};

const base = clipsFor(face, {
  idle: (t, u) => lick(u, 4),
  walk: (t, u) => merge(lick(u, 1, 1.2), { flame1: { r: [12, 0, 0] } }),
  windup: (t, u) => lick(u, 1, 1.3),
  lunge: (t, u) => merge(lick(u, 1, 1.5), { flame1: { r: [18 * win(u, 0.3, 0.8, 0.1), 0, 0] } }),
  hurt: (t, u) => lick(u, 2, 1.6),
  recoil: (t, u) => lick(u, 1, 1.2),
  faint: (t, u) => merge(lick(u, 2, 1), Object.fromEntries(flames.map((n) => [n, { s: 1 - 0.5 * Math.min(1, u * 1.4) }]))),
  celebrate: (t, u) => lick(u, 2, 1.8),
  enter: (t, u) => merge(lick(u, 1, 1.4), { flame1: { s: 0.4 + 0.6 * Math.min(1, u * 2) } }),
  exit: (t, u) => lick(u, 1, 1.2),
});
const { idle_chew: _chew, idle_tiphat: tiphat, ...rest } = base;

const clips = {
  ...rest,
  idle_tiphat: { ...tiphat, pose: (t, u) => merge(tiphat.pose(t, u), lick(u, 4)) },

  // fidget: a snarl. It hunches, the head drops and shakes, the paws curl and the flames roar up
  idle_snarl: {
    seconds: 2.2,
    pose: (t, u) => {
      const on = win(u, 0.1, 0.8, 0.12);
      const sh = Math.sin(TAU * 10 * u) * on;
      return merge({
        body: { r: [6 * on, 0, 0] },
        head: { r: [8 * on, 2 * sh, 3 * sh] },
        ...face.pose('open', 0.3 * on),
        ...both('fore', { r: [-35 * on, 0, 0] }),
        ...both('hand', { r: [-30 * on, 0, 0] }),
      }, lick(u, 6, 1 + on));
    },
  },
};
for (const name of ['idle_look']) {
  const c = clips[name];
  clips[name] = { ...c, pose: (t, u) => merge(c.pose(t, u), lick(u, Math.round(c.seconds * 1.5))) };
}

export default rigDef({ joints, assign, extras: face.extras, clips });
