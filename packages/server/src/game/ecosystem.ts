/**
 * A living ecosystem (content ecosystem.ts): what a wild battle took from a zone, and the zone's reading this week from
 * the database (its weekly tallies and its honor this season). The battle coordinator records takes in the turn's own
 * transaction; the zone room reads the reading once a minute and rolls its encounters on `Ecosystem.table`; GET
 * /world/ecosystem/:zoneId shows the same reading. Server env ECOSYSTEM ('off' in testEnv): nothing is recorded and
 * every zone rolls its authored table.
 */
import { ecoWeek, ecosystemOf, lightLevel, seasonAt, shadowLevel } from '@ewa/content';
import type { Ecosystem, ZoneId } from '@ewa/content';
import type { BattleEvent } from '@ewa/core';
import type { Repos, Tx } from '@ewa/persist';
import { isNemesisSpawn } from './nemesis';

/** Only plain wild creatures count: not the season's roamer, a nemesis ambush, a static or a ghost. */
export function countsForEcosystem(spawnId: string | null): boolean {
  return spawnId !== null && !spawnId.includes(':roamer:') && !isNemesisSpawn(spawnId);
}

/** What one resolved turn of a wild battle took: the wild side's creature caught, or knocked out. */
export function takeOf(events: readonly BattleEvent[], wildSide: 0 | 1 = 1): { readonly caught: number; readonly ko: number } {
  let caught = 0;
  let ko = 0;
  for (const e of events) {
    if (e.t === 'catchResult' && e.caught) caught += 1;
    else if (e.t === 'faint' && e.who.side === wildSide) ko += 1;
  }
  return { caught, ko };
}

/** A zone's ecosystem now: this week's and last week's tallies, its shadow and light levels this season. */
export async function readEcosystem(repos: Pick<Repos, 'ecosystem' | 'worldHonor'>, tx: Tx, zoneId: ZoneId, nowMs: number): Promise<Ecosystem | null> {
  const season = seasonAt(nowMs).number;
  const week = ecoWeek(nowMs);
  const honor = await repos.worldHonor.of(tx, season, zoneId);
  const thisWeek = await repos.ecosystem.week(tx, zoneId, week);
  const lastWeek = await repos.ecosystem.week(tx, zoneId, week - 1);
  return ecosystemOf({ zoneId, season, thisWeek, lastWeek, shadow: shadowLevel(honor.light, honor.shadow), light: lightLevel(honor.light, honor.shadow) });
}
