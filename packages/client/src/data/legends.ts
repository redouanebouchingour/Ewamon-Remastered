/**
 * One roaming legendary per season (GET /legends): read once per screen. `roamerLines` turns it into what the Dex says
 * about a species: who caught it first in which seasons, and, while it roams this season, where it was last seen.
 */
import type { LegendsView } from '@ewa/protocol';
import { zoneName } from './content';

export function roamerLines(view: LegendsView, speciesId: string, speciesName: string): string[] {
  const out: string[] = [];
  if (view.species === speciesId && view.caught === null && view.zoneId !== null) {
    out.push(`Season ${view.season}: ${speciesName} roams the routes. Last seen on ${zoneName(view.zoneId)}. The first trainer to catch it is remembered.`);
  }
  for (const c of view.past) {
    if (c.species === speciesId) out.push(`Season ${c.season}: first caught by ${c.username}.`);
  }
  return out;
}
