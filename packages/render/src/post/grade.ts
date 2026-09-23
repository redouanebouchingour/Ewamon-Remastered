/**
 * SPEC §10.8.2 grade stage: lift/gamma/gain `out = (in·gain + lift)^(1/gamma)`, the aspect-corrected
 * vignette, and the palette grade values of §10.5.3. TSL builders + CPU mirrors for tests.
 */
import type { Node } from 'three/webgpu';
import { length, oneMinus, pow, screenUV, smoothstep, vec2, vec3 } from 'three/tsl';

export type Rgb3 = readonly [number, number, number];

export interface GradePalette {
  readonly lift: Rgb3;
  readonly gamma: Rgb3;
  readonly gain: Rgb3;
  /** Lift used at full night (§10.5.3: "night lift [0.0, 0.004, 0.02]"); blended by daylight. */
  readonly nightLift: Rgb3;
}

/** §10.5.3 grove grade (warm greens) — `grove_mirevale` / `grove_mire`. */
export const GROVE_GRADE: GradePalette = Object.freeze({
  lift: [0.01, 0.012, 0.0] as const,
  gamma: [1.0, 0.98, 0.96] as const,
  gain: [1.02, 1.03, 0.98] as const,
  nightLift: [0.0, 0.004, 0.02] as const,
});

export const NEUTRAL_GRADE: GradePalette = Object.freeze({
  lift: [0, 0, 0] as const, gamma: [1, 1, 1] as const, gain: [1, 1, 1] as const, nightLift: [0, 0, 0] as const,
});

/** §10.8.3 vignette strength and its smoothstep edges. */
export const VIGNETTE = Object.freeze({ strength: 0.22, inner: 0.35, outer: 0.85 });

/** TSL: `pow(max(c·gain + lift, 0), 1/gamma).clamp(0, 1)` (the max guards pow against negative bases). */
export function gradeNode(c: Node<'vec3'>, lift: Node<'vec3'>, gamma: Node<'vec3'>, gain: Node<'vec3'>): Node<'vec3'> {
  return pow(c.mul(gain).add(lift).max(0), vec3(1).div(gamma)).clamp(0, 1) as Node<'vec3'>;
}

/**
 * TSL vignette: `c · (1 − smoothstep(0.35, 0.85, r) · strength)` with `r = |uv − 0.5| · (1, 1/aspect)`.
 * The SPEC hard-codes `0.5625` (16:9); `aspectInv` is a uniform the host writes on resize (0.5625 at 16:9).
 */
export function vignetteNode(c: Node<'vec3'>, strength: Node<'float'>, aspectInv: Node<'float'>): Node<'vec3'> {
  const r = length(screenUV.sub(0.5).mul(vec2(1, aspectInv)));
  return c.mul(oneMinus(smoothstep(VIGNETTE.inner, VIGNETTE.outer, r).mul(strength))) as Node<'vec3'>;
}

/** CPU mirror of `gradeNode` for one channel. */
export function gradeChannel(c: number, lift: number, gamma: number, gain: number): number {
  const v = Math.pow(Math.max(0, c * gain + lift), 1 / gamma);
  return Math.min(1, Math.max(0, v));
}

/** CPU mirror of the vignette multiplier at screen uv (u, v). */
export function vignetteFactor(u: number, v: number, strength: number, aspectInv: number): number {
  const dx = u - 0.5;
  const dy = (v - 0.5) * aspectInv;
  const r = Math.sqrt(dx * dx + dy * dy);
  const k = Math.min(1, Math.max(0, (r - VIGNETTE.inner) / (VIGNETTE.outer - VIGNETTE.inner)));
  return 1 - k * k * (3 - 2 * k) * strength;
}
