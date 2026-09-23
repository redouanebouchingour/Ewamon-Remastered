/** Directory layout of the tool (all absolute, resolved from this file). */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const TOOL_ROOT = resolve(here, '..');
export const REPO_ROOT = resolve(TOOL_ROOT, '..', '..');
/** packages/render/src/surfaces — recipe sources (their text is part of every cache hash). */
export const SURFACES_SRC = resolve(REPO_ROOT, 'packages', 'render', 'src', 'surfaces');
export const DEFAULT_OUT_DIR = resolve(REPO_ROOT, 'packages', 'client', 'public', 'materials');
export const DEFAULT_CACHE_DIR = resolve(TOOL_ROOT, '.cache');
export const QA_DIR = resolve(TOOL_ROOT, 'qa');
/** Tool sources whose text changes the bytes (hashed with every surface). */
export const PIPELINE_FILES = ['bake.ts', 'encode.ts', 'ktx2.ts'].map((f) => resolve(here, f));
