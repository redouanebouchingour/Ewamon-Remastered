// Miscarmen's rig: a wide ghost head pitched forward (the floater's head) over a ragged hem (the body), its glaring
// eyes with eyeKit lids, the white grin a mouth decal, the crown of olive tufts a one-link wisp that sways and
// bristles, and the thin side tail a chain whose last link carries the big light star; the smaller dark star rides on
// a branch off the second link. Floater template. Numbers are scad/miscarmen.scad's.
import { K, merge, osc, rigDef } from './lib/anim.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { floaterClips } from './lib/floater.mjs';
import { blobD, chainHit, isAny, near } from './lib/geo.mjs';

const C30 = Math.cos(Math.PI / 6);
const S30 = 0.5;
const O = 8.5;
// pp(d) translate([O, 0, 0]): a point in sheet terms [sheet x, depth, z] -> scad
const pp = ([x, d, z]) => [(x + O) * C30 - d * S30, (x + O) * S30 + d * C30, z];

const LAV = [0.7, 0.69, 0.86];
const WHITE = [0.97, 0.97, 1];
const OLIVE = [[0.6, 0.58, 0.23], [0.83, 0.84, 0.36]];
const STARS = [[0.7, 0.8, 0.95], [0.6, 0.62, 0.76], [0.82, 0.22, 0.28]];
const STALK = [0.47, 0.46, 0.57];
const EYE = [[0.1, 0.09, 0.11], [0.98, 0.88, 0.1], [0.86, 0.16, 0.42]];
const GAP = [0.32, 0.33, 0.42];

// head: the hull of HA, HB, HC, HD and the curl; the hem under it
const HEAD = [[[14.5, 12, 11], [0, 1, 20]], [[10.5, 8, 8], [4, 7, 24]], [[12.5, 10.5, 7.5], [0, -6, 13]],
  [[10, 6, 4.5], [0, -8.5, 9.5]], [[5.2, 6.5, 6.2], [(-21 + O + 2) / C30, -4, 23.5]], [[7.5, 7.5, 7.5], [(-15 + O + 0.5) / C30, -1, 23]]];
const LOBES = [[-30, 0], [-78, 1], [-125, 2], [-170, 3], [125, 2.5], [70, 1.5], [15, 2]];
const DEG = Math.PI / 180;
const HEM = [[[10, 9, 4], [1, 1, 11]], [[8.5, 7.5, 2.5], [1, 2.5, 5.5]],
  ...LOBES.flatMap(([a, z]) => [
    [[3.2, 3.2, 1.8], [1 + 5.8 * Math.cos(a * DEG), 2.5 + 5.2 * Math.sin(a * DEG), 5.5]],
    [[1.6, 1.6, 1.4], [1 + 7 * Math.cos(a * DEG), 2.5 + 6.4 * Math.sin(a * DEG), z + 1.4]],
  ])];

const TAIL = [[0, 4, 6], [5, 3, 4.6], [10, 3, 5], [14, 3.5, 8.5], [17, 3, 12]].map(pp);
const TAIL_R = [1.4, 1.1, 0.95, 0.85, 0.8];
const BRANCH = [[10, 3, 5], [11.2, 4.5, 8.5], [11.8, 5, 12]].map(pp);
const STAR1 = pp([12, 5, 16.8]);
const STAR2 = pp([20.6, 2.5, 17.3]);
const tail = TAIL.slice(0, -1).map((_, i) => `tail${i + 1}`);

const eyeL = { side: 'L', at: [6.6, -13.8, 12.9], size: 3.9, yaw: 20, flat: 0.45 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], parent: 'head', skin: LAV, lid: [1.4, 1, 0.9] });
// the glareEye() glints, one per eye
const GLINTS = [[7.92, -15.72, 11.54], [-7.92, -15.72, 11.54]];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [1, 2, 7] },
  { name: 'head', parent: 'body', at: [0, -1, 12] },
  { name: 'eyes', parent: 'head', at: [0, -14, 12.8] },
  { name: 'mouth', parent: 'head', at: [0, -14, 9.8] },
  { name: 'wisp1', parent: 'head', at: [1, 2, 27] },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i] })),
  { name: 'star1', parent: 'tail2', at: BRANCH[0] },
  ...face.joints,
];

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function assign(c, rgb) {
  // the stars and their red marks: whichever star centre is nearer
  if (isAny(rgb, STARS, 0.03)) return dist(c, STAR1) < dist(c, STAR2) ? 'star1' : tail[tail.length - 1];
  if (near(rgb, STALK, 0.03)) {
    const b = chainHit(c, BRANCH, [0.95, 0.8, 0.7]);
    const t = chainHit(c, TAIL, TAIL_R);
    return b.d < t.d ? 'star1' : tail[Math.min(tail.length - 1, t.i)];
  }
  if (isAny(rgb, OLIVE, 0.03)) return 'wisp1';
  if (isAny(rgb, EYE, 0.03)) return 'eyes';
  if (near(rgb, WHITE, 0.02) && GLINTS.some((g) => dist(c, g) < 1)) return 'eyes';
  if (near(rgb, GAP, 0.03)) return 'mouth';
  if (near(rgb, WHITE, 0.02) && c[2] < 13.2 && c[1] < -8) return 'mouth';
  if (near(rgb, LAV, 0.03) && blobD(c, HEM) < blobD(c, HEAD)) return 'body';
  return 'head';
}

const clips = {
  ...floaterClips({ face, tail, wisp: ['wisp1'], bob: 1.1 }),

  // fidget: the crown of tufts bristles up and shivers, the eyes going wide, then it all settles with a huff
  idle_bristle: {
    seconds: 2,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.15, 1], [0.55, 1], [0.75, 0]]);
      const sh = osc(u, 14) * on;
      const huff = K(u, [[0.7, 0], [0.8, 1], [0.95, 0]]);
      return merge({
        body: { p: [0, 0, 0.5 + 0.6 * on], s: [1 - 0.04 * huff, 1 - 0.04 * huff, 1 + 0.03 * on - 0.05 * huff] },
        wisp1: { s: [1 + 0.06 * on, 1 + 0.06 * on, 1 + 0.12 * on], r: [3 * sh, 4 * sh, 0] },
        eyes: { s: [1 + 0.1 * on, 1, 1 + 0.15 * on - 0.15 * huff] },
        mouth: { s: [1 + 0.08 * on, 1, 1 + 0.1 * on] },
        ...face.pose('open'),
      }, Object.fromEntries([...tail, 'star1'].map((n, i) => [n, { r: [0, 0, 8 * sh * (1 + 0.3 * i)] }])));
    },
  },
};

export default rigDef({ joints, assign, clips, extras: face.extras });
