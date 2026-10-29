// Miscarmen's rig: a floating ghost head (the body: no separate head, the hair cap is painted on), its big yellow
// eyes a decal, the crown of olive tufts a one-link wisp that sways and bristles, the thin side tail with its two
// starbursts a chain. Floater template. Numbers are scad/miscarmen.scad's, lifted by its `lift` of 7.
import { K, merge, osc, rigDef } from './lib/anim.mjs';
import { floaterClips } from './lib/floater.mjs';
import { chainHit, ellD, isAny, near } from './lib/geo.mjs';

const L = 7;
const up = ([x, y, z]) => [x, y, z + L];
const STAR = [0.62, 0.68, 0.92];
const RED = [0.85, 0.2, 0.22];
const OLIVE = [[0.72, 0.7, 0.24], [0.88, 0.86, 0.4]];
const EYE = [[0.98, 0.88, 0.12], [0.85, 0.12, 0.32], [0.12, 0.1, 0.16]];
const WHITE = [0.97, 0.97, 1];

const TAIL = [[7, 4, 4], [11, 5, 2], [14, 3, 3], [16, 0, 6], [17, -1, 9]].map(up);
const TAIL_R = [1.2, 0.9, 0.7, 0.6, 0.5];
const BURSTS = [[up([17, -1, 9.5]), 1.1], [up([14.5, 2.5, 3.5]), 0.85]];
const tail = TAIL.slice(0, -1).map((_, i) => `tail${i + 1}`);

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: up([0, 0, 4]) },
  { name: 'eyes', parent: 'body', at: up([0, -8.1, 8.6]) },
  { name: 'wisp1', parent: 'body', at: up([0, 0, 16.5]) },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i] })),
];

function assign(c, rgb) {
  // the starbursts (and their red marks) ride on the tail link nearest their centre
  if (near(rgb, STAR, 0.03) || (near(rgb, RED, 0.03) && Math.abs(c[0]) > 10)) {
    const [p] = BURSTS.reduce((a, b) => (ellD(c, [1, 1, 1], a[0]) < ellD(c, [1, 1, 1], b[0]) ? a : b));
    return tail[Math.min(tail.length - 1, chainHit(p, TAIL, TAIL_R).i)];
  }
  if (isAny(rgb, OLIVE, 0.03)) return 'wisp1';
  // the eyes and their dark rims (not the white cheek ruff, nor the white glint in them)
  if (isAny(rgb, EYE, 0.03) && c[1] < -5) return 'eyes';
  if (near(rgb, WHITE, 0.02) && c[1] < -8.5 && Math.abs(c[2] - (8.6 + L)) < 2.5 && Math.abs(Math.abs(c[0]) - 3.6) < 1.5) return 'eyes';
  const t = chainHit(c, TAIL, TAIL_R);
  if (t.d < 1.3 && Math.abs(c[0]) > 6.5 && c[1] > -2) return tail[Math.min(tail.length - 1, t.i)];
  return 'body';
}

const clips = {
  ...floaterClips({ tail, wisp: ['wisp1'], bob: 1.1 }),

  // fidget: the crown of tufts bristles up and shivers, the eyes going wide, then it all settles with a huff
  idle_bristle: {
    seconds: 2,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.15, 1], [0.55, 1], [0.75, 0]]);
      const sh = osc(u, 14) * on;
      const huff = K(u, [[0.7, 0], [0.8, 1], [0.95, 0]]);
      return merge({
        body: { p: [0, 0, 0.5 + 0.6 * on], s: [1 - 0.04 * huff, 1 - 0.04 * huff, 1 + 0.03 * on - 0.05 * huff] },
        wisp1: { s: [1 + 0.08 * on, 1 + 0.08 * on, 1 + 0.2 * on], r: [3 * sh, 4 * sh, 0] },
        eyes: { s: [1 + 0.12 * on, 1, 1 + 0.2 * on - 0.2 * huff] },
      }, Object.fromEntries(tail.map((n, i) => [n, { r: [0, 0, 8 * sh * (1 + 0.3 * i)] }])));
    },
  },
};

export default rigDef({ joints, assign, clips });
