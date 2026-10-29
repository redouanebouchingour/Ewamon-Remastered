// Sproutgrub's rig: a sleepy legless grub tucked into its own body like a blanket. The front segment, the hood and
// the blanket flap are the body, the seed head peeks out (head), the segments behind are a tail chain, and the two
// sprout leaves on top are a pair of one-link antennae. It walks by inching (no legs; the tail chain humps).
// Numbers are scad/sproutgrub.scad's.
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { ell, pick } from './lib/biped.mjs';
import { near, petalD } from './lib/geo.mjs';
import { insectClips } from './lib/insect.mjs';

const SEGS = [[0, 0.5, 11, 11, 10.5], [1, 5.5, 10, 10.5, 9.5], [2, 10, 8.5, 9.5, 8], [3, 14, 6.5, 8, 6.5]];
const SEG_OWNER = ['body', 'tail1', 'tail2', 'tail3'];
const tail = ['tail1', 'tail2', 'tail3'];
const BROWN = [0.5, 0.3, 0.14];
const FACE = [0.9, 0.95, 0.5];
const INK = [0.12, 0.15, 0.06];
const SPROUT = [[0.68, 0.84, 0.3], [0.75, 0.9, 0.35]];
const LEAF = [[[3.6, 0.9, 2], [-3.2, -6.5, 23.4], [-20, -20, 0]], [[3.6, 0.9, 2], [3.2, -6.5, 24], [-20, 25, 0]]];

const joints = [
  { name: 'root', at: [0, 4, 0] },
  { name: 'body', parent: 'root', at: [0, 1, 3] },
  { name: 'head', parent: 'body', at: [0, -5, 6] },
  { name: 'antL1', parent: 'head', at: [0.4, -6.5, 22.2] },
  { name: 'antR1', parent: 'head', at: [-0.4, -6.5, 22.2] },
  { name: 'tail1', parent: 'body', at: [0, 4.2, 8] },
  { name: 'tail2', parent: 'tail1', at: [0, 8.6, 7] },
  { name: 'tail3', parent: 'tail2', at: [0, 12.8, 6] },
];

function assign(c, rgb) {
  if (SPROUT.some((s) => near(rgb, s, 0.03))) {
    if (c[2] < 21.8) return 'head';                                      // the stem
    const l = petalD(c, LEAF[0][0], LEAF[0][1], LEAF[0][2]);
    const r = petalD(c, LEAF[1][0], LEAF[1][1], LEAF[1][2]);
    return l < r ? 'antR1' : 'antL1';
  }
  if (near(rgb, BROWN) || near(rgb, FACE) || near(rgb, INK)) return c[2] < 7.5 && Math.abs(c[0]) > 2.5 ? 'body' : 'head';
  const segs = SEGS.map(([, y, rz, rx, z]) => ell([rx, 4.6 + 2.4, rz], [0, y + 1.2, z])(c));
  const si = segs.indexOf(Math.min(...segs));
  return pick(c, [
    [SEG_OWNER[si], () => segs[si]],
    ['tail3', () => ell([4, 3.5, 4], [0, 18, 4])(c)],
    ['head', () => ell([7.5, 6.5, 7], [0, -5, 10])(c) * 1.05],
    ['body', () => Math.min(ell([10.5, 6, 11], [0, -6, 10.5])(c), ell([9, 4, 3.6], [0, -8.5, 3.8])(c))],
  ]);
}

const base = insectClips({ tail, legs: 0, ant: 1 });
// inching: the segments hump up from the back to the front, the head bobs
const inch = (u) => ({
  tail1: { r: [-6 * Math.max(0, osc(u, 1, 0.1)), 0, 0] },
  tail2: { r: [8 * Math.max(0, osc(u, 1, 0.2)), 0, 0] },
  tail3: { r: [-6 * Math.max(0, osc(u, 1, 0.3)), 0, 0] },
  body: { s: [1, 1 + 0.04 * osc(u, 1), 1 - 0.03 * osc(u, 1)] },
});

const clips = {
  ...base,
  walk: { ...base.walk, pose: (t, u) => merge(base.walk.pose(t, u), inch(u)) },
  // fidget: a big snore, the body swelling, the sprout leaves lifting on the breath, then a sleepy smack
  idle_snore: {
    seconds: 3,
    pose: (t, u) => {
      const br = K(u, [[0, 0], [0.45, 1], [0.6, 1], [0.8, 0]]);
      const smack = Math.sin(TAU * 4 * u) * win(u, 0.82, 0.98, 0.03);
      return merge(base.idle.pose(t, u), {
        body: { s: [1 + 0.05 * br, 1 + 0.03 * br, 1 + 0.06 * br] },
        head: { r: [-4 * br + 2 * smack, 0, 0] },
        antL1: { r: [0, -16 * br, 0] }, antR1: { r: [0, 16 * br, 0] },
      });
    },
  },
  // fidget: rolls over a little in its sleep and settles
  idle_roll: {
    seconds: 2.4,
    pose: (t, u) => {
      const r = K(u, [[0, 0], [0.3, 1], [0.6, 1], [0.9, 0]]);
      return merge(base.idle.pose(t, u), {
        body: { r: [0, 8 * r, 0] },
        head: { r: [0, 6 * r, 10 * r] },
        tail1: { r: [0, -4 * r, 0] },
      });
    },
  },
};

export default rigDef({ joints, assign, clips });
