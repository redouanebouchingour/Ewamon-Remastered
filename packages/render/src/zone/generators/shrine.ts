/**
 * §10.5.4 — the `shrine` set (Eclipse Shrine, Celestial Spire): eclipse-stone halls with star-iron fittings and
 * void-glass panes, crystal lamps; set-pieces `eclipse_engine` (concentric star-iron rings banded with ring-light
 * round a void-glass core — the light at 4.4 m) and `celestial_spire` (a tall lathed spire ringed with light bands,
 * its crystal crown the light at 12 m).
 */
import { Matrix4 } from 'three/webgpu';
import { beam, box, lathe, trs } from '../geo.js';
import type { BuildingStyle } from './buildings.js';
import { blockRing, finish, spLights, stair, tiers3 } from './common.js';
import { TREE_SHAPES } from './nature.js';
import type { PropStyle } from './props.js';
import type { BiomeSet, SetPieceContext } from './set.js';
import type { PropGeo } from '../types.js';

const TAU = Math.PI * 2;

export const SHRINE_BUILDING: BuildingStyle = {
  wall: 'eclipse_stone', upperWall: 'eclipse_stone', frame: null, plinth: 'void_floor', door: 'star_iron', glass: 'void_glass', litGlass: 'ring_light',
  sill: 'void_floor', trim: 'star_iron', chimney: null, metal: 'star_iron', greenery: null,
  roofs: { slate: 'eclipse_stone', thatch: 'eclipse_stone', tile: 'star_iron', plate: 'star_iron' },
  storey: 3.2, pitchDeg: 22, overhang: 0.25, stoneBand: 0,
};

export const SHRINE_PROPS: PropStyle = {
  wood: 'star_iron', metal: 'star_iron', stone: 'eclipse_stone', housingGlass: 'void_glass', glow: 'void_glass', crystal: 'void_glass', candle: 'ring_light',
  cloth: 'star_iron', soil: 'void_floor', leaf: 'tall_grass', rock: 'eclipse_stone', water: 'water_pond',
};

/** `eclipse_engine`: a stepped dais, three tilted star-iron rings banded with ring-light round a void-glass core (the light). */
function eclipseEngine(ctx: SetPieceContext): PropGeo {
  const t = tiers3();
  const l = spLights('eclipse_engine')[0]!;
  for (const [k, parts] of t.entries()) {
    const seg = k === 0 ? 40 : 20;
    lathe(parts, 'eclipse_stone', [[7.6, -0.5], [7.6, 0.3], [6.4, 0.3], [6.4, 0.6], [5.2, 0.6], [5.2, 0.9], [0.001, 0.9]], { segments: seg, smooth: false });
    for (let r = 0; r < 3; r++) {
      const R = 2.2 + r * 1.0;
      const m = trs(0, l.y, 0).multiply(new Matrix4().makeRotationX(0.5 + r * 0.55)).multiply(new Matrix4().makeRotationZ(r * 0.8));
      lathe(parts, 'star_iron', [[R - 0.14, -0.12], [R + 0.14, -0.12], [R + 0.14, 0.12], [R - 0.14, 0.12], [R - 0.14, -0.12]], { segments: seg, smooth: false }, m);
      if (k < 2) lathe(parts, 'ring_light', [[R + 0.15, -0.05], [R + 0.17, 0], [R + 0.15, 0.05]], { segments: seg, smooth: true }, m);
    }
    lathe(parts, 'void_glass', [[0.001, l.y - 0.9], [0.6, l.y - 0.3], [0.62, l.y + 0.3], [0.001, l.y + 0.9]], { segments: 8, smooth: false });
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    beam(t[0], 'star_iron', [Math.cos(a) * 4.8, 0.9, Math.sin(a) * 4.8], [Math.cos(a) * 1.8, l.y - 0.6, Math.sin(a) * 1.8], 0.22, 0.22, 0.03);
  }
  blockRing(t[0], 'void_floor', 7.0, 0.3, 28, 1.2, 0.08, 1.1, ctx.seed);
  return finish(t, ['eclipse_stone', 'star_iron', 'ring_light', 'void_glass', 'void_floor']);
}

/** `celestial_spire`: a stair up a plinth to a tall faceted spire with ring-light bands; its crystal crown is the light. */
function celestialSpire(_ctx: SetPieceContext): PropGeo {
  const t = tiers3();
  const l = spLights('celestial_spire')[0]!;
  for (const [k, parts] of t.entries()) {
    const seg = k === 0 ? 8 : 6;
    box(parts, 'void_floor', 0, -0.5, 0, 10, 1.6, 10, 0, 0.08);
    lathe(parts, 'eclipse_stone', [[3.0, 1.1], [2.6, 3.0], [1.9, 6.0], [1.2, 9.5], [0.6, l.y - 1.2]], { segments: seg, smooth: false, phase: TAU / 16 });
    for (const y of [3.2, 6.2, 9.0]) {
      const r = 3.0 - (y - 1.1) * 0.24;
      lathe(parts, 'ring_light', [[r + 0.02, y - 0.1], [r + 0.12, y], [r + 0.02, y + 0.1]], { segments: seg * 2, smooth: false });
    }
    lathe(parts, 'void_glass', [[0.001, l.y - 1.1], [0.55, l.y - 0.3], [0.5, l.y + 0.4], [0.001, l.y + 1.6]], { segments: 6, smooth: false });
    if (k < 2) stair(parts, 'void_floor', 3, 3, 1.1, k === 0 ? 6 : 3, trs(0, -0.4, 5));
  }
  return finish(t, ['void_floor', 'eclipse_stone', 'ring_light', 'void_glass']);
}

export const SHRINE_SET: BiomeSet = {
  biome: 'shrine',
  building: SHRINE_BUILDING,
  props: SHRINE_PROPS,
  trees: [{ kind: 'tree_dead', shape: { ...TREE_SHAPES.dead, height: 1.1 }, bark: 'star_iron', leaf: 'tall_grass', weight: 1 }],
  rock: 'eclipse_stone',
  tallGrass: 'tall_grass',
  tuft: null,
  bushLeaf: null,
  flower: null,
  density: { treeMargin: 0.004, treeInterior: 0.003, rock: 0.02, bush: 0, flower: 0, tuft: 0, tallGrass: 1.6 },
  boundary: 'crystal',
  accent: 'ring_light',
  setPieces: { eclipse_engine: eclipseEngine, celestial_spire: celestialSpire },
};

export { box };
