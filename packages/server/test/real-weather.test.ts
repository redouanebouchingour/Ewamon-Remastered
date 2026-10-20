/**
 * Weather from real life: a player who picks a city sees and fights in its weather, and its types turn up more often
 * in tall grass. The lookups (Open-Meteo) go through a fake fetch here; nothing reaches the network.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { ZONE_ORDER, encounterTableFor } from '@ewa/content';
import { createRng } from '@ewa/core';
import type { WeatherKind } from '@ewa/core';
import { REAL_WEATHER_CHECK_MS, REAL_WEATHER_RETRY_MS, REAL_WEATHER_TTL_MS, RealWeather, WEATHER_TYPES, weatherFromWmo } from '../src/game/realWeather';
import type { ZoneRoom } from '../src/rooms/ZoneRoom';
import { rollWild } from '../src/rooms/spawnDirector';
import type { SpawnRecord } from '../src/rooms/spawnDirector';
import { api, content, enter, ofType, register, startServer, waitFor } from './helpers';
import type { Joined, TestServer } from './helpers';

/** A stand-in for Open-Meteo: `code` is the current WMO code it reports; every URL asked is kept. */
function fakeMeteo(initial = 61): { fetch: (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>; urls: string[]; code: number; down: boolean } {
  const f = {
    urls: [] as string[],
    code: initial,
    down: false,
    fetch: (url: string) => {
      f.urls.push(url);
      if (f.down) return Promise.reject(new Error('offline'));
      if (url.startsWith('https://geocoding-api.open-meteo.com/')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            results: [
              { name: 'Rotterdam', admin1: 'South Holland', country: 'Netherlands', latitude: 51.9225, longitude: 4.47917 },
              { name: 'Nameless' },
              { name: 'Utrecht', admin1: 'Utrecht', country: 'Netherlands', latitude: 52.09, longitude: 5.12 },
              { name: 'Rotterdam', admin1: 'South Holland', country: 'Netherlands', latitude: 51.8, longitude: 4.6 },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ current: { weather_code: f.code, is_day: 1, wind_speed_10m: 8 } }) });
    },
  };
  return f;
}

describe('weather from real life (pure)', () => {
  it('maps WMO codes: drizzle, rain, showers, storms rain; snow hail; dry wind sand; a clear day sun; the rest none', () => {
    for (const c of [51, 55, 61, 65, 67, 80, 82, 95, 99]) expect(weatherFromWmo(c, true, 0)).toBe('rain');
    for (const c of [71, 75, 77, 85, 86]) expect(weatherFromWmo(c, true, 0)).toBe('hail');
    expect(weatherFromWmo(0, true, 0)).toBe('sun');
    expect(weatherFromWmo(1, true, 0)).toBe('sun');
    expect(weatherFromWmo(0, false, 0)).toBe('none');
    expect(weatherFromWmo(3, true, 0)).toBe('none');
    expect(weatherFromWmo(45, true, 0)).toBe('none');
    expect(weatherFromWmo(2, true, 45)).toBe('sand');
    expect(weatherFromWmo(63, true, 60)).toBe('rain');
  });

  it('asks once per place and period, with rounded coordinates; concurrent askers share the request', async () => {
    const m = fakeMeteo(61);
    let now = 1_000_000;
    const w = new RealWeather({ fetch: m.fetch, clock: () => now });
    const city = { lat: 51.9225, lon: 4.47917 };
    expect(w.peek(city)).toBeNull();
    const [a, b] = await Promise.all([w.lookup(city), w.lookup({ lat: 51.94, lon: 4.51 })]);
    expect([a, b]).toEqual(['rain', 'rain']);
    expect(m.urls).toHaveLength(1);
    expect(m.urls[0]).toContain('latitude=51.9&longitude=4.5&');
    expect(w.peek(city)).toBe('rain');
    // stale: peek answers the old weather at once and refreshes in the background
    m.code = 0;
    now += REAL_WEATHER_TTL_MS;
    expect(w.peek(city)).toBe('rain');
    await waitFor(() => w.peek(city) === 'sun', 1000);
    expect(m.urls).toHaveLength(2);
  });

  it('a failed lookup keeps the last answer and is not retried for a while', async () => {
    const m = fakeMeteo(71);
    let now = 5_000_000;
    const w = new RealWeather({ fetch: m.fetch, clock: () => now });
    const city = { lat: 60.2, lon: 25 };
    expect(await w.lookup(city)).toBe('hail');
    m.down = true;
    now += REAL_WEATHER_TTL_MS;
    expect(await w.lookup(city)).toBe('hail');
    expect(await w.lookup(city)).toBe('hail');
    expect(m.urls).toHaveLength(2);
    m.down = false;
    m.code = 61;
    now += REAL_WEATHER_RETRY_MS;
    expect(await w.lookup(city)).toBe('rain');
    // a place never answered gives null
    m.down = true;
    expect(await w.lookup({ lat: -33.9, lon: 151.2 })).toBeNull();
  });

  it('a city search returns named places only, rounded, with the query encoded', async () => {
    const m = fakeMeteo();
    const w = new RealWeather({ fetch: m.fetch, clock: () => 0 });
    // the province tells same-named places apart; a province named like the place is left out; a place that reads
    // like one already listed is dropped
    expect(await w.search('São Paulo & co')).toEqual([
      { name: 'Rotterdam', region: 'South Holland', country: 'Netherlands', lat: 51.9, lon: 4.5 },
      { name: 'Utrecht', country: 'Netherlands', lat: 52.1, lon: 5.1 },
    ]);
    expect(m.urls[0]).toContain('name=S%C3%A3o%20Paulo%20%26%20co&');
  });

  it("the player's weather favours its types in a wild roll; no weather, no bias", () => {
    const water = (id: string): boolean => content.species(id).types.some((t) => WEATHER_TYPES.rain.includes(t));
    const id = ZONE_ORDER.find((z) => {
      const land = encounterTableFor(z)?.slots.filter((s) => (s.medium ?? 'land') === 'land' && (s.timeOfDay === 'any' || s.timeOfDay === 'day')) ?? [];
      return land.some((s) => water(s.species)) && land.some((s) => !water(s.species));
    });
    expect(id).toBeDefined();
    const table = encounterTableFor(id!)!;
    const share = (weather: WeatherKind | null, of: (id: string) => boolean = water): number => {
      let n = 0;
      let hits = 0;
      for (let i = 0; i < 3000; i++) {
        const r = rollWild(table, 'land', createRng(`w:${i}`), content, 0.5, { x: 0, z: 0 }, `w${i}`, 0, undefined, weather);
        if (r === null) continue;
        n += 1;
        if (of(r.speciesId)) hits += 1;
      }
      return hits / n;
    };
    const plain = share(null);
    expect(share('none')).toBe(plain);
    expect(share('rain')).toBeGreaterThan(plain * 1.3);
    // sun favours its own types (Fire, Grass) and leaves the rest
    const sunny = (sid: string): boolean => content.species(sid).types.some((t) => WEATHER_TYPES.sun.includes(t));
    const dry = (sid: string): boolean => !sunny(sid) && !water(sid);
    if (table.slots.some((x) => sunny(x.species)) && table.slots.some((x) => dry(x.species))) {
      expect(share('sun', sunny)).toBeGreaterThan(share(null, sunny));
      expect(share('sun', dry)).toBeLessThan(share(null, dry));
    }
    // the same draws without weather are the old rolls, draw for draw
    expect(rollWild(table, 'land', createRng('x'), content, 0.5, { x: 0, z: 0 }, 'x', 0)).toEqual(rollWild(table, 'land', createRng('x'), content, 0.5, { x: 0, z: 0 }, 'x', 0, undefined, null));
  });
});

describe('weather from real life (server)', () => {
  let s: TestServer;
  const m = fakeMeteo(61);
  beforeAll(async () => {
    s = await startServer({ WORLD_WEATHER: 'on' }, { fetch: m.fetch });
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
  async function wildWeather(j: Joined, accId: string): Promise<string> {
    const room = roomOf(j);
    const before = ofType(j.msgs, 'battleStart').length;
    const started = await room.battles.startWild({ playerId: accId, sessionId: j.room.sessionId }, spawnRecord('mossling'), { x: 0, z: 6 });
    expect(started.ok).toBe(true);
    await waitFor(() => ofType(j.msgs, 'battleStart').length === before + 1, 3000);
    const kind = ofType(j.msgs, 'battleStart')[before]!.state.field.weather.kind;
    await room.battles.forfeitIfActive(accId, 'kicked');
    return kind;
  }

  it('finds cities through the server; the query needs two letters; a dead service is a 503', async () => {
    const acc = await register(s);
    const found = await api(s, 'GET', '/weather/cities?q=Rotter', acc.access);
    expect(found.status).toBe(200);
    expect(found.body.cities[0]).toEqual({ name: 'Rotterdam', region: 'South Holland', country: 'Netherlands', lat: 51.9, lon: 4.5 });
    expect((await api(s, 'GET', '/weather/cities?q=R', acc.access)).status).toBe(400);
    expect((await api(s, 'GET', '/weather/cities?q=Rotter', null)).status).toBe(401);
    m.down = true;
    expect((await api(s, 'GET', '/weather/cities?q=Rotter', acc.access)).status).toBe(503);
    m.down = false;
  });

  it('a picked city is stored rounded; GET /weather reads it; null turns it off', async () => {
    const acc = await register(s);
    expect((await api(s, 'GET', '/weather', acc.access)).body).toEqual({ city: null, kind: null });
    const set = await api(s, 'POST', '/weather/city', acc.access, { city: { name: 'Rotterdam', region: 'South Holland', country: 'Netherlands', lat: 51.9225, lon: 4.47917 } });
    expect(set.status).toBe(200);
    expect(set.body).toEqual({ city: { name: 'Rotterdam', region: 'South Holland', country: 'Netherlands', lat: 51.9, lon: 4.5 }, kind: 'rain' });
    expect((await api(s, 'GET', '/weather', acc.access)).body).toEqual(set.body);
    const off = await api(s, 'POST', '/weather/city', acc.access, { city: null });
    expect(off.body).toEqual({ city: null, kind: null });
    expect((await api(s, 'GET', '/weather', acc.access)).body).toEqual({ city: null, kind: null });
  });

  it("a player with a city hears its weather on joining and fights in it; turning it off returns the zone's", async () => {
    m.code = 61;
    const acc = await register(s);
    await api(s, 'POST', '/weather/city', acc.access, { city: { name: 'Rotterdam', country: 'Netherlands', lat: 51.9, lon: 4.5 } });
    const j = await enter(s, acc, 'mirevale');
    await waitFor(() => ofType(j.msgs, 'realWeather').some((x) => x.kind === 'rain'), 3000);
    const room = roomOf(j);
    room.state.weather = 'sun';
    expect(await wildWeather(j, acc.id)).toBe('rain');
    // a player without a city in the same room keeps the zone's weather
    const other = await register(s);
    const k = await enter(s, other, 'mirevale');
    expect(roomOf(k)).toBe(room);
    expect(await wildWeather(k, other.id)).toBe('sun');
    expect(ofType(k.msgs, 'realWeather')).toHaveLength(0);
    // turning it off reaches the room at once
    await api(s, 'POST', '/weather/city', acc.access, { city: null });
    await waitFor(() => ofType(j.msgs, 'realWeather').at(-1)?.kind === null, 3000);
    expect(await wildWeather(j, acc.id)).toBe('sun');
    await j.room.leave(true);
    await k.room.leave(true);
  }, 60_000);

  it('a change in the real weather reaches the player within a minute or so of the cache turning', async () => {
    m.code = 61;
    const acc = await register(s);
    await api(s, 'POST', '/weather/city', acc.access, { city: { name: 'Bergen', country: 'Norway', lat: 60.4, lon: 5.3 } });
    const j = await enter(s, acc, 'mirevale');
    await waitFor(() => ofType(j.msgs, 'realWeather').some((x) => x.kind === 'rain'), 3000);
    m.code = 73;
    s.time.advance(REAL_WEATHER_TTL_MS + REAL_WEATHER_CHECK_MS);
    // the first check after the turn refreshes in the background, the next one sends it
    await waitFor(() => ofType(j.msgs, 'realWeather').at(-1)?.kind === 'hail' || (s.time.advance(REAL_WEATHER_CHECK_MS), false), 5000, 100);
    await j.room.leave(true);
  }, 60_000);
});
