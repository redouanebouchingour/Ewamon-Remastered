import { sql } from 'drizzle-orm';
import { bigserial, boolean, index, integer, pgTable, smallint, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { creatureInstances } from './creatures';
import { listingStatus } from './enums';
import { players } from './players';

export const listings = pgTable(
  'listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => players.id),
    creatureId: uuid('creature_id')
      .notNull()
      .references(() => creatureInstances.id),
    /** denormalised for search */
    speciesId: varchar('species_id', { length: 32 }).notNull(),
    level: smallint('level').notNull(),
    variantKey: varchar('variant_key', { length: 8 }).notNull(),
    isAlpha: boolean('is_alpha').notNull(),
    startingBid: integer('starting_bid').notNull(),
    currentBid: integer('current_bid'),
    currentBidderId: uuid('current_bidder_id').references(() => players.id),
    buyNowPrice: integer('buy_now_price'),
    status: listingStatus('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [
    index('listings_active_idx').on(t.status, t.expiresAt),
    index('listings_seller_idx').on(t.sellerId),
    index('listings_search_idx').on(t.status, t.speciesId, t.level),
    uniqueIndex('listings_creature_active_uq')
      .on(t.creatureId)
      .where(sql`${t.status} = 'active'`),
  ],
);

export const bids = pgTable(
  'bids',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    bidderId: uuid('bidder_id')
      .notNull()
      .references(() => players.id),
    amount: integer('amount').notNull(),
    placedAt: timestamp('placed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('bids_listing_idx').on(t.listingId, t.placedAt)],
);

export type ListingRow = typeof listings.$inferSelect;
export type BidRow = typeof bids.$inferSelect;
