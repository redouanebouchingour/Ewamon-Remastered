// Cindercap's rig: a charcoal lizard under a glowing mushroom cap that wobbles, a flame flickering on its tail tip.
// The hand is the forearm joint (fore). Numbers are scad/cindercap.scad's.
import { K, TAU, both, hash, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, pair, pick, spike } from './lib/biped.mjs';
import { eyeKit, mirrorEye, blinks } from './lib/face.mjs';
import { isAny } from './lib/geo.mjs';

const CAP = [[0.86, 0.22, 0.06], [0.96, 0.45, 0.08], [1, 0.8, 0.25], [0.5, 0.33, 0.18]];
const FLAME = [[0.93, 0.2, 0.05], [1, 0.55, 0.08], [1, 0.9, 0.4]];
const TAIL = [[2.5, 4.5, 6], [8, 7, 4.5], [13, 6.5, 6], [16, 4, 10], [17, 2, 14]];
const TAIL_R = [3.4, 2.8, 2.1, 1.6, 1.3];
const tails = ['tail1', 'tail2', 'tail3', 'tail4'];

const eyeL = { side: 'L', at: [3.5, -7.25, 23], size: 2.5, yaw: 6 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.1, 0.1, 0.12] });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4.6, -0.5, 5.2]),
  { name: 'body', parent: 'root', at: [0, 0, 6] },
  { name: 'head', parent: 'body', at: [0, -1, 19] },
  { name: 'cap', parent: 'head', at: [0, 1.5, 28.5] },
  ...pair('arm*', 'body', [5.2, -2.5, 17]),
  ...pair('fore*', 'arm*', [7.4, -5.5, 13.5]),
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[1] },
  { name: 'tail3', parent: 'tail2', at: TAIL[2] },
  { name: 'tail4', parent: 'tail3', at: TAIL[3] },
  { name: 'flame', parent: 'tail4', at: [17, 2, 14.5] },
  ...face.joints,
];

const parts = [
  ['body', any(blob([[[8, 7, 7], [0, 0, 9]], [[6.5, 6, 6], [0, -0.5, 16]]]), ell([4.6, 2.2, 5.6], [0, -5.6, 11.5]))],
  ['head', any(blob([[[7.5, 6.8, 6.2], [0, -1, 23.5]], [[5.2, 5, 4.4], [0, -5.5, 22]]]), ell([3.6, 2.4, 2.4], [0, -9, 21.3]))],
  ['arm*', limb([5.2, -2.5, 17], [7.4, -5.5, 13.5], 1.9, 1.5)],
  ['fore*', any(ell([1.7, 1.6, 1.4], [7.6, -6, 13]), spike([7.6, -7.2, 12.6], [0, -1.2, -0.5], 0.6))],
  ['leg*', any(ell([3.4, 3.6, 3.8], [4.6, -0.5, 5.2]), blob([[[2.6, 4, 1.6], [4.8, -2.2, 1.6]], [[2.2, 2, 1.4], [4.8, 0.6, 1.5]]]))],
  ...chain(tails, TAIL, TAIL_R),
];

const assign = (c, rgb) => {
  if (isAny(rgb, CAP)) return 'cap';
  if (isAny(rgb, FLAME) && c[0] > 10) return 'flame';
  return pick(c, parts);
};

// the tail flame flickers on 12 beats a second (whole beats per clip, so loops close); the cap jiggles on top
const flick = (u, secs, k = 1) => {
  const n = Math.round(secs * 12);
  const h = hash(Math.floor(u * n) % n + 1);
  return { flame: { s: [1 + 0.1 * k * (h - 0.5), 1 + 0.1 * k * (hash(h * 7) - 0.5), 1 + 0.22 * k * (h - 0.3)], r: [0, 0, 8 * k * (hash(h * 3) - 0.5)] } };
};
const jiggle = (u, cycles, amp) => ({ cap: { r: [amp * osc(u, cycles, 0.2), 0, 0.7 * amp * osc(u, cycles / 2, 0.1)], s: [1, 1, 1 + 0.02 * amp * osc(u, cycles)] } });

const base = bipedClips({
  face, tail: tails, hipH: 5.2, stride: 20, armSwing: 18,
  punch: { arm: [-60, 0, 0], fore: [-20, 0, 0] },
  add: {
    idle: (t, u) => merge(flick(u, 4), jiggle(u, 2, 1.5)),
    walk: (t, u) => merge(flick(u, 0.8, 1.3), jiggle(u, 2, 3)),
    idle_look: (t, u) => merge(flick(u, 2.4), jiggle(u, 2, 1.5)),
    windup: (t, u) => flick(u, 0.25, 1.5),
    lunge: (t, u) => merge(flick(u, 0.3, 1.8), jiggle(u, 1, 5)),
    hurt: (t, u) => merge(flick(u, 0.26, 2), jiggle(u, 2, 6)),
    recoil: (t, u) => merge(flick(u, 0.25), jiggle(u, 1, 3)),
    faint: (t, u) => ({ flame: { s: Math.max(0.2, 1 - 0.8 * Math.max(0, (u - 0.3) / 0.7)) }, cap: { r: [10 * win(u, 0.2, 1, 0.3), 0, 0] } }),
    celebrate: (t, u) => merge(flick(u, 0.6, 2), jiggle(u, 2, 5)),
    enter: (t, u) => merge(flick(u, 0.45, 1.5), jiggle(u, 1, 4)),
    exit: (t, u) => flick(u, 0.35),
  },
});

const clips = {
  ...base,

  // fidget: shakes its cap like a wet dog, the ember spots flashing round, eyes squeezed, then a pleased blink
  idle_capshake: {
    seconds: 1.8,
    pose: (t, u) => {
      const on = win(u, 0.1, 0.6, 0.05);
      const sh = Math.sin(TAU * 8 * u) * on;
      return merge({
        body: { r: [0, 0, 3 * sh] },
        head: { r: [-4 * on, 4 * sh, 14 * sh] },
        cap: { r: [0, 6 * sh, 10 * sh] },
        ...(u < 0.6 ? face.pose(on > 0.3 ? 'squeeze' : 'open') : face.pose('open', blinks(u, [[0.75, 0.82]]))),
        ...both('arm', { r: [0, -10 * on, 0] }),
      }, flick(u, 1.8, 1 + on));
    },
  },

  // fidget: curls its tail round to the front and warms its claws at the flame
  idle_warm: {
    seconds: 3,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.18, 1], [0.8, 1], [0.95, 0]]);
      const rub = osc(u, 6) * win(u, 0.25, 0.75, 0.06);
      return merge({
        body: { r: [4 * on, 0, -4 * on] },
        head: { r: [10 * on, -6 * on, 16 * on] },
        tail1: { r: [0, 0, -22 * on] }, tail2: { r: [0, 0, -18 * on] }, tail3: { r: [-6 * on, 0, -14 * on] }, tail4: { r: [-8 * on, 0, -6 * on] },
        armL: { r: [-20 * on, -10 * on + 4 * rub, -10 * on] }, foreL: { r: [-20 * on, 0, 0] },
        armR: { r: [-20 * on, 10 * on - 4 * rub, 20 * on] }, foreR: { r: [-25 * on, 0, 0] },
        ...face.pose('open', 0.5 * on + blinks(u, [[0.5, 0.56]])),
      }, flick(u, 3, 1.3));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
