/**
 * §2.1 — sfc32 (Chris Doty-Humphrey). Four uint32 words of state; every arithmetic step is
 * forced to int32 with `| 0` and read back with `>>> 0`, so every JS engine produces the same
 * sequence. `next()` returns `u32 / 2^32`, exact in IEEE double.
 */
import type { Rng, RngState } from './types';

/** FNV-1a, 32-bit, over UTF-16 code units. Also used by digestBattleState (§2.20). */
export function fnv1a32(s: string): number {
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) | 0;
    h = Math.imul(h, 0x01000193) | 0;
  }
  return h >>> 0;
}

/** splitmix32 expansion of a numeric seed into four uint32 words (§2.1). */
function expandSeed(seed: number): [number, number, number, number] {
  let x = (seed | 0) >>> 0;
  const words: number[] = [];
  for (let i = 0; i < 4; i++) {
    x = (x + 0x9e3779b9) | 0;
    let z = x;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    words.push((z ^ (z >>> 16)) >>> 0);
    x = x >>> 0;
  }
  return [words[0]!, words[1]!, words[2]!, words[3]!];
}

function isRngState(seed: RngState | number | string): seed is RngState {
  return typeof seed !== 'number' && typeof seed !== 'string';
}

/**
 * number  -> seeded via splitmix32 expansion of (seed | 0) into 4 words, then 12 warm-up draws.
 * string  -> fnv1a32(seed) is the number seed above.
 * RngState-> used verbatim, no warm-up (this is how a battle resumes).
 */
export function createRng(seed: RngState | number | string): Rng {
  let a: number;
  let b: number;
  let c: number;
  let d: number;
  let warmup = 0;
  if (isRngState(seed)) {
    a = seed[0] >>> 0;
    b = seed[1] >>> 0;
    c = seed[2] >>> 0;
    d = seed[3] >>> 0;
  } else {
    const n = typeof seed === 'string' ? fnv1a32(seed) : seed;
    [a, b, c, d] = expandSeed(n);
    warmup = 12;
  }

  const nextU32 = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = ((c << 21) | (c >>> 11)) | 0;
    c = (c + t) | 0;
    return t >>> 0;
  };

  for (let i = 0; i < warmup; i++) nextU32();

  const rng: Rng = {
    next(): number {
      return nextU32() / 4294967296;
    },
    int(n: number): number {
      if (!Number.isInteger(n) || n < 1 || n > 2147483647) {
        throw new RangeError(`Rng.int: n must be an integer in 1..2^31-1, got ${n}`);
      }
      return Math.floor(rng.next() * n);
    },
    chance(p: number): boolean {
      return rng.next() < p;
    },
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) throw new RangeError('Rng.pick: empty array');
      return arr[rng.int(arr.length)]!;
    },
    shuffle<T>(arr: readonly T[]): T[] {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        const tmp = out[i]!;
        out[i] = out[j]!;
        out[j] = tmp;
      }
      return out;
    },
    fork(): Rng {
      const s: [number, number, number, number] = [nextU32(), nextU32(), nextU32(), nextU32()];
      return createRng(s);
    },
    snapshot(): RngState {
      return [a >>> 0, b >>> 0, c >>> 0, d >>> 0];
    },
  };
  return rng;
}
