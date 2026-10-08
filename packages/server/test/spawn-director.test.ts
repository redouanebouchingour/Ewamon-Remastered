/**
 * §30.3 / §50.4.5 spawn-director.test.ts — driven with synthetic `now`, seeded, pure.
 */
import { describe, expect, it } from 'vitest';
import { ROUTE_TUNING, STORY_TUNING, TOWN_SPAWN_TUNING, encounterTableFor, getHeightfield, isWalkable, isWater, zone, allZones } from '@ewa/content';
import type { EncounterTable, ZoneId } from '@ewa/content';
import { createRng } from '@ewa/core';
import { SpawnDirector, isDay, slotEligible, tuningFor } from '../src/rooms/spawnDirector';
import { content } from './helpers';

function director(zoneId: ZoneId, seed = 'seed-1'): SpawnDirector {
  const z = zone(zoneId);
  return new SpawnDirector(z, encounterTableFor(zoneId), createRng(seed), getHeightfield(zoneId), tuningFor(z)!, content);
}

/** Drive `ticks` ticks of 50 ms from t0; returns every spawned record in order. */
function drive(d: SpawnDirector, ticks: number, timeOfDay = 0.5, t0 = 1_000_000) {
  const spawned = [];
  let maxPerTick = 0;
  let maxAlive = 0;
  for (let i = 0; i < ticks; i++) {
    const r = d.tick(t0 + i * 50, timeOfDay);
    maxPerTick = Math.max(maxPerTick, r.spawned.length);
    spawned.push(...r.spawned);
    maxAlive = Math.max(maxAlive, d.all.length);
  }
  return { spawned, maxPerTick, maxAlive };
}

describe('tuningFor', () => {
  it('route → ROUTE_TUNING, town with a table → TOWN, story → STORY, no table → null', () => {
    expect(tuningFor(zone('mire_route'))).toBe(ROUTE_TUNING);
    expect(tuningFor(zone('mirevale'))).toBeNull();
    const town = allZones().find((z) => z.kind === 'town' && z.encounterTable !== null)!;
    expect(tuningFor(town)).toBe(TOWN_SPAWN_TUNING);
    const story = allZones().find((z) => z.kind === 'story' && z.encounterTable !== null)!;
    expect(tuningFor(story)).toBe(STORY_TUNING);
  });
});

describe('SpawnDirector', () => {
  it('reaches targetCount (80 on a route), never exceeds it, at most one spawn per tick', () => {
    const d = director('mire_route');
    const r = drive(d, 400);
    expect(d.all.length).toBe(ROUTE_TUNING.targetCount);
    expect(r.maxAlive).toBeLessThanOrEqual(ROUTE_TUNING.targetCount);
    expect(r.maxPerTick).toBeLessThanOrEqual(1);
  });

  it('the same (seed, zone) reproduces the same spawn sequence; another seed differs', () => {
    const a = drive(director('mire_route', 's'), 200).spawned.map((s) => [s.id, s.speciesId, s.level, s.x, s.z, s.ability, s.variantKey, s.isAlpha]);
    const b = drive(director('mire_route', 's'), 200).spawned.map((s) => [s.id, s.speciesId, s.level, s.x, s.z, s.ability, s.variantKey, s.isAlpha]);
    const c = drive(director('mire_route', 't'), 200).spawned.map((s) => [s.id, s.speciesId, s.level, s.x, s.z, s.ability, s.variantKey, s.isAlpha]);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('every spawn: ability ∈ species.abilities, walkable (land) / water (water slots), ≥ 6 m apart, level in the slot band', () => {
    const d = director('mire_route', 'geo');
    drive(d, 400);
    const h = getHeightfield('mire_route');
    const table = encounterTableFor('mire_route')!;
    const all = d.all;
    for (const s of all) {
      expect(content.species(s.speciesId).abilities).toContain(s.ability);
      if (s.medium === 'water') expect(isWater(h, s.x, s.z)).toBe(true);
      else expect(isWalkable(h, s.x, s.z)).toBe(true);
      const slot = table.slots.find((x) => x.species === s.speciesId)!;
      expect(s.level).toBeGreaterThanOrEqual(Math.min(...table.slots.filter((x) => x.species === s.speciesId).map((x) => x.levelMin)));
      expect(slot).toBeDefined();
      for (const o of all) if (o !== s) expect(Math.hypot(o.x - s.x, o.z - s.z)).toBeGreaterThanOrEqual(6);
    }
  });

  it('a water slot lands on a water sample (a zone whose table has water slots)', () => {
    const zid = allZones().find((z) => encounterTableFor(z.id)?.slots.some((s) => s.medium === 'water'))?.id;
    expect(zid).toBeDefined();
    const h = getHeightfield(zid!);
    let waterSpawns = 0;
    for (let seed = 0; seed < 12 && waterSpawns === 0; seed++) {
      const d = director(zid!, `w${seed}`);
      drive(d, 300);
      for (const s of d.all.filter((x) => x.medium === 'water')) {
        waterSpawns++;
        expect(isWater(h, s.x, s.z)).toBe(true);
      }
    }
    expect(waterSpawns).toBeGreaterThan(0);
  });

  it('night-only slots never roll during the day [0.25, 0.75); day-only never at night', () => {
    const table = encounterTableFor('mire_route')!;
    const night = new Set(table.slots.filter((s) => s.timeOfDay === 'night').map((s) => s.species));
    const dayOnly = new Set(table.slots.filter((s) => s.timeOfDay === 'day').map((s) => s.species));
    const anyTime = new Set(table.slots.filter((s) => s.timeOfDay === 'any').map((s) => s.species));
    expect(isDay(0.25)).toBe(true);
    expect(isDay(0.75)).toBe(false);
    for (const s of table.slots) expect(slotEligible(s, 0.5)).toBe(s.timeOfDay !== 'night');
    const day = drive(director('mire_route', 'day'), 1200, 0.5).spawned;
    for (const s of day) if (night.has(s.speciesId)) expect(anyTime.has(s.speciesId)).toBe(true);
    const nite = drive(director('mire_route', 'nite'), 1200, 0.9).spawned;
    for (const s of nite) if (dayOnly.has(s.speciesId)) expect(anyTime.has(s.speciesId)).toBe(true);
  });

  it('engage: tooFar beyond 3 m, engaged for a second claimant, extends despawnAt; release despawns (reported next tick)', () => {
    const d = director('mire_route', 'eng');
    drive(d, 5);
    const s = d.all[0]!;
    const now = 2_000_000;
    expect(d.engage(s.id, 'p1', now, { x: s.x + 5, z: s.z })).toBe('tooFar');
    expect(d.engage('nope', 'p1', now)).toBe('notFound');
    const before = s.despawnAt;
    expect(d.engage(s.id, 'p1', now, { x: s.x + 1, z: s.z })).toBe('ok');
    expect(d.get(s.id)!.despawnAt).toBeGreaterThanOrEqual(Math.max(before, now + ROUTE_TUNING.engagedTimeoutMs));
    expect(d.engage(s.id, 'p2', now, { x: s.x, z: s.z })).toBe('engaged');
    // an engaged spawn is not despawned by its lifetime
    expect(d.tick(before + 1, 0.5).despawned).not.toContain(s.id);
    d.release(s.id, 'caught', now);
    expect(d.get(s.id)).toBeNull();
    expect(d.tick(now + 50, 0.5).despawned).toContain(s.id);
  });

  it('playerLeft frees the spawn; a stalled engagement is freed after engagedTimeoutMs', () => {
    const d = director('mire_route', 'free');
    drive(d, 5);
    const [a, b] = d.all;
    d.engage(a!.id, 'p1', 1000);
    d.release(a!.id, 'playerLeft', 1000);
    expect(d.get(a!.id)!.engagedBy).toBeNull();
    d.engage(b!.id, 'p2', 1000);
    const r = d.tick(1000 + ROUTE_TUNING.engagedTimeoutMs, 0.5);
    expect(r.freed).toContain(b!.id);
    expect(d.get(b!.id)!.engagedBy).toBeNull();
  });

  it('spawns keep ≥ 10 m from every player', () => {
    const d = director('mire_route', 'players');
    const h = getHeightfield('mire_route');
    const players = [];
    for (let x = -100; x <= 100; x += 25) for (let z = -100; z <= 100; z += 25) if (isWalkable(h, x, z)) players.push({ x, z });
    for (let i = 0; i < 300; i++) d.tick(1_000_000 + i * 50, 0.5, players);
    for (const s of d.all) for (const p of players) expect(Math.hypot(p.x - s.x, p.z - s.z)).toBeGreaterThanOrEqual(10);
  });

  it('a 100 000-roll sample matches the table weights within ±1.5 pp', () => {
    // land slots only: a water slot's roll is kept only when one of its 8 position draws lands on water (≈ 0.5 % of
    // mire_route since Phase D8 gave the mire's ponds water slots), so the spawned sample under-represents it by design
    const full = encounterTableFor('mire_route')!;
    const table = { ...full, slots: full.slots.filter((s) => (s.medium ?? 'land') === 'land') };
    const eligible = table.slots.filter((s) => slotEligible(s, 0.5));
    const total = eligible.reduce((a, s) => a + s.weight, 0);
    const expected = new Map<string, number>();
    for (const s of eligible) expected.set(s.species, (expected.get(s.species) ?? 0) + s.weight / total);
    const counts = new Map<string, number>();
    const N = 100_000;
    // a director that despawns instantly: lifetime 0 so every tick rolls
    const z = zone('mire_route');
    const d = new SpawnDirector(z, table, createRng('weights'), getHeightfield('mire_route'), { ...ROUTE_TUNING, targetCount: 1, lifetimeMs: 0, respawnMinMs: 0, respawnMaxMs: 0 }, content);
    let rolled = 0;
    let t = 0;
    while (rolled < N) {
      const r = d.tick(t, 0.5);
      t += 1;
      for (const s of r.spawned) {
        counts.set(s.speciesId, (counts.get(s.speciesId) ?? 0) + 1);
        rolled++;
      }
    }
    for (const [sp, p] of expected) expect(Math.abs((counts.get(sp) ?? 0) / N - p)).toBeLessThan(0.015);
  }, 120_000);
});

describe('lava (audit L2-25)', () => {
  it('a water slot never lands on lava: a cinder director whose table has only water slots places nothing', () => {
    const z = zone('ash_route');
    const table: EncounterTable = { id: 'lava_probe', zoneId: z.id, slots: [{ species: 'glimfin', weight: 1, levelMin: 10, levelMax: 10, timeOfDay: 'any', tier: 'common', medium: 'water' }] };
    const h = getHeightfield(z.id);
    expect(h.water.some((w) => w === 1)).toBe(true); // ash_route has a (lava) pond
    const d = new SpawnDirector(z, table, createRng('lava'), h, ROUTE_TUNING, content);
    expect(drive(d, 2000).spawned).toEqual([]);
  });
});
