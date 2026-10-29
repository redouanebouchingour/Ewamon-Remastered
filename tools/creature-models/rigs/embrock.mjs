// Embrock's rig: a squat basalt lizard on four splayed legs, a raised monitor head with a hinged lower jaw and brow
// flames, and a tail curling up into a molten crescent. Numbers are scad/embrock.scad's; the head sits in its
// translate([0, -10.5, 26.8]) rotate([-12, 0, 0]) scale(1.22) block (HEAD).
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, chain, ell, inFrame, limb, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { subFrame } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const ROCK = [0.4, 0.38, 0.34];
const HEAD = subFrame([0, -10.5, 26.8], [-12, 0, 0], 1.22);

const eyeL = { side: 'L', at: [4.3, -6.6, 2], size: 2.3, yaw: 12, flat: 0.55, frame: HEAD };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: ROCK });

const TAIL = [[0, 14, 10], [3, 19.5, 7.5], [9, 22, 8], [13.5, 20.5, 12.5], [15, 17.5, 18], [14.8, 14.5, 23], [14.2, 12.4, 27],
  [13, 9.4, 29], [11.4, 6.8, 28.4], [10.4, 5.4, 26.4]];
const TAIL_R = [6, 5, 4.2, 3.5, 3, 2.6, 3, 2.8, 1.9, 0.6];
const tail = ['tail1', 'tail2', 'tail3', 'tail4'];
const LINKS = ['tail1', 'tail1', 'tail2', 'tail2', 'tail3', 'tail4', 'tail4', 'tail4', 'tail4'];

const joints = [
  { name: 'root', at: [0, 2, 0] },
  { name: 'legFL', parent: 'root', at: [6.5, -4, 14] },
  { name: 'legFR', parent: 'root', at: [-6.5, -4, 14] },
  { name: 'legBL', parent: 'root', at: [7.8, 9, 11] },
  { name: 'legBR', parent: 'root', at: [-7.8, 9, 11] },
  { name: 'body', parent: 'root', at: [0, 2, 11] },
  { name: 'head', parent: 'body', at: [0, -7.5, 24] },
  { name: 'jaw', parent: 'head', at: HEAD.world([0, 3, -0.6]) },
  ...[0, 2, 4, 5].map((k, i) => ({ name: tail[i], parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[k] })),
  ...face.joints,
];

const foot = (p) => any(ell([3.2, 3.2, 1.5], [p[0], p[1] + 0.5, 1.2]), ell([5.3, 5.8, 1.7], [p[0], p[1] - 2.8, 0.8]));
const parts = [
  ['legF*', any(limb([6.5, -4, 14], [10.8, -5.5, 8.5], 4.2, 3.4), limb([10.8, -5.5, 8.5], [10.6, -7.5, 2.4], 3.4, 2.8), foot([10.8, -8]))],
  ['legB*', any(ell([4, 5.4, 5.6], [7.8, 9, 11]), limb([9, 8, 9], [11.4, 7.5, 5.5], 4, 3.2), limb([11.4, 7.5, 5.5], [10.8, 8.4, 2.2], 3.2, 2.6), foot([11, 7.2]))],
  ['body', any(ell([8.6, 7.2, 8.6], [0, -4.5, 14]), ell([9, 8.5, 7.6], [0, 7, 11.5]), ell([6.6, 5.6, 4], [0, -3, 9]), ell([7.4, 7, 3.4], [0, 8, 7.5]),
    ell([7.4, 6, 6], [0, -4, 19]), ell([7, 5.4, 5], [0, -7.5, 24]), ell([4.6, 3, 2.4], [0, -10.6, 19.6]), ell([5.6, 4, 2.6], [0, -12.6, 22.4]))],
  ['head', inFrame(HEAD, any(ell([6.6, 5, 3.8], [0, 1.5, 1]), ell([6, 4, 3], [0, -5, 1]), ell([4.4, 2.2, 2.3], [0, -9.4, 0.2]),
    limb([4, 1, 3.4], [4.6, 1.8, 9.9], 1.8, 0.4), limb([-4, 1, 3.4], [-4.6, 1.8, 9.9], 1.8, 0.4)))],
  ['jaw', inFrame(HEAD, any(ell([6.2, 4.6, 2.6], [0, -0.5, -2.4]), ell([4.2, 2.4, 1.5], [0, -8.2, -1.6])))],
  ...chain(LINKS, TAIL, TAIL_R),
];

function assign(c) {
  const j = pick(c, parts);
  if (j === 'head' || j === 'jaw') return HEAD.local(c)[2] < -0.9 ? 'jaw' : 'head';
  return j;
}

const clips = quadrupedClips({ face, tail, hipH: 13, stride: 11 });

// fidget: two snaps at a passing ember, then a puff of the chest that sets the molten tip swinging
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
