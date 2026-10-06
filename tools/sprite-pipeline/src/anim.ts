/**
 * Animated multiframe sources (spec §40.1.3 as amended 2026-10-06).
 *
 * The 20 GIF / animated WebP sources (10 legendaries and mythicals, front + back) animated in the original game. The
 * static set keeps exactly what it shipped — the `frame-select.json` page in a 1024² cell — and every page of each
 * side additionally ships as a flipbook in its own anim atlas under `public/creatures/anim/`.
 *
 * One shared normalisation per side, anchored on the static frame:
 *
 *   1. Every page goes through stage 1 (alpha recovery) at source resolution; the union of the pages' alpha bboxes
 *      is the side's crop region U.
 *   2. The transform is the static cell's own (`computePlacement` on the frame-select page's bbox: the same per-axis
 *      scale, horizontal centre and foot line). U is resampled ONCE per page with that transform (same crop, same
 *      target size, same offset for every page) onto the 1024² "master" canvas, so a part that does not move in the
 *      source does not move by a single texel between frames (no jitter, no slide), and the frame-select page lands
 *      where the static cell has it (swapping static ↔ animated shows no jump). Measured on the shipped sources the
 *      union always fits the cell under that transform; a union bbox normalised to its own 0.86 fill would have shrunk
 *      the creature by up to 11 % (galaxion back) and lifted its feet, i.e. a visible jump on the swap.
 *   3. Stages 3 (normal) and 4 (emissive) run on the master canvas with the static parameters — the static frame's
 *      maps equal the static cell's — and all three maps are then reduced 2× to the 512² anim cell (albedo lanczos3
 *      premultiplied, normal = `halfResolutionNormal`, emissive by 2×2 majority).
 *
 * Packing: each side's pages fill one atlas, a cols × rows grid of anim cells in page order (no empty cell when the
 * count allows; wider than tall on a tie), so a playing animation never switches texture or material. The atlas maps
 * follow stage 6 exactly: binary alpha, the stage-1 transparent-RGB rule re-applied, half-resolution normal,
 * coverage-preserving pipeline mips 1–3, WebP with the static settings under its own budget ladder.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type { AlphaOptions } from './alpha.js';
import { alphaBbox, cleanTransparentRgb, recoverAlpha } from './alpha.js';
import { losslessPng, sha256 } from './cache.js';
import { deriveEmissive, resolveEmissiveOverride } from './emissive.js';
import type { MapEncodeSettings, Rung, TextureKind } from './encode.js';
import { decodeToRgba, encodeMaskWebp, encodeRgbaWebp, ladderRungs, mipLevels, settingsFor, settingsKey } from './encode.js';
import type { ManifestAnimAtlas, ManifestAnimSide, ManifestAnimSprite, ManifestMap, ManifestSpriteV2, SpriteManifestV2 } from './manifest.js';
import { serializeManifest } from './manifest.js';
import { binarizeAlpha, buildAlphaMipChain, buildMaskMipChain, buildNormalMipChain, halfResolutionNormal } from './mips.js';
import type { ResampleKernel } from './normalize.js';
import { blit, computePlacement } from './normalize.js';
import { DEFAULT_NORMAL_OPTIONS, deriveNormalMap } from './normalmap.js';
import type { SpriteSource } from './sources.js';
import type { Bbox, GrayImage, RgbaImage, SpriteSide } from './types.js';
import {
  ALPHA_THRESHOLD,
  ANIM_CELL_DIVISOR,
  ANIM_DIR,
  ANIM_MAX_EDGE,
  ANIM_STAGE_VERSION,
  DEFAULT_FRAME_DELAY_MS,
  MANIFEST_FOOT_V,
  MIN_FRAME_DELAY_MS,
  MIP_LEVELS,
  NORMAL_SCALE,
  PIPELINE_VERSION,
  SPRITE_STAGE_VERSION,
  bboxHeight,
  bboxWidth,
  compareStrings,
  createGray,
  createRgba,
} from './types.js';

// ---- the shared transform ------------------------------------------------------------------------------------

/** Where the union crop of a side lands on the static (`spriteSize`²) master canvas. Identical for every page. */
export interface AnimMasterPlacement {
  /** Master canvas edge (= the static cell, 1024). */
  size: number;
  /** Master texels per source px, per axis (the static cell's `targetW / bboxW`, `targetH / bboxH`). */
  scaleX: number;
  scaleY: number;
  /** Top-left (texels) and size of the resampled union crop on the master canvas. */
  left: number;
  top: number;
  width: number;
  height: number;
  kernel: ResampleKernel;
}

/**
 * The static frame's transform applied to the union crop `union` (both in source px). Throws when the union does not
 * fit the master canvas (a page would be clipped): the side would need a different anchor, which is a reviewed
 * decision, not something to paper over.
 */
export function animMasterPlacement(staticBbox: Bbox, union: Bbox, size: number): AnimMasterPlacement {
  const bw = bboxWidth(staticBbox);
  const bh = bboxHeight(staticBbox);
  const p = computePlacement(bw, bh, size);
  const scaleX = p.targetW / bw;
  const scaleY = p.targetH / bh;
  const width = Math.max(1, Math.round(bboxWidth(union) * scaleX));
  const height = Math.max(1, Math.round(bboxHeight(union) * scaleY));
  const left = Math.round(p.left + (union.x0 - staticBbox.x0) * scaleX);
  const top = Math.round(p.top + (union.y0 - staticBbox.y0) * scaleY);
  if (left < 0 || top < 0 || left + width > size || top + height > size) {
    throw new Error(
      `animated pages do not fit the ${size}² cell under the static frame's transform: union crop lands at ` +
        `${left},${top} ${width}×${height} (static bbox ${JSON.stringify(staticBbox)}, union ${JSON.stringify(union)})`,
    );
  }
  return { size, scaleX, scaleY, left, top, width, height, kernel: p.kernel };
}

export function unionBbox(boxes: ReadonlyArray<Bbox | null>): Bbox | null {
  let u: Bbox | null = null;
  for (const b of boxes) {
    if (!b) continue;
    u = u ? { x0: Math.min(u.x0, b.x0), y0: Math.min(u.y0, b.y0), x1: Math.max(u.x1, b.x1), y1: Math.max(u.y1, b.y1) } : { ...b };
  }
  return u;
}

/** Per-page display time: sharp's `delay` (ms); a missing or sub-20 ms delay shows for 100 ms, as in browsers. */
export function displayDelays(raw: readonly number[] | undefined, pages: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < pages; i++) {
    const d = raw?.[i];
    out.push(d !== undefined && Number.isFinite(d) && d >= MIN_FRAME_DELAY_MS ? Math.round(d) : DEFAULT_FRAME_DELAY_MS);
  }
  return out;
}

// ---- the grid ------------------------------------------------------------------------------------------------

export interface AnimGrid {
  cols: number;
  rows: number;
  cell: number;
  /** Level-0 texels. */
  width: number;
  height: number;
}

/**
 * The cols × rows grid for `frames` cells: fewest empty cells, then closest to square, then wider than tall; both
 * edges ≤ `maxEdge`. 24 → 6 × 4 (3072 × 2048 at 512), 25 → 5 × 5, 36 → 6 × 6.
 */
export function animGrid(frames: number, cell: number, maxEdge = ANIM_MAX_EDGE): AnimGrid {
  if (!Number.isInteger(frames) || frames < 1) throw new Error(`animGrid: ${frames} frames`);
  let best: AnimGrid | null = null;
  let bestKey: [number, number, number] | null = null;
  for (let cols = 1; cols <= frames; cols++) {
    const rows = Math.ceil(frames / cols);
    if (cols * cell > maxEdge || rows * cell > maxEdge) continue;
    const key: [number, number, number] = [cols * rows - frames, Math.abs(cols - rows), cols >= rows ? 0 : 1];
    if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))) {
      bestKey = key;
      best = { cols, rows, cell, width: cols * cell, height: rows * cell };
    }
  }
  if (!best) throw new Error(`animGrid: ${frames} cells of ${cell} do not fit ${maxEdge}²`);
  return best;
}

/** Level-0 rect `[x, y, w, h]` (y down) of frame `i`: raster order over the grid. */
export function animFramePx(grid: AnimGrid, i: number): [number, number, number, number] {
  return [(i % grid.cols) * grid.cell, Math.floor(i / grid.cols) * grid.cell, grid.cell, grid.cell];
}

/** `px` → `[u0, v0, u1, v1]` (v up) in a `width × height` atlas (`pxToUv` for non-square atlases). */
export function pxToUvRect(px: readonly [number, number, number, number], width: number, height: number): [number, number, number, number] {
  const [x, y, w, h] = px;
  return [x / width, 1 - (y + h) / height, (x + w) / width, 1 - y / height];
}

export function animAtlasId(species: string, side: SpriteSide): string {
  return `anim-${species}-${side}`;
}

export function animFileName(species: string, side: SpriteSide, kind: TextureKind, level: number): string {
  return `${ANIM_DIR}/${species}-${side}.${kind}${level === 0 ? '' : `.m${level}`}.webp`;
}

// ---- per-side stages (cached) ------------------------------------------------------------------------------------

export interface AnimSideMeta {
  id: string;
  side: SpriteSide;
  source: string;
  sourceWidth: number;
  sourceHeight: number;
  pages: number;
  /** The frame-select page: the static cell shows it. */
  staticFrame: number;
  /** Display ms per page (`displayDelays`). */
  delays: number[];
  /** sharp `delay` as read. */
  sourceDelays: number[];
  /** Alpha bbox (a ≥ 1) of the frame-select page and the union over every page, source px. */
  staticBbox: Bbox;
  union: Bbox;
  master: AnimMasterPlacement;
  /** Anim cell edge (512). */
  cell: number;
  /** Anim texels per source px (QA). */
  pixelScale: number;
  /** Per page: alpha bbox (a ≥ 128) on the anim cell; null for an empty page. */
  frameBboxes: Array<Bbox | null>;
  emissivePixels: number[];
}

export interface AnimFrameRasters {
  albedo: RgbaImage;
  normal: RgbaImage;
  emissive: GrayImage;
}

export interface AnimSideContext {
  spriteSize: number;
  bytes: Uint8Array;
  staticFrame: number;
  alpha: AlphaOptions;
  force: boolean;
  jobs: number;
}

export interface ProcessedAnimSide {
  source: SpriteSource;
  hash: string;
  meta: AnimSideMeta;
  cached: boolean;
}

export function animCell(spriteSize: number): number {
  if (spriteSize % ANIM_CELL_DIVISOR !== 0) throw new Error(`spriteSize ${spriteSize} is not divisible by ${ANIM_CELL_DIVISOR}`);
  return spriteSize / ANIM_CELL_DIVISOR;
}

export function animSideCacheKey(bytes: Uint8Array, id: string, spriteSize: number, staticFrame: number, alpha: AlphaOptions): string {
  return sha256(
    bytes,
    'anim',
    `a${ANIM_STAGE_VERSION}`,
    `v${SPRITE_STAGE_VERSION}`,
    `size=${spriteSize}`,
    `cell=${animCell(spriteSize)}`,
    `normal=${JSON.stringify(DEFAULT_NORMAL_OPTIONS)}`,
    `emissive=${JSON.stringify(resolveEmissiveOverride(id))}`,
    `static=${staticFrame}`,
    `alpha=${JSON.stringify(alpha)}`,
  );
}

/**
 * `.cache/anim/<hash>/{meta.json, pNN.{albedo,normal,emissive}.png}`, written with `cache.ts` `losslessPng` (true-colour,
 * bit-exact). A palette-quantised cache would re-dither every page differently — noise that boils between frames
 * although the source pixels do not move.
 */
export class AnimCache {
  constructor(readonly root: string) {}

  dir(hash: string): string {
    return path.join(this.root, 'anim', hash);
  }

  framePath(hash: string, page: number, kind: 'albedo' | 'normal' | 'emissive'): string {
    return path.join(this.dir(hash), `p${String(page).padStart(2, '0')}.${kind}.png`);
  }

  has(hash: string): boolean {
    const metaPath = path.join(this.dir(hash), 'meta.json');
    if (!existsSync(metaPath)) return false;
    const meta = this.readMeta(hash);
    for (let p = 0; p < meta.pages; p++) for (const k of ['albedo', 'normal', 'emissive'] as const) if (!existsSync(this.framePath(hash, p, k))) return false;
    return true;
  }

  readMeta(hash: string): AnimSideMeta {
    return JSON.parse(readFileSync(path.join(this.dir(hash), 'meta.json'), 'utf8')) as AnimSideMeta;
  }

  async readFrame(hash: string, page: number): Promise<AnimFrameRasters> {
    const rgba = async (kind: 'albedo' | 'normal'): Promise<RgbaImage> => {
      const { data, info } = await sharp(this.framePath(hash, page, kind)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
    };
    const { data, info } = await sharp(this.framePath(hash, page, 'emissive')).toColourspace('b-w').raw().toBuffer({ resolveWithObject: true });
    const emissive = createGray(info.width, info.height);
    for (let p = 0; p < emissive.data.length; p++) emissive.data[p] = data[p * info.channels]!;
    return { albedo: await rgba('albedo'), normal: await rgba('normal'), emissive };
  }

  async writeFrame(hash: string, page: number, f: AnimFrameRasters): Promise<void> {
    mkdirSync(this.dir(hash), { recursive: true });
    const [a, n, e] = await Promise.all([losslessPng(f.albedo), losslessPng(f.normal), losslessPng(f.emissive)]);
    writeFileSync(this.framePath(hash, page, 'albedo'), a);
    writeFileSync(this.framePath(hash, page, 'normal'), n);
    writeFileSync(this.framePath(hash, page, 'emissive'), e);
  }

  writeMeta(hash: string, meta: AnimSideMeta): void {
    mkdirSync(this.dir(hash), { recursive: true });
    writeFileSync(path.join(this.dir(hash), 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  }

  atlasPath(hash: string): string {
    return path.join(this.root, 'atlases', `${hash}.webp`);
  }

  readAtlas(hash: string): Uint8Array | null {
    const p = this.atlasPath(hash);
    return existsSync(p) ? new Uint8Array(readFileSync(p)) : null;
  }

  writeAtlas(hash: string, bytes: Uint8Array): void {
    mkdirSync(path.join(this.root, 'atlases'), { recursive: true });
    writeFileSync(this.atlasPath(hash), bytes);
  }
}

async function runPool<T>(items: readonly T[], jobs: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const worker = async (): Promise<void> => {
    for (let it = queue.shift(); it !== undefined; it = queue.shift()) await fn(it);
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(jobs, items.length)) }, worker));
}

function raw(img: RgbaImage): sharp.Sharp {
  return sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), { raw: { width: img.width, height: img.height, channels: 4 } });
}

/** One page on the master canvas: crop `union`, resample with the shared placement, blit (`normalizeSprite`'s steps). */
export async function masterFrame(recovered: RgbaImage, union: Bbox, m: AnimMasterPlacement): Promise<RgbaImage> {
  const res = await raw(recovered)
    .extract({ left: union.x0, top: union.y0, width: bboxWidth(union), height: bboxHeight(union) })
    .resize(m.width, m.height, { kernel: m.kernel, fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const image = createRgba(m.size, m.size);
  blit(image, new Uint8Array(res.data.buffer, res.data.byteOffset, res.data.byteLength), res.info.width, res.info.height, m.left, m.top);
  return image;
}

/** The master albedo / normal / emissive reduced by ANIM_CELL_DIVISOR (2) to the anim cell. */
export async function reduceToCell(albedo: RgbaImage, normal: RgbaImage, emissive: GrayImage): Promise<AnimFrameRasters> {
  if (ANIM_CELL_DIVISOR !== 2) throw new Error('reduceToCell: only a 2× reduction is implemented');
  const { data, info } = await raw(albedo)
    .resize(albedo.width >> 1, albedo.height >> 1, { kernel: 'lanczos3', fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    albedo: { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) },
    normal: await halfResolutionNormal(normal),
    emissive: buildMaskMipChain(emissive, 1)[0]!,
  };
}

/** Pages and display delays of a multiframe source. */
export async function readAnimInfo(bytes: Uint8Array): Promise<{ pages: number; sourceDelays: number[]; delays: number[] }> {
  const md = await sharp(bytes, { pages: -1 }).metadata();
  const pages = md.pages ?? 1;
  const sourceDelays = [...(md.delay ?? [])].slice(0, pages);
  return { pages, sourceDelays, delays: displayDelays(sourceDelays, pages) };
}

/**
 * Stages 1–4 for every page of one side (cached per side): alpha recovery per page, the union crop, the shared
 * transform onto the master canvas, normal + emissive there, reduction to the anim cell.
 */
export async function processAnimSide(src: SpriteSource, cache: AnimCache, ctx: AnimSideContext): Promise<ProcessedAnimSide> {
  const hash = animSideCacheKey(ctx.bytes, src.id, ctx.spriteSize, ctx.staticFrame, ctx.alpha);
  if (!ctx.force && cache.has(hash)) return { source: src, hash, meta: cache.readMeta(hash), cached: true };

  const info = await readAnimInfo(ctx.bytes);
  if (info.pages < 2) throw new Error(`${src.id}/${src.side}: not a multiframe source`);
  if (ctx.staticFrame < 0 || ctx.staticFrame >= info.pages) throw new Error(`${src.id}/${src.side}: static frame ${ctx.staticFrame} outside 0..${info.pages - 1}`);
  const recovered: RgbaImage[] = new Array<RgbaImage>(info.pages);
  const boxes: Array<Bbox | null> = new Array<Bbox | null>(info.pages).fill(null);
  let sourceWidth = 0;
  let sourceHeight = 0;
  await runPool([...Array(info.pages).keys()], ctx.jobs, async (p) => {
    const decoded = await decodeToRgba(ctx.bytes, p);
    sourceWidth = decoded.width;
    sourceHeight = decoded.height;
    const a = recoverAlpha(decoded, ctx.alpha);
    recovered[p] = a.image;
    boxes[p] = a.bbox;
  });
  const staticBbox = boxes[ctx.staticFrame];
  const union = unionBbox(boxes);
  if (!staticBbox || !union) throw new Error(`${src.id}/${src.side}: the static page has no recoverable alpha`);
  const master = animMasterPlacement(staticBbox, union, ctx.spriteSize);
  const cell = animCell(ctx.spriteSize);
  const override = resolveEmissiveOverride(src.id);
  const frameBboxes: Array<Bbox | null> = new Array<Bbox | null>(info.pages).fill(null);
  const emissivePixels: number[] = new Array<number>(info.pages).fill(0);
  await runPool([...Array(info.pages).keys()], ctx.jobs, async (p) => {
    const albedo = await masterFrame(recovered[p]!, union, master);
    const normal = deriveNormalMap(albedo);
    const emissive = deriveEmissive(albedo, override);
    const reduced = await reduceToCell(albedo, normal, emissive);
    frameBboxes[p] = alphaBbox(reduced.albedo, ALPHA_THRESHOLD);
    let n = 0;
    for (let i = 0; i < reduced.emissive.data.length; i++) if (reduced.emissive.data[i]) n++;
    emissivePixels[p] = n;
    await cache.writeFrame(hash, p, reduced);
  });
  const meta: AnimSideMeta = {
    id: src.id,
    side: src.side,
    source: src.file,
    sourceWidth,
    sourceHeight,
    pages: info.pages,
    staticFrame: ctx.staticFrame,
    delays: info.delays,
    sourceDelays: info.sourceDelays,
    staticBbox,
    union,
    master: { ...master, scaleX: round(master.scaleX, 6), scaleY: round(master.scaleY, 6) },
    cell,
    pixelScale: round(master.scaleX / ANIM_CELL_DIVISOR, 6),
    frameBboxes,
    emissivePixels,
  };
  cache.writeMeta(hash, meta);
  return { source: src, hash, meta, cached: false };
}

// ---- atlas rasters -----------------------------------------------------------------------------------------------

export interface AnimAtlasRasters {
  /** Level 0 (grid.width × grid.height) .. level MIP_LEVELS. */
  albedo: RgbaImage[];
  /** Half resolution. */
  normal: RgbaImage[];
  emissive: GrayImage[];
}

function blitGray(dst: GrayImage, src: GrayImage, left: number, top: number): void {
  for (let y = 0; y < src.height; y++) dst.data.set(src.data.subarray(y * src.width, (y + 1) * src.width), (top + y) * dst.width + left);
}

/** Stage 6 for one side: the frames composed in page order, binary alpha, transparent-RGB rule, half-res normal, mips. */
export async function buildAnimAtlasRasters(frames: readonly AnimFrameRasters[], grid: AnimGrid): Promise<AnimAtlasRasters> {
  const { width, height, cell } = grid;
  const albedo0 = createRgba(width, height);
  const normal0 = createRgba(width, height);
  const emissive0 = createGray(width, height);
  for (let p = 0; p < width * height; p++) {
    normal0.data[p * 4] = 128;
    normal0.data[p * 4 + 1] = 128;
    normal0.data[p * 4 + 2] = 255;
  }
  frames.forEach((f, i) => {
    for (const img of [f.albedo, f.normal]) if (img.width !== cell || img.height !== cell) throw new Error(`anim frame ${i} is ${img.width}x${img.height}, expected ${cell}²`);
    const [x, y] = animFramePx(grid, i);
    blit(albedo0, f.albedo.data, cell, cell, x, y);
    blit(normal0, f.normal.data, cell, cell, x, y);
    blitGray(emissive0, f.emissive, x, y);
  });
  binarizeAlpha(albedo0);
  cleanTransparentRgb(albedo0);
  for (let p = 0; p < width * height; p++) {
    const a = albedo0.data[p * 4 + 3]!;
    normal0.data[p * 4 + 3] = a;
    if (a === 0) {
      normal0.data[p * 4] = 128;
      normal0.data[p * 4 + 1] = 128;
      normal0.data[p * 4 + 2] = 255;
    }
  }
  const normalHalf = await halfResolutionNormal(normal0);
  const halfCell = Math.round(cell * NORMAL_SCALE);
  return {
    albedo: [albedo0, ...buildAlphaMipChain(albedo0, MIP_LEVELS, cell)],
    normal: [normalHalf, ...buildNormalMipChain(normalHalf, MIP_LEVELS, halfCell)],
    emissive: [emissive0, ...buildMaskMipChain(emissive0, MIP_LEVELS)],
  };
}

export function animAtlasFileKey(sideHash: string, grid: AnimGrid, kind: TextureKind, level: number, settings: MapEncodeSettings, settingsKey: (s: MapEncodeSettings) => string): string {
  return sha256(PIPELINE_VERSION, 'anim', `a${ANIM_STAGE_VERSION}`, settingsKey(settings), `${grid.width}x${grid.height}/${grid.cell}`, kind, `L${level}`, sideHash);
}

function round(v: number, digits: number): number {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}

// ---- encoding under the anim ladder + manifest parts ---------------------------------------------------------

export interface AnimJob {
  readonly side: ProcessedAnimSide;
  readonly grid: AnimGrid;
}

export type AnimEncoded = Record<TextureKind, Uint8Array[]>;

export function animJob(side: ProcessedAnimSide): AnimJob {
  return { side, grid: animGrid(side.meta.pages, side.meta.cell) };
}

/** The three maps × 4 levels of one side at `rung` (each file cached by content). */
export async function encodeAnimAtlasFiles(job: AnimJob, rung: Rung, cache: AnimCache, log: (m: string) => void): Promise<AnimEncoded> {
  const out: AnimEncoded = { albedo: [], normal: [], emissive: [] };
  let rasters: AnimAtlasRasters | null = null;
  let encodedAny = false;
  for (const kind of ['albedo', 'normal', 'emissive'] as const) {
    for (const level of mipLevels()) {
      const settings = settingsFor(kind, rung, level);
      const key = animAtlasFileKey(job.side.hash, job.grid, kind, level, settings, settingsKey);
      let bytes = cache.readAtlas(key);
      if (!bytes) {
        if (!rasters) {
          const frames: AnimFrameRasters[] = [];
          for (let p = 0; p < job.side.meta.pages; p++) frames.push(await cache.readFrame(job.side.hash, p));
          rasters = await buildAnimAtlasRasters(frames, job.grid);
        }
        bytes = kind === 'emissive' ? await encodeMaskWebp(rasters.emissive[level]!, settings) : await encodeRgbaWebp(rasters[kind][level]!, settings);
        cache.writeAtlas(key, bytes);
        encodedAny = true;
      }
      out[kind].push(bytes);
    }
  }
  if (encodedAny) {
    const kb = (list: Uint8Array[]): string => (list.reduce((n, b) => n + b.byteLength, 0) / 1024).toFixed(0);
    const m = job.side.meta;
    log(
      `  anim ${m.id}/${m.side}: ${m.pages} frames ${job.grid.cols}×${job.grid.rows} (${job.grid.width}×${job.grid.height}), ` +
        `albedo ${kb(out.albedo)} KB, normal ${kb(out.normal)} KB, emissive ${kb(out.emissive)} KB`,
    );
  }
  return out;
}

export function animEncodedBytes(e: AnimEncoded): number {
  let n = 0;
  for (const kind of ['albedo', 'normal', 'emissive'] as const) for (const b of e[kind]) n += b.byteLength;
  return n;
}

export interface AnimManifestParts {
  animAtlases: ManifestAnimAtlas[];
  anim: Map<string, ManifestAnimSprite>;
  fileBytes: number;
}

/** `animAtlases` + per-species `anim` records for the encoded sides (sorted; the serialiser fixes key order). */
export function animManifestParts(jobs: readonly AnimJob[], encoded: ReadonlyMap<string, AnimEncoded>, rung: Rung): AnimManifestParts {
  const animAtlases: ManifestAnimAtlas[] = [];
  const anim = new Map<string, { front?: ManifestAnimSide; back?: ManifestAnimSide }>();
  let fileBytes = 0;
  for (const job of jobs) {
    const m = job.side.meta;
    const id = animAtlasId(m.id, m.side);
    const files = encoded.get(id)!;
    fileBytes += animEncodedBytes(files);
    const map = (kind: TextureKind): ManifestMap => {
      const s = settingsFor(kind, rung, 0);
      return {
        url: animFileName(m.id, m.side, kind, 0),
        mips: mipLevels()
          .slice(1)
          .map((l) => animFileName(m.id, m.side, kind, l)),
        codec: s.codec,
        quality: s.quality,
        bytes: files[kind].reduce((n, b) => n + b.byteLength, 0),
      };
    };
    animAtlases.push({
      id,
      species: m.id,
      side: m.side,
      width: job.grid.width,
      height: job.grid.height,
      cell: job.grid.cell,
      slots: m.pages,
      albedo: map('albedo'),
      normal: map('normal'),
      emissive: map('emissive'),
      normalScale: 0.5,
    });
    const entry = anim.get(m.id) ?? {};
    entry[m.side] = {
      atlas: id,
      frames: Array.from({ length: m.pages }, (_unused, i) => pxToUvRect(animFramePx(job.grid, i), job.grid.width, job.grid.height)),
      delays: m.delays,
      staticFrame: m.staticFrame,
      footV: MANIFEST_FOOT_V,
      aspect: 1,
      pixelScale: m.pixelScale,
      source: m.source,
    };
    anim.set(m.id, entry);
  }
  animAtlases.sort((a, b) => compareStrings(a.id, b.id));
  return { animAtlases, anim, fileBytes };
}

/**
 * `staticM` with the anim extension merged in. `animTotalBytes` counts the anim files plus the manifest bytes the
 * extension adds (iterated until stable, like `totalBytes`), so `totalBytes` — and with it the static manifest's
 * serialisation — is exactly what the build wrote before animation existed.
 */
export function withAnim(staticM: SpriteManifestV2, parts: AnimManifestParts): SpriteManifestV2 {
  const sprites: Record<string, ManifestSpriteV2> = {};
  for (const [id, s] of Object.entries(staticM.sprites)) {
    const a = parts.anim.get(id);
    sprites[id] = a ? { ...s, anim: a } : s;
  }
  const staticLen = Buffer.byteLength(serializeManifest(staticM), 'utf8');
  let m: SpriteManifestV2 = { ...staticM, sprites, animAtlases: parts.animAtlases, animTotalBytes: parts.fileBytes };
  for (let i = 0; i < 6; i++) {
    const want = parts.fileBytes + Buffer.byteLength(serializeManifest(m), 'utf8') - staticLen;
    if (want === m.animTotalBytes) return m;
    m = { ...m, animTotalBytes: want };
  }
  throw new Error('internal: animTotalBytes did not converge');
}

/**
 * The anim ladder: the static ladder (§40.1.6.3), then four more rungs. Measured on the shipped sources (508 pages,
 * 2026-10-06): q88/q92 32.92 MB, q85/q92 30.27, q82/q92 28.68, q80/q92 27.61, q80/q90 26.84, q80/q85 25.38 — the
 * static bottom rung is still over 24 MiB, because 508 frames are twice the static sprite count and a 512² reduction
 * of a painted 1024² cell keeps ~45 % of its bytes. The extension lowers the normal map first (half resolution,
 * seen only through lighting; q92 → q80 halves it) before the albedo.
 */
export const ANIM_EXTRA_RUNGS: readonly Rung[] = Object.freeze([
  { albedo: 80, normal: 80 },
  { albedo: 78, normal: 80 },
  { albedo: 75, normal: 80 },
  { albedo: 75, normal: 75 },
]);

export function animLadderRungs(): Rung[] {
  return [...ladderRungs(), ...ANIM_EXTRA_RUNGS];
}

export interface AnimEncodeResult {
  rung: Rung;
  encoded: Map<string, AnimEncoded>;
  manifest: SpriteManifestV2;
  rungsTried: Array<{ albedo: number; normal: number; animTotalBytes: number }>;
}

/** Encodes every side at the top rung and steps down `animLadderRungs()` until `animTotalBytes ≤ budget`. */
export async function encodeAnimUnderBudget(
  jobs: readonly AnimJob[],
  staticM: SpriteManifestV2,
  cache: AnimCache,
  budget: number,
  workers: number,
  log: (m: string) => void,
): Promise<AnimEncodeResult> {
  const rungsTried: AnimEncodeResult['rungsTried'] = [];
  for (const rung of animLadderRungs()) {
    const encoded = new Map<string, AnimEncoded>();
    await runPool(jobs, workers, async (job) => {
      encoded.set(animAtlasId(job.side.meta.id, job.side.meta.side), await encodeAnimAtlasFiles(job, rung, cache, log));
    });
    const manifest = withAnim(staticM, animManifestParts(jobs, encoded, rung));
    const total = manifest.animTotalBytes!;
    rungsTried.push({ albedo: rung.albedo, normal: rung.normal, animTotalBytes: total });
    log(`anim ladder albedo q${rung.albedo} / normal q${rung.normal}: ${(total / 1e6).toFixed(2)} MB (budget ${(budget / 1e6).toFixed(2)} MB)`);
    if (total <= budget) return { rung, encoded, manifest, rungsTried };
  }
  throw new Error(
    `animated sprites exceed the ${budget} B budget at the bottom of the ladder: ${rungsTried.map((r) => `q${r.albedo}/q${r.normal} = ${r.animTotalBytes} B`).join(', ')}`,
  );
}
