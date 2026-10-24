/**
 * Followers with field powers (SPEC §3.18): the powers by type, the lead, the spots layer (validate rule 13 checks the
 * geometry), the daily re-arm and loot, the glide plan on the sculpted fields, the ghost haunts, the dark places. The
 * spots never touch a heightfield: the digests stay what they were.
 */
import { describe, expect, it } from 'vitest';
import {
  BRAMBLES,
  DIG_LOOT,
  DIG_SPOTS,
  DIVE_SPOTS,
  FIELD_POWERS,
  FIELD_POWER_TEXT,
  GLIDE,
  allZones,
  brambleFlag,
  brambleSolidsFor,
  bramblesFor,
  cliffSample,
  digFlag,
  diveFlag,
  diveWater,
  fieldDayKey,
  fieldLead,
  fieldLoot,
  fieldPowersOf,
  fieldSpotReady,
  getHeightfield,
  glideAltitude,
  hauntPath,
  hauntPosition,
  HAUNT,
  isDarkHere,
  isWalkable,
  planGlide,
  reachFromSpawn,
  sampleHeight,
  zone,
  zonePlan,
} from '../src/index';
import type { GlidePlan, ZoneId } from '../src/index';

describe('powers by type', () => {
  it('Flying glides, Fire lights, Ground digs, Psychic senses, Water dives; a dual type has both', () => {
    expect(fieldPowersOf(['Flying'])).toEqual(['glide']);
    expect(fieldPowersOf(['Fire', 'Flying'])).toEqual(['light', 'glide']);
    expect(fieldPowersOf(['Ground', 'Water'])).toEqual(['dig', 'dive']);
    expect(fieldPowersOf(['Psychic'])).toEqual(['sense']);
    expect(fieldPowersOf(['Grass', 'Bug'])).toEqual([]);
    for (const p of FIELD_POWERS) expect(`${FIELD_POWER_TEXT[p].label} ${FIELD_POWER_TEXT[p].does}`).not.toMatch(/\u2014/);
  });

  it('the lead is the first creature still standing', () => {
    expect(fieldLead([{ hp: 0, id: 'a' }, { hp: 3, id: 'b' }])?.id).toBe('b');
    expect(fieldLead([{ hp: 0 }])).toBeNull();
  });
});

describe('the spots layer', () => {
  it('lives outside ZoneDef: no zone carries a bramble, a dig or a dive spot', () => {
    for (const z of allZones()) expect(Object.keys(z).some((k) => /bramble|dig|dive/i.test(k))).toBe(false);
  });

  it('every route has a camp to dig at and brambles to burn; dive spots are open water', () => {
    const routes = allZones().filter((z) => z.kind === 'route').map((z) => z.id);
    for (const r of routes) {
      expect(DIG_SPOTS[r]?.length, r).toBe(1);
      expect(BRAMBLES[r]?.length, r).toBe(2);
    }
    for (const [id, spots] of Object.entries(DIVE_SPOTS) as [ZoneId, { x: number; z: number }[]][]) {
      const h = getHeightfield(id);
      for (const s of spots) expect(diveWater(h, s.x, s.z), `${id} (${s.x}, ${s.z})`).toBe(true);
    }
  });

  it('flags fit the 64-character story_flags column', () => {
    for (const [id, list] of Object.entries(BRAMBLES) as [ZoneId, { id: string }[]][]) for (const b of list) expect(brambleFlag(id, b.id).length).toBeLessThanOrEqual(64);
    for (const [id, list] of Object.entries(DIG_SPOTS) as [ZoneId, { id: string }[]][]) for (const b of list) expect(digFlag(id, b.id).length).toBeLessThanOrEqual(64);
    for (const [id, list] of Object.entries(DIVE_SPOTS) as [ZoneId, { id: string }[]][]) for (const b of list) expect(diveFlag(id, b.id).length).toBeLessThanOrEqual(64);
  });

  it('a burnt bramble no longer blocks', () => {
    const z: ZoneId = 'ash_route';
    const all = brambleSolidsFor(z, new Set());
    expect(all.length).toBe(bramblesFor(z).length);
    expect(brambleSolidsFor(z, new Set([brambleFlag(z, bramblesFor(z)[0]!.id)])).length).toBe(all.length - 1);
  });

  it('digs and dives re-arm when the UTC day turns; the loot is a fixed draw per seed', () => {
    const t = Date.UTC(2026, 9, 21, 23, 0);
    expect(fieldSpotReady(null, t)).toBe(true);
    expect(fieldSpotReady(t - 3_600_000, t)).toBe(false);
    expect(fieldSpotReady(t, t + 2 * 3_600_000)).toBe(true);
    expect(fieldDayKey(t)).toBe('2026-10-21');
    const a = fieldLoot(DIG_LOOT, 'p:mire_route:camp:2026-10-21');
    expect(fieldLoot(DIG_LOOT, 'p:mire_route:camp:2026-10-21')).toEqual(a);
    expect(DIG_LOOT).toContainEqual(a);
    const seen = new Set(Array.from({ length: 200 }, (_, i) => fieldLoot(DIG_LOOT, `p${i}`).item));
    expect(seen.size).toBeGreaterThan(4);
  });
});

/** The first glide on a zone's reachable ground, scanning 1 m cells and 8 headings off each cliff edge. */
function firstGlide(zoneId: ZoneId): GlidePlan | null {
  const h = getHeightfield(zoneId);
  const reach = reachFromSpawn(zoneId);
  for (let x = -70; x <= 70; x += 1) {
    for (let z = -70; z <= 70; z += 1) {
      if (!isWalkable(h, x, z)) continue;
      for (let a = 0; a < 8; a++) {
        const dx = Math.cos((a * Math.PI) / 4);
        const dz = Math.sin((a * Math.PI) / 4);
        if (isWalkable(h, x + dx * 0.5, z + dz * 0.5)) continue;
        const p = planGlide(h, x, z, dx, dz, (px, pz) => isWalkable(h, px, pz), reach);
        if (p !== null) return p;
      }
    }
  }
  return null;
}

describe('the glide', () => {
  it('every route has somewhere to glide; each landing is lower, walkable and reached from the spawn', () => {
    for (const z of allZones().filter((x) => x.kind === 'route')) {
      const p = firstGlide(z.id);
      expect(p, z.id).not.toBeNull();
      const h = getHeightfield(z.id);
      const lx = p!.x0 + p!.dx * p!.dist;
      const lz = p!.z0 + p!.dz * p!.dist;
      expect(isWalkable(h, lx, lz)).toBe(true);
      expect(p!.topY - p!.landY).toBeGreaterThanOrEqual(GLIDE.minDropM);
      expect(p!.dist).toBeLessThanOrEqual(GLIDE.maxRunM);
      // the flight's line never runs into the ground before the landing
      for (let t = 0; t < p!.dist; t += 0.25) expect(glideAltitude(h, p!, t)).toBeGreaterThanOrEqual(sampleHeight(h, p!.x0 + p!.dx * t, p!.z0 + p!.dz * t) - 1e-6);
    }
  });

  it('no glide on flat ground, from an unstandable take-off, or along a cliff the standable rule refuses to land under', () => {
    const z = zone('mirevale');
    const h = getHeightfield(z.id);
    const reach = reachFromSpawn(z.id);
    expect(planGlide(h, z.spawn.x, z.spawn.z, 1, 0, (x, zz) => isWalkable(h, x, zz), reach)).toBeNull();
    const p = firstGlide('mire_route')!;
    const hm = getHeightfield('mire_route');
    expect(planGlide(hm, p.x0, p.z0, p.dx, p.dz, () => false, reachFromSpawn('mire_route'))).toBeNull();
    expect(planGlide(hm, p.x0, p.z0, p.dx, p.dz, (x, zz) => isWalkable(hm, x, zz), reachFromSpawn('mire_route'))).toEqual(p);
    expect(planGlide(hm, p.x0, p.z0, 0, 0, (x, zz) => isWalkable(hm, x, zz), reachFromSpawn('mire_route'))).toBeNull();
  });

  it('cliff samples are steep, unwalkable and dry', () => {
    const h = getHeightfield('deepcut_route');
    let n = 0;
    for (let x = -60; x < 60; x += 0.5) for (let z = -60; z < 60; z += 0.5) if (cliffSample(h, x, z)) { n++; expect(isWalkable(h, x, z)).toBe(false); }
    expect(n).toBeGreaterThan(100);
  });
});

describe('ghost haunts and dark places', () => {
  it('a haunt loops through the zone tall grass, the same for everyone, and moves at a walk', () => {
    const patches = zonePlan('mire_route').grassPatches;
    const path = hauntPath('owner-1', 'mire_route', patches);
    expect(path.length).toBe(Math.min(HAUNT.patches, patches.length));
    expect(hauntPath('owner-1', 'mire_route', patches)).toEqual(path);
    for (const p of path) expect(patches.some((g) => Math.hypot(g.x - p[0], g.z - p[1]) < 1)).toBe(true);
    const a = hauntPosition(path, 1_000_000)!;
    const b = hauntPosition(path, 1_001_000)!;
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThanOrEqual(HAUNT.speedMps + 1e-6);
    expect(hauntPath('x', 'mirevale', [])).toEqual([]);
    expect(hauntPosition([], 0)).toBeNull();
  });

  it('the rift and the shrines are dark at any hour; elsewhere night or a deep shadow', () => {
    expect(isDarkHere('the_rift', 1, 0)).toBe(true);
    expect(isDarkHere('mire_route', 1, 0)).toBe(false);
    expect(isDarkHere('mire_route', 0.1, 0)).toBe(true);
    expect(isDarkHere('mire_route', 1, 3)).toBe(true);
  });
});
