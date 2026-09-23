/**
 * Content-hash cache (SPEC §40.0.2 rule 2, §40.3.4): `.cache/<hash>/<tier>_{albedo,orm,normal}.ktx2` plus
 * `<tier>.meta.json`. The hash covers the recipe source text (its biome-group file and the shared recipe files),
 * the SurfaceDef JSON, the recipe's static fields, the tiers, the encoder settingsKey and the bake's own source,
 * so editing a recipe file rebakes exactly the surfaces defined in it.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RECIPE_FILES, SHARED_RECIPE_FILES } from '@ewa/render/surfaces';
import type { SurfaceDef, SurfaceRecipe } from '@ewa/render/surfaces';
import { CAVITY_SIGMA_PX, CLAMP_FAIL_FRACTION, LUMINANCE_CEILING, NORMAL_GAIN, SEAM_TOLERANCE } from './bake';
import type { Tier } from './bake';
import { DEFAULT_RDO, settingsKey } from './encode';
import type { MapKind } from './encode';
import { stableJson } from './manifest';
import { PIPELINE_FILES, SURFACES_SRC } from './paths';

export const PIPELINE_VERSION = 'material-bake/1';
export const MAPS: readonly MapKind[] = ['albedo', 'orm', 'normal'];

const textCache = new Map<string, string>();
function fileText(abs: string): string {
  let t = textCache.get(abs);
  if (t === undefined) {
    if (!existsSync(abs)) throw new Error(`[material-bake] missing source file ${abs}`);
    t = readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
    textCache.set(abs, t);
  }
  return t;
}

export function tiersFor(def: SurfaceDef): Tier[] {
  return def.hero ? ['field', 'hero'] : ['field'];
}

export function rdoFor(r: SurfaceRecipe): number {
  return r.rdo ?? DEFAULT_RDO;
}

/** sha256(recipe source, SurfaceDef JSON, tiers, encoder settingsKey, pipeline) — the manifest `hash`. */
export function surfaceHash(r: SurfaceRecipe, def: SurfaceDef): string {
  const file = RECIPE_FILES[r.id];
  if (!file) throw new Error(`[material-bake] ${r.id}: no recipe source file registered`);
  const h = createHash('sha256');
  h.update(`${PIPELINE_VERSION}\n`);
  h.update(fileText(resolve(SURFACES_SRC, file)));
  for (const f of SHARED_RECIPE_FILES) h.update(fileText(resolve(SURFACES_SRC, f)));
  for (const f of PIPELINE_FILES) h.update(fileText(f));
  h.update(stableJson({
    def,
    recipe: { id: r.id, hero: r.hero, metres: r.metres, normalStrength: r.normalStrength, wrap: r.wrap, rdo: rdoFor(r) },
    tiers: tiersFor(def),
    encoder: settingsKey(rdoFor(r)),
    bake: { CAVITY_SIGMA_PX, CLAMP_FAIL_FRACTION, LUMINANCE_CEILING, NORMAL_GAIN, SEAM_TOLERANCE },
  }));
  return h.digest('hex');
}

export interface TierMeta {
  readonly tier: Tier;
  readonly size: number;
  readonly bytes: Readonly<Record<MapKind, number>>;
  readonly clampedPct: number;
  readonly seam: { readonly albedo: number; readonly height: number } | null;
  readonly roughClippedPct: number;
  readonly maxLuminance: number;
  readonly aoDefault: boolean;
  readonly bakeMs: number;
  readonly encodeMs: number;
}

export const tierFile = (cacheDir: string, hash: string, tier: Tier, map: MapKind): string => join(cacheDir, hash, `${tier}_${map}.ktx2`);
const metaFile = (cacheDir: string, hash: string, tier: Tier): string => join(cacheDir, hash, `${tier}.meta.json`);

export function readTierMeta(cacheDir: string, hash: string, tier: Tier): TierMeta | null {
  const mf = metaFile(cacheDir, hash, tier);
  if (!existsSync(mf)) return null;
  for (const m of MAPS) if (!existsSync(tierFile(cacheDir, hash, tier, m))) return null;
  try {
    return JSON.parse(readFileSync(mf, 'utf8')) as TierMeta;
  } catch {
    return null;
  }
}

/** Atomic-ish write (tmp + rename) so an interrupted bake never leaves a half entry that looks complete. */
function writeAtomic(file: string, data: Uint8Array | string): void {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, file);
}

export function writeTierEntry(cacheDir: string, hash: string, tier: Tier, maps: Readonly<Record<MapKind, Uint8Array>>, meta: TierMeta): void {
  mkdirSync(join(cacheDir, hash), { recursive: true });
  for (const m of MAPS) writeAtomic(tierFile(cacheDir, hash, tier, m), maps[m]);
  writeAtomic(metaFile(cacheDir, hash, tier), stableJson(meta));
}
