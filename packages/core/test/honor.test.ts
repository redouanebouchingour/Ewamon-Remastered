/**
 * The honor ledger (honor.ts, dustcub's line): a player's creature whose species has an `honor` split keeps
 * `CreatureInstance.honor` — a Dark-type hit −1, a wild creature fainting while it stands opposite −1, a catch while it
 * stands on the field +1, a won duel it took part in +2, clamped to ±10, never in the tower — and at the split's level the
 * ledger picks the branch. Every other creature's battle never gains the field or an event.
 */
import { describe, expect, it } from 'vitest';
import { HONOR_MAX, HONOR_MIN, applyExp, canonicalJson, evolutionTarget, expToLevel, tracksHonor } from '../src/index';
import type { BattleState, Evolution, MoveDef } from '../src/index';
import { activeOf, catchWith, content, customMove, eventsOf, findSeed, move, startBattle, turn } from './helpers';
import type { CreatureSpec } from './helpers';

const SPLIT: Evolution = {
  kind: 'split',
  atLevel: 30,
  branches: [{ into: 'wooltug', condition: { kind: 'honor', atLeast: 0 } }, { into: 'rambull', condition: null }],
};
content.withSpecies({ ...content.species('mufflo'), id: 'H:cub', name: 'Honorcub', evolution: SPLIT });

const sure = (base: string, id: string, patch: Partial<MoveDef> = {}): MoveDef => customMove(base, id, { effectChance: 100, accuracy: null, ...patch });
const NOOP = sure('Growl', 'H:noop', { effect: null });
const POKE = sure('Tackle', 'H:poke', { type: 'Normal', power: 10 });
const DIRTY = sure('Tackle', 'H:dirty', { type: 'Dark', power: 10 });
const BIG = sure('Vine Lash', 'H:big', { type: 'Normal', power: 250 });
const MOVES = [POKE.id, DIRTY.id, BIG.id, NOOP.id];

const CUB = (extra: Partial<CreatureSpec> = {}): CreatureSpec => ({ species: 'H:cub', level: 50, ability: 'Natural Cure', moves: MOVES, ...extra });
const FOE = (extra: Partial<CreatureSpec> = {}): CreatureSpec => ({ species: 'mufflo', level: 50, ability: 'Natural Cure', moves: [NOOP.id], ...extra });

describe('the honor ledger', () => {
  it('only a species with an honor split keeps it', () => {
    expect(tracksHonor(content.species('H:cub'))).toBe(true);
    expect(tracksHonor(content.species('mufflo'))).toBe(false);
    expect(tracksHonor(content.species('darkone'))).toBe(false); // an ability split
  });

  it('a Dark-type hit costs 1; a non-Dark hit costs nothing', () => {
    const st = startBattle({ a: CUB(), b: FOE(), seed: 'h1' }).state;
    const dirty = turn(st, move(DIRTY.id), move(NOOP.id));
    expect(eventsOf(dirty.events, 'honor')).toEqual([{ t: 'honor', who: { side: 0, slot: 0 }, delta: -1, honorAfter: -1, reason: 'dirtyTrick' }]);
    expect(activeOf(dirty.state, 0).creature.honor).toBe(-1);
    const clean = turn(st, move(POKE.id), move(NOOP.id));
    expect(eventsOf(clean.events, 'honor')).toEqual([]);
    expect(activeOf(clean.state, 0).creature.honor).toBeUndefined();
  });

  it('knocking out a wild creature costs 1; winning a trainer duel earns 2, just before battleEnd', () => {
    const wild = startBattle({ a: CUB(), b: FOE(), format: 'wild', seed: 'h2' }).state;
    const ko = turn(wild, move(BIG.id), move(NOOP.id));
    expect(eventsOf(ko.events, 'honor').map((e) => [e.reason, e.honorAfter])).toEqual([['wildKo', -1]]);
    const duel = startBattle({ a: CUB(), b: FOE(), seed: 'h3' }).state;
    const won = turn(duel, move(BIG.id), move(NOOP.id));
    expect(won.state.ended).toEqual({ winner: 0 });
    expect(eventsOf(won.events, 'honor').map((e) => [e.reason, e.honorAfter])).toEqual([['duelWon', 2]]);
    const types = won.events.map((e) => e.t);
    expect(types.indexOf('honor')).toBe(types.indexOf('battleEnd') - 1);
  });

  it('catching a wild creature spares it: +1 for the battler on the field', () => {
    const r = findSeed((seed) => {
      const st = startBattle({ a: CUB(), b: FOE({ hp: 1 }), format: 'wild', seed }).state;
      const t = turn(st, catchWith('aether_orb'), null);
      const end = t.state.ended;
      return end !== null && end.winner === 'caught' ? t : null;
    });
    expect(eventsOf(r.events, 'honor').map((e) => [e.reason, e.delta, e.honorAfter])).toEqual([['spared', 1, 1]]);
  });

  it('clamps at ±10 (no event at the clamp) and never moves in the tower', () => {
    const top = startBattle({ a: CUB({ honor: HONOR_MAX }), b: FOE(), seed: 'h4' }).state;
    const won = turn(top, move(BIG.id), move(NOOP.id));
    expect(eventsOf(won.events, 'honor')).toEqual([]);
    expect(activeOf(won.state, 0).creature.honor).toBe(HONOR_MAX);
    const low = startBattle({ a: CUB({ honor: HONOR_MIN }), b: FOE(), seed: 'h5' }).state;
    expect(eventsOf(turn(low, move(DIRTY.id), move(NOOP.id)).events, 'honor')).toEqual([]);
    const tower: BattleState = { ...startBattle({ a: CUB(), b: FOE(), seed: 'h6' }).state, noExp: true };
    expect(eventsOf(turn(tower, move(BIG.id), move(NOOP.id)).events, 'honor')).toEqual([]);
  });

  it('a foe never keeps a ledger, and a battle without a tracker never gains the field', () => {
    const st = startBattle({ a: FOE({ moves: [NOOP.id] }), b: CUB(), seed: 'h7' }).state;
    expect(eventsOf(turn(st, move(NOOP.id), move(DIRTY.id)).events, 'honor')).toEqual([]);
    const plain = startBattle({ a: FOE({ moves: [BIG.id] }), b: FOE(), seed: 'h8' }).state;
    expect(canonicalJson(turn(plain, move(BIG.id), move(NOOP.id)).state)).not.toContain('honor');
  });

  it('at the split level the ledger picks the branch: honor ≥ 0 the first, below 0 the default', () => {
    expect(evolutionTarget(SPLIT, 'Natural Cure')).toBe('wooltug');
    expect(evolutionTarget(SPLIT, 'Natural Cure', 0)).toBe('wooltug');
    expect(evolutionTarget(SPLIT, 'Natural Cure', 7)).toBe('wooltug');
    expect(evolutionTarget(SPLIT, 'Natural Cure', -1)).toBe('rambull');
    const cub = activeOf(startBattle({ a: CUB({ level: 29 }), b: FOE(), seed: 'h9' }).state, 0).creature;
    const toward = (honor: number | undefined): string | null =>
      applyExp({ ...cub, ...(honor === undefined ? {} : { honor }) }, expToLevel(30) - cub.exp, content).evolveReady;
    expect(toward(undefined)).toBe('wooltug');
    expect(toward(3)).toBe('wooltug');
    expect(toward(-4)).toBe('rambull');
  });
});
