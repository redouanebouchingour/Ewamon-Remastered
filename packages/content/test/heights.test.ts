/**
 * Species heights (`.design/additions/heights.js` → `SpeciesDef.heightM`): every creature has one, a line never shrinks
 * as it evolves, and a battle form that names its own height stands taller than its species.
 */
import { describe, expect, it } from 'vitest';
import { formsOf } from '@ewa/core';
import { SPECIES } from '../src/index';

const byId = new Map(SPECIES.map((s) => [s.id, s]));

describe('species heights', () => {
  it('every species stands between 0.1 and 10 m', () => {
    for (const s of SPECIES) {
      expect(s.heightM, s.id).toBeGreaterThanOrEqual(0.1);
      expect(s.heightM, s.id).toBeLessThanOrEqual(10);
    }
  });

  it('an evolution stands at least as tall as what it evolved from', () => {
    for (const s of SPECIES) {
      if (s.evolvesFrom === null) continue;
      const from = byId.get(s.evolvesFrom)!;
      expect(s.heightM, `${from.id} ${from.heightM} m → ${s.id} ${s.heightM} m`).toBeGreaterThanOrEqual(from.heightM);
    }
  });

  it("a form with its own height outgrows its species'", () => {
    for (const s of SPECIES) {
      for (const f of formsOf(s)) {
        if (f.heightM !== undefined) expect(f.heightM, `${s.id}_${f.id}`).toBeGreaterThan(s.heightM);
      }
    }
  });
});
