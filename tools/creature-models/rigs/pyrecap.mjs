// Pyrecap's rig: a squat red fire-toad under a two-tier mushroom cap (two joints that wobble), smoke puffing from both shoulder
// vents (a joint per side), a flame on its tail tip. Numbers are scad/pyrecap.scad's.
import { K, TAU, both, hash, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, limb, mx, pair, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { ellD, isAny, near, side, subFrame } from './lib/geo.mjs';

const BODY = [0.8, 0.15, 0.1];
const JAW = [0.64, 0.1, 0.08];
const PATCH = [0.95, 0.34, 0.07];
const SOOT = [0.17, 0.17, 0.18];
const COAL = [0.22, 0.22, 0.23];
const SMOKES = [[0.3, 0.3, 0.31], [0.45, 0.44, 0.43], [0.6, 0.59, 0.57]];
const CAP = [[0.86, 0.13, 0.1], [0.99, 0.66, 0.3], [0.8, 0.68, 0.52]];
const FLAMES = [[0.93, 0.2, 0.05], [0.98, 0.4, 0.05], [1, 0.6, 0.08], [1, 0.86, 0.28]];
const EMBER = [1, 0.82, 0.3];
const CLAW = [0.94, 0.94, 0.92];
const CREAM = [0.96, 0.86, 0.5];
const C = subFrame([0, -4.5, 28.4], [-11, 0, 0]);

const TAIL = [[4, 4.5, 8], [10, 7.5, 6.2], [15, 6.6, 7.2], [17.8, 4.4, 10.4], [18.5, 3, 14]];
const tail = ['tail1', 'tail2', 'tail3', 'tail4'];
const TORSO = [[[8, 7, 6.5], [0, 0, 10]], [[7, 6, 5], [0, -0.5, 16]]];
const HEAD = [[[7.4, 5.6, 4.4], [0, -5, 23.5]], [[6, 4.6, 3.2], [0, -7.5, 22.2]]];

const eyeL = { side: 'L', at: [2.7, -9.7, 24.2], size: 2.0, yaw: 10 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: BODY });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [9.3, -1.5, 8.5]),
  { name: 'body', parent: 'root', at: [0, 0, 6] },
  { name: 'head', parent: 'body', at: [0, -2.5, 19.5] },
  { name: 'cap', parent: 'head', at: C.world([0, 0, 0]) },
  { name: 'capTop', parent: 'cap', at: C.world([0, 0, 4.9]) },
  ...pair('smoke*', 'body', [14, -1, 24.5]),
  // the arms are posed apart: the creature's right (-X) flung out, its left held in front
  { name: 'armL', parent: 'body', at: [8, -1, 18] },
  { name: 'armR', parent: 'body', at: [-8, -1, 18] },
  { name: 'foreL', parent: 'armL', at: [14.5, -2.5, 15.5] },
  { name: 'foreR', parent: 'armR', at: [-15.6, -2.4, 14.6] },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i] })),
  { name: 'flame', parent: 'tail4', at: [18.5, 3, 14.5] },
  ...face.joints,
];

const parts = [
  ['body', any(blob(TORSO), mx(blob([[[5, 4.5, 4.6], [10.5, -1.5, 22]], [[4, 4, 3.6], [7, 0.8, 24]]])),
    blob([[[7, 4, 3.4], [0, 3, 23]], [[7, 4.5, 3], [0, 1.5, 20]]]))],
  ['head', any(blob(HEAD), ell([5, 3.6, 2.2], [0, -8.6, 21]))],
  ['armL', limb([8, -1, 18], [14.5, -2.5, 15.5], 2.4, 2.1)],
  ['armR', limb([-8, -1, 18], [-15.6, -2.4, 14.6], 2.4, 2.1)],
  ['foreL', any(limb([14.5, -2.5, 15.5], [15.5, -6.2, 12.8], 2.2, 2.4), ell([2.5, 2.4, 2.6], [15.4, -7, 12.4]),
    spike([14.8, -8.6, 13.4], [-1.1, -1, 1.9], 2))],
  ['foreR', any(limb([-15.6, -2.4, 14.6], [-18, -4, 12.6], 2.2, 2.4), ell([2.5, 2.3, 2.7], [-18.6, -4.4, 12]),
    spike([-19.6, -5.2, 10.4], [-1.4, -0.9, -1.9], 2))],
  ['leg*', any(ell([4.2, 4.6, 4.3], [9.3, -1.5, 8.5]), blob([[[3.2, 4.6, 2.5], [11, -3.6, 2.5]], [[2.6, 2.6, 2.2], [10.4, 0, 2.6]]]),
    spike([11, -7.6, 1.3], [0, -1.7, -0.6], 2))],
  ...chain(tail, TAIL, [3.3, 2.8, 2.3, 1.9, 1.6]),
  ['tail2', limb([10, 8, 4.4], [15, 7.1, 5.4], 1.9, 1.6)],
  ['tail3', limb([15, 7.1, 5.4], [18.2, 4.9, 9.4], 1.6, 1.2)],
];

function assign(c, rgb) {
  const S = side(c);
  // the cap's red is a hair off the body's: the cap is whatever of its colours lies above its gills' underside
  if (isAny(rgb, CAP, 0.03) && C.local(c)[2] > -3) {
    const l = C.local(c);
    const lo = Math.min(ellD(l, [13, 13, 4.6]), ellD(l, [13, 13, 1.5]), ellD(l, [11.8, 11.8, 1.9], [0, 0, -0.8]));
    const hi = Math.min(ellD(l, [10.5, 10.5, 6.2], [0, 0, 4.9]), ellD(l, [10.5, 10.5, 1.4], [0, 0, 4.9]), ellD(l, [9.6, 9.6, 1.7], [0, 0, 4.3]));
    return hi < lo ? 'capTop' : 'cap';
  }
  if (isAny(rgb, SMOKES, 0.03)) return `smoke${S}`;
  if (near(rgb, EMBER, 0.03) && Math.abs(c[0]) > 9) return 'body';
  if (isAny(rgb, FLAMES, 0.03) && c[0] > 13) return 'flame';
  if (isAny(rgb, [COAL], 0.03) || (near(rgb, SOOT, 0.03) && c[2] > 18.5)) return 'body';
  if (!isAny(rgb, [BODY, JAW, PATCH, SOOT, CREAM], 0.03) && (c[2] > 21.6 || (c[2] > 20 && c[1] < -8))) return 'head';   // eyes, mouth, fangs
  if (isAny(rgb, FLAMES, 0.03)) return 'body';   // the belly fire
  return pick(c, parts);
}

const flick = (u, steps = 12, amp = 0.16) => ({ flame: { s: 1 + amp * (hash(Math.floor(u * steps) % steps) - 0.5), r: [0, 6 * (hash((Math.floor(u * steps) % steps) + 3.3) - 0.5), 0] } });
const puff = (u, cycles = 2, amp = 1) => both('smoke', { s: 1 + 0.08 * amp * osc(u, cycles), r: [0, -4 * amp * osc(u, cycles, 0.25), 0] },
  { s: 1 + 0.08 * amp * osc(u, cycles, 0.5), r: [0, -4 * amp * osc(u, cycles, 0.75), 0] });
const wobble = (u, cycles = 2, amp = 1) => ({ cap: { r: [1.5 * amp * osc(u, cycles, 0.2), 2 * amp * osc(u, cycles / 2 || 1, 0.1), 0] }, capTop: { r: [2 * amp * osc(u, cycles, 0.05), 2.5 * amp * osc(u, cycles / 2 || 1), 0] } });

const base = bipedClips({
  face, tail, hipH: 8.5, stride: 18, droop: 0.5, hopScale: 0.6, armSwing: 18,
  // the arms rest spread, so a lower raise keeps the left hand's claws clear of the face
  cheer: { arm: [-6, -70, 25], fore: [-8, 40, 0] },
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
