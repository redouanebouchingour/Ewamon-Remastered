/**
 * Graphics quality presets (addition, IMPLEMENTATION-NOTES "Quality presets"). `high` is the §10 SPEC graph and
 * numbers unchanged; `medium` and `low` trade the costliest GPU work for frame time on weak GPUs (integrated Intel
 * parts first): the drawing-buffer pixel ratio, the sun's cascade resolution, GTAO, the tilt-shift DOF, bloom and the
 * water's backdrop.
 * Pure; the renderer applies a profile in `setQuality`, the client picks one (`recommendedQuality` for "auto").
 */
export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface QualityProfile {
  /** Upper bound of the drawing-buffer pixel ratio (§10.1.3's 1.5 at `high`). */
  readonly pixelRatioCap: number;
  /** Per-cascade sun shadow map edge (§10.3.1's 2048 at `high`); 4 cascades either way. */
  readonly sunShadowMap: number;
  /** GTAO in the post graph at all. */
  readonly gtao: boolean;
  /** GTAO samples per pixel (§10.8.3's 16 at `high`). */
  readonly gtaoSamples: number;
  /** Tilt-shift DOF allowed (the user's DOF toggle still applies on top). */
  readonly dof: boolean;
  /** Bloom allowed (the user's bloom toggle still applies on top): its mip chain is a dozen extra passes. */
  readonly bloom: boolean;
  /**
   * The water shows the bed and bank through it (`materials/waterBackdrop.ts`). Off: tint, caustics and foam only, and
   * no mid-pass copy of the scene. A uniform and a flag on the one water program: switching compiles nothing.
   */
  readonly waterBackdrop: boolean;
}

export const QUALITY_PROFILES: Readonly<Record<GraphicsQuality, QualityProfile>> = Object.freeze({
  high: Object.freeze({ pixelRatioCap: 1.5, sunShadowMap: 2048, gtao: true, gtaoSamples: 16, dof: true, bloom: true, waterBackdrop: true }),
  medium: Object.freeze({ pixelRatioCap: 1.25, sunShadowMap: 1024, gtao: true, gtaoSamples: 8, dof: true, bloom: true, waterBackdrop: false }),
  low: Object.freeze({ pixelRatioCap: 1, sunShadowMap: 1024, gtao: false, gtaoSamples: 8, dof: false, bloom: false, waterBackdrop: false }),
});

/**
 * An integrated Intel GPU from the adapter string (`RenderCaps.adapter`): WebGPU reports `intel` + an architecture
 * (`gen-9`, `gen-12lp`, `xe-lpg`, …), WebGL2 an ANGLE renderer string (`ANGLE (Intel, Intel(R) UHD Graphics 620 …)`).
 * Arc discrete cards (`xe-hpg`, "Arc") are excluded.
 */
export function isIntegratedIntel(adapter: string | null): boolean {
  if (adapter === null) return false;
  const a = adapter.toLowerCase();
  if (!a.includes('intel')) return false;
  return !/\barc\b|xe-hpg|xe2-hpg|alchemist|battlemage/.test(a);
}

/** The "auto" preset: `low` on integrated Intel, `medium` on the WebGL2 fallback, else `high`. */
export function recommendedQuality(caps: { readonly adapter: string | null; readonly backend: 'webgpu' | 'webgl2' }): GraphicsQuality {
  if (isIntegratedIntel(caps.adapter)) return 'low';
  return caps.backend === 'webgl2' ? 'medium' : 'high';
}
