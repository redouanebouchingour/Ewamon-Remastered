/**
 * SPEC §20.5.6 — `ActionError` → the disabled-reason label table of the battle menu, and small display helpers.
 */
import type { ActionError } from '@ewa/core';

export const ACTION_ERROR_LABEL: Readonly<Record<ActionError, string>> = {
  battleEnded: 'Battle over',
  unknownMove: 'Unknown move',
  noPp: 'No PP',
  choiceLocked: 'Choice-locked',
  statusMoveBlocked: 'Blocked by Assault Vest',
  badSwitchIndex: 'Not in party',
  switchToFainted: 'Fainted',
  switchToActive: 'Already in battle',
  trapped: 'Trapped',
  unknownItem: 'Unknown item',
  itemNotUsableInBattle: 'Not usable in battle',
  badItemTarget: 'No effect',
  cannotCatch: 'Cannot catch',
  unknownOrb: 'Unknown orb',
  cannotFlee: 'Cannot run',
  cannotForfeit: 'Run instead',
  mustSwitch: 'Choose a replacement',
  actionNotRequired: 'Waiting',
  badTarget: 'Not a target', // Phase D6 (doubles): a move aimed at its own user
  cannotTransform: 'Can’t transform now', // Majin / Tenjin: no band / form, already transformed, or the hp line not met
};

export function actionErrorLabel(e: ActionError | null): string | null {
  return e === null ? null : ACTION_ERROR_LABEL[e];
}
