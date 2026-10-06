/**
 * The per-sprite and anim caches must hand back exactly the raster the stages produced: the atlases are composed from
 * what the cache returns, never from the in-memory stage output. Until SPRITE_STAGE_VERSION 4 the sprite cache wrote
 * `png({ effort: 4 })`, which sharp turns into a 256-colour dithered palette — every static atlas was built from that.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import type { SpriteMeta } from '../src/cache.js';
import { SpriteCache, losslessPng } from '../src/cache.js';
import { AnimCache } from '../src/anim.js';
import { recoverAlpha } from '../src/alpha.js';
import { deriveEmissive, resolveEmissiveOverride } from '../src/emissive.js';
import { decodeToRgba, pageCount } from '../src/encode.js';
import { normalizeSprite } from '../src/normalize.js';
import { deriveNormalMap } from '../src/normalmap.js';
import { processSprite } from '../src/pipeline.js';
import type { GrayImage, RgbaImage } from '../src/types.js';
import { createGray, createRgba } from '../src/types.js';
import { rng, texturedBlob, tmp, toPng } from './helpers.js';

/** Odd-sized RGBA noise: every channel independent, ≫ 256 distinct colours, a = 0 texels with non-zero RGB. */
function noiseRgba(w: number, h: number, seed: number): RgbaImage {
  const img = createRgba(w, h);
  const rand = rng(seed);
  for (let p = 0; p < w * h; p++) {
    for (let c = 0; c < 3; c++) img.data[p * 4 + c] = Math.floor(rand() * 256);
    // A third transparent, a third opaque, a third any alpha: the shapes the stages produce.
    const r = rand();
    img.data[p * 4 + 3] = r < 1 / 3 ? 0 : r < 2 / 3 ? 255 : Math.floor(rand() * 256);
  }
  return img;
}

/** A smooth two-axis gradient: the content a palette + dither destroys first. */
function gradientRgba(w: number, h: number): RgbaImage {
  const img = createRgba(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) img.data.set([Math.round((255 * x) / (w - 1)), Math.round((255 * y) / (h - 1)), (x + y) & 255, 255], (y * w + x) * 4);
  }
  return img;
}

function everyGrey(w: number, h: number): GrayImage {
  const img = createGray(w, h);
  for (let p = 0; p < w * h; p++) img.data[p] = (p * 7) & 255;
  return img;
}

function distinctRgba(img: RgbaImage): number {
  const s = new Set<number>();
  for (let p = 0; p < img.width * img.height; p++) s.add(((img.data[p * 4]! << 24) | (img.data[p * 4 + 1]! << 16) | (img.data[p * 4 + 2]! << 8) | img.data[p * 4 + 3]!) >>> 0);
  return s.size;
}

function expectSame(got: RgbaImage | GrayImage, want: RgbaImage | GrayImage, what: string): void {
  expect([got.width, got.height], what).toEqual([want.width, want.height]);
  expect(got.data.length, what).toBe(want.data.length);
  let firstDiff = -1;
  for (let i = 0; i < want.data.length && firstDiff < 0; i++) if (got.data[i] !== want.data[i]) firstDiff = i;
  expect(firstDiff, `${what}: first differing byte`).toBe(-1);
}

async function expectTrueColour(file: string, channels: 1 | 4): Promise<void> {
  const md = await sharp(file).metadata();
  expect(md.format, file).toBe('png');
  expect(md.isPalette, file).toBe(false);
  expect(md.depth, file).toBe('uchar');
  expect(md.channels, file).toBe(channels);
  // IHDR colour type at byte 25: 6 = RGBA, 0 = grey; 3 would be indexed (palette).
  expect(readFileSync(file)[25], file).toBe(channels === 4 ? 6 : 0);
}

const META: SpriteMeta = {
  id: 'noise',
  side: 'front',
  source: 'front/noise.png',
  sourceWidth: 97,
  sourceHeight: 83,
  frames: 1,
  frame: 0,
  recovered: false,
  coverage: 0.5,
  flags: [],
  footV: 0.08,
  pixelScale: 1,
  kernel: 'nearest',
  emissivePixels: 0,
  bbox: null,
};

describe('sprite cache round trip', () => {
  it('losslessPng keeps a 1 or 4 channel raster as true colour and refuses anything else', async () => {
    const dir = tmp('png');
    const rgbaFile = path.join(dir, 'a.png');
    const greyFile = path.join(dir, 'g.png');
    writeFileSync(rgbaFile, await losslessPng(noiseRgba(33, 17, 3)));
    writeFileSync(greyFile, await losslessPng(everyGrey(33, 17)));
    await expectTrueColour(rgbaFile, 4);
    await expectTrueColour(greyFile, 1);
    await expect(losslessPng({ width: 4, height: 4, data: new Uint8Array(48) })).rejects.toThrow(/neither RGBA8 nor grey/);
  });

  it('SpriteCache.write → readRgba / readGray is bit-exact (noise with ≫ 256 colours, a gradient, every grey level)', async () => {
    const cache = new SpriteCache(tmp('cache'));
    const albedo = noiseRgba(97, 83, 11);
    const normal = gradientRgba(97, 83);
    const emissive = everyGrey(97, 83);
    expect(distinctRgba(albedo)).toBeGreaterThan(5000);
    expect(distinctRgba(normal)).toBeGreaterThan(5000);
    await cache.write('h', { meta: META, albedo, normal, emissive });
    expect(cache.has('h')).toBe(true);
    expectSame(await cache.readRgba('h', 'albedo'), albedo, 'albedo');
    expectSame(await cache.readRgba('h', 'normal'), normal, 'normal');
    expectSame(await cache.readGray('h'), emissive, 'emissive');
    await expectTrueColour(cache.pngPath('h', 'albedo'), 4);
    await expectTrueColour(cache.pngPath('h', 'normal'), 4);
    await expectTrueColour(cache.pngPath('h', 'emissive'), 1);
    expect(cache.readMeta('h')).toEqual(META);
  });

  it('an opaque raster and an empty (all-zero) raster round-trip with their alpha intact', async () => {
    const cache = new SpriteCache(tmp('cache'));
    const opaque = gradientRgba(64, 64);
    const empty = createRgba(64, 64);
    await cache.write('o', { meta: META, albedo: opaque, normal: empty, emissive: createGray(64, 64) });
    expectSame(await cache.readRgba('o', 'albedo'), opaque, 'opaque albedo');
    expectSame(await cache.readRgba('o', 'normal'), empty, 'empty normal');
  });

  it('processSprite caches exactly what stages 2–4 produce in memory', async () => {
    const dir = tmp('stages');
    const file = path.join(dir, 'blobfront.png');
    writeFileSync(file, await toPng(texturedBlob(160, [255, 255, 255, 255], 41)));
    const bytes = new Uint8Array(readFileSync(file));
    const cache = new SpriteCache(path.join(dir, 'cache'));
    const src = { id: 'blob', side: 'front' as const, file: 'front/blobfront.png', abs: file, sizeScale: 1 };
    const p = await processSprite(src, cache, { spriteSize: 256, force: true, bytes, frames: await pageCount(bytes), frame: 0, alpha: {} });

    const recovered = recoverAlpha(await decodeToRgba(bytes, 0), {});
    const albedo = (await normalizeSprite(recovered.image, recovered.bbox!, 256)).image;
    expect(p.meta.kernel).toBe('lanczos3'); // resampled: thousands of blended colours, which a palette would lose
    expect(distinctRgba(albedo)).toBeGreaterThan(300);
    expectSame(await cache.readRgba(p.hash, 'albedo'), albedo, 'albedo');
    expectSame(await cache.readRgba(p.hash, 'normal'), deriveNormalMap(albedo), 'normal');
    expectSame(await cache.readGray(p.hash), deriveEmissive(albedo, resolveEmissiveOverride('blob')), 'emissive');
  });
});

describe('anim cache round trip', () => {
  it('AnimCache.writeFrame → readFrame is bit-exact and true colour', async () => {
    const cache = new AnimCache(tmp('anim'));
    const frame = { albedo: noiseRgba(64, 48, 21), normal: gradientRgba(64, 48), emissive: everyGrey(64, 48) };
    await cache.writeFrame('s', 3, frame);
    const back = await cache.readFrame('s', 3);
    expectSame(back.albedo, frame.albedo, 'albedo');
    expectSame(back.normal, frame.normal, 'normal');
    expectSame(back.emissive, frame.emissive, 'emissive');
    await expectTrueColour(cache.framePath('s', 3, 'albedo'), 4);
    await expectTrueColour(cache.framePath('s', 3, 'emissive'), 1);
  });
});
