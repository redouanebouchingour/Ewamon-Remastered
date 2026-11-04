// Pebfist's rig: a squat tan boxer in a wide crouch, slate gloves up in guard (the far, right one high by the face,
// the near, left one forward in front of the chest), the head tucked forward between them. Numbers are
// scad/pebfist.scad's (sheet z: the soles stand on z 3.8).
import { TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, inFrame, limb, mx, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, subFrame } from './lib/geo.mjs';

const SKIN_DK = [0.42, 0.31, 0.22];
const GLOVES = [[0.41, 0.44, 0.46], [0.30, 0.33, 0.35]];
const SOLE = 3.8;

const add = (a, b) => a.map((v, i) => v + b[i]);
const sc = (a, k) => a.map((v) => v * k);
const mid = (a, b, k = 0.5) => a.map((v, i) => v + (b[i] - v) * k);

// the arms, per side: shoulder, elbow, wrist, glove centre, thumb (offsets from the glove centre)
const ARM = {
  L: { SH: [7.8, 0, 25.8], EL: [9.8, -1.2, 19.2], W: [8.4, -3.8, 20.6], G: [5.4, -8.6, 22.4], T1: [-3.9, 1.4, 1.8], T2: [-3.8, -1.8, 2.0], k: 1 },
  R: { SH: [-8.2, 0, 25.4], EL: [-15.4, -2.0, 19.8], W: [-15.8, -3.0, 23.4], G: [-15.6, -5.0, 28.8], T1: [4.0, 0.2, -1.8], T2: [3.7, -2.6, 0.6], k: -1 },
};
const gloveParts = (a) => {
  const d = a.W.map((v, i) => v - a.G[i]);
  const u = sc(d, 1 / Math.hypot(...d));
  return any(limb(a.G, add(a.G, sc(u, 2.4)), 5.5, 4.5), limb(add(a.G, sc(u, 4.8)), add(a.G, sc(u, 6.2)), 3.0, 2.9),
    limb(add(a.G, a.T1), add(a.G, a.T2), 1.7, 1.45));
};

// the legs, per side: hip, knee, ankle, the foot's direction and length
const LEG = {
  L: { HP: [4.4, 0.2, 15.0], KN: [10.4, -2.0, 10.6], AN: [11.8, -1.5, 6.6], d: [0.92, -0.38], L: 6.6 },
  R: { HP: [-4.4, 0.2, 15.0], KN: [-12.1, -2.0, 12.0], AN: [-13.4, -1.5, 6.8], d: [-0.6, -0.8], L: 6.4 },
};
const legParts = (g) => {
  const { HP, KN, AN, d, L } = g;
  const toe = (t) => [AN[0] + d[0] * L + d[1] * t * 1.1, AN[1] + d[1] * L - d[0] * t * 1.1, 4.5 - Math.abs(t) * 0.05];
  return any(limb(HP, KN, 4.1, 3.3), ell([3.4, 3.2, 3.9], add(mid(HP, KN), [0, -1.0, 0.4])), ell([3.1, 3.1, 3.0], KN),
    limb(KN, AN, 2.9, 2.3), ell([2.6, 2.6, 3.0], add(mid(KN, AN, 0.4), [-d[0] * 0.9, -d[1] * 0.9, 0])),
    blob([[[2.5, 2.5, 1.5], [AN[0], AN[1], 5.3]], [[2.7, 2.7, 1.3], [AN[0] + d[0] * L * 0.75, AN[1] + d[1] * L * 0.75, 5.1]]]),
    ...[-1.5, -0.5, 0.5, 1.5].map((t) => ell([0.85, 0.85, 0.7], toe(t))));
};

const headF = subFrame([-1.8, -4.4, 33.4], [0, 0, 12]);
const eyeL = { side: 'L', at: [2.45, -4.3, -2.0], size: 1.2, yaw: 14, flat: 0.5, frame: headF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: SKIN_DK });

const joints = [
  { name: 'root', at: [0, -1, SOLE] },
  { name: 'legL', parent: 'root', at: LEG.L.HP },
  { name: 'legR', parent: 'root', at: LEG.R.HP },
  { name: 'body', parent: 'root', at: [0, 0.2, 15.0] },
  { name: 'head', parent: 'body', at: [-0.5, -1.9, 28.9] },
  ...['L', 'R'].flatMap((S) => [
    { name: `arm${S}`, parent: 'body', at: ARM[S].SH },
    { name: `fore${S}`, parent: `arm${S}`, at: ARM[S].EL },
    { name: `hand${S}`, parent: `fore${S}`, at: ARM[S].W },
  ]),
  ...face.joints,
];

const parts = [
  ['body', any(blob([[[7.0, 4.9, 4.8], [0, 0, 23.6]], [[4.9, 4.0, 3.4], [0, 0.3, 17.8]]]), ell([4.9, 4.0, 2.5], [0, 0.4, 15.4]),
    mx(ell([3.5, 1.7, 2.7], [3.2, -3.9, 24.6])), mx(ell([2.8, 2.8, 1.6], [3.6, 0.6, 28.0])), mx(ell([1.4, 2.4, 3.4], [5.3, 0.2, 21.4])),
    mx(ell([3.2, 0.9, 3.0], [3.3, 4.0, 24.6])), mx(ell([3.0, 2.4, 3.1], [2.5, 2.6, 15.8])), mx(ell([1.6, 1.4, 2.6], [4.0, -2.6, 18.6])),
    ...[20.8, 18.8, 16.9].map((z) => mx(ell([1.35, 0.9, 0.9], [1.45, -3.55 - (z - 16.9) * 0.08, z]))), ell([0.35, 0.4, 3.8], [0, 4.25, 21.6]))],
  ['head', any(limb([0, -0.6, 27.2], [-1.0, -3.2, 30.6], 3.4, 3.0), inFrame(headF, any(ell([5.7, 5.4, 6.0], [0, 0.2, 0.6]),
    blob([[[4.7, 4.3, 3.2], [0, -0.5, -3.4]], [[3.3, 3.0, 2.1], [0, -1.4, -5.3]]]), mx(ell([0.8, 1.1, 1.7], [5.5, 0.6, -1.2])),
    mx(limb([4.3, -3.6, -0.3], [0.7, -5.0, -1.2], 1.1, 0.8)), mx(ell([1.8, 0.8, 1.35], [2.45, -4.15, -2.0])),
    mx(ell([1.2, 0.7, 1.4], [2.45, -4.3, -2.0])), limb([0, -5.0, -1.6], [0, -5.4, -2.6], 0.6, 0.75), ell([1.0, 0.8, 0.8], [0, -5.35, -3.0]),
    ell([1.6, 0.6, 0.5], [0, -4.7, -5.5]), limb([-1.9, -4.5, -5.3], [1.9, -4.5, -5.3], 0.3), limb([-1.3, -4.9, -4.65], [1.3, -4.9, -4.65], 0.3))))],
  ...['L', 'R'].flatMap((S) => {
    const a = ARM[S];
    return [
      [`arm${S}`, any(ell([3.4, 3.3, 3.2], add(a.SH, [a.k * 0.3, 0, 0.6])), limb(a.SH, a.EL, 3.1, 2.7), ell([2.2, 2.2, 2.7], add(mid(a.SH, a.EL), [0, -1.0, 0])))],
      [`fore${S}`, any(limb(a.EL, a.W, 2.8, 2.5), ell([2.5, 2.5, 2.5], mid(a.EL, a.W, 0.38)))],
      [`hand${S}`, gloveParts(a)],
    ];
  }),
  ['legL', legParts(LEG.L)],
  ['legR', legParts(LEG.R)],
];
const handParts = parts.filter(([n]) => n.startsWith('hand'));

function assign(c, rgb) {
  if (isAny(rgb, GLOVES)) return pick(c, handParts);
  return pick(c, parts.filter(([n]) => !n.startsWith('hand')));
}

// both gloves up in a V: the upper arms out and up, the forearms turned up from the elbow (k = share, wave = deg)
const cheerL = (k, wave = 0) => ({ armL: { r: [0, -122 * k, 0] }, foreL: { r: [0, (-152 + wave) * k, 0] } });
const cheerR = (k) => ({ armR: { r: [0, 116 * k, 0] }, foreR: { r: [0, -126 * k, 0] } });

const base = bipedClips({
  face, hipH: 15.0 - SOLE, stride: 14, guard: true, hopScale: 0.5, droop: 0.6,
  // the high right glove drives straight out from the cheek
  punch: { arm: [-70, 0, 0], fore: [100, 0, 0] },
  // the arms are not mirror images, so the cheer is set per arm below (the template only adds its pump)
  cheer: { arm: [0, 0, 0], fore: [0, 0, 0] },
  add: {
    idle: (t, u) => both('hand', { r: [0, 0, 4 * osc(u, 2)] }),
    // a boxer's bounce in the knees while it waddles
    walk: (t, u) => ({ body: { p: [0, 0, 0.3 * Math.abs(osc(u, 2))] } }),
    celebrate: (t, u) => ({ ...cheerL(win(u, 0, 1, 0.15)), ...cheerR(win(u, 0, 1, 0.15)) }),
    exit: (t, u) => cheerL(win(u, 0, 0.85, 0.2), 22 * Math.sin(TAU * 2 * u)),
  },
});

const clips = {
  ...base,

  // fidget: it bumps its gloves together twice and scowls harder, then rolls its neck
  idle_bump: {
    seconds: 2.2,
    pose: (t, u) => {
      const bump = (u0) => win(u, u0, u0 + 0.12, 0.04);
      const b = bump(0.18) + bump(0.4);
      const roll = win(u, 0.6, 0.95, 0.08);
      return {
        body: { r: [3 * b, 0, 0] },
        head: { r: [6 * b + 6 * Math.sin(TAU * 2 * u) * roll, 10 * Math.cos(TAU * (u - 0.6) / 0.35) * roll, 0] },
        ...face.pose('open', 0.3 * b + blinks(u, [[0.8, 0.86]])),
        armR: { r: [-10 * b, 18 * b, 0] }, foreR: { r: [-14 * b, 0, 0] },
        armL: { r: [0, 10 * b, 0] }, foreL: { r: [0, 0, -10 * b] },
      };
    },
  },

  // fidget: a quick jab-jab with the forward glove, bouncing on its toes
  idle_jab: {
    seconds: 1.8,
    pose: (t, u) => {
      const j = win(u, 0.2, 0.32, 0.04) + win(u, 0.42, 0.54, 0.04);
      const on = win(u, 0.05, 0.9, 0.1);
      return merge({
        root: { p: [0, 0, 0.6 * Math.abs(osc(u, 4)) * on] },
        body: { r: [3 * on, 0, -8 * j] },
        head: { r: [2 * on, 0, 5 * j] },
        ...face.pose('open', 0.35 * on),
        armL: { r: [-20 * j, 0, -10 * j] }, foreL: { r: [0, 0, 30 * j] },
        handL: { s: 1 + 0.08 * j },
      }, both('leg', { r: [-2 * on, 0, 0] }));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
