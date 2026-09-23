/** Synthetic sprite builders and fixture builds shared by the pipeline tests. */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { BuildOptions, BuildResult } from '../src/pipeline.js';
import { runBuild } from '../src/pipeline.js';
import type { SpriteSource } from '../src/sources.js';
import type { RgbaImage } from '../src/types.js';
import { createRgba } from '../src/types.js';

export type Rgba = [number, number, number, number];

export const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = path.resolve(PKG_DIR, '..', '..');
export const REAL_OUT_DIR = path.join(REPO_ROOT, 'packages', 'client', 'public', 'creatures');
export const REAL_CACHE_DIR = path.join(PKG_DIR, '.cache');
export const REAL_QA_DIR = path.join(PKG_DIR, 'qa');
export const LEGACY_DIR = path.join(REPO_ROOT, '.design', 'legacy');
export const ROSTER_PATH = path.join(REPO_ROOT, '.design', 'roster-coverage.md');

/** Deterministic 32-bit PRNG (mulberry32) so fixtures are byte-stable across runs. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

/**
 * A textured creature-like fixture: an ellipse body whose interior is a 6 px block mosaic of
 * palette colours (hard colour edges everywhere), a dark 3 px outline, a flat mid-grey patch
 * (for the normal-map flat test) and a saturated bright patch (for the emissive test).
 */
export function texturedBlob(size: number, bg: Rgba, seed: number, radiusFrac = 0.32): RgbaImage {
  const img = createRgba(size, size);
  const rand = rng(seed);
  const palette: Rgba[] = [
    [180, 60, 40, 255],
    [60, 120, 200, 255],
    [220, 200, 80, 255],
    [70, 160, 90, 255],
    [140, 90, 170, 255],
  ];
  const block = 6;
  const cellsAcross = Math.ceil(size / block);
  const mosaic: Rgba[] = [];
  for (let i = 0; i < cellsAcross * cellsAcross; i++) mosaic.push(palette[Math.floor(rand() * palette.length)]!);
  const rx = size * radiusFrac;
  const ry = size * radiusFrac * 1.15;
  const cx = size * 0.5;
  const cy = size * 0.55;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = dx * dx + dy * dy;
      let c: Rgba = bg;
      if (d <= 1) {
        c = mosaic[Math.floor(y / block) * cellsAcross + Math.floor(x / block)]!;
        if (d > 0.82) c = [30, 24, 28, 255]; // outline
        // Flat grey patch (upper left of the body) and saturated bright patch (upper right).
        if (Math.abs(dx + 0.35) < 0.22 && Math.abs(dy + 0.3) < 0.22) c = [128, 128, 128, 255];
        // HSL s × l = 1.0 × 0.735 >= 0.72 (the emissive threshold); not magenta / near-white for the flood.
        if (Math.abs(dx - 0.35) < 0.18 && Math.abs(dy + 0.3) < 0.18) c = [255, 200, 120, 255];
      }
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

/**
 * Writes a synthetic `front/` + `back/` pair for each id under `dir`. Front: textured body on
 * a white background (needs recovery). Back: textured body with real alpha.
 */
export async function writeSyntheticAssets(dir: string, ids: string[], size = 160): Promise<string> {
  mkdirSync(path.join(dir, 'front'), { recursive: true });
  mkdirSync(path.join(dir, 'back'), { recursive: true });
  for (const [k, id] of ids.entries()) {
    writeFileSync(path.join(dir, 'front', `${id}front.png`), await toPng(texturedBlob(size, [255, 255, 255, 255], 1000 + k)));
    writeFileSync(path.join(dir, 'back', `${id}back.png`), await toPng(texturedBlob(size, [0, 0, 0, 0], 2000 + k, 0.28)));
  }
  return dir;
}

export function syntheticSources(assetsDir: string, ids: string[]): SpriteSource[] {
  const out: SpriteSource[] = [];
  for (const id of ids) {
    for (const side of ['back', 'front'] as const) {
      const file = `${id}${side}.png`;
      out.push({ id, side, file: `${side}/${file}`, abs: path.join(assetsDir, side, file), sizeScale: 1 });
    }
  }
  return out;
}

export interface FixtureBuild {
  ids: string[];
  assetsDir: string;
  outDir: string;
  cacheDir: string;
  qaDir: string;
  spriteSize: number;
  result: BuildResult;
  run(extra?: Partial<BuildOptions>): Promise<BuildResult>;
}

/** Builds a small synthetic species set end to end (256² cells, 512² atlases). */
export async function buildFixture(ids: string[], spriteSize = 256, extra: Partial<BuildOptions> = {}): Promise<FixtureBuild> {
  const root = tmp('fixture');
  const assetsDir = await writeSyntheticAssets(path.join(root, 'assets'), ids);
  const outDir = path.join(root, 'out');
  const cacheDir = path.join(root, 'cache');
  const qaDir = path.join(root, 'qa');
  const run = (more: Partial<BuildOptions> = {}): Promise<BuildResult> =>
    runBuild({
      assetsDir,
      outDir,
      cacheDir,
      qaDir,
      legacyDir: null,
      rosterPath: null,
      sources: syntheticSources(assetsDir, ids),
      spriteSize,
      atlasSize: spriteSize * 2,
      jobs: 4,
      ...extra,
      ...more,
    });
  const result = await run();
  return { ids, assetsDir, outDir, cacheDir, qaDir, spriteSize, result, run };
}

/** Every file under `dir` (relative path -> bytes), sorted. */
export function snapshotDir(dir: string): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  const walk = (d: string, rel: string): void => {
    for (const f of readdirSync(d).sort()) {
      const p = path.join(d, f);
      const r = rel ? `${rel}/${f}` : f;
      if (statSync(p).isDirectory()) walk(p, r);
      else out.set(r, readFileSync(p));
    }
  };
  if (existsSync(dir)) walk(dir, '');
  return out;
}

export function realOutputExists(): boolean {
  return existsSync(path.join(REAL_OUT_DIR, 'creatures.manifest.json')) && existsSync(path.join(REAL_CACHE_DIR, 'sprites'));
}
