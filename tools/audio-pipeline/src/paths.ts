/** Default locations (SPEC §40.0.1, §40.4.2, §40.6). Every command takes flags to override them. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = path.resolve(PKG_DIR, '..', '..');

export interface PipelinePaths {
  /** `.design/audio/manifest.json` */
  readonly manifest: string;
  /** `tools/audio-pipeline/.cache/audio` — jobs.json, rerolls.json, raw/<requestHash>.wav, placeholder/, work/ */
  readonly cache: string;
  /** `tools/audio-pipeline/qa` — plan.json, process-report.json */
  readonly qa: string;
  /** `packages/client/public/audio` */
  readonly out: string;
}

export const DEFAULT_PATHS: PipelinePaths = {
  manifest: path.join(REPO_ROOT, '.design', 'audio', 'manifest.json'),
  cache: path.join(PKG_DIR, '.cache', 'audio'),
  qa: path.join(PKG_DIR, 'qa'),
  out: path.join(REPO_ROOT, 'packages', 'client', 'public', 'audio'),
};

/** Forward-slash relative path, stable across platforms (written into plan.json and job records). */
export function rel(from: string, to: string): string {
  return path.relative(from, to).split(path.sep).join('/');
}

/** Phase E4 CC0 ingest locations (`tsx src/cli.ts ingest|credits`). Each takes a flag to override it. */
export interface IngestPaths {
  /** `.design/audio/sources.json` — jobId → CC0 source file + attribution */
  readonly sources: string;
  /** `assets-src/audio/cc0` — the downloaded packs (gitignored, like the other raw art) */
  readonly cc0Dir: string;
  /** `assets-src/audio/licenses` — licence texts, listed in CREDITS */
  readonly licences: string;
  /** `assets-src/audio/CREDITS.md` — generated from sources.json */
  readonly credits: string;
}

export const DEFAULT_INGEST_PATHS: IngestPaths = {
  sources: path.join(REPO_ROOT, '.design', 'audio', 'sources.json'),
  cc0Dir: path.join(REPO_ROOT, 'assets-src', 'audio', 'cc0'),
  licences: path.join(REPO_ROOT, 'assets-src', 'audio', 'licenses'),
  credits: path.join(REPO_ROOT, 'assets-src', 'audio', 'CREDITS.md'),
};
