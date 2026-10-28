// Ravatar (fire relic)'s rig: Ravatar's body (rigs/ravatar.mjs) in obsidian armour. The flames on the fists are joints
// of their own (flameL / flameR, off the hands) that flicker, the tail's flame tongues ride their tail links, and the
// fire licking round the feet (`fire`, off the root) flickers too. Numbers are scad/ravatar_fire.scad's.
import { TAU, both, hash, rigDef, win } from './lib/anim.mjs';
import { any, ell, limb, mx, pair, pick, spike } from './lib/biped.mjs';
import { isAny } from './lib/geo.mjs';
import { baseJoints, baseParts, clipsFor, faceFor } from './ravatar.mjs';

const FLAME = [[0.92, 0.22, 0.06], [1, 0.55, 0.1], [1, 0.88, 0.4]];
// a flame tongue: [base, direction, radius] as the scad's tongue() hull
const tongue = (p, d, r) => limb(p, [p[0] + d[0] * 1.1, p[1] + d[1] * 1.1, p[2] + d[2] * 1.1], r * 1.6, 0.3);
const FIST = [[[10.6, -2, 12.5], [1.5, -0.5, 6.5], 2.2], [[11.4, -1, 13], [3.2, 0.5, 4.5], 1.8], [[10, -2.4, 13.5], [-1.4, -1, 5.5], 1.6],
  [[11.2, -2.6, 12], [2.4, -1.4, 3], 1.4], [[10.6, -1.4, 11], [1, 0, -3], 1.4]];
const TAILF = [[[12.5, 4.5, 9], [-1, 0.5, 9], 2.6, 'tail3'], [[16.5, 2, 11], [1, 0, 11], 2.4, 'tail4'], [[18, 0.5, 15], [-0.5, 0, 9], 2, 'tail4'],
  [[8, 6, 10], [-1.5, 1, 7], 2, 'tail2'], [[15, 3, 12], [-2, -1, 7], 1.6, 'tail3'], [[17.5, 1, 18], [0.5, -0.5, 6], 1.2, 'tail4']];

const face = faceFor();
const joints = [...baseJoints, ...pair('flame*', 'hand*', [10.9, -2.4, 13]), { name: 'fire', parent: 'root', at: [0, 0, 0] }, ...face.joints];

const parts = [
  ...baseParts,
  ['arm*', any(ell([4.2, 4.2, 3], [7.6, 0, 29.6]), spike([7.6, 0, 31], [0, 0, 3.6], 1.1), spike([9.2, -1.6, 31], [1, -1, 2.6], 1.1),
    spike([9.2, 1.6, 31], [1, 1, 2.6], 1.1), spike([10.4, 0, 31], [1.7, 0, 1.8], 1.1), ell([1, 0.5, 0.7], [7.4, -4, 29.8]), ell([1, 0.5, 0.7], [7.4, 4, 29.8]))],
  ['fore*', any(limb([9.7, -0.8, 19.5], [10.3, -1.3, 15.5], 2.3, 2.1), spike([11.6, -0.8, 18], [1.8, 0.4, 1.4], 0.8))],
  ['flame*', any(...FIST.map(([p, d, r]) => tongue(p, d, r)), ell([2.2, 2.2, 2.6], [10.9, -3.4, 14]))],
  ['body', any(ell([7.6, 5.8, 4.4], [0, 0.4, 27]), ell([7.8, 6.2, 5.6], [0, -0.4, 26.5]), ...[-4, 0, 4].map((x) => spike([x, 5, 31], [x * 0.2, 1.6, 2.4], 1)))],
  ...TAILF.map(([p, d, r, j]) => [j, tongue(p, d, r)]),
];

function assign(c, rgb) {
  if (c[2] < 5 && isAny(rgb, FLAME) && Math.hypot(c[0], c[1]) > 7.5) return 'fire';
  return pick(c, parts);
}

// flicker on beats counted in u, so a loop's last frame equals its first
const flick = (u, steps, k = 1, base = 1) => {
  const i = Math.floor(u * steps) % steps;
  const a = (n) => base + k * (0.18 * (hash(i * 7 + n) - 0.5));
  return { ...both('flame', { s: [a(1), a(2), a(3) + 0.1 * k * (hash(i + 9) - 0.5)] }, { s: [a(4), a(5), a(6)] }), fire: { s: [1, 1, a(8) + 0.1 * k] } };
};
const clips = clipsFor({
  face,
  extra: {
    idle: (t, u) => flick(u, 40),
    walk: (t, u) => flick(u, 8),
    idle_look: (t, u) => flick(u, 24),
    windup: (t, u) => flick(u, 4, 1, 1 + 0.25 * u),
    lunge: (t, u) => flick(u, 6, 1.4, 1 + 0.35 * win(u, 0.25, 0.8, 0.1)),
    hurt: (t, u) => flick(u, 5, 2, 0.85),
    recoil: (t, u) => flick(u, 5, 1, 0.9),
    faint: (t, u) => flick(u, 18, 1, 1 - 0.75 * win(u, 0.3, 1.5, 0.5)),
    celebrate: (t, u) => flick(u, 12, 1.5, 1.25),
    enter: (t, u) => flick(u, 9, 1, 0.3 + 0.8 * Math.min(1, u * 1.6)),
    exit: (t, u) => flick(u, 7, 1, 1),
    idle_roar: (t, u) => flick(u, 48, 2, 1 + 0.4 * win(u, 0.2, 0.75, 0.1)),
    idle_swish: (t, u) => flick(u, 52),
  },
});

// fidget: it holds a blazing fist up before its face, the flame roars bigger, and it shakes it out
clips.idle_blaze = {
  seconds: 2.4,
  pose: (t, u) => {
    const up = win(u, 0.1, 0.75, 0.12);
    const shakeOut = win(u, 0.75, 0.97, 0.04) * Math.sin(TAU * 6 * u);
    return {
      ...flick(u, 48, 1.5, 1 + 0.5 * win(u, 0.25, 0.7, 0.1)),
      body: { r: [0, 0, 6 * up] },
      head: { r: [4 * up, 0, 14 * up] },
      ...face.pose('open', 0.4 * up),
      armL: { r: [-55 * up, -16 * up, 0] },
      foreL: { r: [-50 * up, 0, 0] },
      handL: { r: [0, 0, 10 * shakeOut] },
    };
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
