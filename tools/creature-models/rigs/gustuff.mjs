// Gustuff's rig: a cloud-wool lamb mid-gallop, a quilted cloud body, a big woolly head turned to the viewer with
// coiled ram horns, little feathered ear-wings and two feather fans folded along its back. The quadruped template has
// no wings: wingL / wingR (off the body) move through the `add` layers. Numbers are scad/gustuff.scad's.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, blob, ell, inFrame, limb, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { capD, isAny, subFrame, unrot } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const WINGS = [[0.80, 0.86, 0.98], [0.67, 0.73, 0.92], [0.51, 0.54, 0.80]];
const HOOVES = [[0.27, 0.19, 0.16], [0.36, 0.27, 0.23]];
const FACE = [0.92, 0.90, 0.99];
const DEG = Math.PI / 180;

// the head block: translate(HP) rotate([0, 0, HY])
const HP = [-1.2, -17, 22.7];
const hf = subFrame(HP, [0, 0, 15]);
const eyeL = { side: 'L', at: [4, -4.5, 2.1], size: 1.55, yaw: 25, frame: hf };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FACE });

// the body: the core (CF, CR) and its wool balls, placed as the scad's capPt() / midPt() do
const CF = [[0, -9, 16.3], [10.5, 10.5, 8.3]];
const CR = [[0, 11, 18], [10.5, 11, 9.6]];
const OUT = 3;
const capPt = (E, th, ph, r) => {
  const u = [Math.cos(ph * DEG) * Math.cos(th * DEG), Math.cos(ph * DEG) * Math.sin(th * DEG), Math.sin(ph * DEG)];
  const k = r - OUT;
  return [0, 1, 2].map((i) => E[0][i] + (E[1][i] - k) * u[i]);
};
const midPt = (y, a, r) => {
  const t = (y - CF[0][1]) / (CR[0][1] - CF[0][1]);
  const rx = 10.5 - (r - OUT);
  const rz = CF[1][2] + (CR[1][2] - CF[1][2]) * t - (r - OUT);
  const zc = CF[0][2] + (CR[0][2] - CF[0][2]) * t;
  return [rx * Math.sin(a * DEG), y, zc + rz * Math.cos(a * DEG)];
};
const MID = [[-6, 0, 5.2], [2, 0, 5.6], [9.5, 0, 5.4], [-3, 32, 5], [4.5, 30, 5.4], [11, 28, 5.2], [-6.5, 62, 5.2],
  [1, 60, 5], [7.5, 64, 5.4], [-3, 93, 5], [4, 95, 5.4], [10.5, 90, 5], [-6.5, 123, 4.8], [1, 125, 5.2], [8, 120, 5],
  [-2.5, 152, 4.6], [5.5, 150, 4.8]];
const CHEST = [[-90, 0, 5.4], [-90, -38, 4.8], [-58, 22, 5], [-58, -22, 5], [-35, 50, 4.8], [-90, 32, 5], [-118, -5, 5.2]];
const RUMP = [[90, 0, 5.4], [90, 36, 5.6], [90, -36, 4.8], [58, 22, 5.2], [58, -24, 5], [62, 58, 5.8], [90, 68, 4.6], [35, 45, 5.4]];
const BALLS = [
  ...MID.map(([y, a, r]) => [midPt(y, a, r), r]),
  ...CHEST.map(([th, ph, r]) => [capPt(CF, th, ph, r), r]),
  ...RUMP.map(([th, ph, r]) => [capPt(CR, th, ph, r), r]),
];
const ball = ([p, r]) => any(ell([r, r, r], p), ell([r, r, r], [-p[0], p[1], p[2]]));

// the legs [hip, fetlock] and their hooves (1.6 under the fetlock)
const LEGS = [
  ['legFL', [4.5, -10, 11], [4.5, -15.5, 2.4]],
  ['legFR', [-4.5, -11, 12], [-4.5, -23.5, 7.2]],
  ['legBL', [6, 17, 11], [6.5, 22, 2.4]],
  ['legBR', [-4.5, 11, 11], [-4.5, 13.2, 3.1]],
];
const legParts = LEGS.map(([n, a, b]) => [n, any(limb(a, b, 3.1, 2.25), ell([2.4, 2.6, 2], [b[0], b[1], b[2] - 1.4]))]);

// head primitives in the head frame (face blob, cheek, topknot and fringe puffs as balls)
const headTest = inFrame(hf, any(
  blob([[[7, 5.8, 6], [0, 0, 0.6]], [[4.6, 3, 3.3], [0, -3.7, -2]]]),
  ell([4, 4, 3.3], [5.9, -0.3, -2]), ell([4, 4, 3.3], [-5.9, -0.3, -2]),
  ell([5.6, 5.6, 4.2], [0, 0.5, 9.3]), ell([4.6, 4.6, 3.3], [4.4, 0.5, 6.5]), ell([4.6, 4.6, 3.3], [-4.4, 0.5, 6.5]),
  ell([4.2, 4.2, 3], [0, -3.4, 6.3]), ell([5.2, 5.2, 3.8], [0, 3.5, 5.5]),
  ell([4.5, 4.5, 4.5], [6.8, 2.5, 7.2]), ell([4.5, 4.5, 4.5], [-6.8, 2.5, 7.2]),
));
const parts = [
  ...legParts,
  ['body', any(blob([[CF[1], CF[0]], [CR[1], CR[0]]]), ...BALLS.map(ball))],
  ['head', headTest],
  ['tail1', ell([3.8, 3.8, 3], [0, 22, 21.5])],
];

// a feather (lib: from the origin along +X, width w): a capsule test in its own frame
const featherD = (q, len, w) => capD(q, [0, 0, 0], [len, 0, 0], w, w * 0.45);
// the ear-wing: translate([8, 4.5, 6]) rotate([0, 0, 20]) inside the head, feathers at 92 - 15k degrees up
const earD = (c) => {
  const h = hf.local(c);
  const q0 = unrot([0, 0, 20], [Math.abs(h[0]) - 8, h[1] - 4.5, h[2] - 6]);
  return Math.min(...[0, 1, 2, 3].map((k) => featherD(unrot([0, -(92 - k * 15), 0], q0), 12 - k * 1.2, 2.4)));
};
// the back wing: translate([8.5, -6, 25]) rotate([0, 0, 68]) rotate([30, 0, 0]), feathers at ANG degrees up
const ANG = [40, 30, 20, 10, 0];
const LEN = [13.5, 17, 19.5, 18.5, 15.5];
const wingD = (c) => {
  const q0 = unrot([30, 0, 0], unrot([0, 0, 68], [Math.abs(c[0]) - 8.5, c[1] + 6, c[2] - 25]));
  return Math.min(...ANG.map((a, i) => featherD(unrot([0, -a, 0], q0), LEN[i], 2.5)));
};

const earRoot = (s) => hf.world([8 * s, 4.5, 6]);
const joints = [
  { name: 'root', at: [0, 2, 0] },
  ...LEGS.map(([name, hip]) => ({ name, parent: 'root', at: hip })),
  { name: 'body', parent: 'root', at: [0, 1, 14] },
  { name: 'head', parent: 'body', at: [-1, -14.5, 18.5] },
  { name: 'earL', parent: 'head', at: earRoot(1) },
  { name: 'earR', parent: 'head', at: earRoot(-1) },
  { name: 'wingL', parent: 'body', at: [8.5, -6, 25] },
  { name: 'wingR', parent: 'body', at: [-8.5, -6, 25] },
  { name: 'tail1', parent: 'body', at: [0, 19.5, 20] },
  ...face.joints,
];

function assign(c, rgb) {
  if (isAny(rgb, WINGS, 0.02)) {
    const ear = earD(c) < wingD(c);
    if (ear) return hf.local(c)[0] >= 0 ? 'earL' : 'earR';
    return c[0] >= 0 ? 'wingL' : 'wingR';
  }
  if (isAny(rgb, HOOVES, 0.03)) return pick(c, legParts);
  return pick(c, parts);   // wool, legs, face, horns, eyes, nose and mouth
}

// the back wings: `up` spreads them outwards (ry), `beat` flaps them
const W = (up, beat = 0) => both('wing', { r: [0, -(up + beat), 0] });
const clips = quadrupedClips({
  face, tail: ['tail1'], hipH: 11, stride: 16,
  add: {
    idle: (t, u) => W(2 * osc(u, 2), 0),
    walk: (t, u) => W(6, 6 * osc(u, 2)),
    idle_sniff: (t, u) => W(2, 0),
    idle_shake: (t, u) => W(10, 14 * Math.sin(TAU * 8 * u) * win(u, 0.1, 0.9, 0.05)),
    windup: (t, u) => W(20 * Math.min(1, u / 0.8)),
    lunge: (t, u) => W(20 * K(u, [[0, 1], [0.4, 0.2], [1, 0]]), 16 * K(u, [[0.2, 0], [0.4, 1], [0.7, 0]])),
    hurt: (t, u) => W(24 * K(u, [[0, 0], [0.18, 1], [1, 0.3]])),
    faint: (t, u) => W(-10 * Math.min(1, u / 0.7)),
    celebrate: (t, u) => W(20, 22 * Math.sin(TAU * 4 * u)),
    enter: (t, u) => W(26 * win(u, 0.4, 0.9, 0.12)),
  },
});

// fidget: flutters the back wings and the ear-wings, lifting into a tiny floaty hop
clips.idle_flutter = {
  seconds: 1.8,
  pose: (t, u) => {
    const on = win(u, 0.1, 0.85, 0.08);
    const fl = Math.sin(TAU * 8 * u) * on;
    return merge({
      root: { p: [0, 0, 1.4 * Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.2) / 0.55))) * on] },
      body: { r: [-3 * on, 0, 0] },
      head: { r: [-6 * on, 0, 0] },
      earL: { r: [0, -12 * fl, 0] },
      earR: { r: [0, 12 * fl, 0] },
      ...face.pose(on > 0.4 ? 'happy' : 'open', blinks(u, [[0.9, 0.95]])),
    }, W(16 * on, 18 * fl));
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
