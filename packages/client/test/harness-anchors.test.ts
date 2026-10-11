/**
 * SPEC §50.6.1 — the audit-shot anchors resolve from committed data alone (content + the zone layout), so a shot is
 * reproducible from its file name. Pins every resolved position of the M2 slice, the heading mapping and the rules.
 */
import { describe, expect, it } from 'vitest';
import { ZONES, arrivalPoint, getHeightfield, isWalkable, zone, zonePlan } from '@ewa/content';
import { headingYaw } from '@ewa/render';
import { AUDIT_SHOTS, doorFrameOffset, resolveAnchor, rigFacing, shotFileStem, shotsForZone, viewForward } from '../src/harness/anchors';
import type { ResolvedAnchor, ShotId } from '../src/harness/anchors';
import { zoneSpecFor } from '../src/scene/zoneSpecFor';

const specs = {
  mirevale: zoneSpecFor(zone('mirevale'), 'intact'),
  mire_route: zoneSpecFor(zone('mire_route'), 'intact'),
};

function anchor(id: ShotId): ResolvedAnchor {
  const shot = AUDIT_SHOTS.find((s) => s.id === id)!;
  const a = resolveAnchor(shot, specs[shot.zone as keyof typeof specs]);
  if (a === null) throw new Error(`no anchor for ${id}`);
  return a;
}

describe('§50.6.1 shot table', () => {
  it('has the six shots over the two slice zones', () => {
    expect(AUDIT_SHOTS.map((s) => s.id)).toEqual(['spawn-noon', 'gym-dusk', 'sprite-edge', 'lamps-night', 'battle', 'link-east']);
    expect(shotsForZone('mirevale').map((s) => s.id)).toEqual(['spawn-noon', 'gym-dusk', 'lamps-night', 'link-east']);
    expect(shotsForZone('mire_route').map((s) => s.id)).toEqual(['sprite-edge', 'battle']);
    expect(AUDIT_SHOTS.map((s) => s.timeOfDay)).toEqual([0.5, 0.8, 0.5, 0.05, 0.5, 0.5]);
    expect(AUDIT_SHOTS.find((s) => s.id === 'sprite-edge')!.zoomStop).toBe(0);
  });

  it('headings are rig indices (amended 2026-10-06, M3 review R-all-2): 0 ≈ −z, 1 ≈ −x, 2 ≈ +z, 3 ≈ +x', () => {
    const want: Record<number, readonly [number, number]> = { 0: [0, -1], 1: [-1, 0], 2: [0, 1], 3: [1, 0] };
    for (const k of [0, 1, 2, 3] as const) {
      const [fx, fz] = viewForward(k);
      const [wx, wz] = want[k]!;
      // the diorama yaw base is −35°, so the named axis is the dominant one of the view direction
      expect(fx * wx + fz * wz).toBeGreaterThan(0.8);
      expect(rigFacing(wx, wz)).toBe(k);
    }
    expect(-Math.cos(headingYaw(0))).toBeLessThan(-0.8);
    // the table: spawn at the arrival heading (rig 0), gym-dusk turns to its door, the others keep the pre-amendment frames
    expect(AUDIT_SHOTS.map((s) => s.heading)).toEqual([0, 0, 3, 1, null, 3]);
    expect(AUDIT_SHOTS.map((s) => s.headingRule)).toEqual(['fixed', 'faceSubject', 'fixed', 'fixed', 'battle', 'fixed']);
    for (const id of ['spawn-noon', 'gym-dusk', 'sprite-edge', 'lamps-night', 'link-east'] as const) {
      expect(anchor(id).heading.convention, id).toBe('rig');
    }
    // the slice: the spawn row is rig 0 (the in-game arrival), gym-dusk rig 0 looks at the door 8 m ahead
    expect(anchor('spawn-noon').heading.rig).toBe(0);
    const g = anchor('gym-dusk');
    expect(g.heading.rig).toBe(0);
    const [fx, fz] = g.heading.viewForward!;
    expect(fx * (g.base.x - g.x) + fz * (g.base.z - g.z)).toBeGreaterThan(0.8 * Math.hypot(g.base.x - g.x, g.base.z - g.z));
    expect(anchor('sprite-edge').heading.rig).toBe(3);
    expect(anchor('lamps-night').heading.rig).toBe(1);
    expect(anchor('link-east').heading.rig).toBe(3);
  });

  it('reads door offsets in the door frame (+z = outward normal), world axes for a door facing +z', () => {
    expect(doorFrameOffset({ nx: 0, nz: 1 }, 0, 8)).toEqual([0, 8]);
    expect(doorFrameOffset({ nx: 0, nz: 1 }, 4, 6)).toEqual([4, 6]);
    const [x, z] = doorFrameOffset({ nx: 1, nz: 0 }, 0, 8);
    expect([x, z]).toEqual([8, 0]);
  });
});

describe('§50.6.1 anchors of the M2 slice', () => {
  it('spawn-noon is the zone spawn (0, 6)', () => {
    const a = anchor('spawn-noon');
    expect([a.x, a.z]).toEqual([0, 6]);
    expect(a.layoutSeed).toBe(zone('mirevale').layoutSeed >>> 0);
  });

  it('gym-dusk is the league marker door (0, −26) + (0, +8)', () => {
    const a = anchor('gym-dusk');
    expect(a.base.x).toBeCloseTo(0, 6);
    expect(a.base.z).toBeCloseTo(-26, 6);
    expect(a.x).toBeCloseTo(0, 6);
    expect(a.z).toBeCloseTo(-18, 6);
    expect(a.worldReading).toBeNull();
  });

  it('lamps-night reads the shop door offset in the door frame (the world reading lands inside the shop)', () => {
    const a = anchor('lamps-night');
    expect(a.offset).toEqual({ dx: 4, dz: 6, frame: 'door' });
    expect(a.worldReading).not.toBeNull();
    expect(Math.hypot(a.x - a.base.x, a.z - a.base.z)).toBeCloseTo(Math.hypot(4, 6), 6);
    expect(isWalkable(getHeightfield('mirevale'), a.x, a.z)).toBe(true);
  });

  it('link-east stands 6 m west of the east edge (x = 58)', () => {
    const a = anchor('link-east');
    expect([a.x, a.z]).toEqual([58, 0]);
  });

  it('sprite-edge / battle: first common slot at the first grass patch; the battle engages 2.5 m away', () => {
    const s = anchor('sprite-edge');
    const b = anchor('battle');
    expect(s.wild?.speciesId).toBe('mossling');
    expect(s.wild?.level).toBe(2);
    expect(s.x - s.wild!.x).toBeCloseTo(-2, 6);
    expect(s.z - s.wild!.z).toBeCloseTo(3, 6);
    expect(Math.hypot(b.x - b.wild!.x, b.z - b.wild!.z)).toBeCloseTo(2.5, 6);
    expect(isWalkable(getHeightfield('mire_route'), b.x, b.z)).toBe(true);
  });

  it('names files <shotId>-<x>_<z> at centimetre precision', () => {
    expect(shotFileStem('gym-dusk', 0, -18)).toBe('gym-dusk-0_-18');
    expect(shotFileStem('lamps-night', 1.3371, 17.635)).toBe('lamps-night-1.34_17.64');
  });

  it('resolves identically twice (pure)', () => {
    expect(anchor('battle')).toEqual(anchor('battle'));
  });
});

describe('M3 audit set (§50.5 M3: six shots in every zone)', () => {
  it('M2 keeps the table rows of the slice zones; M3 gives every zone all six rows', () => {
    expect(shotsForZone('mirevale', 'M2').map((s) => s.id)).toEqual(['spawn-noon', 'gym-dusk', 'lamps-night', 'link-east']);
    expect(shotsForZone('cinderhold', 'M2')).toEqual([]);
    expect(shotsForZone('cinderhold', 'M3').map((s) => s.id)).toEqual(['spawn-noon', 'gym-dusk', 'sprite-edge', 'lamps-night', 'battle', 'link-east']);
    expect(shotsForZone('cinderhold', 'M3').every((s) => s.zone === 'cinderhold')).toBe(true);
  });

  it('every zone resolves all six anchors on walkable ground; fallbacks say so; the slice keeps its table anchors', () => {
    for (const z of ZONES) {
      const spec = zoneSpecFor(zone(z.id), 'intact');
      const h = getHeightfield(z.id);
      for (const shot of shotsForZone(z.id, 'M3')) {
        const a = resolveAnchor(shot, spec);
        expect(a, `${z.id} ${shot.id}`).not.toBeNull();
        expect(isWalkable(h, a!.x, a!.z), `${z.id} ${shot.id} at ${a!.x}, ${a!.z}`).toBe(true);
        if (shot.id === 'sprite-edge' || shot.id === 'battle') expect(a!.wild, `${z.id} ${shot.id}`).not.toBeNull();
        const table = shot.id === 'spawn-noon' || (z.id === 'mirevale' && shot.id !== 'sprite-edge' && shot.id !== 'battle') || (z.id === 'mire_route' && (shot.id === 'sprite-edge' || shot.id === 'battle'));
        if (table) expect(a!.rule.startsWith('fallback'), `${z.id} ${shot.id}`).toBe(false);
      }
    }
    // the slice's M3 anchors are its M2 anchors
    expect(resolveAnchor(shotsForZone('mirevale', 'M3').find((s) => s.id === 'gym-dusk')!, specs.mirevale)).toEqual(anchor('gym-dusk'));
    expect(resolveAnchor(shotsForZone('mire_route', 'M3').find((s) => s.id === 'battle')!, specs.mire_route)).toEqual(anchor('battle'));
  });

  it('spawn-noon stands on the arrival point: the plaza in every town (Mirevale keeps its spawn (0, 6)), the spawn elsewhere', () => {
    for (const z of ZONES) {
      const a = resolveAnchor(shotsForZone(z.id, 'M3').find((s) => s.id === 'spawn-noon')!, zoneSpecFor(zone(z.id), 'intact'))!;
      const arr = arrivalPoint(z.id);
      expect([a.x, a.z], z.id).toEqual([arr.x, arr.z]);
      expect(a.snapped, z.id).toBe(false);
      if (z.kind !== 'town' || z.id === 'mirevale') {
        expect([a.x, a.z], z.id).toEqual([z.spawn.x, z.spawn.z]);
        expect(a.rule, z.id).toBe('ZoneDef.spawn');
        continue;
      }
      const plaza = zonePlan(z.id).plaza!;
      expect(Math.hypot(a.x - plaza.x, a.z - plaza.z), z.id).toBeLessThanOrEqual(plaza.r);
      expect(a.rule, z.id).toMatch(/^arrivalPoint \(plaza ring/);
      expect(a.base.name).toBe('arrival');
    }
    // the M2 slice's spawn shot is unchanged (the committed M2 Mirevale shots stay valid)
    expect(resolveAnchor(shotsForZone('mirevale', 'M3').find((s) => s.id === 'spawn-noon')!, specs.mirevale)).toEqual(anchor('spawn-noon'));
    expect(anchor('spawn-noon')).toMatchObject({ x: 0, z: 6, rule: 'ZoneDef.spawn', base: { name: 'spawn', x: 0, z: 6 } });
  });

  it('every zone: gym-dusk looks at its subject (the gym door, or the set-piece fallback); spawn-noon is rig 0', () => {
    for (const z of ZONES) {
      const spec = zoneSpecFor(zone(z.id), 'intact');
      const g = resolveAnchor(shotsForZone(z.id, 'M3').find((s) => s.id === 'gym-dusk')!, spec)!;
      const [fx, fz] = g.heading.viewForward!;
      const [bx, bz] = [g.base.x - g.x, g.base.z - g.z];
      expect(fx * bx + fz * bz, `${z.id} gym-dusk`).toBeGreaterThan(0.7 * Math.hypot(bx, bz));
      expect(resolveAnchor(shotsForZone(z.id, 'M3').find((s) => s.id === 'spawn-noon')!, spec)!.heading.rig, z.id).toBe(0);
    }
  });

  it('a link-east fallback turns the view toward the edge it uses', () => {
    for (const z of ZONES) {
      const spec = zoneSpecFor(zone(z.id), 'intact');
      if (spec.edges.e !== undefined) continue;
      const a = resolveAnchor(shotsForZone(z.id, 'M3').find((s) => s.id === 'link-east')!, spec);
      if (a === null) continue;
      expect(a.rule).toMatch(/^fallback: no east link/);
      const [fx, fz] = a.heading.viewForward!;
      const [bx, bz] = [a.base.x - a.x, a.base.z - a.z];
      expect(fx * bx + fz * bz).toBeGreaterThan(0);
    }
  });
});
