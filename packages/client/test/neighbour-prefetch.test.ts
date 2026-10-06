/**
 * Phase E3: the linked neighbours — `neighbourSpecsFor` (render's skirt input) and the §20.10.3 phase-5 prefetch plan
 * and pacing (`scene/prefetch.ts`).
 */
import { describe, expect, it } from 'vitest';
import { harvestStateFor, zone as zoneDef } from '@ewa/content';
import { zoneSurfaces } from '@ewa/render';
import type { AtlasSet } from '@ewa/render';
import { neighbourPrefetchPlan, PREFETCH, runPrefetch } from '../src/scene/prefetch';
import type { SpriteCatalog } from '../src/scene/spriteCatalog';
import { neighbourSpecsFor, withNeighbours, zoneSpecFor } from '../src/scene/zoneSpecFor';

const NO_FLAGS: ReadonlySet<string> = new Set();

function fakeCatalog(zones: Record<string, string[]>): SpriteCatalog {
  const set = (id: string): AtlasSet => ({
    id, size: 2048, normalScale: 0.5,
    albedo: { url: `/c/${id}.a.ktx2`, mips: [] }, normal: { url: `/c/${id}.n.ktx2`, mips: [] }, emissive: { url: `/c/${id}.e.ktx2`, mips: [] },
  } as unknown as AtlasSet);
  return {
    atlas: (id) => set(id), zoneAtlases: (z) => zones[z] ?? [], atlasesOf: () => [], bytesOf: () => 0, descriptor: () => null, speciesCount: 0,
  };
}

describe('E3 neighbourSpecsFor / withNeighbours', () => {
  it('mirevale: mire_route on the east, its west edge point, its own field and plan', () => {
    const z = zoneDef('mirevale');
    const nb = neighbourSpecsFor(z);
    expect(Object.keys(nb)).toEqual(Object.keys(z.links));
    const e = nb.e!;
    expect(e.id).toBe('mire_route');
    expect(e.layout).toBe('route');
    expect(e.edge).toEqual({ x: -104, z: 0 });
    expect(e.heightfield.zoneId).toBe('mire_route');
    expect(e.plan.roads.length).toBeGreaterThan(0);
  });

  it('withNeighbours adds them without touching the rest of the spec (zoneSpecFor itself is unchanged)', () => {
    const z = zoneDef('mirevale');
    const plain = zoneSpecFor(z, harvestStateFor(z.id, NO_FLAGS));
    const joined = withNeighbours(plain, z);
    expect('neighbours' in plain).toBe(false);
    const { neighbours, ...rest } = joined;
    expect(rest).toEqual(plain);
    expect(neighbours?.e?.id).toBe('mire_route');
  });
});

describe('E3 phase-5 neighbour prefetch', () => {
  it('plans the neighbours\' surfaces the current zone does not bind and their unbound atlases', () => {
    const z = zoneDef('mirevale');
    const plan = neighbourPrefetchPlan(z, NO_FLAGS, fakeCatalog({ mire_route: ['a-001', 'a-002'], mirevale: ['a-001'] }), new Set(['a-001']));
    expect(plan.zones).toContain('mire_route');
    const mine = new Set(zoneSurfaces(zoneSpecFor(z, 'intact')));
    for (const s of plan.surfaces) expect(mine.has(s)).toBe(false);
    expect(plan.atlasUrls).toEqual(['/c/a-002.a.ktx2', '/c/a-002.n.ktx2', '/c/a-002.e.ktx2']);
  });

  it('fetches materials then atlases, paced to the byte budget, and stops when cancelled', async () => {
    const plan = { zones: ['mire_route' as const], surfaces: ['dirt' as const], atlasUrls: ['/a', '/b', '/c'] };
    let clock = 0;
    const waits: number[] = [];
    const fetched: string[] = [];
    const token = { cancelled: false };
    const bytes = await runPrefetch(plan, token, {
      materials: async () => PREFETCH.bytesPerSecond,           // 1 s worth
      fetch: async (u) => { fetched.push(u); if (u === '/b') token.cancelled = true; return PREFETCH.bytesPerSecond / 2; },
      wait: async (ms) => { waits.push(Math.round(ms)); clock += ms; },
      now: () => clock,
    });
    expect(fetched).toEqual(['/a', '/b']);
    expect(bytes).toBe(PREFETCH.bytesPerSecond * 2);
    expect(waits).toEqual([1000, 500, 500]);
  });
});
