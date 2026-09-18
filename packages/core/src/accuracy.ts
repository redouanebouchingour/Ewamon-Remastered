/**
 * §2.12 — accuracy.
 *   threshold = floor(floor(floor(accuracy * accNum / accDen) * evaDen / evaNum) * abilityMul)
 * Exactly ONE rng draw per check, drawn even when accuracy === null (draw and discard).
 */
import { abilityHooks, accuracyMultipliers } from './abilities';
import { accStageRatio, mulFloor } from './stats';
import type { Battler, ContentIndex, MoveDef, Rng, WeatherKind } from './types';

/** The hit threshold in 0..100+ (compared against rng.int(100)). `defender` is null for self/field-targeted moves. */
export function accuracyThreshold(
  attacker: Battler,
  defender: Battler | null,
  move: MoveDef,
  weather: WeatherKind,
  content: ContentIndex,
): number {
  if (move.accuracy === null) return 100;
  const [accNum, accDen] = accStageRatio(attacker.stages.acc);
  let x = Math.floor((move.accuracy * accNum) / accDen);
  if (defender !== null) {
    const [evaNum, evaDen] = accStageRatio(defender.stages.eva);
    x = Math.floor((x * evaDen) / evaNum);
  }
  const damaging = move.power > 0;
  const atkMuls = accuracyMultipliers(abilityHooks(attacker, content), 'attacker', weather, damaging);
  for (let i = 0; i < atkMuls.length; i++) x = mulFloor(x, atkMuls[i]!);
  if (defender !== null) {
    const defMuls = accuracyMultipliers(abilityHooks(defender, content), 'defender', weather, damaging);
    for (let i = 0; i < defMuls.length; i++) x = mulFloor(x, defMuls[i]!);
  }
  return x;
}

/** hit iff accuracy === null || rng.int(100) < threshold. Consumes exactly one draw. */
export function accuracyCheck(
  attacker: Battler,
  defender: Battler | null,
  move: MoveDef,
  weather: WeatherKind,
  content: ContentIndex,
  rng: Rng,
): boolean {
  const roll = rng.int(100);
  if (move.accuracy === null) return true;
  return roll < accuracyThreshold(attacker, defender, move, weather, content);
}
