/**
 * Phase D4 — shinies (migration 0003_shiny): `creature_instances.is_shiny`, `dex_entries.shiny_caught`,
 * `listings.is_shiny`. A creature carries `isShiny: true` only when it is one (absent otherwise, so every
 * non-shiny CreatureInstance keeps its exact pre-D4 shape); the dex records shiny catches; the market
 * denormalises the flag and filters on it.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import type { AnyDb } from '../src/db';
import { creatureRepo } from '../src/repos/creatures';
import { marketRepo } from '../src/repos/market';
import { progressRepo } from '../src/repos/progress';
import { T0, at, mkCreature, mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

describe('Phase D4 shinies in persist', () => {
  it('0003_shiny adds three boolean NOT NULL DEFAULT false columns', async () => {
    const rows = await db.transaction(async (tx) => {
      const r = await tx.execute<{ table_name: string; column_name: string; data_type: string; is_nullable: string; column_default: string }>(
        sql`select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns
            where (table_name, column_name) in (('creature_instances', 'is_shiny'), ('dex_entries', 'shiny_caught'), ('listings', 'is_shiny'))
            order by table_name`,
      );
      return [...r.rows];
    });
    expect(rows.map((r) => `${r.table_name}.${r.column_name}`)).toEqual(['creature_instances.is_shiny', 'dex_entries.shiny_caught', 'listings.is_shiny']);
    for (const r of rows) expect([r.data_type, r.is_nullable, r.column_default]).toEqual(['boolean', 'NO', 'false']);
  });

  it('a shiny creature round-trips with isShiny: true; a normal one has no isShiny key at all', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx);
      const plain = await mkCreature(tx, p, { kind: 'party', index: 0 });
      const shiny = await mkCreature(tx, p, { kind: 'party', index: 1 }, { isShiny: true });
      expect('isShiny' in plain).toBe(false);
      expect(shiny.isShiny).toBe(true);
      const party = await creatureRepo.party(tx, p);
      expect(party.find((c) => c.id === shiny.id)!.isShiny).toBe(true);
      expect('isShiny' in party.find((c) => c.id === plain.id)!).toBe(false);
      // an update keeps the flag
      await creatureRepo.update(tx, { ...shiny, hp: 1 });
      expect((await creatureRepo.byId(tx, shiny.id))!.isShiny).toBe(true);
    });
  });

  it('markCaught records a shiny catch once and never clears it; dex() lists the species under shiny', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx);
      await progressRepo.markCaught(tx, p, 'glimfin', 'normal', false, T0);
      expect((await progressRepo.dex(tx, p)).shiny).toEqual([]);
      await progressRepo.markCaught(tx, p, 'glimfin', 'normal', false, at(1), true);
      await progressRepo.markCaught(tx, p, 'mossling', 'dusk', false, at(2), true);
      await progressRepo.markCaught(tx, p, 'glimfin', 'normal', false, at(3), false);
      expect((await progressRepo.dex(tx, p)).shiny).toEqual(['glimfin', 'mossling']);
    });
  });

  it('a listing denormalises isShiny and the search filters on it', async () => {
    await db.transaction(async (tx) => {
      const seller = await mkPlayer(tx);
      await mkCreature(tx, seller, { kind: 'party', index: 0 });
      const shiny = await mkCreature(tx, seller, { kind: 'party', index: 1 }, { speciesId: 'zz_shinyprobe', isShiny: true });
      const plain = await mkCreature(tx, seller, { kind: 'party', index: 2 }, { speciesId: 'zz_shinyprobe' });
      const a = await marketRepo.create(tx, { sellerId: seller, creatureId: shiny.id, startingBid: 100, buyNowPrice: null, durationHours: 12 }, T0);
      const b = await marketRepo.create(tx, { sellerId: seller, creatureId: plain.id, startingBid: 100, buyNowPrice: null, durationHours: 12 }, T0);
      expect(a.isShiny).toBe(true);
      expect(b.isShiny).toBe(false);
      const only = await marketRepo.search(tx, { search: 'zz_shinyprobe', isShiny: true, now: at(1) });
      expect(only.rows.map((r) => r.id)).toEqual([a.id]);
      const none = await marketRepo.search(tx, { search: 'zz_shinyprobe', isShiny: false, now: at(1) });
      expect(none.rows.map((r) => r.id)).toEqual([b.id]);
      expect((await marketRepo.search(tx, { search: 'zz_shinyprobe', now: at(1) })).total).toBe(2);
    });
  });
});
