/** Sky biome (skyrend, ascent_route): marble, cloud stone, gold leaf, prayer silk, scale tiles, frost glass, pines, snow. */
import type { SurfaceRecipe } from '../recipe';
import { cloth, foliage, glass, masonry, metal, rock, scales, soil } from './families';

export const FILE = 'recipes/sky.ts';

export const SKY_RECIPES: readonly SurfaceRecipe[] = [
  masonry({ id: 'sky_marble', hero: true, metres: 2, strength: 0.4, base: '#d0cdc7', mortar: '#a9a59e', rough: [0.28, 0.6],
    layout: { kind: 'courses', rows: 3, cols: 2, offset: 0.5 }, mortarPx: 3, bevelPx: 6, face: 0.08, tone: 0.05,
    veins: { color: '#8e8a84', freq: 3, amount: 0.7 } }),
  rock({ id: 'cloud_stone', hero: true, metres: 3, strength: 0.55, rdo: 4, base: '#bfc3c8', dark: '#969aa0', light: '#c9cdd2',
    rough: [0.75, 0.9], freq: 3, pits: 1600, pitPx: [4, 14], cells: 3, crack: 0.08, crackWidth: 0.03, tone: 0.05 }),
  metal({ id: 'gold_leaf', hero: false, metres: 1, strength: 0.3, rdo: 4, base: '#c9a24a', metal: 1.0, rough: [0.2, 0.4], leafSquares: 6, hammered: 0.08, tone: 0.05 }),
  cloth({ id: 'prayer_silk', hero: false, metres: 1, strength: 0.3, rdo: 4, kind: 'weave', base: '#c23b3b', rough: 0.7, weave: [80, 80], card: 'flags', wrap: 'clamp' }),
  scales({ id: 'dragon_scale_tile', hero: false, metres: 1, strength: 0.7, rdo: 4, base: '#3b6a6e', edge: '#23403f', rough: [0.35, 0.6], rows: 10, cols: 8 }),
  glass({ id: 'frost_glass', hero: false, metres: 1, strength: 0.35, rdo: 4, pattern: 'frost', base: '#c3d6e0', accent: '#dbe8ef', rough: [0.08, 0.2], cells: 5 }),
  foliage({ id: 'pine_needle', hero: false, metres: 1, strength: 0.45, rdo: 4, kind: 'pine', base: '#3d5a36', rough: 0.7, count: 11 }),
  soil({ id: 'snow', hero: true, metres: 3, strength: 0.35, rdo: 4, base: '#d6dae0', dark: '#b8c0ca', light: '#dde1e7',
    rough: [0.5, 0.7], ripple: { k: [3, 5], amp: 0.2 }, grain: 0.05, sparkle: 0.35 }),
];
