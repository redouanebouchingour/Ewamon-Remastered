/**
 * SPEC §10.5 descriptor types that are not in `contracts.ts` (pure TypeScript; `three` appears only as `import
 * type`, so node tests import this file freely).
 */
import type { BufferGeometry, Mesh } from 'three/webgpu';
import type { LightSource } from '../descriptors.js';
import type { SurfaceId } from '../materials/surfaces.js';
import type { BuildingSpec, SetPieceId, WaterSpec } from '../contracts.js';

/** §10.5.3 palette (verbatim fields) plus the three fields the builder also needs (documented additions). */
export interface Palette {
  readonly skyZenith: string;
  readonly skyHorizon: string;
  readonly groundBounce: string;
  readonly fogColor: readonly [night: string, noon: string];
  readonly grade: { readonly lift: readonly [number, number, number]; readonly gamma: readonly [number, number, number]; readonly gain: readonly [number, number, number] };
  /** [ground (grass/soil), path, detail (dirt/fringe)] — triplanar terrain layers. */
  readonly terrainLayers: readonly [SurfaceId, SurfaceId, SurfaceId];
  /** sRGB tints multiplied onto scatter instances (`instanceColor`), picked per instance. */
  readonly scatterTints: readonly string[];
  // ---- additions ----
  /** Paved plaza / platform surface. */
  readonly plaza: SurfaceId;
  /** Night lift of the grade (§10.5.3 "night lift"). */
  readonly nightLift: readonly [number, number, number];
  /** Height-fog density (§10.3.7 default 0.018). */
  readonly fogDensity: number;
  /**
   * M3 review fixes (art, audit M3-all-3 / M3-all-4): the grass card's re-tone for this zone (sRGB target colour and
   * blend, `MaterialLibrary.setTone('tall_grass', …)`): straw on salt sand, ash-brown on cinder, frosted on snow, void
   * teal in the shrine. Absent = the baked green (grove, capital).
   */
  readonly grassTone?: { readonly color: string; readonly amount: number };
}

/** §10.5.4, verbatim. */
export interface GeoLod { readonly lod0: BufferGeometry; readonly lod1: BufferGeometry; readonly lod2: BufferGeometry; readonly impostorKind: string | null }
/** §10.5.4, verbatim. */
export interface PropGeo extends GeoLod { readonly surfaces: readonly SurfaceId[]; readonly groups: readonly { readonly surface: SurfaceId; readonly start: number; readonly count: number }[] }

export type TreeKind = 'oak' | 'birch' | 'willow';

/** The §10.5.4 generator surface every biome set implements (grove in full; the others follow the same shape). */
export interface BiomeGenerators {
  readonly biome: string;
  makeTree(kind: TreeKind, seed: number): PropGeo;
  makeRock(seed: number): PropGeo;
  makeHouse(spec: BuildingSpec): PropGeo;
  makeLantern(seed: number): PropGeo & { readonly housingLocal: readonly [number, number, number] };
  makeFence(path: readonly (readonly [number, number])[], seed: number): PropGeo;
  makeBridge(a: readonly [number, number], b: readonly [number, number], seed: number): PropGeo;
  makePond(spec: WaterSpec, seed: number): { readonly bank: PropGeo; readonly water: Mesh };
  makeTallGrass(seed: number): GeoLod;
  makeSetPiece(id: SetPieceId, seed: number): PropGeo & { readonly lights: readonly LightSource[] };
}
