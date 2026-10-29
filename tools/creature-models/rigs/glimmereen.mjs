// Glimmereen's rig: a round bubble fairy standing on two little legs (the body is the head), stubby arms, two pairs of
// petal wings behind (one joint per side), a bow with an antenna and a gold bead. Biped template with wings; the bow
// and antenna sway on top of every clip. Numbers are scad/glimmereen.scad's. The Tenjin form reuses glimRig().
import { TAU, merge, osc, rigDef, wave } from './lib/anim.mjs';
import { any, bipedClips, ell, limb, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { capD, ellD, isAny, near } from './lib/geo.mjs';

const PEARL = [0.94, 0.95, 1];
export const ANT = [[0, 0, 26.4], [-1.4, -0.2, 30], [-3.2, -0.4, 33]];
export const BEAD = [-3.6, -0.4, 34.2];

export const baseJoints = () => [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [3.4, 0, 10] },
  { name: 'legR', parent: 'root', at: [-3.4, 0, 10] },
  { name: 'body', parent: 'root', at: [0, 0, 10] },
  { name: 'armL', parent: 'body', at: [7.6, -1, 16.6] },
  { name: 'armR', parent: 'body', at: [-7.6, -1, 16.6] },
  { name: 'wingL', parent: 'body', at: [2, 6, 18] },
  { name: 'wingR', parent: 'body', at: [-2, 6, 18] },
  { name: 'crest1', parent: 'body', at: [-1.6, -1, 26.4] },
  { name: 'crest2', parent: 'crest1', at: ANT[1] },
];

// the shapes every pearl / periwinkle / blush triangle is tested against
export const parts = [
  ['body', ell([9.5, 9, 9], [0, 0, 18])],
  ['arm*', limb([7.6, -1, 16.6], [10.6, -2.6, 15.2], 1.8, 1.5)],
  ['leg*', any(limb([3.4, 0, 10], [3.6, -0.4, 2.2], 2.8, 2.5), ell([2.7, 3.2, 1.8], [3.6, -0.8, 1.8]))],
];

/** The bow and the antenna: the lower link with the bow, the upper link with the bead. */
export const antennaPart = (c, beadAt = BEAD) => (ellD(c, [2.6, 2.6, 2.6], beadAt) < 1 || capD(c, ANT[1], ANT[2], 1.2) < capD(c, ANT[0], ANT[1], 1.2) ? 'crest2' : 'crest1');

/** The template clips with the bow and the antenna swaying on top (a lazy bob, livelier when it moves). */
export function glimClips(face, extra = {}) {
  const sway = (u, amp, cycles) => wave(['crest1', 'crest2'], u, { cycles, amp: [amp, 0, amp * 0.6], lag: 0.15, grow: 0.6 });
  const amps = { idle: [3, 2], walk: [6, 2], idle_look: [3, 2], windup: [4, 1], lunge: [8, 1], hurt: [10, 3], recoil: [5, 1], faint: [4, 1], celebrate: [10, 3], enter: [8, 1], exit: [5, 2] };
  const add = Object.fromEntries(Object.entries(amps).map(([n, [a, c]]) => [n, (t, u) => merge(sway(u, a, c), extra[n]?.(t, u))]));
  const base = bipedClips({ face, hipH: 10, stride: 18, hopH: 3, armSwing: 18, wing: { open: [0, -10, -20], flap: 16 }, add });
  return {
    ...base,

    // fidget: a happy little twirl on the spot, the wings buzzing, ^ ^
    idle_twirl: {
      seconds: 2,
      pose: (t, u) => {
        const on = Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.1) / 0.8)));
        const turn = 360 * Math.min(1, Math.max(0, (u - 0.1) / 0.8)) ** 1.2;
        const bz = Math.sin(TAU * 10 * u) * on;
        return merge({
          root: { r: [0, 0, turn % 360], p: [0, 0, 1.2 * on] },
          wingL: { r: [0, -10 * on + 14 * bz, -20 * on] },
          wingR: { r: [0, 10 * on - 14 * bz, 20 * on] },
          armL: { r: [0, -40 * on, 0] },
          armR: { r: [0, 40 * on, 0] },
          ...(face ? face.pose(on > 0.3 ? 'happy' : 'open') : {}),
        }, sway(u, 10 * on + 2, 4));
      },
    },

    // fidget: the antenna droops forward to look at its own bead, the eyes cross, a sneeze shakes it back up
    idle_bead: {
      seconds: 2.4,
      pose: (t, u) => {
        const down = Math.min(1, Math.max(0, (u - 0.1) / 0.25)) * (u < 0.62 ? 1 : 0);
        const sneeze = u > 0.62 && u < 0.8 ? Math.sin(Math.PI * (u - 0.62) / 0.18) : 0;
        return merge({
          body: { r: [-4 * down + 8 * sneeze, 0, 0] },
          crest1: { r: [20 * down - 14 * sneeze, 0, 0] },
          crest2: { r: [30 * down - 20 * sneeze, 0, 0] },
          ...(face ? face.pose(sneeze > 0.2 ? 'squeeze' : 'open', blinks(u, [[0.86, 0.9]])) : {}),
        }, sway(u, 3 * (1 - down) + 6 * sneeze, 4));
      },
    },
  };
}

const eyeL = { side: 'L', at: [3.2, -8.3, 18.8], size: 1.5, yaw: -20, flat: 0.5 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], parent: 'body', skin: PEARL });

const WING = [[0.78, 0.9, 1], [0.96, 0.9, 1]];
const BOW = [[0.95, 0.6, 0.65], [0.82, 0.45, 0.52]];
const ANTENNA = [0.7, 0.72, 0.95];
const GOLD = [0.98, 0.8, 0.2];

function assign(c, rgb) {
  const S = c[0] >= 0 ? 'L' : 'R';
  if (isAny(rgb, WING, 0.03) || (near(rgb, [1, 1, 1], 0.02) && c[1] > 3)) return `wing${S}`;
  if (isAny(rgb, BOW, 0.03)) return 'crest1';
  if (near(rgb, ANTENNA, 0.03) || near(rgb, GOLD) || (near(rgb, [1, 1, 1], 0.02) && c[2] > 33)) return antennaPart(c);
  return pick(c, parts);
}

export default rigDef({ joints: [...baseJoints(), ...face.joints], assign, extras: face.extras, clips: glimClips(face) });
