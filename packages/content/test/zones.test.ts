import { describe, expect, it } from 'vitest';
import type { LinkDir, ZoneId } from '../src/index';
import { BADGE_ORDER, LEAGUE, ZONES, ZONE_MARGIN, ZONE_ORDER, ZONE_SIZE } from '../src/index';

const byId = new Map(ZONES.map((z) => [z.id, z]));
const OPP: Record<LinkDir, LinkDir> = { n: 's', s: 'n', e: 'w', w: 'e' };

describe('zones', () => {
  it('every link is symmetric', () => {
    for (const z of ZONES) {
      for (const dir of Object.keys(z.links).sort() as LinkDir[]) {
        const to = byId.get(z.links[dir]!)!;
        expect(to.links[OPP[dir]], `${z.id}.${dir} → ${to.id}`).toBe(z.id);
      }
    }
  });

  it('every zone has ≥ 3 npcs, exactly 2 lore tablets and a spawn inside the playable interior', () => {
    for (const z of ZONES) {
      expect(z.npcs.length, z.id).toBeGreaterThanOrEqual(3);
      expect(z.lore.length, z.id).toBe(2);
      const half = ZONE_SIZE[z.kind] / 2 - ZONE_MARGIN;
      expect(Math.abs(z.spawn.x)).toBeLessThanOrEqual(half);
      expect(Math.abs(z.spawn.z)).toBeLessThanOrEqual(half);
    }
    expect(byId.get('mirevale')!.spawn).toEqual({ x: 0, z: 6 });
  });

  it('fixed columns match the §3.1 table', () => {
    const rows: [ZoneId, string, string, string | null, string | null][] = [
      ['mirevale', 'town', 'grove', 'Grass', null],
      ['mire_route', 'route', 'grove', 'Grass', null],
      ['cinderhold', 'town', 'cinder', 'Fire', 'bloom'],
      ['saltmourn', 'town', 'salt', 'Water', 'ember'],
      ['solenne', 'town', 'capital', null, 'ascend'],
      ['umbral_observatory', 'story', 'vesper', 'Ghost', 'wraith'],
      ['the_rift', 'story', 'rift', null, 'ascend'],
    ];
    for (const [id, kind, biome, type, gate] of rows) {
      const z = byId.get(id)!;
      expect([z.kind, z.biome, z.type, z.gate]).toEqual([kind, biome, type, gate]);
    }
  });

  it('badges appear as gates in ZONE_ORDER order and every zone is reachable from mirevale', () => {
    const order: string[] = [];
    for (const id of ZONE_ORDER) {
      const g = byId.get(id)!.gate;
      if (g !== null && !order.includes(g)) order.push(g);
    }
    expect(order).toEqual([...BADGE_ORDER]);
    const seen = new Set<string>();
    const q: ZoneId[] = ['mirevale'];
    while (q.length) {
      const id = q.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const z = byId.get(id)!;
      for (const d of Object.keys(z.links).sort() as LinkDir[]) q.push(z.links[d]!);
    }
    expect(seen.size).toBe(21);
  });

  it('gates are reachable in badge order: with k badges the (k+1)-th gym town is reachable', () => {
    const gyms = LEAGUE.filter((l) => l.stage === 'gym').sort((a, b) => a.order - b.order);
    for (let k = 0; k < 8; k++) {
      const have = new Set<string>(BADGE_ORDER.slice(0, k));
      const seen = new Set<string>();
      const q: ZoneId[] = ['mirevale'];
      while (q.length) {
        const id = q.shift()!;
        if (seen.has(id)) continue;
        const z = byId.get(id)!;
        if (z.gate !== null && !have.has(z.gate)) continue;
        seen.add(id);
        for (const d of Object.keys(z.links).sort() as LinkDir[]) q.push(z.links[d]!);
      }
      expect(seen.has(gyms[k]!.zoneId), `gym ${k + 1} with ${k} badges`).toBe(true);
    }
  });

  it('towns have a shop, a healer and (except solenne) a gym; the 15 table zones are the roster-coverage set', () => {
    for (const z of ZONES) {
      if (z.kind === 'town') {
        expect(z.shop, z.id).not.toBeNull();
        expect(z.healer, z.id).toBe(true);
        if (z.id !== 'solenne') expect(z.gym, z.id).not.toBeNull();
      }
    }
    const withTables = ZONES.filter((z) => z.encounterTable !== null).map((z) => z.id);
    expect(withTables).toEqual([
      'mire_route', 'ash_route', 'saltmourn', 'tide_route', 'galvan_route', 'deepcut_route', 'hollow_route',
      'siege_route', 'skyrend', 'ascent_route', 'solenne', 'eclipse_shrine', 'umbral_observatory',
      'celestial_spire', 'the_rift',
    ]);
  });

  it('layout seeds are unique', () => {
    expect(new Set(ZONES.map((z) => z.layoutSeed)).size).toBe(21);
  });
});
