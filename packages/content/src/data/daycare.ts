/**
 * Breeding: the Daycare in Mirevale (house 1, a house hall of the interiors layer whose resident is the keeper) takes
 * two of a trainer's creatures. Two that can breed leave an egg every `EGG_READY_MS` of server time (one waits at a
 * time). A carried egg hatches after `eggSteps` metres walked in the world (the server counts accepted movement).
 *
 * The rules, kept legible:
 * - **Who can breed:** two creatures of the same family, or sharing a type. Never a legendary or a mythical. (Battle
 *   tower and arena teams are healed copies that are never persisted, so they can never be left here.)
 * - **What hatches:** the first stage of the family of the creature left FIRST, at level `HATCH_LEVEL`.
 * - **Moves:** its level moves, with the egg moves (moves either parent knows that the hatchling's species learns by
 *   level-up or by TM) in place of the oldest, at most four.
 * - **Inheritance:** Ewamon has no IVs (stats are base and level, spine §2.7), so the hatchling inherits what a creature
 *   does carry: the first parent's coat variant (else the second's), the ability in the first parent's ability slot,
 *   and honor = the parents' average (rounded half away from zero): a dustcub hatched from honorable parents grows
 *   into a lawlander, "born Lawlander".
 * - **Bandborn:** a Majin-form parent with a Tenjin-form parent always gives a bandborn egg: its line's form answers
 *   either band, each at its own hp line (core `transformError`). A bandborn whose line never reaches a form keeps the
 *   mark only.
 * - **Shiny:** the usual 1 in 512, 1 in 256 when either parent is shiny.
 */
import { clampHonor } from '@ewa/core';
import type { BandKind, MoveDef, SpeciesDef, VariantKey } from '@ewa/core';
import type { InteriorDef, ZoneId } from '../types';
import { evolutionRoot } from './arena';
import { MOVES } from './moves';
import { TM_MOVES, canLearnMachineMove } from './progressionItems';

export const DAYCARE: { readonly zoneId: ZoneId; readonly building: string; readonly keeperId: string; readonly keeper: string } = Object.freeze({
  zoneId: 'mirevale',
  building: 'mirevale.house1',
  keeperId: 'mirevale.house1.daycare',
  keeper: 'Nan Hob',
});

/** Server time from a pair that can breed (or the last egg collected) to the next egg. */
export const EGG_READY_MS = 10 * 60_000;
/** Metres walked (the server's accepted movement) until an egg hatches, by the hatchling's rarity. */
export const EGG_STEPS: Readonly<Record<'common' | 'uncommon' | 'rare', number>> = Object.freeze({ common: 600, uncommon: 900, rare: 1200 });
/** Eggs carried at once (they ride beside the party and never take a party slot); the rest wait in the box. */
export const EGG_CARRY_MAX = 3;
/** Eggs one trainer may hold in all (the keeper keeps the next one until there is room). */
export const EGG_MAX = 12;
export const HATCH_LEVEL = 1;
/** One egg in EGG_SHINY_ODDS hatches shiny; one in EGG_SHINY_ODDS_SHINY_PARENT when either parent is shiny. */
export const EGG_SHINY_ODDS = 512;
export const EGG_SHINY_ODDS_SHINY_PARENT = 256;

export type BreedRefusal = 'legendary' | 'unrelated';

/** Why two species cannot breed, or null when they can (same family, or a shared type; never a legendary). */
export function breedRefusal(a: SpeciesDef, b: SpeciesDef): BreedRefusal | null {
  if (a.legendary || b.legendary) return 'legendary';
  if (evolutionRoot(a.id) === evolutionRoot(b.id)) return null;
  return a.types.some((t) => (b.types as readonly string[]).includes(t)) ? null : 'unrelated';
}

/** What the keeper says about a pair that cannot breed. */
export const BREED_REFUSAL_TEXT: Readonly<Record<BreedRefusal, string>> = Object.freeze({
  legendary: 'Legends do not lay eggs. Not here, not anywhere.',
  unrelated: 'These two do not get along. Two of one family, or two that share a type, might.',
});

/** The species an egg hatches into: the first stage of the first parent's family. */
export function eggSpecies(first: SpeciesDef): string {
  return evolutionRoot(first.id);
}

function formKind(sp: SpeciesDef): BandKind | null {
  return sp.battleForm?.kind ?? null;
}

/** A Majin-form parent with a Tenjin-form parent. */
export function isBandbornPair(a: SpeciesDef, b: SpeciesDef): boolean {
  const ka = formKind(a);
  const kb = formKind(b);
  return ka !== null && kb !== null && ka !== kb;
}

const MOVE_BY_ID = new Map<string, MoveDef>(MOVES.map((m) => [m.id, m]));

/** True when `sp` learns `move` by level-up (any level) or by TM. */
export function canInheritMove(sp: SpeciesDef, move: string): boolean {
  if (sp.learnableMoves.some((e) => e.move === move)) return true;
  const def = MOVE_BY_ID.get(move);
  return def !== undefined && TM_MOVES.includes(move) && canLearnMachineMove(sp, def);
}

/** The egg moves: the parents' known moves (first parent's first) that the hatchling's species can learn, at most four. */
export function eggMoves(hatch: SpeciesDef, parents: readonly (readonly string[])[]): string[] {
  const out: string[] = [];
  for (const known of parents) for (const m of known) if (out.length < 4 && !out.includes(m) && canInheritMove(hatch, m)) out.push(m);
  return out;
}

/** The hatchling's moves: its level moves with the egg moves in place of the oldest, at most four (oldest first). */
export function hatchMoves(levelMoves: readonly string[], egg: readonly string[]): string[] {
  return [...levelMoves.filter((m) => !egg.includes(m)), ...egg].slice(-4);
}

/** The parents' average honor (absent = 0), rounded half away from zero, clamped to -10..10. */
export function eggHonor(a: number | undefined, b: number | undefined): number {
  const avg = ((a ?? 0) + (b ?? 0)) / 2;
  return clampHonor(Math.sign(avg) * Math.round(Math.abs(avg)));
}

/** The first parent's coat variant, else the second's. */
export function eggVariant(a: VariantKey, b: VariantKey): VariantKey {
  return a !== 'normal' ? a : b;
}

/** The ability in the first parent's slot (index in its species' abilities) on the hatchling, else its first ability. */
export function eggAbility(hatch: SpeciesDef, parent: SpeciesDef, parentAbility: string): string {
  const slot = Math.max(0, parent.abilities.indexOf(parentAbility));
  return hatch.abilities[slot] ?? hatch.abilities[0]!;
}

/** Metres to walk before the egg hatches. */
export function eggSteps(hatch: SpeciesDef): number {
  return hatch.rarity === 'common' ? EGG_STEPS.common : hatch.rarity === 'uncommon' ? EGG_STEPS.uncommon : EGG_STEPS.rare;
}

/** The keeper's lines (the interior NPC's dialogue before the Daycare screen opens). */
export const DAYCARE_LINES: readonly string[] = Object.freeze([
  "I'm Nan Hob. I mind other people's Ewamon, and some of them mind each other.",
  'Leave two with me. Two of one family, or two that share a type, and now and then I find an egg.',
]);

/** The interiors layer: Mirevale's house 1 becomes the Daycare (same hall, same footprint; its resident is the keeper). */
export function withDaycare(def: InteriorDef): InteriorDef {
  if (def.id !== DAYCARE.building) return def;
  return {
    ...def,
    label: 'the Daycare',
    npcs: def.npcs.map((n) => (n.role === 'resident' ? { ...n, id: DAYCARE.keeperId, name: DAYCARE.keeper, look: 'old_classy_female', role: 'daycare' as const, lines: DAYCARE_LINES } : n)),
  };
}
