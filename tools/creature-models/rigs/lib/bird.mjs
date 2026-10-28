// Clips for a bird standing on its feet (rigDef() drops entries for joints a creature lacks):
//   root (on the ground)   legL / legR (off the root)   body (off the root, pivot low over the feet so it rocks)
//   head (off the body; round chicks have none, the body is the head)   wingL / wingR, wingL2 / wingR2 (tips)
//   crest1…crestN (a chain off the head or body)   tail1…tailN (a chain off the body, lifted off the ground)
//   trail1…: chains lying on the ground (ribbon tails): they only sway sideways (rz), so they stay on the ground
//   the eyeKit() lids and strokes
// A wing sticking out along +X flaps UP with ry < 0 (the right one mirrors).
// Options: face, crest, tail, trail (arrays of names; trail is a list of chains), add (layers).
import { K, TAU, both, merge, osc, shake, smooth, win, wave } from './anim.mjs';
import { blinks } from './face.mjs';

export function birdClips(o = {}) {
  const { face = null, crest = [], tail = [], trail = [], add = {}, flapUp = 60 } = o;
  const F = (kind, blink = 0) => (face ? face.pose(kind, blink) : {});
  const wings = (up, fold = 0, upR = up) => ({
    ...both('wing', { r: [fold, -up, 0] }, { r: [fold, -upR, 0] }),
    ...both('wing2', { r: [0, -up * 0.4, 0] }, { r: [0, -upR * 0.4, 0] }),
  });
  const crestSway = (u, amp = 5, cycles = 2) => wave(crest, u, { cycles, amp: [amp, 0, amp * 0.6], lag: 0.15, grow: 0.3 });
  const trails = (u, amp = 4, cycles = 1) => merge(...trail.map((ch, k) => wave(ch, u, { cycles, amp: [0, 0, amp], lag: 0.14, grow: 0.25, phase: 0.3 * k })));
  const tailFan = (u, amp = 6, cycles = 2) => wave(tail, u, { cycles, amp: [2, 0, amp], lag: 0.1 });
  const withAdd = (name, pose) => (t, u) => merge(pose(t, u), add[name]?.(t, u));

  const clips = {
    // breathing (a puff of the chest), a look, blinks, a quick ruffle of the wings, the crest swaying
    idle: {
      seconds: 4,
      pose: (t, u) => {
        const look = K(u, [[0, 0], [0.14, 0], [0.24, 14], [0.44, 14], [0.54, -12], [0.8, -12], [0.9, 0]]);
        const ruffle = Math.sin(TAU * 6 * u) * win(u, 0.6, 0.72, 0.03);
        const br = Math.sin((TAU * t) / 2) * 0.5 + 0.5;
        return merge({
          body: { r: [1.5 * osc(u, 2, 0.3), 2 * osc(u, 1), look * 0.5], s: [1 + 0.015 * br, 1 + 0.015 * br, 1 + 0.01 * br] },
          head: { r: [3 * osc(u, 2, 0.6), 0.3 * look, look] },
          ...F('open', blinks(u, [[0.3, 0.34], [0.84, 0.87], [0.89, 0.92]])),
          ...wings(4 + 14 * ruffle + 2 * osc(u, 2)),
        }, crestSway(u), trails(u, 3), tailFan(u, 4));
      },
    },

    // a waddle: the body rocks from foot to foot, the lifted foot steps, the wings out a little for balance
    walk: {
      seconds: 0.6,
      pose: (t, u) => {
        const s = osc(u, 1);
        return merge({
          root: { p: [0, 0, 0.25 * Math.abs(osc(u, 2))] },
          body: { r: [4, 9 * s, 6 * s] },
          head: { r: [-3 + 3 * osc(u, 2, 0.15), -4 * s, -4 * s] },
          legL: { r: [-14 * Math.max(0, -s), 0, 0], p: [0, 0, 0.6 * Math.max(0, -s)] },
          legR: { r: [-14 * Math.max(0, s), 0, 0], p: [0, 0, 0.6 * Math.max(0, s)] },
          ...F('open'),
          ...wings(14 + 6 * osc(u, 2)),
        }, crestSway(u, 8, 2), trails(u, 8, 1), tailFan(u, 8, 1));
      },
    },

    // fidget: a burst of flapping with little hops
    idle_flap: {
      seconds: 1.6,
      pose: (t, u) => {
        const on = win(u, 0.08, 0.82, 0.06);
        const fl = (Math.sin(TAU * 6 * u) * 0.5 + 0.5) * on;
        return merge({
          root: { p: [0, 0, 1.6 * Math.abs(Math.sin(TAU * 2 * u)) * on] },
          body: { r: [-4 * on, 0, 0] },
          ...F(on > 0.3 ? 'happy' : 'open'),
          ...wings(flapUp * fl),
        }, crestSway(u, 12, 3), trails(u, 6, 2), tailFan(u, 10, 3));
      },
    },

    // fidget: preens under its left wing, then shakes out its feathers
    idle_preen: {
      seconds: 2.6,
      pose: (t, u) => {
        const on = K(u, [[0, 0], [0.15, 1], [0.62, 1], [0.72, 0]]);
        const nib = osc(u, 8) * win(u, 0.18, 0.6, 0.04);
        const sh = Math.sin(TAU * 8 * u) * win(u, 0.72, 0.95, 0.03);
        return merge({
          body: { r: [6 * on + 2 * nib, -10 * on + 6 * sh, 24 * on] },
          head: { r: [10 * on + 4 * nib, 0, 30 * on] },
          ...F(on > 0.5 ? 'shut' : 'open'),
          wingL: { r: [0, -35 * on + 10 * sh, 0] },
          wingR: { r: [0, 10 * sh, 0] },
        }, crestSway(u, 6 + 10 * Math.abs(sh), 4), trails(u, 3), tailFan(u, 6 + 8 * Math.abs(sh), 6));
      },
    },

    // fidget: three pecks at the ground
    idle_peck: {
      seconds: 2,
      pose: (t, u) => {
        const pk = Math.max(0, Math.sin(TAU * 3 * ((u - 0.15) / 0.6))) * win(u, 0.15, 0.75, 0.04);
        const lean = win(u, 0.08, 0.85, 0.08);
        return merge({
          body: { r: [10 * lean + 12 * pk, 0, 0] },
          head: { r: [10 * lean + 14 * pk, 0, 0] },
          ...F('open', blinks(u, [[0.82, 0.88]])),
          ...wings(6 * lean),
        }, crestSway(u, 5), trails(u, 2), tailFan(u, 4));
      },
    },

    // battle: leans back, wings raised behind, eyes narrowed
    windup: {
      seconds: 0.25,
      pose: (t, u) => {
        const w = smooth(u / 0.8);
        return merge({
          body: { r: [-10 * w, 0, -8 * w] },
          head: { r: [6 * w, 0, 6 * w] },
          ...F('open', 0.45 * w),
          ...wings(40 * w, 20 * w),
        }, crestSway(u, 8, 1), trails(u, 2), tailFan(u, 4, 1));
      },
    },

    // battle: a lunging peck at u = 0.4, wings flared
    lunge: {
      seconds: 0.3,
      pose: (t, u) => {
        const back = K(u, [[0, 0.6], [0.12, 1], [0.22, 0]]);
        const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]);
        return merge({
          body: { r: [-8 * back + 22 * hit, 0, 0] },
          head: { r: [-4 * back + 14 * hit, 0, 0] },
          ...F('open', 0.35),
          ...wings(40 * back + 50 * hit, 20 * back - 10 * hit),
        }, crestSway(u, 10, 1), trails(u, 2), tailFan(u, 6, 1));
      },
    },

    // battle: hit. Feathers fly up: the body squashes back, wings flare, eyes > <
    hurt: {
      seconds: 0.26,
      pose: (t, u) => {
        const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.45]]);
        const sh = shake(u, 5);
        return merge({
          body: { r: [-10 * k, 5 * sh, 4 * sh], s: [1 + 0.05 * k, 1 + 0.05 * k, 1 - 0.08 * k] },
          head: { r: [-16 * k, 6 * sh, 0] },
          ...F(u > 0.06 ? 'squeeze' : 'open'),
          ...wings(70 * k),
        }, crestSway(u, -14 * k, 1), trails(u, 2), tailFan(u, 8, 3));
      },
    },

    // battle: a flinch, eyes shut, wings tucked
    recoil: {
      seconds: 0.25,
      pose: (t, u) => {
        const k = K(u, [[0, 0], [0.4, 1], [1, 0]]);
        return merge({
          body: { r: [-6 * k, 0, 4 * k], s: [1, 1, 1 - 0.04 * k] },
          head: { r: [-8 * k, 0, 6 * k] },
          ...F(k > 0.3 ? 'shut' : 'open', k * 3),
          ...wings(-6 * k),
        }, crestSway(u, -6 * k, 1), trails(u, 2));
      },
    },

    // battle: knocked out. A wobble, then it slumps: wings droop to the ground, the crest wilts, x x
    faint: {
      seconds: 0.9,
      pose: (t, u) => {
        const down = smooth((u - 0.2) / 0.55);
        const wob = Math.sin(TAU * 2 * u) * (1 - down) * win(u, 0, 0.4, 0.05);
        return merge({
          body: { r: [12 * down, 10 * wob, 6 * down], s: [1 + 0.04 * down, 1 + 0.04 * down, 1 - 0.08 * down] },
          head: { r: [18 * down, 8 * down, -6 * down] },
          ...F(u > 0.12 ? 'dizzy' : 'open'),
          ...wings(-22 * down, 6 * down),
        }, Object.fromEntries(crest.map((n, i) => [n, { r: [24 * down * (1 + 0.3 * i), 0, 0] }])), trails(u, 2), tailFan(u, 2));
      },
    },

    // battle / evolution: two hops, flapping, ^ ^
    celebrate: {
      seconds: 0.6,
      pose: (t, u) => {
        const hp = Math.abs(Math.sin(TAU * u));
        const fl = Math.sin(TAU * 4 * u) * 0.5 + 0.5;
        return merge({
          root: { p: [0, 0, 2 * hp] },
          body: { r: [-6 * hp, 0, 0], s: [1 - 0.03 * hp, 1 - 0.03 * hp, 1 + 0.05 * hp] },
          head: { r: [-8, 0, 0] },
          ...F('happy'),
          ...wings(20 + 50 * fl),
        }, crestSway(u, 14, 2), trails(u, 6, 2), tailFan(u, 12, 4));
      },
    },

    // sent out: pops out squashed, stretches up with the wings flung open, eyes open
    enter: {
      seconds: 0.45,
      pose: (t, u) => {
        const on = smooth((u - 0.1) / 0.4);
        const over = win(u, 0.4, 0.9, 0.12);
        return merge({
          body: { s: [1 + 0.12 * (1 - on) - 0.04 * over, 1 + 0.12 * (1 - on) - 0.04 * over, 1 - 0.2 * (1 - on) + 0.08 * over] },
          ...F(on < 0.5 ? 'shut' : 'open'),
          ...wings(55 * over),
        }, crestSway(u, 12 * over, 1), trails(u, 2), tailFan(u, 8, 2));
      },
    },

    // recalled: waves its left wing, happy
    exit: {
      seconds: 0.35,
      pose: (t, u) => {
        const up = win(u, 0, 0.85, 0.2);
        const wv = Math.sin(TAU * 2 * u);
        return merge({
          body: { r: [0, 0, 10 * up] },
          head: { r: [0, 0, 10 * up] },
          ...F(u < 0.85 ? 'happy' : 'shut'),
          wingL: { r: [0, (-55 - 20 * wv) * up, 0] },
        }, crestSway(u, 6, 1), trails(u, 2));
      },
    },
  };
  for (const [name, c] of Object.entries(clips)) c.pose = withAdd(name, c.pose);
  return clips;
}
