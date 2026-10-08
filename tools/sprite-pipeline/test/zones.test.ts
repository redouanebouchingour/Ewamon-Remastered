import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadLegacyData } from '../src/legacy.js';
import { ZONE_ORDER, buildZoneInputs, buildZoneSets, loadRosterTables, parseRosterTables } from '../src/zones.js';
import { LEGACY_DIR, ROSTER_PATH } from './helpers.js';

const SNIPPET = `
## 5. BANDS

| zoneId | species | weight | levelMin | levelMax | time | tier | medium |
|---|---|---|---|---|---|---|---|
| mire_route | ignored | 1 | 1 | 1 | any | common | land |

## 6. SPAWN TABLES

### 6.1 mire_route

| zoneId | species | weight | levelMin | levelMax | time | tier | medium |
|---|---|---|---|---|---|---|---|
| mire_route | mossling | 8 | 2 | 5 | any | common | land |
| mire_route | glimp | 7 | 2 | 4 | any | common | land |
| mire_route | mossling | 1 | 6 | 6 | any | alpha | land |
| not_a_zone | glimp | 1 | 6 | 6 | any | alpha | land |

## 7. LEGENDARY STATICS AND MYTHICAL REWARDS

| species | level | zoneId | x | z | flag | when | staging |
|---|---|---|---|---|---|---|---|
| raikitsune | 30 | galvan_route | -84 | 96 | \`leg_raikitsune\` | \`badge:circuit\` | pylon |

## 8. STARTERS
| zoneId | species | weight | levelMin | levelMax | time | tier | medium |
| mire_route | nope | 1 | 1 | 1 | any | common | land |
`;

describe('zone sets', () => {
  it('ZONE_ORDER is the 21 spine zones', () => {
    expect(ZONE_ORDER.length).toBe(21);
    expect(ZONE_ORDER[0]).toBe('mirevale');
    expect(ZONE_ORDER[20]).toBe('the_rift');
    expect(new Set(ZONE_ORDER).size).toBe(21);
  });

  it('parses only §6 spawn rows and §7 statics, deduplicating species per zone', () => {
    const t = parseRosterTables(SNIPPET);
    expect([...t.encounters.keys()]).toEqual(['mire_route']);
    expect(t.encounters.get('mire_route')).toEqual(['mossling', 'glimp']);
    expect(t.statics).toEqual([{ species: 'raikitsune', zoneId: 'galvan_route' }]);
  });

  it('builds Z(zone) from tables + statics + trainers + league and rejects unknown species', () => {
    const t = parseRosterTables(SNIPPET);
    const known = new Set(['mossling', 'glimp', 'raikitsune', 'bramblecub', 'briarbear', 'zenryu']);
    const legacy = {
      league: [
        { id: 'verdant_gym', zoneId: 'mirevale', species: ['bramblecub', 'briarbear'] },
        { id: 'zeon', zoneId: 'solenne', species: ['zenryu'] },
      ],
      trainers: [{ id: 'mire_route/pim', zoneId: 'mire_route', species: ['glimp', 'mossling'] }],
    };
    const sets = buildZoneSets({ roster: t, legacy }, known);
    expect(sets.size).toBe(21);
    expect(sets.get('mire_route')).toEqual(['glimp', 'mossling']);
    expect(sets.get('mirevale')).toEqual(['bramblecub', 'briarbear']);
    expect(sets.get('galvan_route')).toEqual(['raikitsune']);
    expect(sets.get('solenne')).toEqual(['zenryu']);
    expect(sets.get('cinderhold')).toEqual([]);
    expect(() => buildZoneSets({ roster: t, legacy }, new Set(['mossling']))).toThrow(/unknown species/);
  });

  describe.skipIf(!existsSync(ROSTER_PATH) || !existsSync(LEGACY_DIR))('the real roster + legacy data', () => {
    it('has 15 spawn tables, 8 legendary statics, and every field zone set stays within 16 species', async () => {
      const roster = loadRosterTables(ROSTER_PATH);
      expect(roster.encounters.size).toBe(15);
      expect(roster.statics.length).toBe(8);
      expect(roster.encounters.get('hollow_route')!.length).toBe(14);
      const legacy = await loadLegacyData(LEGACY_DIR);
      expect(legacy.species.size).toBe(131); // 130 legacy + hollowmane (.design/additions)
      const known = new Set(legacy.species.keys());
      const sets = buildZoneSets({ roster, legacy }, known);
      // solenne is the one zone whose Z exceeds the 8-atlas cap even when perfectly packed:
      // park table (6) + Elite Four + Champion teams (20) = 26. The planner defers its league
      // teams to their `home` crops (plan.ts); every other zone holds at most 14 species.
      for (const z of ZONE_ORDER) expect(sets.get(z)!.length, z).toBeLessThanOrEqual(z === 'solenne' ? 26 : 16);
      expect(sets.get('solenne')!.length).toBe(26);
      const { league } = buildZoneInputs({ roster, legacy }, known);
      expect(league.get('solenne')!.length).toBe(20);
      expect(sets.get('solenne')!.length - league.get('solenne')!.length).toBeLessThanOrEqual(16);
      expect(sets.get('mirevale')).toEqual(['bramblecub', 'briarbear', 'smellduck']);
    });
  });
});
