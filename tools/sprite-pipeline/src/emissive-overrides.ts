/**
 * Per-species emissive tuning. Keys are species ids (or `<species>@<form>`).
 * Empty by default: the automatic saturation x lightness threshold is the baseline, and
 * an entry here is a deliberate art decision that should be reviewed on the contact sheet.
 */
export interface EmissiveOverride {
  /** Replace the default 0.72 saturation x lightness threshold. */
  threshold?: number;
  /** Emit nothing for this species. */
  disabled?: boolean;
}

export const EMISSIVE_OVERRIDES: Record<string, EmissiveOverride> = {};
