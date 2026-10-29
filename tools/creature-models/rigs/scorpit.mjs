// Scorpit's rig: a small scorpion on four pairs of stumpy legs, the head-thorax shell carrying the big eyes (no
// separate head), pincers as claws, the abdomen segments, and a six-link tail arching over to the venom bulb (the
// insect template's stinger). Numbers are scad/scorpit.scad's.
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, blob, ell, limb, pick, spike } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { chainHit, ellD, fold, isAny, side } from './lib/geo.mjs';
import { insectClips } from './lib/insect.mjs';

const PURPLE = [0.42, 0.18, 0.5];
const BULB = [0.97, 0.96, 0.95];
const VENOM = [0.7, 0.9, 0.2];
const TAIL = [[0, 14, 7], [0, 18, 11], [0, 20, 17], [0, 19.5, 23], [0, 17, 28], [0, 12.5, 31.5], [0, 7, 33]];
const TAIL_R = [3.4, 3.6, 3.6, 3.5, 3.4, 3.2, 3.0];
const tail = ['tail1', 'tail2', 'tail3', 'tail4', 'tail5', 'tail6'];
const ARM = [[6, -6, 8], [12, -9, 7], [14.5, -13, 8.5]];

const eyeL = { side: 'L', at: [3.6, -12.1, 10.6], size: 3, yaw: -18 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], parent: 'body', skin: PURPLE });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...[0, 1, 2, 3].flatMap((i) => [
    { name: `leg${i + 1}L`, parent: 'root', at: [5.5, -4 + i * 4, 6] },
    { name: `leg${i + 1}R`, parent: 'root', at: [-5.5, -4 + i * 4, 6] },
  ]),
  { name: 'body', parent: 'root', at: [0, -2, 5] },
  { name: 'abdomen', parent: 'body', at: [0, 3.5, 7.5] },
  { name: 'clawL', parent: 'body', at: ARM[0] },
  { name: 'clawR', parent: 'body', at: [-ARM[0][0], ARM[0][1], ARM[0][2]] },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'abdomen' : tail[i - 1], at: TAIL[i] })),
  ...face.joints,
];

const parts = [
  ...[0, 1, 2, 3].map((i) => { const y = -4 + i * 4; return [`leg${i + 1}*`, any(limb([5.5, y, 6], [9.5, y + 0.5, 4.5], 1.4, 1.1),
    spike([9.6, y + 0.5, 4.6], [1, 0, -2], 1.1), spike([10.4, y + 0.5, 2.8], [0.6, 0, -2.6], 0.85))]; }),
  ['claw*', any(limb(ARM[0], ARM[1], 1.9, 1.6), limb(ARM[1], ARM[2], 1.6, 1.8), ell([6, 6, 6], [15.5, -15.5, 11.5]))],
  ['body', any(blob([[[9, 8, 7.5], [0, -5, 9.5]], [[7, 6, 5.4], [0, 1, 8]]]), ell([5.5, 4, 3], [0, -4, 15]),
    ell([4, 2.5, 4.4], [3.6, -11.6, 10.4]), ell([4, 2.5, 4.4], [-3.6, -11.6, 10.4]),
    limb([0, -6, 16.4], [0, -6.5, 19.6], 1), limb([-3, -9, 15], [-3.6, -10, 17.4], 0.8),
    ...[0, 1].map((i) => limb([2.4, 1 + i * 3.2, 11.6 - i * 0.4], [3, 1.4 + i * 3.2, 14.6 - i * 0.4], 0.9)),
    ...[0, 1].map((i) => limb([-2.4, 1 + i * 3.2, 11.6 - i * 0.4], [-3, 1.4 + i * 3.2, 14.6 - i * 0.4], 0.9)))],
  ['abdomen', any(...[0, 1, 2, 3].map((i) => ell([6.4 - i * 0.7, 2.8, 4.6 - i * 0.4], [0, 5 + i * 3.2, 7.4 - i * 0.2])),
    ...[2, 3].flatMap((i) => [1, -1].map((s) => limb([2.4 * s, 1 + i * 3.2, 11.6 - i * 0.4], [3 * s, 1.4 + i * 3.2, 14.6 - i * 0.4], 0.9))))],
];

function assign(c, rgb) {
  // the bulb, its venom and the stinger ride the last tail link
  if (isAny(rgb, [BULB, VENOM], 0.03) || ellD(c, [7.6, 7.2, 9], [0, 1, 28]) < 1) return 'tail6';
  const t = chainHit(c, TAIL, TAIL_R);
  if (t.d < 1.25 && (c[1] > 13 || c[2] > 16)) return tail[t.i];
  const f = fold(c);
  if (f[0] > 10.5 && f[1] < -8) return `claw${side(c)}`;
  return pick(c, parts);
}

const clips = insectClips({ face, legs: 4, tail, stinger: true, stride: 12, lift: 12 });

// fidget: snaps both pincers twice and waggles the stinger, pleased with itself
clips.idle_snap = {
  seconds: 2,
  pose: (t, u) => {
    const snap = Math.max(0, Math.sin(Math.PI * 2 * 2 * ((u - 0.1) / 0.5))) * win(u, 0.1, 0.6, 0.03);
    const wag = osc(u, 3) * win(u, 0.55, 0.95, 0.08);
    return merge({
      ...face.pose(snap > 0.5 ? 'happy' : 'open'),
      clawL: { r: [-14 * snap, -10 * snap, -12 * snap] },
      clawR: { r: [-14 * snap, 10 * snap, 12 * snap] },
      body: { r: [-3 * K(u, [[0, 0], [0.2, 1], [0.6, 1], [0.8, 0]]), 0, 0] },
    }, Object.fromEntries(tail.map((n, i) => [n, { r: [0, 0, 6 * wag * (1 + 0.2 * i)] }])));
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
