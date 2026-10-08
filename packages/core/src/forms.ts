/**
 * Battle forms (`SpeciesDef.battleForm`, hollowmane's rage form): which base stats a battler's atk / def / spd derive
 * from. Every stat path (projection, level-up, the damage formula, the confusion self-hit) reads them through here, so a
 * battler without a form — every battler of every species without one — computes exactly what it did before.
 */
import type { BattleFormDef, SpeciesDef } from './types';

/** The species' battle form when the battler has changed into it this battle, else null. */
export function activeForm(sp: SpeciesDef, b: { readonly form?: string }): BattleFormDef | null {
  const f = sp.battleForm;
  return f !== undefined && b.form === f.id ? f : null;
}

/**
 * The move a battler executes when it uses its known move `moveId`: the active form's signature move in place of the
 * move it replaces, else `moveId` itself.
 */
export function formMoveId(sp: SpeciesDef, b: { readonly form?: string }, moveId: string): string {
  const sig = activeForm(sp, b)?.signatureMove;
  return sig !== undefined && sig.replaces === moveId ? sig.move : moveId;
}

/** The base atk / def / spd the battler's stats derive from: the active form's, else the species'. */
export function formBase(sp: SpeciesDef, b: { readonly form?: string }): { readonly baseAtk: number; readonly baseDef: number; readonly baseSpd: number } {
  return activeForm(sp, b) ?? sp;
}
