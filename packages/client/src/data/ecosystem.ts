/**
 * A living ecosystem (content ecosystem.ts, GET /world/ecosystem/:zoneId): the words of the Dex's "This week on <zone>"
 * panel. Pure, so the copy is tested without a server.
 */
import { ECO_MIN_TAKES, encounterTableFor } from '@ewa/content';
import type { ZoneId } from '@ewa/content';
import type { EcoSpeciesView, EcosystemView } from '@ewa/protocol';
import { MAP_NODES } from './worldMap';

/** The zones the panel can show: those with wild creatures the player has been to, in map order. */
export function ecoZones(visited: ReadonlySet<ZoneId>): ZoneId[] {
  return MAP_NODES.filter((n) => visited.has(n.id) && encounterTableFor(n.id) !== null).map((n) => n.id);
}

/** The zone the panel opens on: where the player stands when it has wild creatures, else the last such zone visited. */
export function defaultEcoZone(current: ZoneId | null, zones: readonly ZoneId[]): ZoneId | null {
  if (current !== null && zones.includes(current)) return current;
  return zones.at(-1) ?? null;
}

/** A weight change as a signed percentage: +60%, -50%, no change at 0. */
export function factorLabel(f: number): string {
  const pct = Math.round((f - 1) * 100);
  return pct === 0 ? 'as usual' : `${pct > 0 ? '+' : ''}${pct}%`;
}

/** This week's catches and knockouts of one species, in a few words. */
export function takenLine(s: Pick<EcoSpeciesView, 'caught' | 'ko'>): string {
  const parts: string[] = [];
  if (s.caught > 0) parts.push(`${s.caught} caught`);
  if (s.ko > 0) parts.push(`${s.ko} knocked out`);
  return parts.length === 0 ? 'Left alone this week' : `${parts.join(' · ')} this week`;
}

/** The honor tilt in one line (shadow wins over light; a zone is never both). */
export function tiltLine(v: Pick<EcosystemView, 'shadow' | 'light'>): string {
  if (v.shadow > 0) return `Shadow ${v.shadow} of 4: Dark and Ghost creatures turn up more often here.`;
  if (v.light > 0) return `Lit ${v.light} of 4: the rare creatures here come out more often.`;
  return 'Clear: neither shadow nor light lies over this zone this season.';
}

/** The headline under the title: how much was taken, and whether that is enough to judge. */
export function takesLine(v: Pick<EcosystemView, 'takes' | 'judged'>): string {
  const n = `${v.takes} ${v.takes === 1 ? 'catch or knockout' : 'catches and knockouts'} this week`;
  return v.judged ? `${n}. Overhunt a species and its hunters move in.` : `${n}. Quiet so far: below ${ECO_MIN_TAKES}, nothing is scarce yet.`;
}
