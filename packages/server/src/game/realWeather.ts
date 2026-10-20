/**
 * Weather from real life: a player who picks a city in Settings sees and fights in that city's current weather, and
 * the matching types turn up more often in tall grass (`WEATHER_TYPES`). The server asks Open-Meteo (no key, no
 * account) with the city's coordinates rounded to 0.1° (about 10 km), caches each place for `REAL_WEATHER_TTL_MS`, and
 * never sends anything about the player. A failed lookup keeps the last answer, or the zone's schedule.
 */
import type { TypeName, WeatherKind } from '@ewa/core';

export const REAL_WEATHER_TTL_MS = 30 * 60_000;
/** How often a zone room reads its players' cities against the cache. */
export const REAL_WEATHER_CHECK_MS = 60_000;

/** The per-player topic POST /weather/city publishes a new city on (the room holding the player re-reads it). */
export function weatherTopic(playerId: string): string {
  return `ewa:weather:${playerId}`;
}
/** A failed lookup is not retried for this long (the zone's schedule stands in). */
export const REAL_WEATHER_RETRY_MS = 5 * 60_000;
/** Wind at or above this (km/h) with nothing falling reads as a sandstorm. */
export const SAND_WIND_KMH = 40;
/** How much more often the weather's types are rolled in tall grass. */
export const WEATHER_TYPE_BOOST = 2;

/** The types each weather favours in a wild roll. */
export const WEATHER_TYPES: Readonly<Record<Exclude<WeatherKind, 'none'>, readonly TypeName[]>> = {
  rain: ['Water'],
  sun: ['Fire', 'Grass'],
  hail: ['Ice'],
  sand: ['Ground', 'Rock', 'Steel'],
};

export interface City {
  readonly name: string;
  readonly region?: string;
  readonly country: string;
  /** rounded to 0.1° */
  readonly lat: number;
  readonly lon: number;
}

export const round1 = (v: number): number => Math.round(v * 10) / 10;

/**
 * A WMO weather code (Open-Meteo `weather_code`) as the game's weather: drizzle, rain, showers and thunderstorms are
 * rain; snow and snow showers hail; a clear or mainly clear day sun; dry wind at `SAND_WIND_KMH` sand; anything else
 * (clouds, fog, a clear night) none.
 */
export function weatherFromWmo(code: number, isDay: boolean, windKmh: number): WeatherKind {
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'hail';
  if (windKmh >= SAND_WIND_KMH) return 'sand';
  if ((code === 0 || code === 1) && isDay) return 'sun';
  return 'none';
}

type Fetch = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

interface Entry {
  kind: WeatherKind | null;
  at: number;
  failedAt: number;
  pending: Promise<WeatherKind | null> | null;
}

/** The lookups and their cache (one per process; tests pass a fake fetch and clock). */
export class RealWeather {
  private readonly cache = new Map<string, Entry>();

  constructor(
    private readonly deps: { readonly fetch: Fetch; readonly clock: () => number; readonly timeoutMs?: number },
  ) {}

  /** The cached weather of a place (null before the first answer); a stale entry is refreshed in the background. */
  peek(city: Pick<City, 'lat' | 'lon'>): WeatherKind | null {
    const key = `${round1(city.lat)},${round1(city.lon)}`;
    const e = this.cache.get(key);
    const now = this.deps.clock();
    if (e === undefined || (now - e.at >= REAL_WEATHER_TTL_MS && now - e.failedAt >= REAL_WEATHER_RETRY_MS)) void this.lookup(city);
    return e?.kind ?? null;
  }

  /** The weather of a place now: the cache when fresh, else one Open-Meteo request (shared by concurrent callers). */
  async lookup(city: Pick<City, 'lat' | 'lon'>): Promise<WeatherKind | null> {
    const lat = round1(city.lat);
    const lon = round1(city.lon);
    const key = `${lat},${lon}`;
    const now = this.deps.clock();
    const e = this.cache.get(key) ?? { kind: null, at: Number.NEGATIVE_INFINITY, failedAt: Number.NEGATIVE_INFINITY, pending: null };
    this.cache.set(key, e);
    if (now - e.at < REAL_WEATHER_TTL_MS) return e.kind;
    if (e.pending !== null) return e.pending;
    if (now - e.failedAt < REAL_WEATHER_RETRY_MS) return e.kind;
    e.pending = (async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,is_day,wind_speed_10m`;
        const body = (await this.request(url)) as { current?: { weather_code?: number; is_day?: number; wind_speed_10m?: number } } | null;
        const c = body?.current;
        if (c === undefined || typeof c.weather_code !== 'number') throw new Error('no current weather');
        e.kind = weatherFromWmo(c.weather_code, c.is_day === 1, typeof c.wind_speed_10m === 'number' ? c.wind_speed_10m : 0);
        e.at = this.deps.clock();
      } catch (_e) {
        e.failedAt = this.deps.clock();
      } finally {
        e.pending = null;
      }
      return e.kind;
    })();
    return e.pending;
  }

  /**
   * Up to 5 places named like `q` (Open-Meteo geocoding, most populous first) with their province or state, coordinates
   * rounded to 0.1°. A place that reads exactly like one already listed (villages of one name in one province) is
   * dropped: the player could not tell them apart.
   */
  async search(q: string): Promise<City[]> {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=en&format=json`;
    const body = (await this.request(url)) as { results?: { name?: string; admin1?: string; country?: string; latitude?: number; longitude?: number }[] } | null;
    return (body?.results ?? [])
      .filter((r) => typeof r.name === 'string' && typeof r.latitude === 'number' && typeof r.longitude === 'number')
      .map((r) => ({
        name: r.name!.slice(0, 60),
        ...(typeof r.admin1 === 'string' && r.admin1 !== '' && r.admin1 !== r.name ? { region: r.admin1.slice(0, 60) } : {}),
        country: (r.country ?? '').slice(0, 60),
        lat: round1(r.latitude!),
        lon: round1(r.longitude!),
      }))
      .filter((c, i, all) => all.findIndex((o) => o.name === c.name && o.region === c.region && o.country === c.country) === i)
      .slice(0, 5);
  }

  private async request(url: string): Promise<unknown> {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), this.deps.timeoutMs ?? 5000);
    try {
      const res = await this.deps.fetch(url, { signal: ctl.signal });
      if (!res.ok) throw new Error('weather service refused');
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }
}
