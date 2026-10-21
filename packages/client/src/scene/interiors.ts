/**
 * Phase A interiors on the client: every town building opens into a POCKET (a walled roofless hall in the zone's own
 * outer band, content `PlacedInterior`), reached only by door warps. This module is the client's pure glue over the
 * content accessors:
 *
 * - `interiorInteractables` registers the door warps ('Enter X' / 'Leave X'), one league challenge per trainer at
 *   its `leaderAt`, the gym trainers, switches, the shop keeper / nurse (the shop and healer moved inside), the
 *   healer's PC, residents and guides (client-local dialogue) and hidden items;
 * - `FloorIndex` answers "which pocket's floor is (x, z) on" without allocating (the director asks every step);
 * - `pocketActors` lists what the actor pool shows while the player stands in a pocket;
 * - `GateSync` turns `gatesClosedFor(zone, flags)` into collider blockers + `InteriorsHandle.setGateOpen` and switch
 *   tiles into `setSwitchOn` — only on change.
 */
import {
  LEAGUE,
  gatesClosedFor,
  interiorGates,
  interiorItems,
  interiorLeaders,
  leaderSpot,
  interiorNpcs,
  interiorSwitches,
  interiorTrainerFlag,
  interiorTrainers,
  interiorWarps,
  interiorsFor,
  localToWorld,
  localYawToWorld,
} from '@ewa/content';
import type { PlacedInterior, ZoneId } from '@ewa/content';
import type { HallBounds, InteriorsHandle } from '@ewa/render';
import { itemInfo } from '../data/content';
import type { GateBlockers } from './collider';
import type { Interactable } from './interaction';
import { makeInteractable } from './interaction';

const RAD2DEG = 180 / Math.PI;

// ─── geometry ─────────────────────────────────────────────────────────────────

/**
 * The camera yaw base (degrees) that looks down a pocket's hall. The rig's forward at yaw θ is (−sin θ, −cos θ); a
 * pocket's local +z (the door side) is world (sin yaw, cos yaw), so θ = pocket yaw looks from the door toward the far
 * end (local −z) at heading 0 — the leader's chamber is straight ahead, and the battle axis (player near, foe far)
 * matches the stage's slots.
 */
export function pocketYawDeg(p: Pick<PlacedInterior, 'at'>): number {
  const d = Math.round(p.at.yaw * RAD2DEG);
  return d === 0 ? 0 : d; // no −0
}

/** The pocket's floor rectangle in the world (battle dressing stays on it). */
export function hallBoundsOf(p: PlacedInterior): HallBounds {
  return { x: p.at.x, z: p.at.z, yaw: p.at.yaw, hw: p.def.w / 2, hd: p.def.d / 2 };
}

/** "Enter Mirevale Gym" → verb "Enter", target "Mirevale Gym" (the HUD prompt draws the target in gold). */
export function splitLabel(label: string): { readonly verb: string; readonly target: string } {
  const i = label.indexOf(' ');
  return i < 0 ? { verb: label, target: '' } : { verb: label.slice(0, i), target: label.slice(i + 1) };
}

interface FloorEntry {
  readonly p: PlacedInterior;
  readonly x: number;
  readonly z: number;
  readonly c: number;
  readonly s: number;
  readonly hw: number;
  readonly hd: number;
}

/** content `onFloor` over a zone's pockets, allocation-free (the director asks once per fixed step). */
export class FloorIndex {
  private readonly list: readonly FloorEntry[];
  constructor(pockets: readonly PlacedInterior[]) {
    this.list = pockets.map((p) => ({ p, x: p.at.x, z: p.at.z, c: Math.cos(p.at.yaw), s: Math.sin(p.at.yaw), hw: p.def.w / 2, hd: p.def.d / 2 }));
  }
  get size(): number {
    return this.list.length;
  }
  /** The pocket whose floor contains (x, z) — the same test as content `interiorAt` — or null. */
  at(x: number, z: number): PlacedInterior | null {
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i]!;
      const dx = x - e.x;
      const dz = z - e.z;
      if (Math.abs(e.c * dx - e.s * dz) <= e.hw && Math.abs(e.s * dx + e.c * dz) <= e.hd) return e.p;
    }
    return null;
  }
}

// ─── actors ───────────────────────────────────────────────────────────────────

export interface PocketActor {
  readonly id: string;
  readonly look: string;
  readonly name: string;
  readonly x: number;
  readonly z: number;
  /** heading atan2(dx, dz): 0 faces +z */
  readonly angle: number;
  readonly kind: 'npc' | 'trainer' | 'leader';
}

/** What stands in a pocket: its NPCs, gym trainers (facing from the def) and league trainers at `leaderAt`, facing the door. */
export function pocketActors(zoneId: ZoneId, p: PlacedInterior, flags: ReadonlySet<string> = new Set()): PocketActor[] {
  const out: PocketActor[] = [];
  for (const n of interiorNpcs(zoneId)) {
    if (n.interior !== p.def.id) continue;
    out.push({ id: n.id, look: n.look, name: n.name, x: n.x, z: n.z, angle: n.facing, kind: 'npc' });
  }
  for (const t of p.def.trainers) {
    const [x, z] = localToWorld(p, t.lx, t.lz);
    out.push({ id: t.id, look: t.look, name: t.name, x, z, angle: localYawToWorld(p, t.facing), kind: 'trainer' });
  }
  for (const l of interiorLeaders(zoneId)) {
    if (l.interior !== p.def.id) continue;
    const lt = LEAGUE.find((x) => x.id === l.leagueId);
    if (lt === undefined) continue;
    const at = leaderSpot(l, flags);
    out.push({ id: lt.id, look: lt.look, name: lt.name, x: at.x, z: at.z, angle: l.facing, kind: 'leader' });
  }
  return out;
}

/** The most rigs any one pocket of the zone takes (reserved off the remote-player budget). */
export function pocketActorMax(zoneId: ZoneId): number {
  let max = 0;
  for (const p of interiorsFor(zoneId)) max = Math.max(max, pocketActors(zoneId, p).length);
  return max;
}

// ─── interactables ────────────────────────────────────────────────────────────

/** Interactable id of the healer PC in pocket `interiorId`. */
export const pcId = (interiorId: string): string => `pc:${interiorId}`;

/**
 * Everything the player can press E on inside the zone's pockets. Ids: warps / trainers / switches / items / NPCs by
 * their content id, league trainers by their league id (kind 'gym'), `shop:<keeper id>` / `healer:<nurse id>`,
 * `pc:<interior id>`.
 */
export function interiorInteractables(zoneId: ZoneId, flags: ReadonlySet<string>, key: string): Interactable[] {
  const out: Interactable[] = [];
  for (const w of interiorWarps(zoneId)) {
    const l = splitLabel(w.label);
    out.push(makeInteractable(w.id, 'warp', w.x, w.z, l.verb, l.target, key));
  }
  for (const l of interiorLeaders(zoneId)) {
    const lt = LEAGUE.find((x) => x.id === l.leagueId);
    if (lt === undefined) continue;
    const at = leaderSpot(l, flags);
    out.push(makeInteractable(lt.id, 'gym', at.x, at.z, 'Challenge', lt.name, key));
  }
  for (const t of interiorTrainers(zoneId)) {
    const e = makeInteractable(t.id, 'trainer', t.x, t.z, 'Challenge', t.name, key);
    e.enabled = !flags.has(interiorTrainerFlag(t.id));
    out.push(e);
  }
  for (const s of interiorSwitches(zoneId)) {
    const l = splitLabel(s.label);
    const e = makeInteractable(s.id, 'switch', s.x, s.z, l.verb, l.target, key);
    e.enabled = switchUsable(s, flags);
    out.push(e);
  }
  const pockets = interiorsFor(zoneId);
  for (const n of interiorNpcs(zoneId)) {
    const p = pockets.find((x) => x.def.id === n.interior);
    if (n.role === 'shopkeeper') out.push(makeInteractable(`shop:${n.id}`, 'shop', n.x, n.z, 'Shop at', p?.def.label ?? n.name, key));
    else if (n.role === 'nurse') out.push(makeInteractable(`healer:${n.id}`, 'healer', n.x, n.z, 'Rest with', n.name, key));
    // Phase D14: the battle tower attendant (Solenne's league hall foyer)
    else if (n.role === 'tower') out.push(makeInteractable(n.id, 'tower', n.x, n.z, 'Talk to', n.name, key));
    // breeding: the Daycare keeper talks like a resident; World3D opens the Daycare when the lines end
    else if (n.role === 'daycare') out.push(makeInteractable(n.id, 'npc', n.x, n.z, 'Talk to', n.name, key));
    else out.push(makeInteractable(n.id, 'npc', n.x, n.z, 'Talk to', n.name, key));
  }
  for (const p of pockets) {
    for (const q of p.def.props) {
      if (q.kind !== 'pc') continue;
      const [x, z] = localToWorld(p, q.lx, q.lz);
      out.push(makeInteractable(pcId(p.def.id), 'pc', x, z, 'Use', 'the PC', key));
    }
  }
  for (const i of interiorItems(zoneId)) {
    const e = makeInteractable(i.id, 'item', i.x, i.z, 'Pick up', `${itemInfo(i.item).name}${i.qty > 1 ? ` ×${i.qty}` : ''}`, key);
    e.enabled = !flags.has(`item:${zoneId}:${i.id}`);
    out.push(e);
  }
  return out;
}

/** A switch stays offered until its flag is held; a teleport tile (no flag, or a warp) always. */
function switchUsable(s: { readonly sets: string | null; readonly warpTo: unknown }, flags: ReadonlySet<string>): boolean {
  return s.sets === null || s.warpTo !== null || !flags.has(s.sets);
}

/** Re-enables / disables the pocket targets for new flags (gym trainers beaten, switches used, items taken). */
export function refreshInteriorTargets(zoneId: ZoneId, entries: readonly Interactable[], flags: ReadonlySet<string>): void {
  const switches = interiorSwitches(zoneId);
  for (const e of entries) {
    if (e.kind === 'trainer') {
      if (interiorTrainers(zoneId).some((t) => t.id === e.id)) e.enabled = !flags.has(interiorTrainerFlag(e.id));
    } else if (e.kind === 'switch') {
      const s = switches.find((x) => x.id === e.id);
      if (s !== undefined) e.enabled = switchUsable(s, flags);
    }
  }
}

// ─── gates + switch tiles ─────────────────────────────────────────────────────

/**
 * Per-player gate state → collider blockers and the renderer, on change only. A closed gate blocks prediction with
 * its `.solid` (the capsule-grown centre-exclusion shape the server checks), so prediction is exactly as strict as
 * the server for flags the client holds — and stricter while a flag is still in flight, never looser.
 */
export class GateSync {
  private readonly closed = new Map<string, boolean>();
  private readonly on = new Map<string, boolean>();

  /** One per zone build: the first `sync` pushes every gate and switch state (blockers start empty). */
  constructor(
    private readonly zoneId: ZoneId,
    private readonly blockers: GateBlockers | null,
  ) {}

  sync(flags: ReadonlySet<string>, handle: InteriorsHandle | null | undefined): void {
    const shut = new Set(gatesClosedFor(this.zoneId, flags).map((g) => g.id));
    for (const g of interiorGates(this.zoneId)) {
      const isClosed = shut.has(g.id);
      if (this.closed.get(g.id) === isClosed) continue;
      this.closed.set(g.id, isClosed);
      if (isClosed) this.blockers?.addBlocker(g.id, g.solid);
      else this.blockers?.removeBlocker(g.id);
      handle?.setGateOpen(g.id, !isClosed);
    }
    for (const s of interiorSwitches(this.zoneId)) {
      const lit = s.sets !== null && flags.has(s.sets);
      if (this.on.get(s.id) === lit) continue;
      this.on.set(s.id, lit);
      handle?.setSwitchOn(s.id, lit);
    }
  }
}

/** Hall leaders whose spot depends on a flag (content `leaderSpot`): where each stands for `flags`. */
export function leaderSpots(zoneId: ZoneId, flags: ReadonlySet<string>): ReadonlyMap<string, { readonly x: number; readonly z: number }> {
  const out = new Map<string, { readonly x: number; readonly z: number }>();
  for (const l of interiorLeaders(zoneId)) if (l.greet !== null) out.set(l.leagueId, leaderSpot(l, flags));
  return out;
}
