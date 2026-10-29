// Wraithtide's rig: a ghost fish hovering on a column of smoke. The fish is built turned (yaw -75) at z 22, a skull for
// a face (its jaw moves), ragged pectoral, dorsal and tail fins, and the smoke under it a three-link wisp chain down to
// the curl touching the ground. The skull's eyes are flames, not eye(): no face kit. Numbers are scad/wraithtide.scad's.
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { fishClips } from './lib/fish.mjs';
import { chainHit, ellD, isAny, subFrame } from './lib/geo.mjs';

const BONES = [[0.88, 0.86, 0.78], [0.62, 0.6, 0.54], [0.12, 0.16, 0.17], [0.3, 1, 0.85], [0.8, 1, 0.95]];
const GLOWS = [[0.3, 1, 0.85], [0.8, 1, 0.95]];
const SMOKES = [[0.33, 0.37, 0.4], [0.22, 0.25, 0.28]];
const TEAL_DK = [0.18, 0.44, 0.45];

const fishF = subFrame([0, 0, 22], [0, 0, -75]);
const skullF = subFrame([-1.5, -7.6, 22.5], [0, 0, -12], 1.15);
const ROT = [0, 0, -75];
const SMOKE = [[0.5, 0, 6], [3, -0.5, 3.8], [2, -1, 1.6], [-1, -1.5, 0.8], [-2.5, -1.5, 1.6]];
const SMOKE_R = [2.6, 1.9, 1.3, 0.8, 0.4];
const wisp = ['wisp1', 'wisp2', 'wisp3'];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 16] },
  { name: 'head', parent: 'body', at: skullF.world([0, 0, 0]) },
  { name: 'jaw', parent: 'head', at: skullF.world([0, 0.4, -1.6]), rot: [0, 0, -12] },
  { name: 'finL', parent: 'body', at: fishF.world([6.5, 2, -3]), rot: ROT },
  { name: 'finR', parent: 'body', at: fishF.world([-6.5, 2, -3]), rot: ROT },
  { name: 'dorsal1', parent: 'body', at: fishF.world([0, 0, 8]), rot: ROT },
  { name: 'tail1', parent: 'body', at: fishF.world([0, 9, 0.8]), rot: ROT },
  { name: 'tail2', parent: 'tail1', at: fishF.world([0, 14, 1]), rot: ROT },
  { name: 'wisp1', parent: 'body', at: [0, 1, 15] },
  { name: 'wisp2', parent: 'wisp1', at: SMOKE[0] },
  { name: 'wisp3', parent: 'wisp2', at: SMOKE[2] },
];

function assign(c, rgb) {
  if (isAny(rgb, BONES, 0.03)) {
    const q = skullF.local(c);
    return q[2] < -2.2 && !isAny(rgb, GLOWS, 0.03) ? 'jaw' : 'head';
  }
  if (isAny(rgb, SMOKES, 0.03)) {
    const h = chainHit(c, SMOKE, SMOKE_R);
    if (c[2] > 8 || h.d > 1.3) return 'wisp1';
    return h.i < 2 ? 'wisp2' : 'wisp3';
  }
  if (isAny(rgb, [TEAL_DK], 0.03) && ellD(c, [8.6, 8.1, 3.8], [0, 1, 16]) < 1.1) return 'body';
  const q = fishF.local(c);
  if (q[1] > 12.5) return 'tail2';
  if (q[1] > 9) return 'tail1';
  if (q[2] > 7.6 && Math.abs(q[0]) < 2) return 'dorsal1';
  if (Math.abs(q[0]) > 5.8 && q[2] < -1.5) return q[0] > 0 ? 'finL' : 'finR';
  return 'body';
}

const clips = fishClips({ tail: ['tail1', 'tail2'], dorsal: ['dorsal1'], wisp, hover: true, sweep: 10 });

// fidget: the skull's jaw chatters while the fish shudders, the smoke billowing
clips.idle_chatter = {
  seconds: 1.8,
  pose: (t, u) => {
    const on = win(u, 0.1, 0.8, 0.08);
    return merge({
      root: { p: [0, 0, 0.6 * osc(u, 1)] },
      body: { r: [0, 2 * osc(u, 14) * on, 0] },
      head: { r: [-6 * on, 0, 4 * on] },
      jaw: { r: [(10 + 8 * osc(u, 10)) * on, 0, 0] },
      wisp1: { s: 1 + 0.05 * K(u, [[0, 0], [0.4, 1], [1, 0]]) },
      wisp2: { r: [6 * osc(u, 2) * on, 0, 10 * osc(u, 2, 0.2) * on] },
    });
  },
};

export default rigDef({ joints, assign, clips });
