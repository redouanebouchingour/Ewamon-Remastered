// Clips for a six-legged insect, beetle, mite or scorpion standing low on its legs (rigDef() drops entries for joints a
// creature lacks):
//   root (on the ground)   body (the thorax, off the root, pivot low and central)   abdomen (off the body, the rear)
//   head (off the body)   jaw, mandL / mandR (off the head; a left mandible pointing forward opens outwards with rz > 0)
//   antL1…antLN / antR1…antRN (antenna chains off the head, base first; `ant: n` links per side)
//   leg1L / leg1R (front) … leg3L / leg3R (back): off the root, one joint per leg at the hip, so the feet stay planted
//     while the body sways; a leg sticking out along +X lifts with ry < 0 and swings forward with rz < 0 (left terms,
//     the right side mirrors)
//   wingL / wingR (+ wing2L / wing2R, the hind pair) off the body: buzz with ry; caseL / caseR (wing cases, elytra)
//     lift open with ry < 0 and rx < 0
//   clawL / clawR (pincers or scythe arms, off the body), pinchL / pinchR (the moving finger, off the claw)
//   tail1…tailN (a scorpion tail or a grub's rising rear, off the abdomen or the body, base first)
//   the eyeKit() lids and strokes
// Options:
//   face, ant (links per antenna), tail (chain names), legs (leg pairs: 3, or 2 for a mantis on four stilts)
//   stride   leg swing (deg) in the walk   lift  leg lift (deg)   stinger  the tail arches over the back (scorpions):
//            its strikes come over the top instead of the head lunging   buzz  wing beat (deg)
//   hang     legs hanging straight down (not splayed out along X): the walk swings them with rx (forward is rx < 0)
//            and lifts the stepping foot with a small offset instead of ry
//   add      { clip: (t, u) => pose } layered on top of a template clip
import { K, TAU, both, merge, osc, shake, smooth, win, wave } from './anim.mjs';
import { blinks } from './face.mjs';

export function insectClips(o = {}) {
  const { face = null, ant = 0, tail = [], legs = 3, stride = 16, lift = 14, stinger = false, buzz = 30, hang = false, add = {} } = o;
  const F = (kind, blink = 0) => (face ? face.pose(kind, blink) : {});
  const antN = (S) => Array.from({ length: ant }, (_, i) => `ant${S}${i + 1}`);
  // antennae: each side its own wave, the right a little out of step
  const antennae = (u, amp = 6, cycles = 2) => merge(
    wave(antN('L'), u, { cycles, amp: [amp, -amp * 0.5, 0], lag: 0.15, grow: 0.4 }),
    wave(antN('R'), u, { cycles, amp: [amp, amp * 0.5, 0], lag: 0.15, grow: 0.4, phase: 0.2 }),
  );
  const antHold = (r) => merge(
    Object.fromEntries(antN('L').map((n, i) => [n, { r: r.map((v) => v * (1 + 0.4 * i)) }])),
    Object.fromEntries(antN('R').map((n, i) => [n, { r: [r[0] * (1 + 0.4 * i), -r[1] * (1 + 0.4 * i), -r[2] * (1 + 0.4 * i)] }])),
  );
  const tailWave = (u, amp = 4, cycles = 1, curl = 0) => merge(
    wave(tail, u, { cycles, amp: [amp * 0.6, 0, amp], lag: 0.12, grow: 0.3 }),
    // the curl adds up link by link: a long tail shares it out so the whole arch bends about the same
    Object.fromEntries(tail.map((n, i) => [n, { r: [curl * (0.6 + 0.2 * i) * Math.min(1, 3 / tail.length), 0, 0] }])),
  );
  // every leg pair: the same left pose for both sides (mirrored), or a different one per side
  const legsAll = (fn) => Object.assign({}, ...Array.from({ length: legs }, (_, i) => both(`leg${i + 1}`, fn(i, 'L'), fn(i, 'R'))));
  // the tripod gait: front-left, middle-right, back-left swing together, then the other three
  const tripod = (u, sw, lf) => legsAll((i, S) => {
    const ph = (i % 2 === 0) === (S === 'L') ? 0 : 0.5;
    const s = osc(u, 1, ph);
    const up = Math.max(0, osc(u, 1, ph + 0.25));
    return hang ? { r: [-sw * s, 0, 0], p: [0, 0, (lf / 14) * 0.8 * up] } : { r: [0, -lf * up, -sw * s] };
  });
  // mand(k): k < 0 spreads the mandibles, k > 0 closes them (rz is the opposite way round, left terms)
  const mand = (k) => both('mand', { r: [0, 0, -k] });
  const wings = (beat, open = 0) => ({
    ...both('wing', { r: [0, -beat, 0] }),
    ...both('wing2', { r: [0, -beat * 0.8, 0] }),
    ...both('case', { r: [-open * 0.5, -open, 0] }),
  });
  const claws = (r, pinch = 0) => ({ ...both('claw', { r }), ...both('pinch', { r: [0, 0, -pinch] }) });
  const withAdd = (name, pose) => (t, u) => merge(pose(t, u), add[name]?.(t, u));

  const clips = {
    // breathing (the abdomen pumps), antennae feeling the air, a look, blinks, a shuffle of one leg, mandibles working
    idle: {
      seconds: 4,
      pose: (t, u) => {
        const look = K(u, [[0, 0], [0.14, 0], [0.24, 12], [0.44, 12], [0.54, -10], [0.8, -10], [0.9, 0]]);
        const shuffle = win(u, 0.62, 0.72, 0.03);
        return merge({
          body: { r: [1 * osc(u, 2, 0.3), 0, look * 0.3] },
          abdomen: { r: [-1.5 * osc(u, 2), 0, 0], s: [1 + 0.02 * osc(u, 2), 1, 1 + 0.02 * osc(u, 2)] },
          head: { r: [2 * osc(u, 2, 0.6), 0, look] },
          jaw: { r: [3 * (osc(u, 4) * 0.5 + 0.5), 0, 0] },
          ...mand(-4 * (osc(u, 4) * 0.5 + 0.5)),
          ...F('open', blinks(u, [[0.3, 0.34], [0.84, 0.88]])),
          leg2L: { r: [0, -lift * 0.8 * shuffle, -6 * shuffle] },
          ...claws([2 * osc(u, 2), 0, 0], 4 * (osc(u, 2, 0.3) * 0.5 + 0.5)),
          ...wings(1.5 * osc(u, 2)),
        }, antennae(u, 5, 2), tailWave(u, 3, 1));
      },
    },

    // scuttling on the tripod gait, the body rolling a little, antennae streaming back
    walk: {
      seconds: 0.5,
      pose: (t, u) => merge({
        root: { p: [0, 0, 0.15 * Math.abs(osc(u, 2))] },
        body: { r: [2, 2 * osc(u, 2), 3 * osc(u, 1)] },
        abdomen: { r: [0, 0, -4 * osc(u, 1)] },
        head: { r: [-2, 0, -3 * osc(u, 1)] },
        ...F('open'),
        ...claws([-6, 0, 3 * osc(u, 1)]),
      }, tripod(u, stride, lift), antennae(u, 6, 2), antHold([-8, 0, 0]), tailWave(u, 5, 1)),
    },

    // fidget: cleans its antennae with the front legs (or claws), the head bowed
    idle_groom: {
      seconds: 2.4,
      pose: (t, u) => {
        const on = K(u, [[0, 0], [0.15, 1], [0.78, 1], [0.92, 0]]);
        const rub = osc(u, 6) * win(u, 0.18, 0.76, 0.05);
        return merge({
          body: { r: [-4 * on, 0, 0] },
          head: { r: [14 * on + 3 * rub, 0, 0] },
          ...F(on > 0.5 ? 'shut' : 'open'),
          ...both('leg1', { r: [-30 * on, -30 * on + 8 * rub, -24 * on] }),
          ...claws([-20 * on, 0, -10 * on + 6 * rub]),
        }, antHold([24 * on + 6 * rub, 0, 0]), tailWave(u, 2, 1));
      },
    },

    // fidget: the wing cases flick open, a quick buzz of the wings, shut again
    idle_buzz: {
      seconds: 1.6,
      pose: (t, u) => {
        const open = K(u, [[0, 0], [0.15, 1], [0.75, 1], [0.9, 0]]);
        const bz = Math.sin(TAU * 12 * u) * win(u, 0.18, 0.74, 0.04);
        return merge({
          root: { p: [0, 0, 0.4 * Math.abs(bz)] },
          body: { r: [-3 * open, 0, 0] },
          ...F(open > 0.5 ? 'happy' : 'open'),
          ...wings(buzz * (0.5 + 0.5 * bz) * open, 40 * open),
        }, antennae(u, 8, 4), tailWave(u, 4, 2));
      },
    },

    // fidget: the antennae twitch at something, the head tilts, a leg taps twice
    idle_twitch: {
      seconds: 2,
      pose: (t, u) => {
        const tilt = K(u, [[0, 0], [0.12, 1], [0.7, 1], [0.85, 0]]);
        const tap = Math.max(0, Math.sin(TAU * 2 * ((u - 0.3) / 0.4))) * win(u, 0.3, 0.7, 0.03);
        return merge({
          head: { r: [0, 14 * tilt, 10 * tilt] },
          ...F('open', blinks(u, [[0.5, 0.55]])),
          leg1L: { r: [0, -lift * tap, -8 * tap] },
        }, antennae(u, 12, 6), tailWave(u, 3, 2));
      },
    },

    // battle: rears back on the hind legs, mandibles (or claws) spread, the stinger cocked
    windup: {
      seconds: 0.25,
      pose: (t, u) => {
        const w = smooth(u / 0.8);
        return merge({
          body: { r: [-10 * w, 0, 0], p: [0, 0, 0.6 * w] },
          head: { r: [4 * w, 0, 0] },
          jaw: { r: [14 * w, 0, 0] },
          ...mand(-20 * w),
          ...F('open', 0.45 * w),
          ...both('leg1', { r: [-12 * w, -18 * w, 0] }),
          ...claws([-25 * w, -20 * w, 0], -20 * w),
          ...wings(0, 10 * w),
        }, antHold([-14 * w, 0, 0]), tailWave(u, 0, 1, stinger ? -16 * w : 0));
      },
    },

    // battle: a lunge at u = 0.4, mandibles snapping shut on the bite (a scorpion strikes with the stinger instead)
    lunge: {
      seconds: 0.3,
      pose: (t, u) => {
        const back = K(u, [[0, 1], [0.12, 0.8], [0.25, 0]]);
        const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]);
        const bite = K(u, [[0, 1], [0.32, 1], [0.42, 0], [1, 0]]);
        const head = stinger ? 0.4 : 1;
        return merge({
          body: { r: [(-10 * back + 12 * hit) * head, 0, 0], p: [0, 0, 0.6 * back] },
          head: { r: [(4 * back + 8 * hit) * head, 0, 0] },
          jaw: { r: [14 * bite, 0, 0] },
          ...mand(-20 * bite + 6 * hit),
          ...F('open', 0.35),
          ...both('leg1', { r: [(-12 * back - 10 * hit) * head, -18 * back, 0] }),
          ...claws([-25 * back - 35 * hit, -20 * back, 0], -20 * bite + 10 * hit),
        }, antHold([-14 * back + 10 * hit, 0, 0]), tailWave(u, 0, 1, stinger ? -16 * back + 16 * hit : 0));
      },
    },

    // battle: hit. Knocked back on its legs, antennae flung back, eyes > <
    hurt: {
      seconds: 0.26,
      pose: (t, u) => {
        const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.45]]);
        const sh = shake(u, 5);
        return merge({
          body: { r: [-8 * k, 4 * sh, 3 * sh], s: [1 + 0.03 * k, 1 + 0.03 * k, 1 - 0.06 * k] },
          head: { r: [-12 * k, 5 * sh, 0] },
          jaw: { r: [12 * k, 0, 0] },
          ...mand(-14 * k),
          ...F(u > 0.06 ? 'squeeze' : 'open'),
          ...legsAll(() => ({ r: [0, -lift * 0.6 * k, 0] })),
          ...claws([10 * k, -16 * k, 0], -14 * k),
          ...wings(10 * k, 14 * k),
        }, antHold([-20 * k, 0, 0]), tailWave(u, 10, 3, -8 * k));
      },
    },

    // battle: a flinch, legs tucking in, eyes shut
    recoil: {
      seconds: 0.25,
      pose: (t, u) => {
        const k = K(u, [[0, 0], [0.4, 1], [1, 0]]);
        return merge({
          body: { r: [-5 * k, 0, 4 * k], s: [1, 1, 1 - 0.05 * k] },
          head: { r: [-8 * k, 0, 6 * k] },
          ...F(k > 0.3 ? 'shut' : 'open', k * 3),
          ...legsAll(() => ({ r: [0, 6 * k, 0] })),
          ...claws([8 * k, 8 * k, 0]),
        }, antHold([-12 * k, 0, 0]), tailWave(u, 4, 1));
      },
    },

    // battle: knocked out. The legs splay, the body sinks flat, the antennae droop, then a last kick of a leg, x x
    faint: {
      seconds: 0.9,
      pose: (t, u) => {
        const down = smooth((u - 0.15) / 0.5);
        const kick = Math.max(0, Math.sin(TAU * 2 * ((u - 0.7) / 0.25))) * win(u, 0.7, 0.95, 0.03);
        return merge({
          body: { r: [6 * down, 4 * down, 0], p: [0, 0, -0.8 * down], s: [1 + 0.04 * down, 1 + 0.04 * down, 1 - 0.08 * down] },
          head: { r: [16 * down, 0, -8 * down] },
          jaw: { r: [10 * down, 0, 0] },
          ...mand(-12 * down),
          ...F(u > 0.12 ? 'dizzy' : 'open'),
          ...legsAll(() => ({ r: [0, 14 * down, 0] })),
          leg3L: { r: [0, 14 * down - 20 * kick, 0] },
          ...claws([18 * down, 16 * down, 0], -10 * down),
          ...wings(0, 8 * down),
        }, antHold([28 * down, 0, 0]), tailWave(u, 0, 1, 18 * down));
      },
    },

    // battle / evolution: a happy bounce on all legs, antennae waving, ^ ^, claws up
    celebrate: {
      seconds: 0.6,
      pose: (t, u) => {
        const hp = Math.abs(Math.sin(TAU * u));
        return merge({
          root: { p: [0, 0, 1.2 * hp] },
          body: { r: [-5 * hp, 0, 4 * osc(u, 2)] },
          head: { r: [-6, 0, 6 * osc(u, 2)] },
          ...mand(-10),
          ...F('happy'),
          ...legsAll(() => ({ r: [0, -lift * 0.5 * hp, 0] })),
          ...claws([-40, -30 + 10 * osc(u, 3), 0], -18 * (osc(u, 3) * 0.5 + 0.5)),
          ...wings(buzz * 0.6 * (Math.sin(TAU * 4 * u) * 0.5 + 0.5), 20),
        }, antennae(u, 14, 3), tailWave(u, 10, 2, stinger ? -8 : 0));
      },
    },

    // sent out: lands crouched, pops up with the legs spreading, antennae unfurling
    enter: {
      seconds: 0.45,
      pose: (t, u) => {
        const low = 1 - smooth((u - 0.1) / 0.4);
        const over = win(u, 0.4, 0.9, 0.12);
        return merge({
          body: { s: [1 + 0.1 * low, 1 + 0.1 * low, 1 - 0.16 * low + 0.06 * over] },
          ...F(low > 0.5 ? 'shut' : 'open'),
          ...legsAll(() => ({ r: [0, 10 * low, 0] })),
          ...claws([-20 * over, -16 * over, 0]),
          ...wings(0, 20 * over),
        }, antHold([20 * low - 12 * over, 0, 0]), tailWave(u, 6 * over, 1));
      },
    },

    // recalled: waves the left front leg (or claw), happy
    exit: {
      seconds: 0.35,
      pose: (t, u) => {
        const up = win(u, 0, 0.85, 0.2);
        const wv = Math.sin(TAU * 2 * u);
        return merge({
          body: { r: [-3 * up, 0, 8 * up] },
          head: { r: [0, 0, 10 * up] },
          ...F(u < 0.85 ? 'happy' : 'shut'),
          leg1L: { r: [-20 * up, (-40 - 15 * wv) * up, 0] },
          clawL: { r: [-40 * up, (-30 - 15 * wv) * up, 0] },
        }, antennae(u, 8, 2), tailWave(u, 4, 1));
      },
    },
  };
  for (const [name, c] of Object.entries(clips)) c.pose = withAdd(name, c.pose);
  return clips;
}
