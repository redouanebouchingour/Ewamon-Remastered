// Bloomsprite's rig: a little flower fairy in a leaf dress, a rose hat that bobs on its own, a rose wand in her right
// hand and two pairs of petal wings (the template's wing layer drives the upper pair, the lower pair rides it). Numbers
// are scad/bloomsprite.scad's, which authors in sheet height and lowers the whole model by G: Z() applies the same.
import { K, TAU, both, merge, osc, rigDef } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near, plateD, side, subFrame } from './lib/geo.mjs';

const G = 2.1;
const Z = (p) => [p[0], p[1], p[2] - G];
// the head block: drawn at sheet size, scaled HK about HC and lifted HL (scad), then lowered by G with the rest
const HK = 1.28;
const HC = [0, -0.5, 26.2];
const HL = 0.4;
const RZ = 1.6;   // the rose hat's rise
const HF = subFrame([HC[0] * (1 - HK), HC[1] * (1 - HK), HC[2] * (1 - HK) + HL - G], [0, 0, 0], HK);
const inHead = (test) => (c) => test(HF.local(c));

const SKIN = [0.94, 0.74, 0.6];
const HAIR = [0.36, 0.31, 0.42];
const LEAVES = [[0.46, 0.61, 0.38], [0.56, 0.71, 0.42], [0.25, 0.39, 0.31], [0.2, 0.3, 0.28]];
const BELT = [0.42, 0.32, 0.46];
const TWIG = [0.5, 0.33, 0.2];
const ROSES = [[0.58, 0.18, 0.27], [0.8, 0.42, 0.48], [0.92, 0.56, 0.6], [0.97, 0.7, 0.72]];
const WINGS = [[0.97, 0.73, 0.75], [0.54, 0.22, 0.33], [0.88, 0.55, 0.59]];

const eyeL = { side: 'L', at: [1.85, -3.2, 25.9], size: 0.95, yaw: 28, frame: HF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: SKIN });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', Z([1.7, 0.2, 13.2])),
  { name: 'body', parent: 'root', at: Z([0, 0.1, 14.5]) },
  { name: 'head', parent: 'body', at: Z([0, -0.2, 21.6]) },
  { name: 'hat', parent: 'head', at: Z([0, 0.4, 30.0 + RZ]) },
  ...pair('ear*', 'head', HF.world([3.4, -0.6, 26.2])),
  ...pair('arm*', 'body', Z([2.9, 0.2, 20.3])),
  { name: 'handL', parent: 'armL', at: Z([9.3, 0.4, 14.2]) },
  { name: 'handR', parent: 'armR', at: Z([-8.3, -1.6, 16.6]) },
  ...pair('wing*', 'body', Z([1.4, 2.2, 22.5])),
  ...pair('wing2*', 'wing*', Z([1.4, 2.7, 18.5])),
  ...face.joints,
];

// the scad's primitives (sheet height), for the one-colour parts
const parts = [
  ['leg*', any(limb(Z([1.8, 0.2, 13.2]), Z([6.5, -0.2, 3.7]), 1.75, 1.12), ell([1.85, 1.1, 0.82], Z([7.3, -0.7, 2.92])))],
  ['armL', limb(Z([2.9, 0.2, 20.3]), Z([8.8, 0.5, 14.9]), 1.05, 0.82)],
  ['armR', limb(Z([-2.9, 0.2, 20.3]), Z([-7.8, -1.4, 17.0]), 1.05, 0.82)],
  ['handL', ell([1.1, 0.95, 1.15], Z([9.3, 0.4, 14.2]))],
  ['handR', ell([1.12, 1.0, 1.15], Z([-8.3, -1.6, 16.6]))],
  ['head', inHead(blob([[[3.7, 3.5, 3.7], [0, -0.5, 26.1]], [[1.6, 1.4, 0.8], [0, -1.7, 23.0]]]))],
  ['ear*', inHead(limb([3.4, -0.6, 26.2], [5.6, -0.2, 28.2], 0.6, 0.15))],
  ['body', limb(Z([0, -0.1, 20.8]), Z([0, -0.4, 23.0]), 0.9)],
];

// the wing outlines as the scad turns them into wing-plane x (wpts())
const wpts = (pts) => pts.map(([x, z]) => [(x - 1.1) / 0.866, z - G]);
const UPPER = wpts([[2.5, 21.8], [2.5, 25.3], [5.9, 28.6], [12.3, 34.0], [17.4, 39.0], [18.6, 38.5], [18.5, 35.0], [17.6, 32.1],
  [19.8, 32.6], [19.7, 31.6], [18.5, 28.4], [16.9, 26.5], [18.5, 26.4], [18.2, 25.0], [15.4, 22.3], [13.9, 21.3],
  [10.9, 20.6], [8, 20.4], [5.5, 20.8]]);
const LOWER = wpts([[2.5, 20.5], [6, 20.3], [10.0, 19.9], [11.5, 17.5], [14.2, 13.7], [15.1, 13.3], [14.5, 12.7], [10.0, 12.6],
  [6.9, 13.2], [4.5, 14.5], [2.5, 16.5]]);

function assign(c, rgb) {
  const S = side(c);
  const s = [c[0], c[1], c[2] + G];   // back to sheet height
  if (near(rgb, TWIG) || (s[0] < -9.8 && s[1] < 0 && s[2] > 20.5)) return 'handR';   // the wand, its rose and leaves
  if (isAny(rgb, WINGS) && s[1] > 1.3 && Math.abs(s[0]) > 1.2 && s[2] < 39.5) {
    const x = Math.abs(c[0]);
    const up = plateD([x, c[1] - 2.2, c[2]], UPPER, 1.3);
    const lo = plateD([x, c[1] - 2.7, c[2]], LOWER, 1.3);
    return up <= lo ? `wing${S}` : `wing2${S}`;
  }
  if ((s[2] > 29.6 + RZ && isAny(rgb, ROSES)) || (s[2] > 27.5 + RZ && isAny(rgb, LEAVES))) return 'hat';
  if (isAny(rgb, LEAVES) || near(rgb, BELT)) return 'body';
  if (near(rgb, HAIR) || (!near(rgb, SKIN) && s[2] > 22.5)) return 'head';   // hair, eyes, lashes, cheeks, mouth
  return pick(c, parts);
}

const bob = (u, cycles = 2, amp = 1) => ({ hat: { r: [3 * amp * osc(u, cycles, 0.2), 4 * amp * osc(u, cycles / 2, 0.1), 0] } });
const lower = (u, cycles, amp = 1) => both('wing2', { r: [0, 6 * amp * osc(u, cycles, -0.15), 0] });

const base = bipedClips({
  face, hipH: 11, stride: 20, armSwing: 16, hopScale: 1, hopH: 4, lift: 37,
  wing: { open: [0, -16, 12], flap: 18 },
  // a wand flick at the foe
  punch: { arm: [-95, 10, 0] },
  add: {
    idle: (t, u) => merge(bob(u, 2), lower(u, 2)),
    walk: (t, u) => merge(bob(u, 2, 1.4), lower(u, 2, 1.4)),
    idle_look: (t, u) => bob(u, 2),
    lunge: (t, u) => ({ handR: { r: [-30 * K(u, [[0.1, 0], [0.4, 1], [1, 0]]), 0, 0] } }),
    hurt: (t, u) => bob(u, 2, 1.5),
    celebrate: (t, u) => merge(bob(u, 2, 2), lower(u, 2, 2.5)),
    exit: (t, u) => lower(u, 2, 2),
  },
});

const clips = {
  ...base,

  // fidget: she twirls the wand in little circles, wings shivering, and the rose on top bobs
  idle_twirl: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.15, 1], [0.8, 1], [0.95, 0]]);
      const a = TAU * 3 * u;
      return merge({
        head: { r: [-6 * on, 0, -10 * on] },
        ...face.pose(on > 0.4 ? 'happy' : 'open'),
        armR: { r: [-50 * on + 8 * Math.sin(a) * on, 0, 8 * Math.cos(a) * on] },
        handR: { r: [0, 0, 0], s: 1 + 0.06 * on },
        ...both('wing', { r: [0, 5 * osc(u, 12) * on, 0] }),
      }, bob(u, 2), lower(u, 6, on));
    },
  },

  // fidget: a quick hover: the wings beat hard and she lifts off her toes, legs dangling, then settles
  idle_hover: {
    seconds: 2,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.15, 0], [0.35, 1], [0.7, 1], [0.9, 0]]);
      const beat = osc(u, 10);
      return merge({
        root: { p: [0, 0, 4 * up + 0.4 * beat * up] },
        body: { r: [4 * up, 0, 0] },
        head: { r: [-4 * up, 0, 6 * up] },
        ...face.pose('open', blinks(u, [[0.5, 0.55]])),
        ...both('leg', { r: [14 * up, 0, 0] }, { r: [-4 * up, 0, 0] }),
        ...both('arm', { r: [0, -20 * up, 0] }),
        ...both('wing', { r: [0, -16 * up + 22 * beat * up, 12 * up] }),
      }, lower(u, 10, 2 * up), bob(u, 2));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
