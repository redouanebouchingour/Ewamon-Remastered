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

/**
 * Pipeline-wide constants (spec §40.1.2). Changing any of them changes every cache key;
 * `PIPELINE_VERSION` is bumped when a stage's behaviour changes without a constant changing.
 *
 * v2: stage-1 transparent-RGB rule, alternate-style exclusion, footV from the bottom, the
 * 2048² cell, the mip chain, the WebP codec ladder.
 */
export const PIPELINE_VERSION = '2';
export const DEFAULT_SPRITE_SIZE = 1024;
/** Atlas edge in level-0 texels: 2 × 2 cells = 2 species (front + back). */
export const DEFAULT_ATLAS_SIZE = 2048;
/** Cells per atlas (2 × 2). */
export const ATLAS_SLOTS = 4;
/** Foot line while normalising: the alpha bbox bottom sits at this fraction from the TOP. */
export const FOOT_V = 0.92;
/** The manifest's `footV`: measured from the BOTTOM of the cell (10-render.md SpriteFrame). */
export const MANIFEST_FOOT_V = 0.08;
/** max(bboxW, bboxH) fills this fraction of the canvas. */
export const FILL_FRACTION = 0.86;
/** Normal atlas texels per albedo texel (half resolution). */
export const NORMAL_SCALE = 0.5;
/** Pipeline-built mip levels 1..MIP_LEVELS per map. */
export const MIP_LEVELS = 3;
/** Hard ceiling for every file under `public/creatures/` (35 MiB, spec §40.6). */
export const CREATURES_BUDGET_BYTES = 36_700_160;
/** Bind cap per zone (= 2 × 4096² in texels). */
export const MAX_ATLASES_PER_ZONE = 8;
/** Planner duplicates allowed over the whole world. */
export const MAX_DUPLICATED_SPECIES = 6;
/** Thumbnail longest edge and size cap (20-client.md §20.10.2 rule 6). */
export const THUMB_SIZE = 128;
export const THUMB_MAX_BYTES = 6 * 1024;
/** Per-sprite stage workers. Results are sorted before anything is written. */
export const CONCURRENCY = 3;

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

export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
