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
  /** Class 'water': how much of the backdrop shows through (§10.2.2's transmission: water_pond 0.6, sea_water 0.7; `waterBackdrop.ts`). */
  readonly transmission?: number;
  /** `unmade_stone`: always renders at harvest level 2 (the Rift is the origin of the flat look). */
  readonly alwaysHarvested?: boolean;
  /** `stained_glass`: emissive is the albedo texel × intensity ("emissive per-texel mask 2.0"). */
  readonly emissiveFromAlbedo?: boolean;
  /** Double-sided leaf cards: subsurface tint on the backface via `frontFacing` (§10.2.2 grove_leaf_canopy). */
  readonly backfaceTint?: string;
  /**
   * M3 review fixes (audit M3-all-10 / R-all-5): a linear albedo multiplier applied once the baked set is bound, for the
   * high-albedo ground and stone that clipped under the key (snow, salt sand, marble, pale plaza stone, chalk). The
   * baked maps and the harvest-level vertex colour are unchanged.
   */
  readonly albedoCal?: number;
  /** World effects (§10.7.8): walkers push this card aside (the tall grass card: tall grass, tufts, clumps). */
  readonly pushable?: boolean;
  /** World effects (§10.7.8), water only: shore foam and caustics strengths 0..1 (default 0.6 each). */
  readonly foam?: number;
  readonly caustics?: number;
}

export const SURFACE_EXTRAS: Readonly<Partial<Record<SurfaceId, SurfaceExtras>>> = Object.freeze({
  water_pond: { transmission: 0.6, foam: 0.55, caustics: 0.7 },
  sea_water: { transmission: 0.7, foam: 1, caustics: 0.8 },
  tide_pool: { transmission: 0.6, foam: 0.8, caustics: 1 },
  bog_water: { transmission: 0.4, foam: 0.15, caustics: 0 },
  fountain_water: { transmission: 0.6, foam: 0.35, caustics: 0.6 },
  unmade_stone: { alwaysHarvested: true },
  stained_glass: { emissiveFromAlbedo: true },
  // M3 review fixes (R-cinderhold-3): the lava glows through its crust cracks (the albedo's orange veins), not as one flat disc
  lava_glow: { emissiveFromAlbedo: true },
  grove_leaf_canopy: { backfaceTint: '#9bbf4a' },
  tall_grass: { pushable: true },
  willow_leaf: { backfaceTint: '#9fb865' },
  pine_needle: { backfaceTint: '#7c9a52' },
  // M3 review fixes: high-albedo ground and stone (audit M3-all-10 / R-all-5 / R-all-4)
  snow: { albedoCal: 0.84 },
  salt_sand: { albedoCal: 0.88 },
  sky_marble: { albedoCal: 0.82 },
  cloud_stone: { albedoCal: 0.86 },
  bone_chalk: { albedoCal: 0.86 },
  plaza_pale_stone: { albedoCal: 0.84 },
  sun_marble: { albedoCal: 0.86 },
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
