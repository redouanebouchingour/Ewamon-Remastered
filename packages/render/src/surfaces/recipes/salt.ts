/** Salt biome (saltmourn, tide_route): sand, shore rock, barnacles, driftwood, rope, sails, planks, sea. */
import type { SurfaceRecipe } from '../recipe';
import { cloth, rock, soil, water, wood } from './families';

export const FILE = 'recipes/salt.ts';

export const SALT_RECIPES: readonly SurfaceRecipe[] = [
  soil({ id: 'salt_sand', hero: true, metres: 3, strength: 0.45, rdo: 4, base: '#cbbd9e', dark: '#a8997a', light: '#d6c9ab',
    rough: [0.88, 0.95], ripple: { k: [9, 3], amp: 0.28 }, grain: 0.08, pebbles: 260, pebbleColor: '#9a8f80', pebblePx: [3, 7], sparkle: 0.2 }),
  rock({ id: 'wet_rock', hero: true, metres: 3, strength: 0.7, rdo: 4, base: '#4d4a47', dark: '#2a2826', light: '#5e5a55',
    rough: [0.3, 0.45], cells: 5, crack: 0.45, freq: 4, detail: 0.1, tone: 0.1, streaks: { color: '#3a4a34', amount: 0.5 } }),
  rock({ id: 'barnacle_stone', hero: true, metres: 3, strength: 0.8, rdo: 4, base: '#6d6a62', dark: '#403d38', light: '#7d7970',
    rough: [0.8, 0.92], cells: 4, crack: 0.35, freq: 5, barnacles: 900, speck: 0.2 }),
  wood({ id: 'driftwood', hero: false, metres: 2, strength: 0.6, rdo: 4, kind: 'log', base: '#9a8f80', rough: [0.78, 0.9], grainContrast: 0.4,
    weather: { color: '#a8a39a', amount: 0.35 } }),
  cloth({ id: 'rope', hero: false, metres: 1, strength: 0.8, rdo: 4, kind: 'rope', base: '#8a7450', rough: 0.9, strands: 8 }),
  cloth({ id: 'sailcloth', hero: false, metres: 1, strength: 0.35, rdo: 4, kind: 'weave', base: '#d8cfbd', accent: '#bfb39b', rough: 0.85,
    weave: [72, 72], seams: 4, card: 'sail', wrap: 'clamp' }),
  wood({ id: 'harbour_plank', hero: false, metres: 2, strength: 0.6, rdo: 4, kind: 'planks', base: '#6a5440', rough: [0.7, 0.85], planks: 5, gapPx: 4, knots: 5,
    nails: true, weather: { color: '#7d7468', amount: 0.25 }, moss: { color: '#3a4a2c', amount: 0.3 } }),
  water({ id: 'sea_water', hero: false, metres: 4, strength: 0.45, rdo: 4, base: '#1f4a5a', rough: 0.04, waves: [[5, 1, 0.5], [-2, 7, 0.3], [9, -4, 0.2]], chop: 0.15 }),
  water({ id: 'tide_pool', hero: false, metres: 2, strength: 0.3, rdo: 4, base: '#2f5a5e', rough: 0.06, waves: [[6, 2, 0.5], [-3, 8, 0.5]], chop: 0.05,
    scum: { color: '#4a5a3a', amount: 0.35 } }),
];
