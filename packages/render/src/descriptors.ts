/**
 * Plain-data descriptors shared across `@ewa/render` (SPEC §10.0.2: "every `descriptors` type is
 * pure TypeScript with no `three` object construction", so node tests can import this file).
 *
 * Declarations marked "verbatim" are text-identical to the SPEC blocks they cite. Mirrors of
 * spine / client types are allowed by §50.7 rule 5 because render may not import `@ewa/*`.
 */

/** From 20-client.md §20.4.1, verbatim (SPEC §10.1.1). */
export interface EffectsFlags {
  readonly dof: boolean; readonly bloom: boolean; readonly grain: boolean; readonly chroma: boolean;
  readonly shake: boolean; readonly hitstop: boolean; readonly slowmo: boolean; readonly taa: boolean;
}

/** Every effect on: the default when the client has not yet computed `effectsFlags(settings, reduced)`. */
export const ALL_EFFECTS: EffectsFlags = Object.freeze({
  dof: true, bloom: true, grain: true, chroma: true, shake: true, hitstop: true, slowmo: true, taa: true,
});

export type Backend = 'webgpu' | 'webgl2';

/** SPEC §10.1.1, verbatim. */
export interface RenderCaps {
  readonly backend: Backend;
  readonly timestampQuery: boolean;            // renderer.hasFeature('timestamp-query') on webgpu; false on webgl2
  readonly maxTextureSize: number;             // 8192 minimum required; createRenderer rejects below
  readonly ktx2: 'astc' | 'bc7' | 'etc2' | 'rgba8';   // KTX2Loader.workerConfig -> chosen transcode target
  readonly adapter: string | null;             // GPUAdapterInfo.description when exposed; null otherwise
}

export type WeatherKind = 'none' | 'sun' | 'rain' | 'sand' | 'hail';   // text-identical mirror of spine §2.5 (render may not import core)
export type HarvestLevel = 0 | 1 | 2;                                 // intact · thinning · harvested

/** 50-verification-budget.md §50.2.3, verbatim. */
export type BudgetPass =
  | 'opaque' | 'sprites' | 'shadows' | 'gtao' | 'traa' | 'bloom' | 'dof' | 'grade';

/** Every `BudgetPass`, in the §50.2.1 row order. */
export const BUDGET_PASSES: readonly BudgetPass[] = Object.freeze([
  'opaque', 'sprites', 'shadows', 'gtao', 'traa', 'bloom', 'dof', 'grade',
] as const);

/** 50-verification-budget.md §50.2.3, verbatim. */
export interface BudgetCounts {
  readonly drawCalls: number;        // renderer.info.render.drawCalls
  readonly triangles: number;        // renderer.info.render.triangles
  readonly texturesSize: number;     // renderer.info.memory.texturesSize (bytes)
  readonly textures: number;         // renderer.info.memory.textures
  readonly geometries: number;       // renderer.info.memory.geometries
  readonly programs: number;         // renderer.info.memory.programs
  readonly renderTargets: number;    // renderer.info.memory.renderTargets
  readonly attributes: number;       // renderer.info.memory.attributes
  readonly attributesSize: number;   // renderer.info.memory.attributesSize
  readonly materials: number;        // distinct Material.uuid under the zone root, debug layer excluded
  readonly shadowLights: number;
  readonly nonShadowLights: number;
}

/** SPEC §10.1.1, verbatim. */
export interface RenderStats {
  readonly drawCalls: number; readonly triangles: number;
  readonly textures: number; readonly textureBytes: number; readonly geometries: number; readonly programs: number; readonly renderTargets: number;
  readonly materials: number;                  // distinct Material.uuid under the zone root, debug layer excluded
  readonly shadowLights: number; readonly nonShadowLights: number;
  readonly gpuMs: number | null;               // last resolved whole-frame GPU ms; null without timestamp-query
  readonly passMs: Readonly<Record<BudgetPass, number | null>>; // filled only by the differential harness (§10.10.3); null in play
  readonly frameMs: number;                    // CPU ms of the last frame() call
}

/** SPEC §10.3.2, verbatim. */
export type LightKind = 'lamp' | 'lantern' | 'brazier' | 'forge' | 'lava' | 'beacon' | 'window' | 'crystal' | 'candle' | 'fire';

/** SPEC §10.3.2, verbatim. */
export interface LightSource {
  readonly id: string;
  readonly kind: LightKind;
  readonly color: string;                  // sRGB hex
  readonly intensity: number;              // candela-scaled three intensity at night; day multiplier from §10.3.5
  readonly position: readonly [number, number, number];
  readonly castShadow: boolean;            // ≤ 8 true per zone
  readonly range: number;                  // PointLight.distance / SpotLight.distance; decay 2
  readonly housing: HousingRef;            // the emissive mesh within 0.6 u of `position` (Pillar 4)
  readonly flicker: { readonly amplitude: number; readonly hz: number } | null;   // brazier/forge/lava/candle/fire
}
export type HousingRef = { readonly kind: 'generated'; readonly generator: 'lantern' | 'brazier' | 'beacon' | 'window' | 'crystal' | 'candle'; readonly seed: number }
                        | { readonly kind: 'mesh'; readonly meshId: string };     // a prop already placed (lava pool, forge)

/** SPEC §10.3.2, verbatim. */
export const LIGHT_BUDGET = { shadowCasters: 8, nonShadow: 24 } as const;

/**
 * Object layers used across the package. SPEC §10.3.3 (sky 30), §10.3.6 (rain sheet 29),
 * §10.4.7 (decals 28), §10.10.1 (billboards 27), §10.2.7 (debug 31). Layer 0 is the default.
 */
export const LAYERS = Object.freeze({
  default: 0,
  /**
   * Zone meshes whose programs are not compiled yet (IMPLEMENTATION-NOTES Part 5, T4): the scene camera does not render
   * this layer (so a frame never compiles them synchronously); the renderer enables it only inside a compile prologue.
   */
  compileGate: 26,
  billboards: 27,
  decals: 28,
  fx: 29,
  sky: 30,
  debug: 31,
} as const);
