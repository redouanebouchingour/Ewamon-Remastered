/**
 * Item sprites: every item content knows has its file under `public/`, so the bag and shop never fall back on a
 * missing image. The orbs keep their own art, a TM or HM shows the disc tinted in its move's type, every other item
 * has one sprite named by its id's slug.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONSUMABLES, EVOLUTION_STONES, ITEMS, KEY_ITEMS, ORBS, RELICS } from '@ewa/content';
import { itemSpriteUrl } from '../src/data/content';

const PUBLIC = join(__dirname, '..', 'public');
const ALL_IDS = [...ITEMS, ...KEY_ITEMS, ...RELICS, ...CONSUMABLES, ...EVOLUTION_STONES, ...ORBS].map((i) => i.id);

describe('item sprites', () => {
  it('every item has a sprite on disk', () => {
    expect(ALL_IDS.length).toBeGreaterThan(100);
    for (const id of ALL_IDS) {
      const url = itemSpriteUrl(id);
      expect(url, id).not.toBeNull();
      expect(existsSync(join(PUBLIC, url!)), `${id}: ${url!}`).toBe(true);
    }
  });

  it('orbs keep their own art, discs take the move type, the rest go by slug', () => {
    expect(itemSpriteUrl('spark_orb')).toBe('/items/orbs/spark_orb.webp');
    expect(itemSpriteUrl('tm:Thunderbolt')).toBe('/items/tm_electric.webp');
    expect(itemSpriteUrl('HM Surf')).toBe('/items/hm_water.webp');
    expect(itemSpriteUrl('Assault Vest')).toBe('/items/assault_vest.webp');
    expect(itemSpriteUrl('superpotion')).toBe('/items/superpotion.webp');
  });

  it('an id content does not know has no sprite', () => {
    expect(itemSpriteUrl('not_an_item')).toBeNull();
  });
});
