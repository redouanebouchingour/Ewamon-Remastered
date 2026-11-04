// Caldermole's rig: an upright magma kaiju (sprite-match model, 2026-11-03). The head is built in the scad facing -Y
// and turned 35° to its right (HEAD_AT, HEAD_YAW); its numbers are tested in that frame. Flames are plates: the crest
// and the tail's flame are traced outlines in the picture plane, the dorsal mane is a row of three-lick flames.
// A long plated tail runs back along the ground and rises into the tip flame. Numbers are scad/caldermole.scad's.
import { K, TAU, both, hash, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, bipedClips, blob, chain, ell, inFrame, limb, mx, pair, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye, blinks } from './lib/face.mjs';
import { isAny, near, plateD, rot, subFrame } from './lib/geo.mjs';

const COAL = [0.30, 0.22, 0.26];
const COAL_HI = [0.36, 0.26, 0.33];
const FLAME = [[0.84, 0.21, 0.02], [0.96, 0.53, 0.04], [0.98, 0.79, 0.20]];

const HF = subFrame([-2.7, -6, 28.3], [0, 0, -35], 1);
const Hw = HF.world;

const TAIL = [[0, 5, 10.5], [4.2, 8.5, 9.2], [8.7, 10.5, 8.6], [12.1, 12.5, 9], [13.9, 14, 11.6], [13.9, 14, 15.6],
  [12.9, 13, 19.7], [11.7, 12, 23.4], [11.1, 11, 26.8]];
const TAIL_R = [6.4, 5.5, 4.8, 4.2, 3.7, 3.2, 2.7, 2.0, 1.2];
const tails = ['tail1', 'tail2', 'tail3', 'tail4'];

const eyeL = { side: 'L', at: [2.95, -3.1, 1.1], size: 1.0, yaw: 50, flat: 0.5, frame: HF };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: COAL });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [7.5, 2, 10]),
  { name: 'body', parent: 'root', at: [0, 2, 10] },
  { name: 'head', parent: 'body', at: [-1, -3.5, 27.8] },
  { name: 'jaw', parent: 'head', at: Hw([0, 1, -1.6]) },
  { name: 'crest', parent: 'head', at: [-2, -5.6, 31.5] },
  { name: 'mane', parent: 'body', at: [0, 9, 22] },
  ...pair('arm*', 'body', [7, -3, 23]),
  ...pair('fore*', 'arm*', [10.3, -2.5, 17.5]),
  ...pair('hand*', 'fore*', [9.5, -7, 13.8]),
  { name: 'tail1', parent: 'body', at: TAIL[0] },
  { name: 'tail2', parent: 'tail1', at: TAIL[2] },
  { name: 'tail3', parent: 'tail2', at: TAIL[4] },
  { name: 'tail4', parent: 'tail3', at: TAIL[6] },
  { name: 'flame', parent: 'tail4', at: TAIL[8] },
  ...face.joints,
];

const TORSO = [
  [[0, 3, 10.5], [8.8, 8.5, 6]], [[0, 1.5, 15], [9, 9, 7]], [[0, 0, 21], [8.3, 8, 6.5]], [[0, 4.5, 20], [7, 8, 8.5]],
  [[0, 3, 26.5], [6.5, 7, 5]],
];
const parts = [
  ['body', any(...TORSO.map(([p, r]) => ell(r, p)), ell([5.5, 5.5, 4], [0, 1.5, 27.5]), ell([3.6, 3.4, 3], [-1.5, -4, 24.5]))],
  ['head', any(ell([3.6, 3.6, 3.2], [-1, -3.5, 27.8]), inFrame(HF, any(
    blob([[[3.6, 3.8, 3], [0, 1.5, 1.2]], [[3.3, 3, 2.3], [0, -2.5, 1]], [[2.3, 2.6, 1.4], [0, -5.8, -0.8]], [[1.9, 1.2, 1.3], [0, -7.4, -0.6]]]),
    mx(ell([1.4, 1.4, 1.5], [2.95, -3.1, 1.1])))))],
  ['jaw', inFrame(HF, blob([[[3.2, 3, 1.4], [0, -0.5, -2.2]], [[1.6, 1.4, 0.8], [0, -6.2, -2.6]]]))],
  ['arm*', any(ell([4, 4, 4.2], [7, -3, 23]), limb([7.5, -3, 22], [10.3, -2.5, 17.5], 3, 2.6))],
  ['fore*', limb([10.3, -2.5, 17.5], [9.5, -7, 13.8], 2.6, 2.2)],
  ['hand*', any(ell([2.2, 2.4, 1.8], [9.5, -8, 12.8]), ell([2.6, 1.6, 1.9], [9.5, -10.1, 11.2]))],
  ['leg*', any(ell([5.5, 6.5, 6.2], [7.5, 2, 10]), limb([8.2, 1.5, 6], [8.4, 1.2, 3.6], 3.8, 3.3),
    blob([[[3.8, 4.6, 1.6], [8.4, -0.5, 1.6]], [[3.2, 2.6, 1.4], [8.4, 2.5, 1.5]]]), ell([4.8, 1.8, 1.2], [8.4, -5.4, 0.8]))],
  ...chain(['tail1', 'tail1', 'tail2', 'tail2', 'tail3', 'tail3', 'tail4', 'tail4'], TAIL, TAIL_R),
];

// flames: [joint, frame, outlines, thickness] for plateD (the plate's own frame)
const sheetPlane = (d) => subFrame(rot([0, 0, 30], [0, d, 0]).map((v, i) => v + (i === 1 ? 7 : 0)), [0, 0, 30]);
const CREST = [[-3.8, 39.5], [-2.9, 39.3], [-3.9, 38.4], [-3.6, 36.2], [-5.3, 34.3], [-3.6, 34.6], [-3.6, 33.8], [-4.6, 31.8],
  [-6.5, 31], [-9.6, 31.2], [-12.3, 29.9], [-13.3, 32.4], [-13.0, 34.7], [-12.6, 35.1], [-12.3, 34.5], [-12.2, 35.2],
  [-10.4, 37.3], [-10.2, 35.5], [-9.0, 36.8], [-7.0, 37.1], [-6.4, 38.4], [-5.7, 37.1], [-5.1, 38.4]];
const TAILFLAME = [[14.7, 40.0], [15.9, 40.0], [15.1, 38.9], [15.1, 37.7], [17.2, 35.2], [17.2, 32.7], [15.9, 30.9], [17.3, 31.6],
  [17.8, 33.4], [18.5, 33.7], [18.3, 31.9], [18.8, 29.3], [17.2, 27.6], [17.7, 27.3], [17.2, 26.6], [14.1, 25.2],
  [11, 24.6], [7.8, 25.3], [7.8, 26.0], [8.6, 26.3], [7.0, 28.0], [7.0, 30.8], [7.8, 32.3], [10.1, 34.5], [9.9, 36.1],
  [11.1, 35.2], [11.5, 33.7], [12.5, 34.5], [12.0, 37.3], [13.0, 38.9]];
const tongue = (h, w, lean, n = 6) => [
  ...Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return [lean * h * t * t - (w / 2) * (1 - t) ** 0.8, h * t]; }),
  ...Array.from({ length: n - 1 }, (_, k) => { const t = (n - 1 - k) / n; return [lean * h * t * t + (w / 2) * (1 - t) ** 0.6, h * t * 0.97]; }),
];
const shift = (pts, dx) => pts.map(([x, z]) => [x + dx, z]);
const SPINE = [
  [[0, 2, 30.4], 40, 5.5, 5.5, 0.9, 'mane'],
  [[0, 6, 28.8], 38, 6.5, 6.5, 1.0, 'mane'],
  [[0, 9.5, 25.8], 36, 7, 7, 1.05, 'mane'],
  [[0, 11.8, 21.6], 36, 7, 7, 1.1, 'mane'],
  [[0, 12.4, 17], 36, 6.5, 6.5, 1.1, 'mane'],
  [[3.6, 9, 14], 33, 6, 5.5, 0.9, 'tail1'],
  [[8.2, 10.6, 12.8], 30, 5.5, 5, 0.8, 'tail2'],
  [[12, 12.6, 12.4], 34, 4.5, 4, 0.7, 'tail2'],
];
const FLAMES = [
  ['crest', sheetPlane(-9.9), [CREST], 3.6],
  ['flame', sheetPlane(-2.1), [TAILFLAME], 3.9],
  ...SPINE.map(([p, ang, h, w, lean, j]) => {
    const H = h + 1.5;
    return [j, subFrame([p[0], p[1], p[2] - 1.5], [0, 0, ang]),
      [tongue(H, w * 0.6, lean), shift(tongue(H * 0.7, w * 0.45, lean * 1.5), w * 0.28), shift(tongue(H * 0.55, w * 0.4, lean * 0.9), -w * 0.3)], 2.8];
  }),
];
const flameOf = (c) => {
  let best = 'mane'; let bd = Infinity;
  for (const [j, f, outlines, t] of FLAMES) {
    const q = f.local(c);
    for (const o of outlines) { const d = plateD(q, o, t); if (d < bd) { bd = d; best = j; } }
  }
  return best;
};

const assign = (c, rgb) => {
  if (isAny(rgb, FLAME)) return flameOf(c);
  if (near(rgb, COAL_HI)) return 'jaw';
  return pick(c, parts);
};

// flames flicker on 12 beats a second (whole beats per clip so loops close)
const flick = (u, secs, k = 1) => {
  const n = Math.max(1, Math.round(secs * 12));
  const b = Math.floor(u * n) % n;
  const f = (seed) => hash(b * 3.1 + seed) - 0.5;
  return {
    flame: { s: [1 + 0.1 * k * f(1), 1, 1 + 0.18 * k * f(2)], r: [0, 0, 6 * k * f(3)] },
    crest: { s: [1, 1, 1 + 0.16 * k * f(4)], r: [4 * k * f(5), 0, 0] },
    mane: { s: [1 + 0.04 * k * f(6), 1, 1 + 0.08 * k * f(7)] },
  };
};

const base0 = bipedClips({
  face, tail: tails, hipH: 10, stride: 14, armSwing: 12, hopScale: 0,
  punch: { arm: [-55, 0, -10], fore: [-25, 0, 0] },
  cheer: { arm: [-20, -80, 0], fore: [-30, 0, 0] },
  add: {
    idle: (t, u) => flick(u, 4),
    walk: (t, u) => flick(u, 0.8, 1.3),
    idle_look: (t, u) => flick(u, 2.4),
    windup: (t, u) => merge(flick(u, 0.25, 1.5), { jaw: { r: [8 * smooth(u / 0.8), 0, 0] } }),
    lunge: (t, u) => merge(flick(u, 0.3, 2), { jaw: { r: [14 * K(u, [[0.1, 0], [0.4, 1], [1, 0]]), 0, 0] } }),
    hurt: (t, u) => flick(u, 0.26, 2),
    recoil: (t, u) => flick(u, 0.25),
    // the flames die down as it falls; only to 0.8, since the crest and the tail flame are sunk into the head and the
    // tail tip and shrinking them further would open those holes
    faint: (t, u) => ({ flame: { s: [1, 1, 1 - 0.2 * smooth((u - 0.3) / 0.6)] }, crest: { s: [1, 1, 1 - 0.2 * smooth((u - 0.3) / 0.6)] } }),
    celebrate: (t, u) => flick(u, 0.6, 2),
    enter: (t, u) => flick(u, 0.45, 1.5),
    exit: (t, u) => flick(u, 0.35),
  },
});

// The template's tail pitch builds up link by link for a tail lying back along the ground; this one stands up behind
// in its second half, so the same pitch would throw the tip flame flat over the back. Damp it to a third.
const damp = (pose, k = 0.35) => {
  for (const n of tails) if (pose[n]?.r) pose[n] = { ...pose[n], r: pose[n].r.map((v) => v * k) };
  return pose;
};
const base = Object.fromEntries(Object.entries(base0).map(([name, c]) => [name, { ...c, pose: (t, u) => damp(c.pose(t, u)) }]));

const clips = {
  ...base,

  // fidget: a kaiju roar. Head thrown back, jaw wide, claws spread, every flame flaring, a rumble through the body
  idle_roar: {
    seconds: 2.6,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.7, 1], [0.9, 0]]);
      const rum = Math.sin(TAU * 13 * u) * win(u, 0.25, 0.7, 0.05);
      return merge({
        body: { r: [-8 * on, 0, 0.8 * rum] },
        head: { r: [-22 * on, 0.8 * rum, 0] },
        jaw: { r: [24 * on, 0, 0] },
        ...both('arm', { r: [-14 * on, -24 * on, 0] }),
        ...both('fore', { r: [-30 * on, 0, 0] }),
        ...both('hand', { r: [-14 * on, 0, 0] }),
        ...face.pose('open', blinks(u, [[0.88, 0.94]])),
        tail3: { r: [-8 * on, 0, 0] }, tail4: { r: [-10 * on, 0, 0] },
      }, flick(u, 2.6, 1 + 1.6 * on));
    },
  },

  // fidget: the tail swishes along the ground, the tip flame whips round and it glances back at it
  idle_swish: {
    seconds: 2.4,
    pose: (t, u) => {
      const s = osc(u, 2) * win(u, 0.05, 0.95, 0.15);
      const look = win(u, 0.15, 0.8, 0.12);
      return merge({
        body: { r: [0, 0, 6 * look] },
        head: { r: [0, -4 * look, 22 * look] },
        tail1: { r: [0, 0, 6 * s] }, tail2: { r: [0, 0, 8 * s] }, tail3: { r: [0, 0, 10 * s] }, tail4: { r: [0, 0, 12 * s] },
        ...face.pose('open', blinks(u, [[0.45, 0.5]])),
      }, flick(u, 2.4, 1.4));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
