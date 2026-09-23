/**
 * Content-hash cache and determinism (§40.0.2): a fresh bake reproduces the committed bytes, and a rerun over
 * unchanged inputs does no image work (`cacheHits === inputs`) and rewrites byte-identical files.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { RECIPES, SURFACES } from '@ewa/render/surfaces';
import { surfaceHash } from '../src/cache';
import { DEFAULT_OUT_DIR } from '../src/paths';
import { runBake } from '../src/run';

const tmp = mkdtempSync(join(tmpdir(), 'material-bake-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const FILES = ['water_pond.field_albedo.ktx2', 'water_pond.field_orm.ktx2', 'water_pond.field_normal.ktx2'];
const read = (dir: string, f: string): Buffer => readFileSync(join(dir, f));

describe('bake cache', () => {
  it('rebuilds byte-identically from cache, and a fresh bake matches the committed output', async () => {
    const outDir = join(tmp, 'out'), cacheDir = join(tmp, 'cache');
    const quiet = (): void => {};
    const first = await runBake({ ids: ['water_pond'], outDir, cacheDir, qaDir: null, jobs: 1, log: quiet });
    expect(first.baked).toBe(1);
    const bytes1 = FILES.map((f) => read(outDir, f));
    for (const f of FILES) rmSync(join(outDir, f));
    const second = await runBake({ ids: ['water_pond'], outDir, cacheDir, qaDir: null, jobs: 1, log: quiet });
    expect(second.baked).toBe(0);
    expect(second.cacheHits).toBe(second.inputs);
    FILES.forEach((f, i) => expect(read(outDir, f).equals(bytes1[i]!), f).toBe(true));
    // the committed tree was produced by the same deterministic pipeline
    if (existsSync(join(DEFAULT_OUT_DIR, FILES[0]!))) FILES.forEach((f, i) => expect(read(DEFAULT_OUT_DIR, f).equals(bytes1[i]!), `committed ${f}`).toBe(true));
    expect(first.manifest.surfaces.water_pond?.hash).toBe(surfaceHash(RECIPES.water_pond!, SURFACES.water_pond));
  }, 600_000);

  it('the hash changes with the SurfaceDef and the recipe fields', () => {
    const h = surfaceHash(RECIPES.cobble!, SURFACES.cobble);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(surfaceHash(RECIPES.cobble!, { ...SURFACES.cobble, roughness: 0.66 })).not.toBe(h);
    expect(surfaceHash({ ...RECIPES.cobble!, rdo: 3 }, SURFACES.cobble)).not.toBe(h);
    expect(surfaceHash(RECIPES.cobble!, SURFACES.cobble)).toBe(h);
  });
});
