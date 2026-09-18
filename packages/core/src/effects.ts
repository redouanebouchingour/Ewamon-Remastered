/**
 * §2.4 — the 23 move effects as a handler table keyed by effect. Every handler runs AFTER the move has
 * hit and (for chance-gated effects) after the effectChance roll succeeded. "Attacker" is the user of
 * the move; "defender" is the foe's active battler.
 */
import {
  active,
  activeRef,
  changeStage,
  dealDamage,
  emit,
  healBattler,
  isAlive,
  other,
  setWeather,
  tryApplyStatus,
} from './engine';
import type { Ctx } from './engine';
import type { MoveDef, MoveEffect, StatKey, StatusId, WeatherKind } from './types';

export type EffectHandler = (ctx: Ctx, attacker: 0 | 1, move: MoveDef, damageDealt: number) => void;

function lowerFoe(stat: StatKey): EffectHandler {
  return (ctx, attacker) => {
    const foeSide = other(attacker);
    if (!isAlive(active(ctx, foeSide))) return;
    changeStage(ctx, activeRef(ctx, foeSide), stat, -1, activeRef(ctx, attacker), 'move');
  };
}

function raiseSelf(stats: readonly StatKey[]): EffectHandler {
  return (ctx, attacker) => {
    if (!isAlive(active(ctx, attacker))) return;
    for (let i = 0; i < stats.length; i++) {
      changeStage(ctx, activeRef(ctx, attacker), stats[i]!, 1, activeRef(ctx, attacker), 'move');
    }
  };
}

function inflict(status: StatusId): EffectHandler {
  return (ctx, attacker) => {
    const foeSide = other(attacker);
    if (!isAlive(active(ctx, foeSide))) return;
    tryApplyStatus(ctx, activeRef(ctx, foeSide), status, activeRef(ctx, attacker));
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
  flinch: (ctx, attacker) => {
    const foeSide = other(attacker);
    const foe = active(ctx, foeSide);
    if (!isAlive(foe) || foe.volatile.movedThisTurn) return;
    foe.volatile.flinched = true;
  },
  burn: inflict('burn'),
  poison: inflict('poison'),
  paralyze: inflict('paralyze'),
  freeze: inflict('freeze'),
  sleep: inflict('sleep'),
  confuse: inflict('confuse'),
  trap: (ctx, attacker) => {
    const foeSide = other(attacker);
    const foe = active(ctx, foeSide);
    if (!isAlive(foe) || foe.volatile.trappedTurns > 0) return;
    const turns = 4 + ctx.rng.int(2);
    foe.volatile.trappedTurns = turns;
    emit(ctx, { t: 'trapped', target: activeRef(ctx, foeSide), turns, source: activeRef(ctx, attacker) });
  },
  recoil: (ctx, attacker, move, dealt) => {
    if (dealt <= 0 || !isAlive(active(ctx, attacker))) return;
    const amt = Math.max(1, Math.floor(dealt / 4));
    dealDamage(ctx, activeRef(ctx, attacker), amt, 'recoil', activeRef(ctx, attacker), move.id);
  },
  drain: (ctx, attacker, _move, dealt) => {
    if (dealt <= 0 || !isAlive(active(ctx, attacker))) return;
    const amt = Math.max(1, Math.floor(dealt / 2));
    healBattler(ctx, activeRef(ctx, attacker), amt, 'drain', null);
  },
  heal: (ctx, attacker, move) => {
    const b = active(ctx, attacker);
    if (!isAlive(b)) return;
    if (b.creature.hp >= b.maxHp) {
      emit(ctx, { t: 'moveFailed', who: activeRef(ctx, attacker), move: move.id, reason: 'fullHp' });
      return;
    }
    healBattler(ctx, activeRef(ctx, attacker), Math.floor(b.maxHp / 2), 'move', null);
  },
  weather: (ctx, attacker, move) => {
    setWeather(ctx, weatherForType(move.type), activeRef(ctx, attacker));
  },
  sun: (ctx, attacker) => {
    setWeather(ctx, 'sun', activeRef(ctx, attacker));
  },
};

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
