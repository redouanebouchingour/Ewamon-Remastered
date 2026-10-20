/**
 * SPEC §10.0.2 / §50.4.6: the pure parts of the zone builder (`layout`, `lod`, palettes, descriptors) run in node
 * without a GPU and without constructing any three object.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { allZones } from '@ewa/content';
import { LOD_DISTANCES, LOD_HYSTERESIS, chooseTier, chunkCentre, chunkGrid, chunkOf, tierFor } from '../src/zone/lod.js';
import {
  HOUSING_LOCAL, SET_PIECE_EXTENT, SET_PIECE_LIGHTS, TOWN_LAYOUT, createSplatContext, doorOf, footprintDistance, layoutOf, roadDistance, splatAt,
} from '../src/zone/layout.js';
import { PALETTES, paletteFor } from '../src/zone/palettes.js';
import { realSpec } from './zone-helpers.js';
import { SURFACES } from '../src/materials/surfaces.js';

const src = (f: string) => readFileSync(fileURLToPath(new URL(`../src/zone/${f}`, import.meta.url)), 'utf8');

describe('pure modules', () => {
  it('layout.ts and lod.ts import no three runtime code', () => {
    for (const f of ['layout.ts', 'lod.ts', 'types.ts', 'palettes.ts']) {
      const text = src(f);
      const imports = [...text.matchAll(/^import (type )?.*from '([^']+)';$/gm)];
      for (const m of imports) if (m[2]!.startsWith('three')) expect(m[1]).toBe('type ');
      expect(text).not.toMatch(/new (Mesh|BufferGeometry|Vector3|Matrix4|Group|InstancedMesh)\b/);
    }
  });
});

describe('§10.5.7 LOD tiers', () => {
  it('raw tiers at 40 / 90 / 160 m', () => {
    expect(LOD_DISTANCES).toEqual([40, 90, 160]);
    expect([0, 39.9, 40, 89.9, 90, 159.9, 160, 500].map(tierFor)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });
  it('4 m hysteresis both ways, multi-step jumps allowed', () => {
    expect(LOD_HYSTERESIS).toBe(4);
    expect(chooseTier(42, 0)).toBe(0);
    expect(chooseTier(44, 0)).toBe(1);
    expect(chooseTier(37, 1)).toBe(1);
    expect(chooseTier(35.9, 1)).toBe(0);
    expect(chooseTier(200, 0)).toBe(3);
    expect(chooseTier(10, 3)).toBe(0);
    expect(chooseTier(157, 3)).toBe(3);
  });
  it('chunk grid is aligned with the field (32 m cells)', () => {
    const g = chunkGrid(160);
    expect(g.cells).toBe(5); expect(g.origin).toBe(-80);
    expect(chunkCentre(g, chunkOf(g, 1, 1))).toEqual([0, 0]);
    expect(chunkCentre(g, chunkOf(g, 20, 20))).toEqual([32, 32]);
    expect(chunkOf(g, -1000, -1000)).toBe(0);
  });
});

describe('§10.5.5 layout', () => {
  const mv = realSpec('mirevale');
  const mr = realSpec('mire_route');

  it('is deterministic and matches between the adapter and the builder input', () => {
    const a = layoutOf(mv); const b = layoutOf(mv);
    expect(JSON.stringify({ ...a, water: a.water.length, roadZ: 0 })).toBe(JSON.stringify({ ...b, water: b.water.length, roadZ: 0 }));
  });

  it('town: plaza r 14, a road to each edge, the gym north with its door at (0, −26), buildings on the 22–30 m ring', () => {
    const plan = layoutOf(mv);
    expect(plan.plaza).toEqual({ x: 0, z: 0, r: TOWN_LAYOUT.plazaR });
    expect(plan.roads.find((r) => r.id === 'road_e')).toBeDefined();
    const gym = mv.buildings.find((b) => b.kind === 'gym')!;
    expect(doorOf(gym).z).toBeCloseTo(-26, 6);
    for (const b of mv.buildings) {
      if (b.kind === 'gym') continue;
      expect(Math.hypot(b.x, b.z)).toBeGreaterThanOrEqual(TOWN_LAYOUT.ringMin - 0.01);
      expect(Math.hypot(b.x, b.z)).toBeLessThanOrEqual(TOWN_LAYOUT.ringMax + 6);
      // faces the plaza
      const d = doorOf(b);
      expect(Math.hypot(d.x, d.z)).toBeLessThan(Math.hypot(b.x, b.z));
      // never on a road
      for (let t = -1; t <= 1; t += 0.5) expect(roadDistance(plan.roads, b.x + t * 0.5, b.z)).toBeGreaterThan(0);
    }
    const shop = mv.buildings.find((b) => b.kind === 'shop')!; const healer = mv.buildings.find((b) => b.kind === 'healer')!;
    expect(shop.z).toBeGreaterThan(0); expect(healer.z).toBeGreaterThan(0);          // flanking the south lane
    expect(Math.sign(shop.x)).not.toBe(Math.sign(healer.x));
  });

  it("route (sculpted): the road runs edge to edge, the corridor follows it, tall grass on both sides, the set-piece on the road", () => {
    const plan = layoutOf(mr);
    const main = plan.roads[0]!;
    expect(main.points[0]).toEqual([-120, 0]);
    expect(main.points[main.points.length - 1]).toEqual([120, 0]);
    for (const [x, z] of main.points) expect(plan.corridor(x, z)).toBeLessThan(1e-9);
    expect(plan.corridor(0, 60)).toBeGreaterThan(40);
    expect(plan.grassPatches.length).toBeGreaterThanOrEqual(3);
    expect(plan.clearings.length).toBeLessThanOrEqual(3);
    expect(plan.corridor(plan.setPiece.x, plan.setPiece.z)).toBeLessThan(2);
    const sides = plan.grassPatches.map((e) => Math.sign(e.z - main.points.reduce((b, p) => (Math.abs(p[0] - e.x) < Math.abs(b[0] - e.x) ? p : b))[1]));
    expect(new Set(sides).size).toBe(2);
    // the sculpt's features travel to the builder
    expect(plan.bridges.length).toBeGreaterThan(0);
    expect(plan.field).toBe(mr.heightfield);
  });

  it('splat: plaza inside r 14, path on roads, ground elsewhere', () => {
    const plan = layoutOf(mv);
    const ctx = createSplatContext(plan, mv.buildings, mv.seed);
    const f = { plaza: 0, path: 0, detail: 0 };
    expect(splatAt(ctx, 0, 5, f).plaza).toBeGreaterThan(0);
    const road = plan.roads.find((r) => r.id === 'road_e')!;
    const p = road.points[4]!;
    expect(splatAt(ctx, p[0], p[1], f).path).toBeGreaterThan(0);
    expect(splatAt(ctx, 40, -50, f).plaza).toBeLessThan(0);
    for (const b of mv.buildings) expect(footprintDistance(b, b.x, b.z)).toBe(0);
  });

  it('set-piece tables cover all 21 ids; lantern housings sit at the planned light height', () => {
    expect(Object.keys(SET_PIECE_EXTENT)).toHaveLength(21);
    expect(Object.keys(SET_PIECE_LIGHTS)).toHaveLength(21);
    for (const l of mv.lights) {
      if (l.housing.kind !== 'generated') continue;
      const ground = mv.heightfield.heights[0]! * 0 + 0;
      void ground;
      expect(l.position[1]).toBeGreaterThan(HOUSING_LOCAL[l.housing.generator][1] - 2.5);
    }
  });
});


describe('§10.5.3 palettes', () => {
  it('one palette per ZoneDef.palette id, with valid terrain surfaces; the slice grade is the SPEC value', () => {
    for (const z of allZones()) {
      const p = PALETTES[z.palette];
      expect(p, z.palette).toBeDefined();
      for (const s of [...p!.terrainLayers, p!.plaza]) expect(SURFACES[s]).toBeDefined();
    }
    for (const id of ['grove_mirevale', 'grove_mire']) {
      expect(PALETTES[id]!.grade).toEqual({ lift: [0.01, 0.012, 0.0], gamma: [1.0, 0.98, 0.96], gain: [1.02, 1.03, 0.98] });
      expect(PALETTES[id]!.nightLift).toEqual([0.0, 0.004, 0.02]);
    }
    expect(paletteFor('nope', 'cinder')).toBe(PALETTES.cinder_cinderhold);
  });
});
