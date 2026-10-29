// Blossomsail's rig: a lilac-grey dove with cherry-blossom wings raised in a V, a flower crown, little feet tucked up and
// a long cascade of leaf tail feathers resting on the ground, blossom petals drifting round it. Numbers are
// scad/blossomsail.scad's (the pre sprite-accuracy model: re-rig when its new model lands).
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { any, blob, ell, limb, pair, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { capD, ellD, fold, unrot } from './lib/geo.mjs';

const GREY = [0.72, 0.72, 0.82];
const DEG = Math.PI / 180;
const PETALS = [[-9, -1, 12], [-11, 0, 8], [-8, 1, 5], [-13, 1, 4], [-6, -2, 2], [14, -1, 12], [16, 2, 6]];

const eyeL = { side: 'L', at: [2.2, -3.8, 31.7], size: 1.3, yaw: -40 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: GREY });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0.5, 10] },
  ...pair('leg*', 'body', [2, -1, 12.5]),
  { name: 'head', parent: 'body', at: [0, -0.8, 24] },
  { name: 'crest1', parent: 'head', at: [0, -1.5, 33.5] },
  ...pair('wing*', 'body', [3.5, 0, 23]),
  { name: 'tail1', parent: 'body', at: [0.8, 2.5, 10] },
  { name: 'drift', parent: 'root', at: [0, 0, 8] },
  ...face.joints,
];

// the left wing in its own frame: the scad turns it -22 deg about z at the shoulder [3.5, 0, 23]
const wingLocal = (c) => { const q = unrot([0, 0, -22], [c[0] - 3.5, c[1], c[2] - 23]); return [q[0] + 3.5, q[1], q[2] + 23]; };
const ARM = [[3.5, 0, 23], [7, 0.5, 26], [9.5, 1, 31], [11.5, 1.5, 37]];
const feathers = [0, 1].flatMap((row) => Array.from({ length: 9 }, (_, i) => {
  const t = i / 8;
  const base = [4 + t * 7.5, 1.6 - row, 23.5 + t * 13.5];
  const ang = (105 - t * 80) * DEG;
  const len = (row === 0 ? 12 : 9) + (1 - Math.abs(t - 0.45) * 2) * 3;
  return [base, [base[0] + Math.sin(ang) * len, base[1], base[2] + Math.cos(ang) * len]];
}));
const wing = (c) => {
  const q = wingLocal(c);
  return Math.min(...ARM.slice(1).map((p, i) => capD(q, ARM[i], p, 2, 1.2)), ...feathers.map(([a, b]) => capD(q, a, b, 1.9, 0.6)));
};
const TAILS = [[-14, 11, 2], [2, 13, 3], [18, 14, 2.5], [34, 14, 3.5], [50, 13, 2], [66, 11, 3], [80, 9, 4], [10, 11, 5], [42, 12, 5]];
const tail = any(...TAILS.map(([a, L, y]) => limb([0.8, 2.5, 10], [0.8 + Math.sin(a * DEG) * L, 2.5 + (y * 3 * L) / 57, 10 - Math.cos(a * DEG) * L], 1.7, 1.1)));

const parts = [
  ['leg*', any(limb([2, -1, 12.5], [2.4, -2.4, 10], 0.7, 0.5), ell([1.6, 1.8, 1], [2.4, -3.2, 9.6]))],
  ['body', any(blob([[[4.6, 4.4, 6.5], [0, 0, 18.5]], [[2.8, 3, 3.5], [0.8, 1.8, 11.5]]]), ell([3.4, 2.2, 5], [0, -2.6, 19]))],
  ['head', any(limb([0, -0.5, 22], [0, -1.5, 29], 3.2, 2.8), blob([[[3.6, 4, 3.4], [0, -1.5, 31]], [[2.4, 2.6, 2.4], [0, -3.5, 30.5]]]),
    spike([0, -5.5, 30.6], [0, -2.6, -0.6], 1.1))],
  ['crest1', any(ell([5, 5.2, 1.8], [0, -1.5, 33.6]), ell([2.6, 2.6, 1.6], [0.8, -1, 34.8]), ell([2, 2, 1.4], [-1.6, -1.5, 34.6]),
    ell([1, 1, 1.3], [1.8, -1, 36]), ell([1, 1, 1.3], [-0.8, -0.6, 36.4]))],
  ['tail1', tail],
];

function assign(c) {
  if (PETALS.some((p) => ellD(c, [1.6, 1.6, 1.6], p) < 1)) return 'drift';
  const w = wing(fold(c));
  const best = pick(c, parts);
  const f = fold(c);
  const bd = Math.min(...parts.map(([n, test]) => test(n.endsWith('*') ? f : c)));
  return w < bd ? `wing${c[0] >= 0 ? 'L' : 'R'}` : best;
}

// the tail rests on the ground: it only sways sideways; the petals drift
const sway = (amp, cycles) => (t, u) => ({ tail1: { r: [0, 0, amp * osc(u, cycles)] }, drift: { p: [0, 0, 0.8 * osc(u, cycles)], r: [0, 0, 5 * osc(u, cycles, 0.3)] } });
const clips = birdClips({ face, crest: ['crest1'], flapUp: 22 });
for (const [name, amp, cycles] of [['idle', 2, 1], ['walk', 4, 1], ['idle_flap', 4, 2], ['idle_preen', 2, 1], ['idle_peck', 2, 1], ['hurt', 5, 2], ['celebrate', 5, 2]]) {
  const base = clips[name].pose;
  clips[name].pose = (t, u) => merge(base(t, u), sway(amp, cycles)(t, u));
}

// fidget: a slow graceful wingbeat that sheds petals, eyes closed in bliss
clips.idle_bloom = {
  seconds: 2.8,
  pose: (t, u) => {
    const beat = (Math.sin(TAU * 2 * u - Math.PI / 2) * 0.5 + 0.5) * win(u, 0.08, 0.86, 0.1);
    const bliss = win(u, 0.15, 0.85, 0.08);
    return merge({
      body: { r: [-4 * bliss, 0, 0] },
      head: { r: [-8 * bliss, 0, 6 * Math.sin(TAU * u) * bliss] },
      ...face.pose(bliss > 0.5 ? 'happy' : 'open', blinks(u, [[0.92, 0.96]])),
      wingL: { r: [0, 18 * beat, 0] },
      wingR: { r: [0, -18 * beat, 0] },
      crest1: { r: [3 * osc(u, 2), 0, 0] },
      drift: { p: [0, 0, 2.4 * K(u, [[0, 0], [0.5, 1], [1, 0]])], r: [0, 0, 14 * Math.sin(TAU * u)] },
    }, { tail1: { r: [0, 0, 3 * osc(u, 2)] } });
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
