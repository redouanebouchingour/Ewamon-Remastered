// Stellaria's rig: a chibi star spirit in a navy gown. The head is turned 14 deg towards the viewer in the scad (all
// head parts sit in that frame); the hair falling behind and out to both sides hangs from the head as one joint (the
// template's cape layer); the flared cape of the gown below the bodice is its own joint (skirt, off the body) that
// swishes and flares; thin arms held out, slender pointed legs off the root. Numbers are scad/stellaria.scad's.
import { K, TAU, both, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, inFrame, limb, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { subFrame } from './lib/geo.mjs';

const D = Math.PI / 180;
const HC = [-0.2, -0.3, 31.2];
const HF = subFrame(HC, [0, 0, 14], 1);
const HAIR = [[6.0, 5.6, 5.9], [0, 0.9, 0.9]];
const FACE = [[4.5, 4.1, 4.4], [0, -1.7, -1.2]];
const EYE = [2.8, -4.5, -1.4];

const eyeL = { side: 'L', at: EYE, size: 1.6, yaw: 20, flat: 0.5, frame: HF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: [0.79, 0.93, 0.8] });

const SHL = [2.4, -0.3, 22.2]; const ELL = [5.8, -1.0, 20.5]; const HAL = [9.6, -1.4, 18.9];
const SHR = [-2.4, -0.3, 22.2]; const ELR = [-6.3, -1.7, 21.5]; const HAR = [-10.8, -3.5, 21.3];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [1.3, 0, 12.5] },
  { name: 'legR', parent: 'root', at: [-1.1, -0.4, 13.0] },
  { name: 'body', parent: 'root', at: [0, 0, 13] },
  { name: 'skirt', parent: 'body', at: [0, 0.4, 21.6] },
  { name: 'head', parent: 'body', at: [-0.1, -0.7, 26.0] },
  { name: 'cape1', parent: 'head', at: [-0.2, 2.6, 29] },
  { name: 'armL', parent: 'body', at: SHL },
  { name: 'foreL', parent: 'armL', at: ELL },
  { name: 'handL', parent: 'foreL', at: HAL },
  { name: 'armR', parent: 'body', at: SHR },
  { name: 'foreR', parent: 'armR', at: ELR },
  { name: 'handR', parent: 'foreR', at: HAR },
  ...face.joints,
];

// ---- the scad's primitives
const lookup = (z, tab) => {   // OpenSCAD lookup(): tab ascending in z
  if (z <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (z <= tab[i][0]) { const [z0, v0] = tab[i - 1]; const [z1, v1] = tab[i]; return v0 + ((v1 - v0) * (z - z0)) / (z1 - z0); }
  return tab[tab.length - 1][1];
};
const chainT = (pts, rs) => any(...pts.slice(1).map((p, i) => limb(pts[i], p, rs[i], rs[i + 1])));

// head (in the head frame): hair ball, face, eyes, smile, cheek locks, crown stars
const crown = [-125, -92, -60, -30, 0, 30, 60, 92, 125].map((t) => ell([2.0, 1.2, 2.0], [6.7 * Math.sin(t * D), -1.2 + 1.2 * Math.cos(t * D) - 0.3 * Math.abs(Math.sin(t * D)), 0.4 + 6.7 * Math.cos(t * D)]));
const headTest = inFrame(HF, any(ell(...HAIR), ell(...FACE), ell([1.7, 1.0, 1.9], EYE), ell([1.7, 1.0, 1.9], [-EYE[0], EYE[1], EYE[2]]),
  ell([1.0, 0.5, 0.5], [-0.3, -4.62, -4.0]),
  chainT([[4.5, -0.6, 1.4], [5.0, -1.3, -1.6], [4.6, -1.6, -4.4], [3.9, -1.2, -6.2]], [1.5, 1.35, 1.1, 0.6]),
  chainT([[-4.5, -0.6, 1.4], [-5.0, -1.3, -1.6], [-4.6, -1.6, -4.4], [-3.9, -1.2, -6.2]], [1.5, 1.35, 1.1, 0.6]), ...crown));

// the hair hanging from the head: back mass, its lobes and points, the side falls and the six locks
const LOCKS = [
  [[[5.6, 0.8, 32.6], [8.4, 1.2, 30.4], [10.6, 1.0, 28.8], [12.2, 0.6, 27.6], [13.6, 0.0, 28.4]], [2.4, 2.4, 1.8, 1.0, 0.25]],
  [[[7.6, 1.8, 28.0], [9.6, 2.0, 25.6], [10.6, 1.8, 23.6], [11.8, 1.4, 22.2], [13.2, 0.8, 22.8]], [2.4, 2.2, 1.6, 0.9, 0.2]],
  [[[6.4, 3.4, 24.6], [8.6, 3.8, 21.8], [9.8, 3.8, 20.2], [11.0, 3.4, 19.4]], [2.2, 1.8, 1.1, 0.2]],
  [[[-4.8, 0.2, 32.5], [-6.6, 0.2, 29.8], [-8.0, 0.0, 27.4], [-9.4, -0.4, 26.0], [-10.8, -0.8, 26.6]], [2.2, 2.0, 1.6, 0.9, 0.2]],
  [[[-6.0, 2.0, 26.6], [-7.6, 2.4, 24.4], [-8.8, 2.2, 22.8], [-10.4, 1.6, 22.8]], [2.2, 1.8, 1.0, 0.2]],
  [[[-4.8, 3.6, 23.6], [-6.6, 4.2, 21.2], [-7.6, 4.2, 20.0], [-8.8, 3.8, 19.8]], [2.0, 1.5, 1.0, 0.2]],
];
const lobes = [[-5.0, 22.2, 1.9], [-2.0, 21.0, 2.0], [1.2, 21.4, 2.0], [4.4, 21.8, 1.9]]
  .map((q) => blob([[[q[2], 1.8, 1.4], [q[0], 4.2, 24.4]], [[q[2] * 0.6, 1.0, 1.0], [q[0] * 1.06, 4.8, q[1]]]]));
const hairTest = any(
  blob([[[5.8, 3.6, 4.8], [-0.2, 2.4, 30.8]], [[6.6, 2.4, 1.8], [-0.2, 4.0, 23.6]]]), ...lobes,
  ...[-2.0, 4.4].map((x) => limb([x * 1.06, 4.9, 21.6], [x * 1.1 + 0.5, 5.3, 19.6], 0.9, 0.15)),
  blob([[[2.6, 2.8, 3.6], [4.6, 1.4, 31.0]], [[2.4, 2.2, 3.4], [8.4, 2.2, 25.0]], [[2.4, 1.8, 1.6], [6.4, 3.6, 21.6]]]),
  blob([[[2.4, 2.6, 3.4], [-4.6, 1.4, 30.0]], [[2.2, 2.0, 3.0], [-7.0, 2.4, 24.6]], [[2.2, 1.8, 1.4], [-5.6, 3.6, 21.6]]]),
  ...LOCKS.map(([pts, ws]) => chainT(pts, ws.map((w) => Math.max(w, 1.2)))));

// the gown: bodice, neck and bow; the dress (a lathe, y scaled 0.85); the cape sheet round it
const DSY = 0.85;
const DRESS = [[4.9, 4.0], [5.4, 5.8], [7.5, 6.0], [11, 5.2], [15, 4.0], [19, 3.0], [22.6, 2.4]];
const dressTest = (c) => (c[2] < 4.4 || c[2] > 23 ? 9 : Math.hypot(c[0], c[1] / DSY) / lookup(c[2], DRESS));
const bodyTest = any(blob([[[3.0, 2.3, 1.8], [0, -0.2, 22.4]], [[2.5, 2.0, 2.0], [0, 0, 19.0]]]), limb([-0.1, -0.5, 24.6], [-0.1, -0.9, 27.2], 0.95, 0.9),
  ell([3.4, 1.4, 1.8], [-0.5, -2.9, 24.2]), dressTest);
const CY = 0.4;
const RINGS = [[3.1, 2.7, 22.6], [6.0, 4.0, 21.0], [9.2, 5.6, 18.8], [12.2, 7.0, 16.4], [14.4, 8.0, 13.8], [15.0, 8.4, 11.2], [13.8, 8.0, 8.0]];
const RX = RINGS.map((r) => [r[2], r[0]]).reverse();
const RY = RINGS.map((r) => [r[2], r[1]]).reverse();
const capeTest = (c) => {
  if (c[2] > 23.4) return 9;
  const rr = Math.hypot(c[0] / lookup(c[2], RX), (c[1] - CY) / lookup(c[2], RY));
  return 1 + Math.abs(rr - 1) * 2.5;
};

const armT = (sh, el) => limb(sh, el, 0.72, 0.6);
const foreT = (el, ha) => limb(el, ha, 0.6, 0.5);
const handT = (el, ha) => { const d = ha.map((v, i) => v - el[i]); const n = Math.hypot(...d); const p = ha.map((v, i) => v + (d[i] / n) * 0.5); return ell([2.0, 2.0, 2.0], p); };

const parts = [
  ['head', headTest],
  ['cape1', hairTest],
  ['body', bodyTest],
  ['skirt', capeTest],
  ['armL', armT(SHL, ELL)], ['foreL', foreT(ELL, HAL)], ['handL', handT(ELL, HAL)],
  ['armR', armT(SHR, ELR)], ['foreR', foreT(ELR, HAR)], ['handR', handT(ELR, HAR)],
  ['legL', chainT([[1.3, 0, 12.5], [1.5, -0.4, 6.5], [1.9, -0.6, 0.9]], [1.5, 1.0, 0.18])],
  ['legR', chainT([[-1.1, -0.4, 13.0], [-1.0, -1.6, 7.0], [-1.3, -2.2, 0.3]], [1.9, 1.35, 0.2])],
];

/** assign(): nearest primitive; the cape's top round the bodice stays on the body. */
const assign = (c) => {
  const j = pick(c, parts);
  return j === 'skirt' && c[2] > 20.8 ? 'body' : j;
};

// the skirt per clip: a slow swish (rz), a flare (scale) and a trail (rx)
const sk = (rz = 0, rx = 0, flare = 0) => ({ skirt: { r: [rx, 0, rz], s: [1 + flare, 1 + flare, 1 - 0.4 * flare] } });

const base = bipedClips({
  face, cape: ['cape1'], hipH: 13, stride: 8, hopScale: 0.4, droop: 0.6, armSwing: 10,
  // the arms are held out sideways: a cast swings the right hand round to the front
  punch: { arm: [0, 0, 70], fore: [0, 0, 10] },
  cheer: { arm: [0, -45, 0], fore: [0, -15, 0] },
  add: {
    idle: (t, u) => sk(3 * osc(u, 1, 0.3), 1 * osc(u, 2, 0.1), 0.015 * osc(u, 2)),
    walk: (t, u) => sk(4 * osc(u, 1), 5 + 1.5 * osc(u, 2, 0.2), 0.02),
    idle_look: (t, u) => sk(4 * win(u, 0.15, 0.75, 0.1)),
    windup: (t, u) => sk(-6 * Math.min(1, u / 0.8), -2),
    lunge: (t, u) => { const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]); return sk(8 * hit, 8 * hit, 0.04 * hit); },
    hurt: (t, u) => { const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.45]]); return sk(-4 * k, -6 * k); },
    recoil: (t, u) => sk(0, -4 * K(u, [[0, 0], [0.4, 1], [1, 0]])),
    celebrate: (t, u) => sk(8 * Math.sin(TAU * 2 * u), 0, 0.06 * win(u, 0, 1, 0.15)),
    enter: (t, u) => sk(10 * (1 - Math.min(1, u / 0.6)), 0, 0.05 * win(u, 0.3, 0.9, 0.12)),
    exit: (t, u) => sk(6 * osc(u, 2), 0, 0.03),
  },
});

const clips = {
  ...base,

  // fidget: a slow pirouette, the cape flaring out, eyes closed
  idle_twirl: {
    seconds: 2.8,
    pose: (t, u) => {
      const spin = 360 * K(u, [[0, 0], [0.15, 0], [0.75, 1], [1, 1]]);
      const on = win(u, 0.1, 0.85, 0.1);
      return {
        root: { r: [0, 0, spin] },
        body: { p: [0, 0, 0.3 * on] },
        head: { r: [-6 * on, 0, 0] },
        ...face.pose(on > 0.5 ? 'shut' : 'open'),
        ...sk(-10 * on, 0, 0.1 * on),
        ...both('arm', { r: [0, -12 * on, 0] }),
        cape1: { r: [10 * on, 0, -8 * on] },
      };
    },
  },

  // fidget: she traces a star in the air with her right hand, then blinks up at it
  idle_trace: {
    seconds: 2.4,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.12, 1], [0.8, 1], [0.95, 0]]);
      const a = TAU * 2 * Math.min(1, Math.max(0, (u - 0.15) / 0.55));
      return {
        head: { r: [-10 * on, 0, -12 * on] },
        ...face.pose('open', blinks(u, [[0.82, 0.88]])),
        armR: { r: [-20 * on, 0, 40 * on] },
        foreR: { r: [10 * Math.sin(a) * on, 0, 18 * Math.cos(a) * on] },
        handR: { r: [0, 20 * on, 0] },
        armL: { r: [0, 4 * osc(u, 1), 0] },
        ...sk(2 * osc(u, 1)),
      };
    },
  },
};

const deny = ['armL', 'foreL', 'handL', 'armR', 'foreR', 'handR', 'cape1'].map((j) => [j, 'skirt'])
  .concat(['armL', 'foreL', 'handL', 'armR', 'foreR', 'handR'].map((j) => [j, 'cape1']));

export default rigDef({ joints, assign, extras: face.extras, clips, seams: { deny } });
