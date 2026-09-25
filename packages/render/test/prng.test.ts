import { describe, expect, it } from 'vitest';
import { createRng } from '@ewa/core';
import { createPrng, fnv1a32 } from '../src/zone/prng.js';

/** The literal committed in packages/core/test/rng.test.ts (SPEC §10.5.2: copied, so the two copies cannot drift). */
const SEED_12345_INT_1000 = 546;

describe('§10.5.2 render Prng (sfc32 copy)', () => {
  it('createPrng(12345).int(1000) equals the constant committed in core', () => {
    expect(createPrng(12345).int(1000)).toBe(SEED_12345_INT_1000);
  });

  it('reproduces core createRng draw for draw (numeric, string and state seeds)', () => {
    for (const seed of [0, 1, 12345, -7, 0xffffffff, 2 ** 31, 0x4d1e0001]) {
      const a = createPrng(seed); const b = createRng(seed);
      for (let i = 0; i < 64; i++) expect(a.next()).toBe(b.next());
    }
    const a = createPrng('mirevale'); const b = createRng('mirevale');
    for (let i = 0; i < 16; i++) expect(a.int(97)).toBe(b.int(97));
    const s = createRng(99).snapshot();
    const c = createPrng(s); const d = createRng(s);
    for (let i = 0; i < 16; i++) expect(c.next()).toBe(d.next());
  });

  it('fork() without a label matches core fork(); labels give distinct, order-stable streams', () => {
    const a = createPrng(7).fork(); const b = createRng(7).fork();
    for (let i = 0; i < 16; i++) expect(a.next()).toBe(b.next());
    const r1 = createPrng(7); const l1 = r1.fork('layout'); const s1 = r1.fork('scatter');
    const r2 = createPrng(7); const l2 = r2.fork('layout'); const s2 = r2.fork('scatter');
    expect(l1.snapshot()).toEqual(l2.snapshot());
    expect(s1.snapshot()).toEqual(s2.snapshot());
    expect(l1.snapshot()).not.toEqual(s1.snapshot());
    expect(fnv1a32('layout')).toBe(fnv1a32('layout'));
  });
});
