/**
 * The DOM battle menu's handle on the live BattleController (World3D registers it; null without a world, e.g. in
 * jsdom route tests). Kept in its own module so the menu imports no scene code.
 */
import type { Action } from '@ewa/core';

export interface BattleActions {
  submit(action: Action): void;
  /** the disabled reason for an action (validateAction label), null = allowed */
  check(action: Action): string | null;
  dismissResult(): void;
  /** Phase D6: doubles — back to the previous position's choice (nothing is sent until every position has picked) */
  undoPick?(): void;
}

let current: BattleActions | null = null;

export function setBattleActions(a: BattleActions | null): void {
  current = a;
}

export function battleActions(): BattleActions | null {
  return current;
}
