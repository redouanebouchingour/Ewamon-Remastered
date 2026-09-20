/** Hand-built core shapes (no ContentIndex needed) for the wire tests. */
import type { BattleState, Battler, CreatureInstance, Side } from '@ewa/core';

export const U1 = '11111111-1111-4111-8111-111111111111';
export const U2 = '22222222-2222-4222-8222-222222222222';
export const U3 = '33333333-3333-4333-8333-333333333333';
export const ISO = '2026-09-20T12:00:00.000Z';

export function creature(over: Partial<CreatureInstance> = {}): CreatureInstance {
  return {
    id: U2,
    ownerId: U1,
    speciesId: 'bramblecub',
    nickname: null,
    level: 12,
    exp: 1728,
    hp: 40,
    moves: [
      { id: 'tackle', pp: 35, ppMax: 35 },
      { id: 'vine_lash', pp: 20, ppMax: 25 },
    ],
    status: [],
    ability: 'overgrow',
    heldItem: null,
    variantKey: 'normal',
    isAlpha: false,
    caughtAt: { zoneId: 'mire_route', at: 1_758_369_600_000 },
    ribbons: [],
    favorite: false,
    locked: false,
    ...over,
  };
}

export function battler(c: CreatureInstance = creature()): Battler {
  return {
    creature: c,
    maxHp: 44,
    atk: 30,
    def: 28,
    spd: 27,
    stages: { atk: 0, def: 0, spd: 0, acc: 0, eva: 0 },
    volatile: {
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
    },
    participated: true,
  };
}

export function side(kind: Side['kind'], trainerId: string | null, c: CreatureInstance): Side {
  return {
    kind,
    party: [battler(c)],
    active: 0,
    trainerId,
    canFlee: kind === 'player',
    canCatch: kind === 'player',
    mustSwitch: false,
    consumedItems: [],
  };
}

export function battleState(over: Partial<BattleState> = {}): BattleState {
  return {
    id: U3,
    format: 'wild',
    sides: [
      side('player', U1, creature()),
      side('wild', null, creature({ id: 'wild-1', ownerId: null, speciesId: 'glimfin', level: 9, hp: 30 })),
    ],
    field: { weather: { kind: 'none', turns: 0 }, terrain: 'grove' },
    turn: 3,
    rng: [1, 2, 3, 4],
    ended: null,
    zoneId: 'mire_route',
    ...over,
  };
}
