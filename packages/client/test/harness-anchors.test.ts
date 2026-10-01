/**
 * SPEC §50.6.1 — the audit-shot anchors resolve from committed data alone (content + the zone layout), so a shot is
 * reproducible from its file name. Pins every resolved position of the M2 slice, the heading mapping and the rules.
 */
import { describe, expect, it } from 'vitest';
import { getHeightfield, isWalkable, zone } from '@ewa/content';
import { headingYaw } from '@ewa/render';
import { AUDIT_SHOTS, doorFrameOffset, resolveAnchor, rigHeading, shotFileStem, shotsForZone, viewForward } from '../src/harness/anchors';
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

  it('passes the §50.6.1 headings to the rig unchanged (amended 2026-09-30) and each shot looks at its subject', () => {
    for (const s of [0, 1, 2, 3] as const) expect(rigHeading(s)).toBe(s);
    // rig heading 0 looks ≈ −z (camera at target + (sin yaw, cos yaw)), 1 −x, 2 +z, 3 +x
    const want: Record<number, readonly [number, number]> = { 0: [0, -1], 1: [-1, 0], 2: [0, 1], 3: [1, 0] };
    for (const s of [0, 1, 2, 3] as const) {
      const [fx, fz] = viewForward(rigHeading(s));
      const [wx, wz] = want[s]!;
      // the diorama yaw base is −35°, so "forward" is the dominant axis of the view direction
      expect(fx * wx + fz * wz).toBeGreaterThan(0.8);
    }
    expect(-Math.cos(headingYaw(0))).toBeLessThan(-0.8);
    // the table keeps the views the words reading gave shots 2, 3, 4 and 6: the gym (−z), the creature and the east edge (+x)
    expect(AUDIT_SHOTS.map((s) => s.heading)).toEqual([0, 0, 3, 1, null, 3]);
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
