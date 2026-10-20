/**
 * Music that follows the battle (client IMPLEMENTATION-NOTES "Battle music mood"): the player's side as the score hears
 * it. `hp` from the player's active battler (the lowest of the two in doubles) as the timeline shows it, `form` from a
 * Majin / Tenjin form it holds. The AudioDirector turns a mood into stem levels and a filter (`setBattleMood`).
 */
import { activeForm } from '@ewa/core';
import type { BattleState, ContentIndex } from '@ewa/core';
import { MIXER } from '../audio/mixer';

export interface BattleMood {
  readonly hp: 'steady' | 'low' | 'critical';
  readonly form: 'none' | 'majin' | 'tenjin';
}

export const STEADY_MOOD: BattleMood = { hp: 'steady', form: 'none' };

export function sameMood(a: BattleMood | null, b: BattleMood | null): boolean {
  return a === b || (a !== null && b !== null && a.hp === b.hp && a.form === b.form);
}

/** The hp band of a fraction (MIXER.battleMood thresholds; a fainted battler is not counted). */
export function hpBand(frac: number): BattleMood['hp'] {
  if (frac <= MIXER.battleMood.criticalAt) return 'critical';
  if (frac <= MIXER.battleMood.lowAt) return 'low';
  return 'steady';
}

/**
 * The mood of `seat`'s side in `st`, with `hpOf(slot)` the hp the timeline currently shows for a party slot (the HP
 * bars move during the playback, before the state does). Fainted actives do not count; with none standing the side
 * is steady (a replacement is about to enter).
 */
export function battleMood(st: BattleState, seat: 0 | 1, hpOf: (slot: number) => number, content: ContentIndex): BattleMood {
  const side = st.sides[seat];
  const actives = st.slots === 2 && side.actives !== undefined ? [...side.actives] : [side.active];
  let worst = 1;
  let form: BattleMood['form'] = 'none';
  for (const slot of actives) {
    const b = side.party[slot];
    if (b === undefined) continue;
    const hp = hpOf(slot);
    if (hp > 0) worst = Math.min(worst, hp / Math.max(1, b.maxHp));
    const f = activeForm(content.species(b.creature.speciesId), b);
    if (f?.kind === 'majin') form = 'majin';
    else if (f?.kind === 'tenjin' && form === 'none') form = 'tenjin';
  }
  return { hp: hpBand(worst), form };
}
