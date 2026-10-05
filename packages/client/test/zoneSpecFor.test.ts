/**
 * SPEC §20.4.4 — `zoneSpecFor` is pure: the same (zone, harvest) gives a byte-identical ZoneSpec (all 21 zones × 3
 * harvest states, compared by a canonical digest and against a committed snapshot), and the seeded decisions hold
 * their invariants (server gym door, light budget, authored points never covered, edges at the interior midpoints).
 *
 * Audit R1: the layout, buildings, lights and props are content's zone plan now. The snapshot was re-baselined for
 * exactly two fields — `heightfield` (its digest: footprints are stamped into `walkable`) and the new `plan` — and
 * the test below proves every other field is byte-identical to the adapter's output before the move
 * (`packages/content/test/fixtures/r1-pre-move.json`, captured at HEAD 689fd78).
 *
 * Phase A: the snapshot was re-baselined for the new `interiors` field (content's pockets, flattened), which the R1
 * comparison excludes like `plan`. Solenne's plan changed deliberately (the league hall stands in its gym slot, its
 * stale `league_hall` warp is gone, two Act III NPCs moved to the hall door), so the fixture's Solenne `specFields`
 * were re-captured (see the fixture's `about`); the other 20 zones are byte-identical to the pre-move capture.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fnv1a32 } from '@ewa/core';
import { LEAGUE, allZones, getHeightfield, interiorWarps, interiorsFor, isWalkable, zonePlan, type HarvestState } from '@ewa/content';
import { INTERIOR_SIZE, LIGHT_BUDGET, SET_PIECE_EXTENT, doorOf, footprintDistance, layoutOf, planLayout, type ZoneSpec } from '@ewa/render';
import { SET_PIECE_BY_ZONE, zoneSpecFor } from '../src/scene/zoneSpecFor';

const HARVESTS: readonly HarvestState[] = ['intact', 'thinning', 'harvested'];
const PRE_MOVE = JSON.parse(readFileSync(new URL('../../content/test/fixtures/r1-pre-move.json', import.meta.url), 'utf8')) as {
  readonly zones: Readonly<Record<string, { readonly specFields: Readonly<Record<string, string>>; readonly heightfieldDigest: string }>>;
};
const fieldDigest = (v: unknown): string => fnv1a32(JSON.stringify(v)).toString(16).padStart(8, '0');

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

  it('R1: every field but heightfield, the new plan and the Phase A interiors is byte-identical to the pre-move adapter output (all 21 zones)', () => {
    for (const z of allZones()) {
      const s = zoneSpecFor(z, 'intact');
      const before = PRE_MOVE.zones[z.id]!;
      const { heightfield, plan, interiors: _interiors, ...rest } = s;
      const now: Record<string, string> = {};
      for (const [k, v] of Object.entries(rest)) now[k] = fieldDigest(v);
      expect(now, z.id).toEqual(before.specFields);
      // the two intended changes: the field now carries the plan's footprints, and the plan itself travels along
      expect(heightfield.digest).not.toBe(before.heightfieldDigest);
      expect(plan).toBeDefined();
    }
  });

  it("R1: spec.plan / buildings / props / lights are content's zonePlan, passed through", () => {
    for (const z of allZones()) {
      const s = zoneSpecFor(z, 'intact');
      const p = zonePlan(z.id);
      expect(s.plan).toEqual({
        plaza: p.plaza, roads: p.roads, doorPaths: p.doorPaths, roadMeander: p.roadMeander, grassPatches: p.grassPatches,
        clearings: p.clearings, setPiece: p.setPiece, points: p.points, warpPairs: p.warpPairs,
      });
      expect(s.plan.setPiece.id).toBe(s.setPiece);
      expect(s.buildings).toEqual(p.buildings);
      expect(s.props).toEqual(p.props);
      expect(s.lights.map((l) => [l.id, l.position[0], l.position[2], l.castShadow])).toEqual(p.lights.map((l) => [l.id, l.x, l.z, l.castShadow]));
      // the builder's view: water bodies from the stamped field equal the plan's (footprints never touch water)
      expect(layoutOf(s).water).toEqual(p.water);
      // the render planner the capture harness still calls equals content's plan
      const { doorPaths: _a, roadZ: legacyZ, ...legacy } = planLayout(s);
      const { doorPaths: _b, roadZ, ...now } = layoutOf(s);
      expect(legacy, z.id).toEqual(now);
      for (let x = -120; x <= 120; x += 7.3) expect(legacyZ(x)).toBe(roadZ(x));
    }
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
      // a gym town's gym, or Solenne's league hall (Phase A: it stands in the gym slot)
      const league = LEAGUE.some((l) => l.zoneId === z.id && l.stage !== 'gym');
      expect(gym.length).toBe(z.gym !== null || league ? 1 : 0);
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
      // ≥ 2 m (Phase A: Solenne's lectern stands exactly 2 m in front of the league hall, which now fills the gym slot)
      for (const b of s.buildings) for (const p of points) expect(footprintDistance(b, p.x, p.z)).toBeGreaterThanOrEqual(2);
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

  it("Phase A: spec.interiors is content's pockets flattened (deterministic); pocket door warps stay out of spec.warps", () => {
    for (const z of allZones()) {
      const s = zoneSpecFor(z, 'intact');
      const pockets = interiorsFor(z.id);
      expect(s.interiors).toBeDefined();
      expect(JSON.stringify(s.interiors)).toBe(JSON.stringify(zoneSpecFor(z, 'harvested').interiors));
      expect(s.interiors!.map((i) => i.id)).toEqual(pockets.map((p) => p.def.id));
      if (z.kind !== 'town') expect(s.interiors).toEqual([]);
      const ids = new Set(s.warps.map((w) => w.id));
      for (const w of interiorWarps(z.id)) {
        expect(ids.has(w.id), w.id).toBe(false);
        expect(ids.has(`${w.id}:to`), w.id).toBe(false);
      }
      for (const [k, spec] of s.interiors!.entries()) {
        const p = pockets[k]!;
        expect(spec).toMatchObject({ building: p.def.building, template: p.def.template, theme: p.def.theme, x: p.at.x, z: p.at.z, yaw: p.at.yaw, floorY: p.at.floorY, w: p.def.w, d: p.def.d });
        expect(spec.footprint).toEqual({ x: p.footprint.x, z: p.footprint.z, hw: p.footprint.hw, hd: p.footprint.hd });
        expect(spec.gates).toEqual(p.def.gates.map((g) => ({ ...g.rect, id: g.id, style: g.style })));
        expect(spec.switches.map((x) => x.id)).toEqual(p.def.switches.map((x) => x.id));
        expect(spec.rooms.map((r) => r.leaderAt)).toEqual(p.def.rooms.map((r) => r.leaderAt));
        expect(spec.props).toEqual(p.def.props);
        expect(spec.walls).toEqual(p.def.walls);
      }
    }
    expect(zoneSpecFor(allZones().find((z) => z.id === 'mirevale')!, 'intact').interiors!.some((i) => i.template === 'gym_hall')).toBe(true);
    expect(zoneSpecFor(allZones().find((z) => z.id === 'solenne')!, 'intact').interiors!.some((i) => i.template === 'league_hall')).toBe(true);
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
