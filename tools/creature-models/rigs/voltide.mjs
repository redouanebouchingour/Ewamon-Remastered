// Voltide's rig: a sleek electric anglerfish resting on its belly fins: a lower jaw, swept pectoral fins, a three-spike
// dorsal fin, a forked tail and an angler stalk arching forward to a crackling lure. Numbers are scad/voltide.scad's.
import { K, merge, osc, rigDef, win } from './lib/anim.mjs';
import { any, blob, ell, pair, petal, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { fishClips } from './lib/fish.mjs';
import { chainHit, ellD, near } from './lib/geo.mjs';

const NAVY = [0.08, 0.18, 0.45];
const YELLOW_HI = [1, 0.97, 0.65];

const STALK = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]
  .map((t) => [-2 * t, -4 - 15 * t, 25 + 9 * Math.sin(t * Math.PI) + 4 * t]);
const STALK_R = STALK.map((_, i) => 0.7 - i * 0.03);
const LURE = [-2, -19, 26.5];
const lure = ['lure1', 'lure2', 'lure3'];
const LURE_AT = [STALK[0], STALK[4], STALK[7]];
const fork = (s) => { const a = ((s * 40 - 10) * Math.PI) / 180; return [0, 17 + 4 * Math.cos(a), 15 + 4 * Math.sin(a)]; };

const eyeL = { side: 'L', at: [4.3, -12.5, 18.2], size: 2.7, yaw: 30, squash: 0.6 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], parent: 'body', skin: NAVY });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, -2, 10] },
  { name: 'jaw', parent: 'body', at: [0, -10, 13] },
  ...pair('fin*', 'body', [6.8, -1.5, 15]),
  ...pair('fin2*', 'body', [3.6, -2.5, 9]),
  { name: 'dorsal1', parent: 'body', at: [0, -3, 23] },
  { name: 'tail1', parent: 'body', at: [0, 12, 15] },
  { name: 'tail2', parent: 'tail1', at: [0, 16, 15] },
  ...lure.map((name, i) => ({ name, parent: i === 0 ? 'body' : lure[i - 1], at: LURE_AT[i] })),
  ...face.joints,
];

const parts = [
  ['body', any(blob([[[6.5, 9.5, 8.5], [0, -6, 17]], [[5.8, 7, 7], [0, 3, 16]], [[3, 4, 3.5], [0, 12, 15]]]),
    blob([[[5, 7, 3], [0, -6, 10.5]], [[4, 6, 2.5], [0, 3, 11]]]), petal([0.8, 2.6, 4.5], [0, 8, 8.5], [30, 0, 0]),
    ell([4, 3.5, 4], [4.3, -12.5, 18.2]), ell([4, 3.5, 4], [-4.3, -12.5, 18.2]))],
  ['jaw', any(blob([[[5, 3, 2], [0, -13, 12]], [[4, 2, 1.5], [0, -15, 12.5]]]), ell([4.4, 2.2, 0.5], [0, -14.5, 13.8]),
    ...[1.2, 3, -1.2, -3].map((x) => spike([x, -15.8, 13.4], [0, 0, 1.4], 0.4)))],
  ['fin*', any(petal([7.5, 3.5, 0.8], [9.5, -1, 15], [0, -15, 30]), petal([4, 1.6, 0.9], [12, 1.5, 15.7], [0, -15, 30]),
    ell([2, 1.2, 1.4], [6.8, -2, 15]))],
  ['fin2*', petal([1, 2.6, 4.8], [4, -3, 6], [25, 35, 0])],
  ['dorsal1', any(...[0, 1, 2].map((i) => petal([0.9, 4, 9 - i * 2], [0, -4 + i * 5, 24 - i * 1.5], [-45, 0, 0])))],
  ['tail1', ell([1, 2, 2], [0, 15, 15])],
  ['tail2', any(petal([0.9, 5.5, 2.4], fork(1), [30, 0, 0]), petal([0.9, 5.5, 2.4], fork(-1), [-50, 0, 0]))],
];

function assign(c, rgb) {
  if (near(rgb, YELLOW_HI) || ellD(c, [7.5, 7.5, 7.5], LURE) < 1) return 'lure3';
  const h = chainHit(c, STALK, STALK_R);
  if (h.d < 1.4 && c[2] > 24.5 && c[1] < -3) return lure[h.i < 4 ? 0 : h.i < 7 ? 1 : 2];
  return pick(c, parts);
}

const clips = fishClips({ face, tail: ['tail1', 'tail2'], dorsal: ['dorsal1'], lure, sweep: 12 });

// fidget: a charge builds (the fins shiver, the lure jitters), then a crackle runs down the body and the jaw snaps
clips.idle_charge = {
  seconds: 2.2,
  pose: (t, u) => {
    const build = K(u, [[0, 0], [0.55, 1], [0.62, 1], [0.7, 0]]);
    const zap = win(u, 0.6, 0.78, 0.03);
    const jit = osc(u, 22) * build;
    return merge({
      body: { r: [-3 * build, 2 * osc(u, 30) * zap, 0], s: 1 + 0.02 * zap },
      jaw: { r: [16 * zap, 0, 0] },
      ...face.pose(zap > 0.3 ? 'squeeze' : 'open', blinks(u, [[0.88, 0.93]])),
      finL: { r: [0, -6 * jit - 20 * zap, 0] },
      finR: { r: [0, 6 * jit + 20 * zap, 0] },
      lure3: { r: [8 * jit, 0, 10 * jit], s: 1 + 0.25 * zap },
      tail1: { r: [0, 0, 10 * osc(u, 8) * zap] },
    });
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
