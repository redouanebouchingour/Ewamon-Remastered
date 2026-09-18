import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnyDb } from '../src/db';
import { isPersistError } from '../src/errors';
import { inventoryRepo } from '../src/repos/inventory';
import { inventoryItems } from '../src/schema/index';
import { expectDbError, expectPersistError, mkPlayer, openTestDb } from './helpers';

let db: AnyDb;
beforeAll(async () => {
  db = await openTestDb();
});
afterAll(async () => {
  await db.close();
});

describe('InventoryRepo.add (§5.2) — qty can never go negative', () => {
  it('grants upsert, spends subtract, and a spend past zero is rejected with InsufficientItems', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx);
      expect(await inventoryRepo.add(tx, p, 'potion', 5)).toBe(5);
      expect(await inventoryRepo.add(tx, p, 'potion', 3)).toBe(8);
      expect(await inventoryRepo.add(tx, p, 'potion', -3)).toBe(5);
      await expectPersistError('InsufficientItems', () => inventoryRepo.add(tx, p, 'potion', -6));
      expect(await inventoryRepo.qty(tx, p, 'potion')).toBe(5); // untouched by the failed spend
      await expectPersistError('InsufficientItems', () => inventoryRepo.add(tx, p, 'never_had', -1));
      expect(await inventoryRepo.all(tx, p)).toEqual({ potion: 5 });
    });
  });

  it('the rejection is a typed PersistError callers can switch on', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx);
      await inventoryRepo.add(tx, p, 'orb', 1);
      let caught: unknown;
      try {
        await inventoryRepo.add(tx, p, 'orb', -2);
      } catch (e) {
        caught = e;
      }
      expect(isPersistError(caught)).toBe(true);
      expect(isPersistError(caught, 'InsufficientItems')).toBe(true);
      expect(isPersistError(caught, 'InsufficientFunds')).toBe(false);
      expect((caught as Error).name).toBe('PersistError');
    });
  });

  it('spending down to zero removes the row; the 0..999 cap is enforced as InventoryOverflow', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx);
      await inventoryRepo.add(tx, p, 'orb', 2);
      expect(await inventoryRepo.add(tx, p, 'orb', -2)).toBe(0);
      expect(await inventoryRepo.all(tx, p)).toEqual({});
      expect(await inventoryRepo.add(tx, p, 'orb', 999)).toBe(999);
      await expectPersistError('InventoryOverflow', () => inventoryRepo.add(tx, p, 'orb', 1));
      await expectPersistError('InventoryOverflow', () => inventoryRepo.add(tx, p, 'fresh', 1000));
      expect(await inventoryRepo.qty(tx, p, 'orb')).toBe(999);
      expect(await inventoryRepo.qty(tx, p, 'fresh')).toBe(0);
      await expectPersistError('InvalidArgument', () => inventoryRepo.add(tx, p, 'orb', 1.5));
    });
  });

  it('the CHECK constraint backs the repo up against a raw write', async () => {
    await db.transaction(async (tx) => {
      const p = await mkPlayer(tx);
      await expectDbError(/inventory_qty_ck/, () => tx.insert(inventoryItems).values({ playerId: p, itemId: 'x', qty: -1 }));
    });
  });

  it('a failed spend inside a larger transaction rolls back the earlier grants too', async () => {
    const p = await db.transaction((tx) => mkPlayer(tx));
    await db.transaction(async (tx) => {
      await inventoryRepo.add(tx, p, 'potion', 3);
    });
    await expect(
      db.transaction(async (tx) => {
        await inventoryRepo.add(tx, p, 'potion', 10);
        await inventoryRepo.add(tx, p, 'super_potion', 2);
        await inventoryRepo.add(tx, p, 'potion', -100);
      }),
    ).rejects.toMatchObject({ code: 'InsufficientItems' });
    await db.transaction(async (tx) => {
      expect(await inventoryRepo.all(tx, p)).toEqual({ potion: 3 });
    });
  });

  it('addMany applies several deltas and is all-or-nothing inside its transaction', async () => {
    const p = await db.transaction((tx) => mkPlayer(tx));
    await db.transaction(async (tx) => {
      expect(await inventoryRepo.addMany(tx, p, { potion: 2, orb: 5 })).toEqual({ orb: 5, potion: 2 });
    });
    await expect(db.transaction((tx) => inventoryRepo.addMany(tx, p, { orb: -1, potion: -3 }))).rejects.toMatchObject({ code: 'InsufficientItems' });
    await db.transaction(async (tx) => {
      expect(await inventoryRepo.all(tx, p)).toEqual({ orb: 5, potion: 2 });
    });
  });
});
