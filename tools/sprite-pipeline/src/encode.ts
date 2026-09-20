/**
 * Stage 6 — texture encoding (spec §40.1.6.3): WebP only.
 *
 *   albedo    webp-lossy   quality from the albedo ladder, alphaQuality 100 (lossless alpha),
 *                          smartSubsample, effort 6
 *   normal    webp-lossy   half resolution, quality from the normal ladder, alphaQuality 100
 *   emissive  webp-lossless (the two-valued mask replicated to RGB, read from R)
 *   mips      same codec as level 0; lossy maps at `quality − MIP_QUALITY_DROP`
 *
 * The fallback ladder (§40.1.6.3): albedo q88 → q85 → q82 → q80, normal q92 → q90 → q85. The
 * build encodes the whole set at the top rung and steps the albedo rung down first, then the
 * normal rung, until `totalBytes <= CREATURES_BUDGET_BYTES`; below the bottom rung it fails
 * rather than shipping over budget. The ladder never goes up by itself.
 *
 * KTX2 was measured and rejected for creatures (§40.1.6.2): UASTC is 1 byte/texel and came
 * out 1.57× LARGER than lossless WebP on sprites, the bundled Basis encoder refuses > 12 Mpix,
 * and ETC1S quantises alpha in 4×4 blocks so a 1-texel edge cannot survive. `encodeKtx2Rgba`
 * / `transcodeKtx2ToRgba` remain only for `cli bench`, which produced those numbers.
 */
import type { IEncodeOptions } from 'ktx2-encoder';
import sharp from 'sharp';
import type { SpriteCodec } from './manifest.js';
import type { GrayImage, RgbaImage } from './types.js';
import { MIP_LEVELS } from './types.js';

export type TextureKind = 'albedo' | 'normal' | 'emissive';

export const WEBP_EFFORT = 6;
export const ALBEDO_LADDER: readonly number[] = [88, 85, 82, 80];
export const NORMAL_LADDER: readonly number[] = [92, 90, 85];
export const MIP_QUALITY_DROP = 10;
/**
 * Thumbnail ladder: (q80, alphaQuality 90) is the spec figure; a busy 128 px crop exceeds the
 * 6 KB cap there because lanczos minification leaves thousands of semi-transparent texels and
 * the alpha plane costs as much as the colour (measured: abysspark 6 886 B, acier 9 016 B at
 * q80/aq90), so the thumb steps down both qualities until it fits.
 */
export interface ThumbRung {
  quality: number;
  alphaQuality: number;
}
export const THUMB_LADDER: readonly ThumbRung[] = [
  { quality: 80, alphaQuality: 90 },
  { quality: 72, alphaQuality: 80 },
  { quality: 64, alphaQuality: 70 },
  { quality: 56, alphaQuality: 60 },
  { quality: 48, alphaQuality: 50 },
  { quality: 40, alphaQuality: 40 },
];
export const THUMB_QUALITY = THUMB_LADDER[0]!.quality;
export const THUMB_ALPHA_QUALITY = THUMB_LADDER[0]!.alphaQuality;

export interface Rung {
  albedo: number;
  normal: number;
}

/** (88,92) (85,92) (82,92) (80,92) (80,90) (80,85): albedo steps first, then normal. */
export function ladderRungs(): Rung[] {
  const out: Rung[] = [];
  const topNormal = NORMAL_LADDER[0]!;
  for (const a of ALBEDO_LADDER) out.push({ albedo: a, normal: topNormal });
  const bottomAlbedo = ALBEDO_LADDER[ALBEDO_LADDER.length - 1]!;
  for (const n of NORMAL_LADDER.slice(1)) out.push({ albedo: bottomAlbedo, normal: n });
  return out;
}

export interface MapEncodeSettings {
  codec: SpriteCodec;
  /** libwebp q for lossy, null for lossless. */
  quality: number | null;
  alphaQuality: number;
  smartSubsample: boolean;
  effort: number;
}

/** Settings for a map at a mip level under a ladder rung. */
export function settingsFor(kind: TextureKind, rung: Rung, level: number): MapEncodeSettings {
  if (kind === 'emissive') return { codec: 'webp-lossless', quality: null, alphaQuality: 100, smartSubsample: false, effort: WEBP_EFFORT };
  const base = kind === 'albedo' ? rung.albedo : rung.normal;
  const quality = level === 0 ? base : Math.max(1, base - MIP_QUALITY_DROP);
  return { codec: 'webp-lossy', quality, alphaQuality: 100, smartSubsample: kind === 'albedo', effort: WEBP_EFFORT };
}

/** Stable string folded into atlas cache keys — changes whenever output bytes could change. */
export function settingsKey(s: MapEncodeSettings): string {
  return `webp:${s.codec}:q${s.quality ?? 'L'}:aq${s.alphaQuality}:ss${s.smartSubsample ? 1 : 0}:e${s.effort}`;
}

function rawInput(img: RgbaImage | GrayImage, channels: 1 | 4): sharp.Sharp {
  return sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), {
    raw: { width: img.width, height: img.height, channels },
  });
}

function bytes(buf: Buffer): Uint8Array {
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

export async function encodeRgbaWebp(img: RgbaImage, s: MapEncodeSettings): Promise<Uint8Array> {
  const pipeline = rawInput(img, 4);
  if (s.codec === 'webp-lossless') return bytes(await pipeline.webp({ lossless: true, effort: s.effort }).toBuffer());
  return bytes(
    await pipeline
      .webp({ quality: s.quality ?? 85, alphaQuality: s.alphaQuality, smartSubsample: s.smartSubsample, effort: s.effort, lossless: false })
      .toBuffer(),
  );
}

/** WebP has no single-channel mode; the mask is replicated to RGB and read from R. */
export async function encodeMaskWebp(mask: GrayImage, s: MapEncodeSettings): Promise<Uint8Array> {
  const pipeline = rawInput(mask, 1).toColourspace('srgb');
  if (s.codec === 'webp-lossless') return bytes(await pipeline.webp({ lossless: true, effort: s.effort }).toBuffer());
  return bytes(await pipeline.webp({ quality: s.quality ?? 80, effort: s.effort }).toBuffer());
}

/**
 * `thumbs/<id>_front.webp`: bbox crop, lanczos3 to `size` px on the longest edge, lossy
 * q80 / alphaQuality 90, stepping down `THUMB_LADDER` until the file is <= `maxBytes`.
 */
export async function encodeThumb(
  img: RgbaImage,
  bbox: { x0: number; y0: number; x1: number; y1: number },
  size: number,
  maxBytes = Infinity,
): Promise<{ bytes: Uint8Array; rung: ThumbRung }> {
  const w = bbox.x1 - bbox.x0 + 1;
  const h = bbox.y1 - bbox.y0 + 1;
  const scale = size / Math.max(w, h);
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));
  const { data, info } = await rawInput(img, 4)
    .extract({ left: bbox.x0, top: bbox.y0, width: w, height: h })
    .resize(tw, th, { kernel: 'lanczos3', fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let last: { bytes: Uint8Array; rung: ThumbRung } | null = null;
  for (const rung of THUMB_LADDER) {
    const out = bytes(
      await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
        .webp({ quality: rung.quality, alphaQuality: rung.alphaQuality, effort: WEBP_EFFORT })
        .toBuffer(),
    );
    last = { bytes: out, rung };
    if (out.byteLength <= maxBytes) return last;
  }
  return last!;
}

/** Decodes a PNG/WebP/GIF (one `page` of an animation) to straight sRGB RGBA. */
export async function decodeToRgba(input: string | Uint8Array, page = 0): Promise<RgbaImage> {
  const { data, info } = await sharp(input, { page }).ensureAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
}

/** Number of pages (frames) in a GIF / animated WebP; 1 for still images. */
export async function pageCount(input: string | Uint8Array): Promise<number> {
  return (await sharp(input, { pages: -1 }).metadata()).pages ?? 1;
}

/** Decodes a WebP/PNG file to raw channels as stored (no alpha added), for the acceptance tests. */
export async function decodeRaw(input: string | Uint8Array): Promise<{ width: number; height: number; channels: number; data: Uint8Array }> {
  const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, channels: info.channels, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
}

export function mipLevels(): number[] {
  return Array.from({ length: MIP_LEVELS + 1 }, (_, i) => i);
}

// ---- KTX2 (bench only) -------------------------------------------------------------------

/**
 * The package's `exports` map hands Node the `dist/node` build, but TypeScript (bundler
 * resolution, no `node` custom condition) sees the web typings, which lack
 * `NodeBasisEncoder`. We type the Node surface we use ourselves.
 */
interface Ktx2NodeModule {
  encodeToKTX2(imageBuffer: Uint8Array, options?: Partial<IEncodeOptions>): Promise<Uint8Array>;
  NodeBasisEncoder: new () => { init(): Promise<unknown> };
}

async function loadKtx2(): Promise<Ktx2NodeModule> {
  return (await import('ktx2-encoder')) as unknown as Ktx2NodeModule;
}

export async function encodeKtx2Rgba(img: RgbaImage, kind: TextureKind): Promise<Uint8Array> {
  const { encodeToKTX2 } = await loadKtx2();
  // The encoder wants a compressed buffer + decoder; we already hold raw RGBA, so the
  // "decoder" simply returns it.
  return encodeToKTX2(new Uint8Array(0), {
    isUASTC: true,
    isKTX2File: true,
    needSupercompression: true,
    generateMipmap: false,
    enableRDO: false,
    uastcLDRQualityLevel: 2,
    isPerceptual: kind === 'albedo',
    isSetKTX2SRGBTransferFunc: kind === 'albedo',
    isNormalMap: kind === 'normal',
    enableDebug: false,
    imageDecoder: async () => ({ width: img.width, height: img.height, data: img.data }),
  });
}

/** Transcodes a KTX2 (UASTC) file back to RGBA32 — used by `bench` to measure error. */
export async function transcodeKtx2ToRgba(data: Uint8Array): Promise<RgbaImage> {
  const { NodeBasisEncoder } = await loadKtx2();
  const mod = (await new NodeBasisEncoder().init()) as unknown as {
    KTX2File: new (data: Uint8Array) => {
      isValid(): boolean;
      getWidth(): number;
      getHeight(): number;
      startTranscoding(): number;
      getImageTranscodedSizeInBytes(level: number, layer: number, face: number, format: number): number;
      transcodeImage(dst: Uint8Array, level: number, layer: number, face: number, format: number, getAlpha: number, c0: number, c1: number): number;
      close(): void;
      delete(): void;
    };
    transcoder_texture_format: { cTFRGBA32: { value: number } };
  };
  const file = new mod.KTX2File(data);
  try {
    if (!file.isValid() || !file.startTranscoding()) throw new Error('KTX2 transcode: invalid file');
    const fmt = mod.transcoder_texture_format.cTFRGBA32.value;
    const size = file.getImageTranscodedSizeInBytes(0, 0, 0, fmt);
    const dst = new Uint8Array(size);
    if (!file.transcodeImage(dst, 0, 0, 0, fmt, 0, -1, -1)) throw new Error('KTX2 transcode failed');
    return { width: file.getWidth(), height: file.getHeight(), data: dst };
  } finally {
    file.close();
    file.delete();
  }
}

/** Attempts to encode a blank `size`² texture; fails fast on the WASM texel cap. */
export async function probeKtx2(size: number): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await encodeKtx2Rgba({ width: 4, height: 4, data: new Uint8Array(64) }, 'albedo');
    await encodeKtx2Rgba({ width: size, height: size, data: new Uint8Array(size * size * 4) }, 'albedo');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.split('\n')[0]! : String(err) };
  }
}
