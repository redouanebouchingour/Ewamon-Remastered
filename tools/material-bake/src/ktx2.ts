/**
 * Minimal KTX2 container reader/writer (Khronos KTX 2.0 §3). Enough to (a) take the single-level files the
 * Basis encoder writes, (b) assemble them into one file whose level index carries the bake's own mip chain,
 * and (c) let the tests check the header, level count and DFD of what we ship.
 */

export const KTX2_IDENTIFIER = new Uint8Array([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);

export const SUPERCOMPRESSION_ZSTD = 2;
/** KHR_DF_MODEL_UASTC. */
export const DF_MODEL_UASTC = 166;
export const DF_TRANSFER_LINEAR = 1;
export const DF_TRANSFER_SRGB = 2;

export interface Ktx2Header {
  readonly vkFormat: number; readonly typeSize: number;
  readonly pixelWidth: number; readonly pixelHeight: number; readonly pixelDepth: number;
  readonly layerCount: number; readonly faceCount: number; readonly levelCount: number;
  readonly supercompressionScheme: number;
}

export interface Ktx2Level { readonly data: Uint8Array; readonly uncompressedByteLength: number }

export interface Ktx2File {
  readonly header: Ktx2Header;
  readonly dfd: Uint8Array;
  readonly kvd: Uint8Array;
  readonly sgd: Uint8Array;
  /** Level 0 (largest) first. */
  readonly levels: readonly Ktx2Level[];
}

export interface DfdInfo {
  readonly colorModel: number; readonly colorPrimaries: number; readonly transferFunction: number; readonly flags: number;
  readonly texelBlockDimension: readonly [number, number]; readonly bytesPlane0: number; readonly samples: number;
  /** Channel id of sample 0 (UASTC: 0 = RGB, 3 = RGBA). */
  readonly channelId0: number;
}

export function isKtx2(buf: Uint8Array): boolean {
  if (buf.length < 80) return false;
  for (let i = 0; i < 12; i++) if (buf[i] !== KTX2_IDENTIFIER[i]) return false;
  return true;
}

export function readKtx2(buf: Uint8Array): Ktx2File {
  if (!isKtx2(buf)) throw new Error('not a KTX2 file (identifier mismatch)');
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const u32 = (o: number): number => dv.getUint32(o, true);
  const u64 = (o: number): number => Number(dv.getBigUint64(o, true));
  const header: Ktx2Header = {
    vkFormat: u32(12), typeSize: u32(16), pixelWidth: u32(20), pixelHeight: u32(24), pixelDepth: u32(28),
    layerCount: u32(32), faceCount: u32(36), levelCount: u32(40), supercompressionScheme: u32(44),
  };
  const dfdOff = u32(48), dfdLen = u32(52), kvdOff = u32(56), kvdLen = u32(60);
  const sgdOff = u64(64), sgdLen = u64(72);
  const levels: Ktx2Level[] = [];
  const n = Math.max(1, header.levelCount);
  for (let l = 0; l < n; l++) {
    const o = 80 + l * 24;
    const off = u64(o), len = u64(o + 8), unc = u64(o + 16);
    levels.push({ data: buf.slice(off, off + len), uncompressedByteLength: unc });
  }
  return {
    header,
    dfd: buf.slice(dfdOff, dfdOff + dfdLen),
    kvd: buf.slice(kvdOff, kvdOff + kvdLen),
    sgd: buf.slice(sgdOff, sgdOff + sgdLen),
    levels,
  };
}

const align = (n: number, a: number): number => Math.ceil(n / a) * a;

/** Write a KTX2 file. Level data is laid out smallest level first, as the spec requires. */
export function writeKtx2(f: Ktx2File): Uint8Array {
  const L = f.levels.length;
  const levelAlign = f.header.supercompressionScheme !== 0 ? 1 : 16;
  const dfdOff = 80 + 24 * L;
  const kvdOff = f.kvd.length ? align(dfdOff + f.dfd.length, 4) : 0;
  let end = kvdOff ? kvdOff + f.kvd.length : dfdOff + f.dfd.length;
  const sgdOff = f.sgd.length ? align(end, 8) : 0;
  if (sgdOff) end = sgdOff + f.sgd.length;
  const offsets: number[] = new Array<number>(L).fill(0);
  let cur = end;
  for (let l = L - 1; l >= 0; l--) {
    cur = align(cur, levelAlign);
    offsets[l] = cur;
    cur += f.levels[l]!.data.length;
  }
  const out = new Uint8Array(cur);
  const dv = new DataView(out.buffer);
  out.set(KTX2_IDENTIFIER, 0);
  const h = f.header;
  [h.vkFormat, h.typeSize, h.pixelWidth, h.pixelHeight, h.pixelDepth, h.layerCount, h.faceCount, L, h.supercompressionScheme]
    .forEach((v, k) => dv.setUint32(12 + k * 4, v, true));
  dv.setUint32(48, dfdOff, true); dv.setUint32(52, f.dfd.length, true);
  dv.setUint32(56, kvdOff, true); dv.setUint32(60, f.kvd.length, true);
  dv.setBigUint64(64, BigInt(sgdOff), true); dv.setBigUint64(72, BigInt(f.sgd.length), true);
  for (let l = 0; l < L; l++) {
    const o = 80 + l * 24;
    dv.setBigUint64(o, BigInt(offsets[l]!), true);
    dv.setBigUint64(o + 8, BigInt(f.levels[l]!.data.length), true);
    dv.setBigUint64(o + 16, BigInt(f.levels[l]!.uncompressedByteLength), true);
    out.set(f.levels[l]!.data, offsets[l]!);
  }
  out.set(f.dfd, dfdOff);
  if (kvdOff) out.set(f.kvd, kvdOff);
  if (sgdOff) out.set(f.sgd, sgdOff);
  return out;
}

/** Parse the basic data-format descriptor block (first block of the DFD). */
export function readDfd(dfd: Uint8Array): DfdInfo {
  const dv = new DataView(dfd.buffer, dfd.byteOffset, dfd.byteLength);
  // dfd[0..3] = dfdTotalSize; block header at 4
  const blockSize = dv.getUint16(4 + 6, true);
  const w2 = dv.getUint32(4 + 8, true);
  const w3 = dv.getUint32(4 + 12, true);
  const w4 = dv.getUint32(4 + 16, true);
  return {
    colorModel: w2 & 0xff,
    colorPrimaries: (w2 >> 8) & 0xff,
    transferFunction: (w2 >> 16) & 0xff,
    flags: (w2 >>> 24) & 0xff,
    texelBlockDimension: [(w3 & 0xff) + 1, ((w3 >> 8) & 0xff) + 1],
    bytesPlane0: w4 & 0xff,
    samples: Math.max(0, (blockSize - 24) / 16),
    channelId0: blockSize >= 40 ? dfd[4 + 24 + 3]! & 0x0f : -1,
  };
}
