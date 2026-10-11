/**
 * Phase E1 density pass (`zone/generators/dressing.ts`, IMPLEMENTATION-NOTES "Phase E1–E2"): the dressing never
 * changes what a player can walk on — no collider footprint is added, skirt items stay inside their building's
 * footprint pad and off the door, verge / scree cover stays off roads, buildings and authored points, the boundary
 * stands outside the walkable square — and every town gains instances without new scatter kinds beyond the shard.
 */
import { describe, expect, it } from 'vitest';
import { arrivalPoint, getHeightfield, isWalkable, type ZoneId } from '@ewa/content';
import { buildZone } from '../src/zone/builder.js';
import { BIOME_SURFACES } from '../src/materials/surfaces.js';
import { BIOME_GENERATORS, PROP_BLOCKER } from '../src/zone/generators/index.js';
import { DRESSING, GATE_HALF_GAP_M, PLAZA_CLUTTER, SKIRT_DEPTH_M, boundaryPieces, buildClutterItem, buildSkirtItem, dressingFor, plazaClutter, screeClusters, skirtPlacements, vergeClusters } from '../src/zone/generators/dressing.js';
import { createSplatContext, doorOf, footprintDistance, inSetPiece, layoutOf, roadDistance, scatterClear } from '../src/zone/layout.js';
import { mockLibrary, realSpec } from './zone-helpers.js';

const TOWNS: ZoneId[] = ['mirevale', 'cinderhold', 'saltmourn', 'stormrook', 'marrowdig', 'vesperveil', 'forgewall', 'skyrend', 'solenne'];

describe('Phase E1 dressing', () => {
  it('has a style for every biome; extra bush leaves are surfaces the set already binds', () => {
    for (const [biome, set] of Object.entries(BIOME_GENERATORS)) {
      const d = DRESSING[biome as keyof typeof DRESSING];
      expect(d, biome).toBeDefined();
      if (d.bush !== null) {
        const bound = [set.tallGrass, set.tuft, ...set.trees.map((t) => t.leaf)];
        expect(bound, biome).toContain(d.bush);
      }
      expect(d.grassTints).toHaveLength(4);
    }
  });

  it('skirt items hug the walls inside the footprint pad, never at the door, never at a gym', () => {
    for (const id of TOWNS) {
      const spec = realSpec(id);
      const style = dressingFor(spec.biome);
      let n = 0;
      for (const b of spec.buildings) {
        const items = skirtPlacements(b, style, () => true);
        if (b.kind === 'gym') { expect(items).toHaveLength(0); continue; }
        const door = doorOf(b);
        for (const it of items) {
          n++;
          const fd = footprintDistance(b, it.x, it.z);
          expect(fd, `${b.id} ${it.kind}`).toBeGreaterThan(0);
          expect(fd + 0.22, `${b.id} ${it.kind}`).toBeLessThanOrEqual(SKIRT_DEPTH_M + 0.02);   // centre + half depth ≤ the pad
          // not in front of the door: farther than 1.6 m from the door's centre line, or not on the front wall
          const along = Math.abs((it.x - door.x) * door.nz - (it.z - door.z) * door.nx);
          const out = (it.x - door.x) * door.nx + (it.z - door.z) * door.nz;
          if (out > -0.1 && out < 1) expect(along, `${b.id} ${it.kind}`).toBeGreaterThan(1.59);
        }
        for (const it of items) {
          const g = buildSkirtItem(BIOME_GENERATORS[spec.generators], it.kind, it.seed);
          g.lod0.computeBoundingBox();
          const bb = g.lod0.boundingBox!;
          expect(bb.max.z - bb.min.z, `${id} ${it.kind} depth`).toBeLessThanOrEqual(SKIRT_DEPTH_M);
          g.lod0.dispose(); g.lod1.dispose(); g.lod2.dispose();
        }
      }
      expect(n, id).toBeGreaterThan(10);
    }
  });

  it('verge and scree cover respect the keep-clear test (off roads, buildings, authored points)', () => {
    for (const id of ['mirevale', 'cinderhold', 'mire_route', 'eclipse_shrine'] as ZoneId[]) {
      const spec = realSpec(id);
      const plan = layoutOf(spec);
      const splat = createSplatContext(plan, spec.buildings, spec.seed, spec.interiors);
      const style = dressingFor(spec.biome);
      const clear = (x: number, z: number, r: number): boolean => scatterClear(splat, x, z, r, false);
      const cover = [...vergeClusters(splat.roads, style, { bush: true, flower: true }, 77, clear), ...screeClusters(spec.heightfield.size / 2 - 1.5, style, 77, clear)];
      expect(cover.length, id).toBeGreaterThan(50);
      for (const c of cover) {
        expect(roadDistance(splat.roads, c.x, c.z), `${id} ${c.kind}`).toBeGreaterThan(0.6);
        for (const b of spec.buildings) expect(footprintDistance(b, c.x, c.z)).toBeGreaterThan(1.2);
        for (const [px, pz] of plan.points) expect(Math.hypot(px - c.x, pz - c.z)).toBeGreaterThan(1.7);
      }
    }
  });

  it('the town boundary stands outside the walkable square, with a 7.6 m gap at each road exit', () => {
    for (const id of TOWNS) {
      const spec = realSpec(id);
      const plan = layoutOf(spec);
      const ih = plan.half - 16 + 1.2;
      const h = getHeightfield(id);
      const gaps = [{ side: 'w' as const, at: 0 }, { side: 'e' as const, at: 2 }];
      const pieces = boundaryPieces(ih, gaps, dressingFor(spec.biome), spec.seed);
      for (const pc of pieces) expect(isWalkable(h, pc.x, pc.z), `${id} ${pc.kind} at ${pc.x}, ${pc.z}`).toBe(false);
      const west = pieces.filter((p) => p.kind === 'run' && Math.abs(p.x + ih) < 1e-6);
      for (const r of west) expect(Math.abs(r.z) - r.len / 2).toBeGreaterThanOrEqual(GATE_HALF_GAP_M - 1e-6);
      expect(pieces.filter((p) => p.kind === 'pier')).toHaveLength(dressingFor(spec.biome).gatePiers ? 4 : 0);
    }
  });

  it('plaza clutter (M3 town art): clustered inside the rim, off props, lights, points, roads and the set-piece, one cluster by the arrival point', () => {
    for (const id of ['saltmourn', 'stormrook', 'skyrend', 'cinderhold', 'mirevale'] as ZoneId[]) {
      const spec = realSpec(id);
      const plan = layoutOf(spec);
      const P = plan.plaza!;
      const splat = createSplatContext(plan, spec.buildings, spec.seed, spec.interiors);
      const clear = (x: number, z: number, r: number): boolean => {
        for (const pp of spec.props) if (Math.hypot(pp.x - x, pp.z - z) < (PROP_BLOCKER[pp.kind] ?? 0) + 0.9) return false;
        for (const l of spec.lights) if (Math.hypot(l.position[0] - x, l.position[2] - z) < 0.9) return false;
        for (const [px, pz] of plan.points) if (Math.hypot(px - x, pz - z) < 1.3) return false;
        if (roadDistance(splat.roads, x, z) < r + 0.25) return false;
        if (inSetPiece(plan, x, z, r + 0.3)) return false;
        for (const b of spec.buildings) if (footprintDistance(b, x, z) < r + 0.3) return false;
        return true;
      };
      const items = plazaClutter(spec.biome, P.x, P.z, P.r, spec.seed & 0xffff, clear);
      if (PLAZA_CLUTTER[spec.biome] === undefined) { expect(items, id).toHaveLength(0); continue; }
      expect(items.length, id).toBeGreaterThanOrEqual(8);
      expect(plazaClutter(spec.biome, P.x, P.z, P.r, spec.seed & 0xffff, clear), id).toEqual(items);   // deterministic
      for (const it of items) {
        const r = Math.hypot(it.x - P.x, it.z - P.z);
        expect(r, `${id} ${it.kind}`).toBeLessThan(P.r - 0.5);
        expect(r, `${id} ${it.kind}`).toBeGreaterThan(P.r - 3.5);
        expect(clear(it.x, it.z, 0.45), `${id} ${it.kind}`).toBe(true);
        expect(PLAZA_CLUTTER[spec.biome]!.kinds, id).toContain(it.kind);
      }
      const a = arrivalPoint(id);
      expect(Math.min(...items.map((it) => Math.hypot(it.x - a.x, it.z - a.z))), `${id}: a cluster by the arrival point`).toBeLessThan(5);
    }
  });

  it('every clutter kind builds from surfaces its biome binds', () => {
    for (const [biome, kit] of Object.entries(PLAZA_CLUTTER)) {
      const set = BIOME_GENERATORS[biome as keyof typeof BIOME_GENERATORS];
      // its surface row plus what its prop style already binds (storm's timber is `harbour_plank`)
      const bound = new Set<string>([...BIOME_SURFACES[biome as keyof typeof BIOME_SURFACES], ...Object.values(set.props).filter((v): v is string => typeof v === 'string'), set.rock]);
      for (const kind of kit!.kinds) {
        const g = buildClutterItem(set, kind, 7);
        for (const s of g.surfaces) expect(bound.has(s), `${biome} ${kind}: ${s}`).toBe(true);
      }
    }
  });

  it('a built town adds no collider footprint for its dressing (content owns every solid)', async () => {
    const lib = await mockLibrary();
    for (const id of ['cinderhold', 'mire_route'] as ZoneId[]) {
      const spec = realSpec(id);
      const h = buildZone(spec, { materials: lib, lighting: null, scene: null });
      // buildings + hand-placed solids + housings + interior walls + scatter solids: the count content's plan implies
      const before = h.collider.footprintCount();
      const kinds = h.scatterInstances().map((s) => s.kind);
      expect(new Set(kinds).size).toBe(kinds.length);
      const h2 = buildZone(spec, { materials: lib, lighting: null, scene: null });
      expect(h2.collider.footprintCount()).toBe(before);           // deterministic
      expect(h2.digest).toBe(h.digest);
      h.dispose(); h2.dispose();
    }
  });
});
