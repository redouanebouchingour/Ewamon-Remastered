/**
 * Stage 2 — normalize.
 *
 * Trim to the alpha bbox, scale so max(bboxW, bboxH) = FILL_FRACTION * canvas (881 px at
 * 1024), centre horizontally and anchor the bbox bottom on the foot line at V = FOOT_V
 * (y = 942 at 1024). Nearest-neighbour when the scale factor is (within 1e-3) an integer
 * or the reciprocal of one so pixel edges survive; lanczos3 otherwise.
 */
import sharp from 'sharp';
import type { Bbox, RgbaImage } from './types.js';
import { FILL_FRACTION, FOOT_V, bboxHeight, bboxWidth, createRgba } from './types.js';

export type ResampleKernel = 'nearest' | 'lanczos3';

export interface Placement {
  /** Uniform scale applied to the source bbox (target px / source px). */
  scale: number;
  targetW: number;
  targetH: number;
  /** Top-left of the scaled bbox on the canvas (top may be negative when the sprite is clipped). */
  left: number;
  top: number;
  kernel: ResampleKernel;
  footV: number;
}

export const INTEGER_TOLERANCE = 1e-3;

export function chooseKernel(scale: number): ResampleKernel {
  if (scale <= 0) return 'lanczos3';
  if (Math.abs(scale - Math.round(scale)) < INTEGER_TOLERANCE) return 'nearest';
  const inv = 1 / scale;
  if (Math.abs(inv - Math.round(inv)) < INTEGER_TOLERANCE) return 'nearest';
  return 'lanczos3';
}

export function computePlacement(bboxW: number, bboxH: number, canvas: number): Placement {
  const fill = Math.round(FILL_FRACTION * canvas);
  const footY = Math.round(FOOT_V * canvas);
  const longest = Math.max(bboxW, bboxH);
  const scale = fill / longest;
  const targetW = bboxW >= bboxH ? fill : Math.max(1, Math.round(bboxW * scale));
  const targetH = bboxH >= bboxW ? fill : Math.max(1, Math.round(bboxH * scale));
  return {
    scale,
    targetW,
    targetH,
    left: Math.round((canvas - targetW) / 2),
    top: footY - targetH,
    kernel: chooseKernel(scale),
    footV: FOOT_V,
  };
}

export interface NormalizeResult {
  image: RgbaImage;
  placement: Placement;
}

export async function normalizeSprite(src: RgbaImage, bbox: Bbox, canvas: number): Promise<NormalizeResult> {
  const w = bboxWidth(bbox);
  const h = bboxHeight(bbox);
  const placement = computePlacement(w, h, canvas);

  const resized = await sharp(Buffer.from(src.data.buffer, src.data.byteOffset, src.data.byteLength), {
    raw: { width: src.width, height: src.height, channels: 4 },
  })
    .extract({ left: bbox.x0, top: bbox.y0, width: w, height: h })
    .resize(placement.targetW, placement.targetH, { kernel: placement.kernel, fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const image = createRgba(canvas, canvas);
  blit(image, new Uint8Array(resized.data.buffer, resized.data.byteOffset, resized.data.byteLength), resized.info.width, resized.info.height, placement.left, placement.top);
  return { image, placement };
}

/** Copies `src` (w*h RGBA) onto `dst` at (left, top), clipping to the destination bounds. */
export function blit(dst: RgbaImage, src: Uint8Array, w: number, h: number, left: number, top: number): void {
  for (let y = 0; y < h; y++) {
    const dy = top + y;
    if (dy < 0 || dy >= dst.height) continue;
    const x0 = Math.max(0, -left);
    const x1 = Math.min(w, dst.width - left);
    if (x1 <= x0) continue;
    const srcOff = (y * w + x0) * 4;
    const dstOff = (dy * dst.width + left + x0) * 4;
    dst.data.set(src.subarray(srcOff, srcOff + (x1 - x0) * 4), dstOff);
  }
}
