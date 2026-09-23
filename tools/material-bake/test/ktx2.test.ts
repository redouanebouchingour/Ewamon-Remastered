import { describe, expect, it } from 'vitest';
import { encodeKtx2, encodeLevel } from '../src/encode';
import type { Level } from '../src/encode';
import { DF_MODEL_UASTC, DF_TRANSFER_LINEAR, DF_TRANSFER_SRGB, KTX2_IDENTIFIER, SUPERCOMPRESSION_ZSTD, isKtx2, readDfd, readKtx2, writeKtx2 } from '../src/ktx2';

function chain(size: number, fill: (x: number, y: number, s: number) => [number, number, number, number]): Level[] {
  const out: Level[] = [];
  for (let s = size; s >= 1; s >>= 1) {
    const d = new Uint8Array(s * s * 4);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) d.set(fill(x, y, s), (y * s + x) * 4);
    out.push({ width: s, height: s, data: d });
  }
  return out;
}

describe('KTX2 container', () => {
  it('writes a readable container with smallest-first level data', () => {
    const f = {
      header: { vkFormat: 0, typeSize: 1, pixelWidth: 8, pixelHeight: 8, pixelDepth: 0, layerCount: 0, faceCount: 1, levelCount: 2, supercompressionScheme: 2 },
      dfd: new Uint8Array(44), kvd: new Uint8Array([4, 0, 0, 0, 97, 0, 98, 0]), sgd: new Uint8Array(0),
      levels: [{ data: new Uint8Array([1, 2, 3]), uncompressedByteLength: 64 }, { data: new Uint8Array([9]), uncompressedByteLength: 16 }],
    };
    const bytes = writeKtx2(f);
    expect(isKtx2(bytes)).toBe(true);
    const r = readKtx2(bytes);
    expect(r.header.levelCount).toBe(2);
    expect([...r.levels[0]!.data]).toEqual([1, 2, 3]);
    expect([...r.levels[1]!.data]).toEqual([9]);
    expect(r.levels[0]!.uncompressedByteLength).toBe(64);
    // level 1 (smaller) is stored before level 0
    const dv = new DataView(bytes.buffer);
    expect(Number(dv.getBigUint64(80 + 24, true))).toBeLessThan(Number(dv.getBigUint64(80, true)));
  });

  it('encodes a supplied mip chain as one UASTC + zstd KTX2 with the right DFD per map kind', async () => {
    const lv = chain(16, (x, y) => [x * 16, y * 16, 128, 255]);
    for (const kind of ['albedo', 'orm', 'normal'] as const) {
      const bytes = await encodeKtx2(lv, kind, 2);
      expect([...bytes.subarray(0, 12)]).toEqual([...KTX2_IDENTIFIER]);
      const f = readKtx2(bytes);
      expect(f.header.vkFormat).toBe(0);
      expect(f.header.pixelWidth).toBe(16);
      expect(f.header.levelCount).toBe(5);
      expect(f.header.supercompressionScheme).toBe(SUPERCOMPRESSION_ZSTD);
      const dfd = readDfd(f.dfd);
      expect(dfd.colorModel).toBe(DF_MODEL_UASTC);
      expect(dfd.texelBlockDimension).toEqual([4, 4]);
      expect(dfd.transferFunction).toBe(kind === 'albedo' ? DF_TRANSFER_SRGB : DF_TRANSFER_LINEAR);
      // each level decompresses to whole 4×4 UASTC blocks of 16 bytes
      f.levels.forEach((l, i) => {
        const s = Math.max(1, 16 >> i);
        expect(l.uncompressedByteLength).toBe(Math.ceil(s / 4) * Math.ceil(s / 4) * 16);
      });
    }
  });

  it('each assembled level is exactly the single-level encode of that mip (the supplied chain survives)', async () => {
    const lv = chain(8, (x, y, s) => [(x * 255) / s, (y * 255) / s, s * 10, 255]);
    const all = readKtx2(await encodeKtx2(lv, 'orm', 2));
    for (let i = 0; i < lv.length; i++) {
      const single = readKtx2(await encodeLevel(lv[i]!, 'orm', 2));
      expect(Buffer.from(all.levels[i]!.data).equals(Buffer.from(single.levels[0]!.data))).toBe(true);
    }
  });
});
