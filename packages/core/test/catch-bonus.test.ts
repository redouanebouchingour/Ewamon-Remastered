/**
 * Dex research's catch perk: `BattleState.catchBonus` (species id -> multiplier) read by `catchValue`. Absent, the
 * state, its digest and every catch value are exactly what they were before the field existed.
 */
import { describe, expect, it } from 'vitest';
import { createBattle, digestBattleState } from '../src/index';
import type { Battler, CreateBattleOpts } from '../src/index';
import { catchValue } from '../src/catch';
import { battler, catchWith, content, eventsOf, makeSide, turn } from './helpers';

// one pair of sides for every battle here (the helpers mint fresh creature ids per call)
const SIDES: CreateBattleOpts['sides'] = [
  makeSide({ party: [{ species: 'bramblecub', level: 30 }] }, 'player', 'wild', content),
  makeSide({ party: [{ species: 'cindercap', level: 30 }] }, 'foe', 'wild', content),
];

function opts(catchBonus?: Readonly<Record<string, number>>): CreateBattleOpts {
  return {
    id: 'bonus-battle',
    format: 'wild',
    zoneId: 'mirevale',
    terrain: 'grove',
    seed: 'ewamon',
    sides: SIDES,
    ...(catchBonus !== undefined ? { catchBonus } : {}),
  };
}

describe('Dex research catch bonus', () => {
  it('catchValue: the default bonus is 1 and leaves the value unchanged; a bonus multiplies inside the floor', () => {
    const full = battler({ species: 'bramblecub', level: 30 });
    const wild: Battler = { ...full, creature: { ...full.creature, hp: Math.floor(full.maxHp / 2) } };
    const sp = content.species('bramblecub');
    const o = content.orb('spark_orb');
    const base = catchValue(wild, sp, o);
    expect(catchValue(wild, sp, o, 1)).toBe(base);
    const M = wild.maxHp;
    const H = wild.creature.hp;
    expect(catchValue(wild, sp, o, 1.5)).toBe(Math.floor(((3 * M - 2 * H) * 45 * 1.5) / (3 * M)));
    expect(catchValue(wild, sp, o, 1.5)).toBeGreaterThan(base);
  });

  it('createBattle without a bonus (or with an empty one) gives the very same state and digest', () => {
    const plain = createBattle(opts(), content);
    const empty = createBattle(opts({}), content);
    expect('catchBonus' in plain.state).toBe(false);
    expect(empty.state).toEqual(plain.state);
    expect(digestBattleState(empty.state)).toBe(digestBattleState(plain.state));
  });

  it('with a bonus the state carries it (so the digest covers it) and the catch reads it for that species only', () => {
    const plain = createBattle(opts(), content);
    const boosted = createBattle(opts({ cindercap: 1.5 }), content);
    expect(boosted.state.catchBonus).toEqual({ cindercap: 1.5 });
    expect(digestBattleState(boosted.state)).not.toBe(digestBattleState(plain.state));
    // the same seed and throw: the boosted battle's catch is never worse; across seeds it catches more often
    let plainCaught = 0;
    let boostCaught = 0;
    for (let seed = 0; seed < 300; seed++) {
      const a = createBattle({ ...opts(), seed }, content);
      const b = createBattle({ ...opts({ cindercap: 2 }), seed }, content);
      const ra = eventsOf(turn(a.state, catchWith('spark_orb'), null).events, 'catchResult')[0]!;
      const rb = eventsOf(turn(b.state, catchWith('spark_orb'), null).events, 'catchResult')[0]!;
      expect(rb.shakes).toBeGreaterThanOrEqual(ra.shakes);
      if (ra.caught) plainCaught++;
      if (rb.caught) boostCaught++;
    }
    expect(boostCaught).toBeGreaterThan(plainCaught);
    // a bonus for another species changes nothing about this catch
    const other = createBattle(opts({ bramblecub: 3 }), content);
    const r1 = turn(plain.state, catchWith('spark_orb'), null);
    const r2 = turn(other.state, catchWith('spark_orb'), null);
    expect(eventsOf(r2.events, 'catchResult')).toEqual(eventsOf(r1.events, 'catchResult'));
  });
});
