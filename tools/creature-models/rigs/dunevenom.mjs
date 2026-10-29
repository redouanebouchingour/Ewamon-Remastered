// Dunevenom's rig: Scorpit grown up, on four pairs of tall arched legs. The head-thorax carries the eyes (no separate
// head), heavy pincers (each in a block scaled 1.25 about the claw) are the claws, the banded abdomen, and a seven-link
// tail arching high and forward to the venom bulb (the insect template's stinger). Numbers are scad/dunevenom.scad's.
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, blob, ell, limb, pick, spike } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { chainHit, ellD, fold, isAny, side } from './lib/geo.mjs';
import { insectClips } from './lib/insect.mjs';

const GOLD = [0.85, 0.62, 0.25];
const BULB = [0.96, 0.94, 0.96];
const VENOM = [0.75, 0.88, 0.2];
const TAIL = [[0, 14, 12], [0, 19, 16], [0, 21, 22], [0, 20.5, 28], [0, 18, 33.5], [0, 13.5, 37], [0, 8, 37.5], [0, 4.5, 35]];
const TAIL_R = [3.6, 3.8, 3.8, 3.7, 3.5, 3.3, 3.0, 2.8];
const tail = ['tail1', 'tail2', 'tail3', 'tail4', 'tail5', 'tail6', 'tail7'];
const P = (p) => [14 + 1.25 * (p[0] - 14), -15 + 1.25 * (p[1] + 15), 10 + 1.25 * (p[2] - 10)];
const ARM = [[6, -7, 12], [12, -10, 13], [14, -15, 10]].map(P);
const LEG = (i) => { const y = -3 + i * 3.6; const yo = (i - 1.5) * 3; return [[6, y, 11], [12, y + yo * 0.6, 14], [16, y + yo, 6], [17.5, y + yo * 1.3, 0.5]]; };

const eyeL = { side: 'L', at: [3.4, -12.4, 13.6], size: 2.3, yaw: 8, flat: 0.4 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], parent: 'body', skin: GOLD });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...[0, 1, 2, 3].flatMap((i) => [
    { name: `leg${i + 1}L`, parent: 'root', at: LEG(i)[0] },
    { name: `leg${i + 1}R`, parent: 'root', at: [-LEG(i)[0][0], LEG(i)[0][1], LEG(i)[0][2]] },
  ]),
  { name: 'body', parent: 'root', at: [0, -2, 9] },
  { name: 'abdomen', parent: 'body', at: [0, 2.5, 13] },
  { name: 'clawL', parent: 'body', at: ARM[0] },
  { name: 'clawR', parent: 'body', at: [-ARM[0][0], ARM[0][1], ARM[0][2]] },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'abdomen' : tail[i - 1], at: TAIL[i] })),
  ...face.joints,
];

const legT = (i) => { const L = LEG(i); return any(limb(L[0], L[1], 1.6, 1.5), limb(L[1], L[2], 1.5, 1.2), limb(L[2], L[3], 1.2, 0.3), ell([1.8, 1.8, 1.8], L[1])); };
const parts = [
  ...[0, 1, 2, 3].map((i) => [`leg${i + 1}*`, legT(i)]),
  ['claw*', any(limb(ARM[0], ARM[1], 2.75, 2.6), limb(ARM[1], ARM[2], 2.6, 2.9), ell([5, 8, 4.5], P([14, -20, 7.5])))],
  ['body', any(blob([[[8.5, 7.5, 6], [0, -6, 13]], [[7.5, 6, 5.5], [0, 0, 13]]]), ell([6, 4.5, 2.6], [0, -5, 17.6]),
    spike([0, -8, 17.5], [0, -1.5, 4.5], 2.2), spike([4.6, -9, 16.5], [1.5, -1, 2.5], 1.2), spike([-4.6, -9, 16.5], [-1.5, -1, 2.5], 1.2),
    ell([3.5, 3, 3.5], [3.4, -12.4, 13.6]), ell([3.5, 3, 3.5], [-3.4, -12.4, 13.6]),
    limb([2.2, -12.5, 10.4], [1.4, -15, 8.6], 1), limb([-2.2, -12.5, 10.4], [-1.4, -15, 8.6], 1))],
  ['abdomen', any(...[0, 1, 2, 3].map((i) => ell([7 - i * 0.6, 2.2, 5.2 - i * 0.4], [0, 4 + i * 3.2, 13 - i * 0.3])))],
];

function assign(c, rgb) {
  if (isAny(rgb, [BULB, VENOM], 0.03) || ellD(c, [6, 6, 10], [0, 2.5, 28]) < 1) return 'tail7';
  const t = chainHit(c, TAIL, TAIL_R);
  if (t.d < 1.25 && (c[1] > 13 || c[2] > 19)) return tail[t.i];
  const f = fold(c);
  if (f[0] > 11 && f[1] < -11 && f[2] > 2.5) return `claw${side(c)}`;
  return pick(c, parts);
}

const clips = insectClips({ face, legs: 4, tail, stinger: true, stride: 10, lift: 10 });

// fidget: raises both pincers high and clacks them together over its head, the tail swaying like a cobra
clips.idle_clack = {
  seconds: 2.4,
  pose: (t, u) => {
    const up = K(u, [[0, 0], [0.2, 1], [0.7, 1], [0.85, 0]]);
    const clack = Math.max(0, osc(u, 4)) * win(u, 0.25, 0.68, 0.04);
    return merge({
      ...face.pose('open', clack > 0.8 ? 0.6 : 0),
      body: { r: [-4 * up, 0, 0] },
      clawL: { r: [-28 * up, -10 * up, -10 * clack] },
      clawR: { r: [-28 * up, 10 * up, 10 * clack] },
    }, Object.fromEntries(tail.map((n, i) => [n, { r: [0, 0, 4 * osc(u, 2, -0.1 * i) * (1 + 0.15 * i)] }])));
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
