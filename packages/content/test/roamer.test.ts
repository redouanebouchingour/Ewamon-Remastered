/**
 * One roaming legendary per season (roamer.ts): the roamer of each season in turn; the route it is on is the same for
 * every caller, always one of its routes, never the same two periods running, and visits every route; the roamers
 * are legendaries the world already holds as statics.
 */
import { describe, expect, it } from 'vitest';
import { LEGENDARY_STATICS, ROAMERS, ROAM_PERIOD_MS, ROAM_ZONES, roamerMovesAt, roamerOf, roamerZoneAt, zone } from '../src/index';
import type { ZoneId } from '../src/index';

describe('the roaming legendary', () => {
  it('each season has its roamer, in turn', () => {
    expect([1, 2, 3, 4].map(roamerOf)).toEqual([ROAMERS[0], ROAMERS[1], ROAMERS[2], ROAMERS[0]]);
    expect(roamerOf(0)).toBe(ROAMERS[ROAMERS.length - 1]);
  });

  it('moves along its routes on a fixed schedule, never staying two periods, reaching every route', () => {
    const t0 = Date.UTC(2026, 9, 5);
    const seen = new Set<string>();
    let last = '';
    for (let p = 0; p < 400; p++) {
      const t = t0 + p * ROAM_PERIOD_MS + 1234;
      const z = roamerZoneAt(1, t);
      expect(roamerZoneAt(1, t)).toBe(z);
      expect(roamerZoneAt(1, t0 + p * ROAM_PERIOD_MS)).toBe(z);
      expect(ROAM_ZONES).toContain(z);
      expect(z).not.toBe(last);
      last = z;
      seen.add(z);
    }
    expect(seen.size).toBe(ROAM_ZONES.length);
    expect(roamerMovesAt(t0 + 5)).toBe(t0 + ROAM_PERIOD_MS);
    for (const id of ROAM_ZONES) expect(zone(id as ZoneId).kind).toBe('route');
  });

  it('the roamers are legendaries the world already holds', () => {
    const statics = new Set(LEGENDARY_STATICS.map((s) => s.species));
    for (const r of ROAMERS) expect(statics.has(r)).toBe(true);
  });
});
