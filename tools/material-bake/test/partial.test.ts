/**
 * Partial bakes (`--surface` / `--zone` / `--tier`) merge into the manifest already in the output directory:
 * surfaces outside the selection keep their entries while their files are present (even with a stale hash),
 * totals are summed over the merged set, and no file is ever deleted.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { RECIPES, SURFACES } from '@ewa/render/surfaces';
import { surfaceHash } from '../src/cache';
import { MANIFEST_FILE, PLACEHOLDER_FILES, stableJson, tierFiles, validateManifest } from '../src/manifest';
import type { MaterialSetEntry, MaterialTier, MaterialsManifest } from '../src/manifest';
import { runBake } from '../src/run';

const tmp = mkdtempSync(join(tmpdir(), 'material-bake-partial-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const STALE_HASH = 'ab'.repeat(32);

/** Writes fake tier files of `n`, `n+1`, `n+2` bytes and returns the tier with a deliberately wrong `bytes`. */
function fakeTier(outDir: string, id: string, tier: 'field' | 'hero', n: number): MaterialTier {
  const names = tierFiles(id, tier);
  [names.albedo, names.orm, names.normal].forEach((f, i) => writeFileSync(join(outDir, f), Buffer.alloc(n + i, i + 1)));
  return { ...names, size: tier === 'hero' ? 1024 : 512, bytes: 1 };
}

const entry = (field: MaterialTier, hero: MaterialTier | null): MaterialSetEntry => ({
  field, hero, metres: 2, wrap: 'repeat', hash: STALE_HASH, albedoClampedPct: 0.5,
});

describe('partial bake', () => {
  it('--surface merges into the existing manifest, re-totals it and deletes nothing', async () => {
    const outDir = join(tmp, 'out'), cacheDir = join(tmp, 'cache');
    mkdirSync(outDir, { recursive: true });
    const cobble = entry(fakeTier(outDir, 'cobble', 'field', 100), fakeTier(outDir, 'cobble', 'hero', 400));
    const wax = entry(fakeTier(outDir, 'candle_wax', 'field', 200), null);
    const ghost = entry({ ...tierFiles('thatch', 'field'), size: 512, bytes: 9 }, null);     // its files are gone
    const before: MaterialsManifest = {
      version: 2,
      surfaces: { cobble, candle_wax: wax, thatch: ghost },
      byBiome: {},
      placeholder: { ...PLACEHOLDER_FILES },
      fieldBytes: 1, heroBytes: 1, totalBytes: 1,
    };
    expect(validateManifest(before)).toEqual([]);
    writeFileSync(join(outDir, MANIFEST_FILE), stableJson(before));
    writeFileSync(join(outDir, 'orphan.field_albedo.ktx2'), 'not in any manifest');

    const lines: string[] = [];
    const r = await runBake({ ids: ['coil_brass'], outDir, cacheDir, qaDir: null, jobs: 1, log: (s) => lines.push(s) });
    expect(r.baked).toBe(1);

    const m = JSON.parse(readFileSync(join(outDir, MANIFEST_FILE), 'utf8')) as MaterialsManifest;
    expect(m).toEqual(r.manifest);
    expect(validateManifest(m)).toEqual([]);
    expect(Object.keys(m.surfaces).sort()).toEqual(['candle_wax', 'cobble', 'coil_brass']);
    // carried over verbatim (stale hash included), bytes re-measured from the files
    expect(m.surfaces.cobble).toEqual({ ...cobble, field: { ...cobble.field, bytes: 303 }, hero: { ...cobble.hero!, bytes: 1203 } });
    expect(m.surfaces.candle_wax).toEqual({ ...wax, field: { ...wax.field, bytes: 603 } });
    expect(m.surfaces.coil_brass!.hash).toBe(surfaceHash(RECIPES.coil_brass!, SURFACES.coil_brass));
    expect(lines.some((l) => /kept 2 surfaces/.test(l))).toBe(true);

    const coil = m.surfaces.coil_brass!.field.bytes;
    const placeholder = Object.values(PLACEHOLDER_FILES).reduce((s, f) => s + statSync(join(outDir, f)).size, 0);
    expect(m.fieldBytes).toBe(303 + 603 + coil);
    expect(m.heroBytes).toBe(1203);
    expect(m.totalBytes).toBe(m.fieldBytes + m.heroBytes + placeholder);
    expect(existsSync(join(outDir, 'orphan.field_albedo.ktx2'))).toBe(true);

    // --tier on the same selection is partial too: same merged set, still no deletions
    const t = await runBake({ ids: ['coil_brass'], tier: 'field', outDir, cacheDir, qaDir: null, jobs: 1, log: () => {} });
    expect(t.baked).toBe(0);
    expect(t.manifest).toEqual(m);
    expect(existsSync(join(outDir, 'orphan.field_albedo.ktx2'))).toBe(true);
  }, 600_000);
});
