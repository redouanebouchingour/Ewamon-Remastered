// Embrock's rig: a heavy stone monitor lizard on four thick splayed legs, a big raised head with a hinged lower jaw
// (the dark throat pouch hangs from it) and a flame at each front corner of the skull, and a tail rising behind it
// into a molten crescent. Numbers are scad/embrock.scad's; the head sits in its
// translate([-4, -13.5, 30]) rotate([-12, 0, -15]) scale(1.22) block (HEAD).
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, chain, ell, inFrame, limb, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { subFrame } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const ROCK = [0.42, 0.39, 0.35];
const HEAD = subFrame([-4, -13.5, 30], [-12, 0, -15], 1.22);

const eyeL = { side: 'L', at: [6.1, -4.6, 2.4], size: 1.7, yaw: 32, flat: 0.6, frame: HEAD };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: ROCK });

const TAIL = [[2, 13, 11], [6, 18, 8], [9.5, 20, 10], [10, 19, 14], [9, 17.5, 18], [7.5, 16.5, 21], [7.2, 16.8, 24.6],
  [8, 19.4, 27.2], [9.4, 22.6, 27.6], [10.6, 25.6, 26]];
const TAIL_R = [6.5, 5.2, 4.5, 3.9, 3.5, 3.2, 3.6, 3.1, 2.1, 0.6];
const tail = ['tail1', 'tail2', 'tail3', 'tail4'];
const LINKS = ['tail1', 'tail1', 'tail2', 'tail2', 'tail3', 'tail4', 'tail4', 'tail4', 'tail4'];

const FL = [[8, -8, 14], [11.8, -10, 8], [10.6, -12.6, 2.6]];
const FR = [[-8, -5.5, 14], [-12.4, -7.6, 8.6], [-12, -9.6, 2.6]];

const joints = [
  { name: 'root', at: [0, 2, 0] },
  { name: 'legFL', parent: 'root', at: FL[0] },
  { name: 'legFR', parent: 'root', at: FR[0] },
  { name: 'legBL', parent: 'root', at: [9, 9, 11.5] },
  { name: 'legBR', parent: 'root', at: [-9, 9, 11.5] },
  { name: 'body', parent: 'root', at: [0, 2, 11] },
  { name: 'head', parent: 'body', at: [-2.5, -11, 24] },
  { name: 'jaw', parent: 'head', at: HEAD.world([0, 4, -0.6]) },
  ...[0, 2, 4, 5].map((k, i) => ({ name: tail[i], parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[k] })),
  ...face.joints,
];

const foot = (p) => any(ell([3.4, 3.4, 1.7], [p[0], p[1] + 0.5, 1.3]), ell([5.8, 6.4, 1.8], [p[0], p[1] - 3, 0.8]));
const frontLeg = (L, f) => any(limb(L[0], L[1], 5.4, 4.3), limb(L[1], L[2], 4.3, 3.4), foot(f));
const parts = [
  ['legFL', frontLeg(FL, [10.6, -13.4])],
  ['legFR', frontLeg(FR, [-12, -10.4])],
  ['legB*', any(ell([4.6, 6.2, 6.6], [9, 9, 11.5]), limb([10, 8.5, 9], [12.2, 8, 5.6], 4.4, 3.8), limb([12.2, 8, 5.6], [11, 9.6, 2.6], 3.8, 3.2), foot([11, 9]))],
  ['body', any(ell([10, 8.5, 9.2], [-0.5, -5.5, 14.5]), ell([10, 9.5, 8.5], [0, 8, 12]), ell([7.6, 6.6, 4], [-0.5, -4, 8.6]), ell([8.2, 7.6, 3.8], [0, 8.5, 7.6]),
    ell([7.6, 6.4, 6.2], [-0.5, -7, 19]), ell([6.8, 5.6, 5.2], [-2.5, -11, 24]))],
  ['head', inFrame(HEAD, any(ell([7, 5.6, 4.6], [0, 3, 1.4]), ell([6.8, 4.6, 4.4], [0, -2.5, 1.6]), ell([5.4, 3, 3.5], [0, -8.6, 0.8]),
    limb([3.6, -8.4, 2.6], [3.9, -7.4, 9.5], 1.8, 0.8), limb([-3.6, -8.4, 2.6], [-3.9, -7.4, 9.5], 1.8, 0.8)))],
  ['jaw', inFrame(HEAD, any(ell([6.8, 5.2, 2.8], [0, 1.5, -2.4]), ell([4.6, 2.8, 1.9], [0, -8.4, -1.6]), ell([5.4, 5.2, 3.2], [0, -1, -4.2]),
    ell([3.8, 2.6, 2], [0, -6.5, -3.2]), ell([4.8, 3.6, 3], [0, 3.5, -5.6])))],
  ...chain(LINKS, TAIL, TAIL_R),
  ['tail4', ell([1.6, 1.6, 3.2], [11.3, 26.2, 22.4])],   // the embers dripping off the crescent's point
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
