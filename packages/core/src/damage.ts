/**
 * §2.14 — damage, the 12-step order with integer flooring at every step.
 * `calcDamage` consumes exactly 2 rng draws when it reaches step 5 and exactly 0 otherwise.
 */
import {
  abilityHooks,
  attackMultipliers,
  damageMultipliers,
  hasStatusedAttackBoost,
  hasWonderGuard,
  typeImmunityFor,
} from './abilities';
import { heldHooks, statMultipliers, typeBoostMultipliers } from './items';
import { formBase } from './forms';
import { applyRatio, calcStat, mulFloor, stageRatio } from './stats';
import { hasStatus, majorStatus } from './status';
import { otherSide } from './side';
import { typeMultiplier } from './typechart';
import type { Battler, BattleState, ContentIndex, DamageResult, MoveDef, Rng, WeatherKind } from './types';

export interface DamageInputs {
  readonly attacker: Battler;
  readonly defender: Battler;
  readonly weather: WeatherKind;
}

/** Step 0 only: whether the move is stopped before any damage roll, and why. */
export type DamageStop = 'typeChart' | 'abilityImmunity' | 'wonderGuard' | 'statusMove' | null;

export function damageStop(inp: DamageInputs, move: MoveDef, content: ContentIndex): {
  readonly stop: DamageStop;
  readonly effectiveness: DamageResult['effectiveness'];
  readonly absorbed: DamageResult['absorbed'];
} {
  const defSp = content.species(inp.defender.creature.speciesId);
  const effectiveness = typeMultiplier(content.typeChart, move.type, defSp.types);
  if (effectiveness === 0) return { stop: 'typeChart', effectiveness, absorbed: null };
  const defHooks = abilityHooks(inp.defender, content);
  const imm = typeImmunityFor(defHooks, move.type);
  if (imm !== null) {
    const k = imm.reaction.kind;
    return { stop: 'abilityImmunity', effectiveness, absorbed: k === 'none' ? null : k };
  }
  // Wonder Guard blocks damaging moves below x2; status moves are unaffected (§2.5).
  if (move.power === 0) return { stop: 'statusMove', effectiveness, absorbed: null };
  if (hasWonderGuard(defHooks) && effectiveness < 2) return { stop: 'wonderGuard', effectiveness, absorbed: null };
  return { stop: null, effectiveness, absorbed: null };
}

/** Steps 1–12 with a fixed crit flag and random factor r (85..100). No rng. */
export function damageAmount(
  inp: DamageInputs,
  move: MoveDef,
  effectiveness: DamageResult['effectiveness'],
  crit: boolean,
  r: number,
  content: ContentIndex,
): { readonly amount: number; readonly stab: boolean } {
  const { attacker, defender, weather } = inp;
  const atkSp = content.species(attacker.creature.speciesId);
  const defSp = content.species(defender.creature.speciesId);
  const atkHooks = abilityHooks(attacker, content);
  const defHooks = abilityHooks(defender, content);
  const atkItems = heldHooks(attacker, content);
  const defItems = heldHooks(defender, content);
  const L = attacker.creature.level;
  const P = move.power;

  // 1. A and D
  let A = calcStat(formBase(atkSp, attacker).baseAtk, L);
  A = applyRatio(A, stageRatio(attacker.stages.atk));
  const aItem = statMultipliers(atkItems, 'atk', atkSp.evolution !== null);
  for (let i = 0; i < aItem.length; i++) A = mulFloor(A, aItem[i]!);
  const aAbility = attackMultipliers(atkHooks, majorStatus(attacker.creature.status) !== null);
  for (let i = 0; i < aAbility.length; i++) A = mulFloor(A, aAbility[i]!);

  let D = calcStat(formBase(defSp, defender).baseDef, defender.creature.level);
  D = applyRatio(D, stageRatio(defender.stages.def));
  const dItem = statMultipliers(defItems, 'def', defSp.evolution !== null);
  for (let i = 0; i < dItem.length; i++) D = mulFloor(D, dItem[i]!);
  if (D < 1) D = 1;

  // 2. base
  const base = Math.floor(Math.floor((Math.floor((2 * L) / 5 + 2) * P * A) / D) / 50) + 2;

  // 3. stab
  const stab = atkSp.types.indexOf(move.type) !== -1;
  let dmg = stab ? Math.floor((base * 3) / 2) : base;

  // 4. type
  dmg = Math.floor(dmg * effectiveness);

  // 5. crit
  if (crit) dmg = Math.floor((dmg * 3) / 2);

  // 6. random
  dmg = Math.floor((dmg * r) / 100);

  // 7. burn
  if (hasStatus(attacker.creature.status, 'burn') && !hasStatusedAttackBoost(atkHooks)) dmg = Math.floor(dmg / 2);

  // 8. weather
  if (weather === 'sun') {
    if (move.type === 'Fire') dmg = Math.floor((dmg * 3) / 2);
    else if (move.type === 'Water') dmg = Math.floor(dmg / 2);
  } else if (weather === 'rain') {
    if (move.type === 'Water') dmg = Math.floor((dmg * 3) / 2);
    else if (move.type === 'Fire') dmg = Math.floor(dmg / 2);
  }

  // 9. abilities: attacker side, then defender side (excluding the superEffective-conditioned hooks → step 11)
  const superEffective = effectiveness >= 2;
  const q = { moveType: move.type, superEffective, flashFired: attacker.volatile.flashFired };
  const atkMuls = damageMultipliers(atkHooks, { ...q, side: 'attacker' });
  for (let i = 0; i < atkMuls.length; i++) dmg = mulFloor(dmg, atkMuls[i]!);
  const defMulsPlain = damageMultipliers(defHooks, { ...q, side: 'defender', whenFilter: null });
  for (let i = 0; i < defMulsPlain.length; i++) dmg = mulFloor(dmg, defMulsPlain[i]!);
  const defMulsFlash = damageMultipliers(defHooks, { ...q, side: 'defender', whenFilter: 'flashFired' });
  for (let i = 0; i < defMulsFlash.length; i++) dmg = mulFloor(dmg, defMulsFlash[i]!);

  // 10. held items: attacker typeBoost
  const boosts = typeBoostMultipliers(atkItems, move.type);
  for (let i = 0; i < boosts.length; i++) dmg = mulFloor(dmg, boosts[i]!);

  // 11. Solid Rock: defender modifyDamage conditioned on superEffective
  const defMulsSe = damageMultipliers(defHooks, { ...q, side: 'defender', whenFilter: 'superEffective' });
  for (let i = 0; i < defMulsSe.length; i++) dmg = mulFloor(dmg, defMulsSe[i]!);

  // 12. min 1
  return { amount: Math.max(1, dmg), stab };
}

/** The full §2.14 pipeline against the two active battlers, drawing crit and random factor from `rng`. */
export function calcDamageFor(inp: DamageInputs, move: MoveDef, rng: Rng, content: ContentIndex): DamageResult {
  const s = damageStop(inp, move, content);
  if (s.stop !== null) {
    return { amount: 0, effectiveness: s.effectiveness, crit: false, stab: false, absorbed: s.absorbed };
  }
  const critStage = move.effect === 'crit' ? 2 : 0;
  const critDen = [16, 8, 2][critStage]!;
  const crit = rng.int(critDen) === 0;
  const r = 85 + rng.int(16);
  const { amount, stab } = damageAmount(inp, move, s.effectiveness, crit, r, content);
  return { amount, effectiveness: s.effectiveness, crit, stab, absorbed: s.absorbed };
}

export function calcDamage(
  state: BattleState,
  attackerSide: 0 | 1,
  move: MoveDef,
  rng: Rng,
  content: ContentIndex,
): DamageResult {
  const atkSide = state.sides[attackerSide];
  const defSide = state.sides[otherSide(attackerSide)];
  const attacker = atkSide.party[atkSide.active];
  const defender = defSide.party[defSide.active];
  if (attacker === undefined || defender === undefined) {
    throw new RangeError(`calcDamage: side ${attackerSide} or its foe has no active battler`);
  }
  return calcDamageFor({ attacker, defender, weather: state.field.weather.kind }, move, rng, content);
}
