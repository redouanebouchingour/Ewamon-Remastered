/**
 * Stage 4 — emissive mask.
 *
 * Per pixel HSL saturation x lightness >= threshold (0.72 by default) -> 1, else 0, followed
 * by a 1 px erosion (3x3 min) that kills single-pixel noise. Species can override the
 * threshold or disable the mask entirely via `emissive-overrides.ts`.
 */
import { EMISSIVE_OVERRIDES } from './emissive-overrides.js';
import type { EmissiveOverride } from './emissive-overrides.js';
import type { GrayImage, RgbaImage } from './types.js';
import { createGray } from './types.js';

export const DEFAULT_EMISSIVE_THRESHOLD = 0.72;

/** HSL saturation * lightness for an 8-bit RGB triple, in [0, 1]. */
export function saturationTimesLightness(r: number, g: number, b: number): number {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return 0;
  const denom = 1 - Math.abs(2 * l - 1);
  const s = denom <= 1e-6 ? 0 : (max - min) / denom;
  return s * l;
}

export function resolveEmissiveOverride(speciesId: string): EmissiveOverride {
  // `yaschamp@boxingstyle` inherits `yaschamp`'s override unless it has its own.
  const base = speciesId.split('@')[0]!;
  return EMISSIVE_OVERRIDES[speciesId] ?? EMISSIVE_OVERRIDES[base] ?? {};
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
  const threshold = override.threshold ?? DEFAULT_EMISSIVE_THRESHOLD;
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    if (data[i + 3]! === 0) continue;
    mask.data[p] = saturationTimesLightness(data[i]!, data[i + 1]!, data[i + 2]!) >= threshold ? 255 : 0;
  }
  return erode1px(mask);
}
