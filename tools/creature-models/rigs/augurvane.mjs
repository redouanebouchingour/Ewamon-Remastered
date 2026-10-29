// Augurvane's rig: a standing raven seer with a spiky crest, a glowing third eye, long folded wings and a gold lantern
// held out in its right hand (the viewer's left). Numbers are scad/augurvane.scad's (the pre sprite-accuracy model:
// re-rig when its new model lands).
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { any, blob, ell, limb, pair, petal, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny } from './lib/geo.mjs';

const NAVY = [0.17, 0.15, 0.24];
const LANTERN = [[0.62, 0.38, 0.08], [0.45, 0.27, 0.06], [1, 0.82, 0.3], [1, 0.95, 0.7]];

const eyeL = { side: 'L', at: [2.6, -5.6, 30], size: 1.6, yaw: -22 };
const third = { side: 'M', at: [0, -5.4, 33.6], size: 1.5 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL), third], skin: NAVY });

const CREST = [[0, 2, 35, 0, 2, 8], [2.5, 1.5, 34.5, 4, 1, 6], [-2.5, 1.5, 34.5, -4, 1, 6], [4.5, 1, 32, 6, 0.5, 3], [-4.5, 1, 32, -6, 0.5, 3],
  [1, 4, 34, 2, 6, 5], [-1, 4, 34, -2, 6, 5], [0, 5.5, 31, 0, 7, 1], [3.5, 4, 32, 5, 5, 2], [-3.5, 4, 32, -5, 5, 2]];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [3, 0.5, 9]),
  { name: 'body', parent: 'root', at: [0, 0, 8] },
  { name: 'head', parent: 'body', at: [0, -0.5, 25] },
  { name: 'crest1', parent: 'head', at: [0, 2.5, 33.5] },
  ...pair('wing*', 'body', [7.5, 0.8, 24]),
  { name: 'armR', parent: 'body', at: [-6.5, -1, 20] },
  { name: 'handR', parent: 'armR', at: [-9.8, -5.5, 16.6] },
  { name: 'lantern', parent: 'handR', at: [-9.8, -5.5, 15.2] },
  { name: 'tail1', parent: 'body', at: [0, 5.5, 9] },
  ...face.joints,
];

const wing = any(petal([2.6, 4, 7], [7.5, 0.8, 19], [0, -12, 0]), petal([3, 1.4, 5], [8.8, -0.5, 16], [0, -20, 0]),
  ...[0, 1, 2, 3, 4].flatMap((i) => [petal([2.4, 1.0, 7.5], [9.6 + i * 0.7, -3 + i * 1.8, 11 - i * 0.6], [0, -30 - i * 6, 0]),
    petal([0.8, 0.6, 2.2], [10.9 + i * 0.7, -3.8 + i * 1.8, 9.2 - i * 0.6], [0, -30 - i * 6, 0])]));

const parts = [
  ['leg*', any(limb([3, 0.5, 9], [3.4, 0, 1.2], 1.4, 1), ell([4, 4, 1.4], [3.4, -0.6, 0.7]))],
  ['body', any(blob([[[7, 6.5, 9], [0, 0.5, 16]], [[5.5, 5, 5], [0, -1, 21]], [[5.5, 5.5, 4], [0, 1, 9]]]), ell([6.2, 6, 1.6], [0, -0.2, 24.5]),
    ell([1.3, 0.8, 1.7], [0, -6.4, 23]))],
  ['head', any(blob([[[6.5, 6, 6], [0, 0, 30]], [[4.8, 4.5, 4.5], [0, -2.5, 29]]]), limb([0, -6, 28.4], [0, -11, 26.6], 1.8, 0.35),
    spike([5, -1, 28], [3, 0.5, -1.5], 1.4), spike([-5, -1, 28], [-3, 0.5, -1.5], 1.4))],
  ['crest1', any(...CREST.map(([x, y, z, dx, dy, dz]) => limb([x, y, z], [x + dx * 1.05, y + dy * 1.05, z + dz * 1.05], 2.5, 0.3)))],
  ['wing*', wing],
  ['armR', limb([-6.5, -1, 20], [-9.5, -5, 17], 1.4, 1.1)],
  ['handR', ell([1.4, 1.3, 1.2], [-9.8, -5.5, 16.6])],
  ['tail1', any(ell([3, 2, 3], [0, 5.5, 9]), ...[-22, 0, 22].map((a) => petal([1.5, 0.8, 6], [Math.sin((a * Math.PI) / 180) * 2.5, 7, 7], [-55, a, 0])))],
];

function assign(c, rgb) {
  if (isAny(rgb, LANTERN, 0.03)) return 'lantern';
  return pick(c, parts);
}

// the lantern hangs plumb and swings a little on its ring; the right arm holds it out
const swing = (amp, cycles, u, phase = 0) => ({ lantern: { r: [amp * osc(u, cycles, phase), 0, 0.5 * amp * osc(u, cycles, phase + 0.25)] } });
const clips = birdClips({
  face, crest: ['crest1'], tail: ['tail1'], flapUp: 45,
  add: {
    idle: (t, u) => merge(swing(3, 1, u), { armR: { r: [2 * osc(u, 2), 0, 0] } }),
    walk: (t, u) => merge(swing(10, 1, u, 0.2), { armR: { r: [4 * osc(u, 1), 0, 0] } }),
    idle_flap: (t, u) => swing(8, 3, u),
    idle_preen: (t, u) => swing(4, 1, u),
    idle_peck: (t, u) => swing(6, 2, u),
    windup: (t, u) => ({ armR: { r: [-30 * smooth(u / 0.8), 10 * smooth(u / 0.8), 0] }, lantern: { r: [-14 * smooth(u / 0.8), 0, 0] } }),
    lunge: (t, u) => { const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]); return { armR: { r: [-30 - 30 * hit, 10, 0] }, lantern: { r: [-14 + 30 * hit, 0, 0] } }; },
    hurt: (t, u) => merge(swing(14, 3, u), { armR: { r: [10 * K(u, [[0, 0], [0.2, 1], [1, 0.4]]), 0, 0] } }),
    faint: (t, u) => ({ armR: { r: [20 * smooth((u - 0.2) / 0.5), 0, 0] }, lantern: { r: [-10 * smooth((u - 0.2) / 0.5), 0, 0] } }),
    celebrate: (t, u) => merge(swing(10, 2, u), { armR: { r: [-60 * win(u, 0, 1, 0.15), 20 * win(u, 0, 1, 0.15), 0] } }),
  },
});

// fidget: raises the lantern and peers into its flame, the third eye opening wide, then a slow knowing blink
clips.idle_divine = {
  seconds: 3,
  pose: (t, u) => {
    const up = K(u, [[0, 0], [0.2, 1], [0.75, 1], [0.92, 0]]);
    const blink = win(u, 0.62, 0.7, 0.03);
    return merge({
      body: { r: [4 * up, 0, -10 * up] },
      head: { r: [10 * up, 0, -20 * up] },
      armR: { r: [-55 * up, 10 * up, 0] },
      lantern: { r: [-25 * up + 2 * osc(u, 3), 0, 0] },
      ...face.pose('open', blink),
      lidM: { s: 1e-4 },
    }, { crest1: { r: [-6 * up, 0, 0] } });
  },
};

// fidget: ruffles its long wings and settles them, the crest spikes shivering
clips.idle_ruffle = {
  seconds: 1.8,
  pose: (t, u) => {
    const sh = Math.sin(TAU * 10 * u) * win(u, 0.15, 0.7, 0.04);
    return merge({
      body: { r: [0, 4 * sh, 0], s: [1 + 0.03 * Math.abs(sh), 1 + 0.03 * Math.abs(sh), 1] },
      ...face.pose('open', blinks(u, [[0.8, 0.85]])),
      wingL: { r: [0, -16 * Math.abs(sh), 0] },
      wingR: { r: [0, 16 * Math.abs(sh), 0] },
      crest1: { r: [4 * sh, 0, 3 * sh] },
    }, swing(6, 4, u));
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
