/**
 * Phase D10 — Cut / Strength obstacles per zone (`ZoneDef.obstacles`, merged in data/zones.ts). Each one guards a
 * hidden item (granted once, with the clearing) away from the road and from every authored point, the progression
 * walker's saved positions and the handover bands; validate keeps every story target reachable on the stamped field.
 * Never a story gate. HM Cut comes from Mira (act I), HM Strength from Petra (act II).
 *
 * Changing an entry changes that zone's heightfield digest (the stamp is the last step of `buildZoneSurface`); zones
 * not listed here are byte-identical with or without this file.
 */
import type { ObstacleDef, ZoneId } from '../types';

export const OBSTACLES: Readonly<Partial<Record<ZoneId, readonly ObstacleDef[]>>> = {
  mire_route: [{ id: 'mire_route.thicket', kind: 'tree', x: -78, z: -54, item: { item: 'nugget', qty: 1 } }],
  tide_route: [{ id: 'tide_route.driftwood', kind: 'tree', x: -74, z: 34, item: { item: 'star_piece', qty: 1 } }],
  deepcut_route: [
    { id: 'deepcut_route.rockfall', kind: 'boulder', x: -74, z: -46, item: { item: 'rarecandy', qty: 1 } },
    { id: 'deepcut_route.cairn', kind: 'boulder', x: 66, z: 86, item: { item: 'big_nugget', qty: 1 } },
  ],
  hollow_route: [
    { id: 'hollow_route.briar', kind: 'tree', x: -62, z: 54, item: { item: 'max_revive', qty: 1 } },
    { id: 'hollow_route.tomb_stone', kind: 'boulder', x: 62, z: -38, item: { item: 'elixir', qty: 1 } },
  ],
  ascent_route: [{ id: 'ascent_route.scree', kind: 'boulder', x: -70, z: 38, item: { item: 'rarecandy', qty: 1 } }],
};
