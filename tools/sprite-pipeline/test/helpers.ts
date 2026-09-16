/** Synthetic sprite builders shared by the pipeline tests. */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import type { RgbaImage } from '../src/types.js';
import { createRgba } from '../src/types.js';

export type Rgba = [number, number, number, number];

/** A `size`² canvas filled with `bg`, with a `body`-coloured filled ellipse in the middle. */
export function blob(size: number, bg: Rgba, body: Rgba, radiusFrac = 0.3, cx = 0.5, cy = 0.55): RgbaImage {
  const img = createRgba(size, size);
  const rx = size * radiusFrac;
  const ry = size * radiusFrac * 1.2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - cx * size) / rx;
      const dy = (y + 0.5 - cy * size) / ry;
      const inside = dx * dx + dy * dy <= 1;
      const c = inside ? body : bg;
      const i = (y * size + x) * 4;
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = c[3];
    }
  }
  return img;
}

export function alphaAt(img: RgbaImage, x: number, y: number): number {
  return img.data[(y * img.width + x) * 4 + 3]!;
}

export function opaqueFraction(img: RgbaImage): number {
  let n = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i]! >= 128) n++;
  return n / (img.width * img.height);
}

export async function toPng(img: RgbaImage): Promise<Buffer> {
  return sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), {
    raw: { width: img.width, height: img.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

export function tmp(prefix: string): string {
  return mkdtempSync(path.join(tmpdir(), `ewa-sprites-${prefix}-`));
}

/** Writes a synthetic `front/` + `back/` pair for each id under `dir`; returns the dir. */
export async function writeSyntheticAssets(dir: string, ids: string[], size = 96): Promise<string> {
  mkdirSync(path.join(dir, 'front'), { recursive: true });
  mkdirSync(path.join(dir, 'back'), { recursive: true });
  for (const [k, id] of ids.entries()) {
    const hue = (k * 70) % 255;
    const body: Rgba = [255 - hue, hue, 90 + k * 20, 255];
    // Front: white background (needs recovery). Back: real alpha.
    writeFileSync(path.join(dir, 'front', `${id}front.png`), await toPng(blob(size, [255, 255, 255, 255], body, 0.28)));
    writeFileSync(path.join(dir, 'back', `${id}back.png`), await toPng(blob(size, [0, 0, 0, 0], body, 0.25)));
  }
  return dir;
}
