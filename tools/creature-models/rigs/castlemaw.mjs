// Castlemaw's rig: a hulking honey badger under a shaggy fur cloak, arms ending in cannon barrels (the forearm joint
// is the barrel, its bone elbow cap and the claws under the muzzle with it), a badger head turned to its right with a
// snarling jaw. The cloak, the pauldrons and the chest skull move with the body. Numbers are scad/castlemaw.scad's;
// castlemaw_rage.mjs (same body, recoloured, the jaw dropped) reuses this with its own jaw, colours and fidget.
import { K, TAU, both, merge, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, inFrame, limb, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, subFrame } from './lib/geo.mjs';

// the head block: translate(hc) rotate([0, 0, hYaw]) rotate([hPitch, 0, 0])
export const HEADF = subFrame([0.6, -5.6, 32.2], [6, 0, -12]);
const H = (p) => HEADF.world(p);

const EL = { L: [18, -1, 18.5], R: [-13.3, -5, 18.5] };
const MZ = { L: [21.5, -6.2, 12.5], R: [-13.6, -11.5, 11.2] };
const SH = { L: [12, -2, 28.5], R: [-12, -2, 28.5] };
// the legs: leg(x, xf, yf, fd) in the scad
const LEG = {
  L: { hip: [8.075, 0, 15], knee: [9.5, -1, 8], ankle: [11.5, 0, 3], foot: [12.7, -3.1, 2.2], toe: [14.8, -5.9, 1.8], fd: [0.6, -0.8] },
  R: { hip: [-6.8, 0, 15], knee: [-8, -1, 8], ankle: [-8.5, 0, 3], foot: [-8.5, -2, 2.2], toe: [-8.5, -5.5, 1.8], fd: [0, -1] },
};

const headShape = blob([[[4.9, 4.4, 4.5], [0, 1.0, 0.6]], [[3.8, 3, 3.3], [0, -3.3, -0.2]], [[2.0, 1.8, 1.8], [0, -7.2, -0.9]]]);
const fangs = (z, dz) => any(...[1, -1].flatMap((s) => [-7.2, -6, -4.8, -3.6].map((y) => spike([s * (1.5 + (y + 7.2) * 0.45), y - 0.2, z], [0, 0, dz], 0.42))));
export const HEAD = any(headShape, ell([1.7, 1.3, 1.5], [0, -7.8, -0.8]), ell([1.15, 0.6, 1.2], [4.4, 0.6, 4.3]), ell([1.15, 0.6, 1.2], [-4.4, 0.6, 4.3]),
  fangs(-2.0, -1.4));
/** jaw(drop): the lower jaw in the head's frame, `drop` scad units lower than Castlemaw's (the rage roars wider). */
export const jawAt = (drop = 0) => any(ell([3.0, 3.8, 1.3 + drop / 2], [0, -4.4, -3.0 - drop / 2]), ell([2.8, 3.6, 0.9], [0, -3.8, -4.1 - drop]),
  ell([2.8, 3.4, 1.2], [0, -3.0, -4.8 - drop]), ell([2.0, 3.2, 1.0], [0, -4.6, -3.1 - drop]),
  ...[1, -1].flatMap((s) => [-6.6, -5.0].map((y) => spike([s * (1.6 + (y + 7.2) * 0.45), y - 0.2, -4.0 - drop], [0, 0, 1.2], 0.38))));

const cannon = (S) => any(limb(EL[S], MZ[S], 3.4, 3.3), ell([2.6, 2.6, 2.2], [EL[S][0], EL[S][1] - 1.2, EL[S][2] + 0.8]),
  ell(S === 'L' ? [4.5, 4.5, 6] : [4, 4.5, 6], MZ[S].map((v, i) => v + [0, -1, -3][i])));
const legTest = (S) => {
  const l = LEG[S];
  return any(limb(l.hip, l.knee, 4.6, 4.0), limb(l.knee, l.ankle, 4.0, 3.2), blob([[[3.6, 4.2, 2.2], l.foot], [[2.6, 2.6, 1.8], l.toe]]),
    ell([2.6, 2.6, 1.6], [l.toe[0] + l.fd[0] * 2, l.toe[1] + l.fd[1] * 2, 0.8]));
};
const cloakMass = blob([[[14.5, 8, 7.2], [1.5, 4, 33]], [[19, 9.5, 9], [2.5, 5, 26]], [[12.5, 8.5, 6.2], [9.5, 5, 8]], [[6, 3.5, 5.5], [-12.5, -3.5, 23]]]);

export const parts = [
  ['body', any(ell([9.5, 7.5, 7.5], [0, -1, 21]), blob([[[8.5, 7.5, 5], [0, 0, 14]], [[7.5, 6.5, 4], [0, 0, 10.5]], [[6, 6, 3.5], [1, -1, 8.2]]]),
    ell([4.5, 4, 2.6], [1, -4, 27.6]), (c) => cloakMass(c) * 0.92, ell([9.7, 8.6, 2], [0, 0, 13.2]),
    ell([3.8, 4.2, 3], [12, -2, 29]), ell([3.8, 4.2, 3], [-11, -1.5, 29]), limb([12, -2, 30.8], [15, -1.5, 34], 1.6), limb([-11, -1.5, 30.8], [-13, -3.5, 33], 1.4),
    ell([0.6, 0.6, 0.6], [13.6, -7.4, 28.5]), ell([0.6, 0.6, 0.6], [-12.6, -6.9, 28.5]))],
  ['head', inFrame(HEADF, HEAD)],
  ['legL', legTest('L')], ['legR', legTest('R')],
  ['armL', limb(SH.L, EL.L, 3.2, 3.0)], ['armR', limb(SH.R, EL.R, 3.0, 3.0)],
  ['foreL', cannon('L')], ['foreR', cannon('R')],
];

const eyeL = { side: 'L', at: [3.05, -3.75, 1.15], size: 1.25, yaw: 45, frame: HEADF };
export const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.17, 0.18, 0.19] });

export const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: LEG.L.hip },
  { name: 'legR', parent: 'root', at: LEG.R.hip },
  { name: 'body', parent: 'root', at: [0, 0, 13] },
  { name: 'head', parent: 'body', at: H([0, 1, -3.5]) },
  { name: 'jaw', parent: 'head', at: H([0, -0.5, -2.6]) },
  ...['L', 'R'].flatMap((S) => [{ name: `arm${S}`, parent: 'body', at: SH[S] }, { name: `fore${S}`, parent: `arm${S}`, at: EL[S] }]),
  ...face.joints,
];

const CLOAK = [[0.23, 0.24, 0.25], [0.30, 0.32, 0.33]];

/**
 * assign(): the nearest primitive (the head block's in its own frame); the cloak's own colours always go to the body.
 * `cloak` lists the colours only the cloak has (they always go to the body), `extra` more [joint, test] entries.
 */
export const assignWith = ({ jaw = jawAt(0), cloak = CLOAK, extra = [] } = {}) => {
  const all = [...parts, ['jaw', inFrame(HEADF, jaw)], ...extra];
  return (c, rgb) => {
    if (isAny(rgb, cloak, 0.02)) return 'body';
    return pick(c, all);
  };
};

// the barrel kicks up (rx < 0 lifts a forward-pointing part) when the shot goes off at the lunge's hit
const kick = (u, at = 0.4) => K(u, [[at - 0.02, 0], [at + 0.06, 1], [at + 0.35, 0]]);

export const clipsFor = ({ extra = {}, fidgets = {} } = {}) => {
  const base = bipedClips({
    face, hipH: 14, stride: 13, armSwing: 9, hopScale: 0.2,
    punch: { arm: [-38, 0, 0], fore: [-14, 0, 0] },
    cheer: { arm: [-30, -70, 0], fore: [-20, 0, 0] },
    add: {
      ...extra,
      lunge: (t, u) => merge({ foreR: { r: [-22 * kick(u), 0, 0] }, jaw: { r: [10 * K(u, [[0.2, 0], [0.4, 1], [1, 0]]), 0, 0] } }, extra.lunge?.(t, u)),
    },
  });
  return {
    ...base,

    // fidget: raises the right cannon, sweeps it across the horizon, fires (a kick) and lowers it with a grunt
    idle_aim: {
      seconds: 3,
      pose: (t, u) => {
        const up = K(u, [[0, 0], [0.15, 1], [0.85, 1], [1, 0]]);
        const sweep = K(u, [[0, 0], [0.2, 0], [0.4, -1], [0.55, 0.6], [0.62, 0.6], [0.85, 0]]);
        const k = kick(u, 0.64);
        return {
          body: { r: [0, 0, -6 * up + 4 * sweep] },
          head: { r: [4 * up, 0, -10 * up + 12 * sweep] },
          armR: { r: [-40 * up, 0, -14 * sweep] },
          foreR: { r: [-16 * up - 26 * k, 0, 0] },
          armL: { r: [6 * up, -4 * up, 0] },
          jaw: { r: [8 * k, 0, 0] },
          ...face.pose('open', 0.4 * up + 0.6 * k),
        };
      },
    },

    // fidget: a snarl. The jaw snaps twice with a jerk of the head, then it licks its chops and settles
    idle_snarl: {
      seconds: 2,
      pose: (t, u) => {
        const snap = win(u, 0.15, 0.27, 0.04) + win(u, 0.36, 0.48, 0.04);
        const on = win(u, 0.08, 0.7, 0.1);
        return {
          body: { r: [4 * on, 0, 0] },
          head: { r: [6 * on - 6 * snap, 0, 3 * Math.sin(TAU * 6 * u) * on] },
          jaw: { r: [18 * snap + 4 * on, 0, 0] },
          ...both('arm', { r: [-6 * on, -6 * on, 0] }),
          ...face.pose('open', 0.35 * on + blinks(u, [[0.8, 0.86]])),
        };
      },
    },
    ...fidgets,
  };
};

export default rigDef({ joints, assign: assignWith(), extras: face.extras, clips: clipsFor() });
