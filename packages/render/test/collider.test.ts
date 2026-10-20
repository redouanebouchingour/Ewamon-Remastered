/**
 * SPEC §10.6.1 / §50.4.6 `collider.test.ts`: for 10 000 prng points over content's committed `mirevale` field,
 * `TerrainCollider.sample` equals content's `sampleHeight` to 1e-6 and `walkable` / `water` equal `isWalkable` /
 * `isWater` exactly; `resolveMove` never returns an unwalkable position over 10 000 random displacements.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three/webgpu';
import { decodeHeightfield, isWalkable, isWater, playableBounds, sampleHeight, type HeightfieldJson } from '@ewa/content';
import { MOVEMENT } from '@ewa/protocol';
import { MOVER, TerrainCollider, resolveMove, resolveMoveInto } from '../src/terrain/collider.js';
import { waterBodies } from '../src/terrain/field.js';
import { createPrng } from '../src/zone/prng.js';

const fixture = (id: string) => decodeHeightfield(JSON.parse(readFileSync(fileURLToPath(new URL(`../../content/dist/heightfields/${id}.json`, import.meta.url)), 'utf8')) as HeightfieldJson);

describe('§10.6.1 TerrainCollider over the committed mirevale field', () => {
  const h = fixture('mirevale');
  const c = new TerrainCollider(h);

  it('sample / walkable / water equal content for 10 000 prng points (incl. outside the field)', () => {
    const p = createPrng(0xc011);
    for (let i = 0; i < 10_000; i++) {
      const x = p.range(-84, 84); const z = p.range(-84, 84);
      const a = c.sample(x, z); const b = sampleHeight(h, x, z);
      if (Number.isNaN(b)) expect(a).toBeNaN(); else expect(Math.abs(a - b)).toBeLessThanOrEqual(1e-6);
      expect(c.walkable(x, z)).toBe(isWalkable(h, x, z));
      expect(c.water(x, z)).toBe(isWater(h, x, z));
    }
  });

  it('bounds are content playableBounds; normals are unit and up-facing; slope in degrees', () => {
    expect(c.bounds).toEqual(playableBounds(h));
    const n = new Vector3();
    const p = createPrng(3);
    for (let i = 0; i < 500; i++) {
      const x = p.range(-79, 79); const z = p.range(-79, 79);
      c.normal(x, z, n);
      expect(n.length()).toBeCloseTo(1, 6);
      expect(n.y).toBeGreaterThan(0);
      expect(c.slopeDeg(x, z)).toBeGreaterThanOrEqual(0);
      expect(c.slopeDeg(x, z)).toBeLessThan(90);
    }
    expect(c.normal(500, 0, n).toArray()).toEqual([0, 1, 0]);
  });

  it('MOVER.capsuleRadius is protocol MOVEMENT.radius (one table)', () => {
    expect(MOVER.capsuleRadius).toBe(MOVEMENT.radius);
  });
});

describe('§10.6.2 resolveMove', () => {
  for (const id of ['mirevale', 'mire_route'] as const) {
    it(`never returns an unwalkable position over 10 000 random displacements (${id})`, () => {
      const h = fixture(id);
      const c = new TerrainCollider(h);
      // a few blockers so the passable path is exercised too
      c.addBlocker({ kind: 'rect', x: 0, z: -32, hw: 7.35, hd: 6.35, yaw: 0 });
      c.addBlocker({ kind: 'circle', x: 20, z: 20, r: 1.2 });
      const p = createPrng(0x5eed);
      const b = c.bounds;
      let x = 0; let z = 6;
      if (!c.passable(x, z)) [x, z] = c.nearestPassable(x, z, 8)!;
      const out = { x: 0, z: 0, y: 0, blocked: false, slid: false };
      let slid = 0; let blocked = 0;
      for (let i = 0; i < 10_000; i++) {
        const dx = p.range(-1.2, 1.2); const dz = p.range(-1.2, 1.2);
        const r = resolveMoveInto(out, c, x, z, dx, dz);
        // never displaced farther than the requested step (the server's speed check; IMPLEMENTATION-NOTES Part 4, H9)
        expect(Math.hypot(r.x - x, r.z - z)).toBeLessThanOrEqual(Math.hypot(dx, dz) + 1e-9);
        expect(c.walkable(r.x, r.z)).toBe(true);
        expect(c.blocked(r.x, r.z)).toBe(false);
        expect(r.y).toBe(c.sample(r.x, r.z));
        if (r.slid) slid++; if (r.blocked) blocked++;
        x = r.x; z = r.z;
        if (i % 500 === 499) {   // teleport to a random walkable spot to cover the whole field
          const t = c.nearestPassable(p.range(b.minX, b.maxX), p.range(b.minZ, b.maxZ), 12);
          if (t) { x = t[0]; z = t[1]; }
        }
      }
      expect(slid + blocked).toBeGreaterThan(0);
    });
  }

  it('accepts a clear move, slides along an axis, and stays when boxed in', () => {
    const c = new TerrainCollider(fixture('mirevale'));
    const a = resolveMove(c, 0, 6, 0.5, 0);
    expect(a).toMatchObject({ x: 0.5, z: 6, blocked: false, slid: false });
    c.addBlocker({ kind: 'rect', x: 3, z: 6, hw: 0.5, hd: 20, yaw: 0 });   // wall at x ∈ [2.5, 3.5]
    const s = resolveMove(c, 2.2, 6, 0.6, 0.3);
    expect(s.slid).toBe(true);
    expect(c.passable(s.x, s.z)).toBe(true);
    const w = new TerrainCollider(fixture('mirevale'));
    w.addBlocker({ kind: 'circle', x: 0, z: 6, r: 3 });
    // spawned inside a blocker: walks out toward the nearest passable sample, one step (never more) per call
    let px = 0; let pz = 6; let steps = 0;
    while (!w.passable(px, pz) && steps < 100) {
      const r = resolveMove(w, px, pz, 0.1, 0);
      expect(Math.hypot(r.x - px, r.z - pz)).toBeLessThanOrEqual(0.1 + 1e-9);
      px = r.x; pz = r.z; steps++;
    }
    expect(w.passable(px, pz)).toBe(true);
    expect(steps).toBeGreaterThanOrEqual(30);                               // ≥ 3 m at 0.1 m per step
    expect(resolveMove(w, 0, 6, 0, 0)).toMatchObject({ x: 0, z: 6, blocked: true });   // no input, no jump
  });

  it('slides along a wall at the step length (never farther, never backwards)', () => {
    const c = new TerrainCollider(fixture('mirevale'));
    c.addBlocker({ kind: 'rect', x: 3, z: 6, hw: 0.5, hd: 20, yaw: 0 });   // wall face at x = 2.5
    const r = resolveMove(c, 2.3, 6, 0.4, 0.05);                            // almost straight into it: rule 3, the z-axis slide
    expect(r).toMatchObject({ x: 2.3, slid: true, blocked: false });
    expect(r.z).toBeCloseTo(6.05, 9);
    // head-on: both axis moves fail (dz = 0), rule 4 finds the ±67.5° probe at exactly the step length
    const head = resolveMove(c, 2.3, 6, 0.4, 0);
    expect(head.slid).toBe(true);
    expect(Math.hypot(head.x - 2.3, head.z - 6)).toBeCloseTo(0.4, 9);
    expect(head.x).toBeLessThan(2.5);
    expect(head.x - 2.3).toBeGreaterThan(0);                                // forward along the wall, never backwards
    expect(c.passable(head.x, head.z)).toBe(true);
  });

  it("water bodies: mirevale's brook has the lane's footbridge (a boardwalk strip) and a level above its floor", () => {
    const bodies = waterBodies(fixture('mirevale'));
    expect(bodies.length).toBe(1);
    for (const b of bodies) {
      expect(b.boardwalk).not.toBeNull();
      expect(b.level).toBeGreaterThan(b.floor);
      expect(b.r).toBeGreaterThan(2);
    }
  });
});

describe('tree crowns (IMPLEMENTATION-NOTES Part 4, H11)', () => {
  it('crownClearance is the first entry parameter; inside the start sphere counts as clear', () => {
    const c = new TerrainCollider(fixture('mirevale'));
    expect(c.crownClearance(0, 1, 0, 10, 1, 0)).toBe(1);
    c.addCrown({ x: 5, y: 1, z: 0, r: 1 });
    expect(c.crownClearance(0, 1, 0, 10, 1, 0)).toBeCloseTo(0.4, 9);        // enters at x = 4
    expect(c.crownClearance(0, 5, 0, 10, 5, 0)).toBe(1);                    // passes above
    expect(c.crownClearance(5, 1, 0, 10, 1, 0)).toBe(1);                    // starts inside
    expect(c.inCrown(5.5, 1, 0)).toBe(true);
    expect(c.inCrown(6.5, 1, 0)).toBe(false);
  });

  it('the zone builder registers a crown for every scatter tree, the unwalkable margin forest included', async () => {
    const { buildZone } = await import('../src/zone/builder.js');
    const { mockLibrary, realSpec } = await import('./zone-helpers.js');
    const lib = await mockLibrary();
    const h = buildZone(realSpec('mire_route'), { materials: lib, lighting: null, scene: null });
    const n = h.collider.crownCount();
    expect(n).toBeGreaterThan(500);
    // some crowns stand in the 16 m margin (no blockers there): probe a margin tree line
    const b = h.collider.bounds;
    let margin = 0;
    for (let x = b.minX - 15; x < b.minX; x += 1) for (let z = b.minZ; z < b.maxZ; z += 1) if (h.collider.inCrown(x, h.collider.sampleClamped(x, z) + 5, z)) margin++;
    expect(margin).toBeGreaterThan(0);
    h.dispose();
  }, 60_000);
});

describe('footprints (audit R1): content stamps them into walkable; the collider keeps their shapes for queries', () => {
  it('addFootprint is seen by blocked() but never by passable(); addBlocker (extra, client-only) is seen by both', () => {
    const c = new TerrainCollider(fixture('mire_route'));
    const [x, z] = [-60, 0.5];
    expect(c.walkable(x, z)).toBe(true);
    c.addFootprint({ kind: 'circle', x, z, r: 0.8 });
    expect(c.blocked(x, z)).toBe(true);
    expect(c.passable(x, z)).toBe(true);                                    // movement samples walkable, exactly as the server
    expect(c.footprintCount()).toBe(1);
    expect(c.footprintShapes()[0]).toEqual({ kind: 'circle', x, z, r: 0.8 });
    c.addBlocker({ kind: 'rect', x: x + 3, z, hw: 0.5, hd: 0.5, yaw: 0.3 });
    expect(c.blocked(x + 3, z)).toBe(true);
    expect(c.passable(x + 3, z)).toBe(false);
  });

  it("a built zone's footprints are unwalkable in content's field: resolveMove never stands inside a house or a trunk", async () => {
    const { buildZone } = await import('../src/zone/builder.js');
    const { mockLibrary, realSpec } = await import('./zone-helpers.js');
    const lib = await mockLibrary();
    const h = buildZone(realSpec('mirevale'), { materials: lib, lighting: null, scene: null });
    const c = h.collider;
    expect(c.blockerCount()).toBe(0);                                       // no client-only blockers: prediction = server truth
    expect(c.footprintCount()).toBeGreaterThan(150);
    const hf = realSpec('mirevale').heightfield;
    const step = hf.step;
    let inside = 0;
    for (const s of c.footprintShapes()) {
      const r = s.kind === 'circle' ? s.r : Math.hypot(s.hw, s.hd);
      for (let zz = Math.ceil((s.z - r) / step) * step; zz <= s.z + r; zz += step) {
        for (let xx = Math.ceil((s.x - r) / step) * step; xx <= s.x + r; xx += step) {
          const dx = xx - s.x; const dz = zz - s.z;
          const inShape = s.kind === 'circle' ? dx * dx + dz * dz < s.r * s.r
            : Math.abs(Math.cos(s.yaw) * dx - Math.sin(s.yaw) * dz) < s.hw && Math.abs(Math.sin(s.yaw) * dx + Math.cos(s.yaw) * dz) < s.hd;
          if (!inShape || c.water(xx, zz)) continue;
          inside++;
          // walkable there only on a door approach strip (content keeps those open)
          if (c.walkable(xx, zz)) expect(c.passable(xx, zz)).toBe(true);
        }
      }
    }
    expect(inside).toBeGreaterThan(3000);
    // walking straight at the gym from the plaza slides along its front, never into the hall (door at (0, −26))
    const gym = realSpec('mirevale').buildings.find((b) => b.kind === 'gym')!;
    let x = 0; let z = -16;
    const out = { x: 0, z: 0, y: 0, blocked: false, slid: false };
    let stopped = 0;
    for (let i = 0; i < 400; i++) {
      resolveMoveInto(out, c, x, z, 0, -0.1);
      x = out.x; z = out.z;
      if (out.blocked || out.slid) stopped++;
      expect(Math.abs(x - gym.x) < gym.w / 2 + 0.12 && Math.abs(z - gym.z) < gym.d / 2 + 0.12, `(${x}, ${z}) inside the gym`).toBe(false);
    }
    expect(stopped).toBeGreaterThan(0);
    h.dispose();
  }, 60_000);
});
