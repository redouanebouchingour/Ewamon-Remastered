import { and, eq, gt, sql } from 'drizzle-orm';
import type { Tx } from '../db';
import { fail } from '../errors';
import { inventoryItems } from '../schema/index';

export const INVENTORY_MAX_QTY = 999;

export const inventoryRepo = {
  async all(tx: Tx, playerId: string): Promise<Record<string, number>> {
    const rows = await tx
      .select({ itemId: inventoryItems.itemId, qty: inventoryItems.qty })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.playerId, playerId), gt(inventoryItems.qty, 0)))
      .orderBy(inventoryItems.itemId);
    const out: Record<string, number> = {};
    for (const r of rows) out[r.itemId] = r.qty;
    return out;
  },

  async qty(tx: Tx, playerId: string, itemId: string): Promise<number> {
    const [r] = await tx
      .select({ qty: inventoryItems.qty })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.playerId, playerId), eq(inventoryItems.itemId, itemId)))
      .limit(1);
    return r?.qty ?? 0;
  },

  /**
   * qty += delta in one statement. Grants upsert (INSERT … ON CONFLICT DO UPDATE) guarded by
   * `qty + delta <= 999`; spends UPDATE guarded by `qty + delta >= 0`. Nothing is written when the
   * guard fails, so a failed spend leaves the row untouched — and the CHECK (0..999) backs it up.
   * Throws InsufficientItems | InventoryOverflow. Returns the new quantity.
   */
  async add(tx: Tx, playerId: string, itemId: string, delta: number): Promise<number> {
    if (!Number.isInteger(delta)) fail('InvalidArgument', 'delta must be an integer');
    if (delta === 0) return inventoryRepo.qty(tx, playerId, itemId);
    if (delta > 0) {
      if (delta > INVENTORY_MAX_QTY) fail('InventoryOverflow');
      const [row] = await tx
        .insert(inventoryItems)
        .values({ playerId, itemId, qty: delta })
        .onConflictDoUpdate({
          target: [inventoryItems.playerId, inventoryItems.itemId],
          set: { qty: sql`${inventoryItems.qty} + ${delta}` },
          setWhere: sql`${inventoryItems.qty} + ${delta} <= ${INVENTORY_MAX_QTY}`,
        })
        .returning({ qty: inventoryItems.qty });
      if (!row) fail('InventoryOverflow');
      return row.qty;
    }
    const [row] = await tx
      .update(inventoryItems)
      .set({ qty: sql`${inventoryItems.qty} + ${delta}` })
      .where(and(eq(inventoryItems.playerId, playerId), eq(inventoryItems.itemId, itemId), sql`${inventoryItems.qty} + ${delta} >= 0`))
      .returning({ qty: inventoryItems.qty });
    if (!row) fail('InsufficientItems', `${itemId} x${-delta}`);
    if (row.qty === 0) {
      await tx.delete(inventoryItems).where(and(eq(inventoryItems.playerId, playerId), eq(inventoryItems.itemId, itemId)));
    }
    return row.qty;
  },

  /** Convenience: several grants/spends in one call; any failure throws and (inside a tx) rolls all back. */
  async addMany(tx: Tx, playerId: string, deltas: Readonly<Record<string, number>>): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const itemId of Object.keys(deltas).sort()) out[itemId] = await inventoryRepo.add(tx, playerId, itemId, deltas[itemId]!);
    return out;
  },
};

export type InventoryRepo = typeof inventoryRepo;
