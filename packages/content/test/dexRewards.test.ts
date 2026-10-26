/**
 * Dex completion rewards (data/dexRewards.ts): every zone with a wild roster and every type has a set, the sets are
 * what the encounter tables and the species say, progress counts recorded species and full research, every item a
 * reward pays exists, and titles and stamp looks come only from claimed rewards.
 */
import { describe, expect, it } from 'vitest';
import { TYPE_NAMES } from '@ewa/core';
import { ENCOUNTER_TABLES, SPECIES } from '../src';
import { CONSUMABLES } from '../src/data/consumables';
import { ORBS } from '../src/data/orbs';
import { DEX_REWARDS, DEX_TITLES, dexRewardProgress, dexRewardReady, dexStampsOf, dexTitlesOf } from '../src/data/dexRewards';

const ITEM_IDS = new Set([...CONSUMABLES.map((c) => c.id), ...ORBS.map((o) => o.id)]);

describe('DEX_REWARDS', () => {
  it('has unique ids, a zone set per wild roster and a type set per type in use', () => {
    expect(new Set(DEX_REWARDS.map((r) => r.id)).size).toBe(DEX_REWARDS.length);
    for (const t of ENCOUNTER_TABLES) expect(DEX_REWARDS.some((r) => r.need.kind === 'zone' && r.need.zoneId === t.zoneId)).toBe(true);
    for (const t of TYPE_NAMES) {
      const has = SPECIES.some((s) => (s.types as readonly string[]).includes(t));
      expect(DEX_REWARDS.some((r) => r.need.kind === 'type' && r.need.type === t)).toBe(has);
    }
  });

  it('a zone set is every non-alpha wild species of that zone', () => {
    for (const r of DEX_REWARDS) {
      if (r.need.kind !== 'zone') continue;
      const zoneId = r.need.zoneId;
      const want = [...new Set(ENCOUNTER_TABLES.find((t) => t.zoneId === zoneId)!.slots.filter((s) => s.tier !== 'alpha').map((s) => s.species))].sort();
      expect(r.need.species).toEqual(want);
    }
  });

  it('pays only items that exist, and every title is unique', () => {
    for (const r of DEX_REWARDS) for (const id of Object.keys(r.items)) expect(ITEM_IDS.has(id), `${r.id}: ${id}`).toBe(true);
    expect(new Set(DEX_TITLES).size).toBe(DEX_TITLES.length);
    // POST /profile takes a title of at most 40 characters
    for (const t of DEX_TITLES) expect(t.length, t).toBeLessThanOrEqual(40);
  });
});

describe('progress', () => {
  const fire = DEX_REWARDS.find((r) => r.id === 'dex_type_fire')!;
  it('counts recorded species of the set', () => {
    const ids = fire.need.kind === 'type' ? fire.need.species : [];
    expect(dexRewardProgress(fire, { caught: new Set(ids.slice(0, 2)), research: {} })).toEqual({ have: 2, need: ids.length });
    expect(dexRewardReady(fire, { caught: new Set(ids), research: {} })).toBe(true);
  });
  it('counts fully researched species for a research milestone', () => {
    const r5 = DEX_REWARDS.find((r) => r.id === 'dex_research_5')!;
    const research = Object.fromEntries(SPECIES.slice(0, 6).map((s, i) => [s.id, i < 5 ? 5 : 4]));
    expect(dexRewardProgress(r5, { caught: new Set(), research })).toEqual({ have: 5, need: 5 });
  });
  it('titles and stamps come from claimed rewards only', () => {
    expect(dexTitlesOf([])).toEqual([]);
    expect(dexTitlesOf(['dex_type_fire'])).toEqual(['Fire Archivist']);
    expect(dexStampsOf([])).toEqual(['paper']);
    expect(dexStampsOf(['dex_research_15', 'dex_research_5'])).toEqual(['paper', 'bronze', 'silver']);
  });
});
