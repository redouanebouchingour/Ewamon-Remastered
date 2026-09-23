/** §40.3.5 / §40.6 byte budgets, asserted from the committed manifest. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RECIPES, SURFACES, SURFACE_IDS, biomeSurfaceSet } from '@ewa/render/surfaces';
import type { Biome } from '@ewa/render/surfaces';
import { DEFAULT_RDO } from '../src/encode';
import { MANIFEST_FILE } from '../src/manifest';
import type { MaterialsManifest } from '../src/manifest';
import { DEFAULT_OUT_DIR } from '../src/paths';
import { FIELD_MAP_TARGET, HERO_MAP_TARGET, MAP_HARD_CAP, MATERIALS_CEILING, PHASE2_FIELD_CEILING, RDO_LEVER_CEILING } from '../src/run';

const manifestPath = join(DEFAULT_OUT_DIR, MANIFEST_FILE);
const m = (existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null) as MaterialsManifest | null;
const MB = 1048576;

describe('material byte budgets', () => {
  it('hero surfaces are ≤ 50 world-wide', () => {
    expect(SURFACE_IDS.filter((id) => SURFACES[id].hero).length).toBeLessThanOrEqual(50);
  });

  it('every map meets its per-map target (field ≤ 0.10 MB, hero ≤ 0.40 MB) or has had the rdo lever applied', () => {
    expect(m, 'run the bake first').not.toBeNull();
    const unfixed: string[] = [], overCap: string[] = [];
    for (const [id, e] of Object.entries(m!.surfaces)) {
      const rdo = RECIPES[id]!.rdo ?? DEFAULT_RDO;
      for (const tier of ['field', 'hero'] as const) {
        const t = e[tier];
        if (!t) continue;
        const target = tier === 'hero' ? HERO_MAP_TARGET : FIELD_MAP_TARGET;
        for (const map of ['albedo', 'orm', 'normal'] as const) {
          const bytes = readFileSync(join(DEFAULT_OUT_DIR, t[map])).length;
          const label = `${id}.${tier}_${map} ${(bytes / 1024).toFixed(1)} KiB > ${(target / 1024).toFixed(1)} KiB`;
          // §40.3.5: a map over target fails with its id unless the fix (a higher rdo in the recipe) is in place
          if (bytes > target && rdo < RDO_LEVER_CEILING) unfixed.push(`${label} (rdo ${rdo})`);
          if (bytes > target * MAP_HARD_CAP) overCap.push(label);
        }
      }
    }
    expect(unfixed).toEqual([]);
    expect(overCap).toEqual([]);
  });

  it('surfaces that set the rdo lever actually need it (no silent quality loss)', () => {
    for (const [id, e] of Object.entries(m!.surfaces)) {
      if ((RECIPES[id]!.rdo ?? DEFAULT_RDO) <= DEFAULT_RDO) continue;
      const sets = [e.field, e.hero].filter((t) => t !== null);
      const anyOver = sets.some((t) => {
        const target = t!.size === 1024 ? HERO_MAP_TARGET : FIELD_MAP_TARGET;
        // judged against the default-rdo size ≈ 1.15 × the lever size (measured saving at rdo 4)
        return (['albedo', 'orm', 'normal'] as const).some((k) => readFileSync(join(DEFAULT_OUT_DIR, t![k])).length * 1.15 > target);
      });
      expect(anyOver, `${id} sets rdo but no map is near its target`).toBe(true);
    }
  });

  it('every biome field set fits the 6 MB phase-2 load (Mirevale included)', () => {
    for (const b of Object.keys(m!.byBiome) as Biome[]) {
      const bytes = biomeSurfaceSet(b).reduce((a, id) => a + m!.surfaces[id]!.field.bytes, 0);
      expect(bytes, `${b} field ${(bytes / MB).toFixed(2)} MB`).toBeLessThanOrEqual(PHASE2_FIELD_CEILING);
    }
  });

  it('the Mirevale hero set is ≈ 12 MB (10 surfaces × 3 × ≤ 0.40 MB)', () => {
    const bytes = biomeSurfaceSet('grove').reduce((a, id) => a + (m!.surfaces[id]!.hero?.bytes ?? 0), 0);
    expect(bytes / MB).toBeLessThanOrEqual(12.0);
  });

  it('public/materials/ is ≤ 90 MB (§40.6)', () => {
    expect(m!.totalBytes).toBeLessThanOrEqual(MATERIALS_CEILING);
  });
});
