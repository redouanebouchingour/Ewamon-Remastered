// Fedoraith's rig: a scarecrow wraith, stone face with a gold zig-zag grin (a decal: scaled a little, never far) and
// red eyes under a cowboy hat, a shroud of tatters streaming from its shoulders and hanging to the ground, thin arms
// with spidery hands. Numbers are scad/fedoraith.scad's (the old model; re-rig when the sprite-matched one lands).
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { capD, chainHit, isAny, near, side, fold } from './lib/geo.mjs';

const FACE = [[0.32, 0.31, 0.34], [0.42, 0.41, 0.44]];
const GOLD = [0.85, 0.7, 0.18];
const SHROUD = [[0.2, 0.2, 0.36], [0.33, 0.33, 0.52], [0.12, 0.12, 0.24]];
const SHROUD_DK = [0.12, 0.12, 0.24];
const HAT = [[0.18, 0.28, 0.58], [0.28, 0.4, 0.72], [0.08, 0.12, 0.28]];
const HAND = [0.24, 0.24, 0.32];
const EYE = [[0.92, 0.18, 0.08], [0.15, 0, 0]];
const ARM = [[6, -1, 17], [10, -2, 14], [13.5, -2.5, 15.5], [16, -3, 14]];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 1, 12] },
  { name: 'head', parent: 'body', at: [0, -1.5, 18] },
  { name: 'hat', parent: 'head', at: [0, -0.5, 28.6] },
  { name: 'eyes', parent: 'head', at: [0, -7.2, 24.4] },
  { name: 'mouth', parent: 'head', at: [0, -7.4, 20.6] },
  { name: 'capeL', parent: 'body', at: [4, 1.5, 22] },
  { name: 'capeR', parent: 'body', at: [-4, 1.5, 22] },
  { name: 'armL', parent: 'body', at: ARM[0] },
  { name: 'handL', parent: 'armL', at: [16.5, -3.2, 14] },
  { name: 'armR', parent: 'body', at: [-6, -1, 17] },
  { name: 'handR', parent: 'armR', at: [-16.5, -3.2, 14] },
];

function assign(c, rgb) {
  const S = side(c);
  const f = fold(c);
  if (isAny(rgb, EYE) || (near(rgb, GOLD) && c[2] > 23.2)) return 'eyes';
  if (near(rgb, GOLD)) return 'mouth';
  if (near(rgb, SHROUD_DK) && c[1] < -5 && Math.abs(c[2] - 20.5) < 3 && f[0] < 5.8) return 'mouth';
  if (isAny(rgb, HAT) && c[2] > 27) return 'hat';
  if (isAny(rgb, FACE)) return 'head';
  if (near(rgb, HAND)) {
    const h = chainHit(f, ARM, [0.6, 0.55, 0.5, 0.5]);
    return h.i < 2 && capD(f, [17, -3.4, 14], [17, -3.4, 14], 1.6) > 1.3 ? `arm${S}` : `hand${S}`;
  }
  if (isAny(rgb, SHROUD) && c[2] > 18.5 && f[0] > 6.5) return `cape${S}`;
  return 'body';
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

const base = floaterClips({ bob: 0.5, add });

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

export default rigDef({ joints, assign, clips });
