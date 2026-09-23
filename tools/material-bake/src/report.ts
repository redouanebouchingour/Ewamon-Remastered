/**
 * `report`: per-surface bytes, clamped %, seam error, bake ms, and the §40.3.5 / §40.6 budget checks, read
 * from materials.manifest.json and the cache metadata.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SURFACES, biomeSurfaceSet } from '@ewa/render/surfaces';
import type { SurfaceId } from '@ewa/render/surfaces';
import { readTierMeta } from './cache';
import type { TierMeta } from './cache';
import { MANIFEST_FILE, validateManifest } from './manifest';
import type { MaterialsManifest } from './manifest';
import { DEFAULT_CACHE_DIR, DEFAULT_OUT_DIR } from './paths';
import { FIELD_MAP_TARGET, HERO_MAP_TARGET, MATERIALS_CEILING, PHASE2_FIELD_CEILING, fmtBytes } from './run';

export interface BudgetFinding { readonly id: string; readonly tier: 'field' | 'hero'; readonly map: string; readonly bytes: number; readonly target: number }

export interface ReportData {
  readonly manifest: MaterialsManifest;
  readonly overTarget: readonly BudgetFinding[];
  readonly biomeField: Readonly<Record<string, number>>;
  readonly biomeHero: Readonly<Record<string, number>>;
  readonly problems: readonly string[];
}

export function readManifest(outDir = DEFAULT_OUT_DIR): MaterialsManifest {
  const f = join(resolve(outDir), MANIFEST_FILE);
  if (!existsSync(f)) throw new Error(`[material-bake] no manifest at ${f}; run the bake first`);
  return JSON.parse(readFileSync(f, 'utf8')) as MaterialsManifest;
}

export function analyse(outDir = DEFAULT_OUT_DIR): ReportData {
  const manifest = readManifest(outDir);
  const problems = validateManifest(manifest);
  const overTarget: BudgetFinding[] = [];
  for (const [id, e] of Object.entries(manifest.surfaces)) {
    for (const tier of ['field', 'hero'] as const) {
      const t = e[tier];
      if (!t) continue;
      const target = tier === 'hero' ? HERO_MAP_TARGET : FIELD_MAP_TARGET;
      for (const map of ['albedo', 'orm', 'normal'] as const) {
        const f = join(resolve(outDir), t[map]);
        if (!existsSync(f)) { problems.push(`${id}.${tier}.${map}: file ${t[map]} missing`); continue; }
        const bytes = readFileSync(f).length;
        if (bytes > target) overTarget.push({ id, tier, map, bytes, target });
      }
    }
  }
  const biomeField: Record<string, number> = {}, biomeHero: Record<string, number> = {};
  for (const [biome, ids] of Object.entries(manifest.byBiome)) {
    let f = 0, h = 0;
    for (const id of ids) {
      const e = manifest.surfaces[id];
      if (!e) continue;
      f += e.field.bytes;
      if (e.hero) h += e.hero.bytes;
    }
    biomeField[biome] = f; biomeHero[biome] = h;
  }
  if (manifest.totalBytes > MATERIALS_CEILING) problems.push(`materials total ${fmtBytes(manifest.totalBytes)} > 90 MB ceiling`);
  for (const [b, f] of Object.entries(biomeField)) if (f > PHASE2_FIELD_CEILING) problems.push(`${b} field set ${fmtBytes(f)} > 6 MB (phase 2)`);
  return { manifest, overTarget, biomeField, biomeHero, problems };
}

export function printReport(outDir = DEFAULT_OUT_DIR, cacheDir = DEFAULT_CACHE_DIR, log: (s: string) => void = console.log): ReportData {
  const d = analyse(outDir);
  const m = d.manifest;
  const pad = (s: string | number, n: number): string => String(s).padEnd(n);
  const lpad = (s: string | number, n: number): string => String(s).padStart(n);
  log(`${pad('surface', 20)}${pad('tier', 6)}${lpad('albedo', 10)}${lpad('orm', 10)}${lpad('normal', 10)}${lpad('total', 11)}${lpad('clamp%', 8)}${lpad('seam/255', 10)}${lpad('bake ms', 9)}${lpad('enc ms', 9)}`);
  for (const id of Object.keys(m.surfaces).sort()) {
    const e = m.surfaces[id]!;
    for (const tier of ['field', 'hero'] as const) {
      const t = e[tier];
      if (!t) continue;
      const meta: TierMeta | null = readTierMeta(resolve(cacheDir), e.hash, tier);
      const b = meta?.bytes;
      const seam = meta?.seam ? (Math.max(meta.seam.albedo, meta.seam.height) * 255).toFixed(2) : '-';
      const target = tier === 'hero' ? HERO_MAP_TARGET : FIELD_MAP_TARGET;
      const mark = (n: number | undefined): string => (n === undefined ? '?' : `${(n / 1024).toFixed(0)}K${n > target ? '!' : ''}`);
      log(`${pad(id, 20)}${pad(tier, 6)}${lpad(mark(b?.albedo), 10)}${lpad(mark(b?.orm), 10)}${lpad(mark(b?.normal), 10)}${lpad(fmtBytes(t.bytes), 11)}${lpad(meta ? meta.clampedPct.toFixed(2) : '?', 8)}${lpad(seam, 10)}${lpad(meta?.bakeMs ?? '?', 9)}${lpad(meta?.encodeMs ?? '?', 9)}`);
    }
  }
  const missing = Object.keys(SURFACES).filter((id) => !m.surfaces[id]);
  log('');
  log(`surfaces in manifest: ${Object.keys(m.surfaces).length}/${Object.keys(SURFACES).length}${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
  log(`field ${fmtBytes(m.fieldBytes)} · hero ${fmtBytes(m.heroBytes)} · total ${fmtBytes(m.totalBytes)} (ceiling 90 MB)`);
  const grove = biomeSurfaceSet('grove') as readonly SurfaceId[];
  const gf = grove.reduce((a, id) => a + (m.surfaces[id]?.field.bytes ?? 0), 0);
  const gh = grove.reduce((a, id) => a + (m.surfaces[id]?.hero?.bytes ?? 0), 0);
  log(`Mirevale (grove) field ${fmtBytes(gf)} (≤ 6 MB, target 4.5 MB) · hero ${fmtBytes(gh)} (≈ 12 MB)`);
  for (const b of Object.keys(d.biomeField).sort()) log(`  ${pad(b, 9)} field ${lpad(fmtBytes(d.biomeField[b]!), 9)}   hero ${lpad(fmtBytes(d.biomeHero[b]!), 9)}`);
  log(`maps over the per-map target (field ≤ 0.10 MB, hero ≤ 0.40 MB): ${d.overTarget.length}`);
  for (const o of d.overTarget) log(`  ${o.id}.${o.tier}.${o.map} ${fmtBytes(o.bytes)} > ${fmtBytes(o.target)}`);
  for (const p of d.problems) log(`PROBLEM ${p}`);
  return d;
}
