/**
 * Phase C3 — the world map's display rows: every zone at its content map cell (`zoneMapPositions`, a BFS over the
 * 4-neighbour links), its links, its badge gate and whether this player has been there. "Visited" is read only from
 * the server's `visited:<zone>` flags (GET /me, then the room's progressionDelta) plus the zone the session stands in;
 * the client never writes it. Fast travel is offered on visited towns only — the server re-checks everything.
 */
import { BADGES, allZones, visitedFlag, zoneMapPositions, zoneMapSize } from '@ewa/content';
import type { BadgeId, LinkDir, ZoneId, ZoneKind } from '@ewa/content';

export interface MapNode {
  readonly id: ZoneId;
  readonly name: string;
  readonly kind: ZoneKind;
  /** grid cell (0-based, n is up) */
  readonly col: number;
  readonly row: number;
  readonly gate: BadgeId | null;
  readonly healer: boolean;
  readonly shop: boolean;
  readonly gym: boolean;
}

export interface MapLink {
  readonly from: ZoneId;
  readonly to: ZoneId;
  readonly dir: LinkDir;
}

export const MAP_NODES: readonly MapNode[] = (() => {
  const pos = zoneMapPositions();
  return allZones().map((z) => {
    const c = pos.get(z.id)!;
    return { id: z.id, name: z.name, kind: z.kind, col: c.x, row: c.y, gate: z.gate, healer: z.healer, shop: z.shop !== null, gym: z.gym !== null };
  });
})();

/** Each undirected link once (e / s only — the w / n halves mirror them). */
export const MAP_LINKS: readonly MapLink[] = allZones().flatMap((z) =>
  (['e', 's'] as const).flatMap((dir) => {
    const to = z.links[dir];
    return to === undefined ? [] : [{ from: z.id, to, dir }];
  }),
);

export const MAP_SIZE = zoneMapSize();

const BADGE_NAME: ReadonlyMap<string, string> = new Map(BADGES.map((b) => [b.id, b.name]));
export function badgeName(id: BadgeId): string {
  return BADGE_NAME.get(id) ?? id;
}
/** "Bloom Badge" → "Bloom" (the map's gate chips are narrow; the title keeps the full name). */
export function badgeShortName(id: BadgeId): string {
  return badgeName(id).replace(/ Badge$/, '');
}

export const KIND_LABEL: Readonly<Record<ZoneKind, string>> = { town: 'Town', route: 'Route', story: 'Landmark' };

/** The zones this player has been to: the server's `visited:` flags, plus the zone the session stands in. */
export function visitedSet(flags: readonly string[] | null, current: ZoneId | null): ReadonlySet<ZoneId> {
  const out = new Set<ZoneId>();
  if (current !== null) out.add(current);
  if (flags === null) return out;
  const want = new Map(MAP_NODES.map((n) => [visitedFlag(n.id), n.id]));
  for (const f of flags) {
    const id = want.get(f);
    if (id !== undefined) out.add(id);
  }
  return out;
}

/** Fast travel is offered on a visited town other than the one you stand in. */
export function canTravelTo(node: MapNode, visited: ReadonlySet<ZoneId>, current: ZoneId | null): boolean {
  return node.kind === 'town' && visited.has(node.id) && node.id !== current;
}
