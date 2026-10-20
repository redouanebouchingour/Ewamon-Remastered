/**
 * §30.2.7 edge handover vs the sculpted terrain: every point of a linked edge's trigger line a player can walk to from
 * the spawn lands, through `entryPoint` (same lateral coordinate, 6.5 m inside, snapped), on ground connected to the
 * destination's spawn. A caldera rim, a ravine floor or a crag top on the neighbour's entry line would otherwise strand
 * the player on a ledge cut off from the town (content `data/sculpts.ts` closes such stretches with `shoulder`).
 */
import { describe, expect, it } from 'vitest';
import { ZONES, getHeightfield, nearestWalkable, playableBounds, walkableComponent, zone } from '@ewa/content';
import type { Heightfield, ZoneId } from '@ewa/content';
import { HANDOVER_TRIGGER_M, entryPoint } from '../src/rooms/ZoneRoom';

const reach = new Map<ZoneId, Uint8Array>();
function reachable(id: ZoneId, x: number, z: number): boolean {
  const h: Heightfield = getHeightfield(id);
  let c = reach.get(id);
  if (c === undefined) {
    const s = zone(id).spawn;
    const p = nearestWalkable(h, s.x, s.z, 8)!;
    c = walkableComponent(h, p[0], p[1]);
    reach.set(id, c);
  }
  return c[Math.round((z - h.originZ) / h.step) * h.res + Math.round((x - h.originX) / h.step)] === 1;
}

describe('§30.2.7 handover landings', () => {
  it('every reachable crossing of every link lands on ground reachable from the destination spawn', () => {
    const stranded: string[] = [];
    for (const zd of ZONES) {
      const h = getHeightfield(zd.id);
      const b = playableBounds(h);
      for (const dir of ['n', 'e', 's', 'w'] as const) {
        const to = zd.links[dir];
        if (to === undefined) continue;
        const dest = zone(to);
        const ew = dir === 'e' || dir === 'w';
        for (let t = ew ? b.minZ : b.minX; t <= (ew ? b.maxZ : b.maxX); t += h.step) {
          const k = HANDOVER_TRIGGER_M;
          const [x, z] = dir === 'e' ? [b.maxX - k, t] : dir === 'w' ? [b.minX + k, t] : dir === 's' ? [t, b.maxZ - k] : [t, b.minZ + k];
          if (!reachable(zd.id, x, z)) continue;
          const e = entryPoint(dest, dir, x, z);
          if (!reachable(to, e.x, e.z)) stranded.push(`${zd.id} -${dir}-> ${to} at ${t} lands at (${e.x}, ${e.z})`);
        }
      }
    }
    expect(stranded).toEqual([]);
  });
});
