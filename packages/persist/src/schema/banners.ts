import { jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { creatureInstances } from './creatures';
import { players } from './players';

/**
 * Trainer banners (migration 0027): what a trainer picked for the card other trainers see (content `data/banners.ts`).
 * One row per player, written by `POST /banner`; no row = the default banner. Ids are content ids, checked by the
 * server against the trainer's unlocks on save; a creature that leaves the trainer clears `featured_id`.
 */
export const playerBanners = pgTable('player_banners', {
  playerId: uuid('player_id')
    .primaryKey()
    .references(() => players.id, { onDelete: 'cascade' }),
  frame: varchar('frame', { length: 32 }).notNull(),
  backdrop: varchar('backdrop', { length: 32 }).notNull(),
  pins: jsonb('pins').$type<string[]>().notNull().default([]),
  trackers: jsonb('trackers').$type<string[]>().notNull().default([]),
  featuredId: uuid('featured_id').references(() => creatureInstances.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PlayerBannerRow = typeof playerBanners.$inferSelect;
