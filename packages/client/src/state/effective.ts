/**
 * SPEC §20.8.2 — effective reduced effects. Accessibility always wins (§20.0 rule 5): when the result is
 * true, grain / chroma / shake / hitstop / slow-mo / DOF are off regardless of the graphics toggles.
 * Bloom stays available because it is static. Pure; the verbatim functions of the spec.
 */
import type { EffectsFlags } from '@ewa/render';
import type { SettingsData } from './settings';

export function effectiveReduced(s: Pick<SettingsData, 'accessibility' | 'graphics'>, systemPrefersReduced: boolean): boolean {
  return (
    s.accessibility.reducedMotion === 'on' ||
    (s.accessibility.reducedMotion === 'system' && systemPrefersReduced) ||
    s.graphics.reducedEffects
  );
}

export function effectsFlags(s: Pick<SettingsData, 'graphics'>, reduced: boolean): EffectsFlags {
  return reduced
    ? { dof: false, bloom: s.graphics.bloom, grain: false, chroma: false, shake: false, hitstop: false, slowmo: false, taa: true }
    : {
        dof: s.graphics.dof,
        bloom: s.graphics.bloom,
        grain: s.graphics.grain,
        chroma: s.graphics.chroma,
        shake: s.graphics.shake,
        hitstop: s.graphics.hitstop,
        slowmo: s.graphics.slowmo,
        taa: true,
      };
}

/** The graphics toggles that render disabled with "Off: reduced motion" while reduced is true. */
export const REDUCED_LOCKED = ['dof', 'grain', 'chroma', 'shake', 'hitstop', 'slowmo'] as const satisfies readonly (keyof EffectsFlags)[];
