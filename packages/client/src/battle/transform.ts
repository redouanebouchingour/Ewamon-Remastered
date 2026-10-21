/**
 * Majin / Tenjin (`.design/majin-tenjin.md` §3, §6.4): the battle menu's transform toggle — whether it shows for the
 * battler choosing now, whether it is enabled, and the short reason when it is not. The rules are core's
 * (`transformError`, `formLineMet`); this only words them.
 *
 * Shown when the player's side holds the band of the battler's form kind (or, for a bandborn, either band), the
 * battler's species has a Majin / Tenjin form, and the side has not transformed this battle. A bandborn's toggle names
 * the band whose hp line is met. Enabled when `transformError(...) === null` and (doubles) the
 * other position has not armed the side's one transformation this turn.
 */
import { bandsFor, formLineMet, transformError } from '@ewa/core';
import type { Action, BandKind, BattleState, Battler } from '@ewa/core';
import { species } from '../data/content';
import { ACTION_ERROR_LABEL } from './labels';

export interface TransformOffer {
  readonly kind: BandKind;
  readonly enabled: boolean;
  /** why it is disabled (a short caption); null when enabled */
  readonly reason: string | null;
}

/** the hp-line captions, per kind */
export const LINE_REASON: Readonly<Record<BandKind, string>> = {
  majin: 'Majin needs HP below half.',
  tenjin: 'Tenjin needs HP at or above half.',
};
export const ALREADY_TRANSFORMED = 'Already transformed this battle.';
/** doubles: the other position carries the side's one transformation this turn */
export const OTHER_ARMED = 'One transformation per battle.';

/**
 * The toggle for `battler` on `seat` (null = not shown). `otherPick`: doubles — the action the other position already
 * picked this turn (a `transform: true` move there takes the side's one transformation).
 */
export function transformOffer(st: BattleState, seat: 0 | 1, battler: Battler | undefined, otherPick: Action | null = null): TransformOffer | null {
  if (battler === undefined) return null;
  const sp = species(battler.creature.speciesId);
  const form = sp?.battleForm;
  if (sp === undefined || form === undefined || form.kind === undefined) return null;
  const side = st.sides[seat];
  // breeding: a bandborn's form also answers the other band (core `bandsFor`); the toggle names the band that opens it
  const held = bandsFor(sp, battler).filter((k) => side.bands?.includes(k) === true);
  if (held.length === 0 || side.transformed === true) return null;
  const open = held.find((k) => formLineMet({ ...form, kind: k }, battler));
  const kind = open ?? held[0]!;
  if (otherPick !== null && otherPick.kind === 'move' && otherPick.transform === true) return { kind, enabled: false, reason: OTHER_ARMED };
  if (transformError(side, battler, sp) === null) return { kind, enabled: true, reason: null };
  const reason = battler.form !== undefined ? ALREADY_TRANSFORMED : battler.creature.hp > 0 && open === undefined ? LINE_REASON[kind] : ACTION_ERROR_LABEL.cannotTransform;
  return { kind, enabled: false, reason };
}
