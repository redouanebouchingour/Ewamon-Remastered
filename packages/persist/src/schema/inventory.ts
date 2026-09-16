import { sql } from 'drizzle-orm';
import { check, integer, pgTable, primaryKey, uuid, varchar } from 'drizzle-orm/pg-core';
import { players } from './players';

export const inventoryItems = pgTable(
  'inventory_items',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    itemId: varchar('item_id', { length: 32 }).notNull(),
    qty: integer('qty').notNull(),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.itemId] }), check('inventory_qty_ck', sql`${t.qty} between 0 and 999`)],
);

export type InventoryRow = typeof inventoryItems.$inferSelect;
