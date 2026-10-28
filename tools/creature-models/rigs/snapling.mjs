// Snapling's rig: a lizard on four legs (the quadruped template) whose head is a gaping flytrap: the upper jaw (trap)
// and the lower jaw (jaw) hinge at the back of the head and snap shut on the bite. No eyes. The tail curls up over the
// back into a star bud that turns. Numbers are scad/snapling.scad's.
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, blob, chain, ell, limb, petal, pick } from './lib/biped.mjs';
import { ellD, near, subFrame } from './lib/geo.mjs';
import { legs, quadrupedClips } from './lib/quadruped.mjs';

const HEAD = [0, -9, 15];
const JR = [7, 8.5, 4.8];
const UP = subFrame(HEAD, [-38, 0, 0]);
const LO = subFrame(HEAD, [14, 0, 0]);
const TAIL = [[0, 11, 11], [2, 16, 11], [4, 20, 15], [4.5, 20.5, 21], [3.5, 17, 25], [3, 13, 26.5], [3.5, 10.5, 29]];
const TAIL_R = [3.2, 2.7, 2.3, 1.9, 1.6, 1.3, 1];
const tail = ['tail1', 'tail2', 'tail3', 'tail4', 'tail5'];
const BUD = [3.5, 10, 30.4];
const BUDS = [[0.35, 0.18, 0.45], [0.55, 0.35, 0.68]];
const SKIN_HI = [0.66, 0.9, 0.3];
const SPORES = [[8, 7, 34], [1, 9, 34.5], [9, 11, 28]];
const sin = (a) => Math.sin((a * Math.PI) / 180);

const joints = [
  { name: 'root', at: [0, 1, 0] },
  { name: 'legFL', parent: 'root', at: [4.2, -3, 11] },
  { name: 'legFR', parent: 'root', at: [-4.2, -3, 11] },
  { name: 'legBL', parent: 'root', at: [4.6, 7.5, 10] },
  { name: 'legBR', parent: 'root', at: [-4.6, 7.5, 10] },
  { name: 'body', parent: 'root', at: [0, 2, 10] },
  { name: 'head', parent: 'body', at: [0, -4.5, 13.5] },
  { name: 'trap', parent: 'head', at: HEAD },
  { name: 'jaw', parent: 'head', at: HEAD },
  ...tail.map((name, i) => ({ name, parent: i ? tail[i - 1] : 'body', at: TAIL[i] })),
  { name: 'bud', parent: 'tail5', at: BUD, rot: [-25, 0, 20] },
];

// a jaw shell: the centroid in the jaw's frame, the bowl's centre [0, -0.75 JR.y, 0]; only the jaw's own half counts
const jawD = (frame, r, upper) => (c) => {
  const l = frame.local(c);
  const p = [l[0], l[1] + JR[1] * 0.75, l[2]];
  if (upper ? p[2] < -2.8 : p[2] > 2.6) return 9;
  return ellD(p, r);
};

const legF = any(limb([4.2, -3, 11], [7, -4.5, 6], 2.4, 1.8), limb([7, -4.5, 6], [7.4, -5.5, 1.2], 1.8, 1.5),
  blob([[[1.8, 2.2, 1], [7.4, -6, 1]], [[1.4, 1.2, 1], [7.4, -4.8, 1.3]]]), ell([2.8, 1.4, 0.8], [7.4, -7.6, 0.8]));
const legB = any(ell([3, 4, 4.4], [4.6, 7.5, 10]), limb([5.2, 8.5, 8], [6.4, 7, 1.2], 2, 1.5),
  blob([[[1.8, 2.2, 1], [6.4, 6, 1]], [[1.4, 1.2, 1], [6.4, 7.2, 1.3]]]), ell([2.8, 1.4, 0.8], [6.4, 4.4, 0.8]));
const parts = [
  ['body', any(blob([[[5.4, 6, 5], [0, -2, 12]], [[5.2, 6, 4.6], [0, 6, 11.4]]]), ell([3.6, 7.5, 2.4], [0, 2, 8]),
    ...[[2.6, -1, 16.2], [-2.6, -1, 16.2], [0, 3, 16.7], [2.6, 7, 15.4], [-2.6, 7, 15.4]].map((p) => ell([1.6, 2, 0.6], p)))],
  ['head', any(limb([0, -8, 15], [0, -4, 13], 4.2, 4.6), ell([3, 1.4, 3], [0, -11.4, 15.4]),
    ...[[1, 25], [-1, 25], [1, -10], [-1, -10]].map(([s, a]) => petal([4.2, 1, 2.2], [s * 5, -5.5, 14 + a * 0.05], [0, s * -a, s * 50])),
    ...[1, -1].map((s) => petal([3.4, 0.9, 1.8], [s * 3.8, -4.4, 18.2], [0, s * -40, s * 30])))],
  ['trap', jawD(UP, JR, true)],
  ['jaw', jawD(LO, JR.map((v) => v * 0.95), false)],
  ['legFL', (c) => (c[0] > 0 ? legF(c) : 9)], ['legFR', (c) => (c[0] < 0 ? legF([-c[0], c[1], c[2]]) : 9)],
  ['legBL', (c) => (c[0] > 0 ? legB(c) : 9)], ['legBR', (c) => (c[0] < 0 ? legB([-c[0], c[1], c[2]]) : 9)],
  ...chain(tail, TAIL, TAIL_R),
];

function assign(c, rgb) {
  if (near(rgb, BUDS[0]) || near(rgb, BUDS[1])) return 'bud';
  if (near(rgb, SKIN_HI) && SPORES.some((p) => Math.hypot(c[0] - p[0], c[1] - p[1], c[2] - p[2]) < 0.6)) return 'bud';
  if (near(rgb, SKIN_HI) && Math.hypot(c[0] - BUD[0], c[1] - BUD[1], c[2] - BUD[2]) < 4) return 'bud';
  return pick(c, parts);
}

// the trap's own motion: open wider (< 0 on both jaws widens), shut (trap 38, jaw -14 closes the lips)
const trap = (open, shut = 0) => ({ trap: { r: [-8 * open + 38 * shut, 0, 0] }, jaw: { r: [8 * open - 14 * shut, 0, 0] } });
const bud = (u, turns = 1) => ({ bud: { r: [0, 0, 72 * turns * u], s: 1 + 0.05 * osc(u, 2) } });

const base = quadrupedClips({
  tail, hipH: 10.5, stride: 18,
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
