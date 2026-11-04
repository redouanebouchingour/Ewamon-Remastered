// Fedoraith's rig: a scarecrow wraith, a big grey stone face with angry gold-rimmed red eyes (lib.scad eye(), eyeKit
// lids) and a painted gold zig-zag grin (a decal: scaled a little, never far) under a cowboy hat, the shroud's tattered
// streamers fanning out from its shoulders like a thrown-open cloak, a skirt of ragged wisps to the ground, thin arms
// with spidery clawed hands. Numbers are scad/fedoraith.scad's.
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { eyeKit } from './lib/face.mjs';
import { floaterClips } from './lib/floater.mjs';
import { blobD, capD, closest, ellD, fold, isAny, near, side, unrot } from './lib/geo.mjs';

const FACE = [0.36, 0.33, 0.37];
const GOLD = [0.85, 0.69, 0.23];
const INK = [0.15, 0.13, 0.2];
const RED = [0.92, 0.16, 0.1];
const PUPIL = [0, 0, 0];
const HAT = [[0.23, 0.34, 0.58], [0.12, 0.13, 0.22]];
const HAND = [0.21, 0.2, 0.26];

const H = [0, -6.5, 20.3];
const HR = [10.4, 7.5, 9.2];
const EYE = [5.4, -12.3, 22.3];
const EYE_SIZE = 2.4;
const ARM = [[8, -1, 18.5], [18, -2.5, 14.8], [28.5, -3, 18.8]];
const PALM = [31, -3, 19.5];
const BODY = [[[11, 6.5, 6], [0, 2, 25]], [[12, 6.5, 5.5], [0, 2, 16]], [[9, 5.5, 4], [0, 2.5, 10]]];
const HOOD = [[7, 5, 3.4], [0, 1, 28.5]];
// the wing frame (translate(WING_T) rotate([0, 0, WING_A])) and its streamers: [points, widths], flattened 0.5 in y
const WING_T = [5, 2, 0];
const WING_A = 3;
const STREAMERS = [
  [[[0, 0, 26], [10, 0.3, 29.5], [19, 0.8, 32.4], [25.5, 1, 34.6], [30, 1, 36.6]], [4.2, 3.6, 2.6, 1.3, 0.25]],
  [[[0, -0.5, 27], [7, -0.3, 30], [14, 0, 32.5], [19.5, 0.5, 35]], [3.6, 3, 1.6, 0.25]],
  [[[0, -0.8, 28], [4, -0.8, 31], [7.5, -0.6, 34]], [2.8, 1.9, 0.25]],
  [[[0, 0.5, 24], [10, 0.8, 26], [20, 1, 28.5], [28, 1.2, 31.4]], [4, 3.2, 1.9, 0.25]],
  [[[0, 0.3, 22.5], [9, 0.3, 23.5], [17, 0.5, 25], [23.5, 0.6, 27]], [3.6, 2.8, 1.6, 0.25]],
  [[[0, 0, 21], [8, -0.2, 21.4], [16.5, -0.2, 22.6]], [3.2, 2.3, 0.25]],
  [[[4, 0.6, 27], [14, 0.8, 30], [23, 1, 33.4]], [3.2, 2.2, 0.25]],
  [[[4, 0.8, 25], [15, 1, 26.8], [25, 1.1, 29.4]], [3, 2.2, 0.25]],
];
const WEBS = [[[10, 2.4, 5.5], [7, 0.3, 26.5]], [[8, 1.9, 3.6], [15, 0.6, 27.5]]];
const flat = (p) => [p[0], p[1] * 2, p[2]];

function wingD(f) {
  const l = unrot([0, 0, WING_A], [f[0] - WING_T[0], f[1] - WING_T[1], f[2] - WING_T[2]]);
  const lf = flat(l);
  let d = Math.min(...WEBS.map(([r, p]) => ellD(l, r, p)));
  for (const [pts, ws] of STREAMERS) {
    for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, capD(lf, flat(pts[i]), flat(pts[i + 1]), ws[i], ws[i + 1]));
  }
  return d;
}

const face = eyeKit({ eyes: [{ side: 'L', at: EYE, size: EYE_SIZE, yaw: 22 }, { side: 'R', at: [-EYE[0], EYE[1], EYE[2]], size: EYE_SIZE, yaw: -22 }], parent: 'eyes', skin: FACE });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 2, 14] },
  { name: 'tail1', parent: 'body', at: [0, 2.5, 12] },
  { name: 'head', parent: 'body', at: H },
  { name: 'hat', parent: 'head', at: [0, -4.5, 29.4] },
  { name: 'eyes', parent: 'head', at: [0, EYE[1], EYE[2]] },
  { name: 'mouth', parent: 'head', at: [0, -13.8, 16.5] },
  { name: 'capeL', parent: 'body', at: [5, 2, 25] },
  { name: 'capeR', parent: 'body', at: [-5, 2, 25] },
  { name: 'armL', parent: 'body', at: ARM[0] },
  { name: 'handL', parent: 'armL', at: [29.2, -3, 19] },
  { name: 'armR', parent: 'body', at: [-ARM[0][0], ARM[0][1], ARM[0][2]] },
  { name: 'handR', parent: 'armR', at: [-29.2, -3, 19] },
  ...face.joints,
];

function assign(c, rgb) {
  const S = side(c);
  const f = fold(c);
  const eyeD = ellD(f, [EYE_SIZE * 1.25, EYE_SIZE * 1.1, EYE_SIZE * 1.35], EYE);
  if ((isAny(rgb, [GOLD, RED, PUPIL]) || near(rgb, INK)) && eyeD < 1.25 && c[2] < 28) return 'eyes';
  if ((near(rgb, GOLD) || near(rgb, INK)) && c[2] < 24 && c[1] < -6) return 'mouth';
  if (isAny(rgb, HAT) && c[2] > 28.5) return 'hat';
  if (near(rgb, FACE)) return eyeD < 1.02 && ellD(c, HR, H) > 1.02 ? 'eyes' : 'head';
  if (near(rgb, HAND)) return f[0] > 29.2 ? `hand${S}` : `arm${S}`;
  // the shroud: the wings, the body and hood, the skirt below
  const w = wingD(f);
  const b = Math.min(blobD(c, BODY), ellD(c, HOOD[0], HOOD[1]));
  if (c[2] < 12.5 && w > 1.2) return 'tail1';
  return closest([[`cape${S}`, w], ['body', b]]);
}

// the shoulder tatters stream and flutter (ry < 0 lifts a strand reaching out along +X, rz > 0 sweeps it back)
const capes = (lift, back, flut = 0, u = 0, cycles = 4) => both('cape', { r: [0, -lift - flut * osc(u, cycles), back] }, { r: [0, -lift - flut * osc(u, cycles, 0.3), back] });
const add = {
  idle: (t, u) => capes(0, 0, 4, u, 2),
  walk: (t, u) => capes(-4, 20, 6, u, 2),
  idle_spin: (t, u) => capes(10 * win(u, 0.1, 0.85, 0.1), 0, 8, u, 6),
  idle_cackle: (t, u) => merge(capes(6 * win(u, 0.08, 0.85, 0.08), 0, 6, u, 8), { hat: { p: [0, 0, 0.6 * Math.abs(Math.sin(TAU * 8 * u)) * win(u, 0.08, 0.85, 0.08)] } }),
  windup: (t, u) => capes(16 * smooth(u / 0.8), -6 * smooth(u / 0.8)),
  lunge: (t, u) => capes(16 * K(u, [[0, 1], [0.3, 0.6], [1, 0]]), 24 * K(u, [[0.1, 0], [0.4, 1], [1, 0]])),
  hurt: (t, u) => merge(capes(10, 0, 10, u, 5), { hat: { p: [0, 0, 1.4 * K(u, [[0, 0], [0.2, 1], [1, 0.2]])], r: [-14 * K(u, [[0, 0], [0.2, 1], [1, 0.2]]), 0, 0] } }),
  faint: (t, u) => merge(capes(-14 * smooth((u - 0.2) / 0.6), 0), { hat: { r: [24 * smooth((u - 0.2) / 0.6), 0, 10 * smooth((u - 0.2) / 0.6)] } }),
  celebrate: (t, u) => merge(capes(18, 0, 10, u, 3), { hat: { p: [0, 0, 1.5 * Math.sin(Math.PI * u)] } }),
  enter: (t, u) => capes(20 * win(u, 0.35, 0.95, 0.15), 0),
};

const base = floaterClips({ face, tail: ['tail1'], bob: 0.5, add });

const clips = {
  ...base,
  // fidget: tips the hat with its spidery left hand, the grin widening
  idle_tiphat: {
    seconds: 2.4,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.22, 1], [0.7, 1], [0.88, 0]]);
      const tip = win(u, 0.3, 0.62, 0.08);
      return merge({
        head: { r: [10 * tip, 0, 10 * up] },
        mouth: { s: [1 + 0.15 * tip, 1, 1 + 0.1 * tip] },
        armL: { r: [-30 * up, -60 * up, 10 * up] },
        handL: { r: [0, -30 * up, 0] },
        hat: { r: [-10 * tip, 0, 0], p: [0, 0, 0.8 * tip] },
      }, capes(0, 0, 4, u, 2));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
