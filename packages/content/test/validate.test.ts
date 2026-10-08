import { describe, expect, it } from 'vitest';
import { DEFAULT_TABLES, MOVES, SPECIES, validate } from '../src/index';

describe('validate()', () => {
  it('passes over the committed content with no errors', () => {
    const r = validate();
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.stats.roster.obtainable).toBe(131);
    expect(r.stats.roster.unobtainable).toEqual([]);
  });

  it('rewrote lower_spAtk to lower_atk on the defender (§2.4) and rejected weaknessPolicy', () => {
    expect(MOVES.some((m) => (m.effect as string) === 'lower_spAtk')).toBe(false);
    expect(MOVES.some((m) => (m.effect as string) === 'weaknessPolicy')).toBe(false);
    const moonblast = MOVES.find((m) => m.id === 'Moonblast');
    expect(moonblast?.effect).toBe('lower_atk');
    expect(moonblast?.target).toBe('foe');
  });

  it("'first' ⇔ priority 1", () => {
    for (const m of MOVES) expect(m.effect === 'first').toBe(m.priority === 1);
  });

  it('mutation: a dangling move reference fails validation and names the move', () => {
    const victim = SPECIES[0]!;
    const mutated = SPECIES.map((s) =>
      s === victim ? { ...s, learnableMoves: [...s.learnableMoves, { move: 'Abyssal Nova', level: 30 }] } : s,
    );
    const r = validate({ skipHeightfields: true }, { ...DEFAULT_TABLES, species: mutated });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes(victim.id) && e.includes('Abyssal Nova'))).toBe(true);
  });

  it('mutation: a species dropped from the tables breaks 131/131 coverage', () => {
    const r = validate({ skipHeightfields: true }, { ...DEFAULT_TABLES, species: SPECIES.slice(0, 130) });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('SPECIES.length 130'))).toBe(true);
  });

  it('mutation: a zone link that is not mirrored fails the graph check', () => {
    const zones = DEFAULT_TABLES.zones.map((z) => (z.id === 'mire_route' ? { ...z, links: { w: 'mirevale' as const } } : z));
    const r = validate({ skipHeightfields: true }, { ...DEFAULT_TABLES, zones });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('not mirrored'))).toBe(true);
  });

  it('mutation: a move with lower_spAtk left in place is rejected', () => {
    const moves = MOVES.map((m) => (m.id === 'Moonblast' ? { ...m, effect: 'lower_spAtk' as const } : m));
    const r = validate({ skipHeightfields: true }, { ...DEFAULT_TABLES, moves });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('lower_spAtk'))).toBe(true);
  });
});
