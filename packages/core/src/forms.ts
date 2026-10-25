/**
 * Battle forms (`SpeciesDef.battleForm`, hollowmane's rage form; `battleForms`, ravatar's relic forms): which base stats a battler's atk / def / spd derive
 * from. Every stat path (projection, level-up, the damage formula, the confusion self-hit) reads them through here, so a
 * battler without a form — every battler of every species without one — computes exactly what it did before.
 */
import type { ActionError, BandKind, BattleFormDef, Battler, ContentIndex, MoveDef, Side, SpeciesDef, TypeName } from './types';

const NO_FORMS: readonly BattleFormDef[] = [];

/** Every battle form of the species: its `battleForms` (ravatar's relic forms), else its one `battleForm`, else none. */
export function formsOf(sp: SpeciesDef): readonly BattleFormDef[] {
  if (sp.battleForms !== undefined) return sp.battleForms;
  return sp.battleForm === undefined ? NO_FORMS : [sp.battleForm];
}

/** The species' battle form when the battler has changed into it this battle, else null. */
export function activeForm(sp: SpeciesDef, b: { readonly form?: string }): BattleFormDef | null {
  if (b.form === undefined) return null;
  const forms = formsOf(sp);
  for (let i = 0; i < forms.length; i++) if (forms[i]!.id === b.form) return forms[i]!;
  return null;
}

/**
 * The move a battler executes when it uses its known move `moveId`: the active form's signature move in place of the
 * move it replaces, else `moveId` itself.
 */
export function formMoveId(sp: SpeciesDef, b: { readonly form?: string }, moveId: string): string {
  const sig = activeForm(sp, b)?.signatureMove;
  return sig !== undefined && sig.replaces === moveId ? sig.move : moveId;
}

/**
 * The MoveDef a battler executes when it uses its known move `moveId`: `formMoveId`'s move, and for a `typeFromForm`
 * move held in a form, that form's `moveType` (else its first type); an `effectOnlyBaseForm` move drops its effect
 * while a form is held. Every other move is the content's MoveDef itself.
 */
export function formMove(content: ContentIndex, sp: SpeciesDef, b: { readonly form?: string }, moveId: string): MoveDef {
  const move = content.move(formMoveId(sp, b, moveId));
  if (move.typeFromForm !== true && move.effectOnlyBaseForm !== true) return move;
  const form = activeForm(sp, b);
  if (form === null) return move;
  const type = move.typeFromForm === true ? (form.moveType ?? (form.types ?? sp.types)[0]) : move.type;
  return { ...move, type, ...(move.effectOnlyBaseForm === true ? { effect: null } : {}) };
}

/**
 * The form a creature wears outside a battle: the relic form its held item opens on entering the field (a `heldItem`
 * form with no hp line, ravatar's Water / Earth / Fire / Air), else null. A form with a line (the Avatar State) or a
 * band waits for the battle. Read by the party screens, the follower and its field powers; never by the engine.
 */
export function heldForm(sp: SpeciesDef, heldItem: string | null | undefined): BattleFormDef | null {
  if (heldItem == null) return null;
  const forms = formsOf(sp);
  for (let i = 0; i < forms.length; i++) {
    const f = forms[i]!;
    if (f.heldItem === heldItem && f.hpBelowPct === undefined) return f;
  }
  return null;
}

/** The base atk / def / spd the battler's stats derive from: the active form's, else the species'. */
export function formBase(sp: SpeciesDef, b: { readonly form?: string }): { readonly baseAtk: number; readonly baseDef: number; readonly baseSpd: number } {
  return activeForm(sp, b) ?? sp;
}

/** The battler's types: the active form's when it names its own, else the species'. */
export function formTypes(sp: SpeciesDef, b: { readonly form?: string }): readonly TypeName[] {
  return activeForm(sp, b)?.types ?? sp.types;
}

/**
 * The hp line of a form: a Majin (or automatic) form opens below `hpBelowPct` % of max hp, a Tenjin form at or above it.
 * Integer math (hp * 100 vs maxHp * pct), exactly as the automatic change has always compared.
 */
export function formLineMet(f: BattleFormDef, b: { readonly creature: { readonly hp: number }; readonly maxHp: number }): boolean {
  // a relic form without a line opens on entering the field: its line is always met
  if (f.hpBelowPct === undefined) return true;
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
  if (s.transformed === true || b.form !== undefined || b.creature.hp <= 0) return 'cannotTransform';
  const bands = s.bands ?? [];
  if (bands.includes(f.kind) && formLineMet(f, b)) return null;
  // a bandborn (hatched from a Majin and a Tenjin parent) also answers the other band, at that band's line
  if (b.creature.bandborn === true) {
    const other: BandKind = f.kind === 'majin' ? 'tenjin' : 'majin';
    if (bands.includes(other) && formLineMet({ ...f, kind: other }, b)) return null;
  }
  return 'cannotTransform';
}

/** The bands that can transform battler `b` (species `sp`): its form's band, and for a bandborn the other band too. */
export function bandsFor(sp: SpeciesDef, b: { readonly creature: { readonly bandborn?: true } }): readonly BandKind[] {
  const k = sp.battleForm?.kind;
  if (k === undefined) return [];
  return b.creature.bandborn === true ? [k, k === 'majin' ? 'tenjin' : 'majin'] : [k];
}
