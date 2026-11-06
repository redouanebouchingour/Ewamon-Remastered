// Shagtusk's rig: a heavy woolly mammoth on four short pillar legs, the big low head with its snow cap at the front, a
// short thick trunk (a three-link chain passed as the template's mane) between two ice-crystal tusks, ice spikes down
// the snowy spine and a stub tail with an ice tip. Numbers are scad/shagtusk.scad's (the 2026-11-04 sprite-match model).
// The template's sniff dips the head 24 deg, which would drive the trunk into the ground, so it is left out.
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, ell, limb, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { chainHit, isAny, near } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const FACE = [0.56, 0.39, 0.21];
const ICE = [[0.5, 0.82, 0.93], [0.3, 0.62, 0.84]];
const ROOT = [0.86, 0.94, 0.94];
const NAIL = [0.66, 0.82, 0.85];
const SNOW = [0.75, 0.91, 0.92];

const B = [[[0, -3, 20.5], [12, 10, 12]], [[0, 5, 19], [12, 9, 11]], [[0, 12, 15.5], [12, 11, 10]]];
const H = [[0, -12, 21.3], [11, 8, 10]];
const M = [[0, -16, 15], [6, 4.5, 5]];
const TRUNK = [[0, -18.8, 15.8], [0, -19.9, 12.6], [0, -20.3, 9.8], [0, -20.6, 7.6], [0, -21.4, 6.5]];
const TRUNK_R = [2.9, 2.7, 2.4, 2.1, 1.7];
const trunk = ['trunk1', 'trunk2', 'trunk3'];
const LEGS = [['F', 7.5, -7.5], ['B', 7.5, 12]];

const eyeL = { side: 'L', at: [5.6, -18.1, 19.3], size: 2.6, yaw: 22, flat: 0.5 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FACE });

const joints = [
  { name: 'root', at: [0, 2, 0] },
  ...LEGS.flatMap(([k, x, y]) => [{ name: `leg${k}L`, parent: 'root', at: [x, y, 10] }, { name: `leg${k}R`, parent: 'root', at: [-x, y, 10] }]),
  { name: 'body', parent: 'root', at: [0, 3, 12] },
  { name: 'head', parent: 'body', at: [0, -9, 18] },
  ...trunk.map((name, i) => ({ name, parent: i === 0 ? 'head' : trunk[i - 1], at: TRUNK[i] })),
  { name: 'tail1', parent: 'body', at: [0, 20, 19] },
  ...face.joints,
];

const grow = ([c, r], g) => ell(r.map((v) => v + g), c);
const legT = (x, y) => any(limb([x, y, 10], [x, y, 4.4], 4, 4.2), ell([4.4, 4.4, 2.2], [x, y, 2.2]), ell([5.6, 5.6, 3.6], [x, y, 7.4]));
const parts = [
  ...LEGS.map(([k, x, y]) => [`leg${k}*`, legT(x, y)]),
  ['body', any(...B.map((e) => grow(e, 1.2)))],
  ['head', any(grow(H, 1.3), grow(M, 0.5), ell([6, 5, 3.6], [0, -12.5, 31]))],
  ['tail1', any(limb([0, 20, 19], [0, 25, 15.5], 1.7, 1.2), limb([0, 25, 15.5], [0, 29, 11.4], 1.6, 0.3))],
];
const legOf = (c) => `leg${c[1] < 2.25 ? 'F' : 'B'}${c[0] >= 0 ? 'L' : 'R'}`;

function assign(c, rgb) {
  if (near(rgb, NAIL, 0.03) && c[2] < 2.4) return legOf(c);
  if (near(rgb, ROOT, 0.03)) return 'head';                                  // the tusk roots
  if (isAny(rgb, ICE, 0.03)) {
    if (c[1] < -17) return 'head';                                           // the tusk crystals
    if (c[1] > 23 && c[2] < 17) return 'tail1';
    return 'body';                                                           // the spine spikes
  }
  if (near(rgb, SNOW, 0.03) && c[2] > 20) return pick(c, parts.slice(2, 4));
  const t = chainHit(c, TRUNK, TRUNK_R);
  if (t.d < 1.25 && c[2] < 16 && Math.abs(c[0]) < 4) return trunk[Math.min(2, t.i)];
  return pick(c, parts);
}

const curl = (k) => Object.fromEntries(trunk.map((n, i) => [n, { r: [-k * (0.6 + 0.4 * i), 0, 0] }]));
const base = quadrupedClips({
  face, tail: ['tail1'], mane: trunk, hipH: 10, stride: 10,
  add: {
    lunge: (t, u) => curl(30 * K(u, [[0.15, 0], [0.4, 1], [0.6, 1], [1, 0]])),
    faint: (t, u) => curl(24 * smooth((u - 0.15) / 0.6)),
    celebrate: (t, u) => curl(30 * win(u, 0, 1, 0.15)),
  },
});
delete base.idle_sniff;

const clips = {
  ...base,

  // fidget: blows a snort of frost through the trunk, curling it up, then shakes the snow off its head
  idle_snort: {
    seconds: 2.4,
    pose: (t, u) => {
      const up = K(u, [[0, 0], [0.2, 1], [0.45, 1], [0.6, 0]]);
      const sh = Math.sin(TAU * 7 * u) * win(u, 0.6, 0.92, 0.04);
      return merge({
        head: { r: [-6 * up, -10 * sh, 4 * sh] },
        body: { r: [0, 3 * sh, 0] },
        ...curl(40 * up + 6 * osc(u, 10) * up),
        ...face.pose(up > 0.5 || Math.abs(sh) > 0.3 ? 'shut' : 'open', blinks(u, [[0.94, 0.98]])),
      });
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
