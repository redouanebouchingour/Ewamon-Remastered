/**
 * A battle form with its own types (`BattleFormDef.types`, hyoryu's Majin Form: Ice/Dragon becomes Dragon/Dark): while
 * the battler holds the form, the type chart, STAB, status immunity and weather chip read the form's types
 * (`formTypes`); before the change, and for every form without `types`, the species' types are kept.
 */
import { describe, expect, it } from 'vitest';
import { createBattle, formTypes, resolveTurn } from '../src/index';
import type { Action, BattleFormDef, BattleState } from '../src/index';
import { activeOf, content, customMove, eventsOf, makeSide, move } from './helpers';
import type { CreatureSpec } from './helpers';

// mufflo is Normal; in its form it is Ghost/Fire
const FORM: BattleFormDef = {
  id: 'majin', name: 'Majin Form', kind: 'majin', hpBelowPct: 50, baseAtk: 40, baseDef: 50, baseSpd: 45,
  types: ['Ghost', 'Fire'],
  onEnter: { clearNegativeStages: false, lowerFoes: null },
  sprite: { front: 'typed_front', back: 'typed_back' },
};
content.withSpecies({ ...content.species('mufflo'), id: 'T:typed', name: 'Typedmon', battleForm: FORM });
content.withSpecies({ ...content.species('mufflo'), id: 'T:untyped', name: 'Untypedmon', battleForm: { ...FORM, id: 'plain', types: undefined } });

const PUNCH = customMove('Tackle', 'T:punch', { type: 'Fighting', accuracy: null, effect: null });
const EMBER = customMove('Tackle', 'T:ember', { type: 'Fire', accuracy: null, effect: null });
const BURN = customMove('Tackle', 'T:burn', { type: 'Water', effect: 'burn', effectChance: 100, accuracy: null });
const NOOP = customMove('Growl', 'T:ftnoop', { effect: null, accuracy: null });
const MOVES = [PUNCH.id, EMBER.id, BURN.id, NOOP.id];

const S = (species: string, extra: Partial<CreatureSpec> = {}): CreatureSpec => ({ species, level: 50, ability: 'Natural Cure', moves: MOVES, ...extra });

function start(a: CreatureSpec, b: CreatureSpec): BattleState {
  return createBattle({
    id: 'formtypes', format: 'trainer', zoneId: 'mirevale', terrain: 'grove', seed: 'ft',
    sides: [
      { ...makeSide({ party: [a] }, 'player', 'trainer', content), bands: ['majin'] },
      makeSide({ party: [b] }, 'foe', 'trainer', content),
    ],
  }, content).state;
}
const tmove = (id: string): Action => ({ kind: 'move', move: id, transform: true });

describe('battle form types', () => {
  it('formTypes: the form’s types while it holds the form, the species’ otherwise', () => {
    const sp = content.species('T:typed');
    expect(formTypes(sp, {})).toEqual(['Normal']);
    expect(formTypes(sp, { form: 'majin' })).toEqual(['Ghost', 'Fire']);
    expect(formTypes(content.species('T:untyped'), { form: 'plain' })).toEqual(['Normal']);
  });

  it('defending: a Fighting hit lands before the change and is stopped by the Ghost type after it', () => {
    const before = resolveTurn(start(S('T:typed'), S('mufflo')), [move(NOOP.id), move(PUNCH.id)], content);
    expect(eventsOf(before.events, 'damage').find((e) => e.move === PUNCH.id)).toMatchObject({ effectiveness: 2 });

    const st = start(S('T:typed', { hp: 40 }), S('mufflo'));
    const r = resolveTurn(st, [tmove(EMBER.id), move(PUNCH.id)], content);
    expect(activeOf(r.state, 0).form).toBe('majin');
    expect(eventsOf(r.events, 'damage').filter((e) => e.move === PUNCH.id)).toEqual([]);
    expect(eventsOf(r.events, 'moveFailed').find((e) => e.move === PUNCH.id)).toMatchObject({ reason: 'immune' });
  });

  it('attacking: Fire gains STAB in the form; status immunity follows the form (a Fire-type is not burned)', () => {
    const st = start(S('T:typed', { hp: 40 }), S('mufflo'));
    const r = resolveTurn(st, [tmove(EMBER.id), move(BURN.id)], content);
    const ember = eventsOf(r.events, 'damage').find((e) => e.move === EMBER.id);
    expect(ember).toMatchObject({ stab: true });
    expect(eventsOf(r.events, 'statusBlocked')[0]).toMatchObject({ status: 'burn', reason: 'type' });

    const plain = resolveTurn(start(S('T:untyped', { hp: 40 }), S('mufflo')), [tmove(EMBER.id), move(NOOP.id)], content);
    expect(eventsOf(plain.events, 'damage').find((e) => e.move === EMBER.id)).toMatchObject({ stab: false });
  });
});
