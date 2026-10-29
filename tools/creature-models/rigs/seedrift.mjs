// Seedrift's rig: a fluffy dandelion puffball (the body is the head) on twig legs, little feather wings as its arms,
// big plum eyes, seed parachutes drifting with it. The legs hang off the root so the puff bobs over planted feet.
// Numbers are scad/seedrift.scad's (the old model, rigged before its sprite-accuracy rebuild).
import { K, TAU, both, merge, osc, rigDef, win } from './lib/anim.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { floaterClips } from './lib/floater.mjs';
import { closest, ellD, fold, near, petalD, side } from './lib/geo.mjs';

const FLUFF = [0.95, 0.93, 0.86];
const TWIG = [0.55, 0.38, 0.24];
const C = [0, 0, 24];

const eyeL = { side: 'L', at: [4.6, -15.6, 25.5], size: 3.2, flat: 0 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], parent: 'body', skin: FLUFF });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [3.2, 0, 12] },
  { name: 'legR', parent: 'root', at: [-3.2, 0, 12] },
  { name: 'body', parent: 'root', at: [0, 0, 12] },
  { name: 'armL', parent: 'body', at: [13.5, -1, 24.5] },
  { name: 'armR', parent: 'body', at: [-13.5, -1, 24.5] },
  ...face.joints,
];

// the feather wings: four petals each, petal([5.5 - 0.7k, 1, 1.4], [R + 4.5, -1, 23 + 1.6k], [0, 25 - 18k, 0])
const wingD = (f) => Math.min(...[0, 1, 2, 3].map((k) => petalD(f, [5.5 - 0.7 * k, 1, 1.4], [17.5, -1, 23 + 1.6 * k], [0, 25 - 18 * k, 0])));

function assign(c, rgb) {
  const S = side(c);
  if (near(rgb, TWIG, 0.04) && Math.abs(c[0]) < 6 && c[2] < 13) return `leg${S}`;
  return closest([['body', ellD(c, [15, 15, 15], C)], [`arm${S}`, wingD(fold(c))]]) ?? 'body';
}

// the puff breathes in and out
const puff = (k) => ({ body: { s: [1 + 0.04 * k, 1 + 0.04 * k, 1 + 0.04 * k] } });

const base = floaterClips({
  face, bob: 0.5,
  add: {
    idle: (t, u) => merge(puff(osc(u, 2) * 0.5 + 0.5), { body: { r: [0, 0, 8 * K(u, [[0, 0], [0.2, 0], [0.3, 1], [0.5, 1], [0.6, -1], [0.82, -1], [0.92, 0]])] } }),
    walk: (t, u) => ({ legL: { r: [-18 * osc(u, 1), 0, 0] }, legR: { r: [18 * osc(u, 1), 0, 0] } }),
  },
});
delete base.idle_spin;   // the puff is the head: no head to spin

const clips = {
  ...base,

  // fidget: a big breath in, the fluff swelling, then a puff out that ruffles everything, eyes ^ ^
  idle_puff: {
    seconds: 2.2,
    pose: (t, u) => {
      const inh = K(u, [[0, 0], [0.4, 1], [0.55, 1], [0.7, -0.4], [0.9, 0]]);
      const ruff = Math.sin(TAU * 10 * u) * win(u, 0.55, 0.9, 0.04);
      return merge({
        ...face.pose(inh > 0.6 ? 'happy' : 'open'),
        body: { p: [0, 0, 0.5 + 0.8 * Math.max(0, inh)], r: [0, 2 * ruff, 0] },
        ...both('arm', { r: [0, -20 * Math.max(0, inh) + 10 * ruff, 0] }),
      }, puff(1.6 * inh));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
