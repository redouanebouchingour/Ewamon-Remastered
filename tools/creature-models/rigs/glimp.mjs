// Glimp's rig: a big soap-bubble body (the body is the head) on two bubble feet, bubble hands floating at its sides,
// a crown of little bubbles with a candle-wick flame that flickers. Biped template. Numbers are scad/glimp.scad's.
import { TAU, hash, merge, rigDef, wave } from './lib/anim.mjs';
import { any, bipedClips, ell, limb, pick } from './lib/biped.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { isAny, near } from './lib/geo.mjs';

const PEARL = [0.9, 0.94, 1];
const WICK = [0.6, 0.72, 0.95];
const FLAME = [[0.98, 0.86, 0.5], [0.9, 0.9, 0.7]];

const eyeL = { side: 'L', at: [3.8, -9.75, 16.4], size: 1.6, yaw: -20, flat: 0.5 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], parent: 'body', skin: PEARL });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [4.4, 0, 6] },
  { name: 'legR', parent: 'root', at: [-4.4, 0, 6] },
  { name: 'body', parent: 'root', at: [0, 0, 6] },
  { name: 'armL', parent: 'body', at: [9.4, -0.3, 13] },
  { name: 'armR', parent: 'body', at: [-9.4, -0.3, 13] },
  { name: 'crest1', parent: 'body', at: [0, 0, 24.5] },
  { name: 'crest2', parent: 'crest1', at: [0.6, 0, 29] },
  ...face.joints,
];

const parts = [
  ['body', ell([11, 10.5, 10.5], [0, 0, 14.5])],
  ['crest1', any(...[0, 45, 90, 135, 180, 225, 270, 315].map((a) => ell([2, 2, 1.8], [Math.cos((a * Math.PI) / 180) * 3.6, Math.sin((a * Math.PI) / 180) * 3.2, 24.6])))],
  ['arm*', any(ell([2.4, 2.2, 2.4], [11.2, -0.5, 12.5]), ell([0.7, 0.4, 0.6], [11.4, -2.6, 13.5]))],
  ['leg*', any(limb([4.4, 0, 6], [4.6, -0.4, 2.6], 2, 2), ell([2.8, 3.2, 2.2], [4.6, -1, 2.2]), ell([0.7, 0.5, 0.5], [3.8, -3.6, 3]))],
  ['legL', ell([0.8, 0.8, 0.8], [9, -5, 1.2])],   // the stray bubble by the left foot
];

function assign(c, rgb) {
  if (isAny(rgb, FLAME, 0.03)) return 'crest2';
  if (near(rgb, WICK, 0.03)) return c[2] > 27 ? 'crest2' : 'crest1';
  return pick(c, parts);
}

// the flame flickers on beats counted in u (whole steps per loop), the crown sways a beat behind the body
const flicker = (u, steps, amp = 1) => {
  const k = hash(Math.floor(u * steps) % steps);
  return { crest2: { s: [1 + 0.12 * amp * (k - 0.5), 1, 1 + 0.25 * amp * (k - 0.3)], r: [0, 8 * amp * (k - 0.5), 0] } };
};
const crown = (u, amp, cycles) => wave(['crest1'], u, { cycles, amp: [amp, 0, amp * 0.6] });
const fx = { idle: [2, 2, 24], walk: [4, 2, 12], idle_look: [2, 2, 20], windup: [3, 1, 6], lunge: [6, 1, 6], hurt: [8, 3, 8], recoil: [4, 1, 6], faint: [3, 1, 18], celebrate: [6, 3, 12], enter: [5, 1, 10], exit: [4, 2, 8] };
const add = Object.fromEntries(Object.entries(fx).map(([n, [a, c, s]]) => [n, (t, u) => merge(crown(u, a, c), flicker(u, s, n === 'faint' ? 0.3 : 1))]));
// the flame shrinks to an ember in the faint
add.faint = (t, u) => merge(crown(u, 3, 1), { crest2: { s: Math.max(0.35, 1 - 0.65 * Math.min(1, u / 0.7)) } });

const base = bipedClips({ face, hipH: 6, stride: 16, hopH: 3, armSwing: 20, add });

const clips = {
  ...base,

  // fidget: blows on its own flame, which bends away and flares back up
  idle_blow: {
    seconds: 2.2,
    pose: (t, u) => {
      const blow = Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.2) / 0.4)));
      return merge({
        body: { r: [-6 * blow, 0, 0], s: [1 + 0.04 * blow, 1 + 0.04 * blow, 1 - 0.03 * blow] },
        crest2: { r: [-35 * blow, 0, 0], s: [1, 1, 1 - 0.3 * blow] },
        ...face.pose(blow > 0.3 ? 'squeeze' : 'open'),
      }, crown(u, 2, 2));
    },
  },

  // fidget: a wobble like a bubble about to pop, then a happy bounce
  idle_wobble: {
    seconds: 1.8,
    pose: (t, u) => {
      const wob = Math.sin(TAU * 5 * u) * Math.sin(Math.PI * Math.min(1, u / 0.7));
      const hop = u > 0.7 ? Math.sin(Math.PI * (u - 0.7) / 0.3) : 0;
      return merge({
        root: { p: [0, 0, 1.2 * hop] },
        body: { s: [1 + 0.05 * wob, 1 + 0.05 * wob, 1 - 0.05 * wob] },
        ...face.pose(hop > 0.2 ? 'happy' : 'open'),
        armL: { r: [0, -20 * hop, 0] },
        armR: { r: [0, 20 * hop, 0] },
      }, crown(u, 4 * Math.abs(wob) + 2, 5), flicker(u, 18));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
