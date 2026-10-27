/**
 * Detail distance and LOD scale (performance addition 2026-10-27, render IMPLEMENTATION-NOTES "Detail distance").
 *
 * - The detail distance: small ground detail (grass tufts, flower patches, pebbles: `DETAIL_KINDS`) and the ambient
 *   motes (fireflies, pollen, embers, …) are drawn only within this radius of the camera focus (the player). In the
 *   vertex stage a detail instance shrinks to nothing over the last `DETAIL_FADE_M` of the radius (no pop, and a
 *   collapsed instance rasterises nothing, in the beauty pass or the shadow maps); on the CPU a 32 m chunk wholly
 *   outside the radius is left out of the detail kinds' instance buffers altogether.
 * - The LOD scale: the scatter tier distances (`LOD_DISTANCES`) and the building LOD levels are multiplied by it, so a
 *   cheaper quality preset reaches the lower tiers sooner (`QualityProfile.lodScale`).
 *
 * Tall grass is not a detail kind: it marks where wild encounters are, so it stays visible at any distance (it drops
 * to its sparser tiers with the rest of the foliage, `isFoliageKind`).
 * One state per page (the scatter instancing is installed once per page too); the renderer writes it.
 */
import { Vector4 } from 'three/webgpu';
import { uniform } from 'three/tsl';
import type { UniformNode } from 'three/webgpu';

export type DetailDistance = 'close' | 'medium' | 'far' | 'max';

/** The detail radius of each setting (m); `max` draws everything. */
export const DETAIL_DISTANCE_M: Readonly<Record<DetailDistance, number>> = Object.freeze({ close: 8, medium: 16, far: 20, max: Infinity });

/** The scatter kinds the detail distance hides (`ScatterKind.name`). */
export const DETAIL_KINDS: ReadonlySet<string> = new Set(['grass_tuft', 'flower_patch', 'rock_b']);

/**
 * Foliage (trees, bushes, tall grass) takes its tier per instance from the focus while the detail distance is finite
 * (`ScatterField.syncFoliage`): the chunk's tier within the radius, lod1 past it, lod2 past `FOLIAGE_LOD_FAR` × it.
 */
export function isFoliageKind(name: string): boolean {
  return name.startsWith('tree') || name === 'bush' || name === 'tall_grass';
}
export const FOLIAGE_LOD_FAR = 4;
/** The foliage tiers are re-picked when the focus moved this far (m). */
export const FOLIAGE_LOD_STEP_M = 1;

/** The fade band at the radius' rim (m), capped at half the radius. */
export const DETAIL_FADE_M = 1.5;

/** The radius the shader gets for "unlimited" (any finite number past every zone). */
const UNLIMITED_M = 1e6;

export interface DetailState {
  /** focus x, focus z, radius, fade width */
  readonly uniform: UniformNode<'vec4', Vector4>;
  focusX: number;
  focusZ: number;
  radius: number;
  lodScale: number;
}

export const detailState: DetailState = {
  uniform: uniform(new Vector4(0, 0, UNLIMITED_M, DETAIL_FADE_M)).setName('ewaDetailField'),
  focusX: 0,
  focusZ: 0,
  radius: Infinity,
  lodScale: 1,
};

/** The detail radius (m, `Infinity` = unlimited). */
export function setDetailRadius(m: number): void {
  const r = Number.isFinite(m) && m > 0 ? m : Infinity;
  detailState.radius = r;
  const u = detailState.uniform.value;
  u.z = Number.isFinite(r) ? r : UNLIMITED_M;
  u.w = Number.isFinite(r) ? Math.min(DETAIL_FADE_M, r / 2) : DETAIL_FADE_M;
}

/** Per frame: where the player stands. */
export function setDetailFocus(x: number, z: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return;
  detailState.focusX = x;
  detailState.focusZ = z;
  const u = detailState.uniform.value;
  u.x = x;
  u.y = z;
}

/** The LOD distance multiplier (1 = the SPEC's distances). */
export function setLodScale(s: number): void {
  detailState.lodScale = Number.isFinite(s) && s > 0 ? s : 1;
}

/** Whether a square chunk (centre, half edge) reaches within the detail radius of the focus. Pure in the state. */
export function chunkInDetail(cx: number, cz: number, half: number): boolean {
  const r = detailState.radius;
  if (!Number.isFinite(r)) return true;
  const dx = Math.max(0, Math.abs(cx - detailState.focusX) - half);
  const dz = Math.max(0, Math.abs(cz - detailState.focusZ) - half);
  return dx * dx + dz * dz <= r * r;
}
