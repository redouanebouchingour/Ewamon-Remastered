import { describe, expect, it } from 'vitest';
import { MAX_LEVEL, applyExp, calcMaxHp, evolve, expGain, expToLevel, levelForExp } from '../src/index';
import { content, creature } from './helpers';

describe('§2.16 exp curve', () => {
  it('expToLevel(l) === l³ for 1..100; expToLevel(100) === 1_000_000', () => {
    for (let l = 1; l <= 100; l++) expect(expToLevel(l)).toBe(l ** 3);
    expect(expToLevel(1)).toBe(1);
    expect(expToLevel(MAX_LEVEL)).toBe(1_000_000);
  });

  it('levelForExp is the inverse over 0..1_000_000 step 997 and caps at 100', () => {
    for (let exp = 0; exp <= 1_000_000; exp += 997) {
      const l = levelForExp(exp);
      expect(l).toBeGreaterThanOrEqual(1);
      expect(l).toBeLessThanOrEqual(100);
      expect(expToLevel(l)).toBeLessThanOrEqual(Math.max(1, exp));
      if (l < 100) expect(expToLevel(l + 1)).toBeGreaterThan(exp);
    }
    expect(levelForExp(0)).toBe(1);
    expect(levelForExp(7)).toBe(1);
    expect(levelForExp(8)).toBe(2);
    expect(levelForExp(999_999)).toBe(99);
    expect(levelForExp(1_000_000)).toBe(100);
    expect(levelForExp(5_000_000)).toBe(100);
  });

  it('expGain: floor(expYield * level / 7), ×3/2 only for trainer/league/pvp foes', () => {
    const sp = content.species('smellduck'); // expYield 60
    expect(expGain(sp, 10, false)).toBe(Math.floor((60 * 10) / 7)); // 85
    expect(expGain(sp, 10, true)).toBe(Math.floor((85 * 3) / 2)); // 127
    expect(expGain(sp, 1, false)).toBe(8);
    expect(expGain(sp, 1, true)).toBe(12);
    for (const s of content.allSpecies()) {
      for (const l of [5, 37, 100]) {
        const wild = expGain(s, l, false);
        const trainer = expGain(s, l, true);
        expect(trainer).toBe(Math.floor((wild * 3) / 2));
      }
    }
  });
});

describe('§2.16 applyExp', () => {
  it('returns a contiguous levelsGained list, raises hp by the maxHp delta, updates exp', () => {
    const c = creature({ species: 'bramblecub', level: 10, hp: 20 });
    const sp = content.species('bramblecub');
    const before = calcMaxHp(sp.baseHp, 10);
    const target = expToLevel(13) + 5;
    const r = applyExp(c, target - c.exp, content);
    expect(r.levelsGained).toEqual([11, 12, 13]);
    expect(r.creature.level).toBe(13);
    expect(r.creature.exp).toBe(target);
    expect(r.creature.hp).toBe(20 + (calcMaxHp(sp.baseHp, 13) - before));
    expect(c.level).toBe(10); // pure
  });

  it('no level-up → empty lists, evolveReady null', () => {
    const c = creature({ species: 'bramblecub', level: 10 });
    const r = applyExp(c, 1, content);
    expect(r.levelsGained).toEqual([]);
    expect(r.learnable).toEqual([]);
    expect(r.evolveReady).toBeNull();
    expect(r.creature.exp).toBe(c.exp + 1);
  });

  it('learnable lists only moves reached in (old, new] that are not already known', () => {
    const sp = content.species('smellduck');
    // learnset: 4 defaults at 1, Solar Absorb at 6, Sunny Day at 21 (see fixture)
    const c = creature({ species: 'smellduck', level: 5, moves: ['Peck', 'Leaf Blade', 'Stink Cloud', 'Sunny Day'] });
    const r = applyExp(c, expToLevel(21) - c.exp, content);
    expect(r.levelsGained[0]).toBe(6);
    expect(r.levelsGained[r.levelsGained.length - 1]).toBe(21);
    const learnLevels = sp.learnableMoves.filter((e) => e.level > 5 && e.level <= 21).map((e) => e.move);
    expect(learnLevels).toContain('Solar Absorb');
    expect(learnLevels).toContain('Sunny Day');
    // Sunny Day already known → filtered out; Solar Absorb reachable
    expect(r.learnable).toEqual([{ level: 6, move: 'Solar Absorb' }]);
  });

  it('evolveReady at evolution.atLevel for a level evolution', () => {
    const c = creature({ species: 'smellduck', level: 19 });
    expect(content.species('smellduck').evolution).toEqual({ kind: 'level', into: 'bloomduck', atLevel: 20 });
    expect(applyExp(c, expToLevel(20) - c.exp, content).evolveReady).toBe('bloomduck');
    expect(applyExp(c, expToLevel(20) - c.exp - 1, content).evolveReady).toBeNull();
  });

  it('darkone split resolves by ability: Lightning Rod → aonred, otherwise → darkyon', () => {
    const rod = creature({ species: 'darkone', level: 19, ability: 'Lightning Rod' });
    const comp = creature({ species: 'darkone', level: 19, ability: 'Competitive' });
    expect(applyExp(rod, expToLevel(20) - rod.exp, content).evolveReady).toBe('aonred');
    expect(applyExp(comp, expToLevel(20) - comp.exp, content).evolveReady).toBe('darkyon');
    const branches = content.species('darkone').evolution;
    expect(branches?.kind).toBe('split');
    if (branches?.kind === 'split') expect(branches.branches[branches.branches.length - 1]!.condition).toBeNull();
  });

  it('exp is capped at expToLevel(100) and level at 100', () => {
    const c = creature({ species: 'bramblecub', level: 98 });
    const r = applyExp(c, 10 ** 9, content);
    expect(r.creature.exp).toBe(1_000_000);
    expect(r.creature.level).toBe(100);
    expect(r.levelsGained).toEqual([99, 100]);
    const again = applyExp(r.creature, 500, content);
    expect(again.creature.exp).toBe(1_000_000);
    expect(again.levelsGained).toEqual([]);
  });

  it('negative or fractional gains are floored to ≥ 0', () => {
    const c = creature({ species: 'bramblecub', level: 10 });
    expect(applyExp(c, -50, content).creature.exp).toBe(c.exp);
    expect(applyExp(c, 2.9, content).creature.exp).toBe(c.exp + 2);
  });
});

describe('§2.16 evolve', () => {
  it('swaps species, keeps moves, scales hp by the maxHp ratio', () => {
    const c = creature({ species: 'smellduck', level: 20, hp: 30 });
    const oldMax = calcMaxHp(content.species('smellduck').baseHp, 20);
    const newMax = calcMaxHp(content.species('bloomduck').baseHp, 20);
    const e = evolve(c, 'bloomduck', content);
    expect(e.speciesId).toBe('bloomduck');
    expect(e.moves).toEqual(c.moves);
    expect(e.level).toBe(20);
    expect(e.hp).toBe(Math.floor((30 * newMax) / oldMax));
    expect(e.id).toBe(c.id);
  });

  it('keeps a custom nickname; resets a nickname equal to the old species name', () => {
    const custom = creature({ species: 'smellduck', level: 20, nickname: 'Quackers' });
    expect(evolve(custom, 'bloomduck', content).nickname).toBe('Quackers');
    const speciesNamed = creature({ species: 'smellduck', level: 20, nickname: 'Smellduck' });
    expect(evolve(speciesNamed, 'bloomduck', content).nickname).toBeNull();
    const none = creature({ species: 'smellduck', level: 20, nickname: null });
    expect(evolve(none, 'bloomduck', content).nickname).toBeNull();
  });

  it('a fainted creature stays at 0; a 1-hp creature never rounds to 0', () => {
    expect(evolve(creature({ species: 'smellduck', level: 20, hp: 0 }), 'bloomduck', content).hp).toBe(0);
    expect(evolve(creature({ species: 'smellduck', level: 20, hp: 1 }), 'bloomduck', content).hp).toBeGreaterThanOrEqual(1);
  });

  it('keeps the ability when the new species has it, else falls back to the new default', () => {
    const rod = creature({ species: 'darkone', level: 20, ability: 'Lightning Rod' });
    const e = evolve(rod, 'aonred', content);
    const aon = content.species('aonred');
    expect(aon.abilities).toContain(e.ability);
  });
});
