/** Storm biome (stormrook, galvan_route): slate, copper, brass coils, insulators, fulgurite glass, towers. */
import type { SurfaceRecipe } from '../recipe';
import { glass, masonry, metal, rock } from './families';

export const FILE = 'recipes/storm.ts';

export const STORM_RECIPES: readonly SurfaceRecipe[] = [
  // strong planar cleavage: thin strata, no facet cells (M3 review fixes, M3-stormrook-1 / R-galvan-1: the faceted slate read
  // as the same paving as the flagstone road); moss and heath lichen in the low strata make it ground, not a pavement
  rock({ id: 'storm_slate', hero: true, metres: 3, strength: 0.75, rdo: 4, base: '#4d535a', dark: '#262a2f', light: '#636a72',
    rough: [0.5, 0.7], strata: 11, strataAmp: 0.35, freq: 3, tone: 0.1, speck: 0.15, speckColor: '#7a8088',
    lichen: { color: '#55663f', amount: 0.75 } }),
  metal({ id: 'copper_oxide', hero: true, metres: 2, strength: 0.55, rdo: 4, base: '#9a6a48', metal: 0.9, rough: [0.3, 0.6],
    panels: [3, 4], seamPx: 5, rivets: { perEdge: 5, rPx: 7 }, hammered: 0.15, patina: { color: '#4f8f7a', amount: 1.0 } }),
  metal({ id: 'coil_brass', hero: false, metres: 1, strength: 0.7, base: '#b08d4a', metal: 1.0, rough: [0.25, 0.5], windings: 48,
    brushed: { dir: 'u', amount: 0.1 } }),
  glass({ id: 'insulator_glass', hero: false, metres: 1, strength: 0.6, pattern: 'ribbed', base: '#6fa7a0', accent: '#8fc4bc', rough: [0.06, 0.2] }),
  glass({ id: 'lightning_glass', hero: false, metres: 1, strength: 0.45, rdo: 4, pattern: 'fulgurite', base: '#7fa8cc', accent: '#c2dcf2', rough: [0.1, 0.3] }),
  masonry({ id: 'tower_stone', hero: false, metres: 2, strength: 0.8, rdo: 4, base: '#6b6862', mortar: '#4a4844', rough: [0.72, 0.85],
    layout: { kind: 'ashlar', rows: 6, min: 2, max: 4, rowJitter: 0.2, jointJitter: 0.4 }, mortarPx: 5, bevelPx: 14, face: 0.3, tone: 0.1, chip: true,
    moss: { color: '#3e4a36', amount: 0.4 } }),
  masonry({ id: 'wet_flagstone', hero: true, metres: 3, strength: 0.7, rdo: 4, base: '#545450', mortar: '#34332f', rough: [0.4, 0.6],
    layout: { kind: 'polygon', cells: 5 }, mortarPx: 8, bevelPx: 14, face: 0.2, tone: 0.14, moss: { color: '#394232', amount: 0.5 } }),
];
