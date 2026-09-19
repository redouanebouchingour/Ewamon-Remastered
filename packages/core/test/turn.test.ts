/**
 * §2.9–§2.11 — createBattle, validateAction (every ActionError), and the resolution order of resolveTurn:
 * replacement phase · forfeit/flee · switches · items · catch · moves (priority > speed > rng tiebreak) ·
 * end of turn (weather → burn → poison → trap → berries → Speed Boost → weather countdown → faint → mustSwitch
 * → turn + 1) · battle end. The helper `turn()` teaches unknown custom moves; the `unknownMove` rule itself is
 * asserted through resolveTurn directly.
 */
import { describe, expect, it } from 'vitest';
import { InvalidActionError, createBattle, createRng, resolveTurn, validateAction } from '../src/index';
import type { Action, ActionError, BattleState, Battler, CreateBattleOpts, MoveDef, TurnResult } from '../src/index';
import { FLEE, FORFEIT, activeOf, catchWith, content, customMove, eventTypes, eventsOf, findSeed, item, makeSide, move, startBattle, sw, turn } from './helpers';
import type { CreatureSpec } from './helpers';

const sure = (base: string, id: string, patch: Partial<MoveDef> = {}): MoveDef => customMove(base, id, { effectChance: 100, accuracy: null, ...patch });
const NOOP = sure('Growl', 'T:noop', { effect: null });
const GROWL = sure('Growl', 'T:growl');
const TACKLE = sure('Tackle', 'T:tackle');
const QUICK = sure('Quick Attack', 'T:quick');
const SAND = sure('Sandstorm', 'T:sand');
const TRAP = sure('Fairy Lock', 'T:trap', { type: 'Normal' });
const BIG = sure('Vine Lash', 'T:big', { type: 'Normal', power: 250 });

// bramblecub (spd 108 at L50) outspeeds mufflo (105)
const A = (extra: Partial<CreatureSpec> = {}): CreatureSpec => ({ species: 'bramblecub', level: 50, ability: 'Chlorophyll', moves: [TACKLE.id, GROWL.id, NOOP.id, QUICK.id], ...extra });
const D = (extra: Partial<CreatureSpec> = {}): CreatureSpec => ({ species: 'mufflo', level: 50, ability: 'Natural Cure', moves: [TACKLE.id, GROWL.id, NOOP.id, BIG.id], ...extra });

function patchActive(state: BattleState, side: 0 | 1, fn: (b: Battler) => Battler): BattleState {
  const s = state.sides[side];
  const party = s.party.map((b, i) => (i === s.active ? fn(b) : b));
  const sides: BattleState['sides'] = side === 0 ? [{ ...s, party }, state.sides[1]] : [state.sides[0], { ...s, party }];
  return { ...state, sides };
}

function expectThrows(state: BattleState, actions: readonly [Action | null, Action | null], side: 0 | 1, code: ActionError): void {
  let caught: unknown = null;
  try {
    resolveTurn(state, actions, content);
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(InvalidActionError);
  const err = caught as InvalidActionError;
  expect(err.code).toBe(code);
  expect(err.side).toBe(side);
  expect(err.message).toContain(code);
}

describe('§2.9 createBattle', () => {
  it('places both leads (side 0 first), fires onSwitchIn hooks, starts at turn 0 with the seed rng and no weather', () => {
    const r = startBattle({ a: A({ ability: 'Intimidate' }), b: D(), seed: 77 });
    expect(eventTypes(r.events)).toEqual(['switchIn', 'switchIn', 'abilityTrigger', 'statStage']);
    expect(eventsOf(r.events, 'switchIn').map((e) => e.who)).toEqual([{ side: 0, slot: 0 }, { side: 1, slot: 0 }]);
    expect(r.state.turn).toBe(0);
    expect(r.state.ended).toBeNull();
    expect(r.state.rng).toEqual(createRng(77).snapshot()); // no draw is made while placing leads
    expect(r.state.field).toEqual({ weather: { kind: 'none', turns: 0 }, terrain: 'grove' });
    for (const s of r.state.sides) {
      expect(s.mustSwitch).toBe(false);
      expect(s.consumedItems).toEqual([]);
      expect(s.party[s.active]!.participated).toBe(true);
    }
    expect(r.state.sides[1].party[0]!.stages.atk).toBe(-1);
  });

  it('a bench member is not participated until it enters; a non-zero `active` lead is honoured', () => {
    const c = content;
    const opts: CreateBattleOpts = {
      id: 'lead-1',
      format: 'trainer',
      zoneId: 'mirevale',
      terrain: 'cinder',
      seed: 'lead',
      sides: [makeSide({ party: [A(), A()], active: 1 }, 'player', 'trainer', c), makeSide({ party: [D()] }, 'foe', 'trainer', c)],
    };
    const r = createBattle(opts, c);
    expect(r.state.sides[0].active).toBe(1);
    expect(r.state.sides[0].party[0]!.participated).toBe(false);
    expect(r.state.sides[0].party[1]!.participated).toBe(true);
    expect(eventsOf(r.events, 'switchIn')[0]).toEqual({ t: 'switchIn', who: { side: 0, slot: 1 } });
  });
});

describe('§2.10 validateAction — every ActionError is produced, and resolveTurn throws it', () => {
  const st = startBattle({ a: [A(), A()], b: [D(), D()] }).state;
  const wild = startBattle({ a: A(), b: D(), format: 'wild' }).state;

  it('battleEnded', () => {
    const ended = turn(st, FORFEIT, move(NOOP.id)).state;
    expect(ended.ended).toEqual({ winner: 1 });
    expect(validateAction(ended, 0, move(TACKLE.id), content)).toBe('battleEnded');
    expect(validateAction(ended, 1, null, content)).toBe('battleEnded');
    expectThrows(ended, [move(TACKLE.id), null], 0, 'battleEnded');
  });

  it('unknownMove (not in the moveset, or unknown to content)', () => {
    expect(validateAction(st, 0, move('Vine Lash'), content)).toBe('unknownMove'); // real move, not known by this creature
    expect(validateAction(st, 0, move('No Such Move'), content)).toBe('unknownMove');
    expectThrows(st, [move('Vine Lash'), null], 0, 'unknownMove');
    // a move in the moveset whose id content cannot resolve is unknownMove too
    const ghost = patchActive(st, 0, (b) => ({ ...b, creature: { ...b.creature, moves: [{ id: 'Ghost Move', pp: 5, ppMax: 5 }] } }));
    expect(validateAction(ghost, 0, move('Ghost Move'), content)).toBe('unknownMove');
    expect(validateAction(ghost, 0, move('Ghost Move'))).toBeNull(); // without content only the structural check runs
  });

  it('noPp', () => {
    const empty = patchActive(st, 0, (b) => ({ ...b, creature: { ...b.creature, moves: b.creature.moves.map((m) => ({ ...m, pp: 0 })) } }));
    expect(validateAction(empty, 0, move(TACKLE.id), content)).toBe('noPp');
    expectThrows(empty, [move(TACKLE.id), null], 0, 'noPp');
  });

  it('choiceLocked', () => {
    const band = turn(startBattle({ a: A({ heldItem: 'Choice Band' }), b: D() }).state, move(TACKLE.id), move(NOOP.id)).state;
    expect(validateAction(band, 0, move(GROWL.id), content)).toBe('choiceLocked');
    expect(validateAction(band, 0, move(TACKLE.id), content)).toBeNull();
    expectThrows(band, [move(GROWL.id), null], 0, 'choiceLocked');
  });

  it('statusMoveBlocked (Assault Vest, needs content)', () => {
    const vest = startBattle({ a: A({ heldItem: 'Assault Vest' }), b: D() }).state;
    expect(validateAction(vest, 0, move(GROWL.id), content)).toBe('statusMoveBlocked');
    expect(validateAction(vest, 0, move(TACKLE.id), content)).toBeNull();
    expect(validateAction(vest, 0, move(GROWL.id))).toBeNull();
    expectThrows(vest, [move(GROWL.id), null], 0, 'statusMoveBlocked');
  });

  it('badSwitchIndex / switchToActive / switchToFainted / trapped', () => {
    expect(validateAction(st, 0, sw(2), content)).toBe('badSwitchIndex');
    expect(validateAction(st, 0, sw(-1), content)).toBe('badSwitchIndex');
    expect(validateAction(st, 0, sw(0.5), content)).toBe('badSwitchIndex');
    expect(validateAction(st, 0, sw(0), content)).toBe('switchToActive');
    const koBench = { ...st, sides: [{ ...st.sides[0], party: st.sides[0].party.map((b, i) => (i === 1 ? { ...b, creature: { ...b.creature, hp: 0 } } : b)) }, st.sides[1]] as const };
    expect(validateAction(koBench, 0, sw(1), content)).toBe('switchToFainted');
    const trapped = turn(st, move(NOOP.id), move(sure('Fairy Lock', 'T:trap0', { type: 'Normal' }).id)).state;
    expect(validateAction(trapped, 0, sw(1), content)).toBe('trapped');
    expectThrows(st, [sw(2), null], 0, 'badSwitchIndex');
    expectThrows(st, [sw(0), null], 0, 'switchToActive');
    expectThrows(koBench, [sw(1), null], 0, 'switchToFainted');
    expectThrows(trapped, [sw(1), null], 0, 'trapped');
  });

  it('unknownItem / itemNotUsableInBattle / badItemTarget', () => {
    expect(validateAction(st, 0, item('elixir_of_life'), content)).toBe('unknownItem');
    expect(validateAction(st, 0, item('rarecandy'), content)).toBe('itemNotUsableInBattle');
    expect(validateAction(st, 0, item('Choice Band'), content)).toBe('itemNotUsableInBattle');
    expect(validateAction(st, 0, item('escape_rope'), content)).toBe('itemNotUsableInBattle'); // trainer battle: no fleeing
    expect(validateAction(wild, 0, item('escape_rope'), content)).toBeNull();
    expect(validateAction(st, 0, item('revive'), content)).toBe('badItemTarget'); // active is standing
    expect(validateAction(st, 0, item('potion', 5), content)).toBe('badItemTarget');
    const koBench = { ...st, sides: [{ ...st.sides[0], party: st.sides[0].party.map((b, i) => (i === 1 ? { ...b, creature: { ...b.creature, hp: 0 } } : b)) }, st.sides[1]] as const };
    expect(validateAction(koBench, 0, item('potion', 1), content)).toBe('badItemTarget'); // only revives touch the fainted
    expect(validateAction(koBench, 0, item('revive', 1), content)).toBeNull();
    expect(validateAction(st, 0, item('anything'))).toBeNull(); // item checks need content
    expectThrows(st, [item('elixir_of_life'), null], 0, 'unknownItem');
    expectThrows(st, [item('rarecandy'), null], 0, 'itemNotUsableInBattle');
    expectThrows(st, [item('revive'), null], 0, 'badItemTarget');
  });

  it('cannotCatch / unknownOrb / cannotFlee / cannotForfeit', () => {
    expect(validateAction(st, 0, catchWith('spark_orb'), content)).toBe('cannotCatch'); // trainer battle
    expect(validateAction(wild, 1, catchWith('spark_orb'), content)).toBe('cannotCatch'); // never the wild side
    expect(validateAction(wild, 0, catchWith('great_ball'), content)).toBe('unknownOrb');
    expect(validateAction(wild, 0, catchWith('spark_orb'), content)).toBeNull();
    expect(validateAction(st, 0, FLEE, content)).toBe('cannotFlee');
    expect(validateAction(wild, 1, FLEE, content)).toBe('cannotFlee');
    expect(validateAction(wild, 0, FLEE, content)).toBeNull();
    expect(validateAction(wild, 0, FORFEIT, content)).toBe('cannotForfeit'); // a side that may flee leaves by fleeing
    expect(validateAction(st, 0, FORFEIT, content)).toBeNull();
    expect(validateAction(wild, 1, FORFEIT, content)).toBeNull(); // the wild side may give up (termination guarantee)
    expectThrows(st, [catchWith('spark_orb'), null], 0, 'cannotCatch');
    expectThrows(wild, [catchWith('great_ball'), null], 0, 'unknownOrb');
    expectThrows(st, [FLEE, null], 0, 'cannotFlee');
    expectThrows(wild, [FORFEIT, null], 0, 'cannotForfeit');
  });

  it('mustSwitch / actionNotRequired: null is accepted only in the replacement-phase exception; pvp never gets a null', () => {
    // KO the player lead: mufflo (slower) hits a 1-hp bramblecub after it passes
    const ko = turn(startBattle({ a: [A({ hp: 1 }), A()], b: [D(), D()] }).state, move(NOOP.id), move(TACKLE.id)).state;
    expect(ko.sides[0].mustSwitch).toBe(true);
    expect(validateAction(ko, 0, move(TACKLE.id), content)).toBe('mustSwitch');
    expect(validateAction(ko, 0, null, content)).toBe('mustSwitch');
    expect(validateAction(ko, 0, sw(1), content)).toBeNull();
    expect(validateAction(ko, 0, sw(0), content)).toBe('switchToActive');
    expect(validateAction(ko, 1, move(TACKLE.id), content)).toBe('actionNotRequired');
    expect(validateAction(ko, 1, null, content)).toBeNull();
    expectThrows(ko, [move(TACKLE.id), null], 0, 'mustSwitch');
    expectThrows(ko, [sw(1), move(TACKLE.id)], 1, 'actionNotRequired');
    // outside a replacement phase a player side may not pass null
    expect(validateAction(st, 0, null, content)).toBe('actionNotRequired');
    expectThrows(st, [null, null], 0, 'actionNotRequired');
    const pvp = startBattle({ a: A(), b: D(), format: 'pvp' }).state;
    expect(pvp.sides[1].kind).toBe('player');
    expect(validateAction(pvp, 1, null, content)).toBe('actionNotRequired');
    expectThrows(pvp, [move(TACKLE.id), null], 1, 'actionNotRequired');
    // a wild/NPC side passes null in every phase (core chooses), including when it is the one that must switch
    expect(validateAction(st, 1, null, content)).toBeNull();
    const npcKo = turn(startBattle({ a: A(), b: [D({ hp: 1 }), D()] }).state, move(TACKLE.id), move(NOOP.id)).state;
    expect(npcKo.sides[1].mustSwitch).toBe(true);
    expect(validateAction(npcKo, 1, null, content)).toBeNull();
    expect(validateAction(npcKo, 0, null, content)).toBeNull();
    expect(validateAction(npcKo, 0, move(TACKLE.id), content)).toBe('actionNotRequired');
  });

  it('all 18 ActionError values were exercised above', () => {
    const all: ActionError[] = [
      'battleEnded', 'unknownMove', 'noPp', 'choiceLocked', 'statusMoveBlocked', 'badSwitchIndex', 'switchToFainted',
      'switchToActive', 'trapped', 'unknownItem', 'itemNotUsableInBattle', 'badItemTarget', 'cannotCatch', 'unknownOrb',
      'cannotFlee', 'cannotForfeit', 'mustSwitch', 'actionNotRequired',
    ];
    expect(new Set(all).size).toBe(18);
  });
});

describe('§2.11 step 1 — replacement phase', () => {
  it('faint → switchRequired → replacement turn: only the fainted side acts, hooks fire, the turn counter does not advance', () => {
    const ko = turn(startBattle({ a: A(), b: [D({ hp: 1 }), D({ ability: 'Intimidate' })] }).state, move(TACKLE.id), move(NOOP.id));
    const types = eventTypes(ko.events);
    expect(types.indexOf('faint')).toBeGreaterThan(types.indexOf('damage'));
    expect(eventsOf(ko.events, 'faint')).toEqual([{ t: 'faint', who: { side: 1, slot: 0 } }]);
    expect(eventsOf(ko.events, 'switchRequired')).toEqual([{ t: 'switchRequired', side: 1 }]);
    expect(types[types.length - 1]).toBe('turnEnd');
    expect(ko.state.turn).toBe(1);
    expect(ko.state.sides[1].mustSwitch).toBe(true);
    expect(ko.state.ended).toBeNull();
    // the fainted foe's move was skipped this turn (it fainted before acting: no second moveUsed)
    expect(eventsOf(ko.events, 'moveUsed').map((e) => e.who.side)).toEqual([0]);
    // replacement: npc chooses; player passes null
    const rep = turn(ko.state, null, null);
    expect(eventTypes(rep.events)).toEqual(['switchOut', 'switchIn', 'abilityTrigger', 'statStage']);
    expect(eventsOf(rep.events, 'switchOut')[0]).toEqual({ t: 'switchOut', who: { side: 1, slot: 0 }, reason: 'faint' });
    expect(eventsOf(rep.events, 'switchIn')[0]).toEqual({ t: 'switchIn', who: { side: 1, slot: 1 } });
    expect(eventsOf(rep.events, 'statStage')[0]).toMatchObject({ target: { side: 0, slot: 0 }, stat: 'atk', delta: -1, cause: 'ability' });
    expect(rep.state.turn).toBe(1);
    expect(rep.state.sides[1].active).toBe(1);
    expect(rep.state.sides[1].mustSwitch).toBe(false);
    expect(rep.state.sides[1].party[1]!.participated).toBe(true);
    // the battle continues normally
    const next = turn(rep.state, move(TACKLE.id), move(NOOP.id));
    expect(next.state.turn).toBe(2);
    expect(eventsOf(next.events, 'turnStart')[0]).toEqual({ t: 'turnStart', turn: 2 });
  });

  it('a player-side replacement needs an explicit switch; both leads down → both switch in the same replacement turn', () => {
    // both at 1 hp, both burned, both benched: the burn chips KO both at end of turn
    const both = turn(startBattle({ a: [A({ hp: 1, status: ['burn'] }), A()], b: [D({ hp: 1, status: ['burn'] }), D()] }).state, move(NOOP.id), move(NOOP.id));
    expect(both.state.sides[0].mustSwitch).toBe(true);
    expect(both.state.sides[1].mustSwitch).toBe(true);
    expect(eventsOf(both.events, 'switchRequired').map((e) => e.side)).toEqual([0, 1]);
    expect(both.state.ended).toBeNull();
    expectThrows(both.state, [null, null], 0, 'mustSwitch');
    const rep = turn(both.state, sw(1), null);
    expect(eventTypes(rep.events)).toEqual(['switchOut', 'switchOut', 'switchIn', 'switchIn']);
    expect(eventsOf(rep.events, 'switchIn').map((e) => e.who)).toEqual([{ side: 0, slot: 1 }, { side: 1, slot: 1 }]);
    expect(rep.state.turn).toBe(both.state.turn);
    expect(rep.state.sides.map((s) => s.mustSwitch)).toEqual([false, false]);
  });

  it('a switched-out battler loses its stages and volatile state; the foe’s trap on it is cleared', () => {
    const st = startBattle({ a: [A(), A()], b: D() }).state;
    const s1 = turn(st, move(NOOP.id), move(GROWL.id)).state; // bramblecub atk -1
    const s2 = turn(s1, move(NOOP.id), move(TRAP.id)).state; // and trapped
    expect(activeOf(s2, 0).stages.atk).toBe(-1);
    expect(activeOf(s2, 0).volatile.trappedTurns).toBeGreaterThan(0);
    expect(validateAction(s2, 0, sw(1), content)).toBe('trapped');
    // wait the trap out, then switch: everything battle-local on the leaving battler resets
    let st3 = s2;
    for (let i = 0; i < 6 && activeOf(st3, 0).volatile.trappedTurns > 0; i++) st3 = turn(st3, move(NOOP.id), move(NOOP.id)).state;
    expect(activeOf(st3, 0).volatile.trappedTurns).toBe(0);
    const out = turn(st3, sw(1), move(NOOP.id)).state;
    expect(out.sides[0].party[0]!.stages).toEqual({ atk: 0, def: 0, spd: 0, acc: 0, eva: 0 });
    expect(out.sides[0].party[0]!.volatile.trappedTurns).toBe(0);
    expect(out.sides[0].party[0]!.volatile.lastMove).toBeNull();
  });
});

describe('§2.11 step 2 — forfeit and flee', () => {
  it('forfeit ends the battle immediately: no moves, no end of turn; the other side wins', () => {
    const r = turn(startBattle({ a: A(), b: D() }).state, FORFEIT, move(TACKLE.id));
    expect(eventTypes(r.events)).toEqual(['turnStart', 'forfeit', 'battleEnd']);
    expect(r.events[1]).toEqual({ t: 'forfeit', side: 0 });
    expect(r.events[2]).toEqual({ t: 'battleEnd', outcome: { winner: 1 }, turns: 1 });
    expect(r.state.ended).toEqual({ winner: 1 });
    expect(r.state.turn).toBe(1);
    const pvp = turn(startBattle({ a: A(), b: D(), format: 'pvp' }).state, move(TACKLE.id), FORFEIT);
    expect(pvp.state.ended).toEqual({ winner: 0 });
    expect(eventsOf(pvp.events, 'moveUsed').length).toBe(0);
  });

  it('flee (wild, side 0): ended fled; while trapped it fails with moveFailed { trapped } and the wild side still acts', () => {
    const r = turn(startBattle({ a: A(), b: D(), format: 'wild' }).state, FLEE, null);
    expect(eventTypes(r.events)).toEqual(['turnStart', 'fled', 'battleEnd']);
    expect(r.state.ended).toEqual({ winner: 'fled' });
    expect(r.state.turn).toBe(1);
    const trapped = turn(startBattle({ a: A(), b: D({ moves: [TRAP.id] }), format: 'wild' }).state, move(NOOP.id), null).state;
    expect(activeOf(trapped, 0).volatile.trappedTurns).toBeGreaterThan(0);
    const tryFlee = turn(trapped, FLEE, move(TACKLE.id));
    expect(eventsOf(tryFlee.events, 'moveFailed')).toEqual([{ t: 'moveFailed', who: { side: 0, slot: 0 }, move: null, reason: 'trapped' }]);
    expect(eventsOf(tryFlee.events, 'fled').length).toBe(0);
    expect(eventsOf(tryFlee.events, 'moveUsed').map((e) => e.who.side)).toEqual([1]);
    expect(tryFlee.state.ended).toBeNull();
    expect(tryFlee.state.turn).toBe(2);
  });

  it('escape_rope is a flee by item: itemUsed then fled, only where fleeing is allowed', () => {
    const r = turn(startBattle({ a: A(), b: D(), format: 'wild' }).state, item('escape_rope'), null);
    expect(eventTypes(r.events)).toEqual(['turnStart', 'itemUsed', 'fled', 'battleEnd']);
    expect(r.state.ended).toEqual({ winner: 'fled' });
    expect(r.state.sides[0].consumedItems).toEqual(['escape_rope']);
  });
});

describe('§2.11 steps 3–6 — ordering', () => {
  it('switches resolve before items, items before catch, catch before moves', () => {
    // switch (side 1, pvp) before item (side 0)
    const pvp = startBattle({ a: [A(), A()], b: [D(), D()], format: 'pvp' }).state;
    const si = turn(pvp, item('potion'), sw(1));
    const t1 = eventTypes(si.events);
    expect(t1.indexOf('switchIn')).toBeLessThan(t1.indexOf('itemUsed'));
    // item before moves
    const im = turn(startBattle({ a: A({ hp: 10 }), b: D() }).state, item('potion'), move(TACKLE.id));
    const t2 = eventTypes(im.events);
    expect(t2.indexOf('itemUsed')).toBeLessThan(t2.indexOf('moveUsed'));
    // switch before the foe's move even though the foe is faster
    const slowSwitch = turn(startBattle({ a: [D(), D()], b: A() }).state, sw(1), move(QUICK.id));
    const t3 = eventTypes(slowSwitch.events);
    expect(t3.indexOf('switchIn')).toBeLessThan(t3.indexOf('moveUsed'));
    // a failed catch resolves before the wild side's move, which still happens; the orb is spent
    const wild = startBattle({ a: A(), b: D({ moves: [TACKLE.id] }), format: 'wild' }).state;
    const failed = findSeed((seed) => {
      const r = turn({ ...wild, rng: createRng(seed).snapshot() }, catchWith('spark_orb'), null);
      return eventsOf(r.events, 'catchResult')[0]!.caught ? null : r;
    });
    const t4 = eventTypes(failed.events);
    expect(t4.indexOf('catchThrow')).toBeLessThan(t4.indexOf('moveUsed'));
    expect(eventsOf(failed.events, 'moveUsed').map((e) => e.who.side)).toEqual([1]);
    expect(failed.state.ended).toBeNull();
    expect(failed.state.sides[0].consumedItems).toEqual(['spark_orb']);
    expect(eventsOf(failed.events, 'catchShake').length).toBe(Math.min(3, eventsOf(failed.events, 'catchResult')[0]!.shakes));
  });

  it('two switchers / two item users are ordered by effective speed, rng tiebreak on equal speed', () => {
    const pvp = startBattle({ a: [D(), D()], b: [A(), A()], format: 'pvp' }).state; // side 1 (bramblecub) is faster
    const both = turn(pvp, sw(1), sw(1));
    expect(eventsOf(both.events, 'switchOut').map((e) => e.who.side)).toEqual([1, 0]);
    const items = turn(startBattle({ a: D({ hp: 5 }), b: A({ hp: 5 }), format: 'pvp' }).state, item('potion'), item('potion'));
    expect(eventsOf(items.events, 'itemUsed').map((e) => e.who.side)).toEqual([1, 0]);
    // equal speed: both orders occur across seeds, deterministic per seed
    const mirror = (seed: number) => turn(startBattle({ a: [A(), A()], b: [A(), A()], format: 'pvp', seed }).state, sw(1), sw(1));
    const firsts = new Set<number>();
    for (let seed = 0; seed < 30; seed++) {
      firsts.add(eventsOf(mirror(seed).events, 'switchOut')[0]!.who.side);
      expect(eventTypes(mirror(seed).events)).toEqual(eventTypes(mirror(seed).events));
    }
    expect([...firsts].sort()).toEqual([0, 1]);
  });

  it('moves: priority desc, then effective speed desc, then rng.int(2)', () => {
    // priority beats speed: slower mufflo with Quick Attack goes first
    const pr = turn(startBattle({ a: A(), b: D({ moves: [QUICK.id] }) }).state, move(TACKLE.id), move(QUICK.id));
    expect(eventsOf(pr.events, 'moveUsed').map((e) => e.who.side)).toEqual([1, 0]);
    // equal priority: faster first
    const sp = turn(startBattle({ a: A(), b: D() }).state, move(TACKLE.id), move(TACKLE.id));
    expect(eventsOf(sp.events, 'moveUsed').map((e) => e.who.side)).toEqual([0, 1]);
    // stages and paralysis feed effective speed: a -1 spd bramblecub (72) is slower than mufflo (105)
    const slowed = patchActive(startBattle({ a: A(), b: D() }).state, 0, (b) => ({ ...b, stages: { ...b.stages, spd: -1 } }));
    expect(eventsOf(turn(slowed, move(TACKLE.id), move(TACKLE.id)).events, 'moveUsed').map((e) => e.who.side)).toEqual([1, 0]);
    const para = turn(startBattle({ a: A({ status: ['paralyze'] }), b: D() }).state, move(NOOP.id), move(NOOP.id));
    expect(eventsOf(para.events, 'moveUsed').map((e) => e.who.side)).toEqual([1, 0]);
    // full tie: exactly one rng draw decides; both orders appear across seeds and each seed is reproducible
    const tie = (seed: number) => turn(startBattle({ a: A(), b: A(), format: 'pvp', seed }).state, move(NOOP.id), move(NOOP.id));
    const firsts = new Set<number>();
    for (let seed = 0; seed < 40; seed++) {
      const r = tie(seed);
      firsts.add(eventsOf(r.events, 'moveUsed')[0]!.who.side);
      expect(eventsOf(tie(seed).events, 'moveUsed').map((e) => e.who.side)).toEqual(eventsOf(r.events, 'moveUsed').map((e) => e.who.side));
    }
    expect([...firsts].sort()).toEqual([0, 1]);
  });

  it('an actor that fainted before its turn is skipped; a move against a fainted target still resolves as moveFailed { noTarget }', () => {
    // the faster bramblecub (side 1) KOs mufflo, whose own move is then skipped: one moveUsed
    const r = turn(startBattle({ a: [D({ hp: 1 }), D()], b: A() }).state, move(TACKLE.id), move(TACKLE.id));
    expect(eventsOf(r.events, 'moveUsed').map((e) => e.who.side)).toEqual([1]);
    expect(r.state.sides[0].mustSwitch).toBe(true);
    // priority version: mufflo's Quick Attack KOs a 1-hp bramblecub before the latter's Tackle
    const r2 = turn(startBattle({ a: A({ hp: 1 }), b: D({ moves: [QUICK.id] }) }).state, move(TACKLE.id), move(QUICK.id));
    expect(eventsOf(r2.events, 'moveUsed').map((e) => e.who.side)).toEqual([1]);
    // noTarget: a constructed state whose foe is already at 0 hp (no replacement pending) — PP is spent, no damage
    const dead = patchActive(startBattle({ a: A(), b: D() }).state, 1, (b) => ({ ...b, creature: { ...b.creature, hp: 0 } }));
    const r3 = resolveTurn(dead, [move(TACKLE.id), null], content);
    expect(eventsOf(r3.events, 'moveFailed')[0]).toEqual({ t: 'moveFailed', who: { side: 0, slot: 0 }, move: TACKLE.id, reason: 'noTarget' });
    expect(eventsOf(r3.events, 'moveUsed')[0]!.ppLeft).toBe(TACKLE.pp - 1);
    expect(eventsOf(r3.events, 'damage').length).toBe(0);
    expect(r3.state.ended).toEqual({ winner: 0 });
  });
});

describe('§2.11 step 7 — end of turn order', () => {
  it('weather → burn → poison → trap → berries → Speed Boost → weather countdown → faint → mustSwitch → turn+1 → turnEnd', () => {
    const a = A({ ability: 'Speed Boost', status: ['burn'], heldItem: 'Sitrus Berry', hp: 60 }); // maxHp 134 → 44 %
    const st0 = startBattle({ a, b: D({ status: ['poison'] }) }).state;
    const st = patchActive(st0, 0, (b) => ({ ...b, volatile: { ...b.volatile, trappedTurns: 3 } }));
    const r = turn(st, move(SAND.id), move(NOOP.id));
    const lastMove = eventTypes(r.events).lastIndexOf('moveUsed');
    const tail = r.events.slice(lastMove + 1);
    const causes = eventsOf(tail, 'damage').map((e) => `${e.cause}:${e.target.side}`);
    expect(causes).toEqual(['sand:0', 'sand:1', 'burn:0', 'poison:1', 'trap:0']);
    expect(eventTypes(tail)).toEqual([
      'damage', 'damage', 'damage', 'damage', 'damage', // sand ×2, burn, poison, trap
      'heldItemTrigger', 'heal', // Sitrus Berry (below 50 %)
      'abilityTrigger', 'statStage', // Speed Boost
      'weatherTick',
      'turnEnd',
    ]);
    const me = activeOf(r.state, 0);
    const chipSand = Math.floor(me.maxHp / 16);
    const chipBurn = Math.floor(me.maxHp / 16);
    const chipTrap = Math.floor(me.maxHp / 8);
    const berry = Math.floor(me.maxHp / 4);
    expect(me.creature.hp).toBe(60 - chipSand - chipBurn - chipTrap + berry);
    expect(eventsOf(tail, 'heal')[0]).toMatchObject({ cause: 'berry', item: 'Sitrus Berry', amount: berry });
    expect(me.creature.heldItem).toBeNull();
    expect(me.volatile.berryConsumed).toBe(true);
    expect(me.volatile.trappedTurns).toBe(2);
    expect(me.stages.spd).toBe(1);
    expect(eventsOf(tail, 'weatherTick')[0]).toEqual({ t: 'weatherTick', kind: 'sand', turnsLeft: 4 });
    expect(eventsOf(tail, 'turnEnd')[0]).toEqual({ t: 'turnEnd', turn: 1 });
    expect(r.state.turn).toBe(1);
    const foe = activeOf(r.state, 1);
    expect(foe.creature.hp).toBe(foe.maxHp - Math.floor(foe.maxHp / 16) - Math.floor(foe.maxHp / 8));
  });

  it('a battler KO’d by the burn chip takes no trap tick, eats no berry, and faints before mustSwitch', () => {
    const st0 = startBattle({ a: [A({ status: ['burn'], heldItem: 'Sitrus Berry', hp: 1 }), A()], b: D() }).state;
    const st = patchActive(st0, 0, (b) => ({ ...b, volatile: { ...b.volatile, trappedTurns: 3 } }));
    const r = turn(st, move(NOOP.id), move(NOOP.id));
    const lastMove = eventTypes(r.events).lastIndexOf('moveUsed');
    const tail = r.events.slice(lastMove + 1);
    expect(eventTypes(tail)).toEqual(['damage', 'faint', 'switchRequired', 'turnEnd']);
    expect(eventsOf(tail, 'damage')[0]).toMatchObject({ cause: 'burn', target: { side: 0, slot: 0 }, hpAfter: 0 });
    expect(eventsOf(tail, 'heldItemTrigger').length).toBe(0);
    expect(activeOf(r.state, 0).creature.heldItem).toBe('Sitrus Berry');
    expect(r.state.sides[0].mustSwitch).toBe(true);
    expect(r.state.ended).toBeNull();
  });

  it('weather lasts 5 end-of-turns (the setting turn counts) then weatherEnd; sand spares Rock/Ground/Steel, hail spares Ice', () => {
    let st = startBattle({ a: A(), b: D() }).state;
    const first = turn(st, move(SAND.id), move(NOOP.id));
    expect(first.state.field.weather).toEqual({ kind: 'sand', turns: 4 });
    st = first.state;
    for (let left = 3; left >= 1; left--) {
      const t = turn(st, move(NOOP.id), move(NOOP.id));
      expect(t.state.field.weather.turns).toBe(left);
      st = t.state;
    }
    const last = turn(st, move(NOOP.id), move(NOOP.id));
    expect(eventsOf(last.events, 'weatherEnd')).toEqual([{ t: 'weatherEnd', kind: 'sand' }]);
    expect(last.state.field.weather).toEqual({ kind: 'none', turns: 0 });
    expect(eventsOf(last.events, 'damage').filter((e) => e.cause === 'sand').length).toBe(2); // the last tick still chips
    const rock = turn(startBattle({ a: A(), b: { species: 'pebblit', level: 50, ability: 'Regenerator' } }).state, move(SAND.id), move(NOOP.id));
    expect(eventsOf(rock.events, 'damage').map((e) => e.target.side)).toEqual([0]);
  });
});

describe('§2.11 step 8 — battle end', () => {
  it('a side with no standing battler loses; both down in the same turn is a draw; no switchRequired is emitted at the end', () => {
    const win = turn(startBattle({ a: A(), b: D({ hp: 1 }) }).state, move(TACKLE.id), move(NOOP.id));
    expect(win.state.ended).toEqual({ winner: 0 });
    expect(eventsOf(win.events, 'battleEnd')).toEqual([{ t: 'battleEnd', outcome: { winner: 0 }, turns: 1 }]);
    expect(eventsOf(win.events, 'switchRequired').length).toBe(0);
    expect(eventTypes(win.events).slice(-2)).toEqual(['turnEnd', 'battleEnd']);
    const lose = turn(startBattle({ a: A({ hp: 1 }), b: D() }).state, move(NOOP.id), move(TACKLE.id));
    expect(lose.state.ended).toEqual({ winner: 1 });
    const draw = turn(startBattle({ a: A({ hp: 1, status: ['burn'] }), b: D({ hp: 1, status: ['burn'] }) }).state, move(NOOP.id), move(NOOP.id));
    expect(draw.state.ended).toEqual({ winner: 'draw' });
    expect(eventsOf(draw.events, 'faint').map((e) => e.who.side)).toEqual([0, 1]);
    expect(eventsOf(draw.events, 'switchRequired').length).toBe(0);
    expect(draw.state.sides.map((s) => s.mustSwitch)).toEqual([false, false]);
    expect(() => turn(draw.state, move(NOOP.id), move(NOOP.id))).toThrow(InvalidActionError);
  });

  it('a successful catch ends the battle at step 5: three shakes, catchResult, battleEnd { caught, slot }; no moves, no end of turn', () => {
    const r = turn(startBattle({ a: A(), b: D(), format: 'wild' }).state, catchWith('aether_orb'), null);
    expect(eventTypes(r.events)).toEqual(['turnStart', 'catchThrow', 'catchShake', 'catchShake', 'catchShake', 'catchResult', 'battleEnd']);
    expect(eventsOf(r.events, 'catchShake').map((e) => e.n)).toEqual([1, 2, 3]);
    expect(eventsOf(r.events, 'catchResult')[0]).toEqual({ t: 'catchResult', caught: true, target: { side: 1, slot: 0 }, shakes: 4 });
    expect(r.state.ended).toEqual({ winner: 'caught', slot: 0 });
    expect(r.state.turn).toBe(1);
    expect(r.state.sides[0].consumedItems).toEqual(['aether_orb']);
    expect(eventsOf(r.events, 'turnEnd').length).toBe(0);
    // aether_orb consumes no rng: the only draw this turn is the wild side's move pick (§2.10: the NPC choice is part
    // of the deterministic stream), made before the catch resolved — exactly one draw separates the two snapshots
    const pre = createRng(startBattle({ a: A(), b: D(), format: 'wild' }).state.rng);
    pre.next();
    expect(r.state.rng).toEqual(pre.snapshot());
  });

  it('exp is awarded to participating standing player battlers at the moment of the faint, before end of turn', () => {
    const r: TurnResult = turn(startBattle({ a: [A({ level: 5 }), A({ level: 6 })], b: D({ hp: 1, level: 60 }) }).state, move(TACKLE.id), move(NOOP.id));
    const types = eventTypes(r.events);
    expect(types.indexOf('expGain')).toBeGreaterThan(types.indexOf('faint'));
    expect(types.indexOf('expGain')).toBeLessThan(types.indexOf('turnEnd'));
    expect(eventsOf(r.events, 'expGain').map((e) => e.who)).toEqual([{ side: 0, slot: 0 }]); // the bench never entered
    expect(eventsOf(r.events, 'levelUp').length).toBeGreaterThan(0);
    expect(r.state.sides[0].party[0]!.creature.level).toBeGreaterThan(5);
  });
});
