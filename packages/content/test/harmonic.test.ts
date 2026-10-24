/**
 * The Harmonic Cycle: the mythical Elemutt line (elemutt → katamute → ravatar), ravatar's five relic forms, the relics,
 * quests q13 (the pup, early) and q14 (the Vial, after the four shrine guardians), and the four relic shrines.
 */
import { describe, expect, it } from 'vitest';
import {
  ABILITIES,
  MOVES,
  MYTHICAL_IDS,
  POSTGAME_FLAG,
  QUESTS,
  RELICS,
  SHRINES,
  SPECIES,
  SPIRIT_WATER_VIAL,
  getHeightfield,
  interiorsFor,
  shrineGuardianId,
} from '../src/index';
import { itemsOf, reachNear, walkInterior } from '../src/interiors';

const sp = (id: string) => SPECIES.find((s) => s.id === id)!;

describe('the Elemutt line', () => {
  it('three mythical Normal species, dex 142..144, evolving at 16 and 36, one ability each', () => {
    expect(['elemutt', 'katamute', 'ravatar'].map((id) => sp(id).dexNumber)).toEqual([142, 143, 144]);
    for (const id of ['elemutt', 'katamute', 'ravatar']) {
      expect(sp(id).rarity).toBe('mythical');
      expect(sp(id).legendary).toBe(true);
      expect(sp(id).types).toEqual(['Normal']);
      expect(MYTHICAL_IDS).toContain(id);
    }
    expect(sp('elemutt').evolution).toEqual({ kind: 'level', into: 'katamute', atLevel: 16 });
    expect(sp('katamute').evolution).toEqual({ kind: 'level', into: 'ravatar', atLevel: 36 });
    expect([sp('elemutt').abilities, sp('katamute').abilities, sp('ravatar').abilities]).toEqual([['Inner Chi'], ['Stance Change'], ['Avatar Cycle']]);
  });

  it('ravatar: five relic forms, each opened by a held relic; the Avatar State only below 30%', () => {
    const forms = sp('ravatar').battleForms!;
    expect(forms.map((f) => f.id)).toEqual(['water', 'earth', 'fire', 'air', 'avatar']);
    expect(forms.map((f) => f.types)).toEqual([['Water'], ['Ground', 'Rock'], ['Fire'], ['Flying'], ['Normal', 'Psychic']]);
    const held = new Set(RELICS.filter((r) => r.slot === 'held').map((r) => r.id));
    for (const f of forms) {
      expect(held.has(f.heldItem!)).toBe(true);
      expect(f.kind).toBeUndefined();
      expect(f.sprite).toEqual({ front: `ravatar_${f.id}_front`, back: `ravatar_${f.id}_back` });
    }
    expect(forms.filter((f) => f.hpBelowPct !== undefined).map((f) => [f.id, f.hpBelowPct])).toEqual([['avatar', 30]]);
    expect(sp('ravatar').battleForm).toBeUndefined();
  });

  it('Cosmic Convergence: 100 power, never contact, form-typed, its raise only in the base form at 20%; learned by ravatar only', () => {
    const m = MOVES.find((x) => x.id === 'Cosmic Convergence')!;
    expect(m).toMatchObject({ type: 'Normal', power: 100, accuracy: 100, contact: false, effect: 'raise_all', effectChance: 20, typeFromForm: true, effectOnlyBaseForm: true });
    expect(SPECIES.filter((s) => s.learnableMoves.some((e) => e.move === m.id)).map((s) => s.id)).toEqual(['ravatar']);
    expect(sp('ravatar').learnableMoves.find((e) => e.move === m.id)?.level).toBe(40);
  });

  it('the three abilities carry their hooks', () => {
    const hooks = (id: string) => ABILITIES.find((a) => a.id === id)!.hooks;
    expect(hooks('Inner Chi')).toEqual([{ kind: 'modifyDamage', side: 'attacker', when: 'fullHp', contact: false, mul: 1.3 }]);
    expect(hooks('Stance Change')).toEqual([{ kind: 'afterMoveUsed', contact: { stat: 'def', stages: 1 }, nonContact: { stat: 'spd', stages: 1 }, cap: 2 }]);
    expect(hooks('Avatar Cycle')).toEqual([]);
  });
});

describe('quests q13 and q14', () => {
  it('q13: Act I in Mirevale after q01, rewards Elemutt at 5', () => {
    const q = QUESTS.find((x) => x.id === 'q13_unaligned_pup')!;
    expect([q.act, q.zoneId, q.requires, q.rewards.creature]).toEqual([1, 'mirevale', ['q01_first_witness'], { species: 'elemutt', level: 5 }]);
  });

  it('q14: the Champion and the four shrine guardians, rewards the Vial of Spirit Water', () => {
    const q = QUESTS.find((x) => x.id === 'q14_harmonic_cycle')!;
    const flags = q.objectives.map((o) => (o.objective.kind === 'flag' ? o.objective.flag : null));
    expect(flags).toEqual([POSTGAME_FLAG, ...SHRINES.map((s) => `trainer:${shrineGuardianId(s)}:beaten`)]);
    expect(q.rewards.items).toEqual({ [SPIRIT_WATER_VIAL]: 1 });
  });
});

describe('the relic shrines', () => {
  it('four shrines take over a 9 × 8 house hall in their town; the guardian waits for the Champion, the relic for the guardian', () => {
    expect(SHRINES.map((s) => s.zoneId)).toEqual(['saltmourn', 'marrowdig', 'cinderhold', 'skyrend']);
    expect(new Set(SHRINES.map((s) => s.relic)).size).toBe(4);
    for (const s of SHRINES) {
      const p = interiorsFor(s.zoneId).find((x) => x.def.id === s.building)!;
      expect(p.def).toMatchObject({ template: 'house_m', w: 9, d: 8, theme: s.theme, label: s.label, fightsAtDoor: true });
      const beaten = `trainer:${shrineGuardianId(s)}:beaten`;
      expect(p.def.gates.map((g) => g.opensWhen)).toEqual([[POSTGAME_FLAG], [beaten]]);
      expect(p.def.trainers.map((t) => t.requires)).toEqual([[POSTGAME_FLAG]]);
      expect(p.def.items.map((i) => [i.item, i.requires])).toEqual([[s.relic, [beaten]]]);
      for (const m of p.def.trainers[0]!.team) expect(sp(m.species).legendary).toBe(false);
    }
  });

  it('walking the hall: no relic without the Champion; with it, the guardian falls and the relic is in reach', () => {
    for (const s of SHRINES) {
      const p = interiorsFor(s.zoneId).find((x) => x.def.id === s.building)!;
      const h = getHeightfield(s.zoneId);
      const [relic] = itemsOf(p);
      const before = walkInterior(h, p, new Set());
      expect(before.order).toEqual([]);
      expect(reachNear(h, before.reach, relic!.x, relic!.z, 3)).toBe(false);
      const after = walkInterior(h, p, new Set([POSTGAME_FLAG]));
      expect(after.order).toEqual([shrineGuardianId(s)]);
      expect(reachNear(h, after.reach, relic!.x, relic!.z, 3)).toBe(true);
    }
  });
});
