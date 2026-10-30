/**
 * Per-zone interior views in world coordinates, memoised over `getZoneSurface(zoneId).interiors`. Server, client and
 * render ask these instead of walking `InteriorDef`s themselves.
 */
import { getZoneSurface } from './heightfield';
import {
  arenaAt,
  closedGateSolids,
  gatesOf,
  inFootprint,
  itemsOf,
  leadersOf,
  npcsOf,
  onFloor,
  switchesOf,
  trainersOf,
  warpsOf,
} from './interiors';
import type { PlacedInterior, WorldGate, WorldLeader, WorldSwitch } from './interiors';
import type { NpcDef, TrainerDef, WarpDef, ZoneId } from './types';

interface ZoneInteriors {
  readonly all: readonly PlacedInterior[];
  readonly warps: readonly WarpDef[];
  readonly trainers: readonly TrainerDef[];
  readonly npcs: readonly (NpcDef & { readonly role: string; readonly facing: number; readonly interior: string; readonly persona?: string; readonly model?: string })[];
  readonly switches: readonly WorldSwitch[];
  readonly gates: readonly WorldGate[];
  readonly leaders: readonly WorldLeader[];
  readonly items: readonly { readonly id: string; readonly x: number; readonly z: number; readonly item: string; readonly qty: number; readonly requires?: readonly string[]; readonly interior: string }[];
}

const memo = new Map<ZoneId, ZoneInteriors>();

function of(zoneId: ZoneId): ZoneInteriors {
  const hit = memo.get(zoneId);
  if (hit !== undefined) return hit;
  const all = getZoneSurface(zoneId).interiors;
  const v: ZoneInteriors = {
    all,
    warps: all.flatMap(warpsOf),
    trainers: all.flatMap(trainersOf),
    npcs: all.flatMap((p) => npcsOf(p).map((n) => ({ ...n, interior: p.def.id }))),
    switches: all.flatMap(switchesOf),
    gates: all.flatMap(gatesOf),
    leaders: all.flatMap(leadersOf),
    items: all.flatMap((p) => itemsOf(p).map((i) => ({ ...i, interior: p.def.id }))),
  };
  memo.set(zoneId, v);
  return v;
}

/** The zone's pockets ([] outside towns). */
export function interiorsFor(zoneId: ZoneId): readonly PlacedInterior[] {
  return of(zoneId).all;
}
/** The pocket whose FLOOR contains (x, z), or null. */
export function interiorAt(zoneId: ZoneId, x: number, z: number): PlacedInterior | null {
  return of(zoneId).all.find((p) => onFloor(p, x, z)) ?? null;
}
/** The pocket whose outer footprint (floor, walls, screen) contains (x, z), or null. */
export function interiorFootprintAt(zoneId: ZoneId, x: number, z: number): PlacedInterior | null {
  return of(zoneId).all.find((p) => inFootprint(p, x, z)) ?? null;
}
/** Where a battle started at (x, z) forms its arena (a hall's room arena), or null to fight where you stand. */
export function interiorArenaFor(zoneId: ZoneId, x: number, z: number): { readonly x: number; readonly z: number; readonly yaw: number; readonly interior: string } | null {
  return arenaAt(of(zoneId).all, x, z);
}
/** `<id>.in` / `<id>.out` door warps of every pocket. */
export function interiorWarps(zoneId: ZoneId): readonly WarpDef[] {
  return of(zoneId).warps;
}
/** Gym trainers as plain TrainerDefs in world coordinates (beaten flag `trainer:<id>:beaten`, no rematch). */
export function interiorTrainers(zoneId: ZoneId): readonly TrainerDef[] {
  return of(zoneId).trainers;
}
/** Shopkeepers, nurses, guides and residents in world coordinates (client-local dialogue). */
export function interiorNpcs(zoneId: ZoneId): ZoneInteriors['npcs'] {
  return of(zoneId).npcs;
}
export function interiorSwitches(zoneId: ZoneId): readonly WorldSwitch[] {
  return of(zoneId).switches;
}
export function interiorGates(zoneId: ZoneId): readonly WorldGate[] {
  return of(zoneId).gates;
}
/** League trainers standing in halls: where each waits, the arena in front of them, the battle axis yaw. */
export function interiorLeaders(zoneId: ZoneId): readonly WorldLeader[] {
  return of(zoneId).leaders;
}
/** Ground items hidden in houses (pickup flag `item:<zone>:<id>`, as for zone items). */
export function interiorItems(zoneId: ZoneId): ZoneInteriors['items'] {
  return of(zoneId).items;
}
/** The gates still shut for a player holding `flags` (movement solids are `.solid`, grown by the capsule radius). */
export function gatesClosedFor(zoneId: ZoneId, flags: ReadonlySet<string>): readonly WorldGate[] {
  return closedGateSolids(of(zoneId).all, flags);
}
