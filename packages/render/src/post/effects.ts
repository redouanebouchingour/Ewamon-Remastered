/**
 * SPEC §10.8.4 — `ReducedEffects` always wins. Pure helpers (node-tested).
 *
 * The client computes `EffectsFlags` through `effectsFlags(settings, reduced)` (20-client.md §20.8.2);
 * render enforces the same on its side: refused shake, coerced time scale, and absent (not zeroed)
 * post nodes for dof / grain / chroma.
 */
import type { EffectsFlags } from '../descriptors.js';

/** The members `reduced` switches off (§10.8.4: "reduced sets dof/grain/chroma/shake/hitstop/slowmo = false"). */
export const REDUCED_OFF: readonly (keyof EffectsFlags)[] = Object.freeze(['dof', 'grain', 'chroma', 'shake', 'hitstop', 'slowmo'] as const);

/** Applies the reduced-effects strip. Bloom and TRAA stay (static; Pillar 8 lists exactly these). */
export function applyReducedEffects(f: EffectsFlags): EffectsFlags {
  return Object.freeze({ ...f, dof: false, grain: false, chroma: false, shake: false, hitstop: false, slowmo: false });
}

/** Whether `f` already satisfies the reduced strip. */
export function isReduced(f: EffectsFlags): boolean {
  return REDUCED_OFF.every((k) => f[k] === false);
}

export function effectsEqual(a: EffectsFlags, b: EffectsFlags): boolean {
  return a.dof === b.dof && a.bloom === b.bloom && a.grain === b.grain && a.chroma === b.chroma
    && a.shake === b.shake && a.hitstop === b.hitstop && a.slowmo === b.slowmo && a.taa === b.taa;
}

/**
 * §10.8.4: `setTimeScale(s)` with `s !== 1` is coerced to 1 when its flag is off, "so a stale timeline
 * frame cannot freeze the render clock". Interpretation (notes): `s === 0` is hitstop (gated by
 * `f.hitstop`), any other `s !== 1` is slow-motion (gated by `f.slowmo`); with both off — the reduced
 * strip — every `s !== 1` becomes 1, which is the Pillar 8 assertion. Non-finite or negative → 1.
 */
export function coerceTimeScale(s: number, f: EffectsFlags): number {
  if (!Number.isFinite(s) || s < 0) return 1;
  if (s === 1) return 1;
  if (s === 0) return f.hitstop ? 0 : 1;
  return f.slowmo ? s : 1;
}

/** Camera shake is written only when `f.shake` (§10.7.2: "returns before writing anything"). */
export function shakeAllowed(f: EffectsFlags): boolean {
  return f.shake;
}
