/**
 * Stage 3 — derived tangent-space normal map.
 *
 *   luminance -> height (gaussian blur, sigma 1.2) -> Sobel 3x3 (strength 0.55)
 *   + alpha-edge bevel: a chamfer distance transform over alpha (6 px band) tilts normals
 *     outward near the silhouette so rim lights catch the edge.
 *
 * Encoding: R = 128 + nx*127, G = 128 + ny*127 (OpenGL +Y up), B = 128 + nz*127.
 * A perfectly flat region encodes to exactly (128, 128, 255). Alpha = source alpha.
 * Transparent neighbours are treated as having the centre pixel's height, so the Sobel
 * term never fires across the silhouette — only the bevel does.
 */
import type { RgbaImage } from './types.js';
import { createRgba } from './types.js';

export interface NormalMapOptions {
  sigma: number;
  strength: number;
  bevelBand: number;
  /** Tilt of the bevel normal at the very edge, 0..1 (1 = fully sideways). */
  bevelStrength: number;
}

export const DEFAULT_NORMAL_OPTIONS: NormalMapOptions = {
  sigma: 1.2,
  strength: 0.55,
  bevelBand: 6,
  bevelStrength: 0.85,
};

export function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function gaussianKernel(sigma: number): Float32Array {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float32Array(radius * 2 + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k[i + radius] = v;
    sum += v;
  }
  for (let i = 0; i < k.length; i++) k[i] = k[i]! / sum;
  return k;
}

/** Separable gaussian blur of a float field, clamping at the borders. */
export function gaussianBlur(field: Float32Array, width: number, height: number, sigma: number): Float32Array {
  const k = gaussianKernel(sigma);
  const radius = (k.length - 1) / 2;
  const tmp = new Float32Array(field.length);
  const out = new Float32Array(field.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let i = -radius; i <= radius; i++) {
        const xx = Math.min(width - 1, Math.max(0, x + i));
        acc += field[y * width + xx]! * k[i + radius]!;
      }
      tmp[y * width + x] = acc;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let i = -radius; i <= radius; i++) {
        const yy = Math.min(height - 1, Math.max(0, y + i));
        acc += tmp[yy * width + x]! * k[i + radius]!;
      }
      out[y * width + x] = acc;
    }
  }
  return out;
}

/**
 * Chamfer (3-4) distance transform: for every pixel with alpha > 0, the approximate
 * distance in pixels to the nearest transparent pixel (or image edge). Transparent = 0.
 */
export function chamferDistance(alpha: Uint8Array, width: number, height: number, cap: number): Float32Array {
  const INF = cap * 10;
  const d = new Float32Array(width * height);
  for (let i = 0; i < d.length; i++) d[i] = alpha[i]! > 0 ? INF : 0;
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= width || y >= height ? 0 : d[y * width + x]!);
  // Forward pass.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (d[i] === 0) continue;
      let v = d[i]!;
      v = Math.min(v, at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
      d[i] = v;
    }
  }
  // Backward pass.
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (d[i] === 0) continue;
      let v = d[i]!;
      v = Math.min(v, at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
      d[i] = v;
    }
  }
  for (let i = 0; i < d.length; i++) d[i] = Math.min(cap, d[i]! / 3);
  return d;
}

export function deriveNormalMap(src: RgbaImage, opts: NormalMapOptions = DEFAULT_NORMAL_OPTIONS): RgbaImage {
  const { width, height, data } = src;
  const n = width * height;
  const alpha = new Uint8Array(n);
  const heightField = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    alpha[p] = data[i + 3]!;
    heightField[p] = luminance(data[i]!, data[i + 1]!, data[i + 2]!);
  }
  const h = gaussianBlur(heightField, width, height, opts.sigma);
  const dist = chamferDistance(alpha, width, height, opts.bevelBand);

  const out = createRgba(width, height);
  const H = (x: number, y: number, cx: number, cy: number): number => {
    if (x < 0 || y < 0 || x >= width || y >= height) return h[cy * width + cx]!;
    const p = y * width + x;
    return alpha[p]! > 0 ? h[p]! : h[cy * width + cx]!;
  };
  const D = (x: number, y: number): number => (x < 0 || y < 0 || x >= width || y >= height ? 0 : dist[y * width + x]!);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const a = alpha[p]!;
      let nx = 0;
      let ny = 0;
      let nz = 1;
      if (a > 0) {
        // Sobel on the height field.
        const gx =
          -H(x - 1, y - 1, x, y) + H(x + 1, y - 1, x, y) - 2 * H(x - 1, y, x, y) + 2 * H(x + 1, y, x, y) - H(x - 1, y + 1, x, y) + H(x + 1, y + 1, x, y);
        const gy =
          -H(x - 1, y - 1, x, y) - 2 * H(x, y - 1, x, y) - H(x + 1, y - 1, x, y) + H(x - 1, y + 1, x, y) + 2 * H(x, y + 1, x, y) + H(x + 1, y + 1, x, y);
        nx = -gx * opts.strength;
        ny = gy * opts.strength; // image y grows downward; +Y up in tangent space
        nz = 1;
        let len = Math.hypot(nx, ny, nz);
        nx /= len;
        ny /= len;
        nz /= len;

        // Bevel: outward = direction of decreasing distance.
        const d = dist[p]!;
        if (d < opts.bevelBand) {
          const ox = D(x - 1, y) - D(x + 1, y); // points toward smaller distance along x
          const oyImg = D(x, y - 1) - D(x, y + 1); // points toward smaller distance along image y
          const olen = Math.hypot(ox, oyImg);
          if (olen > 1e-6) {
            const w = (1 - d / opts.bevelBand) * opts.bevelStrength;
            const bx = ox / olen;
            const by = -oyImg / olen; // flip to +Y-up
            const bz = 0.5;
            const blen = Math.hypot(bx, by, bz);
            nx = nx * (1 - w) + (bx / blen) * w;
            ny = ny * (1 - w) + (by / blen) * w;
            nz = nz * (1 - w) + (bz / blen) * w;
            len = Math.hypot(nx, ny, nz);
            nx /= len;
            ny /= len;
            nz /= len;
          }
        }
      }
      const i = p * 4;
      out.data[i] = Math.round(128 + nx * 127);
      out.data[i + 1] = Math.round(128 + ny * 127);
      out.data[i + 2] = Math.round(128 + nz * 127);
      out.data[i + 3] = a;
    }
  }
  return out;
}
