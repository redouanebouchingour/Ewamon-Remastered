/**
 * Creature history (migration 0007): an inserted creature records its original trainer and a `met` event (caught in a
 * zone at the catch time, or received); a trade, a market sale and a gift each add their change of hands with both
 * names; `addEvent` writes one event per creature; `history` lists them oldest first; the original trainer's name
 * outlives their account; a creature's events go with it.
 */
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { creatureRepo } from '../src/repos/creatures';
import { creatureEvents } from '../src/schema/index';
import { mkCreature, mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

/** after every creature insert's default `now()` (a received creature's `met` time), whenever the suite runs */
const NOW = new Date(Date.now() + 3_600_000);

describe('creature history', () => {
  it('a catch records its trainer, zone and time; a starter is received', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx, 'ash_hist');
      const caught = await mkCreature(tx, p, { kind: 'party', index: 0 }, { speciesId: 'glimfin', level: 7, caughtAt: { zoneId: 'mire_route', at: Date.parse('2026-10-19T08:00:00.000Z') } });
      const given = await mkCreature(tx, p, { kind: 'box', index: 'nextBox' }, { caughtAt: null });
      const h = await creatureRepo.history(tx, caught.id);
      expect(h?.originalTrainer).toBe('ash_hist');
      expect(h?.events).toEqual([{ detail: { kind: 'met', how: 'caught', speciesId: 'glimfin', level: 7, zoneId: 'mire_route', trainer: 'ash_hist' }, at: new Date('2026-10-19T08:00:00.000Z') }]);
      const g = await creatureRepo.history(tx, given.id);
      expect(g?.events[0]?.detail).toMatchObject({ kind: 'met', how: 'received', zoneId: null });
      expect(await creatureRepo.history(tx, '00000000-0000-4000-8000-000000000000')).toBeNull();
    });
  });

  it('a trade, a sale and a gift add their change of hands; addEvent marks several creatures at once', async () => {
    await db.transaction(async (tx) => {
      const a = await mkPlayer(tx, 'hist_a');
      const b = await mkPlayer(tx, 'hist_b');
      await mkCreature(tx, a, { kind: 'party', index: 0 });
      await mkCreature(tx, b, { kind: 'party', index: 0 });
      const c = await mkCreature(tx, a, { kind: 'box', index: 'nextBox' });
      await creatureRepo.transferCreature(tx, c.id, a, b, 'trade', NOW);
      await creatureRepo.transferCreature(tx, c.id, b, a, 'marketSale', NOW);
      await creatureRepo.transferCreature(tx, c.id, a, b, 'gift', NOW);
      const d = await mkCreature(tx, b, { kind: 'box', index: 'nextBox' });
      await creatureRepo.addEvent(tx, [c.id, d.id], { kind: 'badge', badge: 'tidal' }, NOW);
      const h = (await creatureRepo.history(tx, c.id))!;
      expect(h.originalTrainer).toBe('hist_a');
      expect(h.events.map((e) => e.detail)).toEqual([
        expect.objectContaining({ kind: 'met' }),
        { kind: 'traded', from: 'hist_a', to: 'hist_b' },
        { kind: 'sold', from: 'hist_b', to: 'hist_a' },
        { kind: 'gift', from: 'hist_a', to: 'hist_b' },
        { kind: 'badge', badge: 'tidal' },
      ]);
      expect((await creatureRepo.history(tx, d.id))!.events.at(-1)!.detail).toEqual({ kind: 'badge', badge: 'tidal' });
    });
  });

  it("the original trainer's name outlives their account; the events go with the creature", async () => {
    await db.transaction(async (tx) => {
      const a = await mkPlayer(tx, 'hist_gone');
      const b = await mkPlayer(tx, 'hist_keep');
      await mkCreature(tx, a, { kind: 'party', index: 0 });
      await mkCreature(tx, b, { kind: 'party', index: 0 });
      const c = await mkCreature(tx, a, { kind: 'box', index: 'nextBox' });
      await creatureRepo.transferCreature(tx, c.id, a, b, 'trade', NOW);
      await tx.execute(sql`delete from players where id = ${a}`);
      expect((await creatureRepo.history(tx, c.id))?.originalTrainer).toBe('hist_gone');
      await tx.execute(sql`delete from creature_instances where id = ${c.id}`);
      const left = await tx.select().from(creatureEvents).where(sql`${creatureEvents.creatureId} = ${c.id}`);
      expect(left).toEqual([]);
    });
  });
});
