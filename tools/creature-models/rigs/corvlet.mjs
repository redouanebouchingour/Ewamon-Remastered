// Corvlet's rig: a round raven chick under a big hood, a gold ring hanging from its beak, purple-tipped wings and a few
// loose feathers drifting round it. Numbers are scad/corvlet.scad's (the pre sprite-accuracy model: re-rig when its
// new model lands).
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { any, blob, ell, limb, pair, petal, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { ellD, near } from './lib/geo.mjs';

const BLACK = [0.13, 0.12, 0.15];
const GOLD = [[0.95, 0.72, 0.18], [0.7, 0.48, 0.1]];
const LOOSE = [[[-14, -2, 22], 3.3], [[14, 0, 21], 3.3], [[15, 3, 12], 2.7], [[-13, 4, 10], 2.7]];

const eyeL = { side: 'L', at: [3.6, -7.8, 25], size: 2.6, yaw: -22 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: BLACK });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [3.2, 0, 6]),
  { name: 'body', parent: 'root', at: [0, 0, 4] },
  { name: 'head', parent: 'body', at: [0, -1, 18] },
  { name: 'crest1', parent: 'head', at: [0, 2, 31] },
  { name: 'ring', parent: 'head', at: [0, -10.8, 21] },
  ...pair('wing*', 'body', [7.5, 0.5, 15]),
  { name: 'tail1', parent: 'body', at: [0, 6, 7] },
  { name: 'drift', parent: 'root', at: [0, 0, 16] },
  ...face.joints,
];

const wing = any(petal([3.5, 1.6, 7], [8.2, 0.5, 13], [10, -25, 0]),
  ...[0, 1, 2, 3].map((i) => petal([1.5, 0.8, 4.2], [9.5 + i * 0.5, -1.5 + i * 1.3, 7.8 - i * 0.2], [0, -38 - i * 6, 0])),
  petal([1.2, 0.6, 3.2], [10.8, -1.5, 6.2], [0, -55, 0]));

const parts = [
  ['leg*', any(limb([3.2, 0, 6], [3.6, -0.5, 1], 1.1, 0.9), ell([4, 4, 1.4], [3.6, -1, 0.7]))],
  ['body', any(blob([[[8.5, 7.5, 8], [0, 1, 13]], [[7, 6.5, 5.5], [0, 0, 8]]]),
    ...Array.from({ length: 12 }, (_, k) => { const a = (k * 30 * Math.PI) / 180; return limb([6 * Math.sin(a), 0.5 - 5.6 * Math.cos(a), 19], [8 * Math.sin(a), 0.5 - 7.4 * Math.cos(a), 14.5], 1.6, 0.4); }))],
  ['head', any(blob([[[9, 8.5, 8.5], [0, 0, 26]], [[7, 6.5, 6], [0, -2, 23]]]), ell([7, 2.2, 6], [0, -6.3, 24]),
    limb([0, -8.5, 22.2], [0, -12.6, 21], 1.8, 0.4), limb([0, -8.5, 21], [0, -11, 20.6], 1.3, 0.3))],
  ['crest1', any(limb([0, 1, 30], [0, 6, 39], 4, 0.5), spike([1.5, 4, 32], [3, 6, 3], 1.8), spike([-1.5, 4, 32], [-3, 6, 3], 1.8))],
  ['wing*', wing],
  ['tail1', any(...[-20, 0, 20].map((a) => petal([1.6, 0.8, 4.5], [Math.sin((a * Math.PI) / 180) * 2, 7.5, 6.5], [-60, a, 0])))],
];

function assign(c, rgb) {
  if (GOLD.some((g) => near(rgb, g))) return 'ring';
  if (LOOSE.some(([q, r]) => ellD(c, [r, r, r], q) < 1)) return 'drift';   // the loose feathers
  return pick(c, parts);
}

const ringSwing = (amp, cycles, u) => ({ ring: { r: [amp * osc(u, cycles, 0.2), 0, 0.6 * amp * osc(u, cycles, 0.45)] } });
const drift = (u, cycles = 1) => ({ drift: { p: [0, 0, 0.8 * osc(u, cycles)], r: [0, 0, 6 * osc(u, cycles, 0.25)] } });

const clips = birdClips({
  face, crest: ['crest1'], tail: ['tail1'], flapUp: 55,
  add: {
    idle: (t, u) => merge(ringSwing(5, 2, u), drift(u)),
    walk: (t, u) => merge(ringSwing(12, 2, u), drift(u, 1)),
    idle_flap: (t, u) => merge(ringSwing(14, 4, u), drift(u, 2)),
    idle_preen: (t, u) => merge(ringSwing(6, 2, u), drift(u)),
    idle_peck: (t, u) => merge(ringSwing(10, 3, u), drift(u)),
    lunge: (t, u) => ringSwing(-18 * K(u, [[0, 0], [0.4, 1], [1, 0]]), 0.5, 0.25),
    hurt: (t, u) => merge(ringSwing(16, 3, u), drift(u, 2)),
    celebrate: (t, u) => merge(ringSwing(16, 2, u), drift(u, 2)),
    faint: (t, u) => ({ ring: { r: [-20 * smooth((u - 0.2) / 0.5), 0, 0] } }),
  },
});

// fidget: drops the ring onto its foot, panics, snatches it back up, then a proud fluff with ^ ^
clips.idle_ring = {
  seconds: 2.6,
  pose: (t, u) => {
    const drop = K(u, [[0, 0], [0.12, 1], [0.48, 1], [0.6, 0]]);
    const panic = osc(u, 10) * win(u, 0.14, 0.46, 0.04);
    const bend = K(u, [[0.36, 0], [0.48, 1], [0.6, 0]]);
    const proud = win(u, 0.64, 0.95, 0.06);
    return merge({
      body: { r: [18 * bend, 0, 4 * panic], s: [1 + 0.04 * proud, 1 + 0.04 * proud, 1 + 0.03 * proud] },
      head: { r: [10 * drop + 14 * bend - 8 * proud, 0, 8 * panic] },
      ring: { p: [0, 0, -14 * drop], r: [30 * drop, 0, 0] },
      ...face.pose(proud > 0.4 ? 'happy' : 'open', blinks(u, [[0.2, 0.24]])),
      wingL: { r: [0, -30 * Math.abs(panic), 0] },
      wingR: { r: [0, 30 * Math.abs(panic), 0] },
    }, drift(u, 1), { tail1: { r: [0, 0, 8 * Math.sin(TAU * 4 * u) * proud] } });
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
