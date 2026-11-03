// Archonosis's rig: a floating sorcerer. A bone mask with five gem eyes (each with its own bone-coloured lid that
// blinks across the almond) under a cowl and a tall fan, a magenta bell robe, bell sleeves with lilac hands (the
// viewer's left one, -X, cups the vortex orb, which spins about the view axis), and a violet ghost tail curling in an
// S in six links. Numbers are scad/archonosis.scad's (the sprite-matched model, 2026-11-03).
import { HIDE, K, merge, osc, rigDef } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { chainHit, isAny, near, rot, side, subFrame } from './lib/geo.mjs';

const MASK = [0.92, 0.88, 0.74];
const HEAD = [MASK, [0.22, 0.03, 0.28], [0.8, 0.16, 0.76], [1, 0.65, 0.97], [0.33, 0.22, 0.6], [0.27, 0.16, 0.52], [0.62, 0.66, 0.86]];
const BODY = [[0.52, 0.07, 0.42], [0.42, 0.5, 0.84], [0.13, 0.19, 0.46], [0.13, 0.26, 0.51]];
const SLEEVE = [[0.19, 0.15, 0.42], [0.05, 0.03, 0.12]];
const HAND = [0.52, 0.4, 0.8];
const SHARD = [0.6, 0.5, 0.86];
const ORB_COLS = [[0.36, 0.56, 0.92], [0.7, 0.93, 0.98], [0.4, 0.52, 0.95]];
const TAIL_COLS = [[0.38, 0.22, 0.68], [0.47, 0.58, 0.92]];

// The art frame (lib.scad pp() + the scad's art(): sheet x, depth, z) to scad and back.
const SX = 0.9;
const C30 = Math.cos(Math.PI / 6);
const S30 = 0.5;
const art = (sx, d, z) => [(sx - SX) * C30 - d * S30, (sx - SX) * S30 + d * C30, z];
const toArt = (c) => [c[0] * C30 + c[1] * S30 + SX, -c[0] * S30 + c[1] * C30, c[2]];

// Head frame: translate([HX, 0, 0]) rotate([0, 0, HY]).
const HX = -1.3;
const HY = 15;
const HF = subFrame([HX, 0, 0], [0, 0, HY]);

// The mask's ellipsoids (head frame) and its five eyes [x, z, L, H, tilt].
const MASK_E = [[[3.3, 2.6, 2.5], [0, -0.4, 32.7]], [[3.1, 2.4, 1.2], [0, -0.6, 30.4]], [[1.0, 1.3, 0.7], [0, -1.8, 28.1]]];
const EYES = [[0, 32.9, 3.9, 1.5, 90], [1.95, 32.35, 2.15, 1.25, 40], [-1.95, 32.35, 2.15, 1.25, 140],
  [1.85, 30.25, 2.7, 1.6, 42], [-1.85, 30.25, 2.7, 1.6, 138]];
// the mask's front surface at (x, z): the most forward of its ellipsoids, with that ellipsoid's normal yaw
function maskFront(x, z) {
  let best = null;
  for (const [r, p] of MASK_E) {
    const q = 1 - ((x - p[0]) / r[0]) ** 2 - ((z - p[2]) / r[2]) ** 2;
    if (q <= 0) continue;
    const y = p[1] - r[1] * Math.sqrt(q);
    if (!best || y < best.y) best = { y, yaw: (Math.atan2((x - p[0]) / r[0] ** 2, -(y - p[1]) / r[1] ** 2) * 180) / Math.PI };
  }
  return best;
}
const lids = [];
const lidExtras = [];
EYES.forEach(([x, z, L, H, tilt], i) => {
  const name = `lid${i + 1}`;
  const f = maskFront(x, z);
  const upright = tilt === 90;
  const ry = upright ? 0 : -(tilt > 90 ? tilt - 180 : tilt);
  const R = upright ? [H * 0.58 + 0.15, 0.45, L * 0.53 + 0.1] : [L * 0.53 + 0.1, 0.45, H * 0.58 + 0.15];
  const r0 = [0, ry, HY + f.yaw];
  const c = HF.world([x, f.y, z]);
  const top = rot(r0, [0, 0, R[2]]);
  lids.push({ name, parent: 'head', at: [c[0] + top[0], c[1] + top[1], c[2] + top[2]], rot: r0, scale: HIDE });
  lidExtras.push({ joint: name, color: MASK, shape: 'ell', at: [0, 0, -R[2]], size: R.map((v) => 2 * v) });
});
// shut for every face but 'open' (the gem eyes have no strokes to draw)
const face = {
  pose: (kind = 'open', blink = 0) => {
    const b = kind === 'open' ? Math.min(1, Math.max(0, blink)) : 1;
    return Object.fromEntries(lids.map((l) => [l.name, { s: b < 0.02 ? HIDE : [1, 1, b] }]));
  },
};

// The tail chain (art frame), its links: the joint per chain segment.
const TAIL = [[0.8, 14.5], [3.6, 10.5], [4.4, 7.9], [1.5, 6.6], [-1.8, 7.5], [-4.3, 7.0], [-5.2, 4.0], [-3.6, 1.6], [-0.3, 1.2], [3.0, 2.6], [5.6, 3.3], [7.6, 2.5]];
const TAIL_R = [4.0, 3.1, 2.6, 2.1, 1.7, 2.0, 2.2, 1.6, 1.3, 1.0, 0.55, 0.25];
const TD = 0.6;
const TAIL_PTS = TAIL.map(([x, z]) => [x, 0, z]);
const LINK_AT = [0, 1, 3, 5, 7, 9];
const SEG_LINK = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5];
const tail = LINK_AT.map((_, i) => `tail${i + 1}`);

const ORB = art(-7.45, 0, 24.85);

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 16] },
  { name: 'head', parent: 'body', at: [HX, 0.8, 28.8] },
  { name: 'armL', parent: 'body', at: [5.0, 0.4, 25.3] },
  { name: 'handL', parent: 'armL', at: art(9.6, -7, 21.7) },
  { name: 'armR', parent: 'body', at: [-5.0, 0.4, 25.3] },
  { name: 'handR', parent: 'armR', at: art(-9.0, -0.5, 20.6) },
  // the orb spins about the view axis: its local z points at the camera
  { name: 'core', parent: 'handR', at: ORB, rot: [90, 0, 30] },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: art(TAIL[LINK_AT[i]][0], 0, TAIL[LINK_AT[i]][1]) })),
  ...lids,
];

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function assign(c, rgb) {
  const S = side(c);
  if (isAny(rgb, ORB_COLS) && dist(c, ORB) < 7) return 'core';
  if (isAny(rgb, TAIL_COLS)) {
    const a = toArt(c);
    const h = chainHit([a[0], a[1] / TD, a[2]], TAIL_PTS, TAIL_R);
    return tail[SEG_LINK[h.i]];
  }
  if (near(rgb, HAND)) return `hand${S}`;
  if (near(rgb, SHARD)) return 'armL';
  if (isAny(rgb, SLEEVE)) return `arm${S}`;
  if (isAny(rgb, HEAD) && c[2] > 27) return 'head';
  if (isAny(rgb, BODY) || isAny(rgb, HEAD)) return 'body';
  return 'body';
}

const base = floaterClips({ face, tail, bob: 0.8 });

const clips = {
  ...base,
  // fidget: lifts the vortex orb and makes it spin up and flare, the free hand sweeping a spell, the eyes narrowing
  idle_conjure: {
    seconds: 2.8,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.72, 1], [0.9, 0]]);
      const spin = K(u, [[0.15, 0], [0.8, 720]]);
      return merge({
        body: { p: [0, 0, 0.6 * on], r: [-4 * on, 0, -6 * on] },
        head: { r: [6 * on, 0, -14 * on] },
        armR: { r: [-25 * on, 15 * on, 0] },
        core: { r: [0, 0, spin], s: 1 + 0.15 * on + 0.05 * osc(u, 8) * on },
        armL: { r: [-20 * on, -30 * on, 20 * osc(u, 2) * on] },
        ...face.pose('open', 0.4 * on),
      }, Object.fromEntries(tail.map((n, i) => [n, { r: [0, 0, 6 * osc(u, 2, -0.15 * i) * (1 + on)] }])));
    },
  },
};
// the orb keeps turning slowly in the idle and walk loops
const idle0 = clips.idle.pose;
clips.idle = { ...clips.idle, pose: (t, u) => merge(idle0(t, u), { core: { r: [0, 0, 360 * u] } }) };
const walk0 = clips.walk.pose;
clips.walk = { ...clips.walk, pose: (t, u) => merge(walk0(t, u), { core: { r: [0, 0, 360 * u] } }) };

export default rigDef({ joints, assign, clips, extras: lidExtras });
