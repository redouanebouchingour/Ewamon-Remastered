/**
 * Dex research (migration 0025_dex_research): `dex_entries.counters` / `first_seen_zone` / `viewed_at` and the
 * `dex_rewards` table. markSeen is an upsert that counts every sighting, markCaught counts catches (variants, alphas),
 * bumpCounter(s) only touch an existing entry, rewards are claimed once.
 */
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { DEX_COUNTER_MAX, progressRepo } from '../src/repos/progress';
import { T0, at, mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

describe('dex research in persist', () => {
  it('markSeen: new once, then counts every sighting with its extras; the first zone sticks', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx);
      expect(await progressRepo.markSeen(tx, p, 'glimfin', T0, { zone: 'mire_route', also: { seenWater: 1 } })).toBe(true);
      expect(await progressRepo.markSeen(tx, p, 'glimfin', at(1), { zone: 'skyrend', also: { seenNight: 1, seenWater: 1 } })).toBe(false);
      expect(await progressRepo.markSeen(tx, p, 'glimfin', at(2))).toBe(false);
      const dex = await progressRepo.dex(tx, p);
      expect(dex.seen).toEqual(['glimfin']);
      expect(dex.entries['glimfin']).toEqual({ seenAt: T0, caughtAt: null, counters: { seen: 3, seenWater: 2, seenNight: 1 }, firstSeenZone: 'mire_route', viewedAt: null });
    });
  });

  it('markCaught counts catches, non-normal variants and alphas; an entry it creates counts one sighting', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx);
      await progressRepo.markCaught(tx, p, 'mossling', 'normal', false, T0);
      await progressRepo.markCaught(tx, p, 'mossling', 'dusk', true, at(1));
      await progressRepo.markCaught(tx, p, 'mossling', 'dusk', false, at(2));
      expect((await progressRepo.counters(tx, p, ['mossling', 'nobody']))).toEqual({ mossling: { seen: 1, caught: 3, variant: 2, alpha: 1 } });
      await progressRepo.markSeen(tx, p, 'mossling', at(3));
      expect((await progressRepo.counters(tx, p, ['mossling']))['mossling']).toEqual({ seen: 2, caught: 3, variant: 2, alpha: 1 });
    });
  });

  it('bumpCounter(s) touch an existing entry only, ignore non-positive bumps and cap at DEX_COUNTER_MAX', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx);
      expect(await progressRepo.bumpCounter(tx, p, 'bramblecub', 'defeated')).toBe(false);
      expect(await progressRepo.dex(tx, p)).toMatchObject({ seen: [] });
      await progressRepo.markSeen(tx, p, 'bramblecub', T0);
      expect(await progressRepo.bumpCounter(tx, p, 'bramblecub', 'defeated')).toBe(true);
      expect(await progressRepo.bumpCounter(tx, p, 'bramblecub', 'defeated', 2)).toBe(true);
      expect(await progressRepo.bumpCounters(tx, p, 'bramblecub', { 'form:majin': 1, signature: 3, bogus: 0, worse: -4 })).toBe(true);
      expect(await progressRepo.bumpCounters(tx, p, 'bramblecub', { nothing: 0 })).toBe(false);
      expect((await progressRepo.counters(tx, p, ['bramblecub']))['bramblecub']).toEqual({ seen: 1, defeated: 3, 'form:majin': 1, signature: 3 });
      await progressRepo.bumpCounter(tx, p, 'bramblecub', 'defeated', DEX_COUNTER_MAX * 5);
      expect((await progressRepo.counters(tx, p, ['bramblecub']))['bramblecub']!['defeated']).toBe(DEX_COUNTER_MAX);
    });
  });

  it('markViewed sets viewed_at on an existing entry only', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx);
      expect(await progressRepo.markViewed(tx, p, 'glimfin', T0)).toBe(false);
      await progressRepo.markSeen(tx, p, 'glimfin', T0);
      expect(await progressRepo.markViewed(tx, p, 'glimfin', at(5))).toBe(true);
      expect((await progressRepo.dex(tx, p)).entries['glimfin']!.viewedAt).toEqual(at(5));
    });
  });

  it('claimReward is idempotent; claimedRewards lists each once, oldest first, per player', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx);
      const q = await mkPlayer(tx);
      expect(await progressRepo.claimReward(tx, p, 'dex:caught:10', at(2))).toBe(true);
      expect(await progressRepo.claimReward(tx, p, 'dex:caught:10', at(3))).toBe(false);
      expect(await progressRepo.claimReward(tx, p, 'dex:research5:1', at(1))).toBe(true);
      expect(await progressRepo.claimedRewards(tx, p)).toEqual(['dex:research5:1', 'dex:caught:10']);
      expect(await progressRepo.claimedRewards(tx, q)).toEqual([]);
    });
  });

  it('0025 backfills the counters and viewed_at of entries that existed before it', async () => {
    const migration = readFileSync(new URL('../drizzle/0025_dex_research.sql', import.meta.url), 'utf8');
    const update = migration.slice(migration.indexOf('UPDATE "dex_entries"'));
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx);
      await progressRepo.markSeen(tx, p, 'glimfin', T0);
      await progressRepo.markCaught(tx, p, 'mossling', 'dusk', true, T0);
      await progressRepo.markCaught(tx, p, 'mossling', 'ember', false, T0);
      await tx.execute(sql`update dex_entries set counters = '{}'::jsonb, viewed_at = null where player_id = ${p}`);
      await tx.execute(sql.raw(update.replace(/;\s*$/, ` WHERE "player_id" = '${p}';`)));
      expect(await progressRepo.counters(tx, p, ['glimfin', 'mossling'])).toEqual({ glimfin: { seen: 1 }, mossling: { seen: 1, caught: 1, alpha: 1, variant: 2 } });
      // and every old entry counts as viewed at its latest record (no "new" markers on an old collection)
      const entries = (await progressRepo.dex(tx, p)).entries;
      expect(entries['glimfin']!.viewedAt).toEqual(T0);
      expect(entries['mossling']!.viewedAt).toEqual(T0);
    });
  });
});
