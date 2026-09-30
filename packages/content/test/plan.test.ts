/**
 * Audit R1 — the zone plan is content's (`plan.ts`), and `buildHeightfield` stamps its footprints into `walkable`.
 *
 * Identity: `fixtures/r1-pre-move.json` was captured from the render layout planners, the client adapter and the
 * zone builder at HEAD 689fd78, BEFORE the plan moved here (digests of every layout field, the door paths, props,
 * light positions and the ordered list of every collider blocker the builder registered; the building records in
 * full). Content's plan must reproduce all of it for all 21 zones — the rendered villages are unchanged — with one
 * deliberate addition: fence runs are solid now (render drew them walk-through).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fnv1a32 } from '@ewa/core';
import {
  LEGENDARY_STATICS,
  RAID_HOTSPOTS,
  ZONES,
  buildZoneSurface,
  buildingFootprints,
  doorOf,
  getHeightfield,
  getZoneSurface,
  isWalkable,
  roadZAt,
  solidContains,
  waterBodies,
  zonePlan,
} from '../src/index';
import type { Heightfield, Solid } from '../src/index';

interface FixtureZone {
  readonly terrainWalkable: number;
  readonly buildings: readonly unknown[];
  readonly counts: { readonly props: number; readonly lights: number; readonly blockers: number };
  readonly layout: Readonly<Record<string, string>>;
  readonly doorPaths: string;
  readonly props: string;
  readonly lightPositions: string;
  readonly blockers: string;
}
const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/r1-pre-move.json', import.meta.url), 'utf8')) as { readonly zones: Readonly<Record<string, FixtureZone>> };
const digest = (v: unknown): string => fnv1a32(JSON.stringify(v)).toString(16).padStart(8, '0');

function samplesIn(h: Heightfield, s: Solid, fn: (i: number, x: number, z: number) => void): void {
  const r = s.kind === 'circle' ? s.r : Math.hypot(s.hw, s.hd);
  for (let row = Math.max(0, Math.ceil((s.z - r - h.originZ) / h.step)); row <= Math.min(h.res - 1, Math.floor((s.z + r - h.originZ) / h.step)); row++) {
    for (let col = Math.max(0, Math.ceil((s.x - r - h.originX) / h.step)); col <= Math.min(h.res - 1, Math.floor((s.x + r - h.originX) / h.step)); col++) {
      const x = h.originX + col * h.step; const z = h.originZ + row * h.step;
      if (solidContains(s, x, z)) fn(row * h.res + col, x, z);
    }
  }
}

describe('R1 zone plan (content)', () => {
  it('reproduces the pre-move render layout for all 21 zones: layout, door paths, buildings, props, lights, footprints', () => {
    expect(Object.keys(FIXTURE.zones)).toHaveLength(21);
    for (const z of ZONES) {
      const f = FIXTURE.zones[z.id]!;
      const p = zonePlan(z.id);
      const roadZ: number[] = [];
      for (let x = -130; x <= 130; x += 0.5) roadZ.push(roadZAt(p.roadMeander, x));
      expect({
        half: digest(p.half), interior: digest(p.interior), plaza: digest(p.plaza), roads: digest(p.roads), grassPatches: digest(p.grassPatches),
        clearings: digest(p.clearings), setPiece: digest(p.setPiece), points: digest(p.points), warpPairs: digest(p.warpPairs), water: digest(p.water),
        roadZ: digest(roadZ),
      }, z.id).toEqual(f.layout);
      expect(digest(p.doorPaths), `${z.id} door paths`).toBe(f.doorPaths);
      expect(p.buildings, `${z.id} buildings`).toEqual(f.buildings);
      expect(p.props.length).toBe(f.counts.props);
      expect(digest(p.props), `${z.id} props`).toBe(f.props);
      expect(p.lights.length).toBe(f.counts.lights);
      expect(digest(p.lights.map((l) => [l.id, l.x, l.z, l.castShadow, l.seed])), `${z.id} lights`).toBe(f.lightPositions);
      const fences = p.solids.filter((s) => s.source === 'prop' && s.ref.startsWith('fence#'));
      const before = p.solids.filter((s) => !fences.includes(s)).map((s) => s.shape);
      expect(before.length, `${z.id} footprints`).toBe(f.counts.blockers);
      expect(digest(before), `${z.id} footprints = the builder's pre-move blockers, in order`).toBe(f.blockers);
      // the deliberate addition: every fence run is solid
      expect(fences.length).toBe(p.props.filter((q) => q.kind === 'fence').length);
    }
  });

  it('every building has a footprint (walls + plinth + capsule) and a door approach in front of its door', () => {
    let towns = 0;
    for (const z of ZONES) {
      const p = zonePlan(z.id);
      const fp = buildingFootprints(p);
      expect(fp).toHaveLength(p.buildings.length);
      for (const { building: b, footprint, door } of fp) {
        expect(footprint).toMatchObject({ kind: 'rect', x: b.x, z: b.z, yaw: b.yaw });
        expect(footprint.hw).toBeCloseTo(b.w / 2 + 0.47, 9);
        expect(footprint.hd).toBeCloseTo(b.d / 2 + 0.47, 9);
        expect(door.door).toEqual(doorOf(b));
        // the approach starts where the footprint ends (plinth 0.12 + capsule 0.35) and runs 1.2 m out
        expect(solidContains(door.approach, door.door.x + door.door.nx * 1.0, door.door.z + door.door.nz * 1.0)).toBe(true);
        expect(solidContains(door.approach, door.door.x + door.door.nx * 0.3, door.door.z + door.door.nz * 0.3)).toBe(false);
        expect(solidContains(footprint, door.door.x + door.door.nx * 0.3, door.door.z + door.door.nz * 0.3)).toBe(true);
      }
      if (z.kind === 'town') {
        towns++;
        if (z.gym !== null) {
          const gym = p.buildings.find((b) => b.kind === 'gym')!;
          const d = doorOf(gym);
          expect([d.x, d.z].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0, -26]);   // the server's league marker
        }
      }
    }
    expect(towns).toBe(9);                                                   // 8 gym towns + solenne
  });

  it('stamps every footprint sample walkable = 0 (water and door approaches excepted) and leaves the rest of the terrain alone', () => {
    for (const z of ZONES) {
      const s = getZoneSurface(z.id);
      const h = s.heightfield;
      const f = FIXTURE.zones[z.id]!;
      expect(s.footprints.baseWalkable / h.walkable.length, `${z.id} terrain walkable (pre-move ratio)`).toBe(f.terrainWalkable);
      let walk = 0;
      for (let i = 0; i < h.walkable.length; i++) walk += h.walkable[i]!;
      expect(s.footprints.baseWalkable - walk).toBe(s.footprints.stamped);
      expect(s.footprints.stamped).toBeGreaterThan(1000);
      const approach = new Uint8Array(h.walkable.length);
      for (const d of s.plan.doors) samplesIn(h, d.approach, (i) => { approach[i] = 1; });
      for (const solid of s.plan.solids) {
        samplesIn(h, solid.shape, (i, x, zz) => {
          if (h.water[i] === 1 || approach[i] === 1) return;
          expect(h.walkable[i], `${z.id} ${solid.source} ${solid.ref} sample (${x}, ${zz})`).toBe(0);
        });
      }
      // footprints never touch a water sample, so the water bodies render derives are content's exactly
      expect(s.footprints.waterSkipped).toBe(0);
      expect(waterBodies(h)).toEqual(s.plan.water);
    }
  });

  it('door approaches: walkable in front of every door unless the terrain itself is not', () => {
    for (const z of ZONES) {
      const s = getZoneSurface(z.id);
      const h = s.heightfield;
      for (const d of s.plan.doors) {
        let inside = 0; let walkable = 0;
        samplesIn(h, d.approach, (i) => { inside++; walkable += h.walkable[i]!; });
        expect(inside, `${z.id} ${d.building}`).toBeGreaterThan(0);
        expect(walkable, `${z.id} ${d.building} approach`).toBeGreaterThan(0);
        // 1 m straight out from the door is standable ground
        expect(isWalkable(h, d.door.x + d.door.nx * 1.0, d.door.z + d.door.nz * 1.0), `${z.id} ${d.building} door step`).toBe(true);
      }
    }
  });

  it('is deterministic: a second build gives the same plan and digest, and getHeightfield carries zonePlan', () => {
    for (const id of ['mirevale', 'mire_route', 'solenne'] as const) {
      const z = ZONES.find((x) => x.id === id)!;
      const a = buildZoneSurface(z);
      const b = buildZoneSurface(z);
      expect(a.heightfield.digest).toBe(b.heightfield.digest);
      expect(JSON.stringify(a.plan)).toBe(JSON.stringify(b.plan));
      expect(a.heightfield.digest).toBe(getHeightfield(id).digest);
      expect(JSON.stringify(zonePlan(id))).toBe(JSON.stringify(a.plan));
    }
    expect(zonePlan('mirevale')).toBe(getZoneSurface('mirevale').plan);
  });

  it('statics and raid hotspots inside a footprint snap ≤ 0.5 m (galvan_route voltaura sits in a boulder)', () => {
    const covered: string[] = [];
    for (const s of LEGENDARY_STATICS) {
      const surf = getZoneSurface(s.zoneId);
      if (isWalkable(surf.heightfield, s.x, s.z)) continue;
      const inSolid = surf.plan.solids.some((q) => solidContains(q.shape, Math.round(s.x * 2) / 2, Math.round(s.z * 2) / 2));
      if (inSolid) covered.push(`${s.zoneId} ${s.species}`);
    }
    for (const r of RAID_HOTSPOTS) {
      const surf = getZoneSurface(r.zoneId);
      if (!isWalkable(surf.heightfield, r.x, r.z) && surf.plan.solids.some((q) => solidContains(q.shape, Math.round(r.x * 2) / 2, Math.round(r.z * 2) / 2))) covered.push(`${r.zoneId} ${r.id}`);
    }
    expect(covered).toEqual(['galvan_route voltaura']);
  });
});
