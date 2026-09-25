/**
 * The shape every biome generator set exports (SPEC §10.5.4: "`grove` in full, the other sets follow the same
 * shape"). A set is surfaces + styles + scatter tables + its own set-pieces; the heavy lifting lives in the shared
 * `nature.ts`, `buildings.ts`, `props.ts` builders, parameterised per biome.
 */
import type { Matrix4 } from 'three/webgpu';
import type { Biome, BuildingSpec, SetPieceId } from '../../contracts.js';
import type { LightSource } from '../../descriptors.js';
import type { SurfaceId } from '../../materials/surfaces.js';
import { SET_PIECE_LIGHTS } from '../layout.js';
import type { Parts } from '../geo.js';
import type { PropGeo, TreeKind } from '../types.js';
import type { BuildingStyle } from './buildings.js';
import type { TreeShape } from './nature.js';
import type { PropStyle } from './props.js';

export interface ScatterTree { readonly kind: string; readonly shape: TreeShape; readonly bark: SurfaceId; readonly leaf: SurfaceId; readonly weight: number; readonly nearWater?: boolean }

/** Densities per m² (§10.5.4: trees 0.028 town margin / 0.045 route, rocks 0.006, bushes 0.02, flowers 0.012, tall grass 2.2 in patches). */
export interface ScatterDensity {
  readonly treeMargin: number;
  readonly treeInterior: number;
  readonly rock: number;
  readonly bush: number;
  readonly flower: number;
  readonly tuft: number;
  readonly tallGrass: number;
}

/** Terrain height relative to the set-piece origin at a set-piece-local point. */
export type GroundFn = (lx: number, lz: number) => number;

export interface SetPieceContext {
  readonly set: BiomeSet;
  readonly seed: number;
  readonly ground: GroundFn;
}

export type SetPieceBuilder = (ctx: SetPieceContext) => PropGeo;

export interface BiomeSet {
  readonly biome: Biome;
  readonly building: BuildingStyle;
  readonly props: PropStyle;
  readonly trees: readonly ScatterTree[];
  readonly rock: SurfaceId;
  readonly tallGrass: SurfaceId | null;
  readonly tuft: SurfaceId | null;
  readonly bushLeaf: SurfaceId | null;
  readonly flower: SurfaceId | null;
  readonly density: ScatterDensity;
  /** Margin dressing along the playable boundary. */
  readonly boundary: 'wall' | 'hedge' | 'rocks' | 'fence' | 'crystal';
  /** Emissive surface for the gym's type emblem (null = none). */
  readonly accent: SurfaceId | null;
  readonly setPieces: Partial<Readonly<Record<SetPieceId, SetPieceBuilder>>>;
}

/** Every surface a set may bind (for `MaterialLibrary.preload`). */
export function setSurfaces(s: BiomeSet): SurfaceId[] {
  const b = s.building; const p = s.props;
  const out = new Set<SurfaceId>([
    b.wall, b.upperWall, b.plinth, b.door, b.glass, b.litGlass, b.sill, b.trim, b.metal, ...Object.values(b.roofs),
    p.wood, p.metal, p.stone, p.housingGlass, p.glow, p.crystal, p.candle, p.cloth, p.soil, p.leaf, p.rock, s.rock,
  ]);
  for (const x of [b.frame, b.chimney, b.greenery, p.water, s.tallGrass, s.tuft, s.bushLeaf, s.flower, s.accent]) if (x) out.add(x);
  for (const t of s.trees) { out.add(t.bark); out.add(t.leaf); }
  return [...out].sort();
}

/** Lights of a set-piece in its local frame (the §10.5.4 `makeSetPiece` return), from the shared table. */
export function setPieceLights(id: SetPieceId): LightSource[] {
  return SET_PIECE_LIGHTS[id].map((l, k) => ({
    id: `setpiece:${id}:${k}`, kind: l.kind, color: l.color, intensity: l.intensity, position: l.local, castShadow: l.castShadow, range: l.range,
    housing: { kind: 'mesh', meshId: `setpiece:${id}:${k}` }, flicker: l.flicker,
  }));
}

/** Roof surfaces per `BuildingSpec.roof` for adapters that need only the kind list. */
export type RoofKind = BuildingSpec['roof'];
export type { TreeKind, Matrix4, Parts };
