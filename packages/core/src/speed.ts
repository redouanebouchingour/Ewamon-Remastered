/**
 * §2.13 — effective speed. calcStat → stage → held statMul (Choice Scarf 1.25 / Speed Scarf 1.1) →
 * modifySpeed ability (×2 in matching weather) → floor(/2) if paralyzed. Floors after every step.
 */
import { abilityHooks, speedMultipliers } from './abilities';
import { heldHooks, statMultipliers } from './items';
import { applyRatio, mulFloor, stageRatio } from './stats';
import { hasStatus } from './status';
import type { Battler, ContentIndex, WeatherKind } from './types';

export function effectiveSpeed(b: Battler, weather: WeatherKind, content: ContentIndex): number {
  let spd = b.spd;
  spd = applyRatio(spd, stageRatio(b.stages.spd));
  const canEvolve = content.species(b.creature.speciesId).evolution !== null;
  const itemMuls = statMultipliers(heldHooks(b, content), 'spd', canEvolve);
  for (let i = 0; i < itemMuls.length; i++) spd = mulFloor(spd, itemMuls[i]!);
  const abilityMuls = speedMultipliers(abilityHooks(b, content), weather);
  for (let i = 0; i < abilityMuls.length; i++) spd = mulFloor(spd, abilityMuls[i]!);
  if (hasStatus(b.creature.status, 'paralyze')) spd = Math.floor(spd / 2);
  return spd;
}
