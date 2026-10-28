// Clips for a serpent rearing up out of its coil (rigDef() drops entries for joints a creature lacks):
//   root (the coil on the ground: it stays put)   spine1…spineN (the upright body, a chain off the root, base first)
//   head (off the last spine link)   jaw (off the head)   armL / armR, foreL / foreR (off a spine link)
//   tail1…tailN (the tail tip rising off the coil)   fin… / mane… any extra chain off the head (`mane`)
//   the eyeKit() lids and strokes
// On the spine rx > 0 leans forward (towards -Y), rz twists, ry leans to the creature's left (+X).
// The jaw opens with rx > 0 in the head's frame.
// Options: face, spine, tail, mane (chain names), add (layers).
import { K, TAU, both, merge, osc, shake, smooth, win, wave } from './anim.mjs';
import { blinks } from './face.mjs';

export function serpentClips(o = {}) {
  const { face = null, spine = [], tail = [], mane = [], add = {} } = o;
  const F = (kind, blink = 0) => (face ? face.pose(kind, blink) : {});
  const bend = (r) => Object.fromEntries(spine.map((n) => [n, { r }]));
  const sway = (u, amp = 3, cycles = 1, roll = 0) => wave(spine, u, { cycles, amp: [0, roll, amp], lag: 0.12, grow: 0.1 });
  const flick = (u, amp = 8, cycles = 2, lift = 0) => merge(
    wave(tail, u, { cycles, amp: [amp * 0.4, 0, amp], lag: 0.15, grow: 0.3 }),
    Object.fromEntries(tail.map((n) => [n, { r: [lift, 0, 0] }])),
  );
  const maneFx = (u, amp = 4, cycles = 2) => wave(mane, u, { cycles, amp: [amp, 0, amp * 0.5], lag: 0.15 });
  const withAdd = (name, pose) => (t, u) => merge(pose(t, u), add[name]?.(t, u));

  const clips = {
    // a slow S-sway up the body, breathing, a look round, blinks, the tail tip curling
    idle: {
      seconds: 4,
      pose: (t, u) => {
        const look = K(u, [[0, 0], [0.12, 0], [0.22, 18], [0.44, 18], [0.54, -14], [0.8, -14], [0.9, 0]]);
        return merge({
          ...bend([1.2 * osc(u, 2, 0.3), 0, 0]),
          head: { r: [3 * osc(u, 2, 0.6), 0.3 * look, look] },
          jaw: { r: [2 * (osc(u, 2) * 0.5 + 0.5), 0, 0] },
          ...F('open', blinks(u, [[0.32, 0.36], [0.84, 0.87], [0.89, 0.92]])),
          ...both('arm', { r: [5 * osc(u, 1, 0.2), 0, 4 * osc(u, 2)] }, { r: [5 * osc(u, 1, 0.7), 0, 4 * osc(u, 2, 0.5)] }),
          ...both('fore', { r: [-6 * osc(u, 2, 0.4), 0, 0] }),
        }, sway(u, 3, 1, 2), flick(u, 10, 2), maneFx(u, 4, 2));
      },
    },

    // slithering: a strong side-to-side wave up the body, the head steadier, the tail lashing
    walk: {
      seconds: 0.8,
      pose: (t, u) => merge({
        ...bend([4, 0, 0]),
        head: { r: [-4, -3 * osc(u, 1, -0.3), -6 * osc(u, 1, -0.3)] },
        ...F('open'),
        ...both('arm', { r: [10 * osc(u, 1), 0, 0] }, { r: [-10 * osc(u, 1), 0, 0] }),
      }, sway(u, 7, 1, 6), flick(u, 16, 1), maneFx(u, 6, 2)),
    },

    // fidget: draws back and hisses, the jaw wide and trembling, the eyes narrowed
    idle_hiss: {
      seconds: 2.2,
      pose: (t, u) => {
        const on = win(u, 0.12, 0.78, 0.1);
        const tr = osc(u, 16) * on;
        return merge({
          ...bend([-4 * on, 0, 0]),
          head: { r: [12 * on + 1.5 * tr, 0, 8 * on] },
          jaw: { r: [28 * on + 3 * tr, 0, 0] },
          ...F('open', 0.5 * on),
          ...both('arm', { r: [-20 * on, -15 * on, 0] }),
          ...both('fore', { r: [-30 * on, 0, 0] }),
        }, flick(u, 4 + 10 * on, 6, 10 * on), maneFx(u, 3 + 8 * on, 6));
      },
    },

    // fidget: rears up tall, looks down its nose to one side and the other, a curious tilt
    idle_rear: {
      seconds: 2.8,
      pose: (t, u) => {
        const up = K(u, [[0, 0], [0.18, 1], [0.78, 1], [0.95, 0]]);
        const look = K(u, [[0.18, 0], [0.32, 22], [0.5, 22], [0.62, -18], [0.76, -18], [0.9, 0]]);
        return merge({
          ...bend([-5 * up, 0, 0]),
          head: { r: [14 * up, -10 * up * Math.sign(look) * Math.min(1, Math.abs(look) / 18), look] },
          ...F('open', blinks(u, [[0.54, 0.58]])),
        }, sway(u, 2, 1), flick(u, 8, 2, 8 * up), maneFx(u, 4, 2));
      },
    },

    // battle: coils back into an S, the head low and level, the jaw parting
    windup: {
      seconds: 0.25,
      pose: (t, u) => {
        const w = smooth(u / 0.8);
        return merge({
          ...bend([-9 * w, 0, 0]),
          head: { r: [18 * w, 0, 0] },
          jaw: { r: [10 * w, 0, 0] },
          ...F('open', 0.45 * w),
          ...both('arm', { r: [20 * w, -10 * w, 0] }),
        }, flick(u, 6, 2, 12 * w), maneFx(u, 6, 1));
      },
    },

    // battle: the strike, jaws wide, snapping shut on the hit at u = 0.4
    lunge: {
      seconds: 0.3,
      pose: (t, u) => {
        const back = K(u, [[0, 1], [0.12, 0.6], [0.3, 0]]);
        const hit = K(u, [[0.08, 0], [0.38, 1], [0.62, 1], [1, 0]]);
        const open = K(u, [[0, 0.3], [0.25, 1], [0.4, 0], [1, 0]]);
        return merge({
          ...bend([-9 * back + 13 * hit, 0, 0]),
          head: { r: [18 * back - 8 * hit, 0, 0] },
          jaw: { r: [36 * open, 0, 0] },
          ...F('open', 0.35),
          ...both('arm', { r: [20 * back - 30 * hit, -10, 0] }),
        }, flick(u, 8, 1, 10), maneFx(u, 8, 1));
      },
    },

    // battle: hit. The neck snaps back, the jaw drops, eyes > <, the tail whips
    hurt: {
      seconds: 0.26,
      pose: (t, u) => {
        const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.45]]);
        const sh = shake(u, 5);
        return merge({
          ...bend([-7 * k, 3 * sh, 2 * sh]),
          head: { r: [-18 * k, 6 * sh, 6 * sh] },
          jaw: { r: [18 * k, 0, 0] },
          ...F(u > 0.06 ? 'squeeze' : 'open'),
          ...both('arm', { r: [10 * k, -30 * k, 0] }),
        }, flick(u, 18, 3), maneFx(u, 10, 2));
      },
    },

    // battle: a flinch
    recoil: {
      seconds: 0.25,
      pose: (t, u) => {
        const k = K(u, [[0, 0], [0.4, 1], [1, 0]]);
        return merge({
          ...bend([-5 * k, 0, 0]),
          head: { r: [-10 * k, 0, 8 * k] },
          ...F(k > 0.3 ? 'shut' : 'open', k * 3),
          ...both('arm', { r: [10 * k, -14 * k, 0] }),
        }, flick(u, 8, 1), maneFx(u, 4, 1));
      },
    },

    // battle: knocked out. A jolt, then the body slumps forward and to one side over its coil, head down, x x
    faint: {
      seconds: 0.9,
      pose: (t, u) => {
        const jolt = win(u, 0, 0.2, 0.05);
        const down = smooth((u - 0.15) / 0.6);
        return merge({
          ...bend([-6 * jolt + 13 * down, 8 * down, 3 * down]),
          head: { r: [-14 * jolt + 30 * down, 10 * down, -10 * down] },
          jaw: { r: [14 * down, 0, 0] },
          ...F(u > 0.1 ? 'dizzy' : 'open'),
          ...both('arm', { r: [16 * down, 20 * down, 0] }),
          ...both('fore', { r: [10 * down, 0, 0] }),
        }, Object.fromEntries(tail.map((n, i) => [n, { r: [-18 * down * (1 + 0.2 * i), 0, 0] }])), maneFx(u, 2 * (1 - down), 1));
      },
    },

    // battle / evolution: rears up and sways happily, mouth open in a grin, ^ ^, the tail wagging
    celebrate: {
      seconds: 0.6,
      pose: (t, u) => {
        const up = win(u, 0, 1, 0.15);
        return merge({
          ...bend([-4 * up, 0, 0]),
          head: { r: [-10 * up, 8 * Math.sin(TAU * 2 * u) * up, 0] },
          jaw: { r: [16 * up, 0, 0] },
          ...F('happy'),
          ...both('arm', { r: [-30 * up, -30 * up + 10 * Math.sin(TAU * 3 * u), 0] }),
        }, sway(u, 6, 2, 5), flick(u, 18, 3), maneFx(u, 8, 3));
      },
    },

    // sent out: uncoils, rising from a crouch with an overshoot, eyes opening
    enter: {
      seconds: 0.45,
      pose: (t, u) => {
        const low = 1 - smooth((u - 0.1) / 0.45);
        const over = win(u, 0.45, 0.9, 0.12);
        return merge({
          ...bend([14 * low - 4 * over, 0, 0]),
          head: { r: [12 * low - 8 * over, 0, 0] },
          ...F(low > 0.5 ? 'shut' : 'open'),
          ...both('arm', { r: [10 * low, -20 * over, 0] }),
        }, flick(u, 10, 1, 10 * over), maneFx(u, 6, 1));
      },
    },

    // recalled: a nod to the camera side with ^ ^, the tail waving goodbye
    exit: {
      seconds: 0.35,
      pose: (t, u) => {
        const up = win(u, 0, 0.85, 0.2);
        return merge({
          head: { r: [10 * Math.sin(TAU * u) * up, 0, 16 * up] },
          ...F(u < 0.85 ? 'happy' : 'shut'),
          armL: { r: [-40 * up, -30 * up + 15 * Math.sin(TAU * 2 * u), 0] },
        }, flick(u, 20 * up, 2), maneFx(u, 4, 1));
      },
    },
  };
  for (const [name, c] of Object.entries(clips)) c.pose = withAdd(name, c.pose);
  return clips;
}
