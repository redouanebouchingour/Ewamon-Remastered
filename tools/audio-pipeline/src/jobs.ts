/**
 * SPEC §40.4.2 — expand the source manifest into generation jobs. One job per stem × theme, one per ambience bed,
 * one per sfx variant (variant i re-rolls the seed: seed + i). `requestHash = sha256(provider.name, kind,
 * JSON(prompt))` over the canonical (sorted-key) prompt, so a changed word, seed or duration is a new job and an
 * unchanged one is a cache hit.
 *
 * Phase E4: a job may carry a `salt` (the CC0 ingest folds the source file's content hash, its trim/gain/tempo
 * settings and the derivation recipe into it, see `sources.ts`). The salt is appended to the hash input only when
 * present, so every unsalted (provider-generated) hash is byte-for-byte what it was before.
 *
 * Job ids double as output paths (§40.4.6 layout): `themes/<theme>/<layer>`, `ambience/<biome>`, `sfx/<id>_<n>`.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { canonicalJson, sha256Hex, writeJson } from './json.js';
import type { GenerationJob } from './provider.js';
import type { AudioKind, AudioPrompt, AudioSourceManifest, StemLayer } from './schema.js';
import { STEM_LAYERS } from './schema.js';

/** Re-roll step for a rejected clip (§40.4.3 true peak, §40.4.4 loop): seed + 1000 × attempt. */
export const REROLL_SEED_STEP = 1000;
/** §40.4.4: "regenerate with seed + 1000, at most twice". */
export const MAX_REROLLS = 2;

export interface JobMeta {
  /** for themes: theme id + layer; ambience: biome; sfx: sfx id + 1-based variant */
  readonly group: string;
  readonly layer: StemLayer | null;
  readonly variant: number | null;
  readonly attempt: number;
  /** stems: the theme's loop length in bars (placeholders and the loop finder need it) */
  readonly bars: number | null;
}

export interface PlannedJob extends GenerationJob {
  readonly meta: JobMeta;
}

export type Rerolls = Readonly<Record<string, number>>;

export function requestHash(providerName: string, kind: AudioKind, prompt: AudioPrompt, salt?: string): string {
  return salt === undefined ? sha256Hex(providerName, kind, canonicalJson(prompt)) : sha256Hex(providerName, kind, canonicalJson(prompt), salt);
}

/** jobId → salt (Phase E4 CC0 sources). Salted jobs ignore `rerolls`: a fixed source cannot be re-rolled. */
export type JobSalts = Readonly<Record<string, string>>;

function reseed(prompt: AudioPrompt, delta: number): AudioPrompt {
  if (delta === 0) return prompt;
  return { ...prompt, seed: (prompt.seed + delta) >>> 0 };
}

export function rawWavPath(cacheDir: string, hash: string): string {
  return path.join(cacheDir, 'raw', `${hash}.wav`);
}

/** Every job the manifest implies, sorted by id. `rerolls[jobId] = attempt` bumps that job's seed. */
export function expandJobs(m: AudioSourceManifest, providerName: string, cacheDir: string, rerolls: Rerolls = {}, salts: JobSalts = {}): PlannedJob[] {
  const jobs: PlannedJob[] = [];
  const push = (id: string, kind: AudioKind, base: AudioPrompt, meta: Omit<JobMeta, 'attempt'>, variantDelta: number): void => {
    const salt = salts[id];
    const attempt = salt !== undefined ? 0 : Math.min(MAX_REROLLS, rerolls[id] ?? 0);
    const prompt = reseed(base, variantDelta + attempt * REROLL_SEED_STEP);
    const hash = requestHash(providerName, kind, prompt, salt);
    jobs.push({ id, kind, prompt, outWav: rawWavPath(cacheDir, hash), requestHash: hash, meta: { ...meta, attempt } });
  };
  for (const t of m.themes) {
    for (const layer of STEM_LAYERS) push(`themes/${t.id}/${layer}`, 'stem', t.stems[layer], { group: t.id, layer, variant: null, bars: t.bars }, 0);
  }
  for (const a of m.ambience) push(`ambience/${a.biome}`, 'ambience', a.prompt, { group: a.biome, layer: null, variant: null, bars: null }, 0);
  for (const s of m.sfx) {
    const kind: AudioKind = s.bus === 'ui' ? 'ui' : 'sfx';
    for (let i = 0; i < s.variants; i++) push(`sfx/${s.id}_${i + 1}`, kind, s.prompt, { group: s.id, layer: null, variant: i + 1, bars: null }, i);
  }
  return jobs.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Expected job count straight from the manifest: themes × 4 + ambience + Σ variants. */
export function expectedJobCount(m: AudioSourceManifest): number {
  return m.themes.length * STEM_LAYERS.length + m.ambience.length + m.sfx.reduce((n, s) => n + s.variants, 0);
}

// ─── cache index: .cache/audio/jobs.json and rerolls.json ───────────────────

export interface CacheRecord {
  readonly id: string;
  readonly kind: AudioKind;
  readonly provider: string;
  readonly bytes: number;
  /** Phase E4 (provider 'cc0'): where the WAV came from. Absent for provider-generated clips. */
  readonly source?: CacheSource;
}
export interface CacheSource {
  /** path under the cc0 directory, forward slashes */
  readonly file: string;
  /** sha256 of the source file's bytes */
  readonly sha256: string;
  /** 'direct' = this job's own source; 'layer' = derived from the theme's base track; 'variant' = pitch-shifted sibling */
  readonly role: 'direct' | 'layer' | 'variant';
  /** the job id a derived clip was made from */
  readonly from?: string;
}
export interface CacheIndex {
  readonly version: 1;
  readonly jobs: Readonly<Record<string, CacheRecord>>; // requestHash → record
}

export function readCacheIndex(cacheDir: string): CacheIndex {
  const f = path.join(cacheDir, 'jobs.json');
  if (!existsSync(f)) return { version: 1, jobs: {} };
  return JSON.parse(readFileSync(f, 'utf8')) as CacheIndex;
}

export function writeCacheIndex(cacheDir: string, index: CacheIndex): void {
  writeJson(path.join(cacheDir, 'jobs.json'), index);
}

/** A job is cached when the index knows its hash and the WAV is on disk. */
export function isCached(job: GenerationJob, index: CacheIndex): boolean {
  return index.jobs[job.requestHash] !== undefined && existsSync(job.outWav);
}

export function readRerolls(cacheDir: string): Record<string, number> {
  const f = path.join(cacheDir, 'rerolls.json');
  if (!existsSync(f)) return {};
  return JSON.parse(readFileSync(f, 'utf8')) as Record<string, number>;
}

export function writeRerolls(cacheDir: string, rerolls: Rerolls): void {
  writeJson(path.join(cacheDir, 'rerolls.json'), rerolls);
}
