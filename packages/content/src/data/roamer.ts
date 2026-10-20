/**
 * One roaming legendary per ranked season (seasons.ts): the season's roamer moves to another route every
 * `ROAM_PERIOD_MS`, on a schedule every server derives the same way (no shared state), and while it is on a route a
 * grass or surf encounter there meets it instead, now and then (`ROAMER_CHANCE`). The first trainer to catch it in a
 * season is recorded for good (the Dex names them); after that it roams no more until the next season. The roamers
 * are legendaries the world already holds as statics, so nothing becomes obtainable only this way.
 */
import { fnv1a32 } from '@ewa/core';

/** The season's roamer, in turn (season 1 the first). */
export const ROAMERS: readonly string[] = Object.freeze(['voltaura', 'sunjaw', 'glacinid']);
export const ROAMER_LEVEL = 50;
/** How long it stays on one route. */
export const ROAM_PERIOD_MS = 30 * 60_000;
/** The routes it roams. */
export const ROAM_ZONES: readonly string[] = Object.freeze([
  'mire_route',
  'ash_route',
  'tide_route',
  'galvan_route',
  'deepcut_route',
  'hollow_route',
  'siege_route',
  'ascent_route',
]);
/** The share of encounters on its route that meet the roamer. */
export const ROAMER_CHANCE = 1 / 16;

/** The roamer of a season (1-based). */
export function roamerOf(season: number): string {
  const i = (((season - 1) % ROAMERS.length) + ROAMERS.length) % ROAMERS.length;
  return ROAMERS[i]!;
}

/** The route the season's roamer is on at `atMs` (never the same route two periods running). */
export function roamerZoneAt(season: number, atMs: number): string {
  const period = Math.floor(atMs / ROAM_PERIOD_MS);
  const here = (p: number): number => fnv1a32(`roamer:${season}:${p}`) % ROAM_ZONES.length;
  let i = here(period);
  if (i === here(period - 1)) i = (i + 1) % ROAM_ZONES.length;
  return ROAM_ZONES[i]!;
}

/** When the roamer leaves its current route. */
export function roamerMovesAt(atMs: number): number {
  return (Math.floor(atMs / ROAM_PERIOD_MS) + 1) * ROAM_PERIOD_MS;
}
