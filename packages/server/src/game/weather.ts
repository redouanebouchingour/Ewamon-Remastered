/**
 * Phase D7 — overworld weather. Every zone (towns included) follows a per-biome schedule: the time is cut into
 * `WEATHER_BUCKET_MS` buckets and each bucket's weather is one weighted draw from
 * `createRng(`${worldSeed}:weather:${zoneId}:${bucket}`)`. Pure: no clock, no Math.random, no state — every shard
 * of a zone shows the same sky, and a restart with the same SERVER_SEED reproduces it.
 *
 * Battles: wild / static / trainer / league fights take the zone's weather as ambient battle weather
 * (`CreateBattleOpts.weather`), except inside an interior pocket (halls are indoors → 'none'). PvP and raids
 * never get weather (rating fairness; raids are their own encounter).
 */
import { createRng } from '@ewa/core';
import type { WeatherKind } from '@ewa/core';
import type { Biome, ZoneDef } from '@ewa/content';

/** One weather period: 6 minutes (eight per 48-minute day). */
export const WEATHER_BUCKET_MS = 6 * 60_000;

export type WeatherWeights = Readonly<Partial<Record<WeatherKind, number>>>;

/** Relative weights per biome; every biome keeps `none` as the most common outcome or close to it. */
export const WEATHER_SCHEDULE: Readonly<Record<Biome, WeatherWeights>> = {
  grove: { none: 55, rain: 35, sun: 10 },
  cinder: { none: 40, sun: 45, sand: 15 },
  salt: { none: 45, rain: 40, sun: 15 },
  storm: { none: 30, rain: 60, hail: 10 },
  marrow: { none: 55, sand: 45 },
  vesper: { none: 60, rain: 30, hail: 10 },
  forge: { none: 50, sun: 35, sand: 15 },
  sky: { none: 45, sun: 25, hail: 30 },
  capital: { none: 70, sun: 20, rain: 10 },
  shrine: { none: 60, sun: 25, rain: 15 },
  rift: { none: 40, sand: 30, hail: 30 },
};

/** Fixed draw order so a weight table's key order never changes the outcome. */
const ORDER: readonly WeatherKind[] = ['none', 'sun', 'rain', 'sand', 'hail'];

export function weatherBucket(nowMs: number): number {
  return Math.floor(nowMs / WEATHER_BUCKET_MS);
}

/** The weather of `zone` during `bucket` — one draw from the bucket's own rng. */
export function weatherForBucket(worldSeed: string, zone: Pick<ZoneDef, 'id' | 'biome'>, bucket: number): WeatherKind {
  const weights = WEATHER_SCHEDULE[zone.biome];
  let total = 0;
  for (const k of ORDER) total += weights[k] ?? 0;
  if (total <= 0) return 'none';
  let at = createRng(`${worldSeed}:weather:${zone.id}:${bucket}`).next() * total;
  for (const k of ORDER) {
    const w = weights[k] ?? 0;
    if (w <= 0) continue;
    at -= w;
    if (at < 0) return k;
  }
  return 'none';
}

export function weatherAt(worldSeed: string, zone: Pick<ZoneDef, 'id' | 'biome'>, nowMs: number): WeatherKind {
  return weatherForBucket(worldSeed, zone, weatherBucket(nowMs));
}

/** The formats that fight under the zone's weather (outside interiors). */
export const WEATHER_FORMATS: ReadonlySet<string> = new Set(['wild', 'trainer', 'league']);
