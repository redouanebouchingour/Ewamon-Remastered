/**
 * Town arrival point (Phase E, M3 audit §1 / M3-all-2): where a player lands when they ARRIVE in a zone without
 * crossing an edge — fast travel (Phase C3), the escape rope (§30.6.3), a fallback join (a join with no stored
 * position in that zone) — and where the capture harness stands for its "spawn" shot.
 *
 * `ZoneDef.spawn` stays what it is: the heightfield seeds its clearings and keeps ponds dry around it (it is an
 * authored point, `heightfield.ts` `authoredPoints`), so moving it would reshuffle ponds → roads → buildings →
 * interiors → the R1 fixture and the progression walker's recorded legs. Eight of the nine towns put it on the west
 * road at (−50, 0) / (−50, −6), 50 m from the plaza, where no building is in frame. The arrival point is derived
 * instead, and it is NOT an authored point (nothing in the layout keeps it clear; it picks ground that already is):
 *
 * - Mirevale: its spawn `(0, 6)`, already on the plaza (kept exactly, so the committed M2 shots stay valid).
 * - Other towns: the first candidate on a ring of radius `plaza.r − 3` m round the plaza centre, starting due south
 *   (`(0, r − 3)`, the side the default camera — rig heading 0 looks ≈ −z — frames the set-piece and the gym from)
 *   and alternating ±30° steps round the ring, whose nearest sample (else the nearest walkable sample within 2 m) is
 *   walkable with its 8 neighbours, in the 4-neighbour walkable component of the spawn, outside every pocket
 *   footprint and every plan solid, ≥ 1 m outside the set-piece's keep-clear extent, still on the plaza, and
 *   ≥ `ARRIVAL_CLEARANCE_M` from every authored point (spawn, npcs, trainers, items, lore, warps and their targets,
 *   pocket door warps, legendary statics, raid hotspots, obstacles). Facing = toward the plaza centre.
 * - Routes and story zones: their spawn (already on the road / the approach), facing 0 (+z).
 *
 * Pure and deterministic (the memoised surface, fixed candidate order). `validate` rule 12 checks every zone's
 * arrival is walkable and reachable from its spawn.
 */
import type { ZoneSurface } from './heightfield';
import { getZoneSurface, isWalkable, nearestWalkable, walkableComponent } from './heightfield';
import { inFootprint, warpsOf } from './interiors';
import { solidContains } from './plan';
import type { ZoneDef, ZoneId } from './types';
import { ZONES } from './data/zones';
import { LEGENDARY_STATICS } from './data/statics';
import { RAID_HOTSPOTS } from './data/liveops';

export interface ArrivalPoint {
  readonly zoneId: ZoneId;
  readonly x: number;
  readonly z: number;
  /** Heading the player faces on arrival (protocol convention: 0 = +z, `atan2(dx, dz)`, wrapped to [−π, π)). */
  readonly angle: number;
  /** How the point was derived: the zone's spawn, or a plaza-ring candidate (its angle from +z, degrees). */
  readonly rule: 'spawn' | `plaza ring ${number}°`;
}

/** Minimum distance from the arrival point to every authored point of the zone (`TOWN_LAYOUT.pointClearance`). */
export const ARRIVAL_CLEARANCE_M = 2.5;
/** The ring is this far inside the plaza rim. */
export const ARRIVAL_RIM_INSET_M = 3;
/** Ring candidates, degrees from +z (due south first, then ±30° steps). */
const RING_DEG: readonly number[] = [0, 30, -30, 60, -60, 90, -90, 120, -120, 150, -150, 180];
/** Snap radius when a candidate's own sample is not usable. */
const SNAP_M = 2;

function wrapAngle(a: number): number {
  let r = a;
  while (r >= Math.PI) r -= 2 * Math.PI;
  while (r < -Math.PI) r += 2 * Math.PI;
  return r;
}

/** Facing from (x, z) toward (tx, tz) (protocol `atan2(dx, dz)`, wrapped to [−π, π)); 0 when they coincide. */
function facing(x: number, z: number, tx: number, tz: number): number {
  if (x === tx && z === tz) return 0;
  return wrapAngle(Math.atan2(tx - x, tz - z)) + 0;
}

/** Every authored point of the zone a player should not be dropped onto (see the header). */
function arrivalAvoid(zone: ZoneDef, surface: ZoneSurface): (readonly [number, number])[] {
  const pts: (readonly [number, number])[] = [[zone.spawn.x, zone.spawn.z]];
  for (const n of zone.npcs) pts.push([n.x, n.z]);
  for (const t of zone.trainers) pts.push([t.x, t.z]);
  for (const i of zone.items) pts.push([i.x, i.z]);
  for (const l of zone.lore) pts.push([l.x, l.z]);
  for (const w of zone.warps) { pts.push([w.x, w.z]); pts.push([w.toX, w.toZ]); }
  for (const p of surface.interiors) for (const w of warpsOf(p)) { pts.push([w.x, w.z]); pts.push([w.toX, w.toZ]); }
  for (const s of LEGENDARY_STATICS) if (s.zoneId === zone.id) pts.push([s.x, s.z]);
  for (const r of RAID_HOTSPOTS) if (r.zoneId === zone.id) pts.push([r.x, r.z]);
  for (const o of zone.obstacles ?? []) pts.push([o.x, o.z]);
  return pts;
}

/**
 * The arrival point of `zone` on `surface` (its own surface — `getZoneSurface(zone.id)` for the shipped zones). Throws
 * when a town other than Mirevale has no usable ring candidate (validate reports it).
 */
export function arrivalPointFor(zone: ZoneDef, surface: ZoneSurface): ArrivalPoint {
  const plaza = surface.plan.plaza;
  if (zone.kind !== 'town' || zone.id === 'mirevale' || plaza === null) {
    const angle = zone.id === 'mirevale' && plaza !== null ? facing(zone.spawn.x, zone.spawn.z, plaza.x, plaza.z) : 0;
    return { zoneId: zone.id, x: zone.spawn.x, z: zone.spawn.z, angle, rule: 'spawn' };
  }
  const h = surface.heightfield;
  const reach = walkableComponent(h, zone.spawn.x, zone.spawn.z);
  const avoid = arrivalAvoid(zone, surface);
  const sp = surface.plan.setPiece;
  const idx = (x: number, z: number): number => Math.round((z - h.originZ) / h.step) * h.res + Math.round((x - h.originX) / h.step);
  const usable = (x: number, z: number): boolean => {
    if (!isWalkable(h, x, z)) return false;
    // the sample and its 8 neighbours walkable and connected to the spawn (not pinned against a bench or a wall)
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const i = idx(x + dx * h.step, z + dz * h.step);
        if (h.walkable[i] !== 1 || reach[i] !== 1) return false;
      }
    }
    if (Math.hypot(x - plaza.x, z - plaza.z) > plaza.r) return false;
    if (Math.abs(x - sp.x) < sp.hw + 1 && Math.abs(z - sp.z) < sp.hd + 1) return false;
    if (surface.interiors.some((p) => inFootprint(p, x, z))) return false;
    if (surface.plan.solids.some((s) => solidContains(s.shape, x, z))) return false;
    for (const [px, pz] of avoid) if (Math.hypot(px - x, pz - z) < ARRIVAL_CLEARANCE_M) return false;
    return true;
  };
  const ringR = plaza.r - ARRIVAL_RIM_INSET_M;
  for (const deg of RING_DEG) {
    const a = (deg * Math.PI) / 180;
    // the candidate's nearest sample centre (ring points are not on the 0.5 m grid)
    const cx = h.originX + Math.round((plaza.x + Math.sin(a) * ringR - h.originX) / h.step) * h.step + 0;
    const cz = h.originZ + Math.round((plaza.z + Math.cos(a) * ringR - h.originZ) / h.step) * h.step + 0;
    let p: readonly [number, number] | null = usable(cx, cz) ? [cx, cz] : null;
    if (p === null) {
      const q = nearestWalkable(h, cx, cz, SNAP_M);
      if (q !== null && usable(q[0], q[1])) p = q;
    }
    if (p !== null) {
      return { zoneId: zone.id, x: p[0], z: p[1], angle: facing(p[0], p[1], plaza.x, plaza.z), rule: `plaza ring ${deg}°` };
    }
  }
  throw new RangeError(`arrivalPoint: town ${zone.id} has no usable plaza-ring candidate`);
}

const ZONE_BY_ID: ReadonlyMap<ZoneId, ZoneDef> = new Map(ZONES.map((z) => [z.id, z]));
const cache = new Map<ZoneId, ArrivalPoint>();

/**
 * Memoised `arrivalPointFor` of a shipped zone: where fast travel, the escape rope and a fallback join put the player
 * (see the header). Edge handovers keep their own entry point (`entryPoint` in the server).
 */
export function arrivalPoint(zoneId: ZoneId): ArrivalPoint {
  const hit = cache.get(zoneId);
  if (hit !== undefined) return hit;
  const zone = ZONE_BY_ID.get(zoneId);
  if (zone === undefined) throw new RangeError(`unknown zone '${zoneId}'`);
  const a = arrivalPointFor(zone, getZoneSurface(zoneId));
  cache.set(zoneId, a);
  return a;
}
