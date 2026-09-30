/**
 * Audit R1 on the server: content's heightfield now carries the zone plan's footprints (`walkable = 0` on every
 * building, set-piece core, prop, lamp post, trunk and big rock), so the server's existing code — which samples the
 * heightfield only — refuses a modified client that walks into a house and never places a wild spawn inside a
 * footprint. No server code changed; these tests pin the behaviour.
 */
import { describe, expect, it } from 'vitest';
import { allZones, encounterTableFor, getHeightfield, isWalkable, isWater, nearestWalkable, solidContains, zone, zonePlan } from '@ewa/content';
import type { Heightfield, PlanBuilding, ZoneDef } from '@ewa/content';
import { createRng } from '@ewa/core';
import { validateInput } from '../src/rooms/movement';
import { SpawnDirector, tuningFor } from '../src/rooms/spawnDirector';
import { content } from './helpers';

const towns = allZones().filter((z) => z.kind === 'town');

/** Strictly inside the building's walls (no capsule margin): where a body would visibly stand inside the house. */
function insideWalls(b: PlanBuilding, x: number, z: number): boolean {
  const dx = x - b.x; const dz = z - b.z;
  const c = Math.cos(b.yaw); const s = Math.sin(b.yaw);
  return Math.abs(c * dx - s * dz) < b.w / 2 && Math.abs(s * dx + c * dz) < b.d / 2;
}

/** The nearest heightfield sample centre (what isWalkable reads). */
function sampleCentre(h: Heightfield, x: number, z: number): [number, number] {
  return [h.originX + Math.round((x - h.originX) / h.step) * h.step, h.originZ + Math.round((z - h.originZ) / h.step) * h.step];
}

describe('movement into a house is rejected (validateInput over the stamped field)', () => {
  it('a step from the door step through the door into the hall → unwalkable, for every building of every town', () => {
    let n = 0;
    for (const t of towns) {
      const h = getHeightfield(t.id);
      for (const d of zonePlan(t.id).doors) {
        const from = { x: d.door.x + d.door.nx * 1.0, z: d.door.z + d.door.nz * 1.0 };
        const into = { x: d.door.x - d.door.nx * 0.3, z: d.door.z - d.door.nz * 0.3 };
        expect(isWalkable(h, from.x, from.z), `${d.building} door step`).toBe(true);
        const ok = validateInput({ x: from.x, z: from.z, lastSeq: 0, budgetMs: 250, inBattle: false }, { seq: 1, x: from.x, z: from.z - 0, angle: 0, running: false, dtMs: 50 }, h);
        expect(ok.ok, `${d.building}: standing on the door step is accepted`).toBe(true);
        const v = validateInput({ x: from.x, z: from.z, lastSeq: 0, budgetMs: 250, inBattle: false }, { seq: 1, x: into.x, z: into.z, angle: 0, running: true, dtMs: 200 }, h);
        expect(v, `${t.id} ${d.building}`).toMatchObject({ ok: false, reason: 'unwalkable' });
        n++;
      }
    }
    expect(n).toBeGreaterThanOrEqual(60);
  });

  it('no sample inside any building wall is walkable (a client that claims a position in a house is refused)', () => {
    for (const t of towns) {
      const h = getHeightfield(t.id);
      const plan = zonePlan(t.id);
      for (const b of plan.buildings) {
        const r = Math.hypot(b.w, b.d) / 2;
        let inside = 0;
        for (let z = b.z - r; z <= b.z + r; z += 0.25) {
          for (let x = b.x - r; x <= b.x + r; x += 0.25) {
            if (!insideWalls(b, x, z)) continue;
            inside++;
            expect(isWalkable(h, x, z), `${b.id} (${x}, ${z})`).toBe(false);
          }
        }
        expect(inside).toBeGreaterThan(100);
      }
    }
  });

  it('a surfer cannot use a footprint either: no footprint covers a water sample', () => {
    for (const z of allZones()) {
      const h = getHeightfield(z.id);
      for (const s of zonePlan(z.id).solids) {
        const [cx, cz] = sampleCentre(h, s.shape.x, s.shape.z);
        if (solidContains(s.shape, cx, cz)) expect(isWater(h, cx, cz), `${z.id} ${s.ref}`).toBe(false);
      }
    }
  });
});

describe('the spawn director never places a spawn inside a footprint', () => {
  const zones = allZones().filter((z) => tuningFor(z) !== null);

  function drive(z: ZoneDef, seed: string, ticks: number): { x: number; z: number; medium: 'land' | 'water' }[] {
    const d = new SpawnDirector(z, encounterTableFor(z.id), createRng(seed), getHeightfield(z.id), tuningFor(z)!, content);
    const out: { x: number; z: number; medium: 'land' | 'water' }[] = [];
    // 20 s per tick: past every respawn delay, and each spawn's lifetime ends 9 ticks later, so the population churns
    for (let i = 0; i < ticks; i++) for (const r of d.tick(1_000_000 + i * 20_000, (i % 40) / 40).spawned) out.push({ x: r.x, z: r.z, medium: r.medium });
    return out;
  }

  it(`${zones.length} zones × thousands of rolls: every spawn's sample is outside every footprint, never inside a house`, () => {
    expect(zones.length).toBeGreaterThanOrEqual(12);
    let total = 0;
    for (const z of zones) {
      const h = getHeightfield(z.id);
      const plan = zonePlan(z.id);
      let n = 0;
      const ticks = Math.round(12_600 / tuningFor(z)!.targetCount);          // ≈ the same number of rolls per zone
      for (const seed of ['r1-a', 'r1-b', 'r1-c']) {
        for (const s of drive(z, seed, ticks)) {
          const [cx, cz] = sampleCentre(h, s.x, s.z);
          const hit = plan.solids.find((q) => solidContains(q.shape, cx, cz));
          expect(hit, `${z.id} spawn (${s.x.toFixed(2)}, ${s.z.toFixed(2)}) inside ${hit?.source} ${hit?.ref}`).toBeUndefined();
          for (const b of plan.buildings) expect(insideWalls(b, s.x, s.z), `${z.id} spawn in ${b.id}`).toBe(false);
          if (s.medium === 'land') expect(isWalkable(h, s.x, s.z)).toBe(true);
          n++;
        }
      }
      expect(n, z.id).toBeGreaterThan(900);
      total += n;
    }
    expect(total).toBeGreaterThan(30_000);
  }, 120_000);
});

describe('authored positions are walkable on the stamped fields', () => {
  it('every npc, trainer, ground item, lore tablet and warp end stands on a walkable sample', () => {
    for (const z of allZones()) {
      const h = getHeightfield(z.id);
      const pts: [string, number, number][] = [];
      for (const n of z.npcs) pts.push([n.id, n.x, n.z]);
      for (const t of z.trainers) pts.push([t.id, t.x, t.z]);
      for (const i of z.items) pts.push([i.id, i.x, i.z]);
      for (const l of z.lore) pts.push([l.id, l.x, l.z]);
      for (const w of z.warps) { pts.push([w.id, w.x, w.z]); pts.push([`${w.id}→`, w.toX, w.toZ]); }
      for (const [id, x, zz] of pts) expect(isWalkable(h, x, zz), `${z.id} ${id} (${x}, ${zz})`).toBe(true);
    }
  });

  it("solenne's spawn sits in a lamp post's footprint: the room's nearestWalkable snap moves it 0.5 m", () => {
    const s = zone('solenne').spawn;
    const h = getHeightfield('solenne');
    expect(isWalkable(h, s.x, s.z)).toBe(false);
    const p = nearestWalkable(h, s.x, s.z, 8)!;
    expect(Math.hypot(p[0] - s.x, p[1] - s.z)).toBeLessThanOrEqual(0.5);
    expect(isWalkable(h, p[0], p[1])).toBe(true);
  });
});
