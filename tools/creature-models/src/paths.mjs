import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ROOT = resolve(PKG, '../..');
export const SCAD_DIR = join(PKG, 'scad');
export const REF_DIR = join(PKG, '.cache/ref');
export const WORK_DIR = join(PKG, '.cache/work');
export const PREVIEW_DIR = join(ROOT, 'previews');
/** Where the client serves the creature GLBs from (`/creature-models/<id>.glb`). */
export const OUT_DIR = join(ROOT, 'packages/client/public/creature-models');

export function readManifest() {
  return JSON.parse(readFileSync(join(ROOT, 'packages/client/public/creatures/creatures.manifest.json'), 'utf8'));
}
