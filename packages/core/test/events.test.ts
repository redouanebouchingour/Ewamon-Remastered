/**
 * §2.19 BattleEvent — the animation contract. Every event names a valid side/slot, is JSON-serialisable with no
 * `undefined` (optional-looking fields are null), every `damage` carries hpAfter/maxHp/effectiveness/crit/stab/cause,
 * hpAfter agrees with the resulting state, and each of the 37 members of the union is produced by at least one
 * scripted scenario in this file.
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../src/index';
import type { BattleEvent, BattleFormDef, BattleState, MoveDef, Ref, TurnResult } from '../src/index';
import { FLEE, FORFEIT, catchWith, content, customMove, eventTypes, eventsOf, findSeed, item, move, startBattle, sw, turn } from './helpers';
import type { CreatureSpec } from './helpers';

/** The 37 `t` values of §2.19, in spec order (`formChange`: a battle form, added with hollowmane; `honor`: dustcub's ledger). */
const EVENT_TYPES: readonly BattleEvent['t'][] = [
  'turnStart', 'switchOut', 'switchIn', 'abilityTrigger', 'moveUsed', 'moveMissed', 'moveFailed', 'damage', 'heal',
  'statusApplied', 'statusBlocked', 'statusTick', 'statusCured', 'flinch', 'formChange', 'statStage', 'weatherSet', 'weatherTick',
  'weatherEnd', 'trapped', 'trapEnd', 'itemUsed', 'heldItemTrigger', 'faint', 'switchRequired', 'catchThrow',
  'catchShake', 'catchResult', 'fled', 'forfeit', 'expGain', 'levelUp', 'learnMove', 'evolveReady', 'honor', 'turnEnd', 'battleEnd',
];

const sure = (base: string, id: string, patch: Partial<MoveDef> = {}): MoveDef => customMove(base, id, { effectChance: 100, accuracy: null, ...patch });
const NOOP = sure('Growl', 'V:noop', { effect: null });
const GROWL = sure('Growl', 'V:growl');
const TACKLE = sure('Tackle', 'V:tackle');
const FLINCH = sure('Tackle', 'V:flinch', { effect: 'flinch' });
const SLEEP = sure('Hypno Fog', 'V:sleep');
const BURN = sure('Will-O-Wisp', 'V:burn');
const SAND = sure('Sandstorm', 'V:sand');
const TRAP = sure('Fairy Lock', 'V:trap', { type: 'Normal' });
const SYNTH = sure('Synthesis', 'V:heal');
const SHAKY = sure('Growl', 'V:shaky', { accuracy: 30 });
const FIGHTING = sure('Vine Lash', 'V:fighting', { type: 'Fighting' });
const GROUND = sure('Vine Lash', 'V:ground', { type: 'Ground' });
const DARK = sure('Vine Lash', 'V:dark', { type: 'Dark' });

const RAGE: BattleFormDef = {
  id: 'rage', name: 'Rage Form', hpBelowPct: 50, baseAtk: 90, baseDef: 30, baseSpd: 90,
  onEnter: { clearNegativeStages: true, lowerFoes: { stat: 'atk', stages: 1 } },
  sprite: { front: 'rage_front', back: 'rage_back' },
};

const A = (extra: Partial<CreatureSpec> = {}): CreatureSpec => ({ species: 'bramblecub', level: 50, ability: 'Chlorophyll', moves: [TACKLE.id, GROWL.id, NOOP.id, SAND.id], ...extra });
const D = (extra: Partial<CreatureSpec> = {}): CreatureSpec => ({ species: 'mufflo', level: 50, ability: 'Natural Cure', moves: [TACKLE.id, GROWL.id, NOOP.id, TRAP.id], ...extra });

interface Step {
  readonly events: readonly BattleEvent[];
  readonly before: BattleState;
  readonly after: BattleState;
}

const step = (before: BattleState, r: TurnResult): Step => ({ events: r.events, before, after: r.state });

function isRef(v: unknown): v is Ref {
  return v !== null && typeof v === 'object' && Object.keys(v).sort().join(',') === 'side,slot';
}

/** Every Ref inside an event (any depth) plus bare `side` fields, checked against the party the event was produced from. */
function assertRefsValid(ev: BattleEvent, state: BattleState): void {
  const walk = (v: unknown, path: string): void => {
    if (isRef(v)) {
      expect([0, 1], `${ev.t} ${path}.side`).toContain(v.side);
      expect(Number.isInteger(v.slot), `${ev.t} ${path}.slot integer`).toBe(true);
      expect(v.slot, `${ev.t} ${path}.slot in party`).toBeGreaterThanOrEqual(0);
      expect(v.slot, `${ev.t} ${path}.slot in party`).toBeLessThan(state.sides[v.side].party.length);
      return;
    }
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v !== null && typeof v === 'object') {
      for (const k of Object.keys(v)) {
        if (k === 'side') expect([0, 1], `${ev.t} ${path}.side`).toContain((v as Record<string, unknown>)[k]);
        walk((v as Record<string, unknown>)[k], `${path}.${k}`);
      }
    }
  };
  walk(ev, '');
}

function assertNoUndefined(v: unknown, path: string): void {
  expect(v, path).not.toBeUndefined();
  if (Array.isArray(v)) v.forEach((x, i) => assertNoUndefined(x, `${path}[${i}]`));
  else if (v !== null && typeof v === 'object') for (const k of Object.keys(v)) assertNoUndefined((v as Record<string, unknown>)[k], `${path}.${k}`);
}

/** Scripted scenarios; together they produce every member of the union. */
function scenarios(): Step[] {
  const out: Step[] = [];

  // 1. plain exchange with an Intimidate lead (its createBattle events count too), a stat stage, sand weather to its end
  {
    const created = startBattle({ a: A({ ability: 'Intimidate' }), b: D(), seed: 'ev1' });
    out.push(step(created.state, created));
    let st = created.state;
    let r = turn(st, move(SAND.id), move(GROWL.id));
    out.push(step(st, r));
    st = r.state;
    for (let i = 0; i < 4; i++) {
      r = turn(st, move(TACKLE.id), move(NOOP.id));
      out.push(step(st, r));
      st = r.state;
    }
  }

  // 2. sleep applied / ticking / cured (a seed with a 3-turn sleep); a heal move; a status blocked by type; a miss;
  //    a Ground move into Levitate (abilityTrigger + moveFailed { immune })
  {
    const base = startBattle({ a: A({ hp: 40 }), b: D(), seed: 'ev2' }).state;
    const slept = findSeed((seed) => {
      const before: BattleState = { ...base, rng: createRng(seed).snapshot() };
      const t = turn(before, move(SLEEP.id), move(TACKLE.id));
      return eventsOf(t.events, 'statusApplied')[0]?.turns === 3 ? step(before, t) : null;
    });
    out.push(slept);
    let st = slept.after;
    let r: TurnResult;
    for (let i = 0; i < 3; i++) {
      r = turn(st, move(SYNTH.id), move(TACKLE.id));
      out.push(step(st, r));
      st = r.state;
    }
    const fire = startBattle({ a: A(), b: { species: 'cindercap', level: 50, ability: 'Flame Body', moves: [NOOP.id] }, seed: 'ev2b' }).state;
    out.push(step(fire, turn(fire, move(BURN.id), move(NOOP.id))));
    const missSt = startBattle({ a: A(), b: D(), seed: 'ev2c' }).state;
    const missed = findSeed((seed) => {
      const before: BattleState = { ...missSt, rng: createRng(seed).snapshot() };
      const t = turn(before, move(SHAKY.id), move(NOOP.id));
      return eventsOf(t.events, 'moveMissed').length > 0 ? step(before, t) : null;
    });
    out.push(missed);
    const lev = startBattle({ a: A(), b: D({ ability: 'Levitate' }), seed: 'ev2d' }).state;
    out.push(step(lev, turn(lev, move(GROUND.id), move(NOOP.id))));
  }

  // 3. flinch; a potion; trap then trapEnd when the trapper switches out; a Weakness Policy on a super-effective hit
  {
    let st = startBattle({ a: [A({ hp: 30 }), A()], b: [D({ heldItem: 'Weakness Policy' }), D()], format: 'pvp', seed: 'ev3' }).state;
    let r = turn(st, move(FLINCH.id), move(TACKLE.id));
    out.push(step(st, r));
    st = r.state;
    r = turn(st, item('potion'), move(TRAP.id));
    out.push(step(st, r));
    st = r.state;
    r = turn(st, move(FIGHTING.id), move(NOOP.id)); // ×2 into the Weakness Policy holder
    out.push(step(st, r));
    st = r.state;
    r = turn(st, move(NOOP.id), sw(1)); // the trapper leaves: trapEnd
    out.push(step(st, r));
  }

  // 4. faint → switchRequired → replacement; exp with level-ups (14→15 learns Synthesis, →16 evolveReady); KO ends it
  {
    let st = startBattle({ a: [A({ level: 14, moves: [TACKLE.id] }), A({ level: 14 })], b: [D({ hp: 1, level: 70 }), D({ hp: 1, level: 70 })], seed: 'ev4' }).state;
    let r = turn(st, move(TACKLE.id), move(NOOP.id));
    out.push(step(st, r));
    st = r.state;
    r = turn(st, null, null); // replacement turn: npc chooses, player passes null
    out.push(step(st, r));
    st = r.state;
    r = turn(st, move(TACKLE.id), move(NOOP.id));
    out.push(step(st, r));
  }

  // 5. wild: a failed catch (the wild side still acts), a guaranteed catch, a flee; trainer: a forfeit; a berry
  {
    const wild = startBattle({ a: A({ heldItem: 'Sitrus Berry', hp: 50 }), b: D(), format: 'wild', seed: 'ev5' }).state;
    const failed = findSeed((seed) => {
      const before: BattleState = { ...wild, rng: createRng(seed).snapshot() };
      const t = turn(before, catchWith('spark_orb'), null);
      return eventsOf(t.events, 'catchResult')[0]!.caught ? null : step(before, t);
    });
    out.push(failed);
    out.push(step(wild, turn(wild, catchWith('aether_orb'), null)));
    out.push(step(wild, turn(wild, FLEE, null)));
    const trainer = startBattle({ a: A(), b: D(), seed: 'ev5b' }).state;
    out.push(step(trainer, turn(trainer, FORFEIT, move(NOOP.id))));
  }

  // a battle form: a hit takes the form species below half → formChange, then its onEnter stages
  {
    content.withSpecies({ ...content.species('mufflo'), id: 'V:rage', name: 'Rage', battleForm: RAGE });
    const st = startBattle({ a: A(), b: D({ species: 'V:rage', hp: 64 }), seed: 'ev-form' }).state; // max 125: 64 is not below half
    out.push(step(st, turn(st, move(TACKLE.id), move(NOOP.id))));
  }

  // the honor ledger: a species whose split evolution is decided by honor lands a Dark-type hit → honor −1
  {
    content.withSpecies({
      ...content.species('mufflo'), id: 'V:honorcub', name: 'Honorcub',
      evolution: { kind: 'split', atLevel: 30, branches: [{ into: 'wooltug', condition: { kind: 'honor', atLeast: 0 } }, { into: 'rambull', condition: null }] },
    });
    const st = startBattle({ a: A({ species: 'V:honorcub', moves: [DARK.id] }), b: D(), seed: 'ev-honor' }).state;
    out.push(step(st, turn(st, move(DARK.id), move(NOOP.id))));
  }

  return out;
}

describe('§2.19 BattleEvent contract', () => {
  const all = scenarios();
  const produced = new Map<BattleEvent['t'], number>();
  for (const s of all) for (const ev of s.events) produced.set(ev.t, (produced.get(ev.t) ?? 0) + 1);

  it('every event of every scenario references a valid side and slot', () => {
    let count = 0;
    for (const s of all) {
      for (const ev of s.events) {
        assertRefsValid(ev, s.before);
        count++;
      }
    }
    expect(count).toBeGreaterThan(100);
  });

  it('every event is JSON-round-trippable with no undefined anywhere (optional-looking fields are null)', () => {
    for (const s of all) {
      for (const ev of s.events) assertNoUndefined(ev, ev.t);
      const json = JSON.stringify(s.events);
      expect(json).not.toContain('undefined');
      expect(JSON.parse(json)).toEqual(s.events);
    }
  });

  it('every damage event carries amount, hpAfter, maxHp, effectiveness, crit, stab, cause, source and move', () => {
    let damages = 0;
    for (const s of all) {
      for (const ev of eventsOf(s.events, 'damage')) {
        damages++;
        expect(Object.keys(ev).sort()).toEqual(['amount', 'cause', 'crit', 'effectiveness', 'hpAfter', 'maxHp', 'move', 'source', 'stab', 't', 'target']);
        expect([0, 0.25, 0.5, 1, 2, 4]).toContain(ev.effectiveness);
        expect(typeof ev.crit).toBe('boolean');
        expect(typeof ev.stab).toBe('boolean');
        expect(['move', 'confusion', 'recoil', 'burn', 'poison', 'trap', 'sand', 'hail', 'contact']).toContain(ev.cause);
        expect(ev.hpAfter).toBeGreaterThanOrEqual(0);
        expect(ev.hpAfter).toBeLessThanOrEqual(ev.maxHp);
        expect(ev.amount).toBeGreaterThanOrEqual(0);
        expect(ev.maxHp).toBe(s.before.sides[ev.target.side].party[ev.target.slot]!.maxHp);
        if (ev.cause === 'move') {
          expect(ev.source).not.toBeNull();
          expect(ev.move).not.toBeNull();
        }
      }
    }
    expect(damages).toBeGreaterThan(20);
  });

  it('hpAfter on damage/heal events tracks the resulting state exactly — the client never computes HP', () => {
    let checked = 0;
    for (const s of all) {
      const lastHp = new Map<string, number>();
      for (const ev of s.events) if (ev.t === 'damage' || ev.t === 'heal') lastHp.set(`${ev.target.side}:${ev.target.slot}`, ev.hpAfter);
      const raised = new Set(eventsOf(s.events, 'levelUp').map((e) => `${e.who.side}:${e.who.slot}`)); // a level-up adds the maxHp delta afterwards
      for (const [key, hp] of lastHp) {
        if (raised.has(key)) continue;
        const [side, slot] = key.split(':').map(Number) as [0 | 1, number];
        expect(s.after.sides[side].party[slot]!.creature.hp, key).toBe(hp);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(15);
  });

  it('the 37 union members are each produced at least once across the scenarios, and nothing outside the union is', () => {
    expect(EVENT_TYPES.length).toBe(37);
    expect(new Set(EVENT_TYPES).size).toBe(37);
    const missing = EVENT_TYPES.filter((t) => (produced.get(t) ?? 0) === 0);
    expect(missing).toEqual([]);
    for (const t of produced.keys()) expect(EVENT_TYPES).toContain(t);
  });

  it('event order within a turn follows §2.11: turnStart first; end-of-turn events after the last move; turnEnd/battleEnd last', () => {
    for (const s of all) {
      if (s.before === s.after) continue; // the createBattle step: lead placement only, no turn
      const types = eventTypes(s.events);
      const replacement = s.before.sides[0].mustSwitch || s.before.sides[1].mustSwitch;
      if (replacement) {
        expect(types.filter((t) => t === 'turnStart' || t === 'turnEnd')).toEqual([]);
        continue;
      }
      expect(types[0]).toBe('turnStart');
      const last = types[types.length - 1];
      expect(['turnEnd', 'battleEnd']).toContain(last);
      if (last === 'battleEnd' && s.after.ended !== null && typeof s.after.ended.winner === 'number' && !types.includes('forfeit')) {
        expect(types[types.length - 2]).toBe('turnEnd'); // a KO win still runs end of turn; forfeit/flee/catch do not
      }
      const lastMove = types.lastIndexOf('moveUsed');
      for (const eot of ['weatherTick', 'weatherEnd', 'switchRequired'] as const) {
        const i = types.indexOf(eot);
        if (i !== -1) expect(i).toBeGreaterThan(lastMove);
      }
    }
  });

  it('a scripted 12-turn pvp battle round-trips every turn and keeps turnStart/turnEnd counters in step with state.turn', () => {
    let st = startBattle({ a: [A(), A()], b: [D(), D()], format: 'pvp', seed: 'twelve' }).state;
    const script = [GROWL, TACKLE, NOOP, SAND, TACKLE, GROWL, TACKLE, TACKLE, NOOP, TACKLE, GROWL, TACKLE];
    let turns = 0;
    for (let i = 0; i < 12 && st.ended === null; i++) {
      const replacement = st.sides[0].mustSwitch || st.sides[1].mustSwitch;
      const a0 = st.sides[0].mustSwitch ? sw(1) : replacement ? null : move(script[i]!.id);
      const a1 = st.sides[1].mustSwitch ? sw(1) : replacement ? null : move(script[(i * 7) % 12]!.id);
      const r = turn(st, a0, a1);
      expect(JSON.parse(JSON.stringify(r.events))).toEqual(r.events);
      if (replacement) {
        expect(r.state.turn).toBe(st.turn);
        expect(eventsOf(r.events, 'turnStart').length).toBe(0);
      } else {
        turns++;
        expect(eventsOf(r.events, 'turnStart')).toEqual([{ t: 'turnStart', turn: st.turn + 1 }]);
        expect(r.state.turn).toBe(st.turn + 1);
        if (r.state.ended === null) expect(eventsOf(r.events, 'turnEnd')).toEqual([{ t: 'turnEnd', turn: r.state.turn }]);
      }
      st = r.state;
    }
    expect(turns).toBeGreaterThanOrEqual(6);
  });
});
