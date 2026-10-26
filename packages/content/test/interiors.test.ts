/**
 * Interiors (Phase A): every town building opens into a pocket — a walled, roofless hall in the zone's own playable
 * outer band — reached by door warps. Placement, disjointness, walkability, puzzle progression (all 8 gyms + the 4
 * league chambers), arena clearance and determinism.
 */
import { describe, expect, it } from 'vitest';
import {
  ARENA_CLEARANCE_M,
  ARENA_SLOT_M,
  INTERIOR_EDGE_CLEAR_M,
  LEAGUE,
  ZONES,
  ZONE_MARGIN,
  ZONE_SIZE,
  buildZoneSurface,
  checkInterior,
  gatesClosedFor,
  getZoneSurface,
  interiorArenaFor,
  interiorAt,
  interiorLeaders,
  interiorSwitches,
  interiorTrainerFlag,
  interiorTrainers,
  interiorWarps,
  hideoutsFor,
  interiorsFor,
  isWalkable,
  leaderSpot,
  localToWorld,
  walkInterior,
  worldToLocal,
} from '../src/index';

const TOWNS = ZONES.filter((z) => z.kind === 'town');

describe('interiors', () => {
  it('places one pocket per town building and hideout, inside the playable interior, disjoint, clear of linked edges', () => {
    expect(TOWNS).toHaveLength(9);
    for (const z of TOWNS) {
      const s = getZoneSurface(z.id);
      expect(s.interiorPlan.unplaced, z.id).toEqual([]);
      expect(s.interiors.map((p) => p.def.building).sort(), z.id).toEqual([...s.plan.buildings.map((b) => b.id), ...hideoutsFor(z.id).map((h) => h.id)].sort());
      const ih = ZONE_SIZE[z.kind] / 2 - ZONE_MARGIN;
      for (const [a, p] of s.interiors.entries()) {
        const f = p.footprint;
        expect(Math.abs(f.x) + f.hw, p.def.id).toBeLessThanOrEqual(ih);
        expect(Math.abs(f.z) + f.hd, p.def.id).toBeLessThanOrEqual(ih);
        if (z.links.n !== undefined) expect(f.z - f.hd).toBeGreaterThanOrEqual(-ih + INTERIOR_EDGE_CLEAR_M - 1);
        if (z.links.s !== undefined) expect(f.z + f.hd).toBeLessThanOrEqual(ih - INTERIOR_EDGE_CLEAR_M + 1);
        if (z.links.w !== undefined) expect(f.x - f.hw).toBeGreaterThanOrEqual(-ih + INTERIOR_EDGE_CLEAR_M - 1);
        if (z.links.e !== undefined) expect(f.x + f.hw).toBeLessThanOrEqual(ih - INTERIOR_EDGE_CLEAR_M + 1);
        for (const q of s.interiors.slice(a + 1)) {
          const g = q.footprint;
          expect(Math.abs(f.x - g.x) >= f.hw + g.hw || Math.abs(f.z - g.z) >= f.hd + g.hd, `${p.def.id} vs ${q.def.id}`).toBe(true);
        }
        // yaw is a multiple of π/2
        expect(Math.abs(Math.round(p.at.yaw / (Math.PI / 2)) * (Math.PI / 2) - p.at.yaw)).toBeLessThan(1e-9);
      }
    }
    for (const z of ZONES.filter((x) => x.kind !== 'town')) expect(interiorsFor(z.id)).toEqual([]);
  });

  it('every gym town has its gym hall, solenne its league hall with the four league fights in order', () => {
    for (const z of TOWNS) {
      const halls = interiorsFor(z.id).filter((p) => p.def.template === 'gym_hall' || p.def.template === 'league_hall');
      expect(halls, z.id).toHaveLength(1);
      if (z.gym !== null) expect(halls[0]!.def.rooms.map((r) => r.leader)).toEqual([z.gym]);
    }
    const league = interiorsFor('solenne').find((p) => p.def.template === 'league_hall')!;
    expect(league.def.rooms.map((r) => r.leader)).toEqual(['veil', 'aurelia', 'kirei', 'zeon']);
    expect(interiorLeaders('solenne').map((l) => l.leagueId)).toEqual(['veil', 'aurelia', 'kirei', 'zeon']);
    for (const l of LEAGUE) expect(interiorLeaders(l.zoneId).some((x) => x.leagueId === l.id), l.id).toBe(true);
  });

  it('floors are walkable, walls and screens are not, the field outside is untouched by the walls', () => {
    for (const z of TOWNS) {
      const h = getZoneSurface(z.id).heightfield;
      for (const p of interiorsFor(z.id)) {
        const [ex, ez] = localToWorld(p, p.def.entry.lx, p.def.entry.lz);
        expect(isWalkable(h, ex, ez), `${p.def.id} entry`).toBe(true);
        // just inside each outer wall: unwalkable; the screen band: unwalkable
        for (const [lx, lz] of [[p.def.w / 2 + 0.2, 0], [-p.def.w / 2 - 0.2, 0], [0, p.def.d / 2 + 0.2], [0, -p.def.d / 2 - 0.2], [p.def.w / 2 + 1.5, 0]] as const) {
          const [x, zz] = localToWorld(p, lx, lz);
          expect(isWalkable(h, x, zz), `${p.def.id} wall (${lx}, ${lz})`).toBe(false);
        }
        // the floor is flat at floorY
        const [cx, cz] = localToWorld(p, 0, 0);
        const i = Math.round((cz - h.originZ) / h.step) * h.res + Math.round((cx - h.originX) / h.step);
        expect(h.heights[i]).toBe(p.at.floorY);
        expect(h.water[i]).toBe(0);
      }
    }
  });

  it('local ↔ world round-trips', () => {
    for (const p of interiorsFor('mirevale')) {
      for (const [lx, lz] of [[0, 0], [3, -7], [-4.5, 2.25]] as const) {
        const [x, z] = localToWorld(p, lx, lz);
        const [bx, bz] = worldToLocal(p, x, z);
        expect(bx).toBeCloseTo(lx, 9);
        expect(bz).toBeCloseTo(lz, 9);
      }
    }
  });

  it('every pocket passes checkInterior: puzzles solvable from no flags, leaders gated, arenas clear, points reachable', () => {
    for (const z of TOWNS) {
      const h = getZoneSurface(z.id).heightfield;
      for (const p of interiorsFor(z.id)) expect(checkInterior(h, p), p.def.id).toEqual([]);
    }
  });

  it('gym puzzles: no leader without every trainer and puzzle flag; the walker reaches each leader', () => {
    let gyms = 0;
    for (const z of TOWNS) {
      const h = getZoneSurface(z.id).heightfield;
      for (const p of interiorsFor(z.id).filter((x) => x.def.template === 'gym_hall')) {
        gyms++;
        const full = walkInterior(h, p, new Set(), { beatLeaders: true });
        expect(full.leaders, p.def.id).toEqual([z.gym]);
        // the leader comes last: after every trainer and every flag-setting switch
        expect(full.order.at(-1)).toBe(z.gym);
        for (const t of p.def.trainers) expect(full.flags.has(interiorTrainerFlag(t.id))).toBe(true);
        const leaderGate = p.def.gates.find((g) => g.id.endsWith('.gate.leader'))!;
        expect(leaderGate.opensWhen.length).toBeGreaterThanOrEqual(p.def.trainers.length);   // the Dragon gauntlet is trainers only
        // dropping any one leader-gate flag keeps the leader unreachable
        for (const f of leaderGate.opensWhen) {
          const without = new Set([...full.flags].filter((x) => x !== f));
          const walk = walkInterior(h, p, without, { beatLeaders: true, useSwitches: false, beatTrainers: false });
          expect(walk.leaders, `${p.def.id} without ${f}`).toEqual([]);
        }
        expect(p.def.trainers.length).toBeGreaterThanOrEqual(2);
        expect(p.def.trainers.length).toBeLessThanOrEqual(3);
      }
    }
    expect(gyms).toBe(8);
  });

  it('league hall: chambers open in order on the Warden flags', () => {
    const h = getZoneSurface('solenne').heightfield;
    const p = interiorsFor('solenne').find((x) => x.def.template === 'league_hall')!;
    const none = walkInterior(h, p, new Set(), { beatLeaders: true, leaderFlags: false });
    expect(none.leaders).toEqual(['veil']);
    const two = walkInterior(h, p, new Set(['elite:veil:beaten']), { beatLeaders: true, leaderFlags: false });
    expect(two.leaders).toEqual(['veil', 'aurelia']);
    const all = walkInterior(h, p, new Set(), { beatLeaders: true });
    expect(all.leaders).toEqual(['veil', 'aurelia', 'kirei', 'zeon']);
    // Kirei speaks `wardens_charge` (it sets `wardens_met`, the Wardens' story gate): she greets in the foyer until then
    const kirei = interiorLeaders('solenne').find((l) => l.leagueId === 'kirei')!;
    expect(kirei.greet?.until).toBe('wardens_met');
    expect(leaderSpot(kirei, new Set())).toEqual(kirei.greet);
    expect(leaderSpot(kirei, new Set(['wardens_met']))).toBe(kirei);
    expect(interiorAt('solenne', kirei.greet!.x, kirei.greet!.z)).toBe(p);
    expect(interiorLeaders('solenne').filter((l) => l.greet !== null).map((l) => l.leagueId)).toEqual(['kirei']);
  });

  it('arenas: ≥ 6.5 m of floor round the centre, both trainer slots on the floor; interiorArenaFor finds the room', () => {
    for (const z of TOWNS) {
      const h = getZoneSurface(z.id).heightfield;
      for (const p of interiorsFor(z.id)) {
        for (const r of p.def.rooms) {
          expect(p.def.w / 2 - Math.abs(r.arena.lx)).toBeGreaterThanOrEqual(ARENA_CLEARANCE_M);
          expect(p.def.d / 2 - Math.abs(r.arena.lz)).toBeGreaterThanOrEqual(ARENA_CLEARANCE_M);
          for (const s of [ARENA_SLOT_M, -ARENA_SLOT_M]) {
            const [x, zz] = localToWorld(p, r.arena.lx, r.arena.lz + s);
            expect(isWalkable(h, x, zz), `${p.def.id} ${r.id} slot ${s}`).toBe(true);
          }
          // standing by the leader puts the battle at that room's arena, on the hall axis
          // (a room without a leader, the Sunken Crypt's: by its far slot, where the static waits)
          const by = r.leaderAt ?? { lx: r.arena.lx, lz: r.arena.lz - ARENA_SLOT_M };
          const [lx, lz] = localToWorld(p, by.lx, by.lz + 2);
          const a = interiorArenaFor(z.id, lx, lz)!;
          const [ax, az] = localToWorld(p, r.arena.lx, r.arena.lz);
          expect([a.x, a.z, a.yaw, a.interior]).toEqual([ax, az, p.at.yaw, p.def.id]);
        }
        // a gym trainer's fight forms in the leader's chamber
        for (const t of p.def.trainers) {
          const [tx, tz] = localToWorld(p, t.lx, t.lz);
          expect(interiorArenaFor(z.id, tx, tz)?.interior).toBe(p.def.id);
        }
      }
    }
    expect(interiorArenaFor('mirevale', 0, 6)).toBeNull();                  // the town plaza: fight where you stand
  });

  it('door warps: <id>.in at the door approach → entry, <id>.out at the exit → the door approach', () => {
    for (const z of TOWNS) {
      const h = getZoneSurface(z.id).heightfield;
      const warps = interiorWarps(z.id);
      for (const p of interiorsFor(z.id)) {
        const into = warps.find((w) => w.id === `${p.def.id}.in`)!;
        const out = warps.find((w) => w.id === `${p.def.id}.out`)!;
        expect(interiorAt(z.id, into.toX, into.toZ)).toBe(p);
        expect(interiorAt(z.id, into.x, into.z)).toBeNull();
        expect([out.toX, out.toZ]).toEqual([into.x, into.z]);
        expect(isWalkable(h, into.toX, into.toZ)).toBe(true);
        expect(Math.hypot(out.x - into.toX, out.z - into.toZ)).toBeLessThanOrEqual(3);
        expect(into.label.startsWith('Enter ')).toBe(true);
      }
    }
  });

  it('gates: per player — closed until every opensWhen flag is held; switches and trainers are world-placed', () => {
    const all = gatesClosedFor('mirevale', new Set());
    const gym = interiorsFor('mirevale').find((p) => p.def.template === 'gym_hall')!;
    expect(all.length).toBe(gym.def.gates.length);
    const flags = new Set(gym.def.gates.flatMap((g) => g.opensWhen));
    expect(gatesClosedFor('mirevale', flags)).toEqual([]);
    expect(interiorSwitches('mirevale').every((s) => interiorAt('mirevale', s.x, s.z) === gym)).toBe(true);
    expect(interiorTrainers('mirevale').map((t) => t.id)).toEqual(gym.def.trainers.map((t) => t.id));
    // trainer ids are unique across every zone and never collide with authored zone ids
    const ids = TOWNS.flatMap((z) => interiorTrainers(z.id).map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const z of ZONES) for (const t of z.trainers) expect(ids).not.toContain(t.id);
  });

  it('is deterministic: a second build places the same pockets and stamps the same digest', () => {
    for (const id of ['mirevale', 'saltmourn', 'solenne'] as const) {
      const a = getZoneSurface(id);
      const b = buildZoneSurface(ZONES.find((z) => z.id === id)!);
      expect(b.interiors.map((p) => [p.def.id, p.at, p.footprint])).toEqual(a.interiors.map((p) => [p.def.id, p.at, p.footprint]));
      expect(b.heightfield.digest).toBe(a.heightfield.digest);
    }
  });
});
