/**
 * §50.4.2 `families.test.ts` — evolution trees (spine §2.3 / §3.10 rule 7): exactly 90 trees, each rooted at
 * `evolvesFrom === null`; parent and child agree (`evolution.into` ⇔ `evolvesFrom`), every species sits in exactly one
 * tree, and no tree has a cycle; every family is completable — its root is obtainable directly (wild, gift, static,
 * quest, battle pass, raid, swarm or a starter) and the closure under `into` reaches all 181; the four `split`s
 * (`darkone`: Lightning Rod → `aonred`, default `darkyon`; `dustcub`: honor ≥ 0 → `lawlander`, default `badlander`;
 * `cryptorb`: honor ≥ 0 → `vysion`, default `ultraze`) carry their `null` (default) branch last.
 */
import { describe, expect, it } from 'vitest';
import type { SpeciesDef } from '@ewa/core';
import { evolutionChildren } from '@ewa/core';
import { BATTLE_PASS, DAILY_SWARMS, ENCOUNTER_TABLES, LEGENDARY_STATICS, QUESTS, RAID_HOTSPOTS, SPECIES } from '../src/index';

/** `@ewa/protocol` STARTERS (§4.7 register) — content cannot import protocol; the three are pinned here. */
const STARTERS = ['bramblecub', 'glimfin', 'cindercap'] as const;

const byId = new Map<string, SpeciesDef>(SPECIES.map((s) => [s.id, s]));
const roots = SPECIES.filter((s) => s.evolvesFrom === null);

/** Directly obtainable: every source that hands a player a creature without evolving one. */
function directlyObtainable(): Map<string, string> {
  const out = new Map<string, string>();
  const add = (id: string, how: string): void => {
    if (!out.has(id)) out.set(id, how);
  };
  for (const t of ENCOUNTER_TABLES) for (const s of t.slots) add(s.species, `wild ${t.zoneId}`);
  for (const sw of DAILY_SWARMS) for (const id of sw.species) add(id, `swarm ${sw.id}`);
  for (const r of RAID_HOTSPOTS) add(r.boss.species, `raid ${r.id}`);
  for (const s of LEGENDARY_STATICS) add(s.species, `static ${s.zoneId}`);
  for (const q of QUESTS) if (q.rewards.creature) add(q.rewards.creature.species, `quest ${q.id}`);
  for (const b of BATTLE_PASS) {
    if (b.creature) add(b.creature.species, `battle-pass ${b.level}`);
    for (const m of b.mythicalChoice ?? []) add(m, `battle-pass ${b.level} choice`);
  }
  for (const s of STARTERS) add(s, 'starter');
  return out;
}

/** Every species in the tree rooted at `root` (BFS over `evolution.into`); throws on a cycle. */
function treeOf(root: SpeciesDef): string[] {
  const seen = new Set<string>([root.id]);
  const queue = [root.id];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const child of evolutionChildren(byId.get(id)!.evolution)) {
      if (seen.has(child)) throw new Error(`cycle or merge at ${child} in the tree of ${root.id}`);
      seen.add(child);
      queue.push(child);
    }
  }
  return [...seen];
}

describe('evolution families (§2.3, rule 7)', () => {
  it('exactly 90 trees, each rooted at evolvesFrom === null; every species in exactly one tree', () => {
    expect(SPECIES).toHaveLength(181);
    expect(roots).toHaveLength(90);
    const owner = new Map<string, string>();
    for (const r of roots) {
      for (const id of treeOf(r)) {
        expect(owner.has(id), `${id} is in the trees of ${owner.get(id)} and ${r.id}`).toBe(false);
        owner.set(id, r.id);
      }
    }
    expect(owner.size).toBe(181);
  });

  it('parent and child agree: every `into` names an existing species whose evolvesFrom is the parent, and back', () => {
    for (const s of SPECIES) {
      for (const child of evolutionChildren(s.evolution)) {
        expect(byId.has(child), `${s.id} → ${child}`).toBe(true);
        expect(byId.get(child)!.evolvesFrom, `${child}.evolvesFrom`).toBe(s.id);
      }
      if (s.evolvesFrom !== null) {
        const parent = byId.get(s.evolvesFrom);
        expect(parent, `${s.id}.evolvesFrom = ${s.evolvesFrom}`).toBeDefined();
        expect(evolutionChildren(parent!.evolution), `${s.evolvesFrom} lists ${s.id}`).toContain(s.id);
      }
    }
  });

  it('every family is completable: its root is directly obtainable, and the closure under `into` reaches all 181', () => {
    const direct = directlyObtainable();
    for (const r of roots) expect(direct.has(r.id), `${r.id}: the family root has no wild / gift source`).toBe(true);
    const caught = new Set(direct.keys());
    const queue = [...caught];
    while (queue.length > 0) {
      const id = queue.shift()!;
      const sp = byId.get(id);
      expect(sp, `obtainable id ${id} is a species`).toBeDefined();
      for (const child of evolutionChildren(sp!.evolution)) {
        if (caught.has(child)) continue;
        caught.add(child);
        queue.push(child);
      }
    }
    const missing = SPECIES.filter((s) => !caught.has(s.id)).map((s) => s.id);
    expect(missing).toEqual([]);
  });

  it("the four splits: darkone at 20, Lightning Rod → aonred, the null (default) branch darkyon last; dustcub at 30, cryptorb at 34 and corvlet at 30 by honor", () => {
    const splits = SPECIES.filter((s) => s.evolution?.kind === 'split');
    expect(splits.map((s) => s.id)).toEqual(['darkone', 'dustcub', 'cryptorb', 'corvlet']);
    const e = splits[0]!.evolution;
    if (e?.kind !== 'split') throw new Error('unreachable');
    expect(e.branches).toEqual([
      { into: 'aonred', condition: { kind: 'ability', ability: 'Lightning Rod' } },
      { into: 'darkyon', condition: null },
    ]);
    expect(e.branches.filter((b) => b.condition === null)).toHaveLength(1);
    expect(e.branches[e.branches.length - 1]!.condition).toBeNull();
    expect(splits[0]!.abilities).toContain('Lightning Rod');
    // the honor ledger (core honor.ts): ≥ 0 at 30 → the High Honor lawlander, below → the Low Honor badlander
    expect(splits[1]!.evolution).toEqual({
      kind: 'split',
      atLevel: 30,
      branches: [
        { into: 'lawlander', condition: { kind: 'honor', atLeast: 0 } },
        { into: 'badlander', condition: null },
      ],
    });
    // ≥ 0 at 34 → the High Honor vysion, below → the Low Honor ultraze
    expect(splits[2]!.evolution).toEqual({
      kind: 'split',
      atLevel: 34,
      branches: [
        { into: 'vysion', condition: { kind: 'honor', atLeast: 0 } },
        { into: 'ultraze', condition: null },
      ],
    });
    // ≥ 0 at 30 → the oracle augurvane, below → the thief ravenmourne
    expect(splits[3]!.evolution).toEqual({
      kind: 'split',
      atLevel: 30,
      branches: [
        { into: 'augurvane', condition: { kind: 'honor', atLeast: 0 } },
        { into: 'ravenmourne', condition: null },
      ],
    });
  });
});
