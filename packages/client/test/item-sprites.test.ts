/**
 * Item sprites: every item `itemSpriteUrl` names has its file under `public/`, so the bag and shop never fall back
 * on a missing image. Today that is the ten orbs, ported from the old game.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ORBS } from '@ewa/content';
import { itemInfo, itemSpriteUrl } from '../src/data/content';

const PUBLIC = join(__dirname, '..', 'public');

describe('item sprites', () => {
  it('every orb has a sprite on disk', () => {
    for (const o of ORBS) {
      const url = itemSpriteUrl(o.id);
      expect(url, o.id).not.toBeNull();
      expect(existsSync(join(PUBLIC, url!)), url!).toBe(true);
    }
  });

  it('items without art have no sprite url', () => {
    for (const id of ['potion', 'Charcoal', 'HM Surf', 'ember_stone']) {
      expect(itemInfo(id).id).toBe(id);
      expect(itemSpriteUrl(id)).toBeNull();
    }
  });
});
