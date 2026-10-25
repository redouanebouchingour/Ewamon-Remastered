/**
 * The Original Master Relics in the client's item table: held items, so the creature screen's hold picker offers them
 * (ravatar's relic forms) and the bag shows their names.
 */
import { describe, expect, it } from 'vitest';
import { RELICS } from '@ewa/content';
import { HELD_ITEMS, itemInfo } from '../src/data/content';

describe('relics in the client item table', () => {
  it('every relic is a held item with its name, never sold', () => {
    expect(RELICS).toHaveLength(5);
    const held = new Set(HELD_ITEMS.map((i) => i.id));
    for (const r of RELICS) {
      expect(held.has(r.id), r.id).toBe(true);
      expect(itemInfo(r.id)).toMatchObject({ name: r.name, kind: 'held', price: null, sellPrice: 0 });
    }
  });
});
