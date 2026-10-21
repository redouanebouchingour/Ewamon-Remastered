/**
 * Nemeses (data/nemesis.ts): the chances by shadow level, the fair fight level, the scars, names and titles that fit a
 * nickname, the gained move, and the taunts.
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '@ewa/core';
import type { SpeciesDef, TypeName } from '@ewa/core';
import {
  NEMESIS_AMBUSH_CHANCE,
  NEMESIS_PROMOTE_CHANCE,
  NEMESIS_SCARS,
  NEMESIS_SCAR_TEXT,
  SPECIES,
  nemesisAmbushChance,
  nemesisFightLevel,
  nemesisFullName,
  nemesisMove,
  nemesisMoves,
  nemesisName,
  nemesisPromoteChance,
  nemesisScarRibbon,
  nemesisTaunt,
  scarOf,
  scarOfRibbons,
} from '../src/index';

const sp = (id: string): SpeciesDef => SPECIES.find((s) => s.id === id)!;
const TYPES: readonly TypeName[] = ['Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Steel', 'Fairy', 'Dark', 'Cosmic'];

describe('nemeses', () => {
  it('a darker zone promotes and ambushes more often; level 4 always promotes', () => {
    for (let l = 1; l < 5; l++) {
      expect(nemesisPromoteChance(l)).toBeGreaterThan(nemesisPromoteChance(l - 1));
      expect(nemesisAmbushChance(l)).toBeGreaterThan(nemesisAmbushChance(l - 1));
    }
    expect(nemesisPromoteChance(4)).toBe(1);
    expect(nemesisPromoteChance(99)).toBe(NEMESIS_PROMOTE_CHANCE[4]);
    expect(nemesisAmbushChance(-1)).toBe(NEMESIS_AMBUSH_CHANCE[0]);
  });

  it('an ambush fights near the lead: never more than 3 above, never more than 2 below', () => {
    expect(nemesisFightLevel(30, 10)).toBe(13);
    expect(nemesisFightLevel(4, 20)).toBe(18);
    expect(nemesisFightLevel(21, 20)).toBe(21);
    expect(nemesisFightLevel(5, 1)).toBe(4);
    expect(nemesisFightLevel(100, 100)).toBe(100);
  });

  it('the scar tells how it won; a caught nemesis keeps it as a ribbon', () => {
    expect(scarOf('breakout', 'Fire')).toBe('torn_ear');
    expect(scarOf('ko', 'Fire')).toBe('burn');
    expect(scarOf('ko', 'Rock')).toBe('cracked_horn');
    expect(scarOf('ko', null)).toBe('cracked_horn');
    for (const t of TYPES) expect(NEMESIS_SCARS).toContain(scarOf('ko', t));
    for (const s of NEMESIS_SCARS) {
      expect(scarOfRibbons(['fallen', nemesisScarRibbon(s)])).toBe(s);
      expect(NEMESIS_SCAR_TEXT[s].label.length).toBeGreaterThan(0);
    }
    expect(scarOfRibbons(['nemesis-scar:nope', 'fallen'])).toBeNull();
  });

  it('every name fits a nickname (16) and the titles read "<name> the <word>"', () => {
    for (const t of TYPES) {
      for (let i = 0; i < 40; i++) {
        const n = nemesisName(createRng(`${t}:${i}`), [t], i % 2 === 0 ? 'ko' : 'breakout');
        expect(n.name.length).toBeLessThanOrEqual(16);
        expect(n.name).toMatch(/^[A-Z][a-z]+$/);
        expect(n.title).toMatch(/^the [A-Z]/);
        expect(nemesisFullName(n)).toBe(`${n.name} ${n.title}`);
      }
    }
    // it avoids a name the trainer's other nemeses already have when it can
    const first = nemesisName(createRng('same'), ['Dark'], 'ko');
    expect(nemesisName(createRng('same'), ['Dark'], 'ko', [first.name]).name).not.toBe(first.name);
  });

  it('it gains the next move its learnset teaches above its level, else a TM it can learn', () => {
    const s = sp('dustcub');
    const next = [...s.learnableMoves].sort((a, b) => a.level - b.level).find((e) => e.level > 5)!;
    expect(nemesisMove(s, 5, [], createRng('m'))).toBe(next.move);
    const top = Math.max(...s.learnableMoves.map((e) => e.level));
    const tm = nemesisMove(s, top, [], createRng('m'));
    expect(tm).not.toBeNull();
    expect(nemesisMoves(['A', 'B', 'C', 'D'], 'E')).toEqual(['B', 'C', 'D', 'E']);
    expect(nemesisMoves(['A', 'B'], 'B')).toEqual(['A', 'B']);
    expect(nemesisMoves(['A'], null)).toEqual(['A']);
  });

  it('the taunt names the last fight, and says more at a higher rank', () => {
    const ko = { how: 'ko' as const, zoneId: 'mire_route', foeSpecies: 'pyrekit', foeName: null, move: 'Ember', orb: null };
    const names = { foe: 'Pyrekit', orb: null, zone: 'Mire Route' };
    expect(nemesisTaunt('Scarjaw', 1, ko, names)).toBe('Scarjaw remembers your Pyrekit. It remembers Ember.');
    expect(nemesisTaunt('Scarjaw', 2, ko, names)).toContain('Mire Route');
    expect(nemesisTaunt('Scarjaw', 4, ko, names)).toContain('4 times');
    const out = { ...ko, how: 'breakout' as const, move: null, orb: 'great_orb' };
    expect(nemesisTaunt('Scarjaw', 1, out, { ...names, orb: 'Great Orb' })).toBe('Scarjaw remembers your Great Orb. It broke out once. It will again.');
    for (let r = 1; r <= 5; r++) for (const m of [ko, out]) expect(nemesisTaunt('Scarjaw', r, m, names)).not.toContain(String.fromCharCode(0x2014));
  });
});
