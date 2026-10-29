// Trenchtusk's rig: a gunmetal siege boar on four plated piston legs, a ribbed armour dome, a lookout turret on the
// shoulders (its own joint: it swivels), a plated head with huge steel tusks and a piston tail. Its eyes are glowing
// slits, not lib.scad eye(), so it has no lids. Numbers are scad/trenchtusk.scad's (the pre-sprite-pass model: re-rig
// when its new model lands).
import { K, TAU, merge, rigDef, win } from './lib/anim.mjs';
import { any, box, ell, limb, pick } from './lib/biped.mjs';
import { chainHit } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const LEGS = [['F', -6], ['B', 8]];
const TUSK = [[3.4, -16.4, 9.6], [6.6, -20, 8.6], [9.4, -22.6, 11], [10.6, -23, 15], [10.4, -21.8, 19]];

const joints = [
  { name: 'root', at: [0, 1, 0] },
  ...LEGS.flatMap(([k, y]) => [{ name: `leg${k}L`, parent: 'root', at: [6, y, 11] }, { name: `leg${k}R`, parent: 'root', at: [-6, y, 11] }]),
  { name: 'body', parent: 'root', at: [0, 1, 12] },
  { name: 'turret', parent: 'body', at: [0, -5, 23] },
  { name: 'head', parent: 'body', at: [0, -8, 13] },
  { name: 'tail1', parent: 'body', at: [0, 12, 12] },
];

const legT = (y) => any(limb([6, y, 11], [6.4, y - 0.4, 3], 2.6, 2.4), box([5.4, 5.8, 6.4], [6.6, y - 0.4, 8.5]), box([5.8, 6.2, 1.6], [6.6, y - 0.4, 5.2]),
  box([5.6, 6.4, 3.4], [6.6, y - 1, 1.5]), box([4.6, 1.4, 1.8], [6.6, y - 4, 0.8]));
const parts = [
  ...LEGS.map(([k, y]) => [`leg${k}*`, legT(y)]),
  ['body', any(ell([11, 13, 10], [0, 1, 14]), box([2.6, 22, 12], [9.8, 1.5, 9]), box([2.6, 22, 12], [-9.8, 1.5, 9]))],
  ['turret', any(box([9, 9, 5.4], [0, -5, 25.5]), box([9, 9, 2.4], [0, -5, 28.6]), ell([3.2, 1.2, 1.2], [0, -8.9, 26]))],
  ['head', any(ell([6.4, 5.4, 5.6], [0, -11.5, 13.5]), ell([4.6, 4, 4], [0, -16, 11.4]), ell([5.6, 4.4, 2], [0, -12, 17.6]),
    ell([3, 2, 3], [0, -18.6, 10.6]), ell([1.6, 3.8, 4], [5.2, -12, 11.5]), ell([1.6, 3.8, 4], [-5.2, -12, 11.5]))],
  ['tail1', limb([0, 12, 12], [0, 16, 10], 1.6, 1.4)],
];

function assign(c) {
  const f = [Math.abs(c[0]), c[1], c[2]];
  if (chainHit(f, TUSK, [2.2, 2.1, 1.8, 1.3, 0.6]).d < 1.2) return 'head';
  // the plated legs sit under the flank skirt plates: inside a leg's plate column it is the leg
  for (const [k, y] of LEGS) if (Math.abs(f[0] - 6.6) <= 2.75 && Math.abs(c[1] - y + 0.4) <= 3.1 && c[2] < 11.7) return `leg${k}${c[0] >= 0 ? 'L' : 'R'}`;
  if (c[2] > 22.8 && c[1] < -0.6 && c[1] > -10 && Math.abs(c[0]) < 5) return 'turret';
  return pick(c, parts);
}

const clips = {
  ...quadrupedClips({ tail: ['tail1'], hipH: 11, stride: 10 }),

  // fidget: the turret scans the field in servo steps, left, then right, then snaps back
  idle_scan: {
    seconds: 3,
    pose: (t, u) => {
      const raw = K(u, [[0, 0], [0.12, 0], [0.3, 40], [0.5, 40], [0.7, -40], [0.85, -40], [0.95, 0]]);
      const step = Math.round(raw / 8) * 8;
      return merge({
        turret: { r: [0, 0, step] },
        head: { r: [0, 0, step * 0.15] },
      });
    },
  },

  // fidget: vents the piston tail with a shudder of the whole frame
  idle_vent: {
    seconds: 1.8,
    pose: (t, u) => {
      const v = win(u, 0.2, 0.6, 0.05);
      const sh = Math.sin(TAU * 12 * u) * v;
      return merge({
        body: { r: [0, 1.2 * sh, 0], p: [0, 0, 0.15 * sh] },
        tail1: { r: [24 * v, 0, 0], s: 1 + 0.1 * v },
        turret: { r: [0, 0, 2 * sh], p: [0, 0, 0.3 * v] },
        head: { r: [-4 * v, 0, 0] },
      });
    },
  },
};

export default rigDef({ joints, assign, clips });
