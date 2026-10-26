/**
 * SPEC §10.2.3 `SharedUniforms` and §10.2.6 — the harvested look is ONE uniform read by every library
 * material (and, later, every billboard). Writing it allocates nothing and compiles nothing.
 */
import { Vector2, Vector4 } from 'three/webgpu';
import type { Node, UniformNode } from 'three/webgpu';
import { uniform } from 'three/tsl';
import type { HarvestLevel } from '../descriptors.js';
import { createOcclusionUniforms, type OcclusionState } from './occlusion.js';
import { CLOUDS } from './clouds.js';
import { createWaterBackdrop, type WaterBackdrop } from './waterBackdrop.js';

/** SPEC §10.2.3, verbatim. */
export interface SharedUniforms {
  readonly harvestLevel: UniformNode<'float', number>;   // 0 | 1 | 2 written by setHarvestLevel; materials read it as 0..2 and clamp
  readonly wetness: UniformNode<'float', number>;        // 0..1; 'rain' ramps to 1 over 4 s, back over 12 s
  readonly windTime: UniformNode<'float', number>;       // seconds × timeScale
  readonly windDir: UniformNode<'vec2', Vector2>;        // unit xz
  readonly timeOfDay: UniformNode<'float', number>;
  /** Addition (IMPLEMENTATION-NOTES Part 5, M2-spawn-noon-9): the diorama occluder fade (materials/occlusion.ts). */
  readonly occlusion?: OcclusionState;
  /**
   * Addition (§10.7.8 world effects): `PUSHERS` walkers the tall grass bends away from, each (x, z, radius, strength);
   * strength 0 = none. Written by the world effects' `GrassPush`.
   */
  readonly push?: readonly UniformNode<'vec4', Vector4>[];
  /** Addition (§10.7.8 world effects): cloud shadows (strength, coverage, scale, drift); strength 0 = none (`clouds.ts`). */
  readonly clouds?: UniformNode<'vec4', Vector4>;
  /** Addition (§10.7.8 world effects): frost 0..1, ramped up under hail and back after it (`weatherSurface.ts`). */
  readonly frost?: UniformNode<'float', number>;
  /** Addition (IMPLEMENTATION-NOTES "Water backdrop without transmission"): the water graph's shared backdrop copy. */
  readonly waterBackdrop?: WaterBackdrop;
}

/** Pushers the grass reads (§10.7.8). */
export const PUSHERS = 4;

export function createSharedUniforms(): SharedUniforms {
  return {
    harvestLevel: uniform(0).setName('ewaHarvestLevel'),
    wetness: uniform(0).setName('ewaWetness'),
    windTime: uniform(0).setName('ewaWindTime'),
    windDir: uniform(new Vector2(0.8, 0.6)).setName('ewaWindDir'),
    timeOfDay: uniform(0.5).setName('ewaTimeOfDay'),
    occlusion: createOcclusionUniforms(),
    push: Array.from({ length: PUSHERS }, (_, i) => uniform(new Vector4(0, 0, 1, 0)).setName(`ewaPush${i}`)),
    clouds: uniform(new Vector4(0, 0.35, CLOUDS.scale, CLOUDS.driftMps)).setName('ewaClouds'),
    frost: uniform(0).setName('ewaFrost'),
    waterBackdrop: createWaterBackdrop(),
  };
}

/** §10.2.4 `h = u.harvestLevel.clamp(0, 2).div(2)` — 0 intact … 1 harvested. */
export function harvestBlend(u: SharedUniforms): Node {
  return u.harvestLevel.clamp(0, 2).div(2);
}

/** Coerces any number to a valid `HarvestLevel` (rounds, clamps to 0..2; NaN → 0). */
export function toHarvestLevel(l: number): HarvestLevel {
  if (!Number.isFinite(l)) return 0;
  const r = Math.round(l);
  return (r <= 0 ? 0 : r >= 2 ? 2 : 1) as HarvestLevel;
}

/** §10.2.3 / §10.3.6: wetness ramps to 1 over 4 s under rain and back to 0 over 12 s. */
export const WETNESS_RISE_S = 4;
export const WETNESS_FALL_S = 12;

/** Linear wetness ramp toward `target` (0 or 1). Pure; the rig calls it once per frame. */
export function stepWetness(current: number, target: number, dtS: number): number {
  if (!(dtS > 0)) return current;
  if (current < target) return Math.min(target, current + dtS / WETNESS_RISE_S);
  if (current > target) return Math.max(target, current - dtS / WETNESS_FALL_S);
  return current;
}
