import { describe, expect, it } from 'vitest';
import { ZONES } from '@ewa/content';
import { ZONE_BIOME } from '../src/zones';

describe('ZONE_BIOME', () => {
  it('mirrors @ewa/content ZONES[].biome', () => {
    const fromContent = Object.fromEntries(Object.values(ZONES).map((z) => [z.id, z.biome]));
    expect(ZONE_BIOME).toEqual(fromContent);
  });
});
