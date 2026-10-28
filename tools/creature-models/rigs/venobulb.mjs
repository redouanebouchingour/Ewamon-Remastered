// Venobulb's rig: a hulking brute on four planted limbs (the quadruped template) with no head: a gaping maw in its
// chest whose upper jaw (trap) and lower jaw (jaw) hinge deep in the body and slam shut on the bite. Flytrap clusters
// on each shoulder (sprL / sprR) sway and snap; a thorned tail sweeps round. Numbers are scad/venobulb.scad's.
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, blob, chain, ell, limb, petal, pick } from './lib/biped.mjs';
import { ellD, isAny, near, subFrame } from './lib/geo.mjs';
import { legs, quadrupedClips } from './lib/quadruped.mjs';

const SKIN = [[0.2, 0.42, 0.22], [0.32, 0.58, 0.3], [0.12, 0.28, 0.14], [0.55, 0.22, 0.75]];
const SLIME = [0.75, 0.95, 0.3];
const TONGUE = [0.3, 0.5, 0.3];
const HEAD = [0, -6, 15];
const JR = [7.5, 8, 5];
const UP = subFrame(HEAD, [-30, 0, 0]);
const LO = subFrame(HEAD, [16, 0, 0]);
const TAIL = [[0, 13, 10], [3, 19, 7], [9, 22, 4], [15, 19, 2.5], [18, 13, 1.8], [17.5, 8, 1.4]];
const TAIL_R = [4, 3.2, 2.5, 1.9, 1.4, 0.7];
const tail = ['tail1', 'tail2', 'tail3', 'tail4'];
const TRAPS = [[[7, -2, 26], 1.4], [[10.4, 0.5, 24.5], 1.15], [[4.6, 2, 25], 1.15]];

const joints = [
  { name: 'root', at: [0, 1, 0] },
  { name: 'legFL', parent: 'root', at: [8.5, -4, 17] },
  { name: 'legFR', parent: 'root', at: [-8.5, -4, 17] },
  { name: 'legBL', parent: 'root', at: [6.8, 8, 10] },
  { name: 'legBR', parent: 'root', at: [-6.8, 8, 10] },
  { name: 'body', parent: 'root', at: [0, 2, 9] },
  { name: 'trap', parent: 'body', at: HEAD },
  { name: 'jaw', parent: 'body', at: HEAD },
  { name: 'sprL', parent: 'body', at: [7, -1, 22.5] },
  { name: 'sprR', parent: 'body', at: [-7, -1, 22.5] },
  ...tail.map((name, i) => ({ name, parent: i ? tail[i - 1] : 'body', at: TAIL[i] })),
];

const jawD = (frame, r, upper) => (c) => {
  const l = frame.local(c);
  const p = [l[0], l[1] + JR[1] * 0.75, l[2]];
  if (upper ? p[2] < -3.2 : p[2] > 3) return 9;
  return ellD(p, r);
};
const sided = (S, test) => (c) => ((S === 'L') === (c[0] >= 0) ? test([Math.abs(c[0]), c[1], c[2]]) : 9);
const legF = any(limb([8.5, -4, 17], [12, -7, 8], 3.6, 2.8), limb([12, -7, 8], [12.4, -8.5, 1.6], 2.8, 2.2),
  blob([[[2.6, 3, 1.3], [12.4, -9.5, 1.3]], [[2, 1.8, 1.3], [12.4, -7.9, 1.7]]]), ell([3, 1.6, 1], [12.4, -12, 1]));
const legB = any(ell([4.4, 5, 5.4], [6.8, 8, 9.5]), limb([7.4, 9, 7], [8.4, 7, 1.6], 2.8, 2.2),
  blob([[[2.6, 3, 1.3], [8.4, 6.2, 1.3]], [[2, 1.8, 1.3], [8.4, 7.8, 1.7]]]), ell([3, 1.6, 1], [8.4, 3.7, 1]));
const spr = any(...TRAPS.map(([p, s]) => ell([3.4 * s, 3.4 * s, 2.6 * s], p)), ell([7, 7, 1.4], [7, -1, 22.8]));

const parts = [
  ['body', any(blob([[[10, 9, 9], [0, -2, 15]], [[8, 8, 7], [0, 7, 12]]]), ell([7, 6, 5], [0, -6, 9]), ell([3.6, 1.4, 3.4], [0, -8.6, 15.4]),
    ...[0, 1, 2, 3, 4].map((l) => { const a = (l * 72 + 20) * Math.PI / 180; return petal([2.6, 1, 0.4], [2 * Math.cos(a), 7 + 2 * Math.sin(a), 19], [0, -15, l * 72 + 20]); }))],
  ['trap', jawD(UP, JR, true)],
  ['jaw', any(jawD(LO, JR.map((v) => v * 0.95), false), blob([[[2.4, 3, 1], [0, -12, 12.4]], [[1.8, 2, 0.8], [0, -16, 11.6]]]))],
  ['legFL', sided('L', legF)], ['legFR', sided('R', legF)], ['legBL', sided('L', legB)], ['legBR', sided('R', legB)],
  ...chain(tail, TAIL, TAIL_R.map((r) => r * 1.5)),
];

function assign(c, rgb) {
  if (near(rgb, SLIME)) return 'trap';
  if (near(rgb, TONGUE)) return 'jaw';
  const S = c[0] >= 0 ? 'L' : 'R';
  // the shoulder clusters: anything that is not hide up there, and hide only when it is nearer a little trap than
  // the body or the maw
  if (c[2] > 19.5 && Math.abs(c[0]) > 1.5 && c[1] < 6) {
    const d = spr([Math.abs(c[0]), c[1], c[2]]);
    if ((!isAny(rgb, [SKIN[0], SKIN[2], SKIN[3]]) && d < 1.9 && c[1] > -8) || d < 0.85) {
      const others = pick(c, parts);
      if (others !== 'trap' || jawD(UP, JR, true)(c) > 1.08) return `spr${S}`;
    }
  }
  return pick(c, parts);
}

// the maw: open wider (< 0 on both jaws widens), shut (trap 30, jaw -16 closes the lips)
const maw = (open, shut = 0) => ({ trap: { r: [-8 * open + 30 * shut, 0, 0] }, jaw: { r: [6 * open - 16 * shut, 0, 0] } });
// the shoulder traps sway, and snap with `snap`
const sprouts = (u, cycles = 1, amp = 1, snap = [0, 0]) => ({
  sprL: { r: [3 * amp * osc(u, cycles), 0, 5 * amp * osc(u, cycles, 0.25)], s: [1, 1, 1 - 0.25 * snap[0]] },
  sprR: { r: [3 * amp * osc(u, cycles, 0.5), 0, -5 * amp * osc(u, cycles, 0.75)], s: [1, 1, 1 - 0.25 * snap[1]] },
});

const base = quadrupedClips({
  tail, hipH: 13, stride: 12,
  add: {
    idle: (t, u) => ({ ...maw(0.4 + 0.4 * osc(u, 2)), ...sprouts(u, 2) }),
    walk: (t, u) => ({ ...maw(0.2 * osc(u, 2)), ...sprouts(u, 2, 1.5) }),
    idle_sniff: (t, u) => sprouts(u, 2),
    idle_shake: (t, u) => sprouts(u, 4, 2),
    idle_wag: (t, u) => sprouts(u, 2),
    windup: (t, u) => ({ ...maw(1.6 * smooth(u)), ...sprouts(u, 1, 1.5) }),
    lunge: (t, u) => ({ ...maw(K(u, [[0, 1.6], [0.25, 1.8], [0.38, 0], [1, 0]]), K(u, [[0.25, 0], [0.4, 1], [0.7, 1], [1, 0]])), ...sprouts(u, 1, 2) }),
    hurt: (t, u) => ({ ...maw(0, 0.4 * K(u, [[0, 0], [0.2, 1], [1, 0.3]])), ...sprouts(u, 2, 3) }),
    faint: (t, u) => ({ ...maw(-0.5 * smooth((u - 0.2) / 0.6)), sprL: { r: [25 * smooth(u), 0, 0] }, sprR: { r: [25 * smooth(u), 0, 0] } }),
    celebrate: (t, u) => ({ ...maw(0.8, 0.6 * Math.abs(Math.sin(TAU * 2 * u))), ...sprouts(u, 2, 3, [Math.abs(Math.sin(TAU * 2 * u)), Math.abs(Math.cos(TAU * 2 * u))]) }),
    enter: (t, u) => ({ ...maw(1.2 * win(u, 0.4, 0.9, 0.1), 1 - smooth((u - 0.2) / 0.3)), ...sprouts(u, 1, 2) }),
    exit: (t, u) => maw(0, smooth(u / 0.7)),
  },
});

const clips = {
  ...base,

  // fidget: the maw gapes in a huge yawn, the tongue lolls, then a wet gulp with a shudder through the body
  idle_gulp: {
    seconds: 2.6,
    pose: (t, u) => {
      const yawn = K(u, [[0, 0], [0.35, 1], [0.55, 1], [0.62, 0]]);
      const gulp = win(u, 0.6, 0.75, 0.03);
      const sh = Math.sin(TAU * 10 * u) * win(u, 0.62, 0.85, 0.04);
      return merge({
        body: { r: [-4 * yawn + 3 * gulp, 0, 1.2 * sh], s: [1 + 0.03 * gulp, 1, 1 - 0.02 * gulp] },
        ...maw(2 * yawn, gulp),
        tail1: { r: [6 * yawn, 0, 3 * sh] },
      }, sprouts(u, 2, 1 + yawn));
    },
  },

  // fidget: the shoulder traps snap at flies one side after the other, the maw grins along
  idle_sprouts: {
    seconds: 2,
    pose: (t, u) => {
      const sn = (u0) => win(u, u0, u0 + 0.08, 0.03);
      const l = sn(0.15) + sn(0.5);
      const r = sn(0.32) + sn(0.68);
      return merge({
        body: { r: [0, 0, 3 * (l - r)] },
        sprL: { r: [-12 * l, 0, 10 * l], s: [1, 1, 1 - 0.3 * l] },
        sprR: { r: [-12 * r, 0, -10 * r], s: [1, 1, 1 - 0.3 * r] },
        ...maw(0.6),
      }, legs({ r: [0, 0, 0] }));
    },
  },
};

export default rigDef({ joints, assign, clips });
