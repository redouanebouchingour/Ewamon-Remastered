/**
 * A recurring rival (data/rival.ts): a stable identity per seed with a signature line against the player's starter,
 * real looks and species, the arc by badges and record, the signature evolving with the badges, the team size and the
 * level lead, the trainer id round trip.
 */
import { describe, expect, it } from 'vitest';
import {
  LOOKS,
  RIVAL_COUNTER,
  RIVAL_LOOKS,
  RIVAL_NAMES,
  RIVAL_TEMPERAMENTS,
  SPECIES,
  allZones,
  isRivalTrainer,
  rivalArc,
  rivalIdentity,
  rivalLevelLead,
  rivalNameOf,
  rivalReward,
  rivalTeamSize,
  rivalTrainerId,
  signatureSpecies,
} from '../src/index';

describe('rival identity', () => {
  it('is the same for a seed, varies across seeds, and draws only real looks', () => {
    expect(rivalIdentity('w:p1:rival', 'glimfin')).toEqual(rivalIdentity('w:p1:rival', 'glimfin'));
    const seen = new Set(Array.from({ length: 40 }, (_, i) => JSON.stringify(rivalIdentity(`w:p${i}:rival`, null))));
    expect(seen.size).toBeGreaterThan(10);
    for (const l of RIVAL_LOOKS) expect(LOOKS).toContain(l);
    for (let i = 0; i < 40; i++) {
      const r = rivalIdentity(`w:p${i}:rival`, null);
      expect(RIVAL_NAMES).toContain(r.name);
      expect(RIVAL_TEMPERAMENTS).toContain(r.temperament);
      expect(Object.keys(RIVAL_COUNTER)).toContain(r.signature);
    }
  });

  it('picks the starter strong against the player starter', () => {
    expect(rivalIdentity('s', 'bramblecub').signature).toBe('cindercap');
    expect(rivalIdentity('s', 'glimfin').signature).toBe('bramblecub');
    expect(rivalIdentity('s', 'cindercap').signature).toBe('glimfin');
  });

  it('never takes a name the world already uses', () => {
    const names = new Set<string>();
    for (const z of allZones()) for (const x of [...z.npcs, ...z.trainers]) for (const w of x.name.split(/[\s,]+/)) names.add(w);
    for (const n of RIVAL_NAMES) expect(names.has(n)).toBe(false);
    for (const n of RIVAL_NAMES) expect(SPECIES.some((s) => s.name === n)).toBe(false);
  });
});

describe('rival arc and team', () => {
  it('is cocky early, frustrated when the player is ahead, respectful near the end', () => {
    expect(rivalArc(1, { playerWins: 0, rivalWins: 0 })).toBe('cocky');
    expect(rivalArc(2, { playerWins: 1, rivalWins: 2 })).toBe('cocky');
    expect(rivalArc(2, { playerWins: 1, rivalWins: 0 })).toBe('frustrated');
    expect(rivalArc(4, { playerWins: 3, rivalWins: 0 })).toBe('respectful');
    expect(rivalArc(6, { playerWins: 0, rivalWins: 5 })).toBe('respectful');
  });

  it('evolves the signature line with the badges', () => {
    expect(signatureSpecies('bramblecub', 1)).toBe('bramblecub');
    expect(signatureSpecies('bramblecub', 3)).toBe('briarbear');
    expect(signatureSpecies('bramblecub', 8)).toBe('thornback');
    expect(signatureSpecies('glimfin', 6)).toBe('abysspark');
    expect(signatureSpecies('cindercap', 4)).toBe('pyrecap');
  });

  it('grows the team with the badges and leads by the record', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(rivalTeamSize)).toEqual([2, 2, 3, 3, 4, 4, 5, 5]);
    expect(rivalLevelLead({ playerWins: 0, rivalWins: 2 })).toBe(2);
    expect(rivalLevelLead({ playerWins: 1, rivalWins: 1 })).toBe(1);
    expect(rivalLevelLead({ playerWins: 3, rivalWins: 1 })).toBe(0);
    expect(rivalReward(14)).toBe(700);
    expect(rivalReward(2)).toBe(200);
  });

  it('round-trips the trainer id', () => {
    expect(rivalTrainerId('Corin')).toBe('rival:Corin');
    expect(isRivalTrainer('rival:Corin')).toBe(true);
    expect(isRivalTrainer('ghost:Corin')).toBe(false);
    expect(rivalNameOf('rival:Corin')).toBe('Corin');
    expect(rivalNameOf('mire_route.hiker')).toBeNull();
  });
});
