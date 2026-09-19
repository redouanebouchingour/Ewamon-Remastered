import { describe, expect, it } from 'vitest';
import { TYPE_NAMES, typeMultiplier } from '../src/index';
import type { TypeName } from '../src/index';
import { content } from './helpers';
import { loadLegacy } from './fixtures/legacyContent';

const chart = content.typeChart;
const RESULTS = [0, 0.25, 0.5, 1, 2, 4];

describe('§2.2 types and the chart', () => {
  it('TYPE_NAMES has the 19 types in dex order, Cosmic last', () => {
    expect(TYPE_NAMES.length).toBe(19);
    expect(TYPE_NAMES[0]).toBe('Normal');
    expect(TYPE_NAMES[18]).toBe('Cosmic');
    expect(new Set(TYPE_NAMES).size).toBe(19);
  });

  it('the legacy TYPE_CHART has exactly the 19 rows', () => {
    const rows = Object.keys(loadLegacy().TYPE_CHART).sort();
    expect(rows).toEqual([...TYPE_NAMES].sort());
    for (const row of rows) {
      for (const v of Object.values(loadLegacy().TYPE_CHART[row]!)) expect([0, 0.5, 2]).toContain(v);
    }
  });

  it('typeMultiplier returns only {0, 0.25, 0.5, 1, 2, 4} over all 19 × 19 × 19 combinations', () => {
    for (const atk of TYPE_NAMES) {
      for (const d1 of TYPE_NAMES) {
        expect(RESULTS).toContain(typeMultiplier(chart, atk, [d1]));
        for (const d2 of TYPE_NAMES) expect(RESULTS).toContain(typeMultiplier(chart, atk, [d1, d2]));
      }
    }
  });

  it('is the product over defender types (order-independent)', () => {
    for (const atk of TYPE_NAMES) {
      for (const d1 of TYPE_NAMES) {
        for (const d2 of TYPE_NAMES) {
          const a = typeMultiplier(chart, atk, [d1]);
          const b = typeMultiplier(chart, atk, [d2]);
          expect(typeMultiplier(chart, atk, [d1, d2])).toBe(a * b);
          expect(typeMultiplier(chart, atk, [d1, d2])).toBe(typeMultiplier(chart, atk, [d2, d1]));
        }
      }
    }
  });

  it('reproduces the legacy Cosmic rows', () => {
    expect(typeMultiplier(chart, 'Steel', ['Cosmic'])).toBe(2);
    expect(typeMultiplier(chart, 'Dark', ['Cosmic'])).toBe(2);
    expect(typeMultiplier(chart, 'Fairy', ['Cosmic'])).toBe(0.5);
    expect(typeMultiplier(chart, 'Cosmic', ['Psychic'])).toBe(2);
    expect(typeMultiplier(chart, 'Cosmic', ['Fairy'])).toBe(2);
    expect(typeMultiplier(chart, 'Cosmic', ['Dark'])).toBe(0.5);
    expect(typeMultiplier(chart, 'Cosmic', ['Steel'])).toBe(0.5);
    expect(typeMultiplier(chart, 'Cosmic', ['Cosmic'])).toBe(0.5);
  });

  it('immunities are exact zeros and missing entries are 1', () => {
    expect(typeMultiplier(chart, 'Normal', ['Ghost'])).toBe(0);
    expect(typeMultiplier(chart, 'Electric', ['Ground'])).toBe(0);
    expect(typeMultiplier(chart, 'Ground', ['Flying'])).toBe(0);
    expect(typeMultiplier(chart, 'Dragon', ['Fairy'])).toBe(0);
    expect(typeMultiplier(chart, 'Poison', ['Steel'])).toBe(0);
    expect(typeMultiplier(chart, 'Psychic', ['Dark'])).toBe(0);
    expect(typeMultiplier(chart, 'Ghost', ['Normal'])).toBe(0);
    expect(typeMultiplier(chart, 'Fighting', ['Ghost'])).toBe(0);
    expect(typeMultiplier(chart, 'Normal', ['Normal'])).toBe(1);
    expect(typeMultiplier(chart, 'Cosmic', ['Normal'])).toBe(1);
    // a zero on either defending type wins over a 2 on the other
    expect(typeMultiplier(chart, 'Electric', ['Water', 'Ground'])).toBe(0);
    expect(typeMultiplier(chart, 'Fire', ['Grass', 'Ice'])).toBe(4);
    expect(typeMultiplier(chart, 'Fire', ['Water', 'Rock'])).toBe(0.25);
  });

  it('the fixture species use only the 19 types', () => {
    for (const sp of content.allSpecies()) {
      for (const t of sp.types) expect(TYPE_NAMES).toContain(t as TypeName);
    }
  });
});
