/**
 * The encounter transition (SPEC §20.5.7): what kind of battle just started, so the wipe over the push-in can tell a
 * grass encounter from a trainer, a legendary or a shiny before a single line of text appears. Pure.
 */
import { LEGENDARY_IDS, MYTHICAL_IDS } from '@ewa/content';
import type { BattleState, TypeName } from '@ewa/core';
import { primaryType } from '../data/content';

export type EncounterKind = 'wild' | 'shiny' | 'legendary' | 'trainer' | 'league' | 'raid' | 'pvp';

/** How long each wipe holds the screen (ms); the push-in under it is 600 ms. */
export const ENCOUNTER_MS: Readonly<Record<EncounterKind, number>> = Object.freeze({
  wild: 760, shiny: 1000, legendary: 1300, trainer: 720, league: 820, raid: 1300, pvp: 720,
});
/** Under reduced motion every wipe is a short dark dip instead. */
export const ENCOUNTER_REDUCED_MS = 320;

export interface EncounterFx {
  readonly battleId: string;
  readonly kind: EncounterKind;
  /** the foe's lead type (the wipe's colour) */
  readonly type: TypeName;
  /** effective reduced motion when the battle started: the short dark dip */
  readonly reduced: boolean;
}

const RARE = new Set<string>([...LEGENDARY_IDS, ...MYTHICAL_IDS]);

/** The kind of the battle `state` the player sits in at `seat`. */
export function encounterKindOf(state: BattleState, seat: 0 | 1): EncounterKind {
  const foe = state.sides[seat === 0 ? 1 : 0];
  const lead = foe.party[foe.active]?.creature;
  switch (state.format) {
    case 'league': return 'league';
    case 'trainer': return 'trainer';
    case 'pvp': return 'pvp';
    case 'raid': return 'raid';
    case 'wild':
      if (lead !== undefined && RARE.has(lead.speciesId)) return 'legendary';
      if (lead?.isShiny === true) return 'shiny';
      return 'wild';
  }
}

/** The wipe for a battle that just started (never for a resync restore: the caller decides). */
export function encounterFxOf(battleId: string, state: BattleState, seat: 0 | 1, reduced: boolean): EncounterFx {
  const foe = state.sides[seat === 0 ? 1 : 0];
  const lead = foe.party[foe.active]?.creature;
  return { battleId, kind: encounterKindOf(state, seat), type: lead !== undefined ? primaryType(lead.speciesId) : 'Normal', reduced };
}
