/**
 * One unit of work: bake one tier of one surface, encode its three maps, write the cache entry. Runs inline or
 * inside a worker thread (worker.ts); the parent only ever sees the TierMeta.
 */
import { RECIPES, SURFACES } from '@ewa/render/surfaces';
import type { SurfaceId } from '@ewa/render/surfaces';
import { bakeTier } from './bake';
import type { Tier } from './bake';
import { rdoFor, writeTierEntry } from './cache';
import type { TierMeta } from './cache';
import { encodeKtx2 } from './encode';
import type { MapKind } from './encode';

export interface JobInput { readonly id: string; readonly tier: Tier; readonly hash: string; readonly cacheDir: string }

export async function runJob(j: JobInput): Promise<TierMeta> {
  const recipe = RECIPES[j.id];
  const def = SURFACES[j.id as SurfaceId];
  if (!recipe || !def) throw new Error(`[material-bake] ${j.id}: no recipe or SurfaceDef`);
  const baked = bakeTier(recipe, def, j.tier);
  const t0 = performance.now();
  const rdo = rdoFor(recipe);
  const maps = {} as Record<MapKind, Uint8Array>;
  for (const kind of ['albedo', 'orm', 'normal'] as const) maps[kind] = await encodeKtx2(baked[kind], kind, rdo);
  const meta: TierMeta = {
    tier: j.tier,
    size: baked.size,
    bytes: { albedo: maps.albedo.length, orm: maps.orm.length, normal: maps.normal.length },
    clampedPct: round(baked.clampedPct, 4),
    seam: baked.seam ? { albedo: round(baked.seam.albedo, 6), height: round(baked.seam.height, 6) } : null,
    roughClippedPct: round(baked.roughClippedPct, 3),
    maxLuminance: round(baked.maxLuminance, 5),
    aoDefault: baked.aoDefault,
    bakeMs: Math.round(baked.ms),
    encodeMs: Math.round(performance.now() - t0),
  };
  writeTierEntry(j.cacheDir, j.hash, j.tier, maps, meta);
  return meta;
}

export const round = (x: number, d: number): number => Math.round(x * 10 ** d) / 10 ** d;
