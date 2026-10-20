/**
 * Majin vs Tenjin seasons: the side that won the last season holds the sky over Solenne (content FACTION_SKY_ZONE).
 * Asked of the server once per season (GET /factions/sky) and only for that zone; any other zone has no mood.
 */
import { FACTION_SKY_ZONE, seasonAt } from '@ewa/content';
import type { Faction } from '@ewa/content';
import { apiFetch } from '../net/api';

let cached: { readonly season: number; readonly sky: Faction | null } | null = null;

/** The sky mood for `zoneId` now (null outside Solenne, before any season was won, or when the server cannot say). */
export async function factionSkyFor(zoneId: string | null, now: number = Date.now()): Promise<Faction | null> {
  if (zoneId !== FACTION_SKY_ZONE) return null;
  const season = seasonAt(now).number;
  if (cached !== null && cached.season === season) return cached.sky;
  try {
    const { sky } = await apiFetch('factionSky');
    cached = { season, sky };
    return sky;
  } catch (_e) {
    return null;
  }
}

/** Tests: forget the cached season. */
export function __resetFactionSkyForTests(): void {
  cached = null;
}
