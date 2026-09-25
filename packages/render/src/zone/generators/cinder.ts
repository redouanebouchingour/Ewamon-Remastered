/**
 * §10.5.4 — the `cinder` set (Cinderhold, Ash Route): brick-and-basalt houses with charred-timber lintels, iron
 * grates, braziers, scoria boulders, dead ash trees; set-pieces `cinder_caldera` (a basalt crater rim around a
 * glowing lava pool) and `ash_lava_bridge` (a stone arch over a lava channel between two fire bowls).
 */
import { Matrix4 } from 'three/webgpu';
import { box, card, lathe, trs } from '../geo.js';
import { createPrng } from '../prng.js';
import type { BuildingStyle } from './buildings.js';
import { addPropTier, archway, blockRing, disposeProp, finish, spLights, tiers3 } from './common.js';
import { TREE_SHAPES, buildRock, rootArm } from './nature.js';
import { buildBrazier, type PropStyle } from './props.js';
import type { BiomeSet, SetPieceContext } from './set.js';
import type { PropGeo } from '../types.js';

const TAU = Math.PI * 2;

export const CINDER_BUILDING: BuildingStyle = {
  wall: 'forge_brick', upperWall: 'forge_brick', frame: null, plinth: 'cinder_basalt', door: 'charred_timber', glass: 'iron_grate', litGlass: 'glass_warm',
  sill: 'cinder_basalt', trim: 'charred_timber', chimney: 'forge_brick', metal: 'iron_grate', greenery: null,
  roofs: { slate: 'slate_roof', thatch: 'charred_timber', tile: 'forge_brick', plate: 'iron_grate' },
  storey: 2.8, pitchDeg: 30, overhang: 0.3, stoneBand: 0.9,
};

export const CINDER_PROPS: PropStyle = {
  wood: 'charred_timber', metal: 'iron_grate', stone: 'cinder_basalt', housingGlass: 'glass_warm', glow: 'coal_glow', crystal: 'lava_glow', candle: 'glass_warm',
  cloth: 'charred_timber', soil: 'cinder_ash_soil', leaf: 'tall_grass', rock: 'cinder_scoria', water: null,
};

/** `cinder_caldera`: basalt rim (lathed, fractured blocks) round a lava pool whose glow is the light housing at (0, 0.6, 0). */
function caldera(ctx: SetPieceContext): PropGeo {
  const p = createPrng(ctx.seed);
  const t = tiers3();
  const st = ctx.set.props;
  for (const [k, parts] of t.entries()) {
    lathe(parts, 'cinder_basalt', [[6.2, -0.6], [6.0, 0.3], [5.4, 1.1], [4.6, 1.3], [3.9, 0.9], [3.6, 0.35], [3.2, 0.1]], { segments: k === 0 ? 40 : 20, smooth: false, radial: (a) => 1 + 0.08 * Math.sin(a * 5 + 1) + 0.05 * Math.sin(a * 11) });
    lathe(parts, 'lava_glow', [[3.3, 0.18], [2.2, 0.32], [0.001, 0.4]], { segments: k === 0 ? 24 : 12, smooth: false });
  }
  // crust islands floating on the lava
  for (let k = 0; k < 7; k++) {
    const a = p.next() * TAU; const r = 0.6 + p.next() * 2.2;
    const g = buildRock('lava_crust', ctx.seed + k, { size: 0.45 + p.next() * 0.3, squash: 0.3, elongate: 1.6, cuts: [3, 4] });
    const m = trs(Math.cos(a) * r, 0.34, Math.sin(a) * r, p.next() * TAU);
    t.forEach((parts, i) => addPropTier(parts, g, i as 0 | 1 | 2, m));
    disposeProp(g);
  }
  blockRing(t[0], 'obsidian', 5.1, 1.0, 16, 0.9, 0.5, 0.7, ctx.seed + 9);
  void st;
  return finish(t, ['cinder_basalt', 'lava_glow', 'lava_crust', 'obsidian']);
}

/** `ash_lava_bridge`: a basalt arch bridge across a lava channel, with a fire bowl at each end (the two lights). */
function lavaBridge(ctx: SetPieceContext): PropGeo {
  const t = tiers3();
  const L = 9;
  for (const [k, parts] of t.entries()) {
    // the channel of lava running under the bridge (along z)
    box(parts, 'lava_glow', 0, ctx.ground(0, 0) - 0.55, 0, 5.2, 0.2, 9.5, 0, 0.05);
    box(parts, 'cinder_basalt', -2.9, ctx.ground(-2.9, 0) - 0.9, 0, 0.8, 1.2, 9.5, 0, 0.05);
    box(parts, 'cinder_basalt', 2.9, ctx.ground(2.9, 0) - 0.9, 0, 0.8, 1.2, 9.5, 0, 0.05);
    if (k < 2) archway(parts, 'cinder_basalt', 5.2, 0.2, 3.6, 1.0, new Matrix4().makeRotationY(Math.PI / 2).premultiply(new Matrix4().makeTranslation(0, ctx.ground(0, 0) - 0.4, 0)));
    // deck with low parapets
    box(parts, 'forge_brick', 0, 0.3, 0, 2 * L, 0.3, 3.4, 0, 0.05);
    for (const s of [-1, 1]) box(parts, 'cinder_basalt', 0, 0.6, s * 1.6, 2 * L, 0.55, 0.3, 0, 0.05);
  }
  for (const l of spLights('ash_lava_bridge')) {
    const g = buildBrazier(ctx.set.props, 1);
    const m = new Matrix4().makeTranslation(l.x, l.y - 1.02, l.z);
    t.forEach((parts, i) => addPropTier(parts, g, i as 0 | 1 | 2, m));
    t.forEach((parts) => box(parts, 'cinder_basalt', l.x, ctx.ground(l.x, l.z) - 0.2, l.z, 1.0, l.y - 1.02 - ctx.ground(l.x, l.z) + 0.2, 1.0, 0, 0.05));
    disposeProp(g);
  }
  return finish(t, ['cinder_basalt', 'forge_brick', 'lava_glow', 'iron_grate', 'coal_glow']);
}

export const CINDER_SET: BiomeSet = {
  biome: 'cinder',
  building: CINDER_BUILDING,
  props: CINDER_PROPS,
  trees: [
    { kind: 'tree_dead', shape: TREE_SHAPES.dead, bark: 'charred_timber', leaf: 'tall_grass', weight: 1 },
  ],
  rock: 'cinder_scoria',
  tallGrass: 'tall_grass',
  tuft: 'tall_grass',
  bushLeaf: null,
  flower: null,
  density: { treeMargin: 0.012, treeInterior: 0.01, rock: 0.012, bush: 0, flower: 0, tuft: 0.08, tallGrass: 2.0 },
  boundary: 'rocks',
  accent: 'lava_glow',
  setPieces: { cinder_caldera: caldera, ash_lava_bridge: lavaBridge },
};

export { card, rootArm };
