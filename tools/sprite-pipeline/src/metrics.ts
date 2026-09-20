/**
 * Image-error metrics shared by `cli bench` (the numbers in README.md) and the encoding
 * acceptance tests (`test/encoding.test.ts`). Everything is computed over straight RGBA.
 *
 * Definitions (spec §40.1.6.1 / §40.1.6.4):
 *   hard edge   a texel with a step > 48/255 in any RGB channel to one of its 4 neighbours,
 *               or an opaque texel next to a transparent one
 *   bad         any channel error > 12
 *   opaque      a = 255
 */
import type { RgbaImage } from './types.js';

export interface Crop {
  x: number;
  y: number;
  size: number;
}

export interface ErrorStats {
  /** PSNR over RGB of opaque texels (∞ → 99). */
  psnr: number;
  /** Max per-channel error over texels with a > 0. */
  maxErr: number;
  /** Max Rec. 709 luma error over opaque texels. */
  maxLumaErr: number;
  /** Share of hard-edge opaque texels with a channel error > 12. */
  edgeBad: number;
  /** Share of interior (non-edge) opaque texels with a channel error > 12. */
  interiorBad: number;
  /** Texels whose alpha differs at all. */
  alphaMismatch: number;
  edgeCount: number;
  interiorCount: number;
}

export const HARD_EDGE_STEP = 48;
export const BAD_ERROR = 12;

function idx(img: RgbaImage, x: number, y: number): number {
  return (y * img.width + x) * 4;
}

/** True when (x, y) is opaque and has a hard colour or alpha step to a 4-neighbour. */
export function isHardEdge(img: RgbaImage, x: number, y: number): boolean {
  const i = idx(img, x, y);
  const d = img.data;
  if (d[i + 3] !== 255) return false;
  const nb = [
    x > 0 ? i - 4 : -1,
    x < img.width - 1 ? i + 4 : -1,
    y > 0 ? i - img.width * 4 : -1,
    y < img.height - 1 ? i + img.width * 4 : -1,
  ];
  for (const j of nb) {
    if (j < 0) continue;
    if (d[j + 3]! === 0) return true;
    for (let c = 0; c < 3; c++) if (Math.abs(d[i + c]! - d[j + c]!) > HARD_EDGE_STEP) return true;
  }
  return false;
}

export function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Error statistics of `b` against the reference `a`, optionally restricted to a crop. */
export function errorStats(a: RgbaImage, b: RgbaImage, crop?: Crop): ErrorStats {
  if (a.width !== b.width || a.height !== b.height) throw new Error(`errorStats: size mismatch ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  const x0 = crop ? crop.x : 0;
  const y0 = crop ? crop.y : 0;
  const x1 = crop ? Math.min(a.width, crop.x + crop.size) : a.width;
  const y1 = crop ? Math.min(a.height, crop.y + crop.size) : a.height;
  let se = 0;
  let n = 0;
  let maxErr = 0;
  let maxLumaErr = 0;
  let edgeCount = 0;
  let edgeBad = 0;
  let interiorCount = 0;
  let interiorBad = 0;
  let alphaMismatch = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = idx(a, x, y);
      const alpha = a.data[i + 3]!;
      if (alpha !== b.data[i + 3]) alphaMismatch++;
      if (alpha === 0) continue;
      let pixMax = 0;
      for (let c = 0; c < 3; c++) {
        const e = Math.abs(a.data[i + c]! - b.data[i + c]!);
        if (e > pixMax) pixMax = e;
      }
      if (pixMax > maxErr) maxErr = pixMax;
      if (alpha !== 255) continue;
      for (let c = 0; c < 3; c++) {
        const e = a.data[i + c]! - b.data[i + c]!;
        se += e * e;
      }
      n += 3;
      const le = Math.abs(luma(a.data[i]!, a.data[i + 1]!, a.data[i + 2]!) - luma(b.data[i]!, b.data[i + 1]!, b.data[i + 2]!));
      if (le > maxLumaErr) maxLumaErr = le;
      if (isHardEdge(a, x, y)) {
        edgeCount++;
        if (pixMax > BAD_ERROR) edgeBad++;
      } else {
        interiorCount++;
        if (pixMax > BAD_ERROR) interiorBad++;
      }
    }
  }
  const mse = n ? se / n : 0;
  return {
    psnr: mse === 0 ? 99 : 10 * Math.log10((255 * 255) / mse),
    maxErr,
    maxLumaErr,
    edgeBad: edgeCount ? edgeBad / edgeCount : 0,
    interiorBad: interiorCount ? interiorBad / interiorCount : 0,
    alphaMismatch,
    edgeCount,
    interiorCount,
  };
}

/**
 * The `size`² crop (clamped to the image) centred on the opaque texel with the largest
 * 4-neighbour RGB step inside `region` — "a crop containing a hard pixel edge".
 */
export function hardestEdgeCrop(img: RgbaImage, size: number, region?: Crop): Crop {
  const rx0 = region ? region.x : 0;
  const ry0 = region ? region.y : 0;
  const rx1 = region ? Math.min(img.width, region.x + region.size) : img.width;
  const ry1 = region ? Math.min(img.height, region.y + region.size) : img.height;
  let best = -1;
  let bx = rx0;
  let by = ry0;
  const d = img.data;
  for (let y = ry0 + 1; y < ry1 - 1; y++) {
    for (let x = rx0 + 1; x < rx1 - 1; x++) {
      const i = idx(img, x, y);
      if (d[i + 3] !== 255) continue;
      let step = 0;
      for (const j of [i - 4, i + 4, i - img.width * 4, i + img.width * 4]) {
        if (d[j + 3] !== 255) continue; // colour steps only: alpha edges are exact anyway
        for (let c = 0; c < 3; c++) step = Math.max(step, Math.abs(d[i + c]! - d[j + c]!));
      }
      if (step > best) {
        best = step;
        bx = x;
        by = y;
      }
    }
  }
  const half = size >> 1;
  const x = Math.max(rx0, Math.min(rx1 - size, bx - half));
  const y = Math.max(ry0, Math.min(ry1 - size, by - half));
  return { x, y, size };
}

/** Decoded normal vector from an (R, G, B) encoding. */
function decodeNormal(r: number, g: number, b: number): [number, number, number] {
  const x = r / 127 - 128 / 127;
  const y = g / 127 - 128 / 127;
  const z = b / 127 - 128 / 127;
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

export interface AngularStats {
  /** Mean angular error in degrees over opaque texels (a = 255 in the reference). */
  meanDeg: number;
  /** Mean angular error over opaque texels within `band` px of a transparent texel. */
  bandMeanDeg: number;
  maxDeg: number;
  count: number;
  bandCount: number;
}

/**
 * Mean angular error of `test` against `ref` (same size; both normal encodings). `band`
 * is a per-texel distance-to-edge field (px) used to isolate the bevel band; texels with
 * `band[p] < bandPx` count toward `bandMeanDeg`.
 */
export function angularError(ref: RgbaImage, test: RgbaImage, band: Float32Array | null, bandPx: number): AngularStats {
  if (ref.width !== test.width || ref.height !== test.height) throw new Error('angularError: size mismatch');
  let sum = 0;
  let n = 0;
  let bandSum = 0;
  let bandN = 0;
  let max = 0;
  for (let p = 0; p < ref.width * ref.height; p++) {
    const i = p * 4;
    if (ref.data[i + 3] !== 255) continue;
    const a = decodeNormal(ref.data[i]!, ref.data[i + 1]!, ref.data[i + 2]!);
    const b = decodeNormal(test.data[i]!, test.data[i + 1]!, test.data[i + 2]!);
    const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    const deg = (Math.acos(dot) * 180) / Math.PI;
    sum += deg;
    n++;
    if (deg > max) max = deg;
    if (band && band[p]! < bandPx) {
      bandSum += deg;
      bandN++;
    }
  }
  return { meanDeg: n ? sum / n : 0, bandMeanDeg: bandN ? bandSum / bandN : 0, maxDeg: max, count: n, bandCount: bandN };
}
