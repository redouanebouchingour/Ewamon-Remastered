/**
 * `tsx src/cli.ts <plan|generate|process|all> [flags]` (SPEC §40.4.2)
 *
 *   plan       validate .design/audio/manifest.json, write qa/plan.json (jobs, cost, size) — no key needed
 *   generate   run uncached jobs through the provider; without EWA_AUDIO_API_KEY prints the skip line, exits 0
 *   process    loop-detect, normalise, encode every cached WAV into public/audio/ + manifest.json (needs ffmpeg)
 *   all        plan → generate → process, re-running generate/process while clips await a re-roll (≤ 3 rounds)
 *
 * Flags: --manifest FILE  --cache DIR  --qa DIR  --out DIR  --provider NAME  --placeholders (process: synthesize
 *        stand-ins for jobs with no WAV)  --only prefix,prefix  --limit N  --concurrency N  --jobs N  --verbose
 *        --url-base PREFIX (process: clip url prefix, default /audio/)
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { FFMPEG_MISSING_MESSAGE } from './ffmpeg.js';
import { runGenerate } from './generate.js';
import type { PipelinePaths } from './paths.js';
import { DEFAULT_PATHS } from './paths.js';
import { loadSourceManifest, runPlan } from './plan.js';
import { FfmpegMissingError, runProcess } from './process.js';
import { DEFAULT_PROVIDER, createProvider } from './providers/index.js';
import { ManifestError } from './schema.js';

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

export async function main(argv: readonly string[]): Promise<number> {
  const { command, flags } = parseArgs(argv);
  const paths = pathsFrom(flags);
  const providerName = str(flags, 'provider') ?? process.env.EWA_AUDIO_PROVIDER ?? DEFAULT_PROVIDER;
  const int = (k: string): number | undefined => {
    const v = str(flags, k);
    return v !== undefined ? Number.parseInt(v, 10) : undefined;
  };
  const only = str(flags, 'only')?.split(',').filter((s) => s.length > 0);
  try {
    if (command === 'plan') {
      runPlan({ paths, providerName, verbose: flags.verbose === true });
      return 0;
    }
    if (command === 'generate') {
      const r = await runGenerate({ paths, provider: createProvider(providerName), only, limit: int('limit'), concurrency: int('concurrency') });
      return r.exitCode;
    }
    if (command === 'process') {
      const r = await runProcess({ manifest: loadSourceManifest(paths.manifest), providerName, paths, placeholders: flags.placeholders === true, jobs: int('jobs'), urlBase: str(flags, 'url-base') });
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
    console.error(`audio-pipeline: unknown command '${command}' (plan | generate | process | all)`);
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
