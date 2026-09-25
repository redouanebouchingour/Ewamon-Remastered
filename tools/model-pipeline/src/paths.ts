/** Directory layout of the tool (absolute, resolved from this file). */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const TOOL_ROOT = resolve(here, '..');
export const REPO_ROOT = resolve(TOOL_ROOT, '..', '..');
/** `assets-src/models/{legendaries,quaternius}` (git-ignored raw sources, SPEC §40.2.1). */
export const SRC_DIR = resolve(REPO_ROOT, 'assets-src', 'models');
export const LICENSES_DIR = resolve(REPO_ROOT, 'assets-src', 'licenses');
export const PUBLIC_DIR = resolve(REPO_ROOT, 'packages', 'client', 'public');
export const DEFAULT_OUT_DIR = resolve(PUBLIC_DIR, 'models');
export const ICONS_DIR = resolve(PUBLIC_DIR, 'icons');
export const DEFAULT_CACHE_DIR = resolve(TOOL_ROOT, '.cache');
export const QA_DIR = resolve(TOOL_ROOT, 'qa');
/** Tool sources whose text changes output bytes (hashed into every cache key). */
export const PIPELINE_FILES = ['transform.ts', 'sets.ts', 'prepare.ts', 'textures.ts', 'ktx2.ts', 'simplify.ts', 'glb.ts', 'bounds.ts', 'budget.ts'].map((f) => resolve(here, f));
