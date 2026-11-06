// Snapling's rig: a lizard on four legs (the quadruped template) whose head is a gaping flytrap: the upper jaw (trap)
// and the lower jaw (jaw) hinge at the back of the head and snap shut on the bite. No eyes. The tail curls up the
// creature's left side into a purple star bud that turns. Numbers are scad/snapling.scad's (remodelled 2026-11-06).
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, blob, ell, limb, pick } from './lib/biped.mjs';
import { ellD, fold, near, subFrame } from './lib/geo.mjs';
import { legs, quadrupedClips } from './lib/quadruped.mjs';

// the head: two bowl jaws hinged at H, the head turned YAW towards the creature's right
const H = [0, -7.5, 15.6];
const YAW = 18;
const UA = 50;
const LA = 26;
const RU = [8, 10, 8.8];
const RL = [7.6, 9.2, 7.8];
const F = 0.85;
const UP = subFrame(H, [-UA, 0, -YAW]);
const LO = subFrame(H, [LA, 0, -YAW]);
const HEADF = subFrame(H, [0, 0, -YAW]);

const TAIL = [[0, 12, 11], [4.2, 15, 10.9], [7.6, 17, 11.8], [10, 17.8, 13.4], [11, 18, 15.6], [11.3, 17.6, 17.8], [11, 17, 19.8],
  [10.2, 16, 21.8], [8.8, 15, 23.4], [7.4, 14, 24.6], [6, 13, 25.5], [5, 12.4, 26.6], [4.6, 12, 28]];
const TAIL_R = [4, 3.7, 3.4, 3.25, 3.1, 2.9, 2.7, 2.45, 2.2, 1.95, 1.7, 1.5, 1.3];
const tail = ['tail1', 'tail2', 'tail3', 'tail4', 'tail5'];
// which tail joint each capsule segment (TAIL[i] -> TAIL[i + 1]) belongs to, and where each joint pivots
const SEG = [0, 0, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4];
const PIV = [0, 2, 4, 6, 9];
// the bud: the art's star outline as a plate in the picture plane 8 units back, centred on sheet (11.8, 29.9)
const BUD = [6.2, 12.8, 29.9];
const BUDS = [[0.38, 0.24, 0.46], [0.6, 0.45, 0.7]];

const joints = [
  { name: 'root', at: [0, 1, 0] },
  { name: 'legFL', parent: 'root', at: [4.8, -0.5, 9] },
  { name: 'legFR', parent: 'root', at: [-4.8, -0.5, 9] },
  { name: 'legBL', parent: 'root', at: [5, 12.2, 8.6] },
  { name: 'legBR', parent: 'root', at: [-5, 12.2, 8.6] },
  { name: 'body', parent: 'root', at: [0, 4, 11] },
  { name: 'head', parent: 'body', at: [0, 0, 14] },
  { name: 'trap', parent: 'head', at: H, rot: [0, 0, -YAW] },
  { name: 'jaw', parent: 'head', at: H, rot: [0, 0, -YAW] },
  ...tail.map((name, i) => ({ name, parent: i ? tail[i - 1] : 'body', at: TAIL[PIV[i]] })),
  { name: 'bud', parent: 'tail5', at: BUD, rot: [90, 0, 30] },
];

// a jaw shell (bowl centre [0, -F ry, 0] in the jaw's frame, the rim on z = 0, the bowl up): only its own half counts,
// with room for the fangs (2.6 long) that hang off the rim into the mouth
const jawD = (frame, r, upper) => (c) => {
  const l = frame.local(c);
  const z = upper ? l[2] : -l[2];
  if (z < -3.2) return 9;
  return ellD([l[0], l[1] + F * r[1], Math.max(0, z)], r);
};
// a leaf: hull of a stem ball, a flat ellipsoid at 0.42 of its length and the tip, at p turned by r
const leafD = (p, r, len, w, t) => (c) => {
  const q = subFrame(p, r).local(c);
  return Math.min(ellD(q, [w / 2, t / 2 + 0.3, len * 0.3], [0, 0, len * 0.42]), ellD(q, [w / 4, t / 2 + 0.3, len * 0.45], [0, 0, len * 0.55]));
};
const footD = (p, yaw) => {
  const f = subFrame(p, [0, 0, yaw]);
  return (c) => {
    const l = f.local(c);
    return Math.min(ellD(l, [2.6, 2.6, 1.2]), ellD(l, [4, 2.6, 1.3], [0, -3, -0.2]));
  };
};

const legF = any(ell([3.4, 3.8, 3.8], [4.8, -0.5, 9]), limb([5, -0.5, 8.5], [8.6, -2.2, 6.2], 2.9, 2.5),
  limb([8.6, -2.2, 6.2], [8.8, -3.6, 1.8], 2.5, 2.0), footD([9, -4.6, 1.2], -25));
const legB = any(ell([3.8, 5, 4.6], [5, 12.2, 8.6]), limb([5.6, 11.6, 7.8], [8.2, 10.8, 6.4], 2.9, 2.6),
  limb([8.2, 10.8, 6.4], [8.4, 12.8, 1.8], 2.6, 2.0), footD([8.4, 13.4, 1.2], -10));
// the big leaves ride on the neck (head), the small ones lie along the shoulders (body)
const leaves = leafD([4, -1.2, 17], [-24, 26, 35], 12, 8.4, 1.4);
const smallLeaves = leafD([5.4, 1.4, 12.6], [-50, 115, 30], 6.5, 4.4, 1.1);
// the body: the two hull ellipsoids and the middle stand-in the scale patches sit on
const BODY = [[[6.2, 5.6, 6.4], [0, 1, 12.2]], [[5.9, 6, 5.9], [0, 5.25, 11.8]], [[5.6, 6.6, 5.4], [0, 9.5, 11.4]]];
const parts = [
  ['body', any(blob(BODY), (c) => smallLeaves(fold(c)))],
  ['head', any(limb([0, -2.6, 15.2], [0, 1, 12.8], 5.4, 6), (c) => leaves(fold(c)),
    (c) => ellD(HEADF.local(c), [5.6, 2.6, 5.4], [0, 1.2, 0.2]), (c) => ellD(HEADF.local(c), [3.4, 1.4, 3], [0, -0.9, 0.4]))],
  ['trap', jawD(UP, RU, true)],
  ['jaw', jawD(LO, RL, false)],
  ['legFL', (c) => (c[0] > 0 ? legF(c) : 9)], ['legFR', (c) => (c[0] < 0 ? legF([-c[0], c[1], c[2]]) : 9)],
  ['legBL', (c) => (c[0] > 0 ? legB(c) : 9)], ['legBR', (c) => (c[0] < 0 ? legB([-c[0], c[1], c[2]]) : 9)],
  ...SEG.map((j, i) => [tail[j], limb(TAIL[i], TAIL[i + 1], TAIL_R[i], TAIL_R[i + 1])]),
];

function assign(c, rgb) {
  if (near(rgb, BUDS[0]) || near(rgb, BUDS[1])) return 'bud';
  return pick(c, parts);
}

// the trap's own motion: open wider (< 0 on both jaws widens), shut (trap 48, jaw -24 brings the lips together)
const trap = (open, shut = 0) => ({ trap: { r: [-8 * open + 48 * shut, 0, 0] }, jaw: { r: [8 * open - 24 * shut, 0, 0] } });
const bud = (u, turns = 1) => ({ bud: { r: [0, 0, 72 * turns * u], s: 1 + 0.05 * osc(u, 2) } });

const base = quadrupedClips({
  tail, hipH: 8.6, stride: 18,
  add: {
    idle: (t, u) => ({ ...trap(0.5 + 0.5 * osc(u, 2)), ...bud(u, 5) }),
    walk: (t, u) => ({ ...trap(0.3 * osc(u, 2)), ...bud(u, 0) }),
    windup: (t, u) => trap(1.4 * smooth(u)),
    lunge: (t, u) => trap(K(u, [[0, 1.4], [0.25, 1.6], [0.38, 0], [1, 0]]), K(u, [[0.25, 0], [0.4, 1], [0.7, 1], [1, 0]])),
    hurt: (t, u) => trap(0, 0.4 * K(u, [[0, 0], [0.2, 1], [1, 0.3]])),
    faint: (t, u) => trap(-0.4 * smooth((u - 0.2) / 0.6)),
    celebrate: (t, u) => ({ ...trap(0.6, 0.6 * Math.abs(Math.sin(TAU * 2 * u))), ...bud(u, 5) }),
    enter: (t, u) => ({ ...trap(0, 1 - smooth((u - 0.3) / 0.4)), ...bud(smooth(u), 5) }),
    exit: (t, u) => trap(0, smooth(u / 0.7)),
  },
});

const clips = {
  ...base,

  // fidget: it snaps at a passing fly: tracks it with the head, three quick snaps, then licks its lips (a chew)
  idle_snap: {
    seconds: 2.2,
    pose: (t, u) => {
      const track = K(u, [[0, 0], [0.15, 18], [0.35, -10], [0.55, 6], [0.8, 0]]);
      const snap = (u0) => win(u, u0, u0 + 0.07, 0.025);
      const s = snap(0.2) + snap(0.38) + snap(0.55);
      const chew = Math.abs(Math.sin(TAU * 3 * u)) * win(u, 0.65, 0.95, 0.05);
      return merge({
        body: { r: [0, 0, 0.3 * track] },
        head: { r: [-6 * win(u, 0.1, 0.6, 0.08), 0, track] },
        ...trap(1 - s - 0.6 * chew, s + 0.6 * chew),
      }, bud(u, 0.5));
    },
  },

  // fidget: the tail bud swings round over its head and gives a slow spin, the whole lizard wiggles its rump
  idle_bud: {
    seconds: 2.6,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.75, 1], [0.95, 0]]);
      const wig = Math.sin(TAU * 3 * u) * on;
      return merge({
        body: { r: [0, 0, 3 * wig] },
        head: { r: [-8 * on, 0, -12 * on] },
        tail1: { r: [4 * on, 0, 6 * wig] },
        tail3: { r: [10 * on, 0, -8 * on] },
        tail4: { r: [8 * on, 0, -6 * on] },
        ...trap(0.5 * on),
        ...legs({ r: [0, 0, 0] }, { r: [-3 * wig, 0, 0] }, { r: [0, 0, 0] }, { r: [3 * wig, 0, 0] }),
      }, { bud: { r: [0, 0, 144 * smooth(u)], s: 1 + 0.12 * on } });
    },
  },
};

export default rigDef({ joints, assign, clips });
