// Clips for a fish on land: resting on its belly (or little feet), or hovering as if in water (rigDef() drops entries
// for joints a creature lacks):
//   root (on the ground)   legL / legR (little feet, off the root)   body (off the root, pivot at the belly centre)
//   head (off the body; most fish have none, the body is the head)   jaw (off the head or body: opens with rx > 0)
//   finL / finR (pectoral fins off the body: a fin reaching out along +X paddles up with ry < 0)
//   fin2L / fin2R (pelvic or belly fins)   dorsal1…dorsalN (a crest chain along the back, base first)
//   tail1…tailN (the tail, base first: it sweeps side to side with rz)   lure1…lureN (an angler stalk off the head
//   or body, base first; the last link carries the lure)   wisp1…: extra trailing chains (smoke, ragged fins)
//   the eyeKit() lids and strokes
// Options:
//   face, tail, dorsal, lure, wisp (chain names)   hover  floats above the ground (bobs in idle, swims in walk);
//   grounded fish shuffle forward on their fins with little flops instead   sweep  tail sweep (deg per link)
//   add    { clip: (t, u) => pose } layered on top of a template clip
import { K, TAU, both, merge, osc, shake, smooth, win, wave } from './anim.mjs';
import { blinks } from './face.mjs';

export function fishClips(o = {}) {
  const { face = null, tail = [], dorsal = [], lure = [], wisp = [], hover = false, sweep = 10, add = {} } = o;
  const F = (kind, blink = 0) => (face ? face.pose(kind, blink) : {});
  const tailSweep = (u, amp = sweep, cycles = 1, phase = 0) => wave(tail, u, { cycles, amp: [0, 0, amp], lag: 0.12, grow: 0.3, phase });
  const crest = (u, amp = 4, cycles = 2) => wave(dorsal, u, { cycles, amp: [amp, 0, amp * 0.4], lag: 0.15, grow: 0.3 });
  const lureSway = (u, amp = 5, cycles = 1) => wave(lure, u, { cycles, amp: [amp * 0.6, 0, amp], lag: 0.18, grow: 0.25 });
  const lureHold = (r) => Object.fromEntries(lure.map((n, i) => [n, { r: r.map((v) => v * (1 + 0.2 * i)) }]));
  const wisps = (u, amp = 4, cycles = 1) => wave(wisp, u, { cycles, amp: [amp * 0.5, 0, amp], lag: 0.14, grow: 0.3, phase: 0.2 });
  const fins = (paddle, up = 0, rear = 0) => ({
    ...both('fin', { r: [0, -up - paddle, 0] }),
    ...both('fin2', { r: [0, -rear, 0] }),
  });
  // hovering fish bob; grounded ones only breathe
  const bob = (u, amp = 0.6, cycles = 2) => (hover ? { root: { p: [0, 0, amp * osc(u, cycles)] } } : {});
  const withAdd = (name, pose) => (t, u) => merge(pose(t, u), add[name]?.(t, u));

  const clips = {
    // breathing through the gills (the jaw works), fins paddling, the tail idling, a look, blinks, the lure swaying
    idle: {
      seconds: 4,
      pose: (t, u) => {
        const look = K(u, [[0, 0], [0.14, 0], [0.24, 12], [0.44, 12], [0.54, -10], [0.8, -10], [0.9, 0]]);
        const br = osc(u, 2) * 0.5 + 0.5;
        return merge({
          ...bob(u, 0.6, 2),
          body: { r: [1.5 * osc(u, 2, 0.3), 0, look], s: [1 + 0.015 * br, 1 + 0.015 * br, 1 + 0.01 * br] },
          head: { r: [2 * osc(u, 2, 0.6), 0, 0.4 * look] },
          jaw: { r: [5 * br, 0, 0] },
          ...F('open', blinks(u, [[0.3, 0.34], [0.84, 0.87], [0.89, 0.92]])),
          ...fins(8 * osc(u, 4), 0, 4 * osc(u, 2, 0.25)),
        }, tailSweep(u, sweep * 0.5, 2), crest(u), lureSway(u, 5, 1), wisps(u, 4, 1));
      },
    },

    // moving: a hovering fish swims (the body snakes, the tail drives); a grounded one flops forward on its fins
    walk: {
      seconds: 0.6,
      pose: (t, u) => {
        const flop = hover ? 0 : Math.abs(osc(u, 2));
        return merge({
          ...(hover ? bob(u, 0.4, 2) : { root: { p: [0, 0, 0.8 * flop] } }),
          body: { r: [hover ? 4 : -4 * flop, 0, 6 * osc(u, 1, 0.1)] },
          head: { r: [0, 0, -3 * osc(u, 1, 0.1)] },
          jaw: { r: [3, 0, 0] },
          ...F('open'),
          ...fins(hover ? 16 * osc(u, 2) : 20 * osc(u, 2, 0.25), hover ? 6 : 0, 8 * osc(u, 2)),
          legL: { r: [-14 * Math.max(0, -osc(u, 1)), 0, 0] },
          legR: { r: [-14 * Math.max(0, osc(u, 1)), 0, 0] },
        }, tailSweep(u, sweep * 1.6, 1), crest(u, 6, 2), lureSway(u, 8, 1), lureHold([-6, 0, 0]), wisps(u, 8, 1));
      },
    },

    // fidget: gulps air twice, cheeks puffing, then blows a raspberry with a shake of the tail
    idle_gulp: {
      seconds: 2,
      pose: (t, u) => {
        const g = Math.max(0, Math.sin(TAU * 2 * ((u - 0.1) / 0.45))) * win(u, 0.1, 0.55, 0.03);
        const puff = win(u, 0.55, 0.85, 0.06);
        const sh = Math.sin(TAU * 8 * u) * win(u, 0.6, 0.9, 0.04);
        return merge({
          ...bob(u, 0.4, 1),
          body: { r: [-4 * g, 0, 0], s: [1 + 0.06 * puff, 1 + 0.04 * puff, 1 + 0.04 * puff] },
          jaw: { r: [22 * g, 0, 0] },
          ...F(puff > 0.4 ? 'shut' : 'open'),
          ...fins(6 * sh, 10 * puff),
        }, tailSweep(u, sweep * 0.5 + 10 * Math.abs(sh), 6), crest(u, 4 + 8 * puff, 4), lureSway(u, 5, 2), wisps(u, 4, 2));
      },
    },

    // fidget: a happy wiggle from nose to tail, fins flapping, ^ ^
    idle_wiggle: {
      seconds: 1.6,
      pose: (t, u) => {
        const on = win(u, 0.08, 0.85, 0.08);
        return merge({
          ...(hover ? bob(u, 1, 2) : { root: { p: [0, 0, 0.6 * Math.abs(osc(u, 3)) * on] } }),
          body: { r: [0, 6 * osc(u, 3) * on, 8 * osc(u, 3, 0.2) * on] },
          ...F(on > 0.4 ? 'happy' : 'open'),
          ...fins(24 * osc(u, 6) * on, 10 * on, 10 * osc(u, 6) * on),
        }, tailSweep(u, sweep * 1.8 * on, 3), crest(u, 8 * on, 3), lureSway(u, 10 * on, 3), wisps(u, 6, 2));
      },
    },

    // fidget: the lure (or the crest) dangles forward to tempt something, the eyes follow it, then a snap
    idle_lure: {
      seconds: 2.6,
      pose: (t, u) => {
        const out = K(u, [[0, 0], [0.2, 1], [0.66, 1], [0.74, 0]]);
        const swing = osc(u, 3) * win(u, 0.2, 0.66, 0.06);
        const snap = K(u, [[0.66, 0], [0.72, 1], [0.84, 0]]);
        return merge({
          ...bob(u, 0.4, 1),
          body: { r: [6 * out - 6 * snap, 0, 6 * swing] },
          head: { r: [4 * out, 0, 0] },
          jaw: { r: [24 * snap, 0, 0] },
          ...F('open', blinks(u, [[0.86, 0.9]])),
          ...fins(4 * osc(u, 4), 0),
        }, lureHold([10 * out, 0, 0]), lureSway(u, 10 * out, 3), tailSweep(u, sweep * 0.6, 2), crest(u, 3, 2), wisps(u, 4, 1));
      },
    },

    // battle: draws back, the body coiled into a curve, the jaw parting, fins flared
    windup: {
      seconds: 0.25,
      pose: (t, u) => {
        const w = smooth(u / 0.8);
        return merge({
          body: { r: [-10 * w, 0, -10 * w] },
          head: { r: [4 * w, 0, 0] },
          jaw: { r: [14 * w, 0, 0] },
          ...F('open', 0.45 * w),
          ...fins(0, 30 * w, 14 * w),
        }, Object.fromEntries(tail.map((n, i) => [n, { r: [0, 0, 12 * w * (1 + 0.3 * i)] }])), crest(u, 8 * w, 1), lureHold([-12 * w, 0, 0]), wisps(u, 4, 1));
      },
    },

    // battle: a lunging bite at u = 0.4, the tail whipping it forward
    lunge: {
      seconds: 0.3,
      pose: (t, u) => {
        const back = K(u, [[0, 1], [0.12, 0.8], [0.25, 0]]);
        const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]);
        const bite = K(u, [[0, 0.6], [0.3, 1], [0.42, 0], [1, 0]]);
        return merge({
          body: { r: [-10 * back + 14 * hit, 0, -10 * back] },
          head: { r: [4 * back + 6 * hit, 0, 0] },
          jaw: { r: [30 * bite, 0, 0] },
          ...F('open', 0.35),
          ...fins(0, 30 * back - 20 * hit, 14 * back),
        }, Object.fromEntries(tail.map((n, i) => [n, { r: [0, 0, (12 * back - 18 * hit) * (1 + 0.3 * i)] }])), crest(u, 8, 1), lureHold([-12 * back + 14 * hit, 0, 0]), wisps(u, 8, 1));
      },
    },

    // battle: hit. Knocked sideways, fins flung out, the tail thrashing, eyes > <
    hurt: {
      seconds: 0.26,
      pose: (t, u) => {
        const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.45]]);
        const sh = shake(u, 5);
        return merge({
          body: { r: [-10 * k, 10 * k + 4 * sh, 4 * sh], s: [1 + 0.04 * k, 1 + 0.04 * k, 1 - 0.07 * k] },
          head: { r: [-8 * k, 0, 0] },
          jaw: { r: [16 * k, 0, 0] },
          ...F(u > 0.06 ? 'squeeze' : 'open'),
          ...fins(0, 40 * k, 20 * k),
        }, tailSweep(u, sweep * 2, 3), crest(u, -10 * k, 1), lureSway(u, 14, 2), wisps(u, 10, 2));
      },
    },

    // battle: a flinch, fins tucked, eyes shut
    recoil: {
      seconds: 0.25,
      pose: (t, u) => {
        const k = K(u, [[0, 0], [0.4, 1], [1, 0]]);
        return merge({
          body: { r: [-6 * k, 0, 6 * k], s: [1, 1, 1 - 0.04 * k] },
          ...F(k > 0.3 ? 'shut' : 'open', k * 3),
          ...fins(0, -10 * k, -6 * k),
        }, tailSweep(u, sweep, 1), lureHold([-8 * k, 0, 0]), wisps(u, 4, 1));
      },
    },

    // battle: knocked out. A last flop, then it rolls onto its side, the fins and tail go limp, x x
    faint: {
      seconds: 0.9,
      pose: (t, u) => {
        const flop = win(u, 0, 0.3, 0.06);
        const down = smooth((u - 0.2) / 0.5);
        return merge({
          root: { p: [0, 0, 1.2 * Math.sin(Math.PI * Math.min(1, u / 0.3)) * flop - (hover ? 0.6 * down : 0)] },
          body: { r: [6 * down, 28 * down, 0], s: [1 + 0.03 * down, 1 + 0.03 * down, 1 - 0.06 * down] },
          jaw: { r: [14 * down, 0, 0] },
          ...F(u > 0.12 ? 'dizzy' : 'open'),
          ...fins(0, -14 * down, -8 * down),
        }, Object.fromEntries(tail.map((n, i) => [n, { r: [8 * down, 0, 6 * down * (1 + 0.3 * i)] }])),
        Object.fromEntries(dorsal.map((n, i) => [n, { r: [16 * down * (1 + 0.3 * i), 0, 0] }])), lureHold([24 * down, 0, 0]), wisps(u, 2, 1));
      },
    },

    // battle / evolution: two little hops (a leap in the air for a floater), fins flapping, ^ ^, the tail wagging
    celebrate: {
      seconds: 0.6,
      pose: (t, u) => {
        const hp = Math.abs(Math.sin(TAU * u));
        return merge({
          root: { p: [0, 0, (hover ? 2.4 : 1.8) * hp] },
          body: { r: [-8 * hp, 0, 6 * osc(u, 2)], s: [1 - 0.03 * hp, 1 - 0.03 * hp, 1 + 0.05 * hp] },
          jaw: { r: [18, 0, 0] },
          ...F('happy'),
          ...fins(26 * osc(u, 4), 16, 12 * osc(u, 4)),
        }, tailSweep(u, sweep * 2, 3), crest(u, 10, 3), lureSway(u, 12, 2), wisps(u, 8, 2));
      },
    },

    // sent out: splashes in squashed, springs up with fins spread, eyes opening
    enter: {
      seconds: 0.45,
      pose: (t, u) => {
        const on = smooth((u - 0.1) / 0.4);
        const over = win(u, 0.4, 0.9, 0.12);
        return merge({
          body: { s: [1 + 0.12 * (1 - on) - 0.04 * over, 1 + 0.12 * (1 - on) - 0.04 * over, 1 - 0.2 * (1 - on) + 0.08 * over] },
          ...F(on < 0.5 ? 'shut' : 'open'),
          ...fins(0, 34 * over, 16 * over),
        }, tailSweep(u, sweep * 1.4 * over, 2), crest(u, 8 * over, 1), lureSway(u, 10 * over, 1), wisps(u, 6, 1));
      },
    },

    // recalled: waves its left fin, the tail flicking goodbye, happy
    exit: {
      seconds: 0.35,
      pose: (t, u) => {
        const up = win(u, 0, 0.85, 0.2);
        const wv = Math.sin(TAU * 2 * u);
        return merge({
          body: { r: [0, 0, 10 * up] },
          ...F(u < 0.85 ? 'happy' : 'shut'),
          finL: { r: [0, (-40 - 20 * wv) * up, 0] },
        }, tailSweep(u, sweep * 1.4 * up, 2), lureSway(u, 6, 1), wisps(u, 4, 1));
      },
    },
  };
  for (const [name, c] of Object.entries(clips)) c.pose = withAdd(name, c.pose);
  return clips;
}
