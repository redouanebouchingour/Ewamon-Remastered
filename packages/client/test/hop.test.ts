import { describe, expect, it } from 'vitest';
import { HOP, Hop } from '../src/scene/hop';

describe('jump hop', () => {
  it('rises to 2 m at the midpoint and lands after 780 ms', () => {
    const h = new Hop();
    expect(h.lift(0)).toBe(0);
    expect(h.start(1000)).toBe(true);
    expect(h.lift(1000)).toBe(0);
    expect(h.lift(1000 + HOP.ms / 2)).toBeCloseTo(HOP.heightM, 6);
    expect(h.lift(1000 + HOP.ms / 4)).toBeCloseTo(HOP.heightM * 0.75, 6);
    expect(h.lift(1000 + HOP.ms)).toBe(0);
    expect(h.active(1000 + HOP.ms)).toBe(false);
  });

  it('ignores a press mid-hop, allows the next after landing, and cancels', () => {
    const h = new Hop();
    h.start(0);
    expect(h.start(200)).toBe(false);
    expect(h.lift(HOP.ms / 2)).toBeCloseTo(HOP.heightM, 6);
    expect(h.start(HOP.ms)).toBe(true);
    h.cancel();
    expect(h.lift(HOP.ms + 100)).toBe(0);
  });
});
