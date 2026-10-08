/**
 * Battle forms (`SpeciesDef.battleForm`, hollowmane's rage form): the change happens once per battle, the first time
 * the battler is below the line while standing — after damage or on entering the field — its atk / def / spd and the
 * damage formula follow the form's base stats, `onEnter` clears its negative stages and lowers the foes on the field,
 * and a species without a form keeps its exact state shape.
 */
import { describe, expect, it } from 'vitest';
import { calcStat, canonicalJson, createBattle, resolveTurn } from '../src/index';
import type { Action, BattleFormDef, BattleState, MoveDef } from '../src/index';
import { activeOf, content, customMove, eventTypes, eventsOf, makeSide, move, startBattle, sw, turn } from './helpers';
import type { CreatureSpec } from './helpers';

const RAGE: BattleFormDef = {
  id: 'rage',
  name: 'Rage Form',
  hpBelowPct: 50,
  baseAtk: 120,
  baseDef: 20,
  baseSpd: 110,
  onEnter: { clearNegativeStages: true, lowerFoes: { stat: 'atk', stages: 1 } },
  sprite: { front: 'rage_front', back: 'rage_back' },
};
// mufflo (HP 55 / Atk 40 / Def 50 / Spd 45) with a form: max hp 125 at L50, so 62 is the last hp at or above half
content.withSpecies({ ...content.species('mufflo'), id: 'F:rage', name: 'Ragemon', battleForm: RAGE });

const sure = (base: string, id: string, patch: Partial<MoveDef> = {}): MoveDef => customMove(base, id, { effectChance: 100, accuracy: null, ...patch });
const NOOP = sure('Growl', 'F:noop', { effect: null });
const GROWL = sure('Growl', 'F:growl');
const TACKLE = sure('Tackle', 'F:tackle');
const BIG = sure('Vine Lash', 'F:big', { type: 'Normal', power: 250 });
const MOVES = [TACKLE.id, GROWL.id, NOOP.id, BIG.id];

const P = (extra: Partial<CreatureSpec> = {}): CreatureSpec => ({ species: 'bramblecub', level: 50, ability: 'Chlorophyll', moves: MOVES, ...extra });
const R = (extra: Partial<CreatureSpec> = {}): CreatureSpec => ({ species: 'F:rage', level: 50, ability: 'Natural Cure', moves: MOVES, ...extra });

describe('battle forms', () => {
  it('changes the first time a hit takes it below half: stats from the form base, onEnter stages, once per battle', () => {
    const st = startBattle({ a: P(), b: R({ hp: 64 }), seed: 'f1' }).state;
    const r = turn(st, move(TACKLE.id), move(NOOP.id));
    const after = activeOf(r.state, 1);
    expect(after.creature.hp * 2).toBeLessThan(after.maxHp);
    expect(after.form).toBe('rage');
    expect(after.maxHp).toBe(125);
    expect([after.atk, after.def, after.spd]).toEqual([calcStat(120, 50), calcStat(20, 50), calcStat(110, 50)]);
    const fc = eventsOf(r.events, 'formChange');
    expect(fc).toEqual([{ t: 'formChange', who: { side: 1, slot: 0 }, form: 'rage', atk: after.atk, def: after.def, spd: after.spd }]);
    // right after the damage that crossed the line, then the roar lowers the foe's attack
    const types = eventTypes(r.events);
    expect(types[types.indexOf('formChange') - 1]).toBe('damage');
    expect(eventsOf(r.events, 'statStage')).toContainEqual(expect.objectContaining({ target: { side: 0, slot: 0 }, stat: 'atk', delta: -1, source: { side: 1, slot: 0 }, cause: 'ability' }));
    expect(activeOf(r.state, 0).stages.atk).toBe(-1);
    // once per battle: further hits below the line change nothing
    const r2 = turn(r.state, move(TACKLE.id), move(NOOP.id));
    expect(eventsOf(r2.events, 'formChange')).toEqual([]);
    expect(activeOf(r2.state, 1).form).toBe('rage');
  });

  it('does not change at or above half, nor on the hit that knocks it out', () => {
    const half = startBattle({ a: P(), b: R({ hp: 63 }), seed: 'f2' }).state;
    const noop = turn(half, move(NOOP.id), move(NOOP.id));
    expect(activeOf(noop.state, 1).form).toBeUndefined();
    const ko = turn(startBattle({ a: P(), b: R({ hp: 64 }), seed: 'f2' }).state, move(BIG.id), move(NOOP.id));
    expect(activeOf(ko.state, 1).creature.hp).toBe(0);
    expect(eventsOf(ko.events, 'formChange')).toEqual([]);
    expect(activeOf(ko.state, 1).form).toBeUndefined();
  });

  it('clears its own negative stages as it changes', () => {
    let st = startBattle({ a: P(), b: R({ hp: 64 }), seed: 'f3' }).state;
    st = turn(st, move(GROWL.id), move(NOOP.id)).state;
    expect(activeOf(st, 1).stages.atk).toBe(-1);
    const r = turn(st, move(TACKLE.id), move(NOOP.id));
    expect(activeOf(r.state, 1).stages.atk).toBe(0);
    expect(eventsOf(r.events, 'statStage')).toContainEqual(expect.objectContaining({ target: { side: 1, slot: 0 }, stat: 'atk', delta: 1, after: 0, source: { side: 1, slot: 0 }, cause: 'ability' }));
  });

  it('the damage formula reads the form base: the changed battler hits harder and takes more', () => {
    const fresh = startBattle({ a: P(), b: R(), seed: 'f4' }).state;
    const raged = startBattle({ a: P(), b: R({ hp: 64 }), seed: 'f4' }).state;
    const changed = turn(raged, move(NOOP.id), move(NOOP.id)).state; // nothing yet: 64 is above half
    expect(activeOf(changed, 1).form).toBeUndefined();
    const hit = (s: BattleState): number => eventsOf(turn(s, move(NOOP.id), move(TACKLE.id)).events, 'damage').find((e) => e.target.side === 0)!.amount;
    const before = hit(fresh);
    const formed = turn(raged, move(TACKLE.id), move(NOOP.id)).state;
    // undo the roar so the comparison is the base stats alone
    const neutral: BattleState = { ...formed, sides: [{ ...formed.sides[0], party: formed.sides[0].party.map((b) => ({ ...b, stages: { ...b.stages, atk: 0 } })) }, formed.sides[1]] };
    expect(hit(neutral)).toBeGreaterThan(before);
  });

  it('changes as it enters already below half, and keeps the form through a switch out and back', () => {
    const st = startBattle({ a: [P(), P()], b: [P({ moves: MOVES }), R({ hp: 30 })], seed: 'f5' }).state;
    const r = turn(st, move(NOOP.id), sw(1));
    expect(eventsOf(r.events, 'formChange').length).toBe(1);
    const types = eventTypes(r.events);
    expect(types.indexOf('formChange')).toBeGreaterThan(types.indexOf('switchIn'));
    const out = turn(r.state, move(NOOP.id), sw(0)).state;
    expect(out.sides[1].party[1]!.form).toBe('rage');
    const back = turn(out, move(NOOP.id), sw(1));
    expect(eventsOf(back.events, 'formChange')).toEqual([]);
    expect(activeOf(back.state, 1).form).toBe('rage');
    expect(activeOf(back.state, 1).atk).toBe(calcStat(120, 50));
  });

  it('a lead below half changes at createBattle', () => {
    const created = startBattle({ a: P(), b: R({ hp: 30 }), seed: 'f6' });
    expect(eventsOf(created.events, 'formChange').length).toBe(1);
    expect(activeOf(created.state, 1).form).toBe('rage');
    expect(activeOf(created.state, 0).stages.atk).toBe(-1);
  });

  it('a species without a form keeps its exact battler shape (no form key) through damage below half', () => {
    const st = startBattle({ a: P(), b: { species: 'mufflo', level: 50, ability: 'Natural Cure', moves: MOVES, hp: 64 }, seed: 'f7' }).state;
    const r = turn(st, move(TACKLE.id), move(NOOP.id));
    expect(eventsOf(r.events, 'formChange')).toEqual([]);
    expect('form' in activeOf(r.state, 1)).toBe(false);
    expect(canonicalJson(r.state)).not.toContain('"form"');
  });

  it('doubles: the roar lowers both foes on the field', () => {
    const mv = (m: string): Action => ({ kind: 'move', move: m });
    const st = createBattle(
      { id: 'fd', format: 'pvp', zoneId: 'mirevale', terrain: 'grove', seed: 'f8', slots: 2, sides: [makeSide({ party: [P(), P()] }, 'player', 'pvp', content), makeSide({ party: [R({ hp: 64 }), R()] }, 'foe', 'pvp', content)] },
      content,
    ).state;
    const r = resolveTurn(st, [[{ kind: 'move', move: TACKLE.id, target: { side: 1, pos: 0 } }, mv(NOOP.id)], [mv(NOOP.id), mv(NOOP.id)]], content);
    expect(eventsOf(r.events, 'formChange').map((e) => e.who)).toEqual([{ side: 1, slot: 0 }]);
    expect(r.state.sides[0].party.map((b) => b.stages.atk)).toEqual([-1, -1]);
  });
});
