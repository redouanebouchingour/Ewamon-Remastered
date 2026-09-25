/**
 * SPEC §20.4.4 — `zoneSpecFor` is pure: the same (zone, harvest) gives a byte-identical ZoneSpec (all 21 zones × 3
 * harvest states, compared by a canonical digest and against a committed snapshot), and the seeded decisions hold
 * their invariants (server gym door, light budget, authored points never covered, edges at the interior midpoints).
 */
import { describe, expect, it } from 'vitest';
import { allZones, getHeightfield, isWalkable, type HarvestState } from '@ewa/content';
import { INTERIOR_SIZE, LIGHT_BUDGET, SET_PIECE_EXTENT, doorOf, footprintDistance, type ZoneSpec } from '@ewa/render';
import { SET_PIECE_BY_ZONE, zoneSpecFor } from '../src/scene/zoneSpecFor';

const HARVESTS: readonly HarvestState[] = ['intact', 'thinning', 'harvested'];

/** Canonical JSON of everything but the heightfield object (which is content's, passed through by identity). */
function canonical(s: ZoneSpec): string {
  const { heightfield, ...rest } = s;
  return JSON.stringify({ ...rest, heightfield: heightfield.digest });
}

function fnv(s: string): string {
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < s.length; i++) { h = (h ^ s.charCodeAt(i)) | 0; h = Math.imul(h, 0x01000193) | 0; }
  return (h >>> 0).toString(16).padStart(8, '0');
}

describe('§20.4.4 zoneSpecFor', () => {
  it('is deterministic for all 21 zones × 3 harvest states (and matches the committed snapshot)', () => {
    const digests: Record<string, string> = {};
    for (const z of allZones()) {
      for (const h of HARVESTS) {
        const a = zoneSpecFor(z, h);
        const b = zoneSpecFor(z, h);
        expect(canonical(a)).toBe(canonical(b));
        expect(a.heightfield).toBe(getHeightfield(z.id));                 // passed through unchanged
        digests[`${z.id}:${h}`] = fnv(canonical(a));
      }
    }
    expect(Object.keys(digests)).toHaveLength(63);
    expect(digests).toMatchSnapshot();
  });

  it('maps the table fields', () => {
    for (const z of allZones()) {
      const s = zoneSpecFor(z, 'thinning');
      expect(s.id).toBe(z.id);
      expect(s.seed).toBe(z.layoutSeed >>> 0);
      expect(s.biome).toBe(z.biome);
      expect(s.generators).toBe(z.biome);
      expect(s.palette).toBe(z.palette);
      expect(s.layout).toBe(z.kind);
      expect(s.size).toEqual({ w: INTERIOR_SIZE[z.kind], d: INTERIOR_SIZE[z.kind] });
      expect(s.setPiece).toBe(SET_PIECE_BY_ZONE[z.id]);
      expect(s.harvestLevel).toBe(1);
      expect(s.accentType).toBe(z.type);
      expect(s.tallGrass).toBe(z.encounterTable !== null);
      expect(s.actors.length).toBe(z.npcs.length + z.trainers.length);
      expect(s.pickups.map((p) => p.id)).toEqual(z.items.map((i) => i.id));
      expect(s.tablets.map((t) => t.id)).toEqual(z.lore.map((l) => l.id));
      expect(s.warps.length).toBe(z.warps.length * 2);
      const half = INTERIOR_SIZE[z.kind] / 2;
      for (const [d, to] of Object.entries(z.links)) {
        const e = s.edges[d as 'n' | 'e' | 's' | 'w']!;
        expect(e.toZone).toBe(to);
        expect(Math.max(Math.abs(e.x), Math.abs(e.z))).toBe(half);
      }
    }
    expect(new Set(Object.values(SET_PIECE_BY_ZONE)).size).toBe(21);
    expect(zoneSpecFor(allZones()[0]!, 'intact').harvestLevel).toBe(0);
    expect(zoneSpecFor(allZones()[0]!, 'harvested').harvestLevel).toBe(2);
  });

  it('puts every gym door at the server door (0, −26), keeps authored points clear and lights within budget', () => {
    for (const z of allZones()) {
      const s = zoneSpecFor(z, 'intact');
      const gym = s.buildings.filter((b) => b.kind === 'gym');
      expect(gym.length).toBe(z.gym !== null ? 1 : 0);
      for (const g of gym) {
        const d = doorOf(g);
        expect(d.x).toBeCloseTo(0, 6);
        expect(d.z).toBeCloseTo(-26, 6);
      }
      if (z.kind === 'town') {
        expect(s.buildings.length).toBeGreaterThanOrEqual(z.gym ? 6 : 4);
        expect(s.buildings.length).toBeLessThanOrEqual(10 + z.warps.length);
      }
      const points = [...s.actors, ...s.pickups, ...s.tablets];
      for (const b of s.buildings) for (const p of points) expect(footprintDistance(b, p.x, p.z)).toBeGreaterThan(2);
      const shadow = s.lights.filter((l) => l.castShadow).length;
      expect(shadow).toBeLessThanOrEqual(LIGHT_BUDGET.shadowCasters - 2);   // 2 arena beacons stay free
      expect(s.lights.length - shadow).toBeLessThanOrEqual(LIGHT_BUDGET.nonShadow);
      expect(new Set(s.lights.map((l) => l.id)).size).toBe(s.lights.length);
      for (const l of s.lights) for (const p of points) expect(Math.hypot(l.position[0] - p.x, l.position[2] - p.z)).toBeGreaterThan(1);
      // set-piece extents never cover an authored point that must stay reachable
      const ext = SET_PIECE_EXTENT[s.setPiece];
      const spX = 0; const spZ = s.layout === 'route' ? null : 0;
      if (spZ !== null) for (const p of points) expect(Math.abs(p.x - spX) < ext.hw * 0.5 && Math.abs(p.z - spZ) < ext.hd * 0.5).toBe(false);
    }
  });

  it('builds a WaterSpec from the largest heightfield water body when there is water', () => {
    const mv = zoneSpecFor(allZones().find((z) => z.id === 'mirevale')!, 'intact');
    expect(mv.water).not.toBeNull();
    expect(mv.water!.kind).toBe('pond');
    expect(mv.water!.polygon).toHaveLength(16);
    const h = mv.heightfield;
    // the polygon's centroid is not walkable open water
    const cx = mv.water!.polygon.reduce((a, p) => a + p[0], 0) / 16; const cz = mv.water!.polygon.reduce((a, p) => a + p[1], 0) / 16;
    expect(isWalkable(h, cx + 0.001, cz - 3)).toBe(false);
  });
});
