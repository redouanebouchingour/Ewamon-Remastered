/**
 * Stage 5 — texture encoding.
 *
 * Two back-ends behind one interface:
 *   - `ktx2-uastc`: ktx2-encoder's Node API (Basis Universal WASM), UASTC LDR + Zstandard
 *     supercompression, sRGB flag on albedo, normal-map preset on normals.
 *   - `webp`: lossless WebP for albedo + normal, lossy q=80 for the emissive mask.
 *
 * `selectEncoding('auto', atlasSize)` probes whether the KTX2 encoder accepts an atlas of
 * that size in this runtime; the bundled Basis v2.5 WASM caps sources at 12 Mpix, so a
 * 4096² atlas (16.8 Mpix) is refused and the pipeline falls back to WebP (see README).
 */
import type { IEncodeOptions } from 'ktx2-encoder';
import sharp from 'sharp';
import type { ManifestEncoding } from './manifest.js';
import type { GrayImage, RgbaImage } from './types.js';

export type EncodingRequest = 'auto' | 'ktx2' | 'webp';
export type TextureKind = 'albedo' | 'normal' | 'emissive';

export interface TextureEncoder {
  encoding: ManifestEncoding;
  ext: string;
  /** Stable string folded into cache keys — changes whenever output bytes could change. */
  settingsKey: string;
  encodeRgba(img: RgbaImage, kind: 'albedo' | 'normal'): Promise<Uint8Array>;
  encodeGray(img: GrayImage): Promise<Uint8Array>;
}

export const WEBP_LOSSLESS_EFFORT = 6;
export const WEBP_EMISSIVE_QUALITY = 80;

function rawInput(img: RgbaImage | GrayImage, channels: 1 | 4): sharp.Sharp {
  return sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), {
    raw: { width: img.width, height: img.height, channels },
  });
}

export function createWebpEncoder(): TextureEncoder {
  return {
    encoding: 'webp',
    ext: 'webp',
    settingsKey: `webp:lossless-e${WEBP_LOSSLESS_EFFORT}:emissive-q${WEBP_EMISSIVE_QUALITY}`,
    async encodeRgba(img) {
      const buf = await rawInput(img, 4).webp({ lossless: true, effort: WEBP_LOSSLESS_EFFORT, alphaQuality: 100 }).toBuffer();
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    },
    async encodeGray(img) {
      // WebP has no single-channel mode; the mask is replicated to RGB and lives in R.
      const buf = await rawInput(img, 1).toColourspace('srgb').webp({ quality: WEBP_EMISSIVE_QUALITY, effort: WEBP_LOSSLESS_EFFORT }).toBuffer();
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    },
  };
}

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

function grayToRgba(img: GrayImage): RgbaImage {
  const out = new Uint8Array(img.width * img.height * 4);
  for (let p = 0; p < img.data.length; p++) {
    const v = img.data[p]!;
    out[p * 4] = v;
    out[p * 4 + 1] = v;
    out[p * 4 + 2] = v;
    out[p * 4 + 3] = 255;
  }
  return { width: img.width, height: img.height, data: out };
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

export function createKtx2Encoder(): TextureEncoder {
  return {
    encoding: 'ktx2-uastc',
    ext: 'ktx2',
    settingsKey: 'ktx2:uastc-q2:zstd:nomips',
    encodeRgba: (img, kind) => encodeKtx2Rgba(img, kind),
    encodeGray: (img) => encodeKtx2Rgba(grayToRgba(img), 'emissive'),
  };
}

/** Transcodes a KTX2 (UASTC) file back to RGBA32 — used by `bench` to measure error. */
export async function transcodeKtx2ToRgba(bytes: Uint8Array): Promise<RgbaImage> {
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
  const file = new mod.KTX2File(bytes);
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

export interface EncodingSelection {
  encoder: TextureEncoder;
  /** Human-readable reason, printed by the CLI and recorded in the README. */
  reason: string;
}

export async function selectEncoding(request: EncodingRequest, atlasSize: number): Promise<EncodingSelection> {
  if (request === 'webp') return { encoder: createWebpEncoder(), reason: 'webp requested' };
  const probe = await probeKtx2(atlasSize);
  if (probe.ok) return { encoder: createKtx2Encoder(), reason: `ktx2-encoder accepts ${atlasSize}px sources` };
  if (request === 'ktx2') throw new Error(`KTX2 encoding requested but unavailable: ${probe.error}`);
  return { encoder: createWebpEncoder(), reason: `KTX2 unavailable for ${atlasSize}px atlases (${probe.error}); using WebP` };
}

/** Attempts to encode a blank `size`² texture; fails fast on the WASM texel cap. */
export async function probeKtx2(size: number): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    // Real encode of a tiny image proves the WASM loads; the size check trips on the cap
    // before any encoding work happens, so probing the full size is cheap when it fails.
    await encodeKtx2Rgba({ width: 4, height: 4, data: new Uint8Array(64) }, 'albedo');
    await encodeKtx2Rgba({ width: size, height: size, data: new Uint8Array(size * size * 4) }, 'albedo');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.split('\n')[0]! : String(err) };
  }
}

/** Decodes a PNG/WebP file to straight RGBA. */
export async function decodeToRgba(input: string | Uint8Array): Promise<RgbaImage> {
  const { data, info } = await sharp(input).ensureAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
}
