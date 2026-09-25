/**
 * SPEC §10.4.6 type colours — the legacy `TYPE_COLORS` verbatim. The billboard rim light, the arena
 * beacons, the VFX tint and the HUD type pips all read this table (or a colourblind replacement passed
 * through `BattleStage.setTypeColors`, 20-client.md §20.8.3). Pure (no `three` import).
 */
import { hexToSrgb, srgbToLinear } from '../lighting/color.js';
import type { TypeName } from '../contracts.js';

/** The 19 types in the spine §2.2 order. */
export const TYPE_NAMES: readonly TypeName[] = Object.freeze([
  'Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison',
  'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Steel',
  'Fairy', 'Dark', 'Cosmic',
] as const);

/** §10.4.6 table, verbatim (sRGB hex). */
export const TYPE_COLORS: Readonly<Record<TypeName, string>> = Object.freeze({
  Normal: '#a8a290', Fire: '#ee6f4a', Water: '#4aa3d6', Grass: '#6fae5a', Electric: '#f4cf3f', Ice: '#8fd6e8',
  Fighting: '#c0492f', Poison: '#9a5bb0', Ground: '#c9a24a', Flying: '#8aa6e0', Psychic: '#e06fa0', Bug: '#9aa83a',
  Rock: '#b09a6f', Ghost: '#6a5b9a', Dragon: '#6a52d0', Steel: '#9aa6b0', Fairy: '#f0a6d0', Dark: '#5b4b66',
  Cosmic: '#7be0d0',
});

export function isTypeName(s: string): s is TypeName {
  return (TYPE_NAMES as readonly string[]).includes(s);
}

/** A structural RGB sink (three's `Color` satisfies it). */
export interface RgbOut { r: number; g: number; b: number }

/** Writes the linear working-space colour of `hex` into `out` (no allocation). */
export function hexToLinearInto(hex: string, out: RgbOut): RgbOut {
  const [r, g, b] = hexToSrgb(hex);
  out.r = srgbToLinear(r); out.g = srgbToLinear(g); out.b = srgbToLinear(b);
  return out;
}

/**
 * Validates a replacement table (colourblind palettes): every type present, every value `#rrggbb`.
 * Returns a frozen copy so later mutation of the caller's object cannot reach the uniforms.
 */
export function validateTypeColorTable(table: Readonly<Record<TypeName, string>>): Readonly<Record<TypeName, string>> {
  const out = {} as Record<TypeName, string>;
  for (const t of TYPE_NAMES) {
    const hex = table[t];
    if (typeof hex !== 'string') throw new RangeError(`@ewa/render: type colour table misses '${t}'`);
    hexToSrgb(hex);   // throws RangeError on a malformed value
    out[t] = hex;
  }
  return Object.freeze(out);
}

/** The lowercase VFX suffix of a type (`type_${Lowercase<TypeName>}`). */
export function typeVfxSuffix(t: TypeName): Lowercase<TypeName> {
  return t.toLowerCase() as Lowercase<TypeName>;
}
