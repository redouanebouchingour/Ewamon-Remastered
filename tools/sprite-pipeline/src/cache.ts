/**
 * Content-hash cache under `tools/sprite-pipeline/.cache/` (spec §40.0.2 rule 2, §40.1.7).
 *
 *   sprites/<hash>/{albedo,normal,emissive}.png + meta.json
 *       hash = sha256(source bytes, "v" + SPRITE_STAGE_VERSION, "size=1024", normal options,
 *                     emissive override, frame-select entry, alpha override)
 *       Lossless true-colour PNG (`losslessPng`): albedo / normal RGBA8, emissive 8-bit grey. A read returns
 *       exactly the raster the stages produced (`test/cache.test.ts`).
 *   atlases/<hash>.webp        one encoded atlas file (a map at one mip level under one rung)
 *       hash = sha256(PIPELINE_VERSION, settingsKey, "2048/1024", kind, level, members + placements)
 *   thumbs/<thumb key>.webp + .rung
 *
 * A rerun over unchanged inputs does no image work and reports `cacheHits === inputs`.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type { QaFlag } from './alpha.js';
import type { GrayImage, RgbaImage } from './types.js';

export function sha256(...parts: Array<Uint8Array | string>): string {
  const h = createHash('sha256');
  for (const p of parts) h.update(p);
  return h.digest('hex');
}

export interface SpriteMeta {
  id: string;
  side: 'front' | 'back';
  source: string;
  sourceWidth: number;
  sourceHeight: number;
  /** Pages in the source (1 for a still image). */
  frames: number;
  /** Page decoded (frame-select.json; 0 for stills). */
  frame: number;
  recovered: boolean;
  coverage: number;
  flags: QaFlag[];
  /** From the BOTTOM of the cell (manifest convention), 0.08. */
  footV: number;
  pixelScale: number;
  kernel: 'nearest' | 'lanczos3';
  emissivePixels: number;
  /** Alpha bbox on the normalised 1024² canvas (thumbnail crop). */
  bbox: { x0: number; y0: number; x1: number; y1: number } | null;
}

export interface SpriteArtifacts {
  meta: SpriteMeta;
  albedo: RgbaImage;
  normal: RgbaImage;
  emissive: GrayImage;
}

export class SpriteCache {
  constructor(readonly root: string) {}

  private dir(hash: string): string {
    return path.join(this.root, 'sprites', hash);
  }

  has(hash: string): boolean {
    const d = this.dir(hash);
    return ['meta.json', 'albedo.png', 'normal.png', 'emissive.png'].every((f) => existsSync(path.join(d, f)));
  }

  readMeta(hash: string): SpriteMeta {
    return JSON.parse(readFileSync(path.join(this.dir(hash), 'meta.json'), 'utf8')) as SpriteMeta;
  }

  pngPath(hash: string, kind: 'albedo' | 'normal' | 'emissive'): string {
    return path.join(this.dir(hash), `${kind}.png`);
  }

  async readRgba(hash: string, kind: 'albedo' | 'normal'): Promise<RgbaImage> {
    const { data, info } = await sharp(this.pngPath(hash, kind)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
  }

  async readGray(hash: string): Promise<GrayImage> {
    const { data, info } = await sharp(this.pngPath(hash, 'emissive')).toColourspace('b-w').raw().toBuffer({ resolveWithObject: true });
    const out: GrayImage = { width: info.width, height: info.height, data: new Uint8Array(info.width * info.height) };
    // libvips may hand back 1 or more channels for b-w; take the first.
    for (let p = 0; p < out.data.length; p++) out.data[p] = data[p * info.channels]!;
    return out;
  }

  async write(hash: string, art: SpriteArtifacts): Promise<void> {
    const d = this.dir(hash);
    mkdirSync(d, { recursive: true });
    await Promise.all([
      losslessPng(art.albedo).then((b) => writeFileSync(path.join(d, 'albedo.png'), b)),
      losslessPng(art.normal).then((b) => writeFileSync(path.join(d, 'normal.png'), b)),
      losslessPng(art.emissive).then((b) => writeFileSync(path.join(d, 'emissive.png'), b)),
    ]);
    writeFileSync(path.join(d, 'meta.json'), `${JSON.stringify(art.meta, null, 2)}\n`);
  }

  atlasPath(hash: string, ext: string): string {
    return path.join(this.root, 'atlases', `${hash}.${ext}`);
  }

  readAtlas(hash: string, ext: string): Uint8Array | null {
    const p = this.atlasPath(hash, ext);
    return existsSync(p) ? new Uint8Array(readFileSync(p)) : null;
  }

  writeAtlas(hash: string, ext: string, bytes: Uint8Array): void {
    mkdirSync(path.join(this.root, 'atlases'), { recursive: true });
    writeFileSync(this.atlasPath(hash, ext), bytes);
  }

  thumbPath(hash: string): string {
    return path.join(this.root, 'thumbs', `${hash}.webp`);
  }

  /** The cached thumb and the ladder rung that produced it (`<hash>.webp` + `<hash>.rung`). */
  readThumb(hash: string): { bytes: Uint8Array; rung: string } | null {
    const p = this.thumbPath(hash);
    const r = `${p}.rung`;
    if (!existsSync(p) || !existsSync(r)) return null;
    return { bytes: new Uint8Array(readFileSync(p)), rung: readFileSync(r, 'utf8').trim() };
  }

  writeThumb(hash: string, bytes: Uint8Array, rung: string): void {
    mkdirSync(path.join(this.root, 'thumbs'), { recursive: true });
    writeFileSync(this.thumbPath(hash), bytes);
    writeFileSync(`${this.thumbPath(hash)}.rung`, `${rung}\n`);
  }
}

/**
 * Lossless true-colour PNG of a stage raster: RGBA8 for an `RgbaImage`, 8-bit grey for a `GrayImage` (channels from
 * the buffer length). The only PNG writer for the sprite and anim caches.
 *
 * `palette: false` is explicit and none of sharp's `effort`, `colours`, `dither` or `quality` PNG options is passed:
 * each of them implies `palette: true`, i.e. libimagequant quantisation to ≤ 256 colours with dithering. Until
 * SPRITE_STAGE_VERSION 4 the sprite cache wrote `png({ compressionLevel: 6, effort: 4 })`, so every static atlas
 * was composed from 256-colour dithered copies of the stage output (spec §40.1.7, CHANGELOG 2026-10-06).
 */
export async function losslessPng(img: RgbaImage | GrayImage): Promise<Buffer> {
  const channels = img.data.length / (img.width * img.height);
  if (channels !== 1 && channels !== 4) throw new Error(`losslessPng: ${img.width}x${img.height} raster with ${img.data.length} bytes is neither RGBA8 nor grey`);
  const s = sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), {
    raw: { width: img.width, height: img.height, channels },
  });
  // sharp's output colourspace defaults to sRGB, which would store a grey raster as three equal channels.
  return (channels === 1 ? s.toColourspace('b-w') : s).png({ compressionLevel: 6, palette: false }).toBuffer();
}
