/**
 * Pipeline-built mip chains (spec §40.1.6.3) and the half-resolution normal atlas.
 *
 *   albedo    2×2 box filter in PREMULTIPLIED space, un-premultiplied on write; alpha is
 *             rescaled per 1024²-cell so that the fraction of texels with a >= 128 equals
 *             level 0's (coverage-preserving: `alphaTest 0.5` does not thin creatures at
 *             distance). A texel whose whole footprint is transparent stays a = 0.
 *   normal    same filter on the encoded vectors, then renormalised; a transparent texel
 *             encodes the flat normal (128, 128, 255).
 *   emissive  the two-valued mask stays two-valued: footprint mean >= 127.5 -> 255.
 *
 * Everything here is integer/float arithmetic over rasters — no library resampler — so the
 * chain is deterministic to the byte.
 */
import sharp from 'sharp';
import type { GrayImage, RgbaImage } from './types.js';
import { createGray, createRgba } from './types.js';

/** Straight RGB + float alpha (0..255), the working form of a downsampled level. */
export interface FloatAlphaImage {
  width: number;
  height: number;
  rgb: Uint8Array;
  alpha: Float32Array;
}

export function toFloatAlpha(img: RgbaImage): FloatAlphaImage {
  const n = img.width * img.height;
  const rgb = new Uint8Array(n * 3);
  const alpha = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    rgb[p * 3] = img.data[p * 4]!;
    rgb[p * 3 + 1] = img.data[p * 4 + 1]!;
    rgb[p * 3 + 2] = img.data[p * 4 + 2]!;
    alpha[p] = img.data[p * 4 + 3]!;
  }
  return { width: img.width, height: img.height, rgb, alpha };
}

/** 2×2 premultiplied box filter. Output alpha is the footprint mean (float, unscaled). */
export function boxDownPremultiplied(src: FloatAlphaImage): FloatAlphaImage {
  const w = src.width >> 1;
  const h = src.height >> 1;
  const rgb = new Uint8Array(w * h * 3);
  const alpha = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sa = 0;
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let pr = 0;
      let pg = 0;
      let pb = 0;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const p = (y * 2 + dy) * src.width + (x * 2 + dx);
          const a = src.alpha[p]!;
          const r = src.rgb[p * 3]!;
          const g = src.rgb[p * 3 + 1]!;
          const b = src.rgb[p * 3 + 2]!;
          sa += a;
          sr += r * a;
          sg += g * a;
          sb += b * a;
          pr += r;
          pg += g;
          pb += b;
        }
      }
      const o = y * w + x;
      alpha[o] = sa / 4;
      if (sa > 0) {
        rgb[o * 3] = Math.round(sr / sa);
        rgb[o * 3 + 1] = Math.round(sg / sa);
        rgb[o * 3 + 2] = Math.round(sb / sa);
      } else {
        // Fully transparent footprint: plain mean keeps the stage-1 transparent RGB continuous.
        rgb[o * 3] = Math.round(pr / 4);
        rgb[o * 3 + 1] = Math.round(pg / 4);
        rgb[o * 3 + 2] = Math.round(pb / 4);
      }
    }
  }
  return { width: w, height: h, rgb, alpha };
}

/** Fraction of texels with a >= 128 over a region. */
export function coverageFraction(alpha: ArrayLike<number>, width: number, x0: number, y0: number, w: number, h: number, scale = 1): number {
  let n = 0;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (Math.min(255, Math.round(alpha[y * width + x]! * scale)) >= 128) n++;
    }
  }
  return n / (w * h);
}

/** Alpha is only ever lifted: scaling below 1 would make opaque interiors translucent. */
export const COVERAGE_SCALE_MIN = 1;
export const COVERAGE_SCALE_MAX = 8;

/**
 * The alpha scale for a region such that `fraction(a * s >= 128)` is as close as possible to
 * `target` (never below it). The k-th largest alpha (k = round(target * N)) is lifted onto
 * the threshold; monotone, deterministic, no search.
 */
export function coverageScale(alpha: Float32Array, width: number, x0: number, y0: number, w: number, h: number, target: number): number {
  const values: number[] = [];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) values.push(alpha[y * width + x]!);
  values.sort((a, b) => b - a);
  const k = Math.round(target * values.length);
  if (k <= 0) return 1;
  const kth = values[Math.min(values.length, k) - 1]!;
  if (kth <= 0) return COVERAGE_SCALE_MAX;
  // Lift the k-th largest just onto the threshold so exactly k texels pass after rounding.
  const s = 127.5 / kth;
  return Math.min(COVERAGE_SCALE_MAX, Math.max(COVERAGE_SCALE_MIN, s));
}

/** Quantises a float-alpha level to straight RGBA, applying a per-cell alpha scale. */
export function quantize(level: FloatAlphaImage, cell: number, scales: Float32Array): RgbaImage {
  const out = createRgba(level.width, level.height);
  const cellsX = level.width / cell;
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      const p = y * level.width + x;
      const s = scales[Math.floor(y / cell) * cellsX + Math.floor(x / cell)]!;
      out.data[p * 4] = level.rgb[p * 3]!;
      out.data[p * 4 + 1] = level.rgb[p * 3 + 1]!;
      out.data[p * 4 + 2] = level.rgb[p * 3 + 2]!;
      out.data[p * 4 + 3] = Math.min(255, Math.round(level.alpha[p]! * s));
    }
  }
  return out;
}

/**
 * Levels 1..`levels` of `level0` with coverage preserved per `cell`-sized region (the cell
 * shrinks with each level; `cell` is given in level-0 texels).
 */
export function buildAlphaMipChain(level0: RgbaImage, levels: number, cell: number): RgbaImage[] {
  const cellsX = level0.width / cell;
  const cellsY = level0.height / cell;
  const targets = new Float32Array(cellsX * cellsY);
  const f0 = toFloatAlpha(level0);
  for (let cy = 0; cy < cellsY; cy++) {
    for (let cx = 0; cx < cellsX; cx++) {
      targets[cy * cellsX + cx] = coverageFraction(f0.alpha, f0.width, cx * cell, cy * cell, cell, cell);
    }
  }
  const out: RgbaImage[] = [];
  let cur = f0;
  let c = cell;
  for (let l = 1; l <= levels; l++) {
    cur = boxDownPremultiplied(cur);
    c >>= 1;
    const scales = new Float32Array(cellsX * cellsY);
    for (let cy = 0; cy < cellsY; cy++) {
      for (let cx = 0; cx < cellsX; cx++) {
        scales[cy * cellsX + cx] = coverageScale(cur.alpha, cur.width, cx * c, cy * c, c, c, targets[cy * cellsX + cx]!);
      }
    }
    out.push(quantize(cur, c, scales));
  }
  return out;
}

/** Normalises every texel's encoded normal in place; transparent texels become (128,128,255). */
export function renormalize(img: RgbaImage): RgbaImage {
  const n = img.width * img.height;
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (img.data[i + 3] === 0) {
      img.data[i] = 128;
      img.data[i + 1] = 128;
      img.data[i + 2] = 255;
      continue;
    }
    const x = (img.data[i]! - 128) / 127;
    const y = (img.data[i + 1]! - 128) / 127;
    const z = (img.data[i + 2]! - 128) / 127;
    const len = Math.hypot(x, y, z);
    if (len < 1e-6) {
      img.data[i] = 128;
      img.data[i + 1] = 128;
      img.data[i + 2] = 255;
      continue;
    }
    img.data[i] = Math.round(128 + (x / len) * 127);
    img.data[i + 1] = Math.round(128 + (y / len) * 127);
    img.data[i + 2] = Math.round(128 + (z / len) * 127);
  }
  return img;
}

/**
 * The half-resolution normal atlas: lanczos3 downsample of the level-0 normal (premultiplied
 * by sharp, so transparent texels do not bleed), then renormalised.
 */
export async function halfResolutionNormal(level0: RgbaImage): Promise<RgbaImage> {
  const { data, info } = await sharp(Buffer.from(level0.data.buffer, level0.data.byteOffset, level0.data.byteLength), {
    raw: { width: level0.width, height: level0.height, channels: 4 },
  })
    .resize(level0.width >> 1, level0.height >> 1, { kernel: 'lanczos3', fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return renormalize({ width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) });
}

/** Normal mip chain: premultiplied box filter + renormalise, same coverage rule as albedo. */
export function buildNormalMipChain(level0: RgbaImage, levels: number, cell: number): RgbaImage[] {
  return buildAlphaMipChain(level0, levels, cell).map(renormalize);
}

/** Emissive mask mip chain: majority of the 2×2 footprint, stays exactly 0 / 255. */
export function buildMaskMipChain(level0: GrayImage, levels: number): GrayImage[] {
  const out: GrayImage[] = [];
  let cur = level0;
  for (let l = 1; l <= levels; l++) {
    const w = cur.width >> 1;
    const h = cur.height >> 1;
    const next = createGray(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * 2 * cur.width + x * 2;
        const sum = cur.data[p]! + cur.data[p + 1]! + cur.data[p + cur.width]! + cur.data[p + cur.width + 1]!;
        next.data[y * w + x] = sum >= 510 ? 255 : 0;
      }
    }
    out.push(next);
    cur = next;
  }
  return out;
}
