/** Shrine (eclipse_shrine, celestial_spire) and rift (the_rift). */
import type { SurfaceRecipe } from '../recipe';
import { crystal, glass, masonry, metal, rock } from './families';

export const FILE = 'recipes/shrine.ts';

export const SHRINE_RECIPES: readonly SurfaceRecipe[] = [
  crystal({ id: 'void_glass', hero: true, metres: 1, strength: 0.45, rdo: 4, kind: 'shards', base: '#1b2a33', light: '#3f6a6a', dark: '#0c1418', rough: [0.06, 0.16], cells: 5 }),
  metal({ id: 'star_iron', hero: false, metres: 1, strength: 0.45, rdo: 4, base: '#3a3d4a', metal: 0.9, rough: [0.35, 0.6], hammered: 0.18,
    specks: { color: '#c8d4f0', amount: 0.25 } }),
  rock({ id: 'eclipse_stone', hero: true, metres: 3, strength: 0.65, rdo: 4, base: '#3c3a42', dark: '#222127', light: '#4c4a53',
    rough: [0.75, 0.9], cells: 5, crack: 0.45, freq: 4, speck: 0.3, speckColor: '#7a7890', tone: 0.12 }),
  glass({ id: 'ring_light', hero: false, metres: 1, strength: 0.3, rdo: 4, pattern: 'rings', base: '#8fbcc6', accent: '#b8dde6', rough: [0.15, 0.3] }),
];

export const RIFT_RECIPES: readonly SurfaceRecipe[] = [
  crystal({ id: 'rift_shard', hero: true, metres: 1, strength: 0.55, rdo: 4, kind: 'shards', base: '#4a2a6a', light: '#9a6ad0', dark: '#1e1030', rough: [0.15, 0.35], cells: 6 }),
  // the in-fiction origin of the flat look: faint facets, almost no detail
  rock({ id: 'unmade_stone', hero: true, metres: 3, strength: 0.35, base: '#6a6a6a', dark: '#5a5a5a', light: '#747474',
    rough: [0.88, 0.92], cells: 3, crack: 0.12, freq: 2, detail: 0.03, tone: 0.08 }),
  masonry({ id: 'void_floor', hero: true, metres: 3, strength: 0.5, base: '#1c1a24', mortar: '#34304a', rough: [0.6, 0.8],
    layout: { kind: 'courses', rows: 4, cols: 4, offset: 0 }, mortarPx: 3, bevelPx: 8, face: 0.12, tone: 0.1,
    speck: { color: '#6a5a9a', amount: 0.25 } }),
];
