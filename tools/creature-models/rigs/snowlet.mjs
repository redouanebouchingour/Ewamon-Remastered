// Snowlet's rig: a round puff of snow-owl fluff (the ball is head and body in one, no legs), big amber eyes, a spiky
// tuft on top and two stubby wings. It hops instead of walking. Numbers are scad/snowlet.scad's (the pre
// sprite-accuracy model: re-rig when its new model lands).
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { any, ell, pair, petal, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';

const WHITE = [0.95, 0.97, 1];
const TUFT = [[0, 0, 24, 0, 0, 4], [2.5, 0.5, 23.5, 1.5, 0, 3.5], [-2.5, 0.5, 23.5, -1.5, 0, 3.5], [4.8, 1, 22.6, 2.2, 0, 2.6],
  [-4.8, 1, 22.6, -2.2, 0, 2.6], [1.2, 3, 23.3, 0.5, 1.5, 3], [-1.2, 3, 23.3, -0.5, 1.5, 3]];

// the eyes are painted discs (not lib eye()): white lids fitted over the navy rim
const eyeL = { side: 'L', at: [4.6, -9.8, 14.8], size: 3, yaw: -22 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], parent: 'body', skin: WHITE, lid: [1.07, 0.85, 1.13] });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 1] },
  { name: 'crest1', parent: 'body', at: [0, 0.5, 22.5] },
  ...pair('wing*', 'body', [11.5, 0, 12.5]),
  ...face.joints,
];

const parts = [
  ['body', ell([12, 11, 11.5], [0, 0, 12.5])],
  ['crest1', any(...TUFT.map(([x, y, z, dx, dy, dz]) => spike([x, y, z], [dx, dy, dz], 1.8)))],
  ['wing*', any(petal([4.5, 2.2, 3], [13, 0, 12.5], [0, -20, 0]),
    ...[0, 1, 2].map((i) => petal([4.2, 1.4, 1.3], [15.5, -0.3 + i * 1.0, 13.6 - i * 1.7], [0, -20 + i * 12, 0])))],
];
// the fringe lobes and the flank fluff sit on the ball: body, unless a wing or the tuft lies nearer
const fluff = [2, 3, 4, 5, 6, 7, 8, 9].map((i) => { const a = ((i * 30 + 15) * Math.PI) / 180; return ell([3, 1.2, 3], [11.4 * Math.sin(a), -10.4 * Math.cos(a), 12]); });
parts[0][1] = any(parts[0][1], ...fluff);
const assign = (c) => (Math.abs(c[0]) < 11.5 && c[2] < 21.5 ? 'body' : pick(c, parts));

const clips = birdClips({ face, crest: ['crest1'], flapUp: 40 });
// no legs: the walk is a run of little hops, squashing on each landing
const walk = clips.walk.pose;
clips.walk.pose = (t, u) => {
  const h = Math.abs(Math.sin(TAU * u));
  return merge(walk(t, u), { root: { p: [0, 0, 1.6 * h] }, body: { s: [1 + 0.05 * (1 - h), 1 + 0.05 * (1 - h), 1 - 0.08 * (1 - h)] } });
};

// fidget: rolls side to side like a snowball, eyes squeezed happy
clips.idle_roll = {
  seconds: 2,
  pose: (t, u) => {
    const on = win(u, 0.08, 0.88, 0.1);
    return merge({
      body: { r: [0, 14 * osc(u, 2) * on, 0] },
      ...face.pose(on > 0.4 ? 'happy' : 'open'),
      wingL: { r: [0, -16 * Math.max(0, osc(u, 2)) * on, 0] },
      wingR: { r: [0, 16 * Math.max(0, -osc(u, 2)) * on, 0] },
      crest1: { r: [0, -8 * osc(u, 2, 0.1) * on, 0] },
    });
  },
};

// fidget: a sleepy owl blink, eyes closing slowly, a nod, snapping awake with a fluff
clips.idle_doze = {
  seconds: 2.8,
  pose: (t, u) => {
    const sleep = K(u, [[0, 0], [0.3, 1], [0.7, 1], [0.76, 0]]);
    const fluff = Math.sin(TAU * 10 * u) * win(u, 0.76, 0.95, 0.03);
    return merge({
      body: { r: [6 * sleep, 3 * fluff, 0], s: [1 + 0.04 * Math.abs(fluff), 1 + 0.04 * Math.abs(fluff), 1 - 0.03 * sleep] },
      ...face.pose('open', sleep + blinks(u, [[0.88, 0.92]])),
      crest1: { r: [10 * sleep + 6 * fluff, 0, 0] },
      wingL: { r: [0, 6 * sleep - 10 * Math.abs(fluff), 0] },
      wingR: { r: [0, -6 * sleep + 10 * Math.abs(fluff), 0] },
    });
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
