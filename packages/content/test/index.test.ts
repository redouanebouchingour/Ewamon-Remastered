import { describe, expect, it } from 'vitest';
import {
  ABILITIES,
  CONSUMABLES,
  ITEMS,
  MOVES,
  ORBS,
  SPECIES,
  TYPE_CHART,
  createContentIndex,
  encounterTable,
  encounterTableFor,
  league,
  quest,
  storyBeat,
  zone,
} from '../src/index';

describe('createContentIndex()', () => {
  const idx = createContentIndex();

  it('round-trips every species, move, ability, item, consumable and orb by id', () => {
    for (const s of SPECIES) expect(idx.species(s.id)).toBe(s);
    for (const m of MOVES) expect(idx.move(m.id)).toBe(m);
    for (const a of ABILITIES) expect(idx.ability(a.id)).toBe(a);
    for (const i of ITEMS) expect(idx.item(i.id)).toBe(i);
    for (const c of CONSUMABLES) expect(idx.item(c.id)).toBe(c);
    for (const o of ORBS) expect(idx.orb(o.id)).toBe(o);
    expect(idx.typeChart).toBe(TYPE_CHART);
  });

  it('allSpecies() is sorted by dexNumber and has 144 rows', () => {
    const all = idx.allSpecies();
    expect(all.length).toBe(144);
    for (let i = 1; i < all.length; i++) expect(all[i]!.dexNumber).toBeGreaterThan(all[i - 1]!.dexNumber);
    expect(all[0]!.id).toBe('smellduck');
  });

  it('throws RangeError on unknown ids', () => {
    expect(() => idx.species('nope')).toThrow(RangeError);
    expect(() => idx.move('nope')).toThrow(RangeError);
    expect(() => idx.ability('nope')).toThrow(RangeError);
    expect(() => idx.item('nope')).toThrow(RangeError);
    expect(() => idx.orb('nope')).toThrow(RangeError);
  });

  it('every species default move and ability resolves through the index', () => {
    for (const s of idx.allSpecies()) {
      for (const m of s.moves) expect(() => idx.move(m)).not.toThrow();
      for (const e of s.learnableMoves) expect(() => idx.move(e.move)).not.toThrow();
      for (const a of s.abilities) expect(() => idx.ability(a)).not.toThrow();
    }
  });

  it('the darkone split (by ability) and the dustcub and cryptorb ones (by honor) are the three split evolutions, null branch last', () => {
    const d = idx.species('darkone');
    expect(d.evolution?.kind).toBe('split');
    if (d.evolution?.kind === 'split') {
      expect(d.evolution.atLevel).toBe(20);
      expect(d.evolution.branches.map((b) => b.into)).toEqual(['aonred', 'darkyon']);
      expect(d.evolution.branches[0]!.condition).toEqual({ kind: 'ability', ability: 'Lightning Rod' });
      expect(d.evolution.branches[1]!.condition).toBeNull();
    }
    expect(SPECIES.filter((s) => s.evolution?.kind === 'split').map((s) => s.id)).toEqual(['darkone', 'dustcub', 'cryptorb']);
  });

  it('world accessors resolve and throw on unknown ids', () => {
    expect(zone('mirevale').name).toBe('Mirevale');
    expect(encounterTable('enc_mire_route').zoneId).toBe('mire_route');
    expect(encounterTableFor('mirevale')).toBeNull();
    expect(encounterTableFor('saltmourn')?.id).toBe('enc_saltmourn');
    expect(league('zeon').stage).toBe('champion');
    expect(quest('q01_first_witness').zoneId).toBe('mirevale');
    expect(storyBeat('first_witness').starter).toBe(true);
    expect(() => league('goku')).toThrow(RangeError);
  });
});
