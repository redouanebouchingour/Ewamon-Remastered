/**
 * Phase D6 — doubles (`slots: 2`): construction, per-position validation and targeting, spread moves (×0.75 when 2+
 * targets), turn order across four battlers, faint / replacement per position, the no-bench empty position, EXP (no
 * split), Intimidate on both foes, the NPC doubles policy, and a doubles fuzz with its own committed digests
 * (test/doubles-fuzz-digests.json). Singles stays byte-identical: `slots: 1` ≡ absent, no new keys in a singles state
 * (the 1,000-battle singles digests in test/fuzz-digests.json are asserted by determinism.test.ts).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  InvalidActionError,
  canonicalJson,
  chooseNpcDoubles,
  createBattle,
  createRng,
  digestBattleState,
  expGain,
  requiredPositions,
  resolveTurn,
  validateAction,
  validateSideChoice,
} from '../src/index';
import type { Action, BattleFormat, BattleState, Battler, ContentIndex, MoveDef, SideChoice } from '../src/index';
import { damageAmount } from '../src/damage';
import { buildLegacyContent } from './fixtures/legacyContent';
import { DOUBLES_FORMATS, buildDoubles, runDoubles, withSpread } from './doubles-fuzz';
import { content, customMove, eventsOf, makeSide } from './helpers';
import type { CreatureSpec, SideSpec } from './helpers';

const sure = (base: string, id: string, patch: Partial<MoveDef> = {}): MoveDef => customMove(base, id, { effectChance: 100, accuracy: null, ...patch });
const NOOP = sure('Growl', 'D:noop', { effect: null });
const TACKLE = sure('Tackle', 'D:tackle');
const QUICK = sure('Quick Attack', 'D:quick');
const BIG = sure('Vine Lash', 'D:big', { type: 'Normal', power: 250 });
const SPREAD = sure('Tackle', 'D:spread', { power: 60, contact: false, spread: 'foes' });
const QUAKE = sure('Tackle', 'D:quake', { power: 60, contact: false, spread: 'all' });

const MOVES = [TACKLE.id, NOOP.id, BIG.id, SPREAD.id];
const P = (extra: Partial<CreatureSpec> = {}): CreatureSpec => ({ species: 'bramblecub', level: 50, ability: 'Chlorophyll', moves: MOVES, ...extra });
const F = (extra: Partial<CreatureSpec> = {}): CreatureSpec => ({ species: 'mufflo', level: 50, ability: 'Natural Cure', moves: MOVES, ...extra });

const mv = (m: string, target?: { side: 0 | 1; pos: 0 | 1 }): Action => (target === undefined ? { kind: 'move', move: m } : { kind: 'move', move: m, target });
const sw = (to: number): Action => ({ kind: 'switch', to });

function start(a: SideSpec, b: SideSpec, format: BattleFormat = 'pvp', seed: string | number = 'doubles', c: ContentIndex = content): BattleState {
  return createBattle(
    { id: 'd', format, zoneId: 'mirevale', terrain: 'grove', seed, slots: 2, sides: [makeSide(a, 'player', format, content), makeSide(b, 'foe', format, content)] },
    c,
  ).state;
}

function patchBattler(state: BattleState, side: 0 | 1, idx: number, fn: (b: Battler) => Battler): BattleState {
  const s = state.sides[side];
  const party = s.party.map((b, i) => (i === idx ? fn(b) : b));
  const sides: BattleState['sides'] = side === 0 ? [{ ...s, party }, state.sides[1]] : [state.sides[0], { ...s, party }];
  return { ...state, sides };
}
const withHp = (hp: number) => (b: Battler): Battler => ({ ...b, creature: { ...b.creature, hp } });

function throwsCode(fn: () => unknown): string | null {
  try {
    fn();
  } catch (e) {
    return e instanceof InvalidActionError ? e.code : String(e);
  }
  return null;
}

describe('D6 construction', () => {
  it('slots 2: state.slots, actives per side (active mirrors position 0), four switchIns in field order with pos', () => {
    const r = createBattle(
      { id: 'd', format: 'trainer', zoneId: 'mirevale', terrain: 'grove', seed: 1, slots: 2, sides: [makeSide({ party: [P(), P(), P()] }, 'player', 'trainer', content), makeSide({ party: [F(), F()] }, 'foe', 'trainer', content)] },
      content,
    );
    expect(r.state.slots).toBe(2);
    expect(r.state.sides[0].actives).toEqual([0, 1]);
    expect(r.state.sides[1].actives).toEqual([0, 1]);
    expect(r.state.sides[0].active).toBe(0);
    const ins = eventsOf(r.events, 'switchIn');
    expect(ins.map((e) => [e.who.side, e.who.slot, e.pos])).toEqual([[0, 0, 0], [0, 1, 1], [1, 0, 0], [1, 1, 1]]);
    expect(r.state.sides[0].party[1]!.participated).toBe(true);
  });

  it('singles stays shape-identical: slots 1 ≡ absent; no slots / actives keys; pos ignored by validateAction', () => {
    const sides = [makeSide({ party: [P(), P()] }, 'player', 'trainer', content), makeSide({ party: [F()] }, 'foe', 'trainer', content)] as const;
    const base = { id: 's', format: 'trainer' as const, zoneId: 'mirevale', terrain: 'grove' as const, seed: 9, sides };
    const a = createBattle(base, content);
    const b = createBattle({ ...base, slots: 1 }, content);
    expect(digestBattleState(b.state)).toBe(digestBattleState(a.state));
    expect(canonicalJson(b.events)).toBe(canonicalJson(a.events));
    expect('slots' in a.state).toBe(false);
    expect('actives' in a.state.sides[0]).toBe(false);
    const next = resolveTurn(a.state, [mv(TACKLE.id), null], content).state;
    expect('slots' in next).toBe(false);
    expect('actives' in next.sides[1]).toBe(false);
    expect(validateAction(a.state, 0, mv(TACKLE.id), content, 1)).toBeNull();
    expect(eventsOf(a.events, 'switchIn').every((e) => !('pos' in e))).toBe(true);
  });

  it('refuses wild / raid doubles and a side without two standing creatures', () => {
    const one = () => start({ party: [P()] }, { party: [F(), F()] }, 'trainer');
    expect(one).toThrow(RangeError);
    const fainted = () => start({ party: [P(), P({ hp: 0 })] }, { party: [F(), F()] }, 'trainer');
    expect(fainted).toThrow(RangeError);
    const wild = () =>
      createBattle({ id: 'w', format: 'wild', zoneId: 'mirevale', terrain: 'grove', seed: 1, slots: 2, sides: [makeSide({ party: [P(), P()] }, 'player', 'wild', content), makeSide({ party: [F(), F()] }, 'foe', 'wild', content)] }, content);
    expect(wild).toThrow(RangeError);
  });
});

describe('D6 validation and targeting', () => {
  const st = start({ party: [P(), P()] }, { party: [F(), F()] });

  it('requires both standing positions; a target at oneself is badTarget; two switches to one creature are refused', () => {
    expect(requiredPositions(st, 0)).toEqual([0, 1]);
    expect(validateAction(st, 0, mv(TACKLE.id, { side: 0, pos: 0 }), content, 0)).toBe('badTarget');
    expect(validateAction(st, 0, mv(TACKLE.id, { side: 0, pos: 1 }), content, 0)).toBeNull();
    expect(validateAction(st, 0, null, content, 1)).toBe('actionNotRequired');
    expect(validateAction(st, 0, { kind: 'catch', orb: 'spark_orb' }, content, 0)).toBe('cannotCatch');
    expect(validateSideChoice(st, 0, [mv(TACKLE.id), null], content)).toEqual({ pos: 1, code: 'actionNotRequired' });
    const three = start({ party: [P(), P(), P(), P()] }, { party: [F(), F()] });
    expect(validateSideChoice(three, 0, [sw(2), sw(2)], content)).toEqual({ pos: 1, code: 'switchToActive' });
    expect(validateAction(three, 0, sw(1), content, 0)).toBe('switchToActive');
    expect(throwsCode(() => resolveTurn(three, [[sw(2), sw(2)], [mv(NOOP.id), mv(NOOP.id)]], content))).toBe('switchToActive');
  });

  it('a single-target move hits the chosen foe position; absent target = the first standing foe', () => {
    const r = resolveTurn(st, [[mv(TACKLE.id, { side: 1, pos: 1 }), mv(NOOP.id)], [mv(NOOP.id), mv(NOOP.id)]], content);
    const dmg = eventsOf(r.events, 'damage').filter((e) => e.cause === 'move');
    expect(dmg.map((e) => [e.target.side, e.target.slot])).toEqual([[1, 1]]);
    const r2 = resolveTurn(st, [[mv(TACKLE.id), mv(NOOP.id)], [mv(NOOP.id), mv(NOOP.id)]], content);
    expect(eventsOf(r2.events, 'damage').map((e) => [e.target.side, e.target.slot])).toEqual([[1, 0]]);
  });

  it('a fainted foe target retargets to the other standing foe; a fainted ally target fails with noTarget', () => {
    const down = patchBattler(st, 1, 0, withHp(0)); // no bench: the fainted battler stays on position 0
    expect(requiredPositions(down, 1)).toEqual([1]);
    const r = resolveTurn(down, [[mv(TACKLE.id, { side: 1, pos: 0 }), mv(NOOP.id)], [null, mv(NOOP.id)]], content);
    expect(eventsOf(r.events, 'damage').map((e) => [e.target.side, e.target.slot])).toEqual([[1, 1]]);
    const allyDown = patchBattler(st, 0, 1, withHp(0));
    const r2 = resolveTurn(allyDown, [[mv(TACKLE.id, { side: 0, pos: 1 }), null], [mv(NOOP.id), mv(NOOP.id)]], content);
    expect(eventsOf(r2.events, 'moveFailed').map((e) => e.reason)).toContain('noTarget');
    expect(eventsOf(r2.events, 'damage')).toEqual([]);
  });

  it('an ally can be the target of a single-target move', () => {
    const r = resolveTurn(st, [[mv(TACKLE.id, { side: 0, pos: 1 }), mv(NOOP.id)], [mv(NOOP.id), mv(NOOP.id)]], content);
    expect(eventsOf(r.events, 'damage').map((e) => [e.target.side, e.target.slot])).toEqual([[0, 1]]);
  });
});

describe('D6 spread moves', () => {
  const tough = (extra: Partial<CreatureSpec> = {}) => F({ level: 100, ...extra });
  const bounds = (state: BattleState, defIdx: number, move: MoveDef): [number, number] => {
    const att = state.sides[0].party[0]!;
    const def = state.sides[1].party[defIdx]!;
    const inp = { attacker: att, defender: def, weather: state.field.weather.kind };
    const lo = damageAmount(inp, move, 1, false, 85, content).amount;
    const hi = damageAmount(inp, move, 1, true, 100, content).amount;
    return [lo, hi];
  };

  it("'foes' hits both standing foes, each ×0.75 (floor, min 1); moveUsed lists the targets", () => {
    const st = start({ party: [P(), P()] }, { party: [tough(), tough()] });
    const r = resolveTurn(st, [[mv(SPREAD.id), mv(NOOP.id)], [mv(NOOP.id), mv(NOOP.id)]], content);
    const used = eventsOf(r.events, 'moveUsed').find((e) => e.move === SPREAD.id)!;
    expect(used.targets?.map((t) => [t.side, t.slot])).toEqual([[1, 0], [1, 1]]);
    const dmg = eventsOf(r.events, 'damage').filter((e) => e.move === SPREAD.id);
    expect(dmg.map((e) => e.target.slot)).toEqual([0, 1]);
    for (const e of dmg) {
      const [lo, hi] = bounds(st, e.target.slot, SPREAD);
      expect(e.amount).toBeGreaterThanOrEqual(Math.max(1, Math.floor((lo * 3) / 4)));
      expect(e.amount).toBeLessThanOrEqual(Math.max(1, Math.floor((hi * 3) / 4)));
    }
  });

  it('a spread move with one target left deals full damage', () => {
    const st = patchBattler(start({ party: [P(), P()] }, { party: [tough(), tough()] }), 1, 0, withHp(0));
    const r = resolveTurn(st, [[mv(SPREAD.id), mv(NOOP.id)], [null, mv(NOOP.id)]], content);
    const dmg = eventsOf(r.events, 'damage').filter((e) => e.move === SPREAD.id);
    expect(dmg.map((e) => e.target.slot)).toEqual([1]);
    const [lo] = bounds(st, 1, SPREAD);
    expect(dmg[0]!.amount).toBeGreaterThanOrEqual(lo);
  });

  it("'all' also hits the ally; spread moves ignore an explicit target", () => {
    const st = start({ party: [P({ moves: [QUAKE.id, NOOP.id] }), P({ level: 100 })] }, { party: [tough(), tough()] });
    const r = resolveTurn(st, [[mv(QUAKE.id, { side: 1, pos: 1 }), mv(NOOP.id)], [mv(NOOP.id), mv(NOOP.id)]], content);
    const dmg = eventsOf(r.events, 'damage').filter((e) => e.move === QUAKE.id);
    expect(dmg.map((e) => [e.target.side, e.target.slot])).toEqual([[1, 0], [1, 1], [0, 1]]);
  });

  it('spread is ignored in singles (one foe, no ×0.75 path, no targets list)', () => {
    const s = createBattle({ id: 's', format: 'trainer', zoneId: 'mirevale', terrain: 'grove', seed: 3, sides: [makeSide({ party: [P()] }, 'player', 'trainer', content), makeSide({ party: [tough({ moves: [NOOP.id] })] }, 'foe', 'trainer', content)] }, content).state;
    const r = resolveTurn(s, [mv(SPREAD.id), null], content);
    const used = eventsOf(r.events, 'moveUsed').find((e) => e.move === SPREAD.id)!;
    expect('targets' in used).toBe(false);
  });
});

describe('D6 turn order across four battlers', () => {
  it('speed desc across both sides; priority first', () => {
    // bramblecub L100 > bramblecub L50 (108) > mufflo L50 (105) > mufflo L10
    const st = start({ party: [P(), P({ level: 100 })] }, { party: [F(), F({ level: 10, moves: [...MOVES, QUICK.id] })] });
    const r = resolveTurn(st, [[mv(NOOP.id), mv(NOOP.id)], [mv(NOOP.id), mv(NOOP.id)]], content);
    expect(eventsOf(r.events, 'moveUsed').map((e) => [e.who.side, e.who.slot])).toEqual([[0, 1], [0, 0], [1, 0], [1, 1]]);
    const q = resolveTurn(st, [[mv(NOOP.id), mv(NOOP.id)], [mv(NOOP.id), { kind: 'move', move: QUICK.id }]], content);
    expect(eventsOf(q.events, 'moveUsed')[0]!.who).toEqual({ side: 1, slot: 1 });
  });

  it('switches resolve before moves; a switched position acts no more this turn', () => {
    const st = start({ party: [P(), P(), P({ species: 'mufflo' })] }, { party: [F(), F()] });
    const r = resolveTurn(st, [[sw(2), mv(NOOP.id)], [mv(TACKLE.id, { side: 0, pos: 0 }), mv(NOOP.id)]], content);
    const types = r.events.map((e) => e.t);
    expect(types.indexOf('switchOut')).toBeLessThan(types.indexOf('moveUsed'));
    expect(r.state.sides[0].actives).toEqual([2, 1]);
    expect(r.state.sides[0].active).toBe(2);
    expect(eventsOf(r.events, 'switchIn')[0]).toMatchObject({ who: { side: 0, slot: 2 }, pos: 0 });
    expect(eventsOf(r.events, 'damage')[0]!.target).toEqual({ side: 0, slot: 2 }); // the newcomer takes the hit
  });
});

describe('D6 faint and replacement per position', () => {
  it('a fainted position with a bench → mustSwitch, switchRequired, only that position is required; NPC fills it', () => {
    const st = start({ party: [P({ level: 100 }), P()] }, { party: [F(), F({ level: 5 }), F({ species: 'bramblecub' })] }, 'trainer');
    const r = resolveTurn(st, [[mv(BIG.id, { side: 1, pos: 1 }), mv(NOOP.id)], null], content);
    expect(eventsOf(r.events, 'faint').map((e) => e.who)).toContainEqual({ side: 1, slot: 1 });
    expect(r.state.sides[1].mustSwitch).toBe(true);
    expect(eventsOf(r.events, 'switchRequired')).toEqual([{ t: 'switchRequired', side: 1 }]);
    expect(requiredPositions(r.state, 1)).toEqual([1]);
    expect(requiredPositions(r.state, 0)).toEqual([]);
    const rep = resolveTurn(r.state, [null, null], content);
    expect(eventsOf(rep.events, 'switchOut')).toEqual([{ t: 'switchOut', who: { side: 1, slot: 1 }, reason: 'faint', pos: 1 }]);
    expect(eventsOf(rep.events, 'switchIn')).toEqual([{ t: 'switchIn', who: { side: 1, slot: 2 }, pos: 1 }]);
    expect(rep.state.sides[1].actives).toEqual([0, 2]);
    expect(rep.state.sides[1].mustSwitch).toBe(false);
    expect(rep.state.turn).toBe(r.state.turn);
  });

  it('two fainted positions and one bench creature: only the first fainted position is filled', () => {
    let st = start({ party: [P(), P(), P()] }, { party: [F(), F()] });
    st = patchBattler(patchBattler(st, 0, 0, withHp(1)), 0, 1, withHp(1));
    // both player battlers at 1 hp: the foes' tackles KO both
    const r = resolveTurn(st, [[mv(NOOP.id), mv(NOOP.id)], [mv(TACKLE.id, { side: 0, pos: 0 }), mv(TACKLE.id, { side: 0, pos: 1 })]], content);
    expect(r.state.sides[0].mustSwitch).toBe(true);
    expect(requiredPositions(r.state, 0)).toEqual([0]);
    expect(validateSideChoice(r.state, 0, [sw(2), null], content)).toBeNull();
    expect(validateSideChoice(r.state, 0, [null, sw(2)], content)).toEqual({ pos: 0, code: 'mustSwitch' });
    const rep = resolveTurn(r.state, [[sw(2), null], null], content);
    expect(rep.state.sides[0].actives).toEqual([2, 1]);
    expect(rep.state.sides[0].mustSwitch).toBe(false);
    // the empty position (fainted, no bench) needs no action; the battle goes on
    expect(requiredPositions(rep.state, 0)).toEqual([0]);
    const next = resolveTurn(rep.state, [[mv(NOOP.id), null], [mv(NOOP.id), mv(NOOP.id)]], content);
    expect(next.state.ended).toBeNull();
  });

  it('the battle ends when every creature of a side is down', () => {
    let st = start({ party: [P({ level: 100 }), P({ level: 100 })] }, { party: [F(), F()] });
    st = patchBattler(patchBattler(st, 1, 0, withHp(1)), 1, 1, withHp(1));
    const r = resolveTurn(st, [[mv(TACKLE.id, { side: 1, pos: 0 }), mv(TACKLE.id, { side: 1, pos: 1 })], [mv(NOOP.id), mv(NOOP.id)]], content);
    expect(r.state.ended).toEqual({ winner: 0 });
  });

  it('forfeit from either position ends the battle for that side', () => {
    const st = start({ party: [P(), P()] }, { party: [F(), F()] });
    const r = resolveTurn(st, [[mv(NOOP.id), { kind: 'forfeit' }], [mv(NOOP.id), mv(NOOP.id)]], content);
    expect(r.state.ended).toEqual({ winner: 1 });
  });
});

describe('D6 exp and abilities', () => {
  it('a KO gives every participating standing player battler the full yield (no split)', () => {
    let st = start({ party: [P({ level: 20 }), P({ level: 20 }), P({ level: 20 })] }, { party: [F({ level: 30 }), F({ level: 30 })] });
    st = patchBattler(st, 1, 0, withHp(1));
    const r = resolveTurn(st, [[mv(TACKLE.id, { side: 1, pos: 0 }), mv(NOOP.id)], [mv(NOOP.id), mv(NOOP.id)]], content);
    const gains = eventsOf(r.events, 'expGain');
    const full = expGain(content.species('mufflo'), 30, true);
    expect(gains.map((g) => g.who.slot).sort()).toEqual([0, 1]); // the benched slot 2 never participated
    for (const g of gains) expect(g.amount).toBe(full);
  });

  it('Intimidate lowers both standing foes', () => {
    const r = createBattle(
      { id: 'i', format: 'pvp', zoneId: 'mirevale', terrain: 'grove', seed: 2, slots: 2, sides: [makeSide({ party: [P({ ability: 'Intimidate' }), P()] }, 'player', 'pvp', content), makeSide({ party: [F(), F()] }, 'foe', 'pvp', content)] },
      content,
    );
    const lowered = eventsOf(r.events, 'statStage').filter((e) => e.stat === 'atk' && e.delta < 0);
    expect(lowered.map((e) => [e.target.side, e.target.slot])).toEqual([[1, 0], [1, 1]]);
    expect(eventsOf(r.events, 'abilityTrigger').filter((e) => e.ability === 'Intimidate')).toHaveLength(1);
  });
});

describe('D6 NPC doubles policy', () => {
  it('returns a legal pair, aims each position at the foe it hurts most, and is deterministic over the rng', () => {
    const st = start({ party: [P({ level: 100 }), P({ level: 5 })] }, { party: [F(), F()] }, 'trainer');
    const a = chooseNpcDoubles(st, 1, content, createRng(4));
    const b = chooseNpcDoubles(st, 1, content, createRng(4));
    expect(a).toEqual(b);
    expect(validateSideChoice(st, 1, a, content)).toBeNull();
    for (const x of a) {
      expect(x?.kind).toBe('move');
      if (x?.kind === 'move' && x.move !== SPREAD.id) expect(x.target).toEqual({ side: 0, pos: 1 }); // the L5 is the softer target
    }
  });

  it('fills a replacement with the bench in ascending order', () => {
    let st = start({ party: [P(), P()] }, { party: [F(), F(), F(), F()] }, 'trainer');
    st = patchBattler(patchBattler(st, 1, 0, withHp(1)), 1, 1, withHp(1));
    const r = resolveTurn(st, [[mv(TACKLE.id, { side: 1, pos: 0 }), mv(TACKLE.id, { side: 1, pos: 1 })], null], content);
    if (r.state.sides[1].mustSwitch) {
      expect(chooseNpcDoubles(r.state, 1, content, createRng(1))).toEqual([sw(2), sw(3)]);
    }
  });
});

// ─── the doubles fuzz ─────────────────────────────────────────────────────────

const SEEDS = 300;
const MAX_TURNS = 200;
const DIGESTS_PATH = fileURLToPath(new URL('./doubles-fuzz-digests.json', import.meta.url));

describe('D6 doubles fuzz — 300 seeded battles, own digests', () => {
  const cA = withSpread(buildLegacyContent());
  const recs = Array.from({ length: SEEDS }, (_, seed) => runDoubles(seed, cA, MAX_TURNS));

  it('every battle terminates, all three formats occur, spread / ally targets / switches / items reach resolveTurn', () => {
    expect(recs.filter((r) => r.outcome === 'unfinished').map((r) => r.seed)).toEqual([]);
    expect(new Set(recs.map((r) => r.format))).toEqual(new Set(DOUBLES_FORMATS));
    const kinds = new Set<string>();
    let ally = 0;
    for (const r of recs) {
      for (const pair of r.actions) {
        for (const side of [0, 1] as const) {
          const c = pair[side] as SideChoice;
          const list = Array.isArray(c) ? (c as readonly (Action | null)[]) : [c as Action | null];
          for (let p = 0; p < list.length; p++) {
            const a = list[p];
            if (a === null || a === undefined) continue;
            kinds.add(a.kind);
            if (a.kind === 'move' && a.target?.side === side) ally++;
          }
        }
      }
    }
    expect([...kinds].sort()).toEqual(['forfeit', 'item', 'move', 'switch']);
    expect(ally).toBeGreaterThan(0);
    const outcomes = new Set(recs.map((r) => r.outcome));
    expect(outcomes.has('{"winner":0}')).toBe(true);
    expect(outcomes.has('{"winner":1}')).toBe(true);
  });

  it('a second, independently built ContentIndex reproduces every per-turn digest; replays match', () => {
    const cB = withSpread(buildLegacyContent());
    for (let i = 0; i < SEEDS; i++) {
      const b = runDoubles(i, cB, MAX_TURNS);
      expect(b.turnDigests).toEqual(recs[i]!.turnDigests);
    }
    for (const rec of recs.slice(0, 40)) {
      let st = buildDoubles(rec.seed, cA).state;
      const out = [digestBattleState(st)];
      for (const a of rec.actions) {
        st = resolveTurn(st, a, cA).state;
        out.push(digestBattleState(st));
      }
      expect(out).toEqual(rec.turnDigests);
    }
  });

  it('matches the committed test/doubles-fuzz-digests.json — a diff here is a doubles semantics change', () => {
    const fresh = {
      seeds: SEEDS,
      maxTurns: MAX_TURNS,
      note: 'Phase D6: fnv1a32 over the joined per-turn digestBattleState values of each seeded doubles fuzz battle (test/doubles-fuzz.ts). Regenerate only for an intended doubles semantics change and record it in the spec changelog.',
      digests: recs.map((r) => r.digest),
    };
    if (!existsSync(DIGESTS_PATH)) writeFileSync(DIGESTS_PATH, JSON.stringify(fresh, null, 2) + '\n', 'utf8');
    const committed = JSON.parse(readFileSync(DIGESTS_PATH, 'utf8')) as typeof fresh;
    expect(committed.seeds).toBe(SEEDS);
    expect(committed.digests).toEqual(fresh.digests);
  });
});
