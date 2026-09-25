/** Directory layout of the tool (absolute, resolved from this file). */
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const TOOL_ROOT = resolve(here, '..');
export const REPO_ROOT = resolve(TOOL_ROOT, '..', '..');
export const PUBLIC_DIR = resolve(REPO_ROOT, 'packages', 'client', 'public');
export const MATERIALS_MANIFEST = resolve(PUBLIC_DIR, 'materials', 'materials.manifest.json');
/** §40.5.3: the committed baseline and the (ignored) report. */
export const AUDIT_DIR = resolve(TOOL_ROOT, '.audit');
export const DEFAULT_BASELINE = resolve(AUDIT_DIR, 'baseline.json');
export const DEFAULT_REPORT = resolve(AUDIT_DIR, 'report.json');

/**
 * CLI paths are relative to where the user typed the command: `pnpm audit:assets -- --dump tools/…` runs the
 * script inside `tools/asset-audit/`, and pnpm records the invoking directory in `INIT_CWD`.
 */
export function userPath(p: string): string {
  return isAbsolute(p) ? p : resolve(process.env.INIT_CWD ?? process.cwd(), p);
}
