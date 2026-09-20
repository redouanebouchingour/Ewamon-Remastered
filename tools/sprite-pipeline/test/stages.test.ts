import { describe, expect, it } from 'vitest';
import { alphaBbox } from '../src/alpha.js';
import { deriveEmissive } from '../src/emissive.js';
import { boxDownPremultiplied, buildAlphaMipChain, buildMaskMipChain, coverageFraction, renormalize, toFloatAlpha } from '../src/mips.js';
import { chooseKernel, computePlacement, normalizeSprite } from '../src/normalize.js';
import { deriveNormalMap } from '../src/normalmap.js';
import { FILL_FRACTION, FOOT_V, MANIFEST_FOOT_V, createGray, createRgba } from '../src/types.js';
import { alphaAt, blob, texturedBlob } from './helpers.js';

describe('normalize', () => {
  it('a 300×480 input becomes 1024² with the foot line at round((1 − footV) × 1024) = 942 ± 1', async () => {
    const src = createRgba(300, 480);
    for (let y = 0; y < 480; y++) for (let x = 0; x < 300; x++) src.data.set([80, 90, 200, 255], (y * 300 + x) * 4);
    const { image, placement } = await normalizeSprite(src, { x0: 0, y0: 0, x1: 299, y1: 479 }, 1024);
    expect(image.width).toBe(1024);
    expect(image.height).toBe(1024);
    const bbox = alphaBbox(image)!;
    const footY = Math.round((1 - MANIFEST_FOOT_V) * 1024);
    expect(footY).toBe(942);
    expect(Math.abs(bbox.y1 + 1 - footY)).toBeLessThanOrEqual(1);
    expect(bbox.y1 - bbox.y0 + 1).toBe(Math.round(FILL_FRACTION * 1024)); // 881, the long edge
    expect(placement.footV).toBe(FOOT_V);
    // Centred horizontally.
    expect(Math.abs(bbox.x0 - (1024 - (bbox.x1 - bbox.x0 + 1)) / 2)).toBeLessThanOrEqual(1);
  });

  it('integer factors resample with nearest: a 2-colour checker stays 2 colours', async () => {
    // A 4× upscale: bbox longest edge must be 881/4 -> not an integer; use a canvas where it is.
    const canvas = 1024;
    const fill = Math.round(FILL_FRACTION * canvas); // 881
    // Make bbox long edge = 881 exactly (scale 1) -> nearest. Then a 2-colour checker survives.
    const src = createRgba(fill, fill);
    for (let y = 0; y < fill; y++) for (let x = 0; x < fill; x++) src.data.set((x + y) % 2 ? [255, 0, 0, 255] : [0, 0, 255, 255], (y * fill + x) * 4);
    const { image, placement } = await normalizeSprite(src, { x0: 0, y0: 0, x1: fill - 1, y1: fill - 1 }, canvas);
    expect(placement.kernel).toBe('nearest');
    const colours = new Set<string>();
    for (let p = 0; p < image.width * image.height; p++) {
      if (image.data[p * 4 + 3] === 0) continue;
      colours.add(image.data.subarray(p * 4, p * 4 + 3).join(','));
    }
    expect(colours.size).toBe(2);
  });

  it('chooseKernel picks nearest for integers and their reciprocals, lanczos3 otherwise', () => {
    expect(chooseKernel(2)).toBe('nearest');
    expect(chooseKernel(0.5)).toBe('nearest');
    expect(chooseKernel(1 / 3)).toBe('nearest');
    expect(chooseKernel(1.7)).toBe('lanczos3');
    expect(computePlacement(100, 200, 1024).scale).toBeCloseTo(881 / 200, 6);
  });
});

describe('normal map', () => {
  it('a flat opaque input encodes to exactly (128, 128, 255)', () => {
    const img = createRgba(64, 64);
    for (let p = 0; p < 64 * 64; p++) img.data.set([120, 120, 120, 255], p * 4);
    const n = deriveNormalMap(img);
    // Away from the (image-edge) bevel band.
    for (const [x, y] of [[32, 32], [20, 40], [45, 12]] as const) {
      const i = (y * 64 + x) * 4;
      expect([...n.data.subarray(i, i + 4)]).toEqual([128, 128, 255, 255]);
    }
  });

  it('a transparent texel encodes the flat normal and keeps alpha 0', () => {
    const n = deriveNormalMap(blob(48, [0, 0, 0, 0], [200, 200, 200, 255]));
    expect([...n.data.subarray(0, 4)]).toEqual([128, 128, 255, 0]);
  });

  it('the bevel tilts edge normals outward', () => {
    const n = deriveNormalMap(blob(96, [0, 0, 0, 0], [150, 150, 150, 255], 0.3));
    const bbox = alphaBbox(n)!;
    const y = Math.round((bbox.y0 + bbox.y1) / 2);
    const left = (y * 96 + bbox.x0) * 4;
    expect(n.data[left]!).toBeLessThan(110); // pointing -x at the left edge
    const right = (y * 96 + bbox.x1) * 4;
    expect(n.data[right]!).toBeGreaterThan(146);
  });

  it('renormalize returns unit vectors and the flat normal for transparent texels', () => {
    const img = createRgba(2, 1);
    img.data.set([200, 200, 200, 255, 10, 10, 10, 0]);
    renormalize(img);
    const x = (img.data[0]! - 128) / 127;
    const y = (img.data[1]! - 128) / 127;
    const z = (img.data[2]! - 128) / 127;
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 1);
    expect([...img.data.subarray(4, 8)]).toEqual([128, 128, 255, 0]);
  });
});

describe('emissive mask', () => {
  it('covers the saturated bright region and nothing else', () => {
    const size = 128;
    const img = createRgba(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const hot = x >= 40 && x < 72 && y >= 40 && y < 72;
        img.data.set(hot ? [255, 40, 250, 255] : [110, 100, 90, 255], (y * size + x) * 4);
      }
    }
    const m = deriveEmissive(img);
    let inside = 0;
    let outside = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const hot = x >= 41 && x < 71 && y >= 41 && y < 71; // eroded by 1 px
        const v = m.data[y * size + x]!;
        if (hot) inside += v === 255 ? 1 : 0;
        else if (!(x >= 40 && x < 72 && y >= 40 && y < 72)) outside += v === 0 ? 0 : 1;
      }
    }
    expect(inside).toBe(30 * 30);
    expect(outside).toBe(0);
  });
});

describe('mip chain', () => {
  it('premultiplied box filter ignores the RGB of transparent texels and averages alpha', () => {
    const img = createRgba(2, 2);
    img.data.set([200, 0, 0, 255, 255, 255, 255, 0, 200, 0, 0, 255, 255, 255, 255, 0]);
    const down = boxDownPremultiplied(toFloatAlpha(img));
    expect([...down.rgb]).toEqual([200, 0, 0]);
    expect(down.alpha[0]).toBeCloseTo(127.5, 5);
  });

  it('preserves coverage within 1 % per level and never fills fully transparent footprints', () => {
    const level0 = texturedBlob(256, [0, 0, 0, 0], 42, 0.3);
    const chain = buildAlphaMipChain(level0, 3, 256);
    const c0 = coverageFraction(toFloatAlpha(level0).alpha, 256, 0, 0, 256, 256);
    let size = 256;
    for (const level of chain) {
      size >>= 1;
      expect(level.width).toBe(size);
      const c = coverageFraction(toFloatAlpha(level).alpha, size, 0, 0, size, size);
      expect(Math.abs(c - c0) / c0).toBeLessThanOrEqual(0.01);
    }
    // Footprint check on level 1.
    const l1 = chain[0]!;
    for (let y = 0; y < l1.height; y++) {
      for (let x = 0; x < l1.width; x++) {
        const allZero = [0, 1].every((dy) => [0, 1].every((dx) => alphaAt(level0, x * 2 + dx, y * 2 + dy) === 0));
        if (allZero) expect(alphaAt(l1, x, y)).toBe(0);
      }
    }
  });

  it('the mask chain stays two-valued', () => {
    const mask = createGray(8, 8);
    for (let p = 0; p < 64; p++) mask.data[p] = p % 3 === 0 ? 255 : 0;
    for (const level of buildMaskMipChain(mask, 3)) for (const v of level.data) expect(v === 0 || v === 255).toBe(true);
  });
});
