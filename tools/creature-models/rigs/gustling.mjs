// Gustling's rig: Puffinch grown upright. A round head with a curled cream crest plume, a red ruff, folded wings and
// two tail streamers ending in red tufts. Numbers are scad/gustling.scad's (the pre sprite-accuracy model: re-rig when
// its new model lands).
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { any, chain, ell, limb, pair, petal, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';

const CREAM = [0.97, 0.9, 0.7];

const PLUME = [[0, 0, 33.5], [-0.5, 0, 37], [0, 0.3, 40.5], [2.5, 0.5, 42.8], [5.5, 0.6, 42.6], [7.4, 0.5, 40.6], [7.2, 0.3, 38.2], [5.8, 0.2, 37.4]];
const PLUME_R = [1.4, 1.5, 1.6, 1.6, 1.5, 1.3, 0.9, 0.4];
const STREAM_A = [[5, 7, 8], [11, 8, 11], [17, 7, 12], [21, 6, 11]];
const STREAM_B = [[4, 7, 7], [9, 8.5, 6], [14, 8, 5], [17, 7, 2.5]];
const trail = [['trailA1', 'trailA2', 'trailA3'], ['trailB1', 'trailB2', 'trailB3']];

const eyeL = { side: 'L', at: [2.7, -6.3, 28.6], size: 1.9, yaw: -20, flat: 0.45 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: CREAM });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4, 0, 4]),
  { name: 'body', parent: 'root', at: [0, 0, 3] },
  { name: 'head', parent: 'body', at: [0, -0.5, 22.5] },
  { name: 'crest1', parent: 'head', at: PLUME[0] },
  { name: 'crest2', parent: 'crest1', at: PLUME[2] },
  { name: 'crest3', parent: 'crest2', at: PLUME[4] },
  ...pair('wing*', 'body', [9, 1, 21]),
  ...[STREAM_A, STREAM_B].flatMap((pts, k) => trail[k].map((name, i) => ({ name, parent: i === 0 ? 'body' : trail[k][i - 1], at: pts[i] }))),
  ...face.joints,
];

const parts = [
  ['leg*', any(limb([4, 0, 4], [4.2, -1, 0.8], 0.9, 0.7), ell([3.6, 4, 1.2], [4.2, -1, 0.6]))],
  ['body', any(ell([10, 9, 11], [0, 0, 13]), ell([7.5, 7, 1.6], [0, -0.3, 22.5]),
    ...Array.from({ length: 15 }, (_, k) => { const a = (k * 24 * Math.PI) / 180; return spike([7 * Math.sin(a), -0.3 - 6.6 * Math.cos(a), 22.5], [Math.sin(a) * 2.6, -Math.cos(a) * 2.6, -2.2], 1.4); }))],
  ['head', any(ell([7, 6.5, 6.5], [0, -0.5, 28]), limb([0, -6.6, 26.2], [0, -8.6, 25.4], 1.3, 0.2))],
  ...chain(['crest1', 'crest1', 'crest2', 'crest2', 'crest3', 'crest3', 'crest3'], PLUME, PLUME_R),
  ['wing*', any(petal([2.6, 6.5, 9.5], [9, 1, 13], [0, 8, 8]), ...[0, 1, 2, 3].map((i) => ell([1.2, 1.1, 2.2], [9.4 + i * 0.1, -3 + i * 2.2, 3.5 + i * 0.4])))],
  ...chain(trail[0], STREAM_A, [1, 0.9, 0.8, 0.8]), ['trailA3', petal([2.8, 1.3, 1.8], [22.5, 5.8, 10.6], [0, -20, 0])],
  ...chain(trail[1], STREAM_B, [1, 0.9, 0.8, 0.8]), ['trailB3', petal([1.6, 1.3, 2.8], [17.4, 7, 1.6], [0, 15, 0])],
];

// the wings are folded (pivot at the shoulder, hanging): ry < 0 swings them out from the sides
const clips = birdClips({ face, crest: ['crest1', 'crest2', 'crest3'], trail, flapUp: 50 });

// fidget: puffs up its ruff and chirps, the plume bobbing, then shakes it all down
clips.idle_puff = {
  seconds: 2.2,
  pose: (t, u) => {
    const puff = K(u, [[0, 0], [0.2, 1], [0.6, 1], [0.72, 0]]);
    const chirp = Math.max(0, Math.sin(TAU * 3 * ((u - 0.22) / 0.36))) * win(u, 0.22, 0.58, 0.03);
    const sh = Math.sin(TAU * 9 * u) * win(u, 0.72, 0.95, 0.03);
    return merge({
      body: { r: [-3 * puff, 4 * sh, 0], s: [1 + 0.05 * puff, 1 + 0.05 * puff, 1 + 0.02 * puff] },
      head: { r: [-10 * chirp, 6 * sh, 0] },
      crest1: { r: [6 * chirp + 4 * sh, 0, 0] },
      crest2: { r: [8 * chirp, 0, 0] },
      ...face.pose(chirp > 0.3 ? 'happy' : 'open', blinks(u, [[0.12, 0.16]])),
      wingL: { r: [0, -10 * puff + 10 * sh, 0] },
      wingR: { r: [0, 10 * puff - 10 * sh, 0] },
    }, ...trail.map((ch) => Object.fromEntries(ch.map((n, i) => [n, { r: [0, 0, 8 * sh * (1 + 0.3 * i) + 3 * osc(u, 2)] }]))));
  },
};

export default rigDef({ joints, assign: (c) => pick(c, parts), extras: face.extras, clips });
