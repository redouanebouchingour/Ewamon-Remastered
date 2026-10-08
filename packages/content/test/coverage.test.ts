/**
 * Independent recomputation of spine rule 7 (roster-coverage Appendix A), written without roster.ts so a bug in
 * the shipped check cannot hide a coverage hole.
 */
import { describe, expect, it } from 'vitest';
import type { SpeciesDef } from '@ewa/core';
import {
  BATTLE_PASS,
  DAILY_SWARMS,
  ENCOUNTER_TABLES,
  LEGENDARY_STATICS,
  QUESTS,
  RAID_HOTSPOTS,
  SPECIES,
  validate,
} from '../src/index';

const byId = new Map<string, SpeciesDef>(SPECIES.map((s) => [s.id, s]));
// Phase D3: stone (`item`) and `trade` evolutions lead to their `into` like a level evolution
const children = (s: SpeciesDef): string[] =>
  s.evolution === null ? [] : s.evolution.kind === 'split' ? s.evolution.branches.map((b) => b.into) : [s.evolution.into];
const atLevel = (s: SpeciesDef): number => (s.evolution !== null && (s.evolution.kind === 'level' || s.evolution.kind === 'split') ? s.evolution.atLevel : 0);

describe('roster coverage (independent)', () => {
  const E = new Set<string>();
  for (const t of ENCOUNTER_TABLES) for (const s of t.slots) E.add(s.species);
  for (const sw of DAILY_SWARMS) for (const s of sw.species) E.add(s);
  for (const r of RAID_HOTSPOTS) E.add(r.boss.species);
  for (const q of QUESTS) if (q.rewards.creature) E.add(q.rewards.creature.species);
  for (const b of BATTLE_PASS) if (b.creature) E.add(b.creature.species);

  const R = new Set(E);
  let grew = true;
  while (grew) {
    grew = false;
    for (const id of [...R]) for (const c of children(byId.get(id)!)) if (!R.has(c)) { R.add(c); grew = true; }
  }
  for (const l of LEGENDARY_STATICS) R.add(l.species);
  for (const m of ['lumyth', 'noxmyth']) R.add(m);

  it('137/137 obtainable', () => {
    const missing = SPECIES.map((s) => s.id).filter((id) => !R.has(id));
    expect(missing).toEqual([]);
    expect(R.size).toBe(137);
  });

  it('83 directly placed: roster-coverage Appendix A reports 79, plus the post-legacy hollowmane, dustcub, veilpup and castlemaw', () => {
    expect(E.size).toBe(83);
  });

  it('71 roots; every non-legendary root spawns wild (RC-1); 61 families complete by level', () => {
    const roots = SPECIES.filter((s) => s.evolvesFrom === null);
    expect(roots.length).toBe(71);
    const legendary = new Set(SPECIES.filter((s) => s.legendary).map((s) => s.id));
    const wild = new Set(ENCOUNTER_TABLES.flatMap((t) => t.slots.map((s) => s.species)));
    const nonLeg = roots.filter((r) => !legendary.has(r.id));
    expect(nonLeg.length).toBe(61);
    for (const r of nonLeg) expect(wild.has(r.id), `root ${r.id} never spawns`).toBe(true);
  });

  it('legendaries appear only as statics; mythicals only as quest rewards / battle-pass 50', () => {
    const legendary = SPECIES.filter((s) => s.legendary).map((s) => s.id);
    const inTables = new Set(ENCOUNTER_TABLES.flatMap((t) => t.slots.map((s) => s.species)));
    for (const id of legendary) expect(inTables.has(id), id).toBe(false);
    for (const sw of DAILY_SWARMS) for (const s of sw.species) expect(legendary).not.toContain(s);
    for (const r of RAID_HOTSPOTS) expect(legendary).not.toContain(r.boss.species);
    expect(new Set(LEGENDARY_STATICS.map((l) => l.species)).size).toBe(8);
    for (const l of LEGENDARY_STATICS) expect(byId.get(l.species)?.legendary).toBe(true);
    expect(QUESTS.find((q) => q.id === 'q11_first_night')?.rewards.creature?.species).toBe('noxmyth');
    expect(QUESTS.find((q) => q.id === 'q12_first_morning')?.rewards.creature?.species).toBe('lumyth');
    expect(BATTLE_PASS.find((b) => b.level === 50)?.mythicalChoice).toEqual(['lumyth', 'noxmyth']);
  });

  it('finals never spawn wild except aonred/darkyon; Ghost/Dark are night-only; mids at evolvesAt + 2', () => {
    for (const t of ENCOUNTER_TABLES) {
      for (const s of t.slots) {
        const sp = byId.get(s.species)!;
        const isFinal = sp.evolvesFrom !== null && children(sp).length === 0;
        if (isFinal) expect(['aonred', 'darkyon']).toContain(sp.id);
        if (sp.types.includes('Ghost') || sp.types.includes('Dark')) expect(s.timeOfDay).toBe('night');
        if (sp.evolvesFrom !== null && children(sp).length > 0) {
          const parent = byId.get(sp.evolvesFrom)!;
          expect(s.levelMin).toBeGreaterThanOrEqual(atLevel(parent) + 2);
        }
      }
    }
  });

  it('the shipped roster report agrees with this recomputation and carries one path per species', () => {
    const r = validate({ skipHeightfields: true });
    expect(r.stats.roster.obtainable).toBe(R.size);
    expect(r.stats.roster.directlyPlaced).toBe(E.size);
    expect(r.stats.roster.families).toBe(71);
    expect(Object.keys(r.stats.roster.paths).length).toBe(137);
    expect(r.stats.roster.paths['bramblecub']?.kind).toBe('wild');
    expect(r.stats.roster.paths['thornback']?.kind).toBe('raid');
    expect(r.stats.roster.paths['galaxion']).toEqual({ kind: 'static', zoneId: 'umbral_observatory', when: 'flag:ledger_read' });
    expect(r.stats.roster.paths['lumyth']).toEqual({ kind: 'quest', questId: 'q12_first_morning' });
    // Phase D3 acquisition paths
    expect(r.stats.roster.paths['magmolith']).toEqual({ kind: 'item', from: 'embrock', item: 'ember_stone' });
    expect(r.stats.roster.paths['toxiveil']).toEqual({ kind: 'trade', from: 'glowtent' });
  });
});
