// Shagtusk's rig: a heavy woolly mammoth bean on four pillar legs, the big low head merged into the front, a short
// thick trunk (a three-link chain passed as the template's mane), ice tusks, ice spikes down the spine. Numbers are
// scad/shagtusk.scad's (the pre-sprite-pass model: re-rig when its new model lands); the face block sits 1.5 back (fy).
// The template's sniff dips the head 24 deg, which would drive the trunk into the ground, so it is left out.
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { any, ell, limb, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { chainHit, isAny, near } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const FUR_DEEP = [0.3, 0.17, 0.08];
const ICE = [[0.6, 0.82, 0.97], [0.4, 0.62, 0.88]];
const SNOW = [0.78, 0.9, 0.97];
const NAIL = [0.8, 0.9, 0.96];
const fy = ([x, y, z]) => [x, y - 1.5, z];

const TRUNK = [[0, -16.6, 11.5], [0, -18.6, 7.6], [0, -19.4, 4.6], [0, -20.4, 2.6], [0, -21.8, 3]].map(fy);
const TRUNK_R = [3.5, 3.1, 2.6, 2.1, 1.6];
const trunk = ['trunk1', 'trunk2', 'trunk3'];
const LEGS = [['F', 6.6, -4], ['B', 6.4, 10.5]];

const eyeL = { side: 'L', at: fy([4, -16, 15]), size: 2, yaw: 10, flat: 0.55 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: FUR_DEEP });

const joints = [
  { name: 'root', at: [0, 3, 0] },
  ...LEGS.flatMap(([k, x, y]) => [{ name: `leg${k}L`, parent: 'root', at: [x, y, 9] }, { name: `leg${k}R`, parent: 'root', at: [-x, y, 9] }]),
  { name: 'body', parent: 'root', at: [0, 3, 10] },
  { name: 'head', parent: 'body', at: [0, -8, 15] },
  ...trunk.map((name, i) => ({ name, parent: i === 0 ? 'head' : trunk[i - 1], at: TRUNK[i] })),
  { name: 'tail1', parent: 'body', at: [0, 16, 15] },
  ...face.joints,
];

const legT = (x, y) => any(limb([x, y, 9], [x, y, 2.2], 3.9, 3.7), ell([5, 5, 3.2], [x, y, 5.6]), ell([3.2, 1.3, 1.1], [x, y - 3.3, 1]));
const parts = [
  ...LEGS.map(([k, x, y]) => [`leg${k}*`, legT(x, y)]),
  ['body', any(ell([13, 11, 12], [0, -2, 17]), ell([12, 10.5, 10.5], [0, 9, 13.5]), ell([12.5, 13, 7.5], [0, 3, 10]))],
  ['head', any(ell([10.4, 8.8, 9.8], [0, -11.5, 15.5]), ell([6.4, 4.2, 6.4], fy([0, -14.9, 13])))],
  ['tail1', any(limb([0, 16, 15], [0, 20.5, 11.5], 1.1, 0.8), spike([0, 20.5, 11.5], [0, 2.6, -1.6], 1.2))],
];
const legOf = (c) => `leg${c[1] < 3 ? 'F' : 'B'}${c[0] >= 0 ? 'L' : 'R'}`;

function assign(c, rgb) {
  if (near(rgb, NAIL, 0.02) && c[2] < 2.3) return legOf(c);
  if (isAny(rgb, ICE, 0.03)) {
    if (c[2] > 25) return 'body';                                            // the spine spikes
    if (c[1] > 19) return 'tail1';
    return 'head';                                                           // the tusks
  }
  if (near(rgb, SNOW, 0.02) && c[2] > 21) return c[1] < -9 ? 'head' : 'body';
  const t = chainHit(c, TRUNK, TRUNK_R);
  if (t.d < 1.25 && c[2] < 11 && Math.abs(c[0]) < 4) return trunk[Math.min(2, t.i)];
  return pick(c, parts);
}

const curl = (k) => Object.fromEntries(trunk.map((n, i) => [n, { r: [-k * (0.6 + 0.4 * i), 0, 0] }]));
const base = quadrupedClips({
  face, tail: ['tail1'], mane: trunk, hipH: 9, stride: 10,
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
