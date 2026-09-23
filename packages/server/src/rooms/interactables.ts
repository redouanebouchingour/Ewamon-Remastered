/**
 * §30.4.6 interact targets — resolves `interact { kind, targetId }` to a content object with world
 * coordinates, and the range each kind is checked against.
 *
 * Gym marker (IMPLEMENTATION-NOTES R5): content has no coordinate for a gym door (render's town layout puts
 * the gym at the plaza ring's north-most slot, seeded). The server fixes the league marker at
 * `LEAGUE_MARKER` (0, −26) in every town with a gym and in `solenne` (Wardens/Champion), checked at 4 m —
 * the client adapter must place the gym door there.
 */
import { LEAGUE, staticsFor } from '@ewa/content';
import type { GroundItemDef, LeagueTrainer, LegendaryStatic, LoreTabletDef, NpcDef, TrainerDef, WarpDef, ZoneDef } from '@ewa/content';
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
  | { readonly kind: 'static'; readonly static: LegendaryStatic; readonly x: number; readonly z: number };

/** League trainers fought in this zone (gyms in their town, elite/champion in solenne). */
export function leagueIn(zone: ZoneDef): readonly LeagueTrainer[] {
  return LEAGUE.filter((l) => l.zoneId === zone.id);
}

/**
 * `npc` covers both NpcDef and TrainerDef ids (the client targets whichever actor it faces; trainers are
 * actors with `kind: 'trainer'` in the render spec). `gym` resolves LeagueTrainer ids fought in this zone.
 */
export function findTarget(zone: ZoneDef, kind: InteractKind, targetId: string): InteractTarget | null {
  switch (kind) {
    case 'npc': {
      const npc = zone.npcs.find((n) => n.id === targetId);
      if (npc !== undefined) return { kind: 'npc', npc, x: npc.x, z: npc.z };
      const trainer = zone.trainers.find((t) => t.id === targetId);
      if (trainer !== undefined) return { kind: 'trainer', trainer, x: trainer.x, z: trainer.z };
      return null;
    }
    case 'gym': {
      const league = leagueIn(zone).find((l) => l.id === targetId);
      return league === undefined ? null : { kind: 'gym', league, x: LEAGUE_MARKER.x, z: LEAGUE_MARKER.z };
    }
    case 'item': {
      const item = zone.items.find((i) => i.id === targetId);
      return item === undefined ? null : { kind: 'item', item, x: item.x, z: item.z };
    }
    case 'lore': {
      const lore = zone.lore.find((l) => l.id === targetId);
      return lore === undefined ? null : { kind: 'lore', lore, x: lore.x, z: lore.z };
    }
    case 'warp': {
      const warp = zone.warps.find((w) => w.id === targetId);
      return warp === undefined ? null : { kind: 'warp', warp, x: warp.x, z: warp.z };
    }
    case 'static': {
      const st = staticsFor(zone.id).find((s) => s.species === targetId);
      return st === undefined ? null : { kind: 'static', static: st, x: st.x, z: st.z };
    }
    default:
      // healer / shop: no-ops over the room (POST /heal, GET /shop/:zoneId)
      return null;
  }
}

export function rangeFor(t: InteractTarget): number {
  return t.kind === 'gym' ? GYM_RANGE_M : INTERACT_RANGE_M;
}

/** Ground-item pickup flag: once per player (§30.4.6). */
export function itemFlag(zone: ZoneDef, item: GroundItemDef): string {
  return `item:${zone.id}:${item.id}`;
}

export function trainerBeatenFlag(trainerId: string): string {
  return `trainer:${trainerId}:beaten`;
}
