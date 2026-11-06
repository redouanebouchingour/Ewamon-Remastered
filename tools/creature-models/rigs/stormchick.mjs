// Stormchick's rig: one spiky ball of down (the body is the head), dangling three-toed feet, stubby wings on the
// flanks, two lightning-bolt tail plates out of the back-right and big round startled eyes (ink ring + white disc,
// not lib.scad's eye(): the lids are fitted with eyeKit's squash and a frame per eye).
// Numbers are scad/stormchick.scad's, lowered by its G = 7 (the scad authors in art z, then translates by -G).
import { K, TAU, merge, osc, rigDef, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { eyeKit } from './lib/face.mjs';
import { capD, fold, near, side, subFrame } from './lib/geo.mjs';

const G = 7;
const FLUFF = [0.98, 0.82, 0.33];
const ORANGE = [0.94, 0.56, 0.27];
const BOLT = [1.0, 0.84, 0.18];

const rad = (d) => (d * Math.PI) / 180;
const dirAE = (az, el) => [Math.cos(rad(el)) * Math.sin(rad(az)), -Math.cos(rad(el)) * Math.cos(rad(az)), Math.sin(rad(el))];
const C = [0, 0, 23 - G];
const at = (d, r) => [C[0] + d[0] * r, C[1] + d[1] * r, C[2] + d[2] * r];

// the eyes: translate(C + dirAE(az, EEL) * ER) rotate([0, 0, az]) rotate([-EEL, 0, 0]) bigEye(), az = FACE +- EAZ
const FACE = 14; const EAZ = 21; const EEL = 14.7; const ER = 12.6;
const eye = (S, az) => ({ side: S, at: [0, 0, 0], size: 2.7, squash: 0.68, frame: subFrame(at(dirAE(az, EEL), ER), [-EEL, 0, az]) });
const face = eyeKit({ eyes: [eye('L', FACE + EAZ), eye('R', FACE - EAZ)], parent: 'body', skin: FLUFF });

// the near wing: three feathers hulled from WROOT to WROOT + [1.8 + f2, f0, -f1]
const WROOT = at(dirAE(98, -10), 12.2);
const FEATHERS = [[5.2, 1.6, 1.2], [4.8, 3.4, 1.0], [3.8, 5.0, 0.8]].map((f) => [WROOT[0] + 1.8 + f[2], WROOT[1] + f[0], WROOT[2] - f[1]]);
const wingD = (c) => Math.min(...FEATHERS.map((t) => capD(fold(c), WROOT, t, 1.9, 0.9)));

// the tail root: TAILP at azimuth 124, radius 11, the plates lowered 1.5
const TAILP = [Math.sin(rad(124)) * 11, -Math.cos(rad(124)) * 11, 23 - G - 1.5];

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [4.6, -4.8, 14.5 - G] },
  { name: 'legR', parent: 'root', at: [-4.6, -4.8, 14.5 - G] },
  { name: 'body', parent: 'root', at: [0, -1, 3.5] },
  { name: 'wingL', parent: 'body', at: WROOT },
  { name: 'wingR', parent: 'body', at: [-WROOT[0], WROOT[1], WROOT[2]] },
  { name: 'tail1', parent: 'body', at: TAILP },
  ...face.joints,
];

function assign(c, rgb) {
  if (near(rgb, ORANGE) && c[2] < 14.6 - G) return `leg${side(c)}`;
  if (near(rgb, BOLT, 0.03) && c[0] > 5 && c[1] > 0) return 'tail1';
  if (Math.abs(c[0]) > 12.6 && wingD(c) < 1.1) return `wing${side(c)}`;
  return 'body';
}

// the static crackle: the whole fluff trembles in short bursts
const crackle = (u, amp, w) => ({ body: { s: 1 + amp * Math.abs(Math.sin(TAU * 20 * u)) * win(u, w[0], w[1], 0.02) } });

const clips = {
  ...birdClips({ face, tail: ['tail1'], flapUp: 40, add: { idle: (t, u) => crackle(u, 0.02, [0.6, 0.7]) } }),

  // fidget: static builds up, the fluff bristles and shivers, then a zap that makes it jump and blink
  idle_charge: {
    seconds: 2.2,
    pose: (t, u) => {
      const build = K(u, [[0, 0], [0.55, 1], [0.6, 0]]);
      const zap = win(u, 0.58, 0.75, 0.03);
      return merge({
        root: { p: [0, 0, 2.5 * zap] },
        body: { s: 1 + 0.05 * build + 0.03 * build * Math.sin(TAU * 30 * u), r: [0, 0, 4 * osc(u, 2)] },
        ...face.pose(zap > 0.3 ? 'squeeze' : 'open'),
        wingL: { r: [0, -30 * zap, 0] },
        wingR: { r: [0, 30 * zap, 0] },
        tail1: { r: [0, -20 * zap + 4 * build * Math.sin(TAU * 24 * u), 0] },
      });
    },
  },
};
delete clips.idle_preen;   // the wings are too stubby to preen under

export default rigDef({ joints, assign, extras: face.extras, clips });
