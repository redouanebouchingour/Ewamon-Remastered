// Caldermole's rig: an upright magma kaiju. The upper body (torso, neck, head, arms, the dorsal mane) is built in the
// scad pitched forward 14° over the hips; its numbers are written in that block's own frame and mapped out with U().
// A long plated tail lies along the ground and rises into a tall flame. Numbers are scad/caldermole.scad's.
import { K, TAU, both, hash, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, pair } from './lib/biped.mjs';
import { eyeKit, mirrorEye, blinks } from './lib/face.mjs';
import { isAny, near, subFrame } from './lib/geo.mjs';

const COAL = [0.22, 0.19, 0.23];
const COAL_HI = [0.33, 0.29, 0.34];
const FLAME = [[0.9, 0.22, 0.05], [1, 0.55, 0.08], [1, 0.88, 0.35]];

// upper(): translate([0, 2, 9]) rotate([14, 0, 0]) translate([0, -2, -9]); head(): translate([0, -10.5, 32]) rotate([-14, 0, 0]) scale(1.25)
const UP = subFrame([0, 2, 9], [14, 0, 0], 1);
const U = (p) => UP.world([p[0], p[1] - 2, p[2] - 9]);
const uLocal = (c) => { const q = UP.local(c); return [q[0], q[1] + 2, q[2] + 9]; };
const HD = subFrame([0, -10.5, 32], [-14, 0, 0], 1.25);
const Hw = (p) => U(HD.world(p));
const hLocal = (c) => HD.local(uLocal(c));
const headFrame = { world: Hw, local: hLocal, scale: [1.25, 1.25, 1.25], rot: [0, 0, 0] };

const TAIL = [[0, 7, 10], [2.5, 14, 5.5], [8, 19, 4.5], [14, 19, 6], [18.5, 15.5, 10], [20, 11.5, 16], [20, 9.5, 21.5], [19.5, 9, 25]];
const TAIL_R = [6.2, 5.4, 4.6, 3.9, 3.3, 2.7, 2.2, 1.8];
const tails = ['tail1', 'tail2', 'tail3', 'tail4'];

const eyeL = { side: 'L', at: [3.1, -5.9, 2], size: 1.75, yaw: 6, flat: 0.55, frame: headFrame };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: COAL });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [7.4, 1, 10]),
  { name: 'body', parent: 'root', at: [0, 2, 9] },
  { name: 'head', parent: 'body', at: U([0, -6, 29.5]) },
  { name: 'jaw', parent: 'head', at: Hw([0, 1.5, -1]) },
  { name: 'crest', parent: 'head', at: U([0, -10.5, 33.6]) },
  { name: 'mane', parent: 'body', at: U([0, 4, 26]) },
  ...pair('arm*', 'body', U([8.8, -2, 23.5])),
  ...pair('fore*', 'arm*', U([11.4, -4, 18])),
  ...pair('hand*', 'fore*', U([11, -8, 14.8])),
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[2] },
  { name: 'tail3', parent: 'tail2', at: TAIL[4] },
  { name: 'tail4', parent: 'tail3', at: TAIL[6] },
  { name: 'flame', parent: 'tail4', at: [19.5, 9, 25] },
  ...face.joints,
];

// parts written in the upper block's frame (tested on uLocal(c)) and the head's (on hLocal(c))
const upperParts = [
  ['body', any(ell([7.8, 6.6, 7.4], [0, -3.5, 21]), ell([8.6, 7.6, 7], [0, 0, 14.5]), ell([8.6, 7.4, 5], [0, 3, 10]), ell([5.4, 5.4, 5], [0, 1.5, 25.5]),
    ell([6.4, 6, 6], [0, -2, 26]))],
  ['head', ell([5.4, 4.6, 4.6], [0, -8, 31])],
  ['arm*', any(ell([3.8, 4, 4], [8.4, -2, 24]), limb([8.8, -2, 23.5], [11.4, -4, 18], 3.4, 2.9))],
  ['fore*', limb([11.4, -4, 18], [11, -8, 14.8], 2.9, 2.6)],
  ['hand*', any(ell([2.8, 2.6, 2.2], [11, -9.4, 13.6]), limb([11, -11, 13.6], [11, -12.4, 11], 1.8, 1))],
];
const headParts = [
  ['head', blob([[[4.8, 4.2, 3.2], [0, 1.5, 1]], [[4.2, 3.4, 2.5], [0, -4, 0.8]], [[3.2, 1.8, 1.9], [0, -9, 0]]])],
  ['jaw', blob([[[4.6, 3.8, 2.2], [0, 0, -2]], [[3, 2, 1.3], [0, -7.8, -1.3]]])],
];
const worldParts = [
  ['leg*', any(ell([5.8, 6.6, 7], [7.4, 1, 10]), limb([7.8, -0.5, 6], [8, -1.2, 2.6], 4.2, 4),
    blob([[[4.2, 5.2, 2], [8, -3, 2]], [[3.6, 3, 1.8], [8, 0.8, 1.9]]]))],
  ...chain(['tail1', 'tail1', 'tail2', 'tail2', 'tail3', 'tail3', 'tail4'], TAIL, TAIL_R),
];

// every flame of the scad: [joint, frame ('u' = the upper block, 'w' = world), base, direction, radius]; a flame
// triangle goes to the flame whose axis it lies nearest (its licks fan out about 2.5 radii)
const FLAMES = [
  ...[0, 1, 2, 3].map((i) => ['mane', 'u', [0, 1 + i * 3, 30.5 - i * 5.2], [0, 3.5, 11 - Math.abs(i - 1) * 1.6], 3 - i * 0.2]),
  ...[1, 2].flatMap((i) => [1, -1].map((s) => ['mane', 'u', [s * 3.4, 0.4 + i * 3, 29.1 - i * 5.2], [s * 2, 2.6, (11 - Math.abs(i - 1) * 1.6) * 0.7], 2.2])),
  ['crest', 'u', [0, -10.5, 33.6], [0, 4.5, 7], 2.4],
  ['crest', 'u', [2.6, -8.5, 33.2], [1.6, 3.6, 5.5], 1.7], ['crest', 'u', [-2.6, -8.5, 33.2], [-1.6, 3.6, 5.5], 1.7],
  ['tail1', 'w', [5, 17, 9.6], [0, 1.5, 5.5], 1.9], ['tail2', 'w', [13, 20, 9], [0.8, 0.8, 4.6], 1.6],
  ['flame', 'w', [19.5, 9, 25], [-0.5, -0.5, 15], 4.8], ['flame', 'w', [21.8, 9.6, 25], [3, 0.5, 8], 2.8],
];
const flameOf = (c, l) => {
  let best = 'mane'; let bd = Infinity;
  for (const [j, f, a, d, r] of FLAMES) {
    const q = f === 'u' ? l : c;
    const dd = limb(a, [a[0] + d[0], a[1] + d[1], a[2] + d[2]], r * 2.5, r * 1.5)(q);
    if (dd < bd) { bd = dd; best = j; }
  }
  return best;
};

const assign = (c, rgb) => {
  const l = uLocal(c);
  const h = hLocal(c);
  if (isAny(rgb, FLAME)) return flameOf(c, l);
  const inHead = Math.abs(h[0]) < 6.5 && h[1] > -11.5 && h[1] < 6 && h[2] > -4.5 && h[2] < 6;
  if (inHead && near(rgb, COAL_HI) && h[2] < -0.6) return 'jaw';
  if (inHead && Math.min(...headParts.map(([, t]) => t(h))) < 1.2) return 'head';     // skull, brows, eyes, fangs
  return pickAll(c, l);
};
// the nearest primitive over both frames (upper parts see the point in the upper frame; mirrored ones fold there)
function pickAll(c, l) {
  const S = l[0] >= 0 ? 'L' : 'R';
  const lf = [Math.abs(l[0]), l[1], l[2]];
  const cf = [Math.abs(c[0]), c[1], c[2]];
  let best = null; let bd = Infinity;
  for (const [n, t] of upperParts) { const d = n.endsWith('*') ? t(lf) : t(l); if (d < bd) { bd = d; best = n.endsWith('*') ? n.slice(0, -1) + S : n; } }
  for (const [n, t] of worldParts) { const d = n.endsWith('*') ? t(cf) : t(c); if (d < bd) { bd = d; best = n.endsWith('*') ? n.slice(0, -1) + (c[0] >= 0 ? 'L' : 'R') : n; } }
  return best;
}

// flames flicker on 12 beats a second (whole beats per clip so loops close)
const flick = (u, secs, k = 1) => {
  const n = Math.max(1, Math.round(secs * 12));
  const b = Math.floor(u * n) % n;
  const f = (seed) => hash(b * 3.1 + seed) - 0.5;
  return {
    flame: { s: [1 + 0.1 * k * f(1), 1, 1 + 0.18 * k * f(2)], r: [0, 0, 6 * k * f(3)] },
    crest: { s: [1, 1, 1 + 0.16 * k * f(4)], r: [4 * k * f(5), 0, 0] },
    mane: { s: [1 + 0.04 * k * f(6), 1, 1 + 0.08 * k * f(7)] },
  };
};

const base = bipedClips({
  face, tail: tails, hipH: 10, stride: 14, armSwing: 12, hopScale: 0,
  punch: { arm: [-55, 0, -10], fore: [-25, 0, 0] },
  cheer: { arm: [-20, -80, 0], fore: [-30, 0, 0] },
  add: {
    idle: (t, u) => flick(u, 4),
    walk: (t, u) => flick(u, 0.8, 1.3),
    idle_look: (t, u) => flick(u, 2.4),
    windup: (t, u) => merge(flick(u, 0.25, 1.5), { jaw: { r: [8 * smooth(u / 0.8), 0, 0] } }),
    lunge: (t, u) => merge(flick(u, 0.3, 2), { jaw: { r: [14 * K(u, [[0.1, 0], [0.4, 1], [1, 0]]), 0, 0] } }),
    hurt: (t, u) => flick(u, 0.26, 2),
    recoil: (t, u) => flick(u, 0.25),
    faint: (t, u) => ({ flame: { s: Math.max(0.25, 1 - 0.75 * smooth((u - 0.3) / 0.6)) }, crest: { s: Math.max(0.3, 1 - 0.7 * smooth((u - 0.3) / 0.6)) } }),
    celebrate: (t, u) => flick(u, 0.6, 2),
    enter: (t, u) => flick(u, 0.45, 1.5),
    exit: (t, u) => flick(u, 0.35),
  },
});

const clips = {
  ...base,

  // fidget: a kaiju roar. Head thrown back, jaw wide, claws spread, every flame flaring, a rumble through the body
  idle_roar: {
    seconds: 2.6,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.7, 1], [0.9, 0]]);
      const rum = Math.sin(TAU * 13 * u) * win(u, 0.25, 0.7, 0.05);
      return merge({
        body: { r: [-8 * on, 0, 0.8 * rum] },
        head: { r: [-22 * on, 0.8 * rum, 0] },
        jaw: { r: [24 * on, 0, 0] },
        ...both('arm', { r: [-14 * on, -24 * on, 0] }),
        ...both('fore', { r: [-30 * on, 0, 0] }),
        ...both('hand', { r: [-14 * on, 0, 0] }),
        ...face.pose('open', blinks(u, [[0.88, 0.94]])),
        tail3: { r: [-8 * on, 0, 0] }, tail4: { r: [-10 * on, 0, 0] },
      }, flick(u, 2.6, 1 + 1.6 * on));
    },
  },

  // fidget: the tail swishes along the ground, the tip flame whips round and it glances back at it
  idle_swish: {
    seconds: 2.4,
    pose: (t, u) => {
      const s = osc(u, 2) * win(u, 0.05, 0.95, 0.15);
      const look = win(u, 0.15, 0.8, 0.12);
      return merge({
        body: { r: [0, 0, 6 * look] },
        head: { r: [0, -4 * look, 22 * look] },
        tail1: { r: [0, 0, 6 * s] }, tail2: { r: [0, 0, 8 * s] }, tail3: { r: [0, 0, 10 * s] }, tail4: { r: [0, 0, 12 * s] },
        ...face.pose('open', blinks(u, [[0.45, 0.5]])),
      }, flick(u, 2.4, 1.4));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
