/**
 * `tsx src/cli.ts <build|plan|qa|frames|bench> [flags]`
 *
 *   build   run every stage and write atlases + thumbs + manifest + QA artifacts
 *   plan    print which atlases a build would keep, change, add or drop (no image work, writes nothing)
 *   qa      refresh contact-sheet.png / qa-report.json only (uses the sprite cache)
 *   frames  write qa/frames/<id>-<side>.png (every page of a multiframe source in a row) so
 *           frame-select.json can be filled; `--only a,b` or `--all`
 *   bench   encode a few normalized sprites as KTX2 and lossless WebP, transcode the KTX2
 *           back and report sizes + error metrics (the numbers quoted in README.md)
 *
 * Flags: --only a,b,c   --limit N   --force   --jobs N   --no-anim   --all (frames)   --count N (bench)
 *        --assets DIR   --out DIR   --cache DIR   --qa DIR   --legacy DIR   --roster FILE
 *        --baseline FILE (the manifest whose atlases the plan keeps; default <out>/creatures.manifest.json)
 *        --replan (plan every atlas from scratch: rewrites most atlas files, spec §40.1.4)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SpriteCache } from './cache.js';
import { WEBP_EFFORT, decodeToRgba, encodeKtx2Rgba, encodeRgbaWebp, pageCount, probeKtx2, transcodeKtx2ToRgba } from './encode.js';
import { loadLegacyData } from './legacy.js';
import { errorStats } from './metrics.js';
import { previewPlan, processSprite, resolveAlphaOverride, runBuild } from './pipeline.js';
import type { AlphaOverrides, FrameSelect } from './pipeline.js';
import { renderFrameStrip } from './qa.js';
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
  rosterPath: path.join(REPO_ROOT, '.design', 'roster-coverage.md'),
  frameSelectPath: path.join(PKG_DIR, 'frame-select.json'),
  acceptPath: path.join(PKG_DIR, 'qa-accept.json'),
  alphaOverridesPath: path.join(PKG_DIR, 'alpha-overrides.json'),
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
    ...DEFAULT_PATHS,
    assetsDir: str(flags.assets) ?? DEFAULT_PATHS.assetsDir,
    outDir: str(flags.out) ?? DEFAULT_PATHS.outDir,
    cacheDir: str(flags.cache) ?? DEFAULT_PATHS.cacheDir,
    qaDir: str(flags.qa) ?? DEFAULT_PATHS.qaDir,
    legacyDir: str(flags.legacy) ?? DEFAULT_PATHS.legacyDir,
    rosterPath: str(flags.roster) ?? DEFAULT_PATHS.rosterPath,
  };
  const only = str(flags.only)?.split(',').filter(Boolean);
  const limit = str(flags.limit) ? Number(flags.limit) : undefined;
  const jobs = str(flags.jobs) ? Number(flags.jobs) : undefined;
  const log = (m: string): void => console.log(m);
  const baselinePath = flags.replan === true ? null : str(flags.baseline);

  if (command === 'plan') {
    await previewPlan({ ...paths, baselinePath, log });
    return;
  }
  if (command === 'build' || command === 'qa') {
    const t0 = Date.now();
    const res = await runBuild({ ...paths, only, limit, jobs, force: flags.force === true, qaOnly: command === 'qa', anim: flags['no-anim'] !== true, baselinePath, log });
    const rung = res.rung ? `albedo q${res.rung.albedo} / normal q${res.rung.normal}` : 'n/a';
    log(
      `done in ${((Date.now() - t0) / 1000).toFixed(1)} s: ${res.sprites.length} sprites, ${res.atlasCount} atlases, ${(res.totalBytes / 1e6).toFixed(2)} MB, ${rung}, ` +
        `${res.report.flagged.length} flagged (${res.report.actionable} actionable), ${res.cacheHits} cache hits`,
    );
    if (res.anim) {
      const frames = res.anim.sides.reduce((n, s) => n + s.meta.pages, 0);
      log(
        `anim: ${res.anim.sides.length} sides, ${frames} frames, ${(res.anim.totalBytes / 1e6).toFixed(2)} MB (${res.anim.totalBytes} B), ` +
          `albedo q${res.anim.rung.albedo} / normal q${res.anim.rung.normal}, ${res.anim.cacheHits} sides cached`,
      );
    }
    if (res.report.actionable > 0) process.exitCode = 3;
    return;
  }
  if (command === 'frames') {
    await frames(paths, only, flags.all === true, log);
    return;
  }
  if (command === 'bench') {
    await bench(paths, Number(str(flags.count) ?? 6), log);
    return;
  }
  throw new Error(`unknown command "${command}" (expected build | plan | qa | frames | bench)`);
}

/** Per-source contact strips for every multiframe source (or the given species). */
async function frames(paths: typeof DEFAULT_PATHS, only: string[] | undefined, all: boolean, log: (m: string) => void): Promise<void> {
  if (!only && !all) throw new Error('frames: pass --only a,b or --all');
  const legacy = await loadLegacyData(paths.legacyDir);
  const { sources } = resolveSources(paths.assetsDir, legacy.species);
  const frameSelect = existsSync(paths.frameSelectPath) ? (JSON.parse(readFileSync(paths.frameSelectPath, 'utf8')) as FrameSelect) : {};
  const dir = path.join(paths.qaDir, 'frames');
  mkdirSync(dir, { recursive: true });
  let written = 0;
  for (const src of sources) {
    if (only && !only.includes(src.id)) continue;
    const bytes = new Uint8Array(readFileSync(src.abs));
    const n = await pageCount(bytes);
    if (n <= 1) continue;
    const pages: RgbaImage[] = [];
    for (let p = 0; p < n; p++) pages.push(await decodeToRgba(bytes, p));
    const out = path.join(dir, `${src.id}-${src.side}.png`);
    writeFileSync(out, await renderFrameStrip(pages));
    const key = `${src.id}/${src.side}`;
    log(`${key}: ${n} pages -> ${path.relative(process.cwd(), out)}${key in frameSelect ? ` (frame-select: ${frameSelect[key]})` : ' (NO frame-select entry)'}`);
    written++;
  }
  log(`${written} strips written`);
}

/** KTX2 vs lossless WebP on real normalized sprites; prints a markdown table. */
async function bench(paths: typeof DEFAULT_PATHS, count: number, log: (m: string) => void): Promise<void> {
  const legacy = await loadLegacyData(paths.legacyDir);
  const { sources } = resolveSources(paths.assetsDir, legacy.species);
  const cache = new SpriteCache(paths.cacheDir);
  const frameSelect = existsSync(paths.frameSelectPath) ? (JSON.parse(readFileSync(paths.frameSelectPath, 'utf8')) as FrameSelect) : {};
  const overrides = existsSync(paths.alphaOverridesPath) ? (JSON.parse(readFileSync(paths.alphaOverridesPath, 'utf8')) as AlphaOverrides) : {};
  const picks = sources.filter((s) => s.side === 'front').slice(0, count);
  const rows: string[] = [];
  let ktxTotal = 0;
  let webpTotal = 0;
  for (const src of picks) {
    const bytes = new Uint8Array(readFileSync(src.abs));
    const frames = await pageCount(bytes);
    const p = await processSprite(src, cache, {
      spriteSize: DEFAULT_SPRITE_SIZE,
      force: false,
      bytes,
      frames,
      frame: frameSelect[`${src.id}/${src.side}`] ?? 0,
      alpha: resolveAlphaOverride(overrides, src.id, src.side),
    });
    for (const kind of ['albedo', 'normal'] as const) {
      const img = await cache.readRgba(p.hash, kind);
      const t0 = Date.now();
      const ktx = await encodeKtx2Rgba(img, kind);
      const tKtx = Date.now() - t0;
      const t1 = Date.now();
      const web = await encodeRgbaWebp(img, { codec: 'webp-lossless', quality: null, alphaQuality: 100, smartSubsample: false, effort: WEBP_EFFORT });
      const tWebp = Date.now() - t1;
      const back = await transcodeKtx2ToRgba(ktx);
      const m = errorStats(img, back);
      ktxTotal += ktx.byteLength;
      webpTotal += web.byteLength;
      rows.push(
        `| ${src.id} | ${kind} | ${kb(ktx.byteLength)} | ${tKtx} ms | ${kb(web.byteLength)} | ${tWebp} ms | ${m.psnr.toFixed(1)} dB | ${m.maxErr} | ${(m.edgeBad * 100).toFixed(1)} % |`,
      );
    }
  }
  const probe = await probeKtx2(2 * DEFAULT_ATLAS_SIZE);
  log(`KTX2 at ${2 * DEFAULT_ATLAS_SIZE}px: ${probe.ok ? 'supported' : `unsupported — ${probe.error}`}`);
  const probe2 = await probeKtx2(DEFAULT_ATLAS_SIZE);
  log(`KTX2 at ${DEFAULT_ATLAS_SIZE}px: ${probe2.ok ? 'supported' : `unsupported — ${probe2.error}`}`);
  log('');
  log('| sprite | map | KTX2 (UASTC+zstd) | enc | WebP lossless | enc | PSNR (opaque px) | max err | edge px err>12 |');
  log('|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) log(r);
  log(`| **total** | | **${kb(ktxTotal)}** | | **${kb(webpTotal)}** | | | | |`);
}

function kb(n: number): string {
  return `${(n / 1024).toFixed(0)} KB`;
}

const invokedDirectly = process.argv[1] !== undefined && existsSync(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
    process.exitCode = 1;
  });
}
