/**
 * SPEC §10.3.7 — analytic height fog (no raymarch), assigned to `scene.fogNode` (read by
 * `NodeManager.getFogNode`). The sky mesh has `material.fog = false` (SkyMesh sets it itself).
 */
import { Color } from 'three/webgpu';
import type { Node, UniformNode } from 'three/webgpu';
import { exp, fog, oneMinus, positionView, positionWorld, uniform } from 'three/tsl';

export interface FogUniforms {
  readonly fogColor: UniformNode<'color', Color>;
  readonly fogDensity: UniformNode<'float', number>;   // per metre of view distance
  readonly fogBase: UniformNode<'float', number>;      // m; full height factor at/below
  readonly fogFalloff: UniformNode<'float', number>;   // per metre above the base
}

export interface HeightFog {
  readonly uniforms: FogUniforms;
  /** Assign to `scene.fogNode`. */
  readonly node: Node;
}

/**
 * Grove density as amended 2026-09-25 (§10.3.7: 0.0068 per m = the draft 0.018 × the zone palettes' FOG_SCALE 0.38,
 * i.e. exactly what `PALETTES.grove_mirevale` carries) — the default of every view without a zone palette (boot,
 * the part-3 lineup / inspector, the first frames before `loadZone` applies the zone's). IMPLEMENTATION-NOTES Part 4, H8.
 */
export const GROVE_FOG_DENSITY = 0.018 * 0.38;

/** Grove defaults (§10.3.7): density 0.0068 (`GROVE_FOG_DENSITY`), base 0 m, falloff 0.35 / m, noon colour #b9c7a8. */
export function createHeightFog(): HeightFog {
  const u: FogUniforms = {
    fogColor: uniform(new Color('#b9c7a8')),
    fogDensity: uniform(GROVE_FOG_DENSITY),
    fogBase: uniform(0),
    fogFalloff: uniform(0.35),
  };
  const dist = positionView.z.abs();
  const hFall = exp(positionWorld.y.sub(u.fogBase).max(0).mul(u.fogFalloff).negate());   // 1 at/below base height, decays upward
  const factor = oneMinus(exp(dist.mul(u.fogDensity).negate())).mul(hFall);
  return { uniforms: u, node: fog(u.fogColor, factor) };
}

/** CPU mirror of the fog factor (tests, and the harness's fog readbacks). */
export function heightFogFactor(viewDistance: number, worldY: number, density: number, base: number, falloff: number): number {
  const hFall = Math.exp(-Math.max(0, worldY - base) * falloff);
  return (1 - Math.exp(-Math.abs(viewDistance) * density)) * hFall;
}
