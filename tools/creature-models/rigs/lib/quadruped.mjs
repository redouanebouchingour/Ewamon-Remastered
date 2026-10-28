// Clips for a creature on four legs (rigDef() drops entries for joints a creature lacks):
//   root (on the ground under the body)   legFL / legFR / legBL / legBR (off the root, pivots at the hips and shoulders)
//   body (off the root)   head (off the body)   jaw, earL / earR (off the head)   tail1…tailN (a chain off the body)
//   mane1…maneN (a chain off the head: a crest, a streamer of flame)   the eyeKit() lids and strokes (face.mjs)
// The body is long along Y with the head at -Y, so on the body and head rx > 0 dips the nose; on a tail pointing
// back, rx > 0 raises it and rz swings it to the side. A hanging leg swings its foot back with rx > 0.
// Options: face, tail, mane (chain names), hipH (leg pivot height above the soles), stride (deg), add (layers).
import { K, TAU, hash, merge, mirror, osc, shake, smooth, win, wave } from './anim.mjs';
import { blinks } from './face.mjs';

/** The four legs: `front` / `back` are the left legs' poses, the right ones mirror. */
export const legs = (front, back = front, frontR = front, backR = back) => ({
  legFL: front, legFR: mirror(frontR), legBL: back, legBR: mirror(backR),
});

export function quadrupedClips(o = {}) {
  const { face = null, tail = [], mane = [], hipH = 8, stride = 16, add = {}, flicker = 0 } = o;
  const F = (kind, blink = 0) => (face ? face.pose(kind, blink) : {});
  const ears = (l, r = l) => ({ earL: { r: l }, earR: { r: mirror({ r }).r } });
  const tailWag = (u, amp = 10, cycles = 2, lift = 0) => merge(
    wave(tail, u, { cycles, amp: [0, 0, amp], lag: 0.1, grow: 0.3 }),
    Object.fromEntries(tail.map((n, i) => [n, { r: [lift * (i === 0 ? 1 : 0.4), 0, 0] }])),
  );
  // a streamer (a flame mane, a crest) waving, and with `flicker` its links (and the tail's) flickering in size on
  // `steps` beats per clip, wrapping at u = 1 so a loop closes
  const maneFx = (t, u, cycles = 2, amp = 1, steps = 12) => merge(
    wave(mane, u, { cycles, amp: [5 * amp, 0, 4 * amp], lag: 0.15, grow: 0.4 }),
    flicker > 0 ? Object.fromEntries([...mane, ...tail].map((n, i) => [n, { s: 1 + flicker * (hash((Math.floor(u * steps) % steps) * 3.1 + i * 7.7) - 0.5) }])) : {},
  );
  const withAdd = (name, pose) => (t, u) => merge(pose(t, u), add[name]?.(t, u));

  const clips = {
    // breathing, a look round, blinks, an ear twitch, a slow wag
    idle: {
      seconds: 4,
      pose: (t, u) => {
        const look = K(u, [[0, 0], [0.12, 0], [0.22, 16], [0.44, 16], [0.54, -12], [0.8, -12], [0.9, 0]]);
        return merge({
          body: { p: [0, 0, 0.2 * (Math.sin((TAU * t) / 2) * 0.5 + 0.5)], r: [0.8 * osc(u, 2, 0.3), 1.2 * osc(u, 1), 1.5 * osc(u, 1, 0.5)] },
          head: { r: [2.5 * osc(u, 2, 0.6) - 3 * win(u, 0.6, 0.7, 0.04), 0.3 * look, look] },
          ...F('open', blinks(u, [[0.3, 0.34], [0.84, 0.87], [0.89, 0.92]])),
          ...ears([3 * osc(u, 2, 0.2) - 16 * win(u, 0.66, 0.7, 0.015), 0, 0], [3 * osc(u, 2, 0.5), 0, 0]),
        }, tailWag(u, 8, 2), maneFx(t, u, 4, 1, 48));
      },
    },

    // a trot: diagonal pairs (front-left with back-right) swing together, the body dips over the planted pair
    walk: {
      seconds: 0.7,
      pose: (t, u) => {
        const s = osc(u, 1);
        const dip = -hipH * (1 - Math.cos((stride * Math.abs(s) * Math.PI) / 180));
        return merge({
          root: { p: [0, 0, dip + 0.25 * Math.abs(osc(u, 2))] },
          ...legs({ r: [-stride * s, 0, 0] }, { r: [stride * s, 0, 0] }, { r: [stride * s, 0, 0] }, { r: [-stride * s, 0, 0] }),
          body: { r: [1.5 * osc(u, 2, 0.25), 2.5 * s, 2 * s] },
          head: { r: [-2 + 3 * osc(u, 2, 0.1), -1.5 * s, -3 * s] },
          ...F('open'),
          ...ears([-6 + 4 * osc(u, 2, 0.3), 0, 0]),
        }, tailWag(u, 10, 1, 6), maneFx(t, u, 2, 1.6, 8));
      },
    },

    // fidget: nose to the ground, sniff-sniff, then a sneeze that jolts the whole body
    idle_sniff: {
      seconds: 2.6,
      pose: (t, u) => {
        const down = K(u, [[0, 0], [0.14, 1], [0.6, 1], [0.7, 0.3], [0.74, 0.6], [0.8, -0.2], [0.95, 0]]);
        const sniff = osc(u, 10) * win(u, 0.16, 0.58, 0.04);
        const sneeze = win(u, 0.74, 0.86, 0.02);
        return merge({
          body: { r: [5 * down - 4 * sneeze, 0, 0], p: [0, 0, -0.3 * down] },
          head: { r: [24 * down + 2 * sniff - 18 * sneeze, 0, 8 * down * osc(u, 1, 0.1)] },
          ...F(sneeze > 0.2 ? 'shut' : 'open', blinks(u, [[0.66, 0.72]])),
          ...ears([-10 * sneeze + 6 * down, 0, 0]),
        }, tailWag(u, 6, 2), maneFx(t, u, 4, 1 + 3 * sneeze));
      },
    },

    // fidget: the wet-dog shake, from the head to the tail
    idle_shake: {
      seconds: 1.6,
      pose: (t, u) => {
        const k = win(u, 0.1, 0.8, 0.06);
        const sh = Math.sin(TAU * 7 * u) * k;
        return merge({
          body: { r: [0, 9 * sh, 0] },
          head: { r: [0, -14 * sh, 4 * sh] },
          ...F(k > 0.3 ? 'shut' : 'open'),
          ...ears([0, 20 * sh, 0], [0, 20 * sh, 0]),
        }, wave(tail, u, { cycles: 7, amp: [0, 0, 18 * k], lag: 0.15 }), maneFx(t, u, 8, 1 + 2 * k));
      },
    },

    // fidget: a happy wag, the eyes ^ ^, a little hop of the front paws
    idle_wag: {
      seconds: 2,
      pose: (t, u) => {
        const on = win(u, 0.08, 0.9, 0.08);
        const tap = Math.max(0, osc(u, 4)) * on;
        return merge({
          body: { r: [-3 * tap, 0, 4 * osc(u, 6) * on] },
          head: { r: [-8 * on, 6 * osc(u, 2) * on, 10 * on] },
          ...legs({ r: [-14 * tap, 0, 0] }, { r: [0, 0, 0] }, { r: [-14 * tap, 0, 0] }, { r: [0, 0, 0] }),
          ...F(on > 0.4 ? 'happy' : 'open'),
          ...ears([-10 * on, 0, 0]),
        }, wave(tail, u, { cycles: 8, amp: [0, 0, 12 * on], lag: 0.08, grow: 0.2 }), tailWag(u, 0, 1, 14 * on), maneFx(t, u, 4, 1.5));
      },
    },

    // battle: crouches to pounce, nose down, the tail stiff and high, eyes narrowed
    windup: {
      seconds: 0.25,
      pose: (t, u) => {
        const w = smooth(u / 0.8);
        return merge({
          root: { p: [0, 0, -0.6 * w] },
          body: { r: [6 * w, 0, 0] },
          head: { r: [8 * w, 0, 0] },
          ...legs({ r: [-10 * w, 0, 0] }, { r: [8 * w, 0, 0] }),
          ...F('open', 0.45 * w),
          ...ears([-18 * w, 0, 0]),
        }, tailWag(u, 3, 3, 18 * w), maneFx(t, u, 1, 2));
      },
    },

    // battle: the pounce: springs, front legs reaching, and bites down at u = 0.4
    lunge: {
      seconds: 0.3,
      pose: (t, u) => {
        const spring = K(u, [[0, 0], [0.22, 1], [0.4, 0.3], [1, 0]]);
        const bite = K(u, [[0.15, 0], [0.4, 1], [0.6, 1], [1, 0]]);
        return merge({
          root: { p: [0, 0, 1.2 * spring] },
          body: { r: [-8 * spring + 5 * bite, 0, 0] },
          head: { r: [-10 * spring + 16 * bite, 0, 0] },
          jaw: { r: [30 * spring * (1 - bite), 0, 0] },
          ...legs({ r: [-26 * spring - 6 * bite, 0, 0] }, { r: [22 * spring, 0, 0] }),
          ...F('open', 0.35),
          ...ears([-20, 0, 0]),
        }, tailWag(u, 4, 2, 12), maneFx(t, u, 1, 2.5));
      },
    },

    // battle: hit. The head snaps up and back, eyes > <, the tail tucks, a shake
    hurt: {
      seconds: 0.26,
      pose: (t, u) => {
        const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.45]]);
        const sh = shake(u, 5);
        return merge({
          body: { r: [-6 * k, 4 * sh, 3 * sh] },
          head: { r: [-22 * k, 8 * sh, 6 * sh] },
          jaw: { r: [14 * k, 0, 0] },
          ...legs({ r: [0, -10 * k, 0] }),
          ...F(u > 0.06 ? 'squeeze' : 'open'),
          ...ears([-26 * k, 0, 0]),
        }, tailWag(u, 0, 1, -18 * k), maneFx(t, u, 2, 2));
      },
    },

    // battle: a flinch, eyes shut
    recoil: {
      seconds: 0.25,
      pose: (t, u) => {
        const k = K(u, [[0, 0], [0.4, 1], [1, 0]]);
        return merge({
          body: { r: [-4 * k, 0, 0] },
          head: { r: [-12 * k, 0, 5 * k] },
          ...F(k > 0.3 ? 'shut' : 'open', k * 3),
          ...ears([-16 * k, 0, 0]),
        }, tailWag(u, 0, 1, -10 * k), maneFx(t, u, 1));
      },
    },

    // battle: knocked out. The legs splay out and the body sinks onto them, the head droops to the ground, x x
    faint: {
      seconds: 0.9,
      pose: (t, u) => {
        const jolt = win(u, 0, 0.2, 0.05);
        const down = smooth((u - 0.15) / 0.6);
        const splay = 48 * down;
        return merge({
          root: { p: [0, 0, -hipH * (1 - Math.cos((splay * Math.PI) / 180))] },
          ...legs({ r: [0, -splay, 0] }),
          body: { r: [-6 * jolt + 4 * down, 0, 5 * down] },
          head: { r: [-14 * jolt + 26 * down, 10 * down, -10 * down] },
          jaw: { r: [10 * down, 0, 0] },
          ...F(u > 0.1 ? 'dizzy' : 'open'),
          ...ears([22 * down, -18 * down, 0]),
        }, tailWag(u, 0, 1, -14 * down), maneFx(t, u, 1, 1 - 0.8 * down));
      },
    },

    // battle / evolution: a play-bow and two hops, the tail going, ^ ^
    celebrate: {
      seconds: 0.6,
      pose: (t, u) => {
        const hp = Math.abs(Math.sin(TAU * u));
        const up = win(u, 0, 1, 0.15);
        return merge({
          root: { p: [0, 0, 1.6 * hp] },
          body: { r: [-6 * hp, 0, 0] },
          head: { r: [-12 * up, 0, 8 * up] },
          jaw: { r: [16 * up, 0, 0] },
          ...legs({ r: [-18 * hp, 0, 0] }, { r: [12 * hp, 0, 0] }),
          ...F('happy'),
          ...ears([-14 * up, 0, 0]),
        }, wave(tail, u, { cycles: 4, amp: [0, 0, 12], lag: 0.08, grow: 0.2 }), tailWag(u, 0, 1, 16 * up), maneFx(t, u, 2, 2.5));
      },
    },

    // sent out: lands from a leap in a crouch, rises with an overshoot, eyes open
    enter: {
      seconds: 0.45,
      pose: (t, u) => {
        const land = 1 - smooth((u - 0.15) / 0.4);
        const over = win(u, 0.45, 0.9, 0.12);
        return merge({
          root: { p: [0, 0, -0.8 * land] },
          body: { r: [5 * land - 4 * over, 0, 0], s: [1, 1, 1 - 0.06 * land + 0.04 * over] },
          head: { r: [12 * land - 10 * over, 0, 0] },
          ...legs({ r: [-8 * land, 0, 0] }, { r: [8 * land, 0, 0] }),
          ...F(land > 0.6 ? 'shut' : 'open'),
          ...ears([16 * land - 14 * over, 0, 0]),
        }, tailWag(u, 10, 1, 16 * over), maneFx(t, u, 1, 1 + over));
      },
    },

    // recalled: a look back at the camera with a wag, ^ ^, then the eyes shut
    exit: {
      seconds: 0.35,
      pose: (t, u) => {
        const up = win(u, 0, 0.85, 0.2);
        return merge({
          head: { r: [-6 * up, 0, 18 * up] },
          body: { r: [0, 0, 6 * up] },
          ...F(u < 0.85 ? 'happy' : 'shut'),
          ...ears([-10 * up, 0, 0]),
        }, wave(tail, u, { cycles: 2, amp: [0, 0, 11 * up], lag: 0.08, grow: 0.2 }), maneFx(t, u, 1));
      },
    },
  };
  for (const [name, c] of Object.entries(clips)) c.pose = withAdd(name, c.pose);
  return clips;
}
