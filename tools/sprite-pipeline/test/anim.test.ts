/**
 * Flipbooks of multiframe sources (spec §40.1.3 as amended 2026-10-06): grid, delays, the shared transform, and an
 * end-to-end fixture build with two synthetic animated species (animated WebP + GIF) — frame count per side, foot
 * line ±1 texel, zero jitter, static/anim alignment, the strict manifest, the static set byte-identical to a build
 * without animation, the anim budget, determinism and the cache.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { alphaBbox } from '../src/alpha.js';
import { AnimCache, animGrid, animMasterPlacement, displayDelays, pxToUvRect } from '../src/anim.js';
import type { SpriteManifestV2 } from '../src/manifest.js';
import { MANIFEST_FILE, manifestErrors, serializeManifest, staticManifest } from '../src/manifest.js';
import { computePlacement } from '../src/normalize.js';
import type { BuildResult } from '../src/pipeline.js';
import { dirBytes, runBuild, staticDirBytes } from '../src/pipeline.js';
import type { SpriteSource } from '../src/sources.js';
import type { RgbaImage } from '../src/types.js';
import { ANIM_BUDGET_BYTES, ANIM_DIR, FOOT_V, createRgba } from '../src/types.js';
import { snapshotDir, texturedBlob, tmp, toPng } from './helpers.js';

// ---- pure helpers ---------------------------------------------------------------------------------------------

describe('anim grid, delays, transform', () => {
  it('packs 24 / 25 / 36 pages without empty cells, wider than tall on a tie, within the max edge', () => {
    expect(animGrid(24, 512)).toEqual({ cols: 6, rows: 4, cell: 512, width: 3072, height: 2048 });
    expect(animGrid(25, 512)).toEqual({ cols: 5, rows: 5, cell: 512, width: 2560, height: 2560 });
    expect(animGrid(36, 512)).toEqual({ cols: 6, rows: 6, cell: 512, width: 3072, height: 3072 });
    for (let n = 2; n <= 64; n++) {
      const g = animGrid(n, 512);
      expect(g.cols * g.rows, `${n}`).toBeGreaterThanOrEqual(n);
      expect(g.cols * (g.rows - 1), `${n}`).toBeLessThan(n);
      expect(Math.max(g.width, g.height), `${n}`).toBeLessThanOrEqual(8192);
    }
    expect(() => animGrid(300, 512)).toThrow(/do not fit/);
  });

  it('pxToUvRect flips v for a non-square atlas', () => {
    expect(pxToUvRect([0, 0, 512, 512], 3072, 2048)).toEqual([0, 0.75, 512 / 3072, 1]);
    expect(pxToUvRect([2560, 1536, 512, 512], 3072, 2048)).toEqual([2560 / 3072, 0, 1, 0.25]);
  });

  it('display delays: sharp ms, with missing or sub-20 ms delays shown for 100 ms', () => {
    expect(displayDelays([125, 125, 100], 3)).toEqual([125, 125, 100]);
    expect(displayDelays([0, 10, 20], 3)).toEqual([100, 100, 20]);
    expect(displayDelays(undefined, 2)).toEqual([100, 100]);
  });

  it('the shared transform is the static cell’s: union = static bbox lands exactly where normalizeSprite puts it', () => {
    const b = { x0: 10, y0: 20, x1: 209, y1: 319 };
    const p = computePlacement(200, 300, 1024);
    const m = animMasterPlacement(b, b, 1024);
    expect([m.left, m.top, m.width, m.height]).toEqual([p.left, p.top, p.targetW, p.targetH]);
    // a wider union keeps the static scale and shifts left by the extra source px × scale
    const u = animMasterPlacement(b, { x0: 0, y0: 20, x1: 209, y1: 319 }, 1024);
    expect(u.scaleX).toBeCloseTo(m.scaleX, 12);
    expect(u.left).toBe(Math.round(p.left - 10 * m.scaleX));
    expect(u.top + u.height).toBe(m.top + m.height);
    // a union the static transform cannot fit throws instead of clipping
    expect(() => animMasterPlacement(b, { x0: 10, y0: -400, x1: 209, y1: 319 }, 1024)).toThrow(/do not fit/);
  });
});

// ---- fixture -----------------------------------------------------------------------------------------------------

const SRC = 160;
const PAGES_FRONT = 6;
const PAGES_BACK = 5;

function shifted(img: RgbaImage, dy: number): RgbaImage {
  const out = createRgba(img.width, img.height);
  for (let y = 0; y < img.height; y++) {
    const sy = y + dy;
    if (sy < 0 || sy >= img.height) continue;
    out.data.set(img.data.subarray(sy * img.width * 4, (sy + 1) * img.width * 4), y * img.width * 4);
  }
  return out;
}

function withWing(img: RgbaImage, x: number): RgbaImage {
  const out = { width: img.width, height: img.height, data: img.data.slice() };
  for (let y = 8; y < 18; y++) for (let xx = x; xx < x + 22; xx++) out.data.set([230, 90, 40, 255], (y * img.width + xx) * 4);
  return out;
}

async function animated(frames: RgbaImage[], delays: number[], format: 'webp' | 'gif'): Promise<Buffer> {
  const w = frames[0]!.width;
  const h = frames[0]!.height;
  const stacked = Buffer.concat(frames.map((f) => Buffer.from(f.data)));
  const img = sharp(stacked, { raw: { width: w, height: h * frames.length, channels: 4, pageHeight: h } });
  return format === 'webp' ? img.webp({ lossless: true, loop: 0, delay: delays }).toBuffer() : img.gif({ loop: 0, delay: delays, dither: 0, effort: 1 }).toBuffer();
}

interface AnimFixture {
  root: string;
  assetsDir: string;
  sources: SpriteSource[];
  frameSelectPath: string;
  build(name: string, extra?: Partial<Parameters<typeof runBuild>[0]>): Promise<{ out: string; cache: string; qa: string; result: BuildResult }>;
}

/**
 * `flap`: front = a static body plus a wing that slides sideways above it (6 animated-WebP pages, 125 ms; static page
 * 2), back = the body bobbing up 0..4 source px (5 GIF pages, 100 ms; static page 0). `still`: one ordinary PNG species.
 */
async function animFixture(): Promise<AnimFixture> {
  const root = tmp('anim');
  const assetsDir = path.join(root, 'assets');
  mkdirSync(path.join(assetsDir, 'front'), { recursive: true });
  mkdirSync(path.join(assetsDir, 'back'), { recursive: true });
  const body = texturedBlob(SRC, [0, 0, 0, 0], 4242);
  const front = Array.from({ length: PAGES_FRONT }, (_unused, i) => withWing(body, 30 + 14 * i));
  writeFileSync(path.join(assetsDir, 'front', 'flapfront.webp'), await animated(front, Array(PAGES_FRONT).fill(125) as number[], 'webp'));
  const backBody = texturedBlob(SRC, [0, 0, 0, 0], 4343, 0.28);
  const back = Array.from({ length: PAGES_BACK }, (_unused, i) => shifted(backBody, i));
  writeFileSync(path.join(assetsDir, 'back', 'flapback.gif'), await animated(back, Array(PAGES_BACK).fill(100) as number[], 'gif'));
  writeFileSync(path.join(assetsDir, 'front', 'stillfront.png'), await toPng(texturedBlob(SRC, [255, 255, 255, 255], 77)));
  writeFileSync(path.join(assetsDir, 'back', 'stillback.png'), await toPng(texturedBlob(SRC, [0, 0, 0, 0], 78, 0.28)));
  const frameSelectPath = path.join(root, 'frame-select.json');
  writeFileSync(frameSelectPath, JSON.stringify({ 'flap/front': 2, 'flap/back': 0 }));
  const sources: SpriteSource[] = [
    { id: 'flap', side: 'back', file: 'back/flapback.gif', abs: path.join(assetsDir, 'back', 'flapback.gif'), sizeScale: 1 },
    { id: 'flap', side: 'front', file: 'front/flapfront.webp', abs: path.join(assetsDir, 'front', 'flapfront.webp'), sizeScale: 1 },
    { id: 'still', side: 'back', file: 'back/stillback.png', abs: path.join(assetsDir, 'back', 'stillback.png'), sizeScale: 1 },
    { id: 'still', side: 'front', file: 'front/stillfront.png', abs: path.join(assetsDir, 'front', 'stillfront.png'), sizeScale: 1 },
  ];
  return {
    root,
    assetsDir,
    sources,
    frameSelectPath,
    async build(name, extra = {}) {
      const out = path.join(root, `out-${name}`);
      const cache = extra.cacheDir ?? path.join(root, 'cache');
      const qa = path.join(root, `qa-${name}`);
      const result = await runBuild({
        assetsDir,
        outDir: out,
        cacheDir: cache,
        qaDir: qa,
        legacyDir: null,
        rosterPath: null,
        sources,
        frameSelectPath,
        spriteSize: 256,
        atlasSize: 512,
        jobs: 4,
        ...extra,
      });
      return { out, cache, qa, result };
    },
  };
}

async function decodeCell(file: string, px: readonly number[]): Promise<RgbaImage> {
  const { data, info } = await sharp(file).ensureAlpha().extract({ left: px[0]!, top: px[1]!, width: px[2]!, height: px[3]! }).raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
}

/** 2× alpha reduction by majority (≥ 2 of 4 opaque), the static cell seen at the anim cell's resolution. */
function halfAlpha(img: RgbaImage): Uint8Array {
  const w = img.width >> 1;
  const h = img.height >> 1;
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let n = 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) if (img.data[((2 * y + dy) * img.width + 2 * x + dx) * 4 + 3]! >= 128) n++;
      out[y * w + x] = n >= 2 ? 1 : 0;
    }
  }
  return out;
}

describe('anim fixture build', () => {
  it('builds both sides as flipbooks next to an unchanged static set', async () => {
    const fx = await animFixture();
    const withA = await fx.build('anim');
    const noA = await fx.build('static', { anim: false });
    const m = withA.result.manifest!;

    // ---- frame count per side = source pages; delays from the source --------------------------------------------
    const flap = m.sprites.flap!;
    expect(flap.anim?.front?.frames.length).toBe(PAGES_FRONT);
    expect(flap.anim?.back?.frames.length).toBe(PAGES_BACK);
    expect(flap.anim?.front?.delays).toEqual(Array(PAGES_FRONT).fill(125));
    expect(flap.anim?.back?.delays).toEqual(Array(PAGES_BACK).fill(100));
    expect(flap.anim?.front?.staticFrame).toBe(2);
    expect(m.sprites.still!.anim).toBeUndefined();
    expect(m.animAtlases!.map((a) => a.id)).toEqual(['anim-flap-back', 'anim-flap-front']);
    for (const a of m.animAtlases!) {
      expect(a.cell).toBe(128);
      expect(a.slots).toBe(a.side === 'front' ? PAGES_FRONT : PAGES_BACK);
    }

    // ---- the static set is byte-identical to a build without animation -------------------------------------------
    const a = snapshotDir(withA.out);
    const s = snapshotDir(noA.out);
    for (const [file, bytes] of s) {
      if (file === MANIFEST_FILE) continue;
      expect(a.get(file)?.equals(bytes), file).toBe(true);
    }
    expect([...a.keys()].filter((f) => !s.has(f)).every((f) => f.startsWith(`${ANIM_DIR}/`))).toBe(true);
    expect(serializeManifest(staticManifest(m))).toBe(s.get(MANIFEST_FILE)!.toString('utf8'));
    expect(m.totalBytes).toBe(noA.result.manifest!.totalBytes);

    // ---- strict manifest + budget accounting ----------------------------------------------------------------------
    expect(manifestErrors(m, { species: ['flap', 'still'], spriteSize: 256 })).toEqual([]);
    // the manifest file lives outside anim/, but the bytes its anim fields add are charged to the anim line
    const share = Buffer.byteLength(serializeManifest(m)) - Buffer.byteLength(serializeManifest(staticManifest(m)));
    expect(share).toBeGreaterThan(0);
    expect(staticDirBytes(withA.out) - share).toBe(m.totalBytes);
    expect(dirBytes(path.join(withA.out, ANIM_DIR)) + share).toBe(m.animTotalBytes);
    expect(dirBytes(withA.out)).toBe(m.totalBytes + m.animTotalBytes!);
    expect(m.animTotalBytes!).toBeLessThanOrEqual(ANIM_BUDGET_BYTES);
    expect(JSON.parse(readFileSync(path.join(withA.out, MANIFEST_FILE), 'utf8'))).toEqual(JSON.parse(serializeManifest(m)));
    expect(existsSync(path.join(withA.qa, 'anim-sheet.png'))).toBe(true);
    expect(existsSync(path.join(withA.qa, 'anim-report.json'))).toBe(true);

    // ---- `qa` over that output rewrites the build's report unchanged (the manifest's anim share is not static) ------
    const reportPath = path.join(withA.qa, 'qa-report.json');
    const builtReport = readFileSync(reportPath);
    const qaOnly = await fx.build('anim', { qaOnly: true });
    expect(qaOnly.result.report.totalBytes).toBe(m.totalBytes);
    expect(readFileSync(reportPath).equals(builtReport)).toBe(true);

    // ---- per-frame rasters from the cache (lossless): foot line, zero jitter -----------------------------------------
    const cache = new AnimCache(withA.cache);
    const sideHash = (side: 'front' | 'back'): string => withA.result.anim!.sides.find((x) => x.meta.side === side)!.hash;
    const footRow = Math.round(FOOT_V * 128) - 1;
    const frontFrames = await Promise.all(Array.from({ length: PAGES_FRONT }, (_unused, p) => cache.readFrame(sideHash('front'), p)));
    const fb = frontFrames.map((f) => alphaBbox(f.albedo, 128)!);
    // the body never moves: every page has the same bottom row, at the static cell's foot line ± 1 texel
    for (const b of fb) expect(b.y1).toBe(fb[0]!.y1);
    expect(Math.abs(fb[2]!.y1 - footRow)).toBeLessThanOrEqual(1);
    // zero jitter: below the wing (source rows 8..17, + the two resamplers' support), every page's albedo is
    // byte-identical (one crop, one resample, one offset for every page)
    const frontMeta = withA.result.anim!.sides.find((x) => x.meta.side === 'front')!.meta;
    const wingBottom = Math.ceil((frontMeta.master.top + (18 - frontMeta.union.y0) * frontMeta.master.scaleY) / 2);
    const from = (wingBottom + 6) * 128 * 4;
    expect(wingBottom + 6).toBeLessThan(fb[0]!.y0 + 60);
    for (let p = 1; p < PAGES_FRONT; p++) expect(Buffer.from(frontFrames[p]!.albedo.data.subarray(from)).equals(Buffer.from(frontFrames[0]!.albedo.data.subarray(from))), `page ${p}`).toBe(true);
    // the bobbing back: each page sits higher by exactly its source offset × the shared scale (no per-page re-fit)
    const backMeta = withA.result.anim!.sides.find((x) => x.meta.side === 'back')!.meta;
    const backFrames = await Promise.all(Array.from({ length: PAGES_BACK }, (_unused, p) => cache.readFrame(sideHash('back'), p)));
    const bb = backFrames.map((f) => alphaBbox(f.albedo, 128)!);
    expect(Math.abs(bb[0]!.y1 - footRow)).toBeLessThanOrEqual(1);
    const perPx = backMeta.master.scaleY / 2;
    for (let p = 1; p < PAGES_BACK; p++) {
      expect(Math.abs(bb[0]!.y1 - bb[p]!.y1 - p * perPx), `page ${p} bottom`).toBeLessThanOrEqual(1);
      expect(Math.abs(bb[0]!.y0 - bb[p]!.y0 - p * perPx), `page ${p} top`).toBeLessThanOrEqual(1);
      expect(bb[p]!.x0).toBe(bb[0]!.x0);
      expect(bb[p]!.x1).toBe(bb[0]!.x1);
    }

    // ---- static ↔ anim alignment on the shipped files: the static frame overlays the static cell ---------------------
    for (const side of ['front', 'back'] as const) {
      const rect = flap[side];
      const staticAtlas = m.atlases.find((x) => x.id === rect.atlas)!;
      const staticCell = await decodeCell(path.join(withA.out, staticAtlas.albedo.url), rect.px);
      const animSide = flap.anim![side]!;
      const animAtlas = m.animAtlases!.find((x) => x.id === animSide.atlas)!;
      const uv = animSide.frames[animSide.staticFrame]!;
      const px = [Math.round(uv[0] * animAtlas.width), Math.round((1 - uv[3]) * animAtlas.height), animAtlas.cell, animAtlas.cell];
      const animCell = await decodeCell(path.join(withA.out, animAtlas.albedo.url), px);
      const ref = halfAlpha(staticCell);
      let inter = 0;
      let union = 0;
      for (let i = 0; i < ref.length; i++) {
        const x = ref[i]!;
        const y = animCell.data[i * 4 + 3]! >= 128 ? 1 : 0;
        inter += x & y;
        union += x | y;
      }
      expect(inter / union, `${side} IoU`).toBeGreaterThan(0.95);
      const sb = alphaBbox(staticCell, 128)!;
      const ab = alphaBbox(animCell, 128)!;
      for (const k of ['x0', 'y0', 'x1', 'y1'] as const) expect(Math.abs(ab[k] - (k.endsWith('1') ? (sb[k] + 1) / 2 - 1 : sb[k] / 2)), `${side} ${k}`).toBeLessThanOrEqual(1);
    }
  }, 300_000);

  it('is deterministic, and a rerun is fully cached', async () => {
    const fx = await animFixture();
    const first = await fx.build('one', { force: true });
    const second = await fx.build('two', { force: true, cacheDir: path.join(fx.root, 'cache2') });
    const a = snapshotDir(first.out);
    const b = snapshotDir(second.out);
    expect([...b.keys()]).toEqual([...a.keys()]);
    for (const [file, bytes] of a) expect(b.get(file)!.equals(bytes), file).toBe(true);
    expect(snapshotDir(first.qa).get('anim-sheet.png')!.equals(snapshotDir(second.qa).get('anim-sheet.png')!)).toBe(true);
    const third = await fx.build('three');
    expect(third.result.anim!.cacheHits).toBe(2);
    expect(third.result.cacheHits).toBe(4);
    for (const [file, bytes] of a) expect(snapshotDir(third.out).get(file)!.equals(bytes), file).toBe(true);
  }, 300_000);
});

// ---- manifest validation of the extension ---------------------------------------------------------------------------

describe('manifest anim extension is validated strictly', () => {
  let base: SpriteManifestV2 | null = null;
  const fixture = async (): Promise<SpriteManifestV2> => {
    if (base) return base;
    const fx = await animFixture();
    base = (await fx.build('v')).result.manifest!;
    return base;
  };
  const clone = (m: SpriteManifestV2): Record<string, any> => JSON.parse(JSON.stringify(m)) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const errs = (m: unknown): string[] => manifestErrors(m, { species: ['flap', 'still'], spriteSize: 256 });

  it('rejects every malformed variant', async () => {
    const m = await fixture();
    expect(errs(m)).toEqual([]);
    const cases: Array<[string, (x: Record<string, any>) => void, RegExp]> = [ // eslint-disable-line @typescript-eslint/no-explicit-any
      ['missing animTotalBytes', (x) => delete x.animTotalBytes, /animTotalBytes missing/],
      ['over budget', (x) => (x.animTotalBytes = ANIM_BUDGET_BYTES + 1), /anim budget/],
      ['missing animAtlases', (x) => delete x.animAtlases, /animAtlases missing/],
      ['frame dropped', (x) => x.sprites.flap.anim.front.frames.pop(), /frames, atlas has/],
      ['frames out of order', (x) => x.sprites.flap.anim.front.frames.reverse(), /raster order/],
      ['delay count', (x) => x.sprites.flap.anim.back.delays.pop(), /one entry per frame/],
      ['delay zero', (x) => (x.sprites.flap.anim.back.delays[0] = 0), /positive integers/],
      ['static frame', (x) => (x.sprites.flap.anim.front.staticFrame = 99), /staticFrame/],
      ['footV', (x) => (x.sprites.flap.anim.front.footV = 0.1), /footV/],
      ['wrong side', (x) => (x.sprites.flap.anim.front.atlas = 'anim-flap-back'), /belongs to flap\/back|referenced 2 times/],
      ['dangling atlas', (x) => (x.sprites.flap.anim.front.atlas = 'anim-nope-front'), /unresolved/],
      ['unreferenced atlas', (x) => delete x.sprites.flap.anim.front, /referenced 0 times/],
      ['bad cell', (x) => (x.animAtlases[0].cell = 100), /cell/],
      ['url outside anim/', (x) => (x.animAtlases[0].albedo.url = 'atlases/x.webp'), /under anim\//],
      ['too large', (x) => (x.animAtlases[0].width = 128 * 70), /exceeds 8192|do not fill/],
      ['species unknown', (x) => (x.animAtlases[0].species = 'nope'), /unknown/],
    ];
    for (const [name, mutate, re] of cases) {
      const x = clone(m);
      mutate(x);
      const e = errs(x);
      expect(e.some((s) => re.test(s)), `${name}: ${e.join(' | ')}`).toBe(true);
    }
  }, 300_000);
});
