/**
 * §10.5.4 — the `vesper` set (Vesperveil, Hollow Route, Umbral Observatory): lichened stone houses with black-bark
 * framing and wrought-iron trim, misted windows, candle stands, grave moss, black willows; set-pieces
 * `vesper_witch_hut` (a crooked hut on stilts with a cauldron and a candle stand), `hollow_lantern_road` (three
 * iron lantern arches over the road) and `umbral_dome` (a drum-and-dome observatory with a lens crystal).
 */
import { Matrix4 } from 'three/webgpu';
import type { BuildingSpec } from '../../contracts.js';
import { beam, box, lathe, trs } from '../geo.js';
import { buildHouse, type BuildingStyle } from './buildings.js';
import { addPropTier, disposeProp, finish, lanternAt, spLights, tiers3, tower } from './common.js';
import { TREE_SHAPES } from './nature.js';
import { buildCandle, type PropStyle } from './props.js';
import type { BiomeSet, SetPieceContext } from './set.js';
import type { PropGeo } from '../types.js';

const TAU = Math.PI * 2;

export const VESPER_BUILDING: BuildingStyle = {
  wall: 'lichen_stone', upperWall: 'plaster', frame: 'vesper_bark_black', plinth: 'lichen_stone', door: 'vesper_bark_black', glass: 'mist_glass', litGlass: 'candle_wax',
  sill: 'lichen_stone', trim: 'wrought_iron', chimney: 'lichen_stone', metal: 'wrought_iron', greenery: null,
  roofs: { slate: 'slate_roof', thatch: 'thatch', tile: 'slate_roof', plate: 'wrought_iron' },
  storey: 2.7, pitchDeg: 48, overhang: 0.35, stoneBand: 0,
};

export const VESPER_PROPS: PropStyle = {
  wood: 'vesper_bark_black', metal: 'wrought_iron', stone: 'lichen_stone', housingGlass: 'candle_wax', glow: 'candle_wax', crystal: 'mist_glass', candle: 'candle_wax',
  cloth: 'thatch', soil: 'grave_moss', leaf: 'willow_leaf', rock: 'lichen_stone', water: 'bog_water',
};

/** `vesper_witch_hut`: a small steep-roofed hut raised on crooked stilts, a lathed cauldron, a candle stand (the light). */
function witchHut(ctx: SetPieceContext): PropGeo {
  const t = tiers3();
  const spec: BuildingSpec = { id: 'witch', kind: 'house', x: 0, z: 0, yaw: 0.25, w: 5.2, d: 4.4, floors: 1, roof: 'thatch', seed: ctx.seed };
  const hut = buildHouse(ctx.set.building, spec, { drop: 0 });
  const lift = trs(0, 1.3, -0.6, 0.18);
  t.forEach((parts, k) => addPropTier(parts, hut, k as 0 | 1 | 2, lift));
  disposeProp(hut);
  for (const [x, z] of [[-2.3, -2.6], [2.3, -2.6], [-2.3, 1.4], [2.3, 1.4]] as const) {
    for (const parts of [t[0], t[1]]) beam(parts, 'vesper_bark_black', [x * 1.05, ctx.ground(x, z) - 0.3, z], [x, 1.35, z], 0.22, 0.22, 0.04);
  }
  lathe(t[0], 'wrought_iron', [[0.001, 0.12], [0.5, 0.2], [0.62, 0.55], [0.58, 0.8], [0.52, 0.8], [0.001, 0.72]], { segments: 14, smooth: true }, trs(-1.2, ctx.ground(-1.2, 3.2), 3.2));
  const l = spLights('vesper_witch_hut')[0]!;
  const c = buildCandle(ctx.set.props, 1);
  t.forEach((parts, k) => addPropTier(parts, c, k as 0 | 1 | 2, new Matrix4().makeTranslation(l.x, l.y - 1.28, l.z)));
  disposeProp(c);
  return finish(t, ['lichen_stone', 'plaster', 'vesper_bark_black', 'thatch', 'wrought_iron', 'candle_wax', 'mist_glass']);
}

/** `hollow_lantern_road`: three wrought-iron arches over the road, each with a lantern post beside it (the lights). */
function lanternRoad(ctx: SetPieceContext): PropGeo {
  const t = tiers3();
  for (const l of spLights('hollow_lantern_road')) {
    const x = l.x;
    for (const parts of [t[0], t[1]]) {
      for (const s of [-1, 1]) beam(parts, 'wrought_iron', [x, ctx.ground(x, s * 2.6) - 0.2, s * 2.6], [x, 3.6, s * 2.6], 0.1, 0.1, 0.02);
    }
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI; const a1 = ((i + 1) / 12) * Math.PI;
      beam(t[0], 'wrought_iron', [x, 3.6 + Math.sin(a0) * 1.0, -Math.cos(a0) * 2.6], [x, 3.6 + Math.sin(a1) * 1.0, -Math.cos(a1) * 2.6], 0.08, 0.08, 0.015, [1, 0, 0]);
    }
    lanternAt(t, ctx.set, l.x, l.y, l.z, ctx.ground(l.x, l.z), ctx.seed + Math.round(x));
  }
  return finish(t, ['wrought_iron', 'candle_wax', 'lichen_stone']);
}

/** `umbral_dome`: a round drum with a slit dome and a telescope, and the lens crystal on a plinth before the door. */
function umbralDome(ctx: SetPieceContext): PropGeo {
  const t = tiers3();
  for (const [k, parts] of t.entries()) {
    const seg = k === 0 ? 28 : 14;
    tower(parts, 'lichen_stone', 'lichen_stone', 5.6, 4.6, seg);
    lathe(parts, 'wrought_iron', Array.from({ length: 9 }, (_, i) => [Math.cos((i / 8) * Math.PI / 2) * 5.3 + 0.001, 5.2 + Math.sin((i / 8) * Math.PI / 2) * 4.4] as [number, number]), { segments: seg, smooth: true });
  }
  beam(t[0], 'wrought_iron', [0, 7, 0], [3.2, 11.2, 2.2], 0.9, 0.9, 0.1);
  box(t[0], 'vesper_bark_black', 0, 0.7, 5.62, 1.6, 2.6, 0.2, 0, 0.03);
  const l = spLights('umbral_dome')[0]!;
  for (const parts of t) {
    box(parts, 'lichen_stone', l.x, ctx.ground(l.x, l.z) - 0.2, l.z, 1.0, l.y - 0.6 - ctx.ground(l.x, l.z) + 0.2, 1.0, 0, 0.05);
    lathe(parts, 'mist_glass', [[0.001, l.y - 0.6], [0.35, l.y - 0.2], [0.3, l.y + 0.3], [0.001, l.y + 0.6]], { segments: 6, smooth: false });
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    beam(t[0], 'wrought_iron', [l.x + Math.cos(a) * 0.4, l.y - 0.6, l.z + Math.sin(a) * 0.4], [l.x + Math.cos(a) * 0.1, l.y + 0.7, l.z + Math.sin(a) * 0.1], 0.04, 0.04, 0.01);
  }
  return finish(t, ['lichen_stone', 'wrought_iron', 'vesper_bark_black', 'mist_glass']);
}

export const VESPER_SET: BiomeSet = {
  biome: 'vesper',
  building: VESPER_BUILDING,
  props: VESPER_PROPS,
  trees: [
    { kind: 'tree_willow', shape: TREE_SHAPES.willow, bark: 'vesper_bark_black', leaf: 'willow_leaf', weight: 0.6, nearWater: true },
    { kind: 'tree_dead', shape: TREE_SHAPES.dead, bark: 'vesper_bark_black', leaf: 'willow_leaf', weight: 0.4 },
  ],
  rock: 'lichen_stone',
  tallGrass: 'tall_grass',
  tuft: 'tall_grass',
  bushLeaf: 'willow_leaf',
  flower: null,
  density: { treeMargin: 0.026, treeInterior: 0.03, rock: 0.008, bush: 0.012, flower: 0, tuft: 0.18, tallGrass: 2.2 },
  boundary: 'fence',
  accent: 'candle_wax',
  setPieces: { vesper_witch_hut: witchHut, hollow_lantern_road: lanternRoad, umbral_dome: umbralDome },
};
