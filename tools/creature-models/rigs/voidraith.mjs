// Voidraith's rig: a tall wraith in a long robe trailing tatters, a skull under a deep hood, wide ragged sleeves with
// bony clawed hands, and motes of void energy round it (each goes with the part it floats by). Numbers are
// scad/voidraith.scad's (the old model, rigged before its sprite-accuracy rebuild).
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { capD, closest, ellD, fold, isAny, side } from './lib/geo.mjs';

const BONE = [[0.86, 0.82, 0.7], [0.55, 0.5, 0.42]];
const MAGIC = [[0.62, 0.3, 0.85], [0.85, 0.6, 1]];
const VOID = [0.05, 0.03, 0.08];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0.5, 6] },
  { name: 'head', parent: 'body', at: [0, 0.5, 31] },
  { name: 'armL', parent: 'body', at: [4.5, 0, 30] },
  { name: 'handL', parent: 'armL', at: [11.5, -3.5, 20.5] },
  { name: 'armR', parent: 'body', at: [-4.5, 0, 30] },
  { name: 'handR', parent: 'armR', at: [-11.5, -3.5, 20.5] },
];

// the robe: hull of a dome at the shoulders (z 29, 5.5 × 4.5) and a disc at the hem (z 6, 9.5 × 8)
const robe = (c) => {
  const k = Math.min(1, Math.max(0, (c[2] - 6) / 23));
  return Math.max(Math.hypot(c[0] / (9.5 - 4 * k), (c[1] - 0.5) / (8 - 3.5 * k)), (c[2] - 32) / 3 + 1);
};

function assign(c, rgb) {
  const S = side(c);
  const f = fold(c);
  if (isAny(rgb, MAGIC, 0.03)) return Math.abs(c[0]) > 12 && c[2] > 13 ? `hand${S}` : c[2] > 34 ? 'head' : 'body';
  if (isAny(rgb, BONE, 0.03)) return c[2] > 30 ? 'head' : Math.abs(c[0]) > 9.5 ? `hand${S}` : 'body';
  if (isAny(rgb, [VOID], 0.03) && c[2] > 30) return 'head';
  if (c[2] < 6.5) return 'body';                                           // the hem tatters
  return closest([
    ['body', Math.min(robe(c), ellD(c, [7, 5.5, 2.6], [0, -0.5, 30]), ellD(c, [4, 1.2, 2.5], [0, -4.8, 28.5]))],
    ['head', Math.min(ellD(c, [5, 5.2, 5.6], [0, 0.5, 35]), capD(c, [0, 1.5, 39.5], [0, 3, 42], 2, 0.4), ellD(c, [3.2, 2.5, 3.8], [0, -1.5, 34.3]))],
    [`arm${S}`, Math.min(capD(f, [4.5, 0, 30], [10.5, -2.5, 22], 2.2, 2.6), capD(f, [10.5, -2.5, 21.5], [10.8, -2.6, 17], 2.6, 1))],
  ]);
}

const base = floaterClips({ bob: 0.6 });
delete base.idle_cackle;   // a skull in the dark: no grin to cackle with

const clips = {
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

  // fidget: slowly turns its hooded head to the camera side and back, the left claw raised in a point
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
};

export default rigDef({ joints, assign, clips });
