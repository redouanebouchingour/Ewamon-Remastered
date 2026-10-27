/**
 * The build orchestrator (spec §40.1): sources -> per-sprite stages (cached by content hash)
 * -> zone-affinity atlas plan -> rasters + mip chains -> WebP encoding under the budget
 * ladder -> manifest v2 -> output tree -> QA artifacts.
 *
 * Nothing under `outDir` is touched until every byte has been produced (into the cache), so
 * a failed build never leaves a partial output tree.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AlphaOptions, QaFlag } from './alpha.js';
import type { AnimEncodeResult, ProcessedAnimSide } from './anim.js';
import { AnimCache, animAtlasId, animFileName, animJob, encodeAnimUnderBudget, processAnimSide } from './anim.js';
import { INFORMATIONAL_FLAGS, alphaBbox, cleanTransparentRgb, isSideMismatch, recoverAlpha } from './alpha.js';
import type { SpriteMeta } from './cache.js';
import { SpriteCache, sha256 } from './cache.js';
import { deriveEmissive, resolveEmissiveOverride } from './emissive.js';
import type { MapEncodeSettings, Rung, TextureKind } from './encode.js';
import {
  decodeToRgba,
  encodeMaskWebp,
  encodeRgbaWebp,
  encodeThumb,
  THUMB_LADDER,
  ladderRungs,
  mipLevels,
  pageCount,
  settingsFor,
  settingsKey,
  thumbRungKey,
} from './encode.js';
import type { LegacyData } from './legacy.js';
import { loadLegacyData } from './legacy.js';
import type { ManifestAtlasV2, ManifestMap, ManifestSpriteV2, SpriteManifestV2, SpriteRectV2 } from './manifest.js';
import { MANIFEST_FILE, manifestErrors, pxToUv, serializeManifest } from './manifest.js';
import { binarizeAlpha, buildAlphaMipChain, buildMaskMipChain, buildNormalMipChain, halfResolutionNormal } from './mips.js';
import { blit, normalizeSprite } from './normalize.js';
import { DEFAULT_NORMAL_OPTIONS, deriveNormalMap } from './normalmap.js';
import type { Rect } from './pack.js';
import { packSquares } from './pack.js';
import type { PlanBaseline, ZonePlan } from './plan.js';
import { baselineFromManifest, planAtlases } from './plan.js';
import type { QaAcceptance, QaEncodingSummary, QaEntry, QaReport } from './qa.js';
import { buildQaReport, renderAnimSheet, renderContactSheet, serializeQaReport } from './qa.js';
import type { ExcludedFile, SpriteSource } from './sources.js';
import { compareSources, resolveSources } from './sources.js';
import type { GrayImage, RgbaImage } from './types.js';
import {
  ALPHA_THRESHOLD,
  ANIM_BUDGET_BYTES,
  ANIM_DIR,
  CONCURRENCY,
  CREATURES_BUDGET_BYTES,
  DEFAULT_ATLAS_SIZE,
  DEFAULT_SPRITE_SIZE,
  MANIFEST_FOOT_V,
  MAX_ATLASES_PER_ZONE,
  MIP_LEVELS,
  NORMAL_SCALE,
  PIPELINE_VERSION,
  SPRITE_STAGE_VERSION,
  THUMB_MAX_BYTES,
  THUMB_SIZE,
  compareStrings,
  createGray,
  createRgba,
} from './types.js';
import { buildZoneInputs, loadRosterTables } from './zones.js';

export interface BuildOptions {
  /** `assets-src/creatures` — holds `front/`, `back/`. */
  assetsDir: string;
  /** `packages/client/public/creatures`. Emptied and rewritten by a successful build. */
  outDir: string;
  cacheDir: string;
  qaDir: string;
  /** `.design/legacy`; null means "no legacy data" (synthetic runs: species = the given sources). */
  legacyDir: string | null;
  /** `.design/roster-coverage.md`; null or missing -> no encounter tables (every species is `home`). */
  rosterPath?: string | null;
  /** `frame-select.json`; every multiframe source needs an entry. */
  frameSelectPath?: string | null;
  /** `qa-accept.json`. */
  acceptPath?: string | null;
  /** `alpha-overrides.json`. */
  alphaOverridesPath?: string | null;
  /** Explicit sources (tests / synthetic runs). */
  sources?: SpriteSource[];
  /** Expected species set (defaults to the legacy species; the sources' ids when there is none). */
  species?: string[];
  /** Restrict to these species ids. */
  only?: string[];
  limit?: number;
  /** Ignore the sprite cache (atlas and thumb caches are content-keyed and always valid). */
  force?: boolean;
  /**
   * The manifest whose atlases the plan keeps (spec §40.1.4 stability): undefined reads the one
   * already in `outDir`, null (`--replan`) plans from scratch.
   */
  baselinePath?: string | null;
  spriteSize?: number;
  atlasSize?: number;
  /** Only refresh the QA artifacts (sprites still go through the cached stages). */
  qaOnly?: boolean;
  /** Per-sprite stage workers (default CONCURRENCY 3). Output-neutral. */
  jobs?: number;
  budgetBytes?: number;
  /** Build the flipbooks of multiframe sources (default true; §40.1.3 as amended 2026-10-06). */
  anim?: boolean;
  /** Ceiling for `animTotalBytes` (default ANIM_BUDGET_BYTES, 24 MiB). */
  animBudgetBytes?: number;
  log?: (msg: string) => void;
}

export interface ProcessedSprite {
  source: SpriteSource;
  hash: string;
  meta: SpriteMeta;
  cached: boolean;
}

export interface BuildResult {
  manifest: SpriteManifestV2 | null;
  report: QaReport;
  sprites: ProcessedSprite[];
  plan: ZonePlan | null;
  rung: Rung | null;
  atlasCount: number;
  totalBytes: number;
  cacheHits: number;
  outFiles: string[];
  /** The flipbooks (null when no source is multiframe, `anim: false` or `qaOnly`). */
  anim: { sides: ProcessedAnimSide[]; rung: Rung; totalBytes: number; rungsTried: AnimEncodeResult['rungsTried']; cacheHits: number } | null;
}

export type FrameSelect = Record<string, number>;
export type AlphaOverrides = Record<string, AlphaOptions>;

const noop = (): void => {};

function readJson<T>(file: string | null | undefined, fallback: T): T {
  if (!file || !existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

export function resolveAlphaOverride(overrides: AlphaOverrides, id: string, side: string): AlphaOptions {
  return overrides[`${id}/${side}`] ?? overrides[id] ?? {};
}

export async function runBuild(opts: BuildOptions): Promise<BuildResult> {
  const log = opts.log ?? noop;
  const spriteSize = opts.spriteSize ?? DEFAULT_SPRITE_SIZE;
  const atlasSize = opts.atlasSize ?? DEFAULT_ATLAS_SIZE;
  if (atlasSize !== 2 * spriteSize) throw new Error(`atlasSize ${atlasSize} must be 2 × spriteSize ${spriteSize} (2 × 2 cells)`);
  const budget = opts.budgetBytes ?? CREATURES_BUDGET_BYTES;
  const cache = new SpriteCache(opts.cacheDir);
  const frameSelect = readJson<FrameSelect>(opts.frameSelectPath, {});
  const alphaOverrides = readJson<AlphaOverrides>(opts.alphaOverridesPath, {});
  const accepted = readJson<QaAcceptance[]>(opts.acceptPath, []);

  // ---- sources -------------------------------------------------------------------------
  const legacy: LegacyData | null = opts.legacyDir ? await loadLegacyData(opts.legacyDir) : null;
  let sources: SpriteSource[];
  let excluded: ExcludedFile[] = [];
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
    excluded = res.excluded;
  }
  let expectedSpecies = opts.species ?? (legacy ? [...legacy.species.keys()] : [...new Set(sources.map((s) => s.id))]);
  if (opts.only) {
    const only = new Set(opts.only);
    sources = sources.filter((s) => only.has(s.id));
    expectedSpecies = expectedSpecies.filter((id) => only.has(id));
  }
  if (opts.limit !== undefined) {
    const keep = new Set([...new Set(sources.map((s) => s.id))].slice(0, opts.limit));
    sources = sources.filter((s) => keep.has(s.id));
    expectedSpecies = expectedSpecies.filter((id) => keep.has(id));
  }
  expectedSpecies = [...expectedSpecies].sort(compareStrings);
  log(`${sources.length} sprites from ${opts.assetsDir}${excluded.length ? ` (${excluded.length} files excluded)` : ''}`);

  // ---- per-sprite stages -----------------------------------------------------------------
  const sprites: ProcessedSprite[] = [];
  const animSources: Array<{ src: SpriteSource; frame: number }> = [];
  const missingFrames: string[] = [];
  let cacheHits = 0;
  let done = 0;
  const queue = [...sources];
  const worker = async (): Promise<void> => {
    for (let src = queue.shift(); src; src = queue.shift()) {
      const bytes = new Uint8Array(readFileSync(src.abs));
      const frames = await pageCount(bytes);
      const key = `${src.id}/${src.side}`;
      let frame = 0;
      if (frames > 1) {
        const chosen = frameSelect[key];
        if (chosen === undefined) {
          missingFrames.push(`${key} (${frames} pages)`);
          continue;
        }
        if (!Number.isInteger(chosen) || chosen < 0 || chosen >= frames) throw new Error(`frame-select.json: ${key} = ${chosen} is outside 0..${frames - 1}`);
        frame = chosen;
        animSources.push({ src, frame });
      }
      const p = await processSprite(src, cache, {
        spriteSize,
        force: opts.force ?? false,
        bytes,
        frames,
        frame,
        alpha: resolveAlphaOverride(alphaOverrides, src.id, src.side),
      });
      if (p.cached) cacheHits++;
      sprites.push(p);
      done++;
      if (done % 25 === 0 || done === sources.length) log(`  processed ${done}/${sources.length} (${cacheHits} cached)`);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.jobs ?? CONCURRENCY) }, worker));
  if (missingFrames.length) {
    throw new Error(
      `multiframe sources without a frame-select.json entry: ${missingFrames.sort().join(', ')}. ` +
        `Run \`tsx src/cli.ts frames --all\` and pick a page per source from qa/frames/.`,
    );
  }
  sprites.sort((a, b) => compareSources(a.source, b.source));

  // ---- QA entries ------------------------------------------------------------------------
  const bySpecies = new Map<string, ProcessedSprite[]>();
  for (const p of sprites) {
    const list = bySpecies.get(p.source.id) ?? [];
    list.push(p);
    bySpecies.set(p.source.id, list);
  }
  const qaEntries: Array<Omit<QaEntry, 'actionable'>> = sprites.map((p) => {
    const flags: QaFlag[] = [...p.meta.flags];
    const front = bySpecies.get(p.source.id)!.find((s) => s.source.side === 'front');
    const back = bySpecies.get(p.source.id)!.find((s) => s.source.side === 'back');
    if (front && back && isSideMismatch(front.meta.pixelScale, back.meta.pixelScale)) flags.push('sidemismatch');
    return { species: p.source.id, side: p.source.side, flags, source: p.source.file };
  });
  mkdirSync(opts.qaDir, { recursive: true });
  const sheet = await renderContactSheet(
    sprites.map((p) => ({
      label: `${p.source.side === 'front' ? 'F' : 'B'} ${p.source.id}`,
      albedoPath: cache.pngPath(p.hash, 'albedo'),
      flagged: p.meta.flags.some((f) => !INFORMATIONAL_FLAGS.has(f)),
    })),
  );
  writeFileSync(path.join(opts.qaDir, 'contact-sheet.png'), sheet);

  // ---- plan ------------------------------------------------------------------------------
  const ids = [...bySpecies.keys()].sort(compareStrings);
  for (const id of ids) {
    const sides = bySpecies.get(id)!.map((s) => s.source.side);
    if (!sides.includes('front') || !sides.includes('back')) throw new Error(`species ${id} has no ${sides.includes('front') ? 'back' : 'front'} sprite`);
  }
  const rosterPath = opts.rosterPath ?? null;
  const roster = rosterPath && existsSync(rosterPath) ? loadRosterTables(rosterPath) : null;
  const known = new Set(legacy ? legacy.species.keys() : ids);
  const zoneInputs = buildZoneInputs({ roster, legacy }, known);
  const baselinePath = opts.baselinePath === undefined ? path.join(opts.outDir, MANIFEST_FILE) : opts.baselinePath;
  const baseline = readBaseline(baselinePath);
  const plan = planAtlases(ids, zoneInputs.sets, MAX_ATLASES_PER_ZONE, zoneInputs.league, baseline);
  logStability(plan, baseline, baselinePath, log);
  const writeReport = (encoding: QaEncodingSummary | null, totalBytes: number): QaReport => {
    const report = buildQaReport({ entries: qaEntries, excluded, accepted, bindStats: plan.bindStats, encoding, totalBytes });
    writeFileSync(path.join(opts.qaDir, 'qa-report.json'), serializeQaReport(report));
    return report;
  };

  if (opts.qaOnly) {
    // `qa` refreshes flags and the contact sheet; the encoding summary belongs to the build that
    // produced the output on disk, so it is carried over from the previous report, not nulled.
    const prevPath = path.join(opts.qaDir, 'qa-report.json');
    const prev = existsSync(prevPath) ? (JSON.parse(readFileSync(prevPath, 'utf8')) as Partial<QaReport>) : null;
    const report = writeReport(prev?.encoding ?? null, staticTotalBytes(opts.outDir));
    log(`QA: ${report.flagged.length}/${report.total} flagged, ${report.actionable} actionable -> ${opts.qaDir}`);
    return { manifest: null, report, sprites, plan, rung: null, atlasCount: 0, totalBytes: report.totalBytes, cacheHits, outFiles: [], anim: null };
  }

  // ---- thumbs ----------------------------------------------------------------------------
  const thumbs = new Map<string, Uint8Array>();
  const thumbRungs: Record<string, number> = {};
  for (const id of ids) {
    const front = bySpecies.get(id)!.find((s) => s.source.side === 'front')!;
    const thumbKey = sha256(front.hash, 'thumb', `size=${THUMB_SIZE}`, `ladder=${THUMB_LADDER.map(thumbRungKey).join(',')}`, `max=${THUMB_MAX_BYTES}`);
    let cached = cache.readThumb(thumbKey);
    if (!cached) {
      const albedo = await cache.readRgba(front.hash, 'albedo');
      const bbox = front.meta.bbox ?? { x0: 0, y0: 0, x1: albedo.width - 1, y1: albedo.height - 1 };
      const thumb = await encodeThumb(albedo, bbox, THUMB_SIZE, THUMB_MAX_BYTES);
      if (thumb.rung !== THUMB_LADDER[0]) log(`  thumb ${id}: ${thumbRungKey(thumb.rung)} to fit ${THUMB_MAX_BYTES} B (${thumb.bytes.byteLength} B)`);
      cache.writeThumb(thumbKey, thumb.bytes, thumbRungKey(thumb.rung));
      cached = { bytes: thumb.bytes, rung: thumbRungKey(thumb.rung) };
    }
    if (cached.bytes.byteLength > THUMB_MAX_BYTES) throw new Error(`thumb ${id}: ${cached.bytes.byteLength} B > ${THUMB_MAX_BYTES} B at the bottom of the thumb ladder`);
    thumbs.set(id, cached.bytes);
    thumbRungs[cached.rung] = (thumbRungs[cached.rung] ?? 0) + 1;
  }
  const thumbBytes = [...thumbs.values()].reduce((n, b) => n + b.byteLength, 0);
  const thumbSummary: QaEncodingSummary['thumbs'] = { count: thumbs.size, bytes: thumbBytes, rungs: Object.fromEntries(Object.entries(thumbRungs).sort(([a], [b]) => compareStrings(a, b))) };

  // ---- atlases: members + placements ----------------------------------------------------------
  interface AtlasJob {
    id: string;
    species: string[];
    dupFor: string | null;
    members: ProcessedSprite[];
    placed: Rect[];
    memberKey: string[];
  }
  const jobs: AtlasJob[] = plan.atlases.map((a) => {
    // Cells in plan order (a pinned atlas keeps its baseline order), back before front per species.
    const members = a.species.flatMap((id) => [...(bySpecies.get(id) ?? [])].sort((x, y) => compareSources(x.source, y.source)));
    const placed = packSquares(members.length, spriteSize, atlasSize);
    return { id: a.id, species: a.species, dupFor: a.dupFor, members, placed, memberKey: members.map((m, i) => `${m.hash}@${placed[i]!.x},${placed[i]!.y}`) };
  });

  // ---- encoding under the ladder -----------------------------------------------------------
  type Encoded = Record<TextureKind, Uint8Array[]>;
  const rungsTried: QaEncodingSummary['rungsTried'] = [];
  let chosen: { rung: Rung; encoded: Map<string, Encoded>; manifest: SpriteManifestV2; totalBytes: number } | null = null;
  for (const rung of ladderRungs()) {
    const encoded = new Map<string, Encoded>();
    let atlasBytes = 0;
    // Atlases encode in parallel; the map is keyed by atlas id, so worker order never reaches the output.
    const pending = [...jobs];
    const encodeWorker = async (): Promise<void> => {
      for (let job = pending.shift(); job; job = pending.shift()) {
        const files = await encodeAtlasFiles(job, rung, cache, atlasSize, spriteSize, log);
        encoded.set(job.id, files);
        for (const kind of ['albedo', 'normal', 'emissive'] as const) for (const b of files[kind]) atlasBytes += b.byteLength;
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, opts.jobs ?? CONCURRENCY) }, encodeWorker));
    const built = buildManifest(jobs, encoded, rung, plan, atlasBytes + thumbBytes, ids, atlasSize, spriteSize);
    rungsTried.push({ albedo: rung.albedo, normal: rung.normal, totalBytes: built.totalBytes });
    log(`ladder albedo q${rung.albedo} / normal q${rung.normal}: ${(built.totalBytes / 1e6).toFixed(2)} MB (budget ${(budget / 1e6).toFixed(2)} MB)`);
    if (built.totalBytes <= budget) {
      chosen = { rung, encoded, manifest: built.manifest, totalBytes: built.totalBytes };
      break;
    }
  }
  if (!chosen) {
    throw new Error(`creatures exceed the ${budget} B budget at the bottom of the ladder: ${rungsTried.map((r) => `q${r.albedo}/q${r.normal} = ${r.totalBytes} B`).join(', ')}`);
  }
  const errors = manifestErrors(chosen.manifest, { species: expectedSpecies, budgetBytes: budget, spriteSize });
  if (errors.length) throw new Error(`internal: manifest failed validation:\n  ${errors.join('\n  ')}`);

  // ---- flipbooks of the multiframe sources (§40.1.3 as amended 2026-10-06) -----------------------------------------
  const animBudget = opts.animBudgetBytes ?? ANIM_BUDGET_BYTES;
  const animCache = new AnimCache(opts.cacheDir);
  let anim: (AnimEncodeResult & { sides: ProcessedAnimSide[]; cacheHits: number }) | null = null;
  if (opts.anim !== false && animSources.length > 0) {
    const sides: ProcessedAnimSide[] = [];
    let animHits = 0;
    for (const { src, frame } of [...animSources].sort((a, b) => compareSources(a.src, b.src))) {
      const side = await processAnimSide(src, animCache, {
        spriteSize,
        bytes: new Uint8Array(readFileSync(src.abs)),
        staticFrame: frame,
        alpha: resolveAlphaOverride(alphaOverrides, src.id, src.side),
        force: opts.force ?? false,
        jobs: Math.max(1, opts.jobs ?? CONCURRENCY),
      });
      if (side.cached) animHits++;
      log(`  anim ${src.id}/${src.side}: ${side.meta.pages} pages${side.cached ? ' (cached)' : ''}`);
      sides.push(side);
    }
    const res = await encodeAnimUnderBudget(sides.map(animJob), chosen.manifest, animCache, animBudget, Math.max(1, opts.jobs ?? CONCURRENCY), log);
    const animErrors = manifestErrors(res.manifest, { species: expectedSpecies, budgetBytes: budget, spriteSize, animBudgetBytes: animBudget });
    if (animErrors.length) throw new Error(`internal: manifest (with anim) failed validation:\n  ${animErrors.join('\n  ')}`);
    anim = { ...res, sides, cacheHits: animHits };
  }
  const finalManifest = anim ? anim.manifest : chosen.manifest;

  // ---- write the output tree -----------------------------------------------------------------
  rmSync(opts.outDir, { recursive: true, force: true });
  mkdirSync(path.join(opts.outDir, 'atlases'), { recursive: true });
  mkdirSync(path.join(opts.outDir, 'thumbs'), { recursive: true });
  const outFiles: string[] = [];
  for (const job of jobs) {
    const files = chosen.encoded.get(job.id)!;
    for (const kind of ['albedo', 'normal', 'emissive'] as const) {
      files[kind].forEach((bytes, level) => {
        const p = path.join(opts.outDir, atlasFileName(job.id, kind, level));
        writeFileSync(p, bytes);
        outFiles.push(p);
      });
    }
  }
  for (const [id, bytes] of thumbs) {
    const p = path.join(opts.outDir, thumbFileName(id));
    writeFileSync(p, bytes);
    outFiles.push(p);
  }
  if (anim) {
    mkdirSync(path.join(opts.outDir, ANIM_DIR), { recursive: true });
    for (const side of anim.sides) {
      const files = anim.encoded.get(animAtlasId(side.meta.id, side.meta.side))!;
      for (const kind of ['albedo', 'normal', 'emissive'] as const) {
        files[kind].forEach((bytes, level) => {
          const p = path.join(opts.outDir, animFileName(side.meta.id, side.meta.side, kind, level));
          writeFileSync(p, bytes);
          outFiles.push(p);
        });
      }
    }
  }
  const manifestPath = path.join(opts.outDir, MANIFEST_FILE);
  writeFileSync(manifestPath, serializeManifest(finalManifest));
  outFiles.push(manifestPath);
  const onDisk = dirBytes(opts.outDir);
  const expected = chosen.totalBytes + (finalManifest.animTotalBytes ?? 0);
  if (onDisk !== expected) {
    throw new Error(`internal: manifest totalBytes ${chosen.totalBytes} + animTotalBytes ${finalManifest.animTotalBytes ?? 0} != ${onDisk} on disk`);
  }
  if (anim) {
    const sheet = await renderAnimSheet(
      anim.sides.map((sd) => ({
        label: `${sd.meta.side === 'front' ? 'F' : 'B'} ${sd.meta.id.toUpperCase()} ${sd.meta.pages}P ${sd.meta.delays[0]}MS`,
        framePaths: Array.from({ length: sd.meta.pages }, (_unused, p) => animCache.framePath(sd.hash, p, 'albedo')),
        staticFrame: sd.meta.staticFrame,
        cell: sd.meta.cell,
      })),
    );
    writeFileSync(path.join(opts.qaDir, 'anim-sheet.png'), sheet);
    writeFileSync(path.join(opts.qaDir, 'anim-report.json'), serializeAnimReport(anim, finalManifest));
  }

  const report = writeReport({ albedoQuality: chosen.rung.albedo, normalQuality: chosen.rung.normal, rungsTried, thumbs: thumbSummary }, chosen.totalBytes);
  log(`QA: ${report.flagged.length}/${report.total} flagged, ${report.actionable} actionable -> ${opts.qaDir}`);
  log(`wrote ${jobs.length} atlases, ${ids.length} species, ${(chosen.totalBytes / 1e6).toFixed(2)} MB -> ${opts.outDir}`);
  if (anim) {
    const frames = anim.sides.reduce((n, sd) => n + sd.meta.pages, 0);
    log(`wrote ${anim.sides.length} anim atlases (${frames} frames), ${((finalManifest.animTotalBytes ?? 0) / 1e6).toFixed(2)} MB -> ${path.join(opts.outDir, ANIM_DIR)}`);
  }
  return {
    manifest: finalManifest,
    report,
    sprites,
    plan,
    rung: chosen.rung,
    atlasCount: jobs.length,
    totalBytes: chosen.totalBytes,
    cacheHits,
    outFiles,
    anim: anim ? { sides: anim.sides, rung: anim.rung, totalBytes: finalManifest.animTotalBytes ?? 0, rungsTried: anim.rungsTried, cacheHits: anim.cacheHits } : null,
  };
}

/**
 * The plan a build would make, logged against its baseline, without any image work: the species are
 * the legacy ids with both source files (`build` additionally requires every one of them).
 */
export async function previewPlan(opts: Pick<BuildOptions, 'assetsDir' | 'outDir' | 'legacyDir' | 'rosterPath' | 'baselinePath' | 'log'>): Promise<ZonePlan> {
  const log = opts.log ?? noop;
  if (!opts.legacyDir) throw new Error('plan needs legacyDir');
  const legacy = await loadLegacyData(opts.legacyDir);
  const sides = new Map<string, Set<string>>();
  for (const src of resolveSources(opts.assetsDir, legacy.species).sources) sides.set(src.id, (sides.get(src.id) ?? new Set()).add(src.side));
  const ids = [...sides].filter(([, s]) => s.size === 2).map(([id]) => id).sort(compareStrings);
  const roster = opts.rosterPath && existsSync(opts.rosterPath) ? loadRosterTables(opts.rosterPath) : null;
  const zoneInputs = buildZoneInputs({ roster, legacy }, new Set(legacy.species.keys()));
  const baselinePath = opts.baselinePath === undefined ? path.join(opts.outDir, MANIFEST_FILE) : opts.baselinePath;
  const baseline = readBaseline(baselinePath);
  const plan = planAtlases(ids, zoneInputs.sets, MAX_ATLASES_PER_ZONE, zoneInputs.league, baseline);
  logStability(plan, baseline, baselinePath, log);
  log(`${ids.length} species, ${plan.atlases.length} atlases, ${plan.duplicated.length} duplicated; most bound zone ${Math.max(...[...plan.zones.values()].map((l) => l.length))} of ${MAX_ATLASES_PER_ZONE}`);
  return plan;
}

function readBaseline(file: string | null): PlanBaseline | null {
  if (!file || !existsSync(file)) return null;
  return baselineFromManifest(JSON.parse(readFileSync(file, 'utf8')) as SpriteManifestV2);
}

function logStability(plan: ZonePlan, baseline: PlanBaseline | null, file: string | null, log: (m: string) => void): void {
  const s = plan.stability;
  if (!baseline) {
    log(`plan: from scratch (${file ? `no baseline at ${file}` : '--replan'}), ${s.added.length} atlases`);
    return;
  }
  log(`plan: ${s.kept.length} of ${baseline.atlases.length} atlases kept as they were, ${s.changed.length} changed, ${s.added.length} added, ${s.dropped.length} dropped (baseline ${file})`);
  if (s.changed.length) log(`  changed: ${s.changed.join(', ')}`);
  if (s.added.length) log(`  added: ${s.added.join(', ')}`);
  if (s.dropped.length) log(`  dropped: ${s.dropped.join(', ')}`);
  if (s.released.length) {
    log(`  cap: released ${s.released.length} pinned atlases to keep ${s.releasedFor.join(', ')} within ${MAX_ATLASES_PER_ZONE} binds: ${s.released.join(', ')}`);
  }
}

/** Every static file under the output: `outDir` without its `anim/` subdirectory (the §40.6 static creatures line). */
export function staticDirBytes(outDir: string): number {
  return dirBytes(outDir) - dirBytes(path.join(outDir, ANIM_DIR));
}

/**
 * The static line as the manifest's `totalBytes` counts it: every byte under `outDir` minus `animTotalBytes` (the
 * `anim/` files and the bytes the manifest's anim fields add). `staticDirBytes` still holds that anim share.
 */
function staticTotalBytes(outDir: string): number {
  const file = path.join(outDir, MANIFEST_FILE);
  const animTotal = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Partial<SpriteManifestV2>).animTotalBytes : undefined;
  return animTotal === undefined ? staticDirBytes(outDir) : dirBytes(outDir) - animTotal;
}

/** `qa/anim-report.json`: per side the pages, delays, crop, shared transform, grid, bytes and per-frame foot row. */
function serializeAnimReport(anim: AnimEncodeResult & { sides: ProcessedAnimSide[] }, m: SpriteManifestV2): string {
  const atlases = new Map((m.animAtlases ?? []).map((a) => [a.id, a]));
  const sides = anim.sides.map((sd) => {
    const meta = sd.meta;
    const a = atlases.get(animAtlasId(meta.id, meta.side))!;
    const bottoms = meta.frameBboxes.map((b) => (b ? b.y1 : null));
    return {
      species: meta.id,
      side: meta.side,
      source: meta.source,
      sourceSize: [meta.sourceWidth, meta.sourceHeight],
      pages: meta.pages,
      staticFrame: meta.staticFrame,
      delays: [...new Set(meta.delays)],
      loopMs: meta.delays.reduce((n, d) => n + d, 0),
      staticBbox: meta.staticBbox,
      union: meta.union,
      master: meta.master,
      cell: meta.cell,
      grid: [a.width / a.cell, a.height / a.cell],
      atlas: [a.width, a.height],
      bytes: { albedo: a.albedo.bytes, normal: a.normal.bytes, emissive: a.emissive.bytes, total: a.albedo.bytes + a.normal.bytes + a.emissive.bytes },
      staticFrameBottom: bottoms[meta.staticFrame],
      frameBottoms: bottoms,
      emissivePixels: meta.emissivePixels,
    };
  });
  return `${JSON.stringify({ rung: anim.rung, rungsTried: anim.rungsTried, animTotalBytes: m.animTotalBytes, sides }, null, 2)}\n`;
}

export function atlasFileName(atlasId: string, kind: TextureKind, level: number): string {
  return `atlases/${atlasId}.${kind}${level === 0 ? '' : `.m${level}`}.webp`;
}

export function thumbFileName(species: string): string {
  return `thumbs/${species}_front.webp`;
}

// ---- per-sprite stages --------------------------------------------------------------------

export interface ProcessContext {
  spriteSize: number;
  force: boolean;
  /** Source bytes (read once by the caller). */
  bytes: Uint8Array;
  frames: number;
  frame: number;
  alpha: AlphaOptions;
}

export function spriteCacheKey(bytes: Uint8Array, id: string, spriteSize: number, frame: number, alpha: AlphaOptions): string {
  return sha256(
    bytes,
    `v${SPRITE_STAGE_VERSION}`,
    `size=${spriteSize}`,
    `normal=${JSON.stringify(DEFAULT_NORMAL_OPTIONS)}`,
    `emissive=${JSON.stringify(resolveEmissiveOverride(id))}`,
    `frame=${frame}`,
    `alpha=${JSON.stringify(alpha)}`,
  );
}

/** The share of a normalised cell's height its opaque texels (the atlas's binary alpha) span: the renderer sizes the card by it. */
export function bodyVOf(albedo: RgbaImage): number {
  const b = alphaBbox(albedo, ALPHA_THRESHOLD);
  return b === null ? 0 : round((b.y1 - b.y0 + 1) / albedo.height, 4);
}

export async function processSprite(src: SpriteSource, cache: SpriteCache, ctx: ProcessContext): Promise<ProcessedSprite> {
  const hash = spriteCacheKey(ctx.bytes, src.id, ctx.spriteSize, ctx.frame, ctx.alpha);
  if (!ctx.force && cache.has(hash)) {
    const meta = cache.readMeta(hash);
    if (meta.bodyV === undefined) meta.bodyV = bodyVOf(await cache.readRgba(hash, 'albedo'));
    return { source: src, hash, meta, cached: true };
  }
  const decoded = await decodeToRgba(ctx.bytes, ctx.frame);
  const alpha = recoverAlpha(decoded, ctx.alpha);
  const flags: QaFlag[] = [...alpha.flags];
  if (ctx.frames > 1) flags.push('multiframe');

  let albedo: RgbaImage;
  let pixelScale = 1;
  let kernel: 'nearest' | 'lanczos3' = 'nearest';
  if (alpha.bbox) {
    const norm = await normalizeSprite(alpha.image, alpha.bbox, ctx.spriteSize);
    albedo = norm.image;
    pixelScale = norm.placement.scale;
    kernel = norm.placement.kernel;
  } else {
    albedo = createRgba(ctx.spriteSize, ctx.spriteSize); // nothing recoverable; the 'empty' flag says so
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
    frames: ctx.frames,
    frame: ctx.frame,
    recovered: alpha.recovered,
    coverage: round(alpha.coverage, 4),
    flags: [...new Set(flags)].sort(compareStrings),
    footV: MANIFEST_FOOT_V,
    pixelScale: round(pixelScale, 6),
    kernel,
    emissivePixels,
    bbox: alphaBbox(albedo),
    bodyV: bodyVOf(albedo),
  };
  await cache.write(hash, { meta, albedo, normal, emissive });
  return { source: src, hash, meta, cached: false };
}

// ---- atlas rasters + encoding ------------------------------------------------------------------

export interface AtlasRasters {
  /** Level 0 (2048²) .. level MIP_LEVELS. */
  albedo: RgbaImage[];
  /** Half resolution: level 0 is 1024². */
  normal: RgbaImage[];
  emissive: GrayImage[];
}

/** Composites the cached sprite rasters into the three atlas maps and builds their mip chains. */
export async function buildAtlasRasters(members: Array<{ hash: string }>, placed: Rect[], cache: SpriteCache, atlasSize: number, spriteSize: number): Promise<AtlasRasters> {
  const albedo0 = createRgba(atlasSize, atlasSize);
  const normal0 = createRgba(atlasSize, atlasSize);
  const emissive0 = createGray(atlasSize, atlasSize);
  // Transparent texels of the normal atlas encode the flat normal.
  for (let p = 0; p < atlasSize * atlasSize; p++) {
    normal0.data[p * 4] = 128;
    normal0.data[p * 4 + 1] = 128;
    normal0.data[p * 4 + 2] = 255;
  }
  for (let i = 0; i < members.length; i++) {
    const { x, y } = placed[i]!;
    const a = await cache.readRgba(members[i]!.hash, 'albedo');
    const n = await cache.readRgba(members[i]!.hash, 'normal');
    const e = await cache.readGray(members[i]!.hash);
    for (const img of [a, n]) {
      if (img.width !== spriteSize || img.height !== spriteSize) throw new Error(`cached sprite ${members[i]!.hash} is ${img.width}x${img.height}, expected ${spriteSize}`);
    }
    blit(albedo0, a.data, a.width, a.height, x, y);
    blit(normal0, n.data, n.width, n.height, x, y);
    blitGray(emissive0, e, x, y);
  }
  // Binary alpha everywhere (types.ts ALPHA_THRESHOLD). The normal atlas carries the albedo's alpha.
  binarizeAlpha(albedo0);
  // Re-apply the stage-1 transparent-RGB rule at atlas level: stage 2's premultiplied lanczos
  // resize leaves a = 0 texels black right against the silhouette, which linear minification
  // reads as a dark fringe and which libwebp codes as a hard step.
  cleanTransparentRgb(albedo0);
  for (let p = 0; p < atlasSize * atlasSize; p++) {
    const a = albedo0.data[p * 4 + 3]!;
    normal0.data[p * 4 + 3] = a;
    if (a === 0) {
      normal0.data[p * 4] = 128;
      normal0.data[p * 4 + 1] = 128;
      normal0.data[p * 4 + 2] = 255;
    }
  }
  const normalHalf = await halfResolutionNormal(normal0);
  const halfCell = Math.round(spriteSize * NORMAL_SCALE);
  return {
    albedo: [albedo0, ...buildAlphaMipChain(albedo0, MIP_LEVELS, spriteSize)],
    normal: [normalHalf, ...buildNormalMipChain(normalHalf, MIP_LEVELS, halfCell)],
    emissive: [emissive0, ...buildMaskMipChain(emissive0, MIP_LEVELS)],
  };
}

export function atlasFileKey(memberKey: string[], kind: TextureKind, level: number, settings: MapEncodeSettings, atlasSize: number, spriteSize: number): string {
  return sha256(PIPELINE_VERSION, settingsKey(settings), `${atlasSize}/${spriteSize}`, kind, `L${level}`, ...memberKey);
}

async function encodeAtlasFiles(
  job: { id: string; members: ProcessedSprite[]; placed: Rect[]; memberKey: string[] },
  rung: Rung,
  cache: SpriteCache,
  atlasSize: number,
  spriteSize: number,
  log: (m: string) => void,
): Promise<Record<TextureKind, Uint8Array[]>> {
  const out: Record<TextureKind, Uint8Array[]> = { albedo: [], normal: [], emissive: [] };
  let rasters: AtlasRasters | null = null;
  let encodedAny = false;
  for (const kind of ['albedo', 'normal', 'emissive'] as const) {
    for (const level of mipLevels()) {
      const settings = settingsFor(kind, rung, level);
      const key = atlasFileKey(job.memberKey, kind, level, settings, atlasSize, spriteSize);
      let bytes = cache.readAtlas(key, 'webp');
      if (!bytes) {
        rasters ??= await buildAtlasRasters(job.members, job.placed, cache, atlasSize, spriteSize);
        bytes = kind === 'emissive' ? await encodeMaskWebp(rasters.emissive[level]!, settings) : await encodeRgbaWebp(rasters[kind][level]!, settings);
        cache.writeAtlas(key, 'webp', bytes);
        encodedAny = true;
      }
      out[kind].push(bytes);
    }
  }
  if (encodedAny) {
    const kb = (list: Uint8Array[]): string => (list.reduce((n, b) => n + b.byteLength, 0) / 1024).toFixed(0);
    log(`  atlas ${job.id}: ${job.members.length} sprites, albedo ${kb(out.albedo)} KB, normal ${kb(out.normal)} KB, emissive ${kb(out.emissive)} KB (with mips)`);
  }
  return out;
}

// ---- manifest ------------------------------------------------------------------------------

function buildManifest(
  jobs: Array<{ id: string; species: string[]; dupFor: string | null; members: ProcessedSprite[]; placed: Rect[] }>,
  encoded: Map<string, Record<TextureKind, Uint8Array[]>>,
  rung: Rung,
  plan: ZonePlan,
  fileBytes: number,
  ids: string[],
  atlasSize: number,
  spriteSize: number,
): { manifest: SpriteManifestV2; totalBytes: number } {
  const atlases: ManifestAtlasV2[] = [];
  const rects = new Map<string, { front?: SpriteRectV2; back?: SpriteRectV2 }>();
  const alt = new Map<string, Record<string, { front?: SpriteRectV2; back?: SpriteRectV2 }>>();
  for (const job of jobs) {
    const files = encoded.get(job.id)!;
    const map = (kind: TextureKind): ManifestMap => {
      const s = settingsFor(kind, rung, 0);
      return {
        url: atlasFileName(job.id, kind, 0),
        mips: mipLevels()
          .slice(1)
          .map((l) => atlasFileName(job.id, kind, l)),
        codec: s.codec,
        quality: s.quality,
        bytes: files[kind].reduce((n, b) => n + b.byteLength, 0),
      };
    };
    atlases.push({
      id: job.id,
      species: [...job.species].sort(compareStrings),
      // Production cells are 1024² in 2048² atlases; test fixtures build smaller ones with the same shape.
      size: atlasSize as 2048,
      slots: job.members.length,
      albedo: map('albedo'),
      normal: map('normal'),
      emissive: map('emissive'),
      normalScale: NORMAL_SCALE,
    });
    job.members.forEach((m, i) => {
      const r = job.placed[i]!;
      const px: [number, number, number, number] = [r.x, r.y, r.w, r.h];
      const rect: SpriteRectV2 = {
        atlas: job.id,
        px,
        uv: pxToUv(px, atlasSize),
        footV: MANIFEST_FOOT_V,
        aspect: r.w / r.h,
        ...(m.meta.bodyV !== undefined && m.meta.bodyV > 0 ? { bodyV: m.meta.bodyV } : {}),
        pixelScale: m.meta.pixelScale,
        source: m.source.file,
      };
      if (job.dupFor === null) {
        const entry = rects.get(m.source.id) ?? {};
        entry[m.source.side] = rect;
        rects.set(m.source.id, entry);
      } else {
        const bySpecies = alt.get(m.source.id) ?? {};
        const entry = (bySpecies[job.id] ??= {});
        entry[m.source.side] = rect;
        alt.set(m.source.id, bySpecies);
      }
    });
  }
  const sprites: Record<string, ManifestSpriteV2> = {};
  for (const id of ids) {
    const r = rects.get(id);
    if (!r?.front || !r.back) throw new Error(`internal: species ${id} has no home placement`);
    const sizeScale = jobs.flatMap((j) => j.members).find((m) => m.source.id === id)!.source.sizeScale;
    const alts = alt.get(id);
    let altOut: ManifestSpriteV2['alt'];
    if (alts) {
      altOut = {};
      for (const [atlasId, pair] of Object.entries(alts)) {
        if (!pair.front || !pair.back) throw new Error(`internal: duplicate of ${id} in ${atlasId} lacks a side`);
        altOut = { ...altOut, [atlasId]: { front: pair.front, back: pair.back } };
      }
    }
    sprites[id] = {
      front: r.front,
      back: r.back,
      sizeScale,
      home: plan.home.get(id)!,
      thumb: thumbFileName(id),
      ...(altOut ? { alt: altOut } : {}),
    };
  }
  const zones: Record<string, string[]> = {};
  for (const [z, list] of plan.zones) zones[z] = list;
  let totalBytes = fileBytes;
  let manifest: SpriteManifestV2 = { version: 2, encoding: 'webp', spriteSize: spriteSize as 1024, pipelineVersion: PIPELINE_VERSION, atlases, zones, sprites, totalBytes };
  // The manifest counts itself: iterate until its own length is stable.
  for (let i = 0; i < 4; i++) {
    const len = Buffer.byteLength(serializeManifest(manifest), 'utf8');
    if (fileBytes + len === totalBytes) break;
    totalBytes = fileBytes + len;
    manifest = { ...manifest, totalBytes };
  }
  return { manifest, totalBytes };
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
