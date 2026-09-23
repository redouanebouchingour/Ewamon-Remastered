/**
 * The bake: select surfaces, hash, bake+encode what the cache lacks (worker pool), copy into
 * public/materials, write the placeholder set, materials.manifest.json and qa/qa-report.json.
 */
import { availableParallelism } from 'node:os';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import { BIOME_ROWS, RECIPES, SURFACES, SURFACE_IDS, biomeSurfaceSet, recipeCoverage } from '@ewa/render/surfaces';
import type { Biome, SurfaceId } from '@ewa/render/surfaces';
import { TIER_SIZE } from './bake';
import type { Tier } from './bake';
import { MAPS, readTierMeta, surfaceHash, tierFile, tiersFor } from './cache';
import type { TierMeta } from './cache';
import { DEFAULT_RDO, encodeKtx2, probeEncoder } from './encode';
import type { Level } from './encode';
import { runJob } from './job';
import type { JobInput } from './job';
import { MANIFEST_FILE, PLACEHOLDER_FILES, stableJson, tierFiles, validateManifest } from './manifest';
import type { MaterialSetEntry, MaterialTier, MaterialsManifest } from './manifest';
import { DEFAULT_CACHE_DIR, DEFAULT_OUT_DIR, QA_DIR } from './paths';
import { ZONE_BIOME } from './zones';

/** §40.3.5 per-map byte targets (MB = 2^20 B, as §40.6 counts). */
export const FIELD_MAP_TARGET = 0.1 * 1048576;
export const HERO_MAP_TARGET = 0.4 * 1048576;
export const MATERIALS_CEILING = 90 * 1048576;
export const PHASE2_FIELD_CEILING = 6 * 1048576;
/**
 * The §40.3.5 remedy for a map over its target is a higher per-surface `rdo`. Measured on this encoder, RDO
 * beyond 4 buys < 10 % more bytes for > 3 dB PSNR on normals, so 4 is the lever's ceiling: a map may stay over
 * target only when its recipe already sets rdo ≥ RDO_LEVER_CEILING, and never beyond MAP_HARD_CAP × target
 * (IMPLEMENTATION-NOTES D24).
 */
export const RDO_LEVER_CEILING = 4;
export const MAP_HARD_CAP = 3;

export interface BakeOptions {
  readonly zones?: readonly string[];
  readonly ids?: readonly string[];
  readonly tier?: Tier;
  readonly force?: boolean;
  readonly jobs?: number;
  readonly outDir?: string;
  readonly cacheDir?: string;
  readonly qaDir?: string | null;
  readonly log?: (line: string) => void;
}

export interface SurfaceOutcome {
  readonly id: string;
  readonly hash: string;
  readonly tiers: Partial<Record<Tier, TierMeta>>;
  readonly cacheHits: number;
  readonly baked: number;
}

export interface BakeResult {
  readonly outcomes: readonly SurfaceOutcome[];
  readonly manifest: MaterialsManifest;
  readonly cacheHits: number;
  readonly baked: number;
  readonly inputs: number;
}

/** Fails (throws) on any SURFACES ↔ RECIPES mismatch, naming the ids. */
export function assertRecipeTable(): void {
  const { missing, extra } = recipeCoverage();
  if (missing.length) throw new Error(`[material-bake] SurfaceIds without a recipe: ${missing.join(', ')}`);
  if (extra.length) throw new Error(`[material-bake] recipes without a SurfaceDef: ${extra.join(', ')}`);
  for (const id of SURFACE_IDS) {
    const r = RECIPES[id]!, d = SURFACES[id];
    if (r.hero !== d.hero) throw new Error(`[material-bake] ${id}: recipe.hero (${r.hero}) !== SurfaceDef.hero (${d.hero})`);
    if (d.alphaTest !== null && r.wrap !== 'clamp') throw new Error(`[material-bake] ${id}: card surfaces must use wrap 'clamp'`);
  }
}

export function selectIds(zones: readonly string[] | undefined, ids: readonly string[] | undefined): SurfaceId[] {
  const out = new Set<SurfaceId>();
  for (const z of zones ?? []) {
    const biome = ZONE_BIOME[z] ?? ((BIOME_ROWS as Record<string, unknown>)[z] ? (z as Biome) : undefined);
    if (!biome) throw new Error(`[material-bake] unknown zone or biome '${z}'`);
    for (const id of biomeSurfaceSet(biome)) out.add(id);
  }
  for (const id of ids ?? []) {
    if (!(SURFACE_IDS as readonly string[]).includes(id)) throw new Error(`[material-bake] unknown surface '${id}'`);
    out.add(id as SurfaceId);
  }
  if (!zones?.length && !ids?.length) for (const id of SURFACE_IDS) out.add(id);
  return [...out].sort();
}

// ─── worker pool ───────────────────────────────────────────────────────────────────────────────

type Reply = { ok: true; meta: TierMeta } | { ok: false; error: string };

async function runPool(jobs: readonly JobInput[], n: number, log: (s: string) => void): Promise<Map<string, TierMeta>> {
  const results = new Map<string, TierMeta>();
  const key = (j: JobInput): string => `${j.id}:${j.tier}`;
  if (n <= 1 || jobs.length <= 1) {
    for (const j of jobs) {
      const m = await runJob(j);
      results.set(key(j), m);
      log(`  baked ${j.id} ${j.tier} ${fmtBytes(m.bytes.albedo + m.bytes.orm + m.bytes.normal)} (${((m.bakeMs + m.encodeMs) / 1000).toFixed(1)} s)`);
    }
    return results;
  }
  const queue = [...jobs];
  const workerUrl = new URL('./worker.ts', import.meta.url);
  const errors: string[] = [];
  let done = 0;
  await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, async () => {
    const w = new Worker(workerUrl, { execArgv: ['--import', 'tsx'] });
    try {
      for (let j = queue.shift(); j; j = queue.shift()) {
        const job = j;
        const reply = await new Promise<Reply>((res, rej) => {
          const onMsg = (m: Reply): void => { w.off('error', onErr); res(m); };
          const onErr = (e: Error): void => { w.off('message', onMsg); rej(e); };
          w.once('message', onMsg);
          w.once('error', onErr);
          w.postMessage(job);
        });
        done++;
        if (reply.ok) {
          results.set(key(job), reply.meta);
          const m = reply.meta;
          log(`  [${done}/${jobs.length}] ${job.id} ${job.tier} ${fmtBytes(m.bytes.albedo + m.bytes.orm + m.bytes.normal)} (${((m.bakeMs + m.encodeMs) / 1000).toFixed(1)} s)`);
        } else {
          errors.push(reply.error);
          log(`  [${done}/${jobs.length}] FAILED ${reply.error}`);
        }
      }
    } finally {
      await w.terminate();
    }
  }));
  if (errors.length) throw new Error(errors.join('\n'));
  return results;
}

// ─── placeholder (4×4 neutral set, §10.2.3) ─────────────────────────────────────────────────────

function solidChain(r: number, g: number, b: number): Level[] {
  const out: Level[] = [];
  for (let s = 4; s >= 1; s >>= 1) {
    const d = new Uint8Array(s * s * 4);
    for (let i = 0; i < s * s; i++) { d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
    out.push({ width: s, height: s, data: d });
  }
  return out;
}

async function writePlaceholder(outDir: string, cacheDir: string): Promise<number> {
  const dir = join(cacheDir, 'placeholder-v1');
  mkdirSync(dir, { recursive: true });
  const sets = { albedo: solidChain(128, 128, 128), orm: solidChain(255, 128, 0), normal: solidChain(128, 128, 255) } as const;
  let bytes = 0;
  for (const kind of MAPS) {
    const cached = join(dir, `${kind}.ktx2`);
    if (!existsSync(cached)) writeFileSync(cached, await encodeKtx2(sets[kind], kind, DEFAULT_RDO));
    const dst = join(outDir, PLACEHOLDER_FILES[kind]);
    copyIfChanged(cached, dst);
    bytes += statSync(dst).size;
  }
  return bytes;
}

function copyIfChanged(src: string, dst: string): void {
  if (existsSync(dst)) {
    const a = readFileSync(src), b = readFileSync(dst);
    if (a.equals(b)) return;
  }
  copyFileSync(src, dst);
}

export const fmtBytes = (n: number): string => (n >= 1048576 ? `${(n / 1048576).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`);

// ─── the bake ──────────────────────────────────────────────────────────────────────────────────

export async function runBake(opts: BakeOptions = {}): Promise<BakeResult> {
  const log = opts.log ?? ((s: string) => console.log(s));
  const outDir = resolve(opts.outDir ?? DEFAULT_OUT_DIR);
  const cacheDir = resolve(opts.cacheDir ?? DEFAULT_CACHE_DIR);
  assertRecipeTable();
  const ids = selectIds(opts.zones, opts.ids);
  const full = !opts.zones?.length && !opts.ids?.length && !opts.tier;
  await probeEncoder();
  mkdirSync(outDir, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });

  const hashes = new Map<string, string>();
  const jobs: JobInput[] = [];
  let inputs = 0;
  for (const id of ids) {
    const r = RECIPES[id]!, def = SURFACES[id];
    const hash = surfaceHash(r, def);
    hashes.set(id, hash);
    for (const tier of tiersFor(def)) {
      if (opts.tier && opts.tier !== tier) continue;
      inputs++;
      if (opts.force || !readTierMeta(cacheDir, hash, tier)) jobs.push({ id, tier, hash, cacheDir });
    }
  }
  // heaviest first: hero tiers, then field
  jobs.sort((a, b) => TIER_SIZE[b.tier] - TIER_SIZE[a.tier] || a.id.localeCompare(b.id));
  const jobsN = opts.jobs ?? Math.max(1, Math.min(8, availableParallelism() - 4));
  log(`material-bake: ${ids.length} surfaces, ${inputs} tier sets, ${inputs - jobs.length} cached, ${jobs.length} to bake (${jobsN} workers)`);
  await runPool(jobs, jobsN, log);

  // copy cache → public
  const outcomes: SurfaceOutcome[] = [];
  for (const id of ids) {
    const hash = hashes.get(id)!;
    const tiers: Partial<Record<Tier, TierMeta>> = {};
    for (const tier of tiersFor(SURFACES[id])) {
      const meta = readTierMeta(cacheDir, hash, tier);
      if (!meta) continue;
      tiers[tier] = meta;
      const names = tierFiles(id, tier);
      for (const m of MAPS) copyIfChanged(tierFile(cacheDir, hash, tier, m), join(outDir, names[m]));
    }
    const baked = jobs.filter((j) => j.id === id).length;
    outcomes.push({ id, hash, tiers, baked, cacheHits: Object.keys(tiers).length - baked });
  }

  const placeholderBytes = await writePlaceholder(outDir, cacheDir);
  const manifest = buildManifest(outDir, cacheDir, placeholderBytes, full);
  writeFileSync(join(outDir, MANIFEST_FILE), stableJson(manifest));
  if (full) removeOrphans(outDir, manifest);
  if (opts.qaDir !== null) writeQaReport(resolve(opts.qaDir ?? QA_DIR), cacheDir, manifest);

  const baked = jobs.length;
  return { outcomes, manifest, baked, cacheHits: inputs - baked, inputs };
}

/**
 * Manifest over every SurfaceId whose tier files are present in `outDir` and whose cache entry matches the
 * current hash (a partial bake keeps the other surfaces' entries as long as they are still current).
 */
function buildManifest(outDir: string, cacheDir: string, placeholderBytes: number, full: boolean): MaterialsManifest {
  const surfaces: Record<string, MaterialSetEntry> = {};
  let fieldBytes = 0, heroBytes = 0;
  const missing: string[] = [];
  for (const id of SURFACE_IDS) {
    const r = RECIPES[id]!, def = SURFACES[id];
    const hash = surfaceHash(r, def);
    const tierEntry = (tier: Tier): { t: MaterialTier; meta: TierMeta } | null => {
      const meta = readTierMeta(cacheDir, hash, tier);
      const names = tierFiles(id, tier);
      if (!meta) return null;
      let bytes = 0;
      for (const m of MAPS) {
        const f = join(outDir, names[m]);
        if (!existsSync(f)) return null;
        bytes += statSync(f).size;
      }
      return { t: { ...names, size: TIER_SIZE[tier], bytes }, meta };
    };
    const field = tierEntry('field');
    const hero = def.hero ? tierEntry('hero') : null;
    if (!field || (def.hero && !hero)) { missing.push(id); continue; }
    fieldBytes += field.t.bytes;
    if (hero) heroBytes += hero.t.bytes;
    surfaces[id] = {
      field: field.t,
      hero: hero ? hero.t : null,
      metres: r.metres,
      wrap: r.wrap,
      hash,
      albedoClampedPct: (hero ?? field).meta.clampedPct,
    };
  }
  if (full && missing.length) throw new Error(`[material-bake] full bake left surfaces without outputs: ${missing.join(', ')}`);
  const byBiome: Record<string, string[]> = {};
  for (const b of Object.keys(BIOME_ROWS).sort()) byBiome[b] = [...biomeSurfaceSet(b as Biome)];
  const m: MaterialsManifest = {
    version: 2,
    surfaces,
    byBiome,
    placeholder: { ...PLACEHOLDER_FILES },
    fieldBytes,
    heroBytes,
    totalBytes: fieldBytes + heroBytes + placeholderBytes,
  };
  const errs = validateManifest(m);
  if (errs.length) throw new Error(`[material-bake] manifest invalid: ${errs.join('; ')}`);
  return m;
}

function removeOrphans(outDir: string, m: MaterialsManifest): void {
  const keep = new Set<string>([MANIFEST_FILE, ...Object.values(m.placeholder)]);
  for (const e of Object.values(m.surfaces)) {
    for (const t of [e.field, e.hero]) if (t) { keep.add(t.albedo); keep.add(t.orm); keep.add(t.normal); }
  }
  for (const f of readdirSync(outDir)) if (f.endsWith('.ktx2') && !keep.has(f)) rmSync(join(outDir, f));
}

/** qa/qa-report.json: per-surface flags (deterministic: no timings). */
function writeQaReport(qaDir: string, cacheDir: string, m: MaterialsManifest): void {
  const surfaces: Record<string, unknown> = {};
  for (const [id, e] of Object.entries(m.surfaces)) {
    const row: Record<string, unknown> = {};
    for (const tier of ['field', 'hero'] as const) {
      const meta = readTierMeta(cacheDir, e.hash, tier);
      if (!meta) continue;
      const target = tier === 'hero' ? HERO_MAP_TARGET : FIELD_MAP_TARGET;
      row[tier] = {
        bytes: meta.bytes,
        overTarget: MAPS.filter((k) => meta.bytes[k] > target),
        clampedPct: meta.clampedPct,
        seam: meta.seam,
        roughClippedPct: meta.roughClippedPct,
        maxLuminance: meta.maxLuminance,
        aoDefault: meta.aoDefault,
      };
    }
    surfaces[id] = row;
  }
  mkdirSync(qaDir, { recursive: true });
  writeFileSync(join(qaDir, 'qa-report.json'), stableJson({ surfaces, totals: { fieldBytes: m.fieldBytes, heroBytes: m.heroBytes, totalBytes: m.totalBytes } }));
}
