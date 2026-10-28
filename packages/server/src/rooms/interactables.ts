/**
 * §30.4.6 interact targets — resolves `interact { kind, targetId }` to a content object with world
 * coordinates, and the range each kind is checked against.
 *
 * Interiors (Phase A): every town building opens into a pocket hall reached by door warps. Warps, trainers, ground
 * items and switches of those halls resolve here alongside the zone's own (content `interior*` accessors, world
 * coordinates). A league trainer is challenged where it stands in its hall (`interiorLeaders` x/z, checked at 4 m).
 * `LEAGUE_MARKER` (0, −26) is only the fallback for a league trainer with no hall (IMPLEMENTATION-NOTES R5).
 */
import { OBSTACLE_INTERACT_M, foosballTrainers, leaderSpot, LEAGUE, interiorItems, interiorLeaders, interiorSwitches, interiorTrainers, interiorWarps, staticsFor } from '@ewa/content';
import type { GroundItemDef, LeagueTrainer, LegendaryStatic, LoreTabletDef, NpcDef, ObstacleDef, TrainerDef, WarpDef, WorldSwitch, ZoneDef } from '@ewa/content';
import type { InteractKind } from '@ewa/protocol';

export const INTERACT_RANGE_M = 3;
export const GYM_RANGE_M = 4;
export const LEAGUE_MARKER = { x: 0, z: -26 } as const;

export type InteractTarget =
  | { readonly kind: 'npc'; readonly npc: NpcDef; readonly x: number; readonly z: number }
  | { readonly kind: 'trainer'; readonly trainer: TrainerDef; readonly x: number; readonly z: number }
  | { readonly kind: 'gym'; readonly league: LeagueTrainer; readonly x: number; readonly z: number }
  | { readonly kind: 'item'; readonly item: GroundItemDef; readonly x: number; readonly z: number }
  | { readonly kind: 'lore'; readonly lore: LoreTabletDef; readonly x: number; readonly z: number }
  | { readonly kind: 'warp'; readonly warp: WarpDef; readonly x: number; readonly z: number }
  | { readonly kind: 'static'; readonly static: LegendaryStatic; readonly x: number; readonly z: number }
  | { readonly kind: 'switch'; readonly sw: WorldSwitch; readonly x: number; readonly z: number }
  /** Phase D10: a Cut tree / Strength boulder of `ZoneDef.obstacles` */
  | { readonly kind: 'obstacle'; readonly obstacle: ObstacleDef; readonly x: number; readonly z: number };

/** League trainers fought in this zone (gyms in their town, elite/champion in solenne). */
export function leagueIn(zone: ZoneDef): readonly LeagueTrainer[] {
  return LEAGUE.filter((l) => l.zoneId === zone.id);
}

/** Where a league trainer is challenged: its spot in its hall, else the legacy marker. */
export function leaguePosition(zone: ZoneDef, leagueId: string, flags: ReadonlySet<string> = new Set()): { readonly x: number; readonly z: number } {
  const l = interiorLeaders(zone.id).find((x) => x.leagueId === leagueId);
  return l === undefined ? LEAGUE_MARKER : leaderSpot(l, flags);
}

/**
 * `npc` covers NpcDef ids and TrainerDef ids — the zone's and the halls' (the client targets whichever actor it
 * faces; trainers are actors with `kind: 'trainer'` in the render spec). `gym` resolves LeagueTrainer ids fought in
 * this zone. Interior NPCs (shopkeepers, residents) are client-local dialogue and never resolve here.
 */
/** `flags`: the player's flags (a hall leader may greet elsewhere until a story flag — content `leaderSpot`). */
export function findTarget(zone: ZoneDef, kind: InteractKind, targetId: string, flags: ReadonlySet<string> = new Set()): InteractTarget | null {
  switch (kind) {
    case 'npc': {
      const npc = zone.npcs.find((n) => n.id === targetId);
      if (npc !== undefined) return { kind: 'npc', npc, x: npc.x, z: npc.z };
      const trainer = zone.trainers.find((t) => t.id === targetId) ?? interiorTrainers(zone.id).find((t) => t.id === targetId) ?? foosballTrainers(zone.id).find((t) => t.id === targetId);
      if (trainer !== undefined) return { kind: 'trainer', trainer, x: trainer.x, z: trainer.z };
      return null;
    }
    case 'gym': {
      const league = leagueIn(zone).find((l) => l.id === targetId);
      if (league === undefined) return null;
      const at = leaguePosition(zone, league.id, flags);
      return { kind: 'gym', league, x: at.x, z: at.z };
    }
    case 'item': {
      const item = zone.items.find((i) => i.id === targetId) ?? interiorItems(zone.id).find((i) => i.id === targetId);
      return item === undefined ? null : { kind: 'item', item, x: item.x, z: item.z };
    }
    case 'lore': {
      const lore = zone.lore.find((l) => l.id === targetId);
      return lore === undefined ? null : { kind: 'lore', lore, x: lore.x, z: lore.z };
    }
    case 'warp': {
      const warp = zone.warps.find((w) => w.id === targetId) ?? interiorWarps(zone.id).find((w) => w.id === targetId);
      return warp === undefined ? null : { kind: 'warp', warp, x: warp.x, z: warp.z };
    }
    case 'static': {
      const st = staticsFor(zone.id).find((s) => s.species === targetId);
      return st === undefined ? null : { kind: 'static', static: st, x: st.x, z: st.z };
    }
    case 'switch': {
      const sw = interiorSwitches(zone.id).find((s) => s.id === targetId);
      return sw === undefined ? null : { kind: 'switch', sw, x: sw.x, z: sw.z };
    }
    case 'obstacle': {
      const o = zone.obstacles?.find((x) => x.id === targetId);
      return o === undefined ? null : { kind: 'obstacle', obstacle: o, x: o.x, z: o.z };
    }
    default:
      // healer / shop: no-ops over the room (POST /heal, GET /shop/:zoneId)
      return null;
  }
}

export function rangeFor(t: InteractTarget): number {
  return t.kind === 'gym' ? GYM_RANGE_M : t.kind === 'obstacle' ? OBSTACLE_INTERACT_M : INTERACT_RANGE_M;
}

/** Ground-item pickup flag: once per player (§30.4.6). Interior items share the scheme. */
export function itemFlag(zone: ZoneDef, item: GroundItemDef): string {
  return `item:${zone.id}:${item.id}`;
}

export function trainerBeatenFlag(trainerId: string): string {
  return `trainer:${trainerId}:beaten`;
}
