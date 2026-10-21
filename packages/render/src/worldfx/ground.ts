/**
 * World effects (SPEC §10.7.8): what a foot lands on. The answer comes from the same data the terrain is drawn
 * from (the zone plan's roads, plaza and tall-grass patches as `splatAt` reads them, the palette's terrain layers and the
 * heightfield's water mask), so the dust matches the ground under it: a gravel road puffs tan, salt sand throws
 * grains and keeps a print, snow kicks flakes, ash smokes grey, tall grass flicks blades, shallows splash.
 * Pure (node-tested); `classify` allocates nothing.
 */
import type { SurfaceId } from '../surfaces/ids.js';
import { inEllipse, splatAt, type SplatContext, type SplatFields } from '../zone/layout.js';

export type GroundKind = 'none' | 'dust' | 'canyon' | 'sand' | 'snow' | 'ash' | 'soil' | 'stone' | 'grass' | 'shallow' | 'mud';

/** The terrain layer a palette lays as ground or path → what a step on it throws. Unlisted surfaces throw nothing. */
const LAYER_KIND: Readonly<Partial<Record<SurfaceId, GroundKind>>> = Object.freeze({
  grove_moss: 'soil', grave_moss: 'soil', dirt: 'soil',
  path_gravel: 'dust', canyon_dust: 'canyon', marrow_sandstone: 'canyon',
  salt_sand: 'sand', barnacle_stone: 'stone', wet_rock: 'stone',
  snow: 'snow',
  cinder_ash_soil: 'ash', cinder_basalt: 'ash', cinder_scoria: 'ash',
  wet_flagstone: 'stone', storm_slate: 'stone', lichen_stone: 'stone', castle_granite: 'stone', plaza_pale_stone: 'stone',
  cobble: 'stone', eclipse_stone: 'stone', star_iron: 'stone', obsidian: 'stone', cloud_stone: 'stone', gold_leaf: 'stone',
});

export function layerKind(id: SurfaceId): GroundKind {
  return LAYER_KIND[id] ?? 'none';
}

/** Kinds that keep a print where the foot came down (and only these). */
export function keepsPrint(k: GroundKind): boolean {
  return k === 'sand' || k === 'snow' || k === 'mud';
}

/** Wet ground: hard ground splashes, soft ground turns to mud. Sand, snow, grass and water keep their own. */
export function wetKind(k: GroundKind): GroundKind {
  if (k === 'dust' || k === 'canyon' || k === 'soil' || k === 'ash') return 'mud';
  if (k === 'stone') return 'shallow';
  return k;
}

export interface GroundSource {
  readonly splat: SplatContext;
  /** the palette's [ground, path, detail] terrain layers */
  readonly layers: readonly [SurfaceId, SurfaceId, SurfaceId];
  /** the plaza / pocket floor surface */
  readonly plaza: SurfaceId;
  /** heightfield water mask at (x, z) (shallows and banks) */
  water(x: number, z: number): boolean;
  /** open water (a surfer) at (x, z) */
  onWater(x: number, z: number): boolean;
}

const _s: SplatFields = { plaza: 0, path: 0, detail: 0 };

/** What a foot at (x, z) lands on; `wet` 0..1 (weather wetness) turns roads to puddles and earth to mud above 0.5. */
export function classify(g: GroundSource, x: number, z: number, wet = 0): GroundKind {
  if (g.onWater(x, z)) return 'none';                    // a surfer: the wake is the water effects' (§10.7.8)
  if (g.water(x, z)) return 'shallow';
  for (const e of g.splat.plan.grassPatches) if (inEllipse(e, x, z)) return 'grass';
  splatAt(g.splat, x, z, _s);
  let k: GroundKind;
  if (_s.plaza > 0) k = layerKind(g.plaza);
  else if (_s.path > 0) k = layerKind(g.layers[1]);
  else if (_s.detail > 0.15) k = layerKind(g.layers[2]);
  else k = layerKind(g.layers[0]);
  return wet > 0.5 ? wetKind(k) : k;
}
