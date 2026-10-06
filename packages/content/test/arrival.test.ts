/**
 * Town arrival point (`src/arrival.ts`): fast travel, the escape rope and a fallback join land on the plaza of a
 * town (Mirevale keeps its spawn), every other zone on its spawn; the spawn itself — an authored point the heightfield
 * builds its clearings and ponds around — does not move.
 */
import { describe, expect, it } from 'vitest';
import type { ZoneId } from '../src/index';
import {
  ARRIVAL_CLEARANCE_M,
  LEGENDARY_STATICS,
  RAID_HOTSPOTS,
  ZONES,
  arrivalPoint,
  arrivalPointFor,
  getZoneSurface,
  inFootprint,
  isWalkable,
  solidContains,
  walkableComponent,
  zonePlan,
} from '../src/index';
import { warpsOf } from '../src/interiors';

/** The committed arrival of each town (x, z on the 0.5 m sample grid; facing in rad to 1e-4). */
const TOWN_ARRIVALS: Readonly<Record<string, readonly [number, number, number]>> = {
  mirevale: [0, 6, -3.1416],
  cinderhold: [5.5, 9.5, -2.6168],
  saltmourn: [5.5, 9.5, -2.6168],
  stormrook: [0, 11, -3.1416],
  marrowdig: [0, 11, -3.1416],
  vesperveil: [5.5, 9.5, -2.6168],
  forgewall: [5.5, 9.5, -2.6168],
  skyrend: [5.5, 9.5, -2.6168],
  solenne: [5.5, 9.5, -2.6168],
};

const towns = ZONES.filter((z) => z.kind === 'town');

describe('arrivalPoint', () => {
  it('pins every town arrival; Mirevale keeps its spawn (0, 6) exactly', () => {
    expect(towns.map((z) => z.id).sort()).toEqual(Object.keys(TOWN_ARRIVALS).sort());
    for (const z of towns) {
      const a = arrivalPoint(z.id);
      const [x, zz, angle] = TOWN_ARRIVALS[z.id]!;
      expect([a.x, a.z], z.id).toEqual([x, zz]);
      expect(a.angle, z.id).toBeCloseTo(angle, 4);
    }
    const m = arrivalPoint('mirevale');
    expect(m).toMatchObject({ x: 0, z: 6, rule: 'spawn' });
  });

  it('the spawns stay where they were (the heightfield seeds its clearings and ponds around them)', () => {
    const spawns = Object.fromEntries(ZONES.map((z) => [z.id, [z.spawn.x, z.spawn.z]]));
    expect(spawns['mirevale']).toEqual([0, 6]);
    for (const id of ['cinderhold', 'stormrook', 'marrowdig', 'vesperveil', 'forgewall', 'skyrend', 'solenne']) expect(spawns[id], id).toEqual([-50, 0]);
    expect(spawns['saltmourn']).toEqual([-50, -6]);
  });

  it('a town arrival is on the plaza, walkable with its 8 neighbours, reachable from the spawn, clear of pockets, solids, the set-piece and authored points, and faces the plaza centre', () => {
    for (const z of towns) {
      if (z.id === 'mirevale') continue;
      const s = getZoneSurface(z.id);
      const h = s.heightfield;
      const plaza = s.plan.plaza!;
      const a = arrivalPoint(z.id);
      expect(a.rule, z.id).toMatch(/^plaza ring -?\d+°$/);
      expect(Math.hypot(a.x - plaza.x, a.z - plaza.z), z.id).toBeLessThanOrEqual(plaza.r);
      const reach = walkableComponent(h, z.spawn.x, z.spawn.z);
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const i = Math.round((a.z + dz * h.step - h.originZ) / h.step) * h.res + Math.round((a.x + dx * h.step - h.originX) / h.step);
          expect(h.walkable[i], `${z.id} (${dx}, ${dz})`).toBe(1);
          expect(reach[i], `${z.id} (${dx}, ${dz})`).toBe(1);
        }
      }
      expect(s.interiors.some((p) => inFootprint(p, a.x, a.z)), z.id).toBe(false);
      expect(s.plan.solids.some((q) => solidContains(q.shape, a.x, a.z)), z.id).toBe(false);
      const sp = s.plan.setPiece;
      expect(Math.abs(a.x - sp.x) >= sp.hw + 1 || Math.abs(a.z - sp.z) >= sp.hd + 1, z.id).toBe(true);
      const pts: [number, number][] = [[z.spawn.x, z.spawn.z]];
      for (const n of z.npcs) pts.push([n.x, n.z]);
      for (const t of z.trainers) pts.push([t.x, t.z]);
      for (const i of z.items) pts.push([i.x, i.z]);
      for (const l of z.lore) pts.push([l.x, l.z]);
      for (const w of z.warps) pts.push([w.x, w.z], [w.toX, w.toZ]);
      for (const p of s.interiors) for (const w of warpsOf(p)) pts.push([w.x, w.z], [w.toX, w.toZ]);
      for (const st of LEGENDARY_STATICS) if (st.zoneId === z.id) pts.push([st.x, st.z]);
      for (const r of RAID_HOTSPOTS) if (r.zoneId === z.id) pts.push([r.x, r.z]);
      for (const [px, pz] of pts) expect(Math.hypot(px - a.x, pz - a.z), `${z.id} vs (${px}, ${pz})`).toBeGreaterThanOrEqual(ARRIVAL_CLEARANCE_M);
      // facing the plaza centre (protocol heading: atan2(dx, dz))
      const want = Math.atan2(plaza.x - a.x, plaza.z - a.z);
      const d = Math.abs(((a.angle - want + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      expect(d, z.id).toBeLessThan(1e-3);
      expect(a.angle).toBeGreaterThanOrEqual(-Math.PI);
      expect(a.angle).toBeLessThan(Math.PI);
    }
  });

  it('routes and story zones arrive at their spawn, facing +z; every arrival is walkable', () => {
    for (const z of ZONES) {
      const a = arrivalPoint(z.id);
      expect(isWalkable(getZoneSurface(z.id).heightfield, a.x, a.z), z.id).toBe(true);
      if (z.kind === 'town') continue;
      expect(a, z.id).toEqual({ zoneId: z.id, x: z.spawn.x, z: z.spawn.z, angle: 0, rule: 'spawn' });
    }
  });

  it('is not an authored point: the zone plan keeps clear exactly what it did (spawn + defs), not the arrival', () => {
    const id: ZoneId = 'cinderhold';
    const a = arrivalPoint(id);
    expect(zonePlan(id).points.some(([x, z]) => x === a.x && z === a.z)).toBe(false);
  });

  it('memoised, and arrivalPointFor of the same zone + surface agrees', () => {
    const z = ZONES.find((q) => q.id === 'skyrend')!;
    expect(arrivalPoint('skyrend')).toBe(arrivalPoint('skyrend'));
    expect(arrivalPointFor(z, getZoneSurface('skyrend'))).toEqual(arrivalPoint('skyrend'));
  });

  it('throws for an unknown zone', () => {
    expect(() => arrivalPoint('nowhere' as ZoneId)).toThrow(RangeError);
  });
});
