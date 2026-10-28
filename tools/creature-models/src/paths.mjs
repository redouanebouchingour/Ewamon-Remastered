import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ROOT = resolve(PKG, '../..');
/**
 * `--npc` switches every script to the NPC set (people and their props, e.g. the Mire Route foosball club): sources in
 * `scad/npc/` and `rigs/npc/`, GLBs in `public/npc-models/` (its own index.json). Same conventions as the creatures.
 */
export const NPC_SET = process.argv.includes('--npc');
export const SCAD_DIR = join(PKG, NPC_SET ? 'scad/npc' : 'scad');
/** Rigs: `rigs/<id>.mjs` (joints, part assignment, animation clips; rig.mjs). */
export const RIG_DIR = join(PKG, NPC_SET ? 'rigs/npc' : 'rigs');
export const REF_DIR = join(PKG, '.cache/ref');
export const WORK_DIR = join(PKG, '.cache/work');
export const PREVIEW_DIR = join(ROOT, 'previews');
/** Where the client serves the creature GLBs from (`/creature-models/<id>.glb`; the NPC set `/npc-models/<id>.glb`). */
export const OUT_DIR = join(ROOT, NPC_SET ? 'packages/client/public/npc-models' : 'packages/client/public/creature-models');

export function readManifest() {
  return JSON.parse(readFileSync(join(ROOT, 'packages/client/public/creatures/creatures.manifest.json'), 'utf8'));
}
