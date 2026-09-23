/** SurfaceDef (SPEC §10.2.3, verbatim minus the three imports, which surfaces/ must not have). */
import type { SurfaceId } from './ids';

export type { SurfaceId } from './ids';
export type MaterialClass = 'standard' | 'physical' | 'card' | 'water' | 'emissive';

export interface SurfaceDef {
  readonly id: SurfaceId;
  readonly cls: MaterialClass;
  readonly albedo: string;                         // base colour used when harvestLevel >= 1 (vertex colour source) and as `color` multiplier
  readonly roughness: number; readonly metalness: number;
  readonly emissive: { readonly color: string; readonly intensity: number } | null;
  readonly clearcoat: { readonly base: number; readonly wet: number; readonly roughness: number } | null;
  readonly triplanar: boolean;                     // terrain layers
  readonly wind: { readonly amplitude: number; readonly frequency: number; readonly stiffnessFromUv: boolean } | null;
  readonly wetness: boolean;                       // roughness/clearcoat respond to weather 'rain'
  readonly alphaTest: number | null;               // cards: 0.5
  readonly doubleSide: boolean;
  readonly castShadow: boolean;                    // false for water and glass
  readonly hero: boolean;                          // true → a 1024² `hero` tier exists besides the 512² `field` tier (§10.2.1); the 6 shared surfaces, every triplanar layer and one signature surface per biome
}
