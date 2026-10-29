// Noxmyth's rig: a hooded void spirit floating over a black-hole orb, its braided tail rising from the orb to the
// robe, arms raised with open palms, fairy wings on its back, a crown and a curl of hair. The tail hangs off the
// body with the orb on its last link. Numbers are scad/noxmyth.scad's (the old model, rigged before its
// sprite-accuracy rebuild).
import { K, TAU, both, merge, osc, rigDef, smooth, win } from './lib/anim.mjs';
import { eyeKit, mirrorEye } from './lib/face.mjs';
import { floaterClips } from './lib/floater.mjs';
import { blobD, capD, chainHit, closest, ellD, fold, isAny, near, side, subFrame } from './lib/geo.mjs';

const SKIN = [0.2, 0.2, 0.32];
const HAIR = [0.12, 0.12, 0.22];
const HAIR_DK = [0.08, 0.08, 0.15];
const CAPE = [[0.14, 0.13, 0.25], [0.55, 0.1, 0.12]];
const WING = [[0.16, 0.16, 0.3], [0.7, 0.16, 0.14]];
const STREAK = [0.75, 0.12, 0.14];

// the tail from the robe down to the orb (the scad draws it bottom-up)
const TAIL = [[1, 0, 17], [2, 0.5, 14], [-1, 0.5, 12], [-2.5, 0, 9], [1, 0, 6.5]];
const TAIL_R = [3.4, 2.8, 2.4, 2.4, 2.6];
const tail = TAIL.slice(0, -1).map((_, i) => `tail${i + 1}`);
const CURL = [[2.6, 1, 36], [5, 1.4, 38.5], [6.6, 1, 37.6], [6, 0.6, 36]];
const CURL_R = [1.6, 1.2, 0.9, 0.4];
const wisp = CURL.slice(0, -1).map((_, i) => `wisp${i + 1}`);

const eyeL = { side: 'L', at: [2.05, -3.85, 31.5], size: 1.6, yaw: 18 };
const face = eyeKit({ eyes: [eyeL, mirrorEye(eyeL)], skin: SKIN });

const joints = [
  { name: 'root', at: [0, 0, 0] },
  { name: 'body', parent: 'root', at: [0, 0, 17] },
  { name: 'head', parent: 'body', at: [0, 0, 27.5] },
  { name: 'armL', parent: 'body', at: [2.6, 0, 26.5] },
  { name: 'handL', parent: 'armL', at: [4.6, -1.5, 25] },
  { name: 'armR', parent: 'body', at: [-2.6, 0, 26.5] },
  { name: 'handR', parent: 'armR', at: [-4.6, -1.5, 25] },
  { name: 'wingL', parent: 'body', at: [3.5, 4, 27] },
  { name: 'wingR', parent: 'body', at: [-3.5, 4, 27] },
  ...tail.map((name, i) => ({ name, parent: i === 0 ? 'body' : tail[i - 1], at: TAIL[i] })),
  ...wisp.map((name, i) => ({ name, parent: i === 0 ? 'head' : wisp[i - 1], at: CURL[i] })),
  ...face.joints,
];

// the wings: mirror_x() translate([3, 0, 28]) rotate([0, 0, 12]) scale([1.5, 1, 1.15]) translate([-3, 0, -28])
const WF = subFrame([3, 0, 28], [0, 0, 12], [1.5, 1, 1.15]);
const inWing = (c) => {
  const q = WF.local(fold(c));
  return q[1] > 3.3 && q[1] < 6 && q[0] > 0.6 && q[2] > -8 && q[2] < 11.5;
};

function assign(c, rgb) {
  const S = side(c);
  const f = fold(c);
  if (inWing(c) && !isAny(rgb, [...CAPE, HAIR, HAIR_DK], 0.03)) return `wing${S}`;
  if (c[2] < 6.5 && Math.abs(c[0] - 1) < 4.5 && Math.abs(c[1]) < 4) return tail[3];   // the black-hole orb
  if (isAny(rgb, CAPE, 0.03)) return 'body';
  if (near(rgb, HAIR_DK, 0.03)) return 'head';                                        // the side locks
  const t = chainHit(c, TAIL, TAIL_R);
  const w = chainHit(c, CURL, CURL_R);
  return closest([
    ['head', Math.min(ellD(c, [5.4, 4.8, 5], [0, 0, 31.5]), ellD(c, [5.8, 4.8, 5.4], [0, 1.6, 32.4]), ellD(c, [4.4, 4, 3.5], [0, 2.5, 27.5]),
      ellD(c, [5, 3.4, 2.2], [0.6, -1.4, 35.8]), c[2] > 36.2 && Math.hypot(c[0], c[1] - 0.6) < 4.8 ? 0.5 : 9, capD(f, [4.4, 0.6, 31], [5.8, 0.4, 21], 1.5) * 1.05)],
    ['body', Math.min(blobD(c, [[[3.6, 3, 2], [0, 0, 24]], [[5, 4, 3], [0, 0.4, 19]], [[3, 2.6, 2], [0.6, 0.2, 16]]]),
      blobD(c, [[[3.2, 2.4, 2.2], [0, -0.4, 25]], [[2.2, 2, 1.4], [0, -0.6, 22.6]]]), ellD(f, [1.8, 1.8, 1.4], [3, -0.2, 26.6]),
      near(rgb, STREAK, 0.03) && c[2] < 24 && c[1] < -2.5 ? 0.5 : 9)],
    [`arm${S}`, capD(f, [2.6, 0, 26.5], [4.6, -1.5, 25], 0.9, 0.8)],
    [`hand${S}`, Math.min(capD(f, [4.6, -1.5, 25], [5.6, -2.5, 27.4], 1, 0.9), ellD(f, [0.9, 0.5, 1.1], [5.8, -2.8, 28.2]))],
    [tail[Math.min(3, t.i)], t.d * 1.05],
    [wisp[w.i], w.d],
  ]);
}

// the wings beat about the vertical (rz > 0 sweeps a +X wing back)
const beat = (amp, cycles, u, open = 0) => both('wing', { r: [0, -open, amp * osc(u, cycles)] });

const base = floaterClips({
  face, tail, wisp, bob: 0.6,
  add: {
    idle: (t, u) => beat(6, 2, u),
    walk: (t, u) => beat(14, 2, u),
    windup: (t, u) => beat(0, 1, u, -14 * smooth(u / 0.8)),
    lunge: (t, u) => beat(10, 1, u, 10 * win(u, 0.2, 0.7, 0.1)),
    hurt: (t, u) => beat(12, 3, u, 16 * K(u, [[0, 0], [0.2, 1], [1, 0.4]])),
    faint: (t, u) => beat(0, 1, u, -20 * smooth((u - 0.2) / 0.6)),
    celebrate: (t, u) => beat(22, 3, u, 12),
    enter: (t, u) => beat(14, 1, u, 10 * win(u, 0.4, 0.95, 0.12)),
  },
});
delete base.idle_cackle;   // a stern face: no grin to cackle with

const clips = {
  ...base,

  // fidget: holds out its palms, the black hole drawing a slow orbit, the wings fanning, eyes half shut in focus
  idle_gravity: {
    seconds: 2.8,
    pose: (t, u) => {
      const on = K(u, [[0, 0], [0.18, 1], [0.78, 1], [0.92, 0]]);
      const orbit = Math.sin(TAU * u * 2) * on;
      return merge({
        ...face.pose('open', 0.5 * on),
        body: { p: [0, 0, 0.6 + 0.5 * on] },
        head: { r: [8 * on, 0, 0] },
        ...both('arm', { r: [-20 * on, -10 * on, 0] }),
        ...both('hand', { r: [-15 * on, 0, 10 * on] }),
        tail1: { r: [6 * orbit, 0, 0] },
        tail3: { r: [0, 8 * orbit, 0] },
      }, beat(8, 4, u, 8 * on));
    },
  },
};

export default rigDef({ joints, assign, extras: face.extras, clips });
