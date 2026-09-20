import { describe, expect, it } from 'vitest';
import { MaxRectsPacker, packSquares, rectsOverlap } from '../src/pack.js';
import { atlasId, planAtlases, speciesSequence } from '../src/plan.js';
import type { ZoneSets } from '../src/zones.js';
import { ZONE_ORDER } from '../src/zones.js';
import { rng } from './helpers.js';

function zoneSets(entries: Partial<Record<(typeof ZONE_ORDER)[number], string[]>>): ZoneSets {
  const out: ZoneSets = new Map();
  for (const z of ZONE_ORDER) out.set(z, [...(entries[z] ?? [])].sort());
  return out;
}

describe('MaxRects packer', () => {
  it('never overlaps and stays inside the bin', () => {
    const rand = rng(7);
    const packer = new MaxRectsPacker(512, 512);
    const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
    for (let i = 0; i < 200; i++) {
      const w = 8 + Math.floor(rand() * 90);
      const h = 8 + Math.floor(rand() * 90);
      const r = packer.insert(w, h);
      if (!r) continue;
      expect(r.x + r.w).toBeLessThanOrEqual(512);
      expect(r.y + r.h).toBeLessThanOrEqual(512);
      for (const q of placed) expect(rectsOverlap(r, q)).toBe(false);
      placed.push(r);
    }
    expect(placed.length).toBeGreaterThan(20);
  });

  it('packSquares(4, 1024, 2048) is the fixed 2 × 2 layout', () => {
    expect(packSquares(4, 1024, 2048).map((r) => [r.x, r.y])).toEqual([
      [0, 0],
      [1024, 0],
      [0, 1024],
      [1024, 1024],
    ]);
    expect(() => packSquares(5, 1024, 2048)).toThrow();
  });
});

describe('atlas planner', () => {
  const species = Array.from({ length: 30 }, (_, i) => `sp${String(i).padStart(2, '0')}`);

  it('walks ZONE_ORDER, appends unplaced species sorted, then the home species', () => {
    const sets = zoneSets({ mirevale: ['sp05', 'sp03'], mire_route: ['sp03', 'sp10', 'sp01'], the_rift: ['sp29'] });
    const seq = speciesSequence(species, sets);
    expect(seq.slice(0, 5)).toEqual(['sp03', 'sp05', 'sp01', 'sp10', 'sp29']);
    expect(seq.length).toBe(30);
    expect(new Set(seq).size).toBe(30);
    expect(seq.slice(5)).toEqual(species.filter((s) => !['sp03', 'sp05', 'sp01', 'sp10', 'sp29'].includes(s)));
  });

  it('pairs the sequence into a-NNN atlases, every species once, home = first placement', () => {
    const plan = planAtlases(species, zoneSets({}));
    expect(plan.atlases.length).toBe(15);
    expect(plan.atlases[0]!.id).toBe(atlasId(0));
    const all = plan.atlases.flatMap((a) => a.species);
    expect(all.length).toBe(30);
    expect(new Set(all).size).toBe(30);
    for (const s of species) expect(plan.home.get(s)).toBe(plan.atlases.find((a) => a.species.includes(s))!.id);
    expect(plan.duplicated).toEqual([]);
    for (const z of ZONE_ORDER) expect(plan.zones.get(z)).toEqual([]);
  });

  it('a zone binds ceil(new / 2) atlases when its species are contiguous', () => {
    const plan = planAtlases(species, zoneSets({ mirevale: species.slice(0, 5), mire_route: species.slice(5, 14) }));
    expect(plan.zones.get('mirevale')!.length).toBe(3);
    // mire_route: 9 new species, the first shares mirevale's third atlas -> 5 atlases.
    expect(plan.zones.get('mire_route')!.length).toBe(5);
    expect(plan.bindStats.mire_route!.atlases).toBe(5);
  });

  it('duplicates the earliest-placed species into zone-local atlases when a zone exceeds the cap', () => {
    // 12 zones each introduce one species; the last zone needs all 12 (each in a different atlas).
    const entries: Partial<Record<(typeof ZONE_ORDER)[number], string[]>> = {};
    ZONE_ORDER.slice(0, 12).forEach((z, i) => {
      entries[z] = [species[i * 2]!, species[i * 2 + 1]!];
    });
    entries.the_rift = ZONE_ORDER.slice(0, 12).map((_, i) => species[i * 2]!);
    const plan = planAtlases(species, zoneSets(entries), 8);
    const rift = plan.zones.get('the_rift')!;
    expect(rift.length).toBeLessThanOrEqual(8);
    expect(plan.bindStats.the_rift!.duplicated.length).toBeGreaterThan(0);
    // Earliest placed first: sp00 (mirevale's atlas) is the first duplicate.
    expect(plan.bindStats.the_rift!.duplicated).toContain('sp00');
    const dupAtlases = plan.atlases.filter((a) => a.dupFor === 'the_rift');
    expect(dupAtlases.length).toBeGreaterThan(0);
    for (const a of dupAtlases) {
      expect(a.id.startsWith('a-the_rift-dup-')).toBe(true);
      expect(a.species.length).toBeLessThanOrEqual(2);
    }
    for (const s of plan.duplicated) expect(plan.placements.get(s)!.length).toBe(2);
    // Other zones untouched.
    expect(plan.zones.get('mirevale')).toEqual([atlasId(0)]);
    // Atlas ids sorted: a-000 … then a-the_rift-dup-N.
    const ids = plan.atlases.map((a) => a.id);
    expect(ids).toEqual([...ids].sort());
  });

  it('throws when a zone cannot fit even with duplication (cap too small)', () => {
    expect(() => planAtlases(species, zoneSets({ mirevale: species.slice(0, 10) }), 1)).toThrow(/cap 1/);
  });
});
