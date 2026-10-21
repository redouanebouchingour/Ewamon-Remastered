/**
 * A living ecosystem (ecosystem.ts): the food chain (hand rows share a zone, no species both hunts and is hunted by
 * the same one, no legendary, every zone with a table has one), the seasonal migrations (neighbours only, a non-empty
 * level band, water only where the target has water, drawn the same way every time), and the weekly reading (bounded,
 * as authored without history, an overhunted prey falls and its predators rise, last week fades, the honor tilt).
 */
import { describe, expect, it } from 'vitest';
import {
  ECO_FACTOR_MAX,
  ECO_FACTOR_MIN,
  ECO_MIN_TAKES,
  FOOD_CHAIN_HAND,
  MIGRANT_SOURCE_FACTOR,
  MIGRANT_WEIGHT,
  MIGRATIONS_PER_SEASON,
  MIGRATION_ROUTES,
  SEASON_ANCHOR_MS,
  allZones,
  ecoWeek,
  ecoWeekStart,
  ecosystemOf,
  encounterTableFor,
  foodChain,
  foodChainAmong,
  lightLevel,
  migrantSlot,
  SPECIES,
  migrationsFor,
  neighbourZones,
  scarce,
  shadowLevel,
  surging,
} from '../src/index';
import type { EcoInput, SpeciesTake, ZoneId } from '../src/index';

const byId = new Map(SPECIES.map((s) => [s.id, s]));
const species = (id: string) => byId.get(id)!;
const tableSpecies = (z: ZoneId): string[] => [...new Set(encounterTableFor(z)?.slots.map((s) => s.species) ?? [])];
const withTable = allZones().filter((z) => z.encounterTable !== null);
const input = (zoneId: ZoneId, thisWeek: SpeciesTake[] = [], o: Partial<EcoInput> = {}): EcoInput => ({ zoneId, season: 0, thisWeek, lastWeek: [], shadow: 0, light: 0, ...o });
const take = (speciesId: string, caught: number, ko = 0): SpeciesTake => ({ speciesId, caught, ko });

describe('ecosystem: the food chain', () => {
  it('every hand row names two species that share a zone table', () => {
    for (const h of FOOD_CHAIN_HAND) {
      const shared = withTable.some((z) => tableSpecies(z.id).includes(h.predator) && tableSpecies(z.id).includes(h.prey));
      expect(shared, `${h.predator} > ${h.prey}`).toBe(true);
    }
  });

  it('every zone with a table has a food chain, among its own species, with no legendary and no two-way link', () => {
    for (const z of withTable) {
      const links = foodChain(z.id);
      expect(links.length, z.id).toBeGreaterThan(0);
      const ids = new Set(tableSpecies(z.id));
      const pairs = new Set(links.map((k) => `${k.predator}>${k.prey}`));
      for (const k of links) {
        expect(ids.has(k.predator) && ids.has(k.prey), `${z.id} ${k.predator}>${k.prey}`).toBe(true);
        expect(k.predator).not.toBe(k.prey);
        expect(species(k.predator).legendary || species(k.prey).legendary).toBe(false);
        expect(pairs.has(`${k.prey}>${k.predator}`), `${z.id} two-way ${k.predator}<>${k.prey}`).toBe(false);
      }
    }
  });

  it('the type rule: a bigger hunter that hits super effectively and is not hit back', () => {
    // pebfist (Fighting/Ground) hits pebblit (Rock) hard and is bigger; pebblit hits neither of its types hard
    expect(foodChainAmong(['pebfist', 'pebblit'])).toEqual([{ predator: 'pebfist', prey: 'pebblit', source: 'type' }]);
    // one family never hunts itself (budwing grows into bloomdrake)
    expect(foodChainAmong(['bloomdrake', 'budwing'])).toEqual([]);
  });

  it('a seasonal migrant joins the chain of the zone it moved into, still with no two-way link', () => {
    for (let season = 1; season <= 40; season++) {
      for (const m of migrationsFor(season)) {
        const links = foodChainAmong([...tableSpecies(m.to), m.species]);
        const pairs = new Set(links.map((k) => `${k.predator}>${k.prey}`));
        for (const k of links) expect(pairs.has(`${k.prey}>${k.predator}`)).toBe(false);
      }
    }
  });
});

describe('ecosystem: seasonal migration', () => {
  it('every route moves a species of its home table to a neighbour that lacks it, at a level the species can be', () => {
    for (const r of MIGRATION_ROUTES) {
      const label = `${r.species} ${r.from}->${r.to}`;
      expect(neighbourZones(r.from, r.to), label).toBe(true);
      expect(tableSpecies(r.from), label).toContain(r.species);
      expect(tableSpecies(r.to), label).not.toContain(r.species);
      expect(species(r.species).legendary, label).toBe(false);
      const slot = migrantSlot(r);
      expect(slot, label).not.toBeNull();
      expect(slot!.levelMin).toBeLessThanOrEqual(slot!.levelMax);
      expect(slot!.weight).toBe(MIGRANT_WEIGHT);
      // a water migrant only goes where the target's water is fished or surfed already
      if (slot!.medium === 'water') expect(encounterTableFor(r.to)!.slots.some((s) => s.medium === 'water'), label).toBe(true);
    }
  });

  it('neighbours: linked zones, or two zones one table-less town apart; never a zone and itself', () => {
    expect(neighbourZones('tide_route', 'galvan_route')).toBe(true); // through Stormrook
    expect(neighbourZones('siege_route', 'skyrend')).toBe(true);
    expect(neighbourZones('mire_route', 'galvan_route')).toBe(false);
    expect(neighbourZones('skyrend', 'skyrend')).toBe(false);
  });

  it('each season draws the same few, one per target and per species; none before the first season; every route comes up', () => {
    expect(migrationsFor(0)).toEqual([]);
    const drawn = new Set<string>();
    for (let season = 1; season <= 60; season++) {
      const m = migrationsFor(season);
      expect(m.length).toBe(MIGRATIONS_PER_SEASON);
      expect(new Set(m.map((r) => r.to)).size).toBe(m.length);
      expect(new Set(m.map((r) => r.species)).size).toBe(m.length);
      expect(migrationsFor(season)).toBe(m);
      for (const r of m) drawn.add(`${r.species}:${r.to}`);
    }
    expect(drawn.size).toBe(MIGRATION_ROUTES.length);
  });

  it('a migrant joins its target table and weighs half at home', () => {
    const season = 1;
    const [m] = migrationsFor(season);
    const into = ecosystemOf(input(m!.to, [], { season }))!;
    expect(into.migrantsIn).toContainEqual(m);
    expect(into.table.slots.some((s) => s.species === m!.species && s.weight === MIGRANT_WEIGHT)).toBe(true);
    expect(into.species.find((s) => s.speciesId === m!.species)!.cause).toBe('migrant');
    const home = ecosystemOf(input(m!.from, [], { season }))!;
    const authored = encounterTableFor(m!.from)!.slots;
    home.table.slots.forEach((s, i) => {
      if (s.species === m!.species && s.tier !== 'alpha') expect(s.weight).toBeCloseTo(authored[i]!.weight * MIGRANT_SOURCE_FACTOR);
    });
  });
});

describe('ecosystem: the weekly reading', () => {
  it('weeks run Monday to Monday from the first season', () => {
    expect(ecoWeek(SEASON_ANCHOR_MS)).toBe(0);
    expect(ecoWeek(SEASON_ANCHOR_MS - 1)).toBe(-1);
    expect(ecoWeekStart(3)).toBe(SEASON_ANCHOR_MS + 3 * 7 * 86_400_000);
    expect(ecoWeek(ecoWeekStart(3) + 1)).toBe(3);
  });

  it('a zone without a table has no reading; one without history rolls as authored', () => {
    expect(ecosystemOf(input('mirevale'))).toBeNull();
    for (const z of withTable) {
      const e = ecosystemOf(input(z.id))!;
      expect(e.table.slots).toEqual(encounterTableFor(z.id)!.slots);
      expect(e.judged).toBe(false);
    }
  });

  it('below the minimum of takes nothing is judged', () => {
    const e = ecosystemOf(input('deepcut_route', [take('pebblit', ECO_MIN_TAKES - 1)]))!;
    expect(e.judged).toBe(false);
    expect(e.table.slots).toEqual(encounterTableFor('deepcut_route')!.slots);
  });

  it('an overcaught prey turns scarce and its predators surge; the reading says why', () => {
    const e = ecosystemOf(input('deepcut_route', [take('pebblit', 30, 10), take('embrock', 2)]))!;
    expect(e.judged).toBe(true);
    const pebblit = e.species.find((s) => s.speciesId === 'pebblit')!;
    expect(pebblit.factor).toBeLessThan(1);
    expect(pebblit.cause).toBe('hunted');
    expect(pebblit.caught).toBe(30);
    expect(pebblit.ko).toBe(10);
    for (const hunter of pebblit.huntedBy) {
      const h = e.species.find((s) => s.speciesId === hunter)!;
      expect(h.factor, hunter).toBeGreaterThan(1);
      expect(h.cause).toBe('feeding');
    }
    expect(scarce(e).map((s) => s.speciesId)).toContain('pebblit');
    expect(surging(e).length).toBeGreaterThan(0);
  });

  it('every slot stays within 0.5x..2x of its authored weight, whatever the takes', () => {
    for (const z of withTable) {
      const ids = tableSpecies(z.id);
      for (let k = 0; k < ids.length; k++) {
        const takes = ids.map((id, i) => take(id, i === k ? 500 : i % 3, i === k ? 50 : 0));
        const e = ecosystemOf(input(z.id, takes, { shadow: 4, light: 4, season: 3 }))!;
        const authored = encounterTableFor(z.id)!.slots;
        authored.forEach((a, i) => {
          const w = e.table.slots[i]!.weight;
          expect(w / a.weight).toBeGreaterThanOrEqual(ECO_FACTOR_MIN - 1e-9);
          expect(w / a.weight).toBeLessThanOrEqual(ECO_FACTOR_MAX + 1e-9);
        });
      }
    }
  });

  it('a species left alone recovers: last week presses at half, the week after not at all', () => {
    const heavy = [take('pebblit', 12), take('embrock', 3), take('fennorange', 3)];
    const now = ecosystemOf(input('deepcut_route', heavy))!.species.find((s) => s.speciesId === 'pebblit')!.factor;
    const next = ecosystemOf(input('deepcut_route', [take('embrock', 6), take('fennorange', 6)], { lastWeek: heavy }))!.species.find((s) => s.speciesId === 'pebblit')!.factor;
    const after = ecosystemOf(input('deepcut_route', [take('embrock', 6), take('fennorange', 6)]))!.species.find((s) => s.speciesId === 'pebblit')!.factor;
    expect(now).toBeLessThan(next);
    expect(next).toBeLessThan(after);
    expect(after).toBe(1);
  });

  it('honor tilts it: a darkened zone raises its Ghost species (Dark ones in the roll), a lit zone its rare slots', () => {
    const dark = ecosystemOf(input('hollow_route', [], { shadow: 4 }))!;
    const authored = encounterTableFor('hollow_route')!.slots;
    dark.table.slots.forEach((s, i) => {
      const t = species(s.species).types;
      const ghostOnly = t.includes('Ghost') && !t.includes('Dark');
      expect(s.weight / authored[i]!.weight, s.species).toBeCloseTo(ghostOnly ? 2 : 1);
    });
    // a Dark species is not doubled in the table (rollWild weighs it), but the reading shows it
    expect(dark.species.find((s) => s.speciesId === 'darkone')!.factor).toBeGreaterThan(1);
    expect(dark.species.find((s) => s.speciesId === 'darkone')!.cause).toBe('shadow');
    const lit = ecosystemOf(input('hollow_route', [], { light: 2 }))!;
    lit.table.slots.forEach((s, i) => expect(s.weight / authored[i]!.weight, s.species).toBeCloseTo(s.tier === 'rare' ? 1.5 : 1));
  });

  it('the light level mirrors the shadow level', () => {
    expect(lightLevel(90, 10)).toBe(shadowLevel(10, 90));
    expect(lightLevel(90, 10)).toBe(4);
    expect(lightLevel(10, 90)).toBe(0);
  });
});
