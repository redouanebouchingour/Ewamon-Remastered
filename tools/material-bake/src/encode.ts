/**
 * KTX2 encoding (SPEC §40.3.3): ktx2-encoder@0.6.0's Basis module, UASTC LDR + RDO + Zstandard, with the
 * bake's own mip chain.
 *
 * The spec's wrapper idea — pass the mips as extra slices through setSliceSourceImage — is rejected by the
 * Basis encoder ("Inputs do not satisfy .KTX2 texture constraints: all source images must be the same
 * resolution"), and the embind API exposes no per-level source (m_source_mipmap_images is not bound). So each
 * level is encoded as its own single-level UASTC+RDO+zstd KTX2 with the exact spec options, and the levels'
 * (independently supercompressed) payloads are assembled into one KTX2 with the DFD/KVD of level 0. The result
 * is byte-for-byte what a supplied-mip Basis encode would store per level. IMPLEMENTATION-NOTES D1.
 */
import { NodeBasisEncoder } from 'ktx2-encoder';
import { readKtx2, writeKtx2 } from './ktx2';
import type { Ktx2Level } from './ktx2';

export type MapKind = 'albedo' | 'orm' | 'normal';

/** One mip level, RGBA8, top row first. */
export interface Level { readonly width: number; readonly height: number; readonly data: Uint8Array }

export const ENCODER_VERSION = 'ktx2-encoder@0.6.0';
export const DEFAULT_RDO = 2.0;
/**
 * UASTC pack level. §40.3.3 names 2; measured on this repo's recipes, level 0 gives the same PSNR on albedo
 * (cobble 48.2 vs 48.3 dB) at 0.59× the bytes and ~5× the speed, and is what makes the byte targets reachable
 * (IMPLEMENTATION-NOTES D2).
 */
export const UASTC_LDR_QUALITY = 0;

/**
 * RDO profile from the per-surface `rdo` scalar (§40.3.5 lever). Up to 2.0 the Basis defaults hold (skip-block
 * RMS threshold 8, max RMS increase ratio 10); above it both widen to 8 × rdo, without which the lambda has
 * almost no effect on noisy blocks (they are skipped): measured on path_gravel albedo, λ 8 alone saves 1 %, λ 8
 * with the widened thresholds 18 %.
 */
export function rdoProfile(rdo: number): { readonly lambda: number; readonly skipRms: number; readonly maxRmsRatio: number } {
  return rdo <= 2 ? { lambda: rdo, skipRms: 8, maxRmsRatio: 10 } : { lambda: rdo, skipRms: 8 * rdo, maxRmsRatio: 8 * rdo };
}

/** The encoder settings that change bytes; part of every cache hash. */
export function settingsKey(rdo: number): string {
  const p = rdoProfile(rdo);
  return `${ENCODER_VERSION};uastc;pack${UASTC_LDR_QUALITY};rdo=${p.lambda.toFixed(3)}/${p.skipRms}/${p.maxRmsRatio};zstd;mips=supplied-per-level`;
}

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
  if (!modulePromise) modulePromise = new NodeBasisEncoder().init() as unknown as Promise<BasisModule>;
  return modulePromise;
}

/** §40.0 non-negotiable 8: probe the encoder before any work; one clear message on failure. */
export async function probeEncoder(): Promise<void> {
  try {
    const bytes = await encodeLevel({ width: 4, height: 4, data: new Uint8Array(64).fill(128) }, 'orm', DEFAULT_RDO);
    readKtx2(bytes);
  } catch (e) {
    throw new Error(`KTX2 encoder unavailable (${ENCODER_VERSION} Basis WASM failed to initialise or encode): ${(e as Error).message}`);
  }
}

/** Encode one image as a single-level KTX2 with the §40.3.3 options. */
export async function encodeLevel(level: Level, kind: MapKind, rdo: number): Promise<Uint8Array> {
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
    if (kind === 'albedo') {
      if (e.setKTX2AndBasisSRGBTransferFunc) e.setKTX2AndBasisSRGBTransferFunc(true); else e.setKTX2SRGBTransferFunc?.(true);
    } else if (e.setKTX2AndBasisSRGBTransferFunc) e.setKTX2AndBasisSRGBTransferFunc(false); else e.setKTX2SRGBTransferFunc?.(false);
    e.setMipGen(false);
    if (kind === 'normal') { if (e.setNormalMapPreset) e.setNormalMapPreset(); else e.setNormalMap?.(); }
    const prof = rdoProfile(rdo);
    e.setRDOUASTC(true);
    e.setRDOUASTCQualityScalar(prof.lambda);
    e.setRDOUASTCSkipBlockRMSThresh(prof.skipRms);
    e.setRDOUASTCMaxAllowedRMSIncreaseRatio(prof.maxRmsRatio);
    e.setPackUASTCFlags(UASTC_LDR_QUALITY);
    e.setPerceptual(kind === 'albedo');
    e.setTexType(0);
    if (e.setSliceSourceImage(0, level.data, level.width, level.height, 0) === false) {
      throw new Error(`setSliceSourceImage failed (${level.width}x${level.height})`);
    }
    let cap = level.width * level.height * 4 + 64 * 1024;
    for (let attempt = 0; attempt < 2; attempt++) {
      const out = new Uint8Array(cap);
      const n = e.encode(out);
      if (n > 0) return out.slice(0, n);
      cap *= 2;
    }
    throw new Error(`Basis encode failed for a ${level.width}x${level.height} ${kind} level`);
  } finally {
    e.delete();
  }
}

/** Encode a full mip chain (level 0 first) into one KTX2. */
export async function encodeKtx2(levels: readonly Level[], kind: MapKind, rdo: number): Promise<Uint8Array> {
  if (levels.length === 0) throw new Error('encodeKtx2: empty mip chain');
  const parts: Ktx2Level[] = [];
  let first: ReturnType<typeof readKtx2> | null = null;
  for (const lv of levels) {
    const f = readKtx2(await encodeLevel(lv, kind, rdo));
    if (f.header.levelCount !== 1 && f.header.levelCount !== 0) throw new Error(`expected a single-level encode, got ${f.header.levelCount}`);
    if (!first) first = f;
    parts.push(f.levels[0]!);
  }
  return writeKtx2({
    header: { ...first!.header, levelCount: parts.length },
    dfd: first!.dfd,
    kvd: first!.kvd,
    sgd: first!.sgd,
    levels: parts,
  });
}
