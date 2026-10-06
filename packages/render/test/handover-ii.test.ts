/**
 * Handover II (IMPLEMENTATION-NOTES): scatter draws whose instance data are geometry attributes (one node build per
 * material × layout instead of one per mesh), and the zone build as resumable steps (the off-scene prepare runs it in
 * slices between frames; the result and the geometry digest do not depend on the slicing).
 */
import { describe, expect, it, vi } from 'vitest';
import { Scene } from 'three/webgpu';
import type { InterleavedBufferAttribute, Material } from 'three/webgpu';
import { LightRig } from '../src/lighting/rig.js';
import { STEPS_CANCELLED, createSliceStats, drain, runSliced, type Steps } from '../src/steps.js';
import { buildZone, buildZoneSteps, loadZone, zoneSurfaces } from '../src/zone/builder.js';
import { SCATTER_COLOR_ATTRIBUTE, SCATTER_MATRIX_ROWS, isScatterMesh } from '../src/zone/instancing.js';
import { createRenderStats } from '../src/stats.js';
import { mockLibrary, realSpec } from './zone-helpers.js';

const instant = (): Promise<void> => Promise.resolve();

describe('scatter draws read their instances from geometry attributes', () => {
  it('no InstancedMesh, count 1: the node-build key depends on the material and the attribute layout only', async () => {
    const lib = await mockLibrary();
    const spec = realSpec('mire_route');
    await lib.preload(zoneSurfaces(spec));
    const h = buildZone(spec, { materials: lib, lighting: null, scene: null });
    expect(h.instanced.length).toBeGreaterThan(10);
    const layouts = new Set<string>();
    const perKind = new Map(h.scatterInstances().map((s) => [s.kind, s.matrices.length / 16]));
    for (const m of h.instanced) {
      expect(isScatterMesh(m)).toBe(true);
      expect((m as unknown as { isInstancedMesh?: boolean }).isInstancedMesh).toBeUndefined();   // three adds the uuid to the key for these …
      expect((m as unknown as { count?: number }).count ?? 1).toBeLessThanOrEqual(1);            // … and for count > 1 (Mesh.count is 1)
      const g = m.geometry;
      expect(g.isInstancedBufferGeometry).toBe(true);
      const rows = SCATTER_MATRIX_ROWS.map((n) => g.getAttribute(n) as InterleavedBufferAttribute);
      for (const [i, r] of rows.entries()) { expect(r.isInterleavedBufferAttribute).toBe(true); expect(r.data).toBe(m.instanceMatrix); expect(r.offset).toBe(i * 4); }
      expect(g.getAttribute(SCATTER_COLOR_ATTRIBUTE) ?? null).toBe(m.instanceColor);
      // first sync: every chunk is tier 0 and active, so the tier-0 draws hold every instance of their kind
      const kind = m.userData.ewaScatterKind as string; const tier = m.userData.ewaScatterTier as number;
      expect(m.instances).toBe(tier === 0 ? perKind.get(kind) : 0);
      const mats = (Array.isArray(m.material) ? m.material : [m.material]) as Material[];
      layouts.add(`${mats.map((x) => x.uuid).join(',')}|${Object.keys(g.attributes).sort().join(',')}|${g.index !== null}`);
    }
    // the class meshes of one tier share one instance buffer (and one tint buffer)
    const byTier = new Map<string, Set<object>>();
    for (const m of h.instanced) {
      const k = `${m.userData.ewaScatterKind as string}:${m.userData.ewaScatterTier as number}`;
      if (!byTier.has(k)) byTier.set(k, new Set());
      byTier.get(k)!.add(m.instanceMatrix);
    }
    for (const s of byTier.values()) expect(s.size).toBe(1);
    // fewer layouts than draws: draws of a kind's tiers bind the same materials with the same layout
    expect(layouts.size).toBeLessThan(h.instanced.length);
    h.dispose();
    lib.disposeAll();
  }, 120_000);

  it('dispose releases each scatter draw and its wrapper geometry', async () => {
    const lib = await mockLibrary();
    const spec = realSpec('mirevale');
    await lib.preload(zoneSurfaces(spec));
    const h = buildZone(spec, { materials: lib, lighting: null, scene: null });
    let meshes = 0; let geos = 0;
    for (const m of h.instanced) { m.addEventListener('dispose', () => { meshes++; }); m.geometry.addEventListener('dispose', () => { geos++; }); }
    h.dispose();
    expect(meshes).toBe(h.instanced.length);
    expect(geos).toBe(h.instanced.length);
    lib.disposeAll();
  }, 120_000);
});

describe('the zone build as resumable steps', () => {
  it.each(['mirevale', 'cinderhold', 'mire_route'] as const)('%s: drained, sliced and interleaved builds give the same digest', async (id) => {
    const lib = await mockLibrary();
    const spec = realSpec(id);
    const other = realSpec(id === 'mirevale' ? 'cinderhold' : 'mirevale');
    await lib.preload([...zoneSurfaces(spec), ...zoneSurfaces(other)]);
    const deps = { materials: lib, lighting: null, scene: null };
    const sync = buildZone(spec, deps);
    const drained = drain(buildZoneSteps(spec, deps));
    const stats = createSliceStats();
    const sliced = await runSliced(buildZoneSteps(spec, deps), { sliceMs: 0, now: () => performance.now(), wait: instant, stats });
    expect(stats.slices).toBeGreaterThan(100);                       // a slice per step: every yield is a resumption point
    // two builds interleaved step by step (each has its own shape cache: geo.ts `swapShapeCache`)
    const [a, b] = await Promise.all([
      runSliced(buildZoneSteps(spec, deps), { sliceMs: 0, now: () => performance.now() }),
      runSliced(buildZoneSteps(other, deps), { sliceMs: 0, now: () => performance.now() }),
    ]);
    const otherSync = buildZone(other, deps);
    for (const h of [drained, sliced, a]) {
      expect(h.geometryDigest).toBe(sync.geometryDigest);
      expect(h.info).toEqual(sync.info);
    }
    expect(b.geometryDigest).toBe(otherSync.geometryDigest);
    for (const h of [sync, drained, sliced, a, b, otherSync]) h.dispose();
    lib.disposeAll();
  }, 300_000);

  it('runSliced: a slice ends after the step that crosses the budget; cancel returns the generator; urgent stops waiting', async () => {
    let clock = 0;
    let finished = false;
    function* steps(n: number, cost: number): Steps<number> {
      try {
        for (let i = 0; i < n; i++) { clock += cost; yield `s${i}`; }
        return n;
      } finally { finished = true; }
    }
    const waits: number[] = [];
    const stats = createSliceStats();
    // 3 ms steps, 8 ms budget: 3 steps per slice (the third crosses it)
    const r = await runSliced(steps(10, 3), { sliceMs: 8, now: () => clock, wait: async () => { waits.push(clock); }, stats });
    expect(r).toBe(10);
    expect(waits).toEqual([9, 18, 27]);
    expect(stats.slices).toBe(4);
    expect(stats.maxStepMs).toBe(3);
    expect(finished).toBe(true);

    clock = 0; finished = false;
    let n = 0;
    await expect(runSliced(steps(10, 3), { sliceMs: 8, now: () => clock, wait: instant, cancelled: () => ++n > 1 })).rejects.toBe(STEPS_CANCELLED);
    expect(finished).toBe(true);                                     // the generator's finally ran (g.return)

    clock = 0;
    let urgent = false;
    const w = vi.fn(async () => { urgent = true; });
    expect(await runSliced(steps(10, 3), { sliceMs: 8, now: () => clock, wait: w, urgent: () => urgent })).toBe(10);
    expect(w).toHaveBeenCalledTimes(1);                              // after the first wait the rest runs in one slice
  });

  it('loadZone with sliceMs builds the same zone; ZoneSystem.prepare slices by default and can be cancelled', async () => {
    const { ZoneSystem } = await import('../src/zone/system.js');
    const lib = await mockLibrary();
    const scene = new Scene();
    const rig = new LightRig(scene);
    const spec = realSpec('mire_route');
    await lib.preload(zoneSurfaces(spec));
    const ref = buildZone(spec, { materials: lib, lighting: null, scene: null });
    const viaLoad = await loadZone(spec, { materials: lib, lighting: null, scene: null, sliceMs: 4, sliceWait: instant });
    expect(viaLoad.geometryDigest).toBe(ref.geometryDigest);
    const ctx = {
      materials: lib, lighting: rig, scene, statsRecord: createRenderStats(), gpu: {},
      setLightingPalette: () => undefined, setGrade: () => undefined,
    } as unknown as ConstructorParameters<typeof ZoneSystem>[0];
    const sys = new ZoneSystem(ctx);
    const stats = createSliceStats();
    const pz = await sys.prepare(spec, { stats });
    expect(stats.slices).toBeGreaterThan(1);
    expect(pz.handle.geometryDigest).toBe(ref.geometryDigest);
    pz.drop();
    let k = 0;
    await expect(sys.prepare(spec, { cancelled: () => ++k > 2 })).rejects.toBe(STEPS_CANCELLED);
    const again = await sys.prepare(spec, { urgent: () => true });   // urgent: one slice after the first wait
    expect(again.handle.geometryDigest).toBe(ref.geometryDigest);
    const h = again.adopt();
    expect(h.group.parent).toBe(scene);
    h.dispose(); ref.dispose(); viaLoad.dispose();
    rig.dispose(); lib.disposeAll();
  }, 300_000);
});
