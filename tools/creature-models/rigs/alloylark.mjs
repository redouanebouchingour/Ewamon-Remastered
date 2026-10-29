// Alloylark's rig: a small steel songbird, wings of blade feathers raised in a V, a helm of swept blades, a blade
// tail. Numbers are scad/alloylark.scad's (the pre sprite-accuracy model: re-rig when its new model lands).
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { any, blob, ell, limb, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';

const BODY = [0.22, 0.22, 0.27];

/** blade(p, d, w): a flat blade feather from p along d, tested as a tapering capsule. */
const bl = (p, d, w) => limb(p, p.map((v, i) => v + d[i]), w * 0.8, 0.3);

// the painted cyan slit eyes (not lib eye()): lids fitted to them
const eyeL = { side: 'L', at: [2.5, -5.6, 26.2], size: 1.2, yaw: -25 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: BODY, lid: [1.35, 0.75, 0.8] });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [3.6, -0.5, 9.5]),
  { name: 'body', parent: 'root', at: [0, 0, 8] },
  { name: 'head', parent: 'body', at: [0, -2, 22] },
  { name: 'crest1', parent: 'head', at: [0, -3, 29] },
  ...pair('wing*', 'body', [5.2, 1.2, 18.5]),
  { name: 'tail1', parent: 'body', at: [0, 5.5, 11] },
  ...face.joints,
];

const wingBlades = [0, 1, 2, 3, 4].map((i) => {
  const a = ((62 - i * 14) * Math.PI) / 180;
  const l = 17 - Math.abs(i - 1) * 1.6;
  return bl([6, 1.5 + i * 0.4, 19 - i * 0.6], [l * Math.cos(a), 3 + i * 1.2, l * Math.sin(a)], 2.8);
});
const coverts = [0, 1, 2].map((i) => bl([5.5, 0.5, 20 - i * 1.8], [6, 1.5, 3 - i * 2], 1.3));

const parts = [
  ['leg*', any(ell([2.8, 3, 3], [3.6, -0.5, 9.5]), limb([3.8, -0.6, 8], [4.4, -1, 2], 1.3, 1.1), ell([1.6, 1.6, 1.4], [4.4, -1, 4.5]),
    ell([4, 4.5, 1.6], [4.4, -1.5, 0.9]))],
  ['body', any(blob([[[6.5, 6.5, 6.5], [0, 1, 14]], [[5.2, 5, 5], [0, -1.5, 19]]]), ell([6.3, 6.1, 2.6], [0, -0.6, 19.5]),
    ell([5.4, 3.6, 5.2], [0, -3.6, 15.8]))],
  ['head', any(ell([4.6, 4.6, 4.4], [0, -2.4, 25.5]), ell([4.9, 5, 3.8], [0, -2, 26.6]), ell([4.6, 1.6, 1.2], [0, -5.6, 27.3]),
    limb([0, -6.4, 25.2], [0, -9.2, 24.4], 1.3, 0.3))],
  ['crest1', any(bl([0, -4, 29.5], [0, 10, 7], 1.8), bl([-2, -3, 29], [-3, 10, 4.5], 1.6), bl([2, -3, 29], [3, 10, 4.5], 1.6),
    bl([0, -1, 28.5], [0, 8, 1.5], 1.2))],
  ['wing*', any(ell([3.4, 3, 3.8], [5.2, 1.2, 18.5]), ...wingBlades, ...coverts)],
  ['tail1', any(...[-2, -1, 0, 1, 2].map((i) => bl([i * 0.8, 5.5, 11], [i * 3, 12, -4 + Math.abs(i) * 0.5], 2.2)))],
];

const assign = (c) => pick(c, parts);

const clips = birdClips({
  face, crest: ['crest1'], tail: ['tail1'], flapUp: 30,
  add: { hurt: (t, u) => ({ crest1: { r: [-10 * win(u, 0, 1, 0.1), 0, 0] } }) },
});

// fidget: a little song, the head thrown back and the beak trilling, the crest blades ringing
clips.idle_sing = {
  seconds: 2,
  pose: (t, u) => {
    const up = K(u, [[0, 0], [0.15, 1], [0.8, 1], [0.95, 0]]);
    const trill = osc(u, 14) * win(u, 0.2, 0.78, 0.04);
    return merge({
      body: { r: [-4 * up, 0, 0] },
      head: { r: [-16 * up + 2 * trill, 0, 6 * Math.sin(TAU * 2 * u) * up] },
      crest1: { r: [3 * trill, 0, 2 * trill] },
      ...face.pose(up > 0.5 ? 'happy' : 'open', blinks(u, [[0.9, 0.95]])),
      wingL: { r: [0, -6 * up, 0] },
      wingR: { r: [0, 6 * up, 0] },
    });
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
