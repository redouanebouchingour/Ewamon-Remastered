// Flampling's rig: a round fire chick hovering in the air (the egg body is its head), a flame crest, little wings with
// burning tips, dangling legs. Numbers are scad/flampling.scad's.
import { K, TAU, hash, merge, osc, rigDef, win } from './lib/anim.mjs';
import { birdClips } from './lib/bird.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { blobD, closest, fold, isAny, near, petalD, side } from './lib/geo.mjs';

const BODY = [0.9, 0.43, 0.17];
const LEG = [0.2, 0.16, 0.17];
// crest and wing fire: red, orange, amber, yellow, cream
const FIRE = [[0.86, 0.2, 0.05], [0.98, 0.42, 0.06], [0.97, 0.62, 0.06], [1, 0.8, 0.2], [1, 0.9, 0.6]];

// scad: body hull of two ellipsoids, its round of fluff lobes, the wing paddles and their feather fingers
const LO = [11.2, 10.2, 8.6]; const LOC = [0, 0, 19.4];
const UP = [9.6, 9.2, 8.6]; const UPC = [0, 0, 23.1];
const BODYB = [[LO, LOC], [UP, UPC]];
const er = (a, z, r, c) => { const q = 1 - ((z - c[2]) / r[2]) ** 2; return q > 0 ? Math.sqrt(q) / Math.hypot(Math.cos(a) / r[0], Math.sin(a) / r[1]) : 0; };
const lobes = Array.from({ length: 13 }, (_, i) => {
  const a = 9 + (i * 360) / 13; const k = 0.85 + (0.3 * ((i * 7) % 5)) / 4; const zz = 14.4 + ((i * 3) % 4) * 0.5 - 0.7;
  const A = (a * Math.PI) / 180; const rr = Math.max(er(A, zz, LO, LOC), er(A, zz, UP, UPC)) - 0.8;
  return { r: [1.2, 3.4 * k, 2.6 * k], p: [rr * Math.cos(A), rr * Math.sin(A), zz], rot: [0, 30, a] };
});
const PADDLE = [[[3.0, 1.9, 2.8], [8.4, 0.6, 19.6]], [[2.2, 1.4, 1.8], [12.0, -0.6, 20.4]], [[1.4, 1.1, 1.2], [14.2, -1.6, 21.0]]];
const fingers = [0, 1, 2].map((k) => ({ r: [2.1, 1.05, 0.95], p: [10.6 + k * 1.5, 0.5 - k * 0.5, 18.4 + k * 0.45], rot: [0, 28 - k * 8, -12] }));

const eyeL = { side: 'L', at: [4.4, -7.4, 25.4], size: 2.0, yaw: 15, flat: 0.5 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], parent: 'body', skin: BODY });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'legL', parent: 'root', at: [3.1, -0.6, 12.0] },
  { name: 'legR', parent: 'root', at: [-3.1, -0.6, 12.0] },
  { name: 'body', parent: 'root', at: [0, 0, 12] },
  { name: 'wingL', parent: 'body', at: [8.5, 0.4, 19.8] },
  { name: 'wingR', parent: 'body', at: [-8.5, 0.4, 19.8] },
  { name: 'crest1', parent: 'body', at: [-2.4, 0.6, 30.6] },
  ...face.joints,
];

function assign(c, rgb) {
  const f = fold(c);
  if (near(rgb, LEG) && c[2] < 12.5) return `leg${side(c)}`;
  if (isAny(rgb, FIRE, 0.03)) {
    if (c[2] > 29.5 && Math.abs(c[0]) < 9) return 'crest1';
    if (f[0] > 10.5) return `wing${side(c)}`;
    return 'body';   // the back flame mark, the eye highlights
  }
  if (Math.hypot(f[0], c[1] + 7, c[2] - 24) < 7) return 'body';   // the face
  const wing = Math.min(blobD(f, PADDLE), ...fingers.map((q) => petalD(f, q.r, q.p, q.rot)));
  const body = Math.min(blobD(c, BODYB) * 0.98, ...lobes.map((q) => petalD(c, q.r, q.p, q.rot)));
  return closest([[`wing${side(c)}`, wing], ['body', body]]);
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
