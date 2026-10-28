// Clips for a creature that floats (a ghost, a wisp, a spirit; rigDef() drops entries for joints a creature lacks):
//   root (on the ground)   body (off the root; it bobs, only upwards when a tail or hem touches the ground)
//   head (off the body)   armL / armR, handL / handR (off the body)   core (a glowing heart, off the body: it pulses)
//   tail1…tailN (a wisp hanging off the body)   wisp1…wispN (a chain off the head: a curl, a flame, a plume)
//   eyes / mouth (decals or glows on the head: scaled, never below ~0.75, a decal shrinking opens its hole)
//   the eyeKit() lids and strokes when it has lib.scad eyes
// An arm sticking out along +X swings back with rz > 0 and lifts with ry < 0; a hanging tail streams back with rx > 0.
// Options: face, tail, wisp (chain names), bob (scad units), add (layers).
import { K, TAU, both, merge, osc, shake, smooth, win, wave } from './anim.mjs';
import { blinks } from './face.mjs';

export function floaterClips(o = {}) {
  const { face = null, tail = [], wisp = [], bob = 0.9, add = {} } = o;
  const F = (kind, blink = 0) => (face ? face.pose(kind, blink) : {});
  const lift = (t, period = 2, amp = bob) => (Math.sin((TAU * t) / period) * 0.5 + 0.5) * amp;
  const trail = (u, amp = 6, cycles = 1, back = 0) => merge(
    wave(tail, u, { cycles, amp: [amp * 0.6, 0, amp], lag: 0.12, grow: 0.3 }),
    Object.fromEntries(tail.map((n, i) => [n, { r: [back * (0.6 + 0.2 * i), 0, 0] }])),
  );
  const curl = (u, amp = 6, cycles = 2) => wave(wisp, u, { cycles, amp: [amp, 0, amp * 0.7], lag: 0.15, grow: 0.3 });
  const withAdd = (name, pose) => (t, u) => merge(pose(t, u), add[name]?.(t, u));

  const clips = {
    // bobbing on the air, swaying, arms drifting, the wisps trailing a beat behind, the core pulsing
    idle: {
      seconds: 4,
      pose: (t, u) => {
        const look = K(u, [[0, 0], [0.15, 0], [0.25, 15], [0.45, 15], [0.55, -12], [0.82, -12], [0.92, 0]]);
        return merge({
          body: { p: [0, 0, lift(t)], r: [2 * osc(u, 2, 0.2), 3 * osc(u, 1), 3 * osc(u, 1, 0.4)] },
          head: { r: [3 * osc(u, 2, 0.5), 0.3 * look, look] },
          core: { s: 1 + 0.12 * (osc(u, 4) * 0.5 + 0.5) },
          ...F('open', blinks(u, [[0.36, 0.4], [0.86, 0.9]])),
          ...both('arm', { r: [6 * osc(u, 2, 0.1), -6 * osc(u, 2, 0.3), 6 * osc(u, 1)] }, { r: [6 * osc(u, 2, 0.6), -6 * osc(u, 2, 0.8), 6 * osc(u, 1, 0.5)] }),
          ...both('hand', { r: [0, -8 * osc(u, 2, 0.5), 0] }),
        }, trail(u, 8, 2), curl(u, 6, 2));
      },
    },

    // gliding: leaning into it, the arms swept back, the tail streaming behind
    walk: {
      seconds: 0.8,
      pose: (t, u) => merge({
        body: { p: [0, 0, lift(t, 0.8, bob * 0.6)], r: [10, 3 * osc(u, 1), 4 * osc(u, 1, 0.25)] },
        head: { r: [-6 + 2 * osc(u, 2), 0, -3 * osc(u, 1)] },
        core: { s: 1.08 },
        ...F('open'),
        ...both('arm', { r: [0, -4, 30 + 6 * osc(u, 2)] }, { r: [0, -4, 30 + 6 * osc(u, 2, 0.5)] }),
      }, trail(u, 10, 2, 9), curl(u, 10, 2)),
    },

    // fidget: the head spins right round, the body counters, the arms flail
    idle_spin: {
      seconds: 1.8,
      pose: (t, u) => {
        const spin = K(u, [[0, 0], [0.12, -20], [0.62, 380], [0.72, 355], [0.82, 360]]);
        const on = win(u, 0.1, 0.85, 0.06);
        return merge({
          body: { p: [0, 0, lift(t, 1.8) + 0.6 * on], r: [0, 0, -12 * on] },
          head: { r: [0, 0, spin] },
          core: { s: 1 + 0.15 * on },
          ...F(on > 0.3 ? 'happy' : 'open'),
          ...both('arm', { r: [0, -30 * on + 15 * osc(u, 6) * on, 0] }),
        }, trail(u, 14 * on, 3), curl(u, 18 * on, 3));
      },
    },

    // fidget: a fit of cackling, the whole body shaking, the head thrown back, the grin wide
    idle_cackle: {
      seconds: 2,
      pose: (t, u) => {
        const on = win(u, 0.08, 0.85, 0.08);
        const ha = Math.abs(Math.sin(TAU * 8 * u)) * on;
        return merge({
          body: { p: [0, 0, lift(t, 2) + 0.8 * ha], r: [-6 * on, 0, 3 * osc(u, 4) * on] },
          head: { r: [-14 * on - 4 * ha, 0, 5 * osc(u, 2) * on] },
          mouth: { s: [1 + 0.15 * on, 1, 1 + 0.35 * on + 0.1 * ha] },
          core: { s: 1 + 0.15 * ha },
          ...F(on > 0.3 ? 'happy' : 'open'),
          ...both('arm', { r: [0, 10 * on, -40 * on] }),
        }, trail(u, 8, 4), curl(u, 10, 4));
      },
    },

    // battle: rises and draws back, arms raised behind, the core flaring
    windup: {
      seconds: 0.25,
      pose: (t, u) => {
        const w = smooth(u / 0.8);
        return merge({
          body: { p: [0, 0, bob + 1.2 * w], r: [-10 * w, 0, -8 * w] },
          head: { r: [6 * w, 0, 6 * w] },
          eyes: { s: [1, 1, 1 - 0.2 * w] },
          core: { s: 1 + 0.2 * w },
          ...F('open', 0.45 * w),
          ...both('arm', { r: [0, -30 * w, 40 * w] }),
        }, trail(u, 6, 1, -6 * w), curl(u, 8, 1));
      },
    },

    // battle: a swoop at the foe, arms reaching, hitting at u = 0.4
    lunge: {
      seconds: 0.3,
      pose: (t, u) => {
        const back = K(u, [[0, 0.6], [0.12, 1], [0.22, 0]]);
        const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]);
        return merge({
          body: { p: [0, 0, bob + 1.2 * back - 0.6 * hit], r: [-10 * back + 20 * hit, 0, 0] },
          head: { r: [4 * hit, 0, 0] },
          mouth: { s: [1 + 0.1 * hit, 1, 1 + 0.3 * hit] },
          core: { s: 1 + 0.2 * hit },
          ...F('open', 0.35),
          ...both('arm', { r: [0, -30 * back - 10 * hit, 40 * back - 55 * hit] }),
        }, trail(u, 10, 1, 14 * hit), curl(u, 12, 1));
      },
    },

    // battle: hit. Squashed and shaken, the head snaps back, eyes wide, the arms thrown up
    hurt: {
      seconds: 0.26,
      pose: (t, u) => {
        const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.45]]);
        const sh = shake(u, 5);
        return merge({
          body: { p: [0, 0, bob * 0.5], r: [-8 * k, 5 * sh, 4 * sh], s: [1 + 0.06 * k, 1 + 0.06 * k, 1 - 0.1 * k] },
          head: { r: [-18 * k, 8 * sh, 6 * sh] },
          eyes: { s: [1 + 0.15 * k, 1, 1 + 0.25 * k] },
          mouth: { s: [1, 1, 1 - 0.2 * k] },
          ...F(u > 0.06 ? 'squeeze' : 'open'),
          ...both('arm', { r: [0, -50 * k, 0] }),
        }, trail(u, 12, 3), curl(u, -14 * k, 1));
      },
    },

    // battle: a flinch
    recoil: {
      seconds: 0.25,
      pose: (t, u) => {
        const k = K(u, [[0, 0], [0.4, 1], [1, 0]]);
        return merge({
          body: { p: [0, 0, bob * 0.5], r: [-6 * k, 0, 5 * k] },
          head: { r: [-10 * k, 0, 6 * k] },
          eyes: { s: [1, 1, 1 - 0.2 * k] },
          ...F(k > 0.3 ? 'shut' : 'open', k * 3),
          ...both('arm', { r: [0, -20 * k, -20 * k] }),
        }, trail(u, 6, 1), curl(u, -8 * k, 1));
      },
    },

    // battle: knocked out. It deflates: sinks, the head droops, the arms and wisps go limp, the core dims
    faint: {
      seconds: 0.9,
      pose: (t, u) => {
        const jolt = win(u, 0, 0.2, 0.05);
        const down = smooth((u - 0.15) / 0.6);
        return merge({
          body: { p: [0, 0, bob * 0.5 * (1 - down) + 0.8 * jolt], r: [14 * down, 0, 8 * down], s: [1, 1, 1 - 0.08 * down] },
          head: { r: [-12 * jolt + 28 * down, 10 * down, -8 * down] },
          eyes: { s: [1, 1, 1 - 0.25 * down] },
          ...F(u > 0.1 ? 'dizzy' : 'open'),
          ...both('arm', { r: [0, 35 * down - 30 * jolt, -10 * down] }),
        }, trail(u, 3, 1, 6 * down), Object.fromEntries(wisp.map((n, i) => [n, { r: [24 * down * (1 + 0.2 * i), 0, 0] }])));
      },
    },

    // battle / evolution: a twirl with the arms up, the grin wide
    celebrate: {
      seconds: 0.6,
      pose: (t, u) => {
        const up = win(u, 0, 1, 0.15);
        return merge({
          body: { p: [0, 0, bob + 1.5 * Math.sin(Math.PI * u)], r: [0, 0, K(u, [[0, 0], [0.85, 360]])] },
          head: { r: [-10 * up, 0, 0] },
          mouth: { s: [1 + 0.15 * up, 1, 1 + 0.3 * up] },
          core: { s: 1 + 0.2 * up },
          ...F('happy'),
          ...both('arm', { r: [0, -60 * up + 10 * Math.sin(TAU * 3 * u), 0] }),
        }, trail(u, 12, 2), curl(u, 14, 2));
      },
    },

    // sent out: swells up out of nothing with an overshoot
    enter: {
      seconds: 0.45,
      pose: (t, u) => {
        const k = K(u, [[0, 0.25], [0.55, 1.08], [0.8, 0.97], [1, 1]]);
        return merge({
          body: { p: [0, 0, bob * u], s: k, r: [0, 0, 40 * (1 - smooth(u / 0.7))] },
          ...F(u < 0.4 ? 'shut' : 'open'),
          ...both('arm', { r: [0, -40 * win(u, 0.4, 0.95, 0.12), 0] }),
        }, trail(u, 10, 1), curl(u, 10, 1));
      },
    },

    // recalled: a wave of the left arm, then it shrinks into a spin
    exit: {
      seconds: 0.35,
      pose: (t, u) => {
        const wv = Math.sin(TAU * 2 * u);
        const go = smooth((u - 0.55) / 0.45);
        return merge({
          body: { p: [0, 0, bob], s: 1 - 0.35 * go, r: [0, 0, 120 * go] },
          head: { r: [0, 0, 12 * (1 - go)] },
          ...F('happy'),
          armL: { r: [0, (-70 - 20 * wv) * (1 - go), 0] },
        }, trail(u, 8, 1), curl(u, 8, 1));
      },
    },
  };
  for (const [name, c] of Object.entries(clips)) c.pose = withAdd(name, c.pose);
  return clips;
}
