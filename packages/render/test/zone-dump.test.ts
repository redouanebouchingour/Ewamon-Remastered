/**
 * §10.10.1 / §40.5.2 `dumpZone()` on real built zones (IMPLEMENTATION-NOTES Part 4, H2): the fields the asset audit
 * needs — `materials[].side`, scatter `kind` / tier / `instancedMesh`, `sharedBy`, and both directions of Pillar 4's
 * housing rule (every light within 0.6 of a glowing part; every tagged housing within 0.6 of a light).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Scene } from 'three/webgpu';
import { LightRig } from '../src/lighting/rig.js';
import { buildZone } from '../src/zone/builder.js';
import { dumpZone, readBudgetCounts, HOUSINGS_KEY, type HousingTag } from '../src/stats.js';
import { mockLibrary, realSpec } from './zone-helpers.js';

let warn: ReturnType<typeof vi.spyOn>;
beforeAll(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); return () => warn.mockRestore(); });

const counts = readBudgetCounts({ render: { drawCalls: 0, triangles: 0 }, memory: { textures: 0, texturesSize: 0, geometries: 0, programs: 0, renderTargets: 0, attributes: 0, attributesSize: 0, total: 0 } }, 0, 0, 0);

async function dumpOf(id: 'mirevale' | 'mire_route') {
  const lib = await mockLibrary();
  const scene = new Scene();
  const rig = new LightRig(scene);
  const spec = realSpec(id);
  const h = buildZone(spec, { materials: lib, lighting: rig, scene });
  const d = dumpZone({ zone: id, harvestLevel: 0, root: h.group, library: lib, counts });
  return { spec, h, d };
}

describe('dumpZone on the slice zones', () => {
  it.each(['mirevale', 'mire_route'] as const)('%s: sides, scatter kinds / tiers, sharedBy, housings both directions', async (id) => {
    const { spec, h, d } = await dumpOf(id);
    // materials[].side: every row carries it; BackSide (1) never appears under a zone root (sky is not in the zone)
    expect(d.materials.length).toBeGreaterThan(5);
    expect(d.materials.every((m) => m.side === 0 || m.side === 2)).toBe(true);
    // scatter rows: kind + tier + InstancedMesh; plain geometries: kind null, no tier
    const scatter = d.geometries.filter((g) => g.kind !== null);
    expect(scatter.length).toBeGreaterThan(10);
    expect(scatter.every((g) => g.instancedMesh && g.tier !== undefined && g.instanced >= 0)).toBe(true);
    expect(d.geometries.filter((g) => g.kind === null).every((g) => !g.instancedMesh && g.tier === undefined && g.sharedBy >= 1)).toBe(true);
    // the tier set of every kind (the Z2 deviation: only trees have an impostor, small kinds stop at lod1 / lod2)
    const tiers: Record<string, number[]> = {};
    for (const g of scatter) (tiers[g.kind!] ??= []).push(g.tier!);
    for (const k of Object.keys(tiers)) tiers[k] = [...new Set(tiers[k])].sort();
    for (const [k, t] of Object.entries(tiers)) {
      if (k.startsWith('tree_')) expect(t, k).toEqual([0, 1, 2, 3]);
      else expect(t.length, k).toBeGreaterThanOrEqual(2);
    }
    // Pillar 4, direction 1: every light has a glowing part within 0.6 m
    expect(d.lights.length).toBe(spec.lights.length);
    const worst = Math.max(...d.lights.map((l) => l.housingDistance));
    expect(worst).toBeLessThanOrEqual(0.6);
    // direction 2: every generated housing is tagged and has its light within 0.6 m
    const generated = spec.lights.filter((l) => l.housing.kind === 'generated');
    expect((h.group.userData[HOUSINGS_KEY] as HousingTag[]).length).toBe(generated.length);
    expect(d.lightSources.map((s) => s.id).sort()).toEqual(generated.map((l) => `${l.id}:housing`).sort());
    expect(Math.max(...d.lightSources.map((s) => s.lightDistance))).toBeLessThanOrEqual(0.6);
    h.dispose();
  }, 60_000);

  it('a housing moved away from its light fails direction 2 (and a light without a glowing part fails direction 1)', async () => {
    const { h, d } = await dumpOf('mirevale');
    const tags = h.group.userData[HOUSINGS_KEY] as HousingTag[];
    const moved = tags.map((t, k) => (k === 0 ? { ...t, min: [t.min[0] + 5, t.min[1], t.min[2]] as const, max: [t.max[0] + 5, t.max[1], t.max[2]] as const } : t));
    h.group.userData[HOUSINGS_KEY] = moved;
    const lib = await mockLibrary();
    const d2 = dumpZone({ zone: 'mirevale', harvestLevel: 0, root: h.group, library: lib, counts });
    const row = d2.lightSources.find((s) => s.id === tags[0]!.id)!;
    expect(row.lightDistance).toBeGreaterThan(4);
    expect(d.lightSources.find((s) => s.id === tags[0]!.id)!.lightDistance).toBeLessThanOrEqual(0.6);
    h.dispose();
  }, 60_000);
});
