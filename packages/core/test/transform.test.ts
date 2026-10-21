/**
 * Majin / Tenjin (`.design/majin-tenjin.md`): a trainer transforms its battler by choice (`Action.transform`) once per
 * battle, holding the band of the form's kind, with the hp line met (Majin below it, Tenjin at or above). The change
 * happens at the start of the turn, before any move, and the move then runs in the new form. A wild Majin still changes
 * on its own; a trained one never does; a Tenjin never does. Sides without bands keep their exact state shape.
 */
import { describe, expect, it } from 'vitest';
import { calcStat, canonicalJson, createBattle, resolveTurn, validateAction } from '../src/index';
import type { Action, BandKind, BattleFormDef, BattleState, MoveDef } from '../src/index';
import { activeOf, content, customMove, eventTypes, eventsOf, makeSide, move } from './helpers';
import type { CreatureSpec } from './helpers';

const MAJIN: BattleFormDef = {
  id: 'majin', name: 'Majin Form', kind: 'majin', hpBelowPct: 50, baseAtk: 120, baseDef: 20, baseSpd: 110,
  onEnter: { clearNegativeStages: true, lowerFoes: { stat: 'atk', stages: 1 } },
  sprite: { front: 'majin_front', back: 'majin_back' },
};
const TENJIN: BattleFormDef = {
  id: 'tenjin', name: 'Tenjin Form', kind: 'tenjin', hpBelowPct: 50, baseAtk: 60, baseDef: 90, baseSpd: 60,
  onEnter: { clearNegativeStages: true, lowerFoes: null, cureStatus: true, healFraction: 0.2 },
  sprite: { front: 'tenjin_front', back: 'tenjin_back' },
};
// mufflo (HP 55 / Atk 40 / Def 50 / Spd 45): max hp 125 at L50, so 62 is the last hp at or above half
content.withSpecies({ ...content.species('mufflo'), id: 'T:majin', name: 'Majinmon', battleForm: MAJIN });
content.withSpecies({ ...content.species('mufflo'), id: 'T:tenjin', name: 'Tenjinmon', battleForm: TENJIN });

const sure = (base: string, id: string, patch: Partial<MoveDef> = {}): MoveDef => customMove(base, id, { effectChance: 100, accuracy: null, ...patch });
const NOOP = sure('Growl', 'T:noop', { effect: null });
const TACKLE = sure('Tackle', 'T:tackle');
const MOVES = [TACKLE.id, NOOP.id];

const P = (extra: Partial<CreatureSpec> = {}): CreatureSpec => ({ species: 'bramblecub', level: 50, ability: 'Chlorophyll', moves: MOVES, ...extra });
const M = (extra: Partial<CreatureSpec> = {}): CreatureSpec => ({ species: 'T:majin', level: 50, ability: 'Natural Cure', moves: MOVES, ...extra });
const T = (extra: Partial<CreatureSpec> = {}): CreatureSpec => ({ species: 'T:tenjin', level: 50, ability: 'Natural Cure', moves: MOVES, ...extra });

interface Opts { readonly aBands?: readonly BandKind[]; readonly bBands?: readonly BandKind[]; readonly format?: 'trainer' | 'wild'; readonly seed?: string }
function start(a: CreatureSpec, b: CreatureSpec, o: Opts = {}): BattleState {
  const format = o.format ?? 'trainer';
  const s0 = makeSide({ party: [a] }, 'player', format, content);
  const s1 = makeSide({ party: [b] }, 'foe', format, content);
  return createBattle({
    id: 'transform', format, zoneId: 'mirevale', terrain: 'grove', seed: o.seed ?? 't',
    sides: [
      { ...s0, ...(o.aBands !== undefined ? { bands: o.aBands } : {}) },
      { ...s1, ...(o.bBands !== undefined ? { bands: o.bBands } : {}) },
    ],
  }, content).state;
}
const tmove = (id: string): Action => ({ kind: 'move', move: id, transform: true });

describe('Majin / Tenjin transformations', () => {
  it('Majin: below the line with the band, the battler transforms before any move and moves in its form', () => {
    const st = start(M({ hp: 60 }), P(), { aBands: ['majin'] });
    expect(validateAction(st, 0, tmove(TACKLE.id), content)).toBeNull();
    const r = resolveTurn(st, [tmove(TACKLE.id), move(NOOP.id)], content);
    const me = activeOf(r.state, 0);
    expect(me.form).toBe('majin');
    expect([me.atk, me.def, me.spd]).toEqual([calcStat(120, 50), calcStat(20, 50), calcStat(110, 50)]);
    expect(r.state.sides[0].transformed).toBe(true);
    const types = eventTypes(r.events);
    // turnStart → formChange (+ onEnter stages) → then the moves
    expect(types.indexOf('formChange')).toBeGreaterThan(types.indexOf('turnStart'));
    expect(types.indexOf('formChange')).toBeLessThan(types.indexOf('moveUsed'));
    expect(activeOf(r.state, 1).stages.atk).toBe(-1);
  });

  it('Majin: refused at or above the line, without the band, or with the other band', () => {
    expect(validateAction(start(M({ hp: 63 }), P(), { aBands: ['majin'] }), 0, tmove(TACKLE.id), content)).toBe('cannotTransform');
    expect(validateAction(start(M({ hp: 60 }), P()), 0, tmove(TACKLE.id), content)).toBe('cannotTransform');
    expect(validateAction(start(M({ hp: 60 }), P(), { aBands: ['tenjin'] }), 0, tmove(TACKLE.id), content)).toBe('cannotTransform');
    // a species without a Majin / Tenjin form can never transform
    expect(validateAction(start(P(), P(), { aBands: ['majin', 'tenjin'] }), 0, tmove(TACKLE.id), content)).toBe('cannotTransform');
  });

  it('Tenjin: at or above the line only; cures its status and heals a fifth of max hp', () => {
    expect(validateAction(start(T({ hp: 60 }), P(), { aBands: ['tenjin'] }), 0, tmove(TACKLE.id), content)).toBe('cannotTransform');
    const st = start(T({ hp: 80, status: ['burn'] }), P(), { aBands: ['tenjin'] });
    expect(validateAction(st, 0, tmove(TACKLE.id), content)).toBeNull();
    const r = resolveTurn(st, [tmove(NOOP.id), move(NOOP.id)], content);
    const me = activeOf(r.state, 0);
    expect(me.form).toBe('tenjin');
    expect(me.creature.status).toEqual([]);
    expect(eventsOf(r.events, 'statusCured')).toContainEqual(expect.objectContaining({ target: { side: 0, slot: 0 }, status: 'burn', cause: 'ability' }));
    const heal = eventsOf(r.events, 'heal').find((e) => e.cause === 'form')!;
    expect(heal.amount).toBe(Math.floor(125 / 5));
  });

  it('once per side per battle: a second transformation is refused', () => {
    const st = start(M({ hp: 60 }), P(), { aBands: ['majin', 'tenjin'] });
    const r = resolveTurn(st, [tmove(NOOP.id), move(NOOP.id)], content);
    expect(r.state.sides[0].transformed).toBe(true);
    expect(validateAction(r.state, 0, tmove(NOOP.id), content)).toBe('cannotTransform');
  });

  it('a trained Majin never changes on its own; a wild one still does; a Tenjin never does', () => {
    // trainer side, no transform action: below the line after the hit, but no formChange
    const trained = resolveTurn(start(M({ hp: 64 }), P(), { aBands: ['majin'] }), [move(NOOP.id), move(TACKLE.id)], content);
    expect(activeOf(trained.state, 0).creature.hp * 2).toBeLessThan(125);
    expect(eventsOf(trained.events, 'formChange')).toEqual([]);
    // the same species as a wild foe changes on its own after the hit
    const wild = resolveTurn(start(P(), M({ hp: 64 }), { format: 'wild' }), [move(TACKLE.id), null], content);
    expect(activeOf(wild.state, 1).form).toBe('majin');
    // a wild Tenjin species stays as it is
    const wildT = resolveTurn(start(P(), T({ hp: 64 }), { format: 'wild' }), [move(TACKLE.id), null], content);
    expect(activeOf(wildT.state, 1).form).toBeUndefined();
  });

  it('an NPC trainer holding the band transforms by itself as soon as it may', () => {
    const r = resolveTurn(start(P(), T({ hp: 100 }), { bBands: ['tenjin'] }), [move(NOOP.id), null], content);
    expect(activeOf(r.state, 1).form).toBe('tenjin');
    expect(r.state.sides[1].transformed).toBe(true);
    // without the band it never does
    const none = resolveTurn(start(P(), T({ hp: 100 })), [move(NOOP.id), null], content);
    expect(activeOf(none.state, 1).form).toBeUndefined();
  });

  it('sides without bands keep their exact state shape (no bands / transformed keys)', () => {
    const st = start(P(), P());
    const json = canonicalJson(st);
    expect(json).not.toContain('"bands"');
    expect(json).not.toContain('"transformed"');
    const r = resolveTurn(st, [move(TACKLE.id), move(NOOP.id)], content);
    expect(canonicalJson(r.state)).not.toContain('"transformed"');
  });
});

describe('bandborn (breeding: a Majin parent and a Tenjin parent)', () => {
  it('its form answers either band, each at its own hp line', () => {
    // a bandborn Majin species, healthy: the Tenjin Band opens it (at or above half), the Majin Band does not
    expect(validateAction(start(M({ hp: 80, bandborn: true }), P(), { aBands: ['tenjin'] }), 0, tmove(TACKLE.id), content)).toBeNull();
    expect(validateAction(start(M({ hp: 80, bandborn: true }), P(), { aBands: ['majin'] }), 0, tmove(TACKLE.id), content)).toBe('cannotTransform');
    // hurt: its own band still opens it, the other one does not
    expect(validateAction(start(M({ hp: 60, bandborn: true }), P(), { aBands: ['majin'] }), 0, tmove(TACKLE.id), content)).toBeNull();
    expect(validateAction(start(M({ hp: 60, bandborn: true }), P(), { aBands: ['tenjin'] }), 0, tmove(TACKLE.id), content)).toBe('cannotTransform');
    // a bandborn Tenjin species, hurt, with the Majin Band: it changes into its (Tenjin) form
    const st = start(T({ hp: 40, bandborn: true }), P(), { aBands: ['majin'] });
    expect(validateAction(st, 0, tmove(NOOP.id), content)).toBeNull();
    const r = resolveTurn(st, [tmove(NOOP.id), move(NOOP.id)], content);
    expect(activeOf(r.state, 0).form).toBe('tenjin');
    // with both bands its door is always open (one line or the other is met)
    expect(validateAction(start(T({ hp: 1, bandborn: true }), P(), { aBands: ['majin', 'tenjin'] }), 0, tmove(TACKLE.id), content)).toBeNull();
  });

  it('still once per battle, never without a band, never a species without a form', () => {
    expect(validateAction(start(M({ hp: 80, bandborn: true }), P()), 0, tmove(TACKLE.id), content)).toBe('cannotTransform');
    expect(validateAction(start(P({ bandborn: true }), P(), { aBands: ['majin', 'tenjin'] }), 0, tmove(TACKLE.id), content)).toBe('cannotTransform');
    const st = start(M({ hp: 80, bandborn: true }), P(), { aBands: ['tenjin'] });
    const r = resolveTurn(st, [tmove(NOOP.id), move(NOOP.id)], content);
    expect(r.state.sides[0].transformed).toBe(true);
    expect(validateAction(r.state, 0, tmove(TACKLE.id), content)).toBe('cannotTransform');
  });
});
