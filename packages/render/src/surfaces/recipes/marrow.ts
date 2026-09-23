/** Marrow biome (marrowdig, deepcut_route): sandstone strata, chalk, ore veins, mine timber, rails, dust, gypsum. */
import type { SurfaceRecipe } from '../recipe';
import { crystal, metal, rock, soil, wood } from './families';

export const FILE = 'recipes/marrow.ts';

export const MARROW_RECIPES: readonly SurfaceRecipe[] = [
  rock({ id: 'marrow_sandstone', hero: true, metres: 3, strength: 0.7, rdo: 4, base: '#b07a52', dark: '#7a5236', light: '#c48d62',
    rough: [0.8, 0.92], strata: 9, strataAmp: 0.6, cells: 3, cellAspect: 3, crack: 0.15, crackWidth: 0.04, freq: 3, detail: 0.15, speck: 0.15, speckColor: '#d19f74' }),
  rock({ id: 'bone_chalk', hero: true, metres: 3, strength: 0.5, rdo: 4, base: '#d6ccb8', dark: '#b3a893', light: '#ddd4c2',
    rough: [0.85, 0.95], freq: 4, cells: 4, crack: 0.12, crackWidth: 0.035, pits: 900, pitPx: [2, 6], speck: 0.25, speckColor: '#8f8472', tone: 0.06 }),
  crystal({ id: 'ore_vein', hero: false, metres: 2, strength: 0.6, rdo: 4, kind: 'ore', base: '#5a4a3a', light: '#d8a848', dark: '#2e2620', rough: [0.35, 0.8], cells: 4 }),
  wood({ id: 'mine_timber', hero: false, metres: 2, strength: 0.65, rdo: 4, kind: 'planks', base: '#5e4630', rough: [0.75, 0.9], planks: 2, gapPx: 6, knots: 4,
    nails: true, weather: { color: '#4a4036', amount: 0.2 } }),
  metal({ id: 'rail_iron', hero: false, metres: 1, strength: 0.5, rdo: 4, base: '#4a4541', metal: 0.9, rough: [0.35, 0.85],
    brushed: { dir: 'u', amount: 0.25 }, hammered: 0.08, rust: { color: '#6a3a22', amount: 0.7 } }),
  soil({ id: 'canyon_dust', hero: true, metres: 3, strength: 0.45, rdo: 4, base: '#b58b62', dark: '#8e6a48', light: '#c49a70',
    rough: [0.9, 0.98], ripple: { k: [4, 7], amp: 0.15 }, grain: 0.1, pebbles: 500, pebbleColor: '#8a6446', pebblePx: [3, 9], crust: 6 }),
  crystal({ id: 'gypsum_crystal', hero: false, metres: 1, strength: 0.5, rdo: 4, kind: 'blades', base: '#d8d1c3', light: '#e6e0d4', dark: '#a89f90', rough: [0.15, 0.3], cells: 5 }),
];
