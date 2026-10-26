/**
 * Shiny palettes (spine §3.7a): every evolution family has a derived palette (`shinyDerived.ts`, written by
 * `pnpm --filter @ewa/sprite-pipeline shiny` from the thumbnails), every tuning key names a species, and every shiny
 * hue keeps ≥ 30° from each variant's, so a shiny never reads as a normal / dawn / dusk / verdant / ember creature.
 */
import { describe, expect, it } from 'vitest';
import { SHINY_DERIVED, SHINY_TUNING, SPECIES, VARIANT_PALETTES, evolutionRoot, shinyPaletteOf } from '../src/index';

const gap = (a: number, b: number): number => { const d = Math.abs((((a - b) % 360) + 360) % 360); return Math.min(d, 360 - d); };

describe('shiny palettes', () => {
  it('every family root has a derived palette (re-run the sprite-pipeline `shiny` script after adding a species)', () => {
    const missing = [...new Set(SPECIES.map((s) => evolutionRoot(s.id)))].filter((r) => SHINY_DERIVED[r] === undefined);
    expect(missing).toEqual([]);
  });

  it('derived keys are family roots and tuning keys are species ids', () => {
    const ids = new Set(SPECIES.map((s) => s.id));
    for (const k of Object.keys(SHINY_DERIVED)) expect(evolutionRoot(k), k).toBe(k);
    for (const k of Object.keys(SHINY_TUNING)) expect(ids.has(k), k).toBe(true);
  });

  it('every shiny hue stays clear of the variant hues; multipliers stay in range', () => {
    const variantHues = Object.values(VARIANT_PALETTES).map((p) => (p === null ? 0 : p.hue));
    for (const s of SPECIES) {
      const p = shinyPaletteOf(s.id);
      for (const v of variantHues) expect(gap(p.hue, v), `${s.id} vs ${v}`).toBeGreaterThanOrEqual(30);
      expect(p.hue).toBeGreaterThanOrEqual(-180);
      expect(p.hue).toBeLessThanOrEqual(180);
      expect(p.saturation).toBeGreaterThan(0.5);
      expect(p.saturation).toBeLessThanOrEqual(2.5);
      expect(p.lightness).toBeGreaterThanOrEqual(0.6);
      expect(p.lightness).toBeLessThanOrEqual(1.6);
    }
  });

  it('a family shares one palette unless a member is tuned on its own', () => {
    for (const s of SPECIES) {
      if (SHINY_TUNING[s.id] !== undefined && s.id !== evolutionRoot(s.id)) continue;
      expect(shinyPaletteOf(s.id), s.id).toEqual(shinyPaletteOf(evolutionRoot(s.id)));
    }
  });
});
