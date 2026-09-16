/**
 * `tsx src/cli.ts <build|qa|bench> [flags]`
 *
 *   build   run every stage and write atlases + manifest + QA artifacts
 *   qa      refresh contact-sheet.png / qa-report.json only (uses the sprite cache)
 *   bench   encode a few normalized sprites as KTX2 and WebP, transcode the KTX2 back and
 *           report sizes + error metrics (the numbers quoted in README.md)
 *
 * Flags: --only a,b,c   --limit N   --force   --encoding auto|ktx2|webp
 *        --assets DIR   --out DIR   --cache DIR   --qa DIR   --legacy DIR   --count N (bench)
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SpriteCache } from './cache.js';
import type { EncodingRequest } from './encode.js';
import { createWebpEncoder, encodeKtx2Rgba, probeKtx2, transcodeKtx2ToRgba } from './encode.js';
import { loadLegacyData } from './legacy.js';
import { processSprite } from './pipeline.js';
import { runBuild } from './pipeline.js';
import { resolveSources } from './sources.js';
import type { RgbaImage } from './types.js';
import { DEFAULT_ATLAS_SIZE, DEFAULT_SPRITE_SIZE } from './types.js';

export const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = path.resolve(PKG_DIR, '..', '..');

export const DEFAULT_PATHS = {
  assetsDir: path.join(REPO_ROOT, 'assets-src', 'creatures'),
  outDir: path.join(REPO_ROOT, 'packages', 'client', 'public', 'creatures'),
  cacheDir: path.join(PKG_DIR, '.cache'),
  qaDir: path.join(PKG_DIR, 'qa'),
  legacyDir: path.join(REPO_ROOT, '.design', 'legacy'),
};

interface Args {
  command: string;
  flags: Record<string, string | true>;
}

export function parseArgs(argv: string[]): Args {
  const [command = 'build', ...rest] = argv;
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = rest[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return { command, flags };
}

function str(v: string | true | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const paths = {
    assetsDir: str(flags.assets) ?? DEFAULT_PATHS.assetsDir,
    outDir: str(flags.out) ?? DEFAULT_PATHS.outDir,
    cacheDir: str(flags.cache) ?? DEFAULT_PATHS.cacheDir,
    qaDir: str(flags.qa) ?? DEFAULT_PATHS.qaDir,
    legacyDir: str(flags.legacy) ?? DEFAULT_PATHS.legacyDir,
  };
  const only = str(flags.only)?.split(',').filter(Boolean);
  const limit = str(flags.limit) ? Number(flags.limit) : undefined;
  const encoding = (str(flags.encoding) ?? 'auto') as EncodingRequest;
  const log = (m: string): void => console.log(m);

  if (command === 'build' || command === 'qa') {
    const t0 = Date.now();
    const res = await runBuild({ ...paths, only, limit, force: flags.force === true, encoding, qaOnly: command === 'qa', log });
    log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s: ${res.sprites.length} sprites, ${res.atlasCount} atlases, ${res.report.flagged.length} flagged, ${res.cacheHits} cache hits`);
    return;
  }
  if (command === 'bench') {
    await bench(paths, Number(str(flags.count) ?? 6), log);
    return;
  }
  throw new Error(`unknown command "${command}" (expected build | qa | bench)`);
}

/** KTX2 vs WebP on real normalized sprites; prints a markdown table. */
async function bench(paths: typeof DEFAULT_PATHS, count: number, log: (m: string) => void): Promise<void> {
  const legacy = await loadLegacyData(paths.legacyDir);
  const { sources } = resolveSources(paths.assetsDir, legacy.species);
  const cache = new SpriteCache(paths.cacheDir);
  const webp = createWebpEncoder();
  const picks = sources.filter((s) => s.side === 'front').slice(0, count);
  const rows: string[] = [];
  let ktxTotal = 0;
  let webpTotal = 0;
  for (const src of picks) {
    const p = await processSprite(src, cache, DEFAULT_SPRITE_SIZE, false);
    for (const kind of ['albedo', 'normal'] as const) {
      const img = await cache.readRgba(p.hash, kind);
      const t0 = Date.now();
      const ktx = await encodeKtx2Rgba(img, kind);
      const tKtx = Date.now() - t0;
      const t1 = Date.now();
      const web = await webp.encodeRgba(img, kind);
      const tWebp = Date.now() - t1;
      const back = await transcodeKtx2ToRgba(ktx);
      const m = compare(img, back);
      ktxTotal += ktx.byteLength;
      webpTotal += web.byteLength;
      rows.push(
        `| ${src.id} | ${kind} | ${kb(ktx.byteLength)} | ${tKtx} ms | ${kb(web.byteLength)} | ${tWebp} ms | ${m.psnr.toFixed(1)} dB | ${m.maxErr} | ${(m.edgeBad * 100).toFixed(1)} % |`,
      );
    }
  }
  const probe = await probeKtx2(DEFAULT_ATLAS_SIZE);
  log(`KTX2 at ${DEFAULT_ATLAS_SIZE}px: ${probe.ok ? 'supported' : `unsupported — ${probe.error}`}`);
  log('');
  log('| sprite | map | KTX2 (UASTC+zstd) | enc | WebP lossless | enc | PSNR (opaque px) | max err | edge px err>16 |');
  log('|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) log(r);
  log(`| **total** | | **${kb(ktxTotal)}** | | **${kb(webpTotal)}** | | | | |`);
}

function kb(n: number): string {
  return `${(n / 1024).toFixed(0)} KB`;
}

/** PSNR over pixels with alpha > 0, max channel error, and the share of alpha-edge pixels with a channel error > 16. */
function compare(a: RgbaImage, b: RgbaImage): { psnr: number; maxErr: number; edgeBad: number } {
  const { width, height } = a;
  let se = 0;
  let n = 0;
  let maxErr = 0;
  let edge = 0;
  let edgeBad = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = a.data[i + 3]!;
      if (alpha === 0) continue;
      let pixMax = 0;
      for (let c = 0; c < 4; c++) {
        const e = Math.abs(a.data[i + c]! - b.data[i + c]!);
        se += e * e;
        n++;
        if (e > pixMax) pixMax = e;
      }
      if (pixMax > maxErr) maxErr = pixMax;
      const onEdge =
        (x > 0 && a.data[i - 1]! === 0) ||
        (x < width - 1 && a.data[i + 7]! === 0) ||
        (y > 0 && a.data[i - width * 4 + 3]! === 0) ||
        (y < height - 1 && a.data[i + width * 4 + 3]! === 0);
      if (onEdge) {
        edge++;
        if (pixMax > 16) edgeBad++;
      }
    }
  }
  const mse = n ? se / n : 0;
  return { psnr: mse === 0 ? 99 : 10 * Math.log10((255 * 255) / mse), maxErr, edgeBad: edge ? edgeBad / edge : 0 };
}

const invokedDirectly = process.argv[1] !== undefined && existsSync(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.stack ?? err.message : String(err));
    process.exitCode = 1;
  });
}
