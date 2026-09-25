/**
 * §10.5.4 — the `sky` set (Skyrend, Ascent Route): marble houses under dragon-scale tile with gilt trim and
 * frosted windows, prayer-silk banners, cloud-stone crags, snow pines; set-pieces `sky_shrine` (a three-tier pagoda
 * on marble columns with two lanterns) and `ascent_stair` (a stone stair climbing to a gilt gate, a lantern at its
 * foot).
 */
import { beam, box, card, lathe, trs, type Parts } from '../geo.js';
import type { BuildingStyle } from './buildings.js';
import { finish, lanternAt, spLights, stair, tiers3 } from './common.js';
import { TREE_SHAPES } from './nature.js';
import type { PropStyle } from './props.js';
import type { BiomeSet, SetPieceContext } from './set.js';
import type { PropGeo } from '../types.js';

export const SKY_BUILDING: BuildingStyle = {
  wall: 'sky_marble', upperWall: 'sky_marble', frame: 'dragon_scale_tile', plinth: 'cloud_stone', door: 'gold_leaf', glass: 'frost_glass', litGlass: 'glass_warm',
  sill: 'cloud_stone', trim: 'gold_leaf', chimney: 'cloud_stone', metal: 'gold_leaf', greenery: null,
  roofs: { slate: 'slate_roof', thatch: 'dragon_scale_tile', tile: 'dragon_scale_tile', plate: 'gold_leaf' },
  storey: 2.8, pitchDeg: 30, overhang: 0.55, stoneBand: 0,
};

export const SKY_PROPS: PropStyle = {
  wood: 'dragon_scale_tile', metal: 'gold_leaf', stone: 'cloud_stone', housingGlass: 'glass_warm', glow: 'glass_warm', crystal: 'frost_glass', candle: 'glass_warm',
  cloth: 'prayer_silk', soil: 'snow', leaf: 'pine_needle', rock: 'cloud_stone', water: 'water_pond',
};

/** A square pyramid roof (4-segment lathe, edges on the axes) of half-width w/2 + 0.6 m overhang rising `rise`, with a curled eave lip. */
function tierRoof(parts: Parts, y: number, w: number, rise: number): void {
  const R = (w / 2 + 0.6) * Math.SQRT2;
  lathe(parts, 'dragon_scale_tile', [[R * 1.04, y - 0.12], [R, y + 0.05], [R * 0.55, y + rise * 0.55], [0.35, y + rise], [0.001, y + rise + 0.05]], { segments: 4, phase: Math.PI / 4, smooth: false });
}

/** `sky_shrine`: a marble platform, eight columns, three diminishing dragon-scale roofs with a gilt finial; two lanterns. */
function skyShrine(ctx: SetPieceContext): PropGeo {
  const t = tiers3();
  for (const [k, parts] of t.entries()) {
    box(parts, 'cloud_stone', 0, -0.5, 0, 9.5, 1.1, 9.5, 0, 0.06);
    box(parts, 'sky_marble', 0, 0.6, 0, 8.4, 0.3, 8.4, 0, 0.04);
    if (k < 2) for (const [x, z] of [[-3.3, -3.3], [0, -3.3], [3.3, -3.3], [-3.3, 0], [3.3, 0], [-3.3, 3.3], [0, 3.3], [3.3, 3.3]] as const) lathe(parts, 'sky_marble', [[0.34, 0.9], [0.28, 1.1], [0.26, 3.5], [0.34, 3.7]], { segments: k === 0 ? 12 : 6, smooth: true }, trs(x, 0, z));
    box(parts, 'sky_marble', 0, 3.7, 0, 7.6, 0.4, 7.6, 0, 0.04);
    tierRoof(parts, 4.1, 7.6, 1.6);
    box(parts, 'sky_marble', 0, 5.4, 0, 4.4, 1.3, 4.4, 0, 0.04);
    tierRoof(parts, 6.7, 4.4, 1.1);
    lathe(parts, 'gold_leaf', [[0.25, 7.6], [0.12, 8.3], [0.2, 8.6], [0.001, 9.4]], { segments: 8, smooth: false });
  }
  // prayer silk strips on the columns
  for (const [x, z] of [[-3.3, 3.55], [3.3, 3.55]] as const) card(t[0], 'prayer_silk', x, 1.4, z, 0.5, 2.0, 0, 0, undefined, 0.6, [0, 0, 1, 1], true);
  for (const l of spLights('sky_shrine')) lanternAt(t, ctx.set, l.x, l.y, l.z, ctx.ground(l.x, l.z), ctx.seed + Math.round(l.x));
  return finish(t, ['cloud_stone', 'sky_marble', 'dragon_scale_tile', 'gold_leaf', 'prayer_silk', 'lantern_metal', 'glass_warm']);
}

/** `ascent_stair`: a 16-step stone stair between cloud-stone cheeks up to a gilt gate; a lantern at its foot. */
function ascentStair(ctx: SetPieceContext): PropGeo {
  const t = tiers3();
  const run = 14; const rise = 3.2;
  for (const [k, parts] of t.entries()) {
    stair(parts, 'cloud_stone', 3.6, run, rise, k === 0 ? 16 : 8, trs(0, ctx.ground(0, -run / 2), -run / 2));
    for (const s of [-1, 1]) box(parts, 'cloud_stone', s * 2.1, ctx.ground(s * 2.1, 0) - 0.5, 0, 0.6, rise * 0.6 + 1.1, run, 0, 0.05);
  }
  // the gate at the top
  const gy = ctx.ground(0, -run / 2) + rise;
  for (const parts of [t[0], t[1]]) {
    for (const s of [-1, 1]) beam(parts, 'sky_marble', [s * 2.2, gy, run / 2], [s * 2.2, gy + 4.2, run / 2], 0.45, 0.45, 0.05);
    beam(parts, 'gold_leaf', [-3.2, gy + 4.2, run / 2], [3.2, gy + 4.2, run / 2], 0.5, 0.35, 0.05);
    beam(parts, 'sky_marble', [-2.8, gy + 3.5, run / 2], [2.8, gy + 3.5, run / 2], 0.3, 0.25, 0.04);
  }
  for (const l of spLights('ascent_stair')) lanternAt(t, ctx.set, l.x, l.y, l.z, ctx.ground(l.x, l.z), ctx.seed);
  return finish(t, ['cloud_stone', 'sky_marble', 'gold_leaf', 'lantern_metal', 'glass_warm']);
}

export const SKY_SET: BiomeSet = {
  biome: 'sky',
  building: SKY_BUILDING,
  props: SKY_PROPS,
  trees: [{ kind: 'tree_pine', shape: TREE_SHAPES.pine, bark: 'grove_bark', leaf: 'pine_needle', weight: 1 }],
  rock: 'cloud_stone',
  tallGrass: 'tall_grass',
  tuft: 'tall_grass',
  bushLeaf: 'pine_needle',
  flower: null,
  density: { treeMargin: 0.024, treeInterior: 0.02, rock: 0.012, bush: 0.006, flower: 0, tuft: 0.12, tallGrass: 2.0 },
  boundary: 'rocks',
  accent: 'gold_leaf',
  setPieces: { sky_shrine: skyShrine, ascent_stair: ascentStair },
};
