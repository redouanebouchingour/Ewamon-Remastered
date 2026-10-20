/**
 * Ghost trainers (migration 0015): a save replaces the trainer's ghost (an empty party leaves none); the recent ghosts
 * of a zone are the ones since a time, newest first, banned trainers' never; a fight is recorded, told once, and
 * counted in the record.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { AnyDb } from '../src/db';
import { creatureRepo } from '../src/repos/creatures';
import { ghostRepo } from '../src/repos/ghosts';
import { players } from '../src/schema/index';
import { mkCreature, mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

const at = (h: number): Date => new Date(Date.UTC(2026, 9, 20, h));

describe('ghosts', () => {
  it('saves, lists, records and tells once', async () => {
    await db.transaction(async (tx) => {
      const [a, b, c] = [await mkPlayer(tx, 'ghost_a'), await mkPlayer(tx, 'ghost_b'), await mkPlayer(tx, 'ghost_c')];
      for (const p of [a, b, c]) await mkCreature(tx, p, { kind: 'party', index: 0 });
      const party = (id: string) => creatureRepo.party(tx, id);
      await ghostRepo.save(tx, a, 'ghost_a', 'mire_route', await party(a), at(1));
      await ghostRepo.save(tx, a, 'ghost_a', 'mirevale', await party(a), at(3));
      await ghostRepo.save(tx, b, 'ghost_b', 'mirevale', await party(b), at(2));
      await ghostRepo.save(tx, c, 'ghost_c', 'mirevale', [], at(4));
      expect((await ghostRepo.of(tx, a))?.zoneId).toBe('mirevale');
      expect(await ghostRepo.of(tx, c)).toBeNull();
      expect((await ghostRepo.recent(tx, 'mirevale', at(0), 8)).map((g) => g.name)).toEqual(['ghost_a', 'ghost_b']);
      expect((await ghostRepo.recent(tx, 'mirevale', at(3), 8)).map((g) => g.name)).toEqual(['ghost_a']);
      expect(await ghostRepo.recent(tx, 'mire_route', at(0), 8)).toEqual([]);
      await tx.update(players).set({ bannedAt: at(5) }).where(eq(players.id, b));
      expect((await ghostRepo.recent(tx, 'mirevale', at(0), 8)).map((g) => g.name)).toEqual(['ghost_a']);

      await ghostRepo.record(tx, a, 'someone', 'mirevale', true, at(6));
      await ghostRepo.record(tx, a, 'another', 'mirevale', false, at(7));
      expect((await ghostRepo.report(tx, a)).map((f) => [f.challenger, f.won])).toEqual([
        ['someone', true],
        ['another', false],
      ]);
      expect(await ghostRepo.report(tx, a)).toEqual([]);
      const record = await ghostRepo.fights(tx, a, 10);
      expect(record).toMatchObject({ won: 1, lost: 1 });
      expect(record.fights.map((f) => f.challenger)).toEqual(['another', 'someone']);
    });
  });
});
