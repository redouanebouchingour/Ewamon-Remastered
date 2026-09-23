/** Capital (solenne): sun marble, gilt bronze, stained glass, pale plaza stone, fountain, laurel hedge. */
import type { SurfaceRecipe } from '../recipe';
import { foliage, glass, masonry, metal, water } from './families';

export const FILE = 'recipes/capital.ts';

export const CAPITAL_RECIPES: readonly SurfaceRecipe[] = [
  masonry({ id: 'sun_marble', hero: true, metres: 2, strength: 0.4, rdo: 4, base: '#d8cdb9', mortar: '#b09f82', rough: [0.22, 0.55],
    layout: { kind: 'courses', rows: 4, cols: 2, offset: 0.5 }, mortarPx: 3, bevelPx: 6, face: 0.08, tone: 0.05,
    veins: { color: '#b08a4a', freq: 3, amount: 0.6 } }),
  metal({ id: 'gilt_bronze', hero: false, metres: 1, strength: 0.5, rdo: 4, base: '#a07c3c', metal: 1.0, rough: [0.25, 0.55], hammered: 0.2,
    patina: { color: '#3f5a44', amount: 0.3 }, panels: [2, 2], seamPx: 6 }),
  glass({ id: 'stained_glass', hero: false, metres: 1, strength: 0.35, rdo: 4, pattern: 'stained', base: '#7a5a9a', rough: [0.08, 0.5], frameMetal: 0.7, cells: 7,
    palette: ['#7a5a9a', '#9a3a3a', '#3a5a9a', '#b8923a', '#3a7a4a', '#5a3a7a'] }),
  masonry({ id: 'plaza_pale_stone', hero: true, metres: 3, strength: 0.6, rdo: 4, base: '#c2baa9', mortar: '#8e8778', rough: [0.65, 0.8],
    layout: { kind: 'courses', rows: 4, cols: 3, offset: 0.5, jitter: 0.2 }, mortarPx: 5, bevelPx: 10, face: 0.18, tone: 0.07, chip: true }),
  water({ id: 'fountain_water', hero: false, metres: 2, strength: 0.35, rdo: 4, base: '#3a6a78', rough: 0.05, waves: [[8, 3, 0.4], [-5, 9, 0.35], [2, -12, 0.25]], chop: 0.08 }),
  foliage({ id: 'laurel_leaf', hero: false, metres: 1, strength: 0.5, rdo: 4, kind: 'hedge', base: '#4d6b35', rough: 0.7, count: 900 }),
];
