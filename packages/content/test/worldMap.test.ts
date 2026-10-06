import { describe, expect, it } from 'vitest';
import type { LinkDir, ZoneDef } from '../src/index';
import {
  MAP_STEP,
  VISITED_FLAGS,
  ZONES,
  ZONE_ORDER,
  computeMapPositions,
  isKnownFlag,
  validate,
  visitedFlag,
  zoneMapPositions,
  zoneMapSize,
} from '../src/index';

describe('Phase C3 world map positions', () => {
  const pos = zoneMapPositions();

  it('places every zone, each on its own cell, inside the grid', () => {
    expect(pos.size).toBe(ZONES.length);
    const { cols, rows } = zoneMapSize();
    const keys = new Set<string>();
    for (const z of ZONES) {
      const c = pos.get(z.id);
      expect(c, z.id).toBeDefined();
      expect(c!.x).toBeGreaterThanOrEqual(0);
      expect(c!.y).toBeGreaterThanOrEqual(0);
      expect(c!.x).toBeLessThan(cols);
      expect(c!.y).toBeLessThan(rows);
      keys.add(`${c!.x},${c!.y}`);
    }
    expect(keys.size).toBe(ZONES.length);
  });

  it('linked zones are grid neighbours in the link direction', () => {
    for (const z of ZONES) {
      const a = pos.get(z.id)!;
      for (const d of Object.keys(z.links) as LinkDir[]) {
        const b = pos.get(z.links[d]!)!;
        const [dx, dy] = MAP_STEP[d];
        expect([b.x - a.x, b.y - a.y], `${z.id}.${d}`).toEqual([dx, dy]);
      }
    }
  });

  it('Mirevale is on the west edge; the branches sit off the main road', () => {
    expect(pos.get('mirevale')!.x).toBe(0);
    const road = pos.get('mirevale')!.y;
    expect(pos.get('the_rift')!.y).toBe(road + 1);
    expect(pos.get('umbral_observatory')!.y).toBe(road - 1);
    expect(pos.get('celestial_spire')!.y).toBe(road - 1);
  });

  it('refuses clashing or unreachable layouts', () => {
    const base = ZONES[0]!;
    const lonely: ZoneDef = { ...ZONES[1]!, links: {} };
    expect(() => computeMapPositions([{ ...base, links: {} }, lonely])).toThrow(/unreachable/);
  });
});

describe('Phase C3 visited flags', () => {
  it('visited:<zone> is a known flag for every zone, and nothing else with the prefix is', () => {
    expect(VISITED_FLAGS.size).toBe(ZONE_ORDER.length);
    for (const id of ZONE_ORDER) expect(isKnownFlag(visitedFlag(id))).toBe(true);
    expect(isKnownFlag('visited:nowhere')).toBe(false);
  });

  it('the validate gate stays green', () => {
    expect(validate().errors).toEqual([]);
  });
});
