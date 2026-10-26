/**
 * Planner stability (spec §40.1.4 as amended 2026-10-26): a build plans against the previous
 * manifest, so adding species leaves every existing atlas (id, members, cells, encoded bytes) as
 * it was; only the zones that would break the 8-bind cap move atlases.
 */
import { describe, expect, it } from 'vitest';
import type { PlanBaseline, ZonePlan } from '../src/plan.js';
import { atlasId, baselineFromManifest, planAtlases } from '../src/plan.js';
import type { ZoneSets } from '../src/zones.js';
import { ZONE_ORDER } from '../src/zones.js';
import { buildFixture, snapshotDir, syntheticSources, writeSyntheticAssets } from './helpers.js';

function zoneSets(entries: Partial<Record<(typeof ZONE_ORDER)[number], string[]>>): ZoneSets {
  const out: ZoneSets = new Map();
  for (const z of ZONE_ORDER) out.set(z, [...(entries[z] ?? [])].sort());
  return out;
}

/** The plan's home atlases as the next build's baseline. */
function asBaseline(plan: ZonePlan): PlanBaseline {
  return { atlases: plan.atlases.filter((a) => a.dupFor === null).map((a) => ({ id: a.id, species: [...a.species] })) };
}

function membership(plan: ZonePlan): Record<string, string[]> {
  return Object.fromEntries(plan.atlases.map((a) => [a.id, a.species]));
}

const species = Array.from({ length: 20 }, (_, i) => `sp${String(i).padStart(2, '0')}`);

describe('stable atlas planning', () => {
  it('without a baseline is the fresh plan, and re-planning against its own output changes nothing', () => {
    const sets = zoneSets({ mirevale: species.slice(0, 5), mire_route: species.slice(5, 14) });
    const fresh = planAtlases(species, sets);
    expect(fresh.stability.added).toEqual(fresh.atlases.map((a) => a.id));
    const again = planAtlases(species, sets, 8, new Map(), asBaseline(fresh));
    expect(membership(again)).toEqual(membership(fresh));
    expect(again.zones).toEqual(fresh.zones);
    expect(again.stability).toMatchObject({ kept: fresh.atlases.map((a) => a.id), changed: [], added: [], dropped: [], released: [] });
  });

  it('adding species keeps every baseline atlas and numbers the new ones after it', () => {
    const before = planAtlases(species, zoneSets({ mire_route: species.slice(0, 6) }));
    // `aa…` sort and walk first: a fresh plan would renumber and re-pair everything.
    const added = ['aa1', 'aa2', 'aa3'];
    const sets = zoneSets({ mirevale: ['aa1', 'aa2'], mire_route: [...species.slice(0, 6), 'aa3'] });
    const after = planAtlases([...species, ...added], sets, 8, new Map(), asBaseline(before));
    for (const a of before.atlases) expect(after.atlases.find((x) => x.id === a.id)!.species, a.id).toEqual(a.species);
    expect(after.stability.kept).toEqual(before.atlases.map((a) => a.id));
    expect(after.stability.added).toEqual([atlasId(10), atlasId(11)]);
    expect(after.home.get('aa1')).toBe(after.home.get('aa2'));
    const fresh = planAtlases([...species, ...added], sets);
    expect(fresh.atlases.filter((a) => before.atlases.some((b) => b.id === a.id && b.species.join() === a.species.join())).length).toBeLessThan(10);
  });

  it('a removed species frees its cell: the partner keeps its atlas and cell, an emptied id is reused first', () => {
    const before = planAtlases(species, zoneSets({}));
    expect(before.atlases[0]!.species).toEqual(['sp00', 'sp01']);
    expect(before.atlases[1]!.species).toEqual(['sp02', 'sp03']);
    const roster = species.filter((s) => !['sp00', 'sp02', 'sp03'].includes(s)).concat(['zz1', 'zz2']);
    const after = planAtlases(roster, zoneSets({}), 8, new Map(), asBaseline(before));
    expect(membership(after)['a-000']).toEqual(['sp01']);
    // zz1 + zz2 share no zone with sp01, so they open an atlas and take the emptied a-001.
    expect(membership(after)['a-001']).toEqual(['zz1', 'zz2']);
    expect(after.stability).toMatchObject({ changed: ['a-000', 'a-001'], added: [], dropped: [] });
    expect(after.stability.kept.length).toBe(8);
  });

  it('fills a free cell only with a species that shares a zone with its occupant, after the occupant', () => {
    const before = planAtlases(['bb', 'cc', 'dd'], zoneSets({ mirevale: ['bb', 'cc'], mire_route: ['dd'] }));
    expect(membership(before)).toEqual({ 'a-000': ['bb', 'cc'], 'a-001': ['dd'] });
    const zoneless = planAtlases(['aa', 'bb', 'cc', 'dd'], zoneSets({ mirevale: ['bb', 'cc'], mire_route: ['dd'] }), 8, new Map(), asBaseline(before));
    expect(membership(zoneless)).toEqual({ 'a-000': ['bb', 'cc'], 'a-001': ['dd'], 'a-002': ['aa'] });
    const shared = planAtlases(['aa', 'bb', 'cc', 'dd'], zoneSets({ mirevale: ['bb', 'cc'], mire_route: ['aa', 'dd'] }), 8, new Map(), asBaseline(before));
    // `aa` sorts first but takes the free cell: dd keeps cells 0-1.
    expect(membership(shared)).toEqual({ 'a-000': ['bb', 'cc'], 'a-001': ['dd', 'aa'] });
    expect(shared.stability).toMatchObject({ kept: ['a-000'], changed: ['a-001'], added: [] });
  });

  it('a zone over the cap releases only the pinned atlases it binds; re-formed pairs keep their ids', () => {
    // Three zones of 4 species each, packed 2 per atlas; then the_rift gets one species of each
    // atlas plus a new one: 7 binds under a cap of 4 unless the pinned atlases are re-matched.
    const zones = { mirevale: species.slice(0, 4), mire_route: species.slice(4, 8), cinderhold: species.slice(8, 12), ash_route: species.slice(12, 20) };
    const before = planAtlases(species, zoneSets(zones), 4);
    expect(before.atlases.length).toBe(10);
    const rift = ['sp00', 'sp02', 'sp04', 'sp06', 'sp08', 'sp10', 'new1'];
    const after = planAtlases([...species, 'new1'], zoneSets({ ...zones, the_rift: rift }), 4, new Map(), asBaseline(before));
    expect(after.zones.get('the_rift')!.length).toBeLessThanOrEqual(4);
    expect(after.duplicated).toEqual([]);
    expect(after.stability.releasedFor).toEqual(['the_rift']);
    expect(after.stability.released).toEqual(['a-000', 'a-001', 'a-002', 'a-003', 'a-004', 'a-005']);
    // ash_route's atlases were never in the way.
    for (const id of ['a-006', 'a-007', 'a-008', 'a-009']) expect(after.stability.kept).toContain(id);
    for (const z of ZONE_ORDER) expect(after.zones.get(z)!.length, z).toBeLessThanOrEqual(4);
  });

  it('falls back to releasing every atlas when pinning still needs more duplicates than a full re-plan', () => {
    // Found by a random search: released atlases re-matched among themselves still leave 6
    // duplicates under a cap of 3, where a full re-plan needs none.
    const ids = Array.from({ length: 18 }, (_, i) => `s${String(i).padStart(2, '0')}`);
    const pairs = [['s00', 's09'], ['s05', 's15'], ['s06', 's08'], ['s04', 's11'], ['s12', 's13'], ['s01', 's10'], ['s02', 's03'], ['s07', 's14']];
    const baseline: PlanBaseline = { atlases: pairs.map((species, i) => ({ id: atlasId(i), species })) };
    const sets = zoneSets({
      mirevale: ['s04', 's08', 's09', 's10', 's13', 's16'],
      mire_route: ['s03', 's09', 's15'],
      cinderhold: ['s00', 's01', 's06', 's07', 's12'],
      ash_route: ['s05', 's06', 's08', 's10', 's12', 's17'],
    });
    const after = planAtlases(ids, sets, 3, new Map(), baseline);
    expect(planAtlases(ids, sets, 3).duplicated).toEqual([]);
    expect(after.duplicated).toEqual([]);
    expect(after.stability.released).toEqual(baseline.atlases.map((a) => a.id));
    expect(after.stability.releasedFor.length).toBeGreaterThan(0);
    for (const z of ZONE_ORDER) expect(after.zones.get(z)!.length, z).toBeLessThanOrEqual(3);
  });

  it('baselineFromManifest skips duplicate atlases and orders species by their home cell', () => {
    const rect = (atlas: string, x: number, y: number) => ({ atlas, px: [x, y, 1024, 1024] });
    const base = baselineFromManifest({
      atlases: [
        { id: 'a-001', species: ['aa', 'zz'] },
        { id: 'a-000', species: ['mm'] },
        { id: 'a-the_rift-dup-0', species: ['aa'] },
      ],
      sprites: {
        zz: { front: rect('a-001', 1024, 0), back: rect('a-001', 0, 0) },
        aa: { front: rect('a-001', 1024, 1024), back: rect('a-001', 0, 1024) },
        mm: { front: rect('a-000', 1024, 0), back: rect('a-000', 0, 0) },
      },
    });
    expect(base.atlases).toEqual([
      { id: 'a-000', species: ['mm'] },
      { id: 'a-001', species: ['zz', 'aa'] },
    ]);
  });
});

describe('stable rebuild (pipeline)', () => {
  it('adding a species rewrites no existing atlas file; --replan re-pairs from scratch', async () => {
    const ids = ['stab_b', 'stab_c', 'stab_d'];
    const fx = await buildFixture(ids, 128);
    const first = snapshotDir(fx.outDir);
    expect(fx.result.manifest!.atlases.map((a) => [a.id, a.species])).toEqual([
      ['a-000', ['stab_b', 'stab_c']],
      ['a-001', ['stab_d']],
    ]);
    // stab_a sorts first and shares no zone: a fresh plan would pair it with stab_b.
    const more = [...ids, 'stab_a'];
    await writeSyntheticAssets(fx.assetsDir, more);
    const res = await fx.run({ sources: syntheticSources(fx.assetsDir, more), species: more });
    const second = snapshotDir(fx.outDir);
    expect(res.plan!.stability).toMatchObject({ kept: ['a-000', 'a-001'], changed: [], added: ['a-002'] });
    const atlasFiles = [...first.keys()].filter((f) => f.startsWith('atlases/'));
    expect(atlasFiles.length).toBe(2 * 3 * 4);
    for (const f of atlasFiles) expect(second.get(f)!.equals(first.get(f)!), f).toBe(true);
    const fresh = [...second.keys()].filter((f) => f.startsWith('atlases/') && !first.has(f));
    expect(fresh.length).toBe(3 * 4);
    expect(fresh.every((f) => f.startsWith('atlases/a-002.'))).toBe(true);

    const replanned = await fx.run({ sources: syntheticSources(fx.assetsDir, more), species: more, baselinePath: null });
    expect(replanned.manifest!.atlases.map((a) => a.species)).toEqual([
      ['stab_a', 'stab_b'],
      ['stab_c', 'stab_d'],
    ]);
  }, 300_000);
});
