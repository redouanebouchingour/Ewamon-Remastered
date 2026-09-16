/** Straight (non-premultiplied) RGBA raster, row-major, 4 bytes per pixel. */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

/** Single-channel 8-bit raster. */
export interface GrayImage {
  width: number;
  height: number;
  data: Uint8Array;
}

/** Inclusive pixel bounds. */
export interface Bbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type SpriteSide = 'front' | 'back';

/** Pipeline-wide constants. Changing any of them changes every cache key. */
export const PIPELINE_VERSION = '1';
export const DEFAULT_SPRITE_SIZE = 1024;
export const DEFAULT_ATLAS_SIZE = 4096;
/** Foot line: the alpha bbox bottom sits at this fraction of the canvas height. */
export const FOOT_V = 0.92;
/** max(bboxW, bboxH) fills this fraction of the canvas. */
export const FILL_FRACTION = 0.86;

export function bboxWidth(b: Bbox): number {
  return b.x1 - b.x0 + 1;
}
export function bboxHeight(b: Bbox): number {
  return b.y1 - b.y0 + 1;
}

export function createRgba(width: number, height: number): RgbaImage {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

export function createGray(width: number, height: number): GrayImage {
  return { width, height, data: new Uint8Array(width * height) };
}
