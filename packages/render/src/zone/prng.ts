/**
 * SPEC §10.5.2 — the render-side copy of the spine's sfc32 (§2.1). Render may not import `@ewa/core`, so the
 * 12-line step is re-implemented here verbatim (`| 0` / `>>> 0`, splitmix32 expansion of a numeric seed, 12 warm-up
 * draws). `packages/render/test/prng.test.ts` pins `createPrng(12345).int(1000)` to core's committed constant, so
 * the two copies cannot drift silently.
 *
 * `fork(label)`: 4 draws of this stream seed the child (the core `fork()` rule) and the label's FNV-1a hash is
 * folded into the child's first word, so `fork('layout')` and `fork('scatter')` taken in the fixed builder order
 * are distinct streams even when a later generator adds a fork of its own.
 */

export type PrngState = readonly [number, number, number, number];

export interface Prng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [0, n). */
  int(n: number): number;
  /** Uniform in [a, b). */
  range(a: number, b: number): number;
  /** True with probability p. One draw. */
  chance(p: number): boolean;
  /** One element, uniform. One draw. */
  pick<T>(a: readonly T[]): T;
  /** A new independent stream seeded from 4 draws of this one, salted with `label`. */
  fork(label?: string): Prng;
  snapshot(): PrngState;
}

/** FNV-1a 32-bit over UTF-16 code units (identical to core's `fnv1a32`). */
export function fnv1a32(s: string): number {
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) | 0;
    h = Math.imul(h, 0x01000193) | 0;
  }
  return h >>> 0;
}

function expandSeed(seed: number): [number, number, number, number] {
  let x = (seed | 0) >>> 0;
  const w: number[] = [];
  for (let i = 0; i < 4; i++) {
    x = (x + 0x9e3779b9) | 0;
    let z = x;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    w.push((z ^ (z >>> 16)) >>> 0);
    x = x >>> 0;
  }
  return [w[0]!, w[1]!, w[2]!, w[3]!];
}

/** number → splitmix32 + 12 warm-up draws; string → fnv1a32 then as number; state → verbatim, no warm-up. */
export function createPrng(seed: number | string | PrngState): Prng {
  let a: number; let b: number; let c: number; let d: number;
  let warm = 0;
  if (typeof seed === 'number' || typeof seed === 'string') {
    [a, b, c, d] = expandSeed(typeof seed === 'string' ? fnv1a32(seed) : seed);
    warm = 12;
  } else {
    a = seed[0] >>> 0; b = seed[1] >>> 0; c = seed[2] >>> 0; d = seed[3] >>> 0;
  }
  const u32 = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = ((c << 21) | (c >>> 11)) | 0;
    c = (c + t) | 0;
    return t >>> 0;
  };
  for (let i = 0; i < warm; i++) u32();
  const p: Prng = {
    next: () => u32() / 4294967296,
    int(n) {
      if (!Number.isInteger(n) || n < 1 || n > 2147483647) throw new RangeError(`Prng.int: n must be an integer in 1..2^31-1, got ${n}`);
      return Math.floor(p.next() * n);
    },
    range: (lo, hi) => lo + (hi - lo) * p.next(),
    chance: (q) => p.next() < q,
    pick(arr) {
      if (arr.length === 0) throw new RangeError('Prng.pick: empty array');
      return arr[p.int(arr.length)]!;
    },
    fork(label) {
      const s: [number, number, number, number] = [u32(), u32(), u32(), u32()];
      if (label !== undefined) s[0] = (s[0] ^ fnv1a32(label)) >>> 0;
      return createPrng(s);
    },
    snapshot: () => [a >>> 0, b >>> 0, c >>> 0, d >>> 0],
  };
  return p;
}

/** Deterministic hash of two integers + salt into [0, 1) (per-cell jitter without a stream). */
export function hash2(x: number, z: number, salt = 0): number {
  let h = Math.imul((x | 0) ^ 0x27d4eb2d, 0x165667b1) ^ Math.imul((z | 0) + 0x61c88647, 0x85ebca77) ^ Math.imul(salt | 0, 0xc2b2ae3d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Smooth 2-D value noise in [-1, 1] from `hash2` (cubic fade). Pure, allocation-free. */
export function valueNoise(x: number, z: number, salt = 0): number {
  const ix = Math.floor(x); const iz = Math.floor(z);
  const fx = x - ix; const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx); const v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, salt); const b = hash2(ix + 1, iz, salt);
  const c = hash2(ix, iz + 1, salt); const d = hash2(ix + 1, iz + 1, salt);
  const top = a + (b - a) * u; const bot = c + (d - c) * u;
  return (top + (bot - top) * v) * 2 - 1;
}

/** fBm over `valueNoise`: `octaves` octaves, lacunarity 2, gain 0.5; output roughly in [-1, 1]. */
export function fbm2(x: number, z: number, octaves: number, salt = 0): number {
  let s = 0; let amp = 0.5; let f = 1; let norm = 0;
  for (let o = 0; o < octaves; o++) {
    s += amp * valueNoise(x * f, z * f, salt + o * 131);
    norm += amp; amp *= 0.5; f *= 2;
  }
  return s / norm;
}
