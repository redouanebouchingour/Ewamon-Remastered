// Vysion's rig: a hovering android, its thighs merging into a curling wisp tail, a big golden cape in two drapes off
// the shoulders (capeL / capeR, layered on the floater clips), the chest gem as the pulsing core and its narrow
// almond eyes on their own joint with eyeKit lids. Numbers are scad/vysion.scad's.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, blob, ell, fromSheet, limb, pick } from './lib/biped.mjs';
import { eyeKit } from './lib/face.mjs';
import { floaterClips } from './lib/floater.mjs';
import { capD, chainHit, fold, isAny, near, side } from './lib/geo.mjs';

const RED = [0.63, 0.2, 0.27];
const GOLD = [[0.95, 0.78, 0.26], [0.8, 0.6, 0.18]];
const GLOWY = [[1, 0.9, 0.42], [0.98, 0.9, 0.47]];   // the gems and the sparks
const EYES = [[0.99, 0.95, 0.61], [1, 0.98, 0.85]];
const INK = [0.22, 0.09, 0.06];
const CLAW = [0.59, 0.71, 0.55];

const OX = 2.3;
const S = (sx, z, y = 0) => fromSheet(sx + OX, z, y);
const TAIL = [S(-2.2, 9.6, -0.8), S(0, 8, -0.8), S(2.5, 7.4, -0.8), S(4.4, 6.3, -0.6), S(4.2, 4.3, -0.4), S(3, 2.6, -0.2), S(2.9, 0.4, 0)];
const TAIL_R = [1.75, 1.45, 1.3, 1.15, 0.8, 0.5, 0.14];
const tail = ['tail1', 'tail2', 'tail3', 'tail4'];
const segJoint = (i) => (i < 2 ? 'tail2' : i < 4 ? 'tail3' : 'tail4');

const EYE = [1.05, -4.78, 33.95];
const SH = [6.6, 0.4, 28.6]; const EL = [9.6, 1.6, 22.2]; const WR = [12.6, 0.2, 16.2]; const HA = [13.4, -1.2, 14.3];

const face = eyeKit({ eyes: [{ side: 'L', at: EYE, size: 0.72, yaw: 18, squash: 0.45 }, { side: 'R', at: [-EYE[0], EYE[1], EYE[2]], size: 0.72, yaw: -18, squash: 0.45 }], skin: RED, lid: [1.1, 1, 0.62] });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 21] },
  { name: 'core', parent: 'body', at: [0, -2.9, 27.1] },
  { name: 'head', parent: 'body', at: [0, -1, 31.4] },
  { name: 'eyes', parent: 'head', at: [0, EYE[1], EYE[2]] },
  { name: 'armL', parent: 'body', at: [6.4, 0.4, 28.8] },
  { name: 'handL', parent: 'armL', at: EL },
  { name: 'armR', parent: 'body', at: [-6.4, 0.4, 28.8] },
  { name: 'handR', parent: 'armR', at: [-EL[0], EL[1], EL[2]] },
  { name: 'capeL', parent: 'body', at: [4.6, 3.4, 31] },
  { name: 'capeR', parent: 'body', at: [-4.6, 3.4, 31] },
  { name: 'tail1', parent: 'body', at: [0, -0.2, 17.4] },
  { name: 'tail2', parent: 'tail1', at: TAIL[0] },
  { name: 'tail3', parent: 'tail2', at: TAIL[2] },
  { name: 'tail4', parent: 'tail3', at: TAIL[4] },
  ...face.joints,
];

const skull = blob([[[2.25, 2.6, 2.5], [0, -2.6, 36]], [[1.55, 1.9, 1.9], [0, -3.5, 33.2]]]);
const parts = [
  ['head', any(skull, limb([0, -0.3, 30], [0, -2, 33], 1.25, 1.15), ell([0.7, 0.42, 0.42], [0, -4.4, 31.6]),
    (c) => ell([0.45, 1.25, 1.5], [2.05, -2.2, 35.3])(fold(c)),
    (c) => Math.min(capD(fold(c), [2.15, -1.6, 35.4], [2.7, 1.4, 37.6], 1.0, 0.5), capD(fold(c), [2.7, 1.4, 37.6], [2.95, 4.3, 39.9], 0.5, 0.15)))],
  ['body', any(blob([[[3.4, 2.4, 2.6], [0, 0.1, 27.4]], [[2.5, 2.0, 2.4], [0, 0.2, 22.6]]]), blob([[[3.9, 2.6, 2.3], [0, -0.1, 28.8]], [[2.6, 2.2, 1.4], [0, 0, 26.9]]]),
    blob([[[2.9, 2.2, 1.6], [0, 0.2, 19.2]], [[1, 0.9, 1.4], [0, -0.9, 17.4]]]),
    (c) => Math.min(ell([1.9, 1.3, 1.6], [1.85, -1.55, 27.2])(fold(c)), ell([1.15, 1.7, 2.8], [2.75, 0.1, 24.2])(fold(c)),
      ...[24.4, 22.85, 21.3].map((z) => ell([0.92, 0.26, 0.78], [0.94, -1.92, z])(fold(c)))))],
  ['arm*', any(ell([2.0, 2.1, 1.9], [6.4, 0.4, 28.8]), limb(SH, EL, 1.45, 1.2))],
  ['hand*', any(ell([1.25, 1.25, 1.25], EL), limb(EL, WR, 1.35, 1.05), ell([0.95, 0.95, 0.95], WR), ell([0.95, 1.05, 1.1], HA))],
  ['tail1', any((c) => limb([2.3, 0.2, 17.6], [1.1, -0.8, 11.2], 1.9, 1.4)(fold(c)), (c) => ell([0.95, 0.75, 2.5], [1.9, -1, 14.8])(fold(c)),
    (c) => ell([1.05, 0.85, 0.95], [1.15, -1.8, 10.9])(fold(c)), ell([1.9, 1.7, 1.6], [0, -0.7, 10.3]))],
  ...TAIL.slice(0, -1).map((p, i) => [segJoint(i), limb(p, TAIL[i + 1], TAIL_R[i], TAIL_R[i + 1])]),
];

// the tail's gold wisps and the sparks follow the nearest tail link
const tailJoint = (c) => {
  if (c[2] > 9.5 && c[0] < 2) return 'tail2';
  const h = chainHit(c, TAIL, TAIL_R.map((r) => r + 1.5));
  return segJoint(h.i);
};

function assign(c, rgb) {
  const S = side(c);
  if (isAny(rgb, EYES, 0.03)) return 'eyes';
  if (near(rgb, INK, 0.03)) return c[2] > 33 ? 'eyes' : 'head';
  if (near(rgb, CLAW, 0.03)) return `hand${S}`;
  if (isAny(rgb, GLOWY, 0.03)) {
    if (c[2] > 33) return 'head';
    if (c[2] > 24) return 'core';
    return tailJoint(c);
  }
  if (isAny(rgb, GOLD, 0.04)) {
    if (c[2] > 34) return 'head';                                               // the forehead gem's setting
    if (c[2] > 24 && c[1] < -2) return 'core';                                  // the chest gem's setting
    if (c[2] < 11.5 && c[1] < 0.5) return tailJoint(c);                         // the wisps along the tail
    if (capD(fold(c), [9.6, 1.6, 22.2], [12.6, 0.2, 16.2], 1.6, 1.6) < 1) return `hand${S}`;   // the cuffs
    if (c[2] > 30.2 && Math.abs(c[0]) < 6.4 && c[1] < 4.8) return 'body';      // the straps and the mantle behind the neck
    return c[0] > -1.5 ? 'capeL' : 'capeR';
  }
  if (c[2] > 34.2 || (c[1] < -3.2 && c[2] > 30.5)) return 'head';
  return pick(c, parts);
}

// the cape: rx streams a drape back (it hangs from the shoulders), ry flares it out
const cape = (back, flare = 0, sway = 0) => both('cape', { r: [back, -flare, sway] });
const add = {
  idle: (t, u) => cape(2 + 2 * osc(u, 2, 0.3), 2 * osc(u, 2, 0.6), 2 * osc(u, 1, 0.2)),
  walk: (t, u) => cape(14 + 3 * osc(u, 2, 0.2), 6, 3 * osc(u, 1)),
  windup: (t, u) => cape(-4 * smooth(u / 0.8), 14 * smooth(u / 0.8)),
  lunge: (t, u) => { const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]); return cape(18 * hit, 10 - 8 * hit); },
  hurt: (t, u) => { const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.45]]); return cape(-8 * k, 16 * k, 6 * Math.sin(TAU * 5 * u) * (1 - u)); },
  recoil: (t, u) => cape(-5 * K(u, [[0, 0], [0.4, 1], [1, 0]])),
  faint: (t, u) => { const d = smooth((u - 0.15) / 0.6); return cape(-10 * d, -6 * d); },
  celebrate: (t, u) => cape(8, 20 + 10 * Math.sin(TAU * 3 * u), 0),
  enter: (t, u) => cape(0, 24 * win(u, 0.4, 0.95, 0.12)),
  exit: (t, u) => cape(6, 10),
};

const clips = floaterClips({ face, tail, bob: 1, add });
delete clips.idle_spin;
delete clips.idle_cackle;

// fidget: scans the field like a machine, the head ticking round in steps, the eyes narrowing, the core flaring
clips.idle_scan = {
  seconds: 2.4,
  pose: (t, u) => {
    const step = (x) => Math.floor(x * 4) / 4 + smooth((x * 4 % 1) * 3) / 4;
    const turn = u < 0.45 ? -30 + 60 * step(u / 0.45) : 30 * K(u, [[0.45, 1], [0.6, -1], [0.75, -1], [0.9, 0]]);
    const on = win(u, 0.05, 0.9, 0.08);
    return merge({
      body: { p: [0, 0, 0.5 + 0.5 * osc(u, 1)] },
      head: { r: [0, 0, turn * on] },
      eyes: { s: [1, 1, 1 - 0.3 * on] },
      core: { s: 1 + 0.25 * on * (osc(u, 6) * 0.5 + 0.5) },
      ...face.pose('open'),
    }, cape(2, 2 * osc(u, 2)));
  },
};

// fidget: spreads its arms and lets the cape billow out like wings, rising, then settles
clips.idle_billow = {
  seconds: 2.6,
  pose: (t, u) => {
    const up = K(u, [[0, 0], [0.3, 1], [0.7, 1], [0.92, 0]]);
    return merge({
      body: { p: [0, 0, 0.5 + 1.6 * up], r: [-6 * up, 0, 0] },
      head: { r: [-10 * up, 0, 0] },
      core: { s: 1 + 0.2 * up },
      ...both('arm', { r: [0, -40 * up, 10 * up] }),
      ...both('hand', { r: [0, -20 * up, 0] }),
      ...face.pose('open'),
    }, cape(6 * up + 3 * osc(u, 3) * up, 30 * up + 6 * osc(u, 3) * up));
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
