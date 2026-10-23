/**
 * NPC talk (client `src/talk`): what an NPC can draw from its zone. A gift creature (`POST /npc/act giveCreature`) and
 * a villager's battle team (`battle`) both come from the zone's land encounter slots, or every table's common land
 * slots in a zone without a table (a town). Pure: the route and the battle coordinator pass the rng.
 */
import { ENCOUNTER_TABLES, encounterTableFor } from '@ewa/content';
import type { EncounterSlot } from '@ewa/content';
import type { Rng } from '@ewa/core';

/** The slots an NPC draws from: the zone's land slots, else every table's common land slots. */
export function zoneSlots(zoneId: Parameters<typeof encounterTableFor>[0]): readonly EncounterSlot[] {
  const land = (s: EncounterSlot): boolean => (s.medium ?? 'land') === 'land';
  const own = encounterTableFor(zoneId)?.slots.filter(land) ?? [];
  return own.length > 0 ? own : ENCOUNTER_TABLES.flatMap((t) => t.slots.filter((s) => land(s) && s.tier === 'common'));
}

/** One slot by weight. */
export function pickSlot(slots: readonly EncounterSlot[], rng: Rng): EncounterSlot {
  let roll = rng.next() * slots.reduce((n, s) => n + s.weight, 0);
  return slots.find((s) => (roll -= s.weight) < 0) ?? slots[slots.length - 1]!;
}

export const VILLAGER_TEAM_MAX = 3;
/** a villager's creatures are up to this many levels under the player's strongest */
export const VILLAGER_LEVEL_UNDER = 3;

/**
 * A villager's battle team: 1..VILLAGER_TEAM_MAX creatures from the zone's slots (`rng` is seeded by the NPC, so it
 * fields the same species every time), each 0..VILLAGER_LEVEL_UNDER levels under the player's strongest creature (a
 * town's slots span the whole game, so the slot's own levels are not used). Levels 2..100.
 */
export function villagerTeam(zoneId: Parameters<typeof encounterTableFor>[0], topLevel: number, rng: Rng): { species: string; level: number }[] {
  const slots = zoneSlots(zoneId);
  const size = 1 + rng.int(VILLAGER_TEAM_MAX);
  return Array.from({ length: size }, () => ({
    species: pickSlot(slots, rng).species,
    level: Math.max(2, Math.min(100, topLevel - rng.int(VILLAGER_LEVEL_UNDER + 1))),
  }));
}
