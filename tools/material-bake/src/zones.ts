/**
 * Zone id → biome, for `bake --zone <id>`. Mirrors `@ewa/content` ZONES[].biome (21 zones); the tool keeps its
 * own copy so it depends on nothing but `@ewa/render/surfaces`, and `test/zones.test.ts` asserts the copy
 * equals the content table.
 */
import type { Biome } from '@ewa/render/surfaces';

export const ZONE_BIOME: Readonly<Record<string, Biome>> = {
  mirevale: 'grove',
  mire_route: 'grove',
  cinderhold: 'cinder',
  ash_route: 'cinder',
  saltmourn: 'salt',
  tide_route: 'salt',
  stormrook: 'storm',
  galvan_route: 'storm',
  marrowdig: 'marrow',
  deepcut_route: 'marrow',
  vesperveil: 'vesper',
  hollow_route: 'vesper',
  forgewall: 'forge',
  siege_route: 'forge',
  skyrend: 'sky',
  ascent_route: 'sky',
  solenne: 'capital',
  eclipse_shrine: 'shrine',
  umbral_observatory: 'vesper',
  celestial_spire: 'shrine',
  the_rift: 'rift',
};
