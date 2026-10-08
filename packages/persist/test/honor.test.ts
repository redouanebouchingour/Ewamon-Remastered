/**
 * The honor ledger (migration 0005_honor): `creature_instances.honor smallint NOT NULL DEFAULT 0`. A creature carries
 * `honor` only when it is non-zero (absent otherwise, so every other CreatureInstance keeps its exact shape); an update
 * writes it back.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import type { AnyDb } from '../src/db';
import { creatureRepo } from '../src/repos/creatures';
import { mkCreature, mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

describe('the honor ledger in persist', () => {
  it('0005_honor adds a smallint NOT NULL DEFAULT 0 column', async () => {
    const rows = await db.transaction(async (tx) => {
      const r = await tx.execute<{ data_type: string; is_nullable: string; column_default: string }>(
        sql`select data_type, is_nullable, column_default from information_schema.columns
            where table_name = 'creature_instances' and column_name = 'honor'`,
      );
      return [...r.rows];
    });
    expect(rows.map((r) => [r.data_type, r.is_nullable, r.column_default])).toEqual([['smallint', 'NO', '0']]);
  });

  it('round-trips a non-zero ledger; zero reads back with no honor key', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx);
      const plain = await mkCreature(tx, p, { kind: 'party', index: 0 });
      expect('honor' in plain).toBe(false);
      await creatureRepo.update(tx, { ...plain, honor: -4 });
      expect((await creatureRepo.byId(tx, plain.id))!.honor).toBe(-4);
      await creatureRepo.update(tx, { ...plain, honor: 7 });
      expect((await creatureRepo.party(tx, p)).find((c) => c.id === plain.id)!.honor).toBe(7);
      await creatureRepo.update(tx, { ...plain, honor: 0 });
      expect('honor' in (await creatureRepo.byId(tx, plain.id))!).toBe(false);
    });
  });
});
