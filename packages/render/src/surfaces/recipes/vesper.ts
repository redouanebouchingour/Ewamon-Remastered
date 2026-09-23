/** Vesper biome (vesperveil, hollow_route, umbral_observatory): black bark, grave moss, iron, wax, mist glass, willows, bog. */
import type { SurfaceRecipe } from '../recipe';
import { foliage, glass, metal, rock, water, wood } from './families';

export const FILE = 'recipes/vesper.ts';

export const VESPER_RECIPES: readonly SurfaceRecipe[] = [
  wood({ id: 'vesper_bark_black', hero: true, metres: 2, strength: 0.8, rdo: 4, kind: 'bark', base: '#2a2626', dark: '#0f0d0d', rough: [0.8, 0.92], furrows: 11,
    moss: { color: '#2e3a2a', amount: 0.35 } }),
  rock({ id: 'grave_moss', hero: true, metres: 3, strength: 0.5, rdo: 4, base: '#3f5234', dark: '#252f1f', light: '#56673f',
    rough: [0.86, 0.95], freq: 6, pits: 0, detail: 0.3, speck: 0.35, speckColor: '#5a4a32', tone: 0.05 }),
  metal({ id: 'wrought_iron', hero: false, metres: 1, strength: 0.6, rdo: 4, base: '#2d2b2b', metal: 0.85, rough: [0.5, 0.8], hammered: 0.35,
    brushed: { dir: 'v', amount: 0.12 }, rust: { color: '#4a2c1e', amount: 0.4 } }),
  glass({ id: 'candle_wax', hero: false, metres: 1, strength: 0.45, pattern: 'wax', base: '#d9ccb0', accent: '#e8dcc0', rough: [0.45, 0.6] }),
  glass({ id: 'mist_glass', hero: false, metres: 1, strength: 0.3, pattern: 'mist', base: '#9fb0b8', accent: '#b8c6cc', rough: [0.12, 0.5], frameMetal: 0.8 }),
  foliage({ id: 'willow_leaf', hero: false, metres: 1, strength: 0.4, rdo: 4, kind: 'willow', base: '#56703f', rough: 0.65, count: 26 }),
  water({ id: 'bog_water', hero: false, metres: 3, strength: 0.25, base: '#2c3326', rough: 0.08, waves: [[4, 1, 0.5], [-1, 5, 0.5]], chop: 0.08,
    scum: { color: '#4a5a2a', amount: 0.7 } }),
  rock({ id: 'lichen_stone', hero: true, metres: 3, strength: 0.7, rdo: 4, base: '#6e7166', dark: '#44463f', light: '#7e8176',
    rough: [0.8, 0.92], cells: 4, crack: 0.4, freq: 4, speck: 0.2, lichen: { color: '#9aa56a', amount: 0.45 } }),
];
