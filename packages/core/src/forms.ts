/**
 * Battle forms (`SpeciesDef.battleForm`, hollowmane's rage form): which base stats a battler's atk / def / spd derive
 * from. Every stat path (projection, level-up, the damage formula, the confusion self-hit) reads them through here, so a
 * battler without a form — every battler of every species without one — computes exactly what it did before.
 */
import type { ActionError, BattleFormDef, Battler, Side, SpeciesDef } from './types';

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

/**
 * The hp line of a form: a Majin (or automatic) form opens below `hpBelowPct` % of max hp, a Tenjin form at or above it.
 * Integer math (hp * 100 vs maxHp * pct), exactly as the automatic change has always compared.
 */
export function formLineMet(f: BattleFormDef, b: { readonly creature: { readonly hp: number }; readonly maxHp: number }): boolean {
  const below = b.creature.hp * 100 < b.maxHp * f.hpBelowPct;
  return f.kind === 'tenjin' ? !below : below;
}

/**
 * Why side `s` cannot transform battler `b` (species `sp`) this turn, or null when it can: the species has a Majin /
 * Tenjin form, the side holds that band and has not transformed yet this battle, the battler is standing and not in
 * its form already, and the hp line is met.
 */
export function transformError(s: Side, b: Battler, sp: SpeciesDef): ActionError | null {
  const f = sp.battleForm;
  if (f === undefined || f.kind === undefined) return 'cannotTransform';
  if (s.bands === undefined || !s.bands.includes(f.kind)) return 'cannotTransform';
  if (s.transformed === true || b.form !== undefined || b.creature.hp <= 0) return 'cannotTransform';
  return formLineMet(f, b) ? null : 'cannotTransform';
}
