// Rivetalon's rig: Alloylark grown into a tall armoured raptor, huge blade wings raised wide, a crown of blade crests,
// a long blade tail trailing to the ground. Numbers are scad/rivetalon.scad's (the pre sprite-accuracy model: re-rig
// when its new model lands).
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { any, blob, ell, limb, pair, pick } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';

const BODY = [0.22, 0.22, 0.27];

/** blade(p, d, w): a flat blade feather from p along d, tested as a tapering capsule. */
const bl = (p, d, w) => limb(p, p.map((v, i) => v + d[i]), w * 0.8, 0.3);

// the painted cyan slit eyes (not lib eye()): lids fitted to them
const eyeL = { side: 'L', at: [2.4, -6.3, 33.1], size: 1.15, yaw: -25 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: BODY, lid: [1.35, 0.75, 0.7] });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [4.4, 0, 12]),
  { name: 'body', parent: 'root', at: [0, 0, 10] },
  { name: 'head', parent: 'body', at: [0, -1, 25.5] },
  { name: 'crest1', parent: 'head', at: [0, -3.5, 35.5] },
  ...pair('wing*', 'body', [6, 1.5, 23]),
  { name: 'tail1', parent: 'body', at: [0, 6.5, 14] },
  ...face.joints,
];

const wingBlades = [0, 1, 2, 3, 4, 5, 6].map((i) => {
  const a = ((76 - i * 9) * Math.PI) / 180;
  const l = 24 - Math.abs(i - 2) * 1.6;
  return bl([7, 2 + i * 0.4, 24 - i * 0.6], [l * Math.cos(a) * 1.15, 2 + i * 0.9, l * Math.sin(a)], 3);
});
const coverts = [0, 1, 2, 3].map((i) => bl([6.5, 0.8, 25 - i * 1.5], [8, 1.5, 6 - i * 2.5], 1.8));

const parts = [
  ['leg*', any(ell([3.4, 3.6, 3.8], [4.4, 0, 12]), limb([4.8, -0.5, 10], [6, -1, 2.2], 1.5, 1.3), ell([1.9, 1.9, 1.6], [5.4, -1, 6]),
    ell([4.6, 5, 1.6], [6, -1.5, 0.9]))],
  ['body', any(blob([[[7, 6.5, 7], [0, 1.5, 17]], [[6, 5.5, 6], [0, -1, 23]]]), ell([5.8, 3.8, 5.6], [0, -3.8, 21]),
    ell([6.4, 6, 1.6], [0, 0, 25.5]))],
  ['head', any(limb([0, -1, 26.5], [0, -2.4, 30], 3.4, 3.2), ell([4.4, 4.8, 4.2], [0, -3, 32.5]), ell([4.8, 5.2, 3.8], [0, -2.6, 33.6]),
    ell([4.4, 1.6, 1.1], [0, -6.4, 34.2]), limb([0, -7, 32], [0, -10.6, 30.2], 1.4, 0.3))],
  ['crest1', any(bl([0, -5, 36.5], [0, 7, 9], 1.8), bl([-1.6, -4, 36], [-4, 8, 7], 1.6), bl([1.6, -4, 36], [4, 8, 7], 1.6),
    bl([-2.6, -2.5, 35], [-6, 9, 3], 1.5), bl([2.6, -2.5, 35], [6, 9, 3], 1.5), bl([0, -1, 35.5], [0, 9, 2], 1.3))],
  ['wing*', any(ell([4, 3.5, 4.5], [6, 1.5, 23]), ell([2.6, 2.4, 1.2], [6.2, -0.4, 25.5]), ...wingBlades, ...coverts)],
  ['tail1', any(...[-3, -2, -1, 0, 1, 2, 3].map((i) => bl([i * 0.8, 6.5, 14], [i * 3.2, 15, -11 + Math.abs(i) * 1.2], 2.2)))],
];

const assign = (c) => pick(c, parts);

// the tail rests on the ground: it only sways sideways, never dips
const clips = birdClips({ face, crest: ['crest1'], flapUp: 26 });
const tailSway = (amp, cycles) => (t, u) => ({ tail1: { r: [0, 0, amp * osc(u, cycles)] } });
for (const [name, amp, cycles] of [['idle', 3, 1], ['walk', 6, 1], ['celebrate', 6, 2], ['hurt', 5, 2], ['idle_flap', 4, 2]]) {
  const base = clips[name].pose;
  clips[name].pose = (t, u) => merge(base(t, u), tailSway(amp, cycles)(t, u));
}

// fidget: a slow display, the great wings spread wider and the blades rattle, the head raised proudly
clips.idle_display = {
  seconds: 2.4,
  pose: (t, u) => {
    const on = K(u, [[0, 0], [0.2, 1], [0.72, 1], [0.92, 0]]);
    const rattle = osc(u, 18) * win(u, 0.25, 0.7, 0.05);
    return merge({
      body: { r: [-5 * on, 0, 0] },
      head: { r: [-10 * on, 0, 8 * Math.sin(TAU * u) * on] },
      crest1: { r: [2 * rattle, 0, 0] },
      ...face.pose('open', blinks(u, [[0.8, 0.85]])),
      wingL: { r: [0, 14 * on + 2 * rattle, -6 * on] },
      wingR: { r: [0, -14 * on - 2 * rattle, 6 * on] },
      tail1: { r: [0, 0, 4 * smooth(on) * osc(u, 2)] },
    });
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
