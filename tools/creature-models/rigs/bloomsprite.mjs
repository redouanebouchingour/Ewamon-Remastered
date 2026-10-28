// Bloomsprite's rig: a little flower fairy in a leaf dress, a rosebud hat that bobs on its own, a rose wand in her right
// hand and two pairs of petal wings (the template's wing layer drives the upper pair, the lower pair rides it). Numbers
// are scad/bloomsprite.scad's.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, limb, mx, pair, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { fold, isAny, near, petalD, side } from './lib/geo.mjs';

const SKIN = [0.92, 0.72, 0.6];
const HAIR = [0.3, 0.27, 0.36];
const ROSES = [[0.86, 0.38, 0.45], [0.62, 0.18, 0.28]];
const ROSE_LT = [0.96, 0.6, 0.62];
const LEAVES = [[0.32, 0.6, 0.28], [0.18, 0.42, 0.2]];
const BELT = [0.25, 0.2, 0.28];
const WINGS = [[1, 0.84, 0.88], [0.82, 0.48, 0.55]];
const TWIG = [0.48, 0.32, 0.18];

const eyeL = { side: 'L', at: [1.6, -3.7, 27.6], size: 1.05, yaw: -14 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: SKIN });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [2, 0, 13]),
  { name: 'body', parent: 'root', at: [0, 0, 14] },
  { name: 'head', parent: 'body', at: [0, -0.3, 24.5] },
  { name: 'hat', parent: 'head', at: [0, 0.5, 33] },
  ...pair('ear*', 'head', [4.2, 0, 27.5]),
  ...pair('arm*', 'body', [3.2, 0, 22.5]),
  { name: 'handL', parent: 'armL', at: [6.2, -2.8, 18.2] },
  { name: 'handR', parent: 'armR', at: [-5.2, -2.3, 17.6] },
  ...pair('wing*', 'body', [1.6, 2.6, 23]),
  ...pair('wing2*', 'wing*', [1.6, 2.6, 21]),
  ...face.joints,
];

const parts = [
  ['leg*', any(limb([2, 0, 13], [3.2, -0.5, 1.5], 1.4, 1), ell([1.1, 2, 0.8], [3.3, -1.2, 0.8]))],
  ['body', any(blob([[[3.4, 2.6, 3], [0, 0, 18]], [[2.8, 2.2, 2], [0, 0, 22]]]), ell([5.5, 5.5, 5], [0, 0, 12]))],
  ['arm*', limb([3.2, 0, 22.5], [6, -2.5, 18.5], 0.9, 0.8)],
  ['hand*', ell([0.9, 0.9, 0.9], [6.2, -2.8, 18.2])],
  ['head', any(ell([4.2, 4, 4.2], [0, -0.3, 28]), mx(ell([0.7, 0.3, 0.4], [2.6, -3.5, 26])))],
  ['ear*', spike([4.2, 0, 27.5], [2.2, 0.4, 0.8], 0.7)],
];

function assign(c, rgb) {
  const S = side(c);
  const wand = c[0] < -5.3 && c[1] < -1.8 && c[2] > 12.5;
  if (near(rgb, TWIG) || (wand && !near(rgb, SKIN))) return 'handR';
  if (isAny(rgb, WINGS) || (near(rgb, ROSE_LT) && Math.abs(c[0]) > 3 && c[2] < 37)) {
    const f = fold(c);
    return petalD(f, [11, 0.9, 4.2], [8, 3.5, 29], [10, -50, 22]) < petalD(f, [8, 0.8, 3.2], [7, 3.2, 19], [-10, 25, 22]) ? `wing${S}` : `wing2${S}`;
  }
  if (c[2] > 31.5 && !near(rgb, SKIN) && !near(rgb, HAIR)) return 'hat';
  if (isAny(rgb, LEAVES) || near(rgb, BELT)) return 'body';
  if (near(rgb, HAIR) || !near(rgb, SKIN)) return 'head';   // hair, eyes, cheeks, mouth
  return pick(c, parts);
}

const bob = (u, cycles = 2, amp = 1) => ({ hat: { r: [3 * amp * osc(u, cycles, 0.2), 4 * amp * osc(u, cycles / 2, 0.1), 0] } });
const lower = (u, cycles, amp = 1) => both('wing2', { r: [0, 6 * amp * osc(u, cycles, -0.15), 0] });

const base = bipedClips({
  face, hipH: 13, stride: 22, armSwing: 18, hopScale: 1, hopH: 4,
  wing: { open: [0, -16, 12], flap: 18 },
  // a wand flick at the foe
  punch: { arm: [-95, 10, 0] },
  add: {
    idle: (t, u) => merge(bob(u, 2), lower(u, 2)),
    walk: (t, u) => merge(bob(u, 2, 1.4), lower(u, 2, 1.4)),
    idle_look: (t, u) => bob(u, 2),
    lunge: (t, u) => ({ handR: { r: [-30 * K(u, [[0.1, 0], [0.4, 1], [1, 0]]), 0, 0] } }),
    hurt: (t, u) => bob(u, 2, 2.5),
    celebrate: (t, u) => merge(bob(u, 2, 2), lower(u, 2, 2.5)),
    exit: (t, u) => lower(u, 2, 2),
  },
});

const clips = {
  ...base,

  // fidget: she twirls the wand in little circles, wings shivering, and the rose on top glows bigger
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
