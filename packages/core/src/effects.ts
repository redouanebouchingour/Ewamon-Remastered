/**
 * §2.4 — the 23 move effects as a handler table keyed by effect. Every handler runs AFTER the move has
 * hit and (for chance-gated effects) after the effectChance roll succeeded. "Attacker" is the user of
 * the move (`atk`); "defender" (`def`) is the battler the move aimed at — in singles always the foe's active
 * battler (Phase D6: in doubles the chosen target, which may be the ally).
 */
import { at, changeStage, dealDamage, emit, healBattler, isAlive, setWeather, tryApplyStatus } from './engine';
import type { Ctx } from './engine';
import type { MoveDef, MoveEffect, Ref, StatKey, StatusId, WeatherKind } from './types';

export type EffectHandler = (ctx: Ctx, atk: Ref, def: Ref | null, move: MoveDef, damageDealt: number) => void;

function lowerFoe(stat: StatKey): EffectHandler {
  return (ctx, atk, def) => {
    if (def === null || !isAlive(at(ctx, def))) return;
    changeStage(ctx, def, stat, -1, atk, 'move');
  };
}

function raiseSelf(stats: readonly StatKey[]): EffectHandler {
  return (ctx, atk) => {
    if (!isAlive(at(ctx, atk))) return;
    for (let i = 0; i < stats.length; i++) {
      changeStage(ctx, atk, stats[i]!, 1, atk, 'move');
    }
  };
}

function inflict(status: StatusId): EffectHandler {
  return (ctx, atk, def) => {
    if (def === null || !isAlive(at(ctx, def))) return;
    tryApplyStatus(ctx, def, status, atk);
  };
}

const noop: EffectHandler = () => {};

/** Water→rain, Fire→sun, Ice→hail, Rock/Ground→sand; other types→sand. */
export function weatherForType(type: MoveDef['type']): WeatherKind {
  if (type === 'Water') return 'rain';
  if (type === 'Fire') return 'sun';
  if (type === 'Ice') return 'hail';
  return 'sand';
}

export const EFFECT_HANDLERS: Readonly<Record<MoveEffect, EffectHandler>> = {
  lower_atk: lowerFoe('atk'),
  lower_def: lowerFoe('def'),
  lower_spd: lowerFoe('spd'),
  // There is no Sp.Atk: content rewrites this to lower_atk; kept so the legacy key is accounted for.
  lower_spAtk: lowerFoe('atk'),
  raise_atk: raiseSelf(['atk']),
  raise_def: raiseSelf(['def']),
  raise_spd: raiseSelf(['spd']),
  raise_all: raiseSelf(['atk', 'def', 'spd']),
  // Per-move damage modifier (§2.14 step 5) — nothing to do after the hit.
  crit: noop,
  // Data-only: content sets priority 1; core reads priority, never effect === 'first'.
  first: noop,
  flinch: (ctx, _atk, def) => {
    if (def === null) return;
    const foe = at(ctx, def);
    if (!isAlive(foe) || foe.volatile.movedThisTurn) return;
    foe.volatile.flinched = true;
  },
  burn: inflict('burn'),
  poison: inflict('poison'),
  paralyze: inflict('paralyze'),
  freeze: inflict('freeze'),
  sleep: inflict('sleep'),
  confuse: inflict('confuse'),
  trap: (ctx, atk, def) => {
    if (def === null) return;
    const foe = at(ctx, def);
    if (!isAlive(foe) || foe.volatile.trappedTurns > 0) return;
    const turns = 4 + ctx.rng.int(2);
    foe.volatile.trappedTurns = turns;
    emit(ctx, { t: 'trapped', target: def, turns, source: atk });
  },
  recoil: (ctx, atk, _def, move, dealt) => {
    if (dealt <= 0 || !isAlive(at(ctx, atk))) return;
    const amt = Math.max(1, Math.floor(dealt / 4));
    dealDamage(ctx, atk, amt, 'recoil', atk, move.id);
  },
  drain: (ctx, atk, _def, _move, dealt) => {
    if (dealt <= 0 || !isAlive(at(ctx, atk))) return;
    const amt = Math.max(1, Math.floor(dealt / 2));
    healBattler(ctx, atk, amt, 'drain', null);
  },
  heal: (ctx, atk, _def, move) => {
    const b = at(ctx, atk);
    if (!isAlive(b)) return;
    if (b.creature.hp >= b.maxHp) {
      emit(ctx, { t: 'moveFailed', who: atk, move: move.id, reason: 'fullHp' });
      return;
    }
    healBattler(ctx, atk, Math.floor(b.maxHp / 2), 'move', null);
  },
  weather: (ctx, atk, _def, move) => {
    setWeather(ctx, weatherForType(move.type), atk);
  },
  sun: (ctx, atk) => {
    setWeather(ctx, 'sun', atk);
  },
};

/** Effects whose "Default chance" is "always" in the §2.4 table: no effectChance roll is ever made for them. */
export function effectAlwaysApplies(effect: MoveEffect): boolean {
  switch (effect) {
    case 'crit':
    case 'first':
    case 'recoil':
    case 'drain':
    case 'heal':
    case 'weather':
    case 'sun':
      return true;
    default:
      return false;
  }
}

/** Whether the effect targets the defender (and so needs a standing target) — used by the turn loop. */
export function effectTargetsDefender(effect: MoveEffect): boolean {
  switch (effect) {
    case 'lower_atk':
    case 'lower_def':
    case 'lower_spd':
    case 'lower_spAtk':
    case 'flinch':
    case 'burn':
    case 'poison':
    case 'paralyze':
    case 'freeze':
    case 'sleep':
    case 'confuse':
    case 'trap':
      return true;
    default:
      return false;
  }
}
