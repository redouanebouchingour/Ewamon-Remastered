import { describe, expect, it } from 'vitest';
import { createRng, fnv1a32 } from '../src/index';
import type { RngState } from '../src/index';
import { countingRng } from './helpers';

/** Independent reference: the §2.1 pseudocode, written out again here so the src implementation is checked, not trusted. */
function referenceSfc32(seedWords: RngState, warmup: number): () => number {
  let [a, b, c, d] = seedWords.map((w) => w >>> 0) as [number, number, number, number];
  const step = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = ((c << 21) | (c >>> 11)) | 0;
    c = (c + t) | 0;
    return t >>> 0;
  };
  for (let i = 0; i < warmup; i++) step();
  return step;
}

function referenceSplitmix32(seed: number): RngState {
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

// Committed vectors: the same on Node 22 / 24 / Chromium / Firefox / WebKit (all int32 arithmetic).
const EWAMON_FIRST_8_U32 = [3338543495, 2167654340, 4029141625, 511766023, 2376979232, 611428102, 753663850, 808890912];
const EWAMON_STATE_AFTER_8: RngState = [1108731335, 2339651921, 1364996143, 1017437320];
const SEED_12345_INT_1000 = 546;
const FNV_EMPTY = 2166136261; // 0x811c9dc5, the FNV-1a offset basis
const FNV_EWAMON = 3164891102;

describe('§2.1 Rng — sfc32', () => {
  it("pins the first 8 outputs for seed 'ewamon'", () => {
    const r = createRng('ewamon');
    const got = Array.from({ length: 8 }, () => Math.round(r.next() * 4294967296));
    expect(got).toEqual(EWAMON_FIRST_8_U32);
    expect(r.snapshot()).toEqual(EWAMON_STATE_AFTER_8);
  });

  it('next() is u32 / 2^32, exact in IEEE double', () => {
    const r = createRng('ewamon');
    for (let i = 0; i < 8; i++) expect(r.next()).toBe(EWAMON_FIRST_8_U32[i]! / 4294967296);
  });

  it('matches an independent sfc32 + splitmix32 reference with 12 warm-up draws', () => {
    for (const seed of [0, 1, 12345, -7, 0xffffffff, 2 ** 31]) {
      const ref = referenceSfc32(referenceSplitmix32(seed), 12);
      const r = createRng(seed);
      for (let i = 0; i < 64; i++) expect(r.next()).toBe(ref() / 4294967296);
    }
  });

  it('createRng(12345).int(1000) after warm-up equals the committed constant', () => {
    expect(createRng(12345).int(1000)).toBe(SEED_12345_INT_1000);
  });

  it('int(n) is floor(next() * n) and validates n', () => {
    const a = createRng(99);
    const b = createRng(99);
    for (let i = 0; i < 100; i++) expect(a.int(37)).toBe(Math.floor(b.next() * 37));
    const r = createRng(1);
    expect(() => r.int(0)).toThrow(RangeError);
    expect(() => r.int(1.5)).toThrow(RangeError);
    expect(() => r.int(2 ** 31)).toThrow(RangeError);
    expect(r.int(1)).toBe(0);
    expect(r.int(2 ** 31 - 1)).toBeGreaterThanOrEqual(0);
  });

  it('string seeds route through fnv1a32', () => {
    const a = createRng('ewamon');
    const b = createRng(fnv1a32('ewamon'));
    for (let i = 0; i < 16; i++) expect(a.next()).toBe(b.next());
  });

  it('fnv1a32 committed constants', () => {
    expect(fnv1a32('')).toBe(FNV_EMPTY);
    expect(fnv1a32('ewamon')).toBe(FNV_EWAMON);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    // over UTF-16 code units, not bytes
    expect(fnv1a32('é')).not.toBe(fnv1a32('Ã©'));
  });

  it('snapshot() → createRng(state) resumes byte-identically with no warm-up', () => {
    const a = createRng('resume');
    for (let i = 0; i < 5; i++) a.next();
    const snap = a.snapshot();
    const b = createRng(snap);
    const c = createRng(snap);
    expect(b.snapshot()).toEqual(snap);
    for (let i = 0; i < 32; i++) {
      const x = a.next();
      expect(b.next()).toBe(x);
      expect(c.next()).toBe(x);
    }
  });

  it('fork() advances the parent by exactly 4 and yields an independent stream', () => {
    const a = createRng(7);
    const twin = createRng(7);
    const counted = countingRng(a);
    const child = counted.fork();
    expect(counted.count()).toBe(4);
    for (let i = 0; i < 4; i++) twin.next();
    expect(a.snapshot()).toEqual(twin.snapshot());
    // child seeded from the 4 draws verbatim (no warm-up)
    const t2 = createRng(7);
    const words: [number, number, number, number] = [
      Math.round(t2.next() * 4294967296),
      Math.round(t2.next() * 4294967296),
      Math.round(t2.next() * 4294967296),
      Math.round(t2.next() * 4294967296),
    ];
    expect(child.snapshot()).toEqual(words);
    expect(child.next()).not.toBe(a.next());
  });

  it('shuffle consumes exactly n − 1 draws, returns a new array, and is a permutation', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const r = countingRng(createRng(3));
    const out = r.shuffle(src);
    expect(r.count()).toBe(9);
    expect(out).not.toBe(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect([...out].sort((x, y) => x - y)).toEqual(src);
    expect(countingRng(createRng(3)).shuffle([]).length).toBe(0);
    const one = countingRng(createRng(3));
    one.shuffle([42]);
    expect(one.count()).toBe(0);
  });

  it('pick and chance consume exactly one draw; pick throws on empty', () => {
    const r = countingRng(createRng(11));
    r.pick(['a', 'b', 'c']);
    expect(r.count()).toBe(1);
    r.chance(0.5);
    expect(r.count()).toBe(2);
    expect(() => r.pick([])).toThrow(RangeError);
    expect(createRng(1).chance(1)).toBe(true);
    expect(createRng(1).chance(0)).toBe(false);
  });

  it('numeric seeds are taken through (seed | 0): 2^32 + 5 seeds like 5', () => {
    const a = createRng(5);
    const b = createRng(2 ** 32 + 5);
    for (let i = 0; i < 8; i++) expect(a.next()).toBe(b.next());
  });

  it('is uniform enough: 100k int(10) draws land within 3% of 10k per bucket', () => {
    const r = createRng('uniform');
    const buckets = new Array<number>(10).fill(0);
    for (let i = 0; i < 100_000; i++) buckets[r.int(10)]!++;
    for (const b of buckets) expect(Math.abs(b - 10_000)).toBeLessThan(300);
  });
});
