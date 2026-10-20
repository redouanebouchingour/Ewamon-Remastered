/**
 * Zone sculpts (`sculpt.ts`, `data/sculpts.ts`): every zone has its own hand-authored shape, a route's road runs
 * from edge to edge through its spawn, sculpted roads stay walkable end to end (ramps through cliffs, decks over
 * water), and the shapes are deterministic.
 */
import { describe, expect, it } from 'vitest';
import { SCULPTS } from '../src/data/sculpts';
import { ZONES, getZoneSurface, isWalkable, isWater } from '../src/index';
import { placeOutcrops, polySignedDistance, sampleSpline } from '../src/sculpt';

describe('zone sculpts', () => {
  it('every zone has a sculpt, and no two zones share a shape', () => {
    const shapes = new Set<string>();
    for (const z of ZONES) {
      const s = SCULPTS[z.id];
      expect(s, z.id).toBeDefined();
      shapes.add(JSON.stringify(s));
      // a sculpt is more than a road: terrain of its own (lifts, hills, water or outcrops)
      const terrain = (s!.lifts?.length ?? 0) + (s!.hills?.length ?? 0) + (s!.rivers?.length ?? 0) + (s!.lakes?.length ?? 0) + (s!.outcrops?.length ?? 0);
      expect(terrain, z.id).toBeGreaterThan(0);
    }
    expect(shapes.size).toBe(ZONES.length);
  });

  it("a route's road_main runs from the west edge to the east edge, past the spawn", () => {
    for (const z of ZONES) {
      if (z.kind !== 'route') continue;
      const main = SCULPTS[z.id]!.roads?.find((r) => r.id === 'road_main');
      expect(main, z.id).toBeDefined();
      expect(main!.points[0], z.id).toEqual([-120, 0]);
      expect(main!.points[main!.points.length - 1], z.id).toEqual([120, 0]);
      const plan = getZoneSurface(z.id).plan;
      expect(plan.roadMeander, z.id).toBeNull();
      const near = Math.min(...plan.roads[0]!.points.map(([x, zz]) => Math.hypot(x - z.spawn.x, zz - z.spawn.z)));
      expect(near, `${z.id} spawn on the road`).toBeLessThan(3);
    }
  });

  it('sculpted roads are walkable along their centrelines (ramps through cliffs, decks over water)', () => {
    for (const z of ZONES) {
      const surf = getZoneSurface(z.id);
      const h = surf.heightfield;
      const ih = h.size / 2 - 16;
      for (const r of SCULPTS[z.id]!.roads ?? []) {
        let n = 0; let ok = 0;
        for (const [x, zz] of sampleSpline(r.points, 1)) {
          if (Math.abs(x) > ih - 1 || Math.abs(zz) > ih - 1) continue;
          n++;
          if (isWalkable(h, x, zz)) ok++;
        }
        if (n === 0) continue;
        // a light post, a set-piece core or a trainer's clearing may sit on a road sample; nothing else does
        expect(ok / n, `${z.id} ${r.id} walkable centreline`).toBeGreaterThan(0.95);
      }
    }
  });

  it('every bridge deck is walkable water, and every sculpted lake / river holds open water', () => {
    for (const z of ZONES) {
      const surf = getZoneSurface(z.id);
      const h = surf.heightfield;
      const ih = h.size / 2 - 16;
      for (const b of surf.plan.bridges) {
        const [mx, mz] = b.points[Math.floor(b.points.length / 2)]!;
        if (Math.abs(mx) > ih || Math.abs(mz) > ih) continue;          // a pier running out into the margin
        // the deck is walkable water (a trainer's clearing at a pier's end may dry part of it)
        let deck = 0;
        for (const [x, zz] of b.points) if (isWater(h, x, zz) && isWalkable(h, x, zz)) deck++;
        expect(deck, `${z.id} ${b.road} deck at (${mx}, ${mz})`).toBeGreaterThan(0);
      }
      const s = SCULPTS[z.id]!;
      for (const lk of s.lakes ?? []) {
        let wet = 0;
        for (let x = -h.size / 2; x <= h.size / 2; x += 2) for (let zz = -h.size / 2; zz <= h.size / 2; zz += 2) if (polySignedDistance(lk.poly, x, zz) < -3 && isWater(h, x, zz)) wet++;
        expect(wet, `${z.id} lake`).toBeGreaterThan(5);
      }
      if ((s.rivers ?? []).length > 0) expect(surf.plan.water.length, z.id).toBeGreaterThan(0);
    }
  });

  it('outcrops are deterministic and keep off the authored points', () => {
    for (const z of ZONES) {
      const s = SCULPTS[z.id]!;
      if (s.outcrops === undefined) continue;
      const pts = [[z.spawn.x, z.spawn.z], ...z.npcs.map((n) => [n.x, n.z]), ...z.trainers.map((t) => [t.x, t.z]), ...z.items.map((i) => [i.x, i.z])] as [number, number][];
      const a = placeOutcrops(s, getZoneSurface(z.id).heightfield.size / 2 - 16, pts);
      const b = placeOutcrops(s, getZoneSurface(z.id).heightfield.size / 2 - 16, pts);
      expect(a).toEqual(b);
      for (const l of a) for (const [px, pz] of pts) expect(Math.hypot(px - l.circle!.x, pz - l.circle!.z), `${z.id} outcrop`).toBeGreaterThanOrEqual(l.circle!.r + 10);
    }
  });

  it('dressed lifts become structures; cliffed round lifts become crags', () => {
    const forge = getZoneSurface('forgewall').plan;
    expect(forge.structures.filter((s) => s.kind === 'wall')).toHaveLength(1);
    expect(forge.structures.filter((s) => s.kind === 'tower')).toHaveLength(8);
    expect(getZoneSurface('siege_route').plan.structures.filter((s) => s.kind === 'palisade')).toHaveLength(2);
    expect(getZoneSurface('ash_route').plan.crags.length).toBeGreaterThan(8);
  });
});
