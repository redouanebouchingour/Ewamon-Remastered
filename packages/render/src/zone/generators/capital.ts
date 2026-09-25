/**
 * §10.5.4 — the `capital` set (Solenne): sun-marble town houses with gilt-bronze doors and stained glass, laurel
 * cards, pale plaza stone, fountain water; set-piece `solenne_cathedral` (a nave with buttresses, a rose window and
 * a lathed spire; its lit portal window is the light).
 */
import { Matrix4, Path, Shape } from 'three/webgpu';
import type { BuildingSpec } from '../../contracts.js';
import { beam, box, extrude, lathe, trs } from '../geo.js';
import { buildHouse, type BuildingStyle } from './buildings.js';
import { addPropTier, disposeProp, finish, spLights, tiers3 } from './common.js';
import { TREE_SHAPES } from './nature.js';
import type { PropStyle } from './props.js';
import type { BiomeSet, SetPieceContext } from './set.js';
import type { PropGeo } from '../types.js';

export const CAPITAL_BUILDING: BuildingStyle = {
  wall: 'sun_marble', upperWall: 'sun_marble', frame: null, plinth: 'plaza_pale_stone', door: 'gilt_bronze', glass: 'mist_glass', litGlass: 'stained_glass',
  sill: 'plaza_pale_stone', trim: 'gilt_bronze', chimney: 'sun_marble', metal: 'gilt_bronze', greenery: 'grove_leaf_canopy',
  roofs: { slate: 'slate_roof', thatch: 'slate_roof', tile: 'forge_brick', plate: 'gilt_bronze' },
  storey: 3.0, pitchDeg: 32, overhang: 0.3, stoneBand: 0,
};

export const CAPITAL_PROPS: PropStyle = {
  wood: 'timber', metal: 'gilt_bronze', stone: 'plaza_pale_stone', housingGlass: 'glass_warm', glow: 'glass_warm', crystal: 'glass_warm', candle: 'glass_warm',
  cloth: 'banner_cloth', soil: 'dirt', leaf: 'grove_leaf_canopy', rock: 'plaza_pale_stone', water: 'fountain_water',
};

/** `solenne_cathedral`: a tall nave (house generator, landmark), buttresses, a rose window, a lathed spire; the lit portal is the light. */
function cathedral(ctx: SetPieceContext): PropGeo {
  const t = tiers3();
  const spec: BuildingSpec = { id: 'cathedral', kind: 'landmark', x: 0, z: -1.2, yaw: 0, w: 10, d: 13, floors: 2, roof: 'slate', seed: ctx.seed };
  const nave = buildHouse(ctx.set.building, spec, { drop: 0.4, accent: null });
  t.forEach((parts, k) => addPropTier(parts, nave, k as 0 | 1 | 2, trs(0, 0, -1.2)));
  disposeProp(nave);
  for (const s of [-1, 1]) {
    for (let z = -6; z <= 4; z += 3.3) {
      for (const parts of [t[0], t[1]]) beam(parts, 'plaza_pale_stone', [s * 6.6, -0.2, z], [s * 5.1, 6.4, z], 0.7, 0.9, 0.06, [s, 0, 0]);
    }
  }
  // the spire behind the gable
  for (const [k, parts] of t.entries()) lathe(parts, 'sun_marble', [[1.4, 9.0], [1.3, 12.5], [1.5, 12.8], [0.2, 19.5], [0.001, 20]], { segments: k === 0 ? 8 : 4, smooth: false, phase: Math.PI / 8 }, trs(0, 0, -6.5));
  lathe(t[0], 'gilt_bronze', [[0.12, 20], [0.05, 21], [0.001, 21.1]], { segments: 6, smooth: false }, trs(0, 0, -6.5));
  // rose window on the front gable
  const ring = new Shape(); ring.absarc(0, 0, 1.3, 0, Math.PI * 2, false);
  const hole = new Path(); hole.absarc(0, 0, 1.05, 0, Math.PI * 2, true); ring.holes.push(hole);
  extrude(t[0], 'plaza_pale_stone', ring, 0.18, 0.03, trs(0, 8.7, 5.35), { curveSegments: 24 });
  lathe(t[0], 'stained_glass', [[1.06, 0], [0.001, 0.02]], { segments: 20, smooth: false }, trs(0, 8.7, 5.34).multiply(new Matrix4().makeRotationX(Math.PI / 2)));
  const l = spLights('solenne_cathedral')[0]!;
  for (const parts of t) box(parts, 'stained_glass', l.x, l.y - 0.9, 5.36, 1.4, 1.8, 0.06, 0, 0.02);
  return finish(t, ['sun_marble', 'plaza_pale_stone', 'slate_roof', 'gilt_bronze', 'stained_glass', 'mist_glass']);
}

export const CAPITAL_SET: BiomeSet = {
  biome: 'capital',
  building: CAPITAL_BUILDING,
  props: CAPITAL_PROPS,
  trees: [
    { kind: 'tree_oak', shape: { ...TREE_SHAPES.oak, height: 0.8 }, bark: 'grove_bark', leaf: 'grove_leaf_canopy', weight: 0.7 },
    { kind: 'tree_birch', shape: TREE_SHAPES.birch, bark: 'grove_bark', leaf: 'grove_leaf_canopy', weight: 0.3 },
  ],
  rock: 'plaza_pale_stone',
  tallGrass: 'tall_grass',
  tuft: 'tall_grass',
  bushLeaf: 'grove_leaf_canopy',
  flower: 'plaster',
  density: { treeMargin: 0.024, treeInterior: 0.02, rock: 0.003, bush: 0.024, flower: 0.018, tuft: 0.18, tallGrass: 2.2 },
  boundary: 'wall',
  accent: 'stained_glass',
  setPieces: { solenne_cathedral: cathedral },
};
