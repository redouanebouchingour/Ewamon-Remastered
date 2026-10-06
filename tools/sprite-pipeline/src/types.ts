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
 * v3 (never shipped): binary alpha in every atlas map.
 * v4: binary alpha (level 0 thresholded at ALPHA_THRESHOLD; each mip keeps exactly the level-0
 * coverage per cell, `selectBinaryCoverage`), and the stage-1 transparent-RGB rule re-applied to
 * the composed albedo atlas. Atlas stage only: the per-sprite stages are unchanged, so their
 * cache key uses SPRITE_STAGE_VERSION and stays valid.
 * v5: the new stage-4 emissive rule (SPRITE_STAGE_VERSION 3).
 */
export const PIPELINE_VERSION = '5';
/**
 * Folded into the per-sprite cache key (stages 1–4). Bump only when those stages change.
 * 3: stage 4 emissive = bright-and-vivid (HSV value + chroma) with a coverage cap.
 */
export const SPRITE_STAGE_VERSION = '3';
/**
 * Every atlas map stores binary alpha: a >= ALPHA_THRESHOLD -> 255, else 0. The billboard
 * alpha-tests at 0.5 (10-render.md §10.4.5) and Pillar 6 requires binary edges, so soft alpha
 * never reaches the screen; stored soft, it cost a third of every albedo file.
 */
export const ALPHA_THRESHOLD = 128;
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

/**
 * Animated multiframe sources (spec §40.1.3 as amended 2026-10-06, `anim.ts`). Every page of a GIF / animated WebP
 * ships as a flipbook next to the static set (whose cell stays the frame-select page). The anim cell is
 * `spriteSize / ANIM_CELL_DIVISOR` = 512 texels: each page is normalised on the static 1024² canvas with the static
 * frame's own transform (so the two line up exactly), run through stages 3–4 there, then reduced 2×.
 */
export const ANIM_CELL_DIVISOR = 2;
/** Folded into every anim cache key (per-side frames and anim atlas files). Bump when `anim.ts` changes behaviour. */
export const ANIM_STAGE_VERSION = '1';
/** Hard ceiling for every file under `public/creatures/anim/` plus the manifest's anim share (24 MiB, spec §40.6). */
export const ANIM_BUDGET_BYTES = 25_165_824;
/** Largest anim atlas edge: the 8192 `maxTextureSize` every renderer must have (render §10.1.1; WebP itself allows 16383). */
export const ANIM_MAX_EDGE = 8192;
/** Anim atlases live under this subdirectory of the output, outside the static 35 MiB line. */
export const ANIM_DIR = 'anim';
/** A page delay below this (ms) is shown as DEFAULT_FRAME_DELAY_MS, as browsers do for GIF / animated WebP. */
export const MIN_FRAME_DELAY_MS = 20;
export const DEFAULT_FRAME_DELAY_MS = 100;

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
