// Roobrawler's rig: Joeyjab grown into a muscled kangaroo boxer. It still hops instead of walking, the red-wrapped
// fists stay up in guard (the lead left one in front of the chest, the rear right one by the cheek), the gold belt
// rides the body and the bandaged tail swings in four links. Numbers are scad/roobrawler.scad's (its pose is not
// mirror-symmetric, so the arms and legs are listed per side); the clips follow rigs/joeyjab.mjs, heavier.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { bipedClips } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, capD, chainHit, closest, ellD, fold, isAny, subFrame, unrot } from './lib/geo.mjs';

const FUR_DK = [0.73, 0.46, 0.17];
const FUR_DP = [0.56, 0.37, 0.16];
const CREAM = [0.98, 0.87, 0.61];
const CREAM_DK = [0.86, 0.69, 0.4];
const EAR_IN = [0.98, 0.82, 0.6];
const RED = [[0.79, 0.24, 0.17], [0.58, 0.17, 0.13]];
const GOLD = [[0.95, 0.71, 0.02], [0.98, 0.82, 0.12], [0.72, 0.5, 0.04]];
const BANDAGE = [[0.95, 0.91, 0.85], [0.77, 0.66, 0.52]];
const CLAW = [0.98, 0.87, 0.61];
const FUR = [0.85, 0.58, 0.24];

const DZ = 3;   // the scad's torso lift on the long legs
const HEAD = subFrame([-0.9, -3, 33.2], [6, 0, -12]);
const T = [[0, 4, 13.3], [3.5, 6.5, 12], [5.5, 9.8, 11.2], [8, 10.8, 12.2], [8.6, 10.2, 15.6], [7.9, 9.2, 19.4]];
const TR = [3.4, 3.0, 2.7, 2.4, 1.6, 0.5];
const tails = ['tail1', 'tail2', 'tail3', 'tail4'];

const ARM = {
  L: { S: [6, 0.4, 26.5], E: [8.8, -1.5, 19.6], W: [7.6, -5, 21.3], F: [6.4, -7.4, 24.2], D: [5.9, 0.4, 23.6 + DZ] },
  R: { S: [-6.2, 0.6, 26], E: [-10.2, -2, 18.6], W: [-9.3, -4.6, 20.6], F: [-9.2, -6, 23.9], D: [-6, 0.6, 23.2 + DZ] },
};
const LEG = {
  L: { H: [4.4, 1.2, 14.6], K: [6.6, -2, 8.2], B: [5.8, 1.8, 1.3], T: [7.6, -5.4, 1.0] },
  R: { H: [-4.4, 1.2, 14.6], K: [-7.6, -1.2, 8], B: [-7.8, 3.4, 1.3], T: [-9.8, -3.6, 1.0] },
};
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

const eye = { side: 'L', at: [2.95, -2.7, 0.1], size: 1.75, yaw: 16, flat: 0.45, frame: HEAD };
const face = eyeKit({ eyes: [eye, mirrorEye(eye)], skin: FUR_DK });

// the ear's base and its nested rotate([0, 30, 0]) rotate([-8, 0, 0]) rotate([0, 0, 22]), in the head's frame (left side)
const EAR_AT = [2.1, 1, 3.7];
const earLocal = (h) => unrot([0, 0, 22], unrot([-8, 0, 0], unrot([0, 30, 0], h.map((v, i) => v - EAR_AT[i]))));
const earBase = (k) => HEAD.world([k * EAR_AT[0], EAR_AT[1], EAR_AT[2]]);

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: LEG.L.H },
  { name: 'legR', parent: 'root', at: LEG.R.H },
  { name: 'body', parent: 'root', at: [0, 0.5, 14] },
  { name: 'head', parent: 'body', at: [-0.5, -1.6, 28.8] },
  { name: 'earL', parent: 'head', at: earBase(1) },
  { name: 'earR', parent: 'head', at: earBase(-1) },
  ...['L', 'R'].flatMap((S) => [
    { name: `arm${S}`, parent: 'body', at: ARM[S].S },
    { name: `fore${S}`, parent: `arm${S}`, at: ARM[S].E },
    { name: `hand${S}`, parent: `fore${S}`, at: ARM[S].W },
  ]),
  { name: 'tail1', parent: 'body', at: T[0] },
  { name: 'tail2', parent: 'tail1', at: T[1] },
  { name: 'tail3', parent: 'tail2', at: T[2] },
  { name: 'tail4', parent: 'tail3', at: T[3] },
  ...face.joints,
];

function headD(c) {
  const h = HEAD.local(c);
  const f = fold(h);
  return Math.min(ellD(h, [4.2, 4.6, 4.5], [0, 0.6, 0.6]), ellD(h, [2.7, 3, 2.3], [0, -3, -1.4]), ellD(h, [1.45, 1.5, 1.25], [0, -6.6, -1.8]),
    ellD(h, [2.9, 2.6, 1.9], [0, -1.6, -2.5]), ellD(h, [1.1, 1.3, 0.85], [0, -6.1, -2.5]),
    ellD(f, [0.6, 1.4, 0.85], [3.3, 1, -2.6]), ellD(f, [0.55, 1.2, 0.75], [3.65, 1.4, -1.2]));
}
const earD = (c) => ellD(earLocal(fold(HEAD.local(c))), [1.95, 0.85, 3.9], [0, 0, 3.6]);
const bodyD = (c) => blobD([c[0], c[1], c[2] - DZ], [[[6, 4.3, 3.6], [0, 0.2, 20.4]], [[5.2, 3.8, 2.4], [0, 0.4, 23]], [[4.2, 3.4, 2.2], [0, 0.5, 14.2]],
  [[5, 4.2, 3.4], [0, 1, 10.8]], [[2.8, 2.6, 2.8], [0, -1, 24.8]]]);
const armD = (c, a) => Math.min(capD(c, a.S, a.E, 2.3, 1.8), ellD(c, [2.1, 2.1, 2.3], lerp(a.S, a.E, 0.4)), ellD(c, [2.7, 2.6, 2.5], a.D));
const legD = (c, l) => Math.min(capD(c, l.H, l.K, 3.6, 2.5), ellD(c, [3.5, 3.5, 3.7], lerp(l.H, l.K, 0.4)), capD(c, l.K, l.B, 2, 1.4), capD(c, l.B, l.T, 1.3, 1.9));

function assign(c, rgb) {
  const S = c[0] >= 0 ? 'L' : 'R';
  if (isAny(rgb, RED)) return `hand${S}`;
  if (isAny(rgb, GOLD)) return 'body';
  if (isAny(rgb, BANDAGE)) return chainHit(c, T, TR).i < 2 ? 'tail2' : 'tail3';
  if (isAny(rgb, [EAR_IN], 0.02) && earD(c) < 1.6) return `ear${S}`;
  if (isAny(rgb, [CLAW], 0.02) && c[2] < 3) return `leg${S}`;
  if (isAny(rgb, [CREAM, CREAM_DK, FUR_DP])) return headD(c) < bodyD(c) ? 'head' : 'body';
  if (!isAny(rgb, [FUR])) return 'head';                         // eyes, brows, lids, nose, mouth
  const tail = chainHit(c, T, TR);
  return closest([
    ['head', headD(c)],
    [`ear${S}`, earD(c)],
    ['body', bodyD(c)],
    ...['L', 'R'].flatMap((s) => [
      [`arm${s}`, armD(c, ARM[s])],
      [`fore${s}`, capD(c, ARM[s].E, ARM[s].W, 1.75, 1.55)],
      [`leg${s}`, legD(c, LEG[s])],
    ]),
    [`tail${Math.min(4, tail.i + 1)}`, tail.d],
  ]);
}

const base = bipedClips({
  face, tail: tails, hipH: 14.6, hop: true, hopH: 4.5, guard: true, hopScale: 0.7,
  punch: { arm: [-45, 0, 0], fore: [53, 0, 0] },
  add: {
    celebrate: (t, u) => both('hand', { s: 1 + 0.1 * Math.abs(Math.sin(TAU * u)) }),
  },
});

const clips = {
  ...base,

  // fidget: a one-two then a big hook, bouncing on the balls of its feet, the tail swaying for balance
  idle_combo: {
    seconds: 2.4,
    pose: (t, u) => {
      const j = win(u, 0.14, 0.26, 0.04);
      const c = win(u, 0.32, 0.44, 0.04);
      const hook = win(u, 0.52, 0.7, 0.05);
      const on = win(u, 0.05, 0.9, 0.08);
      return {
        root: { p: [0, 0, 0.6 * Math.abs(osc(u, 6)) * on] },
        body: { r: [4 * on, 0, -10 * j + 14 * c - 22 * hook] },
        head: { r: [3 * on, 0, 6 * j - 8 * c + 12 * hook] },
        ...face.pose('open', 0.4 * on),
        armL: { r: [-45 * j, 0, 0] }, foreL: { r: [53 * j, 0, 0] },
        armR: { r: [-45 * c - 30 * hook, 40 * hook, 0] }, foreR: { r: [53 * c + 40 * hook, 0, 0] },
        ...Object.fromEntries(tails.map((n, i) => [n, { r: [0, 0, (8 * j - 10 * c + 14 * hook) * (1 + 0.3 * i)] }])),
      };
    },
  },

  // fidget: it leans back on its tail like a stool, arms folded down, and looks smug, then springs back up
  idle_tailrest: {
    seconds: 2.6,
    pose: (t, u) => {
      const lean = K(u, [[0, 0], [0.2, 1], [0.72, 1], [0.85, 0]]);
      return merge({
        root: { r: [-7 * lean, 0, 0] },
        body: { r: [-4 * lean, 0, 0] },
        head: { r: [8 * lean, 0, 10 * lean] },
        ...face.pose('open', 0.45 * lean + blinks(u, [[0.5, 0.56]])),
        ...both('arm', { r: [20 * lean, 0, 0] }), ...both('fore', { r: [-40 * lean, 0, 0] }),
        ...both('leg', { r: [7 * lean, 0, 0] }),
        ...Object.fromEntries(tails.map((n) => [n, { r: [10 * lean, 0, 0] }])),
        ...both('ear', { r: [10 * lean, 0, 0] }),
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
