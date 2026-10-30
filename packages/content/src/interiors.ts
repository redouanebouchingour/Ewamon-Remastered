/**
 * Interiors: every town building opens into a POCKET — a roofless walled hall standing in the zone's own playable
 * outer band, reached only through door warps (`<id>.in` at the building's door approach → the hall entry,
 * `<id>.out` at the hall's exit marker → back to the door). Pockets are a separate layer laid out AFTER `planZone`:
 * the zone plan is untouched; scatter solids (trees, willows, rocks) that fall inside a
 * pocket are dropped from the stamp, everything else is avoided.
 *
 * Placement is a deterministic greedy scan (outermost ring first, then angle) over a 0.5 m blocked-cell grid with a
 * summed-area table; pockets are axis-aligned in the world (yaw a multiple of π/2) with their long axis along the
 * nearest field side and the door facing the town centre. Each pocket's outer footprint is the floor, a 0.4 m wall,
 * and a 2 m screen (a thicket the renderer draws from outside) — all unwalkable except the floor.
 *
 * Gates are per player and never stamped: the server checks them in movement validation, the client adds collider
 * blockers (`gatesClosedFor`).
 */
import type { Heightfield } from './heightfield';
import type { PlanSolid, RectSolid, Vec2, ZonePlan } from './plan';
import { MOVER_RADIUS, footprintDistance, inEllipse, roadDistance, roundBody, slopeAt, toWorld } from './plan';
import type {
  InteriorDef,
  InteriorPlacement,
  LocalPoint,
  LocalRect,
  NpcDef,
  TrainerDef,
  WarpDef,
  ZoneDef,
} from './types';
import { ZONE_MARGIN } from './types';
import { LEAGUE, POSTGAME_FLAG } from './data/league';
import { LEGENDARY_STATICS } from './data/statics';
import { RAID_HOTSPOTS } from './data/liveops';
import { ZONE_ORDER } from './types';
import { gymHall, healerHall, houseHall, leagueHall, shopHall } from './data/interiors';
import { withDaycare } from './data/daycare';
import { withBountyBoard } from './data/bounties';
import { withShrine } from './data/shrines';
import { hideoutBounds, hideoutDoor, hideoutHall, hideoutsFor } from './data/hideouts';
import { withTownCrier } from './data/rumours';
import { withDevTeam } from './data/devTeam';

// ─── constants ───────────────────────────────────────────────────────────────

/** Wall thickness outside the floor rectangle. */
export const INTERIOR_WALL_T = 0.4;
/** The unwalkable thicket band around a pocket's walls (height blends from the floor to the terrain across it). */
export const INTERIOR_SCREEN_M = 2;
/** Floors of a pocket stay this far from a linked edge (the 6 m handover trigger + 3 m). */
export const INTERIOR_EDGE_CLEAR_M = 9;
/** Wall height (roofless). */
export const INTERIOR_WALL_H = 2.4;
/** Trainer slots of the battle stage sit this far either side of the arena centre along the battle axis. */
export const ARENA_SLOT_M = 4.45;
/** A hall arena keeps this much floor around its centre. */
export const ARENA_CLEARANCE_M = 6.5;

// ─── types ───────────────────────────────────────────────────────────────────

export interface PlacedInterior {
  readonly def: InteriorDef;
  readonly at: InteriorPlacement;
  /** world outer footprint (floor + wall + screen), axis-aligned (yaw 0) */
  readonly footprint: RectSolid;
  /** the building's door-approach centre (where `<id>.in` sits and `<id>.out` lands) */
  readonly door: { readonly x: number; readonly z: number };
}

export interface InteriorPlan {
  readonly interiors: readonly PlacedInterior[];
  /** indices into `plan.solids` (scatter only) dropped because they fall inside a pocket */
  readonly droppedSolids: readonly number[];
  /** buildings that got no pocket (validate reports them) */
  readonly unplaced: readonly string[];
}

// ─── local ↔ world ───────────────────────────────────────────────────────────

export function localToWorld(p: Pick<PlacedInterior, 'at'>, lx: number, lz: number): Vec2 {
  return toWorld(p.at, lx, lz);
}
export function worldToLocal(p: Pick<PlacedInterior, 'at'>, x: number, z: number): Vec2 {
  const dx = x - p.at.x;
  const dz = z - p.at.z;
  const c = Math.cos(p.at.yaw);
  const s = Math.sin(p.at.yaw);
  return [c * dx - s * dz, s * dx + c * dz];
}
/** World yaw of a local heading (headings are `atan2(dx, dz)`: 0 faces +z). */
export function localYawToWorld(p: Pick<PlacedInterior, 'at'>, yaw: number): number {
  return yaw + p.at.yaw;
}
/** A local rect as a world solid, grown by `pad`. */
export function rectToWorld(p: Pick<PlacedInterior, 'at'>, r: LocalRect, pad = 0): RectSolid {
  const [x, z] = localToWorld(p, r.lx, r.lz);
  return { kind: 'rect', x, z, hw: r.hw + pad, hd: r.hd + pad, yaw: p.at.yaw };
}
/** True when (x, z) lies on the pocket's floor (inside the walls). */
export function onFloor(p: PlacedInterior, x: number, z: number): boolean {
  const [lx, lz] = worldToLocal(p, x, z);
  return Math.abs(lx) <= p.def.w / 2 && Math.abs(lz) <= p.def.d / 2;
}
/** True when (x, z) lies inside the pocket's outer footprint (floor, walls or screen). */
export function inFootprint(p: PlacedInterior, x: number, z: number): boolean {
  const f = p.footprint;
  return Math.abs(x - f.x) < f.hw && Math.abs(z - f.z) < f.hd;
}

// ─── defs per building ───────────────────────────────────────────────────────

/** The hall a town building opens into, or null (warp landmarks and non-town zones have none). */
export function interiorDefFor(
  zone: ZoneDef,
  b: ZonePlan['buildings'][number],
): InteriorDef | null {
  if (zone.kind !== 'town') return null;
  const town = zone.name.split(',')[0]!;
  const townIndex = Math.max(0, ZONE_ORDER.indexOf(zone.id));
  switch (b.kind) {
    case 'gym': {
      if (zone.gym !== null) {
        const leader = LEAGUE.find((l) => l.id === zone.gym);
        return leader === undefined ? null : gymHall(zone.id, b.id, `${town} Gym`, leader);
      }
      const order = LEAGUE.filter((l) => l.zoneId === zone.id && l.stage !== 'gym').sort((a, c) =>
        a.stage === c.stage ? a.order - c.order : a.stage === 'elite' ? -1 : 1,
      );
      return order.length === 0 ? null : leagueHall(zone.id, b.id, 'the League Hall', order);
    }
    case 'shop':
      // the bounty board: in a town without a Healer, the Mart keeps the Marshal and the board
      return withTownCrier(withBountyBoard(shopHall(zone.id, b.id, `${town} Mart`)));
    case 'healer':
      // the bounty board: a town's Healer hall keeps the Marshal and the board (the hall and its footprint unchanged);
      // the rumour board: the town crier beside him (data/rumours.ts)
      return withTownCrier(withBountyBoard(healerHall(zone.id, b.id, `${town} Healer`)));
    case 'house':
      // breeding: Mirevale's house 1 is the Daycare (its resident keeps it; the hall and its footprint are unchanged)
      // the bounty board: Skyrend (no Healer, no Mart) keeps it in its first house, the Marshal's Office
      // the relic shrines (postgame): one house in each elemental town (data/shrines.ts; the hall and footprint unchanged)
      // Team Ewamon HQ: Mirevale's house 5 is the original team's office (data/devTeam.ts; the hall and footprint unchanged)
      return withDevTeam(withShrine(withTownCrier(withBountyBoard(withDaycare(houseHall(zone.id, b.id, 'the house', b.w * b.d < 50 ? 's' : 'm', townIndex))))));
    default:
      return null;
  }
}

// ─── placement ───────────────────────────────────────────────────────────────

interface Grid {
  readonly res: number;
  readonly originX: number;
  readonly originZ: number;
  readonly step: number;
  /** summed-area table of blocked cells, (res + 1)² */
  readonly sat: Int32Array;
}

function inSetPiece(sp: ZonePlan['setPiece'], x: number, z: number, pad: number): boolean {
  const dx = x - sp.x;
  const dz = z - sp.z;
  const c = Math.cos(sp.yaw);
  const s = Math.sin(sp.yaw);
  return Math.abs(c * dx - s * dz) < sp.hw + pad && Math.abs(s * dx + c * dz) < sp.hd + pad;
}

const SCATTER: ReadonlySet<PlanSolid['source']> = new Set(['tree', 'willow', 'rock']);

function blockedGrid(zone: ZoneDef, plan: ZonePlan, base: Heightfield, avoidGrass: boolean, avoidSlopes: boolean): Grid {
  // a 1 m lattice over the field (candidates sit on whole metres; the field's 0.5 m water mask is sampled under it)
  const step = 1;
  const originX = -Math.floor(plan.half);
  const originZ = originX;
  const res = 2 * Math.floor(plan.half) + 1;
  const ih = plan.half - ZONE_MARGIN;
  const blocked = new Uint8Array(res * res);
  const waterAt = (x: number, z: number): boolean =>
    base.water[
      Math.round((z - base.originZ) / base.step) * base.res +
        Math.round((x - base.originX) / base.step)
    ] === 1;
  const roads = [...plan.roads, ...plan.doorPaths];
  const points: Vec2[] = [...plan.points, [zone.spawn.x, zone.spawn.z]];
  for (const s of LEGENDARY_STATICS) if (s.zoneId === zone.id && s.interior === undefined) points.push([s.x, s.z]);
  for (const r of RAID_HOTSPOTS) if (r.zoneId === zone.id) points.push([r.x, r.z]);
  const small: { x: number; z: number; r: number }[] = [];
  for (const p of plan.props) small.push({ x: p.x, z: p.z, r: 2 });
  for (const l of plan.lights) small.push({ x: l.x, z: l.z, r: 1.5 });
  plan.solids.forEach((s) => {
    if (SCATTER.has(s.source) || s.source === 'building') return;
    if (s.shape.kind === 'circle') small.push({ x: s.shape.x, z: s.shape.z, r: s.shape.r + 1 });
    else small.push({ x: s.shape.x, z: s.shape.z, r: Math.hypot(s.shape.hw, s.shape.hd) + 1 });
  });
  const linked = zone.links;
  const edge = INTERIOR_EDGE_CLEAR_M;
  for (let row = 0; row < res; row++) {
    const z = originZ + row * step;
    for (let col = 0; col < res; col++) {
      const x = originX + col * step;
      const i = row * res + col;
      let b = Math.abs(x) > ih - 0.5 || Math.abs(z) > ih - 0.5;
      if (!b && linked.n !== undefined && z < -ih + edge) b = true;
      if (!b && linked.s !== undefined && z > ih - edge) b = true;
      if (!b && linked.w !== undefined && x < -ih + edge) b = true;
      if (!b && linked.e !== undefined && x > ih - edge) b = true;
      // water, and a 2.5 m bank round it (a pocket's screen re-grades the ground under it: never a shore sample)
      if (!b && (waterAt(x, z) || waterAt(x + 2.5, z) || waterAt(x - 2.5, z) || waterAt(x, z + 2.5) || waterAt(x, z - 2.5))) b = true;
      if (
        !b &&
        plan.plaza !== null &&
        Math.hypot(x - plan.plaza.x, z - plan.plaza.z) < plan.plaza.r + 2
      )
        b = true;
      if (!b && inSetPiece(plan.setPiece, x, z, 2)) b = true;
      // level ground first: a hall dropped on a sculpt's cliff or crater rim would flatten it away
      if (!b && avoidSlopes && slopeAt(base, x, z) > 0.35) b = true;
      if (!b)
        for (const w of plan.water)
          if (roundBody(w) && Math.hypot(x - w.cx, z - w.cz) < w.r + 3) {
            b = true;
            break;
          }
      if (!b && avoidGrass)
        for (const e of plan.grassPatches)
          if (inEllipse(e, x, z, 1.5)) {
            b = true;
            break;
          }
      if (!b)
        for (const bd of plan.buildings)
          if (footprintDistance(bd, x, z) < 2.5) {
            b = true;
            break;
          }
      if (!b)
        for (const [px, pz] of points)
          if (Math.hypot(px - x, pz - z) < 3) {
            b = true;
            break;
          }
      if (!b)
        for (const s of small)
          if (Math.hypot(s.x - x, s.z - z) < s.r) {
            b = true;
            break;
          }
      if (!b && roadDistance(roads, x, z) < 1.5) b = true;
      if (b) blocked[i] = 1;
    }
  }
  const sat = new Int32Array((res + 1) * (res + 1));
  for (let row = 0; row < res; row++) {
    let acc = 0;
    for (let col = 0; col < res; col++) {
      acc += blocked[row * res + col]!;
      sat[(row + 1) * (res + 1) + col + 1] = sat[row * (res + 1) + col + 1]! + acc;
    }
  }
  return { res, originX, originZ, step, sat };
}

/** Blocked cells whose centres fall in [x0, x1] × [z0, z1] (world). */
function blockedIn(g: Grid, x0: number, x1: number, z0: number, z1: number): number {
  const c0 = Math.max(0, Math.ceil((x0 - g.originX) / g.step));
  const c1 = Math.min(g.res - 1, Math.floor((x1 - g.originX) / g.step));
  const r0 = Math.max(0, Math.ceil((z0 - g.originZ) / g.step));
  const r1 = Math.min(g.res - 1, Math.floor((z1 - g.originZ) / g.step));
  if (c1 < c0 || r1 < r0) return 0;
  const W = g.res + 1;
  return (
    g.sat[(r1 + 1) * W + c1 + 1]! -
    g.sat[r0 * W + c1 + 1]! -
    g.sat[(r1 + 1) * W + c0]! +
    g.sat[r0 * W + c0]!
  );
}

/** Outer half extents of a pocket in its local frame. */
function outerHalf(def: InteriorDef): { readonly hw: number; readonly hd: number } {
  return {
    hw: def.w / 2 + INTERIOR_WALL_T + INTERIOR_SCREEN_M,
    hd: def.d / 2 + INTERIOR_WALL_T + INTERIOR_SCREEN_M,
  };
}

const q64 = (v: number): number => {
  const k = Math.round(v * 64);
  return k === 0 ? 0 : k / 64;
};

/**
 * Lays out one pocket per town building: biggest first (league/gym hall, then healer, shop, houses), each at the
 * first clear candidate in scan order. Deterministic (no rng).
 */
export function planInteriors(zone: ZoneDef, plan: ZonePlan, base: Heightfield): InteriorPlan {
  if (zone.kind !== 'town') return { interiors: [], droppedSolids: [], unplaced: [] };
  const defs: InteriorDef[] = [];
  for (const b of plan.buildings) {
    const d = interiorDefFor(zone, b);
    if (d !== null) defs.push(d);
  }
  // hideouts (data/hideouts.ts): their halls go last, so the town's own pockets keep the spots they always had
  const hideouts = hideoutsFor(zone.id);
  for (const h of hideouts) {
    const d = hideoutHall(h);
    if (d !== null) defs.push(d);
  }
  const rank = (d: InteriorDef): number =>
    ({ league_hall: 0, gym_hall: 1, healer: 2, shop: 3, house_m: 4, house_s: 5, crypt: 6 })[d.template];
  const order = defs.map((d, i) => ({ d, i })).sort((a, b) => rank(a.d) - rank(b.d) || a.i - b.i);
  // level ground and no tall grass when possible; a hall that fits nowhere else may cover a slope or part of a patch
  const grids: (() => Grid)[] = [];
  let strict: Grid | null = null;
  let relaxed: Grid | null = null;
  let strictLevel: Grid | null = null;
  let relaxedLevel: Grid | null = null;
  grids.push(() => (strictLevel ??= blockedGrid(zone, plan, base, true, true)));
  grids.push(() => (relaxedLevel ??= blockedGrid(zone, plan, base, false, true)));
  grids.push(() => (strict ??= blockedGrid(zone, plan, base, true, false)));
  grids.push(() => (relaxed ??= blockedGrid(zone, plan, base, false, false)));
  const ih = plan.half - ZONE_MARGIN;
  // candidates: a 1 m lattice, outermost square ring first, then by angle
  const cands: { x: number; z: number; ring: number; ang: number }[] = [];
  for (let x = -Math.floor(ih); x <= Math.floor(ih); x++) {
    for (let z = -Math.floor(ih); z <= Math.floor(ih); z++)
      cands.push({ x, z, ring: Math.max(Math.abs(x), Math.abs(z)), ang: Math.atan2(z, x) });
  }
  cands.sort((a, b) => b.ring - a.ring || a.ang - b.ang);
  const placed: PlacedInterior[] = [];
  const unplaced: string[] = [];
  const GAP = 1;
  for (const { d: def } of order) {
    const oh = outerHalf(def);
    let found: PlacedInterior | null = null;
    for (const gridOf of grids) {
      if (found !== null) break;
      const grid = gridOf();
      for (const c of cands) {
        // long axis along the nearer side: the north/south bands run along x
        const ns = Math.abs(c.z) >= Math.abs(c.x);
        for (const alongX of ns ? [true, false] : [false, true]) {
          // local z along world x → yaw ±π/2; along world z → yaw 0 / π
          const hx = alongX ? oh.hd : oh.hw;
          const hz = alongX ? oh.hw : oh.hd;
          if (blockedIn(grid, c.x - hx, c.x + hx, c.z - hz, c.z + hz) !== 0) continue;
          if (
            placed.some(
              (p) =>
                Math.abs(p.footprint.x - c.x) < p.footprint.hw + hx + GAP &&
                Math.abs(p.footprint.z - c.z) < p.footprint.hd + hz + GAP,
            )
          )
            continue;
          // a hideout's hall keeps clear of the hideout buildings themselves (the town's pockets never test this)
          if (
            def.template === 'crypt' &&
            hideouts.some((h) => {
              const b = hideoutBounds(h);
              return Math.abs(b.x - c.x) < b.hw + hx + GAP + 2 && Math.abs(b.z - c.z) < b.hd + hz + GAP + 2;
            })
          )
            continue;
          // door (local +z) toward the town centre
          const yaw = alongX ? (c.x > 0 ? -Math.PI / 2 : Math.PI / 2) : c.z > 0 ? Math.PI : 0;
          const approach = plan.doors.find((dd) => dd.building === def.building);
          const hideout = hideouts.find((h) => h.id === def.building);
          const door =
            hideout !== undefined
              ? hideoutDoor(hideout)
              : approach === undefined
                ? { x: 0, z: 0 }
                : { x: approach.approach.x, z: approach.approach.z };
          found = {
            def,
            at: { x: c.x, z: c.z, yaw, floorY: 0 },
            footprint: { kind: 'rect', x: c.x, z: c.z, hw: hx, hd: hz, yaw: 0 },
            door,
          };
          break;
        }
        if (found !== null) break;
      }
    }
    if (found === null) unplaced.push(def.building);
    else placed.push(found);
  }
  // floor height: mean terrain height over the floor, quantised like the field
  const interiors = placed.map((p) => {
    let sum = 0;
    let n = 0;
    forSamplesInRect(
      base,
      p.footprint.x,
      p.footprint.z,
      p.footprint.hw - INTERIOR_SCREEN_M,
      p.footprint.hd - INTERIOR_SCREEN_M,
      (i) => {
        sum += base.heights[i]!;
        n++;
      },
    );
    return { ...p, at: { ...p.at, floorY: q64(n > 0 ? sum / n : 0) } };
  });
  // keep the building order in the output (stable ids for consumers)
  interiors.sort((a, b) => defs.indexOf(a.def) - defs.indexOf(b.def));
  const droppedSolids: number[] = [];
  plan.solids.forEach((s, i) => {
    if (!SCATTER.has(s.source)) return;
    // only scatter whose CENTRE stands in a pocket footprint is dropped (render drops the same set); a trunk whose
    // centre is outside keeps its stamp — it cannot reach the floor across the 2 m screen band
    if (interiors.some((p) => inFootprint(p, s.shape.x, s.shape.z)))
      droppedSolids.push(i);
  });
  return { interiors, droppedSolids, unplaced };
}

function forSamplesInRect(
  h: Pick<Heightfield, 'res' | 'originX' | 'originZ' | 'step'>,
  cx: number,
  cz: number,
  hw: number,
  hd: number,
  fn: (i: number, x: number, z: number) => void,
): void {
  const c0 = Math.max(0, Math.ceil((cx - hw - h.originX) / h.step));
  const c1 = Math.min(h.res - 1, Math.floor((cx + hw - h.originX) / h.step));
  const r0 = Math.max(0, Math.ceil((cz - hd - h.originZ) / h.step));
  const r1 = Math.min(h.res - 1, Math.floor((cz + hd - h.originZ) / h.step));
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++)
      fn(row * h.res + col, h.originX + col * h.step, h.originZ + row * h.step);
  }
}

// ─── stamping ────────────────────────────────────────────────────────────────

function smooth01(t: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return u * u * (3 - 2 * u);
}

/** Every unwalkable rect inside a pocket (internal walls), in the world frame, grown by the capsule radius. */
export function interiorWallSolids(p: PlacedInterior): readonly RectSolid[] {
  return p.def.walls.map((w) => rectToWorld(p, w, MOVER_RADIUS));
}

/**
 * Flattens each pocket's floor and walls to `floorY`, blends the screen band to the terrain, clears water, and
 * writes walkability: the floor (inset by the capsule radius) walkable, minus internal walls; walls and screen not.
 * Then re-checks slope just outside the screen (only ever turning samples unwalkable). In place.
 */
export function stampInteriors(
  h: Pick<Heightfield, 'res' | 'originX' | 'originZ' | 'step' | 'heights' | 'walkable' | 'water'>,
  interiors: readonly PlacedInterior[],
  maxSlope: number,
): void {
  const R = MOVER_RADIUS;
  for (const p of interiors) {
    const hw = p.def.w / 2;
    const hd = p.def.d / 2;
    forSamplesInRect(h, p.footprint.x, p.footprint.z, p.footprint.hw, p.footprint.hd, (i, x, z) => {
      const [lx, lz] = worldToLocal(p, x, z);
      const out = Math.max(
        Math.abs(lx) - (hw + INTERIOR_WALL_T),
        Math.abs(lz) - (hd + INTERIOR_WALL_T),
      );
      const orig = h.heights[i]!;
      h.heights[i] =
        out <= 0
          ? p.at.floorY
          : q64(p.at.floorY + (orig - p.at.floorY) * smooth01(out / INTERIOR_SCREEN_M));
      h.water[i] = 0;
      let walk = Math.abs(lx) < hw - R && Math.abs(lz) < hd - R;
      if (walk)
        for (const w of p.def.walls)
          if (Math.abs(lx - w.lx) < w.hw + R && Math.abs(lz - w.lz) < w.hd + R) {
            walk = false;
            break;
          }
      h.walkable[i] = walk ? 1 : 0;
    });
    // slope just outside the screen
    const ring = h.step * 2;
    forSamplesInRect(
      h,
      p.footprint.x,
      p.footprint.z,
      p.footprint.hw + ring,
      p.footprint.hd + ring,
      (i, x, z) => {
        if (
          Math.abs(x - p.footprint.x) < p.footprint.hw &&
          Math.abs(z - p.footprint.z) < p.footprint.hd
        )
          return;
        if (h.walkable[i] !== 1) return;
        const row = Math.floor(i / h.res);
        const col = i - row * h.res;
        if (row < 1 || col < 1 || row >= h.res - 1 || col >= h.res - 1) return;
        const sx = (h.heights[i + 1]! - h.heights[i - 1]!) / (2 * h.step);
        const sz = (h.heights[i + h.res]! - h.heights[i - h.res]!) / (2 * h.step);
        if (sx * sx + sz * sz > maxSlope * maxSlope) h.walkable[i] = 0;
      },
    );
  }
}

// ─── per-zone views (world coordinates) ──────────────────────────────────────

const w2 = (p: PlacedInterior, q: LocalPoint): Vec2 => localToWorld(p, q.lx, q.lz);
const xz = (v: Vec2): { x: number; z: number } => ({ x: v[0], z: v[1] });

/** `<id>.in` at the door approach → entry; `<id>.out` at the exit marker → the door approach. */
export function warpsOf(p: PlacedInterior): readonly WarpDef[] {
  const [ex, ez] = w2(p, p.def.entry);
  const [xx, xz] = w2(p, p.def.exit);
  return [
    {
      id: `${p.def.id}.in`,
      x: p.door.x,
      z: p.door.z,
      toX: ex,
      toZ: ez,
      label: `Enter ${p.def.label}`,
    },
    {
      id: `${p.def.id}.out`,
      x: xx,
      z: xz,
      toX: p.door.x,
      toZ: p.door.z,
      label: `Leave ${p.def.label}`,
    },
  ];
}

export function trainersOf(p: PlacedInterior): readonly TrainerDef[] {
  return p.def.trainers.map((t) => {
    const [x, z] = localToWorld(p, t.lx, t.lz);
    return {
      id: t.id,
      name: t.name,
      x,
      z,
      look: t.look,
      team: t.team,
      lines: t.lines,
      reward: t.reward,
      rematchDays: null,
      ...(t.requires !== undefined ? { requires: t.requires } : {}),
    };
  });
}

export function npcsOf(
  p: PlacedInterior,
): readonly (NpcDef & { readonly role: string; readonly facing: number; readonly persona?: string; readonly model?: string })[] {
  return p.def.npcs.map((n) => {
    const [x, z] = localToWorld(p, n.lx, n.lz);
    return {
      id: n.id,
      name: n.name,
      x,
      z,
      look: n.look,
      lines: n.lines,
      when: null,
      until: null,
      react: [],
      role: n.role,
      facing: localYawToWorld(p, n.facing),
      ...(n.persona !== undefined ? { persona: n.persona } : {}),
      ...(n.model !== undefined ? { model: n.model } : {}),
    };
  });
}

export interface WorldSwitch {
  readonly id: string;
  readonly interior: string;
  readonly kind: string;
  readonly x: number;
  readonly z: number;
  readonly sets: string | null;
  readonly requires: readonly string[];
  readonly warpTo: { readonly x: number; readonly z: number } | null;
  readonly label: string;
}
export function switchesOf(p: PlacedInterior): readonly WorldSwitch[] {
  return p.def.switches.map((s) => {
    const [x, z] = localToWorld(p, s.lx, s.lz);
    const to = s.warpTo === null ? null : w2(p, s.warpTo);
    return {
      id: s.id,
      interior: p.def.id,
      kind: s.kind,
      x,
      z,
      sets: s.sets,
      requires: s.requires,
      warpTo: to === null ? null : { x: to[0], z: to[1] },
      label: s.label,
    };
  });
}

export interface WorldGate {
  readonly id: string;
  readonly interior: string;
  readonly style: string;
  /** the physical gate (no capsule growth) */
  readonly rect: RectSolid;
  /** the centre-exclusion solid (grown by the capsule radius) — what movement checks */
  readonly solid: RectSolid;
  readonly opensWhen: readonly string[];
}
export function gatesOf(p: PlacedInterior): readonly WorldGate[] {
  return p.def.gates.map((g) => ({
    id: g.id,
    interior: p.def.id,
    style: g.style,
    rect: rectToWorld(p, g.rect),
    solid: rectToWorld(p, g.rect, MOVER_RADIUS),
    opensWhen: g.opensWhen,
  }));
}

export interface WorldLeader {
  readonly leagueId: string;
  readonly interior: string;
  readonly room: string;
  readonly x: number;
  readonly z: number;
  /** world yaw the leader faces (toward the door) */
  readonly facing: number;
  readonly arena: { readonly x: number; readonly z: number };
  /** the battle axis yaw (= the pocket yaw) */
  readonly yaw: number;
  /** until the player holds `until`, the leader stands at (x, z) here instead (room `greet`) */
  readonly greet: { readonly x: number; readonly z: number; readonly until: string } | null;
}

/** Where a hall leader stands for a player holding `flags`: the greet point until its flag, else `leaderAt`. */
export function leaderSpot(l: WorldLeader, flags: ReadonlySet<string>): { readonly x: number; readonly z: number } {
  return l.greet !== null && !flags.has(l.greet.until) ? l.greet : l;
}
export function leadersOf(p: PlacedInterior): readonly WorldLeader[] {
  const out: WorldLeader[] = [];
  for (const r of p.def.rooms) {
    if (r.leader === null || r.leaderAt === null) continue;
    const [x, z] = w2(p, r.leaderAt);
    const [ax, az] = w2(p, r.arena);
    out.push({
      leagueId: r.leader,
      interior: p.def.id,
      room: r.id,
      x,
      z,
      facing: localYawToWorld(p, 0),
      arena: { x: ax, z: az },
      yaw: p.at.yaw,
      greet: r.greet == null ? null : { ...xz(w2(p, r.greet.at)), until: r.greet.until },
    });
  }
  return out;
}

export function itemsOf(p: PlacedInterior): readonly {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly item: string;
  readonly qty: number;
  readonly requires?: readonly string[];
}[] {
  return p.def.items.map((it) => {
    const [x, z] = localToWorld(p, it.lx, it.lz);
    return { id: it.id, x, z, item: it.item, qty: it.qty, ...(it.requires !== undefined ? { requires: it.requires } : {}) };
  });
}

/**
 * The battle point for a fight started at (x, z): the arena of the room containing it, else the first room's arena
 * of the pocket containing it (gym trainers fight in the leader's chamber), else null (fight where you stand).
 */
export function arenaAt(
  interiors: readonly PlacedInterior[],
  x: number,
  z: number,
): {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly interior: string;
} | null {
  for (const p of interiors) {
    if (!onFloor(p, x, z)) continue;
    const [lx, lz] = worldToLocal(p, x, z);
    const room =
      p.def.rooms.find(
        (r) =>
          Math.abs(lx - r.bounds.lx) <= r.bounds.hw && Math.abs(lz - r.bounds.lz) <= r.bounds.hd,
      ) ?? p.def.rooms[0];
    // a shrine (too small for an arena) sends its fight out to the door approach
    if (room === undefined) return p.def.fightsAtDoor === true ? { x: p.door.x, z: p.door.z, yaw: p.at.yaw, interior: p.def.id } : null;
    const [ax, az] = w2(p, room.arena);
    return { x: ax, z: az, yaw: p.at.yaw, interior: p.def.id };
  }
  return null;
}

/** The closed gates' movement solids for a player holding `flags`. */
export function closedGateSolids(
  interiors: readonly PlacedInterior[],
  flags: ReadonlySet<string>,
): readonly WorldGate[] {
  const out: WorldGate[] = [];
  for (const p of interiors)
    for (const g of gatesOf(p)) if (!g.opensWhen.every((f) => flags.has(f))) out.push(g);
  return out;
}

// ─── progression walker (validation) ─────────────────────────────────────────

export interface InteriorWalk {
  /** trainer ids, switch ids and league ids in the order the walker reached them */
  readonly order: readonly string[];
  readonly flags: ReadonlySet<string>;
  /** league ids whose leader the walker reached */
  readonly leaders: readonly string[];
  /** the final reachable sample mask (field indices) */
  readonly reach: Uint8Array;
}

const INTERACT_M = 3;
const LEADER_M = 4;

function bfsPocket(
  h: Heightfield,
  p: PlacedInterior,
  sources: readonly Vec2[],
  closed: readonly RectSolid[],
): Uint8Array {
  const out = new Uint8Array(h.res * h.res);
  const f = p.footprint;
  const c0 = Math.max(0, Math.ceil((f.x - f.hw - h.originX) / h.step));
  const c1 = Math.min(h.res - 1, Math.floor((f.x + f.hw - h.originX) / h.step));
  const r0 = Math.max(0, Math.ceil((f.z - f.hd - h.originZ) / h.step));
  const r1 = Math.min(h.res - 1, Math.floor((f.z + f.hd - h.originZ) / h.step));
  const ok = (i: number): boolean => {
    if (h.walkable[i] !== 1) return false;
    const row = Math.floor(i / h.res);
    const col = i - row * h.res;
    if (row < r0 || row > r1 || col < c0 || col > c1) return false;
    const x = h.originX + col * h.step;
    const z = h.originZ + row * h.step;
    for (const g of closed) if (rectContainsYawed(g, x, z)) return false;
    return true;
  };
  const stack: number[] = [];
  for (const [sx, sz] of sources) {
    const i = Math.round((sz - h.originZ) / h.step) * h.res + Math.round((sx - h.originX) / h.step);
    if (ok(i) && out[i] === 0) {
      out[i] = 1;
      stack.push(i);
    }
  }
  while (stack.length > 0) {
    const i = stack.pop()!;
    for (const j of [i - 1, i + 1, i - h.res, i + h.res])
      if (out[j] === 0 && ok(j)) {
        out[j] = 1;
        stack.push(j);
      }
  }
  return out;
}

function rectContainsYawed(s: RectSolid, x: number, z: number): boolean {
  const dx = x - s.x;
  const dz = z - s.z;
  const c = Math.cos(s.yaw);
  const sn = Math.sin(s.yaw);
  return Math.abs(c * dx - sn * dz) < s.hw && Math.abs(sn * dx + c * dz) < s.hd;
}

/** True when some sample of `reach` lies within `r` of (x, z). */
export function reachNear(
  h: Heightfield,
  reach: Uint8Array,
  x: number,
  z: number,
  r: number,
): boolean {
  let hit = false;
  forSamplesInRect(h, x, z, r, r, (i, sx, sz) => {
    if (!hit && reach[i] === 1 && (sx - x) * (sx - x) + (sz - z) * (sz - z) <= r * r) hit = true;
  });
  return hit;
}

/**
 * Walks a pocket from its entry holding `start`: repeatedly beats every reachable trainer, uses every reachable
 * switch whose `requires` it holds (following teleports), and — with `beatLeaders` — beats every reachable leader
 * (adding the league row's `setsFlags`), until nothing changes. Movement honours the walls (the stamped field) and
 * every gate whose `opensWhen` it does not hold.
 */
export function walkInterior(
  h: Heightfield,
  p: PlacedInterior,
  start: ReadonlySet<string>,
  opts: {
    readonly beatLeaders?: boolean;
    readonly useSwitches?: boolean;
    readonly beatTrainers?: boolean;
    /** add a beaten leader's `setsFlags` (default true) */
    readonly leaderFlags?: boolean;
  } = {},
): InteriorWalk {
  const flags = new Set(start);
  const order: string[] = [];
  const leaders: string[] = [];
  const sources: Vec2[] = [w2(p, p.def.entry)];
  const trainers = trainersOf(p);
  const switches = switchesOf(p);
  const gates = gatesOf(p);
  const rooms = leadersOf(p);
  const used = new Set<string>();
  let reach: Uint8Array = new Uint8Array(0);
  for (let pass = 0; pass < 64; pass++) {
    reach = bfsPocket(
      h,
      p,
      sources,
      gates.filter((g) => !g.opensWhen.every((f) => flags.has(f))).map((g) => g.solid),
    );
    let changed = false;
    if (opts.beatTrainers !== false) {
      for (const t of trainers) {
        const f = `trainer:${t.id}:beaten`;
        // a shrine guardian (requires) fights only once its flags are held
        if (t.requires !== undefined && !t.requires.every((x) => flags.has(x))) continue;
        if (!flags.has(f) && reachNear(h, reach, t.x, t.z, INTERACT_M)) {
          flags.add(f);
          order.push(t.id);
          changed = true;
        }
      }
    }
    if (opts.useSwitches !== false) {
      for (const s of switches) {
        if (
          used.has(s.id) ||
          !s.requires.every((f) => flags.has(f)) ||
          !reachNear(h, reach, s.x, s.z, INTERACT_M)
        )
          continue;
        used.add(s.id);
        order.push(s.id);
        changed = true;
        if (s.sets !== null) flags.add(s.sets);
        if (s.warpTo !== null) sources.push([s.warpTo.x, s.warpTo.z]);
      }
    }
    if (opts.beatLeaders === true) {
      for (const l of rooms) {
        if (leaders.includes(l.leagueId) || !reachNear(h, reach, l.x, l.z, LEADER_M)) continue;
        leaders.push(l.leagueId);
        order.push(l.leagueId);
        changed = true;
        const row = LEAGUE.find((x) => x.id === l.leagueId);
        if (opts.leaderFlags !== false) for (const f of row?.setsFlags ?? []) flags.add(f);
      }
    }
    if (!changed) break;
  }
  return { order, flags, leaders, reach };
}

/** Problems with one placed pocket on its stamped field (empty when clean). */
export function checkInterior(h: Heightfield, p: PlacedInterior): string[] {
  const errs: string[] = [];
  const id = p.def.id;
  const [ex, ez] = w2(p, p.def.entry);
  const entryIdx =
    Math.round((ez - h.originZ) / h.step) * h.res + Math.round((ex - h.originX) / h.step);
  if (h.walkable[entryIdx] !== 1) errs.push(`${id}: entry is not walkable`);
  // the full walk is the postgame player's: a relic shrine opens on the Champion's flag (data/shrines.ts)
  const full = walkInterior(h, p, new Set([POSTGAME_FLAG]), { beatLeaders: true });
  const [xx, xz] = w2(p, p.def.exit);
  if (!reachNear(h, full.reach, xx, xz, INTERACT_M))
    errs.push(`${id}: exit not reachable from the entry`);
  for (const r of leadersOf(p))
    if (!full.leaders.includes(r.leagueId))
      errs.push(`${id}: leader ${r.leagueId} not reachable (order ${full.order.join(' → ')})`);
  for (const t of p.def.trainers)
    if (!full.order.includes(t.id)) errs.push(`${id}: trainer ${t.id} never reached`);
  for (const s of p.def.switches)
    if (!full.order.includes(s.id)) errs.push(`${id}: switch ${s.id} never usable`);
  for (const n of npcsOf(p))
    if (!reachNear(h, full.reach, n.x, n.z, INTERACT_M))
      errs.push(`${id}: npc ${n.id} not reachable`);
  for (const it of itemsOf(p))
    if (!reachNear(h, full.reach, it.x, it.z, INTERACT_M))
      errs.push(`${id}: item ${it.id} not reachable`);
  for (const b of p.def.boards ?? []) {
    const [bx, bz] = localToWorld(p, b.lx, b.lz);
    if (!reachNear(h, full.reach, bx, bz, INTERACT_M)) errs.push(`${id}: board ${b.id} not reachable`);
  }
  // a legendary that waits in this hall (data/hideouts.ts): on the floor and reachable once the Champion is beaten
  for (const s of LEGENDARY_STATICS) {
    if (s.zoneId !== p.def.zoneId || s.interior?.building !== p.def.building) continue;
    const [sx, sz] = localToWorld(p, s.interior.lx, s.interior.lz);
    if (!onFloor(p, sx, sz)) errs.push(`${id}: static ${s.species} is not on the floor`);
    else if (!reachNear(h, full.reach, sx, sz, INTERACT_M)) errs.push(`${id}: static ${s.species} not reachable`);
  }
  // with every gate closed, no flags and no switches, no leader past the first room is reachable
  const shut = walkInterior(h, p, new Set(), {
    useSwitches: false,
    beatTrainers: false,
    beatLeaders: true,
    leaderFlags: false,
  });
  // a greeting leader must be reachable from the entry with every gate closed (its beat plays before any fight)
  for (const l of leadersOf(p)) if (l.greet !== null && !reachNear(h, shut.reach, l.greet.x, l.greet.z, LEADER_M)) errs.push(`${id}: ${l.leagueId} greets out of reach`);
  const firstOpen = p.def.template === 'league_hall' ? 1 : 0;
  shut.leaders.forEach((l) => {
    const k = p.def.rooms.findIndex((r) => r.leader === l);
    if (k >= firstOpen) errs.push(`${id}: leader ${l} reachable with every gate closed`);
  });
  // arenas: clearance from the hall walls and internal walls, both trainer slots on walkable floor, Pillar 7 walk
  for (const r of p.def.rooms) {
    const a = r.arena;
    if (
      p.def.w / 2 - Math.abs(a.lx) < ARENA_CLEARANCE_M ||
      p.def.d / 2 - Math.abs(a.lz) < ARENA_CLEARANCE_M
    )
      errs.push(`${id}: arena ${r.id} closer than ${ARENA_CLEARANCE_M} m to the hall wall`);
    for (const w of p.def.walls) {
      const dx = Math.max(0, Math.abs(a.lx - w.lx) - w.hw);
      const dz = Math.max(0, Math.abs(a.lz - w.lz) - w.hd);
      if (Math.hypot(dx, dz) < ARENA_CLEARANCE_M)
        errs.push(`${id}: arena ${r.id} closer than ${ARENA_CLEARANCE_M} m to an internal wall`);
    }
    for (const s of [ARENA_SLOT_M, -ARENA_SLOT_M]) {
      const [sx, sz] = localToWorld(p, a.lx, a.lz + s);
      const i =
        Math.round((sz - h.originZ) / h.step) * h.res + Math.round((sx - h.originX) / h.step);
      if (h.walkable[i] !== 1) errs.push(`${id}: arena ${r.id} trainer slot ${s} not on the floor`);
    }
  }
  if (p.def.template === 'gym_hall') {
    const a = p.def.rooms[0]!.arena;
    if (Math.hypot(a.lx - p.def.entry.lx, a.lz - p.def.entry.lz) > 30)
      errs.push(`${id}: entry → arena > 30 m`);
  }
  return errs;
}
