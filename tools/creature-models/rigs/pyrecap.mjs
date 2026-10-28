// Pyrecap's rig: a red lizard under a two-tier mushroom cap (two joints that wobble), smoke puffing from both shoulder
// vents (a joint per side), a flame on its tail tip. Numbers are scad/pyrecap.scad's.
import { K, TAU, both, hash, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, mx, pair, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { ellD, isAny, near, side, subFrame } from './lib/geo.mjs';

const BODY = [0.82, 0.16, 0.1];
const BODY_DK = [0.6, 0.1, 0.07];
const SOOT = [0.16, 0.16, 0.18];
const SMOKES = [[0.3, 0.3, 0.32], [0.5, 0.5, 0.52]];
const CAP = [[0.82, 0.14, 0.1], [0.98, 0.6, 0.25], [0.78, 0.62, 0.45]];
const FLAMES = [[0.93, 0.2, 0.05], [1, 0.55, 0.08], [1, 0.9, 0.4]];
const CLAW = [0.94, 0.94, 0.92];
const CREAM = [1, 0.85, 0.55];
const C = subFrame([0, 1.5, 27], [-10, 0, 0]);

const TAIL = [[2.5, 4.5, 6], [8, 7.5, 4], [13.5, 7, 5], [16.5, 4.5, 9], [17, 2.5, 13]];
const tail = ['tail1', 'tail2', 'tail3', 'tail4'];

const eyeL = { side: 'L', at: [3.4, -6.7, 23.2], size: 2.3, yaw: 6 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: BODY });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4.6, -0.3, 5.4]),
  { name: 'body', parent: 'root', at: [0, 0, 6] },
  { name: 'head', parent: 'body', at: [0, -1, 18.5] },
  { name: 'cap', parent: 'head', at: C.world([0, 0, 0]) },
  { name: 'capTop', parent: 'cap', at: C.world([0, 0, 4]) },
  ...pair('smoke*', 'body', [9.5, -0.8, 19]),
  ...pair('arm*', 'body', [7, -1, 16]),
  ...pair('fore*', 'arm*', [9.5, -3.5, 12.5]),
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i] })),
  { name: 'flame', parent: 'tail4', at: [17, 2.5, 13.5] },
  ...face.joints,
];

const parts = [
  ['body', any(blob([[[7.5, 6.5, 7], [0, 0, 9]], [[6.5, 5.6, 6], [0, -0.5, 16]]]), ell([4.4, 2.2, 5.4], [0, -5.2, 11]), mx(ell([4, 3.8, 3.5], [8, -0.5, 17.5])))],
  ['head', any(blob([[[6.8, 6.2, 5.8], [0, -1, 23]], [[4.4, 4.6, 3.8], [0, -6, 21.5]]]), ell([3.2, 2.6, 2.2], [0, -9.2, 21]),
    mx(limb([5.6, -6.5, 25], [1.6, -7, 24], 1.3, 1.1)))],
  ['arm*', limb([7, -1, 16], [9.5, -3.5, 12.5], 2, 1.8)],
  ['fore*', any(limb([9.5, -3.5, 12.5], [10, -6.5, 10], 2.1, 2.2), spike([10, -8.2, 9.6], [0, -1.4, -0.8], 1.6))],
  ['leg*', any(ell([3.4, 3.6, 4], [4.6, -0.3, 5.4]), blob([[[2.8, 4.2, 1.7], [4.9, -2.2, 1.7]], [[2.4, 2.2, 1.5], [4.9, 0.6, 1.6]]]),
    spike([4.9, -6, 1], [0, -1.3, -0.4], 1.6))],
  ...chain(tail, TAIL, [3.2, 2.6, 2, 1.6, 1.3]),
  ['tail2', limb([8, 6.6, 2.4], [13.5, 6.2, 3.6], 1.8, 1.4)],
];

function assign(c, rgb) {
  const S = side(c);
  // the cap's red is the body's red within a hair: the cap is whatever lies above its gills
  if (isAny(rgb, CAP, 0.03)) {
    const l = C.local(c);
    if (l[2] > -1.4) {
      const lo = Math.min(ellD(l, [15.5, 14.5, 5]), ellD(l, [14.6, 13.6, 2], [0, 0, -0.6]));
      const hi = Math.min(ellD(l, [10.5, 10, 6], [0, 0, 4]), ellD(l, [10.2, 9.7, 1.8], [0, 0, 3.7]));
      return hi < lo ? 'capTop' : 'cap';
    }
  }
  if (isAny(rgb, SMOKES, 0.03)) return `smoke${S}`;
  if (isAny(rgb, FLAMES, 0.04) || near(rgb, [1, 0.62, 0.15])) return c[0] > 12 ? 'flame' : 'body';
  if (near(rgb, CLAW)) return c[2] > 18 ? 'head' : pick(c, parts);
  if (!isAny(rgb, [BODY, BODY_DK, SOOT, CREAM], 0.03)) return c[2] > 19 ? 'head' : 'body';   // eyes, mouth, belly fire, vent glow
  return pick(c, parts);
}

const flick = (u, steps = 12, amp = 0.16) => ({ flame: { s: 1 + amp * (hash(Math.floor(u * steps) % steps) - 0.5), r: [0, 6 * (hash((Math.floor(u * steps) % steps) + 3.3) - 0.5), 0] } });
const puff = (u, cycles = 2, amp = 1) => both('smoke', { s: 1 + 0.08 * amp * osc(u, cycles), r: [0, -4 * amp * osc(u, cycles, 0.25), 0] },
  { s: 1 + 0.08 * amp * osc(u, cycles, 0.5), r: [0, -4 * amp * osc(u, cycles, 0.75), 0] });
const wobble = (u, cycles = 2, amp = 1) => ({ cap: { r: [1.5 * amp * osc(u, cycles, 0.2), 2 * amp * osc(u, cycles / 2 || 1, 0.1), 0] }, capTop: { r: [2 * amp * osc(u, cycles, 0.05), 2.5 * amp * osc(u, cycles / 2 || 1), 0] } });

const base = bipedClips({
  face, tail, hipH: 5.4, stride: 18, droop: 0.5, hopScale: 0.6, armSwing: 18,
  add: {
    idle: (t, u) => merge(flick(u, 24), puff(u, 2), wobble(u, 2, 0.6)),
    walk: (t, u) => merge(flick(u, 8), puff(u, 1), wobble(u, 2, 1.4)),
    idle_look: (t, u) => merge(flick(u, 12), puff(u, 1), wobble(u, 2, 0.6)),
    windup: (t, u) => merge(flick(u, 4), { cap: { r: [-4 * u, 0, 0] } }),
    lunge: (t, u) => merge(flick(u, 6), wobble(u, 2, 2.4)),
    hurt: (t, u) => merge(flick(u, 4, 0.3), wobble(u, 2, 3)),
    faint: (t, u) => ({ ...flick(u, 12, 0.1), flame: { s: 1 - 0.7 * Math.min(1, u / 0.8) }, ...both('smoke', { s: 1 - 0.6 * Math.min(1, u / 0.6) }), cap: { r: [6 * Math.min(1, u / 0.6), 0, 0] } }),
    celebrate: (t, u) => merge(flick(u, 10, 0.25), puff(u, 2, 2), wobble(u, 2, 2.5)),
    enter: (t, u) => merge(flick(u, 6), wobble(u, 1, 2)),
    exit: (t, u) => merge(flick(u, 6), wobble(u, 1, 1)),
  },
});

const clips = {
  ...base,

  // fidget: a big huff: it breathes in, then both vents blast out smoke, the cap jumps on its head
  idle_huff: {
    seconds: 2.2,
    pose: (t, u) => {
      const inh = K(u, [[0, 0], [0.3, 1], [0.4, 0]]);
      const blast = K(u, [[0, 0], [0.36, 0], [0.46, 1], [0.8, 0.3], [1, 0]]);
      return merge({
        body: { p: [0, 0, 0.4 * inh], s: [1 + 0.04 * inh, 1 + 0.04 * inh, 1] },
        head: { r: [-6 * inh + 6 * blast, 0, 0] },
        ...face.pose(blast > 0.5 ? 'squeeze' : 'open'),
        ...both('smoke', { s: 1 + 0.35 * blast, r: [0, -10 * blast, 0] }),
        cap: { p: [0, 0, 0.8 * win(u, 0.4, 0.55, 0.04)], r: [-4 * blast, 0, 0] },
        ...both('arm', { r: [0, -10 * inh, 0] }),
      }, flick(u, 20), wobble(u, 2, 1));
    },
  },

  // fidget: it tips its cap like a hat with one hand, then lets it settle with a wobble
  idle_tip: {
    seconds: 2.4,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.2, 1], [0.55, 1], [0.7, 0]]);
      const tipK = win(u, 0.25, 0.55, 0.06);
      const settle = Math.sin(TAU * 4 * u) * win(u, 0.65, 1, 0.05) * (1 - u);
      return merge({
        head: { r: [4 * tipK, 0, 10 * up] },
        ...face.pose('open', blinks(u, [[0.3, 0.36]])),
        armL: { r: [-40 * up, -95 * up, 0] }, foreL: { r: [-40 * up, 0, 0] },
        cap: { r: [10 * tipK + 4 * settle, -6 * tipK, 0] },
      }, flick(u, 24), puff(u, 2, 0.6));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
