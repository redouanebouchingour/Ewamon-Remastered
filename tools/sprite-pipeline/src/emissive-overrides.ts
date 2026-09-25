/**
 * Per-species emissive tuning, keyed by species id. Empty by default: the automatic
 * bright-and-vivid rule with the coverage cap (`emissive.ts`) is the baseline, and an entry here
 * is a deliberate art decision reviewed on the contact sheet.
 */
export interface EmissiveOverride {
  /** Replace EMISSIVE_MIN_VALUE (HSV value, 0..1). */
  minValue?: number;
  /** Replace EMISSIVE_MIN_CHROMA (max − min, 0..1). */
  minChroma?: number;
  /** Replace EMISSIVE_MAX_COVERAGE (share of opaque texels). */
  maxCoverage?: number;
  /** Emit nothing for this species. */
  disabled?: boolean;
}

export const EMISSIVE_OVERRIDES: Record<string, EmissiveOverride> = {};
