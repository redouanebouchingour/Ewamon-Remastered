/**
 * SPEC §40.4.2 `generate` — runs the uncached jobs through the provider. Without `EWA_AUDIO_API_KEY` it prints
 * the exact §40.4.2 line and exits 0; it never invents or defaults a key. Raw WAVs land in
 * `.cache/audio/raw/<requestHash>.wav` (git-ignored, never committed); `.cache/audio/jobs.json` records each.
 */
import { statSync } from 'node:fs';
import type { AudioProvider } from './provider.js';
import { API_KEY_ENV } from './provider.js';
import { isCached, readCacheIndex, writeCacheIndex } from './jobs.js';
import type { CacheRecord } from './jobs.js';
import type { PipelinePaths } from './paths.js';
import { buildPlan, loadSourceManifest } from './plan.js';
import type { ValidateOptions } from './schema.js';

/** The exact line §40.4.2 specifies (and `plan.test.ts` asserts). */
export function skipMessage(pending: number): string {
  return `audio-pipeline: ${API_KEY_ENV} not set — skipping generation (${pending} jobs pending); run plan to see them`;
}

export interface GenerateOptions {
  readonly paths: PipelinePaths;
  readonly provider: AudioProvider;
  readonly validate?: ValidateOptions;
  readonly log?: (line: string) => void;
  /** only jobs whose id starts with one of these */
  readonly only?: readonly string[];
  readonly limit?: number;
  readonly concurrency?: number;
  readonly signal?: AbortSignal;
}

export interface GenerateResult {
  readonly exitCode: 0 | 1;
  readonly skipped: boolean;
  readonly generated: number;
  readonly failed: readonly { readonly id: string; readonly error: string }[];
  readonly pending: number;
}

export async function runGenerate(opts: GenerateOptions): Promise<GenerateResult> {
  const log = opts.log ?? ((l: string) => console.log(l));
  const m = loadSourceManifest(opts.paths.manifest, opts.validate);
  const { jobs } = buildPlan(m, opts.provider.name, opts.paths);
  const index = readCacheIndex(opts.paths.cache);
  let pending = jobs.filter((j) => !isCached(j, index));
  if (opts.only !== undefined && opts.only.length > 0) pending = pending.filter((j) => opts.only!.some((p) => j.id.startsWith(p)));
  if (opts.limit !== undefined) pending = pending.slice(0, opts.limit);

  if (!opts.provider.configured()) {
    log(skipMessage(pending.length));
    return { exitCode: 0, skipped: true, generated: 0, failed: [], pending: pending.length };
  }
  const tooLong = pending.filter((j) => j.prompt.durationSec > opts.provider.supports.maxDurationSec);
  if (tooLong.length > 0) {
    log(`audio-pipeline: ${tooLong.length} job(s) exceed ${opts.provider.name}'s ${opts.provider.supports.maxDurationSec} s limit: ${tooLong.map((j) => j.id).join(', ')}`);
    return { exitCode: 1, skipped: false, generated: 0, failed: tooLong.map((j) => ({ id: j.id, error: 'duration over provider maximum' })), pending: pending.length };
  }

  const records: Record<string, CacheRecord> = { ...index.jobs };
  const failed: { id: string; error: string }[] = [];
  let generated = 0;
  let next = 0;
  const signal = opts.signal ?? new AbortController().signal;
  const worker = async (): Promise<void> => {
    while (next < pending.length) {
      const job = pending[next++]!;
      try {
        await opts.provider.generate(job, signal);
        records[job.requestHash] = { id: job.id, kind: job.kind, provider: opts.provider.name, bytes: statSync(job.outWav).size };
        generated++;
        log(`  generated ${job.id} (${job.prompt.durationSec} s)`);
        // save incrementally so an interrupted run keeps what it paid for
        writeCacheIndex(opts.paths.cache, { version: 1, jobs: sortRecords(records) });
      } catch (err) {
        failed.push({ id: job.id, error: (err as Error).message });
        log(`  FAILED ${job.id}: ${(err as Error).message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency ?? 2, pending.length)) }, worker));
  writeCacheIndex(opts.paths.cache, { version: 1, jobs: sortRecords(records) });
  log(`audio-pipeline: generated ${generated}/${pending.length} with ${opts.provider.name}; ${failed.length} failed`);
  return { exitCode: failed.length > 0 ? 1 : 0, skipped: false, generated, failed, pending: pending.length - generated };
}

function sortRecords(r: Record<string, CacheRecord>): Record<string, CacheRecord> {
  const out: Record<string, CacheRecord> = {};
  for (const k of Object.keys(r).sort()) out[k] = r[k]!;
  return out;
}
