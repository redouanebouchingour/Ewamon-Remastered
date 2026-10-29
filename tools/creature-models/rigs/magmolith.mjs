// Magmolith's rig: a hulking basalt saurian on four splayed legs, a long crocodilian head with a hinged lower jaw, a
// ridge of stone blades down its back and a tail rising in an S to a hook dripping lava. Numbers are
// scad/magmolith.scad's; the head sits in its translate([0, -12, 25.5]) rotate([-4, 0, 0]) scale(1.3) block (HEAD).
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, chain, ell, inFrame, limb, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { subFrame } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const ROCK = [0.4, 0.38, 0.34];
const HEAD = subFrame([0, -12, 25.5], [-4, 0, 0], 1.3);

const eyeL = { side: 'L', at: [4.2, -6.9, 2], size: 2.5, yaw: 12, flat: 0.55, frame: HEAD };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: ROCK });

const TAIL = [[0, 16, 11], [3, 22, 8], [10, 24.5, 9], [15.5, 22.5, 13.5], [17, 19, 19], [16.5, 16, 25], [15.5, 13, 30],
  [14.2, 10, 32.6], [12.4, 7, 32.4], [11.4, 5.2, 30.2]];
const TAIL_R = [6.4, 5.4, 4.6, 3.9, 3.4, 3, 2.7, 2.5, 2.1, 1.5];
const tail = ['tail1', 'tail2', 'tail3', 'tail4'];
const LINKS = ['tail1', 'tail1', 'tail2', 'tail2', 'tail3', 'tail3', 'tail4', 'tail4', 'tail4'];

const joints = [
  { name: 'root', at: [0, 2, 0] },
  { name: 'legFL', parent: 'root', at: [7, -4, 15] },
  { name: 'legFR', parent: 'root', at: [-7, -4, 15] },
  { name: 'legBL', parent: 'root', at: [8.4, 10, 12] },
  { name: 'legBR', parent: 'root', at: [-8.4, 10, 12] },
  { name: 'body', parent: 'root', at: [0, 2, 12] },
  { name: 'head', parent: 'body', at: [0, -9.5, 23.5] },
  { name: 'jaw', parent: 'head', at: HEAD.world([0, 3, -0.6]) },
  ...[0, 2, 4, 6].map((k, i) => ({ name: tail[i], parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[k] })),
  ...face.joints,
];

const foot = (p) => any(ell([3.5, 3.5, 1.6], [p[0], p[1] + 0.5, 1.3]), ell([5.8, 6.4, 1.8], [p[0], p[1] - 3, 0.8]));
const parts = [
  ['legF*', any(limb([7, -4, 15], [12, -5.5, 9], 4.8, 3.9), limb([12, -5.5, 9], [11.8, -7.5, 2.6], 3.9, 3.2), foot([12, -8.2]))],
  ['legB*', any(ell([4.4, 6, 6.2], [8.4, 10, 12]), limb([9.6, 9, 10], [12.4, 8.5, 6], 4.4, 3.5), limb([12.4, 8.5, 6], [11.8, 9.4, 2.4], 3.5, 2.9), foot([12, 8]))],
  ['body', any(ell([9.6, 8, 9.6], [0, -4, 15.5]), ell([9.6, 9, 8.4], [0, 8, 12.5]), ell([7.2, 6, 4.4], [0, -3, 9.5]), ell([7.8, 7.4, 3.8], [0, 9, 8]),
    ell([8, 6.4, 7], [0, -5, 20]), ell([7.4, 5.4, 5.4], [0, -9.5, 23.5]), ell([5.4, 4, 2.6], [0, -14, 20.6]),
    limb([0, -5, 29], [0, 8, 27], 4), limb([0, 8, 27], [0, 16, 20], 3.5))],
  ['head', inFrame(HEAD, any(ell([6.6, 5, 3.8], [0, 2, 1.2]), ell([5.8, 4.4, 3], [0, -5, 1]), ell([4.4, 2.4, 2.3], [0, -12, 0.2]),
    limb([3.4, 3.6, 3.6], [4.4, 6, 5.6], 1.6), limb([-3.4, 3.6, 3.6], [-4.4, 6, 5.6], 1.6)))],
  ['jaw', inFrame(HEAD, any(ell([6.2, 4.6, 2.6], [0, 0, -2.4]), ell([4.2, 2.4, 1.5], [0, -10.6, -1.6])))],
  ...chain(LINKS, TAIL, TAIL_R),
];

function assign(c) {
  const j = pick(c, parts);
  if (j === 'head' || j === 'jaw') return HEAD.local(c)[2] < -0.9 ? 'jaw' : 'head';
  return j;
}

const clips = quadrupedClips({ face, tail, hipH: 14, stride: 10 });

// fidget: two lazy crocodile snaps, then a puff of the chest that sets the hook's drips swinging
clips.idle_snap = {
  seconds: 2.6,
  pose: (t, u) => {
    const snap = (u0) => K(u, [[u0, 0], [u0 + 0.1, 1], [u0 + 0.15, 0]]);
    const s = snap(0.15) + snap(0.42);
    const puff = win(u, 0.65, 0.92, 0.06);
    return merge({
      head: { r: [-6 * s + 2 * osc(u, 2), 0, 0] },
      jaw: { r: [26 * s, 0, 0] },
      body: { s: [1 + 0.04 * puff, 1 + 0.02 * puff, 1 + 0.04 * puff] },
      ...face.pose('open', 0.3 * s),
    }, Object.fromEntries(tail.map((n, i) => [n, { r: [0, 0, 5 * puff * (1 + 0.3 * i) * osc(u, 4)] }])));
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
