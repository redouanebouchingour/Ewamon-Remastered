/**
 * §10.5.4 — the `rift` set (The Rift): unmade stone (always rendered at harvest level 2 by the library), void
 * floor, violet rift shards; set-piece `rift_maw` (a ring of leaning fractured shards around a void pit with a
 * glowing shard core — the light at 2 m).
 */
import { Matrix4 } from 'three/webgpu';
import { lathe, trs } from '../geo.js';
import { createPrng } from '../prng.js';
import type { BuildingStyle } from './buildings.js';
import { addPropTier, disposeProp, finish, spLights, tiers3 } from './common.js';
import { TREE_SHAPES, buildRock } from './nature.js';
import type { PropStyle } from './props.js';
import type { BiomeSet, SetPieceContext } from './set.js';
import type { PropGeo } from '../types.js';

const TAU = Math.PI * 2;

export const RIFT_BUILDING: BuildingStyle = {
  wall: 'unmade_stone', upperWall: 'unmade_stone', frame: null, plinth: 'void_floor', door: 'void_floor', glass: 'void_floor', litGlass: 'rift_shard',
  sill: 'void_floor', trim: 'unmade_stone', chimney: null, metal: 'void_floor', greenery: null,
  roofs: { slate: 'unmade_stone', thatch: 'unmade_stone', tile: 'unmade_stone', plate: 'void_floor' },
  storey: 3, pitchDeg: 20, overhang: 0.2, stoneBand: 0,
};

export const RIFT_PROPS: PropStyle = {
  wood: 'void_floor', metal: 'void_floor', stone: 'unmade_stone', housingGlass: 'rift_shard', glow: 'rift_shard', crystal: 'rift_shard', candle: 'rift_shard',
  cloth: 'void_floor', soil: 'void_floor', leaf: 'tall_grass', rock: 'unmade_stone', water: 'bog_water',
};

/** `rift_maw`: a void-floor pit rimmed by 14 leaning shards (fractured lathes), a shard core rising from it (the light). */
function riftMaw(ctx: SetPieceContext): PropGeo {
  const p = createPrng(ctx.seed);
  const t = tiers3();
  const l = spLights('rift_maw')[0]!;
  for (const [k, parts] of t.entries()) {
    lathe(parts, 'void_floor', [[8.5, 0.2], [6.2, 0.1], [4.0, -1.2], [0.001, -1.6]], { segments: k === 0 ? 32 : 16, smooth: true });
    lathe(parts, 'rift_shard', [[0.001, l.y - 1.6], [0.7, l.y - 0.8], [0.55, l.y + 0.6], [0.001, l.y + 2.2]], { segments: 5, smooth: false, phase: 0.4 });
  }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + (p.next() - 0.5) * 0.2;
    const r = 6.6 + p.next() * 1.2;
    const h = 2.5 + p.next() * 3.5;
    const lean = 0.25 + p.next() * 0.35;
    const m = trs(Math.cos(a) * r, ctx.ground(Math.cos(a) * r, Math.sin(a) * r) - 0.4, Math.sin(a) * r, -a).multiply(new Matrix4().makeRotationZ(lean));
    const surf = i % 3 === 0 ? 'rift_shard' : 'unmade_stone';
    lathe(t[0], surf, [[0.001, 0], [0.55, 0.3], [0.5, h * 0.6], [0.2, h * 0.95], [0.001, h]], { segments: 5, smooth: false, phase: p.next() * TAU }, m);
    if (i % 2 === 0) lathe(t[1], surf, [[0.5, 0], [0.001, h]], { segments: 4, smooth: false }, m);
  }
  for (let k = 0; k < 5; k++) {
    const g = buildRock('unmade_stone', ctx.seed + k, { size: 0.9, squash: 0.5, elongate: 1.4, cuts: [4, 5] });
    const a = p.next() * TAU;
    addPropTier(t[0], g, 0, trs(Math.cos(a) * 9.4, ctx.ground(Math.cos(a) * 9.4, Math.sin(a) * 9.4), Math.sin(a) * 9.4, p.next() * TAU));
    disposeProp(g);
  }
  return finish(t, ['void_floor', 'rift_shard', 'unmade_stone']);
}

export const RIFT_SET: BiomeSet = {
  biome: 'rift',
  building: RIFT_BUILDING,
  props: RIFT_PROPS,
  trees: [{ kind: 'tree_dead', shape: TREE_SHAPES.dead, bark: 'unmade_stone', leaf: 'tall_grass', weight: 1 }],
  rock: 'unmade_stone',
  tallGrass: 'tall_grass',
  tuft: null,
  bushLeaf: null,
  flower: null,
  density: { treeMargin: 0.003, treeInterior: 0.002, rock: 0.024, bush: 0, flower: 0, tuft: 0, tallGrass: 1.4 },
  boundary: 'crystal',
  accent: 'rift_shard',
  setPieces: { rift_maw: riftMaw },
};
