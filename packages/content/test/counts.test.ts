import { describe, expect, it } from 'vitest';
import { TYPE_NAMES } from '@ewa/core';
import {
  ABILITIES,
  BATTLE_PASS,
  BODIES,
  CONSUMABLES,
  DAILY_SWARMS,
  ENCOUNTER_TABLES,
  ITEMS,
  LEAGUE,
  LEGENDARY_STATICS,
  MOVES,
  ORBS,
  QUESTS,
  RAID_HOTSPOTS,
  SEASONAL_EVENTS,
  SPECIES,
  STORY,
  TYPE_CHART,
  ZONES,
  ZONE_ORDER,
  getHeightfield,
} from '../src/index';

describe('counts', () => {
  it('138 species with dense dex numbers', () => {
    expect(SPECIES.length).toBe(138);
    const dex = SPECIES.map((s) => s.dexNumber).sort((a, b) => a - b);
    expect(dex).toEqual(Array.from({ length: 138 }, (_, i) => i + 1));
    expect(SPECIES.filter((s) => s.legendary).length).toBe(11);
  });
  it('197 moves (193 legacy + Hollow Crescent, Vendetta Volley, Aurora Requiem, Crimson Lotus Prison), 25 abilities, 17 items, 10 orbs, 23 consumables', () => {
    expect(MOVES.length).toBe(197);
    expect(ABILITIES.length).toBe(25);
    expect(ITEMS.length).toBe(17);
    expect(ORBS.length).toBe(10);
    expect(CONSUMABLES.length).toBe(23);
  });
  it('19 types and a chart row for each', () => {
    expect(TYPE_NAMES.length).toBe(19);
    expect(Object.keys(TYPE_CHART).sort()).toEqual([...TYPE_NAMES].sort());
  });
  it('21 zones in ZONE_ORDER', () => {
    expect(ZONES.length).toBe(21);
    expect(ZONES.map((z) => z.id)).toEqual([...ZONE_ORDER]);
  });
  it('15 encounter tables, 9 statics, 12 league, 12 story quests + 30 achievements (Phase D5), ≥ 24 beats (33), live-ops 4/7/8, 100 battle-pass levels', () => {
    expect(ENCOUNTER_TABLES.length).toBe(15);
    expect(LEGENDARY_STATICS.length).toBe(9);
    expect(LEAGUE.length).toBe(12);
    expect(QUESTS.filter((q) => q.kind !== 'achievement').length).toBe(12);
    expect(QUESTS.filter((q) => q.kind === 'achievement').length).toBe(30);
    expect(STORY.length).toBeGreaterThanOrEqual(24);
    expect(STORY.length).toBe(33);
    expect(SEASONAL_EVENTS.length).toBe(4);
    expect(DAILY_SWARMS.length).toBe(7);
    expect(RAID_HOTSPOTS.length).toBe(8);
    expect(BATTLE_PASS.length).toBe(100);
    expect(BODIES.length).toBeGreaterThanOrEqual(10);
  });
  it('21 heightfields build, one per zone, with the §3.11 resolutions', () => {
    const res = { town: 321, route: 481, story: 401 } as const;
    let n = 0;
    for (const z of ZONES) {
      const h = getHeightfield(z.id);
      expect(h.zoneId).toBe(z.id);
      expect(h.res).toBe(res[z.kind]);
      expect(h.heights.length).toBe(h.res * h.res);
      n++;
    }
    expect(n).toBe(21);
  });
});
