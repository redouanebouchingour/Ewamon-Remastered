/**
 * Phase D7 — overworld weather: the per-biome schedule is deterministic from (world seed, zone, time bucket);
 * ZoneRoom writes `state.weather` from it; wild / trainer battles start under the zone's weather; battles inside
 * an interior pocket (halls are indoors) and PvP start with none.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { ZONE_ORDER, interiorAt, interiorsFor, zone } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import type { WeatherKind } from '@ewa/core';
import { WEATHER_BUCKET_MS, WEATHER_SCHEDULE, weatherAt, weatherBucket, weatherForBucket } from '../src/game/weather';
import type { ZoneRoom } from '../src/rooms/ZoneRoom';
import type { SpawnRecord } from '../src/rooms/spawnDirector';
import { content, enter, ofType, register, startServer, waitFor } from './helpers';
import type { Joined, TestServer } from './helpers';

describe('weather schedule (pure)', () => {
  it('is a pure function of (seed, zone, bucket): same inputs, same weather; every instant of a bucket agrees', () => {
    for (const id of ZONE_ORDER) {
      const z = zone(id);
      for (let b = 1000; b < 1040; b++) {
        const w = weatherForBucket('seed-a', z, b);
        expect(weatherForBucket('seed-a', z, b)).toBe(w);
        expect(weatherAt('seed-a', z, b * WEATHER_BUCKET_MS)).toBe(w);
        expect(weatherAt('seed-a', z, (b + 1) * WEATHER_BUCKET_MS - 1)).toBe(w);
        // only kinds the biome lists with a positive weight
        expect((WEATHER_SCHEDULE[z.biome][w] ?? 0) > 0).toBe(true);
      }
    }
    expect(weatherBucket(WEATHER_BUCKET_MS * 7 + 5)).toBe(7);
  });

  it('follows the biome weights over many buckets and changes over time', () => {
    const z = zone('mire_route');
    const weights = WEATHER_SCHEDULE[z.biome];
    const total = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0);
    const n = 4000;
    const counts: Partial<Record<WeatherKind, number>> = {};
    for (let b = 0; b < n; b++) {
      const w = weatherForBucket('seed-b', z, b);
      counts[w] = (counts[w] ?? 0) + 1;
    }
    for (const [k, w] of Object.entries(weights)) {
      const expected = (w! / total) * n;
      // ±5 σ of a binomial
      const sigma = Math.sqrt(n * (w! / total) * (1 - w! / total));
      expect(Math.abs((counts[k as WeatherKind] ?? 0) - expected)).toBeLessThan(5 * sigma);
    }
    expect(Object.keys(counts).length).toBeGreaterThan(1);
  });

  it('differs between zones and between world seeds (not one global sky)', () => {
    const seq = (seed: string, id: ZoneId): string => Array.from({ length: 64 }, (_, b) => weatherForBucket(seed, zone(id), b)).join(',');
    expect(seq('s1', 'mire_route')).not.toBe(seq('s2', 'mire_route'));
    expect(seq('s1', 'mire_route')).not.toBe(seq('s1', 'mirevale'));
  });
});

describe('ZoneRoom weather', () => {
  let s: TestServer;
  beforeAll(async () => {
    s = await startServer({ WORLD_WEATHER: 'on' });
  }, 120_000);
  afterAll(async () => {
    await s?.stop();
  }, 60_000);

  function roomOf(j: Joined): ZoneRoom {
    return matchMaker.getLocalRoomById(j.room.roomId) as unknown as ZoneRoom;
  }
  function spawnRecord(speciesId: string): SpawnRecord {
    return { id: `test:${Math.floor(Math.random() * 1e9)}`, speciesId, level: 3, variantKey: 'normal', isAlpha: false, ability: content.species(speciesId).abilities[0]!, medium: 'land', x: 0, z: 6, bornAt: 0, engagedBy: null, engagedAt: null, despawnAt: 1e15 };
  }

  it('a wild battle in the open starts under the zone weather (ambient, turns 0)', async () => {
    const acc = await register(s);
    const j = await enter(s, acc, 'mirevale');
    const room = roomOf(j);
    room.state.weather = 'rain';
    const started = await room.battles.startWild({ playerId: acc.id, sessionId: j.room.sessionId }, spawnRecord('mossling'), { x: 0, z: 6 });
    expect(started.ok).toBe(true);
    await waitFor(() => ofType(j.msgs, 'battleStart').length === 1, 3000);
    const bs = ofType(j.msgs, 'battleStart')[0]!;
    expect(bs.state.field.weather).toEqual({ kind: 'rain', turns: 0 });
    expect(bs.events[0]).toEqual({ t: 'weatherSet', kind: 'rain', turns: 0, source: null });
    if (started.ok) expect(started.session.start.weather).toBe('rain');
    await j.room.leave(true);
  }, 60_000);

  it('a battle inside an interior pocket (a hall) starts with no weather', async () => {
    const pocket = interiorsFor('mirevale')[0]!;
    expect(interiorAt('mirevale', pocket.at.x, pocket.at.z)).not.toBeNull();
    const acc = await register(s);
    const j = await enter(s, acc, 'mirevale');
    const room = roomOf(j);
    room.state.weather = 'sand';
    const started = await room.battles.startWild({ playerId: acc.id, sessionId: j.room.sessionId }, spawnRecord('mossling'), { x: pocket.at.x, z: pocket.at.z });
    expect(started.ok).toBe(true);
    await waitFor(() => ofType(j.msgs, 'battleStart').length === 1, 3000);
    const bs = ofType(j.msgs, 'battleStart')[0]!;
    expect(bs.state.field.weather).toEqual({ kind: 'none', turns: 0 });
    expect(bs.events.some((e) => e.t === 'weatherSet')).toBe(false);
    if (started.ok) expect(started.session.start.weather).toBeUndefined();
    await j.room.leave(true);
  }, 60_000);

  it("writes the schedule's weather and follows it when the bucket turns", async () => {
    const acc = await register(s);
    const j = await enter(s, acc, 'mirevale');
    const room = roomOf(j);
    expect(room.state.weather).toBe(weatherAt('test-seed', zone('mirevale'), s.time.clock()));
    // walk the clock through buckets until the scheduled weather differs, then the room follows within a tick
    let target: WeatherKind = room.state.weather as WeatherKind;
    for (let k = 0; k < 50 && target === room.state.weather; k++) {
      s.time.advance(WEATHER_BUCKET_MS);
      target = weatherAt('test-seed', zone('mirevale'), s.time.clock());
    }
    expect(target).not.toBe(room.state.weather);
    await waitFor(() => room.state.weather === target, 3000);
    await waitFor(() => j.room.state.weather === target, 3000);
    await j.room.leave(true);
  }, 60_000);
});
