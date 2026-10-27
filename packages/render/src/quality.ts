/**
 * Graphics quality presets (addition, IMPLEMENTATION-NOTES "Quality presets"). `high` is the §10 SPEC graph and
 * numbers except the sun shadows and GTAO's cost (IMPLEMENTATION-NOTES "Cheaper shadows and reflections", "Cached sun shadows"); `medium` and `low` trade the costliest GPU work for frame time on weak GPUs (integrated Intel
 * parts first): the drawing-buffer pixel ratio, the sun's shadow map resolution, GTAO, the tilt-shift DOF, bloom
 * and the water's backdrop. Dropping GTAO / DOF also drops the scene pass's normal and mask targets
 * (`post/pipeline.ts` `sceneOutputs`).
 * Pure; the renderer applies a profile in `setQuality`, the client picks one (`recommendedQuality` for "auto").
 */
export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface QualityProfile {
  /** Upper bound of the drawing-buffer pixel ratio (§10.1.3's 1.5 at `high`). */
  readonly pixelRatioCap: number;
  /**
   * The sun's static shadow map edge (`lighting/sunShadow.ts`: a 144 m square, re-rendered about once a second; render
   * IMPLEMENTATION-NOTES "Cached sun shadows"). 4096 at `high` ≈ 3.5 cm a texel, the old near cascade's sharpness.
   */
  readonly sunShadowMap: number;
  /** The sun's actor shadow map edge (a 72 m square around the focus, actors and billboards only, every frame). */
  readonly actorShadowMap: number;
  /** GTAO in the post graph at all. */
  readonly gtao: boolean;
  /** GTAO samples per pixel (§10.8.3's 16; 8 on every preset since 2026-10-25). */
  readonly gtaoSamples: number;
  /** GTAO render scale (§10.8.3's 0.5; a quarter on every preset since 2026-10-25, temporally filtered under TRAA). */
  readonly gtaoScale: number;
  /** Tilt-shift DOF allowed (the user's DOF toggle still applies on top). */
  readonly dof: boolean;
  /** Bloom allowed (the user's bloom toggle still applies on top): its mip chain is a dozen extra passes. */
  readonly bloom: boolean;
  /**
   * The water shows the bed and bank through it (`materials/waterBackdrop.ts`). Off: tint, caustics and foam only, and
   * no mid-pass copy of the scene. A uniform and a flag on the one water program: switching compiles nothing.
   */
  readonly waterBackdrop: boolean;
  /**
   * The LOD distance multiplier (`zone/detail.ts`): scatter tiers and building levels switch at the SPEC's 40 / 90 /
   * 160 m times this. The diorama camera sits 20–34 m from the player, so below 1 the far half of the view drops a tier.
   */
  readonly lodScale: number;
}

export const QUALITY_PROFILES: Readonly<Record<GraphicsQuality, QualityProfile>> = Object.freeze({
  high: Object.freeze({ pixelRatioCap: 1.5, sunShadowMap: 4096, actorShadowMap: 2048, gtao: true, gtaoSamples: 8, gtaoScale: 0.25, dof: true, bloom: true, waterBackdrop: true, lodScale: 1 }),
  medium: Object.freeze({ pixelRatioCap: 1.25, sunShadowMap: 3072, actorShadowMap: 1536, gtao: true, gtaoSamples: 8, gtaoScale: 0.25, dof: true, bloom: true, waterBackdrop: false, lodScale: 0.8 }),
  low: Object.freeze({ pixelRatioCap: 1, sunShadowMap: 2048, actorShadowMap: 1024, gtao: false, gtaoSamples: 8, gtaoScale: 0.25, dof: false, bloom: false, waterBackdrop: false, lodScale: 0.6 }),
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

/**
 * The "auto" preset: `low` on integrated Intel and on the WebGL2 fallback (three's WebGL backend pays far more CPU per
 * draw, and a browser without WebGPU is usually an older or weaker machine), else `high`.
 */
export function recommendedQuality(caps: { readonly adapter: string | null; readonly backend: 'webgpu' | 'webgl2' }): GraphicsQuality {
  if (isIntegratedIntel(caps.adapter)) return 'low';
  return caps.backend === 'webgl2' ? 'low' : 'high';
}
