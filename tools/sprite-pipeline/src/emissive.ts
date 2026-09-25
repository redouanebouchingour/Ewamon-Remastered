/**
 * Stage 4 — emissive mask (spec §40.1.2 #4, as amended 2026-09-25).
 *
 * A texel emits when it is both bright and vivid: HSV value `max(r,g,b) >= EMISSIVE_MIN_VALUE`
 * and chroma `max − min >= EMISSIVE_MIN_CHROMA`. That is what a glowing lure, a flame or molten
 * seams look like, and what pale fur does not. (The previous rule, HSL saturation × lightness,
 * tends to 1 for any faintly tinted near-white — 42–49 % of `mufflo`/`dreambud` glowed — while a
 * pure saturated hue such as (255, 40, 40) scored 0.5 and never qualified.)
 *
 * The mask is an accent, never a body: when more than EMISSIVE_MAX_COVERAGE of the opaque texels
 * qualify (flame creatures), only the most vivid ones are kept (ranked by value × chroma, ties by
 * raster order). Then a 1 px erosion (3×3 min) removes single-texel noise. Species can tune or
 * disable the mask in `emissive-overrides.ts`; every entry is a reviewed art decision.
 */
import { EMISSIVE_OVERRIDES } from './emissive-overrides.js';
import type { EmissiveOverride } from './emissive-overrides.js';
import type { GrayImage, RgbaImage } from './types.js';
import { createGray } from './types.js';

export const EMISSIVE_MIN_VALUE = 0.92;
export const EMISSIVE_MIN_CHROMA = 0.4;
/** Share of opaque texels (a >= 128) the mask may cover before it is cut to the most vivid. */
export const EMISSIVE_MAX_COVERAGE = 0.08;

/** HSV value × chroma for an 8-bit RGB triple, in [0, 1]; 0 when the texel does not qualify. */
export function emissiveScore(r: number, g: number, b: number, minValue = EMISSIVE_MIN_VALUE, minChroma = EMISSIVE_MIN_CHROMA): number {
  const max = Math.max(r, g, b) / 255;
  const chroma = max - Math.min(r, g, b) / 255;
  return max >= minValue && chroma >= minChroma ? max * chroma : 0;
}

export function resolveEmissiveOverride(speciesId: string): EmissiveOverride {
  return EMISSIVE_OVERRIDES[speciesId] ?? {};
}

export function erode1px(mask: GrayImage): GrayImage {
  const { width, height, data } = mask;
  const out = createGray(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let v = 255;
      for (let dy = -1; dy <= 1 && v; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) {
          v = 0;
          break;
        }
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width || data[yy * width + xx] === 0) {
            v = 0;
            break;
          }
        }
      }
      out.data[y * width + x] = v;
    }
  }
  return out;
}

export function deriveEmissive(src: RgbaImage, override: EmissiveOverride = {}): GrayImage {
  const { width, height, data } = src;
  const mask = createGray(width, height);
  if (override.disabled) return mask;
  const minValue = override.minValue ?? EMISSIVE_MIN_VALUE;
  const minChroma = override.minChroma ?? EMISSIVE_MIN_CHROMA;
  const maxCoverage = override.maxCoverage ?? EMISSIVE_MAX_COVERAGE;
  let opaque = 0;
  const cand: Array<{ p: number; s: number }> = [];
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    if (data[i + 3]! < 128) continue;
    opaque++;
    const s = emissiveScore(data[i]!, data[i + 1]!, data[i + 2]!, minValue, minChroma);
    if (s > 0) cand.push({ p, s });
  }
  const cap = Math.floor(maxCoverage * opaque);
  if (cand.length > cap) cand.sort((a, b) => b.s - a.s || a.p - b.p);
  const keep = Math.min(cand.length, cap);
  for (let k = 0; k < keep; k++) mask.data[cand[k]!.p] = 255;
  return erode1px(mask);
}
