/**
 * KTX2 encoding for model textures (SPEC §40.2.4): ktx2-encoder@0.6.0's Basis module (Basis Universal 2.5 WASM),
 * UASTC LDR + RDO + Zstandard supercompression + Basis-generated mip chain, sRGB transfer + perceptual metric for
 * colour slots, the normal-map preset for normals.
 *
 * §40.2.4 names `encodeToKTX2(bytes, { isUASTC, isKTX2File, needSupercompression, enableRDO, rdoQualityLevel,
 * generateMipmap, isPerceptual, isSetKTX2SRGBTransferFunc, isNormalMap, imageDecoder })`. That wrapper sets exactly
 * the encoder calls below (read in `ktx2-encoder/dist/applyInputOptions.js` / `encodeCore.js`) but leaves Basis'
 * status printer on (hundreds of lines per texture on stdout) and cannot set the RDO thresholds, so the same
 * `BasisEncoder` is driven directly (IMPLEMENTATION-NOTES M7). The embind API has no Zstandard level setter
 * (the prototype was listed: no `setKTX2ZstdSupercompressionLevel`), so §40.2.4's `zstd: 18` is Basis' default.
 */
import { NodeBasisEncoder } from 'ktx2-encoder';

export const ENCODER_VERSION = 'ktx2-encoder@0.6.0';

export interface Ktx2Options {
  /** sRGB transfer function + perceptual error metric (colour slots). */
  readonly srgb: boolean;
  readonly normalMap: boolean;
  /** RDO λ (`rdoQualityLevel`). */
  readonly rdo: number;
  /** UASTC LDR pack level 0–4 (`uastcLDRQualityLevel`). */
  readonly pack: number;
  readonly mipmaps: boolean;
}

/** RGBA8, top row first. */
export interface RgbaImage { readonly width: number; readonly height: number; readonly data: Uint8Array }

interface BasisEncoder {
  setDebug(v: boolean): void;
  setStatusOutput?(v: boolean): void;
  setPrintStats?(v: boolean): void;
  setComputeStats?(v: boolean): void;
  setUASTC(v: boolean): void;
  setCreateKTX2File(v: boolean): void;
  setKTX2UASTCSupercompression(v: boolean): void;
  setRDOUASTC(v: boolean): void;
  setRDOUASTCQualityScalar(v: number): void;
  setRDOUASTCSkipBlockRMSThresh(v: number): void;
  setRDOUASTCMaxAllowedRMSIncreaseRatio(v: number): void;
  setPackUASTCFlags(v: number): void;
  setMipGen(v: boolean): void;
  setPerceptual(v: boolean): void;
  setKTX2AndBasisSRGBTransferFunc?(v: boolean): void;
  setKTX2SRGBTransferFunc?(v: boolean): void;
  setMipSRGB?(v: boolean): void;
  setNormalMapPreset?(): void;
  setNormalMap?(): void;
  setTexType(t: number): void;
  setSliceSourceImage(i: number, data: Uint8Array, w: number, h: number, type: number): boolean | void;
  encode(out: Uint8Array): number;
  delete(): void;
}
interface BasisModule { BasisEncoder: new () => BasisEncoder }

let modulePromise: Promise<BasisModule> | null = null;
function basis(): Promise<BasisModule> {
  modulePromise ??= new NodeBasisEncoder().init() as unknown as Promise<BasisModule>;
  return modulePromise;
}

/**
 * RDO profile for a λ: up to 2.0 the Basis defaults (skip-block RMS 8, max RMS increase 10); above it both widen
 * to 8 × λ — without that, Basis skips RDO on every textured block whose RMS error exceeds 8 and λ does almost
 * nothing (the same finding as `tools/material-bake` IMPLEMENTATION-NOTES D2).
 */
export function rdoProfile(rdo: number): { readonly lambda: number; readonly skipRms: number; readonly maxRmsRatio: number } {
  return rdo <= 2 ? { lambda: rdo, skipRms: 8, maxRmsRatio: 10 } : { lambda: rdo, skipRms: 8 * rdo, maxRmsRatio: 8 * rdo };
}

export function settingsKey(o: Ktx2Options): string {
  const p = rdoProfile(o.rdo);
  return `${ENCODER_VERSION};uastc;pack${o.pack};rdo=${p.lambda}/${p.skipRms}/${p.maxRmsRatio};zstd;srgb=${o.srgb};normal=${o.normalMap};mips=${o.mipmaps ? 'basis' : 'none'}`;
}

export async function encodeKtx2(img: RgbaImage, o: Ktx2Options): Promise<Uint8Array> {
  const mod = await basis();
  const e = new mod.BasisEncoder();
  try {
    e.setDebug(false);
    e.setStatusOutput?.(false);
    e.setPrintStats?.(false);
    e.setComputeStats?.(false);
    e.setUASTC(true);
    e.setCreateKTX2File(true);
    e.setKTX2UASTCSupercompression(true);
    if (e.setKTX2AndBasisSRGBTransferFunc) e.setKTX2AndBasisSRGBTransferFunc(o.srgb); else e.setKTX2SRGBTransferFunc?.(o.srgb);
    e.setMipSRGB?.(o.srgb);
    e.setMipGen(o.mipmaps);
    if (o.normalMap) { if (e.setNormalMapPreset) e.setNormalMapPreset(); else e.setNormalMap?.(); }
    const p = rdoProfile(o.rdo);
    e.setRDOUASTC(true);
    e.setRDOUASTCQualityScalar(p.lambda);
    e.setRDOUASTCSkipBlockRMSThresh(p.skipRms);
    e.setRDOUASTCMaxAllowedRMSIncreaseRatio(p.maxRmsRatio);
    e.setPackUASTCFlags(o.pack);
    e.setPerceptual(o.srgb);
    e.setTexType(0);
    if (e.setSliceSourceImage(0, img.data, img.width, img.height, 0) === false) throw new Error(`setSliceSourceImage failed (${img.width}x${img.height})`);
    let cap = Math.ceil(img.width * img.height * 4 * (4 / 3)) + 64 * 1024;
    for (let attempt = 0; attempt < 2; attempt++) {
      const out = new Uint8Array(cap);
      const n = e.encode(out);
      if (n > 0) return out.slice(0, n);
      cap *= 2;
    }
    throw new Error(`Basis encode failed for a ${img.width}x${img.height} image`);
  } finally {
    e.delete();
  }
}

// ---- container inspection (tests, manifest) ------------------------------------------------------------------

export const KTX2_IDENTIFIER = Object.freeze([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);
export const SUPERCOMPRESSION_ZSTD = 2;

export interface Ktx2Header {
  readonly vkFormat: number;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly levelCount: number;
  readonly supercompressionScheme: number;
  /** KHR_DF_MODEL (166 = UASTC). */
  readonly colorModel: number;
  /** KHR_DF_TRANSFER (1 linear, 2 sRGB). */
  readonly transfer: number;
}

export function isKtx2(buf: Uint8Array): boolean {
  if (buf.length < 80) return false;
  for (let i = 0; i < 12; i++) if (buf[i] !== KTX2_IDENTIFIER[i]) return false;
  return true;
}

export function readKtx2Header(buf: Uint8Array): Ktx2Header {
  if (!isKtx2(buf)) throw new Error('not a KTX2 file (identifier mismatch)');
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const dfdOff = dv.getUint32(48, true);
  const w2 = dv.getUint32(dfdOff + 4 + 8, true);
  return {
    vkFormat: dv.getUint32(12, true),
    pixelWidth: dv.getUint32(20, true),
    pixelHeight: dv.getUint32(24, true),
    levelCount: dv.getUint32(40, true),
    supercompressionScheme: dv.getUint32(44, true),
    colorModel: w2 & 0xff,
    transfer: (w2 >> 16) & 0xff,
  };
}

/**
 * §40.2.4 `probeKtx2(2048)`: can this machine encode a 2048² UASTC KTX2? A failure selects the WebP fallback.
 * The probe image is flat (it encodes in well under a second) — the probe tests the WASM, not the content.
 */
export async function probeKtx2(size = 2048): Promise<{ readonly ok: boolean; readonly error: string | null }> {
  try {
    const data = new Uint8Array(size * size * 4).fill(128);
    const out = await encodeKtx2({ width: size, height: size, data }, { srgb: false, normalMap: false, rdo: 2, pack: 0, mipmaps: false });
    const h = readKtx2Header(out);
    if (h.pixelWidth !== size || h.pixelHeight !== size) throw new Error(`probe produced ${h.pixelWidth}x${h.pixelHeight}`);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
