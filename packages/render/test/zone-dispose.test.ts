/**
 * SPEC §10.5.9 / §50.4.6 — the zone disposal contract, in node:
 * - `dispose-contract`: `ZoneHandle.dispose()` is idempotent; it never disposes a library material or texture
 *   directly (only the library's own `evictExcept` releases texture sets); every geometry the builder created is
 *   disposed, every InstancedMesh disposed, every punctual light released.
 * - leak: 100 load/unload cycles against a mock GPU that mirrors three 0.186's `info.memory` bookkeeping; after
 *   every unload geometries / attributes / textures / programs / render objects equal the baseline exactly; the
 *   geometry digest is identical on every cycle (determinism).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Mesh, PointLight, Scene, SpotLight } from 'three/webgpu';
import type { BufferGeometry, InstancedMesh } from 'three/webgpu';
import { LightRig } from '../src/lighting/rig.js';
import type { MaterialLibrary } from '../src/materials/library.js';
import { buildZone, loadZone, zoneSurfaces, type ZoneBuildDeps } from '../src/zone/builder.js';
import { MockGpu, countDisposals, mockLibrary, realSpec, syntheticSpec } from './zone-helpers.js';

let warn: ReturnType<typeof vi.spyOn>;
beforeAll(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); return () => warn.mockRestore(); });

function deps(lib: MaterialLibrary, rig: LightRig | null, scene: Scene | null): ZoneBuildDeps {
  return { materials: lib, lighting: rig, scene };
}

describe('§10.5.9 dispose-contract', () => {
  it('dispose is idempotent, removes the root, releases lights, disposes every builder geometry and InstancedMesh', async () => {
    const lib = await mockLibrary();
    const scene = new Scene();
    const rig = new LightRig(scene);
    const spec = syntheticSpec();
    const h = await loadZone(spec, deps(lib, rig, scene));
    expect(h.group.parent).toBe(scene);
    let lights = 0;
    h.group.traverse((o) => { if (o instanceof PointLight || o instanceof SpotLight) lights++; });
    expect(lights).toBe(spec.lights.length);
    expect(rig.counts()).toEqual({ shadow: 1, nonShadow: 0 });
    const disposedGeo = new Set<BufferGeometry>();
    for (const g of h.geometries) g.addEventListener('dispose', () => disposedGeo.add(g));
    const instancedDisposed = new Set<InstancedMesh>();
    for (const m of h.instanced) m.addEventListener('dispose', () => instancedDisposed.add(m));
    const meshes: Mesh[] = [];
    h.group.traverse((o) => { if (o instanceof Mesh) meshes.push(o); });
    const meshEvents = new Set<Mesh>();
    for (const m of meshes) m.addEventListener('dispose', () => meshEvents.add(m));
    const evict = vi.spyOn(lib, 'evictExcept');
    h.dispose();
    expect(h.disposed).toBe(true);
    expect(scene.children.includes(h.group)).toBe(false);
    expect(disposedGeo.size).toBe(h.geometries.length);
    expect(instancedDisposed.size).toBe(h.instanced.length);
    expect(meshEvents.size).toBe(meshes.length);                 // plain meshes get the event their render objects listen to
    expect(rig.counts()).toEqual({ shadow: 0, nonShadow: 0 });
    expect(evict).toHaveBeenCalledWith([]);
    h.dispose();                                                  // second call: no-op
    expect(evict).toHaveBeenCalledTimes(1);
    rig.dispose(); lib.disposeAll();
  });

  it('never disposes a library Material or Texture directly (only the library evicts its sets)', async () => {
    const lib = await mockLibrary();
    const spec = syntheticSpec(9);
    await lib.preload(zoneSurfaces(spec));
    const noEvict: ZoneBuildDeps = { materials: { get: (id) => lib.get(id), preload: (ids) => lib.preload(ids), preloadHero: async () => {}, evictExcept: () => {} }, lighting: null, scene: null };
    const h = buildZone(spec, noEvict);
    const r = await countDisposals(() => h.dispose());
    expect(r.materials).toBe(0);
    expect(r.textures).toBe(0);
    lib.disposeAll();
  });

  it('builds only BufferGeometry (no stock primitives) and binds only library materials (≤ 32 on the slice)', async () => {
    const lib = await mockLibrary();
    for (const id of ['mirevale', 'mire_route'] as const) {
      const spec = realSpec(id);
      await lib.preload(zoneSurfaces(spec));
      const h = buildZone(spec, deps(lib, null, null));
      const mats = new Set<string>();
      h.group.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        expect(o.geometry.type).toBe('BufferGeometry');
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          expect(lib.describe(m)).not.toBeNull();
          mats.add(m.uuid);
        }
      });
      expect(mats.size).toBeLessThanOrEqual(32);
      h.dispose();
    }
    lib.disposeAll();
  });
});

describe('§10.5.9 leak (node, mock GPU bookkeeping)', () => {
  it('100 load/unload cycles return geometries, attributes, textures, programs and render objects to baseline exactly', async () => {
    const gpu = new MockGpu();
    const lib = await mockLibrary(gpu);
    const scene = new Scene();
    const rig = new LightRig(scene);
    gpu.render(scene);
    const base = gpu.memory();
    const spec = syntheticSpec(21);
    let digest: string | null = null;
    for (let i = 0; i < 100; i++) {
      const h = await loadZone(spec, deps(lib, rig, scene));
      gpu.render(scene);
      if (i === 0) {
        const m = gpu.memory();
        expect(m.geometries).toBeGreaterThan(base.geometries);
        expect(m.textures).toBeGreaterThan(base.textures);
        digest = h.geometryDigest;
      } else expect(h.geometryDigest).toBe(digest);
      h.dispose();
      expect(gpu.memory()).toEqual(base);
    }
    rig.dispose(); lib.disposeAll();
  }, 120_000);

  it('mirevale and mire_route unload to baseline exactly (2 cycles each, identical digests)', async () => {
    const gpu = new MockGpu();
    const lib = await mockLibrary(gpu);
    const scene = new Scene();
    const rig = new LightRig(scene);
    gpu.render(scene);
    const base = gpu.memory();
    for (const id of ['mirevale', 'mire_route'] as const) {
      const spec = realSpec(id);
      const digests: string[] = [];
      for (let i = 0; i < 2; i++) {
        const h = await loadZone(spec, deps(lib, rig, scene));
        gpu.render(scene);
        digests.push(h.geometryDigest);
        h.dispose();
        expect(gpu.memory()).toEqual(base);
      }
      expect(digests[0]).toBe(digests[1]);
    }
    rig.dispose(); lib.disposeAll();
  }, 120_000);
});
