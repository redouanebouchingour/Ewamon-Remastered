// Snowlet's rig: a round puff of snow-owl fluff (the ball is head and body in one, no legs), two huge golden eyes on
// a face turned FACE degrees towards +X, a smooth body with a ragged rim, a crown of five soft flame tufts on top and
// two small feathered fans out at the sides. It
// hops instead of walking. Numbers are scad/snowlet.scad's (the 2026-11-03 sprite-match model, second pass).
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { any, ell, limb, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near, subFrame } from './lib/geo.mjs';

const DEG = Math.PI / 180;
const WHITE = [0.97, 0.99, 0.99];
const NAVY = [0.10, 0.16, 0.29];
const GOLD = [0.93, 0.70, 0.16];
const AMBER = [0.70, 0.42, 0.05];

// the face block: rotate([0, 0, FACE]) { owlEye(EYE, ES, EYAW, …); owlEye(mirrored …); beak }
const FACE = 15;
const faceFrame = subFrame([0, 0, 0], [0, 0, FACE]);
const EYE = [7.3, -13.6, 21.5];
const ES = 5.3;
const EYAW = 22;
const eyeL = { side: 'L', at: EYE, size: ES, yaw: EYAW, frame: faceFrame };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], parent: 'body', skin: WHITE, lid: [1.08, 0.75, 1.06] });

// the ball, its rim lobes and the crown (the scad's RIM, LOBE and CROWN, same numbers)
const BC = [0, 0, 19];
const BR = [16, 15.5, 15.5];
const tuftN = (e, az) => [Math.cos(e * DEG) * Math.sin(az * DEG), -Math.cos(e * DEG) * Math.cos(az * DEG), Math.sin(e * DEG)];
const downAt = (e, az) => [-Math.sin(e * DEG) * Math.sin(az * DEG), Math.sin(e * DEG) * Math.cos(az * DEG), -Math.cos(e * DEG)];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a, b, k = 1) => a.map((v, i) => v + b[i] * k);
const faceOff = (e, az) => Math.acos(Math.max(-1, Math.min(1, dot(tuftN(e, az), tuftN(4, FACE))))) / DEG;
const onBall = (n, k) => [0, 1, 2].map((i) => BC[i] + n[i] * BR[i] * k);

const RIM = [[2, 24, 0], [-36, 18, 10], [-62, 10, 5]];
const LOBE = [3.8, 3.0, 1.3];
const stag = (i) => [0, 5, -3, 3, -5, 1][i % 6];
// a lobe: an ellipsoid in the (west, down, normal) frame at the surface (the droop tilt ignored: it only decides
// which part a triangle is nearest, and every lobe is body)
const lobe = (e, az) => {
  const n = tuftN(e, az);
  const d = downAt(e, az);
  const w = [-Math.cos(az * DEG), -Math.sin(az * DEG), 0];
  const p = onBall(n, 0.985);
  return (c) => { const v = add(c, p, -1); return Math.hypot(dot(v, w) / LOBE[0], dot(v, d) / LOBE[1], dot(v, n) / LOBE[2]); };
};
const rim = [];
for (const [e0, count, off] of RIM) {
  for (let i = 0; i < count; i++) {
    const az = (i * 360) / count + off;
    const e = e0 + stag(i);
    if (faceOff(e, az) > 52) rim.push(lobe(e, az));
  }
}
const CROWN = [[90, 0, 5.0], [70, -30, 4.4], [70, 60, 4.0], [70, 150, 4.2], [70, 240, 4.0]];
const crown = CROWN.map(([e, az, L]) => {
  const n = tuftN(e, az);
  const h = Math.hypot(n[0], n[1]);
  const o = e > 85 ? [0, 0.4, 0] : [n[0] / h, n[1] / h, 0];
  const p0 = onBall(n, 0.92);
  const p1 = add(add(p0, n, 0.5 * L + 1.4), o, 0.6);
  const p2 = add(add(p1, [0, 0, 0.4 * L]), o, 0.6 * L);
  return any(limb(p0, p1, 3.0, 1.9), limb(p1, p2, 1.9, 1.0));
});

// the wings: the FEATHERS fan at depth WY (sheet x -> scad x by wsx), the near (+X) one
const WY = 2;
const wsx = (sx) => (sx + 1.7 - 0.5 * WY) / 0.866;
const FEATHERS = [[[12, 19.5], [21.2, 23.0], 2.9, 2.1], [[12, 18.5], [22.4, 20.0], 2.9, 2.1],
  [[12, 17.5], [21.8, 16.8], 2.7, 1.9], [[12, 16.5], [19.8, 14.3], 2.5, 1.7]];
const WROOT = [12, 18];
const wing = any(
  ell([3.2, 2.0, 3.8], [wsx(WROOT[0]), WY, WROOT[1]]),
  ...FEATHERS.map(([a, b, r1, r2], k) => limb([wsx(a[0]), WY + 0.15 * k, a[1]], [wsx(b[0]), WY + 0.15 * k, b[1]], r1, r2)),
);

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 1] },
  { name: 'crest1', parent: 'body', at: [0, 0, 33] },
  ...pair('wing*', 'body', [wsx(WROOT[0]), WY, WROOT[1]]),
  { name: 'eyeL', parent: 'body', at: faceFrame.world(EYE) },
  { name: 'eyeR', parent: 'body', at: faceFrame.world([-EYE[0], EYE[1], EYE[2]]) },
  ...face.joints,
];

const parts = [
  ['body', any(ell(BR, BC), ...rim)],
  ['crest1', any(...crown)],
  ['wing*', wing],
];
const assign = (c, rgb) => {
  const f = faceFrame.local(c);
  const nearEye = Math.hypot(Math.abs(f[0]) - EYE[0], f[1] - EYE[1], f[2] - EYE[2]) < ES * 1.3;
  if (nearEye && (isAny(rgb, [NAVY, GOLD, AMBER]) || near(rgb, [1, 1, 1], 0.015))) return f[0] >= 0 ? 'eyeL' : 'eyeR';
  return pick(c, parts);
};

const clips = birdClips({ face, crest: ['crest1'], flapUp: 40 });
// no legs: the walk is a run of little hops, squashing on each landing
const walk = clips.walk.pose;
clips.walk.pose = (t, u) => {
  const h = Math.abs(Math.sin(TAU * u));
  return merge(walk(t, u), { root: { p: [0, 0, 1.6 * h] }, body: { s: [1 + 0.05 * (1 - h), 1 + 0.05 * (1 - h), 1 - 0.08 * (1 - h)] } });
};

// fidget: rolls side to side like a snowball, eyes squeezed happy
clips.idle_roll = {
  seconds: 2,
  pose: (t, u) => {
    const on = win(u, 0.08, 0.88, 0.1);
    return merge({
      body: { r: [0, 14 * osc(u, 2) * on, 0] },
      ...face.pose(on > 0.4 ? 'happy' : 'open'),
      wingL: { r: [0, -16 * Math.max(0, osc(u, 2)) * on, 0] },
      wingR: { r: [0, 16 * Math.max(0, -osc(u, 2)) * on, 0] },
      crest1: { r: [0, -8 * osc(u, 2, 0.1) * on, 0] },
    });
  },
};

// fidget: a sleepy owl blink, eyes closing slowly, a nod, snapping awake with a fluff
clips.idle_doze = {
  seconds: 2.8,
  pose: (t, u) => {
    const sleep = K(u, [[0, 0], [0.3, 1], [0.7, 1], [0.76, 0]]);
    const fluff = Math.sin(TAU * 10 * u) * win(u, 0.76, 0.95, 0.03);
    return merge({
      body: { r: [6 * sleep, 3 * fluff, 0], s: [1 + 0.04 * Math.abs(fluff), 1 + 0.04 * Math.abs(fluff), 1 - 0.03 * sleep] },
      ...face.pose('open', sleep + blinks(u, [[0.88, 0.92]])),
      crest1: { r: [10 * sleep + 6 * fluff, 0, 0] },
      wingL: { r: [0, 6 * sleep - 10 * Math.abs(fluff), 0] },
      wingR: { r: [0, -6 * sleep + 10 * Math.abs(fluff), 0] },
    });
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
