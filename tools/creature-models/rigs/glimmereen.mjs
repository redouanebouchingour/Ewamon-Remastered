// Glimmereen's rig: a big round bubble fairy on two stubby legs (the body is the head), fat oval arm stubs, two pairs of
// big butterfly wings behind (one joint per side), a bow with an antenna and a gold bead. Biped template with wings;
// the bow and antenna sway on top of every clip. Numbers are scad/glimmereen.scad's (remodelled on the sprite
// 2026-11-04). The Tenjin form reuses glimClips(), baseJoints(), parts and antennaPart().
import { TAU, merge, rigDef, wave } from './lib/anim.mjs';
import { any, bipedClips, ell, limb, petal, pick } from './lib/biped.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { capD, ellD, isAny, near } from './lib/geo.mjs';

const PEARL = [0.96, 0.95, 0.96];
export const ANT = [[-0.3, -1.4, 29.2], [-0.95, -1.1, 30.6], [-2.25, -1, 33.9], [-3.65, -1, 35.7], [-4.6, -1, 36.6]];
export const BEAD = [-6.2, -1, 37.8];
export const KNOT = [0, -1.9, 28.6];

// the body ellipsoid and the scad's onBody(): a point on its surface at heading psi (deg from -Y towards +X)
export const B = [11.8, 11, 9.8];
export const BZ = 18.2;
const rad = (d) => (d * Math.PI) / 180;
export const onBody = (psi, z, out = 0) => {
  const k = Math.sqrt(Math.max(0, 1 - ((z - BZ) / B[2]) ** 2));
  const s = Math.sin(rad(psi)); const c = Math.cos(rad(psi));
  return [B[0] * k * s + out * s, -B[1] * k * c - out * c, z];
};

export const baseJoints = () => [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [4.5, 1, 10] },
  { name: 'legR', parent: 'root', at: [-4.5, 1, 10] },
  { name: 'body', parent: 'root', at: [0, 0, 10] },
  { name: 'armL', parent: 'body', at: [9.8, -0.5, 13.6] },
  { name: 'armR', parent: 'body', at: [-9.8, -0.5, 13.6] },
  { name: 'wingL', parent: 'body', at: [3, 7.7, 18] },
  { name: 'wingR', parent: 'body', at: [-3, 7.7, 18] },
  { name: 'crest1', parent: 'body', at: KNOT },
  { name: 'crest2', parent: 'crest1', at: ANT[2] },
];

// the shapes every pearl / periwinkle / ink triangle is tested against
export const parts = [
  ['body', ell(B, [0, 0, BZ])],
  ['arm*', petal([3.6, 2.3, 2.25], [12.6, -0.5, 12.9], [0, 15, 0])],
  ['leg*', any(limb([4.5, 1, 2.8], [4.5, 1, 10], 2.8, 2.35), ell([2.86, 2.86, 2.86], [4.5, 1, 2.8]))],
];

/** The antenna: the lower links ride the bow (crest1), the upper links and the bead the tip joint (crest2). */
export const antennaPart = (c, beadAt = BEAD, ant = ANT) => {
  if (ellD(c, [3.4, 3.4, 3.4], beadAt) < 1) return 'crest2';
  const lo = Math.min(capD(c, ant[0], ant[1], 1), capD(c, ant[1], ant[2], 1));
  const hi = Math.min(capD(c, ant[2], ant[3], 1), capD(c, ant[3], ant[4], 1));
  return hi < lo ? 'crest2' : 'crest1';
};

/** The template clips with the bow and the antenna swaying on top (a lazy bob, livelier when it moves). */
export function glimClips(face, extra = {}) {
  const sway = (u, amp, cycles) => wave(['crest1', 'crest2'], u, { cycles, amp: [amp, 0, amp * 0.6], lag: 0.15, grow: 0.6 });
  const amps = { idle: [3, 2], walk: [6, 2], idle_look: [3, 2], windup: [4, 1], lunge: [8, 1], hurt: [10, 3], recoil: [5, 1], faint: [4, 1], celebrate: [10, 3], enter: [8, 1], exit: [5, 2] };
  const add = Object.fromEntries(Object.entries(amps).map(([n, [a, c]]) => [n, (t, u) => merge(sway(u, a, c), extra[n]?.(t, u))]));
  const base = bipedClips({ face, hipH: 10, stride: 18, hopH: 3, armSwing: 18, wing: { open: [0, -8, -12], flap: 14 }, add });
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
          wingL: { r: [0, -8 * on + 12 * bz, -12 * on] },
          wingR: { r: [0, 8 * on - 12 * bz, 12 * on] },
          armL: { r: [0, -35 * on, 0] },
          armR: { r: [0, 35 * on, 0] },
          ...(face ? face.pose(on > 0.3 ? 'happy' : 'open') : {}),
        }, sway(u, 10 * on + 2, 4));
      },
    },

    // fidget: the antenna droops forward to look at its own bead, a sneeze shakes it back up
    idle_bead: {
      seconds: 2.4,
      pose: (t, u) => {
        const down = Math.min(1, Math.max(0, (u - 0.1) / 0.25)) * (u < 0.62 ? 1 : 0);
        const sneeze = u > 0.62 && u < 0.8 ? Math.sin(Math.PI * (u - 0.62) / 0.18) : 0;
        return merge({
          body: { r: [-4 * down + 8 * sneeze, 0, 0] },
          crest1: { r: [16 * down - 12 * sneeze, 0, 0] },
          crest2: { r: [26 * down - 18 * sneeze, 0, 0] },
          ...(face ? face.pose(sneeze > 0.2 ? 'squeeze' : 'open', blinks(u, [[0.86, 0.9]])) : {}),
        }, sway(u, 3 * (1 - down) + 6 * sneeze, 4));
      },
    },
  };
}

// the face is turned 7 deg towards the viewer as drawn, so the eyes are not mirrors: headings 29.5 and -15.5, at
// EZ = 20.1, sunk 0.35, size 1.7, flat 0.6, stretched 1.36 tall (the lid ellipsoid too)
const FACE = 7;
const EZ = 20.1;
const EYEZ = 1.36;
const eyeAt = (psi, side) => ({ side, at: onBody(psi, EZ, -0.35), size: 1.7, yaw: psi, flat: 0.6 });
const face = eyeKit({ eyes: [eyeAt(FACE + 22.5, 'L'), eyeAt(FACE - 22.5, 'R')], parent: 'body', skin: PEARL, lid: [1.14, 1, 1.2 * EYEZ] });

const WING = [[0.94, 0.92, 0.98], [0.84, 0.9, 0.98]];
const BOW = [[0.9, 0.67, 0.72], [0.84, 0.57, 0.67]];
const ANTENNA = [0.75, 0.74, 0.91];
const GOLD = [[0.9, 0.76, 0.32], [0.99, 0.95, 0.75]];

function assign(c, rgb) {
  const S = c[0] >= 0 ? 'L' : 'R';
  if (isAny(rgb, WING, 0.02) || (near(rgb, [1, 1, 1], 0.02) && c[1] > 5)) return `wing${S}`;
  if (isAny(rgb, BOW, 0.02)) return 'crest1';
  if (near(rgb, ANTENNA, 0.02) || isAny(rgb, GOLD, 0.02)) return antennaPart(c);
  return pick(c, parts);
}

export default rigDef({ joints: [...baseJoints(), ...face.joints], assign, extras: face.extras, clips: glimClips(face) });
