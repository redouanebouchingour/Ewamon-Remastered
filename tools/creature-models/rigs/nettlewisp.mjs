// Nettlewisp's rig: a leafy forest-spirit cat, a big cat head with antlers (the scad turns the head block 12 degrees
// towards the viewer and scales it 1.12), a body of leaves on short dark legs, two drooping leaf-sleeve vine arms
// (the near one hangs lower), a brown vine tail with a leafy tuft and loose leaves drifting round it (one joint that
// orbits). Numbers are scad/nettlewisp.scad's; its leaf generators are copied here so every leaf goes to its part.
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, bipedClips, blob, ell, inFrame, limb, pick } from './lib/biped.mjs';
import { blinks, eyeKit } from './lib/face.mjs';
import { capD, isAny, near, subFrame } from './lib/geo.mjs';

const D = Math.PI / 180;
const sin = (a) => Math.sin(a * D);
const cos = (a) => Math.cos(a * D);
const jit = (i) => sin(i * 137.508 + 11);
const add = (a, b) => a.map((v, i) => v + b[i]);
const lerp = (a, b, f) => a.map((v, i) => v + (b[i] - v) * f);

const ANTLER = [0.45, 0.38, 0.26];
const FACEPARTS = [[0.05, 0.13, 0.07], [0.24, 0.52, 0.3], [0.45, 0.78, 0.42], [0.1, 0.33, 0.16], [0.02, 0.3, 0.2], [1, 1, 1]];
const GLOW = [0.85, 1, 0.55];
const FACE = [0.82, 0.89, 0.63];

// lf(p, a, tilt, L, w): the scad's diamond leaf, hanging from p along dir, as a flat capsule test
const lf = (p, a, tilt, L, w) => {
  const d = [cos(a) * sin(tilt), sin(a) * sin(tilt), -cos(tilt)];
  const q = add(p, d.map((v) => v * L));
  return (c) => capD(c, p, q, Math.max(0.5, w / 2), Math.max(0.35, w / 4));
};

// ---- body
const BODY = [[[9.3, 8, 4.6], [0, -1, 9.6]], [[8.4, 7.3, 5], [0, -1, 14.2]]];
const bodyR = (z) => (z < 9.6 ? 9.3 * Math.sqrt(Math.max(0, 1 - ((z - 9.6) / 4.6) ** 2)) : z < 14.2 ? 9.3 - (0.9 * (z - 9.6)) / 4.6 : 8.4 * Math.sqrt(Math.max(0, 1 - ((z - 14.2) / 5) ** 2)));
const CLOVER = [5.4, -7.4, 14.6];
const RINGS = [[5.4, 26, 3.8, 20], [6.7, 30, 3.2, 26], [8, 34, 3, 30], [9.3, 36, 2.9, 32], [10.6, 36, 2.9, 34], [11.9, 35, 2.8, 34],
  [13.2, 34, 2.8, 32], [14.5, 32, 2.7, 32], [15.8, 30, 2.6, 30], [17.1, 26, 2.5, 30], [18.3, 20, 2.4, 30], [19.3, 12, 2.2, 30]];
const bodyLeaves = [];
RINGS.forEach(([z0, n, L, t], r) => {
  for (let k = 0; k < n; k++) {
    const i = r * 37 + k * 7;
    const a = (k * 360) / n + r * 9 + 5 * jit(i);
    const z = z0 + 0.45 * jit(i + 5);
    const rr = Math.max(bodyR(z), 2.5) * 0.98;
    const p = [rr * cos(a), -1 + rr * 0.85 * sin(a), z];
    if (Math.hypot(...p.map((v, j) => v - CLOVER[j])) > 2.4) bodyLeaves.push(lf(p, a, t + 12 * jit(i + 2), L + 0.5 * jit(i + 9), 1.9 + 0.4 * jit(i + 3)));
  }
});
for (let k = 0; k < 16; k++) {
  const a = (k * 360) / 16 + 8;
  if (sin(a) > -0.55) bodyLeaves.push(lf([8.2 * cos(a), -2.6 + 7.2 * sin(a), 19.6 + 0.5 * jit(k + 60)], a, 48 + 10 * jit(k + 61), 3.4, 2.4));
}
const bodyParts = any(blob(BODY), ...bodyLeaves, limb([-2.6, -9.6, 13.6], [-3.6, -9.2, 8.4], 0.35, 0.3), limb([0.6, -9.8, 12.4], [1.4, -9.5, 7.6], 0.35, 0.3),
  ell([1.5, 0.5, 2.3], [4.8, 6, 10.8]), ell([2, 1, 2], CLOVER), ell([2, 1.2, 2], [-3.6, 6.3, 15.4]));

// ---- legs (mirror pair)
const leg = (s) => any(limb([4.8 * s, 0, 7], [7.1 * s, 0.8, 2.2], 2.7, 2.3), ell([2.6, 3.4, 1.4], [7.2 * s, 0.2, 1.4]),
  lf([6.4 * s, -2.8, 1.5], s > 0 ? -110 : -70, 80, 1.8, 1.2), lf([8 * s, -2.6, 1.5], s > 0 ? -70 : -110, 80, 1.8, 1.2), lf([9.4 * s, 0, 1.7], s > 0 ? -20 : -160, 70, 1.7, 1.1));

// ---- arms: the near one (+X) hangs low, the far one reaches out higher
const ARML = [[7.6, -1.6, 15.8], [12, -2.4, 12.8], [16, -2.4, 9.6], [19, -2, 6.8]];
const ARMR = [[-7.6, -1.6, 15.8], [-12, -2.4, 14], [-15.8, -2.4, 12], [-18.6, -2, 10]];
const ARMRAD = [1.5, 1.15, 0.9, 0.65];
const STRL = [[[12.2, -2.4, 12.4], [12.8, -3, 9.4], [12.6, -3, 6.4]], [[16, -2.4, 9.2], [16.8, -2.6, 6.2], [16.6, -2.4, 3]],
  [[18.8, -2, 6.6], [19.6, -1.8, 3.8], [19.2, -1.8, 1.4]]];
const STRR = [[[-12.2, -2.4, 13.6], [-12.8, -3, 11.2], [-12.6, -3, 9]], [[-15.8, -2.4, 11.6], [-16.6, -2.6, 9.2], [-16.4, -2.4, 6.8]],
  [[-18.4, -2, 9.8], [-19.2, -1.8, 7.6], [-18.8, -1.8, 5.4]]];
// one test per arm joint: segment k of the vine with its leaves; the strands on the elbow (0) and the hand (1, 2)
function armParts(A, ST, S) {
  const sg = Math.sign(A[0][0]);
  const seg = [[], [], []];
  for (let k = 0; k < 3; k++) seg[k].push(limb(A[k], A[k + 1], ARMRAD[k] + 0.2, ARMRAD[k + 1] + 0.2));
  for (let j = 0; j < 12; j++) for (let q = 0; q < 3; q++) {
    const u = (j + 0.5) / 12;
    const s = Math.min(2, Math.floor(u * 3));
    const f = u * 3 - s;
    const p = lerp(A[s], A[s + 1], f);
    const rad = ARMRAD[s] + (ARMRAD[s + 1] - ARMRAD[s]) * f;
    const i = j * 3 + q + (sg > 0 ? 0 : 50);
    const off = q === 0 ? [0, -rad * 0.8, 0] : q === 1 ? [0, rad * 0.8, 0] : [0, 0, rad * 0.8];
    const az = q === 0 ? -90 : q === 1 ? 90 : 90 - 90 * sg + 40 * jit(i);
    seg[s].push(lf(add(p, off), az, (q === 2 ? 40 : 22) + 12 * jit(i + 7), 3 + 0.5 * jit(i + 3), 2 + 0.3 * jit(i + 1)));
  }
  ST.forEach((st, k) => {
    const t = any(limb(st[0], st[1], 0.42, 0.34), limb(st[1], st[2], 0.34, 0.27), lf(add(st[2], [0, 0, 0.3]), k === 0 ? -90 : 90 - 90 * sg, 10 + 4 * k, 2.4, 1.6));
    seg[k === 0 ? 1 : 2].push(t);
  });
  seg[2].push(lf(add(A[3], [0, 0, 0.4]), 90 - 90 * sg, 25, 3, 2));
  return [[`arm${S}`, any(...seg[0])], [`fore${S}`, any(...seg[1])], [`hand${S}`, any(...seg[2])]];
}

// ---- tail: four links, the tuft on the last
const TAIL = [[3, 6, 9], [8, 9, 9.4], [12.6, 10, 11.4], [15.2, 9, 13.8], [16.2, 8, 16.6]];
const TAILR = [1, 0.9, 0.8, 0.7, 0.6];
const tail = ['tail1', 'tail2', 'tail3', 'tail4'];
const TUFT = TAIL[4];
const tuftLeaves = [ell([2.2, 1.8, 3.6], add(TUFT, [0, 0, 3])), lf(add(TUFT, [0, 0, 6.4]), 0, 176, 2.6, 2.2), lf(add(TUFT, [0.4, -0.6, 5.8]), -60, 160, 2.6, 2)];
for (let k = 0; k < 24; k++) {
  const a = ((k * 360) / 24) * 5;
  const h = (k % 4) / 3;
  tuftLeaves.push(lf(add(TUFT, [2 * cos(a) * (1 - 0.3 * h), 1.6 * sin(a) * (1 - 0.3 * h), 0.8 + 4.6 * h]), a, 128 - 40 * h + 12 * jit(k), 4 - 0.6 * h, 2.4));
}
const tailParts = [
  ['tail1', limb(TAIL[0], TAIL[1], TAILR[0], TAILR[1])],
  ['tail2', any(limb(TAIL[1], TAIL[2], TAILR[1], TAILR[2]), lf([9.6, 9.6, 10.3], 0, 40, 2, 1))],
  ['tail3', any(limb(TAIL[2], TAIL[3], TAILR[2], TAILR[3]), lf([13.8, 9.6, 12.6], 90, 40, 2, 1))],
  ['tail4', any(limb(TAIL[3], TAIL[4], TAILR[3], TAILR[4]), ...tuftLeaves)],
];

// ---- head: translate(HC) rotate([0, 0, 12]) scale(1.12) { … }
const HC = [0, -6, 23.75];
const H = subFrame(HC, [0, 0, 12], 1.12);
const HEAD = [7.7, 6.4, 5.9];
const headLeaves = [];
for (let r = 0; r < 4; r++) for (let k = 0; k < 16; k++) {
  const el = [-30, 0, 28, 52][r];
  const a = (k * 360) / 16 + r * 11;
  const i = r * 19 + k * 5;
  if (!(sin(a) < -0.45 && el < 40)) headLeaves.push(lf([HEAD[0] * cos(el) * cos(a), HEAD[1] * cos(el) * sin(a), HEAD[2] * sin(el) + 0.9], a, 26 + 10 * jit(i), 2.8 + 0.4 * jit(i + 1), 2 + 0.3 * jit(i + 2)));
}
for (let k = 0; k < 14; k++) {
  const a = -40 + k * 20;
  const z = -1.2 + 2.4 * jit(k + 30);
  headLeaves.push(lf([7.2 * cos(a), 6 * sin(a), z + 1.6], a, 45 + 20 * jit(k + 31), 3.4, 2.4));
}
for (let k = 0; k < 6; k++) {
  const a = -150 + k * 36;
  headLeaves.push(lf([4.2 * cos(a), 3 * sin(a) + 0.6, 4.6], a, 128 + 14 * jit(k + 20), 2.6 + 0.8 * (k % 2), 2));
}
for (let k = 0; k < 4; k++) { const x = -3 + k * 2; headLeaves.push(lf([x, -5.75 + 0.2 * Math.abs(x), 3.7 - 0.06 * x * x], -90 + x * 6, 8, 2, 1.4)); }
for (const s of [1, -1]) {
  headLeaves.push(lf([5.6 * s, -3.9, -2], s > 0 ? -20 : -160, 70, 2.6, 1.2), lf([4.8 * s, -4.6, -3.6], s > 0 ? -40 : -140, 60, 2.2, 1.1));
}
const headParts = inFrame(H, any(ell(HEAD), ell([2.3, 1.4, 1.5], [0, -5.3, -2.9]), ...headLeaves));
const ear = (s) => inFrame(H, any(limb([5.4 * s, -0.6, 2.8], [7.5 * s, -0.9, 7.4], 2.2, 0.35), limb([5.5 * s, -2.05, 3.3], [7.25 * s, -1.5, 6.8], 1.4, 0.25)));

// ---- loose leaves drifting round it (the scad's S(): sheet point -> scad point)
const S = (sx, sz, y = 0) => { const x = (sx + 1.8 - 0.5 * y) / 0.866; const d = -0.5 * x + 0.866 * y; return [x, y, sz - 2.42 - 0.17 * d]; };
const DRIFT = [S(-15.6, 31.4, 0), S(5.4, 39.2, 2), S(11.8, 25.8, 0), S(-13.4, 36.6, 2), S(17.6, 10.6, 0), S(-15.4, 4.2, -2)];

// ---- eyes: each a scaled block, translate(p) scale([1.25, 1, 0.8]) eye([0, 0, 0], 1.6, yaw = ±18) inside the head
const EYES = [1.25, 1, 0.8];
const eyeFrame = (x) => subFrame(H.world([x, -5.35, -0.6]), [0, 0, 12], EYES.map((v) => v * 1.12));
const face = eyeKit({
  eyes: [
    { side: 'L', at: [0, 0, 0], size: 1.6, yaw: 18, flat: 0.42, frame: eyeFrame(3.3) },
    { side: 'R', at: [0, 0, 0], size: 1.6, yaw: -18, flat: 0.42, frame: eyeFrame(-3.3) },
  ],
  skin: FACE,
  // the eye frame's scale is not uniform: shape the lid to the almond (its x is sized by the frame's x scale)
  lid: [1.14, 1 / 1.25, (1.2 * 0.8) / 1.25],
});

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [4.8, 0, 7] },
  { name: 'legR', parent: 'root', at: [-4.8, 0, 7] },
  { name: 'body', parent: 'root', at: [0, -1, 6] },
  { name: 'head', parent: 'body', at: [0, -4.5, 18.5] },
  { name: 'earL', parent: 'head', at: H.world([5.4, -0.6, 2.8]) },
  { name: 'earR', parent: 'head', at: H.world([-5.4, -0.6, 2.8]) },
  { name: 'armL', parent: 'body', at: ARML[0] },
  { name: 'foreL', parent: 'armL', at: ARML[1] },
  { name: 'handL', parent: 'foreL', at: ARML[2] },
  { name: 'armR', parent: 'body', at: ARMR[0] },
  { name: 'foreR', parent: 'armR', at: ARMR[1] },
  { name: 'handR', parent: 'foreR', at: ARMR[2] },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i] })),
  { name: 'drift', parent: 'root', at: [0, 0, 20] },
  ...face.joints,
];

const parts = [
  ['body', bodyParts],
  ['legL', leg(1)], ['legR', leg(-1)],
  ...armParts(ARML, STRL, 'L'), ...armParts(ARMR, STRR, 'R'),
  ...tailParts,
  ['head', headParts],
  ['earL', ear(1)], ['earR', ear(-1)],
  ['drift', any(...DRIFT.map((p) => ell([1.2, 1.2, 1.6], p)))],
];

function assign(c, rgb) {
  if (near(rgb, ANTLER)) return 'head';                    // the antlers
  if (isAny(rgb, FACEPARTS)) return 'head';                // eyes, nose, mouth
  if (near(rgb, GLOW)) return c[2] > 21 ? 'head' : 'body'; // the clovers
  return pick(c, parts);
}

const orbit = (u, turns = 1) => ({ drift: { r: [0, 0, 360 * turns * u], p: [0, 0, 1.2 * osc(u, 2 * Math.max(1, Math.round(Math.abs(turns))))] } });

const base = bipedClips({
  face, tail, hipH: 7, stride: 22, armSwing: 14, hopScale: 1, hopH: 3,
  // a vine whip: the right arm flings forward and down
  punch: { arm: [-80, 0, 10], fore: [-30, 0, 0] },
  add: {
    idle: (t, u) => merge(orbit(u), both('fore', { r: [3 * osc(u, 2), 0, 0] }), both('hand', { r: [5 * osc(u, 2, 0.2), 0, 0] })),
    walk: (t, u) => orbit(u, 0),
    idle_look: (t, u) => orbit(u, 0),
    celebrate: (t, u) => orbit(u, 1),
    enter: (t, u) => ({ drift: { s: 0.2 + 0.8 * Math.min(1, u / 0.7) } }),
    faint: (t, u) => ({ drift: { p: [0, 0, -12 * Math.min(1, u / 0.9)], r: [0, 0, 40 * u] } }),
  },
});

const clips = {
  ...base,

  // fidget: a cat's twitch: one ear flicks, then the other, the tail tuft flicks and it gives a little double hop
  idle_twitch: {
    seconds: 2.2,
    pose: (t, u) => {
      const fl = (u0) => Math.sin(TAU * 3 * Math.min(1, Math.max(0, (u - u0) / 0.15))) * win(u, u0, u0 + 0.15, 0.02);
      const hop = Math.max(0, Math.sin(TAU * 2 * Math.min(1, Math.max(0, (u - 0.55) / 0.35))));
      return merge({
        root: { p: [0, 0, 1.6 * hop] },
        head: { r: [0, 8 * fl(0.1), 0] },
        earL: { r: [-16 * fl(0.1), 10 * fl(0.1), 0] },
        earR: { r: [-16 * fl(0.28), -10 * fl(0.28), 0] },
        ...face.pose(hop > 0.3 ? 'happy' : 'open', blinks(u, [[0.42, 0.48]])),
        tail3: { r: [0, 0, 18 * fl(0.38)] }, tail4: { r: [10 * fl(0.38), 0, 24 * fl(0.38)] },
        ...both('arm', { r: [0, -10 * hop, 0] }),
      }, orbit(u));
    },
  },

  // fidget: it reaches up and bats at a drifting leaf with a vine arm, missing
  idle_bat: {
    seconds: 2.4,
    pose: (t, u) => {
      const reach = K(u, [[0, 0], [0.2, 1], [0.32, 0.6], [0.44, 1], [0.56, 0.6], [0.72, 0]]);
      return merge({
        body: { r: [-4 * reach, 0, -5 * reach] },
        head: { r: [-14 * reach, 0, -10 * reach] },
        ...face.pose('open', blinks(u, [[0.8, 0.85]])),
        armL: { r: [-40 * reach, -60 * reach, 0] }, foreL: { r: [-20 * reach, 0, 0] }, handL: { r: [-20 * reach * osc(u, 4), 0, 0] },
      }, orbit(u));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
