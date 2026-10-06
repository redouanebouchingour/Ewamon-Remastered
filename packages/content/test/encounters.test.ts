/**
 * Phase D8–D11 content: water encounters, Cut / Strength obstacles, the bicycle.
 *
 * - water slots: every non-lava zone with a table and ponds fishes something (≥ 1 water slot); every table with water
 *   slots has open water to spawn on and a boardwalk to engage from without HM Surf (validate's rule, restated); the
 *   water species are Water-type (smellduck, solenne's pond duck, is the one legacy exception); the D8 additions keep
 *   the roster (79 directly placed, 130 obtainable, 67 families) and roster-coverage clean;
 * - obstacles: stamped only on walkable samples and recorded per id; the stamp disconnects nothing (the spawn's
 *   component loses exactly the stamped samples it held); flags, refusals and HM / type rules;
 * - the bicycle: a priced key item sold in Saltmourn, never a story gate.
 */
import { describe, expect, it } from 'vitest';
import {
  BIKE_ITEM,
  BIKE_PRICE,
  ENCOUNTER_TABLES,
  KEY_ITEMS,
  OBSTACLE_HM,
  OBSTACLE_TYPES,
  SPECIES,
  STORY,
  ZONES,
  getHeightfield,
  getZoneSurface,
  obstacleAt,
  obstacleFlag,
  obstacleRefusal,
  obstacleRefusalText,
  obstacleStampRadius,
  stampObstacles,
  validate,
  walkableComponent,
} from '../src/index';
import type { ZoneId } from '../src/index';

const LAVA_BIOMES = new Set(['cinder']);
const byId = new Map(SPECIES.map((s) => [s.id, s]));

describe('Phase D8 water encounters', () => {
  it('every non-lava zone with a table and open water has at least one water slot', () => {
    for (const z of ZONES) {
      const t = ENCOUNTER_TABLES.find((x) => x.zoneId === z.id);
      if (t === undefined || LAVA_BIOMES.has(z.biome)) continue;
      const h = getHeightfield(z.id);
      let open = 0;
      for (let i = 0; i < h.water.length; i++) if (h.water[i] === 1 && h.walkable[i] === 0) open++;
      if (open === 0) continue;
      expect(t.slots.some((s) => s.medium === 'water'), `${z.id} has ponds but no water slot`).toBe(true);
    }
  });

  it('a table with water slots has open water and a boardwalk; its water species are Water-type', () => {
    for (const t of ENCOUNTER_TABLES) {
      const water = t.slots.filter((s) => s.medium === 'water');
      if (water.length === 0) continue;
      const h = getHeightfield(t.zoneId);
      let open = 0;
      let boardwalk = 0;
      for (let i = 0; i < h.water.length; i++) {
        if (h.water[i] !== 1) continue;
        if (h.walkable[i] === 1) boardwalk++;
        else open++;
      }
      expect(open, `${t.zoneId} open water`).toBeGreaterThan(0);
      expect(boardwalk, `${t.zoneId} boardwalk`).toBeGreaterThan(0);
      for (const s of water) {
        const sp = byId.get(s.species)!;
        if (s.species !== 'smellduck') expect(sp.types, `${t.zoneId} ${s.species}`).toContain('Water');
      }
    }
  });

  it('the D8 additions: mire_route, skyrend and umbral_observatory fish; the roster is unchanged', () => {
    const waterOf = (id: ZoneId): string[] => ENCOUNTER_TABLES.find((t) => t.zoneId === id)!.slots.filter((s) => s.medium === 'water').map((s) => s.species);
    expect(waterOf('mire_route').sort()).toEqual(['mossling', 'mudbub']);
    expect(waterOf('skyrend')).toEqual(['tidalfang']);
    expect(waterOf('umbral_observatory')).toEqual(['wraithtide']);
    const r = validate({ skipHeightfields: true });
    expect(r.stats.roster.directlyPlaced).toBe(79);
    expect(r.stats.roster.obtainable).toBe(130);
    expect(r.stats.roster.families).toBe(67);
    expect(r.stats.roster.ruleFailures).toEqual([]);
  });
});

describe('Phase D10 obstacles', () => {
  const withObstacles = ZONES.filter((z) => (z.obstacles?.length ?? 0) > 0);

  it('a handful of route zones carry 1–2 each, every one guarding a hidden item', () => {
    expect(withObstacles.map((z) => z.id).sort()).toEqual(['ascent_route', 'deepcut_route', 'hollow_route', 'mire_route', 'tide_route']);
    for (const z of withObstacles) {
      expect(z.kind).toBe('route');
      expect(z.obstacles!.length).toBeLessThanOrEqual(2);
      for (const o of z.obstacles!) {
        expect(o.id.startsWith(`${z.id}.`), o.id).toBe(true);
        expect(o.item, o.id).toBeDefined();
      }
    }
  });

  it('stamps only walkable samples, records each by id, and cuts nothing off', () => {
    for (const z of withObstacles) {
      const s = getZoneSurface(z.id);
      const h = s.heightfield;
      // the field before the obstacle stamp: the stamped samples back to walkable
      const before = { ...h, walkable: Uint8Array.from(h.walkable) };
      for (const i of s.obstacleCells.keys()) before.walkable[i] = 1;
      for (const o of z.obstacles!) {
        const cells = [...s.obstacleCells.entries()].filter(([, id]) => id === o.id).map(([i]) => i);
        expect(cells.length, o.id).toBeGreaterThan(0);
        const r = obstacleStampRadius(o.kind);
        for (const i of cells) {
          const row = Math.floor(i / h.res);
          const x = h.originX + (i - row * h.res) * h.step;
          const zz = h.originZ + row * h.step;
          expect(Math.hypot(x - o.x, zz - o.z)).toBeLessThan(r);
          expect(h.walkable[i]).toBe(0);
          expect(obstacleAt(h, x, zz)).toBe(o.id);
        }
        expect(obstacleAt(h, o.x, o.z)).toBe(o.id);
      }
      const a = walkableComponent(before, z.spawn.x, z.spawn.z);
      const b = walkableComponent(h, z.spawn.x, z.spawn.z);
      let na = 0;
      let nb = 0;
      let lost = 0;
      for (let i = 0; i < a.length; i++) {
        na += a[i]!;
        nb += b[i]!;
        if (a[i] === 1 && s.obstacleCells.has(i)) lost++;
      }
      expect(na - nb, `${z.id}: the stamp disconnected walkable ground`).toBe(lost);
    }
  });

  it('zones without obstacles stamp nothing (their digests are unchanged)', () => {
    for (const z of ZONES) if ((z.obstacles?.length ?? 0) === 0) expect(getZoneSurface(z.id).obstacleCells.size, z.id).toBe(0);
    const f = { res: 5, step: 1, originX: 0, originZ: 0, walkable: new Uint8Array(25).fill(1) };
    expect(stampObstacles(f, undefined).size).toBe(0);
    expect(stampObstacles(f, []).size).toBe(0);
    const cells = stampObstacles(f, [{ id: 'a', kind: 'tree', x: 2, z: 2 }, { id: 'b', kind: 'boulder', x: 2.4, z: 2 }]);
    expect(cells.get(12)).toBe('a'); // the first obstacle listed wins an overlap
    expect(f.walkable[12]).toBe(0);
  });

  it('flags, HM and party-type rules', () => {
    expect(obstacleFlag('mire_route', 'mire_route.thicket')).toBe('obstacle:mire_route:mire_route.thicket');
    expect(OBSTACLE_HM).toEqual({ tree: 'HM Cut', boulder: 'HM Strength' });
    expect(obstacleRefusal('tree', {}, [['Grass']])).toBe('needHm');
    expect(obstacleRefusal('tree', { 'HM Cut': 1 }, [['Fire'], ['Water', 'Electric']])).toBe('needType');
    for (const t of OBSTACLE_TYPES.tree) expect(obstacleRefusal('tree', { 'HM Cut': 1 }, [['Fire'], [t]])).toBeNull();
    expect(obstacleRefusal('boulder', { 'HM Cut': 1 }, [['Rock']])).toBe('needHm');
    for (const t of OBSTACLE_TYPES.boulder) expect(obstacleRefusal('boulder', { 'HM Strength': 1 }, [[t]])).toBeNull();
    expect(obstacleRefusalText('boulder', 'needType')).toContain('HM Strength');
    // the HMs exist and a story beat grants each
    for (const hm of Object.values(OBSTACLE_HM)) expect(STORY.some((b) => (b.grant?.[hm] ?? 0) > 0), hm).toBe(true);
  });
});

describe('Phase D11 bicycle', () => {
  it('a priced key item sold in Saltmourn only, granted by no beat and needed by none', () => {
    const bike = KEY_ITEMS.find((k) => k.id === BIKE_ITEM)!;
    expect(bike.slot).toBe('key');
    expect(bike.price).toBe(BIKE_PRICE);
    expect(BIKE_PRICE).toBeGreaterThanOrEqual(20000);
    expect(ZONES.filter((z) => z.shop?.includes(BIKE_ITEM) === true).map((z) => z.id)).toEqual(['saltmourn']);
    for (const b of STORY) expect(b.grant?.[BIKE_ITEM]).toBeUndefined();
  });
});
