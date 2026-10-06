/**
 * Phase D3 — stone (`item`) and `trade` evolutions. Level evolutions are untouched (exp.test.ts and the committed
 * fuzz digests cover them); the new kinds are never level-triggered and resolve only through their own helpers.
 */
import { describe, expect, it } from 'vitest';
import { applyExp, evolutionChildren, evolve, expToLevel, itemEvolutionTarget, tradeEvolutionTarget } from '../src/index';
import type { ContentIndex, Evolution, SpeciesDef } from '../src/index';
import { content, creature } from './helpers';

/** The legacy content with smellduck's evolution replaced. */
function withEvolution(evolution: Evolution): ContentIndex {
  const base = content.species('smellduck');
  const patched: SpeciesDef = { ...base, evolution };
  return { ...content, species: (id: string) => (id === 'smellduck' ? patched : content.species(id)) };
}

describe('Phase D3 evolution conditions', () => {
  it('a stone evolution resolves for its own stone only, at any level', () => {
    const evo: Evolution = { kind: 'item', item: 'verdant_stone', into: 'bloomduck' };
    expect(itemEvolutionTarget(evo, 'verdant_stone')).toBe('bloomduck');
    expect(itemEvolutionTarget(evo, 'ember_stone')).toBeNull();
    expect(itemEvolutionTarget({ kind: 'level', into: 'bloomduck', atLevel: 20 }, 'verdant_stone')).toBeNull();
    expect(itemEvolutionTarget(null, 'verdant_stone')).toBeNull();
    expect(tradeEvolutionTarget(evo)).toBeNull();
  });

  it('a trade evolution resolves through tradeEvolutionTarget only', () => {
    const evo: Evolution = { kind: 'trade', into: 'bloomduck' };
    expect(tradeEvolutionTarget(evo)).toBe('bloomduck');
    expect(tradeEvolutionTarget({ kind: 'level', into: 'bloomduck', atLevel: 20 })).toBeNull();
    expect(itemEvolutionTarget(evo, 'verdant_stone')).toBeNull();
  });

  it('applyExp never reports evolveReady for item / trade evolutions, even at level 100', () => {
    for (const evo of [{ kind: 'item', item: 'verdant_stone', into: 'bloomduck' }, { kind: 'trade', into: 'bloomduck' }] as const) {
      const c = withEvolution(evo);
      const mon = creature({ species: 'smellduck', level: 19 });
      const r = applyExp(mon, expToLevel(100), c);
      expect(r.creature.level).toBe(100);
      expect(r.evolveReady).toBeNull();
    }
  });

  it('level evolutions still report evolveReady exactly as before', () => {
    const mon = creature({ species: 'smellduck', level: 19 });
    expect(applyExp(mon, expToLevel(20) - mon.exp, content).evolveReady).toBe('bloomduck');
  });

  it('evolutionChildren lists every target whatever the trigger', () => {
    expect(evolutionChildren(null)).toEqual([]);
    expect(evolutionChildren({ kind: 'level', into: 'a', atLevel: 5 })).toEqual(['a']);
    expect(evolutionChildren({ kind: 'item', item: 's', into: 'b' })).toEqual(['b']);
    expect(evolutionChildren({ kind: 'trade', into: 'c' })).toEqual(['c']);
    expect(evolutionChildren({ kind: 'split', atLevel: 5, branches: [{ into: 'x', condition: { kind: 'ability', ability: 'A' } }, { into: 'y', condition: null }] })).toEqual(['x', 'y']);
  });

  it('evolve() is trigger-agnostic: the species swap is the same for a stone evolution', () => {
    const c = withEvolution({ kind: 'item', item: 'verdant_stone', into: 'bloomduck' });
    const mon = creature({ species: 'smellduck', level: 7 });
    const e = evolve(mon, 'bloomduck', c);
    expect(e.speciesId).toBe('bloomduck');
    expect(e.level).toBe(7);
    expect(e.moves).toEqual(mon.moves);
  });
});
