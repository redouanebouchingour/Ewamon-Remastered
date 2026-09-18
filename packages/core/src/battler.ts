/**
 * §2.9 — CreatureInstance → Battler projection, and back. Derived stats are never persisted: they are
 * computed from species + level every time.
 */
import { calcMaxHp, calcStat } from './stats';
import { removeStatus } from './status';
import type { Battler, ContentIndex, CreatureInstance, StatKey, StatStage, Volatile } from './types';

export const DEFAULT_VOLATILE: Volatile = {
  confusedTurns: 0,
  trappedTurns: 0,
  sleepTurns: 0,
  flinched: false,
  flashFired: false,
  choiceLockedMove: null,
  berryConsumed: false,
  weaknessPolicyUsed: false,
  lastMove: null,
  movedThisTurn: false,
};

export const ZERO_STAGES: Readonly<Record<StatKey, StatStage>> = { atk: 0, def: 0, spd: 0, acc: 0, eva: 0 };

export function projectBattler(c: CreatureInstance, content: ContentIndex): Battler {
  const sp = content.species(c.speciesId);
  const maxHp = calcMaxHp(sp.baseHp, c.level);
  return {
    creature: { ...c, hp: Math.max(0, Math.min(maxHp, Math.floor(c.hp))) },
    maxHp,
    atk: calcStat(sp.baseAtk, c.level),
    def: calcStat(sp.baseDef, c.level),
    spd: calcStat(sp.baseSpd, c.level),
    stages: { ...ZERO_STAGES },
    volatile: { ...DEFAULT_VOLATILE },
    participated: false,
  };
}

/**
 * The persisted creature after a battle: the battler's authoritative hp / level / exp / pp / major
 * statuses, with battle-only volatile state (confusion) stripped. Pure; returns a new object.
 */
export function applyBattleOutcome(b: Battler): CreatureInstance {
  const c = b.creature;
  return { ...c, status: removeStatus(c.status, 'confuse'), moves: c.moves.map((m) => ({ ...m })) };
}
