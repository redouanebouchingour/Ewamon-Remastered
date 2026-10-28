// Clip maths shared by the rig files (rig.mjs samples `pose(t, u)` at 30 fps; t in seconds, u = t / seconds).
// Rotation signs (scad frame: Z up, the face looks along -Y, +X is the creature's own left), checked on Flowbot:
//   rx > 0 tips a part's top forward (a nod); a hanging arm swings BACK, so a forward raise is rx < 0
//   ry > 0 tips the top towards +X; a hanging left arm (+X) lifts outwards with ry < 0 (the right arm mirrors)
//   rz > 0 turns the face towards +X (the camera side of a front-facing creature in game)

export const TAU = Math.PI * 2;
export const HIDE = 1e-4;
export const DEG = Math.PI / 180;

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const osc = (u, cycles, phase = 0) => Math.sin(TAU * (u * cycles + phase));
export const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
export const mixv = (a, b, t) => (Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * t) : a + (b - a) * t);

/** Eased keyframes [[u, value], …] (numbers or arrays), held before the first and after the last. */
export function K(u, keys) {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (u <= keys[i][0]) return mixv(keys[i - 1][1], keys[i][1], smooth((u - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])));
  }
  return keys[keys.length - 1][1];
}

/** Deterministic 0..1 noise (flicker, jitter). */
export const hash = (n) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
/** A window 0..1..0 between u0 and u1 with `fade` ramps. */
export const win = (u, u0, u1, fade = 0.04) => Math.min(smooth((u - u0) / fade), smooth((u1 - u) / fade));
/** A decaying shake: `cycles` wiggles over the clip, fading out by u = 1. */
export const shake = (u, cycles = 5) => Math.sin(TAU * cycles * u) * (1 - u);
/** The idle breath, 0..amp on a `period` s beat (2 s keeps a 4 s loop seamless). */
export const breathe = (t, amp = 0.18, period = 2) => (Math.sin((TAU * t) / period) * 0.5 + 0.5) * amp;

/** The right-hand mirror of a left pose: ry, rz and the x offset flip. */
export const mirror = (q) => ({
  ...q,
  ...(q.r ? { r: [q.r[0], -q.r[1], -q.r[2]] } : {}),
  ...(q.p ? { p: [-q.p[0], q.p[1], q.p[2]] } : {}),
});
/** A left / right pair `<name>L` / `<name>R`; the right one is written as a left pose and mirrored. */
export const both = (name, left, right = left) => ({ [`${name}L`]: left, [`${name}R`]: mirror(right) });

/**
 * Layers partial poses: rotations and offsets add, scales multiply. Later layers go on top, so a clip is a base pose
 * plus the creature's own extras: `merge(base(t, u), { tail1: { r: [...] } })`.
 */
export function merge(...poses) {
  const out = {};
  for (const pose of poses) {
    if (!pose) continue;
    for (const [j, q] of Object.entries(pose)) {
      if (!q) continue;
      const o = (out[j] ??= {});
      if (q.r) o.r = o.r ? o.r.map((v, i) => v + q.r[i]) : [...q.r];
      if (q.p) o.p = o.p ? o.p.map((v, i) => v + q.p[i]) : [...q.p];
      if (q.s !== undefined) {
        const a = o.s ?? 1;
        const b = q.s;
        o.s = Array.isArray(a) || Array.isArray(b)
          ? [0, 1, 2].map((i) => (Array.isArray(a) ? a[i] : a) * (Array.isArray(b) ? b[i] : b))
          : a * b;
      }
    }
  }
  return out;
}

/** A chain of joints (`tail1`, `tail2`, …) bending together: each link gets `r`, scaled by `w(i, n)` (0-based). */
export function chainPose(names, r, w = () => 1) {
  return Object.fromEntries(names.map((n, i) => [n, { r: r.map((v) => v * w(i, names.length)) }]));
}

/** A wave running down a chain: link i lags `lag` cycles behind the previous one, amplitude growing to the tip. */
export function wave(names, u, { cycles = 1, lag = 0.12, amp = [0, 0, 10], grow = 0.5, phase = 0 } = {}) {
  return Object.fromEntries(names.map((n, i) => {
    const k = 1 + grow * i;
    const s = osc(u, cycles, phase - lag * i);
    return [n, { r: amp.map((a) => a * k * s) }];
  }));
}

/**
 * The rig's export: drops pose entries for joints this creature does not have (the body-plan templates name every
 * joint a plan may have), so a template clip works on any creature of the plan.
 */
export function rigDef({ joints, clips, ...rest }) {
  const names = new Set(joints.map((j) => j.name));
  const keep = (pose) => Object.fromEntries(Object.entries(pose).filter(([j]) => names.has(j)));
  return {
    ...rest,
    joints,
    clips: Object.fromEntries(Object.entries(clips).map(([name, c]) => [name, { ...c, pose: (t, u) => keep(c.pose(t, u)) }])),
  };
}
