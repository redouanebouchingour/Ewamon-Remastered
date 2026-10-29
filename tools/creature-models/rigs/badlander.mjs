// Badlander's rig: a hulking outlaw badger, hunched, the head low and turned to its right under a battered hat, paws
// hanging low, a duster cape down its back and a wheat stalk in its mouth (stalk). The duster is one joint (cape1): it
// is a hull whose triangles run from the shoulders to the hem, so it cannot bend in two. Numbers are
// scad/badlander.scad's (the head is written in its own turned frame, `HEAD` below).
import { K, both, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, fromSheet, inFrame, limb, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near, subFrame } from './lib/geo.mjs';

const FUR = [0.25, 0.19, 0.18];
const HEADC = [FUR, [0.19, 0.15, 0.15], [0.37, 0.33, 0.30], [0.08, 0.05, 0.05], [0.62, 0.27, 0.27], [0.93, 0.58, 0.18], [0.80, 0.42, 0.10]];
const CREAM = [0.77, 0.68, 0.56];
const ROPE = [0.56, 0.50, 0.38];
const CAPE = [0.47, 0.39, 0.30];
const GREY = [0.43, 0.41, 0.39];     // the paws and the cape's patches
const LEATHER = [0.40, 0.33, 0.27];
const BRACER = [0.48, 0.35, 0.27];
const PANTS = [0.53, 0.43, 0.33];    // the trousers and the belt
const BOOT = [[0.17, 0.13, 0.13], [0.52, 0.47, 0.43]];
const CLAW = [0.64, 0.58, 0.50];
const SHIRT = [0.25, 0.27, 0.30];

// translate(fs(-5, 31, -5)) rotate([0, 0, -48]) scale(1.1): the head's own frame
const HEAD = subFrame(fromSheet(-2.5, 31, -5), [0, 0, -48], 1.1);
const H = (p) => HEAD.world(p);

const eyeL = { side: 'L', at: [2.15, -3.4, 1.35], size: 0.7, yaw: 50, frame: HEAD };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FUR });

const SHOULDER = { L: [11.5, -1.0, 28.0], R: [-12.5, 0.5, 27.0] };
const ELBOW = { L: [13.5, -3.5, 21.5], R: [-10.4, -4.0, 20.0] };
const WRIST = { L: [11.4, -9.4, 17.4], R: [-11.5, -6.5, 16.0] };
const PAW = { L: [10.9, -10.6, 16.3], R: [-11.4, -7.0, 13.6] };

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [4.5, -0.5, 12.5] },
  { name: 'legR', parent: 'root', at: [-4.5, -1.0, 12.5] },
  { name: 'body', parent: 'root', at: [0, 0, 14.5] },
  { name: 'head', parent: 'body', at: H([0, 1.5, -3]) },
  { name: 'stalk', parent: 'head', at: H([1.6, -7.4, -2.0]) },
  ...['L', 'R'].flatMap((S) => [
    { name: `arm${S}`, parent: 'body', at: SHOULDER[S] },
    { name: `fore${S}`, parent: `arm${S}`, at: ELBOW[S] },
    { name: `hand${S}`, parent: `fore${S}`, at: WRIST[S] },
  ]),
  { name: 'cape1', parent: 'body', at: [0, 3, 25] },
  ...face.joints,
];

const torso = blob([[[8.0, 6.5, 3.5], [0, 0, 14.5]], [[9.6, 7.2, 5.0], [0, -2.0, 26]]]);
const legs = [
  ...chain(['legL'], [[4.5, -0.5, 12.5], [2.6, -3.4, 7.6], [7.4, -1.2, 4.6]], [3.9, 3.4, 2.8]),
  ['legR', limb([-4.5, -1.0, 12.5], [-7.6, -4.0, 6.0], 3.9, 3.2)],
];
const sleeves = ['L', 'R'].map((S) => [`arm${S}`, limb(SHOULDER[S], ELBOW[S], 3.3, 3.0)]);
const fores = ['L', 'R'].map((S) => [`fore${S}`, limb(ELBOW[S], WRIST[S], 3.1, 2.6)]);
const hands = [
  ['handL', any(ell([2.8, 2.5, 2.6], PAW.L), limb([9.3, -12, 16], [9.3, -12.5, 12.5], 1.6))],
  ['handR', any(ell([2.7, 2.5, 2.6], PAW.R), limb([-11.4, -8.6, 12.4], [-11.4, -8.9, 9.4], 2.4))],
];
// the head's parts in its own frame: skull, muzzle, cheeks, jaw, ears and the hat over them
const inHead = inFrame(HEAD, any(ell([4.4, 4.8, 4.2], [0, 0.5, 0.2]), blob([[[3.0, 3.0, 2.7], [0, -3.2, -0.6]], [[1.5, 1.5, 1.35], [0, -9.0, -0.7]]]),
  ell([3.4, 4.2, 3.8], [0, -0.6, -1.4]), blob([[[2.4, 2.6, 1.5], [0, -3.4, -2.6]], [[1.4, 1.4, 1.0], [0, -7.0, -2.1]]]),
  ell([8.4, 9.2, 3.2], [0, -2.6, 4.5])));

function assign(c, rgb) {
  const S = c[0] >= 0 ? 'L' : 'R';
  if (near(rgb, ROPE, 0.03)) return c[2] > 22 ? 'stalk' : 'body';           // the wheat stalk, else the lasso
  if (isAny(rgb, HEADC, 0.02) || near(rgb, CREAM, 0.02)) {
    if (inHead(c) < 1.25) return 'head';
    if (!near(rgb, CREAM, 0.02) && !near(rgb, HEADC[1], 0.02)) return 'head';  // nothing else is in the head's colours
  }
  if (near(rgb, CAPE, 0.03)) return 'cape1';
  if (near(rgb, GREY, 0.03)) return c[1] > 5 ? 'cape1' : `hand${S}`;         // a patch on the cape, else a paw
  if (isAny(rgb, BOOT, 0.03)) return c[2] < 8 ? `leg${S}` : 'body';          // boots and spurs; the buckle's steel
  if (near(rgb, BRACER, 0.03)) return `fore${S}`;
  if (near(rgb, LEATHER, 0.03)) {
    if (fores.some(([, t]) => t(c) < 1.25)) return `fore${S}`;               // the bracer straps
    return c[1] > 7 && c[2] < 23 ? 'cape1' : 'body';                         // the cape's fold lines, else straps
  }
  if (near(rgb, CLAW, 0.03)) return pick(c, [...hands, ['body', any(ell([2, 1.2, 1.6], [1.2, -7, 14.2]), ell([1.5, 1, 1.5], [0, 10.3, 27.5]))]]);
  if (near(rgb, PANTS, 0.03)) return pick(c, [...legs, ['body', ell([8.6, 7.0, 1.6], [0, -0.2, 14.2])]]);
  if (near(rgb, SHIRT, 0.03)) return pick(c, [['body', any(torso, ...[-30, -18, -6, 6].map((a) => spike([7.6 * Math.sin(a * Math.PI / 180), -6.4 * Math.cos(a * Math.PI / 180), 16.5], [0, -0.3, -5], 1)))], ...sleeves]);
  return 'body';                                                             // mantle, bandana, bandolier, holster
}

// the stalk's chew: a waggle up and down (rx about the lips) and a little side to side
const chew = (u, cycles, amp = 1) => ({ stalk: { r: [8 * amp * osc(u, cycles), 0, 6 * amp * osc(u, cycles / 2, 0.25)] } });

const base = bipedClips({
  face, cape: ['cape1'], hipH: 12.5, stride: 18, armSwing: 14, hopScale: 0.2,
  punch: { arm: [-80, 0, 0], fore: [-15, 0, 0] },
  cheer: { arm: [-20, -115, 0], fore: [-10, 25, 0] },
  add: {
    idle: (t, u) => chew(u, 2, 0.4),
    walk: (t, u) => chew(u, 1, 0.6),
    hurt: (t, u) => chew(u, 3, 1.5),
    celebrate: (t, u) => chew(u, 2, 1.4),
  },
});

const clips = {
  ...base,

  // fidget: chews the wheat stalk, flicking it from one corner of the mouth to the other, eyes half shut
  idle_chew: {
    seconds: 2.4,
    pose: (t, u) => {
      const sw = K(u, [[0, 0], [0.2, 0], [0.35, 1], [0.6, 1], [0.75, 0]]);
      return {
        head: { r: [2 * osc(u, 4), 0, 4 * sw] },
        stalk: { r: [10 * osc(u, 6), 0, -40 * sw] },
        ...face.pose('open', 0.45 * win(u, 0.1, 0.9, 0.1)),
        ...both('arm', { r: [2 * osc(u, 2), 0, 0] }),
      };
    },
  },

  // fidget: tips the hat brim with its left paw and a slow nod, then lets the arm swing back down
  idle_tiphat: {
    seconds: 2.2,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.3, 1], [0.65, 1], [0.9, 0]]);
      const nod = win(u, 0.35, 0.62, 0.08);
      return {
        body: { r: [0, 0, 4 * up] },
        head: { r: [12 * nod, 0, 8 * up] },
        armL: { r: [-70 * up, 18 * up, -10 * up] },
        foreL: { r: [-60 * up, 0, 0] },
        handL: { r: [-20 * up, 0, 0] },
        ...face.pose('open', blinks(u, [[0.45, 0.55]])),
        ...chew(u, 2, 0.5),
      };
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
