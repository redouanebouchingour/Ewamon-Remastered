// Voidraith's rig: a grim reaper hunched forward in a long robe. A skull deep in a tall hood (head), the robe a loft
// of tilted ellipses with folds running into a tattered hem that streams back to +X (the robe below HEM_Z rides a
// `hem` joint that drags a beat behind the body), long sleeves flaring to open cuffs with rags (armL / armR) and black
// bony clawed hands (handL / handR), purple wisps going with the part they float by. Numbers are scad/voidraith.scad's
// (the 2026-11 sprite-match remodel).
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { capD, closest, ellD, isAny, near, side, subFrame } from './lib/geo.mjs';

const BONE = [[0.85, 0.83, 0.77], [0.55, 0.51, 0.49]];
const GREY = [0.72, 0.72, 0.72];
const VOID = [0.03, 0.02, 0.04];
// the darkest colours as they read back from the GLB (its 8-bit linear colours round the darks)
const CLAW = [0.05, 0.05, 0.08];
const MAGIC = [0.37, 0.22, 0.45];
const ROBE_DK = [0.08, 0.05, 0.11];

// scad W(): a front-sheet point at depth y, the camera tilt taken out
const W = (s, z, y) => { const x = (s - 0.5 * y) / 0.866; return [x, y, z - 0.17 * (-0.5 * x + 0.866 * y)]; };
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, k) => a.map((v) => v * k);
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// ---- the robe loft: [centre, half-length along +X+Y, half-width across]
const SL = [
  [[0.6, 0.3, 30.6], 4.6, 4.2],
  [[0.4, 0.4, 25.5], 5.5, 5.0],
  [[0, 0.7, 19], 6.8, 6.2],
  [[-0.8, 1.2, 13], 8.4, 7.2],
  [[1.3, 2.6, 7.5], 10.6, 8],
  [[3.0, 4.6, 3.6], 12.4, 8.6],
];
function robeD(c) {
  const z = Math.max(SL[5][0][2], Math.min(SL[0][0][2], c[2]));
  let i = 1;
  while (i < 5 && SL[i][0][2] > z) i++;
  const [A, B] = [SL[i - 1], SL[i]];
  const f = (A[0][2] - z) / (A[0][2] - B[0][2]);
  const cx = A[0][0] + (B[0][0] - A[0][0]) * f;
  const cy = A[0][1] + (B[0][1] - A[0][1]) * f;
  const a = A[1] + (B[1] - A[1]) * f;
  const b = A[2] + (B[2] - A[2]) * f;
  const dx = c[0] - cx;
  const dy = c[1] - cy;
  const u = 0.7071 * (dx + dy);     // along +X+Y
  const v = 0.7071 * (dy - dx);
  const over = c[2] > SL[0][0][2] ? (c[2] - SL[0][0][2]) / 2 : 0;
  return Math.hypot(u / a, v / b, over);
}
const HEM_Z = 10;

// ---- head: the hood (hull with a shoulder ellipsoid, the hollow), the skull
const H = W(-2.9, 35.2, -4.5);
const SK = W(-3.8, 33.4, -7.4);
const SKF = subFrame(SK, [-10, 0, 0], 1.15);
const headD = (c) => {
  const s = SKF.local(c);
  return Math.min(ellD(c, [3.8, 4.8, 4.7], H), ellD(c, [3.0, 2.6, 3.4], add(H, [0, -1.9, -1.0])),
    ellD(s, [1.6, 1.75, 1.85], [0, 0, 0.5]), ellD(s, [1.25, 1.3, 0.9], [0, -0.5, -1.0]), ellD(s, [0.9, 0.95, 0.7], [0, -0.55, -2.0]));
};
const bodyTop = (c) => Math.min(ellD(c, [4.6, 4, 2], [0.6, 0.8, 31.4]), ellD(c, [5.8, 5, 2.3], [0.4, -0.2, 28.6]));

// ---- arms (the scad's sleeve(): capsule shoulder -> elbow, a bell elbow -> 1.12 past the cuff)
const ARM = {
  R: { sh: [-4.4, -0.6, 27.4], el: [-8.6, -2.8, 23.2], cu: [-10.6, -4.0, 21.2], hand: [-12.4, -4.8, 21.0], rs: [2.2, 1.9, 2.6] },
  L: { sh: [5.6, 0.4, 30.2], el: [11.6, -0.8, 27.8], cu: [14.8, -1.6, 24.2], hand: [14.6, -3.2, 20.2], rs: [2.5, 2.1, 3.3] },
};
for (const a of Object.values(ARM)) a.tip = lerp(a.el, a.cu, 1.12);
const armD = (c, a) => Math.min(capD(c, a.sh, a.el, a.rs[0], a.rs[1]), capD(c, a.el, a.tip, a.rs[1], a.rs[2]),
  capD(c, add(a.sh, [0, 0, 1.2]), add(a.el, [0, 0, 1.2]), 1.2, 0.9));
const handD = (c, a) => Math.min(ellD(c, [1.1, 0.9, 1.0], a.hand), capD(c, lerp(a.cu, a.el, 0.3), a.hand, 0.75, 0.6));

function assign(c, rgb) {
  const S = side(c);
  const a = ARM[S];
  const dh = Math.hypot(...sub(c, a.hand));
  if (near(rgb, CLAW, 0.015) && dh < 7) return `hand${S}`;
  if (isAny(rgb, [MAGIC], 0.02)) {
    if (c[2] > 30) return 'body';                     // the wisp behind the near shoulder
    if (c[2] < 17) return 'hem';                      // the wisp down the near side by the hem
    return `hand${S}`;                                // the wisp over the far hand
  }
  if (isAny(rgb, [...BONE, VOID], 0.02) && c[2] > 30.5 && Math.hypot(...sub(c, SK)) < 4.5) return 'head';
  if (isAny(rgb, [...BONE, GREY], 0.02)) {
    if (armD(c, a) < 1.4) return `arm${S}`;           // the bone glints on the sleeve and shoulder
    return c[2] < HEM_Z ? 'hem' : 'body';             // torn patches on the robe
  }
  // the rags hanging off each cuff
  if (near(rgb, ROBE_DK, 0.015) && Math.hypot(...sub(c, a.cu)) < 5 && c[2] > 16 && dh > 0.5 && robeD(c) > 1.05) return `arm${S}`;
  const r = robeD(c);
  return closest([
    ['head', headD(c)],
    ['body', Math.min(c[2] >= HEM_Z ? r : Infinity, bodyTop(c))],
    ['hem', c[2] < HEM_Z ? r : Infinity],
    [`arm${S}`, armD(c, a)],
  ]);
}

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0.4, 1, 9] },
  { name: 'hem', parent: 'body', at: [0.8, 1.8, 10.5] },
  { name: 'head', parent: 'body', at: [-0.6, -2.2, 31.6] },
  { name: 'armL', parent: 'body', at: ARM.L.sh },
  { name: 'handL', parent: 'armL', at: lerp(ARM.L.cu, ARM.L.el, 0.3) },
  { name: 'armR', parent: 'body', at: ARM.R.sh },
  { name: 'handR', parent: 'armR', at: lerp(ARM.R.cu, ARM.R.el, 0.3) },
];

// the hem drags a beat behind the body's sway
function follow(clips) {
  for (const c of Object.values(clips)) {
    const pose = c.pose;
    c.pose = (t, u) => {
      const p = pose(t, u);
      const b = p.body?.r ?? [0, 0, 0];
      const drag = (v, k) => Math.max(-8, Math.min(8, -k * v));
      return { ...p, hem: { ...(p.hem ?? {}), r: add(p.hem?.r ?? [0, 0, 0], [drag(b[0], 0.45), drag(b[1], 0.45), drag(b[2], 0.35)]) } };
    };
  }
  return clips;
}

const base = floaterClips({ bob: 0.6 });
delete base.idle_cackle;   // a skull in the dark: no grin to cackle with

const clips = follow({
  ...base,

  // fidget: claws curling and uncurling as it gathers void energy, rising a little, the hood dipping
  idle_gather: {
    seconds: 2.6,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.2, 1], [0.75, 1], [0.9, 0]]);
      const flex = Math.sin(TAU * 4 * u) * win(u, 0.2, 0.75, 0.06);
      return merge({
        body: { p: [0, 0, 0.6 + 1 * on], r: [-4 * on, 0, 0] },
        head: { r: [10 * on, 0, 0] },
        ...both('arm', { r: [-20 * on, -12 * on, -20 * on] }),
        ...both('hand', { r: [-10 * on + 14 * flex, 0, 0] }),
      });
    },
  },

  // fidget: slowly turns its hooded head to the camera side and back, the near claw raised in a point
  idle_point: {
    seconds: 2.4,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.22, 1], [0.7, 1], [0.88, 0]]);
      return {
        body: { p: [0, 0, 0.6], r: [0, 0, 8 * up] },
        head: { r: [-4 * up, 0, 18 * up + 2 * osc(u, 4) * up] },
        armL: { r: [-40 * up, -30 * up, 0] },
        handL: { r: [-10 * up, 0, 0] },
      };
    },
  },
});

export default rigDef({ joints, assign, clips });
