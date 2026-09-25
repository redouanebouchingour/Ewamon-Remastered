/**
 * §10.5.4 — the `forge` set (Forgewall, Siege Route): granite houses with steel-plate roofs and riveted doors,
 * braziers, granite outcrops, stunted pines; set-pieces `forge_great_gate` (two drum towers and a gatehouse arch
 * with a portcullis, fire bowls on the towers) and `siege_trebuchet` (a timber trebuchet with its throwing arm and
 * counterweight beside a watch fire).
 */
import { Matrix4 } from 'three/webgpu';
import { beam, box, lathe, trs, type Parts } from '../geo.js';
import type { BuildingStyle } from './buildings.js';
import { addPropTier, archway, blockRing, disposeProp, finish, spLights, tiers3, tower } from './common.js';
import { TREE_SHAPES } from './nature.js';
import { buildBrazier, type PropStyle } from './props.js';
import type { BiomeSet, SetPieceContext } from './set.js';
import type { PropGeo } from '../types.js';

export const FORGE_BUILDING: BuildingStyle = {
  wall: 'castle_granite', upperWall: 'castle_granite', frame: null, plinth: 'castle_granite', door: 'forge_steel_plate', glass: 'iron_grate', litGlass: 'glass_warm',
  sill: 'castle_granite', trim: 'rivet_iron', chimney: 'castle_granite', metal: 'rivet_iron', greenery: null,
  roofs: { slate: 'slate_roof', thatch: 'charred_timber', tile: 'forge_brick', plate: 'forge_steel_plate' },
  storey: 2.9, pitchDeg: 32, overhang: 0.25, stoneBand: 0,
};

export const FORGE_PROPS: PropStyle = {
  wood: 'charred_timber', metal: 'rivet_iron', stone: 'castle_granite', housingGlass: 'glass_warm', glow: 'coal_glow', crystal: 'coal_glow', candle: 'glass_warm',
  cloth: 'banner_cloth', soil: 'cinder_ash_soil', leaf: 'pine_needle', rock: 'castle_granite', water: 'water_pond',
};

function fireBowl(t: readonly Parts[], set: BiomeSet, x: number, y: number, z: number): void {
  const g = buildBrazier(set.props, 1);
  t.forEach((parts, k) => addPropTier(parts, g, k as 0 | 1 | 2, new Matrix4().makeTranslation(x, y - 1.02, z)));
  disposeProp(g);
}

/** `forge_great_gate`: two round towers flanking a gatehouse arch across the road, a portcullis, fire bowls (the lights). */
function greatGate(ctx: SetPieceContext): PropGeo {
  const t = tiers3();
  const lights = spLights('forge_great_gate');
  for (const [k, parts] of t.entries()) {
    for (const s of [-1, 1]) tower(parts, 'castle_granite', 'castle_granite', 2.4, 6.2, k === 0 ? 20 : 10, trs(s * 6.4, ctx.ground(s * 6.4, 0) - 0.2, 0));
    if (k < 2) archway(parts, 'castle_granite', 5.2, 3.4, 3.2, 1.3, trs(0, 0, 0).multiply(new Matrix4().makeRotationY(Math.PI / 2)).multiply(new Matrix4().makeRotationY(-Math.PI / 2)));
    box(parts, 'castle_granite', 0, 5.4, 0, 10.2, 1.4, 3.4, 0, 0.06);
  }
  // crenellations and a portcullis
  for (let x = -4.6; x <= 4.6; x += 1.15) box(t[0], 'castle_granite', x, 6.8, 1.45, 0.6, 0.55, 0.45, 0, 0.04);
  for (let x = -2.2; x <= 2.2; x += 0.44) beam(t[0], 'rivet_iron', [x, 2.6, 0.2], [x, 5.1, 0.2], 0.07, 0.07, 0.01);
  for (let y = 2.8; y < 5; y += 0.5) beam(t[0], 'rivet_iron', [-2.3, y, 0.25], [2.3, y, 0.25], 0.06, 0.06, 0.01);
  blockRing(t[0], 'castle_granite', 2.7, 6.6, 12, 0.7, 0.55, 0.45, ctx.seed);
  for (const l of lights) fireBowl(t, ctx.set, l.x, l.y, l.z);
  return finish(t, ['castle_granite', 'rivet_iron', 'coal_glow']);
}

/** `siege_trebuchet`: a timber A-frame with its throwing arm cocked, a boxed counterweight, and a watch fire (the light). */
function trebuchet(ctx: SetPieceContext): PropGeo {
  const t = tiers3();
  const [L0, L1] = t;
  for (const parts of [L0, L1]) {
    for (const s of [-1, 1]) {
      beam(parts, 'charred_timber', [-3, 0.4, s * 1.4], [3, 0.4, s * 1.4], 0.32, 0.32, 0.05);
      beam(parts, 'charred_timber', [-2.4, 0.5, s * 1.4], [0, 5.2, s * 1.1], 0.26, 0.26, 0.04);
      beam(parts, 'charred_timber', [2.4, 0.5, s * 1.4], [0, 5.2, s * 1.1], 0.26, 0.26, 0.04);
    }
    beam(parts, 'rivet_iron', [0, 5.2, -1.3], [0, 5.2, 1.3], 0.18, 0.18, 0.03);
    beam(parts, 'charred_timber', [-2.2, 3.4, 0], [4.8, 7.4, 0], 0.3, 0.3, 0.05);
  }
  box(L0, 'charred_timber', -2.6, 1.4, 0, 1.6, 1.6, 1.6, 0, 0.05);
  box(L0, 'rivet_iron', -2.6, 1.3, 0, 1.7, 0.12, 1.7, 0, 0.02);
  for (let x = -2; x <= 2; x += 1) beam(L0, 'charred_timber', [x, 0.45, -1.4], [x, 0.45, 1.4], 0.18, 0.18, 0.03);
  lathe(L0, 'rivet_iron', [[0.001, -0.25], [0.26, -0.2], [0.3, 0], [0.26, 0.2], [0.001, 0.25]], { segments: 10, smooth: true }, trs(4.9, 7.1, 0));
  for (const l of spLights('siege_trebuchet')) {
    for (const parts of t) lathe(parts, 'castle_granite', [[0.6, -0.1], [0.62, 0.25], [0.4, 0.3], [0.001, 0.31]], { segments: 10, smooth: false }, trs(l.x, ctx.ground(l.x, l.z), l.z));
    for (const parts of t) lathe(parts, 'coal_glow', [[0.001, l.y - 0.45], [0.36, l.y - 0.62], [0.18, l.y - 0.38], [0.001, l.y - 0.3]], { segments: 8, smooth: false });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      beam(L0, 'charred_timber', [l.x + Math.cos(a) * 0.5, ctx.ground(l.x, l.z) + 0.25, l.z + Math.sin(a) * 0.5], [l.x + Math.cos(a) * 0.1, l.y - 0.4, l.z + Math.sin(a) * 0.1], 0.1, 0.1, 0.02);
    }
  }
  return finish(t, ['charred_timber', 'rivet_iron', 'castle_granite', 'coal_glow']);
}

export const FORGE_SET: BiomeSet = {
  biome: 'forge',
  building: FORGE_BUILDING,
  props: FORGE_PROPS,
  trees: [{ kind: 'tree_pine', shape: { ...TREE_SHAPES.pine, height: 1.0 }, bark: 'grove_bark', leaf: 'pine_needle', weight: 1 }],
  rock: 'castle_granite',
  tallGrass: 'tall_grass',
  tuft: 'tall_grass',
  bushLeaf: null,
  flower: null,
  density: { treeMargin: 0.018, treeInterior: 0.015, rock: 0.012, bush: 0, flower: 0, tuft: 0.14, tallGrass: 2.2 },
  boundary: 'wall',
  accent: 'coal_glow',
  setPieces: { forge_great_gate: greatGate, siege_trebuchet: trebuchet },
};
