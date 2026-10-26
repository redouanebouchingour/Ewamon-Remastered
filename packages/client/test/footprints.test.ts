/**
 * Audit R1 — client prediction and server truth agree on every footprint.
 *
 * Content's zone plan owns the solid footprints and `getHeightfield` stamps them into `walkable`; the zone builder
 * still places the visible scatter (trunks, willows, big rocks) itself and registers each footprint's shape on the
 * collider (`addFootprint`, for shape queries such as the battle camera's occluders). This test builds all 21 zones
 * from `zoneSpecFor` and asserts the builder's footprints are content's `plan.solids`, in order and exactly — so the
 * trees and houses the player sees are the ones the server refuses to let them walk through — and that the built
 * collider's `passable` is content's `isWalkable` (no client-only blockers). Phase A: town pockets drop the scatter centred
 * in them and register their own wall footprints.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Texture } from 'three/webgpu';
import { allZones, getZoneSurface, hideoutBounds, hideoutsFor, inFootprint, isWalkable, zonePlan } from '@ewa/content';
import { createRng } from '@ewa/core';
import { buildZone, createMaterialLibraryWith, SURFACE_IDS } from '@ewa/render';
import type { MaterialLibrary } from '@ewa/render';
import { zoneSpecFor } from '../src/scene/zoneSpecFor';

let warn: ReturnType<typeof vi.spyOn>;
beforeAll(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); return () => warn.mockRestore(); });

/** A material library over placeholder textures (no GPU, no fetch): enough for a node build. */
async function nodeLibrary(): Promise<MaterialLibrary> {
  const surfaces = Object.fromEntries(SURFACE_IDS.map((id) => [id, {
    field: { albedo: `${id}.a`, orm: `${id}.o`, normal: `${id}.n`, size: 512, bytes: 3000 }, hero: null, metres: 2, wrap: 'repeat', hash: id, albedoClampedPct: 0,
  }]));
  const lib = createMaterialLibraryWith({
    baseUrl: '/m/',
    source: { load: async () => new Texture() },
    fetchJson: async () => ({ version: 2, surfaces, byBiome: {}, placeholder: { albedo: 'p.a', orm: 'p.o', normal: 'p.n' }, fieldBytes: 0, heroBytes: 0, totalBytes: 0 }),
  });
  await lib.ready;
  return lib;
}

describe('R1: the builder draws exactly the footprints content stamps', () => {
  it("all 21 zones: collider footprints = content's plan.solids (order and values); passable = isWalkable", async () => {
    const lib = await nodeLibrary();
    for (const z of allZones()) {
      const spec = zoneSpecFor(z, 'intact');
      const plan = zonePlan(z.id);
      const handle = buildZone(spec, { materials: lib, lighting: null, scene: null });
      const c = handle.collider;
      // Phase A: scatter centred in a town pocket is dropped (content and render alike), and each pocket registers its
      // own walls — outside the pockets the builder's footprints are content's solids, in order and exactly
      const surface = getZoneSurface(z.id);
      const dropped = new Set(surface.interiorPlan.droppedSolids);
      const inPocket = (x: number, zz: number): boolean => surface.interiors.some((p) => inFootprint(p, x, zz));
      // a hideout building (content data/hideouts.ts) is drawn and collides too, but content stamps it outside the plan
      const inHideout = (x: number, zz: number): boolean => hideoutsFor(z.id).some((h) => { const b = hideoutBounds(h); return Math.abs(x - b.x) <= b.hw && Math.abs(zz - b.z) <= b.hd; });
      const shapes = c.footprintShapes();
      expect(shapes.filter((s) => !inPocket(s.x, s.z) && !inHideout(s.x, s.z)), `${z.id}: builder footprints vs content solids`).toEqual(plan.solids.filter((_, i) => !dropped.has(i)).map((s) => s.shape));
      for (const p of surface.interiors) {
        const walls = shapes.filter((s) => inFootprint(p, s.x, s.z)).length;
        expect(walls, `${z.id}: ${p.def.id} wall footprints`).toBeGreaterThanOrEqual(4);   // the 4 outer walls (low walls such as water channels need no occluder shape)
      }
      expect(c.blockerCount(), z.id).toBe(0);
      // prediction samples what the server validates
      const rng = createRng(`r1:${z.id}`);
      const h = spec.heightfield;
      for (let i = 0; i < 4000; i++) {
        const x = h.originX + rng.next() * h.size; const zz = h.originZ + rng.next() * h.size;
        expect(c.passable(x, zz)).toBe(isWalkable(h, x, zz));
      }
      // the shapes stay queryable (SceneDirector's occluder scoring): every solid's centre is `blocked`
      plan.solids.forEach((s, i) => { if (!dropped.has(i)) expect(c.blocked(s.shape.x, s.shape.z)).toBe(true); });
      handle.dispose();
    }
  }, 240_000);
});
