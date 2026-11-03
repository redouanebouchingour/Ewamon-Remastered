// Glimp's rig: a big soap-bubble body (the body is the head) on two bubble feet, bubble hands at its sides, a crown
// of little bubbles with a thin stalk and a feather wisp at its tip that flickers. Biped template. Numbers are
// scad/glimp.scad's (remodelled on the sprite 2026-11-03).
import { TAU, hash, merge, rigDef, wave } from './lib/anim.mjs';
import { any, bipedClips, ell, limb, pick } from './lib/biped.mjs';
import { eyeKit } from './lib/face.mjs';
import { isAny, near } from './lib/geo.mjs';

const PINK = [0.99, 0.86, 0.94];
const STALK = [0.66, 0.76, 0.93];
const WISP = [[0.94, 0.81, 0.86], [0.97, 0.88, 0.72], [0.99, 0.95, 0.82]];

// the body ellipsoid and the scad's onBody(): a point on its surface at heading psi (deg from -Y towards +X)
const B = [14.6, 13.6, 12.6];
const BZ = 18.3;
const rad = (d) => (d * Math.PI) / 180;
const onBody = (psi, z, out = 0) => {
  const k = Math.sqrt(Math.max(0, 1 - ((z - BZ) / B[2]) ** 2));
  const s = Math.sin(rad(psi)); const c = Math.cos(rad(psi));
  return [B[0] * k * s + out * s, -B[1] * k * c - out * c, z];
};

// the face is turned 10 deg towards the viewer as drawn, so the two eyes are not mirrors: the near (+X) one at
// heading 30.5, the far one at -10.9 (scad EPSI), both at EZ = 21.1, sunk 0.35
const EYE = 2.3;
const EZ = 21.1;
const eyeL = { side: 'L', at: onBody(30.5, EZ, -0.35), size: EYE, yaw: 30.5, flat: 0.6 };
const eyeR = { side: 'R', at: onBody(-10.9, EZ, -0.35), size: EYE, yaw: -10.9, flat: 0.6 };
const face = eyeKit({ eyes: [eyeL, eyeR], parent: 'body', skin: PINK });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [6.6, -0.8, 5.6] },
  { name: 'legR', parent: 'root', at: [-6.6, -0.8, 5.6] },
  { name: 'body', parent: 'root', at: [0, 0, 6] },
  { name: 'armL', parent: 'body', at: [13, -1.4, 12.8] },
  { name: 'armR', parent: 'body', at: [-13, -1.4, 12.8] },
  { name: 'crest1', parent: 'body', at: [0.5, 0.5, 30.5] },
  { name: 'crest2', parent: 'crest1', at: [5.5, 0.6, 35.9] },
  ...face.joints,
];

const parts = [
  ['body', ell(B, [0, 0, BZ])],
  ['crest1', any(
    ell([3, 2.8, 2.7], [-0.4, -1.4, 32.3]), ell([1.8, 1.7, 1.7], [4.6, -2.2, 31.2]), ell([2.3, 2.2, 2.3], [7.4, 0.6, 30.6]),
    ell([2.6, 2.4, 2.4], [-1, 3.2, 31.8]), ell([1.7, 1.6, 1.6], [-5.2, 1.4, 30.2]), ell([1.6, 1.5, 1.5], [3.6, 3.4, 31.2]),
    ell([0.8, 0.6, 0.6], [-1.6, -3.6, 33.6]), ell([0.6, 0.5, 0.5], [6.6, -1.2, 32]),
    limb([2.4, 0.6, 31], [4.2, 0.6, 34], 0.85, 0.75), limb([4.2, 0.6, 34], [5.4, 0.6, 35.8], 0.75, 0.72))],
  ['arm*', any(ell([2.9, 2.6, 3], [15.4, -1.6, 12.8]), ell([0.7, 0.4, 0.8], [15.4, -4.1, 14]))],
  ['leg*', any(ell([3.7, 3.9, 3.7], [6.6, -0.8, 3.7]), ell([1.8, 1.8, 1.7], [10.2, -1.4, 1.9]), ell([1.4, 0.6, 1], [6.2, -4.2, 3.6]), ell([0.6, 0.4, 0.5], [5.4, -4.4, 4.6]))],
  ['legL', ell([0.75, 0.75, 0.75], [17, -3, 1.1])],   // the stray bubble by the near foot
];

function assign(c, rgb) {
  if (isAny(rgb, WISP, 0.025)) return 'crest2';
  if (near(rgb, STALK, 0.03)) return 'crest1';
  return pick(c, parts);
}

// the wisp flickers on beats counted in u (whole steps per loop), the crown sways a beat behind the body
const flicker = (u, steps, amp = 1) => {
  const k = hash(Math.floor(u * steps) % steps);
  return { crest2: { s: [1 + 0.12 * amp * (k - 0.5), 1, 1 + 0.25 * amp * (k - 0.3)], r: [0, 8 * amp * (k - 0.5), 0] } };
};
const crown = (u, amp, cycles) => wave(['crest1'], u, { cycles, amp: [amp, 0, amp * 0.6] });
const fx = { idle: [2, 2, 24], walk: [4, 2, 12], idle_look: [2, 2, 20], windup: [3, 1, 6], lunge: [6, 1, 6], hurt: [8, 3, 8], recoil: [4, 1, 6], faint: [3, 1, 18], celebrate: [6, 3, 12], enter: [5, 1, 10], exit: [4, 2, 8] };
const add = Object.fromEntries(Object.entries(fx).map(([n, [a, c, s]]) => [n, (t, u) => merge(crown(u, a, c), flicker(u, s, n === 'faint' ? 0.3 : 1))]));
// the wisp curls up small in the faint
add.faint = (t, u) => merge(crown(u, 3, 1), { crest2: { s: Math.max(0.35, 1 - 0.65 * Math.min(1, u / 0.7)) } });

const base = bipedClips({ face, hipH: 5.6, stride: 16, hopH: 3, armSwing: 20, add });

const clips = {
  ...base,

  // fidget: blows on its own wisp, which bends away and springs back up
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
