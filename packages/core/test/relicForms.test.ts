/**
 * Relic forms (`SpeciesDef.battleForms`, ravatar's): each form opens only while its item is held, on entering the
 * field or (with `hpBelowPct`) below its line; a `typeFromForm` move takes the held form's type and an
 * `effectOnlyBaseForm` move keeps its effect only in the base form (`formMove`). The two ability hooks of the Elemutt
 * line: `modifyDamage` with `when: 'fullHp'` / `contact` (Inner Chi) and `afterMoveUsed` (Stance Change).
 */
import { describe, expect, it } from 'vitest';
import { calcDamage, createBattle, createRng, formMove, formsOf, resolveTurn } from '../src/index';
import type { BattleFormDef, BattleState, ItemDef } from '../src/index';
import { activeOf, content, customMove, eventsOf, makeSide, move } from './helpers';
import type { CreatureSpec } from './helpers';

const relic = (id: string): ItemDef => ({ id, name: id, description: '', slot: 'held', fieldVerb: null, hooks: [], price: null });
content.withItem(relic('R:scale')).withItem(relic('R:vial'));

const WATER: BattleFormDef = {
  id: 'water', name: 'Water Form', heldItem: 'R:scale', baseAtk: 60, baseDef: 60, baseSpd: 60, types: ['Water'],
  onEnter: { clearNegativeStages: false, lowerFoes: null, cureStatus: true, healFraction: 0.125 },
  sprite: { front: 'r_water_front', back: 'r_water_back' },
};
const AVATAR: BattleFormDef = {
  id: 'avatar', name: 'Avatar State', heldItem: 'R:vial', hpBelowPct: 30, baseAtk: 90, baseDef: 90, baseSpd: 90,
  types: ['Normal', 'Psychic'], moveType: 'Psychic',
  onEnter: { clearNegativeStages: true, lowerFoes: null, cureStatus: true, healFraction: 0.25 },
  sprite: { front: 'r_avatar_front', back: 'r_avatar_back' },
};
content.withSpecies({ ...content.species('mufflo'), id: 'R:ravatar', name: 'Relicmon', battleForms: [WATER, AVATAR] });

const CONV = customMove('Tackle', 'R:conv', {
  type: 'Normal', power: 100, accuracy: null, contact: false, effect: 'raise_all', effectChance: 100,
  typeFromForm: true, effectOnlyBaseForm: true,
});
const NOOP = customMove('Growl', 'R:noop', { effect: null, accuracy: null });
const TACKLE = customMove('Tackle', 'R:tackle', { power: 20, accuracy: null, effect: null });
const SPRAY = customMove('Tackle', 'R:spray', { power: 20, accuracy: null, effect: null, contact: false });

content.withAbility({ id: 'R:chi', name: 'Inner Chi', description: '', hooks: [{ kind: 'modifyDamage', side: 'attacker', when: 'fullHp', contact: false, mul: 1.3 }] });
content.withAbility({
  id: 'R:stance', name: 'Stance Change', description: '',
  hooks: [{ kind: 'afterMoveUsed', contact: { stat: 'def', stages: 1 }, nonContact: { stat: 'spd', stages: 1 }, cap: 2 }],
});

const MOVES = [CONV.id, NOOP.id, TACKLE.id, SPRAY.id];
const S = (species: string, extra: Partial<CreatureSpec> = {}): CreatureSpec => ({ species, level: 50, ability: 'Natural Cure', moves: MOVES, ...extra });

function start(a: CreatureSpec, b: CreatureSpec): BattleState {
  return createBattle({
    id: 'relic', format: 'trainer', zoneId: 'mirevale', terrain: 'grove', seed: 'relic',
    sides: [makeSide({ party: [a] }, 'player', 'trainer', content), makeSide({ party: [b] }, 'foe', 'trainer', content)],
  }, content).state;
}

describe('relic forms', () => {
  it('formsOf reads battleForms, else the one battleForm, else none', () => {
    expect(formsOf(content.species('R:ravatar')).map((f) => f.id)).toEqual(['water', 'avatar']);
    expect(formsOf(content.species('mufflo'))).toEqual([]);
  });

  it('a held relic opens its form as the battler lands; no relic, no form', () => {
    expect(activeOf(start(S('R:ravatar', { heldItem: 'R:scale' }), S('mufflo')), 0).form).toBe('water');
    expect(activeOf(start(S('R:ravatar'), S('mufflo')), 0).form).toBeUndefined();
    expect(activeOf(start(S('R:ravatar', { heldItem: 'Charcoal' }), S('mufflo')), 0).form).toBeUndefined();
  });

  it('the vial opens the Avatar State only below 30% hp', () => {
    expect(activeOf(start(S('R:ravatar', { heldItem: 'R:vial' }), S('mufflo')), 0).form).toBeUndefined();
    const low = start(S('R:ravatar', { heldItem: 'R:vial', hp: 20 }), S('mufflo'));
    expect(activeOf(low, 0).form).toBe('avatar');
  });

  it('formMove: the held form retypes the move and drops its base-form-only effect', () => {
    const sp = content.species('R:ravatar');
    expect(formMove(content, sp, {}, CONV.id)).toMatchObject({ type: 'Normal', effect: 'raise_all' });
    expect(formMove(content, sp, { form: 'water' }, CONV.id)).toMatchObject({ type: 'Water', effect: null });
    expect(formMove(content, sp, { form: 'avatar' }, CONV.id)).toMatchObject({ type: 'Psychic', effect: null });
    expect(formMove(content, sp, { form: 'water' }, TACKLE.id)).toBe(content.move(TACKLE.id));
  });

  it('in battle: Water Form hits as Water with STAB and no raise; the base form raises all three stats', () => {
    const water = resolveTurn(start(S('R:ravatar', { heldItem: 'R:scale' }), S('mufflo', { level: 80 })), [move(CONV.id), move(NOOP.id)], content);
    expect(eventsOf(water.events, 'damage').find((e) => e.move === CONV.id)).toMatchObject({ stab: true });
    expect(eventsOf(water.events, 'statStage').filter((e) => e.cause === 'move' && e.target.side === 0)).toEqual([]);

    const base = resolveTurn(start(S('R:ravatar'), S('mufflo', { level: 80 })), [move(CONV.id), move(NOOP.id)], content);
    const raised = eventsOf(base.events, 'statStage').filter((e) => e.cause === 'move' && e.target.side === 0).map((e) => e.stat);
    expect(raised).toEqual(['atk', 'def', 'spd']);
  });

  it('Inner Chi: x1.3 on a non-contact move at full hp only, never on a contact move', () => {
    const dmg = (hp: number | undefined, m: string): number => {
      const st = start(S('mufflo', { ability: 'R:chi', ...(hp === undefined ? {} : { hp }) }), S('mufflo'));
      return calcDamage(st, 0, content.move(m), createRng('chi'), content).amount;
    };
    const plain = (m: string): number => calcDamage(start(S('mufflo'), S('mufflo')), 0, content.move(m), createRng('chi'), content).amount;
    expect(dmg(undefined, SPRAY.id)).toBe(Math.floor(plain(SPRAY.id) * 1.3));
    expect(dmg(50, SPRAY.id)).toBe(plain(SPRAY.id));
    expect(dmg(undefined, TACKLE.id)).toBe(plain(TACKLE.id));
  });

  it('Stance Change: contact raises Def, non-contact raises Spd, at most +2 each per switch-in', () => {
    let st = start(S('mufflo', { ability: 'R:stance', level: 20 }), S('mufflo', { level: 90 }));
    for (let i = 0; i < 3; i++) st = resolveTurn(st, [move(TACKLE.id), move(NOOP.id)], content).state;
    expect(activeOf(st, 0).stages.def).toBe(2);
    st = resolveTurn(st, [move(SPRAY.id), move(NOOP.id)], content).state;
    expect(activeOf(st, 0).stages).toMatchObject({ def: 2, spd: 1 });
  });
});
