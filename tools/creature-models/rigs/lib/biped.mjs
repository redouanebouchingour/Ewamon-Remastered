// Clips for a creature standing on two legs (rigDef() drops entries for joints a creature lacks):
//   root (at the feet, centre)   legL / legR (off the root: the feet stay planted while the body sways)
//   body (torso, off the root, pivot at the hips)   head (off the body)   jaw, earL / earR (off the head)
//   armL / armR (shoulders, off the body), foreL / foreR, handL / handR   tail1…tailN (a chain off the body)
//   the eyeKit() lids and strokes (face.mjs)
// Options:
//   face     eyeKit() result (blinks, ^ ^ / x x / > < faces)     tail   chain joint names, base first
//   hipH     hip pivot height above the soles (scad units): the walk dip keeps the planted foot on the ground
//   stride   leg swing (deg)   hop    walk by hopping on both feet (kangaroo, frog)   hopH  hop height (scad units)
//   guard    arms held up in a boxer's guard (the rest pose): they bob instead of swinging
//   punch    { arm, fore } rotations that throw the right arm's straight punch from its rest pose
//   cheer    { arm, fore } for the left arm raised overhead (celebrate, the exit wave); the right one mirrors. The
//            default lifts hanging arms out sideways (ry < 0); arms in guard raise forwards first, and after a forward raise
//            the outward tilt of the left arm is ry > 0
//   lift     the scad height of the model (sizes the hops and the bounce)
//   add      { clip: (t, u) => pose } layered on top of a template clip; extra clips go in the rig file itself
// Added for the bipeds A batch (2026-10-28; the defaults leave Joeyjab's clips as they were):
//   armSwing walk arm swing (deg, default 24; small for arms held up or full of weapons)
//   hopScale share of the celebrate hops (0 = a heavy one that stays on its feet and bounces in the knees)
//   wing     { open: [rx, ry, rz] the left wing spread, flap: deg } for wingL / wingR (off the body, pivot at the root):
//            ry > 0 beats a wing reaching out along +X downwards, rz < 0 swings it forward
//   cape     chain joint names hanging from the shoulders or the head, top first (cloak, duster, mane, long hair): it
//            trails in the walk and the lunge, flutters in celebrate, and hangs plumb while the body pitches
//   droop    share of the forward fold in faint and the crouch in enter (small for a big head that would hit the ground)
//   arms2    a second pair arm2 / fore2 / hand2 (L / R) copies this share of the arm / fore / hand motion (four arms)
//
// Part tests for assign() (pick() and the primitives below) and pair() for mirrored joints are at the end of the file.
import { K, TAU, both, breathe, merge, osc, shake, smooth, win, wave } from './anim.mjs';
import { blinks } from './face.mjs';
import { blobD, capD, closest, ellD, fold, petalD, plateD, rot, side, slabD, subFrame } from './geo.mjs';

export function bipedClips(o = {}) {
  const {
    face = null, tail = [], hipH = 10, stride = 22, hop = false, hopH = 3, guard = false,
    punch: punch0 = { arm: [-90, 0, 0], fore: [-10, 0, 0] }, add = {},
    armSwing = 24, hopScale = 1, wing = null, cape = [], arms2 = 0, droop = 1,
    cheer: cheer0 = guard ? { arm: [-125, 38, 0], fore: [70, 0, 0] } : { arm: [-6, -125, 0], fore: [-8, 16, 0] },
  } = o;
  // an arm-only punch or cheer leaves the forearm at rest
  const punch = { arm: [0, 0, 0], fore: [0, 0, 0], ...punch0 };
  const cheer = { arm: [0, 0, 0], fore: [0, 0, 0], ...cheer0 };
  const lift = (k, extraArm = [0, 0, 0], extraFore = [0, 0, 0]) => ({
    arm: { r: cheer.arm.map((v, i) => v * k + extraArm[i]) },
    fore: { r: cheer.fore.map((v, i) => v * k + extraFore[i]) },
  });
  const F = (kind, blink = 0) => (face ? face.pose(kind, blink) : {});
  const tailSway = (u, amp = 6, cycles = 1, phase = 0) => wave(tail, u, { cycles, amp: [1.5, 0, amp], lag: 0.12, grow: 0.35, phase });
  const tailHold = (r) => Object.fromEntries(tail.map((n, i) => [n, { r: r.map((v) => v * (1 + 0.3 * i)) }]));
  const P = (punchK, arm) => ({ r: arm.map((v) => v * punchK) });
  const wingK = { open: [0, -10, -24], flap: 14, ...(wing ?? {}) };
  const W = (k, flap = 0) => (wing ? both('wing', { r: wingK.open.map((v, i) => v * k + (i === 1 ? (flap * wingK.flap) / 14 : 0)) }) : {});
  // the wings per clip: open share and beat (deg at flap 14)
  const wings = {
    idle: (t, u) => W(0.05 * osc(u, 1), 3 * osc(u, 2)),
    walk: (t, u) => W(0.1, 4 * osc(u, 2, 0.1)),
    idle_look: (t, u) => W(0.15 * win(u, 0.15, 0.75, 0.1), 2 * osc(u, 2)),
    windup: (t, u) => { const w = smooth(u / 0.8); return W(0.7 * w, -12 * w); },
    lunge: (t, u) => { const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]); return W(0.7 - 0.3 * hit, -12 + 26 * hit); },
    hurt: (t, u) => { const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.45]]); return W(0.5 * k, -14 * k + 4 * shake(u, 5)); },
    recoil: (t, u) => { const k = K(u, [[0, 0], [0.4, 1], [1, 0]]); return W(-0.2 * k, 6 * k); },
    faint: (t, u) => { const d = smooth((u - 0.18) / 0.55); const j = win(u, 0, 0.22, 0.05); return W(0.4 * j - 0.3 * d, -10 * j + 20 * d); },
    celebrate: (t, u) => { const up = win(u, 0, 1, 0.15); return W(up, 18 * Math.sin(TAU * 2 * u) * up); },
    enter: (t, u) => { const on = smooth((u - 0.2) / 0.35); const over = win(u, 0.45, 0.9, 0.12); return W(-0.3 * (1 - on) + 0.9 * over, -10 * over); },
    exit: (t, u) => { const up = win(u, 0, 0.85, 0.2); return W(0.5 * up, 10 * Math.sin(TAU * 2 * u) * up); },
  };
  // the cape per clip: [rx trailing back, rz sway] at the top link; it grows down the chain
  const capes = {
    idle: (t, u) => [1.5 * osc(u, 2, 0.2), 2 * osc(u, 1, 0.4)],
    walk: (t, u) => [7 + 2.5 * osc(u, 2, 0.15), 4 * osc(u, 1, 0.3)],
    idle_look: (t, u) => [1.5 * osc(u, 2), 3 * win(u, 0.15, 0.75, 0.1)],
    windup: (t, u) => [-3 * smooth(u / 0.8), -4 * smooth(u / 0.8)],
    lunge: (t, u) => { const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]); return [12 * hit, 6 * hit]; },
    hurt: (t, u) => { const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.45]]); return [-8 * k, 4 * shake(u, 5)]; },
    recoil: (t, u) => [-4 * K(u, [[0, 0], [0.4, 1], [1, 0]]), 0],
    faint: (t, u) => [4 * Math.sin(TAU * 1.5 * u) * (1 - smooth((u - 0.18) / 0.55)), 0],
    celebrate: (t, u) => [5 + 5 * Math.abs(Math.sin(TAU * u)), 6 * osc(u, 2)],
    enter: (t, u) => [-6 * win(u, 0.45, 0.9, 0.12), 0],
    exit: (t, u) => [2 * osc(u, 2), 3 * osc(u, 2)],
  };
  const capeOf = (name, t, u, p) => {
    if (!cape.length) return {};
    const [rx, rz] = capes[name]?.(t, u) ?? [0, 0];
    // hang plumb: undo most of the root's and the body's pitch at the top link
    const pitch = (p.root?.r?.[0] ?? 0) + (p.body?.r?.[0] ?? 0);
    return Object.fromEntries(cape.map((n, i) => [n, { r: [rx * (1 + 0.3 * i) - (i === 0 ? 0.7 * pitch : 0), 0, rz * (1 + 0.3 * i)] }]));
  };
  const arms2Of = (p) => {
    if (!arms2) return {};
    const out = {};
    for (const [a, b] of [['arm', 'arm2'], ['fore', 'fore2'], ['hand', 'hand2']]) {
      for (const S of ['L', 'R']) {
        const q = p[`${a}${S}`];
        if (q?.r) out[`${b}${S}`] = { r: q.r.map((v) => v * arms2) };
      }
    }
    return out;
  };
  const withAdd = (name, pose) => (t, u) => {
    const p = pose(t, u);
    return merge(p, wings[name]?.(t, u), capeOf(name, t, u, p), arms2Of(p), add[name]?.(t, u));
  };

  const clips = {
    // breathing over planted feet, a slow sway, a look to each side, two blinks; the arms (or the guard) bob
    idle: {
      seconds: 4,
      pose: (t, u) => {
        const look = K(u, [[0, 0], [0.14, 0], [0.24, 14], [0.46, 14], [0.56, -11], [0.82, -11], [0.92, 0]]);
        const tilt = K(u, [[0, 0], [0.14, 0], [0.24, 5], [0.46, 5], [0.56, -4], [0.82, -4], [0.92, 0]]);
        const g = guard ? 1 : 0;
        return {
          root: { r: [0.6 * osc(u, 2, 0.25), 1 * osc(u, 1), 0] },
          body: { p: [0, 0, breathe(t, 0.22)], r: [1.4 * osc(u, 2, 0.3), 1.6 * osc(u, 1), 2.5 * osc(u, 1, 0.5) + look * 0.12] },
          head: { r: [2.5 * osc(u, 2, 0.6), tilt, look] },
          ...F('open', blinks(u, [[0.34, 0.38], [0.86, 0.89], [0.91, 0.94]])),
          ...both('arm', { r: [(guard ? 3 : 4) * osc(u, guard ? 4 : 1, 0.2), (-3 - 2 * osc(u, 2)) * (1 - g), 0] },
            { r: [(guard ? 3 : 4) * osc(u, guard ? 4 : 1, 0.45), (-3 - 2 * osc(u, 2, 0.5)) * (1 - g), 0] }),
          ...both('fore', { r: [-6 - 4 * osc(u, 1, 0.3) - 3 * g * osc(u, 4, 0.1), 0, 0] }, { r: [-6 - 4 * osc(u, 1, 0.8) - 3 * g * osc(u, 4, 0.35), 0, 0] }),
          ...both('ear', { r: [3 * osc(u, 2, 0.1) - 14 * win(u, 0.62, 0.68, 0.02), 0, 0] }, { r: [3 * osc(u, 2, 0.4), 0, 0] }),
          ...tailSway(u, 7),
        };
      },
    },

    walk: hop ? {
      // hopping on both feet: crouch, spring, tuck in the air, land and absorb
      seconds: 0.6,
      pose: (t, u) => {
        const air = win(u, 0.2, 0.8, 0.12);
        const hgt = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.2) / 0.6))));
        const crouch = 1 - win(u, 0.12, 0.92, 0.1);
        return {
          root: { p: [0, 0, hopH * hgt], r: [6 * air - 4 * crouch, 0, 0] },
          body: { r: [5 + 6 * crouch - 4 * air, 0, 0] },
          head: { r: [-4 * air + 5 * crouch, 0, 0] },
          ...both('leg', { r: [18 * air - 6 * crouch, 0, 0] }),
          ...both('arm', { r: [guard ? -4 * air : 14 * air, 0, 0] }),
          ...both('fore', { r: [-10 * air, 0, 0] }),
          ...both('ear', { r: [-16 * air + 8 * crouch, 0, 0] }),
          ...F('open'),
          ...tailHold([-10 * air + 6 * crouch, 0, 0]),
        };
      },
    } : {
      // a stride: the legs swing from the hips, the body dips so the planted foot stays on the ground
      seconds: 0.8,
      pose: (t, u) => {
        const s = osc(u, 1);
        const dip = -hipH * (1 - Math.cos((stride * Math.abs(s) * Math.PI) / 180));
        return {
          root: { p: [0, 0, dip + 0.2 * Math.abs(osc(u, 2))], r: [4, -2.5 * s, 0] },
          legL: { r: [-stride * s, 0, 0] },
          legR: { r: [stride * s, 0, 0] },
          body: { r: [2, 2 * s, -6 * s] },
          head: { r: [-3 + 2.5 * osc(u, 2, 0.15), 1.2 * s, 4 * s] },
          ...(guard
            ? both('arm', { r: [-3 * osc(u, 2), 0, 0] })
            : both('arm', { r: [armSwing * s, -5, 0] }, { r: [-armSwing * s, -5, 0] })),
          ...both('fore', { r: [-16 + (guard ? 0 : 10 * s), 0, 0] }, { r: [-16 - (guard ? 0 : 10 * s), 0, 0] }),
          ...both('ear', { r: [4 * osc(u, 2, 0.3), 0, 0] }),
          ...F('open'),
          ...tailSway(u, 8, 1, 0.25),
        };
      },
    },

    // fidget: a curious look at the camera side with a head tilt, a double blink, a little nod
    idle_look: {
      seconds: 2.4,
      pose: (t, u) => {
        const on = K(u, [[0, 0], [0.15, 1], [0.75, 1], [0.92, 0]]);
        const nod = win(u, 0.55, 0.7, 0.05);
        return {
          body: { p: [0, 0, breathe(t, 0.22, 2.4)], r: [0, 0, 6 * on] },
          head: { r: [-6 * on + 8 * nod, -12 * on, 22 * on] },
          ...F('open', blinks(u, [[0.3, 0.34], [0.37, 0.41]])),
          ...both('ear', { r: [-10 * on, 0, 0] }),
          ...tailSway(u, 10, 2),
        };
      },
    },

    // battle: pulls the right arm back, twisting away and leaning back, eyes narrowed
    windup: {
      seconds: 0.25,
      pose: (t, u) => {
        const w = smooth(u / 0.8);
        return {
          root: { r: [-3 * w, 0, 0] },
          body: { r: [-6 * w, 0, -16 * w] },
          head: { r: [4 * w, 0, 12 * w] },
          ...F('open', 0.4 * w),
          armR: { r: [40 * w, 10 * w, 0] },
          foreR: { r: [-50 * w, 0, 0] },
          armL: { r: [-15 * w, -8 * w, 0] },
          ...both('ear', { r: [-12 * w, 0, 0] }),
          ...tailHold([-8 * w, 0, 0]),
        };
      },
    },

    // battle: the straight right, landing at u = 0.4, then back
    lunge: {
      seconds: 0.3,
      pose: (t, u) => {
        const back = K(u, [[0, 0.6], [0.12, 1], [0.22, 0]]);
        const hit = K(u, [[0.12, 0], [0.4, 1], [0.62, 1], [1, 0]]);
        return {
          root: { r: [6 * hit - 3 * back, 0, 0] },
          body: { r: [10 * hit - 6 * back, 0, 20 * hit - 16 * back] },
          head: { r: [4 * hit, 0, -12 * hit + 12 * back] },
          ...F('open', 0.35),
          armR: { r: [40 * back + punch.arm[0] * hit, 10 * back + punch.arm[1] * hit, punch.arm[2] * hit] },
          foreR: { r: [-50 * back + punch.fore[0] * hit, punch.fore[1] * hit, punch.fore[2] * hit] },
          handR: { s: 1 + 0.15 * hit },
          armL: { r: [-15 * back + 20 * hit, -8, 0] },
          ...both('ear', { r: [-12, 0, 0] }),
          ...tailHold([12 * hit, 0, 0]),
        };
      },
    },

    // battle: hit. The head snaps back, the arms fly out, eyes squeezed > <, a decaying shake
    hurt: {
      seconds: 0.26,
      pose: (t, u) => {
        const k = K(u, [[0, 0], [0.18, 1], [0.6, 0.75], [1, 0.45]]);
        const sh = shake(u, 5);
        return {
          root: { r: [-5 * k, 0, 3 * sh] },
          body: { r: [-10 * k, 3 * sh, 0] },
          head: { r: [-20 * k, 6 * sh, 5 * sh] },
          jaw: { r: [10 * k, 0, 0] },
          ...F(u > 0.06 ? 'squeeze' : 'open'),
          ...both('arm', { r: [10 * k, -40 * k, 0] }, { r: [6 * k, -36 * k, 0] }),
          ...both('fore', { r: [-20 * k, 0, 0] }),
          ...both('ear', { r: [24 * k, -10 * k, 0] }),
          ...tailHold([14 * k, 0, 0]),
        };
      },
    },

    // battle: a smaller flinch back, eyes shut
    recoil: {
      seconds: 0.25,
      pose: (t, u) => {
        const k = K(u, [[0, 0], [0.4, 1], [1, 0]]);
        return {
          root: { r: [-3 * k, 0, 0] },
          body: { r: [-7 * k, 0, 0] },
          head: { r: [-9 * k, 0, 5 * k] },
          ...F(k > 0.3 ? 'shut' : 'open', k * 3),
          ...both('arm', { r: [14 * k, -10 * k, 0] }),
          ...both('fore', { r: [-16 * k, 0, 0] }),
          ...both('ear', { r: [14 * k, 0, 0] }),
          ...tailHold([8 * k, 0, 0]),
        };
      },
    },

    // battle: knocked out. A jolt, then it sags: the body folds forward over planted feet, the head droops, the arms
    // hang, the eyes go x x
    faint: {
      seconds: 0.9,
      pose: (t, u) => {
        const jolt = win(u, 0, 0.22, 0.05);
        const down = smooth((u - 0.18) / 0.55);
        const sway = Math.sin(TAU * 1.5 * u) * (1 - down) * 0.6;
        return {
          root: { r: [4 * down, 0, 3 * down + 3 * sway] },
          body: { p: [0, 0, -0.3 * down], r: [-10 * jolt + 22 * down * droop, -6 * down, 0] },
          head: { r: [-18 * jolt + 30 * down * droop, 14 * down, -8 * down] },
          jaw: { r: [12 * down, 0, 0] },
          ...F(u > 0.1 ? 'dizzy' : 'open'),
          ...both('arm', { r: [-10 * down + 10 * jolt, 8 * down - 36 * jolt, 0] }, { r: [-6 * down + 10 * jolt, 10 * down - 32 * jolt, 0] }),
          ...both('fore', { r: [8 * down, 0, 0] }),
          ...both('ear', { r: [30 * down, -14 * down, 0] }),
          ...tailHold([16 * down, 0, 4 * down]),
        };
      },
    },

    // battle / evolution: two hops with the arms up in a wide V, happy ^ ^ eyes
    celebrate: {
      seconds: 0.6,
      pose: (t, u) => {
        const hp = Math.abs(Math.sin(TAU * u));
        const up = win(u, 0, 1, 0.15);
        const pump = Math.sin(TAU * 2 * u);
        return {
          root: { p: [0, 0, hopH * 0.6 * hp * hopScale] },
          body: { p: [0, 0, 0.4 * hp * (1 - hopScale)], r: [-4 * hp, 0, 0] },
          head: { r: [-8 * up, 8 * pump * up, 0] },
          jaw: { r: [8 * up, 0, 0] },
          ...F('happy'),
          ...both('arm', lift(up, [0, 10 * pump, 0]).arm, lift(up, [0, -10 * pump, 0]).arm),
          ...both('fore', lift(up, [0, 0, 0], [0, 14 * pump * up, 0]).fore, lift(up, [0, 0, 0], [0, -14 * pump * up, 0]).fore),
          ...both('leg', { r: [-10 * hp * hopScale, -5 * hp * hopScale, 0] }),
          ...both('ear', { r: [-12 * hp, -8 * hp, 0] }),
          ...tailSway(u, 16, 2),
        };
      },
    },

    // sent out: crouched with the eyes shut, it springs upright with an overshoot and the eyes pop open
    enter: {
      seconds: 0.45,
      pose: (t, u) => {
        const on = smooth((u - 0.2) / 0.35);
        const over = win(u, 0.45, 0.9, 0.12);
        return {
          body: { p: [0, 0, -0.8 * (1 - on)], r: [16 * (1 - on) * droop - 5 * over, 0, 0], s: [1, 1, 1 + 0.05 * over] },
          head: { r: [22 * (1 - on) * droop - 6 * over, 0, 0] },
          ...F(on < 0.5 ? 'shut' : 'open'),
          ...both('arm', { r: [-6 * (1 - on), -24 * over, 0] }),
          ...both('fore', { r: [-24 * over, 0, 0] }),
          ...both('ear', { r: [20 * (1 - on) - 14 * over, 0, 0] }),
          ...tailHold([10 * (1 - on) - 8 * over, 0, 0]),
        };
      },
    },

    // recalled: a quick wave of the left arm with happy eyes
    exit: {
      seconds: 0.35,
      pose: (t, u) => {
        const up = win(u, 0, 0.85, 0.2);
        const wv = Math.sin(TAU * 2 * u);
        return {
          head: { r: [0, 0, 14 * up] },
          ...F(u < 0.85 ? 'happy' : 'shut'),
          armL: lift(up).arm,
          foreL: lift(up, [0, 0, 0], [0, 22 * wv * up, 0]).fore,
          ...both('ear', { r: [-8 * up, 0, 0] }),
          ...tailSway(u, 10, 1),
        };
      },
    },
  };
  for (const [name, c] of Object.entries(clips)) c.pose = withAdd(name, c.pose);
  return clips;
}

// ---- Part tests for assign(), in the scad's own numbers (geo.mjs underneath) ----
//   pick(c, [[joint, test], ...]) returns the joint whose primitive lies nearest to the centroid c (1 = on its surface).
//   A joint written with a trailing '*' is a mirror_x() part: its test sees c folded onto +X (write the scad's left-side
//   numbers) and the '*' becomes the side, L for +X.
//   Tests: ell(r, p), limb(p1, p2, r1, r2), blob(parts), petal(r, p, rot), spike(p, d, r), box(size, centre),
//   any(test, ...) for a part made of several primitives, mx(test) for a mirrored part of an unsided joint, blade()
//   for a sword or a staff, and ...chain(names, pts, rs) spreads a chain's links over joints. The sprite-matched scads
//   (2026-10-28) add plate() / slab() outlines, often inside pp(d): plate(pts, t, ppFrame(d)), inFrame(frame, test).
export const ell = (r, p = [0, 0, 0]) => (c) => ellD(c, r, p);
export const limb = (p1, p2, r1, r2 = r1) => (c) => capD(c, p1, p2, r1, r2);
export const blob = (parts) => (c) => blobD(c, parts);
export const petal = (r, p, rot = [0, 0, 0]) => (c) => petalD(c, r, p, rot);
/** spike(p, d, r): a cone from p along d, tested as a tapering capsule. */
export const spike = (p, d, r) => limb(p, [p[0] + d[0], p[1] + d[1], p[2] + d[2]], r, Math.max(0.15, r * 0.25));
/** box(size, centre): a cube(size, center = true) translated to centre. */
export const box = (sz, p = [0, 0, 0]) => (c) => Math.max(...[0, 1, 2].map((i) => Math.abs(c[i] - p[i]) / (sz[i] / 2)));
export const any = (...tests) => (c) => Math.min(...tests.map((t) => t(c)));
/** inFrame(frame, test): a primitive written inside a scad sub-frame (`subFrame(t, r, s)`, `ppFrame(d)`), in its own numbers. */
export const inFrame = (frame, test) => (c) => test(frame.local(c));
/** plate(pts, t, frame?) / slab(pts, depth, inset, frame?): lib.scad's flat [x, z] outlines extruded along Y. */
export const plate = (pts, t = 1, frame = null) => (c) => plateD(frame ? frame.local(c) : c, pts, t);
export const slab = (pts, depth, inset = 1.5, frame = null) => (c) => slabD(frame ? frame.local(c) : c, pts, depth, inset);
/** lib.scad's picture plane: ppFrame(d) is `pp(d) { ... }` (front sheet), ppBackFrame(d) is `ppBack(d) { ... }`. */
export const VIEW = 30;
export const ppFrame = (d = 0) => subFrame(rot([0, 0, VIEW], [0, d, 0]), [0, 0, VIEW]);
export const ppBackFrame = (d = 0) => subFrame(rot([0, 0, 180 - VIEW], [0, d, 0]), [0, 0, 180 - VIEW]);
/** fromSheet(sx, z, y): the scad point of a front-sheet reading (lib.scad fromSheet), for pivots placed that way. */
export const fromSheet = (sx, z, y = 0) => [(sx - Math.sin((VIEW * Math.PI) / 180) * y) / Math.cos((VIEW * Math.PI) / 180), y, z];
/** mx(test): a mirror_x() primitive of a joint that is not sided (a shoulder pad on the body): tested folded. */
export const mx = (test) => (c) => test(fold(c));
/** blade(p, d, len, r, back): a straight weapon from p along d (a sword's grip at p), `back` behind p, radius r. */
export const blade = (p, d, len, r, back = 0) => {
  const n = Math.hypot(...d);
  const at = (k) => p.map((v, i) => v + (d[i] / n) * k);
  return limb(at(-back), at(len), r);
};
/** chain(names, pts, rs): one [joint, test] entry per link of a scad chain(); link i goes to names[i] (the last name
 * takes the rest). Spread the result into a pick() list. */
export const chain = (names, pts, rs) => pts.slice(1).map((p, i) => [names[Math.min(i, names.length - 1)], limb(pts[i], p, rs[i], rs[i + 1])]);
export function pick(c, list, max = Infinity) {
  const f = fold(c);
  const S = side(c);
  return closest(list.map(([n, t]) => (n.endsWith('*') ? [n.slice(0, -1) + S, t(f)] : [n, t(c)])), max);
}
/** pair('arm*', 'body', at, extra): the L joint at `at` (x > 0, the scad's left numbers) and its R mirror; a parent
 * ending in '*' takes the same side. A rest `rot` mirrors too (ry and rz flip). */
export function pair(name, parent, at, extra = {}) {
  const base = name.slice(0, -1);
  return ['L', 'R'].map((S) => {
    const k = S === 'L' ? 1 : -1;
    const j = { name: `${base}${S}`, at: [Math.abs(at[0]) * k, at[1], at[2]], ...extra };
    if (parent) j.parent = parent.endsWith('*') ? `${parent.slice(0, -1)}${S}` : parent;
    if (extra.rot && S === 'R') j.rot = [extra.rot[0], -extra.rot[1], -extra.rot[2]];
    return j;
  });
}
