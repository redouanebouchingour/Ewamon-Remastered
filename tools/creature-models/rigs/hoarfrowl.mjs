// Hoarfrowl's rig: a standing snowy owl with tufted ears, long folded wings, a short tail fan and a curl of frosty
// breath off its beak. Numbers are scad/hoarfrowl.scad's (the pre sprite-accuracy model: re-rig when its new model
// lands).
import { K, TAU, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { any, blob, ell, limb, pair, petal, pick, spike } from './lib/biped.mjs';
import { blinks, eyeKit, mirrorEye } from './lib/face.mjs';

const WHITE = [0.94, 0.96, 1];
const BREATH = [[-4.5, -9.5, 23.8, 0.9], [-7.5, -10, 24.5, 1.3], [-10.2, -9.5, 26.5, 1.2], [-11.4, -8.8, 29, 1.0], [-10.6, -8.2, 31, 0.7]];

const eyeL = { side: 'L', at: [3.4, -7.0, 25.6], size: 1.9, yaw: -20 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: WHITE });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  ...pair('leg*', 'root', [3.6, -1.6, 3]),
  { name: 'body', parent: 'root', at: [0, 0, 4] },
  { name: 'head', parent: 'body', at: [0, 0, 18] },
  ...pair('ear*', 'head', [4.8, 0, 29.8]),
  { name: 'breath', parent: 'head', at: BREATH[0].slice(0, 3) },
  ...pair('wing*', 'body', [8.6, 1.5, 21]),
  { name: 'tail1', parent: 'body', at: [0, 6.5, 5.5] },
  ...face.joints,
];

const parts = [
  ['leg*', any(ell([2.6, 2.8, 2.4], [3.6, -1.6, 2.4]), ell([3, 3, 1.6], [3.6, -4.5, 0.8]))],
  ['body', blob([[[9, 8, 10], [0, 0.5, 13]], [[7.5, 7, 6], [0, 0, 6]]])],
  ['head', any(blob([[[8, 7.2, 6.8], [0, 0, 25.5]], [[8.2, 7.4, 4.5], [0, 0.4, 19.5]]]), ell([3.6, 1.6, 3.6], [3.4, -6, 25.6]),
    ell([3.6, 1.6, 3.6], [-3.4, -6, 25.6]), limb([0, -7.4, 24.4], [0, -8.6, 22.6], 1, 0.3), ell([2.6, 1, 1.4], [0, -6.9, 28.4]))],
  ['ear*', any(limb([4.8, 0, 29.8], [7.4, 0.3, 35.5], 1.8, 0.4), limb([4.8, 0, 29.8], [5.4, 0.2, 33], 1.8, 0.4))],
  ['breath', any(...BREATH.slice(1).map((b, i) => limb(BREATH[i].slice(0, 3), b.slice(0, 3), BREATH[i][3], b[3])), ell([1.2, 1.2, 1.2], [-12.6, -9, 32.4]),
    ell([1, 1, 1], [-9, -10.5, 30.6]))],
  ['wing*', any(petal([3.2, 5.5, 9], [8.6, 1.5, 14], [0, -8, 0]),
    ...[0, 1, 2, 3, 4].flatMap((i) => [petal([1.4, 1.6, 6], [9.2 + i * 0.25, -1.5 + i * 1.6, 6.5 - i * 0.4], [0, -8 - i * 2, 0]),
      spike([9.6 + i * 0.25, -1.5 + i * 1.6, 2.8 - i * 0.4], [0.3, 0, -2.2], 0.9)]))],
  ['tail1', any(...[-25, 0, 25].flatMap((a) => { const s = Math.sin((a * Math.PI) / 180); return [petal([1.6, 0.9, 4], [s * 2.2, 7.5, 4.5], [-50, a, 0]), spike([s * 3.2, 10, 2.2], [s * 0.5, 1.2, -1.6], 0.9)]; }))],
];

// the breath curls and fades in and out; the ear tufts twitch
const puff = (u, cycles = 1, amp = 1) => {
  const k = 0.85 + 0.15 * amp * osc(u, cycles);
  return { breath: { s: [k, k, k], r: [0, 0, 6 * amp * osc(u, cycles, 0.25)] } };
};
const ears = (amp, cycles, u) => ({ earL: { r: [0, -amp * osc(u, cycles), 0] }, earR: { r: [0, amp * osc(u, cycles, 0.15), 0] } });

const clips = birdClips({
  face, tail: ['tail1'], flapUp: 45,
  add: {
    idle: (t, u) => merge(puff(u, 2), ears(3, 2, u)),
    walk: (t, u) => merge(puff(u, 2), ears(5, 2, u)),
    idle_flap: (t, u) => merge(puff(u, 4), ears(8, 4, u)),
    idle_preen: (t, u) => merge(puff(u, 1), ears(3, 1, u)),
    idle_peck: (t, u) => merge(puff(u, 2), ears(3, 2, u)),
    windup: (t, u) => ({ ...ears(-12 * smooth(u / 0.8), 0.25, 0.25), breath: { s: 1 + 0.2 * smooth(u / 0.8) } }),
    lunge: (t, u) => { const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]); return { breath: { s: 1 + 0.5 * hit, r: [0, 0, -14 * hit] } }; },
    hurt: (t, u) => merge(ears(14, 3, u), { breath: { s: 1 - 0.4 * K(u, [[0, 0], [0.2, 1], [1, 0.5]]) } }),
    faint: (t, u) => ({ ...ears(-18 * smooth((u - 0.2) / 0.5), 0.25, 0.25), breath: { s: Math.max(1e-4, 1 - smooth((u - 0.1) / 0.6)) } }),
    celebrate: (t, u) => merge(puff(u, 2, 1.5), ears(10, 4, u)),
  },
});

// fidget: the owl's head swivel, round to one side, all the way round to the other, and back with a blink
clips.idle_swivel = {
  seconds: 3,
  pose: (t, u) => {
    const turn = K(u, [[0, 0], [0.15, 0], [0.3, 70], [0.48, 70], [0.66, -70], [0.82, -70], [0.95, 0]]);
    return merge({
      head: { r: [0, 0, turn] },
      ...face.pose('open', blinks(u, [[0.55, 0.6], [0.9, 0.94]])),
    }, puff(u, 2), ears(4, 3, u));
  },
};

// fidget: a deep breath in, then a long frosty sigh, eyes half shut
clips.idle_sigh = {
  seconds: 2.4,
  pose: (t, u) => {
    const inh = K(u, [[0, 0], [0.3, 1], [0.45, 1], [0.8, 0]]);
    const out = win(u, 0.42, 0.9, 0.08);
    return merge({
      body: { s: [1 + 0.04 * inh, 1 + 0.04 * inh, 1 + 0.03 * inh] },
      head: { r: [-6 * inh + 6 * out, 0, 0] },
      breath: { s: 0.6 + 0.4 * inh + 0.5 * out, r: [0, 0, -10 * out] },
      ...face.pose('open', 0.5 * out),
      wingL: { r: [0, -6 * inh, 0] },
      wingR: { r: [0, 6 * inh, 0] },
    }, ears(3, 2, u), { tail1: { r: [0, 0, 6 * Math.sin(TAU * 2 * u) * out] } });
  },
};

export default rigDef({ joints, assign: (c) => pick(c, parts), extras: face.extras, clips });
