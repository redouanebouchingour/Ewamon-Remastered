/** Cinder biome (cinderhold, ash_route): basalt, ash, scoria, lava, obsidian, charred timber, iron, brick. */
import type { SurfaceRecipe } from '../recipe';
import { glass, lava, masonry, metal, rock, soil, wood } from './families';

export const FILE = 'recipes/cinder.ts';

export const CINDER_RECIPES: readonly SurfaceRecipe[] = [
  // columnar basalt seen end-on: hexagon-ish cells with deep joints
  rock({ id: 'cinder_basalt', hero: true, metres: 3, strength: 0.75, rdo: 4, base: '#3a3633', dark: '#1e1c1b', light: '#4a4541',
    rough: [0.78, 0.92], cells: 7, crack: 0.7, crackWidth: 0.08, freq: 5, speck: 0.25, speckColor: '#5a5550', tone: 0.18 }),
  // M3 review fixes (R-cinderhold): patchy ash (the macro noise carries the value) with low wind-laid drifts and cinder
  // pebbles instead of one cracked-crust value, so the dark basalt road and the brick plaza separate from the ground. The
  // first cut's strong drifts (amp 0.3) drove the height-keyed albedo into zebra stripes.
  soil({ id: 'cinder_ash_soil', hero: true, metres: 3, strength: 0.5, rdo: 4, base: '#625b54', dark: '#3c3632', light: '#80796f',
    rough: [0.9, 0.98], ripple: { k: [3, 5], amp: 0.1 }, grain: 0.1, pebbles: 900, pebbleColor: '#2a2624', pebblePx: [3, 9], embers: { color: '#8a3a1e', amount: 0.3 },
    drift: { color: '#7d766c', amount: 0.55, cells: 3 } }),
  rock({ id: 'cinder_scoria', hero: true, metres: 3, strength: 0.85, rdo: 4, base: '#5a3a2e', dark: '#2e1d17', light: '#7a4e3a',
    rough: [0.85, 0.95], freq: 6, pits: 2600, pitPx: [3, 11], detail: 0.15, speck: 0.3, speckColor: '#8a5a44' }),
  lava({ id: 'lava_crust', hero: true, metres: 2, strength: 0.8, rdo: 4, kind: 'crust', crust: '#2a2220', hot: '#6e2412', rough: [0.8, 0.6], cells: 6 }),
  // M3 review fixes (R-cinderhold-3): the glow is the albedo (emissiveFromAlbedo), so the floating crust is near black and
  // only the molten flow between it glows (was '#3a2a24': the crust glowed brown and the pool read as one flat blob)
  lava({ id: 'lava_glow', hero: false, metres: 2, strength: 0.5, rdo: 4, kind: 'molten', crust: '#1c1513', hot: '#c24a18', rough: [0.8, 0.45], cells: 5 }),
  glass({ id: 'obsidian', hero: false, metres: 2, strength: 0.55, rdo: 4, pattern: 'obsidian', base: '#15131a', accent: '#2a2536', rough: [0.12, 0.3], cells: 5 }),
  wood({ id: 'charred_timber', hero: false, metres: 2, strength: 0.7, rdo: 4, kind: 'planks', base: '#3b2e24', rough: [0.82, 0.95], planks: 3, gapPx: 3, char: 0.8, knots: 3 }),
  metal({ id: 'iron_grate', hero: false, metres: 1, strength: 0.7, base: '#3b3836', metal: 0.9, rough: [0.45, 0.8],
    grate: { cols: 8, rows: 8, bar: 0.32 }, hammered: 0.1, rust: { color: '#5e3422', amount: 0.5 } }),
  masonry({ id: 'forge_brick', hero: false, metres: 2, strength: 0.75, rdo: 4, base: '#7a3b2a', mortar: '#8a8074', accent: '#4a241a', accentShare: 0.25,
    rough: [0.8, 0.9], layout: { kind: 'courses', rows: 12, cols: 5, offset: 0.5 }, mortarPx: 4, bevelPx: 5, face: 0.2, faceFreq: 16, tone: 0.12, chip: true }),
];
