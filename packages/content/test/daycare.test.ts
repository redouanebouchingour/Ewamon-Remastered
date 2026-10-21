/**
 * Breeding (data/daycare.ts): who can breed (one family or a shared type, never a legendary), what hatches (the first
 * parent's first stage), egg moves, the inherited honor / coat / ability slot, the bandborn pairs, and the Daycare in
 * the interiors layer (Mirevale house 1, same hall, its resident the keeper).
 */
import { describe, expect, it } from 'vitest';
import type { SpeciesDef } from '@ewa/core';
import { DAYCARE, EGG_STEPS, SPECIES, breedRefusal, canInheritMove, eggAbility, eggHonor, eggMoves, eggSpecies, eggSteps, eggVariant, hatchMoves, interiorNpcs, interiorsFor, isBandbornPair } from '../src/index';
import { houseHall } from '../src/data/interiors';

const sp = (id: string): SpeciesDef => SPECIES.find((s) => s.id === id)!;

describe('breeding rules', () => {
  it('one family or a shared type breeds; legendaries never do', () => {
    expect(breedRefusal(sp('badlander'), sp('lawlander'))).toBeNull(); // one family (dustcub)
    expect(breedRefusal(sp('dustcub'), sp('lawlander'))).toBeNull();
    expect(breedRefusal(sp('infernomorel'), sp('solpyre'))).toBeNull(); // Fire
    const legend = SPECIES.find((s) => s.legendary)!;
    const sameType = SPECIES.find((s) => !s.legendary && s.types.some((t) => (legend.types as readonly string[]).includes(t)))!;
    expect(breedRefusal(legend, sameType)).toBe('legendary');
    expect(breedRefusal(sp('dustcub'), sp('glimmereen'))).toBe('unrelated'); // Ground and Fairy
    // every non-legendary species has someone to breed with
    for (const s of SPECIES.filter((x) => !x.legendary)) expect(SPECIES.some((o) => o.id !== s.id && breedRefusal(s, o) === null), s.id).toBe(true);
  });

  it('the egg is the first stage of the first parent\'s family', () => {
    expect(eggSpecies(sp('lawlander'))).toBe('dustcub');
    expect(eggSpecies(sp('dustcub'))).toBe('dustcub');
    for (const s of SPECIES.filter((x) => !x.legendary)) expect(sp(eggSpecies(s)).evolvesFrom).toBeNull();
  });

  it('a Majin-form parent with a Tenjin-form parent is a bandborn pair', () => {
    expect(isBandbornPair(sp('badlander'), sp('lawlander'))).toBe(true);
    expect(isBandbornPair(sp('lawlander'), sp('badlander'))).toBe(true);
    expect(isBandbornPair(sp('badlander'), sp('badlander'))).toBe(false);
    expect(isBandbornPair(sp('dustcub'), sp('lawlander'))).toBe(false);
  });

  it('egg moves: what a parent knows that the hatchling learns by level-up or TM, at most four, in place of the oldest', () => {
    const cub = sp('dustcub');
    expect(canInheritMove(cub, 'Crunch')).toBe(true); // level 30
    expect(canInheritMove(cub, 'Earthquake')).toBe(true); // a Ground TM
    expect(canInheritMove(cub, 'Body Slam')).toBe(true); // a Normal TM
    expect(canInheritMove(cub, 'Mach Punch')).toBe(false); // Fighting, not in its learnset
    expect(eggMoves(cub, [['Crunch', 'Mach Punch'], ['Earthquake', 'Crunch', 'Protect']])).toEqual(['Crunch', 'Earthquake', 'Protect']);
    expect(eggMoves(cub, [['Crunch', 'Earthquake', 'Body Slam', 'Protect'], ['Bulldoze']])).toHaveLength(4);
    expect(hatchMoves(['Tackle', 'Sand Attack', 'Mud-Slap', 'Dark Lasso'], ['Crunch', 'Earthquake'])).toEqual(['Mud-Slap', 'Dark Lasso', 'Crunch', 'Earthquake']);
    expect(hatchMoves(['Tackle'], ['Crunch'])).toEqual(['Tackle', 'Crunch']);
    expect(hatchMoves(['Tackle', 'Crunch'], ['Crunch'])).toEqual(['Tackle', 'Crunch']);
  });

  it('honor is the parents\' average; coat and ability slot come from the first parent', () => {
    expect(eggHonor(6, 2)).toBe(4);
    expect(eggHonor(3, undefined)).toBe(2); // 1.5 rounds away from zero
    expect(eggHonor(-3, 0)).toBe(-2);
    expect(eggHonor(10, 10)).toBe(10);
    expect(eggVariant('dusk', 'ember')).toBe('dusk');
    expect(eggVariant('normal', 'ember')).toBe('ember');
    expect(eggAbility(sp('dustcub'), sp('lawlander'), sp('lawlander').abilities[1] ?? sp('lawlander').abilities[0]!)).toBe(sp('dustcub').abilities[sp('lawlander').abilities.length > 1 ? 1 : 0]);
    expect(eggAbility(sp('dustcub'), sp('lawlander'), 'not-an-ability')).toBe(sp('dustcub').abilities[0]);
    expect(eggSteps(sp('dustcub'))).toBe(EGG_STEPS.uncommon);
  });
});

describe('the Daycare', () => {
  it('Mirevale house 1 is the Daycare: the same hall, its resident the keeper', () => {
    const p = interiorsFor(DAYCARE.zoneId).find((x) => x.def.id === DAYCARE.building)!;
    expect(p.def.label).toBe('the Daycare');
    expect(p.def.npcs.map((n) => [n.id, n.role])).toEqual([[DAYCARE.keeperId, 'daycare']]);
    const plain = houseHall(DAYCARE.zoneId, DAYCARE.building, 'the house', p.def.template === 'house_s' ? 's' : 'm', 0);
    expect([p.def.w, p.def.d, p.def.walls, p.def.props, p.def.items]).toEqual([plain.w, plain.d, plain.walls, plain.props, plain.items]);
    expect(interiorNpcs(DAYCARE.zoneId).some((n) => n.id === DAYCARE.keeperId && n.role === 'daycare')).toBe(true);
    // the only one
    for (const z of ['cinderhold', 'saltmourn', 'solenne'] as const) expect(interiorNpcs(z).some((n) => n.role === 'daycare')).toBe(false);
  });
});
