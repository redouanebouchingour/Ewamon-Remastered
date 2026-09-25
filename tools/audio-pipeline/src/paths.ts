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
