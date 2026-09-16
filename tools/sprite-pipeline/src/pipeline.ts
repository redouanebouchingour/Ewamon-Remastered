/**
 * The build orchestrator: sources -> per-sprite stages (cached by content hash) -> atlas
 * planning + packing -> encoding -> manifest -> QA artifacts.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type { QaFlag } from './alpha.js';
import { INFORMATIONAL_FLAGS, recoverAlpha } from './alpha.js';
import type { SpriteMeta } from './cache.js';
import { SpriteCache, sha256 } from './cache.js';
import { deriveEmissive, resolveEmissiveOverride } from './emissive.js';
import type { EncodingRequest, TextureEncoder } from './encode.js';
import { decodeToRgba, selectEncoding } from './encode.js';
import type { AtlasPlan } from './groups.js';
import { buildGroups, planAtlases } from './groups.js';
import type { LegacyData } from './legacy.js';
import { loadLegacyData } from './legacy.js';
import type { ManifestAnimation, ManifestAtlas, SpriteManifest, SpriteRect } from './manifest.js';
import { MANIFEST_FILE, serializeManifest, validateManifest } from './manifest.js';
import { blit, normalizeSprite } from './normalize.js';
import { DEFAULT_NORMAL_OPTIONS, deriveNormalMap } from './normalmap.js';
import { packSquares } from './pack.js';
import type { QaEntry, QaReport } from './qa.js';
import { buildQaReport, renderContactSheet } from './qa.js';
import type { SpriteSource } from './sources.js';
import { compareSources, resolveSources } from './sources.js';
import type { GrayImage, RgbaImage } from './types.js';
import { DEFAULT_ATLAS_SIZE, DEFAULT_SPRITE_SIZE, PIPELINE_VERSION, createGray, createRgba } from './types.js';

export interface BuildOptions {
  /** `assets-src/creatures` — holds `front/`, `back/`, `animations/`. */
  assetsDir: string;
  /** `packages/client/public/creatures`. */
  outDir: string;
  cacheDir: string;
  qaDir: string;
  /** `.design/legacy`; null means "no legacy data" (every species lands in `misc`). */
  legacyDir: string | null;
  /** Explicit sources (tests / synthetic runs). When set, `legacyDir` is only used for grouping. */
  sources?: SpriteSource[];
  /** Restrict to these species ids. */
  only?: string[];
  limit?: number;
  /** Ignore the cache. */
  force?: boolean;
  encoding?: EncodingRequest;
  spriteSize?: number;
  atlasSize?: number;
  /** Only refresh the QA artifacts (sprites still go through the cached stages). */
  qaOnly?: boolean;
  log?: (msg: string) => void;
}

export interface ProcessedSprite {
  source: SpriteSource;
  hash: string;
  meta: SpriteMeta;
  cached: boolean;
}

export interface BuildResult {
  manifest: SpriteManifest | null;
  report: QaReport;
  sprites: ProcessedSprite[];
  encoding: string;
  encodingReason: string;
  atlasCount: number;
  totalBytes: number;
  cacheHits: number;
  outFiles: string[];
}

const noop = (): void => {};

export async function runBuild(opts: BuildOptions): Promise<BuildResult> {
  const log = opts.log ?? noop;
  const spriteSize = opts.spriteSize ?? DEFAULT_SPRITE_SIZE;
  const atlasSize = opts.atlasSize ?? DEFAULT_ATLAS_SIZE;
  if (atlasSize % spriteSize !== 0) throw new Error(`atlasSize ${atlasSize} must be a multiple of spriteSize ${spriteSize}`);
  const cache = new SpriteCache(opts.cacheDir);

  // ---- sources -------------------------------------------------------------------------
  const legacy: LegacyData | null = opts.legacyDir ? await loadLegacyData(opts.legacyDir) : null;
  let sources: SpriteSource[];
  if (opts.sources) {
    sources = [...opts.sources].sort(compareSources);
  } else {
    if (!legacy) throw new Error('runBuild needs either `sources` or `legacyDir`');
    const res = resolveSources(opts.assetsDir, legacy.species);
    const missing = res.missing.filter((m) => !opts.only || opts.only.includes(m.id));
    if (missing.length) {
      throw new Error(`no source file for: ${missing.map((m) => `${m.id}/${m.side} (wanted ${m.wanted})`).join(', ')}`);
    }
    sources = res.sources;
  }
  if (opts.only) {
    const only = new Set(opts.only);
    sources = sources.filter((s) => only.has(s.id));
  }
  if (opts.limit !== undefined) {
    const ids = [...new Set(sources.map((s) => s.id))].slice(0, opts.limit);
    const keep = new Set(ids);
    sources = sources.filter((s) => keep.has(s.id));
  }
  log(`${sources.length} sprites from ${opts.assetsDir}`);

  // Sides with no file at all. Only `<base>@<form>` pseudo-species may lack one (the form
  // sheet had a single side); they inherit the base species' sprite for that side and are
  // flagged `missing-side` so the gap is visible in the QA report, never silent.
  const inherited = findMissingSides(sources);

  // ---- per-sprite stages -----------------------------------------------------------------
  const sprites: ProcessedSprite[] = [];
  let cacheHits = 0;
  let done = 0;
  const CONCURRENCY = 3;
  const queue = [...sources];
  const worker = async (): Promise<void> => {
    for (let src = queue.shift(); src; src = queue.shift()) {
      const p = await processSprite(src, cache, spriteSize, opts.force ?? false);
      if (p.cached) cacheHits++;
      sprites.push(p);
      done++;
      if (done % 25 === 0 || done === sources.length) log(`  processed ${done}/${sources.length} (${cacheHits} cached)`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  sprites.sort((a, b) => compareSources(a.source, b.source));

  // ---- QA --------------------------------------------------------------------------------
  const qaEntries: QaEntry[] = sprites.map((p) => ({ species: p.source.id, side: p.source.side, flags: p.meta.flags, source: p.source.file }));
  for (const m of inherited) qaEntries.push({ species: m.id, side: m.side, flags: ['missing-side'], source: `(inherited from ${m.base})` });
  const report = buildQaReport(qaEntries);
  mkdirSync(opts.qaDir, { recursive: true });
  writeFileSync(path.join(opts.qaDir, 'qa-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  const sheet = await renderContactSheet(
    sprites.map((p) => ({
      label: `${p.source.side === 'front' ? 'F' : 'B'} ${p.source.id}`,
      albedoPath: cache.pngPath(p.hash, 'albedo'),
      flagged: p.meta.flags.some((f) => !INFORMATIONAL_FLAGS.has(f)),
    })),
  );
  writeFileSync(path.join(opts.qaDir, 'contact-sheet.png'), sheet);
  log(`QA: ${report.flagged.length}/${report.total} flagged -> ${opts.qaDir}`);

  if (opts.qaOnly) {
    return { manifest: null, report, sprites, encoding: 'n/a', encodingReason: 'qa only', atlasCount: 0, totalBytes: 0, cacheHits, outFiles: [] };
  }

  // ---- atlases ---------------------------------------------------------------------------
  const { encoder, reason } = await selectEncoding(opts.encoding ?? 'auto', atlasSize);
  log(`encoding: ${encoder.encoding} (${reason})`);
  const slots = (atlasSize / spriteSize) ** 2;
  const speciesPerAtlas = Math.max(1, Math.floor(slots / 2));
  const ids = [...new Set(sprites.map((p) => p.source.id))];
  const plans = planAtlases(buildGroups(ids, legacy), speciesPerAtlas);
  const bySpecies = new Map<string, ProcessedSprite[]>();
  for (const p of sprites) {
    const list = bySpecies.get(p.source.id) ?? [];
    list.push(p);
    bySpecies.set(p.source.id, list);
  }

  const atlasesDir = path.join(opts.outDir, 'atlases');
  mkdirSync(atlasesDir, { recursive: true });
  const manifestAtlases: ManifestAtlas[] = [];
  const rects: Record<string, Partial<Record<'front' | 'back', SpriteRect>>> = {};
  const outFiles: string[] = [];

  for (const plan of plans) {
    const members = plan.species.flatMap((id) => bySpecies.get(id) ?? []).sort((a, b) => compareSources(a.source, b.source));
    if (members.length > slots) throw new Error(`atlas ${plan.id}: ${members.length} sprites > ${slots} slots`);
    const placed = packSquares(members.length, spriteSize, atlasSize);
    const key = sha256(
      PIPELINE_VERSION,
      encoder.settingsKey,
      `${atlasSize}/${spriteSize}`,
      ...members.map((m, i) => `${m.hash}@${placed[i]!.x},${placed[i]!.y}`),
    );
    const files = await encodeAtlas(plan, members, placed, key, cache, encoder, atlasSize, spriteSize, atlasesDir, log);
    outFiles.push(...files.map((f) => path.join(atlasesDir, f)));
    manifestAtlases.push({ id: plan.id, albedo: `atlases/${files[0]!}`, normal: `atlases/${files[1]!}`, emissive: `atlases/${files[2]!}`, group: plan.group });
    members.forEach((m, i) => {
      const r = placed[i]!;
      const entry = (rects[m.source.id] ??= {});
      entry[m.source.side] = {
        atlas: plan.id,
        x: r.x,
        y: r.y,
        w: r.w,
        h: r.h,
        footV: m.meta.footV,
        pixelScale: m.meta.pixelScale,
        source: m.source.file,
      };
    });
  }

  // ---- animations --------------------------------------------------------------------------
  const animations = await copyAnimations(opts.assetsDir, opts.outDir, outFiles);

  // ---- manifest ----------------------------------------------------------------------------
  const manifestSprites: SpriteManifest['sprites'] = {};
  for (const m of inherited) {
    const from = rects[m.base]?.[m.side];
    if (!from) throw new Error(`species ${m.id} has no ${m.side} sprite and its base ${m.base} has none to inherit`);
    (rects[m.id] ??= {})[m.side] = from;
  }
  for (const id of Object.keys(rects).sort()) {
    const r = rects[id]!;
    if (!r.front || !r.back) throw new Error(`species ${id} is missing a ${r.front ? 'back' : 'front'} sprite`);
    const sizeScale = bySpecies.get(id)?.[0]?.source.sizeScale;
    manifestSprites[id] = { front: r.front, back: r.back, ...(sizeScale !== undefined ? { sizeScale } : {}) };
  }
  const manifest: SpriteManifest = {
    version: 1,
    encoding: encoder.encoding,
    atlasSize,
    spriteSize,
    atlases: manifestAtlases,
    sprites: manifestSprites,
    animations,
  };
  if (!validateManifest(manifest)) throw new Error('internal: manifest failed validation');
  const manifestPath = path.join(opts.outDir, MANIFEST_FILE);
  writeFileSync(manifestPath, serializeManifest(manifest));
  outFiles.push(manifestPath);

  pruneStale(atlasesDir, new Set(outFiles.map((f) => path.resolve(f))), log);

  const totalBytes = dirBytes(opts.outDir);
  log(`wrote ${manifestAtlases.length} atlases, ${Object.keys(manifestSprites).length} species, ${(totalBytes / 1e6).toFixed(1)} MB -> ${opts.outDir}`);
  return { manifest, report, sprites, encoding: encoder.encoding, encodingReason: reason, atlasCount: manifestAtlases.length, totalBytes, cacheHits, outFiles };
}

export function spriteCacheKey(bytes: Uint8Array, id: string, spriteSize: number): string {
  return sha256(
    bytes,
    `v${PIPELINE_VERSION}`,
    `size=${spriteSize}`,
    `normal=${JSON.stringify(DEFAULT_NORMAL_OPTIONS)}`,
    `emissive=${JSON.stringify(resolveEmissiveOverride(id))}`,
  );
}

export async function processSprite(src: SpriteSource, cache: SpriteCache, spriteSize: number, force: boolean): Promise<ProcessedSprite> {
  const bytes = new Uint8Array(readFileSync(src.abs));
  const hash = spriteCacheKey(bytes, src.id, spriteSize);
  if (!force && cache.has(hash)) {
    return { source: src, hash, meta: cache.readMeta(hash), cached: true };
  }
  const decoded = await decodeToRgba(bytes);
  const alpha = recoverAlpha(decoded);
  const flags: QaFlag[] = [...alpha.flags];
  if (src.fallback) flags.push('fallback-source');
  if (((await sharp(bytes, { pages: -1 }).metadata()).pages ?? 1) > 1) flags.push('multiframe');

  let albedo: RgbaImage;
  let footV = 0;
  let pixelScale = 1;
  let kernel: 'nearest' | 'lanczos3' = 'nearest';
  if (alpha.bbox) {
    const norm = await normalizeSprite(alpha.image, alpha.bbox, spriteSize);
    albedo = norm.image;
    footV = norm.placement.footV;
    pixelScale = norm.placement.scale;
    kernel = norm.placement.kernel;
  } else {
    albedo = createRgba(spriteSize, spriteSize); // nothing recoverable; the 'empty' flag says so
  }
  const normal = deriveNormalMap(albedo);
  const emissive = deriveEmissive(albedo, resolveEmissiveOverride(src.id));
  let emissivePixels = 0;
  for (let i = 0; i < emissive.data.length; i++) if (emissive.data[i]) emissivePixels++;

  const meta: SpriteMeta = {
    id: src.id,
    side: src.side,
    source: src.file,
    sourceWidth: decoded.width,
    sourceHeight: decoded.height,
    recovered: alpha.recovered,
    coverage: round(alpha.coverage, 4),
    flags: [...flags].sort(),
    footV,
    pixelScale: round(pixelScale, 6),
    kernel,
    emissivePixels,
  };
  await cache.write(hash, { meta, albedo, normal, emissive });
  return { source: src, hash, meta, cached: false };
}

async function encodeAtlas(
  plan: AtlasPlan,
  members: ProcessedSprite[],
  placed: Array<{ x: number; y: number }>,
  key: string,
  cache: SpriteCache,
  encoder: TextureEncoder,
  atlasSize: number,
  spriteSize: number,
  atlasesDir: string,
  log: (m: string) => void,
): Promise<[string, string, string]> {
  const names: [string, string, string] = [
    `${plan.id}.albedo.${encoder.ext}`,
    `${plan.id}.normal.${encoder.ext}`,
    `${plan.id}.emissive.${encoder.ext}`,
  ];
  const kinds = ['albedo', 'normal', 'emissive'] as const;
  for (let k = 0; k < kinds.length; k++) {
    const kind = kinds[k]!;
    const cacheKey = `${key}.${kind}`;
    let bytes = cache.readAtlas(cacheKey, encoder.ext);
    if (!bytes) {
      if (kind === 'emissive') {
        const atlas = createGray(atlasSize, atlasSize);
        for (let i = 0; i < members.length; i++) {
          const g = await cache.readGray(members[i]!.hash);
          blitGray(atlas, g, placed[i]!.x, placed[i]!.y);
        }
        bytes = await encoder.encodeGray(atlas);
      } else {
        const atlas = createRgba(atlasSize, atlasSize);
        for (let i = 0; i < members.length; i++) {
          const img = await cache.readRgba(members[i]!.hash, kind);
          if (img.width !== spriteSize || img.height !== spriteSize) throw new Error(`cached sprite ${members[i]!.hash} is ${img.width}x${img.height}, expected ${spriteSize}`);
          blit(atlas, img.data, img.width, img.height, placed[i]!.x, placed[i]!.y);
        }
        bytes = await encoder.encodeRgba(atlas, kind);
      }
      cache.writeAtlas(cacheKey, encoder.ext, bytes);
      log(`  atlas ${plan.id} ${kind}: ${members.length} sprites, ${(bytes.byteLength / 1024).toFixed(0)} KB`);
    }
    writeFileSync(path.join(atlasesDir, names[k]!), bytes);
  }
  return names;
}

function blitGray(dst: GrayImage, src: GrayImage, left: number, top: number): void {
  for (let y = 0; y < src.height; y++) {
    const dy = top + y;
    if (dy < 0 || dy >= dst.height) continue;
    const w = Math.min(src.width, dst.width - left);
    if (w <= 0) continue;
    dst.data.set(src.data.subarray(y * src.width, y * src.width + w), dy * dst.width + left);
  }
}

async function copyAnimations(assetsDir: string, outDir: string, outFiles: string[]): Promise<ManifestAnimation[]> {
  const srcDir = path.join(assetsDir, 'animations');
  const out: ManifestAnimation[] = [];
  if (!existsSync(srcDir)) return out;
  const dstDir = path.join(outDir, 'animations');
  mkdirSync(dstDir, { recursive: true });
  for (const file of readdirSync(srcDir).sort()) {
    if (!/\.(png|webp|gif)$/i.test(file)) continue;
    const src = path.join(srcDir, file);
    const dst = path.join(dstDir, file);
    if (!existsSync(dst) || statSync(dst).size !== statSync(src).size || !Buffer.from(readFileSync(dst)).equals(readFileSync(src))) {
      copyFileSync(src, dst);
    }
    outFiles.push(dst);
    const species = file.split(/[_.]/)[0]!;
    const entry: ManifestAnimation = { species, file: `animations/${file}` };
    const meta = await sharp(src, { pages: -1 }).metadata();
    const named = file.match(/_(\d+)f\b/);
    if (meta.pages && meta.pages > 1) entry.frames = meta.pages;
    else if (named) entry.frames = Number(named[1]);
    else if (meta.width && meta.height && meta.width > meta.height && meta.width % meta.height === 0) entry.frames = meta.width / meta.height;
    const fps = file.match(/_(\d+)fps\b/);
    if (fps) entry.fps = Number(fps[1]);
    out.push(entry);
  }
  return out;
}

export interface InheritedSide {
  id: string;
  side: 'front' | 'back';
  /** Species whose sprite fills the gap (`yaschamp` for `yaschamp@boxingstyle`). */
  base: string;
}

/** Sides that have no source file; only form pseudo-species can inherit, anything else throws. */
export function findMissingSides(sources: SpriteSource[]): InheritedSide[] {
  const sides = new Map<string, Set<'front' | 'back'>>();
  for (const s of sources) (sides.get(s.id) ?? sides.set(s.id, new Set()).get(s.id)!).add(s.side);
  const out: InheritedSide[] = [];
  for (const id of [...sides.keys()].sort()) {
    for (const side of ['front', 'back'] as const) {
      if (sides.get(id)!.has(side)) continue;
      const base = id.split('@')[0]!;
      if (base === id || !sides.get(base)?.has(side)) {
        throw new Error(`species ${id} has no ${side} sprite (and no base species to inherit it from)`);
      }
      out.push({ id, side, base });
    }
  }
  return out;
}

function pruneStale(atlasesDir: string, keep: Set<string>, log: (m: string) => void): void {
  if (!existsSync(atlasesDir)) return;
  for (const f of readdirSync(atlasesDir)) {
    const p = path.resolve(atlasesDir, f);
    if (!keep.has(p)) {
      rmSync(p);
      log(`  pruned stale ${f}`);
    }
  }
}

export function dirBytes(dir: string): number {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = statSync(p);
    total += st.isDirectory() ? dirBytes(p) : st.size;
  }
  return total;
}

function round(v: number, digits: number): number {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}
