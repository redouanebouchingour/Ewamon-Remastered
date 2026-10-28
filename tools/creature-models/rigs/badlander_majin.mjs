// Badlander Majin's rig: Badlander's body (the scad keeps its numbers) without the wheat stalk, plus the bandana tails
// that stream up as flames (flame1 to flame3) and flicker in every clip. Numbers are scad/badlander_majin.scad's.
import { TAU, both, hash, merge, osc, rigDef, win } from './lib/anim.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { chainHit, isAny } from './lib/geo.mjs';
import { BAND, assignWith, clipsFor, jointsFor } from './badlander.mjs';

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
