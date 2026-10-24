/**
 * Camp bases (§10.7.10): a camp's banner and one prebuilt object per trophy kind per slot, from the set's own prop
 * builders; all hidden until the handle shows the banner and one kind per slot; walk-through (the collider is the same
 * as without the camp), and a free camp shows nothing again.
 */
import { describe, expect, it } from 'vitest';
import { Box3 } from 'three/webgpu';
import { TROPHY_KINDS, buildCampBanner, buildTrophy } from '../src/zone/generators/trophies.js';
import { BIOME_GENERATORS } from '../src/zone/generators/index.js';

describe('trophy pieces', () => {
  it('every kind builds from the set, each its own silhouette; the banner stands about 3.5 m tall', () => {
    const st = BIOME_GENERATORS.grove.props;
    const heights = new Map<string, number>();
    for (const kind of TROPHY_KINDS) {
      const pieces = buildTrophy(st, kind, 7);
      expect(pieces.length).toBeGreaterThan(0);
      const g = pieces[0]!.geo.lod0;
      g.computeBoundingBox();
      heights.set(kind, Math.round(g.boundingBox!.max.y * 10) / 10);
      for (const p of pieces) for (const l of [p.geo.lod0, p.geo.lod1, p.geo.lod2]) expect(l.getAttribute('position').count).toBeGreaterThan(0);
    }
    expect(buildTrophy(st, 'bounty', 7)).toHaveLength(2);
    const banner = buildCampBanner(st, 3).lod0;
    banner.computeBoundingBox();
    expect(banner.boundingBox!.max.y).toBeGreaterThan(3.3);
    expect(new Set(heights.values()).size).toBeGreaterThanOrEqual(4);
  });
});

describe('camps in the zone builder', () => {
  it('hidden until held; the handle shows the banner and one trophy per slot; walk-through', async () => {
    const { buildZone } = await import('../src/zone/builder.js');
    const { mockLibrary, realSpec } = await import('./zone-helpers.js');
    const lib = await mockLibrary();
    const base = realSpec('mire_route');
    const slots = [
      { x: 47.6, z: -22.5, yaw: -1 },
      { x: 44.2, z: -17.2, yaw: 2.6 },
      { x: 40.2, z: -21.1, yaw: 1.2 },
    ];
    const spec = { ...base, camps: [{ id: 'mire_route', banner: { x: 41, z: -22.5, yaw: 0.8 }, slots }] };
    const z = buildZone(spec, { materials: lib, lighting: null, scene: null });
    const plain = buildZone(base, { materials: lib, lighting: null, scene: null });
    expect(plain.camps).toBeUndefined();
    expect(z.geometryDigest).not.toBe(plain.geometryDigest);
    const c = z.camps!;
    expect(c.ids).toEqual(['mire_route']);
    const banner = z.group.getObjectByName('ewa:camp:mire_route:banner')!;
    const legend0 = z.group.getObjectByName('ewa:camp:mire_route:0:legend')!;
    const bounty2 = z.group.getObjectByName('ewa:camp:mire_route:2:bounty')!;
    expect(banner.visible || legend0.visible || bounty2.visible).toBe(false);
    expect(legend0.position.x).toBeCloseTo(47.6, 3);
    expect(legend0.position.y).toBeCloseTo(z.collider.sample(47.6, -22.5) - 0.04, 1);
    expect(c.shown('mire_route')).toEqual({ banner: false, trophies: [null, null, null] });

    c.set('mire_route', { trophies: ['legend', null, 'bounty'] });
    expect(banner.visible && legend0.visible && bounty2.visible).toBe(true);
    expect(z.group.getObjectByName('ewa:camp:mire_route:0:medal')!.visible).toBe(false);
    expect(c.shown('mire_route')).toEqual({ banner: true, trophies: ['legend', null, 'bounty'] });
    const box = new Box3().setFromObject(bounty2);
    expect(box.max.y - box.min.y).toBeGreaterThan(1.2);

    c.set('mire_route', { trophies: ['scar'] });
    expect(legend0.visible).toBe(false);
    expect(z.group.getObjectByName('ewa:camp:mire_route:0:scar')!.visible).toBe(true);
    expect(bounty2.visible).toBe(false);
    c.set('nope', { trophies: ['medal'] });
    c.set('mire_route', null);
    expect(banner.visible).toBe(false);
    expect(c.shown('mire_route')).toEqual({ banner: false, trophies: [null, null, null] });
    expect(c.shown('nope')).toBeNull();

    // walk-through: the slots move the same with and without the camp
    for (const s of slots) expect(z.collider.walkable(s.x, s.z)).toBe(plain.collider.walkable(s.x, s.z));
    z.dispose();
    plain.dispose();
  }, 120_000);
});
