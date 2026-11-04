// Magmolith's rig: a hulking stone kaiju iguana standing high on four thick legs, a compact blocky head turned to its
// right on a short neck with a hinged squared jaw, a row of tall stone spikes down its back and a tail rising in an S
// to a molten hook dripping lava. Numbers are scad/magmolith.scad's; the head sits in its
// translate([-4.6, -18, 27]) rotate([-2, 0, -40]) scale(1.12) block (HEAD).
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, box, chain, ell, inFrame, limb, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { subFrame } from './lib/geo.mjs';
import { quadrupedClips } from './lib/quadruped.mjs';

const ROCK = [0.41, 0.38, 0.34];
const HEAD = subFrame([-4.6, -18, 27], [-2, 0, -40], 1.12);

const eyeL = { side: 'L', at: [5.5, -2.6, 4.6], size: 1.35, yaw: 62, flat: 0.6, frame: HEAD };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: ROCK });

const TAIL = [[2, 18, 14], [5.2, 22.5, 13], [6.6, 22, 16.4], [4.4, 21, 20.4], [2.2, 20, 23.8], [1, 19.5, 26.8], [2, 20, 29.9],
  [5.2, 21, 31], [7.9, 22, 29.5], [8.9, 22.5, 27.1]];
const TAIL_R = [5.6, 4.7, 4.3, 4, 3.5, 3, 2.7, 2.5, 2.2, 1.6];
const tail = ['tail1', 'tail2', 'tail3', 'tail4'];
const LINKS = ['tail1', 'tail1', 'tail2', 'tail2', 'tail3', 'tail3', 'tail4', 'tail4', 'tail4'];

const FL = [[8.6, -10, 16], [11.6, -9.4, 9], [10.2, -13.4, 3.2]];
const FR = [[-8.6, -12, 16], [-11.8, -13.6, 9], [-11.4, -18, 3.2]];
const HIP = [9, 11, 12];

const joints = [
  { name: 'root', at: [0, 2, 0] },
  { name: 'legFL', parent: 'root', at: FL[0] },
  { name: 'legFR', parent: 'root', at: FR[0] },
  { name: 'legBL', parent: 'root', at: HIP },
  { name: 'legBR', parent: 'root', at: [-HIP[0], HIP[1], HIP[2]] },
  { name: 'body', parent: 'root', at: [0, 2, 12] },
  { name: 'head', parent: 'body', at: [-3.5, -15.5, 27.5] },
  { name: 'jaw', parent: 'head', at: HEAD.world([0, 3, -0.6]) },
  ...[0, 2, 4, 6].map((k, i) => ({ name: tail[i], parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[k] })),
  ...face.joints,
];

const foot = (p) => any(ell([4.2, 4, 2], [p[0], p[1] + 0.5, 1.5]), ell([6.6, 7.2, 2], [p[0], p[1] - 3.4, 0.9]));
const parts = [
  ['legFL', any(limb(FL[0], FL[1], 7.4, 5.6), limb(FL[1], FL[2], 5.6, 4.8), foot([10.2, -14.4]))],
  ['legFR', any(limb(FR[0], FR[1], 7.4, 5.6), limb(FR[1], FR[2], 5.6, 4.8), foot([-11.4, -19]))],
  ['legB*', any(ell([5.6, 7.2, 7.6], HIP), limb([10, 11.6, 8.6], [11.4, 12.6, 5.2], 5.6, 5), limb([11.4, 12.6, 5.2], [10.6, 11.4, 3], 5, 4.4),
    foot([10.6, 11]))],
  ['body', any(ell([11.5, 9.5, 11], [0, -7, 19]), ell([10.5, 9.5, 9.2], [0, 11, 13]), ell([8.8, 7.6, 4], [0, -5, 10]),
    ell([8.6, 8, 3.6], [0, 11, 6.6]), ell([9.5, 8, 8.2], [0, -11, 24]), ell([8, 6.8, 7], [-3.5, -15.5, 27.5]),
    // the dorsal spikes
    limb([0, -6.5, 29.3], [0, -4.5, 36.6], 2.6), limb([0, 0, 26.4], [0, 2.5, 33.2], 2.8), limb([0, 5, 24.2], [0, 7.5, 34], 3.2),
    limb([0, 11, 21.4], [0, 13.4, 28.5], 2.8), limb([0, 15, 19.8], [0, 17, 24.8], 2.2), limb([0, 18.5, 17.4], [0, 20.2, 21.4], 1.6),
    limb([4.6, -8, 27.4], [6, -6, 33.8], 2), limb([4.6, -2, 25.8], [6, 0, 32.7], 2), limb([4.6, 5, 23.2], [6, 7, 30.1], 2),
    limb([-4.6, -8, 27.4], [-6, -6, 33.8], 2), limb([-4.6, -2, 25.8], [-6, 0, 32.7], 2), limb([-4.6, 5, 23.2], [-6, 7, 30.1], 2))],
  ['head', inFrame(HEAD, any(box([12.8, 10.8, 12.4], [0, 2.4, 4.2]), box([10, 9.6, 7.6], [0, -6.2, 2])))],
  ['jaw', inFrame(HEAD, any(box([12, 8.4, 4.6], [0, 2, -2.6]), box([9.2, 6.4, 3.6], [0, -7.2, -2.2]), ell([5.4, 5, 2.6], [0, 1.5, -4.4]),
    ell([5, 3.8, 2.6], [0, 5.5, -5.8])))],
  ...chain(LINKS, TAIL, TAIL_R),
  // the lava drips hanging from the hook
  ['tail4', any(ell([1.3, 1.3, 2.4], [3.6, 20.5, 26.4]), ell([1.4, 1.4, 2.6], [5.3, 21.1, 26.4]), ell([1.2, 1.2, 1.6], [8.9, 22.5, 25.2]))],
];

function assign(c) {
  const j = pick(c, parts);
  if (j === 'head' || j === 'jaw') return HEAD.local(c)[2] < -0.9 ? 'jaw' : 'head';
  return j;
}

const clips = quadrupedClips({ face, tail, hipH: 14, stride: 9 });

// fidget: two lazy kaiju snaps, then a puff of the chest that sets the molten hook's drips swinging
clips.idle_snap = {
  seconds: 2.6,
  pose: (t, u) => {
    const snap = (u0) => K(u, [[u0, 0], [u0 + 0.1, 1], [u0 + 0.15, 0]]);
    const s = snap(0.15) + snap(0.42);
    const puff = win(u, 0.65, 0.92, 0.06);
    return merge({
      head: { r: [-6 * s + 2 * osc(u, 2), 0, 0] },
      jaw: { r: [24 * s, 0, 0] },
      body: { s: [1 + 0.04 * puff, 1 + 0.02 * puff, 1 + 0.04 * puff] },
      ...face.pose('open', 0.3 * s),
    }, Object.fromEntries(tail.map((n, i) => [n, { r: [0, 0, 5 * puff * (1 + 0.3 * i) * osc(u, 4)] }])));
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
