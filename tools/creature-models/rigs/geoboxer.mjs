// Geoboxer's rig: a hulking rock-plated brawler in a wide crouch, boulder fists raised in guard beside its head. The
// near (+X, L) arm is held higher than the far one, as drawn. Numbers are scad/geoboxer.scad's (sheet z: the soles
// stand on z 3.8).
import { K, TAU, both, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, inFrame, limb, mx, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { subFrame } from './lib/geo.mjs';

const SKIN_DK = [0.42, 0.31, 0.22];
const SOLE = 3.8;

// the arms, per side: shoulder, elbow, forearm boulder (centre, radii), fist boulder (centre, radii)
const ARM = {
  L: { SH: [9.0, -0.5, 28.2], EL: [15.4, -2.4, 21.4], FA: [17.6, -3.6, 25.0], RA: [5.8, 4.6, 5.4], FI: [18.0, -5.2, 34.4], RI: [5.6, 4.8, 4.8] },
  R: { SH: [-9.0, -0.5, 27.2], EL: [-14.8, -2.4, 19.6], FA: [-16.0, -3.4, 22.6], RA: [5.4, 4.4, 5.0], FI: [-16.6, -5.4, 30.4], RI: [5.2, 4.6, 4.5] },
};
const wrist = (a) => [(a.FA[0] + a.FI[0]) / 2, (a.FA[1] + a.FI[1]) / 2, a.FA[2] + a.RA[2] * 0.95];

const headF = subFrame([-1.2, -5.0, 34.6], [0, 0, 30]);
const eyeL = { side: 'L', at: [1.8, -3.6, -1.95], size: 0.78, yaw: 12, flat: 0.5, frame: headF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: SKIN_DK });

const joints = [
  { name: 'root', at: [0, -1, SOLE] },
  { name: 'legL', parent: 'root', at: [4.8, 0.2, 15.6] },
  { name: 'legR', parent: 'root', at: [-4.8, 0.2, 15.6] },
  { name: 'body', parent: 'root', at: [0, 0.2, 15.6] },
  { name: 'head', parent: 'body', at: [-0.9, -3.6, 32.4] },
  ...['L', 'R'].flatMap((S) => [
    { name: `arm${S}`, parent: 'body', at: ARM[S].SH },
    { name: `fore${S}`, parent: `arm${S}`, at: ARM[S].EL },
    { name: `hand${S}`, parent: `fore${S}`, at: wrist(ARM[S]) },
  ]),
  ...face.joints,
];

const C1 = [0, -0.5, 24.8]; const R1 = [7.8, 5.2, 5.0];
const C2 = [0, 0, 18.8]; const R2 = [5.4, 4.2, 3.6];

const parts = [
  ['body', any(blob([[R1, C1], [R2, C2]]), ell([5.5, 4.4, 3.6], [0, 0.6, 18.2]), ell([5.4, 4.3, 2.8], [0, 0.3, 16.2]),
    mx(ell([2.9, 2.6, 2.8], [2.6, 2.4, 15.8])), mx(ell([3.4, 3.6, 2.4], [4.2, 0.4, 29.4])))],
  ['head', any(limb([0, -0.6, 28.0], [-0.9, -3.6, 32.4], 3.6, 3.0), inFrame(headF, any(ell([4.7, 4.5, 4.8], [0, 0.4, 0.5]),
    blob([[[4.0, 3.4, 2.4], [0, -0.4, -3.6]], [[3.2, 2.6, 2.0], [0, -1.0, -4.4]]]), ell([2.8, 1.6, 2.4], [0, -2.5, -2.6]))))],
  ...['L', 'R'].flatMap((S) => {
    const a = ARM[S];
    const k = S === 'L' ? 1 : -1;
    return [
      [`arm${S}`, any(ell([3.4, 3.3, 3.3], [a.SH[0] + k * 0.4, a.SH[1], a.SH[2] + 0.6]), limb(a.SH, a.EL, 3.0, 2.8))],
      [`fore${S}`, ell(a.RA, a.FA)],
      [`hand${S}`, any(ell(a.RI, a.FI), ell([a.RI[0] * 1.05, a.RI[1] * 1.15, a.RI[2]], [a.FI[0], a.FI[1] - 0.5, a.FI[2]]))],
    ];
  }),
  ...['L', 'R'].map((S) => {
    const k = S === 'L' ? 1 : -1;
    const m = (p) => [p[0] * k, p[1], p[2]];
    return [`leg${S}`, any(limb(m([4.8, 0.2, 15.6]), m([10.4, -2.0, 12.6]), 4.4, 3.5), ell([3.8, 3.2, 2.9], m([7.8, -2.2, 14.4])),
      ell([3.0, 3.0, 3.0], m([10.4, -2.0, 12.6])), limb(m([10.4, -2.0, 12.6]), m([12.4, -2.6, 6.2]), 3.2, 2.5), ell([2.8, 2.7, 3.2], m([11.6, -0.8, 9.8])),
      blob([[[2.6, 2.8, 1.3], m([12.7, -2.0, 5.0])], [[2.7, 1.9, 1.0], m([14.0, -5.6, 4.85])]]), ell([3.6, 1.6, 1.2], m([14.5, -7.3, 4.6])))];
  }),
];

const assign = (c) => pick(c, parts);

const base = bipedClips({
  face, hipH: 15.6 - SOLE, stride: 16, guard: true, hopScale: 0, hopH: 2,
  punch: { arm: [-40, 0, 0], fore: [60, 0, 0] },
  cheer: { arm: [0, -55, 0], fore: [0, 35, 0] },
  add: {
    celebrate: (t, u) => both('fore', { r: [-10 * Math.abs(Math.sin(TAU * 2 * u)), 0, 0] }),
  },
});

const clips = {
  ...base,

  // fidget: lifts its left foot out to the side and stomps, the whole body shuddering
  idle_stomp: {
    seconds: 2,
    pose: (t, u) => {
      const lift = K(u, [[0, 0], [0.12, 0], [0.38, 1], [0.48, 0]]);
      const hit = u > 0.48 ? Math.sin(TAU * 5 * (u - 0.48)) * Math.max(0, 1 - (u - 0.48) / 0.35) : 0;
      return {
        ...face.pose('open', 0.35 + 0.4 * lift),
        root: { r: [0, 3 * lift, 0] },
        legL: { r: [-6 * lift, -32 * lift, 0] },
        body: { p: [0, 0, -0.4 * Math.abs(hit)], r: [2 * hit, -6 * lift + 2 * hit, 0] },
        head: { r: [3 * hit, 0, 8 * lift] },
        ...both('arm', { r: [3 * hit, 0, 0] }),
      };
    },
  },

  // fidget: a bodybuilder's flex, fists curled in, chest puffed, the snarl at the camera
  idle_flex: {
    seconds: 2.2,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.7, 1], [0.88, 0]]);
      const tr = win(u, 0.25, 0.68, 0.05) * Math.sin(TAU * 8 * u);
      return {
        ...face.pose('open', 0.45 * on + blinks(u, [[0.76, 0.8]])),
        body: { s: [1 + 0.05 * on, 1 + 0.04 * on, 1], r: [-4 * on, 0, 0] },
        head: { r: [4 * on, 0, 10 * on] },
        ...both('arm', { r: [0, -12 * on + tr, 0] }),
        ...both('fore', { r: [-18 * on + tr, 0, 6 * on] }),
      };
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
