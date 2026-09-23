/**
 * SPEC §10.2.2–§10.2.3 surface table, runtime side.
 *
 * The canonical table (`SurfaceId`, `SurfaceDef`, `SURFACES`) lives in `../surfaces/` — the pure-TS module
 * the material bake also reads (§40.3.1), owned by the material-bake work — so the baked textures and the
 * runtime graph can never disagree about a surface's class, hero flag or base values. This file re-exports
 * it and adds the runtime-only extras. It imports the table's leaf files, NOT `../surfaces/index.ts`,
 * which builds every bake recipe at module load (bake code has no place in the browser bundle).
 */
import { BIOME_ROWS, SHARED_SURFACE_IDS, SURFACE_IDS, isSurfaceId, type Biome, type SurfaceId } from '../surfaces/ids.js';
import { SURFACES } from '../surfaces/surfaces.js';
import type { MaterialClass, SurfaceDef } from '../surfaces/types.js';

export { SURFACE_IDS, SURFACES, isSurfaceId };
export type { MaterialClass, SurfaceDef, SurfaceId };
export type BiomeName = Biome;

/**
 * Class-specific values the SPEC states in the §10.2.2 "Features" column but that have no field in the
 * verbatim `SurfaceDef` (kept verbatim for the bake's JSON contract, §40.3.1).
 */
export interface SurfaceExtras {
  /** `MeshPhysicalNodeMaterial.transmission` for class 'water' (§10.2.2: water_pond 0.6, sea_water 0.7). */
  readonly transmission?: number;
  /** `unmade_stone`: always renders at harvest level 2 (the Rift is the origin of the flat look). */
  readonly alwaysHarvested?: boolean;
  /** `stained_glass`: emissive is the albedo texel × intensity ("emissive per-texel mask 2.0"). */
  readonly emissiveFromAlbedo?: boolean;
  /** Double-sided leaf cards: subsurface tint on the backface via `frontFacing` (§10.2.2 grove_leaf_canopy). */
  readonly backfaceTint?: string;
}

export const SURFACE_EXTRAS: Readonly<Partial<Record<SurfaceId, SurfaceExtras>>> = Object.freeze({
  water_pond: { transmission: 0.6 },
  sea_water: { transmission: 0.7 },
  tide_pool: { transmission: 0.6 },
  bog_water: { transmission: 0.4 },
  fountain_water: { transmission: 0.6 },
  unmade_stone: { alwaysHarvested: true },
  stained_glass: { emissiveFromAlbedo: true },
  grove_leaf_canopy: { backfaceTint: '#9bbf4a' },
  willow_leaf: { backfaceTint: '#9fb865' },
  pine_needle: { backfaceTint: '#7c9a52' },
});

/** The 6 shared rows every zone may bind (§10.2.2). */
export const SHARED_SURFACES: readonly SurfaceId[] = SHARED_SURFACE_IDS;

/** §10.2.2 "full list by biome": each biome's rows plus the 6 shared rows, row order kept. */
export const BIOME_SURFACES: Readonly<Record<BiomeName, readonly SurfaceId[]>> = Object.freeze(
  Object.fromEntries(
    (Object.keys(BIOME_ROWS) as BiomeName[]).map((b) => {
      const out: SurfaceId[] = [...BIOME_ROWS[b]];
      for (const s of SHARED_SURFACE_IDS) if (!out.includes(s)) out.push(s);
      return [b, Object.freeze(out)];
    }),
  ) as Record<BiomeName, readonly SurfaceId[]>,
);

/** §10.2.2: "Unknown ids throw `RangeError` at `MaterialLibrary.get`." */
export function surfaceDef(id: string): SurfaceDef {
  if (!isSurfaceId(id)) throw new RangeError(`@ewa/render: unknown SurfaceId '${id}'`);
  return SURFACES[id];
}

export function surfaceExtras(id: SurfaceId): SurfaceExtras {
  return SURFACE_EXTRAS[id] ?? {};
}

/** Surfaces with a 1024² `hero` tier (§10.2.1, §40.3.5: ≤ 50 world-wide). */
export function heroSurfaces(): readonly SurfaceId[] {
  return SURFACE_IDS.filter((id) => SURFACES[id].hero);
}
