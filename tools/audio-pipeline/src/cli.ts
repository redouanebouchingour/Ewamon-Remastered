/**
 * `tsx src/cli.ts <plan|generate|process|all|ingest|credits> [flags]` (SPEC §40.4.2; ingest/credits: Phase E4)
 *
 *   plan       validate .design/audio/manifest.json, write qa/plan.json (jobs, cost, size) — no key needed
 *   generate   run uncached jobs through the provider; without EWA_AUDIO_API_KEY prints the skip line, exits 0
 *   process    loop-detect, normalise, encode every cached WAV into public/audio/ + manifest.json (needs ffmpeg)
 *   all        plan → generate → process, re-running generate/process while clips await a re-roll (≤ 3 rounds)
 *              (with --provider cc0: plan → ingest → process)
 *   ingest     CC0 sources (.design/audio/sources.json → assets-src/audio/cc0/) → raw cache WAVs with 'cc0' records,
 *              derived theme layers and sfx variants; writes qa/ingest-report.json and the credits (needs ffmpeg)
 *   credits    assets-src/audio/CREDITS.md + public/audio/CREDITS.txt from sources.json (no ffmpeg)
 *
 * --provider cc0 makes plan/process use the ingested CC0 cache (source salts + the tempo overrides sources.json
 * declares); EWA_AUDIO_PROVIDER=cc0 does the same.
 *
 * Flags: --manifest FILE  --cache DIR  --qa DIR  --out DIR  --provider NAME  --placeholders (process: synthesize
 *        stand-ins for jobs with no WAV)  --only prefix,prefix  --limit N  --concurrency N  --jobs N  --verbose
 *        --url-base PREFIX (process: clip url prefix, default /audio/)
 *        --sources FILE  --cc0-dir DIR  --licences DIR  --credits FILE (ingest/credits locations)
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { FFMPEG_MISSING_MESSAGE } from './ffmpeg.js';
import { writeCredits } from './credits.js';
import { runGenerate } from './generate.js';
import { prepareCc0, runIngest } from './ingest.js';
import type { IngestPaths, PipelinePaths } from './paths.js';
import { DEFAULT_INGEST_PATHS, DEFAULT_PATHS } from './paths.js';
import { loadSourceManifest, runPlan } from './plan.js';
import { FfmpegMissingError, runProcess } from './process.js';
import { DEFAULT_PROVIDER, createProvider } from './providers/index.js';
import type { AudioSourceManifest } from './schema.js';
import { ManifestError } from './schema.js';
import { CC0_PROVIDER } from './sources.js';

export interface Args {
  readonly command: string;
  readonly flags: Readonly<Record<string, string | true>>;
}

export function parseArgs(argv: readonly string[]): Args {
  const [command = 'plan', ...rest] = argv;
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (!a.startsWith('--')) continue;
    const next = rest[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[a.slice(2)] = next;
      i++;
    } else flags[a.slice(2)] = true;
  }
  return { command, flags };
}

function str(flags: Args['flags'], k: string): string | undefined {
  const v = flags[k];
  return typeof v === 'string' ? v : undefined;
}

function pathsFrom(flags: Args['flags']): PipelinePaths {
  const p = (k: string, d: string): string => {
    const v = str(flags, k);
    return v !== undefined ? path.resolve(v) : d;
  };
  return { manifest: p('manifest', DEFAULT_PATHS.manifest), cache: p('cache', DEFAULT_PATHS.cache), qa: p('qa', DEFAULT_PATHS.qa), out: p('out', DEFAULT_PATHS.out) };
}

function ingestPathsFrom(flags: Args['flags']): IngestPaths {
  const p = (k: string, d: string): string => {
    const v = str(flags, k);
    return v !== undefined ? path.resolve(v) : d;
  };
  return { sources: p('sources', DEFAULT_INGEST_PATHS.sources), cc0Dir: p('cc0-dir', DEFAULT_INGEST_PATHS.cc0Dir), licences: p('licences', DEFAULT_INGEST_PATHS.licences), credits: p('credits', DEFAULT_INGEST_PATHS.credits) };
}

export async function main(argv: readonly string[]): Promise<number> {
  const { command, flags } = parseArgs(argv);
  const paths = pathsFrom(flags);
  const ingestPaths = ingestPathsFrom(flags);
  const providerName = str(flags, 'provider') ?? process.env.EWA_AUDIO_PROVIDER ?? DEFAULT_PROVIDER;
  const int = (k: string): number | undefined => {
    const v = str(flags, k);
    return v !== undefined ? Number.parseInt(v, 10) : undefined;
  };
  const only = str(flags, 'only')?.split(',').filter((s) => s.length > 0);
  const cc0 = providerName === CC0_PROVIDER;
  // provider cc0: the manifest re-timed by sources.json and the per-job source salts
  const prepare = (m: AudioSourceManifest): { manifest: AudioSourceManifest; salts: Readonly<Record<string, string>> } => {
    if (!cc0) return { manifest: m, salts: {} };
    const r = prepareCc0(m, ingestPaths);
    return { manifest: r.manifest, salts: r.salts };
  };
  const processCmd = async (): Promise<Awaited<ReturnType<typeof runProcess>>> => {
    const p = prepare(loadSourceManifest(paths.manifest));
    return runProcess({ manifest: p.manifest, salts: p.salts, providerName, paths, placeholders: flags.placeholders === true, jobs: int('jobs'), urlBase: str(flags, 'url-base') });
  };
  try {
    if (command === 'plan') {
      runPlan({ paths, providerName, verbose: flags.verbose === true, prepare, planFile: cc0 ? 'plan-cc0.json' : undefined });
      return 0;
    }
    if (command === 'ingest') {
      const r = await runIngest({ manifest: loadSourceManifest(paths.manifest), paths, ingest: ingestPaths, only });
      return r.report.ok ? 0 : 1;
    }
    if (command === 'credits') {
      const r = prepareCc0(loadSourceManifest(paths.manifest), ingestPaths);
      for (const p of r.sources.problems) console.log(`  sources.json problem: ${p}`);
      const out = writeCredits(r.sources.entries, r.classified, ingestPaths, paths.out);
      console.log(`audio-pipeline credits: ${out.rows} source file(s) → ${out.markdown}, ${out.text}`);
      return 0;
    }
    if (cc0 && command === 'generate') {
      console.log(`audio-pipeline: provider '${CC0_PROVIDER}' has no generator — run ingest (CC0 sources from ${ingestPaths.sources})`);
      return 0;
    }
    if (cc0 && command === 'all') {
      runPlan({ paths, providerName, prepare, planFile: 'plan-cc0.json' });
      const ing = await runIngest({ manifest: loadSourceManifest(paths.manifest), paths, ingest: ingestPaths });
      const r = await processCmd();
      return r.report.ok && ing.report.failed.length === 0 ? 0 : 1;
    }
    if (command === 'generate') {
      const r = await runGenerate({ paths, provider: createProvider(providerName), only, limit: int('limit'), concurrency: int('concurrency') });
      return r.exitCode;
    }
    if (command === 'process') {
      const r = await processCmd();
      return r.report.ok ? 0 : 1;
    }
    if (command === 'all') {
      runPlan({ paths, providerName });
      const provider = createProvider(providerName);
      for (let round = 0; round < 3; round++) {
        const g = await runGenerate({ paths, provider, concurrency: int('concurrency') });
        if (g.skipped && flags.placeholders !== true) return 0;
        const r = await runProcess({ manifest: loadSourceManifest(paths.manifest), providerName, paths, placeholders: flags.placeholders === true, jobs: int('jobs'), urlBase: str(flags, 'url-base') });
        if (r.report.rejected.length === 0) return r.report.ok ? 0 : 1;
      }
      return 1;
    }
    console.error(`audio-pipeline: unknown command '${command}' (plan | generate | process | all | ingest | credits)`);
    return 2;
  } catch (err) {
    if (err instanceof FfmpegMissingError) {
      console.error(err.message);
      return 1;
    }
    if (err instanceof ManifestError) {
      console.error(err.message);
      return 1;
    }
    console.error((err as Error).message);
    return 1;
  }
}

export { FFMPEG_MISSING_MESSAGE };

const invokedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  void main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
