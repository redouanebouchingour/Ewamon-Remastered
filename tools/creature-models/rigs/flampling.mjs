// Flampling's rig: a round fire chick hovering in the air (the egg body is its head), a flame crest, little wings with
// burning tips, dangling legs. Numbers are scad/flampling.scad's.
import { K, TAU, hash, merge, osc, rigDef, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { fold, isAny, near, side } from './lib/geo.mjs';

const BODY = [0.85, 0.42, 0.18];
const LEG = [0.18, 0.15, 0.15];
const WING = [[0.7, 0.3, 0.12], [0.95, 0.55, 0.28]];

const eyeL = { side: 'L', at: [3.8, -7.7, 24.8], size: 2.1, yaw: 6, flat: 0.45 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], parent: 'body', skin: BODY });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [3, -1, 11.6] },
  { name: 'legR', parent: 'root', at: [-3, -1, 11.6] },
  { name: 'body', parent: 'root', at: [0, 0, 12] },
  { name: 'wingL', parent: 'body', at: [8.5, 0, 20] },
  { name: 'wingR', parent: 'body', at: [-8.5, 0, 20] },
  { name: 'crest1', parent: 'body', at: [0, 0, 29] },
  ...face.joints,
];

function assign(c, rgb) {
  const f = fold(c);
  if (near(rgb, LEG) && c[2] < 12) return `leg${side(c)}`;
  if ((f[0] > 9.6 && c[2] > 15) || (isAny(rgb, WING, 0.03) && f[0] > 6.5 && c[2] > 14)) return `wing${side(c)}`;
  if (c[2] > 29.6 && Math.abs(c[0]) < 6) return 'crest1';
  return 'body';
}

// the flames flicker: the crest and the wingtips pulse on a wrapped beat so loops close
const flick = (u, steps, amp = 0.06) => {
  const n = Math.floor(u * steps) % steps;
  return { crest1: { s: [1 + amp * (hash(n) - 0.5), 1, 1 + 2 * amp * (hash(n + 7) - 0.3)], r: [0, 4 * (hash(n + 3) - 0.5), 0] } };
};

const base = birdClips({
  face, crest: ['crest1'], flapUp: 70,
  add: {
    idle: (t, u) => flick(u, 24),
    walk: (t, u) => flick(u, 6, 0.08),
    celebrate: (t, u) => flick(u, 8, 0.15),
    hurt: (t, u) => ({ crest1: { s: [1, 1, 1 - 0.3 * K(u, [[0, 0], [0.2, 1], [1, 0.5]])] } }),
    faint: (t, u) => ({ crest1: { s: [1, 1, 1 - 0.5 * Math.min(1, u / 0.7)] } }),
  },
});

const clips = {
  ...base,

  // fidget: a temper tantrum: puffs up, the crest blazes up tall, the wings beat furiously, then it deflates
  idle_huff: {
    seconds: 2,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.15, 1], [0.7, 1], [0.85, 0]]);
      const beat = Math.sin(TAU * 10 * u) * win(u, 0.2, 0.68, 0.04);
      return merge({
        root: { p: [0, 0, 1.2 * on + 0.4 * Math.abs(beat)] },
        body: { s: [1 + 0.06 * on, 1 + 0.06 * on, 1 + 0.04 * on], r: [-4 * on, 0, 0] },
        ...face.pose(on > 0.5 ? 'squeeze' : 'open'),
        wingL: { r: [0, -40 * Math.abs(beat), 0] },
        wingR: { r: [0, 40 * Math.abs(beat), 0] },
        crest1: { s: [1 + 0.1 * on, 1, 1 + 0.45 * on] },
      }, flick(u, 20, 0.1));
    },
  },
};
delete clips.idle_peck;   // it hovers, nothing to peck

export default rigDef({ joints, assign, extras: face.extras, clips });
