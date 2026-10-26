/**
 * Phase D8–D11 content: water encounters, Cut / Strength obstacles, the bicycle.
 *
 * - water slots: every non-lava zone with a table and ponds fishes something (≥ 1 water slot); every table with water
 *   slots has open water to spawn on and a boardwalk to engage from without HM Surf (validate's rule, restated); the
 *   water species are Water-type (smellduck, solenne's pond duck, is the one legacy exception); the D8 additions keep
 *   the roster (99 directly placed, 180 obtainable, 89 families) and roster-coverage clean;
 * - obstacles: stamped only on walkable samples and recorded per id; the stamp disconnects nothing (the spawn's
 *   component loses exactly the stamped samples it held); flags, refusals and HM / type rules;
 * - the bicycle: a priced key item sold in Saltmourn, never a story gate.
 *
 * Phase E5 adds the §50.4.2 base rules: level ranges, weights, the RC-9 story-table rules, the 16-slot / 14-species /
 * |O(zone)| ≤ 16 caps with the full Z(zone) in bindSets, the medium default, the alpha / variant constants, and a
 * 100 000-roll seeded sample of mire_route against each slot's weight share.
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '@ewa/core';
import {
  ALPHA_CHANCE,
  BIKE_ITEM,
  BIKE_PRICE,
  ENCOUNTER_BANDS,
  ENCOUNTER_TABLES,
  KEY_ITEMS,
  LEGENDARY_STATICS,
  OBSTACLE_HM,
  OBSTACLE_TYPES,
  SPECIES,
  STORY,
  VARIANT_CHANCE,
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
    expect(r.stats.roster.directlyPlaced).toBe(99);
    expect(r.stats.roster.obtainable).toBe(180);
    expect(r.stats.roster.families).toBe(89);
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

describe('§50.4.2 encounter tables (Phase E5)', () => {
  const zoneById = new Map(ZONES.map((z) => [z.id, z]));
  const nocturnal = (id: string): boolean => {
    const t = byId.get(id)!.types;
    return t.includes('Ghost') || t.includes('Dark');
  };

  it('15 tables, one per zone that names one (`enc_<zoneId>`); levelMin ≤ levelMax in 1..100; weights > 0; species exist', () => {
    expect(ENCOUNTER_TABLES).toHaveLength(15);
    expect(new Set(ENCOUNTER_TABLES.map((t) => t.zoneId)).size).toBe(15);
    for (const t of ENCOUNTER_TABLES) {
      expect(t.id).toBe(`enc_${t.zoneId}`);
      expect(zoneById.get(t.zoneId)!.encounterTable, t.id).toBe(t.id);
      for (const s of t.slots) {
        const what = `${t.id} ${s.species}`;
        expect(byId.has(s.species), what).toBe(true);
        expect(Number.isInteger(s.levelMin) && Number.isInteger(s.levelMax), what).toBe(true);
        expect(s.levelMin, what).toBeGreaterThanOrEqual(1);
        expect(s.levelMin, what).toBeLessThanOrEqual(s.levelMax);
        expect(s.levelMax, what).toBeLessThanOrEqual(100);
        expect(s.weight, what).toBeGreaterThan(0);
        expect(['day', 'night', 'any'], what).toContain(s.timeOfDay);
      }
    }
    for (const z of ZONES) if (z.encounterTable !== null) expect(ENCOUNTER_TABLES.some((t) => t.id === z.encounterTable), z.id).toBe(true);
  });

  it('story tables satisfy RC-9: every slot inside the zone band, Ghost / Dark species night-only', () => {
    const story = ENCOUNTER_TABLES.filter((t) => zoneById.get(t.zoneId)!.kind === 'story');
    expect(story.length).toBe(4);
    for (const t of story) {
      const band = ENCOUNTER_BANDS[t.zoneId];
      expect(band, `${t.zoneId} band`).toBeDefined();
      for (const s of t.slots) {
        expect(s.levelMin, `${t.id} ${s.species}`).toBeGreaterThanOrEqual(band![0]);
        expect(s.levelMax, `${t.id} ${s.species}`).toBeLessThanOrEqual(band![1]);
        if (nocturnal(s.species)) expect(s.timeOfDay, `${t.id} ${s.species} is Ghost/Dark`).toBe('night');
      }
    }
  });

  it('≤ 16 slots and ≤ 14 species per table; |O(zone)| = table ∪ statics ≤ 16 for all 21 zones; the full Z(zone) is in bindSets', () => {
    for (const t of ENCOUNTER_TABLES) {
      expect(t.slots.length, t.id).toBeLessThanOrEqual(16);
      expect(new Set(t.slots.map((s) => s.species)).size, t.id).toBeLessThanOrEqual(14);
    }
    const { stats } = validate({ skipHeightfields: true });
    for (const z of ZONES) {
      const o = new Set<string>();
      for (const s of ENCOUNTER_TABLES.find((t) => t.zoneId === z.id)?.slots ?? []) o.add(s.species);
      for (const s of LEGENDARY_STATICS) if (s.zoneId === z.id) o.add(s.species);
      expect(o.size, `${z.id} overworld species`).toBeLessThanOrEqual(16);
      // Z(zone) ⊇ O(zone) ∪ trainer teams; reported in full (spine rule 11, amended 2026-09-25)
      const full = stats.bindSets[z.id];
      expect(full, z.id).toBeDefined();
      for (const id of o) expect(full, `${z.id} bindSets has ${id}`).toContain(id);
      for (const tr of z.trainers) for (const m of tr.team) expect(full, `${z.id} bindSets has ${m.species}`).toContain(m.species);
      expect([...full!].sort()).toEqual([...full!]);
    }
    // the two zones the amendment names cannot meet a cap on Z
    expect(stats.bindSets.solenne!.length).toBeGreaterThan(16);
    expect(stats.bindSets.umbral_observatory!.length).toBeGreaterThan(16);
  });

  it("medium defaults to 'land' (omitted on land slots); every 'water' slot's zone has water samples", () => {
    let land = 0;
    let water = 0;
    for (const t of ENCOUNTER_TABLES) {
      for (const s of t.slots) {
        expect(s.medium === undefined || s.medium === 'water', `${t.id} ${s.species}: medium written as '${String(s.medium)}'`).toBe(true);
        if ((s.medium ?? 'land') === 'land') land++;
        else water++;
      }
      if (t.slots.some((s) => s.medium === 'water')) {
        const h = getHeightfield(t.zoneId);
        expect(h.water.some((v) => v === 1), `${t.zoneId} has no water samples`).toBe(true);
      }
    }
    expect(land).toBeGreaterThan(0);
    expect(water).toBeGreaterThan(0);
  });

  it('ALPHA_CHANCE 0.02, VARIANT_CHANCE 0.03', () => {
    expect(ALPHA_CHANCE).toBe(0.02);
    expect(VARIANT_CHANCE).toBe(0.03);
  });

  it("a 100 000-roll seeded sample of mire_route lands within ±1.5 pp of each slot's weight share", () => {
    const t = ENCOUNTER_TABLES.find((x) => x.zoneId === 'mire_route')!;
    const total = t.slots.reduce((a, s) => a + s.weight, 0);
    const hits = new Array<number>(t.slots.length).fill(0);
    const rng = createRng('enc_mire_route:e5');
    const N = 100_000;
    for (let n = 0; n < N; n++) {
      // the spawn director's weighted pick (packages/server/src/rooms/spawnDirector.ts): one next() × total, walk the slots
      let at = rng.next() * total;
      let k = t.slots.length - 1;
      for (let i = 0; i < t.slots.length; i++) {
        at -= t.slots[i]!.weight;
        if (at < 0) {
          k = i;
          break;
        }
      }
      hits[k]!++;
    }
    for (let i = 0; i < t.slots.length; i++) {
      const share = t.slots[i]!.weight / total;
      const got = hits[i]! / N;
      expect(Math.abs(got - share) * 100, `${t.slots[i]!.species}: ${(got * 100).toFixed(2)} % vs ${(share * 100).toFixed(2)} %`).toBeLessThanOrEqual(1.5);
    }
  });
});
