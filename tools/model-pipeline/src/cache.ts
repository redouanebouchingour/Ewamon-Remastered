/**
 * Content-hash cache (SPEC §40.0.2 rule 2): `tools/model-pipeline/.cache/` (git-ignored).
 *
 *  - `tex/<key>.bin` + `tex/<key>.json` — one encoded texture; key = sha256(image bytes, role, format, plan
 *    settingsKey, PIPELINE_VERSION).
 *  - `model/<key>/{lod0.glb,lod1.glb?,meta.json}` — one model's written GLB(s) and its manifest facts; key =
 *    sha256(source bytes, set, id, PIPELINE_VERSION, SEQUENCE_KEY, per-set parameters, texture keys, the text of
 *    every pipeline source file that shapes bytes).
 *
 * A rerun over unchanged inputs reads everything from here and reports `cacheHits === inputs`.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stableJson } from './json.js';
import { PIPELINE_FILES } from './paths.js';

/** Bump when the output bytes change for a reason no hashed input captures. */
export const PIPELINE_VERSION = 'model-pipeline/1';

let pipelineText: string | null = null;
/** The text of the byte-shaping sources, LF-normalised (a checkout's line endings do not change the key). */
export function pipelineSourceText(): string {
  pipelineText ??= PIPELINE_FILES.map((f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n')).join('\n\u0000\n');
  return pipelineText;
}

export function hashKey(...parts: readonly (string | Uint8Array)[]): string {
  const h = createHash('sha256');
  for (const p of parts) {
    h.update(typeof p === 'string' ? `s${p.length}:` : `b${p.byteLength}:`);
    h.update(p);
  }
  return h.digest('hex');
}

function writeAtomic(file: string, data: Uint8Array | string): void {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, file);
}

export interface CachedTextureMeta {
  readonly role: string;
  readonly format: string;
  readonly width: number;
  readonly height: number;
  readonly mean: readonly [number, number, number];
}

export function readTexture(cacheDir: string, key: string): { bytes: Uint8Array; meta: CachedTextureMeta } | null {
  const bin = join(cacheDir, 'tex', `${key}.bin`);
  const meta = join(cacheDir, 'tex', `${key}.json`);
  if (!existsSync(bin) || !existsSync(meta)) return null;
  try {
    return { bytes: new Uint8Array(readFileSync(bin)), meta: JSON.parse(readFileSync(meta, 'utf8')) as CachedTextureMeta };
  } catch {
    return null;
  }
}

export function writeTexture(cacheDir: string, key: string, bytes: Uint8Array, meta: CachedTextureMeta): void {
  mkdirSync(join(cacheDir, 'tex'), { recursive: true });
  writeAtomic(join(cacheDir, 'tex', `${key}.bin`), bytes);
  writeAtomic(join(cacheDir, 'tex', `${key}.json`), stableJson(meta));
}

export interface CachedModel<M> {
  readonly lod0: Uint8Array;
  readonly lod1: Uint8Array | null;
  readonly meta: M;
}

export function readModel<M>(cacheDir: string, key: string): CachedModel<M> | null {
  const dir = join(cacheDir, 'model', key);
  const metaFile = join(dir, 'meta.json');
  if (!existsSync(metaFile) || !existsSync(join(dir, 'lod0.glb'))) return null;
  try {
    const meta = JSON.parse(readFileSync(metaFile, 'utf8')) as M & { hasLod1: boolean };
    const lod1File = join(dir, 'lod1.glb');
    if (meta.hasLod1 && !existsSync(lod1File)) return null;
    return { lod0: new Uint8Array(readFileSync(join(dir, 'lod0.glb'))), lod1: meta.hasLod1 ? new Uint8Array(readFileSync(lod1File)) : null, meta };
  } catch {
    return null;
  }
}

/** The GLBs first, `meta.json` last: an interrupted write never leaves an entry that reads as complete. */
export function writeModel<M extends object>(cacheDir: string, key: string, entry: CachedModel<M>): void {
  const dir = join(cacheDir, 'model', key);
  mkdirSync(dir, { recursive: true });
  writeAtomic(join(dir, 'lod0.glb'), entry.lod0);
  if (entry.lod1) writeAtomic(join(dir, 'lod1.glb'), entry.lod1);
  writeAtomic(join(dir, 'meta.json'), stableJson({ ...entry.meta, hasLod1: entry.lod1 !== null }));
}
