/**
 * Phase D14 — the battle tower's two core rules: `capLevel` (a creature fights at `min(level, cap)`, fully healed, the
 * stored instance untouched) and `noExp` (a tower battle awards no exp). Absent `noExp` keeps the state byte-identical.
 */
import { describe, expect, it } from 'vitest';
import { calcMaxHp, calcStat, capLevel, createBattle, expToLevel, projectBattler, resolveTurn } from '../src/index';
import type { BattleState } from '../src/index';
import { content, creature, customMove, eventsOf, makeSide } from './helpers';

const KO = customMove('Tackle', 'T:ko', { type: 'Normal', power: 250, accuracy: null, effect: null, effectChance: 100 });

function battle(noExp: boolean | undefined, slots?: 2): BattleState {
  const a = { party: [{ species: 'bramblecub', level: 50, ability: 'Chlorophyll', moves: [KO.id] }, { species: 'bramblecub', level: 50, ability: 'Chlorophyll', moves: [KO.id] }] };
  const b = { party: [{ species: 'mufflo', level: 50, ability: 'Natural Cure', moves: [KO.id], hp: 1 }, { species: 'mufflo', level: 50, ability: 'Natural Cure', moves: [KO.id], hp: 1 }] };
  return createBattle(
    {
      id: 'tower',
      format: 'trainer',
      zoneId: 'solenne',
      terrain: 'none',
      seed: 'tower',
      sides: [makeSide(a, 'player', 'trainer', content), makeSide(b, 'foe', 'trainer', content)],
      ...(noExp === undefined ? {} : { noExp }),
      ...(slots === 2 ? { slots } : {}),
    },
    content,
  ).state;
}

describe('capLevel (Phase D14)', () => {
  it('lowers a creature above the cap to the cap: exp at that level, full hp, no status, full pp — the input untouched', () => {
    const c = creature({ species: 'bramblecub', level: 70, hp: 3, status: ['burn'], pp: 0 });
    const before = JSON.stringify(c);
    const capped = capLevel(c, 50, content);
    expect(JSON.stringify(c)).toBe(before);
    const sp = content.species('bramblecub');
    expect(capped.level).toBe(50);
    expect(capped.exp).toBe(expToLevel(50));
    expect(capped.hp).toBe(calcMaxHp(sp.baseHp, 50));
    expect(capped.status).toEqual([]);
    expect(capped.moves.every((m) => m.pp === m.ppMax)).toBe(true);
    expect(capped.id).toBe(c.id);
    const b = projectBattler(capped, content);
    expect([b.maxHp, b.atk, b.def, b.spd]).toEqual([calcMaxHp(sp.baseHp, 50), calcStat(sp.baseAtk, 50), calcStat(sp.baseDef, 50), calcStat(sp.baseSpd, 50)]);
  });

  it('keeps a creature at or under the cap at its level and exp, and heals it', () => {
    const c = creature({ species: 'mufflo', level: 30, hp: 1, exp: expToLevel(30) + 123 });
    const capped = capLevel(c, 50, content);
    expect(capped.level).toBe(30);
    expect(capped.exp).toBe(expToLevel(30) + 123);
    expect(capped.hp).toBe(calcMaxHp(content.species('mufflo').baseHp, 30));
  });
});

describe('noExp (Phase D14)', () => {
  it('absent keeps the state shape: no `noExp` key, and a KO awards exp as before', () => {
    const st = battle(undefined);
    expect('noExp' in st).toBe(false);
    expect('noExp' in battle(false)).toBe(false);
    const r = resolveTurn(st, [{ kind: 'move', move: KO.id }, { kind: 'move', move: KO.id }], content);
    expect(eventsOf(r.events, 'expGain').length).toBeGreaterThan(0);
  });

  it('true: the KO awards no exp and the flag survives every turn', () => {
    const st = battle(true);
    expect(st.noExp).toBe(true);
    const r = resolveTurn(st, [{ kind: 'move', move: KO.id }, { kind: 'move', move: KO.id }], content);
    expect(eventsOf(r.events, 'faint').length).toBeGreaterThan(0);
    expect(eventsOf(r.events, 'expGain')).toEqual([]);
    expect(eventsOf(r.events, 'levelUp')).toEqual([]);
    expect(r.state.noExp).toBe(true);
    expect(r.state.sides[0].party.map((b) => b.creature.exp)).toEqual(st.sides[0].party.map((b) => b.creature.exp));
  });

  it('applies in doubles too', () => {
    const st = battle(true, 2);
    expect(st.noExp).toBe(true);
    expect(st.slots).toBe(2);
    const r = resolveTurn(st, [[{ kind: 'move', move: KO.id, target: { side: 1, pos: 0 } }, { kind: 'move', move: KO.id, target: { side: 1, pos: 1 } }], [null, null]], content);
    expect(eventsOf(r.events, 'expGain')).toEqual([]);
    expect(r.state.noExp).toBe(true);
  });
});
