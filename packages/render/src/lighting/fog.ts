/**
 * SPEC §10.3.7 — analytic height fog (no raymarch), assigned to `scene.fogNode` (read by
 * `NodeManager.getFogNode`). The sky mesh has `material.fog = false` (SkyMesh sets it itself).
 */
import { Color } from 'three/webgpu';
import type { Node, UniformNode } from 'three/webgpu';
import { exp, fog, oneMinus, positionView, positionWorld, uniform } from 'three/tsl';

export interface FogUniforms {
  readonly fogColor: UniformNode<'color', Color>;
  readonly fogDensity: UniformNode<'float', number>;   // per metre of view distance past `fogStart`
  /** m of view distance before the fog starts (amended 2026-10-06): the diorama's focus stays clear, the far land hazes. */
  readonly fogStart: UniformNode<'float', number>;
  readonly fogBase: UniformNode<'float', number>;      // m; full height factor at/below
  readonly fogFalloff: UniformNode<'float', number>;   // per metre above the base
}

export interface HeightFog {
  readonly uniforms: FogUniforms;
  /** Assign to `scene.fogNode`. */
  readonly node: Node;
}

/**
 * §10.3.7 as amended 2026-10-06 (the M2 re-light, audit M2-spawn-noon-2): the fog starts `FOG_START_M` of view depth
 * from the camera and the grove density is 0.00486 per metre past it (the reference 0.018 × the zone palettes'
 * FOG_SCALE 0.27), so the player's feet at the default 26 m stop are 5.2 % fogged (was 16 %) while the skirt hills at
 * 60–150 m still recede into the haze (20–48 %). It is the default of every view without a zone palette (boot, the
 * part-3 lineup / inspector, the first frames before `loadZone` applies the zone's).
 */
export const FOG_START_M = 15;
export const GROVE_FOG_DENSITY = 0.018 * 0.27;

/** Grove defaults (§10.3.7): density 0.00486 (`GROVE_FOG_DENSITY`) past 15 m, base 0 m, falloff 0.35 / m, noon colour #b9c7a8. */
export function createHeightFog(): HeightFog {
  const u: FogUniforms = {
    fogColor: uniform(new Color('#b9c7a8')),
    fogDensity: uniform(GROVE_FOG_DENSITY),
    fogStart: uniform(FOG_START_M),
    fogBase: uniform(0),
    fogFalloff: uniform(0.35),
  };
  const dist = positionView.z.abs().sub(u.fogStart).max(0);
  const hFall = exp(positionWorld.y.sub(u.fogBase).max(0).mul(u.fogFalloff).negate());   // 1 at/below base height, decays upward
  const factor = oneMinus(exp(dist.mul(u.fogDensity).negate())).mul(hFall);
  return { uniforms: u, node: fog(u.fogColor, factor) };
}

/** CPU mirror of the fog factor (tests, and the harness's fog readbacks). `start` defaults to 0 (no clear zone). */
export function heightFogFactor(viewDistance: number, worldY: number, density: number, base: number, falloff: number, start = 0): number {
  const hFall = Math.exp(-Math.max(0, worldY - base) * falloff);
  return (1 - Math.exp(-Math.max(0, Math.abs(viewDistance) - start) * density)) * hFall;
}
