/**
 * SPEC §40.4.2 `plan` — needs no key and no network. Validates the source manifest (zod + zone coverage against
 * `@ewa/content` ZONE_ORDER), expands it into the job list, diffs against `.cache/audio/jobs.json`, prices the
 * uncached jobs with the provider's published rate card, estimates the encoded bytes against the 80 MB budget, and
 * writes `qa/plan.json`. This is the command CI runs.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ByteEstimate } from './budget.js';
import { estimateBytes } from './budget.js';
import type { PlannedJob } from './jobs.js';
import { expandJobs, isCached, readCacheIndex, readRerolls } from './jobs.js';
import { writeJson } from './json.js';
import type { PipelinePaths } from './paths.js';
import { PRICING } from './pricing.js';
import type { AudioKind, AudioSourceManifest, ValidateOptions } from './schema.js';
import { validateSourceManifest } from './schema.js';

export interface PlanJobRow {
  readonly id: string;
  readonly kind: AudioKind;
  readonly durationSec: number;
  readonly seed: number;
  readonly attempt: number;
  readonly requestHash: string;
  readonly cached: boolean;
}

export interface KindSummary {
  readonly jobs: number;
  readonly seconds: number;
  readonly cost: number;
}

export interface PlanReport {
  // §40.4.2's five fields
  readonly total: number;
  readonly cached: number;
  readonly toGenerate: number;
  readonly estimatedSeconds: number;
  /** USD at the provider's list price for the uncached jobs (§40.4.2 wrote null before a provider was chosen) */
  readonly estimatedCost: number | null;
  // additions
  readonly provider: string;
  readonly costBasis: string | null;
  /** the whole manifest at list price, ignoring the cache */
  readonly fullCost: number | null;
  readonly byKind: Readonly<Record<AudioKind, KindSummary>>;
  readonly counts: { readonly themes: number; readonly stems: number; readonly ambience: number; readonly sfxIds: number; readonly sfxVariants: number; readonly uiIds: number; readonly zones: number };
  readonly bytes: ByteEstimate;
  readonly jobs: readonly PlanJobRow[];
}

export function loadSourceManifest(file: string, opts?: ValidateOptions): AudioSourceManifest {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`audio-pipeline: cannot read ${file}: ${(err as Error).message}`);
  }
  return validateSourceManifest(json, opts);
}

const r3 = (x: number): number => Math.round(x * 1000) / 1000;
const r2 = (x: number): number => Math.round(x * 100) / 100;

export function buildPlan(m: AudioSourceManifest, providerName: string, paths: Pick<PipelinePaths, 'cache'>): { report: PlanReport; jobs: PlannedJob[] } {
  const jobs = expandJobs(m, providerName, paths.cache, readRerolls(paths.cache));
  const index = readCacheIndex(paths.cache);
  const pricing = PRICING[providerName] ?? null;
  const rows: PlanJobRow[] = jobs.map((j) => ({ id: j.id, kind: j.kind, durationSec: j.prompt.durationSec, seed: j.prompt.seed, attempt: j.meta.attempt, requestHash: j.requestHash, cached: isCached(j, index) }));
  const byKind: Record<AudioKind, { jobs: number; seconds: number; cost: number }> = {
    stem: { jobs: 0, seconds: 0, cost: 0 },
    ambience: { jobs: 0, seconds: 0, cost: 0 },
    sfx: { jobs: 0, seconds: 0, cost: 0 },
    ui: { jobs: 0, seconds: 0, cost: 0 },
  };
  let cached = 0;
  let seconds = 0;
  let cost = 0;
  let fullCost = 0;
  for (const row of rows) {
    const c = pricing ? pricing.costOf(row.kind, row.durationSec) : 0;
    const k = byKind[row.kind];
    k.jobs++;
    k.seconds += row.durationSec;
    k.cost += c;
    fullCost += c;
    if (row.cached) cached++;
    else {
      seconds += row.durationSec;
      cost += c;
    }
  }
  for (const k of Object.values(byKind)) {
    k.seconds = r3(k.seconds);
    k.cost = r2(k.cost);
  }
  const report: PlanReport = {
    total: rows.length,
    cached,
    toGenerate: rows.length - cached,
    estimatedSeconds: r3(seconds),
    estimatedCost: pricing ? r2(cost) : null,
    provider: providerName,
    costBasis: pricing?.basis ?? null,
    fullCost: pricing ? r2(fullCost) : null,
    byKind,
    counts: {
      themes: m.themes.length,
      stems: m.themes.length * 4,
      ambience: m.ambience.length,
      sfxIds: m.sfx.filter((s) => s.bus === 'sfx').length,
      sfxVariants: m.sfx.reduce((n, s) => n + s.variants, 0),
      uiIds: m.sfx.filter((s) => s.bus === 'ui').length,
      zones: Object.keys(m.zoneThemes).length,
    },
    bytes: estimateBytes(m),
    jobs: rows,
  };
  return { report, jobs };
}

export interface RunPlanOptions {
  readonly paths: PipelinePaths;
  readonly providerName: string;
  readonly validate?: ValidateOptions;
  readonly log?: (line: string) => void;
  /** also print every job row */
  readonly verbose?: boolean;
}

export function runPlan(opts: RunPlanOptions): PlanReport {
  const log = opts.log ?? ((l: string) => console.log(l));
  const m = loadSourceManifest(opts.paths.manifest, opts.validate);
  const { report } = buildPlan(m, opts.providerName, opts.paths);
  writeJson(path.join(opts.paths.qa, 'plan.json'), report);
  const mib = (b: number): string => (b / 1048576).toFixed(2);
  const c = report.counts;
  log(`audio-pipeline plan: ${report.total} jobs = ${c.themes} themes × 4 stems (${c.stems}) + ${c.ambience} ambience + ${c.sfxVariants} sfx variants over ${c.sfxIds + c.uiIds} ids (${c.uiIds} on the ui bus); ${c.zones} zones mapped`);
  for (const kind of ['stem', 'ambience', 'sfx', 'ui'] as const) {
    const k = report.byKind[kind];
    log(`  ${kind.padEnd(8)} ${String(k.jobs).padStart(4)} jobs  ${k.seconds.toFixed(1).padStart(8)} s  $${k.cost.toFixed(2)}`);
  }
  log(`  cached ${report.cached}, to generate ${report.toGenerate} (${report.estimatedSeconds.toFixed(1)} s of audio)`);
  if (report.estimatedCost !== null) log(`  estimated cost with ${report.provider}: $${report.estimatedCost.toFixed(2)} now, $${(report.fullCost ?? 0).toFixed(2)} for the whole manifest — ${report.costBasis ?? ''}`);
  log(`  encoded size estimate ${mib(report.bytes.total)} MiB of ${mib(report.bytes.budget)} MiB (stems ${mib(report.bytes.stems)}, ambience ${mib(report.bytes.ambience)}, sfx ${mib(report.bytes.sfx)})`);
  if (opts.verbose === true) for (const j of report.jobs) log(`  ${j.cached ? '✓' : '·'} ${j.id.padEnd(34)} ${j.kind.padEnd(8)} ${j.durationSec.toFixed(3).padStart(7)} s  seed ${j.seed}  ${j.requestHash.slice(0, 12)}`);
  log(`  wrote ${path.join(opts.paths.qa, 'plan.json')}`);
  return report;
}
