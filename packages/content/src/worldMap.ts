/**
 * Phase C3 — the world map's grid. Each zone gets a cell computed by a breadth-first walk over the 4-neighbour
 * `links` from the first zone of `ZONE_ORDER` (Mirevale at (0, 0)), in `ZONE_ORDER` / n-e-s-w order so the result
 * is deterministic. A link `e` is one cell right (+x), `w` left, `n` one cell up (−y, the zone's −z edge), `s` down —
 * the same orientation as the handover vectors (n = −z). The grid is then shifted so its minimum is (0, 0).
 *
 * Pure data derived from `ZONES`: it reads no RNG and touches no zone layout.
 */
import { ZONES } from './data/zones';
import type { LinkDir, ZoneDef, ZoneId } from './types';

export interface MapCell {
  /** column, 0 = westmost */
  readonly x: number;
  /** row, 0 = northmost */
  readonly y: number;
}

/** Link direction → grid step (n is up). */
export const MAP_STEP: Readonly<Record<LinkDir, readonly [number, number]>> = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
const DIRS: readonly LinkDir[] = ['n', 'e', 's', 'w'];

/** Every zone's map cell (throws if two zones would share a cell or a zone is unreachable). */
export function computeMapPositions(zones: readonly ZoneDef[]): ReadonlyMap<ZoneId, MapCell> {
  const byId = new Map(zones.map((z) => [z.id, z]));
  const raw = new Map<ZoneId, [number, number]>();
  const first = zones[0];
  if (first === undefined) return new Map();
  raw.set(first.id, [0, 0]);
  const queue: ZoneId[] = [first.id];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const [x, y] = raw.get(id)!;
    const z = byId.get(id)!;
    for (const d of DIRS) {
      const to = z.links[d];
      if (to === undefined || raw.has(to) || !byId.has(to)) continue;
      const [dx, dy] = MAP_STEP[d];
      raw.set(to, [x + dx, y + dy]);
      queue.push(to);
    }
  }
  if (raw.size !== zones.length) {
    const missing = zones.filter((z) => !raw.has(z.id)).map((z) => z.id);
    throw new RangeError(`world map: unreachable zones ${missing.join(', ')}`);
  }
  let minX = Infinity;
  let minY = Infinity;
  for (const [x, y] of raw.values()) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
  }
  const out = new Map<ZoneId, MapCell>();
  const taken = new Map<string, ZoneId>();
  for (const z of zones) {
    const [x, y] = raw.get(z.id)!;
    const cell = { x: x - minX, y: y - minY };
    const key = `${cell.x},${cell.y}`;
    const clash = taken.get(key);
    if (clash !== undefined) throw new RangeError(`world map: ${z.id} and ${clash} share cell ${key}`);
    taken.set(key, z.id);
    out.set(z.id, cell);
  }
  return out;
}

let cached: ReadonlyMap<ZoneId, MapCell> | null = null;

/** The committed zones' map cells (memoised). */
export function zoneMapPositions(): ReadonlyMap<ZoneId, MapCell> {
  cached ??= computeMapPositions(ZONES);
  return cached;
}

/** The grid's extent in cells. */
export function zoneMapSize(): { readonly cols: number; readonly rows: number } {
  let cols = 0;
  let rows = 0;
  for (const c of zoneMapPositions().values()) {
    cols = Math.max(cols, c.x + 1);
    rows = Math.max(rows, c.y + 1);
  }
  return { cols, rows };
}
