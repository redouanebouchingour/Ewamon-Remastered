/**
 * §2.10 chooseNpcAction — the deterministic NPC policy. Wild: uniform pick among moves with pp > 0. NPC trainer:
 * highest expected damage, rng tiebreak. Every action it returns passes validateAction (asserted over thousands
 * of real fuzz states, including replacement phases, choice lock, Assault Vest, traps and empty PP).
 */
import { describe, expect, it } from 'vitest';
import { chooseNpcAction, createRng, validateAction } from '../src/index';
import type { Action, BattleState, Battler } from '../src/index';
import { expectedDamage } from '../src/npc';
import { fuzzBattles } from './fuzz';
import { content, customMove, scriptedRng, startBattle } from './helpers';
import type { CreatureSpec } from './helpers';

const NOOP = customMove('Growl', 'N:noop', { effect: null, accuracy: null });
const GROWL = customMove('Growl', 'N:growl', { accuracy: null });
const TACKLE = customMove('Tackle', 'N:tackle', { accuracy: null });
const TACKLE2 = customMove('Tackle', 'N:tackle2', { accuracy: null });
const BIG = customMove('Vine Lash', 'N:big', { type: 'Normal', power: 250, accuracy: null });
const GROUND = customMove('Vine Lash', 'N:ground', { type: 'Ground', accuracy: null });
const SHAKY = customMove('Vine Lash', 'N:shaky', { type: 'Normal', power: 250, accuracy: 10 });

const A = (extra: Partial<CreatureSpec> = {}): CreatureSpec => ({ species: 'bramblecub', level: 50, ability: 'Chlorophyll', ...extra });
const D = (extra: Partial<CreatureSpec> = {}): CreatureSpec => ({ species: 'mufflo', level: 50, ability: 'Natural Cure', ...extra });

/** A copy of `state` with `fn` applied to the active battler of `side` (tests build edge states directly). */
function patchActive(state: BattleState, side: 0 | 1, fn: (b: Battler) => Battler): BattleState {
  const s = state.sides[side];
  const party = s.party.map((b, i) => (i === s.active ? fn(b) : b));
  const sides: BattleState['sides'] = side === 0 ? [{ ...s, party }, state.sides[1]] : [state.sides[0], { ...s, party }];
  return { ...state, sides };
}

function patchSide(state: BattleState, side: 0 | 1, patch: Partial<BattleState['sides'][0]>): BattleState {
  const s = { ...state.sides[side], ...patch };
  const sides: BattleState['sides'] = side === 0 ? [s, state.sides[1]] : [state.sides[0], s];
  return { ...state, sides };
}

const withPp = (b: Battler, pp: (id: string) => number): Battler => ({
  ...b,
  creature: { ...b.creature, moves: b.creature.moves.map((m) => ({ ...m, pp: pp(m.id) })) },
});

describe('§2.10 chooseNpcAction — legality', () => {
  it('always returns an action that passes validateAction — 400 fuzz battles, both sides, every phase', () => {
    let checked = 0;
    const r = fuzzBattles({
      seeds: 400,
      content,
      maxTurns: 200,
      onStep: (state) => {
        const replacement = state.sides[0].mustSwitch || state.sides[1].mustSwitch;
        for (const side of [0, 1] as const) {
          if (replacement && !state.sides[side].mustSwitch) continue; // the policy is not consulted for this side
          for (const seed of [0, 1, 2]) {
            const a = chooseNpcAction(state, side, content, createRng(seed));
            const err = validateAction(state, side, a, content);
            if (err !== null) throw new Error(`side ${side} kind ${state.sides[side].kind} turn ${state.turn}: ${JSON.stringify(a)} -> ${err}`);
            checked++;
          }
        }
      },
    });
    expect(r.unfinished).toEqual([]);
    expect(checked).toBeGreaterThan(5000);
  });

  it('is a pure function of (state, rng): the same seed gives the same action', () => {
    const st = startBattle({ a: A(), b: D({ moves: [TACKLE.id, TACKLE2.id, GROWL.id] }), format: 'wild' }).state;
    for (let seed = 0; seed < 20; seed++) {
      expect(chooseNpcAction(st, 1, content, createRng(seed))).toEqual(chooseNpcAction(st, 1, content, createRng(seed)));
    }
  });
});

describe('§2.10 chooseNpcAction — wild policy', () => {
  it('wild: uniform pick among moves with pp > 0 (one rng.pick), never a move at 0 PP', () => {
    const base = startBattle({ a: A(), b: D({ moves: [TACKLE.id, GROWL.id, NOOP.id, BIG.id] }), format: 'wild' }).state;
    const st = patchActive(base, 1, (b) => withPp(b, (id) => (id === GROWL.id ? 0 : 10)));
    const usable = [TACKLE.id, NOOP.id, BIG.id];
    for (let k = 0; k < 9; k++) {
      const rng = scriptedRng([k]);
      const a = chooseNpcAction(st, 1, content, rng);
      expect(a).toEqual({ kind: 'move', move: usable[k % usable.length] });
      expect(rng.draws()).toBe(1);
    }
    const seen = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      const a = chooseNpcAction(st, 1, content, createRng(seed));
      expect(a.kind).toBe('move');
      if (a.kind === 'move') seen.add(a.move);
    }
    expect([...seen].sort()).toEqual([...usable].sort());
    expect(seen.has(GROWL.id)).toBe(false);
  });

  it('wild: a status move is as likely as a nuke — the wild side does not maximise damage', () => {
    const st = startBattle({ a: A(), b: D({ moves: [GROWL.id, BIG.id] }), format: 'wild' }).state;
    let growls = 0;
    for (let seed = 0; seed < 200; seed++) {
      const a = chooseNpcAction(st, 1, content, createRng(seed));
      if (a.kind === 'move' && a.move === GROWL.id) growls++;
    }
    expect(growls).toBeGreaterThan(60);
    expect(growls).toBeLessThan(140);
  });
});

describe('§2.10 chooseNpcAction — NPC trainer policy', () => {
  it('npc: the move with the highest expected damage, regardless of rng', () => {
    const st = startBattle({ a: A(), b: D({ moves: [GROWL.id, TACKLE.id, BIG.id] }) }).state;
    for (let seed = 0; seed < 20; seed++) expect(chooseNpcAction(st, 1, content, createRng(seed))).toEqual({ kind: 'move', move: BIG.id });
    const rng = scriptedRng([]);
    expect(chooseNpcAction(st, 1, content, rng)).toEqual({ kind: 'move', move: BIG.id }); // no draw on a strict maximum
    expect(rng.draws()).toBe(0);
  });

  it('npc: expected damage is accuracy-weighted (a 10 %-accurate nuke loses to a sure Tackle) and immunity-aware', () => {
    const st = startBattle({ a: A(), b: D({ moves: [SHAKY.id, TACKLE.id] }) }).state;
    expect(expectedDamage(st, 1, SHAKY, content)).toBeLessThan(expectedDamage(st, 1, TACKLE, content));
    expect(chooseNpcAction(st, 1, content, createRng(1))).toEqual({ kind: 'move', move: TACKLE.id });
    // Ground into Levitate is worth 0: the weaker Tackle is chosen
    const lev = startBattle({ a: A({ ability: 'Levitate' }), b: D({ moves: [GROUND.id, TACKLE.id] }) }).state;
    expect(expectedDamage(lev, 1, GROUND, content)).toBe(0);
    expect(chooseNpcAction(lev, 1, content, createRng(1))).toEqual({ kind: 'move', move: TACKLE.id });
  });

  it('npc: an exact tie is broken by one rng.pick among the tied moves only', () => {
    const st = startBattle({ a: A(), b: D({ moves: [GROWL.id, TACKLE.id, TACKLE2.id] }) }).state;
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const a = chooseNpcAction(st, 1, content, createRng(seed));
      if (a.kind === 'move') seen.add(a.move);
    }
    expect([...seen].sort()).toEqual([TACKLE.id, TACKLE2.id].sort());
    const rng = scriptedRng([1]);
    expect(chooseNpcAction(st, 1, content, rng)).toEqual({ kind: 'move', move: TACKLE2.id });
    expect(rng.draws()).toBe(1);
  });
});

describe('§2.10 chooseNpcAction — switching, items of last resort, and termination', () => {
  it('mustSwitch: switches to the lowest-index standing party member', () => {
    const base = startBattle({ a: A(), b: [D(), D(), D()] }).state;
    let st = patchActive(base, 1, (b) => ({ ...b, creature: { ...b.creature, hp: 0 } }));
    st = patchSide(st, 1, { mustSwitch: true, party: st.sides[1].party.map((b, i) => (i === 1 ? { ...b, creature: { ...b.creature, hp: 0 } } : b)) });
    const a = chooseNpcAction(st, 1, content, createRng(0));
    expect(a).toEqual({ kind: 'switch', to: 2 });
    expect(validateAction(st, 1, a, content)).toBeNull();
  });

  it('no usable move: bench in when possible; trapped or benchless → flee if allowed, else forfeit (there is no Struggle)', () => {
    // npc with an empty-PP active and a bench → switch
    const bench = startBattle({ a: A(), b: [D({ pp: 0 }), D()] }).state;
    expect(chooseNpcAction(bench, 1, content, createRng(0))).toEqual({ kind: 'switch', to: 1 });
    // npc, empty PP, no bench → forfeit (it cannot flee)
    const alone = startBattle({ a: A(), b: D({ pp: 0 }) }).state;
    expect(chooseNpcAction(alone, 1, content, createRng(0))).toEqual({ kind: 'forfeit' });
    expect(validateAction(alone, 1, { kind: 'forfeit' }, content)).toBeNull();
    // trapped with a bench → cannot switch → forfeit
    const trapped = patchActive(bench, 1, (b) => ({ ...b, volatile: { ...b.volatile, trappedTurns: 3 } }));
    expect(chooseNpcAction(trapped, 1, content, createRng(0))).toEqual({ kind: 'forfeit' });
    expect(validateAction(trapped, 1, { kind: 'forfeit' }, content)).toBeNull();
    // the player side of a wild battle (canFlee) flees instead
    const wild = startBattle({ a: A({ pp: 0 }), b: D(), format: 'wild' }).state;
    const flee = chooseNpcAction(wild, 0, content, createRng(0));
    expect(flee).toEqual({ kind: 'flee' });
    expect(validateAction(wild, 0, flee, content)).toBeNull();
    // ...and a wild side with nothing left forfeits (wild kind, canFlee false)
    const wildEmpty = startBattle({ a: A(), b: D({ pp: 0 }), format: 'wild' }).state;
    expect(chooseNpcAction(wildEmpty, 1, content, createRng(0))).toEqual({ kind: 'forfeit' });
  });

  it('respects Assault Vest (no power-0 moves) and choice lock', () => {
    const vest = startBattle({ a: A(), b: D({ moves: [GROWL.id, NOOP.id, TACKLE.id], heldItem: 'Assault Vest' }), format: 'wild' }).state;
    for (let seed = 0; seed < 50; seed++) expect(chooseNpcAction(vest, 1, content, createRng(seed))).toEqual({ kind: 'move', move: TACKLE.id });
    // vest + only status moves → nothing usable → forfeit
    const stuck = startBattle({ a: A(), b: D({ moves: [GROWL.id, NOOP.id], heldItem: 'Assault Vest' }), format: 'wild' }).state;
    expect(chooseNpcAction(stuck, 1, content, createRng(0))).toEqual({ kind: 'forfeit' });
    const locked = patchActive(startBattle({ a: A(), b: D({ moves: [GROWL.id, BIG.id], heldItem: 'Choice Band' }) }).state, 1, (b) => ({
      ...b,
      volatile: { ...b.volatile, choiceLockedMove: GROWL.id },
    }));
    for (let seed = 0; seed < 10; seed++) {
      const a: Action = chooseNpcAction(locked, 1, content, createRng(seed));
      expect(a).toEqual({ kind: 'move', move: GROWL.id });
      expect(validateAction(locked, 1, a, content)).toBeNull();
    }
  });
});
