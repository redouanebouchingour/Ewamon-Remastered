/**
 * The Dex's knowledge of a species (data/dexInfo.ts): the evolution tree with a condition per edge (level, honor and
 * ability splits, stones, trades), habitats merged per zone (day / night, land / water, alpha slots), the other ways to
 * get a species, defensive matchups and learnsets. Expected values come from content here, not from the module.
 */
import { describe, expect, it } from 'vitest';
import { ENCOUNTER_TABLES, LEGENDARY_STATICS, QUESTS, SPECIES, TM_MOVES, TYPE_CHART } from '@ewa/content';
import { TYPE_NAMES, typeMultiplier } from '@ewa/core';
import type { TypeName } from '@ewa/core';
import {
  defensiveMatchups,
  evoLabel,
  evolutionTree,
  habitatsOf,
  levelUpMoves,
  lineOf,
  originsOf,
  tmMoves,
  zoneRoster,
} from '../src/data/dexInfo';
import type { EvoNode } from '../src/data/dexInfo';

const sp = (id: string) => SPECIES.find((s) => s.id === id)!;
const childIds = (n: EvoNode | null | undefined) => (n?.children ?? []).map((c) => c.sp.id);
const find = (n: EvoNode | null, id: string): EvoNode | undefined => {
  if (n === null) return undefined;
  if (n.sp.id === id) return n;
  for (const c of n.children) {
    const hit = find(c, id);
    if (hit !== undefined) return hit;
  }
  return undefined;
};

describe('evolutionTree', () => {
  it('splits dustcub by honor: lawlander on High Honor, badlander on Low', () => {
    const tree = evolutionTree('badlander');
    expect(tree?.sp.id).toBe('dustcub');
    expect(childIds(tree).sort()).toEqual(['badlander', 'lawlander']);
    expect(evoLabel(find(tree, 'lawlander')!.how!)).toBe('Lv 30 · High Honor');
    expect(evoLabel(find(tree, 'badlander')!.how!)).toBe('Lv 30 · Low Honor');
  });

  it('splits cryptorb by honor at 34', () => {
    const tree = evolutionTree('cryptorb');
    expect(evoLabel(find(tree, 'vysion')!.how!)).toBe('Lv 34 · High Honor');
    expect(evoLabel(find(tree, 'ultraze')!.how!)).toBe('Lv 34 · Low Honor');
  });

  it('splits darkone by ability', () => {
    const tree = evolutionTree('darkyon');
    expect(tree?.sp.id).toBe('darkone');
    expect(evoLabel(find(tree, 'aonred')!.how!)).toBe('Lv 20 · Lightning Rod');
    expect(evoLabel(find(tree, 'darkyon')!.how!)).toBe('Lv 20 · not Lightning Rod');
  });

  it('names the stone and the trade', () => {
    expect(evoLabel(find(evolutionTree('embrock'), 'magmolith')!.how!)).toBe('Ember Stone');
    expect(evoLabel(find(evolutionTree('glowtent'), 'toxiveil')!.how!)).toBe('Trade');
  });

  it('gives a three-stage line its levels', () => {
    const tree = evolutionTree('ravatar');
    expect(lineOf('ravatar').map((s) => s.id)).toEqual(['elemutt', 'katamute', 'ravatar']);
    expect(evoLabel(find(tree, 'katamute')!.how!)).toBe('Lv 16');
    expect(evoLabel(find(tree, 'ravatar')!.how!)).toBe('Lv 36');
  });

  it('roots every species at a stage with no parent, and the tree holds it', () => {
    for (const s of SPECIES) {
      const tree = evolutionTree(s.id)!;
      expect(tree.sp.evolvesFrom).toBeNull();
      expect(find(tree, s.id)).toBeDefined();
    }
  });
});

describe('habitatsOf', () => {
  it('lists every zone a species has a non-alpha slot in, levels spanning its slots', () => {
    for (const s of SPECIES.slice(0, 40)) {
      const zones = new Set(ENCOUNTER_TABLES.filter((t) => t.slots.some((x) => x.species === s.id && x.tier !== 'alpha')).map((t) => t.zoneId));
      const hs = habitatsOf(s.id);
      expect(new Set(hs.map((h) => h.zoneId))).toEqual(zones);
      for (const h of hs) {
        const slots = ENCOUNTER_TABLES.find((t) => t.zoneId === h.zoneId)!.slots.filter((x) => x.species === s.id && x.tier !== 'alpha');
        expect(h.levelMin).toBe(Math.min(...slots.map((x) => x.levelMin)));
        expect(h.levelMax).toBe(Math.max(...slots.map((x) => x.levelMax)));
      }
    }
  });

  it('marks a night-only and a water-only habitat', () => {
    const nightOnly = ENCOUNTER_TABLES.flatMap((t) => t.slots.map((x) => ({ zoneId: t.zoneId, x }))).find(({ zoneId, x }) => {
      const all = ENCOUNTER_TABLES.find((t) => t.zoneId === zoneId)!.slots.filter((y) => y.species === x.species && y.tier !== 'alpha');
      return all.length > 0 && all.every((y) => y.timeOfDay === 'night');
    });
    expect(nightOnly).toBeDefined();
    expect(habitatsOf(nightOnly!.x.species).find((h) => h.zoneId === nightOnly!.zoneId)?.time).toBe('night');

    const water = ENCOUNTER_TABLES.flatMap((t) => t.slots.map((x) => ({ zoneId: t.zoneId, x }))).find(({ zoneId, x }) => {
      const all = ENCOUNTER_TABLES.find((t) => t.zoneId === zoneId)!.slots.filter((y) => y.species === x.species && y.tier !== 'alpha');
      return all.length > 0 && all.every((y) => y.medium === 'water');
    });
    expect(water).toBeDefined();
    const h = habitatsOf(water!.x.species).find((y) => y.zoneId === water!.zoneId)!;
    expect(h.water).toBe(true);
    expect(h.land).toBe(false);
  });

  it('zoneRoster is the inverse of habitatsOf', () => {
    const t = ENCOUNTER_TABLES[0]!;
    for (const { sp: s } of zoneRoster(t.zoneId)) expect(habitatsOf(s.id).some((h) => h.zoneId === t.zoneId)).toBe(true);
  });
});

describe('originsOf', () => {
  it('finds the static legendaries and the quest gifts', () => {
    for (const st of LEGENDARY_STATICS) expect(originsOf(st.species).some((o) => o.kind === 'static' && o.zoneId === st.zoneId)).toBe(true);
    for (const q of QUESTS) {
      const c = q.rewards.creature;
      if (c !== null && c !== undefined) expect(originsOf(c.species).some((o) => o.kind === 'quest' && o.title === q.title)).toBe(true);
    }
  });

  it('a later stage comes from evolving its parent', () => {
    const o = originsOf('lawlander').find((x) => x.kind === 'evolve');
    expect(o?.kind === 'evolve' && o.from).toBe('dustcub');
  });
});

describe('defensiveMatchups', () => {
  it('groups every non-neutral attacking type by its multiplier', () => {
    for (const s of [sp('dustcub'), sp('hyoryu'), sp('castlemaw')]) {
      const rows = defensiveMatchups(s.types);
      const listed = rows.flatMap((r) => r.types);
      for (const t of TYPE_NAMES) {
        const m = typeMultiplier(TYPE_CHART, t, s.types);
        const row = rows.find((r) => r.types.includes(t as TypeName));
        if (m === 1) expect(listed).not.toContain(t);
        else expect(row?.mult).toBe(m);
      }
    }
  });
});

describe('moves', () => {
  it('lists the level-up learnset once per move, in level order', () => {
    const s = sp('dustcub');
    const rows = levelUpMoves(s);
    expect(new Set(rows.map((r) => r.move.id)).size).toBe(rows.length);
    for (let i = 1; i < rows.length; i++) expect(rows[i]!.level).toBeGreaterThanOrEqual(rows[i - 1]!.level);
  });

  it('TM moves are a subset of the TM list', () => {
    for (const m of tmMoves(sp('hyoryu'))) expect(TM_MOVES).toContain(m.id);
  });
});
